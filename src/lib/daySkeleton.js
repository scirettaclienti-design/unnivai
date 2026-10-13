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
 * ─── C8a — LA SERA ───────────────────────────────────────────────────────────
 *   · L'aperitivo e' una sosta vera: 45 minuti (60 con ritmo Rilassato), scritti sul
 *     momento (`sostaAperitivo`); il bar di giorno resta un caffe' da 20.
 *   · Tra l'aperitivo e la cena, se restano piu' di 30 minuti, una passeggiata breve
 *     (`addEveningWalk`): un momento FACOLTATIVO, solo luoghi all'aperto.
 *   · Percorso Veloce da 18:00 in poi (`veloce`): drink, passeggiata e cena (la cena e'
 *     facoltativa: se nessun locale e' aperto per tutta la sosta, restano drink e passeggiata).
 *   · Mai uno scheletro vuoto: una finestra senza momenti (la sera tardi, prima dell'alba)
 *     riceve il momento sera/notte che la contiene.
 *
 * ─── IL DOPOCENA E LA FINESTRA ───────────────────────────────────────────────
 * La finestra di "Crea il tuo Percorso" finisce alle 22:30 (fine della cena),
 * cioe' esattamente dove il dopocena comincia: con la sola regola della
 * sovrapposizione non entrerebbe mai. Quando il dopocena e' ammesso e la
 * finestra arriva a fine giornata, lo scheletro la prolunga fino alla fine del
 * dopocena. Una finestra che finisce prima (Mezza Giornata, fascia) non si
 * prolunga: l'utente ha detto quando smette.
 */

import { MOMENTS, MOMENT_BY_KEY, momentAtClock } from './dayMoments';
import { explicitFoodMoments, asksSitDownMeal, asksBreakfast } from './foodTheme';
import { romeDate, romeParts } from './tourWindow';
import { APERITIVO_STAY_MINUTES, APERITIVO_STAY_RELAX_MINUTES } from './tourTiming';

export const MIN_OVERLAP_MINUTES = 60;
export const MAX_STOPS_PER_DAY = 8;
const LONG_MOMENT_MINUTES = 180;
// P3 — i soli momenti in cui il ritmo puo' mettere piu' di una tappa.
// Pranzo e cena sono un pasto ciascuno; l'aperitivo e' uno.
export const EXPANDABLE_KEYS = new Set(['mattina', 'pomeriggio', 'dopocena']);

const CULTURE_CATEGORIES = ['cultura', 'monumenti', 'musei'];
const MEAL_KEYS = new Set(['pranzo', 'aperitivo', 'cena']);
/** P3e — i momenti che restano cibo anche con una categoria esplicita. */
export const FOOD_ONLY_MOMENT_KEYS = new Set(['pranzo', 'cena']);

/** C8a — il Percorso Veloce e' "serale" da quest'ora (minuti dalla mezzanotte di Roma) fino all'alba. */
export const SERA_FROM_MINUTES = 18 * 60;
export const ALBA_MINUTES = 5 * 60;
/** C8b — l'istante e' "di sera" (dalle 18:00 fino all'alba, ora di Roma): il percorso serale e' drink + passeggiata + cena. */
export const isSeraStart = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
    const p = romeParts(date);
    const m = p.h * 60 + p.mi;
    return m >= SERA_FROM_MINUTES || m < ALBA_MINUTES;
};
/** C8a — la passeggiata tra aperitivo e cena: serve se restano piu' di 30 minuti; dura al massimo 30. */
export const WALK_MIN_REMAINING_MINUTES = 30;
export const WALK_CATEGORIES = ['punti panoramici', 'passeggiata', 'natura'];
/** Il tempo che la passeggiata lascia alla cena (cammino compreso): la passeggiata non fa slittare la cena. */
const WALK_MARGIN_BEFORE_NEXT_MINUTES = 20;
const VELOCE_WALK_WINDOW_MINUTES = 150;
const VELOCE_DINNER_ARRIVAL_MINUTES = 85;
/** C8b — la cena tardi: chi parte fra le 21:00 e le 22:00. Dopo la cena e la passeggiata passano ~115 minuti. */
/** C8c — la colazione chiesta vale se il tour parte prima delle 11:00. */
const COLAZIONE_ENTRO_MINUTES = 11 * 60;
const CENA_TARDI_DA = 21 * 60;
const CENA_TARDI_A = 22 * 60;
const CENA_PRIMA_DOPO_MINUTES = 115;
/** L'ultima ora in cui si arriva a una cena facoltativa (la fascia della cena del banco: 19:30–23:00). */
const CENA_ULTIMO_ARRIVO = { h: 23, m: 0 };
const ASKED_APERITIVO = /\b(aperitiv\w*|apericena)\b/;

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

const romeMinutesOf = (date) => { const p = romeParts(date); return p.h * 60 + p.mi; };
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
 * @returns {{ explicitCategory: string|null, foodTheme: boolean, days: Array<{ date: string,
 *   totalStops: number, moments: Array<{ key: string, label: string,
 *   start: Date, end: Date, minutes: number, categories: string[],
 *   preferred: string[], stops: number, careful: boolean }> }> }}
 */
export function buildDaySkeleton({ window: tw, pace, interests = [], group = '', text = '', category = null, foodTheme: foodThemeIn = false, veloce = false, cenaPrima: cenaPrimaIn = false } = {}) {
    const windows = Array.isArray(tw?.windows) && tw.windows.length > 0
        ? tw.windows
        : (tw?.start && tw?.end ? [{ date: tw.date, start: tw.start, end: tw.end }] : []);

    const paceKey = normalizePace(pace);
    const interestSet = new Set((Array.isArray(interests) ? interests : []).map(norm));
    const isFamily = norm(group).includes('famiglia');
    const allowDopocena = !isFamily && (interestSet.has('vita notturna') || paceKey === 'intenso');
    const careful = interestSet.has('cibo');
    const explicitCategory = parseExplicitCategory(text) ?? (category || null);
    // C7 — IL TEMA CIBO VALE SOLO NEI PASTI. "ristoranti" nel testo (o la categoria cibo del
    // traduttore) e' un tema: pranzo e cena sono gia' cibo, l'aperitivo e' un bar, la mattina
    // e il pomeriggio sono ESPERIENZE (`tema: 'esperienze'`, mai ristoranti). Prima rendeva
    // "cibo" ogni momento: 7 ristoranti su 7. Un'altra categoria esplicita (musei, bar,
    // natura…) vale per tutti i momenti come prima.
    const foodTheme = !!foodThemeIn || explicitCategory === 'cibo';
    const momentCategory = explicitCategory === 'cibo' ? null : explicitCategory;
    // Una richiesta ESPLICITA di un locale in un momento ("la colazione", "il pomeriggio in
    // pasticceria") si rispetta e si dichiara (`esplicito`).
    const esplicitiMoments = explicitFoodMoments(text);
    const esplicitoPasti = esplicitiMoments.size > 0 && asksSitDownMeal(text);
    // C8a — "aperitivo e cena": l'aperitivo chiesto per nome entra anche se la finestra lo
    // sfiora appena (>= 15 minuti, non 60), perche' l'utente l'ha voluto.
    const aperitivoChiesto = ASKED_APERITIVO.test(norm(text));
    // C8c — la COLAZIONE chiesta per nome (e il tour parte prima delle 11:00): la prima tappa e' un posto da colazione aperto per
    // tutta la sosta e il tour parte all'ora chiesta, non alle 9:30. Senza la richiesta, la regola C7 non cambia.
    const colazioneChiesta = asksBreakfast(text);
    // C8a — la sosta del drink: 45 minuti, 60 con ritmo Rilassato.
    const sostaAperitivo = paceKey === 'rilassato' ? APERITIVO_STAY_RELAX_MINUTES : APERITIVO_STAY_MINUTES;

    const days = windows.map((w) => {
        const day = civilDay(w.start);
        const wStart = w.start.getTime();
        let wEnd = w.end.getTime();
        if (allowDopocena && wEnd >= romeDate(day, MOMENT_BY_KEY.cena.end).getTime()) {
            wEnd = Math.max(wEnd, romeDate(day, MOMENT_BY_KEY.dopocena.end).getTime());
        }

        const build = (m, startMs, endMs, extra = {}) => {
            const minutes = Math.round((endMs - startMs) / 60000);
            const { categories: baseCategories, preferred } = momentCategory && !FOOD_ONLY_MOMENT_KEYS.has(m.key)
                ? { categories: [momentCategory], preferred: [momentCategory] }
                : prioritize(m.categories, preferredFor(m.key, interestSet));
            const esplicito = esplicitiMoments.has(m.key);
            let categories = baseCategories;
            if (esplicito) categories = [...new Set([...baseCategories, 'cibo', 'bar'])];
            const tema = foodTheme && !esplicito && (m.key === 'mattina' || m.key === 'pomeriggio') ? 'esperienze' : undefined;
            return {
                key: m.key,
                label: m.label,
                start: new Date(startMs),
                end: new Date(endMs),
                minutes,
                categories,
                preferred,
                stops: stopsFor(m.key, paceKey, minutes),
                careful: careful && MEAL_KEYS.has(m.key),
                ...(esplicito ? { esplicito: true, ...(esplicitoPasti ? { esplicitoPasti: true } : {}) } : {}),
                ...(tema ? { tema } : {}),
                ...extra,
            };
        };

        const startClock = romeParts(w.start);
        const startMinutes = startClock.h * 60 + startClock.mi;
        const serale = veloce && (startMinutes >= SERA_FROM_MINUTES || startMinutes < ALBA_MINUTES);
        // C8b — CENA TARDI: chi parte fra le 21:00 e le 22:00 cena PRIMA (poi la passeggiata, e un drink solo se resta tempo nella
        // finestra). Il chiamante lo chiede (`cenaPrima`) e, se nessun ristorante e' aperto per tutta la sosta, ripiega sul giro di C8a.
        const cenaPrima = serale && cenaPrimaIn && startMinutes >= CENA_TARDI_DA && startMinutes < CENA_TARDI_A;

        const moments = [];
        if (cenaPrima) {
            const cena = MOMENT_BY_KEY.cena;
            const notte = MOMENT_BY_KEY.dopocena;
            moments.push(build(cena, wStart, romeDate(day, CENA_ULTIMO_ARRIVO).getTime(), { opzionale: true, soloAperti: true, cenaPrima: true }));
            // cena (75) + cammino + passeggiata (30) + cammino: il drink parte dopo, se nella finestra ne resta il tempo (45 + cammino)
            const drinkAt = wStart + CENA_PRIMA_DOPO_MINUTES * 60000;
            if (wEnd - drinkAt >= 60 * 60000) {
                const drink = build(notte, drinkAt, wEnd, { sostaAperitivo, bevuta: true, soloCategorie: true, opzionale: true });
                drink.categories = ['bar', 'vita notturna'];
                drink.preferred = [];
                moments.push(drink);
            }
        } else if (serale) {
            // C8a — PERCORSO VELOCE DALLE 18:00: drink, passeggiata (aggiunta da addEveningWalk) e cena.
            // La cena e' FACOLTATIVA: vale solo se un locale e' aperto per tutta la sosta (75 minuti)
            // quando ci si arriva; altrimenti il giro e' drink + passeggiata, mai una tappa sola.
            const aper = MOMENT_BY_KEY.aperitivo;
            const cena = MOMENT_BY_KEY.cena;
            const notte = MOMENT_BY_KEY.dopocena;
            // il drink e' un locale da bere, qualunque umore abbia scelto l'utente (spa, parchi…): solo bar
            const drinkExtra = { sostaAperitivo, bevuta: true, soloCategorie: true };
            if (startMinutes >= SERA_FROM_MINUTES && startMinutes < aper.end.h * 60) {
                moments.push(build(aper, wStart, romeDate(day, aper.end).getTime(), drinkExtra));
            } else if (startMinutes >= aper.end.h * 60 && startMinutes < cena.end.h * 60 + cena.end.m) {
                // dopo le 20:00 non c'e' piu' un aperitivo in tabella: il drink prima di cena parte da adesso
                moments.push(build(aper, wStart, wStart + 120 * 60000, drinkExtra));
            } else {
                moments.push(build(notte, wStart, wStart + 120 * 60000, drinkExtra));
            }
            // categorie del drink: i bar (e, di notte, la vita notturna); mai la categoria che vale per gli altri momenti
            const drink = moments[0];
            drink.categories = drink.key === 'dopocena' ? ['bar', 'vita notturna'] : ['bar'];
            drink.preferred = [];
            if (startMinutes >= SERA_FROM_MINUTES && startMinutes < cena.end.h * 60 + cena.end.m) {
                const tardi = startMinutes >= aper.end.h * 60;
                // dopo le 20:00 la cena e' "la prossima cosa dopo drink e passeggiata": arrivo stimato
                // = drink (45) + cammino + passeggiata (30) + cammino; la verifica vera la fanno gli orari del giro
                const cenaStart = tardi ? wStart + VELOCE_DINNER_ARRIVAL_MINUTES * 60000 : romeDate(day, cena.start).getTime();
                const cenaEnd = tardi ? Math.min(wStart + 240 * 60000, romeDate(day, CENA_ULTIMO_ARRIVO).getTime()) : romeDate(day, cena.end).getTime();
                // una cena che non puo' cominciare entro le 23:00 non c'e': drink + passeggiata
                if (cenaEnd > cenaStart) moments.push(build(cena, cenaStart, cenaEnd, { opzionale: true, soloAperti: true }));
            }
        } else {
            for (const m of MOMENTS) {
                if (m.key === 'dopocena' && !allowDopocena) continue;
                const colazione = m.key === 'mattina' && colazioneChiesta && startMinutes >= ALBA_MINUTES && startMinutes < COLAZIONE_ENTRO_MINUTES;
                const start = colazione ? wStart : Math.max(wStart, romeDate(day, m.start).getTime());
                const end = Math.min(wEnd, romeDate(day, m.end).getTime());
                const minutes = Math.round((end - start) / 60000);
                const soglia = m.key === 'aperitivo' && aperitivoChiesto ? 15 : MIN_OVERLAP_MINUTES;
                if (minutes < soglia) continue;
                const mom = build(m, start, end, m.key === 'aperitivo' ? { sostaAperitivo, bevuta: true } : {});
                // la colazione e' una tappa in piu' nella mattina (non toglie posto alle visite)
                if (colazione) Object.assign(mom, { colazione: true, stops: mom.stops + 1 });
                // C8a — un tour che parte di sera e' drink + passeggiata + cena: il drink e' un locale da bere, non un
                // belvedere (la vista e' della passeggiata, e un belvedere all'aperitivo bloccava la ricerca dei bar).
                // Le giornate che cominciano al mattino tengono la tabella com'e'. Una categoria chiesta per tutti i
                // momenti resta com'e'.
                if (mom.bevuta && startMinutes >= SERA_FROM_MINUTES && mom.categories.includes('bar') && mom.categories.includes('punti panoramici')) {
                    mom.categories = mom.categories.filter(c => c !== 'punti panoramici');
                    mom.preferred = mom.preferred.filter(c => c !== 'punti panoramici');
                }
                moments.push(mom);
            }
        }

        // C8a — MAI UNO SCHELETRO VUOTO. Una finestra che non si sovrappone abbastanza a nessun
        // momento (21:45–23:45: la cena ne ha 45 su 60, il dopocena non e' ammesso; o prima
        // dell'alba) riceve il momento sera/notte che la contiene: il piu' sovrapposto della tabella,
        // tagliato ai bordi della finestra.
        if (moments.length === 0 && wEnd > wStart) {
            const overlap = (m) => Math.max(0, Math.min(wEnd, romeDate(day, m.end).getTime()) - Math.max(wStart, romeDate(day, m.start).getTime()));
            const best = [...MOMENTS].sort((a, b) => overlap(b) - overlap(a) || MOMENTS.indexOf(b) - MOMENTS.indexOf(a))[0];
            const m = overlap(best) > 0 ? best : momentAtClock(startClock.h, startClock.mi);
            moments.push(build(m, wStart, wEnd, { daRiserva: true }));
        }

        const totalStops = capStops(moments);
        return { date: w.date, moments, totalStops };
    });

    return { explicitCategory, foodTheme, days };
}

/**
 * C8a — LA PASSEGGIATA FRA IL DRINK E LA CENA. Aggiunge, dopo ogni drink (aperitivo), un momento
 * FACOLTATIVO `passeggiata`: un solo luogo all'aperto (belvedere, piazza, lungomare, giardino:
 * categorie punti panoramici / passeggiata / natura), mai un bar, mai un ristorante.
 *
 *   · Percorso Veloce: sempre (drink + passeggiata + cena; senza cena, drink + passeggiata);
 *   · gli altri percorsi: solo se tra la fine del drink (inizio + sosta) e l'inizio della cena
 *     restano piu' di WALK_MIN_REMAINING_MINUTES minuti.
 * Il momento finisce WALK_MARGIN_BEFORE_NEXT_MINUTES prima della cena: una passeggiata che non ci
 * sta in tempo non entra, e il buco, se resta oltre i 45 minuti, e' una riga di CONTINUITA'.
 * Non conta nel tetto delle 8 tappe: e' una pausa dentro un momento che c'era gia'.
 *
 * @param {object} skeleton l'uscita di buildDaySkeleton
 * @param {{ veloce?: boolean }} [o]
 * @returns {object} lo scheletro con i momenti `passeggiata`
 */
export function addEveningWalk(skeleton, { veloce = false } = {}) {
    const days = (skeleton?.days || []).map((day) => {
        // C8b — la CENA TARDI: la passeggiata viene DOPO la cena (Veloce con `cenaPrima`, o una sera che comincia fra le 21:00 e le 22:00
        // con la cena come primo momento e nessun drink prima).
        const ci = (day.moments || []).findIndex(m => m.cenaPrima || (!veloce && m.key === 'cena' && !m.opzionale && m === day.moments[0]
            && !day.moments.some(x => x.bevuta) && romeMinutesOf(m.start) >= CENA_TARDI_DA && romeMinutesOf(m.start) < CENA_TARDI_A));
        if (ci >= 0) {
            const cena = day.moments[ci];
            const startMs = cena.start.getTime();
            let endMs = startMs + VELOCE_WALK_WINDOW_MINUTES * 60000;
            if (!cena.cenaPrima) endMs = Math.min(endMs, romeDate(civilDay(cena.start), { h: 23, m: 30 }).getTime());
            if (endMs <= startMs) return day;
            const walk = {
                key: 'passeggiata', label: 'Passeggiata', start: new Date(startMs), end: new Date(endMs), minutes: Math.round((endMs - startMs) / 60000),
                categories: [...WALK_CATEGORIES], preferred: [], stops: 1, careful: false, opzionale: true, soloCategorie: true, viewKey: 'cena',
            };
            const moments = [...day.moments.slice(0, ci + 1), walk, ...day.moments.slice(ci + 1)];
            return { ...day, moments, totalStops: day.totalStops + 1 };
        }
        const i = (day.moments || []).findIndex(m => m.bevuta);
        if (i < 0) return day;
        const drink = day.moments[i];
        const next = day.moments[i + 1] || null;
        const cenaFissa = next && next.key === 'cena' && !next.opzionale ? next : null;
        const cenaOpzionale = next && next.key === 'cena' && next.opzionale ? next : null;
        const drinkEnd = drink.start.getTime() + (drink.sostaAperitivo || APERITIVO_STAY_MINUTES) * 60000;
        let endMs;
        if (veloce) {
            // drink + passeggiata + cena: la passeggiata ha la sua finestra, la cena viene dopo
            endMs = drink.start.getTime() + VELOCE_WALK_WINDOW_MINUTES * 60000;
            if (cenaFissa) endMs = Math.max(endMs, drinkEnd + 30 * 60000);
        } else {
            if (!cenaFissa) return day;
            const rimasti = (cenaFissa.start.getTime() - drinkEnd) / 60000;
            if (rimasti <= WALK_MIN_REMAINING_MINUTES) return day;
            endMs = cenaFissa.start.getTime() - WALK_MARGIN_BEFORE_NEXT_MINUTES * 60000;
        }
        if (cenaOpzionale && veloce) endMs = Math.min(endMs, cenaOpzionale.end.getTime());
        const startMs = drink.start.getTime();
        if (endMs <= startMs) return day;
        const walk = {
            key: 'passeggiata',
            label: 'Passeggiata',
            start: new Date(startMs),
            end: new Date(endMs),
            minutes: Math.round((endMs - startMs) / 60000),
            categories: [...WALK_CATEGORIES],
            preferred: [],
            stops: 1,
            careful: false,
            opzionale: true,
            soloCategorie: true,
            // a schermo la passeggiata sta sotto il drink che la precede
            viewKey: drink.key,
        };
        const moments = [...day.moments.slice(0, i + 1), walk, ...day.moments.slice(i + 1)];
        return { ...day, moments, totalStops: day.totalStops + 1 };
    });
    return { ...skeleton, days };
}
