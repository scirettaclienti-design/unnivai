import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// Gate SEME (L1) — round-trip seme onboarding → weights, letto attraverso il
// SUO caller pubblico reale (useAILearning), non re-implementato.
//
// useAILearning chiama useAuth(): con user=null il sync verso Supabase
// early-returna (userId falsy), quindi il preferenceGraph resta ESATTAMENTE
// quello di localStorage — che nei test lasciamo vuoto. Cosi' isoliamo l'effetto
// del seme senza mockare il grafo: se il seme ci finisse dentro, si vedrebbe.
vi.mock('@/context/AuthContext', () => ({
    useAuth: () => ({ user: null }),
}));

import { useAILearning } from '../../hooks/useAILearning';

const SEED_KEY = 'unnivai_onboarding_seed_v1';
const NON_SEEDED_WHEN_FOOD_NATURA = ['cultura', 'nightlife', 'avventura', 'shopping', 'relax', 'arte'];

beforeEach(() => {
    localStorage.clear();
});

describe('Gate SEME (L1) — round-trip seme → weights (via useAILearning)', () => {
    it('seme ["food","natura"] → weights food e natura > 0, tutte le altre CORE 0', () => {
        localStorage.setItem(SEED_KEY, JSON.stringify(['food', 'natura']));
        const { result } = renderHook(() => useAILearning());

        expect(result.current.hasSeed).toBe(true);
        expect(result.current.weights.food).toBeGreaterThan(0);
        expect(result.current.weights.natura).toBeGreaterThan(0);
        for (const cat of NON_SEEDED_WHEN_FOOD_NATURA) {
            expect(result.current.weights[cat]).toBe(0);
        }
    });

    it('JSON malformato → seme [], nessun crash, hasSeed false, weights tutti 0', () => {
        localStorage.setItem(SEED_KEY, '{non-e-json');
        const { result } = renderHook(() => useAILearning());

        expect(result.current.hasSeed).toBe(false);
        expect(Object.values(result.current.weights).every(v => v === 0)).toBe(true);
    });

    it('chiave assente → seme [], hasSeed false', () => {
        const { result } = renderHook(() => useAILearning());
        expect(result.current.hasSeed).toBe(false);
    });

    it('chiave "[]" (utente che ha SALTATO) → seme [], hasSeed false', () => {
        localStorage.setItem(SEED_KEY, '[]');
        const { result } = renderHook(() => useAILearning());
        expect(result.current.hasSeed).toBe(false);
    });

    // ── IL TEST CHE VALE DI PIU' ────────────────────────────────────────────
    // Il seme NON deve MAI confluire nel preferenceGraph (regola locked Gate DNA:
    // il grafo conta solo comportamento vero). Questo fallisce se un domani il seme
    // venisse scritto nel grafo o incrementasse le interazioni.
    it('KILLER: il seme influenza i weights ma NON entra nel preferenceGraph ne\' nelle interazioni', () => {
        localStorage.setItem(SEED_KEY, JSON.stringify(['food', 'arte']));
        const { result } = renderHook(() => useAILearning());

        // effetto atteso sui pesi
        expect(result.current.weights.food).toBeGreaterThan(0);
        expect(result.current.weights.arte).toBeGreaterThan(0);

        // ma il grafo resta VUOTO e le interazioni a zero
        expect(result.current.preferenceGraph).toEqual({});
        expect(result.current.totalInteractions).toBe(0);
        // nessuna chiave cat: derivata dal seme
        const catKeys = Object.keys(result.current.preferenceGraph).filter(k => k.startsWith('cat:'));
        expect(catKeys).toEqual([]);
    });

    it('il brain salvato in localStorage dopo il mount NON contiene il seme', () => {
        localStorage.setItem(SEED_KEY, JSON.stringify(['food', 'arte']));
        renderHook(() => useAILearning());
        // useAILearning riscrive il brain (STORAGE_KEY) ad ogni cambio stato:
        // deve restare pulito, il seme vive in una chiave separata.
        const brain = JSON.parse(localStorage.getItem('unnivai_ai_learning_brain_v2') || '{}');
        expect(brain.preferenceGraph || {}).toEqual({});
        expect(brain.totalInteractions || 0).toBe(0);
    });
});
