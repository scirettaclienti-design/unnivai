// Gate MOMENTO NEL DETTAGLIO — il Dettaglio tour mostra le tappe per momento
// della giornata con l'orario reale di arrivo, come QuickPathSummary e
// SurpriseTour, quando le tappe li hanno (oggi: Sorprendimi → "Vedi Dettagli
// Tour"). Le card restano quelle di prima (descrizione, insider, sosta…): si
// aggiungono solo l'intestazione del momento e l'orario.
// Una tappa senza orario e senza momento (Per Te, notifiche, tour DB) resta
// com'era: nessuna intestazione, nessun orario inventato.
//
// Mock solo di infrastruttura, come tourDetails_highlights.test.js: la pipeline
// dati vera (normalizeTour, due volte come in pagina) e il JSX girano veri.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';

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

// Orari di ROMA espliciti (+02:00): la CI gira in UTC.
const at = (hhmm) => new Date(`2026-10-08T${hhmm}:00+02:00`).toISOString();

const stop = (title, hhmm, extra = {}) => ({
    title, type: 'cultura', description: `Dentro ${title} il rumore della strada si spegne.`,
    latitude: 41.9, longitude: 12.48, stayMinutes: 30, travelMinutesFromPrev: 10,
    scheduledTime: hhmm ? at(hhmm) : null,
    ...extra,
});

// `useLocation` restituisce sempre lo STESSO oggetto dentro un test (vedi
// tourDetails_highlights.test.js: un oggetto nuovo a ogni render = loop).
const LOC = { current: null };
const setTour = (tourData) => {
    LOC.current = Object.freeze({ state: Object.freeze({ tourData }), pathname: '/tour-details/x' });
};
const NAVIGATE = () => {};
const SEARCH_PARAMS = [new URLSearchParams(), () => {}];

vi.mock('react-router-dom', async () => {
    const React = await import('react');
    return {
        Link: ({ children, to }) => React.createElement('a', { href: String(to) }, children),
        useNavigate: () => NAVIGATE,
        useParams: () => ({ id: 'x' }),
        useLocation: () => LOC.current,
        useSearchParams: () => SEARCH_PARAMS,
    };
});

// Stessa ragione: identità stabile, niente oggetti nuovi a ogni render.
const QUERY_RESULT = Object.freeze({ data: null, isLoading: false, isError: false });

vi.mock('@tanstack/react-query', () => ({
    useQuery: () => QUERY_RESULT,
}));

// `from` serve a fetchGuideProfile (profiles), `rpc` a fetchPartners
// (get_nearby_partners_for_tour): entrambi partono da useEffect al mount.
// Senza `rpc` il render lascia una promise rejected e Vitest la segnala
// come unhandled error.
vi.mock('@/lib/supabase', () => ({
    supabase: {
        from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
        rpc: async () => ({ data: null, error: null }),
    },
}));

vi.mock('@/services/dataService', () => ({
    dataService: {
        getTourById: async () => null,
        getBusinessesByCityAndTags: async () => [],
    },
    createGuideRequest: vi.fn(),
}));

vi.mock('@/components/TopBar', () => ({ default: () => null }));
vi.mock('@/components/TourCover', () => ({ default: () => null }));
vi.mock('@/components/BottomNavigation', () => ({ default: () => null }));
vi.mock('@/components/BookingSystem', () => ({ default: () => null }));
vi.mock('@/components/ToastNotification', () => ({ Toast: () => null }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useAILearning', () => ({ useAILearning: () => ({ trackTourView: vi.fn() }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));

const { createElement } = await import('react');
const TourDetails = (await import('@/pages/TourDetails')).default;
const { normalizeTour } = await import('@/services/tourShape');

// Come SurpriseTour.jsx: il tour arriva gia' passato da normalizeTour.
const surpriseTour = (stops) => normalizeTour({
    id: 'surprise-1', title: 'Avventura a Sorpresa', city: 'Roma',
    isAiGenerated: true, stops,
}, { cityFallback: 'Roma' });

const headers = (container) => [...container.querySelectorAll('[data-moment-header]')].map(h => h.textContent);

afterEach(() => {
    cleanup();
});

describe('TourDetails — tappe per momento con orario reale', () => {
    it('10:00 / 12:30 / aperitivo alle 17:50 → Mattina, Pranzo, Aperitivo e i tre orari', () => {
        setTour(surpriseTour([
            stop('Chiesa di San Luigi', '10:00'),
            stop('Armando al Pantheon', '12:30', { type: 'food' }),
            stop('Bar del Fico', '17:50', { type: 'food', moment: 'aperitivo', momentLabel: 'Aperitivo' }),
        ]));
        const { container } = render(createElement(TourDetails));
        expect(headers(container)).toEqual(['Mattina', 'Pranzo', 'Aperitivo']);
        for (const o of ['10:00', '12:30', '17:50']) expect(screen.getByText(o), o).toBeInTheDocument();
    });

    it('ogni tappa sta sotto la SUA intestazione, nell\'ordine', () => {
        setTour(surpriseTour([
            stop('Chiesa di San Luigi', '10:00'),
            stop('Bar del Fico', '17:50', { moment: 'aperitivo' }),
        ]));
        const { container } = render(createElement(TourDetails));
        const groups = [...container.querySelectorAll('[data-moment-group]')];
        expect(groups).toHaveLength(2);
        expect(within(groups[0]).getByText('Chiesa di San Luigi')).toBeInTheDocument();
        expect(within(groups[1]).getByText('Bar del Fico')).toBeInTheDocument();
    });

    it('la card resta quella di prima: descrizione e sosta stimata accanto all\'orario', () => {
        setTour(surpriseTour([stop('Chiesa di San Luigi', '10:00'), stop('Da Teo', '12:30')]));
        render(createElement(TourDetails));
        expect(screen.getByText('Dentro Chiesa di San Luigi il rumore della strada si spegne.')).toBeInTheDocument();
        expect(screen.getAllByText('~30 min').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText('Programma del Tour (2 tappe)')).toBeInTheDocument();
    });

    it('tappe senza orario e senza momento (Per Te) → nessuna intestazione, nessun orario', () => {
        setTour(surpriseTour([stop('Chiesa di San Luigi', null), stop('Da Teo', null)]));
        const { container } = render(createElement(TourDetails));
        expect(headers(container)).toEqual([]);
        const programma = screen.getByText('Programma del Tour (2 tappe)').parentElement;
        expect(programma.textContent).not.toMatch(/\b\d\d:\d\d\b/);
        expect(screen.getByText('Chiesa di San Luigi')).toBeInTheDocument();
        expect(screen.getByText('Da Teo')).toBeInTheDocument();
    });
});
