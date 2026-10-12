// BANCO-ESTESO — l'ora simulata delle prove (opts.simulatedNow).
//
// Il parametro esiste solo per le prove. Qui si prova che:
//   1. senza il parametro il motore produce lo STESSO risultato di prima, byte
//      per byte (JSON identico a quello con il parametro uguale all'orologio:
//      la sola cosa che il parametro sostituisce e' la lettura di `new Date()`);
//   2. in produzione (import.meta.env.PROD) il parametro e' ignorato: stesso
//      JSON del caso senza parametro, anche con un'ora diversa;
//   3. nelle prove il parametro conta davvero (altrimenti 1 e 2 sarebbero vuoti).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { requestNow } from '../../lib/simulatedNow';

const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const aKm = (km) => CABRAS.latitude + (km / 111);
const SPIAGGE = ['pid-a', 'pid-b', 'pid-c'].map((id, i) => ({
    place_id: id, name: `Spiaggia ${i}`,
    geometry: { location: { lat: aKm(0.5 + i), lng: CABRAS.longitude } },
    rating: 4.5, user_ratings_total: 300, business_status: 'OPERATIONAL',
    types: ['establishment', 'natural_feature', 'point_of_interest'],
}));
const INTENT = { queries: ['spiagge'], categoria: 'natura', oggetto_umano: 'spiagge', vincoli: { tempo: null, escludi: [], note: null } };
const SELECTOR = {
    days: [{ day: 1, title: 'Il vento del Sinis', stops: SPIAGGE.map(p => ({ place_id: p.place_id, description: 'Sabbia di quarzo sotto i piedi' })) }],
};
const ai = (payload) => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) });

const routeFetch = () => {
    let n = 0;
    return vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('openai-proxy')) return ai(n++ === 0 ? INTENT : SELECTOR);
        if (u.includes('textsearch')) return { ok: true, json: async () => ({ status: 'OK', results: decodeURIComponent(u).includes('Cabras') ? SPIAGGE : [] }) };
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        return { ok: false, status: 404, json: async () => ({}) };
    });
};

const CLOCK = '2026-10-07T15:00:00+02:00';
const ALTRA = '2026-10-07T10:00:00+02:00';

const genera = async (opts = {}) => {
    window.localStorage.clear();
    vi.stubGlobal('fetch', routeFetch());
    const r = await aiRecommendationService.generateItinerary('Cabras', { interests: ['Natura'] }, 'le spiagge piu belle', {}, '', CABRAS, opts);
    return JSON.stringify(r);
};

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(CLOCK));
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
});

describe('requestNow', () => {
    it('senza parametro e\' esattamente new Date()', () => {
        expect(requestNow({}).getTime()).toBe(new Date().getTime());
        expect(requestNow(undefined).getTime()).toBe(new Date().getTime());
        expect(requestNow({ simulatedNow: null }).getTime()).toBe(new Date().getTime());
    });
    it('un valore non valido non rompe niente: vale l\'orologio', () => {
        expect(requestNow({ simulatedNow: 'non una data' }).getTime()).toBe(new Date().getTime());
    });
    it('nelle prove il parametro (Date o ISO) sostituisce l\'orologio', () => {
        expect(requestNow({ simulatedNow: ALTRA }).toISOString()).toBe(new Date(ALTRA).toISOString());
        expect(requestNow({ simulatedNow: new Date(ALTRA) }).toISOString()).toBe(new Date(ALTRA).toISOString());
    });
    it('in produzione il parametro e\' ignorato', () => {
        vi.stubEnv('PROD', true);
        expect(requestNow({ simulatedNow: ALTRA }).getTime()).toBe(new Date().getTime());
    });
});

describe('generateItinerary — il motore con e senza ora simulata', () => {
    it('senza il parametro = con il parametro uguale all\'orologio: JSON identico', async () => {
        const senza = await genera();
        const con = await genera({ simulatedNow: CLOCK });
        expect(con).toBe(senza);
        expect(JSON.parse(senza).days[0].stops.length).toBeGreaterThan(0);
    });

    it('in produzione un\'ora simulata diversa e\' ignorata: JSON identico a quello senza parametro', async () => {
        const senza = await genera();
        vi.stubEnv('PROD', true);
        const prod = await genera({ simulatedNow: ALTRA });
        expect(prod).toBe(senza);
    });

    it('nelle prove il parametro conta: alle 21:25 la finestra del tour e\' un\'altra', async () => {
        const pomeriggio = JSON.parse(await genera());
        const sera = JSON.parse(await genera({ simulatedNow: ALTRA }));
        expect(sera.tourWindow.start).not.toBe(pomeriggio.tourWindow.start);
        expect(new Date(sera.tourWindow.start).toISOString()).toBe(new Date(ALTRA).toISOString());
    });
});
