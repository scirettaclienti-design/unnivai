// src/services/aiRecommendationService.js
//
// DVAI-001 — Tutte le chiamate OpenAI ora passano per la Supabase Edge Function
// /functions/v1/openai-proxy in modo che la API key non sia mai nel bundle client.
// DVAI-010 — Aggiunta analyzeBusinessDescription() mancante.
// DVAI-020 — Modello aggiornato da gpt-3.5-turbo a gpt-4o-mini.

import { supabase } from '../lib/supabase';
// Gate NARRATORE ANCORATO DIFF 4 — invarianti sull'output del narratore.
// Funzione pura, nessuna I/O: qui viene solo LETTA, il log lo fa il chiamante.
import { findTourViolations } from '../lib/narratorGuards';

const DOVEVAI_NARRATOR_PROMPT = `Sei la voce di DoveVai. Scrivi curiosità storiche ironiche e colte.
Evita i cliché come 'storia millenaria'. Focus su aneddoti bizzarri.
Max 150 car per la nota, 80 car per il fun fact.`;

// DVAI-049 / DVAI-050 — Places proxy URL.
// In dev: middleware Vite su /__dev/places-proxy (sempre attivo).
// In prod: Edge Function Supabase places-proxy, gated da VITE_PLACES_PROXY_ENABLED.
// Quando il flag prod è OFF, isPlacesProxyEnabled() ritorna false e i caller
// (discoverRealPOIs, fetchPlaceOpeningHours, fetchPlaceDetailsForTour) saltano
// la chiamata: pool vuoto, nessun luogo inventato al suo posto.
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
    // Gate 3 T1: language=it di default. Google restituisce nomi in italiano
    // ("Duomo di Siracusa" invece di "Syracuse Cathedral") + descrizioni + address
    // components tradotti. Il caller puo' sovrascrivere passando `language`
    // esplicito (raro — es. testing). Questa e' l'unica factory di URL Places:
    // ogni chiamata deve passare da qui — la regola anti-fake
    // `no-places-url-outside-builder` blocca costruzioni a mano in CI.
    const withDefaults = { language: 'it', ...params };
    const qs = new URLSearchParams(withDefaults).toString();
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
const callOpenAIProxy = async (payload, signal, quota) => {
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

  let response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/openai-proxy`, {
      method: 'POST',
      headers,
      // Gate QUOTA-SERVER — `dv` dice al proxy a quale generazione appartiene la
      // chiamata (biglietto). Senza `dv` il proxy la conta come chiamata di contorno.
      body: JSON.stringify({ endpoint: '/chat/completions', ...payload, ...(quota ? { dv: quota } : {}) }),
      ...(signal ? { signal } : {}),
    });
  } catch (err) {
    // Gate P8b — il motore non risponde (rete o timeout del client).
    const kind = err?.name === 'AbortError' ? 'timeout' : 'network';
    console.error(`[AI Proxy] Errore: nessuna risposta (${kind})`);
    throw new AiEngineError(kind);
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const code = typeof errBody?.code === 'string' ? errBody.code : null;
    // Gate QUOTA-SERVER — il limite lo decide il server; il testo arriva da lì.
    if (response.status === 429 && (code === 'QUOTA_EXCEEDED' || code === 'GLOBAL_QUOTA_EXCEEDED')) {
      throw new AiQuotaExceededError(0, {
        scope: code === 'GLOBAL_QUOTA_EXCEEDED' ? 'global' : 'user',
        message: typeof errBody.error === 'string' ? errBody.error : undefined,
      });
    }
    // Gate P8b — ogni altro rifiuto (OpenAI giu', credito, troppe richieste,
    // proxy) e' un guasto del motore: un tipo, mai un oggetto nel messaggio.
    const kind = AI_ENGINE_KIND_BY_CODE[code] || 'proxy';
    console.error(`[AI Proxy] Errore: ${response.status} ${code || 'senza codice'} (${kind})`);
    throw new AiEngineError(kind, response.status);
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

// Gate SOLO-GOOGLE (27/09) — `verifyPOIWithPlaces` RIMOSSA.
// Verificava a posteriori su Places i POI che il vecchio motore AI-first faceva
// inventare al modello (nome + coordinate), scartando quelli che Google non
// ritrovava. Rimosso quel motore, la funzione non aveva piu' nessun chiamante:
// sul percorso Google-first i luoghi arrivano gia' da textsearch con
// `place_id`, e `canonicalizeStopsFromCandidates` e' l'unico cancello.
// Con lei esce anche EXPECTED_GOOGLE_TYPES, che serviva solo al suo type-check.

// DVAI-050 — Cache TTL 24h del tour insider per (city + dna_hash) e quota.
// DVAI-055-b: prefix bumped da 'unnivai_insider_' per invalidare i tour cached
// generati prima del filtro raggio centralizzato (i "cattivi" con tappe a 50-70 km).
// DVAI-060 F2: prefix bumped da 'unnivai_insiderf2_' — nuovo motore selettore-narratore
// (AI riceve luoghi reali da Google e li racconta, invece di inventarli). Shape stops
// arricchita con `googlePlaceId`, `googlePhoto` canonicizzati; description/insiderTip
// ora hanno guardrail voce più stretti.
// Gate H: prefix bumped da 'unnivai_insiderf3_gf_' per invalidare i tour cached
// dal bug selectedOption string vs .id undefined: il prompt collassava sempre
// sul dominant di default → gli utenti vedevano lo stesso tour per ogni scelta
// nel wizard QuickPath. Senza bump, i tour vecchi restano cached 24h dopo il fix.
// Gate I: prefix bumped da 'unnivai_insiderf6_qp_' — soglie per categoria
// (NATURA/RELAX 4.0/20, CULTURA 4.0/50 large) + soglia candidati 1 (era 3) +
// query traduttore con termini reali Google Maps (villa/orto botanico) + flag
// _singleStop. I tour cached col vecchio motore sono probabilmente vuoti
// ("non troviamo parchi") per query di natura — bumpiamo per non servirli.
// Bumpato anche il prefisso intent cache: le queries del traduttore possono
// cambiare col nuovo prompt e i cached "parchi giardini aree verdi" ora sono
// da rifare.
// Gate 3 T1: prefix bumped da 'unnivai_insiderf7_soglia_' — buildPlacesProxyUrl
// ora fa default language=it, i tour insider cached prima contenevano POI con
// nomi inglesi ("Syracuse Cathedral").
// Gate MERITO: prefix bumped da 'unnivai_insiderf8_it_' — il pool offerto al
// selettore non e' piu' ordinato per qualityScore (rating*ln(1+reviews)) ma per
// soglia+punteggio affinita'/unicita'/voto. I tour cached col vecchio motore
// riflettono un pool diverso, andrebbero riletti come se fossero ancora la
// scelta giusta.
// Gate NARRATORE-DOPO: prefix bumped da 'unnivai_insiderf9_merito_' — il
// racconto ora e' scritto sulle tappe finali con il loro orario, e la chiave
// porta data, primo momento e interessi. I tour cached prima hanno testi
// scritti dal selettore, senza orario: non vanno serviti.
const INSIDER_CACHE_PREFIX = 'unnivai_insiderf10_narratore_';
const INSIDER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const djb2 = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return (h >>> 0).toString(36);
};

// Gate MERITO — dnaWeights entra nella chiave via la sua impronta (non il testo
// narrativo di aiProfile: quello mostra solo le top-3 categorie sopra il 20% e
// arrotonda le percentuali, due vettori di pesi diversi possono produrre la
// STESSA stringa narrativa pur pesando l'affinita' dei candidati in modo
// diverso). Due utenti con gusti diversi non devono mai leggere lo stesso
// itinerario dalla cache dell'altro.
export const insiderCacheKey = (city, prefs, userPrompt, aiProfile, dnaWeights, foodPrefs = null) => {
    // Gate NARRATORE-DOPO — gli interessi entrano nella chiave: Arte+Cibo e
    // Natura sono due tour diversi anche con la stessa frase.
    const interests = [...extractInterestTokens(prefs)].sort().join(',');
    // P7b — dieta, budget e stile cambiano il pool: entrano nella chiave (vuoti
    // = chiave identica a prima).
    const parts = [city, prefs?.duration, prefs?.group, prefs?.pace, interests, userPrompt, aiProfile, weightsFingerprint(dnaWeights), foodPrefsFingerprint(foodPrefs)].filter(Boolean).join('|');
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
// Gate QUOTA-SERVER — il conteggio lo fa SOLO openai-proxy (public.ai_quota_consume,
// chiave di servizio). Il client legge la propria riga di ai_quota_daily per
// mostrare quante generazioni restano, e non la scrive mai.
const DAILY_QUOTA = 10;

// Testi decisi da Ivano, identici a quelli del server (openai-proxy/index.ts).
export const QUOTA_USER_MESSAGE = 'Per oggi hai usato tutti i tuoi percorsi. Domani se ne aprono altri.';
export const QUOTA_GLOBAL_MESSAGE = 'Oggi Unnivai ha raggiunto il limite di percorsi. Domani se ne aprono altri.';

// Gate P8b — guasto del motore: classe e testo in src/lib/aiEngineError.js.
export { AI_ENGINE_MESSAGE, AiEngineError } from '@/lib/aiEngineError';
// Quota esaurita e motore giu' arrivano alla UI: nessun catch li traveste da
// "nessun risultato" o da tour vuoto.
const mustReachUi = (err) => err instanceof AiQuotaExceededError || err instanceof AiEngineError;

export class AiQuotaExceededError extends Error {
    constructor(remaining = 0, { scope = 'user', message } = {}) {
        super('AI daily quota exceeded');
        this.code = 'QUOTA_EXCEEDED';
        this.remaining = remaining;
        this.scope = scope;
        this.userMessage = message || (scope === 'global' ? QUOTA_GLOBAL_MESSAGE : QUOTA_USER_MESSAGE);
    }
}

// Giorno della quota = mezzanotte Europe/Rome, come nel server.
const todayStr = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

// Biglietto di generazione: tutte le chiamate di UNA generazione (traduttore
// d'intento + selettore) lo condividono, il server la conta una volta sola.
const newGenerationTicket = (kind) => {
    let ticket = globalThis.crypto?.randomUUID?.();
    if (!ticket) {
        const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
        b[6] = (b[6] & 0x0f) | 0x40; // uuid v4
        b[8] = (b[8] & 0x3f) | 0x80;
        const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
        ticket = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }
    return { purpose: 'generation', ticket, kind };
};

// DVAI-061 — Preflight della quota lato client. Legge SENZA incrementare.
// Serve per feedback immediato sul pulsante (SurpriseTour "click morto"):
// se l'utente è già a quota, mostriamo subito il messaggio invece di far
// partire uno spinner finto per 1.5s + toast in area invisibile.
//
// Contract:
//   { authenticated: bool, count: number, remaining: number, exceeded: bool }
//
// Su errore (RLS/rete): ritorna { exceeded: false } — NON blocchiamo l'utente
// per un errore infrastrutturale. Il controllo autoritativo lo fa openai-proxy
// (Gate QUOTA-SERVER).
export const getDailyQuotaStatus = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) {
            // Guest: la quota ospite (per IP) e' solo sul server, il client non la legge.
            return { authenticated: false, count: 0, remaining: DAILY_QUOTA, exceeded: false };
        }

        // Task 3 — account is_unlimited (settato server-side via service_role)
        // bypassa il cap. Serve per test end-to-end senza esaurire quota. Il
        // trigger protect_profile_is_unlimited impedisce all'utente di scriverlo
        // dal client. Vedi migration 20260711_is_unlimited_profiles.sql.
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_unlimited')
            .eq('id', userId)
            .maybeSingle();
        if (profile?.is_unlimited === true) {
            return { authenticated: true, unlimited: true, count: 0, remaining: Infinity, exceeded: false };
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

// Gate QUOTA-SERVER — sostituisce checkAndIncrementQuota. NON scrive nulla e
// non e' una protezione: il limite lo applica openai-proxy. Serve solo a non
// spendere chiamate Google Places quando si sa gia' che il server rifiutera'.
// Su errore (rete/RLS) non blocca: decide il server.
const assertQuotaAvailable = async () => {
    const status = await getDailyQuotaStatus();
    if (status.exceeded) throw new AiQuotaExceededError(0);
};

// DVAI-055 / DVAI-055-b — Vincolo geografico "tappe dentro il raggio della città".
//
// Bug bloccante Layer A: SurpriseTour a Troina generava tappe a Taormina.
// Fix DVAI-055 aveva filtro solo qui (generateItinerary insider). I tour tematici
// di "Per Te" (discoverPOIs) sfuggivano.
//
// DVAI-055-b sposta le utility geografiche in tourShape.js perché TUTTE le
// sorgenti passano dal normalizer. Qui le importiamo per uso locale (regola 15
// del prompt + filtro raggio prima del selettore, che risparmia chiamate Google $)
// E le re-esportiamo per non rompere aiRadius.test.js.
import { isSmallTown, applyRadiusFilter, haversineKm, normalizeStepCategory } from './tourShape';
// Gate RAGGIO DIFF 1a — stime di durata (sosta da types + spostamento haversine).
// Va chiamato SEMPRE dopo l'ordinamento definitivo: lo spostamento e' una
// proprieta' della coppia di tappe consecutive, non della singola tappa.
import { computeStopTimings, totalTourMinutes, refreshTourScheduledTimes } from '@/lib/tourTiming';
// Gate FINESTRA TEMPORALE (G3) — quando parte il tour lo decide il codice, non il modello.
import { resolveTourWindow, romeParts } from '@/lib/tourWindow';
// Gate NARRATORE-DOPO — alba/tramonto nel codice, controllo luce/ora, fascia dalla tabella.
import { sunTimes } from '@/lib/sunTimes';
import { filterTimeIncoherent } from '@/lib/narrationLight';
// Gate PAROLE VIETATE — l'unico elenco: i prompt lo mostrano, il filtro lo applica.
import { filterBannedWords, bannedWordsPromptLines, DESCRIPTION_RULE_PROMPT } from '@/lib/narrationLight';
// P3d-e — fatti aperti sulle tappe finali, controllo anti-invenzione, frase sicura.
import { filterInventedObjects, filterVoice, safeDescription, CONCRETE_OBJECTS, tipoTappa, isPanoramaStop } from '@/lib/narrationLight';
import { fetchFactsForStops, isLocaleStop } from './factsService';
import { momentAtClock } from '@/lib/dayMoments';
import { AiEngineError, AI_ENGINE_KIND_BY_CODE } from '@/lib/aiEngineError';
// P3 — lo scheletro della giornata guida la scelta dei luoghi.
import { buildDaySkeleton } from '@/lib/daySkeleton';
import {
    flattenSkeleton, bucketCandidates, shortMomentThemes,
    repairMomentSelection, scheduleMomentPlan, isMealPlace,
    requestedFamilies, mealSearchAnchor, MAX_WALK_METERS, MAX_EXTRA_SEARCHES, momentTheme,
} from './momentSelection';
export { TOP_30_CITIES, isSmallTown, haversineKm, applyRadiusFilter } from './tourShape';
// Gate MERITO — soglia di qualita' + punteggio (affinita'/unicita'/voto) al
// posto del ranking per qualityScore. Vedi candidateScoring.js per il razionale.
import { selectScoredCandidatePool, passesQualityThreshold, enforceCategoryVariety, weightsFingerprint, obviousnessReport, rankByMerit, famositaReport, computeAffinityScore, dnaShareOf } from './candidateScoring';
import {
    resolveFoodPrefs, applyFoodConstraints, foodPrefBonus, foodPrefsFingerprint, hasFoodPrefs,
    searchFoodWithDiet, dietNoteLine, dietCriteria, hierarchyPromptBlock, priceLevelOf,
    matchesStile, STILI,
} from '@/lib/foodPrefs';

// ─── DVAI-060 F2 — derive theme + fetch candidati reali ──────────────────────
//
// generateItinerary passa da GENERATORE (inventa nomi) a SELETTORE (riceve
// luoghi reali dalla textsearch Google e li racconta con voce insider).
//
// derivePrimaryThemes: dai prefs utente ai temi textsearch (max 3, con
// fallback mix cultura+food se nessuno).
// fetchRealPOICandidates: chiama placesDiscoveryService.discoverRealPOIs in
// parallelo su tutti i temi, mescola, deduplica per place_id, ordina per QS,
// tronca a top-N per non gonfiare il prompt AI.

// Gate INTERESSI-VERI — ogni VALORE qui deve essere una chiave di
// THEME_TEXTSEARCH (placesDiscoveryService). Fino al 06/10 `arte`, `storia`,
// `cultura` e `musei` puntavano a `art`, rinominato `cultura` dal Gate P.1:
// nessuna query, TypeError prima della fetch, e la UI diceva "non trovo luoghi
// verificati" senza aver mai interpellato Google. themeCompleteness.test.js
// fallisce da solo se un valore resta senza ricerca.
export const INTEREST_TO_THEME = {
    // Mapping case-insensitive delle etichette UI (AiItinerary picker + DNA quiz)
    // ai temi supportati da discoverRealPOIs.
    'cibo':          'food',
    'food':          'food',
    'gastronomia':   'food',
    'ristoranti':    'food',
    'arte':          'cultura',
    'art':           'cultura',
    'storia':        'cultura',
    'cultura':       'cultura',
    'musei':         'cultura',
    // `walking` e' stato assorbito da `cultura` (Gate P.1: monumenti, centro
    // storico): passeggiare in citta' cerca quello.
    'passeggiate':   'cultura',
    'passeggiata':   'cultura',
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
// Gate INTERESSI-VERI: era ['walking', 'art', 'food'] — due temi su tre senza
// query. `cultura` copre piazza/monumento E palazzo/museo (Gate P.1).
export const DEFAULT_MIX_THEMES = ['cultura', 'food'];

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

// Gate I: bump v1 → v2 (nuovo prompt con termini reali Google Maps → queries
// diverse per gli stessi prompt utente).
const INTENT_CACHE_PREFIX = 'unnivai_intent_v2_';
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

REGOLA CRITICA — TERMINI COME LI USA GOOGLE MAPS (non come li usa un dizionario):
- Le queries devono usare i termini con cui i luoghi sono REALMENTE registrati su Google Maps, non le categorie astratte.
- I luoghi si registrano col loro NOME PROPRIO tipico. In Italia:
    parchi urbani     → si chiamano quasi sempre "villa" (Villa Bellini, Villa Comunale, Villa Borghese, Villa Sciarra).
                        Solo raramente "parco" (Parco Sempione, Parco della Musica).
                        Query giusta per natura urbana: ["villa comunale parco", "orto botanico", "giardino pubblico"].
                        Query debole: ["parchi", "giardini", "aree verdi"] — non matcha nomi propri veri.
    giardini botanici → "orto botanico" (non "giardino botanico").
    belvedere         → "belvedere panorama" o "terrazza panoramica".
    trattorie tipiche → "trattoria tipica" o "osteria" (non "cucina tradizionale", troppo generico).
    spiagge           → "spiagge", "lidi", "cale" — tutti termini nativi Google Maps.
    musei archeologici → "museo archeologico" (non "archeologia").
- Esempio applicato:
    input: "un giro nei parchi di Catania"
    queries: ["villa comunale parco", "orto botanico", "giardino pubblico"]  ✓
    queries: ["parchi", "giardini", "aree verdi"]                            ✗ (nomi generici non matchano su Google)
- Regola generale: pensa al nome PROPRIO che una persona darebbe al posto trovandolo su Google Maps, non alla categoria che ci mette un dizionario.

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
 * Gate QUOTA-SERVER — con `quota` (biglietto della generazione) la chiamata e'
 * la prima delle due della stessa generazione: il server la conta una volta sola.
 *
 * @param {string} userPrompt   frase in italiano dell'utente
 * @param {string} cityName     città target (contesto per il modello)
 * @param {object} [quota]      biglietto di generazione (newGenerationTicket)
 * @returns {Promise<object>}   { queries[], categoria, oggetto_umano, vincoli }
 * @throws                       se OpenAI proxy fallisce o JSON non parsabile
 */
export async function translateIntentToQueries(userPrompt, cityName, quota) {
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
    }, undefined, quota);
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
//   3. Merge + dedup + ordinamento per qualityScore (NON taglia: il taglio a 20
//      vive nel chiamante, dopo i filtri di raggio e categoria)
//   Ritorna { candidates, intent }. Se 0 candidati o traduttore fallisce, intent
//   può contenere info per errore onesto (o essere null).
//
// Path B (userPrompt vuoto o assente):
//   derivePrimaryThemes(prefs) → discoverRealPOIs con tema hardcoded (invariato)
//   Ritorna { candidates, intent: null }.
//
// Se cityCenter non ha lat/lng, ritorna { candidates: [], intent: null }.
// Gate INTERESSI-VERI — piu' ricerche in parallelo: una che fallisce non butta
// via le altre (prima Promise.all scartava tutto al primo rifiuto). Se nessuna
// ha prodotto luoghi e almeno una e' fallita, non si puo' dire "non c'e'
// niente": si rilancia l'errore di ricerca (code PLACES_SEARCH_FAILED).
const settleSearches = async (promises, label) => {
    const settled = await Promise.allSettled(promises);
    const lists = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed = settled.filter(r => r.status === 'rejected').map(r => r.reason);
    if (failed.length > 0) {
        const found = lists.reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);
        console.warn(`[Gate INTERESSI-VERI] ${label}: ${failed.length}/${settled.length} ricerche fallite, ${found} luoghi dalle altre`);
        if (found === 0) throw failed[0];
    }
    return lists;
};

const fetchRealPOICandidates = async (cityName, cityCenter, prefs, userPrompt = '', quota = undefined, foodPrefs = null) => {
    // P7b — con una dieta, OGNI ricerca del cibo fatta qui porta il criterio:
    // le query del traduttore di tipo cibo (deriveKindFromQuery) e il tema
    // food del Percorso B. I risultati portano `_dietaCercata`.
    const dieta = foodPrefs?.dieta || [];
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
            intent = await translateIntentToQueries(userPrompt, cityName, quota);
            console.info(`[Gate B] intent tradotto: queries=${JSON.stringify(intent.queries)} categoria=${intent.categoria} oggetto="${intent.oggetto_umano}" source=${intent._source}`);
        } catch (translatorErr) {
            // Quota esaurita o motore giu' non sono "non trovo": arrivano alla UI.
            if (mustReachUi(translatorErr)) throw translatorErr;
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
        // Gate I — customKind derivato da intent.categoria: la soglia qualità
        // deve rispettare il tipo di luogo (parchi hanno meno recensioni di
        // ristoranti — chiedere 50 recensioni a un parco lo cancella).
        const CATEGORIA_TO_KIND = {
            natura: 'NATURA',
            relax:  'RELAX',
            cibo:   'FOOD',
            // arte, cultura, storia, misto, sconosciuta, shopping, nightlife,
            // famiglia, romantico → CULTURA (soglia media)
        };
        const customKind = CATEGORIA_TO_KIND[String(intent.categoria || '').toLowerCase()] || 'CULTURA';

        // Gate INTENT (28/08) — DIAGNOSTICA, non decisione. `customKind` sopra e'
        // invariato e resta l'unico usato: qui si misura soltanto QUANTO spesso
        // il kind globale (derivato dalla `categoria` prodotta dal MODELLO)
        // diverge da quello che il lessico della singola query suggerirebbe.
        // Il conteggio dei divergenti rende la domanda automatica: senza, la
        // riga andrebbe letta e giudicata a mano una per una.
        const perQuery = queriesToRun.map(q => ({ q, kind: deriveKindFromQuery(q) }));
        const divergenti = perQuery.filter(x => x.kind !== customKind).length;
        console.info(
            `[Gate B] kind globale=${customKind} | per-query: ` +
            perQuery.map(x => `${x.q}->${x.kind}`).join(', ') +
            ` | ${divergenti}/${perQuery.length} divergenti`
        );

        // P3d-g — ogni candidato porta la ricerca che l'ha trovato (`_ricerca`):
        // e' il "perche' qui" vero di una tappa senza fatti. Solo un dato in
        // piu': la scelta non lo legge.
        const conRicerca = (q) => (list) => (Array.isArray(list) ? list.map(p => (p && !p._ricerca ? { ...p, _ricerca: q } : p)) : list);
        lists = await settleSearches(
            queriesToRun.map(q => {
                // P7b2 — query di cibo + dieta: le parole della richiesta restano
                // ("trattoria romana con opzioni vegetariane"); se trova poco si
                // allarga tenendo la dieta (searchFoodWithDiet), mai senza.
                if (dieta.length > 0 && deriveKindFromQuery(q) === 'FOOD') {
                    return searchFoodWithDiet((fq) => placesDiscoveryService.discoverRealPOIs(
                        cityName, lat, lng, null, { customQuery: fq, customKind, skipLegacyFallback: true },
                    ), q, dieta).then(r => r.results).then(conRicerca(q));
                }
                return placesDiscoveryService.discoverRealPOIs(
                    cityName, lat, lng, null,
                    { customQuery: q, customKind, skipLegacyFallback: true }
                ).then(conRicerca(q));
            }),
            `path A ${cityName}`,
        );
    } else {
        // Path B — comportamento invariato: temi hardcoded da prefs.
        const themes = derivePrimaryThemes(prefs);
        const conTema = (t) => (list) => (Array.isArray(list) ? list.map(p => (p && !p._tema ? { ...p, _tema: t } : p)) : list);
        lists = await settleSearches(
            themes.map(t => (t === 'food' && dieta.length > 0
                ? searchFoodWithDiet((fq) => placesDiscoveryService.discoverRealPOIs(cityName, lat, lng, null, {
                    customQuery: fq, customKind: 'FOOD',
                }), THEME_FOOD_QUERY, dieta).then(r => r.results).then(conTema(t))
                : placesDiscoveryService.discoverRealPOIs(cityName, lat, lng, t).then(conTema(t)))),
            `path B ${cityName} [${themes.join(',')}]`,
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
    // Gate TAGLIO-DOPO-CATEGORIA — qui NON si taglia piu'.
    //
    // Fino al 13/09 questa funzione chiudeva con `all.slice(0, 20)`, e il
    // chiamante riceveva un pool gia' troncato su cui applicare raggio e
    // categoria. Il taglio era cieco alla categoria: le tre liste diventano UN
    // ranking per qualityScore = rating * ln(1+reviews), dominato dal volume di
    // recensioni, quindi una famiglia a basso traffico (le chiese antiche
    // minori ~300 recensioni; le spiagge del Sinis ~200) poteva uscire PER
    // INTERO dai primi 20 anche con la sua query andata benissimo — battuta da
    // ristoranti e musei con due ordini di grandezza in piu'. Il guard-rail di
    // categoria a valle non poteva recuperarla: non c'era piu' niente da
    // filtrare. Misurato a Cabras: 24 ristoranti + 3 spiagge = 27 candidati, i
    // ristoranti occupano tutti i 20 posti, zero spiagge al selettore.
    //
    // Il taglio vive ora nel chiamante, DOPO raggio e categoria — vedi
    // "Gate TAGLIO-DOPO-CATEGORIA" in generateItinerary. Qui resta la sola
    // diagnostica su cosa il merge ha prodotto.
    console.info(`[Gate B] merge: ${all.length} candidati dedup, ordinati per qualityScore (nessun taglio qui)`);

    return { candidates: all, intent };
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

// ─── Gate INTENT (28/08) — kind per QUERY, derivato dal lessico ──────────────
//
// SOLO DIAGNOSTICA IN QUESTO DIFF. Non cambia `customKind`, non tocca le
// soglie, non filtra niente: alimenta una riga di log e basta.
//
// Perche' esiste: oggi `customKind` e' UNO SOLO per tutte le query
// (`CATEGORIA_TO_KIND[intent.categoria]`), e `intent.categoria` la produce il
// MODELLO. Su Milano, tre query — "chiesa antica", "museo d'arte", "caffe'
// storico" — hanno prodotto `categoria=cibo`, quindi soglia FOOD (rating 4.2)
// applicata anche alla query sulla chiesa, contro il 4.0 di CULTURA.
// Quanto spesso succeda non lo sappiamo: questa mappa serve a misurarlo.
//
// La derivazione e' DETERMINISTICA e sta nel codice: nessuna chiamata al
// modello, altrimenti sarebbe lo stesso difetto con un passaggio in piu'.
// Se un giorno promuoveremo questo da log a decisione (strada B), la mappa e'
// gia' scritta e — soprattutto — gia' misurata sul campo.
//
// Non mappata → CULTURA, che e' la soglia PIU' PERMISSIVA delle quattro
// (rating 4.0). Il modo di sbagliare e' verso l'inclusione, mai verso la
// cancellazione silenziosa di un POI che l'utente ha chiesto.
export const QUERY_KIND_LEXICON = [
    // ─── Match a CONFINE DI PAROLA, mai a sottostringa ───────────────────────
    // La prima stesura usava `q.includes(w)` su queste stesse voci, e produceva
    // 14 falsi positivi misurati. I peggiori:
    //     "chiesa barocca"      -> FOOD    (`bar` dentro "barocca")
    //     "giardino pubblico"   -> FOOD    (`pub` dentro "pubblico")
    //     "biblioteca pubblica" -> FOOD    (idem)
    //     "scala monumentale"   -> NATURA  (`cala` dentro "scala")
    //     "spazio espositivo"   -> RELAX   (`spa` dentro "spazio")
    // Quattro parole corte — bar, pub, spa, cala — bastavano a dirottare
    // un'intera famiglia. E' la #11 applicata al lessico: un match che trova
    // piu' di quanto cerca e' un fallimento dello strumento letto come segnale.
    //
    // ─── FORME ESPLICITE, singolare E plurale ────────────────────────────────
    // Le radici tronche (`spiagg`, `archeolog`) sono state sciolte nelle forme
    // vere: con il confine di parola una radice non matcha piu' nulla, e
    // lasciarla sarebbe stata una voce morta che finge di coprire.
    // I plurali mancavano del tutto e cadevano sul default: "ristoranti",
    // "osterie", "trattorie", "parchi", "ville", "giardini" — incluso
    // **"parchi e ville"**, il caso stesso che ha aperto questo gate.
    { kind: 'FOOD',    parole: ['trattoria', 'trattorie', 'ristorante', 'ristoranti', 'osteria', 'osterie', 'pizzeria', 'pizzerie', 'pizza', 'caffe', 'caffè', 'caffetteria', 'bar', 'gelateria', 'gelaterie', 'gelato', 'pasticceria', 'pasticcerie', 'enoteca', 'enoteche', 'birreria', 'birrerie', 'street food', 'cucina', 'friggitoria', 'paninoteca', 'cocktail', 'pub'] },
    { kind: 'NATURA',  parole: ['parco', 'parchi', 'villa comunale', 'ville comunali', 'giardino', 'giardini', 'orto botanico', 'orti botanici', 'riserva', 'riserve', 'oasi', 'bosco', 'boschi', 'lago', 'laghi', 'sentiero', 'sentieri', 'spiaggia', 'spiagge', 'lido', 'lidi', 'cala', 'cale', 'scogliera', 'scogliere', 'grotta', 'grotte'] },
    { kind: 'RELAX',   parole: ['terme', 'termale', 'spa', 'benessere', 'belvedere', 'panorama', 'panoramico', 'panoramica', 'terrazza panoramica', 'lungomare', 'lungofiume'] },
    { kind: 'CULTURA', parole: ['chiesa', 'chiese', 'basilica', 'basiliche', 'duomo', 'cattedrale', 'cattedrali', 'abbazia', 'abbazie', 'santuario', 'santuari', 'battistero', 'museo', 'musei', 'pinacoteca', 'pinacoteche', 'galleria', 'gallerie', 'palazzo', 'palazzi', 'castello', 'castelli', 'monumento', 'monumenti', 'teatro', 'teatri', 'biblioteca', 'biblioteche', 'archeologico', 'archeologica', 'archeologia', 'centro storico', 'piazza', 'piazze', 'borgo', 'borghi', 'mercato', 'mercati', 'artigianato', 'boutique', 'negozi'] },
];

// Escape per usare le voci del lessico dentro una RegExp: alcune contengono
// spazi ("orto botanico") e in futuro potrebbero contenere altro.
const escapeRegExp = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Una voce matcha solo se e' una PAROLA INTERA della query.
// `\b` non funziona con le lettere accentate in JS (`caffè` finisce su `è`, che
// per la regex non e' un carattere di parola), quindi il confine e' esplicito:
// inizio stringa o non-lettera, prima e dopo.
const NON_LETTERA = '[^a-zà-ù]';
const matchaParolaIntera = (q, w) =>
    new RegExp(`(^|${NON_LETTERA})${escapeRegExp(w)}($|${NON_LETTERA})`, 'i').test(q);

// Kind lessicale di UNA query. Match su sottostringa in minuscolo: le query sono
// 2-4 parole scelte dal traduttore, non testo libero, quindi il rischio di falso
// positivo e' basso e il costo e' trascurabile (max 3 query per generazione, non
// 60 candidati — la mappa NON gira sui POI).
export const deriveKindFromQuery = (query) => {
    const q = String(query || '').toLowerCase();
    if (!q.trim()) return 'CULTURA';
    for (const { kind, parole } of QUERY_KIND_LEXICON) {
        if (parole.some(w => matchaParolaIntera(q, w))) return kind;
    }
    return 'CULTURA';
};

// ─── Gate RAGGIO-CATEGORIA — il tema richiesto diventa un vincolo di codice ───
//
// Misurato a Cabras, richiesta "le spiagge piu' belle": il traduttore produce
// queries=["spiagge","lidi","cale"] categoria=natura — corrette. Ma "lido" in
// italiano e' anche un nome comune di ristorante, e "cale" fa match debole
// contro esercizi generici del centro: la textsearch riporta 20/20 spiagge vere
// per la prima query e ristoranti del paese per le altre due. Le spiagge stanno
// a 9-12 km (Cabras e' nell'entroterra), i ristoranti a 0.1-2.8 km. Con R=5 km
// sopravvivevano 10 candidati, tutti ristoranti: 10 >= 2, quindi il widen a
// 12 km non scattava mai e il selettore riceveva un pool di soli ristoranti.
// L'istruzione "categoria: natura, NON aggiungere ristoranti" nel prompt del
// selettore non poteva salvarlo — non avendo altro fra cui scegliere, il
// modello la ignorava e restituiva 3 ristoranti.
//
// Mappa intent.categoria (lessico libero del traduttore, vedi
// INTENT_TRANSLATOR_PROMPT) → TOUR_CATEGORIES (lessico di normalizeStepCategory
// in tourShape.js). Solo le 7 categorie con corrispondenza diretta e univoca
// sono filtrabili in modo stretto. "misto" e le categorie trasversali
// (nightlife, famiglia, romantico, sconosciuta) restano SENZA filtro stretto:
// forzarle su UNA sola categoria tradirebbe la richiesta tanto quanto non
// filtrare affatto — e' la stessa regola che il traduttore usa per decidere
// quando scrivere "misto" (INTENT_TRANSLATOR_PROMPT: "misto solo se le query
// coprono davvero piu' famiglie").
const CATEGORIA_TO_TOUR_CATEGORY = {
    natura: 'natura',
    cibo: 'food',
    storia: 'storia',
    arte: 'arte',
    cultura: 'cultura',
    shopping: 'shopping',
    relax: 'relax',
};

// Un candidato CONTRASTA con la categoria richiesta se almeno uno dei suoi
// Google `types` si risolve, via normalizeStepCategory (CATEGORY_ALIASES di
// tourShape.js), in una categoria CONCRETA diversa da quella target.
// 'place' (fallback generico di point_of_interest/establishment) NON conta come
// contrasto: e' zero segnale, non un segnale contrario. Escluderlo per quello
// butterebbe via spiagge vere che Google non ha taggato con natural_feature o
// tourist_attraction — misurato: "Spiaggia di Maimoni" a Cabras arriva anche con
// types=[establishment, point_of_interest] soltanto, a seconda di quale query
// textsearch la trova per prima (dedup per place_id tiene la prima vista).
const candidateConflictsWithCategoria = (candidate, targetCategory) => {
    const types = Array.isArray(candidate?.types) ? candidate.types : [];
    return types.some(t => {
        const cat = normalizeStepCategory(t);
        return cat !== 'place' && cat !== targetCategory;
    });
};

// P3 — la categoria stretta del Gate RAGGIO-CATEGORIA nel vocabolario dello
// scheletro (dayMoments.js). Serve solo a mostrare al selettore la categoria
// giusta per ogni momento: il pool e' gia' ristretto dal codice.
const TOUR_CATEGORY_TO_SKELETON = {
    food: 'cibo',
    natura: 'natura',
    storia: 'cultura',
    arte: 'musei',
    cultura: 'cultura',
    shopping: 'shopping',
    relax: 'relax',
};

// P3 — ricerca mirata per i momenti rimasti senza candidati. Gli stessi
// cancelli del pool principale: raggio, categoria stretta (se c'e'), soglia e
// punteggio del Gate MERITO. Il tetto di 1 icona e' gia' speso dal pool
// principale: qui maxIcons 0. Una ricerca che fallisce non fa cadere il tour:
// il momento resta vuoto e viene tolto, e il report lo dice.
// P3e — un posto dove mangiare passa anche fuori dalla categoria stretta: serve
// a pranzo e cena, che restano cibo qualunque categoria sia stata scelta. Il
// chiamante lo tiene fuori dagli altri momenti (mealOnlyIds).
// P7b — la ricerca mirata del cibo (pranzo, cena) con la dieta porta il
// criterio; dopo, gli stessi vincoli del pool principale (budget, dieta).
// C1 — la ricerca del cibo parte dalla tappa prima del pasto (foodAnchor), con
// il bias stretto al tetto di cammino; senza ancora, dal centro come prima.
// Stesse chiamate: cambia solo dove si guarda. Il raggio resta sul centro.
// C1b — `anchor` sposta TUTTI i temi su un punto (la ricerca mirata dopo la
// scelta, per un momento che non ha niente entro il tetto dalla tappa prima).
const THEME_FOOD_QUERY = 'trattoria ristorante pizzeria osteria';
// P7b2 — il tipo di cucina, solo se Google lo dice (types come
// "italian_restaurant", "vegetarian_restaurant"); altrimenti null, mai dedotto.
const cuisineOf = (c) => (Array.isArray(c?.types) ? c.types : [])
    .find(t => /_restaurant$/.test(t) && t !== 'fast_food_restaurant')?.replace(/_restaurant$/, '') || null;
const searchMomentCandidates = async ({ city, cityCenter, themes, known, dnaWeights, categoria, perTheme = 5, foodPrefs = null, foodAnchor = null, anchor = null }) => {
    const { placesDiscoveryService } = await import('./placesDiscoveryService');
    const dieta = foodPrefs?.dieta || [];
    const at = (t) => {
        const a = anchor || (t === 'food' ? foodAnchor : null);
        return a
            ? { lat: a.latitude, lng: a.longitude, bias: { radiusMeters: MAX_WALK_METERS } }
            : { lat: cityCenter.latitude, lng: cityCenter.longitude, bias: {} };
    };
    const settled = await Promise.allSettled(themes.map(t => (t === 'food' && dieta.length > 0
        ? searchFoodWithDiet((fq) => placesDiscoveryService.discoverRealPOIs(city, at(t).lat, at(t).lng, null, {
            customQuery: fq, customKind: 'FOOD', ...at(t).bias,
        }), THEME_FOOD_QUERY, dieta).then(r => r.results)
        : placesDiscoveryService.discoverRealPOIs(city, at(t).lat, at(t).lng, t, at(t).bias))
        // P3d-g — il tema della ricerca mirata, come dato del "perche' qui".
        .then(list => (Array.isArray(list) ? list.map(p => (p && !p._tema ? { ...p, _tema: t } : p)) : list))));
    settled.forEach((r, i) => {
        if (r.status === 'rejected') console.warn(`[P3 SCHELETRO] ricerca mirata "${themes[i]}" fallita: ${r.reason?.message}`);
    });
    const knownIds = new Set(known.map(c => c.place_id || c.googlePlaceId));
    const seen = new Set();
    let extra = settled
        .filter(r => r.status === 'fulfilled' && Array.isArray(r.value))
        .flatMap(r => r.value)
        .filter(c => {
            const id = c.place_id || c.googlePlaceId;
            if (!id || knownIds.has(id) || seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    extra = applyRadiusFilter(extra, cityCenter, city, { requireCenter: true });
    if (categoria) extra = extra.filter(c => candidateMatchesIntentCategoria(c, categoria) || isMealPlace(c));
    if (foodPrefs) extra = applyFoodConstraints(extra, foodPrefs, isMealPlace).candidates;
    const bonus = foodPrefs ? (c) => foodPrefBonus(c, foodPrefs, isMealPlace) : null;
    // C1b — la ricerca mirata dalla tappa prima torna pochi posti di un
    // quartiere: misurate su di loro, il piu' recensito sarebbe sempre
    // un'"icona" (con un solo risultato, sempre lui) e uscirebbe. Le icone si
    // misurano sulla citta' (tutti i candidati della generazione), come per
    // "Per Te" (rankByMerit, P7a2). Stessa soglia di qualita', zero icone.
    if (anchor) {
        const ok = extra.filter(c => passesQualityThreshold(c, city));
        return rankByMerit(ok, { reference: [...known, ...ok], dnaWeights, maxIcons: 0, bonus }).slice(0, perTheme * themes.length);
    }
    return selectScoredCandidatePool(extra, {
        city, dnaWeights, limit: perTheme * themes.length, maxIcons: 0, bonus,
    });
};

// P3 — il report della riparazione, in chiaro nei log (e in `_momentReport`).
const logMomentReport = (city, r) => {
    for (const m of r.momentiTolti) console.warn(`[P3 SCHELETRO] ${city}: momento ${m.momento} (${m.label}) TOLTO — ${m.motivo}`);
    for (const x of r.scartate) console.warn(`[P3 SCHELETRO] ${city}: scartata ${x.place_id} (${x.momento ?? '—'}) — ${x.motivo}`);
    for (const x of r.riempite) console.info(`[P3 SCHELETRO] ${city}: ${x.momento} riempito dal codice con "${x.name}" (merito)`);
    for (const x of r.tolte) console.warn(`[P3 SCHELETRO] ${city}: tolta ${x.place_id} (${x.momento}) — ${x.motivo}`);
    for (const x of r.ripieghi || []) console.warn(`[C1 COMPOSIZIONE] ${city}: ripiego "${x.name}" (${x.momento}) — ${x.motivo}`);
};

// Predicato pubblico — Exported per test. true = candidato ammesso per
// `categoriaRaw` (o nessun filtro stretto applicabile → sempre ammesso).
export const candidateMatchesIntentCategoria = (candidate, categoriaRaw) => {
    const target = CATEGORIA_TO_TOUR_CATEGORY[String(categoriaRaw || '').toLowerCase()];
    if (!target) return true;
    return !candidateConflictsWithCategoria(candidate, target);
};

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
// Exported per test (stesso pattern di canonicalizeStopsFromCandidates e
// hasNonEmptyDescription piu' sotto). Il Gate NARRATORE ANCORATO verifica il
// PROMPT COSTRUITO, non l'output del modello: l'output e' non deterministico e
// nessun test puo' provare che sia migliorato. Raggiungerlo attraverso
// generateItinerary renderebbe il test dipendente dagli interni del motore.
// Gate NARRATORE-DOPO — `weather`/`weatherIcon` non servono piu' qui: il meteo
// lo riceve il narratore, e il selettore non scrive il blocco "weather".
export const buildSelectorSystemPrompt = ({ city, timeContext, prefs, aiProfile, cityCenter, candidates, userPrompt, intent, moments = null, buckets = null, foodPrefs = null }) => {
    const candidatesLite = candidates.map(p => {
        const lite = {
            place_id: p.place_id || p.googlePlaceId,
            name: p.name,
            rating: p.rating,
            user_ratings_total: p.user_ratings_total,
            types: (p.types || []).slice(0, 5),
            address: p.address || null,
        };
        // Gate NARRATORE ANCORATO (DIFF 3) — `open_now` NON viene più passato.
        // Il Gate TOUR-SENSATO lo aveva aggiunto per dare al modello un dato su
        // cui applicare "mai suggerire posti chiusi ora". Ma la regola locked
        // dice di NON usarlo — è istantaneo e perde freschezza in ~30 min — e di
        // preferire l'orario di chiusura reale (closingTimeTodayHH), che su
        // questo path non arriva: la textsearch non restituisce `periods`.
        // Passare l'unico dato che la regola vieta, per far rispettare una regola
        // che ora è diventata "non parlarne", non ha più senso: la regola
        // riscritta sopra vieta di AFFERMARE stati di apertura, quindi al modello
        // non serve alcun dato di apertura. Un dato in meno è una bugia in meno.
        // closingTimeTodayHH resta capacità inutilizzata su questo path: portarlo
        // costa una place/details per candidato ed è un gate a sé.
        return lite;
    });
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

    // P3 — con lo scheletro, la scelta e' per MOMENTO: numero di tappe e
    // candidati li decide il codice, il modello sceglie dentro ciascuno.
    // Senza momenti (scheletro vuoto: finestra fuori dalla giornata) resta la
    // scelta libera di prima.
    //
    // Gate NARRATORE-DOPO — il selettore restituisce SOLO place_id e momento.
    // Il racconto lo scrive il narratore (buildNarratorSystemPrompt), DOPO che
    // il codice ha riparato, ordinato e messo l'orario alle tappe. E il
    // messaggio dichiara le tappe di OGNI giorno: con "2-3 Giorni" il modello
    // restituiva un giorno solo, perche' l'elenco piatto dei momenti non diceva
    // che i giorni erano tre.
    const hasMoments = Array.isArray(moments) && moments.length > 0;
    const hhmm = (d) => {
        const p = romeParts(d);
        return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
    };
    const momentLine = (m) => {
        const ids = (buckets?.get(m.id) || []).map(c => c.place_id || c.googlePlaceId);
        return `     • ${m.id} — ${m.label} ${hhmm(m.start)}–${hhmm(m.end)} — ESATTAMENTE ${m.stops} ${m.stops === 1 ? 'tappa' : 'tappe'}${m.careful ? ' (da scegliere con cura)' : ''} — candidati: ${JSON.stringify(ids)}`;
    };
    const dayGroups = [];
    if (hasMoments) {
        for (const m of moments) {
            const di = m.dayIndex ?? 0;
            if (!dayGroups[di]) dayGroups[di] = [];
            dayGroups[di].push(m);
        }
    }
    const days = dayGroups.filter(Boolean);
    const totalStops = hasMoments ? moments.reduce((a, m) => a + m.stops, 0) : 0;
    const momentsBlock = days.map((ms) => {
        const n = ms.reduce((a, m) => a + m.stops, 0);
        const p = romeParts(ms[0].start);
        return `   Giorno ${(ms[0].dayIndex ?? 0) + 1} (${p.d} ${MESI[p.m - 1]}) — ${n} ${n === 1 ? 'tappa' : 'tappe'}:\n${ms.map(momentLine).join('\n')}`;
    }).join('\n');
    const sceltaBlock = hasMoments
        ? `1. SCELTA — il percorso ha ${days.length} ${days.length === 1 ? 'giorno' : 'giorni'} e ${totalStops} tappe in tutto.
   Restituiscile TUTTE, per TUTTI i giorni, in un'unica lista "stops".
   Ogni momento ha già orario e numero di tappe: per OGNI momento scegli
   ESATTAMENTE il numero di tappe indicato, SOLO tra i place_id elencati per
   QUEL momento. Mai lo stesso luogo due volte, nemmeno in giorni diversi.
   Ogni tappa porta il campo "moment" con l'id del suo momento.
   Una tappa fuori dal suo momento, in più o con un place_id non elencato viene
   scartata e sostituita dal codice; un momento lasciato vuoto lo riempie il codice.
${momentsBlock}
   Dentro ogni momento scegli i più adatti a:
   • gruppo: ${groupLabel}
   • richiesta utente: "${(userPrompt || '').slice(0, 300)}"${aiProfile ? `
   • profilo implicito: ${aiProfile}` : ''}`
        : `1. SCELTA — 4-5 luoghi tra i ${N} disponibili, quelli più adatti a:
   • orario: ${timeContext}
   • gruppo: ${groupLabel}
   • richiesta utente: "${(userPrompt || '').slice(0, 300)}"${aiProfile ? `
   • profilo implicito: ${aiProfile}` : ''}`;
    const ordineBlock = hasMoments
        ? `2. ORDINE — le tappe escono nell'ordine dei momenti. Dentro un momento con
   più tappe, un ordine che ${transitHint} abbia senso, non solo geometrico.`
        : `2. ORDINE — costruisci un percorso che ${transitHint} abbia senso,
   non solo geometrico. La prima tappa è una perla, non l'ovvio (es. una piazza
   secondaria o una chiesa poco battuta, non il monumento più famoso).`;

    return `SEI L'INSIDER DI ${city} — un local che sa dove portarti, non una guida turistica, non un elenco.

