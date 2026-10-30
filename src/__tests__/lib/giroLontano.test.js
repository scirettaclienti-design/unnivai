// GIRO-LONTANO — distanza dal giro, partenza dei giri di Crea (finestra e cammino fino alla tappa 1). 0 $, nessuna rete.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { distanzaDalGiro, primaTappa, minutiFinoAllaTappa, kmDetti, leggiPosizione, SOGLIA_LONTANO_KM } from '@/lib/giroLontano';
import { resolveTourWindow } from '@/lib/tourWindow';
import { NAV_TESTI } from '@/lib/navMessaggi';
import { aiRecommendationService } from '@/services/aiRecommendationService';

const ROMA = { latitude: 41.9009, longitude: 12.4833 };
const ELEFANTE = { lat: 37.5027, lng: 15.0871, title: "Fontana dell'Elefante" };
const VICINO = { latitude: 37.5054, longitude: 15.0871 }; // ~300 m a nord
const at = (iso) => new Date(iso).toISOString();

describe('distanza dal giro', () => {
    it('in città: vicino; a Roma: lontano, ~535 km; senza posizione: lontano', () => {
        expect(distanzaDalGiro(VICINO, ELEFANTE)).toEqual({ lontano: false, km: 0.3, senzaPosizione: false });
        const roma = distanzaDalGiro(ROMA, ELEFANTE);
        expect(roma.lontano).toBe(true);
        expect(roma.km).toBeGreaterThan(530);
        expect(roma.km).toBeLessThan(545);
        expect(distanzaDalGiro(null, ELEFANTE)).toEqual({ lontano: true, km: null, senzaPosizione: true });
        expect(distanzaDalGiro({ latitude: 0, longitude: 0 }, ELEFANTE).senzaPosizione).toBe(true);
    });
    it('la soglia è 20 km', () => {
        expect(SOGLIA_LONTANO_KM).toBe(20);
        const a19 = { latitude: 37.5027 + 19 / 111.32, longitude: 15.0871 };
        const a21 = { latitude: 37.5027 + 21 / 111.32, longitude: 15.0871 };
        expect(distanzaDalGiro(a19, ELEFANTE).lontano).toBe(false);
        expect(distanzaDalGiro(a21, ELEFANTE).lontano).toBe(true);
    });
    it('la tappa 1 non è un tempo libero; minuti a piedi fino alla tappa; km detti', () => {
        expect(primaTappa([{ tempoLibero: true, lat: 1, lng: 1 }, ELEFANTE])).toBe(ELEFANTE);
        expect(minutiFinoAllaTappa(VICINO, ELEFANTE)).toBe(4);
        expect(minutiFinoAllaTappa(null, ELEFANTE)).toBeNull();
        expect(kmDetti(537.4)).toBe('537');
        expect(NAV_TESTI.LONTANO_AVVIA(kmDetti(537.4), 'Catania')).toBe('Sei a 537 km da Catania: la guida parte quando sei lì.');
    });
});

describe('leggiPosizione (Crea, una volta)', () => {
    it('risponde con la posizione; null se negata, se il permesso è negato o se il GPS tace', async () => {
        const ok = { getCurrentPosition: (s) => s({ coords: { latitude: 41.9, longitude: 12.48 } }) };
        expect(await leggiPosizione({ geolocation: ok, permissions: null })).toEqual({ latitude: 41.9, longitude: 12.48 });
        const ko = { getCurrentPosition: (s, e) => e({ code: 1 }) };
        expect(await leggiPosizione({ geolocation: ko, permissions: null })).toBeNull();
        const chiede = vi.fn();
        expect(await leggiPosizione({ geolocation: { getCurrentPosition: chiede }, permissions: { query: async () => ({ state: 'denied' }) } })).toBeNull();
        expect(chiede).not.toHaveBeenCalled();
        expect(await leggiPosizione({ geolocation: { getCurrentPosition: () => {} }, permissions: null, timeoutMs: 20 })).toBeNull();
        expect(await leggiPosizione({ geolocation: null })).toBeNull();
    });
});

