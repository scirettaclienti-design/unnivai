/**
 * FINE-GIRO — la data è quella del cammino; «Fine» registra il giro con le tappe davvero raggiunte (MapPage montata davvero). 0 $.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
    contesto: { city: 'Catania', lat: 37.5, lng: 15.08, isLoading: false },
    mappa: null,
    dna: vi.fn(),
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
vi.mock('@/hooks/useAILearning', () => ({ useAILearning: () => ({ trackDnaEvent: h.dna }) }));
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
const ore = { periods: [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: '0700' }, close: { day: d, time: '2300' } })) };
const CATANIA = {
    id: 'tour-nav3',
    title: 'Giro di prova',
    city: 'Catania',
    steps: [
        { id: 's1', title: 'Fontana dell\'Elefante', lat: 37.50270, lng: 15.08710, moment: 'mattina', types: ['tourist_attraction', 'monument'], primaryType: 'monument', stayMinutes: 20, image: 'https://img.test/fontana.jpg', description: 'La fontana di Catania con l\'elefante di pietra lavica. Il simbolo della città.', scheduledTime: '2026-10-30T09:30:00+01:00', openingPeriods: ore.periods },
        { id: 's2', title: 'Via Crociferi', lat: 37.50500, lng: 15.08500, moment: 'mattina', types: ['route'], stayMinutes: 25, description: 'La strada delle chiese barocche.', travelMinutesFromPrev: 4, scheduledTime: '2026-10-30T10:00:00+01:00' },
        { id: 's3', title: 'Teatro Massimo Bellini', lat: 37.50380, lng: 15.09030, moment: 'pranzo', types: ['performing_arts_theater'], stayMinutes: 30, description: 'Il teatro dell\'opera.', scheduledTime: '2026-10-30T12:30:00+01:00' },
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
    h.dna.mockClear();
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


const OGGI = new Date('2026-10-29T10:15:00+01:00');
const dna = () => h.dna.mock.calls.filter(c => c[0] === 'tour_completed');

// Raggiunge la prossima tappa con «Sono arrivato», poi lascia passare il rito d'arrivo.
const raggiungi = () => {
    fireEvent.click(screen.getByTestId('nav-scheda-maniglia'));
    fireEvent.click(screen.getByText('Sono arrivato'));
    act(() => { vi.advanceTimersByTime(2500); });
};
const fine = () => {
    if (!screen.queryByLabelText('Termina navigazione')) fireEvent.click(screen.getByTestId('nav-scheda-maniglia'));
    fireEvent.click(screen.getByLabelText('Termina navigazione'));
    act(() => { vi.advanceTimersByTime(700); });
};

describe('FINE-GIRO — la data e la registrazione', () => {
    beforeEach(() => { vi.setSystemTime(OGGI); });

    it('giro creato per «domani» (30/10) e camminato oggi (29/10): la fine giro dice 29 OTTOBRE', () => {
        monta(CATANIA);
        avvia();
        raggiungi(); raggiungi(); raggiungi();
        act(() => { vi.advanceTimersByTime(2500); });
        expect(screen.getByTestId('fine-etichetta').textContent).toBe('Giro completato · 29 OTTOBRE');
        expect(dna()).toHaveLength(1);
        expect(dna()[0][2].value).toBe('3/3');
    });

    it('«Fine» a metà giro (2 tappe su 3 raggiunte, 67%): registra il giro con le 2 tappe vere, una volta sola, e la fine giro dice 29 OTTOBRE', () => {
        monta(CATANIA);
        avvia();
        raggiungi(); raggiungi();
        fine();
        act(() => { vi.advanceTimersByTime(700); });
        expect(dna()).toHaveLength(1);
        expect(dna()[0][1].map(t => t.id)).toEqual(['s1', 's2']);
        expect(dna()[0][2]).toMatchObject({ city: 'Catania', tourId: 'tour-nav3', value: '2/3' });
        expect(screen.getByTestId('fine-etichetta').textContent).toBe('Giro completato · 29 OTTOBRE');
        expect(screen.getByTestId('fine-nota').textContent).toBe('Sei arrivato a 2 tappe su 3.');
    });

    it('«Fine» con 1 tappa su 3 (33%, sotto il 60%): il riepilogo c\'è, ma il giro non conta come completato e il DNA non si muove', () => {
        monta(CATANIA);
        avvia();
        raggiungi();
        fine();
        act(() => { vi.advanceTimersByTime(700); });
        expect(screen.getByTestId('fine-giro')).toBeInTheDocument();
        expect(dna()).toHaveLength(0);
    });

    it('«Fine» senza nessuna tappa raggiunta: nessun giro, nessun riepilogo, DNA fermo', () => {
        monta(CATANIA);
        avvia();
        fine();
        act(() => { vi.advanceTimersByTime(700); });
        expect(dna()).toHaveLength(0);
        expect(screen.queryByTestId('fine-giro')).toBeNull();
    });

    it('giro tutto saltato: non è completato e non tocca il DNA', () => {
        monta(CATANIA);
        avvia();
        for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Salta tappa' }));
        act(() => { vi.advanceTimersByTime(2500); });
        expect(dna()).toHaveLength(0);
        expect(screen.getByTestId('fine-nota').textContent).toBe('Hai saltato tutte le tappe: il giro finisce qui.');
    });
});
