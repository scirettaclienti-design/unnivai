// C5 — la forma del percorso: km, incroci, avanti-e-indietro, catene.
import { describe, it, expect } from 'vitest';
import {
    legKm, pathKm, countCrossings, minimalPathKm, backtrackIndex, brandKey, repeatedBrands, routeMetrics, isCommercialPlace,
} from '../../lib/routeShape';

const p = (name, lat, lng, types = ['tourist_attraction']) => ({ place_id: name, name, latitude: lat, longitude: lng, types });
const RIST = ['restaurant', 'food', 'point_of_interest'];

// Il caso dal telefono di Ivano (Roma, 11/10), coordinate approssimate.
const ROMA_ZIGZAG = [
    p('Piazza del Quirinale', 41.8996, 12.4874),
    p('Belvedere Tarpeo', 41.8921, 12.4813),
    p('Origano Trevi', 41.9009, 12.4836, RIST),
    p('Vittoriano', 41.8946, 12.4831),
    p('Piazza Farnese', 41.8949, 12.4716),
    p('Bar Monti', 41.8968, 12.4900, ['bar', 'cafe']),
    p('Origano Campo de\' Fiori', 41.8957, 12.4722, RIST),
];

describe('C5 — misure del percorso', () => {
    it('km: somma dei tratti, null senza coordinate', () => {
        expect(legKm(p('a', 41.9, 12.5), p('b', 41.9, 12.5))).toBe(0);
        expect(legKm(p('a', 41.9, 12.5), { name: 'x' })).toBe(null);
        const km = pathKm([p('a', 41.9, 12.5), p('b', 41.909, 12.5), p('c', 41.918, 12.5)]);
        expect(km).toBeGreaterThan(1.9);
        expect(km).toBeLessThan(2.1);
    });

    it('incroci: il caso a zig-zag di Roma si taglia piu\' volte; un giro a "C" no', () => {
        expect(countCrossings(ROMA_ZIGZAG)).toBeGreaterThanOrEqual(3);
        const c = [p('a', 0, 0), p('b', 0, 1), p('c', 1, 1), p('d', 1, 0)];
        expect(countCrossings(c)).toBe(0);
        // a → c → b → d: le due diagonali si tagliano
        expect(countCrossings([c[0], c[2], c[1], c[3]])).toBe(1);
        // tratti che si toccano solo in una tappa ripassata non contano
        expect(countCrossings([p('a', 0, 0), p('b', 0, 1), p('a2', 0, 0), p('c', 1, 0)])).toBe(0);
    });

    it('cammino minimo e indice: 1 su una linea percorsa in ordine, alto sullo zig-zag', () => {
        const line = [0, 1, 2, 3, 4].map(i => p(`l${i}`, 41.9 + i * 0.002, 12.5));
        expect(backtrackIndex(line)).toBeCloseTo(1, 5);
        expect(backtrackIndex([line[0], line[4], line[1], line[3], line[2]])).toBeGreaterThan(2);
        expect(minimalPathKm(line)).toBeCloseTo(pathKm(line), 6);
        expect(backtrackIndex(ROMA_ZIGZAG)).toBeGreaterThan(1.3);
        expect(backtrackIndex(line.slice(0, 2))).toBe(null);
    });

    it('catene: lo stesso marchio in due locali diversi; il tipo di locale resta nella chiave', () => {
        expect(brandKey(ROMA_ZIGZAG[2])).toBe('|origano');
        expect(brandKey(ROMA_ZIGZAG[6])).toBe('|origano');
        expect(repeatedBrands(ROMA_ZIGZAG)).toEqual([{ marchio: 'origano', tappe: ['Origano Trevi', 'Origano Campo de\' Fiori'] }]);
        expect(brandKey(p('Pizzeria Navona', 0, 0, RIST))).not.toBe(brandKey(p('Osteria Navona', 0, 0, RIST)));
        expect(brandKey(p('Il Bar della Musa', 0, 0, ['bar']))).toBe('bar|musa');
        // non sono locali: due chiese "Santa Maria" non sono una catena
        expect(isCommercialPlace(p('Santa Maria in Trastevere', 0, 0, ['church']))).toBe(false);
        expect(brandKey(p('Santa Maria in Trastevere', 0, 0, ['church']))).toBe(null);
        // lo stesso luogo due volte non e' una catena (lo conta la misura delle ripetizioni)
        expect(repeatedBrands([ROMA_ZIGZAG[2], ROMA_ZIGZAG[2]])).toEqual([]);
    });

    it('routeMetrics: le quattro misure insieme', () => {
        const m = routeMetrics(ROMA_ZIGZAG);
        expect(m).toMatchObject({ tappe: 7, catene: 1 });
        expect(m.incroci).toBeGreaterThan(0);
        expect(m.indice).toBeGreaterThan(1.3);
        expect(m.km).toBeGreaterThan(4);
    });
});
