// OSPITE-GIRO — lato client del motore: i limiti del giro di prova arrivano alla UI col testo del server e aprono
// l'invito a creare l'account; l'ospite che ha finito il giro di prova non fa nemmeno la chiamata. Stesso ambiente di
// quotaServerSide.test.js. Il server: src/__tests__/functions/openaiProxyOspite.test.js.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    aiRecommendationService,
    AiQuotaExceededError,
    MSG_OSPITE_SECONDO,
} from '../../services/aiRecommendationService';
import { segnaGiroDiProva, EVENTO_REGISTRATI } from '../../lib/ospite';
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

const OSPITE = { id: 'anon-1', is_anonymous: true };
let inviti;
const ascolta = (e) => inviti.push(e.detail);

describe('OSPITE-GIRO — client del motore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        proxyBodies = [];
        builders = [];
        inviti = [];
        window.addEventListener(EVENTO_REGISTRATI, ascolta);
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: OSPITE, access_token: 'jwt-ospite' } } });
        vi.mocked(supabase.from).mockImplementation((table) => trackingBuilder(table));
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-07T15:00:00+02:00'));
    });

    afterEach(() => {
        window.removeEventListener(EVENTO_REGISTRATI, ascolta);
        vi.unstubAllGlobals();
        vi.useRealTimers();
        vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } });
        vi.mocked(supabase.from).mockReset();
    });

    it('ospite nuovo: il primo giro si genera (nessun invito prima del primo giro)', async () => {
        vi.stubGlobal('fetch', routeFetch(normal));
        const tour = await genera();
        expect(tour._source).toBe('google-first');
        expect(inviti).toEqual([]);
    });

    it('il server dice OSPITE_GIRO_USATO: errore di quota col testo del server e invito «secondo»', async () => {
        const testo = "Il giro di prova l'hai fatto. Il prossimo parte dal tuo account.";
        vi.stubGlobal('fetch', routeFetch(() => serverRefuses('OSPITE_GIRO_USATO', testo)));
        const err = await genera().catch((e) => e);
        expect(err).toBeInstanceOf(AiQuotaExceededError);
        expect(err.code).toBe('QUOTA_EXCEEDED');
        expect(err.scope).toBe('ospite');
        expect(err.userMessage).toBe(testo);
        expect(inviti).toEqual([{ momento: 'secondo', testo }]);
    });

    it('tetto per rete e tetto degli ospiti: invito «limite» con il testo del server', async () => {
        const testo = 'Per oggi i giri di prova sono finiti. Con il tuo account parti adesso, oppure riprova domani.';
        vi.stubGlobal('fetch', routeFetch(() => serverRefuses('OSPITI_LIMITE', testo)));
        const err = await genera().catch((e) => e);
        expect(err.userMessage).toBe(testo);
        expect(inviti).toEqual([{ momento: 'limite', testo }]);
    });

    it('giro di prova già finito: la richiesta del secondo giro apre l\'invito, nessuna chiamata al motore', async () => {
        segnaGiroDiProva('anon-1', 'giro-a');
        const f = routeFetch(normal);
        vi.stubGlobal('fetch', f);
        const err = await genera().catch((e) => e);
        expect(err).toBeInstanceOf(AiQuotaExceededError);
        expect(err.userMessage).toBe(MSG_OSPITE_SECONDO);
        expect(inviti).toEqual([{ momento: 'secondo', testo: null }]);
        expect(proxyBodies).toHaveLength(0);
    });

    it('un utente registrato con lo stesso telefono non viene fermato', async () => {
        segnaGiroDiProva('anon-1', 'giro-a');
        vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'anon-1', is_anonymous: false }, access_token: 'jwt' } } });
        vi.stubGlobal('fetch', routeFetch(normal));
        expect((await genera())._source).toBe('google-first');
        expect(inviti).toEqual([]);
    });
});
