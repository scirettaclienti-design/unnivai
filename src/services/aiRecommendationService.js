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
// C10b2 — `passaggio` (lista, traduttore, selettore, narratore…): il modello lo sceglie il proxy (openai-proxy/modelli.ts),
// il client manda il modello di prima, che e' anche il ripiego. La risposta dice quale ha usato (`_modello`).
const callOpenAIProxy = async (payload, signal, quota, passaggio = null) => {
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
      body: JSON.stringify({ endpoint: '/chat/completions', ...payload,
        ...(quota || passaggio ? { dv: { ...(quota || { purpose: 'aux' }), ...(passaggio ? { passaggio } : {}) } } : {}) }),
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
// P3d-j — le voci di prima avevano testo libero e niente scelte (_comp): via.
// ORARI — prefix bumped da 'unnivai_insiderf11_composto_': i giri e i tour Per Te cached prima
// del passaggio alla ricerca nuova non hanno la regola degli orari (posti chiusi compresi).
// ORARI-FESTIVI — prefix bumped da 'unnivai_insiderf13_tipi_': i giri cached prima non
// conoscono gli orari del giorno (festivi, ferie).
// C6a — prefix bumped da 'unnivai_insiderf12_orari_': famiglie, durate e nomi puliti
// dal tipo principale; i giri cached prima hanno soste e nomi di prima.
// CONTINUITA' — prefix bumped da 'unnivai_insiderf14_festivi_': i giri cached prima hanno buchi
// non dichiarati e il tempo libero senza fascia.
// C7 — prefix bumped da 'unnivai_insiderf15_continuita_': i giri cached prima hanno ristoranti a mattina,
// pomeriggio e aperitivo nelle richieste a tema cibo, e zone come tappe.
// C8a — prefix bumped da 'unnivai_insiderf16_composizione_': i giri cached prima hanno l'aperitivo da 20 minuti,
// nessuna passeggiata fra drink e cena, e la sera tarda del Veloce senza scheletro.
const INSIDER_CACHE_PREFIX = 'unnivai_insiderf21_testi_';
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
import { chiusuraFutura, orariPassatiNelTesto } from '../lib/orariNotifica';
import { isSmallTown, applyRadiusFilter, haversineKm, normalizeStepCategory } from './tourShape';
// Gate RAGGIO DIFF 1a — stime di durata (sosta da types + spostamento haversine).
// Va chiamato SEMPRE dopo l'ordinamento definitivo: lo spostamento e' una
// proprieta' della coppia di tappe consecutive, non della singola tappa.
import { computeStopTimings, totalTourMinutes, refreshTourScheduledTimes, APERITIVO_STAY_MINUTES } from '@/lib/tourTiming';
// Gate FINESTRA TEMPORALE (G3) — quando parte il tour lo decide il codice, non il modello.
import { resolveTourWindow, romeParts, romeDate } from '@/lib/tourWindow';
import { distanzaDalGiro, minutiFinoAllaTappa, primaTappaDelGiro } from '@/lib/giroLontano';
import { DESTINATION_UNSURE_NOTE, destinationNote, extractCityCandidate, isStreetMention, sameCity } from '@/lib/textDestination';
// Gate NARRATORE-DOPO — alba/tramonto nel codice, controllo luce/ora, fascia dalla tabella.
import { sunTimes, eBuio } from '@/lib/sunTimes';
// Gate PAROLE VIETATE — l'unico elenco: i prompt lo mostrano, il filtro lo applica.
import { filterBannedWords, bannedWordsPromptLines, unsupportedJudgments } from '@/lib/narrationLight';
// P3d-e — fatti aperti sulle tappe finali, controllo anti-invenzione, frase sicura.
// P3d-j — il modello sceglie, il codice scrive: le frasi approvate e la rete.
import { stopData, guardComposed, apertura, ganciValidi, interessiPerTappa, userInterests, composeFreeTime, registraFrasi } from '@/lib/stopPhrases';
import { senzaEscape, weatherLabel, weatherIconOf, isDopocenaClock } from '@/lib/italianLabels';
import { fetchFactsForStops, isLocaleStop } from './factsService';
import { momentAtClock, MOMENTS, MOMENT_BY_KEY, ALBA_MINUTES } from '@/lib/dayMoments';
import { FREE_TIME_MAX_MINUTES, freeTimeStop } from '@/lib/freeTime';
import { bandFreeTime, minStopsForWindow } from '@/lib/continuity';
import { detectFoodTheme, isForeignCuisine, localCuisineReason, tipicoBonus } from '@/lib/foodTheme';
import { zoneReason } from '@/lib/zone';
import { isSitDownMeal, perTeMealProblem, mealFitsClock, isBreakfastPlace } from '@/lib/mealRules';
import { AiEngineError, AI_ENGINE_KIND_BY_CODE } from '@/lib/aiEngineError';
// P3 — lo scheletro della giornata guida la scelta dei luoghi.
import { buildDaySkeleton, addEveningWalk, normalizePace, isSeraStart, parseExplicitCategory, COLAZIONE_AUTO_ENTRO_MINUTES, colazioneAutoSpenta } from '@/lib/daySkeleton';
import {
    flattenSkeleton, bucketCandidates, shortMomentThemes,
    repairMomentSelection, scheduleMomentPlan, isMealPlace, scheduleHoursSources,
    requestedFamilies, mealSearchAnchor, MAX_WALK_METERS, MAX_EXTRA_SEARCHES, momentTheme, WALK_NATURA_BORGO_MINUTES,
    applyOpeningToBuckets, settleOpeningHours, closedMomentRows, scheduleHoursLabels, dropFromSchedule, fillGaps, gapRows, fillMinimum, belowMinimumRows,
    isStoricaLista,
} from './momentSelection';
// ORARI — una tappa vale solo se il posto e' aperto per tutta la sosta (lib/openingHours).
import { messaggioChiuso, TESTO_NESSUN_LOCALE_APERTO, romeMinutes, openStatus } from '../lib/openingHours';
import { keepOpenStops } from '../lib/openStops';
import { routeMetrics } from '../lib/routeShape';
import { requestNow } from '../lib/simulatedNow';
import { PER_TE_TESTI } from '../lib/esitoVuoto';
import { PROPOSTE_MINIME, riferimentoPerDopo, placeIdDeiGiri, unisciProposte } from '../lib/perTeProposte';
// C10 — la lista della città: l'AI propone (sul server, una per città e giorno), Google verifica, le regole compongono.
import { fetchCityKnowledge, fetchQuartiereKnowledge } from './cityKnowledgeService';
import { NATURA_BORGO_KM, isNaturaOPanorama, isLuogoStorico, nelComuneIndirizzo, isOrganizzazione, isNaturaDaFuori, NOTA_NATURA_NOTTE, chiedeGiornata } from '../lib/borgoConfini';
import { poiDallaLista, uniscialPool, poolConLista, seminaAncore, declassa, scalaConfermata, scegliQuartiere, dentroArea, delQuartiere, rigaBorgo, BORGO_MIN_VERIFICATI, areaDeiQuartieri, bucketsNelleAree, fasciaApertaBorgo, LUOGHI_QUARTIERE_MIN, RAGGIO_QUARTIERE_KM, GIORNATA_INTERA_MINUTI, nomiDiLuogoNelTesto, quartiereConfermato, quartiereFuoriLista, nucleoDi, dentroNucleo, bucketsNelNucleo, spostaAncoreVietate, luogoDaVisitareBorgo, oreDiVisita, RAGGIO_BORGO_KM, apertoNellaFinestra } from '../lib/cityKnowledge';
export { TOP_30_CITIES, isSmallTown, haversineKm, applyRadiusFilter } from './tourShape';
// Gate MERITO — soglia di qualita' + punteggio (affinita'/unicita'/voto) al
// posto del ranking per qualityScore. Vedi candidateScoring.js per il razionale.
import { richiestaEsplicita, filtraEsclusi, notaEsclusioni, categoriaEsclusa } from '../lib/richiestaEsplicita';
import { aggiungiSosteDna, ricercheDellaSosta } from '../lib/sosteDna';
import { riordinaPerPercorso, ordinePercorsoSpento } from '../lib/ordinePercorso';
// DNA-3c — una ricerca di testo di Google Places (listino del banco): il costo massimo di una ricerca della sosta
const COSTO_RICERCA_SOSTA_USD = 0.032;
import { weightsToAIProfile } from './preferenceEngine';
import { mapCandidateToCoreCategories, selectScoredCandidatePool, passesQualityThreshold, enforceCategoryVariety, weightsFingerprint, obviousnessReport, rankByMerit, famositaReport, computeAffinityScore, dnaShareOf } from './candidateScoring';
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
// T1: v2 → v3 (il traduttore restituisce anche `citta`: una voce v2 non ce
// l'ha e farebbe restare il tour sulla posizione).
const INTENT_CACHE_PREFIX = 'unnivai_intent_v3_';
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
// C10b3-ter (decisione di Ivano) — negli esempi nessun nome delle citta' del banco (ne' dei loro posti): il banco misura, non suggerisce.
const INTENT_TRANSLATOR_PROMPT = `Sei il traduttore di intenti di DoveVAI.
Il tuo unico compito: leggere una frase in italiano scritta da un turista, e produrre in JSON gli input per una ricerca di luoghi reali su Google Places nella città indicata.

⚠️ NON generi tappe. NON scrivi descrizioni. NON inventi nomi di posti.
Traduci soltanto: intento umano → parole per un motore di ricerca + vincoli.

FORMATO OUTPUT — JSON puro, zero markdown, zero testo fuori dal JSON:
{
  "queries": ["...", "...", "..."],
  "categoria": "...",
  "oggetto_umano": "...",
  "citta": null | "...",
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
    parchi urbani     → si chiamano quasi sempre "villa" (Villa Comunale, Villa Durazzo Pallavicini, Villa Croce).
                        Solo raramente "parco" (Parco del Valentino, Parco della Musica).
                        Query giusta per natura urbana: ["villa comunale parco", "orto botanico", "giardino pubblico"].
                        Query debole: ["parchi", "giardini", "aree verdi"] — non matcha nomi propri veri.
    giardini botanici → "orto botanico" (non "giardino botanico").
    belvedere         → "belvedere panorama" o "terrazza panoramica".
    trattorie tipiche → "trattoria tipica" o "osteria" (non "cucina tradizionale", troppo generico).
    spiagge           → "spiagge", "lidi", "cale" — tutti termini nativi Google Maps.
    musei archeologici → "museo archeologico" (non "archeologia").
- Esempio applicato:
    input: "un giro nei parchi di Verona"
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

REGOLE SU citta:
- La riga "Città:" del messaggio è la POSIZIONE dell'utente, non per forza la meta.
- Se la frase nomina una città o un paese italiano dove fare il giro ("Domani Torino", "una giornata a Bari"), scrivi il suo nome com'è in italiano ("Torino", "Bari").
- Se la frase nomina un luogo famoso di un'altra città ("la Mole Antonelliana"), scrivi quella città.
- Un nome di città dentro il nome di una strada o piazza NON è una città: "via Torino", "piazza Torino", "corso Genova" → null.
- Se la frase non nomina nessuna città o luogo → null. NON ripetere la città della riga "Città:" se la frase non la nomina.

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
 * @returns {Promise<object>}   { queries[], categoria, oggetto_umano, citta, vincoli };
 *                               T1b: `queries` puo' essere vuoto (_source 'ai-vuota')
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
    }, undefined, quota, 'traduttore');
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('translateIntentToQueries: no AI response');

    const parsed = JSON.parse(raw);
    // Sanitize per resistere a AI approssimativa.
    const queries = Array.isArray(parsed.queries) ? parsed.queries.filter(q => typeof q === 'string' && q.trim()).slice(0, 3) : [];
    const categoria = typeof parsed.categoria === 'string' && parsed.categoria.trim() ? parsed.categoria.trim() : 'misto';
    const oggetto_umano = typeof parsed.oggetto_umano === 'string' && parsed.oggetto_umano.trim() ? parsed.oggetto_umano.trim() : categoria;
    // T1 — la citta' nominata nella frase, o null.
    const citta = typeof parsed.citta === 'string' && parsed.citta.trim() && parsed.citta.trim().length <= 60 ? parsed.citta.trim() : null;
    const vincoliRaw = parsed.vincoli || {};
    const tempo = ['mattina', 'pomeriggio', 'sera', 'notte'].includes(vincoliRaw.tempo) ? vincoliRaw.tempo : null;
    const escludi = Array.isArray(vincoliRaw.escludi) ? vincoliRaw.escludi.filter(e => typeof e === 'string' && e.trim()).slice(0, 10) : [];
    const note = typeof vincoliRaw.note === 'string' && vincoliRaw.note.trim() ? vincoliRaw.note.trim().slice(0, 150) : null;

    const result = {
        queries,
        categoria,
        oggetto_umano,
        citta,
        vincoli: { tempo, escludi, note },
    };
    // T1b — zero query non e' piu' un errore: la frase porta ancora la citta'
    // e il motore cerca con le query di base (fetchRealPOICandidates). Una
    // traduzione vuota non si mette in cache: la prossima volta si riprova.
    // C10b2 — quale modello ha tradotto (e se ha ripiegato): nel tracciato, mai in cache
    const _modello = data?._modello ?? null;
    if (queries.length === 0) return { ...result, _source: 'ai-vuota', _modello };
    saveIntentToCache(key, result);
    return { ...result, _source: 'ai', _modello };
}

/**
 * T1 — dove si fa il tour: la citta' scritta nel testo vince sulla posizione.
 *
 *   1. T1b — il candidato si legge dal testo con regole fisse
 *      (extractCityCandidate: "a Roma", "Roma in una giornata", "Roma" da solo),
 *      senza dipendere dal traduttore; la `citta` del traduttore e' il secondo
 *      segnale, per quello che le regole non vedono (testo minuscolo, "il
 *      Colosseo" → Roma);
 *   2. "via Roma" / "piazza Roma" non sono Roma (isStreetMention);
 *   3. se la citta' e' diversa dalla posizione, UNA ricerca sul proxy dei
 *      luoghi la conferma (confirmCityFromText). Una seconda solo se il
 *      candidato del testo non e' una citta' e il traduttore ne propone
 *      un'altra; se nessuna e' sicura si resta sulla posizione e lo si dice.
 *
 * Il traduttore fallito per motivi suoi non blocca niente: le regole leggono
 * la citta' lo stesso, e il motore cerca con le query di base
 * (TRANSLATOR_FAILED). Quota esaurita e motore giu' arrivano alla UI.
 *
 * @returns {Promise<{ city: string, cityCenter: object|null, fromText: boolean, note: string|null, intent: object|null }>}
 */
export async function resolveTextDestination(userPrompt, positionCity, quota) {
    let intent = null;
    try {
        intent = await translateIntentToQueries(userPrompt, positionCity, quota);
    } catch (err) {
        if (mustReachUi(err)) throw err;
        console.warn(`[T1 citta'] traduttore fallito, la citta' si legge solo dal testo: ${err.message}`);
        intent = TRANSLATOR_FAILED;
    }
    const stay = (note = null) => ({ city: positionCity, cityCenter: null, fromText: false, note, intent });
    const fromRule = extractCityCandidate(userPrompt);
    const fromModel = intent?.citta && !isStreetMention(userPrompt, intent.citta) ? intent.citta : null;
    const named = [fromRule, fromModel].filter((c, i, all) => c && all.findIndex(x => sameCity(x, c)) === i);
    if (named.length === 0) return stay();

    const { confirmCityFromText } = await import('./cityCenterService');
    for (const name of named) {
        // Il testo nomina la posizione: si resta, senza cercare.
        if (sameCity(name, positionCity)) return stay();
        const found = await confirmCityFromText(name);
        if (!found.sure) {
            console.warn(`[T1 citta'] "${name}" (${name === fromRule ? 'regola' : 'traduttore'}) non confermata (${found.reason})`);
            continue;
        }
        if (sameCity(found.city, positionCity)) return stay();
        console.info(`[T1 citta'] dal testo: ${found.city} (${name === fromRule ? 'regola' : 'traduttore'}; posizione ${positionCity})`);
        return { city: found.city, cityCenter: found.center, fromText: true, note: destinationNote(found.city), intent };
    }
    console.warn(`[T1 citta'] nessuna citta' confermata: resto su ${positionCity}`);
    return stay(DESTINATION_UNSURE_NOTE);
}

// T1b — il traduttore e' caduto (rete, JSON) ma la generazione va avanti: la
// citta' la leggono le regole, i luoghi le query di base. Non ritraduce.
const TRANSLATOR_FAILED = Object.freeze({
    queries: [], categoria: 'misto', oggetto_umano: 'quello che hai chiesto', citta: null,
    vincoli: { tempo: null, escludi: [], note: null }, _source: 'error-translator',
});

// T1b — tappe totali di un risultato, e i `_source` che le pagine gia'
// trasformano nel messaggio onesto (AiItinerary, QuickPath, SurpriseTour).
const countStops = (r) => (Array.isArray(r?.days) ? r.days.reduce((n, d) => n + (Array.isArray(d?.stops) ? d.stops.length : 0), 0) : 0);
const EMPTY_SOURCES = new Set(['no-results', 'no-results-error', 'no-results-safety', 'search-error']);
const baseQueriesNote = (oggetto, city) => `Non ho trovato ${oggetto || 'quello che hai chiesto'}: ti propongo un giro di ${city}`;

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

