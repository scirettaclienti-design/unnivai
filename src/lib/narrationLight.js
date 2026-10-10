/**
 * Gate NARRATORE-DOPO — parole di luce e di ora, controllate dal CODICE.
 *
 * Il narratore riceve l'orario di arrivo di ogni tappa e l'alba e il tramonto
 * del giorno, ma resta un modello: puo' scrivere "al tramonto" su una tappa
 * delle 10:00. Qui ogni frase che nomina una luce o un'ora viene confrontata
 * con l'orario di arrivo; se non torna, la frase viene TOLTA. Mai riscritta: il
 * codice non scrive racconto, toglie solo quello che e' falso.
 *
 * ─── LE REGOLE ───────────────────────────────────────────────────────────────
 *   · tramonto, sole che cala, ora d'oro  → da 60 minuti prima a 45 dopo il
 *                                            tramonto vero (P3d-j: il gancio
 *                                            "sei qui N minuti prima" vale fino a 60)
 *   · alba, prime luci                    → entro 45 minuti dall'alba vera
 *   · notte, stelle, luna                 → dopo il tramonto + 30 min, o prima dell'alba
 *   · sole, controluce, ombra, pieno giorno → fra alba e tramonto (± 15 min);
 *                                            non si applica se la frase parla
 *                                            gia' di alba o tramonto
 *   · mattina, luce del mattino, colazione → fra l'alba - 45 e la fine della
 *                                            mattina (tabella dei momenti)
 *   · mezzogiorno, sole a picco           → 11:30–15:00
 *   · pranzo                              → dentro il pranzo della tabella, ± 60 min
 *   · pomeriggio                          → dalla fine della mattina alla fine
 *                                            dell'aperitivo
 *   · sera, stasera                       → dall'inizio dell'aperitivo - 60
 *                                            fino all'alba
 *   · cena                                → dall'inizio dell'aperitivo in poi
 *
 * Gli orari di fascia vengono dalla tabella unica (dayMoments.js); quelli di
 * luce da sunTimes.js. Il confronto si fa sull'orario civile di Roma.
 *
 * Una frase senza parole di luce o di ora resta sempre. Senza orario di arrivo
 * (o senza alba/tramonto) non si giudica niente: il testo resta com'e'.
 */

import { MOMENT_BY_KEY } from './dayMoments';
import { romeParts } from './tourWindow';

export const SUNSET_TOLERANCE_MINUTES = 45;
// P3d-j — prima del tramonto si arriva fino a un'ora: e' il gancio approvato
// "Il sole tramonta alle …: sei qui N minuti prima" (stopPhrases, 0–60 minuti).
export const SUNSET_BEFORE_MINUTES = 60;
const SUNRISE_TOLERANCE_MINUTES = 45;
const NIGHT_AFTER_SUNSET_MINUTES = 30;
const DAYLIGHT_MARGIN_MINUTES = 15;

const clock = ({ h, m }) => h * 60 + m;
const MATTINA_END = clock(MOMENT_BY_KEY.mattina.end);
const PRANZO = { start: clock(MOMENT_BY_KEY.pranzo.start), end: clock(MOMENT_BY_KEY.pranzo.end) };
const APERITIVO = { start: clock(MOMENT_BY_KEY.aperitivo.start), end: clock(MOMENT_BY_KEY.aperitivo.end) };

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'");

const minutesOfDay = (date) => { const p = romeParts(date); return p.h * 60 + p.mi; };

