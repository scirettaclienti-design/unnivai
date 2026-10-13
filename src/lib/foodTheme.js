/**
 * C7 — IL TEMA CIBO VALE SOLO NEI PASTI.
 *
 * "Un giorno da catanese, nei ristoranti tipici" e' un TEMA, non una categoria per
 * tutti i momenti: i pasti (colazione, pranzo, aperitivo, cena) sono tipici;
 * mattina e pomeriggio sono ESPERIENZE nello spirito del tema (il mercato storico,
 * una via storica, il quartiere), mai ristoranti. Prima la parola "ristoranti" (o
 * la categoria `cibo` del traduttore) rendeva "cibo" ogni momento: 7 ristoranti su 7.
 *
 * Qui solo regole pure sul TESTO e sulla categoria del traduttore:
 *   · `tema`      — c'e' un tema cibo?
 *   · `tipico`    — chiede cucina locale ("tipici", "autentici", "da catanese")?
 *   · `momenti`   — i momenti per cui il testo chiede ESPLICITAMENTE un locale
 *                   ("la colazione", "il pomeriggio in pasticceria"): si rispettano
 *                   e si dichiarano.
 *   · cucina locale / estera di un posto (per "tipico": si preferiscono i locali, si
 *     escludono le cucine estere).
 *
 * Puro: niente rete.
 */

