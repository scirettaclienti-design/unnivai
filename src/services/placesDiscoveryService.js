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
import { buildPlacesProxyUrl, isPlacesProxyEnabled, BLACKLIST_TYPES } from './aiRecommendationService';
import { isSmallTown } from './tourShape';

// DVAI-055-b: prefix bumped da 'unnivai_poiv2_' per invalidare i POI tematici
// cached prima del filtro raggio centralizzato nel normalizer. I tour tematici
// pre-fix contenevano tappe a 50-70 km da borghi.
const CACHE_PREFIX = 'unnivai_poiv3_';
// DVAI-050 — TTL esteso a 24h per ridurre re-fetch OpenAI/Places.
// Stessa city+tema → riusato 1 giorno. Trade-off accettabile: meteo cambia
// poco in 24h, POI tematici sono stabili.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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

// DVAI-049 — Places via REST proxy server-side: niente dipendenza dal JS SDK,
// funziona anche su pagine senza MapAPIWrapper (es. dashboard).
const fetchPlacePhoto = async (placeName, cityName) => {
  // DVAI-050: se il proxy Places è OFF (es. prod senza secret), skip silenzioso.
  if (!isPlacesProxyEnabled()) return null;
  try {
    const searchQuery = `${placeName} ${cityName} Italia`;
    const findUrl = buildPlacesProxyUrl({
      path: 'place/findplacefromtext',
      input: searchQuery,
      inputtype: 'textquery',
      fields: 'photos,name',
    });
    const res = await fetch(findUrl);
    if (!res.ok) return null;
    const data = await res.json();
    const ref = data?.candidates?.[0]?.photos?.[0]?.photo_reference;
    if (!ref) return null;
    return buildPlacesProxyUrl({
      path: 'place/photo',
      maxwidth: '600',
      photo_reference: ref,
    });
  } catch (e) {
    console.warn('[PlacesPhoto] fetch failed:', e.message);
    return null;
  }
};

