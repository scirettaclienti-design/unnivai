/**
 * GIRO-EDIT — togliere o cambiare UNA tappa di un giro gia' fatto, senza rigenerarlo.
 *
 * Funzioni pure sulle tappe di UN giorno (la forma che le schede mostrano: titolo, coordinate, `types`, `moment`,
 * `scheduledTime` ISO, `stayMinutes`, `travelMinutesFromPrev`, `waitMinutesBefore`). Niente rete, niente orologio.
 *
 * ─── GLI ORARI DOPO LA MODIFICA ──────────────────────────────────────────────────────────────────────────────────
 *  · la prima tappa tiene il suo orario (se e' lei a sparire, la nuova prima parte dall'orario di prima ma non prima
 *    dell'inizio del suo momento: un museo non si anticipa alle 8:00);
 *  · ogni tappa dopo arriva a fine sosta della precedente + cammino (`computeStopTimings`, le stesse stime del motore),
 *    ma mai prima dell'inizio del suo momento (il pranzo resta alle 12:30);
 *  · se la tappa ha l'orario di apertura e a quell'ora sarebbe chiusa, resta all'orario che aveva (era aperta);
 *  · un'attesa oltre i 45 minuti (`GAP_MAX_MINUTES`) non resta muta: diventa la riga «Tempo libero» con la sua fascia,
 *    la stessa del motore (CONTINUITA'). Le righe di tempo libero di prima si rifanno da capo.
 */

import { computeStopTimings } from './tourTiming';
import { MOMENT_BY_KEY } from './dayMoments';
import { romeParts, romeDate } from './tourWindow';
import { openStatus, OPEN } from './openingHours';
import { freeTimeStop, realStops } from './freeTime';
import { composeFreeTime } from './stopPhrases';
import { GAP_MAX_MINUTES } from './continuity';

/** Un'identita' stabile della tappa: il place_id, o il titolo se il posto non ne ha uno. */
export const chiaveTappa = (s) => s?.place_id || s?.googlePlaceId || (s?.title ? `titolo:${s.title}` : null);

const ms = (v) => {
    if (!v) return null;
    const t = (v instanceof Date ? v : new Date(v)).getTime();
    return Number.isFinite(t) ? t : null;
};

