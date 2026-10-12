import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, waitFor } from '@testing-library/react';

// ONB-1 — chi ha gia' fatto l'onboarding (lo dice il DB, anche da un altro browser)
// e arriva su /onboarding per URL diretto torna a '/'. Gli interessi si cambiano
// solo dal Profilo. Un utente nuovo invece resta sul wizard.
vi.mock('framer-motion', async () => {
    const React = await import('react');
    const OMIT = new Set(['initial', 'animate', 'exit', 'variants', 'whileHover', 'whileTap', 'transition', 'custom', 'layout']);
    const clean = (p) => Object.fromEntries(Object.entries(p).filter(([k]) => !OMIT.has(k)));
    const motion = new Proxy({}, { get: (_t, tag) => React.forwardRef((props, ref) => React.createElement(tag, { ...clean(props), ref })) });
    return { motion, AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children) };
});
const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
const getOnboardingStateMock = vi.fn();
vi.mock('@/services/dataService', () => ({
    dataService: { getOnboardingState: (...a) => getOnboardingStateMock(...a), upsertOnboardingSeed: vi.fn() },
}));

import Onboarding from '../../pages/Onboarding';

beforeEach(() => { localStorage.clear(); navigateMock.mockReset(); getOnboardingStateMock.mockReset(); });

describe('ONB-1 — /onboarding per chi l\'ha gia\' fatto', () => {
    it('seme sul DB (altro browser) → redirect a "/"', async () => {
        getOnboardingStateMock.mockResolvedValue({ ok: true, seed: ['food'] });
        render(createElement(Onboarding));
        await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/', { replace: true }));
    });

    it('utente nuovo (DB vuoto) → resta sul wizard, nessun redirect', async () => {
        getOnboardingStateMock.mockResolvedValue({ ok: true, seed: null });
        render(createElement(Onboarding));
        await waitFor(() => expect(getOnboardingStateMock).toHaveBeenCalled());
        await new Promise(r => setTimeout(r, 30));
        expect(navigateMock).not.toHaveBeenCalled();
    });
});
