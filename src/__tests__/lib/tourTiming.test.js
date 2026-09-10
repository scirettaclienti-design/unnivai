import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import {
    STAY_RULES,
    DEFAULT_STAY_MINUTES,
    WALKING_KMH,
    resolveStayMinutes,
    travelMinutes,
    haversineKm,
    computeStopTimings,
    totalTourMinutes,
    formatEstimate,
    computeCumulativeOffsets,
    formatOffsetLabel,
    computeScheduledTimes,
    refreshTourScheduledTimes,
    formatClockTime,
} from '@/lib/tourTiming';

// Gate RAGGIO — DIFF 1a. Test del modulo puro + marker negativo sul sorgente.

describe('resolveStayMinutes — la tabella', () => {
    it('un museum dura 60', () => {
        expect(resolveStayMinutes(['museum', 'point_of_interest', 'establishment'])).toBe(60);
    });

    it('un cafe dura 20', () => {
        expect(resolveStayMinutes(['cafe', 'food', 'point_of_interest'])).toBe(20);
    });

    it('un restaurant dura 75', () => {
        expect(resolveStayMinutes(['restaurant', 'food', 'establishment'])).toBe(75);
    });

    it('un POI senza types noti cade sul default', () => {
        expect(resolveStayMinutes(['establishment', 'premise'])).toBe(DEFAULT_STAY_MINUTES);
    });

    it('types assenti, vuoti o non-array → default, senza lanciare', () => {
        expect(resolveStayMinutes(undefined)).toBe(DEFAULT_STAY_MINUTES);
        expect(resolveStayMinutes([])).toBe(DEFAULT_STAY_MINUTES);
        expect(resolveStayMinutes(null)).toBe(DEFAULT_STAY_MINUTES);
        expect(resolveStayMinutes('museum')).toBe(DEFAULT_STAY_MINUTES);
    });
});

describe('resolveStayMinutes — la PRECEDENZA dichiarata', () => {
    // Il caso che motiva l'intero ordinamento: una chiesa turistica.
    // `tourist_attraction` (30) NON deve vincere su `church` (20): il motivo per
    // cui ci entri e' che e' una chiesa.
    it('church + tourist_attraction → 20, non 30', () => {
        expect(resolveStayMinutes(['church', 'place_of_worship', 'tourist_attraction', 'point_of_interest'])).toBe(20);
    });

    it('museum + tourist_attraction → 60', () => {
        expect(resolveStayMinutes(['tourist_attraction', 'museum'])).toBe(60);
    });

    it('restaurant + cafe → 75: un posto dove ci si siede', () => {
        expect(resolveStayMinutes(['cafe', 'restaurant', 'food'])).toBe(75);
    });

    it('museum + restaurant → 60: il museo e\' il motivo, non il ristorante interno', () => {
        expect(resolveStayMinutes(['restaurant', 'museum'])).toBe(60);
    });

    it('vince la lista, NON l\'ordine dell\'array di Google', () => {
        // Stessi types, ordine invertito: stesso risultato.
        const a = ['tourist_attraction', 'point_of_interest', 'church'];
        const b = ['church', 'point_of_interest', 'tourist_attraction'];
        expect(resolveStayMinutes(a)).toBe(resolveStayMinutes(b));
        expect(resolveStayMinutes(a)).toBe(20);
    });

    it('i types generici stanno in fondo alla tabella', () => {
        const generici = STAY_RULES[STAY_RULES.length - 1].types;
        expect(generici).toContain('tourist_attraction');
        expect(generici).toContain('point_of_interest');
    });
});

