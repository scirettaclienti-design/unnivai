// Gate QUOTA-SERVER — lato client.
//
// Il server (openai-proxy) conta "una generazione" per biglietto: questo file
// prova che il client manda lo STESSO biglietto su traduttore e selettore, un
// biglietto NUOVO per ogni generazione, che non scrive mai ai_quota_daily, e che
// il rifiuto del server arriva alla UI con il testo del server (anche quando
// arriva sulla prima chiamata, quella del traduttore).
// Il server stesso e' provato in src/__tests__/functions/openaiProxy.test.js.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    aiRecommendationService,
    AiQuotaExceededError,
    getDailyQuotaStatus,
    QUOTA_USER_MESSAGE,
    QUOTA_GLOBAL_MESSAGE,
} from '../../services/aiRecommendationService';
import { supabase } from '../../lib/supabase';

const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const aKm = (km) => CABRAS.latitude + (km / 111);
const SPIAGGE = ['pid-a', 'pid-b', 'pid-c'].map((id, i) => ({
    place_id: id,
    name: `Spiaggia ${i}`,
    geometry: { location: { lat: aKm(0.5 + i), lng: CABRAS.longitude } },
    rating: 4.5,
    user_ratings_total: 300,
    business_status: 'OPERATIONAL',
    types: ['establishment', 'natural_feature', 'point_of_interest'],
}));
const INTENT = { queries: ['spiagge'], categoria: 'natura', oggetto_umano: 'spiagge', vincoli: { tempo: null, escludi: [], note: null } };
const SELECTOR = {
    days: [{
        day: 1,
        title: 'Il vento del Sinis',
        stops: SPIAGGE.map(p => ({ place_id: p.place_id, description: 'Sabbia di quarzo sotto i piedi' })),
    }],
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// proxyReply(n) decide la risposta dell'n-esima chiamata a openai-proxy.
let proxyBodies;
const routeFetch = (proxyReply) => vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes('openai-proxy')) {
        const n = proxyBodies.length;
        proxyBodies.push(JSON.parse(init.body));
        return proxyReply(n);
    }
    if (u.includes('textsearch')) {
        const d = decodeURIComponent(u);
        const hit = d.includes('Cabras');
        return { ok: true, json: async () => ({ status: 'OK', results: hit ? SPIAGGE : [] }) };
    }
    if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
    throw new Error(`fetch inatteso: ${u}`);
});
const ai = (payload) => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) });
const serverRefuses = (code, error) => ({ ok: false, status: 429, statusText: 'Too Many Requests', json: async () => ({ code, error }) });
const normal = (n) => ai(n === 0 ? INTENT : SELECTOR);

const genera = (prompt = 'le spiagge piu belle') => aiRecommendationService.generateItinerary(
    'Cabras', { interests: ['Natura'] }, prompt, {}, '', CABRAS,
);

// Registra ogni builder per tabella, per verificare che ai_quota_daily non venga scritta.
let builders;
const trackingBuilder = (table) => {
    const b = {};
    for (const k of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'or', 'order', 'limit', 'range', 'gte', 'lte']) {
        b[k] = vi.fn(() => b);
    }
    b.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    b.single = vi.fn().mockResolvedValue({ data: null, error: null });
    b.then = (resolve) => Promise.resolve({ data: [], error: null }).then(resolve);
    builders.push({ table, b });
    return b;
};

