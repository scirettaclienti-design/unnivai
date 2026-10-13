/**
 * ORARI — una tappa vale solo se il posto e' aperto per TUTTA la sosta prevista
 * (arrivo → arrivo + durata), nel giorno vero del tour, nel fuso del posto.
 *
 * I dati sono gli orari settimanali di Google (regularOpeningHours), che la
 * ricerca nuova porta sul candidato come `openingPeriods` nel formato legacy di
 * place/details: [{ open: { day: 0-6 (0 = domenica), time: 'HHmm' }, close: { day, time } }],
 * e `utcOffsetMinutes`. Un posto sempre aperto e' UN periodo che apre domenica
 * 0000 senza `close`. Con la ricerca vecchia i campi non ci sono: stato
 * SCONOSCIUTO, mai un errore e mai un posto tolto.
 *
 * ORARI-FESTIVI — gli orari SPECIALI. regularOpeningHours non vede le chiusure
 * straordinarie (festivi, ferie); currentOpeningHours si': Google li da' per i
 * prossimi 7 giorni (oggi + 6) con le eccezioni gia' dentro, e il proxy li porta
 * sul candidato come `currentHours` = { from, to, periods: [{ date, open: 'HHmm',
 * close: 'HHmm'|null, close_date? }], special_days? }. Per una data coperta
 * (da `from` a `to`) vincono loro: un giorno della finestra senza periodi e'
 * chiuso tutto il giorno. Oltre la finestra (o con una sosta che la scavalca)
 * vale l'orario della settimana. Ogni risposta dice da quale dei due viene
 * (`fonte`: FONTE_GIORNO | FONTE_SETTIMANA), e va nel tracciato.
 *
 * Puro: niente rete, niente orologio.
 */

import { romeParts } from './tourWindow';

export const OPEN = 'aperto';
export const CLOSED = 'chiuso';
export const UNKNOWN = 'sconosciuto';

/** Da quale orario viene il verdetto (va nel tracciato della tappa). */
export const FONTE_GIORNO = 'orario del giorno';
export const FONTE_SETTIMANA = 'orario della settimana';

/** Dopo quest'ora (minuti dalla mezzanotte, ora di Roma) un orario sconosciuto non si sceglie se c'e' un'alternativa aperta nota. */
export const NIGHT_FROM_MINUTES = 21 * 60;

/**
 * Testi APPROVATI (decisione M) per "quasi tutto chiuso", secondo l'ora di Roma
 * di partenza del giro: prima delle 12, dalle 18 in poi, le altre ore.
 */
export const MESSAGGIO_PRESTO = 'È presto: qui quasi tutto apre più tardi.';
export const MESSAGGIO_SERA = 'A quest’ora qui è quasi tutto chiuso. Il giro giusto parte domattina.';
export const MESSAGGIO_ORA = 'A quest’ora qui è quasi tutto chiuso.';
export function messaggioChiuso(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return MESSAGGIO_ORA;
    const h = romeParts(date).h;
    if (h < 12) return MESSAGGIO_PRESTO;
    if (h >= 18) return MESSAGGIO_SERA;
    return MESSAGGIO_ORA;
}
/** Testo APPROVATO (decisione M): un pranzo o una cena senza nessun locale aperto. */
export const TESTO_NESSUN_LOCALE_APERTO = 'Nessun locale aperto qui vicino a quest’ora.';

const WEEK = 7 * 1440;
const hhmm = (t) => {
    const s = String(t ?? '').padStart(4, '0');
    return Number(s.slice(0, 2)) * 60 + Number(s.slice(2, 4));
};
const clock = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** I periodi del candidato, o null se non ci sono (ricerca vecchia, posto senza orari). */
export const periodsOf = (c) => {
    const p = c?.openingPeriods ?? c?.opening_hours?.periods;
    return Array.isArray(p) && p.length > 0 ? p : null;
};

/** Giorno della settimana (0 = domenica) e minuti dalla mezzanotte, nel fuso del posto. */
export function localClock(date, candidate = null) {
    const { day, minutes } = localClockDate(date, candidate);
    return { day, minutes };
}

/** Come localClock, con anche la data locale "YYYY-MM-DD" (serve agli orari del giorno). */
export function localClockDate(date, candidate = null) {
    const off = candidate?.utcOffsetMinutes;
    let y, m, d, h, mi;
    // L'Italia sta sempre a +1 o +2: la data vera dice quale (l'offset che Google
    // manda e' quello di OGGI, sbagliato per un tour dopo il cambio dell'ora).
    // Un fuso diverso da quelli italiani si prende com'e'.
    if (Number.isFinite(off) && off !== 60 && off !== 120) {
        const t = new Date(date.getTime() + off * 60000);
        y = t.getUTCFullYear(); m = t.getUTCMonth() + 1; d = t.getUTCDate(); h = t.getUTCHours(); mi = t.getUTCMinutes();
    } else {
        ({ y, m, d, h, mi } = romeParts(date));
    }
    const pad = (n) => String(n).padStart(2, '0');
    return { day: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), minutes: h * 60 + mi, date: `${y}-${pad(m)}-${pad(d)}` };
}

