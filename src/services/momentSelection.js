/**
 * P3 — la scelta dei luoghi segue lo scheletro della giornata.
 *
 * ─── COSA FA ─────────────────────────────────────────────────────────────────
 * Lo scheletro (P2, src/lib/daySkeleton.js) dice QUANDO e CHE COSA: per ogni
 * momento un orario, le categorie ammesse e il numero di tappe. Questo modulo
 * fa incontrare lo scheletro con i luoghi veri:
 *   1. divide i candidati gia' trovati fra i momenti, per categoria;
 *   2. dice quali momenti sono rimasti senza candidati (ricerca mirata, max 2);
 *   3. controlla la risposta del selettore e la ripara: una tappa fuori dal
 *      suo momento, di troppo o con un place_id inventato viene scartata, e il
 *      posto vuoto lo prende il candidato migliore per merito (Gate MERITO +
 *      DNA); a parita' di merito, il piu' vicino alla tappa precedente.
 *      C1: prima del merito vengono il tetto di cammino dalla tappa prima
 *      (MAX_WALK_MINUTES, ripiego sul piu' vicino) e la varieta' (una tappa per
 *      famiglia al giorno, salvo richiesta) — per il modello come per il codice.
 *      C1b: una famiglia nuova entro VARIETY_MAX_WALK_MINUTES vince su una
 *      ripetuta vicina; un momento senza niente entro il tetto finisce in
 *      `report.lontani` (senza una famiglia nuova vicina: `report.ripetuti`),
 *      e il chiamante cerca da quella tappa prima del ripiego;
 *      C5: a parita' di tetto e varieta', vince chi sta sulla strada verso il
 *      prossimo punto fisso (il pasto dopo; per un pasto, la tappa dopo); mai
 *      lo stesso marchio due volte nel giorno; dentro un momento con piu'
 *      tappe, l'ordine che fa il cammino piu' corto (orderPlanWalk); in fondo
 *      una rifinitura sul giro intero (polishRoute);
 *      C5d: la deviazione del motore e' quella della misura del banco
 *      (voce 12): A→B→C con le tappe vere vicine, non verso il pasto dopo;
 *      C5b: la prima tappa del giorno si misura dal punto di partenza (o dal
 *      centro del gruppo) con le stesse regole delle altre; una famiglia
 *      ripetuta nel giro finale resta sempre dichiarata, cosi' la ricerca
 *      mirata C1b la vede (la varieta' vince sulla forma del percorso);
 *   4. mette gli orari: ogni tappa inizia al piu' tardi fra l'inizio del suo
 *      momento e la fine della precedente piu' il cammino.
 *
 * Il modello sceglie e racconta; il codice decide se la scelta vale. Nessun
 * luogo entra se non e' un candidato di quel momento: un momento senza
 * candidati validi viene tolto e il report lo dice.
 *
 * Puro: niente rete, niente modello, niente orologio. La ricerca mirata la fa
 * il chiamante (generateItinerary), che conosce raggio, categoria e soglie.
 */

import { computeCandidateScore } from './candidateScoring';
import { stayOf, travelMinutes, WALKING_KMH } from '../lib/tourTiming';
import { placeKind, KINDS, COMMERCIAL_KINDS, LOCALE_CATEGORIES } from '../lib/placeKind';
import { FOOD_ONLY_MOMENT_KEYS, EXPANDABLE_KEYS, MAX_STOPS_PER_DAY } from '../lib/daySkeleton';
import { momentAdmits, isLocale } from '../lib/mealRules';
import { scheduleGaps, retimeWaits, totalGapMinutes, realStopCount } from '../lib/continuity';
import { freeTimeDecision } from '../lib/freeTime';
import { brandKey, legKm, pathKm, minimalPathKm, countCrossings, crossingPairs, repeatedBrands, stopDetours } from '../lib/routeShape';
import { openStatus, OPEN, CLOSED, UNKNOWN, NIGHT_FROM_MINUTES, romeMinutes } from '../lib/openingHours';

// ─── Categorie dello scheletro, dai types Google ─────────────────────────────
//
// Il vocabolario e' quello di dayMoments.js (cultura, monumenti, musei,
// passeggiata, cibo, natura, shopping, bar, punti panoramici, vita notturna).
// Un luogo puo' stare in piu' categorie: una chiesa e' cultura e monumento.
//
// C6a — COSA DECIDE: il tipo principale di Google (src/lib/placeKind.js). Un
// ristorante, un bar, un caffe', un negozio hanno solo le
// categorie del proprio tipo: un cocktail bar con `art_gallery` tra i types e'
// un bar (non un museo), un bar marcato anche `restaurant` e' un bar; un museo
// con caffetteria resta museo (nessuna categoria da locale). Senza tipo principale (cache vecchie) decide
// l'ordine di priorita' dei types scritto in placeKind.js. Per i posti che non
// sono ne' locali ne' musei ne' chiese (monumenti, parchi, belvedere) valgono
// i types come prima.
//
// Scelte dichiarate:
//   · `cafe` e' bar: in Italia il caffe' e' un bar.
//   · "punti panoramici" e "passeggiata" non hanno un type Google: si leggono
//     dal nome (Belvedere, Terrazza…; Piazza, Via, Ponte…). E' un indizio
//     lessicale, non un giudizio, e non toglie niente agli altri types.
const TYPE_CATEGORIES = {
    museum: ['musei', 'cultura'],
    art_gallery: ['musei', 'cultura'],
    church: ['cultura', 'monumenti'],
    place_of_worship: ['cultura', 'monumenti'],
    synagogue: ['cultura', 'monumenti'],
    mosque: ['cultura', 'monumenti'],
    hindu_temple: ['cultura', 'monumenti'],
    tourist_attraction: ['monumenti', 'cultura'],
    historical_landmark: ['monumenti', 'cultura'],
    monument: ['monumenti', 'cultura'],
    castle: ['monumenti', 'cultura'],
    city_hall: ['monumenti'],
    library: ['cultura'],
    performing_arts_theater: ['cultura'],
    restaurant: ['cibo'],
    meal_takeaway: ['cibo'],
    meal_delivery: ['cibo'],
    bakery: ['cibo'],
    bar: ['bar', 'vita notturna'],
    night_club: ['vita notturna'],
    cafe: ['bar'],
    park: ['natura'],
    natural_feature: ['natura'],
    campground: ['natura'],
    zoo: ['natura'],
    aquarium: ['natura'],
    store: ['shopping'],
    clothing_store: ['shopping'],
    shoe_store: ['shopping'],
    jewelry_store: ['shopping'],
    book_store: ['shopping'],
    shopping_mall: ['shopping'],
    department_store: ['shopping'],
    route: ['passeggiata'],
    neighborhood: ['passeggiata'],
    // C7 — un mercato storico e' un'esperienza (si passeggia, si compra), non un negozio e non un pasto.
    market: ['passeggiata', 'shopping'],
};

const PANORAMA_NAME = /\b(belvedere|terrazz[ae]|panoram\w*|affaccio)\b/i;
const WALK_NAME = /^(piazza|piazzale|via|vicolo|largo|lungotevere|lungomare|lungarno|ponte|scalinata|passeggiata)\b/i;

/** Le categorie dello scheletro a cui un candidato appartiene. */
export function candidateMomentCategories(candidate) {
    const types = Array.isArray(candidate?.types) ? candidate.types : [];
    const { kind } = placeKind(candidate);
    let out;
    if (kind && COMMERCIAL_KINDS.has(kind)) {
        // Un locale o un negozio ha solo le categorie del suo tipo: niente
        // `art_gallery` su un bar, niente `bar` su un ristorante.
        out = new Set(KINDS[kind].categorie);
    } else {
        out = new Set();
        for (const t of types) for (const c of TYPE_CATEGORIES[t] || []) out.add(c);
        if (kind) {
            // Museo, chiesa, parco: le categorie dei types come prima, ma un
            // `bar` o uno `store` di contorno non li fa diventare locale o negozio.
            for (const c of KINDS[kind].categorie) out.add(c);
            for (const c of LOCALE_CATEGORIES) out.delete(c);
        }
    }
    const name = String(candidate?.name || candidate?.title || '').trim();
    if (PANORAMA_NAME.test(name)) out.add('punti panoramici');
    if (WALK_NAME.test(name)) out.add('passeggiata');
    return out;
}

// ─── C1 — distanza e varieta' ────────────────────────────────────────────────
//
// Il tetto di cammino fra una tappa e la precedente dello stesso giorno. E'
// una STIMA DA TARARE, in un posto solo: vale per le scelte del modello, per
// il riempimento del codice e per i pasti. Ripiego: se nessun candidato del
// momento sta sotto il tetto si prende il piu' vicino — un momento non resta
// mai vuoto per colpa della distanza.
export const MAX_WALK_MINUTES = 20;
// Lo stesso tetto in metri: il bias delle ricerche mirate (pasti e luoghi).
export const MAX_WALK_METERS = Math.round((MAX_WALK_MINUTES / 60) * WALKING_KMH * 1000);
// C1b — la varieta' vince sulla distanza fino a qui: una famiglia nuova a 25
// minuti batte una famiglia ripetuta a 5. Oltre, torna a vincere la distanza.
export const VARIETY_MAX_WALK_MINUTES = 25;

// ─── C5 — percorso a filo ────────────────────────────────────────────────────
//
// La deviazione di un candidato `c` fra la tappa prima `a` e il prossimo punto
// fisso `b` (il pasto dopo; per un pasto, la tappa dopo): i minuti in piu' di
// a → c → b rispetto ad a → b. Zero = sta sulla strada.
// Un candidato che fa OFF_ROUTE_MINUTES di giro in piu' della migliore
// alternativa ammessa del momento e' "fuori strada" e cede, anche se l'ha
// scelto il modello (dopo tetto e varieta': C1 e C1b restano come sono).
// Sotto, la deviazione pesa insieme al merito: ogni minuto vale DETOUR_WEIGHT
// punti di merito (il merito sta fra 0 e 1: dieci minuti di giro valgono 0,2).
// STIME DA TARARE, in un posto solo.
export const OFF_ROUTE_MINUTES = 5;
export const DETOUR_WEIGHT = 0.02;
// C5d — le soglie della voce 12 del banco (banco.config.json: deviazioneMinuti,
// deviazioneMaxMinuti): la rifinitura guarda le stesse. Un test le lega.
export const ROUTE_DEVIATION_MINUTES = 5;
export const ROUTE_DEVIATION_MAX_MINUTES = 10;
// I punti fissi si leggono da un primo giro senza deviazione, poi si rifa' la
// scelta; al massimo ROUTE_PASSES volte, o finche' il piano non cambia.
const ROUTE_PASSES = 2;

const toMinutes = (km) => (km / WALKING_KMH) * 60;

