import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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
import { QuickPathSummary } from '../../components/Map/QuickPathSummary';
import { normalizeTour, normalizeTourStep } from '../../services/tourShape';
import { QUICK_MINUTES } from '../../lib/tourWindow';

// Orari di ROMA espliciti (+02:00): la CI gira in UTC.
const at = (hhmm) => new Date(`2026-10-08T${hhmm}:00+02:00`).toISOString();

const stop = (title, hhmm, extra = {}) => ({
    title, type: 'cultura', description: `Dentro ${title} il rumore della strada si spegne.`,
    latitude: 41.9, longitude: 12.48, stayMinutes: 30, travelMinutesFromPrev: 10,
    scheduledTime: hhmm ? at(hhmm) : null,
    ...extra,
});

const statDurata = (container) => {
    const label = [...container.querySelectorAll('p')].find(p => p.textContent === 'Durata');
    return label ? label.previousElementSibling.textContent : null;
};

beforeEach(() => {
    generateItinerary.mockReset();
});

describe('normalizeTourStep — il momento della tappa passa così com\'è', () => {
    it('conserva moment, momentLabel e waitMinutesBefore', () => {
        const out = normalizeTourStep(stop('Bar del Fico', '17:50', {
            moment: 'aperitivo', momentLabel: 'Aperitivo', waitMinutesBefore: 10,
        }), 0, 'Roma');
        expect(out.moment).toBe('aperitivo');
        expect(out.momentLabel).toBe('Aperitivo');
        expect(out.waitMinutesBefore).toBe(10);
    });

    it('waitMinutesBefore 0 resta 0 (nessun default al suo posto)', () => {
        const out = normalizeTourStep(stop('A', '10:00', { moment: 'mattina', waitMinutesBefore: 0 }), 0, 'Roma');
        expect(out.waitMinutesBefore).toBe(0);
    });
});

describe('QuickPathSummary — il campo moment vince sull\'orario', () => {
    it('tappa moment "aperitivo" alle 17:50 → sotto Aperitivo, non Pomeriggio', () => {
        const tourData = normalizeTour({
            id: 'q', title: 'Roma', city: 'Roma',
            stops: [stop('Bar del Fico', '17:50', { moment: 'aperitivo', momentLabel: 'Aperitivo' })],
        });
        const { container } = render(createElement(QuickPathSummary, { tourData, choices: {} }));
        const headers = [...container.querySelectorAll('[data-moment-header]')].map(h => h.textContent);
        expect(headers).toEqual(['Aperitivo']);
        expect(screen.getByText('17:50')).toBeInTheDocument();
    });
});

describe('QuickPathSummary — durata dalla prima tappa alla fine dell\'ultima', () => {
    it('10:00 → 11:40 + sosta 30 = 12:10 → "2h 10m", anche se duration_minutes dice altro', () => {
        const tourData = normalizeTour({
            id: 'q', title: 'Roma', city: 'Roma', duration_minutes: 90,
            stops: [stop('A', '10:00'), stop('B', '11:40')],
        });
        const { container } = render(createElement(QuickPathSummary, { tourData, choices: {} }));
        expect(statDurata(container)).toBe('2h 10m');
    });
});

describe('QuickPath — senza orari la card usa la durata del motore', () => {
    const percorri = async (durata) => {
        const view = render(createElement(QuickPath));
        fireEvent.click(screen.getByText('Città').closest('button'));
        fireEvent.click(screen.getByText('Rioni Storici').closest('button'));
        fireEvent.click(screen.getByText(durata).closest('button'));
        fireEvent.click(screen.getByText('Solo').closest('button'));
        await waitFor(() => expect(screen.getByText('Senza Orario')).toBeInTheDocument());
        return view;
    };

    it('Veloce, tappe senza scheduledTime → QUICK_MINUTES.veloce, non 90', async () => {
        generateItinerary.mockResolvedValue({
            days: [{ title: 'Roma', stops: [stop('Senza Orario', null)] }],
        });
        const { container } = await percorri('Veloce');
        expect(QUICK_MINUTES.veloce).toBe(120);
        expect(statDurata(container)).toBe('2h');
    });

    it('Lungo, tappe senza scheduledTime → QUICK_MINUTES.lungo, non 300', async () => {
        generateItinerary.mockResolvedValue({
            days: [{ title: 'Roma', stops: [stop('Senza Orario', null)] }],
        });
        const { container } = await percorri('Lungo');
        expect(statDurata(container)).toBe(`${QUICK_MINUTES.lungo / 60}h`);
    });
});