describe('travelMinutes — lo spostamento', () => {
    it('due tappe a distanza nota danno il tempo atteso', () => {
        // ~1 km esatto in latitudine (1 grado lat = 111.19 km).
        const a = { latitude: 45.0, longitude: 9.0 };
        const b = { latitude: 45.0 + 1 / 111.19, longitude: 9.0 };
        const km = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
        expect(km).toBeCloseTo(1.0, 2);
        // 1 km a 4.5 km/h = 13.33 min → arrotondato 13.
        expect(travelMinutes(a, b)).toBe(13);
        expect(WALKING_KMH).toBe(4.5);
    });

    it('accetta sia latitude/longitude sia lat/lng', () => {
        const a = { lat: 45.0, lng: 9.0 };
        const b = { latitude: 45.0 + 1 / 111.19, longitude: 9.0 };
        expect(travelMinutes(a, b)).toBe(13);
    });

    it('coordinate mancanti → null, MAI zero', () => {
        const ok = { latitude: 45.0, longitude: 9.0 };
        // zero direbbe "stesso posto": e' un'affermazione. null dice "non lo so".
        expect(travelMinutes(ok, { latitude: null, longitude: 9.0 })).toBeNull();
        expect(travelMinutes({}, ok)).toBeNull();
        expect(travelMinutes(null, ok)).toBeNull();
        expect(travelMinutes(ok, undefined)).toBeNull();
    });

    it('Venezia S.Marco → Mestre e\' coerente con la distanza reale', () => {
        const sanMarco = { latitude: 45.4341, longitude: 12.3388 };
        const mestre = { latitude: 45.4906, longitude: 12.2381 };
        const km = haversineKm(sanMarco.latitude, sanMarco.longitude, mestre.latitude, mestre.longitude);
        expect(km).toBeGreaterThan(9.5);
        expect(km).toBeLessThan(10.5);
    });
});

describe('computeStopTimings — DEVE girare dopo l\'ordinamento', () => {
    const A = { title: 'A', types: ['museum'], latitude: 45.0, longitude: 9.0 };
    const B = { title: 'B', types: ['cafe'], latitude: 45.0 + 1 / 111.19, longitude: 9.0 };
    const C = { title: 'C', types: ['restaurant'], latitude: 45.0 + 2 / 111.19, longitude: 9.0 };

    it('la prima tappa non ha spostamento', () => {
        const { stops } = computeStopTimings([A, B, C]);
        expect(stops[0].travelMinutesFromPrev).toBeNull();
        expect(stops[1].travelMinutesFromPrev).toBe(13);
        expect(stops[2].travelMinutesFromPrev).toBe(13);
    });

    it('ogni tappa porta la sua sosta dai types', () => {
        const { stops } = computeStopTimings([A, B, C]);
        expect(stops.map(s => s.stayMinutes)).toEqual([60, 20, 75]);
    });

    // L'asserzione centrale: cambiare l'ordine cambia gli spostamenti in modo
    // coerente. E' cio' che rende obbligatorio chiamare questa funzione DOPO
    // l'ordinamento definitivo, ed e' il difetto che il campo `time` aveva.
    it('cambiare l\'ordine cambia gli spostamenti', () => {
        const diretto = computeStopTimings([A, B, C]);
        const saltato = computeStopTimings([A, C, B]);
        // A→C sono 2 km (2/4.5*60 = 26.67 → 27), C→B torna indietro 1 km (13).
        expect(saltato.stops[1].travelMinutesFromPrev).toBe(27);
        expect(saltato.stops[2].travelMinutesFromPrev).toBe(13);
        expect(saltato.totalMinutes).toBeGreaterThan(diretto.totalMinutes);
    });

    it('le soste seguono la tappa quando l\'ordine cambia, non la posizione', () => {
        const { stops } = computeStopTimings([C, A, B]);
        expect(stops.map(s => s.stayMinutes)).toEqual([75, 60, 20]);
    });

    it('lista vuota o non-array → zero, senza lanciare', () => {
        expect(computeStopTimings([])).toEqual({ stops: [], totalMinutes: 0 });
        expect(computeStopTimings(null)).toEqual({ stops: [], totalMinutes: 0 });
    });

    it('non muta gli stop in ingresso', () => {
        const input = [{ ...A }];
        computeStopTimings(input);
        expect(input[0].stayMinutes).toBeUndefined();
    });
});

