/**
 * CONTINUITA' — nella giornata ogni intervallo e' coperto: da una tappa, dal
 * cammino o da una riga dichiarata (tempo libero). Un buco non dichiarato
 * oltre GAP_MAX_MINUTES e' un errore.
 *
 * ─── DA DOVE NASCE UN BUCO ───────────────────────────────────────────────────
 * Ogni momento della giornata (dayMoments.js) ha un'ora d'inizio fissa: il
 * pranzo comincia alle 12:30 anche se la mattina e' finita alle 10:10. Lo
 * scheduling (scheduleMomentPlan) mette la tappa all'inizio del suo momento e
 * ricorda l'attesa in `waitMinutesBefore`. Con soste corte (una chiesa dura 20
 * minuti) quell'attesa puo' valere ore, e a schermo era un vuoto senza riga.
 *
 * ─── COME SI CHIUDE ──────────────────────────────────────────────────────────
 *   1. prima si prova ad AGGIUNGERE una tappa aperta dal pool del momento, con
 *      le regole di sempre (varieta', percorso, orari): momentSelection.fillGaps;
 *   2. se non c'e', il buco diventa una riga di tempo libero (testo approvato)
 *      con la SUA fascia oraria: bandFreeTime. Il tempo libero occupa il suo
 *      tempo (`stayMinutes` = l'attesa che prima stava sulla tappa dopo).
 *
 * Un'attesa fino a GAP_MAX_MINUTES non e' un buco: e' il tempo di arrivare.
 * Modulo puro, senza rete.
 */

import { stayInMoment, travelMinutes } from './tourTiming';
import { MOMENT_BY_KEY } from './dayMoments';

/** Oltre questa attesa fra due tappe serve una tappa o una riga dichiarata. */
export const GAP_MAX_MINUTES = 45;

/** C8d — con ritmo Rilassato fino a questa attesa resta la regola CONTINUITA' (tempo libero dichiarato); oltre, UNA tappa leggera. */
export const GAP_RILASSATO_MINUTES = 90;

/**
 * C8b — I MINIMI DI TAPPE (decisione di Ivano), per la durata della finestra del giorno:
 *   6 ore o piu' → almeno 4 tappe; da 3 a 6 ore → almeno 3; meno di 3 ore → almeno 2; mai 1.
 * Le righe di tempo libero non sono tappe. Di sera un drink piu' la cena (o piu' la passeggiata) e' un giro completo.
 * Se il pool non arriva al minimo il giro lo dichiara (una riga di tempo libero): mai un tour corto in silenzio.
 */
export const MIN_STOPS_LUNGO_ORE = 6;
export const MIN_STOPS_MEDIO_ORE = 3;
export function minStopsForWindow(minutes) {
    if (!Number.isFinite(minutes)) return 2;
    if (minutes >= MIN_STOPS_LUNGO_ORE * 60) return 4;
    if (minutes >= MIN_STOPS_MEDIO_ORE * 60) return 3;
    return 2;
}
/** Un giro serale completo: un drink e (la cena o la passeggiata), oppure la cena e la passeggiata. */
export function isEveningComplete(entries) {
    const list = Array.isArray(entries) ? entries : [];
    const has = (f) => list.some(f);
    const drink = has(e => e?.moment?.bevuta);
    const cena = has(e => e?.moment?.key === 'cena');
    const walk = has(e => e?.moment?.key === 'passeggiata');
    return (drink && (cena || walk)) || (cena && walk);
}

const idOf = (c) => c?.place_id || c?.googlePlaceId || null;

/**
 * I buchi di un piano gia' messo in orario (scheduleMomentPlan): fra due tappe
 * consecutive dello stesso giorno, il tempo fra "fine della prima + cammino" e
 * l'inizio della seconda, se supera `max`. Si ricalcola dagli orari di inizio,
 * non dall'attesa memorizzata: una tappa tolta dopo (orari) la lascerebbe vecchia.
 * L'attesa prima della PRIMA tappa del giorno non e' un buco: il giro comincia li'.
 * @returns {Array<{ dayIndex: number, index: number, minutes: number, from: Date, to: Date, prev: object, next: object }>}
 */
export function scheduleGaps(sched, max = GAP_MAX_MINUTES) {
    const out = [];
    (sched?.days || []).forEach((day, dayIndex) => {
        for (let i = 1; i < day.length; i++) {
            const prev = day[i - 1];
            const next = day[i];
            const freeFrom = prev.start.getTime() + (stayInMoment(prev.candidate, prev.moment) + (travelMinutes(prev.candidate, next.candidate) ?? 0)) * 60000;
            const minutes = Math.ceil((next.start.getTime() - freeFrom) / 60000);
            if (minutes > max) out.push({ dayIndex, index: i, minutes, from: new Date(freeFrom), to: next.start, prev, next });
        }
    });
    return out;
}

