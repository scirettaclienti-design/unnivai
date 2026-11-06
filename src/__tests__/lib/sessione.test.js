import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sessioneSalvata, leggiSessioneAlAvvio, chiediMemoriaStabile, SCOPE_ESCI, ATTESA_SESSIONE_MS } from '../../lib/sessione';

// LOGIN-SESSIONE (T26): la sessione resta finché non premi «Esci»; rete o blocchi all'apertura non sono un «esci».
const SALVATA = { access_token: 'a', refresh_token: 'r', expires_at: 1, user: { id: 'u1', user_metadata: { role: 'explorer' } } };

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('SCOPE_ESCI', () => {
    it('«Esci» chiude solo questo telefono, non tutti', () => {
        expect(SCOPE_ESCI).toBe('local');
    });
});

describe('sessioneSalvata', () => {
    it('legge la sessione di Supabase dal telefono', () => {
        localStorage.setItem('sb-abc123-auth-token', JSON.stringify(SALVATA));
        expect(sessioneSalvata().user.id).toBe('u1');
    });
    it('senza token di rinnovo, senza utente o con JSON rovinato: null', () => {
        localStorage.setItem('sb-abc123-auth-token', JSON.stringify({ ...SALVATA, refresh_token: '' }));
        expect(sessioneSalvata()).toBeNull();
        localStorage.setItem('sb-abc123-auth-token', '{rotto');
        expect(sessioneSalvata()).toBeNull();
        localStorage.clear();
        localStorage.setItem('altra-chiave', JSON.stringify(SALVATA));
        expect(sessioneSalvata()).toBeNull();
    });
    it('storage che lancia: null, mai un errore', () => {
        const rotto = { get length() { throw new Error('storage ko'); }, key() { return null; }, getItem() { return null; } };
        expect(sessioneSalvata(rotto)).toBeNull();
    });
});

describe('leggiSessioneAlAvvio', () => {
    const client = (getSession) => ({ auth: { getSession } });

    it('sessione confermata dal server: quella, non da memoria', async () => {
        const r = await leggiSessioneAlAvvio(client(vi.fn().mockResolvedValue({ data: { session: SALVATA }, error: null })));
        expect(r).toEqual({ session: SALVATA, daMemoria: false });
    });

    it('nessuna sessione e nessun errore: fuori (ospite o uscito), senza ritentare né leggere la memoria', async () => {
        localStorage.setItem('sb-abc-auth-token', JSON.stringify(SALVATA));
        const gs = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
        const r = await leggiSessioneAlAvvio(client(gs));
        expect(r).toEqual({ session: null, daMemoria: false });
        expect(gs).toHaveBeenCalledTimes(1);
    });

    it('errore di rete con sessione salvata: si resta dentro con quella (daMemoria)', async () => {
        localStorage.setItem('sb-abc-auth-token', JSON.stringify(SALVATA));
        const gs = vi.fn().mockResolvedValue({ data: { session: null }, error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch' } });
        const r = await leggiSessioneAlAvvio(client(gs), { attesaMs: 50 });
        expect(r.daMemoria).toBe(true);
        expect(r.session.user.id).toBe('u1');
        expect(gs).toHaveBeenCalledTimes(2); // un nuovo tentativo, poi la memoria
    });

    it('il blocco sullo storage lancia: un nuovo tentativo, poi se va bene è la sessione vera', async () => {
        const gs = vi.fn().mockRejectedValueOnce(new Error('Lock not released within 5000ms'))
            .mockResolvedValueOnce({ data: { session: SALVATA }, error: null });
        const r = await leggiSessioneAlAvvio(client(gs), { attesaMs: 50 });
        expect(r).toEqual({ session: SALVATA, daMemoria: false });
    });

    it('lettura appesa oltre l\'attesa (rete che non risponde): sessione salvata, niente schermata vuota', async () => {
        localStorage.setItem('sb-abc-auth-token', JSON.stringify(SALVATA));
        const r = await leggiSessioneAlAvvio(client(() => new Promise(() => {})), { attesaMs: 30 });
        expect(r.daMemoria).toBe(true);
        expect(r.session.user.id).toBe('u1');
    });

    it('errore e nessuna sessione salvata (token rifiutato, già tolto da Supabase): fuori, si chiede il codice', async () => {
        const gs = vi.fn().mockResolvedValue({ data: { session: null }, error: { message: 'Invalid Refresh Token' } });
        const r = await leggiSessioneAlAvvio(client(gs), { attesaMs: 50 });
        expect(r).toEqual({ session: null, daMemoria: false });
    });

    it('l\'attesa di difetto è di 8 secondi', () => {
        expect(ATTESA_SESSIONE_MS).toBe(8000);
    });
});

describe('chiediMemoriaStabile', () => {
    it('chiede la memoria stabile una volta', async () => {
        const persist = vi.fn().mockResolvedValue(true);
        expect(await chiediMemoriaStabile({ storage: { persisted: vi.fn().mockResolvedValue(false), persist } })).toBe(true);
        expect(persist).toHaveBeenCalledTimes(1);
    });
    it('già concessa: non richiede', async () => {
        const persist = vi.fn();
        expect(await chiediMemoriaStabile({ storage: { persisted: vi.fn().mockResolvedValue(true), persist } })).toBe(true);
        expect(persist).not.toHaveBeenCalled();
    });
    it('Safari nega, manca l\'API o lancia: false, mai un errore', async () => {
        expect(await chiediMemoriaStabile({ storage: { persist: vi.fn().mockResolvedValue(false) } })).toBe(false);
        expect(await chiediMemoriaStabile({})).toBe(false);
        expect(await chiediMemoriaStabile(null)).toBe(false);
        expect(await chiediMemoriaStabile({ storage: { persist: vi.fn().mockRejectedValue(new Error('x')) } })).toBe(false);
    });
});
