/**
 * TESTI-SCHEDE — il titolo di un giro lo scrive il codice, dalle tappe vere: «Dal Gianicolo Belvedere alla Terrazza delle Quadrighe».
 * Il titolo del modello («Tour di Roma», «Tesori di Catania», «Roma vista dal colle del Gianicolo» con Piazza del Campidoglio dentro,
 * «Gustoso pranzo a Troina») non si usa più: era generico, o diceva un luogo che nel giro non c'era, o un giudizio. Il titolo è il
 * dato nudo (voce Unnivai): dove si parte e dove si arriva, con la preposizione giusta (`preposizioni.js`).
 * Puro: niente rete, niente orologio.
 */
import { conPrep } from './preposizioni';

const TIPI_LOCALE = ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery', 'food', 'night_club', 'ice_cream_shop'];
const eLocale = (s) => (Array.isArray(s?.types) ? s.types : []).some(t => TIPI_LOCALE.includes(t));
const TITOLO_MAX = 90;
const NOME_MAX = 40;
const T = { toponimi: true };

/** Il nome senza le code commerciali: «Villa Bellini - Parco Maestranze» → «Villa Bellini», «Fontana (u Liotru)» → «Fontana». */
export function nomeBreve(titolo) {
    return String(titolo || '').replace(/\s+[-–—|]\s+.*$/, '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}
const eTempoLibero = (s) => !!s?.tempoLibero || /^tempo libero$/i.test(String(s?.title || '').trim());

/**
 * I nomi delle tappe che reggono il titolo: le visite (non i locali) con un nome leggibile; se il giro ha solo locali, i locali.
 * @param {Array} stops
 * @returns {string[]} nomi brevi, nell'ordine del giro, senza doppioni
 */
export function nomiPerTitolo(stops) {
    const vere = (stops || []).filter(s => s && !eTempoLibero(s) && nomeBreve(s.title));
    const scelte = vere.some(s => !eLocale(s)) ? vere.filter(s => !eLocale(s)) : vere;
    const tutti = [];
    for (const s of scelte) {
        const n = nomeBreve(s.title);
        if (!tutti.some(x => x.toLowerCase() === n.toLowerCase())) tutti.push(n);
    }
    // i nomi corti reggono meglio un titolo; se non ce n'è nessuno si tengono quelli che ci sono
    const corti = tutti.filter(n => n.length <= NOME_MAX);
    return corti.length > 0 ? corti : tutti;
}

/**
 * Il titolo del giro dalle sue tappe. `null` se non ce n'è nessuna (chi chiama tiene il suo ripiego).
 * 2+ tappe: «Da A a B» (prima e ultima visita); 1: «Intorno a A»; se non entra in 90 caratteri: «N tappe, da A»; poi «N tappe a Città».
 */
export function titoloDaTappe(stops, citta = '') {
    const nomi = nomiPerTitolo(stops);
    const n = (stops || []).filter(s => s && !eTempoLibero(s)).length;
    if (nomi.length === 0) return n > 0 && citta ? `${n} tappe a ${citta}` : null;
    const maiuscola = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    if (nomi.length >= 2) {
        const a = nomi[0];
        const b = nomi[nomi.length - 1];
        const pieno = maiuscola(`${conPrep('da', a, T)} ${conPrep('a', b, T)}`);
        if (pieno.length <= TITOLO_MAX) return pieno;
        const corto = `${n} tappe, ${conPrep('da', a, T)}`;
        return corto.length <= TITOLO_MAX ? maiuscola(corto) : (citta ? `${n} tappe a ${citta}` : `${n} tappe`);
    }
    const unico = maiuscola(conPrep('intorno a', nomi[0], T));
    return unico.length <= TITOLO_MAX ? unico : (citta ? `${n} tappe a ${citta}` : `${n} tappe`);
}

/** Un titolo che vale per qualunque giro della città: «Tour di Roma», «Tesori di Catania», «Da insider a Roma», «Un giro a X». */
export const TITOLO_GENERICO = /^(il tuo |un |il |la )?(tour|giro|percorso|itinerario|passeggiata|viaggio|tesori|sapori|gioielli|perle|segreti|meraviglie|storia|cultura|verde|panorami|vista|luce|a tavola|dove si mangia|da insider)\b.*\b(di|a|per|in|su|dei|delle)\b/i;