// Solo i momenti con un inizio che ha senso come «non prima di»: il dopocena (22:30–24:30) attraversa la mezzanotte.
const MOMENTI_CON_INIZIO = new Set(['mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'cena']);

/** L'istante in cui comincia il momento della tappa, nel giorno di `riferimentoMs` (ora di Roma); null se non si puo' dire. */
export function inizioDelMomento(stop, riferimentoMs) {
    const m = stop?.moment && MOMENTI_CON_INIZIO.has(stop.moment) ? MOMENT_BY_KEY[stop.moment] : null;
    if (!m || !Number.isFinite(riferimentoMs)) return null;
    const p = romeParts(new Date(riferimentoMs));
    if (p.h < 5) return null; // dopo mezzanotte: il giorno e' quello di ieri, nessun «non prima di» affidabile
    return romeDate({ y: p.y, m: p.m, d: p.d }, m.start).getTime();
}

/**
 * Rimette in orario le tappe vere di un giorno.
 * @param {Array} stops le tappe (anche con righe di tempo libero: si scartano e si rifanno)
 * @param {{ inizioMs: number, clampPrimo?: boolean }} o `inizioMs`: l'orario d'arrivo della prima tappa; `clampPrimo`: la prima non prima del suo momento
 * @returns {{ stops: Array, liberi: Array }} le tappe vere con `scheduledTime`/`waitMinutesBefore` nuovi e le righe di tempo libero
 */
export function ricalcolaGiorno(stops, { inizioMs, clampPrimo = false } = {}) {
    const vere = realStops(stops);
    if (vere.length === 0) return { stops: [], liberi: [] };
    const timed = computeStopTimings(vere).stops;
    const out = [];
    const liberi = [];
    let fineMs = null;
    timed.forEach((s, i) => {
        const originale = ms(s.scheduledTime);
        let arrivo;
        let attesa = 0;
        if (i === 0) {
            arrivo = Number.isFinite(inizioMs) ? inizioMs : originale;
            if (clampPrimo && Number.isFinite(arrivo)) arrivo = Math.max(arrivo, inizioDelMomento(s, arrivo) ?? arrivo);
        } else if (!Number.isFinite(fineMs)) {
            arrivo = null;
        } else {
            const cammino = Number.isFinite(s.travelMinutesFromPrev) ? s.travelMinutesFromPrev : 0;
            const catena = fineMs + cammino * 60000;
            // il «non prima del suo momento» non ritarda mai una tappa: il motore puo' averla messa prima dell'inizio del momento (dopo la colazione)
            const minimo = Math.min(inizioDelMomento(s, catena) ?? catena, Number.isFinite(originale) ? originale : Infinity);
            arrivo = Math.max(catena, minimo);
            // chiusa a quell'ora ma aperta all'orario di prima: resta com'era (mai anticipare un museo prima dell'apertura)
            if (Number.isFinite(originale) && originale > arrivo
                && openStatus(s, new Date(arrivo), s.stayMinutes).stato !== OPEN
                && openStatus(s, new Date(originale), s.stayMinutes).stato === OPEN) arrivo = originale;
            attesa = Math.max(0, Math.ceil((arrivo - catena) / 60000));
        }
        if (attesa > GAP_MAX_MINUTES) {
            const libero = {
                ...freeTimeStop({ moment: s.moment, momentLabel: s.momentLabel ?? null, description: composeFreeTime({ momento: s.moment }) }),
                scheduledTime: new Date(fineMs).toISOString(),
                stayMinutes: attesa,
            };
            liberi.push(libero);
            attesa = 0;
        }
        out.push({ ...s, scheduledTime: Number.isFinite(arrivo) ? new Date(arrivo).toISOString() : null, waitMinutesBefore: attesa });
        fineMs = Number.isFinite(arrivo) && Number.isFinite(s.stayMinutes) ? arrivo + s.stayMinutes * 60000 : null;
    });
    return { stops: out, liberi };
}

const indiceDi = (vere, chiave) => vere.findIndex(s => chiaveTappa(s) === chiave);

/**
 * «Togli»: la tappa esce e gli orari dopo si ricalcolano. L'ultima tappa di un giorno non si toglie.
 * @returns {{ ok: boolean, motivo?: string, tolta?: object, stops?: Array, liberi?: Array }}
 */
export function togliTappa(stops, chiave) {
    const vere = realStops(stops);
    const i = indiceDi(vere, chiave);
    if (i < 0) return { ok: false, motivo: 'tappa non trovata' };
    if (vere.length <= 1) return { ok: false, motivo: 'ultima tappa del giro' };
    const resto = vere.filter((_, k) => k !== i);
    const r = ricalcolaGiorno(resto, { inizioMs: ms(vere[0].scheduledTime), clampPrimo: i === 0 });
    return { ok: true, tolta: vere[i], ...r };
}

/**
 * «Cambia»: la tappa `chiave` diventa `nuova` (un posto vero, verificato), nello stesso momento; gli orari dopo si ricalcolano.
 * @returns {{ ok: boolean, motivo?: string, sostituita?: object, stops?: Array, liberi?: Array }}
 */
export function sostituisciTappa(stops, chiave, nuova) {
    const vere = realStops(stops);
    const i = indiceDi(vere, chiave);
    if (i < 0) return { ok: false, motivo: 'tappa non trovata' };
    const vecchia = vere[i];
    const messa = {
        ...nuova,
        moment: vecchia.moment,
        momentLabel: vecchia.momentLabel,
        ...(vecchia.sostaAperitivo ? { sostaAperitivo: vecchia.sostaAperitivo } : {}),
        ...(vecchia.passeggiata ? { passeggiata: true } : {}),
        scheduledTime: vecchia.scheduledTime ?? null,
        waitMinutesBefore: vecchia.waitMinutesBefore,
    };
    const lista = vere.map((s, k) => (k === i ? messa : s));
    const r = ricalcolaGiorno(lista, { inizioMs: ms(vere[0].scheduledTime), clampPrimo: false });
    return { ok: true, sostituita: vecchia, ...r };
}

/** Le tappe di un giorno con le righe di tempo libero rimesse al loro posto, per orario (la forma di `day.stops` di Crea). */
export function conLiberi({ stops, liberi }) {
    const out = [...(stops || [])];
    for (const f of liberi || []) {
        const t = ms(f.scheduledTime);
        let at = out.length;
        if (Number.isFinite(t)) {
            const i = out.findIndex(x => { const xt = ms(x.scheduledTime); return Number.isFinite(xt) && xt > t; });
            if (i >= 0) at = i;
        }
        out.splice(at, 0, f);
    }
    return out;
}
