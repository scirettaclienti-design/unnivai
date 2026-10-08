// Gate MERITO — selezione tappe non piu' guidata dal numero di recensioni.
//
// Prima: fetchRealPOICandidates ordinava per qualityScore = rating * ln(1+reviews),
// e il taglio a 20 (dopo raggio+categoria, vedi Gate TAGLIO-DOPO-CATEGORIA in
// aiRecommendationService.js) prendeva i "migliori" per quel punteggio. Un posto
// con 5.000 recensioni batteva sempre un posto con 180, anche se quest'ultimo
// aveva un voto piu' alto — le recensioni pesavano come merito, non solo come
// prova di esistenza.
//
// Ora: le recensioni diventano un FILTRO di qualita' (soglia, non classifica). Il
// pool che supera la soglia viene ordinato da un punteggio che combina affinita'
// DNA, unicita' del posto e voto (mai il numero di recensioni). La categoria
// richiesta resta un vincolo di CODICE a monte (candidateMatchesIntentCategoria),
// invariato: questo modulo non la applica e non la bypassa.
//
// Le tre costanti di peso (0.45/0.35/0.20) e le soglie di qualita' sono
// DICHIARATAMENTE PROVVISORIE — nessun dato di prodotto le ha ancora tarate,
// vanno riviste dopo il lancio con dati reali di conversione/soddisfazione.

import { isSmallTown } from './tourShape';
import { mapTypeToCoreCategory } from './preferenceEngine';

// ─── Soglia di qualita' (filtro, non classifica) ────────────────────────────
export const QUALITY_THRESHOLDS = {
    topCity: { minRating: 4.2, minReviews: 20 },
    smallTown: { minRating: 4.0, minReviews: 10 },
};

export const passesQualityThreshold = (candidate, city) => {
    const rating = Number(candidate?.rating) || 0;
    const reviews = Number(candidate?.user_ratings_total) || 0;
    const t = isSmallTown(city) ? QUALITY_THRESHOLDS.smallTown : QUALITY_THRESHOLDS.topCity;
    return rating >= t.minRating && reviews >= t.minReviews;
};

// ─── Vocabolario Places → CORE_CATEGORIES (sola lettura) ────────────────────
//
// P7a — una sola mappa dei tipi per tutto il DNA: quella di preferenceEngine
// (mapTypeToCoreCategory), che e' anche quella con cui il DNA impara dalle
// tappe. Qui, per l'affinita' di un CANDIDATO, i tipi generici
// (point_of_interest, establishment) restano senza categoria: zero segnale,
// non segnale contrario.
const CORE_CATEGORIES = ['cultura', 'food', 'nightlife', 'natura', 'avventura', 'shopping', 'relax', 'arte'];

// Esportato per test/riuso. Categoria del `type`, o null.
export const mapPlaceTypeToCoreCategory = (type) => mapTypeToCoreCategory(type);

// Ritorna l'insieme (Set) di CORE_CATEGORIES a cui il candidato corrisponde,
// via i suoi `types` Google grezzi. Puo' essere vuoto (nessun type riconosciuto:
// zero segnale, non segnale contrario — stesso principio di candidateConflictsWithCategoria).
export const mapCandidateToCoreCategories = (candidate) => {
    const types = Array.isArray(candidate?.types) ? candidate.types : [];
    const out = new Set();
    for (const t of types) {
        const cat = mapTypeToCoreCategory(t);
        if (cat) out.add(cat);
    }
    return out;
};

// ─── Affinita' DNA (0..1) ────────────────────────────────────────────────────
//
// dnaWeights e' l'oggetto normalizzato di computeWeights (preferenceEngine.js),
// es. { cultura: 0.7, food: 0.9, ... }, gia' 0..1. Un candidato senza type
// riconosciuto o con tutti i pesi a zero ottiene affinita' 0 — questo e' anche
// il comportamento per un utente nuovo senza seme (regola UTENTE NUOVO): il
// termine DNA si azzera da solo, non serve un caso speciale qui.
export const computeAffinityScore = (candidate, dnaWeights = {}) => {
    const cats = mapCandidateToCoreCategories(candidate);
    if (cats.size === 0) return 0;
    let best = 0;
    for (const cat of cats) {
        const w = Number(dnaWeights?.[cat]) || 0;
        if (w > best) best = w;
    }
    return Math.max(0, Math.min(1, best));
};

