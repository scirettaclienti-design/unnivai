/**
 * CHAT-ACCESSO-VELOCE (04/11) — la chat con la guida con un giro sulla mappa, WebKit profilo iPhone 14, account di prova.
 *   COLLAUDO_BASE=<url> node scripts/prova-nav/chat-accesso.webkit.mjs        (difetto: il sito pubblicato)
 * 1. titolo «Unnivai»/«DoveVai» verificato prima delle credenziali (CLAUDE.md); credenziali da .env.local, mai stampate.
 * 2. panoramica del giro di Catania del banco: «Chiedi alla guida» c'è e non tocca «Avvia» → chat sul giro → una domanda.
 * 3. «Avvia» (GPS finto vicino alla tappa 1): nessun «Chiedi alla guida» sopra le indicazioni → «Apri la scheda» della prossima tappa →
 *    «Chiedi alla guida» (non tocca «Riparti») → chat su quella tappa → domanda → «Controllo le fonti…» → risposta → «Fonti lette:» →
 *    chiusa la chat la scheda è ancora lì.
 * Esiti in docs/prove/dati/2026-11-04-chat-accesso-sito.json (o CHAT_ESITI), schermate in docs/prove/schermate/chat-accesso/.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { conVoceTelefono } from './voce-telefono.mjs';

const BASE = process.env.COLLAUDO_BASE || 'https://unnivai.vercel.app';
const OUT = path.resolve('docs/prove/schermate/chat-accesso');
const ESITI = path.resolve(process.env.CHAT_ESITI || 'docs/prove/dati/2026-11-04-chat-accesso-sito.json');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-accesso-'));
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.dirname(ESITI), { recursive: true });
const IPHONE = devices['iPhone 14'];
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const DATI = JSON.parse(fs.readFileSync('docs/prove/dati/2026-11-02-chat-verita.json', 'utf8'));
const oraIso = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
const TOUR = { id: `chat-accesso-catania-${Date.now()}`, title: 'Il tuo giro a Catania', city: 'Catania',
    steps: DATI.giro.map((g, i) => ({ id: `s${i + 1}`, title: g.nome, lat: g.lat, lng: g.lng, latitude: g.lat, longitude: g.lng, place_id: g.place_id,
        scheduledTime: oraIso(g.ora), stayMinutes: g.sosta, moment: 'mattina', types: ['tourist_attraction'], description: 'Tappa del banco.' })) };
const DOMANDA_GIRO = process.env.DOMANDA_GIRO || 'Sono stanco, conviene fare una pausa?';
const DOMANDA_TAPPA = process.env.DOMANDA_TAPPA || "Chi l'ha fatta?";
const INIZIO = { lat: TOUR.steps[0].lat + 0.002, lng: TOUR.steps[0].lng };

const GPS_FINTO = (inizio) => {
    const g = { watchers: new Map(), id: 0, pos: inizio || null };
    const mk = (p) => ({ coords: { latitude: p.lat, longitude: p.lng, accuracy: p.acc ?? 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
    const geo = {
        getCurrentPosition(ok) { if (g.pos) setTimeout(() => ok(mk(g.pos)), 20); },
        watchPosition(ok, ko, o) { const id = ++g.id; g.watchers.set(id, { ok, ko, o }); return id; },
        clearWatch(id) { g.watchers.delete(id); },
    };
    g.emit = (lat, lng, acc) => { g.pos = { lat, lng, acc }; for (const w of [...g.watchers.values()]) w.ok(mk(g.pos)); };
    window.__gps = g;
    Object.defineProperty(Navigator.prototype, 'geolocation', { get: () => geo, configurable: true });
};
async function consensoAi(page, attesa = 8000) {
    const ok = page.getByTestId('consenso-ai-ok');
    try {
        await ok.waitFor({ timeout: attesa });
        await ok.click();
        await page.getByTestId('consenso-ai').waitFor({ state: 'detached', timeout: 8000 });
        return true;
    } catch { return false; }
}
const sovrapposti = (a, b) => !!(a && b) && !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
const box = (b) => (b ? { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) } : null);

const esito = { base: BASE, iniziato: new Date().toISOString(), titolo: null, panoramica: {}, scheda: {}, richieste: [] };
const browser = conVoceTelefono(await webkit.launch());
const foto = async (page, nome) => { const f = path.join(OUT, `${nome}.png`); await page.screenshot({ path: f }); return path.relative(process.cwd(), f); };
const chatTesto = (page) => page.locator('.fixed.bottom-0').last().innerText().catch(() => null);

/** Scrive la domanda nella chat aperta e aspetta la risposta: tempo a schermo (dall'invio alla fine di «Controllo le fonti…»). */
async function chiedi(page, domanda) {
    const r = {};
    await page.getByPlaceholder('Scrivi qui...').fill(domanda);
    const t0 = Date.now();
    await page.getByPlaceholder('Scrivi qui...').press('Enter');
    r.attesa = await page.locator('[data-testid="chat-attesa"]').waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
    await page.locator('[data-testid="chat-attesa"]').waitFor({ state: 'detached', timeout: 40000 }).catch(() => {});
    r.msSchermo = Date.now() - t0;
    await page.waitForTimeout(500);
    r.fonti = await page.locator('[data-testid="chat-fonti"]').last().innerText({ timeout: 1000 }).catch(() => null);
    return r;
}
async function chiudiChat(page) {
    // il fondo scuro sopra la chat (in alto, fuori dal cassetto) la chiude
    await page.mouse.click(195, 60);
    await page.getByPlaceholder('Scrivi qui...').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
}

