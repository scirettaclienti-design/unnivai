import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ORARI — Percorso Veloce: a quest'ora quasi tutto chiuso → il messaggio dichiarato, non un giro.
// (mock e struttura come momentoEDurataQuickPath)
// Gate MOMENTO + DURATA VERA — due difetti della stessa catena QuickPath:
//   1. normalizeTourStep perdeva `moment`/`momentLabel`/`waitMinutesBefore`:
//      il momento scelto dallo scheletro spariva e l'intestazione si
//      ricostruiva dall'orario (una tappa d'aperitivo alle 17:50 finiva sotto
//      "Pomeriggio").
//   2. la card del Percorso Veloce mostrava 90/180/300 scritti a mano, non la
//      durata del tour: ora va dall'arrivo alla prima tappa alla fine
//      dell'ultima (scheduledTime + sosta); senza orari, la durata del motore
//      (QUICK_MINUTES di tourWindow.js).

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
    useUserContext: () => ({ city: 'Roma', temperatureC: 22, weatherCondition: 'sunny' }),
}));
vi.mock('@/hooks/useAILearning', () => ({
    useAILearning: () => ({
        trackGeneratedTour: vi.fn(),
        getAIContext: () => '',
        weights: {},
        totalInteractions: 0,
        hasSeed: false,
    }),
}));
vi.mock('@/services/cityCenterService', () => ({
    resolveCityCenter: vi.fn().mockResolvedValue({ latitude: 41.9028, longitude: 12.4964 }),
    CityCenterUnresolvedError: class CityCenterUnresolvedError extends Error {},
}));
const generateItinerary = vi.fn();
vi.mock('@/services/aiRecommendationService', () => ({
    aiRecommendationService: { generateItinerary: (...a) => generateItinerary(...a) },
    QUOTA_USER_MESSAGE: 'quota',
}));

import QuickPath from '../../pages/QuickPath';
import { MESSAGGIO_SERA as MESSAGGIO_CHIUSO } from '../../lib/openingHours';
import { MESSAGGIO_TECNICO } from '../../lib/esitoVuoto';

beforeEach(() => { generateItinerary.mockReset(); });

describe('QuickPath — a quest\'ora quasi tutto chiuso', () => {
    it('mostra il messaggio dichiarato, non "Non basta per un tour"', async () => {
        generateItinerary.mockResolvedValue({ days: [{ stops: [] }], _source: 'closed-now', _messaggio: MESSAGGIO_CHIUSO });
        render(createElement(QuickPath));
        fireEvent.click(screen.getByText('Città').closest('button'));
        fireEvent.click(screen.getByText('Rioni Storici').closest('button'));
        fireEvent.click(screen.getByText('Veloce').closest('button'));
        fireEvent.click(screen.getByText('Solo').closest('button'));
        await waitFor(() => expect(screen.getByText(MESSAGGIO_CHIUSO)).toBeInTheDocument());
        expect(screen.queryByText('Non basta per un tour.')).toBeNull();
        expect(screen.queryByText(/non ci sono abbastanza posti veri/)).toBeNull();
    });
    // TROINA-FIX — un vuoto che non e' uno zero vero (il motore non lo segna `_zeroVero`) e' il messaggio tecnico col tasto
    // «Riprova», mai «non troviamo» ne' «Non basta per un tour.» (non esiste piu').
    it('un risultato vuoto qualunque (non per gli orari, non uno zero vero) e\' il messaggio tecnico, non quello degli orari', async () => {
        generateItinerary.mockResolvedValue({ days: [{ stops: [] }], _source: 'no-results' });
        render(createElement(QuickPath));
        fireEvent.click(screen.getByText('Città').closest('button'));
        fireEvent.click(screen.getByText('Rioni Storici').closest('button'));
        fireEvent.click(screen.getByText('Veloce').closest('button'));
        fireEvent.click(screen.getByText('Solo').closest('button'));
        await waitFor(() => expect(screen.getByText(MESSAGGIO_TECNICO)).toBeInTheDocument());
        expect(screen.getByText('Riprova')).toBeInTheDocument();
        expect(screen.queryByText(MESSAGGIO_CHIUSO)).toBeNull();
        expect(screen.queryByText(/non troviamo/)).toBeNull();
    });
});
