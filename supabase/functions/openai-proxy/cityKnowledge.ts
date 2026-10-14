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
// c10b-4 → c10b-5 (C10b3, decisione di Ivano): la lista ha una COMPOSIZIONE fissa, scritta come quote (luoghi da visitare
// prima dei locali), ogni posto dice la sua categoria, il simbolo e' sempre un luogo da visitare, e il codice controlla le
// quote sulla risposta: se mancano luoghi da visitare, una sola richiesta di completamento.
// c10b-5 → c10b-6 (C10b3-bis, decisione di Ivano): QUOTE CORRETTE per citta' e metropoli — le piazze monumentali e le vie
// storiche sono una categoria a se' (2–3, fuori dagli 8 luoghi da visitare), il belvedere al massimo 1, i mercati storici 1–2,
// le ancore possono essere una piazza o una via storica (il simbolo no), il dopocena e' obbligatorio; il completamento copre in
// UNA richiesta tutte le quote mancanti (luoghi, piazze e vie, ancore, dopocena). Il borgo non cambia.
// c10b-6 → c10b-7 (C10b3-ter, decisione di Ivano): la variante C del prompt, vincitrice della fase A0 — prima gli
// imperdibili (i luoghi che chiunque citerebbe, anche se ovvi), poi i posti da abitante; le ancore dagli imperdibili.
export const CITY_LIST_VERSION = 'c10b-7';
export const POSTI_LISTA = 18;
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
    /** C10b3 — la categoria del posto (CATEGORIE): decide le quote; nel borgo serve anche a riconoscerlo col nome di Google. */
    categoria?: string;
    /** C10b3 — nel borgo: la via principale, che vale come passeggiata. */
    passeggiata?: boolean;
    /** C10b3 — aggiunto dalla richiesta di completamento. */
    completamento?: boolean;
    /** C10b3-bis — un posto della lista diventato ancora con il completamento. */
    ancoraDalCompletamento?: boolean;
    /** C10b3-ter, variante C — uno degli imperdibili (prima parte della lista). */
    imperdibile?: boolean;
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

// ─── C10b3 / C10b3-bis — le categorie e le quote della lista (decisioni di Ivano) ─────────────────────────────────────
/** Le categorie di un posto della lista. */
export const CATEGORIE = ['chiesa', 'museo', 'monumento', 'palazzo', 'giardino', 'piazza', 'via', 'belvedere', 'mercato', 'colazione', 'ristorante', 'dopocena'] as const;
/** C10b3-bis — i LUOGHI DA VISITARE di citta' e metropoli: chiese, musei, monumenti, palazzi, giardini (piazze e vie storiche a parte). */
export const CATEGORIE_DA_VISITARE = new Set(['chiesa', 'museo', 'monumento', 'palazzo', 'giardino', 'parco']);
/** C10b3-bis — piazze monumentali e vie storiche: una categoria a se', che non conta fra i luoghi da visitare. */
export const CATEGORIE_STORICHE = new Set(['piazza', 'via']);
/** Il borgo resta come in C10b3: piazze e belvedere contano fra i luoghi da visitare, al massimo 2. */
const CATEGORIE_APERTE = new Set(['piazza', 'belvedere']);
export const CATEGORIE_LOCALE = new Set(['colazione', 'ristorante', 'dopocena', 'bar', 'pasticceria']);
/** Le quote di una lista di citta' o metropoli (C10b3-bis), e del borgo (C10b3, invariate). */
export const QUOTE = {
    visiteMin: 8, storicheMin: 2, storicheMax: 3, belvedereMax: 1, mercatiMax: 2,
    ancoreMin: 3, ancoreMax: 4, colazioniMin: 1, colazioniMax: 2, pastiMin: 2, dopocenaMin: 1,
    visitePerQuartiere: 3,
    borgo: { postiMax: 8, visiteMin: 4, piazzeBelvedereMax: 2, viaMax: 1 },
} as const;

// ─── C10b3-ter — tre varianti del prompt della lista (decisione di Ivano), provate su liste grezze (fase A0) ────────────
//   A — quella di C10b3-bis (v22);
//   B — 2 ancore per quartiere principale; quartieri e ancore «dove un abitante porta un amico la prima volta»;
//   C — due parti esplicite: prima GLI IMPERDIBILI (i luoghi che chiunque citerebbe, anche se ovvi: citta' 5–6, metropoli
//       6–8, a livello di citta'; il simbolo e' il piu' riconosciuto al mondo, un luogo da visitare), poi i posti da abitante;
//       le ancore si scelgono fra gli imperdibili.
// Quote, piazze e vie, mercati, dopocena e borgo sono gli stessi nelle tre. VARIANTE_LISTA e' quella in produzione.
export const VARIANTI_LISTA = ['A', 'B', 'C'] as const;
export type Variante = typeof VARIANTI_LISTA[number];
// C10b3-ter — la variante in produzione: C (fase A0 del 14/10, 24 liste grezze: essenziali di controllo in media A 4,75,
// B 4,00, C 5,00; quote rispettate 8/8 per C). Report: docs/prove/2026-10-17-c10b3ter-imperdibili.md
export const VARIANTE_LISTA: Variante = 'C';
/** C — quanti imperdibili: citta' 5–6, metropoli 6–8. */
export const IMPERDIBILI = { 'città': { min: 5, max: 6 }, metropoli: { min: 6, max: 8 } } as const;

