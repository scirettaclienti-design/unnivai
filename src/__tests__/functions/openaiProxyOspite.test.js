// @vitest-environment node
//
// OSPITE-GIRO — l'account anonimo del giro di prova nel proxy: un giro per account, tetto per IP e tetto globale
// degli ospiti (secret con valore di base), messaggi onesti, rimborso quando il motore si ferma, contorno contato
// come utente. Esegue il file vero supabase/functions/openai-proxy/index.ts (ambiente come openaiProxyTetti.test.js).
// La SQL vera e' provata a parte su Postgres: scripts/test-ospite-giro-sql.sh.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ANNA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OSPITE_1 = 'dddddddd-dddd-4ddd-8ddd-000000000001';
const OSPITE_2 = 'dddddddd-dddd-4ddd-8ddd-000000000002';
const OSPITE_3 = 'dddddddd-dddd-4ddd-8ddd-000000000003';
const USERS = {
  'tok-anna': { id: ANNA, is_anonymous: false },
  'tok-o1': { id: OSPITE_1, is_anonymous: true },
  'tok-o2': { id: OSPITE_2, is_anonymous: true },
  'tok-o3': { id: OSPITE_3, is_anonymous: true },
};

let env, handler, rpcLog, rpcParams, stato, openaiStatus;

// Modello in memoria di public.ai_quota_ospite / ai_quota_ospite_rimborso (stessa semantica della SQL).
function ospite(p) {
  const t = stato.biglietti.get(p.p_ticket);
  if (t) return t.subject === `ospite:${p.p_user}` ? { allowed: true, reason: 'ticket' } : { allowed: false, reason: 'ticket' };
  const conto = stato.account.get(p.p_user) || { giri: 0, per_te: 0 };
  if (p.p_ticket_kind === 'itinerary' && conto.giri >= p.p_giri) return { allowed: false, reason: 'ospite_giro' };
  if (p.p_ticket_kind === 'home_tours' && conto.per_te >= p.p_per_te) return { allowed: false, reason: 'ospite_per_te' };
  if ((stato.ip.get(p.p_ip_hash) || 0) >= p.p_ip_cap) return { allowed: false, reason: 'ospite_ip' };
  if (stato.ospiti >= p.p_ospiti_cap) return { allowed: false, reason: 'ospiti' };
  if (stato.globale >= p.p_global_cap) return { allowed: false, reason: 'global' };
  stato.account.set(p.p_user, p.p_ticket_kind === 'itinerary' ? { ...conto, giri: conto.giri + 1 } : { ...conto, per_te: conto.per_te + 1 });
  stato.ip.set(p.p_ip_hash, (stato.ip.get(p.p_ip_hash) || 0) + 1);
  stato.ospiti += 1; stato.globale += 1;
  stato.biglietti.set(p.p_ticket, { subject: `ospite:${p.p_user}`, kind: p.p_ticket_kind, ip: p.p_ip_hash });
  return { allowed: true, reason: 'ok', ticket_kind: p.p_ticket_kind };
}
function rimborso(p) {
  const t = stato.biglietti.get(p.p_ticket);
  if (!t || t.subject !== `ospite:${p.p_user}`) return { refunded: false, reason: 'no_ticket' };
  const conto = stato.account.get(p.p_user);
  stato.account.set(p.p_user, t.kind === 'itinerary' ? { ...conto, giri: conto.giri - 1 } : { ...conto, per_te: conto.per_te - 1 });
  stato.ip.set(t.ip, stato.ip.get(t.ip) - 1);
  stato.ospiti -= 1; stato.globale -= 1;
  stato.biglietti.delete(p.p_ticket);
  return { refunded: true, reason: 'ok' };
}

