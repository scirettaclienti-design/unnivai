// src/services/aiRecommendationService.js
//
// DVAI-001 — Tutte le chiamate OpenAI ora passano per la Supabase Edge Function
// /functions/v1/openai-proxy in modo che la API key non sia mai nel bundle client.
// DVAI-010 — Aggiunta analyzeBusinessDescription() mancante.
// DVAI-020 — Modello aggiornato da gpt-3.5-turbo a gpt-4o-mini.

import { supabase } from '../lib/supabase';

const DOVEVAI_NARRATOR_PROMPT = `Sei la voce di DoveVai. Scrivi curiosità storiche ironiche e colte.
Evita i cliché come 'storia millenaria'. Focus su aneddoti bizzarri.
Max 150 car per la nota, 80 car per il fun fact.`;

// DVAI-049 / DVAI-050 — Places proxy URL.
// In dev: middleware Vite su /__dev/places-proxy (sempre attivo).
// In prod: Edge Function Supabase places-proxy, gated da VITE_PLACES_PROXY_ENABLED.
// Quando il flag prod è OFF, isPlacesProxyEnabled() ritorna false e i caller
// (verifyPOIWithPlaces / fetchPlacePhoto) saltano la chiamata senza bloccare l'UI.
export const isPlacesProxyEnabled = () => {
    if (import.meta.env.DEV) return true;
    const flag = import.meta.env.VITE_PLACES_PROXY_ENABLED;
    return flag === 'true' || flag === true;
};

