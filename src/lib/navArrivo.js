/**
 * NAV-1-FIX (D2, NAV-SIM) — l'arrivo a una tappa si conferma con DUE posizioni consecutive dentro la soglia.
 *
 * Prima bastava una lettura sola: alla Fontana dell'Elefante (Catania) il rumore del GPS ha portato una posizione a 25 m,
 * proprio sulla soglia (max(25 m, accuratezza)), con il camminatore a 41 m veri, e la tappa è scattata in anticipo. In un
 * centro con tappe a 50–60 m l'una dall'altra un arrivo anticipato fa saltare la tappa giusta.
 * Regola: CONFERME = 2 letture di fila dentro la soglia (una lettura fuori azzera il conto). Perché 2 e non dei secondi:
 *   - due errori indipendenti che cadono entrambi dentro la soglia con la persona fuori sono molto più rari di uno;
 *   - camminando il GPS manda circa una posizione al secondo: la seconda lettura costa ~1 s e ~1,4 m, non si sente;
 *   - da fermi iOS manda posizioni più di rado: una regola a secondi aspetterebbe comunque la lettura dopo.
 * Il resto non cambia: la tappa deve essere «armata» (vista fuori soglia almeno una volta), salvo il primo sblocco della
 * sessione.
 */
export const NAV_ARRIVO = Object.freeze({ CONFERME: 2 });

/** Lo stato della conferma per una tappa: si azzera quando cambia la tappa da raggiungere. */
export const nuovoArrivo = (stepId) => ({ stepId, dentro: 0 });

/**
 * @param {object|null} st lo stato (nuovoArrivo) della tappa che si sta inseguendo
 * @param {{ stepId, dist: number, soglia: number, puoScattare: boolean }} p
 *   puoScattare = la tappa è armata, o è il primo sblocco della sessione
 * @returns {{ st: object, scattato: boolean, conferme: number }}
 */
export function valutaArrivo(st, { stepId, dist, soglia, puoScattare }) {
    const s = st && st.stepId === stepId ? { ...st } : nuovoArrivo(stepId);
    s.dentro = Number.isFinite(dist) && dist <= soglia ? s.dentro + 1 : 0;
    return { st: s, scattato: !!puoScattare && s.dentro >= NAV_ARRIVO.CONFERME, conferme: s.dentro };
}
