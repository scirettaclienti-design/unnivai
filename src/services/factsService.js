// src/services/factsService.js
//
// P3d-e — FATTI APERTI sulle tappe finali.
//
// Il narratore scrive solo cose vere: per ogni tappa FINALE (dopo selezione,
// riparazione e orari — mai sui candidati) si cercano fatti da fonti aperte.
// Mai contenuti Google: niente recensioni, niente riassunti editoriali. Solo
// Wikipedia (CC BY-SA), Wikidata (CC0), OSM (ODbL).
//
// P3d-h — FATTI PIU' TROVABILI. Con il solo "geosearch entro 100 m" le tappe
// delle prove P3d-e avevano fatti 2 volte su 18. Ora l'aggancio va in tre modi,
// in quest'ordine di fiducia:
//   1. OSM ESATTO — l'elemento OSM della tappa (stesso nome, nel raggio del
//      tipo, tipo compatibile) porta i tag wikipedia/wikidata: quella e' la voce,
//      senza altri confronti di nome. Stessa, unica interrogazione Overpass.
//   2. RICERCA PER NOME — Wikipedia italiana per "nome + citta'"; la voce si
//      accetta solo se il nome torna e le sue coordinate stanno nel raggio del
//      tipo (una richiesta sola, che porta anche coordinate e testo).
//   3. COORDINATE — geosearch nel raggio del tipo, sempre con abbinamento del
//      nome; solo se la ricerca per nome non ha trovato niente.
// Raggi per tipo: monumento/chiesa/museo 200 m, piazza/belvedere/porta 300 m,
// parco/villa/colle 800 m. Nomi normalizzati: via "Ingresso di", "Belvedere",
// "Terrazza"; accenti; j→i (Pamphilj/Pamphili); radice delle parole
// (Tarpeo/Tarpea). Un fatto sbagliato e' peggio di nessun fatto: un aggancio
// dubbio si scarta (disambiguazioni, zone urbanistiche, famiglie, persone,
// voci senza coordinate o fuori raggio, tipo incompatibile).
// Locali e ristoranti: nessun fatto (decisione G): il loro racconto e' fatto
// dei dati della scelta (fascia, minuti, motivo).
//
// Tetto di FACTS_BUDGET_MS in tutto: oltre, quello che non e' arrivato non c'e'
// e si prosegue senza. Cache per place_id (tabella place_facts, 30 giorni): si
// scrivono solo righe CON fatti, e una riga senza fatti non ferma una nuova
// ricerca.

import { supabase } from '../lib/supabase';

export const FACTS_BUDGET_MS = 4000;
// P3d-h — Overpass e' la richiesta piu' lenta (misurato il 09/10: 3-15 s, spesso
// oltre i 4 s del tetto). Allo scadere la generazione NON lo aspetta; la sua
// richiesta pero' continua in sottofondo fino a questo limite, e i fatti che
// porta (agganci esatti OSM) vanno in cache per la visita successiva.
export const OSM_BACKGROUND_MS = 20000;
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
// P3d-h — parole che non fanno il nome del posto: "Ingresso di Villa Pamphili"
// e' Villa Pamphili, "Gianicolo Belvedere" e "Terrazza del Pincio" sono il
// Gianicolo e il Pincio. Se il nome resta vuoto, vale il nome intero.
const PAROLE_DI_ACCESSO = /\b(?:ingresso(?:\s+principale)?\s+(?:di|del|della|dello|dei|degli|delle|al|alla|allo)?|belvedere|terrazza(?:\s+panoramica)?|panoramic[oa]|punto\s+panoramico)\b/g;
// Le parole in piu' ammesse quando il nostro nome sta tutto dentro l'altro:
// solo alture ("Tarpeo" e' la "Rupe Tarpea", non un "Palazzo Tarpeo").
const ALTURE = new Set(['rupe', 'colle', 'coll', 'colli', 'monte', 'mont', 'collina', 'collin', 'poggio', 'poggi']);

