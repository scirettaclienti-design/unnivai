/**
 * Gate FINESTRA TEMPORALE (G3) — quando parte e quando finisce un percorso.
 *
 * ─── PERCHE' ESISTE ──────────────────────────────────────────────────────────
 * Fino a G2 l'ora di partenza di ogni tour era `new Date()`: "Domani voglio
 * vivere Roma da romano" scritto lunedi' alle 20:57 produceva un tour che
 * partiva lunedi' alle 20:57, con la prima tappa alle 20:57 e una narrativa
 * "sera". Il riferimento temporale stava nella frase dell'utente e nessuno lo
 * leggeva — o peggio, lo leggeva solo il modello, che non e' una sorgente di
 * orari (F57).
 *
 * Qui la finestra si calcola nel CODICE: funzione pura, niente modello, niente
 * rete. Input: testo, ora della richiesta, tipo di percorso, durata scelta.
 * Output: { date, start, end } nel fuso Europe/Rome.
 *
 * ─── REGOLE (decise da Ivano) ────────────────────────────────────────────────
 *   · Percorso Veloce ('quick'): parte SEMPRE da adesso. Il testo non conta —
 *     e' costruito dal wizard, non scritto dall'utente.
 *   · Crea il tuo Percorso ('custom'):
 *       - nessuna indicazione di tempo           → da adesso;
 *       - un giorno futuro ("domani", "sabato",
 *         "il 15 ottobre", "fra 3 giorni"…)      → giornata intera 9:30–22:30;
 *       - giorno + fascia ("sabato pomeriggio") → dall'inizio della fascia;
 *       - "stasera"                             → oggi, dalle 18:00 o da adesso
 *                                                 se e' piu' tardi;
 *       - "alle 17"                             → da quell'ora.
 *   · Fine: dalla durata scelta (Mezza Giornata = 4 ore, 1 Giorno = fino alle
 *     22:30). Senza durata: fine della fascia, altrimenti 22:30.
 *     "2-3 Giorni" → una finestra per ogni giorno (3: il massimo dichiarato).
 *   · Se prima delle 22:30 restano meno di 60 minuti, la finestra passa al
 *     giorno dopo alle 9:30, e `shiftedToNextDay` lo dice.
 *
 * ─── IL FUSO ─────────────────────────────────────────────────────────────────
 * Ogni orario qui e' un orario di ROMA, non del dispositivo: "domani alle 9:30"
 * e' 9:30 a Roma anche se il telefono (o la CI, che gira in UTC) e' altrove.
 * V1 e' solo-Italia, quindi un fuso fisso e dichiarato.
 */

export const TOUR_TIME_ZONE = 'Europe/Rome';

// Giornata "intera": quando un percorso puo' ragionevolmente iniziare e finire.
export const DAY_START = { h: 9, m: 30 };
export const DAY_END = { h: 22, m: 30 };

// Sotto questa soglia prima di DAY_END non c'e' un percorso, c'e' un saluto.
export const MIN_WINDOW_MINUTES = 60;

// Fasce nominabili. `end` e' la fine quando l'utente non sceglie una durata.
export const FASCE = {
    mattina:    { start: { h: 9, m: 30 },  end: { h: 13, m: 0 } },
    pranzo:     { start: { h: 12, m: 30 }, end: { h: 15, m: 0 } },
    pomeriggio: { start: { h: 15, m: 0 },  end: { h: 18, m: 0 } },
    sera:       { start: { h: 18, m: 0 },  end: { h: 22, m: 30 } },
};

// Durate del Percorso Veloce (QuickPath: "1-2 ore", "2-4 ore", "4-6 ore"):
// si prende l'estremo alto, e' la promessa che la card fa all'utente.
const QUICK_MINUTES = { veloce: 120, medio: 240, lungo: 360 };
const QUICK_DEFAULT_MINUTES = 120;

const MULTI_DAY_COUNT = 3;

// ─── Fuso: conversioni fra istante e orario civile di Roma ───────────────────

const romeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TOUR_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** Orario civile di Roma per un istante. */
export function romeParts(date) {
    const p = {};
    for (const { type, value } of romeFormatter.formatToParts(date)) p[type] = value;
    return {
        y: Number(p.year), m: Number(p.month), d: Number(p.day),
        h: Number(p.hour), mi: Number(p.minute),
    };
}

/** Ora (0-23) a Roma. Serve al timeContext: la fascia si legge sul fuso del tour. */
export function romeHour(date) {
    return romeParts(date).h;
}

const offsetMinutes = (utcMs) => {
    const p = romeParts(new Date(utcMs));
    return (Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(utcMs / 60000) * 60000) / 60000;
};

/** Istante corrispondente a un orario civile di Roma (gestisce l'ora legale). */
export function romeDate({ y, m, d }, { h, m: mi }) {
    const guess = Date.UTC(y, m - 1, d, h, mi);
    const off = offsetMinutes(guess);
    let t = guess - off * 60000;
    const off2 = offsetMinutes(t);
    if (off2 !== off) t = guess - off2 * 60000;
    return new Date(t);
}

// ─── Aritmetica sul calendario (date civili, niente fuso) ────────────────────