beforeEach(async () => {
  vi.resetAllMocks();
  env = {
    OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
    SUPABASE_ANON_KEY: 'anon-test', AI_QUOTA_IP_SALT: 'sale-di-test',
  };
  vi.stubGlobal('Deno', { env: { get: (k) => env[k] } });
  rpcLog = []; rpcParams = [];
  stato = { account: new Map(), ip: new Map(), ospiti: 0, globale: 0, biglietti: new Map() };
  openaiStatus = 200;
  globalThis.__edgeSupabaseFactory = () => ({
    auth: {
      getUser: async (token) => (USERS[token]
        ? { data: { user: USERS[token] }, error: null }
        : { data: { user: null }, error: { status: 401, message: 'invalid JWT' } }),
    },
    rpc: async (name, params) => {
      rpcLog.push(name); rpcParams.push({ name, params });
      if (name === 'ai_quota_ospite') return { data: ospite(params), error: null };
      if (name === 'ai_quota_ospite_rimborso') return { data: rimborso(params), error: null };
      if (name === 'ai_quota_consume') return { data: { allowed: true, reason: 'ok', remaining: params.p_limit - 1 }, error: null };
      return { data: null, error: { message: `rpc sconosciuta ${name}` } };
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }), upsert: async () => ({ error: null }) }),
  });
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url) === OPENAI_URL) {
      if (openaiStatus !== 200) {
        return new Response(JSON.stringify({ error: { message: 'giu', type: 'server_error', code: null } }), { status: openaiStatus, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error('rete non disponibile nel test');
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

let seq = 0;
const biglietto = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
function call({ token, ip = '198.51.100.7', dv } = {}) {
  const h = { 'Content-Type': 'application/json', 'x-forwarded-for': ip };
  if (token) h.Authorization = `Bearer ${token}`;
  return handler(new Request('http://edge.test/functions/v1/openai-proxy', {
    method: 'POST', headers: h,
    body: JSON.stringify({ endpoint: '/chat/completions', model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'ciao' }], max_tokens: 100, ...(dv ? { dv } : {}) }),
  }));
}
const giro = (token, o = {}) => call({ token, ...o, dv: { purpose: 'generation', ticket: o.ticket || biglietto(), kind: o.kind || 'itinerary' } });
const openaiCalls = () => fetch.mock.calls.filter(([u]) => String(u) === OPENAI_URL).length;

describe('ospite nuovo: un giro di prova', () => {
  it('il primo giro passa da ai_quota_ospite (non da ai_quota_consume), con i tetti di base', async () => {
    const res = await giro('tok-o1');
    expect(res.status).toBe(200);
    expect(rpcLog).toEqual(['ai_quota_ospite']);
    const p = rpcParams[0].params;
    expect(p).toMatchObject({ p_user: OSPITE_1, p_ticket_kind: 'itinerary', p_giri: 1, p_per_te: 2, p_ip_cap: 10, p_ospiti_cap: 100, p_global_cap: 1000 });
    expect(p.p_ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(p)).not.toContain('198.51.100.7'); // l'IP in chiaro non esce
  });

  it('le chiamate dello stesso biglietto non contano un secondo giro', async () => {
    const ticket = biglietto();
    for (let i = 0; i < 3; i++) expect((await giro('tok-o1', { ticket })).status).toBe(200);
    expect(stato.account.get(OSPITE_1).giri).toBe(1);
  });

  it('il secondo giro: 429 OSPITE_GIRO_USATO col messaggio onesto, OpenAI non viene chiamato', async () => {
    expect((await giro('tok-o1')).status).toBe(200);
    const prima = openaiCalls();
    const res = await giro('tok-o1');
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Il giro di prova l'hai fatto. Il prossimo parte dal tuo account.", code: 'OSPITE_GIRO_USATO' });
    expect(openaiCalls()).toBe(prima);
  });

  it('Per Te: due generazioni per account, poi OSPITE_PER_TE_USATO; non tocca il giro', async () => {
    expect((await giro('tok-o1', { kind: 'home_tours' })).status).toBe(200);
    expect((await giro('tok-o1', { kind: 'home_tours' })).status).toBe(200);
    const res = await giro('tok-o1', { kind: 'home_tours' });
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('OSPITE_PER_TE_USATO');
    expect((await giro('tok-o1')).status).toBe(200); // il giro di Crea resta
  });

  it('un utente registrato non passa dai tetti dell\'ospite', async () => {
    expect((await giro('tok-anna')).status).toBe(200);
    expect((await giro('tok-anna')).status).toBe(200);
    expect(rpcLog).toEqual(['ai_quota_consume', 'ai_quota_consume']);
    expect(rpcParams[0].params).toMatchObject({ p_subject_kind: 'user', p_subject: ANNA, p_limit: 10 });
  });
});

describe('tetto per indirizzo IP e tetto globale degli ospiti', () => {
  it('stesso IP: oltre AI_OSPITE_IP_DAILY_CAP un altro ospite riceve OSPITE_IP_LIMITE; da un altro IP passa', async () => {
    env.AI_OSPITE_IP_DAILY_CAP = '2';
    expect((await giro('tok-o1')).status).toBe(200);
    expect((await giro('tok-o2')).status).toBe(200);
    const res = await giro('tok-o3');
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe('OSPITE_IP_LIMITE');
    expect(body.error).toBe('Da questa rete oggi sono partiti già molti giri di prova. Con il tuo account parti adesso.');
    expect((await giro('tok-o3', { ip: '203.0.113.50' })).status).toBe(200);
  });

  it('x-forwarded-for con più indirizzi: conta il primo (lo stesso IP con proxy diversi è lo stesso IP)', async () => {
    env.AI_OSPITE_IP_DAILY_CAP = '1';
    expect((await giro('tok-o1', { ip: '198.51.100.9, 10.0.0.1' })).status).toBe(200);
    expect((await giro('tok-o2', { ip: '198.51.100.9, 10.0.0.2' })).status).toBe(429);
  });

  it('tetto globale degli ospiti (AI_OSPITI_DAILY_CAP): OSPITI_LIMITE, ma gli utenti registrati continuano', async () => {
    env.AI_OSPITI_DAILY_CAP = '1';
    expect((await giro('tok-o1', { ip: '203.0.113.1' })).status).toBe(200);
    const res = await giro('tok-o2', { ip: '203.0.113.2' });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe('OSPITI_LIMITE');
    expect(body.error).toBe('Per oggi i giri di prova sono finiti. Con il tuo account parti adesso, oppure riprova domani.');
    expect((await giro('tok-anna')).status).toBe(200);
  });

  it('secret non validi: si usano i valori di base', async () => {
    env.AI_OSPITI_DAILY_CAP = 'molti';
    env.AI_OSPITE_IP_DAILY_CAP = '-3';
    await giro('tok-o1');
    expect(rpcParams[0].params).toMatchObject({ p_ip_cap: 10, p_ospiti_cap: 100 });
  });

  it('il tetto globale dell\'app ferma anche gli ospiti (GLOBAL_QUOTA_EXCEEDED)', async () => {
    env.AI_GLOBAL_DAILY_CAP = '0';
    const res = await giro('tok-o1');
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('GLOBAL_QUOTA_EXCEEDED');
  });
});

describe('contorno, guasti, sicurezza', () => {
  it("il contorno di un ospite si conta come utente, col limite dell'ospite (30 al giorno)", async () => {
    const res = await call({ token: 'tok-o1', dv: { purpose: 'aux' } });
    expect(res.status).toBe(200);
    expect(rpcLog).toEqual(['ai_quota_consume']);
    expect(rpcParams[0].params).toMatchObject({ p_subject_kind: 'user', p_subject: OSPITE_1, p_purpose: 'aux', p_limit: 30 });
  });

  it('il motore si ferma: la generazione dell\'ospite si rimborsa e il giro resta da fare', async () => {
    openaiStatus = 500;
    const res = await giro('tok-o1');
    expect(res.status).toBe(502);
    expect((await res.json()).refunded).toBe(true);
    expect(rpcLog).toEqual(['ai_quota_ospite', 'ai_quota_ospite_rimborso']);
    expect(stato.account.get(OSPITE_1).giri).toBe(0);
    openaiStatus = 200;
    expect((await giro('tok-o1')).status).toBe(200);
  });

  it('senza il sale dell\'IP il controllo fallisce chiuso (503) e OpenAI non viene chiamato', async () => {
    delete env.AI_QUOTA_IP_SALT;
    const res = await giro('tok-o1');
    expect(res.status).toBe(503);
    expect(openaiCalls()).toBe(0);
  });

  it('un token non valido resta 401', async () => {
    expect((await giro('tok-finto')).status).toBe(401);
  });
});
