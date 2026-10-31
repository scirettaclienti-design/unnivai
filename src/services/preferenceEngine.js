/**
 * preferenceEngine.js — Cervello Adattivo DoveVAI
 *
 * Calcola una matrice di pesi normalizzati (0.0 → 1.0) per le categorie chiave
 * basandosi sugli eventi tracciati dal preference graph (useAILearning).
 *
 * Categorie core: cultura, food, nightlife, natura, avventura, shopping, relax, arte
 *
 * Logica incrementale (P7a — vedi DNA_EVENT_WEIGHTS):
 *   - Seme del primo accesso: +0.3
 *   - Tour completato +0.3, salvato +0.2, valutato ±0.3, "Dettagli" +0.05
 *   - Rigenera giorno / tappa saltata: -0.1
 *
 * Output: oggetto { cultura: 0.35, food: 0.05, ... } fra 0 e 1, SENZA
 * normalizzazione sul massimo.
 */

const CORE_CATEGORIES = ['cultura', 'food', 'nightlife', 'natura', 'avventura', 'shopping', 'relax', 'arte'];

// Mappa alias → categoria normalizzata
const CATEGORY_ALIASES = {
    'cultura': 'cultura', 'culture': 'cultura', 'storia': 'cultura', 'history': 'cultura', 'museo': 'cultura',
    'food': 'food', 'cibo': 'food', 'gastronomia': 'food', 'ristorazione': 'food', 'restaurant': 'food',
    'nightlife': 'nightlife', 'vita notturna': 'nightlife', 'bar': 'nightlife', 'aperitivo': 'nightlife', 'cocktail': 'nightlife',
    'natura': 'natura', 'nature': 'natura', 'parco': 'natura', 'park': 'natura', 'verde': 'natura',
    'avventura': 'avventura', 'adventure': 'avventura', 'sport': 'avventura', 'trekking': 'avventura',
    'shopping': 'shopping', 'negozio': 'shopping', 'boutique': 'shopping', 'mercato': 'shopping',
    'relax': 'relax', 'spa': 'relax', 'benessere': 'relax', 'panorama': 'relax',
    'arte': 'arte', 'art': 'arte', 'galleria': 'arte', 'design': 'arte', 'street art': 'arte',
};

// ─── P7a — DNA onesto ────────────────────────────────────────────────────────
//
// Il DNA impara da AZIONI CHE CONTANO, con la categoria vera delle tappe (dai
// `types` Google), e non trasforma piu' un clic in una preferenza al 100%:
//   · niente normalizzazione sul valore massimo: un peso e' la somma dei suoi
//     eventi, tagliata fra 0 e 1. Un clic su un ristorante = food 0,05;
//   · FIDUCIA = numero di eventi con categoria. Il peso del DNA nel punteggio
//     dei candidati (computeDnaShare) e' 0 sotto 5 eventi, poi cresce in modo
//     lineare fino al 45% a 20 eventi. I semi del primo accesso valgono al
//     massimo come spinta del 15%.
// I contatori `cat:` scritti prima del P7a (12 in tutto il database) non
// contano piu': venivano da clic su tipi mappati male. Restano solo come
// conteggio per la scheda "Tour DNA" del profilo.

/** Peso di ogni evento, per ogni categoria (distinta) delle sue tappe. */
export const DNA_EVENT_WEIGHTS = {
    tour_completed: 0.3,
    tour_saved: 0.2,
    tour_rated: 0.3,       // ±: voto >= 4 → +0,3; voto <= 2 → −0,3; 3 → nessun evento
    stop_detail: 0.05,     // "Dettagli" di una tappa
    regenerate_day: -0.1,  // "Rigenera giorno": le tappe del giorno scartato
    stop_skipped: -0.1,
};
export const SEED_WEIGHT = 0.3;
export const DNA_MIN_EVENTS = 5;
export const DNA_FULL_EVENTS = 20;
export const DNA_MAX_SHARE = 0.45;
export const SEED_MAX_SHARE = 0.15;

