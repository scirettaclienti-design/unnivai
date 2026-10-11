// C5c-varieta' — la rifinitura non sposta le ripetizioni, le ricerche mirate
// vanno per gravita', una ripetizione inevitabile e' dichiarata con la prova.
import { describe, it, expect } from 'vitest';
import {
    flattenSkeleton, bucketCandidates, repairMomentSelection, polishRoute, searchQueue, MAX_WALK_MINUTES,
} from '../../services/momentSelection';
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
const p = (id, lat, lng, types = ['tourist_attraction'], rating = 4.5) => ({ place_id: id, name: id, latitude: lat, longitude: lng, types, rating, user_ratings_total: 500 });
const seq = (plan) => plan.flatMap(x => x.stops);
const famiglie = (plan) => seq(plan).map(s => s.trace?.famiglia ?? null);

// ─── 1. La rifinitura non sposta una ripetizione ─────────────────────────────
describe('C5c — la rifinitura non sposta una ripetizione da una famiglia a un\'altra', () => {
    // mattina: piazza; pomeriggio: piazza ripetuta (lontana dalla strada) e un belvedere;
    // nel pool, per il pomeriggio, un belvedere piu' sulla strada della piazza.
    const g = giorno([['mattina'], ['pomeriggio', 2], ['aperitivo']]);
    const piazzaA = p('Piazza Uno', 41.900, 12.480);
    const piazzaB = p('Piazza Fuori', 41.900, 12.490);       // ripetuta, 800 m fuori linea
    const belvA = p('Belvedere Uno', 41.903, 12.480);
    const belvB = p('Belvedere Due', 41.9015, 12.4805);      // sulla linea: toglierebbe la piazza ripetuta e ripeterebbe il belvedere
    const bar = p('Bar Fine', 41.906, 12.480, ['bar']);
    const rip = { scelta: 'ripiego', ripiego: 'famiglia', famiglia: 'piazza', motivo: 'nessuna famiglia nuova vicina: piazza ripetuta' };
    const piano = () => [
        { moment: g[0], stops: [{ candidate: piazzaA, source: 'modello', trace: { scelta: 'modello', famiglia: 'piazza' } }] },
        { moment: g[1], stops: [
            { candidate: piazzaB, source: 'riparata', trace: { ...rip } },
            { candidate: belvA, source: 'modello', trace: { scelta: 'modello', famiglia: 'panorama' } },
        ] },
        { moment: g[2], stops: [{ candidate: bar, source: 'riparata', trace: { scelta: 'riparazione' } }] },
    ];

    it('controllo: lo scambio accorcerebbe il giro di parecchi minuti e lascerebbe il totale delle ripetizioni uguale', () => {
        const prima = travelMinutes(piazzaA, piazzaB) + travelMinutes(piazzaB, belvA);
        const dopo = travelMinutes(piazzaA, belvB) + travelMinutes(belvB, belvA);
        expect(prima - dopo).toBeGreaterThan(5);
    });

    it('piazza ripetuta → belvedere ripetuto: rifiutato, la ripetizione resta dov\'era e resta dichiarata', () => {
        const pool = [piazzaA, piazzaB, belvA, belvB, bar];
        const r = { riempite: [], ripieghi: [{ place_id: 'Piazza Fuori' }], ripetuti: [{ momento: 'g1-pomeriggio', place_id: 'Piazza Fuori', da: piazzaA }] };
        const out = polishRoute(piano(), { buckets: bucketCandidates(g, pool), pool }, r);
        const ids = seq(out).map(s => s.candidate.place_id);
        expect(ids).toContain('Piazza Fuori');
        expect(ids).not.toContain('Belvedere Due');
        expect(r.ritocchi || []).toEqual([]);
        expect(r.ripetuti.map(x => x.place_id)).toEqual(['Piazza Fuori']);
    });

    it('lo stesso scambio verso una famiglia nuova (una chiesa) si fa: la ripetizione sparisce', () => {
        const chiesa = p('Chiesa Due', 41.9015, 12.4805, ['church']);
        const pool = [piazzaA, piazzaB, belvA, chiesa, bar];
        const r = { riempite: [], ripieghi: [{ place_id: 'Piazza Fuori' }], ripetuti: [{ momento: 'g1-pomeriggio', place_id: 'Piazza Fuori', da: piazzaA }] };
        const out = polishRoute(piano(), { buckets: bucketCandidates(g, pool), pool }, r);
        expect(seq(out).map(s => s.candidate.place_id)).toContain('Chiesa Due');
        expect(famiglie(out).filter(f => f === 'piazza')).toHaveLength(1);
        expect(r.ripetuti).toEqual([]);
    });
});

