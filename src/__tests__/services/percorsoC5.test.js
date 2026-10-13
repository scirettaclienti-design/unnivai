// C5 — percorso a filo: una camminata, non una lista.
// Il caso vero e' dal telefono di Ivano (Roma, 11/10): Quirinale → Belvedere
// Tarpeo (sud) → Origano Trevi (nord) → Vittoriano (sud) → Piazza Farnese
// (ovest) → bar (nord-est) → Origano Campo de' Fiori (ovest). Coordinate
// approssimate al centinaio di metri.
import { describe, it, expect } from 'vitest';
import {
    flattenSkeleton, bucketCandidates, repairMomentSelection, orderPlanWalk, nextStops, detourMinutes, polishRoute,
    MAX_WALK_MINUTES, OFF_ROUTE_MINUTES,
} from '../../services/momentSelection';
import { routeMetrics, countCrossings } from '../../lib/routeShape';
import { travelMinutes } from '../../lib/tourTiming';

const CATS = {
    mattina: ['cultura', 'monumenti', 'musei', 'passeggiata'], pranzo: ['cibo'],
    pomeriggio: ['cultura', 'natura', 'shopping', 'passeggiata'], aperitivo: ['bar', 'punti panoramici'], cena: ['cibo'],
};
const ORE = { mattina: ['09:30', '12:30'], pranzo: ['12:30', '14:30'], pomeriggio: ['14:30', '18:00'], aperitivo: ['18:00', '20:00'], cena: ['20:00', '22:30'] };
const giorno = (spec) => flattenSkeleton({ days: [{ moments: spec.map(([key, stops = 1]) => ({
    key, label: key, stops, categories: CATS[key],
    start: new Date(`2026-10-12T${ORE[key][0]}:00+02:00`), end: new Date(`2026-10-12T${ORE[key][1]}:00+02:00`),
})) }] });
const p = (id, name, lat, lng, types, rating = 4.5) => ({ place_id: id, name, latitude: lat, longitude: lng, types, rating, user_ratings_total: 1000 });
const RIST = ['restaurant', 'food'];
const seqOf = (plan) => plan.flatMap(x => x.stops.map(s => s.candidate));
const nomi = (plan) => seqOf(plan).map(c => c.name);

const IVANO = [
    p('quir', 'Piazza del Quirinale', 41.8996, 12.4874, ['tourist_attraction']),
    p('tarp', 'Belvedere Tarpeo', 41.8921, 12.4813, ['tourist_attraction']),
    p('ortr', 'Origano Trevi', 41.9009, 12.4836, RIST),
    p('vitt', 'Vittoriano', 41.8946, 12.4831, ['tourist_attraction', 'museum']),
    p('farn', 'Piazza Farnese', 41.8949, 12.4716, ['tourist_attraction']),
    p('bar', 'Bar Monti', 41.8968, 12.4900, ['bar', 'cafe']),
    p('orcf', 'Origano Campo de\' Fiori', 41.8957, 12.4722, RIST),
];
// Le alternative del pool, un po' sotto per voto: nessuna vince per merito.
const ALTRI = [
    p('trevi', 'Fontana di Trevi', 41.9009, 12.4833, ['tourist_attraction'], 4.4),
    p('igna', 'Chiesa di Sant\'Ignazio', 41.8990, 12.4797, ['church'], 4.4),
    p('piet', 'Trattoria Pietro', 41.8975, 12.4770, RIST, 4.4),
    p('nav', 'Piazza Navona', 41.8992, 12.4731, ['tourist_attraction'], 4.4),
    p('fico', 'Bar del Fico', 41.8996, 12.4706, ['bar'], 4.4),
    p('sole', 'Osteria del Sole', 41.8962, 12.4705, RIST, 4.4),
];
const ROMA = giorno([['mattina', 2], ['pranzo'], ['pomeriggio', 2], ['aperitivo'], ['cena']]);
const SCELTA_DEL_MODELLO = [['quir', 'mattina'], ['tarp', 'mattina'], ['ortr', 'pranzo'], ['vitt', 'pomeriggio'], ['farn', 'pomeriggio'], ['bar', 'aperitivo'], ['orcf', 'cena']]
    .map(([place_id, m]) => ({ place_id, moment: `g1-${m}` }));

