/**
 * ONBOARDING-ACCESSO — i percorsi d'ingresso col Supabase VERO (WebKit, iPhone 14, voce del telefono, 0 $ di AI).
 *
 * Oggi (senza email vere):  node scripts/prova-nav/onboarding-accesso-vero.webkit.mjs
 *   accesso esistente con l'account di prova (.env.local, mai stampato) su due telefoni diversi: dritto alla home,
 *   mai /onboarding, mai la finestra del consenso; poi «esci» e secondo accesso sullo stesso telefono.
 *
 * Dopo PASSI-IVANO (SMTP/Resend attivi, modelli col codice caricati, accessi anonimi accesi), UN comando:
 *   PROVA_EMAIL=<indirizzo di prova di Ivano> node scripts/prova-nav/onboarding-accesso-vero.webkit.mjs --tutto
 *   in più: utente nuovo con email e codice (PROVA_EMAIL con +nuovo<ora>), primo ingresso UNA volta (secondo telefono:
 *   niente), password dimenticata → codice (account di prova), ospite → primo ingresso → «Salva questo giro» →
 *   codice → stesso id → altro telefono senza primo ingresso. I codici li scrive chi legge la posta nel file
 *   CODICE_FILE (di difetto $TMPDIR/codice-onboarding), uno alla volta: lo script dice quale aspetta.
 *
 * ONB_BASE (di difetto https://unnivai.vercel.app) — anche una build locale o un'anteprima Vercel. Prima delle credenziali:
 * titolo «Unnivai» verificato (CLAUDE.md). Esiti in docs/prove/dati/onboarding/vero/esiti.json, schermate accanto.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { conVoceTelefono } from './voce-telefono.mjs';

const BASE = (process.env.ONB_BASE || 'https://unnivai.vercel.app').replace(/\/$/, '');
const TUTTO = process.argv.includes('--tutto');
const OUT = path.resolve(process.env.ONB_OUT || 'docs/prove/dati/onboarding/vero');
const CODICE_FILE = process.env.CODICE_FILE || path.join(os.tmpdir(), 'codice-onboarding');
fs.mkdirSync(OUT, { recursive: true });

const env = Object.fromEntries((fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '').split('\n')
    .map((r) => r.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]));
if (!env.TEST_ACCOUNT_EMAIL || !env.TEST_ACCOUNT_PASSWORD) throw new Error('mancano le credenziali di prova in .env.local');
if (TUTTO && !process.env.PROVA_EMAIL) throw new Error('--tutto vuole PROVA_EMAIL (l\'indirizzo di prova di Ivano)');

const IPHONE = { ...devices['iPhone 14'], deviceScaleFactor: 2, locale: 'it-IT', timezoneId: 'Europe/Rome', permissions: ['geolocation'], geolocation: { latitude: 37.5027, longitude: 15.0873 } };
const browser = conVoceTelefono(await webkit.launch());
const esiti = { base: BASE, tutto: TUTTO, iniziato: new Date().toISOString(), passi: {} };
const salva = () => fs.writeFileSync(path.join(OUT, 'esiti.json'), JSON.stringify(esiti, null, 1));

async function telefono() {
    const ctx = await browser.newContext(IPHONE);
    // niente Google (mappe, luoghi): l'ingresso non ne ha bisogno, 0 $
    await ctx.route(/maps\.googleapis\.com|places\.googleapis\.com|maps\.gstatic\.com/, (r) => r.abort());
    const page = await ctx.newPage();
    const visti = [];
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) visti.push(new URL(f.url()).pathname); });
    return { ctx, page, visti };
}
const foto = async (page, nome) => { await page.waitForTimeout(700); await page.screenshot({ path: path.join(OUT, `${nome}.jpg`), type: 'jpeg', quality: 42 }); return nome; };
async function titoloOk(page) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    const t = await page.title();
    if (!/Unnivai|DoveVai/i.test(t)) throw new Error(`titolo «${t}» non Unnivai: niente credenziali`);
    await page.waitForTimeout(1200);
}
async function conPassword(page, email, password) {
    await titoloOk(page);
    await page.getByText('Accedi →').click();
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByText('Accedi ora').click();
}
async function aspettaCodice(per) {
    try { fs.unlinkSync(CODICE_FILE); } catch { /* non c'era */ }
    console.log(`ASPETTO IL CODICE (${per}): scrivi le cifre in ${CODICE_FILE}`);
    for (let i = 0; i < 600; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        try { const c = fs.readFileSync(CODICE_FILE, 'utf8').trim().match(/^\d{6,10}$/)?.[0]; if (c) { fs.unlinkSync(CODICE_FILE); return c; } } catch { /* non ancora */ }
    }
    throw new Error('codice non arrivato in 10 minuti');
}
async function conCodice(page, email, per) {
    await titoloOk(page);
    await page.getByPlaceholder('Email').fill(email);
    await page.getByTestId('accesso-invia').click();
    await page.getByTestId('accesso-codice-campo').waitFor({ timeout: 20000 });
    await page.getByTestId('accesso-codice-campo').fill(await aspettaCodice(per));
    await page.getByTestId('accesso-invia').click();
}
const dentro = (page) => page.waitForURL((u) => /dashboard-user|\/onboarding/.test(u.pathname), { timeout: 30000 }).then(() => page.waitForTimeout(2500));
const nessunPrimoIngresso = async (t) => ({ onboarding: t.visti.includes('/onboarding'), consenso: await t.page.getByTestId('consenso-ai').isVisible().catch(() => false) });
async function passo(nome, fn) {
    try { esiti.passi[nome] = await fn(); } catch (e) { esiti.passi[nome] = { ok: false, errore: String(e?.message || e).slice(0, 300) }; }
    console.log(nome, JSON.stringify(esiti.passi[nome]).slice(0, 300));
    salva();
}
/** Il primo ingresso con scelte fisse; ritorna quanti passi ha mostrato. */
async function primoIngresso(page) {
    let passi = 0;
    for (let i = 0; i < 8 && /\/onboarding/.test(new URL(page.url()).pathname); i++) {
        passi++;
        await page.waitForTimeout(800);
        if (await page.getByTestId('consenso-ai-ok').isVisible().catch(() => false)) { await page.getByTestId('consenso-ai-ok').click(); continue; }
        for (const t of ['Storia e arte', 'Trattoria', 'Tranquillo', 'In coppia']) {
            const l = page.getByText(t, { exact: true }).first();
            if (await l.isVisible().catch(() => false) && (await l.evaluate((el) => el.closest('button')?.getAttribute('aria-pressed'))) !== 'true') await l.click();
        }
        await page.getByTestId('primo-avanti').click();
    }
    return passi;
}

