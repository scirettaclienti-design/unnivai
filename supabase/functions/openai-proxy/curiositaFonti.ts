/**
 * CURIOSITÀ DEL CAMMINO — dove si prendono le fonti. Solo voci di it.wikipedia.org di una via, una piazza o un quartiere, ognuna verificata:
 *  1. la via su cui cammini: il nome della strada da OpenStreetMap (Nominatim, reverse) → la voce con lo stesso nome (stesse parole, tolte
 *     articoli, preposizioni e città), con le coordinate entro RAGGIO_VIA_KM;
 *  2. le vie e le piazze a pochi passi: geosearch di Wikipedia entro RAGGIO_VICINA_M, solo titoli che sono una strada o una piazza;
 *  3. il quartiere: i nomi del quartiere da OpenStreetMap (neighbourhood, quarter, suburb; mai un municipio) → la voce con lo stesso nome,
 *     con le coordinate entro RAGGIO_QUARTIERE_KM.
 * I nomi vengono dal geocoding inverso di Google (chiave del server, una richiesta per zona); se non risponde, da Photon (komoot, dati
 * OpenStreetMap) e poi da Nominatim (che dal server dà 403: ultima riserva); se nessuno risponde restano le vie e le piazze a pochi passi
 * (geosearch, verificate per coordinate). Senza una voce verificata: nessuna curiosità.
 * MEMORIA PER ZONA (cella di ~100 m, condivisa fra gli utenti): si ricorda il RISULTATO verificato (le voci di Wikipedia: pageid, titolo, tipo),
 * MAI il testo di Google: le condizioni d'uso di Google (6.3.2) non permettono di tenere indirizzi del geocoding fra utenti diversi. Niente Deno qui dentro: `fetch` si passa dal chiamante (così si prova senza rete).
 */
import { kmFra } from './cityKnowledge.ts';
import { wikiCall, testoIntero, testoVoceIntera, type Fetch } from './raccontoFonti.ts';
import { chiaveCuriosita, type TipoLuogo } from './curiosita.ts';

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const GOOGLE_GEOCODE = 'https://maps.googleapis.com/maps/api/geocode/json';
const PHOTON = 'https://photon.komoot.io/reverse';
export const UA_CURIOSITA = 'Unnivai/1.0 (https://unnivai.vercel.app; curiosita del cammino)';
export const RAGGIO_VICINA_M = 120;
export const RAGGIO_VIA_KM = 1.5;      // una via lunga: la sua voce ha un punto solo (via Etnea: 3 km)
export const RAGGIO_QUARTIERE_KM = 3;  // il punto della voce di un rione sta nel mezzo (Trastevere, Monti)

export type Indirizzo = { via: string | null; quartieri: string[]; citta: string | null };
export type Luogo = { chiave: string; pageid: number; titolo: string; url: string; distanzaM: number | null; tipo: TipoLuogo; trovata: 'indirizzo' | 'vicina' };

const senzaParentesi = (s: string) => String(s || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`ʻ']/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const urlVoce = (titolo: string) => `https://it.wikipedia.org/wiki/${encodeURIComponent(String(titolo).replace(/ /g, '_'))}`;

/** Le parole che dicono che cosa è una strada (il titolo di una voce di via comincia con una di queste). */
export const STRADA = /^(via|viale|vicolo|vico|piazza|piazzetta|piazzale|largo|lungotevere|lungomare|lungarno|salita|scalinata|scala|corso|strada|calata|discesa|passeggiata|rampa|borgo)\b/i;
const VUOTE = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'l', 'di', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'dell', 'd', 'e', 'ed', 'a', 'al', 'alla', 'ai', 'agli', 'alle', 'in', 'san', 'santa', 'santo', 'sant', 'ss', 'de']);
const ORDINALI: Record<string, string> = { primo: 'i', secondo: 'ii', terzo: 'iii', quarto: 'iv', quinto: 'v' };
/** Le parole proprie di un nome (minuscole, senza accenti), tolte articoli, preposizioni, «san», la città; gli ordinali in cifra romana. */
export function paroleProprie(nome: string, citta = ''): string[] {
    const c = new Set(norm(citta).split(' ').filter(Boolean));
    return norm(senzaParentesi(nome)).split(' ').filter(Boolean).map(w => ORDINALI[w] || w).filter(w => !VUOTE.has(w) && !c.has(w));
}
/** Due nomi sono lo stesso luogo se hanno le stesse parole proprie (almeno una di 4 lettere): «Via Crociferi» = «Via dei Crociferi». */
export function stessoLuogo(a: string, b: string, citta = ''): boolean {
    const x = paroleProprie(a, citta), y = paroleProprie(b, citta);
    if (!x.length || !x.some(w => w.length >= 4) || x.length !== y.length) return false;
    const sy = new Set(y);
    return x.every(w => sy.has(w));
}

