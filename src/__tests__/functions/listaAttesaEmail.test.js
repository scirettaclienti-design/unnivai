// @vitest-environment node
//
// EMAIL-LANCIO — supabase/functions/lista-attesa-email/index.ts (il file vero) con Resend e Supabase finti.
// Nessuna rete, nessuna email vera.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ID = '3f2b9a40-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
let env, righe, invii, rispostaResend, logs;

/** Un Supabase finto con solo le chiamate che la funzione usa, su una tabella waitlist in memoria. */
function supabaseFinto() {
    return {
        from: (tabella) => {
            if (tabella !== 'waitlist') throw new Error(`tabella inattesa ${tabella}`);
            const q = { filtri: [], aggiorna: null, conta: false };
            const corrispondono = () => righe.filter((r) => q.filtri.every((f) => f(r)));
            const b = {
                select: (_c, opz) => { if (opz?.head) q.conta = true; return b; },
                update: (v) => { q.aggiorna = v; return b; },
                eq: (k, v) => { q.filtri.push((r) => r[k] === v); return b; },
                is: (k, v) => { q.filtri.push((r) => r[k] === v); return b; },
                gte: (k, v) => { q.filtri.push((r) => r[k] != null && r[k] >= v); return b; },
                maybeSingle: async () => {
                    const t = corrispondono();
                    if (q.aggiorna) t.forEach((r) => Object.assign(r, q.aggiorna));
                    return { data: t[0] ? { id: t[0].id, email: t[0].email, city: t[0].city } : null, error: null };
                },
                then: (ok) => {
                    const t = corrispondono();
                    if (q.conta) return Promise.resolve({ count: t.length, error: null }).then(ok);
                    if (q.aggiorna) t.forEach((r) => Object.assign(r, q.aggiorna));
                    return Promise.resolve({ data: null, error: null }).then(ok);
                },
            };
            return b;
        },
    };
}

async function chiama(corpo, metodo = 'POST') {
    vi.resetModules();
    globalThis.__edgeHandler = undefined;
    await import('../../../supabase/functions/lista-attesa-email/index.ts');
    const req = new Request('http://edge.test/lista-attesa-email', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: metodo === 'POST' ? JSON.stringify(corpo) : undefined,
    });
    const r = await globalThis.__edgeHandler(req);
    return { status: r.status, body: await r.json() };
}

beforeEach(() => {
    vi.resetAllMocks();
    env = {
        RESEND_API_KEY: 're_prova_finta',
        LISTA_ATTESA_RISPONDI_A: 'risposte@example.com',
        SUPABASE_URL: 'http://supabase.test',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
    };
    vi.stubGlobal('Deno', { env: { get: (k) => env[k] } });
    righe = [{ id: ID, email: 'anna@example.com', city: 'Bologna', email_inviata_at: null }];
    invii = [];
    rispostaResend = () => new Response(JSON.stringify({ id: 'email-1' }), { status: 200 });
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...a) => logs.push(a.join(' ')));
    vi.spyOn(console, 'error').mockImplementation((...a) => logs.push(a.join(' ')));
    globalThis.__edgeSupabaseFactory = () => supabaseFinto();
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
        if (String(url) !== 'https://api.resend.com/emails') throw new Error(`fetch inatteso: ${url}`);
        invii.push({ headers: init.headers, body: JSON.parse(init.body) });
        return rispostaResend();
    }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('lista-attesa-email', () => {
    it('manda una email con Resend, dal mittente Unnivai, e segna la riga', async () => {
        const r = await chiama({ id: ID });
        expect(r).toEqual({ status: 200, body: { esito: 'mandata' } });
        expect(invii).toHaveLength(1);
        const { headers, body } = invii[0];
        expect(headers.Authorization).toBe('Bearer re_prova_finta');
        expect(headers['Idempotency-Key']).toBe(`lista-attesa-${ID}`);
        expect(body.from).toBe('Unnivai <ciao@unnivai.com>');
        expect(body.to).toEqual(['anna@example.com']);
        expect(body.reply_to).toBe('risposte@example.com');
        expect(body.subject).toBe("Sei nella lista d'attesa di Unnivai");
        expect(body.text).toContain('Ti scrivo quando Unnivai arriva anche a Bologna.');
        expect(body.html).toContain('https://unnivai.vercel.app/brand/logo-email.png'); // ONBOARDING-ACCESSO: il logo PNG del nostro sito
        expect(righe[0].email_inviata_at).toEqual(expect.any(String));
    });
    it('una seconda chiamata per la stessa riga non manda niente', async () => {
        await chiama({ id: ID });
        const r = await chiama({ id: ID });
        expect(r).toEqual({ status: 200, body: { esito: 'niente da mandare' } });
        expect(invii).toHaveLength(1);
    });
    it('un id sconosciuto non manda niente; un corpo non valido è 400', async () => {
        expect((await chiama({ id: '00000000-0000-4000-8000-000000000000' })).body).toEqual({ esito: 'niente da mandare' });
        expect((await chiama({ id: 'anna@example.com' })).status).toBe(400);
        expect((await chiama({})).status).toBe(400);
        expect((await chiama(null, 'GET')).status).toBe(405);
        expect(invii).toHaveLength(0);
    });
    it('senza chiave o senza indirizzo per le risposte non manda niente (503) e la riga resta da mandare', async () => {
        delete env.RESEND_API_KEY;
        expect((await chiama({ id: ID })).status).toBe(503);
        env.RESEND_API_KEY = 're_prova_finta';
        delete env.LISTA_ATTESA_RISPONDI_A;
        expect((await chiama({ id: ID })).status).toBe(503);
        expect(invii).toHaveLength(0);
        expect(righe[0].email_inviata_at).toBeNull();
    });
    it('se Resend sbaglia la riga torna da mandare (502) e una nuova chiamata la manda', async () => {
        rispostaResend = () => new Response('{"message":"domain not verified"}', { status: 403 });
        expect((await chiama({ id: ID })).status).toBe(502);
        expect(righe[0].email_inviata_at).toBeNull();
        rispostaResend = () => new Response('{}', { status: 200 });
        expect((await chiama({ id: ID })).status).toBe(200);
        expect(invii).toHaveLength(2);
    });
    it('il tetto orario ferma gli invii (429) senza toccare la riga', async () => {
        env.LISTA_ATTESA_MAX_ORA = '2';
        const adesso = new Date().toISOString();
        righe.push({ id: 'a', email: 'x@x.it', email_inviata_at: adesso }, { id: 'b', email: 'y@y.it', email_inviata_at: adesso });
        const r = await chiama({ id: ID });
        expect(r).toEqual({ status: 429, body: { esito: 'rimandata' } });
        expect(invii).toHaveLength(0);
        expect(righe[0].email_inviata_at).toBeNull();
    });
    it('nei log mai l\'indirizzo né la chiave', async () => {
        await chiama({ id: ID });
        rispostaResend = () => new Response('{}', { status: 500 });
        righe[0].email_inviata_at = null;
        await chiama({ id: ID });
        const tutto = logs.join('\n');
        expect(tutto).toContain(ID);
        expect(tutto).not.toContain('anna@example.com');
        expect(tutto).not.toContain('re_prova_finta');
    });
});
