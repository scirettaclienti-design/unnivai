/**
 * DNA-3 — LA RICHIESTA ESPLICITA VINCE SUL DNA.
 *
 * Due parole, definite qui una volta sola (e nel report):
 *
 *  · RICHIESTA ESPLICITA — tutto cio' che l'utente ha detto o scelto:
 *      categorie  (testo libero, categoria del traduttore, opzioni del Quiz, interessi di Crea),
 *      luoghi per nome (il testo nomina il posto),
 *      esclusioni (`vincoli.escludi` del traduttore: «niente chiese»),
 *      budget, durata, ritmo, compagnia, zona/quartiere, momento del giorno.
 *  · SCELTA LIBERA — tutto il resto: quale fra i posti ammessi, il locale del pasto, la tappa
 *      di riempimento, l'ordine a parita' di richiesta.
 *
 * La regola, in parole semplici: la richiesta filtra e ordina per prima; il DNA decide solo fra
 * le scelte libere (e, dentro quello che hai chiesto, quale scegliere). Il DNA non puo' mai
 * portare dentro una categoria esclusa ne' togliere un posto chiesto.
 *
 * Qui solo funzioni PURE (nessuna rete, nessun storage). Il peso del DNA (0 → 0,45 secondo la
 * fiducia, DNA-2) non cambia: cambia solo CHE COSA il DNA puo' spostare.
 */

