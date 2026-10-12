import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ONB-1 — il logout non deve cancellare cio' che serve a riconoscere l'utente al
// rientro ("onboarding fatto"). Le copie di gusti/DNA nel browser si possono
// svuotare (su un device condiviso e' giusto), perche' la fonte e' il DB.
vi.mock('@/lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1', user_metadata: { role: 'explorer' } } } } }),
            onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
            signOut: vi.fn().mockResolvedValue({}),
        },
    },
}));
vi.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1', user_metadata: { role: 'explorer' } } } } }),
            onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
            signOut: vi.fn().mockResolvedValue({}),
        },
    },
}));

import { AuthProvider, useAuth } from '../../context/AuthContext';

const Out = () => {
    const { signOut } = useAuth();
    return createElement('button', { onClick: signOut }, 'esci');
};

beforeEach(() => localStorage.clear());

describe('ONB-1 — signOut e "onboarding fatto"', () => {
    it('il logout NON cancella il flag onboarding (legato all\'utente) ma svuota le copie di gusti e DNA', async () => {
        localStorage.setItem('dvai_onboarding_done', 'u1');
        localStorage.setItem('unnivai_onboarding_seed_v1', JSON.stringify(['food']));
        localStorage.setItem('unnivai_ai_learning_brain_v2', '{"preferenceGraph":{}}');
        render(createElement(QueryClientProvider, { client: new QueryClient() },
            createElement(AuthProvider, null, createElement(Out))));
        fireEvent.click(await screen.findByText('esci'));
        await waitFor(() => expect(localStorage.getItem('unnivai_onboarding_seed_v1')).toBeNull());
        expect(localStorage.getItem('unnivai_ai_learning_brain_v2')).toBeNull();
        expect(localStorage.getItem('dvai_onboarding_done')).toBe('u1');
    });
});
