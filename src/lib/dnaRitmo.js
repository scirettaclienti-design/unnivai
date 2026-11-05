/**
 * DNA-5 — IL RITMO DEL DNA: quanto si ferma l'utente nelle tappe e quanti km fa, dai suoi giri veri.
 *
 * ─── DA DOVE VENGONO I DATI ─────────────────────────────────────────────────────────────────────────────────────────────
 * Il registro del DNA (public.dna_events, DNA-1) ha gia' una riga `stop_reached` per ogni tappa raggiunta, con l'ora
 * (`created_at`), la categoria e il giro (`tour_id`). Da DNA-5 la riga porta anche, nella colonna libera `value`
 * (nessuna colonna nuova, nessuna migrazione), tre numeri: `km=0.42;sosta=60;tipo=museo`
 *   · km    — la distanza in linea d'aria dalla tappa raggiunta prima (la stessa misura del tetto di 1,2 km);
 *   · sosta — la sosta PREVISTA dalla tabella del prodotto per quel tipo di posto (stayOf, mai quella gia' corretta dal ritmo:
 *             cosi' la misura non insegue se stessa);
 *   · tipo  — il tipo di posto (placeKind: museo, chiesa, verde, pasto…), per dire «nei musei» e non «nella cultura».
 * La sosta VERA di una tappa = (arrivo alla tappa dopo − arrivo a questa) − il cammino fra le due (km / 4,5 km/h).
 * Le righe vecchie (senza `value`) contano per le tappe e le categorie, non per soste e km: non si inventa niente.
 *
 * ─── COSA SI IMPARA ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * Dagli ultimi 5 giri con almeno 2 tappe raggiunte: il fattore delle soste (mediana di sosta vera / sosta prevista, fra 0,7
 * e 1,4), i km medi e le tappe medie per giro. Il ritmo appreso (lento / medio / veloce: la maggioranza dei tre segnali soste, km e
 * tappe; a parita' medio) si dice solo con almeno 2 giri;
 * il fattore solo con almeno 3 soste misurate in almeno 2 giri.
 *
 * ─── CHI VINCE ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 * richiesta (il ritmo scelto in Crea) → Profilo (il ritmo impostato dall'utente) → giri veri → scelte passate (pace_chosen).
 * Con il ritmo chiesto il DNA non tocca niente (DNA-3: la richiesta vince). Il ritmo cambia numero di tappe, soste e km
 * totali; il tetto di 1,2 km fra due tappe a piedi (T19) resta lo stesso per tutti i ritmi del DNA.
 *
 * Funzioni pure: niente rete, niente orologio.
 */

import { WALKING_KMH } from './tourTiming.js';
import { normalizeCategory } from '../services/preferenceEngine.js';

export const RITMI = ['lento', 'medio', 'veloce'];
/** Quanti giri recenti si guardano. */
export const RITMO_MAX_GIRI = 5;
/** Sotto questi numeri il ritmo (e il fattore) non si dice. */
export const RITMO_MIN_GIRI = 2;
export const RITMO_MIN_SOSTE = 3;
/** Il fattore delle soste resta fra questi due valori. */
export const FATTORE_MIN = 0.7;
export const FATTORE_MAX = 1.4;
/** Una sosta misurata e' credibile fra 3 minuti e 3 ore; un intervallo oltre 4 ore fra due arrivi e' una pausa, non una sosta. */
const SOSTA_MIN = 3;
const SOSTA_MAX = 180;
const INTERVALLO_MAX = 240;

/** Il fattore delle soste di un ritmo scelto (Profilo, scelte passate) o appreso senza soste misurate. */
export const FATTORE_RITMO = { lento: 1.25, medio: 1, veloce: 0.8 };
/** Le tappe di un tour di Per Te per ritmo (HOME_TOUR_STOPS: da 3 a 5). */
export const TAPPE_PER_TE = { lento: 3, medio: 4, veloce: 5 };
/** Come il ritmo del DNA conta le tappe per momento nello scheletro (daySkeleton.stopsFor): mai il tetto, mai i mezzi. */
export const PASSO_SCHELETRO = { lento: 'rilassato', medio: null, veloce: 'intenso' };

