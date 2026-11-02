/**
 * CHAT-VERITA — le fonti della chat: le stesse dei racconti (raccontoFonti.ts), per i luoghi del giro e per quelli nominati nella domanda.
 * La rete arriva da fuori (`fetchImpl`, `descrizioneGoogle`): lo usano il proxy e la prova in Node.
 */
import { cercaWikipedia, allargaWikipedia, wikiCall, type Fetch } from './raccontoFonti.ts';
import { kmFra } from './cityKnowledge.ts';
import { nominatoIn, ricercaDallaDomanda, LIMITI_CHAT, type LuogoChat, type FonteLuogo } from './chat.ts';

/** Un luogo nominato nella domanda vale solo se la sua voce sta entro questo raggio dal giro: niente fatti di altre città. */
export const RAGGIO_DOMANDA_KM = 10;

/** Le fonti di una tappa del giro: Wikipedia per nome e coordinate (allargata come per i racconti) + la descrizione Google. */
export async function fontiDiTappa(l: LuogoChat, citta: string, fetchImpl: Fetch, descrizioneGoogle: (placeId: string) => Promise<string>): Promise<FonteLuogo & { errore: boolean }> {
    const t = { nome: l.nome, citta, lat: l.lat, lng: l.lng };
    const [wikiRes, google] = await Promise.all([
        cercaWikipedia(t, fetchImpl).catch(() => ({ fonte: null, errore: true })),
        l.place_id ? descrizioneGoogle(l.place_id).catch(() => '') : Promise.resolve(''),
    ]);
    let wiki = wikiRes.fonte;
    let errore = wikiRes.errore;
    if (!wiki && !errore) {
        const largo = await allargaWikipedia(t, null, fetchImpl).catch(() => ({ fonte: null, errore: true }));
        wiki = largo.fonte;
        errore = largo.errore;
    }
    return { nome: l.nome, wikipedia: wiki ? { titolo: wiki.titolo, testo: wiki.testo, url: wiki.url } : null, google: google || null, errore };
}

/**
 * I luoghi nominati nella domanda che non sono tappe: UNA ricerca su it.wikipedia (le parole della domanda + la città). Una voce vale se il suo
 * titolo è nominato nella domanda, non è una disambigua e ha coordinate entro RAGGIO_DOMANDA_KM dal centro del giro. Al più due.
 */
export async function luoghiNominati(domanda: string, citta: string, centro: { lat: number; lng: number } | null, tappe: string[], fetchImpl: Fetch): Promise<{ luoghi: FonteLuogo[]; scartati: string[]; errore: boolean }> {
    const q = ricercaDallaDomanda(domanda, citta);
    if (!q || !centro) return { luoghi: [], scartati: [], errore: false };
    const j = await wikiCall({
        action: 'query', generator: 'search', gsrsearch: q, gsrlimit: '6', gsrnamespace: '0',
        prop: 'extracts|pageprops|coordinates', exintro: '1', explaintext: '1', exlimit: 'max', colimit: 'max', ppprop: 'disambiguation',
    }, fetchImpl);
    if (j === 'errore') return { luoghi: [], scartati: [], errore: true };
    const luoghi: FonteLuogo[] = [];
    const scartati: string[] = [];
    // deno-lint-ignore no-explicit-any
    const pagine: any[] = (j?.query?.pages || []).slice().sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
    for (const pg of pagine) {
        const titolo = String(pg?.title || '');
        if (!titolo || pg?.pageprops?.disambiguation !== undefined || !String(pg.extract || '').trim()) continue;
        if (!nominatoIn(domanda, titolo)) continue;
        if (tappe.some((t) => nominatoIn(titolo, t) && nominatoIn(t, titolo))) continue; // è una tappa: le sue fonti arrivano dalla tappa
        const coords = Array.isArray(pg.coordinates) ? pg.coordinates : [];
        const km = coords.length ? Math.min(...coords.map((c: { lat: number; lon: number }) => kmFra(centro, { lat: c.lat, lng: c.lon }))) : null;
        if (km == null || km > RAGGIO_DOMANDA_KM) { scartati.push(`${titolo}${km == null ? ' (senza coordinate)' : ` (${Math.round(km)} km)`}`); continue; }
        luoghi.push({ nome: titolo, wikipedia: { titolo, testo: String(pg.extract).trim(), url: `https://it.wikipedia.org/wiki/${encodeURIComponent(titolo.replace(/ /g, '_'))}` }, google: null });
        if (luoghi.length >= LIMITI_CHAT.luoghiDallaDomanda) break;
    }
    return { luoghi, scartati, errore: false };
}
