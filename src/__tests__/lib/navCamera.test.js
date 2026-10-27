// nav-camera — fasce orarie, camera (volo, direzione di marcia, lisciatura), freccia di partenza, foto vera.
import { describe, it, expect, vi } from 'vitest';
import { fasciaMappa, direzioneVerso, scartoAngolo, distanzaFraM, angoloFrecciaPartenza, partenzaCompiuta, fotoVera, PARTENZA_METRI } from '@/lib/navGuida';
import { interpola, lerpAngolo, lisciaAngolo, direzioneDiMarcia, volaCamera, zoomNav, tiltNav, VOLO_MS, ZOOM_NAV_MIN, ZOOM_NAV_MAX, TILT_NAV_MIN, TILT_NAV_MAX } from '@/lib/cameraNav';
import { specchiaCamera } from '@/lib/mappaGiro';

describe('la fascia della mappa segue il sole vero', () => {
    // 27/10/2026 a Catania: alba ~05:55, tramonto ~16:50 (ora solare)
    const sole = { sunrise: new Date('2026-10-27T05:55:00+01:00'), sunset: new Date('2026-10-27T16:50:00+01:00') };
    const f = (hhmm) => fasciaMappa(new Date(`2026-10-27T${hhmm}:00+01:00`), sole);
    it('mattina fino a 2 h dopo l\'alba; giorno; tramonto da 1 h prima a 30 min dopo; notte dal buio', () => {
        expect(f('05:30')).toBe('notte');
        expect(f('06:00')).toBe('mattina');
        expect(f('07:54')).toBe('mattina');
        expect(f('08:00')).toBe('giorno');
        expect(f('12:00')).toBe('giorno');
        expect(f('15:49')).toBe('giorno');
        expect(f('15:50')).toBe('tramonto');
        expect(f('16:40')).toBe('tramonto');
        expect(f('17:19')).toBe('tramonto');
        expect(f('17:20')).toBe('notte');
        expect(f('21:30')).toBe('notte');
    });
    it('le tre ore della prova: 10:00 giorno, 16:40 tramonto, 21:30 notte', () => {
        expect(f('10:00')).toBe('giorno');
        expect(f('16:40')).toBe('tramonto');
        expect(f('21:30')).toBe('notte');
    });
    it('senza sole (nessun dato) resta «giorno» = Ossidiana', () => {
        expect(fasciaMappa(new Date(), { sunrise: null, sunset: null })).toBe('giorno');
    });
});

describe('direzioni e distanze', () => {
    const A = { lat: 37.5, lng: 15.0 };
    it('verso nord / est / sud / ovest', () => {
        expect(Math.round(direzioneVerso(A, { lat: 37.51, lng: 15.0 }))).toBe(0);
        expect(Math.round(direzioneVerso(A, { lat: 37.5, lng: 15.01 }))).toBe(90);
        expect(Math.round(direzioneVerso(A, { lat: 37.49, lng: 15.0 }))).toBe(180);
        expect(Math.round(direzioneVerso(A, { lat: 37.5, lng: 14.99 }))).toBe(270);
    });
    it('lo scarto fra due angoli prende la via corta', () => {
        expect(scartoAngolo(10, 350)).toBe(20);
        expect(scartoAngolo(350, 10)).toBe(-20);
        expect(Math.abs(scartoAngolo(180, 0))).toBe(180);
    });
    it('distanza: ~111 m per 0,001° di latitudine', () => {
        expect(Math.round(distanzaFraM(A, { lat: 37.501, lng: 15.0 }))).toBe(111);
    });
});