describe('totalTourMinutes — soste + spostamenti, non un numero a se\'', () => {
    it('il totale e\' esattamente la somma di soste e spostamenti', () => {
        const A = { types: ['museum'], latitude: 45.0, longitude: 9.0 };
        const B = { types: ['cafe'], latitude: 45.0 + 1 / 111.19, longitude: 9.0 };
        const { stops, totalMinutes } = computeStopTimings([A, B]);
        const atteso = stops.reduce((acc, s) => acc + s.stayMinutes + (s.travelMinutesFromPrev ?? 0), 0);
        expect(totalMinutes).toBe(atteso);
        expect(totalMinutes).toBe(60 + 20 + 13);
        expect(totalTourMinutes(stops)).toBe(totalMinutes);
    });

    it('uno spostamento null conta zero, non rompe il totale', () => {
        const stops = [
            { stayMinutes: 30, travelMinutesFromPrev: null },
            { stayMinutes: 20, travelMinutesFromPrev: null },
        ];
        expect(totalTourMinutes(stops)).toBe(50);
    });

    it('una sosta assente cade sul default, non su NaN', () => {
        expect(totalTourMinutes([{ travelMinutesFromPrev: null }])).toBe(DEFAULT_STAY_MINUTES);
    });
});

describe('formatEstimate — la stima si dichiara tale', () => {
    it('sotto l\'ora usa il tilde', () => {
        expect(formatEstimate(30)).toBe('~30 min');
        expect(formatEstimate(59)).toBe('~59 min');
    });

    it('sopra l\'ora usa "circa"', () => {
        expect(formatEstimate(60)).toBe('circa 1h');
        expect(formatEstimate(95)).toBe('circa 1h 35min');
    });

    it('nessun output e\' un numero secco: c\'e\' sempre un margine dichiarato', () => {
        for (const m of [5, 20, 30, 45, 60, 75, 90, 155]) {
            const s = formatEstimate(m);
            expect(s === null || /^~|^circa /.test(s)).toBe(true);
        }
    });

    it('valori non validi → null, cosi\' la UI non mostra nulla', () => {
        expect(formatEstimate(0)).toBeNull();
        expect(formatEstimate(-5)).toBeNull();
        expect(formatEstimate(null)).toBeNull();
        expect(formatEstimate(undefined)).toBeNull();
        expect(formatEstimate(NaN)).toBeNull();
    });
});

// ─── MARKER NEGATIVO SUL SORGENTE ────────────────────────────────────────────
// Questo blocco e' ROSSO prima del fix (5 occorrenze di `s.suggestedMinutes`,
// 3 schemi JSON che lo chiedono al modello) ed e' la ragione per cui il test
// vive qui e non solo sul modulo puro: il modulo puro puo' essere perfetto
// mentre nessuno lo usa.

const REPO_ROOT = process.cwd();
const SRC = join(REPO_ROOT, 'src');
const SKIP_DIRS = new Set(['node_modules', '__tests__', 'test']);

function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            if (SKIP_DIRS.has(entry)) continue;
            out.push(...walk(full));
            continue;
        }
        if (/\.(js|jsx)$/.test(entry) && !/\.old\./.test(entry)) out.push(full);
    }
    return out;
}

const sourceLines = () => {
    const hits = [];
    for (const file of walk(SRC)) {
        const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
        readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
            const t = line.trim();
            if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
            hits.push({ rel, line: i + 1, text: line });
        });
    }
    return hits;
};

describe('marker negativo — la durata inventata non esiste piu\'', () => {
    it('nessun file legge piu\' `suggestedMinutes` da una tappa', () => {
        const bad = sourceLines().filter(h => /\.suggestedMinutes\b/.test(h.text));
        expect(bad.map(h => `${h.rel}:${h.line}`)).toEqual([]);
    });

    it('nessuno schema JSON chiede piu\' `suggestedMinutes` al modello', () => {
        const bad = sourceLines().filter(h => /"suggestedMinutes"/.test(h.text));
        expect(bad.map(h => `${h.rel}:${h.line}`)).toEqual([]);
    });

    it('nessuno schema JSON chiede piu\' `time` al modello', () => {
        const bad = sourceLines().filter(h => /"time":\s*"HH:MM"/.test(h.text));
        expect(bad.map(h => `${h.rel}:${h.line}`)).toEqual([]);
    });

    it('nessun fallback silenzioso `|| 30` sulla durata', () => {
        const bad = sourceLines().filter(h => /suggestedMinutes[^;]*\|\|\s*30/.test(h.text));
        expect(bad.map(h => `${h.rel}:${h.line}`)).toEqual([]);
    });
});


