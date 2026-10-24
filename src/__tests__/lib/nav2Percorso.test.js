// NAV-2 — il percorso a tratti (fatto attenuato, prossimo arancione, resto neutro) e il banner della posizione. 0 $.
import { describe, it, expect } from 'vitest';
import { statoTratto, stileTratto, ACCENTO_TRATTO, trattiDaDisegnare, chiaveTratto } from '@/hooks/useTourRouting';
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
        expect(f.inner.strokeOpacity).toBe(0); // la linea piena non c'e': solo i trattini
        expect(f.inner.icons[0].icon.strokeOpacity).toBeLessThan(0.5);
        expect(f.inner.icons[0].repeat).toBeTruthy();
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

describe('trattiDaDisegnare — fatto, prossimo, resto', () => {
    const T = [0, 1, 2, 3, 4].map(i => ({ lat: 37.5 + i * 0.001, lng: 15.08 }));
    const path = (i) => [{ lat: T[i].lat, lng: T[i].lng }, { lat: T[i + 1]?.lat ?? 0, lng: T[i + 1]?.lng ?? 0 }];
    const cache = new Map([0, 1, 2, 3].map(i => [chiaveTratto(T[i], T[i + 1]), path(i)]));
    it('verso la 3ª tappa (indice 2): il tratto 0 è fatto, il tratto 1 è il prossimo, il resto (dal percorso richiesto) è neutro', () => {
        const live = [path(2), path(3)]; // il percorso richiesto parte dalla tappa che stai raggiungendo
        const l = trattiDaDisegnare({ live, progress: { tappe: T, nextIdx: 2 }, cache });
        expect(l.map(x => x.stato)).toEqual(['fatto', 'prossimo', 'resto', 'resto']);
        expect(l[1].path).toBe(cache.get(chiaveTratto(T[1], T[2])));
    });
    it('alla prima tappa (nextIdx 0) nessun tratto fatto o prossimo; fuori dalla navigazione tutto neutro', () => {
        expect(trattiDaDisegnare({ live: [path(0)], progress: { tappe: T, nextIdx: 0 }, cache }).map(x => x.stato)).toEqual(['resto']);
        expect(trattiDaDisegnare({ live: [path(0), path(1)], progress: null, cache }).map(x => x.stato)).toEqual(['resto', 'resto']);
    });
    it('un tratto che non abbiamo (ripresa dopo una ricarica) non si inventa: manca finché non arriva', () => {
        const l = trattiDaDisegnare({ live: [path(3)], progress: { tappe: T, nextIdx: 3 }, cache: new Map([[chiaveTratto(T[2], T[3]), path(2)]]) });
        expect(l.map(x => x.stato)).toEqual(['prossimo', 'resto']);
    });
});
