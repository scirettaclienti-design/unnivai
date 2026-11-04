// @vitest-environment node
//
// LINK-DOMINIO — i link nuovi delle email (?token_hash=…&type=…) li verifica l'app; senza parametri non si chiama nessuno.
import { describe, it, expect, vi } from 'vitest';
import { verificaLinkEmail, DOVE_LINK_RECUPERO, DOVE_LINK_SCADUTO } from '@/lib/linkEmail';

const prova = (url, risposta) => {
    const u = new URL(`https://unnivai.vercel.app${url}`);
    const location = { pathname: u.pathname, search: u.search, hash: u.hash };
    const indirizzi = [];
    const history = { state: null, replaceState: vi.fn((_s, _t, nuovo) => indirizzi.push(nuovo)) };
    const verifyOtp = vi.fn(async () => risposta);
    return { supabase: { auth: { verifyOtp } }, location, history, verifyOtp, indirizzi };
};
const USER = { id: 'u1', email: 'a@b.it' };

describe('verificaLinkEmail', () => {
    it('recovery ok: verifica con token_hash e type, ritorna ok/recovery e toglie i parametri', async () => {
        const t = prova('/update-password?token_hash=hash-rec&type=recovery', { data: { user: USER, session: {} }, error: null });
        const r = await verificaLinkEmail(t.supabase, t.location, t.history);
        expect(t.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash-rec', type: 'recovery' });
        expect(r).toEqual({ esito: 'ok', tipo: 'recovery', user: USER });
        expect(t.indirizzi).toEqual(['/update-password']);
    });
    it('email ok (conferma e accesso): ritorna l\'utente, il resto dell\'indirizzo resta', async () => {
        const t = prova('/login?token_hash=hash-mail&type=email&x=1#a', { data: { user: USER, session: {} }, error: null });
        const r = await verificaLinkEmail(t.supabase, t.location, t.history);
        expect(t.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash-mail', type: 'email' });
        expect(r).toEqual({ esito: 'ok', tipo: 'email', user: USER });
        expect(t.indirizzi).toEqual(['/login?x=1#a']);
    });
    it('email con errore: manda al login con il messaggio di link scaduto', async () => {
        const t = prova('/login?token_hash=hash-ko&type=email', { data: { user: null, session: null }, error: { message: 'Token has expired' } });
        const r = await verificaLinkEmail(t.supabase, t.location, t.history);
        expect(r).toEqual({ esito: 'errore', tipo: 'email', dove: DOVE_LINK_SCADUTO });
        expect(t.indirizzi).toEqual(['/login', DOVE_LINK_SCADUTO]);
    });
    it('recovery con errore (anche se verifyOtp lancia): manda a /login?recupero=1', async () => {
        const t = prova('/update-password?token_hash=finto&type=recovery', null);
        t.verifyOtp.mockRejectedValueOnce(new Error('rete'));
        const r = await verificaLinkEmail(t.supabase, t.location, t.history);
        expect(r).toEqual({ esito: 'errore', tipo: 'recovery', dove: DOVE_LINK_RECUPERO });
        expect(DOVE_LINK_RECUPERO).toBe('/login?recupero=1');
        expect(t.indirizzi.at(-1)).toBe('/login?recupero=1');
    });
    it('senza parametri, o con un tipo che non è nostro: nessuna chiamata, indirizzo intatto', async () => {
        for (const url of ['/login', '/login?token_hash=x', '/login?type=email', '/login?token_hash=x&type=email_change']) {
            const t = prova(url, { data: {}, error: null });
            expect(await verificaLinkEmail(t.supabase, t.location, t.history)).toEqual({ esito: 'nessuno' });
            expect(t.verifyOtp).not.toHaveBeenCalled();
            expect(t.history.replaceState).not.toHaveBeenCalled();
        }
    });
    it('lo stesso link verificato due volte (React in sviluppo) chiama verifyOtp una volta sola', async () => {
        const t = prova('/login?token_hash=hash-doppio&type=email', { data: { user: USER }, error: null });
        const [a, b] = await Promise.all([
            verificaLinkEmail(t.supabase, t.location, t.history),
            verificaLinkEmail(t.supabase, t.location, t.history),
        ]);
        expect(t.verifyOtp).toHaveBeenCalledTimes(1);
        expect(a).toBe(b);
    });
});
