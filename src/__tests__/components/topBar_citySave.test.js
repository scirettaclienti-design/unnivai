import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Gate C1 — il nome citta' digitato dall'utente non si riscrive.
//
// TopBar.handleSaveCity applicava un Title Case:
//     newCity.trim().charAt(0).toUpperCase() + newCity.trim().slice(1).toLowerCase()
// Il commento diceva "to ensure key lookups work", e per le tabelle a chiave
// singola (CITY_COORDS, CITY_CONFIG: "Roma", "Milano", "Napoli"...) era vero.
// Su tutto il resto era distruttivo:
//     "Reggio Emilia"        -> "Reggio emilia"
//     "L'Aquila"             -> "L'aquila"
//     "San Giovanni Rotondo" -> "San giovanni rotondo"
//
// E questo e' il punto peggiore in cui la trasformazione poteva stare: il
// `setCity` che riceve il valore E' `CityContext.updateCity`, che scrive in
// localStorage E su profiles.current_city_override. Il nome storpiato veniva
// PERSISTITO, sul device e sul database.
//
// Il test guarda esattamente l'argomento passato a setCity: e' il valore che
// finirebbe salvato. Prima del fix e' rosso su ogni nome composto.
//
// Mock SOLO di infrastruttura (router, animazioni, context, campanella) —
// stesso harness di topBar_cityModal.test.js. handleSaveCity gira vero.

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
    };
});

vi.mock('@/components/NotificationBell', () => ({ default: () => null }));

const setCity = vi.fn();
vi.mock('@/context/CityContext', () => ({
    useCity: () => ({ city: null, setCity, isManual: false }),
}));

vi.mock('@/context/AuthContext', () => ({
    useAuth: () => ({ signOut: vi.fn() }),
}));

const NO_CITY_CONTEXT = {
    userId: 'u1',
    city: undefined,
    temperatureC: undefined,
    firstName: 'Ospite',
    isLoading: false,
    needsCityChoice: true,
};

vi.mock('@/hooks/useUserContext', () => ({
    useUserContext: () => NO_CITY_CONTEXT,
}));

const { createElement } = await import('react');
const TopBar = (await import('@/components/TopBar')).default;

/**
 * Monta la TopBar (il modal si apre da solo: needsCityChoice=true), scrive
 * `typed` nel campo di testo, conferma, e restituisce l'argomento con cui
 * setCity — cioe' CityContext.updateCity — e' stato chiamato.
 */
const saveCityAndReadPersistedValue = (typed) => {
    render(createElement(TopBar));
    const input = screen.getByPlaceholderText('Cerca una città...');
    fireEvent.change(input, { target: { value: typed } });
    fireEvent.click(screen.getByText('Conferma Posizione'));
    expect(setCity).toHaveBeenCalledTimes(1);
    return setCity.mock.calls[0][0];
};

beforeEach(() => {
    sessionStorage.clear();
    setCity.mockClear();
});

afterEach(() => {
    cleanup();
    sessionStorage.clear();
});

describe('Gate C1 — TopBar.handleSaveCity non riscrive il nome citta\'', () => {
    it('"Reggio Emilia" si salva "Reggio Emilia", non "Reggio emilia"', () => {
        expect(saveCityAndReadPersistedValue('Reggio Emilia')).toBe('Reggio Emilia');
    });

    it('"L\'Aquila" si salva "L\'Aquila", non "L\'aquila"', () => {
        expect(saveCityAndReadPersistedValue("L'Aquila")).toBe("L'Aquila");
    });

    it('"San Giovanni Rotondo" resta intero, non "San giovanni rotondo"', () => {
        expect(saveCityAndReadPersistedValue('San Giovanni Rotondo')).toBe('San Giovanni Rotondo');
    });

    it('"Forlì" conserva l\'accento', () => {
        expect(saveCityAndReadPersistedValue('Forlì')).toBe('Forlì');
    });

    it('"Sant\'Agata de\' Goti" resta intera', () => {
        expect(saveCityAndReadPersistedValue("Sant'Agata de' Goti")).toBe("Sant'Agata de' Goti");
    });

    it('anche quello che l\'utente scrive minuscolo si salva come l\'ha scritto', () => {
        // Nessuna "correzione" silenziosa: il dato non si tocca. Il match
        // case-insensitive vive nei lookup (CITY_COORDS, CITY_CONFIG, .ilike).
        expect(saveCityAndReadPersistedValue('roma')).toBe('roma');
    });

    it('gli spazi ai bordi si tolgono ancora (unica pulizia rimasta)', () => {
        expect(saveCityAndReadPersistedValue('  Reggio Emilia  ')).toBe('Reggio Emilia');
    });

    it('un campo vuoto non chiama setCity', () => {
        render(createElement(TopBar));
        const input = screen.getByPlaceholderText('Cerca una città...');
        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.click(screen.getByText('Conferma Posizione'));
        expect(setCity).not.toHaveBeenCalled();
    });
});
