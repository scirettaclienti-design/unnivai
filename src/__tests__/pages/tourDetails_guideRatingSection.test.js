// Gate PULIZIA (24/09) — punto 4: sezione "La tua guida" in TourDetails.jsx.
//
// Prima: `guideRating.count > 0 ? guideRating.avg : (tour.rating || '—')` e
// `(guideRating.count > 0 ? guideRating.count : (tour.reviews || 0)} recensioni)`
// — una guida senza recensioni mostrava un trattino al posto del voto e "0
// recensioni" al posto del conteggio, anche se `tours` non ha nemmeno una
// colonna `rating` (CLAUDE.md). Stesso schema gia' corretto nel modal
// GuideProfileModal poco sotto (righe 919-926): se non ci sono recensioni
// vere, il blocco non si monta.
//
// Il test monta TourDetails davvero (stesso approccio di
// tourDetails_highlights.test.js: mock solo di infrastruttura — router,
// animazioni, query, supabase, dataService — la pipeline dati vera e il JSX
// girano veri) con una guida che ha zero recensioni, e verifica che ne' il
// rating ne' "0 recensioni" compaiano nel DOM.

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

// Tour di una guida reale, SENZA rating/reviews propri (`tours` non ha quelle
// colonne — vedi CLAUDE.md) e con zero recensioni sul profilo guida.
const TOUR = {
    id: 'guida-senza-recensioni',
    title: 'Tour della Guida Nuova',
    type: 'guide',
    city: 'Cabras',
    guide_id: 'guide-nuova-001',
    guide: 'Anna',
    guideAvatar: '👩',
    highlights: [],
};

const LOCATION = Object.freeze({
    state: Object.freeze({ tourData: TOUR }),
    pathname: '/tour-details/guida-senza-recensioni',
});
const NAVIGATE = () => {};
const SEARCH_PARAMS = [new URLSearchParams(), () => {}];

vi.mock('react-router-dom', async () => {
    const React = await import('react');
    return {
        Link: ({ children, to }) => React.createElement('a', { href: String(to) }, children),
        useNavigate: () => NAVIGATE,
        useParams: () => ({ id: 'guida-senza-recensioni' }),
        useLocation: () => LOCATION,
        useSearchParams: () => SEARCH_PARAMS,
    };
});

const QUERY_RESULT = Object.freeze({ data: null, isLoading: false, isError: false });

vi.mock('@tanstack/react-query', () => ({
    useQuery: () => QUERY_RESULT,
}));

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
        // La guida esiste ma non ha ancora nessuna recensione vera.
        getGuideRatingAvg: async () => ({ avg: 0, count: 0 }),
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

const renderTourDetails = () => render(createElement(TourDetails));

afterEach(() => {
    cleanup();
});

describe('Gate PULIZIA — TourDetails "La tua guida" senza recensioni vere', () => {
    it('la sezione si monta davvero (altrimenti il test non misura nulla)', async () => {
        renderTourDetails();
        expect(await screen.findByText('La tua guida')).toBeInTheDocument();
    });

    it('una guida con zero recensioni non mostra ne\' un trattino ne\' un rating fasullo', async () => {
        renderTourDetails();
        const heading = await screen.findByText('La tua guida');
        const section = heading.closest('div.bg-obsidian-card') || heading.parentElement.parentElement;

        expect(within(section).queryByText('—')).not.toBeInTheDocument();
    });

    it('una guida con zero recensioni non mostra "0 recensioni"', async () => {
        renderTourDetails();
        const heading = await screen.findByText('La tua guida');
        const section = heading.closest('div.bg-obsidian-card') || heading.parentElement.parentElement;

        expect(within(section).queryByText(/\(0 recensioni\)/)).not.toBeInTheDocument();
    });
});
