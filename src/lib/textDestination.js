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

// ─── T1b — la citta' letta dal testo con regole fisse ────────────────────────
//
// Caso del banco (BANCO-NAZ, caso d): posizione Troina, testo "una giornata a
// Roma" → il traduttore restituisce zero query e nessuna citta', e il tour
// usciva vuoto a Troina. La citta' scritta non deve dipendere dal modello:
// qui la si legge dal testo, con tre regole, in quest'ordine:
//   1. dopo "a / ad / in / per / su":   "una giornata a Roma"
//   2. prima di "in una giornata":       "Domani Roma in una giornata"
//   3. un nome proprio da solo:          "domani Roma", "Roma"
//      (a inizio frase solo se e' tutto il testo: "Spiagge segrete" non e'
//      una citta', e "Roma domani" resta al traduttore)
// Un nome proprio e' una parola con l'iniziale maiuscola (piu' parole per
// "Polignano a Mare", "San Gimignano", "Reggio di Calabria"). Il testo tutto
// minuscolo resta al traduttore, che diventa il secondo segnale.
// Fuori: vie, piazze e corsi ("in via Roma", "Piazza Catania"), le parole che
// aprono una frase con la maiuscola ("Domani", "Una"), mesi, giorni e feste
// ("a Pasqua", "per Natale"), e il punto di partenza ("da Roma").
// Il candidato non e' ancora una citta': lo conferma UNA ricerca sul proxy dei
// luoghi (confirmCityFromText).

const CAP = "[A-ZÀ-Þ][a-zà-ÿ'’]*";
const NAME = `${CAP}(?:\\s+(?:(?:di|del|dello|della|dei|degli|delle|de|sul|sulla|a(?=\\s+Mare\\b))\\s+)?${CAP})*`;

const NOT_A_PLACE = new Set([
    // aperture di frase e parole comuni con la maiuscola
    'domani', 'oggi', 'stasera', 'stamattina', 'dopodomani', 'un', 'una', 'uno', 'il', 'lo', 'la', 'i', 'gli', 'le',
    'voglio', 'vorrei', 'cerco', 'fammi', 'portami', 'mostrami', 'organizza', 'organizzami', 'crea', 'dammi',
    'giro', 'tour', 'giornata', 'ciao', 'per', 'in', 'a', 'ad', 'su', 'da', 'con', 'che', 'dove', 'cosa', 'come',
    'mi', 'ci', 'io', 'noi', 'andiamo', 'facciamo', 'weekend', 'prima', 'dopo', 'sorprendimi', 'centro', 'italia',
    'mattina', 'pomeriggio', 'sera', 'notte', 'pranzo', 'cena', 'aperitivo', 'colazione',
    // giorni, mesi, feste
    'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica',
    'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre',
    'novembre', 'dicembre', 'natale', 'pasqua', 'pasquetta', 'capodanno', 'ferragosto', 'carnevale',
]);

const isStreetWord = (w) => STREET_WORDS.includes(normalizeCityName(w));
const CONNECTORS = new Set(['di', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'de', 'sul', 'sulla', 'a']);

// Il nome ripulito: via le parole comuni in testa ("Domani Roma" → "Roma") e
// in coda ("Roma Sabato" → "Roma"); null se resta una via o niente.
// `before` e' la parola che precede il nome nel testo.
const cleanName = (name, before) => {
    const w = name.split(/\s+/);
    let dropped = false;
    while (w.length && NOT_A_PLACE.has(normalizeCityName(w[0]))) { w.shift(); dropped = true; }
    while (w.length && (NOT_A_PLACE.has(normalizeCityName(w[w.length - 1])) || CONNECTORS.has(w[w.length - 1]))) w.pop();
    if (!w.length || isStreetWord(w[0]) || (!dropped && isStreetWord(before))) return null;
    if (!dropped && normalizeCityName(before) === 'da') return null;
    return w.join(' ');
};

// La parola prima della posizione `at` nel testo, o ''.
const wordBefore = (text, at) => (text.slice(0, at).match(/([A-Za-zÀ-ÿ'’]+)\s*$/) || [])[1] || '';

/**
 * Il candidato citta' scritto nel testo, o null. Solo regole, niente rete.
 * @param {string} text  la frase dell'utente
 * @returns {string|null}
 */
export function extractCityCandidate(text) {
    const t = String(text || '');
    if (!t.trim()) return null;
    // Gli spazi dei nomi propri nel testo: una preposizione DENTRO un nome
    // ("Polignano a Mare") non apre la regola 1.
    const nameRe = new RegExp(`(?:^|[^A-Za-zÀ-ÿ'’])(${NAME})`, 'g');
    const spans = [...t.matchAll(nameRe)].map(m => {
        const at = m.index + m[0].length - m[1].length;
        return [at, at + m[1].length];
    });
    const insideName = (i) => spans.some(([a, b]) => i > a && i < b);
    const pick = (m, standalone = false) => {
        const at = m.index + m[0].length - m[1].length;
        const name = cleanName(m[1], wordBefore(t, at));
        if (!name || isStreetMention(t, name)) return null;
        // a inizio frase (e senza parole comuni davanti, come "Domani") un nome
        // da solo vale solo se e' tutto il testo
        const lead = m[1].indexOf(name);
        const sentenceStart = lead === 0 && (/^[\s.!?,]*$/.test(t.slice(0, at)) || /[.!?]\s*$/.test(t.slice(0, at)));
        const rest = t.slice(at + m[1].length).trim().replace(/[.!?]+$/, '');
        if (standalone && sentenceStart && rest !== '') return null;
        return name;
    };
    const rules = [
        new RegExp(`(?:^|[^A-Za-zÀ-ÿ'’])(?:a|ad|in|per|su)\\s+(${NAME})`, 'g'),
        new RegExp(`(${NAME})\\s+in\\s+(?:una|un)\\s+(?:giornata|giorno|mattina|mattinata|pomeriggio|serata|sera)\\b`, 'g'),
        // 3. un nome proprio da solo (non il punto di partenza: "da Roma").
        nameRe,
    ];
    for (const [i, re] of rules.entries()) {
        for (const m of t.matchAll(re)) {
            if (i === 0 && insideName(m.index + 1)) continue;
            const name = pick(m, i === 2);
            if (name) return name;
        }
    }
    return null;
}
