// CONTINUITA' — le parti pure: i buchi di un piano, la fascia del tempo libero,
// gli orari dopo un tempo libero in testa al giorno.
import { describe, it, expect } from 'vitest';
import { GAP_MAX_MINUTES, scheduleGaps, retimeWaits, bandFreeTime, remainingGaps } from '../../lib/continuity';
import { computeStopTimings, computeScheduledTimes, computeCumulativeOffsets } from '../../lib/tourTiming';
import { freeTimeStop } from '../../lib/freeTime';
import { MOMENTS } from '../../lib/dayMoments';
import { romeDate } from '../../lib/tourWindow';

const GIORNO = { y: 2026, m: 10, d: 14 };
const alle = (h, m = 0) => romeDate(GIORNO, { h, m });
const M = Object.fromEntries(MOMENTS.map(m => [m.key, { id: `g1-${m.key}`, key: m.key, start: alle(m.start.h, m.start.m), end: alle(m.end.h, m.end.m) }]));

// due posti a pochi metri (cammino ~0), soste da tipo: museo 60, chiesa 20, bar 20, ristorante 75
const cand = (id, types, lat = 41.9) => ({ place_id: id, name: id, types, latitude: lat, longitude: 12.5 });
const MUSEO = cand('museo', ['museum']);
const CHIESA = cand('chiesa', ['church', 'place_of_worship']);
const BAR = cand('bar', ['bar']);
const TRATT = cand('tratt', ['restaurant', 'food']);
const voce = (c, momento, start, wait = 0) => ({ candidate: c, moment: M[momento], start, waitMinutesBefore: wait });

describe('scheduleGaps — l\'attesa oltre 45 minuti fra due tappe', () => {
    it('chiesa alle 9:30 (20 minuti) e pranzo alle 12:30: 160 minuti di buco', () => {
        const sched = { days: [[voce(CHIESA, 'mattina', alle(9, 30)), voce(TRATT, 'pranzo', alle(12, 30), 160)]] };
        const g = scheduleGaps(sched);
        expect(g).toHaveLength(1);
        expect(g[0]).toMatchObject({ dayIndex: 0, index: 1, minutes: 160 });
        expect(g[0].from.getTime()).toBe(alle(9, 50).getTime());
        expect(g[0].to.getTime()).toBe(alle(12, 30).getTime());
    });
    it('fino a 45 minuti non e\' un buco: e\' il tempo di arrivare', () => {
        const sched = { days: [[voce(MUSEO, 'mattina', alle(11, 0)), voce(TRATT, 'pranzo', alle(12, 30), 29)]] };
        expect(scheduleGaps(sched)).toEqual([]);
        const sched2 = { days: [[voce(MUSEO, 'mattina', alle(10, 45)), voce(TRATT, 'pranzo', alle(12, 30), 45)]] };
        expect(scheduleGaps(sched2)).toEqual([]);
        expect(GAP_MAX_MINUTES).toBe(45);
    });
    it('l\'attesa prima della PRIMA tappa non e\' un buco: il giro comincia li\'', () => {
        const sched = { days: [[voce(TRATT, 'pranzo', alle(12, 30), 255)]] };
        expect(scheduleGaps(sched)).toEqual([]);
    });
    it('si ricalcola dagli orari: una tappa tolta dopo lascia il buco vero, non l\'attesa vecchia', () => {
        // museo 9:30–10:30, [bar 11:00 tolto], pranzo 12:30: l'attesa memorizzata (60) e' quella dal bar
        const sched = { days: [[voce(MUSEO, 'mattina', alle(9, 30)), voce(TRATT, 'pranzo', alle(12, 30), 60)]] };
        expect(scheduleGaps(sched)[0].minutes).toBe(120);
        expect(retimeWaits(sched).days[0][1].waitMinutesBefore).toBe(120);
    });
});

