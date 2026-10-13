import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// C8a — il Percorso Veloce passa al motore RITMO e UMORE esattamente come Crea il tuo percorso:
// `pace` (Rilassato/Attivo/Intenso) e gli interessi come chip (Arte, Cibo, Storia, Natura, Shopping…).
// Prima mandava solo {duration, group, interests: [titolo umore, titolo scelta]}: il ritmo era sempre Attivo
// e "Relax" restava un titolo senza effetto (D-CATANIA A3).
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
    useUserContext: () => ({ city: 'Siracusa', temperatureC: 22, weatherCondition: 'sunny' }),
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
import { buildQuickPrefs } from '../../pages/QuickPath';

beforeEach(() => { generateItinerary.mockReset(); generateItinerary.mockResolvedValue({ days: [{ stops: [] }], _source: 'no-results' }); });

const percorso = async (umore, scelta) => {
    render(createElement(QuickPath));
    fireEvent.click(screen.getByText(umore).closest('button'));
    fireEvent.click(screen.getByText(scelta).closest('button'));
    fireEvent.click(screen.getByText('Veloce').closest('button'));
    fireEvent.click(screen.getByText('Solo').closest('button'));
    await waitFor(() => expect(generateItinerary).toHaveBeenCalledTimes(1));
    return generateItinerary.mock.calls[0];
};

describe('QuickPath — ritmo e umore arrivano al motore come in Crea', () => {
    it('umore Relax → ritmo Rilassato, interessi Relax e Benessere; pathType quick', async () => {
        const [city, prefs, , , , , opts] = await percorso('Relax', 'Benessere');
        expect(city).toBe('Siracusa');
        expect(prefs).toMatchObject({ duration: 'Veloce', group: 'Solo', pace: 'Rilassato' });
        expect(prefs.interests).toEqual(['Relax', 'Benessere']);
        expect(opts.pathType).toBe('quick');
    });
    it('umore Natura → ritmo Attivo e l\'interesse Natura (la stessa parola del chip di Crea)', async () => {
        const [, prefs] = await percorso('Natura', 'Parchi e Verde');
        expect(prefs.pace).toBe('Attivo');
        expect(prefs.interests).toEqual(['Natura', 'Parchi e Verde']);
    });
    it('umore Storia → interesse Storia (privilegia la cultura come in Crea)', async () => {
        const [, prefs] = await percorso('Storia', 'Cultura e Musei');
        expect(prefs.interests).toContain('Storia');
        expect(prefs.pace).toBe('Attivo');
    });
});

describe('buildQuickPrefs — la forma di Crea', () => {
    it('ha le stesse chiavi che Crea manda al motore (duration, group, interests, pace)', () => {
        const p = buildQuickPrefs({ main: 'relax', mainTitle: 'Relax', subTitle: 'Benessere', durationTitle: 'Veloce', groupTitle: 'Solo' });
        expect(Object.keys(p).sort()).toEqual(['duration', 'group', 'interests', 'pace']);
    });
    it('Gusto → Cibo, Fashion → Shopping, Vulcano → Natura; Città nessun interesse in più; mai doppioni', () => {
        expect(buildQuickPrefs({ main: 'cibo', mainTitle: 'Gusto', subTitle: 'Vera Pizza' }).interests).toEqual(['Gusto', 'Vera Pizza', 'Cibo']);
        expect(buildQuickPrefs({ main: 'moda', mainTitle: 'Fashion', subTitle: 'Quadrilatero' }).interests).toContain('Shopping');
        expect(buildQuickPrefs({ main: 'vulcano', mainTitle: 'Vulcano', subTitle: 'Vesuvio View' }).interests).toContain('Natura');
        expect(buildQuickPrefs({ main: 'citta', mainTitle: 'Città', subTitle: 'Rioni Storici' }).interests).toEqual(['Città', 'Rioni Storici']);
        expect(buildQuickPrefs({ main: 'natura', mainTitle: 'Natura', subTitle: 'Natura' }).interests).toEqual(['Natura']);
    });
    it('senza scelte non esplode: ritmo Attivo, nessun interesse', () => {
        expect(buildQuickPrefs()).toEqual({ duration: '', group: '', interests: [], pace: 'Attivo' });
    });
});