// T1b — `baseQueries`: si cerca con le query di base della citta' (i temi di
// un tour senza testo, derivePrimaryThemes) anche se c'e' una frase. Succede
// quando il traduttore restituisce zero query, quando e' caduto prima
// (TRANSLATOR_FAILED) e nel secondo tentativo di una generazione rimasta vuota.
const fetchRealPOICandidates = async (cityName, cityCenter, prefs, userPrompt = '', quota = undefined, foodPrefs = null, presetIntent = null, baseQueries = false) => {
    // P7b — con una dieta, OGNI ricerca del cibo fatta qui porta il criterio:
    // le query del traduttore di tipo cibo (deriveKindFromQuery) e il tema
    // food del Percorso B. I risultati portano `_dietaCercata`.
    const dieta = foodPrefs?.dieta || [];
    const lat = cityCenter?.latitude;
    const lng = cityCenter?.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { candidates: [], intent: null };
    // C10b3 — in metropoli le ricerche partono dal quartiere scelto, col suo raggio come bias (non dal centro citta' a 20 km)
    const bias = Number.isFinite(cityCenter?.biasMeters) ? { radiusMeters: cityCenter.biasMeters } : {};
    // Import dinamico per rompere il ciclo aiRecomm → placesDiscovery → aiRecomm.
    const { placesDiscoveryService } = await import('./placesDiscoveryService');

    const isFreeText = !!(userPrompt && String(userPrompt).trim());
    let lists = [];
    let intent = null;

    if (isFreeText) {
        // Path A — Gate B: free-text guida la ricerca.
        try {
            // T1 — gia' tradotto da resolveTextDestination: niente seconda chiamata.
            // T1b — col secondo tentativo sulle query di base non si ritraduce.
            intent = presetIntent || (baseQueries ? TRANSLATOR_FAILED : await translateIntentToQueries(userPrompt, cityName, quota));
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
    }
    const useBase = isFreeText && (baseQueries || !intent.queries?.length);
    if (useBase) {
        // La categoria della frase non filtra un pool che la frase non ha cercato.
        console.info(`[T1b query di base] ${cityName}: ${baseQueries ? 'secondo tentativo' : 'traduttore senza query'} → temi di un tour senza testo`);
        intent = { ...intent, categoria: 'misto', _queryDiBase: true };
    }

    if (isFreeText && !useBase) {
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
                        cityName, lat, lng, null, { customQuery: fq, customKind, skipLegacyFallback: true, ...bias },
                    ), q, dieta).then(r => r.results).then(conRicerca(q));
                }
                return placesDiscoveryService.discoverRealPOIs(
                    cityName, lat, lng, null,
                    { customQuery: q, customKind, skipLegacyFallback: true, ...bias }
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
                    customQuery: fq, customKind: 'FOOD', ...bias,
                }), THEME_FOOD_QUERY, dieta).then(r => r.results).then(conTema(t))
                : placesDiscoveryService.discoverRealPOIs(cityName, lat, lng, t, { ...bias }).then(conTema(t)))),
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
// BORGO-FIX — `borgoNatura` (decisione 5: nel borgo 5 recensioni per natura e panorami) e `borgoPub` (decisione 4: nel borgo la
// ricerca mirata della sera aggiunge «pub» al testo).
const searchMomentCandidates = async ({ city, cityCenter, themes, known, dnaWeights, categoria, perTheme = 5, foodPrefs = null, foodAnchor = null, anchor = null, tipico = false, area = null, borgoNatura = null, borgoPub = false }) => {
    const { placesDiscoveryService, FOOD_QUERY_COLAZIONE, THEME_TEXTSEARCH } = await import('./placesDiscoveryService');
    const dieta = foodPrefs?.dieta || [];
    const at = (t) => {
        const a = anchor || (t === 'food' ? foodAnchor : null);
        // C10b — in una metropoli, senza una tappa da cui partire, si cerca nel quartiere della giornata (non dal centro città).
        return a
            ? { lat: a.latitude, lng: a.longitude, bias: { radiusMeters: MAX_WALK_METERS } }
            : area
                ? { lat: area.centro.latitude, lng: area.centro.longitude, bias: { radiusMeters: Math.round(area.raggioKm * 1000) } }
                : { lat: cityCenter.latitude, lng: cityCenter.longitude, bias: {} };
    };
    const settled = await Promise.allSettled(themes.map(t => (t === 'colazione'
        // C8c — la colazione chiesta: caffetterie, pasticcerie, forni (la query di Per Te prima delle 11:00)
        ? placesDiscoveryService.discoverRealPOIs(city, at(t).lat, at(t).lng, null, { customQuery: FOOD_QUERY_COLAZIONE, customKind: 'FOOD', ...at(t).bias })
        : t === 'food' && dieta.length > 0
        ? searchFoodWithDiet((fq) => placesDiscoveryService.discoverRealPOIs(city, at(t).lat, at(t).lng, null, {
            customQuery: fq, customKind: 'FOOD', ...at(t).bias,
        }), THEME_FOOD_QUERY, dieta).then(r => r.results)
        // BORGO-FIX — decisione 4: nel borgo la ricerca dei locali della sera chiede anche «pub» (Black & White non usciva da quella dei bar)
        : t === 'nightlife' && borgoPub
        ? placesDiscoveryService.discoverRealPOIs(city, at(t).lat, at(t).lng, null, { customQuery: `${THEME_TEXTSEARCH.nightlife.query} pub`, customKind: THEME_TEXTSEARCH.nightlife.kind, ...at(t).bias })
        // C7 — le esperienze servono a DUE momenti (mattina e pomeriggio): tutta la pagina di Google (20), non i primi 12.
        : placesDiscoveryService.discoverRealPOIs(city, at(t).lat, at(t).lng, t, { ...at(t).bias, ...(t === 'esperienze' ? { maxResults: 20 } : {}) }))
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
    // C10b — la giornata di una metropoli resta nel suo quartiere
    if (area) extra = extra.filter(c => dentroArea(c, area));
    if (categoria) extra = extra.filter(c => candidateMatchesIntentCategoria(c, categoria) || isMealPlace(c));
    if (foodPrefs) extra = applyFoodConstraints(extra, foodPrefs, isMealPlace).candidates;
    // C7 — le ESPERIENZE di mattina e pomeriggio (tema cibo) non sono ristoranti: un posto dove ci si
    // siede a mangiare trovato da quella ricerca non serve a nessun momento (pranzo e cena hanno il loro pool).
    extra = extra.filter(c => !(c._tema === 'esperienze' && isSitDownMeal(c)));
    // C7 — tipico: nei pasti niente cucine estere, e la spinta ai posti locali.
    if (tipico) extra = extra.filter(c => !(isMealPlace(c) && isForeignCuisine(c)));
    const bonus = (foodPrefs || tipico)
        ? (c) => (foodPrefs ? foodPrefBonus(c, foodPrefs, isMealPlace) : 0) + (tipico && isMealPlace(c) ? tipicoBonus(c, { dieta: foodPrefs?.dieta || [] }) : 0)
        : null;
    // C1b — la ricerca mirata dalla tappa prima torna pochi posti di un
    // quartiere: misurate su di loro, il piu' recensito sarebbe sempre
    // un'"icona" (con un solo risultato, sempre lui) e uscirebbe. Le icone si
    // misurano sulla citta' (tutti i candidati della generazione), come per
    // "Per Te" (rankByMerit, P7a2). Stessa soglia di qualita', zero icone.
    if (anchor) {
        const ok = extra.filter(c => passesQualityThreshold(c, city, { borgoNatura }));
        return rankByMerit(ok, { reference: [...known, ...ok], dnaWeights, maxIcons: 0, bonus }).slice(0, perTheme * themes.length);
    }
    // C8a — OGNI TEMA HA I SUOI POSTI. Con piu' temi insieme (bar, passeggiata, cena) i migliori per merito
    // erano scelti su tutti i temi in blocco: i bar e i ristoranti, molto recensiti, prendevano tutti i posti e i
    // luoghi all'aperto della passeggiata restavano fuori. Un tema solo: invariato.
    if (themes.length > 1) {
        const out = [];
        const taken = new Set();
        for (const t of themes) {
            const mine = extra.filter(c => c._tema === t);
            for (const c of selectScoredCandidatePool(mine, { city, dnaWeights, limit: perTheme, maxIcons: 0, bonus, borgoNatura })) {
                const id = c.place_id || c.googlePlaceId;
                if (id && taken.has(id)) continue;
                if (id) taken.add(id);
                out.push(c);
            }
        }
        return out;
    }
    return selectScoredCandidatePool(extra, {
        city, dnaWeights, limit: perTheme * themes.length, maxIcons: 0, bonus, borgoNatura,
    });
};

// P3 — il report della riparazione, in chiaro nei log (e in `_momentReport`).
const logMomentReport = (city, r) => {
    for (const m of r.momentiTolti) console.warn(`[P3 SCHELETRO] ${city}: momento ${m.momento} (${m.label}) TOLTO — ${m.motivo}`);
    for (const x of r.scartate) console.warn(`[P3 SCHELETRO] ${city}: scartata ${x.place_id} (${x.momento ?? '—'}) — ${x.motivo}`);
    for (const x of r.riempite) console.info(`[P3 SCHELETRO] ${city}: ${x.momento} riempito dal codice con "${x.name}" (merito)`);
    for (const x of r.tempoLibero || []) console.info(`[C5e TEMPO LIBERO] ${city}: ${x.momento} — ${x.motivo}`);
    for (const x of r.tolte) console.warn(`[P3 SCHELETRO] ${city}: tolta ${x.place_id} (${x.momento}) — ${x.motivo}`);
    for (const x of r.ripieghi || []) console.warn(`[C1 COMPOSIZIONE] ${city}: ripiego "${x.name}" (${x.momento}) — ${x.motivo}`);
    for (const x of r.ritocchi || []) console.info(`[C5 PERCORSO] ${city}: ${x.momento} "${x.name}" al posto di ${x.tolta} (sulla strada)`);
};

// Predicato pubblico — Exported per test. true = candidato ammesso per
// `categoriaRaw` (o nessun filtro stretto applicabile → sempre ammesso).
export const candidateMatchesIntentCategoria = (candidate, categoriaRaw) => {
    const target = CATEGORIA_TO_TOUR_CATEGORY[String(categoriaRaw || '').toLowerCase()];
    if (!target) return true;
    // TROINA-FIX — un monte, un belvedere, un parco non contrastano con «natura» perche' Google li segna anche
    // `tourist_attraction` (che CATEGORY_ALIASES porta a «cultura»): Monte Muganà a Troina usciva da ogni Quiz Natura.
    if (target === 'natura' && isNaturaOPanorama(candidate)) return true;
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
    // Le frasi le compone il codice (P3d-j, stopPhrases), DOPO che
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

// PER-TE-PROPOSTE — i tour «per dopo» senza AI: per ogni tema il codice prende i primi posti del pool (gia' ordinato per merito
// e DNA da prepareHomePools). Il titolo e' il dato nudo del tema (testi: PER_TE_TESTI).
// PER-TE-PROPOSTE — l'ora di una proposta «per dopo» e' esplicita (anche in produzione, dove simulatedNow e' ignorato).
const oraDiPerTe = (opts) => (opts?.oraRiferimento instanceof Date && !Number.isNaN(opts.oraRiferimento.getTime()) ? opts.oraRiferimento : requestNow(opts));
const TEMI_PER_DOPO = ['insider', 'food', 'cultura', 'romance', 'nature'];
const tourDaiPool = (pools, city) => TEMI_PER_DOPO
    .filter(t => Array.isArray(pools[t]) && pools[t].length > 0)
    .map(t => ({
        themeType: t,
        title: PER_TE_TESTI.titoloTema(t, city),
        stops: pools[t].slice(0, 4).map(c => ({ place_id: homePid(c) })).filter(st => st.place_id),
    }));


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

const buildUnifiedHomeToursPrompt = ({ city, timeContext, weather, prefs, aiProfile, themedCandidates, interessi = [] }) => {
    // P3d-j — gli interessi dell'utente, chiusi (chiavi di stopPhrases.INTERESSI).
    const interessiLabel = interessi.length ? interessi.map(k => `"${k}"`).join(', ') : 'nessuno (allora null)';
    const groupLabel = prefs?.group || 'chiunque';
    const transitHint = prefs?.pace === 'intenso' ? 'con qualche mezzo' : 'a piedi';
    // Gate PER TE — via la frase "Tutte le tappe devono restare entro N km":
    // il modello non riceve coordinate e non poteva verificarla. La distanza
    // la decide il codice prima del prompt (prepareHomePools).

    // Meta per tema: titolo suggerito + focus categoria (per aiutare l'AI a
    // non mescolare cibo in un tour cultura).
    const themeMeta = {
        insider: { titleHint: `Titolo evocativo unico, DERIVATO dalle tappe che hai scelto: deve poter valere solo per QUESTE tappe, non per un altro tour di ${city}. Forma "<aggettivo/immagine> <sostantivo> di ${city}", mai "Tour di ${city}". NON riusare formule gia' sentite: inventane una da queste tappe.`, focus: 'perla nascosta, mix di categorie che raccontano l\'anima della citta\', prima tappa NON e\' il monumento piu\' famoso' },
        food:    { titleHint: `Titolo tipo "A tavola a ${city}" o "Street food di ${city}"`, focus: 'ristoranti, trattorie, mercati, gelaterie, caffe\' — SOLO tappe food' },
        cultura: { titleHint: `Titolo tipo "Tesori di ${city}" o "Storia di ${city}"`, focus: 'chiese, musei, palazzi, monumenti, piazze storiche — SOLO tappe cultura/storia/arte' },
        romance: { titleHint: `Titolo tipo "Vista mare a ${city}" o "${city} dall'alto"`, focus: 'lungomari, panorami, belvederi, giardini romantici, scalinate scenografiche' },
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
${realWeather(weather) ? `• meteo: ${weather.condition} ${weather.temperature}°\n` : ''}${aiProfile ? `• profilo utente: ${aiProfile}` : ''}

REGOLE:
1. SCELTA — per ogni tour, scegli ${HOME_TOUR_STOPS.min}-${HOME_TOUR_STOPS.max} tra i SUOI candidati (quelli piu' adatti a orario e gruppo).
2. ORDINE — costruisci un percorso che ${transitHint} abbia senso NARRATIVO, non solo geometrico.
3. SCELTE — NON scrivi testo per le tappe: le frasi le compone il codice, con dati veri.
   Per ogni tappa scegli soltanto:
   • usaFatto: true se per quel posto vorresti aprire con un fatto vero (Wikipedia), false se no;
   • gancio: uno fra "legame", "distanza", "prima", "ultima", oppure null
     ("prima" e "ultima" aprono e chiudono il giro; "legame" solo con un interesse);
   • interesse: uno di questi interessi dell'utente, oppure null: ${interessiLabel}.

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
- Se un tour non ha 3 candidati adatti al contesto, meglio 2-3 tappe che tappe inventate.

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
        "usaFatto": true,
        "gancio": "legame|distanza|prima|ultima" oppure null,
        "interesse": "uno degli interessi elencati" oppure null,
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
            title: senzaEscape(c.name),
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
            // ORARI — solo se la ricerca nuova li ha portati (con la vecchia l'oggetto
            // resta com'era): servono a controllare la tappa quando ci si arriva.
            ...(Array.isArray(c.openingPeriods) ? { openingPeriods: c.openingPeriods } : {}),
            ...(Number.isFinite(c.utcOffsetMinutes) ? { utcOffsetMinutes: c.utcOffsetMinutes } : {}),
            ...(c.currentHours ? { currentHours: c.currentHours } : {}),
            ...(c.primaryType ? { primaryType: c.primaryType } : {}),
            // C6a — il nome mostrato e' gia' pulito; l'originale resta per il tracciato.
            ...(c.nameOriginal ? { nameOriginal: c.nameOriginal } : {}),
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
            // P3d-j — una tappa composta dal codice ha gia' passato la rete
            // (e il fatto, esente dalle parole vietate, qui verrebbe tolto).
            if (st._comp) return st;
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

/** P3d-g — il titolo del luogo di cui parlano i fatti (Pincio per la Terrazza del Pincio). */
const factsAbout = (entry) => (entry?.fonti || []).find(f => f?.fonte === 'wikipedia' || f?.fonte === 'wikidata')?.titolo || null;

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

// ─── P3d-j — Il modello sceglie, il codice scrive ───────────────────────────
//
// Il narratore non scrive piu' testo per le tappe. Per ognuna riceve le opzioni
// VERE (il fatto, se c'e'; i ganci validi; gli interessi dell'utente che
// valgono per quel posto) e sceglie: usaFatto, gancio, interesse. La frase la
// compone il codice (src/lib/stopPhrases.js) con le frasi approvate; i
// controlli esistenti restano come rete sul testo composto. Niente riscrittura:
// una scelta fuori elenco ha la sua riserva in codice, non un secondo giro.
// Le scelte restano sulla tappa (_comp): a ogni lettura dalla cache la frase si
// ricompone con gli orari di adesso.

/**
 * Il meteo vero, o niente: mai un "Soleggiato, 22°" di riserva. TESTI — la condizione si dice in italiano
 * ("sereno", "nuvoloso", "pioggia"); una condizione senza traduzione non si scrive, resta la temperatura.
 */
const realWeather = (weather) => {
    const condition = typeof weather?.condition === 'string' ? weather.condition.trim() : '';
    const temperature = Number(weather?.temperature);
    if (!condition || weather?.temperature == null || !Number.isFinite(temperature)) return null;
    return { condition: weatherLabel(condition), temperature, icon: weatherIconOf(condition) };
};

/**
 * TESTI (decisione di Ivano) — il meteo di adesso vale solo per un tour di oggi: su un giorno futuro
 * non si scrive il meteo (non e' quello di quel giorno).
 * @param {object} weather il meteo di adesso
 * @param {{ date?: string }|undefined} window la finestra del giorno del tour (data ISO di Roma)
 * @param {Date} requestTime l'istante della richiesta
 */
const weatherForDay = (weather, window, requestTime) => {
    const p = romeParts(requestTime);
    const oggi = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
    return window?.date === oggi ? realWeather(weather) : null;
};

/**
 * C5e (O) — le voci "tempo libero" del report della scelta, messe nel loro
 * giorno (windowIndex) prima della prima tappa di un momento successivo.
 */
const MOMENT_ORDER = new Map(MOMENTS.map((m, i) => [m.key, i]));
const insertFreeTime = (days, entries) => {
    if (!Array.isArray(entries) || entries.length === 0) return days;
    return (days || []).map((day, di) => {
        const dayIndex = Number.isFinite(day.windowIndex) ? day.windowIndex : di;
        let stops = [...(day.stops || [])];
        for (const e of entries.filter(x => x.dayIndex === dayIndex)) {
            // CONTINUITA' — un buco e' ancorato alla tappa che lo segue; le altre righe vanno prima del momento dopo.
            const anchor = e.prima ? stops.findIndex(st => st.place_id === e.prima) : -1;
            const at = e.colazione ? 0 : anchor >= 0 ? anchor : stops.findIndex(st => (MOMENT_ORDER.get(st.moment) ?? -1) > (MOMENT_ORDER.get(e.key) ?? 99));
            const item = freeTimeStop({
                // ORARI — un pasto senza nessun locale aperto ha la sua riga dichiarata; il resto e' tempo libero (regola O).
                moment: e.key, momentLabel: e.label, description: e.chiuso && e.pasto ? TESTO_NESSUN_LOCALE_APERTO : composeFreeTime({ momento: e.key }),
                tracciato: { scelta: 'tempo libero', minuti: null, famiglia: null, motivo: e.motivo, piuVicino: e.piuVicino, ...(e.buco ? { buco: e.buco } : {}) },
            });
            stops = at < 0 ? [...stops, item] : [...stops.slice(0, at), item, ...stops.slice(at)];
        }
        // CONTINUITA' — il tempo libero occupa il suo tempo (la fascia e' l'attesa che prima stava sulla tappa dopo).
        return { ...day, stops: bandFreeTime(stops) };
    });
};

/** Il contesto di composizione di ogni tappa, sugli orari di adesso. */
// BORGO-SCHERMO — `giornata: false` (il giro della sera di Per Te, il tour misto del borgo): niente «Qui la giornata si chiude».
// «Si comincia da qui»: la distanza (m) fra la posizione dell'utente e la tappa; null se una delle due non si conosce.
const distanzaDaUtenteM = (utente, s) => {
    const la = utente?.latitude ?? utente?.lat, lo = utente?.longitude ?? utente?.lng;
    const sl = s?.latitude ?? s?.lat, sg = s?.longitude ?? s?.lng;
    return [la, lo, sl, sg].every(Number.isFinite) ? haversineKm(la, lo, sl, sg) * 1000 : null;
};
const composeContexts = (days, { starts, tourWindow, cityCenter, facts = new Map(), giornata = true, utente = null }) => {
    const timed = refreshTourScheduledTimes(days, starts);
    return (days || []).map((day, di) => {
        const sun = sunForDay(day, di, tourWindow, cityCenter);
        const stops = day.stops || [];
        // C5e — il tempo libero non e' la prima ne' l'ultima tappa del giorno.
        const vere = stops.filter(x => !x.tempoLibero);
        return {
            sun,
            stops: stops.map((s, si) => {
                const iso = timed[di]?.stops?.[si]?.scheduledTime;
                const arrival = iso ? new Date(iso) : null;
                const p = arrival ? romeParts(arrival) : null;
                const entry = facts.get(s.place_id);
                const fatti = s._comp?.fatti ?? (entry?.fatti || []);
                const fattiSu = s._comp?.fattiSu ?? factsAbout(entry);
                const d = stopData({
                    stop: s,
                    momento: s.moment || (p ? momentAtClock(p.h, p.mi).key : null),
                    orario: arrival ? clockLabel(arrival) : null,
                    tramonto: clockLabel(sun.sunset),
                    minutiDaPrima: s.travelMinutesFromPrev,
                    locale: isLocaleStop(s),
                    priceLevel: Number.isFinite(s.priceLevel) ? s.priceLevel : null,
                    fatti,
                    primo: s === vere[0],
                    distanzaUtenteM: s === vere[0] ? distanzaDaUtenteM(utente, s) : null,
                    ultimo: s === vere[vere.length - 1],
                    giornata,
                });
                return { d, arrival, fatti, fattiSu, fonti: s._comp?.fonti ?? (entry?.fonti || []) };
            }),
        };
    });
};

/** Il giro del giorno comincia dalle 21:30 in poi (o prima dell'alba)? Lo dice l'arrivo alla sua prima tappa vera. */
const giroDopocena = (ctx, day) => {
    const i = (day?.stops || []).findIndex(st => !st.tempoLibero);
    const arrival = i >= 0 ? ctx?.stops?.[i]?.arrival : null;
    if (!arrival) return false;
    const p = romeParts(arrival);
    return isDopocenaClock(p.h * 60 + p.mi);
};

/**
 * Compone tutte le descrizioni. `scelte`: place_id → { usaFatto, gancio,
 * interesse } dal modello (o, dalla cache, quelle salvate in _comp).
 * @returns {{ days: Array, report: Array }}
 */
const composeDays = (days, { starts, tourWindow, cityCenter, facts, scelte = new Map(), interessi = [], voce = {}, utente = null }) => {
    const ctxs = composeContexts(days, { starts, tourWindow, cityCenter, facts, utente });
    const report = [];
    // TESTI — nello stesso tour nessuna frase uguale due volte (nome e numeri mascherati, come il controllo c7).
    const usate = new Set();
    const out = (days || []).map(({ titoloCodice, ...day }, di) => ({
        ...day,
        // TESTI — un giro che comincia dalle 21:30 non e' un aperitivo (la sezione si chiama «Dopocena»): il titolo non lo dice.
        ...(giroDopocena(ctxs[di], day) && /\baperitiv\w*/i.test(day.title || '') && titoloCodice ? { title: titoloCodice } : {}),
        stops: (day.stops || []).map((s, si) => {
            // C5e — il tempo libero ha gia' il suo testo, composto dal codice.
            if (s.tempoLibero) return s;
            const c = ctxs[di].stops[si];
            const ints = s._comp?.interessi ?? interessi;
            const scelta = scelte.get(s.place_id) ?? s._comp?.scelta ?? {};
            const r = guardComposed(c.d, scelta, {
                interessi: ints, arrival: c.arrival, sunrise: ctxs[di].sun.sunrise, sunset: ctxs[di].sun.sunset,
                fatti: c.fatti, fattiSu: c.fattiSu, voce, evita: usate,
            });
            registraFrasi(usate, r.text, c.d.nome);
            report.push({
                place_id: s.place_id, title: s.title, scelta, usaFatto: r.composta.usaFatto, gancio: r.composta.gancio,
                interesse: r.composta.interesse, riserva: r.composta.riserva, rete: r.rete.map(x => x.frase), description: r.text,
            });
            return {
                ...s,
                description: r.text,
                insiderTip: null, bestTime: null, transition: null,
                // Le fonti solo se la frase usa il fatto.
                fonti: r.composta.usaFatto && c.fonti.length > 0 ? c.fonti : null,
                _comp: { scelta, fatti: c.fatti, fattiSu: c.fattiSu, fonti: c.fonti, interessi: ints },
            };
        }),
    }));
    return { days: out, report };
};

// P3d-j (chiusura) — prova reale: "Soleggiato percorso di Roma" senza nessun
// meteo, "Vivace Mattina di Catania" per un giorno intero. Il titolo non dice
// ne' il meteo ne' un momento della giornata: non li conosce, o non valgono
// per tutto il giorno (o per il tour "Per Te").
const TITOLO_VIETATO = /\b(sol[ei]\w*|soleggiat\w*|assolat\w*|sereno|seren[ia]|pioggi\w*|piovos\w*|nuvol\w*|nebbi\w*|vent\w*|calda?|caldo|fredd\w*|mattin\w*|pomerigg\w*|ser[ae]\w*|nott\w*|notturn\w*|tramont\w*|alba|albe|aurora|crepuscol\w*)\b/i;
/** Il titolo del giorno, se il modello ne ha dato uno pulito; senno' quello del codice. */
const dayTitle = (raw, fallback, { unGiorno = false, dopocena = false } = {}) => {
    const t = cleanText(senzaEscape(typeof raw === 'string' ? raw : ''));
    if (!t || t.length > 80 || TITOLO_VIETATO.test(t)) return fallback;
    // Un tour di un giorno non ha il numero del giorno ("Giorno 1 a Troina" per un giro di 1h22).
    if (unGiorno && /\bgiorno\s*\d/i.test(t)) return fallback;
    // Un giro che comincia dopo le 21:30 non e' un aperitivo (la sezione si chiama «Dopocena»): il titolo non lo dice.
    if (dopocena && /\baperitiv\w*/i.test(t)) return fallback;
    // Controllo schermate: "Elegante piazza di Roma". Un giudizio nel titolo
    // non e' sostenuto da nessun fatto, come nelle descrizioni.
    if (unsupportedJudgments(t, '', []).length > 0) return fallback;
    const r = filterBannedWords(t);
    return r.removed.length === 0 ? t : fallback;
};

export const buildChooserSystemPrompt = ({ city }) => `Sei la voce di Unnivai a ${city}. Le tappe sono GIÀ decise e le frasi le scrive il codice.
Tu SCEGLI soltanto, per ogni tappa, fra le opzioni che ricevi. Non scrivi testo per le tappe.

Di ogni tappa ricevi: place_id, nome, momento, "apertura" (la frase che il codice userà se non usi il fatto),
"fatto" (una frase vera da Wikipedia, oppure null), "ganci" (le seconde frasi possibili, già vere)
e "interessi" (gli interessi dell'utente che valgono per QUEL posto, forse vuoto).

Per ogni tappa scegli:
• usaFatto: true se il fatto è concreto (date, autori, misure, origine del nome) e parla di quel posto; false se no, o se è null.
• gancio: UNO di "ganci" (copia la parola), oppure null. Preferisci "tramonto" quando c'è; "legame" solo con un interesse;
  "prima" e "ultima" aprono e chiudono la giornata. Non usare lo stesso gancio su tutte le tappe.
• interesse: uno di "interessi" se il gancio è "legame", altrimenti null.

Per ogni giorno scrivi anche il titolo: nasce dalle TAPPE del giorno, deve valere solo per quel giorno,
forma "<aggettivo/immagine> <sostantivo> di ${city}", mai "Tour di ${city}", al massimo 60 caratteri.
Nel titolo MAI il meteo (sole, pioggia…) né un momento della giornata (mattina, sera, tramonto…).
Parole vietate nel titolo: ${bannedWordsPromptLines()}

Rispondi in JSON puro:
{ "days": [ { "day": 1, "title": "...", "mapMood": "romantico|storia|avventura|natura|cibo|shopping|arte|sorpresa|sport",
  "suggestedTransit": "walking|bus|metro",
  "stops": [ { "place_id": "...", "usaFatto": true, "gancio": "tramonto", "interesse": null } ] } ] }`;

/**
 * La terza chiamata, a scelta chiusa. Non lancia mai, tranne per la quota: un
 * modello caduto lascia al codice tutte le scelte (riserva), e lo dice.
 */
const chooseStopHooks = async ({ city, days, ctxs, interessi, quotaTicket }) => {
    const giorni = (days || []).map((d, di) => ({
        giorno: di + 1,
        tappe: (d.stops || []).map((s, si) => {
            const sd = ctxs[di].stops[si].d;
            const ap = apertura(sd);
            const ints = interessiPerTappa(sd, interessi);
            return {
                place_id: s.place_id, nome: sd.nome, momento: sd.momento, apertura: ap, fatto: sd.fatto,
                ganci: [...ganciValidi(sd, { aperturaTesto: ap, interesse: ints[0] || null }).keys()],
                interessi: ints,
            };
        }),
    }));
    const n = giorni.reduce((a, g) => a + g.tappe.length, 0);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);
    try {
        const data = await callOpenAIProxy({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: buildChooserSystemPrompt({ city }) },
                { role: 'user', content: `Scegli per tutte le ${n} tappe, con il loro place_id.\nTAPPE:\n${JSON.stringify(giorni)}` },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 1200,
        }, controller.signal, quotaTicket, 'narratore');
        clearTimeout(timeoutId);
        const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
        const meta = Array.isArray(parsed?.days) ? parsed.days : [];
        const byId = new Map();
        for (const d of meta) {
            for (const st of (Array.isArray(d?.stops) ? d.stops : [])) {
                if (st?.place_id && !byId.has(st.place_id)) {
                    byId.set(st.place_id, { usaFatto: st.usaFatto, gancio: st.gancio, interesse: st.interesse ?? null });
                }
            }
        }
        return { byId, meta, giorni, error: null };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof AiQuotaExceededError) throw err;
        const msg = err?.name === 'AbortError' ? 'timeout' : (err?.message || String(err));
        console.warn(`[P3d-j SCELTE] ${city}: scelte del modello non arrivate (${msg}) → riserva del codice su tutte le tappe`);
        return { byId: new Map(), meta: [], giorni, error: msg };
    }
};

/** Titolo, mappa e trasporto del giorno dalle scelte del modello. */
const giornoTitle = (di, city, nGiorni) => (nGiorni > 1 ? `Giorno ${di + 1} a ${city}` : `Il tuo giro a ${city}`);
const applyDayMeta = (days, meta, city) => days.map((day, di) => {
    const m = meta[di] || {};
    return {
        ...day,
        title: dayTitle(m.title, day.title || giornoTitle(di, city, days.length), { unGiorno: days.length <= 1 }),
        // il titolo del codice: composeDays lo rimette se il giro comincia dopo le 21:30 e il titolo dice «aperitivo»
        titoloCodice: day.title || giornoTitle(di, city, days.length),
        suggestedTransit: VALID_TRANSIT.has(m.suggestedTransit) ? m.suggestedTransit : (day.suggestedTransit || 'walking'),
        mapMood: VALID_MOODS.has(m.mapMood) ? m.mapMood : (day.mapMood || 'default'),
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
    // T1 — in "Crea il tuo percorso" la citta' scritta nel testo vince sulla
    // posizione (resolveTextDestination). Il risultato porta `destination`:
    // { city, fromText, note } — la pagina mostra la nota in testa al tour e
    // usa quella citta' per mappa, messaggi e rigenerazione.
    async generateItinerary(city, prefs = {}, userPrompt = '', weather = {}, aiProfile = '', cityCenter = null, opts = {}) {
        // Un biglietto solo: il traduttore chiamato qui, il selettore dopo e il
        // secondo tentativo (T1b) sono la stessa generazione.
        const quotaTicket = opts.quotaTicket || newGenerationTicket('itinerary');
        // GIRO-LONTANO — in Crea (solo lì: gli altri percorsi partono da dove sei) la posizione dell'utente (`opts.posizioneUtente`,
        // null se non c'e') decide la partenza quando il testo non dice un orario: lontano dal centro della citta' del giro (oltre
        // 20 km) o senza posizione → domani alle 9:30; in citta' → da adesso piu' il cammino fino alla tappa 1 (_partenzaDalCammino).
        // La posizione non entra mai nella scelta delle tappe (il centro resta quello della citta').
        // Vale solo se chi chiama passa `posizioneUtente` (AiItinerary la passa sempre, null se non c'e'): banco, replay e rigenerazione
        // del giorno, che non la passano, restano com'erano.
        const crea = opts.pathType === 'custom';
        const conPosizione = crea && Object.prototype.hasOwnProperty.call(opts, 'posizioneUtente');
        const conPartenza = (centro, o) => (conPosizione ? { ...o, lontano: distanzaDalGiro(opts.posizioneUtente, centro).lontano } : o);
        const partenza = (result, args) => (conPosizione ? this._partenzaDalCammino(result, args) : result);
        if (!crea || !String(userPrompt || '').trim()) {
            const args = [city, prefs, userPrompt, weather, aiProfile, cityCenter, conPartenza(cityCenter, { ...opts, quotaTicket })];
            return partenza(await this._neverEmpty(await this._generateItinerary(...args), args), args);
        }
        const dest = await resolveTextDestination(userPrompt, city, quotaTicket);
        const centroGiro = dest.fromText ? dest.cityCenter : cityCenter;
        const args = [
            dest.city, prefs, userPrompt, weather, aiProfile, centroGiro,
            conPartenza(centroGiro, { ...opts, quotaTicket, presetIntent: dest.intent }),
        ];
        const result = await partenza(await this._neverEmpty(await this._generateItinerary(...args), args), args);
        // T1b — un tour sulle query di base al posto di quello chiesto lo dice.
        const baseNote = result?._queryDiBaseDopoVuoto ? baseQueriesNote(result._oggettoChiesto, dest.city) : null;
        const note = [dest.note, baseNote].filter(Boolean).join(' · ') || null;
        const destination = { city: dest.city, fromText: dest.fromText, note, cityCenter: dest.fromText ? dest.cityCenter : cityCenter };
        return result && typeof result === 'object' && !Array.isArray(result) ? { ...result, destination } : result;
    },

    // GIRO-LONTANO — in citta' e senza orario scritto il giro non parte «adesso» alla tappa 1: parte adesso piu' il cammino fino a li'.
    // La tappa 1 si conosce solo dopo la scelta: gli orari si spostano con lo stesso ricalcolo della cache (G1.1: la finestra di chi
    // legge + gli offset salvati, frasi ricomposte), mai con una seconda generazione (`soloCache`: se il giro non e' in cache resta
    // com'e'). Da lontano la finestra e' gia' domani alle 9:30 e il risultato lo dice in `_partenza`.
    async _partenzaDalCammino(result, args) {
        const opts = args[6] || {};
        if (!result || typeof result !== 'object' || Array.isArray(result) || countStops(result) === 0) return result;
        if (opts.lontano) return result.tourWindow?.reason === 'lontano' ? { ...result, _partenza: { domani: true } } : result;
        if (result.tourWindow?.reason !== 'now') return result;
        const minuti = minutiFinoAllaTappa(opts.posizioneUtente, primaTappaDelGiro(result));
        if (!Number.isFinite(minuti) || minuti < 1) return result;
        let spostato = null;
        try {
            spostato = await this._generateItinerary(...args.slice(0, 6), {
                ...opts, ritardoMinuti: minuti, soloCache: true, skipUserQuota: true, baseQueries: !!result._queryDiBaseDopoVuoto || !!opts.baseQueries,
            });
        } catch (err) {
            console.warn('[GIRO-LONTANO] ricalcolo della partenza non riuscito, orari di prima:', err?.message || err);
        }
        if (!spostato || countStops(spostato) === 0) return result;
        return { ...result, ...spostato, _partenza: { daAdesso: true, camminoMinuti: minuti } };
    },

    // T1b — mai un tour vuoto a schermo. Se una generazione arriva a 0 tappe
    // (traduttore caduto, query senza risultati, tutto filtrato) si riprova UNA
    // volta con le query di base della citta', sullo stesso biglietto e senza
    // ritradurre. Se resta vuota, torna il risultato vuoto di prima con un
    // `_source` che ogni pagina gia' trasforma nel messaggio onesto
    // ("A <citta'> non troviamo …"): nessuna pagina mostra un tour senza tappe.
    async _neverEmpty(result, args) {
        if (!result || typeof result !== 'object' || Array.isArray(result) || countStops(result) > 0) return result;
        // ORARI — "quasi tutto chiuso" non e' un giro andato a vuoto: con le query di base si troverebbero gli stessi posti chiusi.
        if (result._source === 'closed-now') return result;
        const [city, , , , , , opts] = args;
        console.warn(`[T1b mai vuoto] ${city}: 0 tappe (${result._source || '?'}) → secondo tentativo con le query di base`);
        let retry = null;
        try {
            // Stessa generazione: il preflight della quota non si ripete (il
            // contatore e' gia' salito col primo tentativo), il tetto vero resta
            // sul server col biglietto.
            retry = await this._generateItinerary(...args.slice(0, 6), {
                ...opts, baseQueries: true, skipUserQuota: true,
                presetIntent: opts.presetIntent || TRANSLATOR_FAILED,
            });
        } catch (err) {
            console.warn(`[T1b mai vuoto] ${city}: secondo tentativo fallito (${err?.code || err?.message}) → messaggio onesto`);
        }
        if (retry && countStops(retry) > 0) {
            const chiesto = (result._query || []).length > 0;
            return { ...retry, ...(chiesto ? { _queryDiBaseDopoVuoto: true, _oggettoChiesto: result._oggetto_umano || null } : {}) };
        }
        console.warn(`[T1b mai vuoto] ${city}: vuoto anche con le query di base → messaggio onesto`);
        return EMPTY_SOURCES.has(result._source) ? result : { ...result, days: [{ stops: [] }], _source: 'no-results' };
    },

    async _generateItinerary(city, prefs = {}, userPrompt = '', weather = {}, aiProfile = '', cityCenter = null, opts = {}) {
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
        const requestTime = requestNow(opts);
        const tourWindow = resolveTourWindow({
            text: userPrompt, requestTime, pathType: opts.pathType, duration: prefs?.duration, lontano: !!opts.lontano,
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
            + '_' + centerFingerprint + '_' + tourWindow.date + '_' + firstMoment.key
            // T1b — il secondo tentativo sulle query di base ha la sua voce.
            + (opts.baseQueries ? '_base' : '');
        const windowFields = {
            startTimeAnchored: tourWindow.anchored,
            shiftedToNextDay: tourWindow.shiftedToNextDay,
            tourWindow,
        };

        // GIRO-LONTANO — la partenza spostata del cammino fino alla tappa 1: la chiave di cache resta quella della finestra «da adesso»
        // (stesso giro), cambiano solo l'inizio e quindi gli orari ricalcolati qui sotto.
        if (Number.isFinite(opts.ritardoMinuti) && opts.ritardoMinuti > 0) {
            tourWindow.start = new Date(tourWindow.start.getTime() + opts.ritardoMinuti * 60000);
            if (tourWindow.windows?.[0]) tourWindow.windows[0] = { ...tourWindow.windows[0], start: tourWindow.start };
        }
        const cached = loadInsiderFromCache(cacheKey);
        if (!cached && opts.soloCache) return null;
        if (cached) {
            // G1.1 — un tour da cache non porta con sé l'orario calcolato alla
            // generazione: si ricalcola SEMPRE dalla finestra di CHI STA
            // LEGGENDO ora, sommando gli offset già salvati
            // (stayMinutes/travelMinutesFromPrev su ogni stop).
            // Gate NARRATORE-DOPO — e il controllo luce/ora rigira su quegli
            // orari: stessa data e stessa fascia, ma i minuti possono essere altri.
            const starts = dayStartsFor(cached.days, tourWindow);
            // P3d-j — la frase si ricompone con le scelte salvate e gli orari di adesso.
            const { days } = composeDays(cached.days, { starts, tourWindow, cityCenter });
            return { ...cached, ...windowFields, days: refreshTourScheduledTimes(days, starts) };
        }

        // DVAI-050 — Cache MISS: quota giornaliera utente (10/day).
        // Gate QUOTA-SERVER — qui solo il preflight in lettura; il conteggio lo
        // fa openai-proxy sul biglietto. opts.skipUserQuota salta solo il preflight.
        if (!opts.skipUserQuota) {
            await assertQuotaAvailable();
        }
        const quotaTicket = opts.quotaTicket || newGenerationTicket('itinerary');
        // C10 — la lista della città parte SUBITO, in parallelo al traduttore e alle ricerche: una per città e giorno del
        // tour, uguale per tutti (la prima richiesta del giorno la fa nascere sul server, le altre la leggono).
        const cittaT0 = Date.now();
        const cittaPromise = opts.cityKnowledge === false
            ? Promise.resolve({ stato: 'spenta', verificati: [] })
            : fetchCityKnowledge(city, tourWindow.date).catch(err => ({ stato: 'assente', verificati: [], errore: String(err?.message || err) }));
        const cittaReport = { stato: 'in attesa' };
        // C10b2 — il modello di ogni passaggio di questo giro (e se ha ripiegato su quello di prima)
        const modelliReport = { lista: null, quartiere: null, traduttore: null, selettore: null };

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
        // TROINA-FIX — «non troviamo» solo se la ricerca e' riuscita e i posti sono davvero zero (esitoVuoto.js): lo dice qui
        // il motore, nel ramo dei zero candidati, e solo se anche la lista della citta' e' arrivata (o e' spenta).
        let zeroVero = false;
        try {
            // C10 — i posti verificati della lista entrano nel pool come risultati di ricerca: da qui passano per gli stessi
            // filtri di tutti (zone, raggio, categoria, dieta e budget, cucine estere col tema tipico).
            // C10b3 — la lista PRIMA delle ricerche: in metropoli le ricerche iniziali partono dal quartiere scelto (decisione di
            // Ivano). Con la lista gia' fatta (dal server) l'attesa e' di un secondo; la prima lista del giorno la si aspettava gia'.
            const lista = await cittaPromise;
            const { buildPOIFromCandidate } = await import('./placesDiscoveryService');
            let poiCitta = poiDallaLista(lista.verificati, city, buildPOIFromCandidate);
            modelliReport.lista = lista.modelli ?? null;
            Object.assign(cittaReport, {
                stato: lista.stato, cached: lista.cached ?? null, conti: lista.conti ?? null, errore: lista.errore ?? null,
                attesaMs: Date.now() - cittaT0, risposta: lista.ms ?? null, costo: lista.costo ?? null,
                verificati: poiCitta.map(p => ({ place_id: p.place_id, nome: p.name, tipo: p._citta.tipo, momento: p._citta.momento,
                    ...(p._citta.quartiere ? { quartiere: p._citta.quartiere } : {}), ...(p._citta.simbolo ? { simbolo: true } : {}) })),
            });
            // C10b — TRE SCALE (decisione di Ivano): l'AI propone, il motore conferma col diametro della lista.
            //   borgo con meno di 4 verificati → giro corto (C10b2: la durata segue le tappe), con la riga approvata;
            //   metropoli → la giornata in un quartiere, o (C10b2, giornata intera) mattina e pomeriggio in due quartieri vicini.
            let area = null;
            // C10c — il nucleo del quartiere chiesto: le visite e il pranzo stanno li'
            let nucleo = null;
            let scalaNote = null;
            let sosteDnaReport = null; // DNA-3b
            let ordinePercorsoReport = null; // NAV-2
            let esclusioneNote = null; // DNA-3b: «Ho tolto le chiese come chiesto: il giro è più corto.»
            let conferma = null;
            const w0 = tourWindow.windows[0];
            const minuti0 = w0 ? (w0.end.getTime() - w0.start.getTime()) / 60000 : 0;
            if (poiCitta.length > 0) {
                conferma = scalaConfermata({ proposta: lista.scala ?? null, poi: poiCitta });
                cittaReport.scala = conferma;
                cittaReport.simboli = poiCitta.filter(p => p._citta.simbolo)
                    .map(p => ({ nome: p.name, ...(p._citta.quartiere ? { quartiere: p._citta.quartiere } : {}), ...(p._citta.simboloDedotto ? { dedotto: true } : {}) }));
                // C10b2 — nel borgo: i nomi di Google accettati per la stessa categoria (scritti nel tracciato)
                const sostituzioni = poiCitta.filter(p => p._citta.sostituzione).map(p => p._citta.sostituzione);
                if (sostituzioni.length) cittaReport.sostituzioni = sostituzioni;
                const unGiorno = tourWindow.windows.length === 1;
                const testoQ = opts.pathType === 'custom' ? userPrompt : '';
                const intera = minuti0 >= GIORNATA_INTERA_MINUTI;
                let sq = null;
                if (conferma.scala === 'metropoli' && unGiorno) {
                    const testo = testoQ;
                    const scegli = () => scegliQuartiere({
                        poi: poiCitta, testo, partenza: opts.startPoint || cityCenter, finestre: tourWindow.windows, dueQuartieri: intera,
                    });
                    sq = scegli();
                    // C10b2 — un quartiere CHIESTO con meno di 3 luoghi da visitare in lista: la sua lista dedicata (6–8 luoghi, verificati)
                    if (sq.quartiere && sq.motivo === 'nominato nella richiesta' && sq.quartiere.daVisitare.length < LUOGHI_QUARTIERE_MIN) {
                        const lq = await fetchQuartiereKnowledge(city, tourWindow.date, sq.quartiere.nome)
                            .catch(err => ({ stato: 'assente', verificati: [], errore: String(err?.message || err) }));
                        modelliReport.quartiere = lq.modelli ?? null;
                        // un quartiere chiesto vale: i suoi luoghi da visitare sono le ancore candidate della giornata (al massimo 3 per
                        // giornata intera, una per famiglia, il simbolo per primo: le regole di poolConLista e seminaAncore)
                        const poiQ = poiDallaLista(lq.verificati, city, buildPOIFromCandidate)
                            .map(p => ({ ...p, _citta: { ...p._citta, quartiere: sq.quartiere.nome, tipo: 'essenziale', ...(p._citta.tipo !== 'essenziale' ? { daListaQuartiere: true } : {}) } }));
                        const gia = new Set(poiCitta.map(p => p.place_id));
                        const nuovi = poiQ.filter(p => !gia.has(p.place_id));
                        poiCitta = [...poiCitta, ...nuovi];
                        cittaReport.listaQuartiere = { quartiere: sq.quartiere.nome, stato: lq.stato, cached: lq.cached ?? null, conti: lq.conti ?? null, costo: lq.costo ?? null,
                            luoghiPrima: sq.quartiere.daVisitare.length, verificati: poiQ.map(p => ({ place_id: p.place_id, nome: p.name, tipo: p._citta.tipo, ...(p._citta.simbolo ? { simbolo: true } : {}) })) };
                        console.info(`[C10b2 QUARTIERE] ${city}: ${sq.quartiere.nome} chiesto con ${sq.quartiere.daVisitare.length} luoghi da visitare → lista dedicata: ${poiQ.length} verificati (${lq.cached ? 'dal server' : lq.stato})`);
                        sq = scegli();
                    }
                }
                // C10c — un quartiere CHIESTO che non e' nella lista (decisione di Ivano): il nome si verifica su Google dentro la
                // citta' (un quartiere, non una via), parte la sua lista dedicata (C10b2) e la giornata parte da li'. Anche quando la
                // lista del giorno conferma la citta' (nessun quartiere). Mai nel borgo, mai in un giro di piu' giorni.
                if (unGiorno && conferma.scala !== 'borgo' && testoQ && sq?.motivo !== 'nominato nella richiesta') {
                    const { cercaQuartiere } = await import('./cityCenterService');
                    for (const nome of nomiDiLuogoNelTesto(testoQ, city)) {
                        const r = await cercaQuartiere(nome, city);
                        const conf = quartiereConfermato(r.candidato, nome, cityCenter, 20);
                        (cittaReport.quartiereChiesto ??= []).push({ nome, esito: conf.ok ? 'riconosciuto' : 'no', motivo: conf.motivo ?? null,
                            google: r.candidato ? { nome: r.candidato.name, tipi: r.candidato.types || [] } : null, ...(r.errore ? { errore: r.errore } : {}) });
                        if (!conf.ok) continue;
                        const nomeQ = r.candidato.name || nome;
                        const lq = await fetchQuartiereKnowledge(city, tourWindow.date, nomeQ)
                            .catch(err => ({ stato: 'assente', verificati: [], errore: String(err?.message || err) }));
                        modelliReport.quartiere = lq.modelli ?? null;
                        const poiQ = poiDallaLista(lq.verificati, city, buildPOIFromCandidate)
                            .map(p => ({ ...p, _citta: { ...p._citta, quartiere: nomeQ, tipo: 'essenziale', ...(p._citta.tipo !== 'essenziale' ? { daListaQuartiere: true } : {}) } }));
                        const gia = new Set(poiCitta.map(p => p.place_id));
                        poiCitta = [...poiCitta.map(p => (poiQ.some(q => q.place_id === p.place_id) ? poiQ.find(q => q.place_id === p.place_id) : p)), ...poiQ.filter(p => !gia.has(p.place_id))];
                        cittaReport.listaQuartiere = { quartiere: nomeQ, fuoriLista: true, stato: lq.stato, cached: lq.cached ?? null, conti: lq.conti ?? null, costo: lq.costo ?? null,
                            luoghiPrima: 0, verificati: poiQ.map(p => ({ place_id: p.place_id, nome: p.name, tipo: p._citta.tipo })) };
                        const qf = quartiereFuoriLista({ nome: nomeQ, candidato: r.candidato, poiQuartiere: poiQ });
                        sq = { quartiere: qf, secondo: null, motivo: 'nominato nella richiesta (fuori lista, verificato su Google)', motivoSecondo: null, classifica: sq?.classifica || [] };
                        console.info(`[C10c QUARTIERE] ${city}: «${nome}» non e' nella lista → ${nomeQ} riconosciuto su Google (${(r.candidato.types || []).join(', ')}); lista dedicata: ${poiQ.length} verificati (${lq.cached ? 'dal server' : lq.stato})`);
                        break;
                    }
                }
                if (sq) {
                    if (sq.quartiere) {
                        area = areaDeiQuartieri(sq.quartiere, sq.secondo);
                        // C10c — un quartiere chiesto: il giro parte dal suo nucleo e ci tiene la maggior parte delle tappe
                        if (/^nominato nella richiesta/.test(sq.motivo || '')) nucleo = nucleoDi(sq.quartiere);
                        // C10c-piena-2 — nel tracciato: da dove viene il nucleo (i luoghi della lista o il punto di Google) e il suo raggio
                        if (nucleo) cittaReport.nucleo = { fonte: nucleo.fonte ?? 'centro del quartiere', raggioKm: nucleo.raggioKm, centro: nucleo.centro, ...(nucleo.luoghi ? { luoghi: nucleo.luoghi } : {}) };
                        const scelti = [sq.quartiere, ...(sq.secondo ? [sq.secondo] : [])];
                        const fuori = poiCitta.filter(p => !dentroArea(p, area));
                        // le ancore (e il simbolo) sono quelle dei quartieri scelti: un essenziale di un quartiere vicino che cade
                        // nel raggio resta un posto della lista, senza priorita' di ancora
                        poiCitta = poiCitta.filter(p => dentroArea(p, area)).map(p => (p._citta.tipo === 'essenziale' && !scelti.some(q => delQuartiere(p, q))
                            ? { ...p, _citta: { tipo: 'da locale', momento: p._citta.momento, quartiere: p._citta.quartiere, eraEssenziale: true } } : p));
                        cittaReport.quartiere = { nome: sq.quartiere.nome, motivo: sq.motivo, centro: sq.quartiere.centro, raggioKm: sq.quartiere.raggioKm, classifica: sq.classifica,
                            listaFuori: fuori.map(p => p.name), ...(nucleo ? { nucleo } : {}) };
                        cittaReport.quartieri = scelti.map((q, i) => ({ nome: q.nome, momenti: scelti.length === 1 ? 'tutta la giornata' : (i === 0 ? 'mattina (e pranzo)' : '(pranzo e) pomeriggio, sera'),
                            centro: q.centro, raggioKm: q.raggioKm, essenziali: q.essenziali.map(e => e.name), motivo: i === 0 ? sq.motivo : sq.motivoSecondo }));
                        if (!sq.secondo && intera && sq.motivoSecondo) cittaReport.quartieri[0].nota = sq.motivoSecondo;
                        console.info(`[C10b QUARTIERE] ${city}: ${scelti.map(q => q.nome).join(' → ')} (${sq.motivo}${sq.secondo ? `; ${sq.motivoSecondo}` : ''}), raggio ${RAGGIO_QUARTIERE_KM} km`);
                    } else if (sq.motivo) {
                        cittaReport.quartiere = { nome: null, motivo: sq.motivo, classifica: sq.classifica };
                    }
                }
                console.info(`[C10b SCALA] ${city}: proposta ${conferma.proposta ?? '-'} → ${conferma.scala} (${conferma.motivo})`);
            }
            // C10b3 — le ricerche iniziali: dal centro del quartiere (o dei due quartieri), col loro raggio come bias
            const centroRicerche = area
                ? { latitude: area.centro.latitude, longitude: area.centro.longitude, biasMeters: Math.round(area.raggioKm * 1000) }
                : cityCenter;
            if (area) cittaReport.centroRicerche = { latitude: centroRicerche.latitude, longitude: centroRicerche.longitude, biasKm: area.raggioKm, area: area.nome };
            const { candidates: rawDalleRicerche, intent } = await fetchRealPOICandidates(city, centroRicerche, prefs, userPrompt, quotaTicket, food, opts.presetIntent || null, !!opts.baseQueries);
            modelliReport.traduttore = intent?._modello ?? null;
            // C10b3 — BORGHI (decisione di Ivano): il giro corto si colloca nella fascia della giornata in cui i posti della lista sono
            // aperti; la via principale vale come passeggiata (una sola) e non la toglie la regola delle zone.
            const nonZona = (c) => !zoneReason({ ...c, primaryType: c.primaryType ?? c.primary_type }, city);
            // C10c — BORGO (decisione di Ivano): contano solo i luoghi da visitare, non ristoranti, bar e negozi ne' i posti che per
            // Google non hanno un tipo; la via principale e le piazze storiche sono passeggiate (contano nella durata, non qui).
            const postiBorgo = poiCitta.filter(p => !p._citta.passeggiata && !isStoricaLista(p) && nonZona(p) && luogoDaVisitareBorgo(p) && !isOrganizzazione(p));
            // BORGO-FIX — decisione 1 (Ivano): nel conto della mezza giornata entrano anche la natura e i panorami delle RICERCHE
            // (visitabili, non organizzazioni), entro NATURA_BORGO_KM dal centro, che passano il voto (nel borgo 5 recensioni per la
            // natura: decisione 5) e sono aperti nella finestra chiesta. A Troina: Monte Muganà. Solo nel borgo.
            const borgoNatura = conferma?.scala === 'borgo' ? isNaturaOPanorama : null;
            const idLista = new Set(poiCitta.map(p => p.place_id || p.googlePlaceId));
            const kmDalCentro = (c) => {
                const lat = c.latitude ?? c.lat, lng = c.longitude ?? c.lng;
                return cityCenter && Number.isFinite(cityCenter.latitude) && Number.isFinite(lat) && Number.isFinite(lng) ? haversineKm(cityCenter.latitude, cityCenter.longitude, lat, lng) : null;
            };
            const naturaNelConto = conferma?.scala === 'borgo' && w0
                ? rawDalleRicerche.filter(c => !idLista.has(c.place_id || c.googlePlaceId) && isNaturaOPanorama(c) && !isOrganizzazione(c) && nonZona(c)
                    && (kmDalCentro(c) ?? Infinity) <= NATURA_BORGO_KM && passesQualityThreshold(c, city, { borgoNatura }) && apertoNellaFinestra(c, w0))
                : [];
            // BORGO-FIX — decisione 1: con «giornata» o «domani» nel testo il giro non scende sotto mattina e pomeriggio: la finestra resta quella chiesta
            const giornataChiesta = opts.pathType === 'custom' && chiedeGiornata(userPrompt);
            if (conferma?.scala === 'borgo') {
                cittaReport.mezzaGiornata = { verificati: poiCitta.length, utilizzabili: postiBorgo.length, naturaContate: naturaNelConto.map(c => c.name || c.title),
                    minimo: BORGO_MIN_VERIFICATI, giornataChiesta, riga: null, fascia: null };
            }
            if (conferma?.scala === 'borgo' && postiBorgo.length + naturaNelConto.length < BORGO_MIN_VERIFICATI && tourWindow.windows.length === 1 && !giornataChiesta) {
                // TROINA-FIX — la fascia del giro corto si sceglie su TUTTI i posti veri (lista e ricerche) che possono stare nel
                // giro, non solo su quelli che contano per la soglia: una chiesa che per Google ha i soli tipi generici, un
                // belvedere, un monte a un chilometro e mezzo. Restano fuori i pasti, le zone e quello che e' oltre il raggio del
                // borgo (lo stesso del filtro che segue). E conta solo nelle ore di visita (mattina e pomeriggio): una fascia tutta
                // pranzo non e' un giro.
                const nelRaggio = (c) => !cityCenter || !Number.isFinite(c.latitude ?? c.lat)
                    || haversineKm(cityCenter.latitude, cityCenter.longitude, c.latitude ?? c.lat, c.longitude ?? c.lng) <= (cityCenter.radiusKm ?? RAGGIO_BORGO_KM);
                const candidatiBorgo = uniscialPool(rawDalleRicerche, poiCitta)
                    .filter(c => !isMealPlace(c) && (c._citta?.passeggiata || isStoricaLista(c) || nonZona(c)) && nelRaggio(c));
                const fascia = fasciaApertaBorgo({ candidati: candidatiBorgo, lista: postiBorgo, finestra: w0, visite: oreDiVisita(w0.start) });
                if (fascia) {
                    w0.start = fascia.start;
                    w0.end = fascia.end;
                    tourWindow.start = fascia.start;
                    tourWindow.end = fascia.end;
                }
                // BORGO-FIX — la riga «X si gira in mezza giornata.» solo se e' VERA (la finestra e' stata accorciata) e mai su un giro della sera
                scalaNote = fascia && !isSeraStart(fascia.start) ? rigaBorgo(city) : null;
                Object.assign(cittaReport.mezzaGiornata, { riga: scalaNote,
                    ...(fascia ? { fascia: { inizio: fascia.start.toISOString(), fine: fascia.end.toISOString(), minuti: fascia.minuti, listaAperti: fascia.listaAperti, aperti: fascia.aperti } } : { fascia: null }) });
                console.info(`[C10b3 BORGO] ${city}: ${postiBorgo.length} posti della lista (< ${BORGO_MIN_VERIFICATI}) → giro corto ${fascia ? `${fascia.minuti} min dalle ${fascia.start.toISOString()}, ${fascia.listaAperti} della lista aperti` : 'senza fascia aperta'}`);
            }
            const rawCandidatesTutti = uniscialPool(rawDalleRicerche, poiCitta).filter(c => {
                if (dentroArea(c, area)) return true;
                ((cittaReport.quartiere ??= {}).fuoriArea ??= []).push(c.name || c.title || '?');
                return false;
            });

            // C7 — NIENTE ZONE: un'area generica ("Centro Storico Catania") non e' mai una tappa. La
            // ricerca le scarta gia' (placesDiscoveryService); qui la seconda rete, sul pool intero.
            const zoneTolte = [];
            const rawCandidates = rawCandidatesTutti.filter(c => {
                const z = zoneReason({ ...c, primaryType: c.primaryType ?? c.primary_type }, city);
                // C10b3 — nel borgo la via principale della lista vale come passeggiata: la regola delle zone non la toglie
                if (z && c._citta?.passeggiata && conferma?.scala === 'borgo') { cittaReport.viaPrincipale = { nome: c.name || c.title, zona: z }; return true; }
                // C10c — le piazze e vie storiche della lista (decisione di Ivano): la regola delle zone non le toglie, valgono come passeggiata
                if (z && isStoricaLista(c)) { (cittaReport.storicheTenute ??= []).push({ nome: c.name || c.title, zona: z }); return true; }
                if (z) zoneTolte.push({ nome: c.name || c.title || '?', motivo: z });
                return !z;
            });
            // C10c — una piazza o via storica della lista conta come passeggiata (al massimo una per mattina e una per pomeriggio: momentSelection)
            for (const c of rawCandidates) if (isStoricaLista(c) && !c._citta.passeggiata) c._citta = { ...c._citta, passeggiata: true };
            if (zoneTolte.length > 0) console.warn(`[C7 ZONE] ${city}: ${zoneTolte.length} zone tolte dal pool — ${zoneTolte.map(x => `${x.nome} (${x.motivo})`).join(' | ')}`);

            // Gate RAGGIO-CATEGORIA — la categoria richiesta, quando e' una delle
            // 7 filtrabili in modo stretto. undefined ⇒ nessun vincolo di
            // categoria (path B, "misto", trasversali, traduttore caduto):
            // comportamento bit-identico a prima di questo gate.
            const categoriaTarget = (isFreeTextIntent && intent)
                ? CATEGORIA_TO_TOUR_CATEGORY[String(intent.categoria || '').toLowerCase()]
                : undefined;
            // C7 — IL TEMA CIBO VALE SOLO NEI PASTI. Una richiesta a tema cibo (testo o categoria
            // `cibo` del traduttore) non e' una categoria per tutti i momenti: pranzo, aperitivo e
            // cena sono tipici, mattina e pomeriggio sono esperienze nello spirito del tema. Il
            // filtro stretto di categoria (solo ristoranti ovunque) non scatta per il cibo.
            const tema = (isFreeTextIntent && intent)
                ? detectFoodTheme({ text: opts.pathType === 'custom' ? userPrompt : '', categoria: intent.categoria, tipicoText: userPrompt })
                : { tema: false, tipico: false, streetFood: false, momenti: new Set(), fonte: null };
            const catStretta = tema.tema ? undefined : categoriaTarget;
            // DNA-3 — LA RICHIESTA ESPLICITA VINCE SUL DNA (lib/richiestaEsplicita.js). Cio' che l'utente ha detto o scelto
            // (categorie, luoghi per nome, esclusioni) filtra e ordina per prima; il DNA decide solo le scelte libere.
            // La richiesta viaggia dentro `dnaWeights._richiesta`: tutti i punteggi a valle la leggono da li'. Con fiducia 0
            // (`_share` 0 o pesi vuoti) non si aggiunge niente: il giro di un utente nuovo e' identico a prima.
            const richiesta = richiestaEsplicita({ intent: isFreeTextIntent ? intent : null, testo: userPrompt, prefs, pathType: opts.pathType });
            const dnaW = (opts.dnaWeights && dnaShareOf(opts.dnaWeights) > 0 && Object.keys(opts.dnaWeights).some(k => k !== '_share'))
                ? { ...opts.dnaWeights, _richiesta: richiesta }
                : (opts.dnaWeights || {});
            // il profilo per il modello: senza le categorie chieste o escluse, con la clausola «la richiesta vince»
            const aiProfileEff = (aiProfile && dnaW._richiesta) ? (weightsToAIProfile(dnaW, richiesta) || '') : aiProfile;
            if (tema.tema) console.info(`[C7 TEMA] ${city}: tema cibo (${tema.fonte})${tema.tipico ? ', tipico' : ''}${tema.momenti.size ? `, richiesti espliciti: ${[...tema.momenti].join(', ')}` : ''} → vale solo per i pasti`);

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
                countForWiden: catStretta
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
            // TROINA-FIX — I CONFINI DEL BORGO (borgoConfini.js): con una richiesta di natura, i luoghi di natura e i panorami
            // fino a NATURA_BORGO_KM (12 km) entrano anche oltre il raggio del borgo e fuori dal comune; i luoghi storici
            // restano nel comune (l'indirizzo di Google lo dice). Nel tracciato: `_citta.naturaOltre`, `_citta.fuoriComune`.
            if (conferma?.scala === 'borgo' && cityCenter && Number.isFinite(cityCenter.latitude)) {
                const kmDi = (c) => {
                    const lat = c.latitude ?? c.lat, lng = c.longitude ?? c.lng;
                    return Number.isFinite(lat) && Number.isFinite(lng) ? haversineKm(cityCenter.latitude, cityCenter.longitude, lat, lng) : null;
                };
                if (catStretta === 'natura') {
                    const gia = new Set(candidates);
                    const oltre = rawCandidates.filter(c => !gia.has(c) && isNaturaOPanorama(c) && (kmDi(c) ?? Infinity) <= NATURA_BORGO_KM);
                    if (oltre.length > 0) {
                        candidates = [...candidates, ...oltre];
                        cittaReport.naturaOltre = oltre.map(c => ({ nome: c.name || c.title, km: Math.round(kmDi(c) * 10) / 10 }));
                        console.info(`[TROINA-FIX] ${city}: natura oltre il raggio del borgo (entro ${NATURA_BORGO_KM} km) — ${cittaReport.naturaOltre.map(x => `${x.nome} ${x.km} km`).join(' | ')}`);
                    }
                }
                const fuori = candidates.filter(c => isLuogoStorico(c) && nelComuneIndirizzo(c, city) === false);
                if (fuori.length > 0) {
                    candidates = candidates.filter(c => !fuori.includes(c));
                    cittaReport.fuoriComune = fuori.map(c => ({ nome: c.name || c.title, indirizzo: c.address ?? c.formatted_address ?? null }));
                    console.info(`[TROINA-FIX] ${city}: luoghi storici fuori dal comune tolti — ${cittaReport.fuoriComune.map(x => x.nome).join(' | ')}`);
                }
            }

            // Gate RAGGIO-CATEGORIA — guard-rail deterministico: un candidato fuori
            // categoria non arriva MAI al selettore. Prima (countForWiden sopra) il
            // widen non veniva sprecato su candidati che comunque sarebbero stati
            // scartati qui; ora la garanzia e' nel codice, non nell'istruzione del
            // prompt (che resta, piu' sotto, come rinforzo — ma non e' piu' l'unica
            // barriera). Se il pool in-categoria e' vuoto anche dopo il widen,
            // candidates diventa [] e il ramo `else` esistente sotto (Path A →
            // no-results) se ne occupa, senza duplicare quella logica qui.
            if (catStretta) {
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
            // C7 — TIPICO: nei pasti si preferiscono i posti di cucina locale (tipo principale e nome) e si
            // escludono le cucine estere; la spinta si somma al merito, l'esclusione e' dichiarata nel tracciato.
            const tipicoEsclusi = [];
            if (tema.tipico) {
                const tenuti = candidates.filter(c => {
                    const estero = isMealPlace(c) && isForeignCuisine(c);
                    if (estero) tipicoEsclusi.push(c.name || c.title || '?');
                    return !estero;
                });
                if (tipicoEsclusi.length > 0) console.info(`[C7 TIPICO] ${city}: ${tipicoEsclusi.length} cucine estere escluse — ${tipicoEsclusi.join(' | ')}`);
                candidates = tenuti;
            }
            const foodBonus = (foodOn || tema.tipico)
                ? (c) => (foodOn ? foodPrefBonus(c, food, isMealPlace) : 0) + (tema.tipico && isMealPlace(c) ? tipicoBonus(c, { dieta: foodOn ? food.dieta : [] }) : 0)
                : null;
            // C10 — decisione di Ivano su P7a: le ancore (al massimo 3 essenziali per giornata intera, 1 per mezza) e i posti
            // «da locale» della lista passano davanti e FUORI dal merito (non contano nel limite dei 20 ne' nel tetto delle
            // icone); gli altri essenziali e tutto il resto restano al merito anti-ovvio di sempre.
            // DNA-3b — LE ESCLUSIONI SONO UN FILTRO DURO: un tipo escluso («niente chiese»: testo, `escludi` del traduttore, opzioni) non
            // entra nel pool, ne' come ancora della lista ne' da una ricerca mirata. Vale per tutti, anche per chi non ha un DNA.
            // Senza esclusioni la lista e' la stessa di prima. Se i candidati non bastano il giro e' piu' corto e lo dice (esclusioneNote).
            const esclusiTolti = [];
            const senzaEsclusi = (lista) => {
                const f = filtraEsclusi(lista, richiesta);
                if (f.tolti.length) esclusiTolti.push(...f.tolti.map(c => c.name || c.title || c.place_id));
                return f.tenuti;
            };
            candidates = senzaEsclusi(candidates);
            const conLista = poolConLista(candidates, {
                tourWindow,
                seleziona: (altri) => selectScoredCandidatePool(altri, { city, dnaWeights: dnaW, limit: 20 * nDays, bonus: foodBonus, borgoNatura }),
            });
            candidates = conLista.candidates;
            const ancoreCitta = conLista.ancore;
            Object.assign(cittaReport, {
                nelPool: candidates.filter(c => c._citta).map(c => ({ place_id: c.place_id, nome: c.name, tipo: c._citta.tipo, ancora: !!c._citta.ancora })),
                ancoreCandidate: ancoreCitta.map(c => ({ place_id: c.place_id, nome: c.name })),
                ancore: [],
                essenzialiAlMerito: conLista.essenzialiAlMerito.map(c => ({ place_id: c.place_id, nome: c.name, ammesso: candidates.some(x => x.place_id === c.place_id) })),
            });
            if (poiCitta.length > 0) {
                console.info(`[C10 CITTA] ${city}: lista ${lista.cached ? 'dal server' : 'nuova'} — ${poiCitta.length} verificati, ${cittaReport.nelPool.length} nel pool dopo i filtri, ancore: ${ancoreCitta.map(c => c.name).join(' | ') || 'nessuna'}`);
            }
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
            // C8a — il Percorso Veloce (QuickPath) da 18:00 e' drink + passeggiata + cena; la sosta dell'aperitivo
            // e la passeggiata fra drink e cena valgono per ogni percorso con aperitivo e cena.
            const veloce = opts.pathType === 'quick';
            // ORARI — i bucket senza i posti chiusi quando ci si arriva: tutte le regole
            // che seguono (varieta', percorso, tetto di cammino, tempo libero) scelgono
            // solo fra posti aperti. `veto` si riempie col controllo sugli orari veri.
            // Senza orari (ricerca vecchia) non toglie niente.
            const veto = new Map();
            let skeleton = null;
            let moments = [];
            let anyCategory = !!catStretta;
            let buckets = null;
            let mealOnlyIds = null;
            let extraThemes = [];
            let seraleVeloce = false;
            let drinkDiRiserva = false;
            const openBuckets = () => (buckets ? applyOpeningToBuckets(moments, buckets, { veto }) : null);
            // C10b2 — con due quartieri: la mattina nel primo, il pranzo in uno dei due, dal pomeriggio in poi nel secondo
            // BORGO-FIX — decisione 3: dopo il TRAMONTO del giorno del tour nessuna tappa di natura «da fuori» (monti, riserve, sentieri,
            // parchi fuori dall'abitato), in nessun flusso: i bucket dei momenti che cominciano dopo il tramonto le perdono (la passeggiata
            // conta dall'arrivo stimato: inizio del drink + sosta). Belvedere e piazze dentro il paese restano. Il tramonto e' quello che il
            // motore conosce gia' (sunTimes sul centro della citta', lo stesso del narratore).
            // NOTTE-FIX — «dopo il tramonto» e' «al buio»: prima dell'alba o dal tramonto del giorno della finestra (eBuio, sunTimes.js).
            const soleDi = (m) => sunForDay({ windowIndex: m.dayIndex }, m.dayIndex, tourWindow, cityCenter);
            const tramontoDi = (m) => soleDi(m).sunset;
            const inizioEffettivo = (m) => (m.start instanceof Date ? m.start.getTime() + (m.key === 'passeggiata' ? APERITIVO_STAY_MINUTES * 60000 : 0) : null);
            const dopoIlTramonto = (m) => { const i = inizioEffettivo(m); return Number.isFinite(i) && eBuio(i, soleDi(m)); };
            const senzaNaturaDiNotte = (b) => {
                if (!b) return b;
                const out = new Map(b);
                for (const m of moments) {
                    if (!dopoIlTramonto(m)) continue;
                    const lista = b.get(m.id) || [];
                    const tolti = lista.filter(c => isNaturaDaFuori(c, cityCenter));
                    if (!tolti.length) continue;
                    out.set(m.id, lista.filter(c => !tolti.includes(c)));
                    cittaReport.naturaDiNotte ??= [];
                    for (const c of tolti) {
                        const nome = c.name || c.title || '?';
                        if (!cittaReport.naturaDiNotte.some(x => x.nome === nome && x.momento === m.id)) cittaReport.naturaDiNotte.push({ nome, momento: m.id, tramonto: tramontoDi(m).toISOString() });
                    }
                }
                return out;
            };
            const nelleAree = (b) => {
                const x = area?.aree?.length > 1 ? bucketsNelleAree(moments, b, area) : b;
                // C10c — con un quartiere chiesto, mattina, pranzo e pomeriggio nel suo nucleo
                return senzaNaturaDiNotte(nucleo ? bucketsNelNucleo(moments, x, nucleo) : x);
            };
            // Gate NARRATORE-DOPO — si cerca per i momenti che il pool non riesce
            // a riempire, non solo per quelli vuoti (vedi shortMomentThemes).
            // C1 — le famiglie che la categoria o il testo chiedono: per quelle
            // la regola "una per famiglia al giorno" si spegne. Lo stesso
            // testo e la stessa categoria dello scheletro.
            const familiesAsked = requestedFamilies({
                category: parseExplicitCategory(opts.pathType === 'custom' ? userPrompt : '') ?? (catStretta ? (TOUR_CATEGORY_TO_SKELETON[catStretta] || catStretta) : null),
                text: opts.pathType === 'custom' ? userPrompt : '',
            });
            // BORGO-FIX — decisione 3: la natura e' chiesta (categoria natura del Quiz/Sorprendimi/traduttore, o «natura» nel testo di Crea)
            const naturaChiesta = catStretta === 'natura' || familiesAsked.has('verde');
            // P3e — con la categoria che vale per tutti i momenti, un
            // ristorante trovato fuori da quella categoria serve SOLO a pranzo
            // e cena: mai al mattino di un tour Rioni Storici. Vale per ogni
            // ricerca mirata, prima e dopo la scelta (C1b).
            const addMealOnly = (found) => (anyCategory
                ? new Set([...(mealOnlyIds || []), ...found
                    .filter(c => isMealPlace(c) && !(catStretta && candidateMatchesIntentCategoria(c, intent.categoria)))
                    .map(c => c.place_id || c.googlePlaceId)])
                : null);
            // C8b — CENA TARDI: il Veloce che parte fra le 21:00 e le 22:00 prova prima la cena (poi la passeggiata). Se per quell'ora
            // nessun ristorante e' aperto per tutta la sosta, si ripiega sul giro di C8a (drink + passeggiata) senza rifare la ricerca
            // del cibo: i ristoranti gia' trovati restano nel pool.
            // GIRO-EDIT — LA COLAZIONE AUTOMATICA: un giro che parte prima delle 10:30 comincia con una colazione vicina (lo scheletro guarda l'ora).
            // Le regole della richiesta restano: niente colazione con una sola categoria (o tipo, o nome) chiesta, o con «niente bar»/«niente cibo».
            // (nei test e' spenta per difetto, come la lista della citta': vedi colazioneAutoSpenta; le prove della colazione la riaccendono)
            const colazioneAutomatica = !colazioneAutoSpenta() && !catStretta && !(richiesta.tipiChiesti || []).length && !(richiesta.nomiChiesti || []).length
                && !categoriaEsclusa(richiesta, 'food') && !(richiesta.vociEscluse || []).includes('bar');
            let cenaPrima = veloce;
            let foodGiaCercato = false;
            // C8c — la cena tardi che non c'e' (nessun ristorante aperto per tutta la sosta) non resta in silenzio: ha la sua riga.
            let cenaTardiMancante = false;
            for (;;) {
                skeleton = addEveningWalk(buildDaySkeleton({
                    window: tourWindow,
                    pace: prefs?.pace,
                    interests: extractInterestTokens(prefs),
                    group: prefs?.group,
                    text: opts.pathType === 'custom' ? userPrompt : '',
                    category: catStretta ? (TOUR_CATEGORY_TO_SKELETON[catStretta] || catStretta) : null,
                    foodTheme: tema.tema,
                    veloce,
                    cenaPrima,
                    colazioneAuto: colazioneAutomatica,
                }), { veloce });
                moments = candidates.length >= 1 ? flattenSkeleton(skeleton) : [];
                // BORGO-FIX — decisione 3: di giorno, con la natura chiesta, la passeggiata prende per prima una natura o un panorama;
                // nel borgo il tetto di cammino per quella tappa sale a 30 minuti (Monte Muganà a 29 dal bar).
                for (const m of moments) {
                    if (m.key !== 'passeggiata' || !naturaChiesta || dopoIlTramonto(m)) continue;
                    m.naturaPrima = true;
                    m.naturaPrimaTest = isNaturaOPanorama;
                    if (conferma?.scala === 'borgo') m.maxWalkMinutes = WALK_NATURA_BORGO_MINUTES;
                }
                // la cena facoltativa non si cerca due volte
                if (foodGiaCercato) moments = moments.filter(m => !(m.key === 'cena' && m.opzionale));
                // C7 — con lo street food un forno puo' essere un pasto (panelle, focaccia): pranzo e cena lo ammettono.
                if (tema.streetFood) for (const m of moments) m.streetFood = true;
                anyCategory = !!catStretta;
                buckets = moments.length > 0 ? nelleAree(bucketCandidates(moments, candidates, { anyCategory, borgo: conferma?.scala === 'borgo' })) : null;
                // Percorso A: se NESSUN luogo trovato per la frase sta in NESSUN
                // momento, la frase chiede qualcosa che la tabella dei momenti non
                // nomina (terme, spa…). E' una richiesta esplicita: vale per tutti
                // i momenti, come una categoria nominata, e gli orari restano.
                // Cercare altro (musei, trattorie) tradirebbe la richiesta.
                if (buckets && isFreeTextIntent && !anyCategory && [...buckets.values()].every(b => b.length === 0)) {
                    console.info(`[P3 SCHELETRO] ${city}: nessun candidato sta in un momento → la richiesta vale per tutti i momenti`);
                    anyCategory = true;
                    buckets = nelleAree(bucketCandidates(moments, candidates, { anyCategory, borgo: conferma?.scala === 'borgo' }));
                }
                veto.clear();
                mealOnlyIds = null;
                seraleVeloce = veloce && moments.some(m => (m.bevuta && m.soloCategorie) || m.cenaPrima || m.key === 'passeggiata');
                // BORGO-FIX — decisione 3: il drink di riserva (la sera tardi) cerca un bar: la categoria chiesta (natura) non filtra quella ricerca
                drinkDiRiserva = moments.some(m => m.daRiserva && m.bevuta);
                extraThemes = buckets ? shortMomentThemes(moments, openBuckets().buckets, candidates, undefined, { requestedFamilies: familiesAsked }) : [];
                if (extraThemes.length > 0) {
                    const foodAnchor = extraThemes.includes('food')
                        ? mealSearchAnchor(moments, openBuckets().buckets, candidates, { requestedFamilies: familiesAsked })
                        : null;
                    if (foodAnchor) console.info(`[C1 COMPOSIZIONE] ${city}: ricerca dei pasti da "${foodAnchor.name}", non dal centro`);
                    const extra = await searchMomentCandidates({
                        city, cityCenter, themes: extraThemes, known: candidates, perTheme: (extraThemes.includes('esperienze') ? 8 : 5) * nDays,
                        borgoNatura, borgoPub: conferma?.scala === 'borgo',
                        dnaWeights: dnaW,
                        // C8a — la sera del Veloce ha drink, passeggiata e cena qualunque sia l'umore: la categoria dell'intento non la restringe.
                        categoria: catStretta && !seraleVeloce && !drinkDiRiserva ? intent.categoria : null,
                        foodPrefs: foodOn ? food : null,
                        foodAnchor, tipico: tema.tipico, area,
                    });
                    candidates = [...candidates, ...senzaEsclusi(extra)];
                    mealOnlyIds = addMealOnly(extra);
                    buckets = nelleAree(bucketCandidates(moments, candidates, { anyCategory, mealOnlyIds, borgo: conferma?.scala === 'borgo' }));
                    if (extraThemes.includes('food')) foodGiaCercato = true;
                }
                if (cenaPrima) {
                    const cm = moments.find(m => m.cenaPrima);
                    if (cm) {
                        if ((openBuckets().buckets.get(cm.id) || []).length === 0) {
                            console.info(`[C8b CENA TARDI] ${city}: nessun ristorante aperto per tutta la sosta all'arrivo → drink + passeggiata`);
                            cenaPrima = false;
                            cenaTardiMancante = true;
                            continue;
                        }
                    }
                }
                break;
            }
            // ORARI — i bucket che il selettore e la scelta vedono: solo posti non chiusi.
            const hours0 = openBuckets();
            const hoursBuckets = hours0 ? hours0.buckets : null;
            if (moments.length > 0) {
                console.info(
                    `[P3 SCHELETRO] ${city}: ${moments.length} momenti — ` +
                    moments.map(m => `${m.id}×${m.stops}(${(hoursBuckets.get(m.id) || []).length} cand.)`).join(', ') +
                    (extraThemes.length ? ` | ricerche mirate: ${extraThemes.join(', ')}` : ' | nessuna ricerca mirata')
                );
                if (hours0.report.chiusi.length > 0) {
                    console.info(`[ORARI] ${city}: ${hours0.report.chiusi.length} posti chiusi quando ci si arriva, tolti dai momenti — ${hours0.report.chiusi.slice(0, 6).map(x => `${x.nome} @${x.momento} (${x.perche})`).join(' | ')}`);
                }
            }
            // Al selettore vanno solo i candidati di almeno un momento.
            const selectorCandidates = hoursBuckets
                ? [...new Map([...hoursBuckets.values()].flat().map(c => [c.place_id || c.googlePlaceId, c])).values()]
                : candidates;
            // ORARI — a quest'ora i posti chiusi tolgono tutto: non e' "non trovo", e' "meglio domattina".
            if (hoursBuckets && selectorCandidates.length === 0 && hours0.report.chiusi.length > 0) {
                console.info(`[ORARI] ${city}: tutti i candidati sono chiusi a quest'ora → messaggio dichiarato`);
                return { days: [{ stops: [] }], _source: 'closed-now', _messaggio: messaggioChiuso(tourWindow.start), _orari: { chiusi: hours0.report.chiusi.slice(0, 40) } };
            }

            // Gate I — soglia minima 1 candidato (era 3). Un posto vero è meglio
            // di zero. Un tour di 1 tappa con Villa Bellini > messaggio bugiardo
            // "A Catania non troviamo parchi" (Catania ha Villa Bellini).
            if (selectorCandidates.length >= 1) {
                const selectorPrompt = buildSelectorSystemPrompt({
                    city, timeContext,
                    prefs, aiProfile: aiProfileEff, cityCenter, candidates: selectorCandidates, userPrompt,
                    // C7 — col tema cibo la categoria `cibo` non e' una clausola dura per tutti i momenti: al selettore
                    // arriva `misto` (i momenti dicono gia' cosa serve: esperienze la mattina e il pomeriggio).
                    intent: tema.tema ? { ...intent, categoria: 'misto' } : intent, // Gate B — clausole dure (categoria/escludi/tempo/note) nel prompt
                    moments: moments.length > 0 ? moments : null,
                    buckets: hoursBuckets || buckets,
                    foodPrefs: foodOn ? food : null,
                });
                const controller = new AbortController();
                // C10b2 — 50 s: il proxy da' al modello del selettore 22 s, poi ripiega su quello di prima.
                const timeoutId = setTimeout(() => controller.abort(), 50_000);
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
                    }, controller.signal, quotaTicket, 'selettore');
                    modelliReport.selettore = data?._modello ?? null;
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
                    let aiStops = rawStops
                        .filter(st => st && typeof st.place_id === 'string')
                        .map(st => ({ place_id: st.place_id, ...(typeof st.moment === 'string' ? { moment: st.moment } : {}) }));
                    // TROINA-FIX — il selettore che non sceglie niente non svuota il giro: se i momenti hanno posti veri aperti, li
                    // sceglie il riparatore del codice (il posto vuoto lo prende il candidato migliore per merito, con tutte le regole).
                    // Si scrive nel tracciato. Senza momenti (o senza candidati aperti) resta l'errore di prima.
                    if (aiStops.length === 0) {
                        const conPosti = moments.length > 0 && hoursBuckets && [...hoursBuckets.values()].some(b => b.length > 0);
                        if (!conPosti) throw new Error('AI returned no stops (F2)');
                        console.warn(`[TROINA-FIX] ${city}: il selettore non ha scelto nessuna tappa → sceglie il riparatore fra i posti veri dei momenti`);
                        cittaReport.selettoreVuoto = true;
                    }
                    // C10 — le ancore proposte al riparatore come scelte del modello, in testa al loro momento: valgono
                    // solo se nessuna alternativa del momento costa meno per le regole (cammino, varieta', orari, percorso).
                    if (ancoreCitta.length > 0 && moments.length > 0) {
                        const semina = seminaAncore(aiStops, ancoreCitta, moments, hoursBuckets || buckets, tourWindow);
                        aiStops = semina.aiStops;
                        declassa(semina.nonSeminate);
                        cittaReport.seminate = semina.seminate;
                        cittaReport.ancore = semina.seminate.map(x => ({ place_id: x.place_id, nome: x.nome }));
                        cittaReport.declassate = semina.nonSeminate.map(c => ({ place_id: c.place_id, nome: c.name }));
                    } else if (ancoreCitta.length > 0) {
                        declassa(ancoreCitta);
                    }

                    const baseMeta = (di) => ({
                        day: di + 1,
                        title: giornoTitle(di, city, tourWindow.windows.length),
                        // P3d-j — il meteo vero, o nessun meteo (mai "Soleggiato, 22°"); TESTI — solo per un tour di oggi.
                        weather: weatherForDay(weather, tourWindow.windows[di], requestTime),
                        suggestedTransit: 'walking',
                        mapMood: 'default',
                    });

                    // P3 — con lo scheletro il codice controlla la risposta e la
                    // ripara (momento sbagliato, numero sbagliato, luogo
                    // inventato), poi mette gli orari dentro ogni momento.
                    let momentReport = null;
                    let orariTracciato = new Map();   // ORARI — place_id → 'noto' | 'sconosciuto'
                    let orariFonte = new Map();       // ORARI-FESTIVI — place_id → 'orario del giorno' | 'orario della settimana'
                    let orariInfo = null;
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
                            // C8a — con momenti facoltativi (passeggiata, cena del Veloce) il tetto e' di 3 ricerche in tutto.
                            let budget = Math.max(0, MAX_EXTRA_SEARCHES - extraThemes.length);
                            // C8a — la passeggiata fra drink e cena ha UNA ricerca sua, dalla tappa prima, in piu' del tetto dei momenti veri.
                            let walkBudget = moments.some(x => x.key === 'passeggiata') ? 1 : 0;
                            const eWalk = (x) => moments.find(m => m.id === x.momento)?.key === 'passeggiata';
                            // C10c — ORARI: un'ancora vietata nel suo momento (chiusa all'arrivo) va in un altro momento del giorno in cui e' aperta
                            const idAncoreSemi = new Set((cittaReport.seminate || []).map(x => x.place_id));
                            const repair = (tempoLibero = false) => repairMomentSelection({
                                moments, buckets: openBuckets().buckets, aiStops: (() => {
                                    const sp = spostaAncoreVietate(aiStops, idAncoreSemi, moments, openBuckets().buckets, veto);
                                    if (sp.spostate.length) {
                                        aiStops = sp.aiStops;
                                        cittaReport.ancoreSpostate = [...(cittaReport.ancoreSpostate || []), ...sp.spostate];
                                    }
                                    return aiStops;
                                })(), pool: candidates, dnaWeights: dnaW,
                                requestedFamilies: familiesAsked, searchedIds, searchedMoments, dellaRichiesta: catStretta === 'natura' ? isNaturaOPanorama : null,
                                // C5b — il punto di partenza, se il chiamante lo conosce;
                                // senza, la prima tappa si misura dal centro del gruppo.
                                startPoint: opts.startPoint || null,
                                // C5e (O) — il tempo libero si decide DOPO le ricerche mirate.
                                tempoLiberoMinuti: tempoLibero ? FREE_TIME_MAX_MINUTES : null,
                            });
                            let repaired = repair();
                            while (budget > 0 || walkBudget > 0) {
                                // C5c — per gravita' (searchQueue): prima una tappa
                                // oltre il tetto dalla tappa prima, poi una famiglia
                                // ripetuta, poi un momento "lontano" che nel giro
                                // finale sta ormai entro il tetto.
                                const target = repaired.report.ricercheDaFare
                                    .find(x => x.da && !searchedMoments.has(x.momento) && (eWalk(x) ? walkBudget > 0 : budget > 0));
                                if (!target) break;
                                const m = moments.find(x => x.id === target.momento);
                                const theme = momentTheme(m);
                                searchedMoments.add(target.momento);
                                if (!theme) continue;
                                if (eWalk(target)) walkBudget -= 1; else budget -= 1;
                                const found = await searchMomentCandidates({
                                    city, cityCenter, themes: [theme], known: candidates, perTheme: 5,
                                    dnaWeights: dnaW,
                                    categoria: catStretta && !seraleVeloce && !drinkDiRiserva ? intent.categoria : null,
                                    foodPrefs: foodOn ? food : null,
                                    anchor: target.da, tipico: tema.tipico, area, borgoNatura, borgoPub: conferma?.scala === 'borgo',
                                });
                                ricercheDopo.push({ momento: target.momento, tema: theme, da: target.da.name, trovati: found.length });
                                console.info(`[C1b RICERCA MIRATA] ${city}: ${target.momento} da "${target.da.name}" (${theme}) → ${found.length} candidati`);
                                if (found.length > 0) {
                                    for (const c of found) searchedIds.add(c.place_id || c.googlePlaceId);
                                    candidates = [...candidates, ...senzaEsclusi(found)];
                                    mealOnlyIds = addMealOnly(found);
                                    buckets = nelleAree(bucketCandidates(moments, candidates, { anyCategory, mealOnlyIds, borgo: conferma?.scala === 'borgo' }));
                                }
                                repaired = repair();
                            }
                            // C5e (O) — ricerche finite: un momento non pasto senza
                            // niente entro 40 min dalla tappa prima diventa tempo libero.
                            // ORARI — e si controllano gli orari VERI del giro (arrivo → arrivo
                            // + sosta): un posto che risulta chiuso si vieta per quel momento
                            // e si sceglie di nuovo con le stesse regole, finche' e' tutto aperto.
                            const settled = settleOpeningHours({
                                repair: () => repair(true),
                                schedule: (plan) => scheduleMomentPlan(plan, tourWindow.windows.map(w => w.start)),
                                veto,
                            });
                            repaired = settled.repaired;
                            let sched = settled.sched;
                            // L'ultima rete: una tappa ancora chiusa non esce mai.
                            if (settled.residui.length > 0) {
                                console.warn(`[ORARI] ${city}: ${settled.residui.length} tappe ancora chiuse dopo i giri → tolte (${settled.residui.map(x => x.nome).join(', ')})`);
                                sched = dropFromSchedule(sched, settled.residui);
                            }
                            // CONTINUITA' — un'attesa oltre 45 minuti fra due tappe e' un buco:
                            // prima si prova ad aggiungere una tappa aperta dal pool del momento
                            // (stesse regole di sempre), poi il buco resta e sara' una riga dichiarata.
                            const filled = fillGaps({
                                moments, repaired, sched, veto,
                                espandi: normalizePace(prefs?.pace) !== 'rilassato',
                                repair: () => repair(true),
                                schedule: (plan) => scheduleMomentPlan(plan, tourWindow.windows.map(w => w.start)),
                            });
                            repaired = filled.repaired;
                            sched = filled.sched;
                            // C8b — i MINIMI di tappe per la durata della finestra del giorno (6 ore o piu' → 4, da 3 a 6 → 3, meno → 2):
                            // una tappa in piu' dove il pool lo permette (anche con ritmo Rilassato); il resto lo dichiara belowMinimumRows.
                            const minPerDay = new Map(tourWindow.windows.map((w, di) => [di, minStopsForWindow((w.end.getTime() - w.start.getTime()) / 60000)]));
                            const minimo = fillMinimum({
                                moments, repaired, sched, veto, minPerDay,
                                repair: () => repair(true),
                                schedule: (plan) => scheduleMomentPlan(plan, tourWindow.windows.map(w => w.start)),
                            });
                            repaired = minimo.repaired;
                            sched = minimo.sched;
                            // DNA-3b — LE SOSTE DEL DNA (lib/sosteDna.js): negli spazi liberi di mattina e pomeriggio, 1–2 soste brevi (15–30 min) delle
                            // categorie piu' forti del DNA; mai se la richiesta ha categorie precise o esclude la categoria, mai di notte per la natura.
                            // Per Te (`giornata: false`) e utenti senza fiducia nel DNA: nessuna sosta, giro identico a prima.
                            if (opts.giornata !== false) { // Per Te (_homeDaMotore passa giornata: false) non ha soste del DNA
                                const argsSoste = {
                                    dnaWeights: opts.dnaWeights, richiesta, categoriaTarget: catStretta || null,
                                    passaQualita: (c) => passesQualityThreshold(c, city, { borgoNatura }),
                                    alBuio: (when, di) => eBuio(when, sunForDay({ windowIndex: di }, di, tourWindow, cityCenter)),
                                    daFuori: (c) => isNaturaDaFuori(c, cityCenter),
                                    categorieDi: mapCandidateToCoreCategories,
                                };
                                let poolSoste = [...candidates, ...candidatiGenerazione.filter(c => !candidates.includes(c))];
                                const primo = aggiungiSosteDna({ sched, pool: poolSoste, ...argsSoste });
                                sched = primo.sched;
                                sosteDnaReport = { ...primo.report, ricerca: { fatte: [], motivo: null } };
                                // DNA-3c — la ricerca mirata della sosta: solo se il pool non ha potuto dare una sosta che il DNA voleva (fiducia media o
                                // alta, uno spazio libero di almeno 20 minuti). Una ricerca, due con fiducia alta, raggio 300 m, dal proxy dei posti di sempre.
                                // una ricerca alla volta: la seconda (fiducia alta) parte solo se la prima non ha bastato
                                const giaCercate = [];
                                const noti = new Set(poolSoste.map(c => c.place_id || c.googlePlaceId));
                                for (let giro = 0; giro < 2; giro++) {
                                    const piano = ricercheDellaSosta({ sched, dnaWeights: opts.dnaWeights, richiesta, categoriaTarget: catStretta || null, primo: { ...primo.report, aggiunte: sosteDnaReport.aggiunte }, pool: poolSoste, giaCercate });
                                    sosteDnaReport.ricerca.motivo = piano.motivo;
                                    const r = piano.ricerche[0];
                                    if (!r) break;
                                    giaCercate.push({ giorno: r.giorno, categoria: r.categoria, dopo: r.dopo });
                                    const voce = { categoria: r.categoria, query: r.query, dopo: r.dopo, libero: r.libero, punto: { latitude: Number(r.punto.latitude.toFixed(5)), longitude: Number(r.punto.longitude.toFixed(5)) }, raggioM: r.raggioM, costoMassimoUsd: COSTO_RICERCA_SOSTA_USD };
                                    const trovati = [];
                                    try {
                                        const { placesDiscoveryService } = await import('./placesDiscoveryService');
                                        const lista = await placesDiscoveryService.discoverRealPOIs(city, r.punto.latitude, r.punto.longitude, null, { customQuery: r.query, customKind: r.kind, radiusMeters: r.raggioM, maxResults: 20 });
                                        // il raggio di Google e' solo un'indicazione di rilevanza: i 300 m veri si misurano qui, dal punto dello spazio libero
                                        // (con maxResults 8 i posti vicini, in fondo alla pagina di Google, restavano fuori: provato dal vivo a Catania)
                                        const entroRaggio = (c) => haversineKm(r.punto.latitude, r.punto.longitude, c.latitude ?? c.lat, c.longitude ?? c.lng) * 1000 <= r.raggioM;
                                        const dentro = applyRadiusFilter((Array.isArray(lista) ? lista : []).filter(entroRaggio), cityCenter, city, { requireCenter: true })
                                            .filter(c => { const id = c.place_id || c.googlePlaceId; return id && !noti.has(id); });
                                        for (const c of senzaEsclusi(dentro)) { noti.add(c.place_id || c.googlePlaceId); trovati.push(c); }
                                        voce.trovati = dentro.length;
                                    } catch (err) {
                                        voce.errore = String(err?.message || err).slice(0, 120); // una ricerca che fallisce non fa cadere il giro: niente sosta
                                    }
                                    sosteDnaReport.ricerca.fatte.push(voce);
                                    console.info(`[DNA-3c RICERCA SOSTA] ${city}: ${r.categoria} dopo "${r.dopo}" (${r.libero} min liberi) → ${voce.trovati ?? 'errore'} candidati`);
                                    if (trovati.length > 0) {
                                        poolSoste = [...poolSoste, ...trovati];
                                        const secondo = aggiungiSosteDna({ sched, pool: poolSoste, ...argsSoste, gia: sosteDnaReport.aggiunte.map(x => ({ giorno: x.giorno, categoria: x.categoria })) });
                                        sched = secondo.sched;
                                        sosteDnaReport.aggiunte = [...sosteDnaReport.aggiunte, ...secondo.report.aggiunte];
                                    }
                                }
                                for (const x of sosteDnaReport.aggiunte) console.info(`[DNA-3b SOSTA] ${city}: ${x.nome} (${x.categoria}, ${x.minuti} min, deviazione ${x.deviazioneM} m) in ${x.momento}`);
                                // la sosta deve stare fra i candidati: la canonicalizzazione scarta ogni tappa che non e' nel pool
                                const sosteIds = new Set(sosteDnaReport.aggiunte.map(x => x.place_id));
                                candidates = [...candidates, ...poolSoste.filter(c => sosteIds.has(c.place_id || c.googlePlaceId) && !candidates.includes(c))];
                            }
                            // NAV-2 — L'ORDINE DEL PERCORSO: ultimo passo dell'ordine. Dentro ogni momento di mattina e pomeriggio le tappe si camminano
                            // nell'ordine che fa meno strada; pasti, aperitivo, colazione e soste del DNA restano dove sono, con i loro orari.
                            if (!ordinePercorsoSpento()) {
                                const ord = riordinaPerPercorso(sched);
                                sched = ord.sched;
                                ordinePercorsoReport = ord.report;
                                for (const f of ord.report.file) console.info(`[NAV-2 ORDINE] ${city}: giorno ${f.giorno} ${f.momento}: ${f.kmPrima.toFixed(2)} → ${f.kmDopo.toFixed(2)} km`);
                            }
                            const { report } = repaired;
                            for (const a of minimo.aggiunte) console.info(`[C8b MINIMO] ${city}: tappa in piu' in ${a.momento} (giorno ${a.dayIndex + 1}: ${a.prima} → ${a.dopo} tappe, minimo ${minPerDay.get(a.dayIndex)})`);
                            for (const a of filled.aggiunte) console.info(`[CONTINUITA'] ${city}: tappa in piu' in ${a.momento} (buchi ${a.minutiPrima} → ${a.minutiDopo} min)`);
                            const hoursReport = openBuckets().report;
                            // Un filtro non lascia mai un buco: un momento rimasto senza posti
                            // aperti ha la sua riga dichiarata (tempo libero, o "nessun locale
                            // aperto" per un pasto).
                            // E quante tappe avrebbe avuto il giro SENZA il filtro: il messaggio notturno
                            // vale solo se le chiusure hanno portato le tappe sotto quelle (un giro che per
                            // costruzione ha una tappa sola, e ce l'ha aperta, resta com'e').
                            let tappeSenzaFiltro = null;
                            if (hoursReport.chiusi.length > 0 || veto.size > 0) {
                                const senza = repairMomentSelection({
                                    moments, buckets, aiStops, pool: candidates, dnaWeights: dnaW,
                                    requestedFamilies: familiesAsked, searchedIds, searchedMoments, dellaRichiesta: catStretta === 'natura' ? isNaturaOPanorama : null,
                                    startPoint: opts.startPoint || null, tempoLiberoMinuti: FREE_TIME_MAX_MINUTES, registraPool: false,
                                });
                                tappeSenzaFiltro = scheduleMomentPlan(senza.plan, tourWindow.windows.map(w => w.start)).days.flat().length;
                            }
                            const chiusiPerMomento = new Set([...hoursReport.chiusi.map(x => x.momento), ...veto.keys()]);
                            const righeChiuse = closedMomentRows({ moments, sched, tempoLibero: report.tempoLibero, chiusiPerMomento });
                            // CONTINUITA' — i buchi rimasti hanno la loro riga di tempo libero, ancorata alla tappa che segue.
                            const righeBuchi = gapRows({ moments, sched, tempoLibero: [...(report.tempoLibero || []), ...righeChiuse] });
                            // C8b — sotto il minimo e senza altra riga dichiarata: la dichiara (mai un tour corto in silenzio).
                            const righeMinimo = belowMinimumRows({ moments, sched, tempoLibero: [...(report.tempoLibero || []), ...righeChiuse, ...righeBuchi], minPerDay });
                            // C8c — la sera si cena: se la cena tardi non c'e', la riga approvata («Nessun locale aperto qui vicino a quest'ora.»)
                            const righeCenaTardi = cenaTardiMancante && !(report.tempoLibero || []).some(x => x.key === 'cena')
                                ? [{ momento: 'g1-cena', key: 'cena', label: 'Cena', dayIndex: 0, posto: 0, dopo: null, piuVicino: null, chiuso: true, pasto: true,
                                    motivo: 'la sera si cena: nessun ristorante aperto per tutta la sosta' }]
                                : [];
                            report.tempoLibero = [...(report.tempoLibero || []), ...righeChiuse, ...righeBuchi, ...righeMinimo, ...righeCenaTardi];
                            // DNA-3b — le esclusioni hanno tolto candidati e il giro e' sotto il minimo della sua finestra: lo dice, con la riga approvata
                            if (esclusiTolti.length > 0 && sched.days.some((d, di) => d.length < (minPerDay.get(di) ?? 0))) esclusioneNote = notaEsclusioni(richiesta);
                            orariTracciato = scheduleHoursLabels(sched);
                            orariFonte = scheduleHoursSources(sched);
                            orariInfo = {
                                chiusi: hoursReport.chiusi.slice(0, 60), vietati: [...veto.entries()].map(([momento, ids]) => ({ momento, place_id: [...ids] })),
                                giri: settled.giri.length, ignoti: hoursReport.ignoti, scartatiIgnoti: hoursReport.scartatiIgnoti,
                                righeDichiarate: righeChiuse.map(x => ({ momento: x.momento, pasto: x.pasto })), residui: settled.residui.length,
                                tappeSenzaFiltro,
                            };
                            const continuita = { aggiunte: filled.aggiunte, tentativi: filled.tentativi, respinti: filled.respinti || [], dichiarati: righeBuchi.map(x => ({ momento: x.momento, minuti: x.buco, prima: x.prima })),
                                minimo: { richiesto: Object.fromEntries(minPerDay), aggiunte: minimo.aggiunte, tentativi: minimo.tentativi, dichiarati: righeMinimo.map(x => ({ momento: x.momento, giorno: x.dayIndex + 1 })) } };
                            momentReport = { ...report, finestraMinuti: tourWindow.windows.map(w => Math.round((w.end.getTime() - w.start.getTime()) / 60000)), tolte: sched.tolte, ricercheMirate: extraThemes, ricercheDopo, orari: orariInfo, continuita, soste: sosteDnaReport, ordine: ordinePercorsoReport, esclusioni: { tolti: esclusiTolti.slice(0, 40), nota: esclusioneNote }, tema: { cibo: tema.tema, tipico: tema.tipico, fonte: tema.fonte, momentiEspliciti: [...tema.momenti], cucineEstereEscluse: tipicoEsclusi, zoneTolte } };
                            logMomentReport(city, momentReport);
                            // C7 — nel tracciato (interno, mai a schermo): cosa ha voluto il tema. Il pasto del tema, l'esperienza
                            // nello spirito del tema, il momento chiesto ESPLICITAMENTE dal testo, e per "tipico" se il posto e' locale.
                            const temaTrace = (d) => {
                                const c = d.candidate;
                                const out = {};
                                if (d.moment?.esplicito) out.esplicito = 'richiesto dal testo per questo momento';
                                if (tema.tema) {
                                    if (isMealPlace(c)) out.tema = 'pasto del tema cibo';
                                    else if (d.moment?.tema) out.tema = 'esperienza nello spirito del tema cibo';
                                }
                                if (tema.tipico && isMealPlace(c)) {
                                    const perche = localCuisineReason(c);
                                    out.tipico = { richiesto: true, locale: !!perche, ...(perche ? { perche } : { nota: 'cucina locale non verificabile dal tipo o dal nome' }) };
                                }
                                return out;
                            };
                            return sched.days.map((dayStops, di) => {
                                const canon = canonicalizeStopsFromCandidates(
                                    dayStops.map(s => ({ place_id: s.candidate.place_id || s.candidate.googlePlaceId })),
                                    candidates,
                                    { guard: false },
                                ).map((stop, i) => ({
                                    ...stop,
                                    // C8a — la passeggiata sta a schermo sotto il drink che la precede (`viewKey`); la sosta
                                    // dell'aperitivo (45 / 60) viaggia con la tappa fino al calcolo dei tempi.
                                    moment: dayStops[i].moment.viewKey || dayStops[i].moment.key,
                                    momentLabel: dayStops[i].moment.viewKey ? (MOMENT_BY_KEY[dayStops[i].moment.viewKey]?.label ?? dayStops[i].moment.label) : dayStops[i].moment.label,
                                    ...(dayStops[i].moment.sostaAperitivo ? { sostaAperitivo: dayStops[i].moment.sostaAperitivo } : {}),
                                    ...(dayStops[i].moment.key === 'passeggiata' ? { passeggiata: true } : {}),
                                    waitMinutesBefore: dayStops[i].waitMinutesBefore,
                                    ...(dayStops[i].source === 'riparata' ? { repaired: true } : {}),
                                    // C1 — tracciato interno, mai a schermo: chi
                                    // l'ha scelta (modello / riparazione / ripiego).
                                    // ORARI — e se l'orario del posto e' noto (aperto per
                                    // tutta la sosta) o sconosciuto.
                                    _tracciato: { ...dayStops[i].trace, ...temaTrace(dayStops[i]), orario: orariTracciato.get(stop.place_id) || 'sconosciuto', ...(orariFonte.get(stop.place_id) ? { orarioFonte: orariFonte.get(stop.place_id) } : {}), ...(stop.nameOriginal ? { nomeOriginale: stop.nameOriginal } : {}) },
                                    _orario: orariTracciato.get(stop.place_id) || 'sconosciuto',
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
                            // ORARI — niente pool per momento: la stessa regola sulla lista. Le tappe
                            // si mettono in orario dalla partenza; una chiusa quando ci si arriva si
                            // toglie e si sostituisce col candidato piu' vicino aperto. Mai una chiusa.
                            const aperti = keepOpenStops({
                                stops: ordered, pool: candidates, start: tourWindow.start,
                                retime: (list) => computeStopTimings(enforceCategoryVariety(sortByProximity(list))).stops,
                                toStop: (c) => canonicalizeStopsFromCandidates([{ place_id: c.place_id || c.googlePlaceId }], candidates, { guard: false })[0] || null,
                            });
                            orariInfo = { chiusi: aperti.chiuse, aggiunte: aperti.aggiunte, ignoti: aperti.ignote, giri: aperti.passi, vietati: [], tappeSenzaFiltro: ordered.length };
                            // Un filtro non lascia mai un buco: se le chiusure hanno accorciato il giro e
                            // non c'era altro di aperto, la riga di tempo libero (regola O) lo dichiara.
                            if (aperti.stops.length < ordered.length) {
                                orariInfo.riga = { key: null, label: null, dayIndex: 0, motivo: "gli altri posti sono chiusi a quest'ora", piuVicino: null, chiuso: true, pasto: false };
                            }
                            if (aperti.chiuse.length > 0) {
                                console.info(`[ORARI] ${city}: ${aperti.chiuse.length} tappe chiuse quando ci si arriva, tolte (${aperti.chiuse.map(x => x.nome).join(', ')}), ${aperti.aggiunte.length} sostituite`);
                            }
                            return [{ ...baseMeta(0), windowIndex: 0, stops: aperti.stops }].filter(d => d.stops.length > 0);
                        })();

                    // C5 — la forma del giro finale nel tracciato: km, incroci,
                    // avanti-e-indietro e marchi ripetuti, giorno per giorno.
                    if (momentReport) {
                        // C5b — l'indice con l'ordine dei momenti (null su un giro
                        // corto), quello libero accanto, e il motivo di un incrocio rimasto.
                        momentReport.percorso = finalDays.map((d, i) => {
                            const r = routeMetrics(d.stops);
                            const rimasto = (momentReport.incrociRimasti || []).find(x => x.giorno === i + 1);
                            return r.incroci && rimasto ? { ...r, motivoIncroci: rimasto.motivo } : r;
                        });
                        for (const [i, r] of momentReport.percorso.entries()) {
                            console.info(`[C5 PERCORSO] ${city} giorno ${i + 1}: ${r.tappe} tappe, ${r.km} km, incroci ${r.incroci}`
                                + `, indice ${r.giroCorto ? 'non applicato (giro corto)' : (r.indice ?? '—')} (libero ${r.indiceLibero ?? '—'}), catene ${r.catene}`
                                + (r.motivoIncroci ? ` — ${r.motivoIncroci}` : ''));
                        }
                    }

                    // ORARI — se i posti chiusi hanno tolto cosi' tanto che restano meno di
                    // 2 tappe aperte, niente giro: un messaggio dichiarato (testo
                    // provvisorio, decisione M). Senza chiusure (o senza orari) non scatta.
                    const orariAgito = !!orariInfo && ((orariInfo.chiusi || []).length > 0 || (orariInfo.vietati || []).length > 0);
                    const tappeAperte = finalDays.reduce((n, d) => n + d.stops.length, 0);
                    // C8a — "quasi tutto chiuso" solo se NIENTE e' aperto per tutta la sosta (0 tappe aperte): con un
                    // locale aperto il giro esiste. (Prima bastavano meno di 2 tappe aperte.)
                    if (orariAgito && tappeAperte === 0 && 0 < (orariInfo.tappeSenzaFiltro ?? Infinity)) {
                        console.info(`[ORARI] ${city}: nessuna tappa aperta a quest'ora → messaggio dichiarato`);
                        return {
                            days: [{ stops: [] }], _source: 'closed-now', _messaggio: messaggioChiuso(tourWindow.start),
                            _orari: orariInfo, ...(momentReport ? { _momentReport: momentReport } : {}), _citta: cittaReport, _modelli: modelliReport,
                        };
                    }

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
                        const daysForNarration = finalDays.map(d => ({
                            ...d,
                            stops: d.stops.map(st => (locali.has(st.place_id) ? { ...st, priceLevel: locali.get(st.place_id).price_level } : st)),
                        }));
                        const factsRes = await fetchFactsForStops(finalStops.map(st => ({
                            place_id: st.place_id, name: st.title, lat: Number(st.latitude), lng: Number(st.longitude), types: st.types,
                        })), { city });
                        const facts = factsRes.byId;
                        // P3d-j — il modello sceglie fra opzioni chiuse, il codice
                        // compone con le frasi approvate. Una chiamata, niente
                        // riscrittura: la riserva e' in codice.
                        const interessi = userInterests({
                            wizard: prefs?.interests || [],
                            text: opts.pathType === 'custom' ? userPrompt : '',
                            dnaWeights: opts.dnaWeights || null,
                        });
                        const voce = { richiesta: userPrompt, oggetto: intent?.oggetto_umano || '' };
                        const ctxs = composeContexts(daysForNarration, { starts, tourWindow, cityCenter, facts, giornata: opts.giornata !== false, utente: opts.startPoint || null });
                        const scelte = await chooseStopHooks({ city, days: daysForNarration, ctxs, interessi, quotaTicket });
                        const composed = composeDays(applyDayMeta(daysForNarration, scelte.meta, city), {
                            starts, tourWindow, cityCenter, facts, scelte: scelte.byId, interessi, voce, utente: opts.startPoint || null,
                        });
                        // C5e (O) — il tempo libero entra nel giorno dopo il racconto,
                        // al suo posto fra i momenti, con il testo del codice.
                        const narratedDays = insertFreeTime(composed.days, [...(momentReport?.tempoLibero || []), ...(orariInfo?.riga ? [orariInfo.riga] : [])]);
                        const allStops = narratedDays.flatMap(d => d.stops);
                        const narrationReport = {
                            raccontate: allStops.length,
                            nonRaccontate: [],
                            composizione: composed.report,
                            interessi,
                            sceltePerTappa: scelte.byId.size,
                            riserve: composed.report.filter(x => x.riserva.length > 0).length,
                            frasiTolte: composed.report.flatMap(x => x.rete.map(frase => ({ place_id: x.place_id, title: x.title, frase }))),
                            errore: scelte.error,
                            fatti: {
                                ...factsRes.report,
                                perTappa: allStops.map(st => ({ place_id: st.place_id, title: st.title, fatti: facts.get(st.place_id)?.fatti || [] })),
                            },
                        };
                        logNarratorViolations(allStops, 'narratore');
                        for (const x of composed.report) {
                            if (x.riserva.length > 0) console.info(`[P3d-j SCELTE] ${city}: "${x.title}" — riserva del codice su ${x.riserva.join(', ')}`);
                            for (const frase of x.rete) console.warn(`[P3d-j RETE] ${city}: "${x.title}" — la rete ha tolto "${frase}" → ricomposta`);
                        }
                        // C8b — le righe di tempo libero dichiarate non sono tappe: "un solo posto" si dice delle tappe vere
                        const singleStop = narratedDays[0].stops.filter(s => !s.tempoLibero).length === 1;
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
                        // C10b — il borgo che si gira in mezza giornata: la riga approvata, sul giorno
                        const noteGiorno = [scalaNote, esclusioneNote].filter(Boolean).join(' ');
                        if (noteGiorno && narratedDays[0]) narratedDays[0].scalaNote = noteGiorno;
                        // BORGO-FIX — decisione 3: natura chiesta, giro che comincia dopo il tramonto, nessuna natura nel giro → la nota di Ivano
                        // (la seconda frase solo se un posto di natura verificato, nel pool, e' aperto domattina alle 9).
                        if (naturaChiesta && narratedDays[0] && !allStops.some(st => isNaturaOPanorama(st))) {
                            const sole0 = sunForDay({ windowIndex: 0 }, 0, tourWindow, cityCenter);
                            const tramonto0 = sole0.sunset;
                            if (tourWindow.start instanceof Date && eBuio(tourWindow.start, sole0)) {
                                const p0 = romeParts(tourWindow.start);
                                // NOTTE-FIX — «domattina alle 9»: se il giro comincia prima dell'alba le 9 sono di questo stesso giorno (era `p0.h < 6`)
                                const alle9 = new Date(romeDate({ y: p0.y, m: p0.m, d: p0.d }, { h: 9, m: 0 }).getTime() + (tourWindow.start.getTime() < sole0.sunrise.getTime() ? 0 : 24 * 3600 * 1000));
                                const luogo = candidates.find(c => isNaturaOPanorama(c) && !isOrganizzazione(c) && openStatus(c, alle9, 45).stato !== 'chiuso') || null;
                                narratedDays[0].naturaNote = NOTA_NATURA_NOTTE(luogo ? (luogo.name || luogo.title) : null);
                                cittaReport.naturaNotte = { nota: narratedDays[0].naturaNote, luogo: luogo ? (luogo.name || luogo.title) : null, tramonto: tramonto0.toISOString(), alle9: alle9.toISOString() };
                            }
                        }
                        // C10b — l'esito di ogni ancora seminata: nel giro, o tolta da una regola dura scritta qui
                        if (Array.isArray(cittaReport.seminate)) {
                            const finali = new Set(allStops.map(st => st.place_id));
                            cittaReport.ancoreEsito = cittaReport.seminate.map(a => {
                                if (finali.has(a.place_id)) return { nome: a.nome, nelGiro: true };
                                const tolta = (momentReport?.ancoreTolte || []).find(x => x.place_id === a.place_id);
                                const vietata = (orariInfo?.vietati || []).some(x => (x.place_id || []).includes(a.place_id));
                                const fuori = (momentReport?.tolte || []).find(x => x.place_id === a.place_id);
                                return { nome: a.nome, nelGiro: false, motivo: tolta?.motivo
                                    || (vietata ? 'regola dura: orari (chiuso quando ci si arriva)' : fuori ? `regola dura: orari (${fuori.motivo})` : 'non nel giro: motivo non registrato') };
                            });
                        }
                        // C10c — un quartiere chiesto: quante tappe stanno nel suo nucleo, e se il giro parte da li'
                        if (nucleo) {
                            const vere = narratedDays.flatMap(d => d.stops || []).filter(st => !st.tempoLibero && Number.isFinite(st.latitude ?? st.lat));
                            const nel = vere.filter(st => dentroNucleo(st, nucleo));
                            cittaReport.tappeNelQuartiere = { nel: nel.length, totali: vere.length, parteDaLi: vere.length > 0 && dentroNucleo(vere[0], nucleo) };
                        }
                        const result = {
                            days: narratedDays, _source: 'google-first', _singleStop: singleStop,
                            ...(foodOn ? { _vincoliCibo: vincoliCibo } : {}),
                            ...(momentReport ? { _momentReport: momentReport } : {}),
                            ...(orariInfo ? { _orari: orariInfo } : {}),
                            _narrationReport: narrationReport,
                            _ovvieta: ovvieta,
                            _famosita: famosita,
                            // C10 — la lista della città in questo giro (stato, verificati, nel pool, ancore, seminate)
                            _citta: cittaReport, _modelli: modelliReport,
                        };
                        // Un narratore caduto non si mette in cache: la prossima
                        // richiesta deve poter avere il suo racconto.
                        if (!scelte.error) saveInsiderToCache(cacheKey, result);
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
                // TROINA-FIX — e' uno zero vero solo con zero candidati (dopo raggio, categoria e vincoli) e la lista arrivata:
                // con dei candidati che nessun momento prende, o senza la lista, il vuoto non e' «non troviamo».
                const listaArrivata = lista.stato !== 'assente' && !lista.errore;
                zeroVero = candidates.length === 0 && listaArrivata;
                if (isFreeTextIntent) {
                    console.info(`[Gate B] path A "${city}" — 0 candidati Places → errore onesto (no fallback AI-first)${zeroVero ? ' (zero vero)' : ''}`);
                    return {
                        days: [{ stops: [] }],
                        _source: 'no-results',
                        _zeroVero: zeroVero,
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
            _zeroVero: zeroVero,
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
    async generateHomeTours(args = {}) {
        const base = await this._homeTemiOBorgo(args);
        return this._conProposteMinime(base, args);
    },

    /**
     * PER-TE-PROPOSTE — almeno PROPOSTE_MINIME proposte, a qualsiasi ora. Se i giri per adesso sono meno, le altre si compongono per
     * il prossimo mattino (10:00 di Roma) dagli stessi pool, SENZA chiamate AI (nessuna quota, 0 $), e dicono `perDopo`.
     */
    async _conProposteMinime(r, args = {}) {
        if (!r || r._source === 'error') return r;
        const { city, cityCenter, themedCandidates, opts = {} } = args;
        const adesso = r.tours || [];
        const riporto = (extra) => ({ ...r, _report: { ...(r._report || {}), proposte: { minime: PROPOSTE_MINIME, adesso: adesso.length, ...extra } } });
        if (adesso.length >= PROPOSTE_MINIME) return riporto({ perDopo: 0, raggiunte: true });
        const pool = themedCandidates && Object.values(themedCandidates).some(a => Array.isArray(a) && a.length > 0);
        if (!pool) return riporto({ perDopo: 0, raggiunte: false, motivo: 'nessun pool dei temi' });
        const rif = riferimentoPerDopo(oraDiPerTe(opts));
        const sera = isSeraStart(oraDiPerTe(opts));
        const dopo = await this._homeTemi({
            ...args,
            opts: {
                ...opts, oraRiferimento: rif.data, senzaAI: true,
                // di giorno un tema gia' servito adesso non si ripropone; il giro della sera (themeType 'insider') non occupa nessun tema
                escludiTemi: sera ? [] : adesso.map(t => t.themeType).filter(t => t !== 'insider'),
                escludiPlaceIds: placeIdDeiGiri(adesso),
            },
        });
        const tours = unisciProposte(adesso, dopo?.tours || [], rif.quando);
        console.info(`[PER-TE-PROPOSTE] ${city}: ${adesso.length} per adesso + ${tours.length - adesso.length} per ${rif.quando} = ${tours.length} (minime ${PROPOSTE_MINIME})`);
        if (tours.length === adesso.length) return riporto({ perDopo: 0, raggiunte: false, motivo: `nessuna proposta per ${rif.quando} (${dopo?._source || '?'})` });
        return {
            ...r,
            tours,
            _source: 'unified-home',
            _messaggio: undefined,
            _report: { ...(r._report || {}), proposte: { minime: PROPOSTE_MINIME, adesso: adesso.length, perDopo: tours.length - adesso.length, quando: rif.quando, raggiunte: tours.length >= PROPOSTE_MINIME, daAdesso: r._source === 'closed-now' ? 'chiuso' : 'aperto', cityCenterUsato: !!cityCenter } },
        };
    },

    async _homeTemiOBorgo(args = {}) {
        const r = await this._homeTemi(args);
        // TROINA-FIX — nei borghi "Per Te" non resta vuoto se ci sono posti veri: quando i temi non danno nessun tour (tutti sotto
        // le 3 tappe aperte, o nessun pool), un tour misto dal motore dei momenti. Un errore (motore AI, quota) resta un errore.
        const { city, cityCenter, opts = {} } = args;
        const borgo = cityCenter?.isSmallTown ?? isSmallTown(city);
        const vuoto = (r?.tours || []).length === 0 && ['closed-now', 'no-pools', 'unified-home'].includes(r?._source);
        if (!borgo || !vuoto || isSeraStart(oraDiPerTe(opts))) return r;
        console.info(`[TROINA-FIX] Per Te ${city}: nessun tour dai temi (${r._source}) → un tour misto del borgo dal motore dei momenti`);
        const m = await this._homeBorgo(args);
        if ((m.tours || []).length > 0) return { ...m, _report: { ...m._report, temi: { source: r._source, report: r._report ?? null } } };
        return { ...r, _report: { ...(r._report || {}), borgoMisto: { source: m._source, report: m._report ?? null } } };
    },

    async _homeTemi({ city, cityCenter, themedCandidates, prefs = {}, aiProfile = '', weather = {}, opts = {} } = {}) {
        // C8b — DI SERA "PER TE" E' IL GIRO DELLA SERA. Dalle 18:00 fino all'alba i cinque tour tematici (trattorie a
        // quell'ora, musei chiusi) non hanno senso: la sera ha una forma sola — drink + passeggiata + cena, con la cena
        // tardi se parti fra le 21:00 e le 22:00 — ed e' quella del motore dei momenti (come il Percorso Veloce). Per Te la
        // chiede a lui e la serve come UN tour; i temi non si cercano nemmeno (vedi DashboardUser: nessuna ricerca in piu').
        if (isSeraStart(oraDiPerTe(opts))) {
            return this._homeSera({ city, cityCenter, prefs, aiProfile, weather, opts });
        }
        // Gate PER TE — distanza e doppioni si decidono QUI, prima del prompt
        // (prepareHomePools). Un pool rimasto vuoto non entra nel prompt.
        // P7a2 — i pool dei temi si ordinano per merito dentro prepareHomePools;
        // il DNA entra solo con fiducia (opts.dnaWeights._share > 0).
        const dnaWeights = opts.dnaWeights && opts.dnaWeights._share > 0 ? opts.dnaWeights : { _share: 0 };
        // P7b — "Per Te" non ha testo ne' wizard: vale il primo accesso.
        const food = resolveFoodPrefs({ onboarding: opts.onboardingPrefs });
        const nonEmptyPools = prepareHomePools(themedCandidates, cityCenter, city, { dnaWeights, foodPrefs: food });
        // PER-TE-PROPOSTE — le proposte «per dopo» (opts.senzaAI): nessun tema già servito, nessun posto già in un altro tour.
        if (opts.senzaAI) {
            const fuoriTemi = new Set(opts.escludiTemi || []);
            const fuoriPosti = new Set(opts.escludiPlaceIds || []);
            for (const tema of Object.keys(nonEmptyPools)) {
                if (tema === 'ceduti') continue;
                if (fuoriTemi.has(tema)) { delete nonEmptyPools[tema]; continue; }
                const resto = (nonEmptyPools[tema] || []).filter(c => !fuoriPosti.has(homePid(c)));
                if (resto.length === 0) delete nonEmptyPools[tema]; else nonEmptyPools[tema] = resto;
            }
        }
        if (Object.keys(nonEmptyPools).filter(k => k !== 'ceduti').length === 0) {
            return { tours: [], _source: 'no-pools' };
        }

        // Gate PER TE — il momento della giornata, sull'ora di Roma, dalla
        // tabella dei momenti (dayMoments.js). Prima qui c'erano cinque soglie
        // scritte a mano (6/11/14/18/22) sull'ora del TELEFONO: una seconda
        // tabella, divergente da quella che usa il resto dell'app.
        const now = oraDiPerTe(opts);
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
        // P3d-j — v2: le voci v1 avevano testo libero del modello.
        const cacheKey = `hometours_v2_${city.replace(/\s+/g, '_')}_${centerFingerprint}_${romeDay}_${moment.key}_${hashStr(poolStr + dnaKey)}`;
        const cached = opts.senzaAI ? null : loadInsiderFromCache(cacheKey);
        // Gate PAROLE VIETATE (P3d) — anche la lettura dalla cache passa dal filtro.
        if (cached) return scrubHomeTours(cached, city);

        // Quota: 1 call = 1 generazione (biglietto home_tours: il server concede
        // 4000 max_tokens solo a questo tipo). skipUserQuota salta solo il preflight.
        // PER-TE-PROPOSTE — senzaAI: nessuna chiamata, nessuna quota.
        if (!opts.skipUserQuota && !opts.senzaAI) {
            await assertQuotaAvailable();
        }
        const quotaTicket = opts.senzaAI ? null : newGenerationTicket('home_tours');

        // P3d-j — gli interessi dell'utente per il gancio "legame": in "Per Te"
        // non c'e' testo ne' wizard, vale il DNA sopra la soglia di fiducia.
        const interessiPerTe = userInterests({ dnaWeights });
        const prompt = opts.senzaAI ? '' : buildUnifiedHomeToursPrompt({
            city, timeContext, weather,
            prefs, aiProfile, themedCandidates: nonEmptyPools, interessi: interessiPerTe,
        });

        const MAX_TOKENS = 4000;
        // Timeout 45s: prompt piu' grande + output 4000 tokens = puo' richiedere
        // ~15-25s reali. Insider da solo era 35s con 2000 tokens.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45_000);
        try {
            let rawTours; let truncated = false; let finishReason = null; let tokenRisposta = null;
            if (opts.senzaAI) {
                // PER-TE-PROPOSTE — nessuna chiamata AI: i tour li compone il codice dai pool (ordinati per merito e DNA), le frasi
                // sono quelle di riserva di sempre. Serve per le proposte «per dopo» (domattina): costo 0, nessuna quota.
                clearTimeout(timeoutId);
                rawTours = tourDaiPool(nonEmptyPools, city);
            } else {
            const data = await callOpenAIProxy({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: `Costruisci i tour. Ricorda: place_id dal blocco tema corrispondente; per ogni tappa solo usaFatto, gancio e interesse, nessun testo.` },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.7,
                max_tokens: MAX_TOKENS,
            }, controller.signal, quotaTicket);
            clearTimeout(timeoutId);

            const raw = data.choices?.[0]?.message?.content;
            if (!raw) throw new Error('Empty AI response (generateHomeTours)');
            finishReason = data.choices?.[0]?.finish_reason ?? null;
            tokenRisposta = Number.isFinite(data.usage?.completion_tokens) ? data.usage.completion_tokens : null;
            // Gate PER TE — risposta tagliata (max_tokens): si servono i tour
            // completi, mai un errore per questo.
            const parsed = parseHomeToursResponse(raw);
            rawTours = parsed.tours; truncated = parsed.truncated;
            if (truncated) {
                console.warn(`[Per Te] ${city}: risposta tagliata (finish_reason=${finishReason}, ${tokenRisposta ?? '?'}/${MAX_TOKENS} token) → ${rawTours.length} tour completi recuperati`);
            }
            if (!Array.isArray(rawTours) || (rawTours.length === 0 && !truncated)) throw new Error('AI returned no tours (generateHomeTours)');
            }

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

                // P3d-j — della tappa si tengono solo le scelte chiuse del
                // modello; il testo lo compone il codice dopo l'ordinamento.
                const sceltaDi = new Map(aiStops.filter(st => st?.place_id).map(st => [st.place_id, {
                    usaFatto: st.usaFatto, gancio: st.gancio, interesse: st.interesse ?? null,
                }]));
                canonized = canonized.map(st => ({ ...st, _scelta: sceltaDi.get(st.place_id) || {} }));
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
            const factsRes = opts.senzaAI ? { byId: new Map(), report: { senzaAI: true } } : await fetchFactsForStops(sceltePerTe.map(st => ({
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
            const composizione = [];

            // (1b) P7a2 — RIEMPIRE PRIMA DI NASCONDERE. Un tour sotto le 3 tappe
            // (scarti: place_id fuori pool, doppioni) riceve in codice delle
            // RISERVE: i migliori candidati Gate MERITO rimasti nel SUO pool, che
            // nessun altro tour usa. P3d-j: la descrizione di una riserva si
            // compone come le altre (scelte di riserva del codice), senza
            // chiamate in piu'.
            const usati = new Set();
            for (const pt of prepared) for (const st of pt?.canonized || []) if (st.place_id) usati.add(st.place_id);
            const aggiunte = [];
            prepared.forEach((pt) => {
                if (!pt) return;
                const pool = nonEmptyPools[pt.themeType] || [];
                for (const c of pool) {
                    if (pt.canonized.length >= HOME_TOUR_STOPS.min) break;
                    const pid = homePid(c);
                    if (!pid || usati.has(pid)) continue;
                    const [st] = canonicalizeStopsFromCandidates([{ place_id: pid }], pool, { guard: false });
                    if (!st) continue;
                    usati.add(pid);
                    pt.canonized.push({ ...st, _scelta: {} });
                    aggiunte.push({ tour: pt.themeType, title: st.title, place_id: pid });
                }
            });

            const orariPerTe = []; // ORARI — per tour: tappe chiuse tolte, sostituzioni, orari ignoti
            // TESTI — i tour di "Per Te" stanno insieme sulla home: nessuna frase uguale due volte fra uno e l'altro (come il controllo c7 del banco)
            const usate = new Set();
            const finalTours = prepared.map((pt) => {
                if (!pt) return null;
                const { tour, themeType } = pt;
                const canonized = pt.canonized.map(st => (locali.has(st.place_id) ? { ...st, priceLevel: locali.get(st.place_id).price_level } : st));

                // Safety filtro raggio: il pool e' gia' entro il raggio
                // (prepareHomePools), qui non dovrebbe togliere niente — se lo
                // fa, il motivo si vede.
                const withinRadius = applyRadiusFilter(canonized, cityCenter, city);
                for (const st of canonized) {
                    if (!withinRadius.includes(st)) scarta(themeType, st.title, 'oltre il raggio');
                }
                // DIFF 1a: le stime SUBITO dopo il sort, mai prima.
                // P3d-j: la frase dopo le stime (minuti, prima e ultima tappa).
                // "Per Te" e' adesso: niente orario d'arrivo, quindi niente
                // ganci "orario" e "tramonto"; la luce si controlla su adesso.
                // ORARI — "Per Te" e' adesso: le tappe si mettono in orario da ora; una
                // chiusa quando ci si arriva (arrivo → arrivo + sosta) si toglie e si
                // sostituisce col candidato del suo tema piu' vicino che sia aperto.
                // Se non ne restano abbastanza il tour non e' servito (regola esistente).
                const poolTema = nonEmptyPools[themeType] || [];
                // GIRO-EDIT — LA COLAZIONE DI PER TE: un giro che parte prima delle 10:30 (e dopo l'alba) comincia con una colazione vicina
                // alla prima tappa (entro 500 m, aperta per la sosta, mai gia' in un altro tour). Un tour che comincia gia' con un posto da
                // colazione (il tour cibo del mattino) non ne riceve un'altra. Niente colazione adatta: il tour e' quello di prima.
                const nowMin = nowRome.h * 60 + nowRome.mi;
                const ordinate = sortByProximity(withinRadius);
                let colazioneId = null;
                let tappe = ordinate;
                if (!colazioneAutoSpenta() && nowMin >= ALBA_MINUTES && nowMin < COLAZIONE_AUTO_ENTRO_MINUTES && ordinate.length > 0 && !isBreakfastPlace(ordinate[0])) {
                    const primo = ordinate[0];
                    const nelTour = new Set(ordinate.map(x => x.place_id));
                    const scelta = [...poolById.values()]
                        .filter(c => homePid(c) && !usati.has(homePid(c)) && !nelTour.has(homePid(c)) && isBreakfastPlace(c) && openStatus(c, now, 20).stato === 'aperto')
                        .map(c => ({ c, km: haversineKm(Number(primo.latitude), Number(primo.longitude), Number(c.latitude ?? c.lat), Number(c.longitude ?? c.lng)) }))
                        .filter(x => Number.isFinite(x.km) && x.km * 1000 <= 500)
                        .sort((a, b) => a.km - b.km)[0];
                    if (scelta) {
                        const [col] = canonicalizeStopsFromCandidates([{ place_id: homePid(scelta.c) }], [scelta.c], { guard: false });
                        if (col) {
                            colazioneId = col.place_id;
                            usati.add(colazioneId);
                            tappe = [{ ...col, _scelta: {}, moment: 'mattina', momentLabel: 'Mattina' }, ...ordinate];
                        }
                    }
                }
                // rimette in ordine tenendo la colazione per prima (la sola tappa che non si riordina per vicinanza)
                const riordina = (lista) => {
                    const col = colazioneId ? lista.find(x => x.place_id === colazioneId) : null;
                    return computeStopTimings(col ? [col, ...sortByProximity(lista.filter(x => x !== col))] : sortByProximity(lista)).stops;
                };
                const aperti = keepOpenStops({
                    // C8b — le stesse fasce dei pasti di Crea: un ristorante solo a pranzo e a cena, la mattina una colazione.
                    // GIRO-EDIT — la colazione scelta qui sopra e' un posto da colazione aperto: non passa dalla regola del dolce (una pasticceria e' la colazione).
                    invalidAt: (c, arrivo, altre) => (colazioneId && homePid(c) === colazioneId ? (mealFitsClock(c, romeMinutes(arrivo)) ? null : 'pasto fuori fascia') : perTeMealProblem(c, romeMinutes(arrivo), arrivo, altre))
                        // BORGO-FIX — decisione 3: la natura «da fuori» dopo il tramonto non e' una tappa nemmeno in Per Te
                        // NOTTE-FIX — la terza copia della regola: «al buio» = prima dell'alba o dal tramonto (eBuio), non solo dal tramonto
                        || (arrivo instanceof Date && eBuio(arrivo, sunNow) && isNaturaDaFuori(c, cityCenter) ? 'natura da fuori al buio' : null),
                    stops: computeStopTimings(tappe).stops, pool: poolTema, start: now, exclude: usati,
                    retime: riordina,
                    toStop: (c) => {
                        const [nuovo] = canonicalizeStopsFromCandidates([{ place_id: homePid(c) }], poolTema, { guard: false });
                        return nuovo ? { ...nuovo, _scelta: {} } : null;
                    },
                });
                for (const a of aperti.aggiunte) usati.add(a.place_id);
                orariPerTe.push({ tour: themeType, chiuse: aperti.chiuse, aggiunte: aperti.aggiunte, ignote: aperti.ignote });
                for (const x of aperti.chiuse) scarta(themeType, x.nome, `chiuso quando ci si arriva (${x.perche || 'orari'})`);
                const timedStops = aperti.stops;
                const ordered = timedStops.map((st, i) => {
                    const { _scelta, ...clean } = st;
                    const entry = facts.get(st.place_id);
                    const fatti = entry?.fatti || [];
                    const fattiSu = factsAbout(entry);
                    const d = stopData({
                        stop: clean, momento: moment.key, minutiDaPrima: clean.travelMinutesFromPrev,
                        locale: isLocaleStop(clean),
                        priceLevel: Number.isFinite(clean.priceLevel) ? clean.priceLevel : priceLevelOf(poolById.get(clean.place_id)),
                        fatti, primo: i === 0, distanzaUtenteM: i === 0 ? distanzaDaUtenteM(opts?.startPoint || null, clean) : null, ultimo: i === timedStops.length - 1, giornata: false,
                    });
                    const r = guardComposed(d, _scelta || {}, {
                        interessi: interessiPerTe, arrival: now, sunrise: sunNow.sunrise, sunset: sunNow.sunset, fatti, fattiSu, evita: usate,
                    });
                    registraFrasi(usate, r.text, d.nome);
                    composizione.push({
                        tour: themeType, place_id: st.place_id, title: st.title, scelta: _scelta || {}, usaFatto: r.composta.usaFatto,
                        gancio: r.composta.gancio, interesse: r.composta.interesse, riserva: r.composta.riserva,
                        rete: r.rete.map(x => x.frase), description: r.text,
                    });
                    return {
                        ...clean,
                        description: r.text,
                        insiderTip: null, bestTime: null, transition: null,
                        fonti: r.composta.usaFatto && entry?.fonti?.length ? entry.fonti : null,
                        _comp: { scelta: _scelta || {} },
                    };
                });
                if (ordered.length === 0) {
                    console.warn(`[Per Te] ${city}: tour "${themeType}" senza tappe dopo gli scarti → non servito`);
                } else if (ordered.length < HOME_TOUR_STOPS.min) {
                    // P7a — un tour "Per Te" con meno di 3 tappe non e' un tour.
                    for (const st of ordered) scarta(themeType, st.title, `tour con meno di ${HOME_TOUR_STOPS.min} tappe: nessun candidato valido rimasto nel pool`);
                }

                // P7b — la riga onesta, se il tour ha un pasto cercato col criterio.
                const byIdPool = new Map((nonEmptyPools[themeType] || []).map(c => [homePid(c), c]));
                const pastoCercato = food.dieta.length > 0 && ordered.some(st => isMealPlace(st)
                    && Array.isArray(byIdPool.get(st.place_id)?._dietaCercata) && byIdPool.get(st.place_id)._dietaCercata.length > 0);
                return {
                    themeType,
                    title: dayTitle(tour.title, `Tour di ${city}`),
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
                composizione,
                riserve: composizione.filter(x => x.riserva.length > 0).length,
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
                orari: {
                    chiuse: orariPerTe.flatMap(t => t.chiuse.map(x => ({ tour: t.tour, ...x }))),
                    aggiunte: orariPerTe.flatMap(t => t.aggiunte.map(x => ({ tour: t.tour, ...x }))),
                    ignote: orariPerTe.reduce((n, t) => n + t.ignote, 0),
                },
            };
            console.info(`[Per Te] ${city}: ${report.tourServiti}/${report.tourProposti} tour, ${report.tappeServite}/${report.tappeRaccontate} tappe servite (${aggiunte.length} aggiunte in codice), ${scarti.length} scarti, ${tokenRisposta ?? '?'}/${MAX_TOKENS} token${truncated ? ', risposta tagliata' : ''}, famosita' mediana ${famosita.mediana ?? '-'} / ${famosita.sopraSoglia} sopra ${famosita.soglia}, ovvieta' ${ovvieta.nelTop10}/${ovvieta.tappe}`);
            // ORARI — se i posti chiusi hanno tolto tutti i tour: il messaggio dichiarato, non un'home vuota.
            if (finalTours.length === 0 && report.orari.chiuse.length > 0) {
                console.info(`[ORARI] Per Te ${city}: nessun tour con posti aperti a quest'ora → messaggio dichiarato`);
                return { tours: [], _source: 'closed-now', _messaggio: messaggioChiuso(now), _report: report };
            }
            const result = { tours: finalTours, _source: 'unified-home', _report: report };
            if (!opts.senzaAI) saveInsiderToCache(cacheKey, { tours: finalTours, _source: 'unified-home' });
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

    /**
     * C8b — "Per Te" di sera: un tour solo, fatto dal motore dei momenti (drink + passeggiata + cena).
     * @returns {Promise<{ tours: Array, _source: string, _messaggio?: string, _report: object }>}
     */
    async _homeSera({ city, cityCenter, prefs = {}, aiProfile = '', weather = {}, opts = {} }) {
        return this._homeDaMotore({ city, cityCenter, prefs, aiProfile, weather, opts, durata: 'Veloce', pathType: 'quick', serale: true });
    },

    /**
     * TROINA-FIX — "Per Te" in un borgo dove nessun tema arriva a 3 tappe aperte (Troina a mezzogiorno: i musei chiusi, il
     * belvedere e il monte soli nel loro tema): UN tour misto, fatto dal motore dei momenti come la sera (i posti veri della
     * lista e delle ricerche, il giro corto del borgo, gli orari all'arrivo), mezza giornata da adesso. Solo nei borghi e solo
     * quando i temi non danno nessun tour: il resto di "Per Te" non cambia.
     */
    async _homeBorgo({ city, cityCenter, prefs = {}, aiProfile = '', weather = {}, opts = {} }) {
        return this._homeDaMotore({ city, cityCenter, prefs, aiProfile, weather, opts, durata: 'Mezza Giornata', pathType: undefined, serale: false });
    },

    /** Un solo tour di "Per Te" dal motore dei momenti (la sera, o il tour misto del borgo). */
    async _homeDaMotore({ city, cityCenter, prefs = {}, aiProfile = '', weather = {}, opts = {}, durata, pathType, serale }) {
        const now = requestNow(opts);
        const nowRome = romeParts(now);
        const prefsSera = { duration: durata, group: prefs?.group || 'solo', pace: prefs?.pace || 'rilassato', interests: [] };
        // BORGO-SCHERMO — un giro suggerito adesso non e' una giornata: niente «Qui la giornata si chiude» (come Per Te a temi)
        const r = await this.generateItinerary(city, prefsSera, '', weather, aiProfile, cityCenter, { ...opts, pathType, giornata: false });
        const report = {
            serale,
            ...(serale ? {} : { borgoMisto: true }),
            momento: momentAtClock(nowRome.h, nowRome.mi).key,
            giorno: `${nowRome.y}-${String(nowRome.m).padStart(2, '0')}-${String(nowRome.d).padStart(2, '0')}`,
            fatti: r._narrationReport?.fatti, composizione: r._narrationReport?.composizione || [],
            orari: { chiuse: [], aggiunte: [], ignote: 0 },
            momentReport: r._momentReport || null,
        };
        if (r._source === 'closed-now') return { tours: [], _source: 'closed-now', _messaggio: r._messaggio, _report: report };
        const day = (r.days || []).find(d => (d.stops || []).some(st => !st.tempoLibero));
        if (!day) return { tours: [], _source: r._source || 'no-results', _report: report };
        const tour = {
            themeType: 'insider',
            title: dayTitle(day.title, `Tour di ${city}`),
            mapMood: VALID_MOODS.has(day.mapMood) ? day.mapMood : 'default',
            suggestedTransit: VALID_TRANSIT.has(day.suggestedTransit) ? day.suggestedTransit : 'walking',
            stops: day.stops,
            ...(day.dietNote ? { dietNote: day.dietNote } : {}),
        };
        return { tours: [tour], _source: 'unified-home', _report: report, ...(r.tourWindow ? { tourWindow: r.tourWindow } : {}) };
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
                    // P3d-j — il meteo vero, o nessun meteo.
                    weather: realWeather(weather),
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

            // ORARI — l'ora di chi legge: una chiusura gia' passata non si scrive (e il posto e' chiuso).
            const adesso = ctx.now instanceof Date ? ctx.now : new Date();
            const adessoMin = adesso.getHours() * 60 + adesso.getMinutes();
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
                    closingTimeTodayHH: chiusuraFutura(oh.closingTimeTodayHH, adessoMin) ? oh.closingTimeTodayHH : null,
                    chiusoGia: !!oh.closingTimeTodayHH && !chiusuraFutura(oh.closingTimeTodayHH, adessoMin),
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
            const nowH = adesso.getHours();
            const nowM = adesso.getMinutes().toString().padStart(2, '0');
            const tempStr = Number.isFinite(ctx.temperatureC) ? `${ctx.temperatureC}°C` : null;
            const weatherStr = ctx.condition || null;

            // Gate N.1 — Preferisci closingTimeTodayHH (dato strutturale da
            // place/details) a openNow (istantaneo da textsearch, spesso in ritardo).
            // Se hai closingTime → "chiude alle 22:00". Se non hai closingTime ma
            // hai openNow → "aperto adesso" / "chiuso ora". Se nessuno dei due →
            // NESSUN claim sull'apertura.
            const candidatesBlock = enriched.filter(c => !c.chiusoGia).map((c, i) => {
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
            }, undefined, undefined, 'notifiche'); // FORNITORE-AI: il proxy sa che e' una notifica

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
            // ORARI — nessun orario gia' passato nel testo (nemmeno scritto dal modello): si scarta.
            const passati = orariPassatiNelTesto(cleanMessage, adessoMin);
            if (passati.length) {
                console.warn(`[SmartNotif] ${city}/${slot}: orario gia' passato nel testo (${passati.join(', ')}) → scarto`);
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
                .filter(c => !c.chiusoGia)
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

// C10b3-ter — il testo del traduttore, per il test che controlla gli esempi
export { INTENT_TRANSLATOR_PROMPT };
