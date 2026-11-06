// PER-TE-TRE (T27) — una proposta per ogni passione del DNA: il modello serve due temi, gli altri si compongono in codice, per adesso.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { perTeDellaFascia, salvaPerTe, leggiPerTe } from '@/lib/perTeSalvato';

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn(), auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }), getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } } }));
vi.mock('@/services/factsService', async (o) => ({ ...(await o()), fetchFactsForStops: async () => ({ byId: new Map(), report: {} }) }));

import { aiRecommendationService } from '@/services/aiRecommendationService';

const CITY = 'Roma';
const CENTER = { latitude: 41.9, longitude: 12.5, isSmallTown: false };
const near = (km, lon) => ({ latitude: CENTER.latitude + km * 0.009, longitude: CENTER.longitude + lon });
const sempre = { openingPeriods: Array.from({ length: 7 }, (_, day) => ({ open: { day, time: '0600' }, close: { day, time: '2300' } })) };
const pranzo = { openingPeriods: Array.from({ length: 7 }, (_, day) => ({ open: { day, time: '1200' }, close: { day, time: '1530' } })) };
const poi = (id, km, lon, types, ore = sempre) => ({ place_id: id, name: id, ...near(km, lon), rating: 4.6, user_ratings_total: 500, types, city: CITY, ...ore });

// quattro zone diverse: ogni tema ha un gruppo suo, a 4 km dagli altri
const POOL = {
    cultura: ['Museo Alfa', 'Museo Beta', 'Museo Gamma', 'Museo Delta'].map((n, i) => poi(n, 0.3 * i, 0, ['museum', 'tourist_attraction'])),
    nature: ['Parco Uno', 'Parco Due', 'Parco Tre', 'Parco Quattro'].map((n, i) => poi(n, 0.3 * i, 0.05, ['park'])),
    romance: ['Vista Prima', 'Vista Seconda', 'Vista Terza', 'Vista Quarta'].map((n, i) => poi(n, 0.3 * i, -0.05, ['viewpoint', 'tourist_attraction'])),
    food: [poi('Trattoria Sola', 0, 0.03, ['restaurant', 'food'], pranzo), poi('Trattoria Altra', 0.1, 0.03, ['restaurant', 'food'], pranzo)],
};
const dueTour = () => vi.fn(async (url, init) => {
    const body = JSON.parse(init?.body || '{}');
    const sys = String(body.messages?.[0]?.content ?? '');
    const stop = (place_id) => ({ place_id, description: `Dentro ${place_id} la pietra è fresca.` });
    const payload = sys.includes('Riscrivi SOLO') ? { stops: [] } : { tours: [
        { themeType: 'cultura', title: 'Cultura', stops: POOL.cultura.slice(0, 3).map(c => stop(c.place_id)) },
        { themeType: 'romance', title: 'Panorami', stops: POOL.romance.slice(0, 3).map(c => stop(c.place_id)) },
    ] };
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) }, finish_reason: 'stop' }], usage: { completion_tokens: 400 } }) };
});
const DNA = { natura: 0.46, food: 0.39, cultura: 0.2, _share: 0.45 };
const home = (extra = {}) => aiRecommendationService.generateHomeTours({ city: CITY, cityCenter: CENTER, themedCandidates: { insider: [], ...POOL }, opts: { skipUserQuota: true, dnaWeights: DNA, ...extra } });
const alle = (iso) => vi.setSystemTime(new Date(iso));

beforeEach(() => { try { window.localStorage.clear(); } catch { /* jsdom */ } vi.useFakeTimers({ toFake: ['Date'] }); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Per Te copre le passioni del DNA', () => {
    it('alle 10: la natura la compone il codice, per adesso; una sola chiamata al modello', async () => {
        alle('2026-11-06T10:00:00+01:00');
        const fn = dueTour(); vi.stubGlobal('fetch', fn);
        const r = await home();
        const temi = r.tours.filter(t => !t.perDopo).map(t => t.themeType);
        expect(temi).toEqual(expect.arrayContaining(['cultura', 'romance', 'nature']));
        expect(r._report.passioni.passioni).toEqual(['nature', 'food', 'cultura']);
        expect(r._report.passioni.composti).toContain('nature');
        expect(fn.mock.calls.filter(([u]) => String(u).includes('openai-proxy')).length).toBeLessThanOrEqual(2);
    });
    it('il cibo senza un giro a piedi si dichiara: niente tappe lontane, niente seconda trattoria', async () => {
        alle('2026-11-06T10:00:00+01:00'); // le trattorie aprono a pranzo, attorno non c'è niente
        vi.stubGlobal('fetch', dueTour());
        const r = await home();
        expect(r.tours.some(t => t.themeType === 'food' && !t.perDopo)).toBe(false);
        for (const t of r.tours) expect(t.stops.filter(s => /Trattoria/.test(s.title)).length).toBeLessThanOrEqual(1);
    });
    it('nessun posto compare in due proposte', async () => {
        alle('2026-11-06T13:00:00+01:00');
        vi.stubGlobal('fetch', dueTour());
        const r = await home();
        const ids = r.tours.flatMap(t => t.stops.map(s => s.place_id));
        expect(new Set(ids).size).toBe(ids.length);
    });
    it('in un borgo non si dichiara niente: basta una proposta', async () => {
        alle('2026-11-06T10:00:00+01:00');
        vi.stubGlobal('fetch', dueTour());
        const r = await aiRecommendationService.generateHomeTours({ city: 'Troina', cityCenter: { ...CENTER, isSmallTown: true }, themedCandidates: { insider: [], ...POOL }, opts: { skipUserQuota: true, dnaWeights: DNA } });
        expect(r.passioniMancanti).toBeUndefined();
    });
});

describe('perTeDellaFascia — le schede pronte per questa fascia', () => {
    const chiave = (dna) => ['home-experiences', 'Roma', '2026-11-06', 'mattina', dna, 'cibo', 'natura'];
    const dati = { tours: [{ id: 'home-nature-1' }], chiusoOra: null };
    it('vale con il resto della chiave cambiato, per lo stesso utente', () => {
        salvaPerTe(chiave('f1:food1'), 'u1', dati);
        expect(leggiPerTe(chiave('f2:food1'), 'u1')).toBeUndefined();
        expect(perTeDellaFascia(chiave('f2:food1'), 'u1')).toEqual(dati);
    });
    it('non vale per un altro utente, un’altra città, un altro giorno, un’altra fascia', () => {
        salvaPerTe(chiave('f1'), 'u1', dati);
        expect(perTeDellaFascia(chiave('f1'), 'u2')).toBeUndefined();
        expect(perTeDellaFascia(['home-experiences', 'Catania', '2026-11-06', 'mattina'], 'u1')).toBeUndefined();
        expect(perTeDellaFascia(['home-experiences', 'Roma', '2026-11-07', 'mattina'], 'u1')).toBeUndefined();
        expect(perTeDellaFascia(['home-experiences', 'Roma', '2026-11-06', 'pomeriggio'], 'u1')).toBeUndefined();
    });
    it('niente salvato: niente', () => { expect(perTeDellaFascia(chiave('f1'), 'u1')).toBeUndefined(); });
});