// ─── DIFF 1b — offset cumulativo dall'inizio del percorso ────────────────────

const stop = (stayMinutes, travelMinutesFromPrev) => ({ stayMinutes, travelMinutesFromPrev });

describe('computeCumulativeOffsets — la somma', () => {
    it('la prima tappa e\' l\'origine: offset 0, e il suo travel null NON assorbe', () => {
        const offsets = computeCumulativeOffsets([stop(30, null), stop(20, 15)]);
        expect(offsets[0]).toBe(0);
        expect(offsets[1]).toBe(45);
    });

    it('somma sosta precedente + spostamento, tappa dopo tappa', () => {
        // 0 → 0 ; 1 → 30+5=35 ; 2 → 35+20+25=80
        const offsets = computeCumulativeOffsets([stop(30, null), stop(20, 5), stop(60, 25)]);
        expect(offsets).toEqual([0, 35, 80]);
    });

    it('lista vuota o non-array → nessun offset', () => {
        expect(computeCumulativeOffsets([])).toEqual([]);
        expect(computeCumulativeOffsets(null)).toEqual([]);
    });
});

describe('computeCumulativeOffsets — NULL ASSORBENTE (test decisivo)', () => {
    it('travel null a meta\' percorso annulla quella tappa E TUTTE le successive', () => {
        // Se qui si sommasse 0 invece di assorbire, uscirebbe [0, 35, 35, 65]:
        // una timeline che afferma "dalla 2 alla 3 non ci si sposta". Falso.
        const offsets = computeCumulativeOffsets([
            stop(30, null),
            stop(20, 5),
            stop(30, null),
            stop(30, 10),
        ]);
        expect(offsets).toEqual([0, 35, null, null]);
    });

    it('sosta mancante assorbe come lo spostamento: un addendo che manca e\' un buco', () => {
        const offsets = computeCumulativeOffsets([stop(30, null), stop(null, 10), stop(20, 10)]);
        expect(offsets).toEqual([0, 40, null]);
    });

    it('mai zero al posto di null: nessun offset dopo il buco e\' un numero', () => {
        const offsets = computeCumulativeOffsets([stop(30, null), stop(20, null), stop(20, 10)]);
        expect(offsets.slice(1).every(o => o === null)).toBe(true);
    });
});

describe('formatOffsetLabel — nessun numero secco alla UI', () => {
    it('la prima tappa legge "Inizio", mai "+0 min"', () => {
        expect(formatOffsetLabel(0)).toBe('Inizio');
    });

    it('sotto l\'ora: "+35 min"', () => {
        expect(formatOffsetLabel(35)).toBe('+35 min');
    });

    it('sopra l\'ora: "+1h 20"', () => {
        expect(formatOffsetLabel(80)).toBe('+1h 20');
    });

    it('ora tonda: "+2h"', () => {
        expect(formatOffsetLabel(120)).toBe('+2h');
    });

    it('null resta null: la UI non monta niente', () => {
        expect(formatOffsetLabel(null)).toBeNull();
        expect(formatOffsetLabel(undefined)).toBeNull();
        expect(formatOffsetLabel(NaN)).toBeNull();
    });
});

// ─── G1 — orario assoluto = ora di partenza + offset cumulativo ──────────────
//
// NOTA SUL FUSO: gli startTime si costruiscono col costruttore LOCALE
// `new Date(2026, 8, 10, 15, 0, 0)`, mai da una stringa ISO con la Z — che
// verrebbe letta come UTC e darebbe "15:00" solo sulle macchine a UTC+0.
// La suite gira senza TZ fissato: il test deve essere vero ovunque.

