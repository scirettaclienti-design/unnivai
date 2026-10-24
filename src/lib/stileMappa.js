/**
 * NAV-3 — LO STILE DELLA MAPPA CAMBIA CON L'ORA (schermate 1, 6, 7, 9). Puro: niente orologio (l'istante lo passa il chiamante).
 *
 *  · `mattina`  — chiara e calda: dall'alba vera a 2 ore dopo;
 *  · `giorno`   — lo stile scuro della schermata 1 (il resto della giornata);
 *  · `tramonto` — ambra: da 1 ora prima del tramonto vero a 30 minuti dopo;
 *  · `notte`    — blu profondo: dal buio (30 minuti dopo il tramonto) all'alba.
 * Alba e tramonto vengono da `sunTimes` (la stessa regola del buio: `eBuio`).
 */
export const STILI_MAPPA = ['mattina', 'giorno', 'tramonto', 'notte'];
const MIN = 60000;
export const MATTINA_DOPO_ALBA_MIN = 120;
export const TRAMONTO_PRIMA_MIN = 60;
export const TRAMONTO_DOPO_MIN = 30;

/** @param {Date|number} istante  @param {{ sunrise: Date|null, sunset: Date|null }} sole */
export function stileMappa(istante, sole) {
    const t = istante instanceof Date ? istante.getTime() : istante;
    const alba = sole?.sunrise instanceof Date ? sole.sunrise.getTime() : null;
    const tramonto = sole?.sunset instanceof Date ? sole.sunset.getTime() : null;
    if (!Number.isFinite(t) || alba === null || tramonto === null) return 'giorno';
    if (t >= tramonto - TRAMONTO_PRIMA_MIN * MIN && t < tramonto + TRAMONTO_DOPO_MIN * MIN) return 'tramonto';
    if (t >= tramonto + TRAMONTO_DOPO_MIN * MIN || t < alba) return 'notte';
    if (t >= alba && t < alba + MATTINA_DOPO_ALBA_MIN * MIN) return 'mattina';
    return 'giorno';
}
