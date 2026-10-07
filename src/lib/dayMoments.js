/**
 * Gate SCHELETRO (P2) — la tabella unica dei momenti della giornata.
 *
 * Unica fonte di verita' per le fasce orarie dell'app, approvata da Ivano.
 * `tourWindow.js` legge da qui le sue fasce e i bordi della giornata;
 * `daySkeleton.js` ci costruisce lo scheletro. Nessun altro file deve
 * scrivere un orario di fascia a mano.
 *
 * Modulo di soli dati, senza import: lo importano sia tourWindow.js sia
 * daySkeleton.js (che importa tourWindow.js), e un import qui creerebbe un
 * ciclo.
 *
 * Gli orari sono orari civili di Roma. `end` del dopocena e' {h:24, m:30}:
 * le 00:30 del giorno dopo, scritte sul giorno in cui il momento inizia.
 */

export const MOMENTS = [
    { key: 'mattina',    label: 'Mattina',    start: { h: 9,  m: 30 }, end: { h: 12, m: 30 },
        categories: ['cultura', 'monumenti', 'musei', 'passeggiata'] },
    { key: 'pranzo',     label: 'Pranzo',     start: { h: 12, m: 30 }, end: { h: 14, m: 30 },
        categories: ['cibo'] },
    { key: 'pomeriggio', label: 'Pomeriggio', start: { h: 14, m: 30 }, end: { h: 18, m: 0 },
        categories: ['cultura', 'natura', 'shopping', 'passeggiata'] },
    { key: 'aperitivo',  label: 'Aperitivo',  start: { h: 18, m: 0 },  end: { h: 20, m: 0 },
        categories: ['bar', 'punti panoramici'] },
    { key: 'cena',       label: 'Cena',       start: { h: 20, m: 0 },  end: { h: 22, m: 30 },
        categories: ['cibo'] },
    { key: 'dopocena',   label: 'Dopocena',   start: { h: 22, m: 30 }, end: { h: 24, m: 30 },
        categories: ['vita notturna'] },
];

export const MOMENT_BY_KEY = Object.fromEntries(MOMENTS.map(m => [m.key, m]));

/**
 * Gate NARRATORE-DOPO — il momento che contiene un orario civile di Roma.
 * Prima della mattina vale la mattina (la prossima giornata); 00:00–00:30 e'
 * ancora il dopocena del giorno prima. Serve al timeContext e al narratore:
 * la fascia si legge da questa tabella, non da soglie scritte altrove.
 * Funzione senza import, come il resto del modulo.
 */
export function momentAtClock(h, mi = 0) {
    const t = h * 60 + mi;
    const min = ({ h: hh, m }) => hh * 60 + m;
    const dopocena = MOMENT_BY_KEY.dopocena;
    if (t + 24 * 60 < min(dopocena.end)) return dopocena;
    return MOMENTS.find(m => t >= min(m.start) && t < min(m.end))
        ?? (t < min(MOMENTS[0].start) ? MOMENTS[0] : dopocena);
}
