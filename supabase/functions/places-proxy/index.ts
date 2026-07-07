/**
 * DVAI-049 — Google Places Proxy Edge Function
 *
 * Le chiamate dirette al browser per /maps/api/place/findplacefromtext e
 * /maps/api/place/photo falliscono in CORS (Google non emette i header per
 * gli endpoint legacy Places). Questo proxy fa da relay server-side e
 * tiene la GOOGLE_MAPS_API_KEY su Supabase.
 *
 * Endpoint accettati (querystring `?path=`):
 *   - `findplacefromtext`  → JSON con candidates + photo_reference
 *   - `place/photo`        → 302 redirect verso CDN Google (img src compatibile)
 *
 * Deploy locale (NON in prod finché non c'è massimale free deciso):
 *   supabase functions serve places-proxy --env-file .env.local
 *
 * Test:
 *   curl 'https://<project>.supabase.co/functions/v1/places-proxy?path=findplacefromtext&input=Pantheon&inputtype=textquery&fields=name,geometry,place_id,photos'
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
const GOOGLE_BASE = 'https://maps.googleapis.com/maps/api';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Whitelist dei path Places consentiti. Qualsiasi altro path → 403.
// DVAI-060 (Fase 1 passo 0): abilitati textsearch e nearbysearch per il motore
// Google-first. Ritornano liste di candidati reali (fino a 20) con rating,
// user_ratings_total, business_status, types, price_level in una singola call.
const ALLOWED_PATHS = new Set([
  'place/findplacefromtext',
  'place/photo',
  'place/details',
  'place/textsearch',
  'place/nearbysearch',
]);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return new Response(JSON.stringify({ error: 'GOOGLE_MAPS_API_KEY not configured on server' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get('path');
  if (!path || !ALLOWED_PATHS.has(path)) {
    return new Response(JSON.stringify({ error: 'Path not allowed', allowed: [...ALLOWED_PATHS] }), {
      status: 403,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Ricostruisci la querystring da inoltrare a Google,
  // tenendo solo i parametri della richiesta (eccetto `path`)
  const upstreamParams = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (key === 'path') continue;
    upstreamParams.set(key, value);
  }
  upstreamParams.set('key', GOOGLE_MAPS_API_KEY);

  // I path Places legacy hanno suffisso `/json` tranne `place/photo` che è binary/redirect.
  const isPhoto = path === 'place/photo';
  const upstreamUrl = `${GOOGLE_BASE}/${path}${isPhoto ? '' : '/json'}?${upstreamParams.toString()}`;

  try {
    if (isPhoto) {
      // /place/photo ritorna un 302 verso un CDN temporaneo. Inoltriamo il
      // redirect al client così l'<img> lo segue trasparentemente.
      const upstream = await fetch(upstreamUrl, { method: 'GET', redirect: 'manual' });

      if (upstream.status === 302 || upstream.status === 303) {
        const location = upstream.headers.get('location');
        if (!location) {
          return new Response(JSON.stringify({ error: 'No redirect location' }), {
            status: 502,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
        return new Response(null, {
          status: 302,
          headers: { ...CORS_HEADERS, Location: location },
        });
      }

      // Fallback: forward dello stream binario (raro)
      const headers = new Headers(CORS_HEADERS);
      const ct = upstream.headers.get('content-type');
      if (ct) headers.set('Content-Type', ct);
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    // JSON endpoints (findplacefromtext, place/details)
    const upstream = await fetch(upstreamUrl, { method: 'GET' });
    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Upstream Google Places request failed', detail: String(err) }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
