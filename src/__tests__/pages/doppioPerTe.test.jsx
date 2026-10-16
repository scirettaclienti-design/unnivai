// DOPPIO-FIX — all'apertura della home Per Te genera UNA volta, anche a freddo (copia locale del DNA assente o indietro).
//
// Prima la chiave di 'home-experiences' conteneva totalInteractions, la fiducia del DNA e la dieta: cambiavano quando
// useAILearning leggeva il DNA dal server, e partiva una seconda generazione (docs/prove/2026-10-22-doppio-perte.md).
// Qui girano davvero DashboardUser, useAILearning e React Query (stesse opzioni di App.jsx); il motore e' una spia.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('framer-motion', async () => {
    const React = await import('react');
    const OMIT = new Set(['initial', 'animate', 'exit', 'variants', 'whileHover', 'whileTap', 'transition', 'layout']);
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
        useNavigate: () => () => {},
    };
});
vi.mock('@/components/TopBar', () => ({ default: () => null }));
vi.mock('@/components/BottomNavigation', () => ({ default: () => null }));
vi.mock('@/components/GpsActivationBanner', () => ({ default: () => null }));
vi.mock('@/components/TourCover', () => ({ default: () => null }));
vi.mock('@/lib/supabase', () => ({
    supabase: { auth: { getUser: async () => ({ data: { user: null } }) }, channel: () => ({}), removeChannel: () => {} },
}));
vi.mock('@/hooks/useUserContext', () => ({
    useUserContext: () => ({ firstName: 'Ivano', city: 'Catania', temperatureC: 22, weatherCondition: 'sunny', isLoading: false }),
}));

let utente = null;
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: utente }) }));

const getUserPreferences = vi.fn();
vi.mock('@/services/dataService', () => ({
    dataService: {
        getToursByCity: async () => [],
        getUserPreferences: (...a) => getUserPreferences(...a),
        upsertUserPreferences: vi.fn(),
    },
    createGuideRequest: vi.fn(),
}));
vi.mock('@/services/cityCenterService', () => ({
    resolveCityCenter: vi.fn().mockResolvedValue({ latitude: 37.5023, longitude: 15.0873 }),
    CityCenterUnresolvedError: class CityCenterUnresolvedError extends Error {},
}));
vi.mock('@/services/placesDiscoveryService', async () => {
    const actual = await vi.importActual('@/services/placesDiscoveryService');
    return {
        ...actual,
        placesDiscoveryService: { ...actual.placesDiscoveryService, discoverAllThemes: async () => ({ food: [], cultura: [], romance: [], nature: [] }) },
    };
});
const generateHomeTours = vi.fn();
vi.mock('@/services/aiRecommendationService', () => ({
    aiRecommendationService: { generateHomeTours: (...a) => generateHomeTours(...a) },
    buildInsiderPool: () => [],
}));

const { useAILearning } = await import('@/hooks/useAILearning');
const DashboardUser = (await import('@/pages/DashboardUser')).default;

const BRAIN = 'unnivai_ai_learning_brain_v2';
const SEME = 'unnivai_onboarding_seed_v1';
// Il DNA sul server dell'account: 2 interazioni e un seme (come l'account di prova della diagnosi).
const DNA_SERVER = { total_interactions: 2, preference_data: { 'cat:food': 2 }, interactions: [], onboarding_seed: ['food', 'natura'] };

const attesa = (ms) => new Promise(r => setTimeout(r, ms));
let letturaFinita = null;
const serverRisponde = (valore, ms = 60) => getUserPreferences.mockImplementation(async () => {
    await attesa(ms);
    letturaFinita = Date.now();
    if (valore instanceof Error) throw valore;
    return valore;
});

const apriHome = async () => {
    // le opzioni di App.jsx
    const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false } } });
    render(createElement(QueryClientProvider, { client }, createElement(DashboardUser)));
    await waitFor(() => expect(generateHomeTours).toHaveBeenCalled(), { timeout: 2000 });
    await attesa(400); // il tempo per una seconda generazione, se partisse
    return client;
};

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    letturaFinita = null;
    utente = { id: 'utente-prova' };
    generateHomeTours.mockImplementation(async () => { generateHomeTours.alle ??= []; generateHomeTours.alle.push(Date.now()); return { tours: [] }; });
    generateHomeTours.alle = [];
});
afterEach(() => { cleanup(); });

describe('DOPPIO-FIX — una generazione per apertura della home', () => {
    it('a freddo (nessuna copia locale del DNA): 1 generazione, dopo la lettura del DNA, col DNA del server', async () => {
        serverRisponde(DNA_SERVER);
        await apriHome();
        expect(generateHomeTours).toHaveBeenCalledTimes(1);
        expect(generateHomeTours.alle[0]).toBeGreaterThanOrEqual(letturaFinita);
        // il seme del server e' gia' dentro: la fiducia del DNA e' > 0 alla prima (e unica) esecuzione
        expect(generateHomeTours.mock.calls[0][0].opts.dnaWeights._share).toBeGreaterThan(0);
    });

    it('a caldo (copia locale gia\' allineata col server): 1 generazione', async () => {
        localStorage.setItem(BRAIN, JSON.stringify({ preferenceGraph: { 'cat:food': 2 }, interactions: [], totalInteractions: 2 }));
        localStorage.setItem(SEME, JSON.stringify(['food', 'natura']));
        serverRisponde(DNA_SERVER);
        await apriHome();
        expect(generateHomeTours).toHaveBeenCalledTimes(1);
    });

    it('la copia locale e\' indietro di qualche interazione: 1 generazione', async () => {
        localStorage.setItem(BRAIN, JSON.stringify({ preferenceGraph: {}, interactions: [], totalInteractions: 0 }));
        serverRisponde(DNA_SERVER);
        await apriHome();
        expect(generateHomeTours).toHaveBeenCalledTimes(1);
    });

    it('la lettura del DNA fallisce: Per Te parte lo stesso, 1 generazione (mai home vuota)', async () => {
        serverRisponde(new Error('rete giu\''));
        await apriHome();
        expect(generateHomeTours).toHaveBeenCalledTimes(1);
    });

    it('il server non ha una riga per l\'utente: 1 generazione', async () => {
        serverRisponde(null);
        await apriHome();
        expect(generateHomeTours).toHaveBeenCalledTimes(1);
    });

    it('ospite: 1 generazione, senza leggere il DNA dal server', async () => {
        utente = null;
        await apriHome();
        expect(generateHomeTours).toHaveBeenCalledTimes(1);
        expect(getUserPreferences).not.toHaveBeenCalled();
    });
});

describe('DOPPIO-FIX — dnaPronto in useAILearning', () => {
    it('utente: false finche\' il DNA del server non e\' letto, poi true', async () => {
        serverRisponde(DNA_SERVER);
        const { result } = renderHook(() => useAILearning());
        expect(result.current.dnaPronto).toBe(false);
        await waitFor(() => expect(result.current.dnaPronto).toBe(true));
        expect(result.current.totalInteractions).toBe(2);
    });

    it('utente con lettura fallita: diventa true lo stesso', async () => {
        serverRisponde(new Error('rete giu\''));
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.dnaPronto).toBe(true));
    });

    it('ospite: true subito', () => {
        utente = null;
        const { result } = renderHook(() => useAILearning());
        expect(result.current.dnaPronto).toBe(true);
    });
});
