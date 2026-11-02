// ACCOUNT-PRIVACY — le schermate: Elimina account (conferma, chiamata, esiti onesti), consenso AI, pagine /privacy e /termini.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

const auth = { user: { id: 'u1', email: 'anna@example.com', is_anonymous: false, user_metadata: {} }, loading: false };
const signOut = vi.fn();
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, loading: auth.loading, signOut: (...a) => signOut(...a) }) }));
const toast = vi.fn();
vi.mock('../../hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
const getSession = vi.fn();
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: (...a) => getSession(...a), updateUser: vi.fn().mockResolvedValue({ error: null }) } } }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: (...a) => getSession(...a), updateUser: vi.fn().mockResolvedValue({ error: null }) } } }));

const EliminaAccount = (await import('../../components/EliminaAccount')).default;
const ConsensoAi = (await import('../../components/ConsensoAi')).default;
const Privacy = (await import('../../pages/Privacy')).default;
const Termini = (await import('../../pages/Termini')).default;
const LinkLegali = (await import('../../components/LinkLegali')).default;
const reale = await vi.importActual('../../lib/consensoAi.js');
const { ELIMINA, BOZZA, PRIVACY, TERMINI, SEGNAPOSTO } = await import('../../lib/testiAccount');

const Dove = () => { const l = useLocation(); return <div data-testid="dove">{l.pathname}</div>; };

