// Regressione — i nomi delle tappe in "Cosa ti aspetta" comparivano mutilati.
//
// Sul tour "Piazze e Storia di Oristano" si leggeva "Portixedda" invece di
// "Trattoria Portixedda", "di Santa Maria Assunta" invece di "Cattedrale di
// Santa Maria Assunta", "'Lo Zen'" invece di "Spaghetteria 'Lo Zen'".
//
// Causa: nel render della sezione il testo passava per
//   String(highlight).replace(/^[^\s]+\s/, '')
// che rimuove la PRIMA PAROLA più lo spazio che segue, qualunque essa sia.
// Era nato per ripulire un default fittizio con emoji ("✨ Esperienza
// autentica") rimosso da Gate PULIZIA P5: nessuna sorgente viva produce più
// highlights con un prefisso da togliere, quindi lo strip mutila e basta.
//
// Le sorgenti vive di `tour.highlights` oggi sono titoli PIATTI di tappe
// reali (DashboardUser/Notifications: `stops.slice(0,3).map(s => s.title)`,
// nomi veri da Google Places) o titoli di selezione wizard (QuickPath).
// Nomi come "Trattoria Portixedda" — prefisso "tipo di locale" + spazio —
// sono esattamente il caso che il regex rompe peggio.
//
// Il test monta TourDetails davvero e legge il testo in output. Mock SOLO di
// infrastruttura (router, animazioni, query, supabase, chrome di pagina): la
// pipeline dati vera (normalizeTour) e il JSX della sezione girano veri.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

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

// Il tour segnalato: highlights = titoli piatti di tappe reali, senza prefissi.
const TOUR = {
    id: 'oristano-piazze-storia',
    title: 'Piazze e Storia di Oristano',
    type: 'guide',
    city: 'Oristano',
    highlights: [
        'Trattoria Portixedda',
        'Cattedrale di Santa Maria Assunta',
        "Spaghetteria 'Lo Zen'",
    ],
};

// `useLocation` DEVE restituire sempre lo STESSO oggetto: l'effect di ingestione
// in TourDetails dipende da [location.state, id]. Un oggetto nuovo a ogni render
// rifà setLocalTour all'infinito (loop di render, OOM), esattamente come farebbe
// un router vero mal mockato. Identità stabile = un solo giro di ingestione.
const LOCATION = Object.freeze({
    state: Object.freeze({ tourData: TOUR }),
    pathname: '/tour-details/oristano-piazze-storia',
});
const NAVIGATE = () => {};
const SEARCH_PARAMS = [new URLSearchParams(), () => {}];

vi.mock('react-router-dom', async () => {
    const React = await import('react');
    return {
        Link: ({ children, to }) => React.createElement('a', { href: String(to) }, children),
        useNavigate: () => NAVIGATE,
        useParams: () => ({ id: 'oristano-piazze-storia' }),
        useLocation: () => LOCATION,
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

const renderTourDetails = () => render(createElement(TourDetails));

afterEach(() => {
    cleanup();
});

describe('TourDetails — "Cosa ti aspetta" mostra il nome intero della tappa', () => {
    it('la sezione si monta davvero (altrimenti il test non misura nulla)', () => {
        renderTourDetails();
        expect(screen.getByText('Cosa ti aspetta')).toBeInTheDocument();
    });

    it('non tronca la prima parola: i nomi compaiono interi, identici alla sorgente', () => {
        renderTourDetails();

        expect(screen.getByText('Trattoria Portixedda')).toBeInTheDocument();
        expect(screen.getByText('Cattedrale di Santa Maria Assunta')).toBeInTheDocument();
        expect(screen.getByText("Spaghetteria 'Lo Zen'")).toBeInTheDocument();
    });

    it('le versioni mutilate non compaiono da nessuna parte', () => {
        renderTourDetails();

        expect(screen.queryByText('Portixedda')).not.toBeInTheDocument();
        expect(screen.queryByText('di Santa Maria Assunta')).not.toBeInTheDocument();
        expect(screen.queryByText("'Lo Zen'")).not.toBeInTheDocument();
    });
});
