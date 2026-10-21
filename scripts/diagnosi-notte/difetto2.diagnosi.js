// DIAGNOSI-NOTTE — difetto 2: il primo Quiz del giorno in una citta' senza la lista del giorno va in «Non sono riuscito a completare il giro».
// Il Quiz ha un tempo massimo fisso di 35 s (QuickPath.jsx, safety timeout); il motore aspetta la lista fino a 110 s (cityKnowledgeService)
// e la lista nuova ha impiegato 31–57 s nelle prove (PROVE-SIM). Qui il motore e' un finto che impiega «la lista + il resto» di tempo
// virtuale; la pagina e' quella vera. Su main FALLISCE (di proposito, vedi vitest.config.js).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

const TECNICO = 'Non sono riuscito a completare il giro: un servizio non ha risposto. Riprova tra poco.';

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

import QuickPath from '../../src/pages/QuickPath';

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
// un giro riuscito (una tappa vera): finisce dopo `s` secondi di tempo virtuale
const GIRO = { days: [{ title: 'Il tuo giro a Troina', stops: [{ place_id: 'p1', title: 'Barbera Silvestro', name: 'Barbera Silvestro', latitude: 37.785, longitude: 14.6008, lat: 37.785, lng: 14.6008, scheduledTime: '2026-10-20T22:30:00.000Z', stayMinutes: 45, type: 'restaurant', description: 'Dopo cena, due passi.' }] }], _source: 'google-first' };
const motoreInSecondi = (s) => generateItinerary.mockImplementation(() => new Promise((res) => setTimeout(() => res(GIRO), s * 1000)));

describe('difetto 2 — il Quiz non si arrende prima che la lista nuova del giorno possa arrivare', () => {
    it('controllo: con la lista gia\' salvata (giro di 20 s, come il secondo tentativo della prova 2) la pagina non cede', async () => {
        motoreInSecondi(20);
        await quizNatura();
        await act(async () => { await vi.advanceTimersByTimeAsync(36000); });
        expect(screen.queryByText(TECNICO)).toBeNull();
    });
    // PROVE-SIM: lista nuova 31 s (Troina), 42–57 s (citta'); il resto del giro dopo la lista 7–20 s.
    it.each([[40, 'Troina: lista 31 s + resto'], [65, 'una citta\': lista 57 s + resto']])('con il motore ancora al lavoro dopo %i s (%s) la pagina non mostra l\'errore tecnico', async (secondi) => {
        motoreInSecondi(secondi);
        await quizNatura();
        await act(async () => { await vi.advanceTimersByTimeAsync(36000); });
        // a 36 s il motore sta ancora lavorando (finisce a `secondi`): la pagina deve aspettare, non dire che «un servizio non ha risposto»
        expect(screen.queryByText(TECNICO), `a 36 s la pagina ha gia' ceduto (il motore finiva a ${secondi} s)`).toBeNull();
        await act(async () => { await vi.advanceTimersByTimeAsync((secondi - 36) * 1000 + 1000); });
        expect(screen.queryByText(TECNICO), 'a giro finito la pagina deve mostrare il giro, non l\'errore').toBeNull();
    });
    it('il tempo massimo della pagina non e\' piu\' corto dell\'attesa della lista (110 s) — oppure la lista non e\' sul cammino del Quiz', async () => {
        motoreInSecondi(105);
        await quizNatura();
        await act(async () => { await vi.advanceTimersByTimeAsync(100000); });
        expect(screen.queryByText(TECNICO)).toBeNull();
    });
});