// ─── 2. Le ricerche mirate per gravita' ─────────────────────────────────────
describe('C5c — searchQueue: prima oltre il tetto, poi le ripetizioni, poi i lontani ormai entro il tetto', () => {
    const g = giorno([['mattina'], ['pranzo'], ['pomeriggio'], ['aperitivo'], ['cena']]);
    const m = p('Museo', 41.900, 12.480, ['museum']);
    const pr = p('Trattoria Vicina', 41.9020, 12.4800, ['restaurant']);       // segnata lontana, ma ora a ~3 min
    const po = p('Museo Due', 41.9030, 12.4800, ['museum']);                  // famiglia ripetuta
    const ap = p('Bar Lontano', 41.9300, 12.4800, ['bar']);                   // oltre il tetto: ~36 min
    const ce = p('Osteria', 41.9305, 12.4800, ['restaurant']);
    const plan = [m, pr, po, ap, ce].map((c, i) => ({ moment: g[i], stops: [{ candidate: c, trace: {} }] }));
    // l'ordine dei report e' quello della scelta: il pranzo lontano viene prima
    const report = {
        lontani: [{ momento: 'g1-pranzo', place_id: 'Trattoria Vicina', da: m }, { momento: 'g1-aperitivo', place_id: 'Bar Lontano', da: po }],
        ripetuti: [{ momento: 'g1-pomeriggio', place_id: 'Museo Due', da: pr }],
    };

    it('controllo delle distanze', () => {
        expect(travelMinutes(po, ap)).toBeGreaterThan(MAX_WALK_MINUTES);
        expect(travelMinutes(m, pr)).toBeLessThanOrEqual(MAX_WALK_MINUTES);
    });

    it('ordine: aperitivo (oltre il tetto) → pomeriggio (ripetuta) → pranzo (lontano ma ora entro il tetto)', () => {
        const q = searchQueue(plan, report);
        expect(q.map(x => [x.momento, x.gravita])).toEqual([['g1-aperitivo', 1], ['g1-pomeriggio', 2], ['g1-pranzo', 3]]);
    });

    it('con il tetto di 2 ricerche, la ripetizione passa prima del lontano entro il tetto', () => {
        const due = searchQueue(plan, report).slice(0, 2).map(x => x.momento);
        expect(due).toEqual(['g1-aperitivo', 'g1-pomeriggio']);
    });

    it('una tappa che non e\' piu\' nel giro non chiede ricerche', () => {
        const q = searchQueue(plan, { lontani: [{ momento: 'g1-pranzo', place_id: 'Sparita', da: m }], ripetuti: [] });
        expect(q).toEqual([]);
    });

    it('repairMomentSelection espone la coda nel report', () => {
        const pool = [m, pr, po, ap, ce];
        const { report: r } = repairMomentSelection({ moments: g, buckets: bucketCandidates(g, pool), aiStops: [], pool });
        expect(Array.isArray(r.ricercheDaFare)).toBe(true);
        expect(r.ricercheDaFare.every(x => [1, 2, 3].includes(x.gravita))).toBe(true);
    });
});