// ─── Tipi (Google e interni) → 8 categorie di base ──────────────────────────
// Mappa ESPLICITA, testata (dnaOnesto.test.js): nessun tipo comune resta senza
// categoria. L'ORDINE conta: per una tappa vince il primo tipo dell'elenco che
// la tappa porta. Il cibo prima del bar (un ristorante con anche `bar` e'
// cibo), i tipi specifici prima di quelli generici (tourist_attraction, place).
const TYPE_TO_CORE = {
    // cibo
    restaurant: 'food', meal_takeaway: 'food', meal_delivery: 'food', bakery: 'food',
    cafe: 'food', ice_cream_shop: 'food', winery: 'food',
    // arte
    art_gallery: 'arte', performing_arts_theater: 'arte', theater: 'arte',
    // cultura
    museum: 'cultura', church: 'cultura', place_of_worship: 'cultura', synagogue: 'cultura',
    mosque: 'cultura', hindu_temple: 'cultura', castle: 'cultura', city_hall: 'cultura',
    library: 'cultura', historical_landmark: 'cultura', monument: 'cultura',
    // natura
    park: 'natura', natural_feature: 'natura', campground: 'natura', beach: 'natura',
    national_park: 'natura', hiking_area: 'natura', forest: 'natura', garden: 'natura',
    // avventura
    amusement_park: 'avventura', zoo: 'avventura', aquarium: 'avventura', stadium: 'avventura',
    bowling_alley: 'avventura', sports_complex: 'avventura', gym: 'avventura',
    // shopping
    store: 'shopping', shopping_mall: 'shopping', clothing_store: 'shopping', shoe_store: 'shopping',
    jewelry_store: 'shopping', book_store: 'shopping', department_store: 'shopping', market: 'shopping',
    // relax
    spa: 'relax', wellness_center: 'relax', beauty_salon: 'relax', viewpoint: 'relax',
    // vita notturna (dopo il cibo: un ristorante-bar e' cibo)
    bar: 'nightlife', wine_bar: 'nightlife', cocktail_bar: 'nightlife', pub: 'nightlife', night_club: 'nightlife', casino: 'nightlife',
    // generici, in fondo: un'attrazione o un "luogo" (piazza, belvedere,
    // monumento senza tipo preciso) e' cultura; `food` da solo e' cibo.
    tourist_attraction: 'cultura', food: 'food', place: 'cultura',
};
const TYPE_PRIORITY = Object.keys(TYPE_TO_CORE);
// Tipi che non dicono niente da soli: valgono solo se non c'e' altro.
const GENERIC_TYPES = new Set(['point_of_interest', 'establishment', 'premise']);

/** La categoria di base di un tipo (Google o interno), o null. */
export function mapTypeToCoreCategory(type) {
    if (!type) return null;
    const t = String(type).toLowerCase().trim();
    return TYPE_TO_CORE[t] || normalizeCategory(t) || null;
}

/**
 * La categoria di base di UNA tappa: dai suoi `types` Google (in ordine di
 * priorita'), poi dal tipo interno (`type`: museum, church, park, restaurant,
 * monument, place), poi, se ha solo tipi generici, "cultura" (un luogo).
 */
export function stopCoreCategory(stop) {
    const types = Array.isArray(stop?.types) ? stop.types.map(t => String(t).toLowerCase()) : [];
    for (const t of TYPE_PRIORITY) if (types.includes(t)) return TYPE_TO_CORE[t];
    const own = mapTypeToCoreCategory(stop?.type) || mapTypeToCoreCategory(stop?.category);
    if (own) return own;
    if (types.some(t => GENERIC_TYPES.has(t))) return 'cultura';
    return null;
}

/** Le categorie distinte delle tappe di un tour. */
export function tourCoreCategories(stops) {
    return [...new Set((Array.isArray(stops) ? stops : []).map(stopCoreCategory).filter(Boolean))];
}

