/**
 * ONBOARDING-ACCESSO — un Supabase finto per le prove WebKit di registrazione, accesso, recupero password, ospite e primo
 * ingresso. Intercetta solo l'host del progetto (auth, rest, funzioni): nessuna email vera, nessuna scrittura sul server
 * vero, nessuna credenziale. Lo stato (utenti, metadati, seme del primo ingresso, registro del DNA) vive in questo
 * processo: due contesti WebKit diversi = due telefoni che parlano allo stesso «server».
 *
 * Le email non partono: finiscono in `srv.posta` (link di conferma, link di recupero, codice di 6 cifre).
 * Codici (accesso e ospite): 123456 giusto, ogni altro sbagliato o scaduto.
 */

const HOST = /https:\/\/[a-z0-9]+\.supabase\.co\//;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

export function creaServer() {
    const srv = { utenti: new Map(), preferenze: new Map(), dna: new Map(), giri: new Map(), posta: [], chiamate: [], n: 0 };

    srv.nuovoUtente = ({ email = null, password = null, confermato = false, anonimo = false, meta = {} } = {}) => {
        const id = `00000000-0000-4000-8000-${String(++srv.n).padStart(12, '0')}`;
        const u = { id, email, password, confermato, anonimo, meta: { ...meta }, emailNuova: null, creato: new Date().toISOString() };
        srv.utenti.set(id, u);
        return u;
    };
    srv.perEmail = (email) => [...srv.utenti.values()].find(u => u.email && u.email.toLowerCase() === String(email || '').toLowerCase()) || null;

    srv.utenteJson = (u) => ({
        id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email || '', phone: '',
        email_confirmed_at: u.confermato ? u.creato : null, confirmed_at: u.confermato ? u.creato : null,
        new_email: u.emailNuova || undefined,
        is_anonymous: u.anonimo, app_metadata: { provider: u.anonimo ? 'anonymous' : 'email', providers: u.anonimo ? [] : ['email'] },
        user_metadata: u.meta, identities: u.anonimo ? [] : [{ id: u.id, user_id: u.id, provider: 'email', identity_data: { email: u.email, sub: u.id } }],
        created_at: u.creato, updated_at: new Date().toISOString(),
    });
    srv.token = (u) => {
        const exp = Math.floor(Date.now() / 1000) + 3600;
        return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: u.id, email: u.email || '', role: 'authenticated', aud: 'authenticated', is_anonymous: u.anonimo, exp, iat: exp - 3600, user_metadata: u.meta })}.finta`;
    };
    srv.sessione = (u) => {
        const expires_in = 3600;
        return { access_token: srv.token(u), token_type: 'bearer', expires_in, expires_at: Math.floor(Date.now() / 1000) + expires_in, refresh_token: `r-${u.id}`, user: srv.utenteJson(u) };
    };
    /** Il frammento che Supabase mette nel link delle email (flusso implicito). */
    srv.frammento = (u, type) => {
        const s = srv.sessione(u);
        return `#access_token=${s.access_token}&expires_at=${s.expires_at}&expires_in=${s.expires_in}&refresh_token=${s.refresh_token}&token_type=bearer&type=${type}`;
    };
    srv.daToken = (req) => {
        const h = req.headers()['authorization'] || '';
        const t = h.replace(/^Bearer\s+/i, '');
        try { return srv.utenti.get(JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).sub) || null; } catch { return null; }
    };
    srv.ultimaPosta = (tipo, a) => [...srv.posta].reverse().find(m => m.tipo === tipo && (!a || m.a === a)) || null;
    return srv;
}

const json = (route, status, body, extra = {}) => route.fulfill({
    status, contentType: 'application/json', headers: { 'x-supabase-api-version': '2024-01-01', 'access-control-allow-origin': '*', ...extra },
    body: body === undefined ? '' : JSON.stringify(body),
});
const errore = (route, status, code, msg) => json(route, status, { code, error_code: code, msg, message: msg });

