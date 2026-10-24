/**
 * GIRO-EDIT — le due azioni di una tappa, uguali in tutte le schede (Crea, Quiz, Sorprendimi, Per Te).
 *
 * `togliDalGiorno` / `cambiaNelGiorno` prendono le tappe di UN giorno come la scheda le ha e restituiscono le tappe nuove
 * (`stops` vere + `liberi` righe di tempo libero + `unito` = le due insieme, per le schede che le tengono in una lista sola).
 *
 * DNA (registro `dna_events`, fire-and-forget, solo con la sessione):
 *  · «Togli»  → una riga `stop_skipped` con la categoria della tappa tolta (stesso gesto della navigazione);
 *  · «Cambia» → una riga `quiz_choice` con la SOLA categoria della tappa nuova (la scelta); il testo scritto dall'utente non si salva
 *    da nessuna parte (nemmeno nel valore della riga).
 */

import { togliTappa, sostituisciTappa, conLiberi, chiaveTappa } from '@/lib/giroEdit';
import { cambiaTappa } from '@/services/cambiaTappaService';
import { stopCoreCategory } from '@/services/preferenceEngine';
import { logDnaEvent } from '@/lib/dnaRegistro';
import { normalizeTour } from '@/services/tourShape';

export const risultatoDelGiorno = (r) => ({ ...r, unito: conLiberi(r) });

/** «Togli»: la tappa esce, gli orari dopo si ricalcolano, la tappa tolta entra nel DNA come saltata. */
export function togliDalGiorno({ stops, chiave, city = null, tourId = null }) {
    const r = togliTappa(stops, chiave);
    if (!r.ok) return r;
    logDnaEvent('stop_skipped', { category: stopCoreCategory(r.tolta), city: city || r.tolta?.city || null, moment: r.tolta?.moment || null, tourId });
    return risultatoDelGiorno(r);
}

/**
 * «Cambia»: una ricerca mirata, la tappa nuova al suo posto, gli orari dopo ricalcolati. Se non trova, la tappa resta.
 * @returns {Promise<{ ok: boolean, messaggio?: string, stops?: Array, liberi?: Array, unito?: Array, report: object }>}
 */
export async function cambiaNelGiorno({ stops, chiave, testo = '', city, dnaWeights = {}, tourId = null, cerca = null }) {
    const tappa = (stops || []).find(s => !s?.tempoLibero && chiaveTappa(s) === chiave);
    if (!tappa) return { ok: false, messaggio: 'Non trovo la tappa da cambiare.', report: {} };
    const esito = await cambiaTappa({ tappa, giorno: stops, testo, city, dnaWeights, cerca });
    if (!esito.ok) return esito;
    const r = sostituisciTappa(stops, chiave, esito.stop);
    if (!r.ok) return { ok: false, messaggio: 'Non sono riuscito a cambiare la tappa: resta com\'è.', report: { ...esito.report, motivo: r.motivo } };
    // la scelta: la categoria della tappa nuova, mai il testo
    logDnaEvent('quiz_choice', { category: esito.categoria || stopCoreCategory(esito.stop), city: city || null, moment: tappa.moment || null, tourId });
    return { ...risultatoDelGiorno(r), ok: true, report: esito.report };
}

/**
 * Il tour (un giorno) con le tappe nuove: `steps` (le vere), `freeTime` (le righe di tempo libero) e `stops` se il tour li aveva,
 * rinormalizzato come quando e' nato (durata, itinerary, cover). Per le schede che tengono un tour intero (Quiz, Sorprendimi, Per Te).
 */
export function tourConGiorno(tour, r) {
    const { itinerary: _it, freeTime: _ft, steps: _st, ...resto } = tour || {};
    return normalizeTour({ ...resto, steps: r.unito, ...(Array.isArray(tour?.stops) ? { stops: r.unito } : {}) }, { cityFallback: tour?.city });
}
