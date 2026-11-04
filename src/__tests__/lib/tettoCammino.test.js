// BANCO-DIFETTI (T19, D1) — il tetto di cammino di 1,2 km fra due tappe consecutive (decisione di Ivano, 05/11/2026).
import { describe, it, expect } from 'vitest';
import { TETTO_PIEDI_KM, TETTO_PIEDI_MINUTI, kmTratto, gruppoNelTetto, trattiLunghi, tagliaTrattiLunghi, migliorePartenza } from '../../lib/tettoCammino';
import { keepOpenStops } from '../../lib/openStops';
import { computeStopTimings } from '../../lib/tourTiming';
import { MAX_WALK_MINUTES, VARIETY_MAX_WALK_MINUTES } from '../../services/momentSelection';

// 0,009° di latitudine ≈ 1 km
const LAT = 41.9, LNG = 12.48;
const a = (id, km, extra = {}) => ({ place_id: id, name: id, title: id, latitude: LAT + km * 0.009, longitude: LNG, types: ['tourist_attraction'], ...extra });
const ids = (l) => l.map(x => x.place_id);
const vicinoPiuVicino = (stops) => {
    if (stops.length <= 2) return stops;
    const out = [stops[0]]; const rest = stops.slice(1);
    while (rest.length) {
        const l = out.at(-1);
        let k = 0;
        rest.forEach((x, i) => { if (Math.abs(x.latitude - l.latitude) < Math.abs(rest[k].latitude - l.latitude)) k = i; });
        out.push(rest.splice(k, 1)[0]);
    }
    return out;
};

describe('D1 — il tetto', () => {
    it('1,2 km = 16 minuti a piedi; Crea usa lo stesso tetto e la varieta\' non lo passa', () => {
        expect(TETTO_PIEDI_KM).toBe(1.2);
        expect(TETTO_PIEDI_MINUTI).toBe(16);
        expect(MAX_WALK_MINUTES).toBe(16);
        expect(VARIETY_MAX_WALK_MINUTES).toBe(16);
    });
    it('kmTratto misura in linea d\'aria; senza coordinate null', () => {
        expect(kmTratto(a('x', 0), a('y', 1))).toBeCloseTo(1.0, 1);
        expect(kmTratto(a('x', 0), { place_id: 'z' })).toBeNull();
    });
    it('trattiLunghi trova i tratti oltre 1,2 km (il caso di Napoli: Belvedere San Martino → Terrazza a 4,14 km)', () => {
        const giro = [a('s1', 0), a('s2', 0.5), a('s3', 4.6)];
        expect(trattiLunghi(giro).map(t => [t.a.place_id, t.indice])).toEqual([['s3', 2]]);
    });
});

describe('D1 — gruppoNelTetto: il gruppo piu\' grande di tappe legate entro il tetto', () => {
    it('una tappa isolata esce, le altre restano', () => {
        const r = gruppoNelTetto([a('lontana', 5), a('b', 0), a('c', 0.8), a('d', 1.6)]);
        expect(ids(r.tenute)).toEqual(['b', 'c', 'd']);
        expect(ids(r.tolte)).toEqual(['lontana']);
    });
    it('a parita\' vince il gruppo della prima tappa', () => {
        const r = gruppoNelTetto([a('a1', 0), a('a2', 0.5), a('b1', 5), a('b2', 5.5)]);
        expect(ids(r.tenute)).toEqual(['a1', 'a2']);
    });
    it('le tappe senza coordinate restano', () => {
        const r = gruppoNelTetto([a('a', 0), { place_id: 'senza' }, a('b', 9)]);
        expect(ids(r.tenute)).toEqual(['a', 'senza']);
    });
});

describe('D1 — taglio e partenza', () => {
    it('tagliaTrattiLunghi toglie la tappa d\'arrivo di ogni tratto lungo', () => {
        const r = tagliaTrattiLunghi([a('a', 0), a('b', 1), a('c', 3), a('d', 3.5)]);
        expect(ids(r.tenute)).toEqual(['a', 'b']);
        expect(r.tolte.map(x => x.tappa.place_id)).toEqual(['c', 'd']);
    });
    it('migliorePartenza: partendo dal mezzo il vicino-piu\'-vicino lascia un tratto lungo; da un capo no', () => {
        const giro = [a('m', 1), a('s', 0), a('n', 2)];
        expect(trattiLunghi(vicinoPiuVicino(giro)).length).toBe(1); // m → s → n: 2 km
        const o = migliorePartenza(giro, vicinoPiuVicino);
        expect(trattiLunghi(o)).toEqual([]);
        // un giro gia' nel tetto non cambia partenza
        expect(ids(migliorePartenza([a('x', 0.5), a('y', 0), a('z', 1)], vicinoPiuVicino))[0]).toBe('x');
    });
});

