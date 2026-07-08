// DVAI-061 — Preflight quota lato client (SurpriseTour click-morto fix).
//
// Il preflight legge lo stato quota SENZA incrementare. Serve per feedback
// immediato sul pulsante SurpriseTour: se già a limite, mostriamo subito il
// flash + toast invece di far partire uno spinner finto per 1.5s.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDailyQuotaStatus } from '../../services/aiRecommendationService';
import { supabase } from '../../lib/supabase';

// Mock @/lib/supabase è globale in setup.js (per il CI senza .env).
// Qui sovrascrivo per iniettare specifiche risposte per-test.

describe('DVAI-061 — getDailyQuotaStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('guest (no session) → exceeded=false, authenticated=false (bypass quota)', async () => {
        vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } });
        const status = await getDailyQuotaStatus();
        expect(status).toEqual({
            authenticated: false,
            count: 0,
            remaining: 10,
            exceeded: false,
        });
    });

    it('utente con count=5 → exceeded=false, remaining=5', async () => {
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { user: { id: 'user-a' } } },
        });
        // supabase.from(...).select().eq().eq().maybeSingle() → { data: { count: 5 } }
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { count: 5 }, error: null }),
        });
        const status = await getDailyQuotaStatus();
        expect(status.authenticated).toBe(true);
        expect(status.count).toBe(5);
        expect(status.remaining).toBe(5);
        expect(status.exceeded).toBe(false);
    });

    it('utente con count=10 → exceeded=true, remaining=0 (blocca)', async () => {
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { user: { id: 'user-b' } } },
        });
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { count: 10 }, error: null }),
        });
        const status = await getDailyQuotaStatus();
        expect(status.exceeded).toBe(true);
        expect(status.remaining).toBe(0);
    });

    it('utente con count=12 (overflow) → remaining=0 non negativo', async () => {
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { user: { id: 'user-c' } } },
        });
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { count: 12 }, error: null }),
        });
        const status = await getDailyQuotaStatus();
        expect(status.remaining).toBe(0);
        expect(status.exceeded).toBe(true);
    });

    it('nessuna riga oggi (data=null) → count=0, remaining=10', async () => {
        vi.mocked(supabase.auth.getSession).mockResolvedValue({
            data: { session: { user: { id: 'user-d' } } },
        });
        vi.mocked(supabase.from).mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
        const status = await getDailyQuotaStatus();
        expect(status.count).toBe(0);
        expect(status.remaining).toBe(10);
        expect(status.exceeded).toBe(false);
    });

    it('errore RLS/rete → NON blocca (exceeded=false, permette il tentativo)', async () => {
        // Se il preflight fallisce (RLS mancante, network), non vogliamo bloccare
        // l'utente: cade sul path normale e checkAndIncrementQuota farà il gate
        // autoritativo nella generazione.
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error('network down'));
        const status = await getDailyQuotaStatus();
        expect(status.exceeded).toBe(false);
        expect(status.authenticated).toBe(false);
        warnSpy.mockRestore();
    });
});
