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
export type FonteWikipedia = { titolo: string; url: string; testo: string; distanzaM: number | null; via?: ViaFonte };
/** Come è stata trovata la voce: per nome (la ricerca di sempre), voce intera (l'introduzione era corta), vicina (voce entro pochi metri,
 * con lo stesso nome proprio), menzioni (le frasi di una voce vicina o della città che nominano la tappa). */
export type ViaFonte = 'nome' | 'voce-intera' | 'vicina' | 'menzioni';

const senzaParentesi = (s: string) => String(s || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s: string) => senzaParentesi(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`ʻ]/g, "'").replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();

type Fetch = (url: string, init?: Record<string, unknown>) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>; // deno-lint-ignore no-explicit-any

async function wikiCall(params: Record<string, string>, fetchImpl: Fetch): Promise<any | 'errore'> { // deno-lint-ignore no-explicit-any
    const qs = new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params }).toString();
    for (let tentativo = 0; tentativo < 3; tentativo++) {
        try {
            // User-Agent vero (il server lo può mandare, il browser no): senza, Wikimedia conta la richiesta come «non identificata», 10 al minuto
            // per IP invece di 200 (mediawiki.org/wiki/Wikimedia_APIs/Rate_limits, letto il 02/11/2026). Api-User-Agent resta per chi non può.
            const r = await fetchImpl(`${WIKI_API}?${qs}`, { headers: { 'User-Agent': UA_WIKIPEDIA, 'Api-User-Agent': UA_WIKIPEDIA } });
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
        return { fonte: { titolo: pg.title, url: urlVoce(pg.title), testo: String(pg.extract).trim(), distanzaM, via: 'nome' }, errore: false };
    }
    return { fonte: null, errore: false };
}

const urlVoce = (titolo: string) => `https://it.wikipedia.org/wiki/${encodeURIComponent(String(titolo).replace(/ /g, '_'))}`;

// ─── RACCONTO-FONTI: quando la ricerca per nome non basta ───────────────────────────────────────────────────────────────────────────
// Si allarga SOLO per una tappa che altrimenti resterebbe senza fonti (meno di 200 caratteri fra Wikipedia e Google): le tappe che hanno
// già le loro fonti non cambiano. Ogni strada verifica il posto: col nome (sempre) e con le coordinate (sempre, salvo la voce della città).
export const RAGGIO_VICINA_M = 200;       // una voce con un altro nome (Chiesa Madre ↔ Ex cattedrale) vale solo a pochi passi
export const RAGGIO_CONTENITORE_M = 300;  // la voce che nomina la tappa (Vittoriano, Palazzo Colonna) deve stare lì accanto
export const RAGGIO_CITTA_KM = 5;         // la voce della città (Troina) vale per le tappe entro 5 km dalle sue coordinate
export const TESTO_MAX = 1500;            // = LIMITI.wikipediaMax di racconto.ts: oltre, il modello non lo vede comunque
const MAX_CONTENITORI = 3;

/** Le sezioni che non parlano del posto (o non sono testo): fuori dalla voce intera e dalle menzioni. */
const SEZIONI_FUORI = /^(note|bibliografia|voci correlate|altri progetti|collegamenti esterni|collegamenti|galleria( d'immagini| fotografica)?|immagini|curiosita|filmografia|fonti|sitografia|riferimenti|approfondimenti|letture|discografia|nella cultura di massa|altre immagini)$/;

type Sezione = { titolo: string; testo: string };
/** Il testo semplice di una voce (explaintext) diviso per sezioni; la prima è l'introduzione (titolo vuoto). */
export function sezioniDi(testo: string): Sezione[] {
    const out: Sezione[] = [{ titolo: '', testo: '' }];
    for (const riga of String(testo || '').split('\n')) {
        const h = riga.match(/^\s*=+\s*(.*?)\s*=+\s*$/);
        if (h) out.push({ titolo: h[1], testo: '' });
        else out[out.length - 1].testo += `${riga}\n`;
    }
    return out.map(x => ({ titolo: x.titolo, testo: x.testo.trim() }));
}
const sezioneFuori = (titolo: string) => SEZIONI_FUORI.test(norm(titolo));

/** Le unità di testo (frasi; una riga senza punto, come una voce di elenco, è un'unità sua). «a. C.», «S. Pietro» non spezzano. */
export function frasiDi(testo: string): string[] {
    const out: string[] = [];
    for (const riga of String(testo || '').split('\n').map(r => r.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
        let inizio = 0;
        const re = /[.!?]\s+(?=[A-ZÀ-ÝÈÉ«"“])/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(riga))) {
            const prima = riga.slice(inizio, m.index + 1);
            const ultima = (prima.match(/(\S+)\.$/) || [])[1] || '';
            if (/^[A-Za-zÀ-ÿ]{1,2}$/.test(ultima)) continue; // «a.», «C.», «S.»: un'abbreviazione, non una fine
            out.push(prima.trim());
            inizio = m.index + 1;
        }
        const resto = riga.slice(inizio).trim();
        if (resto) out.push(/[.!?…]$/.test(resto) ? resto : `${resto}.`);
    }
    return out;
}

/** Il corpo di una voce dedicata alla tappa: introduzione e sezioni di testo, fino a TESTO_MAX, a frase intera. */
export function testoVoceIntera(testo: string): string {
    const parti: string[] = [];
    let n = 0;
    for (const sz of sezioniDi(testo)) {
        if (sz.titolo && sezioneFuori(sz.titolo)) continue;
        for (const f of frasiDi(sz.testo)) {
            if (n + f.length + 1 > TESTO_MAX) return parti.join(' ');
            parti.push(f); n += f.length + 1;
        }
    }
    return parti.join(' ');
}

/** Il nome per cercarlo dentro un testo: senza parentesi e senza articolo iniziale («Il Palazzo dei Conservatori»). */
export const nomeDaCercare = (nome: string): string => senzaParentesi(nome).replace(/^(il|lo|la|i|gli|le|l')\s*/i, '').trim();
/** Il nome è abbastanza preciso da cercarlo dentro un testo? Almeno due parole che non siano articoli, almeno 8 lettere. */
const nomePreciso = (nome: string) => norm(nome).split(' ').filter(w => w.length > 2).length >= 2 && norm(nome).replace(/ /g, '').length >= 8;
const contieneNome = (frase: string, nome: string) => ` ${norm(frase)} `.includes(` ${norm(nome)} `);

/**
 * Le frasi di una voce che nominano la tappa, e le sezioni intitolate col suo nome per intero. Solo queste: una voce sul Vittoriano parla
 * di tante cose, e il racconto della Terrazza delle Quadrighe deve partire solo da ciò che la voce dice della terrazza.
 */
export function menzioniIn(testo: string, nome: string): string[] {
    const n = nomeDaCercare(nome);
    if (!nomePreciso(n)) return [];
    const out: string[] = [];
    for (const sz of sezioniDi(testo)) {
        if (sz.titolo && sezioneFuori(sz.titolo)) continue;
        const tutta = sz.titolo && contieneNome(sz.titolo, n);
        for (const f of frasiDi(sz.testo)) if (tutta || contieneNome(f, n)) out.push(f);
    }
    return out;
}

// Parole che dicono che cosa è un posto, non quale: due nomi sono lo stesso posto se, tolte queste, restano le stesse parole.
const FAMIGLIE: Record<string, string> = {
    chiesa: 'culto', cattedrale: 'culto', duomo: 'culto', basilica: 'culto', santuario: 'culto', concattedrale: 'culto', pieve: 'culto', madre: 'culto',
    oratorio: 'culto', cappella: 'culto', abbazia: 'culto', convento: 'culto', monastero: 'culto', parrocchia: 'culto', collegiata: 'culto',
    palazzo: 'palazzo', palazzetto: 'palazzo', villa: 'verde', giardino: 'verde', giardini: 'verde', parco: 'verde', orto: 'verde', roseto: 'verde',
    piazza: 'piazza', largo: 'piazza', piazzale: 'piazza', via: 'via', corso: 'via', viale: 'via', torre: 'torre', castello: 'castello',
    fontana: 'fontana', porta: 'porta', arco: 'porta', museo: 'museo', galleria: 'museo', pinacoteca: 'museo', teatro: 'teatro', monte: 'monte',
    terrazza: 'terrazza', belvedere: 'terrazza', ponte: 'ponte',
};
const VUOTE = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'l', 'di', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'd', 'e', 'ed', 'a', 'al', 'alla', 'in', 'ex', 'san', 'santa', 'santo', 'sant']);
function pezziNome(nome: string, citta: string): { proprie: string[]; famiglie: Set<string> } {
    const c = new Set(norm(citta).split(' ').filter(Boolean));
    const proprie: string[] = [], famiglie = new Set<string>();
    for (const w of norm(nome).replace(/'/g, ' ').split(' ').filter(Boolean)) {
        if (FAMIGLIE[w]) famiglie.add(FAMIGLIE[w]);
        else if (!VUOTE.has(w) && !c.has(w)) proprie.push(w);
    }
    return { proprie, famiglie };
}
/**
 * Due nomi dello stesso posto con parole di tipo diverse: «Chiesa Madre di Maria Santissima Assunta» ↔ «Ex cattedrale di Maria Santissima
 * Assunta (Troina)». Tolte le parole di tipo, gli articoli e la città restano le stesse parole (almeno una di 4 lettere); il tipo, se c'è
 * in tutti e due, è della stessa famiglia (una chiesa non è un giardino). Vale solo insieme alle coordinate (RAGGIO_VICINA_M).
 */
export function stessoNomeProprio(nome: string, titolo: string, citta = ''): boolean {
    const a = pezziNome(nome, citta), b = pezziNome(titolo, citta);
    if (!a.proprie.length || !a.proprie.some(w => w.length >= 4)) return false;
    if (a.proprie.length !== b.proprie.length || a.proprie.some(w => !b.proprie.includes(w))) return false;
    if (a.famiglie.size && b.famiglie.size && ![...a.famiglie].some(f => b.famiglie.has(f))) return false;
    return true;
}

const distanzaMDa = (t: TappaDaRaccontare, coords: unknown): number | null => {
    const cs = Array.isArray(coords) ? coords as Array<{ lat: number; lon: number }> : [];
    return cs.length ? Math.round(Math.min(...cs.map(c => kmFra({ lat: t.lat, lng: t.lng }, { lat: c.lat, lng: c.lon }) * 1000))) : null;
};

/** Il testo intero di una voce (explaintext, tutte le sezioni). Una voce per richiesta: Wikipedia non ne dà di più col testo intero. */
async function testoIntero(titolo: string, fetchImpl: Fetch): Promise<string | 'errore'> {
    const j = await wikiCall({ action: 'query', prop: 'extracts', explaintext: '1', titles: titolo, redirects: '1' }, fetchImpl);
    if (j === 'errore') return 'errore';
    return String(j?.query?.pages?.[0]?.extract ?? '');
}

/**
 * Le fonti di Wikipedia di una tappa che la ricerca per nome lascia senza fonti, o null. Tre strade, in quest'ordine, e la prima che dà
 * un testo vince (il chiamante decide poi, con la soglia di sempre, se basta):
 * 1. voce intera: la ricerca per nome ha trovato la voce giusta ma l'introduzione è corta (Porta Uzeda, 94 caratteri): il resto della voce;
 * 2. vicina: una voce entro RAGGIO_VICINA_M con lo stesso nome proprio (`stessoNomeProprio`) o compatibile (`nomeCompatibile`);
 * 3. menzioni: le voci che contengono il nome esatto, se stanno entro RAGGIO_CONTENITORE_M o sono la voce della città (entro RAGGIO_CITTA_KM):
 *    solo le frasi che nominano la tappa.
 * `errore` = Wikipedia non ha risposto: allora «nessuna voce» non è una risposta e il chiamante non memorizza.
 */
export async function allargaWikipedia(t: TappaDaRaccontare, trovata: FonteWikipedia | null, fetchImpl: Fetch): Promise<{ fonte: FonteWikipedia | null; errore: boolean }> {
    const nome = senzaParentesi(t.nome);
    if (!nome) return { fonte: null, errore: false };
    let errore = false;

    // 1. la voce giusta, per intero
    if (trovata) {
        const intero = await testoIntero(trovata.titolo, fetchImpl);
        if (intero === 'errore') errore = true;
        else {
            const testo = testoVoceIntera(intero);
            if (testo.length > trovata.testo.length) return { fonte: { ...trovata, testo, via: 'voce-intera' }, errore: false };
        }
    }

    // 2. una voce lì accanto con lo stesso nome proprio
    const vicine = await wikiCall({
        action: 'query', generator: 'geosearch', ggscoord: `${t.lat}|${t.lng}`, ggsradius: String(RAGGIO_VICINA_M), ggslimit: '20',
        prop: 'extracts|pageprops|coordinates', exintro: '1', explaintext: '1', exlimit: 'max', colimit: 'max', ppprop: 'disambiguation',
    }, fetchImpl);
    if (vicine === 'errore') errore = true;
    else {
        // deno-lint-ignore no-explicit-any
        const pagine: any[] = (vicine?.query?.pages || []).map((pg: any) => ({ ...pg, distanzaM: distanzaMDa(t, pg.coordinates) }))
            .filter((pg: any) => pg.distanzaM !== null && pg.distanzaM <= RAGGIO_VICINA_M && pg?.pageprops?.disambiguation === undefined)
            .sort((a: any, b: any) => a.distanzaM - b.distanzaM);
        for (const pg of pagine) {
            if (trovata && pg.title === trovata.titolo) continue;
            const titolo = senzaParentesi(pg.title);
            if (!nomeCompatibile(nome, titolo, t.citta) && !stessoNomeProprio(nome, titolo, t.citta)) continue;
            let testo = String(pg.extract || '').trim();
            const intero = await testoIntero(pg.title, fetchImpl);
            if (intero === 'errore') errore = true;
            else { const tutto = testoVoceIntera(intero); if (tutto.length > testo.length && testo.length < 200) testo = tutto; }
            if (testo) return { fonte: { titolo: pg.title, url: urlVoce(pg.title), testo, distanzaM: pg.distanzaM, via: 'vicina' }, errore: false };
        }
    }

    // 3. le voci che nominano la tappa: un monumento accanto, o la voce della città
    const cerca = nomeDaCercare(nome);
    if (nomePreciso(cerca)) {
        const trovate = await wikiCall({
            action: 'query', generator: 'search', gsrsearch: `"${cerca}"`, gsrlimit: '10', gsrnamespace: '0',
            prop: 'coordinates|pageprops', colimit: 'max', ppprop: 'disambiguation',
        }, fetchImpl);
        if (trovate === 'errore') errore = true;
        else {
            const citta = norm(t.citta);
            // deno-lint-ignore no-explicit-any
            const contenitori: any[] = (trovate?.query?.pages || []).map((pg: any) => ({ ...pg, distanzaM: distanzaMDa(t, pg.coordinates) }))
                .filter((pg: any) => pg?.pageprops?.disambiguation === undefined && pg.distanzaM !== null
                    && (pg.distanzaM <= RAGGIO_CONTENITORE_M || (citta && norm(pg.title) === citta && pg.distanzaM <= RAGGIO_CITTA_KM * 1000)))
                .sort((a: any, b: any) => a.distanzaM - b.distanzaM).slice(0, MAX_CONTENITORI);
            const frasi: string[] = [], viste = new Set<string>();
            let primo: { titolo: string; distanzaM: number } | null = null, n = 0;
            for (const pg of contenitori) {
                const intero = await testoIntero(pg.title, fetchImpl);
                if (intero === 'errore') { errore = true; continue; }
                for (const f of menzioniIn(intero, nome)) {
                    if (viste.has(norm(f)) || n + f.length + 1 > TESTO_MAX) continue;
                    viste.add(norm(f)); frasi.push(f); n += f.length + 1;
                    if (!primo) primo = { titolo: pg.title, distanzaM: pg.distanzaM };
                }
            }
            if (primo && frasi.length) return { fonte: { titolo: primo.titolo, url: urlVoce(primo.titolo), testo: frasi.join(' '), distanzaM: primo.distanzaM, via: 'menzioni' }, errore: false };
        }
    }
    return { fonte: null, errore };
}

/** La descrizione Google del posto da una risposta di places-proxy `place/details&fields=editorial_summary`; vuota se Google non ne ha una. */
// deno-lint-ignore no-explicit-any
export const descrizioneGoogleDa = (corpo: any): string => String(corpo?.result?.editorial_summary?.overview ?? '').replace(/\s+/g, ' ').trim();
