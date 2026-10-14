// C10b — un'ancora scelta resta nel tour, salvo una regola dura (orari, cammino, pasti) scritta nel tracciato.
//
// Il giro C10 (16/10) ne perdeva tre: Teatro Massimo Bellini a Catania (seminato nella mattina, tolto al secondo giro del
// riparatore perche' «fuori strada» verso il pranzo), Piazza Navona a Roma e il Duomo a Napoli (scelti, poi cambiati dalla
// rifinitura per togliere una famiglia ripetuta). Strada, deviazione e varieta' sono preferenze di forma, non regole dure.
import { describe, it, expect } from 'vitest';
import { repairMomentSelection, MAX_WALK_MINUTES } from '../../services/momentSelection';

const LAT = 41.9, LNG = 12.47;
const KM_LAT = 1 / 111, KM_LNG = 1 / 82.8; // gradi per km a 41,9° nord
const posto = (name, kmN, kmE, extra = {}) => ({
    place_id: `pid-${name.replace(/\W+/g, '-').toLowerCase()}`, name, title: name,
    latitude: LAT + kmN * KM_LAT, longitude: LNG + kmE * KM_LNG, lat: LAT + kmN * KM_LAT, lng: LNG + kmE * KM_LNG,
    rating: 4.5, user_ratings_total: 400, types: ['tourist_attraction', 'point_of_interest'], ...extra,
});
const ancora = (c) => ({ ...c, _citta: { tipo: 'essenziale', momento: 'mattina', ancora: true } });
const M = (key, stops) => ({ id: `g1-${key}`, key, label: key, dayIndex: 0, stops });
const PARTENZA = { latitude: LAT, longitude: LNG, name: 'partenza' };
const nomi = (plan) => plan.flatMap(p => p.stops.map(s => s.candidate.name));

describe('C10b — un\'ancora scelta resta', () => {
    it('la seconda ancora della mattina non cade «fuori strada» verso il pranzo (il caso del Teatro Massimo Bellini)', () => {
        const castello = ancora(posto('Castello Ursino', 0.2, 0, { types: ['museum', 'tourist_attraction'], primaryType: 'museum' }));
        // a 1,2 km (16 min a piedi, dentro il tetto) ma dalla parte opposta al pranzo: il giro verso il pranzo si allunga
        const teatro = ancora(posto('Teatro Massimo Bellini', 1.2, 0.3, { types: ['performing_arts_theater', 'tourist_attraction'], primaryType: 'performing_arts_theater' }));
        const piazzetta = posto('Piazzetta Vicina', 0.1, 0.15, { types: ['tourist_attraction'], primaryType: 'plaza' });
        const pranzo = posto('Trattoria Sotto', -0.2, 0, { types: ['restaurant', 'food'], primaryType: 'italian_restaurant' });
        const moments = [M('mattina', 2), M('pranzo', 1)];
        const buckets = new Map([['g1-mattina', [castello, teatro, piazzetta]], ['g1-pranzo', [pranzo]]]);
        const aiStops = [{ place_id: castello.place_id, moment: 'g1-mattina' }, { place_id: teatro.place_id, moment: 'g1-mattina' }, { place_id: pranzo.place_id, moment: 'g1-pranzo' }];
        const { plan, report } = repairMomentSelection({ moments, buckets, aiStops, pool: [castello, teatro, piazzetta, pranzo], startPoint: PARTENZA });
        expect(nomi(plan)).toContain('Teatro Massimo Bellini');
        expect(nomi(plan)).toContain('Castello Ursino');
        expect(report.ancoreTolte).toEqual([]);
    });

    it('la rifinitura non cambia un\'ancora per togliere una famiglia ripetuta (il caso di Piazza Navona)', () => {
        const navona = ancora(posto('Piazza Navona', 0.3, 0, { types: ['tourist_attraction'], primaryType: 'plaza' }));
        const museo = posto('Museo Vicino', 0.35, 0.05, { types: ['museum', 'tourist_attraction'], primaryType: 'museum' });
        const pranzo = posto('Osteria Centro', 0.5, 0, { types: ['restaurant', 'food'], primaryType: 'italian_restaurant' });
        // il pomeriggio ha solo un'altra piazza: la famiglia «piazza» si ripete per forza, a meno di togliere Navona
        const campo = posto('Piazza Campo', 0.7, 0.1, { types: ['tourist_attraction'], primaryType: 'plaza' });
        const moments = [M('mattina', 1), M('pranzo', 1), M('pomeriggio', 1)];
        const buckets = new Map([['g1-mattina', [navona, museo]], ['g1-pranzo', [pranzo]], ['g1-pomeriggio', [campo]]]);
        const aiStops = [{ place_id: navona.place_id, moment: 'g1-mattina' }, { place_id: pranzo.place_id, moment: 'g1-pranzo' }, { place_id: campo.place_id, moment: 'g1-pomeriggio' }];
        const { plan, report } = repairMomentSelection({ moments, buckets, aiStops, pool: [navona, museo, pranzo, campo], startPoint: PARTENZA });
        expect(nomi(plan)).toContain('Piazza Navona');
        expect(report.ancoreTolte).toEqual([]);
        // la ripetizione resta dichiarata, come sempre (la varieta' non e' una regola dura per un'ancora)
        expect(report.ripetuti.map(x => x.place_id)).toContain(campo.place_id);
    });

    it('la regola dura del cammino toglie l\'ancora, e il tracciato lo scrive', () => {
        // a 3 km dalla tappa prima: 40 min a piedi, oltre il tetto (20)
        const vicino = posto('Chiesa Vicina', 0.1, 0, { types: ['church', 'place_of_worship'], primaryType: 'church' });
        const lontana = ancora(posto('Musei Lontani', 3.1, 0, { types: ['museum', 'tourist_attraction'], primaryType: 'museum' }));
        const altro = posto('Giardino Vicino', 0.2, 0.1, { types: ['park'], primaryType: 'park' });
        const moments = [M('mattina', 2)];
        const buckets = new Map([['g1-mattina', [vicino, lontana, altro]]]);
        const aiStops = [{ place_id: vicino.place_id, moment: 'g1-mattina' }, { place_id: lontana.place_id, moment: 'g1-mattina' }];
        const { plan, report } = repairMomentSelection({ moments, buckets, aiStops, pool: [vicino, lontana, altro], startPoint: PARTENZA });
        expect(nomi(plan)).not.toContain('Musei Lontani');
        expect(report.ancoreTolte.length).toBeGreaterThan(0);
        expect(report.ancoreTolte[0]).toMatchObject({ nome: 'Musei Lontani' });
        expect(report.ancoreTolte[0].motivo).toMatch(/^regola dura: .*tetto/);
        expect(MAX_WALK_MINUTES).toBe(20);
    });
});