// ─── Il prompt della lista (completo nei report C10, C10b e C10b3), scritto per la scala ──────────────────────────────
// Regola generale: nessun nome di città nel testo, se non quella chiesta.
export function promptCitta(citta: string, giorno: string, scala: Scala = 'città', variante: Variante = VARIANTE_LISTA): { system: string; user: string } {
    const quando = giornoParlato(giorno);
    const metropoli = scala === 'metropoli';
    const borgo = scala === 'borgo';
    // il borgo e' lo stesso nelle tre varianti
    const v: Variante = borgo ? 'A' : variante;
    const imp = metropoli ? IMPERDIBILI.metropoli : IMPERDIBILI['città'];
    const composizione = borgo
        ? `COMPOSIZIONE (rispettala):
- al massimo ${QUOTE.borgo.postiMax} posti, tutti dentro il comune di ${citta} (non nei paesi intorno): solo posti che esistono davvero, con il nome che hanno su Google Maps;
- almeno ${QUOTE.borgo.visiteMin} LUOGHI DA VISITARE: chiese, musei, monumenti, palazzi, giardini (piazze e belvedere al massimo ${QUOTE.borgo.piazzeBelvedereMax});
- la via principale del paese, una sola, con "categoria" "via": vale come passeggiata;
- il resto, se c'e': una colazione, un posto per mangiare.`
        : `COMPOSIZIONE (rispettala: i luoghi da visitare vengono prima dei locali):
- almeno ${QUOTE.visiteMin} LUOGHI DA VISITARE: chiese, musei, monumenti, palazzi, giardini (categoria "chiesa", "museo", "monumento", "palazzo" o "giardino");
- da ${QUOTE.storicheMin} a ${QUOTE.storicheMax} PIAZZE MONUMENTALI o VIE STORICHE (categoria "piazza" o "via"): quelle dove un abitante porta per prime un amico; si vivono camminando e non contano fra i luoghi da visitare;
- al massimo ${QUOTE.belvedereMax} belvedere;
- da 1 a ${QUOTE.mercatiMax} mercati storici, se esistono, con i loro giorni e orari nei campi "giorni" e "orari";
${v === 'C' ? `- PRIMA PARTE, GLI IMPERDIBILI: da ${imp.min} a ${imp.max} posti con "imperdibile": true, a livello di città${metropoli ? ' (prima di pensare ai quartieri; ognuno ha comunque il suo quartiere)' : ''}: i luoghi che chiunque citerebbe per ${citta}, anche se ovvi — luoghi da visitare, piazze o vie storiche, mai un locale. Scrivili per primi; contano nelle quote della loro categoria.
- SECONDA PARTE, I POSTI DA ABITANTE: tutto il resto della composizione, dove va davvero chi ci abita.
` : ''}- ${v === 'B' && metropoli ? `esattamente ${MAX_ESSENZIALI_QUARTIERE} ancore per ogni quartiere principale` : metropoli ? `da 1 a ${MAX_ESSENZIALI_QUARTIERE} ancore per quartiere (almeno ${QUOTE.ancoreMin} in tutto)` : `da ${QUOTE.ancoreMin} a ${QUOTE.ancoreMax} ancore`} ("tipo" "essenziale"): ${v === 'C' ? 'scelte FRA GLI IMPERDIBILI; fra loro il simbolo;' : `${v === 'B' ? 'i posti dove un abitante porta un amico la prima volta' : 'i posti che un abitante nomina per primi'}; possono essere un luogo da visitare, una piazza o una via storica, mai un locale; fra loro il simbolo;`}
- da ${QUOTE.colazioniMin} a ${QUOTE.colazioniMax} colazioni o caffè storici (momento "colazione");
- ${QUOTE.pastiMin} posti per pranzo o cena tipici;
- ${QUOTE.dopocenaMin} posto per il dopocena (momento "dopocena", categoria "dopocena"): è obbligatorio.
${metropoli ? `- Fino a ${POSTI_PER_SCALA.metropoli} posti in tutto, divisi in 3–5 quartieri camminabili${v === 'B' ? ': quelli dove un abitante porta un amico la prima volta in città' : ''} (ognuno si gira a piedi in una giornata): ogni quartiere principale ha almeno ${QUOTE.visitePerQuartiere} luoghi da visitare.` : `- Da 16 a ${POSTI_LISTA} posti in tutto, tutti dentro ${citta} (non nei paesi intorno).`}`;
    const quartiere = metropoli
        ? `\n- "quartiere": per ogni posto, il quartiere camminabile dove sta, col nome che usa chi ci abita (lo stesso nome per tutti i posti di quel quartiere).`
        : '';
    const simbolo = v === 'C'
        ? `- "simbolo": segna con "simbolo": true UN solo posto: l'imperdibile più riconosciuto al mondo di ${citta}, che dev'essere un luogo da visitare. Per gli altri posti ometti il campo.`
        : metropoli
        ? `- "simbolo": in ogni quartiere, segna con "simbolo": true l'essenziale che un abitante non ti perdonerebbe mai di aver saltato (uno per quartiere). Per gli altri posti ometti il campo.`
        : `- "simbolo": fra gli essenziali, segna con "simbolo": true il posto che un abitante non ti perdonerebbe mai di aver saltato (uno solo). Per gli altri posti ometti il campo.`;
    const chiedono = v === 'C'
        ? `Ti chiedono quali posti di ${citta} vivere ${quando}. La lista ha DUE PARTI, in quest'ordine: prima gli imperdibili, i luoghi che chiunque citerebbe per ${citta} anche se ovvi; poi i posti dove va davvero chi ci abita.`
        : v === 'B'
        ? `Ti chiedono quali posti di ${citta} vivere ${quando}: quelli dove porti un amico la prima volta che viene in città, e i posti dove va davvero chi ci abita.`
        : `Ti chiedono quali posti di ${citta} vivere ${quando}: i simboli che non faresti mai saltare a un amico in visita, e i posti dove va davvero chi ci abita.`;
    const system = `Sei una persona nata e cresciuta a ${citta} che conosce la sua città strada per strada.
${chiedono}

Rispondi SOLO con un JSON, senza testo fuori:
{"posti":[{"nome":"...","citta":"${citta}",${metropoli ? '"quartiere":"...",' : ''}"categoria":"${CATEGORIE.join('|')}","momento":"colazione|mattina|pranzo|pomeriggio|aperitivo|cena|dopocena","tipo":"essenziale|da locale",${v === 'C' ? '"imperdibile":true,' : ''}"simbolo":true,"perche":"...","giorni":"...","orari":"..."}]}

${composizione}

REGOLE${quartiere}
- "categoria": cos'e' il posto, una fra: ${CATEGORIE.join(', ')}.
- "nome": il nome proprio esatto del posto, come compare su Google Maps. Niente indirizzi, niente descrizioni, niente zone generiche ("centro storico", "lungomare" senza nome).
- "tipo" "essenziale" (da 3 a ${MAX_ESSENZIALI}${metropoli ? `; in una metropoli ${v === 'B' ? `${MAX_ESSENZIALI_QUARTIERE} per quartiere principale` : `da 1 a ${MAX_ESSENZIALI_QUARTIERE} per quartiere`}` : ''}): ${v === 'C' ? 'scelti fra gli imperdibili' : `${v === 'B' ? 'i posti dove chi ci abita porta un amico la prima volta' : 'i posti che chi ci abita nomina per primi'} — monumenti, cattedrale e chiese, musei, castelli, teatri, palazzi, giardini${borgo ? '' : ', le piazze monumentali e le vie storiche'} — anche se sono famosi`}. Un essenziale non è MAI un bar, un caffè, una pasticceria, un ristorante o un locale.${v === 'C' ? `
- "imperdibile": true solo per i posti della prima parte; per gli altri ometti il campo.` : ''}
${simbolo}
- Il simbolo è un luogo da visitare — un monumento, una chiesa o cattedrale, un museo, un castello, un teatro —, non una strada, una piazza o un locale.
- "tipo" "da locale": tutti gli altri — dove va davvero chi ci abita.
- "momento": quando quel posto si vive meglio. Copri la giornata: colazione, mattina, pranzo, pomeriggio, aperitivo, cena, dopocena.
- Solo posti aperti ${quando}: un mercato che quel giorno non c'è, o un posto chiuso quel giorno, non va in lista.
- Niente catene, niente posti chiusi per sempre, niente posti inventati: se non sei sicuro che un posto esista con quel nome, non scriverlo.
- "perche": una riga, al massimo 90 caratteri, il motivo per cui un locale ci va.
- "giorni" e "orari" solo per i mercati; per gli altri posti ometti i due campi.`;
    const user = `Città: ${citta}. Giorno: ${quando}.`;
    return { system, user };
}

