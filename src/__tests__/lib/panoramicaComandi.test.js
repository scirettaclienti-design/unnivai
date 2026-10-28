import { describe, it, expect } from 'vitest';
import { separaSegnaposti, DIAMETRO_SEGNAPOSTO_PX } from '@/lib/segnaposti';
import { serveBannerPosizione, bannerNegatoGiaMostrato, ricordaBannerNegato, dimenticaBannerNegato } from '@/hooks/useGeoPermesso';
import { NAV_TESTI } from '@/lib/navMessaggi';
import { numeriDelGiro } from '@/lib/navGuida';

// le 12 tappe del giro di Catania (navsim-catania): a zoom 16 se ne ammucchiano cinque in 60 m
const CATANIA = [[37.5018, 15.08764], [37.50241, 15.08772], [37.50252, 15.0871], [37.50266, 15.08387], [37.50183, 15.0854], [37.50176, 15.0849],
    [37.49917, 15.08449], [37.50212, 15.08722], [37.50389, 15.08712], [37.50219, 15.08491], [37.50204, 15.08701], [37.49972, 15.08389]]
    .map(([lat, lng], i) => ({ id: i + 1, lat, lng }));
const proietta = (p, z) => { const sc = 256 * 2 ** z, s = Math.sin(p.lat * Math.PI / 180); return { x: (p.lng + 180) / 360 * sc, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * sc }; };
const distanzaMinima = (punti, z, inclinazione = 0) => {
    const sp = separaSegnaposti(punti, z, { inclinazione });
    const k = Math.max(0.35, Math.cos(inclinazione * Math.PI / 180));
    const Q = punti.map(p => { const w = proietta(p, z), o = sp.get(p.id) || { dx: 0, dy: 0 }; return { x: w.x + o.dx, y: w.y * k + o.dy }; });
    let min = Infinity;
    for (let i = 0; i < Q.length; i++) for (let j = i + 1; j < Q.length; j++) min = Math.min(min, Math.hypot(Q[i].x - Q[j].x, Q[i].y - Q[j].y));
    return min;
};

describe('segnaposti della panoramica: numeri sempre leggibili', () => {
    it('a Catania, a ogni zoom della panoramica, due numeri non si toccano mai', () => {
        for (const z of [14, 15, 16, 17, 18]) expect(distanzaMinima(CATANIA, z)).toBeGreaterThanOrEqual(DIAMETRO_SEGNAPOSTO_PX - 1);
    });
    it('con la mappa inclinata (45°, la panoramica) si misura sullo schermo: i numeri non si toccano comunque', () => {
        for (const z of [15, 16, 17]) expect(distanzaMinima(CATANIA, z, 45)).toBeGreaterThanOrEqual(DIAMETRO_SEGNAPOSTO_PX - 1);
    });
    it('i punti già lontani non si muovono', () => {
        expect(separaSegnaposti([{ id: 'a', lat: 37.5, lng: 15.0 }, { id: 'b', lat: 37.6, lng: 15.1 }], 16).size).toBe(0);
    });
    it('due tappe sullo stesso punto si separano comunque', () => {
        expect(distanzaMinima([{ id: 1, lat: 37.5, lng: 15 }, { id: 2, lat: 37.5, lng: 15 }], 16)).toBeGreaterThanOrEqual(DIAMETRO_SEGNAPOSTO_PX - 1);
    });
});

describe('banner «Attiva la tua posizione»', () => {
    it('con il puntino utente visibile non compare, qualunque cosa dica il browser', () => {
        for (const permesso of ['unknown', 'prompt', 'denied']) expect(serveBannerPosizione({ permesso, posizioneNota: true })).toBe(false);
    });
    it('posizione davvero negata o non disponibile: compare', () => {
        expect(serveBannerPosizione({ permesso: 'denied' })).toBe(true);
        expect(serveBannerPosizione({ permesso: 'unknown' })).toBe(true);
    });
    it('rifiutata e già detta una volta: non insiste a ogni apertura', () => {
        expect(serveBannerPosizione({ permesso: 'denied', giaMostrato: true })).toBe(false);
        expect(serveBannerPosizione({ permesso: 'prompt', giaMostrato: true })).toBe(true); // mai chiesta: l'invito resta
    });
    it('il ricordo sta sul telefono e si cancella quando il permesso torna concesso', () => {
        dimenticaBannerNegato();
        expect(bannerNegatoGiaMostrato()).toBe(false);
        ricordaBannerNegato();
        expect(bannerNegatoGiaMostrato()).toBe(true);
        dimenticaBannerNegato();
        expect(bannerNegatoGiaMostrato()).toBe(false);
    });
});

describe('«Salta» fino in fondo: la fine giro dice dove sei arrivato', () => {
    const tappe = CATANIA.map(p => ({ ...p, latitude: p.lat, longitude: p.lng }));
    it('con tutte le tappe saltate non si contano 12 tappe mai raggiunte', () => {
        expect(numeriDelGiro({ tappe: [] }).tappe).toBe(0);
        expect(numeriDelGiro({ tappe }).tappe).toBe(12);
    });
    it('il testo dice quante tappe, mai un numero finto', () => {
        expect(NAV_TESTI.FINE_FIN_DOVE(0, 12)).toBe('Hai saltato tutte le tappe: il giro finisce qui.');
        expect(NAV_TESTI.FINE_FIN_DOVE(1, 12)).toBe('Sei arrivato a 1 tappa su 12.');
        expect(NAV_TESTI.FINE_FIN_DOVE(5, 12)).toBe('Sei arrivato a 5 tappe su 12.');
    });
});
