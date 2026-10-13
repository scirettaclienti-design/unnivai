/**
 * C6a — Che posto e'? Lo decide il TIPO PRINCIPALE di Google.
 *
 * ─── PERCHE' ESISTE ──────────────────────────────────────────────────────────
 * Google mette su un posto molti `types` ("art_gallery, bar, store" per un
 * cocktail bar con una mostra) e UN tipo principale (`primaryType`, "cocktail_bar").
 * Prima famiglia, categorie e durata nascevano dall'UNIONE dei types: un bar con
 * una galleria diventava un museo, un caffe' marcato anche `restaurant` durava
 * 1h 15min. Ora decide il tipo principale; i types servono solo quando il tipo
 * principale manca (cache vecchie, ricerca vecchia, place/details) o non dice
 * niente di specifico (`tourist_attraction`, `historical_landmark`…).
 *
 * ─── COME SI DECIDE ──────────────────────────────────────────────────────────
 *   1. tipo principale SPECIFICO (ristorante, bar, museo, chiesa, parco, negozio…)
 *      → quel tipo di posto. Un museo con caffetteria resta museo, un bar con
 *      galleria resta bar, un bar marcato anche restaurant e' un bar.
 *   2. altrimenti i `types`, in un ORDINE DI PRIORITA' scritto qui sotto
 *      (TYPES_PRIORITY): vince la prima voce che combacia, non l'ordine
 *      dell'array di Google. `museum` batte la ristorazione (museo con
 *      caffetteria), la ristorazione batte `art_gallery` (bar con galleria).
 *   3. nessuna delle due → null: il posto non ha un tipo che decida (un
 *      belvedere, un palazzo visto da fuori) e valgono le regole di prima.
 *
 * Puro: niente rete, niente import.
 */

/** Tipo di posto → categorie dello scheletro, famiglia, sosta stimata (minuti). */
export const KINDS = {
    museo:    { categorie: ['musei', 'cultura'],        famiglia: 'museo',  minuti: 60 },
    chiesa:   { categorie: ['cultura', 'monumenti'],    famiglia: 'chiesa', minuti: 20 },
    pasto:    { categorie: ['cibo'],                    famiglia: null,     minuti: 75 },
    spuntino: { categorie: ['cibo'],                    famiglia: null,     minuti: 30 },
    bar:      { categorie: ['bar', 'vita notturna'],    famiglia: null,     minuti: 20 },
    caffe:    { categorie: ['bar'],                     famiglia: null,     minuti: 20 },
    forno:    { categorie: ['cibo'],                    famiglia: null,     minuti: 20 },
    dolce:    { categorie: [],                          famiglia: null,     minuti: 20 },
    notte:    { categorie: ['vita notturna'],           famiglia: null,     minuti: 30 },
    verde:    { categorie: ['natura'],                  famiglia: 'verde',  minuti: 30 },
    negozio:  { categorie: ['shopping'],                famiglia: null,     minuti: 30 },
    servizi:  { categorie: [],                          famiglia: null,     minuti: 30 },
};

/** Locali e negozi: non hanno famiglia di tappa e hanno solo le categorie del proprio tipo. */
export const COMMERCIAL_KINDS = new Set(['pasto', 'spuntino', 'bar', 'caffe', 'forno', 'dolce', 'notte', 'negozio', 'servizi']);
/** Le categorie "da locale/negozio": un museo, una chiesa o un parco non le prendono da un `bar` o uno `store` di contorno. */
export const LOCALE_CATEGORIES = new Set(['cibo', 'bar', 'vita notturna', 'shopping']);

export const CHURCH_TYPES = ['church', 'place_of_worship', 'synagogue', 'mosque', 'hindu_temple'];
export const SHOP_TYPES = ['store', 'clothing_store', 'shoe_store', 'jewelry_store', 'book_store', 'shopping_mall', 'department_store'];

