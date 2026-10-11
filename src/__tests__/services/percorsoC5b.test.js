// C5b — prima tappa del giorno, ripetizioni dichiarate, incroci spiegati.
import { describe, it, expect } from 'vitest';
import {
    flattenSkeleton, bucketCandidates, repairMomentSelection, polishRoute, groupCenter, MAX_WALK_MINUTES,
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
const RIST = ['restaurant', 'food'];
const seq = (plan) => plan.flatMap(x => x.stops);

// ─── Prima tappa del giorno ──────────────────────────────────────────────────
describe('C5b — la prima tappa si misura dal centro del gruppo (o dalla partenza)', () => {
    // Il gruppo: pranzo, pomeriggio, aperitivo, cena intorno a (41.900, 12.480).
    const pranzo = p('Trattoria del Gruppo', 41.9005, 12.4800, RIST);
    // un parco: sta solo nel pomeriggio (natura), non fra i candidati della mattina
    const chiesa = p('Giardino del Gruppo', 41.9015, 12.4810, ['park']);
    const bar = p('Bar del Gruppo', 41.9000, 12.4820, ['bar']);
    const cena = p('Osteria del Gruppo', 41.8995, 12.4810, RIST);
    const g = giorno([['mattina'], ['pranzo'], ['pomeriggio'], ['aperitivo'], ['cena']]);
    // Il modello apre la giornata 2,4 km a nord: dal resto del giro ~32 minuti.
    const lontana = p('Belvedere Lontano', 41.9220, 12.4800);
    const vicina = p('Museo Vicino', 41.9030, 12.4795, ['museum'], 4.2);
    const scelta = [['Belvedere Lontano', 'mattina'], ['Trattoria del Gruppo', 'pranzo'], ['Giardino del Gruppo', 'pomeriggio'], ['Bar del Gruppo', 'aperitivo'], ['Osteria del Gruppo', 'cena']]
        .map(([place_id, m]) => ({ place_id, moment: `g1-${m}` }));

    it('controllo: la tappa del modello e\' oltre i 20 minuti dal centro del gruppo, quella del pool dentro', () => {
        const centro = groupCenter([pranzo, chiesa, bar, cena]);
        expect(travelMinutes(centro, lontana)).toBeGreaterThan(MAX_WALK_MINUTES);
        expect(travelMinutes(centro, vicina)).toBeLessThanOrEqual(MAX_WALK_MINUTES);
        // il tratto prima tappa → pranzo da solo e' gia' oltre il tetto: C1 non lo misurava
        expect(travelMinutes(lontana, pranzo)).toBeGreaterThan(MAX_WALK_MINUTES);
    });

    it('fuori dal gruppo e c\'e\' un\'alternativa del pool → entra l\'alternativa, con il motivo', () => {
        const pool = [lontana, vicina, pranzo, chiesa, bar, cena];
        const { plan, report } = repairMomentSelection({ moments: g, buckets: bucketCandidates(g, pool), aiStops: scelta, pool });
        expect(seq(plan)[0].candidate.place_id).toBe('Museo Vicino');
        expect(report.scartate).toEqual(expect.arrayContaining([expect.objectContaining({
            place_id: 'Belvedere Lontano', motivo: expect.stringMatching(/^prima tappa fuori dal gruppo: \d+ min dal centro del gruppo \(tetto 20\)$/),
        })]));
        expect(seq(plan)[0].trace.daPartenza).toMatchObject({ da: 'centro del gruppo' });
        expect(seq(plan)[0].trace.daPartenza.minuti).toBeLessThanOrEqual(MAX_WALK_MINUTES);
    });

    it('fuori dal gruppo e nessuna alternativa: la tappa resta (mai un buco) e il tracciato dice perche\'', () => {
        const pool = [lontana, pranzo, chiesa, bar, cena];
        const { plan, report } = repairMomentSelection({ moments: g, buckets: bucketCandidates(g, pool), aiStops: scelta, pool });
        const prima = seq(plan)[0];
        expect(prima.candidate.place_id).toBe('Belvedere Lontano');
        expect(plan).toHaveLength(5);
        expect(prima.trace).toMatchObject({ scelta: 'ripiego', ripiego: 'partenza' });
        expect(prima.trace.motivo).toMatch(/^prima tappa a \d+ min dal centro del gruppo: nessuna alternativa del pool entro 20 min$/);
        // il ripiego della partenza non va fra i "lontani" (non spende una
        // ricerca mirata); il pranzo a 32 minuti dal belvedere si', per C1
        expect(report.lontani.map(x => x.momento)).toEqual(['g1-pranzo']);
    });

    it('con un punto di partenza vero si misura da li\': il motivo lo nomina, e la tappa scelta e\' entro il tetto dalla partenza', () => {
        const pool = [lontana, vicina, pranzo, chiesa, bar, cena];
        const partenza = { latitude: 41.9040, longitude: 12.4800, name: 'Hotel' };
        const { plan, report } = repairMomentSelection({ moments: g, buckets: bucketCandidates(g, pool), aiStops: scelta, pool, startPoint: partenza });
        expect(seq(plan)[0].candidate.place_id).toBe('Museo Vicino');
        expect(seq(plan)[0].trace.daPartenza).toMatchObject({ da: 'punto di partenza' });
        expect(seq(plan)[0].trace.daPartenza.minuti).toBe(travelMinutes(partenza, vicina));
        expect(report.scartate.find(x => x.place_id === 'Belvedere Lontano').motivo).toMatch(/dal punto di partenza/);
    });

    it('un gruppo sono almeno due tappe; il centro e\' la mediana, non la media', () => {
        expect(groupCenter([pranzo])).toBe(null);
        // una tappa sola a 15 km non trascina il centro
        const c = groupCenter([pranzo, chiesa, bar, p('Lontanissima', 42.035, 12.48)]);
        expect(travelMinutes(c, chiesa)).toBeLessThan(5);
    });
});

// ─── Ripetizioni: la varieta' vince sulla forma ─────────────────────────────
// Causa trovata (Firenze, b-roma-A): la rifinitura C5 scambiava una piazza
// ripetuta con un'altra piazza piu' comoda, dava alla nuova la traccia
// "riparazione" (la ripetizione spariva) e toglieva dal report le ripetizioni
// di TUTTO il momento: la ricerca mirata C1b non partiva piu'.
describe('C5b — la varieta\' vince sulla rifinitura del percorso', () => {
    const g = giorno([['mattina'], ['pomeriggio', 2], ['aperitivo']]);
    const piazzaA = p('Piazza Uno', 41.900, 12.480);
    const piazzaB = p('Piazza Due', 41.906, 12.480);
    const piazzaC = p('Piazza Tre', 41.903, 12.483);
    const piazzaD = p('Piazza Quattro', 41.9025, 12.4805); // piu' sulla strada di B
    const bar = p('Bar Ultimo', 41.904, 12.481, ['bar']);
    const rip = () => ({ scelta: 'ripiego', ripiego: 'famiglia', famiglia: 'piazza', motivo: 'nessuna famiglia nuova vicina: piazza ripetuta' });
    const piano = () => [
        { moment: g[0], stops: [{ candidate: piazzaA, source: 'modello', trace: { scelta: 'modello', famiglia: 'piazza' } }] },
        { moment: g[1], stops: [
            { candidate: piazzaB, source: 'riparata', trace: rip() },
            { candidate: piazzaC, source: 'riparata', trace: rip() },
        ] },
        { moment: g[2], stops: [{ candidate: bar, source: 'riparata', trace: { scelta: 'riparazione' } }] },
    ];
    const report = () => ({
        riempite: [], ripieghi: [{ place_id: 'Piazza Due' }, { place_id: 'Piazza Tre' }],
        ripetuti: [{ momento: 'g1-pomeriggio', place_id: 'Piazza Due', da: piazzaA }, { momento: 'g1-pomeriggio', place_id: 'Piazza Tre', da: piazzaB }],
    });

    it('piazza al posto di piazza: la ripetizione resta dichiarata (traccia e report), e quella dell\'altra tappa non sparisce', () => {
        const pool = [piazzaA, piazzaB, piazzaC, piazzaD, bar];
        const r = report();
        const out = polishRoute(piano(), { buckets: bucketCandidates(g, pool), pool }, r);
        const tappe = seq(out);
        expect(tappe.map(s => s.candidate.place_id)).toContain('Piazza Quattro');
        // ogni piazza dopo la prima e' un ripiego "famiglia" nella traccia
        const piazze = tappe.filter(s => /^Piazza/.test(s.candidate.name));
        expect(piazze.slice(1).every(s => s.trace.ripiego === 'famiglia')).toBe(true);
        expect(piazze[0].trace.ripiego).toBeUndefined();
        // il report porta una voce per ogni ripetizione rimasta: C1b le vede tutte
        const ripetute = piazze.slice(1).map(s => s.candidate.place_id).sort();
        expect(r.ripetuti.map(x => x.place_id).sort()).toEqual(ripetute);
        expect(r.ripetuti.every(x => x.da)).toBe(true);
    });

    it('nel giro intero: se c\'e\' una famiglia nuova nel pool vince lei, anche se una piazza sarebbe piu\' sulla strada', () => {
        const chiesa = p('Chiesa Nuova', 41.9045, 12.4840, ['church']);
        const gg = giorno([['mattina'], ['pomeriggio'], ['aperitivo']]);
        const pool = [piazzaA, piazzaD, chiesa, bar];
        const { plan } = repairMomentSelection({
            moments: gg, buckets: bucketCandidates(gg, pool), pool,
            aiStops: [{ place_id: 'Piazza Uno', moment: 'g1-mattina' }, { place_id: 'Piazza Quattro', moment: 'g1-pomeriggio' }],
        });
        const tappe = seq(plan).map(s => s.candidate.place_id);
        expect(tappe).toContain('Chiesa Nuova');
        expect(tappe.filter(x => x.startsWith('Piazza'))).toHaveLength(1);
        expect(seq(plan).some(s => s.trace.ripiego)).toBe(false);
    });
});

// ─── Un incrocio che resta dice perche' ─────────────────────────────────────
describe('C5b — incroci rimasti: il motivo nel tracciato', () => {
    it('nessun candidato dello stesso momento lo toglie: lo scrive nel report e nelle tappe dei due tratti', () => {
        const g = giorno([['mattina'], ['pranzo'], ['pomeriggio'], ['cena']]);
        // a → c → b → d: le due diagonali di un quadrato, una tappa per momento, nessuna alternativa
        const a = p('A', 41.900, 12.480, ['museum']);
        const c = p('C', 41.903, 12.484, RIST);
        const b = p('B', 41.900, 12.484, ['church']);
        const d = p('D', 41.903, 12.480, RIST);
        const pool = [a, b, c, d];
        const { plan, report } = repairMomentSelection({
            moments: g, buckets: bucketCandidates(g, pool), pool,
            aiStops: [['A', 'mattina'], ['C', 'pranzo'], ['B', 'pomeriggio'], ['D', 'cena']].map(([place_id, m]) => ({ place_id, moment: `g1-${m}` })),
        });
        expect(report.incrociRimasti).toEqual([{ giorno: 1, incroci: 1, motivo: 'incrocio rimasto: nessun candidato dello stesso momento lo toglie' }]);
        const segnate = seq(plan).filter(s => s.trace.incrocio);
        expect(segnate.map(s => s.candidate.place_id)).toEqual(['A', 'B']);
    });
});