// C5b — il centro di un gruppo di tappe: la MEDIANA delle coordinate, non la
// media — una tappa lontana sola (b-catania-B, 15 km di giro) trascinava la
// media fuori dal gruppo e faceva sembrare "fuori" una prima tappa che aveva
// un'altra tappa a zero minuti. Un gruppo sono almeno due tappe: con una sola
// il "centro" e' quella tappa, e il tetto lo misura gia' il tratto fra le due.
const median = (xs) => {
    const v = [...xs].sort((a, b) => a - b);
    const m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
export function groupCenter(points) {
    const pts = (points || []).filter(c => legKm(c, c) !== null);
    if (pts.length < 2) return null;
    return {
        latitude: median(pts.map(c => Number(c.latitude ?? c.lat))),
        longitude: median(pts.map(c => Number(c.longitude ?? c.lng))),
        name: 'centro del gruppo',
    };
}
const pointOf = (c) => (c ? { latitude: c.latitude ?? c.lat, longitude: c.longitude ?? c.lng, name: c.name || c.title || null } : null);
/** C5 — minuti di deviazione per passare da `c` andando da `a` a `b`; 0 senza `a` o `b`. */
export function detourMinutes(a, c, b) {
    if (!a || !b) return 0;
    const ac = legKm(a, c), cb = legKm(c, b), ab = legKm(a, b);
    if (ac === null || cb === null || ab === null) return 0;
    return Math.max(0, toMinutes(ac + cb - ab));
}

// Le famiglie di tappa: al massimo una per famiglia per giorno, salvo richiesta.
// Una sola famiglia per luogo, nell'ordine della lista (un belvedere in un
// parco e' panorama, una piazza con un giardino e' piazza). Un posto dove
// mangiare non ha famiglia: i pasti hanno gia' il loro momento.
// C6a — la famiglia segue il tipo del posto (tipo principale, poi types in
// ordine di priorita'): un bar con una galleria tra i types non e' un museo,
// un ristorante non ha famiglia. Per un locale che non e' un pasto restano le
// regole del NOME (un bar che si chiama "Terrazza" e' un panorama, come prima).
const FAMILY_RULES = [
    ['panorama', (kind, name) => PANORAMA_NAME.test(name)],
    // Il nome prima dei types: Google mette `park` a Piazza d'Aracoeli.
    ['piazza', (kind, name) => /^(piazza|piazzale|largo)\b/i.test(name)],
    ['chiesa', (kind, name) => kind === 'chiesa' || /^(chiesa|basilica|duomo|cattedrale|santuario|abbazia)\b/i.test(name)],
    ['museo', (kind, name) => kind === 'museo' || /^(museo|pinacoteca)\b/i.test(name)],
    ['verde', (kind, name) => kind === 'verde' || /^(parco|giardin[oi]|orto botanico|villa comunale)\b/i.test(name)],
];

/** La famiglia di un candidato (panorama, chiesa, museo, verde, piazza) o null. */
export function candidateFamily(candidate) {
    if (isMealPlace(candidate)) return null;
    const { kind } = placeKind(candidate);
    const name = String(candidate?.name || candidate?.title || '').trim();
    return FAMILY_RULES.find(([, test]) => test(kind, name))?.[0] || null;
}

// Una famiglia chiesta esplicitamente spegne la regola di varieta' per quella
// famiglia: "i belvederi di Roma" vuole belvederi.
const FAMILY_REQUEST_TEXT = {
    panorama: /\b(belveder\w*|panoram\w*|terrazz\w*|affacci\w*)/i,
    chiesa: /\b(chies[ae]|basilic\w*|duom[oi]|cattedral\w*|santuar\w*)/i,
    museo: /\b(muse[oi]|pinacotec\w*)/i,
    verde: /\b(parc[oh]\w*|giardin\w*|verde|natura)\b/i,
    piazza: /\bpiazz[ae]\b/i,
};
const FAMILY_REQUEST_CATEGORY = { 'punti panoramici': 'panorama', musei: 'museo', natura: 'verde' };

/**
 * Le famiglie chieste dalla categoria scelta (vocabolario dello scheletro) o
 * dal testo dell'utente.
 * @returns {Set<string>}
 */
export function requestedFamilies({ category = null, text = '' } = {}) {
    const out = new Set();
    const fromCat = FAMILY_REQUEST_CATEGORY[String(category || '').toLowerCase()];
    if (fromCat) out.add(fromCat);
    for (const [fam, re] of Object.entries(FAMILY_REQUEST_TEXT)) if (re.test(String(text || ''))) out.add(fam);
    return out;
}

// ─── Ricerca mirata: categoria del momento → tema di THEME_TEXTSEARCH ────────
// Le chiavi a destra devono esistere in placesDiscoveryService.THEME_TEXTSEARCH
// (themeCompleteness.test.js le controlla gia' per INTEREST_TO_THEME).
export const MOMENT_CATEGORY_TO_THEME = {
    cultura: 'cultura',
    monumenti: 'cultura',
    musei: 'cultura',
    passeggiata: 'cultura',
    cibo: 'food',
    natura: 'nature',
    shopping: 'shopping',
    bar: 'nightlife',
    'vita notturna': 'nightlife',
    'punti panoramici': 'romance',
};

/** BANCO-POOL — quanti candidati per momento finiscono nel tracciato. */
export const POOL_MAX = 15;

/** Tetto alle ricerche mirate per generazione (vincolo: oggi + 2). */
export const MAX_EXTRA_SEARCHES = 2;

/** Il tema di ricerca di un momento: la sua prima categoria che ne ha uno. */
// C7 — un momento con un `tema` suo (mattina e pomeriggio di un tema cibo: le esperienze) cerca con quello.
export const momentTheme = (m) => (m?.tema && THEME_OF_MOMENT_TEMA[m.tema])
    || (m?.categories || []).map(c => MOMENT_CATEGORY_TO_THEME[c]).find(Boolean) || null;
export const THEME_OF_MOMENT_TEMA = { esperienze: 'esperienze' };

const idOf = (c) => c?.place_id || c?.googlePlaceId || null;

// ─── 1. Momenti piatti, con un id stabile ────────────────────────────────────

/**
 * Lo scheletro in una lista di momenti in ordine cronologico, ciascuno con
 * l'indice del suo giorno e un id leggibile dal modello ("g1-mattina").
 */
export function flattenSkeleton(skeleton) {
    const out = [];
    (skeleton?.days || []).forEach((day, di) => {
        for (const m of day.moments || []) {
            out.push({ ...m, id: `g${di + 1}-${m.key}`, dayIndex: di });
        }
    });
    return out;
}

// ─── 2. Candidati per momento ────────────────────────────────────────────────

/**
 * @param {Array} moments da flattenSkeleton
 * @param {Array} candidates il pool (gia' filtrato per raggio, categoria, merito)
 * @param {object} [o]
 * @param {boolean} [o.anyCategory] true quando il pool e' gia' ristretto a una
 *   categoria dal codice (Gate RAGGIO-CATEGORIA): la richiesta esplicita vince
 *   e ogni candidato vale per ogni momento — gli orari restano. Tranne pranzo
 *   e cena (P3e): li' entra solo un posto dove mangiare.
 * @param {Set<string>} [o.mealOnlyIds] place_id cercati SOLO per pranzo e cena
 *   (fuori dalla categoria scelta): con anyCategory non vanno negli altri momenti.
 * @returns {Map<string, Array>} id momento → candidati ammessi (ordine del pool)
 */
export function bucketCandidates(moments, candidates, { anyCategory = false, mealOnlyIds = null } = {}) {
    const pool = Array.isArray(candidates) ? candidates.filter(idOf) : [];
    const cats = new Map(pool.map(c => [idOf(c), candidateMomentCategories(c)]));
    const buckets = new Map();
    for (const m of moments) {
        const base = anyCategory && !FOOD_ONLY_MOMENT_KEYS.has(m.key)
            ? pool.filter(c => !mealOnlyIds?.has(idOf(c)))
            : pool.filter(c => (m.categories || []).some(k => cats.get(idOf(c)).has(k))
                // C7 — un momento dove il testo chiede ESPLICITAMENTE un locale ("il pomeriggio in
                // pasticceria") accoglie ogni locale, anche quelli senza categoria dello scheletro (dolci).
                || (m.esplicito && isLocale(c)));
        // C7 — UN PASTO PER FASCIA: un ristorante sta solo a pranzo e cena; la mattina un locale e'
        // una colazione; l'aperitivo e' un bar. Vale anche con la categoria che vale per tutti i momenti.
        buckets.set(m.id, base.filter(c => momentAdmits(c, m)));
    }
    return buckets;
}

/** P3e — un posto dove mangiare: sta nella categoria `cibo` dello scheletro. */
export const isMealPlace = (candidate) => candidateMomentCategories(candidate).has('cibo');

/**
 * I temi da cercare per i momenti rimasti senza candidati: uno per momento
 * vuoto (la sua prima categoria, che e' quella privilegiata), senza doppioni,
 * al massimo MAX_EXTRA_SEARCHES, nell'ordine della giornata.
 */
export function missingMomentThemes(moments, buckets, max = MAX_EXTRA_SEARCHES) {
    const themes = [];
    for (const m of moments) {
        if ((buckets.get(m.id) || []).length > 0) continue;
        const theme = momentTheme(m);
        if (theme && !themes.includes(theme)) themes.push(theme);
        if (themes.length >= max) break;
    }
    return themes;
}

/**
 * Gate NARRATORE-DOPO — i temi da cercare per i momenti che il pool non riesce
 * a RIEMPIRE, non solo per quelli vuoti. Con "2-3 Giorni" il pranzo del giorno 3
 * ha lo stesso bucket del pranzo del giorno 1: non e' vuoto, ma i ristoranti
 * finiscono prima di arrivarci. Si simula la riparazione senza il modello
 * (tutto riempito per merito) e si guarda quali momenti restano corti.
 * Stesso tetto di ricerche (MAX_EXTRA_SEARCHES), nell'ordine della giornata,
 * ma pranzo e cena prima (P3e): un pasto senza ristorante si salta, quindi la
 * ricerca del cibo non deve restare fuori dal tetto.
 */
export function shortMomentThemes(moments, buckets, pool, max = MAX_EXTRA_SEARCHES, { requestedFamilies: asked = null } = {}) {
    const { plan } = repairMomentSelection({ moments, buckets, aiStops: [], pool, requestedFamilies: asked });
    const filled = new Map(plan.map(p => [p.moment.id, p.stops.length]));
    const themes = [];
    const meals = moments.filter(m => FOOD_ONLY_MOMENT_KEYS.has(m.key));
    for (const m of [...meals, ...moments.filter(m => !FOOD_ONLY_MOMENT_KEYS.has(m.key))]) {
        if ((filled.get(m.id) || 0) >= m.stops) continue;
        const theme = momentTheme(m);
        if (theme && !themes.includes(theme)) themes.push(theme);
        if (themes.length >= max) break;
    }
    return themes;
}

/**
 * C1 — da dove parte la ricerca mirata dei pasti: la tappa prima del primo
 * pasto rimasto corto nella stessa simulazione di shortMomentThemes (se il
 * pasto apre la giornata, la tappa dopo). null → il chiamante resta sul centro.
 * Non aggiunge chiamate: sposta soltanto il centro della ricerca del cibo.
 * C5 — con una tappa prima E una dopo, il centro va sulla linea fra le due:
 * a meta' strada, ma mai oltre 3/4 del tetto dalla tappa prima (un ristorante
 * trovato li' deve restare a portata di piedi da dove si arriva).
 * @returns {{ latitude: number, longitude: number, name: string|null }|null}
 */
export function mealSearchAnchor(moments, buckets, pool, { requestedFamilies: asked = null } = {}) {
    const { plan } = repairMomentSelection({ moments, buckets, aiStops: [], pool, requestedFamilies: asked });
    const filled = new Map(plan.map(p => [p.moment.id, p.stops.length]));
    const meal = moments.find(m => FOOD_ONLY_MOMENT_KEYS.has(m.key) && (filled.get(m.id) || 0) < m.stops);
    if (!meal) return null;
    const sameDay = plan.filter(p => p.moment.dayIndex === meal.dayIndex && p.moment.id !== meal.id);
    const mealAt = moments.indexOf(meal);
    const before = sameDay.filter(p => moments.indexOf(p.moment) < mealAt);
    const after = sameDay.filter(p => moments.indexOf(p.moment) > mealAt);
    const prima = before.length ? before[before.length - 1].stops.at(-1).candidate : null;
    const dopo = after[0]?.stops[0]?.candidate || null;
    const point = (c) => {
        const lat = c?.latitude ?? c?.lat;
        const lng = c?.longitude ?? c?.lng;
        return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng, name: c.name || c.title || null } : null;
    };
    const a = point(prima), b = point(dopo);
    if (!a || !b) return a || b;
    const L = legKm(a, b);
    const f = L > 0 ? Math.min(0.5, (0.75 * MAX_WALK_METERS) / 1000 / L) : 0;
    return {
        latitude: a.latitude + f * (b.latitude - a.latitude),
        longitude: a.longitude + f * (b.longitude - a.longitude),
        name: `fra ${a.name} e ${b.name}`,
    };
}

// ─── 3. Controllo e riparazione della risposta del selettore ─────────────────

const NARRATION_FIELDS = ['description', 'insiderTip', 'bestTime', 'transition', 'type'];
const hasDescription = (s) => !!(s?.description && String(s.description).trim());

// Minuti a piedi da `a` a `b`; senza coordinate, in fondo alla fila.
const walkFrom = (a, b) => {
    const t = travelMinutes(a, b);
    return Number.isFinite(t) ? t : Infinity;
};

