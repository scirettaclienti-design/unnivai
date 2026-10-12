// @vitest-environment node
// MIG-PLACES — con l'interruttore su "legacy" (o assente) il proxy nuovo e' IDENTICO
// a quello di prima: stesse chiamate a Google (URL, metodo, header, corpo), stesso
// stato, stesso corpo, stessi header, stesse scritture in cache. Il proxy di prima
// e' la copia in fixtures/places-proxy.legacy.ts.txt (commit b095566).
import { describe, it, expect } from 'vitest';
import { loadProxy, readSrc } from './placesProxyHarness.js';
import sample from '../fixtures/placesNew.sample.json';

const OLD = readSrc('src/__tests__/fixtures/places-proxy.legacy.ts.txt');
const NEW = readSrc('supabase/functions/places-proxy/index.ts');
const NEWMOD = readSrc('supabase/functions/places-proxy/placesNew.ts');

const LEGACY_SEARCH = { status: 'OK', results: [{ place_id: 'P1', name: 'Bar Uno', types: ['cafe'], rating: 4.5, user_ratings_total: 100, opening_hours: { open_now: true }, geometry: { location: { lat: 1, lng: 2 } } }] };
const upstream = (u, init) => {
    if (u.startsWith('https://places.googleapis.com/v1/places:searchText')) return { status: 200, body: sample };
    if (u.includes('/place/textsearch/json')) return { status: 200, body: LEGACY_SEARCH };
    if (u.includes('/place/details/json')) return { status: 200, body: { status: 'OK', result: { opening_hours: { periods: [] } } } };
    if (u.includes('/place/findplacefromtext/json')) return { status: 200, body: { status: 'OK', candidates: [{ place_id: 'P1' }] } };
    if (u.includes('/place/photo') || u.includes('/media?')) return { status: 302, body: null, headers: { location: 'https://lh3.googleusercontent.com/x' } };
    return { status: 404, body: { status: 'NOT_FOUND' } };
};

const BASE = 'https://x.supabase.co/functions/v1/places-proxy';
const URLS = {
    textsearch: `${BASE}?path=place/textsearch&query=trattoria%20Catania&location=37.5,15.08&radius=20000&language=it`,
    details: `${BASE}?path=place/details&place_id=P1&fields=opening_hours&language=it`,
    findplace: `${BASE}?path=place/findplacefromtext&input=Catania&inputtype=textquery&language=it`,
    photo: `${BASE}?path=place/photo&maxwidth=600&photo_reference=CmRaLEGACY&language=it`,
    nonAmmesso: `${BASE}?path=place/autocomplete&input=x`,
};