/** I nomi di OpenStreetMap: la strada e i quartieri (dal più piccolo al più grande); un municipio o una circoscrizione non è un quartiere. */
// deno-lint-ignore no-explicit-any
export function leggiIndirizzo(a: any): Indirizzo {
    const ad = a && typeof a === 'object' ? a : {};
    const citta = ad.city || ad.town || ad.village || ad.municipality || null;
    const via = ad.road || ad.pedestrian || ad.square || ad.footway || null;
    const visti = new Set<string>();
    const quartieri: string[] = [];
    for (const q of [ad.neighbourhood, ad.quarter, ad.suburb, ad.city_district]) {
        if (typeof q !== 'string' || !q.trim()) continue;
        if (/^(municipio|municipalit|circoscrizione|zona|distretto|quartiere amministrativo)\b/i.test(q.trim())) continue;
        const nome = q.trim().replace(/^rione\s+([ivxlcdm]+\s+)?/i, '').trim();
        const k = norm(nome);
        if (!k || visti.has(k) || (citta && k === norm(citta))) continue;
        visti.add(k);
        quartieri.push(nome);
    }
    return { via: typeof via === 'string' && via.trim() ? via.trim() : null, quartieri, citta };
}

/** L'indirizzo mandato dal telefono (campi di Nominatim): solo stringhe corte dei campi noti; altrimenti null. */
const CAMPI_CLIENT = ['road', 'pedestrian', 'square', 'footway', 'neighbourhood', 'quarter', 'suburb', 'city_district', 'city', 'town', 'village'];
export function indirizzoDaClient(x: unknown): Indirizzo | null {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    const a: Record<string, string> = {};
    for (const c of CAMPI_CLIENT) { const v = (x as Record<string, unknown>)[c]; if (typeof v === 'string' && v.trim() && v.length <= 80) a[c] = v.trim(); }
    return Object.keys(a).length ? leggiIndirizzo(a) : null;
}

/** I nomi di Photon (komoot, dati OpenStreetMap): la strada e la località/il distretto. Stesse regole di `leggiIndirizzo`. */
// deno-lint-ignore no-explicit-any
export function leggiPhoton(p: any): Indirizzo {
    const pr = p && typeof p === 'object' ? p : {};
    const via = pr.type === 'street' ? pr.name : pr.street;
    return leggiIndirizzo({ road: via, neighbourhood: pr.locality, suburb: pr.district, city: pr.city });
}

