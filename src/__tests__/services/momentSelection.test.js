// P3 — momentSelection: candidati per momento, riparazione, orari.
// Funzioni pure: niente rete, niente modello. L'integrazione con
// generateItinerary sta in scheletroScelta.test.js.

import { describe, it, expect } from 'vitest';
import {
    candidateMomentCategories, flattenSkeleton, bucketCandidates,
    missingMomentThemes, shortMomentThemes, repairMomentSelection, scheduleMomentPlan, MAX_EXTRA_SEARCHES,
} from '../../services/momentSelection';
import { buildDaySkeleton } from '../../lib/daySkeleton';
import { resolveTourWindow } from '../../lib/tourWindow';

const LUN_2057 = new Date('2026-10-05T20:57:00+02:00');
const domani = (pace = 'Rilassato', extra = {}) => buildDaySkeleton({
    window: resolveTourWindow({ text: 'domani', requestTime: LUN_2057, pathType: 'custom' }),
    pace, ...extra,
});

let n = 0;
const poi = (name, types, km = 0.3, extra = {}) => ({
    place_id: `pid-${++n}`, name, types,
    latitude: 41.9 + km / 111, longitude: 12.48,
    rating: 4.5, user_ratings_total: 300, ...extra,
});
const MUSEO = ['museum', 'tourist_attraction', 'point_of_interest'];
const RISTO = ['restaurant', 'food', 'point_of_interest'];
const BAR = ['bar', 'point_of_interest'];

describe('candidateMomentCategories', () => {
    it('un ristorante con anche `bar` resta cibo e non va all\'aperitivo', () => {
        const c = candidateMomentCategories({ types: ['restaurant', 'bar', 'food'] });
        expect(c.has('cibo')).toBe(true);
        expect(c.has('bar')).toBe(false);
    });
    it('museo → musei e cultura; chiesa → cultura e monumenti; bar → bar', () => {
        expect([...candidateMomentCategories({ types: MUSEO })]).toEqual(expect.arrayContaining(['musei', 'cultura']));
        expect([...candidateMomentCategories({ types: ['church'] })]).toEqual(expect.arrayContaining(['cultura', 'monumenti']));
        expect(candidateMomentCategories({ types: BAR }).has('bar')).toBe(true);
    });
    it('panorama e passeggiata si leggono dal nome', () => {
        expect(candidateMomentCategories({ name: 'Terrazza del Pincio', types: [] }).has('punti panoramici')).toBe(true);
        expect(candidateMomentCategories({ name: 'Piazza Navona', types: ['tourist_attraction'] }).has('passeggiata')).toBe(true);
    });
});

describe('bucketCandidates + missingMomentThemes', () => {
    const moments = flattenSkeleton(domani());
    const pool = [poi('Museo A', MUSEO), poi('Trattoria A', RISTO)];

    it('ogni momento riceve solo i candidati delle sue categorie', () => {
        const b = bucketCandidates(moments, pool);
        expect(b.get('g1-mattina').map(c => c.name)).toEqual(['Museo A']);
        expect(b.get('g1-pranzo').map(c => c.name)).toEqual(['Trattoria A']);
        expect(b.get('g1-aperitivo')).toEqual([]);
    });

    it('anyCategory (richiesta esplicita gia\' filtrata dal codice) → ogni candidato vale per ogni momento, tranne pranzo e cena', () => {
        const b = bucketCandidates(moments, pool, { anyCategory: true });
        for (const [id, l] of b) {
            if (id.endsWith('-pranzo') || id.endsWith('-cena')) expect(l.map(c => c.name), id).toEqual(['Trattoria A']);
            else expect(l, id).toHaveLength(2);
        }
    });

    it('P3e — anyCategory + mealOnlyIds: un ristorante cercato per i pasti non va negli altri momenti', () => {
        const risto = pool.find(c => c.name === 'Trattoria A');
        const b = bucketCandidates(moments, pool, { anyCategory: true, mealOnlyIds: new Set([risto.place_id]) });
        expect(b.get('g1-pranzo').map(c => c.name)).toEqual(['Trattoria A']);
        expect(b.get('g1-cena').map(c => c.name)).toEqual(['Trattoria A']);
        expect(b.get('g1-mattina').map(c => c.name)).toEqual(['Museo A']);
        expect(b.get('g1-aperitivo').map(c => c.name)).toEqual(['Museo A']);
    });

    it('P3e — la ricerca mirata del cibo per i pasti viene prima degli altri momenti (tetto 2)', () => {
        // Nessun candidato: mattina/pomeriggio → cultura, aperitivo → nightlife,
        // pranzo/cena → food. Il cibo non deve restare fuori dal tetto.
        const empty = bucketCandidates(moments, []);
        const themes = shortMomentThemes(moments, empty, []);
        expect(themes[0]).toBe('food');
        expect(themes).toHaveLength(MAX_EXTRA_SEARCHES);
    });

    it('ricerca mirata solo per i momenti vuoti, senza doppioni, al massimo 2', () => {
        const onlyFood = bucketCandidates(moments, [poi('Trattoria B', RISTO)]);
        // mattina e pomeriggio → cultura (una volta sola), aperitivo → nightlife.
        expect(missingMomentThemes(moments, onlyFood)).toEqual(['cultura', 'nightlife']);
        expect(MAX_EXTRA_SEARCHES).toBe(2);
        const empty = bucketCandidates(moments, []);
        expect(missingMomentThemes(moments, empty).length).toBe(2);
    });
});

