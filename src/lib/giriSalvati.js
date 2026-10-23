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

export const SORGENTI_GIRO = ['per_te', 'quiz', 'crea', 'sorprendimi', 'altro'];
export const MAX_TAPPE_SALVATE = 30;

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
    const source = SORGENTI_GIRO.includes(sorgente) ? sorgente : 'altro';
    const city = testo(tour.city || tour.location?.split?.(',')?.[0], 80);
    return {
        // L'id nasce dal contenuto (non dall'id del giro, che cambia a ogni generazione): stesso giro = stessa riga.
        tour_id: idStabile(source, [title, city, ...tappe.map(s => s.title || s.name)]),
        source,
        title,
        city,
        stops: tappe.map(s => ({
            title: testo(s.title || s.name, 120),
            lat: num(s.lat ?? s.latitude),
            lng: num(s.lng ?? s.longitude),
        })),
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

/** I giri salvati dell'utente (la RLS lascia passare solo i suoi), dal piu' recente. Non rigetta. */
export async function leggiGiriSalvati(limite = 50) {
    try {
        const res = await supabase.from('saved_tours')
            .select(COLONNE)
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
