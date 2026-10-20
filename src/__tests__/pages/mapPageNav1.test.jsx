/**
 * NAV-1 — la navigazione non si blocca (rosso su b096732, verde dopo NAV-1).
 * MapPage montata davvero con un GPS finto comandato dal test; Google Maps, Supabase e i servizi sono finti.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fakeMap = { moveCamera: vi.fn(), panTo: vi.fn(), getBounds: () => null, fitBounds: vi.fn() };
let routeStatsCb = null;
vi.mock('@vis.gl/react-google-maps', () => ({
    useMap: () => fakeMap,
    useMapsLibrary: () => null,
    InfoWindow: ({ children }) => children,
}));
vi.mock('@/components/MapAPIWrapper', () => ({ default: ({ children }) => children }));
vi.mock('@/components/UnnivaiMap', () => ({
    default: (props) => { routeStatsCb = props.onRouteStats; return <div data-testid="mappa" />; },
}));
vi.mock('@/components/Map/WeatherAirBadge', () => ({ WeatherAirBadge: () => null }));
vi.mock('@/components/Map/AIDrawer', () => ({ AIDrawer: () => null }));
vi.mock('@/components/Map/CitySearchBar', () => ({ CitySearchBar: () => null }));
vi.mock('@/components/GpsActivationBanner', () => ({ default: () => null }));
vi.mock('@/components/Map/TourSummaryModal', () => ({ TourSummaryModal: () => null }));
vi.mock('@/hooks/useUserContext', () => ({
    useUserContext: () => ({ city: 'Catania', lat: 37.5, lng: 15.08, isLoading: false }),
}));
vi.mock('@/context/CityContext', () => ({ useCity: () => ({ isManual: false }) }));
vi.mock('@/hooks/useAILearning', () => ({ useAILearning: () => ({ trackDnaEvent: vi.fn() }) }));
vi.mock('@/lib/navTelemetry', () => ({ logNavEvent: vi.fn() }));
// Ogni metodo dei servizi risponde vuoto.
vi.mock('@/services/dataService', () => ({ dataService: new Proxy({}, { get: () => async () => [] }) }));
vi.mock('@/services/poiService', () => ({ poiService: new Proxy({}, { get: () => async () => [] }) }));
vi.mock('@/lib/supabase', () => ({
    supabase: { from: () => ({ select: () => ({ eq: () => ({ data: [], error: null }), ilike: () => ({ data: [], error: null }) }) }) },
}));

import MapPage from '@/pages/MapPage';
// La chiave del giro salvato (navSession.GIRO_KEY), scritta qui: il test non importa il modulo nuovo
// e su b096732 fallisce per il comportamento, non per un import mancante.
const GIRO_KEY = 'dvai_nav_giro_v1';

// Tre tappe a Catania (centro: punti pubblici, nessuna posizione di utenti).
const TOUR = {
    id: 'tour-nav1',
    title: 'Giro di prova',
    city: 'Catania',
    steps: [
        { id: 's1', title: 'Fontana dell\'Elefante', lat: 37.50270, lng: 15.08710 },
        { id: 's2', title: 'Via Crociferi', lat: 37.50500, lng: 15.08500 },
        { id: 's3', title: 'Teatro Massimo Bellini', lat: 37.50380, lng: 15.09030 },
    ],
};

// GPS finto: il test decide quando arriva una posizione, un errore o niente.
function gpsFinto() {
    const watchers = new Map();
    let id = 0;
    const g = {
        posizione: null, // se impostata, getCurrentPosition risponde subito con questa
        getCurrentPosition: vi.fn((ok) => { if (g.posizione) ok({ coords: { ...g.posizione, accuracy: 8 } }); }),
        watchPosition: vi.fn((ok, ko, opts) => { id += 1; watchers.set(id, { ok, ko, opts }); return id; }),
        clearWatch: vi.fn((i) => watchers.delete(i)),
        emit(lat, lng, accuracy = 8) {
            for (const w of [...watchers.values()]) w.ok({ coords: { latitude: lat, longitude: lng, accuracy } });
        },
        fail(code) { for (const w of [...watchers.values()]) w.ko?.({ code, message: 'x' }); },
        // i watch ad alta precisione: quelli della navigazione (quello di sfondo è a bassa precisione)
        attivi: () => [...watchers.values()].filter(w => w.opts?.enableHighAccuracy).length,
    };
    return g;
}

let gps;
const monta = (state = { tourData: TOUR }) => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[{ pathname: '/map', state }]}>
            <MapPage />
        </MemoryRouter>
    </QueryClientProvider>,
);
const avvia = () => {
    fireEvent.click(screen.getByText('Avvia'));
    fireEvent.click(screen.getByText('Avvia Navigazione'));
};

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    gps = gpsFinto();
    Object.defineProperty(global.navigator, 'geolocation', { value: gps, configurable: true });
    localStorage.clear();
    routeStatsCb = null;
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
});

describe('NAV-1 — tracciamento sempre attivo', () => {
    it('primo GPS dopo 30 s: il tracciamento è attivo e la prima tappa si sblocca quando la posizione arriva', () => {
        monta();
        avvia();
        // Nessuna posizione per 30 secondi.
        act(() => { vi.advanceTimersByTime(30_000); });
        expect(gps.attivi()).toBeGreaterThan(0);
        expect(screen.getByText('Cerco il segnale. Intanto segui la mappa: le tappe si sbloccano appena ti trovo.')).toBeInTheDocument();
        // Il segnale arriva: sei lontano, poi alla prima tappa.
        act(() => { gps.emit(37.5100, 15.0800); });
        // NAV-1-FIX (D2): l'arrivo vuole due letture di fila dentro la soglia.
        act(() => { gps.emit(37.50270, 15.08710); });
        act(() => { gps.emit(37.50270, 15.08710); });
        expect(screen.getByText('Tappa 2/3')).toBeInTheDocument();
    });

    it('posizione negata: il messaggio dice come attivarla o segnare le tappe a mano', () => {
        monta();
        avvia();
        act(() => { gps.fail(1); });
        expect(screen.getByText('Senza posizione non posso guidarti. Attivala in Impostazioni › Safari › Posizione, oppure segna le tappe a mano.')).toBeInTheDocument();
    });
});

describe('NAV-1 — comandi nella barra', () => {
    it('«Sono arrivato» nella barra di navigazione segna la tappa', () => {
        monta();
        avvia();
        fireEvent.click(screen.getByText('Sono arrivato'));
        expect(screen.getByText('Tappa 2/3')).toBeInTheDocument();
    });

    it('una tappa superata senza fermarsi: «Sei passato da [nome]?» con «Vista» e «Saltala»', () => {
        monta();
        avvia();
        // Ti avvicini a 50 m dalla Fontana (fuori soglia 25 m), poi ti allontani.
        act(() => { gps.emit(37.50500, 15.08710); });
        act(() => { vi.advanceTimersByTime(1000); gps.emit(37.50315, 15.08710); });
        act(() => { vi.advanceTimersByTime(1000); gps.emit(37.50360, 15.08800); });
        act(() => { vi.advanceTimersByTime(1000); gps.emit(37.50400, 15.08900); });
        expect(screen.getByText('Sei passato da Fontana dell\'Elefante?')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Saltala'));
        expect(screen.getByText('Tappa 2/3')).toBeInTheDocument();
    });

    it('percorso non calcolabile: nessun codice inglese, il messaggio italiano', () => {
        monta();
        avvia();
        act(() => { routeStatsCb?.({ error: 'ZERO_RESULTS', distanceM: 0, durationSec: 0 }); });
        expect(screen.queryByText(/ZERO_RESULTS/)).toBeNull();
        expect(screen.getByText('Non riesco a calcolare il percorso fin qui. Aprilo in Mappe o passa alla tappa dopo.')).toBeInTheDocument();
    });
});

describe('NAV-1 — ripresa dopo una ricarica', () => {
    it('ricarica a metà giro: si propone di riprendere dalla tappa giusta e si riprende', () => {
        gps.posizione = { latitude: 37.5100, longitude: 15.0800 };
        const prima = monta();
        avvia();
        // La prima tappa si fa col GPS (lontano, poi sul posto).
        act(() => { gps.emit(37.5100, 15.0800); });
        act(() => { gps.emit(37.50270, 15.08710); });
        act(() => { gps.emit(37.50270, 15.08710); });
        expect(screen.getByText('Tappa 2/3')).toBeInTheDocument();
        prima.unmount(); // la ricarica: la pagina sparisce, resta solo ciò che è salvato
        monta();
        expect(screen.getByText('Hai un giro in corso: tappa 2 di 3. Riprendi?')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Riprendi'));
        expect(screen.getByText('Tappa 2/3')).toBeInTheDocument();
    });

    it('un giro iniziato da più di 12 ore non si propone più', () => {
        const prima = monta();
        avvia();
        prima.unmount();
        const g = JSON.parse(localStorage.getItem(GIRO_KEY));
        expect(g).toBeTruthy();
        localStorage.setItem(GIRO_KEY, JSON.stringify({ ...g, startedAt: Date.now() - 12 * 3600_000 - 60_000 }));
        monta();
        expect(screen.queryByText(/Hai un giro in corso/)).toBeNull();
        expect(localStorage.getItem(GIRO_KEY)).toBeNull();
    });
});
