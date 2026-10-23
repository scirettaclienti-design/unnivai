import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// DNA-2 — useAILearning calcola i pesi dal registro (con cache) e non si blocca mai.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../services/dataService', () => ({
    dataService: { getUserPreferences: vi.fn(async () => null), upsertUserPreferences: vi.fn(), upsertOnboardingSeed: vi.fn() },
}));
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), auth: { getSession: vi.fn() } } }));

import { useAILearning } from '../../hooks/useAILearning';
import { supabase } from '../../lib/supabase';
import { pesiDaEventi } from '../../services/preferenceEngine';

const adesso = Date.now();
const riga = (id, kind, category, tour = null) => ({ id, kind, category, value: null, tour_id: tour, created_at: new Date(adesso - 1000).toISOString() });
const RIGHE = [
    riga('a1', 'tour_completed', 'food', 'g1'), riga('a2', 'tour_completed', 'food', 'g2'),
    riga('a3', 'tour_completed', 'food', 'g3'), riga('a4', 'stop_skipped', 'cultura'), riga('a5', 'stop_skipped', 'cultura'),
];
const registroCon = (res) => {
    const chain = { select: vi.fn(() => chain), order: vi.fn(() => chain), limit: vi.fn(async () => res) };
    vi.mocked(supabase.from).mockReturnValue(chain);
    return chain;
};

beforeEach(() => {
    localStorage.clear();
    vi.mocked(supabase.from).mockReset();
});

describe('DNA-2 — useAILearning legge il registro', () => {
    it('legge dna_events (solo le colonne che servono), calcola i pesi e li mette in cache', async () => {
        const chain = registroCon({ data: RIGHE, error: null });
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.dnaEvents).toBe(5));
        expect(supabase.from).toHaveBeenCalledWith('dna_events');
        expect(chain.select).toHaveBeenCalledWith('id,kind,category,city,value,tour_id,created_at');
        expect(result.current.weights.food).toBeGreaterThan(0.8);
        expect(result.current.weights.cultura).toBe(0);
        expect(result.current.dnaShare).toBe(0); // 5 eventi: la curva di oggi parte da 5 (0 fino a 5 compreso)
        const cache = JSON.parse(localStorage.getItem('unnivai_dna_registro_v1'));
        expect(cache.userId).toBe('u1');
        expect(cache.rows).toHaveLength(5);
        expect(result.current.dnaPronto).toBe(true);
    });

    it('stessi eventi → stessi pesi della funzione pura (due dispositivi)', async () => {
        registroCon({ data: RIGHE, error: null });
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.dnaEvents).toBe(5));
        const pura = pesiDaEventi(RIGHE, [], adesso);
        for (const [cat, w] of Object.entries(pura.pesi)) expect(result.current.weights[cat]).toBeCloseTo(w, 1);
    });

    it('lettura fallita: usa l’ultima cache e non blocca', async () => {
        localStorage.setItem('unnivai_dna_registro_v1', JSON.stringify({ userId: 'u1', rows: RIGHE }));
        registroCon({ data: null, error: { message: 'rete caduta' } });
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.dnaPronto).toBe(true));
        expect(result.current.dnaEvents).toBe(5);
        expect(result.current.weights.food).toBeGreaterThan(0.8);
    });

    it('la cache di un altro utente non si usa', async () => {
        localStorage.setItem('unnivai_dna_registro_v1', JSON.stringify({ userId: 'altro', rows: RIGHE }));
        registroCon({ data: null, error: { message: 'rete caduta' } });
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.dnaPronto).toBe(true));
        expect(result.current.dnaEvents).toBe(0);
        expect(result.current.weights.food).toBe(0);
    });

    it('lettura che lancia, senza cache: nessun crash, home non bloccata', async () => {
        vi.mocked(supabase.from).mockImplementation(() => { throw new Error('boom'); });
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.dnaPronto).toBe(true));
        expect(Object.values(result.current.weights).every(v => v === 0)).toBe(true);
    });

    it('espone ritmo e compagnia preferiti, senza usarli nei pesi', async () => {
        const sc = (id, kind, value) => ({ id, kind, category: null, value, tour_id: null, created_at: new Date(adesso).toISOString() });
        registroCon({ data: [sc('p1', 'pace_chosen', 'Rilassato'), sc('p2', 'pace_chosen', 'Rilassato'), sc('p3', 'pace_chosen', 'Rilassato'), sc('c1', 'company_chosen', 'coppia')], error: null });
        const { result } = renderHook(() => useAILearning());
        await waitFor(() => expect(result.current.ritmoPreferito?.suggerito).toBe('lento'));
        expect(result.current.compagniaPreferita.preferito).toBe('coppia');
        expect(result.current.compagniaPreferita.suggerito).toBeNull(); // una sola scelta
        expect(Object.values(result.current.weights).every(v => v === 0)).toBe(true);
    });
});
