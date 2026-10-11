/**
 * C5 — la forma del percorso a piedi di una giornata.
 *
 * Misure su una sequenza di tappe con coordinate, nell'ordine in cui si
 * camminano: km totali, incroci del tracciato, indice di avanti-e-indietro
 * (cammino reale / cammino minimo sulle stesse tappe: libero in C5, con
 * l'ordine dei momenti in C5b) e marchi ripetuti
 * (due locali della stessa catena nello stesso giorno).
 *
 * Puro e senza import: lo usano il motore (momentSelection, tracciato) e il
 * banco (scripts/banco/misure.js, che gira anche fuori da Vite).
 */

const latOf = (p) => Number(p?.latitude ?? p?.lat);
const lngOf = (p) => Number(p?.longitude ?? p?.lng);
const hasCoords = (p) => Number.isFinite(latOf(p)) && Number.isFinite(lngOf(p));

/** Distanza in km fra due tappe (haversine); null senza coordinate. */
export function legKm(a, b) {
    if (!hasCoords(a) || !hasCoords(b)) return null;
    const r = (x) => (x * Math.PI) / 180;
    const dLat = r(latOf(b) - latOf(a));
    const dLng = r(lngOf(b) - lngOf(a));
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(latOf(a))) * Math.cos(r(latOf(b))) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Km totali lungo la sequenza (i tratti senza coordinate non contano). */
export function pathKm(stops) {
    let km = 0;
    for (let i = 1; i < (stops || []).length; i++) km += legKm(stops[i - 1], stops[i]) ?? 0;
    return km;
}

// ─── Incroci ─────────────────────────────────────────────────────────────────
// Su scala di citta' il piano locale basta: x = longitudine * cos(latitudine).
const orient = (p, q, r) => {
    const v = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    return Math.abs(v) < 1e-12 ? 0 : Math.sign(v);
};

/**
 * Quante volte il tracciato si taglia: coppie di tratti non consecutivi che si
 * intersecano in un punto interno. Due tratti che si toccano solo agli estremi
 * (una tappa ripassata) non contano come incrocio.
 */
export function countCrossings(stops) {
    return crossingPairs(stops).length;
}

/** C5b — le coppie di tratti che si tagliano: [i, j] = tratto i→i+1 e tratto j→j+1 (indici sulle tappe con coordinate). */
export function crossingPairs(stops) {
    const pts = (stops || []).filter(hasCoords);
    if (pts.length < 4) return [];
    const k = Math.cos((latOf(pts[0]) * Math.PI) / 180);
    const P = pts.map(p => ({ x: lngOf(p) * k, y: latOf(p) }));
    const out = [];
    for (let i = 0; i + 1 < P.length; i++) {
        for (let j = i + 2; j + 1 < P.length; j++) {
            const [a, b, c, d] = [P[i], P[i + 1], P[j], P[j + 1]];
            const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
            if (o1 && o2 && o3 && o4 && o1 !== o2 && o3 !== o4) out.push([i, j]);
        }
    }
    return out;
}

// ─── Cammino minimo ──────────────────────────────────────────────────────────

/**
 * Il cammino piu' corto che tocca tutte le tappe una volta, partenza e arrivo
 * liberi (Held-Karp, esatto fino a 12 tappe; oltre, vicino piu' vicino + 2-opt).
 * E' il riferimento piu' severo: nessun orario, nessun pasto da rispettare.
 */
export function minimalPathKm(stops) {
    const pts = (stops || []).filter(hasCoords);
    const n = pts.length;
    if (n < 2) return 0;
    const D = pts.map(a => pts.map(b => legKm(a, b)));
    if (n > 12) return pathCost(twoOpt(nearestNeighbour(D, 0), D), D);
    const FULL = 1 << n;
    const dp = Array.from({ length: FULL }, () => new Float64Array(n).fill(Infinity));
    for (let i = 0; i < n; i++) dp[1 << i][i] = 0;
    for (let mask = 1; mask < FULL; mask++) {
        for (let i = 0; i < n; i++) {
            const cur = dp[mask][i];
            if (!Number.isFinite(cur) || !(mask & (1 << i))) continue;
            for (let j = 0; j < n; j++) {
                if (mask & (1 << j)) continue;
                const nm = mask | (1 << j);
                if (cur + D[i][j] < dp[nm][j]) dp[nm][j] = cur + D[i][j];
            }
        }
    }
    return Math.min(...dp[FULL - 1]);
}

