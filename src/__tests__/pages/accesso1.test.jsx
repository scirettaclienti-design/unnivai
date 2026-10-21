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
const signUp = vi.fn();
const updateUser = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { signInWithPassword: (...a) => signInWithPassword(...a), signUp: (...a) => signUp(...a), updateUser: (...a) => updateUser(...a) }, from: vi.fn() } }));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { signInWithPassword: (...a) => signInWithPassword(...a), signUp: (...a) => signUp(...a), updateUser: (...a) => updateUser(...a) }, from: vi.fn() } }));

let auth = { user: null, role: null, refreshRole: vi.fn(), resetPassword: vi.fn(), isPasswordRecovery: false, fineRecupero: vi.fn() };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const Login = (await import('@/pages/Login')).default;
const UpdatePassword = (await import('@/pages/UpdatePassword')).default;

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
const apriLogin = () => {
    fireEvent.click(screen.getByText('Voglio Esplorare'));
    fireEvent.click(screen.getAllByRole('button', { name: /^Accedi$/ })[0]);
};

beforeEach(() => {
    vi.resetAllMocks();
    auth = { user: null, role: null, refreshRole: vi.fn(), resetPassword: vi.fn(), isPasswordRecovery: false, fineRecupero: vi.fn() };
});

describe('ACCESSO-1 — Login', () => {
    it('difetto 1: una password corta arriva a Supabase (nessun controllo di complessità)', async () => {
        signInWithPassword.mockResolvedValue({ error: null });
        monta();
        apriLogin();
        fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.it' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'abc' } });
        fireEvent.click(screen.getByRole('button', { name: /Accedi Ora/ }));
        await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.it', password: 'abc' }));
    });

    it('difetto 3: credenziali errate → errore in italiano, mai «Invalid login credentials»', async () => {
        signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
        monta();
        apriLogin();
        fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.it' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'x' } });
        fireEvent.click(screen.getByRole('button', { name: /Accedi Ora/ }));
        expect(await screen.findByText('Email o password non corrette.')).toBeInTheDocument();
        expect(screen.queryByText(/Invalid login credentials/)).toBeNull();
    });

    it('difetto 4: email non valida → messaggio dell\'app, nessuna chiamata a Supabase', async () => {
        monta();
        apriLogin();
        fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'mario@' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'x' } });
        fireEvent.click(screen.getByRole('button', { name: /Accedi Ora/ }));
        expect(await screen.findByText(/Email non valida/)).toBeInTheDocument();
        expect(signInWithPassword).not.toHaveBeenCalled();
    });

    it('difetto 4: i form non usano la validazione nativa del browser', () => {
        const { container } = monta();
        apriLogin();
        expect(container.querySelector('form').hasAttribute('novalidate')).toBe(true);
    });

    it('difetto 6: con password corta alla registrazione il messaggio compare UNA volta', async () => {
        monta();
        fireEvent.click(screen.getByText('Voglio Esplorare'));
        fireEvent.change(screen.getByPlaceholderText('Nome Completo'), { target: { value: 'Mario Rossi' } });
        fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.it' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'abc' } });
        fireEvent.click(screen.getByRole('button', { name: /Registrati Gratuitamente/ }));
        expect(await screen.findAllByText('La password deve avere almeno 8 caratteri')).toHaveLength(1);
        expect(signUp).not.toHaveBeenCalled();
    });

    it('difetto 3: «già registrata» (utente esistente senza identità) in italiano', async () => {
        signUp.mockResolvedValue({ data: { user: { identities: [] } }, error: null });
        monta();
        fireEvent.click(screen.getByText('Voglio Esplorare'));
        fireEvent.change(screen.getByPlaceholderText('Nome Completo'), { target: { value: 'Mario Rossi' } });
        fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.it' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'Abcdefg1' } });
        fireEvent.click(screen.getByRole('button', { name: /Registrati Gratuitamente/ }));
        expect(await screen.findByText('Email già registrata. Prova ad accedere.')).toBeInTheDocument();
    });

    it('difetto 2: arrivando da un link scaduto si apre «password dimenticata» col messaggio chiaro', () => {
        monta('/login?recupero=1');
        expect(screen.getByText(/Il link non è valido o è scaduto/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Invia Link di Reset/ })).toBeInTheDocument();
    });

    it('difetto 4: anche «password dimenticata» con email non valida dà il messaggio dell\'app', async () => {
        monta('/login?recupero=1');
        fireEvent.change(screen.getByPlaceholderText('La tua email'), { target: { value: 'mario@' } });
        fireEvent.click(screen.getByRole('button', { name: /Invia Link di Reset/ }));
        expect(await screen.findByText(/Email non valida/)).toBeInTheDocument();
        expect(auth.resetPassword).not.toHaveBeenCalled();
    });
});

describe('ACCESSO-1 difetto 2 — UpdatePassword', () => {
    it('senza sessione di recupero rimanda a «password dimenticata»', () => {
        auth.isPasswordRecovery = false;
        monta('/update-password');
        expect(screen.getByText(/Il link non è valido o è scaduto/)).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Nuova Password')).toBeNull();
    });

    it('con la sessione di recupero: 6 minuscole rifiutate, nessuna chiamata a Supabase', async () => {
        auth.isPasswordRecovery = true;
        monta('/update-password');
        fireEvent.change(screen.getByPlaceholderText('Nuova Password'), { target: { value: 'abcdef' } });
        fireEvent.click(screen.getByRole('button', { name: /Salva Password/ }));
        expect(await screen.findByRole('alert')).toHaveTextContent('La password deve avere almeno 8 caratteri');
        expect(updateUser).not.toHaveBeenCalled();
    });

    it('con la sessione di recupero: una password valida si salva, il recupero finisce e si va a «/»', async () => {
        auth.isPasswordRecovery = true;
        updateUser.mockResolvedValue({ error: null });
        monta('/update-password');
        fireEvent.change(screen.getByPlaceholderText('Nuova Password'), { target: { value: 'Abcdefg1' } });
        fireEvent.click(screen.getByRole('button', { name: /Salva Password/ }));
        await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'Abcdefg1' }));
        await waitFor(() => expect(screen.getByTestId('dove')).toHaveTextContent('/'));
        expect(auth.fineRecupero).toHaveBeenCalled();
    });

    it('un errore di Supabase compare in italiano', async () => {
        auth.isPasswordRecovery = true;
        updateUser.mockResolvedValue({ error: { code: 'same_password', message: 'New password should be different from the old password.' } });
        monta('/update-password');
        fireEvent.change(screen.getByPlaceholderText('Nuova Password'), { target: { value: 'Abcdefg1' } });
        fireEvent.click(screen.getByRole('button', { name: /Salva Password/ }));
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
