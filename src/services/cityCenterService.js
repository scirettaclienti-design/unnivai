// Gate 1 FASE A — cityCenterService
//
// Risolve UN centro città autoritativo (lat/lng) partendo dal nome. Vive qui
// perché il centro NON deve più essere calcolato dai chiamanti (era il buco #3:
// il GPS utente veniva usato come centro del raggio, che quindi seguiva l'utente
// invece della città).
//
// Contratto (locked Ivano):
// - Il centro viene dal centro amministrativo della città target, mai dal GPS.
// - Due tentativi Google Places, poi throw. Nessun fallback nascosto.
// - Cache localStorage 30 giorni (i centri città non si spostano).
// - Response shape STRETTA: { latitude, longitude, isSmallTown, radiusKm, source }.
//   Nessun placeId, formatted_address, viewport. Se un chiamante vorrà di più,
//   lo chiederà e lo aggiungeremo allora.
//
// Errori distinti (importante per debug):
// - Rete/proxy giù/quota esaurita  → CityCenterUnresolvedError con reason='proxy'
// - Città non trovata su Google    → CityCenterUnresolvedError con reason='not_found'
// Non confondere i due: sono bug diversi da diagnosticare.

import { buildPlacesProxyUrl, isPlacesProxyEnabled } from './aiRecommendationService';
import { isSmallTown } from './tourShape';

// ─── Cache ─────────────────────────────────────────────────────────────────────
// I centri città sono stabili: 30 giorni è largamente conservativo.
// Prefix dedicato per evitare collisioni con altri cache (poiv*, insider*).
const CACHE_PREFIX = 'unnivai_citycenter_v1_';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 giorni

const cacheKey = (cityName) => CACHE_PREFIX + String(cityName || '').toLowerCase().trim().replace(/\s+/g, '_');

const loadFromCache = (cityName) => {
    try {
        const raw = localStorage.getItem(cacheKey(cityName));
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts > CACHE_TTL_MS) {
            localStorage.removeItem(cacheKey(cityName));
            return null;
        }
        return data;
    } catch {
        return null;
    }
};

const saveToCache = (cityName, data) => {
    try {
        localStorage.setItem(cacheKey(cityName), JSON.stringify({ ts: Date.now(), data }));
    } catch { /* localStorage pieno o disabilitato: non blocchiamo */ }
};

// ─── Errore tipizzato ──────────────────────────────────────────────────────────
// I chiamanti possono fare `catch (e) { if (e instanceof CityCenterUnresolvedError) ... }`
// e leggere `e.reason` per distinguere proxy vs not_found nei log/UI.
export class CityCenterUnresolvedError extends Error {
    constructor(cityName, reason, cause) {
        const msg = reason === 'proxy'
            ? `[cityCenter] proxy unreachable while resolving "${cityName}"`
            : `[cityCenter] city "${cityName}" not found on Google Places`;
        super(msg);
        this.name = 'CityCenterUnresolvedError';
        this.reason = reason;   // 'proxy' | 'not_found'
        this.city = cityName;
        if (cause) this.cause = cause;
    }
}

// ─── Types accettati come "centro amministrativo di una città italiana" ───────
// locality                       = comune / paese
// administrative_area_level_3    = comune (borghi siciliani, marchigiani, etc)
// administrative_area_level_2    = provincia (capoluoghi: es. "Palermo" torna spesso qui)
// Se un candidato ha almeno uno di questi types, è un centro città valido.
const ACCEPTED_CITY_TYPES = new Set([
    'locality',
    'administrative_area_level_3',
    'administrative_area_level_2',
]);

const hasAcceptedType = (types) => Array.isArray(types) && types.some(t => ACCEPTED_CITY_TYPES.has(t));

// ─── Raggio di default per città vs borgo ─────────────────────────────────────
// Coerente con applyRadiusFilter in tourShape.js (borgo 5 km, città 10 km).
// Iniettato QUI una volta sola: i chiamanti passeranno il cityCenter completo,
// applyRadiusFilter legge cityCenter.radiusKm ?? default e trova il valore corretto.
const RADIUS_SMALL_KM = 5;
const RADIUS_LARGE_KM = 10;

// ─── Chiamate Google Places tramite proxy ──────────────────────────────────────

// Tentativo 1: findplacefromtext — cerca UN posto, il più rilevante per il testo.
// Se il proxy risponde ma il candidato non ha un type accettato, ritorna null
// (non è un errore: proviamo il tentativo 2). Se il proxy è irraggiungibile,
// throwiamo con reason='proxy'.
const tryFindPlace = async (cityName) => {
    const proxyUrl = buildPlacesProxyUrl({
        path: 'place/findplacefromtext',
        input: `${cityName}, Italia`,
        inputtype: 'textquery',
        fields: 'name,geometry,types',
    });
    let res;
    try {
        res = await fetch(proxyUrl);
    } catch (err) {
        throw new CityCenterUnresolvedError(cityName, 'proxy', err);
    }
    if (!res.ok) {
        // 5xx dal proxy o dall'upstream Google: problema infrastrutturale, non "not found".
        throw new CityCenterUnresolvedError(cityName, 'proxy', new Error(`HTTP ${res.status}`));
    }
    let data;
    try { data = await res.json(); } catch (err) {
        throw new CityCenterUnresolvedError(cityName, 'proxy', err);
    }
    // Google trasporta lo status applicativo dentro data.status
    if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'REQUEST_DENIED' || data.status === 'UNKNOWN_ERROR') {
        throw new CityCenterUnresolvedError(cityName, 'proxy', new Error(`Google status=${data.status}`));
    }
    if (data.status !== 'OK' || !Array.isArray(data.candidates) || data.candidates.length === 0) {
        return null; // ZERO_RESULTS o vuoto: passa al tentativo 2
    }
    const c = data.candidates[0];
    if (!hasAcceptedType(c.types)) return null; // type non accettato: passa al tentativo 2
    const lat = c.geometry?.location?.lat;
    const lng = c.geometry?.location?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng, source: 'places_find' };
};