const addDays = ({ y, m, d }, n) => {
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
const weekday = ({ y, m, d }) => new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domenica
const sameDay = (a, b) => a.y === b.y && a.m === b.m && a.d === b.d;
const cmpDay = (a, b) => Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d);
const isoDay = ({ y, m, d }) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// ─── Lettura del testo ───────────────────────────────────────────────────────

const normalize = (text) => String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'");

const WEEKDAYS = { domenica: 0, lunedi: 1, martedi: 2, mercoledi: 3, giovedi: 4, venerdi: 5, sabato: 6 };
const MONTHS = {
    gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
    luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};
const NUMBER_WORDS = {
    un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5,
    sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, quindici: 15,
};

const toNumber = (w) => (/^\d+$/.test(w) ? Number(w) : NUMBER_WORDS[w]);

/**
 * Il giorno nominato nel testo, relativo a `today`. null se il testo non ne
 * nomina nessuno. Ordine = priorita': il primo che riconosce, vince.
 */
function parseDay(t, today) {
    if (/\bdopodomani\b/.test(t)) return addDays(today, 2);
    if (/\bdomani\b/.test(t)) return addDays(today, 1);
    if (/\b(oggi|stasera|stamattina|stamani|stamane)\b/.test(t)) return today;

    // "fra una settimana", "tra 3 giorni", "fra due settimane"
    const rel = t.match(/\b(?:fra|tra)\s+(\d+|[a-z]+)\s+(giorn[oi]|settiman[ae])\b/);
    if (rel) {
        const n = toNumber(rel[1]);
        if (Number.isFinite(n)) return addDays(today, rel[2].startsWith('settiman') ? n * 7 : n);
    }

    // "la prossima settimana" / "la settimana prossima" = lunedi' prossimo
    if (/\b(prossima settimana|settimana prossima)\b/.test(t)) {
        return addDays(today, ((1 - weekday(today) + 7) % 7) || 7);
    }

    // "questo weekend" / "nel fine settimana" = sabato (oggi, se il weekend e' gia' iniziato)
    if (/\b(week-?end|fine ?settimana)\b/.test(t)) {
        const wd = weekday(today);
        if (wd === 6 || wd === 0) return today;
        return addDays(today, 6 - wd);
    }

    // "15/10", "15/10/2027", "15-10"
    const num = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
    if (num) {
        const date = explicitDate(today, Number(num[1]), Number(num[2]), num[3]);
        if (date) return date;
    }

    // "il 15 ottobre", "15 ottobre"
    const named = t.match(new RegExp(`\\b(\\d{1,2})\\s+(${Object.keys(MONTHS).join('|')})\\b(?:\\s+(\\d{4}))?`));
    if (named) {
        const date = explicitDate(today, Number(named[1]), MONTHS[named[2]], named[3]);
        if (date) return date;
    }

    // "il 15", "l'8" — il prossimo giorno del mese con quel numero
    const dayOnly = t.match(/\b(?:il|l')\s*(\d{1,2})\b(?!\s*(?:[:.]\d|ore\b|min))/);
    if (dayOnly) {
        const d = Number(dayOnly[1]);
        if (d >= 1 && d <= 31) {
            let { y, m } = today;
            if (d < today.d) { m += 1; if (m > 12) { m = 1; y += 1; } }
            // Un 31 in un mese da 30 giorni scivola al mese dopo che lo ha.
            while (d > daysInMonth(y, m)) { m += 1; if (m > 12) { m = 1; y += 1; } }
            return { y, m, d };
        }
    }

    // "sabato", "lunedi'" — sempre il PROSSIMO: detto di lunedi', "lunedi'" e' fra 7 giorni.
    for (const [name, wd] of Object.entries(WEEKDAYS)) {
        if (new RegExp(`\\b${name}\\b`).test(t)) {
            return addDays(today, ((wd - weekday(today) + 7) % 7) || 7);
        }
    }
    return null;
}

// Una data esplicita gia' passata quest'anno si legge come quella dell'anno prossimo.
function explicitDate(today, d, m, yRaw) {
    if (!(m >= 1 && m <= 12)) return null;
    let y = yRaw ? Number(yRaw.length === 2 ? `20${yRaw}` : yRaw) : today.y;
    if (!(d >= 1 && d <= daysInMonth(y, m))) return null;
    if (!yRaw && cmpDay({ y, m, d }, today) < 0) y += 1;
    return { y, m, d };
}

function parseFascia(t) {
    if (/\b(stasera|sera|serata|cena)\b/.test(t)) return 'sera';
    if (/\b(pomeriggio)\b/.test(t)) return 'pomeriggio';
    if (/\b(pranzo|mezzogiorno)\b/.test(t)) return 'pranzo';
    if (/\b(stamattina|stamani|stamane|mattina|mattino|mattinata)\b/.test(t)) return 'mattina';
    return null;
}

// "alle 17", "alle 17:30", "dalle 9.30", "ore 18", "all'una"
function parseHour(t) {
    if (/\ball'una\b/.test(t)) return { h: 13, m: 0 };
    const mt = t.match(/\b(?:alle|dalle|ore)\s+(\d{1,2})(?:[:.](\d{2}))?\b/);
    if (!mt) return null;
    let h = Number(mt[1]);
    const m = mt[2] ? Number(mt[2]) : 0;
    if (h > 23 || m > 59) return null;
    // "alle 3" in un percorso turistico e' pomeriggio, non notte.
    if (h >= 1 && h <= 7) h += 12;
    return { h, m };
}

// ─── Durata ──────────────────────────────────────────────────────────────────

const durationKind = (duration) => {
    const d = normalize(duration).trim();
    if (!d) return null;
    if (d.includes('mezza')) return 'half';
    if (/\b2\s*-\s*3\b|giorni/.test(d)) return 'multi';
    if (d.includes('giorno')) return 'day';
    return null;
};

const minutesBetween = (a, b) => (b.getTime() - a.getTime()) / 60000;
const minDate = (a, b) => (a.getTime() <= b.getTime() ? a : b);

/**
 * La finestra temporale di un percorso.
 *
 * @param {object} p
 * @param {string} [p.text]        la frase dell'utente
 * @param {Date}   p.requestTime   l'istante della richiesta
 * @param {'quick'|'custom'} [p.pathType] tipo di percorso (default 'quick': da adesso)
 * @param {string} [p.duration]    la durata scelta ('Mezza Giornata', '1 Giorno', '2-3 Giorni', 'Veloce'…)
 * @returns {{ date: string, start: Date, end: Date, timeZone: string,
 *            shiftedToNextDay: boolean, anchored: boolean, reason: string,
 *            windows: Array<{ date: string, start: Date, end: Date }> }}
 */
export function resolveTourWindow({ text = '', requestTime, pathType = 'quick', duration = '' } = {}) {
    const now = requestTime instanceof Date && !Number.isNaN(requestTime.getTime()) ? requestTime : new Date();
    const nowParts = romeParts(now);
    const today = { y: nowParts.y, m: nowParts.m, d: nowParts.d };

    const build = ({ day, start, end, shifted = false, reason, extraDays = 0 }) => {
        const windows = [{ date: isoDay(day), start, end }];
        for (let i = 1; i <= extraDays; i++) {
            const next = addDays(day, i);
            windows.push({ date: isoDay(next), start: romeDate(next, DAY_START), end: romeDate(next, DAY_END) });
        }
        return {
            date: isoDay(day), start, end, timeZone: TOUR_TIME_ZONE,
            shiftedToNextDay: shifted,
            anchored: start.getTime() !== now.getTime(),
            reason, windows,
        };
    };

    // ─── Percorso Veloce: sempre da adesso ───────────────────────────────────
    if (pathType !== 'custom') {
        const minutes = QUICK_MINUTES[normalize(duration).trim()]
            ?? (durationKind(duration) === 'half' ? 240 : QUICK_DEFAULT_MINUTES);
        return build({ day: today, start: now, end: new Date(now.getTime() + minutes * 60000), reason: 'quick-now' });
    }

    // ─── Crea il tuo Percorso ───────────────────────────────────────────────
    const t = normalize(text);
    const namedDay = parseDay(t, today);
    const fasciaKey = parseFascia(t);
    const hour = parseHour(t);
    const kind = durationKind(duration);

    let day = namedDay || today;
    let start;
    let defaultEnd = null; // fine se l'utente non sceglie una durata
    let reason;
    let shifted = false;

    if (hour) {
        reason = 'hour';
        start = romeDate(day, hour);
        // "alle 17" detto alle 20:57, senza giorno: sono le 17 di domani.
        if (!namedDay && start.getTime() < now.getTime()) {
            day = addDays(today, 1);
            start = romeDate(day, hour);
            shifted = true;
        } else if (start.getTime() < now.getTime()) {
            start = now;
        }
    } else if (fasciaKey) {
        reason = 'fascia';
        const f = FASCE[fasciaKey];
        start = romeDate(day, f.start);
        if (start.getTime() < now.getTime()) start = now; // "stasera" alle 20:00 → da adesso
        defaultEnd = romeDate(day, f.end);
    } else if (namedDay && !sameDay(namedDay, today)) {
        reason = 'day';
        start = romeDate(day, DAY_START);
    } else {
        reason = namedDay ? 'today' : 'now';
        start = now;
    }

    // Meno di un'ora prima della chiusura della giornata: si va al giorno dopo.
    if (minutesBetween(start, romeDate(day, DAY_END)) < MIN_WINDOW_MINUTES) {
        day = addDays(day, 1);
        start = romeDate(day, DAY_START);
        defaultEnd = null; // la fascia era di ieri: domani e' giornata intera
        shifted = true;
    }

    const dayEnd = romeDate(day, DAY_END);
    let end;
    if (kind === 'half') end = minDate(new Date(start.getTime() + 240 * 60000), dayEnd);
    else if (kind === 'day' || kind === 'multi') end = dayEnd;
    else end = defaultEnd && defaultEnd.getTime() > start.getTime() ? defaultEnd : dayEnd;

    return build({ day, start, end, shifted, reason, extraDays: kind === 'multi' ? MULTI_DAY_COUNT - 1 : 0 });
}
