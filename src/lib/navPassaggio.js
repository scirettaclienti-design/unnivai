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
 *
 * NAV-1-FIX (D1, NAV-SIM): «più vicino alla tappa dopo» da solo non basta. A Troina il giro sale a Monte Muganà e torna in
 * paese: a metà salita sei più vicino allo Snack Bar (569 m) di quanto lo sia il monte (919 m), ma il monte è ancora a
 * 455 m davanti a te. Dopo una pausa si chiede solo se la nuova posizione NON sta sulla strada fra dov'eri prima della
 * pausa e la tappa: se d(prima, ora) + d(ora, tappa) ≤ IN_ARRIVO_FATTORE × d(prima, tappa) + OLTRE_MARGINE_M ci stai
 * ancora arrivando (sei dentro l'ellisse che ha per fuochi la posizione di prima e la tappa), e non si chiede niente.
 * Il margine copre il rumore del GPS; il fattore 1,3 la strada che non è una linea dritta.
 */
import { haversineM } from './navGeo';

export const NAV_PASSAGGIO = Object.freeze({ VICINO_M: 80, RISALITA_M: 40, PAUSA_MS: 60000, OLTRE_MARGINE_M: 30, IN_ARRIVO_FATTORE: 1.3 });

/** Lo stato del controllo per una tappa: si azzera quando cambia la tappa da raggiungere. */
export const nuovoPassaggio = (stepId) => ({ stepId, minDist: Infinity, ultimoA: null, chiesta: false, ultimaDist: null, ultimaPos: null });

/**
 * D1: la nuova posizione sta ancora sulla strada fra la posizione di prima della pausa e la tappa?
 * Senza la posizione di prima (o la sua distanza dalla tappa) non lo si sa: false, vale la regola di NAV-1.
 */
function ancoraInArrivo(s, pos, dist) {
    const p = s.ultimaPos;
    if (!p || !pos || !Number.isFinite(s.ultimaDist)) return false;
    const dPrimaOra = haversineM(p.lat, p.lng, pos.lat, pos.lng);
    if (!Number.isFinite(dPrimaOra)) return false;
    return dPrimaOra + dist <= NAV_PASSAGGIO.IN_ARRIVO_FATTORE * s.ultimaDist + NAV_PASSAGGIO.OLTRE_MARGINE_M;
}

/**
 * @param {object} st lo stato (nuovoPassaggio) della tappa che si sta inseguendo
 * @param {{ stepId, dist: number, soglia: number, now: number, distDopoDaUtente?: number|null, distDopoDaTappa?: number|null, pos?: {lat:number,lng:number}|null }} p
 *   dist = distanza utente→tappa; distDopoDaUtente = utente→tappa seguente; distDopoDaTappa = tappa→tappa seguente;
 *   pos = la posizione dell'utente (D1: serve a sapere se dopo una pausa ci stai ancora arrivando)
 * @returns {{ st: object, superata: boolean }}
 */
export function valutaPassaggio(st, { stepId, dist, soglia, now, distDopoDaUtente = null, distDopoDaTappa = null, pos = null }) {
    let s = st && st.stepId === stepId ? { ...st } : nuovoPassaggio(stepId);
    if (!Number.isFinite(dist)) return { st: s, superata: false };
    const pausa = s.ultimoA != null && now - s.ultimoA >= NAV_PASSAGGIO.PAUSA_MS;
    s.ultimoA = now;
    let superata = false;
    if (!s.chiesta && dist > soglia) {
        const vicinoMa = s.minDist <= Math.max(NAV_PASSAGGIO.VICINO_M, soglia * 2) && dist >= s.minDist + NAV_PASSAGGIO.RISALITA_M;
        const oltre = pausa && Number.isFinite(distDopoDaUtente) && Number.isFinite(distDopoDaTappa)
            && distDopoDaUtente + NAV_PASSAGGIO.OLTRE_MARGINE_M < distDopoDaTappa
            && !ancoraInArrivo(s, pos, dist);
        superata = vicinoMa || oltre;
    }
    s.minDist = Math.min(s.minDist, dist);
    s.ultimaDist = dist;
    s.ultimaPos = pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lng) ? { lat: pos.lat, lng: pos.lng } : null;
    if (superata) s.chiesta = true;
    return { st: s, superata };
}
