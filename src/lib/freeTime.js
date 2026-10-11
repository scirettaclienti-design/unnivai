/**
 * C5e — decisione O: il "tempo libero".
 *
 * Quando, in un momento che non e' un pasto, il posto valido piu' vicino sta
 * oltre FREE_TIME_MAX_MINUTES a piedi dalla tappa prima — dopo le ricerche
 * mirate —, al suo posto il giro dichiara "tempo libero": nessuna tappa da
 * raggiungere, il tempo e' dell'utente. Non e' un buco: e' una voce del giro,
 * con il testo composto dal codice (stopPhrases.composeFreeTime). Un pasto non
 * si sostituisce mai: resta il piu' vicino valido.
 *
 * Funzione pura e riusabile: oggi la usa la scelta per momenti
 * (momentSelection); in C2 servira' al tetto di cammino di "Per Te".
 */

import { travelMinutes } from './tourTiming';

/** La soglia della decisione O, in minuti a piedi dalla tappa prima. */
export const FREE_TIME_MAX_MINUTES = 40;

/**
 * Serve il tempo libero al posto di una tappa?
 * @param {object} p
 * @param {object|null} p.prev   la tappa vera prima (senza: mai tempo libero)
 * @param {Array} p.candidates   i candidati validi per quel posto
 * @param {boolean} p.pasto      il momento e' un pasto (mai tempo libero)
 * @param {number} [p.maxMinutes]
 * @returns {{ libero: boolean, piuVicino: { nome: string|null, place_id: string|null, minuti: number }|null }}
 */
export function freeTimeDecision({ prev, candidates, pasto, maxMinutes = FREE_TIME_MAX_MINUTES }) {
    const minuti = (c) => {
        const t = prev ? travelMinutes(prev, c) : null;
        return Number.isFinite(t) ? t : Infinity;
    };
    const lista = (Array.isArray(candidates) ? candidates : []).map(c => ({ c, t: minuti(c) })).sort((a, b) => a.t - b.t);
    const best = lista[0] || null;
    const piuVicino = best && Number.isFinite(best.t)
        ? { nome: best.c.name || best.c.title || null, place_id: best.c.place_id || best.c.googlePlaceId || null, minuti: best.t }
        : null;
    if (pasto || !prev || !best) return { libero: false, piuVicino };
    return { libero: best.t > maxMinutes, piuVicino };
}

/**
 * La voce "tempo libero" del giro: niente coordinate (niente pin, la
 * navigazione la salta, il percorso si misura senza di lei), sosta e cammino
 * 0 (l'orario e' la fine della tappa prima; la tappa dopo tiene il suo
 * cammino dalla tappa vera prima).
 */
export function freeTimeStop({ moment, momentLabel = null, description, tracciato = null }) {
    return {
        tempoLibero: true,
        place_id: null,
        title: 'Tempo libero',
        moment,
        momentLabel,
        description,
        types: [],
        latitude: null, longitude: null, lat: null, lng: null,
        stayMinutes: 0,
        travelMinutesFromPrev: 0,
        waitMinutesBefore: 0,
        ...(tracciato ? { _tracciato: tracciato } : {}),
    };
}

/** Le tappe vere di una lista (senza le voci di tempo libero). */
export const realStops = (stops) => (Array.isArray(stops) ? stops.filter(s => !s?.tempoLibero) : []);