const enrichWithPhotos = async (pois, cityName) => {
  if (!pois || pois.length === 0) return pois;

  // DVAI-049: niente dipendenza JS SDK; fetchPlacePhoto va via proxy REST.
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

// ─── DVAI-060 — MOTORE GOOGLE-FIRST ─────────────────────────────────────────────
//
// Inversione del flusso: invece di "AI inventa nomi → Google verifica singolo POI",
// ora "Google textsearch → filtri di qualità → (Fase 2: AI seleziona/racconta)".
//
// Soglie tarate su dati reali Troina (borgo, ~9k ab) + Enna (città media, ~26k ab).
// Vedi report P0 in chat + PROGRESS.md per il razionale numeri.
//
// La firma di output è compatibile con il vecchio discoverPOIs → nessun refactor
// downstream (buildSmartExperiencesAsync in DashboardUser resta invariato).

// ─── SOGLIE per tema × dimensione posto ─────────────────────────────────────────
// Gate I — differenziate per categoria perché il volume di recensioni Google
// varia molto per tipo di luogo:
//   food/culture: alto traffico (una pizzeria 800, un museo 500)
//   nature/relax: basso traffico (Villa Bellini 148, un belvedere 30)
// Chiedere 50 recensioni a un parco è come chiedere 800 a un belvedere:
// lo cancelli. Il rating (4.0) resta a garantire la qualità.
// FOOD: rating alto (4.2) = filtro anti-catena implicito (Burger Sicily 4.0 esce).
// CULTURA/NATURA/RELAX: rating 4.0 accetta musei/chiese/parchi piccoli legittimi.
const QUALITY_THRESHOLDS = {
  FOOD:    { small: { minRating: 4.2, minTotal: 3 }, large: { minRating: 4.2, minTotal: 50 } },
  CULTURA: { small: { minRating: 4.0, minTotal: 3 }, large: { minRating: 4.0, minTotal: 50 } },
  NATURA:  { small: { minRating: 4.0, minTotal: 3 }, large: { minRating: 4.0, minTotal: 20 } },
  RELAX:   { small: { minRating: 4.0, minTotal: 3 }, large: { minRating: 4.0, minTotal: 20 } },
};

// ─── Mapping tema utente → query textsearch + kind di soglia ────────────────────
// DVAI-060 F2: aggiunti shopping e nightlife per coprire il picker AiItinerary.
// Shopping usa soglia CULTURA (permissiva su rating: boutique piccole a 4.0 ok).
// Nightlife usa soglia FOOD (rating alto = filtro anti-catena su bar/pub).
const THEME_TEXTSEARCH = {
  food:      { query: 'trattoria ristorante pizzeria osteria',     kind: 'FOOD' },
  walking:   { query: 'piazza chiesa monumento centro storico',    kind: 'CULTURA' },
  romance:   { query: 'belvedere panorama tramonto giardino',      kind: 'CULTURA' },
  art:       { query: 'museo chiesa palazzo storico galleria',     kind: 'CULTURA' },
  nature:    { query: 'parco villa comunale giardino botanico',    kind: 'NATURA' },
  shopping:  { query: 'artigianato boutique mercato negozi tipici', kind: 'CULTURA' },
  nightlife: { query: 'bar cocktail pub locale musica vino',       kind: 'FOOD' },
};

// Google `types` → tipo interno DoveVAI usato dai motori (rendering marker/cover).
const mapGoogleTypeToOurType = (types = []) => {
  const set = new Set(types);
  if (set.has('museum') || set.has('art_gallery')) return 'museum';
  if (set.has('church') || set.has('place_of_worship') ||
      set.has('mosque') || set.has('synagogue') || set.has('hindu_temple')) return 'church';
  if (set.has('park') || set.has('natural_feature') || set.has('campground')) return 'park';
  if (set.has('restaurant') || set.has('cafe') || set.has('bar') ||
      set.has('bakery') || set.has('meal_takeaway') || set.has('food')) return 'restaurant';
  if (set.has('tourist_attraction')) return 'monument';
  return 'place';
};

// ─── FILTRI ────────────────────────────────────────────────────────────────────
const passesHardExclusions = (c) => {
  // DVAI-057: solo attività operative.
  if (c.business_status && c.business_status !== 'OPERATIONAL') return false;
  // DVAI-051: nessuna officina/banca/ospedale/etc.
  if (Array.isArray(c.types) && c.types.some(t => BLACKLIST_TYPES.has(t))) return false;
  // Rumore garantito: 1 sola recensione e rating basso.
  const r = c.rating || 0;
  const t = c.user_ratings_total || 0;
  if (r < 3.5 && t <= 2) return false;
  // Assenza totale di dati (Google conosce il posto ma nessuno l'ha mai giudicato).
  if (r === 0 && t === 0) return false;
  return true;
};

// Scale-down progressivo: se troppo pochi passano, allargo la soglia. Meglio
// avere 3 candidati borderline che 0 candidati "perfetti".
const applyQualityThreshold = (candidates, kind, isSmall) => {
  const t = QUALITY_THRESHOLDS[kind][isSmall ? 'small' : 'large'];
  const level1 = candidates.filter(c =>
    (c.rating || 0) >= t.minRating && (c.user_ratings_total || 0) >= t.minTotal);
  if (level1.length >= 3) return { pois: level1, scaleLevel: 1 };

  const level2 = candidates.filter(c =>
    (c.rating || 0) >= 3.8 && (c.user_ratings_total || 0) >= 1);
  if (level2.length >= 3) {
    console.warn(`[DVAI-060] ${kind} scale-down livello 2 attivo (borderline)`);
    return { pois: level2, scaleLevel: 2 };
  }

  console.warn(`[DVAI-060] ${kind} scale-down livello 3 (permissivo, pochi luoghi disponibili)`);
  return { pois: candidates, scaleLevel: 3 };
};

// qualityScore standard: enfatizza rating alto senza dimenticare popolarità.
const qualityScore = (c) =>
  (c.rating || 0) * Math.log(1 + (c.user_ratings_total || 0));

// ─── Costruzione POI dallo shape textsearch ────────────────────────────────────
const buildPOIFromCandidate = (place, cityName) => {
  const lat = place.geometry?.location?.lat;
  const lng = place.geometry?.location?.lng;
  const photoRef = place.photos?.[0]?.photo_reference;
  const photoUrl = photoRef
    ? buildPlacesProxyUrl({ path: 'place/photo', maxwidth: '600', photo_reference: photoRef })
    : null;
  return {
    id: `google-${place.place_id}`,
    name: place.name,
    title: place.name,
    description: '',                       // sarà scritta dall'AI in Fase 2
    lat, lng,
    latitude: lat, longitude: lng,
    type: mapGoogleTypeToOurType(place.types),
    rating: place.rating || 0,
    user_ratings_total: place.user_ratings_total || 0,
    business_status: place.business_status || 'OPERATIONAL',
    price_level: place.price_level ?? null,
    types: place.types || [],
    city: cityName,
    place_id: place.place_id,
    googlePlaceId: place.place_id,          // segnala a verifyPOIWithPlaces: già verificato
    googlePhoto: photoUrl,
    image: photoUrl,
    address: place.formatted_address || null,
  };
};

/**
 * DVAI-060 — Discovery Google-first di POI reali per (cityName, themeType).
 *
 * @param {string} cityName    città target (usata anche come contesto per la query)
 * @param {number} lat         latitudine centro
 * @param {number} lng         longitudine centro
 * @param {string} themeType   'food' | 'walking' | 'romance' | 'art' | 'nature'
 * @param {object} [opts]      { radiusMeters, maxResults, forceSmallTown }
 * @returns {Promise<Array>}   lista di POI (compatibile con discoverPOIs)
 */
// Gate B — Slugify per cache key con customQuery (evita chars invalidi nel prefix).
const slugForCache = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

const discoverRealPOIs = async (cityName, lat, lng, themeType = 'walking', opts = {}) => {
  const {
    radiusMeters,
    maxResults = 12,
    forceSmallTown,
    // Gate B — customQuery: sovrascrive THEME_TEXTSEARCH[themeType].query e il kind
    // di soglia. Usato dal path A (free-text) di generateItinerary quando il
    // traduttore ha prodotto queries specifiche. Non c'è fallback automatico:
    // se il proxy fallisce, il chiamante decide (nel path A non ricadremo mai
    // sul vecchio AI-first — quello sarebbe il bug rieducato).
    customQuery,
    // customKind: soglia da usare quando la query non è mappata (default CULTURA).
    customKind = 'CULTURA',
    // skipLegacyFallback: se true, discoverRealPOIs NON cade su discoverPOIs
    // (vecchio motore AI-first che inventa nomi) su nessun cammino di errore.
    // Ritorna [] onestamente. Usato dal path A.
    skipLegacyFallback = false,
  } = opts;

  const isSmall = forceSmallTown ?? isSmallTown(cityName);

  // Se il proxy Places è OFF: path B tollera il fallback storico, path A no.
  if (!isPlacesProxyEnabled()) {
    if (skipLegacyFallback) return [];
    return discoverPOIs(cityName, lat, lng, themeType);
  }

  const themeCfg = THEME_TEXTSEARCH[themeType] || THEME_TEXTSEARCH.walking;
  const effectiveQuery = customQuery ? String(customQuery).trim() : themeCfg.query;
  const effectiveKind = customQuery ? customKind : themeCfg.kind;
  const radius = radiusMeters ?? (isSmall ? 3000 : 5000);

  // Cache key differenziata: customQuery ha suo namespace (non collide con temi).
  const cacheKey = customQuery
    ? `gg1_${cityName.replace(/\s+/g, '_')}_q_${slugForCache(effectiveQuery)}_${isSmall ? 's' : 'l'}`
    : `gg1_${cityName.replace(/\s+/g, '_')}_${themeType}_${isSmall ? 's' : 'l'}`;
  const cached = loadFromCache(cacheKey);
  if (cached) return cached;

  try {
    const url = buildPlacesProxyUrl({
      path: 'place/textsearch',
      query: `${effectiveQuery} ${cityName}`,
      location: `${lat},${lng}`,
      radius: String(radius),
    });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`textsearch HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'OK' || !Array.isArray(data.results)) {
      throw new Error(`textsearch status=${data.status}`);
    }

    // 1. Esclusioni hard (business_status, blacklist types, rumore).
    const cleaned = data.results.filter(passesHardExclusions);
    // 2. Soglia qualità differenziata per tema, con scale-down se pochi.
    const { pois: qualified, scaleLevel } = applyQualityThreshold(cleaned, effectiveKind, isSmall);
    // 3. Ordinamento per qualityScore (rating × ln(1+total)).
    const ranked = qualified
      .map(p => ({ ...p, _qs: qualityScore(p) }))
      .sort((a, b) => b._qs - a._qs)
      .slice(0, maxResults);

    if (ranked.length === 0) {
      // Gate B — Path A: 0 candidati REALI significa "la richiesta non ha risposta
      // in questa città". Errore onesto. Non cadere sul vecchio motore.
      if (skipLegacyFallback) return [];
      console.warn(`[DVAI-060] ${cityName}/${effectiveQuery}: 0 candidati Google-first, fallback AI-first`);
      return discoverPOIs(cityName, lat, lng, themeType);
    }

    // 5. Rimuovo _qs (era solo per debug) e salvo in cache.
    const finalPois = ranked.map(p => { const { _qs, ...rest } = p; return buildPOIFromCandidate(rest, cityName); });
    saveToCache(cacheKey, finalPois);
    if (scaleLevel > 1) {
      console.info(`[DVAI-060] ${cityName}/${effectiveQuery} scale-down livello ${scaleLevel}, ${finalPois.length} POI`);
    }
    return finalPois;
  } catch (err) {
    // Gate B — Path A: errori di rete NON diventano tour finti. Ritorna [].
    if (skipLegacyFallback) {
      console.warn(`[DVAI-060] ${cityName}/${effectiveQuery} textsearch fallita: ${err.message} — path A, no fallback`);
      return [];
    }
    console.warn(`[DVAI-060] textsearch fallita per ${cityName}/${effectiveQuery}: ${err.message} → fallback AI-first`);
    return discoverPOIs(cityName, lat, lng, themeType);
  }
};

const discoverAllThemes = async (cityName, lat, lng) => {
  const themes = ['food', 'walking', 'romance', 'art', 'nature'];
  const results = {};
  // DVAI-060: motore primario Google-first; fallback a discoverPOIs interno.
  await Promise.all(themes.map(async (theme) => {
    results[theme] = await discoverRealPOIs(cityName, lat, lng, theme);
  }));
  return results;
};

export const placesDiscoveryService = {
  discoverPOIs,           // legacy AI-first (usato come fallback interno)
  discoverRealPOIs,       // DVAI-060 Google-first
  discoverAllThemes,
  enrichWithPhotos,
  fetchPlacePhoto,
};

// Export nominato per test unitari senza toccare la superficie del service.
export {
  discoverRealPOIs,
  qualityScore,
  passesHardExclusions,
  applyQualityThreshold,
  QUALITY_THRESHOLDS,
};
