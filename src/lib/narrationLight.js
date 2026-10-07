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
// L'UNICO elenco delle parole vietate al narratore. Prima viveva solo come
// testo dentro due prompt (narratore e "Per Te"), e nessun codice lo
// controllava: il modello poteva usarle e arrivavano a schermo ("piatti
// tradizionali", tour di Roma del 7/10). Ora i due prompt lo leggono da qui
// (bannedWordsPromptLines: stesso testo di prima, carattere per carattere) e
// filterBannedWords toglie la frase che ne contiene una.
//
// Il prompt dice "usate sole senza contesto": il codice non sa giudicare il
// contesto, quindi toglie la frase in ogni caso. Meglio una frase in meno che
// una frase da brochure a schermo.
export const BANNED_VOICE_WORDS = [
    'storico', 'tradizionale', 'unico', 'caratteristico', 'suggestivo', 'tipico',
    'affascinante', 'magico', 'imperdibile',
];
// Formule che solo il prompt "Per Te" mostra al modello; il filtro le toglie ovunque.
export const BANNED_VOICE_PHRASES_HOME = ['ottima scelta', 'perfetta scelta'];

/** Le due righe dell'elenco nel testo dei prompt, identiche a quelle di prima. */
export function bannedWordsPromptLines(extra = []) {
    const q = (w) => `"${w}"`;
    const first = BANNED_VOICE_WORDS.slice(0, 6).map(q).join(', ');
    const rest = [...BANNED_VOICE_WORDS.slice(6), ...extra].map(q).join(', ');
    return `${first},\n${rest} — usate sole senza contesto.`;
}

// Le varianti di genere/numero e l'avverbio, dalla forma base:
//   storico → storico/storica/storici/storiche/storicamente
//   suggestivo → suggestivo/a/i/e/suggestivamente
//   tradizionale → tradizionale/i/tradizionalmente
//   affascinante → affascinante/i/affascinantemente
// Parola intera (\b): "storia", "comunita'", "tipografia", "magazzino" restano.
const variantPattern = (w) => {
    if (w.includes(' ')) return w.split(' ').join('\\s+');
    if (w.endsWith('co')) return `${w.slice(0, -1)}(?:o|a|i|he|amente)`;
    if (w.endsWith('vo')) return `${w.slice(0, -1)}(?:o|a|i|e|amente)`;
    if (w.endsWith('le')) return `${w.slice(0, -1)}(?:e|i|mente)`;
    if (w.endsWith('e')) return `${w.slice(0, -1)}(?:e|i|emente)`;
    return w;
};
const BANNED_RULES = [...BANNED_VOICE_WORDS, ...BANNED_VOICE_PHRASES_HOME]
    .map(w => ({ word: w, re: new RegExp(`\\b${variantPattern(w)}\\b`) }));

/**
 * Toglie le frasi che contengono una parola vietata. Mai riscritte; un testo
 * fatto solo di frasi vietate diventa null (nessun testo sostitutivo).
 * @param {string|null} text
 * @returns {{ text: string|null, removed: Array<{ frase: string, parole: string[] }> }}
 */
export function filterBannedWords(text) {
    if (text == null || String(text).trim() === '') return { text: null, removed: [] };
    const kept = [];
    const removed = [];
    for (const s of splitSentences(String(text).trim())) {
        const t = norm(s);
        const parole = BANNED_RULES.filter(r => r.re.test(t)).map(r => r.word);
        if (parole.length > 0) removed.push({ frase: s, parole });
        else kept.push(s);
    }
    if (removed.length === 0) return { text: String(text), removed };
    return { text: kept.length > 0 ? kept.join(' ') : null, removed };
}
