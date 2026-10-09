// src/services/factsService.js
//
// P3d-e — FATTI APERTI sulle tappe finali.
//
// Il narratore scrive solo cose vere: per ogni tappa FINALE (dopo selezione,
// riparazione e orari — mai sui candidati) si cercano fatti da fonti aperte:
//   1. Wikipedia italiana per coordinate (geosearch entro 100 m), con la
//      descrizione breve di Wikidata che la stessa risposta porta;
//   2. OpenStreetMap via Overpass, UNA sola interrogazione per tutte le tappe;
//      un elemento OSM che rimanda a una voce Wikipedia/Wikidata la porta con sé.
// Abbinamento STRETTO, come nella diagnosi P3d-f: distanza entro 100 m, nome
// (parole significative in comune sul nome PIU' LUNGO, non sul piu' corto: "Gianicolo"
// non e' "Gianicolo Belvedere") e tipo compatibile (una piazza non prende i
// fatti di un lungotevere, un museo quelli di un bar).
//
// Mai contenuti Google qui dentro: niente recensioni, niente riassunti
// editoriali. Solo Wikipedia (CC BY-SA), Wikidata (CC0), OSM (ODbL).
//
// Tetto di FACTS_BUDGET_MS in tutto: oltre, quello che non e' arrivato non c'e'
// e si prosegue senza. Cache per place_id (tabella place_facts, 30 giorni):
// si scrive solo un risultato completo (tutte le fonti hanno risposto).

import { supabase } from '../lib/supabase';

export const FACTS_BUDGET_MS = 4000;
export const FACTS_RADIUS_M = 100;
export const FACTS_TTL_DAYS = 30;
export const FACTS_TABLE = 'place_facts';
export const NAME_MATCH_MIN = 0.6;
export const FACTS_USER_AGENT = 'Unnivai/1.0 (https://unnivai.vercel.app; fatti aperti sulle tappe dei tour)';

const WIKI_API = 'https://it.wikipedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const MAX_FATTI = 5;
const MAX_WIKI_SENTENCES = 3;
const MAX_WIKI_CHARS = 360;

/** Le fonti, con la licenza da mostrare a schermo. */
export const FONTI_INFO = {
    wikipedia: { label: 'Wikipedia', licenza: 'CC BY-SA', home: 'https://it.wikipedia.org' },
    wikidata: { label: 'Wikidata', licenza: 'CC0', home: 'https://www.wikidata.org' },
    osm: { label: '© OpenStreetMap contributors', licenza: 'ODbL', home: 'https://www.openstreetmap.org/copyright' },
};

// ─── Nomi ────────────────────────────────────────────────────────────────────
const normText = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'");
const STOPWORDS = new Set((
    'di del della dei degli delle dello de da dal dalla dai la il lo le gli l a al alla ai alle e ed ' +
    'in nel nella nei con per su sul sulla the of and museo museum musei san santa santo sant s ' +
    'roma catania milano napoli firenze venezia torino palermo bologna genova bari'
).split(' '));