/**
 * @param {object} p
 * @param {Array}  p.moments    da flattenSkeleton
 * @param {Map}    p.buckets    da bucketCandidates
 * @param {Array}  p.aiStops    le tappe del modello (tutti i giorni, in ordine),
 *                              ognuna con place_id e `moment`
 * @param {Array}  p.pool       tutti i candidati (per il punteggio di merito)
 * @param {object} [p.dnaWeights]
 * @param {Set<string>} [p.requestedFamilies] famiglie chieste (regola di varieta' spenta)
 * @param {number} [p.maxWalk]  tetto di cammino in minuti (MAX_WALK_MINUTES)
 * @param {number} [p.varietyWalk] fin dove la varieta' vince (VARIETY_MAX_WALK_MINUTES)
 * @param {Set<string>} [p.searchedIds] place_id trovati da una ricerca mirata
 * @param {Set<string>} [p.searchedMoments] momenti per cui la ricerca mirata e'
 *   gia' partita (null: nessuna ricerca in questo giro, motivo generico)
 * @returns {{ plan: Array<{ moment: object, stops: Array<{ candidate: object,
 *   narration: object|null, source: 'modello'|'riparata', trace: { scelta:
 *   'modello'|'riparazione'|'ricerca mirata'|'ripiego', minuti: number|null,
 *   famiglia: string|null, ripiego?: 'distanza'|'famiglia'|'catena', motivo?: string,
 *   deviazione?: number } }> }>,
 *   report: { scartate: Array, riempite: Array, momentiTolti: Array, ripieghi: Array,
 *   lontani: Array<{ momento: string, da: { latitude, longitude, name } }>,
 *   ripetuti: Array<{ momento: string, da: { latitude, longitude, name } }> } }}
 */
export function repairMomentSelection(args) {
    // C5 — primo giro senza punti fissi; poi i punti fissi di quel piano
    // (ordinato) guidano la scelta, finche' il piano non cambia.
    // C5b — dal secondo giro anche il riferimento della prima tappa del giorno.
    let res = repairPass(args, null, null);
    for (let i = 0; i < ROUTE_PASSES; i++) {
        const ordered = orderPlanWalk(res.plan, args);
        const next = repairPass(args, nextStops(ordered), dayStartRefs(ordered, args.startPoint));
        const same = planKey(next.plan) === planKey(res.plan);
        res = next;
        if (same) break;
    }
    const plan = polishRoute(orderPlanWalk(res.plan, args), args, res.report);
    res.report.ricercheDaFare = searchQueue(plan, res.report, args);
    if (res.report.pool) markPoolFinal(res.report.pool, plan);
    return { plan, report: res.report };
}

/**
 * BANCO-POOL — dopo la rifinitura: per ogni candidato registrato, se e' nel
 * giro finale (la rifinitura puo' aver sostituito lo scelto). Solo lettura.
 */
function markPoolFinal(pool, plan) {
    for (const p of plan) {
        const entry = pool[p.moment.id];
        if (!entry) continue;
        const finali = new Set(p.stops.map(s => idOf(s.candidate)));
        for (const c of entry.candidati) c.nelGiro = finali.has(c.place_id);
        for (const s of p.stops) {
            if (entry.candidati.some(c => c.place_id === idOf(s.candidate))) continue;
            entry.candidati.push({ place_id: idOf(s.candidate), nome: s.candidate.name || s.candidate.title || null,
                famiglia: candidateFamily(s.candidate), scelto: false, nelGiro: true, motivo: 'messo dalla rifinitura' });
        }
    }
}

/**
 * C5c — le ricerche mirate C1b in ordine di gravita', sul giro finale:
 *   1. una tappa oltre il tetto di cammino (MAX_WALK_MINUTES) dalla tappa prima;
 *   2. una famiglia ripetuta;
 *   3. un momento segnato "lontano" la cui tappa, nel giro finale, sta ormai
 *      entro il tetto (l'ordine o la rifinitura l'hanno avvicinata).
 * A parita' di gravita', l'ordine della giornata. Il tetto delle ricerche
 * (MAX_EXTRA_SEARCHES) e le soglie 20/25 restano quelli di C1b: cambia solo
 * chi passa per primo.
 * @returns {Array<{ momento: string, place_id: string, da: object|null, gravita: 1|2|3 }>}
 */
export function searchQueue(plan, report, { maxWalk = MAX_WALK_MINUTES } = {}) {
    const order = new Map();
    const legOf = new Map();
    plan.forEach((p, pi) => p.stops.forEach((s, si) => {
        order.set(idOf(s.candidate), pi * 100 + si);
    }));
    for (const day of new Set(plan.map(p => p.moment.dayIndex))) {
        const stops = plan.filter(p => p.moment.dayIndex === day).flatMap(p => p.stops.map(s => s.candidate));
        stops.forEach((c, i) => legOf.set(idOf(c), i ? walkFrom(stops[i - 1], c) : null));
    }
    const out = [];
    for (const x of report.lontani || []) {
        if (!order.has(x.place_id)) continue;
        out.push({ ...x, gravita: (legOf.get(x.place_id) ?? Infinity) > maxWalk ? 1 : 3 });
    }
    for (const x of report.ripetuti || []) if (order.has(x.place_id)) out.push({ ...x, gravita: 2 });
    return out.sort((a, b) => (a.gravita - b.gravita) || (order.get(a.place_id) - order.get(b.place_id)));
}

/**
 * C5b — da dove si misura la prima tappa di ogni giorno: il punto di partenza
 * se c'e', altrimenti il centro delle ALTRE tappe del giorno (il gruppo).
 * @returns {Map<number, object|null>} indice del giorno → punto
 */
export function dayStartRefs(plan, startPoint = null) {
    const out = new Map();
    for (const day of new Set(plan.map(p => p.moment.dayIndex))) {
        const stops = plan.filter(p => p.moment.dayIndex === day).flatMap(p => p.stops.map(s => s.candidate));
        out.set(day, startPoint || groupCenter(stops.slice(1)));
    }
    return out;
}

const planKey = (plan) => plan.map(p => `${p.moment.id}:${p.stops.map(s => idOf(s.candidate)).join(',')}`).join('|');

/**
 * C5d — la tappa vera che segue ogni posto del piano: per il momento `m`, la
 * tappa dopo ognuna delle sue tappe nell'ordine del giro (la seconda tappa
 * dello stesso momento, o la prima del momento dopo), nello stesso giorno.
 * E' la "C" della misura del banco (A→B→C): prima (C5) il motore guardava il
 * pasto dopo, e la prima di due tappe al pomeriggio poteva fare uno zig-zag che
 * il motore non vedeva (Roma, Palazzo Massimo: 4,9 min per il motore, 12,5 per
 * la misura).
 * @returns {Map<string, Array<object|null>>} id momento → tappa dopo, per posto
 */
export function nextStops(plan) {
    const out = new Map();
    for (const day of new Set(plan.map(p => p.moment.dayIndex))) {
        const entries = plan.filter(p => p.moment.dayIndex === day);
        const flat = entries.flatMap(p => p.stops.map(s => ({ p, c: s.candidate })));
        for (const p of entries) out.set(p.moment.id, []);
        flat.forEach(({ p }, i) => out.get(p.moment.id).push(flat[i + 1]?.c || null));
    }
    return out;
}

