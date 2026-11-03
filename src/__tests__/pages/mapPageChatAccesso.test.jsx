/**
 * CHAT-ACCESSO-VELOCE — la chat con la guida si apre anche con un giro sulla mappa: «Chiedi alla guida» nella panoramica (accanto a «Cambia mezzo»,
 * mai dentro «Avvia») e nella scheda della tappa (sopra «Riparti», con la tappa come luogo aperto); in navigazione nessun tasto sopra le indicazioni.
 * MapPage montata davvero con un GPS finto (come mapPageNav2.test.jsx); la chat è finta e ricorda le sue props.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
    contesto: { city: 'Catania', lat: 37.5, lng: 15.08, isLoading: false },
    mappa: null,
    chat: null,
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
vi.mock('@/components/Map/AIDrawer', () => ({ AIDrawer: (props) => { h.chat = props; return props.isOpen ? <div data-testid="chat-aperta">{props.selectedPOI?.name || 'giro'}</div> : null; } }));
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
import { NAV_TESTI } from '@/lib/navMessaggi';

const CATANIA = {
    id: 'tour-chat',
    title: 'Giro di prova',
    city: 'Catania',
    steps: [
        { id: 's1', title: 'Fontana dell\'Elefante', lat: 37.50270, lng: 15.08710, place_id: 'ChIJ_elefante_0001' },
        { id: 's2', title: 'Via Crociferi', lat: 37.50500, lng: 15.08500 },
        { id: 's3', title: 'Teatro Massimo Bellini', lat: 37.50380, lng: 15.09030 },
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
const passo = (p, acc) => act(() => { vi.advanceTimersByTime(1000); gps.emit(p[0], p[1], acc); });

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    gps = gpsFinto();
    Object.defineProperty(global.navigator, 'geolocation', { value: gps, configurable: true });
    localStorage.clear();
    h.contesto = { city: 'Catania', lat: 37.5, lng: 15.08, isLoading: false };
    h.mappa = null;
    h.chat = null;
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
});

describe('CHAT-ACCESSO-VELOCE — la panoramica', () => {
    it('con un giro sulla mappa «Chiedi alla guida» c\'è, nella card, fuori dal tasto «Avvia»', () => {
        monta(CATANIA);
        const card = screen.getByTestId('map-avvia-card');
        const tasto = screen.getByTestId('chiedi-guida-panoramica');
        expect(tasto.textContent).toBe(NAV_TESTI.CHIEDI_GUIDA);
        expect(card.contains(tasto)).toBe(true);
        expect(screen.getByTestId('avvia-diretto').contains(tasto)).toBe(false);
        // stessa riga di «Cambia mezzo»: stesso contenitore
        expect(tasto.parentElement).toBe(screen.getByTestId('cambia-mezzo').parentElement);
    });
    it('il tasto apre la chat sul giro (nessun luogo aperto), con le tappe; chiusa, il luogo si azzera', () => {
        monta(CATANIA);
        expect(h.chat.isOpen).toBe(false);
        fireEvent.click(screen.getByTestId('chiedi-guida-panoramica'));
        expect(screen.getByTestId('chat-aperta').textContent).toBe('giro');
        expect(h.chat.isOpen).toBe(true);
        expect(h.chat.tappe.map((t) => t.title || t.name)).toEqual(CATANIA.steps.map((s) => s.title));
        expect(h.chat.prossima).toBeNull(); // fuori dalla navigazione la guida non suppone dove sei
        act(() => h.chat.onClose());
        expect(h.chat.isOpen).toBe(false);
        expect(h.chat.selectedPOI ?? null).toBeNull();
    });
});

describe('CHAT-ACCESSO-VELOCE — in navigazione', () => {
    it('la panoramica sparisce e sopra le indicazioni non c\'è nessun «Chiedi alla guida»', () => {
        monta(CATANIA);
        fireEvent.click(screen.getByText('Avvia'));
        expect(screen.queryByTestId('chiedi-guida-panoramica')).toBeNull();
        expect(screen.getByTestId('nav-hud-barra').textContent).not.toContain(NAV_TESTI.CHIEDI_GUIDA);
        expect(screen.queryByText(NAV_TESTI.CHIEDI_GUIDA)).toBeNull();
    });
    it('arrivato alla tappa: «La scheda» → «Chiedi alla guida» apre la chat su quella tappa, con la prossima tappa del giro', () => {
        monta(CATANIA);
        fireEvent.click(screen.getByText('Avvia'));
        const s1 = [CATANIA.steps[0].lat, CATANIA.steps[0].lng];
        passo(s1); passo(s1);
        act(() => { vi.advanceTimersByTime(3000); });
        fireEvent.click(screen.getByText('La scheda'));
        const scheda = screen.getByTestId('scheda-tappa');
        const tasto = screen.getByTestId('chiedi-guida-scheda');
        expect(scheda.contains(tasto)).toBe(true);
        fireEvent.click(tasto);
        expect(h.chat.isOpen).toBe(true);
        expect(h.chat.selectedPOI.name).toBe('Fontana dell\'Elefante');
        expect(h.chat.selectedPOI.place_id).toBe('ChIJ_elefante_0001');
        expect(Number(h.chat.selectedPOI.latitude ?? h.chat.selectedPOI.lat)).toBeCloseTo(37.5027, 3);
        expect(h.chat.prossima?.name || h.chat.prossima?.title).toBe('Via Crociferi');
        // la scheda resta sotto la chat: chiusa la chat si torna alla scheda
        act(() => h.chat.onClose());
        expect(screen.getByTestId('scheda-tappa')).toBeInTheDocument();
        expect(h.chat.selectedPOI ?? null).toBeNull();
    });
});