/** I nomi di Google (Geocoding inverso, `result_type=route|neighborhood|sublocality`): la strada, i quartieri, la città. Stesse regole di `leggiIndirizzo`. */
// deno-lint-ignore no-explicit-any
export function leggiGoogle(j: any): Indirizzo {
    const risultati: any[] = Array.isArray(j?.results) ? j.results : []; // deno-lint-ignore no-explicit-any
    const nomi = (tipi: string[]): string[] => {
        const out: string[] = [];
        for (const r of risultati) for (const c of (Array.isArray(r?.address_components) ? r.address_components : [])) {
            if (typeof c?.long_name === 'string' && Array.isArray(c?.types) && tipi.some(t => c.types.includes(t)) && !out.includes(c.long_name)) out.push(c.long_name);
        }
        return out;
    };
    const route = risultati.find(r => Array.isArray(r?.types) && r.types.includes('route'));
    const via = (Array.isArray(route?.address_components) ? route.address_components : []).find((c: { types?: string[] }) => c?.types?.includes('route'))?.long_name;
    const vicinato = nomi(['neighborhood']);
    const sotto = nomi(['sublocality_level_1', 'sublocality']);
    return leggiIndirizzo({ road: via, neighbourhood: vicinato[0], quarter: vicinato[1], suburb: sotto[0], city_district: sotto[1], city: nomi(['locality'])[0] });
}

/** I nomi di Photon (komoot) per un punto; null se non risponde (il motivo in `diagnosi`). */
export async function indirizzoPhoton(lat: number, lng: number, fetchImpl: Fetch, diagnosi: string[] = []): Promise<Indirizzo | null> {
    try {
        const r = await fetchImpl(`${PHOTON}?${new URLSearchParams({ lat: String(lat), lon: String(lng), limit: '1' }).toString()}`, { headers: { 'User-Agent': UA_CURIOSITA } });
        const j = r.ok ? await r.json().catch(() => null) : null;
        const f = Array.isArray(j?.features) ? j.features[0] : null;
        if (f?.properties) return leggiPhoton(f.properties);
        diagnosi.push(`photon ${r.status}${j && !f ? ' vuoto' : ''}`);
    } catch (e) { diagnosi.push(`photon rete ${String((e as Error)?.name || '')}`.trim()); }
    return null;
}

/**
 * Dove sei: Google (geocoding inverso, se c'è la chiave del server), e solo se non risponde le riserve: Photon (komoot, OpenStreetMap) e
 * Nominatim (dal server dà 403: ultima). `errore` = nessuno ha risposto; `diagnosi` dice perché (stato HTTP), per il log e per la risposta
 * al client: mai la posizione né la chiave.
 */
export async function indirizzoDi(lat: number, lng: number, fetchImpl: Fetch, diagnosi: string[] = [], chiaveGoogle?: string | null): Promise<Indirizzo | 'errore'> {
    if (chiaveGoogle) {
        try {
            const qs = new URLSearchParams({ latlng: `${lat},${lng}`, language: 'it', result_type: 'route|neighborhood|sublocality', key: chiaveGoogle }).toString();
            const r = await fetchImpl(`${GOOGLE_GEOCODE}?${qs}`, { headers: { 'User-Agent': UA_CURIOSITA } });
            const j = r.ok ? await r.json().catch(() => null) : null;
            if (j && (j.status === 'OK' || j.status === 'ZERO_RESULTS')) return leggiGoogle(j);
            diagnosi.push(`google ${r.status}${j?.status ? ` ${String(j.status).slice(0, 30)}` : ''}`);
        } catch (e) { diagnosi.push(`google rete ${String((e as Error)?.name || '')}`.trim()); }
    }
    const daPhoton = await indirizzoPhoton(lat, lng, fetchImpl, diagnosi);
    if (daPhoton) return daPhoton;
    const qs = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng), zoom: '17', addressdetails: '1', 'accept-language': 'it' }).toString();
    try {
        const r = await fetchImpl(`${NOMINATIM}?${qs}`, { headers: { 'User-Agent': UA_CURIOSITA, Referer: 'https://unnivai.vercel.app' } });
        const j = r.ok ? await r.json().catch(() => null) : null;
        if (j && !j.error && j.address) return leggiIndirizzo(j.address);
        diagnosi.push(`nominatim ${r.status}${j?.error ? ' errore' : ''}`);
    } catch (e) { diagnosi.push(`nominatim rete ${String((e as Error)?.name || '')}`.trim()); }
    return 'errore';
}

