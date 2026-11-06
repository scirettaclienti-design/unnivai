/**
 * DNA-6 — i giri generati che l'utente salva (public.saved_tours).
 *
 * `favorites` non basta: il suo tour_id e' un uuid con chiave esterna su `tours`, e un giro
 * generato dall'AI non e' una riga di `tours`. Qui il giro si salva per intero (titolo, citta',
 * tappe con nome e coordinate) e, SOLO se il salvataggio e' riuscito, si registra `tour_saved`.
 *
 * Nessuna chiamata AI. Nessuna funzione rigetta: l'esito e' sempre { ok, … }.
 */

import { supabase } from './supabase.js';
import { logDnaEvent } from './dnaRegistro.js';
import { tourCoreCategories } from '../services/preferenceEngine.js';
import { romeDate, romeParts } from './tourWindow.js';

export const SORGENTI_GIRO = ['per_te', 'quiz', 'crea', 'sorprendimi', 'altro'];
export const MAX_TAPPE_SALVATE = 30;
/** Le righe di un giro salvato (tappe vere e tempo libero): il tetto della tabella, `jsonb_array_length(stops) <= 30`. */
export const MAX_RIGHE_SALVATE = 30;
/** Il tetto della tabella e' `pg_column_size(stops) <= 20000`: si resta sotto, con margine (jsonb pesa un po' piu' del testo). */
export const MAX_BYTE_SALVATI = 17000;

/** Un id stabile dal contenuto del giro: lo stesso giro salvato due volte ha lo stesso id (nessun doppione). */
export function idStabile(prefisso, parti = []) {
    let h = 5381;
    for (const ch of parti.map(p => String(p ?? '')).join('|')) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
    return `${prefisso}-${h.toString(36)}`;
}

const COLONNE = 'id,tour_id,source,title,city,stops,created_at';

const num = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
};
const testo = (v, max) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s ? s.slice(0, max) : null;
};

/** Le tappe di un giro, in qualunque forma arrivi (steps / stops, title / name, lat / latitude). */
export function tappeDelGiro(tour) {
    const grezze = Array.isArray(tour?.steps) && tour.steps.length ? tour.steps
        : Array.isArray(tour?.stops) ? tour.stops : [];
    return grezze.filter(s => s && !s.tempoLibero);
}

/**
 * L'ISTANTANEA di una riga del giro: tutto cio' che le schede mostrano (titolo, orario, sosta, momento, testo, foto, tipi, orari di
 * apertura, righe di tempo libero), senza i campi di diagnosi del motore (`_tracciato`, `_comp`, `_orario`, …: iniziano con «_»).
 * E' quello che permette di riaprire il giro com'era, senza rigenerarlo (0 $).
 */
export function istantanea(stop) {
    const pulita = {};
    for (const [k, v] of Object.entries(stop || {})) {
        if (k.startsWith('_') || v === undefined || typeof v === 'function') continue;
        pulita[k] = v;
    }
    const copia = JSON.parse(JSON.stringify(pulita));
    return {
        ...copia,
        title: testo(copia.title || copia.name, 120),
        lat: num(copia.lat ?? copia.latitude),
        lng: num(copia.lng ?? copia.longitude),
    };
}

/** Le categorie di base del giro (dai tipi delle tappe), per `tour_saved`. */
export function categorieDelGiro(tour) {
    return tourCoreCategories(tappeDelGiro(tour));
}

/**
 * La riga da salvare (pura). null se il giro non ha titolo o non ha nessuna tappa: non si salva un giro vuoto.
 * @param {object} tour
 * @param {string} sorgente - uno di SORGENTI_GIRO
 */
export function giroDaSalvare(tour, sorgente = 'altro') {
    if (!tour) return null;
    const title = testo(tour.title, 120);
    const tappe = tappeDelGiro(tour).slice(0, MAX_TAPPE_SALVATE);
    if (!title || tappe.length === 0) return null;
    // tutte le righe nell'ordine del giro (anche il tempo libero), fermandosi alle prime MAX_TAPPE_SALVATE tappe vere
    const grezze = Array.isArray(tour?.steps) && tour.steps.length ? tour.steps : (Array.isArray(tour?.stops) ? tour.stops : []);
    const righe = [];
    let vere = 0;
    for (const s of grezze) {
        if (!s) continue;
        if (!s.tempoLibero && vere >= MAX_TAPPE_SALVATE) continue;
        if (!s.tempoLibero) vere += 1;
        righe.push(istantanea(s));
    }
    let stops = righe.slice(0, MAX_RIGHE_SALVATE);
    // un giro enorme (foto lunghe, orari di apertura) perde prima gli orari di apertura, poi le foto: mai la riga intera
    if (JSON.stringify(stops).length > MAX_BYTE_SALVATI) stops = stops.map(({ openingPeriods, ...r }) => r); // eslint-disable-line no-unused-vars
    if (JSON.stringify(stops).length > MAX_BYTE_SALVATI) stops = stops.map(({ googlePhoto, image, images, ...r }) => r); // eslint-disable-line no-unused-vars
    const source = SORGENTI_GIRO.includes(sorgente) ? sorgente : 'altro';
    const city = testo(tour.city || tour.location?.split?.(',')?.[0], 80);
    return {
        // L'id nasce dal contenuto (non dall'id del giro, che cambia a ogni generazione): stesso giro = stessa riga.
        // (con l'orario: lo stesso giro con orari diversi non e' lo stesso giro)
        tour_id: idStabile(source, [title, city, ...tappe.map(s => `${s.title || s.name}@${s.scheduledTime ?? ''}`)]),
        source,
        title,
        city,
        stops,
    };
}