/**
 * Applica un evento al grafo: `dna:<cat>` += peso per ogni categoria distinta,
 * `dna:events` += 1. Senza categorie non succede niente (nessun evento
 * inventato). Gli eventi positivi aggiornano anche il conteggio `cat:` che la
 * scheda "Tour DNA" del profilo mostra.
 * @param {object} graph
 * @param {keyof DNA_EVENT_WEIGHTS} kind
 * @param {string[]} categories
 * @param {{ rating?: number }} [opts]
 * @returns {object} un grafo nuovo (quello passato non cambia)
 */
export function applyDnaEvent(graph = {}, kind, categories = [], { rating } = {}) {
    let w = DNA_EVENT_WEIGHTS[kind];
    if (!Number.isFinite(w)) return graph;
    if (kind === 'tour_rated') {
        if (!Number.isFinite(rating)) return graph;
        w = rating >= 4 ? DNA_EVENT_WEIGHTS.tour_rated : rating <= 2 ? -DNA_EVENT_WEIGHTS.tour_rated : 0;
        if (w === 0) return graph;
    }
    const cats = [...new Set((categories || []).map(normalizeCategory).filter(Boolean))];
    if (cats.length === 0) return graph;
    const next = { ...graph };
    for (const c of cats) {
        next[`dna:${c}`] = Math.round(((Number(next[`dna:${c}`]) || 0) + w) * 10000) / 10000;
        if (w > 0) next[`cat:${c}`] = (Number(next[`cat:${c}`]) || 0) + 1;
    }
    next['dna:events'] = (Number(next['dna:events']) || 0) + 1;
    return next;
}

/** Quanti eventi con categoria conosce il DNA. */
export function dnaEventCount(graph = {}) {
    return Number(graph?.['dna:events']) || 0;
}

/**
 * Quanto pesa il DNA nel punteggio dei candidati (0..0,45).
 * 0 sotto DNA_MIN_EVENTS eventi; poi lineare fino a DNA_MAX_SHARE a
 * DNA_FULL_EVENTS. Un seme del primo accesso vale al massimo SEED_MAX_SHARE.
 */
export function computeDnaShare(graph = {}, onboardingInterests = []) {
    const events = dnaEventCount(graph);
    const fromEvents = events < DNA_MIN_EVENTS
        ? 0
        : DNA_MAX_SHARE * Math.min(1, (events - DNA_MIN_EVENTS) / (DNA_FULL_EVENTS - DNA_MIN_EVENTS));
    const hasSeed = (Array.isArray(onboardingInterests) ? onboardingInterests : []).some(i => normalizeCategory(i));
    return Math.round(Math.max(fromEvents, hasSeed ? SEED_MAX_SHARE : 0) * 1000) / 1000;
}

/**
 * Pesi del DNA (0..1 per categoria), SENZA normalizzazione sul massimo.
 * @param {object} preferenceGraph - il grafo di useAILearning (chiavi `dna:<cat>`)
 * @param {string[]} onboardingInterests - semi del primo accesso (es. ["food"])
 * @returns {object} { cultura: 0.05, food: 0.3, ... }
 */
export function computeWeights(preferenceGraph = {}, onboardingInterests = []) {
    const weights = {};
    CORE_CATEGORIES.forEach(cat => { weights[cat] = 0.0; });

    // 1. Semi del primo accesso: +0.3 ciascuno.
    if (Array.isArray(onboardingInterests)) {
        onboardingInterests.forEach(interest => {
            const normalized = normalizeCategory(interest);
            if (normalized) weights[normalized] += SEED_WEIGHT;
        });
    }

    // 2. Eventi pesati (`dna:<cat>`), con la categoria vera delle tappe.
    for (const [key, value] of Object.entries(preferenceGraph || {})) {
        if (!key.startsWith('dna:') || key === 'dna:events') continue;
        const normalized = normalizeCategory(key.slice(4));
        if (normalized && Number.isFinite(Number(value))) weights[normalized] += Number(value);
    }

    // 3. Taglio fra 0 e 1. NIENTE normalizzazione sul massimo.
    for (const cat of CORE_CATEGORIES) {
        weights[cat] = Math.round(Math.max(0, Math.min(1, weights[cat])) * 100) / 100;
    }
    return weights;
}