beforeEach(() => {
    localStorage.clear();
    auth.user = { id: 'u1', email: 'anna@example.com', is_anonymous: false, user_metadata: {} };
    auth.loading = false;
    signOut.mockReset().mockResolvedValue(undefined);
    toast.mockReset();
    getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'tok', user: auth.user } } });
    vi.stubEnv('VITE_SUPABASE_URL', 'http://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const monta = (ui, path = '/profile') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={<>{ui}<Dove /></>} /></Routes></MemoryRouter>);
const apriDialogo = () => fireEvent.click(screen.getByTestId('elimina-account-apri'));
const scrivi = (v) => fireEvent.change(screen.getByTestId('elimina-account-parola'), { target: { value: v } });

describe('Elimina account', () => {
    it('dice cosa si cancella e che non si torna indietro; il tasto resta spento finché non scrivi «elimina»', () => {
        monta(<EliminaAccount />);
        apriDialogo();
        for (const riga of ELIMINA.COSA_SI_CANCELLA) expect(screen.getByText(riga)).toBeInTheDocument();
        expect(screen.getByText(ELIMINA.NON_SI_TORNA)).toBeInTheDocument();
        const conferma = screen.getByTestId('elimina-account-conferma');
        expect(conferma).toBeDisabled();
        scrivi('elim');
        expect(conferma).toBeDisabled();
        scrivi('  ELIMINA ');
        expect(conferma).not.toBeDisabled();
    });

    it('conferma → chiama la funzione col token → esce, pulisce il telefono, torna alla home col messaggio', async () => {
        localStorage.setItem('dvai_ospite_giro_v1', '{}');
        localStorage.setItem('altro', 'resta');
        const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ esito: 'eliminato' }) }));
        vi.stubGlobal('fetch', fetchMock);
        monta(<EliminaAccount />);
        apriDialogo(); scrivi('elimina');
        fireEvent.click(screen.getByTestId('elimina-account-conferma'));
        await waitFor(() => expect(screen.getByTestId('dove')).toHaveTextContent(/^\/$/));
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('http://supabase.test/functions/v1/elimina-account');
        expect(init.headers.Authorization).toBe('Bearer tok');
        expect(JSON.parse(init.body)).toEqual({ conferma: 'elimina' });
        expect(signOut).toHaveBeenCalled();
        expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: ELIMINA.FATTO }));
        expect(localStorage.getItem('dvai_ospite_giro_v1')).toBeNull();
        expect(localStorage.getItem('altro')).toBe('resta');
    });

    it('la funzione non è ancora pubblicata (404): messaggio onesto, l\'account resta, mai «fatto»', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ code: 'NOT_FOUND' }) })));
        monta(<EliminaAccount />);
        apriDialogo(); scrivi('elimina');
        fireEvent.click(screen.getByTestId('elimina-account-conferma'));
        expect(await screen.findByTestId('elimina-account-errore')).toHaveTextContent(ELIMINA.NON_ATTIVA);
        expect(signOut).not.toHaveBeenCalled();
        expect(toast).not.toHaveBeenCalled();
        expect(screen.getByTestId('dove')).toHaveTextContent('/profile');
    });

    it('migrazione mancante (503): lo stesso messaggio onesto', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ code: 'MIGRAZIONE_MANCANTE' }) })));
        monta(<EliminaAccount />);
        apriDialogo(); scrivi('elimina');
        fireEvent.click(screen.getByTestId('elimina-account-conferma'));
        expect(await screen.findByTestId('elimina-account-errore')).toHaveTextContent(ELIMINA.NON_ATTIVA);
        expect(signOut).not.toHaveBeenCalled();
    });

    it('errore del server (500) e rete assente hanno ciascuno il suo testo, e non si esce', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ code: 'DATI' }) })));
        const v = monta(<EliminaAccount />);
        apriDialogo(); scrivi('elimina');
        fireEvent.click(screen.getByTestId('elimina-account-conferma'));
        expect(await screen.findByTestId('elimina-account-errore')).toHaveTextContent(ELIMINA.NON_RIUSCITA);
        v.unmount();
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
        monta(<EliminaAccount />);
        apriDialogo(); scrivi('elimina');
        fireEvent.click(screen.getByTestId('elimina-account-conferma'));
        expect(await screen.findByTestId('elimina-account-errore')).toHaveTextContent(ELIMINA.SENZA_RETE);
        expect(signOut).not.toHaveBeenCalled();
    });

    it('scaduto il tempo: non dice «non ho cancellato niente» (potrebbe essere andata), e non esce', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { const e = new Error('abort'); e.name = 'AbortError'; throw e; }));
        monta(<EliminaAccount />);
        apriDialogo(); scrivi('elimina');
        fireEvent.click(screen.getByTestId('elimina-account-conferma'));
        expect(await screen.findByTestId('elimina-account-errore')).toHaveTextContent(ELIMINA.SENZA_RISPOSTA);
        expect(signOut).not.toHaveBeenCalled();
    });

    it('«Non adesso» chiude senza chiamare niente', () => {
        const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
        monta(<EliminaAccount />);
        apriDialogo();
        fireEvent.click(screen.getByTestId('elimina-account-annulla'));
        expect(screen.queryByTestId('elimina-account-dialogo')).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('un ospite (account anonimo) lo vede e la conferma lo dice', () => {
        auth.user = { id: 'g1', is_anonymous: true, user_metadata: {} };
        monta(<EliminaAccount />);
        apriDialogo();
        expect(screen.getByText(ELIMINA.OSPITE_NOTA)).toBeInTheDocument();
    });

    it('senza utente non si vede', () => {
        auth.user = null;
        monta(<EliminaAccount />);
        expect(screen.queryByTestId('elimina-account')).toBeNull();
    });
});

