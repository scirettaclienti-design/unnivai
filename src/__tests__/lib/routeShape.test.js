// C5 — la forma del percorso: km, incroci, avanti-e-indietro, catene.
import { describe, it, expect } from 'vitest';
import {
    legKm, pathKm, countCrossings, minimalPathKm, backtrackIndex, brandKey, repeatedBrands, routeMetrics, isCommercialPlace,
    anchoredMinimalPathKm, SHORT_ROUTE_KM, stopDetours, DETOUR_WALK_KMH,
} from '../../lib/routeShape';
import { WALKING_KMH } from '../../lib/tourTiming';

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

    it('routeMetrics: le misure insieme; i due indici affiancati', () => {
        const m = routeMetrics(ROMA_ZIGZAG);
        expect(m).toMatchObject({ tappe: 7, catene: 1, giroCorto: false });
        expect(m.incroci).toBeGreaterThan(0);
        expect(m.indiceLibero).toBeGreaterThan(1.3);
        expect(m.km).toBeGreaterThan(4);
    });
});

// ─── C5b — il cammino minimo rispetta l'ordine dei momenti ──────────────────
describe('C5b — misura con le ancore dei momenti', () => {
    const t = (name, lat, lng, moment) => ({ ...p(name, lat, lng), moment });
    // Una via nord-sud: pranzo a sud, cena a nord, pomeriggio in mezzo.
    // L'ordine dei momenti obbliga ad andare a sud e tornare: il minimo libero
    // lo evita, quello con le ancore no.
    const giorno = [
        t('m1', 41.900, 12.48, 'mattina'), t('pr', 41.890, 12.48, 'pranzo'),
        t('po', 41.895, 12.48, 'pomeriggio'), t('ce', 41.905, 12.48, 'cena'),
    ];

    it('lo stesso giro: libero > 1,3, con le ancore = 1 (nessun ordine migliore dentro i momenti)', () => {
        expect(backtrackIndex(giorno)).toBeGreaterThan(1.3);
        expect(backtrackIndex(giorno, { ancorato: true })).toBeCloseTo(1, 6);
        expect(anchoredMinimalPathKm(giorno)).toBeCloseTo(pathKm(giorno), 6);
    });

    it('un momento percorso a zig-zag resta sopra 1: dentro il momento l\'ordine si poteva scegliere', () => {
        const zig = [
            t('a', 41.900, 12.48, 'mattina'), t('c', 41.904, 12.48, 'mattina'), t('b', 41.902, 12.48, 'mattina'),
            t('pr', 41.906, 12.48, 'pranzo'),
        ];
        // a → b → c → pranzo e' il minimo con le ancore: 0,6 km circa contro 0,9
        expect(anchoredMinimalPathKm(zig)).toBeCloseTo(pathKm([zig[0], zig[2], zig[1], zig[3]]), 6);
        expect(backtrackIndex(zig, { ancorato: true })).toBeGreaterThan(1.3);
    });

    it('i pasti sono ancore: un pasto non si sposta mai, anche se accorcerebbe', () => {
        const g = [t('m', 41.900, 12.48, 'mattina'), t('pr', 41.910, 12.48, 'pranzo'), t('po', 41.901, 12.48, 'pomeriggio')];
        expect(anchoredMinimalPathKm(g)).toBeCloseTo(pathKm(g), 6);
        expect(minimalPathKm(g)).toBeLessThan(pathKm(g));
    });

    it('giro sotto i 2 km: indice non applicato (null), gli incroci si contano lo stesso', () => {
        expect(SHORT_ROUTE_KM).toBe(2);
        const corto = [
            t('a', 41.900, 12.480, 'mattina'), t('c', 41.902, 12.482, 'mattina'), t('b', 41.900, 12.482, 'mattina'), t('d', 41.902, 12.480, 'mattina'),
        ];
        const m = routeMetrics(corto);
        expect(m.km).toBeLessThan(2);
        expect(m).toMatchObject({ giroCorto: true, indice: null, incroci: 1 });
        expect(m.indiceLibero).toBeGreaterThan(1);
        expect(routeMetrics(giorno).giroCorto).toBe(false);
    });
});

// ─── C5c — deviazione per tappa ─────────────────────────────────────────────
describe('C5c — deviazione per tappa', () => {
    it('la velocita\' a piedi e\' quella di tourTiming', () => {
        expect(DETOUR_WALK_KMH).toBe(WALKING_KMH);
    });

    it('(A→B + B→C) − A→C in minuti, per ogni tappa intermedia; prima e ultima escluse', () => {
        const linea = [0, 1, 2, 3].map(i => p(`l${i}`, 41.9 + i * 0.005, 12.48));
        expect(stopDetours(linea).map(d => d.indice)).toEqual([1, 2]);
        for (const d of stopDetours(linea)) expect(d.minuti).toBeCloseTo(0, 6);
        // B a ~500 m dalla linea A–C: andata e ritorno
        const A = p('A', 41.900, 12.48), B = { ...p('B', 41.900, 12.486), moment: 'pranzo' }, C = p('C', 41.901, 12.48);
        const [d] = stopDetours([A, B, C]);
        expect(d).toMatchObject({ indice: 1, titolo: 'B', momento: 'pranzo' });
        expect(d.minuti).toBeCloseTo(((legKm(A, B) + legKm(B, C) - legKm(A, C)) / 4.5) * 60, 9);
        expect(d.minuti).toBeGreaterThan(10);
    });

    it('una tappa senza coordinate (o con un vicino senza) resta fuori', () => {
        expect(stopDetours([p('A', 41.9, 12.48), { name: 'X' }, p('C', 41.91, 12.48)])).toEqual([]);
    });
});
