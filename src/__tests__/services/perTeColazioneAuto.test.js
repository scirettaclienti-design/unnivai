// GIRO-EDIT — Per Te al mattino (prima delle 10:30) comincia con una colazione vicina alla prima tappa.
// Motore vero, rete finta, 0 $. Scenario: Cabras, mercoledì 14/10/2026 (fuso di Roma esplicito).
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';

const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const aKm = (km) => CABRAS.latitude + (km / 111);
const SEMPRE = [{ open: { day: 0, time: '0000' } }];
const POI = (id, name, km, types, primary, extra = {}) => ({
    place_id: id, name, primaryType: primary, primary_type: primary, latitude: aKm(km), longitude: CABRAS.longitude, lat: aKm(km), lng: CABRAS.longitude,
    rating: 4.5, user_ratings_total: 300 + Math.round(km * 10), business_status: 'OPERATIONAL', types, city: 'Cabras', openingPeriods: SEMPRE, ...extra,
});
const MUSEI = [
    POI('m1', 'Museo del Mare', 0.5, ['museum', 'tourist_attraction'], 'museum'),
    POI('m2', 'Museo Civico', 0.65, ['museum', 'tourist_attraction'], 'museum'),
    POI('m3', 'Chiesa di San Giovanni', 0.8, ['church', 'place_of_worship'], 'church'),
];
const CAFFE_VICINO = POI('c1', 'Caffè Storico', 0.55, ['cafe', 'food'], 'cafe');
const CAFFE_LONTANO = POI('c9', 'Caffè Lontano', 2.5, ['cafe', 'food'], 'cafe');
const CAFFE_CHIUSO = POI('c8', 'Caffè Chiuso', 0.55, ['cafe', 'food'], 'cafe', { openingPeriods: [{ open: { day: 0, time: '1700' }, close: { day: 0, time: '2300' } }] });
const FORNO = POI('f1', 'Pasticceria Antica', 0.6, ['bakery', 'food'], 'bakery');

beforeEach(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test'); globalThis.__COLAZIONE_AUTO_OFF__ = false; });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
afterAll(() => { globalThis.__COLAZIONE_AUTO_OFF__ = true; });

const perTe = async (ora, food) => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`2026-10-14T${ora}:00+02:00`));
    const payload = { tours: [{ themeType: 'cultura', title: 'Cultura', stops: ['m1', 'm2', 'm3'].map(id => ({ place_id: id, description: 'x' })) }] };
    vi.stubGlobal('fetch', vi.fn(async (url) => {
        if (!String(url).includes('openai-proxy')) throw new Error(`fetch inatteso: ${url}`);
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) }, finish_reason: 'stop' }], usage: { completion_tokens: 500 } }) };
    }));
    const res = await aiRecommendationService.generateHomeTours({ city: 'Cabras', cityCenter: CABRAS, themedCandidates: { cultura: MUSEI, food }, opts: { skipUserQuota: true } });
    return res.tours.find(t => t.themeType === 'cultura');
};

describe('Per Te — la colazione automatica', () => {
    it('alle 8:30 il tour di cultura comincia con la colazione più vicina alla prima tappa', async () => {
        const t = await perTe('08:30', [CAFFE_VICINO, CAFFE_LONTANO, FORNO]);
        expect(t).toBeDefined();
        expect(t.stops[0].place_id).toBe('c1');
        expect(t.stops.map(s => s.place_id)).toEqual(expect.arrayContaining(['m1', 'm2', 'm3']));
        expect(t.stops).toHaveLength(4);
    });
    it('alle 11:00 niente colazione: il tour è quello di sempre', async () => {
        const t = await perTe('11:00', [CAFFE_VICINO, FORNO]);
        expect(t.stops.map(s => s.place_id)).not.toContain('c1');
        expect(t.stops).toHaveLength(3);
    });
    it('un posto da colazione chiuso o oltre i 500 m non entra: il tour resta di tre tappe', async () => {
        const t = await perTe('08:30', [CAFFE_CHIUSO, CAFFE_LONTANO]);
        expect(t.stops).toHaveLength(3);
        expect(t.stops.map(s => s.place_id)).not.toEqual(expect.arrayContaining(['c8']));
    });
});
