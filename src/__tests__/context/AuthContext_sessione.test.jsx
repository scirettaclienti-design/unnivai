import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// LOGIN-SESSIONE (T26) — «Esci» solo da questo telefono; all'apertura la rete assente non è un «esci».
const SESSIONE = { refresh_token: 'r', user: { id: 'u1', user_metadata: { role: 'explorer' } } };
const mocks = vi.hoisted(() => ({ signOut: vi.fn(), getSession: vi.fn() }));
vi.mock('../../lib/supabase', () => ({
    supabase: { auth: { getSession: mocks.getSession, onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }), signOut: mocks.signOut } },
}));

import { AuthProvider, useAuth } from '../../context/AuthContext';

const Stato = () => {
    const { user, signOut } = useAuth();
    return createElement('div', null,
        createElement('span', { 'data-testid': 'utente' }, user?.id || 'nessuno'),
        createElement('button', { onClick: signOut }, 'esci'));
};
const monta = () => render(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(AuthProvider, null, createElement(Stato))));

beforeEach(() => {
    localStorage.clear();
    mocks.signOut.mockReset().mockResolvedValue({});
    mocks.getSession.mockReset();
});

describe('LOGIN-SESSIONE — Esci', () => {
    it('chiude la sessione solo su questo telefono (scope local), non su tutti', async () => {
        mocks.getSession.mockResolvedValue({ data: { session: SESSIONE }, error: null });
        monta();
        fireEvent.click(await screen.findByText('esci'));
        await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
        expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
        await waitFor(() => expect(screen.getByTestId('utente').textContent).toBe('nessuno'));
    });
});

describe('LOGIN-SESSIONE — apertura senza rete', () => {
    it('errore di rete nella lettura con sessione salvata: si resta dentro', async () => {
        localStorage.setItem('sb-prova-auth-token', JSON.stringify(SESSIONE));
        mocks.getSession.mockResolvedValue({ data: { session: null }, error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch' } });
        monta();
        await waitFor(() => expect(screen.getByTestId('utente').textContent).toBe('u1'), { timeout: 4000 });
    });
    it('senza sessione salvata e con errore: nessun utente (si chiede il codice)', async () => {
        mocks.getSession.mockResolvedValue({ data: { session: null }, error: { message: 'Invalid Refresh Token' } });
        monta();
        await waitFor(() => expect(screen.getByTestId('utente').textContent).toBe('nessuno'), { timeout: 4000 });
    });
});
