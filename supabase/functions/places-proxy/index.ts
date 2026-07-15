/**
 * DVAI-049 — Google Places Proxy Edge Function
 *
 * Le chiamate dirette al browser per /maps/api/place/findplacefromtext e
 * /maps/api/place/photo falliscono in CORS (Google non emette i header per
 * gli endpoint legacy Places). Questo proxy fa da relay server-side e
 * tiene la GOOGLE_MAPS_API_KEY su Supabase.
 *
 * Gate DD (U.1-bis) — Cache condivisa server-side.
 * textsearch, findplacefromtext, details, nearbysearch: lookup in
 * public.places_cache PRIMA di chiamare Google. Cache hit = zero costo
 * per l'utente successivo che chiede la stessa cosa. TTL 24h.
 * Regole:
 *  - Fail-OPEN sulla READ: se la cache Supabase e' irraggiungibile,
 *    chiamiamo Google direttamente. L'utente NON deve vedere errore
 *    perche' la cache e' down.
 *  - Fail-CLOSED sulla WRITE: se Supabase upsert fallisce, logghiamo
 *    ma restituiamo comunque il risultato Google al client.
 *  - Skip photo: /place/photo restituisce 302 verso CDN Google con URL
 *    temporaneo firmato — non serializzabile in JSONB, e comunque il
 *    browser cachea internamente le foto via HTTP caching.
 *  - Skip cache se upstream Google restituisce status non-OK (es. ZERO_RESULTS,
 *    OVER_QUERY_LIMIT): non vogliamo servire per 24h un errore come dato buono.
 *
 * Endpoint accettati (querystring `?path=`):
 *   - `place/findplacefromtext`  → JSON con candidates + photo_reference
 *   - `place/textsearch`         → JSON con results (cachable)
 *   - `place/nearbysearch`       → JSON con results (cachable)
 *   - `place/details`            → JSON con result (cachable)
 *   - `place/photo`              → 302 redirect verso CDN Google (NON cachable)
 *
 * Env:
 *   GOOGLE_MAPS_API_KEY       chiave Google Places (obbligatoria)
 *   SUPABASE_URL              url progetto (auto-iniettato da Supabase in prod)
 *   SUPABASE_SERVICE_ROLE_KEY key service-role per bypass RLS (auto-iniettato)
 *
 * Deploy:
 *   supabase functions deploy places-proxy --no-verify-jwt
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
const GOOGLE_BASE = 'https://maps.googleapis.com/maps/api';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Gate DD — Cache version. Bump quando cambia la logica upstream (es.
// nuovo filtro business_status, nuove soglie qualita', dedup diversa).
// Il bump invalida TUTTE le chiavi cached senza aspettare che scadano
// per TTL. Coerente con il pattern client-side (unnivai_poiv5_dedup_).
const CACHE_VERSION = 'v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Whitelist dei path Places consentiti. Qualsiasi altro path → 403.
const ALLOWED_PATHS = new Set([
  'place/findplacefromtext',
  'place/photo',
  'place/details',
  'place/textsearch',
  'place/nearbysearch',
]);

// Path che vale la pena cachare (JSON deterministici, non binari, non 302).
const CACHABLE_PATHS = new Set([
  'place/findplacefromtext',
  'place/details',
  'place/textsearch',
  'place/nearbysearch',
]);

// Client Supabase per il proxy (service-role → bypass RLS su places_cache).
// Se le env sono mancanti (dev senza cache), il client resta null e il
// proxy funziona senza cache (equivalente a full miss).
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

/**
 * Genera cache_key deterministica dalla querystring.
 * Ordina i parametri (URLSearchParams non lo garantisce), esclude 'path'
 * (gia' incluso separatamente) e 'key' (GOOGLE_MAPS_API_KEY che aggiungiamo
 * NOI dopo — non deve mai finire in cache).
 * Include CACHE_VERSION per invalidazione manuale via bump.
 */
