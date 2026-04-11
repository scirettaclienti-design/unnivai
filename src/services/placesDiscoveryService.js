/**
 * 📍 placesDiscoveryService.js — Real POI Discovery + Google Places Photos
 *
 * DVAI-001 — Le chiamate OpenAI ora passano per la Edge Function openai-proxy.
 *            La VITE_OPENAI_API_KEY non viene mai letta nel client.
 * DVAI-020 — Modello aggiornato a gpt-4o-mini.
 *
 * Strategy:
 *   1. Use OpenAI (via proxy) to discover REAL POI names + coordinates
 *   2. Use Google Maps JS SDK (PlacesService) to enrich each POI with a REAL photo
 *   3. Cache everything in localStorage (1-hour TTL) to minimise API calls
 */

import { supabase } from '../lib/supabase';

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

// ─── Proxy helper ────────────────────────────────────────────────────────────────
const callOpenAIProxy = async (payload, signal) => {
  const { data: { session } } = await supabase.auth.getSession();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const headers = {
    'Content-Type': 'application/json',
    'apikey': anonKey,
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/openai-proxy`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ endpoint: '/chat/completions', ...payload }),
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(`Proxy ${response.status}: ${errBody?.error ?? response.statusText}`);
  }

  return response.json();
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
    if (elapsed > 12000) {
      clearInterval(interval);
      resolve(null);
    }
  }, 300);
});

const fetchPlacePhoto = async (placeName, cityName) => {
  const places = await waitForGoogleMaps();
  if (!places) {
    console.warn('[PlacesPhoto] Google Maps JS SDK not loaded');
    return null;
  }

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

const enrichWithPhotos = async (pois, cityName) => {
  if (!pois || pois.length === 0) return pois;

  const places = await waitForGoogleMaps();
  if (!places) {
    console.warn('[PlacesPhoto] Cannot enrich — SDK not loaded');
    return pois;
  }

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
  return [...enriched, ...pois.slice(5)];
};

// ─── POI DISCOVERY VIA OPENAI PROXY ─────────────────────────────────────────────
const discoverPOIs = async (cityName, lat, lng, themeType = 'walking') => {
  const cacheKey = `${cityName.replace(/\s+/g, '_')}_${themeType}`;
  const cached = loadFromCache(cacheKey);
  if (cached) {
    return cached;
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
    // DVAI-001: proxy invece di chiamata diretta OpenAI
    const data = await callOpenAIProxy({
      model: 'gpt-4o-mini',  // DVAI-020
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 1200,
    }, controller.signal);

    clearTimeout(timeoutId);

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
        image: null,
      }));

    if (pois.length === 0) {
      const fallback = buildLocalFallback(cityName, lat, lng, themeType);
      const enriched = await enrichWithPhotos(fallback, cityName);
      if (enriched.length > 0) saveToCache(cacheKey, enriched);
      return enriched;
    }

    const enriched = await enrichWithPhotos(pois, cityName);
    saveToCache(cacheKey, enriched);
    return enriched;

  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[Discovery] OpenAI proxy failed for ${cityName}/${themeType}:`, err.message);
    const fallback = buildLocalFallback(cityName, lat, lng, themeType);
    return enrichWithPhotos(fallback, cityName);
  }
};

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
    image: null,
  }));
};

const discoverAllThemes = async (cityName, lat, lng) => {
  const themes = ['food', 'walking', 'romance', 'art', 'nature'];
  const results = {};
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