const norm = (v) => String(v ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Parole che nominano il cibo come TEMA della giornata.
const TEMA_CIBO = /\b(ristorant[ei]|trattori[ae]|osteri[ae]|pizzeri[ae]|street ?food|cibo|mangiar[ei]|mangiare|sapori|gastronom\w*|cucina|cenare|pranzare|piatti tipici|specialita)\b/;
// "tipico": cucina e locali del posto.
const TIPICO = /\b(tipic[oaie]|tipicit\w*|autentic\w*|tradizional\w*|genuin\w*|caratteristic\w*|local[ei]|nostrana|nostrano|casalingh\w*)\b/;
// "da catanese", "da romano", "da palermitano": vivere come uno del posto.
const DA_DEL_POSTO = /\bda\s+(?:vero\s+|un\s+|una\s+)?([a-z]{3,}(?:ese|ano|ana|ino|ina|ense|tano|ardo|igiano|ntino|ota|ita))\b/;
const NON_DEMONIMI = new Set(['italiano', 'italiana', 'americano', 'americana', 'giapponese', 'cinese', 'francese', 'inglese', 'spagnolo', 'turista', 'turistico', 'domani', 'mattina', 'sempre', 'vicino', 'lontano', 'piano', 'strano', 'certamente']);

// La richiesta di un locale in un MOMENTO preciso (le stesse parole del controllo c2 del banco).
const CIBO_NEL_MOMENTO = /\b(ristorant\w*|trattori\w*|osteri\w*|pizzeri\w*|mangiar\w*|cibo|pranz\w*|pasticcer\w*|gelater\w*|caffe\w*|caffett\w*|bar|aperitiv\w*|dolc\w*|brioche|cornett\w*|granita|colazione)\b/;
// C8c — la COLAZIONE chiesta per nome: la prima tappa e' un posto da colazione (non basta "la mattina in pasticceria")
const COLAZIONE_CHIESTA = /\b(colazione|brunch|cornett\w*|cappuccin\w*|brioche)\b/;
const RICHIESTA_MOMENTO = {
    mattina: (t) => COLAZIONE_CHIESTA.test(t)
        || (/\b(mattin\w*)\b/.test(t) && CIBO_NEL_MOMENTO.test(t)),
    pomeriggio: (t) => /\b(merenda)\b/.test(t)
        || (/\b(pomerigg\w*)\b/.test(t) && CIBO_NEL_MOMENTO.test(t)),
};

/** C8c — il testo chiede la colazione (colazione, brunch, cornetto, cappuccino, brioche)? */
export const asksBreakfast = (text) => COLAZIONE_CHIESTA.test(norm(text));

/** Il testo chiede un posto dove ci si SIEDE a mangiare (ristorante, trattoria, osteria, pizzeria, pranzo)? */
export const asksSitDownMeal = (text) => /\b(ristorant\w*|trattori\w*|osteri\w*|pizzeri\w*|pranz\w*|mangiar\w*|cenar\w*)\b/.test(norm(text));

/** I momenti (mattina, pomeriggio) per cui il testo chiede esplicitamente un locale. */
export function explicitFoodMoments(text) {
    const t = norm(text);
    const out = new Set();
    if (!t) return out;
    for (const [key, f] of Object.entries(RICHIESTA_MOMENTO)) if (f(t)) out.add(key);
    return out;
}

/**
 * @param {{ text?: string, categoria?: string|null, tipicoText?: string }} p
 *   `text`: la frase (solo se e' scritta dall'utente: nel Percorso Veloce la scrive il
 *   wizard e non si legge per il tema); `categoria`: quella del traduttore.
 * @returns {{ tema: boolean, tipico: boolean, streetFood: boolean, momenti: Set<string>, fonte: string|null }}
 */
export function detectFoodTheme({ text = '', categoria = null, tipicoText = null } = {}) {
    const t = norm(text);
    const cat = norm(categoria);
    const daCategoria = cat === 'cibo' || cat === 'food';
    const daTesto = !!t && TEMA_CIBO.test(t);
    const tipText = norm(tipicoText ?? text);
    const dem = DA_DEL_POSTO.exec(tipText);
    const daDelPosto = !!dem && !NON_DEMONIMI.has(dem[1]);
    const tipico = TIPICO.test(tipText) || daDelPosto;
    // "una giornata da romano" non nomina il cibo ma e' un tema di vita locale: i pasti tipici.
    const tema = daCategoria || daTesto || (daDelPosto && !!t);
    const fonte = daCategoria ? 'categoria del traduttore' : daTesto ? 'testo' : daDelPosto ? 'testo ("da …")' : null;
    const streetFood = /\bstreet ?food\b/.test(t) || /\bstreet ?food\b/.test(tipText);
    return { tema, tipico: tema && tipico, streetFood: tema && streetFood, momenti: explicitFoodMoments(text), fonte: tema ? fonte : null };
}

// ─── Cucina locale / estera di un posto ──────────────────────────────────────
const PRIMARY_ESTERA = new Set([
    'chinese_restaurant', 'japanese_restaurant', 'sushi_restaurant', 'ramen_restaurant', 'korean_restaurant', 'korean_barbecue_restaurant',
    'thai_restaurant', 'vietnamese_restaurant', 'indian_restaurant', 'pakistani_restaurant', 'afghani_restaurant', 'middle_eastern_restaurant',
    'lebanese_restaurant', 'turkish_restaurant', 'greek_restaurant', 'mexican_restaurant', 'tex_mex_restaurant', 'brazilian_restaurant',
    'peruvian_restaurant', 'american_restaurant', 'hamburger_restaurant', 'barbecue_restaurant', 'french_restaurant', 'spanish_restaurant',
    'german_restaurant', 'indonesian_restaurant', 'asian_restaurant', 'african_restaurant', 'ethiopian_restaurant', 'fast_food_restaurant',
    'pan_asian_restaurant', 'sushi_restaurant', 'fusion_restaurant', 'international_restaurant',
]);
const NOME_ESTERO = /\b(sushi|ramen|kebab|kebap|burger|hamburger|poke|wok|tex[- ]?mex|taqueria|burrito|curry|tandoori|thai|cinese|giapponese|indiano|messicano|american|steakhouse|fast ?food|hot ?dog|shawarma|falafel)\b/i;
const PRIMARY_LOCALE = new Set(['italian_restaurant', 'pizza_restaurant', 'seafood_restaurant', 'mediterranean_restaurant', 'pizzeria', 'trattoria']);
const NOME_LOCALE_FORTE = /\b(trattoria|osteria|hostaria|taverna|putia|friggitoria|rosticceria|tavola calda)\b/i;
const NOME_LOCALE_DEBOLE = /\b(antica|antico|vecchia|vecchio|casalinga|casereccia)\b/i;

const nameOf = (c) => String(c?.name || c?.title || '');
const primaryOf = (c) => c?.primaryType ?? c?.primary_type ?? null;

/** Un posto di cucina estera (tipo principale o nome)? */
export function isForeignCuisine(c) {
    const pt = primaryOf(c);
    if (pt && PRIMARY_ESTERA.has(pt)) return true;
    return NOME_ESTERO.test(nameOf(c));
}

/**
 * Perche' un posto e' locale: il tipo principale (cucina italiana/di pesce/pizzeria) o il
 * nome (trattoria, osteria…). null se non lo si puo' dire.
 */
export function localCuisineReason(c) {
    if (isForeignCuisine(c)) return null;
    const forte = NOME_LOCALE_FORTE.exec(nameOf(c));
    if (forte) return `nome: ${forte[0].toLowerCase()}`;
    const pt = primaryOf(c);
    if (pt && PRIMARY_LOCALE.has(pt)) return `tipo principale: ${pt}`;
    const debole = NOME_LOCALE_DEBOLE.exec(nameOf(c));
    if (debole) return `nome: ${debole[0].toLowerCase()}`;
    const types = Array.isArray(c?.types) ? c.types : [];
    const t = types.find(x => PRIMARY_LOCALE.has(x));
    return t ? `tipo: ${t}` : null;
}

/** Spinta di merito per i posti locali quando si chiede "tipico" (si somma al punteggio, non esclude). */
export const TIPICO_BONUS = 0.2;
export const VEGETARIANO_BONUS = 0.08;
export function tipicoBonus(c, { dieta = [] } = {}) {
    let b = 0;
    if (localCuisineReason(c)) b += TIPICO_BONUS;
    if ((dieta || []).includes('vegetariano') && primaryOf(c) === 'vegetarian_restaurant') b += VEGETARIANO_BONUS;
    return b;
}