function computeCacheKey(path: string, params: URLSearchParams): string {
  const entries: Array<[string, string]> = [];
  for (const [k, v] of params.entries()) {
    if (k === 'path' || k === 'key') continue;
    entries.push([k, v]);
  }
  entries.sort(([a], [b]) => a.localeCompare(b));
  const qs = entries.map(([k, v]) => `${k}=${v}`).join('&');
  return `${CACHE_VERSION}:${path}:${qs}`;
}

/**
 * Lookup cache. Fail-OPEN: qualunque errore → null (miss) → il proxy
 * chiamera' Google. L'utente non deve mai vedere errore perche' la cache
 * e' down.
 */
async function cacheLookup(cacheKey: string): Promise<unknown | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('places_cache')
      .select('data, created_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    const ageMs = Date.now() - new Date(data.created_at as string).getTime();
    if (ageMs > CACHE_TTL_MS) return null; // stantia oltre TTL
    return data.data;
  } catch (_e) {
    return null; // fail-open
  }
}

/**
 * Scrittura cache. Fail-CLOSED (nel senso: se fallisce non blocca la
 * risposta, ma la logghiamo). Upsert: sovrascrive se la key esiste gia'
 * (es. entry scaduta viene rinfrescata).
 */
async function cacheWrite(cacheKey: string, data: unknown): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('places_cache')
      .upsert({
        cache_key: cacheKey,
        data,
        created_at: new Date().toISOString(),
      }, { onConflict: 'cache_key' });
    if (error) console.warn('[places-cache] write failed:', error.message);
  } catch (e) {
    console.warn('[places-cache] write exception:', String(e));
  }
}

/**
 * Google Places JSON restituisce sempre `status` dentro il payload
 * (es. "OK", "ZERO_RESULTS", "OVER_QUERY_LIMIT", "REQUEST_DENIED").
 * Cachiamo solo "OK": un ZERO_RESULTS di oggi potrebbe essere un OK
 * di domani (POI nuovi indicizzati). E soprattutto non vogliamo servire
 * un OVER_QUERY_LIMIT come dato buono per 24h.
 */
function isCachableResponse(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const status = (data as { status?: string }).status;
  return status === 'OK';
}

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

  const isPhoto = path === 'place/photo';
  const isCachable = CACHABLE_PATHS.has(path);

  // Gate DD — Cache lookup (solo per path cachable, escluso photo).
  let cacheKey: string | null = null;
  if (isCachable) {
    cacheKey = computeCacheKey(path, url.searchParams);
    const cached = await cacheLookup(cacheKey);
    if (cached !== null) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
        },
      });
    }
  }

  // Ricostruisci la querystring da inoltrare a Google.
  const upstreamParams = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (key === 'path') continue;
    upstreamParams.set(key, value);
  }
  upstreamParams.set('key', GOOGLE_MAPS_API_KEY);

  const upstreamUrl = `${GOOGLE_BASE}/${path}${isPhoto ? '' : '/json'}?${upstreamParams.toString()}`;

  try {
    if (isPhoto) {
      // /place/photo ritorna un 302 verso un CDN temporaneo. Non cachabile
      // (URL firmato con token temporaneo Google).
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

      const headers = new Headers(CORS_HEADERS);
      const ct = upstream.headers.get('content-type');
      if (ct) headers.set('Content-Type', ct);
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    // JSON endpoints
    const upstream = await fetch(upstreamUrl, { method: 'GET' });
    const data = await upstream.json();

    // Gate DD — Cache write solo se path cachable + response cachable ("OK").
    // Scrittura fire-and-forget: non blocca la risposta al client. Se fallisce,
    // logghiamo dentro cacheWrite. L'utente riceve il dato Google in ogni caso.
    if (cacheKey && upstream.ok && isCachableResponse(data)) {
      // Non await: la risposta al client non deve aspettare la scrittura DB.
      cacheWrite(cacheKey, data).catch(() => { /* gia' loggato in cacheWrite */ });
    }

    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Upstream Google Places request failed', detail: String(err) }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