describe('la camera: volo, direzione di marcia, lisciatura', () => {
    it('interpola da una vista all\'altra, con partenza e arrivo esatti', () => {
        const da = { lat: 37.5, lng: 15.0, zoom: 14, tilt: 0, heading: 0 };
        const a = { lat: 37.51, lng: 15.02, zoom: 18, tilt: 50, heading: 90 };
        expect(interpola(da, a, 0)).toMatchObject({ lat: 37.5, zoom: 14, tilt: 0, heading: 0 });
        expect(interpola(da, a, 1)).toMatchObject({ lat: 37.51, lng: 15.02, zoom: 18, tilt: 50, heading: 90 });
        const meta = interpola(da, a, 0.5);
        expect(meta.zoom).toBeGreaterThan(15); expect(meta.zoom).toBeLessThan(17);
    });
    it('la rotazione prende la via corta (350° → 10° passa da 0°, non da 180°)', () => {
        expect(Math.round(lerpAngolo(350, 10, 0.5))).toBe(0);
        expect(Math.round(lisciaAngolo(350, 10, 0.5))).toBe(0);
        expect(lisciaAngolo(null, 40)).toBe(40);
    });
    it('zoom 17–18 e inclinazione 45–55° sempre', () => {
        for (const z of [10, 17, 17.5, 19, 22, NaN]) expect(zoomNav(z)).toBeGreaterThanOrEqual(ZOOM_NAV_MIN) && expect(zoomNav(z)).toBeLessThanOrEqual(ZOOM_NAV_MAX);
        for (const t of [0, 30, 50, 60, 80, NaN]) { expect(tiltNav(t)).toBeGreaterThanOrEqual(TILT_NAV_MIN); expect(tiltNav(t)).toBeLessThanOrEqual(TILT_NAV_MAX); }
    });
    const P = { lat: 37.5, lng: 15.0 };
    const percorsoNord = [P, { lat: 37.5001, lng: 15.0 }, { lat: 37.5003, lng: 15.0 }, { lat: 37.5006, lng: 15.0 }];
    it('la direzione di marcia: prima la bussola, poi il percorso davanti a te, poi la prossima tappa, poi niente', () => {
        expect(direzioneDiMarcia({ bussola: 123, posizione: P, percorso: percorsoNord })).toBe(123);
        expect(Math.round(direzioneDiMarcia({ bussola: null, posizione: P, percorso: percorsoNord }))).toBe(0);
        expect(Math.round(direzioneDiMarcia({ posizione: P, tappa: { lat: 37.5, lng: 15.01 } }))).toBe(90);
        expect(direzioneDiMarcia({ posizione: P })).toBeNull();
    });
    it('volaCamera: ~1,5 s, un fotogramma per volta, arriva dove deve e avvisa', () => {
        let t = 0; const fotogrammi = [];
        const map = {
            getCenter: () => ({ lat: () => 37.5, lng: () => 15.0 }), getZoom: () => 14, getTilt: () => 0, getHeading: () => 0,
            moveCamera: vi.fn((c) => fotogrammi.push(c)),
        };
        const coda = []; const raf = (f) => coda.push(f);
        const fine = vi.fn();
        volaCamera(map, { lat: 37.51, lng: 15.01, zoom: 18, tilt: 50, heading: 80 }, { durata: VOLO_MS, onFine: fine, raf, ora: () => t });
        expect(VOLO_MS).toBe(1500);
        for (let i = 0; i < 40 && coda.length; i++) { t += 50; coda.shift()(); }
        expect(fotogrammi.length).toBeGreaterThan(15);
        const ultimo = fotogrammi.at(-1);
        expect(ultimo).toMatchObject({ zoom: 18, tilt: 50, heading: 80, center: { lat: 37.51, lng: 15.01 } });
        expect(fine).toHaveBeenCalledTimes(1);
        // nessun salto: ogni fotogramma e' fra il precedente e l'arrivo (zoom crescente)
        const zoom = fotogrammi.map(c => c.zoom);
        expect(zoom).toEqual([...zoom].sort((a, b) => a - b));
    });
    it('un nuovo volo interrompe il precedente', () => {
        const mk = () => ({ getCenter: () => ({ lat: () => 1, lng: () => 1 }), getZoom: () => 10, getTilt: () => 0, getHeading: () => 0, moveCamera: vi.fn() });
        const a = mk(), b = mk(); const code = [];
        const raf = (f) => code.push(f);
        volaCamera(a, { lat: 2, lng: 2 }, { raf, ora: () => 0 });
        volaCamera(b, { lat: 3, lng: 3 }, { raf, ora: () => 0 });
        const prima = a.moveCamera.mock.calls.length;
        code.forEach(f => f());
        expect(a.moveCamera.mock.calls.length).toBe(prima); // il primo volo e' fermo
    });
});

