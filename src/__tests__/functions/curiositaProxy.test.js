// @vitest-environment node
//
// CURIOSITÀ-QUARTIERI — `dv.purpose = 'curiosita'` sul file vero supabase/functions/openai-proxy/index.ts (ambiente come openaiProxy.test.js):
// fonti da Nominatim e Wikipedia finti, narratore e revisore finti (OpenAI), place_racconti in memoria. 0 $, nessuna rete.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const CROCIFERI = "La via dei Crociferi (in siciliano strata o via di li Crucìfiri) a Catania è una monumentale direttrice stradale realizzata nel XVIII secolo. Essa ha inizio in piazza San Francesco d’Assisi e vi si accede passando sotto l'arco di San Benedetto.\n== Descrizione ==\nLa strada, contornata da chiese, monasteri e poche abitazioni civili, è un esempio di unità dell'architettura barocca. Nel breve spazio di circa 410 metri sono presenti ben quattro chiese.";
const GIUSTA = "Via dei Crociferi fu realizzata nel XVIII secolo. Nei suoi 410 metri ci sono quattro chiese.";

let env, handler, righe, rpcLog, scritture, narratore, revisore, rete, osmGiu;

beforeEach(async () => {
    vi.resetAllMocks();
    env = { OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'service-role-test', SUPABASE_ANON_KEY: 'anon-test', AI_QUOTA_IP_SALT: 'sale' };
    vi.stubGlobal('Deno', { env: { get: (k) => env[k] } });
    righe = new Map(); rpcLog = []; scritture = []; narratore = [GIUSTA]; revisore = 'sì'; rete = []; osmGiu = false;
    globalThis.__edgeSupabaseFactory = () => ({
        auth: { getUser: async () => ({ data: { user: null }, error: { status: 401 } }) },
        rpc: async (name) => { rpcLog.push(name); return name === 'racconto_consuma' ? { data: true, error: null } : { data: null, error: { message: 'x' } }; },
        from: () => ({
            select: () => ({
                in: async (_c, chiavi) => ({ data: chiavi.filter(k => righe.has(k)).map(k => righe.get(k)), error: null }),
                eq: () => ({ maybeSingle: async () => ({ data: null }) }),
            }),
            upsert: async (r) => { scritture.push(r); righe.set(r.place_id, r); return { error: null }; },
        }),
    });
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
        const u = new URL(String(url));
        const p = Object.fromEntries(u.searchParams);
        const ok = (j) => new Response(JSON.stringify(j), { status: 200, headers: { 'Content-Type': 'application/json' } });
        rete.push(u.hostname);
        if (String(url) === OPENAI_URL) {
            const corpo = JSON.parse(init.body);
            const revisione = /revisore severo/.test(corpo.messages[0].content);
            const testo = revisione
                ? JSON.stringify({ frasi: [1, 2].map(n => ({ n, nelle_fonti: revisore === 'sì', motivo: revisore === 'sì' ? '' : 'non c\'è' })) })
                : (narratore.shift() ?? GIUSTA);
            return ok({ choices: [{ message: { content: testo } }], usage: { prompt_tokens: 10, completion_tokens: 10 } });
        }
        if (osmGiu && /nominatim|photon/.test(u.hostname)) return new Response('{}', { status: 403 });
        if (u.hostname === 'nominatim.openstreetmap.org') return ok({ address: { road: 'Via Crociferi', neighbourhood: 'Giudecca', suburb: 'Centro storico', city: 'Catania' } });
        if (p.list === 'geosearch') return ok({ query: { geosearch: [{ pageid: 443726, title: 'Via dei Crociferi', dist: 4 }] } });
        if (p.generator === 'search') {
            if (p.gsrsearch === 'Via Crociferi Catania') return ok({ query: { pages: [{ pageid: 443726, title: 'Via dei Crociferi', index: 1, coordinates: [{ lat: 37.50497, lon: 15.08483 }] }] } });
            if (p.gsrsearch === 'Centro storico Catania') return ok({ query: { pages: [{ pageid: 3, title: 'Centro Storico (Catania)', index: 1, coordinates: [{ lat: 37.503, lon: 15.0884 }] }] } });
            return ok({ query: { pages: [] } });
        }
        if (p.titles) return ok({ query: { pages: [{ title: p.titles, extract: p.titles === 'Via dei Crociferi' ? CROCIFERI : '' }] } });
        throw new Error(`rete non disponibile nel test: ${url}`);
    }));
    vi.resetModules();
    globalThis.__edgeHandler = undefined;
    await import('../../../supabase/functions/openai-proxy/index.ts');
    handler = globalThis.__edgeHandler;
});
afterEach(() => { vi.unstubAllGlobals(); delete globalThis.__edgeSupabaseFactory; });

const chiedi = (dv) => handler(new Request('http://edge.test/functions/v1/openai-proxy', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    body: JSON.stringify({ dv: { purpose: 'curiosita', lat: 37.505, lng: 15.0848, citta: 'Catania', ...dv } }),
}));
const openai = () => fetch.mock.calls.filter(([u]) => String(u) === OPENAI_URL).length;

