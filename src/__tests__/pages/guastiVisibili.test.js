// Gate P8b — guasti visibili, a schermo. Quando OpenAI rifiuta o non risponde
// il motore lancia AiEngineError e ogni schermata mostra lo stesso testo:
//   "Il motore si è fermato un attimo. Riprova tra qualche minuto."
// Mai "[object Object]", mai una schermata vuota. La quota esaurita resta com'era.
//
// Rosso sul codice di prima: QuickPath mostrava "Non riesco a raggiungere i
// posti.", SurpriseTour/AiItinerary "L'AI sta avendo un momento difficile",
// "Per Te" "Non riesco a caricare le esperienze".
//
// Stesso impianto di searchErrorMessages.test.js (mock di sola infrastruttura).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { AiEngineError, AI_ENGINE_MESSAGE } from '@/lib/aiEngineError';

const ENGINE_TEXT = 'Il motore si è fermato un attimo. Riprova tra qualche minuto.';

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
        useLocation: () => ({ state: null }),
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
    useUserContext: () => ({ firstName: 'Ivano', city: 'Roma', temperatureC: 22, weatherCondition: 'sunny', isLoading: false, lat: 41.9, lng: 12.49 }),
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
        getDailyQuotaStatus: async () => ({ exceeded: false, remaining: 5 }),
    },
    buildInsiderPool: () => [],
    QUOTA_USER_MESSAGE: 'quota',
}));
vi.mock('@/services/placesDiscoveryService', async () => {
    const actual = await vi.importActual('@/services/placesDiscoveryService');
    return {
        ...actual,
        placesDiscoveryService: { ...actual.placesDiscoveryService, discoverAllThemes: async () => ({ food: [], cultura: [], romance: [], nature: [] }) },
    };
});

const AiItinerary = (await import('@/pages/AiItinerary')).default;
const DashboardUser = (await import('@/pages/DashboardUser')).default;
const QuickPath = (await import('@/pages/QuickPath')).default;
const SurpriseTour = (await import('@/pages/SurpriseTour')).default;

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

const noObjectObject = (container) => expect(container.textContent).not.toContain('[object Object]');

describe('Gate P8b — il testo del guasto è uno solo', () => {
    it('AI_ENGINE_MESSAGE è il testo deciso, senza emoji', () => {
        expect(AI_ENGINE_MESSAGE).toBe(ENGINE_TEXT);
        expect(/\p{Extended_Pictographic}/u.test(AI_ENGINE_MESSAGE)).toBe(false);
        expect(new AiEngineError('credit').userMessage).toBe(ENGINE_TEXT);
    });
});

for (const kind of ['credit', 'network']) {
    describe(`Gate P8b — motore giù (${kind === 'credit' ? 'credito OpenAI esaurito' : 'errore di rete'})`, () => {
        it('Percorso Veloce → il messaggio, con "Riprova"', async () => {
            generateItinerary.mockRejectedValue(new AiEngineError(kind));
            const { container } = render(createElement(QuickPath));
            fireEvent.click(screen.getByText('Città').closest('button'));
            fireEvent.click(screen.getByText('Rioni Storici').closest('button'));
            fireEvent.click(screen.getByText('Medio').closest('button'));
            fireEvent.click(screen.getByText('Solo').closest('button'));
            expect(await screen.findByText(ENGINE_TEXT)).toBeTruthy();
            expect(screen.getByText('Riprova')).toBeTruthy();
            expect(screen.queryByText('Non riesco a raggiungere i posti.')).toBeNull();
            noObjectObject(container);
        });

        it('Sorprendimi → il messaggio', async () => {
            generateItinerary.mockRejectedValue(new AiEngineError(kind));
            const { container } = render(createElement(SurpriseTour));
            fireEvent.click(screen.getByText('Avventura Culturale').closest('button') || screen.getByText('Avventura Culturale'));
            fireEvent.click(screen.getByText(/Genera esperienza|Sorprendimi/).closest('button'));
            expect(await screen.findByText(ENGINE_TEXT)).toBeTruthy();
            expect(screen.queryByText("L'AI sta avendo un momento difficile")).toBeNull();
            noObjectObject(container);
        });

        it('Crea il tuo Percorso (AiItinerary) → toast con il messaggio', async () => {
            generateItinerary.mockRejectedValue(new AiEngineError(kind));
            render(createElement(AiItinerary));
            fireEvent.click(screen.getByText('Arte'));
            fireEvent.click(screen.getByText('Genera Viaggio'));
            await waitFor(() => expect(toast).toHaveBeenCalled());
            expect(toast.mock.calls[0][0].title).toBe(ENGINE_TEXT);
        });

        it('"Per Te" (Home) → il messaggio al posto delle esperienze', async () => {
            generateHomeTours.mockRejectedValue(new AiEngineError(kind));
            const { container } = render(createElement(DashboardUser));
            expect(await screen.findByText(ENGINE_TEXT)).toBeTruthy();
            expect(screen.queryByText('Non riesco a caricare le esperienze')).toBeNull();
            noObjectObject(container);
        });
    });
}
