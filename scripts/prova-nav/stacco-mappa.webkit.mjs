/**
 * (base: nav3.webkit.mjs) STACCO-MAPPA — misura prima/dopo: apertura della mappa e quanto la mappa sparisce (o si fa bianca) al passaggio Avvia → navigazione. NAV-CAMERA — prova in WebKit (profilo iPhone 13): panoramica scura → «Avvia» → volo → cammino inclinato nel colore della fascia, con GPS finto e ora finta.
 *   NAV_BASE=http://localhost:<porta> NAV_ORA=2026-10-24T10:00:00+02:00 NAV_TAG=giorno node scripts/prova-nav/nav-camera.webkit.mjs
 * Cattura i fotogrammi del passaggio (ogni ~120 ms), controlla che nessuno sia bianco, misura l'apertura della mappa e la dissolvenza.
 * Prima: NAV-2 — prova in WebKit (profilo iPhone 13) della mappa durante un giro di Catania a 12 tappe: anteprima (percorso, banner posizione,
 * card «Avvia»), pannello del mezzo, navigazione con il tratto fatto/prossimo/resto. Lo stesso script gira su due build (NAV_BASE) e
 * scrive schermate e misure con un'etichetta (NAV_TAG: prima | dopo).
 *
 *   NAV_BASE=http://localhost:<porta> NAV_TAG=dopo node scripts/prova-nav/nav2.webkit.mjs
 *
 * Il giro: il caso `navsim-catania` di NAV-SIM (docs/prove/dati/2026-10-16-nav-sim-giri.json), passato alla mappa come «Vedi su Mappa» di
 * Crea. Il GPS e' finto (una posizione per volta, sulla strada a piedi gia' calcolata da NAV-SIM). Nessuna modifica all'app.
 * Prima delle credenziali: titolo «DoveVai» verificato (CLAUDE.md). Credenziali da .env.local, mai stampate.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.NAV_BASE || 'http://localhost:5187';
const TAG = process.env.NAV_TAG || 'nav3';
const ORA = process.env.NAV_ORA || '2026-10-27T12:00:00+01:00';
const STATI = process.env.NAV_STATI || 'flusso';
const GIRI_FILE = 'docs/prove/dati/2026-10-16-nav-sim-giri.json';
const PERCORSI_FILE = 'docs/prove/dati/2026-10-16-nav-sim-percorsi.json';
const OUT = path.resolve(process.env.NAV_SCHERMATE || 'docs/prove/schermate/nav-3');
const ESITI = process.env.NAV_ESITI || `docs/prove/dati/2026-10-24-nav-3-${TAG}.json`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nav2-'));
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const R = 6371000, rad = (x) => (x * Math.PI) / 180;
const dist = (a, b) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2));

const GPS_FINTO = () => {
    const g = { watchers: new Map(), id: 0, pos: null, deny: false, chiamate: 0 };
    const mk = (p) => ({ coords: { latitude: p.lat, longitude: p.lng, accuracy: p.acc ?? 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
    const geo = {
        getCurrentPosition(ok, ko) {
            if (g.deny) setTimeout(() => ko?.({ code: 1, message: 'User denied Geolocation' }), 20);
            else if (g.pos) setTimeout(() => ok(mk(g.pos)), 20);
        },
        watchPosition(ok, ko, o) {
            const id = ++g.id;
            g.chiamate += 1;
            g.watchers.set(id, { ok, ko, o });
            if (g.deny) setTimeout(() => ko?.({ code: 1, message: 'User denied Geolocation' }), 20);
            return id;
        },
        clearWatch(id) { g.watchers.delete(id); },
    };
    g.emit = (lat, lng, acc) => { g.pos = { lat, lng, acc }; for (const w of [...g.watchers.values()]) w.ok(mk(g.pos)); };
    g.navWatch = () => [...g.watchers.values()].filter(w => w.o?.enableHighAccuracy).length;
    window.__gps = g;
    Object.defineProperty(Navigator.prototype, 'geolocation', { get: () => geo, configurable: true });
    // lo schermo bloccato: visibilityState «hidden», poi di nuovo «visible», con l'evento come su Safari
    window.__vis = 'visible';
    Object.defineProperty(Document.prototype, 'visibilityState', { get: () => window.__vis, configurable: true });
    Object.defineProperty(Document.prototype, 'hidden', { get: () => window.__vis === 'hidden', configurable: true });
    window.__setVis = (v) => { window.__vis = v; document.dispatchEvent(new Event('visibilitychange')); };
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

/** Le tappe vere del giro (senza il tempo libero), dal grezzo del banco. */
function tappeDelGiro(caso) {
    const g = JSON.parse(fs.readFileSync(GIRI_FILE, 'utf8'));
    const c = g.casi.find(x => x.id === caso);
    if (!c?.tours?.[0]) throw new Error(`giro ${caso} assente in ${GIRI_FILE}`);
    return { luogo: c.luogo, titolo: c.tours[0].tema || `Il tuo giro a ${c.luogo}`,
        stops: c.tours[0].stops.map(s => ({ title: s.title, latitude: s.lat, longitude: s.lng, description: s.description, types: s.types, scheduledTime: s.at,
            place_id: s.place_id, moment: s.moment, type: s.tipoInterno || null, ...(s.tempoLibero ? { tempoLibero: true, stayMinutes: s.stay } : { stayMinutes: s.stay }) })) };
}

