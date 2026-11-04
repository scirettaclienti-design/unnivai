/**
 * CHAT-FOCUS-FONTI (05/11) — dieci domande fisse con un giro attivo, WebKit profilo iPhone 14, account di prova, sito pubblicato.
 *   COLLAUDO_BASE=<url> CHAT_ESITI=<file.json> node scripts/prova-nav/chat-focus-fonti.webkit.mjs
 * Giro di Catania del banco, «Avvia» (GPS finto), scheda della prossima tappa aperta; per ogni domanda la chat si apre dalla scheda
 * (conversazione nuova, il «Focus» c'è) e si misura il tempo dall'invio alla risposta a schermo. 5 domande vaghe (con la scheda aperta) e
 * 5 specifiche (nominano una tappa). Le risposte vanno nel JSON; invenzioni e tappa giusta si contano a mano.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.COLLAUDO_BASE || 'https://unnivai.vercel.app';
const OUT = path.resolve('docs/prove/schermate/chat-focus-fonti');
const ESITI = path.resolve(process.env.CHAT_ESITI || 'docs/prove/dati/2026-11-05-chat-focus-fonti-prima.json');
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

const DOMANDE = [
    { id: 'v1', tipo: 'vaga', q: 'Cosa c\'è qui?' },
    { id: 'v2', tipo: 'vaga', q: 'Quanto ci resto?' },
    { id: 'v3', tipo: 'vaga', q: 'È aperto?' },
    { id: 'v4', tipo: 'vaga', q: 'Mi racconti qualcosa di questo posto?' },
    { id: 'v5', tipo: 'vaga', q: 'Com\'è fatto?' },
    { id: 's1', tipo: 'specifica', q: 'Chi ha costruito la Cattedrale di Sant\'Agata?' },
    { id: 's2', tipo: 'specifica', q: 'A che ora è prevista la tappa al Teatro romano di Catania?' },
    { id: 's3', tipo: 'specifica', q: 'Cos\'è il Monastero dei Benedettini di San Nicolò l\'Arena?' },
    { id: 's4', tipo: 'specifica', q: 'Per cosa è famosa Via dei Crociferi?' },
    { id: 's5', tipo: 'specifica', q: 'Quanto mi fermo al Teatro Massimo Bellini?' },
];
const SOLO = (process.env.SOLO || '').split(',').filter(Boolean);
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


const esito = { base: BASE, iniziato: new Date().toISOString(), titolo: null, schedaAperta: TOUR.steps[0].title, risposte: [], richieste: [] };
const browser = await webkit.launch();
const foto = async (page, nome) => { const f = path.join(OUT, `${nome}.png`); await page.screenshot({ path: f }); return path.relative(process.cwd(), f); };
const cassetto = (page) => page.locator('div.fixed.bottom-0.rounded-t-3xl').filter({ has: page.getByPlaceholder('Scrivi qui...') });
const chatTesto = (page) => cassetto(page).innerText().catch(() => null);

async function chiedi(page, domanda) {
    const r = {};
    await page.getByPlaceholder('Scrivi qui...').fill(domanda);
    const t0 = Date.now();
    await page.getByPlaceholder('Scrivi qui...').press('Enter');
    await page.locator('[data-testid="chat-attesa"]').waitFor({ timeout: 5000 }).catch(() => {});
    await page.locator('[data-testid="chat-attesa"]').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
    r.msSchermo = Date.now() - t0;
    await page.waitForTimeout(400);
    r.fonti = await page.locator('[data-testid="chat-fonti"]').last().innerText({ timeout: 1000 }).catch(() => null);
    return r;
}
async function chiudiChat(page) {
    await page.mouse.click(195, 60);
    await page.getByPlaceholder('Scrivi qui...').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
}

try {
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
    const proxy = [];
    page.on('request', r => { if (/functions\/v1\/openai-proxy/.test(r.url()) && r.method() === 'POST') { try { const dv = r.postDataJSON()?.dv; proxy.push({ t: Date.now(), purpose: dv?.purpose || null, precarica: !!dv?.precarica, domanda: dv?.domanda || null, aperto: dv?.aperto?.nome || null, luoghi: Array.isArray(dv?.luoghi) ? dv.luoghi.length : null }); } catch { /* */ } } });
    page.on('response', async r => {
        if (!/functions\/v1\/openai-proxy/.test(r.url()) || r.request().method() !== 'POST') return;
        let dv = null; try { dv = r.request().postDataJSON()?.dv; } catch { /* */ }
        if (dv?.purpose !== 'chat') return;
        const j = await r.json().catch(() => ({}));
        const x = [...proxy].reverse().find(p => p.purpose === 'chat' && p.domanda === (dv.domanda || null) && p.precarica === !!dv.precarica && p.stato === undefined);
        if (x) { x.stato = r.status(); x.msServer = j?.chat?.ms ?? j?.precarica?.ms ?? null; x.esito = j?.chat?.esito ?? null; x.versione = j?.chat?.versione ?? null; x.msRete = Date.now() - x.t; x.precaricate = j?.precarica ?? null; }
    });
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/Unnivai|DoveVai/i.test(await page.title())) throw new Error('titolo non Unnivai: niente credenziali');
    await page.getByText('Accedi →').click();
    await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await page.getByText('Accedi Ora').click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await consensoAi(page);
    await page.waitForTimeout(2500);

    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((tour) => {
        const route = tour.steps.map((s, i) => ({ latitude: s.lat, longitude: s.lng, label: s.title, title: s.title, name: s.title, description: s.description, category: 'Punto Mappa', image: null, index: i, type: 'waypoint' }));
        window.history.replaceState({ usr: { route, tourData: tour }, key: 'chat-focus', idx: 0 }, '', '/map');
    }, TOUR);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="map-avvia-card"]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(3000);
    esito.tAvvia = Date.now();
    await page.getByText('Avvia', { exact: true }).first().click();
    for (let k = 0; k < 4; k++) { await page.evaluate(([la, ln]) => window.__gps.emit(la, ln, 8), [INIZIO.lat, INIZIO.lng]); await page.waitForTimeout(700); }
    await page.getByTestId('nav-hud-barra').waitFor({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.getByLabel(`Apri la scheda: ${TOUR.steps[0].title}`).first().click({ timeout: 15000 });
    await page.getByTestId('scheda-tappa').waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    esito.secondiDaAvviaAllaScheda = Math.round((Date.now() - esito.tAvvia) / 100) / 10;
    for (const d of DOMANDE) {
        if (SOLO.length && !SOLO.includes(d.id)) continue;
        // le vaghe con la scheda aperta (la chat si apre dalla scheda); le specifiche pure: stessa strada, conversazione nuova
        await page.getByTestId('chiedi-guida-scheda').click();
        await page.getByPlaceholder('Scrivi qui...').waitFor({ timeout: 10000 });
        await page.waitForTimeout(500);
        const focus = (await chatTesto(page) || '').match(/Focus:[^\n]*/)?.[0] || null;
        const r = await chiedi(page, d.q);
        const testo = await chatTesto(page);
        const bolle = await cassetto(page).locator('.rounded-bl-sm.border').allInnerTexts().catch(() => []);
        const ultima = (bolle[bolle.length - 1] || '').split('\n').map(l => l.trim()).filter(l => l && !/^unnivai ai$/i.test(l) && !/^Fonti lette:/.test(l));
        r.risposta = ultima.join(' ') || null;
        r.testoChat = testo;
        esito.risposte.push({ ...d, focus, ...r });
        console.log(d.id, r.msSchermo, 'ms');
        await chiudiChat(page);
        await page.getByTestId('scheda-tappa').waitFor({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);
    }
    esito.richieste = proxy;
    await ctx.close();
} catch (e) {
    esito.errore = String(e?.message || e).slice(0, 300);
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
    esito.finito = new Date().toISOString();
    fs.writeFileSync(ESITI, JSON.stringify(esito, null, 1));
    const ms = esito.risposte.map(r => r.msSchermo).sort((a, b) => a - b);
    console.log(JSON.stringify({ errore: esito.errore || null, n: ms.length, mediana: ms.length ? ms[Math.floor((ms.length - 1) / 2)] : null, ms }));
}
