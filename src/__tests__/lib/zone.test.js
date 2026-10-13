// C7 — niente zone come tappe.
import { describe, it, expect } from 'vitest';
import { isZone, zoneReason, isAreaName } from '../../lib/zone';

describe('isAreaName — il nome e\' solo il nome di un\'area', () => {
    it('"Centro Storico Catania" e le sue forme', () => {
        for (const n of ['Centro Storico Catania', 'Centro Storico di Catania', 'Catania Centro Storico', 'Centro Storico', 'Il Centro Storico di Catania', 'Centro Catania', 'Città vecchia', 'Zona Centro Catania', 'Old Town Catania']) {
            expect(isAreaName(n, 'Catania'), n).toBe(true);
        }
    });
    it('un posto con un nome proprio non e\' un\'area', () => {
        for (const n of ['Museo del Centro Storico', 'Centro Culturale Le Ciminiere', 'Quartiere Coppedè', 'Pescheria di Catania', 'Via dei Crociferi', 'Bar Centro Storico Cafè']) {
            expect(isAreaName(n, 'Catania'), n).toBe(false);
        }
    });
});

describe('isZone — tipi e nomi da zona', () => {
    it('il caso reale: "Centro Storico Catania" registrato come tourist_attraction', () => {
        const c = { name: 'Centro Storico Catania', types: ['tourist_attraction', 'point_of_interest', 'establishment'], primaryType: 'tourist_attraction' };
        expect(isZone(c, 'Catania')).toBe(true);
        expect(zoneReason(c, 'Catania')).toMatch(/nome da area/);
    });
    it('tipo principale o type geografico: locality, sublocality, neighborhood, political, route', () => {
        for (const t of ['locality', 'sublocality', 'sublocality_level_1', 'neighborhood', 'political', 'route', 'administrative_area_level_3']) {
            expect(isZone({ name: 'Vecchio Borgo', primaryType: t, types: [t] }), t).toBe(true);
        }
        expect(isZone({ name: 'Zona Alfa', types: ['point_of_interest', 'neighborhood'] })).toBe(true);
    });
    it('una via con un tipo di luogo vero (una piazza, un monumento) resta un posto', () => {
        expect(isZone({ name: 'Via dei Crociferi', types: ['route', 'tourist_attraction', 'point_of_interest'], primaryType: 'tourist_attraction' }, 'Catania')).toBe(false);
    });
    it('i posti veri non sono zone', () => {
        for (const c of [
            { name: 'Pescheria di Catania', primaryType: 'market', types: ['market', 'point_of_interest'] },
            { name: 'Palazzo Biscari', primaryType: 'tourist_attraction', types: ['tourist_attraction'] },
            { name: 'Trattoria Sorano', primaryType: 'italian_restaurant', types: ['restaurant'] },
        ]) expect(isZone(c, 'Catania'), c.name).toBe(false);
    });
});