// ─── La risposta dell'AI, ripulita ──────────────────────────────────────────
/**
 * Un simbolo per lista (per quartiere in una metropoli): il primo segnato resta, gli altri no; senza, il primo essenziale
 * che e' un luogo da visitare (`simboloDedotto`). Il simbolo non e' mai una piazza, una via, un belvedere, un mercato, un locale.
 */
function assegnaSimbolo(posti: PostoProposto[], metropoli: boolean) {
    const gruppi = new Map<string, PostoProposto[]>();
    for (const p of posti) if (p.tipo === 'essenziale') {
        const k = metropoli ? normNome(p.quartiere || '') : '';
        gruppi.set(k, [...(gruppi.get(k) || []), p]);
    }
    for (const ess of gruppi.values()) {
        const segnati = ess.filter(p => p.simbolo);
        for (const p of segnati.slice(1)) delete p.simbolo;
        const primo = ess.find(p => simboloPossibile(p.categoria || ''));
        if (segnati.length === 0 && primo) { primo.simbolo = true; primo.simboloDedotto = true; }
    }
}
const corto = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
/** C10b3 — un simbolo e' un luogo da visitare (senza categoria detta non si giudica). Mai piazza, belvedere, via, locale, mercato. */
const simboloPossibile = (categoria: string) => !categoria || (CATEGORIE_DA_VISITARE.has(categoria) && !CATEGORIE_APERTE.has(categoria)) || categoria === 'parco';