⚠️ NON scegli tu i luoghi. Io ti do una lista di ${N} luoghi REALI di ${city}, già verificati su Google (rating, tipo, foto).${radiusInfo}${intentBlock}${hierarchyPromptBlock(foodPrefs)}

Il tuo lavoro in 2 mosse:

${sceltaBlock}

${ordineBlock}

⛔ NON scrivere testi: niente descrizioni, consigli, titoli. Li scrive un altro
passaggio, dopo, sulle tappe che il codice avrà fissato con il loro orario.

FORMATO OUTPUT — JSON puro, zero markdown, zero testo fuori:
{
  "stops": [
    { "place_id": "ChIJ..."${hasMoments ? `, "moment": "id del momento (es. ${moments[0].id})"` : ''} }
  ]
}

Il place_id DEVE essere uno di quelli della lista qui sotto — altri id verranno scartati.

Ecco i ${N} luoghi REALI (usa i place_id da qui):
${JSON.stringify(candidatesLite, null, 2)}`;
};

// Oltre questo numero di tappe il narratore scrive solo description e
// insiderTip: 24 tappe con quattro campi ciascuna sfiorano il tetto di 4000
// token del proxy, e un JSON troncato non si legge (si perderebbe tutto).
const LONG_TOUR_STOPS = 15;

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

// ─── Gate NARRATORE-DOPO — il prompt del narratore ──────────────────────────
//
// Terza chiamata della generazione (biglietto 'itinerary': traduttore,
// selettore, narratore). Riceve le tappe FINALI — gia' riparate, ordinate e con
// l'orario calcolato dal codice — e le racconta. Per ogni tappa: nome,
// categoria, types, momento, orario di arrivo, data; per ogni giorno alba e
// tramonto della citta' (src/lib/sunTimes.js). Le tappe arrivano nel messaggio
// utente, dopo "TAPPE FINALI:".
// P3d-e — in piu', per ogni tappa, i FATTI aperti (factsService) e, per i
// locali, price_level, minuti a piedi dalla tappa prima e motivo della scelta.
// Il prompt dichiarava "rating, recensioni, indirizzo", che il narratore non
// ha mai ricevuto: ora dice esattamente cosa riceve.
//
// Le regole di voce sono quelle che stavano nel prompt del selettore-narratore,
// spostate qui senza indebolirle. In piu' la regola LUCE E ORA: il racconto
// parla della luce dell'orario di arrivo. Il codice la controlla comunque
// (src/lib/narrationLight.js): una frase incoerente viene tolta, mai riscritta.
// Exported per test.
export const buildNarratorSystemPrompt = ({ city, weather, prefs, aiProfile, userPrompt, giorni }) => {
    const groupLabel = prefs?.group || 'chiunque';
    const nTappe = (giorni || []).reduce((a, g) => a + (g.tappe?.length || 0), 0);
    return `SEI IL NARRATORE DI ${city} — un local che ti mostra la sua città, non una guida turistica, non Wikipedia, non un elenco.

