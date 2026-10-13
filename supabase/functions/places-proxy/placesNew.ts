/**
 * MIG-PLACES — ricerca dei posti sull'API Google nuova (Places API (New), Text
 * Search), dietro l'interruttore PLACES_SEARCH del proxy.
 *
 * Modulo PURO: nessun import Deno, nessuna rete. Lo importa index.ts (Deno) e lo
 * provano i test di vitest (src/__tests__/services/placesNew.test.js).
 *
 * Il proxy parla ancora la forma LEGACY verso il client: la risposta nuova viene
 * trasformata qui nella forma della textsearch legacy (stessi campi che il motore
 * legge: place_id, name, geometry.location, photos[0].photo_reference, types,
 * rating, user_ratings_total, price_level, business_status, opening_hours.open_now,
 * formatted_address) piu' tre campi nuovi: opening_hours.periods (nel formato
 * legacy di place/details: day 0 = domenica, time 'HHmm'), primary_type e
 * utc_offset_minutes. Con l'interruttore su "legacy" questo file non viene mai
 * toccato: la strada legacy di index.ts e' quella di prima.
 */

// ─── Interruttore ───────────────────────────────────────────────────────────
export type Engine = 'new' | 'legacy';

/**
 * Quale API per QUESTA richiesta.
 *  - envMode: la variabile PLACES_SEARCH del proxy ('new' | 'legacy'; altro/assente = legacy).
 *  - requested: il parametro `engine` della richiesta. Conta SOLO se isTestAccount
 *    (il JWT e' dell'account di prova): per chiunque altro e' ignorato, cosi' la
 *    produzione resta su envMode qualunque cosa mandi un client.
 */
export function chooseEngine(
  { envMode, requested, isTestAccount }: { envMode?: string | null; requested?: string | null; isTestAccount?: boolean },
): Engine {
  if (isTestAccount && (requested === 'new' || requested === 'legacy')) return requested;
  return envMode === 'new' ? 'new' : 'legacy';
}

// ─── Campi richiesti e fasce di prezzo (SKU, Text Search New) ───────────────
// Il tetto e' la fascia di regularOpeningHours (Enterprise): nessun campo sopra.
// ORARI-FESTIVI — anche currentOpeningHours e' Text Search Enterprise (doc Google letta il
// 13/10/2026: stesso elenco di rating, priceLevel, regularOpeningHours): il prezzo non cambia.
export const NEW_FIELDS: Array<{ field: string; sku: 'Essentials IDs Only' | 'Pro' | 'Enterprise' }> = [
  { field: 'places.id', sku: 'Essentials IDs Only' },
  { field: 'places.displayName', sku: 'Pro' },
  { field: 'places.formattedAddress', sku: 'Pro' },
  { field: 'places.location', sku: 'Pro' },
  { field: 'places.types', sku: 'Pro' },
  { field: 'places.primaryType', sku: 'Pro' },
  { field: 'places.businessStatus', sku: 'Pro' },
  { field: 'places.photos', sku: 'Pro' },
  { field: 'places.utcOffsetMinutes', sku: 'Pro' },
  { field: 'places.rating', sku: 'Enterprise' },
  { field: 'places.userRatingCount', sku: 'Enterprise' },
  { field: 'places.priceLevel', sku: 'Enterprise' },
  { field: 'places.regularOpeningHours', sku: 'Enterprise' },
  { field: 'places.currentOpeningHours', sku: 'Enterprise' },
];
export const NEW_FIELD_MASK = NEW_FIELDS.map((f) => f.field).join(',');

// ─── Cache ──────────────────────────────────────────────────────────────────
// Versione propria della ricerca nuova + impronta della maschera: una risposta
// nuova non si mescola mai con una legacy (le chiavi legacy non hanno "new"),
// e cambiare la maschera invalida le voci vecchie. Stessa durata (24h) in index.ts.
// ORARI-FESTIVI: new1 -> new2 (la maschera ha un campo in piu': le risposte vecchie non hanno gli orari del giorno).
export const NEW_CACHE_VERSION = 'new2';
const fingerprint = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
};
export function newCacheKey(cacheVersion: string, path: string, params: URLSearchParams): string {
  const entries: Array<[string, string]> = [];
  for (const [k, v] of params.entries()) {
    if (k === 'path' || k === 'key' || k === 'engine') continue;
    entries.push([k, v]);
  }
  entries.sort(([a], [b]) => a.localeCompare(b));
  const qs = entries.map(([k, v]) => `${k}=${v}`).join('&');
  return `${cacheVersion}:${NEW_CACHE_VERSION}-${fingerprint(NEW_FIELD_MASK)}:${path}:${qs}`;
}