export const getPlacesProxyBase = () => {
    if (import.meta.env.VITE_PLACES_PROXY_URL) return import.meta.env.VITE_PLACES_PROXY_URL;
    if (import.meta.env.DEV) return '/__dev/places-proxy';
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/places-proxy`;
};

export const buildPlacesProxyUrl = (params) => {
    const qs = new URLSearchParams(params).toString();
    return `${getPlacesProxyBase()}?${qs}`;
};

// ─── Proxy helper ─────────────────────────────────────────────────────────────
/**
 * Chiama la Supabase Edge Function openai-proxy invece di OpenAI direttamente.
 * La API key rimane sul server; il bundle client non la contiene mai.
 *
 * @param {object} payload - Stesso body che manderesti ad OpenAI + { endpoint }
 * @param {AbortSignal} [signal]
 * @returns {Promise<object>} La risposta JSON di OpenAI
 */
const callOpenAIProxy = async (payload, signal) => {
  const { data: { session } } = await supabase.auth.getSession();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Configurazione mancante: VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY non impostati');
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': anonKey,
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  console.log('[AI Proxy] Chiamata →', `${supabaseUrl}/functions/v1/openai-proxy`, session ? '(autenticato)' : '(anonimo)');

  const response = await fetch(`${supabaseUrl}/functions/v1/openai-proxy`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ endpoint: '/chat/completions', ...payload }),
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const errMsg = `Proxy ${response.status}: ${errBody?.error ?? response.statusText}`;
    console.error('[AI Proxy] Errore:', errMsg);
    throw new Error(errMsg);
  }

  return response.json();
};

// Gate D-5: CITY_POIS + generateItineraryLocal RIMOSSI.
// Prima erano un fallback statico attivato per errori non-quota nel motore
// (timeout OpenAI 35s, rete, JSON parse). Restituiva tour da CITY_POIS
// hardcoded con `_isFallback = true`, ma 3 chiamanti su 4 (QuickPath,
// SurpriseTour, DashboardUser) NON leggevano quel flag e lo mostravano
// come tour reale. Ora ogni fallimento del motore rilancia un errore onesto:
// la UI mostra un messaggio, mai un tour finto.

// ─── DVAI-034 / DVAI-051: Verifica POI con Google Places + type-check ───────────
/**
 * Verifica un singolo POI contro Google Places Text Search.
 * Ritorna true se il POI esiste E il suo tipo è coerente con quanto detto dall'AI.
 *
 * Type-check (DVAI-051): l'AI può fornire un nome che esiste su Google ma di tipo
 * completamente diverso (es. "Fratelli Puglisi gelateria" mentre il vero locale è
 * un'officina). Mappiamo poi.type → set di Google `types` attesi; se l'intersezione
 * è vuota scartiamo il POI.
 */
// DVAI-051: i types `establishment` e `point_of_interest` sono ~universali su Google,
// quindi NON vanno mai usati come whitelist (porterebbero a falsi positivi).
const EXPECTED_GOOGLE_TYPES = {
    food:       ['restaurant','cafe','bakery','meal_takeaway','meal_delivery','food','bar','ice_cream','night_club','liquor_store'],
    cibo:       ['restaurant','cafe','bakery','meal_takeaway','meal_delivery','food','bar','ice_cream'],
    // DVAI-051: cultura/storia/arte/natura accettano `point_of_interest` perché Google
    // spesso lo usa come unico type su attrazioni minori (es. teatri, palazzi storici).
    // La blacklist negativa resta a tagliare officine/banche/uffici comunali.
    cultura:    ['museum','art_gallery','tourist_attraction','church','place_of_worship','library','university','synagogue','hindu_temple','mosque','point_of_interest'],
    storia:     ['museum','tourist_attraction','church','place_of_worship','cemetery','synagogue','hindu_temple','mosque','point_of_interest'],
    arte:       ['museum','art_gallery','tourist_attraction','point_of_interest'],
    natura:     ['park','natural_feature','tourist_attraction','campground','zoo','aquarium','point_of_interest'],
    shopping:   ['store','shopping_mall','clothing_store','jewelry_store','book_store','home_goods_store','department_store','supermarket'],
    // permissivo: non blocchiamo
    relax:      [],
    place:      [],
    default:    [],
};

// DVAI-051: blacklist sempre attiva — se Google classifica il candidato come uno di
// questi tipi, lo scartiamo a prescindere dal type richiesto. Sono attività che non
// hanno senso come tappa turistica di un tour AI.
// DVAI-060: esportata per essere riusata dal motore Google-first
// (placesDiscoveryService.discoverRealPOIs) prima della soglia qualità.
export const BLACKLIST_TYPES = new Set([
    'car_repair','car_dealer','car_rental','car_wash','gas_station',
    'hospital','doctor','dentist','physiotherapist','pharmacy','veterinary_care',
    'bank','atm','insurance_agency','accounting','lawyer','real_estate_agency',
    'funeral_home','storage','parking','moving_company','locksmith',
    'roofing_contractor','electrician','plumber','painter','general_contractor',
    'embassy','post_office','local_government_office','courthouse','police',
    'school','primary_school','secondary_school',
]);

// DVAI-057: export nominato per test unitari (rimane usato internamente sotto).
export const verifyPOIWithPlaces = async (poi, city) => {
    try {
        // DVAI-050: se il proxy Places è OFF in prod, skip silenzioso (best-effort)
        if (!isPlacesProxyEnabled()) return true;
        // DVAI-060 F2: skip la verifica se il POI viene dal motore Google-first —
        // ha già `googlePlaceId` (canonicizzato da discoverRealPOIs con textsearch
        // + business_status + soglia qualità). Rifare findplacefromtext qui è pura
        // ridondanza + costo Google inutile. Vantaggio: -5 chiamate per tour AI.
        if (poi.googlePlaceId) return true;
        // DVAI-049: Places via proxy (CORS bloccato sull'endpoint REST diretto)
        const searchQuery = poi.photo_query || `${poi.title} ${city} Italy`;
        const proxyUrl = buildPlacesProxyUrl({
            path: 'place/findplacefromtext',
            input: searchQuery,
            inputtype: 'textquery',
            // DVAI-051: aggiunto `types` (Basic Data, gratis) per il type-check.
            // DVAI-057: aggiunto `business_status` per scartare CLOSED_TEMPORARILY / CLOSED_PERMANENTLY
            // ("esiste su Google" ≠ "aperto oggi"). Senza il campo nella field mask Google non lo ritorna.
            fields: 'name,geometry,place_id,rating,opening_hours,photos,types,business_status',
            locationbias: `circle:50000@${poi.latitude},${poi.longitude}`,
        });
        const res = await fetch(proxyUrl);
        if (!res.ok) return true;

        const data = await res.json();
        if (data.status !== 'OK' || !data.candidates?.length) {
            console.warn(`[DVAI-034] POI non trovato su Places: "${poi.title}" → rimosso`);
            return false;
        }

        const place = data.candidates[0];
        const placeTypes = Array.isArray(place.types) ? place.types : [];

        // DVAI-057: scarta luoghi che Google conosce ma che non sono più operativi
        // (CLOSED_TEMPORARILY / CLOSED_PERMANENTLY). Se il campo manca (proxy vecchio
        // o Google non lo ritorna) → tratta come OPERATIONAL per compat (non peggiora
        // il baseline: prima non c'era filtro affatto).
        if (place.business_status && place.business_status !== 'OPERATIONAL') {
            console.warn(`[DVAI-057] POI "${poi.title}" → business_status=${place.business_status} → scartato (chiuso)`);
            return false;
        }

        // DVAI-051: blacklist sempre attiva — se il candidato è un servizio commerciale
        // non turistico (officina, banca, ospedale…), scarta a prescindere.
        const hitBlacklist = placeTypes.find(t => BLACKLIST_TYPES.has(t));
        if (hitBlacklist) {
            console.warn(`[DVAI-051] POI "${poi.title}" → Google=${placeTypes.join('|')} (${hitBlacklist}) → scartato (blacklist)`);
            return false;
        }

        // DVAI-051: type-check positivo. Se l'AI ha dichiarato una famiglia (es. food,
        // cultura, natura) verifico che il candidato Google contenga almeno un tipo
        // della famiglia attesa.
        const aiType = (poi.type || '').toLowerCase();
        const expected = EXPECTED_GOOGLE_TYPES[aiType];
        if (expected && expected.length > 0) {
            const hasMatch = placeTypes.some(t => expected.includes(t));
            if (!hasMatch) {
                console.warn(`[DVAI-051] POI "${poi.title}": AI=${aiType}, Google=${placeTypes.join('|')} → scartato (no match)`);
                return false;
            }
        }

        // Correggi coordinate se distanti > 5km
        if (place.geometry?.location) {
            const { lat, lng } = place.geometry.location;
            const distKm = Math.sqrt(
                Math.pow((lat - poi.latitude) * 111, 2) +
                Math.pow((lng - poi.longitude) * 111 * Math.cos(poi.latitude * Math.PI / 180), 2)
            );
            if (distKm > 5) {
                poi.latitude = lat;
                poi.longitude = lng;
            }
        }

        // Arricchisci con dati Google Places
        if (place.place_id) poi.googlePlaceId = place.place_id;
        if (place.rating) poi.googleRating = place.rating;
        if (place.opening_hours?.open_now !== undefined) poi.openNow = place.opening_hours.open_now;
        if (place.photos?.[0]?.photo_reference) {
            poi.googlePhoto = buildPlacesProxyUrl({
                path: 'place/photo',
                maxwidth: '600',
                photo_reference: place.photos[0].photo_reference,
            });
        }

        return true;
    } catch {
        return true;
    }
};

// DVAI-050 — Cache TTL 24h del tour insider per (city + dna_hash) e quota.
// DVAI-055-b: prefix bumped da 'unnivai_insider_' per invalidare i tour cached
// generati prima del filtro raggio centralizzato (i "cattivi" con tappe a 50-70 km).
// DVAI-060 F2: prefix bumped da 'unnivai_insiderf2_' — nuovo motore selettore-narratore
// (AI riceve luoghi reali da Google e li racconta, invece di inventarli). Shape stops
// arricchita con `googlePlaceId`, `googlePhoto` canonicizzati; description/insiderTip
// ora hanno guardrail voce più stretti.
const INSIDER_CACHE_PREFIX = 'unnivai_insiderf3_gf_';
const INSIDER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const djb2 = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return (h >>> 0).toString(36);
};

const insiderCacheKey = (city, prefs, userPrompt, aiProfile) => {
    const parts = [city, prefs?.duration, prefs?.group, prefs?.pace, userPrompt, aiProfile].filter(Boolean).join('|');
    return INSIDER_CACHE_PREFIX + city.replace(/\s+/g, '_') + '_' + djb2(parts);
};

const loadInsiderFromCache = (key) => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts > INSIDER_CACHE_TTL_MS) {
            localStorage.removeItem(key);
            return null;
        }
        return data;
    } catch { return null; }
};

const saveInsiderToCache = (key, data) => {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
};

// DVAI-050 — Quota anti-abuso: max 10 generazioni AI nuove (cache-miss) al giorno per utente.
// Tabella public.ai_quota_daily (user_id, day, count). Cache miss → +1.
const DAILY_QUOTA = 10;
export class AiQuotaExceededError extends Error {
    constructor(remaining = 0) { super('AI daily quota exceeded'); this.code = 'QUOTA_EXCEEDED'; this.remaining = remaining; }
}

const todayStr = () => new Date().toISOString().slice(0, 10);

// DVAI-061 — Preflight della quota lato client. Legge SENZA incrementare.
// Serve per feedback immediato sul pulsante (SurpriseTour "click morto"):
// se l'utente è già a quota, mostriamo subito il messaggio invece di far
// partire uno spinner finto per 1.5s + toast in area invisibile.
//
// Contract:
//   { authenticated: bool, count: number, remaining: number, exceeded: bool }
//
// Su errore (RLS/rete): ritorna { exceeded: false } — NON blocchiamo l'utente
// per un errore infrastrutturale. checkAndIncrementQuota poi rifà il controllo
// autoritativo nel path di generazione.
export const getDailyQuotaStatus = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) {
            // Guest: bypass quota (come in checkAndIncrementQuota).
            return { authenticated: false, count: 0, remaining: DAILY_QUOTA, exceeded: false };
        }
        const day = todayStr();
        const { data: row } = await supabase
            .from('ai_quota_daily')
            .select('count')
            .eq('user_id', userId)
            .eq('day', day)
            .maybeSingle();
        const count = row?.count ?? 0;
        return {
            authenticated: true,
            count,
            remaining: Math.max(0, DAILY_QUOTA - count),
            exceeded: count >= DAILY_QUOTA,
        };
    } catch (e) {
        console.warn('[ai-quota] preflight failed, non blocco:', e?.message || e);
        return { authenticated: false, count: 0, remaining: DAILY_QUOTA, exceeded: false };
    }
};

const checkAndIncrementQuota = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return; // guest: niente quota, niente DB

        const day = todayStr();
        const { data: row } = await supabase
            .from('ai_quota_daily')
            .select('count')
            .eq('user_id', userId)
            .eq('day', day)
            .maybeSingle();

        const current = row?.count ?? 0;
        if (current >= DAILY_QUOTA) {
            throw new AiQuotaExceededError(0);
        }

        await supabase
            .from('ai_quota_daily')
            .upsert({ user_id: userId, day, count: current + 1 }, { onConflict: 'user_id,day' });
    } catch (e) {
        if (e instanceof AiQuotaExceededError) throw e;
        // Su errori di rete/RLS non blocchiamo l'utente: log e proseguiamo.
        console.warn('[ai-quota] check failed, proseguo:', e?.message || e);
    }
};

// DVAI-055 / DVAI-055-b — Vincolo geografico "tappe dentro il raggio della città".
//
// Bug bloccante Layer A: SurpriseTour a Troina generava tappe a Taormina.
// Fix DVAI-055 aveva filtro solo qui (generateItinerary insider). I tour tematici
// di "Per Te" (discoverPOIs) sfuggivano.
//
// DVAI-055-b sposta le utility geografiche in tourShape.js perché TUTTE le
// sorgenti passano dal normalizer. Qui le importiamo per uso locale (regola 15
// del prompt + filtro pre-verifyPOIWithPlaces che risparmia chiamate Google $)
// E le re-esportiamo per non rompere aiRadius.test.js.
import { isSmallTown, applyRadiusFilter } from './tourShape';
export { TOP_30_CITIES, isSmallTown, haversineKm, applyRadiusFilter } from './tourShape';

// ─── DVAI-060 F2 — derive theme + fetch candidati reali ──────────────────────
//
// generateItinerary passa da GENERATORE (inventa nomi) a SELETTORE (riceve
// luoghi reali dalla textsearch Google e li racconta con voce insider).
//
// derivePrimaryThemes: dai prefs utente ai temi textsearch (max 3, con
// fallback mix walking+art+food se nessuno).
// fetchRealPOICandidates: chiama placesDiscoveryService.discoverRealPOIs in
// parallelo su tutti i temi, mescola, deduplica per place_id, ordina per QS,
// tronca a top-N per non gonfiare il prompt AI.

const INTEREST_TO_THEME = {
    // Mapping case-insensitive delle etichette UI (AiItinerary picker + DNA quiz)
    // ai temi supportati da discoverRealPOIs.
    'cibo':          'food',
    'food':          'food',
    'gastronomia':   'food',
    'ristoranti':    'food',
    'arte':          'art',
    'art':           'art',
    'storia':        'art',
    'cultura':       'art',
    'musei':         'art',
    'natura':        'nature',
    'nature':        'nature',
    'parchi':        'nature',
    'outdoor':       'nature',
    'shopping':      'shopping',
    'vita notturna': 'nightlife',
    'nightlife':     'nightlife',
    'aperitivo':     'nightlife',
    'romantico':     'romance',
    'romance':       'romance',
    'tramonto':      'romance',
};

// DVAI-060 F2: se prefs non ha interessi (featured insider, DashboardUser
// passa solo duration+group+pace), uso un mix curato "tour insider classico":
// una piazza/monumento, un palazzo o museo, una trattoria. Il giro tipico.
const DEFAULT_MIX_THEMES = ['walking', 'art', 'food'];

// Case-insensitive lookup. Tokens possono essere stringhe libere o oggetti UI.
const extractInterestTokens = (prefs) => {
    if (!prefs) return [];
    const raw = Array.isArray(prefs.interests) ? prefs.interests : [prefs.interests];
    return raw
        .filter(Boolean)
        .map(v => {
            if (typeof v === 'string') return v;
            if (v?.title) return v.title;
            if (v?.name) return v.name;
            if (v?.label) return v.label;
            return '';
        })
        .filter(s => typeof s === 'string' && s.trim().length > 0)
        .map(s => s.toLowerCase().trim());
};

export function derivePrimaryThemes(prefs) {
    const tokens = extractInterestTokens(prefs);
    if (tokens.length === 0) return [...DEFAULT_MIX_THEMES];
    const themes = tokens
        .map(t => {
            // Prima match esatto, poi substring per catturare "Vita notturna" etc.
            if (INTEREST_TO_THEME[t]) return INTEREST_TO_THEME[t];
            for (const [key, val] of Object.entries(INTEREST_TO_THEME)) {
                if (t.includes(key)) return val;
            }
            return null;
        })
        .filter(Boolean);
    const unique = [...new Set(themes)].slice(0, 3);
    return unique.length > 0 ? unique : [...DEFAULT_MIX_THEMES];
}

// ─── Gate B — Traduttore di intenti (free-text → query Places + vincoli) ────
//
// Ruolo: capire cosa l'utente vuole dire e produrre input per una textsearch
// Places nella città indicata + vincoli che il selettore-narratore rispetterà.
//
// Non genera tappe. Non inventa nomi. Traduce soltanto.
// Fallimento della cache o del proxy → throw. Il chiamante decide (nel motore,
// il path A ritorna errore onesto senza mai ricadere sul vecchio AI-first).

const INTENT_CACHE_PREFIX = 'unnivai_intent_v1_';
const INTENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const intentCacheKey = (userPrompt, cityName) => {
    const parts = `${String(cityName || '').toLowerCase().trim()}|${String(userPrompt || '').toLowerCase().trim()}`;
    return INTENT_CACHE_PREFIX + djb2(parts);
};

const loadIntentFromCache = (key) => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts > INTENT_CACHE_TTL_MS) {
            localStorage.removeItem(key);
            return null;
        }
        return data;
    } catch { return null; }
};

const saveIntentToCache = (key, data) => {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch { /* localStorage pieno */ }
};

// System prompt del traduttore — voce del brand + regole locked Ivano.
// Correzioni acquisite:
// - `escludi` accetta SOLO categorie concrete (chiese, musei, spiagge), MAI
//   giudizi qualitativi ("luoghi turistici", "il solito"). I giudizi vanno in `note`.
// - `escludi` in ITALIANO, MAI Google types (place_of_worship non deve mai comparire).
// - `note` max 150 char (un vincolo, non un discorso).
// - Il traduttore produce anche `oggetto_umano` (1-3 parole, come lo direbbe una
//   persona) — usato dal messaggio d'errore onesto quando 0 candidati trovati.
const INTENT_TRANSLATOR_PROMPT = `Sei il traduttore di intenti di DoveVAI.
Il tuo unico compito: leggere una frase in italiano scritta da un turista, e produrre in JSON gli input per una ricerca di luoghi reali su Google Places nella città indicata.

⚠️ NON generi tappe. NON scrivi descrizioni. NON inventi nomi di posti.
Traduci soltanto: intento umano → parole per un motore di ricerca + vincoli.

FORMATO OUTPUT — JSON puro, zero markdown, zero testo fuori dal JSON:
{
  "queries": ["...", "...", "..."],
  "categoria": "...",
  "oggetto_umano": "...",
  "vincoli": {
    "tempo": null | "mattina" | "pomeriggio" | "sera" | "notte",
    "escludi": ["...", ...],
    "note": null | "..."
  }
}

REGOLE SU queries (array di 1 a 3 stringhe):
- Ogni query è breve (2-4 parole), da usare come query textsearch di Google Places nella lingua italiana. Esempi validi: "spiagge", "trattoria tipica", "museo archeologico", "belvedere panorama".
- Ogni query descrive UNA categoria di luoghi.
- Se una singola query cattura l'intento, usane 1. Se serve espandere per coprire sfumature, usane 2 o 3. MAI più di 3.
- Le query DEVONO essere sinonimi/varianti dello STESSO tipo di luogo o di tipi strettamente correlati. Se l'utente chiede più categorie diverse ("spiagge e dove mangiare"), una query per ciascuna: ["spiagge", "trattoria tipica"].
- Zero parole vuote: NIENTE "posti belli", "cose da vedere", "esperienze autentiche". Solo sostantivi concreti.
- Zero nome città nella query. La città la aggiunge il chiamante.

REGOLE SU categoria (una sola stringa):
- Sintetizza il tipo dominante di luoghi richiesti.
- Valori suggeriti: "natura" | "cibo" | "storia" | "arte" | "cultura" | "shopping" | "nightlife" | "relax" | "famiglia" | "romantico" | "misto"
- Usa "misto" solo se le query coprono davvero più famiglie diverse.

REGOLE SU oggetto_umano (1-3 parole):
- Come lo direbbe una persona, non come parola di una query di ricerca.
- Esempi:
    queries: ["spiagge", "lidi balneari", "cale"]      → oggetto_umano: "spiagge"
    queries: ["museo archeologico", "sito greco"]       → oggetto_umano: "musei archeologici"
    queries: ["parco giochi", "gelateria"]              → oggetto_umano: "posti per bambini"
    queries: ["trattoria tipica"]                       → oggetto_umano: "trattorie"
- Serve al messaggio d'errore: "A {city} non troviamo {oggetto_umano}."

REGOLE SU vincoli.tempo:
- Estrai il momento del giorno se ESPLICITO nel testo.
  "di mattina" → "mattina". "verso sera" → "sera". "in nottata" → "notte".
- Se non esplicito → null. NON inferire ("con i bambini" non implica mattina).

REGOLE SU vincoli.escludi (le più importanti):
- Elenco di TIPI DI LUOGO che l'utente NON vuole, in ITALIANO.
- Accetta SOLO categorie concrete: "chiese", "musei", "ristoranti", "bar", "spiagge", "negozi", "discoteche", "parchi", "cattedrali", "luoghi di culto".
- VIETATI in escludi (sono giudizi, non tipi di luogo):
    "luoghi turistici", "posti per turisti", "trappole per turisti", "cose banali", "il solito", "posti scontati", "roba per turisti".
- VIETATI in escludi (sono Google types, non italiano):
    "place_of_worship", "tourist_attraction", "restaurant", "point_of_interest".
- Se l'utente esprime un giudizio (autenticità, non-turistico, poco affollato), quello va in \`note\`, MAI in \`escludi\`.
- Se l'utente non esclude nessun tipo → [].

REGOLE SU vincoli.note:
- MAX 150 caratteri. Un vincolo, non un discorso.
- Vincoli qualitativi che non entrano nelle query, ma che il selettore deve rispettare. Esempi:
  "con bambini piccoli: evita percorsi lunghi e luoghi che richiedono silenzio"
  "budget basso: preferisci luoghi gratuiti o economici"
  "cerca autenticità: preferisci posti nei quartieri residenziali"
- Se non ci sono vincoli qualitativi → null.

REGOLA SPECIALE — INPUT VAGO:
- Se l'utente scrive qualcosa di generico ("sorprendimi", "fai tu", "un bel giro", "qualcosa di carino"), DEGRADA su un mix insider curato:
    queries: ["piazza storica", "trattoria tipica", "belvedere panorama"]
    categoria: "misto"
    oggetto_umano: "un giro insider"
    vincoli: { tempo: null, escludi: [], note: "l'utente si è affidato a te: scegli un mix di storia, cibo e vista, evita il più turistico" }
- Zero errore. Zero rifiuto. La vaghezza è un'occasione.

REGOLA SPECIALE — INPUT IN LINGUA STRANIERA:
- Se il testo è in inglese o altra lingua, traducilo mentalmente in italiano e produci queries in italiano. Google Places con language=it lavora meglio.

ZERO PROSA. ZERO SPIEGAZIONI FUORI JSON.`;

/**
 * Traduce il free-text dell'utente in { queries, categoria, oggetto_umano, vincoli }.
 * NON consuma la quota giornaliera (10/day) — è pre-processing, non generazione.
 *
 * @param {string} userPrompt   frase in italiano dell'utente
 * @param {string} cityName     città target (contesto per il modello)
 * @returns {Promise<object>}   { queries[], categoria, oggetto_umano, vincoli }
 * @throws                       se OpenAI proxy fallisce o JSON non parsabile
 */
export async function translateIntentToQueries(userPrompt, cityName) {
    const prompt = String(userPrompt || '').trim();
    if (!prompt) {
        throw new Error('translateIntentToQueries: userPrompt vuoto');
    }
    const key = intentCacheKey(prompt, cityName);
    const cached = loadIntentFromCache(key);
    if (cached) return { ...cached, _source: 'cache' };

    const data = await callOpenAIProxy({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: INTENT_TRANSLATOR_PROMPT },
            { role: 'user', content: `Città: ${cityName}\nFrase dell'utente: "${prompt}"` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // locked: determinismo
        max_tokens: 200,
    });
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('translateIntentToQueries: no AI response');

    const parsed = JSON.parse(raw);
    // Sanitize per resistere a AI approssimativa.
    const queries = Array.isArray(parsed.queries) ? parsed.queries.filter(q => typeof q === 'string' && q.trim()).slice(0, 3) : [];
    const categoria = typeof parsed.categoria === 'string' && parsed.categoria.trim() ? parsed.categoria.trim() : 'misto';
    const oggetto_umano = typeof parsed.oggetto_umano === 'string' && parsed.oggetto_umano.trim() ? parsed.oggetto_umano.trim() : categoria;
    const vincoliRaw = parsed.vincoli || {};
    const tempo = ['mattina', 'pomeriggio', 'sera', 'notte'].includes(vincoliRaw.tempo) ? vincoliRaw.tempo : null;
    const escludi = Array.isArray(vincoliRaw.escludi) ? vincoliRaw.escludi.filter(e => typeof e === 'string' && e.trim()).slice(0, 10) : [];
    const note = typeof vincoliRaw.note === 'string' && vincoliRaw.note.trim() ? vincoliRaw.note.trim().slice(0, 150) : null;

    if (queries.length === 0) {
        throw new Error('translateIntentToQueries: 0 queries (traduzione vuota)');
    }
    const result = {
        queries,
        categoria,
        oggetto_umano,
        vincoli: { tempo, escludi, note },
    };
    saveIntentToCache(key, result);
    return { ...result, _source: 'ai' };
}

