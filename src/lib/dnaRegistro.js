/**
 * DNA-1 — il registro degli eventi del DNA (public.dna_events).
 *
 * Ogni gesto dell'utente diventa una riga: giro completato, tappa saltata, giro
 * salvato, scelta del Quiz, ritmo e compagnia scelti, tappa raggiunta. I pesi del
 * DNA NON leggono questa tabella (sara' DNA-2): qui si registra soltanto.
 *
 * Come navTelemetry: fire-and-forget. Nessun await nel percorso dell'interfaccia,
 * nessun errore che esce, nessuna ripetizione. Senza sessione (ospite) non si
 * registra niente: la tabella non ha accesso anonimo. Il segno 'test' lo mette il
 * server (trigger su ai_quota_test_account): il client non sa chi e' l'account di prova.
 *
 * Nessun dato personale oltre alle colonne: mai posizione, testo libero, nome, email.
 */

import { supabase } from './supabase.js';
import { normalizeCategory } from '../services/preferenceEngine.js';

/** I gesti ammessi: gli stessi del CHECK della tabella. */
export const DNA_REGISTRO_KINDS = [
    'tour_completed', 'stop_skipped', 'tour_saved', 'quiz_choice',
    'pace_chosen', 'company_chosen', 'stop_reached',
    'dna_correction', // DNA-6: «piu' di questo», «meno di questo», «azzera» dal Profilo
];

/** DNA-6 — le tre correzioni ammesse (value di 'dna_correction'). */
export const CORREZIONI = ['piu', 'meno', 'azzera'];

// Lunghezze massime = CHECK dna_events_lunghezze.
const MAX = { category: 40, city: 80, value: 80, moment: 40, tour_id: 120 };

function pulisci(v, max) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s ? s.slice(0, max) : null;
}

/**
 * Le righe di un gesto (pura, senza rete). Un gesto con piu' categorie
 * (giro completato, giro salvato) fa una riga per categoria; senza categorie, una riga sola.
 * @param {string} kind
 * @param {{ categories?: string[], category?: string, city?: string, value?: string, moment?: string, tourId?: string|number }} [campi]
 * @returns {object[]} righe senza user_id; [] se il gesto non e' ammesso
 */
export function righeDelGesto(kind, campi = {}) {
    if (!DNA_REGISTRO_KINDS.includes(kind)) return [];
    const elenco = Array.isArray(campi.categories) && campi.categories.length
        ? campi.categories
        : [campi.category ?? null];
    const categorie = [...new Set(elenco.map(c => pulisci(c, MAX.category)))];
    return categorie.map(category => ({
        kind,
        category,
        city: pulisci(campi.city, MAX.city),
        value: pulisci(campi.value, MAX.value),
        moment: pulisci(campi.moment, MAX.moment),
        tour_id: pulisci(campi.tourId, MAX.tour_id),
    }));
}

/**
 * Registra un gesto. Risolve sempre, non rigetta mai, non blocca la UI.
 * @returns {Promise<void>}
 */
export async function logDnaEvent(kind, campi = {}) {
    try {
        const righe = righeDelGesto(kind, campi);
        if (righe.length === 0) return;

        let userId = null;
        try {
            const { data } = await supabase.auth.getSession();
            userId = data?.session?.user?.id ?? null;
        } catch { /* getSession puo' fallire: non si registra */ }
        if (!userId) return; // ospite: nessun accesso anonimo alla tabella

        const insert = supabase.from('dna_events').insert(righe.map(r => ({ ...r, user_id: userId })));
        Promise.resolve(insert).then((res) => {
            if (res?.error) console.warn('[dnaRegistro] insert fallita:', res.error.message);
        }).catch((e) => console.warn('[dnaRegistro] insert fallita:', String(e)));
    } catch (e) {
        console.warn('[dnaRegistro] eccezione:', String(e));
    }
}

/**
 * I gesti di una scelta finale del Quiz (pura): la scelta principale con la sua categoria
 * (se e' una categoria di gusto: natura, storia, cibo…; «città», «mare» restano senza) e
 * la compagnia. Il ritmo del Quiz non e' una scelta (lo ricava l'umore): non si registra.
 * @param {{ main?: string, sub?: string, group?: string, city?: string }} scelta
 * @returns {{ kind: string, campi: object }[]}
 */