const RITMO_DA_PACE = { rilassato: 'lento', lento: 'lento', tranquillo: 'lento', attivo: 'medio', medio: 'medio', intenso: 'veloce', veloce: 'veloce' };
/** 'Rilassato' | 'Attivo' | 'Intenso' | 'lento'… → 'lento' | 'medio' | 'veloce' | null */
export function ritmoDa(valore) {
    const v = String(valore || '').toLowerCase().trim();
    return RITMO_DA_PACE[v] || null;
}

const arrotonda = (x, passo) => Math.round(x / passo) * passo;
const r1 = (x) => Math.round(x * 10) / 10;

// ─── La riga della tappa raggiunta ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Il `value` di una riga `stop_reached` (al massimo 80 caratteri, CHECK della tabella). Ogni campo solo se vero.
 * @param {{ km?: number|null, sosta?: number|null, tipo?: string|null }} p
 * @returns {string|null}
 */
export function valoreTappaRaggiunta({ km = null, sosta = null, tipo = null } = {}) {
    const parti = [];
    if (Number.isFinite(km) && km >= 0 && km < 100) parti.push(`km=${(Math.round(km * 100) / 100).toFixed(2)}`);
    if (Number.isFinite(sosta) && sosta > 0 && sosta < 600) parti.push(`sosta=${Math.round(sosta)}`);
    if (typeof tipo === 'string' && /^[a-z]{2,20}$/.test(tipo)) parti.push(`tipo=${tipo}`);
    return parti.length ? parti.join(';').slice(0, 80) : null;
}

/** Il contrario: { km, sosta, tipo } (null dove manca). Una riga vecchia, o un value di altro formato, da' tutti null. */
export function leggiValoreTappa(value) {
    const out = { km: null, sosta: null, tipo: null };
    for (const parte of String(value || '').split(';')) {
        const m = /^(km|sosta|tipo)=(.+)$/.exec(parte.trim());
        if (!m) continue;
        if (m[1] === 'tipo') { if (/^[a-z]{2,20}$/.test(m[2])) out.tipo = m[2]; continue; }
        const n = Number(m[2]);
        if (Number.isFinite(n) && n >= 0) out[m[1]] = n;
    }
    return out;
}

// ─── I giri dal registro ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * I giri veri, dal piu' recente: le tappe raggiunte di ogni giro (stesso `tour_id`) in ordine di arrivo, con la sosta misurata
 * dove si puo' misurare.
 * @param {object[]} righe - le righe di dna_events
 * @returns {{ tourId: string, citta: string|null, inizio: string, tappe: { categoria: string|null, tipo: string|null,
 *   arrivo: number, km: number|null, sostaPrevista: number|null, sostaMisurata: number|null }[], km: number|null }[]}
 */
export function giriDalRegistro(righe = []) {
    const visti = new Set();
    const perGiro = new Map();
    for (const r of Array.isArray(righe) ? righe : []) {
        if (!r || r.kind !== 'stop_reached' || !r.tour_id) continue;
        if (r.id) { if (visti.has(r.id)) continue; visti.add(r.id); }
        const t = new Date(r.created_at).getTime();
        if (!Number.isFinite(t)) continue;
        const v = leggiValoreTappa(r.value);
        const lista = perGiro.get(r.tour_id) || [];
        lista.push({ categoria: normalizeCategory(r.category) || null, tipo: v.tipo, arrivo: t, km: v.km, sostaPrevista: v.sosta, sostaMisurata: null, citta: r.city || null, id: r.id || '' });
        perGiro.set(r.tour_id, lista);
    }
    const giri = [];
    for (const [tourId, lista] of perGiro) {
        const tappe = lista.sort((a, b) => (a.arrivo - b.arrivo) || String(a.id).localeCompare(String(b.id)));
        for (let i = 0; i < tappe.length - 1; i++) {
            const dopo = tappe[i + 1];
            if (!Number.isFinite(dopo.km)) continue;
            const intervallo = (dopo.arrivo - tappe[i].arrivo) / 60000;
            if (!(intervallo > 0 && intervallo <= INTERVALLO_MAX)) continue;
            const sosta = Math.round(intervallo - (dopo.km / WALKING_KMH) * 60);
            if (sosta >= SOSTA_MIN) tappe[i].sostaMisurata = Math.min(sosta, SOSTA_MAX);
        }
        const tratti = tappe.slice(1).map(x => x.km);
        const km = tratti.length && tratti.every(Number.isFinite) ? r1(tratti.reduce((a, b) => a + b, 0)) : null;
        giri.push({
            tourId,
            citta: tappe.find(x => x.citta)?.citta || null,
            inizio: new Date(tappe[0].arrivo).toISOString(),
            tappe: tappe.map(({ citta, id, ...x }) => x), // eslint-disable-line no-unused-vars
            km,
        });
    }
    return giri.sort((a, b) => b.inizio.localeCompare(a.inizio));
}