// Fetch candidati reali per i temi derivati (Path B) o per le query prodotte
// dal traduttore d'intento (Path A, Gate B). Mescola/deduplica/ordina per QS.
// Cache lato discoverRealPOIs (24h).
//
// Gate B — Path A (userPrompt presente):
//   1. translateIntentToQueries → { queries[], categoria, oggetto_umano, vincoli }
//   2. discoverRealPOIs con customQuery per ogni query (skipLegacyFallback=true)
//   3. Merge + top-20
//   Ritorna { candidates, intent }. Se 0 candidati o traduttore fallisce, intent
//   può contenere info per errore onesto (o essere null).
//
// Path B (userPrompt vuoto o assente):
//   derivePrimaryThemes(prefs) → discoverRealPOIs con tema hardcoded (invariato)
//   Ritorna { candidates, intent: null }.
//
// Se cityCenter non ha lat/lng, ritorna { candidates: [], intent: null }.
const fetchRealPOICandidates = async (cityName, cityCenter, prefs, userPrompt = '') => {
    const lat = cityCenter?.latitude;
    const lng = cityCenter?.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { candidates: [], intent: null };
    // Import dinamico per rompere il ciclo aiRecomm → placesDiscovery → aiRecomm.
    const { placesDiscoveryService } = await import('./placesDiscoveryService');

    const isFreeText = !!(userPrompt && String(userPrompt).trim());
    let lists = [];
    let intent = null;

    if (isFreeText) {
        // Path A — Gate B: free-text guida la ricerca.
        try {
            intent = await translateIntentToQueries(userPrompt, cityName);
            console.info(`[Gate B] intent tradotto: queries=${JSON.stringify(intent.queries)} categoria=${intent.categoria} oggetto="${intent.oggetto_umano}" source=${intent._source}`);
        } catch (translatorErr) {
            console.warn(`[Gate B] translateIntentToQueries fallito: ${translatorErr.message}`);
            // Traduttore giù → path A resta path A (fail-closed), NON ricadere su path B.
            // Ritorna intent minimo con oggetto_umano generico per il messaggio d'errore.
            return {
                candidates: [],
                intent: {
                    queries: [],
                    categoria: 'sconosciuta',
                    oggetto_umano: 'quello che hai chiesto',
                    vincoli: { tempo: null, escludi: [], note: null },
                    _source: 'error-translator',
                },
            };
        }
        const queriesToRun = intent.queries.slice(0, 3);
        lists = await Promise.all(
            queriesToRun.map(q => placesDiscoveryService.discoverRealPOIs(
                cityName, lat, lng, null,
                { customQuery: q, skipLegacyFallback: true }
            ))
        );
    } else {
        // Path B — comportamento invariato: temi hardcoded da prefs.
        const themes = derivePrimaryThemes(prefs);
        lists = await Promise.all(
            themes.map(t => placesDiscoveryService.discoverRealPOIs(cityName, lat, lng, t))
        );
    }

    // Dedup by place_id (o title come fallback), poi ordino per QS decrescente.
    const merged = new Map();
    for (const list of lists) {
        if (!Array.isArray(list)) continue;
        for (const p of list) {
            const key = p.place_id || p.googlePlaceId || p.title;
            if (!merged.has(key)) merged.set(key, p);
        }
    }
    const all = [...merged.values()];
    // qualityScore locale identico a placesDiscoveryService per coerenza.
    all.sort((a, b) => {
        const qsA = (a.rating || 0) * Math.log(1 + (a.user_ratings_total || 0));
        const qsB = (b.rating || 0) * Math.log(1 + (b.user_ratings_total || 0));
        return qsB - qsA;
    });
    // Tronco a top-20: abbastanza per far scegliere all'AI, non troppo per non
    // gonfiare il prompt (ogni candidato costa ~40 token).
    return { candidates: all.slice(0, 20), intent };
};