describe('curiosità del cammino sul proxy', () => {
    it('una curiosità nuova: narratore + revisore, salvata una volta col suo luogo, versione c1', async () => {
        const r = await chiedi();
        expect(r.status).toBe(200);
        const { curiosita } = await r.json();
        expect(curiosita).toMatchObject({ esito: 'passata', testo: GIUSTA, chiave: 'curiosita-itwiki-443726', luogo: 'Via dei Crociferi', tipo: 'via', cached: false });
        expect(curiosita.fonte).toEqual({ titolo: 'Via dei Crociferi', url: 'https://it.wikipedia.org/wiki/Via_dei_Crociferi' });
        expect(openai()).toBe(2);
        expect(rpcLog).toEqual(['racconto_consuma']); // conta nel tetto dei racconti nuovi
        expect(scritture).toHaveLength(1);
        expect(scritture[0]).toMatchObject({ place_id: 'curiosita-itwiki-443726', versione: 'c1', esito: 'passato', testo: GIUSTA });
        expect(scritture[0].fonti[0]).toMatchObject({ fonte: 'wikipedia', titolo: 'Via dei Crociferi', via: 'curiosita-via-indirizzo' });
    });
    it('già raccontata: dalla cache, 0 chiamate al modello', async () => {
        await chiedi();
        const prima = openai();
        const { curiosita } = await (await chiedi()).json();
        expect(curiosita).toMatchObject({ esito: 'passata', cached: true, chiave: 'curiosita-itwiki-443726' });
        expect(openai()).toBe(prima);
    });
    it('già detta in questo giro: si passa al luogo dopo (il quartiere), mai la stessa', async () => {
        const { curiosita } = await (await chiedi({ escludi: ['curiosita-itwiki-443726'] })).json();
        expect(curiosita.chiave).not.toBe('curiosita-itwiki-443726');
        // il Centro storico ha un testo vuoto: senza fonti, niente testo inventato
        expect(curiosita.esito).toBe('nessuna');
        expect(righe.get('curiosita-itwiki-3')).toMatchObject({ esito: 'senza-fonti', testo: null });
    });
    it('la via è una tappa del giro: non è una curiosità', async () => {
        const { curiosita } = await (await chiedi({ tappe: ['Via Crociferi'] })).json();
        expect(curiosita.chiave).not.toBe('curiosita-itwiki-443726');
    });
    it('il revisore dice «no» anche dopo la riscrittura: scartata e salvata come scartata, nessun testo al client', async () => {
        revisore = 'no';
        const { curiosita } = await (await chiedi()).json();
        expect(curiosita.esito).toBe('nessuna');
        expect(curiosita.testo).toBeUndefined();
        expect(righe.get('curiosita-itwiki-443726')).toMatchObject({ esito: 'scartato', testo: null, versione: 'c1' });
        expect(openai()).toBe(4); // scrive, rivede, riscrive, rivede
    });
    it('al più una curiosità nuova per richiesta', async () => {
        revisore = 'no';
        await chiedi();
        const n = openai();
        righe.delete('curiosita-itwiki-3');
        const { curiosita } = await (await chiedi()).json(); // la via è scartata in cache: si guarda il quartiere, una sola generazione
        expect(curiosita.esito).toBe('nessuna');
        expect(openai() - n).toBe(0); // il quartiere non ha testo: senza fonti, nessuna chiamata
    });
    it('Nominatim e Photon non rispondono: restano le vie a pochi passi (geosearch), il motivo nella risposta', async () => {
        osmGiu = true;
        const { curiosita } = await (await chiedi()).json();
        expect(curiosita).toMatchObject({ esito: 'passata', chiave: 'curiosita-itwiki-443726' });
        const r2 = await (await chiedi({ escludi: ['curiosita-itwiki-443726'] })).json();
        expect(r2.code).toBe('CURIOSITA_FONTI');
        expect(r2.diagnosi).toEqual(['nominatim 403', 'photon 403']);
    });
    it('l\'indirizzo dal telefono vale come quello di Nominatim (e il server non chiama Nominatim); la voce si verifica lo stesso', async () => {
        osmGiu = true;
        const { curiosita } = await (await chiedi({ escludi: ['curiosita-itwiki-443726'], indirizzo: { road: 'Via Crociferi', suburb: 'Centro storico', city: 'Catania' } })).json();
        expect(rete.filter(h => /nominatim|photon/.test(h))).toEqual([]);
        expect(curiosita.esito).toBe('nessuna'); // il Centro storico ha la voce ma senza testo: niente inventato
        expect(righe.has('curiosita-itwiki-3')).toBe(true);
        // un nome che non ha una voce vicina non porta da nessuna parte
        const r = await (await chiedi({ escludi: ['curiosita-itwiki-443726'], indirizzo: { road: 'Via Inventata', city: 'Catania' } })).json();
        expect(r.curiosita?.chiave).toBeUndefined();
    });
    it('posizione non valida: 400; un racconto non può usare una chiave di curiosità', async () => {
        expect((await chiedi({ lat: 'x' })).status).toBe(400);
        const r = await handler(new Request('http://edge.test/functions/v1/openai-proxy', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dv: { purpose: 'racconto', place_id: 'curiosita-itwiki-443726', nome: 'X', citta: 'Catania', lat: 37.5, lng: 15.08 } }),
        }));
        expect(r.status).toBe(400);
    });
});
