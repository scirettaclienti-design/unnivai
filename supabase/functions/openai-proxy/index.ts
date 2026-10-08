/**
 * DVAI-001 — OpenAI Proxy Edge Function
 * DVAI-044 — Streaming SSE supportato
 * Gate QUOTA-SERVER — la quota la applica QUESTA funzione, prima di chiamare OpenAI.
 *
 * Se il payload contiene `stream: true`, la risposta viene inoltrata
 * come Server-Sent Events al client, consentendo la visualizzazione
 * progressiva del testo senza aspettare 35 s.
 *
 * Quota (contata in public.ai_quota_consume, con la chiave di servizio):
 *   - generazione = un "biglietto" (`dv.ticket`, uuid scelto dal client). Il
 *     primo uso conta +1 (utente 10/giorno, ospite 5/giorno per IP, tetto
 *     globale AI_GLOBAL_DAILY_CAP, default 1000). Lo stesso biglietto vale al
 *     massimo, in 10 minuti: 'itinerary' 4 chiamate (traduttore d'intento +
 *     selettore + narratore + riscrittura delle descrizioni, P3d-c),
 *     'home_tours' 2 (tour + riscrittura). Il limite vive in ai_quota_consume.
 *   - chiamate di contorno (chat, monumenti, meteo, business, e qualunque
 *     richiesta senza `dv`): utente 40/giorno, ospite 15/giorno per IP.
 *   - max_tokens: tetto 4000 per ogni chiamata (biglietti 'itinerary' e
 *     'home_tours', richieste senza biglietto); 2000 se il client non lo indica.
 *   - giorno = mezzanotte Europe/Rome (calcolato nella funzione SQL).
 *   - se il controllo fallisce per qualunque motivo: 503, OpenAI NON viene chiamato.
 *
 * Identita': JWT valido → utente. Nessun Authorization (o la anon key) → ospite,
 * contato per hash SHA-256 di (AI_QUOTA_IP_SALT + IP). L'IP in chiaro non esce
 * da questa funzione. JWT presente ma non valido → 401.
 *
 * Guasti di OpenAI (Gate P8b): errore HTTP, risposta illeggibile, rete o
 * timeout → una riga di log (status, error.code, error.type, messaggio breve
 * ripulito: mai la chiave, mai il prompt, mai dati dell'utente), risposta al
 * client con forma stabile { error, code, source: 'openai' } dove code e'
 * OPENAI_CREDIT_EXHAUSTED | OPENAI_RATE_LIMITED | OPENAI_ERROR, e rimborso della
 * generazione (public.ai_quota_refund) se la chiamata aveva un biglietto.
 *
 * La OPENAI_API_KEY rimane esclusivamente sul server Supabase.
 * Deploy: supabase functions deploy openai-proxy --no-verify-jwt
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const OPENAI_BASE = 'https://api.openai.com/v1';

const ALLOWED_MODELS = new Set(['gpt-4o-mini']);
const MAX_TOKENS_DEFAULT = 2000;   // default se manca max_tokens
const MAX_TOKENS_CAP = 4000;       // tetto per ogni chiamata. 'itinerary': il selettore di un
                                   // tour "2-3 Giorni" (15 tappe) risponde con ~2100 token
                                   // (misurato il 06/10: 2054/2098/2115), oltre il vecchio
                                   // tetto 2000. 'home_tours': fino a 5 tour in 1 chiamata.
                                   // Senza biglietto: il client in produzione fino al 12/09
                                   // (db44413) manda la Home a 4000 token (contata come contorno).

const LIMITS = {
  user:  { generation: 10, aux: 40 },
  guest: { generation: 5,  aux: 15 },
} as const;
const GLOBAL_CAP_DEFAULT = 1000;

const TICKET_KINDS = new Set(['itinerary', 'home_tours']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Testi decisi da Ivano: non modificarli senza di lui.
const MSG_USER_LIMIT   = 'Per oggi hai usato tutti i tuoi percorsi. Domani se ne aprono altri.';
const MSG_GLOBAL_LIMIT = 'Oggi Unnivai ha raggiunto il limite di percorsi. Domani se ne aprono altri.';
// Gate P8b — guasto di OpenAI (credito, troppe richieste, errore, nessuna risposta).
const MSG_ENGINE_DOWN  = 'Il motore si è fermato un attimo. Riprova tra qualche minuto.';

// Oltre questo tempo OpenAI "non risponde": la generazione si rimborsa.
const UPSTREAM_TIMEOUT_MS = 60_000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'x-quota-remaining',
};

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extra },
  });

/** Letto a ogni richiesta: il valore segue il secret, non il codice deployato. */
function globalCap(): number {
  const raw = Deno.env.get('AI_GLOBAL_DAILY_CAP');
  if (raw === undefined || raw === '') return GLOBAL_CAP_DEFAULT;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 0) return n;
  console.warn(`[openai-proxy] AI_GLOBAL_DAILY_CAP non valido (${raw}), uso ${GLOBAL_CAP_DEFAULT}`);
  return GLOBAL_CAP_DEFAULT;
}