describe('C5 — il caso a zig-zag di Roma (11/10)', () => {
    it('controllo dello strumento: il giro del telefono si taglia piu\' volte e ripete un marchio', () => {
        const m = routeMetrics(IVANO);
        expect(m.incroci).toBeGreaterThanOrEqual(3);
        expect(m.indiceLibero).toBeGreaterThan(1.3);
        expect(m.catene).toBe(1);
    });

    it('stessa scelta del modello, pool con alternative → nessun incrocio, nessuna catena, stesse tappe per momento', () => {
        const pool = [...IVANO, ...ALTRI];
        const { plan, report } = repairMomentSelection({ moments: ROMA, buckets: bucketCandidates(ROMA, pool), aiStops: SCELTA_DEL_MODELLO, pool });
        const m = routeMetrics(seqOf(plan));
        expect(m.incroci, nomi(plan).join(' → ')).toBe(0);
        expect(m.catene).toBe(0);
        expect(m.km).toBeLessThan(routeMetrics(IVANO).km);
        expect(plan.map(x => [x.moment.key, x.stops.length])).toEqual([['mattina', 2], ['pranzo', 1], ['pomeriggio', 2], ['aperitivo', 1], ['cena', 1]]);
        // Ogni cambio dice perche'.
        const motivi = report.scartate.map(x => x.motivo).join(' | ');
        expect(motivi).toMatch(/fuori strada: \d+ min di giro/);
        expect(motivi).toMatch(/stesso marchio gia' nel giorno \(origano\)/);
        // Nessun tratto oltre il tetto.
        const seq = seqOf(plan);
        for (let i = 1; i < seq.length; i++) expect(travelMinutes(seq[i - 1], seq[i])).toBeLessThanOrEqual(MAX_WALK_MINUTES);
    });

    it('dentro un momento a zig-zag: riordinato senza incroci, e nessuna tappa cambia momento', () => {
        const plan = [
            { moment: ROMA[0], stops: [{ candidate: IVANO[0] }, { candidate: IVANO[1] }] }, // Quirinale → Tarpeo
            { moment: ROMA[1], stops: [{ candidate: IVANO[2] }] }, // pranzo Origano Trevi (nord)
        ];
        const out = orderPlanWalk(plan);
        expect(out[0].stops.map(s => s.candidate.name)).toEqual(['Belvedere Tarpeo', 'Piazza del Quirinale']);
        expect(out[1].stops.map(s => s.candidate.name)).toEqual(['Origano Trevi']);
        expect(plan[0].stops[0].candidate.name).toBe('Piazza del Quirinale'); // il piano passato non cambia

        // Pomeriggio di quattro tappe percorse a "X" fra due punti fissi.
        const A = p('a', 'a', 41.900, 12.470, ['museum']), B = p('b', 'b', 41.900, 12.474, ['museum']);
        const C = p('c', 'c', 41.902, 12.474, ['museum']), D = p('d', 'd', 41.902, 12.470, ['museum']);
        const pom = giorno([['pranzo'], ['pomeriggio', 4], ['aperitivo']]);
        const zig = [
            { moment: pom[0], stops: [{ candidate: p('r', 'r', 41.899, 12.469, RIST) }] },
            { moment: pom[1], stops: [A, C, B, D].map(candidate => ({ candidate })) },
            { moment: pom[2], stops: [{ candidate: p('z', 'z', 41.903, 12.469, ['bar']) }] },
        ];
        expect(countCrossings(seqOf(zig))).toBeGreaterThan(0);
        const fixed = orderPlanWalk(zig);
        expect(countCrossings(seqOf(fixed))).toBe(0);
        expect(fixed.map(x => x.stops.length)).toEqual([1, 4, 1]);
        expect(new Set(fixed[1].stops.map(s => s.candidate.place_id))).toEqual(new Set(['a', 'b', 'c', 'd']));
    });

    it('un ordine piu\' corto che aggiunge un tratto oltre il tetto non vale', () => {
        const lontano = p('far', 'far', 41.920, 12.470, ['museum']);
        const vicino = p('near', 'near', 41.9005, 12.470, ['museum']);
        const prima = p('prima', 'prima', 41.900, 12.470, RIST);
        const dopo = p('dopo', 'dopo', 41.921, 12.470, ['bar']);
        const g = giorno([['pranzo'], ['pomeriggio', 2], ['aperitivo']]);
        const plan = [
            { moment: g[0], stops: [{ candidate: prima }] },
            { moment: g[1], stops: [{ candidate: vicino }, { candidate: lontano }] },
            { moment: g[2], stops: [{ candidate: dopo }] },
        ];
        // l'ordine dato e' gia' il piu' corto: resta
        expect(orderPlanWalk(plan)[1].stops.map(s => s.candidate.place_id)).toEqual(['near', 'far']);
    });
});

describe('C5 — sulla strada verso il prossimo punto fisso', () => {
    // Mattina al museo, cena fissa a 900 m a nord. Due piazze equivalenti per
    // il pomeriggio, a 7 minuti dal museo: una verso la cena, una dalla parte opposta.
    const museo = p('museo', 'museo', 41.900, 12.480, ['museum']);
    const sullaStrada = p('su', 'su', 41.9045, 12.480, ['tourist_attraction']);
    const fuoriStrada = p('giu', 'giu', 41.8955, 12.480, ['tourist_attraction']);
    const cena = p('cena', 'cena', 41.908, 12.480, RIST);
    const g = giorno([['mattina'], ['pomeriggio'], ['cena']]);
    const pool = [museo, sullaStrada, fuoriStrada, cena];
    const nomeDi = (plan, key) => plan.find(x => x.moment.key === key).stops[0].candidate.place_id;

    it('controllo: stessa distanza dal museo, stesso voto; la deviazione verso la cena e\' 0 contro ~13 minuti', () => {
        expect(travelMinutes(museo, sullaStrada)).toBe(travelMinutes(museo, fuoriStrada));
        expect(detourMinutes(museo, sullaStrada, cena)).toBeLessThan(1);
        expect(detourMinutes(museo, fuoriStrada, cena)).toBeGreaterThan(OFF_ROUTE_MINUTES);
    });

    it('riparazione: vince il candidato sulla strada, in qualunque ordine stia nel pool', () => {
        for (const ordine of [pool, [museo, fuoriStrada, sullaStrada, cena].reverse()]) {
            const { plan } = repairMomentSelection({ moments: g, buckets: bucketCandidates(g, ordine), aiStops: [{ place_id: 'museo', moment: 'g1-mattina' }], pool: ordine });
            expect(nomeDi(plan, 'pomeriggio')).toBe('su');
        }
    });

    it('scelta del modello fuori strada: scartata con il motivo, entra quella sulla strada', () => {
        const { plan, report } = repairMomentSelection({
            moments: g, buckets: bucketCandidates(g, pool), pool,
            aiStops: [{ place_id: 'museo', moment: 'g1-mattina' }, { place_id: 'giu', moment: 'g1-pomeriggio' }, { place_id: 'cena', moment: 'g1-cena' }],
        });
        expect(nomeDi(plan, 'pomeriggio')).toBe('su');
        expect(report.scartate).toEqual([expect.objectContaining({ place_id: 'giu', motivo: expect.stringMatching(/^fuori strada: 1\d min di giro verso "cena"$/) })]);
        expect(plan.find(x => x.moment.key === 'pomeriggio').stops[0].trace.deviazione).toBe(0);
    });

    it('il merito resta: un candidato fuori strada di poco (sotto la soglia) con voto molto piu\' alto vince', () => {
        const quasi = p('quasi', 'quasi', 41.9045, 12.4815, ['tourist_attraction'], 5);
        const debole = { ...sullaStrada, rating: 3.6 };
        const pl = [museo, debole, quasi, cena];
        expect(detourMinutes(museo, quasi, cena)).toBeLessThan(OFF_ROUTE_MINUTES);
        const { plan } = repairMomentSelection({ moments: g, buckets: bucketCandidates(g, pl), aiStops: [{ place_id: 'museo', moment: 'g1-mattina' }], pool: pl });
        expect(nomeDi(plan, 'pomeriggio')).toBe('quasi');
    });

    it('C5d — il riferimento di ogni posto e\' la tappa vera che segue (non il pasto dopo); a fine giornata nessuno', () => {
        const g2 = giorno([['mattina', 2], ['pranzo'], ['pomeriggio'], ['aperitivo']]);
        const ids = [['x0', 'x1'], ['x2'], ['x3'], ['x4']];
        const plan = g2.map((moment, i) => ({ moment, stops: ids[i].map(id => ({ candidate: { place_id: id } })) }));
        const ns = nextStops(plan);
        expect(ns.get('g1-mattina').map(c => c.place_id)).toEqual(['x1', 'x2']);
        expect(ns.get('g1-pranzo').map(c => c.place_id)).toEqual(['x3']);
        expect(ns.get('g1-pomeriggio').map(c => c.place_id)).toEqual(['x4']);
        expect(ns.get('g1-aperitivo')).toEqual([null]);
    });
});

describe('C5 — mai lo stesso marchio due volte nel giorno', () => {
    const g = giorno([['pranzo'], ['pomeriggio'], ['cena']]);
    const ortr = IVANO[2], orcf = IVANO[6];
    // Il museo a due passi da Origano Trevi: il pranzo del modello sta sulla strada.
    const museo = p('museo', 'museo', 41.9000, 12.4830, ['museum']);
    const altra = p('altra', 'altra', 41.8945, 12.4700, RIST, 4.0);

    it('Origano a pranzo → a cena un altro locale, anche se Origano Campo de\' Fiori e\' piu\' vicino e ha voto piu\' alto', () => {
        expect(travelMinutes(museo, orcf)).toBeLessThan(travelMinutes(museo, altra));
        expect(travelMinutes(museo, altra)).toBeLessThanOrEqual(MAX_WALK_MINUTES);
        const pool = [ortr, museo, orcf, altra];
        const { plan, report } = repairMomentSelection({
            moments: g, buckets: bucketCandidates(g, pool), pool,
            aiStops: [{ place_id: 'ortr', moment: 'g1-pranzo' }, { place_id: 'museo', moment: 'g1-pomeriggio' }, { place_id: 'orcf', moment: 'g1-cena' }],
        });
        expect(nomi(plan)).toEqual(['Origano Trevi', 'museo', 'altra']);
        expect(report.scartate).toEqual([expect.objectContaining({ place_id: 'orcf', motivo: "stesso marchio gia' nel giorno (origano)" })]);
        expect(routeMetrics(seqOf(plan)).catene).toBe(0);
    });

    it('solo locali di quel marchio per la cena: la cena c\'e\' lo stesso, dichiarata come ripiego', () => {
        const pool = [ortr, museo, orcf];
        const { plan, report } = repairMomentSelection({ moments: g, buckets: bucketCandidates(g, pool), aiStops: [{ place_id: 'ortr', moment: 'g1-pranzo' }], pool });
        const cena = plan.find(x => x.moment.key === 'cena').stops[0];
        expect(cena.candidate.place_id).toBe('orcf');
        expect(cena.trace).toMatchObject({ scelta: 'ripiego', ripiego: 'catena' });
        expect(report.ripieghi.map(x => x.motivo)).toContain("solo locali di un marchio gia' nel giorno (origano)");
    });

    it('il giorno dopo il marchio torna possibile', () => {
        const due = flattenSkeleton({ days: [{ moments: [g[0]] }, { moments: [g[0]] }] });
        const pool = [ortr, orcf];
        const { plan } = repairMomentSelection({ moments: due, buckets: bucketCandidates(due, pool), aiStops: [], pool });
        expect(plan.map(x => x.stops[0].trace.ripiego ?? null)).toEqual([null, null]);
    });
});

describe('C5 — la rifinitura non cambia una scelta del modello per solo merito', () => {
    it('stesso giro, voto piu\' alto a due passi: resta la tappa del modello', () => {
        const g = giorno([['mattina'], ['pomeriggio']]);
        const a = p('a', 'a', 41.900, 12.480, ['museum'], 4.0);
        const b = p('b', 'b', 41.902, 12.480, ['church'], 4.0);
        const top = p('top', 'top', 41.9021, 12.4801, ['church'], 5.0);
        const pool = [a, b, top];
        const { plan, report } = repairMomentSelection({
            moments: g, buckets: bucketCandidates(g, pool), pool,
            aiStops: [{ place_id: 'a', moment: 'g1-mattina' }, { place_id: 'b', moment: 'g1-pomeriggio' }],
        });
        expect(nomi(plan)).toEqual(['a', 'b']);
        expect(report.ritocchi).toEqual([]);
    });
});

describe('C5 — rifinitura: famiglie ripetute, pasti fuori posto, tracce', () => {
    const g = giorno([['mattina'], ['pomeriggio'], ['aperitivo']]);
    const belvA = p('ba', 'Belvedere Tarpeo', 41.900, 12.480, ['tourist_attraction']);
    const belvB = p('bb', 'Belvedere Cederna', 41.902, 12.480, ['tourist_attraction']);
    const bar = p('bar', 'Bar Pace', 41.903, 12.480, ['bar']);
    const ripetuta = { scelta: 'ripiego', ripiego: 'famiglia', famiglia: 'panorama', minuti: 3 };
    const piano = () => [
        { moment: g[0], stops: [{ candidate: belvA, source: 'modello', trace: { scelta: 'modello', famiglia: 'panorama' } }] },
        { moment: g[1], stops: [{ candidate: belvB, source: 'riparata', trace: { ...ripetuta } }] },
        { moment: g[2], stops: [{ candidate: bar, source: 'riparata', trace: { scelta: 'riparazione' } }] },
    ];
    const report = () => ({ riempite: [], ripieghi: [{ place_id: 'bb' }], ripetuti: [{ momento: 'g1-pomeriggio', place_id: 'bb' }] });

    it('toglie la famiglia ripetuta con una chiesa vicina, e la traccia del ripiego sparisce', () => {
        const chiesa = p('ch', 'Chiesa di San Marco', 41.9021, 12.4801, ['church']);
        const pool = [belvA, belvB, bar, chiesa];
        const r = report();
        const out = polishRoute(piano(), { buckets: bucketCandidates(g, pool), pool }, r);
        const fam = seqOf(out).map(c => (/belvedere/i.test(c.name) ? 'panorama' : c.name));
        expect(fam.filter(f => f === 'panorama')).toHaveLength(1);
        expect(nomi(out)).toContain('Chiesa di San Marco');
        expect(r.ritocchi).toEqual([expect.objectContaining({ messa: 'ch' })]);
        expect(out.flatMap(x => x.stops).some(st => st.trace?.ripiego)).toBe(false);
        expect(r.ripieghi).toEqual([]);
        expect(r.ripetuti).toEqual([]);
    });

    it('mai una trattoria nel pomeriggio per togliere una ripetizione (anche se Google la dice "store")', () => {
        const trattoria = p('tr', 'Trattoria Bottega', 41.9021, 12.4801, ['restaurant', 'food', 'store']);
        const pool = [belvA, belvB, bar, trattoria];
        // C6a — un ristorante con uno `store` di contorno e' un ristorante: non entra nemmeno nel bucket del pomeriggio.
        expect(bucketCandidates(g, pool).get('g1-pomeriggio').map(c => c.place_id)).not.toContain('tr');
        const r = report();
        const out = polishRoute(piano(), { buckets: bucketCandidates(g, pool), pool }, r);
        expect(nomi(out)).toEqual(['Belvedere Tarpeo', 'Belvedere Cederna', 'Bar Pace']);
        expect(r.ritocchi || []).toEqual([]);
    });

    it('un ripiego "famiglia" che dopo la rifinitura non si ripete piu\' perde la dicitura', () => {
        const chiesa = p('ch', 'Chiesa di San Marco', 41.9021, 12.4801, ['church']);
        const pool = [belvA, belvB, bar, chiesa];
        const pl = piano();
        // il ripiego e' sulla prima: il belvedere che resta
        pl[0].stops[0] = { candidate: belvA, source: 'riparata', trace: { ...ripetuta } };
        pl[1].stops[0] = { candidate: belvB, source: 'modello', trace: { scelta: 'modello', famiglia: 'panorama' } };
        const r = { riempite: [], ripieghi: [{ place_id: 'ba' }], ripetuti: [{ momento: 'g1-mattina', place_id: 'ba' }] };
        // la chiesa dove serve meno strada: al pomeriggio, cosi' il ripiego
        // della mattina resta ed e' lui a dover perdere la dicitura
        const soloPomeriggio = new Map([...bucketCandidates(g, pool)].map(([k, v]) => [k, k === 'g1-mattina' ? [belvA] : v]));
        const out = polishRoute(pl, { buckets: soloPomeriggio, pool }, r);
        expect(nomi(out)).toEqual(['Belvedere Tarpeo', 'Chiesa di San Marco', 'Bar Pace']);
        expect(out[0].stops[0].trace).toMatchObject({ scelta: 'riparazione', motivo: expect.stringMatching(/non piu' ripetuta/) });
        expect(out[0].stops[0].trace.ripiego).toBeUndefined();
        expect(r.ripieghi).toEqual([]);
        expect(r.ripetuti).toEqual([]);
    });
});
