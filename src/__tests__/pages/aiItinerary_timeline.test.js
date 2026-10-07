import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Gate RAGGIO DIFF 1b — il CABLAGGIO della timeline, non il calcolo.
// Gate TAPPE PER MOMENTO — la colonna sinistra non mostra piu' lo scarto
// dall'inizio ("Inizio", "+35 min") ma l'ORARIO REALE di arrivo, cioe'
// `scheduledTime` gia' calcolato dal motore. Il test resta quello che era: monta
// la pagina e legge le coppie (titolo della tappa, etichetta nella SUA colonna)
// nell'ordine del DOM, perche' un `stops[index + 1]` nel render passerebbe
// verde su qualunque test puro.
//
// Mock SOLO di infrastruttura. Le tappe arrivano con `scheduledTime` e
// `stayMinutes` come le consegna il motore; la terza NON ha scheduledTime
// (un orario che il motore non sa), e la sua colonna deve restare vuota.
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
    return { Link: ({ children, to }) => React.createElement('a', { href: String(to) }, children) };
});

vi.mock('@/components/TopBar', () => ({ default: () => null }));
vi.mock('@/components/BottomNavigation', () => ({ default: () => null }));
vi.mock('@/hooks/useUserContext', () => ({
    useUserContext: () => ({ city: 'Roma', temperatureC: 22, weatherCondition: 'sunny' }),
}));
vi.mock('@/hooks/useAILearning', () => ({
    useAILearning: () => ({
        userDNAPreferences: [],
        trackGeneratedTour: vi.fn(),
        trackInteraction: vi.fn(),
        getAIContext: () => '',
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

// Quattro tappe, orari di ROMA espliciti (la CI gira in UTC). La terza non ha
// un orario: la sua colonna resta vuota, e il vuoto NON contagia la quarta —
// l'orario e' un dato della tappa, non un cumulativo.
const at = (hhmm) => new Date(`2026-10-08T${hhmm}:00+02:00`).toISOString();
const STOPS = [
    { title: 'Tappa Alfa',  type: 'cultura', description: 'a', stayMinutes: 30, travelMinutesFromPrev: null, scheduledTime: at('09:30'), latitude: 41.1, longitude: 12.1 },
    { title: 'Tappa Bravo', type: 'food',    description: 'b', stayMinutes: 20, travelMinutesFromPrev: 5,    scheduledTime: at('12:30'), latitude: 41.2, longitude: 12.2 },
    { title: 'Tappa Char',  type: 'natura',  description: 'c', stayMinutes: 45, travelMinutesFromPrev: null, scheduledTime: null,       latitude: 41.3, longitude: 12.3 },
    { title: 'Tappa Delta', type: 'relax',   description: 'd', stayMinutes: 60, travelMinutesFromPrev: 10,   scheduledTime: at('14:40'), latitude: 41.4, longitude: 12.4 },
];

const DAY = { day: 1, title: 'Giorno 1 a Roma', stops: STOPS };

/**
 * Legge la timeline come la legge un occhio: riga per riga, nell'ordine del
 * DOM, tenendo insieme il titolo della tappa e cio' che sta nella SUA colonna
 * sinistra. Asserire su `screen.getByText('Inizio')` proverebbe solo che la
 * stringa esiste da qualche parte — che e' esattamente il buco da chiudere.
 */
const readRows = (container) => {
    const columns = [...container.querySelectorAll('div[class*="min-w-"]')];
    return columns.map((col) => {
        const row = col.parentElement;
        const badge = col.querySelector('span');
        return {
            titolo: row.querySelector('h4')?.textContent ?? null,
            offset: badge ? badge.textContent : null,
            // la sosta vive nella colonna di destra, non in quella dell'offset
            colonnaDestra: row.querySelector('.flex-1')?.textContent ?? '',
        };
    });
};

const mountTimeline = async () => {
    const view = render(createElement(AiItinerary));
    fireEvent.click(screen.getByText('Arte').closest('button'));
    fireEvent.click(screen.getByText('Genera Viaggio').closest('button'));
    await waitFor(() => expect(screen.getByText('Tappa Alfa')).toBeInTheDocument());
    return view;
};

beforeEach(() => {
    generateItinerary.mockReset();
    generateItinerary.mockResolvedValue({ days: [DAY] });
});

describe('DIFF 1b — cablaggio della timeline (render), orario reale', () => {
    it('ogni orario sta sulla riga della SUA tappa', async () => {
        const { container } = await mountTimeline();
        expect(readRows(container).map(r => [r.titolo, r.offset])).toEqual([
            ['Tappa Alfa', '09:30'],
            ['Tappa Bravo', '12:30'],
            ['Tappa Char', null],
            ['Tappa Delta', '14:40'],
        ]);
    });

    it('nessuno scarto dall\'inizio: niente "Inizio", niente "+N min"', async () => {
        const { container } = await mountTimeline();
        expect(container.textContent).not.toContain('Inizio');
        expect(container.textContent).not.toMatch(/\+\s*\d+\s*(h|min)/);
    });

    it('la tappa senza scheduledTime non mostra orario, e non lo inventa', async () => {
        const { container } = await mountTimeline();
        const rows = readRows(container);
        expect(rows[2].titolo).toBe('Tappa Char');
        expect(rows[2].offset).toBeNull();
    });

    it('l\'ordine delle righe segue l\'ordine delle tappe', async () => {
        const { container } = await mountTimeline();
        expect(readRows(container).map(r => r.titolo)).toEqual(STOPS.map(s => s.title));
    });

    it('la sosta sta sulla card, non nella colonna dell\'orario', async () => {
        const { container } = await mountTimeline();
        const rows = readRows(container);
        expect(rows[2].colonnaDestra).toContain('~45 min');
        expect(rows[2].offset).toBeNull();
        expect(rows[0].colonnaDestra).toContain('~30 min');
        expect(rows[0].offset).toBe('09:30');
    });
});