/** Il nome senza le parole di accesso (e, nei titoli, senza la disambiguazione tra parentesi). */
export const coreName = (s) => {
    const base = normText(s).replace(/\([^)]*\)/g, ' ');
    const core = base.replace(PAROLE_DI_ACCESSO, ' ').replace(/\s+/g, ' ').trim();
    return nameTokens(core).size > 0 ? core : base.trim();
};

// Radice: accenti via, j→i (Pamphilj = Pamphili), vocale finale via sulle
// parole lunghe (Tarpeo = Tarpea, Gianicolo = gianicol).
const stem = (t) => {
    const x = t.replace(/j/g, 'i');
    return x.length >= 5 ? x.replace(/[aeiou]$/, '') : x;
};
const nameTokens = (s, extraStop = []) => {
    const stop = new Set([...STOPWORDS, ...extraStop.map(normText)]);
    return new Set(normText(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
        .filter(t => t.length > 2 && !stop.has(t))
        .map(stem));
};

// "Belvedere del Salviati · Terrazza Panoramica Passeggiata del Gianicolo": due
// nomi in uno. Vale solo il PRIMO: abbinare sul secondo ("Passeggiata del
// Gianicolo") dava al belvedere i fatti del parco intorno (verificato a mano,
// P3d-h): aggancio dubbio, scartato.
const nameVariants = (s) => [String(s || '').split(/\s[·|]\s/)[0]].map(coreName).filter(Boolean);

/** Il testo da cercare: il primo nome, senza parole di accesso, con le sue maiuscole. */
export const searchText = (name, city = '') => {
    const primo = String(name || '').split(/\s[·|]\s/)[0];
    const pulito = primo.replace(new RegExp(PAROLE_DI_ACCESSO.source, 'gi'), ' ').replace(/\s+/g, ' ').trim();
    return `${nameTokens(pulito).size > 0 ? pulito : primo.trim()} ${city}`.trim();
};

/**
 * Quanto due nomi sono lo stesso posto: parole significative in comune diviso
 * le parole del nome PIU' LUNGO (dopo coreName e radice). In piu' (P3d-h): se
 * tutte le nostre parole stanno nell'altro nome e quelle in piu' sono un'altura
 * ("Tarpeo" → "Rupe Tarpea"), e' lo stesso posto.
 */
export const nameMatchScore = (ours, theirs, city = '') => {
    const extra = city ? [city] : [];
    const b = nameTokens(coreName(theirs), extra);
    let best = 0;
    for (const v of nameVariants(ours)) {
        const a = nameTokens(v, extra);
        if (a.size === 0 || b.size === 0) continue;
        let common = 0;
        for (const t of a) if (b.has(t)) common += 1;
        let score = common / Math.max(a.size, b.size);
        if (common === a.size && [...b].filter(t => !a.has(t)).every(t => ALTURE.has(t))) score = 1;
        if (score > best) best = score;
    }
    return best;
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
    strada: /\b(vi[ae]|vicol[oi]|quartier[ei]|rion[ei]|borg[oh]i?|lungotevere|lungomare|strad[ae]|passeggiat[ae])\b/,
    // P3d-h
    porta: /\b(port[ae])\b/,
    altura: /\b(coll[ei]|colli|collin[ae]|monte|rupe|altur[ae]|poggio)\b/,
};

// P3d-h — famiglie diverse ma dello stesso luogo: un belvedere sta su un colle,
// in un parco o su una piazza; un parco su un colle; una galleria in un palazzo.
const KIND_AFFINI = {
    panorama: ['altura', 'verde', 'piazza'],
    altura: ['panorama', 'verde'],
    verde: ['altura', 'panorama'],
    piazza: ['panorama'],
    museo: ['edificio'],
    edificio: ['museo'],
};

// P3d-h — il raggio entro cui una voce puo' essere la tappa, per tipo.
const RAGGIO_PER_TIPO = {
    monumento: 200, chiesa: 200, museo: 200, edificio: 200, archeologia: 200, mercato: 200,
    piazza: 300, panorama: 300, porta: 300, strada: 300,
    verde: 800, altura: 800,
};
const RAGGIO_MINIMO = 200;
/** Il raggio per un insieme di famiglie: il piu' largo (una villa e' grande anche se e' un museo). */
export const radiusForKinds = (kinds) => Math.max(RAGGIO_MINIMO, ...[...(kinds || [])].map(k => RAGGIO_PER_TIPO[k] || 0));

// Voci che non sono mai il posto di una tappa: un aggancio dubbio si scarta.
const VOCE_NON_LUOGO = /disambiguazione|zona urbanistica|suddivisione|quartiere di|frazione|comune italiano|famiglia|lista di|progetto wikimedia|attore|attrice|giornalista|compositore|calciatore|politico|pittore|scrittore|personaggio|dipinto|battaglia|squadra|club|rete televisiva/;
export const isNonPlaceDescription = (desc) => VOCE_NON_LUOGO.test(normText(desc || ''));
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
export const kindsCompatible = (a, b) => [...a].some(k => b.has(k) || (KIND_AFFINI[k] || []).some(x => b.has(x)));

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
    if (tags.place === 'square') out.push('Piazza.');
    for (const k of ['loc_name', 'alt_name', 'old_name']) {
        if (tags[k] && tags[k] !== tags.name && tags[k].length <= 120) out.push(`${k === 'old_name' ? 'Nome storico' : 'Chiamata anche'}: ${tags[k]}.`);
    }
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

/**
 * La regex di nome per Overpass: la radice piu' lunga del nome (senza parole di
 * accesso), cosi' "Villa Pamphili" trova "Villa Doria Pamphilj" ("pamphil").
 */
const overpassNameFilter = (name, city) => {
    const radici = [...nameTokens(nameVariants(name)[0] || name, [city])].filter(t => /^[a-z0-9]+$/.test(t));
    const best = radici.sort((x, y) => y.length - x.length)[0];
    return best && best.length >= 4 ? `["name"~"${best}",i]` : '[name]';
};

/** UNA interrogazione per tutte le tappe, ognuna con il raggio del suo tipo. */
export const buildOverpassQuery = (stops, city = '') => {
    const parts = stops.map(s => `nwr(around:${radiusForKinds(stopKinds(s))},${s.lat},${s.lng})${overpassNameFilter(s.name, city)};`);
    // [timeout] lato server = OSM_BACKGROUND_MS: con 4 s Overpass uccideva la
    // query anche quando la si lascia finire in sottofondo (misurato, P3d-h).
    // Il tetto della generazione resta quello del client (FACTS_BUDGET_MS).
    return `[out:json][timeout:${Math.round(OSM_BACKGROUND_MS / 1000)}];(${parts.join('')});out tags bb qt;`;
};

/** Distanza da un punto a un elemento OSM: al nodo, o al riquadro (0 se dentro). */
const distanceToElement = (lat, lng, el) => {
    if (Number.isFinite(el?.lat) && Number.isFinite(el?.lon)) return distanceM(lat, lng, el.lat, el.lon);
    const bb = el?.bounds;
    if (!bb) return Infinity;
    const cl = Math.min(Math.max(lat, bb.minlat), bb.maxlat);
    const cg = Math.min(Math.max(lng, bb.minlon), bb.maxlon);
    return distanceM(lat, lng, cl, cg);
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
        // P3d-h — una riga senza fatti non ferma una nuova ricerca.
        if (!Array.isArray(row.fatti) || row.fatti.length === 0) continue;
        fresh.set(row.place_id, { fatti: row.fatti, fonti: Array.isArray(row.fonti) ? row.fonti : [], aggancio: { metodo: 'cache' } });
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
 * La voce Wikipedia e' accettabile come la tappa? Nome, tipo, coordinate nel
 * raggio, e non una voce che non e' un luogo. Esportata per i test.
 * @returns {{ ok: boolean, motivo?: string, distanza?: number }}
 */
export const acceptArticle = (stop, page, { city = '', needCoords = true } = {}) => {
    if (!page?.title || page.missing) return { ok: false, motivo: 'voce mancante' };
    if (isNonPlaceDescription(page.description)) return { ok: false, motivo: `non e' un luogo (${page.description})` };
    if (!namesMatch(stop.name, page.title, city)) return { ok: false, motivo: 'nome diverso' };
    const sk = stopKinds(stop);
    const pk = new Set([...kindsOfText(page.title), ...kindsOfText(page.description || '')]);
    if (!kindsCompatible(sk, pk)) return { ok: false, motivo: 'tipo diverso' };
    const c = Array.isArray(page.coordinates) ? page.coordinates[0] : null;
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lon)) {
        return needCoords ? { ok: false, motivo: 'senza coordinate' } : { ok: true };
    }
    const d = distanceM(stop.lat, stop.lng, c.lat, c.lon);
    const r = Math.max(radiusForKinds(sk), radiusForKinds(pk));
    if (d > r) return { ok: false, motivo: `fuori raggio (${Math.round(d)} m > ${r} m)`, distanza: d };
    return { ok: true, distanza: d };
};

