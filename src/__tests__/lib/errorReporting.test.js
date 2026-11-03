// AVVISI (L6) — la raccolta degli errori dell'app: senza dati personali, limitata, e mai un errore visibile.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insert = vi.fn();
vi.mock('@/lib/supabase.js', () => ({ supabase: { from: () => ({ insert }), auth: { getSession: vi.fn() } } }));
vi.mock('../../lib/supabase.js', () => ({ supabase: { from: () => ({ insert }), auth: { getSession: vi.fn() } } }));

import { reportError, pulisciMessaggio, eRumore, azzeraSessioneErrori, MAX_ERRORI_PER_SESSIONE, installaRaccoltaErrori } from '../../lib/errorReporting.js';

beforeEach(() => { insert.mockReset(); insert.mockReturnValue(Promise.resolve({ error: null })); azzeraSessioneErrori(); });

describe('errori dell\'app', () => {
    it('scrive pagina (solo il percorso), messaggio e versione; niente utente né user agent', async () => {
        window.history.pushState({}, '', '/mappa?token=segreto&email=a@b.it');
        await reportError(new Error('boom'));
        const r = insert.mock.calls[0][0];
        expect(r.url).toBe('/mappa');
        expect(r.message).toBe('boom');
        expect(r.context).toHaveProperty('versione');
        expect(r.user_id).toBeNull();
        expect(r.user_agent).toBeNull();
    });
    it('toglie email, numeri e query dal messaggio', () => {
        expect(pulisciMessaggio('Errore per mario.rossi@example.com')).toBe('Errore per [email]');
        expect(pulisciMessaggio('chiama +39 333 123 4567')).toContain('[numero]');
        expect(pulisciMessaggio('Failed https://x.it/a/b.js?token=abc')).toBe('Failed https://x.it/a/b.js');
    });
    it('rumore delle estensioni e ResizeObserver non si invia', async () => {
        expect(eRumore('Script error.')).toBe(true);
        await reportError('ResizeObserver loop completed with undelivered notifications.');
        expect(insert).not.toHaveBeenCalled();
    });
    it('non più di MAX_ERRORI_PER_SESSIONE, e lo stesso messaggio una volta', async () => {
        await reportError('uguale'); await reportError('uguale');
        expect(insert).toHaveBeenCalledTimes(1);
        for (let i = 0; i < 30; i++) await reportError(`diverso ${i}`);
        expect(insert).toHaveBeenCalledTimes(MAX_ERRORI_PER_SESSIONE);
    });
    it('se la tabella non c\'è (insert rifiutato o lancia) non esce nessun errore', async () => {
        insert.mockReturnValueOnce(Promise.resolve({ error: { message: 'relation does not exist' } }));
        await expect(reportError('a')).resolves.toBeUndefined();
        insert.mockImplementationOnce(() => { throw new Error('rete'); });
        await expect(reportError('b')).resolves.toBeUndefined();
    });
    it('installa i due ascoltatori una volta sola', () => {
        const t = { addEventListener: vi.fn() };
        installaRaccoltaErrori(t); installaRaccoltaErrori(t);
        expect(t.addEventListener.mock.calls.map((c) => c[0])).toEqual(['error', 'unhandledrejection']);
    });
});