/** Mette il giro nella mappa come «Vedi su Mappa» di Crea: route + tourData (normalizeTour vero, importato dal vite dell'app). */
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



const browser = await webkit.launch();
const DUE_CLIC = process.env.NAV_DUE_CLIC === '1'; // la versione di prima: «Avvia» apriva il pannello, poi «Avvia Navigazione»
const esito = { tag: TAG, ora: ORA, base: BASE, dueClic: DUE_CLIC, misure: {}, fotogrammi: [] };
const luminanza = async (page, nome) => {
    const buf = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(OUT, `${TAG}-${nome}.png`), buf);
    return page.evaluate(async (b64) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = 60; c.height = 130; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 60, 130);
        const d = x.getImageData(0, 0, 60, 130).data; let bianchi = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245) bianchi++;
        return { bianchi: bianchi / (d.length / 4) };
    }, buf.toString('base64'));
};
try {
    await controllaPorta(browser);
    const statePath = await accedi(browser);
    const giro = tappeDelGiro('navsim-catania');
    const vere = giro.stops.filter(s => !s.tempoLibero).map(s => ({ ...s, lat: s.latitude, lng: s.longitude }));
    const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath, locale: 'it-IT', timezoneId: 'Europe/Rome', geolocation: { latitude: vere[0].lat + 0.0012, longitude: vere[0].lng }, permissions: ['geolocation'] });
    await ctx.clock.install({ time: new Date(ORA) });
    await ctx.addInitScript(GPS_FINTO);
    const page = await ctx.newPage();
    const t0 = Date.now();
    await caricaGiro(page, giro);
    for (let k = 0; k < 6; k++) { await page.evaluate(([la, ln]) => window.__gps?.emit(la, ln, 8), [vere[0].lat + 0.0012, vere[0].lng]); await page.waitForTimeout(500); }
    await page.waitForFunction(() => document.querySelector('.gm-style canvas') || document.querySelector('.gm-style'), null, { timeout: 40000 });
    esito.misure.aperturaMappaMs = Date.now() - t0 - 3000; // meno le attese fisse per il GPS finto
    await page.waitForTimeout(6000);
    await page.evaluate(() => {
        window.__campioni = []; const t0 = performance.now();
        window.__poll = setInterval(() => { const m = [...document.querySelectorAll('.gm-style')]; window.__campioni.push({ t: Math.round(performance.now() - t0), mappe: m.length, canvas: document.querySelectorAll('.gm-style canvas').length }); }, 25);
    });
    await page.getByText('Avvia', { exact: true }).first().click();
    if (DUE_CLIC) { await page.waitForTimeout(1200); await page.getByText('Avvia Navigazione').click(); }
    await page.evaluate(([la, ln]) => window.__gps?.emit(la, ln, 8), [vere[0].lat + 0.0012, vere[0].lng]);
    for (let i = 0; i < 16; i++) { esito.fotogrammi.push({ nome: `volo-${i}`, ...(await luminanza(page, `volo-${String(i).padStart(2, '0')}`)) }); await page.waitForTimeout(80); }
    await page.waitForTimeout(2500);
    const camp = await page.evaluate(() => { clearInterval(window.__poll); return window.__campioni; });
    // «stacco» = il tempo in cui non c'e' nessuna mappa (o nessun canvas) a schermo
    let senza = 0, ultimo = null;
    for (const c of camp) { if (ultimo !== null && (c.canvas === 0 || c.mappe === 0)) senza += c.t - ultimo; ultimo = c.t; }
    esito.misure.msSenzaMappa = senza;
    esito.misure.campioni = camp.length;
    esito.misure.maxMappeContemporanee = Math.max(...camp.map(c => c.mappe));
    esito.bianchi = esito.fotogrammi.filter(f => f.bianchi > 0.5).map(f => f.nome);
    await ctx.close();
} finally {
    await browser.close();
    fs.writeFileSync(ESITI, JSON.stringify(esito, null, 1));
}
console.log(JSON.stringify({ tag: TAG, dueClic: DUE_CLIC, ...esito.misure, bianchi: esito.bianchi }));