// Ordina tappe per prossimità (nearest-neighbor greedy)
function sortByProximity(stops) {
    if (stops.length <= 2) return stops;
    const result = [stops[0]]; // Parti dalla prima tappa (perla nascosta)
    const remaining = stops.slice(1);
    while (remaining.length > 0) {
        const last = result[result.length - 1];
        let closest = 0;
        let minDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const d = Math.hypot(remaining[i].latitude - last.latitude, remaining[i].longitude - last.longitude);
            if (d < minDist) { minDist = d; closest = i; }
        }
        result.push(remaining.splice(closest, 1)[0]);
    }
    return result;
}

// ─── DVAI-060 F2 — Prompt selettore-narratore ────────────────────────────────
//
// Il sistema NON invita più l'AI a inventare i nomi. Le passa una lista di
// luoghi REALI di ${city} già verificati (rating/tipo/foto Google). L'AI:
// 1. SCEGLIE 4-5 tra questi coerenti col contesto (orario/gruppo/richiesta).
// 2. ORDINA in narrativa.
// 3. RACCONTA ognuno con voce da local (description/insiderTip/bestTime/transition).
//
// Guardrail voce (parole vietate + esempi ✓/✗) preservano il tono insider che
// era il valore emotivo di DoveVAI e che era il criterio #1 di successo.
const buildSelectorSystemPrompt = ({ city, timeContext, weather, weatherIcon, prefs, aiProfile, cityCenter, candidates, userPrompt, intent }) => {
    const candidatesLite = candidates.map(p => ({
        place_id: p.place_id || p.googlePlaceId,
        name: p.name,
        rating: p.rating,
        user_ratings_total: p.user_ratings_total,
        types: (p.types || []).slice(0, 5),
        address: p.address || null,
    }));
    const N = candidatesLite.length;
    const groupLabel = prefs?.group || 'chiunque';
    const transitHint = prefs?.pace === 'intenso' ? 'con qualche mezzo' : 'a piedi';
    const radiusInfo = cityCenter && Number.isFinite(cityCenter.latitude)
        ? ` Tutte le tappe devono restare entro ${(cityCenter.radiusKm ?? ((cityCenter.isSmallTown ?? isSmallTown(city)) ? 5 : 10))} km dal centro di ${city}.`
        : '';

    // Gate B — clausole DURE dal traduttore d'intento. Se path B (no free-text),
    // intent è null e le clausole non vengono aggiunte (retrocompat).
    const intentBlock = (intent && (intent.categoria || intent.vincoli))
        ? `\n\n⚠️ VINCOLI DELL'UTENTE (rispetta ALLA LETTERA):
   • categoria richiesta: "${intent.categoria || 'sconosciuta'}"
     TUTTE le tappe che scegli devono appartenere a questa categoria.
     NON introdurre tappe di categorie diverse (es. se la categoria è "natura",
     NON aggiungere ristoranti, chiese o musei anche se ti sembrerebbero utili).
     Se i candidati non hanno abbastanza tappe della categoria, usane meno.${intent.vincoli?.tempo ? `
   • momento del giorno: solo tappe adatte a "${intent.vincoli.tempo}".` : ''}${intent.vincoli?.escludi && intent.vincoli.escludi.length ? `
   • categorie da ESCLUDERE (nessuna tappa di questi tipi): ${intent.vincoli.escludi.map(e => `"${e}"`).join(', ')}.` : ''}${intent.vincoli?.note ? `
   • nota qualitativa: ${intent.vincoli.note}` : ''}
   Questi vincoli sono NON NEGOZIABILI. Meglio consegnare meno tappe che tradire la richiesta.`
        : '';

    return `SEI L'INSIDER DI ${city} — un local che ti mostra la sua città, non una guida turistica, non Wikipedia, non un elenco.

⚠️ NON scegli tu i luoghi. Io ti do una lista di ${N} luoghi REALI di ${city}, già verificati su Google (rating, tipo, foto).${radiusInfo}${intentBlock}

Il tuo lavoro in 3 mosse:

1. SCELTA — 4-5 luoghi tra i ${N} disponibili, quelli più adatti a:
   • orario: ${timeContext}
   • gruppo: ${groupLabel}
   • richiesta utente: "${(userPrompt || '').slice(0, 300)}"${aiProfile ? `
   • profilo implicito: ${aiProfile}` : ''}

2. ORDINE — costruisci un percorso che ${transitHint} abbia senso NARRATIVO,
   non solo geometrico. La prima tappa è una perla, non l'ovvio (es. una piazza
   secondaria o una chiesa poco battuta, non il monumento più famoso).

3. VOCE — per ogni tappa, racconta come un local sussurra un segreto:

   description (max 120 car): un dettaglio sensoriale specifico, cosa vedi/senti/odori.
     ✓ "Il pavimento è consumato dai piedi di 300 anni di parrocchiani"
     ✗ "Chiesa barocca del XVIII secolo, patrimonio della città"

   insiderTip (max 100 car): un consiglio pratico che solo chi ci vive sa.
     ✓ "Chiedi il caffè al bancone, seduto costa il doppio"
     ✓ "Entra dalla porta laterale, quella principale è chiusa lun/mar"
     ✗ "Consigliata visita mattutina"

   bestTime (max 100 car): perché ORA. Non un orario generico, un motivo specifico.
     ✓ "Alle 17 la luce entra dalla vetrata sud e colpisce l'altare"
     ✗ "Momento migliore: pomeriggio"

   transition (max 80 car): cosa vedi camminando alla prossima tappa. Un dettaglio.
     ✓ "Girando per Via delle Cisterne c'è un balcone tutto edera"
     ✗ "Prosegui verso la prossima tappa a 5 min a piedi"

REGOLE VOCE — parole VIETATE (le sostituisci con un dettaglio concreto):
"storico", "tradizionale", "unico", "caratteristico", "suggestivo", "tipico",
"affascinante", "magico", "imperdibile" — usate sole senza contesto.

REGOLE STRUTTURA:
- MAI suggerire posti chiusi ora (contesto: ${timeContext}).
- Adatta il TIPO di posto al gruppo: coppia→intimo, amici→vivace, famiglia→kid-friendly, solo→contemplativo.
- Il TITOLO del tour è evocativo: "La ${city} che non dorme mai", "I vicoli segreti di ${city}" — non "Tour di ${city}".

FORMATO OUTPUT — JSON puro, zero markdown, zero testo fuori:
{
  "days": [{
    "day": 1,
    "title": "Titolo evocativo unico",
    "weather": { "condition": "${weather?.condition || 'Soleggiato'}", "temperature": ${weather?.temperature || 22}, "icon": "${weatherIcon}" },
    "suggestedTransit": "walking|bus|metro",
    "mapMood": "romantico|storia|avventura|natura|cibo|shopping|arte|sorpresa|sport",
    "stops": [{
      "place_id": "ChIJ...",
      "time": "HH:MM",
      "description": "voce insider sensoriale (max 120 car)",
      "insiderTip": "consiglio da local (max 100 car)",
      "bestTime": "perché ORA (max 100 car)",
      "transition": "cosa vedi camminando (max 80 car)",
      "suggestedMinutes": 30,
      "type": "cultura|storia|food|shopping|relax|arte|natura"
    }]
  }]
}

⚠️ NON produrre: title/latitude/longitude/rating/googlePhoto/address.
Li ho già io e li prenderò dal candidato che tu identifichi con place_id.
Il place_id DEVE essere uno di quelli della lista qui sotto — altri id verranno scartati.

Ecco i ${N} luoghi REALI (usa i place_id da qui):
${JSON.stringify(candidatesLite, null, 2)}`;
};

