/**
 * Gate SCHELETRO (P2) — dalla finestra temporale allo scheletro della giornata.
 *
 * ─── COSA FA ─────────────────────────────────────────────────────────────────
 * Prende la finestra di P1 (`resolveTourWindow`) e restituisce, per ogni
 * giorno, la sequenza dei momenti che ci stanno dentro: orario (tagliato ai
 * bordi della finestra), categorie ammesse e numero di tappe. Funzione pura:
 * niente modello, niente rete, niente orologio.
 *
 * Qui NON si scelgono luoghi (e' P3) e non si toccano prompt o UI: lo
 * scheletro e' il contratto che P3 riempira'.
 *
 * ─── REGOLE (approvate da Ivano) ─────────────────────────────────────────────
 *   · Momenti dalla tabella unica (dayMoments.js). Un momento entra se si
 *     sovrappone alla finestra per almeno 60 minuti, e viene tagliato ai bordi.
 *   · Ritmo: Rilassato 1 tappa per momento; Attivo 1 (2 se il momento, gia'
 *     tagliato, dura almeno 3 ore); Intenso 2. Senza ritmo: Attivo.
 *     Pranzo e cena fanno SEMPRE 1 tappa, qualunque sia il ritmo: nessuno
 *     pranza due volte. Il ritmo aggiunge tappe solo a mattina, pomeriggio e
 *     dopocena (P3, prima correzione).
 *   · Dopocena solo con interesse Vita Notturna o ritmo Intenso; mai con
 *     gruppo Famiglia.
 *   · Interessi: Arte/Storia/Cultura privilegiano le categorie di cultura in
 *     mattina e pomeriggio; Natura e Shopping il pomeriggio; Cibo non aggiunge
 *     momenti ma segna pranzo, aperitivo e cena "da scegliere con cura".
 *   · Una categoria nominata nel testo ("ristoranti", "musei", "bar") vale per
 *     tutti i momenti tranne pranzo e cena; gli orari restano.
 *   · P3e — Pranzo e cena sono SEMPRE un posto dove mangiare: le loro
 *     categorie restano quelle della tabella (cibo), qualunque categoria abbia
 *     scelto l'utente. L'aperitivo segue la categoria scelta (una vista va bene).
 *   · Massimo 8 tappe per giorno.
 *
 * ─── IL DOPOCENA E LA FINESTRA ───────────────────────────────────────────────
 * La finestra di "Crea il tuo Percorso" finisce alle 22:30 (fine della cena),
 * cioe' esattamente dove il dopocena comincia: con la sola regola della
 * sovrapposizione non entrerebbe mai. Quando il dopocena e' ammesso e la
 * finestra arriva a fine giornata, lo scheletro la prolunga fino alla fine del
 * dopocena. Una finestra che finisce prima (Mezza Giornata, fascia) non si
 * prolunga: l'utente ha detto quando smette.
 */

import { MOMENTS, MOMENT_BY_KEY } from './dayMoments';
import { romeDate, romeParts } from './tourWindow';

export const MIN_OVERLAP_MINUTES = 60;
export const MAX_STOPS_PER_DAY = 8;
const LONG_MOMENT_MINUTES = 180;
// P3 — i soli momenti in cui il ritmo puo' mettere piu' di una tappa.
// Pranzo e cena sono un pasto ciascuno; l'aperitivo e' uno.
const EXPANDABLE_KEYS = new Set(['mattina', 'pomeriggio', 'dopocena']);

const CULTURE_CATEGORIES = ['cultura', 'monumenti', 'musei'];
const MEAL_KEYS = new Set(['pranzo', 'aperitivo', 'cena']);
/** P3e — i momenti che restano cibo anche con una categoria esplicita. */
export const FOOD_ONLY_MOMENT_KEYS = new Set(['pranzo', 'cena']);

