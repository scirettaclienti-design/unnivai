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
 *      famiglia al giorno, salvo richiesta) — per il modello come per il codice;
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
import { resolveStayMinutes, travelMinutes, WALKING_KMH } from '../lib/tourTiming';
import { FOOD_ONLY_MOMENT_KEYS } from '../lib/daySkeleton';

// ─── Categorie dello scheletro, dai types Google ─────────────────────────────
//
// Il vocabolario e' quello di dayMoments.js (cultura, monumenti, musei,
// passeggiata, cibo, natura, shopping, bar, punti panoramici, vita notturna).
// Un luogo puo' stare in piu' categorie: una chiesa e' cultura e monumento.
//
// Scelte dichiarate:
//   · un posto con `restaurant` e' CIBO e non bar, anche se Google gli mette
//     anche `bar`: all'aperitivo non si porta qualcuno a cena. Il tetto "al
//     massimo pranzo e cena di cibo" dipende da questa riga.
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
};

const PANORAMA_NAME = /\b(belvedere|terrazz[ae]|panoram\w*|affaccio)\b/i;
const WALK_NAME = /^(piazza|piazzale|via|vicolo|largo|lungotevere|lungomare|lungarno|ponte|scalinata|passeggiata)\b/i;

/** Le categorie dello scheletro a cui un candidato appartiene. */
export function candidateMomentCategories(candidate) {
    const types = Array.isArray(candidate?.types) ? candidate.types : [];
    const out = new Set();
    for (const t of types) for (const c of TYPE_CATEGORIES[t] || []) out.add(c);
    // Un ristorante con anche `bar` resta cibo e basta (vedi sopra).
    if (types.includes('restaurant')) { out.delete('bar'); out.delete('vita notturna'); }
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
// Lo stesso tetto in metri: il bias della ricerca mirata dei pasti.
export const MAX_WALK_METERS = Math.round((MAX_WALK_MINUTES / 60) * WALKING_KMH * 1000);

// Le famiglie di tappa: al massimo una per famiglia per giorno, salvo richiesta.
// Una sola famiglia per luogo, nell'ordine della lista (un belvedere in un
// parco e' panorama, una piazza con un giardino e' piazza). Un posto dove mangiare non ha famiglia: i pasti hanno
// gia' il loro momento.
const CHURCH_TYPES = ['church', 'place_of_worship', 'synagogue', 'mosque', 'hindu_temple'];
const FAMILY_RULES = [
    ['panorama', (types, name) => PANORAMA_NAME.test(name)],
    // Il nome prima dei types: Google mette `park` a Piazza d'Aracoeli.
    ['piazza', (types, name) => /^(piazza|piazzale|largo)\b/i.test(name)],
    ['chiesa', (types, name) => types.some(t => CHURCH_TYPES.includes(t)) || /^(chiesa|basilica|duomo|cattedrale|santuario|abbazia)\b/i.test(name)],
    ['museo', (types, name) => types.includes('museum') || types.includes('art_gallery') || /^(museo|pinacoteca)\b/i.test(name)],
    ['verde', (types, name) => types.includes('park') || types.includes('natural_feature') || /^(parco|giardin[oi]|orto botanico|villa comunale)\b/i.test(name)],
];

/** La famiglia di un candidato (panorama, chiesa, museo, verde, piazza) o null. */
export function candidateFamily(candidate) {
    if (isMealPlace(candidate)) return null;
    const types = Array.isArray(candidate?.types) ? candidate.types : [];
    const name = String(candidate?.name || candidate?.title || '').trim();
    return FAMILY_RULES.find(([, test]) => test(types, name))?.[0] || null;
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

/** Tetto alle ricerche mirate per generazione (vincolo: oggi + 2). */
export const MAX_EXTRA_SEARCHES = 2;

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
        buckets.set(m.id, anyCategory && !FOOD_ONLY_MOMENT_KEYS.has(m.key)
            ? pool.filter(c => !mealOnlyIds?.has(idOf(c)))
            : pool.filter(c => (m.categories || []).some(k => cats.get(idOf(c)).has(k))));
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
        const theme = (m.categories || []).map(c => MOMENT_CATEGORY_TO_THEME[c]).find(Boolean);
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
        const theme = (m.categories || []).map(c => MOMENT_CATEGORY_TO_THEME[c]).find(Boolean);
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
    const c = before.length ? before[before.length - 1].stops.at(-1).candidate : after[0]?.stops[0]?.candidate;
    const lat = c?.latitude ?? c?.lat;
    const lng = c?.longitude ?? c?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng, name: c.name || c.title || null };
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
 * @returns {{ plan: Array<{ moment: object, stops: Array<{ candidate: object,
 *   narration: object|null, source: 'modello'|'riparata', trace: { scelta:
 *   'modello'|'riparazione'|'ripiego', minuti: number|null, famiglia: string|null,
 *   motivo?: string } }> }>,
 *   report: { scartate: Array, riempite: Array, momentiTolti: Array, ripieghi: Array } }}
 */
export function repairMomentSelection({ moments, buckets, aiStops, pool, dnaWeights = {}, requestedFamilies: asked = null, maxWalk = MAX_WALK_MINUTES }) {
    const report = { scartate: [], riempite: [], momentiTolti: [], ripieghi: [] };
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
    moments.forEach((m, mi) => {
        if (m.dayIndex !== day) { day = m.dayIndex; prev = null; dayFamilies = new Set(); }
        const bucket = buckets.get(m.id) || [];
        const inBucket = new Map(bucket.map(c => [idOf(c), c]));
        const later = moments.slice(mi + 1).filter(x => x.dayIndex === m.dayIndex && x.stops > 0);
        const chosen = [];
        const last = () => (chosen.length ? chosen[chosen.length - 1].candidate : prev);
        const free = (except) => bucket.filter(c => !used.has(idOf(c)) && idOf(c) !== except);

        // Il "costo" di un candidato come prossima tappa, in ordine di peso:
        //   over   oltre il tetto di cammino dalla tappa prima (e quanto: fra
        //          candidati tutti oltre, vince il piu' vicino — il ripiego);
        //   dup    la sua famiglia c'e' gia' oggi;
        //   starve prenderlo lascerebbe un momento dopo senza nessuna famiglia
        //          nuova (tre belvederi possibili all'aperitivo e nient'altro:
        //          il belvedere della mattina glielo ruberebbe);
        //   strand il momento subito dopo non avrebbe nessuna tappa entro il
        //          tetto da lui e di famiglia nuova (all'aperitivo solo
        //          belvederi vicini: il belvedere del pomeriggio obbliga a
        //          ripetere). Esatto: lui sara' la tappa prima.
        // La distanza pesa piu' della varieta': meglio una seconda chiesa a 5
        // minuti che una famiglia nuova a 40.
        const okFam = (x, fams) => !counted(famOf(x)) || !fams.has(famOf(x));
        const famsWith = (c) => (counted(famOf(c)) ? new Set([...dayFamilies, famOf(c)]) : dayFamilies);
        const restOf = (lm, c) => (buckets.get(lm.id) || []).filter(x => !used.has(idOf(x)) && idOf(x) !== idOf(c));
        const starves = (c) => counted(famOf(c)) && later.some(lm => {
            const rest = restOf(lm, c);
            return rest.some(x => okFam(x, dayFamilies)) && !rest.some(x => okFam(x, famsWith(c)));
        });
        const next = later[0] || null;
        const strands = (c) => !!next && chosen.length === m.stops - 1
            && !restOf(next, c).some(x => walkFrom(c, x) <= maxWalk && okFam(x, famsWith(c)));
        const costOf = (c) => {
            const from = last();
            const t = from ? walkFrom(from, c) : 0;
            const over = from && t > maxWalk ? 1 : 0;
            return { t, key: [over, over ? t : 0, okFam(c, dayFamilies) ? 0 : 1, starves(c) ? 1 : 0, strands(c) ? 1 : 0] };
        };
        const cmpKey = (a, b) => {
            for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
            return 0;
        };
        // Il miglior candidato libero del momento (escluso `except`), col suo costo.
        const best = (except) => {
            const ranked = free(except).map(c => ({ c, ...costOf(c) }));
            ranked.sort((a, b) => cmpKey(a.key, b.key) || (scoreOf(b.c) - scoreOf(a.c)) || (a.t - b.t));
            return ranked[0] || null;
        };
        // Perche' una scelta del modello perde contro l'alternativa migliore.
        const whyWorse = (k, c, t) => {
            if (k[0]) return `oltre il tetto di cammino (${Number.isFinite(t) ? t : '?'} min > ${maxWalk})`;
            if (k[2]) return `famiglia gia' presente nel giorno (${famOf(c)})`;
            if (k[3]) return `toglie l'unica alternativa a un momento dopo (${famOf(c)})`;
            return 'dopo di lui nessuna tappa nuova entro il tetto';
        };
        const take = (c, narration, source, cost) => {
            const [over, , dup] = cost.key;
            const from = last();
            const trace = {
                scelta: over || dup ? 'ripiego' : (source === 'modello' ? 'modello' : 'riparazione'),
                minuti: from && Number.isFinite(cost.t) ? cost.t : null,
                famiglia: famOf(c),
            };
            if (over || dup) {
                trace.motivo = over
                    ? `nessun candidato entro ${maxWalk} min: il piu' vicino`
                    : `nessuna famiglia nuova vicina: ${famOf(c)} ripetuta`;
                report.ripieghi.push({ place_id: idOf(c), name: c.name || c.title || null, momento: m.id, motivo: trace.motivo });
            }
            chosen.push({ candidate: c, narration, source, trace });
            used.add(idOf(c));
            if (counted(famOf(c))) dayFamilies.add(famOf(c));
        };
        // C1 — una scelta del modello vale se nessuna alternativa del momento
        // costa meno (vedi costOf): il tetto e la varieta' valgono anche per lui.
        const modelWins = (c) => {
            const mine = costOf(c);
            const alt = best(idOf(c));
            return { ok: !alt || cmpKey(mine.key, alt.key) <= 0, mine };
        };
        const reject = (s, motivo) => report.scartate.push({ place_id: s.place_id, momento: m.id, motivo });

        for (const s of byMoment.get(m.id)) {
            const c = inBucket.get(s.place_id);
            if (chosen.length >= m.stops) { reject(s, 'oltre il numero di tappe'); continue; }
            if (!poolIds.has(s.place_id)) { reject(s, 'luogo non fra i candidati'); continue; }
            if (!c) { reject(s, 'fuori dal suo momento'); continue; }
            if (used.has(s.place_id)) { reject(s, 'gia\' usato'); continue; }
            const { ok, mine } = modelWins(c);
            if (!ok) { reject(s, whyWorse(mine.key, c, mine.t)); continue; }
            // Gate NARRATORE-DOPO — il selettore non scrive testi: una tappa
            // vale per il suo luogo e il suo momento. Il racconto arriva dopo,
            // dal narratore, sulle tappe finali.
            take(c, s, 'modello', mine);
        }
        for (let i = 0; i < unassigned.length && chosen.length < m.stops; i++) {
            const s = unassigned[i];
            const c = inBucket.get(s.place_id);
            if (!c || used.has(s.place_id)) continue;
            const { ok, mine } = modelWins(c);
            if (!ok) continue;
            take(c, s, 'modello', mine);
            unassigned.splice(i, 1);
            i -= 1;
        }

        // Posti vuoti: tetto, varieta', poi merito; a parita', il piu' vicino.
        while (chosen.length < m.stops) {
            const b = best(null);
            if (!b) break;
            take(b.c, narrationById.get(idOf(b.c)) || null, 'riparata', b);
            report.riempite.push({ place_id: idOf(b.c), name: b.c.name || b.c.title || null, momento: m.id });
        }

        if (chosen.length === 0) {
            report.momentiTolti.push({ momento: m.id, label: m.label, motivo: 'nessun candidato valido' });
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
            const stay = resolveStayMinutes(s.candidate?.types);
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