const distanzaM = (lat: number, lng: number, coords: unknown): number | null => {
    const cs = Array.isArray(coords) ? coords as Array<{ lat: number; lon: number }> : [];
    return cs.length ? Math.round(Math.min(...cs.map(c => kmFra({ lat, lng }, { lat: c.lat, lng: c.lon }) * 1000))) : null;
};

/** La voce di Wikipedia con lo stesso nome del luogo, entro `raggioKm` (senza coordinate non vale). */
async function vocePerNome(nome: string, citta: string, lat: number, lng: number, tipo: TipoLuogo, raggioKm: number, fetchImpl: Fetch): Promise<Luogo | null | 'errore'> {
    const j = await wikiCall({
        action: 'query', generator: 'search', gsrsearch: `${nome} ${citta}`.trim(), gsrlimit: '5', gsrnamespace: '0',
        prop: 'coordinates|pageprops', colimit: 'max', ppprop: 'disambiguation',
    }, fetchImpl);
    if (j === 'errore') return 'errore';
    // deno-lint-ignore no-explicit-any
    const pagine: any[] = (j?.query?.pages || []).slice().sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
    for (const pg of pagine) {
        if (!pg?.title || !pg?.pageid || pg?.pageprops?.disambiguation !== undefined) continue;
        if (tipo === 'via' && !STRADA.test(senzaParentesi(pg.title))) continue;
        if (!stessoLuogo(nome, pg.title, citta)) continue;
        const d = distanzaM(lat, lng, pg.coordinates);
        if (d === null || d > raggioKm * 1000) continue;
        return { chiave: chiaveCuriosita(pg.pageid), pageid: pg.pageid, titolo: pg.title, url: urlVoce(pg.title), distanzaM: d, tipo, trovata: 'indirizzo' };
    }
    return null;
}

/**
 * I luoghi con una voce verificata attorno a te, nell'ordine in cui si provano: la via su cui cammini, le vie e piazze a pochi passi, il
 * quartiere. `errore` = una ricerca non ha risposto (il chiamante non conclude «nessuna fonte»).
 */
export async function luoghiVicini(t: { lat: number; lng: number; citta: string }, ind: Indirizzo, fetchImpl: Fetch, soloQuartieri = false): Promise<{ luoghi: Luogo[]; errore: boolean }> {
    let errore = false;
    const citta = t.citta || ind.citta || '';
    const [via, vicine, ...quartieri] = await Promise.all([
        ind.via && !soloQuartieri ? vocePerNome(ind.via, citta, t.lat, t.lng, 'via', RAGGIO_VIA_KM, fetchImpl) : Promise.resolve(null),
        soloQuartieri ? Promise.resolve({ query: { geosearch: [] } }) : wikiCall({ action: 'query', list: 'geosearch', gscoord: `${t.lat}|${t.lng}`, gsradius: String(RAGGIO_VICINA_M), gslimit: '50' }, fetchImpl),
        ...ind.quartieri.slice(0, 3).map(q => vocePerNome(q, citta, t.lat, t.lng, 'quartiere', RAGGIO_QUARTIERE_KM, fetchImpl)),
    ]);
    const luoghi: Luogo[] = [];
    const visti = new Set<number>();
    const aggiungi = (l: Luogo | null | 'errore') => {
        if (l === 'errore') { errore = true; return; }
        if (l && !visti.has(l.pageid)) { visti.add(l.pageid); luoghi.push(l); }
    };
    aggiungi(via as Luogo | null | 'errore');
    if (vicine === 'errore') errore = true;
    else {
        // deno-lint-ignore no-explicit-any
        const elenco: any[] = (vicine?.query?.geosearch || []).filter((g: any) => g?.pageid && g?.title && STRADA.test(senzaParentesi(g.title)) && !/disambigua/i.test(g.title))
            .sort((a: any, b: any) => (a.dist ?? 0) - (b.dist ?? 0));
        for (const g of elenco) aggiungi({ chiave: chiaveCuriosita(g.pageid), pageid: g.pageid, titolo: g.title, url: urlVoce(g.title), distanzaM: Math.round(g.dist ?? 0), tipo: 'via', trovata: 'vicina' });
    }
    for (const q of quartieri) aggiungi(q as Luogo | null | 'errore');
    return { luoghi, errore };
}

