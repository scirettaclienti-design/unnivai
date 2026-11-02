/**
 * CURIOSITÀ-QUARTIERI — a piedi, la curiosità della via o del quartiere che dà il server (curiositaService finto), a schermo e a voce;
 * al massimo una ogni 10 minuti, mai due volte nello stesso giro; senza curiosità dal server, silenzio (le fontanelle di Roma non ci sono più).
 * Erede di CURIOSITA-CITTA (Catania non sente Roma). 0 $.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
    contesto: { city: 'Catania', lat: 37.5, lng: 15.08, isLoading: false },
    mappa: null,
    parla: vi.fn(),
    richiedi: vi.fn(),
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

vi.mock('@/lib/voce', async (orig) => ({ ...(await orig()), parla: (...a) => h.parla(...a), preparaVoce: async () => 'pronta', voceOccupata: () => false }));
vi.mock('@/services/curiositaService', () => ({ richiediCuriosita: (...a) => h.richiedi(...a) }));

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
    h.richiedi.mockReset();
    h.richiedi.mockResolvedValue(null);
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

// Arriva alla tappa 1, poi cammina verso sud (lontano dalle altre tappe) a 1,25 m/s: una posizione ogni 20 s, 25 m più in là.
const p0 = () => [CATANIA.steps[0].lat, CATANIA.steps[0].lng];
let qui;
const parti = () => { qui = p0(); passo(qui); passo(qui); };
const camminaPer = async (secondi) => {
    for (let k = 0; k < secondi / 20; k++) {
        qui = sposta(qui, 0, -25);
        await act(async () => { vi.advanceTimersByTime(20_000); gps.emit(qui[0], qui[1], 8); });
        await act(async () => { await Promise.resolve(); });
    }
};
const curiosita = () => toast.filter(m => m.startsWith('🎧'));
const C1 = { testo: 'Via Etnea è lunga circa 3 km. Collega piazza del Duomo al Tondo Gioeni.', chiave: 'curiosita-itwiki-1', luogo: 'Via Etnea', tipo: 'via', fonte: { titolo: 'Via Etnea', url: 'https://it.wikipedia.org/wiki/Via_Etnea' } };
const C2 = { testo: 'Il Centro storico di Catania è patrimonio UNESCO. Fu ricostruito dopo il terremoto del 1693.', chiave: 'curiosita-itwiki-2', luogo: 'Centro Storico (Catania)', tipo: 'quartiere', fonte: { titolo: 'Centro Storico (Catania)', url: 'u' } };

describe('CURIOSITÀ-QUARTIERI — la curiosità del luogo, dal server, con le regole del cammino', () => {
    it('giro a Catania: dopo 300 m a piedi la curiosità del server esce a schermo e a voce (tipo «curiosita»), con città, tappe e niente da escludere', async () => {
        h.richiedi.mockResolvedValue(C1);
        monta({ ...CATANIA, city: 'Catania' });
        avvia();
        parti();
        await camminaPer(320);
        expect(h.richiedi).toHaveBeenCalled();
        const arg = h.richiedi.mock.calls[0][0];
        expect(arg).toMatchObject({ citta: 'Catania', escludi: [] });
        expect(arg.tappe).toEqual(CATANIA.steps.map(s => s.title));
        expect(curiosita()).toEqual([`🎧 ${C1.testo}`]);
        expect(h.parla.mock.calls.filter(c => c[0] === C1.testo).map(c => c[1].tipo)).toEqual(['curiosita']);
        expect(h.parla.mock.calls.filter(c => /fontanelle|nasoni/i.test(c[0]))).toEqual([]);
    });

    it('al massimo una ogni 10 minuti, e mai la stessa: la seconda richiesta esclude la prima', async () => {
        h.richiedi.mockResolvedValueOnce(C1).mockResolvedValue(C2);
        monta({ ...CATANIA, city: 'Catania' });
        avvia();
        parti();
        await camminaPer(320);
        expect(curiosita()).toHaveLength(1);
        await camminaPer(8 * 60);       // ~9 minuti dalla prima: niente
        expect(curiosita()).toHaveLength(1);
        await camminaPer(2 * 60);       // oltre i 10 minuti
        expect(curiosita()).toEqual([`🎧 ${C1.testo}`, `🎧 ${C2.testo}`]);
        const seconda = h.richiedi.mock.calls.find(c => c[0].escludi.length > 0)?.[0];
        expect(seconda.escludi).toEqual([C1.chiave]);
        expect(JSON.parse(localStorage.getItem('dvai_curiosita_giro_v1')).dette).toEqual([C1.chiave, C2.chiave]);
    });

    it('il server non ha una curiosità: silenzio, né a schermo né a voce (anche a Roma: niente fontanelle)', async () => {
        monta({ ...CATANIA, city: 'Roma' });
        avvia();
        parti();
        await camminaPer(400);
        expect(h.richiedi).toHaveBeenCalled();
        expect(curiosita()).toEqual([]);
        expect(h.parla.mock.calls.filter(c => /fontanelle|nasoni/i.test(c[0]))).toEqual([]);
    });

    it('fermo sul posto: nessuna richiesta, nessuna curiosità', async () => {
        h.richiedi.mockResolvedValue(C1);
        monta({ ...CATANIA, city: 'Catania' });
        avvia();
        parti();
        for (let k = 0; k < 20; k++) await act(async () => { vi.advanceTimersByTime(20_000); gps.emit(qui[0], qui[1], 8); });
        expect(h.richiedi).not.toHaveBeenCalled();
        expect(curiosita()).toEqual([]);
    });
});
