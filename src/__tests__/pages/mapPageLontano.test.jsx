/**
 * GIRO-LONTANO — panoramica e «Avvia» con l'utente in città, a ~535 km e senza posizione. 0 $.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
    contesto: { city: 'Catania', lat: 37.5, lng: 15.08, isLoading: false },
    mappa: null,
    parla: vi.fn(),
}));
const fakeMap = { moveCamera: vi.fn(), panTo: vi.fn(), getBounds: () => null, fitBounds: vi.fn() };
vi.mock('@vis.gl/react-google-maps', () => ({
    useMap: () => fakeMap,
    useMapsLibrary: () => null,
    InfoWindow: ({ children }) => children,
}));
vi.mock('@/components/MapAPIWrapper', () => ({ default: ({ children }) => children }));
vi.mock('@/components/UnnivaiMap', () => ({
    default: (props) => { h.mappa = props; return <div data-testid="mappa" />; },
}));
vi.mock('@/components/Map/WeatherAirBadge', () => ({ WeatherAirBadge: () => null }));
vi.mock('@/components/Map/AIDrawer', () => ({ AIDrawer: () => null }));
// La barra in alto: si legge la città che riceve («Posizione attuale»).
vi.mock('@/components/Map/CitySearchBar', () => ({ CitySearchBar: ({ activeCity }) => <div data-testid="citta">{activeCity}</div> }));
vi.mock('@/components/GpsActivationBanner', () => ({ default: () => null }));
vi.mock('@/components/Map/TourSummaryModal', () => ({ TourSummaryModal: () => null }));
vi.mock('@/hooks/useUserContext', () => ({ useUserContext: () => h.contesto }));
vi.mock('@/context/CityContext', () => ({ useCity: () => ({ isManual: false }) }));
vi.mock('@/hooks/useAILearning', () => ({ useAILearning: () => ({ trackDnaEvent: vi.fn() }) }));
vi.mock('@/lib/navTelemetry', () => ({ logNavEvent: vi.fn() }));
vi.mock('@/services/dataService', () => ({ dataService: new Proxy({}, { get: () => async () => [] }) }));
vi.mock('@/services/poiService', () => ({ poiService: new Proxy({}, { get: () => async () => [] }) }));
vi.mock('@/lib/supabase', () => ({
    supabase: { from: () => ({ select: () => ({ eq: () => ({ data: [], error: null }), ilike: () => ({ data: [], error: null }) }) }) },
}));

vi.mock('@/lib/voce', async (orig) => ({ ...(await orig()), parla: (...a) => h.parla(...a) }));

import MapPage from '@/pages/MapPage';
const GIRO_KEY = 'dvai_nav_giro_v1';

// Uno spostamento di `est`/`nord` metri da un punto.
const sposta = (p, est, nord) => [p[0] + nord / 111320, p[1] + est / (111320 * Math.cos((p[0] * Math.PI) / 180))];

// Catania: tre tappe in fila (punti pubblici).
const ore = { periods: [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: '0700' }, close: { day: d, time: '2300' } })) };
const CATANIA = {
    id: 'tour-nav3',
    title: 'Giro di prova',
    city: 'Catania',
    steps: [
        { id: 's1', title: 'Fontana dell\'Elefante', lat: 37.50270, lng: 15.08710, moment: 'mattina', types: ['tourist_attraction', 'monument'], primaryType: 'monument', stayMinutes: 20, image: 'https://img.test/fontana.jpg', description: 'La fontana di Catania con l\'elefante di pietra lavica. Il simbolo della città.', scheduledTime: '2026-10-27T09:30:00+01:00', openingPeriods: ore.periods },
        { id: 's2', title: 'Via Crociferi', lat: 37.50500, lng: 15.08500, moment: 'mattina', types: ['route'], stayMinutes: 25, description: 'La strada delle chiese barocche.', travelMinutesFromPrev: 4, scheduledTime: '2026-10-27T10:00:00+01:00' },
        { id: 's3', title: 'Teatro Massimo Bellini', lat: 37.50380, lng: 15.09030, moment: 'pranzo', types: ['performing_arts_theater'], stayMinutes: 30, description: 'Il teatro dell\'opera.', scheduledTime: '2026-10-27T12:30:00+01:00' },
    ],
};

function gpsFinto() {
    const watchers = new Map();
    let id = 0;
    const g = {
        posizione: null,
        getCurrentPosition: vi.fn((ok) => { if (g.posizione) ok({ coords: { ...g.posizione, accuracy: 8 } }); }),
        watchPosition: vi.fn((ok, ko, opts) => { id += 1; watchers.set(id, { ok, ko, opts }); return id; }),
        clearWatch: vi.fn((i) => watchers.delete(i)),
        emit(lat, lng, accuracy = 8) {
            for (const w of [...watchers.values()]) w.ok({ coords: { latitude: lat, longitude: lng, accuracy } });
        },
    };
    return g;
}

let gps;
const monta = (tourData) => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[{ pathname: '/map', state: { tourData } }]}>
            <MapPage />
        </MemoryRouter>
    </QueryClientProvider>,
);
const avvia = () => {
    // nav-camera: «Avvia» parte subito (il mezzo si cambia da «Cambia mezzo»)
    fireEvent.click(screen.getByText('Avvia'));
};
// Una posizione al secondo.
const passo = (p, acc) => act(() => { vi.advanceTimersByTime(1000); gps.emit(p[0], p[1], acc); });

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    gps = gpsFinto();
    Object.defineProperty(global.navigator, 'geolocation', { value: gps, configurable: true });
    localStorage.clear();
    h.contesto = { city: 'Catania', lat: 37.5, lng: 15.08, isLoading: false };
    h.mappa = null;
    h.parla.mockClear();
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
});




const toast = [];
const ascolta = (e) => toast.push(e.detail.message);
beforeEach(() => { toast.length = 0; window.addEventListener('dvai:toast', ascolta); });
afterEach(() => { window.removeEventListener('dvai:toast', ascolta); });

const ROMA = [41.9009, 12.4833]; // piazza di Spagna: ~535 km dalla Fontana dell'Elefante
const T1 = [CATANIA.steps[0].lat, CATANIA.steps[0].lng];
const VICINO = sposta(T1, 0, 300);
const titoliPercorso = () => (h.mappa?.routePoints || []).map(p => p.title || p.name);
const inNavigazione = () => screen.queryByTestId('map-avvia-card') === null;
const MESSAGGIO = /^Sei a 5\d\d km da Catania: la guida parte quando sei lì\.$/;

describe('GIRO-LONTANO — sulla mappa il cammino da te conta solo se sei vicino al giro', () => {
    it('utente in città (300 m dalla tappa 1): la panoramica parte da te, «Avvia» guida', () => {
        gps.posizione = { latitude: VICINO[0], longitude: VICINO[1] };
        monta(CATANIA);
        expect(titoliPercorso()[0]).toBe('Tu');
        avvia();
        passo(VICINO);
        expect(inNavigazione()).toBe(true);
        expect(screen.queryByTestId('avviso-lontano')).toBeNull();
        expect(toast.filter(m => /^Sei a /.test(m))).toEqual([]);
    });

    it('utente a ~535 km (Roma): durata e km solo fra le tappe, «Avvia» non guida e lo dice', () => {
        gps.posizione = { latitude: ROMA[0], longitude: ROMA[1] };
        monta(CATANIA);
        expect(titoliPercorso()).toEqual(CATANIA.steps.map(s => s.title));
        expect(titoliPercorso()).not.toContain('Tu');
        const watchPrima = gps.watchPosition.mock.calls.length;
        avvia();
        expect(inNavigazione()).toBe(false);
        expect(screen.getByTestId('avviso-lontano').textContent).toMatch(MESSAGGIO);
        expect(toast.some(m => MESSAGGIO.test(m))).toBe(true);
        expect(gps.watchPosition.mock.calls.length).toBe(watchPrima); // «Avvia» non apre il tracciamento verso un punto a 500 km
        expect(localStorage.getItem(GIRO_KEY)).toBeNull();
    });

    it('posizione negata: la panoramica è fra le tappe, «Avvia» parte lo stesso (tappe segnate a mano, NAV-1)', () => {
        gps.getCurrentPosition.mockImplementation((ok, ko) => ko?.({ code: 1, message: 'denied' }));
        monta(CATANIA);
        expect(titoliPercorso()).toEqual(CATANIA.steps.map(s => s.title));
        avvia();
        expect(inNavigazione()).toBe(true);
        expect(screen.queryByTestId('avviso-lontano')).toBeNull();
    });

    it('«Avvia» senza posizione e primo segnale da Roma: la guida si ferma, torna la panoramica con il messaggio', () => {
        monta(CATANIA);
        avvia();
        expect(inNavigazione()).toBe(true);
        passo(ROMA);
        expect(inNavigazione()).toBe(false);
        expect(screen.getByTestId('avviso-lontano').textContent).toMatch(MESSAGGIO);
        expect(localStorage.getItem(GIRO_KEY)).toBeNull(); // un giro appena avviato non resta «in corso»
    });
});