describe('Gate QUOTA-SERVER — client', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        proxyBodies = [];
        builders = [];
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { user: { id: 'user-anna' }, access_token: 'jwt-anna' } },
        });
        vi.mocked(supabase.from).mockImplementation((table) => trackingBuilder(table));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
        vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } });
        vi.mocked(supabase.from).mockReset();
    });

    it('traduttore, selettore e narratore della STESSA generazione portano lo stesso biglietto', async () => {
        vi.stubGlobal('fetch', routeFetch(normal));
        const tour = await genera();
        expect(tour._source).toBe('google-first');

        // Gate NARRATORE-DOPO: 3 chiamate, il massimo che il biglietto 'itinerary' ammette.
        expect(proxyBodies).toHaveLength(3);
        const [traduttore, selettore, narratore] = proxyBodies.map(b => b.dv);
        expect(traduttore).toEqual({ purpose: 'generation', ticket: expect.stringMatching(UUID_RE), kind: 'itinerary' });
        expect(selettore).toEqual(traduttore);
        expect(narratore).toEqual(traduttore);
    });

    it('due generazioni diverse → due biglietti diversi', async () => {
        // Gate NARRATORE-DOPO: 3 chiamate per generazione (traduttore, selettore, narratore).
        vi.stubGlobal('fetch', routeFetch((n) => ai(n % 3 === 0 ? INTENT : SELECTOR)));
        await genera('le spiagge piu belle');
        await genera('spiagge tranquille al tramonto');
        expect(proxyBodies).toHaveLength(6);
        expect(proxyBodies[1].dv.ticket).toBe(proxyBodies[0].dv.ticket);
        expect(proxyBodies[2].dv.ticket).toBe(proxyBodies[0].dv.ticket);
        expect(proxyBodies[4].dv.ticket).toBe(proxyBodies[3].dv.ticket);
        expect(proxyBodies[5].dv.ticket).toBe(proxyBodies[3].dv.ticket);
        expect(proxyBodies[3].dv.ticket).not.toBe(proxyBodies[0].dv.ticket);
    });

    it('il client non scrive MAI ai_quota_daily (solo lettura per il preflight)', async () => {
        vi.stubGlobal('fetch', routeFetch(normal));
        await genera();
        const quota = builders.filter(x => x.table === 'ai_quota_daily');
        expect(quota.length).toBeGreaterThan(0); // il preflight legge
        for (const { b } of quota) {
            expect(b.upsert).not.toHaveBeenCalled();
            expect(b.insert).not.toHaveBeenCalled();
            expect(b.update).not.toHaveBeenCalled();
            expect(b.delete).not.toHaveBeenCalled();
        }
    });

    it('il preflight legge il giorno di Roma, non quello UTC', async () => {
        // 22:30 UTC del 10/09 = 00:30 dell'11/09 a Roma (CEST).
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-09-10T22:30:00Z'));
        await getDailyQuotaStatus();
        const quota = builders.find(x => x.table === 'ai_quota_daily');
        expect(quota.b.eq).toHaveBeenCalledWith('day', '2026-09-11');
    });

    it('rifiuto del server sul traduttore → arriva alla UI come quota, con il testo del server', async () => {
        vi.stubGlobal('fetch', routeFetch(() => serverRefuses('QUOTA_EXCEEDED', QUOTA_USER_MESSAGE)));
        const err = await genera().catch(e => e);
        expect(err).toBeInstanceOf(AiQuotaExceededError);
        expect(err.code).toBe('QUOTA_EXCEEDED');
        expect(err.userMessage).toBe('Per oggi hai usato tutti i tuoi percorsi. Domani se ne aprono altri.');
        expect(proxyBodies).toHaveLength(1); // il selettore non parte
    });

    it('tetto globale → scope global e il testo globale', async () => {
        vi.stubGlobal('fetch', routeFetch(() => serverRefuses('GLOBAL_QUOTA_EXCEEDED', QUOTA_GLOBAL_MESSAGE)));
        const err = await genera().catch(e => e);
        expect(err).toBeInstanceOf(AiQuotaExceededError);
        expect(err.code).toBe('QUOTA_EXCEEDED'); // le pagine continuano a riconoscerlo
        expect(err.scope).toBe('global');
        expect(err.userMessage).toBe('Oggi Unnivai ha raggiunto il limite di percorsi. Domani se ne aprono altri.');
    });

    it('il preflight e\' raggiungibile anche come metodo (SurpriseTour lo chiama cosi\')', () => {
        expect(aiRecommendationService.getDailyQuotaStatus).toBe(getDailyQuotaStatus);
    });

    it('generateHomeTours manda un biglietto home_tours', async () => {
        vi.stubGlobal('fetch', routeFetch(() => ai({ tours: [] })));
        await aiRecommendationService.generateHomeTours({
            city: 'Cabras',
            cityCenter: CABRAS,
            themedCandidates: { insider: SPIAGGE },
        });
        expect(proxyBodies).toHaveLength(1);
        expect(proxyBodies[0].dv).toEqual({ purpose: 'generation', ticket: expect.stringMatching(UUID_RE), kind: 'home_tours' });
    });

    it('le chiamate di contorno (chat) non portano biglietto', async () => {
        vi.stubGlobal('fetch', routeFetch(() => ai({ reply: 'ciao' })));
        await aiRecommendationService.chatWithGuide([{ role: 'user', content: 'ciao' }], {}).catch(() => {});
        expect(proxyBodies).toHaveLength(1);
        expect(proxyBodies[0].dv).toBeUndefined();
    });
});