/**
 * La lista proposta, ripulita, secondo la scala (senza scala: città): al massimo 8 posti (borgo), 15 (città), 20
 * (metropoli), con nome, un momento valido, il tipo; al massimo 4 essenziali (in una metropoli 2 per quartiere, 8 in
 * tutto: gli altri diventano "da locale"); niente doppioni di nome. Il quartiere solo in una metropoli.
 * Il SIMBOLO: uno solo (in una metropoli uno per quartiere), sempre un essenziale. Se l'AI non l'ha segnato, lo diventa il
 * primo essenziale (del quartiere), con `simboloDedotto` (dichiarato nel report).
 */
export function leggiLista(content: unknown, citta: string, scala: Scala = 'città', variante: Variante = VARIANTE_LISTA): PostoProposto[] {
    // C10b3-ter — variante C: le ancore e il simbolo vengono solo dagli imperdibili (il borgo non ha imperdibili)
    const conImperdibili = variante === 'C' && scala !== 'borgo';
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
        // C10b3 — la categoria (tutte le scale): un essenziale che e' un locale non e' un essenziale
        const cat = String(p?.categoria || '').trim().toLowerCase();
        const categoria = (CATEGORIE as readonly string[]).includes(cat) || CATEGORIE_BORGO.includes(cat) ? cat : '';
        const imperdibile = conImperdibili && p?.imperdibile === true && !CATEGORIE_LOCALE.has(categoria);
        // il simbolo indicato fra gli imperdibili e' sempre un'ancora (se e' un luogo da visitare)
        const simboloImp = imperdibile && p?.simbolo === true && simboloPossibile(categoria);
        let tipo: Tipo = (/essenzial/i.test(String(p?.tipo || '')) || simboloImp) && !CATEGORIE_LOCALE.has(categoria) && (!conImperdibili || imperdibile)
            ? 'essenziale' : 'da locale';
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
            ...(categoria ? { categoria } : {}),
            // il simbolo e' sempre un luogo da visitare (mai un locale, una via, un mercato)
            ...(tipo === 'essenziale' && p?.simbolo === true && simboloPossibile(categoria) ? { simbolo: true } : {}),
            ...(imperdibile ? { imperdibile: true } : {}),
            ...(p?.giorni ? { giorni: corto(p.giorni, 80) } : {}), ...(p?.orari ? { orari: corto(p.orari, 80) } : {}),
        });
        if (out.length >= maxPosti) break;
    }
    // C10b3-ter, variante C — meno di 3 ancore: diventano ancore gli imperdibili che non lo sono, nell'ordine dell'AI (mai un
    // belvedere, dentro i tetti di sempre)
    if (conImperdibili) {
        for (const p of out) {
            if (out.filter(x => x.tipo === 'essenziale').length >= QUOTE.ancoreMin) break;
            if (!p.imperdibile || p.tipo === 'essenziale' || p.categoria === 'belvedere') continue;
            const q = normNome(p.quartiere || '');
            const nQ = out.filter(x => x.tipo === 'essenziale' && normNome(x.quartiere || '') === q).length;
            const nTot = out.filter(x => x.tipo === 'essenziale').length;
            if (metropoli ? (nTot < MAX_ESSENZIALI_METROPOLI && nQ < MAX_ESSENZIALI_QUARTIERE) : nTot < MAX_ESSENZIALI) p.tipo = 'essenziale';
        }
    }
    assegnaSimbolo(out, metropoli);
    // C10b3 — nel borgo la via principale (una sola) vale come passeggiata; C10b3-bis — in citta' e metropoli le vie storiche
    // (categoria «via») valgono come passeggiata
    if (scala === 'borgo') {
        const via = out.find(p => p.categoria === 'via');
        if (via) via.passeggiata = true;
    } else {
        for (const p of out) if (p.categoria === 'via') p.passeggiata = true;
    }
    return out;
}

