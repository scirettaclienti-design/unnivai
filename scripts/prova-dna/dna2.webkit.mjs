/**
 * DNA-2 — prova dal vivo: l'app (sito pubblicato, WebKit iPhone 13, account di prova) legge il registro
 * e lo tiene in cache sul telefono. Stampa SOLO le righe lette (id, gesto, categoria, giro, data) e se
 * l'app resta in piedi senza rete; mai credenziali. Uso: DNA_BASE=https://unnivai.vercel.app node scripts/prova-dna/dna2.webkit.mjs <uscita.json>
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.DNA_BASE || 'https://unnivai.vercel.app';
const USCITA = process.argv[2] || path.join(os.tmpdir(), 'dna2-cache.json');
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const CHIAVE = 'unnivai_dna_registro_v1';
const browser = await webkit.launch();
const esiti = {};
try {
    const c0 = await browser.newContext();
    const p0 = await c0.newPage();
    await p0.goto(BASE, { waitUntil: 'domcontentloaded' });
    const titolo = await p0.title();
    await c0.close();
    if (!/DoveVai/i.test(titolo)) throw new Error(`Titolo non DoveVai (${titolo}): niente credenziali.`);

    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai al login: niente credenziali.');
    await page.getByText('Accedi →').click();
    await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await page.getByText('Accedi Ora').click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    // Il registro si legge al montaggio di useAILearning: si aspetta la cache.
    let cache = null;
    for (let i = 0; i < 30 && !cache; i++) {
        await page.waitForTimeout(1000);
        cache = await page.evaluate((k) => localStorage.getItem(k), CHIAVE);
    }
    esiti.cacheScritta = !!cache;
    const c = cache ? JSON.parse(cache) : null;
    esiti.righe = c?.rows?.length ?? 0;
    if (c) fs.writeFileSync(USCITA, JSON.stringify(c.rows));

    // Senza rete: ricarica, l'app non si blocca e la cache resta.
    await ctx.setOffline(true);
    try { await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }); } catch { /* offline: la pagina puo' non ricaricare */ }
    esiti.offlineCacheResta = !!(await page.evaluate((k) => localStorage.getItem(k), CHIAVE).catch(() => null));
    await ctx.setOffline(false);
    // Dopo la riconnessione l'app riparte e rilegge.
    await page.goto(`${BASE}/dashboard-user`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    esiti.titoloDopo = await page.title();
    esiti.cacheDopo = !!(await page.evaluate((k) => localStorage.getItem(k), CHIAVE));
    await ctx.close();
} finally {
    await browser.close();
}
console.log(JSON.stringify(esiti));
