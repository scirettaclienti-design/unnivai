import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Gate RAGGIO DIFF 1b — il CABLAGGIO della timeline, non il calcolo.
//
// I test puri su computeCumulativeOffsets e formatOffsetLabel provano che i
// numeri e le etichette sono giusti. Non provano che l'etichetta giusta finisca
// sulla RIGA giusta: un `offsets[index + 1]` nel render passerebbe verde su
// tutta la suite pura. Questo file monta la pagina e legge le coppie
// (titolo della tappa, etichetta nella sua colonna) nell'ordine del DOM.
//
// Mock SOLO di infrastruttura, mai del calcolo: `computeCumulativeOffsets` e
// `formatOffsetLabel` girano veri. Le tappe arrivano gia' con `stayMinutes` e
// `travelMinutesFromPrev` valorizzati, come le consegna computeStopTimings in
// produzione, cosi' il test misura il tratto fra il dato e il pixel.
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

// Quattro tappe. Il buco sta sulla TERZA: `travelMinutesFromPrev: null`.
// Offset attesi: 0 | 0+30+5=35 | null (buco) | null (assorbito).
const STOPS = [
    { title: 'Tappa Alfa',  type: 'cultura', description: 'a', stayMinutes: 30, travelMinutesFromPrev: null, latitude: 41.1, longitude: 12.1 },
    { title: 'Tappa Bravo', type: 'food',    description: 'b', stayMinutes: 20, travelMinutesFromPrev: 5,    latitude: 41.2, longitude: 12.2 },
    { title: 'Tappa Char',  type: 'natura',  description: 'c', stayMinutes: 45, travelMinutesFromPrev: null, latitude: 41.3, longitude: 12.3 },
    { title: 'Tappa Delta', type: 'relax',   description: 'd', stayMinutes: 60, travelMinutesFromPrev: 10,   latitude: 41.4, longitude: 12.4 },
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

describe('DIFF 1b — cablaggio della timeline (render)', () => {
    it('ogni etichetta sta sulla riga della SUA tappa', async () => {
        const { container } = await mountTimeline();
        expect(readRows(container).map(r => [r.titolo, r.offset])).toEqual([
            ['Tappa Alfa', 'Inizio'],
            ['Tappa Bravo', '+35 min'],
            ['Tappa Char', null],
            ['Tappa Delta', null],
        ]);
    });

    it('la prima tappa legge "Inizio", e non e\' la seconda a leggerlo', async () => {
        const { container } = await mountTimeline();
        const rows = readRows(container);
        expect(rows[0].offset).toBe('Inizio');
        expect(rows[1].offset).not.toBe('Inizio');
    });

    it('la tappa col travel null non mostra offset, e nemmeno quelle dopo', async () => {
        const { container } = await mountTimeline();
        const rows = readRows(container);
        expect(rows[2].offset).toBeNull();
        expect(rows[3].offset).toBeNull();
        // e la tappa col buco e\' davvero la terza, non un\'altra
        expect(rows[2].titolo).toBe('Tappa Char');
    });

    it('l\'ordine delle etichette segue l\'ordine delle tappe', async () => {
        const { container } = await mountTimeline();
        const rows = readRows(container);
        expect(rows.map(r => r.titolo)).toEqual(STOPS.map(s => s.title));
        expect(rows.map(r => r.offset)).toEqual(['Inizio', '+35 min', null, null]);
    });

    it('la sosta sta sulla card, non nella colonna dell\'offset', async () => {
        const { container } = await mountTimeline();
        const rows = readRows(container);
        // "~45 min" e\' la sosta della terza tappa: sta a destra...
        expect(rows[2].colonnaDestra).toContain('~45 min');
        // ...e la colonna sinistra della terza tappa non contiene nulla,
        // perche\' il suo offset e\' null. Le due misure non si mescolano.
        expect(rows[2].offset).toBeNull();
        expect(rows[0].colonnaDestra).toContain('~30 min');
        expect(rows[0].offset).toBe('Inizio');
    });
});
