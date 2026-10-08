import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// P7b2 — vincoli ovunque: Percorso Veloce e Sorprendimi passano al motore
// dieta e budget del primo accesso (come Crea il tuo percorso), e la riga
// onesta compare nei TRE riepiloghi. Sorprendimi non manda piu' un budget
// scritto a mano ('Medio'), che dal P7b avrebbe scavalcato il primo accesso.
vi.mock('framer-motion', async () => {
    const React = await import('react');
    const OMIT = new Set(['initial', 'animate', 'exit', 'variants', 'whileHover', 'whileTap', 'whileFocus', 'whileDrag', 'whileInView', 'transition', 'custom', 'layout', 'layoutId', 'drag', 'dragConstraints']);
    const clean = (props) => Object.fromEntries(Object.entries(props).filter(([k]) => !OMIT.has(k)));
    const motion = new Proxy({}, { get: (_t, tag) => React.forwardRef((props, ref) => React.createElement(tag, { ...clean(props), ref })) });
    return { motion, AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children) };
});
vi.mock('react-router-dom', async () => {
    const React = await import('react');
    return {
        Link: ({ children, to }) => React.createElement('a', { href: String(to) }, children),
        useNavigate: () => vi.fn(),
        useLocation: () => ({ state: null }),
    };
});
vi.mock('@/components/TopBar', () => ({ default: () => null }));
vi.mock('@/components/BottomNavigation', () => ({ default: () => null }));
vi.mock('@/hooks/useUserContext', () => ({
    useUserContext: () => ({ city: 'Roma', temperatureC: 22, weatherCondition: 'sunny', lat: 41.9, lng: 12.48 }),
}));
const ONBOARDING = { dieta: ['vegano'], budget: '€€', stile: null };
vi.mock('@/hooks/useAILearning', () => ({
    useAILearning: () => ({
        userDNAPreferences: [], trackGeneratedTour: vi.fn(), trackDnaEvent: vi.fn(),
        getAIContext: () => '', dnaWeights: {}, dnaShare: 0, onboardingPrefs: ONBOARDING,
    }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/services/cityCenterService', () => ({
    resolveCityCenter: vi.fn().mockResolvedValue({ latitude: 41.9028, longitude: 12.4964 }),
    CityCenterUnresolvedError: class CityCenterUnresolvedError extends Error {},
}));
const generateItinerary = vi.fn();
vi.mock('@/services/aiRecommendationService', () => ({
    aiRecommendationService: {
        generateItinerary: (...a) => generateItinerary(...a),
        getDailyQuotaStatus: async () => ({ exceeded: false }),
    },
    QUOTA_USER_MESSAGE: 'quota',
}));

import QuickPath from '../../pages/QuickPath';
import SurpriseTour from '../../pages/SurpriseTour';
import AiItinerary from '../../pages/AiItinerary';

const NOTE = 'Locali cercati come vegani: verifica sul posto.';
const DAY = {
    day: 1, title: 'Roma da romano', dietNote: NOTE,
    stops: [
        { title: 'Trattoria Vegana', type: 'restaurant', description: 'a', latitude: 41.9, longitude: 12.48 },
        { title: 'Museo Barracco', type: 'museum', description: 'b', latitude: 41.901, longitude: 12.481 },
    ],
};

beforeEach(() => {
    generateItinerary.mockReset();
    generateItinerary.mockResolvedValue({ days: [DAY], _source: 'google-first' });
});

const optsOf = () => generateItinerary.mock.calls[0][6];
const prefsOf = () => generateItinerary.mock.calls[0][1];

describe('P7b2 — Percorso Veloce', () => {
    it('passa al motore dieta e budget del primo accesso; la riga onesta nel riepilogo', async () => {
        render(createElement(QuickPath));
        fireEvent.click(screen.getByText('Gusto').closest('button'));
        fireEvent.click(screen.getByText('Carbonara Tour').closest('button'));
        fireEvent.click(screen.getByText('Veloce').closest('button'));
        fireEvent.click(screen.getByText('Solo').closest('button'));

        await waitFor(() => expect(generateItinerary).toHaveBeenCalled());
        expect(optsOf()).toMatchObject({ pathType: 'quick', onboardingPrefs: ONBOARDING });
        expect(await screen.findByText(NOTE)).toBeTruthy();
    });
});

describe('P7b2 — Sorprendimi', () => {
    it('passa al motore dieta e budget del primo accesso, senza un budget scritto a mano', async () => {
        render(createElement(SurpriseTour));
        fireEvent.click(screen.getByText('Tour Gastronomico'));
        fireEvent.click(screen.getByText(/Genera esperienza/).closest('button'));

        await waitFor(() => expect(generateItinerary).toHaveBeenCalled());
        expect(optsOf()).toMatchObject({ onboardingPrefs: ONBOARDING });
        expect(prefsOf().budget).toBeUndefined();
        expect(await screen.findByText(NOTE)).toBeTruthy();
    });
});

describe('P7b2 — la riga onesta nei tre riepiloghi', () => {
    it('Crea il tuo percorso', async () => {
        render(createElement(AiItinerary));
        fireEvent.change(screen.getByPlaceholderText(/Voglio perdermi/), { target: { value: 'Domani voglio vivere Roma da romano' } });
        fireEvent.click(screen.getByText('Genera Viaggio').closest('button'));
        expect(await screen.findByText(NOTE)).toBeTruthy();
        expect(optsOf()).toMatchObject({ onboardingPrefs: ONBOARDING });
    });

    it('senza dieta cercata nessuno dei riepiloghi mostra la riga', async () => {
        generateItinerary.mockResolvedValue({ days: [{ ...DAY, dietNote: undefined }], _source: 'google-first' });
        const { container } = render(createElement(QuickPath));
        fireEvent.click(screen.getByText('Gusto').closest('button'));
        fireEvent.click(screen.getByText('Carbonara Tour').closest('button'));
        fireEvent.click(screen.getByText('Veloce').closest('button'));
        fireEvent.click(screen.getByText('Solo').closest('button'));
        await screen.findByText('Trattoria Vegana');
        expect(container.querySelector('[data-diet-note]')).toBeNull();
    });
});
