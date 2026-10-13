// ORARI — Per Te, Veloce e Sorprendimi: la stessa regola sulla lista di candidati.
import { describe, it, expect } from 'vitest';
import { keepOpenStops } from '../../lib/openStops';
import { computeStopTimings } from '../../lib/tourTiming';

const T = (hhmm) => new Date(`2026-10-14T${hhmm}:00+02:00`);
const P = (day, open, close, closeDay = day) => ({ open: { day, time: open }, close: { day: closeDay, time: close } });
const tutti = (open, close) => [0, 1, 2, 3, 4, 5, 6].map(d => P(d, open, close));
let n = 0;
const luogo = (name, types, periods, dx = 0) => ({
    place_id: `s${++n}-${name}`, name, title: name, types, latitude: 41.9, longitude: 12.48 + dx, ...(periods ? { openingPeriods: periods } : {}),
});
const museo = (name, periods, dx) => luogo(name, ['museum'], periods, dx);
const timed = (list) => computeStopTimings(list).stops;
const run = (pool, picks, start, extra = {}) => keepOpenStops({
    stops: timed(picks), pool, start,
    retime: timed,
    toStop: (c) => ({ ...c }),
    ...extra,
});
const ids = (r) => r.stops.map(s => s.name);

describe('keepOpenStops', () => {
    it('una tappa chiusa quando ci si arriva e\' sostituita dal candidato piu\' vicino che sia aperto', () => {
        const a = museo('Aperto 1', tutti('0900', '1900'));
        const chiuso = museo('Chiuso', tutti('1800', '2300'), 0.001);
        const b = museo('Aperto 2', tutti('0900', '1900'), 0.002);
        const lontano = museo('Aperto Lontano', tutti('0900', '1900'), 0.05);
        const vicino = museo('Aperto Vicino', tutti('0900', '1900'), 0.0015);
        const r = run([a, chiuso, b, lontano, vicino], [a, chiuso, b], T('10:00'));
        expect(ids(r)).not.toContain('Chiuso');
        expect(ids(r)).toContain('Aperto Vicino');          // il piu' vicino, non quello lontano
        expect(ids(r)).not.toContain('Aperto Lontano');
        expect(r.stops).toHaveLength(3);
        expect(r.chiuse.map(x => x.nome)).toEqual(['Chiuso']);
        expect(r.aggiunte.map(x => x.nome)).toEqual(['Aperto Vicino']);
    });
    it('senza alternative il giro resta piu\' corto: mai una tappa chiusa', () => {
        const a = museo('Aperto', tutti('0900', '1900'));
        const c1 = museo('Chiuso 1', tutti('1800', '2300'), 0.001);
        const c2 = museo('Chiuso 2', tutti('1800', '2300'), 0.002);
        const r = run([a, c1, c2], [a, c1, c2], T('10:00'));
        expect(ids(r)).toEqual(['Aperto']);
        expect(r.chiuse).toHaveLength(2);
    });
    it('una sosta che sfora la chiusura viene sostituita', () => {
        const a = museo('Chiude alle 10:30', tutti('0900', '1030'));
        const b = museo('Aperto Tutto il Giorno', tutti('0900', '1900'), 0.001);
        const r = run([a, b], [a], T('10:00'));          // museo = 60 min: 10:00 → 11:00 > 10:30
        expect(ids(r)).toEqual(['Aperto Tutto il Giorno']);
    });
    it('un museo chiuso il mercoledi\' non entra il mercoledi\'', () => {
        const senzaMer = [0, 1, 2, 4, 5, 6].map(d => P(d, '1000', '1900'));
        const chiuso = museo('Chiuso il Mercoledi', senzaMer);
        const altro = museo('Altro', tutti('0900', '1900'), 0.001);
        expect(ids(run([chiuso, altro], [chiuso], T('11:00')))).toEqual(['Altro']);
    });
    it('dopo le 21 un orario sconosciuto perde contro un aperto noto; di giorno no', () => {
        const picks = [museo('Notte A', tutti('0000', '2359')), museo('Notte B', tutti('0000', '2359'), 0.0005)];
        // il primo e' chiuso a 21:30 (chiude alle 21:00)
        const chiuso = museo('Chiude alle 21', tutti('0900', '2100'), 0.001);
        const ignoto = museo('Senza Orari', null, 0.0007);
        const noto = museo('Aperto Noto', tutti('0900', '2359'), 0.0012);
        const sera = run([chiuso, ignoto, noto], [chiuso], T('21:30'), {});
        expect(ids(sera)[0]).toBe('Aperto Noto');
        expect(picks.length).toBe(2);
        const giorno = run([chiuso, ignoto, noto], [chiuso], T('10:30'), {});
        expect(ids(giorno)).toEqual(['Chiude alle 21']);   // di giorno e' aperto: nessun cambio
    });
    it('senza orari (ricerca vecchia): niente tolto, niente errore, tappe segnate "sconosciuto"', () => {
        const picks = [museo('Uno', null), museo('Due', null, 0.001), museo('Tre', null, 0.002)];
        const r = run(picks, picks, T('23:50'));
        expect(ids(r)).toEqual(['Uno', 'Due', 'Tre']);
        expect(r.chiuse).toEqual([]);
        expect(r.ignote).toBe(3);
        expect(r.stops.every(s => s._orario === 'sconosciuto')).toBe(true);
    });
    it('esclude i candidati gia\' in altri tour', () => {
        const a = museo('A', tutti('0900', '1900'));
        const chiuso = museo('Chiuso', tutti('1800', '2300'), 0.001);
        const preso = museo('Gia in un altro tour', tutti('0900', '1900'), 0.0012);
        const libero = museo('Libero', tutti('0900', '1900'), 0.003);
        const r = run([a, chiuso, preso, libero], [a, chiuso], T('10:00'), { exclude: new Set([preso.place_id]) });
        expect(ids(r)).toEqual(expect.arrayContaining(['A', 'Libero']));
        expect(ids(r)).not.toContain('Gia in un altro tour');
    });
});
