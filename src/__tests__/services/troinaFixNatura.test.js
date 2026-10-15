// TROINA-FIX — la natura scelta non si perde per strada.
// Il giro pagato della guardia (15/10, 12:05): nel Quiz Natura di Troina il modello sceglie Monte Muganà per il
// pomeriggio, poi la rifinitura del percorso (polishRoute, C5) lo cambia con Piazza Conte Ruggero, «sulla strada»
// (4 minuti invece di 16), e il tour di natura esce senza natura. Con una richiesta di natura una tappa di natura
// non si cambia per strada con una che non lo e'; con un'altra tappa di natura si'. Coordinate approssimate.
import { describe, it, expect } from 'vitest';
import { flattenSkeleton, bucketCandidates, polishRoute } from '../../services/momentSelection';
import { isNaturaOPanorama } from '../../lib/borgoConfini';

const giorno = flattenSkeleton({ days: [{ moments: [
    { key: 'pranzo', label: 'pranzo', stops: 1, categories: ['cibo'],
        start: new Date('2026-10-15T12:35:00+02:00'), end: new Date('2026-10-15T14:30:00+02:00') },
    { key: 'pomeriggio', label: 'pomeriggio', stops: 1, categories: ['cultura', 'natura', 'passeggiata'],
        start: new Date('2026-10-15T14:30:00+02:00'), end: new Date('2026-10-15T15:35:00+02:00') },
] }] });
const p = (id, name, lat, lng, types, primaryType) => ({ place_id: id, name, latitude: lat, longitude: lng, types, primaryType, rating: 4.6, user_ratings_total: 40 });

const PESCHERIA = p('pesch', "A'Pescheria", 37.78504, 14.59735, ['restaurant', 'food'], 'restaurant');
const MUGANA = p('mugana', 'Monte Muganà', 37.7960, 14.5985, ['scenic_spot', 'point_of_interest', 'establishment'], 'scenic_spot');
const PIAZZA = p('piazza', 'Piazza Conte Ruggero', 37.78525, 14.60076, ['route']);
const BOSCO = p('bosco', 'Bosco di Troina', 37.7880, 14.5990, ['park', 'point_of_interest'], 'park');

const piano = () => [
    { moment: giorno[0], stops: [{ candidate: PESCHERIA }] },
    { moment: giorno[1], stops: [{ candidate: MUGANA }] },
];
const pomeriggio = (out) => out.find(x => x.moment.key === 'pomeriggio').stops.map(s => s.candidate.place_id);
const rifinisci = (pool, extra = {}) => polishRoute(piano(), { buckets: bucketCandidates(giorno, pool), pool, ...extra }, { ripieghi: [], riempite: [] });

describe('TROINA-FIX — la natura scelta non si perde per strada', () => {
    it('controllo: Monte Muganà e\' natura, la piazza no', () => {
        expect(isNaturaOPanorama(MUGANA)).toBe(true);
        expect(isNaturaOPanorama(PIAZZA)).toBe(false);
    });

    it('senza una richiesta di natura la rifinitura cambia Monte Muganà con la piazza sulla strada (com\'era)', () => {
        expect(pomeriggio(rifinisci([PESCHERIA, MUGANA, PIAZZA]))).toEqual(['piazza']);
    });

    it('con una richiesta di natura Monte Muganà resta nel giro', () => {
        expect(pomeriggio(rifinisci([PESCHERIA, MUGANA, PIAZZA], { dellaRichiesta: isNaturaOPanorama }))).toEqual(['mugana']);
    });

    it('con una richiesta di natura lo scambio con un\'altra tappa di natura piu\' vicina resta libero', () => {
        expect(pomeriggio(rifinisci([PESCHERIA, MUGANA, PIAZZA, BOSCO], { dellaRichiesta: isNaturaOPanorama }))).toEqual(['bosco']);
    });
});
