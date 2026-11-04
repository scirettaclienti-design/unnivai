import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { readFileSync } from 'node:fs';

vi.mock('framer-motion', async () => {
    const React = await import('react');
    const OMIT = new Set(['initial', 'animate', 'exit', 'variants', 'whileHover', 'whileTap', 'transition']);
    const clean = (props) => Object.fromEntries(Object.entries(props).filter(([k]) => !OMIT.has(k)));
    const motion = new Proxy({}, { get: (_t, tag) => React.forwardRef((props, ref) => React.createElement(tag, { ...clean(props), ref })) });
    return { motion, AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children) };
});

const signInWithPassword = vi.fn();
const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
const updateUser = vi.fn();
const finto = () => ({ supabase: { auth: { signInWithPassword: (...a) => signInWithPassword(...a), signInWithOtp: (...a) => signInWithOtp(...a), verifyOtp: (...a) => verifyOtp(...a), updateUser: (...a) => updateUser(...a) }, from: vi.fn() } });
vi.mock('@/lib/supabase', () => finto());
vi.mock('../../lib/supabase', () => finto());

let auth = { user: null, role: null, refreshRole: vi.fn(), resetPassword: vi.fn(), isPasswordRecovery: false, fineRecupero: vi.fn() };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const Login = (await import('@/pages/Login')).default;
const UpdatePassword = (await import('@/pages/UpdatePassword')).default;
const { ACCESSO, NUOVA_PASSWORD } = await import('@/lib/testiAccount');

const Dove = () => { const l = useLocation(); return <div data-testid="dove">{l.pathname}{l.search}</div>; };
const monta = (path = '/login') => render(
    <MemoryRouter initialEntries={[path]}>
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/update-password" element={<UpdatePassword />} />
            <Route path="*" element={<Dove />} />
        </Routes>
    </MemoryRouter>
);
const conPassword = () => fireEvent.click(screen.getByTestId('accesso-con-password'));
const invia = () => fireEvent.click(screen.getByTestId('accesso-invia'));

beforeEach(() => {
    vi.resetAllMocks();
    auth = { user: null, role: null, refreshRole: vi.fn(), resetPassword: vi.fn(), isPasswordRecovery: false, fineRecupero: vi.fn() };
});

describe('ONBOARDING-ACCESSO — si entra con email e codice', () => {
    it('la prima schermata è l\'email: niente scelta del ruolo, niente password', () => {
        monta();
        expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Password')).toBeNull();
        expect(screen.queryByText('Voglio Esplorare')).toBeNull();
        expect(screen.getByText(ACCESSO.TITOLO)).toBeInTheDocument();
    });

    it('email → codice: signInWithOtp crea l\'account se manca, verifyOtp type email apre la sessione', async () => {
        signInWithOtp.mockResolvedValue({ data: {}, error: null });
        verifyOtp.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });
        monta();
        fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: ' anna@example.com ' } });
        invia();
        await screen.findByTestId('accesso-codice-campo');
        expect(signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({ email: 'anna@example.com', options: expect.objectContaining({ shouldCreateUser: true, data: { role: 'explorer' } }) }));
        expect(screen.getByText(ACCESSO.CODICE_TESTO('anna@example.com'))).toBeInTheDocument();
        fireEvent.change(screen.getByTestId('accesso-codice-campo'), { target: { value: '12 34 56' } });
        invia();
        await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith({ email: 'anna@example.com', token: '123456', type: 'email' }));
    });

    it('codice corto: lo dice e non chiama Supabase; codice sbagliato o scaduto: frase umana', async () => {
        signInWithOtp.mockResolvedValue({ data: {}, error: null });
        verifyOtp.mockResolvedValue({ data: null, error: { code: 'otp_expired', message: 'Token has expired or is invalid' } });
        monta();
        fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'anna@example.com' } });
        invia();
        await screen.findByTestId('accesso-codice-campo');
        fireEvent.change(screen.getByTestId('accesso-codice-campo'), { target: { value: '123' } });
        invia();
        expect(await screen.findByText(ACCESSO.CODICE_CORTO)).toBeInTheDocument();
        expect(verifyOtp).not.toHaveBeenCalled();
        fireEvent.change(screen.getByTestId('accesso-codice-campo'), { target: { value: '000000' } });
        invia();
        expect(await screen.findByText(ACCESSO.CODICE_SBAGLIATO)).toBeInTheDocument();
        expect(screen.queryByText(/Token has expired/)).toBeNull();
    });

    it('«Mandamene un altro» aspetta un minuto (il limite di Supabase), poi rimanda', async () => {
        signInWithOtp.mockResolvedValue({ data: {}, error: null });
        monta();
        fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'anna@example.com' } });
        invia();
        await screen.findByTestId('accesso-codice-campo');
        const rimanda = screen.getByTestId('accesso-rimanda');
        expect(rimanda).toBeDisabled();
        expect(rimanda).toHaveTextContent(ACCESSO.RIMANDA_TRA(60));
    });

    it('troppe richieste: il messaggio dell\'app, mai l\'inglese', async () => {
        signInWithOtp.mockResolvedValue({ data: {}, error: { status: 429, message: 'For security purposes, you can only request this after 42 seconds.' } });
        monta();
        fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'anna@example.com' } });
        invia();
        expect(await screen.findByText('Troppi tentativi. Riprova tra qualche minuto.')).toBeInTheDocument();
    });

    it('email non valida → messaggio dell\'app, nessuna chiamata a Supabase; form senza validazione nativa', async () => {
        const { container } = monta();
        expect(container.querySelector('form').hasAttribute('novalidate')).toBe(true);
        fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'mario@' } });
        invia();
        expect(await screen.findByText(/Email non valida/)).toBeInTheDocument();
        expect(signInWithOtp).not.toHaveBeenCalled();
    });

    it('LINK-DOMINIO: un link di conferma o accesso scaduto (?link=scaduto) porta al codice col messaggio chiaro', () => {
        monta('/login?link=scaduto');
        expect(screen.getByText(ACCESSO.LINK_SCADUTO)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    });

    it('arrivando da un vecchio link scaduto: messaggio chiaro e si entra col codice', () => {
        monta('/login?recupero=1');
        expect(screen.getByText(ACCESSO.LINK_SCADUTO)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    });
});