describe('finestra di Crea: da lontano domani alle 9:30, solo se il testo non dice un orario', () => {
    const VEN_1500 = new Date('2026-10-30T15:00:00+01:00');
    it('lontano, nessun orario → domani 9:30–22:30 (giornata intera)', () => {
        const w = resolveTourWindow({ text: 'un giro a Catania', requestTime: VEN_1500, pathType: 'custom', lontano: true });
        expect(w.reason).toBe('lontano');
        expect(w.start.toISOString()).toBe(at('2026-10-31T09:30:00+01:00'));
        expect(w.end.toISOString()).toBe(at('2026-10-31T22:30:00+01:00'));
        expect(w.date).toBe('2026-10-31');
    });
    it('in città, nessun orario → da adesso (come prima)', () => {
        const w = resolveTourWindow({ text: 'un giro a Catania', requestTime: VEN_1500, pathType: 'custom', lontano: false });
        expect(w.reason).toBe('now');
        expect(w.start.toISOString()).toBe(VEN_1500.toISOString());
    });
    it('lontano ma il testo sceglie: «alle 17», «sabato», «stasera», «oggi» vincono', () => {
        expect(resolveTourWindow({ text: 'Catania alle 17', requestTime: VEN_1500, pathType: 'custom', lontano: true }).reason).toBe('hour');
        expect(resolveTourWindow({ text: 'sabato a Catania', requestTime: VEN_1500, pathType: 'custom', lontano: true }).reason).toBe('day');
        expect(resolveTourWindow({ text: 'stasera a Catania', requestTime: VEN_1500, pathType: 'custom', lontano: true }).reason).toBe('fascia');
        expect(resolveTourWindow({ text: 'oggi a Catania', requestTime: VEN_1500, pathType: 'custom', lontano: true }).reason).toBe('today');
    });
    it('il Percorso Veloce non cambia: da adesso', () => {
        expect(resolveTourWindow({ text: '', requestTime: VEN_1500, pathType: 'quick', lontano: true }).reason).toBe('quick-now');
    });
});

describe('partenza del giro di Crea (_partenzaDalCammino)', () => {
    const GIRO = { days: [{ stops: [{ ...ELEFANTE, latitude: ELEFANTE.lat, longitude: ELEFANTE.lng, scheduledTime: '2026-10-30T15:00:00+01:00' }] }] };
    const args = (opts) => ['Catania', {}, 'un giro a Catania', {}, '', { latitude: 37.5, longitude: 15.08 }, opts];
    afterEach(() => vi.restoreAllMocks());

    it('da lontano: nessun ricalcolo, il risultato dice «domani»', async () => {
        const spia = vi.spyOn(aiRecommendationService, '_generateItinerary');
        const r = await aiRecommendationService._partenzaDalCammino({ ...GIRO, tourWindow: { reason: 'lontano' } }, args({ lontano: true, posizioneUtente: ROMA }));
        expect(r._partenza).toEqual({ domani: true });
        expect(spia).not.toHaveBeenCalled();
    });
    it('in città: si ricalcolano gli orari dalla cache, partenza = adesso + il cammino fino alla tappa 1', async () => {
        const spostato = { ...GIRO, days: [{ stops: [{ ...GIRO.days[0].stops[0], scheduledTime: '2026-10-30T15:04:00+01:00' }] }] };
        const spia = vi.spyOn(aiRecommendationService, '_generateItinerary').mockResolvedValue(spostato);
        const r = await aiRecommendationService._partenzaDalCammino({ ...GIRO, tourWindow: { reason: 'now' } }, args({ lontano: false, posizioneUtente: VICINO }));
        expect(spia).toHaveBeenCalledTimes(1);
        expect(spia.mock.calls[0][6]).toMatchObject({ ritardoMinuti: 4, soloCache: true, skipUserQuota: true });
        expect(r.days[0].stops[0].scheduledTime).toBe('2026-10-30T15:04:00+01:00');
        expect(r._partenza).toEqual({ daAdesso: true, camminoMinuti: 4 });
    });
    it('in città ma il giro non è in cache: gli orari restano (mai una seconda generazione)', async () => {
        vi.spyOn(aiRecommendationService, '_generateItinerary').mockResolvedValue(null);
        const r = await aiRecommendationService._partenzaDalCammino({ ...GIRO, tourWindow: { reason: 'now' } }, args({ lontano: false, posizioneUtente: VICINO }));
        expect(r.days[0].stops[0].scheduledTime).toBe('2026-10-30T15:00:00+01:00');
        expect(r._partenza).toBeUndefined();
    });
    it('un orario scritto nel testo non si sposta', async () => {
        const spia = vi.spyOn(aiRecommendationService, '_generateItinerary');
        const r = await aiRecommendationService._partenzaDalCammino({ ...GIRO, tourWindow: { reason: 'hour' } }, args({ lontano: false, posizioneUtente: VICINO }));
        expect(spia).not.toHaveBeenCalled();
        expect(r._partenza).toBeUndefined();
    });
    it('soloCache senza cache: _generateItinerary risponde null prima di qualsiasi rete', async () => {
        localStorage.clear();
        const f = vi.spyOn(globalThis, 'fetch');
        const r = await aiRecommendationService._generateItinerary('Catania', {}, 'un giro a Catania', {}, '', { latitude: 37.5, longitude: 15.08 }, { pathType: 'custom', soloCache: true, ritardoMinuti: 4 });
        expect(r).toBeNull();
        expect(f).not.toHaveBeenCalled();
    });
});
