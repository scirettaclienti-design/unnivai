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
];

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