// Post-processing: prende gli stop AI (con place_id) e li canonizza dai candidati
// reali. Riscrive title/lat/lng/rating/googlePhoto/type dal record Google, tiene
// dall'AI description/insiderTip/bestTime/transition/time/suggestedMinutes.
// Se AI ha inventato un place_id inesistente, quello stop viene scartato.
// Exported per test.
export const canonicalizeStopsFromCandidates = (aiStops, candidates) => {
    const byId = new Map();
    for (const c of candidates) {
        const k = c.place_id || c.googlePlaceId;
        if (k) byId.set(k, c);
    }
    return aiStops.map(s => {
        const c = byId.get(s.place_id);
        if (!c) {
            console.warn(`[DVAI-060 F2] AI ha proposto place_id sconosciuto: ${s.place_id} → scarto stop`);
            return null;
        }
        return {
            time: s.time || null,
            title: c.name,
            description: s.description || null,
            insiderTip: s.insiderTip || null,
            bestTime: s.bestTime || null,
            transition: s.transition || null,
            suggestedMinutes: s.suggestedMinutes || 30,
            type: s.type || c.type || 'place',
            latitude: c.latitude ?? c.lat,
            longitude: c.longitude ?? c.lng,
            price: typeof s.price === 'number' ? s.price : 0,
            rating: c.rating || null,
            googlePlaceId: c.place_id || c.googlePlaceId,
            googlePhoto: c.googlePhoto || null,
            image: c.googlePhoto || c.image || null,
            place_id: c.place_id || c.googlePlaceId,
            city: c.city || null,
        };
    }).filter(Boolean);
};

