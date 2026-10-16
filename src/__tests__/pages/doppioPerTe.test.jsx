// DOPPIO-FIX — all'apertura della home Per Te genera UNA volta, anche a freddo (copia locale del DNA assente o indietro).
//
// Prima la chiave di 'home-experiences' conteneva totalInteractions, la fiducia del DNA e la dieta: cambiavano quando
// useAILearning leggeva il DNA dal server, e partiva una seconda generazione (docs/prove/2026-10-22-doppio-perte.md).
// Qui girano davvero DashboardUser, useAILearning e React Query (stesse opzioni di App.jsx); il motore e' una spia.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, renderHook, waitFor, cleanup, screen } from '@testing-library/react';
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

const { useAILearning, DNA_ATTESA_MAX_MS } = await import('@/hooks/useAILearning');
const { giornoEFasciaPerTe } = await import('@/lib/perTeSalvato');
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

// le opzioni di App.jsx
const nuovoClient = () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false } } });
const monta = (client) => render(createElement(QueryClientProvider, { client }, createElement(DashboardUser)));
const apriHome = async (client = nuovoClient(), attese = 1, timeout = 2000) => {
    monta(client);
    await waitFor(() => expect(generateHomeTours.mock.calls.length).toBeGreaterThanOrEqual(attese), { timeout });
    await attesa(400); // il tempo per una seconda generazione, se partisse
    return client;
};
// Rientro (stesso client: la pagina non si e' ricaricata) o ricarica (client nuovo, stesso localStorage): nessuna attesa di generazione.
const rientra = async (client) => { monta(client); await attesa(700); };
const VUOTO = 'Qui intorno non trovo ancora luoghi verificati da proporti.';

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    letturaFinita = null;
    utente = { id: 'utente-prova' };
    generateHomeTours.mockImplementation(async () => { generateHomeTours.alle ??= []; generateHomeTours.alle.push(Date.now()); return { tours: [] }; });
    generateHomeTours.alle = [];
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
const allOra = (iso) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)); };

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

describe('DOPPIO-FIX-2 — rientro, ricarica, fascia, DNA muto', () => {
    it('rientro in home dopo 3 minuti, stessa fascia: 0 generazioni in piu\', Per Te gia\' a schermo', async () => {
        allOra('2026-10-15T12:05:00+02:00');
        serverRisponde(DNA_SERVER);
        const client = await apriHome();
        cleanup();
        vi.setSystemTime(new Date('2026-10-15T12:08:00+02:00'));
        await rientra(client);
        expect(generateHomeTours).toHaveBeenCalledTimes(1);
        expect(screen.getByText(VUOTO)).toBeTruthy();
    });

    it('ricarica della pagina, stessa fascia: 0 generazioni in piu\' (l\'ultimo Per Te salvato sul telefono)', async () => {
        allOra('2026-10-15T12:05:00+02:00');
        serverRisponde(DNA_SERVER);
        await apriHome();
        cleanup();
        vi.setSystemTime(new Date('2026-10-15T12:20:00+02:00'));
        await rientra(nuovoClient());
        expect(generateHomeTours).toHaveBeenCalledTimes(1);
        expect(getUserPreferences).toHaveBeenCalledTimes(2); // il DNA si rilegge, Per Te no
        expect(screen.getByText(VUOTO)).toBeTruthy();
    });

    it('cambio di fascia 17:59 → 18:01: 1 generazione nuova (il giro della sera)', async () => {
        allOra('2026-10-15T17:59:00+02:00');
        serverRisponde(DNA_SERVER);
        const client = await apriHome();
        expect(generateHomeTours).toHaveBeenCalledTimes(1);
        cleanup();
        vi.setSystemTime(new Date('2026-10-15T18:01:00+02:00'));
        await apriHome(client, 2);
        expect(generateHomeTours).toHaveBeenCalledTimes(2);
    });

    it('DNA che non risponde: Per Te parte dopo 4 s con quello che c\'e\', 1 generazione', async () => {
        getUserPreferences.mockImplementation(() => new Promise(() => {}));
        const t0 = Date.now();
        await apriHome(nuovoClient(), 1, 6000);
        expect(generateHomeTours).toHaveBeenCalledTimes(1);
        expect(generateHomeTours.alle[0] - t0).toBeGreaterThanOrEqual(DNA_ATTESA_MAX_MS);
    }, 10000);

    it('tre fasce (DOPPIO-FIX-3): mattina fino alle 14:30, pomeriggio fino alle 18:00, sera fino alle 05:00, ora di Roma', () => {
        const f = (iso) => giornoEFasciaPerTe(new Date(iso));
        expect(f('2026-10-15T05:00:00+02:00')).toEqual({ giorno: '2026-10-15', fascia: 'mattina' });
        expect(f('2026-10-15T12:31:00+02:00')).toEqual({ giorno: '2026-10-15', fascia: 'mattina' });
        expect(f('2026-10-15T14:29:00+02:00')).toEqual({ giorno: '2026-10-15', fascia: 'mattina' });
        expect(f('2026-10-15T14:31:00+02:00')).toEqual({ giorno: '2026-10-15', fascia: 'pomeriggio' });
        expect(f('2026-10-15T17:59:00+02:00')).toEqual({ giorno: '2026-10-15', fascia: 'pomeriggio' });
        expect(f('2026-10-15T18:01:00+02:00')).toEqual({ giorno: '2026-10-15', fascia: 'sera' });
        // la sera dopo mezzanotte resta la sera del giorno prima
        expect(f('2026-10-15T23:50:00+02:00')).toEqual({ giorno: '2026-10-15', fascia: 'sera' });
        expect(f('2026-10-16T00:10:00+02:00')).toEqual({ giorno: '2026-10-15', fascia: 'sera' });
        expect(f('2026-10-16T04:59:00+02:00')).toEqual({ giorno: '2026-10-15', fascia: 'sera' });
    });
});