/**
 * I fatti delle tappe finali.
 * @param {Array<{ place_id: string, name: string, lat: number, lng: number, types?: string[] }>} stops
 * @param {object} [opts]
 * @param {string} [opts.city]
 * @param {number} [opts.budgetMs] tetto in tutto (default 4000)
 * @param {Function} [opts.fetchImpl]
 * @param {boolean} [opts.useCache]
 * @returns {Promise<{ byId: Map<string, { fatti: Array<{ testo: string, fonte: string }>, fonti: Array<{ fonte: string, url: string, titolo?: string }>, aggancio?: object }>, report: object }>}
 */
export async function fetchFactsForStops(stops, {
    city = '', budgetMs = FACTS_BUDGET_MS, fetchImpl: fetchArg = null, useCache = true,
} = {}) {
    // Ogni richiesta porta il signal del tetto di tempo (AbortController sotto).
    const fetchImpl = fetchArg || globalThis.fetch.bind(globalThis);
    const t0 = Date.now();
    const report = { richieste: 0, locali: 0, daCache: 0, conFatti: 0, timeout: false, ms: 0, errori: [], scartati: [] };
    const byId = new Map();
    const valid = (Array.isArray(stops) ? stops : []).filter(s => s?.place_id && Number.isFinite(s.lat) && Number.isFinite(s.lng));
    const unique = [...new Map(valid.map(s => [s.place_id, s])).values()];
    report.richieste = unique.length;
    // Decisione G — i locali non ricevono fatti.
    const luoghi = unique.filter(s => !isLocaleStop(s));
    for (const s of unique) if (isLocaleStop(s)) byId.set(s.place_id, { fatti: [], fonti: [] });
    report.locali = unique.length - luoghi.length;
    if (luoghi.length === 0) return { byId, report };

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const signal = controller?.signal;
    // Overpass ha il suo segnale: al tetto si fermano Wikipedia e i testi,
    // Overpass (e i testi a cui rimanda) continua fino a OSM_BACKGROUND_MS.
    const osmController = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const osmSignal = osmController?.signal;
    const osmTimer = setTimeout(() => { try { osmController?.abort(); } catch { /* niente */ } }, OSM_BACKGROUND_MS);
    let timer = null;
    const deadline = new Promise(resolve => { timer = setTimeout(() => resolve(TIMEOUT), budgetMs); });

    // Lo stato si riempie man mano: allo scadere si usa quello che c'e'.
    // Due catene indipendenti, cosi' un Overpass lento non ferma Wikipedia:
    //   A. Wikipedia, tappa per tappa (GEO_CONCURRENCY alla volta): ricerca per
    //      nome (porta gia' coordinate e testo); se non basta, per coordinate e
    //      poi il testo della voce trovata;
    //   B. Overpass (una richiesta per tutte, parte subito): l'elemento della
    //      tappa e i suoi tag wikipedia/wikidata (aggancio esatto).
    const state = {
        pages: new Map(), titleStatus: new Map(), entities: new Map(),
        cerca: new Map(),     // place_id → titolo accettato dalla ricerca per nome
        geo: new Map(),       // place_id → titolo accettato dalle coordinate
        wikiFatto: new Set(), // place_id per cui la catena Wikipedia e' finita bene
        osm: null, osmMatch: new Map(),
    };
    const textJobs = [];
    const scarta = (s, metodo, titolo, motivo) => report.scartati.push({ tappa: s.name, metodo, titolo, motivo });

    const storePage = (pg) => { if (pg?.title && !pg.missing) state.pages.set(pg.title, pg); };
    const fetchPages = (titles, sig = signal) => {
        const nuovi = [...new Set(titles)].filter(t => t && !state.titleStatus.has(t) && !state.pages.has(t));
        const fatti = [];
        for (let i = 0; i < nuovi.length; i += 20) {
            const chunk = nuovi.slice(i, i + 20);
            chunk.forEach(t => state.titleStatus.set(t, 'pending'));
            const job = getJson(fetchImpl, wikiUrl({
                action: 'query', prop: 'extracts|description|pageprops|coordinates', exintro: '1', explaintext: '1',
                exlimit: 'max', colimit: 'max', redirects: '1', titles: chunk.join('|'),
            }), { headers: wikiHeaders(), signal: sig }).then(j => {
                const redirects = new Map((j?.query?.redirects || []).map(r => [r.to, r.from]));
                const normalized = new Map((j?.query?.normalized || []).map(r => [r.to, r.from]));
                for (const pg of j?.query?.pages || []) {
                    if (pg?.missing || !pg?.title) continue;
                    storePage(pg);
                    const from = redirects.get(pg.title);
                    if (from) state.pages.set(from, pg);
                    const nf = normalized.get(from || pg.title);
                    if (nf) state.pages.set(nf, pg);
                }
                chunk.forEach(t => state.titleStatus.set(t, 'ok'));
            }).catch(e => {
                chunk.forEach(t => state.titleStatus.set(t, 'err'));
                report.errori.push(`wikipedia testi: ${e?.message || e}`);
            });
            textJobs.push(job);
            fatti.push(job);
        }
        return Promise.all(fatti);
    };

    const wikiCall = async (params) => {
        for (let tentativo = 0; tentativo < 2; tentativo += 1) {
            try {
                return await getJson(fetchImpl, wikiUrl(params), { headers: wikiHeaders(), signal });
            } catch (e) {
                // Si riprova solo il rifiuto per carico ("too busy", 429, 503).
                const occupato = /busy|HTTP 429|HTTP 503/i.test(String(e?.message || e));
                if (signal?.aborted || tentativo === 1 || !occupato) throw e;
                await wait(250);
            }
        }
        return null;
    };

    // (2) ricerca per nome + citta': la richiesta porta coordinate e testo.
    const searchOne = async (s) => {
        const q = searchText(s.name, city);
        const j = await wikiCall({
            action: 'query', generator: 'search', gsrsearch: q, gsrlimit: '5', gsrnamespace: '0',
            prop: 'extracts|description|pageprops|coordinates', exintro: '1', explaintext: '1', exlimit: 'max', colimit: 'max',
        });
        const pages = (j?.query?.pages || []).slice().sort((x, y) => (x.index ?? 0) - (y.index ?? 0));
        pages.forEach(storePage);
        const ok = pages
            .map(pg => ({ pg, r: acceptArticle(s, pg, { city }) }))
            .filter(x => {
                if (!x.r.ok && namesMatch(s.name, x.pg.title, city)) scarta(s, 'ricerca', x.pg.title, x.r.motivo);
                return x.r.ok;
            })
            .sort((x, y) => nameMatchScore(s.name, y.pg.title, city) - nameMatchScore(s.name, x.pg.title, city)
                || (x.pg.index ?? 0) - (y.pg.index ?? 0))[0];
        if (ok) state.cerca.set(s.place_id, { titolo: ok.pg.title, distanza: ok.r.distanza });
    };

    // (3) per coordinate, nel raggio del tipo, con abbinamento del nome.
    const geoOne = async (s) => {
        const raggio = Math.min(10000, radiusForKinds(stopKinds(s)));
        const j = await wikiCall({
            action: 'query', list: 'geosearch', gscoord: `${s.lat}|${s.lng}`, gsradius: String(raggio), gslimit: '50',
        });
        const cand = (j?.query?.geosearch || [])
            .filter(pg => namesMatch(s.name, pg.title, city))
            .sort((x, y) => nameMatchScore(s.name, y.title, city) - nameMatchScore(s.name, x.title, city) || x.dist - y.dist);
        for (const c of cand.slice(0, 2)) {
            await fetchPages([c.title]);
            const pg = state.pages.get(c.title);
            // Le coordinate della voce le ha gia' verificate il geosearch (dist
            // entro il raggio): se la voce non le riporta, valgono quelle.
            const coords = pg?.coordinates || (Number.isFinite(c.lat) ? [{ lat: c.lat, lon: c.lon }] : null);
            const r = acceptArticle(s, pg ? { ...pg, coordinates: coords } : null, { city, needCoords: !Number.isFinite(c.dist) });
            if (r.ok) { state.geo.set(s.place_id, { titolo: pg.title, distanza: c.dist }); return; }
            scarta(s, 'coordinate', c.title, r.motivo);
        }
    };

    const work = async () => {
        let todo = luoghi;
        // Overpass parte subito: e' la richiesta piu' lenta.
        const osmQuery = buildOverpassQuery(luoghi, city);
        const chainOsm = (async () => {
            try {
                const j = await getJson(fetchImpl, OVERPASS_URL, {
                    method: 'POST', headers: overpassHeaders(), signal: osmSignal,
                    body: new URLSearchParams({ data: osmQuery }),
                });
                // Overpass oltre il suo [timeout] risponde 200 con zero elementi e
                // un "remark": e' un errore, non "nessun elemento".
                if (/runtime error|timed out|out of memory/i.test(String(j?.remark || ''))) throw new Error(`overpass: ${j.remark}`);
                state.osm = Array.isArray(j?.elements) ? j.elements : [];
            } catch (e) {
                report.errori.push(`overpass: ${e?.message || e}`);
                return;
            }
            // (1) l'elemento della tappa: nome, raggio del tipo, tipo compatibile.
            // A parita' di nome vince chi ha un rimando a Wikipedia/Wikidata, poi
            // chi porta piu' fatti.
            for (const s of luoghi) {
                const sk = stopKinds(s);
                const raggio = radiusForKinds(sk);
                const best = state.osm
                    .map(el => {
                        const tags = el?.tags || {};
                        if (osmTagKinds(tags).has('locale')) return null;
                        if (distanceToElement(s.lat, s.lng, el) > raggio) return null;
                        const score = nameMatchScore(s.name, tags.name, city);
                        if (score < NAME_MATCH_MIN) return null;
                        const ek = new Set([...kindsOfText(tags.name), ...osmTagKinds(tags)]);
                        if (ek.size > 0 && !kindsCompatible(sk, ek)) return null;
                        const link = /^it:/.test(tags.wikipedia || '') || /^Q\d+$/.test(tags.wikidata || '') ? 1 : 0;
                        return { el, score, link, nFatti: osmFacts(tags).length };
                    })
                    .filter(Boolean)
                    .sort((x, y) => y.score - x.score || y.link - x.link || y.nFatti - x.nFatti)[0];
                if (best) state.osmMatch.set(s.place_id, best.el);
            }
            const titoli = [];
            const qids = [];
            for (const s of luoghi) {
                const tags = state.osmMatch.get(s.place_id)?.tags;
                if (!tags) continue;
                if (/^it:/.test(tags.wikipedia || '')) titoli.push(tags.wikipedia.slice(3));
                else if (/^Q\d+$/.test(tags.wikidata || '')) qids.push(tags.wikidata);
            }
            const jobs = [fetchPages(titoli, osmSignal)];
            if (qids.length > 0) {
                const job = getJson(fetchImpl, `${WIKIDATA_API}?${new URLSearchParams({
                    action: 'wbgetentities', ids: [...new Set(qids)].slice(0, 50).join('|'), props: 'labels|descriptions|claims|sitelinks',
                    sitefilter: 'itwiki', languages: 'it', format: 'json', origin: '*',
                })}`, { headers: wikiHeaders(), signal: osmSignal }).then(j => {
                    for (const [id, e] of Object.entries(j?.entities || {})) state.entities.set(id, e);
                    // la voce italiana dell'entita', se c'e'
                    return fetchPages(Object.values(j?.entities || {}).map(e => e?.sitelinks?.itwiki?.title).filter(Boolean), osmSignal);
                }).catch(e => report.errori.push(`wikidata: ${e?.message || e}`));
                textJobs.push(job);
                jobs.push(job);
            }
            await Promise.all(jobs);
        })().finally(() => { state.osmDone = true; clearTimeout(osmTimer); });
        state.osmChain = chainOsm;

        if (useCache) {
            try {
                const cached = await readCache(luoghi.map(s => s.place_id), Date.now());
                for (const [id, v] of cached) byId.set(id, v);
                report.daCache = cached.size;
                todo = luoghi.filter(s => !cached.has(s.place_id));
            } catch (e) {
                report.errori.push(`cache: ${e?.message || e}`);
            }
        }
        state.todo = todo;

        // Wikipedia, tappa per tappa: prima per nome, poi per coordinate.
        const chainWiki = runPool(todo, GEO_CONCURRENCY, async (st) => {
            if (signal?.aborted) return;
            try {
                await searchOne(st);
                if (!state.cerca.has(st.place_id) && !signal?.aborted) await geoOne(st);
                state.wikiFatto.add(st.place_id);
            } catch (e) {
                report.errori.push(`wikipedia: ${e?.message || e}`);
            }
        });

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

    // Assemblaggio: per ogni tappa, l'aggancio piu' fidato arrivato in tempo.
    const assemble = (s) => {
        const fatti = [];
        const fonti = [];
        let aggancio = null;
        const el = state.osmMatch.get(s.place_id);
        const tags = el?.tags || {};
        const qid = /^Q\d+$/.test(tags.wikidata || '') ? tags.wikidata : null;
        const ent = qid ? state.entities.get(qid) : null;
        const osmTitle = /^it:/.test(tags.wikipedia || '') ? tags.wikipedia.slice(3) : (ent?.sitelinks?.itwiki?.title || null);

        // (1) OSM esatto: la voce a cui rimanda l'elemento della tappa.
        const candidati = [];
        if (osmTitle) candidati.push({ metodo: 'osm', titolo: osmTitle });
        if (state.cerca.has(s.place_id)) candidati.push({ metodo: 'ricerca', ...state.cerca.get(s.place_id) });
        if (state.geo.has(s.place_id)) candidati.push({ metodo: 'coordinate', ...state.geo.get(s.place_id) });
        for (const c of candidati) {
            const p = state.pages.get(c.titolo);
            if (!p || isNonPlaceDescription(p.description)) continue;
            const frasi = wikipediaFacts(p.extract || '');
            if (frasi.length === 0 && !p.description) continue;
            for (const f of frasi) fatti.push({ testo: f, fonte: 'wikipedia' });
            if (p.description) fatti.push({ testo: `${p.title}: ${p.description}.`, fonte: p.descriptionsource === 'local' ? 'wikipedia' : 'wikidata' });
            fonti.push({ fonte: 'wikipedia', url: wikipediaPageUrl(p.title), titolo: p.title });
            aggancio = { metodo: c.metodo, titolo: p.title, ...(Number.isFinite(c.distanza) ? { distanza: Math.round(c.distanza) } : {}) };
            break; // una voce sola per tappa
        }
        // (1b) OSM esatto senza voce italiana: l'entita' Wikidata.
        if (fatti.length === 0 && ent) {
            const label = ent?.labels?.it?.value || '';
            const desc = ent?.descriptions?.it?.value || '';
            if (!isNonPlaceDescription(desc)) {
                if (desc) fatti.push({ testo: `${label || tags.name}: ${desc}.`, fonte: 'wikidata' });
                const year = wikidataYear(ent?.claims);
                if (year) fatti.push({ testo: `Fondazione o costruzione: ${year}.`, fonte: 'wikidata' });
                if (desc || year) {
                    fonti.push({ fonte: 'wikidata', url: `https://www.wikidata.org/wiki/${qid}`, titolo: label || tags.name });
                    aggancio = { metodo: 'osm', titolo: `${qid} ${label}`.trim() };
                }
            }
        }
        // OSM: i fatti dell'elemento stesso (complemento). Se l'elemento ha un
        // nome diverso dalla tappa (il Pincio per la Terrazza del Pincio), il
        // fatto porta il suo nome: "Pincio: parco.", non "Parco." detto della terrazza.
        if (el) {
            const altroNome = tags.name && normText(tags.name).trim() !== normText(s.name).trim();
            const of = osmFacts(tags)
                .map(t => (altroNome ? `${tags.name}: ${t.charAt(0).toLowerCase()}${t.slice(1)}` : t))
                .filter(t => !fatti.some(f => f.testo === t));
            for (const t of of) fatti.push({ testo: t, fonte: 'osm' });
            if (of.length > 0) {
                fonti.push({ fonte: 'osm', url: `https://www.openstreetmap.org/${el.type}/${el.id}`, titolo: tags.name });
                if (!aggancio) aggancio = { metodo: 'osm', titolo: `${el.type}/${el.id} ${tags.name || ''}`.trim() };
            }
        }
        return { fatti: fatti.slice(0, MAX_FATTI), fonti, ...(aggancio ? { aggancio } : {}) };
    };

    const toCache = [];
    for (const s of state.todo || []) {
        const entry = assemble(s);
        byId.set(s.place_id, entry);
        // In cache solo righe CON fatti (P3d-h): una riga vuota bloccherebbe per
        // 30 giorni una ricerca che la volta dopo puo' riuscire.
        if (entry.fatti.length > 0) toCache.push({ place_id: s.place_id, fatti: entry.fatti, fonti: entry.fonti });
    }

    // P3d-h — Overpass non arrivato in tempo: si lascia finire in sottofondo
    // (fino a OSM_BACKGROUND_MS) e le tappe rimaste senza fatti che ne ricevono
    // da OSM vanno in cache. La generazione e' gia' andata avanti.
    const senzaFatti = (state.todo || []).filter(s => byId.get(s.place_id)?.fatti.length === 0);
    if (state.osmChain && !state.osmDone && useCache && senzaFatti.length > 0) {
        report.osmInSottofondo = true;
        state.osmChain.then(() => {
            const righe = senzaFatti.map(s => ({ s, e: assemble(s) })).filter(x => x.e.fatti.length > 0)
                .map(x => ({ place_id: x.s.place_id, fatti: x.e.fatti, fonti: x.e.fonti }));
            if (righe.length > 0) {
                console.info(`[P3d-e FATTI] ${city}: OSM arrivato dopo il tetto, ${righe.length} tappe in cache per la prossima volta`);
                return writeCache(righe);
            }
            return null;
        }).catch(e => console.warn(`[P3d-e FATTI] OSM in sottofondo: ${e?.message || e}`));
    } else if (!state.osmDone) {
        try { osmController?.abort(); } catch { /* niente */ }
        clearTimeout(osmTimer);
    }
    report.conFatti = [...byId.values()].filter(v => v.fatti.length > 0).length;
    report.ms = Date.now() - t0;
    if (useCache && toCache.length > 0) {
        writeCache(toCache).catch(e => console.warn(`[P3d-e FATTI] cache non scritta: ${e?.message || e}`));
    }
    console.info(`[P3d-e FATTI] ${city}: ${report.conFatti}/${luoghi.length} luoghi con fatti (${report.daCache} da cache, ${report.locali} locali esclusi) in ${report.ms} ms` +
        (report.timeout ? `, oltre ${budgetMs} ms: si prosegue con quello che c'e'` : '') +
        (report.errori.length ? `, errori: ${report.errori.slice(0, 3).join(' | ')}` : ''));
    return { byId, report };
}

/** Le fonti di una tappa, per la riga a schermo (stessa forma della cache). */
export const fontiLabel = (fonti) => {
    const seen = new Set((Array.isArray(fonti) ? fonti : []).map(f => f?.fonte));
    return ['wikipedia', 'wikidata', 'osm'].filter(k => seen.has(k));
};
