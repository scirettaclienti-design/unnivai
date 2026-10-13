// MIG-PLACES — la parte pura del proxy per la ricerca nuova: interruttore, maschera
// e fasce, richiesta, normalizzazione nella forma legacy, chiave di cache, foto.
import { describe, it, expect } from 'vitest';
import {
    chooseEngine, NEW_FIELDS, NEW_FIELD_MASK, buildNewSearchBody, normalizeNewResponse, normalizePeriods,
    newCacheKey, isNewPhotoRef, newMediaUrl, NEW_CACHE_VERSION,
} from '../../../supabase/functions/places-proxy/placesNew.ts';
import sample from '../fixtures/placesNew.sample.json';

describe('interruttore PLACES_SEARCH', () => {
    it('assente o diverso da "new" = legacy (produzione)', () => {
        expect(chooseEngine({})).toBe('legacy');
        expect(chooseEngine({ envMode: 'legacy' })).toBe('legacy');
        expect(chooseEngine({ envMode: 'boh' })).toBe('legacy');
        expect(chooseEngine({ envMode: null })).toBe('legacy');
    });
    it('envMode "new" vale per tutti', () => {
        expect(chooseEngine({ envMode: 'new' })).toBe('new');
    });
    it('un client qualunque non puo\' scegliere il motore: `engine` conta solo per l\'account di prova', () => {
        expect(chooseEngine({ envMode: 'legacy', requested: 'new', isTestAccount: false })).toBe('legacy');
        expect(chooseEngine({ envMode: 'legacy', requested: 'new' })).toBe('legacy');
        expect(chooseEngine({ envMode: 'legacy', requested: 'new', isTestAccount: true })).toBe('new');
        expect(chooseEngine({ envMode: 'new', requested: 'legacy', isTestAccount: true })).toBe('legacy');
        expect(chooseEngine({ envMode: 'new', requested: 'legacy', isTestAccount: false })).toBe('new');
        expect(chooseEngine({ envMode: 'legacy', requested: 'xxx', isTestAccount: true })).toBe('legacy');
    });
});

describe('maschera dei campi e fasce', () => {
    it('contiene i campi che il motore usa + orari, tipo principale, fuso', () => {
        for (const f of ['places.id', 'places.displayName', 'places.formattedAddress', 'places.location', 'places.types', 'places.businessStatus',
            'places.photos', 'places.rating', 'places.userRatingCount', 'places.priceLevel', 'places.regularOpeningHours', 'places.currentOpeningHours', 'places.primaryType', 'places.utcOffsetMinutes']) {
            expect(NEW_FIELD_MASK.split(','), f).toContain(f);
        }
    });
    it('nessun campo sopra la fascia di regularOpeningHours (Enterprise): ne\' Atmosphere ne\' servesVegetarianFood', () => {
        const ordine = ['Essentials IDs Only', 'Pro', 'Enterprise'];
        const tetto = ordine.indexOf(NEW_FIELDS.find(f => f.field === 'places.regularOpeningHours').sku);
        for (const f of NEW_FIELDS) expect(ordine.indexOf(f.sku), f.field).toBeGreaterThanOrEqual(0);
        for (const f of NEW_FIELDS) expect(ordine.indexOf(f.sku), f.field).toBeLessThanOrEqual(tetto);
        expect(NEW_FIELD_MASK).not.toMatch(/serves|reviews/);
        // ORARI-FESTIVI: currentOpeningHours e' nella stessa fascia (Enterprise) di regularOpeningHours
        expect(NEW_FIELDS.find(f => f.field === 'places.currentOpeningHours').sku).toBe('Enterprise');
    });
});

describe('richiesta', () => {
    const qs = (o) => new URLSearchParams(o);
    it('i parametri legacy diventano il corpo della ricerca nuova', () => {
        const b = buildNewSearchBody(qs({ query: 'trattoria Catania', location: '37.5,15.08', radius: '20000', language: 'it', path: 'place/textsearch' }));
        expect(b).toEqual({ textQuery: 'trattoria Catania', languageCode: 'it', pageSize: 20,
            locationBias: { circle: { center: { latitude: 37.5, longitude: 15.08 }, radius: 20000 } } });
    });
    it('il raggio del bias non supera il massimo dell\'API; senza posizione niente bias', () => {
        expect(buildNewSearchBody(qs({ query: 'x', location: '1,2', radius: '80000' })).locationBias.circle.radius).toBe(50000);
        expect(buildNewSearchBody(qs({ query: 'x' })).locationBias).toBeUndefined();
    });
});

