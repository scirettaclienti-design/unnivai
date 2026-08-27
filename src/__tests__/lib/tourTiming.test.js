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