describe('D1 — keepOpenStops con maxLegKm', () => {
    const start = new Date('2026-11-05T10:00:00+01:00');
    const retime = (l) => computeStopTimings(vicinoPiuVicino(l)).stops;
    const toStop = (c) => ({ ...c });
    it('una tappa oltre il tetto si toglie e si sostituisce con una candidata del pool entro il tetto', () => {
        const stops = retime([a('a', 0), a('b', 0.8), a('lontana', 4)]);
        const pool = [a('altrove', 6), a('vicina', 1.5)];
        const r = keepOpenStops({ stops, pool, start, retime, toStop, maxLegKm: TETTO_PIEDI_KM });
        expect(ids(r.stops)).toEqual(['a', 'b', 'vicina']);
        expect(r.chiuse[0]).toMatchObject({ place_id: 'lontana' });
        expect(r.chiuse[0].perche).toMatch(/oltre il tetto di cammino: 3,20 km/);
        expect(trattiLunghi(r.stops)).toEqual([]);
    });
    it('senza candidati vicini il giro si accorcia: mai un tratto oltre il tetto', () => {
        const stops = retime([a('a', 0), a('b', 0.8), a('lontana', 4)]);
        const r = keepOpenStops({ stops, pool: [a('altrove', 6)], start, retime, toStop, maxLegKm: TETTO_PIEDI_KM });
        expect(ids(r.stops)).toEqual(['a', 'b']);
    });
    it('want: riempie fino al numero chiesto anche senza tappe chiuse', () => {
        const stops = retime([a('a', 0), a('b', 0.8)]);
        const r = keepOpenStops({ stops, pool: [a('c', 1.6)], start, retime, toStop, maxLegKm: TETTO_PIEDI_KM, want: 3 });
        expect(ids(r.stops)).toEqual(['a', 'b', 'c']);
    });
    it('senza maxLegKm il comportamento di prima: nessun tetto', () => {
        const stops = retime([a('a', 0), a('b', 0.8), a('lontana', 4)]);
        const r = keepOpenStops({ stops, pool: [], start, retime, toStop });
        expect(ids(r.stops)).toEqual(['a', 'b', 'lontana']);
    });
});

describe('D1 — tettoNelPiano: l\'ultima rete del tetto nel piano di Crea', async () => {
    const { tettoNelPiano } = await import('../../services/momentSelection');
    const m = (id, key, extra = {}) => ({ id, key, label: key, ...extra });
    const voce = (c, mo, ora) => ({ candidate: c, moment: mo, start: new Date(`2026-11-05T${ora}:00+01:00`) });
    it('il pranzo a 1,33 km (ripiego «il piu\' vicino») esce; il resto resta con le sue ore', () => {
        const sched = { days: [[voce(a('teatro', 0), m('g1-mattina', 'mattina'), '10:59'), voce(a('trattoria', 1.33), m('g1-pranzo', 'pranzo'), '12:30'), voce(a('museo', 0.5), m('g1-pomeriggio', 'pomeriggio'), '14:30')]] };
        const r = tettoNelPiano(sched);
        expect(r.sched.days[0].map(x => x.candidate.place_id)).toEqual(['teatro', 'museo']);
        expect(r.tolte).toEqual([expect.objectContaining({ place_id: 'trattoria', pasto: true, km: 1.33 })]);
        expect(r.sched.days[0][1].start.toISOString()).toBe(new Date('2026-11-05T14:30:00+01:00').toISOString());
    });
    it('il momento col suo tetto (la natura chiesta nel borgo, 30 minuti) tiene il tratto e lo dichiara', () => {
        const sched = { days: [[voce(a('belvedere', 0), m('g1-mattina', 'mattina'), '09:30'), voce(a('monte', 2.0), m('g1-pomeriggio', 'pomeriggio', { maxWalkMinutes: 30 }), '14:30')]] };
        const r = tettoNelPiano(sched);
        expect(r.tolte).toEqual([]);
        expect(r.dichiarati).toEqual([expect.objectContaining({ da: 'belvedere', a: 'monte', minuti: 27 })]);
    });
    it('il testo del tratto dichiarato: il dato nudo', async () => {
        const { TESTI_TETTO } = await import('../../lib/tettoCammino');
        expect(TESTI_TETTO.trattoLungo({ da: 'Belvedere', a: 'Monte Muganà', km: 2.21, minuti: 29 })).toBe('Da Belvedere a Monte Muganà sono 2,2 km a piedi, 29 minuti.');
    });
});
