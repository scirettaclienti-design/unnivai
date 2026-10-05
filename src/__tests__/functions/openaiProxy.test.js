// @vitest-environment node
//
// Gate QUOTA-SERVER — la quota di generazioni la applica openai-proxy, non il client.
//
// Il test esegue il file vero supabase/functions/openai-proxy/index.ts: gli import
// da URL (serve di Deno, supabase-js da esm.sh) sono reindirizzati da
// vitest.config.js a sostituti locali. OpenAI e' un fetch finto che conta le
// chiamate: "OpenAI non viene chiamato" = contatore fermo.
//
// La funzione SQL ai_quota_consume e' sostituita da fakeQuota, un modello in
// memoria con la stessa semantica (stessi parametri, stesse risposte). La SQL vera
// e' provata a parte su Postgres: scripts/test-ai-quota-sql.sh.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const USER_TEXT = 'Per oggi hai usato tutti i tuoi percorsi. Domani se ne aprono altri.';
const GLOBAL_TEXT = 'Oggi Unnivai ha raggiunto il limite di percorsi. Domani se ne aprono altri.';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// ─── Modello in memoria di public.ai_quota_consume ──────────────────────────
function createFakeQuota() {
  const personal = new Map(); // `${kind}:${subject}` → { count, calls }
  const tickets = new Map();  // ticket → { subject, kind, calls }
  const unlimited = new Set();
  let global = 0;
  const row = (k) => { if (!personal.has(k)) personal.set(k, { count: 0, calls: 0 }); return personal.get(k); };
  return {
    unlimited,
    get global() { return global; },
    consume(p) {
      const subject = `${p.p_subject_kind}:${p.p_subject}`;
      const isUnlimited = p.p_subject_kind === 'user' && unlimited.has(p.p_subject);
      if (p.p_purpose === 'aux') {
        if (isUnlimited) return { allowed: true, reason: 'unlimited' };
        const r = row(subject);
        if (r.calls >= p.p_limit) return { allowed: false, reason: 'limit', remaining: 0 };
        r.calls += 1;
        return { allowed: true, reason: 'ok', remaining: p.p_limit - r.calls };
      }
      const t = tickets.get(p.p_ticket);
      if (t) {
        if (t.subject !== subject || t.calls >= 2) return { allowed: false, reason: 'ticket' };
        t.calls += 1;
        return { allowed: true, reason: 'ticket', ticket_kind: t.kind };
      }
      const r = row(subject);
      if (!isUnlimited && r.count >= p.p_limit) return { allowed: false, reason: 'limit', remaining: 0 };
      if (global >= p.p_global_cap) return { allowed: false, reason: 'global', remaining: 0 };
      if (!isUnlimited) r.count += 1;
      global += 1;
      tickets.set(p.p_ticket, { subject, kind: p.p_ticket_kind, calls: 1 });
      return { allowed: true, reason: 'ok', ticket_kind: p.p_ticket_kind, remaining: isUnlimited ? null : p.p_limit - r.count };
    },
  };
}

// ─── Ambiente di prova ───────────────────────────────────────────────────────
let env;
let fakeQuota;
let rpcImpl;
let openaiBodies;
let handler;

const USERS = { 'tok-anna': 'user-anna', 'tok-bruno': 'user-bruno' };

async function loadProxy() {
  vi.resetModules();
  globalThis.__edgeHandler = undefined;
  await import('../../../supabase/functions/openai-proxy/index.ts');
  handler = globalThis.__edgeHandler;
  if (typeof handler !== 'function') throw new Error('openai-proxy non ha registrato un handler');
}

beforeEach(async () => {
  vi.resetAllMocks();
  env = {
    OPENAI_API_KEY: 'sk-test',
    SUPABASE_URL: 'http://supabase.test',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
    SUPABASE_ANON_KEY: 'anon-test',
    AI_QUOTA_IP_SALT: 'sale-di-test',
  };
  vi.stubGlobal('Deno', { env: { get: (k) => env[k] } });

  fakeQuota = createFakeQuota();
  rpcImpl = async (name, params) => {
    if (name !== 'ai_quota_consume') return { data: null, error: { message: `rpc sconosciuta ${name}` } };
    return { data: fakeQuota.consume(params), error: null };
  };
  globalThis.__edgeSupabaseFactory = () => ({
    auth: {
      getUser: async (token) => (USERS[token]
        ? { data: { user: { id: USERS[token] } }, error: null }
        : { data: { user: null }, error: { status: 401, message: 'invalid JWT' } }),
    },
    rpc: (name, params) => rpcImpl(name, params),
  });

  openaiBodies = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    if (String(url) !== OPENAI_URL) throw new Error(`fetch inatteso: ${url}`);
    openaiBodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }));

  await loadProxy();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete globalThis.__edgeSupabaseFactory;
});