// ─── C10b3 / C10b3-bis — le quote sulla risposta, e una sola richiesta di completamento ─────────────────────────────
/** Luogo da visitare: in citta' e metropoli chiese, musei, monumenti, palazzi, giardini; nel borgo (C10b3) anche piazze e belvedere. */
const eVisita = (p: PostoProposto, scala: Scala = 'città') =>
    CATEGORIE_DA_VISITARE.has(p.categoria || '') || (scala === 'borgo' && CATEGORIE_APERTE.has(p.categoria || ''));
const eStorica = (p: PostoProposto) => CATEGORIE_STORICHE.has(p.categoria || '');

/**
 * Le quote di una lista. Citta' e metropoli (C10b3-bis): almeno 8 luoghi da visitare, 2–3 piazze o vie storiche (fuori dagli
 * 8), belvedere al massimo 1, mercati al massimo 2, 3–4 ancore (in metropoli almeno 3, al massimo 2 per quartiere),
 * colazioni 1–2, pasti almeno 2, dopocena almeno 1; in metropoli almeno 3 luoghi da visitare per quartiere principale.
 * Borgo (C10b3, invariato): almeno 4 luoghi da visitare (piazze e belvedere contano, al massimo 2), al massimo 8 posti, la via.
 * `mancanti`: cosa chiede il completamento (luoghi da visitare, piazze e vie, ancore, dopocena); `mancano` = luoghi da visitare.
 */
export function quoteLista(posti: PostoProposto[], scala: Scala = 'città') {
    const borgo = scala === 'borgo';
    const visite = posti.filter(p => eVisita(p, scala));
    const aperte = visite.filter(p => CATEGORIE_APERTE.has(p.categoria || ''));
    const visiteContate = borgo ? visite.length - Math.max(0, aperte.length - QUOTE.borgo.piazzeBelvedereMax) : visite.length;
    const conta = (cats: string[]) => posti.filter(p => cats.includes(p.categoria || '')).length;
    const q = {
        posti: posti.length, visite: visiteContate, piazzeBelvedere: conta(['piazza', 'belvedere']),
        storiche: posti.filter(eStorica).length, belvedere: conta(['belvedere']),
        ancore: posti.filter(p => p.tipo === 'essenziale').length,
        ancoreNomi: posti.filter(p => p.tipo === 'essenziale').map(p => p.nome),
        simboli: posti.filter(p => p.simbolo).map(p => p.nome),
        colazioni: conta(['colazione', 'bar', 'pasticceria']), mercati: conta(['mercato']), pasti: conta(['ristorante']),
        dopocena: conta(['dopocena']), vie: conta(['via']),
        senzaCategoria: posti.filter(p => !p.categoria).length,
        perQuartiere: {} as Record<string, number>, mancano: 0, mancanoQuartieri: {} as Record<string, number>,
        mancanti: { visite: 0, storiche: 0, ancore: 0, dopocena: 0 },
        rispettate: [] as string[], mancate: [] as string[],
    };
    const minVisite = borgo ? QUOTE.borgo.visiteMin : QUOTE.visiteMin;
    q.mancano = Math.max(0, minVisite - q.visite);
    if (scala === 'metropoli') {
        const principali = new Set(posti.filter(p => p.tipo === 'essenziale' && p.quartiere).map(p => p.quartiere as string));
        for (const qn of principali) {
            const n = posti.filter(p => p.quartiere === qn && eVisita(p, scala)).length;
            q.perQuartiere[qn] = n;
            if (n < QUOTE.visitePerQuartiere) q.mancanoQuartieri[qn] = QUOTE.visitePerQuartiere - n;
        }
        q.mancano = Math.max(q.mancano, Object.values(q.mancanoQuartieri).reduce((a, n) => a + n, 0));
    }
    q.mancanti.visite = q.mancano;
    if (!borgo) {
        q.mancanti.storiche = Math.max(0, QUOTE.storicheMin - q.storiche);
        q.mancanti.ancore = Math.max(0, QUOTE.ancoreMin - q.ancore);
        q.mancanti.dopocena = Math.max(0, QUOTE.dopocenaMin - q.dopocena);
    }
    const voce = (ok: boolean, testo: string) => (ok ? q.rispettate : q.mancate).push(testo);
    voce(q.visite >= minVisite, `luoghi da visitare ≥ ${minVisite} (${q.visite})`);
    voce(q.simboli.length >= 1, `simbolo presente (${q.simboli.length})`);
    if (borgo) {
        voce(aperte.length <= QUOTE.borgo.piazzeBelvedereMax, `piazze e belvedere ≤ ${QUOTE.borgo.piazzeBelvedereMax} (${aperte.length})`);
        voce(q.posti <= QUOTE.borgo.postiMax, `posti ≤ ${QUOTE.borgo.postiMax} (${q.posti})`);
        voce(q.vie === QUOTE.borgo.viaMax, `via principale (${q.vie})`);
    } else {
        voce(q.storiche >= QUOTE.storicheMin && q.storiche <= QUOTE.storicheMax, `piazze e vie storiche ${QUOTE.storicheMin}–${QUOTE.storicheMax} (${q.storiche})`);
        voce(q.belvedere <= QUOTE.belvedereMax, `belvedere ≤ ${QUOTE.belvedereMax} (${q.belvedere})`);
        voce(scala === 'metropoli' ? q.ancore >= QUOTE.ancoreMin : (q.ancore >= QUOTE.ancoreMin && q.ancore <= QUOTE.ancoreMax),
            scala === 'metropoli' ? `ancore ≥ ${QUOTE.ancoreMin} (${q.ancore})` : `ancore ${QUOTE.ancoreMin}–${QUOTE.ancoreMax} (${q.ancore})`);
        voce(q.colazioni >= QUOTE.colazioniMin && q.colazioni <= QUOTE.colazioniMax, `colazioni ${QUOTE.colazioniMin}–${QUOTE.colazioniMax} (${q.colazioni})`);
        voce(q.mercati <= QUOTE.mercatiMax, `mercati ≤ ${QUOTE.mercatiMax} (${q.mercati})`);
        voce(q.pasti >= QUOTE.pastiMin, `pasti ≥ ${QUOTE.pastiMin} (${q.pasti})`);
        voce(q.dopocena >= QUOTE.dopocenaMin, `dopocena ≥ ${QUOTE.dopocenaMin} (${q.dopocena})`);
        if (scala === 'metropoli') voce(Object.keys(q.mancanoQuartieri).length === 0, `quartieri principali con ≥ ${QUOTE.visitePerQuartiere} luoghi da visitare (${Object.entries(q.perQuartiere).map(([k, n]) => `${k} ${n}`).join(', ') || '—'})`);
    }
    return q;
}
const daCompletare = (m: { visite: number; storiche: number; ancore: number; dopocena: number }) => m.visite + m.storiche + m.ancore + m.dopocena > 0;