// Ogni regola: le parole che la attivano, e se l'arrivo `a` (minuti dalla
// mezzanotte di Roma) e' coerente. `sr`/`ss`: alba e tramonto, stessi minuti.
const RULES = [
    {
        key: 'tramonto',
        re: /\b(tramont\w*|calar del sole|sole (?:che )?(?:cala|scende)|ora d'oro|golden hour)\b/,
        ok: (a, { ss }) => a >= ss - SUNSET_BEFORE_MINUTES && a <= ss + SUNSET_TOLERANCE_MINUTES,
    },
    {
        key: 'alba',
        re: /\b(alba|albeggi\w*|prime luci|primo sole)\b/,
        ok: (a, { sr }) => Math.abs(a - sr) <= SUNRISE_TOLERANCE_MINUTES,
    },
    {
        key: 'notte',
        re: /\b(notte|stanotte|nottat\w*|notturn\w*|stelle|stellat\w*|luna)\b/,
        ok: (a, { sr, ss }) => a >= ss + NIGHT_AFTER_SUNSET_MINUTES || a < sr,
    },
    {
        key: 'sole',
        re: /\b(sole|soleggiat\w*|assolat\w*|controluce|ombra|pieno giorno|luce del giorno)\b/,
        skipIf: ['tramonto', 'alba'],
        ok: (a, { sr, ss }) => a >= sr - DAYLIGHT_MARGIN_MINUTES && a <= ss + DAYLIGHT_MARGIN_MINUTES,
    },
    {
        key: 'mattina',
        re: /\b(mattin\w*|mattutin\w*|stamattina|stamane|colazion\w*)\b/,
        ok: (a, { sr }) => a >= sr - SUNRISE_TOLERANCE_MINUTES && a < MATTINA_END,
    },
    {
        key: 'mezzogiorno',
        re: /\b(mezzogiorno|mezzodi|sole a picco|sole allo zenit|controra)\b/,
        ok: (a) => a >= 11 * 60 + 30 && a <= 15 * 60,
    },
    {
        key: 'pranzo',
        re: /\b(pranz\w*)\b/,
        ok: (a) => a >= PRANZO.start - 60 && a <= PRANZO.end + 60,
    },
    {
        key: 'pomeriggio',
        re: /\b(pomerigg\w*|pomeridian\w*)\b/,
        ok: (a) => a >= MATTINA_END && a <= APERITIVO.end,
    },
    {
        key: 'sera',
        re: /\b(sera|serata|serale|stasera|serali)\b/,
        ok: (a, { sr }) => a >= APERITIVO.start - 60 || a < sr,
    },
    {
        key: 'cena',
        re: /\b(cena|cenare|cenando)\b/,
        ok: (a, { sr }) => a >= APERITIVO.start || a < sr,
    },
];

/** Le regole violate da una frase, all'orario `a`. Vuoto = frase coerente. */
function violations(sentence, a, sun) {
    const t = norm(sentence);
    const hit = RULES.filter(r => r.re.test(t));
    const keys = new Set(hit.map(r => r.key));
    return hit
        .filter(r => !(r.skipIf || []).some(k => keys.has(k)))
        .filter(r => !r.ok(a, sun))
        .map(r => r.key);
}

// Frasi: si taglia dopo . ! ? … seguiti da spazio. La punteggiatura resta con
// la sua frase, cosi' rimettendo insieme le frasi tenute il testo e' identico
// all'originale meno quelle tolte.
const splitSentences = (text) => text.split(/(?<=[.!?…])\s+/).filter(s => s.trim().length > 0);

/**
 * @param {string|null} text
 * @param {{ arrival: Date|null, sunrise: Date|null, sunset: Date|null }} ctx
 * @returns {{ text: string|null, removed: Array<{ frase: string, regole: string[] }> }}
 */
export function filterTimeIncoherent(text, { arrival, sunrise, sunset } = {}) {
    if (text == null || String(text).trim() === '') return { text: null, removed: [] };
    const valid = (d) => d instanceof Date && !Number.isNaN(d.getTime());
    if (!valid(arrival) || !valid(sunrise) || !valid(sunset)) return { text: String(text), removed: [] };

    const sun = { sr: minutesOfDay(sunrise), ss: minutesOfDay(sunset) };
    const a = minutesOfDay(arrival);
    const kept = [];
    const removed = [];
    for (const s of splitSentences(String(text).trim())) {
        const v = violations(s, a, sun);
        if (v.length > 0) removed.push({ frase: s, regole: v });
        else kept.push(s);
    }
    if (removed.length === 0) return { text: String(text), removed };
    return { text: kept.length > 0 ? kept.join(' ') : null, removed };
}

// ─── Gate PAROLE VIETATE — dal log alla rimozione ───────────────────────────
//
// L'UNICO elenco delle parole vietate in TUTTO il testo generato: narratore
// dell'itinerario, tour "Per Te" della Home e notifiche. I prompt lo leggono da
// qui (bannedWordsPromptLines) e il filtro (filterBannedWords) toglie la frase
// che ne contiene una, in generazione e in lettura dalla cache.
//
// P3d-b — e' l'unione degli elenchi che fino all'08/10 vivevano separati:
//   · narratore e "Per Te": aggettivi da brochure;
//   · solo "Per Te": "ottima scelta", "perfetta scelta";
//   · prompt delle notifiche: aggettivi vuoti, verbi da menu, giudizi;
//   · filtro delle notifiche (JUDGMENT_PATTERNS): giudizi e "un must"/"una perla"…
// Il codice non sa giudicare il contesto: toglie la frase in ogni caso. Meglio
// una frase in meno che una frase da brochure a schermo — e dal P3d-c la frase
// tolta da una descrizione il modello la riscrive una volta (rewriteDescriptions).
//
// P3d-c — falsi positivi tolti dall'elenco: "consiglio" ("Consiglio: entra dal
// lato"), "unico/unica" come parola sola ("l'unica panchina all'ombra"; resta
// "esperienza unica"), "non perdere" ("per non perdere il bus"; resta "da non
// perdere"), "una scoperta" ("una scoperta archeologica"), "gusta" ("si gusta
// in piedi"; resta "assapora"). Aggiunte le frasi generiche.
export const BANNED_VOICE_WORDS = [
    // aggettivi da brochure (narratore, "Per Te")
    'storico', 'tradizionale', 'esperienza unica', 'caratteristico', 'suggestivo', 'tipico',
    'affascinante', 'magico', 'imperdibile',
    // aggettivi vuoti (notifiche)
    'spettacolare', 'indimenticabile', 'atmosfera intima', 'vista mozzafiato',
    // verbi da menu (notifiche)
    'sorseggia', 'immergiti', 'assapora',
    // giudizi e raccomandazioni ("Per Te", notifiche)
    'ottima scelta', 'perfetta scelta', 'ottima idea', 'ottimo posto',
    'vale la pena', 'da provare', 'consigliato', 'perfetto per',
    'ideale per', 'assolutamente da', 'da non perdere',
    'un must', 'una chicca', 'una perla', 'un gioiello',
    // frasi generiche (P3d-c): dicono che il posto e' interessante senza dire perche'
    'racconta una storia', 'raccontano storie', 'ogni angolo', 'viaggio nel tempo',
    'goditi', "è un'esperienza", 'raccontano molto',
];

/**
 * Le righe dell'elenco per il testo dei prompt (narratore, "Per Te", notifiche).
 * Una riga ogni 8 voci; la frase che ne contiene una viene tolta.
 */
export function bannedWordsPromptLines() {
    const q = (w) => `"${w}"`;
    const lines = [];
    for (let i = 0; i < BANNED_VOICE_WORDS.length; i += 8) {
        lines.push(BANNED_VOICE_WORDS.slice(i, i + 8).map(q).join(', '));
    }
    return `${lines.join(',\n')} — mai, in nessun campo: la frase che ne contiene una viene tolta.`;
}

// Varianti di genere/numero, avverbio e forme del verbo, dalla forma base:
//   storico → storico/storica/storici/storiche/storicamente
//   suggestivo → suggestivo/a/i/e/suggestivamente
//   tradizionale → tradizionale/i/tradizionalmente
//   affascinante → affascinante/i/affascinantemente
//   consigliato → consigliato/a/i/e
//   assapora (verbo) → assapora/assaporare/assaporate/assaporando/assaporano
//   racconta una storia / raccontano storie → raccontare (una) storia/storie,
//     in ogni forma del verbo: "sembrano raccontare storie" e' la stessa frase
// Parola intera (\b): "storia", "comunita'", "tipografia", "gusto" restano.
// Le voci si normalizzano come il testo (accenti, apostrofi): "è" → "e".
const VERBS = new Set(['sorseggia', 'assapora']);
const STORY_PATTERN = String.raw`raccont(?:a|ano|are|ando)\s+(?:una\s+|delle\s+|le\s+)?stori(?:a|e)`;
const variantPattern = (w) => {
    if (w === 'racconta una storia' || w === 'raccontano storie') return STORY_PATTERN;
    if (w.includes(' ')) return w.split(' ').join('\\s+');
    if (VERBS.has(w)) return `${w.slice(0, -1)}(?:a|are|ate|ando|ano)`;
    if (w.endsWith('co')) return `${w.slice(0, -1)}(?:o|a|i|he|amente)`;
    if (w.endsWith('vo')) return `${w.slice(0, -1)}(?:o|a|i|e|amente)`;
    if (w.endsWith('to')) return `${w.slice(0, -1)}(?:o|a|i|e)`;
    if (w.endsWith('le')) return `${w.slice(0, -1)}(?:e|i|mente)`;
    if (w.endsWith('e')) return `${w.slice(0, -1)}(?:e|i|emente)`;
    return w;
};
// Due voci con lo stesso schema ("racconta una storia", "raccontano storie")
// contano una volta sola: vale la prima.
const BANNED_RULES = [];
for (const w of BANNED_VOICE_WORDS) {
    const src = variantPattern(norm(w));
    if (!BANNED_RULES.some(r => r.src === src)) BANNED_RULES.push({ word: w, src, re: new RegExp(`\\b${src}\\b`) });
}

// ─── P3d-b — niente attacchi da audioguida ──────────────────────────────────
//
// Una frase che APRE con un'impressione dei sensi ("L'aria…", "Il profumo…",
// "Camminando senti…") viene tolta, come una parola vietata. Conta solo
// l'apertura: "Bastano pochi passi per togliersi la folla" resta, e resta
// anche "Dal muretto il panorama arriva fino al Gianicolo" (non apre col
// panorama). "Venti minuti" non e' il vento: le parole sono intere.
export const SENSORY_OPENERS = ['profumo', 'odore', 'aria', 'vento', 'silenzio', 'panorama', 'camminando senti'];
const SENSORY_OPENER_RE = new RegExp(
    String.raw`^[\s"'«“(]*(?:(?:il|lo|la|l'|i|gli|le|un|una|un'|che|quel|quell'|quella|questo|questa)\s*)?` +
    String.raw`(?:profum[oi]|odor[ei]|aria|vento|silenzio|panorama|camminando\b[^.!?…]*?\bsent\w*)\b`,
);

/** true se la frase apre con un'impressione dei sensi. */
export function opensWithSenses(sentence) {
    return SENSORY_OPENER_RE.test(norm(sentence).replace(/\s+/g, ' ').trim());
}

// Gate PAROLE VIETATE (P3d) — eccezioni FISSE: espressioni che contengono una
// parola vietata ma non sono linguaggio da brochure. Si neutralizzano prima del
// controllo; il resto della frase si controlla normalmente, quindi "Il centro
// storico e' magico" viene tolta per "magico". L'altra eccezione e' il nome
// proprio della tappa (opzione `exempt`): "Museo Storico della Liberazione" e'
// un nome, non un aggettivo.
export const BANNED_WORD_FIXED_EXCEPTIONS = ['centro storico', 'centri storici'];
const FIXED_EXCEPTION_RES = [/\bcentr[oi]\s+storic[oi]\b/g];

const neutralize = (normalized, exempt) => {
    let t = normalized;
    for (const re of FIXED_EXCEPTION_RES) t = t.replace(re, ' ');
    for (const name of exempt) {
        const n = norm(name || '').replace(/\s+/g, ' ').trim();
        if (n) t = t.split(n).join(' ');
    }
    return t;
};

/**
 * Toglie le frasi che contengono una parola vietata, e (P3d-b) quelle che aprono
 * con un'impressione dei sensi. Mai riscritte; un testo fatto solo di frasi
 * tolte diventa null (nessun testo sostitutivo).
 * @param {string|null} text
 * @param {{ exempt?: string[] }} [opts] nomi propri (es. il nome della tappa)
 *   che non fanno scattare il filtro delle parole
 * @returns {{ text: string|null, removed: Array<{ frase: string, parole: string[], regola: 'parola-vietata'|'apertura-sensi' }> }}
 */
export function filterBannedWords(text, { exempt = [] } = {}) {
    if (text == null || String(text).trim() === '') return { text: null, removed: [] };
    const kept = [];
    const removed = [];
    for (const s of splitSentences(String(text).trim())) {
        const t = neutralize(norm(s).replace(/\s+/g, ' '), exempt);
        const parole = BANNED_RULES.filter(r => r.re.test(t)).map(r => r.word);
        if (parole.length > 0) removed.push({ frase: s, parole, regola: 'parola-vietata' });
        else if (opensWithSenses(s)) removed.push({ frase: s, parole: [], regola: 'apertura-sensi' });
        else kept.push(s);
    }
    if (removed.length === 0) return { text: String(text), removed };
    return { text: kept.length > 0 ? kept.join(' ') : null, removed };
}

// ─── P3d-e — oggetti concreti: solo se i fatti o il nome li nominano ─────────
//
// Il controllo in codice anti-invenzione. Una frase della descrizione che
// nomina un oggetto concreto di questo elenco resta solo se l'oggetto compare
// nei fatti della tappa o nel suo nome; altrimenti si toglie (e la descrizione
// va alla riscrittura, una volta; se fallisce ancora, frase sicura dal codice).
// `re`: come l'oggetto si riconosce nella frase; `ok`: come si riconosce nei
// fatti e nel nome (piu' largo: "Pinacoteca" nei fatti ammette i quadri).
// Elenco esplicito e testato uno per uno (narrationLight.test / fattiAncorati.test).
export const CONCRETE_OBJECTS = [
    // natura
    { nome: 'albero', re: /\balber[oi]\b|\balberat[oi]\b/, ok: /\balber/ },
    { nome: 'pini', re: /\bpin[oi]\b/, ok: /\bpin[oi]\b|\bpinet/ },
    { nome: 'palme', re: /\bpalm[ae]\b/, ok: /\bpalm[ae]\b/ },
    { nome: 'ulivi', re: /\b(?:ulivi?|ulivo|olivi?|olivo)\b/, ok: /\b(?:uliv|oliv)/ },
    { nome: 'aranci', re: /\baranc(?:i|io)\b/, ok: /\baranc/ },
    { nome: 'giardino', re: /\bgiardin[oi]\b/, ok: /\bgiardin/ },
    { nome: 'prato', re: /\bprat[oi]\b/, ok: /\bprat[oi]\b/ },
    { nome: 'fiori', re: /\b(?:fior[ei]|fioritur[ae]|aiuol[ae]|roseto)\b/, ok: /\b(?:fior|aiuol|roset)/ },
    { nome: 'laghetto', re: /\b(?:laghett[oi]|lag(?:o|hi)|stagn[oi])\b/, ok: /\b(?:lag(?:o|hi|hett)|stagn)/ },
    { nome: 'acqua', re: /\bacqu[ae]\b/, ok: /\bacqu/ },
    // architettura
    { nome: 'finestra', re: /\bfinestr(?:a|e|one|oni|ella|elle)\b/, ok: /\bfinestr/ },
    { nome: 'fontana', re: /\bfontan(?:a|e|ella|elle)\b/, ok: /\bfontan/ },
    { nome: 'scala', re: /\b(?:scal[ae]|scalinat[ae]|scalin[oi]|gradin[oi]|gradinat[ae])\b/, ok: /\b(?:scal|gradin)/ },
    { nome: 'terrazza', re: /\bterrazz(?:a|e|ino|ini)\b/, ok: /\bterrazz/ },
    { nome: 'soffitti', re: /\bsoffitt[oi]\b/, ok: /\bsoffitt/ },
    { nome: 'cupola', re: /\bcupol[ae]\b/, ok: /\bcupol/ },
    { nome: 'campanile', re: /\bcampanil[ei]\b/, ok: /\bcampanil/ },
    { nome: 'colonne', re: /\bcolonn(?:a|e|ato)\b/, ok: /\bcolonn/ },
    { nome: 'portico', re: /\bportic(?:o|i|ato)\b/, ok: /\bportic/ },
    { nome: 'cortile', re: /\bcortil[ei]\b/, ok: /\bcortil/ },
    { nome: 'chiostro', re: /\bchiostr[oi]\b/, ok: /\bchiostr/ },
    { nome: 'balcone', re: /\bbalcon[ei]\b/, ok: /\bbalcon/ },
    { nome: 'ponte', re: /\bpont[ei]\b/, ok: /\bpont[ei]\b/ },
    { nome: 'torre', re: /\btorr[ei]\b/, ok: /\btorr/ },
    { nome: 'cancello', re: /\bcancell[oi]\b/, ok: /\bcancell/ },
    { nome: 'tetti', re: /\btett[oi]\b/, ok: /\btett[oi]\b/ },
    { nome: 'panchina', re: /\b(?:panchin[ae]|panc(?:a|he))\b/, ok: /\b(?:panchin|panc(?:a|he)\b)/ },
    // arte
    { nome: 'murales', re: /\b(?:murales|murale|murali|graffiti|street art)\b/, ok: /\b(?:mural|graffit|street art)/ },
    { nome: 'quadri', re: /\b(?:quadr[oi]|dipint[oi])\b/, ok: /\b(?:quadr[oi]|dipint|pinacotec|pittur|pittor)/ },
    { nome: 'affreschi', re: /\baffresc(?:o|hi)\b/, ok: /\baffresc/ },
    { nome: 'statua', re: /\bstatu[ae]\b/, ok: /\b(?:statu|scultur)/ },
    { nome: 'mosaici', re: /\bmosaic[oi]\b/, ok: /\bmosaic/ },
    { nome: 'vetrate', re: /\bvetrat[ae]\b/, ok: /\bvetrat/ },
    { nome: 'altare', re: /\baltar[ei]\b/, ok: /\baltar/ },
    // locali: arredi e piatti
    { nome: 'tavolini', re: /\btavol(?:ini|ino|i|o)\b/, ok: /\btavol/ },
    { nome: 'bancone', re: /\bbancon[ei]\b/, ok: /\bbancon/ },
    { nome: 'forno a legna', re: /\bforno a legna\b/, ok: /\blegna\b/ },
    { nome: 'pergola', re: /\bpergol(?:a|e|ato)\b/, ok: /\bpergol/ },
    { nome: 'dehors', re: /\bdehors\b/, ok: /\bdehors\b|all'aperto/ },
    { nome: 'cucina a vista', re: /\bcucina a vista\b/, ok: /\bcucina a vista\b/ },
    { nome: 'vino', re: /\bvin[oi]\b/, ok: /\b(?:vin[oi]\b|enotec|cantin)/ },
    { nome: 'pizza', re: /\bpizz[ae]\b/, ok: /\bpizz/ },
    { nome: 'gelato', re: /\bgelat[oi]\b/, ok: /\bgelat/ },
    { nome: 'pesce', re: /\bpesc[ei]\b/, ok: /\b(?:pesc[ei]|frutti di mare)\b/ },
    { nome: 'carbonara', re: /\bcarbonara\b/, ok: /\bcarbonara\b/ },
    { nome: 'amatriciana', re: /\bamatriciana\b/, ok: /\bamatriciana\b/ },
    { nome: 'cacio e pepe', re: /\bcacio e pepe\b/, ok: /\bcacio e pepe\b/ },
    { nome: 'suppli', re: /\bsuppli\b/, ok: /\bsuppli\b/ },
    { nome: 'carciofi', re: /\bcarciof[oi]\b/, ok: /\bcarciof/ },
    { nome: 'arancini', re: /\barancin[ei]\b/, ok: /\barancin/ },
    { nome: 'cannoli', re: /\bcannol[oi]\b/, ok: /\bcannol/ },
    { nome: 'granita', re: /\bgranit[ae]\b/, ok: /\bgranit[ae]\b/ },
    { nome: 'maritozzo', re: /\bmaritozz[oi]\b/, ok: /\bmaritozz/ },
    { nome: 'tiramisu', re: /\btiramisu\b/, ok: /\btiramisu\b/ },
    { nome: 'cornetto', re: /\bcornett[oi]\b/, ok: /\bcornett/ },
];

// ─── P3d-g — giudizi: solo se sono scritti nei fatti ─────────────────────────
//
// Senza fatti il modello scriveva valutazioni che nessuno puo' verificare:
// "uno dei migliori punti panoramici", "il cuore culturale di Catania",
// "collezioni uniche", "natura incontaminata", "vista incantevole sui tetti".
// Una frase con un giudizio di questo elenco resta solo se lo STESSO giudizio
// compare nei fatti della tappa ("uno dei sette colli" e' nei fatti
// dell'Aventino: passa). Il nome della tappa non conta come fatto, ma non fa
// scattare il controllo ("Unico Bar" e' un nome). Elenco esplicito e testato.
export const UNSUPPORTED_JUDGMENTS = [
    { nome: 'migliore', re: /\b(?:miglior[ei]|peggior[ei])\b/ },
    { nome: 'unico', re: /\b(?:unic[oaie]|unich[ei]|unicita)\b/ },
    { nome: 'cuore di', re: /\bcuore\b/ },
    { nome: 'uno dei', re: /\b(?:uno|una)\s+(?:dei|degli|delle)\b|\b(?:tra|fra)\s+i\s+(?:piu|miglior)/ },
    { nome: 'superlativo', re: /\b\w{3,}issim[oaie]\b|\bpiu\s+(?:bell|antic|grand|famos|amat|visitat|suggestiv|importan|panoramic|spettacolar|caratteristic|autentic)\w*/ },
    { nome: 'vista su', re: /\b(?:vista|viste|veduta|visuale|panorama|affacci\w*|si\s+apre|domin\w*|ammirar\w*)\b[^.!?;]{0,40}?\b(?:su|sul|sullo|sulla|sui|sugli|sulle|verso)\b/ },
    { nome: 'straordinario', re: /\b(?:straordinari|incredibil|eccezional|splendid|meraviglios|stupend|magnific|sublim|mozzafiat|incantevol|incanto|pittoresc|iconic|emblematic|rinomat|famos|celebr[ei]\b)\w*/ },
    { nome: 'incontaminato', re: /\b(?:incontaminat|selvagg|autentic|genuin|vero\s+cuore)\w*/ },
    { nome: 'imperdibile', re: /\b(?:imperdibil|da\s+non\s+perdere|da\s+scoprire|invita\s+a|perfett|ideal[ei])\w*/ },
    { nome: 'meno frequentato', re: /\b(?:meno|poco)\s+(?:frequentat|conosciut|battut|turistic)\w*|\blontan\w*\s+dall[ae]?\s+(?:folla|turisti|caos)|\bfuori\s+dai\s+(?:circuiti|percorsi)|\bnascost[oaie]\b|\bsegret[oaie]\b/ },
    { nome: 'tranquillo', re: /\b(?:tranquill|rilassant|accoglient|intim[oaie]\b|raccolt[oaie]\b)\w*/ },
    // P3d-g, dopo le prove reali: "un ingresso maestoso… ricco di storia e
    // bellezza", "un'osteria a disposizione" (alle 00:04: sembra aperta).
    { nome: 'maestoso', re: /\b(?:maestos|imponent|grandios|sontuos|elegant|prestigios)\w*|\bricc[oaih]e?\s+di\b|\bbellezz[ae]\b|\bpien[oa]\s+di\s+(?:storia|fascino|vita)\b/ },
    { nome: 'a disposizione', re: /\ba\s+(?:tua\s+)?disposizione\b|\bdisponibil\w*|\bti\s+aspett\w*|\bsempre\s+apert\w*/ },
];

// ─── P3d-g — i fatti di un altro luogo si dicono con il suo nome ─────────────
// "Terrazza del Pincio" riceve i fatti del Pincio ("Il Pincio è un colle di
// Roma"): la frase "Un colle di Roma" li attribuisce alla terrazza. Se i fatti
// parlano di un luogo con un altro nome (`fattiSu`), una frase che usa il suo
// tipo ("colle") senza nominarlo viene tolta.
const tipoDelFatto = (fatti, fattiSu) => {
    const testo = norm(factsCorpus(fatti, []));
    const nome = norm(fattiSu || '').replace(/\([^)]*\)/g, '').trim();
    const m = testo.match(/\be\s+(?:un|una|un')\s*([a-z]{4,})\b/) || testo.match(new RegExp(`${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*([a-z]{4,})`));
    return m ? m[1] : null;
};
export function misattributedFact(sentence, { fatti = [], fattiSu = null, nomi = [] } = {}) {
    if (!fattiSu) return null;
    const nomeFatti = norm(fattiSu).replace(/\([^)]*\)/g, '').trim();
    const nomiTappa = nomi.map(n => norm(n || ''));
    // Stesso luogo: stesso nome. "Terrazza del Pincio" contiene "pincio" ma NON
    // e' il Pincio: e' proprio il caso da controllare.
    if (!nomeFatti || nomiTappa.some(n => n.trim() === nomeFatti)) return null;
    const tipo = tipoDelFatto(fatti, fattiSu);
    if (!tipo || nomiTappa.some(n => n.includes(tipo))) return null;
    const t = norm(sentence);
    const nominato = nomeFatti.split(/\s+/).filter(w => w.length > 3).some(w => t.includes(w));
    return !nominato && new RegExp(`\\b${tipo}\\b`).test(t) ? tipo : null;
}

/** I giudizi di una frase assenti dai fatti (il nome della tappa e' neutralizzato). */
export function unsupportedJudgments(sentence, factsText, nomi = []) {
    let t = norm(sentence).replace(/\s+/g, ' ');
    for (const n of nomi) {
        const nn = norm(n || '').replace(/\s+/g, ' ').trim();
        if (nn) t = t.split(nn).join(' ');
    }
    const c = norm(factsText || '').replace(/\s+/g, ' ');
    return UNSUPPORTED_JUDGMENTS.filter(j => j.re.test(t) && !j.re.test(c)).map(j => j.nome);
}

// ─── P3d-g — il tipo del locale lo dice il nome ──────────────────────────────
// "Osteria Navona" e' un'osteria anche se Google dice "bar": se il nome dice il
// tipo, una frase che lo chiama con un altro tipo di locale viene tolta.
const TIPI_LOCALE = [
    ['trattoria', /\btrattori[ae]\b/], ['osteria', /\b(?:osteri[ae]|hostaria)\b/], ['pizzeria', /\bpizzeri[ae]\b/],
    ['enoteca', /\benotec[ah]e?\b/], ['bar', /\bbar\b/], ['ristorante', /\bristorant[ei]\b/],
    ['taverna', /\btavern[ae]\b/], ['bistrot', /\bbistrot\b/], ['pasticceria', /\bpasticceri[ae]\b/],
    ['gelateria', /\bgelateri[ae]\b/],
];
export const localeTypeOfName = (name) => (TIPI_LOCALE.find(([, re]) => re.test(norm(name || ''))) || [null])[0];
/** I tipi di locale nominati nella frase che contraddicono il tipo detto dal nome. */
export function contradictedLocaleTypes(sentence, nomi = []) {
    const tipoNome = nomi.map(localeTypeOfName).find(Boolean);
    if (!tipoNome) return [];
    let t = norm(sentence);
    for (const n of nomi) { const nn = norm(n || '').trim(); if (nn) t = t.split(nn).join(' '); }
    return TIPI_LOCALE.filter(([k, re]) => k !== tipoNome && re.test(t)).map(([k]) => k);
}

/** Gli oggetti concreti nominati in una frase e assenti dal corpus (fatti + nome). */
export function inventedObjects(sentence, corpus) {
    const t = norm(sentence).replace(/\s+/g, ' ');
    const c = norm(corpus || '').replace(/\s+/g, ' ');
    return CONCRETE_OBJECTS.filter(o => o.re.test(t) && !o.ok.test(c)).map(o => o.nome);
}

/** Il corpus contro cui si controlla: i testi dei fatti e i nomi della tappa. */
export const factsCorpus = (fatti = [], nomi = []) => [
    ...(Array.isArray(fatti) ? fatti : []).map(f => (typeof f === 'string' ? f : f?.testo || '')),
    ...(Array.isArray(nomi) ? nomi : []),
].filter(Boolean).join(' \n ');

/**
 * Toglie le frasi che dicono cose non sostenute: un oggetto concreto assente
 * dai fatti e dal nome (P3d-e, regola 'invenzione'); un giudizio assente dai
 * fatti (P3d-g, 'giudizio'); un tipo di locale diverso da quello del nome
 * (P3d-g, 'tipo-locale').
 * @param {string|null} text
 * @param {{ fatti?: Array<{ testo: string }|string>, nomi?: string[] }} ctx
 * @returns {{ text: string|null, removed: Array<{ frase: string, oggetti: string[], regola: 'invenzione'|'giudizio'|'tipo-locale' }> }}
 */
export function filterInventedObjects(text, { fatti = [], nomi = [], fattiSu = null } = {}) {
    if (text == null || String(text).trim() === '') return { text: null, removed: [] };
    const corpus = factsCorpus(fatti, nomi);
    const soloFatti = factsCorpus(fatti, []);
    const kept = [];
    const removed = [];
    for (const s of splitSentences(String(text).trim())) {
        const oggetti = inventedObjects(s, corpus);
        const giudizi = oggetti.length ? [] : unsupportedJudgments(s, soloFatti, nomi);
        const tipi = oggetti.length || giudizi.length ? [] : contradictedLocaleTypes(s, nomi);
        const altro = oggetti.length || giudizi.length || tipi.length ? null : misattributedFact(s, { fatti, fattiSu, nomi });
        if (altro) { removed.push({ frase: s, oggetti: [altro], regola: 'attribuzione', fattiSu }); continue; }
        if (oggetti.length > 0) removed.push({ frase: s, oggetti, regola: 'invenzione' });
        else if (giudizi.length > 0) removed.push({ frase: s, oggetti: giudizi, regola: 'giudizio' });
        else if (tipi.length > 0) removed.push({ frase: s, oggetti: tipi, regola: 'tipo-locale', tipoNome: nomi.map(localeTypeOfName).find(Boolean) });
        else kept.push(s);
    }
    if (removed.length === 0) return { text: String(text), removed };
    return { text: kept.length > 0 ? kept.join(' ') : null, removed };
}

// ─── P3d-i — la voce: il motivo si traduce, non si cita ──────────────────────
//
// Dalle prove reali P3d-g: "Un belvedere a 18:00, per la tua richiesta: un giro
// insider, trovato cercando…", "Piazza Umbrella, un luogo per la tua richiesta",
// "… Arriverai qui per la tua richiesta alle 09:30.", "scelta per il tour della
// cultura". Vere, ma nella voce di un modulo. Una frase che cita il motivo o la
// richiesta, che e' un elenco senza verbo ("Per il pranzo: osteria, fascia €€")
// o che e' solo l'orario attaccato in coda, si toglie e va alla riscrittura come
// le altre (poi, se serve, frase sicura del codice, che ha la sua voce).
const CITAZIONI_MOTIVO = [
    ['per la tua richiesta', /\bper\s+(?:la\s+)?(?:tua|vostra)\s+richiesta\b|\bper\s+la\s+richiesta\b/],
    ['giro insider', /\binsider\b/],
    ['scelto per il tour', /\bscelt[oaie]\s+per\s+(?:il|questo|un)\s+(?:tuo\s+)?(?:tour|giro|percorso)\b|\bper\s+il\s+tour\b/],
    ['trovato cercando', /\btrovat[oaie]\s+cercando\b|\bcercando\s+"/],
];
const ELENCO_SENZA_VERBO = /^(?:per\s+(?:il|la|l')\s*(?:pranzo|cena|aperitivo|mattina|pomeriggio|dopocena)\s*:|[a-z']+,\s*fascia\b|(?:un|una|uno|un')\s+\w+\s+a\s+\d{1,2}[:.]\d{2}\b)/;
const CODA_ORARIO = /^(?:arriverai|arrivi|ci\s+arrivi|arrivo)\b[^.!?]{0,40}\balle\s+\d{1,2}[:.]?\d{0,2}\s*[.!]?$/;
// P3d-j — il gancio approvato "Ci arrivi alle {ora}." e' una frase del codice,
// scelta fra le opzioni: non e' la coda del modello che P3d-i toglieva.
const GANCIO_ORARIO = /^ci arrivi alle \d{1,2}(?::\d{2})?\.$/;

/** I problemi di voce di una frase (vuoto = voce ok). */
export function voiceIssues(sentence, { richiesta = '', oggetto = '' } = {}) {
    const t = norm(sentence).replace(/\s+/g, ' ').trim();
    const out = [];
    for (const [nome, re] of CITAZIONI_MOTIVO) if (re.test(t)) out.push(nome);
    const ogg = norm(oggetto || '').replace(/\s+/g, ' ').trim();
    if (ogg.split(' ').filter(w => w.length > 2).length >= 2 && t.includes(ogg)) out.push('ripete la richiesta');
    const ric = norm(richiesta || '').replace(/[^a-z0-9 ']/g, ' ').replace(/\s+/g, ' ').trim();
    if (ric.split(' ').length >= 4 && t.replace(/[^a-z0-9 ']/g, ' ').replace(/\s+/g, ' ').includes(ric)) out.push('ripete la richiesta');
    if (ELENCO_SENZA_VERBO.test(t)) out.push('elenco senza verbo');
    if (CODA_ORARIO.test(t) && !GANCIO_ORARIO.test(t)) out.push('orario in coda');
    return [...new Set(out)];
}

/**
 * Toglie le frasi con un problema di voce (P3d-i, regola 'voce').
 * @returns {{ text: string|null, removed: Array<{ frase: string, oggetti: string[], regola: 'voce' }> }}
 */
export function filterVoice(text, ctx = {}) {
    if (text == null || String(text).trim() === '') return { text: null, removed: [] };
    const kept = [];
    const removed = [];
    for (const s of splitSentences(String(text).trim())) {
        const v = voiceIssues(s, ctx);
        if (v.length > 0) removed.push({ frase: s, oggetti: v, regola: 'voce' });
        else kept.push(s);
    }
    if (removed.length === 0) return { text: String(text), removed };
    return { text: kept.length > 0 ? kept.join(' ') : null, removed };
}

// P3d-j — la frase sicura e le sue varianti sono state sostituite dalle frasi
// approvate di src/lib/stopPhrases.js: un compositore solo.
