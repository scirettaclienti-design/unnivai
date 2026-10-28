// @vitest-environment node
//
// FORNITORE-AI — il testo del proxy esce da Claude quando AI_PROVIDER=anthropic; formato dei dati invariato per il client.
// Parte 1: il modulo puro (anthropic.ts). Parte 2: l'handler vero (index.ts) con fetch finto per OpenAI e Anthropic.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  corpoAnthropic, rispostaComeOpenAi, estraiJson, classificaErroreAnthropic, fornitoreScelto, modelliAnthropicPer,
  chiamaAnthropic, chiamaAnthropicElenco, dimenticaInesistenti, compitoDi,
} from '../../../supabase/functions/openai-proxy/anthropic.ts';
import { chiamaConRipiego } from '../../../supabase/functions/openai-proxy/modelli.ts';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const HAIKU_5 = 'claude-haiku-5-5';
const HAIKU_4 = 'claude-haiku-4-5';
const SONNET = 'claude-sonnet-5-5';
const MSG_ENGINE = 'Il motore si è fermato un attimo. Riprova tra qualche minuto.';

describe('anthropic.ts — formato della chiamata e della risposta', () => {
  it('system → system, user/assistant → messages, JSON mode → riga in coda, tetto di token invariato', () => {
    const c = corpoAnthropic('claude-haiku-4-5', {
      model: 'gpt-4o-mini', temperature: 0.2, max_tokens: 1500, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: 'Sei un traduttore.' }, { role: 'user', content: 'Roma, sera' }],
    });
    expect(c.model).toBe('claude-haiku-4-5');
    expect(c.max_tokens).toBe(1500);
    expect(c.temperature).toBe(0.2);
    expect(c.system).toContain('Sei un traduttore.');
    expect(c.system).toContain('oggetto JSON valido');
    expect(c.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'Roma, sera' }] }]);
    expect(c.response_format).toBeUndefined();
  });

  it('Sonnet 5.5: niente temperature (400 sul server) e ragionamento spento', () => {
    const c = corpoAnthropic('claude-sonnet-5-5', { temperature: 0.7, max_tokens: 800, messages: [{ role: 'user', content: 'ciao' }] });
    expect(c.temperature).toBeUndefined();
    expect(c.thinking).toEqual({ type: 'between_tools' });
  });

  it('Haiku 5.5 rifiuta temperature (400 visto dal vivo): non si manda; Haiku 4.5 la riceve', () => {
    const p = { temperature: 0.2, max_tokens: 100, messages: [{ role: 'user', content: 'x' }] };
    expect(corpoAnthropic('claude-haiku-5-5', p).temperature).toBeUndefined();
    expect(corpoAnthropic('claude-haiku-4-5', p).temperature).toBe(0.2);
  });

  it('un\'immagine data: diventa base64, un URL resta URL (analisi dei locali)', () => {
    const c = corpoAnthropic('claude-haiku-4-5', {
      max_tokens: 100,
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'che locale è?' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
        { type: 'image_url', image_url: { url: 'https://x.test/a.jpg' } },
      ] }],
    });
    expect(c.messages[0].content).toEqual([
      { type: 'text', text: 'che locale è?' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
      { type: 'image', source: { type: 'url', url: 'https://x.test/a.jpg' } },
    ]);
  });

  it('la risposta torna nella forma di OpenAI, con i token nei campi che il banco legge', () => {
    const r = rispostaComeOpenAi({ id: 'm1', model: 'claude-haiku-4-5', stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"a":1}' }], usage: { input_tokens: 120, output_tokens: 30 } }, true);
    expect(r.choices[0].message.content).toBe('{"a":1}');
    expect(r.usage).toMatchObject({ prompt_tokens: 120, completion_tokens: 30 });
  });

  it('un rifiuto o un testo vuoto restano vuoti (il chiamante ripiega); max_tokens = length', () => {
    expect(rispostaComeOpenAi({ stop_reason: 'refusal', content: [{ type: 'text', text: 'no' }] }, false).choices[0].message.content).toBe('');
    expect(rispostaComeOpenAi({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"a"' }] }, false).choices[0].finish_reason).toBe('length');
  });

  it('estraiJson: toglie i blocchi di codice e il testo attorno; lascia stare il resto', () => {
    expect(estraiJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(estraiJson('Ecco: {"a":{"b":"}"}} fine')).toBe('{"a":{"b":"}"}}');
    expect(estraiJson('nessun json')).toBe('nessun json');
  });

  it('classifica i guasti con i codici che il client già conosce', () => {
    expect(classificaErroreAnthropic(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API.')).toBe('OPENAI_CREDIT_EXHAUSTED');
    expect(classificaErroreAnthropic(429, 'rate_limit_error', '')).toBe('OPENAI_RATE_LIMITED');
    expect(classificaErroreAnthropic(529, 'overloaded_error', '')).toBe('OPENAI_RATE_LIMITED');
    expect(classificaErroreAnthropic(500, 'api_error', 'boom')).toBe('OPENAI_ERROR');
  });

  it('il fornitore lo sceglie il secret: assente o strano = OpenAI', () => {
    expect(fornitoreScelto(() => undefined)).toBe('openai');
    expect(fornitoreScelto(() => 'boh')).toBe('openai');
    expect(fornitoreScelto((k) => (k === 'AI_PROVIDER' ? ' Anthropic ' : undefined))).toBe('anthropic');
  });

  it('un modello per compito: Haiku (5.5 poi 4.5) per traduttore, selettore, notifiche; Sonnet per narratore, liste, contorno; mai Opus', () => {
    const nessuno = () => undefined;
    for (const c of ['traduttore', 'selettore', 'notifiche']) expect(modelliAnthropicPer(c, nessuno)).toEqual([HAIKU_5, HAIKU_4]);
    for (const c of ['narratore', 'lista', 'quartiere']) expect(modelliAnthropicPer(c, nessuno)).toEqual([SONNET]);
    expect(modelliAnthropicPer(undefined, nessuno)).toEqual([SONNET]);   // contorno
    expect(modelliAnthropicPer('boh', nessuno)).toEqual([SONNET]);
    expect(compitoDi('boh')).toBe('contorno');
    for (const c of ['traduttore', 'selettore', 'notifiche', 'narratore', 'lista', 'quartiere', 'contorno']) {
      expect(modelliAnthropicPer(c, nessuno).join()).not.toMatch(/opus/i);
    }
  });

  it('ogni compito si cambia con il suo secret (anche un elenco), senza toccare gli altri', () => {
    const env = (k) => ({ ANTHROPIC_MODEL_NARRATORE: ' claude-haiku-4-5 ', ANTHROPIC_MODEL_LISTA: 'claude-x, claude-y' })[k];
    expect(modelliAnthropicPer('narratore', env)).toEqual([HAIKU_4]);
    expect(modelliAnthropicPer('lista', env)).toEqual(['claude-x', 'claude-y']);
    expect(modelliAnthropicPer('quartiere', env)).toEqual([SONNET]);
    expect(modelliAnthropicPer('selettore', env)).toEqual([HAIKU_5, HAIKU_4]);
  });

  it('elenco: un 404 passa al modello dopo e quello inesistente non si richiede piu\'; ogni altro errore si propaga', async () => {
    dimenticaInesistenti();
    const visti = [];
    const invia = vi.fn(async (_u, init) => {
      const m = JSON.parse(init.body).model; visti.push(m);
      if (m === HAIKU_5) return new Response(JSON.stringify({ error: { type: 'not_found_error', message: 'model: claude-haiku-5-5' } }), { status: 404 });
      return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 });
    });
    const p = { max_tokens: 5, messages: [{ role: 'user', content: 'x' }] };
    const r1 = await chiamaAnthropicElenco('k', [HAIKU_5, HAIKU_4], p, 1000, invia);
    expect(r1.model).toBe(HAIKU_4);
    await chiamaAnthropicElenco('k', [HAIKU_5, HAIKU_4], p, 1000, invia);
    expect(visti).toEqual([HAIKU_5, HAIKU_4, HAIKU_4]);
    const giu = vi.fn(async () => new Response(JSON.stringify({ error: { type: 'api_error', message: 'boom' } }), { status: 500 }));
    await expect(chiamaAnthropicElenco('k', [HAIKU_4], p, 1000, giu)).rejects.toMatchObject({ status: 500 });
    dimenticaInesistenti();
  });

  it('chiamaAnthropic: chiave e versione nelle intestazioni; un HTTP non ok lancia con il codice', async () => {
    const invia = vi.fn(async () => new Response(JSON.stringify({ error: { type: 'invalid_request_error', message: 'credit balance is too low' } }), { status: 400 }));
    await expect(chiamaAnthropic('k-test', 'claude-haiku-4-5', { max_tokens: 5, messages: [{ role: 'user', content: 'x' }] }, 1000, invia))
      .rejects.toMatchObject({ name: 'ErroreAnthropic', codice: 'OPENAI_CREDIT_EXHAUSTED' });
    const [url, init] = invia.mock.calls[0];
    expect(url).toBe(ANTHROPIC_URL);
    expect(init.headers['x-api-key']).toBe('k-test');
    expect(init.headers['anthropic-version']).toBeTruthy();
  });
});

describe('chiamaConRipiego con Claude come primo tentativo (liste della città)', () => {
  const payload = { model: 'gpt-4o-mini', max_tokens: 100, messages: [{ role: 'user', content: 'x' }] };
  const ok = { choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } };

  it('Claude risponde: si usa lui, OpenAI non viene chiamato', async () => {
    const openai = vi.fn(async () => ok);
    const claude = vi.fn(async () => ok);
    const r = await chiamaConRipiego('lista', payload, openai, 1000, { fornitore: 'anthropic', modello: 'claude-haiku-4-5', timeoutMs: 1000, invia: claude });
    expect(openai).not.toHaveBeenCalled();
    expect(r.info).toMatchObject({ fornitore: 'anthropic', usato: 'claude-haiku-4-5', ripiego: false });
  });

  it('Claude sbaglia due volte: si torna a OpenAI (modello di prima) e il tracciato lo dice', async () => {
    const openai = vi.fn(async () => ok);
    const claude = vi.fn(async () => { throw new Error('HTTP 500'); });
    const r = await chiamaConRipiego('lista', payload, openai, 1000, { fornitore: 'anthropic', modello: 'claude-haiku-4-5', timeoutMs: 1000, invia: claude });
    expect(claude).toHaveBeenCalledTimes(2);
    expect(openai).toHaveBeenCalledTimes(1);
    expect(r.info).toMatchObject({ fornitore: 'openai', fornitoreChiesto: 'anthropic', usato: 'gpt-4o-mini', ripiego: true });
  });

  it('credito Claude finito: nessun secondo tentativo, subito OpenAI', async () => {
    const openai = vi.fn(async () => ok);
    const claude = vi.fn(async () => { throw Object.assign(new Error('credito'), { codice: 'OPENAI_CREDIT_EXHAUSTED' }); });
    await chiamaConRipiego('lista', payload, openai, 1000, { fornitore: 'anthropic', modello: 'claude-haiku-4-5', timeoutMs: 1000, invia: claude });
    expect(claude).toHaveBeenCalledTimes(1);
    expect(openai).toHaveBeenCalledTimes(1);
  });
});

// ─── L'handler vero ──────────────────────────────────────────────────────────
describe('openai-proxy con AI_PROVIDER', () => {
  let env; let handler; let chiamate; let rispAnthropic; let rispOpenAi;

  const anthropicOk = (testo) => () => new Response(JSON.stringify({ id: 'm', model: 'x', stop_reason: 'end_turn', content: [{ type: 'text', text: testo }],
    usage: { input_tokens: 11, output_tokens: 7 } }), { status: 200 });
  const errore = (status, error) => () => new Response(JSON.stringify({ error }), { status });
  const openaiOk = (testo) => () => new Response(JSON.stringify({ choices: [{ message: { content: testo } }], usage: { prompt_tokens: 3, completion_tokens: 2 } }), { status: 200 });

  beforeEach(async () => {
    vi.resetAllMocks();
    env = { OPENAI_API_KEY: 'sk-test', ANTHROPIC_API_KEY: 'sk-ant-test', AI_PROVIDER: 'anthropic', SUPABASE_URL: 'http://supabase.test',
      SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_ANON_KEY: 'anon', AI_QUOTA_IP_SALT: 'sale' };
    vi.stubGlobal('Deno', { env: { get: (k) => env[k] } });
    globalThis.__edgeSupabaseFactory = () => ({
      auth: { getUser: async () => ({ data: { user: null }, error: { status: 401, message: 'x' } }) },
      rpc: async (name) => ({ data: name === 'ai_quota_consume' ? { allowed: true, reason: 'ok', remaining: 5 } : { refunded: true }, error: null }),
    });
    chiamate = [];
    rispAnthropic = anthropicOk('{"da":"claude"}');
    rispOpenAi = openaiOk('{"da":"openai"}');
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      const body = JSON.parse(init.body);
      if (String(url) === ANTHROPIC_URL) { chiamate.push({ fornitore: 'anthropic', body, headers: init.headers }); return rispAnthropic(); }
      if (String(url) === OPENAI_URL) { chiamate.push({ fornitore: 'openai', body }); return rispOpenAi(); }
      throw new Error(`fetch inatteso: ${url}`);
    }));
    vi.resetModules();
    globalThis.__edgeHandler = undefined;
    await import('../../../supabase/functions/openai-proxy/index.ts');
    handler = globalThis.__edgeHandler;
  });
  afterEach(() => { vi.unstubAllGlobals(); delete globalThis.__edgeSupabaseFactory; });

  const call = (passaggio, extra = {}) => handler(new Request('http://edge.test/functions/v1/openai-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    body: JSON.stringify({ endpoint: '/chat/completions', model: 'gpt-4o-mini', max_tokens: 1000, temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: 'Sistema' }, { role: 'user', content: 'Utente' }],
      ...(passaggio ? { dv: { purpose: 'aux', passaggio } } : {}), ...extra }),
  }));

  it('traduttore e selettore: Haiku; notifiche: Haiku; narratore e contorno: Sonnet; risposta nel formato di OpenAI', async () => {
    for (const p of ['traduttore', 'selettore']) {
      const res = await call(p);
      const j = await res.json();
      expect(res.status).toBe(200);
      expect(JSON.parse(j.choices[0].message.content)).toEqual({ da: 'claude' });
      expect(j.usage).toMatchObject({ prompt_tokens: 11, completion_tokens: 7 });
      expect(j._modello).toMatchObject({ passaggio: p, fornitore: 'anthropic', usato: HAIKU_5, ripiego: false });
    }
    await call('notifiche');
    await call('narratore');
    await call(null);
    expect(chiamate.map((c) => [c.fornitore, c.body.model])).toEqual([
      ['anthropic', HAIKU_5], ['anthropic', HAIKU_5], ['anthropic', HAIKU_5], ['anthropic', SONNET], ['anthropic', SONNET],
    ]);
    expect(chiamate[0].headers['x-api-key']).toBe('sk-ant-test');
    expect(chiamate.some((c) => c.fornitore === 'openai')).toBe(false);
  });

  it('claude-haiku-5-5 non risponde (404): si usa il 4.5, senza ripiego su OpenAI, e il 5.5 non si richiede piu\'', async () => {
    const era = rispAnthropic;
    rispAnthropic = null;
    fetch.mockImplementation(async (url, init) => {
      const body = JSON.parse(init.body);
      if (String(url) !== ANTHROPIC_URL) throw new Error('fetch inatteso');
      chiamate.push({ fornitore: 'anthropic', body });
      return body.model === HAIKU_5
        ? new Response(JSON.stringify({ error: { type: 'not_found_error', message: 'model' } }), { status: 404 })
        : era();
    });
    const a = await call('selettore'); const b = await call('traduttore');
    expect((await a.json())._modello).toMatchObject({ fornitore: 'anthropic', usato: HAIKU_4, chiesto: HAIKU_5, ripiego: false });
    expect((await b.json())._modello.usato).toBe(HAIKU_4);
    expect(chiamate.map((c) => c.body.model)).toEqual([HAIKU_5, HAIKU_4, HAIKU_4]);
  });

  it('un secret cambia il modello di un compito senza deploy (la lista su Haiku, per esempio)', async () => {
    env.ANTHROPIC_MODEL_NARRATORE = HAIKU_4;
    await call('narratore');
    expect(chiamate.at(-1).body.model).toBe(HAIKU_4);
  });

  it('senza AI_PROVIDER (o con openai) il comportamento è quello di prima: nessuna chiamata a Anthropic', async () => {
    delete env.AI_PROVIDER;
    const res = await call(null);
    expect(res.status).toBe(200);
    expect(chiamate.map((c) => c.fornitore)).toEqual(['openai']);
    env.AI_PROVIDER = 'openai';
    await call('narratore');
    expect(chiamate.every((c) => c.fornitore === 'openai')).toBe(true);
  });

  it('AI_PROVIDER=anthropic ma chiave assente: si resta su OpenAI, non un errore', async () => {
    delete env.ANTHROPIC_API_KEY;
    const res = await call('narratore');
    expect(res.status).toBe(200);
    expect(chiamate.map((c) => c.fornitore)).toEqual(['openai']);
  });

  it('Claude giù (500): due tentativi, poi OpenAI al modello chiesto; il client riceve 200 e la risposta dice il ripiego', async () => {
    rispAnthropic = errore(500, { type: 'api_error', message: 'boom' });
    const res = await call('narratore');
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(chiamate.map((c) => c.fornitore)).toEqual(['anthropic', 'anthropic', 'openai']);
    expect(chiamate[2].body.model).toBe('gpt-4o-mini');
    expect(JSON.parse(j.choices[0].message.content)).toEqual({ da: 'openai' });
    expect(j._modello).toMatchObject({ fornitore: 'openai', fornitoreChiesto: 'anthropic', ripiego: true });
  });

  it('credito Anthropic finito: un solo tentativo, poi OpenAI', async () => {
    rispAnthropic = errore(400, { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' });
    const res = await call('selettore');
    expect(res.status).toBe(200);
    expect(chiamate.map((c) => c.fornitore)).toEqual(['anthropic', 'openai']);
  });

  it('risposta vuota di Claude (rifiuto): si ripiega su OpenAI', async () => {
    rispAnthropic = () => new Response(JSON.stringify({ stop_reason: 'refusal', content: [], usage: { input_tokens: 1, output_tokens: 0 } }), { status: 200 });
    const res = await call('narratore');
    expect(res.status).toBe(200);
    expect(chiamate.at(-1).fornitore).toBe('openai');
  });

  it('tutti e due i fornitori senza credito: 502 col messaggio onesto e il codice credito (mai una schermata vuota), e la generazione si rimborsa', async () => {
    rispAnthropic = errore(400, { type: 'invalid_request_error', message: 'Your credit balance is too low' });
    rispOpenAi = errore(429, { code: 'insufficient_quota', type: 'insufficient_quota', message: 'You exceeded your current quota' });
    const res = await call('narratore', { dv: { purpose: 'generation', ticket: '00000000-0000-4000-8000-000000000001', kind: 'itinerary', passaggio: 'narratore' } });
    const j = await res.json();
    expect(res.status).toBe(502);
    expect(j).toMatchObject({ error: MSG_ENGINE, code: 'OPENAI_CREDIT_EXHAUSTED', source: 'openai' });
    expect(JSON.stringify(j)).not.toMatch(/sk-|credit balance/i);
  });

  it('la chiave di Anthropic non finisce mai nei log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    rispAnthropic = errore(401, { type: 'authentication_error', message: 'invalid x-api-key sk-ant-test-SEGRETO' });
    await call('narratore');
    const scritto = JSON.stringify([...warn.mock.calls, ...err.mock.calls]);
    expect(scritto).not.toContain('SEGRETO');
    expect(scritto).not.toContain('sk-ant-test');
  });

  it('lo streaming resta su OpenAI (nessun client lo usa per i giri)', async () => {
    rispOpenAi = () => new Response('data: {}\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    const res = await call(null, { stream: true });
    expect(res.status).toBe(200);
    expect(chiamate.map((c) => c.fornitore)).toEqual(['openai']);
  });
});
