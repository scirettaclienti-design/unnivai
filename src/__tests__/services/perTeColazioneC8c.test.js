// C8c — Per Te alle 8:30: il tour cibo e' fatto di COLAZIONI (caffe', forni), non di osterie ne' di cocktail bar.
// Questo file non importa niente di nuovo di C8b/C8c (solo il servizio): si prova anche sul codice di prima (0384a96), dove deve
// fallire per la regola (l'osteria resta nel tour), non per un import mancante.
// Scenario: Cabras, mercoledi' 14/10/2026 (fuso di Roma esplicito: la CI gira in UTC).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';

const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const aKm = (km) => CABRAS.latitude + (km / 111);
const SEMPRE = [{ open: { day: 0, time: '0000' } }];
const POI = (id, name, km, types, primary) => ({
    place_id: id, name, primaryType: primary, primary_type: primary, latitude: aKm(km), longitude: CABRAS.longitude, lat: aKm(km), lng: CABRAS.longitude,
    rating: 4.5, user_ratings_total: 300 + Math.round(km * 10), business_status: 'OPERATIONAL', types, city: 'Cabras', openingPeriods: SEMPRE,
});
const FOOD = [
    POI('o1', 'Osteria Sonnino', 0.4, ['italian_restaurant', 'restaurant', 'food'], 'italian_restaurant'),
    POI('k1', 'Cocktail Bar Luna', 0.5, ['cocktail_bar', 'bar', 'food'], 'cocktail_bar'),
    POI('c1', 'Caffè Centrale', 0.6, ['cafe', 'food'], 'cafe'),
    POI('f1', 'Forno Antico', 0.8, ['bakery', 'food'], 'bakery'),
    POI('c2', 'Caffè Piazza', 1.0, ['cafe', 'food'], 'cafe'),
    POI('f2', 'Forno Nuovo', 1.2, ['bakery', 'food'], 'bakery'),
];

beforeEach(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('C8c — Per Te 8:30: il tour cibo e\' fatto di colazioni', () => {
    it('un\'osteria e un cocktail bar scelti dal modello non restano nel tour del mattino', async () => {
        window.localStorage.clear();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-14T08:30:00+02:00'));
        const payload = { tours: [{ themeType: 'food', title: 'Food', stops: ['o1', 'k1', 'c1'].map(id => ({ place_id: id, description: 'x' })) }] };
        vi.stubGlobal('fetch', vi.fn(async (url) => {
            if (!String(url).includes('openai-proxy')) throw new Error(`fetch inatteso: ${url}`);
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) }, finish_reason: 'stop' }], usage: { completion_tokens: 500 } }) };
        }));
        const res = await aiRecommendationService.generateHomeTours({ city: 'Cabras', cityCenter: CABRAS, themedCandidates: { food: FOOD }, opts: { skipUserQuota: true } });
        const food = res.tours.find(t => t.themeType === 'food');
        expect(food).toBeDefined();
        const ids = food.stops.map(s => s.place_id);
        expect(ids).not.toContain('o1');
        expect(ids).not.toContain('k1');
        for (const s of food.stops) expect(['cafe', 'bakery']).toContain(s.primaryType || s.types?.[0]);
    });
});