/**
 * Il giro salvato come un tour che le schede sanno mostrare (riapertura dal Profilo, 0 $: nessuna chiamata AI).
 * Le righe tornano com'erano (orari, soste, momenti, testi, tempo libero); un giro salvato prima dell'istantanea (solo titolo e
 * coordinate) si riapre con quello che ha.
 */
export function giroSalvatoComeTour(riga) {
    if (!riga) return null;
    const steps = (Array.isArray(riga.stops) ? riga.stops : []).map((s) => {
        const lat = num(s.lat ?? s.latitude), lng = num(s.lng ?? s.longitude);
        return { ...s, title: s.title ?? s.name ?? null, lat, lng, latitude: lat, longitude: lng };
    });
    const vere = steps.filter(s => !s.tempoLibero);
    const con = vere.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    const centro = con.length
        ? { latitude: con.reduce((a, s) => a + s.lat, 0) / con.length, longitude: con.reduce((a, s) => a + s.lng, 0) / con.length }
        : null;
    return {
        id: `salvato-${riga.id}`,
        title: riga.title,
        city: riga.city,
        steps,
        stops: steps,
        isAiGenerated: true,
        type: 'self-guided',
        ...(centro ? { center: centro } : {}),
        salvatoDa: riga.id,
        sorgente: riga.source || 'altro',
    };
}

/**
 * Salva il giro per l'utente e, se e' nuovo, registra `tour_saved`.
 * Lo stesso giro salvato due volte (stesso tour_id) non e' un errore e non conta due volte.
 * @returns {Promise<{ ok: boolean, giaSalvato?: boolean, errore?: string }>}
 */
export async function salvaGiro(userId, tour, sorgente) {
    if (!userId) return { ok: false, errore: 'accesso' };
    const riga = giroDaSalvare(tour, sorgente);
    if (!riga) return { ok: false, errore: 'vuoto' };
    try {
        const res = await supabase.from('saved_tours').insert({ ...riga, user_id: userId });
        if (res?.error) {
            if (res.error.code === '23505') return { ok: true, giaSalvato: true }; // stesso giro: gia' salvato
            return { ok: false, errore: res.error.message || 'rete' };
        }
        logDnaEvent('tour_saved', { categories: categorieDelGiro(tour), city: riga.city, tourId: riga.tour_id });
        return { ok: true, giaSalvato: false };
    } catch (e) {
        return { ok: false, errore: String(e) };
    }
}

/** I giri salvati dell'utente (la RLS lascia passare solo i suoi), dal piu' recente; i giri finiti stanno in «Rivivi» (leggiGiriFatti). Non rigetta. */
export async function leggiGiriSalvati(limite = 50) {
    try {
        const res = await supabase.from('saved_tours')
            .select(COLONNE)
            .not('tour_id', 'like', `${PREFISSO_FATTO}%`)
            .order('created_at', { ascending: false })
            .limit(limite);
        if (!res || res.error || !Array.isArray(res.data)) return { ok: false, giri: [] };
        return { ok: true, giri: res.data };
    } catch {
        return { ok: false, giri: [] };
    }
}

/** Toglie un giro salvato (solo il proprio, per RLS). */
export async function rimuoviGiroSalvato(id) {
    if (!id) return { ok: false };
    try {
        const res = await supabase.from('saved_tours').delete().eq('id', id);
        return { ok: !res?.error };
    } catch {
        return { ok: false };
    }
}

// ─── PROFILO-SEZIONI — i giri finiti: «Rivivi» ───────────────────────────────
// Il registro del DNA sa citta', data e conteggi, ma non le tappe: per rivedere e rifare un giro serve la sua istantanea. Sta in
// `saved_tours` (stesse regole di accesso, la cancella l'eliminazione dell'account) con `tour_id` «fatto-…», scritta quando il giro
// e' completato. Non e' un «salvato»: non registra `tour_saved` e il DNA non ne sa niente.

export const PREFISSO_FATTO = 'fatto-';
export const GIRI_FATTI_LETTI = 20;

export const isGiroFatto = (riga) => String(riga?.tour_id || '').startsWith(PREFISSO_FATTO);