const run = async (source, { env, mod }, scenario) => {
    const cache = new Map();
    const p = await loadProxy(source, { env: { GOOGLE_MAPS_API_KEY: 'TESTKEY', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv', ...env },
        placesNewSource: mod, cache, testUserIds: new Set(['u-test']), upstream });
    const out = [];
    for (const [url, headers] of scenario) out.push(await p.call(url, headers));
    return { out, calls: p.calls.map(c => ({ ...c })), cache: [...cache.entries()] };
};

describe('places-proxy con l\'interruttore su legacy = proxy di prima', () => {
    const tutti = Object.values(URLS).map(u => [u, {}]);
    for (const env of [{}, { PLACES_SEARCH: 'legacy' }, { PLACES_SEARCH: 'qualcosa' }]) {
        it(`identico su tutti i path, env ${JSON.stringify(env)}: chiamate a Google, risposta, header, cache`, async () => {
            const vecchio = await run(OLD, { env }, tutti);
            const nuovo = await run(NEW, { env, mod: NEWMOD }, tutti);
            expect(nuovo.calls).toEqual(vecchio.calls);
            expect(nuovo.out).toEqual(vecchio.out);
            expect(nuovo.cache).toEqual(vecchio.cache);
            // controllo di sanita': la ricerca e' andata davvero all'API legacy, con la sua cache
            expect(nuovo.calls[0].url).toContain('maps.googleapis.com/maps/api/place/textsearch/json');
            expect(nuovo.cache.length).toBeGreaterThan(0);
        });
    }

    it('seconda richiesta uguale: cache HIT identica a prima', async () => {
        const due = [[URLS.textsearch, {}], [URLS.textsearch, {}]];
        const vecchio = await run(OLD, { env: {} }, due);
        const nuovo = await run(NEW, { env: {}, mod: NEWMOD }, due);
        expect(nuovo.out).toEqual(vecchio.out);
        expect(nuovo.out[1].headers['x-cache']).toBe('HIT');
        expect(nuovo.calls).toHaveLength(1);
    });

    it('`engine=new` da un client qualunque (o con un token non di prova) e\' ignorato: stessa strada legacy', async () => {
        const conEngine = `${URLS.textsearch}&engine=new`;
        const riferimento = await run(OLD, { env: {} }, [[URLS.textsearch, {}]]);
        for (const headers of [{}, { authorization: 'Bearer OTHERTOKEN' }, { authorization: 'Bearer cattivo' }]) {
            const r = await run(NEW, { env: {}, mod: NEWMOD }, [[conEngine, headers]]);
            expect(r.calls).toEqual(riferimento.calls);
            expect(r.out).toEqual(riferimento.out);
            expect(r.cache).toEqual(riferimento.cache);
        }
    });
});

describe('places-proxy con la ricerca nuova', () => {
    const conTest = { authorization: 'Bearer TESTTOKEN' };
    it('l\'account di prova con engine=new: POST all\'API nuova con la maschera, risposta in forma legacy + campi nuovi', async () => {
        const r = await run(NEW, { env: {}, mod: NEWMOD }, [[`${URLS.textsearch}&engine=new`, conTest]]);
        expect(r.calls).toHaveLength(1);
        const c = r.calls[0];
        expect(c.url).toBe('https://places.googleapis.com/v1/places:searchText');
        expect(c.method).toBe('POST');
        expect(c.headers['X-Goog-FieldMask']).toContain('places.regularOpeningHours');
        expect(c.headers['X-Goog-Api-Key']).toBe('TESTKEY');
        expect(JSON.parse(c.body)).toMatchObject({ textQuery: 'trattoria Catania', pageSize: 20 });
        const body = JSON.parse(r.out[0].body);
        expect(body.status).toBe('OK');
        expect(body.results[0]).toMatchObject({ place_id: 'ChIJU84fUCzjExMR4rI0uZuCtQQ', primary_type: 'italian_restaurant', utc_offset_minutes: 120 });
        expect(body.results[0].opening_hours.periods.length).toBe(7);
        expect(r.out[0].headers['x-engine']).toBe('new');
    });
    it('cache con chiave propria: non incrocia quella legacy (stessa richiesta, due motori, due voci)', async () => {
        const r = await run(NEW, { env: {}, mod: NEWMOD }, [[URLS.textsearch, {}], [`${URLS.textsearch}&engine=new`, conTest], [`${URLS.textsearch}&engine=new`, conTest]]);
        expect(r.cache).toHaveLength(2);
        expect(r.cache.map(([k]) => k).filter(k => k.includes(':new1-'))).toHaveLength(1);
        expect(r.out[2].headers['x-cache']).toBe('HIT');
        expect(r.calls).toHaveLength(2); // legacy + nuova; la terza e' una HIT
        expect(JSON.parse(r.out[0].body).results[0].opening_hours).toEqual({ open_now: true });
    });
    it('PLACES_SEARCH=new vale per tutti (la scelta futura): nessun token serve', async () => {
        const r = await run(NEW, { env: { PLACES_SEARCH: 'new' }, mod: NEWMOD }, [[URLS.textsearch, {}]]);
        expect(r.calls[0].url).toBe('https://places.googleapis.com/v1/places:searchText');
    });
    it('PLACES_SEARCH=new ma account di prova con engine=legacy: torna la strada legacy', async () => {
        const r = await run(NEW, { env: { PLACES_SEARCH: 'new' }, mod: NEWMOD }, [[`${URLS.textsearch}&engine=legacy`, conTest]]);
        expect(r.calls[0].url).toContain('maps.googleapis.com/maps/api/place/textsearch/json');
    });
    it('errore di Google (API non abilitata) → status non 2xx, mai un risultato finto', async () => {
        const p = await loadProxy(NEW, { env: { GOOGLE_MAPS_API_KEY: 'K', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 's', PLACES_SEARCH: 'new' },
            placesNewSource: NEWMOD, cache: new Map(), testUserIds: new Set(), upstream: () => ({ status: 403, body: { error: { status: 'PERMISSION_DENIED' } } }) });
        const r = await p.call(URLS.textsearch);
        expect(r.status).toBe(403);
        expect(JSON.parse(r.body).status).toBe('ERROR');
    });
    it('foto: un riferimento nuovo va al servizio foto nuovo (redirect manuale); uno legacy no', async () => {
        const nuovo = await run(NEW, { env: {}, mod: NEWMOD }, [[`${BASE}?path=place/photo&maxwidth=600&photo_reference=places/ABC/photos/XYZ`, {}]]);
        expect(nuovo.calls[0].url).toBe('https://places.googleapis.com/v1/places/ABC/photos/XYZ/media?maxWidthPx=600&key=TESTKEY');
        expect(nuovo.calls[0].redirect).toBe('manual');
        expect(nuovo.out[0].status).toBe(302);
    });
});