// ─── Richiesta ──────────────────────────────────────────────────────────────
export const NEW_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
export const NEW_MEDIA_BASE = 'https://places.googleapis.com/v1';
const MAX_BIAS_RADIUS_M = 50000; // limite dell'API nuova per locationBias.circle

/** I parametri legacy della textsearch (query, location "lat,lng", radius, language) → corpo della ricerca nuova. */
export function buildNewSearchBody(params: URLSearchParams) {
  const body: Record<string, unknown> = {
    textQuery: params.get('query') || '',
    languageCode: params.get('language') || 'it',
    pageSize: 20, // come la legacy: al massimo 20 risultati
  };
  const loc = (params.get('location') || '').split(',').map(Number);
  const radius = Number(params.get('radius'));
  if (loc.length === 2 && Number.isFinite(loc[0]) && Number.isFinite(loc[1])) {
    body.locationBias = {
      circle: {
        center: { latitude: loc[0], longitude: loc[1] },
        // il bias e' un suggerimento: oltre il massimo dell'API si taglia al massimo
        radius: Number.isFinite(radius) && radius > 0 ? Math.min(radius, MAX_BIAS_RADIUS_M) : MAX_BIAS_RADIUS_M,
      },
    };
  }
  return body;
}

// ─── Normalizzazione: risposta nuova → forma legacy ─────────────────────────
const PRICE_LEVEL: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};
const hhmm = (p: { hour?: number; minute?: number } | undefined) =>
  `${String(p?.hour ?? 0).padStart(2, '0')}${String(p?.minute ?? 0).padStart(2, '0')}`;

type NewPeriodPoint = { day?: number; hour?: number; minute?: number };
/** periods nuovi ({day,hour,minute}) → formato legacy ({day,time:'HHmm'}). Sempre aperto = un periodo senza `close`. */
export function normalizePeriods(periods: Array<{ open?: NewPeriodPoint; close?: NewPeriodPoint }> | undefined) {
  if (!Array.isArray(periods) || periods.length === 0) return null;
  const out = periods
    .filter((p) => p && p.open && Number.isFinite(p.open.day))
    .map((p) => ({
      open: { day: p.open!.day, time: hhmm(p.open) },
      ...(p.close && Number.isFinite(p.close.day) ? { close: { day: p.close.day, time: hhmm(p.close) } } : {}),
    }));
  return out.length ? out : null;
}

// ─── Orari del giorno (currentOpeningHours) ─────────────────────────────────
// Google li da' per i prossimi 7 giorni (oggi + 6, dalla mezzanotte della data
// della richiesta nel fuso del posto) e ci mette gia' le eccezioni (festivi, ferie):
// un giorno CHIUSO e' un giorno senza periodi. Ogni periodo porta la sua data.
type NewDate = { year?: number; month?: number; day?: number };
const ymd = (d: NewDate | undefined) =>
  d && Number.isFinite(d.year) && Number.isFinite(d.month) && Number.isFinite(d.day)
    ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
    : null;