try {
    // 1. porta e titolo prima delle credenziali
    const c0 = await browser.newContext();
    const p0 = await c0.newPage();
    await p0.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    esito.titolo = await p0.title();
    await c0.close();
    if (!/Unnivai|DoveVai/i.test(esito.titolo)) throw new Error(`titolo «${esito.titolo}»: niente credenziali`);
    if (!env.TEST_ACCOUNT_EMAIL || !env.TEST_ACCOUNT_PASSWORD) throw new Error('mancano le credenziali di prova in .env.local');

    const ctx = await browser.newContext({ ...IPHONE, locale: 'it-IT', timezoneId: 'Europe/Rome', permissions: ['geolocation'], geolocation: { latitude: INIZIO.lat, longitude: INIZIO.lng } });
    await ctx.addInitScript(GPS_FINTO, INIZIO);
    const page = await ctx.newPage();
    const chat = esito.richieste;
    page.on('request', r => { if (/functions\/v1\/openai-proxy/.test(r.url()) && r.method() === 'POST') { try { const dv = r.postDataJSON()?.dv; if (dv?.purpose === 'chat') chat.push({ t0: Date.now(), domanda: dv.domanda, aperto: dv.aperto?.nome ?? null, apertoPlaceId: dv.aperto?.place_id ?? null, luoghi: (dv.luoghi || []).length, prossima: dv.prossima }); } catch { /* */ } } });
    page.on('response', async r => { if (!/functions\/v1\/openai-proxy/.test(r.url()) || r.request().method() !== 'POST') return; let dv = null; try { dv = r.request().postDataJSON()?.dv; } catch { /* */ } if (dv?.purpose !== 'chat') return; const j = await r.json().catch(() => null); const q = chat.find(x => x.stato == null); if (q) Object.assign(q, { stato: r.status(), ms: Date.now() - q.t0, esito: j?.chat?.esito ?? null, msServer: j?.chat?.ms ?? null, testo: j?.chat?.testo ?? null }); });
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/Unnivai|DoveVai/i.test(await page.title())) throw new Error('titolo non Unnivai: niente credenziali');
    await page.getByText('Accedi →').click();
    await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await page.getByText('Accedi Ora').click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await consensoAi(page);
    await page.waitForTimeout(2500);

    // 2. panoramica (come «Vedi su Mappa»)
    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((tour) => {
        const route = tour.steps.map((s, i) => ({ latitude: s.lat, longitude: s.lng, label: s.title, title: s.title, name: s.title, description: s.description, category: 'Punto Mappa', image: null, index: i, type: 'waypoint' }));
        window.history.replaceState({ usr: { route, tourData: tour }, key: 'chat-accesso', idx: 0 }, '', '/map');
    }, TOUR);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="map-avvia-card"]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(4000);
    const tastoP = page.getByTestId('chiedi-guida-panoramica');
    esito.panoramica.tasto = await tastoP.count() > 0 ? await tastoP.innerText() : null;
    esito.panoramica.boxTasto = box(await tastoP.boundingBox().catch(() => null));
    esito.panoramica.boxAvvia = box(await page.getByTestId('avvia-diretto').boundingBox().catch(() => null));
    esito.panoramica.sopraAvvia = sovrapposti(esito.panoramica.boxTasto, esito.panoramica.boxAvvia);
    esito.panoramica.foto = await foto(page, '1-panoramica');
    if (esito.panoramica.tasto) {
        await tastoP.click();
        await page.getByPlaceholder('Scrivi qui...').waitFor({ timeout: 10000 });
        await page.waitForTimeout(700);
        esito.panoramica.benvenuto = await chatTesto(page);
        Object.assign(esito.panoramica, await chiedi(page, DOMANDA_GIRO));
        esito.panoramica.fotoRisposta = await foto(page, '2-panoramica-risposta');
        await chiudiChat(page);
    }

    // 3. «Avvia», poi la scheda della prossima tappa
    await page.getByText('Avvia', { exact: true }).first().click();
    for (let k = 0; k < 4; k++) { await page.evaluate(([la, ln]) => window.__gps.emit(la, ln, 8), [INIZIO.lat, INIZIO.lng]); await page.waitForTimeout(700); }
    await page.getByTestId('nav-hud-barra').waitFor({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    esito.scheda.inNavigazioneTastiChiedi = await page.getByText('Chiedi alla guida').count();
    esito.scheda.fotoNavigazione = await foto(page, '3-navigazione');
    await page.getByLabel(`Apri la scheda: ${TOUR.steps[0].title}`).first().click({ timeout: 15000 });
    await page.getByTestId('scheda-tappa').waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const tastoS = page.getByTestId('chiedi-guida-scheda');
    esito.scheda.tasto = await tastoS.count() > 0 ? await tastoS.innerText() : null;
    esito.scheda.boxTasto = box(await tastoS.boundingBox().catch(() => null));
    esito.scheda.boxRiparti = box(await page.getByTestId('scheda-tappa').getByRole('button', { name: /Riparti|Avanti/ }).last().boundingBox().catch(() => null));
    esito.scheda.sopraRiparti = sovrapposti(esito.scheda.boxTasto, esito.scheda.boxRiparti);
    esito.scheda.foto = await foto(page, '4-scheda');
    if (esito.scheda.tasto) {
        await tastoS.click();
        await page.getByPlaceholder('Scrivi qui...').waitFor({ timeout: 10000 });
        await page.waitForTimeout(700);
        esito.scheda.benvenuto = await chatTesto(page);
        esito.scheda.fotoAperta = await foto(page, '5-chat-dalla-scheda');
        Object.assign(esito.scheda, await chiedi(page, DOMANDA_TAPPA));
        esito.scheda.fotoRisposta = await foto(page, '6-chat-dalla-scheda-risposta');
        esito.scheda.testoChat = await chatTesto(page);
        await chiudiChat(page);
        esito.scheda.schedaDopoChat = await page.getByTestId('scheda-tappa').count() > 0;
    }
    esito.richieste = chat.map(({ t0: _t, ...x }) => x);
    const rS = esito.richieste.find(r => r.domanda === DOMANDA_TAPPA);
    esito.ok = !!esito.panoramica.tasto && !esito.panoramica.sopraAvvia && esito.scheda.inNavigazioneTastiChiedi === 0
        && !!esito.scheda.tasto && !esito.scheda.sopraRiparti && esito.scheda.attesa === true && /Fonti lette:/.test(esito.scheda.fonti || '')
        && rS?.stato === 200 && rS?.aperto === TOUR.steps[0].title && esito.scheda.schedaDopoChat === true;
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
