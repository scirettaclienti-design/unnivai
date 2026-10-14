import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// VERITÀ-PRE-GIRO 1 — niente meteo inventato. Se il servizio non risponde o risponde male, non si mostra niente:
// mai «sunny, 24°», mai «Soleggiato, 22°», mai 20° al posto di un dato che manca. Mock SOLO di infrastruttura (rete, motore, pagine intorno).

// ─── il servizio ────────────────────────────────────────────────────────────
const { weatherService } = await import('../../services/weatherService');

const risponde = (body, ok = true) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: async () => body }));
let lat = 41.9;
beforeEach(() => { weatherService.cache.clear(); lat += 0.01; vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('VERITÀ 1 — il servizio meteo non inventa', () => {
    it('la rete cade → nessun meteo (null), non 24° sereno', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rete giù')));
        expect(await weatherService.getCurrentWeather(lat, 12.5)).toBeNull();
        expect(await weatherService.getWeather('Roma', lat, 12.5)).toBeNull();
    });
    it('HTTP non 2xx → null', async () => {
        risponde({}, false);
        expect(await weatherService.getCurrentWeather(lat, 12.5)).toBeNull();
    });
    it('risposta senza `current`, con temperatura nulla o con codice mancante → null (mai 0°, mai «nuvoloso» di ripiego)', async () => {
        for (const corpo of [{}, { current: {} }, { current: { temperature_2m: null, weather_code: 0 } }, { current: { temperature_2m: 18, weather_code: null } }, { current: { temperature_2m: 'caldo', weather_code: 1 } }]) {
            weatherService.cache.clear();
            risponde(corpo);
            expect(await weatherService.getCurrentWeather(lat, 12.5), JSON.stringify(corpo)).toBeNull();
        }
    });
    it('senza coordinate e senza città riconoscibile → null', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }));
        expect(await weatherService.getCurrentWeather(null, null)).toBeNull();
        expect(await weatherService.getWeather('Cittàchenonesiste')).toBeNull();
        expect(await weatherService.getWeather()).toBeNull();
    });
    it('il valore di riserva non esiste più', () => {
        expect(weatherService.getFallbackWeather).toBeUndefined();
    });
    it('una risposta vera passa com\'è, anche 0°C', async () => {
        risponde({ current: { temperature_2m: 0.2, weather_code: 3 } });
        expect(await weatherService.getCurrentWeather(lat, 12.5)).toMatchObject({ temperature: 0, condition: 'cloudy' });
    });
    it('un codice che il servizio non conosce non diventa «nuvoloso»: nebbia e neve si dicono per quello che sono', async () => {
        const dice = async (codice) => { weatherService.cache.clear(); risponde({ current: { temperature_2m: 3, weather_code: codice } }); return (await weatherService.getCurrentWeather(lat, 12.5))?.condition ?? null; };
        expect(await dice(45)).toBe('foggy');
        expect(await dice(73)).toBe('snowy');
        expect(await dice(86)).toBe('snowy');
        expect(await dice(61)).toBe('rainy');
        expect(await dice(0)).toBe('sunny');
        expect(await dice(1234)).toBeNull();
    });
});

// ─── il badge della mappa ───────────────────────────────────────────────────
const { WeatherAirBadge } = await import('../../components/Map/WeatherAirBadge');
const COORDS = { latitude: 37.5, longitude: 15.08 };
const badge = async (center, corpo, { ko = false } = {}) => {
    if (ko) vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rete giù')));
    else vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => corpo }));
    const view = render(createElement(WeatherAirBadge, { city: 'Catania', center }));
    await new Promise(r => setTimeout(r, 20));
    return view;
};

describe('VERITÀ 1 — il badge meteo della mappa', () => {
    it('senza coordinate non mostra niente (non «Soleggiato, 22°, vento 10»)', async () => {
        const { container } = await badge(null, {});
        expect(container.textContent).toBe('');
    });
    it('la rete cade → niente', async () => {
        const { container } = await badge(COORDS, null, { ko: true });
        expect(container.textContent).toBe('');
    });
    it('risposta senza `current` o con valori nulli → niente (non 0° e 0 km/h)', async () => {
        for (const corpo of [{}, { current: { temperature_2m: null, wind_speed_10m: 4, weather_code: 0 } }, { current: { temperature_2m: 20, wind_speed_10m: null, weather_code: 0 } }, { current: { temperature_2m: 20, wind_speed_10m: 4 } }]) {
            const { container, unmount } = await badge(COORDS, corpo);
            expect(container.textContent, JSON.stringify(corpo)).toBe('');
            unmount();
        }
    });
    it('un temporale non è «Neve», la nebbia non è «Sereno»', async () => {
        const dice = async (codice) => { const { container, unmount } = await badge(COORDS, { current: { temperature_2m: 12, wind_speed_10m: 8, weather_code: codice } }); const t = container.querySelector('[title]')?.getAttribute('title'); unmount(); return t; };
        expect(await dice(95)).toBe('Pioggia');
        expect(await dice(45)).toBe('Nebbia');
        expect(await dice(0)).toBe('Sereno');
        expect(await dice(73)).toBe('Neve');
    });
});

