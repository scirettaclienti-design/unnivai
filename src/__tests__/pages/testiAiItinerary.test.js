import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// TESTI — la schermata del tour in Crea il tuo percorso, letta come la legge un occhio:
// etichette di tipo in italiano (dal tipo principale), meteo in italiano, «tappe» concordate,
// il numero del giorno solo nei tour di più giorni, «Dopocena» dopo le 21:30, il tempo libero.
// Mock SOLO di infrastruttura (stesso impianto di aiItinerary_timeline.test.js).
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
    useUserContext: () => ({ city: 'Catania', temperatureC: 22, weatherCondition: 'sunny' }),
}));
vi.mock('@/hooks/useAILearning', () => ({
    useAILearning: () => ({ userDNAPreferences: [], trackGeneratedTour: vi.fn(), trackInteraction: vi.fn(), getAIContext: () => '' }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/services/cityCenterService', () => ({
    resolveCityCenter: vi.fn().mockResolvedValue({ latitude: 37.5, longitude: 15.08 }),
    CityCenterUnresolvedError: class CityCenterUnresolvedError extends Error {},
}));
const generateItinerary = vi.fn();
vi.mock('@/services/aiRecommendationService', () => ({
    aiRecommendationService: { generateItinerary: (...a) => generateItinerary(...a) },
}));

import AiItinerary from '../../pages/AiItinerary';

const at = (hhmm) => new Date(`2026-10-16T${hhmm}:00+02:00`).toISOString();
const stop = (title, o) => ({ title, description: 'x', stayMinutes: 20, travelMinutesFromPrev: 5, latitude: 37.5, longitude: 15.08, types: [], ...o });

const mount = async (days) => {
    generateItinerary.mockResolvedValue({ days });
    const view = render(createElement(AiItinerary));
    fireEvent.click(screen.getByText('Arte').closest('button'));
    fireEvent.click(screen.getByText('Genera Viaggio').closest('button'));
    await waitFor(() => expect(view.container.querySelector('[data-stop-card]')).not.toBeNull());
    return view;
};

beforeEach(() => generateItinerary.mockReset());

describe('TESTI — la schermata del tour', () => {
    it('etichetta di tipo: dal tipo principale, in italiano; «Retrò - Cocktail Bar» non è un ristorante; tipo senza traduzione = niente', async () => {
        const { container } = await mount([{ day: 1, title: 'Il tuo giro a Catania', stops: [
            stop('Retrò - Cocktail Bar', { type: 'restaurant', primaryType: 'cocktail_bar', types: ['bar', 'restaurant'], moment: 'aperitivo', scheduledTime: at('19:00') }),
            stop('Chiesa di San Nicola', { type: 'church', primaryType: 'church', types: ['church'], moment: 'aperitivo', scheduledTime: at('19:30') }),
            stop('Centro culturale', { type: 'place', primaryType: 'cultural_center', types: ['cultural_center'], moment: 'aperitivo', scheduledTime: at('20:00') }),
        ] }]);
        const etichette = [...container.querySelectorAll('[data-stop-card]')].map(c => c.querySelector('[data-type-label]')?.textContent ?? null);
        expect(etichette).toEqual(['bar', 'chiesa', null]);
        expect(container.textContent).not.toMatch(/\b(restaurant|church|place|museum|monument|park)\b/);
    });

    it('meteo in italiano (mai «sunny»); un tour senza meteo non mostra il riquadro', async () => {
        const { container } = await mount([{ day: 1, title: 'Il tuo giro a Catania', weather: { condition: 'sunny', temperature: 21, icon: '☀️' }, stops: [stop('Villa Bellini', { type: 'park', primaryType: 'park', scheduledTime: at('10:00') })] }]);
        expect(container.querySelector('[data-weather-condition]').textContent).toBe('sereno');
        expect(container.textContent).not.toMatch(/sunny|cloudy|rainy/);
    });

    it('il meteo di un giorno futuro non c\'è: nessun riquadro', async () => {
        const { container } = await mount([{ day: 1, title: 'Il tuo giro a Catania', weather: null, stops: [stop('Villa Bellini', { type: 'park', primaryType: 'park', scheduledTime: at('10:00') })] }]);
        expect(container.querySelector('[data-weather-condition]')).toBeNull();
        expect(container.textContent).not.toMatch(/°C/);
    });

    it('«1 tappa programmata» (mai «1 tappe»); in un tour di un giorno non c\'è il numero del giorno', async () => {
        const { container } = await mount([{ day: 1, title: 'Il tuo giro a Catania', stops: [stop('Villa Bellini', { type: 'park', primaryType: 'park', scheduledTime: at('10:00') })] }]);
        expect(container.textContent).toContain('1 tappa programmata');
        expect(container.textContent).not.toMatch(/1 tappe/);
        expect(container.textContent).not.toMatch(/Giorno \d/);
    });

    it('in un tour di due giorni il navigatore dei giorni c\'è', async () => {
        const { container } = await mount([
            { day: 1, title: 'Giorno 1 a Catania', stops: [stop('Villa Bellini', { type: 'park', primaryType: 'park', scheduledTime: at('10:00') })] },
            { day: 2, title: 'Giorno 2 a Catania', stops: [stop('Teatro Massimo Bellini', { type: 'place', primaryType: 'performing_arts_theater', scheduledTime: at('10:00') })] },
        ]);
        expect([...container.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => /^Giorno \d$/.test(t))).toEqual(['Giorno 1', 'Giorno 2']);
    });

    it('dalle 21:30 la sezione si chiama «Dopocena», prima resta «Aperitivo»; il tempo libero ha titolo, fascia e frase', async () => {
        const { container } = await mount([{ day: 1, title: 'Il tuo giro a Catania', stops: [
            stop('Bar Uno', { type: 'restaurant', primaryType: 'bar', moment: 'aperitivo', scheduledTime: at('21:00'), stayMinutes: 20 }),
            { tempoLibero: true, title: 'Tempo libero', moment: 'aperitivo', scheduledTime: at('21:20'), stayMinutes: 25, description: 'Niente in agenda: cammina dove ti porta la strada.' },
            stop('Bar Due', { type: 'restaurant', primaryType: 'bar', moment: 'aperitivo', scheduledTime: at('21:45'), stayMinutes: 20 }),
        ] }]);
        const sezioni = [...container.querySelectorAll('[data-moment-header]')].map(h => h.textContent.trim());
        expect(sezioni).toEqual(['Aperitivo', 'Dopocena']);
        const libero = container.querySelector('[data-free-time]');
        expect(libero.textContent).toContain('Tempo libero');
        expect(libero.querySelector('[data-free-time-range]').textContent).toBe('21:20–21:45');
        expect(libero.textContent).toContain('Niente in agenda: cammina dove ti porta la strada.');
    });
});