/** Collega il server finto a un contesto WebKit. Blocca anche Google (mappe, luoghi) e Nominatim: 0 $. */
export async function collegaServer(ctx, srv) {
    await ctx.route(/maps\.googleapis\.com|places\.googleapis\.com|nominatim\.openstreetmap\.org|maps\.gstatic\.com/, (r) => r.abort());
    await ctx.route(HOST, async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        const p = url.pathname;
        const metodo = req.method();
        if (metodo === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
        let corpo = {};
        try { corpo = req.postDataJSON() || {}; } catch { corpo = {}; }
        srv.chiamate.push(`${metodo} ${p}${url.search ? url.search.slice(0, 60) : ''}`);

        // ─── Auth ───
        if (p === '/auth/v1/token') {
            const tipo = url.searchParams.get('grant_type');
            if (tipo === 'refresh_token') {
                if (srv.ritardo) await new Promise((r) => setTimeout(r, srv.ritardo)); // rete lenta: per vedere il caricamento
                const u = srv.utenti.get(String(corpo.refresh_token || '').replace(/^r-/, ''));
                return u ? json(route, 200, srv.sessione(u)) : errore(route, 400, 'refresh_token_not_found', 'Invalid Refresh Token');
            }
            const u = srv.perEmail(corpo.email);
            if (!u || u.password !== corpo.password) return errore(route, 400, 'invalid_credentials', 'Invalid login credentials');
            if (!u.confermato) return errore(route, 400, 'email_not_confirmed', 'Email not confirmed');
            return json(route, 200, srv.sessione(u));
        }
        if (p === '/auth/v1/signup') {
            if (!corpo.email) { // signInAnonymously
                if (srv.anonimiSpenti) return errore(route, 422, 'anonymous_provider_disabled', 'Anonymous sign-ins are disabled');
                const u = srv.nuovoUtente({ anonimo: true, meta: corpo.data || {} });
                return json(route, 200, srv.sessione(u));
            }
            const gia = srv.perEmail(corpo.email);
            if (gia) { // Supabase non rivela l'account: utente finto senza identità
                return json(route, 200, { ...srv.utenteJson(gia), id: '00000000-0000-4000-8000-ffffffffffff', identities: [] });
            }
            const u = srv.nuovoUtente({ email: corpo.email, password: corpo.password, meta: corpo.data || {} });
            srv.posta.push({ tipo: 'conferma', a: u.email, id: u.id, redirect: url.searchParams.get('redirect_to') });
            return json(route, 200, srv.utenteJson(u));
        }
        if (p === '/auth/v1/otp') { // signInWithOtp: il codice per email (account nuovo → «confirmation», esistente → «magic_link»)
            let u = srv.perEmail(corpo.email);
            if (!u && corpo.create_user === false) return errore(route, 422, 'otp_disabled', 'Signups not allowed for otp');
            if (!u) u = srv.nuovoUtente({ email: corpo.email, meta: corpo.data || {} });
            srv.posta.push({ tipo: u.confermato ? 'codice-accesso' : 'codice-conferma', a: u.email, id: u.id, codice: '123456' });
            return json(route, 200, {});
        }
        if (p === '/auth/v1/recover') {
            const u = srv.perEmail(corpo.email);
            if (u) srv.posta.push({ tipo: 'recupero', a: u.email, id: u.id, redirect: url.searchParams.get('redirect_to') });
            return json(route, 200, {});
        }
        if (p === '/auth/v1/user') {
            const u = srv.daToken(req);
            if (!u) return errore(route, 401, 'session_not_found', 'Session not found');
            if (metodo === 'PUT') {
                if (corpo.data) u.meta = { ...u.meta, ...corpo.data };
                if (corpo.email) {
                    if (srv.perEmail(corpo.email)) return errore(route, 422, 'email_exists', 'A user with this email address has already been registered');
                    u.emailNuova = corpo.email;
                    srv.posta.push({ tipo: 'codice', a: corpo.email, id: u.id, codice: '123456' });
                }
                if (corpo.password) {
                    if (corpo.password === u.password) return errore(route, 422, 'same_password', 'New password should be different from the old password.');
                    u.password = corpo.password;
                }
            }
            return json(route, 200, srv.utenteJson(u));
        }
        if (p === '/auth/v1/verify' && corpo.type === 'email') {
            const u = srv.perEmail(corpo.email);
            if (!u || corpo.token !== '123456') return errore(route, 403, 'otp_expired', 'Token has expired or is invalid');
            u.confermato = true;
            return json(route, 200, srv.sessione(u));
        }
        if (p === '/auth/v1/verify') {
            const u = [...srv.utenti.values()].find(x => x.emailNuova && x.emailNuova === corpo.email);
            if (!u || corpo.token === '000000') return errore(route, 403, 'otp_expired', 'Token has expired or is invalid');
            if (corpo.token !== '123456') return errore(route, 403, 'otp_expired', 'Token has expired or is invalid');
            u.email = u.emailNuova; u.emailNuova = null; u.anonimo = false; u.confermato = true;
            return json(route, 200, srv.sessione(u));
        }
        if (p === '/auth/v1/logout') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        if (p.startsWith('/auth/v1/')) return json(route, 200, {});

        // ─── Rest ───
        if (p.startsWith('/rest/v1/')) {
            const tabella = p.slice('/rest/v1/'.length);
            const u = srv.daToken(req);
            const oggetto = /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
            if (tabella === 'user_preferences') {
                if (metodo === 'GET') {
                    const riga = u ? srv.preferenze.get(u.id) : null;
                    if (oggetto) return riga ? json(route, 200, riga) : errore(route, 406, 'PGRST116', 'no rows');
                    return json(route, 200, riga ? [riga] : []);
                }
                if (u) {
                    const righe = Array.isArray(corpo) ? corpo : [corpo];
                    for (const r of righe) srv.preferenze.set(u.id, { ...(srv.preferenze.get(u.id) || { user_id: u.id }), ...r, user_id: u.id });
                }
                return json(route, 201, oggetto ? srv.preferenze.get(u?.id) || null : []);
            }
            if (tabella === 'dna_events') {
                const righe = u ? (srv.dna.get(u.id) || []) : [];
                if (metodo === 'GET') return json(route, 200, [...righe].sort((a, b) => b.created_at.localeCompare(a.created_at)));
                if (u) {
                    const nuove = (Array.isArray(corpo) ? corpo : [corpo]).map((r, i) => ({ id: `e${Date.now()}${i}`, created_at: new Date().toISOString(), ...r }));
                    srv.dna.set(u.id, [...righe, ...nuove]);
                    return json(route, 201, oggetto ? nuove[0] : nuove);
                }
                return json(route, 201, []);
            }
            // PROFILO-SEZIONI — saved_tours: i giri salvati e quelli finiti («fatto-…»), con i filtri che usa l'app
            if (tabella === 'saved_tours') {
                const righe = u ? (srv.giri.get(u.id) || []) : [];
                if (metodo === 'GET') {
                    const f = new URL(req.url()).searchParams.get('tour_id') || '';
                    const fatto = (r) => r.tour_id.startsWith('fatto-');
                    const scelte = f.startsWith('like.') ? righe.filter(fatto) : f.startsWith('not.like.') ? righe.filter(r => !fatto(r)) : righe;
                    return json(route, 200, [...scelte].sort((a, b) => b.created_at.localeCompare(a.created_at)));
                }
                if (metodo === 'DELETE') { const id = (new URL(req.url()).searchParams.get('id') || '').replace('eq.', ''); srv.giri.set(u?.id, righe.filter(r => r.id !== id)); return json(route, 204); }
                if (u) srv.giri.set(u.id, [...righe, ...(Array.isArray(corpo) ? corpo : [corpo]).map((r, i) => ({ id: `g${Date.now()}${i}`, created_at: new Date().toISOString(), ...r }))]);
                return json(route, 201, []);
            }
            if (tabella.startsWith('rpc/')) return json(route, 200, null);
            if (metodo === 'GET') return oggetto ? errore(route, 406, 'PGRST116', 'no rows') : json(route, 200, []);
            return json(route, 201, oggetto ? null : []);
        }
        // ─── Funzioni (AI, luoghi): ferme, senza costi ───
        if (p.startsWith('/functions/v1/')) return errore(route, 503, 'finto', 'servizio finto');
        return route.fulfill({ status: 404, body: '' });
    });
}