/**
 * La richiesta di completamento (C10b3-bis): UNA sola, per tutte le quote mancanti insieme — luoghi da visitare (anche per
 * quartiere), piazze o vie storiche, ancore, dopocena. Un'ancora puo' essere anche un posto gia' in lista (si ripete il nome).
 */
export function promptCompletamento(citta: string, giorno: string, scala: Scala, posti: PostoProposto[],
    mancanti: { visite: number; storiche: number; ancore: number; dopocena: number }, quartieri: Record<string, number> = {},
    variante: Variante = VARIANTE_LISTA): { system: string; user: string } {
    const quando = giornoParlato(giorno);
    const conImperdibili = variante === 'C' && scala !== 'borgo';
    const metropoli = scala === 'metropoli';
    const doveQ = Object.entries(quartieri).map(([q, n]) => `${n} nel quartiere ${q}`).join(', ');
    const righe = [
        mancanti.visite > 0 ? `- ${mancanti.visite} LUOGHI DA VISITARE${doveQ ? ` (${doveQ})` : ''}: chiese, musei, monumenti, palazzi, giardini (categoria "chiesa", "museo", "monumento", "palazzo" o "giardino"), "tipo" "da locale";` : '',
        mancanti.storiche > 0 ? `- ${mancanti.storiche} PIAZZE MONUMENTALI o VIE STORICHE (categoria "piazza" o "via"), quelle dove un abitante porta per prime un amico;` : '',
        mancanti.ancore > 0 ? (conImperdibili
            ? `- ${mancanti.ancore} ANCORE ("tipo" "essenziale", "imperdibile": true): luoghi che chiunque citerebbe per ${citta}, anche se ovvi — un luogo da visitare, una piazza o una via storica, mai un locale. Possono essere posti già in lista: in quel caso ripeti il nome esatto con "tipo" "essenziale" e "imperdibile": true;`
            : `- ${mancanti.ancore} ANCORE ("tipo" "essenziale"): i posti che un abitante nomina per primi — un luogo da visitare, una piazza o una via storica, mai un locale. Possono essere posti già in lista: in quel caso ripeti il nome esatto con "tipo" "essenziale";`) : '',
        mancanti.dopocena > 0 ? `- ${mancanti.dopocena} posto per il DOPOCENA (categoria "dopocena", momento "dopocena"), dove va davvero chi ci abita;` : '',
    ].filter(Boolean).join('\n');
    const system = `Sei una persona nata e cresciuta a ${citta}. Alla lista dei posti di ${citta} per ${quando} mancano:
${righe}
Posti già in lista (non ripeterli, salvo per segnare un'ancora): ${posti.map(p => p.nome).join('; ')}.
Rispondi SOLO con un JSON {"posti":[{"nome":"...","citta":"${citta}",${metropoli ? '"quartiere":"...",' : ''}"categoria":"${CATEGORIE.join('|')}","momento":"colazione|mattina|pranzo|pomeriggio|aperitivo|cena|dopocena","tipo":"essenziale|da locale"${conImperdibili ? ',"imperdibile":true' : ''}}]}.
"nome": il nome esatto come compare su Google Maps. Solo posti aperti ${quando}, che esistono davvero: se non sei sicuro, non scriverlo.`;
    return { system, user: `Città: ${citta}.` };
}