const pathCost = (order, D) => order.slice(1).reduce((s, x, i) => s + D[order[i]][x], 0);
const nearestNeighbour = (D, start) => {
    const left = new Set(D.map((_, i) => i));
    const order = [start];
    left.delete(start);
    while (left.size) {
        const last = order.at(-1);
        const next = [...left].reduce((b, x) => (D[last][x] < D[last][b] ? x : b));
        order.push(next);
        left.delete(next);
    }
    return order;
};
const twoOpt = (order, D) => {
    let best = order;
    for (let improved = true; improved;) {
        improved = false;
        for (let i = 0; i < best.length - 1; i++) {
            for (let j = i + 1; j < best.length; j++) {
                const cand = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
                if (pathCost(cand, D) < pathCost(best, D) - 1e-9) { best = cand; improved = true; }
            }
        }
    }
    return best;
};

/**
 * C5b — il cammino minimo che rispetta l'ordine dei momenti. Le tappe
 * consecutive con lo stesso `moment` formano un gruppo; i gruppi restano nel
 * loro ordine (un pasto e' un gruppo da una tappa: un'ancora fissa) e si
 * cerca solo l'ordine migliore DENTRO ogni gruppo. Esatto: per gruppo si
 * provano tutti gli ordini (al massimo 4 tappe per momento = 24), con un
 * cammino dinamico sull'ultima tappa del gruppo prima. Senza `moment` ogni
 * tappa e' un gruppo a se': il minimo e' il cammino stesso.
 */
export function anchoredMinimalPathKm(stops) {
    const pts = (stops || []).filter(hasCoords);
    if (pts.length < 2) return 0;
    const groups = [];
    for (const p of pts) {
        const g = groups.at(-1);
        if (g && p.moment != null && g[0].moment === p.moment) g.push(p);
        else groups.push([p]);
    }
    // best: Map tappa finale → km minimi per arrivarci con tutti i gruppi fin qui.
    let best = new Map([[null, 0]]);
    for (const g of groups) {
        const next = new Map();
        for (const order of permutations(g)) {
            const inner = pathKm(order);
            const end = order.at(-1);
            for (const [from, km] of best) {
                const tot = km + (from ? legKm(from, order[0]) : 0) + inner;
                if (!next.has(end) || tot < next.get(end)) next.set(end, tot);
            }
        }
        best = next;
    }
    return Math.min(...best.values());
}

function permutations(xs) {
    if (xs.length <= 1) return [xs];
    return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map(rest => [x, ...rest]));
}

/**
 * Indice di avanti-e-indietro: cammino reale / cammino minimo sulle stesse
 * tappe. 1 = gia' il giro piu' corto; null con meno di 3 tappe con coordinate
 * (con due tappe c'e' un solo cammino).
 * `{ ancorato: true }` (C5b) misura contro il minimo che rispetta l'ordine dei
 * momenti (anchoredMinimalPathKm); senza, contro il minimo libero (C5).
 */
export function backtrackIndex(stops, { ancorato = false } = {}) {
    const pts = (stops || []).filter(hasCoords);
    if (pts.length < 3) return null;
    const min = ancorato ? anchoredMinimalPathKm(pts) : minimalPathKm(pts);
    return min > 0 ? pathKm(pts) / min : null;
}

/** C5b — sotto questi km un giro e' "corto": l'indice non si giudica, contano gli incroci. */
export const SHORT_ROUTE_KM = 2;

// ─── C5c — deviazione per tappa: lo zig-zag che si vede sulla mappa ─────────
//
// Per ogni tappa intermedia B fra A (prima) e C (dopo), anche a cavallo fra
// due momenti: deviazione = (A→B + B→C) − A→C, in minuti a piedi. Zero = B sta
// sulla linea; un'andata-e-ritorno verso B costa due volte la distanza dalla
// linea. In minuti, non in proporzione: 100 m di zig-zag restano 100 m, su un
// giro di 1 km come su uno di 5. La prima e l'ultima tappa non hanno una
// deviazione (manca A o C). Velocita' a piedi: la stessa di tourTiming
// (WALKING_KMH = 4,5; un test le lega).
export const DETOUR_WALK_KMH = 4.5;

/**
 * Le deviazioni delle tappe intermedie, nell'ordine del giro.
 * @returns {Array<{ indice: number, minuti: number, titolo: string|null, momento: string|null }>}
 *   `indice` e' la posizione nella sequenza passata; tappe senza coordinate (o
 *   con un vicino senza coordinate) restano fuori.
 */