export function gestiDelQuiz({ main, sub, group, city } = {}) {
    const gesti = [];
    if (main) {
        gesti.push({
            kind: 'quiz_choice',
            campi: { category: normalizeCategory(main) || null, value: sub ? `${main}:${sub}` : main, city },
        });
    }
    if (group) gesti.push({ kind: 'company_chosen', campi: { value: group, city } });
    return gesti;
}

/**
 * I gesti di una richiesta di «Crea il tuo Percorso» (pura): ritmo e compagnia scelti.
 * @param {{ pace?: string, group?: string, city?: string }} scelta
 * @returns {{ kind: string, campi: object }[]}
 */
export function gestiDiCrea({ pace, group, city } = {}) {
    const gesti = [];
    if (pace) gesti.push({ kind: 'pace_chosen', campi: { value: pace, city } });
    if (group) gesti.push({ kind: 'company_chosen', campi: { value: group, city } });
    return gesti;
}

/** Registra una lista di gesti (fire-and-forget, come logDnaEvent). */
export function logDnaGesti(gesti = []) {
    for (const g of gesti) logDnaEvent(g.kind, g.campi);
}

// ─── DNA-2 — lettura del registro e cache sul telefono ───────────────────────

/** Quante righe si leggono al massimo (le piu' recenti): con il decadimento le vecchie pesano quasi zero. */
export const REGISTRO_LETTURA_MAX = 1000;
const CACHE_PREFISSO = 'unnivai_dna_registro_v1';
const COLONNE = 'id,kind,category,city,value,tour_id,created_at';

/**
 * Legge i PROPRI eventi (la RLS lascia passare solo quelli). Non rigetta mai.
 * @returns {Promise<{ ok: boolean, rows: object[] }>}
 */
export async function leggiRegistro() {
    try {
        const res = await supabase.from('dna_events')
            .select(COLONNE)
            .order('created_at', { ascending: false })
            .limit(REGISTRO_LETTURA_MAX);
        if (!res || res.error || !Array.isArray(res.data)) return { ok: false, rows: [] };
        return { ok: true, rows: res.data };
    } catch {
        return { ok: false, rows: [] };
    }
}

/** L'ultima lettura riuscita di QUESTO utente (null se manca o e' di un altro utente). */
export function leggiCacheRegistro(userId) {
    if (!userId) return null;
    try {
        const c = JSON.parse(localStorage.getItem(CACHE_PREFISSO));
        return c && c.userId === userId && Array.isArray(c.rows) ? c.rows : null;
    } catch { return null; }
}

/** Salva la lettura sul telefono (best-effort: se manca spazio, resta l'ultima). */
export function salvaCacheRegistro(userId, rows) {
    if (!userId || !Array.isArray(rows)) return;
    try {
        localStorage.setItem(CACHE_PREFISSO, JSON.stringify({ userId, salvataIl: new Date().toISOString(), rows }));
    } catch { /* quota o modalita' privata: il server resta la fonte */ }
}

// ─── DNA-6 — la correzione del DNA dal Profilo ───────────────────────────────

/**
 * Scrive una correzione e ASPETTA l'esito (l'interfaccia mostra «salvato» solo se e' vero).
 * Non rigetta mai. Restituisce la riga scritta, cosi' i pesi si ricalcolano subito.
 * @param {string} userId
 * @param {string} category - categoria di base (food, cultura…)
 * @param {'piu'|'meno'|'azzera'} correzione
 * @returns {Promise<{ ok: boolean, row?: object, errore?: string }>}
 */
export async function scriviCorrezione(userId, category, correzione) {
    const cat = pulisci(category, MAX.category);
    if (!userId) return { ok: false, errore: 'accesso' };
    if (!cat || !CORREZIONI.includes(correzione)) return { ok: false, errore: 'dati' };
    try {
        const res = await supabase.from('dna_events')
            .insert({ user_id: userId, kind: 'dna_correction', category: cat, value: correzione })
            .select(COLONNE)
            .single();
        if (!res || res.error || !res.data) return { ok: false, errore: res?.error?.message || 'rete' };
        return { ok: true, row: res.data };
    } catch (e) {
        return { ok: false, errore: String(e) };
    }
}
