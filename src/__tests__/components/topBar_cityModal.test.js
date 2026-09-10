import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Gate AA.2 (regressione) — il CityModal di onboarding deve comparire UNA
// SOLA VOLTA per sessione, non a ogni cambio di route.
//
// Il commento in TopBar.jsx dichiara l'intento: "Trigger UNA SOLA VOLTA per
// sessione: se l'utente chiude senza scegliere (X in alto a destra), non lo
// perseguitiamo". Il codice pero' teneva il flag `onboardingPrompted` in
// useState locale di TopBar — e TopBar NON vive in un layout persistente:
// 13 pagine + ComingSoonOverlay lo montano ognuna per conto proprio. Ogni
// cambio di route smonta il TopBar della pagina precedente e ne monta uno
// nuovo, il flag torna false, l'effect rivaluta e il modal si riapre.
//
// Il test simula esattamente questo: render -> unmount -> render con lo
// STESSO needsCityChoice: true, che e' ciò che React Router fa scambiando
// pagina. Prima del fix il modal ricompare al secondo mount (rosso); dopo,
// il flag vive in sessionStorage e sopravvive al remount (verde).
//
// Mock SOLO di infrastruttura (router, animazioni, context, campanella).
// La logica di apertura del modal in TopBar gira vera.

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

// Stato "utente senza citta', boot GPS finito": needsCityChoice resta true
// per tutta la sessione finche' l'utente non sceglie. E' lo scenario in cui
// il modal si riapriva a ogni route change.
const NO_CITY_CONTEXT = {
    userId: 'u1',
    city: undefined,
    temperatureC: undefined,
    firstName: 'Ospite',
    isLoading: false,
    needsCityChoice: true,
};

let userContextValue = NO_CITY_CONTEXT;
vi.mock('@/hooks/useUserContext', () => ({
    useUserContext: () => userContextValue,
}));

const { createElement } = await import('react');
const TopBar = (await import('@/components/TopBar')).default;

const ONBOARDING_TITLE = 'Da dove cominciamo?';

const renderTopBar = () => render(createElement(TopBar));

beforeEach(() => {
    userContextValue = NO_CITY_CONTEXT;
    sessionStorage.clear();
    setCity.mockClear();
});

afterEach(() => {
    cleanup();
    sessionStorage.clear();
});

describe('Gate AA.2 — CityModal onboarding: una sola volta per sessione', () => {
    it('al primo mount, con needsCityChoice=true, il modal di onboarding compare', () => {
        renderTopBar();
        expect(screen.getByText(ONBOARDING_TITLE)).toBeInTheDocument();
    });

    it('al remount (cambio di route) con lo stesso needsCityChoice=true NON ricompare', () => {
        const first = renderTopBar();
        expect(screen.getByText(ONBOARDING_TITLE)).toBeInTheDocument();

        // Cambio di route: React Router smonta il TopBar della pagina
        // precedente e monta quello della pagina nuova.
        first.unmount();
        renderTopBar();

        expect(screen.queryByText(ONBOARDING_TITLE)).not.toBeInTheDocument();
    });

    it('resta chiuso anche dopo piu\' cambi di route consecutivi', () => {
        let view = renderTopBar();
        expect(screen.getByText(ONBOARDING_TITLE)).toBeInTheDocument();
        view.unmount();

        // Home -> Esplora -> Profilo -> dettaglio tour
        for (let i = 0; i < 3; i++) {
            view = renderTopBar();
            expect(screen.queryByText(ONBOARDING_TITLE)).not.toBeInTheDocument();
            view.unmount();
        }
    });

    it('se l\'utente chiude con la X senza scegliere una citta\', al remount non si ripresenta', () => {
        const first = renderTopBar();
        expect(screen.getByText(ONBOARDING_TITLE)).toBeInTheDocument();

        // La X e' l'unico bottone dentro il modal oltre a quelli del contenuto:
        // la prendo dal blocco header del modal (fratello del titolo).
        const heading = screen.getByText(ONBOARDING_TITLE);
        const closeBtn = heading.closest('div').parentElement.querySelector('button');
        fireEvent.click(closeBtn);
        expect(screen.queryByText(ONBOARDING_TITLE)).not.toBeInTheDocument();
        expect(setCity).not.toHaveBeenCalled();

        first.unmount();
        renderTopBar();

        expect(screen.queryByText(ONBOARDING_TITLE)).not.toBeInTheDocument();
    });

    it('se l\'utente chiude cliccando il backdrop, al remount non si ripresenta', () => {
        const first = renderTopBar();
        const backdrop = document.querySelector('.backdrop-blur-md');
        expect(backdrop).toBeTruthy();
        fireEvent.click(backdrop);
        expect(screen.queryByText(ONBOARDING_TITLE)).not.toBeInTheDocument();

        first.unmount();
        renderTopBar();

        expect(screen.queryByText(ONBOARDING_TITLE)).not.toBeInTheDocument();
    });

    it('l\'apertura manuale (matita accanto a "Scegli citta\'") resta sempre disponibile', () => {
        const first = renderTopBar();
        first.unmount();

        // Route successiva: l'auto-trigger e' spento, ma la matita deve
        // continuare ad aprire il modal (in modalita' onboarding, perche'
        // la citta' manca ancora).
        const { container } = renderTopBar();
        expect(screen.queryByText(ONBOARDING_TITLE)).not.toBeInTheDocument();

        const pencil = container.querySelector('header button');
        fireEvent.click(pencil);

        expect(screen.getByText(ONBOARDING_TITLE)).toBeInTheDocument();
    });

    it('se la citta\' e\' gia\' nota (needsCityChoice=false) il modal non compare mai', () => {
        userContextValue = {
            ...NO_CITY_CONTEXT,
            city: 'Roma',
            needsCityChoice: false,
        };
        renderTopBar();
        expect(screen.queryByText(ONBOARDING_TITLE)).not.toBeInTheDocument();
        expect(screen.queryByText('Dove ti trovi?')).not.toBeInTheDocument();
    });
});
