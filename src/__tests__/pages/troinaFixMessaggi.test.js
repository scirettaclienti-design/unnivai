// TROINA-FIX — i due messaggi del giro vuoto nel Quiz Veloce (QuickPath):
//   · un errore tecnico (selettore caduto, rete: `no-results-error`) non diventa mai «non troviamo»: e' il testo di Ivano
//     «Non sono riuscito a completare il giro: un servizio non ha risposto. Riprova tra poco.» col tasto «Riprova»;
//   · uno zero vero (`_zeroVero` dal motore) e' «A [città] non troviamo [categoria]. Cambia richiesta e riprovo.».
// Troina, 15/10: il selettore aveva risposto senza tappe e la pagina diceva «A Troina non troviamo parchi e giardini».
// I testi sono scritti qui per esteso (non importati): il test deve fallire sul codice di prima per il motivo giusto.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const TECNICO = 'Non sono riuscito a completare il giro: un servizio non ha risposto. Riprova tra poco.';

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
        useNavigate: () => vi.fn(),
        useLocation: () => ({ state: null }),
    };
});
vi.mock('@/components/TopBar', () => ({ default: () => null }));
vi.mock('@/components/BottomNavigation', () => ({ default: () => null }));
vi.mock('@/hooks/useUserContext', () => ({
    useUserContext: () => ({ city: 'Troina', temperatureC: 18, weatherCondition: 'sunny' }),
}));
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

beforeEach(() => { generateItinerary.mockReset(); });

const quizNatura = () => {
    render(createElement(QuickPath));
    fireEvent.click(screen.getByText('Natura').closest('button'));
    fireEvent.click(screen.getByText('Parchi e Verde').closest('button'));
    fireEvent.click(screen.getByText('Medio').closest('button'));
    fireEvent.click(screen.getByText('Solo').closest('button'));
};

describe('TROINA-FIX — Quiz Veloce: «non troviamo» solo per uno zero vero', () => {
    it('un errore tecnico (selettore caduto, rete) → il messaggio tecnico col tasto «Riprova», mai «non troviamo»', async () => {
        generateItinerary.mockResolvedValue({ days: [{ stops: [] }], _source: 'no-results-error', _oggetto_umano: 'parchi e giardini', _query: ['orto botanico'] });
        quizNatura();
        await waitFor(() => expect(screen.getByText(TECNICO)).toBeInTheDocument());
        expect(screen.getByText('Riprova')).toBeInTheDocument();
        expect(screen.queryByText(/non troviamo/)).toBeNull();
    });

    it('una ricerca fallita (search-error) → il messaggio tecnico, non «Non basta per un tour.»', async () => {
        generateItinerary.mockResolvedValue({ days: [{ stops: [] }], _source: 'search-error' });
        quizNatura();
        await waitFor(() => expect(screen.getByText(TECNICO)).toBeInTheDocument());
        expect(screen.queryByText('Non basta per un tour.')).toBeNull();
    });

    it('uno zero vero → «A Troina non troviamo parchi e giardini.» e «Cambia richiesta e riprovo.»', async () => {
        generateItinerary.mockResolvedValue({ days: [{ stops: [] }], _source: 'no-results', _zeroVero: true, _oggetto_umano: 'parchi e giardini' });
        quizNatura();
        await waitFor(() => expect(screen.getByText('A Troina non troviamo parchi e giardini.')).toBeInTheDocument());
        expect(screen.getByText('Cambia richiesta e riprovo.')).toBeInTheDocument();
        expect(screen.queryByText(TECNICO)).toBeNull();
    });
});
