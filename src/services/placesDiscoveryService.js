/**
 * 📍 placesDiscoveryService.js — Real POI Discovery + Google Places Photos
 *
 * Strategy:
 *   1. Use OpenAI to discover REAL POI names + coordinates for any Italian city
 *   2. Use Google Maps JS SDK (PlacesService) to enrich each POI with a REAL photo
 *   3. Cache everything in localStorage (1-hour TTL) to minimise API calls
 *
 * Photo flow:
 *   OpenAI gives us names → Google Places "findPlaceFromQuery" gives us photos
 *   This uses the already-loaded Google Maps JS SDK (no CORS issues)
 */

const CACHE_PREFIX = 'unnivai_poiv2_';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ─── Cache helpers ──────────────────────────────────────────────────────────────
const loadFromCache = (key) => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const saveToCache = (key, data) => {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* localStorage full */ }
};

// ─── THEME DEFINITIONS ──────────────────────────────────────────────────────────
const THEME_PROMPTS = {
  food: 'ristoranti tipici, trattorie storiche, panifici artigianali, mercati alimentari, pizzerie locali',
  walking: 'piazze principali, chiese storiche, monumenti, fontane, punti panoramici, portali antichi',
  romance: 'punti panoramici al tramonto, giardini, passeggi romantici, belvederi, vicoli caratteristici',
  art: 'musei, chiese affrescate, palazzi storici, gallerie, architettura barocca o romanica',
  nature: 'parchi pubblici, aree verdi, percorsi naturalistici, villa comunale, oasi naturali',
};

// ─── GOOGLE PLACES SDK PHOTO ENRICHMENT ─────────────────────────────────────────

/**
 * Wait for the Google Maps JS SDK to be fully loaded.
 * Returns the `google.maps.places` namespace or null after timeout.
 */
const waitForGoogleMaps = () => new Promise((resolve) => {
  if (window.google?.maps?.places) {
    resolve(window.google.maps.places);
    return;
  }
  let elapsed = 0;
  const interval = setInterval(() => {
    elapsed += 300;
    if (window.google?.maps?.places) {
      clearInterval(interval);
      resolve(window.google.maps.places);
    }
    if (elapsed > 12000) { // 12s timeout
      clearInterval(interval);
      resolve(null);
    }
  }, 300);
});

/**
 * Fetch a real Google Places photo URL for a given place name + city.
 * Uses the JS SDK's PlacesService with a temporary div (no map needed).
 *
 * @param {string} placeName - e.g. "Trattoria da Peppino"
 * @param {string} cityName  - e.g. "Orta Nova"
 * @returns {Promise<string|null>} Photo URL or null
 */
const fetchPlacePhoto = async (placeName, cityName) => {
  const places = await waitForGoogleMaps();
  if (!places) {
    console.warn('[PlacesPhoto] Google Maps JS SDK not loaded');
    return null;
  }

  // PlacesService needs a DOM element (can be a hidden div, no map required)
  const tempDiv = document.createElement('div');
  const service = new places.PlacesService(tempDiv);

  return new Promise((resolve) => {
    const query = `${placeName} ${cityName} Italia`;
    service.findPlaceFromQuery(
      { query, fields: ['photos', 'name'] },
      (results, status) => {
        if (
          status === places.PlacesServiceStatus.OK &&
          results?.[0]?.photos?.[0]
        ) {
          const photoUrl = results[0].photos[0].getUrl({ maxWidth: 600 });
          resolve(photoUrl);
        } else {
          resolve(null);
        }
      }
    );
  });
};

/**
 * Enrich an array of POIs with real Google Places photos.
 * Runs photo lookups in parallel (max 5 concurrent) to respect quota.
 *
 * @param {Array} pois     - POI objects with at least { name }
 * @param {string} cityName
 * @returns {Promise<Array>} Same POIs with .image populated
 */
