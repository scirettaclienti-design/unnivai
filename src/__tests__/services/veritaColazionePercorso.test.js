// VERITA-TESTI punto 5 — «domani un giorno a Catania», senza orario: il giro del mattino parte dalla colazione.
// Causa trovata dal vivo (2 giri su 3): il ritocco di percorso (polishRoute, C5) scambiava la colazione, prima tappa
// della mattina, con una visita «sulla strada» (Caffè Puglisi → Castello Ursino). Il caso esatto: la colazione sta
// più lontana dalle visite di un'altra tappa del pool, e lo scambio accorcia il cammino.
import { describe, it, expect } from 'vitest';
import { flattenSkeleton, bucketCandidates, polishRoute } from '../../services/momentSelection';
import { buildDaySkeleton } from '../../lib/daySkeleton';
import { resolveTourWindow } from '../../lib/tourWindow';
import { isBreakfastPlace } from '../../lib/mealRules';

const p = (id, lat, lng, types = ['tourist_attraction'], rating = 4.5) => ({ place_id: id, name: id, latitude: lat, longitude: lng, types, rating, user_ratings_total: 500 });
const seq = (plan) => plan.flatMap(x => x.stops);

describe('VERITA-TESTI 5 — il ritocco di percorso non cambia la colazione', () => {
    // «domani un giorno a Catania», chiesto alle 18:30 di sabato, senza orario: parte alle 9:30 e ha la colazione.
    const sk = buildDaySkeleton({
        window: resolveTourWindow({ text: 'domani un giorno a Catania', requestTime: new Date('2026-10-24T18:30:00+02:00'), pathType: 'custom', duration: '' }),
        text: 'domani un giorno a Catania', colazioneAuto: true,
    });
    const g = flattenSkeleton(sk);
    const caffe = p('Caffè Lontano', 41.9120, 12.4800, ['cafe', 'food']);
    const museo = p('Museo A', 41.9000, 12.4800, ['museum']);
    const chiesa = p('Chiesa B', 41.9008, 12.4810, ['church']);
    const castello = p('Castello Vicino', 41.9004, 12.4805, ['tourist_attraction']);
    const pranzo = p('Trattoria', 41.9005, 12.4815, ['restaurant', 'food']);

    it('controllo: la mattina del caso ha la colazione e il caffè è un posto da colazione', () => {
        expect(g.find(m => m.key === 'mattina').colazione).toBe(true);
        expect(isBreakfastPlace(caffe)).toBe(true);
        expect(isBreakfastPlace(castello)).toBe(false);
    });

    it('la prima tappa della mattina resta il caffè anche se una visita sta più sulla strada', () => {
        const mattina = g.find(m => m.key === 'mattina');
        const pranzoM = g.find(m => m.key === 'pranzo');
        const piano = [
            { moment: mattina, stops: [
                { candidate: caffe, source: 'modello', trace: { scelta: 'modello' } },
                { candidate: museo, source: 'modello', trace: { scelta: 'modello' } },
                { candidate: chiesa, source: 'modello', trace: { scelta: 'modello' } },
            ] },
            { moment: pranzoM, stops: [{ candidate: pranzo, source: 'modello', trace: { scelta: 'modello' } }] },
        ];
        const pool = [caffe, museo, chiesa, castello, pranzo];
        const buckets = bucketCandidates(g, pool);
        buckets.get(mattina.id).push(castello); // il candidato più comodo è nel bucket della mattina
        const report = { riempite: [], ripieghi: [], lontani: [], ripetuti: [], ritocchi: [] };
        const out = polishRoute(piano, { buckets, pool }, report);
        expect(seq(out)[0].candidate.place_id).toBe('Caffè Lontano');
        expect(report.ritocchi.find(x => x.tolta === 'Caffè Lontano')).toBeUndefined();
    });
});
