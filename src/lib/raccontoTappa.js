/**
 * RACCONTO DI TAPPA — quando si prepara, puro. Il racconto (testo) e il suo audio della PROSSIMA tappa si preparano mentre si cammina:
 * appena la tappa diventa la prossima (avvio del tratto) e, se per qualche motivo non fossero pronti, di nuovo a ~300 m.
 * Se la tappa non ha racconto resta la frase breve di sempre.
 */
import { DISTANZA_RICHIAMO_M } from '../services/raccontoService';

/**
 * Cosa fare adesso per la prossima tappa.
 * @param {{ distanzaM?: number|null, testoPronto?: boolean, audioPronto?: boolean, richiestaFatta?: boolean }} stato
 * @returns {'richiedi'|'audio'|'niente'} richiedi = chiedi il racconto (e poi l'audio); audio = il testo c'è, prepara l'audio; niente = tutto a posto o niente da fare
 */
export function cosaPreparare({ distanzaM = null, testoPronto = false, audioPronto = false, richiestaFatta = false } = {}) {
    if (!testoPronto) return richiestaFatta && !(Number.isFinite(distanzaM) && distanzaM <= DISTANZA_RICHIAMO_M) ? 'niente' : 'richiedi';
    return audioPronto ? 'niente' : 'audio';
}

/** Il racconto da mostrare per una tappa: quello nuovo se c'è, altrimenti la frase breve di oggi. */
export const raccontoOFrase = (racconti, stop, frase) => (stop?.id != null && racconti?.[stop.id]) || frase || null;
