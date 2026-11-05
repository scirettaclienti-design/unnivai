// LANCIO-ONBOARDING — «Account eliminato.» deve comparire. signOut passa dalla schermata di caricamento
// (AuthProvider smonta tutto, ToastProvider compreso): il messaggio non può viaggiare solo come evento.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createContext, useContext, useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const Ctx = createContext(null);
vi.mock('../../context/AuthContext', () => ({ useAuth: () => useContext(Ctx) }));
const getSession = vi.fn();
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: (...a) => getSession(...a) } } }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: (...a) => getSession(...a) } } }));

const EliminaAccount = (await import('../../components/EliminaAccount')).default;
const ToastProvider = (await import('../../components/ToastProvider')).default;
const { ELIMINA } = await import('../../lib/testiAccount');

// Come AuthProvider: mentre `loading` è vero al posto dell'app c'è la schermata di caricamento.
function AuthFinto({ children }) {
    const [user, setUser] = useState({ id: 'u1', email: 'anna@example.com', is_anonymous: false, user_metadata: {} });
    const [loading, setLoading] = useState(false);
    const signOut = async () => {
        setLoading(true);
        await new Promise((r) => setTimeout(r, 20));
        setUser(null);
        setLoading(false);
    };
    if (loading) return <div data-testid="caricamento" />;
    return <Ctx.Provider value={{ user, signOut }}>{children}</Ctx.Provider>;
}

const app = () => (
    <AuthFinto>
        <ToastProvider />
        <MemoryRouter initialEntries={['/profile']}>
            <Routes>
                <Route path="/profile" element={<EliminaAccount />} />
                <Route path="/" element={<div data-testid="home" />} />
            </Routes>
        </MemoryRouter>
    </AuthFinto>
);

beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    vi.stubEnv('VITE_SUPABASE_URL', 'http://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ esito: 'eliminato' }) })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Elimina account: il messaggio sopravvive all\'uscita', () => {
    it('dopo signOut (albero smontato e rimontato) «Account eliminato.» si vede, una volta sola', async () => {
        render(app());
        fireEvent.click(screen.getByTestId('elimina-account-apri'));
        fireEvent.change(screen.getByTestId('elimina-account-parola'), { target: { value: 'elimina' } });
        fireEvent.click(screen.getByTestId('elimina-account-conferma'));
        expect(await screen.findByText(ELIMINA.FATTO)).toBeInTheDocument();
        await waitFor(() => expect(screen.getAllByText(ELIMINA.FATTO)).toHaveLength(1));
        expect(sessionStorage.getItem('dvai_toast_in_attesa_v1')).toBeNull();
    });
});
