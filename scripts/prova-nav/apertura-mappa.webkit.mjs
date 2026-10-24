/**
 * NAV-3 — il tempo di apertura della mappa: dal caricamento di /map con un giro all'apparire della mappa (il canvas di Google). 3 corse, mediana.
 *   NAV_BASE=http://localhost:<porta> node scripts/prova-nav/apertura-mappa.webkit.mjs
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const BASE = process.env.NAV_BASE || 'http://localhost:5187';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const giri = JSON.parse(fs.readFileSync('docs/prove/dati/2026-10-16-nav-sim-giri.json', 'utf8'));
const c = giri.casi.find(x => x.id === 'navsim-catania');
const stops = c.tours[0].stops.map(s => ({ title: s.title, latitude: s.lat, longitude: s.lng, description: s.description, types: s.types, place_id: s.place_id, moment: s.moment, ...(s.tempoLibero ? { tempoLibero: true } : { stayMinutes: s.stay }) }));
const browser = await webkit.launch();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apertura-'));
try {
    { const c0 = await browser.newContext(); const p = await c0.newPage(); await p.goto(BASE, { waitUntil: 'domcontentloaded' }); const t = await p.title(); await c0.close(); if (!/DoveVai/i.test(t)) throw new Error('Titolo non DoveVai: niente credenziali.'); }
    const ctx0 = await browser.newContext({ ...devices['iPhone 13'] });
    const p0 = await ctx0.newPage();
    await p0.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await p0.title())) throw new Error('Titolo non DoveVai al login: niente credenziali.');
    await p0.getByText('Accedi →').click();
    await p0.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await p0.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await p0.getByText('Accedi Ora').click();
    await p0.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await p0.waitForTimeout(2500);
    const state = path.join(tmp, 's.json');
    await ctx0.storageState({ path: state });
    await ctx0.close();
    const tempi = [];
    for (let k = 0; k < 3; k++) {
        const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: state, locale: 'it-IT', timezoneId: 'Europe/Rome', geolocation: { latitude: 37.5024, longitude: 15.0871 }, permissions: ['geolocation'] });
        const page = await ctx.newPage();
        await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
        await page.evaluate(async (g) => {
            const { normalizeTour } = await import('/src/services/tourShape.js');
            const vere = g.stops.filter(s => !s.tempoLibero);
            const route = vere.map((s, i) => ({ latitude: s.latitude, longitude: s.longitude, label: s.title, title: s.title, name: s.title, index: i + 1, type: 'waypoint' }));
            const tourData = normalizeTour({ id: 'ai-itinerary-apertura', title: 'Catania', type: 'ai-generated', isAiGenerated: true, city: 'Catania', stops: g.stops }, { cityFallback: 'Catania' });
            window.history.replaceState({ usr: { route, tourData }, key: 'k', idx: 0 }, '', '/map');
        }, { stops });
        const t0 = Date.now();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.gm-style canvas', { timeout: 60000 });
        tempi.push(Date.now() - t0);
        await ctx.close();
    }
    tempi.sort((a, b) => a - b);
    console.log(JSON.stringify({ base: BASE, tempiMs: tempi, medianaMs: tempi[1] }));
} finally { await browser.close(); }
