// Gate INTERESSI-VERI — "Google ha risposto zero" non e' "la ricerca e' fallita".
//
// Prima discoverRealPOIs trattava allo stesso modo ZERO_RESULTS, HTTP 500, rete
// giu' e qualunque eccezione: ritornava [] e a valle diventava sempre "non
// trovo luoghi verificati". Ora:
//   - Google risponde ZERO_RESULTS (o i suoi risultati non passano i filtri) → []
//   - rete / HTTP / status di errore / eccezione → PlacesSearchError
// e il Percorso B restituisce `_source: 'search-error'` invece di 'no-results'.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    discoverRealPOIs,
    placesDiscoveryService,
    PlacesSearchError,
    PLACES_SEARCH_ERROR_MESSAGE,
} from '../../services/placesDiscoveryService';
import { aiRecommendationService } from '../../services/aiRecommendationService';

const ROMA = { latitude: 41.9028, longitude: 12.4964, isSmallTown: false, radiusKm: 12 };
const near = (i) => ({ lat: ROMA.latitude + 0.002 * (i + 1), lng: ROMA.longitude + 0.001 * (i + 1) });
const PLACES = ['pid-1', 'pid-2', 'pid-3'].map((id, i) => ({
    place_id: id, name: `Luogo ${i + 1}`, geometry: { location: near(i) },
    rating: 4.6, user_ratings_total: 900, business_status: 'OPERATIONAL',
    types: ['museum', 'tourist_attraction', 'point_of_interest'],
}));
const SELECTOR = { days: [{ day: 1, title: 'Roma', stops: PLACES.map(p => ({ place_id: p.place_id, description: 'Pietra calda' })) }] };

// textsearch(query) decide la risposta per ogni ricerca.
const routeFetch = (textsearch) => vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('openai-proxy')) {
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(SELECTOR) } }] }) };
    }
    if (u.includes('textsearch')) return textsearch(new URL(u, 'http://x').searchParams.get('query'));
    if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
    throw new Error(`fetch inatteso: ${u}`);
});
const ok = (results) => ({ ok: true, status: 200, json: async () => ({ status: 'OK', results }) });
const zero = () => ({ ok: true, status: 200, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) });
const networkDown = () => { throw new TypeError('Failed to fetch'); };

const percorsoB = (interests) => aiRecommendationService.generateItinerary('Roma', { interests }, '', {}, '', ROMA);

beforeEach(() => {
    vi.clearAllMocks();
    try { window.localStorage.clear(); } catch { /* jsdom */ }
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('discoverRealPOIs — zero contro errore', () => {
    it('ZERO_RESULTS da Google → [] (risposta vera: non c\'e\' niente)', async () => {
        vi.stubGlobal('fetch', routeFetch(zero));
        await expect(discoverRealPOIs('Roma', ROMA.latitude, ROMA.longitude, 'cultura')).resolves.toEqual([]);
    });

    it('rete giu\' → PlacesSearchError', async () => {
        vi.stubGlobal('fetch', routeFetch(networkDown));
        await expect(discoverRealPOIs('Roma', ROMA.latitude, ROMA.longitude, 'cultura')).rejects.toBeInstanceOf(PlacesSearchError);
    });

    it('HTTP 503 dal proxy → PlacesSearchError', async () => {
        vi.stubGlobal('fetch', routeFetch(() => ({ ok: false, status: 503, json: async () => ({}) })));
        await expect(discoverRealPOIs('Roma', ROMA.latitude, ROMA.longitude, 'cultura')).rejects.toBeInstanceOf(PlacesSearchError);
    });

    it('status di errore di Google (REQUEST_DENIED) → PlacesSearchError', async () => {
        vi.stubGlobal('fetch', routeFetch(() => ({ ok: true, status: 200, json: async () => ({ status: 'REQUEST_DENIED' }) })));
        await expect(discoverRealPOIs('Roma', ROMA.latitude, ROMA.longitude, 'cultura')).rejects.toBeInstanceOf(PlacesSearchError);
    });

    it('tema sconosciuto → usa la ricerca di riserva, non lancia TypeError', async () => {
        const queries = [];
        vi.stubGlobal('fetch', routeFetch((q) => { queries.push(q); return ok(PLACES); }));
        const pois = await discoverRealPOIs('Roma', ROMA.latitude, ROMA.longitude, 'tema-che-non-esiste');
        expect(pois.length).toBeGreaterThan(0);
        expect(queries[0]).toContain('museo');
    });
});

describe('discoverAllThemes ("Per Te") — zero contro errore', () => {
    it('tutte le ricerche falliscono → PlacesSearchError', async () => {
        vi.stubGlobal('fetch', routeFetch(networkDown));
        await expect(placesDiscoveryService.discoverAllThemes('Roma', ROMA.latitude, ROMA.longitude))
            .rejects.toBeInstanceOf(PlacesSearchError);
    });

    it('tutte le ricerche rispondono zero → pool vuoti, nessun errore', async () => {
        vi.stubGlobal('fetch', routeFetch(zero));
        const pools = await placesDiscoveryService.discoverAllThemes('Roma', ROMA.latitude, ROMA.longitude);
        expect(Object.values(pools).every(a => Array.isArray(a) && a.length === 0)).toBe(true);
    });

    it('una ricerca fallisce ma le altre trovano luoghi → si usano quelli', async () => {
        vi.stubGlobal('fetch', routeFetch((q) => (q.includes('trattoria') ? networkDown() : ok(PLACES))));
        const pools = await placesDiscoveryService.discoverAllThemes('Roma', ROMA.latitude, ROMA.longitude);
        expect(Object.values(pools).flat().length).toBeGreaterThan(0);
    });
});

describe('Percorso B — zero contro errore', () => {
    it('errore di rete → _source "search-error", mai "no-results"', async () => {
        vi.stubGlobal('fetch', routeFetch(networkDown));
        const r = await percorsoB(['Arte']);
        expect(r._source).toBe('search-error');
        expect(r._pathB).toBe(true);
    });

    it('Google risponde zero → _source "no-results" (il "non trovo" e\' vero)', async () => {
        vi.stubGlobal('fetch', routeFetch(zero));
        const r = await percorsoB(['Arte']);
        expect(r._source).toBe('no-results');
        expect(r._pathB).toBe(true);
    });

    it('il testo di errore e\' esattamente quello deciso', () => {
        expect(PLACES_SEARCH_ERROR_MESSAGE).toBe('Connessione instabile: non riesco a cercare adesso. Riprova tra un momento.');
    });
});