function repairPass({
    moments, buckets, aiStops, pool, dnaWeights = {}, requestedFamilies: asked = null,
    maxWalk = MAX_WALK_MINUTES, varietyWalk = VARIETY_MAX_WALK_MINUTES,
    searchedIds = null, searchedMoments = null, startPoint = null, registraPool = true,
    tempoLiberoMinuti = null,
}, targets, starts) {
    const report = { scartate: [], riempite: [], momentiTolti: [], ripieghi: [], lontani: [], ripetuti: [], ritocchi: [], tempoLibero: [] };
    // BANCO-POOL — le scelte del modello cosi' come sono arrivate, e (sotto) la
    // classifica che il codice ha calcolato a ogni posto. Solo registrazione:
    // niente di qui entra nelle decisioni.
    if (registraPool) {
        report.sceltaModello = (Array.isArray(aiStops) ? aiStops : []).filter(x => x && x.place_id)
            .map(x => ({ place_id: x.place_id, momento: x.moment ?? null }));
        report.pool = {};
    }
    const poolIds = new Set((pool || []).map(idOf));
    const ai = (Array.isArray(aiStops) ? aiStops : []).filter(s => s && typeof s === 'object');

    // La voce del modello, per place_id: se il codice riempie un posto con un
    // luogo che il modello aveva raccontato (magari nel momento sbagliato), il
    // racconto e' di quel luogo e si tiene.
    const narrationById = new Map();
    for (const s of ai) {
        if (s.place_id && hasDescription(s) && !narrationById.has(s.place_id)) narrationById.set(s.place_id, s);
    }

    // Merito: lo stesso punteggio del Gate MERITO, sullo stesso pool.
    const scoreCache = new Map();
    const scoreOf = (c) => {
        const k = idOf(c);
        if (!scoreCache.has(k)) scoreCache.set(k, computeCandidateScore(c, pool || [], dnaWeights));
        return scoreCache.get(k);
    };
    const famCache = new Map();
    const famOf = (c) => {
        const k = idOf(c);
        if (!famCache.has(k)) famCache.set(k, candidateFamily(c));
        return famCache.get(k);
    };
    // Una famiglia conta per la varieta' solo se esiste e non e' stata chiesta.
    const counted = (f) => !!f && !asked?.has(f);

    const momentIds = new Set(moments.map(m => m.id));
    const used = new Set();
    // Le tappe senza `moment` non sono "fuori dal loro momento": il modello
    // non l'ha detto. Prendono il primo momento libero in cui stanno.
    const unassigned = [];
    const byMoment = new Map(moments.map(m => [m.id, []]));
    for (const s of ai) {
        if (s.moment == null || s.moment === '') { unassigned.push(s); continue; }
        if (!momentIds.has(s.moment)) {
            report.scartate.push({ place_id: s.place_id, momento: s.moment, motivo: 'momento inesistente' });
            continue;
        }
        byMoment.get(s.moment).push(s);
    }

    const plan = [];
    // C1 — distanza e famiglie si misurano dentro il giorno: la prima tappa di
    // un giorno non ha una "tappa prima".
    let prev = null;
    let day = null;
    let dayFamilies = new Set();
    // C5 — i marchi gia' nel giorno: mai due locali della stessa catena.
    let dayBrands = new Set();
    const brandCache = new Map();
    const brandOf = (c) => {
        const k = idOf(c);
        if (!brandCache.has(k)) brandCache.set(k, brandKey(c));
        return brandCache.get(k);
    };
    moments.forEach((m, mi) => {
        if (m.dayIndex !== day) { day = m.dayIndex; prev = null; dayFamilies = new Set(); dayBrands = new Set(); }
        const bucket = buckets.get(m.id) || [];
        const inBucket = new Map(bucket.map(c => [idOf(c), c]));
        const later = moments.slice(mi + 1).filter(x => x.dayIndex === m.dayIndex && x.stops > 0);
        const chosen = [];
        const last = () => (chosen.length ? chosen[chosen.length - 1].candidate : prev);
        // C5d — la tappa dopo il posto che si sta riempiendo (dal giro di prima).
        const targetOf = () => targets?.get(m.id)?.[chosen.length] ?? null;
        // C5b — la prima tappa del giorno non ha una tappa prima: si misura dal
        // punto di partenza o dal centro del gruppo, con lo stesso tetto delle
        // altre. Niente passo pagato dalla varieta': alla prima tappa ogni
        // famiglia e' nuova. La deviazione vale solo da un punto di partenza
        // vero: dal centro del gruppo punirebbe la partenza naturale di un giro
        // lineare, che sta a un capo, non nel mezzo.
        const ref = startPoint || starts?.get(m.dayIndex) || null;
        const refName = startPoint ? 'punto di partenza' : 'centro del gruppo';
        const fromRef = () => !last() && !!ref;
        const origin = () => last() || ref;
        const devFrom = () => last() || startPoint || null;
        const free = (except) => bucket.filter(c => !used.has(idOf(c)) && idOf(c) !== except);
        // C5e (O) — solo se attivo (dopo le ricerche mirate), solo fuori dai
        // pasti, solo con una tappa vera prima nello stesso giorno.
        const freeSlot = () => !!tempoLiberoMinuti && !FOOD_ONLY_MOMENT_KEYS.has(m.key) && !!last()
            && freeTimeDecision({ prev: last(), candidates: free(null), pasto: false, maxMinutes: tempoLiberoMinuti }).libero;

        // Il "costo" di un candidato come prossima tappa, in ordine di peso:
        //   hard   oltre il tetto dalla tappa prima, e quanto: fra candidati
        //          tutti oltre, vince il piu' vicino — il ripiego. Non conta
        //          come "oltre" il passo pagato dalla varieta' (C1b): una
        //          famiglia NUOVA entro i 25 minuti;
        //   rank   entro il tetto (0), famiglia nuova fra 20 e 25 minuti (1),
        //          famiglia ripetuta entro il tetto (2);
        //   starve prenderlo lascerebbe un momento dopo senza nessuna famiglia
        //          nuova (tre belvederi possibili all'aperitivo e nient'altro:
        //          il belvedere della mattina glielo ruberebbe);
        //   strand il momento subito dopo non avrebbe nessuna tappa entro il
        //          tetto da lui e di famiglia nuova (all'aperitivo solo
        //          belvederi vicini: il belvedere del pomeriggio obbliga a
        //          ripetere). Esatto: lui sara' la tappa prima.
        // Oltre i 25 minuti la distanza pesa piu' della varieta': meglio una
        // seconda chiesa a 5 minuti che una famiglia nuova a 40.
        const okFam = (x, fams) => !counted(famOf(x)) || !fams.has(famOf(x));
        const famsWith = (c) => (counted(famOf(c)) ? new Set([...dayFamilies, famOf(c)]) : dayFamilies);
        const restOf = (lm, c) => (buckets.get(lm.id) || []).filter(x => !used.has(idOf(x)) && idOf(x) !== idOf(c));
        const starves = (c) => counted(famOf(c)) && later.some(lm => {
            const rest = restOf(lm, c);
            return rest.some(x => okFam(x, dayFamilies)) && !rest.some(x => okFam(x, famsWith(c)));
        });
        const next = later[0] || null;
        const strands = (c) => !!next && chosen.length === m.stops - 1
            && !restOf(next, c).some(x => reachable(walkFrom(c, x), x, famsWith(c)));
        // Raggiungibile come prossima tappa: entro il tetto con una famiglia
        // non ripetuta, o entro i 25 minuti con una famiglia nuova.
        const newFam = (x, fams) => counted(famOf(x)) && !fams.has(famOf(x));
        const reachable = (t, x, fams) => (t <= maxWalk && okFam(x, fams)) || (t <= varietyWalk && newFam(x, fams));
        // C5 — davanti a tutto il marchio (mai due volte nel giorno: entra
        // solo se non c'e' altro); in fondo, dopo tetto e varieta', "fuori
        // strada": piu' di OFF_ROUTE_MINUTES di giro oltre la deviazione
        // minima fra i candidati ammessi (stesso marchio no, oltre il tetto no).
        const costOf = (c) => {
            const from = origin();
            const t = from ? walkFrom(from, c) : 0;
            const over = !!from && t > maxWalk;
            const dup = !okFam(c, dayFamilies);
            const stretch = over && !fromRef() && t <= varietyWalk && newFam(c, dayFamilies);
            const hard = over && !stretch;
            const rank = stretch ? 1 : (dup ? 2 : 0);
            const chain = !!brandOf(c) && dayBrands.has(brandOf(c));
            const dev = detourMinutes(devFrom(), c, targetOf());
            return { c, t, over, dup, stretch, chain, hard, dev, pre: [chain ? 1 : 0, hard ? 1 : 0, hard ? t : 0, rank, starves(c) ? 1 : 0, strands(c) ? 1 : 0] };
        };
        const cmpKey = (a, b) => {
            for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
            return 0;
        };
        // Merito e strada insieme: il punteggio meno il peso della deviazione.
        const worth = (x) => scoreOf(x.c) - DETOUR_WEIGHT * x.dev;
        // Tutti i candidati liberi del momento col loro costo, dal migliore.
        const ranked = () => {
            const all = free(null).map(costOf);
            const ok = all.filter(x => !x.chain && !x.hard);
            const minDev = Math.min(...(ok.length ? ok : all).map(x => x.dev));
            for (const x of all) x.key = [...x.pre, x.dev > minDev + OFF_ROUTE_MINUTES ? 1 : 0];
            return all.sort((a, b) => cmpKey(a.key, b.key) || (worth(b) - worth(a)) || (a.t - b.t));
        };
        // Il miglior candidato libero del momento (escluso `except`), col suo costo.
        const best = (except) => ranked().find(x => idOf(x.c) !== except) || null;
        // Perche' una scelta del modello perde contro l'alternativa migliore:
        // la prima voce del costo in cui e' peggiore.
        const whyWorse = (k, c, t, a) => {
            const dist = fromRef()
                ? `prima tappa fuori dal gruppo: ${Number.isFinite(t) ? t : '?'} min dal ${refName} (tetto ${maxWalk})`
                : `oltre il tetto di cammino (${Number.isFinite(t) ? t : '?'} min > ${maxWalk})`;
            if (k[0] !== a[0]) return `stesso marchio gia' nel giorno (${brandOf(c).split('|')[1]})`;
            if (k[1] !== a[1] || k[2] !== a[2]) return dist;
            if (k[3] !== a[3]) return k[3] === 2 ? `famiglia gia' presente nel giorno (${famOf(c)})` : dist;
            if (k[4] !== a[4]) return `toglie l'unica alternativa a un momento dopo (${famOf(c)})`;
            if (k[5] !== a[5]) return 'dopo di lui nessuna tappa nuova entro il tetto';
            return `fuori strada: ${Math.round(detourMinutes(devFrom(), c, targetOf()))} min di giro verso "${targetOf()?.name || targetOf()?.title || '?'}"`;
        };
        // BANCO-POOL — la classifica del posto che si sta riempiendo, come il
        // codice l'ha appena calcolata (ranked): per ogni candidato le minute,
        // la deviazione, il merito e la prima regola in cui perde contro lo
        // scelto. Al massimo POOL_MAX candidati per momento.
        const POOL_REASONS = ['stesso marchio gia\' nel giorno', 'oltre il tetto di cammino', 'piu\' lontano oltre il tetto',
            null, 'toglie l\'unica alternativa a un momento dopo', 'dopo di lui nessuna tappa nuova entro il tetto', 'fuori strada'];
        const recordPool = (c) => {
            if (!registraPool) return;
            const all = ranked();
            const mine = all.find(x => idOf(x.c) === idOf(c));
            const entry = report.pool[m.id] || (report.pool[m.id] = { posti: 0, candidati: [] });
            const posto = entry.posti++;
            const whyNot = (x) => {
                if (!mine) return null;
                for (let i = 0; i < x.key.length; i++) {
                    if (x.key[i] === mine.key[i]) continue;
                    if (x.key[i] < mine.key[i]) return 'regole migliori dello scelto (scelta del modello a pari merito di regole)';
                    if (i === 3) return x.key[3] === 2 ? `famiglia gia' presente nel giorno (${famOf(x.c)})` : 'famiglia nuova ma oltre i 20 min';
                    return POOL_REASONS[i];
                }
                return worth(x) < worth(mine) ? 'merito e strada minori (a pari regole)' : 'pari: lo scelto viene prima (modello o ordine)';
            };
            for (const x of all) {
                const id = idOf(x.c);
                const prima = entry.candidati.find(e => e.place_id === id);
                if (prima) { if (id === idOf(c)) Object.assign(prima, { scelto: true, posto, motivo: null }); continue; }
                if (entry.candidati.length >= POOL_MAX && id !== idOf(c)) continue;
                entry.candidati.push({
                    place_id: id, nome: x.c.name || x.c.title || null, famiglia: famOf(x.c),
                    // C6a — il nome originale (se e' stato ripulito) e il tipo che ha deciso famiglia e sosta.
                    ...(x.c.nameOriginal ? { nomeOriginale: x.c.nameOriginal } : {}),
                    ...(x.c.primaryType ? { primaryType: x.c.primaryType } : {}),
                    types: Array.isArray(x.c.types) ? x.c.types : [],
                    merito: Math.round(scoreOf(x.c) * 100) / 100,
                    minuti: Number.isFinite(x.t) ? x.t : null,
                    deviazione: Math.round(x.dev * 10) / 10,
                    scelto: id === idOf(c), posto,
                    motivo: id === idOf(c) ? null : whyNot(x),
                });
            }
            // lo scelto c'e' sempre: oltre il tetto di POOL_MAX esce l'ultimo non scelto
            while (entry.candidati.length > POOL_MAX) {
                const k = entry.candidati.map(e => e.scelto).lastIndexOf(false);
                if (k < 0) break;
                entry.candidati.splice(k, 1);
            }
        };
        // Un passo oltre il tetto e' un ripiego, tranne quando lo paga la
        // varieta' (famiglia nuova entro i 25 minuti): quello e' una scelta.
        const take = (c, narration, source, cost) => {
            recordPool(c);
            const { over, dup, stretch: byVariety, chain } = cost;
            const first = fromRef();
            const ripiego = chain ? 'catena' : ((over && !byVariety) ? (first ? 'partenza' : 'distanza') : (dup ? 'famiglia' : null));
            const from = last();
            const mirata = searchedIds?.has(idOf(c)) && source !== 'modello';
            const trace = {
                scelta: ripiego ? 'ripiego' : (source === 'modello' ? 'modello' : (mirata ? 'ricerca mirata' : 'riparazione')),
                minuti: from && Number.isFinite(cost.t) ? cost.t : null,
                famiglia: famOf(c),
            };
            if (targetOf() && devFrom()) trace.deviazione = Math.round(cost.dev);
            if (first) trace.daPartenza = { minuti: cost.t, da: refName };
            if (byVariety) trace.motivo = `famiglia nuova a ${cost.t} min: la varieta' vale il passo oltre i ${maxWalk}`;
            if (ripiego) {
                trace.ripiego = ripiego;
                // Dopo la ricerca mirata il motivo dice com'e' andata.
                const dopo = searchedMoments == null ? ''
                    : (searchedMoments.has(m.id) ? ' (anche dopo la ricerca mirata)' : ' (ricerche mirate esaurite)');
                const da = from ? { latitude: from.latitude ?? from.lat, longitude: from.longitude ?? from.lng, name: from.name || from.title || null } : null;
                if (ripiego === 'catena') {
                    trace.motivo = `solo locali di un marchio gia' nel giorno (${brandOf(c).split('|')[1]})`;
                } else if (ripiego === 'partenza') {
                    // Un filtro non lascia mai un buco: resta, e la traccia dice perche'.
                    trace.motivo = `prima tappa a ${cost.t} min dal ${refName}: nessuna alternativa del pool entro ${maxWalk} min`;
                } else if (ripiego === 'distanza') {
                    trace.motivo = `nessun candidato entro ${maxWalk} min${dopo}: il piu' vicino`;
                    report.lontani.push({ momento: m.id, place_id: idOf(c), da });
                } else {
                    trace.motivo = `nessuna famiglia nuova vicina${dopo}: ${famOf(c)} ripetuta`;
                    report.ripetuti.push({ momento: m.id, place_id: idOf(c), da });
                }
                if (mirata) trace.motivo += ' (dalla ricerca mirata)';
                report.ripieghi.push({ place_id: idOf(c), name: c.name || c.title || null, momento: m.id, motivo: trace.motivo });
            }
            chosen.push({ candidate: c, narration, source, trace });
            used.add(idOf(c));
            if (counted(famOf(c))) dayFamilies.add(famOf(c));
            if (brandOf(c)) dayBrands.add(brandOf(c));
        };
        // C1 — una scelta del modello vale se nessuna alternativa del momento
        // costa meno (vedi costOf): il tetto e la varieta' valgono anche per lui.
        const modelWins = (c) => {
            const all = ranked();
            const mine = all.find(x => idOf(x.c) === idOf(c));
            const alt = all.find(x => idOf(x.c) !== idOf(c)) || null;
            return { ok: !alt || cmpKey(mine.key, alt.key) <= 0, mine, alt };
        };
        const reject = (s, motivo) => report.scartate.push({ place_id: s.place_id, momento: m.id, motivo });

        for (const s of byMoment.get(m.id)) {
            const c = inBucket.get(s.place_id);
            if (chosen.length >= m.stops) { reject(s, 'oltre il numero di tappe'); continue; }
            if (!poolIds.has(s.place_id)) { reject(s, 'luogo non fra i candidati'); continue; }
            if (!c) { reject(s, 'fuori dal suo momento'); continue; }
            if (used.has(s.place_id)) { reject(s, 'gia\' usato'); continue; }
            if (freeSlot()) { reject(s, `nessun posto entro ${tempoLiberoMinuti} min dalla tappa prima: tempo libero`); continue; }
            const { ok, mine, alt } = modelWins(c);
            if (!ok) { reject(s, whyWorse(mine.key, c, mine.t, alt.key)); continue; }
            // Gate NARRATORE-DOPO — il selettore non scrive testi: una tappa
            // vale per il suo luogo e il suo momento. Il racconto arriva dopo,
            // dal narratore, sulle tappe finali.
            take(c, s, 'modello', mine);
        }
        for (let i = 0; i < unassigned.length && chosen.length < m.stops; i++) {
            const s = unassigned[i];
            const c = inBucket.get(s.place_id);
            if (!c || used.has(s.place_id) || freeSlot()) continue;
            const { ok, mine } = modelWins(c);
            if (!ok) continue;
            take(c, s, 'modello', mine);
            unassigned.splice(i, 1);
            i -= 1;
        }

        // Posti vuoti: tetto, varieta', poi merito; a parita', il piu' vicino.
        // C5e (O) — un posto non pasto senza niente entro tempoLiberoMinuti dalla
        // tappa prima diventa "tempo libero": niente tappa, il report lo dice e
        // il momento dopo si sceglie dalla tappa vera prima.
        while (chosen.length < m.stops) {
            if (freeSlot()) {
                const { piuVicino } = freeTimeDecision({ prev: last(), candidates: free(null), pasto: false, maxMinutes: tempoLiberoMinuti });
                report.tempoLibero.push({
                    momento: m.id, key: m.key, label: m.label, dayIndex: m.dayIndex, posto: chosen.length,
                    dopo: last()?.name || last()?.title || null, piuVicino,
                    motivo: `nessun posto entro ${tempoLiberoMinuti} min dalla tappa prima${searchedMoments?.has(m.id) ? ' (anche dopo la ricerca mirata)' : ''}`
                        + (piuVicino ? `: il piu' vicino, "${piuVicino.nome}", e' a ${piuVicino.minuti} min` : ': nessun candidato'),
                });
                break;
            }
            const b = best(null);
            if (!b) break;
            take(b.c, narrationById.get(idOf(b.c)) || null, 'riparata', b);
            report.riempite.push({ place_id: idOf(b.c), name: b.c.name || b.c.title || null, momento: m.id });
        }

        if (chosen.length === 0) {
            // Un momento tutto "tempo libero" non e' tolto: e' dichiarato.
            if (!report.tempoLibero.some(x => x.momento === m.id)) report.momentiTolti.push({ momento: m.id, label: m.label, motivo: 'nessun candidato valido' });
            return;
        }
        plan.push({ moment: m, stops: chosen });
        prev = chosen[chosen.length - 1].candidate;
    });
    for (const s of unassigned) {
        report.scartate.push({ place_id: s.place_id, momento: null, motivo: 'senza momento e senza posto libero' });
    }
    return { plan, report };
}