Le tappe sono GIÀ decise: ${nTappe} tappe in ${(giorni || []).length} ${(giorni || []).length === 1 ? 'giorno' : 'giorni'}, nell'ordine in cui si camminano, ognuna con il suo orario di arrivo.
NON aggiungere, togliere o spostare tappe: racconta TUTTE quelle che ricevi, una per una, con il loro place_id.${nTappe > LONG_TOUR_STOPS ? `
Sono molte tappe: per ognuna scrivi description e insiderTip, e metti "bestTime": null e "transition": null.
Una risposta troncata perde il racconto di TUTTE le tappe.` : ''}

Contesto:
• gruppo: ${groupLabel}
• richiesta utente: "${(userPrompt || '').slice(0, 300)}"
• meteo: ${weather?.condition || 'sereno'} ${weather?.temperature || 22}°${aiProfile ? `
• profilo implicito: ${aiProfile}` : ''}

Di ogni tappa ricevi: place_id, nome, "tipo" (in italiano: per i locali vince il nome,
"Osteria X" è un'osteria), categoria, "types", momento della giornata, orario di arrivo
(HH:MM), "tramonto_ancora_davanti" (true/false), "minuti_a_piedi_da_prima" (null per la
prima tappa), "motivo" (perché il motore l'ha scelta per questo utente) e "fatti": un
elenco [{testo, fonte}] da Wikipedia, Wikidata o OpenStreetMap (può essere vuoto).
Le tappe dove si mangia o si beve hanno "locale": true e "price_level" (0-4, oppure null).
Di ogni giorno ricevi: data, alba e tramonto di ${city}.
NON ricevi rating, recensioni, indirizzi, orari di apertura né foto: non citarli.

LUCE E ORA — racconta la luce e il momento dell'ORARIO DI ARRIVO di quella tappa:
   • "tramonto" solo se l'arrivo è entro 45 minuti dal tramonto di quel giorno;
   • alba, notte, stelle, luce del mattino, sole di mezzogiorno: solo se l'orario
     di arrivo li rende veri;
   • nel dubbio, non parlare di luce. Una frase incoerente con l'orario viene tolta.

FATTI — la regola sopra tutte:
   ⚠️ gli esempi qui sotto mostrano il REGISTRO, non il contenuto. NON copiarli
   e NON trasporli su un posto di tipo diverso.

   ⛔ NON ATTRIBUIRE A UN POSTO CONTENUTI CHE NON SAI ESISTANO LI'.
   OGNI frase usa SOLO i fatti forniti, il nome della tappa o i suoi dati
   (categoria, momento, orario, e per i locali price_level, minuti, motivo).
   Dal nome e dai "types" NON si deduce cosa c'e' dentro: quali opere, quali
   sale, quali piatti, quali arredi, quali alberi o fontane.

   COME SI RISOLVE LA TENSIONE: ti chiedo di essere SPECIFICO e di NON INVENTARE.
   La specificità sta nei FATTI: date, autori, primati, misure che ricevi.
   Senza fatti, se la scelta è tra generico e inventato, VINCE IL GENERICO.

   GIUDIZI: un giudizio (migliore, unico, cuore di, straordinario, incantevole,
   incontaminato, imperdibile, "uno dei", "vista su…", meno frequentato, nascosto,
   tranquillo…) passa SOLO se è scritto nei "fatti" di quella tappa. Se no, la frase
   viene tolta dal codice.

   SENZA FATTI ("fatti": []): sul luogo dici SOLO il nome e il "tipo". Il resto è
   "perché qui, per te", fatto solo di dati: momento, arrivo, tramonto se ancora
   davanti, minuti dalla tappa prima, e il "motivo" DETTO CON PAROLE TUE (mai citato).

   LUOGHI CON FATTI: un fatto concreto preso dai "fatti" + cosa guardare o quando arrivi.
   "fatti_su" dice DI CHE LUOGO parlano i fatti: se non è la tappa (i fatti del Pincio
   per la Terrazza del Pincio), nominalo ("Sul Pincio, colle di Roma, …"): mai
   "Un colle di Roma" detto della terrazza.
   LOCALI: perché è qui per te, con i dati — mai piatti, arredi o atmosfera.
   Chiamalo con il suo "tipo": un'osteria non diventa una trattoria.
   Gli esempi della description (sotto) sono le sole frasi d'esempio: tre giuste e
   tre sbagliate, tutte da prove vere.
   Un oggetto concreto (${CONCRETE_OBJECTS.slice(0, 16).map(o => o.nome).join(', ')}…) che
   non compare nei fatti o nel nome viene tolto dal codice, con la sua frase.

${DESCRIPTION_RULE_PROMPT}

   insiderTip (max 100 car): un consiglio pratico SOLO se nasce dai fatti o dai
     dati della tappa. Altrimenti "insiderTip": null — il campo è opzionale e
     l'interfaccia lo omette. Nessun consiglio è meglio di un consiglio di un'altra
     categoria o di un consiglio inventato.
     ✗ "Consigliata visita mattutina"  ← generico e inutile
     ✗ "Entra dalla porta laterale, quella principale è chiusa lun/mar"  ← ORARI che non hai
     ✗ "Non perderti la sezione dedicata agli artisti emergenti"  ← contenuto INVENTATO

   bestTime (max 100 car): perché ORA — ma SOLO se il motivo è verificabile dai
     dati che ti ho dato (orario di arrivo, alba e tramonto, meteo, data).
     NON ricevi orari di apertura o chiusura: NON citare ore di apertura.
     Se non hai un motivo vero, scrivi "bestTime": null:
     un motivo inventato è peggio di un campo assente.
     ✓ "Con il cielo coperto di oggi non si cammina controluce"  ← meteo, che hai
     ✗ "Alle 17 la luce entra dalla vetrata sud e colpisce l'altare"  ← orario inventato

   transition (max 80 car): il passaggio alla prossima tappa, SOLO con dati veri
     (il nome della prossima tappa, i minuti a piedi). Non descrivere strade,
     muri o vetrine che non conosci; se non hai niente di vero, "transition": null.
     ⛔ NON dire cosa sta accadendo ORA lungo il percorso (gente, luci, bar che aprono).
     ✗ "Le luci dei bar si accendono lentamente"  ← cosa accade ORA, che non sai

REGOLE VOCE — parole VIETATE (le sostituisci con un dettaglio concreto):
${bannedWordsPromptLines()}

REGOLE STRUTTURA:
- NON AFFERMARE MAI se un posto è aperto o chiuso, e NON dedurlo dall'ora.
  Non ricevi i suoi orari: qualunque frase sull'apertura sarebbe inventata.
  Vietato scrivere "aperto adesso", "chiuso a quest'ora", "lo trovi ancora aperto",
  e vietato citare orari di apertura o chiusura in QUALSIASI campo.
  Puoi dire quando arrivi; mai se il posto è accessibile.
- COERENZA COL TIPO: ogni frase che scrivi su una tappa deve essere compatibile
  col suo "types". Prima di scrivere, rileggi il "types" di QUEL candidato.
  Un consiglio gastronomico su un museo, o una nota su una sala espositiva in un
  bar, è un errore che invalida la tappa.
- Adatta il tono al gruppo: coppia→intimo, amici→vivace, famiglia→kid-friendly, solo→contemplativo.
- Il TITOLO di ogni giorno nasce dalle TAPPE CHE RACCONTI e dalla richiesta
  dell'utente, non da un modello. Deve poter valere solo per QUESTO giorno: se lo
  si potesse incollare su un tour diverso di ${city}, è sbagliato. Forma evocativa
  ("<aggettivo/immagine> <sostantivo> di ${city}"), mai "Tour di ${city}".
  Se le tappe sono gastronomiche il titolo parla di cibo; se sono musei parla
  d'arte. NON usare formule già sentite: inventane una da queste tappe.

FORMATO OUTPUT — JSON puro, zero markdown, zero testo fuori:
{
  "days": [{
    "day": 1,
    "title": "Titolo evocativo unico",
    "suggestedTransit": "walking|bus|metro",
    "mapMood": "romantico|storia|avventura|natura|cibo|shopping|arte|sorpresa|sport",
    "stops": [{
      "place_id": "lo stesso place_id che hai ricevuto",
      "description": "la frase PERCHÉ QUI, solo con fatti e dati (max 160 car)",
      "insiderTip": "consiglio dai fatti o dai dati (max 100 car) — oppure null",
      "bestTime": "perché ORA (max 100 car) — oppure null se non hai un motivo vero",
      "transition": "passaggio alla prossima tappa con dati veri (max 80 car) — oppure null"
    }]
  }]
}

⚠️ NON produrre: nome/latitude/longitude/rating/foto/indirizzo/orari.
Li ho già io. Un giorno per ogni giorno ricevuto, una tappa per ogni tappa ricevuta.`;
};

// Gate II (16/07) — Hash FNV-1a 32-bit per cache key deterministica su
// pool grandi (place_id set). Non crypto: dedup/cache client-side.
const hashStr = (s) => {
    let h = 2166136261;
    const str = String(s || '');
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h * 16777619) >>> 0;
    }
    return h.toString(36);
};

// Gate II — Prompt UNIFICATO per generare N tour Home in una call.
//
// Prima: buildSelectorSystemPrompt genera 1 tour (l'insider). I 4 tematici
// (buildSmartExperiencesAsync) saltavano il narratore, description restava ''.
// Sintomi: "Vista mare" senza descrizione, "Verde relax" con badge "Tour di
// esempio" (guard isMockTour scattava su steps vuoti dopo applyRadiusFilter).
//
// Ora: 1 call, N tour narrati. Costo invariato (1 call OpenAI, output 2-3x
// piu' grande — trascurabile su gpt-4o-mini). L'insider e' uno dei N tour,
// non un path separato: tutte le tappe di tutti i tour vengono dallo stesso
// narratore, con la stessa qualita' di voce.
//
// Regole voce identiche a buildSelectorSystemPrompt (locked): fatti sensoriali,
// zero aggettivi vuoti, insiderTip pratico da local, bestTime "perche' ORA".
// Un place_id in un solo tour (dedup post-processing lato codice).
// ─── Gate PER TE — il pool dei tour "Per Te" si decide in codice ─────────────
//
// Tappe per tour chieste al modello. Il prompt le legge da qui, e da qui le
// legge anche la regola dei doppioni (un tema cede un luogo all'insider solo
// se gliene restano abbastanza per un tour completo).
export const HOME_TOUR_STOPS = { min: 3, max: 5 };
const HOME_INSIDER_SIZE = 15;

const homePid = (p) => p?.place_id || p?.googlePlaceId || null;

/**
 * Gate PER TE — il blocco insider: i luoghi migliori di TUTTI i temi, scelti
 * DOPO il filtro di distanza (prima si sceglievano i 15 migliori e poi si
 * scartavano quelli lontani, e l'insider restava corto).
 *
 * P7a — punteggio di Gate MERITO (selectScoredCandidatePool: unicita' + voto,
 * soglia di qualita', al massimo UNA icona del decimo piu' recensito), non piu'
 * voto × ln(1+recensioni): quella formula premiava proprio i luoghi piu'
 * famosi, e "Per Te" sceglieva Musei Capitolini. A parita' di voto vince il
 * meno recensito. Il DNA entra solo se ha fiducia (`dnaWeights._share`).
 */
export const buildInsiderPool = (themedPools, cityCenter, city, size = HOME_INSIDER_SIZE, dnaWeights = { _share: 0 }) => {
    const union = new Map();
    for (const pois of Object.values(themedPools || {})) {
        if (!Array.isArray(pois)) continue;
        for (const p of pois) {
            const pid = homePid(p) || p?.title;
            if (pid && !union.has(pid)) union.set(pid, p);
        }
    }
    return selectScoredCandidatePool(applyRadiusFilter([...union.values()], cityCenter, city), {
        city, dnaWeights, limit: size, maxIcons: 1,
    });
};

/**
 * Gate PER TE — i candidati che arrivano al modello.
 *
 *   1. DISTANZA, in codice: oltre il raggio (10 km in citta', 5 nei borghi;
 *      20/12 se ne restano troppo pochi — applyRadiusFilter) il candidato non
 *      entra nel prompt. Il modello non riceve coordinate: chiedergli di
 *      rispettare una distanza era chiedergli una cosa che non poteva fare, e
 *      le tappe lontane si pagavano per poi buttarle.
 *   2. DOPPIONI: ogni luogo una sola volta. Fra i temi vince il primo; il
 *      blocco insider (fatto con i luoghi migliori di tutti i temi) si tiene un
 *      luogo solo se al suo tema ne restano almeno HOME_TOUR_STOPS.max,
 *      altrimenti il luogo resta al tema. Prima ogni luogo insider compariva
 *      due volte, e il tour che arrivava dopo perdeva la tappa in silenzio.
 *   3. P7a2 — MERITO anche nei temi: ogni pool di tema si ordina col punteggio
 *      di Gate MERITO (unicita' + voto, il DNA solo con fiducia), misurato su
 *      TUTTI i candidati della generazione, con al massimo UNA icona per tema.
 *      Prima i temi arrivavano al modello nell'ordine di Google, e il modello
 *      sceglieva i primi: Musei Capitolini, Giardino degli Aranci. L'insider
 *      e' gia' ordinato da buildInsiderPool e qui non si riordina.
 */
export const prepareHomePools = (themedCandidates, cityCenter, city, { dnaWeights = { _share: 0 }, foodPrefs = null } = {}) => {
    const pools = {};
    for (const [theme, arr] of Object.entries(themedCandidates || {})) {
        if (!Array.isArray(arr) || arr.length === 0) continue;
        pools[theme] = applyRadiusFilter(arr, cityCenter, city);
        // P7b — i vincoli (budget, dieta) in codice, su ogni pool, insider compreso.
        if (hasFoodPrefs(foodPrefs)) {
            const fc = applyFoodConstraints(pools[theme], foodPrefs, isMealPlace);
            if (fc.tolti.length > 0) console.warn(`[P7b VINCOLI] Per Te ${city}/${theme}: ${fc.tolti.length} tolti — ${fc.tolti.map(x => `${x.name} (${x.motivo})`).join(' | ')}`);
            pools[theme] = fc.candidates;
        }
    }
    const tutti = [...new Map(Object.values(pools).flat().map(p => [homePid(p) || p?.name, p])).values()];
    for (const theme of Object.keys(pools)) {
        if (theme === 'insider') continue;
        pools[theme] = rankByMerit(pools[theme], {
            reference: tutti, dnaWeights, maxIcons: 1,
            bonus: hasFoodPrefs(foodPrefs) ? (c) => foodPrefBonus(c, foodPrefs, isMealPlace) : null,
        });
    }
    const owner = new Map();
    let doppioniTemi = 0;
    for (const theme of Object.keys(pools).filter(t => t !== 'insider')) {
        pools[theme] = pools[theme].filter(p => {
            const pid = homePid(p);
            if (!pid) return true;
            if (owner.has(pid)) { doppioniTemi++; return false; }
            owner.set(pid, theme);
            return true;
        });
    }
    let allInsider = 0;
    let alTema = 0;
    // P7a — i luoghi che l'insider ha ceduto al tema. Se il modello li mette
    // comunque nell'insider e nessun altro tour li usa, generateHomeTours li
    // accetta invece di scartarli. Non enumerabile: Object.keys(pools) resta
    // l'elenco dei temi.
    const ceduti = new Map();
    if (pools.insider) {
        const kept = [];
        const seen = new Set();
        for (const p of pools.insider) {
            const pid = homePid(p);
            if (!pid) { kept.push(p); continue; }
            if (seen.has(pid)) continue;
            seen.add(pid);
            const t = owner.get(pid);
            if (!t) { kept.push(p); continue; }
            if (pools[t].length - 1 >= HOME_TOUR_STOPS.max) {
                pools[t] = pools[t].filter(x => homePid(x) !== pid);
                kept.push(p);
                allInsider++;
            } else {
                alTema++;
                ceduti.set(pid, { poi: p, tema: t });
            }
        }
        pools.insider = kept;
    }
    Object.defineProperty(pools, 'ceduti', { value: ceduti, enumerable: false });
    for (const t of Object.keys(pools)) if (pools[t].length === 0) delete pools[t];
    if (doppioniTemi + allInsider + alTema > 0) {
        console.info(`[Per Te] ${city}: doppioni nel pool — ${allInsider} luoghi lasciati all'insider e tolti dal tema, ${alTema} lasciati al tema e tolti dall'insider, ${doppioniTemi} fra temi`);
    }
    return pools;
};

/**
 * Gate PER TE — la risposta del modello, anche tagliata.
 * Con finish_reason 'length' il JSON si interrompe a meta': prima JSON.parse
 * lanciava e "Per Te" andava in errore, buttando anche i tour gia' completi.
 * Qui si tengono i tour CHIUSI dell'array `tours`; quello tagliato si perde.
 * @returns {{ tours: Array, truncated: boolean }}
 */
export const parseHomeToursResponse = (raw) => {
    try {
        const parsed = JSON.parse(raw);
        return { tours: Array.isArray(parsed) ? parsed : (parsed?.tours ?? []), truncated: false };
    } catch { /* risposta incompleta: si recuperano i tour chiusi */ }
    const str = String(raw || '');
    const key = str.indexOf('"tours"');
    const open = key >= 0 ? str.indexOf('[', key) : str.indexOf('[');
    const tours = [];
    if (open < 0) return { tours, truncated: true };
    let depth = 0;
    let start = -1;
    let inStr = false;
    let esc = false;
    for (let j = open + 1; j < str.length; j++) {
        const ch = str[j];
        if (inStr) {
            if (esc) esc = false;
            else if (ch === '\\') esc = true;
            else if (ch === '"') inStr = false;
            continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === '{') { if (depth === 0) start = j; depth++; }
        else if (ch === '}') {
            depth--;
            if (depth === 0 && start >= 0) {
                try { tours.push(JSON.parse(str.slice(start, j + 1))); } catch { /* tour malformato: si salta */ }
                start = -1;
            }
        } else if (ch === ']' && depth === 0) break;
    }
    return { tours, truncated: true };
};

// Gate PER TE — nessuno scarto silenzioso: ogni tappa raccontata e poi tolta
// lascia una riga con il motivo.
const logHomeDiscard = (city, tour, title, motivo) => {
    console.warn(`[Per Te] ${city}: scartata "${title || '?'}" (tour ${tour}) — ${motivo}`);
};

const buildUnifiedHomeToursPrompt = ({ city, timeContext, weather, weatherIcon, prefs, aiProfile, themedCandidates }) => {
    const groupLabel = prefs?.group || 'chiunque';
    const transitHint = prefs?.pace === 'intenso' ? 'con qualche mezzo' : 'a piedi';
    // Gate PER TE — via la frase "Tutte le tappe devono restare entro N km":
    // il modello non riceve coordinate e non poteva verificarla. La distanza
    // la decide il codice prima del prompt (prepareHomePools).

    // Meta per tema: titolo suggerito + focus categoria (per aiutare l'AI a
    // non mescolare cibo in un tour cultura).
    const themeMeta = {
        insider: { titleHint: `Titolo evocativo unico, DERIVATO dalle tappe che hai scelto: deve poter valere solo per QUESTE tappe, non per un altro tour di ${city}. Forma "<aggettivo/immagine> <sostantivo> di ${city}", mai "Tour di ${city}". NON riusare formule gia' sentite: inventane una da queste tappe.`, focus: 'perla nascosta, mix di categorie che raccontano l\'anima della citta\', prima tappa NON e\' il monumento piu\' famoso' },
        food:    { titleHint: `Titolo tipo "Assapora ${city}" o "Street food di ${city}"`, focus: 'ristoranti, trattorie, mercati, gelaterie, caffe\' — SOLO tappe food' },
        cultura: { titleHint: `Titolo tipo "Tesori di ${city}" o "Storia di ${city}"`, focus: 'chiese, musei, palazzi, monumenti, piazze storiche — SOLO tappe cultura/storia/arte' },
        romance: { titleHint: `Titolo tipo "Vista mare a ${city}" o "${city} al tramonto"`, focus: 'lungomari, panorami, belvederi, giardini romantici, scalinate scenografiche' },
        nature:  { titleHint: `Titolo tipo "Verde e Relax a ${city}" o "${city} outdoor"`, focus: 'parchi, ville, aree verdi, percorsi naturalistici' },
    };

    const buildCandidatesLite = (pois) => pois.map(p => ({
        place_id: p.place_id || p.googlePlaceId,
        name: p.name,
        rating: p.rating,
        user_ratings_total: p.user_ratings_total,
        types: (p.types || []).slice(0, 5),
        address: p.address || null,
    }));

    const themedBlocks = Object.entries(themedCandidates)
        .filter(([, pois]) => Array.isArray(pois) && pois.length > 0)
        .map(([theme, pois]) => {
            const lite = buildCandidatesLite(pois);
            const meta = themeMeta[theme] || themeMeta.insider;
            return `━━━ TOUR "${theme.toUpperCase()}" — ${meta.focus}
Titolo: ${meta.titleHint}
${lite.length} candidati REALI (usa questi place_id):
${JSON.stringify(lite, null, 2)}`;
        }).join('\n\n');

    const totalPois = Object.values(themedCandidates).reduce((sum, arr) => sum + (arr?.length || 0), 0);
    const themeList = Object.keys(themedCandidates).filter(k => themedCandidates[k]?.length > 0);

    return `SEI L'INSIDER DI ${city} — un local che ti mostra la sua citta', non una guida turistica, non Wikipedia, non un elenco.

⚠️ NON scegli tu i luoghi. Io ti do ${totalPois} luoghi REALI di ${city}, gia' verificati su Google (rating, tipo, foto), raggruppati per TEMA.

Il tuo lavoro: produci ${themeList.length} tour distinti (uno per TEMA), ognuno di ${HOME_TOUR_STOPS.min}-${HOME_TOUR_STOPS.max} tappe.

Contesto:
• orario: ${timeContext}
• gruppo: ${groupLabel}
• meteo: ${weather?.condition || 'sereno'} ${weather?.temperature || 22}°${aiProfile ? `\n• profilo utente: ${aiProfile}` : ''}

REGOLE:
1. SCELTA — per ogni tour, scegli ${HOME_TOUR_STOPS.min}-${HOME_TOUR_STOPS.max} tra i SUOI candidati (quelli piu' adatti a orario/gruppo/meteo).
2. ORDINE — costruisci un percorso che ${transitHint} abbia senso NARRATIVO, non solo geometrico.
3. VOCE — per ogni tappa racconta come un local sussurra un segreto:

   ⛔ NON ATTRIBUIRE A UN POSTO CONTENUTI CHE NON SAI ESISTANO LI'.
   Di ogni luogo sai SOLO questo: nome, "types", rating, numero di recensioni,
   indirizzo. Nient'altro. Da li' NON si deduce cosa c'e' dentro: quali opere,
   quali mostre, quali sale, quali piatti, quali servizi, quali eventi.
   Vietato scrivere che un posto ospita, espone, propone o contiene qualcosa,
   se non risulta dai dati che hai.

   COME SI RISOLVE LA TENSIONE (leggi: e' la regola che decide):
   ti chiedo di essere SPECIFICO e insieme di NON INVENTARE. Non e' una
   contraddizione: la specificita' deve stare su cio' che e' deducibile dai dati
   che hai, o su cio' che vale per QUEL TIPO di posto in generale — non su
   contenuti asseriti di quel singolo luogo.
   Se la scelta e' tra generico e falso, VINCE IL GENERICO.
   "Dentro la temperatura scende di colpo" (vero di quasi ogni chiesa in pietra)
   e' meglio di "la sala 3 ha una panca davanti al quadro piu' piccolo" (che non
   puoi sapere).

${DESCRIPTION_RULE_PROMPT}
     ✗ "Chiesa barocca del XVIII secolo, patrimonio della citta'"  ← da enciclopedia

   insiderTip (max 100 car): un consiglio pratico che solo chi ci vive sa.
     ✓ "Chiedi il caffe' al bancone, seduto costa il doppio"
     ✗ "Consigliata visita mattutina"

   bestTime (max 100 car): perche' ORA — ma SOLO se il motivo è verificabile dai
     dati che ti ho dato (momento della giornata, meteo, stagione). NON ricevi
     orari di apertura o chiusura: NON citare ore.
     Se non hai un motivo vero, scrivi "bestTime": null. Il campo è opzionale e
     l'interfaccia lo omette: un motivo inventato è peggio di un campo assente.
     ✓ "Con il cielo coperto di oggi non si cammina controluce"  ← meteo, che hai
     ✗ "Alle 17 la luce entra dalla vetrata sud e colpisce l'altare"  ← orario inventato
     ✗ "Momento migliore: pomeriggio"

   transition (max 80 car): cosa vedi camminando alla prossima tappa.
     ⛔ NON dire cosa sta accadendo ORA lungo il percorso, e non dedurlo dall'ora:
     non sai se i bar stiano aprendo, se ci sia gente, se le luci siano accese.
     Descrivi cosa c'è, non cosa sta succedendo.
     ✓ "Il ponte e' stretto, si passa uno alla volta"
     ✗ "Prosegui verso la prossima tappa a 5 min a piedi"
     ✗ "Le luci dei bar si accendono lentamente"  ← cosa accade ORA, che non sai"

REGOLE VOCE — parole VIETATE (le sostituisci con un dettaglio concreto):
${bannedWordsPromptLines()}

REGOLE STRUTTURA:
- NON AFFERMARE MAI se un posto è aperto o chiuso, e NON dedurlo dall'ora.
  Non ricevi i suoi orari: qualunque frase sull'apertura sarebbe inventata.
  Vietato scrivere "aperto adesso", "chiuso a quest'ora", "lo trovi ancora aperto",
  e vietato citare orari di apertura o chiusura in QUALSIASI campo.
  Puoi dire cosa si vede o si sente in questo momento della giornata
  (contesto: ${timeContext}); mai se il posto è accessibile.
- Adatta il TIPO di posto al gruppo: coppia→intimo, amici→vivace, famiglia→kid-friendly, solo→contemplativo.
- Un place_id puo' apparire in AL PIU' UN tour. Non ripetere lo stesso luogo in tour diversi.
- Se un tour non ha 3 candidati adatti al contesto, meglio 2-3 tappe che tappe inventate. NON creare tappe con description generica per riempire.

FORMATO OUTPUT — JSON puro, zero markdown, zero testo fuori:
{
  "tours": [
    {
      "themeType": "insider" | "food" | "cultura" | "romance" | "nature",
      "title": "Titolo evocativo (segui indicazioni per tema)",
      "mapMood": "romantico|storia|avventura|natura|cibo|shopping|arte|sorpresa|sport",
      "suggestedTransit": "walking|bus|metro",
      "stops": [{
        "place_id": "ChIJ... — deve essere uno di quelli del tuo blocco tema",
        "description": "voce insider sensoriale (max 120 car)",
        "insiderTip": "consiglio da local (max 100 car)",
        "bestTime": "perche' ORA (max 100 car) — oppure null se non hai un motivo vero",
        "transition": "cosa vedi camminando (max 80 car)",
        "type": "cultura|storia|food|shopping|relax|arte|natura"
      }]
    }
  ]
}

⚠️ NON produrre: name/title del POI/latitude/longitude/rating/photo/address.
Li ho gia' io e li prendero' dal candidato che tu identifichi con place_id.
Ogni place_id DEVE essere uno di quelli del suo blocco tema — altri id verranno scartati.

Ecco i candidati raggruppati per tema:

${themedBlocks}`;
};