// ─── Oggi: accesso esistente, secondo telefono, secondo accesso ──────────────
await passo('accesso-esistente', async () => {
    const t = await telefono();
    await conPassword(t.page, env.TEST_ACCOUNT_EMAIL, env.TEST_ACCOUNT_PASSWORD);
    await dentro(t.page);
    const r = await nessunPrimoIngresso(t);
    return { ok: !r.onboarding && !r.consenso && /dashboard-user/.test(t.page.url()), ...r, foto: await foto(t.page, 'v1-accesso-esistente') };
});
await passo('secondo-dispositivo', async () => {
    const t = await telefono();
    await conPassword(t.page, env.TEST_ACCOUNT_EMAIL, env.TEST_ACCOUNT_PASSWORD);
    await dentro(t.page);
    const r = await nessunPrimoIngresso(t);
    const meta = await t.page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^sb-.*-auth-token$/.test(x)); try { const m = JSON.parse(localStorage.getItem(k))?.user?.user_metadata || {}; return { consenso: !!m.consenso_ai, primoIngresso: !!m.primo_ingresso_fatto_at }; } catch { return null; } });
    // secondo accesso sullo stesso telefono: esci e rientra
    await t.page.getByLabel('Esci').first().click().catch(() => {});
    await t.page.waitForTimeout(2000);
    const prima = t.visti.length;
    await conPassword(t.page, env.TEST_ACCOUNT_EMAIL, env.TEST_ACCOUNT_PASSWORD);
    await dentro(t.page);
    const secondo = t.visti.slice(prima).includes('/onboarding');
    return { ok: !r.onboarding && !r.consenso && !secondo, ...r, secondoAccessoOnboarding: secondo, meta, foto: await foto(t.page, 'v2-secondo-dispositivo') };
});