const norm = (v) => String(v ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Categorie nominabili nel testo → la categoria che vale per tutti i momenti.
// Ordine = priorita': il primo che riconosce, vince.
const EXPLICIT_CATEGORIES = [
    { category: 'cibo',          re: /\b(ristorant[ei]|trattori[ae]|osteri[ae]|pizzeri[ae])\b/ },
    { category: 'musei',         re: /\b(muse[io]|galleri[ae])\b/ },
    { category: 'bar',           re: /\b(bar|enoteca|enoteche|wine bar)\b/ },
    { category: 'natura',        re: /\b(parch[io]|giardin[io])\b/ },
    { category: 'shopping',      re: /\b(negoz[io]|botteghe|boutique)\b/ },
    { category: 'vita notturna', re: /\b(discoteca|discoteche|club|locali notturni)\b/ },
];

/** La categoria esplicita nominata nel testo, o null. */
export function parseExplicitCategory(text) {
    const t = norm(text);
    if (!t) return null;
    return EXPLICIT_CATEGORIES.find(c => c.re.test(t))?.category ?? null;
}

/** Ritmo normalizzato: 'rilassato' | 'attivo' | 'intenso'. Sconosciuto → 'attivo'. */
export function normalizePace(pace) {
    const p = norm(pace);
    if (p.startsWith('rilass')) return 'rilassato';
    if (p.startsWith('intens')) return 'intenso';
    return 'attivo';
}

const stopsFor = (key, pace, minutes) => {
    if (!EXPANDABLE_KEYS.has(key)) return 1;
    if (pace === 'rilassato') return 1;
    if (pace === 'intenso') return 2;
    return minutes >= LONG_MOMENT_MINUTES ? 2 : 1;
};

// Le categorie privilegiate vanno in testa, nell'ordine della tabella;
// le altre seguono. Nessuna categoria si aggiunge o si toglie.
const prioritize = (categories, preferred) => {
    const pref = categories.filter(c => preferred.includes(c));
    return { categories: [...pref, ...categories.filter(c => !pref.includes(c))], preferred: pref };
};

const preferredFor = (key, interests) => {
    const out = [];
    const culture = ['arte', 'storia', 'cultura'].some(i => interests.has(i));
    if (culture && (key === 'mattina' || key === 'pomeriggio')) out.push(...CULTURE_CATEGORIES);
    if (key === 'pomeriggio' && interests.has('natura')) out.push('natura');
    if (key === 'pomeriggio' && interests.has('shopping')) out.push('shopping');
    return out;
};

const civilDay = (date) => {
    const p = romeParts(date);
    return { y: p.y, m: p.m, d: p.d };
};

// Se un giorno ha piu' di MAX_STOPS_PER_DAY tappe, si toglie una tappa alla
// volta dai momenti che ne hanno di piu', partendo dall'ultimo: la sera
// cede prima del mattino. Nessun momento scende sotto 1.
const capStops = (moments) => {
    let total = moments.reduce((a, m) => a + m.stops, 0);
    while (total > MAX_STOPS_PER_DAY) {
        const max = Math.max(...moments.map(m => m.stops));
        if (max <= 1) break;
        const idx = moments.map(m => m.stops).lastIndexOf(max);
        moments[idx].stops -= 1;
        total -= 1;
    }
    return total;
};

/**
 * Lo scheletro della giornata.
 *
 * @param {object} p
 * @param {object} p.window       l'uscita di resolveTourWindow (usa `windows`)
 * @param {string} [p.pace]       'Rilassato' | 'Attivo' | 'Intenso' (case-insensitive)
 * @param {string[]} [p.interests] es. ['Arte', 'Cibo', 'Vita Notturna']
 * @param {string} [p.group]      es. 'Famiglia', 'In famiglia', 'Coppia'
 * @param {string} [p.text]       la frase dell'utente (per la categoria esplicita)
 * @param {string} [p.category]   categoria gia' resa vincolante dal chiamante (P3:
 *   il filtro di categoria del Gate RAGGIO-CATEGORIA). Vale come una categoria
 *   nominata nel testo; se il testo ne nomina una, vince il testo. In
 *   entrambi i casi pranzo e cena restano cibo.
 * @returns {{ explicitCategory: string|null, days: Array<{ date: string,
 *   totalStops: number, moments: Array<{ key: string, label: string,
 *   start: Date, end: Date, minutes: number, categories: string[],
 *   preferred: string[], stops: number, careful: boolean }> }> }}
 */
export function buildDaySkeleton({ window: tw, pace, interests = [], group = '', text = '', category = null } = {}) {
    const windows = Array.isArray(tw?.windows) && tw.windows.length > 0
        ? tw.windows
        : (tw?.start && tw?.end ? [{ date: tw.date, start: tw.start, end: tw.end }] : []);

    const paceKey = normalizePace(pace);
    const interestSet = new Set((Array.isArray(interests) ? interests : []).map(norm));
    const isFamily = norm(group).includes('famiglia');
    const allowDopocena = !isFamily && (interestSet.has('vita notturna') || paceKey === 'intenso');
    const careful = interestSet.has('cibo');
    const explicitCategory = parseExplicitCategory(text) ?? (category || null);

    const days = windows.map((w) => {
        const day = civilDay(w.start);
        const wStart = w.start.getTime();
        let wEnd = w.end.getTime();
        if (allowDopocena && wEnd >= romeDate(day, MOMENT_BY_KEY.cena.end).getTime()) {
            wEnd = Math.max(wEnd, romeDate(day, MOMENT_BY_KEY.dopocena.end).getTime());
        }

        const moments = [];
        for (const m of MOMENTS) {
            if (m.key === 'dopocena' && !allowDopocena) continue;
            const start = Math.max(wStart, romeDate(day, m.start).getTime());
            const end = Math.min(wEnd, romeDate(day, m.end).getTime());
            const minutes = Math.round((end - start) / 60000);
            if (minutes < MIN_OVERLAP_MINUTES) continue;

            const { categories, preferred } = explicitCategory && !FOOD_ONLY_MOMENT_KEYS.has(m.key)
                ? { categories: [explicitCategory], preferred: [explicitCategory] }
                : prioritize(m.categories, preferredFor(m.key, interestSet));

            moments.push({
                key: m.key,
                label: m.label,
                start: new Date(start),
                end: new Date(end),
                minutes,
                categories,
                preferred,
                stops: stopsFor(m.key, paceKey, minutes),
                careful: careful && MEAL_KEYS.has(m.key),
            });
        }
        const totalStops = capStops(moments);
        return { date: w.date, moments, totalStops };
    });

    return { explicitCategory, days };
}