describe('computeScheduledTimes — l\'ora di partenza incontra l\'offset', () => {
    const START = () => new Date(2026, 8, 10, 15, 0, 0); // 10/09/2026, 15:00 locali

    // A museum (60), B cafe (20), C restaurant (75), allineati in latitudine
    // a 1 km l'uno dall'altro → 13 min di cammino per tratta.
    const A = { title: 'A', types: ['museum'], latitude: 45.0, longitude: 9.0 };
    const B = { title: 'B', types: ['cafe'], latitude: 45.0 + 1 / 111.19, longitude: 9.0 };
    const C = { title: 'C', types: ['restaurant'], latitude: 45.0 + 2 / 111.19, longitude: 9.0 };

    const timed = () => computeStopTimings([A, B, C]).stops;

    it('la prima tappa e\' l\'ora di partenza esatta: offset 0, nessuno scarto', () => {
        const start = START();
        const out = computeScheduledTimes(timed(), start);
        expect(out[0].scheduledTime).toBe(start.toISOString());
        expect(formatClockTime(out[0].scheduledTime)).toBe('15:00');
    });

    it('ogni tappa e\' partenza + il suo offset cumulativo, al minuto', () => {
        const start = START();
        const stops = timed();
        const offsets = computeCumulativeOffsets(stops);
        // 0 ; 0+60+13 = 73 ; 73+20+13 = 106
        expect(offsets).toEqual([0, 73, 106]);
        const out = computeScheduledTimes(stops, start);
        out.forEach((s, i) => {
            expect(s.scheduledTime).toBe(new Date(start.getTime() + offsets[i] * 60000).toISOString());
        });
        // 15:00 + 1h13 = 16:13 ; 15:00 + 1h46 = 16:46
        expect(out.map(s => formatClockTime(s.scheduledTime))).toEqual(['15:00', '16:13', '16:46']);
    });

    it('conserva i campi della tappa e non muta l\'input', () => {
        const stops = timed();
        const out = computeScheduledTimes(stops, START());
        expect(out[1].title).toBe('B');
        expect(out[1].stayMinutes).toBe(20);
        expect(out[1].travelMinutesFromPrev).toBe(13);
        expect(stops[1].scheduledTime).toBeUndefined();
    });

    it('lista vuota o non-array → nessun orario, senza lanciare', () => {
        expect(computeScheduledTimes([], START())).toEqual([]);
        expect(computeScheduledTimes(null, START())).toEqual([]);
    });
});

describe('computeScheduledTimes — NULL ASSORBENTE ereditato dall\'offset', () => {
    const START = () => new Date(2026, 8, 10, 15, 0, 0);

    const A = { title: 'A', types: ['museum'], latitude: 45.0, longitude: 9.0 };
    const B = { title: 'B', types: ['cafe'], latitude: 45.0 + 1 / 111.19, longitude: 9.0 };
    // Tappa senza coordinate: travelMinutesFromPrev null da qui in poi.
    const SENZA_COORD = { title: 'X', types: ['park'] };
    const D = { title: 'D', types: ['restaurant'], latitude: 45.0 + 3 / 111.19, longitude: 9.0 };

    it('una tappa senza coordinate annulla il SUO orario E quelli successivi', () => {
        const stops = computeStopTimings([A, B, SENZA_COORD, D]).stops;
        // Verificato esplicitamente sull'offset, non dato per scontato.
        expect(computeCumulativeOffsets(stops)).toEqual([0, 73, null, null]);
        const out = computeScheduledTimes(stops, START());
        expect(out.map(s => s.scheduledTime)).toEqual([
            START().toISOString(),
            new Date(START().getTime() + 73 * 60000).toISOString(),
            null,
            null,
        ]);
    });

    it('dopo il buco nessun orario e\' una stringa: mai un\'ora inventata', () => {
        const stops = computeStopTimings([A, B, SENZA_COORD, D]).stops;
        const out = computeScheduledTimes(stops, START());
        expect(out.slice(2).every(s => s.scheduledTime === null)).toBe(true);
        expect(out.slice(2).every(s => formatClockTime(s.scheduledTime) === null)).toBe(true);
    });
});

describe('computeScheduledTimes — startTime non valido non produce orari', () => {
    const stops = () => computeStopTimings([
        { types: ['museum'], latitude: 45.0, longitude: 9.0 },
        { types: ['cafe'], latitude: 45.0 + 1 / 111.19, longitude: 9.0 },
    ]).stops;

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['una stringa ISO non parsata', '2026-09-10T15:00:00'],
        ['un numero (timestamp grezzo)', 1789045200000],
        ['un Date invalido', new Date('non-una-data')],
    ])('%s → ogni scheduledTime e\' null, senza lanciare', (_label, start) => {
        const out = computeScheduledTimes(stops(), start);
        expect(out).toHaveLength(2);
        expect(out.every(s => s.scheduledTime === null)).toBe(true);
    });
});