const cache = new WeakMap();
/** Gli intervalli di apertura sulla settimana, uniti (12–15 e 15–23 diventano 12–23), replicati a -1/0/+1 settimana per il giro della domenica. */
function intervalsOf(periods) {
    if (cache.has(periods)) return cache.get(periods);
    let res;
    if (periods.length === 1 && !periods[0]?.close && periods[0]?.open?.time === '0000') {
        res = 'sempre';
    } else {
        const base = [];
        for (const p of periods) {
            if (!p?.open || !p?.close) continue;
            const a = p.open.day * 1440 + hhmm(p.open.time);
            let c = p.close.day * 1440 + hhmm(p.close.time);
            if (c <= a) c += WEEK;
            base.push([a, c]);
        }
        if (base.length === 0) res = null;
        else {
            const all = [-WEEK, 0, WEEK].flatMap(o => base.map(([a, c]) => [a + o, c + o])).sort((x, y) => x[0] - y[0]);
            res = [];
            for (const iv of all) {
                const last = res[res.length - 1];
                if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
                else res.push([...iv]);
            }
        }
    }
    cache.set(periods, res);
    return res;
}

const DAY = 86400000;
const dayIndex = (iso, fromIso) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY);

const cacheDay = new WeakMap();
/** Gli intervalli degli orari del giorno, in minuti dalla mezzanotte di `from`, uniti. null = niente da usare. */
function dayIntervalsOf(ch) {
    if (cacheDay.has(ch)) return cacheDay.get(ch);
    let res = null;
    const periods = Array.isArray(ch?.periods) ? ch.periods : [];
    if (typeof ch?.from === 'string' && typeof ch?.to === 'string' && periods.length > 0) {
        const base = [];
        for (const p of periods) {
            if (typeof p?.date !== 'string' || p.open == null) continue;
            const a = dayIndex(p.date, ch.from) * 1440 + hhmm(p.open);
            // senza `close`: aperto fino a fine giornata
            let c = p.close == null ? (dayIndex(p.date, ch.from) + 1) * 1440 : dayIndex(p.close_date || p.date, ch.from) * 1440 + hhmm(p.close);
            if (c <= a) c += 1440;
            if (Number.isFinite(a) && Number.isFinite(c)) base.push([a, c]);
        }
        if (base.length) {
            res = [];
            for (const iv of base.sort((x, y) => x[0] - y[0])) {
                const last = res[res.length - 1];
                if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
                else res.push([...iv]);
            }
        }
    }
    cacheDay.set(ch, res);
    return res;
}

/** Il verdetto su un insieme di intervalli: t = minuto d'arrivo nella stessa scala degli intervalli. */
function verdict(iv, t, stayMinutes) {
    const stay = Number.isFinite(stayMinutes) && stayMinutes > 0 ? stayMinutes : 0;
    const dentro = iv.find(([a, b]) => a <= t && t < b);
    if (!dentro) return { stato: CLOSED, motivo: "chiuso all'arrivo" };
    if (dentro[1] >= t + stay) return { stato: OPEN };
    return { stato: CLOSED, motivo: `chiude alle ${clock(((dentro[1] % 1440) + 1440) % 1440)}, prima della fine della sosta`, chiudeAlle: clock(((dentro[1] % 1440) + 1440) % 1440) };
}

/**
 * Il posto e' aperto per tutta la sosta?
 * @param {object} candidate  con openingPeriods (settimana) e/o currentHours (giorni speciali), e utcOffsetMinutes
 * @param {Date} arrival      istante d'arrivo
 * @param {number} stayMinutes sosta prevista
 * @returns {{ stato: 'aperto'|'chiuso'|'sconosciuto', motivo?: string, chiudeAlle?: string, fonte?: string, speciale?: boolean }}
 *   `fonte`: l'orario che ha deciso (assente se sconosciuto); `speciale`: la data e' un giorno speciale per Google.
 */
export function openStatus(candidate, arrival, stayMinutes = 0) {
    if (!(arrival instanceof Date) || Number.isNaN(arrival.getTime())) return { stato: UNKNOWN };
    const stay = Number.isFinite(stayMinutes) && stayMinutes > 0 ? stayMinutes : 0;
    const { day, minutes, date } = localClockDate(arrival, candidate);

    // 1. Gli orari del giorno, se la data (e tutta la sosta) cade nei 7 giorni che Google copre.
    const ch = candidate?.currentHours;
    if (ch && typeof ch.from === 'string' && typeof ch.to === 'string' && date >= ch.from && date <= ch.to) {
        const iv = dayIntervalsOf(ch);
        if (iv) {
            const t = dayIndex(date, ch.from) * 1440 + minutes;
            if (t + stay <= (dayIndex(ch.to, ch.from) + 1) * 1440) {
                return { ...verdict(iv, t, stay), fonte: FONTE_GIORNO, ...(Array.isArray(ch.special_days) && ch.special_days.includes(date) ? { speciale: true } : {}) };
            }
        }
    }

    // 2. Altrimenti l'orario della settimana (come prima di ORARI-FESTIVI).
    const periods = periodsOf(candidate);
    if (!periods) return { stato: UNKNOWN };
    const iv = intervalsOf(periods);
    if (iv === 'sempre') return { stato: OPEN, fonte: FONTE_SETTIMANA };
    if (!iv) return { stato: UNKNOWN };
    return { ...verdict(iv, day * 1440 + minutes, stay), fonte: FONTE_SETTIMANA };
}

/** Per il tracciato e il banco: 'noto' (aperto per tutta la sosta) o 'sconosciuto'. */
export const orarioLabel = (stato) => (stato === UNKNOWN ? 'sconosciuto' : 'noto');

/** Minuti dalla mezzanotte, ora di Roma, di un istante. */
export const romeMinutes = (date) => {
    const p = romeParts(date);
    return p.h * 60 + p.mi;
};
