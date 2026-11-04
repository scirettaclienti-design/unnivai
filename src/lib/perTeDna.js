/**
 * DNA-5 — PER TE ORDINATO SECONDO IL DNA. Prima l'ordine passava da `tourAffinityScore` sui tag della scheda («Consigliato
 * dall'AI»): nessun tag e' una categoria, il punteggio era 0 per tutti e l'ordine restava quello del modello. Ora il punteggio
 * guarda le TAPPE vere del tour:
 *   · DNA (solo con fiducia > 0): la media dei pesi del DNA delle categorie delle tappe (stopCoreCategory);
 *   · compagnia: la media delle spinte della compagnia sulle tappe (compagniaDna.bonusCompagnia) + 0,1 al tema che le somiglia
 *     (coppia → romance, famiglia → nature, amici → food, solo → cultura).
 * L'insider resta in testa (regola della home); le proposte «per dopo» restano in coda (le mette DashboardUser). A parita' di
 * punteggio resta l'ordine di partenza. Funzione pura.
 */

import { stopCoreCategory } from '../services/preferenceEngine.js';
import { bonusCompagnia } from './compagniaDna.js';

export const TEMA_DELLA_COMPAGNIA = { coppia: 'romance', famiglia: 'nature', amici: 'food', solo: 'cultura' };
const SPINTA_TEMA = 0.1;

const tappeDi = (t) => (Array.isArray(t?.stops) ? t.stops : Array.isArray(t?.steps) ? t.steps : []).filter(s => s && !s.tempoLibero);
const temaDi = (t) => t?.themeType || (typeof t?.id === 'string' ? (/^home-([a-z]+)-/.exec(t.id)?.[1] ?? null) : null);

/** Il punteggio di un tour di Per Te (0 senza DNA e senza compagnia). */
export function punteggioPerTe(tour, { pesi = {}, fiducia = 0, compagnia = null } = {}) {
    const tappe = tappeDi(tour);
    if (tappe.length === 0) return 0;
    let p = 0;
    if (Number(fiducia) > 0) p += tappe.reduce((a, s) => a + (Number(pesi?.[stopCoreCategory(s)]) || 0), 0) / tappe.length;
    if (compagnia) {
        p += tappe.reduce((a, s) => a + bonusCompagnia(s, compagnia), 0) / tappe.length;
        if (TEMA_DELLA_COMPAGNIA[compagnia] && temaDi(tour) === TEMA_DELLA_COMPAGNIA[compagnia]) p += SPINTA_TEMA;
    }
    return Math.round(p * 1000) / 1000;
}

/**
 * I tour di Per Te in ordine di DNA. L'insider (`themeType: 'insider'` o `isInsiderNarrative`) resta primo.
 * @returns {{ tours: Array, punteggi: { tema: string|null, punteggio: number }[] }}
 */
export function ordinaPerTe(tours = [], opts = {}) {
    const lista = Array.isArray(tours) ? tours : [];
    const insider = (t) => t?.themeType === 'insider' || !!t?.isInsiderNarrative;
    const conPunti = lista.map((t, i) => ({ t, i, p: punteggioPerTe(t, opts) }));
    const testa = conPunti.filter(x => insider(x.t));
    const resto = conPunti.filter(x => !insider(x.t)).sort((a, b) => (b.p - a.p) || (a.i - b.i));
    const ordine = [...testa, ...resto];
    return { tours: ordine.map(x => x.t), punteggi: ordine.map(x => ({ tema: temaDi(x.t), punteggio: x.p })) };
}
