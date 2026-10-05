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
 *     massimo 2 chiamate in 10 minuti (traduttore d'intento + selettore).
 *   - chiamate di contorno (chat, monumenti, meteo, business, e qualunque
 *     richiesta senza `dv`): utente 40/giorno, ospite 15/giorno per IP.
 *   - max_tokens: 2000 per i biglietti 'itinerary'; 4000 per 'home_tours' e per
 *     le richieste senza biglietto (compatibilita' col client vecchio).
 *   - giorno = mezzanotte Europe/Rome (calcolato nella funzione SQL).
 *   - se il controllo fallisce per qualunque motivo: 503, OpenAI NON viene chiamato.
 *
 * Identita': JWT valido → utente. Nessun Authorization (o la anon key) → ospite,
 * contato per hash SHA-256 di (AI_QUOTA_IP_SALT + IP). L'IP in chiaro non esce
 * da questa funzione. JWT presente ma non valido → 401.
 *
 * La OPENAI_API_KEY rimane esclusivamente sul server Supabase.
 * Deploy: supabase functions deploy openai-proxy --no-verify-jwt
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const OPENAI_BASE = 'https://api.openai.com/v1';

const ALLOWED_MODELS = new Set(['gpt-4o-mini']);
const MAX_TOKENS_DEFAULT = 2000;   // tetto dei biglietti 'itinerary' e default se manca max_tokens
const MAX_TOKENS_LARGE = 4000;     // biglietti 'home_tours' (fino a 5 tour narrati in 1 chiamata)
                                   // e chiamate SENZA biglietto: il client in produzione
                                   // fino al 12/09 (db44413) manda la Home senza biglietto
                                   // a 4000 token. Gia' contate come contorno (40/15 al giorno).

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
  try {
    meta = parseMeta(dv);
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL / SERVICE_ROLE_KEY mancanti');
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const subject = await resolveSubject(req, sb);
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

  const tokenCap = meta.purpose === 'generation' && quota.ticket_kind !== 'home_tours'
    ? MAX_TOKENS_DEFAULT
    : MAX_TOKENS_LARGE;
  const asked = Number(openAiPayload.max_tokens);
  openAiPayload.max_tokens = Number.isFinite(asked) && asked > 0
    ? Math.min(asked, tokenCap)
    : Math.min(MAX_TOKENS_DEFAULT, tokenCap);

  const quotaHeaders: Record<string, string> = typeof quota.remaining === 'number'
    ? { 'x-quota-remaining': String(quota.remaining) }
    : {};

  try {
    const upstream = await fetch(`${OPENAI_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(openAiPayload),
    });

    if (!upstream.ok) {
      const errData = await upstream.json().catch(() => ({}));
      return json(upstream.status, { error: errData }, quotaHeaders);
    }

    // DVAI-044: Se stream=true, inoltriamo il body SSE direttamente al client
    if (isStreaming && upstream.body) {
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
    const data = await upstream.json();
    return json(upstream.status, data, quotaHeaders);

  } catch (err) {
    return json(502, { error: 'Upstream OpenAI request failed', detail: String(err) });
  }
});
