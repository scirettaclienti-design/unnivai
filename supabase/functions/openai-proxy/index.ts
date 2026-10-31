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
 * C10 — LA LISTA DELLA CITTÀ (`dv.purpose = 'city_list'`, con `dv.citta` e `dv.giorno`): una lista per città e per giorno,
 * uguale per tutti. Se c'e' gia' in public.city_knowledge si restituisce (niente OpenAI, niente quota). Altrimenti:
 * quota di contorno, UNA chiamata OpenAI con il prompt scritto QUI (il client non manda testo: nessuno puo' riscrivere
 * la lista degli altri), verifica di ogni nome su Google via places-proxy (stessa ricerca e stessa maschera del motore),
 * salvataggio. Al client vanno solo i posti verificati con momento e tipo: il «perche'» resta nella tabella.
 *
 * La OPENAI_API_KEY rimane esclusivamente sul server Supabase.
 * Deploy: supabase functions deploy openai-proxy --no-verify-jwt
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  CITY_LIST_VERSION, normCitta, cittaValida, giornoValido, promptCitta, leggiLista, verificaPosto, voceVerificata,
  promptScala, leggiAbitanti, scalaDaAbitanti, type Scala, promptQuartiere, leggiListaQuartiere, versioneQuartiere, completaLista,
  provinciaDa, queryVerifica, raggioVerificaKm,
} from './cityKnowledge.ts';
import {
  MODELLO_DI_PRIMA, MODELLI, modelloPer, timeoutPer, corpoPer, rispostaVuota, passaggioValido, MODELLI_AMMESSI, chiamaConRipiego, usageTotale,
  type Passaggio, type Primo,
} from './modelli.ts';
import { fornitoreScelto, modelliAnthropicPer, chiamaAnthropicElenco, ErroreAnthropic, compitoDi, PREZZI_ANTHROPIC_USD_PER_MILIONE } from './anthropic.ts';

import {
  VERSIONE_RACCONTO, versioneValida, MODELLO_REVISORE, TTL_RACCONTO_GIORNI, TTL_SCARTATO_GIORNI, haFonti, scriviERivedi, impronta as improntaRacconto,
} from './racconto.ts';
import { cercaWikipedia, descrizioneGoogleDa } from './raccontoFonti.ts';
import {
  MODELLO_VOCE, VOCE_PREDEFINITA, BUCKET_VOCE, voceValida, testoValido, chiaveAudio, percorsoAudio, corpoVoce, tettoNuovi, costoStimatoUsd,
} from './voce.ts';

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
// Tetto globale giornaliero sulle chiamate di contorno (tutti gli ospiti e gli utenti insieme): impedisce che molti sconosciuti, ognuno
// sotto il proprio limite, facciano salire i costi. Secret AI_GLOBAL_DAILY_CAP_CONTORNO.
const GLOBAL_CAP_CONTORNO_DEFAULT = 2000;
// Corpo della richiesta: oltre questo il proxy risponde 413 senza leggere altro.
const MAX_BODY_BYTES = 60 * 1024;

const TICKET_KINDS = new Set(['itinerary', 'home_tours']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Testi decisi da Ivano: non modificarli senza di lui.
const MSG_USER_LIMIT   = 'Per oggi hai usato tutti i tuoi percorsi. Domani se ne aprono altri.';
const MSG_GLOBAL_LIMIT = 'Oggi Unnivai ha raggiunto il limite di percorsi. Domani se ne aprono altri.';
const MSG_GLOBAL_CONTORNO = 'Oggi Unnivai ha raggiunto il limite di richieste. Domani riparte tutto.';
const MSG_BODY_TOO_LARGE = 'La richiesta è troppo grande.';
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

/** Letto a ogni richiesta: tetto globale giornaliero delle chiamate di contorno. */
function globalCapContorno(): number {
  const raw = Deno.env.get('AI_GLOBAL_DAILY_CAP_CONTORNO');
  if (raw === undefined || raw === '') return GLOBAL_CAP_CONTORNO_DEFAULT;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 0) return n;
  console.warn(`[openai-proxy] AI_GLOBAL_DAILY_CAP_CONTORNO non valido (${raw}), uso ${GLOBAL_CAP_CONTORNO_DEFAULT}`);
  return GLOBAL_CAP_CONTORNO_DEFAULT;
}

/**
 * Gli account senza nessun limite: id utente (verificato dal JWT) separati da virgola nel secret AI_UNLIMITED_USER_IDS.
 * Esenti da tutte le quote e i tetti, compreso RACCONTO_DAILY_CAP; non da controlli di sicurezza (corpo max 60 KB, token valido).
 * Un ospite non e' mai esente. Letto a ogni richiesta.
 */