describe('formatClockTime — nessun orario grezzo alla UI', () => {
    it('una stringa ISO valida diventa HH:MM', () => {
        const d = new Date(2026, 8, 10, 9, 5, 0);
        expect(formatClockTime(d.toISOString())).toBe('09:05');
    });

    it('accetta anche un Date gia\' parsato', () => {
        expect(formatClockTime(new Date(2026, 8, 10, 18, 30, 0))).toBe('18:30');
    });

    it('ore e minuti sono sempre a due cifre', () => {
        expect(formatClockTime(new Date(2026, 8, 10, 0, 0, 0))).toBe('00:00');
        expect(formatClockTime(new Date(2026, 8, 10, 23, 59, 0))).toBe('23:59');
    });

    it('assente o non parsabile → null, la UI non monta niente', () => {
        expect(formatClockTime(null)).toBeNull();
        expect(formatClockTime(undefined)).toBeNull();
        expect(formatClockTime('')).toBeNull();
        expect(formatClockTime('domani pomeriggio')).toBeNull();
        expect(formatClockTime(new Date('non-una-data'))).toBeNull();
    });
});

// ─── G1.1 — l'orario si ricalcola da ADESSO a ogni riletura ──────────────────
//
// Stessa nota sul fuso del blocco G1: gli startTime si costruiscono col
// costruttore LOCALE, mai da stringa ISO con la Z.

describe('refreshTourScheduledTimes — stesso tour, ora diversa, orari diversi', () => {
    // Stesse tre tappe del blocco G1: A museum (60), B cafe (20), C restaurant
    // (75), a 1 km l'una dall'altra → 13 min per tratta, offset [0, 73, 106].
    const A = { title: 'A', types: ['museum'], latitude: 45.0, longitude: 9.0 };
    const B = { title: 'B', types: ['cafe'], latitude: 45.0 + 1 / 111.19, longitude: 9.0 };
    const C = { title: 'C', types: ['restaurant'], latitude: 45.0 + 2 / 111.19, longitude: 9.0 };

    const tour = () => [{ day: 1, title: 'Giorno 1', stops: computeStopTimings([A, B, C]).stops }];

    const ALLE_15 = () => new Date(2026, 8, 10, 15, 0, 0);
    const ALLE_19 = () => new Date(2026, 8, 10, 19, 0, 0);

    // Il test decisivo: e' lo STESSO tour (stessi offset), servito a due ore
    // diverse. Se l'orario fosse un dato salvato invece che derivato, le due
    // liste sarebbero identiche — ed e' esattamente il difetto F57.
    it('lo stesso tour servito a due ore diverse produce due timeline diverse', () => {
        const alle15 = refreshTourScheduledTimes(tour(), ALLE_15());
        const alle19 = refreshTourScheduledTimes(tour(), ALLE_19());

        expect(alle15[0].stops.map(s => formatClockTime(s.scheduledTime)))
            .toEqual(['15:00', '16:13', '16:46']);
        expect(alle19[0].stops.map(s => formatClockTime(s.scheduledTime)))
            .toEqual(['19:00', '20:13', '20:46']);
    });

    it('ogni orario e\' il suo startTime + l\'offset cumulativo, invariato fra le due letture', () => {
        const stops = computeStopTimings([A, B, C]).stops;
        const offsets = computeCumulativeOffsets(stops);
        expect(offsets).toEqual([0, 73, 106]);

        for (const start of [ALLE_15(), ALLE_19()]) {
            const out = refreshTourScheduledTimes([{ stops }], start);
            out[0].stops.forEach((s, i) => {
                expect(s.scheduledTime).toBe(new Date(start.getTime() + offsets[i] * 60000).toISOString());
            });
            // L'offset e' il dato stabile: non cambia con l'ora di lettura.
            expect(computeCumulativeOffsets(out[0].stops)).toEqual(offsets);
        }
    });

    it('conserva gli altri campi del giorno e delle tappe', () => {
        const out = refreshTourScheduledTimes(tour(), ALLE_15());
        expect(out[0].day).toBe(1);
        expect(out[0].title).toBe('Giorno 1');
        expect(out[0].stops[1].title).toBe('B');
        expect(out[0].stops[1].stayMinutes).toBe(20);
        expect(out[0].stops[1].travelMinutesFromPrev).toBe(13);
    });

    it('ogni giorno riceve la STESSA startTime: non c\'e\' "il giorno 2 parte quando finisce il giorno 1"', () => {
        const due = [
            { day: 1, stops: computeStopTimings([A, B, C]).stops },
            { day: 2, stops: computeStopTimings([A, B]).stops },
        ];
        const out = refreshTourScheduledTimes(due, ALLE_15());
        expect(out).toHaveLength(2);
        expect(out[0].stops[0].scheduledTime).toBe(ALLE_15().toISOString());
        expect(out[1].stops[0].scheduledTime).toBe(ALLE_15().toISOString());
        expect(formatClockTime(out[1].stops[1].scheduledTime)).toBe('16:13');
    });

    it('non muta i giorni in ingresso', () => {
        const input = tour();
        refreshTourScheduledTimes(input, ALLE_15());
        expect(input[0].stops[0].scheduledTime).toBeUndefined();
    });

    it('days non-array o assente → [], senza lanciare', () => {
        expect(refreshTourScheduledTimes(undefined, ALLE_15())).toEqual([]);
        expect(refreshTourScheduledTimes(null, ALLE_15())).toEqual([]);
        expect(refreshTourScheduledTimes({ days: [] }, ALLE_15())).toEqual([]);
        expect(refreshTourScheduledTimes([], ALLE_15())).toEqual([]);
    });

    it('un giorno con stops assente o non-array esce con stops: []', () => {
        const out = refreshTourScheduledTimes([{ day: 1 }, { day: 2, stops: null }, null], ALLE_15());
        expect(out.map(d => d.stops)).toEqual([[], [], []]);
        expect(out[0].day).toBe(1);
    });
});