/**
 * La riga del giro finito (pura). Ogni tappa porta `fatta`; null se il giro non ha tappe.
 * L'id viene dal giro e dal giorno: lo stesso giro registrato due volte lo stesso giorno resta una riga, un giro rifatto ha un id suo.
 * @param {object} tour
 * @param {number[]} indiciFatti - gli indici in `tour.steps` delle tappe raggiunte
 * @param {Date} [quando]
 */
export function giroFattoDaSalvare(tour, indiciFatti = [], quando = new Date()) {
    if (!Array.isArray(tour?.steps) || !tour.steps.length) return null;
    const fatti = new Set(indiciFatti);
    const titolo = tour.title || (tour.city ? `Il tuo giro a ${tour.city}` : 'Il tuo giro');
    const steps = tour.steps.map((s, i) => (s ? { ...s, fatta: fatti.has(i) } : s));
    const riga = giroDaSalvare({ ...tour, title: titolo, steps }, tour.sorgente);
    if (!riga) return null;
    const p = romeParts(quando);
    const firma = [tour.id ?? tour.tourId ?? riga.tour_id, p.y, p.m, p.d];
    return { ...riga, tour_id: idStabile(PREFISSO_FATTO.slice(0, -1), firma) };
}

/** Scrive l'istantanea del giro finito. Mai bloccante e mai un errore a schermo: se non riesce restano le Mete. */
export async function salvaGiroFatto(userId, tour, indiciFatti) {
    if (!userId) return { ok: false, errore: 'accesso' };
    try {
        const riga = giroFattoDaSalvare(tour, indiciFatti);
        if (!riga) return { ok: false, errore: 'vuoto' };
        const res = await supabase.from('saved_tours').insert({ ...riga, user_id: userId });
        if (res?.error && res.error.code !== '23505') {
            console.warn('[giriSalvati] giro finito non scritto:', res.error.message);
            return { ok: false, errore: res.error.message || 'rete' };
        }
        return { ok: true };
    } catch (e) {
        console.warn('[giriSalvati] giro finito non scritto:', String(e));
        return { ok: false, errore: String(e) };
    }
}

/** I giri finiti dell'utente, dal piu' recente. Non rigetta. */
export async function leggiGiriFatti(limite = GIRI_FATTI_LETTI) {
    try {
        const res = await supabase.from('saved_tours')
            .select(COLONNE)
            .like('tour_id', `${PREFISSO_FATTO}%`)
            .order('created_at', { ascending: false })
            .limit(limite);
        if (!res || res.error || !Array.isArray(res.data)) return { ok: false, giri: [] };
        return { ok: true, giri: res.data };
    } catch {
        return { ok: false, giri: [] };
    }
}

/** Quante tappe del giro finito: { raggiunte, totali }. */
export function conteggioGiroFatto(riga) {
    const vere = (Array.isArray(riga?.stops) ? riga.stops : []).filter(s => s && !s.tempoLibero);
    return { raggiunte: vere.filter(s => s.fatta).length, totali: vere.length };
}

const giornoDopo = ({ y, m, d }, n) => {
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
const giornoUtc = ({ y, m, d }) => Date.UTC(y, m - 1, d);

/**
 * Il giro finito pronto da rifare (0 $, nessuna generazione). Stesse tappe e stessi orari sull'orologio, sul primo giorno utile: oggi se
 * la prima tappa e' ancora da venire, altrimenti domani (un orario passato direbbe il giorno sbagliato per gli orari di apertura). Un id
 * nuovo: e' un altro giro, che lascia la sua Meta e la sua riga. Via quello che valeva solo quel giorno.
 * @param {object} riga - la riga di saved_tours
 * @param {Date} [adesso]
 */
export function giroDaRifare(riga, adesso = new Date()) {
    const tour = giroSalvatoComeTour(riga);
    if (!tour) return null;
    const orari = tour.steps.map(s => Date.parse(s.scheduledTime)).filter(Number.isFinite);
    let sposta = (s) => s.scheduledTime;
    if (orari.length) {
        const primo = romeParts(new Date(Math.min(...orari)));
        const oggi = romeParts(adesso);
        const giorno = romeDate(oggi, { h: primo.h, m: primo.mi }) > adesso ? oggi : giornoDopo(oggi, 1);
        sposta = (s) => {
            const t = Date.parse(s.scheduledTime);
            if (!Number.isFinite(t)) return s.scheduledTime;
            const p = romeParts(new Date(t));
            const giorni = Math.round((giornoUtc(p) - giornoUtc(primo)) / 86_400_000);
            return romeDate(giornoDopo(giorno, giorni), { h: p.h, m: p.mi }).toISOString();
        };
    }
    const steps = tour.steps.map((s) => {
        const { fatta, openNow, currentHours, ...resto } = s; // eslint-disable-line no-unused-vars
        return s.scheduledTime ? { ...resto, scheduledTime: sposta(s) } : resto;
    });
    const { salvatoDa, ...base } = tour; // eslint-disable-line no-unused-vars
    return { ...base, id: `rifatto-${riga.id}-${adesso.getTime().toString(36)}`, steps, stops: steps, rifattoDa: riga.id };
}
