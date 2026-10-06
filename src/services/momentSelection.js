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
 *      DNA); a parita' di merito, il piu' vicino alla tappa precedente;
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
import { resolveStayMinutes, travelMinutes } from '../lib/tourTiming';

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
 *   e ogni candidato vale per ogni momento — gli orari restano.
 * @returns {Map<string, Array>} id momento → candidati ammessi (ordine del pool)
 */
export function bucketCandidates(moments, candidates, { anyCategory = false } = {}) {
    const pool = Array.isArray(candidates) ? candidates.filter(idOf) : [];
    const cats = new Map(pool.map(c => [idOf(c), candidateMomentCategories(c)]));
    const buckets = new Map();
    for (const m of moments) {
        buckets.set(m.id, anyCategory
            ? [...pool]
            : pool.filter(c => (m.categories || []).some(k => cats.get(idOf(c)).has(k))));
    }
    return buckets;
}

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
 * @returns {{ plan: Array<{ moment: object, stops: Array<{ candidate: object,
 *   narration: object|null, source: 'modello'|'riparata' }> }>,
 *   report: { scartate: Array, riempite: Array, momentiTolti: Array } }}
 */
export function repairMomentSelection({ moments, buckets, aiStops, pool, dnaWeights = {} }) {
    const report = { scartate: [], riempite: [], momentiTolti: [] };
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
    let prev = null;
    for (const m of moments) {
        const bucket = buckets.get(m.id) || [];
        const inBucket = new Map(bucket.map(c => [idOf(c), c]));
        const chosen = [];
        const take = (s, c) => {
            chosen.push({ candidate: c, narration: s, source: 'modello' });
            used.add(idOf(c));
        };
        const reject = (s, motivo) => report.scartate.push({ place_id: s.place_id, momento: m.id, motivo });

        for (const s of byMoment.get(m.id)) {
            const c = inBucket.get(s.place_id);
            if (chosen.length >= m.stops) { reject(s, 'oltre il numero di tappe'); continue; }
            if (!poolIds.has(s.place_id)) { reject(s, 'luogo non fra i candidati'); continue; }
            if (!c) { reject(s, 'fuori dal suo momento'); continue; }
            if (used.has(s.place_id)) { reject(s, 'gia\' usato'); continue; }
            if (!hasDescription(s)) { reject(s, 'senza descrizione'); continue; }
            take(s, c);
        }
        for (let i = 0; i < unassigned.length && chosen.length < m.stops; i++) {
            const s = unassigned[i];
            const c = inBucket.get(s.place_id);
            if (!c || used.has(s.place_id) || !hasDescription(s)) continue;
            take(s, c);
            unassigned.splice(i, 1);
            i -= 1;
        }

        // Posti vuoti: merito, poi vicinanza alla tappa precedente.
        const last = () => (chosen.length ? chosen[chosen.length - 1].candidate : prev);
        while (chosen.length < m.stops) {
            const free = bucket.filter(c => !used.has(idOf(c)));
            if (free.length === 0) break;
            const from = last();
            free.sort((a, b) => (scoreOf(b) - scoreOf(a)) || (walkFrom(from, a) - walkFrom(from, b)));
            const c = free[0];
            chosen.push({ candidate: c, narration: narrationById.get(idOf(c)) || null, source: 'riparata' });
            used.add(idOf(c));
            report.riempite.push({ place_id: idOf(c), name: c.name || c.title || null, momento: m.id });
        }

        if (chosen.length === 0) {
            report.momentiTolti.push({ momento: m.id, label: m.label, motivo: 'nessun candidato valido' });
            continue;
        }
        plan.push({ moment: m, stops: chosen });
        prev = chosen[chosen.length - 1].candidate;
    }
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
