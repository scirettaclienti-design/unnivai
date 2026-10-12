import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ONB-1 — gli interessi si modificano solo dal Profilo (saveInterests). Cambiarli
// riscrive SOLO onboarding_seed: il DNA (preference_data / interactions) non viene
// ne' azzerato ne' ricreato, e dieta/budget/stile del seme restano.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

const GRAPH = { 'cat:food': 7, 'cat:arte': 3 };
const getUserPreferencesMock = vi.fn();
const upsertOnboardingSeedMock = vi.fn();
const upsertUserPreferencesMock = vi.fn();
vi.mock('@/services/dataService', () => ({
    dataService: {
        getUserPreferences: (...a) => getUserPreferencesMock(...a),
        upsertOnboardingSeed: (...a) => upsertOnboardingSeedMock(...a),
        upsertUserPreferences: (...a) => upsertUserPreferencesMock(...a),
    },
}));

import { useAILearning } from '../../hooks/useAILearning';

const V2 = { v: 2, interessi: ['food'], vincoli: { dieta: ['vegano'], budget: '€€' }, gusti: { stile: 'trattoria' } };

beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
    getUserPreferencesMock.mockResolvedValue({ user_id: 'u1', preference_data: GRAPH, interactions: [], total_interactions: 10, onboarding_seed: V2 });
    upsertOnboardingSeedMock.mockResolvedValue({ success: true });
});

describe('ONB-1 — saveInterests (dal Profilo)', () => {
    it('l\'editor del Profilo vede gli interessi del server (altro browser): interestIds = ["food"]', async () => {
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.interestIds).toEqual(['food']));
    });

    it('salva SOLO il seme sul DB, con i nuovi interessi, conservando dieta/budget/stile', async () => {
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.hasSeed).toBe(true));
        let r;
        await act(async () => { r = await result.current.saveInterests(['natura', 'cultura']); });
        expect(r).toEqual({ success: true });
        expect(upsertOnboardingSeedMock).toHaveBeenCalledWith('u1', {
            v: 2,
            interessi: ['natura', 'cultura', 'arte'],
            vincoli: { dieta: ['vegano'], budget: '€€' },
            gusti: { stile: 'trattoria' },
        });
        expect(result.current.interestIds).toEqual(['cultura', 'natura']);
        expect(JSON.parse(localStorage.getItem('unnivai_onboarding_seed_v1')).interessi).toEqual(['natura', 'cultura', 'arte']);
    });

    it('il DNA non si azzera: nessuna scrittura su preference_data e il grafo resta quello di prima', async () => {
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.hasSeed).toBe(true));
        await waitFor(() => expect(result.current.preferenceGraph).toMatchObject(GRAPH));
        await act(async () => { await result.current.saveInterests(['relax']); });
        expect(upsertUserPreferencesMock).not.toHaveBeenCalled();
        expect(result.current.preferenceGraph).toMatchObject(GRAPH);
        expect(result.current.totalInteractions).toBe(10);
    });

    it('i pesi del DNA seguono il nuovo seme (aggiornato, non ricreato)', async () => {
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.hasSeed).toBe(true));
        await act(async () => { await result.current.saveInterests(['relax']); });
        expect(result.current.weights.relax).toBeGreaterThan(0);
    });

    it('salvataggio fallito: errore restituito, stato e cache NON cambiano', async () => {
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.hasSeed).toBe(true));
        upsertOnboardingSeedMock.mockResolvedValue({ success: false, error: 'rete' });
        let r;
        await act(async () => { r = await result.current.saveInterests(['relax']); });
        expect(r).toEqual({ success: false, error: 'rete' });
        expect(result.current.interestIds).toEqual(['food']);
    });

    it('nessun interesse selezionato → rifiutato, niente scrittura', async () => {
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.hasSeed).toBe(true));
        let r;
        await act(async () => { r = await result.current.saveInterests([]); });
        expect(r.success).toBe(false);
        expect(upsertOnboardingSeedMock).not.toHaveBeenCalled();
    });
});
