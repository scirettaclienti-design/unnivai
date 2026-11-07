/**
 * ESTETICA-MOVIMENTO — sequenza di schermate (WebKit, iPhone 14) con e senza «riduci movimento».
 * Uso: DOPO=http://localhost:<porta> FOTO=<jpg> node scripts/prova-nav/movimento-schermate.webkit.mjs
 * Porta e titolo verificati prima delle credenziali (home dell'account di prova; l'email non compare nelle schermate).
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { conVoceTelefono } from './voce-telefono.mjs';

const BASE = process.env.DOPO;
const OUT = path.resolve('docs/prove/schermate/estetica-movimento');
const FOTO = fs.readFileSync(process.env.FOTO);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mvs-'));
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
fs.mkdirSync(OUT, { recursive: true });
const browser = conVoceTelefono(await webkit.launch());

async function ctxDi(opts) {
    const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: 'it-IT', ...opts });
    await ctx.route('**/images.unsplash.com/**', r => r.fulfill({ status: 200, contentType: 'image/jpeg', body: FOTO }));
    await ctx.route('**/functions/v1/**', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"simulato"}' }));
    await ctx.route('**/maps.googleapis.com/**', r => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('user_city', 'Catania'); sessionStorage.setItem('dvai_city_onboarding_prompted', 'true'); } catch { /* ignorato */ } });
    return ctx;
}

const t0 = Date.now();
const c0 = await browser.newContext(); const p0 = await c0.newPage();
await p0.goto(BASE, { waitUntil: 'domcontentloaded' });
if (!/Unnivai|DoveVai/i.test(await p0.title())) throw new Error('Titolo non Unnivai: niente credenziali.');
await c0.close();

const risultati = {};
for (const modo of ['movimento', 'ridotto']) {
    const ctx = await ctxDi(modo === 'ridotto' ? { reducedMotion: 'reduce' } : { reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'commit' });
    const tappe = [0.15, 0.5, 0.9, 1.4, 6, 20, 39];
    const t1 = Date.now();
    for (const t of tappe) {
        const attesa = t * 1000 - (Date.now() - t1);
        if (attesa > 0) await page.waitForTimeout(attesa);
        await page.screenshot({ path: path.join(OUT, `landing-${modo}-${String(t).replace('.', '_')}s.jpg`), type: 'jpeg', quality: 78 });
    }
    // trasformazione della foto e animazioni attive: la prova numerica del «riduci movimento»
    risultati[modo] = await page.evaluate(() => {
        const img = document.querySelector('header img');
        const cs = img && getComputedStyle(img);
        return { fotoAnimazione: cs?.animationName, fotoTransform: cs?.transform, animazioniAttive: document.getAnimations().filter(a => a.playState === 'running' && /camera|curve|logo|bussola/.test(a.animationName || '')).map(a => a.animationName) };
    });
    await ctx.close();
}

// pagina nascosta: l'attributo e le animazioni ferme
{
    const ctx = await ctxDi({}); const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(800);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    risultati.nascosta = await page.evaluate(() => ({ attributo: document.documentElement.hasAttribute('data-pagina-nascosta'), stati: [...new Set(document.getAnimations().filter(a => /camera|curve/.test(a.animationName || '')).map(a => a.playState))] }));
    await ctx.close();
}

// login e home (un'unica schermata, senza email)
const statePath = path.join(TMP, 's.json');
{
    const ctx = await browser.newContext({ ...devices['iPhone 14'] }); const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'load' });
    await page.screenshot({ path: path.join(OUT, 'login.jpg'), type: 'jpeg', quality: 78 });
    await page.getByText('Accedi →').click();
    await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await page.getByText('Accedi Ora').click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 });
    await ctx.storageState({ path: statePath }); await ctx.close();
}
for (const modo of ['movimento', 'ridotto']) {
    const ctx = await ctxDi({ storageState: statePath, reducedMotion: modo === 'ridotto' ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dashboard-user`, { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    // il tocco passa attraverso lo sfondo: un elemento dello sfondo non è mai quello sotto un punto della pagina
    risultati[`home-${modo}`] = await page.evaluate(() => ({ sfondoIntercetta: [...document.querySelectorAll('svg.curve-deriva')].some(s => { const r = s.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e && s.contains(e); }) }));
    await page.screenshot({ path: path.join(OUT, `home-${modo}.jpg`), type: 'jpeg', quality: 78 });
    await ctx.close();
}
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log(JSON.stringify(risultati, null, 1));