// ─── DNA-2 — i pesi si calcolano dal registro degli eventi ────────────
//
// `pesiDaEventi` e' una funzione PURA: stessi eventi + stesso seme + stessa ora = stessi
// pesi, su qualunque dispositivo. Non legge e non scrive niente (ne' localStorage ne' rete),
// non fonde contatori con Math.max e non ha il tetto delle 30 interazioni: la fonte e' il
// registro del server.

/** Peso di ogni gesto del registro, per la sua categoria (un evento = una riga). */
export const REGISTRO_PESI = {
    stop_reached: 0.05,    // tappa raggiunta (un giro di tre tappe ne porta tre)
    tour_completed: DNA_EVENT_WEIGHTS.tour_completed,
    tour_saved: DNA_EVENT_WEIGHTS.tour_saved,
    quiz_choice: 0.2,      // scelta esplicita nel Quiz, con la categoria
    stop_skipped: DNA_EVENT_WEIGHTS.stop_skipped,
    dna_correction: 0.15,  // DNA-6: «piu' di questo» +0,15 · «meno di questo» −0,15 · «azzera» riparte da zero (vedi pesiDaEventi)
};
/** Gesti che fanno FIDUCIA: gli stessi che contava il DNA di prima (dna:events), cosi' il peso nel motore non cambia. */
export const REGISTRO_FIDUCIA = ['tour_completed', 'tour_saved', 'stop_skipped'];
/** Un evento vale la meta' ogni 30 giorni. */
export const MEZZA_VITA_GIORNI = 30;
/** Il seme vale 1/(1 + eventi/20): meta' a 20 eventi, un terzo a 40. */
export const SEME_ATTENUA_EVENTI = 20;
/** Una preferenza di ritmo o compagnia diventa «suggerita» con almeno 3 scelte e il 60% dello stesso valore. */
export const PREFERENZA_MIN_SCELTE = 3;
export const PREFERENZA_MIN_QUOTA = 0.6;

const GIORNO_MS = 24 * 60 * 60 * 1000;
const RITMO_VALORI = { rilassato: 'lento', lento: 'lento', attivo: 'medio', medio: 'medio', intenso: 'veloce', veloce: 'veloce' };
const COMPAGNIA_VALORI = ['solo', 'coppia', 'amici', 'famiglia'];

/** Quanto vale oggi un evento di `createdAt`: 1 adesso, 0,5 dopo 30 giorni, 0,25 dopo 60. */
export function decadimento(createdAt, ora) {
    const t = new Date(createdAt).getTime();
    const adesso = new Date(ora).getTime();
    if (!Number.isFinite(t) || !Number.isFinite(adesso)) return 1;
    const giorni = Math.max(0, (adesso - t) / GIORNO_MS);
    return Math.pow(0.5, giorni / MEZZA_VITA_GIORNI);
}

function preferenzaDa(valori, ammessi) {
    const conteggi = {};
    for (const v of valori) if (v) conteggi[v] = (conteggi[v] || 0) + 1;
    const totale = valori.filter(Boolean).length;
    let preferito = null;
    for (const k of ammessi) if ((conteggi[k] || 0) > (conteggi[preferito] || 0)) preferito = k;
    const quota = totale && preferito ? Math.round((conteggi[preferito] / totale) * 100) / 100 : 0;
    return {
        conteggi, totale, preferito, quota,
        suggerito: totale >= PREFERENZA_MIN_SCELTE && quota >= PREFERENZA_MIN_QUOTA ? preferito : null,
    };
}

