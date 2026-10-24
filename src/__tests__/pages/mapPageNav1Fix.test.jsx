/**
 * NAV-1-FIX — i difetti D1, D2, D3 trovati da NAV-SIM (docs/prove/2026-10-16-nav-sim.md), rossi su main 5b82249.
 * MapPage montata davvero con un GPS finto comandato dal test (come mapPageNav1.test.jsx). Il test non importa i moduli
 * nuovi: su main fallisce per il comportamento, non per un import mancante.
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
    id: 'tour-nav1fix',
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
    fireEvent.click(screen.getByText('Avvia'));
    fireEvent.click(screen.getByText('Avvia Navigazione'));
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

describe('D1 — dopo una pausa del segnale si chiede «Sei passato da…?» solo se sei davvero oltre la tappa', () => {
    it('caso Monte Muganà: a metà salita, dopo 2 minuti senza segnale, nessuna domanda', () => {
        h.contesto = { city: 'Troina', lat: PAESE[0], lng: PAESE[1], isLoading: false };
        monta(ANDATA_E_RITORNO);
        avvia();
        // In paese: la prima tappa (due letture sul posto).
        passo(PAESE); passo(PAESE);
        expect(screen.getByText('Tappa 2 di 3')).toBeInTheDocument();
        // Si sale verso il monte: 100, 200, 300 m (il monte è a 600 m).
        for (const n of [100, 200, 300]) passo(sposta(PAESE, 0, n));
        // 2 minuti senza segnale.
        act(() => { vi.advanceTimersByTime(120_000); });
        // Il segnale torna 145 m più su: il monte è a 455 m, il bar in paese a ~400 m (più vicino del monte, 856 m).
        passo(sposta(PAESE, 0, 445));
        passo(sposta(PAESE, 0, 460));
        expect(screen.queryByText('Sei passato da Monte Muganà?')).toBeNull();
        expect(screen.getByText('Tappa 2 di 3')).toBeInTheDocument();
    });

    it('controllo: passata la tappa durante la pausa (90 m oltre, verso la dopo) la domanda c\'è ancora', () => {
        monta(CATANIA);
        avvia();
        const s1 = [CATANIA.steps[0].lat, CATANIA.steps[0].lng];
        const s2 = [CATANIA.steps[1].lat, CATANIA.steps[1].lng];
        const s3 = [CATANIA.steps[2].lat, CATANIA.steps[2].lng];
        passo(s1); passo(s1);
        expect(screen.getByText('Tappa 2 di 3')).toBeInTheDocument();
        // A 60 m da Via Crociferi, poi lo schermo si blocca 2 minuti.
        const verso = (a, b, m) => { const d = Math.hypot((b[0] - a[0]) * 111320, (b[1] - a[1]) * 111320 * Math.cos(a[0] * Math.PI / 180)); return [a[0] + ((b[0] - a[0]) * m) / d, a[1] + ((b[1] - a[1]) * m) / d]; };
        passo(verso(s2, s1, 120));
        passo(verso(s2, s1, 60));
        act(() => { vi.advanceTimersByTime(120_000); });
        passo(verso(s2, s3, 90));
        expect(screen.getByText('Sei passato da Via Crociferi?')).toBeInTheDocument();
    });
});

describe('D2 — niente arrivo con il GPS che tocca la soglia per una lettura sola', () => {
    it('una lettura dentro i 25 m e poi fuori: la tappa non scatta; due di fila sì', () => {
        monta(CATANIA);
        avvia();
        const s1 = [CATANIA.steps[0].lat, CATANIA.steps[0].lng];
        passo([37.5100, 15.0800]);              // lontano
        passo(sposta(s1, 0, 20));               // UNA lettura a 20 m (il rumore)
        passo(sposta(s1, 0, 45));               // di nuovo fuori, a 45 m
        expect(screen.getByText('Tappa 1 di 3')).toBeInTheDocument();
        passo(sposta(s1, 0, 15));
        passo(sposta(s1, 0, 8));                // due di fila dentro: arrivato
        expect(screen.getByText('Tappa 2 di 3')).toBeInTheDocument();
    });
});

describe('D3 — dopo la ricarica la mappa non mostra mai «Roma»', () => {
    it('GPS non ancora risolto: la città è quella del giro e la mappa parte dalla tappa in corso', () => {
        // Come dopo una ricarica: la posizione dell'utente non è ancora nota, la città nemmeno.
        h.contesto = { city: undefined, lat: undefined, lng: undefined, isLoading: true };
        localStorage.setItem(GIRO_KEY, JSON.stringify({
            v: 1, chiave: `id:${CATANIA.id}`, tourData: CATANIA, completedSteps: ['s1'], skippedSteps: [],
            targetStepId: null, singleTarget: false, startedAt: Date.now() - 60_000, mode: 'walking', savedAt: Date.now(),
        }));
        monta(CATANIA);
        expect(screen.getByText('Hai un giro in corso: tappa 2 di 3. Riprendi?')).toBeInTheDocument();
        expect(screen.getByTestId('citta').textContent).toBe('Catania');
        expect(screen.queryByText('Roma')).toBeNull();
        // La mappa è montata (non «Preparo la mappa») sulla tappa 2, Via Crociferi.
        expect(screen.getByTestId('mappa')).toBeInTheDocument();
        expect(h.mappa.initialCenter).toEqual({ latitude: 37.505, longitude: 15.085 });
    });
});
