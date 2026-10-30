/**
 * GIRO-LONTANO — prova in WebKit (iPhone 13) di un giro di Catania guardato da lontano (GPS finto a Roma) e da vicino (GPS finto a Catania).
 *   NAV_BASE=http://localhost:<porta> NAV_TAG=prima|dopo FASE=mappa|crea node scripts/prova-nav/giro-lontano.webkit.mjs
 *  · FASE=mappa: il giro `navsim-catania` di NAV-SIM passato alla mappa come «Vedi su Mappa» (nessuna chiamata AI). Panoramica (testo della card:
 *    durata e km), «Avvia», luminanza dello schermo dopo 4 s, pillola della distanza. Due posizioni: Roma (535 km) e Catania (vicino alla tappa 1).
 *  · FASE=crea: un giro VERO generato da Crea («un giro a Catania», account di prova, nessun contatore) con il GPS a Roma e poi a Catania:
 *    orari delle tappe, etichetta della partenza, panoramica, «Avvia».
 * Prima delle credenziali: porta e titolo «DoveVai» verificati (CLAUDE.md). Credenziali da .env.local, mai stampate.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.NAV_BASE || 'http://localhost:5191';
const TAG = process.env.NAV_TAG || 'prima';
const FASE = process.env.FASE || 'mappa';
const ORA = process.env.NAV_ORA || '2026-10-30T15:00:00+01:00';
const GIRI_FILE = 'docs/prove/dati/2026-10-16-nav-sim-giri.json';
const OUT = path.resolve('docs/prove/schermate/giro-lontano');
const ESITI = `docs/prove/dati/2026-10-30-giro-lontano-${FASE}-${TAG}.json`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lontano-'));
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const ROMA = { lat: 41.9009, lng: 12.4833 }; // piazza di Spagna

const GPS_FINTO = (inizio) => {
    const g = { watchers: new Map(), id: 0, pos: inizio, deny: false };
    const mk = (p) => ({ coords: { latitude: p.lat, longitude: p.lng, accuracy: 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
    const geo = {
        getCurrentPosition(ok, ko) { if (g.deny) setTimeout(() => ko?.({ code: 1, message: 'denied' }), 20); else if (g.pos) setTimeout(() => ok(mk(g.pos)), 20); },
        watchPosition(ok, ko, o) {
            const id = ++g.id; g.watchers.set(id, { ok, ko, o });
            if (g.deny) setTimeout(() => ko?.({ code: 1, message: 'denied' }), 20); else if (g.pos) setTimeout(() => ok(mk(g.pos)), 30);
            return id;
        },
        clearWatch(id) { g.watchers.delete(id); },
    };
    g.emit = (lat, lng) => { g.pos = { lat, lng }; for (const w of [...g.watchers.values()]) w.ok(mk(g.pos)); };
    window.__gps = g;
    Object.defineProperty(Navigator.prototype, 'geolocation', { get: () => geo, configurable: true });
    Object.defineProperty(Navigator.prototype, 'permissions', { configurable: true, get: () => ({ query: async () => ({ state: 'granted', addEventListener() {}, removeEventListener() {} }) }) });
};

async function controllaPorta(browser) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const titolo = await page.title();
    await ctx.close();
    if (!/DoveVai/i.test(titolo)) throw new Error(`La pagina su ${BASE} non è DoveVai (titolo: ${titolo}): niente credenziali.`);
}
async function accedi(browser) {
    const statePath = path.join(TMP, 'sessione.json');
    if (!env.TEST_ACCOUNT_EMAIL || !env.TEST_ACCOUNT_PASSWORD) throw new Error('Mancano le credenziali di prova in .env.local');
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai sulla pagina di accesso: niente credenziali.');
    await page.getByText('Accedi →').click();
    await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await page.getByText('Accedi Ora').click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await page.waitForTimeout(2500);
    await ctx.storageState({ path: statePath });
    await ctx.close();
    return statePath;
}
function tappeDelGiro(caso) {
    const g = JSON.parse(fs.readFileSync(GIRI_FILE, 'utf8'));
    const c = g.casi.find(x => x.id === caso);
    return { luogo: c.luogo, titolo: c.tours[0].tema || `Il tuo giro a ${c.luogo}`,
        stops: c.tours[0].stops.map(s => ({ title: s.title, latitude: s.lat, longitude: s.lng, description: s.description, types: s.types, scheduledTime: s.at,
            place_id: s.place_id, moment: s.moment, type: s.tipoInterno || null, ...(s.tempoLibero ? { tempoLibero: true, stayMinutes: s.stay } : { stayMinutes: s.stay }) })) };
}
async function caricaGiro(page, giro) {
    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async (g) => {
        const { normalizeTour } = await import('/src/services/tourShape.js');
        const vere = g.stops.filter(s => !s.tempoLibero);
        const route = vere.map((s, i) => ({ latitude: s.latitude, longitude: s.longitude, label: s.title, title: s.title, name: s.title,
            description: s.description, category: s.type || 'Punto Mappa', image: null, index: i + 1, type: 'waypoint' }));
        const tourData = normalizeTour({ id: `ai-itinerary-navsim-${g.luogo}`, title: g.titolo, type: 'ai-generated', isAiGenerated: true,
            city: g.luogo, tags: ['AI'], stops: g.stops }, { cityFallback: g.luogo });
        window.history.replaceState({ usr: { route, tourData }, key: 'navsim', idx: 0 }, '', '/map');
    }, giro);
    await page.reload({ waitUntil: 'domcontentloaded' });
}
const luminanza = async (page, nome) => {
    const buf = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(OUT, `${FASE}-${TAG}-${nome}.png`), buf);
    return page.evaluate(async (b64) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = 60; c.height = 130; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 60, 130);
        // la fascia centrale (la mappa, senza la scheda in basso né la pillola in alto)
        const d = x.getImageData(0, 30, 60, 50).data; let neri = 0, somma = 0, varianza = 0; const ls = [];
        for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; ls.push(l); somma += l; if (l < 12) neri++; }
        const medio = somma / ls.length; for (const l of ls) varianza += (l - medio) ** 2;
        return { neri: +(neri / ls.length).toFixed(2), medio: Math.round(medio), contrasto: Math.round(Math.sqrt(varianza / ls.length)) };
    }, buf.toString('base64'));
};
const testoCard = (page) => page.evaluate(() => document.querySelector('[data-testid="map-avvia-card"]')?.innerText?.replace(/\s+/g, ' ').trim() || null);
const testoSchermo = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 4000));

async function giroSullaMappa(browser, statePath, nome, posizione, giro) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath, locale: 'it-IT', timezoneId: 'Europe/Rome' });
    await ctx.clock.install({ time: new Date(ORA) });
    await ctx.addInitScript(GPS_FINTO, posizione);
    const page = await ctx.newPage();
    const r = { nome, posizione, directions: 0, errori: [] };
    page.on('pageerror', e => r.errori.push(String(e?.message || e).slice(0, 160)));
    page.on('request', q => { if (/DirectionsService/.test(q.url())) r.directions += 1; });
    await caricaGiro(page, giro);
    await page.locator('[data-testid="map-avvia-card"]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(6000);
    r.card = await testoCard(page);
    r.panoramica = await luminanza(page, `${nome}-1-panoramica`);
    await page.getByText('Avvia', { exact: true }).first().click();
    await page.waitForTimeout(4500);
    r.dopoAvvia = await luminanza(page, `${nome}-2-avvia`);
    r.navigazione = await page.evaluate(() => !!document.querySelector('[data-testid="nav-scheda-maniglia"]'));
    const t = await testoSchermo(page);
    r.distanze = [...new Set(t.match(/\d+(?:[.,]\d+)?\s?(?:km|MIN|min)\b/g) || [])].slice(0, 12);
    r.messaggio = (t.match(/Sei a [^.]*\./) || [null])[0];
    r.cardDopo = await testoCard(page);
    await ctx.close();
    return r;
}

/** FASE=crea — un giro vero da Crea con il GPS finto in `posizione`: orari, etichetta della partenza, panoramica, «Avvia». */
async function giroDaCrea(browser, statePath, nome, posizione) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath, locale: 'it-IT', timezoneId: 'Europe/Rome' });
    await ctx.clock.install({ time: new Date(ORA) });
    await ctx.addInitScript(GPS_FINTO, posizione);
    const page = await ctx.newPage();
    const r = { nome, posizione, errori: [] };
    page.on('pageerror', e => r.errori.push(String(e?.message || e).slice(0, 160)));
    await page.goto(`${BASE}/ai-itinerary`, { waitUntil: 'domcontentloaded' });
    await page.locator('textarea').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(2500); // la posizione si legge all'apertura (in sottofondo)
    // un pannello aperto dalla barra in alto (scelta della città, avvisi) copre la pagina: lo si chiude come farebbe una persona
    r.pannello = await page.evaluate(() => document.querySelector('header .fixed.inset-0')?.parentElement?.innerText?.replace(/\s+/g, ' ').slice(0, 200) || null);
    if (r.pannello) {
        fs.writeFileSync(path.join(OUT, `${FASE}-${TAG}-${nome}-0-pannello.png`), await page.screenshot({ type: 'png' }));
        await page.getByText('Conferma Posizione').click();
        await page.waitForTimeout(1500);
    }
    await page.locator('textarea').first().fill('un giro a Catania');
    const t0 = Date.now();
    await page.getByText('Genera Viaggio').click();
    await page.getByText('Vedi su Mappa').waitFor({ timeout: 240000 });
    r.generazioneMs = Date.now() - t0;
    await page.waitForTimeout(1000);
    r.partenza = await page.evaluate(() => document.querySelector('[data-partenza]')?.innerText?.replace(/\s+/g, ' ').trim() || null);
    r.orari = await page.evaluate(() => [...new Set((document.querySelector('main')?.innerText || document.body.innerText).match(/\b\d{1,2}:\d{2}\b/g) || [])].slice(0, 16));
    fs.writeFileSync(path.join(OUT, `${FASE}-${TAG}-${nome}-1-giro.png`), await page.screenshot({ type: 'png', fullPage: false }));
    await page.getByText('Vedi su Mappa').click();
    await page.locator('[data-testid="map-avvia-card"]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(6000);
    r.card = await testoCard(page);
    r.panoramica = await luminanza(page, `${nome}-2-panoramica`);
    await page.getByText('Avvia', { exact: true }).first().click();
    await page.waitForTimeout(4500);
    r.dopoAvvia = await luminanza(page, `${nome}-3-avvia`);
    r.navigazione = await page.evaluate(() => !!document.querySelector('[data-testid="nav-scheda-maniglia"]'));
    r.avvisoLontano = await page.evaluate(() => document.querySelector('[data-testid="avviso-lontano"]')?.innerText || null);
    const t = await testoSchermo(page);
    r.distanze = [...new Set(t.match(/\d+(?:[.,]\d+)?\s?(?:km|MIN|min)\b/g) || [])].slice(0, 12);
    await ctx.close();
    return r;
}

const browser = await webkit.launch();
const esito = { tag: TAG, fase: FASE, ora: ORA, base: BASE, casi: [] };
try {
    await controllaPorta(browser);
    const statePath = await accedi(browser);
    if (FASE === 'mappa') {
        const giro = tappeDelGiro('navsim-catania');
        const t1 = giro.stops.find(s => !s.tempoLibero);
        esito.casi.push(await giroSullaMappa(browser, statePath, 'roma', ROMA, giro));
        esito.casi.push(await giroSullaMappa(browser, statePath, 'catania', { lat: t1.latitude + 0.003, lng: t1.longitude }, giro));
    }
    if (FASE === 'crea') {
        esito.casi.push(await giroDaCrea(browser, statePath, 'roma', ROMA));
        esito.casi.push(await giroDaCrea(browser, statePath, 'catania', { lat: 37.5047, lng: 15.0871 })); // via Etnea, a ~200 m da piazza Duomo
    }
} finally {
    fs.writeFileSync(ESITI, JSON.stringify(esito, null, 1));
    console.log(JSON.stringify(esito, null, 1));
    await browser.close();
}
