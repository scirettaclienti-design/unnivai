// DNA-4 — Per Te cambia quando il DNA cambia davvero (fascia di DNA nella chiave), non a ogni gesto.
//
// Qui girano davvero DashboardUser, useAILearning (che legge il registro a ogni apertura della home), la fascia di DNA e
// React Query (stesse opzioni di App.jsx); il motore e' una spia che conta le generazioni. Stessa struttura di doppioPerTe.test.jsx.

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
// Il registro degli eventi (dna_events) lo decide il test: `righeRegistro`.
let righeRegistro = [];
vi.mock('@/lib/supabase', () => {
    const catena = () => {
        const c = { select: () => c, order: () => c, limit: async () => ({ data: righeRegistro, error: null }) };
        return c;
    };
    return {
        supabase: { from: () => catena(), auth: { getUser: async () => ({ data: { user: null } }) }, channel: () => ({}), removeChannel: () => {} },
    };
});
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



const { pesiDaEventi } = await import('@/services/preferenceEngine');
const { fasciaDna } = await import('@/lib/fasciaDna');

const SEME = ['food', 'natura'];
const DNA_SERVER = { total_interactions: 0, preference_data: {}, interactions: [], onboarding_seed: SEME };
const OGGI = '2026-10-22T12:05:00+02:00';

const attesa = (ms) => new Promise(r => setTimeout(r, ms));
const nuovoClient = () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false } } });
const monta = (client) => render(createElement(QueryClientProvider, { client }, createElement(DashboardUser)));
const allOra = (iso) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)); };

// un giro food completato = una tappa raggiunta + il giro completato (una riga ciascuno)
const riga = (id, kind, category, tour = null) => ({ id, kind, category, value: null, tour_id: tour, created_at: new Date(Date.now() - 1000).toISOString() });
const giriDi = (cat, n) => Array.from({ length: n }, (_, i) => [riga(`r${cat}${i}`, 'stop_reached', cat, `g${cat}${i}`), riga(`c${cat}${i}`, 'tour_completed', cat, `g${cat}${i}`)]).flat();
const giriFood = (n) => giriDi('food', n);
const fasciaDi = (righe) => { const d = pesiDaEventi(righe, SEME, new Date()); return fasciaDna({ ...d.pesi, _share: d.share }); };