// ─── C5 — rifinitura sul giro intero ─────────────────────────────────────────

const MAX_POLISH_ROUNDS = 12;
// Il guadagno minimo di una sostituzione per sola strada: ~150 m a piedi.
// STIMA DA TARARE.
const POLISH_MIN_GAIN = 2;

/**
 * La scelta momento per momento non vede il giro intero: due tappe ognuna
 * "sulla strada" possono ancora tagliarsi. Qui, giorno per giorno, si prova a
 * sostituire una tappa con un altro candidato DELLO STESSO MOMENTO e si tiene
 * il cambio migliore se:
 *   · non aggiunge tratti oltre il tetto, catene ne' incroci, e non aggiunge
 *     ripetizioni a NESSUNA famiglia (C5c: non basta che il totale resti
 *     uguale — una piazza ripetuta tolta e un belvedere ripetuto messo
 *     sposterebbero la ripetizione; C1, C1b e i marchi restano duri), e
 *   · ne toglie almeno uno; oppure, a parita', accorcia di almeno
 *     POLISH_MIN_GAIN minuti la somma "cammino + avanti-e-indietro" (cammino
 *     reale + quanto supera il cammino minimo sulle stesse tappe) e abbassa
 *     quella somma tassata meno il merito (ogni minuto vale DETOUR_WEIGHT
 *     punti di merito, come nella scelta). Il merito da solo non cambia mai
 *     una scelta del modello.
 * Il numero di tappe e i momenti non cambiano; ogni sostituzione va nel report.
 */
export function polishRoute(plan, { buckets, pool, dnaWeights = {}, requestedFamilies: asked = null, maxWalk = MAX_WALK_MINUTES, varietyWalk = VARIETY_MAX_WALK_MINUTES, searchedIds = null, startPoint = null }, report) {
    const scoreCache = new Map();
    const scoreOf = (c) => {
        const k = idOf(c);
        if (!scoreCache.has(k)) scoreCache.set(k, computeCandidateScore(c, pool || [], dnaWeights));
        return scoreCache.get(k);
    };
    const used = new Set(plan.flatMap(p => p.stops.map(s => idOf(s.candidate))));
    const measure = (entries) => {
        const seq = orderPlanWalk(entries, { maxWalk, startPoint }).flatMap(p => p.stops.map(s => s.candidate));
        const fams = seq.map(candidateFamily).filter(f => f && !asked?.has(f));
        // C5b — anche la prima tappa ha il suo tetto, dal riferimento.
        const ref = startPoint || groupCenter(seq.slice(1));
        // C5c — le ripetizioni per famiglia (quante tappe in piu' della prima).
        const perFamiglia = {};
        for (const f of fams) perFamiglia[f] = (perFamiglia[f] ?? -1) + 1;
        // C5e — il passo pagato dalla varieta' (C1b): un tratto fra 20 e 25 min
        // verso la PRIMA tappa di una famiglia del giorno non e' "oltre" quando
        // lo scambio toglie una ripetizione (vedi better). Qui si contano solo.
        const vista = new Set();
        let passiVarieta = 0;
        seq.forEach((c, i) => {
            const f = candidateFamily(c);
            const nuova = !!f && !asked?.has(f) && !vista.has(f);
            if (f) vista.add(f);
            const t = i ? walkFrom(seq[i - 1], c) : null;
            if (nuova && t > maxWalk && t <= varietyWalk) passiVarieta++;
        });
        return {
            incroci: countCrossings(seq),
            oltre: seq.slice(1).filter((c, i) => walkFrom(seq[i], c) > maxWalk).length
                + (ref && seq.length > 1 && walkFrom(ref, seq[0]) > maxWalk ? 1 : 0),
            passiVarieta,
            famiglie: fams.length - new Set(fams).size,
            perFamiglia,
            catene: repeatedBrands(seq).length,
            // cammino + avanti-e-indietro, in minuti: 2 x reale - minimo
            strada: toMinutes(2 * pathKm(seq) - minimalPathKm(seq)),
            merito: seq.reduce((a, c) => a + scoreOf(c), 0),
            // C5d — la voce 12 del banco, con la sua stessa funzione (stopDetours):
            // tappe con deviazione oltre 5 min, oltre 10, e la somma.
            ...(() => {
                const dev = stopDetours(seq).map(d => d.minuti);
                return {
                    devGravi: dev.filter(x => x > ROUTE_DEVIATION_MAX_MINUTES).length,
                    devOltre: dev.filter(x => x > ROUTE_DEVIATION_MINUTES).length,
                    devSomma: dev.reduce((a, x) => a + x, 0),
                };
            })(),
        };
    };
    // C5d — anche la voce 12 e' una regola: uno scambio non aggiunge deviazioni
    // oltre 5 o 10 min. Le regole dure vengono prima (varieta' sopra la forma).
    const REGOLE = ['oltre', 'famiglie', 'catene', 'incroci'];
    const DEVIAZIONI = ['devGravi', 'devOltre'];
    const costo = (x) => DETOUR_WEIGHT * x.strada - x.merito;
    // C5c — nessuna famiglia guadagna ripetizioni: cosi' una ripetizione non
    // si sposta mai da una famiglia all'altra, anche a totale invariato.
    const noFamilyGains = (t, m) => Object.entries(t.perFamiglia).every(([f, n]) => n <= (m.perFamiglia[f] ?? 0));
    // C5d — togliere una deviazione non vale qualunque merito: lo stesso cambio
    // della scelta, DETOUR_WEIGHT punti di merito per minuto di deviazione tolto.
    const meritOk = (t, m) => t.merito >= m.merito - DETOUR_WEIGHT * Math.max(0, m.devSomma - t.devSomma) - 1e-9;
    // C5e — una ripetizione evitabile si toglie anche con una famiglia nuova a
    // 20-25 min (C1b): solo se lo scambio la toglie davvero, il tratto in piu'
    // pagato dalla varieta' non conta come "oltre il tetto". Per tutto il resto
    // il tetto dei 20 resta.
    const varietyPays = (t, m) => t.famiglie < m.famiglie && t.passiVarieta > m.passiVarieta
        && t.oltre - (t.passiVarieta - m.passiVarieta) <= m.oltre;
    const regoleOk = (t, m) => REGOLE.every(k => t[k] <= m[k] || (k === 'oltre' && varietyPays(t, m)));
    // C5e — la varieta' vince sulla forma (C5d): uno scambio che toglie una
    // ripetizione non e' fermato dalle deviazioni. Gli incroci restano duri.
    const deviazioniOk = (t, m) => DEVIAZIONI.every(k => t[k] <= m[k]) || t.famiglie < m.famiglie;
    const better = (t, m) => regoleOk(t, m) && deviazioniOk(t, m) && noFamilyGains(t, m)
        && (REGOLE.some(k => t[k] < m[k])
            || (DEVIAZIONI.some(k => t[k] < m[k]) && meritOk(t, m))
            || (t.strada <= m.strada - POLISH_MIN_GAIN && costo(t) < costo(m) - 1e-9));
    const out = [...plan];
    for (const day of new Set(plan.map(p => p.moment.dayIndex))) {
        const idx = out.map((p, i) => i).filter(i => out[i].moment.dayIndex === day);
        for (let round = 0; round < MAX_POLISH_ROUNDS; round++) {
            const entries = idx.map(i => out[i]);
            let best = null;
            let bestM = measure(entries);
            entries.forEach((e, ei) => e.stops.forEach((s, si) => {
                for (const c of buckets.get(e.moment.id) || []) {
                    if (used.has(idOf(c))) continue;
                    // Fuori dai pasti un posto dove si mangia entra solo al
                    // posto di un altro: un locale senza famiglia "toglierebbe"
                    // una ripetizione mettendo una trattoria nel pomeriggio.
                    if (!FOOD_ONLY_MOMENT_KEYS.has(e.moment.key) && isMealPlace(c) && !isMealPlace(s.candidate)) continue;
                    const stops = e.stops.map((x, k) => (k === si ? { ...x, candidate: c } : x));
                    const trial = entries.map((x, k) => (k === ei ? { ...x, stops } : x));
                    const t = measure(trial);
                    if (better(t, bestM)) { best = { ei, si, c }; bestM = t; }
                }
            }));
            if (!best) break;
            const e = out[idx[best.ei]];
            const old = e.stops[best.si];
            used.delete(idOf(old.candidate));
            used.add(idOf(best.c));
            // La tappa tolta porta via il SUO ripiego, e solo il suo (C5b: prima
            // si toglievano quelli di tutto il momento, e la ricerca mirata C1b
            // non vedeva piu' l'altra famiglia ripetuta).
            if (old.trace?.ripiego) {
                const gone = (x) => x.place_id !== idOf(old.candidate);
                report.ripieghi = report.ripieghi.filter(gone);
                report.lontani = (report.lontani || []).filter(gone);
                report.ripetuti = (report.ripetuti || []).filter(gone);
            }
            const perVarieta = bestM.famiglie < measure(entries).famiglie && bestM.passiVarieta > measure(entries).passiVarieta;
            const trace = { scelta: searchedIds?.has(idOf(best.c)) ? 'ricerca mirata' : 'riparazione', minuti: null,
                famiglia: candidateFamily(best.c),
                motivo: perVarieta
                    ? `famiglia nuova oltre i ${maxWalk} min (entro ${varietyWalk}): toglie la ripetizione, al posto di "${old.candidate.name || old.candidate.title || idOf(old.candidate)}"`
                    : `sulla strada: al posto di "${old.candidate.name || old.candidate.title || idOf(old.candidate)}"` };
            out[idx[best.ei]] = { ...e, stops: e.stops.map((x, k) => (k === best.si ? { candidate: best.c, narration: null, source: 'riparata', trace } : x)) };
            report.ritocchi = [...(report.ritocchi || []), { momento: e.moment.id, tolta: idOf(old.candidate), messa: idOf(best.c), name: best.c.name || best.c.title || null }];
            report.riempite.push({ place_id: idOf(best.c), name: best.c.name || best.c.title || null, momento: e.moment.id });
        }
    }
    const ordered = orderPlanWalk(out, { maxWalk, startPoint });
    syncRepeatTraces(ordered, asked, report, { buckets, maxWalk, varietyWalk, measure, used });
    explainDetours(ordered, { buckets, used, measure, maxWalk, scoreOf }, report);
    explainCrossings(ordered, { buckets, used, measure }, report);
    return ordered;
}