describe('durante la dissolvenza la camera comanda tutte e due le mappe', () => {
    it('moveCamera/panTo vanno a entrambe; il resto solo alla principale', () => {
        const mk = () => ({ moveCamera: vi.fn(), panTo: vi.fn(), getZoom: vi.fn(() => 17) });
        const a = mk(), b = mk();
        const m = specchiaCamera(a, b);
        m.moveCamera({ zoom: 18 }); m.panTo({ lat: 1, lng: 2 });
        expect(a.moveCamera).toHaveBeenCalledWith({ zoom: 18 }); expect(b.moveCamera).toHaveBeenCalledWith({ zoom: 18 });
        expect(b.panTo).toHaveBeenCalled();
        expect(m.getZoom()).toBe(17); expect(b.getZoom).not.toHaveBeenCalled();
        expect(specchiaCamera(a, null)).toBe(a);
    });
});

describe('la freccia di partenza', () => {
    const utente = { lat: 37.5, lng: 15.0 };
    const tappaEst = { lat: 37.5, lng: 15.005 }; // a est
    it('punta la direzione fisica verso la prima tappa, relativa a dove guarda la camera', () => {
        expect(angoloFrecciaPartenza({ utente, tappa: tappaEst, orientamentoCamera: 0 })).toBe(90);
        expect(angoloFrecciaPartenza({ utente, tappa: tappaEst, orientamentoCamera: 90 })).toBe(0);
        expect(angoloFrecciaPartenza({ utente, tappa: tappaEst, orientamentoCamera: 180 })).toBe(-90);
    });
    it('sparisce dopo 10 m nel verso giusto, non prima e non nel verso sbagliato', () => {
        const dMetri = (m) => ({ lat: 37.5, lng: 15.0 + m / (111320 * Math.cos(37.5 * Math.PI / 180)) });
        expect(PARTENZA_METRI).toBe(10);
        expect(partenzaCompiuta({ partenza: utente, posizione: dMetri(5), tappa: tappaEst })).toBe(false); // meno di 10 m
        expect(partenzaCompiuta({ partenza: utente, posizione: dMetri(12), tappa: tappaEst })).toBe(true); // 12 m verso est
        expect(partenzaCompiuta({ partenza: utente, posizione: dMetri(-12), tappa: tappaEst })).toBe(false); // 12 m verso ovest
        expect(partenzaCompiuta({ partenza: utente, posizione: { lat: 37.5001, lng: 15.0 }, tappa: tappaEst })).toBe(false); // 11 m a nord: 90° dal verso giusto
    });
    it('senza dati non fa niente', () => {
        expect(partenzaCompiuta({})).toBe(false);
        expect(angoloFrecciaPartenza({ utente, tappa: {} })).toBeNull();
    });
});

describe('la foto nella scheda in basso: vera o niente', () => {
    it('una foto di Places si mostra; stock, segnaposto o niente: nessuna foto', () => {
        expect(fotoVera({ googlePhoto: 'https://places.googleapis.com/photo?ref=abc' })).toContain('places.googleapis.com');
        expect(fotoVera({ image: 'https://lh3.googleusercontent.com/p/abc' })).toContain('googleusercontent');
        expect(fotoVera({ image: 'https://images.unsplash.com/photo-1' })).toBeNull();
        expect(fotoVera({ image: '/img/placeholder.jpg' })).toBeNull();
        expect(fotoVera({ image: '' })).toBeNull();
        expect(fotoVera(null)).toBeNull();
    });
});

describe('volaCamera con la mappa «di adesso»', () => {
    it('se la mappa attiva cambia a meta\' volo (dissolvenza di fascia), i fotogrammi dopo vanno alla nuova', () => {
        const mk = () => ({ getCenter: () => ({ lat: () => 1, lng: () => 1 }), getZoom: () => 10, getTilt: () => 0, getHeading: () => 0, moveCamera: vi.fn() });
        const vecchia = mk(), nuova = mk();
        let attiva = vecchia, t = 0; const coda = [];
        volaCamera(() => attiva, { lat: 2, lng: 2, zoom: 18, tilt: 50, heading: 10 }, { raf: (f) => coda.push(f), ora: () => t });
        for (let i = 0; i < 5; i++) { t += 100; coda.shift()(); }
        attiva = nuova;
        while (coda.length && t < 2000) { t += 100; coda.shift()(); }
        expect(vecchia.moveCamera).toHaveBeenCalled();
        expect(nuova.moveCamera).toHaveBeenCalled();
        expect(nuova.moveCamera.mock.calls.at(-1)[0]).toMatchObject({ zoom: 18, tilt: 50, heading: 10 });
    });
});