// Apre la home (o rientra): `attese` = quante generazioni in tutto ci si aspetta dopo questa apertura.
const apri = async (client, attese) => {
    monta(client);
    if (generateHomeTours.mock.calls.length < attese) await waitFor(() => expect(generateHomeTours.mock.calls.length).toBeGreaterThanOrEqual(attese), { timeout: 3000 });
    await attesa(400); // il tempo per una generazione in piu', se partisse
    cleanup();
};

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    righeRegistro = [];
    utente = { id: 'utente-prova' };
    getUserPreferences.mockImplementation(async () => DNA_SERVER);
    generateHomeTours.mockImplementation(async () => ({ tours: [] }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('DNA-4 — Per Te cambia quando il DNA cambia davvero', () => {
    it('utente nuovo (seme) → 1 generazione; con 5 giri food al rientro la fascia e\' diversa → 1 rigenerazione sola; rientri successivi: 0', async () => {
        allOra(OGGI);
        const client = nuovoClient();
        expect(fasciaDi([])).not.toBe(fasciaDi(giriFood(5)));
        await apri(client, 1);
        expect(generateHomeTours).toHaveBeenCalledTimes(1);
        const dnaNuovo = generateHomeTours.mock.calls[0][0].opts.dnaWeights;
        expect(fasciaDna(dnaNuovo)).toBe(fasciaDi([]));

        righeRegistro = giriFood(5); // l'utente ha fatto 5 giri food
        await apri(client, 2);
        expect(generateHomeTours).toHaveBeenCalledTimes(2);
        expect(fasciaDna(generateHomeTours.mock.calls[1][0].opts.dnaWeights)).toBe(fasciaDi(giriFood(5)));
        expect(generateHomeTours.mock.calls[1][0].opts.dnaWeights.food).toBeGreaterThan(dnaNuovo.food);

        await apri(client, 2); // rientro, stesso DNA
        await apri(client, 2);
        expect(generateHomeTours).toHaveBeenCalledTimes(2);
    });

    it('ricarica della pagina (client nuovo) con lo stesso DNA: 0 generazioni in piu\' (l\'ultimo Per Te salvato)', async () => {
        allOra(OGGI);
        righeRegistro = giriFood(5);
        await apri(nuovoClient(), 1);
        await apri(nuovoClient(), 1);
        expect(generateHomeTours).toHaveBeenCalledTimes(1);
    });

    it('un gesto in piu\' senza cambio di fascia (6° giro food dopo 5): nessuna rigenerazione', async () => {
        allOra(OGGI);
        const client = nuovoClient();
        righeRegistro = giriFood(5);
        await apri(client, 1);
        expect(fasciaDi(giriFood(6))).toBe(fasciaDi(giriFood(5)));
        righeRegistro = giriFood(6);
        await apri(client, 1);
        expect(generateHomeTours).toHaveBeenCalledTimes(1);
    });

    it('senza seme, 5 giri food non cambiano niente (il motore non legge il DNA sotto i 6 eventi): nessuna rigenerazione', async () => {
        allOra(OGGI);
        getUserPreferences.mockImplementation(async () => ({ ...DNA_SERVER, onboarding_seed: [] }));
        const client = nuovoClient();
        await apri(client, 1);
        righeRegistro = giriFood(5);
        await apri(client, 1);
        expect(generateHomeTours).toHaveBeenCalledTimes(1);
    });

    it('il cambio di fascia oraria e la fascia di DNA si sommano senza doppioni: 14:29 → 14:31 con DNA cambiato = 1 sola generazione in piu\'', async () => {
        allOra('2026-10-22T14:29:00+02:00');
        const client = nuovoClient();
        await apri(client, 1);
        righeRegistro = giriFood(5);
        vi.setSystemTime(new Date('2026-10-22T14:31:00+02:00'));
        await apri(client, 2);
        expect(generateHomeTours).toHaveBeenCalledTimes(2);
    });

    it('tetto: in un giorno il DNA aggiunge al massimo 2 generazioni (3 in tutto, lontano dai 10 al giorno), anche se il DNA cambia a ogni apertura', async () => {
        allOra(OGGI);
        const client = nuovoClient();
        // 5 aperture, ognuna con una fascia di DNA diversa: seme → 5 food → +6 natura → +12 natura (fiducia piu' alta) → cultura al posto di natura
        const passi = [[], giriFood(5), [...giriFood(5), ...giriDi('natura', 6)], [...giriFood(5), ...giriDi('natura', 12)], [...giriFood(5), ...giriDi('cultura', 12)]];
        const fasce = passi.map(fasciaDi);
        expect(new Set(fasce).size).toBe(fasce.length); // ogni passo e' davvero una fascia nuova
        const conteggi = [];
        for (const righe of passi) {
            righeRegistro = righe;
            await apri(client, Math.min(conteggi.length + 1, 3));
            conteggi.push(generateHomeTours.mock.calls.length);
        }
        expect(conteggi).toEqual([1, 2, 3, 3, 3]);
        expect(conteggi[conteggi.length - 1]).toBeLessThanOrEqual(10);
        // anche rientrando ancora, con un DNA ancora diverso, resta tutto fermo
        righeRegistro = [...giriFood(5), ...giriDi('natura', 30)];
        await apri(client, 3);
        expect(generateHomeTours).toHaveBeenCalledTimes(3);
    });

    it('il giorno dopo il conto riparte: la prima apertura genera col DNA di allora, e un DNA cambiato rigenera ancora', async () => {
        allOra(OGGI);
        const client = nuovoClient();
        const passi = [[], giriFood(5), [...giriFood(5), ...giriDi('natura', 6)], [...giriFood(5), ...giriDi('natura', 12)]];
        const conteggi = [];
        for (const righe of passi) { righeRegistro = righe; await apri(client, Math.min(conteggi.length + 1, 3)); conteggi.push(generateHomeTours.mock.calls.length); }
        expect(conteggi).toEqual([1, 2, 3, 3]); // il quarto cambio e' oltre il tetto
        vi.setSystemTime(new Date('2026-10-23T12:05:00+02:00')); // giorno nuovo
        await apri(client, 4);
        expect(generateHomeTours).toHaveBeenCalledTimes(4);
        // e il DNA di allora e' il vero (non quello congelato del giorno prima)
        expect(fasciaDna(generateHomeTours.mock.calls[3][0].opts.dnaWeights)).toBe(fasciaDi(passi[3]));
        righeRegistro = [...giriFood(5), ...giriDi('cultura', 12)];
        await apri(client, 5);
        expect(generateHomeTours).toHaveBeenCalledTimes(5);
    });
});