// ─── Icone: top decimo per numero di recensioni nel pool ────────────────────
//
// Esportato per test. Ritorna un Set di place_id "icona": candidati con
// user_ratings_total STRETTAMENTE sopra il valore alla soglia del decimo
// superiore del pool. STRETTAMENTE, non posizionalmente: se il pool e'
// uniforme (es. 20 candidati tutti con le stesse recensioni), non c'e' nessun
// vero fuoriscala e nessuno diventa icona — un pareggio in graduatoria non e'
// un'eccezionalita'. Con un vero outlier (poche recensioni molto sopra le
// altre), quello e la soglia lo separano correttamente.
export const identifyIcons = (pool) => {
    const ids = (c) => c?.place_id || c?.googlePlaceId || c?.name;
    if (!Array.isArray(pool) || pool.length === 0) return new Set();
    const reviewsAsc = pool.map(c => Number(c?.user_ratings_total) || 0).sort((a, b) => a - b);
    const n = pool.length;
    const numIcons = Math.max(1, Math.ceil(n * 0.1));
    const cutoffIndex = n - numIcons; // indice (asc) da cui parte il decimo superiore
    const soglia = cutoffIndex > 0 ? reviewsAsc[cutoffIndex - 1] : -Infinity;
    return new Set(pool.filter(c => (Number(c?.user_ratings_total) || 0) > soglia).map(ids));
};

// ─── Unicita' (approssimazione dichiarata) ──────────────────────────────────
//
// Premia voto alto con poche recensioni RISPETTO AGLI ALTRI CANDIDATI DEL
// POOL (normalizzazione min-max su ln(1+recensioni), non su una scala
// assoluta: la stessa "180 recensioni" e' rara in una piazza con 3 candidati
// e comune in una con 200). Penalizza le catene quando lo stesso nome
// (case-insensitive, spazi normalizzati) compare piu' volte nel pool corrente
// — l'unico segnale di "catena" disponibile qui e' intra-pool: rilevare una
// catena su UNA sola occorrenza in una sola citta' richiederebbe uno storico
// cross-citta' che oggi non esiste, e non viene approssimato.
const normName = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');

const CHAIN_PENALTY = 0.5;

export const computeUniquenessScore = (candidate, pool) => {
    if (!Array.isArray(pool) || pool.length === 0) return 0.5;
    const logReviews = (c) => Math.log(1 + (Number(c?.user_ratings_total) || 0));
    const logs = pool.map(logReviews);
    const min = Math.min(...logs);
    const max = Math.max(...logs);
    const range = max - min;
    const normLog = range > 0 ? (logReviews(candidate) - min) / range : 0;
    const rating = Number(candidate?.rating) || 0;
    let uniqueness = (rating / 5) * (1 - normLog);

    const name = normName(candidate?.name || candidate?.title);
    if (name) {
        const occurrences = pool.filter(c => normName(c?.name || c?.title) === name).length;
        if (occurrences > 1) uniqueness *= CHAIN_PENALTY;
    }

    return Math.max(0, Math.min(1, uniqueness));
};

// ─── Punteggio finale ────────────────────────────────────────────────────────
export const SCORE_WEIGHTS = { affinita: 0.45, unicita: 0.35, voto: 0.20 };

// P7a — il peso dell'affinita' segue la FIDUCIA del DNA (`dnaWeights._share`,
// da computeDnaShare): 0 sotto 5 eventi, fino a 0,45 a 20 eventi, al massimo
// 0,15 con i soli semi del primo accesso. Il resto si divide fra unicita' e
// voto nelle stesse proporzioni di sempre (35:20). Senza `_share` (chiamanti
// e test che passano solo i pesi) vale 0,45, come prima del P7a.
export const dnaShareOf = (dnaWeights = {}) => (
    Number.isFinite(dnaWeights?._share) ? Math.max(0, Math.min(SCORE_WEIGHTS.affinita, dnaWeights._share)) : SCORE_WEIGHTS.affinita
);

export const computeCandidateScore = (candidate, pool, dnaWeights = {}) => {
    const share = dnaShareOf(dnaWeights);
    const affinita = share > 0 ? computeAffinityScore(candidate, dnaWeights) : 0;
    const unicita = computeUniquenessScore(candidate, pool);
    const voto = (Number(candidate?.rating) || 0) / 5;
    const resto = 1 - share;
    const base = SCORE_WEIGHTS.unicita + SCORE_WEIGHTS.voto;
    return share * affinita
        + resto * (SCORE_WEIGHTS.unicita / base) * unicita
        + resto * (SCORE_WEIGHTS.voto / base) * voto;
};

