import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('framer-motion', async () => {
    const React = await import('react');
    const OMIT = new Set(['initial', 'animate', 'exit', 'variants', 'whileHover', 'whileTap', 'transition']);
    const clean = (props) => Object.fromEntries(Object.entries(props).filter(([k]) => !OMIT.has(k)));
    const motion = new Proxy({}, { get: (_t, tag) => React.forwardRef((props, ref) => React.createElement(tag, { ...clean(props), ref })) });
    return { motion, AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children) };
});

const eq = vi.fn();
const update = vi.fn(() => ({ eq }));
const updateUser = vi.fn();
const chain = () => { const c = { select: () => c, eq: () => c, order: () => c, limit: () => c, in: () => c, then: (f) => Promise.resolve({ data: [], error: null }).then(f), update }; return c; };
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => chain(), auth: { updateUser: (...a) => updateUser(...a) } } }));
vi.mock('../../components/TopBar', () => ({ default: () => null }));
vi.mock('../../components/BottomNavigation', () => ({ default: () => null }));
vi.mock('../../components/ChatModalUser', () => ({ default: () => null }));
vi.mock('../../components/FoodPrefsEditor', () => ({ default: () => null }));
vi.mock('../../components/InterestsEditor', () => ({ default: () => null }));
vi.mock('../../hooks/useUserContext', () => ({ useUserContext: () => ({ userId: 'u1', firstName: 'Ivano', city: 'Roma' }) }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'a@b.it' } }) }));
const toast = vi.fn();
vi.mock('../../hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('../../hooks/useAILearning', () => ({
    useAILearning: () => ({ preferenceGraph: {}, onboardingPrefs: null, saveFoodPrefs: vi.fn(), interestIds: [], saveInterests: vi.fn() }),
}));

const Profile = (await import('@/pages/Profile')).default;
const monta = () => render(<MemoryRouter><Profile /></MemoryRouter>);

beforeEach(() => {
    eq.mockReset().mockResolvedValue({ error: null });
    update.mockClear();
    updateUser.mockReset().mockResolvedValue({ error: null });
    toast.mockClear();
});

describe('ACCESSO-1 difetto 5 — il nome del profilo si modifica e si salva', () => {
    it('matita → campo → Salva scrive nome in tabella e nell\'account e lo mostra', async () => {
        monta();
        fireEvent.click(screen.getByRole('button', { name: 'Modifica il nome' }));
        const campo = screen.getByRole('textbox', { name: 'Il tuo nome' });
        expect(campo.value).toBe('Ivano');
        fireEvent.change(campo, { target: { value: 'Giovanni' } });
        fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
        await waitFor(() => expect(screen.getByRole('heading', { name: 'Giovanni' })).toBeInTheDocument());
        expect(update).toHaveBeenCalledWith({ first_name: 'Giovanni' });
        expect(eq).toHaveBeenCalledWith('id', 'u1');
        expect(updateUser).toHaveBeenCalledWith({ data: { full_name: 'Giovanni', first_name: 'Giovanni' } });
    });

    it('un nome troppo corto resta nel campo con il messaggio, senza scrivere', async () => {
        monta();
        fireEvent.click(screen.getByRole('button', { name: 'Modifica il nome' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Il tuo nome' }), { target: { value: 'G' } });
        fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Inserisci almeno 2 caratteri');
        expect(update).not.toHaveBeenCalled();
    });

    it('Annulla chiude il campo senza cambiare il nome', () => {
        monta();
        fireEvent.click(screen.getByRole('button', { name: 'Modifica il nome' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Il tuo nome' }), { target: { value: 'Altro' } });
        fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
        expect(screen.getByRole('heading', { name: 'Ivano' })).toBeInTheDocument();
        expect(update).not.toHaveBeenCalled();
    });
});
