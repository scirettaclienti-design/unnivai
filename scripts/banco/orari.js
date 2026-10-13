// BANCO-ESTESO — gli orari di apertura di Google (opening_hours.periods) e il
// controllo "aperto a quell'ora". Funzioni pure, senza rete.
//
// periods: [{ open: { day: 0-6 (0 = domenica), time: 'HHmm' }, close: { day, time } }]
// Un posto sempre aperto arriva come UN periodo che apre domenica 0000 senza
// `close`. Un periodo che chiude "il giorno dopo" ha close.day diverso da open.day.

const FUSO = 'Europe/Rome';
const GIORNI = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Giorno della settimana (0 = domenica) e minuti dalla mezzanotte, ora di Roma, di un istante. */
export function giornoEMinuti(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
        .formatToParts(d).map(x => [x.type, x.value]));
    const h = Number(p.hour) % 24;
    return { giorno: GIORNI[p.weekday], minuti: h * 60 + Number(p.minute) };
}

const hhmm = (t) => { const s = String(t || '').padStart(4, '0'); return Number(s.slice(0, 2)) * 60 + Number(s.slice(2, 4)); };

/**
 * Il posto e' aperto in quel giorno/minuto?
 * @returns {true|false|null} null = orario sconosciuto (nessun periodo)
 */
export function apertoAlle(periods, giorno, minuti) {
    if (!Array.isArray(periods) || periods.length === 0) return null;
    if (periods.length === 1 && !periods[0].close && periods[0].open?.time === '0000') return true;
    const SETT = 7 * 1440;
    const t = giorno * 1440 + minuti;
    for (const p of periods) {
        if (!p?.open || !p?.close) continue;
        const a = p.open.day * 1440 + hhmm(p.open.time);
        let c = p.close.day * 1440 + hhmm(p.close.time);
        if (c <= a) c += SETT;
        if ((t >= a && t < c) || (t + SETT >= a && t + SETT < c)) return true;
    }
    return false;
}

/** "mer 18:00–00:00, gio …" per i messaggi: gli orari del giorno dato. */
export function orariDelGiorno(periods, giorno) {
    const nomi = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
    if (!Array.isArray(periods) || periods.length === 0) return 'orari sconosciuti';
    const fmt = (t) => { const m = hhmm(t); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
    const del = periods.filter(p => p?.open?.day === giorno && p?.close);
    return del.length ? `${nomi[giorno]} ${del.map(p => `${fmt(p.open.time)}–${fmt(p.close.time)}`).join(', ')}` : `${nomi[giorno]} chiuso`;
}

/**
 * Aperto per TUTTA la sosta (arrivo → arrivo + durata)? Campiona ogni 5 minuti
 * (e l'ultimo istante) con apertoAlle: un controllo indipendente da quello del
 * motore (src/lib/openingHours.js), che unisce gli intervalli.
 * @returns {true|false|null} null = orario sconosciuto; `perche`: 'arrivo' | 'oltre-chiusura'
 */
export function apertoPerTutta(periods, giorno, minuti, durata = 0) {
    const a = apertoAlle(periods, giorno, minuti);
    if (a === null) return { aperto: null };
    if (a === false) return { aperto: false, perche: 'arrivo' };
    for (let m = minuti + 5; m < minuti + durata; m += 5) {
        if (apertoAlle(periods, (giorno + Math.floor(m / 1440)) % 7, m % 1440) === false) return { aperto: false, perche: 'oltre-chiusura' };
    }
    if (durata > 0) {
        const f = minuti + durata - 1;     // l'ultimo minuto della sosta
        if (apertoAlle(periods, (giorno + Math.floor(f / 1440)) % 7, f % 1440) === false) return { aperto: false, perche: 'oltre-chiusura' };
    }
    return { aperto: true };
}

// ─── ORARI-FESTIVI — gli orari del giorno (currentOpeningHours, 7 giorni con date) ───────────
// current: { from, to, periods: [{ date: 'YYYY-MM-DD', open: 'HHmm', close: 'HHmm'|null, close_date? }] }
// Un giorno della finestra senza periodi e' chiuso tutto il giorno. Codice del banco, indipendente
// dal motore (src/lib/openingHours.js): campiona ogni 5 minuti su istanti assoluti.

/** La data di Roma "YYYY-MM-DD" di un istante. */
export function dataRoma(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('sv-SE', { timeZone: FUSO }).format(d);
}

const MIN = 60000;
const istante = (data, hhmmOMinuti) => Date.parse(`${data}T00:00:00Z`) / MIN + (typeof hhmmOMinuti === 'number' ? hhmmOMinuti : hhmm(hhmmOMinuti));

/** La finestra copre quella data (e ci sono periodi)? */
export const coperta = (current, data) => !!current && Array.isArray(current.periods) && current.periods.length > 0 && !!data
    && typeof current.from === 'string' && typeof current.to === 'string' && data >= current.from && data <= current.to;

function apertoIstante(current, t) {
    for (const p of current.periods) {
        const a = istante(p.date, p.open);
        let c = p.close == null ? istante(p.date, 1440) : istante(p.close_date || p.date, p.close);
        if (c <= a) c += 1440;
        if (t >= a && t < c) return true;
    }
    return false;
}

/**
 * Aperto per tutta la sosta secondo gli orari del giorno?
 * @returns {{ aperto: true|false|null, perche?: 'arrivo'|'oltre-chiusura' }} null = data o sosta fuori dalla finestra (vale la settimana)
 */
export function apertoPerTuttaGiorno(current, data, minuti, durata = 0) {
    if (!coperta(current, data)) return { aperto: null };
    const t0 = istante(data, minuti);
    const fineFinestra = istante(current.to, 1440);
    if (t0 + durata > fineFinestra) return { aperto: null };
    if (!apertoIstante(current, t0)) return { aperto: false, perche: 'arrivo' };
    for (let m = 5; m < durata; m += 5) if (!apertoIstante(current, t0 + m)) return { aperto: false, perche: 'oltre-chiusura' };
    if (durata > 0 && !apertoIstante(current, t0 + durata - 1)) return { aperto: false, perche: 'oltre-chiusura' };
    return { aperto: true };
}

/** "17/10 chiuso" o "17/10 10:00–13:00" per i messaggi. */
export function orariDelGiornoData(current, data) {
    const f = (t) => { const m = hhmm(t); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
    const del = (current?.periods || []).filter(p => p.date === data);
    const gg = data ? `${data.slice(8, 10)}/${data.slice(5, 7)}` : '?';
    return del.length ? `${gg} ${del.map(p => `${f(p.open)}–${p.close == null ? '24:00' : f(p.close)}`).join(', ')} (orario del giorno)` : `${gg} chiuso (orario del giorno)`;
}
