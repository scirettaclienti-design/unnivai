/**
 * NAV-1 — una tappa superata senza fermarsi. Il geofence sblocca una tappa solo con una posizione DENTRO la soglia;
 * chi ci passa accanto un po' più largo, o col telefono bloccato (iOS sospende il GPS), resta fermo su quella tappa.
 * Qui si capisce che è stata superata, e la navigazione chiede «Sei passato da [nome]?» (mai uno sblocco automatico).
 *
 * Due casi:
 *   - di passaggio: la distanza minima dalla tappa è scesa entro PASSATA_VICINO_M (ma non dentro la soglia), e ora ti
 *     stai allontanando di almeno PASSATA_RISALITA_M;
 *   - dopo una pausa (nessuna posizione per PAUSA_MS: schermo bloccato, app in background): sei più vicino alla tappa dopo
 *     di quanto lo sia la tappa stessa, cioè sei già oltre.
 */
export const NAV_PASSAGGIO = Object.freeze({ VICINO_M: 80, RISALITA_M: 40, PAUSA_MS: 60000, OLTRE_MARGINE_M: 30 });

/** Lo stato del controllo per una tappa: si azzera quando cambia la tappa da raggiungere. */
export const nuovoPassaggio = (stepId) => ({ stepId, minDist: Infinity, ultimoA: null, chiesta: false });

/**
 * @param {object} st lo stato (nuovoPassaggio) della tappa che si sta inseguendo
 * @param {{ stepId, dist: number, soglia: number, now: number, distDopoDaUtente?: number|null, distDopoDaTappa?: number|null }} p
 *   dist = distanza utente→tappa; distDopoDaUtente = utente→tappa seguente; distDopoDaTappa = tappa→tappa seguente
 * @returns {{ st: object, superata: boolean }}
 */
export function valutaPassaggio(st, { stepId, dist, soglia, now, distDopoDaUtente = null, distDopoDaTappa = null }) {
    let s = st && st.stepId === stepId ? { ...st } : nuovoPassaggio(stepId);
    if (!Number.isFinite(dist)) return { st: s, superata: false };
    const pausa = s.ultimoA != null && now - s.ultimoA >= NAV_PASSAGGIO.PAUSA_MS;
    s.ultimoA = now;
    let superata = false;
    if (!s.chiesta && dist > soglia) {
        const vicinoMa = s.minDist <= Math.max(NAV_PASSAGGIO.VICINO_M, soglia * 2) && dist >= s.minDist + NAV_PASSAGGIO.RISALITA_M;
        const oltre = pausa && Number.isFinite(distDopoDaUtente) && Number.isFinite(distDopoDaTappa)
            && distDopoDaUtente + NAV_PASSAGGIO.OLTRE_MARGINE_M < distDopoDaTappa;
        superata = vicinoMa || oltre;
    }
    s.minDist = Math.min(s.minDist, dist);
    if (superata) s.chiesta = true;
    return { st: s, superata };
}