export function stopDetours(stops) {
    const out = [];
    const s = stops || [];
    for (let i = 1; i + 1 < s.length; i++) {
        const ab = legKm(s[i - 1], s[i]), bc = legKm(s[i], s[i + 1]), ac = legKm(s[i - 1], s[i + 1]);
        if (ab === null || bc === null || ac === null) continue;
        out.push({
            indice: i,
            minuti: Math.max(0, ((ab + bc - ac) / DETOUR_WALK_KMH) * 60),
            titolo: s[i].name || s[i].title || null,
            momento: s[i].moment ?? null,
        });
    }
    return out;
}

// ─── Marchi (catene) ─────────────────────────────────────────────────────────
//
// Due locali della stessa catena nello stesso giorno ("Origano Trevi" +
// "Origano Campo de' Fiori"). Il marchio si legge dal nome: le parole generiche
// iniziali (il tipo di locale, articoli, preposizioni) piu' la prima parola
// distintiva. Il tipo di locale resta nella chiave: "Pizzeria Navona" e
// "Osteria Navona" sono due posti, non una catena. Vale solo per i locali
// (mangiare, bere, comprare): due chiese "Santa Maria …" non sono una catena.
const ARTICOLI = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'l', 'un', 'una', 'the', 'da', 'dal', 'dalla', 'dai', 'al', 'alla', 'allo', 'ai', 'agli', 'alle', 'di', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'e', 'ed', 'and', 'de']);
const GENERICHE = new Set(['ristorante', 'trattoria', 'osteria', 'hostaria', 'pizzeria', 'bar', 'caffe', 'cafe', 'caffetteria', 'pasticceria',
    'gelateria', 'enoteca', 'bistrot', 'bistro', 'taverna', 'locanda', 'forno', 'antico', 'antica', 'vecchia', 'vecchio', 'wine', 'cocktail',
    'pub', 'birreria', 'braceria', 'panificio', 'gastronomia', 'salumeria', 'friggitoria', 'rosticceria', 'tavola', 'calda', 'pizza', 'cucina',
    'ristorantino', 'paninoteca', 'cantina', 'lounge', 'restaurant', 'ristobar', 'gelato', 'pasta', 'sushi', 'kebab', 'burger']);
const COMMERCIAL_TYPES = new Set(['restaurant', 'food', 'meal_takeaway', 'meal_delivery', 'bakery', 'cafe', 'bar', 'night_club', 'store',
    'clothing_store', 'shoe_store', 'jewelry_store', 'book_store', 'shopping_mall', 'department_store', 'liquor_store', 'supermarket']);

/** Un locale: un posto dove si mangia, si beve o si compra. */
export const isCommercialPlace = (p) => (Array.isArray(p?.types) ? p.types : []).some(t => COMMERCIAL_TYPES.has(t));

/** La chiave del marchio di un locale ("|origano"), o null se non e' un locale o il nome non ne ha una. */
export function brandKey(p) {
    if (!isCommercialPlace(p)) return null;
    const words = String(p?.name || p?.title || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .split(/[^a-z0-9]+/).filter(Boolean);
    const prefix = [];
    for (const w of words) {
        if (ARTICOLI.has(w)) continue;
        if (GENERICHE.has(w)) { prefix.push(w); continue; }
        return w.length >= 3 ? `${prefix.join(' ')}|${w}` : null;
    }
    return null;
}

/** Le coppie di locali con lo stesso marchio nella sequenza (luoghi diversi). */
export function repeatedBrands(stops) {
    const seen = new Map();
    const out = [];
    for (const s of stops || []) {
        const k = brandKey(s);
        if (!k) continue;
        const id = s.place_id || s.googlePlaceId || s.name || s.title;
        const prima = seen.get(k);
        if (prima && prima.id !== id) out.push({ marchio: k.split('|')[1], tappe: [prima.nome, s.name || s.title] });
        else if (!prima) seen.set(k, { id, nome: s.name || s.title });
    }
    return out;
}

const r2 = (x) => (x === null ? null : Math.round(x * 100) / 100);

/**
 * Le misure di una giornata, arrotondate per il report.
 *   indice        C5b: contro il cammino minimo con l'ordine dei momenti; null
 *                 su un giro corto (sotto `corto` km: "giro corto, indice non
 *                 applicato") o con meno di 3 tappe;
 *   indiceLibero  C5: contro il cammino minimo libero, sempre (per confronto).
 */
export function routeMetrics(stops, { corto = SHORT_ROUTE_KM } = {}) {
    const km = pathKm(stops);
    const giroCorto = km < corto;
    return {
        tappe: (stops || []).length,
        km: r2(km),
        incroci: countCrossings(stops),
        indice: giroCorto ? null : r2(backtrackIndex(stops, { ancorato: true })),
        indiceLibero: r2(backtrackIndex(stops)),
        giroCorto,
        catene: repeatedBrands(stops).length,
    };
}