/**
 * C5d — una deviazione oltre ROUTE_DEVIATION_MINUTES che resta nel giro finale
 * dice perche', con la prova: le alternative LIBERE del pool di quel momento,
 * ciascuna con la sua deviazione fra le stesse tappe vicine (stopDetours, la
 * misura del banco) e il suo merito. Esito:
 *   pool          nessuna alternativa sotto la soglia;
 *   composizione  almeno una sotto la soglia: `bloccata` dice quale regola della
 *                 rifinitura l'ha fermata (tetto, famiglia ripetuta, marchio,
 *                 incrocio, un'altra deviazione, merito, un locale fuori dai pasti).
 */
const DETOUR_RULES = [
    ['oltre', 'il tetto'], ['famiglie', 'una famiglia ripetuta'], ['catene', 'un marchio'], ['incroci', 'un incrocio'],
    ['devGravi', 'una deviazione oltre 10 min'], ['devOltre', 'un\'altra deviazione oltre 5 min'],
];
function explainDetours(plan, { buckets, used, measure, maxWalk, scoreOf }, report) {
    for (const day of new Set(plan.map(p => p.moment.dayIndex))) {
        const entries = plan.filter(p => p.moment.dayIndex === day);
        const flat = entries.flatMap(p => p.stops.map(s => ({ p, s })));
        const base = measure(entries);
        for (const d of stopDetours(flat.map(x => x.s.candidate))) {
            if (d.minuti <= ROUTE_DEVIATION_MINUTES) continue;
            const { p, s } = flat[d.indice];
            const A = flat[d.indice - 1].s.candidate, C = flat[d.indice + 1].s.candidate;
            const alternative = (buckets.get(p.moment.id) || [])
                .filter(c => !used.has(idOf(c)) && idOf(c) !== idOf(s.candidate))
                .map(c => {
                    const [dc] = stopDetours([A, c, C]);
                    const alt = { nome: c.name || c.title || idOf(c), famiglia: candidateFamily(c), deviazione: dc ? Math.round(dc.minuti * 10) / 10 : null,
                        merito: Math.round(scoreOf(c) * 100) / 100, tetto: walkFrom(A, c) <= maxWalk && walkFrom(c, C) <= maxWalk };
                    if (alt.deviazione !== null && alt.deviazione <= ROUTE_DEVIATION_MINUTES) {
                        const trial = measure(entries.map(x => (x !== p ? x : { ...x, stops: x.stops.map(y => (y === s ? { ...y, candidate: c } : y)) })));
                        alt.bloccata = DETOUR_RULES.filter(([k]) => trial[k] > base[k]).map(([, nome]) => nome);
                        if (Object.entries(trial.perFamiglia).some(([f, n]) => n > (base.perFamiglia[f] ?? 0)) && !alt.bloccata.includes('una famiglia ripetuta')) alt.bloccata.push('una famiglia ripetuta');
                        if (!FOOD_ONLY_MOMENT_KEYS.has(p.moment.key) && isMealPlace(c) && !isMealPlace(s.candidate)) alt.bloccata.push('un locale dove si mangia fuori dai pasti');
                        if (!alt.bloccata.length && trial.merito < base.merito - DETOUR_WEIGHT * Math.max(0, base.devSomma - trial.devSomma) - 1e-9) alt.bloccata.push('il merito');
                    }
                    return alt;
                })
                .filter(a => a.deviazione !== null)
                .sort((a, b) => a.deviazione - b.deviazione);
            const sotto = alternative.filter(a => a.deviazione <= ROUTE_DEVIATION_MINUTES);
            const prova = {
                minuti: Math.round(d.minuti * 10) / 10,
                esito: sotto.length ? 'composizione' : 'pool',
                candidatiMomento: (buckets.get(p.moment.id) || []).length,
                alternative: alternative.slice(0, 5),
            };
            s.trace = { ...(s.trace || {}), deviazioneProva: prova };
            report.deviazioni = [...(report.deviazioni || []), { momento: p.moment.id, place_id: idOf(s.candidate), ...prova }];
        }
    }
}

// C5b — un incrocio che resta deve dire perche'. Per ogni giorno con incroci si
// riprovano le sostituzioni dentro lo stesso momento SENZA le regole dure: se
// una lo toglierebbe, il motivo e' la regola che l'ha fermata (tetto, famiglia
// ripetuta, catena, un locale fuori dai pasti); se nessuna lo toglie, nessun
// candidato del pool basta. Il motivo va nel report e nella traccia delle
// tappe da cui partono i due tratti che si tagliano.
const RULE_NAMES = { oltre: 'un tratto oltre il tetto', famiglie: 'una famiglia ripetuta', catene: 'un marchio ripetuto' };
function explainCrossings(plan, { buckets, used, measure }, report) {
    for (const day of new Set(plan.map(p => p.moment.dayIndex))) {
        const entries = plan.filter(p => p.moment.dayIndex === day);
        const stops = entries.flatMap(p => p.stops);
        const pairs = crossingPairs(stops.map(s => s.candidate));
        if (!pairs.length) continue;
        const base = measure(entries);
        const blocks = new Set();
        entries.forEach((e, ei) => e.stops.forEach((s, si) => {
            for (const c of buckets.get(e.moment.id) || []) {
                if (used.has(idOf(c))) continue;
                const trial = entries.map((x, k) => (k === ei ? { ...x, stops: x.stops.map((y, j) => (j === si ? { ...y, candidate: c } : y)) } : x));
                const t = measure(trial);
                if (t.incroci >= base.incroci) continue;
                if (!FOOD_ONLY_MOMENT_KEYS.has(e.moment.key) && isMealPlace(c) && !isMealPlace(s.candidate)) blocks.add('un locale dove si mangia fuori dai pasti');
                for (const k of Object.keys(RULE_NAMES)) if (t[k] > base[k]) blocks.add(RULE_NAMES[k]);
            }
        }));
        const motivo = blocks.size
            ? `incrocio rimasto: toglierlo costerebbe ${[...blocks].join(' o ')}`
            : 'incrocio rimasto: nessun candidato dello stesso momento lo toglie';
        report.incrociRimasti = [...(report.incrociRimasti || []), { giorno: day + 1, incroci: pairs.length, motivo }];
        for (const [i, j] of pairs) for (const k of [i, j]) if (stops[k]) stops[k].trace = { ...(stops[k].trace || {}), incrocio: motivo };
    }
}

/**
 * C5b — le famiglie ripetute del giro FINALE, dichiarate. Giorno per giorno,
 * nell'ordine in cui si cammina: la seconda tappa di una famiglia gia' vista
 * e' un ripiego "famiglia" (traccia, ripieghi e `report.ripetuti`, da cui la
 * ricerca mirata C1b cerca una famiglia nuova); una tappa segnata cosi' la
 * cui famiglia nel giorno non si ripete piu' perde la dicitura. Prima una
 * sostituzione "piazza al posto di piazza" lasciava la ripetizione senza
 * dicitura: il banco non la contava e C1b non la cercava.
 */
function syncRepeatTraces(plan, asked, report, { buckets = null, maxWalk = MAX_WALK_MINUTES, varietyWalk = VARIETY_MAX_WALK_MINUTES, measure = null, used = null } = {}) {
    report.ripetuti = report.ripetuti || [];
    for (const day of new Set(plan.map(p => p.moment.dayIndex))) {
        const seen = new Set();
        let prevStop = null;
        for (const p of plan.filter(x => x.moment.dayIndex === day)) {
            for (const s of p.stops) {
                const f = candidateFamily(s.candidate);
                const repeat = !!f && !asked?.has(f) && seen.has(f);
                const marked = s.trace?.ripiego === 'famiglia';
                const id = idOf(s.candidate);
                if (repeat && !marked) {
                    s.trace = { ...(s.trace || {}), scelta: 'ripiego', ripiego: 'famiglia', famiglia: f,
                        motivo: `nessuna famiglia nuova sulla strada: ${f} ripetuta` };
                    report.ripieghi.push({ place_id: id, name: s.candidate.name || s.candidate.title || null, momento: p.moment.id, motivo: s.trace.motivo });
                    if (!report.ripetuti.some(x => x.place_id === id)) report.ripetuti.push({ momento: p.moment.id, place_id: id, da: pointOf(prevStop) });
                }
                if (repeat && buckets) {
                    s.trace = { ...s.trace, varieta: repeatEvidence(s, f, plan.filter(x => x.moment.dayIndex === day), { buckets, asked, maxWalk, varietyWalk, measure, used }) };
                    const v = s.trace.varieta;
                    if (v.esito === 'inevitabile' && !/inevitabile/.test(s.trace.motivo || '')) {
                        s.trace.motivo = `${s.trace.motivo || `${f} ripetuta`} — inevitabile: nei momenti delle tappe ${f} (${v.candidatiMomento} candidati) `
                            + `nessuna alternativa libera che la tolga entro ${varietyWalk} min`
                            + (v.piuVicina ? `; la piu' vicina: "${v.piuVicina.nome}" (${v.piuVicina.famiglia || 'senza famiglia'}, ${v.piuVicina.momento}) a ${v.piuVicina.minuti} min` : '');
                    } else if (v.esito === 'evitabile' && !/evitabile/.test(s.trace.motivo || '')) {
                        s.trace.motivo = `${s.trace.motivo || `${f} ripetuta`} — evitabile: ${v.alternative.filter(a => !a.usata).map(a => `"${a.nome}" (${a.momento}, ${a.minuti} min${a.bloccata?.length ? `, bloccata da ${a.bloccata.join(' e ')}` : ''})`).join('; ')}`;
                    }
                    const r = report.ripetuti.find(x => x.place_id === id);
                    if (r) r.evitabile = v.esito === 'evitabile';
                }
                if (!repeat && marked) {
                    const { ripiego: _r, ...rest } = s.trace;
                    s.trace = { ...rest, scelta: s.source === 'modello' ? 'modello' : 'riparazione', motivo: 'famiglia non piu\' ripetuta dopo la rifinitura del giro' };
                    report.ripieghi = report.ripieghi.filter(x => x.place_id !== id);
                    report.ripetuti = report.ripetuti.filter(x => x.place_id !== id);
                }
                if (f) seen.add(f);
                prevStop = s.candidate;
            }
        }
    }
}

/**
 * C5c — la prova di una ripetizione: per OGNI tappa della famiglia ripetuta
 * nel giorno (anche la prima, che si puo' cambiare quanto la seconda), le
 * alternative del pool del suo momento che toglierebbero la ripetizione —
 * famiglia nuova per il giorno entro `varietyWalk` dalla tappa prima, o senza
 * famiglia entro il tetto; per la prima tappa del giorno, dal centro del gruppo
 * con il solo tetto (C5b). Un posto dove si mangia non conta fuori dai pasti.
 * Evitabile = almeno un'alternativa libera (non gia' nel giro). Per ognuna, con
 * `measure` della rifinitura, quale regola ha impedito lo scambio (un tratto
 * oltre il tetto, un incrocio, un marchio); nessuna regola = un errore.
 */
