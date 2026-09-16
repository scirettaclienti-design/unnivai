import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Gate SEME (L2) — un fallimento di salvataggio del seme deve essere VISIBILE.
//
// Questo file esiste per un difetto misurato, non per un'ipotesi. Prima di
// questo gate Onboarding.handleComplete faceva
//   supabase.from('profiles').upsert({ id, interests, onboarding_complete })
// su due colonne che non sono mai esistite. L'upsert falliva SEMPRE, l'errore
// finiva in un console.warn, e subito dopo il codice chiamava navigate() e
// scriveva localStorage['dvai_onboarding_done'] lo stesso: l'app si comportava
// esattamente come se avesse salvato. Il seme restava solo nel localStorage di
// quel device, che AuthContext cancella al logout.
//
// Le tre cose che questi test inchiodano, quando il salvataggio fallisce:
//   (a) NON si naviga al dashboard
//   (b) NON si scrive il flag "onboarding fatto" (ne' la cache del seme)
//   (c) l'errore e' RENDERIZZATO, non loggato — si interroga il DOM
//
// Mock SOLO di infrastruttura:
// - framer-motion passthrough (animazioni fuori scope, timing = flakiness)
// - react-router-dom: useNavigate stub, e' l'assert (a)
// - AuthContext: utente AUTENTICATO (a differenza di onboarding_seed.test.js,
//   che usa user=null per testare la derivazione del seme) — senza user.id il
//   path di salvataggio server non viene nemmeno imboccato
// - @/services/dataService: il punto di fallimento pilotato
// - @/lib/supabase: il layer SOTTO dataService. Mockato anche lui di proposito,
//   cosi' questo test e' rosso in modo SIGNIFICATIVO anche contro la versione
//   pre-gate del file (che chiamava supabase.from('profiles') direttamente):
//   fallisce sul comportamento sbagliato, non per un modulo mancante.
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

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));
vi.mock('@/context/AuthContext', () => ({
    useAuth: () => ({ user: { id: '11111111-2222-3333-4444-555555555555' } }),
}));

const upsertOnboardingSeedMock = vi.fn();
vi.mock('@/services/dataService', () => ({
    dataService: { upsertOnboardingSeed: (...a) => upsertOnboardingSeedMock(...a) },
}));

// Layer sotto: usato SOLO dalla versione pre-gate del file. Con il gate
// applicato Onboarding non importa piu' supabase e questo mock resta inerte.
const supabaseUpsertMock = vi.fn();
vi.mock('@/lib/supabase', () => ({
    supabase: { from: () => ({ upsert: (...a) => supabaseUpsertMock(...a) }) },
}));

import Onboarding from '../../pages/Onboarding';

const SEED_KEY = 'unnivai_onboarding_seed_v1';
const DONE_KEY = 'dvai_onboarding_done';
const DB_ERROR = "column user_preferences.onboarding_seed does not exist";

const clickByText = (text) => fireEvent.click(screen.getByText(text).closest('button'));
const gotoInterests = () => clickByText('Iniziamo!');
const gotoReady = () => clickByText('Continua');
const finish = () => clickByText('Entra in DoveVAI');

// welcome → scegli "Storia e arte" → pronto → conferma
const runWizardToEnd = () => {
    gotoInterests();
    clickByText('Storia e arte');
    gotoReady();
    finish();
};

beforeEach(() => {
    localStorage.clear();
    navigateMock.mockReset();
    upsertOnboardingSeedMock.mockReset();
    supabaseUpsertMock.mockReset();
    // Il layer sotto fallisce come falliva davvero in produzione (PGRST204 su
    // colonna inesistente): rende rosso anche il codice pre-gate.
    supabaseUpsertMock.mockRejectedValue(new Error(DB_ERROR));
});