const enrichWithPhotos = async (pois, cityName) => {
  if (!pois || pois.length === 0) return pois;

  // Check if Google Maps SDK is available before attempting
  const places = await waitForGoogleMaps();
  if (!places) {
    console.warn('[PlacesPhoto] Cannot enrich — SDK not loaded');
    return pois;
  }

  // Run photo lookups for up to 5 POIs (respecting API quota)
  const enrichPromises = pois.slice(0, 5).map(async (poi) => {
    try {
      const photoUrl = await fetchPlacePhoto(poi.name || poi.title, cityName);
      return { ...poi, image: photoUrl || poi.image };
    } catch (e) {
      console.warn(`[PlacesPhoto] Failed for "${poi.name}":`, e.message);
      return poi;
    }
  });

  const enriched = await Promise.all(enrichPromises);
  // Keep any remaining POIs beyond slice(0,5) as-is
  return [...enriched, ...pois.slice(5)];
};

// ─── POI DISCOVERY VIA OPENAI ───────────────────────────────────────────────────

/**
 * Discover real POIs for a specific city + theme via OpenAI,
 * then enrich each one with a real Google Places photo.
 *
 * @param {string} cityName - e.g. "Orta Nova"
 * @param {number} lat - City center latitude
 * @param {number} lng - City center longitude
 * @param {string} themeType - 'food' | 'walking' | 'romance' | 'art' | 'nature'
 * @returns {Promise<Array>} POI objects with real photos
 */
const discoverPOIs = async (cityName, lat, lng, themeType = 'walking') => {
  const cacheKey = `${cityName.replace(/\s+/g, '_')}_${themeType}`;
  const cached = loadFromCache(cacheKey);
  if (cached) {
    console.log(`📍 [Discovery] Cache hit: ${cacheKey} (${cached.length} POIs)`);
    return cached;
  }

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[Discovery] No OpenAI API key — returning local fallback');
    const fallback = buildLocalFallback(cityName, lat, lng, themeType);
    // Still try to enrich fallback with Google Places photos
    return enrichWithPhotos(fallback, cityName);
  }

  const themeDesc = THEME_PROMPTS[themeType] || THEME_PROMPTS.walking;

  const systemPrompt = `Sei un esperto di turismo e geografia italiana. Conosci ogni singolo paese e città d'Italia, inclusi i borghi più piccoli.
Rispondi ESCLUSIVAMENTE in JSON valido, senza markdown, senza commenti.`;

  const userPrompt = `Elenca 4-5 punti di interesse REALI e VERIFICABILI a "${cityName}" (Italia, coordinate centro: ${lat.toFixed(4)}, ${lng.toFixed(4)}).
Tematica: ${themeDesc}.

REGOLE FONDAMENTALI:
- I nomi devono essere REALI (esistono veramente nel paese/città)
- Le coordinate devono essere PRECISE e nel raggio di 3km dal centro
- Le descrizioni devono essere specifiche per quel luogo (non generiche)
- Se ${cityName} è un piccolo paese, includi anche luoghi delle frazioni/aree limitrofe

Formato JSON richiesto:
{
  "pois": [
    {
      "name": "Nome reale del luogo",
      "description": "Descrizione specifica e interessante (max 120 caratteri)",
      "latitude": 41.xxxx,
      "longitude": 15.xxxx,
      "type": "church|piazza|monument|restaurant|park|museum|palazzo|viewpoint",
      "rating": 4.5
    }
  ]
}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 1200,
      }),
    });

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`OpenAI ${response.status}`);

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty response');

    const parsed = JSON.parse(raw);
    const pois = (parsed.pois || parsed.points || [])
      .filter(p => p.name && p.latitude && p.longitude)
      .map(p => ({
        id: `ai-poi-${p.name.replace(/\s+/g, '-').toLowerCase().substring(0, 30)}`,
        name: p.name,
        title: p.name,
        description: p.description || `Punto di interesse a ${cityName}`,
        lat: parseFloat(p.latitude),
        lng: parseFloat(p.longitude),
        latitude: parseFloat(p.latitude),
        longitude: parseFloat(p.longitude),
        type: p.type || 'place',
        rating: typeof p.rating === 'number' ? p.rating : 4.5,
        city: cityName,
        image: null, // Will be enriched by Google Places below
      }));

    if (pois.length === 0) {
      const fallback = buildLocalFallback(cityName, lat, lng, themeType);
      const enriched = await enrichWithPhotos(fallback, cityName);
      if (enriched.length > 0) saveToCache(cacheKey, enriched);
      return enriched;
    }

    // 🔑 ENRICH WITH REAL GOOGLE PLACES PHOTOS
    const enriched = await enrichWithPhotos(pois, cityName);

    saveToCache(cacheKey, enriched);
    console.log(`📍 [Discovery] Discovered ${enriched.length} POIs with photos for ${cityName}/${themeType}`);
    return enriched;

  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[Discovery] OpenAI failed for ${cityName}/${themeType}:`, err.message);
    const fallback = buildLocalFallback(cityName, lat, lng, themeType);
    return enrichWithPhotos(fallback, cityName);
  }
};