// Gate NARRATORE/POI (Fase 2b) — regola locked #16: se il narratore non
// produce una descrizione vera, la tappa NON entra ("meno tappe > tappe vuote").
//
// Predicato UNICO, condiviso da generateHomeTours e generateItinerary. Prima
// esisteva solo inline in generateHomeTours (Gate II.2): una regola locked
// scritta in due posti diverge alla prima modifica, e infatti generateItinerary
// non l'ha mai avuta — è la lacuna che ha lasciato passare la tappa-località
// di Ippocampo con testo poetico al posto di un fatto.
//
// Corpo identico a quello che era inline: nessun cambio di comportamento per
// il path Home.
// Exported per test.
// Gate NARRATORE ANCORATO DIFF 2 — rinominato da `hasNonEmptyDescription`.
// Il vecchio nome prometteva piu' di quanto il predicato faccia: verifica che
// `description` sia una stringa NON VUOTA, non che dica il vero. Qualunque frase
// inventata lo supera, e non guarda `insiderTip`. Il nome contava perche' questo
// predicato decide se una tappa entra nel tour (:1335, :1778): "hasReal…"
// suggeriva un controllo di verita' che non c'e' mai stato.
// E' la lezione #26 in un identificatore invece che in un commento.
// Se un domani servira' un predicato che verifica la QUALITA' e non la lunghezza,
// nasce ACCANTO a questo, non dentro: sono due domande diverse.
export const hasNonEmptyDescription = (s) => !!(s?.description && String(s.description).trim().length > 0);

// Post-processing: prende gli stop AI (con place_id) e li canonizza dai candidati
// reali. Riscrive title/lat/lng/rating/googlePhoto/type dal record Google, tiene
// dall'AI description/insiderTip/bestTime/transition/time/suggestedMinutes.
// Se AI ha inventato un place_id inesistente, quello stop viene scartato.
// Exported per test.
// Gate NARRATORE-DOPO — `guard: false` quando le tappe non portano ancora un
// racconto (generateItinerary: il narratore scrive dopo, e i guard girano su
// quello, via logNarratorViolations). Default invariato per la Home.
export const canonicalizeStopsFromCandidates = (aiStops, candidates, { guard = true } = {}) => {
    const byId = new Map();
    for (const c of candidates) {
        const k = c.place_id || c.googlePlaceId;
        if (k) byId.set(k, c);
    }
    const stops = aiStops.map(s => {
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
            // Gate RAGGIO DIFF 1a — `suggestedMinutes: s.suggestedMinutes || 30`
            // RIMOSSO: era una durata CHIESTA AL MODELLO e accettata senza
            // validazione. La durata ora si calcola da `types` + distanza in
            // src/lib/tourTiming.js, dopo l'ordinamento definitivo.
            //
            // `types` (i types Google INTERI) viene portato qui apposta: la
            // tabella di sosta ne ha bisogno, e `type` qui sotto e' gia' una
            // riduzione a sei valori che perde l'informazione — `church` e
            // `museum` collassano entrambi su 'cultura' ma durano 20 e 60.
            types: Array.isArray(c.types) ? c.types : [],
            // Gate TOUR-SENSATO (F14) — Google è l'autorità sulla categoria.
            // Prima era `s.type || c.type`: vinceva l'etichetta scritta dall'AI,
            // e nessuno verificava che corrispondesse al posto. Device 16/08:
            // "Beach Club Ippocampo" (types bar/food/restaurant) etichettato
            // CULTURA, un condominio etichettato NATURA.
            // `c.type` viene da mapGoogleTypeToOurType sui types reali; l'AI
            // resta come fallback quando Google non sa classificare.
            // Verificato che i sei valori Google-derived siano tutti coperti da
            // normalizeStepCategory: museum/church→cultura, park→natura,
            // restaurant→food, monument→storia, place già in TOUR_CATEGORIES.
            type: c.type || s.type || 'place',
            latitude: c.latitude ?? c.lat,
            longitude: c.longitude ?? c.lng,
            // Gate PULIZIA P5 — rimosso `price: … : 0`. Lo schema del selettore
            // non ha un campo price: il default rendeva ogni tappa "Gratuito".
            // Nessun lettore resta scoperto: TourDetails.jsx filtra gia' `> 0`.
            rating: c.rating || null,
            googlePlaceId: c.place_id || c.googlePlaceId,
            googlePhoto: c.googlePhoto || null,
            image: c.googlePhoto || c.image || null,
            place_id: c.place_id || c.googlePlaceId,
            city: c.city || null,
        };
    }).filter(Boolean);

    // Gate NARRATORE ANCORATO — DIFF 4 FASE B: gli invarianti sull'output del
    // narratore, applicati alle tappe VERE appena canonizzate.
    //
    // SOLO LOG, di proposito. `stops` viene restituito intatto: stesso numero di
    // tappe, stessi campi, anche quando la violazione c'e'. E' il punto di tutta
    // la fase — bundle diverso, output identico — ed e' asserito da
    // narratorGuardsInnesto.test.js ("il numero di tappe e' invariato").
    //
    // Perche' non annullare subito il campo in violazione (sarebbe la Fase C):
    // non sappiamo ancora QUANTO spesso scatta. Se scattasse spesso, il problema
    // sarebbe il PROMPT, e annullare il campo mascherebbe un tour scadente invece
    // di ripararlo — nasconderebbe la diagnosi proprio mentre la si raccoglie.
    // La Fase C si apre solo dopo aver letto log VERI, e va decisa da Ivano.
    //
    // Qui si logga DOPO il filtro: una tappa scartata per place_id inventato non
    // esiste, e segnalarne il testo sarebbe rumore su qualcosa che nessuno vedra'.
    if (guard) logNarratorViolations(stops, 'canonicalize');

    return stops;
};

// Gli invarianti del narratore, solo log (vedi sopra). Estratto dal corpo di
// canonicalizeStopsFromCandidates per girare anche DOPO la narrazione
// separata di generateItinerary (path=narratore).
const logNarratorViolations = (stops, path) => {
    try {
        // Gate INTENT (28/08) — LOG DI INGRESSO. Chiude il problema lasciato
        // aperto dal DIFF 4: fino a ieri "zero violazioni" e "guard mai
        // eseguito" producevano lo STESSO silenzio, e un giro device che non
        // trova violazioni non poteva distinguere le due cose.
        // Il campo `path` dice da quale porta e' passato il controllo:
        // canonicalize (Home) o narratore (generateItinerary).
        console.info(`[Narratore] check avviato, ${stops.length} tappe, path=${path}`);
        for (const v of findTourViolations(stops)) {
            const poi = stops[v.indice]?.title || '(senza titolo)';
            console.warn(
                `[Narratore] VIOLAZIONE ${v.invariante} | campo=${v.campo} | POI="${poi}" | estratto="${v.estratto}"`
            );
        }
    } catch (e) {
        // Un guard che rompe la generazione del tour sarebbe molto peggio del
        // difetto che sorveglia: qui si osserva, non si decide nulla.
        console.warn('[Narratore] guard non eseguiti:', e?.message);
    }
};

// ─── Gate NARRATORE-DOPO — narrazione delle tappe finali ────────────────────
//
// Il narratore scrive DOPO che il codice ha fissato tappe e orari. Qui:
//   · la partenza di ogni giorno, legata alla SUA finestra (windowIndex): un
//     giorno rimasto vuoto e tolto non deve spostare gli orari dei successivi;
//   · alba e tramonto del giorno, dal codice (sunTimes);
//   · la chiamata al narratore e l'applicazione del racconto per place_id;
//   · il controllo luce/ora (narrationLight): frase incoerente → tolta.

const VALID_MOODS = new Set(['romantico', 'storia', 'avventura', 'natura', 'cibo', 'shopping', 'arte', 'sorpresa', 'sport']);
const VALID_TRANSIT = new Set(['bus', 'metro', 'walking']);
const NARRATION_TEXT_FIELDS = ['description', 'insiderTip', 'bestTime', 'transition'];
// Gate PAROLE VIETATE — i campi in cui una frase con una parola vietata si toglie.
// P3d: anche `transition`, che le schermate della mappa mostrano.
const BANNED_WORD_FIELDS = ['description', 'insiderTip', 'bestTime', 'transition'];

/**
 * Gate PAROLE VIETATE — il filtro su UNA tappa, uguale per l'itinerario e per i
 * tour "Per Te" della Home. Il nome proprio della tappa (title/name, da Google)
 * non fa scattare il filtro: "Museo Storico della Liberazione" e' un nome.
 * P3d-b: anche le frasi che aprono con un'impressione dei sensi (regola
 * 'apertura-sensi'), con lo stesso filtro.
 * @returns {{ stop: object, removed: Array<{ campo: string, frase: string, parole: string[], regola: string }> }}
 */
const scrubBannedWords = (stop) => {
    const next = { ...stop };
    const removed = [];
    const exempt = [stop?.title, stop?.name].filter(Boolean);
    for (const campo of BANNED_WORD_FIELDS) {
        if (next[campo] == null) continue;
        const r = filterBannedWords(next[campo], { exempt });
        next[campo] = r.text;
        for (const x of r.removed) removed.push({ campo, frase: x.frase, parole: x.parole, regola: x.regola });
    }
    return { stop: next, removed };
};

const logBannedRemovals = (city, title, removed, path) => {
    for (const x of removed) {
        console.warn(`[Gate PAROLE VIETATE] ${city} (${path}): tolta frase (${x.parole.join(',') || x.regola}) da ${x.campo} di "${title}" — "${x.frase}"`);
    }
};

/**
 * Gate PAROLE VIETATE (P3d) — i tour "Per Te" letti dalla cache passano dallo
 * stesso filtro della generazione, con la stessa regola #16 della Home: una
 * tappa rimasta senza descrizione esce, un tour rimasto senza tappe esce.
 * Se una tappa esce, le stime di cammino si ricalcolano sulle tappe rimaste
 * (computeStopTimings): lo spostamento e' una proprieta' della coppia.
 */
const scrubHomeTours = (result, city) => ({
    ...result,
    tours: (result?.tours || []).map(t => {
        const scrubbed = (t.stops || []).map(st => {
            const r = scrubBannedWords(st);
            logBannedRemovals(city, st.title, r.removed, 'home-cache');
            return r.stop;
        });
        // Gate PER TE — nessuno scarto silenzioso, anche dalla cache.
        const kept = scrubbed.filter(st => {
            if (hasNonEmptyDescription(st)) return true;
            logHomeDiscard(city, t.themeType, st.title, 'descrizione vuota dopo il filtro parole vietate (cache)');
            return false;
        });
        return { ...t, stops: kept.length < scrubbed.length ? computeStopTimings(kept).stops : kept };
    }).filter(t => {
        if (t.stops.length > 0) return true;
        console.warn(`[Per Te] ${city}: tour "${t.themeType}" senza tappe dopo gli scarti (cache) → non servito`);
        return false;
    }),
});
const ROMA_FALLBACK = { latitude: 41.9028, longitude: 12.4964 };

const clockLabel = (value) => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const p = romeParts(d);
    return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
};
const tableClock = ({ h, m }) => `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

// La partenza di ogni giorno: un Date per un percorso di un giorno (com'era),
// un array allineato ai giorni per "2-3 Giorni".
const dayStartsFor = (days, tourWindow) => {
    const windows = tourWindow?.windows || [];
    if (windows.length <= 1) return tourWindow?.start;
    return (days || []).map((d, i) => windows[d?.windowIndex ?? i]?.start ?? null);
};

const sunForDay = (day, i, tourWindow, cityCenter) => {
    const w = (tourWindow?.windows || [])[day?.windowIndex ?? i] || tourWindow?.windows?.[0];
    const date = w?.date || tourWindow?.date || null;
    const [y, m, d] = String(date || '').split('-').map(Number);
    const lat = Number.isFinite(cityCenter?.latitude) ? cityCenter.latitude : ROMA_FALLBACK.latitude;
    const lng = Number.isFinite(cityCenter?.longitude) ? cityCenter.longitude : ROMA_FALLBACK.longitude;
    return { date, ...sunTimes({ y, m, d }, lat, lng) };
};

const cleanText = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Il controllo sul racconto di un tour gia' raccontato: parole vietate
 * (Gate PAROLE VIETATE) e luce/ora. Gira dopo la narrazione e di nuovo a ogni
 * lettura da cache (gli orari si ricalcolano da adesso; e una voce di cache
 * scritta prima di un controllo lo riceve comunque).
 * description/insiderTip/bestTime si giudicano all'arrivo; transition alla
 * partenza (arrivo + sosta), perche' racconta il cammino verso la prossima.
 */
const guardNarrationLight = (days, starts, tourWindow, cityCenter) => {
    const frasiTolte = [];
    const timed = refreshTourScheduledTimes(days, starts);
    const out = (days || []).map((day, di) => {
        const sun = sunForDay(day, di, tourWindow, cityCenter);
        return {
            ...day,
            stops: (day.stops || []).map((s, si) => {
                const iso = timed[di]?.stops?.[si]?.scheduledTime;
                const arrival = iso ? new Date(iso) : null;
                const departure = arrival && Number.isFinite(s.stayMinutes)
                    ? new Date(arrival.getTime() + s.stayMinutes * 60000) : arrival;
                const next = { ...s };
                // Gate PAROLE VIETATE — prima si tolgono le frasi con una parola
                // vietata (description, insiderTip, bestTime). Prima di questo
                // gate l'elenco stava solo nel prompt e nessuno lo controllava.
                // P3d: con il nome della tappa esente e anche su transition.
                const banned = scrubBannedWords(next);
                Object.assign(next, banned.stop);
                for (const x of banned.removed) {
                    frasiTolte.push({ place_id: s.place_id, title: s.title, campo: x.campo, frase: x.frase, regole: [x.regola], parole: x.parole, arrivo: clockLabel(arrival) });
                }
                for (const campo of NARRATION_TEXT_FIELDS) {
                    if (next[campo] == null) continue;
                    const at = campo === 'transition' ? departure : arrival;
                    const r = filterTimeIncoherent(next[campo], { arrival: at, sunrise: sun.sunrise, sunset: sun.sunset });
                    next[campo] = r.text;
                    for (const x of r.removed) {
                        frasiTolte.push({ place_id: s.place_id, title: s.title, campo, frase: x.frase, regole: x.regole, arrivo: clockLabel(at) });
                    }
                }
                return next;
            }),
        };
    });
    return { days: out, frasiTolte };
};

/**
 * La terza chiamata: racconta le tappe finali. Non lancia mai, tranne per la
 * quota (AiQuotaExceededError): un narratore caduto lascia le tappe senza testo
 * e lo dice nel report, ma non butta un percorso gia' scelto e verificato.
 */
const narrateFinalDays = async ({ city, days, starts, tourWindow, cityCenter, weather, prefs, aiProfile, userPrompt, quotaTicket, facts = new Map(), locali = new Map(), luoghi = new Map() }) => {
    const timed = refreshTourScheduledTimes(days, starts);
    const giorni = timed.map((d, i) => {
        const sun = sunForDay(d, i, tourWindow, cityCenter);
        return {
            giorno: i + 1,
            data: sun.date,
            alba: clockLabel(sun.sunrise),
            tramonto: clockLabel(sun.sunset),
            tappe: d.stops.map(s => {
                const arrivo = clockLabel(s.scheduledTime);
                const p = s.scheduledTime ? romeParts(new Date(s.scheduledTime)) : null;
                // P3d-e — i fatti (solo testo e fonte) e, per i locali, i dati
                // che il motore ha gia': fascia di prezzo, minuti dalla tappa
                // prima, motivo della scelta.
                // P3d-g — per OGNI tappa: il tipo (dal nome, se lo dice: "Osteria
                // Navona" e' un'osteria), i minuti dalla tappa prima, se il
                // tramonto e' ancora davanti e il motivo della scelta. Senza fatti,
                // il "perche' qui, per te" si scrive solo con questi.
                const loc = locali.get(s.place_id);
                const arrivoMs = s.scheduledTime ? new Date(s.scheduledTime).getTime() : NaN;
                return {
                    place_id: s.place_id,
                    nome: s.title,
                    tipo: tipoTappa(s),
                    categoria: s.type || 'place',
                    types: (s.types || []).slice(0, 5),
                    momento: s.momentLabel || (p ? momentAtClock(p.h, p.mi).label : null),
                    arrivo,
                    tramonto_ancora_davanti: Number.isFinite(arrivoMs) && sun.sunset ? arrivoMs <= sun.sunset.getTime() : null,
                    minuti_a_piedi_da_prima: Number.isFinite(s.travelMinutesFromPrev) ? s.travelMinutesFromPrev : null,
                    fatti: (facts.get(s.place_id)?.fatti || []).map(f => ({ testo: f.testo, fonte: f.fonte })),
                    ...(factsAbout(facts.get(s.place_id)) ? { fatti_su: factsAbout(facts.get(s.place_id)) } : {}),
                    motivo: loc ? loc.motivo : (luoghi.get(s.place_id)?.motivo || []),
                    ...(loc ? { locale: true, price_level: loc.price_level } : {}),
                };
            }),
        };
    });
    const nTappe = giorni.reduce((a, g) => a + g.tappe.length, 0);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35_000);
    try {
        const data = await callOpenAIProxy({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: buildNarratorSystemPrompt({ city, weather, prefs, aiProfile, userPrompt, giorni }) },
                { role: 'user', content: `Racconta tutte le ${nTappe} tappe, nell'ordine dato, con il loro place_id.\nTAPPE FINALI:\n${JSON.stringify(giorni)}` },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 4000,
        }, controller.signal, quotaTicket);
        clearTimeout(timeoutId);
        const raw = data?.choices?.[0]?.message?.content;
        if (!raw) throw new Error('Empty AI response (narratore)');
        const parsed = JSON.parse(raw);
        const nDays = Array.isArray(parsed?.days) ? parsed.days : (Array.isArray(parsed?.stops) ? [{ stops: parsed.stops }] : []);
        const byId = new Map();
        for (const d of nDays) {
            for (const st of (Array.isArray(d?.stops) ? d.stops : [])) {
                if (st?.place_id && !byId.has(st.place_id)) byId.set(st.place_id, st);
            }
        }
        return { byId, meta: nDays, giorni, error: null };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof AiQuotaExceededError) throw err;
        const msg = err?.name === 'AbortError' ? 'timeout' : (err?.message || String(err));
        console.warn(`[Gate NARRATORE-DOPO] ${city}: narratore caduto (${msg}) → tappe senza racconto`);
        return { byId: new Map(), meta: [], giorni, error: msg };
    }
};

// ─── P3d-c — riscrivere invece di cancellare ────────────────────────────────
//
// Dopo i filtri (parole vietate, aperture dei sensi, luce/ora) una descrizione
// puo' restare vuota o perdere una frase. Prima la tappa restava muta (o, in
// "Per Te", usciva). Ora le tappe da rifare vanno al modello in UNA sola
// chiamata, con il motivo di ognuna ("hai usato 'magica'"), dentro lo stesso
// biglietto della generazione. Il testo nuovo ripassa dagli STESSI filtri: se
// non passa, il campo resta com'era (vuoto, se era vuoto). Mai un secondo giro.
// Si riscrive solo `description`: e' il campo che decide se la tappa si vede.

/** Il motivo, in parole del modello, di una frase tolta da un filtro. */
const rewriteReason = (x) => {
    const regole = x.regole || (x.regola ? [x.regola] : []);
    if (regole.includes('parola-vietata')) return `hai usato ${(x.parole || []).map(p => `"${p}"`).join(', ')}`;
    if (regole.includes('apertura-sensi')) return "apriva con un'impressione dei sensi";
    if (regole.includes('invenzione')) return `nominava ${(x.oggetti || []).map(o => `"${o}"`).join(', ')}, che non risulta dai fatti né dal nome`;
    if (regole.includes('giudizio')) return `dava un giudizio (${(x.oggetti || []).map(o => `"${o}"`).join(', ')}) che non è scritto nei fatti`;
    if (regole.includes('voce')) return `la voce non va (${(x.oggetti || []).join(', ')}): di' il perché con parole tue, l'orario dentro la frase, con un verbo`;
    if (regole.includes('attribuzione')) return `attribuiva alla tappa i fatti di "${x.fattiSu || '?'}" senza nominarlo`;
    if (regole.includes('tipo-locale')) return `chiamava il locale ${(x.oggetti || []).map(o => `"${o}"`).join(', ')}, ma il nome dice "${x.tipoNome || '?'}"`;
    if (regole.includes('ancoraggio')) return 'riscrivila usando i fatti e i dati forniti';
    return `parlava di ${regole.map(r => `"${r}"`).join(', ')} ma l'arrivo è alle ${x.arrivo || '?'}`;
};

export const buildRewriteSystemPrompt = ({ city }) => `Sei la voce di Unnivai a ${city}: un local, non una guida turistica.
Alcune descrizioni di tappa vanno riscritte: o sono state tolte dai nostri controlli,
o vanno ancorate ai fatti. Per ognuna ti dico cosa è stato tolto e perché.
Riscrivi SOLO il campo description, una per tappa.

${DESCRIPTION_RULE_PROMPT}

Di ogni tappa sai SOLO: nome, "tipo", "types", momento e orario di arrivo (se ci sono),
tramonto ancora davanti o no, minuti a piedi dalla tappa prima, "motivo" (perché il
motore l'ha scelta per l'utente) e "fatti" [{testo, fonte}] da Wikipedia, Wikidata o
OpenStreetMap (può essere vuoto), con "fatti_su" se parlano di un altro luogo (nominalo).
Le tappe con "locale": true hanno anche price_level.
OGNI frase usa SOLO i fatti, il nome o questi dati. Luoghi con fatti: un fatto
concreto più cosa guardare o quando. Luoghi SENZA fatti: del luogo solo nome e tipo,
poi perché è qui per l'utente, con i dati. Locali: perché è qui per l'utente, con i
dati, chiamandoli con il loro "tipo". Nessun giudizio che non sia nei fatti.
NON attribuirgli contenuti che non sono nei fatti (opere, piatti, mostre, eventi,
servizi, oggetti). NON parlare di luce o di ora (tramonto, alba, sera, notte,
mattina) se l'orario di arrivo non lo rende vero. NON dire se il posto è aperto o chiuso.

Parole e frasi VIETATE (la frase che ne contiene una viene tolta, e questa volta il
campo diventa una frase di servizio scritta dal codice):
${bannedWordsPromptLines()}

Rispondi in JSON puro: { "stops": [ { "place_id": "...", "description": "..." } ] }
Se per una tappa non hai una frase vera, scrivi "description": null.`;

/**
 * UNA chiamata di riscrittura per le tappe che i filtri hanno svuotato o
 * accorciato.
 * @param {object} p
 * @param {string} p.city
 * @param {Array<{ key: string, place_id: string, nome: string, types: string[],
 *   momento?: string|null, arrivo?: string|null, tolte: Array, exempt: string[],
 *   arrival?: Date|null, sun?: { sunrise: Date|null, sunset: Date|null }|null }>} p.items
 * @param {object} [p.quotaTicket] il biglietto della generazione
 * @returns {Promise<{ byKey: Map<string, string>, report: object }>}
 *   byKey: solo le descrizioni riscritte che hanno passato i filtri
 */