function repeatEvidence(stop, fam, dayPlan, { buckets, asked, maxWalk, varietyWalk, measure, used }) {
    const dayStops = dayPlan.flatMap(p => p.stops.map(s => ({ s, p })));
    const inDay = new Set(dayStops.map(x => idOf(x.s.candidate)));
    const alternative = [];
    let candidati = 0;
    for (const [k, { s: r, p }] of dayStops.entries()) {
        if (candidateFamily(r.candidate) !== fam) continue;
        const prev = k ? dayStops[k - 1].s.candidate : null;
        const ref = prev || groupCenter(dayStops.filter(x => x.s !== r).map(x => x.s.candidate));
        const others = new Set(dayStops.filter(x => x.s !== r).map(x => candidateFamily(x.s.candidate)).filter(f => f && !asked?.has(f)));
        const cands = (buckets.get(p.moment.id) || []).filter(c => idOf(c) !== idOf(r.candidate)
            && !(!FOOD_ONLY_MOMENT_KEYS.has(p.moment.key) && isMealPlace(c)));
        candidati += cands.length;
        for (const c of cands) {
            const f = candidateFamily(c);
            const senza = !f || !!asked?.has(f);
            if (!senza && others.has(f)) continue;
            const minuti = ref ? walkFrom(ref, c) : 0;
            const entro = senza || !prev ? minuti <= maxWalk : minuti <= varietyWalk;
            const alt = { nome: c.name || c.title || idOf(c), famiglia: f, momento: p.moment.key, minuti, entro, usata: inDay.has(idOf(c)) || !!used?.has(idOf(c)) };
            if (entro && !alt.usata && measure) {
                const base = measure(dayPlan);
                const trial = measure(dayPlan.map(x => (x !== p ? x : { ...x, stops: x.stops.map(y => (y === r ? { ...y, candidate: c } : y)) })));
                // C5e — il passo della varieta' (20-25 min) non blocca se toglie la ripetizione.
                const pagato = trial.famiglie < base.famiglie && trial.passiVarieta > base.passiVarieta
                    && trial.oltre - (trial.passiVarieta - base.passiVarieta) <= base.oltre;
                // e le deviazioni non bloccano chi toglie una ripetizione (la varieta' vince sulla forma).
                const toglie = trial.famiglie < base.famiglie;
                alt.bloccata = [['oltre', 'il tetto'], ['incroci', 'un incrocio'], ['catene', 'un marchio'], ['devGravi', 'una deviazione oltre 10 min'], ['devOltre', 'una deviazione oltre 5 min']]
                    .filter(([key]) => trial[key] > base[key] && !(key === 'oltre' && pagato) && !(key.startsWith('dev') && toglie)).map(([, nome]) => nome);
            }
            alternative.push(alt);
        }
    }
    alternative.sort((a, b) => a.minuti - b.minuti);
    const vicine = alternative.filter(a => a.entro);
    const libere = vicine.filter(a => !a.usata);
    const strip = ({ entro: _e, ...a }) => a;
    return {
        esito: libere.length ? 'evitabile' : 'inevitabile',
        candidatiMomento: candidati,
        alternative: vicine.slice(0, 6).map(strip),
        piuVicina: alternative.find(a => !a.usata) ? strip(alternative.find(a => !a.usata)) : null,
    };
}

// ─── C5 — l'ordine dentro il momento ─────────────────────────────────────────

/**
 * Dentro ogni momento con piu' tappe, l'ordine che fa il cammino piu' corto
 * fra l'ultima tappa del momento prima e la prima del momento dopo (vicino
 * piu' vicino, poi scambi 2-opt). Una tappa non cambia mai momento. Un ordine
 * nuovo vale solo se accorcia il cammino senza aggiungere tratti oltre il tetto;
 * senza coordinate per tutte le tappe del momento, l'ordine resta.
 * @param {Array} plan da repairMomentSelection
 * @returns {Array} un piano nuovo (quello passato non cambia)
 */
export function orderPlanWalk(plan, { maxWalk = MAX_WALK_MINUTES, startPoint = null } = {}) {
    const out = plan.map(p => ({ ...p, stops: [...p.stops] }));
    const sameDay = (i, j) => out[j] && out[j].moment.dayIndex === out[i].moment.dayIndex;
    // Due giri: il primo puo' cambiare la prima tappa di un momento, che e'
    // l'estremo del momento prima.
    for (let pass = 0; pass < 2; pass++) {
        out.forEach((p, i) => {
            if (p.stops.length < 2) return;
            const before = sameDay(i, i - 1) ? out[i - 1].stops.at(-1).candidate : (startPoint || null);
            const after = sameDay(i, i + 1) ? out[i + 1].stops[0].candidate : null;
            // C5b — il momento che apre il giorno: la sua prima tappa non puo'
            // finire oltre il tetto dal centro del gruppo (senza partenza).
            const others = before ? null : out.filter((x, k) => k !== i && x.moment.dayIndex === p.moment.dayIndex).flatMap(x => x.stops.map(s => s.candidate));
            const firstRef = others ? (seq) => groupCenter([...seq.slice(1), ...others]) : null;
            p.stops = shortestOrder(p.stops, before, after, maxWalk, firstRef);
        });
    }
    return out;
}

function shortestOrder(stops, before, after, maxWalk, firstRef = null) {
    const pts = stops.map(s => s.candidate);
    // legKm(c, c) e' null solo senza coordinate.
    if (pts.some(c => legKm(c, c) === null)) return stops;
    // I tratti della sequenza, estremi compresi (un estremo senza coordinate non conta).
    const legs = (seq) => {
        const e = [before, ...seq, after].filter(c => c && legKm(c, c) !== null);
        return e.slice(1).map((c, i) => [e[i], c]);
    };
    const km = (seq) => legs(seq).reduce((a, [x, y]) => a + legKm(x, y), 0);
    const overs = (seq) => legs(seq).filter(([x, y]) => walkFrom(x, y) > maxWalk).length
        + (firstRef && firstRef(seq) && walkFrom(firstRef(seq), seq[0]) > maxWalk ? 1 : 0);
    // Vicino piu' vicino: dalla tappa prima, o da ognuna se il momento apre il giorno.
    const greedy = (start) => {
        const left = pts.filter(c => c !== start);
        const seq = start ? [start] : [];
        let cur = start || before;
        while (left.length) {
            // senza tappa prima e senza partenza: il primo resta il primo
            if (!cur) { cur = left.shift(); seq.push(cur); continue; }
            left.sort((a, b) => legKm(cur, a) - legKm(cur, b));
            cur = left.shift();
            seq.push(cur);
        }
        return seq;
    };
    const starts = before ? [greedy(null)] : pts.map(greedy);
    let best = starts.reduce((a, b) => (km(b) < km(a) ? b : a));
    // 2-opt: rovescia un tratto finche' accorcia.
    for (let improved = true; improved;) {
        improved = false;
        for (let i = 0; i < best.length - 1; i++) {
            for (let j = i + 1; j < best.length; j++) {
                const cand = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
                if (km(cand) < km(best) - 1e-9) { best = cand; improved = true; }
            }
        }
    }
    if (!(km(best) < km(pts) - 1e-9) || overs(best) > overs(pts)) return stops;
    return best.map(c => stops[pts.indexOf(c)]);
}

// ─── 4. Orari dentro il momento ──────────────────────────────────────────────

/**
 * Mette in fila le tappe del piano e calcola l'attesa prima di ognuna:
 * inizio = il piu' tardi fra l'inizio del momento e (fine della precedente +
 * cammino). Se l'inizio cade alla fine del momento o dopo, la tappa non ci sta
 * e viene tolta (il report lo dice). Soste e cammino: le regole di tourTiming.
 *
 * @param {Array} plan da repairMomentSelection
 * @param {Date|Date[]} dayStarts inizio della finestra (uno per giorno)
 * @returns {{ days: Array<Array<{ candidate, narration, source, moment,
 *   waitMinutesBefore: number, start: Date }>>, tolte: Array }}
 */
export function scheduleMomentPlan(plan, dayStarts) {
    const startOf = (di) => (Array.isArray(dayStarts) ? dayStarts[di] : dayStarts);
    const days = [];
    const tolte = [];
    let cursorDay = -1;
    let prev = null; // { candidate, end: ms }
    for (const { moment: m, stops } of plan) {
        if (m.dayIndex !== cursorDay) {
            cursorDay = m.dayIndex;
            prev = null;
        }
        if (!days[m.dayIndex]) days[m.dayIndex] = [];
        for (const s of stops) {
            const dayStart = startOf(m.dayIndex);
            const earliest = prev
                ? prev.end + (travelMinutes(prev.candidate, s.candidate) ?? 0) * 60000
                : (dayStart instanceof Date ? dayStart.getTime() : m.start.getTime());
            const start = earliest + Math.ceil((Math.max(m.start.getTime(), earliest) - earliest) / 60000) * 60000;
            if (start >= m.end.getTime()) {
                tolte.push({ place_id: idOf(s.candidate), momento: m.id, motivo: 'non entra nel suo momento' });
                continue;
            }
            const stay = stayOf(s.candidate);
            days[m.dayIndex].push({
                ...s,
                moment: m,
                start: new Date(start),
                // ceil, non round: con una partenza "da adesso" (secondi
                // compresi) un round potrebbe anticipare la tappa di qualche
                // secondo e farla cadere prima dell'inizio del suo momento.
                waitMinutesBefore: Math.ceil((start - earliest) / 60000),
            });
            prev = { candidate: s.candidate, end: start + stay * 60000 };
        }
    }
    return { days: Array.from(days, d => d || []), tolte };
}

// ─── 5. ORARI — una tappa vale solo se il posto e' aperto per tutta la sosta ─
//
// Gli orari settimanali arrivano sul candidato (`openingPeriods`, ricerca nuova).
// Un posto chiuso non entra nel bucket del suo momento: tutte le regole che ci
// sono (varieta', percorso, tetto di cammino, tempo libero) scelgono allora solo
// fra posti aperti, per il modello come per il codice. Un orario sconosciuto
// (ricerca vecchia, posto senza orari) e' ammesso: non si toglie niente.
//
// L'orario di arrivo di un posto dipende dal giro (fine della tappa prima +
// cammino), che non c'e' ancora quando si dividono i candidati: il primo filtro
// usa l'inizio del momento, il controllo vero (settleOpeningHours) usa gli
// orari del piano e vieta, momento per momento, i posti che risultano chiusi.

const isLocaleCandidate = (c) => {
    const cats = candidateMomentCategories(c);
    return cats.has('cibo') || cats.has('bar');
};
const nameOf = (c) => c?.name || c?.title || null;

/**
 * I bucket senza i posti chiusi.
 * @param {Array} moments da flattenSkeleton (con start: Date)
 * @param {Map} buckets da bucketCandidates
 * @param {object} [o]
 * @param {Map<string, Set<string>>} [o.veto] momento → place_id gia' risultati chiusi nel giro
 * @returns {{ buckets: Map, report: { chiusi: Array, ignoti: number, scartatiIgnoti: Array } }}
 *   `chiusi`: i posti tolti (momento, place_id, nome, perche). `scartatiIgnoti`: i posti
 *   a orario sconosciuto che perdono contro un'alternativa aperta con orario noto
 *   (a colazione, per i locali; dopo le 21, per tutti).
 */
export function applyOpeningToBuckets(moments, buckets, { veto = null } = {}) {
    const out = new Map();
    const report = { chiusi: [], ignoti: 0, scartatiIgnoti: [] };
    for (const m of moments) {
        const list = buckets.get(m.id) || [];
        const arrival = m.start instanceof Date ? m.start : null;
        if (!arrival) { out.set(m.id, list); continue; }
        const kept = [];
        for (const c of list) {
            const id = idOf(c);
            if (veto?.get(m.id)?.has(id)) {
                report.chiusi.push({ momento: m.id, place_id: id, nome: nameOf(c), perche: 'chiuso quando ci si arriva (orario del giro)' });
                continue;
            }
            const st = openStatus(c, arrival, stayOf(c));
            if (st.stato === CLOSED) {
                report.chiusi.push({ momento: m.id, place_id: id, nome: nameOf(c), perche: st.motivo });
                continue;
            }
            kept.push({ c, stato: st.stato });
        }
        // Orario sconosciuto: ammesso, ma a colazione (i locali del mattino) e dopo
        // le 21 perde contro un'alternativa aperta con orario noto.
        const noti = kept.filter(x => x.stato === OPEN);
        let finale = kept;
        if (noti.length > 0) {
            if (romeMinutes(arrival) >= NIGHT_FROM_MINUTES) finale = noti;
            else if (m.key === 'mattina' && noti.some(x => isLocaleCandidate(x.c))) finale = kept.filter(x => !(x.stato === UNKNOWN && isLocaleCandidate(x.c)));
        }
        for (const x of kept) if (!finale.includes(x)) report.scartatiIgnoti.push({ momento: m.id, place_id: idOf(x.c), nome: nameOf(x.c) });
        report.ignoti += finale.filter(x => x.stato === UNKNOWN).length;
        out.set(m.id, finale.map(x => x.c));
    }
    return { buckets: out, report };
}

