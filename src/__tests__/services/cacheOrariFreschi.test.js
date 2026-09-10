// G1.1 — IL FATTO QUANDO: un tour da cache non porta l'orario di quando fu
// generato.
//
// Il difetto chiuso qui: `generateItinerary` calcolava `scheduledTime` PRIMA di
// salvare in cache. Un tour generato alle 15:00 e riaperto alle 19:00 tornava
// da `loadInsiderFromCache` as-is, e diceva ancora "15:00, 16:13, 16:46" mentre
// erano le 19:00 — un'affermazione falsa e verificabile, la stessa classe di
// difetto per cui `tourTiming.js` esiste (F57: orari 19:30 e 21:00 mostrati
// alle 23:10).
//
// La regola: gli offset (`stayMinutes`/`travelMinutesFromPrev`) sono il dato
// stabile che ha senso cachare. L'orario assoluto e' sempre DERIVATO al momento
// in cui il tour viene SERVITO — cache hit o cache miss, non importa.
//
// Questo test e' di INTEGRAZIONE, non unit: la garanzia non e' che
// `refreshTourScheduledTimes` sappia fare la somma (quello lo prova
// `tourTiming.test.js`), ma che `generateItinerary` la chiami sul cache HIT.
// Un modulo puro puo' essere perfetto mentre nessuno lo usa.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { computeCumulativeOffsets, formatClockTime } from '@/lib/tourTiming';

// Borgo (non in TOP_30_CITIES), R=5 km. Stessa forma di raggioCategoria.test.js.
const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const aKm = (km) => CABRAS.latitude + (km / 111);

// natural_feature → sosta 30 min (STAY_RULES). Tre spiagge a 1 km l'una
// dall'altra → 13 min di cammino per tratta, offset [0, 43, 86].
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

// Stesso instradamento di raggioCategoria.test.js: 1ª chiamata al proxy OpenAI
// = traduttore d'intento, 2ª = selettore. Il mock risolve via microtask, mai
// via timer: con i fake timers attivi (e mai avanzati) la funzione completa lo
// stesso.
const routeFetch = () => vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('openai-proxy')) {
        const payload = routeFetch.calls++ === 0 ? INTENT : SELECTOR_PAYLOAD;
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
    }
    if (u.includes('textsearch')) {
        const decoded = decodeURIComponent(u);
        const hit = decoded.includes('spiagge Cabras') || decoded.includes('spiagge+Cabras');
        return { ok: true, json: async () => ({ status: 'OK', results: hit ? SPIAGGE : [] }) };
    }
    if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
    throw new Error(`fetch inatteso: ${u}`);
});
routeFetch.calls = 0;

const ALLE_15 = () => new Date(2026, 8, 10, 15, 0, 0);
const ALLE_19 = () => new Date(2026, 8, 10, 19, 0, 0);

const genera = () => aiRecommendationService.generateItinerary(
    'Cabras', { interests: ['Natura'] }, 'le spiagge piu belle', {}, '', CABRAS,
);

describe('G1.1 — stessa richiesta, due ore diverse: l\'orario segue l\'orologio', () => {
    beforeEach(() => {
        // NON resetAllMocks/restoreAllMocks: azzerano i mock globali di setup.js.
        vi.clearAllMocks();
        routeFetch.calls = 0;
        try { window.localStorage.clear(); } catch { /* jsdom */ }
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        // Obbligatorio: fake timers lasciati attivi rompono in silenzio i test
        // successivi della suite.
        vi.useRealTimers();
    });

    it('il cache HIT ricalcola gli orari da ADESSO, con gli stessi offset', async () => {
        const fn = routeFetch();
        vi.stubGlobal('fetch', fn);

        // ─── Ore 15:00 — cache MISS, il tour viene generato ──────────────────
        vi.useFakeTimers();
        vi.setSystemTime(ALLE_15());

        const primo = await genera();

        expect(primo._source).toBe('google-first');
        expect(primo.startTimeAnchored).toBe(false);
        const stops15 = primo.days[0].stops;
        expect(stops15.length).toBeGreaterThanOrEqual(2);

        // Gli offset sono il dato stabile: 0, 30+13, 43+30+13.
        const offsets = computeCumulativeOffsets(stops15);
        expect(offsets).toEqual([0, 43, 86]);

        // La prima tappa E' l'ora della richiesta, al millisecondo. Le altre
        // sono quell'ora piu' il loro offset.
        expect(stops15[0].scheduledTime).toBe(ALLE_15().toISOString());
        stops15.forEach((s, i) => {
            expect(s.scheduledTime).toBe(new Date(ALLE_15().getTime() + offsets[i] * 60000).toISOString());
        });
        expect(stops15.map(s => formatClockTime(s.scheduledTime))).toEqual(['15:00', '15:43', '16:26']);

        const chiamateRete = fn.mock.calls.length;
        expect(chiamateRete).toBeGreaterThan(0);

        // ─── Ore 19:00 — STESSA richiesta, stesso cacheKey ───────────────────
        vi.setSystemTime(ALLE_19());

        const secondo = await genera();

        // (1) E' davvero un cache HIT: nessuna chiamata di rete in piu'.
        //     Se fosse una rigenerazione, il test proverebbe un'altra cosa.
        expect(fn.mock.calls.length).toBe(chiamateRete);

        // (2) Il flag resta false: nessun riferimento temporale esplicito nel
        //     prompt, quindi l'orario si ricalcola sempre da adesso (G3, non qui,
        //     introdurra' il caso in cui diventa true).
        expect(secondo.startTimeAnchored).toBe(false);
        expect(secondo._source).toBe('google-first');

        // (3) Gli offset sono identici: e' lo STESSO tour, stesse tappe.
        const stops19 = secondo.days[0].stops;
        expect(stops19.map(s => s.title)).toEqual(stops15.map(s => s.title));
        expect(computeCumulativeOffsets(stops19)).toEqual(offsets);

        // (4) L'asserzione decisiva: gli orari partono dalle 19:00, non dalle
        //     15:00. Prima del fix questa riga leggeva ['15:00','15:43','16:26'].
        expect(stops19[0].scheduledTime).toBe(ALLE_19().toISOString());
        expect(stops19.map(s => formatClockTime(s.scheduledTime))).toEqual(['19:00', '19:43', '20:26']);
        expect(stops19.map(s => s.scheduledTime)).not.toEqual(stops15.map(s => s.scheduledTime));
    });
});
