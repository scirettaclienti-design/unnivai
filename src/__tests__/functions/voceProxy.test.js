// @vitest-environment node
//
// VOCE-1 — la voce umana della navigazione passa da openai-proxy (`dv.purpose = 'voce'`).
// Si esegue il file vero supabase/functions/openai-proxy/index.ts con OpenAI e Supabase finti.
// «Una frase già detta costa 0 $» = la seconda richiesta uguale non fa nessuna chiamata a OpenAI e non conta nel tetto.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SPEECH_URL = 'https://api.openai.com/v1/audio/speech';
const STORAGE = 'http://supabase.test/storage/v1/object/public/voce-cache/';
const TONO = 'Parli in italiano come un amico del posto che accompagna a piedi: calmo, caldo, sorriso nella voce, frasi naturali, mai da guida turistica, mai enfatico.';

let env, handler, files, speechBodies, usoNuovi, tetto, logs;

beforeEach(async () => {
  vi.resetAllMocks();
  env = {
    OPENAI_API_KEY: 'sk-test-segreta',
    SUPABASE_URL: 'http://supabase.test',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
    SUPABASE_ANON_KEY: 'anon-test',
    AI_QUOTA_IP_SALT: 'sale-di-test',
  };
  vi.stubGlobal('Deno', { env: { get: (k) => env[k] } });
  files = new Map(); speechBodies = []; usoNuovi = 0; tetto = 200; logs = [];
  vi.spyOn(console, 'log').mockImplementation((...a) => logs.push(a.join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...a) => logs.push(a.join(' ')));

  globalThis.__edgeSupabaseFactory = () => ({
    auth: { getUser: async (t) => (t === 'tok-anna' ? { data: { user: { id: 'u1' } }, error: null } : { data: { user: null }, error: { status: 401, message: 'invalid JWT' } }) },
    rpc: async (name) => {
      if (name !== 'voce_consuma') return { data: null, error: { message: `rpc inattesa ${name}` } };
      if (usoNuovi >= tetto) return { data: false, error: null };
      usoNuovi += 1;
      return { data: true, error: null };
    },
    storage: { from: (bucket) => ({
      upload: async (path, bytes, opts) => {
        if (bucket !== 'voce-cache') return { error: { message: 'bucket sbagliato' } };
        files.set(path, { bytes, opts });
        return { error: null };
      },
    }) },
  });

  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    const u = String(url);
    if (u.startsWith(STORAGE)) {
      const percorso = u.slice(STORAGE.length);
      return new Response(null, { status: files.has(percorso) ? 200 : 404 });
    }
    if (u === SPEECH_URL) {
      speechBodies.push({ body: JSON.parse(init.body), auth: init.headers.Authorization });
      return new Response(new Uint8Array(2048), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
    }
    throw new Error(`fetch inatteso: ${u}`);
  }));

  vi.resetModules();
  globalThis.__edgeHandler = undefined;
  await import('../../../supabase/functions/openai-proxy/index.ts');
  handler = globalThis.__edgeHandler;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete globalThis.__edgeSupabaseFactory;
});

const voce = (dv, token) => handler(new Request('http://edge.test/functions/v1/openai-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.9', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify({ dv: { purpose: 'voce', ...dv } }),
}));

describe('voce — cache: una frase già detta costa 0 $', () => {
  it('la prima richiesta genera (1 chiamata), la seconda arriva dalla cache (0 chiamate, tetto fermo)', async () => {
    const a = await voce({ testo: 'Fra cinquanta metri gira a sinistra.', voce: 'marin' });
    const ja = await a.json();
    expect(a.status).toBe(200);
    expect(ja.source).toBe('nuova');
    expect(speechBodies).toHaveLength(1);
    expect(usoNuovi).toBe(1);
    expect(files.size).toBe(1);

    const b = await voce({ testo: 'Fra cinquanta metri gira a sinistra.', voce: 'marin' });
    const jb = await b.json();
    expect(jb.source).toBe('cache');
    expect(jb.url).toBe(ja.url);
    expect(speechBodies).toHaveLength(1); // nessuna chiamata in più
    expect(usoNuovi).toBe(1);             // e il tetto non si muove
  });

  it('spazi e a capo diversi sono la stessa frase; un\'altra voce è un audio diverso', async () => {
    await voce({ testo: 'Adesso gira a destra.', voce: 'marin' });
    const stessa = await (await voce({ testo: '  Adesso   gira\na destra. ', voce: 'marin' })).json();
    expect(stessa.source).toBe('cache');
    const altra = await (await voce({ testo: 'Adesso gira a destra.', voce: 'cedar' })).json();
    expect(altra.source).toBe('nuova');
    expect(speechBodies).toHaveLength(2);
  });

  it('senza voce chiesta usa marin', async () => {
    const r = await (await voce({ testo: 'Si va verso Piazza Duomo.' })).json();
    expect(r.voce).toBe('marin');
    expect(speechBodies[0].body.voice).toBe('marin');
  });
});