function esenteDaiTetti(subject: Subject): boolean {
  if (subject.kind !== 'user') return false;
  const ids = (Deno.env.get('AI_UNLIMITED_USER_IDS') ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  return ids.includes(subject.id.toLowerCase());
}

/** Il corpo come testo, o null se supera `max` byte (controllo sull'intestazione e poi mentre si legge: non si bufferizza oltre il limite). */
async function leggiCorpoLimitato(req: Request, max: number): Promise<string | null> {
  const dichiarata = Number(req.headers.get('content-length'));
  if (Number.isFinite(dichiarata) && dichiarata > max) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const pezzi: Uint8Array[] = [];
  let totale = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totale += value.byteLength;
    if (totale > max) { await reader.cancel().catch(() => {}); return null; }
    pezzi.push(value);
  }
  const tutto = new Uint8Array(totale);
  let off = 0;
  for (const p of pezzi) { tutto.set(p, off); off += p.byteLength; }
  return new TextDecoder().decode(tutto);
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

/**
 * FORNITORE-AI — con `AI_PROVIDER=anthropic` (e la chiave sul server) il primo tentativo di ogni testo e' Claude; senza, o se Claude
 * fallisce, OpenAI come prima. Letto a ogni richiesta: il secret decide, non il codice deployato.
 */
const envLetto = (k: string) => Deno.env.get(k);
function anthropicAttivo(): string | null {
  if (fornitoreScelto(envLetto) !== 'anthropic') return null;
  return Deno.env.get('ANTHROPIC_API_KEY')?.trim() || null;
}
function primoAnthropic(passaggio: Passaggio, chiave: string): Primo {
  const modelli = modelliAnthropicPer(passaggio, envLetto);
  return { fornitore: 'anthropic', modello: modelli[0], timeoutMs: MODELLI[passaggio].timeoutMs, tentativi: modelli.length > 1 ? 1 : 2, invia: (p, limite) => chiamaAnthropicElenco(chiave, modelli, p, limite) };
}
/** Il revisore dei racconti ha il suo modello (Haiku 4.5), indipendente dal secret del selettore; se Claude non c'è o fallisce, OpenAI come ogni compito. */
function primoRevisore(chiave: string): Primo {
  const modelli = (String(Deno.env.get('ANTHROPIC_MODEL_REVISORE') ?? '').trim() || MODELLO_REVISORE).split(',').map((m) => m.trim()).filter(Boolean);
  return { fornitore: 'anthropic', modello: modelli[0], timeoutMs: 20_000, tentativi: modelli.length > 1 ? 1 : 2, invia: (p, limite) => chiamaAnthropicElenco(chiave, modelli, p, limite) };
}
/** Il codice del guasto dal motivo scritto da `invia` (HTTP <status> <code> <type> <msg>): lo stesso vocabolario del client. */
function codiceDaMotivo(err: unknown): EngineCode {
  const m = String((err as Error)?.message ?? err);
  if (/insufficient_quota|billing_hard_limit_reached|credit balance/i.test(m)) return 'OPENAI_CREDIT_EXHAUSTED';
  if (/HTTP 429/.test(m)) return 'OPENAI_RATE_LIMITED';
  return 'OPENAI_ERROR';
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


// ─── C10 — la lista della città ─────────────────────────────────────────────
const oggiRoma = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
const CITY_LIST_TIMEOUT_MS = 45_000;

// deno-lint-ignore no-explicit-any
async function placesCall(params: Record<string, string>): Promise<{ body: any; hit: boolean }> {
  const base = `${Deno.env.get('SUPABASE_URL')}/functions/v1/places-proxy`;
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const qs = new URLSearchParams({ language: 'it', ...params }).toString();
  const res = await fetch(`${base}?${qs}`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
  const body = await res.json().catch(() => null);
  return { body, hit: res.headers.get('X-Cache') === 'HIT' };
}

// deno-lint-ignore no-explicit-any
async function handleCityList(req: Request, dv: Record<string, any>): Promise<Response> {
  const citta = typeof dv.citta === 'string' ? dv.citta.trim() : '';
  const giorno = dv.giorno;
  // C10b2 — `purpose: 'quartiere_list'`: la lista dedicata di un quartiere chiesto (stessa tabella, versione col quartiere)
  const quartiereChiesto = dv.purpose === 'quartiere_list' && typeof dv.quartiere === 'string' ? dv.quartiere.trim() : null;
  const passaggioLista: 'lista' | 'quartiere' = quartiereChiesto ? 'quartiere' : 'lista';
  if (!cittaValida(citta) || !giornoValido(giorno, oggiRoma()) || (dv.purpose === 'quartiere_list' && !cittaValida(quartiereChiesto))) {
    return json(400, { error: 'Città o giorno non validi', code: 'BAD_CITY_LIST' });
  }
  const versione = quartiereChiesto ? versioneQuartiere(quartiereChiesto) : CITY_LIST_VERSION;
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_API_KEY) return json(503, { error: 'Configurazione mancante', code: 'CITY_LIST_UNAVAILABLE' });
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const chiave = normCitta(citta);
  const leggi = async () => {
    const { data } = await sb.from('city_knowledge').select('citta_nome, giorno, versione, scala, centro, verificati, proposti, scartati, costo, created_at')
      .eq('citta', chiave).eq('giorno', giorno).eq('versione', versione).maybeSingle();
    return data;
  };
  // deno-lint-ignore no-explicit-any
  const risposta = (row: any, extra: Record<string, unknown>) => json(200, {
    cityKnowledge: {
      citta: row.citta_nome, giorno: row.giorno, versione: row.versione, centro: row.centro,
      // C10b — la scala PROPOSTA dall'AI; il motore la conferma con le distanze fra i verificati
      scala: row.scala ?? null,
      ...(quartiereChiesto ? { quartiere: quartiereChiesto } : {}),
      verificati: row.verificati,
      // C10b2 — il modello usato per la lista (e se ha ripiegato), dalla riga salvata
      modelli: row.costo?.modelli ?? null,
      // C10b3 — le quote della lista (prima e dopo il completamento)
      quote: row.costo?.quote ?? null,
      conti: { proposti: (row.proposti || []).length, verificati: (row.verificati || []).length, scartati: (row.scartati || []).length },
      ...extra,
    },
  });

  const gia = await leggi();
  if (gia) return risposta(gia, { cached: true });

  // Prima lista del giorno per questa città: quota di contorno (fail-closed, come le altre chiamate).
  try {
    const subject = await resolveSubject(req, sb);
    if (!esenteDaiTetti(subject)) {
      const { data, error } = await sb.rpc('ai_quota_consume', {
        p_subject_kind: subject.kind, p_subject: subject.id, p_purpose: 'aux', p_ticket: null, p_ticket_kind: null,
        p_limit: LIMITS[subject.kind].aux, p_global_cap: globalCap(), p_aux_global_cap: globalCapContorno(),
      });
      if (error) throw new Error(`ai_quota_consume: ${error.message ?? error}`);
      if (!data?.allowed) {
        if (data?.reason === 'global_aux') return json(429, { error: MSG_GLOBAL_CONTORNO, code: 'GLOBAL_AUX_QUOTA_EXCEEDED' });
        return json(429, { error: MSG_USER_LIMIT, code: 'QUOTA_EXCEEDED' });
      }
    }
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, err.body);
    console.error('[openai-proxy] lista città: controllo quota fallito:', scrubLogText(err));
    return json(503, { error: 'Controllo quota non disponibile, riprova tra poco.', code: 'QUOTA_CHECK_FAILED' });
  }

  const t0 = Date.now();
  const chiaveAnthropic = anthropicAttivo();
  // C10b2 — il modello del passaggio (modelli.ts), e se non risponde o va oltre il suo tempo il modello di prima.
  const modelliUsati: Array<Record<string, unknown>> = [];
  // deno-lint-ignore no-explicit-any
  const invia = async (corpo: Record<string, any>, limite: number): Promise<any> => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), limite);
    try {
      const upstream = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify(corpo),
        signal: c.signal,
      });
      const body = await upstream.json().catch(() => null);
      // C10b3-bis — il motivo dice anche il tipo e il messaggio di OpenAI (il 500 di Roma del 14/10 non aveva il codice)
      if (!upstream.ok) throw new Error(`HTTP ${upstream.status} ${plain(body?.error?.code)} ${plain(body?.error?.type)} ${plain(body?.error?.message)}`.slice(0, 120));
      return body;
    } finally {
      clearTimeout(t);
    }
  };
  // deno-lint-ignore no-explicit-any
  const chiama = async (cosa: string, messages: any[], max_tokens: number, temperature: number): Promise<any> => {
    const { data, info } = await chiamaConRipiego(passaggioLista,
      { model: MODELLO_DI_PRIMA, temperature, max_tokens, response_format: { type: 'json_object' }, messages }, invia, CITY_LIST_TIMEOUT_MS,
      chiaveAnthropic ? primoAnthropic(passaggioLista, chiaveAnthropic) : undefined);
    if (info.ripiego) console.warn(`[openai-proxy] ${passaggioLista} (${cosa}): ${info.chiesto} → ripiego su ${info.usato} (${info.motivo})`);
    modelliUsati.push({ cosa, ...info });
    return data;
  };
  // deno-lint-ignore no-explicit-any
  let ai: any;
  // C10b — 1) la scala proposta: l'AI dice gli abitanti, il codice applica la regola (scalaDaAbitanti);
  //        2) la lista, col prompt scritto per quella scala.
  let abitanti: number | null = null;
  let scala: Scala = 'città';
  // deno-lint-ignore no-explicit-any
  let usageScala: any = null;
  try {
    if (quartiereChiesto) {
      // la lista del quartiere: una sola chiamata, luoghi da visitare; si verifica come una metropoli (raggio della citta')
      scala = 'metropoli';
      const pq = promptQuartiere(citta, quartiereChiesto, giorno);
      ai = await chiama('quartiere', [{ role: 'system', content: pq.system }, { role: 'user', content: pq.user }], 2000, 0.2);
    } else {
      const ps = promptScala(citta);
      const r = await chiama('abitanti', [{ role: 'system', content: ps.system }, { role: 'user', content: ps.user }], 60, 0);
      abitanti = leggiAbitanti(r?.choices?.[0]?.message?.content);
      scala = scalaDaAbitanti(abitanti);
      usageScala = r?.usage ?? null;
      const { system, user } = promptCitta(citta, giorno, scala);
      ai = await chiama('lista', [{ role: 'system', content: system }, { role: 'user', content: user }], 3500, 0.2);
    }
  } catch (err) {
    console.error('[openai-proxy] lista città: OpenAI non risponde o rifiuta:', scrubLogText(err));
    // chiude I1: anche con tutti e due i fornitori giu' il client riceve il messaggio onesto e il codice (credito, troppe richieste, errore)
    return json(502, { error: MSG_ENGINE_DOWN, code: codiceDaMotivo(err), source: 'openai' });
  }
  const tAi = Date.now() - t0;
  // la scala decide quanti posti si leggono e come si verificano (un borgo: «nome, comune, provincia»)
  let proposti = quartiereChiesto
    ? leggiListaQuartiere(ai?.choices?.[0]?.message?.content, citta, quartiereChiesto)
    : leggiLista(ai?.choices?.[0]?.message?.content, citta, scala);
  // C10b3 — le quote sulla risposta: se mancano luoghi da visitare, UNA richiesta di completamento (stesso modello, stesso ripiego)
  // deno-lint-ignore no-explicit-any
  let quote: any = null;
  if (!quartiereChiesto) {
    const r = await completaLista({
      posti: proposti, scala, citta, giorno,
      chiedi: async (pr) => (await chiama('completamento', [{ role: 'system', content: pr.system }, { role: 'user', content: pr.user }], 2000, 0.2))?.choices?.[0]?.message?.content,
    });
    proposti = r.posti;
    quote = { prima: r.quotePrima, dopo: r.quoteDopo, completamento: r.completamento };
  }
  // C10b3-bis — il costo conta i token di tutte le chiamate (abitanti, lista, completamento), dal tracciato dei modelli
  const usage = modelliUsati.length ? usageTotale(modelliUsati) : null;

  // Il centro della città: la stessa ricerca del client (resolveCityCenter), dalla cache condivisa del proxy.
  const google = { findplace: 0, textsearch: 0, hit: 0 };
  let centro: { lat: number; lng: number } | null = null;
  let provincia: string | null = null;
  try {
    const c = await placesCall({ path: 'place/findplacefromtext', input: `${citta}, Italia`, inputtype: 'textquery', fields: 'name,geometry,types,formatted_address' });
    google.findplace += 1; if (c.hit) google.hit += 1;
    const loc = c.body?.candidates?.[0]?.geometry?.location;
    if (Number.isFinite(loc?.lat) && Number.isFinite(loc?.lng)) centro = { lat: loc.lat, lng: loc.lng };
    provincia = provinciaDa(c.body?.candidates?.[0]?.formatted_address);
  } catch { /* senza centro ogni posto resta «senza coordinate»: la lista esce vuota, non sbagliata */ }
  const raggio = raggioVerificaKm(citta, scala);
  // un borgo: mai un posto fuori comune (indirizzo nel comune, oltre al raggio)
  const comune = scala === 'borgo' ? citta : null;

  // Ogni nome, in parallelo: «nome, città», bias sul centro con il raggio massimo del motore.
  const esiti = await Promise.all(proposti.map(async (p) => {
    try {
      const r = await placesCall({
        path: 'place/textsearch', query: queryVerifica(p, citta, scala, provincia),
        ...(centro ? { location: `${centro.lat},${centro.lng}`, radius: String(raggio * 1000) } : {}),
      });
      google.textsearch += 1; if (r.hit) google.hit += 1;
      return { p, v: verificaPosto(p, r.body?.results, centro, raggio, { comune }) };
    } catch (err) {
      return { p, v: { ok: false as const, motivo: `ricerca fallita (${scrubLogText(err).slice(0, 40)})` } };
    }
  }));
  const visti = new Set<string>();
  // deno-lint-ignore no-explicit-any
  const verificati: any[] = [];
  const scartati: Array<{ nome: string; tipo: string; momento: string; motivo: string }> = [];
  for (const { p, v } of esiti) {
    if (v.ok) {
      const id = String(v.risultato.place_id || '');
      if (id && visti.has(id)) { scartati.push({ nome: p.nome, tipo: p.tipo, momento: p.momento, motivo: 'doppione di un posto gia\' in lista' }); continue; }
      if (id) visti.add(id);
      verificati.push(voceVerificata(p, v.risultato, v.sostituzione ?? null));
    } else {
      scartati.push({ nome: p.nome, tipo: p.tipo, momento: p.momento, motivo: v.motivo });
    }
  }

  const row = {
    citta: chiave, giorno, versione, citta_nome: citta, scala: quartiereChiesto ? null : scala, centro: centro ? { ...centro, provincia, raggioKm: raggio, abitanti } : null,
    proposti, verificati, scartati,
    costo: { usage, google, ms: { ai: tAi, totale: Date.now() - t0 }, modelli: modelliUsati, ...(quote ? { quote } : {}) },
  };
  // Due prime richieste insieme: vince la prima scritta, e tutti ricevono quella (la lista resta una sola).
  const { error: insErr } = await sb.from('city_knowledge').upsert(row, { onConflict: 'citta,giorno,versione', ignoreDuplicates: true });
  if (insErr) console.error('[openai-proxy] lista città: salvataggio fallito:', scrubLogText(insErr.message));
  const salvata = (await leggi()) || row;
  return risposta(salvata, { cached: false, usage, google, ms: { ai: tAi, totale: Date.now() - t0 }, modelli: modelliUsati });
}

