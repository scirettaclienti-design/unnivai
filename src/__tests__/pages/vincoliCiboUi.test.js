import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// P7b — a schermo: la riga onesta sulla dieta nel riepilogo del giorno, e il
// budget del wizard (fino a oggi ignorato) che arriva al motore insieme al
// primo accesso. La gerarchia la applica il motore (vincoliCibo.test.js): qui
// si prova che la pagina gli passa entrambe le fonti.
vi.mock('framer-motion', async () => {
    const React = await import('react');
    const OMIT = new Set(['initial', 'animate', 'exit', 'variants', 'whileHover', 'whileTap', 'whileFocus', 'whileDrag', 'whileInView', 'transition', 'custom', 'layout', 'layoutId', 'drag', 'dragConstraints']);
    const clean = (props) => Object.fromEntries(Object.entries(props).filter(([k]) => !OMIT.has(k)));
    const motion = new Proxy({}, { get: (_t, tag) => React.forwardRef((props, ref) => React.createElement(tag, { ...clean(props), ref })) });
    return { motion, AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children) };
});
vi.mock('react-router-dom', async () => {
    const React = await import('react');
    return { Link: ({ children, to }) => React.createElement('a', { href: String(to) }, children) };
});
vi.mock('@/components/TopBar', () => ({ default: () => null }));
vi.mock('@/components/BottomNavigation', () => ({ default: () => null }));
vi.mock('@/hooks/useUserContext', () => ({ useUserContext: () => ({ city: 'Roma', temperatureC: 22, weatherCondition: 'sunny' }) }));
const ONBOARDING = { dieta: ['vegetariano'], budget: '€€€', stile: 'trattoria' };
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
    aiRecommendationService: { generateItinerary: (...a) => generateItinerary(...a) },
}));

import AiItinerary from '../../pages/AiItinerary';

const NOTE = 'Locali cercati come vegetariani: verifica sul posto.';
const DAY = {
    day: 1, title: 'Roma da romano', dietNote: NOTE,
    stops: [{ title: 'Margutta Vegetariano', type: 'restaurant', description: 'a', latitude: 41.9, longitude: 12.48 }],
};

beforeEach(() => {
    generateItinerary.mockReset();
    generateItinerary.mockResolvedValue({ days: [DAY], _source: 'google-first' });
});

describe('P7b — AiItinerary: vincoli a tavola', () => {
    it('passa al motore il primo accesso e il budget del wizard; mostra la riga onesta', async () => {
        render(createElement(AiItinerary));
        fireEvent.change(screen.getByPlaceholderText(/Voglio perdermi/), { target: { value: 'Domani voglio vivere Roma da romano' } });
        fireEvent.click(screen.getByText('Economico'));
        fireEvent.click(screen.getByText('Genera Viaggio').closest('button'));

        await waitFor(() => expect(generateItinerary).toHaveBeenCalled());
        const [, prefs, , , , , opts] = generateItinerary.mock.calls[0];
        expect(prefs.budget).toBe('Economico');
        expect(opts.onboardingPrefs).toEqual(ONBOARDING);

        expect(await screen.findByText(NOTE)).toBeTruthy();
        expect(screen.queryByText(/è vegetariano|e' vegetariano/)).toBeNull();
    });

    it('senza dieta cercata, nessuna riga', async () => {
        generateItinerary.mockResolvedValue({ days: [{ ...DAY, dietNote: undefined }], _source: 'google-first' });
        const { container } = render(createElement(AiItinerary));
        fireEvent.change(screen.getByPlaceholderText(/Voglio perdermi/), { target: { value: 'un giro' } });
        fireEvent.click(screen.getByText('Genera Viaggio').closest('button'));
        await screen.findByText('Margutta Vegetariano');
        expect(container.querySelector('[data-diet-note]')).toBeNull();
    });
});
