import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// DNA-6 — la correzione del DNA: scritta sul server, riletta nei pesi, salvata in cache; mai finta.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../services/dataService', () => ({
    dataService: { getUserPreferences: vi.fn(async () => null), upsertUserPreferences: vi.fn(), upsertOnboardingSeed: vi.fn() },
}));
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), auth: { getSession: vi.fn() } } }));

import { useAILearning } from '../../hooks/useAILearning';
import { supabase } from '../../lib/supabase';

const adesso = Date.now();
const riga = (id, kind, category, extra = {}) => ({ id, kind, category, city: null, value: null, tour_id: null, created_at: new Date(adesso - 60000).toISOString(), ...extra });
const RIGHE = [riga('a1', 'tour_completed', 'food', { tour_id: 'g1', city: 'Roma', value: '2/3' }), riga('a2', 'stop_reached', 'food', { tour_id: 'g1' })];

let insert;
function db({ lettura = { data: RIGHE, error: null }, scrittura }) {
    const chain = { select: vi.fn(() => chain), order: vi.fn(() => chain), limit: vi.fn(async () => lettura) };
    insert = vi.fn(() => ({ select: () => ({ single: async () => scrittura }) }));
    vi.mocked(supabase.from).mockReturnValue({ ...chain, insert });
}

beforeEach(() => { localStorage.clear(); vi.mocked(supabase.from).mockReset(); });

describe('DNA-6 — correggiDna', () => {
    it('«più»: scrive la riga, i pesi salgono subito e la cache si aggiorna', async () => {
        db({ scrittura: { data: riga('c1', 'dna_correction', 'food', { value: 'piu', created_at: new Date().toISOString() }), error: null } });
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.righeRegistro).toHaveLength(2));
        const prima = result.current.weights.food;
        let esito;
        await act(async () => { esito = await result.current.correggiDna('food', 'piu'); });
        expect(esito).toEqual({ ok: true });
        expect(insert).toHaveBeenCalledWith({ user_id: 'u1', kind: 'dna_correction', category: 'food', value: 'piu' });
        expect(result.current.weights.food).toBeGreaterThan(prima);
        expect(JSON.parse(localStorage.getItem('unnivai_dna_registro_v1')).rows).toHaveLength(3);
    });
    it('«azzera»: la categoria va a zero', async () => {
        db({ scrittura: { data: riga('c2', 'dna_correction', 'food', { value: 'azzera', created_at: new Date().toISOString() }), error: null } });
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.weights.food).toBeGreaterThan(0));
        await act(async () => { await result.current.correggiDna('food', 'azzera'); });
        expect(result.current.weights.food).toBe(0);
    });
    it('server che rifiuta: i pesi non cambiano e l\'esito è falso', async () => {
        db({ scrittura: { data: null, error: { message: 'rete' } } });
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.righeRegistro).toHaveLength(2));
        const prima = result.current.weights.food;
        let esito;
        await act(async () => { esito = await result.current.correggiDna('food', 'meno'); });
        expect(esito.ok).toBe(false);
        expect(result.current.weights.food).toBe(prima);
        expect(JSON.parse(localStorage.getItem('unnivai_dna_registro_v1')).rows).toHaveLength(2);
    });
    it('espone le righe del registro (Mete e contatori) con la città', async () => {
        db({ scrittura: { data: null, error: null } });
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.righeRegistro).toHaveLength(2));
        expect(result.current.righeRegistro[0].city).toBe('Roma');
    });
});