describe('voce — il server decide modello, tono e formato', () => {
  it('chiama gpt-4o-mini-tts con il tono fisso, in mp3, con la chiave solo lato server', async () => {
    await voce({ testo: 'Eccoci.', voce: 'cedar', model: 'tts-1-hd', instructions: 'urla', response_format: 'wav' });
    const { body, auth } = speechBodies[0];
    expect(body).toEqual({ model: 'gpt-4o-mini-tts', voice: 'cedar', input: 'Eccoci.', instructions: TONO, response_format: 'mp3' });
    expect(auth).toBe('Bearer sk-test-segreta');
    expect(files.values().next().value.opts.contentType).toBe('audio/mpeg');
  });

  it('la chiave non esce mai: né nella risposta né nei log', async () => {
    const r = await voce({ testo: 'Una frase qualunque.', voce: 'marin' });
    expect(JSON.stringify(await r.json())).not.toContain('sk-test');
    expect(logs.join('\n')).not.toContain('sk-test');
    expect(logs.join('\n')).not.toContain('Una frase qualunque'); // il testo non finisce nei log
  });
});

describe('voce — rifiuti e guasti (il client torna alla voce del browser)', () => {
  it('voce sconosciuta o testo vuoto/troppo lungo: 400, OpenAI non chiamato', async () => {
    expect((await voce({ testo: 'ciao ciao', voce: 'alloy' })).status).toBe(400);
    expect((await voce({ testo: '   ', voce: 'marin' })).status).toBe(400);
    expect((await voce({ testo: 'a'.repeat(901), voce: 'marin' })).status).toBe(400);
    expect((await voce({ voce: 'marin' })).status).toBe(400);
    expect(speechBodies).toHaveLength(0);
  });

  it('tetto giornaliero raggiunto: 429 VOCE_TETTO, OpenAI non chiamato; la cache continua a rispondere', async () => {
    tetto = 1;
    await voce({ testo: 'Prima frase.', voce: 'marin' });
    const r = await voce({ testo: 'Seconda frase diversa.', voce: 'marin' });
    expect(r.status).toBe(429);
    expect((await r.json()).code).toBe('VOCE_TETTO');
    expect(speechBodies).toHaveLength(1);
    expect((await (await voce({ testo: 'Prima frase.', voce: 'marin' })).json()).source).toBe('cache');
  });

  it('OpenAI in errore: 502 senza dettagli, niente nella cache', async () => {
    fetch.mockImplementationOnce(async (url) => (String(url).startsWith(STORAGE) ? new Response(null, { status: 404 }) : null));
    fetch.mockImplementationOnce(async () => new Response('{"error":{"message":"boom sk-test-segreta"}}', { status: 500 }));
    const r = await voce({ testo: 'Frase che fallisce.', voce: 'marin' });
    expect(r.status).toBe(502);
    expect((await r.json()).code).toBe('VOCE_OPENAI');
    expect(files.size).toBe(0);
    expect(logs.join('\n')).not.toContain('sk-test-segreta');
  });

  it('token non valido: 401 e OpenAI non chiamato', async () => {
    const r = await voce({ testo: 'Ciao a tutti.', voce: 'marin' }, 'tok-sbagliato');
    expect(r.status).toBe(401);
    expect(speechBodies).toHaveLength(0);
  });

  it('un utente loggato non consuma la quota dei percorsi (nessuna rpc ai_quota_*)', async () => {
    const r = await voce({ testo: 'Ciao Anna.', voce: 'marin' }, 'tok-anna');
    expect(r.status).toBe(200);
  });
});
