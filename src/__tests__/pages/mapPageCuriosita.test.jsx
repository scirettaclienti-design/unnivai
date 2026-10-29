/**
 * CURIOSITA-CITTA — a piedi, ogni ~300 m: solo curiosità della città del giro, a schermo e a voce. Catania non sente Roma. 0 $.
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



const arriva = (n) => {
    const s = CATANIA.steps[n];
    passo([s.lat, s.lng]); passo([s.lat, s.lng]);
};


const toast = [];
const ascolta = (e) => toast.push(e.detail.message);
beforeEach(() => { toast.length = 0; window.addEventListener('dvai:toast', ascolta); });
afterEach(() => { window.removeEventListener('dvai:toast', ascolta); });

// Cammina: una posizione, poi 400 m più a nord (oltre i 300 m della sorpresa).
const cammina = () => {
    const p0 = [CATANIA.steps[0].lat, CATANIA.steps[0].lng];
    passo(p0); passo(p0);
    const p1 = sposta(p0, 0, 400);
    passo(p1); passo(p1);
    const p2 = sposta(p1, 0, 400);
    passo(p2); passo(p2);
};
const curiosita = () => toast.filter(m => m.startsWith('🎧'));

describe('CURIOSITA-CITTA — nessuna curiosità della città sbagliata', () => {
    it('giro a Catania: nessuna curiosità (né Roma né generiche), né a schermo né a voce', () => {
        monta({ ...CATANIA, city: 'Catania' });
        avvia();
        cammina();
        expect(curiosita()).toEqual([]);
        expect(h.parla.mock.calls.filter(c => /fontanelle|nasoni|Roma/i.test(c[0]))).toEqual([]);
    });

    it('giro a Roma: la curiosità di Roma esce a schermo e a voce', () => {
        monta({ ...CATANIA, city: 'Roma' });
        avvia();
        cammina();
        expect(curiosita().length).toBeGreaterThan(0);
        expect(curiosita().every(m => /Roma ha più di duemila fontanelle/.test(m))).toBe(true);
        expect(h.parla.mock.calls.some(c => /nasoni/.test(c[0]))).toBe(true);
    });

    it('giro senza città nota: nessuna curiosità', () => {
        const { city, ...senzaCitta } = CATANIA; // eslint-disable-line no-unused-vars
        monta(senzaCitta);
        avvia();
        cammina();
        expect(curiosita()).toEqual([]);
    });
});