describe('repairMomentSelection', () => {
    const moments = flattenSkeleton(domani());
    const museo = poi('Museo A', MUSEO, 0.2);
    const museo2 = poi('Museo B', MUSEO, 0.4);
    const risto1 = poi('Trattoria 1', RISTO, 0.3);
    const risto2 = poi('Trattoria 2', RISTO, 0.5);
    const risto3 = poi('Trattoria 3', RISTO, 0.7);
    const bar = poi('Bar Zanzara', BAR, 0.6);
    const pool = [museo, museo2, risto1, risto2, risto3, bar];
    const buckets = bucketCandidates(moments, pool);
    const d = 'Una frase vera';

    it('il modello sceglie bene → nessuna riparazione', () => {
        const aiStops = [
            { place_id: museo.place_id, moment: 'g1-mattina', description: d },
            { place_id: risto1.place_id, moment: 'g1-pranzo', description: d },
            { place_id: museo2.place_id, moment: 'g1-pomeriggio', description: d },
            { place_id: bar.place_id, moment: 'g1-aperitivo', description: d },
            { place_id: risto2.place_id, moment: 'g1-cena', description: d },
        ];
        const { plan, report } = repairMomentSelection({ moments, buckets, aiStops, pool });
        expect(plan.map(p => p.moment.key)).toEqual(['mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'cena']);
        expect(plan.every(p => p.stops.length === 1 && p.stops[0].source === 'modello')).toBe(true);
        expect(report.scartate).toEqual([]);
        expect(report.riempite).toEqual([]);
    });

    it('fuori momento, in eccesso, inventato → scartati e rimpiazzati per merito', () => {
        const aiStops = [
            { place_id: risto1.place_id, moment: 'g1-mattina', description: d },   // fuori momento
            { place_id: risto2.place_id, moment: 'g1-pranzo', description: d },
            { place_id: risto3.place_id, moment: 'g1-pranzo', description: d },    // in eccesso
            { place_id: 'ChIJ-inventato', moment: 'g1-cena', description: d },    // inventato
        ];
        const { plan, report } = repairMomentSelection({ moments, buckets, aiStops, pool });
        expect(plan.map(p => p.moment.key)).toEqual(['mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'cena']);
        expect(plan.every(p => p.stops.length === 1)).toBe(true);
        const motivi = report.scartate.map(x => x.motivo);
        expect(motivi).toEqual(expect.arrayContaining([
            'fuori dal suo momento', 'oltre il numero di tappe', 'luogo non fra i candidati',
        ]));
        // Ogni tappa e' un candidato del suo momento: mai un luogo inventato.
        for (const p of plan) {
            const ids = buckets.get(p.moment.id).map(c => c.place_id);
            expect(ids).toContain(p.stops[0].candidate.place_id);
        }
        // Un luogo raccontato dal modello nel momento sbagliato porta con se'
        // il suo racconto quando il codice lo rimette nel momento giusto.
        const cena = plan.find(p => p.moment.key === 'cena').stops[0];
        expect(cena.source).toBe('riparata');
        expect([risto1.place_id, risto3.place_id]).toContain(cena.candidate.place_id);
        expect(cena.narration?.description).toBe(d);
    });

    it('a parita\' di merito vince il luogo piu\' vicino alla tappa precedente', () => {
        const vicino = poi('Museo Vicino', MUSEO, 0.21);
        const lontano = poi('Museo Lontano', MUSEO, 3.0);
        const start = poi('Trattoria Base', RISTO, 0.2);
        const m2 = flattenSkeleton(domani()).filter(m => ['pranzo', 'pomeriggio'].includes(m.key));
        const p2 = [lontano, vicino, start]; // il lontano viene prima nel pool
        const b2 = bucketCandidates(m2, p2);
        const { plan } = repairMomentSelection({
            moments: m2, buckets: b2, pool: p2,
            aiStops: [{ place_id: start.place_id, moment: 'g1-pranzo', description: d }],
        });
        expect(plan[1].stops[0].candidate.name).toBe('Museo Vicino');
    });

    it('un momento senza candidati validi viene tolto e il report lo dice', () => {
        const soloCibo = [risto1, risto2];
        const b = bucketCandidates(moments, soloCibo);
        const { plan, report } = repairMomentSelection({ moments, buckets: b, aiStops: [], pool: soloCibo });
        expect(plan.map(p => p.moment.key)).toEqual(['pranzo', 'cena']);
        expect(report.momentiTolti.map(m => m.momento)).toEqual(['g1-mattina', 'g1-pomeriggio', 'g1-aperitivo']);
    });

    it('una tappa senza `moment` prende il primo momento libero in cui sta', () => {
        const { plan, report } = repairMomentSelection({
            moments, buckets, pool,
            aiStops: [{ place_id: risto1.place_id, description: d }],
        });
        const pranzo = plan.find(p => p.moment.key === 'pranzo').stops[0];
        expect(pranzo.candidate.place_id).toBe(risto1.place_id);
        expect(pranzo.source).toBe('modello');
        expect(report.scartate).toEqual([]);
    });
});

describe('scheduleMomentPlan', () => {
    it('ogni tappa inizia al piu\' tardi fra inizio momento e fine precedente + cammino', () => {
        const sk = domani();
        const moments = flattenSkeleton(sk);
        const museo = poi('Museo A', MUSEO, 0.2);
        const risto = poi('Trattoria 1', RISTO, 1.1);
        const pool = [museo, risto];
        const buckets = bucketCandidates(moments, pool);
        const { plan } = repairMomentSelection({ moments, buckets, pool, aiStops: [] });
        const { days } = scheduleMomentPlan(plan, sk.days.map(() => moments[0].start));
        const [m, p] = days[0];
        expect(m.start.toISOString()).toBe(new Date('2026-10-06T09:30:00+02:00').toISOString());
        expect(m.waitMinutesBefore).toBe(0);
        // Museo 60' fino alle 10:30, poi ~12' a piedi: il pranzo aspetta le 12:30.
        expect(p.start.toISOString()).toBe(new Date('2026-10-06T12:30:00+02:00').toISOString());
        expect(p.waitMinutesBefore).toBeGreaterThan(100);
    });

    it('una tappa che non entra nel suo momento viene tolta', () => {
        const sk = domani('Intenso');
        const mattina = flattenSkeleton(sk).filter(m => m.key === 'mattina');
        const a = poi('Museo A', MUSEO, 0);
        const b = poi('Museo Lontanissimo', MUSEO, 12); // 12 km: oltre 2 ore a piedi
        const plan = [{ moment: mattina[0], stops: [
            { candidate: a, narration: null, source: 'modello' },
            { candidate: b, narration: null, source: 'modello' },
        ] }];
        const { days, tolte } = scheduleMomentPlan(plan, mattina[0].start);
        expect(days[0].map(s => s.candidate.name)).toEqual(['Museo A']);
        expect(tolte).toEqual([{ place_id: b.place_id, momento: 'g1-mattina', motivo: 'non entra nel suo momento' }]);
    });
});
