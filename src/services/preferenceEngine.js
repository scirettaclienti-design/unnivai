/**
 * preferenceEngine.js — Cervello Adattivo DoveVAI
 *
 * Calcola una matrice di pesi normalizzati (0.0 → 1.0) per le categorie chiave
 * basandosi sugli eventi tracciati dal preference graph (useAILearning).
 *
 * Categorie core: cultura, food, nightlife, natura, avventura, shopping, relax, arte
 *
 * Logica incrementale:
 *   - Selezione esplicita (onboarding/filtri): +0.3
 *   - Click implicito (stop_detail_view): +0.05
 *   - Rigenerazione/skip tappa: -0.1
 *
 * Output: oggetto { cultura: 0.7, food: 0.9, nightlife: 0.3, ... }
 * normalizzato dove il massimo è 1.0
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

/**
 * Calcola pesi normalizzati dal preference graph grezzo.
 * @param {object} preferenceGraph - Il graph da useAILearning ({ "cat:food": 5, "cat:cultura": 3, ... })
 * @param {string[]} onboardingInterests - Interessi selezionati nell'onboarding (es. ["food", "culture"])
 * @returns {object} Pesi normalizzati { cultura: 0.4, food: 0.9, ... }
 */
export function computeWeights(preferenceGraph = {}, onboardingInterests = []) {
    // Inizializza pesi neutri
    const weights = {};
    CORE_CATEGORIES.forEach(cat => { weights[cat] = 0.0; });

    // 1. Selezione esplicita onboarding: +0.3
    if (Array.isArray(onboardingInterests)) {
        onboardingInterests.forEach(interest => {
            const normalized = normalizeCategory(interest);
            if (normalized) weights[normalized] = Math.min(1.0, (weights[normalized] || 0) + 0.3);
        });
    }

    // 2. Click impliciti dal preference graph: ogni count = +0.05
    for (const [key, count] of Object.entries(preferenceGraph)) {
        if (!key.startsWith('cat:')) continue;
        const rawCat = key.replace('cat:', '').toLowerCase();
        const normalized = normalizeCategory(rawCat);
        if (normalized) {
            weights[normalized] = Math.min(1.0, (weights[normalized] || 0) + count * 0.05);
        }
    }

    // 3. Normalizza: il peso più alto diventa 1.0, gli altri proporzionali
    const maxWeight = Math.max(...Object.values(weights), 0.01);
    for (const cat of CORE_CATEGORIES) {
        weights[cat] = Math.round((weights[cat] / maxWeight) * 100) / 100;
    }

    return weights;
}

/**
 * Applica un evento incrementale ai pesi.
 * @param {object} currentWeights - Pesi attuali { cultura: 0.7, ... }
 * @param {string} eventType - 'explicit_select' | 'implicit_view' | 'skip'
 * @param {string} category - La categoria dell'evento (es. "food", "cultura")
 * @returns {object} Pesi aggiornati
 */
export function applyEvent(currentWeights = {}, eventType, category) {
    const normalized = normalizeCategory(category);
    if (!normalized) return currentWeights;

    const weights = { ...currentWeights };
    const delta = eventType === 'explicit_select' ? 0.3
        : eventType === 'implicit_view' ? 0.05
        : eventType === 'skip' ? -0.1
        : 0;

    weights[normalized] = Math.max(0, Math.min(1.0, (weights[normalized] || 0.5) + delta));

    // Re-normalizza
    const maxWeight = Math.max(...Object.values(weights), 0.01);
    for (const cat of CORE_CATEGORIES) {
        if (weights[cat] !== undefined) {
            weights[cat] = Math.round((weights[cat] / maxWeight) * 100) / 100;
        }
    }

    return weights;
}

/**
 * Genera la stringa di contesto AI dal peso.
 * @param {object} weights - Pesi normalizzati
 * @returns {string} Contesto da iniettare nel system prompt
 */
export function weightsToAIProfile(weights = {}) {
    const sorted = Object.entries(weights)
        .filter(([, v]) => v > 0.2) // Ignora categorie con peso trascurabile
        .sort(([, a], [, b]) => b - a);

    if (sorted.length === 0) return '';

    const dominant = sorted.slice(0, 3).map(([cat, w]) => `${cat} (${Math.round(w * 100)}%)`);
    const avoided = Object.entries(weights).filter(([, v]) => v < 0.15).map(([cat]) => cat);

    const parts = [
        `Preferenze dominanti: ${dominant.join(', ')}.`,
        avoided.length > 0 ? `Evita se possibile: ${avoided.join(', ')}.` : '',
    ].filter(Boolean);

    return parts.join(' ');
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
