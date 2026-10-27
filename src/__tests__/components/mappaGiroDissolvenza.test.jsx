// nav-camera — la mappa del giro: Ossidiana sempre; col cambio di fascia la mappa nuova si prepara sotto, compare in dissolvenza (~600 ms)
// e la vecchia viene rilasciata; al massimo una volta per fascia; senza la variabile della fascia si resta su Ossidiana.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({ istanze: {}, idle: {} }));
vi.mock('@vis.gl/react-google-maps', async () => {
    const React = await import('react');
    const ctx = React.createContext(null);
    return {
        GoogleMapsContext: ctx,
        Map: ({ id, mapId, colorScheme }) => <div data-testid={`map-${id}`} data-mapid={mapId} data-scheme={colorScheme} />,
        useMap: (id) => h.istanze[id] || null,
    };
});

const falsaMappa = (nome) => ({
    nome, getCenter: () => ({ lat: () => 37.5, lng: () => 15.0 }), getZoom: () => 16, getTilt: () => 0, getHeading: () => 0, moveCamera: vi.fn(),
});

async function carica(env) {
    vi.resetModules(); vi.unstubAllEnvs();
    vi.stubEnv('VITE_GOOGLE_MAP_ID', 'ID_NORMALE');
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    return (await import('@/components/Map/GoogleMapContainer')).default;
}
const centro = { latitude: 37.5, longitude: 15.0 };
const strati = (c) => [...c.querySelectorAll('[data-strato]')];
const AMBIENTE = { VITE_GOOGLE_MAP_ID_NAV: 'OSSIDIANA', VITE_GOOGLE_MAP_ID_NAV_TRAMONTO: 'TRAMONTO', VITE_GOOGLE_MAP_ID_NAV_NOTTE: 'NOTTE' };

describe('la mappa del giro', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        h.istanze = { 'giro-a': falsaMappa('a'), 'giro-b': null };
        h.idle = {};
        window.google = { maps: { event: { addListenerOnce: (m, ev, cb) => { h.idle.cb = cb; return { remove: vi.fn() }; } } } };
    });
    afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); delete window.google; });

    it('con un giro aperto: Ossidiana e colorScheme DARK, una sola mappa, anche prima di navigare', async () => {
        const G = await carica(AMBIENTE);
        const { container, getByTestId } = render(<G initialCenter={centro} giroAttivo isNavigating={false} fascia={null}>{null}</G>);
        expect(strati(container)).toHaveLength(1);
        expect(getByTestId('map-giro-a').dataset.mapid).toBe('OSSIDIANA');
        expect(getByTestId('map-giro-a').dataset.scheme).toBe('DARK');
    });

    it('senza giro aperto la mappa e\' quella di sempre (Esplora non cambia)', async () => {
        const G = await carica(AMBIENTE);
        const { container } = render(<G initialCenter={centro} giroAttivo={false}>{null}</G>);
        expect(container.querySelector('[data-testid="mappa-giro"]')).toBeNull();
    });

    it('cambio di fascia: la nuova mappa si prepara sotto (trasparente), compare in ~600 ms quando ha le tessere, poi la vecchia si rilascia', async () => {
        const G = await carica(AMBIENTE);
        const attive = [];
        const { container, rerender, getByTestId } = render(<G initialCenter={centro} giroAttivo isNavigating fascia="giorno" onMapAttiva={(m) => attive.push(m)}>{null}</G>);
        expect(strati(container)).toHaveLength(1);
        // arriva il tramonto
        h.istanze['giro-b'] = falsaMappa('b');
        rerender(<G initialCenter={centro} giroAttivo isNavigating fascia="tramonto" onMapAttiva={(m) => attive.push(m)}>{null}</G>);
        await act(async () => { vi.advanceTimersByTime(5); });
        expect(strati(container)).toHaveLength(2);
        expect(getByTestId('map-giro-b').dataset.mapid).toBe('TRAMONTO');
        expect(getByTestId('map-giro-b').dataset.scheme).toBe('DARK');
        const [vecchio, nuovo] = strati(container);
        expect(vecchio.style.opacity).toBe('1');
        expect(nuovo.style.opacity).toBe('0'); // sotto la vecchia: nessun fotogramma vuoto
        // la mappa nuova ha caricato le tessere: compare in dissolvenza
        await act(async () => { rerender(<G initialCenter={centro} giroAttivo isNavigating fascia="tramonto" onMapAttiva={(m) => attive.push(m)}>{null}</G>); });
        await act(async () => { h.idle.cb?.(); });
        expect(strati(container)[1].style.opacity).toBe('1');
        expect(strati(container)[1].style.transition).toContain('600ms');
        expect(strati(container)[0].style.opacity).toBe('1'); // la vecchia resta finche' la nuova non e' piena
        // dopo la dissolvenza la vecchia e' rilasciata
        await act(async () => { vi.advanceTimersByTime(700); });
        expect(strati(container)).toHaveLength(1);
        expect(container.querySelector('[data-testid="mappa-giro"]').dataset.mapidAttivo).toBe('TRAMONTO');
        expect(attive.at(-1)).toBe(h.istanze['giro-b']);
    });

    it('se le tessere tardano, la mappa nuova compare comunque dopo 4 s', async () => {
        const G = await carica(AMBIENTE);
        const { container, rerender } = render(<G initialCenter={centro} giroAttivo isNavigating fascia="giorno">{null}</G>);
        h.istanze['giro-b'] = falsaMappa('b');
        rerender(<G initialCenter={centro} giroAttivo isNavigating fascia="notte">{null}</G>);
        await act(async () => { vi.advanceTimersByTime(5); });
        await act(async () => { vi.advanceTimersByTime(4100); });
        expect(strati(container).at(-1).style.opacity).toBe('1');
    });

    it('una fascia senza il suo Map ID resta su Ossidiana: nessuna dissolvenza', async () => {
        const G = await carica({ VITE_GOOGLE_MAP_ID_NAV: 'OSSIDIANA' }); // niente _TRAMONTO / _NOTTE
        const { container, rerender } = render(<G initialCenter={centro} giroAttivo isNavigating fascia="giorno">{null}</G>);
        rerender(<G initialCenter={centro} giroAttivo isNavigating fascia="tramonto">{null}</G>);
        rerender(<G initialCenter={centro} giroAttivo isNavigating fascia="notte">{null}</G>);
        expect(strati(container)).toHaveLength(1);
        expect(container.querySelector('[data-testid="mappa-giro"]').dataset.mapidAttivo).toBe('OSSIDIANA');
    });

    it('al massimo una dissolvenza per fascia', async () => {
        const G = await carica(AMBIENTE);
        const { container, rerender } = render(<G initialCenter={centro} giroAttivo isNavigating fascia="giorno">{null}</G>);
        h.istanze['giro-b'] = falsaMappa('b');
        rerender(<G initialCenter={centro} giroAttivo isNavigating fascia="tramonto">{null}</G>);
        await act(async () => { vi.advanceTimersByTime(5); });
        await act(async () => { h.idle.cb?.(); vi.advanceTimersByTime(700); });
        expect(strati(container)).toHaveLength(1);
        // la fascia oscilla (tramonto → giorno → tramonto): la seconda volta non si rifa'
        h.istanze['giro-a'] = falsaMappa('a2');
        rerender(<G initialCenter={centro} giroAttivo isNavigating fascia="giorno">{null}</G>);
        rerender(<G initialCenter={centro} giroAttivo isNavigating fascia="tramonto">{null}</G>);
        expect(strati(container).length).toBeLessThanOrEqual(2);
    });
});