const mediana = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Il ritmo che i giri veri dicono. Ogni numero solo se ci sono i dati per dirlo (altrimenti null).
 * @param {object[]} righe
 * @returns {{ giri: number, soste: number, fattoreSosta: number|null, sostaMedia: number|null, kmMedi: number|null, giriConKm: number,
 *   tappeMedie: number|null, ritmo: 'lento'|'medio'|'veloce'|null, perTipo: object, perCategoria: object, segnali: object }}
 */
export function ritmoAppreso(righe = [], { maxGiri = RITMO_MAX_GIRI } = {}) {
    const giri = giriDalRegistro(righe).filter(g => g.tappe.length >= 2).slice(0, maxGiri);
    const misurate = giri.flatMap((g, gi) => g.tappe.filter(t => Number.isFinite(t.sostaMisurata)).map(t => ({ ...t, gi })));
    const conPrevista = misurate.filter(t => Number.isFinite(t.sostaPrevista) && t.sostaPrevista > 0);
    const giriConSoste = new Set(conPrevista.map(t => t.gi)).size;
    const fattoreSosta = conPrevista.length >= RITMO_MIN_SOSTE && giriConSoste >= RITMO_MIN_GIRI
        ? Math.round(arrotonda(Math.min(FATTORE_MAX, Math.max(FATTORE_MIN, mediana(conPrevista.map(t => t.sostaMisurata / t.sostaPrevista)))), 0.05) * 100) / 100
        : null;
    const conKm = giri.filter(g => Number.isFinite(g.km));
    const kmMedi = conKm.length >= RITMO_MIN_GIRI ? r1(media(conKm.map(g => g.km))) : null;
    const tappeMedie = giri.length >= RITMO_MIN_GIRI ? r1(media(giri.map(g => g.tappe.length))) : null;

    // le soste per tipo di posto e per categoria (per il riquadro: «la sosta media nei musei»)
    const gruppo = (chiave) => {
        const out = {};
        for (const t of misurate) {
            const k = t[chiave];
            if (!k) continue;
            const g = out[k] || (out[k] = { minuti: [], giri: new Set() });
            g.minuti.push(t.sostaMisurata);
            g.giri.add(t.gi);
        }
        return Object.fromEntries(Object.entries(out).map(([k, g]) => [k, { media: Math.round(media(g.minuti)), n: g.minuti.length, giri: g.giri.size }]));
    };

    // tre segnali, ognuno solo se noto: soste (fattore), km per giro, tappe per giro
    const segnali = {
        soste: fattoreSosta === null ? null : fattoreSosta >= 1.15 ? 'lento' : fattoreSosta <= 0.85 ? 'veloce' : 'medio',
        km: kmMedi === null ? null : kmMedi <= 1.5 ? 'lento' : kmMedi >= 3 ? 'veloce' : 'medio',
        tappe: tappeMedie === null ? null : tappeMedie <= 3 ? 'lento' : tappeMedie >= 5 ? 'veloce' : 'medio',
    };
    // il ritmo e' quello della maggioranza dei segnali noti; a parita' (o senza maggioranza) e' medio
    const noti = Object.values(segnali).filter(Boolean);
    const conta = (v) => noti.filter(s => s === v).length;
    const ritmo = giri.length < RITMO_MIN_GIRI || noti.length === 0 ? null
        : conta('lento') > conta('medio') && conta('lento') > conta('veloce') ? 'lento'
            : conta('veloce') > conta('medio') && conta('veloce') > conta('lento') ? 'veloce'
                : 'medio';

    return {
        giri: giri.length,
        soste: misurate.length,
        fattoreSosta,
        sostaMedia: misurate.length ? Math.round(media(misurate.map(t => t.sostaMisurata))) : null,
        kmMedi,
        giriConKm: conKm.length,
        tappeMedie,
        ritmo,
        perTipo: gruppo('tipo'),
        perCategoria: gruppo('categoria'),
        segnali,
    };
}

