// APP-NATIVA — la posizione del giro dal plugin nativo, vestita come navigator.geolocation.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const cap = { nativo: false, disponibili: new Set() };
vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: () => cap.nativo,
        isPluginAvailable: (n) => cap.disponibili.has(n),
    },
    registerPlugin: () => ({}),
}));

const { creaGeolocationNativa, posizioneDaNativa, posizioneNativaDisponibile, RITARDO_FERMA_MS } = await import('../../lib/posizioneNativa');
const { avviaTracciamento, geolocationDellaNavigazione } = await import('../../lib/navTracking');

function pluginFinto({ rifiuta = null } = {}) {
    const ascolti = {};
    return {
        ascolti,
        avvia: vi.fn(async () => { if (rifiuta) { const e = new Error('no'); e.code = rifiuta; throw e; } return { autorizzazione: 'durante-uso' }; }),
        ferma: vi.fn(async () => {}),
        addListener: vi.fn(async (nome, f) => { ascolti[nome] = f; return { remove: async () => {} }; }),
        manda(nome, dati) { ascolti[nome]?.(dati); },
    };
}
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

beforeEach(() => { cap.nativo = false; cap.disponibili = new Set(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('posizioneDaNativa', () => {
    it('ha la forma di una GeolocationPosition, con i campi mancanti a null', () => {
        const p = posizioneDaNativa({ latitude: 37.5, longitude: 15.08, accuracy: 6, heading: null, speed: 1.3, timestamp: 1000, sfondo: true });
        expect(p.coords).toEqual({ latitude: 37.5, longitude: 15.08, accuracy: 6, altitude: null, altitudeAccuracy: null, heading: null, speed: 1.3 });
        expect(p.timestamp).toBe(1000);
        expect(p.sfondo).toBe(true);
    });
});

describe('creaGeolocationNativa', () => {
    it('watchPosition avvia il nativo una volta e passa le posizioni a ogni osservatore', async () => {
        const plugin = pluginFinto();
        const geo = creaGeolocationNativa({ plugin });
        const a = vi.fn(); const b = vi.fn();
        geo.watchPosition(a); geo.watchPosition(b);
        await flush();
        expect(plugin.avvia).toHaveBeenCalledTimes(1);
        expect(plugin.avvia).toHaveBeenCalledWith({ distanzaMinima: 5 });
        plugin.manda('posizione', { latitude: 41.9, longitude: 12.5, accuracy: 4, timestamp: 5 });
        expect(a.mock.calls[0][0].coords.latitude).toBe(41.9);
        expect(b).toHaveBeenCalledTimes(1);
    });

    it('clearWatch seguito da un nuovo watch (riavvio di NAV-1) NON spegne la sessione nativa', async () => {
        const plugin = pluginFinto();
        const geo = creaGeolocationNativa({ plugin });
        const id = geo.watchPosition(vi.fn());
        await flush();
        geo.clearWatch(id);
        geo.watchPosition(vi.fn());
        vi.advanceTimersByTime(RITARDO_FERMA_MS * 3);
        await flush();
        expect(plugin.ferma).not.toHaveBeenCalled();
        expect(plugin.avvia).toHaveBeenCalledTimes(1);
    });

    it('clearWatch dell\'ultimo osservatore spegne il nativo dopo il ritardo', async () => {
        const plugin = pluginFinto();
        const geo = creaGeolocationNativa({ plugin });
        const id = geo.watchPosition(vi.fn());
        await flush();
        geo.clearWatch(id);
        vi.advanceTimersByTime(RITARDO_FERMA_MS - 1);
        await flush();
        expect(plugin.ferma).not.toHaveBeenCalled();
        vi.advanceTimersByTime(2);
        await flush();
        expect(plugin.ferma).toHaveBeenCalledTimes(1);
        // e un nuovo watch dopo lo spegnimento riavvia
        geo.watchPosition(vi.fn());
        await flush();
        expect(plugin.avvia).toHaveBeenCalledTimes(2);
    });

    it('permesso rifiutato → errore con code 1; errore nativo «errore» → code passato', async () => {
        const plugin = pluginFinto({ rifiuta: 'NEGATO' });
        const geo = creaGeolocationNativa({ plugin });
        const err = vi.fn();
        geo.watchPosition(vi.fn(), err);
        await flush();
        expect(err).toHaveBeenCalledWith(expect.objectContaining({ code: 1 }));
        plugin.manda('errore', { code: 2, message: 'x' });
        expect(err).toHaveBeenLastCalledWith({ code: 2, message: 'x' });
    });
});

describe('avviaTracciamento con la posizione nativa: stessi stati di NAV-1', () => {
    it('attesa → ok alla prima posizione, poi perso dopo 30 s di silenzio', async () => {
        const plugin = pluginFinto();
        const geo = creaGeolocationNativa({ plugin });
        let t = 0;
        const stati = [];
        const posizioni = [];
        const tr = avviaTracciamento({ geolocation: geo, onStato: (s) => stati.push(s), onPosizione: (p, i) => posizioni.push([p, i]), now: () => t, doc: null });
        await flush();
        expect(stati).toEqual(['attesa']);
        plugin.manda('posizione', { latitude: 37.5, longitude: 15.08, accuracy: 5 });
        expect(stati).toEqual(['attesa', 'ok']);
        expect(posizioni[0][1]).toEqual({ primo: true });
        t = 31_000; vi.advanceTimersByTime(5000);
        expect(stati).toContain('perso');
        // il riavvio del watch dopo il silenzio non spegne la sessione nativa
        vi.advanceTimersByTime(RITARDO_FERMA_MS * 2);
        await flush();
        expect(plugin.ferma).not.toHaveBeenCalled();
        tr.stop();
        vi.advanceTimersByTime(RITARDO_FERMA_MS + 1);
        await flush();
        expect(plugin.ferma).toHaveBeenCalledTimes(1);
    });

    it('permesso negato → stato negato', async () => {
        const plugin = pluginFinto({ rifiuta: 'NEGATO' });
        const stati = [];
        avviaTracciamento({ geolocation: creaGeolocationNativa({ plugin }), onStato: (s) => stati.push(s), onPosizione: () => {}, doc: null });
        await flush();
        expect(stati).toEqual(['attesa', 'negato']);
    });
});

describe('geolocationDellaNavigazione: nativa solo nell\'app col plugin', () => {
    const web = { tipo: 'web' };
    it('web → navigator.geolocation', () => {
        expect(posizioneNativaDisponibile()).toBe(false);
        expect(geolocationDellaNavigazione({ web })).toBe(web);
    });
    it('app senza il plugin (build vecchia) → navigator.geolocation', () => {
        cap.nativo = true;
        expect(geolocationDellaNavigazione({ web })).toBe(web);
    });
    it('app con il plugin → la geolocalizzazione nativa (sempre la stessa istanza)', () => {
        cap.nativo = true; cap.disponibili.add('PosizioneGiro');
        const g1 = geolocationDellaNavigazione({ web });
        const g2 = geolocationDellaNavigazione({ web });
        expect(g1).not.toBe(web);
        expect(g1.nativa).toBe(true);
        expect(g1).toBe(g2);
    });
    it('il plugin c\'è ma non siamo nell\'app (web) → web', () => {
        cap.disponibili.add('PosizioneGiro');
        expect(geolocationDellaNavigazione({ web })).toBe(web);
    });
});
