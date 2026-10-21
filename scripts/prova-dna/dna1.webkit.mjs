/**
 * DNA-1 — prova dal vivo del registro (WebKit di Playwright, iPhone 13) su un sito pubblicato.
 *
 * Uso: DNA_BASE=https://unnivai.vercel.app node scripts/prova-dna/dna1.webkit.mjs
 * Entra con l'account di prova (TEST_ACCOUNT_EMAIL / TEST_ACCOUNT_PASSWORD da .env.local, mai stampate),
 * dopo aver controllato che il titolo della pagina contenga "DoveVai". Fa: apre un giro (3 tappe vere con
 * i tipi Google), segna la tappa 1 raggiunta (GPS finto), la 2 saltata, la 3 raggiunta, poi apre «Tour live»
 * e salva (e ritoglie) un giro. Stampa solo l'ora d'inizio e gli esiti dei passi: le righe in dna_events
 * si leggono dopo, in sola lettura, filtrando created_at >= inizio.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.DNA_BASE || 'https://unnivai.vercel.app';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dna1-'));
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));

const TOUR = {
    id: 'prova-dna1-catania',
    title: 'Prova DNA-1 a Catania',
    city: 'Catania',
    steps: [
        { id: 'p1', title: "Fontana dell'Elefante", lat: 37.50270, lng: 15.08710, types: ['tourist_attraction', 'point_of_interest'], moment: 'mattina' },
        { id: 'p2', title: 'Villa Bellini', lat: 37.51270, lng: 15.08710, types: ['park', 'point_of_interest'], moment: 'mattina' },
        { id: 'p3', title: 'Trattoria di prova', lat: 37.51270, lng: 15.09710, types: ['restaurant', 'food'], moment: 'pranzo' },
    ],
};
const LONTANO = [37.5090, 15.0800];

const GPS_FINTO = () => {
    const g = { watchers: new Map(), id: 0, pos: null };
    const mk = (p) => ({ coords: { latitude: p.lat, longitude: p.lng, accuracy: 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
    const geo = {
        getCurrentPosition(ok) { if (g.pos) setTimeout(() => ok(mk(g.pos)), 20); },
        watchPosition(ok, ko, o) { const id = ++g.id; g.watchers.set(id, { ok, ko, o }); return id; },
        clearWatch(id) { g.watchers.delete(id); },
    };
    g.emit = (lat, lng) => { g.pos = { lat, lng }; for (const w of [...g.watchers.values()]) w.ok(mk(g.pos)); };
    window.__gps = g;
    Object.defineProperty(Navigator.prototype, 'geolocation', { get: () => geo, configurable: true });
};

const vede = async (page, t, timeout = 15000) => {
    try { await page.getByText(t, { exact: false }).first().waitFor({ state: 'visible', timeout }); return true; } catch { return false; }
};
const emit = (page, [a, b]) => page.evaluate(([x, y]) => window.__gps.emit(x, y), [a, b]);

const FOTO = process.env.DNA_FOTO || null;
const foto = async (page, nome) => { if (FOTO) { fs.mkdirSync(FOTO, { recursive: true }); await page.screenshot({ path: path.join(FOTO, nome + '.png') }); } };
const inizio = new Date().toISOString();
const esiti = { inizio };
const browser = await webkit.launch();
try {
    // 1. Porta e titolo prima delle credenziali.
    const c0 = await browser.newContext();
    const p0 = await c0.newPage();
    await p0.goto(BASE, { waitUntil: 'domcontentloaded' });
    const titolo = await p0.title();
    await c0.close();
    if (!/DoveVai/i.test(titolo)) throw new Error(`La pagina su ${BASE} non è DoveVai (titolo: ${titolo}): niente credenziali.`);
    esiti.titolo = titolo;

    // 2. Accesso con l'account di prova.
    const statePath = path.join(TMP, 'sessione.json');
    const ctxL = await browser.newContext({ ...devices['iPhone 13'] });
    const pl = await ctxL.newPage();
    await pl.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await pl.title())) throw new Error('Titolo non DoveVai sulla pagina di accesso: niente credenziali.');
    await pl.getByText('Accedi →').click();
    await pl.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await pl.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await pl.getByText('Accedi Ora').click();
    await pl.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await ctxL.storageState({ path: statePath });
    await ctxL.close();
    esiti.accesso = true;

    // 3. Il giro: tappa 1 raggiunta, tappa 2 saltata, tappa 3 raggiunta.
    const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath, locale: 'it-IT' });
    await ctx.addInitScript(GPS_FINTO);
    const page = await ctx.newPage();
    const errori = [];
    page.on('pageerror', e => errori.push(String(e?.message || e)));
    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((tour) => window.history.replaceState({ usr: { tourData: tour }, key: 'dna1', idx: 0 }, '', '/map'), TOUR);
    await page.reload({ waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 2; i++) {
        await page.getByText('Avvia', { exact: true }).click({ timeout: 25000 });
        try { await page.getByText('Avvia Navigazione').click({ timeout: 10000 }); break; } catch (e) { if (i === 1) throw e; }
    }
    await page.waitForTimeout(800);
    // Tappa 1: «Sono arrivato» (stesso percorso dell'arrivo vero: handlePOIUnlock → stop_reached).
    await page.getByText('Sono arrivato', { exact: true }).click({ timeout: 20000 });
    esiti.tappa1_raggiunta = await vede(page, 'Tappa 2/3');
    await foto(page, 'dna1-01-dopo-arrivo');
    // Tappa 2: «Salta» (handleSkipStep → stop_skipped).
    // DNA_COMPLETA=1: la tappa 2 non si salta ma si raggiunge, così il giro si completa (tour_completed).
    const completa = process.env.DNA_COMPLETA === '1';
    await page.getByText(completa ? 'Sono arrivato' : 'Salta', { exact: true }).click({ timeout: 15000 });
    esiti[completa ? 'tappa2_raggiunta' : 'tappa2_saltata'] = await vede(page, 'Tappa 3/3');
    await foto(page, 'dna1-02-dopo-salto');
    // Tappa 3: «Sono arrivato».
    await page.getByText('Sono arrivato', { exact: true }).click({ timeout: 15000 });
    await page.waitForTimeout(2500);
    esiti.tappa3_raggiunta = true;
    esiti.errori_pagina = errori;
    await ctx.close();

    // 4. Giro salvato: «Tour live», il cuore sul primo giro, poi si ritoglie.
    const ctx2 = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath, locale: 'it-IT' });
    await ctx2.addInitScript(GPS_FINTO);
    await ctx2.addInitScript(() => { try { localStorage.setItem('user_city', 'Roma'); } catch { /* pagina senza storage */ } });
    const p2 = await ctx2.newPage();
    await p2.goto(`${BASE}/tour-live`, { waitUntil: 'domcontentloaded' });
    await p2.evaluate(() => window.__gps.emit(41.9028, 12.4964)); // Roma: i tour live del database sono lì
    await p2.waitForTimeout(8000);
    await foto(p2, 'dna1-03-tour-live');
    const cuori = p2.locator('button:has(svg.lucide-heart)');
    esiti.cuori_trovati = await cuori.count();
    if (esiti.cuori_trovati > 0) {
        await cuori.first().click();
        await p2.waitForTimeout(3500);
        await cuori.first().click(); // ritoglie il preferito (stato come prima)
        await p2.waitForTimeout(2500);
    }
    await ctx2.close();
} catch (e) {
    esiti.errore = String(e?.message || e);
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(JSON.stringify(esiti, null, 2));