describe('Gate SEME (L2) — salvataggio fallito: si blocca e si vede', () => {
    it('fallimento su "Entra in DoveVAI": niente navigate, niente flag, errore a schermo', async () => {
        upsertOnboardingSeedMock.mockResolvedValue({ success: false, error: DB_ERROR });

        render(createElement(Onboarding));
        runWizardToEnd();

        // (c) l'errore e' RENDERIZZATO — si interroga il DOM, non una spia
        const alert = await screen.findByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(screen.getByText('Non siamo riusciti a salvare le tue scelte.')).toBeInTheDocument();
        // il messaggio tecnico vero, non un testo generico inventato
        expect(screen.getByText(DB_ERROR)).toBeInTheDocument();
        // esiste una via d'uscita: il pulsante Riprova
        expect(screen.getByText('Riprova')).toBeInTheDocument();

        // (a) NON si naviga
        expect(navigateMock).not.toHaveBeenCalled();
        // (b) NON si dichiara fatto cio' che non e' stato fatto
        expect(localStorage.getItem(DONE_KEY)).toBeNull();
        // e nemmeno la cache del seme: sarebbe la stessa bugia, un livello sotto
        expect(localStorage.getItem(SEED_KEY)).toBeNull();
    });

    it('il seme arriva al server nella forma giusta (["cultura","arte"])', async () => {
        upsertOnboardingSeedMock.mockResolvedValue({ success: false, error: DB_ERROR });

        render(createElement(Onboarding));
        runWizardToEnd();
        await screen.findByRole('alert');

        expect(upsertOnboardingSeedMock).toHaveBeenCalledTimes(1);
        const [userId, seed] = upsertOnboardingSeedMock.mock.calls[0];
        expect(userId).toBe('11111111-2222-3333-4444-555555555555');
        expect([...seed].sort()).toEqual(['arte', 'cultura']);
    });

    it('"Riprova" ritenta e, se il server risponde, sblocca il flusso', async () => {
        upsertOnboardingSeedMock.mockResolvedValue({ success: false, error: DB_ERROR });

        render(createElement(Onboarding));
        runWizardToEnd();
        await screen.findByRole('alert');

        upsertOnboardingSeedMock.mockResolvedValue({ success: true });
        clickByText('Riprova');

        await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard-user', { replace: true }));
        expect(localStorage.getItem(DONE_KEY)).toBe('1');
        expect(JSON.parse(localStorage.getItem(SEED_KEY)).sort()).toEqual(['arte', 'cultura']);
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('anche "Salta per ora" passa dal server: se fallisce, blocca allo stesso modo', async () => {
        upsertOnboardingSeedMock.mockResolvedValue({ success: false, error: DB_ERROR });

        render(createElement(Onboarding));
        clickByText('Salta per ora');

        await screen.findByRole('alert');
        // uno skip esplicito e' un dato dell'utente: [] deve arrivare al server
        expect(upsertOnboardingSeedMock).toHaveBeenCalledWith(
            '11111111-2222-3333-4444-555555555555', [],
        );
        expect(navigateMock).not.toHaveBeenCalled();
        expect(localStorage.getItem(DONE_KEY)).toBeNull();
        expect(localStorage.getItem(SEED_KEY)).toBeNull();
    });

    it('"Riprova" dopo uno skip fallito ritenta lo SKIP ([]), non gli interessi', async () => {
        upsertOnboardingSeedMock.mockResolvedValue({ success: false, error: DB_ERROR });

        render(createElement(Onboarding));
        gotoInterests();
        clickByText('Storia e arte');   // interessi selezionati ma NON confermati
        clickByText('Salta per ora');
        await screen.findByRole('alert');

        upsertOnboardingSeedMock.mockResolvedValue({ success: true });
        clickByText('Riprova');

        await waitFor(() => expect(navigateMock).toHaveBeenCalled());
        expect(upsertOnboardingSeedMock).toHaveBeenLastCalledWith(
            '11111111-2222-3333-4444-555555555555', [],
        );
        expect(localStorage.getItem(SEED_KEY)).toBe('[]');
    });

    it('successo al primo colpo: salva, marca e naviga (nessun errore a schermo)', async () => {
        upsertOnboardingSeedMock.mockResolvedValue({ success: true });

        render(createElement(Onboarding));
        runWizardToEnd();

        await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard-user', { replace: true }));
        expect(localStorage.getItem(DONE_KEY)).toBe('1');
        expect(JSON.parse(localStorage.getItem(SEED_KEY)).sort()).toEqual(['arte', 'cultura']);
        expect(screen.queryByRole('alert')).toBeNull();
    });
});