describe('refreshTourScheduledTimes — NULL ASSORBENTE ereditato', () => {
    const A = { title: 'A', types: ['museum'], latitude: 45.0, longitude: 9.0 };
    const B = { title: 'B', types: ['cafe'], latitude: 45.0 + 1 / 111.19, longitude: 9.0 };
    const SENZA_COORD = { title: 'X', types: ['park'] };
    const D = { title: 'D', types: ['restaurant'], latitude: 45.0 + 3 / 111.19, longitude: 9.0 };

    it('una tappa senza coordinate annulla il suo orario E i successivi, a qualunque ora si legga', () => {
        const stops = computeStopTimings([A, B, SENZA_COORD, D]).stops;
        // Verificato esplicitamente sull'offset, non dato per scontato.
        expect(computeCumulativeOffsets(stops)).toEqual([0, 73, null, null]);

        for (const start of [new Date(2026, 8, 10, 15, 0, 0), new Date(2026, 8, 10, 19, 0, 0)]) {
            const out = refreshTourScheduledTimes([{ stops }], start);
            expect(out[0].stops.map(s => s.scheduledTime)).toEqual([
                start.toISOString(),
                new Date(start.getTime() + 73 * 60000).toISOString(),
                null,
                null,
            ]);
        }
    });
});

describe('marker negativo — la timeline non mostra piu\' un orario', () => {
    const aiItinerary = () => readFileSync(join(process.cwd(), 'src/pages/AiItinerary.jsx'), 'utf8');

    it('la colonna sinistra non legge piu\' `stop.time`', () => {
        expect(/stop\.time\b/.test(aiItinerary())).toBe(false);
    });

    it('l\'etichetta dell\'offset passa da formatOffsetLabel, non da una stringa a mano', () => {
        expect(/formatOffsetLabel\(/.test(aiItinerary())).toBe(true);
    });

    it('nessun orario costruito: niente toLocaleTimeString, getHours, `--:--`', () => {
        const src = aiItinerary();
        expect(/toLocaleTimeString|getHours\(/.test(src)).toBe(false);
        expect(/'--:--'|"--:--"/.test(src)).toBe(false);
    });
});