/** Lo stesso piano con `waitMinutesBefore` rifatto dagli orari di inizio (dalla seconda tappa in poi). */
export function retimeWaits(sched) {
    return {
        ...sched,
        days: (sched?.days || []).map(day => day.map((s, i) => {
            if (i === 0) return s;
            const prev = day[i - 1];
            const earliest = prev.start.getTime() + (stayInMoment(prev.candidate, prev.moment) + (travelMinutes(prev.candidate, s.candidate) ?? 0)) * 60000;
            return { ...s, waitMinutesBefore: Math.max(0, Math.ceil((s.start.getTime() - earliest) / 60000)) };
        })),
    };
}

/** I minuti di buco, in totale, di un piano (per confrontare due piani). */
export const totalGapMinutes = (sched, max = GAP_MAX_MINUTES) => scheduleGaps(sched, max).reduce((a, g) => a + g.minutes, 0);

/** Il numero di tappe vere di un piano. */
export const realStopCount = (sched) => (sched?.days || []).reduce((n, d) => n + d.length, 0);

const clockMin = ({ h, m }) => h * 60 + m;

/**
 * Come si divide un'attesa W fra le righe di tempo libero consecutive prima di
 * una tappa. Le righe stanno nell'ordine dei momenti: ognuna prende il tempo
 * che il SUO momento copre (dalla fine di quella prima fino al limite del suo
 * momento), l'ultima il resto. Il buco finisce dove comincia il cammino verso
 * la tappa: la tappa parte all'inizio del suo momento (e' per questo che aspettava).
 */
function splitWait(run, next, wait) {
    const out = run.map(() => 0);
    const nm = MOMENT_BY_KEY[next?.moment];
    if (!nm) { out[0] = wait; return out; }
    const walk = Number.isFinite(next.travelMinutesFromPrev) ? next.travelMinutesFromPrev : 0;
    const end = clockMin(nm.start) - walk;
    let cursor = end - wait;
    let left = wait;
    run.forEach((r, k) => {
        if (k === run.length - 1) { out[k] = left; return; }
        const w = MOMENT_BY_KEY[r.moment];
        const upto = w ? Math.min(end, clockMin(w.end)) : end;
        const len = Math.max(0, Math.min(left, upto - cursor));
        out[k] = len;
        cursor += len;
        left -= len;
    });
    return out;
}

/**
 * Il tempo libero occupa il suo tempo. Data la lista di un giorno (tappe vere e
 * righe di tempo libero, nell'ordine), le righe di tempo libero prima di una
 * tappa prendono l'attesa di quella tappa: `stayMinutes` = fascia, e la tappa
 * dopo non aspetta piu' (`waitMinutesBefore` 0). Gli orari restano quelli di
 * prima: tempo libero + cammino = vecchia attesa + cammino. Senza una tappa dopo
 * (riga in coda) la fascia non c'e': non si inventa una fine.
 */
export function bandFreeTime(stops) {
    const list = Array.isArray(stops) ? stops : [];
    const out = [];
    for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (!s?.tempoLibero) { out.push(s); continue; }
        let j = i;
        while (j + 1 < list.length && list[j + 1]?.tempoLibero) j++;
        const run = list.slice(i, j + 1);
        const next = list[j + 1];
        const wait = Number.isFinite(next?.waitMinutesBefore) && next.waitMinutesBefore > 0 ? next.waitMinutesBefore : 0;
        const parts = splitWait(run, next, wait);
        run.forEach((r, k) => out.push({ ...r, stayMinutes: parts[k], travelMinutesFromPrev: 0, waitMinutesBefore: 0 }));
        if (next) {
            out.push({ ...next, waitMinutesBefore: 0 });
            j += 1;
        }
        i = j;
    }
    return out;
}

/**
 * I buchi che restano in una lista di un giorno GIA' CALCOLATA (con
 * `scheduledTime`, `stayMinutes`, `travelMinutesFromPrev`): fra una voce e la
 * successiva, il tempo non coperto da sosta e cammino. Serve ai test e a chi
 * vuole controllare un giro finito; il banco ha il suo controllo indipendente.
 * @returns {Array<{ dopo: string|null, prima: string|null, minuti: number }>}
 */
export function remainingGaps(stops, max = GAP_MAX_MINUTES) {
    const out = [];
    const list = Array.isArray(stops) ? stops : [];
    for (let i = 1; i < list.length; i++) {
        const a = list[i - 1];
        const b = list[i];
        if (!a?.scheduledTime || !b?.scheduledTime) continue;
        const end = new Date(a.scheduledTime).getTime() + (Number.isFinite(a.stayMinutes) ? a.stayMinutes : 0) * 60000;
        const walk = b.tempoLibero ? 0 : (Number.isFinite(b.travelMinutesFromPrev) ? b.travelMinutesFromPrev : 0);
        const minuti = Math.round((new Date(b.scheduledTime).getTime() - end) / 60000) - walk;
        if (minuti > max) out.push({ dopo: a.title ?? idOf(a), prima: b.title ?? idOf(b), minuti });
    }
    return out;
}
