// @vitest-environment node
//
// QUOTA-CONTORNO — tetto globale giornaliero sulle chiamate di contorno, account senza limiti (AI_UNLIMITED_USER_IDS)
// e corpo massimo 60 KB. Esegue il file vero supabase/functions/openai-proxy/index.ts (vedi openaiProxy.test.js per l'ambiente).
// La SQL vera e' provata a parte su Postgres: scripts/test-ai-quota-contorno-sql.sh.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MSG_CONTORNO = 'Oggi Unnivai ha raggiunto il limite di richieste. Domani riparte tutto.';
const ANNA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BRUNO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IVANO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const USERS = { 'tok-anna': ANNA, 'tok-bruno': BRUNO, 'tok-ivano': IVANO };

let env, handler, rpcLog, auxGlobal, auxCapSeen, racContati, racTettoAperto;

// Modello in memoria della parte 'aux' di ai_quota_consume con p_aux_global_cap (stessa semantica della SQL).
function consume(p) {
  if (p.p_purpose === 'aux') {
    auxCapSeen.push(p.p_aux_global_cap);
    if (p.p_aux_global_cap != null && auxGlobal >= p.p_aux_global_cap) return { allowed: false, reason: 'global_aux', remaining: 0 };
    auxGlobal += 1;
    return { allowed: true, reason: 'ok', remaining: p.p_limit - 1 };
  }
  return { allowed: true, reason: 'ok', ticket_kind: p.p_ticket_kind, remaining: p.p_limit - 1 };
}

beforeEach(async () => {
  vi.resetAllMocks();
  env = {
    OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
    SUPABASE_ANON_KEY: 'anon-test', AI_QUOTA_IP_SALT: 'sale-di-test',
  };
  vi.stubGlobal('Deno', { env: { get: (k) => env[k] } });
  rpcLog = []; auxGlobal = 0; auxCapSeen = []; racContati = 0; racTettoAperto = false;
  globalThis.__edgeSupabaseFactory = () => ({
    auth: {
      getUser: async (token) => (USERS[token]
        ? { data: { user: { id: USERS[token] } }, error: null }
        : { data: { user: null }, error: { status: 401, message: 'invalid JWT' } }),
    },
    rpc: async (name, params) => {
      rpcLog.push(name);
      if (name === 'ai_quota_consume') return { data: consume(params), error: null };
      if (name === 'racconto_consuma') { racContati += 1; return { data: racTettoAperto, error: null }; }
      return { data: null, error: { message: `rpc sconosciuta ${name}` } };
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }), upsert: async () => ({ error: null }) }),
  });
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url) === OPENAI_URL) {
      return new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error('rete non disponibile nel test'); // fonti del racconto, ecc.
  }));
  vi.resetModules();
  globalThis.__edgeHandler = undefined;
  await import('../../../supabase/functions/openai-proxy/index.ts');
  handler = globalThis.__edgeHandler;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete globalThis.__edgeSupabaseFactory;
});

let ipSeq = 0;
function call({ token, ip, dv, payload = {}, rawBody, headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', 'x-forwarded-for': ip ?? `203.0.113.${++ipSeq % 250}`, ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  return handler(new Request('http://edge.test/functions/v1/openai-proxy', {
    method: 'POST', headers: h,
    body: rawBody ?? JSON.stringify({ endpoint: '/chat/completions', model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'ciao' }], max_tokens: 100, ...payload, ...(dv ? { dv } : {}) }),
  }));
}
const aux = (o = {}) => call({ ...o, dv: { purpose: 'aux' } });
const openaiCalls = () => fetch.mock.calls.filter(([u]) => String(u) === OPENAI_URL).length;

describe('tetto globale giornaliero sul contorno', () => {
  it('sotto tetto: gli sconosciuti passano e il proxy manda il tetto (di base 2000) alla funzione', async () => {
    for (let i = 0; i < 3; i++) expect((await aux()).status).toBe(200);
    expect(openaiCalls()).toBe(3);
    expect(auxCapSeen).toEqual([2000, 2000, 2000]);
  });

  it('tetto raggiunto (secret AI_GLOBAL_DAILY_CAP_CONTORNO): 429 con messaggio onesto e OpenAI non viene chiamato', async () => {
    env.AI_GLOBAL_DAILY_CAP_CONTORNO = '2';
    expect((await aux()).status).toBe(200);
    expect((await aux({ token: 'tok-anna' })).status).toBe(200);
    const before = openaiCalls();
    const res = await aux(); // un terzo sconosciuto, IP diverso
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe('GLOBAL_AUX_QUOTA_EXCEEDED');
    expect(body.error).toBe(MSG_CONTORNO);
    expect(openaiCalls()).toBe(before);
    expect((await aux({ token: 'tok-bruno' })).status).toBe(429); // anche un utente normale
  });

  it('il tetto del contorno non ferma le generazioni', async () => {
    env.AI_GLOBAL_DAILY_CAP_CONTORNO = '0';
    expect((await aux()).status).toBe(429);
    const res = await call({ token: 'tok-anna', dv: { purpose: 'generation', ticket: '00000000-0000-4000-8000-000000000001', kind: 'itinerary' } });
    expect(res.status).toBe(200);
  });

  it('valore non valido nel secret: si usa quello di base', async () => {
    env.AI_GLOBAL_DAILY_CAP_CONTORNO = 'tanti';
    await aux();
    expect(auxCapSeen).toEqual([2000]);
  });
});

