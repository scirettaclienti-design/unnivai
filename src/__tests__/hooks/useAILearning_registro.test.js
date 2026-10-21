import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// DNA-1 — useAILearning.trackDnaEvent scrive nel registro il giro completato e il giro salvato,
// e i pesi restano quelli di prima (nessun cambiamento di calcolo).
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../../lib/dnaRegistro', () => ({ logDnaEvent: vi.fn() }));

import { useAILearning } from '../../hooks/useAILearning';
import { logDnaEvent } from '../../lib/dnaRegistro';

const TAPPE = [{ types: ['restaurant'] }, { types: ['museum'] }];

beforeEach(() => { localStorage.clear(); vi.mocked(logDnaEvent).mockClear(); });

describe('DNA-1 — trackDnaEvent → registro', () => {
    it('giro completato: il registro riceve le categorie vere, la città e il giro', () => {
        const { result } = renderHook(() => useAILearning());
        act(() => result.current.trackDnaEvent('tour_completed', TAPPE, { city: 'Roma', tourId: 'g1' }));
        expect(logDnaEvent).toHaveBeenCalledWith('tour_completed', { categories: ['food', 'cultura'], city: 'Roma', tourId: 'g1' });
    });

    it('giro salvato: stessa cosa', () => {
        const { result } = renderHook(() => useAILearning());
        act(() => result.current.trackDnaEvent('tour_saved', TAPPE, { city: 'Napoli', tourId: 7 }));
        expect(logDnaEvent).toHaveBeenCalledWith('tour_saved', { categories: ['food', 'cultura'], city: 'Napoli', tourId: 7 });
    });

    it('un giro senza categorie arriva comunque al registro, ma i pesi non cambiano', () => {
        const { result } = renderHook(() => useAILearning());
        const prima = JSON.stringify(result.current.weights);
        act(() => result.current.trackDnaEvent('tour_completed', [], { city: 'Roma', tourId: 'g2' }));
        expect(logDnaEvent).toHaveBeenCalledWith('tour_completed', { categories: [], city: 'Roma', tourId: 'g2' });
        expect(JSON.stringify(result.current.weights)).toBe(prima);
        expect(result.current.dnaEvents).toBe(0);
    });

    it('i pesi si muovono come prima (+0,3 per categoria): DNA-1 non ha cambiato il calcolo', () => {
        const { result } = renderHook(() => useAILearning());
        act(() => result.current.trackDnaEvent('tour_completed', TAPPE, { city: 'Roma' }));
        expect(result.current.dnaEvents).toBe(1);
        expect(result.current.preferenceGraph['dna:food']).toBeCloseTo(0.3);
        expect(result.current.preferenceGraph['dna:cultura']).toBeCloseTo(0.3);
    });
});