/** Il testo della voce per la curiosità: introduzione e sezioni di testo fino a 1500 caratteri (senza Note, Curiosità, Bibliografia…). */
export async function testoDelLuogo(l: Luogo, fetchImpl: Fetch): Promise<string | 'errore'> {
    const intero = await testoIntero(l.titolo, fetchImpl);
    if (intero === 'errore') return 'errore';
    return testoVoceIntera(intero);
}

/** Un luogo è una tappa del giro? (lo stesso nome: «Piazza Trilussa» tappa e voce) Allora non è una curiosità del cammino. */
export const eUnaTappa = (l: Luogo, tappe: string[], citta = ''): boolean => tappe.some(n => stessoLuogo(n, l.titolo, citta) || norm(senzaParentesi(n)) === norm(senzaParentesi(l.titolo)));


// ─── la memoria per zona ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Lato di una cella in gradi di latitudine (~111 m); in longitudine si allarga con la latitudine, così la cella resta di ~100 m. */
export const CELLA_GRADI = 0.001;
export const TTL_CELLA_MS = 7 * 24 * 3600 * 1000;
const VERSIONE_CELLA = 'v1';

export type Cella = { chiave: string; lat: number; lng: number };
/** La cella che contiene il punto: la chiave (`indice:indice`) e il suo CENTRO, da cui si calcola tutto, così ogni utente della cella ha lo stesso risultato. */
export function cellaDi(lat: number, lng: number): Cella {
    const iLat = Math.floor(lat / CELLA_GRADI);
    const latC = (iLat + 0.5) * CELLA_GRADI;
    const passoLng = Math.round((CELLA_GRADI / Math.max(0.2, Math.cos(latC * Math.PI / 180))) * 1e5) / 1e5;
    const iLng = Math.floor(lng / passoLng);
    return { chiave: `curiosita-cella:${VERSIONE_CELLA}:${iLat}:${iLng}`, lat: +latC.toFixed(5), lng: +((iLng + 0.5) * passoLng).toFixed(5) };
}

/** Dove si tiene la memoria (l'istanza della funzione, la tabella places_cache): chi chiama lo fornisce; qualunque errore = nessuna memoria, mai un'eccezione. */
export type MemoriaCelle = { leggi: (chiave: string) => Promise<unknown | null>; scrivi: (chiave: string, valore: unknown) => Promise<void> };

/** Il contenuto di una cella: solo voci di Wikipedia verificate (pageid, titolo, tipo), nessun testo di Google. */
export function luoghiDaMemoria(x: unknown, adesso = Date.now()): Luogo[] | null {
    const o = x as { v?: unknown; t?: unknown; luoghi?: unknown } | null;
    if (!o || o.v !== VERSIONE_CELLA || typeof o.t !== 'number' || adesso - o.t > TTL_CELLA_MS || adesso < o.t - 60_000 || !Array.isArray(o.luoghi)) return null;
    const out: Luogo[] = [];
    for (const l of o.luoghi as Array<Record<string, unknown>>) {
        if (!l || typeof l.pageid !== 'number' || typeof l.titolo !== 'string' || typeof l.chiave !== 'string' || typeof l.url !== 'string' || l.chiave !== chiaveCuriosita(l.pageid)
            || (l.tipo !== 'via' && l.tipo !== 'quartiere') || (l.trovata !== 'indirizzo' && l.trovata !== 'vicina')) return null;
        out.push({ chiave: l.chiave, pageid: l.pageid, titolo: l.titolo, url: l.url, distanzaM: typeof l.distanzaM === 'number' ? l.distanzaM : null, tipo: l.tipo, trovata: l.trovata });
    }
    return out;
}

