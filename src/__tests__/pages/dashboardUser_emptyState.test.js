// Gate SOLO-GOOGLE (27/09) — lo stato vuoto di "Per Te" dice la verità.
//
// Quando il pool Google è vuoto (o "Per Te" non ha nulla da proporre) la query
// 'home-experiences' esce con []. Prima quel ramo mostrava "Il motore AI ne
// costruisce uno adesso, sui luoghi veri della città": una promessa falsa
// proprio nel punto in cui il motore aveva già girato senza produrre niente.
//
// Il test monta DashboardUser davvero. Mock solo di infrastruttura (router,
// animazioni, react-query, hook di contesto, chrome di pagina): il JSX dello
// stato vuoto gira vero.

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

vi.mock('react-router-dom', async () => {
    const React = await import('react');
    return {
        Link: ({ children, to }) => React.createElement('a', { href: String(to) }, children),
        useNavigate: () => () => {},
    };
});

// La query esce con [] — è il caso sotto test: nessuna esperienza da mostrare.
const QUERY_VUOTA = Object.freeze({
    data: [], isError: false, isPending: false, refetch: () => {},
});
vi.mock('@tanstack/react-query', () => ({ useQuery: () => QUERY_VUOTA }));

// I mock si risolvono per module id: l'alias `@/` punta allo stesso file degli
// import relativi di DashboardUser, quindi basta la forma con alias.
vi.mock('@/hooks/useUserContext', () => ({
    useUserContext: () => ({
        firstName: 'Ivano', city: 'Cabras', temperatureC: 21,
        weatherCondition: 'sunny', isLoading: false,
    }),
}));

const AI_LEARNING = {
    userDNAPreferences: {}, preferenceGraph: {}, totalInteractions: 0,
    getAIContext: () => '', getTourAffinity: () => 0, hasSeed: false,
};
vi.mock('@/hooks/useAILearning', () => ({ useAILearning: () => AI_LEARNING }));

vi.mock('@/services/dataService', () => ({
    dataService: { getToursByCity: async () => [] },
    createGuideRequest: vi.fn(),
}));
vi.mock('@/services/placesDiscoveryService', () => ({
    placesDiscoveryService: { discoverAllThemes: async () => ({}) },
}));
vi.mock('@/services/aiRecommendationService', () => ({
    aiRecommendationService: { generateHomeTours: async () => ({ tours: [] }) },
}));
vi.mock('@/services/cityCenterService', () => ({
    resolveCityCenter: async () => ({ latitude: 39.9297, longitude: 8.5297 }),
    CityCenterUnresolvedError: class extends Error {},
}));

vi.mock('@/components/TopBar', () => ({ default: () => null }));
vi.mock('@/components/BottomNavigation', () => ({ default: () => null }));
vi.mock('@/components/GpsActivationBanner', () => ({ default: () => null }));
vi.mock('@/components/TourCover', () => ({ default: () => null }));

const { createElement } = await import('react');
const DashboardUser = (await import('@/pages/DashboardUser')).default;

afterEach(() => { cleanup(); });

describe('Gate SOLO-GOOGLE — "Per Te" con risultato vuoto', () => {
    it('mostra lo stato vuoto (altrimenti il test non misura nulla)', () => {
        render(createElement(DashboardUser));
        expect(screen.getByText('Nessuna guida ha ancora pubblicato un tour a Cabras.')).toBeInTheDocument();
    });

    it('dice che non ci sono luoghi verificati da proporre', () => {
        render(createElement(DashboardUser));
        expect(screen.getByText('Qui intorno non trovo ancora luoghi verificati da proporti.')).toBeInTheDocument();
    });

    it('non promette più un tour che il motore sta costruendo adesso', () => {
        render(createElement(DashboardUser));
        expect(screen.queryByText(/il motore ai ne costruisce uno adesso/i)).not.toBeInTheDocument();
    });
});
