import { describe, it, expect } from 'vitest';
import { extractDirectionsData } from '../../hooks/useTourRouting';

// LatLng del SDK: oggetto con metodi .lat()/.lng().
const makeLatLng = (lat, lng) => ({ lat: () => lat, lng: () => lng });

// Costruisce uno step "SDK-like".
const makeStep = (i, legI) => ({
    maneuver: `turn-${i}`,
    instructions: `Istruzione ${legI}.${i}`,
    distance: { text: `${i}00 m`, value: i * 100 },
    duration: { text: `${i} min`, value: i * 60 },
    start_location: makeLatLng(45 + i * 0.001, 9 + i * 0.001),
    end_location: makeLatLng(45 + i * 0.002, 9 + i * 0.002),
    path: [makeLatLng(45 + i * 0.001, 9 + i * 0.001), makeLatLng(45 + i * 0.002, 9 + i * 0.002)],
});

const makeResponse = () => ({
    routes: [{
        overview_path: [makeLatLng(45.0, 9.0), makeLatLng(45.1, 9.1), makeLatLng(45.2, 9.2)],
        legs: [
            { steps: [makeStep(1, 0), makeStep(2, 0), makeStep(3, 0)] },
            { steps: [makeStep(4, 1), makeStep(5, 1), makeStep(6, 1)] },
        ],
    }],
});

describe('extractDirectionsData', () => {
    it('appiattisce 2 legs × 3 step in un array ordinato di 6 con legIndex corretto', () => {
        const { steps } = extractDirectionsData(makeResponse());
        expect(steps).toHaveLength(6);
        expect(steps.map(s => s.legIndex)).toEqual([0, 0, 0, 1, 1, 1]);
        // ordine preservato: le istruzioni seguono la sequenza leg.step
        expect(steps.map(s => s.instructions)).toEqual([
            'Istruzione 0.1', 'Istruzione 0.2', 'Istruzione 0.3',
            'Istruzione 1.4', 'Istruzione 1.5', 'Istruzione 1.6',
        ]);
    });

    it('normalizza i LatLng (metodi .lat()/.lng()) a numeri puri', () => {
        const { steps, overviewPath } = extractDirectionsData(makeResponse());
        const s0 = steps[0];
        expect(s0.startLatLng).toEqual({ lat: 45.001, lng: 9.001 });
        expect(typeof s0.startLatLng.lat).toBe('number');
        expect(s0.path).toHaveLength(2);
        expect(s0.path[0]).toEqual({ lat: 45.001, lng: 9.001 });
        expect(overviewPath).toHaveLength(3);
        expect(overviewPath[0]).toEqual({ lat: 45.0, lng: 9.0 });
    });

    it('accetta anche LatLng-literal ({lat,lng} numerici)', () => {
        const resp = { routes: [{ legs: [{ steps: [{ start_location: { lat: 1, lng: 2 }, end_location: { lat: 3, lng: 4 }, path: [{ lat: 1, lng: 2 }] }] }] }] };
        const { steps } = extractDirectionsData(resp);
        expect(steps[0].startLatLng).toEqual({ lat: 1, lng: 2 });
        expect(steps[0].path[0]).toEqual({ lat: 1, lng: 2 });
    });

    it('mappa distance.value/duration.value → distanceM/durationSec; assenti → null', () => {
        const { steps } = extractDirectionsData(makeResponse());
        expect(steps[0].distanceM).toBe(100);
        expect(steps[0].durationSec).toBe(60);
        const noMetrics = { routes: [{ legs: [{ steps: [{ maneuver: 'straight' }] }] }] };
        const s = extractDirectionsData(noMetrics).steps[0];
        expect(s.distanceM).toBeNull();
        expect(s.durationSec).toBeNull();
        expect(s.maneuver).toBe('straight');
        expect(s.instructions).toBeNull();
        expect(s.startLatLng).toBeNull();
        expect(s.path).toEqual([]);
    });

    it('usa lat_lngs come fallback quando path manca', () => {
        const resp = { routes: [{ legs: [{ steps: [{ lat_lngs: [makeLatLng(10, 20)] }] }] }] };
        const { steps } = extractDirectionsData(resp);
        expect(steps[0].path).toEqual([{ lat: 10, lng: 20 }]);
    });

    it('scarta i LatLng non validi dal path (filter Boolean)', () => {
        const resp = { routes: [{ legs: [{ steps: [{ path: [makeLatLng(1, 2), null, { lat: 'x', lng: 3 }, makeLatLng(4, 5)] }] }] }] };
        const { steps } = extractDirectionsData(resp);
        expect(steps[0].path).toEqual([{ lat: 1, lng: 2 }, { lat: 4, lng: 5 }]);
    });

    it('input malformati → { steps: [], overviewPath: [] } senza eccezioni', () => {
        for (const bad of [
            undefined, null, {}, { routes: [] }, { routes: [{}] },
            { routes: [{ legs: null }] }, { routes: [{ legs: [{ steps: null }] }] },
            { routes: [{ legs: [null, { steps: [null] }] }] },
        ]) {
            expect(() => extractDirectionsData(bad)).not.toThrow();
            const out = extractDirectionsData(bad);
            expect(out).toHaveProperty('steps');
            expect(out).toHaveProperty('overviewPath');
            expect(Array.isArray(out.steps)).toBe(true);
            expect(Array.isArray(out.overviewPath)).toBe(true);
        }
    });

    it('overview_path assente → []', () => {
        const { overviewPath } = extractDirectionsData({ routes: [{ legs: [] }] });
        expect(overviewPath).toEqual([]);
    });
});