// ─── le pagine che chiamano il motore ───────────────────────────────────────
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
let contesto = { city: 'Roma', temperatureC: null, weatherCondition: null };
vi.mock('@/hooks/useUserContext', () => ({ useUserContext: () => contesto }));
vi.mock('@/hooks/useAILearning', () => ({
    useAILearning: () => ({ userDNAPreferences: [], trackGeneratedTour: vi.fn(), trackInteraction: vi.fn(), getAIContext: () => '', weights: {}, totalInteractions: 0, hasSeed: false }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/services/cityCenterService', () => ({
    // un'implementazione (non mockResolvedValue): `vi.restoreAllMocks()` in afterEach non la cancella fra un test e l'altro
    resolveCityCenter: vi.fn(async () => ({ latitude: 41.9028, longitude: 12.4964 })),
    CityCenterUnresolvedError: class CityCenterUnresolvedError extends Error {},
}));
const generateItinerary = vi.fn();
vi.mock('@/services/aiRecommendationService', () => ({
    aiRecommendationService: { generateItinerary: (...a) => generateItinerary(...a) },
    QUOTA_USER_MESSAGE: 'quota',
}));

const QuickPath = (await import('../../pages/QuickPath')).default;
const AiItinerary = (await import('../../pages/AiItinerary')).default;
const GIORNO = { day: 1, title: 'Roma', stops: [{ title: 'Tappa Alfa', type: 'cultura', description: 'a', stayMinutes: 30, travelMinutesFromPrev: null, scheduledTime: null, latitude: 41.1, longitude: 12.1 }] };

const meteoPassatoAlMotore = async (pagina) => {
    generateItinerary.mockReset();
    generateItinerary.mockResolvedValue({ days: [GIORNO] });
    const { unmount } = render(createElement(pagina));
    if (pagina === QuickPath) {
        fireEvent.click(screen.getByText('Città').closest('button'));
        fireEvent.click(screen.getByText('Rioni Storici').closest('button'));
        fireEvent.click(screen.getByText('Veloce').closest('button'));
        fireEvent.click(screen.getByText('Solo').closest('button'));
    } else {
        fireEvent.click(screen.getByText('Arte').closest('button'));
        fireEvent.click(screen.getByText('Genera Viaggio').closest('button'));
    }
    await waitFor(() => expect(generateItinerary).toHaveBeenCalled());
    const meteo = generateItinerary.mock.calls[0][3];
    unmount();
    return meteo;
};

describe('VERITÀ 1 — le pagine non passano al motore un meteo di riserva', () => {
    for (const [nome, pagina] of [['Percorso Veloce', QuickPath], ['Crea il tuo percorso', AiItinerary]]) {
        it(`${nome}: meteo sconosciuto → nessun valore (né «sunny» né 20°)`, async () => {
            contesto = { city: 'Roma', temperatureC: null, weatherCondition: null };
            const m = await meteoPassatoAlMotore(pagina);
            expect(m?.condition ?? null).toBeNull();
            expect(m?.temperature ?? null).toBeNull();
        });
        it(`${nome}: 0°C vero resta 0°C (non 20)`, async () => {
            contesto = { city: 'Roma', temperatureC: 0, weatherCondition: 'cloudy' };
            const m = await meteoPassatoAlMotore(pagina);
            expect(m).toMatchObject({ condition: 'cloudy', temperature: 0 });
        });
    }
});

describe('VERITÀ 1 — nessun valore di riserva nel sorgente', () => {
    const leggi = (p) => readFileSync(path.resolve(__dirname, '../..', p), 'utf8');
    it('nessuna pagina scrive `|| \'sunny\'` o `|| 20` per il meteo', () => {
        for (const p of ['pages/AiItinerary.jsx', 'pages/QuickPath.jsx', 'pages/Notifications.jsx']) {
            expect(leggi(p), p).not.toMatch(/\|\|\s*'sunny'/);
            expect(leggi(p), p).not.toMatch(/temperatureC\s*\|\|\s*\d+/);
        }
    });
    it('il servizio e il badge non hanno più temperature o condizioni scritte a mano', () => {
        expect(leggi('services/weatherService.js')).not.toMatch(/getFallbackWeather|temperature:\s*24/);
        expect(leggi('components/Map/WeatherAirBadge.jsx')).not.toMatch(/temp:\s*22|'Soleggiato'/);
    });
});
