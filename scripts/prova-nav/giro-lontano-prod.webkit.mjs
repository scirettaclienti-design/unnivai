// GIRO-LONTANO — sul sito pubblicato (Map ID veri della navigazione): giro di Catania ripreso con il GPS a Roma, schermate a 1,5/3/6/10 s.
// Accesso con l'account di prova (titolo «DoveVai» verificato prima, credenziali da .env.local, mai stampate). Il giro sta solo nel localStorage del browser di prova.
//   node scripts/prova-nav/giro-lontano-prod.webkit.mjs <prefisso-schermate> [ora ISO] [base] [riprendi|avvia]
//   riprendi = il giro salvato e «Riprendi»; avvia = il giro sulla mappa come «Vedi su Mappa» (stato del router), panoramica e «Avvia».
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
const BASE = process.argv[4] || 'https://unnivai.vercel.app';
const OUT = process.argv[2];
const g = JSON.parse(fs.readFileSync('docs/prove/dati/2026-10-16-nav-sim-giri.json', 'utf8')).casi.find(x => x.id === 'navsim-catania');
const steps = g.tours[0].stops.filter(s => !s.tempoLibero).map((s, i) => ({ id: `s${i}`, title: s.title, lat: s.lat, lng: s.lng, latitude: s.lat, longitude: s.lng, moment: s.moment, types: s.types, stayMinutes: s.stay, scheduledTime: s.at, description: s.description }));
const tour = { id: 'tour-prova-lontano', title: 'Il tuo giro a Catania', city: 'Catania', steps };
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'it-IT', timezoneId: 'Europe/Rome', geolocation: { latitude: 41.9009, longitude: 12.4833 }, permissions: ['geolocation'] });
await ctx.clock.install({ time: new Date(process.argv[3] || '2026-10-30T19:30:00+01:00') });
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
if (!/DoveVai/i.test(await page.title())) throw new Error('titolo non DoveVai: niente credenziali');
await page.getByText('Accedi →').click();
await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
await page.getByText('Accedi Ora').click();
await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
await page.waitForTimeout(2000);
const MODO = process.argv[5] || 'riprendi';
let card = null;
if (MODO === 'avvia') {
    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((tour) => {
        const route = tour.steps.map((s, i) => ({ latitude: s.lat, longitude: s.lng, label: s.title, title: s.title, name: s.title, description: s.description, category: 'Punto Mappa', image: null, index: i + 1, type: 'waypoint' }));
        window.history.replaceState({ usr: { route, tourData: tour }, key: 'lontano', idx: 0 }, '', '/map');
    }, tour);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="map-avvia-card"]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(6000);
    card = (await page.locator('[data-testid="map-avvia-card"]').innerText()).replace(/\s+/g, ' ');
    await page.screenshot({ path: `${OUT}-0-panoramica.png` });
    await page.getByText('Avvia', { exact: true }).first().click();
} else {
    await page.evaluate((tour) => localStorage.setItem('dvai_nav_giro_v1', JSON.stringify({ v: 1, chiave: `id:${tour.id}`, tourData: tour, completedSteps: [], skippedSteps: [], targetStepId: null, singleTarget: false, startedAt: Date.now() - 60000, mode: 'walking', savedAt: Date.now() })), tour);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Riprendi' }).first().click({ timeout: 20000 });
}
const shots = [];
for (const ms of [1500, 3000, 6000, 10000]) { await page.waitForTimeout(ms - (shots.at(-1)?.ms || 0)); const f = `${OUT}-${ms}.png`; await page.screenshot({ path: f }); shots.push({ ms, f }); }
const cam = await page.evaluate(() => window.__dvCamera?.() ?? null);
const testo = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 300);
console.log(JSON.stringify({ modo: MODO, card, shots, cam, testo }, null, 1));
await browser.close();
