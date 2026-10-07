import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// Gate TAPPE PER MOMENTO — le schermate del tour mostrano le tappe raggruppate
// per momento della giornata (nomi e confini da dayMoments.js) con l'orario
// REALE di arrivo (scheduledTime, gia' calcolato dal motore), mai lo scarto
// "+1h31". E nessun testo di riempimento al posto di una descrizione mancante.
//
// Il test monta le tre schermate vere (AiItinerary, QuickPathSummary,
// SurpriseTour). Mock solo di infrastruttura; normalizeTour gira vero, come in
// produzione, perche' e' li' che passano le tappe di QuickPath e SurpriseTour.

vi.mock('framer-motion', async () => {
    const React = await import('react');
    const OMIT = new Set([
        'initial', 'animate', 'exit', 'variants', 'whileHover', 'whileTap',
        'whileFocus', 'whileDrag', 'whileInView', 'transition', 'custom',
        'layout', 'layoutId', 'drag', 'dragConstraints',
    ]);
    const clean = (props) => Object.fromEntries(Object.entries(props).filter(([k]) => !OMIT.has(k)));
    const motion = new Proxy({}, {
        get: (_t, tag) => React.forwardRef((props, ref) => React.createElement(tag, { ...clean(props), ref })),
    });
    return { motion, AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children) };
});

const routerState = { current: null };
vi.mock('react-router-dom', async () => {
    const React = await import('react');
    return {
        Link: ({ children, to }) => React.createElement('a', { href: String(to) }, children),
        useNavigate: () => vi.fn(),
        useLocation: () => ({ state: routerState.current }),
    };
});

