/**
 * ESTETICA-MOVIMENTO — tempi di caricamento «prima» e «dopo» in WebKit (profilo iPhone 14), alternati.
 *
 * Uso: PRIMA=http://localhost:<porta> DOPO=http://localhost:<porta> FOTO=<jpg del Colosseo> RIPETIZIONI=7 \
 *      node scripts/prova-nav/movimento-tempi.webkit.mjs
 * Le porte devono essere `vite preview` di QUESTO repo con titolo «Unnivai» (CLAUDE.md): lo script ricontrolla il titolo
 * prima di inserire le credenziali (TEST_ACCOUNT_* da .env.local, mai stampate; la sessione vive in una cartella
 * temporanea cancellata alla fine). Rete tolta dal rumore: foto del Colosseo servita da disco, funzioni dei posti e
 * dell'AI simulate (risposta vuota immediata). Ogni ripetizione è un contesto nuovo (cache vuota); prima/dopo si
 * alternano. Misure: primo disegno (first-contentful-paint), primo contenuto della pagina (h1 per la Landing,
 * primo figlio di <main> per la home), frame al secondo nei 3 secondi dopo il caricamento (costo del movimento).
 * Stampa il JSON con tutte le misure e le mediane.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { conVoceTelefono } from './voce-telefono.mjs';

const BASI = { prima: process.env.PRIMA, dopo: process.env.DOPO };
const N = Number(process.env.RIPETIZIONI || 7);
const FOTO = process.env.FOTO ? fs.readFileSync(process.env.FOTO) : null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-'));
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));

const mediana = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

async function simula(ctx) {
    await ctx.route('**/images.unsplash.com/**', r => FOTO ? r.fulfill({ status: 200, contentType: 'image/jpeg', body: FOTO }) : r.abort());
    await ctx.route('**/functions/v1/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"simulato"}' }));
    await ctx.route('**/maps.googleapis.com/**', r => r.abort());
    await ctx.route('**/nominatim.openstreetmap.org/**', r => r.abort());
    await ctx.route('**/api.open-meteo.com/**', r => r.abort());
}

const SONDA = () => {
    window.__m = { fcp: null, contenuto: null, frames: 0, t0: null };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__m.fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
    const cerca = () => {
        const el = document.querySelector(window.__selettore);
        if (el && el.getBoundingClientRect().height > 0) { window.__m.contenuto = performance.now(); return; }
        requestAnimationFrame(cerca);
    };
    document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(cerca));
};

async function misura(browser, base, percorso, selettore, statePath) {
    const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: 'it-IT', ...(statePath ? { storageState: statePath } : {}) });
    await simula(ctx);
    await ctx.addInitScript((sel) => { window.__selettore = sel; try { localStorage.setItem('user_city', 'Catania'); sessionStorage.setItem('dvai_city_onboarding_prompted', 'true'); } catch { /* ignorato */ } }, selettore);
    await ctx.addInitScript(SONDA);
    const page = await ctx.newPage();
    await page.goto(`${base}${percorso}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__m.contenuto !== null, null, { timeout: 20000 });
    await page.waitForTimeout(600);
    const frames = await page.evaluate(() => new Promise((ok) => {
        let n = 0; const t0 = performance.now();
        const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else ok(n / ((performance.now() - t0) / 1000)); };
        requestAnimationFrame(f);
    }));
    const m = await page.evaluate(() => window.__m);
    await ctx.close();
    return { fcp: m.fcp, contenuto: m.contenuto, fps: frames };
}

async function accedi(browser, base, nome) {
    const statePath = path.join(TMP, `sessione-${nome}.json`);
    const ctx = await browser.newContext({ ...devices['iPhone 14'] });
    const page = await ctx.newPage();
    await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
    if (!/Unnivai|DoveVai/i.test(await page.title())) throw new Error('Titolo non Unnivai sulla pagina di accesso: niente credenziali.');
    await page.getByText('Accedi →').click();
    await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await page.getByText('Accedi Ora').click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 });
    await ctx.storageState({ path: statePath });
    await ctx.close();
    return statePath;
}

const browser = conVoceTelefono(await webkit.launch());
const out = { landing: { prima: [], dopo: [] }, home: { prima: [], dopo: [] } };
try {
    for (const [nome, base] of Object.entries(BASI)) {
        if (!base) throw new Error(`Manca ${nome.toUpperCase()}`);
        const c = await browser.newContext(); const p = await c.newPage();
        await p.goto(base, { waitUntil: 'domcontentloaded' });
        if (!/Unnivai|DoveVai/i.test(await p.title())) throw new Error(`La pagina su ${base} non è Unnivai: niente credenziali.`);
        await c.close();
    }
    const stati = {};
    if (process.env.SENZA_HOME !== '1') for (const nome of Object.keys(BASI)) stati[nome] = await accedi(browser, BASI[nome], nome);
    // un giro di riscaldamento per parte, scartato
    for (const nome of Object.keys(BASI)) await misura(browser, BASI[nome], '/', 'h1', null);
    for (let i = 0; i < N; i++) {
        const ordine = i % 2 ? ['dopo', 'prima'] : ['prima', 'dopo'];
        for (const nome of ordine) {
            out.landing[nome].push(await misura(browser, BASI[nome], '/', 'h1', null));
            if (stati[nome]) out.home[nome].push(await misura(browser, BASI[nome], '/dashboard-user', 'main > *', stati[nome]));
        }
    }
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
}
const riassunto = {};
for (const pag of Object.keys(out)) {
    riassunto[pag] = {};
    for (const nome of ['prima', 'dopo']) {
        const r = out[pag][nome];
        if (!r.length) continue;
        riassunto[pag][nome] = { n: r.length, fcpMediana: mediana(r.map(x => x.fcp)), contenutoMediana: mediana(r.map(x => x.contenuto)), fpsMediana: mediana(r.map(x => x.fps)) };
    }
}
console.log(JSON.stringify({ riassunto, misure: out }, null, 1));