/**
 * I pesi del DNA dal registro degli eventi.
 * @param {{ id?: string, kind: string, category?: string|null, value?: string|null, tour_id?: string|null, created_at: string }[]} eventi
 * @param {string[]} seme - interessi dell'onboarding (es. ["food"])
 * @param {Date|number|string} ora - l'«adesso» del calcolo (passato da fuori: la funzione e' pura)
 * @returns {{ pesi: object, eventi: number, share: number, semeFattore: number, ritmo: object, compagnia: object }}
 */
export function pesiDaEventi(eventi = [], seme = [], ora = Date.now()) {
    // Lo stesso evento arrivato da due dispositivi (stesso id) conta una volta; l'ordine e'
    // fissato (data, id) cosi' la somma non dipende dall'ordine in cui arrivano le righe.
    const visti = new Set();
    const righe = (Array.isArray(eventi) ? eventi : [])
        .filter(e => e && typeof e.kind === 'string')
        .filter(e => {
            if (!e.id) return true;
            if (visti.has(e.id)) return false;
            visti.add(e.id);
            return true;
        })
        .sort((a, b) => (String(a.created_at).localeCompare(String(b.created_at))) || String(a.id || '').localeCompare(String(b.id || '')));

    // Fiducia: i gesti che gia' contavano, un giro (stesso gesto, giro e istante) = un evento.
    const gruppi = new Set();
    for (const e of righe) {
        if (!REGISTRO_FIDUCIA.includes(e.kind) || !normalizeCategory(e.category)) continue;
        gruppi.add(`${e.kind}|${e.tour_id || ''}|${e.created_at}${e.kind === 'stop_skipped' ? `|${e.id || ''}|${normalizeCategory(e.category)}` : ''}`);
    }
    const nFiducia = gruppi.size;
    const share = computeDnaShare({ 'dna:events': nFiducia }, seme);

    // DNA-6 — «azzera»: per una categoria, tutto cio' che e' successo fino a quel momento (eventi e seme)
    // non conta piu'. Il registro resta intero (e' una storia): conta solo da dopo l'azzeramento.
    const azzeratoA = {};
    for (const e of righe) {
        if (e.kind !== 'dna_correction' || e.value !== 'azzera') continue;
        const c = normalizeCategory(e.category);
        const t = new Date(e.created_at).getTime();
        if (c && Number.isFinite(t)) azzeratoA[c] = Math.max(azzeratoA[c] ?? -Infinity, t);
    }

    const semeFattore = 1 / (1 + nFiducia / SEME_ATTENUA_EVENTI);
    const grezzi = {};
    CORE_CATEGORIES.forEach(c => { grezzi[c] = 0; });
    (Array.isArray(seme) ? seme : []).forEach(i => {
        const c = normalizeCategory(i);
        if (c && azzeratoA[c] === undefined) grezzi[c] += SEED_WEIGHT * semeFattore;
    });
    for (const e of righe) {
        let w = REGISTRO_PESI[e.kind];
        if (e.kind === 'dna_correction') w = e.value === 'piu' ? w : e.value === 'meno' ? -w : NaN; // 'azzera' non somma
        const c = normalizeCategory(e.category);
        if (!Number.isFinite(w) || !c) continue;
        if (azzeratoA[c] !== undefined && !(new Date(e.created_at).getTime() > azzeratoA[c])) continue;
        grezzi[c] += w * decadimento(e.created_at, ora);
    }
    const pesi = {};
    for (const c of CORE_CATEGORIES) pesi[c] = Math.round(Math.max(0, Math.min(1, grezzi[c])) * 100) / 100;

    const ritmo = preferenzaDa(
        righe.filter(e => e.kind === 'pace_chosen').map(e => RITMO_VALORI[String(e.value || '').toLowerCase().trim()] || null),
        ['lento', 'medio', 'veloce'],
    );
    const compagnia = preferenzaDa(
        righe.filter(e => e.kind === 'company_chosen').map(e => {
            const v = String(e.value || '').toLowerCase().trim();
            return COMPAGNIA_VALORI.includes(v) ? v : null;
        }),
        COMPAGNIA_VALORI,
    );
    return { pesi, eventi: nFiducia, share, semeFattore: Math.round(semeFattore * 1000) / 1000, ritmo, compagnia };
}

