/**
 * APP-NATIVA — l'account demo del revisore Apple: dal suo telefono lontano (Cupertino) il giro dimostrativo di Catania
 * parte con la posizione simulata e «Simula il cammino» porta agli arrivi; nessun altro utente ha la posizione simulata. 0 $.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
    contesto: { city: 'Catania', lat: 37.5, lng: 15.08, isLoading: false },
    mappa: null,
    parla: vi.fn(),
    utente: null,
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: h.utente }) }));
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
import { GIRO_DEMO } from '@/data/giroDemo';

const GIRO_KEY = 'dvai_nav_giro_v1';
const CUPERTINO = [37.3349, -122.009];
const DEMO = { id: 'u-demo', app_metadata: { unnivai_demo_revisore: true } };

function gpsFinto() {
    const watchers = new Map();
    let id = 0;
    const g = {
        posizione: null,
        getCurrentPosition: vi.fn((ok) => { if (g.posizione) ok({ coords: { ...g.posizione, accuracy: 8 } }); }),
        watchPosition: vi.fn((ok, ko, opts) => { id += 1; watchers.set(id, { ok, ko, opts }); if (g.posizione) ok({ coords: { ...g.posizione, accuracy: 8 } }); return id; }),
        clearWatch: vi.fn((i) => watchers.delete(i)),
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
const avanti = (ms) => act(() => { vi.advanceTimersByTime(ms); });
const inNavigazione = () => screen.queryByTestId('map-avvia-card') === null;

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    gps = gpsFinto();
    gps.posizione = { latitude: CUPERTINO[0], longitude: CUPERTINO[1] };
    Object.defineProperty(global.navigator, 'geolocation', { value: gps, configurable: true });
    localStorage.clear();
    h.contesto = { city: 'Catania', lat: 37.5, lng: 15.08, isLoading: false };
    h.mappa = null;
    h.parla.mockClear();
    h.utente = null;
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
});

describe('APP-NATIVA — account demo del revisore', () => {
    it('account demo + giro demo dal telefono a Cupertino: «Avvia» guida, la posizione è simulata, «Simula il cammino» porta all\'arrivo', () => {
        h.utente = DEMO;
        monta(GIRO_DEMO);
        avanti(1500);
        fireEvent.click(screen.getByText('Avvia'));
        avanti(1500);
        expect(screen.queryByTestId('avviso-lontano')).toBeNull();
        expect(inNavigazione()).toBe(true);
        // il GPS vero non si usa né per la mappa né per la navigazione
        expect(gps.watchPosition).not.toHaveBeenCalled();
        expect(gps.getCurrentPosition).not.toHaveBeenCalled();
        const tasto = screen.getByTestId('simula-cammino');
        expect(tasto.textContent).toContain('Simula il cammino');
        fireEvent.click(tasto);
        expect(screen.getByTestId('simula-cammino').textContent).toContain('Ferma il cammino');
        // ~250 m a 2,5 m/s: la prima tappa in meno di 2 minuti
        for (let s = 0; s < 150; s++) avanti(1000);
        const giro = JSON.parse(localStorage.getItem(GIRO_KEY) || 'null');
        expect(giro?.completedSteps || []).toContain('demo-elefante');
    });

    it('account demo: il cammino simulato arriva a tutte e cinque le tappe e il giro finisce', () => {
        h.utente = DEMO;
        monta(GIRO_DEMO);
        avanti(1500);
        fireEvent.click(screen.getByText('Avvia'));
        avanti(1500);
        fireEvent.click(screen.getByTestId('simula-cammino'));
        for (let s = 0; s < 15 * 60; s++) avanti(1000);
        expect(screen.getByTestId('simula-cammino').textContent).toContain('Giro camminato');
        // la fine giro si apre e dice la città del giro
        expect(screen.getByTestId('fine-giro')).toBeTruthy();
        expect(screen.getByTestId('fine-titolo').textContent).toBe('Catania, a modo tuo.');
    }, 60_000);

    it('un altro utente con lo stesso giro da Cupertino: GPS vero, «Avvia» non guida, nessun tasto di simulazione', () => {
        h.utente = { id: 'u-altro', app_metadata: {}, user_metadata: { unnivai_demo_revisore: true } };
        monta(GIRO_DEMO);
        avanti(1500);
        expect(gps.watchPosition).toHaveBeenCalled();
        fireEvent.click(screen.getByText('Avvia'));
        expect(inNavigazione()).toBe(false);
        expect(screen.getByTestId('avviso-lontano').textContent).toMatch(/^Sei a \d[\d.]* km da Catania/);
        expect(screen.queryByTestId('simula-cammino')).toBeNull();
    });

    it('l\'account demo con un giro qualunque: GPS vero, niente simulazione', () => {
        h.utente = DEMO;
        const giro = { ...GIRO_DEMO, id: 'giro-vero', demoRevisore: undefined, percorsoDemo: undefined };
        monta(giro);
        avanti(1500);
        expect(gps.watchPosition).toHaveBeenCalled();
        fireEvent.click(screen.getByText('Avvia'));
        expect(inNavigazione()).toBe(false);
        expect(screen.queryByTestId('simula-cammino')).toBeNull();
    });
});
