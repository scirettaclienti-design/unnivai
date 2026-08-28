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
import { isSmallTown, widerRadiusKm } from './tourShape';

// DVAI-055-b: prefix bumped da 'unnivai_poiv2_' per invalidare i POI tematici
// cached prima del filtro raggio centralizzato nel normalizer. I tour tematici
// pre-fix contenevano tappe a 50-70 km da borghi.
// Gate 3 T1: prefix bumped a 'unnivai_poiv4_' — buildPlacesProxyUrl ora fa
// default language=it. I POI cached prima del fix hanno nomi in inglese
// ("Syracuse Cathedral") — il bump forza il rifetch al primo miss.
// Gate P.1: prefix bumped a 'unnivai_poiv5_dedup_' — walking morto, cultura
// query allargata, romance query B, dedup globale. Le vecchie chiavi cache
// contenevano 5 temi sovrapposti; il bump forza il rifetch con la nuova mappa.
// Gate INTENT (28/08): prefix bumped a 'unnivai_poiv6_bias_' — il bias della
// textsearch e' passato da 3/5 km a 12/20 km (= R_wider). La cache key contiene
// `isSmall` ma NON il radius, quindi senza bump un client con cache calda
// continuerebbe a servire i pool costruiti col bias stretto e il fix non
// arriverebbe mai all'utente. Il bump forza il rifetch al primo miss.
const CACHE_PREFIX = 'unnivai_poiv6_bias_';
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
  // Gate V: timeout 5s (AbortController). Uniformita' con tutte le fetch Places.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const searchQuery = `${placeName} ${cityName} Italia`;
    const findUrl = buildPlacesProxyUrl({
      path: 'place/findplacefromtext',
      input: searchQuery,
      inputtype: 'textquery',
      fields: 'photos,name',
    });
    const res = await fetch(findUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
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
    clearTimeout(timeoutId);
    const reason = e.name === 'AbortError' ? 'timeout (5s)' : e.message;
    console.warn(`[PlacesPhoto] fetch failed: ${reason}`);
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

  // Gate II (16/07): questo fallback e' dead code post-Gate II — la Home
  // usa generateHomeTours che accetta pool VUOTI (nessun tour se non ci sono
  // POI reali) invece di iniettare template inventati. La funzione resta
  // esportata per retrocompat di eventuali call site legacy, ma restituisce
  // array VUOTO (regola locked #1: nessun fallback produce mai contenuto).
  //
  // Prima: templates di nomi tipo "Parco comunale di Troina" con coord
  // Math.random + rating 4.5 hardcoded + description placeholder — tutti fake.
  // Con Gate II qualunque tour tematico riceve narrazione vera dall'AI su POI
  // reali Google. Se non ci sono POI reali, il tour non esiste.
  console.info(`[DVAI-060] fallback POIs richiesti per ${cityName}/${themeType} → return []`);
  // Riferimento non usato per evitare warning noUnusedVars sulla const items.
  void templates;
  return [];
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
// Gate P.1: 5 temi → 4 temi. `walking` era sottoinsieme di `art`, ucciso.
// `art` → `cultura` con query allargata (assorbe monumento/centro storico).
// `romance` con query B locked Ivano — geografia costiera/salite panoramiche
// che nessuna guida turistica elenca come categoria. Zero collision con
// cultura/food/natura per costruzione: moli/scogliere/scalinate/lungomare
// sono POI urbani-costieri registrati come entity autonome su Google.
const THEME_TEXTSEARCH = {
  food:      { query: 'trattoria ristorante pizzeria osteria',                              kind: 'FOOD' },
  cultura:   { query: 'museo chiesa palazzo storico galleria monumento centro storico',     kind: 'CULTURA' },
  romance:   { query: 'lungomare lungofiume scogliera molo scalinata belvedere punto panoramico', kind: 'CULTURA' },
  nature:    { query: 'parco villa comunale giardino botanico',                             kind: 'NATURA' },
  shopping:  { query: 'artigianato boutique mercato negozi tipici',                         kind: 'CULTURA' },
  nightlife: { query: 'bar cocktail pub locale musica vino',                                kind: 'FOOD' },
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

// Gate NARRATORE/POI — un'area geografica non è una tappa.
//
// BLACKLIST_TYPES (aiRecommendationService.js:131) ha un'altra semantica:
// servizi commerciali che non hanno senso come tappa (officine, banche,
// scuole). Non conteneva — e non deve contenere — entità geografiche.
// Senza questa lista, textsearch "… Ippocampo" poteva restituire la frazione
// stessa come candidato: nome = nome della città, nessun luogo da visitare.
//
// NON incluso `route`: una via può essere una tappa legittima.
// NON inclusi `point_of_interest`, `establishment`, `premise`: Google li mette
// anche sui luoghi veri (es. Museo Robert Capa ha `point_of_interest`).
const GEO_ENTITY_TYPES = new Set([
  'locality',
  'sublocality', 'sublocality_level_1', 'sublocality_level_2',
  'sublocality_level_3', 'sublocality_level_4',
  'administrative_area_level_1', 'administrative_area_level_2',
  'administrative_area_level_3', 'administrative_area_level_4',
  'administrative_area_level_5',
  'political',
  'postal_code', 'postal_code_prefix', 'postal_code_suffix',
  'neighborhood',
  'country', 'continent', 'archipelago',
]);

// Gate NARRATORE/POI — type che indicano un LUOGO REALE, visitabile.
//
// Guard anti-falso-positivo di isCityItself: un ristorante che si chiama come
// il paese resta un ristorante. "Trattoria Ippocampo" a Ippocampo e' un posto
// vero; "Ippocampo" con type `locality` no. Il discrimine e' il type, non il
// nome — quindi in presenza di uno di questi il confronto sul nome NON si fa
// nemmeno.
//
// Composizione: gli 11 type nominati nel gate + quelli che
// mapGoogleTypeToOurType (sopra) gia' riconosce come luogo.
const REAL_PLACE_TYPES = new Set([
  'restaurant', 'bar', 'cafe', 'museum', 'church', 'park',
  'tourist_attraction', 'lodging', 'store', 'meal_takeaway', 'art_gallery',
  'place_of_worship', 'mosque', 'synagogue', 'hindu_temple',
  'bakery', 'food', 'meal_delivery', 'night_club',
  'natural_feature', 'campground',
]);

// Gate NARRATORE/POI — affissi puramente geografici attorno al nome citta'.
// Lista chiusa: solo le forme dichiarate nel gate, nessuna variante inventata.
// Gli accenti sono gia' stati rimossi quando questi pattern vengono applicati
// ("localita", non "località").
const GEO_AFFIX_PREFIXES = [
  /^comune di\s+/,
  /^frazione di\s+/,
  /^frazione\s+/,
  /^localita di\s+/,
  /^localita\s+/,
];
// Suffisso sigla provinciale: "Ippocampo (FG)". Volutamente stretto (1-4
// lettere) per non mangiare parentesi che fanno parte del nome di un locale.
const GEO_AFFIX_SUFFIX = /\s*\([a-z]{1,4}\)$/;

// Normalizza per confronto: accenti via, minuscolo, spazi collassati.
const normalizeForNameMatch = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacritici combinanti
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

// Gate NARRATORE/POI — il candidato E' la citta' stessa?
//
// Invariante trovato in diagnosi sul caso Ippocampo: quando il titolo del POI
// coincide col badge localita', l'entita' non e' un luogo — e' il posto in cui
// ti trovi. Seconda rete rispetto a GEO_ENTITY_TYPES, per il caso in cui
// Google restituisca la localita' senza un type geografico.
//
// @returns {boolean} true = DA SCARTARE.
const isCityItself = (candidate, cityName) => {
  // Senza il dato non si giudica.
  const city = normalizeForNameMatch(cityName);
  if (!city) return false;

  const types = Array.isArray(candidate?.types) ? candidate.types : [];
  // Guard anti-falso-positivo: ha un type di luogo reale → non si guarda il nome.
  if (types.some(t => REAL_PLACE_TYPES.has(t))) return false;

  const rawName = normalizeForNameMatch(candidate?.name);
  if (!rawName) return false;

  // Prova il nome nudo e le sue forme senza affissi geografici.
  let stripped = rawName.replace(GEO_AFFIX_SUFFIX, '').trim();
  for (const prefix of GEO_AFFIX_PREFIXES) {
    if (prefix.test(stripped)) {
      stripped = stripped.replace(prefix, '').trim();
      break; // un solo affisso: "frazione di comune di X" non e' una forma reale
    }
  }

  if (rawName !== city && stripped !== city) return false;

  console.warn(`[Gate NARRATORE/POI] scartato "${candidate?.name || '?'}" → e' la citta' stessa ("${cityName}") — types=[${types.join('|')}]`);
  return true;
};

// Gate TOUR-SENSATO (F13) — POI che esistono ma non si visitano.
//
// Device 16/08, SurpriseTour a Ippocampo: fra le 4 tappe c'era
// "VILLAGGIO IPPOCAMPO - Supercondominio". Types reali (sonda via proxy):
// ['establishment', 'lodging', 'point_of_interest'] — identici a quelli di
// "B&B Centro Storico" a Manfredonia. Nessuno tocca BLACKLIST_TYPES (servizi
// commerciali) ne' GEO_ENTITY_TYPES (aree geografiche): passavano lisci.
//
// La regola e' CONDIZIONALE e non una lista secca, perche' il type che li
// tradisce e' lo stesso che portano i posti buoni: "Beach Club Ippocampo" ha
// lodging E travel_agency, ma anche bar/food/restaurant. Una blacklist su
// `lodging` avrebbe ucciso lidi, agriturismi e rifugi.
//
// point_of_interest ed establishment NON sono nella lista di salvataggio: li
// porta anche il condominio, quindi includerli renderebbe la regola inerte.
// E' anche la lezione di Troina — 'Ruderi Monastero Nuovo' e 'Madonna della
// Catena' hanno SOLO ['point_of_interest'], quindi quel type non discrimina
// in nessuna delle due direzioni.
const NON_VISITABLE_TYPES = new Set([
  'lodging',
  'travel_agency',
]);

// I type che salvano: se ce n'e' almeno uno, il posto si visita davvero.
const VISITABLE_TYPES = new Set([
  'restaurant', 'bar', 'cafe', 'food', 'bakery',
  'natural_feature', 'park', 'campground',
  'museum', 'art_gallery', 'church', 'place_of_worship', 'tourist_attraction',
]);

// ─── FILTRI ────────────────────────────────────────────────────────────────────
const passesHardExclusions = (c) => {
  // DVAI-057: solo attività operative.
  if (c.business_status && c.business_status !== 'OPERATIONAL') return false;
  // DVAI-051: nessuna officina/banca/ospedale/etc.
  if (Array.isArray(c.types) && c.types.some(t => BLACKLIST_TYPES.has(t))) return false;
  // Gate NARRATORE/POI: nessuna area geografica (località, comune, CAP…).
  if (Array.isArray(c.types)) {
    const hitGeo = c.types.find(t => GEO_ENTITY_TYPES.has(t));
    if (hitGeo) {
      console.warn(`[Gate NARRATORE/POI] scartato "${c.name || '?'}" → area geografica (${hitGeo}) — types=[${c.types.join('|')}]`);
      return false;
    }
  }
  // Gate TOUR-SENSATO: alloggi e agenzie che non sono anche un posto da visitare.
  if (Array.isArray(c.types)) {
    const hitNonVisit = c.types.find(t => NON_VISITABLE_TYPES.has(t));
    if (hitNonVisit && !c.types.some(t => VISITABLE_TYPES.has(t))) {
      console.warn(`[Gate TOUR-SENSATO] scartato "${c.name || '?'}" → non visitabile (${hitNonVisit}, nessun type di visita) — types=[${c.types.join('|')}]`);
      return false;
    }
  }
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
// ─── Gate INTENT (28/08) — TAGLIO DI SANITA' GEOGRAFICA ──────────────────────
//
// Places `textsearch` riceve `location` + `radius`, ma quelli sono un BIAS di
// rilevanza, NON un vincolo: Google puo' restituire risultati fuori raggio se il
// testo matcha bene. E il testo contiene il nome della localita'
// (`${query} ${cityName}`), quindi per un borgo il cui nome e' anche un nome
// commerciale comune la ricerca trova omonimi in tutta Italia — e li trova con
// ottima corrispondenza testuale.
//
// Device Ippocampo: "L'Ippocampo" e "Ristorante Pizzeria Ippocampo" a 185, 279,
// 513 e 532 km dal centro.
//
// PERCHE' IL TAGLIO VA QUI, prima di applyQualityThreshold e non dopo:
// il rumore non gonfia soltanto un conteggio. Fa DUE danni prima che qualcuno
// lo veda —
//   1. entra nel DENOMINATORE della soglia, e lo scale-down decide su di lui;
//   2. RUBA SLOT di `maxResults`: un ristorante omonimo con 2000 recensioni a
//      4.6 ha un qualityScore altissimo, sale in cima al ranking e caccia fuori
//      un POI locale vero.
// `applyRadiusFilter` lo scarta molto piu' tardi, in aiRecommendationService,
// quando il danno e' gia' fatto.
//
// PERCHE' 100 km NON NASCONDE SCARTI VERI — il margine, dichiarato:
// il raggio massimo che il sistema puo' applicare e' `R_wider` in
// applyRadiusFilter, cioe' 20 km (citta') o 12 km (borgo). Fra 20 e 100 c'e' un
// fattore 5: NULLA che applyRadiusFilter avrebbe potuto accettare cade qui
// dentro. Questo taglio rimuove rumore, non decisioni di prodotto — le
// decisioni restano tutte a valle, dove si vedono.
const SANITY_KM = 100;

// Haversine locale. Il file non importa nulla di proposito (e' il livello piu'
// basso, sotto tourShape): duplicare dieci righe costa meno di una dipendenza
// circolare fra services.
const kmBetween = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// Rimuove i candidati oltre SANITY_KM dal centro.
//
// CONDIZIONE OBBLIGATORIA: senza un centro valido il taglio NON GIRA e ritorna
// il pool intatto. Un predicato che non puo' decidere non deve decidere —
// scartare per una distanza non calcolabile sarebbe inventare una ragione.
// Stessa scelta di `applyRadiusFilter` per il caso `cityCenter` assente, e vale
// anche per il singolo candidato: coordinate mancanti → passa, non si giudica.
//
// Il log e' una CATEGORIA A SE', mai fuso con [Qualita]: se il rumore sparisse
// dentro quel conteggio passeremmo da un numero gonfiato a un numero che
// nasconde, che e' lo stesso difetto girato dall'altra parte.
export const applyGeoSanity = (candidates, lat, lng, cityName) => {
  if (!Array.isArray(candidates) || candidates.length === 0) return candidates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return candidates;

  const lontani = [];
  const tenuti = candidates.filter(c => {
    const cLat = c?.geometry?.location?.lat ?? c?.latitude ?? c?.lat;
    const cLng = c?.geometry?.location?.lng ?? c?.longitude ?? c?.lng;
    if (!Number.isFinite(cLat) || !Number.isFinite(cLng)) return true;
    const d = kmBetween(lat, lng, cLat, cLng);
    if (d > SANITY_KM) { lontani.push({ nome: c?.name || c?.title || '?', d }); return false; }
    return true;
  });

  if (lontani.length > 0) {
    const peggiore = lontani.reduce((a, b) => (b.d > a.d ? b : a));
    console.warn(
      `[Places] rumore geografico: ${lontani.length} oltre ${SANITY_KM} km` +
      ` | piu' lontano: "${peggiore.nome}" ${peggiore.d.toFixed(0)} km` +
      ` | citta'=${cityName || '?'}`
    );
  }
  return tenuti;
};

// Gate INTENT (28/08) — traccia degli scarti per SOGLIA.
//
// Prima questa funzione tagliava senza lasciare traccia per-POI, mentre
// `[AI-radius] Scartata` logga ogni singolo scarto per distanza. Due filtri sullo
// stesso pool, uno parlante e uno muto: e' il muto che fa sparire contenuto
// richiesto dall'utente senza che nessuno lo sappia.
//
// AGGREGATO, non per-POI, e la scelta e' dichiarata: su 60 candidati per
// generazione una riga per scarto sarebbe rumore che nessuno legge, e il rumore
// e' l'altro modo di essere invisibili. L'aggregato dice quanti e con che
// soglia; il campione dei tre piu' alti dice CHI, che e' il dato diagnostico —
// se fra gli scartati c'e' la famiglia che l'utente ha chiesto, si vede subito.
//
// La stringa si costruisce solo se ci sono scarti: a pool pulito costo zero.
const logScartiSoglia = (candidates, level1, kind, t, isSmall) => {
  const scartati = candidates.length - level1.length;
  if (scartati <= 0) return;
  const fuori = candidates
    .filter(c => !((c.rating || 0) >= t.minRating && (c.user_ratings_total || 0) >= t.minTotal))
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 3)
    .map(c => `"${c.name || c.title || '?'}" (r=${c.rating ?? '?'}, n=${c.user_ratings_total ?? '?'})`)
    .join(', ');
  console.warn(
    `[Qualita] scartati ${scartati}/${candidates.length} | kind=${kind} ` +
    `soglia=${t.minRating}/${t.minTotal} (${isSmall ? 'small' : 'large'}) livello=1 | i piu' alti: ${fuori}`
  );
};

const applyQualityThreshold = (candidates, kind, isSmall) => {
  const t = QUALITY_THRESHOLDS[kind][isSmall ? 'small' : 'large'];
  const level1 = candidates.filter(c =>
    (c.rating || 0) >= t.minRating && (c.user_ratings_total || 0) >= t.minTotal);
  // Solo log: il valore di ritorno e la condizione qui sotto sono invariati.
  logScartiSoglia(candidates, level1, kind, t, isSmall);
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
    // Gate TOUR-SENSATO — la textsearch restituisce gia' opening_hours su TUTTI
    // i risultati (verificato via proxy su Manfredonia: 20/20), ma solo nella
    // forma { open_now: bool }: nessun `periods`, quindi nessun orario di
    // chiusura. Finora veniva scartato qui, e il prompt del selettore chiedeva
    // "MAI suggerire posti chiusi ora" senza dare al modello il dato per
    // saperlo. Costo zero: e' gia' nella risposta che paghiamo.
    // closingTimeTodayHH resta fuori scope: richiederebbe place/details per
    // candidato (20 chiamate per tour).
    open_now: place.opening_hours?.open_now ?? null,
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
  // Gate INTENT (28/08) — il bias della textsearch segue il raggio MASSIMO del
  // filtro, non un numero suo.
  //
  // Prima: 3000 (borgo) / 5000 (citta'), mentre applyRadiusFilter accetta fino a
  // 12 / 20 km. Chiedevamo a Google POI entro 3 km e poi ne accettavamo fino a
  // 12: due filtri nella stessa catena che tiravano in direzioni opposte, e il
  // PRIMO era il piu' stretto — cioe' si scartava prima di decidere.
  //
  // `location` + `radius` sono un BIAS di rilevanza, non un vincolo: allargarli
  // non fa entrare tutto, dice a Google dove concentrarsi. Misurato sul campo:
  //   Ippocampo  "chiesa antica"  bias  3 km ->  1 risultato (13.5 km)
  //                               bias 12 km ->  4 risultati (12.6-14.1 km)
  //   Manfredonia                 3 km -> 20   |  12 km -> 20   (invariato)
  //   Venezia                     3 km -> 20   |  12 km -> 20   (invariato)
  // Dove l'offerta e' densa il pool NON cresce — Google satura a 20 risultati e
  // li prende gia' tutti vicini. Cresce solo dove prima era vuoto.
  //
  // Nessun margine oltre R_wider: il bias deve coprire il raggio massimo
  // APPLICABILE, e quello e' R_wider. Un margine in piu' sarebbe un numero
  // inventato senza un dato che lo giustifichi. Se un giorno il filtro superera'
  // R_wider, il test che lega i due diventa rosso e si aggiornano insieme.
  const radius = radiusMeters ?? widerRadiusKm(isSmall) * 1000;

  // Cache key differenziata: customQuery ha suo namespace (non collide con temi).
  const cacheKey = customQuery
    ? `gg1_${cityName.replace(/\s+/g, '_')}_q_${slugForCache(effectiveQuery)}_${isSmall ? 's' : 'l'}`
    : `gg1_${cityName.replace(/\s+/g, '_')}_${themeType}_${isSmall ? 's' : 'l'}`;
  const cached = loadFromCache(cacheKey);
  if (cached) return cached;

  // Gate V: timeout 5s. Prima nessun timeout → una textsearch appesa bloccava
  // discoverAllThemes (Home) e generateWeatherSocialTip (notifiche).
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const url = buildPlacesProxyUrl({
      path: 'place/textsearch',
      query: `${effectiveQuery} ${cityName}`,
      location: `${lat},${lng}`,
      radius: String(radius),
    });
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`textsearch HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'OK' || !Array.isArray(data.results)) {
      throw new Error(`textsearch status=${data.status}`);
    }

    // 1. Esclusioni hard (business_status, blacklist types, aree geografiche, rumore).
    //    Gate NARRATORE/POI: isCityItself gira QUI, prima di applyQualityThreshold —
    //    un candidato destinato allo scarto non deve essere contato per decidere
    //    lo scale-down (altrimenti la localita' stessa "aiuta" a restare al
    //    livello 1 e poi sparisce, falsando la soglia per gli altri).
    const cleaned = applyGeoSanity(
      data.results
        .filter(passesHardExclusions)
        .filter(c => !isCityItself(c, cityName)),
      lat, lng, cityName,
    );
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

// Gate P.1: dedup globale POI cross-tema via place_id. Un POI compare in un
// solo tour: quello dove il suo qualityScore (rating × ln(1+total)) è massimo.
// Prima: "Duomo di Siracusa" appariva sia in walking che in art come featured;
// due card mostravano lo stesso POI di punta e la stessa cover Places.
// Effetto atteso: temi che perdono tutti i POI si spengono (filter(Boolean)
// downstream). Meglio meno tour distinti che tour ridondanti.
const dedupePOIsAcrossThemes = (allPOIs) => {
  const bestByPlaceId = new Map();
  for (const [theme, pois] of Object.entries(allPOIs)) {
    if (!Array.isArray(pois)) continue;
    for (const poi of pois) {
      const pid = poi.place_id || poi.googlePlaceId;
      if (!pid) continue;
      const score = qualityScore(poi);
      const current = bestByPlaceId.get(pid);
      if (!current || score > current.score) {
        bestByPlaceId.set(pid, { poi, theme, score });
      }
    }
  }
  const deduped = Object.fromEntries(Object.keys(allPOIs).map(t => [t, []]));
  for (const { poi, theme } of bestByPlaceId.values()) {
    deduped[theme].push(poi);
  }
  // Riordina ogni tema per qualityScore (sort locale post-dedup, preserva
  // l'ordinamento tra POI rimasti nel tema).
  for (const theme of Object.keys(deduped)) {
    deduped[theme].sort((a, b) => qualityScore(b) - qualityScore(a));
  }
  return deduped;
};

const discoverAllThemes = async (cityName, lat, lng) => {
  // Gate P.1: 4 temi (walking morto). 3 se `romance` non produce POI distinti
  // dopo la dedup → si spegne downstream.
  const themes = ['food', 'cultura', 'romance', 'nature'];
  const results = {};
  // DVAI-060: motore primario Google-first; fallback a discoverPOIs interno.
  await Promise.all(themes.map(async (theme) => {
    results[theme] = await discoverRealPOIs(cityName, lat, lng, theme);
  }));
  return dedupePOIsAcrossThemes(results);
};

// Gate N.1 — Fetch opening_hours.periods di un POI via place/details.
// Estrae l'orario di chiusura di OGGI se disponibile.
//
// Response Places shape (semplificata):
//   { result: { opening_hours: { periods: [
//     { open: { day: 0, time: '1000' }, close: { day: 0, time: '2200' } }, ...
//   ] } } }
// day: 0=domenica, 1=lunedì, ..., 6=sabato (convention Google).
// time: HHmm (es. '2200' = 22:00).
//
// @param {string} placeId
// @returns {Promise<{ openNow: boolean|null, closingTimeTodayHH: string|null }>}
export const fetchPlaceOpeningHours = async (placeId) => {
  if (!placeId || !isPlacesProxyEnabled()) return { openNow: null, closingTimeTodayHH: null };
  // Gate BB.c (U.1c): cache 24h per place_id. Gli orari di una pasticceria
  // non cambiano ogni cinque minuti. Prima: zero cache -> 3 call/notifica
  // moltiplicato per ogni rigenerazione. Ora: hit rate atteso >95% su
  // utenti ripetuti dentro la stessa citta'.
  // NOTA: openNow (istantaneo) resta nel payload ma perde freschezza dopo
  // ~30 min. Preferiamo closingTimeTodayHH (strutturale) come locked Gate N.1.
  const cacheKey = `oh_${placeId}`;
  const cached = loadFromCache(cacheKey);
  if (cached) return cached;
  // Gate V: timeout 5s (AbortController).
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const url = buildPlacesProxyUrl({
      path: 'place/details',
      place_id: placeId,
      fields: 'opening_hours',
    });
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return { openNow: null, closingTimeTodayHH: null };
    const data = await res.json();
    const oh = data?.result?.opening_hours;
    if (!oh) return { openNow: null, closingTimeTodayHH: null };

    const openNow = typeof oh.open_now === 'boolean' ? oh.open_now : null;

    // Cerca l'orario di chiusura del GIORNO CORRENTE.
    const today = new Date().getDay(); // 0=domenica come Google
    const periods = Array.isArray(oh.periods) ? oh.periods : [];
    const todayPeriod = periods.find(p => p?.open?.day === today && p?.close?.time);
    let closingTimeTodayHH = null;
    if (todayPeriod?.close?.time) {
      // '2200' → '22:00'
      const t = String(todayPeriod.close.time);
      if (t.length === 4) closingTimeTodayHH = `${t.slice(0, 2)}:${t.slice(2)}`;
    }
    const result = { openNow, closingTimeTodayHH };
    saveToCache(cacheKey, result);
    return result;
  } catch (e) {
    clearTimeout(timeoutId);
    const reason = e.name === 'AbortError' ? 'timeout (5s)' : e.message;
    console.warn(`[fetchPlaceOpeningHours] ${placeId} failed: ${reason}`);
    return { openNow: null, closingTimeTodayHH: null };
  }
};

// Gate N.2 — Fetch dei dati completi per una tappa del tour (foto, indirizzo,
// tipi, opening_hours). Chiamata singola place/details per POI — usata dal
// precompute deterministico delle notifiche. Retrocompat con opening_hours.
//
// Return shape allineato alle stops del motore (buildPOIFromCandidate).
//
// @param {string} placeId
// @param {string} cityName
// @returns {Promise<object|null>}
export const fetchPlaceDetailsForTour = async (placeId, cityName, candidateHints = {}) => {
  if (!placeId || !isPlacesProxyEnabled()) return null;
  // Gate BB.d (U.1d): cache 24h per place_id. Dettagli di un POI non cambiano
  // ogni cinque minuti (nome/coordinate/foto/tipi sono stabili nel giro di
  // giorni). Il ricalcolo distanze e' client-side, non richiede questa call.
  //
  // Gate BB.e (U.1e): candidateHints = { rating, user_ratings_total } passati
  // dal caller (chosenPois dal textsearch iniziale). Evita di ripagare
  // Atmosphere SKU per dati gia' in memoria.
  const cacheKey = `pd_${placeId}`;
  const cached = loadFromCache(cacheKey);
  if (cached) {
    // Anche su cache hit, i hints del candidato prevalgono se piu' freschi
    // (di solito uguali, ma il caller ha diritto di override).
    return {
      ...cached,
      rating: Number.isFinite(candidateHints.rating) ? candidateHints.rating : cached.rating,
      user_ratings_total: Number.isFinite(candidateHints.user_ratings_total)
        ? candidateHints.user_ratings_total
        : cached.user_ratings_total,
    };
  }
  // Gate V: timeout 5s (AbortController).
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const url = buildPlacesProxyUrl({
      path: 'place/details',
      place_id: placeId,
      // Gate BB.e (U.1e): SOLO Basic Data ($0) + Contact opening_hours ($0.003).
      // Rimossi rating/user_ratings_total (Atmosphere $0.005 fatturato al max
      // SKU): quei dati arrivano gia' dal candidato del textsearch iniziale
      // (buildPOIFromCandidate) e vengono propagati fino al tour precomputato
      // via chosenPois. Payare due volte lo stesso dato era spreco puro.
      // Basic: name, geometry, photos, types, formatted_address, business_status.
      // Contact: opening_hours (necessario per closingTimeTodayHH).
      fields: 'name,geometry,photos,types,formatted_address,business_status,opening_hours',
    });
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.result;
    if (!r) return null;

    const lat = r.geometry?.location?.lat;
    const lng = r.geometry?.location?.lng;
    const photoRef = r.photos?.[0]?.photo_reference;
    const photoUrl = photoRef
      ? buildPlacesProxyUrl({ path: 'place/photo', maxwidth: '600', photo_reference: photoRef })
      : null;

    // closing time del giorno corrente (se disponibile)
    const oh = r.opening_hours;
    const today = new Date().getDay();
    const periods = Array.isArray(oh?.periods) ? oh.periods : [];
    const todayPeriod = periods.find(p => p?.open?.day === today && p?.close?.time);
    let closingTimeTodayHH = null;
    if (todayPeriod?.close?.time) {
      const t = String(todayPeriod.close.time);
      if (t.length === 4) closingTimeTodayHH = `${t.slice(0, 2)}:${t.slice(2)}`;
    }

    // Gate BB.e (U.1e): rating/user_ratings_total NON piu' fetchati (Basic-only).
    // Arrivano da candidateHints (candidato del textsearch) o cadono a 0
    // (accettabile: rating a 0 su una notifica precomputed non blocca nulla,
    // il tour usa i POI verificati dalla notifica-vera che ha gia' rating).
    const result = {
      id: `google-${placeId}`,
      name: r.name,
      title: r.name,
      description: '', // Blocco 2.7 farà il narratore (fatti, non poesia).
      lat, lng,
      latitude: lat, longitude: lng,
      type: mapGoogleTypeToOurType(r.types),
      rating: Number.isFinite(candidateHints.rating) ? candidateHints.rating : 0,
      user_ratings_total: Number.isFinite(candidateHints.user_ratings_total) ? candidateHints.user_ratings_total : 0,
      business_status: r.business_status || 'OPERATIONAL',
      types: r.types || [],
      city: cityName,
      place_id: placeId,
      googlePlaceId: placeId,
      googlePhoto: photoUrl,
      image: photoUrl,
      address: r.formatted_address || null,
      closingTimeTodayHH,
      openNow: typeof oh?.open_now === 'boolean' ? oh.open_now : null,
      // Gate RAGGIO DIFF 1a — `suggestedMinutes: 30` RIMOSSO. "Si affinera' se
      // serve" non e' mai successo, e intanto ogni POI dichiarava mezz'ora di
      // visita indipendentemente da cosa fosse. La durata ora si calcola dai
      // `types` qui sopra, in src/lib/tourTiming.js.
    };
    saveToCache(cacheKey, result);
    return result;
  } catch (e) {
    clearTimeout(timeoutId);
    const reason = e.name === 'AbortError' ? 'timeout (5s)' : e.message;
    console.warn(`[fetchPlaceDetailsForTour] ${placeId} failed: ${reason}`);
    return null;
  }
};

export const placesDiscoveryService = {
  discoverPOIs,           // legacy AI-first (usato come fallback interno)
  discoverRealPOIs,       // DVAI-060 Google-first
  discoverAllThemes,
  enrichWithPhotos,
  fetchPlacePhoto,
  fetchPlaceOpeningHours, // Gate N.1
  fetchPlaceDetailsForTour, // Gate N.2 (precompute deterministico)
};

// Export nominato per test unitari senza toccare la superficie del service.
export {
  discoverRealPOIs,
  qualityScore,
  passesHardExclusions,
  applyQualityThreshold,
  QUALITY_THRESHOLDS,
  GEO_ENTITY_TYPES, // Gate NARRATORE/POI
  REAL_PLACE_TYPES, // Gate NARRATORE/POI
  isCityItself,     // Gate NARRATORE/POI
  NON_VISITABLE_TYPES, // Gate TOUR-SENSATO
  VISITABLE_TYPES,     // Gate TOUR-SENSATO
};
