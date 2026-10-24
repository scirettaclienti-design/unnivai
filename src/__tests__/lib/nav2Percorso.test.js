// NAV-2 — il percorso a tratti (fatto attenuato, prossimo arancione, resto neutro) e il banner della posizione. 0 $.
import { describe, it, expect } from 'vitest';
import { statoTratto, stileTratto, ACCENTO_TRATTO } from '@/hooks/useTourRouting';
import { serveBannerPosizione } from '@/hooks/useGeoPermesso';

const BASE = { outer: { strokeColor: '#5A5048', strokeWeight: 10, strokeOpacity: 0.2, zIndex: 40 }, inner: { strokeColor: '#5A5048', strokeWeight: 4, strokeOpacity: 0.9, zIndex: 50, icons: [{}] } };

describe('statoTratto — quale tratto è fatto, quale è il prossimo', () => {
    it('fuori dalla navigazione (null) tutto neutro', () => {
        expect([0, 1, 2].map(i => statoTratto(i, null))).toEqual(['resto', 'resto', 'resto']);
    });
    it('con il tratto 2 come prossimo: 0 e 1 fatti, 2 prossimo, 3 e 4 neutri', () => {
        expect([0, 1, 2, 3, 4].map(i => statoTratto(i, 2))).toEqual(['fatto', 'fatto', 'prossimo', 'resto', 'resto']);
    });
});

describe('stileTratto — la palette Ossidiana', () => {
    it('il prossimo è nell\'accento arancione, più spesso e pieno', () => {
        const s = stileTratto('prossimo', BASE);
        expect(s.inner.strokeColor).toBe(ACCENTO_TRATTO);
        expect(s.inner.strokeColor.toLowerCase()).toBe('#f97316');
        expect(s.inner.strokeWeight).toBeGreaterThan(BASE.inner.strokeWeight);
        expect(s.inner.strokeOpacity).toBe(1);
        expect(s.outer.strokeColor).toBe(ACCENTO_TRATTO);
    });
    it('il fatto è attenuato (opacità bassa, più sottile, senza alone); il resto è come prima', () => {
        const f = stileTratto('fatto', BASE);
        expect(f.inner.strokeOpacity).toBeLessThan(0.4);
        expect(f.inner.strokeWeight).toBeLessThan(BASE.inner.strokeWeight);
        expect(f.outer).toBeNull();
        expect(f.inner.strokeColor).toBe('#5A5048');
        expect(stileTratto('resto', BASE)).toEqual(BASE);
    });
});

describe('serveBannerPosizione — solo se la posizione è davvero negata o assente', () => {
    it('permesso concesso: niente banner (anche senza una posizione in cache)', () => {
        expect(serveBannerPosizione({ gpsActive: false, gpsCoords: null, permesso: 'granted' })).toBe(false);
    });
    it('GPS già letto (attivo o con coordinate): niente banner', () => {
        expect(serveBannerPosizione({ gpsActive: true, permesso: 'unknown' })).toBe(false);
        expect(serveBannerPosizione({ gpsCoords: { lat: 37.5, lon: 15.08 }, permesso: 'prompt' })).toBe(false);
    });
    it('negata, mai chiesta o sconosciuta, senza posizione: il banner c\'è', () => {
        for (const permesso of ['denied', 'prompt', 'unknown']) expect(serveBannerPosizione({ permesso })).toBe(true);
    });
});
