/**
 * T1 — la citta' scritta nel testo vince sulla posizione.
 *
 * Caso reale (telefono di Ivano): posizione Troina, testo "Domani Roma in una
 * giornata da Romano" → il tour usciva a Troina. La citta' stava nella frase e
 * nessuno la leggeva: il motore partiva dalla posizione GPS.
 *
 * Qui solo regole pure, niente rete. Il traduttore della richiesta propone
 * una citta' (`citta`), questo modulo dice se va presa sul serio; la conferma
 * vera e' una ricerca sul proxy dei luoghi (cityCenterService.confirmCityFromText).
 */

export const DESTINATION_UNSURE_NOTE = 'Non ho riconosciuto la città: uso la tua posizione';
export const destinationNote = (city) => `Tour a ${city} (dal tuo testo)`;

export const normalizeCityName = (s) => String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Stessa citta', a meno di maiuscole, accenti e spazi. */
export const sameCity = (a, b) => {
    const na = normalizeCityName(a);
    return !!na && na === normalizeCityName(b);
};

// Parole che fanno di un nome di citta' il nome di una strada: "via Roma",
// "piazza Roma", "corso Catania" dentro Troina sono Troina.
const STREET_WORDS = [
    'via', 'viale', 'piazza', 'piazzale', 'piazzetta', 'corso', 'largo', 'vicolo',
    'vico', 'lungomare', 'contrada', 'salita', 'strada', 'traversa',
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * true se il testo nomina `city` SOLO come nome di strada ("un giro in via
 * Roma"). false se la nomina anche da sola, o se non la nomina affatto (il
 * traduttore puo' averla dedotta da un luogo: "il Colosseo" → Roma).
 */
export function isStreetMention(text, city) {
    const t = normalizeCityName(text);
    const c = normalizeCityName(city);
    if (!t || !c) return false;
    const re = new RegExp(`(?:^|[^a-z0-9'])(?:(${STREET_WORDS.join('|')})\\s+(?:di\\s+|del\\s+|della\\s+)?)?${escapeRe(c)}(?![a-z0-9])`, 'g');
    let found = false;
    for (const m of t.matchAll(re)) {
        if (!m[1]) return false; // la citta' compare da sola: e' una destinazione
        found = true;
    }
    return found;
}
