/**
 * CHAT-VERITA (03/11) — la chat con la guida sul sito pubblicato, WebKit profilo iPhone 14, account di prova.
 *   node scripts/prova-nav/chat-verita-sito.webkit.mjs ["domanda"]
 * 1. titolo «DoveVai»/«Unnivai» verificato prima delle credenziali (CLAUDE.md); credenziali da .env.local, mai stampate.
 * 2. mappa con il giro di Catania del banco (stato del router, come il collaudo): c'è il badge del meteo?
 * 3. mappa senza giro (Catania): badge del meteo → chat → domanda → «Controllo le fonti…» → risposta → «Fonti lette:».
 * Esiti in docs/prove/dati/2026-11-03-chat-verita-sito.json, schermate in docs/prove/schermate/chat-verita/.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.COLLAUDO_BASE || 'https://unnivai.vercel.app';
const DOMANDA = process.argv[2] || "Chi ha fatto la Fontana dell'Elefante?";
const OUT = path.resolve('docs/prove/schermate/chat-verita');
const ESITI = path.resolve('docs/prove/dati/2026-11-03-chat-verita-sito.json');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-verita-'));
fs.mkdirSync(OUT, { recursive: true });
const IPHONE = devices['iPhone 14'];
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const DATI = JSON.parse(fs.readFileSync('docs/prove/dati/2026-11-02-chat-verita.json', 'utf8'));
const CATANIA = { lat: 37.5025, lng: 15.0871 };
const oraIso = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
const TOUR = { id: 'chat-verita-catania', title: 'Il tuo giro a Catania', city: 'Catania',
    steps: DATI.giro.map((g, i) => ({ id: `s${i + 1}`, title: g.nome, lat: g.lat, lng: g.lng, latitude: g.lat, longitude: g.lng, place_id: g.place_id,
        scheduledTime: oraIso(g.ora), stayMinutes: g.sosta, moment: 'mattina', types: ['tourist_attraction'], description: 'Tappa del banco.' })) };

const esito = { base: BASE, iniziato: new Date().toISOString(), domanda: DOMANDA, titolo: null, conGiro: {}, senzaGiro: {} };
const browser = await webkit.launch();
const foto = async (page, nome) => { const f = path.join(OUT, `${nome}.png`); await page.screenshot({ path: f }); return path.relative(process.cwd(), f); };
const badge = (page) => page.locator('div[title].cursor-pointer').filter({ hasText: 'Vento' }).first();
try {
    // 1. porta e titolo prima delle credenziali
    const c0 = await browser.newContext();
    const p0 = await c0.newPage();
    await p0.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    esito.titolo = await p0.title();
    await c0.close();
    if (!/DoveVai|Unnivai/i.test(esito.titolo)) throw new Error(`titolo «${esito.titolo}»: niente credenziali`);
    if (!env.TEST_ACCOUNT_EMAIL || !env.TEST_ACCOUNT_PASSWORD) throw new Error('mancano le credenziali di prova in .env.local');

    const ctx = await browser.newContext({ ...IPHONE, locale: 'it-IT', timezoneId: 'Europe/Rome', permissions: ['geolocation'], geolocation: { latitude: CATANIA.lat, longitude: CATANIA.lng } });
    const page = await ctx.newPage();
    const chat = [];
    page.on('request', r => { if (/functions\/v1\/openai-proxy/.test(r.url()) && r.method() === 'POST') { try { const dv = r.postDataJSON()?.dv; if (dv?.purpose === 'chat') chat.push({ t0: Date.now(), luoghi: (dv.luoghi || []).map(l => l.nome), prossima: dv.prossima, citta: dv.citta, centro: dv.centro }); } catch { /* */ } } });
    page.on('response', async r => { if (!/functions\/v1\/openai-proxy/.test(r.url()) || r.request().method() !== 'POST') return; let dv = null; try { dv = r.request().postDataJSON()?.dv; } catch { /* */ } if (dv?.purpose !== 'chat') return; const j = await r.json().catch(() => null); const q = chat.find(x => x.stato == null); if (q) Object.assign(q, { stato: r.status(), ms: Date.now() - q.t0, esito: j?.chat?.esito ?? null, msServer: j?.chat?.ms ?? null, versione: j?.chat?.versione ?? null }); });
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai|Unnivai/i.test(await page.title())) throw new Error('titolo non DoveVai/Unnivai: niente credenziali');
    await page.getByText('Accedi →').click();
    await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await page.getByText('Accedi Ora').click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await page.waitForTimeout(2500);

    // 2. mappa con il giro (come «Vedi su Mappa»)
    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((tour) => {
        const route = tour.steps.map((s, i) => ({ latitude: s.lat, longitude: s.lng, label: s.title, title: s.title, name: s.title, description: s.description, category: 'Punto Mappa', image: null, index: i, type: 'waypoint' }));
        window.history.replaceState({ usr: { route, tourData: tour }, key: 'chat-verita', idx: 0 }, '', '/map');
    }, TOUR);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="map-avvia-card"]').waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);
    esito.conGiro = { avviaCard: await page.locator('[data-testid="map-avvia-card"]').count() > 0, badgeMeteo: await badge(page).count() > 0, foto: await foto(page, '1-mappa-con-giro') };

    // 3. mappa senza giro: badge del meteo → chat
    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.history.replaceState({ usr: null, key: 'chat-verita-2', idx: 0 }, '', '/map'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await badge(page).waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    await badge(page).click();
    await page.getByPlaceholder('Scrivi qui...').waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    esito.senzaGiro.benvenuto = await page.locator('.fixed.bottom-0').last().innerText().catch(() => null);
    esito.senzaGiro.fotoAperta = await foto(page, '2-chat-aperta');
    await page.getByPlaceholder('Scrivi qui...').fill(DOMANDA);
    const t0 = Date.now();
    await page.getByPlaceholder('Scrivi qui...').press('Enter');
    await page.locator('[data-testid="chat-attesa"]').waitFor({ timeout: 5000 }).then(() => { esito.senzaGiro.attesa = true; }).catch(() => { esito.senzaGiro.attesa = false; });
    esito.senzaGiro.fotoAttesa = await foto(page, '3-controllo-le-fonti');
    await page.locator('[data-testid="chat-attesa"]').waitFor({ state: 'detached', timeout: 35000 }).catch(() => {});
    esito.senzaGiro.msSchermo = Date.now() - t0;
    await page.waitForTimeout(600);
    esito.senzaGiro.fonti = await page.locator('[data-testid="chat-fonti"]').last().innerText().catch(() => null);
    esito.senzaGiro.testoChat = await page.locator('.fixed.bottom-0').last().innerText().catch(() => null);
    esito.senzaGiro.fotoRisposta = await foto(page, '4-risposta');
    esito.senzaGiro.richieste = chat.map(({ t0: _t, ...x }) => x);
    esito.ok = esito.senzaGiro.attesa === true && !!esito.senzaGiro.fonti && /Fonti lette:/.test(esito.senzaGiro.fonti) && chat.some(c => c.stato === 200);
    await ctx.close();
} catch (e) {
    esito.errore = String(e?.message || e).slice(0, 300);
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
    esito.finito = new Date().toISOString();
    fs.writeFileSync(ESITI, JSON.stringify(esito, null, 1));
    console.log(JSON.stringify(esito, null, 1));
}
