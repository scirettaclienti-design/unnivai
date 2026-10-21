import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// NOTTE-FIX — il primo Quiz del giorno in una citta' aspetta la lista nuova (30-60 s, fino a 110 s):
// la pagina non cede prima del motore e, dopo ~10 s, dice cosa sta facendo.
const TECNICO = 'Non sono riuscito a completare il giro: un servizio non ha risposto. Riprova tra poco.';
const ATTESA = 'Sto conoscendo Troina per oggi. Meno di un minuto.';

vi.mock('framer-motion', async () => {
    const React = await import('react');
    const OMIT = new Set(['initial', 'animate', 'exit', 'variants', 'whileHover', 'whileTap', 'whileFocus', 'whileDrag', 'whileInView', 'transition', 'custom', 'layout', 'layoutId', 'drag', 'dragConstraints']);
    const clean = (props) => Object.fromEntries(Object.entries(props).filter(([k]) => !OMIT.has(k)));
    const motion = new Proxy({}, { get: (_t, tag) => React.forwardRef((props, ref) => React.createElement(tag, { ...clean(props), ref })) });
    return { motion, AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children) };
});
vi.mock('react-router-dom', async () => {
    const React = await import('react');
    return { Link: ({ children, to }) => React.createElement('a', { href: String(to) }, children), useNavigate: () => vi.fn(), useLocation: () => ({ state: null }) };
});
vi.mock('@/components/TopBar', () => ({ default: () => null }));
vi.mock('@/components/BottomNavigation', () => ({ default: () => null }));
vi.mock('@/hooks/useUserContext', () => ({ useUserContext: () => ({ city: 'Troina', temperatureC: 18, weatherCondition: 'sunny' }) }));
vi.mock('@/hooks/useAILearning', () => ({
    useAILearning: () => ({ trackGeneratedTour: vi.fn(), getAIContext: () => '', weights: {}, totalInteractions: 0, hasSeed: false }),
}));
vi.mock('@/services/cityCenterService', () => ({
    resolveCityCenter: vi.fn().mockResolvedValue({ latitude: 37.7823936, longitude: 14.5949418 }),
    CityCenterUnresolvedError: class CityCenterUnresolvedError extends Error {},
}));
const generateItinerary = vi.fn();
vi.mock('@/services/aiRecommendationService', () => ({
    aiRecommendationService: { generateItinerary: (...a) => generateItinerary(...a) },
    QUOTA_USER_MESSAGE: 'quota',
}));

import QuickPath from '../../pages/QuickPath';

const GIRO = { days: [{ title: 'Il tuo giro a Troina', stops: [{ place_id: 'p1', title: 'Barbera Silvestro', name: 'Barbera Silvestro', latitude: 37.785, longitude: 14.6008, lat: 37.785, lng: 14.6008, scheduledTime: '2026-10-20T22:30:00.000Z', stayMinutes: 45, type: 'restaurant', description: 'Dopo cena, due passi.' }] }], _source: 'google-first' };

beforeEach(() => { vi.useFakeTimers(); generateItinerary.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

const quizNatura = async () => {
    render(createElement(QuickPath));
    fireEvent.click(screen.getByText('Natura').closest('button'));
    fireEvent.click(screen.getByText('Parchi e Verde').closest('button'));
    fireEvent.click(screen.getByText('Medio').closest('button'));
    fireEvent.click(screen.getByText('Solo').closest('button'));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
};
const passa = (s) => act(async () => { await vi.advanceTimersByTimeAsync(s * 1000); });

describe('Quiz — attesa lunga della lista nuova', () => {
    it('il testo «Sto conoscendo <citta> per oggi. Meno di un minuto.» non c\'e\' subito, compare dopo ~10 s', async () => {
        generateItinerary.mockImplementation(() => new Promise(() => {}));
        await quizNatura();
        expect(screen.queryByText(ATTESA)).toBeNull();
        await passa(8);
        expect(screen.queryByText(ATTESA)).toBeNull();
        await passa(3);
        expect(screen.getByText(ATTESA)).toBeTruthy();
    });
    it('un giro che finisce dopo 105 s (lista nuova al limite dei 110 s) si vede, senza errore e senza il testo d\'attesa', async () => {
        generateItinerary.mockImplementation(() => new Promise((res) => setTimeout(() => res(GIRO), 105000)));
        await quizNatura();
        await passa(100);
        expect(screen.queryByText(TECNICO)).toBeNull();
        expect(screen.getByText(ATTESA)).toBeTruthy();
        await passa(6);
        expect(screen.queryByText(TECNICO)).toBeNull();
        expect(screen.queryByText(ATTESA)).toBeNull();
        expect(screen.getByText('Barbera Silvestro')).toBeTruthy();
    });
    it('un motore che non risponde mai: l\'errore tecnico arriva solo dopo i 150 s, oltre l\'attesa della lista (110 s)', async () => {
        generateItinerary.mockImplementation(() => new Promise(() => {}));
        await quizNatura();
        await passa(145);
        expect(screen.queryByText(TECNICO)).toBeNull();
        await passa(6);
        expect(screen.getByText(TECNICO)).toBeTruthy();
    });
});
