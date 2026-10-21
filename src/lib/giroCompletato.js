/**
 * DNA-2 — quando un giro conta come «completato» (decisione di Ivano):
 * l'ultima tappa e' raggiunta OPPURE almeno il 60% delle tappe e' raggiunto.
 * «Raggiunta» = fatta (non saltata). Funzione pura.
 */
export const SOGLIA_GIRO_COMPLETATO = 0.6;

/**
 * @param {{ id: string|number }[]} tappe - le tappe del giro, in ordine
 * @param {(string|number)[]} fatteIds - gli id delle tappe raggiunte
 * @returns {boolean}
 */
export function giroCompletato(tappe, fatteIds) {
    const elenco = Array.isArray(tappe) ? tappe : [];
    if (elenco.length === 0) return false;
    const fatte = new Set(Array.isArray(fatteIds) ? fatteIds : []);
    const ultima = elenco[elenco.length - 1];
    if (ultima && fatte.has(ultima.id)) return true;
    const raggiunte = elenco.filter(t => fatte.has(t.id)).length;
    return raggiunte / elenco.length >= SOGLIA_GIRO_COMPLETATO;
}