describe('normalizzazione: risposta nuova → forma legacy + campi nuovi', () => {
    const out = normalizeNewResponse(sample);
    const [trattoria, parco, chiesa] = out.results;
    it('stato e numero di risultati', () => {
        expect(out.status).toBe('OK');
        expect(out.results).toHaveLength(3);
        expect(normalizeNewResponse({})).toEqual({ status: 'ZERO_RESULTS', results: [] });
    });
    it('i campi che il motore legge oggi', () => {
        expect(trattoria).toMatchObject({
            place_id: 'ChIJU84fUCzjExMR4rI0uZuCtQQ', name: 'Trattoria del Cavaliere', formatted_address: 'Via Paternò, 11, 95131 Catania CT, Italia',
            geometry: { location: { lat: 37.5067804, lng: 15.087323800000002 } }, rating: 4.2, user_ratings_total: 12026, price_level: 2, business_status: 'OPERATIONAL',
        });
        expect(trattoria.types).toContain('restaurant');
        expect(trattoria.opening_hours.open_now).toBe(true);
        expect(trattoria.photos).toEqual([{ photo_reference: 'places/ChIJU84fUCzjExMR4rI0uZuCtQQ/photos/PHOTO_TOKEN' }]);
    });
    it('i campi nuovi: orari nel formato legacy, tipo principale, fuso', () => {
        expect(trattoria.primary_type).toBe('italian_restaurant');
        expect(trattoria.utc_offset_minutes).toBe(120);
        // domenica 12:30 → lunedì 00:00, come place/details legacy
        expect(trattoria.opening_hours.periods[0]).toEqual({ open: { day: 0, time: '1230' }, close: { day: 1, time: '0000' } });
        expect(trattoria.opening_hours.periods).toHaveLength(7);
    });
    it('sempre aperto = un periodo senza close; senza orari = nessun opening_hours.periods; niente prezzo = niente price_level', () => {
        expect(parco.opening_hours.periods).toEqual([{ open: { day: 0, time: '0000' } }]);
        expect(chiesa.opening_hours).toBeUndefined();
        expect(chiesa.price_level).toBeUndefined();
        expect(chiesa.photos).toBeUndefined();
        expect(normalizePeriods([])).toBeNull();
    });
});

describe('cache', () => {
    const p = new URLSearchParams({ path: 'place/textsearch', query: 'q', location: '1,2', radius: '3', engine: 'new' });
    it('la chiave nuova ha versione e impronta, e non e\' mai quella legacy', () => {
        const k = newCacheKey('v1', 'place/textsearch', p);
        expect(k).toContain(NEW_CACHE_VERSION);
        expect(k.startsWith('v1:new2-')).toBe(true);
        expect(k).not.toContain('engine');
        // la chiave legacy (computeCacheKey di index.ts) e' `v1:<path>:<qs ordinata>`
        expect(k).not.toBe('v1:place/textsearch:language=it&location=1,2&query=q&radius=3');
        expect(newCacheKey('v1', 'place/textsearch', p)).toBe(k);
    });
});

describe('foto', () => {
    it('riconosce i riferimenti nuovi e costruisce l\'URL del servizio foto nuovo', () => {
        expect(isNewPhotoRef('places/ABC/photos/XYZ')).toBe(true);
        expect(isNewPhotoRef('CmRaAAAA_legacy_token')).toBe(false);
        expect(isNewPhotoRef(null)).toBe(false);
        expect(newMediaUrl('places/ABC/photos/XYZ', '600', 'K')).toBe('https://places.googleapis.com/v1/places/ABC/photos/XYZ/media?maxWidthPx=600&key=K');
        expect(newMediaUrl('places/ABC/photos/XYZ', null, 'K')).toContain('maxWidthPx=600');
    });
});
