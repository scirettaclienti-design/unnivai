/**
 * BANCO-ESTESO — l'"ora simulata" delle prove.
 *
 * Il motore legge l'ora della richiesta da `new Date()` (generateItinerary e
 * generateHomeTours): un giro serale o "Per Te" dipendeva dall'ora in cui si
 * lanciava la prova. `opts.simulatedNow` (Date o ISO) la sostituisce, solo nelle
 * prove. In produzione (`import.meta.env.PROD`, valore fisso del build) il
 * parametro e' IGNORATO: l'ora e' sempre quella vera. Senza il parametro, o con
 * un valore non valido, la funzione restituisce esattamente `new Date()`.
 */
export function requestNow(opts) {
    const sim = opts?.simulatedNow;
    if (sim == null || import.meta.env.PROD) return new Date();
    const d = sim instanceof Date ? sim : new Date(sim);
    return Number.isNaN(d.getTime()) ? new Date() : d;
}