/**
 * IP del client. cf-connecting-ip e x-real-ip sono scritti dall'infrastruttura;
 * x-forwarded-for solo come ultima risorsa (il primo valore puo' arrivare dal client).
 * ⚠ Da verificare dopo il deploy: vedi report Gate QUOTA-SERVER.
 */
function clientIp(req: Request): string | null {
  const direct = req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip');
  if (direct?.trim()) return direct.trim();
  const xff = req.headers.get('x-forwarded-for');
  const first = xff?.split(',')[0]?.trim();
  return first || null;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

class HttpError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.error));
    this.status = status;
    this.body = body;
  }
}

type Subject = { kind: 'user' | 'guest'; id: string };

// deno-lint-ignore no-explicit-any
async function resolveSubject(req: Request, sb: any): Promise<Subject> {
  const auth = req.headers.get('authorization');
  const token = auth?.replace(/^Bearer\s+/i, '').trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (token && token !== anonKey) {
    const { data, error } = await sb.auth.getUser(token);
    if (data?.user?.id && !error) return { kind: 'user', id: data.user.id };
    const status = Number(error?.status);
    if (status >= 400 && status < 500) {
      throw new HttpError(401, { error: 'Sessione non valida', code: 'INVALID_TOKEN' });
    }
    throw new Error(`verifica JWT fallita: ${error?.message ?? 'sconosciuto'}`);
  }

  const salt = Deno.env.get('AI_QUOTA_IP_SALT');
  if (!salt) throw new Error('AI_QUOTA_IP_SALT non configurato');
  const ip = clientIp(req);
  if (!ip) throw new Error('IP del client non determinabile');
  return { kind: 'guest', id: await sha256Hex(`${salt}:${ip}`) };
}

type Meta = { purpose: 'generation'; ticket: string; kind: string } | { purpose: 'aux' };

// ─── Gate P8b — guasti di OpenAI ─────────────────────────────────────────────

type EngineCode = 'OPENAI_CREDIT_EXHAUSTED' | 'OPENAI_RATE_LIMITED' | 'OPENAI_ERROR';

/** Il tipo di guasto, dallo status e dal corpo d'errore di OpenAI. */
export function classifyOpenAiError(status: number, code: unknown, type: unknown): EngineCode {
  if (code === 'insufficient_quota' || type === 'insufficient_quota' || code === 'billing_hard_limit_reached') {
    return 'OPENAI_CREDIT_EXHAUSTED';
  }
  if (status === 429) return 'OPENAI_RATE_LIMITED';
  return 'OPENAI_ERROR';
}

/** Messaggio breve per il log: niente chiavi, token, email, a capo; max 160 caratteri. */
export function scrubLogText(text: unknown): string {
  return String(text ?? '')
    .replace(/sk-[A-Za-z0-9_\-]{4,}/g, 'sk-***')
    .replace(/Bearer\s+\S+/gi, 'Bearer ***')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '***@***')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

const plain = (v: unknown) => (typeof v === 'string' && v ? scrubLogText(v).slice(0, 60) : '-');

function parseMeta(dv: unknown): Meta {
  if (!dv || typeof dv !== 'object') return { purpose: 'aux' };
  const m = dv as Record<string, unknown>;
  if (m.purpose !== 'generation') return { purpose: 'aux' };
  if (typeof m.ticket !== 'string' || !UUID_RE.test(m.ticket) || !TICKET_KINDS.has(m.kind as string)) {
    throw new HttpError(400, { error: 'Biglietto di generazione non valido', code: 'BAD_TICKET' });
  }
  return { purpose: 'generation', ticket: m.ticket, kind: m.kind as string };
}

serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    return json(500, { error: 'OpenAI API key not configured on server.' });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  // Whitelist dei path OpenAI consentiti
  const allowedEndpoints = ['/chat/completions'];
  const endpoint = (body.endpoint as string) ?? '/chat/completions';
  if (!allowedEndpoints.includes(endpoint)) {
    return json(403, { error: 'Endpoint not allowed' });
  }

  // Estrai il payload da inviare ad OpenAI (tutto tranne `endpoint` e `dv`)
  const { endpoint: _removed, dv, ...openAiPayload } = body;
  const isStreaming = openAiPayload.stream === true;

  if (!ALLOWED_MODELS.has(openAiPayload.model as string)) {
    return json(400, { error: 'Model not allowed', code: 'MODEL_NOT_ALLOWED' });
  }
  // Una risposta sola per chiamata, e niente parametri che aggirano max_tokens.
  delete openAiPayload.n;
  delete openAiPayload.max_completion_tokens;

  // ─── Quota: prima di OpenAI, fail-closed ───────────────────────────────────
  let quota: Record<string, unknown>;
  let meta: Meta;
  // deno-lint-ignore no-explicit-any
  let sb: any = null;
  let subject: Subject | null = null;
  try {
    meta = parseMeta(dv);
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL / SERVICE_ROLE_KEY mancanti');
    sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    subject = await resolveSubject(req, sb);
    const { data, error } = await sb.rpc('ai_quota_consume', {
      p_subject_kind: subject.kind,
      p_subject: subject.id,
      p_purpose: meta.purpose,
      p_ticket: meta.purpose === 'generation' ? meta.ticket : null,
      p_ticket_kind: meta.purpose === 'generation' ? meta.kind : null,
      p_limit: LIMITS[subject.kind][meta.purpose],
      p_global_cap: globalCap(),
    });
    if (error) throw new Error(`ai_quota_consume: ${error.message ?? error}`);
    if (!data || typeof data.allowed !== 'boolean') throw new Error('ai_quota_consume: risposta non valida');
    quota = data;
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, err.body);
    console.error('[openai-proxy] controllo quota fallito, OpenAI non chiamato:', String(err));
    return json(503, { error: 'Controllo quota non disponibile, riprova tra poco.', code: 'QUOTA_CHECK_FAILED' });
  }

  if (!quota.allowed) {
    if (quota.reason === 'global') {
      return json(429, { error: MSG_GLOBAL_LIMIT, code: 'GLOBAL_QUOTA_EXCEEDED' });
    }
    if (quota.reason === 'ticket') {
      return json(403, { error: 'Biglietto di generazione esaurito o non tuo', code: 'TICKET_INVALID' });
    }
    return json(429, { error: MSG_USER_LIMIT, code: 'QUOTA_EXCEEDED', remaining: 0 });
  }

  const asked = Number(openAiPayload.max_tokens);
  openAiPayload.max_tokens = Number.isFinite(asked) && asked > 0
    ? Math.min(asked, MAX_TOKENS_CAP)
    : MAX_TOKENS_DEFAULT;

  const quotaHeaders: Record<string, string> = typeof quota.remaining === 'number'
    ? { 'x-quota-remaining': String(quota.remaining) }
    : {};

  // Gate P8b — un guasto di OpenAI: log, rimborso della generazione, risposta stabile.
  const engineDown = async (
    code: EngineCode,
    log: { status: number | string; code?: unknown; type?: unknown; message?: unknown },
  ) => {
    console.error(
      `[openai-proxy] OpenAI errore status=${log.status} code=${plain(log.code)} ` +
      `type=${plain(log.type)} esito=${code} msg="${scrubLogText(log.message)}"`,
    );
    let refunded = false;
    if (meta.purpose === 'generation' && sb && subject) {
      try {
        const { data, error } = await sb.rpc('ai_quota_refund', {
          p_subject_kind: subject.kind,
          p_subject: subject.id,
          p_ticket: meta.ticket,
        });
        if (error) throw new Error(error.message ?? String(error));
        refunded = data?.refunded === true;
      } catch (err) {
        console.error('[openai-proxy] rimborso generazione fallito:', scrubLogText(err));
      }
      console.info(`[openai-proxy] rimborso generazione: ${refunded ? 'fatto' : 'niente da rimborsare'}`);
    }
    return json(502, { error: MSG_ENGINE_DOWN, code, source: 'openai', refunded });
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${OPENAI_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(openAiPayload),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      const errData = await upstream.json().catch(() => ({}));
      clearTimeout(timer);
      const e = (errData && typeof errData === 'object' ? (errData as Record<string, unknown>).error : null) ?? {};
      const err = (typeof e === 'object' && e) ? e as Record<string, unknown> : { message: e };
      return await engineDown(classifyOpenAiError(upstream.status, err.code, err.type), {
        status: upstream.status, code: err.code, type: err.type, message: err.message,
      });
    }

    // DVAI-044: Se stream=true, inoltriamo il body SSE direttamente al client
    if (isStreaming && upstream.body) {
      clearTimeout(timer); // lo stream dura quanto deve: il tetto vale solo per la prima risposta
      return new Response(upstream.body, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          ...quotaHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // Risposta JSON standard (non-streaming)
    let data: unknown;
    try {
      data = await upstream.json();
    } catch (err) {
      return await engineDown('OPENAI_ERROR', { status: upstream.status, type: 'invalid_json', message: String(err) });
    } finally {
      clearTimeout(timer);
    }
    return json(upstream.status, data, quotaHeaders);

  } catch (err) {
    clearTimeout(timer);
    const timeout = (err as Error)?.name === 'AbortError';
    return await engineDown('OPENAI_ERROR', {
      status: timeout ? 'timeout' : 'network',
      type: timeout ? 'timeout' : 'network',
      message: timeout ? `nessuna risposta in ${UPSTREAM_TIMEOUT_MS / 1000}s` : String(err),
    });
  }
});
