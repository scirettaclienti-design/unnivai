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
// c10-2 → c10b-1 → c10b-2 (C10b; c10b-2: la scala la propone l'AI con gli abitanti, la regola la applica il codice, e il
// prompt della lista e' scritto per quella scala — vedi promptScala): la SCALA del luogo (borgo, città, metropoli: decisione di Ivano), il quartiere camminabile di ogni
// posto in una metropoli, e il SIMBOLO (il posto che un abitante non ti perdonerebbe di saltare) fra gli essenziali.
// c10b-2 → c10b-3 (C10b2): il modello della lista e' quello di modelli.ts (gpt-6.1-sol), e il borgo dice la categoria di ogni
// posto (per accettare il nome di Google con la stessa categoria). Il prompt di citta' e metropoli non cambia.
// c10b-3 → c10b-4: il tempo massimo del modello della lista passa da 28 a 60 s (con 28 s le liste del 14/10 ripiegavano su
// gpt-4o-mini): le liste c10b-3 del giorno sono di gpt-4o-mini e non si riusano.
export const CITY_LIST_VERSION = 'c10b-4';
export const POSTI_LISTA = 15;
export const MAX_ESSENZIALI = 4;
export const SCALE = ['borgo', 'città', 'metropoli'] as const;
export type Scala = typeof SCALE[number];
/** Quanti posti per scala: un borgo al massimo 8, una città 15, una metropoli fino a 20. */
export const POSTI_PER_SCALA: Record<Scala, number> = { borgo: 8, 'città': POSTI_LISTA, metropoli: 20 };
/** In una metropoli gli essenziali sono per quartiere: al massimo 2 per quartiere, 8 in tutto. */
export const MAX_ESSENZIALI_METROPOLI = 8;
export const MAX_ESSENZIALI_QUARTIERE = 2;
/** Il raggio del comune per un borgo (lo stesso raggio di base del motore per un borgo, applyRadiusFilter: 5 km). */
export const RAGGIO_BORGO_KM = 5;
export const MOMENTI = ['colazione', 'mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'cena', 'dopocena'] as const;
export type Momento = typeof MOMENTI[number];
export type Tipo = 'essenziale' | 'da locale';

export type PostoProposto = {
    nome: string; citta: string; momento: Momento; tipo: Tipo; perche: string; giorni?: string; orari?: string;
    quartiere?: string; simbolo?: boolean; simboloDedotto?: boolean;
    /** C10b2 — solo nel borgo: la categoria del posto (CATEGORIE_BORGO), per riconoscerlo col nome che ha su Google. */
    categoria?: string;
};
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

// ─── C10b — la scala proposta: l'AI dice gli abitanti, il codice ne ricava la scala ────────────────────────────────────
// Con la scala chiesta a parole (c10b-1) gpt-4o-mini rispondeva «città» per tutte (anche Roma e Troina), e con la regola
// scritta nel prompt («meno di 30000 abitanti → borgo») scriveva «Troina, 10000 abitanti, città»: il numero lo sa, la
// regola non la applica. Ora una chiamata minuscola chiede SOLO gli abitanti; la regola la applica il codice, e il
// prompt della lista e' scritto per quella scala (nessuna condizione da valutare). Il motore poi conferma col diametro.
export const ABITANTI_BORGO_MAX = 30000;
export const ABITANTI_METROPOLI_MIN = 800000;

export function promptScala(citta: string): { system: string; user: string } {
    return {
        system: 'Rispondi SOLO con un JSON {"abitanti": numero}: quanti abitanti ha il comune italiano indicato (il comune, non l\'area metropolitana), un numero intero circa.',
        user: `Comune: ${citta}.`,
    };
}

/** Gli abitanti scritti dall'AI, o null. */
export function leggiAbitanti(content: unknown): number | null {
    // deno-lint-ignore no-explicit-any
    let parsed: any = null;
    try { parsed = typeof content === 'string' ? JSON.parse(content) : content; } catch { return null; }
    const n = Number(String(parsed?.abitanti ?? '').replace(/[^\d]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** La scala proposta dagli abitanti: meno di 30.000 borgo, almeno 800.000 metropoli, altrimenti città (senza numero: città). */
export const scalaDaAbitanti = (n: number | null): Scala => (n === null ? 'città' : n < ABITANTI_BORGO_MAX ? 'borgo' : n >= ABITANTI_METROPOLI_MIN ? 'metropoli' : 'città');

// ─── Il prompt della lista (completo nei report C10 e C10b), scritto per la scala ──────────────────────────────────────
// Regola generale: nessun nome di città nel testo, se non quella chiesta.
export function promptCitta(citta: string, giorno: string, scala: Scala = 'città'): { system: string; user: string } {
    const quando = giornoParlato(giorno);
    const metropoli = scala === 'metropoli';
    const borgo = scala === 'borgo';
    const quanti = borgo
        ? `- Al massimo ${POSTI_PER_SCALA.borgo} posti, tutti dentro il comune di ${citta} (non nei paesi intorno): solo posti che esistono davvero, con il nome che hanno su Google Maps. Meglio 4 veri che 8 incerti.`
        : metropoli
            ? `- Fino a ${POSTI_PER_SCALA.metropoli} posti, tutti dentro ${citta}, divisi in 3–5 quartieri camminabili (ognuno si gira a piedi in una giornata). Ogni quartiere ha almeno 3 posti.`
            : `- Esattamente ${POSTI_PER_SCALA['città']} posti, tutti dentro ${citta} (non nei paesi intorno).`;
    const quartiere = metropoli
        ? `\n- "quartiere": per ogni posto, il quartiere camminabile dove sta, col nome che usa chi ci abita (lo stesso nome per tutti i posti di quel quartiere).`
        : '';
    const essenziali = metropoli
        ? `- "tipo" "essenziale" (da 1 a ${MAX_ESSENZIALI_QUARTIERE} per quartiere): i luoghi simbolo da vedere nel quartiere — monumenti, cattedrale e chiese, musei, castelli, teatri, piazze, strade storiche, mercati storici, giardini — anche se sono famosi. Un essenziale non è MAI un bar, un caffè, una pasticceria, un ristorante o un locale.`
        : `- "tipo" "essenziale" (da 3 a ${MAX_ESSENZIALI}): i luoghi simbolo da vedere a ${citta} — monumenti, cattedrale e chiese, musei, castelli, teatri, piazze, strade storiche, mercati storici, giardini — anche se sono famosi. Un essenziale non è MAI un bar, un caffè, una pasticceria, un ristorante o un locale.`;
    const simbolo = metropoli
        ? `- "simbolo": in ogni quartiere, segna con "simbolo": true l'essenziale che un abitante non ti perdonerebbe mai di aver saltato (uno per quartiere). Per gli altri posti ometti il campo.`
        : `- "simbolo": fra gli essenziali, segna con "simbolo": true il posto che un abitante non ti perdonerebbe mai di aver saltato (uno solo). Per gli altri posti ometti il campo.`;
    // il simbolo e' un luogo che si visita: una piazza o una strada per Google spesso e' una via (C7: una zona non e' una tappa)
    const simboloLuogo = `- Il simbolo è un luogo da visitare — un monumento, una chiesa o cattedrale, un museo, un castello, un teatro —, non una strada né una piazza.`;
    const system = `Sei una persona nata e cresciuta a ${citta} che conosce la sua città strada per strada.
Ti chiedono quali posti di ${citta} vivere ${quando}: i simboli che non faresti mai saltare a un amico in visita, e i posti dove va davvero chi ci abita.

Rispondi SOLO con un JSON, senza testo fuori:
{"posti":[{"nome":"...","citta":"${citta}",${metropoli ? '"quartiere":"...",' : ''}${borgo ? `"categoria":"${CATEGORIE_BORGO.join('|')}",` : ''}"momento":"colazione|mattina|pranzo|pomeriggio|aperitivo|cena|dopocena","tipo":"essenziale|da locale","simbolo":true,"perche":"...","giorni":"...","orari":"..."}]}

REGOLE
${quanti}${quartiere}${borgo ? `\n- "categoria": cos'e' il posto, una fra: ${CATEGORIE_BORGO.join(', ')}.` : ''}
- "nome": il nome proprio esatto del posto, come compare su Google Maps. Niente indirizzi, niente descrizioni, niente zone generiche ("centro storico", "lungomare" senza nome).
${essenziali}
${simbolo}
${simboloLuogo}
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
 * La lista proposta, ripulita, secondo la scala (senza scala: città): al massimo 8 posti (borgo), 15 (città), 20
 * (metropoli), con nome, un momento valido, il tipo; al massimo 4 essenziali (in una metropoli 2 per quartiere, 8 in
 * tutto: gli altri diventano "da locale"); niente doppioni di nome. Il quartiere solo in una metropoli.
 * Il SIMBOLO: uno solo (in una metropoli uno per quartiere), sempre un essenziale. Se l'AI non l'ha segnato, lo diventa il
 * primo essenziale (del quartiere), con `simboloDedotto` (dichiarato nel report).
 */
export function leggiLista(content: unknown, citta: string, scala: Scala = 'città'): PostoProposto[] {
    // deno-lint-ignore no-explicit-any
    let parsed: any = null;
    try { parsed = typeof content === 'string' ? JSON.parse(content) : content; } catch { return []; }
    const grezzi = Array.isArray(parsed?.posti) ? parsed.posti : Array.isArray(parsed) ? parsed : [];
    const out: PostoProposto[] = [];
    const visti = new Set<string>();
    const metropoli = scala === 'metropoli';
    const maxPosti = POSTI_PER_SCALA[scala] ?? POSTI_LISTA;
    let essenziali = 0;
    const perQuartiere = new Map<string, number>();
    for (const p of grezzi) {
        const nome = corto(p?.nome, 80);
        if (!nome || nome.length < 2) continue;
        const chiave = normNome(nome);
        if (!chiave || visti.has(chiave)) continue;
        const momento = MOMENTI.includes(String(p?.momento || '').trim().toLowerCase() as Momento)
            ? String(p.momento).trim().toLowerCase() as Momento : null;
        if (!momento) continue;
        const quartiere = metropoli ? corto(p?.quartiere, 60) : '';
        const q = normNome(quartiere);
        let tipo: Tipo = /essenzial/i.test(String(p?.tipo || '')) ? 'essenziale' : 'da locale';
        if (tipo === 'essenziale') {
            const pieno = metropoli
                ? (essenziali >= MAX_ESSENZIALI_METROPOLI || (perQuartiere.get(q) || 0) >= MAX_ESSENZIALI_QUARTIERE)
                : essenziali >= MAX_ESSENZIALI;
            if (pieno) tipo = 'da locale';
            else { essenziali += 1; perQuartiere.set(q, (perQuartiere.get(q) || 0) + 1); }
        }
        visti.add(chiave);
        out.push({
            nome, citta, momento, tipo, perche: corto(p?.perche, 160),
            ...(quartiere ? { quartiere } : {}),
            ...(scala === 'borgo' && CATEGORIE_BORGO.includes(String(p?.categoria || '').trim().toLowerCase()) ? { categoria: String(p.categoria).trim().toLowerCase() } : {}),
            ...(tipo === 'essenziale' && p?.simbolo === true ? { simbolo: true } : {}),
            ...(p?.giorni ? { giorni: corto(p.giorni, 80) } : {}), ...(p?.orari ? { orari: corto(p.orari, 80) } : {}),
        });
        if (out.length >= maxPosti) break;
    }
    // un simbolo per lista (per quartiere in una metropoli): il primo segnato resta, gli altri no; senza, il primo essenziale
    const gruppi = new Map<string, PostoProposto[]>();
    for (const p of out) if (p.tipo === 'essenziale') {
        const k = metropoli ? normNome(p.quartiere || '') : '';
        gruppi.set(k, [...(gruppi.get(k) || []), p]);
    }
    for (const ess of gruppi.values()) {
        const segnati = ess.filter(p => p.simbolo);
        for (const p of segnati.slice(1)) delete p.simbolo;
        if (segnati.length === 0 && ess[0]) { ess[0].simbolo = true; ess[0].simboloDedotto = true; }
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

// ─── C10b2 — il borgo: il nome di Google con la stessa categoria ─────────────────────────────────────────────────────
// Decisione di Ivano: in un borgo l'AI conosce i posti ma non il loro nome su Google («Cattedrale di Troina» ↔ «Chiesa Madre
// di Maria Santissima Assunta»). Se nessun risultato ha un nome compatibile, si accetta il primo dentro il comune (raggio e
// indirizzo) con la STESSA CATEGORIA di quella proposta dall'AI; la sostituzione si scrive (proposto, Google, categoria).
export const CATEGORIE_BORGO = ['chiesa', 'monumento', 'museo', 'piazza', 'mercato', 'bar', 'pasticceria', 'ristorante', 'parco'];
// le categorie che per Google sono la stessa cosa (un castello o una torre e' un monumento; una pasticceria e' spesso un bar)
const FAMIGLIA_CATEGORIA: Record<string, string> = { chiesa: 'chiesa', monumento: 'monumento', museo: 'museo', piazza: 'piazza', mercato: 'mercato', bar: 'bar', pasticceria: 'bar', ristorante: 'ristorante', parco: 'parco' };
/** La categoria (famiglia) di un risultato di Google dai suoi tipi, o null. L'ordine conta: il piu' specifico prima. */
export function categoriaGoogle(r: RisultatoGoogle): string | null {
    const tipi = [String(r?.primary_type || ''), ...(Array.isArray(r?.types) ? r.types.map(String) : [])].filter(Boolean);
    const ha = (re: RegExp) => tipi.some(t => re.test(t));
    if (ha(/church|place_of_worship|cathedral|chapel|mosque|synagogue/)) return 'chiesa';
    if (ha(/museum|art_gallery/)) return 'museo';
    if (ha(/restaurant|meal_takeaway|pizzeria|trattoria/)) return 'ristorante';
    if (ha(/^bar$|cafe|coffee|bakery|pastry|dessert|ice_cream|confectioner/)) return 'bar';
    if (ha(/market/)) return 'mercato';
    if (ha(/park|garden/)) return 'parco';
    if (ha(/plaza|^route$/)) return 'piazza';
    if (ha(/castle|fortress|historical_landmark|monument|tourist_attraction|landmark/)) return 'monumento';
    return null;
}

export type Verifica =
    | { ok: true; risultato: RisultatoGoogle; km: number; sostituzione?: { proposto: string; google: string; categoria: string } }
    | { ok: false; motivo: string };

/** La sigla della provincia dall'indirizzo di Google ("94018 Troina EN, Italia" → "EN"), o null. */
export function provinciaDa(indirizzo: unknown): string | null {
    const m = String(indirizzo ?? '').match(/\b\d{5}\s+[^,]*?\s([A-Z]{2})\b/);
    return m ? m[1] : null;
}

/** La ricerca della verifica: «nome, città»; per un borgo «nome, comune, provincia» (un nome generico di un borgo esiste in mille paesi). */
export const queryVerifica = (p: { nome: string }, citta: string, scala: Scala | null, provincia: string | null): string =>
    (scala === 'borgo' && provincia ? `${p.nome}, ${citta}, ${provincia}` : `${p.nome}, ${citta}`);

/** Il raggio della verifica: un borgo il raggio del comune (5 km), una città o una metropoli quello del motore (20 / 12 km). */
export const raggioVerificaKm = (citta: string, scala: Scala | null): number => (scala === 'borgo' ? RAGGIO_BORGO_KM : raggioCittaKm(citta));

/** L'indirizzo di Google e' nel comune? Il nome del comune (senza accenti) sta fra le parti dell'indirizzo. */
export function nelComune(indirizzo: unknown, comune: string): boolean {
    const c = normNome(comune);
    if (!c) return false;
    return ` ${normNome(indirizzo)} `.includes(` ${c} `);
}

/**
 * Il primo risultato di Google che è davvero quel posto: nome compatibile, dentro il raggio, non chiuso per sempre.
 * Il motivo dello scarto dice la prima regola che manca: «non trovato» (Google non risponde nulla), «nome diverso»
 * (nessun risultato col nome compatibile), «fuori città» (un omonimo oltre il raggio), «chiuso per sempre».
 * C10b — con `comune` (un borgo): anche l'indirizzo deve essere nel comune, altrimenti «fuori comune». Mai un posto fuori comune.
 */
export function verificaPosto(p: { nome: string; citta: string; categoria?: string }, risultati: RisultatoGoogle[] | null | undefined,
    centro: { lat: number; lng: number } | null, raggioKm: number, { comune = null }: { comune?: string | null } = {}): Verifica {
    const lista = Array.isArray(risultati) ? risultati.slice(0, 5) : [];
    if (lista.length === 0) return { ok: false, motivo: 'non trovato su Google' };
    const compatibili = lista.filter(r => nomeCompatibile(p.nome, String(r?.name || ''), p.citta));
    if (compatibili.length === 0) {
        // C10b2 — nel borgo: il nome di Google con la stessa categoria, dentro il comune
        const fam = p.categoria ? FAMIGLIA_CATEGORIA[p.categoria] : null;
        if (comune && fam && centro) {
            for (const r of lista) {
                if (categoriaGoogle(r) !== fam) continue;
                const lat = Number(r?.geometry?.location?.lat), lng = Number(r?.geometry?.location?.lng);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
                const km = kmFra(centro, { lat, lng });
                if (km > raggioKm || !nelComune(r?.formatted_address, comune) || String(r?.business_status || '') === 'CLOSED_PERMANENTLY') continue;
                return { ok: true, risultato: r, km, sostituzione: { proposto: p.nome, google: corto(r?.name, 80), categoria: p.categoria as string } };
            }
        }
        return { ok: false, motivo: `nome diverso (Google: «${corto(lista[0]?.name, 60)}»)` };
    }
    let ultimo = '';
    for (const r of compatibili) {
        const lat = Number(r?.geometry?.location?.lat), lng = Number(r?.geometry?.location?.lng);
        if (!centro || !Number.isFinite(lat) || !Number.isFinite(lng)) { ultimo = 'senza coordinate'; continue; }
        const km = kmFra(centro, { lat, lng });
        if (km > raggioKm) { ultimo = `fuori ${comune ? 'comune' : 'città'} (${km.toFixed(1)} km, raggio ${raggioKm})`; continue; }
        if (comune && !nelComune(r?.formatted_address, comune)) { ultimo = `fuori comune (indirizzo: «${corto(r?.formatted_address, 60) || 'nessuno'}»)`; continue; }
        if (String(r?.business_status || '') === 'CLOSED_PERMANENTLY') { ultimo = 'chiuso per sempre'; continue; }
        return { ok: true, risultato: r, km };
    }
    return { ok: false, motivo: ultimo || 'nome diverso' };
}

/** La voce verificata come la riceve il client: il risultato di Google (stessa forma della ricerca) + momento, tipo, quartiere, simbolo. Mai il perché. */
export function voceVerificata(p: PostoProposto, r: RisultatoGoogle, sostituzione: { proposto: string; google: string; categoria: string } | null = null): RisultatoGoogle {
    const { photos, ...resto } = r || {};
    return {
        ...resto, ...(Array.isArray(photos) && photos.length ? { photos: photos.slice(0, 1) } : {}),
        _citta: {
            momento: p.momento, tipo: p.tipo, nomeProposto: p.nome,
            ...(p.quartiere ? { quartiere: p.quartiere } : {}), ...(p.simbolo ? { simbolo: true } : {}), ...(p.simboloDedotto ? { simboloDedotto: true } : {}),
            // C10b2 — nel borgo: il nome di Google accettato per la stessa categoria (scritto nel tracciato)
            ...(sostituzione ? { sostituzione } : {}),
        },
    };
}

// ─── C10b2 — la lista dedicata di un quartiere chiesto (decisione di Ivano) ──────────────────────────────────────────
// Se la richiesta nomina un quartiere che nella lista ha meno di 3 luoghi da visitare, una chiamata AI dedicata ne propone
// 6–8 in quel quartiere, verificati su Google come la lista. Una per citta', giorno e quartiere, uguale per tutti (stessa
// tabella, versione `c10b-3#q:<quartiere>`).
export const POSTI_QUARTIERE_MIN = 6;
export const POSTI_QUARTIERE_MAX = 8;
export const versioneQuartiere = (quartiere: string): string => `${CITY_LIST_VERSION}#q:${normCitta(quartiere)}`;

export function promptQuartiere(citta: string, quartiere: string, giorno: string): { system: string; user: string } {
    const quando = giornoParlato(giorno);
    const system = `Sei una persona nata e cresciuta a ${citta} che conosce il quartiere ${quartiere} strada per strada.
Ti chiedono quali luoghi da visitare ci sono nel quartiere ${quartiere} di ${citta}, ${quando}: le cose da vedere, non i locali.

Rispondi SOLO con un JSON, senza testo fuori:
{"posti":[{"nome":"...","citta":"${citta}","quartiere":"${quartiere}","momento":"mattina|pomeriggio","tipo":"essenziale|da locale","simbolo":true}]}

REGOLE
- Da ${POSTI_QUARTIERE_MIN} a ${POSTI_QUARTIERE_MAX} luoghi da visitare, tutti dentro il quartiere ${quartiere} (non nei quartieri intorno): chiese e basiliche, monumenti, musei, palazzi, piazze storiche, giardini, belvederi, strade storiche.
- Mai un bar, un caffè, una pasticceria, un ristorante o un locale.
- "nome": il nome proprio esatto del posto, come compare su Google Maps. Niente indirizzi, niente descrizioni, niente zone generiche.
- "tipo" "essenziale" (da 1 a ${MAX_ESSENZIALI_QUARTIERE}): i simboli del quartiere; gli altri "da locale".
- "simbolo": segna con "simbolo": true l'essenziale che un abitante del quartiere non ti perdonerebbe mai di aver saltato (uno solo). Il simbolo è un luogo da visitare, non una strada né una piazza.
- "momento": "mattina" o "pomeriggio", quando quel posto si vive meglio.
- Solo posti aperti ${quando}. Niente posti chiusi per sempre, niente posti inventati: se non sei sicuro che un posto esista con quel nome, non scriverlo.`;
    const user = `Città: ${citta}. Quartiere: ${quartiere}. Giorno: ${quando}.`;
    return { system, user };
}

/** La lista del quartiere, ripulita: come una lista di metropoli, al massimo 8 posti, tutti col nome del quartiere chiesto. */
export function leggiListaQuartiere(content: unknown, citta: string, quartiere: string): PostoProposto[] {
    return leggiLista(content, citta, 'metropoli').slice(0, POSTI_QUARTIERE_MAX).map(p => ({ ...p, quartiere }));
}