const norm = (v) => String(v ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Le parole con cui l'utente nomina un tipo di luogo → categorie del DNA, tipi Google e nome.
 * Una sola tabella per tre usi: testo libero, `escludi`, `queries` del traduttore.
 *  - `cats`  : categorie di base del DNA (per «chiesto»).
 *  - `types` : tipi Google (precisi: «niente chiese» non esclude i musei).
 *  - `nome`  : il nome del posto, quando Google non ne dice il tipo.
 */
export const TIPI_NOMINATI = [
    { id: 'chiese', re: /\b(chies[ae]|basilic\w*|duom[oi]|cattedral\w*|santuar\w*|abbazi\w*|luoghi? di culto|luoghi? religios\w*)/,
        cats: ['cultura'], types: ['church', 'place_of_worship', 'hindu_temple', 'mosque', 'synagogue'],
        nome: /^(chiesa|basilica|duomo|cattedrale|santuario|abbazia|cappella)\b/ },
    { id: 'musei', re: /\b(muse[oi]|pinacotec\w*)/,
        cats: ['cultura', 'arte'], types: ['museum'], nome: /^(museo|pinacoteca)\b/ },
    { id: 'gallerie', re: /\b(galleri[ae]|street art|mostr[ae]|arte)\b/,
        cats: ['arte'], types: ['art_gallery'], nome: /^galleria\b/ },
    { id: 'storia', re: /\b(storia|storic\w*|monument\w*|castell\w*|archeolog\w*|cultura)\b/,
        cats: ['cultura'], types: ['historical_landmark', 'monument', 'castle'], nome: null },
    { id: 'cibo', re: /\b(ristorant\w*|trattori\w*|osteri\w*|pizzeri\w*|cibo|gusto|sapori|mangiar\w*|gastronom\w*|street ?food|gelaterie?|pasticcer\w*|cucina)\b/,
        cats: ['food'], types: ['restaurant', 'meal_takeaway', 'meal_delivery', 'bakery', 'ice_cream_shop'], nome: null },
    { id: 'bar', re: /\b(bar|enotec\w*|wine bar|cocktail|pub|aperitiv\w*)\b/,
        cats: ['nightlife'], types: ['bar'], nome: null },
    { id: 'notte', re: /\b(discotec\w*|club|vita notturna|locali notturni)\b/,
        cats: ['nightlife'], types: ['night_club', 'casino'], nome: null },
    { id: 'natura', re: /\b(parc[oh]\w*|giardin\w*|verde|natura|spiagg\w*|lid[oi]|cale|villa comunale|orto botanico)\b/,
        cats: ['natura'], types: ['park', 'natural_feature', 'beach', 'national_park', 'hiking_area', 'garden', 'campground'], nome: /^(parco|giardin[oi]|villa comunale|orto botanico|spiaggia)\b/ },
    { id: 'shopping', re: /\b(negoz\w*|bottegh\w*|boutique|shopping|fashion|moda|mercat\w*)\b/,
        cats: ['shopping'], types: ['store', 'shopping_mall', 'clothing_store', 'shoe_store', 'jewelry_store', 'book_store', 'department_store', 'market'], nome: null },
    { id: 'panorami', re: /\b(belveder\w*|panoram\w*|terrazz\w*|affacci\w*|relax|benessere|terme|spa)\b/,
        cats: ['relax'], types: ['spa', 'wellness_center', 'viewpoint'], nome: null },
    { id: 'avventura', re: /\b(trekking|escursion\w*|sport|avventur\w*)\b/,
        cats: ['avventura'], types: ['amusement_park', 'stadium', 'sports_complex', 'hiking_area'], nome: null },
];

// La categoria del traduttore (`intent.categoria`) → categorie di base del DNA.
// «misto», «famiglia», «romantico»: non nominano un tipo di luogo, non chiedono niente.
const CATEGORIA_TRADUTTORE = {
    natura: ['natura'], cibo: ['food'], storia: ['cultura'], cultura: ['cultura'], arte: ['arte', 'cultura'],
    shopping: ['shopping'], nightlife: ['nightlife'], relax: ['relax'],
};
// Gli interessi di Crea (chip) e del Quiz → categorie di base.
const INTERESSE_CATEGORIE = {
    arte: ['arte', 'cultura'], cibo: ['food'], 'street food': ['food'], storia: ['cultura'], chiese: ['cultura'],
    natura: ['natura'], shopping: ['shopping'], 'vita notturna': ['nightlife'], panorami: ['relax'],
    'scoperte urbane': [], // categoria generica del Sorprendimi: non nomina un tipo di luogo
};

const voci = (testo) => TIPI_NOMINATI.filter(v => v.re.test(norm(testo)));

// «niente chiese», «senza ristoranti», «evita i musei»: la parola e' dentro una negazione, quindi e' un'esclusione.
const NEGAZIONE = /(?:^|\s)(?:niente|nessun\w*|non|senza|evit\w+|esclud\w+|tranne|eccetto|no)\s+(?:[a-z']+\s+){0,2}$/;
/** Le voci nominate in una frase, divise fra chieste (positive) e negate (esclusioni). */
export function vociDelTesto(testo) {
    const t = norm(testo);
    const chieste = [];
    const negate = [];
    for (const v of TIPI_NOMINATI) {
        const re = new RegExp(v.re.source, 'g');
        let m; let positiva = false; let negata = false;
        while ((m = re.exec(t)) !== null) {
            if (NEGAZIONE.test(t.slice(Math.max(0, m.index - 32), m.index))) negata = true; else positiva = true;
            if (m.index === re.lastIndex) re.lastIndex += 1;
        }
        if (positiva) chieste.push(v);
        if (negata) negate.push(v);
    }
    return { chieste, negate };
}

const unici = (a) => [...new Set(a)];

/**
 * La richiesta esplicita di un giro.
 * @param {object} p
 * @param {object|null} p.intent    risposta del traduttore ({ categoria, queries, vincoli:{escludi,tempo,note} })
 * @param {string}      p.testo     la frase dell'utente (solo dove e' scritta da lui: Crea; per Quiz e Sorprendimi il testo e' costruito dalle opzioni e passa dal traduttore)
 * @param {object}      p.prefs     opzioni scelte (durata, ritmo, compagnia, budget, interessi)
 * @param {string}      p.pathType  'custom' (Crea) | 'quick' (Quiz) | undefined (Sorprendimi, Per Te)
 * @returns {{ chieste:string[], catsTesto:string[], tipiChiesti:string[], nomiChiesti:string[], escluse:string[], tipiEsclusi:string[], nomiEsclusi:string[], testoNomi:string,
 *             vincoli:{ budget:?string, durata:?string, ritmo:?string, compagnia:?string, momento:?string }, vuota:boolean }}
 */
export function richiestaEsplicita({ intent = null, testo = '', prefs = null, pathType = undefined } = {}) {
    // `chieste`: categorie larghe (dal traduttore e dai chip di Crea). Le parole del testo sono precise: tipo Google o nome
    // («solo musei» chiede i musei, non ogni luogo di cultura); le loro categorie servono solo a non nominarle nel profilo.
    const chieste = [];
    const catsTesto = [];
    const tipiChiesti = [];
    const nomiChiesti = [];
    const aggiungi = (v) => { tipiChiesti.push(...v.types); if (v.nome) nomiChiesti.push(v.nome.source); };

    // 1. La categoria che il traduttore ha letto dalla frase / dalle opzioni del Quiz.
    for (const c of CATEGORIA_TRADUTTORE[norm(intent?.categoria)] || []) chieste.push(c);
    // Le `queries` del traduttore NON sono richiesta: davanti a una frase vaga («una giornata a Roma», «sorprendimi») il
    // traduttore le riempie da solo (piazza storica, trattoria, belvedere). Contano solo le parole dell'utente e le sue scelte.
    // 3. Il testo: solo in Crea e' la frase dell'utente. Quiz e Sorprendimi lo costruiscono dalle opzioni
    //    (con parole come «storiche» nel modello): li' la richiesta e' la categoria del traduttore.
    const testoUtente = pathType === 'custom' ? String(testo || '') : '';
    const dalTesto = vociDelTesto(testoUtente);
    for (const v of dalTesto.chieste) { aggiungi(v); catsTesto.push(...v.cats); }
    // 4. Gli interessi scelti nelle opzioni: i chip di Crea (mai precompilati) e le voci del Quiz (buildQuickPrefs). In
    //    Sorprendimi gli interessi, senza un tema cliccato, vengono dal DNA stesso: li' non sono una richiesta.
    if (pathType === 'custom' || pathType === 'quick') {
        for (const i of Array.isArray(prefs?.interests) ? prefs.interests : []) {
            for (const c of INTERESSE_CATEGORIE[norm(i)] || []) chieste.push(c);
            for (const v of voci(i)) chieste.push(...v.cats);
        }
    }

    // Le esclusioni: SOLO tipi precisi (mai una categoria intera) e SOLO se non sono anche chieste.
    const escluse = [];
    const tipiEsclusi = [];
    const nomiEsclusi = [];
    const escludi = (v) => { escluse.push(...v.cats); tipiEsclusi.push(...v.types); if (v.nome) nomiEsclusi.push(v.nome.source); };
    for (const e of Array.isArray(intent?.vincoli?.escludi) ? intent.vincoli.escludi : []) for (const v of voci(e)) escludi(v);
    // ... e quelle scritte nel testo con una negazione, anche se il traduttore non le ha messe in `escludi`
    for (const v of dalTesto.negate) escludi(v);

    const vincoli = {
        budget: prefs?.budget || null,
        durata: prefs?.duration || null,
        ritmo: prefs?.pace || null,
        compagnia: prefs?.group || null,
        momento: intent?.vincoli?.tempo || null,
    };
    const r = {
        chieste: unici(chieste), catsTesto: unici(catsTesto), tipiChiesti: unici(tipiChiesti), nomiChiesti: unici(nomiChiesti),
        escluse: unici(escluse), tipiEsclusi: unici(tipiEsclusi), nomiEsclusi: unici(nomiEsclusi),
        testoNomi: norm(testoUtente), vincoli, vuota: false,
    };
    // `vuota`: nessuna categoria, nessun tipo, nessuna esclusione. Il testo (per i luoghi nominati) ha il suo campo, `testoNomi`.
    r.vuota = r.chieste.length === 0 && r.tipiChiesti.length === 0 && r.nomiChiesti.length === 0 && r.tipiEsclusi.length === 0 && r.nomiEsclusi.length === 0;
    return r;
}

// Parole che da sole non individuano un posto.
const GENERICHE = new Set(['il', 'lo', 'la', 'le', 'i', 'gli', 'di', 'del', 'della', 'dei', 'delle', 'da', 'a', 'al', 'alla', 'in', 'e', 'san', 'santa', 'sant',
    'piazza', 'via', 'chiesa', 'museo', 'palazzo', 'teatro', 'villa', 'parco', 'giardino', 'castello', 'basilica', 'duomo', 'cattedrale', 'ristorante', 'trattoria', 'bar']);

/** Il testo nomina questo posto (per nome intero, o per la parte che lo distingue)? */
export function luogoNominato(candidate, testoNorm) {
    if (!testoNorm) return false;
    const nome = norm(candidate?.name || candidate?.title);
    if (nome.length < 4) return false;
    if (testoNorm.includes(nome)) return true;
    const distintive = nome.split(/[^a-z0-9]+/).filter(p => p.length >= 3 && !GENERICHE.has(p));
    // almeno due parole che lo distinguono (o una lunga): «teatro massimo» → «massimo» non basta da sola, «castello ursino» → «ursino» si
    if (distintive.length === 0) return false;
    const trovate = distintive.filter(p => new RegExp(`\\b${p}\\b`).test(testoNorm));
    return trovate.length === distintive.length && (distintive.length >= 2 || distintive[0].length >= 6);
}

const tipiDi = (c) => (Array.isArray(c?.types) ? c.types : []).map(t => String(t).toLowerCase());

/**
 * Lo stato di un candidato rispetto alla richiesta.
 *  'escluso' — e' di un tipo che l'utente ha escluso (vince su tutto, anche su «chiesto»);
 *  'chiesto' — e' di un tipo chiesto, o e' nominato per nome;
 *  'libero'  — tutto il resto: qui il DNA decide.
 * @param {object} c candidato (types, name)
 * @param {object} r richiesta (richiestaEsplicita)
 * @param {(c:object)=>Set<string>} categorieDi categorie di base del candidato (iniettata: mapCandidateToCoreCategories)
 */
export function statoCandidato(c, r, categorieDi = () => new Set()) {
    if (!r || (r.vuota && !r.testoNomi)) return 'libero';
    const tipi = tipiDi(c);
    const nome = norm(c?.name || c?.title);
    if (r.tipiEsclusi.length && tipi.some(t => r.tipiEsclusi.includes(t))) return 'escluso';
    if (r.nomiEsclusi.length && r.nomiEsclusi.some(src => new RegExp(src).test(nome))) return 'escluso';
    if (luogoNominato(c, r.testoNomi)) return 'chiesto';
    if (r.tipiChiesti.length && tipi.some(t => r.tipiChiesti.includes(t))) return 'chiesto';
    if (r.nomiChiesti.length && r.nomiChiesti.some(src => new RegExp(src).test(nome))) return 'chiesto';
    if (r.chieste.length) { for (const cat of categorieDi(c)) if (r.chieste.includes(cat)) return 'chiesto'; }
    return 'libero';
}
