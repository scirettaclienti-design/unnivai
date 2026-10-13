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
 * Limite dichiarato: regularOpeningHours non vede le chiusure straordinarie
 * (festivi, ferie). currentOpeningHours le vedrebbe ma costa nella stessa fascia
 * e non e' nella maschera: un posto aperto "di norma" puo' essere chiuso quel giorno.
 *
 * Puro: niente rete, niente orologio.
 */

import { romeParts } from './tourWindow';

export const OPEN = 'aperto';
export const CLOSED = 'chiuso';
export const UNKNOWN = 'sconosciuto';

/** Dopo quest'ora (minuti dalla mezzanotte, ora di Roma) un orario sconosciuto non si sceglie se c'e' un'alternativa aperta nota. */
export const NIGHT_FROM_MINUTES = 21 * 60;

/** Testo PROVVISORIO (decisione M, da far approvare a Ivano): meno di 2 tappe aperte. */
export const MESSAGGIO_CHIUSO = "Meglio domattina: a quest'ora qui è quasi tutto chiuso.";
/** Testo PROVVISORIO (decisione M, da far approvare a Ivano): un pasto senza nessun locale aperto. */
export const TESTO_NESSUN_LOCALE_APERTO = "Nessun locale aperto qui vicino a quest'ora.";

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
    return { day: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), minutes: h * 60 + mi };
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

/**
 * Il posto e' aperto per tutta la sosta?
 * @param {object} candidate  con openingPeriods (e utcOffsetMinutes)
 * @param {Date} arrival      istante d'arrivo
 * @param {number} stayMinutes sosta prevista
 * @returns {{ stato: 'aperto'|'chiuso'|'sconosciuto', motivo?: string, chiudeAlle?: string }}
 */
export function openStatus(candidate, arrival, stayMinutes = 0) {
    const periods = periodsOf(candidate);
    if (!periods || !(arrival instanceof Date) || Number.isNaN(arrival.getTime())) return { stato: UNKNOWN };
    const iv = intervalsOf(periods);
    if (iv === 'sempre') return { stato: OPEN };
    if (!iv) return { stato: UNKNOWN };
    const { day, minutes } = localClock(arrival, candidate);
    const t = day * 1440 + minutes;
    const stay = Number.isFinite(stayMinutes) && stayMinutes > 0 ? stayMinutes : 0;
    const dentro = iv.find(([a, b]) => a <= t && t < b);
    if (!dentro) return { stato: CLOSED, motivo: "chiuso all'arrivo" };
    if (dentro[1] >= t + stay) return { stato: OPEN };
    return { stato: CLOSED, motivo: `chiude alle ${clock(dentro[1] % 1440)}, prima della fine della sosta`, chiudeAlle: clock(dentro[1] % 1440) };
}

/** Per il tracciato e il banco: 'noto' (aperto per tutta la sosta) o 'sconosciuto'. */
export const orarioLabel = (stato) => (stato === UNKNOWN ? 'sconosciuto' : 'noto');

/** Minuti dalla mezzanotte, ora di Roma, di un istante. */
export const romeMinutes = (date) => {
    const p = romeParts(date);
    return p.h * 60 + p.mi;
};