/**
 * Applica un evento incrementale ai pesi (API storica, non usata dall'app).
 * @deprecated P7a: gli eventi passano da applyDnaEvent sul grafo.
 */
export function applyEvent(currentWeights = {}, eventType, category) {
    const normalized = normalizeCategory(category);
    if (!normalized) return currentWeights;
    const delta = eventType === 'explicit_select' ? SEED_WEIGHT
        : eventType === 'implicit_view' ? DNA_EVENT_WEIGHTS.stop_detail
        : eventType === 'skip' ? DNA_EVENT_WEIGHTS.stop_skipped
        : 0;
    const weights = { ...currentWeights };
    weights[normalized] = Math.max(0, Math.min(1.0, (weights[normalized] || 0) + delta));
    return weights;
}

/**
 * Genera la stringa di contesto AI dal peso.
 * @param {object} weights - Pesi normalizzati
 * @returns {string} Contesto da iniettare nel system prompt
 */
export function weightsToAIProfile(weights = {}, richiesta = null) {
    // P7a — se il DNA non pesa (fiducia 0), il profilo non va al modello.
    if (weights && weights._share === 0) return '';
    // DNA-3 — con una richiesta esplicita, il profilo non nomina le categorie che l'utente ha chiesto o escluso
    // (il modello potrebbe pesarle contro la richiesta) e dice che la richiesta vince. Senza richiesta: come prima.
    const fuori = new Set(richiesta && !richiesta.vuota ? [...richiesta.chieste, ...(richiesta.catsTesto || []), ...richiesta.escluse] : []);
    const sorted = Object.entries(weights || {})
        .filter(([k, v]) => CORE_CATEGORIES.includes(k) && v > 0.2 && !fuori.has(k)) // Ignora categorie con peso trascurabile
        .sort(([, a], [, b]) => b - a);

    if (sorted.length === 0) return '';

    // Gate MERITO — rimossa la clausola "Evita se possibile: <categorie deboli>".
    // Il profilo narrativo mandato al modello non deve contenere frasi negative
    // ne' conclusioni sotto soglia: un peso basso su una categoria non e' un
    // rifiuto dell'utente, e' spesso solo un dato che manca ancora.
    const dominant = sorted.slice(0, 3).map(([cat, w]) => `${cat} (${Math.round(w * 100)}%)`);
    return `Preferenze dominanti: ${dominant.join(', ')}.${richiesta ? " La richiesta dell'utente vince sempre sul profilo." : ''}`;
}

/**
 * Calcola score di affinità tra un tour e i pesi utente.
 * @param {object} tour - Tour con tags, category, type
 * @param {object} weights - Pesi normalizzati
 * @returns {number} Score 0-100
 */
export function tourAffinityScore(tour, weights = {}) {
    if (!tour || !weights || Object.keys(weights).length === 0) return 50; // neutro

    let score = 0;
    const tags = [...(tour.tags || []), tour.category, tour.type].filter(Boolean);

    for (const tag of tags) {
        const normalized = normalizeCategory(tag);
        if (normalized && weights[normalized]) {
            score += weights[normalized] * 30; // Max 30 punti per tag match
        }
    }

    return Math.min(100, Math.max(0, Math.round(score)));
}

// ─── HELPER ──────────────────────────────────────────────────────────────────

function normalizeCategory(raw) {
    if (!raw) return null;
    const lower = raw.toLowerCase().trim();
    return CATEGORY_ALIASES[lower] || (CORE_CATEGORIES.includes(lower) ? lower : null);
}

export { CORE_CATEGORIES, normalizeCategory };
