/**
 * VERITA-TESTI punto 5 — «domani un giorno a Catania» senza orario: il giro comincia con la colazione?
 * WebKit iPhone 13, GPS finto, account di prova (credenziali solo da .env.local). node scripts/prova-giro-edit/giroedit.webkit.mjs <uscita.json>
 */
import { webkit, devices } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const BASE = process.env.PROVA_BASE || 'https://unnivai.vercel.app';
const leggi = (f) => (fs.existsSync(f) ? Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')])) : {});
const env = { ...leggi('.env'), ...leggi('.env.local') };
const CATANIA = { latitude: 37.5023612, longitude: 15.0873718 };
const LISTINO = { textsearch: 0.032, details: 0.025, findplacefromtext: 0.017, photo: 0.007, altro: 0.032 };
const OPENAI = { 'gpt-4o-mini': [0.15, 0.6], 'gpt-6.1-sol': [2, 10] };
const [, , uscita] = process.argv;

const TETTO_USD = 1;
const browser = await webkit.launch();
const esito = { richieste: { places: {}, placesMiss: {}, cambia: [], openai: 0 }, dna: [], console: [], fasi: {}, costoUsd: {} };
const costo = () => Object.entries(esito.richieste.placesMiss).reduce((a, [k, v]) => a + v * (LISTINO[k] ?? LISTINO.altro), 0);
const righe = async (page) => {
    const carte = page.locator('[data-stop-card]'); const n = await carte.count(); const out = [];
    for (let i = 0; i < n; i++) { const c = carte.nth(i); const libero = (await c.getAttribute('data-free-time')) !== null; out.push({ libero, righe: (await c.innerText()).split('\n').map(x => x.trim()).filter(Boolean).slice(0, 3) }); }
    return out;
};
try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'it-IT', timezoneId: 'Europe/Rome', geolocation: CATANIA, permissions: ['geolocation'] });
    const page = await ctx.newPage();
    let costoOpenai = 0; let cambiaAttivo = false;
    page.on('console', (m) => { const t = m.text(); if (/^\[/.test(t)) esito.console.push(t.slice(0, 240)); });
    page.on('request', (r) => {
        const u = r.url();
        if (u.includes('/functions/v1/places-proxy')) {
            const p = decodeURIComponent(u).replace(/\+/g, ' ');
            const chiave = ((p.match(/path=([^&]+)/) || [])[1] || 'altro').replace('place/', '');
            esito.richieste.places[chiave] = (esito.richieste.places[chiave] || 0) + 1;
            if (cambiaAttivo) esito.richieste.cambia.push(p.replace(/key=[^&]*/g, 'key=…').slice(0, 240));
        }
        if (u.includes('/functions/v1/openai-proxy')) esito.richieste.openai += 1;
        if (/rest\/v1\/dna_events/.test(u) && r.method() === 'POST') esito.dna.push(r.postData());
    });
    page.on('response', async (r) => {
        const u = r.url();
        if (u.includes('/functions/v1/places-proxy')) {
            if ((r.headers()['x-cache'] || '').toUpperCase() === 'MISS') {
                const p = decodeURIComponent(u).replace(/\+/g, ' ');
                const chiave = ((p.match(/path=([^&]+)/) || [])[1] || 'altro').replace('place/', '');
                esito.richieste.placesMiss[chiave] = (esito.richieste.placesMiss[chiave] || 0) + 1;
            }
            return;
        }
        if (!u.includes('/functions/v1/openai-proxy')) return;
        try {
            const j = await r.json(); const mod = j?._modello?.usato || j?.model || 'gpt-4o-mini';
            const k = Object.keys(OPENAI).find(x => String(mod).includes(x)) || 'gpt-4o-mini';
            costoOpenai += ((j?.usage?.prompt_tokens || 0) * OPENAI[k][0] + (j?.usage?.completion_tokens || 0) * OPENAI[k][1]) / 1e6;
        } catch { /* non JSON */ }
    });
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai: niente credenziali.');
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai al login: niente credenziali.');
    await page.getByText('Accedi →').click();
    await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await page.getByText('Accedi Ora').click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await page.waitForTimeout(6000);
    await page.goto(`${BASE}/ai-itinerary`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    for (let i = 0; i < 3; i++) { const b = page.getByText('Conferma Posizione'); if (await b.count().catch(() => 0)) await b.first().click().catch(() => {}); await page.waitForTimeout(800); }
    const testo = page.locator('textarea').first();
    await testo.waitFor({ timeout: 20000 });
    await testo.fill('domani un giorno a Catania');
    await page.getByText('Genera Viaggio').first().click();
    await page.locator('[data-stop-card]').first().waitFor({ timeout: 150000 });
    await page.waitForTimeout(4000);
    esito.fasi.generato = { momenti: await page.locator('[data-moment-header]').allInnerTexts(), tappe: await righe(page), costoSoFar: Number(costo().toFixed(3)) };
    await page.screenshot({ path: 'docs/prove/schermate/2026-10-24-verita-domani-catania.png', fullPage: true });
    if (costo() + costoOpenai > TETTO_USD) throw new Error('tetto di spesa raggiunto: mi fermo');
    const reale = costo();
    esito.costoUsd = { googleRealeMiss: Number(reale.toFixed(3)), openai: Number(costoOpenai.toFixed(4)), totale: Number((reale + costoOpenai).toFixed(3)) };
    await ctx.close();
} finally {
    await browser.close();
    if (uscita) fs.writeFileSync(uscita, JSON.stringify(esito, null, 1));
}
console.log(JSON.stringify({ costo: esito.costoUsd, prime: esito.fasi.generato?.tappe?.slice(0, 3) }));
