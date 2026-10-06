// Gate FINESTRA TEMPORALE (G3) — IL FATTO QUANDO, in integrazione.
//
// `tourWindow.test.js` prova che resolveTourWindow sa leggere "domani". Questo
// prova che generateItinerary la USA: chiesto lunedi' alle 20:57 "Domani…",
// la prima tappa e' martedi' alle 9:30 di Roma — non lunedi' alle 20:57 — e la
// fascia del timeContext mandata al selettore e' quella di martedi' mattina,
// non "sera". Un modulo puro puo' essere perfetto mentre nessuno lo chiama.
//
// Stessa forma (Cabras, routeFetch) di cacheOrariFreschi.test.js.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';

const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const aKm = (km) => CABRAS.latitude + (km / 111);
const SPIAGGIA_TYPES = ['establishment', 'natural_feature', 'point_of_interest'];

const place = ({ id, name, km }) => ({
    place_id: id,
    name,
    geometry: { location: { lat: aKm(km), lng: CABRAS.longitude } },
    rating: 4.5,
    user_ratings_total: 300,
    business_status: 'OPERATIONAL',
    types: SPIAGGIA_TYPES,
});

const SPIAGGE = [
    place({ id: 'pid-maimoni', name: 'Spiaggia di Maimoni', km: 0.5 }),
    place({ id: 'pid-arutas', name: 'Spiaggia Is Arutas', km: 1.5 }),
    place({ id: 'pid-mari-ermi', name: 'Spiaggia Mari Ermi', km: 2.5 }),
];

const INTENT = {
    queries: ['spiagge'],
    categoria: 'natura',
    oggetto_umano: 'spiagge',
    vincoli: { tempo: null, escludi: [], note: null },
};

const SELECTOR_PAYLOAD = {
    days: [{
        day: 1,
        title: 'Il vento del Sinis',
        stops: [
            { place_id: 'pid-maimoni', description: 'Sabbia di quarzo sotto i piedi' },
            { place_id: 'pid-arutas', description: 'I chicchi bianchi rotolano nell’acqua' },
            { place_id: 'pid-mari-ermi', description: 'Il maestrale piega i giunchi' },
        ],
    }],
};

const routeFetch = () => {
    const stato = { aiCalls: 0, selectorBody: null };
    const fn = vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const payload = stato.aiCalls === 0 ? INTENT : SELECTOR_PAYLOAD;
            if (stato.aiCalls === 1) stato.selectorBody = String(init?.body ?? '');
            stato.aiCalls += 1;
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }
        if (u.includes('textsearch')) {
            return { ok: true, json: async () => ({ status: 'OK', results: SPIAGGE }) };
        }
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        throw new Error(`fetch inatteso: ${u}`);
    });
    return { fn, stato };
};

// Lunedi' 5 ottobre 2026, 20:57 a Roma. Offset esplicito: la CI gira in UTC.
const LUNEDI_2057 = new Date('2026-10-05T20:57:00+02:00');
const MARTEDI_0930 = new Date('2026-10-06T09:30:00+02:00');

describe('G3 — "domani" sposta la partenza del tour, non solo le parole', () => {
    beforeEach(() => {
        // NON resetAllMocks/restoreAllMocks: azzerano i mock globali di setup.js.
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('lunedi 20:57, "Domani…" in Crea il tuo Percorso → prima tappa martedi 9:30', async () => {
        const { fn, stato } = routeFetch();
        vi.stubGlobal('fetch', fn);
        vi.useFakeTimers();
        vi.setSystemTime(LUNEDI_2057);

        const result = await aiRecommendationService.generateItinerary(
            'Cabras', { interests: ['Natura'] },
            'Domani voglio vivere le spiagge da sardo', {}, '', CABRAS,
            { pathType: 'custom' },
        );

        expect(result._source).toBe('google-first');
        const stops = result.days[0].stops;
        expect(stops.length).toBeGreaterThanOrEqual(2);

        // L'asserzione decisiva. Prima del fix: '2026-10-05T18:57:00.000Z'.
        expect(stops[0].scheduledTime).toBe(MARTEDI_0930.toISOString());
        expect(result.startTimeAnchored).toBe(true);

        // La fascia narrativa si legge da start (9:30 → mattina), non dalle 20:57.
        expect(stato.selectorBody).toContain('mattina presto');
        expect(stato.selectorBody).not.toContain('sera — aperitivi');

        // Cache HIT nello stesso istante: stessa finestra, stessa prima tappa.
        const chiamate = fn.mock.calls.length;
        const secondo = await aiRecommendationService.generateItinerary(
            'Cabras', { interests: ['Natura'] },
            'Domani voglio vivere le spiagge da sardo', {}, '', CABRAS,
            { pathType: 'custom' },
        );
        expect(fn.mock.calls.length).toBe(chiamate);
        expect(secondo.days[0].stops[0].scheduledTime).toBe(MARTEDI_0930.toISOString());
    });

    it('stesso testo nel Percorso Veloce → parte da adesso', async () => {
        const { fn } = routeFetch();
        vi.stubGlobal('fetch', fn);
        vi.useFakeTimers();
        vi.setSystemTime(LUNEDI_2057);

        const result = await aiRecommendationService.generateItinerary(
            'Cabras', { interests: ['Natura'] },
            'Domani voglio vivere le spiagge da sardo', {}, '', CABRAS,
            { pathType: 'quick' },
        );
        expect(result.days[0].stops[0].scheduledTime).toBe(LUNEDI_2057.toISOString());
        expect(result.startTimeAnchored).toBe(false);
    });
});
