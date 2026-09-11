/**
 * Gate C2 — estrazione dei TAG dal prompt libero dell'utente.
 *
 * ORIGINE. AiItinerary.jsx:705 costruiva i `tags` del tour cosi':
 *     userPrompt.split(/\s+/).map(w => w.replace(/[^\w\s]/gi, ''))
 *
 * `\w` SENZA flag `u` e' ASCII-only: [A-Za-z0-9_]. Ogni lettera accentata
 * finiva dentro la classe negata e veniva CANCELLATA, in silenzio:
 *     "citta'"  (con accento) -> "citt"
 *     "perche'" (con accento) -> "perch"
 *     "pero'"   (con accento) -> "per"
 *     "e'" da solo            -> ""      (tag vuoto, che restava in lista)
 *
 * Su testo italiano libero e' una perdita di dato sistematica, e non e'
 * cosmetica: questi tag vanno al matching dei business
 * (dataService.getBusinessesByCityAndTags) e dentro normalizeTour. Un tag
 * mutilato non matcha niente, un tag vuoto e' rumore che viaggia a valle.
 * (Il `\s` dentro la classe era anche inutile: si era gia' splittato sugli
 * spazi, nessun token poteva contenerne.)
 *
 * ORA. Classe Unicode `[^\p{L}\p{N}]` con flag `u`: tiene lettere — accentate
 * incluse — e cifre, toglie tutto il resto (virgole, punti, interrogativi,
 * parentesi, trattini). Il comportamento su punteggiatura e' quello di prima;
 * cambia solo che le lettere italiane sopravvivono.
 *
 * APOSTROFO: trattato da SEPARATORE, non da carattere da cancellare.
 * In italiano e' quasi sempre un'elisione ("un'esperienza", "l'arte",
 * "dell'olio", "c'e'") e la parte che vale come tag e' quella DOPO.
 * Cancellandolo si otteneva "unesperienza", che non matcha nulla; separando si
 * ottiene "esperienza", che e' esattamente il tag utile. La scelta e' coerente
 * con l'intento della riga: qui si producono TAG per il matching, non si
 * conserva la frase originale. Coperte entrambe le forme, ASCII (') e
 * tipografica (’), perche' le tastiere mobili inseriscono la seconda.
 *
 * I token vuoti si scartano: un tag '' non e' un tag.
 *
 * Funzione pura in file separato con test propri: stesso pattern di
 * mapCenter.js, poiPhoto.js, narratorGuards.js, quickPathProgress.js.
 *
 * @param {string} userPrompt testo libero scritto dall'utente
 * @returns {string[]} tag puliti, accenti intatti, mai stringhe vuote
 */
export function extractPromptTags(userPrompt) {
    if (!userPrompt || typeof userPrompt !== 'string') return [];
    return userPrompt
        .split(/[\s'’]+/)
        .map(w => w.replace(/[^\p{L}\p{N}]/gu, ''))
        .filter(Boolean);
}