/**
 * Local fallback when OpenAI is unavailable.
 * Generates plausible POI names based on common Italian town features.
 */
const buildLocalFallback = (cityName, lat, lng, themeType) => {
  const templates = {
    food: [
      { name: `Ristorante tipico di ${cityName}`, type: 'restaurant' },
      { name: `Panificio artigianale`, type: 'restaurant' },
      { name: `Trattoria del centro`, type: 'restaurant' },
      { name: `Bar della piazza`, type: 'restaurant' },
    ],
    walking: [
      { name: `Chiesa Madre di ${cityName}`, type: 'church' },
      { name: `Piazza principale di ${cityName}`, type: 'piazza' },
      { name: `Centro storico di ${cityName}`, type: 'monument' },
      { name: `Corso principale`, type: 'piazza' },
    ],
    romance: [
      { name: `Belvedere di ${cityName}`, type: 'viewpoint' },
      { name: `Giardini pubblici`, type: 'park' },
      { name: `Villa comunale`, type: 'park' },
      { name: `Passeggiata al tramonto`, type: 'viewpoint' },
    ],
    art: [
      { name: `Chiesa parrocchiale di ${cityName}`, type: 'church' },
      { name: `Palazzo storico comunale`, type: 'palazzo' },
      { name: `Museo civico`, type: 'museum' },
      { name: `Portale antico`, type: 'monument' },
    ],
    nature: [
      { name: `Parco comunale di ${cityName}`, type: 'park' },
      { name: `Area verde`, type: 'park' },
      { name: `Percorso naturalistico`, type: 'park' },
      { name: `Villa con giardino`, type: 'park' },
    ],
  };

  const items = templates[themeType] || templates.walking;
  return items.map((item, i) => ({
    id: `fallback-${themeType}-${i}`,
    name: item.name,
    title: item.name,
    description: `Luogo di interesse a ${cityName}`,
    lat: lat + (Math.random() - 0.5) * 0.008,
    lng: lng + (Math.random() - 0.5) * 0.008,
    latitude: lat + (Math.random() - 0.5) * 0.008,
    longitude: lng + (Math.random() - 0.5) * 0.008,
    type: item.type,
    rating: 4.5,
    city: cityName,
    image: null, // Will be enriched by Google Places
  }));
};

/**
 * Discover POIs for all 5 experience themes at once.
 * @returns {Promise<Object>} Map: { food: [...], walking: [...], romance: [...], art: [...], nature: [...] }
 */
const discoverAllThemes = async (cityName, lat, lng) => {
  const themes = ['food', 'walking', 'romance', 'art', 'nature'];
  const results = {};

  // Run all in parallel
  await Promise.all(themes.map(async (theme) => {
    results[theme] = await discoverPOIs(cityName, lat, lng, theme);
  }));

  return results;
};

export const placesDiscoveryService = {
  discoverPOIs,
  discoverAllThemes,
  enrichWithPhotos,
  fetchPlacePhoto,
};