/**
 * VOCE-1 — `dv.purpose = 'voce'`, `dv.testo`, `dv.voce` ('marin' | 'cedar'). Restituisce { url, source: 'cache' | 'nuova' }.
 * Il client non sceglie modello, istruzione o formato (vedi voce.ts). Una frase già in cache (Storage `voce-cache`) non chiama OpenAI
 * e non conta nel tetto; le frasi nuove contano nel tetto giornaliero (public.voce_consuma, secret VOCE_DAILY_CAP).
 * Non usa la quota dei percorsi: la voce non deve consumare i giri dell'utente.
 */
async function handleVoce(req: Request, dv: Record<string, unknown>, apiKey: string): Promise<Response> {
  const voce = dv.voce === undefined || dv.voce === null ? VOCE_PREDEFINITA : dv.voce;
  if (!voceValida(voce)) return json(400, { error: 'Voce non valida', code: 'VOCE_NON_VALIDA' });
  if (!testoValido(dv.testo)) return json(400, { error: 'Testo non valido', code: 'TESTO_NON_VALIDO' });
  const testo = dv.testo as string;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return json(503, { error: 'Voce non disponibile', code: 'VOCE_NON_DISPONIBILE' });
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    await resolveSubject(req, sb); // solo per rifiutare un token non valido
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, err.body);
    return json(503, { error: 'Voce non disponibile', code: 'VOCE_NON_DISPONIBILE' });
  }

  const chiave = await chiaveAudio(testo, voce);
  const percorso = percorsoAudio(chiave);
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_VOCE}/${percorso}`;

  try {
    const testa = await fetch(url, { method: 'HEAD' });
    if (testa.ok) return json(200, { url, source: 'cache', voce, chiave });
  } catch { /* la cache non risponde: si prova a generare */ }

  const { data: ammesso, error: errTetto } = await sb.rpc('voce_consuma', { p_tetto: tettoNuovi(Deno.env.get('VOCE_DAILY_CAP')) });
  if (errTetto) {
    console.error('[openai-proxy] voce: tetto non verificabile, OpenAI non chiamato:', scrubLogText(errTetto.message));
    return json(503, { error: 'Voce non disponibile', code: 'VOCE_NON_DISPONIBILE' });
  }
  if (!ammesso) return json(429, { error: 'Tetto giornaliero della voce raggiunto', code: 'VOCE_TETTO' });

  let audio: Uint8Array;
  try {
    const r = await fetch(`${OPENAI_BASE}/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(corpoVoce(testo, voce)),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) {
      console.error(`[openai-proxy] voce: OpenAI ${r.status} ${scrubLogText(await r.text().catch(() => ''))}`);
      return json(502, { error: 'Voce non disponibile', code: 'VOCE_OPENAI' });
    }
    audio = new Uint8Array(await r.arrayBuffer());
    if (audio.length < 200) throw new Error('audio vuoto');
  } catch (err) {
    console.error('[openai-proxy] voce: generazione fallita:', scrubLogText(err));
    return json(502, { error: 'Voce non disponibile', code: 'VOCE_OPENAI' });
  }

  const { error: errSalva } = await sb.storage.from(BUCKET_VOCE).upload(percorso, audio, { contentType: 'audio/mpeg', upsert: true });
  if (errSalva) {
    console.error('[openai-proxy] voce: salvataggio in cache fallito:', scrubLogText(errSalva.message));
    return json(502, { error: 'Voce non disponibile', code: 'VOCE_CACHE' });
  }
  console.log(`[openai-proxy] voce: nuova ${chiave.slice(0, 10)} ${voce} ${MODELLO_VOCE} ${testo.length} car`);
  return json(200, { url, source: 'nuova', voce, chiave, costoStimatoUsd: costoStimatoUsd(testo) });
}

