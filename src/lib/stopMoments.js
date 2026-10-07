/**
 * Gate TAPPE PER MOMENTO — come le schermate del tour raggruppano le tappe.
 *
 * Solo presentazione: niente orari calcolati qui. L'orario di una tappa e' il
 * suo `scheduledTime`, gia' calcolato dal motore (refreshTourScheduledTimes):
 * qui lo si FORMATTA soltanto. Se manca, la tappa non ha orario — nessun
 * ripiego sullo scarto dall'inizio ("+1h31"), che non dice a che ora arrivi.
 *
 * Nomi e confini dei momenti vengono SOLO da dayMoments.js:
 *   · se la tappa porta `moment` (la chiave che le ha dato lo scheletro), vale quella;
 *   · altrimenti il momento che contiene il suo orario (momentAtClock);
 *   · senza ne' l'uno ne' l'altro, nessuna intestazione.
 *
 * Orari e date si leggono sul fuso di Roma, lo stesso su cui il motore li ha
 * calcolati (tourWindow.js): "12:30" resta 12:30 anche su un telefono o una CI
 * in un altro fuso. V1 e' solo-Italia.
 */

import { MOMENT_BY_KEY, momentAtClock } from './dayMoments';
import { romeParts, TOUR_TIME_ZONE } from './tourWindow';

const validDate = (v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

const pad = (n) => String(n).padStart(2, '0');

/** "HH:MM" dell'arrivo, o null se la tappa non ha un orario calcolato. */
export function stopClockLabel(stop) {
    const d = validDate(stop?.scheduledTime);
    if (!d) return null;
    const p = romeParts(d);
    return `${pad(p.h)}:${pad(p.mi)}`;
}

/** Il momento della tappa (oggetto di dayMoments), o null. */
export function stopMoment(stop) {
    if (stop?.moment && MOMENT_BY_KEY[stop.moment]) return MOMENT_BY_KEY[stop.moment];
    const d = validDate(stop?.scheduledTime);
    if (!d) return null;
    const p = romeParts(d);
    return momentAtClock(p.h, p.mi);
}

const dayKeyOf = (d) => {
    const p = romeParts(d);
    return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
};

const dayLabelFmt = new Intl.DateTimeFormat('it-IT', {
    timeZone: TOUR_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long',
});

/**
 * Le tappe, nell'ordine dato, raggruppate prima per giorno e poi per momento.
 * I gruppi sono CONSECUTIVI: l'ordine delle tappe lo decide il motore e qui
 * non si riordina niente.
 *
 * Il dopocena dopo mezzanotte resta sul giorno in cui e' cominciato, come in
 * dayMoments.js (fine 24:30). Una tappa senza orario resta nel giorno della
 * precedente.
 *
 * @param {Array} stops
 * @returns {Array<{ dayKey: string|null, dayLabel: string|null,
 *   groups: Array<{ moment: object|null, items: Array<{ stop: object, index: number, timeLabel: string|null }> }> }>}
 */
export function groupStopsByDayAndMoment(stops) {
    const days = [];
    (Array.isArray(stops) ? stops : []).forEach((stop, index) => {
        const d = validDate(stop?.scheduledTime);
        const moment = stopMoment(stop);
        const prevDay = days[days.length - 1] || null;
        let dayKey = d ? dayKeyOf(d) : (prevDay?.dayKey ?? null);
        if (moment?.key === 'dopocena' && prevDay && prevDay.dayKey !== dayKey) dayKey = prevDay.dayKey;

        let day = prevDay && prevDay.dayKey === dayKey ? prevDay : null;
        if (!day) {
            day = { dayKey, dayLabel: d ? dayLabelFmt.format(d) : null, groups: [] };
            days.push(day);
        }
        const lastGroup = day.groups[day.groups.length - 1];
        const item = { stop, index, timeLabel: stopClockLabel(stop) };
        if (lastGroup && (lastGroup.moment?.key ?? null) === (moment?.key ?? null)) lastGroup.items.push(item);
        else day.groups.push({ moment, items: [item] });
    });
    return days;
}
