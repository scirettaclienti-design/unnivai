// @vitest-environment node
//
// ACCOUNT-PRIVACY — supabase/functions/elimina-account/index.ts (il file vero) con un Supabase finto in memoria.
// Nessuna rete. Il «i dati spariscono davvero» su Postgres vero sta in scripts/test-elimina-account-sql.sh.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const UTENTE = { id: 'aaaaaaaa-0000-0000-0000-000000000001', email: 'anna@example.com' };
let passi, rispostaRpc, rispostaStorage, rispostaDelete, utenteDelToken;

function supabaseFinto() {
    return {
        auth: {
            getUser: async (token) => {
                passi.push(`getUser:${token}`);
                const u = utenteDelToken[token];
                return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: 'invalid' } };
            },
            admin: { deleteUser: async (id) => { passi.push(`deleteUser:${id}`); return { error: rispostaDelete }; } },
        },
        rpc: async (nome, args) => { passi.push(`rpc:${nome}:${JSON.stringify(args)}`); return rispostaRpc(); },
        storage: { from: (b) => ({ remove: async (nomi) => { passi.push(`remove:${b}:${nomi.join(',')}`); return { error: rispostaStorage }; } }) },
    };
}

async function chiama({ token = 'tok-anna', corpo = { conferma: 'elimina' }, metodo = 'POST' } = {}) {
    vi.resetModules();
    globalThis.__edgeHandler = undefined;
    await import('../../../supabase/functions/elimina-account/index.ts');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = new Request('http://edge.test/elimina-account', { method: metodo, headers, body: metodo === 'POST' ? JSON.stringify(corpo) : undefined });
    const r = await globalThis.__edgeHandler(req);
    return { status: r.status, body: await r.json().catch(() => null) };
}

beforeEach(() => {
    vi.resetAllMocks();
    passi = [];
    utenteDelToken = { 'tok-anna': UTENTE };
    rispostaRpc = () => ({ data: { files: [{ bucket: 'tour-images', name: 'a/1.jpg' }, { bucket: 'tour-images', name: 'a/2.jpg' }, { bucket: 'business-media', name: 'a/3.jpg' }], tours: 0 }, error: null });
    rispostaStorage = null;
    rispostaDelete = null;
    const env = { SUPABASE_URL: 'http://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'service-role-test' };
    vi.stubGlobal('Deno', { env: { get: (k) => env[k] } });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.__edgeSupabaseFactory = () => supabaseFinto();
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('elimina-account', () => {
    it('cancella i dati, i file e per ultimo l\'utente di auth, usando l\'id del token', async () => {
        const r = await chiama();
        expect(r).toEqual({ status: 200, body: { esito: 'eliminato' } });
        expect(passi).toEqual([
            'getUser:tok-anna',
            `rpc:elimina_dati_utente:${JSON.stringify({ p_user: UTENTE.id, p_email: UTENTE.email })}`,
            'remove:tour-images:a/1.jpg,a/2.jpg',
            'remove:business-media:a/3.jpg',
            `deleteUser:${UTENTE.id}`,
        ]);
    });

    it('non si fida di un id nel corpo: cancella solo l\'utente del token', async () => {
        const r = await chiama({ corpo: { conferma: 'elimina', user_id: 'bbbbbbbb-0000-0000-0000-000000000002', id: 'bbbbbbbb-0000-0000-0000-000000000002' } });
        expect(r.status).toBe(200);
        expect(passi.join('|')).not.toContain('bbbbbbbb');
    });

    it('senza token: 401 e non tocca niente', async () => {
        const r = await chiama({ token: null });
        expect(r.status).toBe(401);
        expect(passi).toEqual([]);
    });

    it('token non valido: 401 e non cancella', async () => {
        const r = await chiama({ token: 'finto' });
        expect(r.status).toBe(401);
        expect(passi).toEqual(['getUser:finto']);
    });

    it('senza la conferma: 400 e non cancella', async () => {
        for (const corpo of [{}, { conferma: '' }, { conferma: 'si' }, { conferma: true }]) {
            passi = [];
            const r = await chiama({ corpo });
            expect(r.status).toBe(400);
            expect(r.body.code).toBe('CONFERMA_MANCANTE');
            expect(passi).toEqual(['getUser:tok-anna']);
        }
    });

    it('accetta la parola di conferma in maiuscolo e con spazi', async () => {
        const r = await chiama({ corpo: { conferma: '  ELIMINA ' } });
        expect(r.status).toBe(200);
    });

    it('solo POST', async () => {
        const r = await chiama({ metodo: 'GET' });
        expect(r.status).toBe(405);
        expect(passi).toEqual([]);
    });

    it('la funzione SQL non c\'è ancora: 503 MIGRAZIONE_MANCANTE, l\'utente non si tocca', async () => {
        rispostaRpc = () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.elimina_dati_utente' } });
        const r = await chiama();
        expect(r.status).toBe(503);
        expect(r.body.code).toBe('MIGRAZIONE_MANCANTE');
        expect(passi.some((p) => p.startsWith('deleteUser'))).toBe(false);
    });

    it('i dati non si cancellano: 500 DATI, né file né utente toccati', async () => {
        rispostaRpc = () => ({ data: null, error: { code: '23503', message: 'foreign key violation' } });
        const r = await chiama();
        expect(r.status).toBe(500);
        expect(r.body.code).toBe('DATI');
        expect(passi.filter((p) => p.startsWith('remove') || p.startsWith('deleteUser'))).toEqual([]);
    });

    it('i file non si tolgono: 500 STORAGE, l\'utente resta (si può rifare)', async () => {
        rispostaStorage = { message: 'boom' };
        const r = await chiama();
        expect(r.status).toBe(500);
        expect(r.body.code).toBe('STORAGE');
        expect(passi.some((p) => p.startsWith('deleteUser'))).toBe(false);
    });

    it('l\'utente di auth non si cancella: 500 ACCOUNT, mai un «eliminato»', async () => {
        rispostaDelete = { message: 'boom' };
        const r = await chiama();
        expect(r.status).toBe(500);
        expect(r.body.code).toBe('ACCOUNT');
        expect(r.body.esito).toBeUndefined();
    });

    it('nei log niente email né token', async () => {
        const logs = [];
        console.log.mockImplementation((...a) => logs.push(a.join(' ')));
        console.error.mockImplementation((...a) => logs.push(a.join(' ')));
        await chiama();
        rispostaDelete = { message: 'boom' };
        await chiama();
        const tutto = logs.join('\n');
        expect(tutto).not.toContain('anna@example.com');
        expect(tutto).not.toContain('tok-anna');
        expect(tutto).not.toContain(UTENTE.id);
    });
});
