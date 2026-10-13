/**
 * C6a — Il nome mostrato e' il nome del posto, senza le code commerciali.
 *
 * Google restituisce nomi come "Deliziosa Café & Cocktail Bar | Apericena e
 * Colazione": dopo la barra c'e' un elenco di servizi, non il nome. Letto dal
 * narratore, "Colazione" faceva scartare la frase del posto (la regola della
 * luce/ora toglie le frasi che dicono "colazione" a un'ora non di mattina).
 *
 * ─── LA REGOLA, E PERCHE' E' COSI' STRETTA ───────────────────────────────────
 * Si taglia SOLO ciò che segue una barra " | " e SOLO se OGNI parola della coda
 * sta in un elenco chiuso di parole commerciali (LESSICO_CODA: tipi di locale,
 * pasti, aggettivi di cucina, congiunzioni) — oppure è il nome della città del
 * posto — e almeno una e' del lessico (una coda fatta solo di città non si
 * taglia: "Gallerie d'Italia | Napoli" resta com'e').
 *   · "Deliziosa Café & Cocktail Bar | Apericena e Colazione" → "Deliziosa Café & Cocktail Bar"
 *   · "Osteria Fiaschetto | Ristorante a Milano"              → "Osteria Fiaschetto"
 *   · "MUST | Museo Storico della Città di Lecce"             → intero ("museo" non e' commerciale)
 *   · "Museo X - Palazzo Y"                                   → intero (niente barra)
 * Una parola fuori elenco blocca il taglio: meglio un nome lungo che un nome
 * mutilato. Nessuna euristica sulla maiuscola, sulla lunghezza o sul trattino.
 *
 * Il nome originale non si perde: chi usa il nome pulito porta con se' anche
 * l'originale (`nameOriginal`, nel tracciato `nomeOriginale`).
 */

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'");

// Parole di una coda commerciale, normalizzate (senza accenti). Elenco chiuso:
// si allarga solo con un nome vero che lo giustifichi, e con un test.
export const LESSICO_CODA = new Set([
    // pasti e momenti
    'colazione', 'colazioni', 'brunch', 'pranzo', 'aperitivo', 'apericena', 'cena', 'dopocena', 'happy', 'hour', 'asporto',
    // tipi di locale
    'ristorante', 'ristoranti', 'ristorazione', 'restaurant', 'trattoria', 'osteria', 'pizzeria', 'pizzoleria', 'pizza', 'braceria', 'griglieria',
    'paninoteca', 'birreria', 'pub', 'bar', 'cafe', 'caffe', 'caffetteria', 'cocktail', 'cocktails', 'wine', 'vino', 'vini', 'enoteca',
    'bistrot', 'bistro', 'lounge', 'rooftop', 'pasticceria', 'gelateria', 'gastronomia', 'rosticceria', 'tavola', 'calda', 'fredda',
    'cucina', 'kitchen', 'food', 'drink', 'drinks', 'sapori', 'gusto', 'menu',
    // aggettivi di cucina
    'tipica', 'tipico', 'tipiche', 'tipici', 'tradizionale', 'tradizionali', 'casalinga', 'casereccia', 'locale', 'italiana', 'italiano',
    'romana', 'romano', 'napoletana', 'napoletano', 'siciliana', 'siciliano', 'catanese', 'toscana', 'toscano', 'fiorentina', 'fiorentino',
    'milanese', 'veneta', 'veneto', 'pugliese', 'sarda', 'sardo', 'ligure', 'bolognese', 'palermitana', 'palermitano', 'salentina', 'salentino',
    'vegetariana', 'vegetariano', 'vegana', 'vegano', 'gourmet', 'mediterranea', 'mediterraneo', 'pesce', 'carne',
    // congiunzioni e preposizioni
    'e', 'ed', 'and', 'di', 'a', 'con', 'per', 'in', 'il', 'la', 'le', 'i', 'da', 'del', 'della', 'dei', 'delle', 'al', 'alla', 'ai', 'the', 'of',
]);
const STOP = new Set(['e', 'ed', 'and', 'di', 'a', 'con', 'per', 'in', 'il', 'la', 'le', 'i', 'da', 'del', 'della', 'dei', 'delle', 'al', 'alla', 'ai', 'the', 'of']);

const words = (s) => norm(s).split(/[^a-z0-9']+/).filter(Boolean);

/** Una coda e' commerciale se ogni parola e' del lessico o della citta', e almeno una e' del lessico. */
function codaCommerciale(coda, cityWords) {
    const ws = words(coda);
    if (ws.length === 0) return false;
    let lessico = false;
    for (const w of ws) {
        if (LESSICO_CODA.has(w)) { if (!STOP.has(w)) lessico = true; continue; }
        if (cityWords.has(w)) continue;
        return false;
    }
    return lessico;
}

/**
 * @param {string} name il nome come lo da' Google
 * @param {{ city?: string }} [ctx] la citta' del posto (per riconoscere "… Catania" in coda)
 * @returns {{ name: string, original: string, tagliato: boolean }}
 */
export function cleanPlaceName(name, { city = '' } = {}) {
    const original = String(name ?? '');
    const trimmed = original.trim();
    if (!trimmed.includes('|')) return { name: trimmed, original, tagliato: false };
    const parts = trimmed.split('|').map(p => p.trim());
    const head = parts[0];
    const tails = parts.slice(1);
    if (head.length < 2 || tails.length === 0) return { name: trimmed, original, tagliato: false };
    const cityWords = new Set(words(city));
    if (!tails.every(t => codaCommerciale(t, cityWords))) return { name: trimmed, original, tagliato: false };
    return { name: head, original, tagliato: true };
}
