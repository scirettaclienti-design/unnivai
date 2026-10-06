// Gate INTERESSI-VERI — i due messaggi a schermo: errore di ricerca contro zero.
//
//   errore (rete/HTTP/eccezione) → "Connessione instabile: non riesco a cercare
//                                    adesso. Riprova tra un momento."
//   Google ha risposto zero       → "… non trovo luoghi verificati …"
//
// Percorso B (AiItinerary) e "Per Te" (DashboardUser). Mock solo di
// infrastruttura; in DashboardUser la `queryFn` della Home gira davvero, con un
// useQuery minimo che la esegue — il test di stato vuoto esistente
// (dashboardUser_emptyState.test.js) la salta, e il difetto stava proprio li'.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const CONNECTION = 'Connessione instabile: non riesco a cercare adesso. Riprova tra un momento.';

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

vi.mock('react-router-dom', async () => {
    const React = await import('react');
    return {
        Link: ({ children, to }) => React.createElement('a', { href: String(to) }, children),
        useNavigate: () => () => {},
    };
});

// useQuery minimo: esegue la queryFn vera una volta e ne espone l'esito.
vi.mock('@tanstack/react-query', async () => {
    const React = await import('react');
    return {
        useQuery: ({ queryFn, enabled = true }) => {
            const [state, setState] = React.useState({ data: undefined, error: null, isPending: true });
            React.useEffect(() => {
                if (!enabled) return;
                let alive = true;
                Promise.resolve().then(queryFn)
                    .then(data => alive && setState({ data, error: null, isPending: false }))
                    .catch(error => alive && setState({ data: undefined, error, isPending: false }));
                return () => { alive = false; };
            }, []);
            return { ...state, isError: !!state.error, refetch: () => {} };
        },
    };
});

vi.mock('@/components/TopBar', () => ({ default: () => null }));
vi.mock('@/components/BottomNavigation', () => ({ default: () => null }));
vi.mock('@/components/GpsActivationBanner', () => ({ default: () => null }));
vi.mock('@/components/TourCover', () => ({ default: () => null }));
vi.mock('@/hooks/useUserContext', () => ({
    useUserContext: () => ({ firstName: 'Ivano', city: 'Roma', temperatureC: 22, weatherCondition: 'sunny', isLoading: false }),
}));
vi.mock('@/hooks/useAILearning', () => ({
    useAILearning: () => ({
        userDNAPreferences: [], preferenceGraph: {}, totalInteractions: 0, hasSeed: false, weights: {},
        trackGeneratedTour: vi.fn(), trackInteraction: vi.fn(), getAIContext: () => '', getTourAffinity: () => 0,
    }),
}));
const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/services/cityCenterService', () => ({
    resolveCityCenter: vi.fn().mockResolvedValue({ latitude: 41.9028, longitude: 12.4964 }),
    CityCenterUnresolvedError: class CityCenterUnresolvedError extends Error {},
}));
vi.mock('@/services/dataService', () => ({
    dataService: { getToursByCity: async () => [] },
    createGuideRequest: vi.fn(),
}));

const generateItinerary = vi.fn();
const generateHomeTours = vi.fn();
vi.mock('@/services/aiRecommendationService', () => ({
    aiRecommendationService: {
        generateItinerary: (...a) => generateItinerary(...a),
        generateHomeTours: (...a) => generateHomeTours(...a),
    },
    QUOTA_USER_MESSAGE: 'quota',
}));

// placesDiscoveryService vero per PlacesSearchError e il testo; discoverAllThemes pilotato.
const discoverAllThemes = vi.fn();
vi.mock('@/services/placesDiscoveryService', async () => {
    const actual = await vi.importActual('@/services/placesDiscoveryService');
    return {
        ...actual,
        placesDiscoveryService: { ...actual.placesDiscoveryService, discoverAllThemes: (...a) => discoverAllThemes(...a) },
    };
});

const { PlacesSearchError } = await import('@/services/placesDiscoveryService');
const AiItinerary = (await import('@/pages/AiItinerary')).default;
const DashboardUser = (await import('@/pages/DashboardUser')).default;

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

const generaConArte = async () => {
    render(createElement(AiItinerary));
    fireEvent.click(screen.getByText('Arte'));
    fireEvent.click(screen.getByText('Genera Viaggio'));
    await waitFor(() => expect(toast).toHaveBeenCalled());
    return toast.mock.calls[0][0];
};

describe('Percorso B (AiItinerary)', () => {
    it('ricerca fallita → testo di connessione, esatto e senza aggiunte', async () => {
        generateItinerary.mockResolvedValue({ days: [{ stops: [] }], _source: 'search-error', _pathB: true });
        const t = await generaConArte();
        expect(t.title).toBe(CONNECTION);
        expect(t.description).toBeUndefined();
    });

    it('Google ha risposto zero → "non trovo luoghi verificati"', async () => {
        generateItinerary.mockResolvedValue({ days: [{ stops: [] }], _source: 'no-results', _pathB: true });
        const t = await generaConArte();
        expect(t.title).toBe('A Roma non trovo luoghi verificati per questi interessi.');
    });
});

describe('"Per Te" (DashboardUser)', () => {
    it('ricerca fallita → testo di connessione, non "non trovo"', async () => {
        discoverAllThemes.mockRejectedValue(new PlacesSearchError('rete giu\''));
        render(createElement(DashboardUser));
        expect(await screen.findByText(CONNECTION)).toBeTruthy();
        expect(screen.queryByText(/non trovo ancora luoghi verificati/)).toBeNull();
        expect(generateHomeTours).not.toHaveBeenCalled();
    });

    it('Google ha risposto zero → "non trovo luoghi verificati"', async () => {
        discoverAllThemes.mockResolvedValue({ food: [], cultura: [], romance: [], nature: [] });
        generateHomeTours.mockResolvedValue({ tours: [] });
        render(createElement(DashboardUser));
        expect(await screen.findByText('Qui intorno non trovo ancora luoghi verificati da proporti.')).toBeTruthy();
        expect(screen.queryByText(CONNECTION)).toBeNull();
    });
});
