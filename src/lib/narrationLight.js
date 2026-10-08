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
 *   · tramonto, sole che cala, ora d'oro  → entro 45 minuti dal tramonto vero
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
        ok: (a, { ss }) => Math.abs(a - ss) <= SUNSET_TOLERANCE_MINUTES,
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
// una frase in meno che una frase da brochure a schermo.
export const BANNED_VOICE_WORDS = [
    // aggettivi da brochure (narratore, "Per Te")
    'storico', 'tradizionale', 'unico', 'caratteristico', 'suggestivo', 'tipico',
    'affascinante', 'magico', 'imperdibile',
    // aggettivi vuoti (notifiche)
    'spettacolare', 'indimenticabile', 'atmosfera intima', 'vista mozzafiato',
    // verbi da menu (notifiche)
    'sorseggia', 'gusta', 'immergiti', 'assapora',
    // giudizi e raccomandazioni ("Per Te", notifiche)
    'ottima scelta', 'perfetta scelta', 'ottima idea', 'ottimo posto',
    'vale la pena', 'da provare', 'consigliato', 'consiglio', 'perfetto per',
    'ideale per', 'assolutamente da', 'non perdere',
    'un must', 'una chicca', 'una scoperta', 'una perla', 'un gioiello',
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
// Parola intera (\b): "storia", "comunita'", "tipografia", "gusto" restano.
const VERBS = new Set(['sorseggia', 'gusta', 'assapora']);
const variantPattern = (w) => {
    if (w.includes(' ')) return w.split(' ').join('\\s+');
    if (VERBS.has(w)) return `${w.slice(0, -1)}(?:a|are|ate|ando|ano)`;
    if (w.endsWith('co')) return `${w.slice(0, -1)}(?:o|a|i|he|amente)`;
    if (w.endsWith('vo')) return `${w.slice(0, -1)}(?:o|a|i|e|amente)`;
    if (w.endsWith('to')) return `${w.slice(0, -1)}(?:o|a|i|e)`;
    if (w.endsWith('le')) return `${w.slice(0, -1)}(?:e|i|mente)`;
    if (w.endsWith('e')) return `${w.slice(0, -1)}(?:e|i|emente)`;
    return w;
};
const BANNED_RULES = BANNED_VOICE_WORDS
    .map(w => ({ word: w, re: new RegExp(`\\b${variantPattern(w)}\\b`) }));

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

// ─── P3d-b — la regola "perche' qui" per il campo description ────────────────
// Stesso testo nel prompt del narratore e in quello di "Per Te".
export const DESCRIPTION_RULE_PROMPT = `   description — la frase "PERCHÉ QUI": UNA frase, massimo 20 parole.
     Dice cosa guardare, da dove guardarlo o quando: un dettaglio che sa solo
     chi c'è stato. Niente aggettivi generici.
     NON aprire con un'impressione dei sensi (profumo, odore, aria, vento,
     silenzio, panorama, "camminando senti"): una frase che apre così viene tolta.
     GIUSTO: "L'ombra vera è sotto gli alberi grandi, non lungo i vialetti."
     GIUSTO: "Bastano pochi passi di lato per togliersi la folla dall'inquadratura."
     GIUSTO: "Se ha piovuto da poco, i vialetti in terra battuta diventano fango."
     SBAGLIATO: "L'aria fresca qui è un sollievo dopo la passeggiata."
     SBAGLIATO: "Il profumo della pasta fresca riempie l'aria."
     SBAGLIATO: "L'odore del sugo si mescola al profumo del pane."`;
