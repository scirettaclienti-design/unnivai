/**
 * LOGIN-SESSIONE (T26) — «l'app mi chiede il codice a ogni accesso»: la sessione resta dopo la chiusura?
 * iPhone 14 (WebKit). Il «telefono» che si chiude e si riapre è un contesto nuovo che riparte da `storageState`
 * (= la memoria del sito che Safari conserva: localStorage, cookie).
 *
 *   LS_BASE=http://localhost:<porta> LS_OUT=docs/prove/dati/login-sessione LS_MODO=vero|finto \
 *     node scripts/prova-nav/login-sessione.webkit.mjs
 *
 * LS_MODO=vero  → account di prova di .env.local, password («Hai una password? Accedi →»), Supabase vero. Verifica la
 *                 persistenza del token. Le credenziali non si stampano. Prima: porta e titolo (CLAUDE.md).
 * LS_MODO=finto → Supabase finto (supabase-finto.mjs, 0 $): il flusso del codice e i guasti di rete al riavvio.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { conVoceTelefono } from './voce-telefono.mjs';
import { creaServer, collegaServer } from './supabase-finto.mjs';

const BASE = (process.env.LS_BASE || 'http://localhost:5391').replace(/\/$/, '');
const MODO = process.env.LS_MODO || 'finto';
const OUT = path.resolve(process.env.LS_OUT || 'docs/prove/dati/login-sessione');
fs.mkdirSync(OUT, { recursive: true });

const env = {};
if (fs.existsSync('.env.local')) for (const r of fs.readFileSync('.env.local', 'utf8').split('\n')) { const m = r.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); }

const IPHONE = { ...devices['iPhone 14'], deviceScaleFactor: 2, locale: 'it-IT', timezoneId: 'Europe/Rome', permissions: ['geolocation'], geolocation: { latitude: 41.8986, longitude: 12.4769 } };
const esiti = { base: BASE, modo: MODO, iniziato: new Date().toISOString(), prove: {} };
const salva = () => fs.writeFileSync(path.join(OUT, `esiti-${MODO}.json`), JSON.stringify(esiti, null, 1));
const browser = conVoceTelefono(await webkit.launch());
const attesa = (page, ms = 900) => page.waitForTimeout(ms);
const visibile = async (loc, ms = 1500) => { try { await loc.first().waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; } };
const pathOf = (page) => new URL(page.url()).pathname;

let srv = null;
const PW = 'Giro2026ok';
if (MODO === 'finto') {
    srv = creaServer();
    const u = srv.nuovoUtente({ email: 'marta@prova.unnivai.it', password: PW, confermato: true, meta: { full_name: 'Marta', role: 'explorer', consenso_ai: { v: 1, at: '2026-10-01T10:00:00Z' } } });
    srv.preferenze.set(u.id, { user_id: u.id, onboarding_seed: { v: 2, interessi: ['food'], vincoli: { dieta: [], budget: null }, gusti: { stile: 'trattoria' } } });
}
const EMAIL = MODO === 'vero' ? env.TEST_ACCOUNT_EMAIL : 'marta@prova.unnivai.it';
const PASSWORD = MODO === 'vero' ? env.TEST_ACCOUNT_PASSWORD : PW;

async function telefono(storageState) {
    const ctx = await browser.newContext({ ...IPHONE, ...(storageState ? { storageState } : {}) });
    if (srv) await collegaServer(ctx, srv);
    const page = await ctx.newPage();
    const visti = [];
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) visti.push(new URL(f.url()).pathname); });
    return { ctx, page, visti };
}
async function foto(page, nome) { await attesa(page, 600); await page.screenshot({ path: path.join(OUT, `${MODO}-${nome}.jpg`), type: 'jpeg', quality: 42 }); return `${MODO}-${nome}.jpg`; }
async function consensoAi(page) { const ok = page.getByTestId('consenso-ai-ok'); try { await ok.waitFor({ timeout: 4000 }); await ok.click(); await attesa(page, 500); } catch { /* già dato */ } }
const entraConPassword = async (page) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/Unnivai|DoveVai/i.test(await page.title())) throw new Error('titolo non Unnivai: niente credenziali');
    await attesa(page, 1200);
    await page.getByTestId('accesso-con-password').click();
    await page.getByPlaceholder(/Email/i).first().fill(EMAIL);
    await page.getByPlaceholder(/^Password$/i).first().fill(PASSWORD);
    await page.getByTestId('accesso-invia').click();
    await page.waitForURL((u) => /dashboard-user|\/onboarding/.test(u.pathname), { timeout: 30000 });
    await consensoAi(page);
    await attesa(page, 1500);
};
/** Il codice di Supabase (finto: 123456). */
const entraConCodice = async (page) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await attesa(page, 1200);
    await page.getByPlaceholder(/Email/i).first().fill(EMAIL);
    await page.getByTestId('accesso-invia').click();
    await page.getByTestId('accesso-codice-campo').waitFor({ timeout: 8000 });
    await page.getByTestId('accesso-codice-campo').fill('123456');
    await page.getByTestId('accesso-invia').click();
    await page.waitForURL((u) => /dashboard-user|\/onboarding/.test(u.pathname), { timeout: 20000 });
    await consensoAi(page);
    await attesa(page, 1500);
};
const chiave = (page) => page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^sb-.*-auth-token$/.test(x)); return k ? { k, v: JSON.parse(localStorage.getItem(k)) } : null; });
const siFermaAlLogin = async (page) => /\/login/.test(pathOf(page)) || (await visibile(page.getByTestId('accesso-invia'), 800));
const dentro = (page, visti) => /dashboard-user/.test(pathOf(page)) && !visti.slice(1).includes('/login');
const esci = async (page) => { await page.getByLabel('Esci').first().click(); await attesa(page, 1500); };