vi.mock('@/components/TopBar', () => ({ default: () => null }));
vi.mock('@/components/BottomNavigation', () => ({ default: () => null }));
vi.mock('../../components/TopBar', () => ({ default: () => null }));
vi.mock('../../components/BottomNavigation', () => ({ default: () => null }));
vi.mock('@/hooks/useUserContext', () => ({
    useUserContext: () => ({ city: 'Roma', temperatureC: 22, weatherCondition: 'sunny' }),
}));
vi.mock('@/hooks/useAILearning', () => ({
    useAILearning: () => ({
        userDNAPreferences: [],
        trackGeneratedTour: vi.fn(),
        trackInteraction: vi.fn(),
        getAIContext: () => '',
    }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/services/cityCenterService', () => ({
    resolveCityCenter: vi.fn().mockResolvedValue({ latitude: 41.9028, longitude: 12.4964 }),
    CityCenterUnresolvedError: class CityCenterUnresolvedError extends Error {},
}));
const generateItinerary = vi.fn();
vi.mock('@/services/aiRecommendationService', () => ({
    aiRecommendationService: { generateItinerary: (...a) => generateItinerary(...a), getDailyQuotaStatus: vi.fn() },
    QUOTA_USER_MESSAGE: 'quota',
}));

import AiItinerary from '../../pages/AiItinerary';
import SurpriseTour from '../../pages/SurpriseTour';
import { QuickPathSummary } from '../../components/Map/QuickPathSummary';
import { normalizeTour } from '../../services/tourShape';

// Orari di ROMA espliciti (+02:00): la CI gira in UTC.
const at = (hhmm, day = '2026-10-08') => new Date(`${day}T${hhmm}:00+02:00`).toISOString();

const stop = (title, type, hhmm, extra = {}) => ({
    title, type, description: `Dentro ${title} il rumore della strada si spegne.`,
    latitude: 41.9, longitude: 12.48, stayMinutes: 30, travelMinutesFromPrev: 10,
    scheduledTime: hhmm ? at(hhmm, extra.day) : null,
    ...extra,
});

const CINQUE = [
    stop('Chiesa di San Luigi', 'cultura', '09:30'),
    stop('Armando al Pantheon', 'food', '12:30'),
    stop('Galleria Doria Pamphilj', 'arte', '14:30'),
    stop('Enoteca Il Goccetto', 'food', '18:00'),
    stop('Da Teo', 'food', '20:00'),
];
const MOMENTI = ['Mattina', 'Pranzo', 'Pomeriggio', 'Aperitivo', 'Cena'];
const ORARI = ['09:30', '12:30', '14:30', '18:00', '20:00'];

// La vecchia frase di riempimento, scritta come regex: il letterale non deve
// comparire in nessun file di src/ (grep di chiusura del gate).
const FILLER = /Esplorazione\s+consigliata/i;

// Nessun "+" seguito da ore o minuti: lo scarto non deve comparire.
const NO_OFFSET = /\+\s*\d+\s*(h|min)/;

const expectMomentsAndTimes = (container) => {
    for (const m of MOMENTI) expect(screen.getByText(m), m).toBeInTheDocument();
    for (const o of ORARI) expect(screen.getByText(o), o).toBeInTheDocument();
    expect(container.textContent).not.toMatch(NO_OFFSET);
    expect(container.textContent).not.toContain('Inizio');
    // Ogni tappa sta sotto la SUA intestazione, nell'ordine.
    const headers = [...container.querySelectorAll('[data-moment-header]')].map(h => h.textContent);
    expect(headers).toEqual(MOMENTI);
};

const mountAi = async (days) => {
    generateItinerary.mockResolvedValue({ days });
    const view = render(createElement(AiItinerary));
    fireEvent.click(screen.getByText('Arte').closest('button'));
    fireEvent.click(screen.getByText('Genera Viaggio').closest('button'));
    await waitFor(() => expect(screen.getByText(days[0].stops[0].title)).toBeInTheDocument());
    return view;
};

const quickTour = (stops) => normalizeTour({ id: 'q', title: 'Roma da romano', city: 'Roma', stops });

beforeEach(() => {
    generateItinerary.mockReset();
    routerState.current = null;
});

describe('AiItinerary — tappe per momento con orario reale', () => {
    it('5 tappe 09:30/12:30/14:30/18:00/20:00 → Mattina…Cena e gli orari, nessuno scarto', async () => {
        const { container } = await mountAi([{ day: 1, title: 'Giorno 1', stops: CINQUE }]);
        expectMomentsAndTimes(container);
    });

    it('il campo `moment` del motore vince sull\'orario per scegliere l\'intestazione', async () => {
        const stops = [stop('Bar del Fico', 'food', '17:55', { moment: 'aperitivo' })];
        const { container } = await mountAi([{ day: 1, title: 'G1', stops }]);
        expect([...container.querySelectorAll('[data-moment-header]')].map(h => h.textContent)).toEqual(['Aperitivo']);
        expect(screen.getByText('17:55')).toBeInTheDocument();
    });

    it('tappa senza scheduledTime → nessun orario e nessuno scarto al suo posto', async () => {
        const stops = [stop('Senza Orario', 'cultura', null, { travelMinutesFromPrev: null })];
        const { container } = await mountAi([{ day: 1, title: 'G1', stops }]);
        expect(container.textContent).not.toMatch(/\b\d\d:\d\d\b/);
        expect(container.textContent).not.toMatch(NO_OFFSET);
        expect(container.textContent).not.toContain('Inizio');
    });

    it('tappa senza descrizione → nessun blocco di testo al suo posto', async () => {
        const stops = [stop('Muta', 'cultura', '09:30', { description: null })];
        const { container } = await mountAi([{ day: 1, title: 'G1', stops }]);
        const card = screen.getByText('Muta').closest('[data-stop-card]');
        expect(card.querySelector('[data-stop-description]')).toBeNull();
        expect(container.textContent).not.toMatch(FILLER);
    });

    it('più giorni: ogni giorno ha i suoi momenti e i suoi orari', async () => {
        const g2 = [stop('Museo Barracco', 'arte', '09:30', { day: '2026-10-09' }), stop('Da Francesco', 'food', '12:30', { day: '2026-10-09' })];
        const { container } = await mountAi([{ day: 1, title: 'G1', stops: CINQUE }, { day: 2, title: 'G2', stops: g2 }]);
        expectMomentsAndTimes(container);
        fireEvent.click(screen.getByText('Giorno 2').closest('button'));
        await waitFor(() => expect(screen.getByText('Museo Barracco')).toBeInTheDocument());
        expect([...container.querySelectorAll('[data-moment-header]')].map(h => h.textContent)).toEqual(['Mattina', 'Pranzo']);
    });
});

describe('QuickPathSummary — tappe per momento con orario reale', () => {
    it('5 tappe normalizzate → Mattina…Cena e gli orari, nessuno scarto', () => {
        const { container } = render(createElement(QuickPathSummary, { tourData: quickTour(CINQUE), choices: {} }));
        expectMomentsAndTimes(container);
    });

    it('tappa senza descrizione → nessun testo di riempimento (né frase generica, né categoria)', () => {
        const stops = [stop('Muta', 'cultura', '09:30', { description: '' })];
        const { container } = render(createElement(QuickPathSummary, { tourData: quickTour(stops), choices: {} }));
        expect(container.textContent).not.toMatch(FILLER);
        const card = screen.getByText('Muta').closest('[data-stop-card]');
        expect(card.querySelector('[data-stop-description]')).toBeNull();
        expect(within(card).queryByText(/cultura/i)).toBeNull();
    });

    it('tappe su due giorni → raggruppate prima per giorno, poi per momento', () => {
        const stops = [
            stop('A', 'cultura', '09:30'),
            stop('B', 'food', '12:30'),
            stop('C', 'cultura', '09:30', { day: '2026-10-09' }),
        ];
        const { container } = render(createElement(QuickPathSummary, { tourData: quickTour(stops), choices: {} }));
        const days = [...container.querySelectorAll('[data-day-group]')];
        expect(days).toHaveLength(2);
        expect([...days[0].querySelectorAll('[data-moment-header]')].map(h => h.textContent)).toEqual(['Mattina', 'Pranzo']);
        expect([...days[1].querySelectorAll('[data-moment-header]')].map(h => h.textContent)).toEqual(['Mattina']);
    });
});

describe('SurpriseTour — tappe per momento con orario reale', () => {
    it('5 tappe → Mattina…Cena e gli orari, nessuno scarto', () => {
        routerState.current = { previewTour: quickTour(CINQUE) };
        const { container } = render(createElement(SurpriseTour));
        expectMomentsAndTimes(container);
    });

    it('tappa senza descrizione → nessun testo di riempimento', () => {
        routerState.current = { previewTour: quickTour([stop('Muta', 'cultura', '09:30', { description: null })]) };
        const { container } = render(createElement(SurpriseTour));
        expect(container.textContent).not.toMatch(FILLER);
        const card = screen.getByText('Muta').closest('[data-stop-card]');
        expect(card.querySelector('[data-stop-description]')).toBeNull();
    });
});