describe('account senza limiti (AI_UNLIMITED_USER_IDS)', () => {
  beforeEach(() => { env.AI_UNLIMITED_USER_IDS = ` ${IVANO.toUpperCase()} , altro-id `; });

  it('esente dal tetto del contorno anche a tetto pieno: la funzione quota non viene nemmeno chiamata', async () => {
    env.AI_GLOBAL_DAILY_CAP_CONTORNO = '0';
    for (let i = 0; i < 100; i++) expect((await aux({ token: 'tok-ivano' })).status).toBe(200);
    expect(rpcLog).not.toContain('ai_quota_consume');
    expect((await aux({ token: 'tok-anna' })).status).toBe(429); // un altro utente resta fermato
  });

  it('esente dal tetto globale delle generazioni e dal limite personale', async () => {
    env.AI_GLOBAL_DAILY_CAP = '0';
    for (let i = 0; i < 25; i++) {
      const res = await call({ token: 'tok-ivano', dv: { purpose: 'generation', ticket: `00000000-0000-4000-8000-${String(100 + i).padStart(12, '0')}`, kind: 'itinerary' } });
      expect(res.status).toBe(200);
    }
    expect(rpcLog).not.toContain('ai_quota_consume');
  });

  it("l'elenco vuoto o assente non esenta nessuno; un ospite non e' mai esente", async () => {
    env.AI_GLOBAL_DAILY_CAP_CONTORNO = '0';
    env.AI_UNLIMITED_USER_IDS = '';
    expect((await aux({ token: 'tok-ivano' })).status).toBe(429);
    env.AI_UNLIMITED_USER_IDS = IVANO;
    expect((await aux()).status).toBe(429);
  });

  it('esente da RACCONTO_DAILY_CAP: il contatore dei racconti non viene toccato; gli altri restano soggetti', async () => {
    const dv = { purpose: 'racconto', place_id: 'ChIJ_prova_0123456', nome: 'Fontana', citta: 'Roma', lat: 41.9, lng: 12.5 };
    const esente = await call({ token: 'tok-ivano', dv });
    expect(esente.status).not.toBe(429);
    expect(racContati).toBe(0);
    const altro = await call({ token: 'tok-anna', dv });
    expect(altro.status).toBe(429);
    expect((await altro.json()).code).toBe('RACCONTO_TETTO');
    expect(racContati).toBe(1);
  });

  it('un token non valido resta rifiutato anche se l\'elenco esiste', async () => {
    expect((await aux({ token: 'tok-falso' })).status).toBe(401);
  });
});

describe('corpo della richiesta', () => {
  const grande = (n) => JSON.stringify({ endpoint: '/chat/completions', model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'x'.repeat(n) }], dv: { purpose: 'aux' } });

  it('oltre 60 KB: 413 e nessuna chiamata a OpenAI né alla quota', async () => {
    const res = await call({ rawBody: grande(61 * 1024) });
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe('BODY_TOO_LARGE');
    expect(openaiCalls()).toBe(0);
    expect(rpcLog).toEqual([]);
  });

  it('oltre 60 KB anche per l\'account senza limiti (non e\' una quota)', async () => {
    env.AI_UNLIMITED_USER_IDS = IVANO;
    expect((await call({ token: 'tok-ivano', rawBody: grande(61 * 1024) })).status).toBe(413);
  });

  it('con Content-Length dichiarato oltre il limite: 413 senza leggere il corpo', async () => {
    const res = await call({ rawBody: '{}', headers: { 'content-length': String(200 * 1024) } });
    expect(res.status).toBe(413);
  });

  it('corpo di molti byte con pochi caratteri (multibyte): conta i byte', async () => {
    expect((await call({ rawBody: grande(31 * 1024).replace(/x/g, 'è') })).status).toBe(413); // 31K × 2 byte
  });

  it('sotto 60 KB passa', async () => {
    expect((await call({ rawBody: grande(50 * 1024) })).status).toBe(200);
  });

  it('JSON non valido sotto il limite: 400 come prima', async () => {
    expect((await call({ rawBody: '{non json' })).status).toBe(400);
  });
});
