/**
 * RACCONTO DI TAPPA — dove si prendono le fonti. Wikipedia (testo dell'introduzione della voce della tappa, agganciata per nome + città e
 * confermata dalle coordinate) e la descrizione Google del posto (`editorial_summary`, da places-proxy). Un aggancio dubbio si scarta:
 * un fatto sbagliato è peggio di nessun fatto. Niente Deno qui dentro: `fetch` si passa dal chiamante (così si prova senza rete).
 */
import { kmFra, nomeCompatibile } from './cityKnowledge.ts';

const WIKI_API = 'https://it.wikipedia.org/w/api.php';
export const RAGGIO_MAX_M = 700;
export const UA_WIKIPEDIA = 'Unnivai/1.0 (https://unnivai.vercel.app; racconti di tappa)';

export type TappaDaRaccontare = { nome: string; citta: string; lat: number; lng: number };
export type FonteWikipedia = { titolo: string; url: string; testo: string; distanzaM: number | null };

const senzaParentesi = (s: string) => String(s || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s: string) => senzaParentesi(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`ʻ]/g, "'").replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();

type Fetch = (url: string, init?: Record<string, unknown>) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>; // deno-lint-ignore no-explicit-any

async function wikiCall(params: Record<string, string>, fetchImpl: Fetch): Promise<any | 'errore'> { // deno-lint-ignore no-explicit-any
    const qs = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params }).toString();
    for (let tentativo = 0; tentativo < 3; tentativo++) {
        try {
            const r = await fetchImpl(`${WIKI_API}?${qs}`, { headers: { 'Api-User-Agent': UA_WIKIPEDIA } });
            const j = await r.json().catch(() => null);
            const occupato = /busy/i.test(String(j?.error?.code || '')) || r.status === 429 || r.status === 503;
            if (r.ok && !j?.error) return j;
            if (!occupato || tentativo === 2) return 'errore';
        } catch { if (tentativo === 2) return 'errore'; }
        await new Promise((res) => setTimeout(res, 400 * (tentativo + 1)));
    }
    return 'errore';
}

/**
 * La voce di Wikipedia della tappa, o null. Si cerca «nome città»; la voce vale solo se il titolo è lo stesso posto (nomeCompatibile),
 * non è una pagina di disambiguazione e sta entro RAGGIO_MAX_M dalla tappa (se la voce non ha coordinate: solo a nome identico).
 */
export async function trovaWikipedia(t: TappaDaRaccontare, fetchImpl: Fetch): Promise<FonteWikipedia | null> {
    return (await cercaWikipedia(t, fetchImpl)).fonte;
}

/** Come trovaWikipedia, ma dice anche se Wikipedia NON ha risposto (occupata, rete): allora «nessuna voce» non è una risposta e non si memorizza. */
export async function cercaWikipedia(t: TappaDaRaccontare, fetchImpl: Fetch): Promise<{ fonte: FonteWikipedia | null; errore: boolean }> {
    const nome = senzaParentesi(t.nome);
    if (!nome) return { fonte: null, errore: false };
    const j = await wikiCall({
        action: 'query', generator: 'search', gsrsearch: `${nome} ${t.citta}`.trim(), gsrlimit: '5', gsrnamespace: '0',
        prop: 'extracts|pageprops|coordinates', exintro: '1', explaintext: '1', exlimit: 'max', colimit: 'max', ppprop: 'disambiguation',
    }, fetchImpl);
    if (j === 'errore') return { fonte: null, errore: true };
    // deno-lint-ignore no-explicit-any
    const pagine: any[] = (j?.query?.pages || []).slice().sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
    for (const pg of pagine) {
        if (!pg?.title || pg?.pageprops?.disambiguation !== undefined) continue;
        if (!String(pg.extract || '').trim()) continue;
        if (!nomeCompatibile(nome, senzaParentesi(pg.title), t.citta)) continue;
        const coords = Array.isArray(pg.coordinates) ? pg.coordinates : [];
        let distanzaM: number | null = null;
        if (coords.length) {
            distanzaM = Math.round(Math.min(...coords.map((c: { lat: number; lon: number }) => kmFra({ lat: t.lat, lng: t.lng }, { lat: c.lat, lng: c.lon }) * 1000)));
            if (!(distanzaM <= RAGGIO_MAX_M)) continue;
        } else if (norm(nome) !== norm(pg.title)) continue;
        return { fonte: { titolo: pg.title, url: `https://it.wikipedia.org/wiki/${encodeURIComponent(String(pg.title).replace(/ /g, '_'))}`, testo: String(pg.extract).trim(), distanzaM }, errore: false };
    }
    return { fonte: null, errore: false };
}

/** La descrizione Google del posto da una risposta di places-proxy `place/details&fields=editorial_summary`; vuota se Google non ne ha una. */
// deno-lint-ignore no-explicit-any
export const descrizioneGoogleDa = (corpo: any): string => String(corpo?.result?.editorial_summary?.overview ?? '').replace(/\s+/g, ' ').trim();
