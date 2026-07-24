import { describe, it, expect } from 'vitest';
import { pickActiveStep, haversineM, MANEUVER_SNAP_TOLERANCE_M } from '../../lib/navGeo';

// Helper: sposta un punto base di ~N metri in latitudine (1° lat ≈ 111320 m).
const base = { lat: 37.786, lng: 14.601 }; // Troina, indicativo
const north = (m) => ({ lat: base.lat + m / 111320, lng: base.lng });

// Costruisce un path fatto di punti a distanze note (in metri a nord del base),
// ciascuno taggato con lo stepIdx.
const pt = (m, stepIdx) => ({ ...north(m), stepIdx });

describe('pickActiveStep', () => {
    it('scan-forward MONOTONO: da fromIdx alto non torna indietro anche se un punto precedente è più vicino', () => {
        // pts[0] è ESATTAMENTE sulla posizione (dist 0); pts[3..] sono a 100-160m.
        const pts = [pt(0, 0), pt(200, 0), pt(400, 1), pt(100, 2), pt(130, 2), pt(160, 2)];
        const pos = north(0); // coincide con pts[0]
        // fromIdx=3 → la scansione parte da 3, ignora pts[0] anche se dist 0.
        const hit = pickActiveStep(pts, pos.lat, pos.lng, 3, 1000);
        expect(hit).not.toBeNull();
        expect(hit.pointIdx).toBeGreaterThanOrEqual(3); // mai < fromIdx
        expect(hit.pointIdx).toBe(3);                    // il più vicino in avanti (100m)
        expect(hit.stepIdx).toBe(2);
    });

    it('STEP CORTI: due step consecutivi a ~15-20m, posizione sul secondo → aggancia il secondo', () => {
        // step0: punti a 0 e 15m; step1: punti a 30 e 45m. Posizione a ~30m = su step1.
        const pts = [pt(0, 0), pt(15, 0), pt(30, 1), pt(45, 1)];
        const pos = north(30);
        const hit = pickActiveStep(pts, pos.lat, pos.lng, 0, MANEUVER_SNAP_TOLERANCE_M);
        expect(hit).not.toBeNull();
        expect(hit.stepIdx).toBe(1);       // NON lo step0 (a 15/30m), ma lo step1 (a 30m esatti)
        expect(hit.pointIdx).toBe(2);
    });

    it('espone snapDistM = distanza di proiezione (arrotondata) al punto agganciato', () => {
        const pts = [pt(0, 0), pt(15, 0), pt(30, 1), pt(45, 1)];
        // posizione a 40m: il punto più vicino è pt(45,1) a 5m.
        const pos = north(40);
        const hit = pickActiveStep(pts, pos.lat, pos.lng, 0, MANEUVER_SNAP_TOLERANCE_M);
        expect(hit).not.toBeNull();
        expect(hit.pointIdx).toBe(3);
        expect(hit.snapDistM).toBe(5);      // ~5m dal punto agganciato
        // sul punto esatto → snapDistM 0
        const onPoint = pickActiveStep(pts, north(30).lat, north(30).lng, 0, MANEUVER_SNAP_TOLERANCE_M);
        expect(onPoint.snapDistM).toBe(0);
    });

    it('FUORI TOLLERANZA → null (NON l\'ultimo valido)', () => {
        const pts = [pt(0, 0), pt(15, 0), pt(30, 1)];
        const pos = north(100); // 100m dal punto più vicino (30m) = 70m di scarto
        const hit = pickActiveStep(pts, pos.lat, pos.lng, 0, 25);
        expect(hit).toBeNull();
        // controprova: con tolleranza larga aggancia
        expect(pickActiveStep(pts, pos.lat, pos.lng, 0, 200)).not.toBeNull();
    });

    it('pts vuoto / non-array / coords non numeriche → null senza eccezioni', () => {
        const pts = [pt(0, 0), pt(15, 0)];
        expect(() => pickActiveStep([], base.lat, base.lng)).not.toThrow();
        expect(pickActiveStep([], base.lat, base.lng)).toBeNull();
        expect(pickActiveStep(null, base.lat, base.lng)).toBeNull();
        expect(pickActiveStep(undefined, base.lat, base.lng)).toBeNull();
        expect(pickActiveStep(pts, NaN, base.lng)).toBeNull();
        expect(pickActiveStep(pts, base.lat, undefined)).toBeNull();
        expect(pickActiveStep(pts, 'x', base.lng)).toBeNull();
        // punto malformato dentro pts → saltato, non rompe
        const dirty = [{ lat: 'a', lng: base.lng, stepIdx: 0 }, pt(0, 1)];
        const hit = pickActiveStep(dirty, base.lat, base.lng, 0, 50);
        expect(hit.stepIdx).toBe(1);
    });

    it('VERTICE CONDIVISO tra due step (coords identiche) → vince lo step PRECEDENTE (indice più basso, strict <)', () => {
        // il vertice a 30m appare due volte: fine step0 (stepIdx 0) e inizio step1 (stepIdx 1).
        const shared = north(30);
        const pts = [
            pt(0, 0), { ...shared, stepIdx: 0 },  // fine step0
            { ...shared, stepIdx: 1 }, pt(60, 1),  // inizio step1
        ];
        const hit = pickActiveStep(pts, shared.lat, shared.lng, 0, 50);
        expect(hit).not.toBeNull();
        expect(hit.pointIdx).toBe(1);   // il primo dei due identici (indice più basso)
        expect(hit.stepIdx).toBe(0);    // → step PRECEDENTE. Deterministico.
    });

    it('haversineM: distanza nota ~coerente (sanity)', () => {
        expect(haversineM(base.lat, base.lng, base.lat, base.lng)).toBe(0);
        const d = haversineM(base.lat, base.lng, north(100).lat, north(100).lng);
        expect(Math.round(d)).toBe(100);
    });
});