export const aiRecommendationService = {

    // ─── ITINERARY GENERATION ────────────────────────────────────────────────
    // DVAI-055 — cityCenter opzionale: { latitude, longitude, radiusKm?, isSmallTown? }.
    // Se passato, attiva il vincolo geografico A monte (regola 15 nel prompt) e A
    // valle (filtro Haversine PRE sortByProximity). Se null: retrocompat, no filtro.
    // DVAI-060 F2 — Google-first: se cityCenter presente, chiama discoverRealPOIs
    // per ottenere candidati reali. L'AI diventa selettore-narratore. Se meno di 3
    // candidati o cityCenter assente, fallback al vecchio flusso AI-first.
    async generateItinerary(city, prefs = {}, userPrompt = '', weather = {}, aiProfile = '', cityCenter = null) {
        // DVAI-055 — la cache key include cityCenter perché il filtro raggio cambia
        // il risultato salvato. Firmato con lat/lng arrotondati a 3 decimali (~110 m).
        const centerFingerprint = cityCenter && Number.isFinite(cityCenter.latitude)
            ? `${cityCenter.latitude.toFixed(3)},${cityCenter.longitude.toFixed(3)},r55f2`
            : 'noRadius';
        const cacheKey = insiderCacheKey(city, prefs, userPrompt, aiProfile) + '_' + centerFingerprint;
        const cached = loadInsiderFromCache(cacheKey);
        if (cached) return cached;

        // DVAI-050 — Cache MISS: prima di chiamare OpenAI controlla la quota giornaliera.
        // Lancia AiQuotaExceededError se >= 10 generazioni oggi (gestita dalla UI).
        await checkAndIncrementQuota();

        const weatherIcon = weather?.condition === 'sunny' ? '☀️'
            : weather?.condition === 'rainy' ? '🌧️' : '⛅';

        const hour = new Date().getHours();
        const timeContext = hour >= 6 && hour < 11 ? 'mattina presto — le tappe devono includere colazione/bar e posti che aprono la mattina'
            : hour >= 11 && hour < 14 ? 'ora di pranzo — includi un ristorante locale (non turistico) come tappa centrale'
            : hour >= 14 && hour < 18 ? 'pomeriggio — musei, gallerie, panorami, passeggiate'
            : hour >= 18 && hour < 22 ? 'sera — aperitivi, ristoranti, panorami al tramonto, locali con atmosfera'
            : 'notte — locali, jazz bar, piazze illuminate, passeggiate notturne';

        // ─── DVAI-060 F2 — RAMO GOOGLE-FIRST (motore selettore-narratore) ───────
        // Prova a ottenere candidati REALI da Google. Se >=3, usa il nuovo prompt
        // in cui l'AI sceglie e racconta, non inventa. Se <3 (borgo micro o
        // cityCenter mancante) cade al vecchio flusso AI-first sotto (retrocompat).
        //
        // Gate B — se userPrompt è presente (path A), il traduttore d'intento
        // guida la textsearch. Path A NON cade mai sul vecchio AI-first: se 0
        // candidati, errore onesto con oggetto_umano.
        const isFreeTextIntent = !!(userPrompt && String(userPrompt).trim());
        try {
            const { candidates, intent } = await fetchRealPOICandidates(city, cityCenter, prefs, userPrompt);
            if (candidates.length >= 3) {
                const selectorPrompt = buildSelectorSystemPrompt({
                    city, timeContext, weather, weatherIcon,
                    prefs, aiProfile, cityCenter, candidates, userPrompt,
                    intent, // Gate B — clausole dure (categoria/escludi/tempo/note) nel prompt
                });
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 35_000);
                try {
                    const data = await callOpenAIProxy({
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: selectorPrompt },
                            { role: 'user', content: `Costruisci il tour, ${candidates.length} luoghi disponibili. Ricorda: place_id dalla lista, voce insider concreta.` },
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.7,
                        max_tokens: 2000,
                    }, controller.signal);
                    clearTimeout(timeoutId);

                    const raw = data.choices?.[0]?.message?.content;
                    if (!raw) throw new Error('Empty AI response (F2)');
                    const parsed = JSON.parse(raw);
                    const days = Array.isArray(parsed) ? parsed : (parsed.days ?? []);
                    if (!Array.isArray(days) || days.length === 0) throw new Error('AI returned no days (F2)');

                    const VALID_MOODS = new Set(['romantico','storia','avventura','natura','cibo','shopping','arte','sorpresa','sport']);
                    const VALID_TRANSIT = new Set(['bus','metro','walking']);

                    const finalDays = days.map((day, di) => {
                        const aiStops = Array.isArray(day.stops) ? day.stops : [];
                        // Canonicizza: title/lat/lng/rating/googlePhoto dai candidati.
                        // Scarta stop con place_id non appartenente ai candidati (AI-halluc).
                        const canonized = canonicalizeStopsFromCandidates(aiStops, candidates);
                        // Applica il filtro raggio come safety (DVAI-055-b): quasi no-op
                        // perché discoverRealPOIs ha già filtrato per prossimità query.
                        const withinRadius = applyRadiusFilter(canonized, cityCenter, city);
                        // Ordina per prossimità geografica dopo la canonizzazione.
                        const ordered = sortByProximity(withinRadius);
                        return {
                            day: day.day ?? di + 1,
                            title: day.title ?? `Giorno ${di + 1} a ${city}`,
                            weather: day.weather ?? { condition: weather?.condition || 'Soleggiato', temperature: weather?.temperature ?? 22, icon: weatherIcon },
                            suggestedTransit: VALID_TRANSIT.has(day.suggestedTransit) ? day.suggestedTransit : 'walking',
                            mapMood: VALID_MOODS.has(day.mapMood) ? day.mapMood : 'default',
                            stops: ordered,
                        };
                    }).filter(d => d.stops.length > 0);

                    // Almeno una giornata con almeno 3 tappe canoniche → success.
                    // Se meno (troppe halluc, o filtri hanno tagliato) → fall-through
                    // al vecchio flusso invece di consegnare un tour dimezzato.
                    if (finalDays.length > 0 && finalDays[0].stops.length >= 3) {
                        const result = { days: finalDays, _source: 'google-first' };
                        saveInsiderToCache(cacheKey, result);
                        return result;
                    }
                    // Gate B — Path A: se selettore produce <3 tappe, errore onesto (no fallback).
                    if (isFreeTextIntent) {
                        console.warn(`[Gate B] path A "${city}" — <3 tappe canoniche → errore onesto (no fallback AI-first)`);
                        return {
                            days: [{ stops: [] }],
                            _source: 'no-results',
                            _query: intent?.queries || [],
                            _categoria: intent?.categoria || 'sconosciuta',
                            _oggetto_umano: intent?.oggetto_umano || 'quello che hai chiesto',
                        };
                    }
                    console.warn(`[DVAI-060 F2] Google-first ha prodotto <3 tappe canoniche per "${city}", fallback AI-first`);
                } catch (err) {
                    clearTimeout(timeoutId);
                    if (err instanceof AiQuotaExceededError) throw err;
                    // Gate B — Path A: selettore fallito → errore tecnico onesto (no fallback).
                    if (isFreeTextIntent) {
                        console.warn(`[Gate B] path A selettore fallito (${err.name === 'AbortError' ? 'timeout' : err.message}) → errore onesto (no fallback AI-first)`);
                        return {
                            days: [{ stops: [] }],
                            _source: 'no-results-error',
                            _query: intent?.queries || [],
                            _categoria: intent?.categoria || 'sconosciuta',
                            _oggetto_umano: intent?.oggetto_umano || 'quello che hai chiesto',
                        };
                    }
                    console.warn(`[DVAI-060 F2] Selettore fallito (${err.name === 'AbortError' ? 'timeout' : err.message}) → fallback AI-first`);
                }
            } else {
                // Gate B — Path A: <3 candidati Places → errore onesto. MAI ricadere sul vecchio motore.
                if (isFreeTextIntent) {
                    console.info(`[Gate B] path A "${city}" — ${candidates.length} candidati Places < 3 → errore onesto (no fallback AI-first)`);
                    return {
                        days: [{ stops: [] }],
                        _source: 'no-results',
                        _query: intent?.queries || [],
                        _categoria: intent?.categoria || 'sconosciuta',
                        _oggetto_umano: intent?.oggetto_umano || 'quello che hai chiesto',
                    };
                }
                if (candidates.length > 0) {
                    console.info(`[DVAI-060 F2] "${city}" solo ${candidates.length} candidati Google → fallback AI-first`);
                }
            }
        } catch (err) {
            if (err instanceof AiQuotaExceededError) throw err;
            // Gate B — Path A: qualunque errore in fetch → errore onesto (no fallback).
            if (isFreeTextIntent) {
                console.warn(`[Gate B] path A fetchRealPOICandidates errore "${err.message}" → errore onesto (no fallback AI-first)`);
                return {
                    days: [{ stops: [] }],
                    _source: 'no-results-error',
                    _query: [],
                    _categoria: 'sconosciuta',
                    _oggetto_umano: 'quello che hai chiesto',
                };
            }
            console.warn(`[DVAI-060 F2] fetchRealPOICandidates ha errore, fallback AI-first: ${err.message}`);
        }
        // ─── FINE RAMO GOOGLE-FIRST — sotto: vecchio flusso AI-first (fallback) ─
        // ⚠️ Gate B — SAFETY BELT: se isFreeTextIntent=true e siamo arrivati qui,
        //     è un bug logico (una via non prevista sopra). Bloccare hard con
        //     errore onesto invece di far girare il vecchio motore che INVENTA nomi.
        if (isFreeTextIntent) {
            console.error('[Gate B] SAFETY BELT: raggiunto vecchio AI-first con userPrompt presente. Blocco.');
            return {
                days: [{ stops: [] }],
                _source: 'no-results-safety',
                _query: [],
                _categoria: 'sconosciuta',
                _oggetto_umano: 'quello che hai chiesto',
            };
        }

        const systemPrompt = `Sei un insider locale italiano — non una guida turistica, non un'enciclopedia. Sei l'amico che vive a ${city} da sempre e sa dove portare la gente per farla innamorare della città.

REGOLE ASSOLUTE:
1. Rispondi SOLO con JSON valido. Zero testo fuori dal JSON. Zero commenti. Zero markdown.
2. Le coordinate DEVONO essere precise al punto esatto del POI (ingresso principale), non al centro della strada. Latitudine tra 36-47, Longitudine tra 6-19 (Italia).
3. MAI iniziare con la tappa più ovvia/turistica della città. La prima tappa è una perla nascosta.
4. Il tour ha una NARRATIVA — non è una lista. Ogni tappa porta logicamente alla successiva.
5. Tra una tappa e l'altra, aggiungi nel campo "transition" cosa si vede camminando (es: "5 min a piedi, passerai per vicolo dei Serpenti dove c'è un murales degli anni '70").
6. Per ogni tappa: perché vale la pena andarci ORA (${timeContext}).
7. Le descrizioni sono evocative, dirette, mai da Wikipedia. Max 120 caratteri.
8. CONTESTO GRUPPO: se "coppia" → posti intimi, tramonti, tavoli per due. Se "amici" → locali vivaci, street food, piazze sociali. Se "famiglia" → posti kid-friendly, gelato, parchi. Se "solo" → caffè con vista, librerie, angoli tranquilli.
9. Non suggerire MAI posti chiusi. I musei chiudono alle 19. I ristoranti aprono alle 12 e 19. I bar aprono alle 7. Adatta al contesto orario.
10. Per città NON top-6 (Roma/Milano/Firenze/Napoli/Venezia/Torino): sii conservativo. Suggerisci SOLO posti che sei CERTO esistano. Meglio 3 tappe sicure che 5 inventate. Se non conosci un posto specifico, usa la categoria ("un'enoteca storica nel centro") piuttosto che un nome falso.
11. Per tour multi-giorno: il giorno 2 riprende dove finisce il giorno 1. Narrativa continua, non ripartire da zero.
12. Il TITOLO del tour deve essere evocativo e unico. Es: "La Roma che non dorme mai" non "Tour serale di Roma". Es: "I vicoli segreti di Bari vecchia" non "Tour di Bari".
13. Includi "photo_query" per ogni tappa: la stringa di ricerca Google Places più precisa per trovare la foto reale del posto (es: "Caffè Greco Via Condotti Roma").${aiProfile ? `
14. PROFILO UTENTE IMPLICITO (adatta il tour a questi gusti senza menzionarli esplicitamente): ${aiProfile}` : ''}${cityCenter && Number.isFinite(cityCenter.latitude) ? `
15. VINCOLO GEOGRAFICO ASSOLUTO: tutte le tappe DEVONO trovarsi entro ${(cityCenter.radiusKm ?? ((cityCenter.isSmallTown ?? isSmallTown(city)) ? 5 : 10))} km dal centro (${cityCenter.latitude.toFixed(4)}, ${cityCenter.longitude.toFixed(4)}), che è ${city}. ${(cityCenter.isSmallTown ?? isSmallTown(city)) ? `Trattandosi di un borgo piccolo, resta ENTRO il territorio comunale di ${city}. NON aggiungere località vicine famose (es. Taormina, Cefalù, Amalfi) anche se pensi arricchiscano il tour: l'utente vuole scoprire ${city}, non altrove.` : `Non spostarti in comuni vicini né in provincia.`} Meglio 3 tappe reali dentro ${city} che 5 sparse nel raggio provinciale.` : ''}

Schema JSON ESATTO:
{
  "days": [{
    "day": 1,
    "title": "Titolo evocativo unico (NON 'Giorno 1 a ${city}')",
    "weather": { "condition": "${weather?.condition || 'Soleggiato'}", "temperature": ${weather?.temperature || 22}, "icon": "${weatherIcon}" },
    "suggestedTransit": "walking|bus|metro",
    "mapMood": "romantico|storia|avventura|natura|cibo|shopping|arte|sorpresa|sport",
    "stops": [{
      "time": "HH:MM",
      "title": "Nome REALE del posto (deve esistere su Google Maps)",
      "description": "Descrizione evocativa, diretta, da insider (max 120 car)",
      "transition": "Come arrivi alla prossima tappa (distanza, cosa vedi camminando)",
      "insiderTip": "Consiglio da local",
      "bestTime": "Perché questo è il momento giusto per questa tappa",
      "photo_query": "Nome Posto Indirizzo Città (per ricerca Google Places foto)",
      "suggestedMinutes": 30,
      "type": "cultura|storia|food|shopping|relax|arte|natura",
      "location": "Indirizzo reale o quartiere",
      "latitude": 41.9028,
      "longitude": 12.4964,
      "price": 0,
      "rating": 4.5
    }]
  }]
}`;

        const lines = [
            `Città: ${city}`,
            `Orario attuale: ${hour}:00 — ${timeContext}`,
            `Meteo: ${weather?.condition ?? 'soleggiato'}, ${weather?.temperature ?? 20}°C`,
            prefs?.duration   ? `Durata tour: ${prefs.duration}` : '',
            prefs?.budget     ? `Budget: ${prefs.budget}` : '',
            prefs?.interests?.length
                ? `Interessi: ${Array.isArray(prefs.interests) ? prefs.interests.join(', ') : prefs.interests}` : '',
            prefs?.group      ? `Gruppo: ${prefs.group}` : '',
            prefs?.pace       ? `Ritmo: ${prefs.pace}` : '',
            userPrompt        ? `Richiesta: ${userPrompt}` : '',
        ].filter(Boolean);

        const numDays = prefs?.duration === '2-3 Giorni' ? 2 : 1;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35_000);

        try {
            // DVAI-001: chiamata tramite proxy, mai diretta ad OpenAI dal client
            const data = await callOpenAIProxy({
                model: 'gpt-4o-mini',  // DVAI-020: aggiornato da gpt-3.5-turbo
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: `Genera un itinerario di ${numDays} giorno/i con 4-5 tappe per giorno.\n${lines.join('\n')}`,
                    },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.7,
                max_tokens: 2000,
            }, controller.signal);

            clearTimeout(timeoutId);

            const raw = data.choices?.[0]?.message?.content;
            if (!raw) throw new Error('Empty AI response');

            const parsed = JSON.parse(raw);
            const days = Array.isArray(parsed) ? parsed : (parsed.days ?? []);
            if (!Array.isArray(days) || days.length === 0) throw new Error('AI returned no days');

            const VALID_MOODS = new Set(['romantico','storia','avventura','natura','cibo','shopping','arte','sorpresa','sport']);
            const VALID_TRANSIT = new Set(['bus','metro','walking']);
            const sanitized = days.map((day, di) => {
                const rawStops = (day.stops ?? [])
                    .map(s => {
                        const lat = parseFloat(s.latitude);
                        const lng = parseFloat(s.longitude);
                        // Validazione stretta: coordinate reali in Italia, titolo e descrizione presenti
                        if (!s.title || !lat || !lng || isNaN(lat) || isNaN(lng)) return null;
                        if (lat < 36 || lat > 47 || lng < 6 || lng > 19) {
                            console.warn(`[AI] Scartata tappa "${s.title}": coordinate fuori Italia (${lat},${lng})`);
                            return null;
                        }
                        if ((s.description || '').length < 10) {
                            console.warn(`[AI] Scartata tappa "${s.title}": descrizione troppo corta`);
                            return null;
                        }
                        return {
                            ...s,
                            latitude: lat,
                            longitude: lng,
                            price: typeof s.price === 'number' ? s.price : 0,
                            rating: typeof s.rating === 'number' ? Math.min(s.rating, 5) : 4.5,
                            suggestedMinutes: s.suggestedMinutes || 30,
                            transition: s.transition || null,
                            insiderTip: s.insiderTip || null,
                            bestTime: s.bestTime || null,
                        };
                    })
                    .filter(Boolean);

                // DVAI-055: filtro raggio PRIMA del sort. Se sort venisse prima,
                // ottimizzerebbe una sequenza di tappe che poi verrebbero scartate.
                const withinRadius = applyRadiusFilter(rawStops, cityCenter, city);

                // Ordina le tappe per prossimità geografica (nearest-neighbor greedy)
                const ordered = sortByProximity(withinRadius);

                return {
                    day: day.day ?? di + 1,
                    title: day.title ?? `Giorno ${di + 1} a ${city}`,
                    weather: day.weather ?? {
                        condition: 'Soleggiato',
                        temperature: weather?.temperature ?? 22,
                        icon: weatherIcon,
                    },
                    suggestedTransit: VALID_TRANSIT.has(day.suggestedTransit) ? day.suggestedTransit : 'walking',
                    mapMood: VALID_MOODS.has(day.mapMood) ? day.mapMood : 'default',
                    stops: ordered,
                };
            }).filter(d => d.stops.length > 0);

            if (sanitized.length === 0) throw new Error('All stops invalid after sanitization');

            // DVAI-034: Verifica POI con Google Places (async per ogni stop)
            // Rimuove POI inesistenti e corregge coordinate imprecise.
            // La verifica è best-effort: errori non bloccano l'itinerario.
            const verifiedSanitized = await Promise.all(
                sanitized.map(async (day) => {
                    const verifiedStops = await Promise.all(
                        day.stops.map(async (stop) => {
                            const isValid = await verifyPOIWithPlaces(stop, city);
                            return isValid ? stop : null;
                        })
                    );
                    return {
                        ...day,
                        stops: verifiedStops.filter(Boolean),
                    };
                })
            );

            const finalDays = verifiedSanitized.filter(d => d.stops.length > 0);
            if (finalDays.length === 0) throw new Error('All POIs invalid after Places verification');

            const result = { days: finalDays };
            // DVAI-050: persisti in cache 24h. Il fallback locale NON viene cachato.
            saveInsiderToCache(cacheKey, result);
            return result;

        } catch (err) {
            clearTimeout(timeoutId);
            // Gate D-5: nessun fallback statico. Ogni errore risale al chiamante
            // che mostra un messaggio onesto ("L'AI sta avendo un momento
            // difficile. Riprova."). Prima cadeva su generateItineraryLocal
            // che tirava fuori Colosseo/Pantheon anche per città Sicilia.
            const reason = err.name === 'AbortError' ? 'timeout (35s)' : err.message;
            if (!(err instanceof AiQuotaExceededError)) {
                console.warn(`[AI] Itinerary failed (${reason}) → rethrow onesto (no static fallback)`);
            }
            throw err;
        }
    },

    // ─── MONUMENT ENRICHMENT ─────────────────────────────────────────────────
    async enrichMonuments(pois, city) {
        try {
            const data = await callOpenAIProxy({
                model: 'gpt-4o-mini',  // DVAI-020
                messages: [
                    { role: 'system', content: DOVEVAI_NARRATOR_PROMPT },
                    { role: 'user', content: `Arricchisci questi POI di ${city || 'questa città'}: ${pois.map(p => p.name || p.title || 'Punto di interesse').join(', ')}` },
                ],
                response_format: { type: 'json_object' },
            });
            const enriched = JSON.parse(data.choices[0].message.content).data;

            return pois.map(p => {
                const targetName = p.name || p.title;
                const item = enriched?.find(d => d.name === targetName || (d.name && targetName && d.name.includes(targetName)));
                return { ...p, historicalNotes: item?.note || p.historicalNotes, funFacts: [item?.fun_fact] };
            });
        } catch (e) {
            console.warn('[AI] enrichMonuments failed:', e.message);
            return pois;
        }
    },

    // ─── GEMINI / AI CHAT GUIDE ──────────────────────────────────────────────
    async chatWithGuide(messages, contextPayload) {
        const fallbackResponse = "Sono una versione limitata offline. Il proxy AI non è raggiungibile.";

        const { city, poiName } = contextPayload;
        const contextStr = poiName ? `${poiName} a ${city}` : `${city}`;

        const systemPrompt = `Sei l'Assistente AI integrato nella mappa 3D premium di DoveVai.
Il tuo compito è fare da guida turistica esperta, ironica e sintetica per l'utente, che sta esplorando in questo momento: ${contextStr}.
Non dare risposte enciclopediche lunghissime (massimo 3-4 frasi o 450 caratteri). Fai emergere verità storiche nascoste, aneddoti divertenti o consigli unici. Se ti chiedono indicazioni stradali complesse, ricordagli gentilmente di seguire la scia arancione sulla mappa.`;

        const openAiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.filter(m => m.role === 'user' || m.role === 'assistant')
        ];

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            const data = await callOpenAIProxy({
                model: 'gpt-4o-mini',  // DVAI-020
                messages: openAiMessages,
                temperature: 0.7,
                max_tokens: 350
            }, controller.signal);

            clearTimeout(timeoutId);

            return data.choices?.[0]?.message?.content || fallbackResponse;
        } catch (e) {
            console.warn('[AI] chatWithGuide failed:', e.message);
            return fallbackResponse;
        }
    },

    // ─── DYNAMIC WEATHER & SOCIAL TIP ─────────────────────────────────────────
    /**
     * DVAI-002 (notifiche): Genera un consiglio AI contestuale all'orario reale.
     * @param {string} city
     * @param {string} userName
     * @param {'morning'|'midday'|'afternoon'|'evening'|'night'} slot - fascia oraria da useUserNotifications
     */
    async generateWeatherSocialTip(city, userName, slot = 'afternoon') {
        // Descrizione human-readable dello slot per il prompt
        const slotLabels = {
            morning:   'mattina (06-10), poca folla, luce bella',
            midday:    'mezzogiorno (11-13), ora di pranzo',
            afternoon: 'pomeriggio (14-17), caldo, ideale per musei e gallerie',
            evening:   'sera (18-21), aperitivo e cena',
            night:     'notte (22-05), tutto chiuso tranne locali notturni',
        };
        const slotActivities = {
            morning:   'passeggiate, mercati del mattino, tour con poca folla, colazione tipica',
            midday:    'ristoranti, trattorie, osterie, street food, pranzo tipico locale',
            afternoon: 'musei, gallerie d\'arte, tour culturali, laboratori artigianali',
            evening:   'aperitivo, ristoranti romantici, esperienze gastronomiche serali, vista panoramica',
            night:     'pianificazione del giorno dopo, itinerari AI per domani mattina',
        };

        try {
            const prompt = `Sei un esperto locale di ${city}. Ora è: ${slotLabels[slot] || slotLabels.afternoon}.
Scrivi UN breve consiglio (max 140 caratteri) per ${userName || 'il viaggiatore'} suggerendo SOLO attività adatte a questo orario: ${slotActivities[slot] || slotActivities.afternoon}.
REGOLA FONDAMENTALE: NON suggerire il sole, passeggiate all'aperto o attività esterne di notte. NON suggerire ristoranti o bar alle 7 del mattino.
Aggiungi #DoveVAI alla fine.

Formato JSON:
{
  "title": "Titolo breve con emoji adatta all'orario (max 50 car)",
  "message": "Consiglio coerente con l'orario con hashtag (max 140 car)"
}`;

            const data = await callOpenAIProxy({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Sei un travel advisor locale amichevole. Rispondi SOLO in JSON valido. Rispetta rigorosamente il contesto orario.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
                max_tokens: 200,
            });

            if (!data.choices?.[0]) throw new Error('No AI response');
            const parsed = JSON.parse(data.choices[0].message.content);
            if (!parsed.title || !parsed.message) throw new Error('Incomplete AI response');
            return parsed;
        } catch (e) {
            console.warn('[AI] generateWeatherSocialTip failed:', e.message);
            return null; // null → useUserNotifications usa il fallback statico coerente
        }
    },

    // ─── DVAI-010: ANALYZE BUSINESS DESCRIPTION ───────────────────────────────
    /**
     * Analizza la descrizione di un'attività business e restituisce
     * metadati AI per ottimizzare il profilo sulla piattaforma.
     *
     * @param {{ description: string, website?: string, instagram?: string, image_urls?: string[] }} context
     * @returns {Promise<object|null>} ai_metadata o null in caso di errore
     */
    async analyzeBusinessDescription(context) {
        const { description, website, instagram, image_urls } = context ?? {};

        if (!description || description.trim().length < 20) {
            console.warn('[AI] analyzeBusinessDescription: descrizione troppo corta o assente');
            return null;
        }

        const systemPrompt = `Sei un esperto di marketing turistico italiano. Analizza la descrizione di un'attività commerciale
e restituisci un JSON con metadati utili per posizionamento sulla piattaforma DoveVai.
Rispondi SOLO con JSON valido, nessun testo aggiuntivo.`;

        const userPrompt = `Analizza questa attività e restituisci:
{
  "vibe": ["aggettivo1", "aggettivo2", "aggettivo3"],
  "style": ["stile1", "stile2"],
  "pace": "Rilassato|Dinamico|Avventuroso|Contemplativo",
  "story_hook": "Frase accattivante di 15-20 parole che descrive l'esperienza unica",
  "tags": ["tag1", "tag2"],
  "target_audience": "Descrizione del pubblico ideale (max 80 car)",
  "best_hours": "Fascia oraria consigliata (es. 'Mattina 9-12, Sera 18-22')",
  "tour_compatibility": ["tipo_tour1", "tipo_tour2"],
  "highlight": "Punto di forza principale (max 100 car)",
  "category": "food|cultura|shopping|relax|arte|natura|sport"
}

Descrizione: ${description}
${website ? `Sito web: ${website}` : ''}
${instagram ? `Instagram: ${instagram}` : ''}
${image_urls?.length ? `Immagini disponibili: ${image_urls.length}` : ''}`;

        try {
            const data = await callOpenAIProxy({
                model: 'gpt-4o-mini',  // DVAI-020
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.4,
                max_tokens: 500,
            });

            const raw = data.choices?.[0]?.message?.content;
            if (!raw) throw new Error('Empty response from AI');

            return JSON.parse(raw);
        } catch (err) {
            console.warn('[AI] analyzeBusinessDescription failed:', err.message);
            return null;
        }
    },
};