describe('DOPPIO-FIX-3 — al massimo tre Per Te al giorno: i passaggi di fascia', () => {
    // apre la home a `da`, esce, rientra a `a` (stesso telefono, la pagina non si ricarica): quante generazioni in piu'
    const passaggio = async (da, a, rigenera) => {
        allOra(da);
        serverRisponde(DNA_SERVER);
        const client = await apriHome();
        expect(generateHomeTours).toHaveBeenCalledTimes(1);
        cleanup();
        vi.setSystemTime(new Date(a));
        if (rigenera) await apriHome(client, 2);
        else await rientra(client);
        return generateHomeTours.mock.calls.length - 1;
    };

    it('14:29 → 14:31 (mattina → pomeriggio): rigenera', async () => {
        expect(await passaggio('2026-10-15T14:29:00+02:00', '2026-10-15T14:31:00+02:00', true)).toBe(1);
    });
    it('15:00 → 17:00 (pomeriggio): non rigenera', async () => {
        expect(await passaggio('2026-10-15T15:00:00+02:00', '2026-10-15T17:00:00+02:00', false)).toBe(0);
        expect(screen.getByText(VUOTO)).toBeTruthy();
    });
    it('17:59 → 18:01 (pomeriggio → sera): rigenera', async () => {
        expect(await passaggio('2026-10-15T17:59:00+02:00', '2026-10-15T18:01:00+02:00', true)).toBe(1);
    });
    it('23:50 → 00:10 (sera, dopo mezzanotte vale la sera del giorno prima): non rigenera', async () => {
        expect(await passaggio('2026-10-15T23:50:00+02:00', '2026-10-16T00:10:00+02:00', false)).toBe(0);
        expect(screen.getByText(VUOTO)).toBeTruthy();
    });
    // con le sette fasce di DOPPIO-FIX-2 (i momenti) questi due rigeneravano
    it('12:00 → 13:00 (mattina, prima: mattina → pranzo): non rigenera', async () => {
        expect(await passaggio('2026-10-15T12:00:00+02:00', '2026-10-15T13:00:00+02:00', false)).toBe(0);
    });
    it('18:30 → 22:45 (sera, prima: aperitivo → dopocena): non rigenera', async () => {
        expect(await passaggio('2026-10-15T18:30:00+02:00', '2026-10-15T22:45:00+02:00', false)).toBe(0);
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
