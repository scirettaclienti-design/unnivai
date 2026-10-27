/**
 * NAV-2 — la mappa durante il giro: il tratto verso la prossima tappa (arancione), niente «Apri in Mappe», il pannello in basso nella zona sicura
 * (altezza visibile vera). MapPage montata davvero con un GPS finto (come mapPageNav1Fix.test.jsx).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
    contesto: { city: 'Catania', lat: 37.5, lng: 15.08, isLoading: false },
    mappa: null,
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

import MapPage from '@/pages/MapPage';
const GIRO_KEY = 'dvai_nav_giro_v1';

// Uno spostamento di `est`/`nord` metri da un punto.
const sposta = (p, est, nord) => [p[0] + nord / 111320, p[1] + est / (111320 * Math.cos((p[0] * Math.PI) / 180))];

// Catania: tre tappe in fila (punti pubblici).
const CATANIA = {
    id: 'tour-nav2',
    title: 'Giro di prova',
    city: 'Catania',
    steps: [
        { id: 's1', title: 'Fontana dell\'Elefante', lat: 37.50270, lng: 15.08710 },
        { id: 's2', title: 'Via Crociferi', lat: 37.50500, lng: 15.08500 },
        { id: 's3', title: 'Teatro Massimo Bellini', lat: 37.50380, lng: 15.09030 },
    ],
};
// Come Troina in NAV-SIM: dal paese si sale a un monte a 900 m e si torna in paese (la tappa dopo è giù).
const PAESE = [37.78000, 14.60000];
const MONTE = sposta(PAESE, 0, 900);
const BAR = sposta(PAESE, 100, 50);
const ANDATA_E_RITORNO = {
    id: 'tour-monte',
    title: 'Natura e luoghi storici',
    city: 'Troina',
    steps: [
        { id: 'm1', title: 'Piazza in paese', lat: PAESE[0], lng: PAESE[1] },
        { id: 'm2', title: 'Monte Muganà', lat: MONTE[0], lng: MONTE[1] },
        { id: 'm3', title: 'Snack Bar in paese', lat: BAR[0], lng: BAR[1] },
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
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
});


describe('NAV-2 — il percorso a tratti segue il giro', () => {
    it('dove sei nel giro: alla 1ª tappa l\'indice è 0; arrivato alla 1ª si va verso la 2ª (1); alla 2ª verso la 3ª (2)', () => {
        monta(CATANIA);
        avvia();
        expect(h.mappa.progress ?? null).toMatchObject({ nextIdx: 0 });
        const s1 = [CATANIA.steps[0].lat, CATANIA.steps[0].lng];
        const s2 = [CATANIA.steps[1].lat, CATANIA.steps[1].lng];
        passo(s1); passo(s1);
        expect(screen.getByText('Tappa 2 di 3')).toBeInTheDocument();
        expect(h.mappa.progress.nextIdx).toBe(1);
        expect(h.mappa.progress.tappe).toHaveLength(3);
        // si cammina da una tappa all'altra, una posizione ogni ~60 m
        const dist = Math.hypot((s2[0] - s1[0]) * 111320, (s2[1] - s1[1]) * 111320 * Math.cos(s1[0] * Math.PI / 180));
        for (let m = 60; m < dist; m += 60) passo([s1[0] + ((s2[0] - s1[0]) * m) / dist, s1[1] + ((s2[1] - s1[1]) * m) / dist]);
        passo(s2); passo(s2);
        expect(screen.getByText('Tappa 3 di 3')).toBeInTheDocument();
        expect(h.mappa.progress.nextIdx).toBe(2);
    });
    it('fuori dalla navigazione nessun tratto è «prossimo»', () => {
        monta(CATANIA);
        expect(h.mappa.progress ?? null).toBeNull();
    });
});

describe('NAV-2 — l\'utente resta in Unnivai', () => {
    it('nella barra di navigazione nessun «Apri in Mappe» e nessun link verso altre app', () => {
        monta(CATANIA);
        avvia();
        const barra = screen.getByTestId('nav-hud-barra');
        expect(barra.textContent).not.toMatch(/Apri in Mappe/i);
        expect(barra.querySelectorAll('a[href]')).toHaveLength(0);
        expect(document.querySelector('a[href*="maps.apple.com"], a[href*="google.com/maps"]')).toBeNull();
    });
});

describe('NAV-2 — la pagina e i pannelli stanno nell\'altezza visibile (Safari) e nella zona sicura', () => {
    it('la pagina è alta quanto la parte VISIBILE (dvh), non quanto la finestra con la barra di Safari', () => {
        monta(CATANIA);
        expect(screen.getByTestId('map-root').style.height).toBe('100dvh');
    });
    it('la card «Avvia» sta sopra la zona sicura in basso', () => {
        monta(CATANIA);
        expect(screen.getByTestId('map-avvia-card').getAttribute('style')).toContain('env(safe-area-inset-bottom)');
    });
});
