/**
 * C10 — LA CONOSCENZA DELLA CITTÀ: l'AI propone, Google verifica, le regole compongono.
 *
 * Una lista per città e per giorno, uguale per tutti gli utenti (non personalizzata): 15 posti proposti dall'AI
 * (nome esatto, momento adatto, essenziale | da locale, un perché in una riga), ognuno verificato su Google con la
 * stessa ricerca e la stessa maschera di campi del motore (places-proxy, «nome, città»). Entra solo un posto trovato,
 * con un nome compatibile, dentro il raggio della città e non chiuso per sempre; gli scartati restano col motivo.
 *
 * Modulo PURO (nessun import): lo usa openai-proxy (Deno) e lo prova la suite (vitest). Il «perché» resta qui e nella
 * tabella: non esce mai verso il client (decisione M: niente di quello che scrive l'AI arriva a schermo).
 */

// c10-1 → c10-2: il primo giro vero (Catania, 14/10) aveva per «essenziali» un caffè, una pasticceria e due mercati, e
// nessun monumento: il prompt ora dice che un essenziale è un luogo simbolo da vedere, mai un locale.
export const CITY_LIST_VERSION = 'c10-2';
export const POSTI_LISTA = 15;
export const MAX_ESSENZIALI = 4;
export const MOMENTI = ['colazione', 'mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'cena', 'dopocena'] as const;
export type Momento = typeof MOMENTI[number];
export type Tipo = 'essenziale' | 'da locale';

export type PostoProposto = { nome: string; citta: string; momento: Momento; tipo: Tipo; perche: string; giorni?: string; orari?: string };
// deno-lint-ignore no-explicit-any
export type RisultatoGoogle = Record<string, any>;

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** "Catania" → "catania"; accenti, apostrofi e spazi doppi via: la chiave della lista. */
export const normCitta = (s: unknown): string => String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[’`]/g, "'").replace(/[^a-z' -]/g, '').replace(/\s+/g, ' ').trim();

/** Una città accettabile come chiave: lettere, spazi, apostrofi e trattini, 2–60 caratteri. */
export const cittaValida = (s: unknown): boolean => typeof s === 'string' && /^[\p{L}' -]{2,60}$/u.test(s.trim());

/** Il giorno "AAAA-MM-GG", fra ieri e sette giorni da oggi (ora di Roma): la lista vale per quel giorno. */
export function giornoValido(giorno: unknown, oggi: string): boolean {
    if (typeof giorno !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(giorno)) return false;
    const g = Date.parse(`${giorno}T00:00:00Z`), o = Date.parse(`${oggi}T00:00:00Z`);
    if (!Number.isFinite(g) || !Number.isFinite(o)) return false;
    const d = Math.round((g - o) / 86400000);
    return d >= -1 && d <= 7;
}

/** "2026-10-15" → "giovedì 15 ottobre 2026". */
export function giornoParlato(giorno: string): string {
    const d = new Date(`${giorno}T12:00:00Z`);
    return `${GIORNI[d.getUTCDay()]} ${d.getUTCDate()} ${MESI[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ─── Il prompt (completo nel report C10) ────────────────────────────────────
export function promptCitta(citta: string, giorno: string): { system: string; user: string } {
    const quando = giornoParlato(giorno);
    const system = `Sei una persona nata e cresciuta a ${citta} che conosce la sua città strada per strada.
Ti chiedono quali posti di ${citta} vivere ${quando}: i simboli che non faresti mai saltare a un amico in visita, e i posti dove va davvero chi ci abita.

Rispondi SOLO con un JSON, senza testo fuori:
{"posti":[{"nome":"...","citta":"${citta}","momento":"colazione|mattina|pranzo|pomeriggio|aperitivo|cena|dopocena","tipo":"essenziale|da locale","perche":"...","giorni":"...","orari":"..."}]}

REGOLE
- Esattamente ${POSTI_LISTA} posti, tutti dentro ${citta} (non nei paesi intorno).
- "nome": il nome proprio esatto del posto, come compare su Google Maps. Niente indirizzi, niente descrizioni, niente zone generiche ("centro storico", "lungomare" senza nome).
- "tipo" "essenziale" (da 3 a ${MAX_ESSENZIALI}): i luoghi simbolo da vedere a ${citta} — monumenti, cattedrale e chiese, musei, castelli, teatri, piazze, strade storiche, mercati storici, giardini — anche se sono famosi. Un essenziale non è MAI un bar, un caffè, una pasticceria, un ristorante o un locale.
- "tipo" "da locale": tutti gli altri — dove va davvero chi ci abita: la colazione, il mercato, la trattoria, il bar dell'aperitivo, il posto del dopocena, un angolo che i turisti non conoscono.
- Se esistono a ${citta}, devono esserci: una colazione vera (il bar o la pasticceria dove i locali fanno colazione, momento "colazione"); un mercato, con i suoi giorni e orari nei campi "giorni" e "orari"; cosa fa un locale dopo cena (momento "dopocena").
- "momento": quando quel posto si vive meglio. Copri la giornata: colazione, mattina, pranzo, pomeriggio, aperitivo, cena, dopocena.
- Solo posti aperti ${quando}: un mercato che quel giorno non c'è, o un posto chiuso quel giorno, non va in lista.
- Niente catene, niente posti chiusi per sempre, niente posti inventati: se non sei sicuro che un posto esista con quel nome, non scriverlo.
- "perche": una riga, al massimo 90 caratteri, il motivo per cui un locale ci va.
- "giorni" e "orari" solo per i mercati; per gli altri posti ometti i due campi.`;
    const user = `Città: ${citta}. Giorno: ${quando}.`;
    return { system, user };
}

// ─── La risposta dell'AI, ripulita ──────────────────────────────────────────
const corto = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * La lista proposta, ripulita: al massimo 15 posti con nome, un momento valido, il tipo; al massimo 4 essenziali
 * (gli essenziali oltre il quarto diventano "da locale"); niente doppioni di nome.
 */
export function leggiLista(content: unknown, citta: string): PostoProposto[] {
    // deno-lint-ignore no-explicit-any
    let parsed: any = null;
    try { parsed = typeof content === 'string' ? JSON.parse(content) : content; } catch { return []; }
    const grezzi = Array.isArray(parsed?.posti) ? parsed.posti : Array.isArray(parsed) ? parsed : [];
    const out: PostoProposto[] = [];
    const visti = new Set<string>();
    let essenziali = 0;
    for (const p of grezzi) {
        const nome = corto(p?.nome, 80);
        if (!nome || nome.length < 2) continue;
        const chiave = normNome(nome);
        if (!chiave || visti.has(chiave)) continue;
        const momento = MOMENTI.includes(String(p?.momento || '').trim().toLowerCase() as Momento)
            ? String(p.momento).trim().toLowerCase() as Momento : null;
        if (!momento) continue;
        let tipo: Tipo = /essenzial/i.test(String(p?.tipo || '')) ? 'essenziale' : 'da locale';
        if (tipo === 'essenziale') { if (essenziali >= MAX_ESSENZIALI) tipo = 'da locale'; else essenziali += 1; }
        visti.add(chiave);
        out.push({
            nome, citta, momento, tipo, perche: corto(p?.perche, 160),
            ...(p?.giorni ? { giorni: corto(p.giorni, 80) } : {}), ...(p?.orari ? { orari: corto(p.orari, 80) } : {}),
        });
        if (out.length >= POSTI_LISTA) break;
    }
    return out;
}

// ─── La verifica su Google ──────────────────────────────────────────────────
const PAROLE_VUOTE = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'l', 'un', 'una', 'di', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'da', 'dal', 'dalla',
    'a', 'al', 'alla', 'e', 'ed', 'in', 'con', 'per', 'su', 'the', 'of', 'and', 'o', 'u', 'a']);
/** Il nome per il confronto: minuscolo, senza accenti e punteggiatura. */
export const normNome = (s: unknown): string => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[’`']/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const parole = (s: string, citta = '') => {
    const c = new Set(normNome(citta).split(' ').filter(Boolean));
    return normNome(s).split(' ').filter(w => w && !PAROLE_VUOTE.has(w) && !c.has(w));
};

// Parole che da sole non dicono quale posto è («Caffè Catania» ↔ «Costa Caffè Catania»): se il nome corto è fatto solo di
// queste, deve combaciare tutto (almeno due parole) o il nome deve essere uguale.
const GENERICHE = new Set(['caffe', 'bar', 'ristorante', 'trattoria', 'osteria', 'pizzeria', 'pasticceria', 'gelateria', 'mercato', 'piazza', 'chiesa',
    'museo', 'teatro', 'via', 'palazzo', 'cocktail', 'pub', 'enoteca', 'pesce', 'storico', 'storica', 'antico', 'antica', 'vecchio', 'vecchia',
    'centro', 'porta', 'parco', 'giardino', 'villa', 'castello', 'cucina', 'casa', 'bottega', 'forno', 'panificio', 'lounge', 'wine', 'food', 'street']);

/**
 * Il nome di Google è lo stesso posto del nome proposto? Le parole che contano del nome più corto (senza articoli,
 * preposizioni e il nome della città) stanno quasi tutte nell'altro: «Teatro Bellini» ↔ «Teatro Massimo Bellini»,
 * «Fera 'o Luni» ↔ «Market Fera O'Luni», «Pescheria» ↔ «Pescheria di Catania». Almeno 2/3, e almeno una parola.
 */
export function nomeCompatibile(proposto: string, google: string, citta = ''): boolean {
    const a = parole(proposto, citta), b = parole(google, citta);
    if (a.length === 0 || b.length === 0) {
        // un nome fatto solo della città ("Catania") o di parole vuote: compatibile solo se identico
        return normNome(proposto) !== '' && normNome(proposto) === normNome(google);
    }
    const [corto_, lungo] = a.length <= b.length ? [a, b] : [b, a];
    const set = new Set(lungo);
    // una parola vale anche se è l'inizio di un'altra lunga almeno 4 lettere ("benedettini" ↔ "benedettino")
    const dentro = corto_.filter(w => set.has(w) || (w.length >= 5 && lungo.some(x => x.length >= 5 && (x.startsWith(w.slice(0, -1)) || w.startsWith(x.slice(0, -1))))));
    if (dentro.length === 0 || dentro.length / corto_.length < 2 / 3) return false;
    // solo parole generiche in comune: vale se il nome corto combacia tutto e ha almeno due parole («Mercato del Pesce»)
    if (dentro.every(w => GENERICHE.has(w))) return dentro.length === corto_.length && corto_.length >= 2;
    return true;
}

/** Le 30 città più grandi: lo stesso elenco di src/services/tourShape.js (TOP_30_CITIES; un test li tiene uguali). */
export const TOP_30_CITIES = new Set([
    'roma', 'milano', 'napoli', 'torino', 'palermo', 'genova', 'bologna', 'firenze', 'bari', 'catania',
    'venezia', 'verona', 'messina', 'padova', 'trieste', 'brescia', 'taranto', 'parma', 'prato', 'modena',
    'reggio calabria', 'reggio emilia', 'perugia', 'livorno', 'ravenna', 'cagliari', 'foggia', 'rimini', 'salerno', 'ferrara',
]);
/** Il raggio della città: lo stesso raggio massimo del motore (widerRadiusKm: 20 km città, 12 km borgo). */
export const raggioCittaKm = (citta: string): number => (TOP_30_CITIES.has(String(citta || '').trim().toLowerCase()) ? 20 : 12);

export const kmFra = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
    const r = (x: number) => (x * Math.PI) / 180;
    const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
};

export type Verifica =
    | { ok: true; risultato: RisultatoGoogle; km: number }
    | { ok: false; motivo: string };

/**
 * Il primo risultato di Google che è davvero quel posto: nome compatibile, dentro il raggio, non chiuso per sempre.
 * Il motivo dello scarto dice la prima regola che manca: «non trovato» (Google non risponde nulla), «nome diverso»
 * (nessun risultato col nome compatibile), «fuori città» (un omonimo oltre il raggio), «chiuso per sempre».
 */
export function verificaPosto(p: { nome: string; citta: string }, risultati: RisultatoGoogle[] | null | undefined,
    centro: { lat: number; lng: number } | null, raggioKm: number): Verifica {
    const lista = Array.isArray(risultati) ? risultati.slice(0, 5) : [];
    if (lista.length === 0) return { ok: false, motivo: 'non trovato su Google' };
    const compatibili = lista.filter(r => nomeCompatibile(p.nome, String(r?.name || ''), p.citta));
    if (compatibili.length === 0) return { ok: false, motivo: `nome diverso (Google: «${corto(lista[0]?.name, 60)}»)` };
    let ultimo = '';
    for (const r of compatibili) {
        const lat = Number(r?.geometry?.location?.lat), lng = Number(r?.geometry?.location?.lng);
        if (!centro || !Number.isFinite(lat) || !Number.isFinite(lng)) { ultimo = 'senza coordinate'; continue; }
        const km = kmFra(centro, { lat, lng });
        if (km > raggioKm) { ultimo = `fuori città (${km.toFixed(1)} km, raggio ${raggioKm})`; continue; }
        if (String(r?.business_status || '') === 'CLOSED_PERMANENTLY') { ultimo = 'chiuso per sempre'; continue; }
        return { ok: true, risultato: r, km };
    }
    return { ok: false, motivo: ultimo || 'nome diverso' };
}

/** La voce verificata come la riceve il client: il risultato di Google (stessa forma della ricerca) + momento e tipo. Mai il perché. */
export function voceVerificata(p: PostoProposto, r: RisultatoGoogle): RisultatoGoogle {
    const { photos, ...resto } = r || {};
    return { ...resto, ...(Array.isArray(photos) && photos.length ? { photos: photos.slice(0, 1) } : {}), _citta: { momento: p.momento, tipo: p.tipo, nomeProposto: p.nome } };
}