/**
 * RACCONTO DI TAPPA — `dv.purpose = 'racconto'`, con `dv.place_id`, `dv.nome`, `dv.citta`, `dv.lat`, `dv.lng`. Restituisce
 * { racconto: { esito: 'passato' | 'scartato' | 'senza-fonti', testo | null, motivi, fonti, cached } }.
 * Il server prende le fonti da solo (Wikipedia della tappa, descrizione Google via places-proxy): il client non le manda, quindi non può
 * far «verificare» un testo inventato. Claude (narratore, Sonnet 5.5; catena e ripiego come ogni altro compito) scrive, il controllo
 * automatico (racconto.ts) scarta ciò che non sta nelle fonti. Una riga per tappa in public.place_racconti: un posto già raccontato costa 0.
 * I racconti nuovi contano nel tetto giornaliero (public.racconto_consuma, secret RACCONTO_DAILY_CAP, difetto 300); non usano la quota dei giri.
 */
async function handleRacconto(req: Request, dv: Record<string, any>): Promise<Response> {
  const placeId = typeof dv.place_id === 'string' ? dv.place_id : '';
  const nome = typeof dv.nome === 'string' ? dv.nome.trim() : '';
  const citta = typeof dv.citta === 'string' ? dv.citta.trim() : '';
  const lat = Number(dv.lat), lng = Number(dv.lng);
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId) || !nome || nome.length > 120 || citta.length > 80 || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json(400, { error: 'Tappa non valida', code: 'RACCONTO_NON_VALIDO' });
  }
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_API_KEY) return json(503, { error: 'Racconto non disponibile', code: 'RACCONTO_NON_DISPONIBILE' });
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let esente = false;
  try {
    esente = esenteDaiTetti(await resolveSubject(req, sb)); // rifiuta un token non valido; l'account senza limiti salta il tetto
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, err.body);
    return json(503, { error: 'Racconto non disponibile', code: 'RACCONTO_NON_DISPONIBILE' });
  }

  // deno-lint-ignore no-explicit-any
  const risposta = (riga: any, extra: Record<string, unknown> = {}) => json(200, {
    racconto: { esito: riga.esito, testo: riga.esito === 'passato' ? riga.testo : null, motivi: riga.motivi ?? [], fonti: riga.fonti ?? [], ...extra },
  });

  const { data: gia } = await sb.from('place_racconti').select('esito, testo, motivi, fonti, versione, created_at').eq('place_id', placeId).maybeSingle();
  if (gia && versioneValida(gia)) { // la versione di oggi, o un r3/r4 passato o senza fonti: uno scartato r3/r4 si riscrive subito con r5
    const giorni = (Date.now() - new Date(gia.created_at).getTime()) / 86_400_000;
    if (giorni < (gia.esito === 'passato' ? TTL_RACCONTO_GIORNI : TTL_SCARTATO_GIORNI)) return risposta(gia, { cached: true });
  }

  if (!esente) {
    const { data: ammesso, error: errTetto } = await sb.rpc('racconto_consuma', { p_tetto: tettoNuovi(Deno.env.get('RACCONTO_DAILY_CAP') ?? '300') });
    if (errTetto) {
      console.error('[openai-proxy] racconto: tetto non verificabile:', scrubLogText(errTetto.message));
      return json(503, { error: 'Racconto non disponibile', code: 'RACCONTO_NON_DISPONIBILE' });
    }
    if (!ammesso) return json(429, { error: 'Tetto giornaliero dei racconti raggiunto', code: 'RACCONTO_TETTO' });
  }

  const t0 = Date.now();
  const [wikiRes, google] = await Promise.all([
    cercaWikipedia({ nome, citta, lat, lng }, (u, init) => fetch(u, init as RequestInit)).catch(() => ({ fonte: null, errore: true })),
    placesCall({ path: 'place/details', place_id: placeId, fields: 'editorial_summary' }).then(({ body }) => descrizioneGoogleDa(body)).catch(() => ''),
  ]);
  const wiki = wikiRes.fonte;
  const fonti = { nome, citta, wikipedia: wiki ? { titolo: wiki.titolo, testo: wiki.testo } : null, google: google ? { testo: google } : null };
  const fontiUsate = wiki ? [{ fonte: 'wikipedia', titolo: wiki.titolo, url: wiki.url }, ...(google ? [{ fonte: 'google' }] : [])] : (google ? [{ fonte: 'google' }] : []);
  const salva = async (riga: Record<string, unknown>) => {
    const { error } = await sb.from('place_racconti').upsert({ place_id: placeId, versione: VERSIONE_RACCONTO, created_at: new Date().toISOString(), ...riga }, { onConflict: 'place_id' });
    if (error) console.error('[openai-proxy] racconto: salvataggio fallito:', scrubLogText(error.message));
  };
  const imp = await improntaRacconto(fonti);

  if (!haFonti(fonti) && wikiRes.errore) {
    // Wikipedia non ha risposto (occupata): «nessuna voce» non è una risposta, quindi non si memorizza; il client riprova più tardi
    console.warn(`[openai-proxy] racconto: Wikipedia non risponde ${placeId.slice(0, 10)}`);
    return json(503, { error: 'Fonti non disponibili', code: 'RACCONTO_FONTI' });
  }
  if (!haFonti(fonti)) {
    const riga = { impronta: imp, esito: 'senza-fonti', testo: null, motivi: ['fonti insufficienti'], fonti: fontiUsate, ms: Date.now() - t0 };
    await salva(riga);
    console.log(`[openai-proxy] racconto: senza-fonti ${placeId.slice(0, 10)}`);
    return risposta(riga, { cached: false });
  }

  const chiaveAnthropic = anthropicAttivo();
  // deno-lint-ignore no-explicit-any
  const invia = async (corpo: Record<string, any>, limite: number): Promise<any> => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), limite);
    try {
      const upstream = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` }, body: JSON.stringify(corpo), signal: c.signal,
      });
      const body = await upstream.json().catch(() => null);
      if (!upstream.ok) throw new Error(`HTTP ${upstream.status} ${plain(body?.error?.code)} ${plain(body?.error?.type)} ${plain(body?.error?.message)}`.slice(0, 120));
      return body;
    } finally { clearTimeout(t); }
  };
  // deno-lint-ignore no-explicit-any
  const costoDi = (i: any, d: any): number => {
    const pr = PREZZI_ANTHROPIC_USD_PER_MILIONE[i?.usato as string];
    return pr && d?.usage ? ((d.usage.prompt_tokens || 0) * pr.input + (d.usage.completion_tokens || 0) * pr.output) / 1e6 : 0;
  };
  // Il narratore (Sonnet 5.5, passaggio `narratore`, catena e ripiego di sempre) scrive; il controllo automatico e il revisore (Haiku 4.5,
  // passaggio `selettore` con il modello suo) leggono; se il controllo automatico ferma il testo o il revisore segna frasi «no», il narratore
  // riceve il motivo, riscrive UNA volta e il nuovo testo ripassa da entrambi (racconto.ts).
  // Se il narratore o il revisore non rispondono non si salva niente: si riprova alla richiesta dopo, il racconto non esce senza controllo.
  let chi = 'motore';
  // deno-lint-ignore no-explicit-any
  const scrivi = async (messages: any[]) => {
    chi = 'motore';
    const { data, info } = await chiamaConRipiego('narratore',
      { model: MODELLO_DI_PRIMA, temperature: 0.6, max_tokens: 1500, messages }, invia, 30_000,
      chiaveAnthropic ? primoAnthropic('narratore', chiaveAnthropic) : undefined);
    return { testo: String(data?.choices?.[0]?.message?.content ?? ''), modello: info?.usato ?? null, costoUsd: costoDi(info, data) };
  };
  // deno-lint-ignore no-explicit-any
  const rivedi = async (messages: any[]) => {
    chi = 'revisore';
    const { data, info } = await chiamaConRipiego('selettore',
      { model: MODELLO_DI_PRIMA, temperature: 0, max_tokens: 700, messages }, invia, 20_000,
      chiaveAnthropic ? primoRevisore(chiaveAnthropic) : undefined);
    return { testo: String(data?.choices?.[0]?.message?.content ?? ''), modello: info?.usato ?? null, costoUsd: costoDi(info, data) };
  };
  let esito: Awaited<ReturnType<typeof scriviERivedi>>;
  try {
    esito = await scriviERivedi(fonti, scrivi, rivedi);
  } catch (err) {
    console.error(`[openai-proxy] racconto: ${chi} non disponibile:`, scrubLogText(err));
    return json(502, { error: 'Racconto non disponibile', code: 'RACCONTO_MOTORE' });
  }
  const { ok, testo, modello, modelloVerifica, verifica } = esito;
  const motivi = esito.prima ? [...esito.motivi, ...esito.prima.motivi.map((m) => `prima stesura (riscritta): ${m}`)] : esito.motivi;
  const costoTot = esito.costoUsd;
  const costoUsd = costoTot ? +costoTot.toFixed(5) : null;
  const riga = {
    impronta: imp, esito: ok ? 'passato' : 'scartato', testo: ok ? testo : null, motivi, fonti: fontiUsate,
    modello, modello_verifica: modelloVerifica, verifica, costo_usd: costoUsd, ms: Date.now() - t0,
  };
  await salva(riga);
  console.log(`[openai-proxy] racconto: ${riga.esito}${esito.riscritto ? ' (riscritto)' : ''} ${placeId.slice(0, 10)} ${modello}+${modelloVerifica ?? '-'} ${riga.ms} ms ${costoUsd ?? '?'} $${ok ? '' : ` · ${motivi.join(' ; ').slice(0, 160)}`}`);
  return risposta(riga, { cached: false, modello, modelloVerifica, costoUsd, riscritto: esito.riscritto });
}

serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const testoCorpo = await leggiCorpoLimitato(req, MAX_BODY_BYTES).catch(() => '');
  if (testoCorpo === null) {
    return json(413, { error: MSG_BODY_TOO_LARGE, code: 'BODY_TOO_LARGE' });
  }

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    return json(500, { error: 'OpenAI API key not configured on server.' });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(testoCorpo);
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  // VOCE-1 — l'audio della navigazione: modello, voce e tono li scrive il proxy, la cache evita di pagare due volte.
  const dvVoce = body.dv as Record<string, unknown> | undefined;
  if (dvVoce && typeof dvVoce === 'object' && dvVoce.purpose === 'voce') {
    try {
      return await handleVoce(req, dvVoce, OPENAI_API_KEY);
    } catch (err) {
      console.error('[openai-proxy] voce: errore:', scrubLogText(err));
      return json(503, { error: 'Voce non disponibile', code: 'VOCE_NON_DISPONIBILE' });
    }
  }

  // RACCONTO DI TAPPA — il prompt, le fonti e il controllo li scrive il proxy; il client dice solo quale tappa.
  if (dvVoce && typeof dvVoce === 'object' && dvVoce.purpose === 'racconto') {
    try {
      return await handleRacconto(req, dvVoce as Record<string, any>);
    } catch (err) {
      console.error('[openai-proxy] racconto: errore:', scrubLogText(err));
      return json(503, { error: 'Racconto non disponibile', code: 'RACCONTO_NON_DISPONIBILE' });
    }
  }

  // C10 — la lista della città non e' una chiamata libera a OpenAI: il prompt lo scrive il proxy.
  const dvIn = body.dv as Record<string, unknown> | undefined;
  if (dvIn && typeof dvIn === 'object' && (dvIn.purpose === 'city_list' || dvIn.purpose === 'quartiere_list')) {
    try {
      return await handleCityList(req, dvIn);
    } catch (err) {
      console.error('[openai-proxy] lista città: errore:', scrubLogText(err));
      return json(503, { error: 'Lista della città non disponibile', code: 'CITY_LIST_UNAVAILABLE' });
    }
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
    if (esenteDaiTetti(subject)) {
      quota = { allowed: true, reason: 'unlimited_env' };
    } else {
      const { data, error } = await sb.rpc('ai_quota_consume', {
        p_subject_kind: subject.kind,
        p_subject: subject.id,
        p_purpose: meta.purpose,
        p_ticket: meta.purpose === 'generation' ? meta.ticket : null,
        p_ticket_kind: meta.purpose === 'generation' ? meta.kind : null,
        p_limit: LIMITS[subject.kind][meta.purpose],
        p_global_cap: globalCap(),
        p_aux_global_cap: globalCapContorno(),
      });
      if (error) throw new Error(`ai_quota_consume: ${error.message ?? error}`);
      if (!data || typeof data.allowed !== 'boolean') throw new Error('ai_quota_consume: risposta non valida');
      quota = data;
    }
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, err.body);
    console.error('[openai-proxy] controllo quota fallito, OpenAI non chiamato:', String(err));
    return json(503, { error: 'Controllo quota non disponibile, riprova tra poco.', code: 'QUOTA_CHECK_FAILED' });
  }

  if (!quota.allowed) {
    if (quota.reason === 'global') {
      return json(429, { error: MSG_GLOBAL_LIMIT, code: 'GLOBAL_QUOTA_EXCEEDED' });
    }
    if (quota.reason === 'global_aux') {
      return json(429, { error: MSG_GLOBAL_CONTORNO, code: 'GLOBAL_AUX_QUOTA_EXCEEDED' });
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

  // C10b2 — il modello del passaggio (modelli.ts). Se non risponde, sbaglia o va oltre il suo tempo massimo, la stessa
  // chiamata riparte qui sotto con il modello che il client ha chiesto (quello di prima), e la risposta lo dice (`_modello`).
  const passaggio = (dv && typeof dv === 'object') ? (dv as Record<string, unknown>).passaggio : undefined;
  const chiesto = String(openAiPayload.model);
  const modelloPassaggio = modelloPer(passaggio, chiesto);
  // deno-lint-ignore no-explicit-any
  let infoModello: Record<string, any> | null = passaggioValido(passaggio)
    ? { passaggio, chiesto: modelloPassaggio, usato: chiesto, ripiego: false } : null;
  // FORNITORE-AI — Claude per ogni testo non in streaming (traduttore, selettore, narratore, contorno, notifiche). Due tentativi se sbaglia
  // (non se scade il tempo, non se il credito e' finito), poi si ripiega su OpenAI al modello che il client ha chiesto (quello di prima).
  const chiaveAnthropic = isStreaming ? null : anthropicAttivo();
  if (chiaveAnthropic) {
    const nome = passaggioValido(passaggio) ? passaggio : null;
    const compito = compitoDi(passaggio);
    const modelliA = modelliAnthropicPer(passaggio, envLetto);
    let modelloA = modelliA[0];
    const limite = nome ? timeoutPer(nome, UPSTREAM_TIMEOUT_MS) : UPSTREAM_TIMEOUT_MS;
    const t0 = Date.now();
    let motivo = '';
    let primoErrore: string | null = null;
    // con piu' modelli in elenco la catena (es. Haiku → Sonnet) e' gia' il nuovo tentativo; con uno solo se ne fanno due
    const tentativiMax = modelliA.length > 1 ? 1 : 2;
    for (let tentativo = 1; tentativo <= tentativiMax; tentativo++) {
      let ripeti = false;
      try {
        const d = await chiamaAnthropicElenco(chiaveAnthropic, modelliA, openAiPayload, limite);
        modelloA = String(d?.model || modelloA);
        if (!rispostaVuota(d)) {
          return json(200, { ...d, _modello: { passaggio: nome, compito, fornitore: 'anthropic', chiesto: modelliA[0], usato: modelloA, ripiego: false, ms: Date.now() - t0, ...(d?._variante ? { ragionamento: d._variante } : {}),
            ...(primoErrore ? { tentativi: 2, primoErrore } : {}) } }, quotaHeaders);
        }
        motivo = `risposta vuota${d?._stop ? ` (${d._stop.stop_reason}; ${d._stop.blocchi.join('+') || 'nessun blocco'})` : ''}`;
      } catch (err) {
        const scaduto = (err as Error)?.name === 'AbortError';
        const credito = err instanceof ErroreAnthropic && err.codice === 'OPENAI_CREDIT_EXHAUSTED';
        motivo = scaduto ? `oltre il tempo massimo (${limite / 1000} s)` : (err instanceof ErroreAnthropic ? err.message : `rete (${scrubLogText(err).slice(0, 40)})`);
        ripeti = !scaduto && !credito;
      }
      if (!ripeti || tentativo === tentativiMax) break;
      primoErrore = motivo;
    }
    infoModello = { passaggio: nome, compito, fornitore: 'openai', fornitoreChiesto: 'anthropic', chiesto: modelliA[0], usato: chiesto, ripiego: true, motivo,
      ...(primoErrore ? { tentativi: 2, primoErrore } : {}), ms: Date.now() - t0 };
    console.warn(`[openai-proxy] ${nome ?? 'contorno'}: ${modelloA} → ripiego su OpenAI ${chiesto} (${scrubLogText(motivo)})`);
  } else if (passaggioValido(passaggio) && !isStreaming && modelloPassaggio !== chiesto && MODELLI_AMMESSI.has(modelloPassaggio)) {
    const t0 = Date.now();
    const limite = timeoutPer(passaggio, UPSTREAM_TIMEOUT_MS);
    let motivo = '';
    // C10b3-bis (decisione di Ivano) — un errore del modello nuovo (HTTP o rete; non il tempo scaduto, non la risposta vuota)
    // ha UN nuovo tentativo prima del ripiego, come nella lista (modelli.ts, chiamaConRipiego).
    let primoErrore: string | null = null;
    for (let tentativo = 1; tentativo <= 2; tentativo++) {
      const c2 = new AbortController();
      const t2 = setTimeout(() => c2.abort(), limite);
      let errore = false;
      try {
        const r = await fetch(`${OPENAI_BASE}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
          body: JSON.stringify(corpoPer(modelloPassaggio, openAiPayload)),
          signal: c2.signal,
        });
        const d = await r.json().catch(() => null);
        if (r.ok && d && !rispostaVuota(d)) {
          clearTimeout(t2);
          return json(200, { ...d, _modello: { passaggio, chiesto: modelloPassaggio, usato: modelloPassaggio, ripiego: false, ms: Date.now() - t0,
            ...(primoErrore ? { tentativi: 2, primoErrore } : {}) } }, quotaHeaders);
        }
        errore = !r.ok;
        motivo = r.ok ? 'risposta vuota' : `HTTP ${r.status} ${plain(d?.error?.code)} ${plain(d?.error?.type)} ${plain(d?.error?.message)}`.slice(0, 120);
      } catch (err) {
        errore = (err as Error)?.name !== 'AbortError';
        motivo = errore ? `rete (${scrubLogText(err).slice(0, 40)})` : `oltre il tempo massimo (${limite / 1000} s)`;
      } finally {
        clearTimeout(t2);
      }
      if (!errore || tentativo === 2) break;
      primoErrore = motivo;
    }
    infoModello = { passaggio, chiesto: modelloPassaggio, usato: chiesto, ripiego: true, motivo, ...(primoErrore ? { tentativi: 2, primoErrore } : {}), ms: Date.now() - t0 };
    console.warn(`[openai-proxy] ${passaggio}: ${modelloPassaggio} → ripiego su ${chiesto} (${motivo})`);
  }

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
    return json(upstream.status, infoModello && data && typeof data === 'object' ? { ...(data as Record<string, unknown>), _modello: infoModello } : data, quotaHeaders);

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
