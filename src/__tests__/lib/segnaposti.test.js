import { describe, it, expect } from 'vitest';
import { separaSegnaposti, DIAMETRO_SEGNAPOSTO_PX, MAX_SPOSTAMENTO_PX } from '@/lib/segnaposti';

const mondo = (lat, lng, zoom) => { const k = 256 * 2 ** zoom, s = Math.sin(lat * Math.PI / 180); return { x: ((lng + 180) / 360) * k, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * k }; };
const posFinale = (p, off, zoom) => { const w = mondo(p.lat, p.lng, zoom); return { x: w.x + (off?.dx || 0), y: w.y + (off?.dy || 0) }; };

describe('segnaposti numerati che non si sovrappongono', () => {
    // 12 tappe di Catania in 3 km, a zoom 13 (tutte dentro ~100 px): si sovrappongono
    const catania = Array.from({ length: 12 }, (_, i) => ({ id: `t${i + 1}`, lat: 37.502 + (i % 4) * 0.004 + (i % 3) * 0.001, lng: 15.087 + Math.floor(i / 4) * 0.006 + (i % 2) * 0.001 }));
    it('a zoom 13 nessuna coppia si tocca dopo la separazione (entro il tetto di spostamento)', () => {
        const off = separaSegnaposti(catania, 13);
        expect(off.size).toBeGreaterThan(0);
        for (const v of off.values()) expect(Math.hypot(v.dx, v.dy)).toBeLessThanOrEqual(MAX_SPOSTAMENTO_PX + 1);
        let minimo = Infinity;
        for (let i = 0; i < catania.length; i++) for (let j = i + 1; j < catania.length; j++) {
            const a = posFinale(catania[i], off.get(catania[i].id), 13), b = posFinale(catania[j], off.get(catania[j].id), 13);
            minimo = Math.min(minimo, Math.hypot(a.x - b.x, a.y - b.y));
        }
        // dopo la separazione la distanza minima e' piu' grande di prima
        const prima = Math.min(...catania.flatMap((p, i) => catania.slice(i + 1).map(q => { const a = mondo(p.lat, p.lng, 13), b = mondo(q.lat, q.lng, 13); return Math.hypot(a.x - b.x, a.y - b.y); })));
        expect(minimo).toBeGreaterThan(prima);
    });
    it('a zoom 16 (la panoramica di un giro a piedi) nessuna coppia si tocca piu\'', () => {
        const off = separaSegnaposti(catania, 16);
        let minimo = Infinity;
        for (let i = 0; i < catania.length; i++) for (let j = i + 1; j < catania.length; j++) {
            const a = posFinale(catania[i], off.get(catania[i].id), 16), b = posFinale(catania[j], off.get(catania[j].id), 16);
            minimo = Math.min(minimo, Math.hypot(a.x - b.x, a.y - b.y));
        }
        expect(minimo).toBeGreaterThanOrEqual(DIAMETRO_SEGNAPOSTO_PX * 0.9);
    });
    it('a zoom 17 (cammino) i segnaposti lontani non si spostano', () => {
        expect(separaSegnaposti(catania, 17).size).toBe(0);
    });
    it('due segnaposti sullo stesso punto si separano in direzioni opposte', () => {
        const off = separaSegnaposti([{ id: 'a', lat: 37.5, lng: 15.0 }, { id: 'b', lat: 37.5, lng: 15.0 }], 15);
        const a = off.get('a'), b = off.get('b');
        expect(Math.hypot(a.dx - b.dx, a.dy - b.dy)).toBeGreaterThanOrEqual(DIAMETRO_SEGNAPOSTO_PX - 2);
        expect(a.dx + b.dx).toBeCloseTo(0, 0);
    });
    it('senza zoom o con un solo punto non fa niente', () => {
        expect(separaSegnaposti(catania, null).size).toBe(0);
        expect(separaSegnaposti([catania[0]], 13).size).toBe(0);
    });
});