// ─── 1. Tipo principale ──────────────────────────────────────────────────────
const set = (...xs) => new Set(xs);
const PRIMARY_MUSEO = set('museum', 'art_gallery');
const PRIMARY_CHIESA = set(...CHURCH_TYPES);
// Un pasto veloce, da asporto: non e' "una sosta seduti".
const PRIMARY_SPUNTINO = set('fast_food_restaurant', 'meal_takeaway', 'meal_delivery', 'sandwich_shop', 'deli');
const PRIMARY_BAR = set('bar', 'pub', 'irish_pub', 'cocktail_bar', 'wine_bar', 'lounge_bar', 'sports_bar', 'brewery', 'brewpub', 'bar_and_grill');
const PRIMARY_CAFFE = set('cafe', 'coffee_shop', 'cafeteria', 'tea_house', 'coffee_roastery', 'coffee_stand', 'internet_cafe', 'cat_cafe', 'dog_cafe');
const PRIMARY_FORNO = set('bakery');
const PRIMARY_DOLCE = set('ice_cream_shop', 'gelato_shop', 'dessert_shop', 'dessert_restaurant', 'confectionery', 'candy_store', 'chocolate_shop', 'chocolate_factory', 'donut_shop', 'juice_shop', 'pastry_shop', 'cake_shop');
const PRIMARY_PASTO = set('restaurant', 'bistro', 'diner', 'steak_house', 'food_court', 'buffet_restaurant', 'fine_dining_restaurant');
const PRIMARY_VERDE = set('park', 'city_park', 'national_park', 'state_park', 'dog_park', 'wildlife_park', 'garden', 'botanical_garden', 'natural_feature');
// Servizi alla persona e ricettivita': posti veri, ma ne' pasti ne' cultura ne' negozi.
const PRIMARY_SERVIZI = set('spa', 'wellness_center', 'massage', 'massage_spa', 'beauty_salon', 'hair_salon', 'hair_care', 'nail_salon', 'beautician',
    'service', 'hotel', 'lodging', 'event_venue', 'banquet_hall', 'community_center', 'association_or_organization');

/** Il tipo di posto dato dal tipo principale, o null se non e' specifico. */
export function kindFromPrimaryType(primaryType) {
    const pt = typeof primaryType === 'string' ? primaryType.trim() : '';
    if (!pt) return null;
    if (PRIMARY_MUSEO.has(pt) || /_museum$/.test(pt)) return 'museo';
    if (PRIMARY_CHIESA.has(pt)) return 'chiesa';
    if (PRIMARY_SPUNTINO.has(pt)) return 'spuntino';
    if (PRIMARY_DOLCE.has(pt)) return 'dolce';
    if (PRIMARY_BAR.has(pt)) return 'bar';
    if (PRIMARY_CAFFE.has(pt)) return 'caffe';
    if (PRIMARY_FORNO.has(pt)) return 'forno';
    if (pt === 'night_club') return 'notte';
    if (PRIMARY_PASTO.has(pt) || /_restaurant$/.test(pt)) return 'pasto';
    if (PRIMARY_VERDE.has(pt)) return 'verde';
    if (pt === 'store' || pt === 'shopping_mall' || /_store$/.test(pt)) return 'negozio';
    if (PRIMARY_SERVIZI.has(pt)) return 'servizi';
    return null;
}

// ─── 2. Ordine di priorita' dei types (senza tipo principale) ─────────────────
//
// Vince la PRIMA voce che combacia con uno dei types del posto. L'ordine dice chi
// e' il "motivo per cui ci vai":
//   museo (`museum`) e chiesa prima di tutto: una chiesa o un museo con bar
//   dentro restano chiesa e museo;
//   poi la ristorazione e i locali: un posto che e' ANCHE una galleria
//   (`art_gallery`) ma e' un bar resta un bar — per questo `art_gallery` sta
//   DOPO i locali, mentre `museum` sta prima;
//   `restaurant` batte bar/caffe': e' la scelta di sempre per i locali con
//   entrambi (all'aperitivo non si porta qualcuno a cena);
//   poi parchi e negozi.
export const TYPES_PRIORITY = [
    ['museo', ['museum']],
    ['chiesa', CHURCH_TYPES],
    ['pasto', ['restaurant']],
    ['spuntino', ['meal_takeaway', 'meal_delivery']],
    ['bar', ['bar', 'pub']],
    ['notte', ['night_club']],
    ['caffe', ['cafe']],
    ['forno', ['bakery']],
    ['dolce', ['ice_cream_shop']],
    ['museo', ['art_gallery']],
    ['verde', ['park', 'natural_feature']],
    ['negozio', SHOP_TYPES],
];

/** Il tipo di posto dai soli types, in ordine di priorita'; null se nessuno decide. */
export function kindFromTypes(types) {
    if (!Array.isArray(types) || types.length === 0) return null;
    const have = new Set(types);
    for (const [kind, list] of TYPES_PRIORITY) if (list.some(t => have.has(t))) return kind;
    return null;
}

/**
 * Che posto e'.
 * @param {{ types?: string[], primaryType?: string|null }} place candidato o tappa
 * @returns {{ kind: string|null, fonte: 'principale'|'tipi'|null }}
 */
export function placeKind(place) {
    const fromPrimary = kindFromPrimaryType(place?.primaryType ?? place?.primary_type);
    if (fromPrimary) return { kind: fromPrimary, fonte: 'principale' };
    const fromTypes = kindFromTypes(place?.types);
    if (fromTypes) return { kind: fromTypes, fonte: 'tipi' };
    return { kind: null, fonte: null };
}
