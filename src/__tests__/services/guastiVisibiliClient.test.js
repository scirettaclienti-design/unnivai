// Gate P8b — guasti visibili, lato client. Quando il proxy risponde con un
// guasto di OpenAI (o non risponde), generateItinerary e generateHomeTours
// rilanciano AiEngineError fino alla UI, con il tipo del guasto:
//   OPENAI_CREDIT_EXHAUSTED → 'credit' · OPENAI_RATE_LIMITED → 'rate' ·
//   OPENAI_ERROR → 'openai' · altro rifiuto → 'proxy' · rete → 'network'.
// Mai "[object Object]" nel messaggio o nel log. Il narratore resta tollerante.
//
// Rosso sul codice di prima: il traduttore caduto diventava "error-translator"
// (= "non troviamo quello che hai chiesto"), il selettore caduto
// "no-results-error", e il messaggio era "Proxy 429: [object Object]".

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService, AiQuotaExceededError } from '../../services/aiRecommendationService';
import { AiEngineError, AI_ENGINE_MESSAGE } from '../../lib/aiEngineError';

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

const engineDown = (code) => ({ ok: false, status: 502, statusText: 'Bad Gateway', json: async () => ({
    error: AI_ENGINE_MESSAGE, code, source: 'openai', refunded: true,
}) });
const rejection = async (p) => { try { await p; } catch (e) { return e; } throw new Error('nessun errore lanciato'); };

let errSpy;
beforeEach(() => {
    vi.clearAllMocks();
    proxyBodies = [];
    try { window.localStorage.clear(); } catch { /* jsdom */ }
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T15:00:00+02:00'));
    errSpy = vi.spyOn(console, 'error');
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    errSpy.mockRestore();
});

const noObjectInLogs = () => {
    const all = errSpy.mock.calls.map(a => a.map(String).join(' ')).join('\n');
    expect(all).not.toContain('[object Object]');
};

describe('Gate P8b — il guasto arriva alla UI con il suo tipo', () => {
    it('credito OpenAI esaurito sul traduttore → AiEngineError "credit", non "non troviamo"', async () => {
        vi.stubGlobal('fetch', routeFetch(() => engineDown('OPENAI_CREDIT_EXHAUSTED')));
        const err = await rejection(genera());
        expect(err).toBeInstanceOf(AiEngineError);
        expect(err.code).toBe('AI_ENGINE_DOWN');
        expect(err.kind).toBe('credit');
        expect(err.userMessage).toBe('Il motore si è fermato un attimo. Riprova tra qualche minuto.');
        expect(String(err.message)).not.toContain('[object Object]');
        noObjectInLogs();
    });

    it('troppe richieste sul selettore → AiEngineError "rate"', async () => {
        vi.stubGlobal('fetch', routeFetch((n) => (n === 0 ? ai(INTENT) : engineDown('OPENAI_RATE_LIMITED'))));
        const err = await rejection(genera());
        expect(err).toBeInstanceOf(AiEngineError);
        expect(err.kind).toBe('rate');
    });

    it('errore generico OpenAI nel Percorso B (senza frase) → AiEngineError "openai"', async () => {
        vi.stubGlobal('fetch', routeFetch(() => engineDown('OPENAI_ERROR')));
        const err = await rejection(genera(''));
        expect(err).toBeInstanceOf(AiEngineError);
        expect(err.kind).toBe('openai');
    });

    it('errore di rete verso il proxy → AiEngineError "network"', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url) => {
            if (String(url).includes('openai-proxy')) throw new TypeError('Failed to fetch');
            return routeFetch(normal)(url, {});
        }));
        const err = await rejection(genera());
        expect(err).toBeInstanceOf(AiEngineError);
        expect(err.kind).toBe('network');
        noObjectInLogs();
    });

    it('risposta del proxy vecchio ({ error: <oggetto OpenAI> }) → AiEngineError "proxy", mai "[object Object]"', async () => {
        vi.stubGlobal('fetch', routeFetch(() => ({ ok: false, status: 429, statusText: 'Too Many Requests',
            json: async () => ({ error: { message: 'You exceeded your current quota', type: 'insufficient_quota', code: 'insufficient_quota' } }) })));
        const err = await rejection(genera());
        expect(err).toBeInstanceOf(AiEngineError);
        expect(err.kind).toBe('proxy');
        expect(err.message).not.toContain('[object Object]');
        noObjectInLogs();
    });

    it('"Per Te": il narratore della Home cade per credito esaurito → AiEngineError, non { tours: [] }', async () => {
        vi.stubGlobal('fetch', routeFetch(() => engineDown('OPENAI_CREDIT_EXHAUSTED')));
        const err = await rejection(aiRecommendationService.generateHomeTours({
            city: 'Cabras', cityCenter: CABRAS, themedCandidates: { insider: SPIAGGE },
        }));
        expect(err).toBeInstanceOf(AiEngineError);
        expect(err.kind).toBe('credit');
    });

    it('la nostra quota esaurita resta quella di prima', async () => {
        vi.stubGlobal('fetch', routeFetch(() => ({ ok: false, status: 429, json: async () => ({
            code: 'QUOTA_EXCEEDED', error: 'Per oggi hai usato tutti i tuoi percorsi. Domani se ne aprono altri.' }) })));
        const err = await rejection(genera());
        expect(err).toBeInstanceOf(AiQuotaExceededError);
        expect(err).not.toBeInstanceOf(AiEngineError);
    });

    it('narratore giù (3ª chiamata) → il tour esce lo stesso, senza racconto (narratore non toccato)', async () => {
        vi.stubGlobal('fetch', routeFetch((n) => (n < 2 ? normal(n) : engineDown('OPENAI_ERROR'))));
        const result = await genera();
        expect(result._source).toBe('google-first');
        expect(result.days[0].stops.length).toBeGreaterThan(0);
    });
});