// ─── Selezione del pool finale ───────────────────────────────────────────────
//
// Sostituisce, nel chiamante, il vecchio `candidates.sort(qualityScore).slice(0,20)`.
// Riceve candidati GIA' filtrati per raggio e categoria (vincolo rigido, non
// tocca questa funzione). Fa: filtro soglia qualita' → punteggio → tetto icone
// → ordina → taglia a `limit`. Il tetto icone e' applicato QUI, prima che
// qualunque tappa arrivi al selettore AI: se il pool offerto contiene al
// massimo un'icona, nessuna scelta a valle (umana o del modello) puo' produrre
// un tour con piu' di un'icona — la garanzia sta nel pool, non nell'istruzione.
export const selectScoredCandidatePool = (candidates, { city, dnaWeights = {}, limit = 20, maxIcons = 1 } = {}) => {
    const idOf = (c) => c?.place_id || c?.googlePlaceId || c?.name;
    const pool = (Array.isArray(candidates) ? candidates : []).filter(c => passesQualityThreshold(c, city));
    const icons = identifyIcons(pool);

    const scored = pool.map(c => ({
        candidate: c,
        score: computeCandidateScore(c, pool, dnaWeights),
        isIcon: icons.has(idOf(c)),
    }));
    scored.sort((a, b) => b.score - a.score);

    const out = [];
    let iconsUsed = 0;
    for (const s of scored) {
        if (s.isIcon) {
            if (iconsUsed >= maxIcons) continue; // icona in eccesso: demossa dal pool
            iconsUsed += 1;
        }
        out.push(s.candidate);
        if (out.length >= limit) break;
    }
    return out;
};

// ─── Varieta': niente 3 tappe consecutive dello stesso tipo ─────────────────
//
// Opera sull'ORDINE finale delle tappe scelte (dopo canonicalizzazione e
// sortByProximity), su `stop.type` (la categoria Google-derived a sei/otto
// valori usata da canonicalizeStopsFromCandidates, non le CORE_CATEGORIES).
// E' un riordino a costo minimo (uno scambio locale), non una riselezione:
// se TUTTE le tappe restanti condividono lo stesso tipo non c'e' niente da
// scambiare, e la sequenza resta cosi' com'e' — dichiarato, non nascosto.
export const enforceCategoryVariety = (stops) => {
    if (!Array.isArray(stops) || stops.length < 3) return stops;
    const result = [...stops];
    for (let i = 0; i < result.length - 2; i++) {
        if (result[i]?.type === result[i + 1]?.type && result[i + 1]?.type === result[i + 2]?.type) {
            let swapIdx = -1;
            for (let j = i + 3; j < result.length; j++) {
                if (result[j]?.type !== result[i]?.type) { swapIdx = j; break; }
            }
            if (swapIdx !== -1) {
                const tmp = result[i + 2];
                result[i + 2] = result[swapIdx];
                result[swapIdx] = tmp;
            }
        }
    }
    return result;
};

// Fingerprint dei pesi DNA per la cache — vedi insiderCacheKey in
// aiRecommendationService.js. Esportato per test diretti sulla stabilita'/
// discriminazione dell'hash.
// ─── P7a — ovvieta': quante tappe stanno nel 10% piu' recensito ─────────────
// Stessa definizione delle "icone" (identifyIcons): il decimo superiore per
// numero di recensioni fra i CANDIDATI della generazione. Va nel resoconto di
// ogni generazione, per sapere quanto scegliamo i luoghi piu' ovvi.
export const obviousnessReport = (stops, candidates) => {
    const idOf = (c) => c?.place_id || c?.googlePlaceId || c?.name || c?.title;
    const pool = Array.isArray(candidates) ? candidates : [];
    const icons = identifyIcons(pool);
    const reviews = pool.map(c => Number(c?.user_ratings_total) || 0).sort((a, b) => a - b);
    const n = reviews.length;
    const soglia = n > 0 ? reviews[n - Math.max(1, Math.ceil(n * 0.1)) - 1] ?? null : null;
    const list = Array.isArray(stops) ? stops : [];
    const ovvie = list.filter(s => icons.has(idOf(s))).map(s => s.title || s.name || idOf(s));
    return { tappe: list.length, nelTop10: ovvie.length, ovvie, candidati: n, sogliaRecensioni: soglia };
};

export const weightsFingerprint = (dnaWeights) => {
    if (!dnaWeights || typeof dnaWeights !== 'object') return '';
    return Object.entries(dnaWeights)
        .filter(([, v]) => typeof v === 'number' && v > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
};

export { CORE_CATEGORIES };