async function prova(id, titolo, fn) {
    const p = esiti.prove[id] = { titolo, ok: false, note: [] };
    try { await fn(p); } catch (e) { p.errore = String(e?.message || e).split('\n')[0].slice(0, 220); }
    console.log(`${id} ${p.ok ? 'ok' : 'NO'} ${titolo}`, p.errore || p.note.join(' | '));
    salva();
}

try {
    if (MODO === 'vero') {
        if (!EMAIL || !PASSWORD) throw new Error('mancano le credenziali di prova');
        const c0 = await browser.newContext(); const p0 = await c0.newPage();
        await p0.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
        const titolo = await p0.title(); await c0.close();
        if (!/Unnivai|DoveVai/i.test(titolo)) throw new Error(`titolo «${titolo}»: niente credenziali`);
    }

    // ── A. Accesso, chiusura, riapertura: si entra senza codice ──
    let memoria = null;
    await prova('A', 'accesso, chiudo il browser, riapro con la memoria del sito: dentro senza codice', async (p) => {
        const t1 = await telefono();
        if (MODO === 'vero') await entraConPassword(t1.page); else await entraConCodice(t1.page);
        await foto(t1.page, 'A1-dentro');
        const k = await chiave(t1.page);
        p.token = k ? { chiave: k.k.replace(/sb-[a-z0-9]+-/, 'sb-<progetto>-'), scadeFraS: Math.round(k.v.expires_at - Date.now() / 1000), haRefreshToken: !!k.v.refresh_token } : null;
        memoria = await t1.ctx.storageState();
        await t1.ctx.close();                                   // «chiudo Safari»
        const t2 = await telefono(memoria);
        await t2.page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
        await t2.page.waitForURL((u) => /dashboard-user/.test(u.pathname), { timeout: 20000 }).catch(() => {});
        await attesa(t2.page, 1500);
        await foto(t2.page, 'A2-riaperto');
        p.url = pathOf(t2.page); p.visti = [...new Set(t2.visti)];
        p.ok = dentro(t2.page, t2.visti) && !(await siFermaAlLogin(t2.page));
        await t2.ctx.close();
    });

    // ── B. Riapro dopo ore: il token d'accesso è scaduto, serve il rinnovo ──
    await prova('B', 'riapro dopo ore (token d\'accesso scaduto): si rinnova da solo, nessun codice', async (p) => {
        if (!memoria) throw new Error('serve la prova A');
        const stato = JSON.parse(JSON.stringify(memoria));
        let toccato = false;
        for (const o of stato.origins) for (const e of o.localStorage) if (/^sb-.*-auth-token$/.test(e.name)) {
            const v = JSON.parse(e.value); v.expires_at = Math.floor(Date.now() / 1000) - 7200; e.value = JSON.stringify(v); toccato = true;
        }
        if (!toccato) throw new Error('nessun token nella memoria');
        const t = await telefono(stato);
        await t.page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
        await t.page.waitForURL((u) => /dashboard-user/.test(u.pathname), { timeout: 25000 }).catch(() => {});
        await attesa(t.page, 1500);
        await foto(t.page, 'B1-dopo-ore');
        p.url = pathOf(t.page); p.visti = [...new Set(t.visti)];
        const k = await chiave(t.page);
        p.rinnovato = !!k && k.v.expires_at > Date.now() / 1000 + 600;
        p.ok = dentro(t.page, t.visti) && p.rinnovato;
        await t.ctx.close();
    });

    // ── C. Riavvio con la rete che cade (galleria, treno): non è un «esci» ──
    await prova('C', 'riapro dopo ore con la rete assente: entro 14 s si è dentro con la sessione salvata, mai la schermata del codice; torna la rete, resta dentro', async (p) => {
        if (!memoria) throw new Error('serve la prova A');
        const stato = JSON.parse(JSON.stringify(memoria));
        for (const o of stato.origins) for (const e of o.localStorage) if (/^sb-.*-auth-token$/.test(e.name)) { const v = JSON.parse(e.value); v.expires_at = Math.floor(Date.now() / 1000) - 7200; e.value = JSON.stringify(v); }
        const t = await telefono(stato);
        let rete = false;                                        // false = il rinnovo non passa
        await t.ctx.route(/\/auth\/v1\/token\?grant_type=refresh_token/, async (r) => { if (!rete) return r.abort('connectionfailed'); return r.fallback(); });
        await t.page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
        await t.page.waitForURL((u) => /dashboard-user/.test(u.pathname), { timeout: 14000 }).catch(() => {});
        await attesa(t.page, 1500);
        await foto(t.page, 'C1-senza-rete');
        const sulLogin = /\/login/.test(pathOf(t.page));
        p.senzaRete = { url: pathOf(t.page), schermataCodice: sulLogin, dentroSenzaRete: /dashboard-user/.test(pathOf(t.page)) };
        const dentroOffline = /dashboard-user/.test(pathOf(t.page));
        rete = true;                                              // «torna il segnale»
        await t.page.reload({ waitUntil: 'domcontentloaded' });
        await t.page.waitForURL((u) => /dashboard-user/.test(u.pathname), { timeout: 20000 }).catch(() => {});
        await attesa(t.page, 1500);
        await foto(t.page, 'C2-torna-la-rete');
        p.conRete = { url: pathOf(t.page) };
        p.ok = dentroOffline && !sulLogin && /dashboard-user/.test(pathOf(t.page));
        await t.ctx.close();
    });

    // ── D. «Esci» qui non butta fuori gli altri telefoni (solo vero: usa il token del server) ──
    if (MODO === 'vero') {
        await prova('D', '«Esci» sul telefono 1 lascia il telefono 2 dentro (il rinnovo del telefono 2 va ancora)', async (p) => {
            const a = await telefono(); await entraConPassword(a.page);
            const b = await telefono(); await entraConPassword(b.page);
            await esci(a.page);
            // il telefono 2 riapre dopo ore: deve poter rinnovare il suo token
            const stB = await b.ctx.storageState();
            for (const o of stB.origins) for (const e of o.localStorage) if (/^sb-.*-auth-token$/.test(e.name)) { const v = JSON.parse(e.value); v.expires_at = Math.floor(Date.now() / 1000) - 7200; e.value = JSON.stringify(v); }
            await b.ctx.close();
            const b2 = await telefono(stB);
            await b2.page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
            await b2.page.waitForURL((u) => /dashboard-user/.test(u.pathname), { timeout: 25000 }).catch(() => {});
            await attesa(b2.page, 1500);
            await foto(b2.page, 'D1-telefono2-dopo-esci-sul-1');
            p.url = pathOf(b2.page);
            p.ok = dentro(b2.page, b2.visti);
            await a.ctx.close(); await b2.ctx.close();
        });
    }

    // ── E. Dopo «Esci» il codice torna ──
    await prova('E', 'dopo «Esci» riaprendo si torna al login (codice)', async (p) => {
        const t1 = await telefono();
        if (MODO === 'vero') await entraConPassword(t1.page); else await entraConCodice(t1.page);
        await esci(t1.page);
        await foto(t1.page, 'E1-dopo-esci');
        const st = await t1.ctx.storageState();
        p.restaToken = JSON.stringify(st).includes('-auth-token"');
        await t1.ctx.close();
        const t2 = await telefono(st);
        await t2.page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
        await attesa(t2.page, 2000);
        await foto(t2.page, 'E2-riaperto');
        p.url = pathOf(t2.page);
        p.ok = !p.restaToken && /\/login/.test(pathOf(t2.page)) && await visibile(t2.page.getByTestId('accesso-invia'), 3000);
        await t2.ctx.close();
    });
} finally {
    esiti.finito = new Date().toISOString();
    salva();
    await browser.close();
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(esiti.prove).map(([k, v]) => [k, v.ok])), null, 0));