/** Le tappe di un piano gia' messo in orario che risultano chiuse quando ci si arriva (arrivo → arrivo + sosta). */
export function closedInSchedule(sched) {
    const out = [];
    for (const day of sched?.days || []) {
        for (const s of day) {
            const st = openStatus(s.candidate, s.start, stayOf(s.candidate));
            if (st.stato === CLOSED) out.push({ momento: s.moment.id, place_id: idOf(s.candidate), nome: nameOf(s.candidate), perche: st.motivo, arrivo: s.start });
        }
    }
    return out;
}

/** Lo stato d'orario ('noto' | 'sconosciuto') di ogni tappa messa in orario, per place_id: va nel tracciato. */
export function scheduleHoursLabels(sched) {
    const out = new Map();
    for (const day of sched?.days || []) {
        for (const s of day) {
            const st = openStatus(s.candidate, s.start, stayOf(s.candidate));
            out.set(idOf(s.candidate), st.stato === UNKNOWN ? 'sconosciuto' : 'noto');
        }
    }
    return out;
}

/** ORARI-FESTIVI — da quale orario viene lo stato di ogni tappa ('orario del giorno' | 'orario della settimana'), per place_id: va nel tracciato. */
export function scheduleHoursSources(sched) {
    const out = new Map();
    for (const day of sched?.days || []) {
        for (const s of day) {
            const st = openStatus(s.candidate, s.start, stayOf(s.candidate));
            if (st.fonte) out.set(idOf(s.candidate), st.fonte);
        }
    }
    return out;
}

/**
 * Sceglie, mette in orario e CONTROLLA gli orari veri; ogni posto chiuso quando
 * ci si arriva e' vietato per quel momento e si sceglie di nuovo, finche' il giro
 * e' tutto aperto (al massimo maxPasses volte).
 * @param {object} p
 * @param {() => object} p.repair   repairMomentSelection sui bucket SENZA i vietati (legge `veto`)
 * @param {(plan: Array) => object} p.schedule  scheduleMomentPlan
 * @param {Map<string, Set<string>>} p.veto  condiviso con chi costruisce i bucket
 * @returns {{ repaired, sched, giri: Array, residui: Array }} `residui`: posti ancora chiusi alla fine
 *   (non dovrebbero esserci: il chiamante li toglie, un posto chiuso non esce mai)
 */
export function settleOpeningHours({ repair, schedule, veto, maxPasses = 4 }) {
    let repaired = repair();
    let sched = schedule(repaired.plan);
    const giri = [];
    for (let i = 0; i < maxPasses; i++) {
        const chiusi = closedInSchedule(sched);
        if (chiusi.length === 0) break;
        for (const x of chiusi) {
            if (!veto.has(x.momento)) veto.set(x.momento, new Set());
            veto.get(x.momento).add(x.place_id);
        }
        giri.push(chiusi);
        repaired = repair();
        sched = schedule(repaired.plan);
    }
    return { repaired, sched, giri, residui: closedInSchedule(sched) };
}

// ─── 6. CONTINUITA' — nessun buco non dichiarato oltre 45 minuti ────────────
//
// Una tappa in piu' non e' mai un altro pasto: "nessuno pranza due volte". Con una richiesta
// tutta di ristoranti ("nei ristoranti tipici") ogni momento ha solo ristoranti: li' il buco
// non si riempie e si dichiara.
//
// Un momento comincia alla sua ora (il pranzo alle 12:30) anche se la tappa
// prima e' finita da un pezzo: l'attesa e' un buco. Prima di dichiararlo si
// prova a riempirlo con UNA tappa in piu' nel momento che lo contiene, con
// tutte le regole di sempre (la stessa repair: varieta', percorso, tetto di
// cammino, orari). Solo mattina, pomeriggio e dopocena (come il ritmo). Il tentativo vale solo se il giro ha una tappa vera in piu',
// meno minuti di buco, e NON peggiora niente: nessun ripiego, nessun tempo
// libero, nessuna tappa tolta in piu'. Altrimenti si torna indietro.

const mealCount = (sched) => (sched?.days || []).reduce((n, d) => n + d.filter(s => isMealPlace(s.candidate)).length, 0);
const cloneVeto = (veto) => new Map([...veto.entries()].map(([k, v]) => [k, new Set(v)]));
const restoreVeto = (veto, saved) => {
    veto.clear();
    for (const [k, v] of saved) veto.set(k, v);
};
const overlapMin = (aS, aE, bS, bE) => Math.max(0, (Math.min(aE, bE) - Math.max(aS, bS)) / 60000);

/** I momenti in cui si puo' mettere una tappa in piu' per chiudere un buco, dal piu' sovrapposto. */
export function momentsToExpand(gap, moments) {
    const dayTotal = moments.filter(m => m.dayIndex === gap.dayIndex).reduce((n, m) => n + m.stops, 0);
    if (dayTotal >= MAX_STOPS_PER_DAY) return [];
    return moments
        .filter(m => m.dayIndex === gap.dayIndex && EXPANDABLE_KEYS.has(m.key) && m.start instanceof Date)
        .map(m => ({ m, o: overlapMin(m.start.getTime(), m.end.getTime(), gap.from.getTime(), gap.to.getTime()) }))
        .filter(x => x.o >= 15)
        .sort((a, b) => b.o - a.o)
        .map(x => x.m);
}

/** Il momento in cui comincia il buco (dove sta la riga di tempo libero), o null. */
export function momentAt(moments, dayIndex, when) {
    const t = when.getTime();
    return moments.find(m => m.dayIndex === dayIndex && m.start instanceof Date && m.start.getTime() <= t && t < m.end.getTime()) || null;
}

/**
 * Riempie i buchi oltre GAP_MAX_MINUTES con tappe vere, una alla volta.
 * @param {object} p
 * @param {Array} p.moments        da flattenSkeleton (si alza `stops` di uno dove una tappa in piu' entra)
 * @param {object} p.repaired      l'uscita di repair() del piano di partenza
 * @param {object} p.sched         il piano messo in orario (scheduleMomentPlan, senza tappe chiuse)
 * @param {() => object} p.repair  repairMomentSelection sui bucket senza i vietati
 * @param {(plan: Array) => object} p.schedule scheduleMomentPlan
 * @param {Map<string, Set<string>>} p.veto condiviso con chi costruisce i bucket
 * @param {boolean} [p.espandi] false con ritmo Rilassato: niente tappe in piu', i buchi restano da dichiarare
 * @returns {{ repaired, sched, aggiunte: Array<{ momento, dayIndex, minutiPrima, minutiDopo }>, tentativi: number }}
 */
export function fillGaps({ moments, repaired, sched, repair, schedule, veto, espandi = true, maxPasses = 8 }) {
    let cur = { repaired, sched: retimeWaits(sched) };
    const aggiunte = [];
    let tentativi = 0;
    // Ritmo Rilassato (1 tappa per momento, scelta dell'utente): non si aggiungono tappe, il buco si dichiara.
    for (let pass = 0; espandi && pass < maxPasses; pass++) {
        const gaps = scheduleGaps(cur.sched).sort((a, b) => b.minutes - a.minutes);
        if (gaps.length === 0) break;
        let accepted = false;
        for (const gap of gaps) {
            for (const m of momentsToExpand(gap, moments)) {
                tentativi += 1;
                const saved = { stops: m.stops, veto: cloneVeto(veto) };
                m.stops += 1;
                const trial = settleOpeningHours({ repair, schedule, veto });
                const trialSched = retimeWaits(trial.sched);
                const rep = trial.repaired.report;
                const was = cur.repaired.report;
                const better = trial.residui.length === 0
                    && mealCount(trialSched) <= mealCount(cur.sched)
                    && realStopCount(trialSched) > realStopCount(cur.sched)
                    && totalGapMinutes(trialSched) < totalGapMinutes(cur.sched)
                    && (rep.ripieghi?.length ?? 0) <= (was.ripieghi?.length ?? 0)
                    && (rep.tempoLibero?.length ?? 0) <= (was.tempoLibero?.length ?? 0)
                    && trialSched.tolte.length <= cur.sched.tolte.length;
                if (better) {
                    aggiunte.push({ momento: m.id, dayIndex: m.dayIndex, minutiPrima: totalGapMinutes(cur.sched), minutiDopo: totalGapMinutes(trialSched) });
                    cur = { repaired: trial.repaired, sched: trialSched };
                    accepted = true;
                    break;
                }
                m.stops = saved.stops;
                restoreVeto(veto, saved.veto);
            }
            if (accepted) break;
        }
        if (!accepted) break;
    }
    return { repaired: cur.repaired, sched: cur.sched, aggiunte, tentativi };
}

/**
 * CONTINUITA' — i buchi rimasti dopo il tentativo di riempirli, come righe di
 * tempo libero (stesso formato di report.tempoLibero), ancorate alla tappa che
 * segue (`prima`). Un buco gia' coperto da una riga esistente (regola O, momento
 * chiuso) che cade dentro di lui non ne riceve una seconda.
 * @returns {Array} righe con `buco` = minuti
 */
export function gapRows({ moments, sched, tempoLibero = [] }) {
    const rows = [];
    for (const g of scheduleGaps(sched)) {
        const gia = (tempoLibero || []).some(e => e.dayIndex === g.dayIndex
            && moments.some(m => m.id === e.momento && overlapMin(m.start.getTime(), m.end.getTime(), g.from.getTime(), g.to.getTime()) > 0));
        if (gia) continue;
        let m = momentAt(moments, g.dayIndex, g.from) || g.prev.moment;
        // Un pasto saltato (nessun locale) non rientra dal buco: senza tappe nel suo momento, la riga sta con la tappa prima.
        if (FOOD_ONLY_MOMENT_KEYS.has(m.key) && !(sched.days[g.dayIndex] || []).some(x => x.moment.id === m.id)) m = g.prev.moment;
        rows.push({
            momento: m.id, key: m.key, label: m.label, dayIndex: g.dayIndex, posto: 0,
            dopo: nameOf(g.prev.candidate), prima: idOf(g.next.candidate), piuVicino: null,
            chiuso: false, pasto: false, buco: g.minutes,
            motivo: `${g.minutes} min fra "${nameOf(g.prev.candidate)}" e "${nameOf(g.next.candidate)}": nessuna tappa in piu' da aggiungere (varieta', percorso e orari)`,
        });
    }
    return rows;
}

/** Toglie dal piano messo in orario le tappe indicate (per place_id e momento): l'ultima rete, mai una tappa chiusa. */
export function dropFromSchedule(sched, drop) {
    const keys = new Set(drop.map(x => `${x.momento}|${x.place_id}`));
    return { ...sched, days: sched.days.map(day => day.filter(s => !keys.has(`${s.moment.id}|${idOf(s.candidate)}`))) };
}

/**
 * Un filtro non lascia mai un buco: per ogni momento che doveva avere tappe, e
 * non ne ha, e che ha perso dei posti per gli orari, una riga dichiarata.
 * Non pasto → tempo libero (regola O). Pranzo/cena → "nessun locale aperto qui
 * vicino a quest'ora" (pasto: true). Stesso formato di report.tempoLibero.
 */
export function closedMomentRows({ moments, sched, tempoLibero = [], chiusiPerMomento }) {
    const have = new Set((sched?.days || []).flat().map(s => s.moment.id));
    const already = new Set((tempoLibero || []).map(x => x.momento));
    const rows = [];
    for (const m of moments) {
        if (!(m.stops > 0) || have.has(m.id) || already.has(m.id) || !chiusiPerMomento?.has(m.id)) continue;
        rows.push({
            momento: m.id, key: m.key, label: m.label, dayIndex: m.dayIndex, posto: 0, dopo: null, piuVicino: null,
            chiuso: true, pasto: FOOD_ONLY_MOMENT_KEYS.has(m.key),
            motivo: 'tutti i posti del momento sono chiusi quando ci si arriva',
        });
    }
    return rows;
}