/**
 * Controlla le quote e, se ne manca qualcuna fra luoghi da visitare, piazze e vie storiche, ancore, dopocena, fa UNA sola
 * richiesta di completamento (`chiedi(prompt)` → il testo dell'AI). Si prende solo cio' che manca, per categoria; un'ancora
 * nuova o ripetuta (un posto gia' in lista che non e' un locale) diventa essenziale, dentro i tetti; le aggiunte non sono mai
 * simbolo. Restituisce la lista, le quote prima e dopo, e cosa e' stato chiesto, aggiunto e promosso.
 */
export async function completaLista({ posti, scala, citta, giorno, chiedi, variante = VARIANTE_LISTA }: {
    posti: PostoProposto[]; scala: Scala; citta: string; giorno: string; chiedi: (p: { system: string; user: string }) => Promise<unknown>; variante?: Variante;
}) {
    const prima = quoteLista(posti, scala);
    if (!daCompletare(prima.mancanti)) return { posti, quotePrima: prima, quoteDopo: prima, completamento: null };
    const pr = promptCompletamento(citta, giorno, scala, posti, prima.mancanti, prima.mancanoQuartieri, variante);
    // C10b3-ter, variante C — un'ancora e' sempre un imperdibile (anche quella promossa dal completamento)
    const conImperdibili = variante === 'C' && scala !== 'borgo';
    const metropoli = scala === 'metropoli';
    const lista = posti.map(p => ({ ...p }));
    const aggiunti: PostoProposto[] = [];
    const promossi: string[] = [];
    let errore: string | null = null;
    try {
        const content = await chiedi(pr);
        const resta = { ...prima.mancanti };
        const restaQ = { ...prima.mancanoQuartieri };
        const essenziali = () => lista.filter(p => p.tipo === 'essenziale').length + aggiunti.filter(p => p.tipo === 'essenziale').length;
        const essDelQuartiere = (q: string) => [...lista, ...aggiunti].filter(p => p.tipo === 'essenziale' && normNome(p.quartiere || '') === normNome(q)).length;
        const puoEssereAncora = (p: PostoProposto) => resta.ancore > 0 && !CATEGORIE_LOCALE.has(p.categoria || '') && p.categoria !== 'belvedere'
            && (metropoli ? essenziali() < MAX_ESSENZIALI_METROPOLI && essDelQuartiere(p.quartiere || '') < MAX_ESSENZIALI_QUARTIERE : essenziali() < MAX_ESSENZIALI);
        const indice = new Map(lista.map(p => [normNome(p.nome), p]));
        for (const p of leggiLista(content, citta, scala, variante)) {
            const gia = indice.get(normNome(p.nome));
            const vuoleAncora = p.tipo === 'essenziale';
            if (gia) {
                // un'ancora ripetuta: un posto gia' in lista diventa essenziale
                if (vuoleAncora && gia.tipo !== 'essenziale' && puoEssereAncora(gia) && (!conImperdibili || gia.imperdibile || p.imperdibile)) {
                    gia.tipo = 'essenziale'; gia.ancoraDalCompletamento = true; resta.ancore--; promossi.push(gia.nome);
                    if (conImperdibili) gia.imperdibile = true;
                }
                continue;
            }
            const { simbolo: _s, simboloDedotto: _d, ...base } = p;
            let serve = false;
            // le aggiunte per i luoghi da visitare: mai piazze o belvedere (anche nel borgo, come in C10b3)
            if (CATEGORIE_DA_VISITARE.has(base.categoria || '') && resta.visite > 0) {
                serve = true; resta.visite--;
                if (base.quartiere && restaQ[base.quartiere] > 0) restaQ[base.quartiere]--;
            } else if (eStorica(base) && resta.storiche > 0) { serve = true; resta.storiche--; }
            else if (base.categoria === 'dopocena' && resta.dopocena > 0) { serve = true; resta.dopocena--; }
            const ancora = vuoleAncora && puoEssereAncora(base);
            if (!serve && !ancora) continue;
            if (ancora) resta.ancore--;
            const nuovo: PostoProposto = { ...base, tipo: ancora ? 'essenziale' : 'da locale', completamento: true };
            if (!metropoli) delete nuovo.quartiere;
            aggiunti.push(nuovo);
            indice.set(normNome(nuovo.nome), nuovo);
        }
    } catch (err) {
        errore = String((err as Error)?.message ?? err).slice(0, 80);
    }
    const tutti = [...lista, ...aggiunti];
    // un simbolo c'e' sempre, se un essenziale e' un luogo da visitare (le aggiunte non lo diventano: solo se manca)
    assegnaSimbolo(tutti, metropoli);
    return { posti: tutti, quotePrima: prima, quoteDopo: quoteLista(tutti, scala),
        completamento: { mancavano: prima.mancanti, quartieri: prima.mancanoQuartieri, aggiunti: aggiunti.map(p => p.nome), promossi, ...(errore ? { errore } : {}) } };
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
const FAMIGLIA_CATEGORIA: Record<string, string> = { chiesa: 'chiesa', monumento: 'monumento', museo: 'museo', piazza: 'piazza', mercato: 'mercato', bar: 'bar', pasticceria: 'bar', ristorante: 'ristorante', parco: 'parco',
    // C10b3 — le categorie della lista bilanciata
    palazzo: 'monumento', giardino: 'parco', belvedere: 'monumento', via: 'piazza', colazione: 'bar', dopocena: 'bar' };
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
            // C10b3 — la categoria, la via principale del borgo, il posto aggiunto dal completamento
            ...(p.categoria ? { categoria: p.categoria } : {}), ...(p.passeggiata ? { passeggiata: true } : {}), ...(p.completamento ? { completamento: true } : {}),
            ...(p.imperdibile ? { imperdibile: true } : {}),
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
// C10c-piena-2 — la lista del quartiere dice la categoria di ogni posto (piazze e vie storiche riconosciute dal motore): ha la sua
// versione, cosi' si rigenera solo lei e le liste delle citta' (CITY_LIST_VERSION) restano quelle del giorno.
export const QUARTIERE_LIST_VERSION = 'c10c-q2';
export const versioneQuartiere = (quartiere: string): string => `${QUARTIERE_LIST_VERSION}#q:${normCitta(quartiere)}`;

export function promptQuartiere(citta: string, quartiere: string, giorno: string): { system: string; user: string } {
    const quando = giornoParlato(giorno);
    const system = `Sei una persona nata e cresciuta a ${citta} che conosce il quartiere ${quartiere} strada per strada.
Ti chiedono quali luoghi da visitare ci sono nel quartiere ${quartiere} di ${citta}, ${quando}: le cose da vedere, non i locali.

Rispondi SOLO con un JSON, senza testo fuori:
{"posti":[{"nome":"...","citta":"${citta}","quartiere":"${quartiere}","categoria":"${CATEGORIE.join('|')}","momento":"mattina|pomeriggio","tipo":"essenziale|da locale","simbolo":true}]}

REGOLE
- Da ${POSTI_QUARTIERE_MIN} a ${POSTI_QUARTIERE_MAX} luoghi da visitare, tutti dentro il quartiere ${quartiere} (non nei quartieri intorno): chiese e basiliche, monumenti, musei, palazzi, piazze storiche, giardini, belvederi, strade storiche.
- Mai un bar, un caffè, una pasticceria, un ristorante o un locale.
- "nome": il nome proprio esatto del posto, come compare su Google Maps. Niente indirizzi, niente descrizioni, niente zone generiche.
- "categoria": cos'e' il posto, una fra: ${CATEGORIE.join(', ')} (una piazza storica e' "piazza", una strada storica e' "via").
- "tipo" "essenziale" (da 1 a ${MAX_ESSENZIALI_QUARTIERE}): i simboli del quartiere; gli altri "da locale".
- "simbolo": segna con "simbolo": true l'essenziale che un abitante del quartiere non ti perdonerebbe mai di aver saltato (uno solo). Il simbolo è un luogo da visitare, non una strada né una piazza.
- "momento": "mattina" o "pomeriggio", quando quel posto si vive meglio.
- Solo posti aperti ${quando}. Niente posti chiusi per sempre, niente posti inventati: se non sei sicuro che un posto esista con quel nome, non scriverlo.`;
    const user = `Città: ${citta}. Quartiere: ${quartiere}. Giorno: ${quando}.`;
    return { system, user };
}

/** La lista del quartiere, ripulita: come una lista di metropoli, al massimo 8 posti, tutti col nome del quartiere chiesto. */
export function leggiListaQuartiere(content: unknown, citta: string, quartiere: string): PostoProposto[] {
    return leggiLista(content, citta, 'metropoli', 'A').slice(0, POSTI_QUARTIERE_MAX).map(p => ({ ...p, quartiere }));
}