// Tentativo 2: textsearch — lista di risultati, prendo il primo con type accettato.
// Rete: throw con 'proxy'. Nessun risultato utile: return null (il chiamante throwerà 'not_found').
const tryTextSearch = async (cityName) => {
    const proxyUrl = buildPlacesProxyUrl({
        path: 'place/textsearch',
        query: `${cityName}, Italia`,
    });
    let res;
    try {
        res = await fetch(proxyUrl);
    } catch (err) {
        throw new CityCenterUnresolvedError(cityName, 'proxy', err);
    }
    if (!res.ok) {
        throw new CityCenterUnresolvedError(cityName, 'proxy', new Error(`HTTP ${res.status}`));
    }
    let data;
    try { data = await res.json(); } catch (err) {
        throw new CityCenterUnresolvedError(cityName, 'proxy', err);
    }
    if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'REQUEST_DENIED' || data.status === 'UNKNOWN_ERROR') {
        throw new CityCenterUnresolvedError(cityName, 'proxy', new Error(`Google status=${data.status}`));
    }
    if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
        return null;
    }
    const match = data.results.find(r => hasAcceptedType(r.types));
    if (!match) return null;
    const lat = match.geometry?.location?.lat;
    const lng = match.geometry?.location?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng, source: 'places_text' };
};

// ─── API pubblica ──────────────────────────────────────────────────────────────

/**
 * Risolve il centro amministrativo di una città italiana.
 *
 * @param {string} cityName  Nome della città (case-insensitive, whitespace tollerato).
 * @returns {Promise<{latitude:number, longitude:number, isSmallTown:boolean, radiusKm:number, source:'cache'|'places_find'|'places_text'}>}
 * @throws {CityCenterUnresolvedError} se proxy irraggiungibile OR città non trovata.
 *
 * Regole (locked Ivano):
 * - NON usa il GPS utente come fallback.
 * - NON inventa coordinate.
 * - Fail-CLOSED con throw esplicito (`.reason` distingue 'proxy' vs 'not_found').
 * - Il `source` è enum stretto per il logging: nessun chiamante deve prendere
 *   decisioni sul suo valore.
 */
export async function resolveCityCenter(cityName) {
    if (!cityName || typeof cityName !== 'string' || !cityName.trim()) {
        throw new CityCenterUnresolvedError(String(cityName), 'not_found');
    }
    const name = cityName.trim();

    // 1) Cache 30gg — i centri città non si spostano.
    const cached = loadFromCache(name);
    if (cached && Number.isFinite(cached.latitude) && Number.isFinite(cached.longitude)) {
        return { ...cached, source: 'cache' };
    }

    // Se il proxy è OFF in prod (flag env), non c'è modo di risolvere in modo
    // autoritativo: fail-closed (l'utente vedrà un errore, il tour non parte).
    // Questo è il comportamento voluto: meglio nessun tour che un tour senza
    // garanzia geografica.
    if (!isPlacesProxyEnabled()) {
        throw new CityCenterUnresolvedError(name, 'proxy', new Error('places-proxy disabled by VITE_PLACES_PROXY_ENABLED'));
    }

    // 2) Google findplacefromtext (throw solo su rete/quota)
    let hit = await tryFindPlace(name);

    // 3) Fallback textsearch se il tentativo 1 non ha match utile
    if (!hit) {
        hit = await tryTextSearch(name);
    }

    // 4) Nessuno dei due ha trovato un candidato con type accettato
    if (!hit) {
        throw new CityCenterUnresolvedError(name, 'not_found');
    }

    // 5) Enrichment: isSmallTown + radiusKm.
    const small = isSmallTown(name);
    const result = {
        latitude: hit.latitude,
        longitude: hit.longitude,
        isSmallTown: small,
        radiusKm: small ? RADIUS_SMALL_KM : RADIUS_LARGE_KM,
        source: hit.source, // 'places_find' | 'places_text'
    };

    saveToCache(name, result);
    return result;
}

// Utility esportata per i test: forza un valore in cache senza chiamare il proxy.
// Non usata dai chiamanti in produzione.
export const __testing__ = {
    cacheKey,
    CACHE_PREFIX,
    CACHE_TTL_MS,
    ACCEPTED_CITY_TYPES,
    RADIUS_SMALL_KM,
    RADIUS_LARGE_KM,
};
