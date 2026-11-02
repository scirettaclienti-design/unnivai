/**
 * CURIOSITÀ DEL CAMMINO — dove si prendono le fonti. Solo voci di it.wikipedia.org di una via, una piazza o un quartiere, ognuna verificata:
 *  1. la via su cui cammini: il nome della strada da OpenStreetMap (Nominatim, reverse) → la voce con lo stesso nome (stesse parole, tolte
 *     articoli, preposizioni e città), con le coordinate entro RAGGIO_VIA_KM;
 *  2. le vie e le piazze a pochi passi: geosearch di Wikipedia entro RAGGIO_VICINA_M, solo titoli che sono una strada o una piazza;
 *  3. il quartiere: i nomi del quartiere da OpenStreetMap (neighbourhood, quarter, suburb; mai un municipio) → la voce con lo stesso nome,
 *     con le coordinate entro RAGGIO_QUARTIERE_KM.
 * Senza una voce verificata: nessuna curiosità. Niente Deno qui dentro: `fetch` si passa dal chiamante (così si prova senza rete).
 */
import { kmFra } from './cityKnowledge.ts';
import { wikiCall, testoIntero, testoVoceIntera, type Fetch } from './raccontoFonti.ts';
import { chiaveCuriosita, type TipoLuogo } from './curiosita.ts';

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
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

/** Dove sei, da OpenStreetMap. `errore` = Nominatim non ha risposto. */
export async function indirizzoDi(lat: number, lng: number, fetchImpl: Fetch): Promise<Indirizzo | 'errore'> {
    const qs = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng), zoom: '17', addressdetails: '1', 'accept-language': 'it' }).toString();
    try {
        const r = await fetchImpl(`${NOMINATIM}?${qs}`, { headers: { 'User-Agent': UA_CURIOSITA, Referer: 'https://unnivai.vercel.app' } });
        if (!r.ok) return 'errore';
        const j = await r.json().catch(() => null);
        if (!j || j.error) return 'errore';
        return leggiIndirizzo(j.address);
    } catch { return 'errore'; }
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
export async function luoghiVicini(t: { lat: number; lng: number; citta: string }, ind: Indirizzo, fetchImpl: Fetch): Promise<{ luoghi: Luogo[]; errore: boolean }> {
    let errore = false;
    const citta = t.citta || ind.citta || '';
    const [via, vicine, ...quartieri] = await Promise.all([
        ind.via ? vocePerNome(ind.via, citta, t.lat, t.lng, 'via', RAGGIO_VIA_KM, fetchImpl) : Promise.resolve(null),
        wikiCall({ action: 'query', list: 'geosearch', gscoord: `${t.lat}|${t.lng}`, gsradius: String(RAGGIO_VICINA_M), gslimit: '50' }, fetchImpl),
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