describe('Schermata del consenso AI', () => {
    it('alla prima apertura di chi è dentro: nomina Anthropic e OpenAI, ha il link alla privacy; «Va bene» la chiude e la ricorda', async () => {
        monta(<ConsensoAi />, '/dashboard-user');
        const finestra = screen.getByTestId('consenso-ai');
        expect(finestra).toHaveTextContent('Anthropic');
        expect(finestra).toHaveTextContent('OpenAI');
        expect(screen.getByTestId('consenso-ai-privacy')).toHaveAttribute('href', '/privacy');
        await act(async () => { fireEvent.click(screen.getByTestId('consenso-ai-ok')); });
        await waitFor(() => expect(screen.queryByTestId('consenso-ai')).toBeNull());
        expect(reale.haConsensoAi(auth.user)).toBe(true);
    });

    it('con il consenso già dato non si vede mai', () => {
        auth.user = { id: 'u1', user_metadata: { consenso_ai: { v: 1, at: 'x' } } };
        monta(<ConsensoAi />, '/dashboard-user');
        expect(screen.queryByTestId('consenso-ai')).toBeNull();
    });

    it('non copre privacy, termini e login', () => {
        for (const p of ['/privacy', '/termini', '/login']) {
            const v = monta(<ConsensoAi />, p);
            expect(screen.queryByTestId('consenso-ai')).toBeNull();
            v.unmount();
        }
    });

    it('senza utente non si apre da sola; si apre quando un servizio AI lo chiede', async () => {
        auth.user = null;
        monta(<ConsensoAi />, '/');
        expect(screen.queryByTestId('consenso-ai')).toBeNull();
        await act(async () => { window.dispatchEvent(new CustomEvent(reale.EVENTO_CONSENSO_AI)); });
        expect(screen.getByTestId('consenso-ai')).toBeInTheDocument();
    });

    it('«Non adesso» la chiude e non dà il consenso', async () => {
        monta(<ConsensoAi />, '/dashboard-user');
        fireEvent.click(screen.getByTestId('consenso-ai-no'));
        expect(screen.queryByTestId('consenso-ai')).toBeNull();
        expect(reale.haConsensoAi(auth.user)).toBe(false);
    });
});

describe('Pagine /privacy e /termini', () => {
    it.each([['Privacy', Privacy], ['Termini', Termini]])('%s: pubblica, con la bozza in cima e i segnaposto evidenti', (_n, Pagina) => {
        auth.user = null; // senza login
        monta(<Pagina />, '/x');
        const primo = document.querySelector('main').children[1];
        expect(primo).toHaveAttribute('data-bozza');
        expect(primo).toHaveTextContent(BOZZA);
        expect(document.querySelectorAll('mark[data-segnaposto]').length).toBeGreaterThan(0);
        expect(document.body.textContent).toContain(SEGNAPOSTO.TITOLARE);
    });

    it('la privacy elenca ogni flusso con cosa parte, verso chi, perché, per quanto', () => {
        monta(<Privacy />, '/privacy');
        const flussi = document.querySelectorAll('[data-flusso]');
        const nomi = PRIVACY.sezioni.find((s) => s.id === 'flussi').flussi;
        expect(flussi.length).toBe(nomi.length);
        for (const nome of ['Supabase', 'Google', 'Anthropic', 'OpenAI', 'Vercel', 'Resend', 'Wikipedia', 'Nominatim', 'Stripe', 'localStorage', 'Posizione']) {
            expect(document.body.textContent).toContain(nome);
        }
        for (const etichetta of ['Cosa parte', 'Verso chi', 'Perché', 'Per quanto resta']) expect(screen.getAllByText(etichetta).length).toBe(nomi.length);
    });

    it('nessun dato inventato: i segnaposto non hanno un valore, e ogni flusso ha tutti e quattro i campi pieni', () => {
        for (const f of PRIVACY.sezioni.find((s) => s.id === 'flussi').flussi) {
            for (const k of ['nome', 'parte', 'verso', 'perche', 'resta']) expect(String(f[k]).trim().length).toBeGreaterThan(0);
        }
        const testo = JSON.stringify([PRIVACY, TERMINI]);
        expect(testo).not.toMatch(/Benvenut/i);
        expect(testo).not.toMatch(/@[a-z0-9-]+\.(it|com|org)/i); // nessuna email inventata
    });

    it('LinkLegali porta a /privacy e /termini', () => {
        monta(<LinkLegali />, '/');
        expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
        expect(screen.getByRole('link', { name: 'Termini' })).toHaveAttribute('href', '/termini');
    });
});
