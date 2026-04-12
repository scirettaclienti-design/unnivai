/**
 * DVAI-001 — OpenAI Proxy Edge Function
 * DVAI-044 — Streaming SSE supportato
 *
 * Se il payload contiene `stream: true`, la risposta viene inoltrata
 * come Server-Sent Events al client, consentendo la visualizzazione
 * progressiva del testo senza aspettare 35 s.
 *
 * La OPENAI_API_KEY rimane esclusivamente sul server Supabase.
 * Deploy: supabase functions deploy openai-proxy --no-verify-jwt
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_BASE    = 'https://api.openai.com/v1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured on server.' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Whitelist dei path OpenAI consentiti
  const allowedEndpoints = ['/chat/completions'];
  const endpoint = (body.endpoint as string) ?? '/chat/completions';
  if (!allowedEndpoints.includes(endpoint)) {
    return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
      status: 403,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Estrai il payload da inviare ad OpenAI (tutto tranne `endpoint`)
  const { endpoint: _removed, ...openAiPayload } = body;
  const isStreaming = openAiPayload.stream === true;

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
      return new Response(JSON.stringify({ error: errData }), {
        status: upstream.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // DVAI-044: Se stream=true, inoltriamo il body SSE direttamente al client
    if (isStreaming && upstream.body) {
      return new Response(upstream.body, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // Risposta JSON standard (non-streaming)
    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Upstream OpenAI request failed', detail: String(err) }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
