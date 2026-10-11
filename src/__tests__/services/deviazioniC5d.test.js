// C5d — il motore misura la deviazione come il banco: A→B→C con le tappe
// vere vicine, non verso il pasto dopo.
import { describe, it, expect } from 'vitest';
import {
    flattenSkeleton, bucketCandidates, repairMomentSelection, ROUTE_DEVIATION_MINUTES, ROUTE_DEVIATION_MAX_MINUTES,
} from '../../services/momentSelection';
import { stopDetours } from '../../lib/routeShape';
import config from '../../../scripts/banco/banco.config.json';

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
const devs = (plan) => stopDetours(seq(plan).map(s => ({ ...s.candidate, moment: s.trace?.moment })));

describe('C5d — soglie del motore = soglie della voce 12 del banco', () => {
    it('5 e 10 minuti, come banco.config.json', () => {
        expect(ROUTE_DEVIATION_MINUTES).toBe(config.soglie.deviazioneMinuti);
        expect(ROUTE_DEVIATION_MAX_MINUTES).toBe(config.soglie.deviazioneMaxMinuti);
    });
});

// Il caso di Roma (C5b): la prima delle due tappe del pomeriggio va a ovest e
// la seconda e' a est. Verso la cena (a nord) la deviazione sembra piccola;
// fra le due tappe vere vicine e' uno zig-zag.
describe('C5d — la prima di due tappe al pomeriggio si misura contro la seconda, non contro la cena', () => {
    const g = giorno([['mattina'], ['pomeriggio', 2], ['cena']]);
    const museo = p('Museo', 41.9000, 12.4800, ['museum']);
    const ovest = p('Palazzo Ovest', 41.9035, 12.4720);              // scelto dal modello
    const est = p('Chiesa Est', 41.9040, 12.4880, ['church']);       // seconda tappa del modello
    // un giardino: famiglia "verde", nuova (una galleria sarebbe "museo", come il
    // Museo della mattina, e la varieta' la scarterebbe prima della forma)
    const sullaLinea = p('Giardino in Mezzo', 41.9025, 12.4840, ['park'], 4.4);
    const cena = p('Trattoria Nord', 41.9090, 12.4800, ['restaurant']);
    const pool = [museo, ovest, est, sullaLinea, cena];
    const scelta = [['Museo', 'mattina'], ['Palazzo Ovest', 'pomeriggio'], ['Chiesa Est', 'pomeriggio'], ['Trattoria Nord', 'cena']]
        .map(([place_id, m]) => ({ place_id, moment: `g1-${m}` }));

    it('controllo: con la scelta del modello la voce 12 vede uno zig-zag oltre i 10 minuti', () => {
        const giro = [museo, ovest, est, cena];
        expect(Math.max(...stopDetours(giro).map(d => d.minuti))).toBeGreaterThan(10);
    });

    it('la scelta del modello che fa lo zig-zag e\' scartata, con il motivo misurato verso la tappa vera dopo', () => {
        // altri due posti sulla linea, perche' il pomeriggio abbia di che riempirsi
        const linea2 = p('Chiesa in Linea', 41.9045, 12.4800, ['church'], 4.3);
        const pl = [...pool, linea2];
        const { plan, report } = repairMomentSelection({ moments: g, buckets: bucketCandidates(g, pl), aiStops: scelta, pool: pl });
        expect(report.scartate).toEqual(expect.arrayContaining([expect.objectContaining({
            place_id: 'Palazzo Ovest', motivo: expect.stringMatching(/^fuori strada: \d+ min di giro verso "Chiesa Est"$/),
        })]));
        expect(seq(plan).map(s => s.candidate.place_id)).not.toContain('Palazzo Ovest');
        const d = devs(plan).map(x => x.minuti);
        expect(d.filter(x => x > 10)).toEqual([]);
    });
});

describe('C5d — una deviazione che resta dichiara la causa, con la misura del banco', () => {
    const g = giorno([['mattina'], ['pomeriggio'], ['aperitivo'], ['cena']]);
    const museo = p('Museo', 41.9000, 12.4800, ['museum']);
    const chiesa = p('Chiesa', 41.9030, 12.4800, ['church']);
    const cena = p('Osteria', 41.9065, 12.4800, ['restaurant']);
    // aperitivo: un solo belvedere, 1 km fuori linea (nessuna alternativa = pool)
    const belvedere = p('Belvedere Fuori', 41.9050, 12.4920);

    it('pool: nessuna alternativa nel momento; la traccia ha i minuti della misura del banco', () => {
        const pool = [museo, chiesa, belvedere, cena];
        const { plan, report } = repairMomentSelection({ moments: g, buckets: bucketCandidates(g, pool), aiStops: [], pool });
        const b = seq(plan).find(s => s.candidate.place_id === 'Belvedere Fuori');
        const banco = stopDetours(seq(plan).map(s => s.candidate)).find(d => d.titolo === 'Belvedere Fuori');
        expect(b.trace.deviazioneProva).toMatchObject({ esito: 'pool', minuti: Math.round(banco.minuti * 10) / 10, alternative: [] });
        expect(report.deviazioni).toEqual(expect.arrayContaining([expect.objectContaining({ momento: 'g1-aperitivo', place_id: 'Belvedere Fuori', esito: 'pool' })]));
    });

    it('composizione: c\'era un\'alternativa sotto 5 min, ma ripeteva una famiglia: la varieta\' vince e la prova lo dice', () => {
        // mattina: un belvedere; aperitivo: un bar fuori linea, oppure una
        // terrazza sulla linea che ripeterebbe il panorama
        const belvMattina = p('Belvedere Mattina', 41.9000, 12.4800);
        const barFuori = p('Bar Fuori', 41.9050, 12.4920, ['bar']);
        // solo all'aperitivo (un bar con terrazza): famiglia "panorama" dal nome
        const terrazza = p('Terrazza in Linea', 41.9048, 12.4802, ['bar']);
        const pool = [belvMattina, chiesa, barFuori, terrazza, cena];
        const { plan } = repairMomentSelection({ moments: g, buckets: bucketCandidates(g, pool), aiStops: [], pool });
        const bar = seq(plan).find(s => s.candidate.place_id === 'Bar Fuori');
        expect(bar).toBeTruthy();
        expect(bar.trace.deviazioneProva.esito).toBe('composizione');
        expect(bar.trace.deviazioneProva.alternative[0]).toMatchObject({ nome: 'Terrazza in Linea', famiglia: 'panorama', bloccata: ['una famiglia ripetuta'] });
        expect(bar.trace.deviazioneProva.alternative[0].deviazione).toBeLessThanOrEqual(5);
    });
});
