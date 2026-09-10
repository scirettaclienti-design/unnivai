// Gate BARRA — la progress bar del Percorso Veloce ha 4 segmenti FISSI, non
// uno per ogni valore di `currentStep` del wizard.
//
// `currentStep` va da 1 a 5 (5 = generazione), ma la generazione non è una
// scelta dell'utente: è l'esito delle quattro scelte precedenti (ambiente,
// attività, durata, gruppo), non ha un segmento suo. Prima il rendering
// usava un array letterale `[1,2,3,4,5]` in QuickPath.jsx con `currentStep`
// confrontato diretto: un quinto segmento per uno step che non è una tappa
// da "riempire" — la barra affermava un passo in più di quelli che l'utente
// sceglie davvero.
//
// Modulo separato di proposito, non dentro QuickPath.jsx: un file che
// esporta sia un componente React sia costanti/funzioni rompe il Fast
// Refresh di Vite (regola `react-refresh/only-export-components`) — ogni
// export non-componente in un file di pagina è un warning in più. Qui
// dentro non c'è nessun componente, quindi la regola non si applica.

export const PROGRESS_STEPS = [1, 2, 3, 4];

/**
 * Segmento "corrente" della progress bar per un dato `currentStep` del
 * wizard. Durante la generazione (currentStep 5) resta sul quarto segmento,
 * evidenziato come raggiunto — non un quinto che non esiste.
 * @param {number} currentStep
 * @returns {number} uno dei valori di PROGRESS_STEPS
 */
export function effectiveProgressStep(currentStep) {
    return Math.min(currentStep, PROGRESS_STEPS.length);
}