const addDays = (iso: string, n: number) => {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
/** La data di oggi nel fuso del posto (utcOffsetMinutes), come "YYYY-MM-DD". */
export function localDateOf(nowMs: number, utcOffsetMinutes: number | undefined): string {
  const off = Number.isFinite(utcOffsetMinutes) ? (utcOffsetMinutes as number) : 0;
  return new Date(nowMs + off * 60000).toISOString().slice(0, 10);
}
/**
 * currentOpeningHours → { from, to, periods: [{ date, open: 'HHmm', close: 'HHmm'|null, close_date }], special_days: ['YYYY-MM-DD'] }.
 * `from`/`to` = i 7 giorni coperti (oggi nel fuso del posto + 6): un giorno della finestra senza
 * periodi e' chiuso tutto il giorno. Senza periodi (o senza date) = nessun dato: null, vale la settimana.
 */
export function normalizeCurrentHours(c: any, nowMs: number, utcOffsetMinutes?: number) {
  const raw = Array.isArray(c?.periods) ? c.periods : [];
  const periods = raw
    .map((p: any) => ({ date: ymd(p?.open?.date), open: hhmm(p?.open), close: p?.close ? hhmm(p.close) : null, close_date: ymd(p?.close?.date) }))
    .filter((p: any) => p.date);
  if (periods.length === 0) return null;
  let from = localDateOf(nowMs, utcOffsetMinutes);
  const minDate = periods.reduce((m: string, p: any) => (p.date < m ? p.date : m), periods[0].date);
  if (minDate < from) from = minDate; // la data del posto non puo' stare dopo un suo periodo
  const special = (Array.isArray(c?.specialDays) ? c.specialDays : []).map((d: any) => ymd(d?.date)).filter(Boolean);
  return {
    from,
    to: addDays(from, 6),
    periods: periods.map((p: any) => ({ date: p.date, open: p.open, close: p.close, ...(p.close_date && p.close_date !== p.date ? { close_date: p.close_date } : {}) })),
    ...(special.length ? { special_days: special } : {}),
  };
}

/** Un posto della risposta nuova → un risultato nella forma della textsearch legacy (+ i tre campi nuovi). */
export function normalizeNewPlace(p: any, nowMs: number = Date.now()) {
  const periods = normalizePeriods(p?.regularOpeningHours?.periods);
  const photoName = p?.photos?.[0]?.name;
  const price = PRICE_LEVEL[p?.priceLevel];
  const out: Record<string, unknown> = {
    place_id: p.id,
    name: p?.displayName?.text,
    formatted_address: p?.formattedAddress,
    geometry: { location: { lat: p?.location?.latitude, lng: p?.location?.longitude } },
    types: Array.isArray(p?.types) ? p.types : [],
    business_status: p?.businessStatus,
  };
  if (Number.isFinite(p?.rating)) out.rating = p.rating;
  if (Number.isFinite(p?.userRatingCount)) out.user_ratings_total = p.userRatingCount;
  if (price !== undefined) out.price_level = price;
  // La foto: il riferimento nuovo e' "places/<id>/photos/<token>"; il proxy lo
  // riconosce (index.ts) e lo serve dal servizio foto nuovo.
  if (photoName) out.photos = [{ photo_reference: photoName }];
  const openNow = p?.regularOpeningHours?.openNow;
  if (periods || typeof openNow === 'boolean') {
    out.opening_hours = { ...(typeof openNow === 'boolean' ? { open_now: openNow } : {}), ...(periods ? { periods } : {}) };
  }
  const current = normalizeCurrentHours(p?.currentOpeningHours, nowMs, p?.utcOffsetMinutes);
  if (current) out.current_opening_hours = current;
  if (p?.primaryType) out.primary_type = p.primaryType;
  if (Number.isFinite(p?.utcOffsetMinutes)) out.utc_offset_minutes = p.utcOffsetMinutes;
  return out;
}

/** Risposta intera: `{}` (nessun posto) = ZERO_RESULTS, come la legacy. */
export function normalizeNewResponse(data: any, nowMs: number = Date.now()) {
  const places = Array.isArray(data?.places) ? data.places : [];
  if (places.length === 0) return { status: 'ZERO_RESULTS', results: [] };
  return { status: 'OK', results: places.filter((p: any) => p?.id).map((p: any) => normalizeNewPlace(p, nowMs)) };
}

// ─── Foto ───────────────────────────────────────────────────────────────────
/** Un riferimento foto nuovo ("places/…/photos/…") non e' un photo_reference legacy. */
export const isNewPhotoRef = (ref: string | null | undefined) => typeof ref === 'string' && ref.startsWith('places/') && ref.includes('/photos/');

export function newMediaUrl(ref: string, maxwidth: string | null, key: string): string {
  const w = Math.min(Math.max(parseInt(maxwidth || '600', 10) || 600, 1), 4800);
  return `${NEW_MEDIA_BASE}/${ref}/media?maxWidthPx=${w}&key=${encodeURIComponent(key)}`;
}