const rewriteDescriptions = async ({ city, items, quotaTicket, voce = {} }) => {
    const report = { richieste: items.length, riscritte: 0, ancoraVuote: [], scartate: [], errore: null, token: null };
    const byKey = new Map();
    if (items.length === 0) return { byKey, report };
    const tappe = items.map(it => ({
        place_id: it.place_id,
        nome: it.nome,
        types: (it.types || []).slice(0, 5),
        ...(it.momento ? { momento: it.momento } : {}),
        ...(it.arrivo ? { arrivo: it.arrivo } : {}),
        // P3d-e — i fatti e, per i locali, i dati della scelta.
        fatti: (it.fatti || []).map(f => ({ testo: f.testo, fonte: f.fonte })),
        ...(it.fattiSu ? { fatti_su: it.fattiSu } : {}),
        // P3d-g — per ogni tappa i dati del "perche' qui, per te".
        tipo: tipoTappa({ title: it.nome, types: it.types }),
        minuti_a_piedi_da_prima: Number.isFinite(it.minuti) ? it.minuti : (Number.isFinite(it.locale?.minuti) ? it.locale.minuti : null),
        ...(typeof it.tramontoDavanti === 'boolean' ? { tramonto_ancora_davanti: it.tramontoDavanti } : {}),
        motivo: it.locale?.motivo || it.motivo || [],
        ...(it.locale ? { locale: true, price_level: it.locale.price_level ?? null } : {}),
        tolto: it.tolte.length > 0
            ? it.tolte.map(x => ({ frase: x.frase, motivo: rewriteReason(x) }))
            : (it.ancora
                ? [{ frase: it.attuale || null, motivo: rewriteReason({ regole: ['ancoraggio'] }) }]
                : [{ frase: null, motivo: 'mancava la descrizione' }]),
    }));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);
    try {
        const data = await callOpenAIProxy({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: buildRewriteSystemPrompt({ city }) },
                { role: 'user', content: `Riscrivi ${tappe.length} descrizioni, una per tappa, con il loro place_id.\nTAPPE:\n${JSON.stringify(tappe)}` },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.5,
            max_tokens: Math.min(2500, 120 + 90 * tappe.length),
        }, controller.signal, quotaTicket);
        clearTimeout(timeoutId);
        report.token = data?.usage?.total_tokens ?? null;
        const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
        const out = new Map((Array.isArray(parsed?.stops) ? parsed.stops : [])
            .filter(st => st && typeof st.place_id === 'string')
            .map(st => [st.place_id, cleanText(st.description)]));
        for (const it of items) {
            const text = out.get(it.place_id) ?? null;
            if (!text) { report.ancoraVuote.push(it.nome); continue; }
            // Gli STESSI filtri della prima volta, piu' (P3d-e) il controllo
            // anti-invenzione sui fatti e sul nome.
            const parole = filterBannedWords(text, { exempt: it.exempt });
            const ora = filterTimeIncoherent(parole.text, {
                arrival: it.arrival || null, sunrise: it.sun?.sunrise || null, sunset: it.sun?.sunset || null,
            });
            const vero0 = filterInventedObjects(ora.text, { fatti: it.fatti || [], nomi: it.exempt, fattiSu: it.fattiSu || null });
            const vv = filterVoice(vero0.text, voce);
            const vero = { text: vv.text, removed: [...vero0.removed, ...vv.removed] };
            for (const x of [...parole.removed, ...ora.removed, ...vero.removed]) {
                report.scartate.push({ title: it.nome, frase: x.frase, motivo: rewriteReason(x) });
            }
            if (vero.text) { byKey.set(it.key, vero.text); report.riscritte += 1; } else report.ancoraVuote.push(it.nome);
        }
    } catch (err) {
        clearTimeout(timeoutId);
        // La riscrittura non fa mai cadere un tour gia' fatto: quota, motore giu',
        // timeout → i campi restano come li hanno lasciati i filtri.
        report.errore = err?.code || (err?.name === 'AbortError' ? 'timeout' : (err?.message || String(err)));
        report.ancoraVuote = items.map(it => it.nome);
    }
    console.info(`[P3d-c RISCRITTURA] ${city}: ${report.riscritte}/${report.richieste} descrizioni riscritte` +
        (report.errore ? ` (errore: ${report.errore})` : '') +
        (report.scartate.length ? `, ${report.scartate.length} frasi riscritte di nuovo tolte` : ''));
    for (const x of report.scartate) {
        console.warn(`[P3d-c RISCRITTURA] ${city}: "${x.title}" — riscrittura tolta (${x.motivo}): "${x.frase}"`);
    }
    return { byKey, report };
};

/**
 * Le tappe dell'itinerario da riscrivere: descrizione vuota, o una frase tolta
 * dalla descrizione. Ogni tappa porta arrivo e alba/tramonto del suo giorno,
 * per ripassare dal filtro di luce/ora.
 */
const itineraryRewriteItems = (days, frasiTolte, starts, tourWindow, cityCenter, facts = new Map(), locali = new Map(), luoghi = new Map()) => {
    const timed = refreshTourScheduledTimes(days, starts);
    const items = [];
    (days || []).forEach((day, di) => {
        const sun = sunForDay(day, di, tourWindow, cityCenter);
        (day.stops || []).forEach((s, si) => {
            const tolte = frasiTolte.filter(f => f.place_id === s.place_id && f.campo === 'description');
            if (hasNonEmptyDescription(s) && tolte.length === 0) return;
            const iso = timed[di]?.stops?.[si]?.scheduledTime;
            items.push({
                key: `${di}:${si}`, place_id: s.place_id, nome: s.title, types: s.types,
                momento: s.momentLabel || null, arrivo: iso ? clockLabel(new Date(iso)) : null,
                tolte, exempt: [s.title, s.name].filter(Boolean),
                arrival: iso ? new Date(iso) : null, sun,
                fatti: facts.get(s.place_id)?.fatti || [],
                fattiSu: factsAbout(facts.get(s.place_id)),
                minuti: s.travelMinutesFromPrev,
                tramontoDavanti: iso && sun.sunset ? new Date(iso).getTime() <= sun.sunset.getTime() : undefined,
                motivo: luoghi.get(s.place_id)?.motivo || [],
                ...(locali.has(s.place_id) ? { locale: { ...locali.get(s.place_id), minuti: s.travelMinutesFromPrev } } : {}),
            });
        });
    });
    return items;
};

// ─── P3d-e — narratore ancorato ai fatti ────────────────────────────────────
//
// Dopo i filtri di voce e di luce, il controllo anti-invenzione: una frase
// della descrizione che nomina un oggetto concreto (CONCRETE_OBJECTS) assente
// dai fatti e dal nome si toglie, come le altre. La tappa va alla riscrittura
// (una volta); se la riscrittura non passa, la frase sicura del codice.

/** P3d-g — il titolo del luogo di cui parlano i fatti (Pincio per la Terrazza del Pincio). */
const factsAbout = (entry) => (entry?.fonti || []).find(f => f?.fonte === 'wikipedia' || f?.fonte === 'wikidata')?.titolo || null;

/** Il controllo anti-invenzione sulle descrizioni di un itinerario raccontato. */
const guardInventions = (days, facts, voce = {}) => {
    const frasiTolte = [];
    const out = (days || []).map(day => ({
        ...day,
        stops: (day.stops || []).map(s => {
            if (!s.description) return s;
            const r0 = filterInventedObjects(s.description, { fatti: facts.get(s.place_id)?.fatti || [], nomi: [s.title, s.name].filter(Boolean), fattiSu: factsAbout(facts.get(s.place_id)) });
            // P3d-i — poi la voce: motivo citato, elenco senza verbo, orario in coda.
            const rv = filterVoice(r0.text, voce);
            const r = { text: rv.text, removed: [...r0.removed, ...rv.removed] };
            for (const x of r.removed) {
                frasiTolte.push({ place_id: s.place_id, title: s.title, campo: 'description', frase: x.frase, regole: [x.regola], oggetti: x.oggetti, ...(x.tipoNome ? { tipoNome: x.tipoNome } : {}) });
            }
            return r.removed.length > 0 ? { ...s, description: r.text } : s;
        }),
    }));
    return { days: out, frasiTolte };
};

/**
 * Perche' il motore ha scelto questo locale per l'utente: solo criteri che il
 * codice ha davvero applicato (vincolo di dieta, budget, stile, DNA, ricerca).
 * Mai "e' vegetariano": "cercato con opzioni vegetariane".
 */
export const localeReasons = (c, { food = null, dnaWeights = {} } = {}) => {
    const motivo = [];
    if (!c) return motivo;
    const dieta = Array.isArray(c._dietaCercata) ? c._dietaCercata : [];
    if (dieta.length > 0) motivo.push(`cercato con il criterio "${dietCriteria(dieta).join(', ')}" (vincolo dell'utente)`);
    const pl = priceLevelOf(c);
    if (food?.budget && Number.isFinite(food.maxPriceLevel) && pl !== null && pl <= food.maxPriceLevel) {
        motivo.push(`dentro il budget ${food.budget} dell'utente`);
    }
    if (food?.stile && STILI[food.stile] && matchesStile(c, food.stile)) {
        motivo.push(`stile "${STILI[food.stile].label}", tra i gusti dell'utente`);
    }
    if (dnaShareOf(dnaWeights) > 0 && Object.keys(dnaWeights || {}).some(k => k !== '_share') && computeAffinityScore(c, dnaWeights) >= 0.5) {
        motivo.push('in linea con il profilo dell\'utente (DNA)');
    }
    if (c._ricercaCibo) motivo.push(`trovato con la ricerca "${c._ricercaCibo}"`);
    return motivo;
};

/**
 * P3d-g — perche' il motore ha scelto questo LUOGO per l'utente: la ricerca che
 * l'ha trovato, la richiesta, il tema del tour, il DNA. Solo criteri veri.
 */
// P3d-i — il SENSO del tema, non la sua etichetta: il modello lo traduce in un
// perche' ("per chi cerca il verde"), non lo cita ("scelto per il tour del verde").
const TEMA_LABEL = {
    insider: 'posti scelti per merito più che per fama', food: 'chi viaggia anche per mangiare',
    cultura: 'chi cerca arte e storia', romance: 'una giornata in due', nature: 'chi cerca il verde',
    storia: 'chi cerca la storia', arte: "chi cerca l'arte", natura: 'chi cerca la natura',
    relax: 'chi vuole rallentare', shopping: 'chi ama girare per negozi', nightlife: 'chi vive la sera',
};
export const placeReasons = (c, { intent = null, dnaWeights = {}, tema = null } = {}) => {
    const motivo = [];
    // Il motivo arriva come SENSO da tradurre: mai da citare (P3d-i).
    if (intent?.oggetto_umano) motivo.push(`l'utente vuole: ${intent.oggetto_umano}`);
    if (c?._ricerca) motivo.push(`risponde a: ${c._ricerca}`);
    const t = tema || c?._tema;
    if (t && TEMA_LABEL[t]) motivo.push(`pensato per ${TEMA_LABEL[t]}`);
    if (c && dnaShareOf(dnaWeights) > 0 && Object.keys(dnaWeights || {}).some(k => k !== '_share') && computeAffinityScore(c, dnaWeights) >= 0.5) {
        motivo.push('in linea con il profilo dell\'utente (DNA)');
    }
    return motivo;
};
const placeInfoFor = (stops, byIdCandidate, ctx) => {
    const out = new Map();
    for (const s of stops) {
        if (isLocaleStop(s)) continue;
        out.set(s.place_id, { motivo: placeReasons(byIdCandidate.get(s.place_id), ctx) });
    }
    return out;
};

/** I dati dei locali fra le tappe finali, per il narratore e la frase sicura. */
const localeInfoFor = (stops, byIdCandidate, ctx) => {
    const out = new Map();
    for (const s of stops) {
        if (!isLocaleStop(s)) continue;
        const c = byIdCandidate.get(s.place_id);
        out.set(s.place_id, { price_level: priceLevelOf(c || s), motivo: localeReasons(c, ctx) });
    }
    return out;
};

/**
 * Le fonti a schermo: solo sulle tappe raccontate con dei fatti (non sulla
 * frase sicura, che non ne usa).
 */
const withFonti = (stop, facts) => {
    const f = facts.get(stop.place_id);
    const usaFatti = f && f.fatti.length > 0 && f.fonti.length > 0 && !stop._fraseSicura && hasNonEmptyDescription(stop);
    return { ...stop, fonti: usaFatti ? f.fonti : null };
};

/**
 * Mai una descrizione vuota (P3d-e): la tappa senza descrizione — o con la
 * frase sicura di una lettura precedente, che porta l'orario di allora — riceve
 * la frase sicura costruita sugli orari di adesso. Gira in generazione e a ogni
 * lettura dalla cache, DOPO il controllo luce/ora.
 */
const applySafeDescriptions = (days, starts, tourWindow, cityCenter) => {
    const timed = refreshTourScheduledTimes(days, starts);
    let n = 0;
    const out = (days || []).map((day, di) => {
        const sun = sunForDay(day, di, tourWindow, cityCenter);
        return {
            ...day,
            stops: (day.stops || []).map((s, si) => {
                if (hasNonEmptyDescription(s) && !s._fraseSicura) return s;
                const iso = timed[di]?.stops?.[si]?.scheduledTime;
                const p = iso ? romeParts(new Date(iso)) : null;
                n += 1;
                return {
                    ...s,
                    description: safeDescription({
                        stop: s,
                        momento: s.moment || s.momentLabel || (p ? momentAtClock(p.h, p.mi).key : null),
                        orario: iso ? clockLabel(new Date(iso)) : null,
                        tramonto: clockLabel(sun.sunset),
                        locale: isLocaleStop(s),
                        priceLevel: Number.isFinite(s.priceLevel) ? s.priceLevel : null,
                        minutiDaPrima: s.travelMinutesFromPrev,
                    }),
                    _fraseSicura: true,
                    fonti: null,
                };
            }),
        };
    });
    return { days: out, frasiSicure: n };
};

// Il racconto sulle tappe, per place_id. Una tappa che il narratore non ha
// raccontato resta con nome e categoria e i campi di testo null: nessun testo
// inventato al suo posto.
const applyNarration = (days, { byId, meta }, city) => days.map((day, di) => {
    const m = meta[di] || {};
    return {
        ...day,
        title: cleanText(m.title) || day.title || `Giorno ${di + 1} a ${city}`,
        suggestedTransit: VALID_TRANSIT.has(m.suggestedTransit) ? m.suggestedTransit : (day.suggestedTransit || 'walking'),
        mapMood: VALID_MOODS.has(m.mapMood) ? m.mapMood : (day.mapMood || 'default'),
        stops: day.stops.map(s => {
            const n = byId.get(s.place_id) || {};
            const next = { ...s };
            for (const campo of NARRATION_TEXT_FIELDS) next[campo] = cleanText(n[campo]);
            return next;
        }),
    };
});

