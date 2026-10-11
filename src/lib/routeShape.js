/**
 * C5 — la forma del percorso a piedi di una giornata.
 *
 * Misure su una sequenza di tappe con coordinate, nell'ordine in cui si
 * camminano: km totali, incroci del tracciato, indice di avanti-e-indietro
 * (cammino reale / cammino minimo sulle stesse tappe) e marchi ripetuti
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
    const pts = (stops || []).filter(hasCoords);
    if (pts.length < 4) return 0;
    const k = Math.cos((latOf(pts[0]) * Math.PI) / 180);
    const P = pts.map(p => ({ x: lngOf(p) * k, y: latOf(p) }));
    let n = 0;
    for (let i = 0; i + 1 < P.length; i++) {
        for (let j = i + 2; j + 1 < P.length; j++) {
            const [a, b, c, d] = [P[i], P[i + 1], P[j], P[j + 1]];
            const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
            if (o1 && o2 && o3 && o4 && o1 !== o2 && o3 !== o4) n++;
        }
    }
    return n;
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
 * Indice di avanti-e-indietro: cammino reale / cammino minimo sulle stesse
 * tappe. 1 = gia' il giro piu' corto; null con meno di 3 tappe con coordinate
 * (con due tappe c'e' un solo cammino).
 */
export function backtrackIndex(stops) {
    const pts = (stops || []).filter(hasCoords);
    if (pts.length < 3) return null;
    const min = minimalPathKm(pts);
    return min > 0 ? pathKm(pts) / min : null;
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

/** Le quattro misure di una giornata, arrotondate per il report. */
export function routeMetrics(stops) {
    const idx = backtrackIndex(stops);
    return {
        tappe: (stops || []).length,
        km: Math.round(pathKm(stops) * 100) / 100,
        incroci: countCrossings(stops),
        indice: idx === null ? null : Math.round(idx * 100) / 100,
        catene: repeatedBrands(stops).length,
    };
}