describe('ACCESSO-1 — chi ha una password la usa ancora (nessun account bloccato)', () => {
    it('una password corta arriva a Supabase (nessun controllo di complessità all\'accesso)', async () => {
        signInWithPassword.mockResolvedValue({ error: null });
        monta();
        conPassword();
        fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.it' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'abc' } });
        fireEvent.click(screen.getByRole('button', { name: /Accedi ora/ }));
        await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.it', password: 'abc' }));
    });

    it('credenziali errate → errore in italiano, mai «Invalid login credentials»', async () => {
        signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
        monta();
        conPassword();
        fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.it' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'x' } });
        invia();
        expect(await screen.findByText('Email o password non corrette.')).toBeInTheDocument();
        expect(screen.queryByText(/Invalid login credentials/)).toBeNull();
    });

    it('«Password dimenticata?» porta al codice, senza email di reset', () => {
        monta();
        conPassword();
        fireEvent.click(screen.getByTestId('accesso-dimenticata'));
        expect(screen.queryByPlaceholderText('Password')).toBeNull();
        expect(screen.getByText(ACCESSO.TITOLO)).toBeInTheDocument();
        expect(auth.resetPassword).not.toHaveBeenCalled();
    });

    it('i testi usati dagli script WebKit restano trovabili («Accedi →», «Accedi ora»)', () => {
        expect(ACCESSO.HAI_PASSWORD).toContain('Accedi →');
        expect(ACCESSO.INVIA_PASSWORD.toLowerCase()).toBe('accedi ora');
    });
});

describe('ACCESSO-1 difetto 2 — UpdatePassword (vecchi link «reimposta la password»)', () => {
    it('senza sessione di recupero torna all\'accesso col codice', () => {
        auth.isPasswordRecovery = false;
        monta('/update-password');
        expect(screen.getByText(ACCESSO.LINK_SCADUTO)).toBeInTheDocument();
        expect(screen.queryByPlaceholderText(NUOVA_PASSWORD.CAMPO)).toBeNull();
    });

    it('con la sessione di recupero: 6 minuscole rifiutate, nessuna chiamata a Supabase', async () => {
        auth.isPasswordRecovery = true;
        monta('/update-password');
        fireEvent.change(screen.getByPlaceholderText(NUOVA_PASSWORD.CAMPO), { target: { value: 'abcdef' } });
        invia();
        expect(await screen.findByRole('alert')).toHaveTextContent('La password deve avere almeno 8 caratteri');
        expect(updateUser).not.toHaveBeenCalled();
    });

    it('con la sessione di recupero: una password valida si salva, il recupero finisce e si va a «/»', async () => {
        auth.isPasswordRecovery = true;
        updateUser.mockResolvedValue({ error: null });
        monta('/update-password');
        fireEvent.change(screen.getByPlaceholderText(NUOVA_PASSWORD.CAMPO), { target: { value: 'Abcdefg1' } });
        invia();
        await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'Abcdefg1' }));
        await waitFor(() => expect(screen.getByTestId('dove')).toHaveTextContent('/'));
        expect(auth.fineRecupero).toHaveBeenCalled();
    });

    it('un errore di Supabase compare in italiano', async () => {
        auth.isPasswordRecovery = true;
        updateUser.mockResolvedValue({ error: { code: 'same_password', message: 'New password should be different from the old password.' } });
        monta('/update-password');
        fireEvent.change(screen.getByPlaceholderText(NUOVA_PASSWORD.CAMPO), { target: { value: 'Abcdefg1' } });
        invia();
        expect(await screen.findByText('Scegli una password diversa da quella di prima.')).toBeInTheDocument();
    });
});

describe('ACCESSO-1 difetto 8 — «Esci»', () => {
    it('il bottone ha il nome accessibile «Esci» (aria-label), stesso stile di prima', () => {
        const src = readFileSync('src/components/TopBar.jsx', 'utf8');
        const m = src.match(/<button\s+onClick=\{handleLogout\}[\s\S]*?>/);
        expect(m).not.toBeNull();
        expect(m[0]).toContain('aria-label="Esci"');
        expect(m[0]).toContain('title="Esci"');
    });
});
