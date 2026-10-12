// MIG-PLACES — il candidato che esce da discoverRealPOIs: con la risposta legacy ha
// ESATTAMENTE le chiavi di prima (nessun campo nuovo); con quella della ricerca
// nuova (gia' in forma legacy dal proxy) porta in piu' openingPeriods, primaryType,
// utcOffsetMinutes. Gli orari arrivano ma nessuna regola del motore li legge.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { discoverRealPOIs } from '../../services/placesDiscoveryService';
import { normalizeNewResponse } from '../../../supabase/functions/places-proxy/placesNew.ts';
import sample from '../fixtures/placesNew.sample.json';

const legacyPlace = {
    place_id: 'pid-1', name: 'Trattoria Uno', rating: 4.5, user_ratings_total: 400, price_level: 2, business_status: 'OPERATIONAL',
    types: ['restaurant', 'food'], geometry: { location: { lat: 37.5, lng: 15.08 } }, formatted_address: 'Via Roma 1',
    opening_hours: { open_now: true }, photos: [{ photo_reference: 'LEGACYREF' }],
};
// le chiavi del candidato PRIMA di MIG-PLACES (buildPOIFromCandidate)
const CHIAVI_DI_PRIMA = ['id', 'name', 'title', 'description', 'lat', 'lng', 'latitude', 'longitude', 'type', 'rating', 'user_ratings_total',
    'business_status', 'price_level', 'open_now', 'types', 'city', 'place_id', 'googlePlaceId', 'googlePhoto', 'image', 'address'];

const cerca = async (results) => {
    window.localStorage.clear();
    vi.stubGlobal('fetch', async (url) => {
        if (String(url).includes('textsearch')) return { ok: true, json: async () => ({ status: 'OK', results }) };
        throw new Error(`fetch inatteso: ${url}`);
    });
    return discoverRealPOIs('Catania', 37.5, 15.08, 'food');
};
afterEach(() => vi.unstubAllGlobals());

describe('MIG-PLACES — candidato', () => {
    it('legacy: stesse chiavi di prima, nessun campo nuovo', async () => {
        const [c] = await cerca([legacyPlace]);
        expect(Object.keys(c)).toEqual(CHIAVI_DI_PRIMA);
        expect(c.open_now).toBe(true);
        expect(c.googlePhoto).toContain('photo_reference=LEGACYREF');
    });
    it('nuova: gli stessi campi + orari, tipo principale, fuso', async () => {
        const nuovi = normalizeNewResponse(sample).results;
        const risultati = await cerca(nuovi);
        const c = risultati.find(x => x.place_id === 'ChIJU84fUCzjExMR4rI0uZuCtQQ');
        expect(Object.keys(c)).toEqual([...CHIAVI_DI_PRIMA, 'openingPeriods', 'primaryType', 'utcOffsetMinutes']);
        expect(c.openingPeriods[0]).toEqual({ open: { day: 0, time: '1230' }, close: { day: 1, time: '0000' } });
        expect(c.primaryType).toBe('italian_restaurant');
        expect(c.utcOffsetMinutes).toBe(120);
        // i campi di sempre sono quelli di sempre
        expect(c).toMatchObject({ name: 'Trattoria del Cavaliere', rating: 4.2, user_ratings_total: 12026, price_level: 2, open_now: true, business_status: 'OPERATIONAL' });
        expect(c.googlePhoto).toContain('photo_reference=places%2F');
    });
    it('nuova, posto senza orari: niente openingPeriods (e il resto resta)', async () => {
        const nuovi = normalizeNewResponse(sample).results;
        const risultati = await cerca(nuovi);
        const chiesa = risultati.find(x => x.place_id === 'ChIJ_no_hours');
        expect(chiesa).toBeTruthy();
        expect('openingPeriods' in chiesa).toBe(false);
        expect(chiesa.primaryType).toBe('church');
    });
});