// ─── 3. Ripetizione inevitabile o evitabile, con la prova ───────────────────
describe('C5c — una ripetizione dichiara se era evitabile, con le alternative del pool', () => {
    const g = giorno([['mattina', 2], ['pomeriggio']]);
    const torre = p('Museo Torre', 37.7843, 14.5992, ['museum']);
    const piazza = p('Piazza Matteotti', 37.7814, 14.5968);
    const museo2 = p('Museo Capa', 37.7851, 14.6005, ['museum']);

    it('nel pool del momento non c\'e\' nessuna famiglia nuova entro 25 minuti: inevitabile, con la piu\' vicina', () => {
        // una chiesa a ~4,5 km: oltre i 25 minuti
        const lontana = p('Chiesa Lontana', 37.8250, 14.5992, ['church']);
        const pool = [piazza, torre, museo2, lontana];
        const { plan, report } = repairMomentSelection({
            moments: g, buckets: bucketCandidates(g, pool), pool,
            aiStops: [{ place_id: 'Piazza Matteotti', moment: 'g1-mattina' }, { place_id: 'Museo Torre', moment: 'g1-mattina' }, { place_id: 'Museo Capa', moment: 'g1-pomeriggio' }],
        });
        const capa = seq(plan).find(s => s.candidate.place_id === 'Museo Capa');
        expect(capa.trace).toMatchObject({ ripiego: 'famiglia', varieta: { esito: 'inevitabile' } });
        expect(capa.trace.varieta.piuVicina).toMatchObject({ nome: 'Chiesa Lontana', famiglia: 'chiesa' });
        expect(capa.trace.varieta.piuVicina.minuti).toBeGreaterThan(25);
        expect(capa.trace.motivo).toMatch(/inevitabile: nei momenti delle tappe museo \(\d+ candidati\) nessuna alternativa libera che la tolga entro 25 min; la piu' vicina: "Chiesa Lontana" \(chiesa, (mattina|pomeriggio)\) a \d+ min/);
        expect(report.ripetuti.find(x => x.place_id === 'Museo Capa')).toMatchObject({ evitabile: false });
    });

    it('con un\'alternativa libera entro 25 minuti nessuna ripetizione resta (e se restasse sarebbe "evitabile")', () => {
        const chiesa = p('Chiesa Vicina', 37.7860, 14.6010, ['church']);
        const pool = [piazza, torre, museo2, chiesa];
        const { plan } = repairMomentSelection({
            moments: g, buckets: bucketCandidates(g, pool), pool,
            aiStops: [{ place_id: 'Piazza Matteotti', moment: 'g1-mattina' }, { place_id: 'Museo Torre', moment: 'g1-mattina' }, { place_id: 'Museo Capa', moment: 'g1-pomeriggio' }],
        });
        const fams = seq(plan).map(s => s.trace.famiglia).filter(Boolean);
        expect(new Set(fams).size).toBe(fams.length);
        expect(seq(plan).some(s => s.trace.varieta)).toBe(false);
    });
});

// ─── La prova guarda TUTTE le tappe della famiglia (caso Napoli) ────────────
describe('C5c — la ripetizione si puo\' togliere anche cambiando la prima tappa della famiglia', () => {
    // pomeriggio: un belvedere; aperitivo: solo belvederi. All'aperitivo non c'e'
    // alternativa, al pomeriggio si': una chiesa a 22 minuti dal museo della mattina
    // (famiglia nuova entro i 25 di C1b, ma oltre il tetto di 20 della rifinitura).
    const g = giorno([['mattina'], ['pomeriggio'], ['aperitivo']]);
    const museo = p('Museo', 40.8400, 14.2500, ['museum']);
    const belvA = p('Belvedere Uno', 40.8420, 14.2500);
    const belvB = p('Belvedere Due', 40.8430, 14.2510);
    const chiesa = p('Chiesa Lontana', 40.8400, 14.2715, ['church']);

    it('controllo: la chiesa e\' fra 20 e 25 minuti dal museo', () => {
        expect(travelMinutes(museo, chiesa)).toBeGreaterThan(20);
        expect(travelMinutes(museo, chiesa)).toBeLessThanOrEqual(25);
    });

    it('evitabile, con l\'alternativa del pomeriggio e la regola che ha fermato lo scambio', () => {
        const pool = [museo, belvA, belvB, chiesa];
        const { plan } = repairMomentSelection({
            moments: g, buckets: bucketCandidates(g, pool), pool,
            aiStops: [{ place_id: 'Museo', moment: 'g1-mattina' }, { place_id: 'Belvedere Uno', moment: 'g1-pomeriggio' }, { place_id: 'Belvedere Due', moment: 'g1-aperitivo' }],
        });
        const ripetuta = seq(plan).find(s => s.trace.varieta);
        expect(ripetuta.trace.varieta.esito).toBe('evitabile');
        expect(ripetuta.trace.varieta.alternative).toEqual([
            expect.objectContaining({ nome: 'Chiesa Lontana', famiglia: 'chiesa', momento: 'pomeriggio', usata: false, bloccata: ['il tetto'] }),
        ]);
        expect(ripetuta.trace.motivo).toMatch(/evitabile: "Chiesa Lontana" \(pomeriggio, 2\d min, bloccata da il tetto\)/);
    });
});
