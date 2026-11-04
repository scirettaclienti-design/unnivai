// BANCO-DIFETTI (T19, D4 + D5) — il tempo libero dice il tempo vero.
import { describe, it, expect } from 'vitest';
import { rifinisciTempoLibero, TEMPO_LIBERO_MIN_MINUTI } from '../../lib/continuity';
import { computeScheduledTimes } from '../../lib/tourTiming';

const tappa = (title, stay, extra = {}) => ({ title, place_id: title, stayMinutes: stay, travelMinutesFromPrev: 5, latitude: 37.5, longitude: 15.08, ...extra });
const libero = (stay, extra = {}) => ({ tempoLibero: true, title: 'Tempo libero', place_id: null, stayMinutes: stay, travelMinutesFromPrev: 0, description: 'Niente in agenda: cammina dove ti porta la strada.', ...extra });
const NESSUN_LOCALE = 'Nessun locale aperto qui vicino a quest’ora.';
const pasto = (x) => x.description === NESSUN_LOCALE;

describe('D4 — niente «Tempo libero» sotto i 15 minuti', () => {
    it('la soglia e\' 15', () => expect(TEMPO_LIBERO_MIN_MINUTI).toBe(15));
    it('una riga da 10 minuti in mezzo non esce, i suoi minuti restano attesa: gli orari della tappa dopo non cambiano', () => {
        const prima = [tappa('A', 60), libero(10), tappa('B', 30, { travelMinutesFromPrev: 0 })];
        const dopo = rifinisciTempoLibero(prima);
        expect(dopo.map(x => x.title)).toEqual(['A', 'B']);
        const start = new Date('2026-11-05T14:30:00+01:00');
        expect(computeScheduledTimes(dopo, start).at(-1).scheduledTime).toBe(computeScheduledTimes(prima, start).at(-1).scheduledTime);
    });
    it('una riga da 0 minuti in coda senza finestra non esce (n-roma-1300-specifica: «Tempo libero» 15:35, 0 min)', () => {
        expect(rifinisciTempoLibero([tappa('Colosseo', 30), tappa('Fori', 30), libero(0)]).map(x => x.title)).toEqual(['Colosseo', 'Fori']);
    });
    it('la riga di un pasto senza locali aperti resta anche a 0 minuti', () => {
        const r = rifinisciTempoLibero([tappa('A', 60), libero(0, { description: NESSUN_LOCALE })], { pastoMancante: pasto });
        expect(r.map(x => x.description ?? x.title).at(-1)).toBe(NESSUN_LOCALE);
    });
});

describe('D5 (a) — la serata con la sola cena: il resto della finestra e\' dichiarato con la sua fascia', () => {
    it('n-catania-2000: cena 20:00–21:15, poi «Tempo libero» fino alla fine della finestra (23:00)', () => {
        const start = new Date('2026-11-05T20:00:00+01:00');
        const fine = new Date('2026-11-05T23:00:00+01:00');
        const r = rifinisciTempoLibero([tappa('Ciauru i mari', 75, { travelMinutesFromPrev: null }), libero(0)], { start, fine });
        expect(r).toHaveLength(2);
        expect(r[1].stayMinutes).toBe(105);
        const t = computeScheduledTimes(r, start);
        expect(t[1].scheduledTime).toBe(new Date('2026-11-05T21:15:00+01:00').toISOString());
    });
    it('se la finestra e\' gia\' finita la riga in coda non esce', () => {
        const start = new Date('2026-11-05T20:00:00+01:00');
        const r = rifinisciTempoLibero([tappa('Cena', 75, { travelMinutesFromPrev: null }), libero(0)], { start, fine: new Date('2026-11-05T21:20:00+01:00') });
        expect(r.map(x => x.title)).toEqual(['Cena']);
    });
});
