/**
 * NAV-3 — gli stati della guida su MapPage montata davvero: 1 cammino, 8 rito d'arrivo, 3 arrivo, 4 scheda tappa, 9 filo del giorno, 5 fine giro.
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

describe('DURATE-ETICHETTE — la card prima di «Avvia» dice cosa misura ogni numero', () => {
    // 13 tappe, 27/10/2026 dalle 9:30 (ora solare): la giornata finisce alle 21:15
    const ORE13 = ['09:30', '10:05', '10:40', '11:20', '12:30', '14:30', '15:10', '15:50', '16:40', '18:00', '18:50', '19:40', '20:45'];
    const GIRO13 = {
        ...CATANIA, id: 'tour-13',
        steps: ORE13.map((o, i) => ({ ...CATANIA.steps[i % 3], id: `t${i}`, title: `Tappa ${i + 1}`, lat: 37.5 + i / 1000, lng: 15.08 + i / 2000, scheduledTime: new Date(`2026-10-27T${o}:00+01:00`).toISOString(), stayMinutes: i === 12 ? 30 : 25 })),
    };
    it('«Giornata 9:30–21:15 · 1h 33 a piedi · 6,9 km · 13 tappe»', () => {
        monta(GIRO13);
        act(() => { h.mappa?.onRouteStats?.({ durationSec: 93 * 60, distanceM: 6900 }); });
        const t = screen.getByTestId('avvia-etichette').textContent;
        expect(t).toBe('Giornata 9:30–21:15 · 1h 33 a piedi · 6,9 km · 13 tappe');
    });
    it('senza il percorso calcolato non c\'e\' nessun numero di cammino: solo la giornata e le tappe', () => {
        monta(GIRO13);
        expect(screen.getByTestId('avvia-etichette').textContent).toBe('Giornata 9:30–21:15 · 13 tappe');
    });
});

describe('il filo del giorno non copre il tasto indietro', () => {
    it('in navigazione il tasto indietro ha la sua riga sopra il HUD e il HUD parte sotto di lui', () => {
        monta(CATANIA);
        avvia();
        const indietro = screen.getByLabelText('Torna alla home');
        const riga = indietro.parentElement;
        expect(riga.className).toMatch(/z-\[80\]/);
        expect(riga.style.top).toContain('safe-area-inset-top');
        const hud = screen.getByTestId('nav-hud-barra').parentElement;
        expect(hud.style.top).toContain('3.5rem');
        // il tasto indietro sta sopra al HUD (z-[80] contro z-[70]): se mai si toccassero, il tasto vince
        expect(hud.className).toMatch(/z-\[70\]/);
    });
});

describe('STATO 1 — cammino', () => {
    it('una pillola in alto, due tasti tondi a destra, la scheda in basso con tre tasti e la barra «Tappa X di N»', () => {
        monta(CATANIA);
        avvia();
        expect(screen.getByTestId('nav-pillola')).toBeInTheDocument();
        expect(screen.getAllByTestId('nav-hud-barra')).toHaveLength(1);
        expect(screen.getByTestId('nav-vista-giro')).toBeInTheDocument();
        expect(screen.getByTestId('nav-centra')).toBeInTheDocument();
        const scheda = screen.getByTestId('nav-scheda');
        expect(scheda.textContent).toMatch(/PROSSIMA/);
        expect(scheda.textContent).toContain('Fontana dell\'Elefante');
        expect(screen.getByTestId('nav-insider').textContent).toBe('La fontana di Catania con l\'elefante di pietra lavica.');
        expect(screen.getByText('Pausa')).toBeInTheDocument();
        expect(screen.getByText('Salta')).toBeInTheDocument();
        expect(screen.getByText('Voce')).toBeInTheDocument();
        expect(screen.getByText('Tappa 1 di 3')).toBeInTheDocument();
    });
    it('tutti i tasti hanno almeno 44 px (classe min-h-[44px])', () => {
        monta(CATANIA);
        avvia();
        for (const b of [screen.getByText('Pausa').closest('button'), screen.getByText('Salta').closest('button'), screen.getByText('Voce').closest('button'), screen.getByTestId('nav-vista-giro'), screen.getByTestId('nav-centra')]) {
            expect(b.className).toContain('min-h-[44px]');
        }
    });
    it('«Voce» è pieno arancione; «Pausa» mette la pillola in pausa e il tasto diventa «Riprendi»', () => {
        monta(CATANIA);
        avvia();
        expect(screen.getByText('Voce').closest('button').className).toContain('bg-brand-orange');
        fireEvent.click(screen.getByText('Pausa'));
        expect(screen.getByTestId('nav-pillola').textContent).toBe('In pausa');
        expect(screen.getByText('Riprendi')).toBeInTheDocument();
    });
    it('«Salta» salta la tappa; nessun «Apri in Mappe»', () => {
        monta(CATANIA);
        avvia();
        fireEvent.click(screen.getByText('Salta'));
        expect(screen.getByText('Tappa 2 di 3')).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/Apri in Mappe/i);
    });
});

describe('STATO 9 — il filo del giorno', () => {
    it('i momenti, un puntino per tappa, quella attuale evidenziata, la frase', () => {
        monta(CATANIA);
        avvia();
        const filo = screen.getByTestId('filo');
        expect(filo.textContent).toMatch(/Mattina/);
        expect(filo.textContent).toMatch(/Pranzo/);
        expect(filo.querySelectorAll('[data-attuale="si"]')).toHaveLength(1);
        expect(filo.querySelectorAll('span.rounded-full').length).toBe(3);
        expect(screen.getByTestId('filo-frase').textContent).toBe('Si parte.');
    });
});

describe('STATI 8 e 3 — il rito d\'arrivo e l\'arrivo', () => {
    it('all\'arrivo: 2 secondi di rito (nome e prima frase in corsivo), poi la scheda di arrivo al 68%', () => {
        monta(CATANIA);
        avvia();
        arriva(0);
        const rito = screen.getByTestId('rito-arrivo');
        expect(rito.textContent).toContain('Sei arrivato');
        expect(screen.getByTestId('rito-nome').textContent).toBe('Fontana dell\'Elefante');
        expect(screen.getByTestId('rito-frase').className).toContain('italic');
        expect(screen.queryByTestId('arrivo')).toBeNull();
        act(() => { vi.advanceTimersByTime(2100); });
        expect(screen.queryByTestId('rito-arrivo')).toBeNull();
        const arrivo = screen.getByTestId('arrivo');
        expect(screen.getByTestId('arrivo-pillola').textContent).toBe('Sei arrivato · tappa 1 di 3');
        expect(screen.getByTestId('arrivo-riga').textContent).toMatch(/^monumento · 20 min · aperto fino alle 23:00$/);
        expect(screen.getByTestId('chicca').textContent).toContain('LA CHICCA'.toLowerCase().replace(/^./, c => c.toUpperCase()));
        expect(screen.getByTestId('lettore-tempo').textContent).toMatch(/^0:00 \/ 0:\d\d$/);
        expect(arrivo.querySelector('[style*="68dvh"]')).not.toBeNull();
    });
});

describe('STATO 4 — la scheda della tappa', () => {
    it('etichetta «TAPPA X · CATEGORIA», nome, pillole, «perché sei qui adesso», il racconto, «Riparti · N min al <prossima>»', () => {
        monta(CATANIA);
        avvia();
        arriva(0);
        act(() => { vi.advanceTimersByTime(2100); });
        fireEvent.click(screen.getByText('La scheda'));
        expect(screen.getByTestId('scheda-etichetta').textContent).toBe('Tappa 1 · monumento');
        expect(screen.getByTestId('scheda-tappa').textContent).toContain('Fontana dell\'Elefante');
        const pillole = screen.getByTestId('scheda-pillole').textContent;
        expect(pillole).toContain('09:30');
        expect(pillole).toContain('~20 min');
        expect(screen.getByTestId('perche').textContent).toMatch(/Perché sei qui adesso/);
        expect(screen.getByTestId('racconto').textContent).toContain('Il simbolo della città');
        const riparti = screen.getByText(/^Riparti · \d+ min al Via Crociferi$/);
        fireEvent.click(riparti);
        expect(screen.queryByTestId('scheda-tappa')).toBeNull();
        expect(screen.queryByTestId('arrivo')).toBeNull();
    });
});

describe('STATO 5 — la fine del giro', () => {
    it('«GIRO COMPLETATO · data», «Catania, a modo tuo.», tracciato, tre numeri, «Nelle tue Mete» e «Condividi»', () => {
        monta(CATANIA);
        avvia();
        fireEvent.click(screen.getByText('Salta'));
        fireEvent.click(screen.getByText('Salta'));
        fireEvent.click(screen.getByText('Sono arrivato'));
        act(() => { vi.advanceTimersByTime(2500); });
        const fine = screen.getByTestId('fine-giro');
        expect(screen.getByTestId('fine-etichetta').textContent).toMatch(/^Giro completato · \d{1,2} [A-ZÀ-Ù]+$/i);
        expect(screen.getByTestId('fine-titolo').textContent).toBe('Catania, a modo tuo.');
        expect(fine.querySelector('[data-testid="fine-tracciato"] svg')).not.toBeNull();
        expect(fine.querySelectorAll('[data-testid="fine-tracciato"] circle')).toHaveLength(3);
        expect(screen.getByTestId('fine-numeri').textContent).toMatch(/tappe/);
        expect(screen.getByText('Nelle tue Mete')).toBeInTheDocument();
        expect(screen.getByText('Condividi')).toBeInTheDocument();
    });
});