export type RichiesteEsterne = { google: number; photon: number; nominatim: number; wikipedia: number };
/** Un `fetch` che conta le richieste per servizio (per il log e per la prova): mai l'indirizzo, solo il nome del servizio. */
export function contaRichieste(fetchImpl: Fetch): { fetch: Fetch; conteggio: RichiesteEsterne } {
    const conteggio: RichiesteEsterne = { google: 0, photon: 0, nominatim: 0, wikipedia: 0 };
    const f: Fetch = (url, init) => {
        let h = '';
        try { h = new URL(url).hostname; } catch { /* */ }
        if (h === 'maps.googleapis.com') conteggio.google += 1;
        else if (h === 'photon.komoot.io') conteggio.photon += 1;
        else if (h === 'nominatim.openstreetmap.org') conteggio.nominatim += 1;
        else if (/(^|\.)wikipedia\.org$/.test(h)) conteggio.wikipedia += 1;
        return fetchImpl(url, init);
    };
    return { fetch: f, conteggio };
}

export type EsitoFonti = { luoghi: Luogo[]; errore: boolean; ind: Indirizzo | null; trovato: Indirizzo | 'errore' | null; daMemoria: boolean };
/**
 * I luoghi con una voce verificata attorno al punto, con la memoria per zona: se la cella è già nota non parte nessuna richiesta esterna;
 * altrimenti si chiede l'indirizzo (Google, poi le riserve) e le voci di Wikipedia, tutto dal CENTRO della cella, e si ricorda il risultato
 * se è completo (nessun errore di rete: un errore non si ricorda mai).
 */
export async function luoghiDellaZona(t: { lat: number; lng: number; citta: string }, fetchImpl: Fetch, memoria: MemoriaCelle | null, chiaveGoogle: string | null, diagnosi: string[] = [], adesso = Date.now()): Promise<EsitoFonti> {
    const cella = cellaDi(t.lat, t.lng);
    if (memoria) {
        let noto: Luogo[] | null = null;
        try { noto = luoghiDaMemoria(await memoria.leggi(cella.chiave), adesso); } catch { noto = null; }
        if (noto) return { luoghi: noto, errore: false, ind: null, trovato: null, daMemoria: true };
    }
    const trovato = await indirizzoDi(cella.lat, cella.lng, fetchImpl, diagnosi, chiaveGoogle);
    const ind: Indirizzo = trovato === 'errore' ? { via: null, quartieri: [], citta: null } : trovato;
    const citta = t.citta || ind.citta || '';
    const { luoghi, errore: errore1 } = await luoghiVicini({ lat: cella.lat, lng: cella.lng, citta }, ind, fetchImpl);
    let errore = errore1;
    // I quartieri di Google sono più larghi di quelli di OpenStreetMap (a Catania «Centro», non Giudecca, Civita, San Berillo): se i nomi di
    // Google non portano a nessuna voce di quartiere, una richiesta a Photon (una per zona, poi la memoria) per i soli nomi dei quartieri.
    if (!errore && trovato !== 'errore' && !luoghi.some(l => l.tipo === 'quartiere')) {
        const osm = await indirizzoPhoton(cella.lat, cella.lng, fetchImpl, diagnosi);
        const nomi = osm?.quartieri.filter(q => !ind.quartieri.includes(q)) ?? [];
        if (nomi.length) {
            const q = await luoghiVicini({ lat: cella.lat, lng: cella.lng, citta }, { via: null, quartieri: nomi, citta: ind.citta }, fetchImpl, true);
            errore = q.errore;
            for (const l of q.luoghi) if (!luoghi.some(x => x.pageid === l.pageid)) luoghi.push(l);
        }
    }
    if (memoria && !errore && trovato !== 'errore') {
        try { await memoria.scrivi(cella.chiave, { v: VERSIONE_CELLA, t: adesso, luoghi }); } catch { /* la memoria non blocca mai la risposta */ }
    }
    return { luoghi, errore, ind, trovato, daMemoria: false };
}