// ─── Helper ──────────────────────────────────────────────────────────────────
let ipSeq = 0;
const newTicket = () => `00000000-0000-4000-8000-${String(++ipSeq).padStart(12, '0')}`;

function call({ token, ip = '203.0.113.7', dv, payload = {} } = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-forwarded-for': ip };
  if (token) headers.Authorization = `Bearer ${token}`;
  return handler(new Request('http://edge.test/functions/v1/openai-proxy', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      endpoint: '/chat/completions',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'ciao' }],
      max_tokens: 2000,
      ...payload,
      ...(dv ? { dv } : {}),
    }),
  }));
}

// Una generazione = traduttore d'intento + selettore, stesso biglietto.
async function generation({ token, ip, kind = 'itinerary', calls = 2 } = {}) {
  const dv = { purpose: 'generation', ticket: newTicket(), kind };
  const res = [];
  for (let i = 0; i < calls; i++) res.push(await call({ token, ip, dv }));
  return res;
}

const openaiCalls = () => fetch.mock.calls.length;

// ─── Test ────────────────────────────────────────────────────────────────────
describe('openai-proxy — quota applicata dal server', () => {
  it("utente loggato: l'11ª generazione viene rifiutata e OpenAI non viene chiamato", async () => {
    for (let i = 0; i < 10; i++) {
      const [r1, r2] = await generation({ token: 'tok-anna' });
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
    }
    expect(openaiCalls()).toBe(20); // 10 generazioni × (traduttore + selettore)

    const [eleventh] = await generation({ token: 'tok-anna', calls: 1 });
    expect(eleventh.status).toBe(429);
    const body = await eleventh.json();
    expect(body.code).toBe('QUOTA_EXCEEDED');
    expect(body.error).toBe(USER_TEXT);
    expect(openaiCalls()).toBe(20);

    // Il limite e' per persona: un altro utente genera ancora.
    const [other] = await generation({ token: 'tok-bruno', calls: 1 });
    expect(other.status).toBe(200);
  });

  it('ospite: 5 generazioni per IP, la 6ª viene rifiutata; un altro IP no', async () => {
    for (let i = 0; i < 5; i++) {
      const [r] = await generation({ ip: '198.51.100.20', calls: 1 });
      expect(r.status).toBe(200);
    }
    const before = openaiCalls();
    const [sixth] = await generation({ ip: '198.51.100.20', calls: 1 });
    expect(sixth.status).toBe(429);
    expect((await sixth.json()).error).toBe(USER_TEXT);
    expect(openaiCalls()).toBe(before);

    const [otherIp] = await generation({ ip: '198.51.100.99', calls: 1 });
    expect(otherIp.status).toBe(200);
  });

  it("ospite: l'IP arriva alla funzione solo come hash salato, mai in chiaro", async () => {
    const seen = [];
    rpcImpl = async (_n, params) => { seen.push(params); return { data: fakeQuota.consume(params), error: null }; };
    await generation({ ip: '198.51.100.20', calls: 1 });
    expect(seen[0].p_subject_kind).toBe('guest');
    expect(seen[0].p_subject).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(seen)).not.toContain('198.51.100.20');
  });

  it('tetto globale (AI_GLOBAL_DAILY_CAP): oltre il tetto 429 con il testo globale, letto a ogni richiesta', async () => {
    env.AI_GLOBAL_DAILY_CAP = '3';
    expect((await generation({ token: 'tok-anna', calls: 1 }))[0].status).toBe(200);
    expect((await generation({ token: 'tok-bruno', calls: 1 }))[0].status).toBe(200);
    expect((await generation({ ip: '198.51.100.1', calls: 1 }))[0].status).toBe(200);
    const before = openaiCalls();

    const [over] = await generation({ ip: '198.51.100.2', calls: 1 });
    expect(over.status).toBe(429);
    const body = await over.json();
    expect(body.code).toBe('GLOBAL_QUOTA_EXCEEDED');
    expect(body.error).toBe(GLOBAL_TEXT);
    expect(openaiCalls()).toBe(before);

    // Cambiato senza ricaricare la funzione (= senza deploy): riparte.
    env.AI_GLOBAL_DAILY_CAP = '4';
    expect((await generation({ ip: '198.51.100.2', calls: 1 }))[0].status).toBe(200);
  });

  it('tetto globale: senza variabile vale 1000', async () => {
    const seen = [];
    rpcImpl = async (_n, params) => { seen.push(params); return { data: fakeQuota.consume(params), error: null }; };
    await generation({ token: 'tok-anna', calls: 1 });
    expect(seen[0].p_global_cap).toBe(1000);
  });

  it('controllo quota in errore (rpc con error) → 503 e OpenAI NON viene chiamato', async () => {
    rpcImpl = async () => ({ data: null, error: { message: 'connection refused' } });
    const [r] = await generation({ token: 'tok-anna', calls: 1 });
    expect(r.status).toBe(503);
    expect((await r.json()).code).toBe('QUOTA_CHECK_FAILED');
    expect(openaiCalls()).toBe(0);
  });

  it('controllo quota che lancia un\'eccezione → 503 e OpenAI NON viene chiamato', async () => {
    rpcImpl = async () => { throw new Error('network down'); };
    const r = await call({ token: 'tok-anna' }); // anche senza biglietto (chiamata di contorno)
    expect(r.status).toBe(503);
    expect(openaiCalls()).toBe(0);
  });

  it('ospite senza sale configurato → 503, OpenAI NON viene chiamato', async () => {
    delete env.AI_QUOTA_IP_SALT;
    const [r] = await generation({ ip: '198.51.100.20', calls: 1 });
    expect(r.status).toBe(503);
    expect(openaiCalls()).toBe(0);
  });

  it('token presente ma non valido → 401, OpenAI NON viene chiamato', async () => {
    const [r] = await generation({ token: 'tok-falso', calls: 1 });
    expect(r.status).toBe(401);
    expect(openaiCalls()).toBe(0);
  });

  it('biglietto: massimo 2 chiamate; la 3ª con lo stesso biglietto e\' rifiutata', async () => {
    const res = await generation({ token: 'tok-anna', calls: 3 });
    expect(res.map(r => r.status)).toEqual([200, 200, 403]);
    expect(openaiCalls()).toBe(2);
  });

  it('chiamate di contorno: 40 al giorno per utente, la 41ª rifiutata', async () => {
    for (let i = 0; i < 40; i++) expect((await call({ token: 'tok-anna' })).status).toBe(200);
    const r = await call({ token: 'tok-anna' });
    expect(r.status).toBe(429);
    expect(openaiCalls()).toBe(40);
  });

  it('chiamate di contorno: 15 al giorno per IP ospite, la 16ª rifiutata', async () => {
    for (let i = 0; i < 15; i++) expect((await call({ ip: '198.51.100.30' })).status).toBe(200);
    expect((await call({ ip: '198.51.100.30' })).status).toBe(429);
    expect(openaiCalls()).toBe(15);
  });

  it('modello fuori whitelist → 400, OpenAI NON viene chiamato', async () => {
    const r = await call({ token: 'tok-anna', payload: { model: 'gpt-4o' } });
    expect(r.status).toBe(400);
    expect(openaiCalls()).toBe(0);
  });

  it('max_tokens: 2000 al massimo, 4000 solo per biglietti home_tours; n forzato a 1', async () => {
    await call({ token: 'tok-anna', payload: { max_tokens: 16000, n: 5 } });
    await generation({ token: 'tok-anna', kind: 'itinerary', calls: 1 });
    const dv = { purpose: 'generation', ticket: newTicket(), kind: 'home_tours' };
    await call({ token: 'tok-anna', dv, payload: { max_tokens: 4000 } });
    await call({ token: 'tok-anna', payload: {} }); // nessun max_tokens → 2000
    expect(openaiBodies.map(b => b.max_tokens)).toEqual([2000, 2000, 4000, 2000]);
    expect(openaiBodies[0].n).toBeUndefined();
    expect(openaiBodies.every(b => b.dv === undefined)).toBe(true);
  });

  it('account is_unlimited: nessun limite personale', async () => {
    fakeQuota.unlimited.add('user-anna');
    for (let i = 0; i < 12; i++) {
      expect((await generation({ token: 'tok-anna', calls: 1 }))[0].status).toBe(200);
    }
  });
});