describe('bandFreeTime — il tempo libero occupa il suo tempo', () => {
    const tl = (momento) => freeTimeStop({ moment: momento, description: 'x' });
    const reale = (c, momento, wait, travel = 0) => ({ ...c, title: c.name, moment: momento, stayMinutes: 20, travelMinutesFromPrev: travel, waitMinutesBefore: wait });

    it('la riga prende l\'attesa della tappa che segue; la tappa non aspetta piu\'', () => {
        const out = bandFreeTime([reale(CHIESA, 'mattina', 0), tl('mattina'), reale(TRATT, 'pranzo', 160, 4)]);
        expect(out[1]).toMatchObject({ tempoLibero: true, stayMinutes: 160, waitMinutesBefore: 0, travelMinutesFromPrev: 0 });
        expect(out[2].waitMinutesBefore).toBe(0);
        expect(out[2].travelMinutesFromPrev).toBe(4);
    });
    it('gli orari di dopo non cambiano: tempo libero + cammino = vecchia attesa + cammino', () => {
        const prima = [reale(CHIESA, 'mattina', 0), reale(TRATT, 'pranzo', 160, 4)];
        const dopo = bandFreeTime([prima[0], tl('mattina'), prima[1]]);
        const t0 = alle(9, 30);
        const orari = (list) => computeScheduledTimes(list, t0).filter(s => !s.tempoLibero).map(s => s.scheduledTime);
        expect(orari(dopo)).toEqual(orari(prima));
    });
    it('piu\' righe di fila prima della stessa tappa: ognuna la sua fascia, la somma e\' l\'attesa', () => {
        // pranzo finito alle 14:00; pomeriggio e aperitivo vuoti; cena alle 20:00 con 5 minuti di cammino
        const out = bandFreeTime([reale(TRATT, 'pranzo', 0), tl('pomeriggio'), tl('aperitivo'), reale(BAR, 'cena', 360, 5)]);
        const righe = out.filter(s => s.tempoLibero);
        expect(righe).toHaveLength(2);
        // la cena parte alle 20:00 e il cammino e' 5 minuti: il buco finisce alle 19:55; il pomeriggio finisce alle 18:00
        expect(righe.map(r => r.stayMinutes)).toEqual([245, 115]);
        expect(righe.reduce((a, r) => a + r.stayMinutes, 0)).toBe(360);
    });
    it('una riga in coda non ha fascia: non si inventa una fine', () => {
        const out = bandFreeTime([reale(CHIESA, 'mattina', 0), tl(null)]);
        expect(out[1].stayMinutes).toBe(0);
    });
    it('una riga in testa al giorno prende l\'attesa della prima tappa vera', () => {
        const out = bandFreeTime([tl('mattina'), reale(TRATT, 'pranzo', 180)]);
        expect(out[0].stayMinutes).toBe(180);
        expect(out[1].waitMinutesBefore).toBe(0);
    });
});

describe('orari dopo un tempo libero in testa al giorno (crea-firenze-arte)', () => {
    const base = () => computeStopTimings([
        { ...TRATT, title: 'Trattoria', moment: 'pranzo', waitMinutesBefore: 180 },
        { ...BAR, title: 'Bar', moment: 'pomeriggio', waitMinutesBefore: 0 },
    ]).stops;
    it('PRIMA: la prima tappa vera dopo il tempo libero rompeva la catena e le tappe restavano senza orario', () => {
        const stops = [{ ...freeTimeStop({ moment: 'mattina', description: 'x' }) }, ...base()];
        const orari = computeScheduledTimes(stops, alle(9, 30)).map(s => s.scheduledTime);
        expect(orari.every(Boolean)).toBe(true);
    });
    it('con la fascia del tempo libero la tappa dopo parte all\'inizio del suo momento (12:30)', () => {
        const stops = bandFreeTime([freeTimeStop({ moment: 'mattina', description: 'x' }), ...base()]);
        const orari = computeScheduledTimes(stops, alle(9, 30));
        expect(orari[0]).toMatchObject({ tempoLibero: true, stayMinutes: 180 });
        expect(new Date(orari[1].scheduledTime).getTime()).toBe(alle(12, 30).getTime());
        expect(computeCumulativeOffsets(stops).every(Number.isFinite)).toBe(true);
    });
    it('il tempo libero in mezzo al giorno non cambia: la tappa dopo tiene il suo cammino', () => {
        const stops = [
            { ...CHIESA, title: 'Chiesa', moment: 'mattina', stayMinutes: 20, travelMinutesFromPrev: null, waitMinutesBefore: 0 },
            freeTimeStop({ moment: 'mattina', description: 'x' }),
            { ...TRATT, title: 'Trattoria', moment: 'pranzo', stayMinutes: 75, travelMinutesFromPrev: 6, waitMinutesBefore: 100 },
        ];
        const orari = computeScheduledTimes(bandFreeTime(stops), alle(9, 30));
        expect(new Date(orari[2].scheduledTime).getTime() - new Date(orari[0].scheduledTime).getTime()).toBe((20 + 100 + 6) * 60000);
    });
});

describe('remainingGaps — il controllo sul giro finito', () => {
    const riga = (title, h, m, stay, travel = 0, tempoLibero = false) => ({ title, scheduledTime: alle(h, m).toISOString(), stayMinutes: stay, travelMinutesFromPrev: travel, tempoLibero });
    it('un pomeriggio con 2 ore e mezza vuote e\' un buco', () => {
        const g = remainingGaps([riga('Elefanti', 14, 30, 30), riga('Chiesa', 15, 3, 20), riga('Bar', 18, 0, 20)]);
        expect(g).toEqual([{ dopo: 'Chiesa', prima: 'Bar', minuti: 157 }]);
    });
    it('lo stesso pomeriggio con la riga di tempo libero e la sua fascia non ha buchi', () => {
        const g = remainingGaps([riga('Elefanti', 14, 30, 30), riga('Chiesa', 15, 3, 20), riga('Tempo libero', 15, 23, 157, 0, true), riga('Bar', 18, 0, 20)]);
        expect(g).toEqual([]);
    });
});