/**
 * Il ritmo che guida QUESTO giro, con la sua fonte. null = nessuna fonte: il giro e' quello di sempre.
 * @param {object} p
 * @param {string|null} [p.scelto]   il ritmo scelto nella richiesta (Crea: 'Rilassato' | 'Attivo' | 'Intenso')
 * @param {string|null} [p.profilo]  il ritmo impostato nel Profilo ('lento' | 'medio' | 'veloce')
 * @param {object|null} [p.appreso]  l'uscita di ritmoAppreso
 * @param {string|object|null} [p.scelte]   il ritmo delle scelte passate (pesiDaEventi().ritmo, o il solo `suggerito`)
 * @returns {{ valore: string, fonte: 'richiesta'|'profilo'|'giri'|'scelte', fattoreSosta: number, passo: string|null, tappePerTe: number|null, dati?: object }|null}
 */
export function ritmoDelGiro({ scelto = null, profilo = null, appreso = null, scelte = null, iniziale = null } = {}) {
    const chiesto = ritmoDa(scelto);
    // la richiesta vince: il DNA non cambia ne' tappe ne' soste (il passo della richiesta resta quello di sempre)
    if (chiesto) return { valore: chiesto, fonte: 'richiesta', fattoreSosta: 1, passo: null, tappePerTe: null };
    const daProfilo = ritmoDa(profilo);
    if (daProfilo) return { valore: daProfilo, fonte: 'profilo', fattoreSosta: FATTORE_RITMO[daProfilo], passo: PASSO_SCHELETRO[daProfilo], tappePerTe: TAPPE_PER_TE[daProfilo] };
    if (appreso?.ritmo) {
        const v = appreso.ritmo;
        return { valore: v, fonte: 'giri', fattoreSosta: appreso.fattoreSosta ?? FATTORE_RITMO[v], passo: PASSO_SCHELETRO[v], tappePerTe: TAPPE_PER_TE[v], dati: appreso };
    }
    // le scelte passate: il valore suggerito (stringa) o l'oggetto di pesiDaEventi ({ suggerito, conteggi, totale })
    const daScelte = ritmoDa(typeof scelte === 'string' ? scelte : scelte?.suggerito);
    if (daScelte) {
        const quante = scelte && typeof scelte === 'object' && scelte.totale ? { k: Number(scelte.conteggi?.[daScelte]) || 0, tot: scelte.totale } : null;
        return { valore: daScelte, fonte: 'scelte', fattoreSosta: FATTORE_RITMO[daScelte], passo: PASSO_SCHELETRO[daScelte], tappePerTe: TAPPE_PER_TE[daScelte], ...(quante ? { quante } : {}) };
    }
    // ONBOARDING-ACCESSO — il passo detto al primo ingresso: ultimo, vale finché giri e scelte non dicono altro.
    const daInizio = ritmoDa(iniziale);
    if (daInizio) return { valore: daInizio, fonte: 'primo ingresso', fattoreSosta: FATTORE_RITMO[daInizio], passo: PASSO_SCHELETRO[daInizio], tappePerTe: TAPPE_PER_TE[daInizio] };
    return null;
}

/** Il ritmo nel riepilogo per la chiave di cache e di Per Te (vuoto = nessun ritmo del DNA). */
export const impronteRitmo = (r) => (r && r.fonte !== 'richiesta' ? `r:${r.valore}:${r.fattoreSosta}` : '');