const nameTokens = (s, extraStop = []) => {
    const stop = new Set([...STOPWORDS, ...extraStop.map(normText)]);
    return new Set(normText(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
        .filter(t => t.length > 2 && !stop.has(t)));
};

/**
 * Quanto due nomi sono lo stesso posto: parole significative in comune diviso
 * le parole del nome PIU' LUNGO. 1 = stesse parole; "Gianicolo" contro
 * "Gianicolo Belvedere" = 0,5 (non basta).
 */
export const nameMatchScore = (ours, theirs, city = '') => {
    const extra = city ? [city] : [];
    const a = nameTokens(ours, extra);
    const b = nameTokens(theirs, extra);
    if (a.size === 0 || b.size === 0) return 0;
    let common = 0;
    for (const t of a) if (b.has(t)) common += 1;
    return common / Math.max(a.size, b.size);
};
export const namesMatch = (ours, theirs, city = '') => nameMatchScore(ours, theirs, city) >= NAME_MATCH_MIN;

// ─── Tipi ────────────────────────────────────────────────────────────────────
// Le famiglie di posto, riconosciute dalle parole del nome/descrizione, dai
// types Google della tappa e dai tag OSM. Due posti sono compatibili se hanno
// almeno una famiglia in comune. Una tappa senza famiglia riconosciuta non
// prende fatti: non si puo' verificare che sia lo stesso tipo di posto.
const KIND_WORDS = {
    chiesa: /\b(chies[ae]|basilic[ah]e?|duomo|cattedral[ei]|santuari[oi]|oratori[oi]|cappell[ae]|abbazi[ae]|convent[oi]|monaster[oi]|battister[oi]|sinagog[ae]|moschea)\b/,
    museo: /\b(muse[oi]|musei|galleri[ae]|pinacotec[ae]|collezion[ei]|museal[ei])\b/,
    verde: /\b(giardin[oi]|parc[oh]i?|orto|orti|bosc[oh]i?|riserv[ae]|vill[ae]|pinet[ae]|verde pubblico)\b/,
    piazza: /\b(piazz[ae]|piazzal[ei]|largo|slargo)\b/,
    edificio: /\b(palazz[oi]|castell[oi]|torr[ei]|vill[ae]|teatr[oi]|edifici[oi]?|fortezz[ae]|rocc[ah]e?|bastion[ei]|fortificazion[ei]|mura|port[ae] urbic[ah]e?|faro)\b/,
    monumento: /\b(monument[oi]|statu[ae]|fontan[ae]|obelisc[oh]i?|colonn[ae]|arc[oh]i? (?:di|trionfal)|scultur[ae]|memorial[ei]?)\b/,
    archeologia: /\b(rovin[ae]|rest[io] (?:di|del|della)|term[ae]|for[oi] (?:romano|di)|anfiteatr[oi]|templ[oi]|scavi|necropol[ie]|catacomb[ae]|acquedott[oi]|archeologic[oh]?[ae]?|ipogeo)\b/,
    panorama: /\b(belveder[ei]|terrazz[ae]|panoramic[oa]|punto panoramico|vista)\b/,
    locale: /\b(trattori[ae]|osteri[ae]|hostaria|ristorant[ei]|pizzeri[ae]|bar|caff[ei]|pasticceri[ae]|gelateri[ae]|forno|panifici[oi]|enotec[ae]|bistrot|taverna|friggitori[ae]|rosticceri[ae])\b/,
    mercato: /\b(mercat[oi])\b/,
    strada: /\b(vi[ae]|vicol[oi]|quartier[ei]|rion[ei]|borg[oh]i?|lungotevere|lungomare|strad[ae])\b/,
};
const GOOGLE_TYPE_KINDS = {
    church: 'chiesa', place_of_worship: 'chiesa', synagogue: 'chiesa', mosque: 'chiesa',
    museum: 'museo', art_gallery: 'museo',
    park: 'verde', garden: 'verde', botanical_garden: 'verde', national_park: 'verde',
    restaurant: 'locale', cafe: 'locale', bar: 'locale', bakery: 'locale', meal_takeaway: 'locale',
    meal_delivery: 'locale', food: 'locale', night_club: 'locale', ice_cream_shop: 'locale',
    city_hall: 'edificio', courthouse: 'edificio', library: 'edificio', university: 'edificio',
    historical_landmark: 'monumento', monument: 'monumento',
    market: 'mercato', supermarket: 'mercato',
};
const osmTagKinds = (tags = {}) => {
    const out = new Set();
    const t = (k) => String(tags[k] || '');
    if (/^(place_of_worship|monastery)$/.test(t('amenity')) || /^(church|cathedral|chapel|basilica)$/.test(t('building'))) out.add('chiesa');
    if (/^(museum|gallery)$/.test(t('tourism'))) out.add('museo');
    if (/^(park|garden|nature_reserve)$/.test(t('leisure'))) out.add('verde');
    if (t('place') === 'square' || (t('highway') === 'pedestrian' && /piazz/i.test(t('name')))) out.add('piazza');
    if (/^(castle|palace|fort|city_gate|tower|building|manor|citywalls)$/.test(t('historic')) || t('building') === 'palace') out.add('edificio');
    if (/^(monument|memorial|wayside_shrine)$/.test(t('historic')) || t('amenity') === 'fountain' || t('tourism') === 'artwork') out.add('monumento');
    if (/^(archaeological_site|ruins)$/.test(t('historic'))) out.add('archeologia');
    if (t('tourism') === 'viewpoint') out.add('panorama');
    if (/^(restaurant|cafe|bar|pub|fast_food|ice_cream|biergarten)$/.test(t('amenity')) || /^(bakery|pastry|confectionery|wine)$/.test(t('shop'))) out.add('locale');
    if (t('amenity') === 'marketplace') out.add('mercato');
    return out;
};

const kindsOfText = (text) => {
    const n = normText(text);
    const out = new Set();
    for (const [k, re] of Object.entries(KIND_WORDS)) if (re.test(n)) out.add(k);
    return out;
};

/** Le famiglie di una tappa: parole del nome + types Google. */
export const stopKinds = (stop) => {
    const out = kindsOfText(stop?.name || stop?.title || '');
    for (const t of (Array.isArray(stop?.types) ? stop.types : [])) if (GOOGLE_TYPE_KINDS[t]) out.add(GOOGLE_TYPE_KINDS[t]);
    return out;
};
export const kindsCompatible = (a, b) => [...a].some(k => b.has(k));

/** Una tappa e' un "locale" (si mangia o si beve): ha il suo racconto, fatto di dati. */
export const isLocaleStop = (stop) => {
    const types = Array.isArray(stop?.types) ? stop.types : [];
    return types.some(t => ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery', 'food', 'night_club', 'ice_cream_shop'].includes(t));
};

// ─── Geometria ───────────────────────────────────────────────────────────────
export const distanceM = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const p = Math.PI / 180;
    const x = Math.sin(((lat2 - lat1) * p) / 2) ** 2
        + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(((lng2 - lng1) * p) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
};

// ─── Testo dei fatti ─────────────────────────────────────────────────────────
const cleanWikiText = (s) => String(s || '')
    .replace(/\s*\([^()]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
const sentencesOf = (text) => text.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý"«])/).map(s => s.trim()).filter(Boolean);

/** I primi fatti di una voce Wikipedia: le prime frasi dell'introduzione. */
export const wikipediaFacts = (extract) => {
    const out = [];
    let len = 0;
    for (const s of sentencesOf(cleanWikiText(extract))) {
        if (out.length >= MAX_WIKI_SENTENCES || (out.length > 0 && len + s.length > MAX_WIKI_CHARS)) break;
        out.push(s.length > MAX_WIKI_CHARS ? `${s.slice(0, MAX_WIKI_CHARS - 1).replace(/\s+\S*$/, '')}…` : s);
        len += s.length;
    }
    return out;
};

const CUISINE_IT = {
    italian: 'italiana', regional: 'regionale', pizza: 'pizza', seafood: 'pesce', sicilian: 'siciliana',
    roman: 'romana', vegetarian: 'vegetariana', vegan: 'vegana', coffee_shop: 'caffetteria', ice_cream: 'gelato',
    sandwich: 'panini', fish: 'pesce', mediterranean: 'mediterranea', local: 'locale', pasta: 'pasta',
};
const HISTORIC_IT = {
    archaeological_site: 'sito archeologico', ruins: 'rovine', castle: 'castello', monument: 'monumento',
    memorial: 'memoriale', city_gate: 'porta urbica', fort: 'fortificazione', palace: 'palazzo storico',
    church: 'chiesa storica', building: 'edificio storico', tower: 'torre',
};

/** I fatti di un elemento OSM: solo tag che dicono qualcosa di vero sul posto. */
export const osmFacts = (tags = {}) => {
    const out = [];
    const desc = tags['description:it'] || tags.description;
    if (desc && desc.length <= 300) out.push(desc.trim());
    if (HISTORIC_IT[tags.historic]) out.push(`Tipo di luogo: ${HISTORIC_IT[tags.historic]}.`);
    if (tags.tourism === 'viewpoint') out.push('Punto panoramico.');
    if (tags.tourism === 'artwork' && tags.artwork_type) out.push(`Opera d'arte (${tags.artwork_type}).`);
    if (tags.amenity === 'fountain') out.push('Fontana.');
    if (tags.leisure === 'garden') out.push('Giardino.');
    if (tags.leisure === 'park') out.push('Parco.');
    if (tags.start_date) out.push(`Data indicata: ${tags.start_date}.`);
    if (tags.architect) out.push(`Architetto: ${tags.architect}.`);
    if (tags.artist_name) out.push(`Autore: ${tags.artist_name}.`);
    if (tags.heritage) out.push('Bene sottoposto a tutela.');
    if (tags.cuisine) {
        const c = String(tags.cuisine).split(';').map(x => CUISINE_IT[x.trim()] || x.trim().replace(/_/g, ' ')).filter(Boolean);
        if (c.length) out.push(`Cucina: ${c.join(', ')}.`);
    }
    if (tags.outdoor_seating === 'yes') out.push("Tavoli all'aperto.");
    return out;
};

const wikidataYear = (claims) => {
    const v = claims?.P571?.[0]?.mainsnak?.datavalue?.value?.time;
    const m = typeof v === 'string' ? v.match(/^([+-])0*(\d+)-/) : null;
    if (!m) return null;
    return m[1] === '-' ? `${m[2]} a.C.` : m[2];
};

// ─── Rete ────────────────────────────────────────────────────────────────────
// Nel browser lo User-Agent non si puo' impostare: Wikimedia accetta
// Api-User-Agent (CORS lo permette); Overpass non accetta header in piu' nel
// browser (preflight rifiutato), quindi li' l'identificazione e' l'Origin.
// Fuori dal browser (script, test) si manda il vero User-Agent.
const inRealBrowser = () => typeof window !== 'undefined' && typeof navigator !== 'undefined'
    && !/jsdom|node/i.test(navigator.userAgent || '');
const wikiHeaders = () => ({
    'Api-User-Agent': FACTS_USER_AGENT,
    ...(inRealBrowser() ? {} : { 'User-Agent': FACTS_USER_AGENT }),
});
const overpassHeaders = () => (inRealBrowser() ? {} : { 'User-Agent': FACTS_USER_AGENT });

const getJson = async (fetchImpl, url, init) => {
    const res = await fetchImpl(url, init);
    if (!res || !res.ok) throw new Error(`HTTP ${res?.status ?? '?'}`);
    const j = await res.json();
    // L'API di Wikimedia risponde 200 anche quando rifiuta (es.
    // "cirrussearch-too-busy-error"): e' un errore, non "nessun risultato".
    if (j && j.error) throw new Error(String(j.error.code || j.error.info || 'errore API'));
    return j;
};

// Wikipedia rifiuta le ricerche per coordinate se ne arrivano troppe insieme
// (misurato: 18 in parallelo → "too busy"). Al massimo GEO_CONCURRENCY alla
// volta, e un secondo tentativo per quella rifiutata. Misurato il 09/10: una
// ricerca impiega 1-2,6 s; a gruppi di 3, 5 tappe sforavano i 4 secondi.
const GEO_CONCURRENCY = 6;
const runPool = async (items, size, fn) => {
    let i = 0;
    const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
        while (i < items.length) {
            const item = items[i];
            i += 1;
            await fn(item);
        }
    });
    await Promise.all(workers);
};
const wait = (ms) => new Promise(resolve => { setTimeout(resolve, ms); });

const wikiUrl = (params) => `${WIKI_API}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`;
export const wikipediaPageUrl = (title) => `https://it.wikipedia.org/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;

/** La regex di nome per Overpass: la parola significativa piu' lunga, se e' ASCII. */
const overpassNameFilter = (name, city) => {
    const plain = String(name || '').toLowerCase().replace(/[^a-z0-9àèéìòù' ]/g, ' ');
    const words = plain.split(/\s+/).filter(w => /^[a-z0-9]+$/.test(w) && nameTokens(w, [city]).size > 0);
    const best = words.sort((a, b) => b.length - a.length)[0];
    return best && best.length >= 4 ? `["name"~"${best}",i]` : '[name]';
};

export const buildOverpassQuery = (stops, city = '') => {
    const parts = stops.map(s => `nwr(around:${FACTS_RADIUS_M},${s.lat},${s.lng})${overpassNameFilter(s.name, city)};`);
    return `[out:json][timeout:4];(${parts.join('')});out tags center qt;`;
};

// ─── Cache ───────────────────────────────────────────────────────────────────
const readCache = async (ids, now) => {
    const { data, error } = await supabase.from(FACTS_TABLE).select('place_id,fatti,fonti,data').in('place_id', ids);
    if (error) throw error;
    const fresh = new Map();
    const ttl = FACTS_TTL_DAYS * 86400000;
    for (const row of Array.isArray(data) ? data : []) {
        const t = new Date(row?.data).getTime();
        if (!row?.place_id || !Number.isFinite(t) || now - t > ttl) continue;
        fresh.set(row.place_id, { fatti: Array.isArray(row.fatti) ? row.fatti : [], fonti: Array.isArray(row.fonti) ? row.fonti : [] });
    }
    return fresh;
};

// La scrittura passa solo dalla funzione del database (valida forma, fonti e
// URL, e non sovrascrive una riga fresca): niente INSERT diretti dal client.
const writeCache = async (rows) => {
    if (rows.length === 0) return;
    const { error } = await supabase.rpc('save_place_facts', { p_rows: rows.slice(0, 30) });
    if (error) throw error;
};

// ─── Il lavoro ───────────────────────────────────────────────────────────────
const TIMEOUT = Symbol('timeout');

/**
 * I fatti delle tappe finali.
 * @param {Array<{ place_id: string, name: string, lat: number, lng: number, types?: string[] }>} stops
 * @param {object} [opts]
 * @param {string} [opts.city]
 * @param {number} [opts.budgetMs] tetto in tutto (default 4000)
 * @param {Function} [opts.fetchImpl]
 * @param {boolean} [opts.useCache]
 * @returns {Promise<{ byId: Map<string, { fatti: Array<{ testo: string, fonte: string }>, fonti: Array<{ fonte: string, url: string, titolo?: string }> }>, report: object }>}
 */
export async function fetchFactsForStops(stops, {
    city = '', budgetMs = FACTS_BUDGET_MS, fetchImpl: fetchArg = null, useCache = true,
} = {}) {
    // Ogni richiesta porta il signal del tetto di tempo (AbortController sotto).
    const fetchImpl = fetchArg || globalThis.fetch.bind(globalThis);
    const t0 = Date.now();
    const report = { richieste: 0, daCache: 0, conFatti: 0, timeout: false, ms: 0, errori: [] };
    const byId = new Map();
    const valid = (Array.isArray(stops) ? stops : []).filter(s => s?.place_id && Number.isFinite(s.lat) && Number.isFinite(s.lng));
    const unique = [...new Map(valid.map(s => [s.place_id, s])).values()];
    report.richieste = unique.length;
    if (unique.length === 0) return { byId, report };

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const signal = controller?.signal;
    let timer = null;
    const deadline = new Promise(resolve => { timer = setTimeout(() => resolve(TIMEOUT), budgetMs); });

    // Lo stato si riempie man mano: allo scadere si usa quello che c'e'.
    // Due catene indipendenti, cosi' un Overpass lento non ferma Wikipedia:
    //   A. Wikipedia: ricerche per coordinate, GEO_CONCURRENCY alla volta; il
    //      testo della voce abbinata si chiede SUBITO, tappa per tappa;
    //   B. Overpass (una richiesta per tutte); le voci Wikipedia e le entita'
    //      Wikidata a cui rimanda un elemento abbinato si chiedono appena arriva.
    const state = {
        geo: new Map(), geoOk: new Set(), osm: null, osmMatch: new Map(),
        pages: new Map(), titleStatus: new Map(), entities: new Map(),
    };
    const textJobs = [];

    const fetchPages = (titles) => {
        const nuovi = [...new Set(titles)].filter(t => !state.titleStatus.has(t));
        for (let i = 0; i < nuovi.length; i += 20) {
            const chunk = nuovi.slice(i, i + 20);
            chunk.forEach(t => state.titleStatus.set(t, 'pending'));
            textJobs.push(getJson(fetchImpl, wikiUrl({
                action: 'query', prop: 'extracts|description|pageprops', exintro: '1', explaintext: '1',
                exlimit: 'max', redirects: '1', titles: chunk.join('|'),
            }), { headers: wikiHeaders(), signal }).then(j => {
                const redirects = new Map((j?.query?.redirects || []).map(r => [r.to, r.from]));
                const normalized = new Map((j?.query?.normalized || []).map(r => [r.to, r.from]));
                for (const pg of j?.query?.pages || []) {
                    if (pg?.missing || !pg?.title) continue;
                    state.pages.set(pg.title, pg);
                    const from = redirects.get(pg.title);
                    if (from) state.pages.set(from, pg);
                    const nf = normalized.get(from || pg.title);
                    if (nf) state.pages.set(nf, pg);
                }
                chunk.forEach(t => state.titleStatus.set(t, 'ok'));
            }).catch(e => {
                chunk.forEach(t => state.titleStatus.set(t, 'err'));
                report.errori.push(`wikipedia testi: ${e?.message || e}`);
            }));
        }
    };
    const geoTitles = (s) => (state.geo.get(s.place_id) || [])
        .filter(pg => namesMatch(s.name, pg.title, city))
        .sort((x, y) => nameMatchScore(s.name, y.title, city) - nameMatchScore(s.name, x.title, city) || x.dist - y.dist)
        .slice(0, 2)
        .map(pg => pg.title);
    const linkedTitle = (s) => {
        const tags = state.osmMatch.get(s.place_id)?.tags || {};
        const t = /^it:/.test(tags.wikipedia || '') ? tags.wikipedia.slice(3) : null;
        return t && namesMatch(s.name, t, city) ? t : null;
    };
    const titlesFor = (s) => [...new Set([...geoTitles(s), linkedTitle(s)].filter(Boolean))];

    const geosearchOne = async (s) => {
        const url = wikiUrl({
            action: 'query', list: 'geosearch', gscoord: `${s.lat}|${s.lng}`, gsradius: String(FACTS_RADIUS_M), gslimit: '30',
        });
        for (let tentativo = 0; tentativo < 2; tentativo += 1) {
            try {
                const j = await getJson(fetchImpl, url, { headers: wikiHeaders(), signal });
                state.geo.set(s.place_id, Array.isArray(j?.query?.geosearch) ? j.query.geosearch : []);
                state.geoOk.add(s.place_id);
                return;
            } catch (e) {
                // Si riprova solo il rifiuto per carico ("too busy", 429, 503).
                const occupato = /busy|HTTP 429|HTTP 503/i.test(String(e?.message || e));
                if (signal?.aborted || tentativo === 1 || !occupato) { report.errori.push(`wikipedia geosearch: ${e?.message || e}`); return; }
                await wait(250);
            }
        }
    };

    const work = async () => {
        let todo = unique;
        if (useCache) {
            try {
                const cached = await readCache(unique.map(s => s.place_id), Date.now());
                for (const [id, v] of cached) byId.set(id, v);
                report.daCache = cached.size;
                todo = unique.filter(s => !cached.has(s.place_id));
            } catch (e) {
                report.errori.push(`cache: ${e?.message || e}`);
            }
        }
        state.todo = todo;
        if (todo.length === 0) return;

        // Ogni tappa chiede il testo della sua voce appena la sua ricerca
        // risponde: una ricerca lenta non trattiene le altre.
        const chainWiki = runPool(todo, GEO_CONCURRENCY, async (st) => {
            if (signal?.aborted) return;
            await geosearchOne(st);
            fetchPages(geoTitles(st));
        });

        const chainOsm = (async () => {
            try {
                const j = await getJson(fetchImpl, OVERPASS_URL, {
                    method: 'POST', headers: overpassHeaders(), signal,
                    body: new URLSearchParams({ data: buildOverpassQuery(todo, city) }),
                });
                state.osm = Array.isArray(j?.elements) ? j.elements : [];
            } catch (e) {
                report.errori.push(`overpass: ${e?.message || e}`);
                return;
            }
            // Abbinamenti OSM (nome, distanza, tipo).
            for (const s of todo) {
                const sk = stopKinds(s);
                const best = state.osm
                    .map(el => {
                        const tags = el?.tags || {};
                        const lat = el.lat ?? el.center?.lat;
                        const lng = el.lon ?? el.center?.lon;
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                        if (distanceM(s.lat, s.lng, lat, lng) > FACTS_RADIUS_M) return null;
                        const score = nameMatchScore(s.name, tags.name, city);
                        if (score < NAME_MATCH_MIN) return null;
                        const ek = new Set([...kindsOfText(tags.name), ...osmTagKinds(tags)]);
                        if (!kindsCompatible(sk, ek)) return null;
                        return { el, score };
                    })
                    .filter(Boolean)
                    .sort((x, y) => y.score - x.score)[0];
                if (best) state.osmMatch.set(s.place_id, best.el);
            }
            fetchPages(todo.map(linkedTitle).filter(Boolean));
            const qids = [...new Set(todo
                .map(s => state.osmMatch.get(s.place_id)?.tags)
                .filter(tags => tags && !tags.wikipedia && /^Q\d+$/.test(tags.wikidata || ''))
                .map(tags => tags.wikidata))];
            if (qids.length > 0) {
                textJobs.push(getJson(fetchImpl, `${WIKIDATA_API}?${new URLSearchParams({
                    action: 'wbgetentities', ids: qids.slice(0, 50).join('|'), props: 'labels|descriptions|claims',
                    languages: 'it', format: 'json', origin: '*',
                })}`, { headers: wikiHeaders(), signal }).then(j => {
                    for (const [id, e] of Object.entries(j?.entities || {})) state.entities.set(id, e);
                }).catch(e => report.errori.push(`wikidata: ${e?.message || e}`)));
            }
        })();

        await Promise.all([chainWiki, chainOsm]);
        // I testi chiesti per ultimi (textJobs cresce mentre le catene girano).
        await Promise.allSettled(textJobs);
    };

    let outcome;
    try {
        outcome = await Promise.race([work().catch(e => { report.errori.push(String(e?.message || e)); }), deadline]);
    } finally {
        clearTimeout(timer);
    }
    if (outcome === TIMEOUT) {
        report.timeout = true;
        try { controller?.abort(); } catch { /* niente */ }
    }

    // Assemblaggio: per ogni tappa da cercare, i fatti arrivati in tempo.
    const toCache = [];
    for (const s of state.todo || []) {
        const fatti = [];
        const fonti = [];
        const sk = stopKinds(s);
        const titoli = titlesFor(s);
        for (const title of titoli) {
            const p = state.pages.get(title);
            if (!p) continue;
            const pk = new Set([...kindsOfText(p.title), ...kindsOfText(p.description || '')]);
            if (!kindsCompatible(sk, pk)) continue;
            const frasi = wikipediaFacts(p.extract || '');
            if (frasi.length === 0 && !p.description) continue;
            for (const f of frasi) fatti.push({ testo: f, fonte: 'wikipedia' });
            if (p.description) fatti.push({ testo: `${p.title}: ${p.description}.`, fonte: p.descriptionsource === 'local' ? 'wikipedia' : 'wikidata' });
            fonti.push({ fonte: 'wikipedia', url: wikipediaPageUrl(p.title), titolo: p.title });
            break; // una voce sola per tappa
        }
        const el = state.osmMatch?.get(s.place_id);
        const qid = el?.tags?.wikidata;
        if (fatti.length === 0 && qid && state.entities.has(qid)) {
            const e = state.entities.get(qid);
            const label = e?.labels?.it?.value || '';
            const desc = e?.descriptions?.it?.value || '';
            const ek = new Set([...kindsOfText(label), ...kindsOfText(desc)]);
            if (namesMatch(s.name, label, city) && kindsCompatible(sk, ek)) {
                if (desc) fatti.push({ testo: `${label}: ${desc}.`, fonte: 'wikidata' });
                const year = wikidataYear(e?.claims);
                if (year) fatti.push({ testo: `Fondazione o costruzione: ${year}.`, fonte: 'wikidata' });
                if (desc || year) fonti.push({ fonte: 'wikidata', url: `https://www.wikidata.org/wiki/${qid}`, titolo: label });
            }
        }
        if (el) {
            const of = osmFacts(el.tags).filter(t => !fatti.some(f => f.testo === t));
            for (const t of of) fatti.push({ testo: t, fonte: 'osm' });
            if (of.length > 0) fonti.push({ fonte: 'osm', url: `https://www.openstreetmap.org/${el.type}/${el.id}`, titolo: el.tags?.name });
        }
        const entry = { fatti: fatti.slice(0, MAX_FATTI), fonti };
        byId.set(s.place_id, entry);
        // In cache solo un risultato completo per Wikipedia (ricerca fatta e
        // testi delle voci arrivati). OpenStreetMap e' il complemento: se ha
        // risposto c'e', se no la riga si scrive lo stesso (Overpass cade
        // spesso: senza questa regola la cache non si scriverebbe quasi mai).
        const completo = state.geoOk.has(s.place_id) && titoli.every(t => state.titleStatus.get(t) === 'ok');
        if (completo) toCache.push({ place_id: s.place_id, fatti: entry.fatti, fonti: entry.fonti });
    }
    report.conFatti = [...byId.values()].filter(v => v.fatti.length > 0).length;
    report.ms = Date.now() - t0;
    if (useCache && toCache.length > 0) {
        writeCache(toCache).catch(e => console.warn(`[P3d-e FATTI] cache non scritta: ${e?.message || e}`));
    }
    console.info(`[P3d-e FATTI] ${city}: ${report.conFatti}/${report.richieste} tappe con fatti (${report.daCache} da cache) in ${report.ms} ms` +
        (report.timeout ? `, oltre ${budgetMs} ms: si prosegue con quello che c'e'` : '') +
        (report.errori.length ? `, errori: ${report.errori.slice(0, 3).join(' | ')}` : ''));
    return { byId, report };
}

/** Le fonti di una tappa, per la riga a schermo (stessa forma della cache). */
export const fontiLabel = (fonti) => {
    const seen = new Set((Array.isArray(fonti) ? fonti : []).map(f => f?.fonte));
    return ['wikipedia', 'wikidata', 'osm'].filter(k => seen.has(k));
};