export const aiRecommendationService = {

    // Gate QUOTA-SERVER — SurpriseTour.jsx:158 chiama il preflight come metodo:
    // prima non c'era, la chiamata lanciava TypeError e il preflight non partiva mai.
    getDailyQuotaStatus,

    // ─── ITINERARY GENERATION ────────────────────────────────────────────────
    // DVAI-055 — cityCenter opzionale: { latitude, longitude, radiusKm?, isSmallTown? }.
    // Se passato, attiva il vincolo geografico A monte (regola 15 nel prompt) e A
    // valle (filtro Haversine PRE sortByProximity). Se null: retrocompat, no filtro.
    // DVAI-060 F2 — Google-first: se cityCenter presente, chiama discoverRealPOIs
    // per ottenere candidati reali. L'AI diventa selettore-narratore. Se meno di 3
    // candidati o cityCenter assente, fallback al vecchio flusso AI-first.
    async generateItinerary(city, prefs = {}, userPrompt = '', weather = {}, aiProfile = '', cityCenter = null, opts = {}) {
        // DVAI-055 — la cache key include cityCenter perché il filtro raggio cambia
        // il risultato salvato. Firmato con lat/lng arrotondati a 3 decimali (~110 m).
        const centerFingerprint = cityCenter && Number.isFinite(cityCenter.latitude)
            ? `${cityCenter.latitude.toFixed(3)},${cityCenter.longitude.toFixed(3)},r55f2`
            : 'noRadius';
        // G3 — la finestra temporale del tour, calcolata in codice da: frase
        // dell'utente, ora della richiesta, tipo di percorso, durata scelta.
        // `start` sostituisce `new Date()` come partenza del tour, sia per gli
        // orari delle tappe sia per la fascia del timeContext. Si calcola PRIMA
        // della cache: "domani" letto oggi e "domani" letto fra una settimana
        // sono due martedì diversi, anche se il cacheKey è lo stesso.
        // opts.pathType: 'custom' (Crea il tuo Percorso) legge il testo;
        // assente o 'quick' = da adesso, il comportamento di prima.
        const requestTime = new Date();
        const tourWindow = resolveTourWindow({
            text: userPrompt, requestTime, pathType: opts.pathType, duration: prefs?.duration,
        });
        // Gate NARRATORE-DOPO — il primo momento della finestra, letto dalla
        // tabella dei momenti (dayMoments.js). Serve al timeContext e alla
        // chiave di cache: una narrazione scritta per martedi' mattina non si
        // riusa mercoledi', ne' martedi' pomeriggio. Data e momento entrano
        // nella chiave; ritmo, gruppo e interessi ci sono gia' (insiderCacheKey).
        const firstMoment = (() => {
            const p = romeParts(tourWindow.start);
            return momentAtClock(p.h, p.mi);
        })();
        // P7b — dieta, budget e stile, con la gerarchia applicata: testo →
        // wizard (prefs.budget) → primo accesso (opts.onboardingPrefs).
        const food = resolveFoodPrefs({ userPrompt, wizardBudget: prefs?.budget, onboarding: opts.onboardingPrefs });
        const foodOn = hasFoodPrefs(food);
        const cacheKey = insiderCacheKey(city, prefs, userPrompt, aiProfile, opts.dnaWeights, food)
            + '_' + centerFingerprint + '_' + tourWindow.date + '_' + firstMoment.key;
        const windowFields = {
            startTimeAnchored: tourWindow.anchored,
            shiftedToNextDay: tourWindow.shiftedToNextDay,
            tourWindow,
        };

        const cached = loadInsiderFromCache(cacheKey);
        if (cached) {
            // G1.1 — un tour da cache non porta con sé l'orario calcolato alla
            // generazione: si ricalcola SEMPRE dalla finestra di CHI STA
            // LEGGENDO ora, sommando gli offset già salvati
            // (stayMinutes/travelMinutesFromPrev su ogni stop).
            // Gate NARRATORE-DOPO — e il controllo luce/ora rigira su quegli
            // orari: stessa data e stessa fascia, ma i minuti possono essere altri.
            const starts = dayStartsFor(cached.days, tourWindow);
            const { days: lit } = guardNarrationLight(cached.days, starts, tourWindow, cityCenter);
            // P3d-e — mai una descrizione vuota, e la frase sicura sugli orari di adesso.
            const { days } = applySafeDescriptions(lit, starts, tourWindow, cityCenter);
            return { ...cached, ...windowFields, days: refreshTourScheduledTimes(days, starts) };
        }

        // DVAI-050 — Cache MISS: quota giornaliera utente (10/day).
        // Gate QUOTA-SERVER — qui solo il preflight in lettura; il conteggio lo
        // fa openai-proxy sul biglietto. opts.skipUserQuota salta solo il preflight.
        if (!opts.skipUserQuota) {
            await assertQuotaAvailable();
        }
        const quotaTicket = newGenerationTicket('itinerary');

        const weatherIcon = weather?.condition === 'sunny' ? '☀️'
            : weather?.condition === 'rainy' ? '🌧️' : '⛅';

        // G3 — la fascia del timeContext si legge dalla PARTENZA del tour
        // (tourWindow.start, ora di Roma), non dall'ora della richiesta:
        // "domani" chiesto alle 20:57 è un tour del mattino, non della sera.
        // Gate NARRATORE-DOPO — la fascia viene dalla tabella dei momenti, non
        // da soglie orarie scritte qui (erano una seconda tabella, divergente:
        // 'sera' cominciava alle 18 qui e l'aperitivo alle 18 la' solo per caso).
        const timeContext = `${firstMoment.label} (${tableClock(firstMoment.start)}–${tableClock(firstMoment.end)}) — ${firstMoment.categories.join(', ')}`;

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
            const { candidates: rawCandidates, intent } = await fetchRealPOICandidates(city, cityCenter, prefs, userPrompt, quotaTicket, food);

            // Gate RAGGIO-CATEGORIA — la categoria richiesta, quando e' una delle
            // 7 filtrabili in modo stretto. undefined ⇒ nessun vincolo di
            // categoria (path B, "misto", trasversali, traduttore caduto):
            // comportamento bit-identico a prima di questo gate.
            const categoriaTarget = (isFreeTextIntent && intent)
                ? CATEGORIA_TO_TOUR_CATEGORY[String(intent.categoria || '').toLowerCase()]
                : undefined;

            // Gate TOUR-DISTANZA — il raggio PRIMA della chiamata AI.
            //
            // Sonda 15/08 su dati reali: a Ippocampo la query NATURA restituisce
            // 6 candidati tutti di LIVELLO 1 (scaleLevel 1, non 3) a 48-225 km
            // dal centro. `radius` in Places Text Search è un bias, non un
            // vincolo: Google risponde fuori raggio quando dentro non trova.
            //
            // Il filtro a :1186 li intercetta comunque — ma gira su `canonized`,
            // cioè DOPO che il selettore AI è stato chiamato e pagato con fino a
            // 20 candidati serializzati nel prompt. Qui si scartano prima: stesso
            // esito per l'utente, una chiamata OpenAI in meno.
            //
            // requireCenter:true — senza centro non si giudica la distanza, e un
            // filtro di sicurezza che si spegne da solo non è un filtro.
            //
            // countForWiden — Gate RAGGIO-CATEGORIA: la decisione di allargare il
            // raggio conta solo i candidati IN CATEGORIA. Dieci ristoranti a 2 km
            // non sono una risposta a "le spiagge piu' belle", e finche' erano
            // contati come tali il widen non scattava mai.
            let candidates = applyRadiusFilter(rawCandidates, cityCenter, city, {
                requireCenter: true,
                countForWiden: categoriaTarget
                    ? (c) => candidateMatchesIntentCategoria(c, intent.categoria)
                    : undefined,
            });
            if (candidates.length < rawCandidates.length) {
                const scartati = rawCandidates
                    .filter(c => !candidates.includes(c))
                    .map(c => {
                        const lat = c.latitude ?? c.lat;
                        const lng = c.longitude ?? c.lng;
                        const d = (cityCenter && Number.isFinite(cityCenter.latitude) && Number.isFinite(lat) && Number.isFinite(lng))
                            ? `${haversineKm(cityCenter.latitude, cityCenter.longitude, lat, lng).toFixed(1)} km`
                            : 'distanza n/d';
                        return `${c.name || c.title || '?'} (${d})`;
                    });
                console.warn(`[Gate TOUR-DISTANZA] ${city}: ${rawCandidates.length - candidates.length}/${rawCandidates.length} candidati scartati PRIMA della chiamata AI — [${scartati.join(' | ')}]`);
            }

            // Gate RAGGIO-CATEGORIA — guard-rail deterministico: un candidato fuori
            // categoria non arriva MAI al selettore. Prima (countForWiden sopra) il
            // widen non veniva sprecato su candidati che comunque sarebbero stati
            // scartati qui; ora la garanzia e' nel codice, non nell'istruzione del
            // prompt (che resta, piu' sotto, come rinforzo — ma non e' piu' l'unica
            // barriera). Se il pool in-categoria e' vuoto anche dopo il widen,
            // candidates diventa [] e il ramo `else` esistente sotto (Path A →
            // no-results) se ne occupa, senza duplicare quella logica qui.
            if (categoriaTarget) {
                const beforeCategoria = candidates.length;
                candidates = candidates.filter(c => candidateMatchesIntentCategoria(c, intent.categoria));
                if (candidates.length < beforeCategoria) {
                    console.warn(`[Gate RAGGIO-CATEGORIA] ${city}: ${beforeCategoria - candidates.length}/${beforeCategoria} candidati scartati per categoria≠"${intent.categoria}" prima del selettore`);
                }
            }

            // ─── Gate MERITO — soglia + punteggio, QUI, al posto del taglio ──
            //
            // Fino al 24/09 questo punto ordinava per qualityScore (il taglio
            // a 20 era gia' stato spostato qui il 13/09, dopo raggio e
            // categoria — vedi git blame per quella storia). qualityScore =
            // rating * ln(1+reviews) e' dominato dal volume di recensioni: un
            // posto con 5.000 recensioni batteva sempre uno con 180, anche a
            // parita' o vantaggio di voto. Le recensioni pesavano come merito.
            //
            // Ora: le recensioni sono un FILTRO di qualita' (soglia minima
            // rating+recensioni, piu' bassa fuori dalle TOP_30_CITIES), non
            // piu' un merito. Sopra soglia, l'ordine viene da un punteggio
            // 0.45 affinita' DNA + 0.35 unicita' + 0.20 voto (mai il numero di
            // recensioni). Il tetto icone (al massimo 1 candidato "molto
            // recensito" nel pool) e' applicato QUI, prima che qualunque
            // scelta a valle veda i candidati: nessuna tappa fuori dal pool
            // puo' entrare nel tour, quindi il pool stesso e' la garanzia.
            //
            // dnaWeights arriva da opts (vedi generateItinerary): {} per un
            // utente sotto soglia di interazioni e senza seme onboarding —
            // l'affinita' si azzera da sola (regola UTENTE NUOVO), unicita' e
            // voto restano attivi comunque.
            // P7b — i VINCOLI, in codice, prima di Gate MERITO: budget (fuori i
            // price_level sopra il tetto) e dieta (un posto dove mangiare resta
            // solo se trovato da una ricerca col criterio).
            if (foodOn) {
                const fc = applyFoodConstraints(candidates, food, isMealPlace);
                candidates = fc.candidates;
                if (fc.tolti.length > 0) {
                    console.warn(`[P7b VINCOLI] ${city}: ${fc.tolti.length} candidati tolti — ${fc.tolti.map(x => `${x.name} (${x.motivo})`).join(' | ')}`);
                }
            }
            const beforeMerito = candidates.length;
            // P7a — i candidati PRIMA di Gate MERITO: e' su questi che si misura
            // l'ovvieta' (quante tappe stanno nel loro 10% piu' recensito).
            const candidatiGenerazione = candidates;
            // Gate NARRATORE-DOPO — 20 candidati per giorno: con "2-3 Giorni"
            // un pool da 20 finiva i ristoranti prima del pranzo del giorno 3.
            const nDays = Math.max(1, tourWindow.windows.length);
            // P7b — lo stile a tavola e' una spinta (bonus), non un filtro.
            const foodBonus = foodOn ? (c) => foodPrefBonus(c, food, isMealPlace) : null;
            candidates = selectScoredCandidatePool(candidates, { city, dnaWeights: opts.dnaWeights || {}, limit: 20 * nDays, bonus: foodBonus });
            if (beforeMerito > 0) {
                console.info(
                    `[Gate MERITO] ${city}: ${beforeMerito} candidati -> ${candidates.length} ammessi ` +
                    `(soglia qualita' + punteggio affinita'/unicita'/voto, tetto 1 icona, limite ${20 * nDays})`
                );
            }

            // ─── P3 — lo scheletro della giornata guida la scelta ──────────
            //
            // Lo scheletro (P2) dice per ogni momento orario, categorie e numero
            // di tappe. I candidati gia' trovati si dividono fra i momenti per
            // categoria; solo un momento rimasto vuoto fa una ricerca mirata
            // (al massimo 2 per generazione: oggi + 2 chiamate Places).
            //
            // Testo: come la finestra (G3), nel Percorso Veloce il testo lo
            // scrive il wizard ("Escludi: musei…") e non si legge — conterebbe
            // "musei" come richiesta. Categoria: quando il codice ha gia'
            // ristretto il pool a una categoria (Gate RAGGIO-CATEGORIA), quella
            // e' la richiesta esplicita e vale per tutti i momenti.
            const skeleton = buildDaySkeleton({
                window: tourWindow,
                pace: prefs?.pace,
                interests: extractInterestTokens(prefs),
                group: prefs?.group,
                text: opts.pathType === 'custom' ? userPrompt : '',
                category: categoriaTarget ? (TOUR_CATEGORY_TO_SKELETON[categoriaTarget] || categoriaTarget) : null,
            });
            const moments = candidates.length >= 1 ? flattenSkeleton(skeleton) : [];
            let anyCategory = !!categoriaTarget;
            let buckets = moments.length > 0 ? bucketCandidates(moments, candidates, { anyCategory }) : null;
            // Percorso A: se NESSUN luogo trovato per la frase sta in NESSUN
            // momento, la frase chiede qualcosa che la tabella dei momenti non
            // nomina (terme, spa…). E' una richiesta esplicita: vale per tutti
            // i momenti, come una categoria nominata, e gli orari restano.
            // Cercare altro (musei, trattorie) tradirebbe la richiesta.
            if (buckets && isFreeTextIntent && !anyCategory && [...buckets.values()].every(b => b.length === 0)) {
                console.info(`[P3 SCHELETRO] ${city}: nessun candidato sta in un momento → la richiesta vale per tutti i momenti`);
                anyCategory = true;
                buckets = bucketCandidates(moments, candidates, { anyCategory });
            }
            // Gate NARRATORE-DOPO — si cerca per i momenti che il pool non riesce
            // a riempire, non solo per quelli vuoti (vedi shortMomentThemes).
            // C1 — le famiglie che la categoria o il testo chiedono: per quelle
            // la regola "una per famiglia al giorno" si spegne. Lo stesso
            // testo e la stessa categoria dello scheletro.
            const familiesAsked = requestedFamilies({
                category: skeleton.explicitCategory,
                text: opts.pathType === 'custom' ? userPrompt : '',
            });
            const extraThemes = buckets ? shortMomentThemes(moments, buckets, candidates, undefined, { requestedFamilies: familiesAsked }) : [];
            // P3e — con la categoria che vale per tutti i momenti, un
            // ristorante trovato fuori da quella categoria serve SOLO a pranzo
            // e cena: mai al mattino di un tour Rioni Storici. Vale per ogni
            // ricerca mirata, prima e dopo la scelta (C1b).
            let mealOnlyIds = null;
            const addMealOnly = (found) => (anyCategory
                ? new Set([...(mealOnlyIds || []), ...found
                    .filter(c => isMealPlace(c) && !(categoriaTarget && candidateMatchesIntentCategoria(c, intent.categoria)))
                    .map(c => c.place_id || c.googlePlaceId)])
                : null);
            if (extraThemes.length > 0) {
                const foodAnchor = extraThemes.includes('food')
                    ? mealSearchAnchor(moments, buckets, candidates, { requestedFamilies: familiesAsked })
                    : null;
                if (foodAnchor) console.info(`[C1 COMPOSIZIONE] ${city}: ricerca dei pasti da "${foodAnchor.name}", non dal centro`);
                const extra = await searchMomentCandidates({
                    city, cityCenter, themes: extraThemes, known: candidates, perTheme: 5 * nDays,
                    dnaWeights: opts.dnaWeights || {},
                    categoria: categoriaTarget ? intent.categoria : null,
                    foodPrefs: foodOn ? food : null,
                    foodAnchor,
                });
                candidates = [...candidates, ...extra];
                mealOnlyIds = addMealOnly(extra);
                buckets = bucketCandidates(moments, candidates, { anyCategory, mealOnlyIds });
            }
            if (moments.length > 0) {
                console.info(
                    `[P3 SCHELETRO] ${city}: ${moments.length} momenti — ` +
                    moments.map(m => `${m.id}×${m.stops}(${(buckets.get(m.id) || []).length} cand.)`).join(', ') +
                    (extraThemes.length ? ` | ricerche mirate: ${extraThemes.join(', ')}` : ' | nessuna ricerca mirata')
                );
            }
            // Al selettore vanno solo i candidati di almeno un momento.
            const selectorCandidates = buckets
                ? [...new Map([...buckets.values()].flat().map(c => [c.place_id || c.googlePlaceId, c])).values()]
                : candidates;

            // Gate I — soglia minima 1 candidato (era 3). Un posto vero è meglio
            // di zero. Un tour di 1 tappa con Villa Bellini > messaggio bugiardo
            // "A Catania non troviamo parchi" (Catania ha Villa Bellini).
            if (selectorCandidates.length >= 1) {
                const selectorPrompt = buildSelectorSystemPrompt({
                    city, timeContext,
                    prefs, aiProfile, cityCenter, candidates: selectorCandidates, userPrompt,
                    intent, // Gate B — clausole dure (categoria/escludi/tempo/note) nel prompt
                    moments: moments.length > 0 ? moments : null,
                    buckets,
                    foodPrefs: foodOn ? food : null,
                });
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 35_000);
                try {
                    // Gate NARRATORE-DOPO — 2ª chiamata: il selettore restituisce
                    // SOLO place_id (e momento). Pochi token: niente testi.
                    const data = await callOpenAIProxy({
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: selectorPrompt },
                            { role: 'user', content: `Scegli le tappe, ${selectorCandidates.length} luoghi disponibili. Solo place_id${moments.length > 0 ? ' e moment' : ''}, dalla lista.` },
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.7,
                        max_tokens: 1000,
                    }, controller.signal, quotaTicket);
                    clearTimeout(timeoutId);

                    const raw = data.choices?.[0]?.message?.content;
                    if (!raw) throw new Error('Empty AI response (F2)');
                    const parsed = JSON.parse(raw);
                    // Formato: { stops: [...] }. Accettato anche { days: [{ stops }] }:
                    // un modello che raggruppa per giorno non perde la scelta.
                    // Di ogni tappa si tengono SOLO place_id e momento: un testo
                    // scritto dal selettore non entra mai nel tour.
                    const rawStops = Array.isArray(parsed?.stops)
                        ? parsed.stops
                        : (Array.isArray(parsed?.days) ? parsed.days : (Array.isArray(parsed) ? parsed : []))
                            .flatMap(d => (Array.isArray(d?.stops) ? d.stops : []));
                    const aiStops = rawStops
                        .filter(st => st && typeof st.place_id === 'string')
                        .map(st => ({ place_id: st.place_id, ...(typeof st.moment === 'string' ? { moment: st.moment } : {}) }));
                    if (aiStops.length === 0) throw new Error('AI returned no stops (F2)');

                    const baseMeta = (di) => ({
                        day: di + 1,
                        title: `Giorno ${di + 1} a ${city}`,
                        weather: { condition: weather?.condition || 'Soleggiato', temperature: weather?.temperature ?? 22, icon: weatherIcon },
                        suggestedTransit: 'walking',
                        mapMood: 'default',
                    });

                    // P3 — con lo scheletro il codice controlla la risposta e la
                    // ripara (momento sbagliato, numero sbagliato, luogo
                    // inventato), poi mette gli orari dentro ogni momento.
                    let momentReport = null;
                    const finalDays = moments.length > 0
                        ? await (async () => {
                            // C1b — un momento senza niente entro il tetto dalla
                            // tappa prima (o senza una famiglia nuova vicina):
                            // prima del ripiego, una ricerca Google
                            // mirata DA quella tappa (bias 1.5 km, tema del
                            // momento, stessi vincoli di dieta e budget), poi si
                            // ripara di nuovo con gli stessi place_id del modello.
                            // Tetto unico con le ricerche di prima della scelta:
                            // MAX_EXTRA_SEARCHES per generazione, solo se servono.
                            const searchedIds = new Set();
                            const searchedMoments = new Set();
                            const ricercheDopo = [];
                            let budget = Math.max(0, MAX_EXTRA_SEARCHES - extraThemes.length);
                            const repair = () => repairMomentSelection({
                                moments, buckets, aiStops, pool: candidates, dnaWeights: opts.dnaWeights || {},
                                requestedFamilies: familiesAsked, searchedIds, searchedMoments,
                            });
                            let repaired = repair();
                            while (budget > 0) {
                                // Prima i momenti lontani, poi quelli costretti a
                                // ripetere una famiglia: anche li' manca un posto
                                // adatto vicino.
                                const target = [...repaired.report.lontani, ...repaired.report.ripetuti]
                                    .find(x => x.da && !searchedMoments.has(x.momento));
                                if (!target) break;
                                const m = moments.find(x => x.id === target.momento);
                                const theme = momentTheme(m);
                                searchedMoments.add(target.momento);
                                if (!theme) continue;
                                budget -= 1;
                                const found = await searchMomentCandidates({
                                    city, cityCenter, themes: [theme], known: candidates, perTheme: 5,
                                    dnaWeights: opts.dnaWeights || {},
                                    categoria: categoriaTarget ? intent.categoria : null,
                                    foodPrefs: foodOn ? food : null,
                                    anchor: target.da,
                                });
                                ricercheDopo.push({ momento: target.momento, tema: theme, da: target.da.name, trovati: found.length });
                                console.info(`[C1b RICERCA MIRATA] ${city}: ${target.momento} da "${target.da.name}" (${theme}) → ${found.length} candidati`);
                                if (found.length > 0) {
                                    for (const c of found) searchedIds.add(c.place_id || c.googlePlaceId);
                                    candidates = [...candidates, ...found];
                                    mealOnlyIds = addMealOnly(found);
                                    buckets = bucketCandidates(moments, candidates, { anyCategory, mealOnlyIds });
                                }
                                repaired = repair();
                            }
                            const { plan, report } = repaired;
                            const sched = scheduleMomentPlan(plan, tourWindow.windows.map(w => w.start));
                            momentReport = { ...report, tolte: sched.tolte, ricercheMirate: extraThemes, ricercheDopo };
                            logMomentReport(city, momentReport);
                            return sched.days.map((dayStops, di) => {
                                const canon = canonicalizeStopsFromCandidates(
                                    dayStops.map(s => ({ place_id: s.candidate.place_id || s.candidate.googlePlaceId })),
                                    candidates,
                                    { guard: false },
                                ).map((stop, i) => ({
                                    ...stop,
                                    moment: dayStops[i].moment.key,
                                    momentLabel: dayStops[i].moment.label,
                                    waitMinutesBefore: dayStops[i].waitMinutesBefore,
                                    ...(dayStops[i].source === 'riparata' ? { repaired: true } : {}),
                                    // C1 — tracciato interno, mai a schermo: chi
                                    // l'ha scelta (modello / riparazione / ripiego).
                                    _tracciato: dayStops[i].trace,
                                }));
                                // windowIndex: il giorno resta legato alla SUA
                                // finestra anche se un giorno prima viene tolto.
                                // I minuti del tracciato sono quelli del giro
                                // finale (una tappa tolta dagli orari li cambia).
                                const timed = computeStopTimings(canon).stops.map(st => (st._tracciato
                                    ? { ...st, _tracciato: { ...st._tracciato, minuti: st.travelMinutesFromPrev ?? null } } : st));
                                return { ...baseMeta(di), windowIndex: di, stops: timed };
                            }).filter(d => d.stops.length > 0);
                        })()
                        : (() => {
                            // Canonicizza: title/lat/lng/rating/googlePhoto dai candidati.
                            // Scarta stop con place_id non appartenente ai candidati (AI-halluc).
                            const canonized = canonicalizeStopsFromCandidates(aiStops, candidates, { guard: false });
                            // Applica il filtro raggio come safety (DVAI-055-b).
                            const withinRadius = applyRadiusFilter(canonized, cityCenter, city);
                            // Ordina per prossimità, poi la varietà (Gate MERITO);
                            // DIFF 1a: le stime SUBITO dopo il sort/varietà, mai prima.
                            const ordered = computeStopTimings(enforceCategoryVariety(sortByProximity(withinRadius))).stops;
                            return [{ ...baseMeta(0), windowIndex: 0, stops: ordered }].filter(d => d.stops.length > 0);
                        })();

                    // Gate I — soglia minima 1 tappa (era 3). Un posto vero è
                    // meglio di zero. Se 1 tappa, il flag _singleStop segnala
                    // alla UI di mostrare un banner onesto ("un solo posto").
                    if (finalDays.length > 0 && finalDays[0].stops.length >= 1) {
                        // ─── Gate NARRATORE-DOPO — 3ª chiamata: il racconto ─────
                        // Le tappe sono finali: riparate, ordinate, con orario.
                        // Il narratore le racconta; il codice toglie le frasi di
                        // luce/ora incoerenti con l'arrivo. Una tappa non
                        // raccontata resta, senza testo, e il report lo dice.
                        const starts = dayStartsFor(finalDays, tourWindow);
                        // P3d-e — i fatti aperti delle tappe FINALI (mai dei
                        // candidati), con il tetto di 4 secondi, e i dati dei
                        // locali (fascia di prezzo, motivo della scelta).
                        const byIdCand = new Map(candidates.map(c => [c.place_id || c.googlePlaceId, c]));
                        const finalStops = finalDays.flatMap(d => d.stops);
                        const locali = localeInfoFor(finalStops, byIdCand, { food: foodOn ? food : null, dnaWeights: opts.dnaWeights || {} });
                        const luoghi = placeInfoFor(finalStops, byIdCand, { intent, dnaWeights: opts.dnaWeights || {} });
                        const daysForNarration = finalDays.map(d => ({
                            ...d,
                            stops: d.stops.map(st => (locali.has(st.place_id) ? { ...st, priceLevel: locali.get(st.place_id).price_level } : st)),
                        }));
                        const factsRes = await fetchFactsForStops(finalStops.map(st => ({
                            place_id: st.place_id, name: st.title, lat: Number(st.latitude), lng: Number(st.longitude), types: st.types,
                        })), { city });
                        const facts = factsRes.byId;
                        const narration = await narrateFinalDays({
                            city, days: daysForNarration, starts, tourWindow, cityCenter,
                            weather, prefs, aiProfile, userPrompt, quotaTicket, facts, locali, luoghi,
                        });
                        const guardedLight = guardNarrationLight(
                            applyNarration(daysForNarration, narration, city), starts, tourWindow, cityCenter,
                        );
                        // P3d-e — il controllo anti-invenzione, dopo voce e luce.
                        const voce = { richiesta: userPrompt, oggetto: intent?.oggetto_umano || '' };
                        const invented = guardInventions(guardedLight.days, facts, voce);
                        const guarded = { days: invented.days, frasiTolte: [...guardedLight.frasiTolte, ...invented.frasiTolte] };
                        const { frasiTolte } = guarded;
                        // P3d-c — le descrizioni svuotate o accorciate dai filtri si
                        // riscrivono UNA volta, nello stesso biglietto. Con il
                        // narratore caduto no: niente da riscrivere, e niente secondo giro.
                        let riscrittura = null;
                        let narratedDays = guarded.days;
                        if (!narration.error) {
                            const items = itineraryRewriteItems(narratedDays, frasiTolte, starts, tourWindow, cityCenter, facts, locali, luoghi);
                            if (items.length > 0) {
                                const rw = await rewriteDescriptions({ city, items, quotaTicket, voce });
                                riscrittura = rw.report;
                                narratedDays = narratedDays.map((day, di) => ({
                                    ...day,
                                    stops: day.stops.map((st, si) => (rw.byKey.has(`${di}:${si}`)
                                        ? { ...st, description: rw.byKey.get(`${di}:${si}`) } : st)),
                                }));
                            }
                        }
                        // P3d-e — le tappe ancora senza descrizione (narratore caduto,
                        // riscrittura che non passa) ricevono la frase sicura del
                        // codice; le altre, se raccontate con dei fatti, le fonti.
                        const nonRaccontate = narratedDays.flatMap(d => d.stops)
                            .filter(st => !hasNonEmptyDescription(st)).map(st => ({ place_id: st.place_id, title: st.title }));
                        const safe = applySafeDescriptions(narratedDays, starts, tourWindow, cityCenter);
                        narratedDays = safe.days.map(d => ({ ...d, stops: d.stops.map(st => withFonti(st, facts)) }));
                        const allStops = narratedDays.flatMap(d => d.stops);
                        const narrationReport = {
                            raccontate: allStops.filter(st => hasNonEmptyDescription(st) && !st._fraseSicura).length,
                            nonRaccontate,
                            frasiSicure: allStops.filter(st => st._fraseSicura).map(st => ({ place_id: st.place_id, title: st.title, description: st.description })),
                            frasiTolte,
                            errore: narration.error,
                            riscrittura,
                            fatti: {
                                ...factsRes.report,
                                perTappa: allStops.map(st => ({ place_id: st.place_id, title: st.title, fatti: facts.get(st.place_id)?.fatti || [] })),
                            },
                        };
                        logNarratorViolations(allStops, 'narratore');
                        for (const f of frasiTolte) {
                            console.warn(`[Gate NARRATORE-DOPO] ${city}: tolta frase (${[...f.regole, ...(f.parole || [])].join(',')}) da ${f.campo} di "${f.title}" @${f.arrivo} — "${f.frase}"`);
                        }
                        if (narrationReport.nonRaccontate.length > 0) {
                            console.warn(`[Gate NARRATORE-DOPO] ${city}: ${narrationReport.nonRaccontate.length}/${allStops.length} tappe senza racconto — [${narrationReport.nonRaccontate.map(x => x.title).join(' | ')}]`);
                        }
                        const singleStop = narratedDays[0].stops.length === 1;
                        const ovvieta = obviousnessReport(allStops, candidatiGenerazione);
                        const famosita = famositaReport(allStops, city, candidatiGenerazione);
                        console.info(`[P7a2 famosita'] ${city}: mediana ${famosita.mediana ?? '-'} recensioni, ${famosita.sopraSoglia}/${famosita.tappe} tappe sopra ${famosita.soglia}`);
                        console.info(`[P7a ovvieta'] ${city}: ${ovvieta.nelTop10}/${ovvieta.tappe} tappe nel 10% piu' recensito (${ovvieta.candidati} candidati, soglia ${ovvieta.sogliaRecensioni ?? '-'} recensioni)`);
                        // P7b — le tappe pasto e il criterio usato; la riga onesta
                        // a schermo solo se un pasto servito e' stato davvero
                        // cercato col criterio.
                        const byIdCibo = new Map(candidates.map(c => [c.place_id || c.googlePlaceId, c]));
                        const tappePasto = allStops.filter(isMealPlace).map(st => {
                            const c = byIdCibo.get(st.place_id) || {};
                            return {
                                title: st.title,
                                cucina: cuisineOf(c),
                                price_level: priceLevelOf(c),
                                criterio: Array.isArray(c._dietaCercata) && c._dietaCercata.length ? dietCriteria(c._dietaCercata).join(', ') : null,
                                ricerca: c._ricercaCibo || null,
                            };
                        });
                        const dietNote = food.dieta.length > 0 && tappePasto.some(x => x.criterio) ? dietNoteLine(food.dieta) : null;
                        const vincoliCibo = { ...food, tappePasto, dietNote };
                        if (foodOn) console.info(`[P7b VINCOLI] ${city}: dieta=${food.dieta.join('+') || '-'} (${food.dietaFonte || '-'}), budget=${food.budget || '-'} (${food.budgetFonte || '-'}), stile=${food.stile || '-'} | pasti: ${tappePasto.map(x => `${x.title} [pl=${x.price_level ?? '?'}, ${x.criterio || 'senza criterio'}]`).join(' | ') || 'nessuno'}`);
                        if (dietNote) for (const d of narratedDays) d.dietNote = dietNote;
                        const result = {
                            days: narratedDays, _source: 'google-first', _singleStop: singleStop,
                            ...(foodOn ? { _vincoliCibo: vincoliCibo } : {}),
                            ...(momentReport ? { _momentReport: momentReport } : {}),
                            _narrationReport: narrationReport,
                            _ovvieta: ovvieta,
                            _famosita: famosita,
                        };
                        // Un narratore caduto non si mette in cache: la prossima
                        // richiesta deve poter avere il suo racconto.
                        if (!narration.error) saveInsiderToCache(cacheKey, result);
                        return { ...result, ...windowFields, days: refreshTourScheduledTimes(result.days, starts) };
                    }
                    // Gate B/I — Path A: 0 tappe canoniche → errore onesto (no fallback).
                    if (isFreeTextIntent) {
                        console.warn(`[Gate B] path A "${city}" — 0 tappe canoniche → errore onesto (no fallback AI-first)`);
                        return {
                            days: [{ stops: [] }],
                            _source: 'no-results',
                            _query: intent?.queries || [],
                            _categoria: intent?.categoria || 'sconosciuta',
                            _oggetto_umano: intent?.oggetto_umano || 'quello che hai chiesto',
                        };
                    }
                    console.warn(`[Gate SOLO-GOOGLE] path B: Google-first ha prodotto 0 tappe canoniche per "${city}" → risultato vuoto`);
                } catch (err) {
                    clearTimeout(timeoutId);
                    if (mustReachUi(err)) throw err;
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
                    // Gate INTERESSI-VERI — Google HA risposto: un selettore caduto non
                    // e' "non trovo luoghi verificati". Errore vero → la UI mostra il
                    // suo messaggio di errore, non quello dei zero risultati.
                    console.warn(`[Gate SOLO-GOOGLE] path B: selettore fallito (${err.name === 'AbortError' ? 'timeout' : err.message}) → errore`);
                    throw err;
                }
            } else {
                // Gate B/I — Path A: 0 candidati Places → errore onesto (no fallback).
                // Scatta per candidates === 0, oppure (P3) quando nessun
                // momento dello scheletro ha un candidato valido: nessun
                // luogo inventato, il risultato e' vuoto e onesto.
                if (isFreeTextIntent) {
                    console.info(`[Gate B] path A "${city}" — 0 candidati Places → errore onesto (no fallback AI-first)`);
                    return {
                        days: [{ stops: [] }],
                        _source: 'no-results',
                        _query: intent?.queries || [],
                        _categoria: intent?.categoria || 'sconosciuta',
                        _oggetto_umano: intent?.oggetto_umano || 'quello che hai chiesto',
                    };
                }
                // Gate SOLO-GOOGLE — Path B: 0 candidati → risultato vuoto, come
                // il Percorso A. Prima cadeva sul motore AI-first (rimosso).
            }
        } catch (err) {
            if (mustReachUi(err)) throw err;
            // Gate INTERESSI-VERI — la ricerca su Google non si e' potuta fare
            // (rete, HTTP, eccezione): ne' "non trovo" ne' "non troviamo X".
            // Vale per i due percorsi; il Percorso B porta anche `_pathB`.
            if (err?.code === 'PLACES_SEARCH_FAILED') {
                console.warn(`[Gate INTERESSI-VERI] ${isFreeTextIntent ? 'path A' : 'path B'} "${city}": ricerca fallita (${err.message}) → search-error`);
                return {
                    days: [{ stops: [] }],
                    _source: 'search-error',
                    ...(isFreeTextIntent ? {} : { _pathB: true }),
                };
            }
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
            // Gate INTERESSI-VERI — Percorso B: un errore che non e' di ricerca
            // (selettore, bug) non diventa "non trovo": si rilancia.
            console.warn(`[Gate SOLO-GOOGLE] path B: errore ("${err.message}") → rilancio`);
            throw err;
        }
        // ─── FINE RAMO GOOGLE-FIRST ─────────────────────────────────────────
        //
        // Gate SOLO-GOOGLE (27/09) — qui sotto c'era il vecchio motore AI-first:
        // ~200 righe che chiedevano al modello di INVENTARE i luoghi (nome +
        // coordinate) e tenevano solo quelli che `verifyPOIWithPlaces` ritrovava
        // su Google. Era l'ultimo ramo in cui il modello PRODUCEVA luoghi invece
        // di scegliere fra luoghi veri, e serviva solo al Percorso B (prefs senza
        // frase: AiItinerary abilita "Genera" anche con i soli interessi,
        // AiItinerary.jsx:451). Il Percorso A era gia' bloccato dalla safety belt.
        //
        // Ora il Percorso B si comporta come il Percorso A: se Google non ha
        // candidati validi il risultato e' VUOTO e la UI lo dice. Nessun percorso
        // dell'app fa piu' generare luoghi al modello.
        if (isFreeTextIntent) {
            console.error('[Gate SOLO-GOOGLE] SAFETY BELT: path A arrivato in fondo senza un ramo di uscita a monte. Blocco.');
            return {
                days: [{ stops: [] }],
                _source: 'no-results-safety',
                _query: [],
                _categoria: 'sconosciuta',
                _oggetto_umano: 'quello che hai chiesto',
            };
        }
        // Percorso B — `_pathB` distingue il messaggio in UI: qui non esistono ne'
        // una frase dell'utente ne' un `oggetto_umano` dal traduttore d'intento,
        // quindi il testo del Percorso A ("non troviamo <oggetto>", "cambia
        // richiesta") non si applica.
        console.info(`[Gate SOLO-GOOGLE] path B "${city}" — 0 tappe da Google, nessun luogo generato dal modello`);
        return {
            days: [{ stops: [] }],
            _source: 'no-results',
            _pathB: true,
            _query: [],
            _categoria: 'sconosciuta',
        };
    },

    // ─── Gate N.2 — System precompute deterministico ──────────────────────────
    //
    // Riscritto rispetto a Blocco 2.1 Fase 2: ZERO generateItinerary, ZERO LLM.
    // Il tour è costruito ESATTAMENTE dai chosenPois della notifica.
    // La coerenza notifica↔tour è STRUTTURALE (non verificata a posteriori):
    // se la notifica dice "Bar X e Piazza Y", il tour porta A quei due, non
    // a un tour rigenerato al volo sulla stessa città.
    //
    // Pipeline:
    //  1. Cap syswarm 6/day (ora budget Places details, non OpenAI)
    //  2. Per ogni chosenPoi: place/details → arricchisce con foto, indirizzo,
    //     opening_hours (Basic Data, gratis su Places legacy)
    //  3. Ordina con sortByProximity (nearest-neighbor greedy da tourShape)
    //  4. Costruisce tourData.days[0].stops = i chosenPois arricchiti
    //  5. description = '' (Blocco 2.7 farà il narratore fatti-non-poesia)
    //
    // ─── Gate II (16/07) — Call unificata per N tour Home in una call ────────
    //
    // Prima: DashboardUser lanciava Promise.all([buildSmartExperiencesAsync,
    // generateItinerary(insider)]). buildSmartExperiencesAsync NON passava
    // dal narratore → 4 tour tematici con description vuota → fallback
    // "Luogo di interesse a X" → isMockTour scattava su tour reali.
    //
    // Ora: 1 sola call. themedCandidates raggruppa i POI per tema
    // ({insider: [...], food: [...], cultura: [...], romance: [...],
    // nature: [...]}). L'AI produce fino a N tour, uno per tema, con
    // description+insiderTip+bestTime+transition per OGNI tappa.
    //
    // Costo: 1 call OpenAI gpt-4o-mini (invariato vs oggi). Output 2-3x
    // piu' grande (5 tour × 4 tappe × 4 campi ~= 4000 max_tokens) ma
    // trascurabile su gpt-4o-mini pricing.
    //
    // Regole applicate post-processing:
    //  - Ogni stop DEVE avere description non vuota (II.2). Se AI non ha
    //    narrato, lo stop viene scartato.
    //  - Ogni tour DEVE avere >=1 stop dopo il filtro description. Se 0,
    //    il tour viene scartato (regola locked: meno tour e' meglio di
    //    tour vuoti).
    //  - Dedup cross-tour su place_id (primo tour che lo usa lo tiene).
    //
    // Cache: come generateItinerary insider, ma key include fingerprint
    // del pool (place_id set) — cache invalidata automaticamente quando
    // i pool cambiano (es. deploy nuovo → Places dedup diverso).
    //
    // TODO Blocco 2 (U.2): cache condivisa server-side Supabase su
    // (city, place_ids sorted hash), pattern Gate DD ma su OpenAI narratore.
    // Rende la call gratis dalla seconda persona sulla stessa citta' per 24h.
    //
    // @param {object} params
    // @param {string} params.city
    // @param {object} params.cityCenter { latitude, longitude, radiusKm?, isSmallTown? }
    // @param {object} params.themedCandidates { [themeType]: POI[] }
    // @param {object} params.prefs { duration, group, pace }
    // @param {string} params.aiProfile — profilo utente per personalizzare voce
    // @param {object} params.weather { condition, temperature }
    // @param {object} params.opts { skipUserQuota? }
    // @returns {Promise<{ tours: Array, _source: string }>}
    async generateHomeTours({ city, cityCenter, themedCandidates, prefs = {}, aiProfile = '', weather = {}, opts = {} } = {}) {
        // Gate PER TE — distanza e doppioni si decidono QUI, prima del prompt
        // (prepareHomePools). Un pool rimasto vuoto non entra nel prompt.
        // P7a2 — i pool dei temi si ordinano per merito dentro prepareHomePools;
        // il DNA entra solo con fiducia (opts.dnaWeights._share > 0).
        const dnaWeights = opts.dnaWeights && opts.dnaWeights._share > 0 ? opts.dnaWeights : { _share: 0 };
        // P7b — "Per Te" non ha testo ne' wizard: vale il primo accesso.
        const food = resolveFoodPrefs({ onboarding: opts.onboardingPrefs });
        const nonEmptyPools = prepareHomePools(themedCandidates, cityCenter, city, { dnaWeights, foodPrefs: food });
        if (Object.keys(nonEmptyPools).length === 0) {
            return { tours: [], _source: 'no-pools' };
        }

        // Gate PER TE — il momento della giornata, sull'ora di Roma, dalla
        // tabella dei momenti (dayMoments.js). Prima qui c'erano cinque soglie
        // scritte a mano (6/11/14/18/22) sull'ora del TELEFONO: una seconda
        // tabella, divergente da quella che usa il resto dell'app.
        const now = new Date();
        const nowRome = romeParts(now);
        const moment = momentAtClock(nowRome.h, nowRome.mi);
        const romeDay = `${nowRome.y}-${String(nowRome.m).padStart(2, '0')}-${String(nowRome.d).padStart(2, '0')}`;
        const timeContext = `${moment.label} (${tableClock(moment.start)}–${tableClock(moment.end)}) — ${moment.categories.join(', ')}`;

        // Cache key: city + cityCenter fingerprint + DATA e MOMENTO (ora di
        // Roma) + hash del pool aggregato. Gate PER TE — data e momento
        // entrano nella chiave: un racconto scritto per il pranzo non si
        // riusa a cena, ne' il giorno dopo.
        const centerFingerprint = cityCenter && Number.isFinite(cityCenter.latitude)
            ? `${cityCenter.latitude.toFixed(3)},${cityCenter.longitude.toFixed(3)}`
            : 'noRadius';
        const poolStr = Object.entries(nonEmptyPools)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([theme, arr]) => `${theme}:${arr.map(p => p.place_id || p.googlePlaceId).sort().join(',')}`)
            .join('|');
        // P7a2 — l'ordine dei pool dipende dal DNA: con fiducia, i pesi entrano
        // nella chiave (senza fiducia la chiave resta quella di prima).
        const dnaKey = (dnaWeights._share > 0 ? `|dna:${weightsFingerprint(dnaWeights)}` : '')
            + (hasFoodPrefs(food) ? `|cibo:${foodPrefsFingerprint(food)}` : '');
        const cacheKey = `hometours_v1_${city.replace(/\s+/g, '_')}_${centerFingerprint}_${romeDay}_${moment.key}_${hashStr(poolStr + dnaKey)}`;
        const cached = loadInsiderFromCache(cacheKey);
        // Gate PAROLE VIETATE (P3d) — anche la lettura dalla cache passa dal filtro.
        if (cached) return scrubHomeTours(cached, city);

        // Quota: 1 call = 1 generazione (biglietto home_tours: il server concede
        // 4000 max_tokens solo a questo tipo). skipUserQuota salta solo il preflight.
        if (!opts.skipUserQuota) {
            await assertQuotaAvailable();
        }
        const quotaTicket = newGenerationTicket('home_tours');

        const weatherIcon = weather?.condition === 'sunny' ? '☀️'
            : weather?.condition === 'rainy' ? '🌧️' : '⛅';

        const prompt = buildUnifiedHomeToursPrompt({
            city, timeContext, weather, weatherIcon,
            prefs, aiProfile, themedCandidates: nonEmptyPools,
        });

        const MAX_TOKENS = 4000;
        // Timeout 45s: prompt piu' grande + output 4000 tokens = puo' richiedere
        // ~15-25s reali. Insider da solo era 35s con 2000 tokens.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45_000);
        try {
            const data = await callOpenAIProxy({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: `Costruisci i tour. Ricorda: place_id dal blocco tema corrispondente, voce insider concreta, MAI aggettivi vuoti, tappe con description sensoriale specifica.` },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.7,
                max_tokens: MAX_TOKENS,
            }, controller.signal, quotaTicket);
            clearTimeout(timeoutId);

            const raw = data.choices?.[0]?.message?.content;
            if (!raw) throw new Error('Empty AI response (generateHomeTours)');
            const finishReason = data.choices?.[0]?.finish_reason ?? null;
            const tokenRisposta = Number.isFinite(data.usage?.completion_tokens) ? data.usage.completion_tokens : null;
            // Gate PER TE — risposta tagliata (max_tokens): si servono i tour
            // completi, mai un errore per questo.
            const { tours: rawTours, truncated } = parseHomeToursResponse(raw);
            if (truncated) {
                console.warn(`[Per Te] ${city}: risposta tagliata (finish_reason=${finishReason}, ${tokenRisposta ?? '?'}/${MAX_TOKENS} token) → ${rawTours.length} tour completi recuperati`);
            }
            if (!Array.isArray(rawTours) || (rawTours.length === 0 && !truncated)) throw new Error('AI returned no tours (generateHomeTours)');

            // Dedup cross-tour: primo tour che usa un place_id lo tiene, i tour
            // successivi che lo referenziano lo perdono. Ordine tipico: insider
            // prima (perle nascoste), poi tematici. Se l'AI cambia ordine, la
            // regola resta stabile — prima il primo.
            const seenPlaceIds = new Set();
            // Gate PER TE — il resoconto: quante tappe il modello ha raccontato,
            // quante arrivano a schermo, e perche' le altre no.
            const scarti = [];
            const scarta = (tour, title, motivo) => {
                scarti.push({ tour, title: title || '?', motivo });
                logHomeDiscard(city, tour, title, motivo);
            };
            let tappeRaccontate = 0;

            // P3d-c — tre passi: (1) ogni tour si prepara e passa dai filtri;
            // (2) UNA riscrittura per tutte le descrizioni svuotate o accorciate,
            // nello stesso biglietto 'home_tours'; (3) la regola II.2 scarta solo
            // le tappe ancora vuote, poi raggio e stime.
            // P7a — un luogo ceduto dall'insider al suo tema torna buono per
            // l'insider se NESSUN altro tour della risposta lo usa.
            const ceduti = nonEmptyPools.ceduti || new Map();
            const usatoAltrove = (pid) => rawTours.some(t => t?.themeType !== 'insider'
                && Array.isArray(t?.stops) && t.stops.some(st => st?.place_id === pid));
            const accettatiCeduti = [];
            const prepared = rawTours.map(tour => {
                const themeType = tour?.themeType;
                let pool = nonEmptyPools[themeType];
                const aiStops = Array.isArray(tour?.stops) ? tour.stops : [];
                tappeRaccontate += aiStops.length;
                if (!pool) {
                    console.warn(`[generateHomeTours] AI ha proposto themeType "${themeType}" fuori dai pool → tour scartato`);
                    for (const st of aiStops) scarta(themeType, st?.place_id, `tour con tema "${themeType}" fuori dai pool`);
                    return null;
                }

                // Gate PER TE — un place_id che non e' fra i candidati di QUESTO
                // tema si toglie qui, con il suo motivo (prima lo diceva solo
                // canonicalizeStopsFromCandidates, senza dire di quale tour).
                const poolIds = new Set(pool.map(homePid).filter(Boolean));
                const known = aiStops.filter(st => {
                    if (st && poolIds.has(st.place_id)) return true;
                    if (themeType === 'insider' && st && ceduti.has(st.place_id) && !usatoAltrove(st.place_id)) {
                        pool = [...pool, ceduti.get(st.place_id).poi];
                        poolIds.add(st.place_id);
                        accettatiCeduti.push(st.place_id);
                        return true;
                    }
                    scarta(themeType, st?.place_id, `place_id non fra i candidati del tema "${themeType}"`);
                    return false;
                });
                let canonized = canonicalizeStopsFromCandidates(known, pool);

                // Dedup cross-tour su place_id.
                canonized = canonized.filter(s => {
                    const pid = s.place_id || s.googlePlaceId;
                    if (!pid) return true; // no id → mantengo, e' un edge case da controllare
                    if (seenPlaceIds.has(pid)) {
                        scarta(themeType, s.title, 'gia\' in un altro tour');
                        return false;
                    }
                    seenPlaceIds.add(pid);
                    return true;
                });

                // Gate PAROLE VIETATE (P3d) — stesso filtro e stesso elenco
                // dell'itinerario, PRIMA della regola II.2.
                canonized = canonized.map(st => {
                    const r = scrubBannedWords(st);
                    logBannedRemovals(city, st.title, r.removed, 'home');
                    return { ...r.stop, _tolte: r.removed.filter(x => x.campo === 'description') };
                });
                return { tour, themeType, canonized };
            });

            // (1a) P3d-e — i fatti aperti delle tappe SCELTE (mai dei candidati),
            // con il tetto di 4 secondi. Poi il controllo anti-invenzione sulle
            // descrizioni del selettore, che le ha scritte senza fatti: una frase
            // con un oggetto assente dai fatti e dal nome si toglie. Le tappe con
            // dei fatti, e i locali, si riscrivono ancorate ai fatti e ai dati
            // nella stessa seconda chiamata della riscrittura (biglietto
            // 'home_tours', nessuna chiamata in piu').
            const poolById = new Map();
            for (const arr of Object.values(nonEmptyPools)) for (const c of (Array.isArray(arr) ? arr : [])) if (homePid(c)) poolById.set(homePid(c), c);
            for (const c of ceduti.values()) if (homePid(c?.poi)) poolById.set(homePid(c.poi), c.poi);
            const sceltePerTe = prepared.flatMap(pt => pt?.canonized || []);
            const factsRes = await fetchFactsForStops(sceltePerTe.map(st => ({
                place_id: st.place_id, name: st.title, lat: Number(st.latitude), lng: Number(st.longitude), types: st.types,
            })), { city });
            const facts = factsRes.byId;
            const locali = localeInfoFor(sceltePerTe, poolById, { food: hasFoodPrefs(food) ? food : null, dnaWeights });
            // P3d-g — "Per Te" e' adesso: la luce e l'ora si controllano sull'ora
            // di ADESSO (il tramonto non compare dopo cena), e ogni tappa ha il
            // suo motivo (tema del tour, DNA).
            const sunNow = sunTimes({ y: nowRome.y, m: nowRome.m, d: nowRome.d },
                Number.isFinite(cityCenter?.latitude) ? cityCenter.latitude : ROMA_FALLBACK.latitude,
                Number.isFinite(cityCenter?.longitude) ? cityCenter.longitude : ROMA_FALLBACK.longitude);
            const tramontoDavantiOra = sunNow.sunset ? now.getTime() <= sunNow.sunset.getTime() : undefined;
            const motivoPerTe = new Map();
            prepared.forEach((pt) => {
                if (!pt) return;
                pt.canonized = pt.canonized.map(st => {
                    const fatti = facts.get(st.place_id)?.fatti || [];
                    if (!locali.has(st.place_id)) motivoPerTe.set(st.place_id, placeReasons(poolById.get(st.place_id), { dnaWeights, tema: pt.themeType }));
                    const ora = filterTimeIncoherent(st.description, { arrival: now, sunrise: sunNow.sunrise, sunset: sunNow.sunset });
                    const r0 = filterInventedObjects(ora.text, { fatti, nomi: [st.title, st.name].filter(Boolean), fattiSu: factsAbout(facts.get(st.place_id)) });
                    const rv = filterVoice(r0.text);
                    const r = { text: rv.text, removed: [...r0.removed, ...rv.removed] };
                    for (const x of [...ora.removed, ...r.removed]) {
                        console.warn(`[P3d-g FATTI] ${city} (home): tolta frase (${(x.oggetti || x.regole || []).join(',')}) da "${st.title}" — "${x.frase}"`);
                    }
                    const tolte = [...ora.removed.map(x => ({ ...x })), ...r.removed.map(x => ({ ...x, regole: [x.regola] }))];
                    return {
                        ...st,
                        description: tolte.length > 0 ? r.text : st.description,
                        _tolte: [...st._tolte, ...tolte],
                        // P3d-g — ogni tappa si riscrive ancorata ai fatti o ai dati:
                        // il selettore l'ha raccontata senza fatti e senza dati.
                        _ancora: true,
                        _senzaFatti: fatti.length === 0,
                        ...(locali.has(st.place_id) ? { priceLevel: locali.get(st.place_id).price_level } : {}),
                    };
                });
            });

            // (1b) P7a2 — RIEMPIRE PRIMA DI NASCONDERE. Un tour che rischia di
            // restare sotto le 3 tappe (contando solo quelle gia' sicure:
            // descrizione presente e nessuna frase tolta) riceve in codice delle
            // RISERVE: i migliori candidati Gate MERITO rimasti nel SUO pool
            // (gia' entro il raggio, gia' ordinato per merito), che nessun altro
            // tour usa. Una riserva in piu' del necessario, perche' la sua
            // descrizione puo' non passare i filtri. Le riserve ricevono la
            // descrizione nella stessa seconda chiamata della riscrittura, dentro
            // il biglietto 'home_tours': nessuna chiamata in piu'. Si usano solo
            // se, dopo la riscrittura, il tour e' ancora sotto le 3 tappe.
            const usati = new Set();
            for (const pt of prepared) for (const st of pt?.canonized || []) if (st.place_id) usati.add(st.place_id);
            prepared.forEach((pt) => {
                if (!pt) return;
                const sicure = pt.canonized.filter(st => hasNonEmptyDescription(st) && st._tolte.length === 0).length;
                const mancano = HOME_TOUR_STOPS.min - sicure;
                pt.riserve = [];
                if (mancano <= 0) return;
                const pool = nonEmptyPools[pt.themeType] || [];
                for (const c of pool) {
                    if (pt.riserve.length >= mancano + 1) break;
                    const pid = homePid(c);
                    if (!pid || usati.has(pid)) continue;
                    const [st] = canonicalizeStopsFromCandidates([{ place_id: pid }], pool, { guard: false });
                    if (!st) continue;
                    usati.add(pid);
                    pt.riserve.push({ ...st, _tolte: [] });
                }
            });

            // (2) P3d-c — la riscrittura. Una tappa senza descrizione o con una
            // frase tolta dalla descrizione si riscrive; il resto non si tocca.
            // P7a2: nella stessa chiamata, la descrizione delle riserve.
            const rewriteItems = [];
            prepared.forEach((pt, ti) => {
                if (!pt) return;
                pt.canonized.forEach((st, si) => {
                    if (hasNonEmptyDescription(st) && st._tolte.length === 0 && !st._ancora) return;
                    rewriteItems.push({
                        key: `${ti}:${si}`, place_id: st.place_id, nome: st.title, types: st.types,
                        momento: moment.label,
                        tolte: st._tolte, exempt: [st.title, st.name].filter(Boolean),
                        fatti: facts.get(st.place_id)?.fatti || [],
                        fattiSu: factsAbout(facts.get(st.place_id)),
                        motivo: motivoPerTe.get(st.place_id) || [],
                        tramontoDavanti: tramontoDavantiOra,
                        arrival: now, sun: sunNow,
                        ...(locali.has(st.place_id) ? { locale: locali.get(st.place_id) } : {}),
                        ancora: st._ancora, attuale: st.description || null,
                    });
                });
                pt.riserve.forEach((st, ri) => {
                    const loc = isLocaleStop(st) ? localeInfoFor([st], poolById, { food: hasFoodPrefs(food) ? food : null, dnaWeights }).get(st.place_id) : null;
                    rewriteItems.push({
                        key: `${ti}:r${ri}`, place_id: st.place_id, nome: st.title, types: st.types,
                        momento: moment.label,
                        tolte: [], exempt: [st.title, st.name].filter(Boolean),
                        motivo: loc ? [] : placeReasons(poolById.get(st.place_id), { dnaWeights, tema: pt.themeType }),
                        tramontoDavanti: tramontoDavantiOra, arrival: now, sun: sunNow,
                        ...(loc ? { locale: loc } : {}),
                    });
                });
            });
            const rewrite = rewriteItems.length > 0
                ? await rewriteDescriptions({ city, items: rewriteItems, quotaTicket })
                : null;

            const aggiunte = [];
            const frasiSicure = [];
            const sunOggi = sunTimes({ y: nowRome.y, m: nowRome.m, d: nowRome.d },
                Number.isFinite(cityCenter?.latitude) ? cityCenter.latitude : ROMA_FALLBACK.latitude,
                Number.isFinite(cityCenter?.longitude) ? cityCenter.longitude : ROMA_FALLBACK.longitude);
            const tramontoOggi = clockLabel(sunOggi.sunset);
            const finalTours = prepared.map((pt, ti) => {
                if (!pt) return null;
                const { tour, themeType } = pt;
                // P3d-e — una tappa riscritta con dei fatti porta le sue fonti
                // (_conFatti); una non riscritta resta com'era dopo i filtri.
                // P3d-g — il testo del selettore non resta MAI: e' scritto senza
                // fatti e senza dati (prova reale: "un ingresso maestoso… ricco di
                // storia e bellezza" era sopravvissuto per una tappa con fatti).
                // Se la riscrittura ancorata non e' arrivata o non passa, frase
                // sicura del codice.
                let canonized = pt.canonized.map((st, si) => {
                    if (rewrite?.byKey.has(`${ti}:${si}`)) {
                        return { ...st, description: rewrite.byKey.get(`${ti}:${si}`), _conFatti: (facts.get(st.place_id)?.fatti || []).length > 0 };
                    }
                    return { ...st, description: null };
                });

                // Gate II.2 — mai placeholder "Luogo di interesse".
                // P3d-e: mai nemmeno una descrizione vuota. Una tappa che neanche
                // la riscrittura ha salvato riceve, dopo l'ordinamento, la frase
                // sicura del codice (tipo, momento, per i locali fascia e minuti):
                // solo dati veri, non un riempitivo.
                canonized = canonized.map(({ _tolte, _ancora, _senzaFatti, ...st }) => st);

                // P7a2 — sotto le 3 tappe: si completa con le riserve che hanno
                // ricevuto una descrizione (in ordine di merito).
                if (canonized.length < HOME_TOUR_STOPS.min) {
                    pt.riserve.forEach((st, ri) => {
                        if (canonized.length >= HOME_TOUR_STOPS.min) return;
                        const desc = rewrite?.byKey.get(`${ti}:r${ri}`);
                        if (!desc) return;
                        const { _tolte, ...clean } = st;
                        canonized.push({ ...clean, description: desc });
                        aggiunte.push({ tour: themeType, title: st.title, place_id: st.place_id });
                    });
                }

                // Safety filtro raggio: il pool e' gia' entro il raggio
                // (prepareHomePools), qui non dovrebbe togliere niente — se lo
                // fa, il motivo si vede.
                const withinRadius = applyRadiusFilter(canonized, cityCenter, city);
                for (const st of canonized) {
                    if (!withinRadius.includes(st)) scarta(themeType, st.title, 'oltre il raggio');
                }
                // DIFF 1a: le stime SUBITO dopo il sort, mai prima.
                // P3d-e: la frase sicura dopo le stime (i minuti dalla tappa prima).
                const ordered = computeStopTimings(sortByProximity(withinRadius)).stops.map(st => {
                    const conFonti = st._conFatti && hasNonEmptyDescription(st);
                    const { _conFatti, ...clean } = st;
                    if (hasNonEmptyDescription(clean)) return { ...clean, fonti: conFonti ? facts.get(st.place_id)?.fonti || null : null };
                    frasiSicure.push({ tour: themeType, title: st.title });
                    return {
                        ...clean,
                        description: safeDescription({
                            stop: clean, momento: moment.key, tramonto: tramontoOggi,
                            locale: isLocaleStop(clean),
                            priceLevel: Number.isFinite(clean.priceLevel) ? clean.priceLevel : priceLevelOf(poolById.get(clean.place_id)),
                            minutiDaPrima: clean.travelMinutesFromPrev,
                        }),
                        _fraseSicura: true,
                        fonti: null,
                    };
                });
                if (ordered.length === 0) {
                    console.warn(`[Per Te] ${city}: tour "${themeType}" senza tappe dopo gli scarti → non servito`);
                } else if (ordered.length < HOME_TOUR_STOPS.min) {
                    // P7a — un tour "Per Te" con meno di 3 tappe non e' un tour.
                    // P7a2 — si arriva qui solo se il pool non aveva piu' riserve
                    // valide (o la loro descrizione non ha passato i filtri).
                    for (const st of ordered) scarta(themeType, st.title, `tour con meno di ${HOME_TOUR_STOPS.min} tappe: nessun candidato valido rimasto nel pool`);
                }

                // P7b — la riga onesta, se il tour ha un pasto cercato col criterio.
                const byIdPool = new Map((nonEmptyPools[themeType] || []).map(c => [homePid(c), c]));
                const pastoCercato = food.dieta.length > 0 && ordered.some(st => isMealPlace(st)
                    && Array.isArray(byIdPool.get(st.place_id)?._dietaCercata) && byIdPool.get(st.place_id)._dietaCercata.length > 0);
                return {
                    themeType,
                    title: tour.title || `Tour di ${city}`,
                    mapMood: VALID_MOODS.has(tour.mapMood) ? tour.mapMood : 'default',
                    suggestedTransit: VALID_TRANSIT.has(tour.suggestedTransit) ? tour.suggestedTransit : 'walking',
                    stops: ordered,
                    ...(pastoCercato ? { dietNote: dietNoteLine(food.dieta) } : {}),
                };
            })
                .filter(t => t && t.stops.length >= HOME_TOUR_STOPS.min);

            // P7a — ovvieta': quante tappe servite stanno nel 10% piu' recensito
            // dei candidati di questa generazione.
            const tuttiCandidati = [...new Map(
                [...Object.values(nonEmptyPools).flat(), ...[...ceduti.values()].map(c => c.poi)]
                    .map(p => [homePid(p) || p?.title, p]),
            ).values()];
            const ovvieta = obviousnessReport(finalTours.flatMap(t => t.stops), tuttiCandidati);
            // P7a2 — famosita': mediana delle recensioni delle tappe servite e
            // tappe sopra 5.000 (citta') / 1.000 (borghi).
            const famosita = famositaReport(finalTours.flatMap(t => t.stops), city, tuttiCandidati);

            const report = {
                tourProposti: rawTours.length,
                tourServiti: finalTours.length,
                tappeRaccontate,
                tappeServite: finalTours.reduce((n, t) => n + t.stops.length, 0),
                scarti,
                tokenRisposta,
                maxTokens: MAX_TOKENS,
                finishReason,
                troncata: truncated,
                momento: moment.key,
                giorno: romeDay,
                riscrittura: rewrite?.report ?? null,
                frasiSicure,
                fatti: {
                    ...factsRes.report,
                    perTappa: finalTours.flatMap(t => t.stops.map(st => ({ tour: t.themeType, place_id: st.place_id, title: st.title, fatti: facts.get(st.place_id)?.fatti || [] }))),
                },
                cedutiAccettati: accettatiCeduti,
                aggiunte,
                famosita,
                ...(hasFoodPrefs(food) ? {
                    vincoliCibo: {
                        ...food,
                        tappePasto: finalTours.flatMap(t => t.stops.filter(isMealPlace).map(st => {
                            const c = tuttiCandidati.find(x => homePid(x) === st.place_id) || {};
                            return {
                                tour: t.themeType, title: st.title, cucina: cuisineOf(c), price_level: priceLevelOf(c),
                                criterio: Array.isArray(c._dietaCercata) && c._dietaCercata.length ? dietCriteria(c._dietaCercata).join(', ') : null,
                                ricerca: c._ricercaCibo || null,
                            };
                        })),
                    },
                } : {}),
                ovvieta, // solo per confronto (P7a)
            };
            console.info(`[Per Te] ${city}: ${report.tourServiti}/${report.tourProposti} tour, ${report.tappeServite}/${report.tappeRaccontate} tappe servite (${aggiunte.length} aggiunte in codice), ${scarti.length} scarti, ${tokenRisposta ?? '?'}/${MAX_TOKENS} token${truncated ? ', risposta tagliata' : ''}, famosita' mediana ${famosita.mediana ?? '-'} / ${famosita.sopraSoglia} sopra ${famosita.soglia}, ovvieta' ${ovvieta.nelTop10}/${ovvieta.tappe}`);
            const result = { tours: finalTours, _source: 'unified-home', _report: report };
            saveInsiderToCache(cacheKey, { tours: finalTours, _source: 'unified-home' });
            return result;
        } catch (err) {
            clearTimeout(timeoutId);
            if (mustReachUi(err)) throw err;
            console.warn(`[generateHomeTours] fallita: ${err.name === 'AbortError' ? 'timeout' : err.message}`);
            // Fail-CLOSED: nessun tour di ripiego finto. Chi consuma decide
            // (empty state onesto). Regola locked #1: nessun fallback produce
            // mai contenuto.
            return { tours: [], _source: 'error', _error: err.message };
        }
    },

    // La guard "almeno un POI" è stata rimossa: la coerenza non si verifica,
    // si costruisce.
    //
    // @param {string} city
    // @param {Array<{name, place_id, lat, lng}>} chosenPois — obbligatori
    // @param {object} weather (per la copertina del tour, non per il narratore)
    // @param {object} cityCenter (per centrare la mappa)
    // @returns {Promise<{ tourData, chosenPois } | null>}
    async generateSystemPrewarmTour(city, chosenPois = [], weather = {}, cityCenter = null) {
        if (!Array.isArray(chosenPois) || chosenPois.length === 0) {
            console.warn(`[SysPrewarm] chosenPois vuoti → skip`);
            return null;
        }

        try {
            // Gate T.1: cap syswarm rimosso. Era dimensionato su 6 completion
            // OpenAI/giorno (Blocco 2.1 Fase 2). Dopo Gate N.2 il precompute
            // NON chiama piu' l'LLM: fetchPlaceDetailsForTour su Places
            // Legacy Basic Data (name/geometry/photos/types/opening_hours) ha
            // costo ZERO. Il cap client-side proteggeva un budget che non
            // esiste piu', e bloccava l'unica funzione del prodotto dopo la
            // sesta apertura del giorno. La cache 24h di placesDiscoveryService
            // + cityCenter cache mitigano gia' il traffico Google. Se in
            // futuro serve difesa quota, va messa lato edge function proxy
            // (centrale per progetto, non user-side aggirabile via
            // localStorage.clear()).

            // 2. Fetch place/details in parallelo per ogni chosenPoi.
            const { placesDiscoveryService } = await import('./placesDiscoveryService');
            // Gate BB.e: passa rating/user_ratings_total del candidato come hints.
            // Evita di ripagare Atmosphere SKU per dati gia' ricevuti dal textsearch
            // via chosenPois (Notifications.jsx li passa dal payload notifica).
            const detailsResults = await Promise.all(
                chosenPois.map(p => placesDiscoveryService.fetchPlaceDetailsForTour(p.place_id, city, {
                    rating: p.rating,
                    user_ratings_total: p.user_ratings_total,
                }))
            );

            // Solo POI arricchiti con successo entrano nel tour. Coord obbligatorie.
            const enrichedStops = detailsResults
                .filter(d => d && Number.isFinite(d.latitude) && Number.isFinite(d.longitude));

            if (enrichedStops.length === 0) {
                console.warn(`[SysPrewarm] 0 chosenPois arricchibili via place/details → skip`);
                return null;
            }

            // 3. Ordina per prossimità (nearest-neighbor greedy).
            // DIFF 1a: le stime SUBITO dopo il sort, mai prima.
            const ordered = computeStopTimings(sortByProximity(enrichedStops)).stops;

            // 4. Costruisci tourData compatibile con TourDetails render.
            // DIFF 1a: soste + spostamenti dalla fonte unica, non una somma a mano.
            const totalMinutes = totalTourMinutes(ordered);
            const tourData = {
                days: [{
                    day: 1,
                    title: `Il tuo giro a ${city}`,
                    weather: {
                        condition: weather?.condition || 'Sereno',
                        temperature: weather?.temperature ?? 22,
                        icon: weather?.condition === 'rainy' ? '🌧️' : weather?.condition === 'sunny' ? '☀️' : '⛅',
                    },
                    suggestedTransit: 'walking',
                    mapMood: 'default',
                    stops: ordered,
                }],
                _source: 'system-prewarm',
                _duration_minutes: totalMinutes,
            };

            return { tourData, chosenPois };
        } catch (err) {
            // Gate T.1: rimossa re-throw SYSTEM_PREWARM_CAP_EXCEEDED (cap sparito).
            console.warn(`[SysPrewarm] failed: ${err.message}`);
            return null;
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

    // ─── DYNAMIC WEATHER & SOCIAL TIP (Blocco 2.1 FASE 1) ─────────────────────
    //
    // Pipeline nuova: contesto reale → recipe query → Places → dati verificabili
    // → AI vincolata a nomi in lista. Zero invenzione. Se Places 0 → null.
    //
    // Regole voce locked (feedback_dovevai_voce + Gate S.4): title = cue di
    // slot fisso (mai ora nuda che scade in un minuto), message = motivo
    // verificabile, blacklist verbi da menu/aggettivi vuoti.
    //
    // @param {string} city
    // @param {string} userName
    // @param {'morning'|'midday'|'afternoon'|'evening'|'night'} slot
    // @param {object} ctx — { userLat, userLng, temperatureC, condition, cityCenter }
    // @returns {Promise<null | { title, message, chosenPois: [{name, place_id, lat, lng}] }>}
    async generateWeatherSocialTip(city, userName, slot = 'afternoon', ctx = {}) {
        // Gate S.4: title = cue di slot deterministico, non generato dall'AI.
        // "Sono le 8:09 🌇" scade in un minuto; "Stamattina 🌇" e' vero per
        // tutta la finestra dello slot. Il title lo scrive il codice, l'AI
        // scrive solo il message (dove ci sono i dati verificabili).
        const SLOT_TITLES = {
            morning:   'Stamattina 🌇',
            midday:    'A pranzo 🍝',
            afternoon: 'Nel pomeriggio 🗺️',
            evening:   'Stasera 🌆',
        };
        const forcedTitle = SLOT_TITLES[slot] || null;
        try {
            // 1. Recipe da (slot, weatherClass). Se null (es. night) → nessuna notifica.
            const { computeWeatherClass, getRecipe } = await import('../lib/notificationRecipes');
            const weatherClass = computeWeatherClass(ctx.temperatureC, ctx.condition);
            const recipe = getRecipe(slot, weatherClass);
            if (!recipe) {
                console.info(`[SmartNotif] ${city}/${slot}/${weatherClass}: no recipe → skip`);
                return null;
            }

            // 2. cityCenter obbligatorio per textsearch (nessun tour senza).
            const cc = ctx.cityCenter;
            if (!cc || !Number.isFinite(cc.latitude) || !Number.isFinite(cc.longitude)) {
                console.info(`[SmartNotif] ${city}: cityCenter mancante → skip`);
                return null;
            }

            // 3. Places textsearch via placesDiscoveryService (customQuery + customKind).
            const { placesDiscoveryService } = await import('./placesDiscoveryService');
            // P7b — le notifiche rispettano dieta e budget del primo accesso.
            // Dieta: una ricetta di pasto (pranzo, ristorante, cucina) cerca con
            // il criterio dentro la query; un posto dove mangiare trovato
            // altrimenti non si propone. Budget: fuori i price_level sopra il tetto.
            const food = resolveFoodPrefs({ onboarding: ctx.onboardingPrefs });
            const isMealRecipe = recipe.kind === 'FOOD' && /pranzo|ristorante|cucina|trattoria|osteria/i.test(`${recipe.categoria} ${recipe.query}`);
            const useDiet = isMealRecipe && food.dieta.length > 0;
            const runRecipe = (q) => placesDiscoveryService.discoverRealPOIs(
                city, cc.latitude, cc.longitude, null,
                { customQuery: q, customKind: recipe.kind, skipLegacyFallback: true, maxResults: 5 }
            );
            let candidates = useDiet
                ? (await searchFoodWithDiet(runRecipe, recipe.query, food.dieta)).results
                : await runRecipe(recipe.query);
            if (hasFoodPrefs(food) && Array.isArray(candidates)) {
                const fc = applyFoodConstraints(candidates, food, isMealPlace);
                if (fc.tolti.length > 0) console.info(`[SmartNotif] ${city}: ${fc.tolti.length} tolti dai vincoli — ${fc.tolti.map(x => `${x.name} (${x.motivo})`).join(' | ')}`);
                candidates = fc.candidates;
            }
            if (!Array.isArray(candidates) || candidates.length === 0) {
                console.info(`[SmartNotif] ${city}/${recipe.query}: 0 candidati Places → skip`);
                return null;
            }

            // Gate NOTIFICHE-DISTANZA — il raggio, che qui non c'era.
            //
            // Finding device 15/08 (F9): notifica "Museo e Real Bosco di
            // Capodimonte" (Napoli) a un utente a Ippocampo, ~200 km. La citta'
            // era giusta: manca(va) il vincolo di distanza. Il `radius` della
            // textsearch e' un BIAS per Google, non un filtro — e su un pool
            // povero restituisce risultati fuori raggio.
            //
            // I tre path tour hanno applyRadiusFilter (:1186, :1403, :1623);
            // questo era l'unico dei quattro consumatori di discoverRealPOIs
            // senza. `cc` porta gia' radiusKm (5 km borgo / 10 km citta',
            // iniettato da resolveCityCenter).
            //
            // allowWiden:false — per un tour meglio una tappa a 12 km che
            // nessun tour; per una notifica che dice "N min a piedi da te",
            // 12 km e' ancora una distanza falsa.
            //
            // Prima dello slice(0,3): le 3 fetchPlaceOpeningHours qui sotto si
            // pagano solo sui superstiti, non su chi verrebbe scartato dopo.
            const nearby = applyRadiusFilter(candidates, cc, city, { allowWiden: false });
            if (nearby.length === 0) {
                console.info(`[SmartNotif] ${city}/${recipe.query}: 0 candidati entro il raggio → skip`);
                return null;
            }

            // 4. Top-3 candidati (già ordinati per QS in discoverRealPOIs).
            const top = nearby.slice(0, 3);

            // 5. Distanza a piedi (SOLO se GPS attivo). Zero fallback su cityCenter.
            const { haversineKm } = await import('./tourShape');
            // VOCE 1 (30/08) — qui c'era:
            //     const hasGps = Number.isFinite(ctx.userLat) && Number.isFinite(ctx.userLng);
            // che NON testava il GPS: testava che due numeri esistessero, senza
            // poterne vedere la provenienza. E in tre rami su quattro
            // `userContextService` riempie lat/lng dalla CITTA' (:46 manuale,
            // :93 profilo/localStorage, da una tabella hardcoded a :208) —
            // solo :59 li prende dal dispositivo. Con GPS spento e citta'
            // risolta da profilo, `hasGps` era true, la distanza si calcolava
            // dal CENTRO CITTA' e finiva nel prompt come "N min a piedi da te",
            // mentre la Home mostrava ancora "Attiva la tua posizione".
            //
            // Ora si legge la PROVENIENZA, che `getUserContext` gia' produceva
            // (`source`, :170) e che nessuno propagava. Il controllo sui numeri
            // resta, ma come precondizione aritmetica: senza provenienza 'gps'
            // non basta piu' che esistano.
            const hasGps = ctx.source === 'gps'
                && Number.isFinite(ctx.userLat) && Number.isFinite(ctx.userLng);

            // Gate N.1 — Fetch opening_hours.periods dei top-3 in parallelo.
            // Ci serve closingTimeTodayHH (es. "22:00") per il prompt. openNow
            // di Places textsearch resta ma è dato istantaneo meno affidabile.
            const openingHoursResults = await Promise.all(
                top.map(p => placesDiscoveryService.fetchPlaceOpeningHours(p.place_id || p.googlePlaceId))
            );

            const enriched = top.map((p, i) => {
                const distanceMinutes = hasGps && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
                    ? Math.round(haversineKm(ctx.userLat, ctx.userLng, p.latitude, p.longitude) * 12)
                    : null;
                const oh = openingHoursResults[i] || {};
                return {
                    name: p.name,
                    place_id: p.place_id || p.googlePlaceId,
                    lat: p.latitude,
                    lng: p.longitude,
                    rating: p.rating,
                    user_ratings_total: p.user_ratings_total,
                    // Preferisci closingTimeTodayHH (da place/details): dato strutturale.
                    // Fallback openNow (da textsearch): istantaneo, meno affidabile.
                    closingTimeTodayHH: oh.closingTimeTodayHH || null,
                    // Gate TOUR-SENSATO (F18) — era `p.opening_hours?.open_now`,
                    // sempre undefined: buildPOIFromCandidate costruisce un
                    // oggetto nuovo e non trasportava l'oggetto annidato. La
                    // lettura cadeva silenziosamente sul fallback `?? null`.
                    // Ora il candidato porta `open_now` piatto.
                    open_now: oh.openNow ?? p.open_now ?? null,
                    distanceMinutes,
                };
            });

            // 6. Costruisci prompt con dati verificabili.
            const nowH = new Date().getHours();
            const nowM = new Date().getMinutes().toString().padStart(2, '0');
            const tempStr = Number.isFinite(ctx.temperatureC) ? `${ctx.temperatureC}°C` : null;
            const weatherStr = ctx.condition || null;

            // Gate N.1 — Preferisci closingTimeTodayHH (dato strutturale da
            // place/details) a openNow (istantaneo da textsearch, spesso in ritardo).
            // Se hai closingTime → "chiude alle 22:00". Se non hai closingTime ma
            // hai openNow → "aperto adesso" / "chiuso ora". Se nessuno dei due →
            // NESSUN claim sull'apertura.
            const candidatesBlock = enriched.map((c, i) => {
                const bits = [`${i + 1}. ${c.name}`];
                if (c.distanceMinutes !== null) bits.push(`${c.distanceMinutes} min a piedi da te`);
                if (c.closingTimeTodayHH) {
                    bits.push(`chiude oggi alle ${c.closingTimeTodayHH}`);
                } else if (c.open_now === true) {
                    bits.push('aperto adesso');
                } else if (c.open_now === false) {
                    bits.push('chiuso ora');
                }
                if (Number.isFinite(c.rating)) bits.push(`rating ${c.rating}`);
                return bits.join(' — ');
            }).join('\n');

            const contextBlock = [
                `Città: ${city}`,
                `Ora esatta: ${nowH}:${nowM}`,
                tempStr && `Temperatura: ${tempStr}`,
                weatherStr && `Condizioni: ${weatherStr}`,
                `Slot orario: ${slot} (${weatherClass})`,
                `Categoria: ${recipe.categoria}`,
                hasGps ? 'GPS utente: disponibile → usa "a X minuti da te"' : 'GPS utente: NON disponibile → NON dire "da te" e NON dare distanze',
            ].filter(Boolean).join('\n');

            const systemPrompt = `Sei una persona che conosce ${city} bene. Non un travel advisor, non una guida turistica.

Ti do 3 posti REALI trovati su Google Places nel giro di 5km:
${candidatesBlock}

CONTESTO:
${contextBlock}

Scrivi SOLO il MESSAGE della notifica (il title lo genero io: "${forcedTitle}").
Il message promette all'utente di andare in 1 o 2 di questi posti.

REGOLE MESSAGE (locked):
- UN MOTIVO verificabile per andare, costruito SOLO sui dati che hai.
- Esempi ok: "Palazzo Biscari è a 6 minuti da te e chiude alle 19:00", "MM Trattoria è a 4 minuti da te, aperto adesso."
- Regola sugli orari (PRIORITÀ):
  1) Se un candidato ha "chiude oggi alle HH:MM" nei suoi dati → PREFERISCILO ("chiude alle 19:00"). È un dato strutturale, affidabile.
  2) SOLO se manca "chiude oggi alle" ma è presente "aperto adesso" → puoi dire "aperto adesso" (dato istantaneo, meno affidabile).
  3) Se non hai NÉ orario di chiusura NÉ open_now nei dati del candidato → NON dire nulla sull'apertura. Nessun claim > claim falso.
- Non inventare mai orari (es. "chiude alle 20" se non c'è nei dati): reintrodurre un fake ucciso.
- Il motivo DEVE essere costruito SOLO sui dati che ti ho dato sopra (ora, temperatura, meteo, distanza, open_now, rating).
- NIENTE riferimenti all'ora esatta (es. "sono le 18:12"): il title lo copre, e "sono le HH:MM" scade in un minuto se l'utente apre in ritardo.
- NIENTE fatti inventati sul posto: no "il pub dove producono la birra", no "storia dal 1960". Se non è nei dati sopra, non lo sai.
- NIENTE aggettivi vuoti, verbi da menu, formule di giudizio o raccomandazione. Parole VIETATE:
${bannedWordsPromptLines()}
  Sono opinioni su un posto che non hai mai visto. Il message finisce dopo l'ultimo FATTO verificabile: nessuna coda di opinione, nessuna chiusura da recensione.
- Otto parole per far alzare l'utente dal divano. Voce di persona, non di app.

LIMITI DURI:
- Usa SOLO i nomi nella lista dei 3 candidati. Se citi un nome non in lista → sei fuori.
- Message max 140 caratteri.
- Zero hashtag, zero emoji nel message.
- Se pensi che nessuno dei 3 candidati sia adatto o non hai un motivo forte → rispondi { "skip": true, "reason": "..." }.

Rispondi in JSON puro:
  { "message": "..." }
oppure
  { "skip": true, "reason": "..." }`;

            const data = await callOpenAIProxy({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: 'Scrivi la notifica ora.' }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.4, // determinismo maggiore per voce coerente
                max_tokens: 200,
            });

            if (!data.choices?.[0]) throw new Error('No AI response');
            const parsed = JSON.parse(data.choices[0].message.content);

            if (parsed.skip === true) {
                console.info(`[SmartNotif] ${city}/${slot}: AI skip (${parsed.reason || 'no reason'})`);
                return null;
            }

            if (!parsed.message) {
                throw new Error('Incomplete AI response (missing message)');
            }
            if (!forcedTitle) {
                // Slot senza cue mappato (es. night) → skip. Gate Q.1 gia' skippa
                // night a monte in useUserNotifications, ma safety-net.
                console.warn(`[SmartNotif] ${city}/${slot}: nessun cue di slot definito → skip`);
                return null;
            }

            // Gate T.2 → P3d-b: post-processing anti-giudizio con l'elenco UNICO
            // (narrationLight.js), lo stesso del narratore e di "Per Te". Prima qui
            // c'era un elenco a parte (JUDGMENT_PATTERNS) che tagliava solo le code
            // dopo il primo punto. Ora la frase con una parola vietata si toglie,
            // ovunque sia; i nomi dei candidati non fanno scattare il filtro.
            const scrubbed = filterBannedWords(String(parsed.message), { exempt: enriched.map(c => c.name) });
            for (const x of scrubbed.removed) {
                console.warn(`[SmartNotif] ${city}/${slot}: tolta frase (${x.parole.join(',') || x.regola}) — "${x.frase}"`);
            }
            const cleanMessage = String(scrubbed.text || '').replace(/\s+/g, ' ').trim();
            if (!cleanMessage || cleanMessage.length < 20) {
                console.warn(`[SmartNotif] ${city}/${slot}: message post-cleanup vuoto/troppo corto → scarto`);
                return null;
            }
            parsed.message = cleanMessage;

            // 7. Verifica anti-invenzione: message deve contenere almeno un nome
            //    della lista candidati. Se cita nomi non-in-lista → scarta.
            //
            // Gate R.3: ordina chosenPois per ordine di MENZIONE nel messaggio,
            // non per qualityScore di enriched. Cosi' chosenPois[0] e' il POI
            // nominato PER PRIMO nel testo — che diventa il seme fisso di
            // sortByProximity (aiRecommendationService.js:766) e la prima
            // tappa del tour costruito da generateSystemPrewarmTour. Il CTA
            // ("Parti da X") nomina lo stesso POI che l'utente ha letto per
            // primo. Coerenza notifica ↔ tour ↔ CTA garantita.
            const msg = String(parsed.message).toLowerCase();
            const chosenPois = enriched
                .filter(c => msg.includes(c.name.toLowerCase()))
                .sort((a, b) => msg.indexOf(a.name.toLowerCase()) - msg.indexOf(b.name.toLowerCase()));
            if (chosenPois.length === 0) {
                console.warn(`[SmartNotif] ${city}/${slot}: AI non ha citato nessun candidato → scarto`);
                return null;
            }

            return {
                // Gate S.4: title deterministico da codice, non da AI.
                title: forcedTitle,
                message: String(parsed.message).slice(0, 180),
                // Gate BB.e: propaga rating/user_ratings_total del candidato al payload
                // notifica -> passa al precompute tour via candidateHints -> evita ripagare
                // Atmosphere SKU. Dato gia' ricevuto dal textsearch, si porta appresso.
                chosenPois: chosenPois.map(c => ({
                    name: c.name,
                    place_id: c.place_id,
                    lat: c.lat,
                    lng: c.lng,
                    rating: c.rating,
                    user_ratings_total: c.user_ratings_total,
                })),
            };
        } catch (e) {
            console.warn('[SmartNotif] generateWeatherSocialTip failed:', e.message);
            return null; // null → useUserNotifications non pubblica notifica
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
