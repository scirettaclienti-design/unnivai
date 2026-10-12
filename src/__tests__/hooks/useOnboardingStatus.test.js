import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ONB-1 — utente nuovo: l'onboarding si vede UNA volta sola. Dopo il salvataggio
// (markOnboardingDone + seme sul DB) il hook dice 'done' al rientro, anche senza rete.
const getOnboardingStateMock = vi.fn();
vi.mock('@/services/dataService', () => ({
    dataService: {
        getOnboardingState: (...a) => getOnboardingStateMock(...a),
        upsertOnboardingSeed: vi.fn().mockResolvedValue({ success: true }),
    },
}));

import { useOnboardingStatus } from '../../hooks/useOnboardingStatus';
import { markOnboardingDone } from '../../lib/onboardingStatus';

const ME = '11111111-2222-3333-4444-555555555555';
beforeEach(() => { localStorage.clear(); getOnboardingStateMock.mockReset(); });

describe('ONB-1 — useOnboardingStatus', () => {
    it('utente nuovo: checking → todo (onboarding mostrato)', async () => {
        getOnboardingStateMock.mockResolvedValue({ ok: true, seed: null });
        const { result } = renderHook(() => useOnboardingStatus(ME));
        expect(result.current).toBe('checking');
        await waitFor(() => expect(result.current).toBe('todo'));
    });

    it('dopo l\'onboarding: al rientro e\' done subito, senza aspettare la rete', () => {
        markOnboardingDone(ME);
        const { result } = renderHook(() => useOnboardingStatus(ME));
        expect(result.current).toBe('done');
        expect(getOnboardingStateMock).not.toHaveBeenCalled();
    });

    it('altro browser: nessuna copia, il DB dice fatto → done', async () => {
        getOnboardingStateMock.mockResolvedValue({ ok: true, seed: ['food'] });
        const { result } = renderHook(() => useOnboardingStatus(ME));
        await waitFor(() => expect(result.current).toBe('done'));
    });

    it('senza utente resta checking e non interroga il DB', () => {
        const { result } = renderHook(() => useOnboardingStatus(undefined));
        expect(result.current).toBe('checking');
        expect(getOnboardingStateMock).not.toHaveBeenCalled();
    });
});