if (TUTTO) {
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
    const [nome, dominio] = process.env.PROVA_EMAIL.split('@');
    const NUOVA = `${nome}+nuovo${stamp}@${dominio}`;
    const OSPITE = `${nome}+ospite${stamp}@${dominio}`;
    await passo('utente-nuovo', async () => {
        const t = await telefono();
        await conCodice(t.page, NUOVA, `utente nuovo, ${NUOVA}`);
        await dentro(t.page);
        const passi = await primoIngresso(t.page);
        await t.page.waitForURL((u) => /dashboard-user/.test(u.pathname), { timeout: 30000 });
        const t2 = await telefono();
        await conCodice(t2.page, NUOVA, `secondo telefono, ${NUOVA}`);
        await dentro(t2.page);
        const r2 = await nessunPrimoIngresso(t2);
        return { ok: passi >= 3 && !r2.onboarding && !r2.consenso, passiPrimoIngresso: passi, secondoTelefono: r2, foto: [await foto(t.page, 'v3-nuovo-home'), await foto(t2.page, 'v3-nuovo-secondo-telefono')] };
    });
    await passo('password-dimenticata', async () => {
        const t = await telefono();
        await titoloOk(t.page);
        await t.page.getByText('Accedi →').click();
        await t.page.getByTestId('accesso-dimenticata').click();
        await conCodice(t.page, env.TEST_ACCOUNT_EMAIL, 'password dimenticata, account di prova');
        await dentro(t.page);
        return { ok: /dashboard-user/.test(t.page.url()), foto: await foto(t.page, 'v4-dimenticata-dentro') };
    });
    await passo('ospite', async () => {
        const t = await telefono();
        await titoloOk(t.page);
        await t.page.getByTestId('prova-senza-account').click();
        await dentro(t.page);
        const id = async (p) => p.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^sb-.*-auth-token$/.test(x)); try { const s = JSON.parse(localStorage.getItem(k)); return { id: s?.user?.id, anonimo: s?.user?.is_anonymous }; } catch { return null; } });
        const prima = await id(t.page);
        const passi = await primoIngresso(t.page);
        await t.page.waitForURL((u) => /dashboard-user/.test(u.pathname), { timeout: 30000 });
        await t.page.evaluate(() => window.dispatchEvent(new CustomEvent('dvai:registrati', { detail: { momento: 'fine' } })));
        await t.page.getByTestId('registrazione-email').fill(OSPITE);
        await t.page.getByTestId('registrazione-invia').click();
        await t.page.getByTestId('registrazione-inviata').waitFor({ timeout: 20000 });
        await t.page.getByTestId('registrazione-codice').fill(await aspettaCodice(`ospite, ${OSPITE}`));
        await t.page.getByTestId('registrazione-conferma').click();
        await t.page.getByTestId('registrazione-fatta').waitFor({ timeout: 30000 });
        const dopo = await id(t.page);
        const t2 = await telefono();
        await conCodice(t2.page, OSPITE, `ospite dal secondo telefono, ${OSPITE}`);
        await dentro(t2.page);
        const r2 = await nessunPrimoIngresso(t2);
        return { ok: passi >= 3 && prima?.anonimo === true && dopo?.id === prima?.id && dopo?.anonimo === false && !r2.onboarding, passiPrimoIngresso: passi, stessoId: dopo?.id === prima?.id, secondoTelefono: r2, foto: await foto(t2.page, 'v5-ospite-secondo-telefono') };
    });
}

esiti.finito = new Date().toISOString();
salva();
await browser.close();
console.log('esiti in', path.relative(process.cwd(), path.join(OUT, 'esiti.json')));
