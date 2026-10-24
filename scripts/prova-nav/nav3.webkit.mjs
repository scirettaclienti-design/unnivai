/**
 * NAV-2 — prova in WebKit (profilo iPhone 13) della mappa durante un giro di Catania a 12 tappe: anteprima (percorso, banner posizione,
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
        stops: c.tours[0].stops.map(s => ({ title: s.title, latitude: s.lat, longitude: s.lng, description: s.description, types: s.types,
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
const esito = { tag: TAG, ora: ORA, stati: STATI, base: BASE, richieste: { directions: 0 } };
try {
    { const c = await browser.newContext(); const p = await c.newPage(); await p.goto(BASE, { waitUntil: 'domcontentloaded' }); const t = await p.title(); await c.close(); if (!/DoveVai/i.test(t)) throw new Error(`La pagina su ${BASE} non e' DoveVai (titolo: ${t}): niente credenziali.`); }
    const statePath = await accedi(browser);
    const giro = tappeDelGiro('navsim-catania');
    const vere = giro.stops.filter(s => !s.tempoLibero).map(s => ({ ...s, lat: s.latitude, lng: s.longitude }));
    const legs = JSON.parse(fs.readFileSync(PERCORSI_FILE, 'utf8'))['navsim-catania'] || JSON.parse(fs.readFileSync(PERCORSI_FILE, 'utf8')).catania;
    const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath, locale: 'it-IT', timezoneId: 'Europe/Rome', geolocation: { latitude: 37.5024, longitude: 15.0871 }, permissions: ['geolocation'] });
    if (process.env.NAV_CLOCK !== 'off') await ctx.clock.install({ time: new Date(ORA) });
    await ctx.addInitScript(GPS_FINTO);
    const page = await ctx.newPage();
    const errori = [];
    page.on('pageerror', e => errori.push(String(e?.message || e).slice(0, 200)));
    page.on('request', r => { if (/DirectionsService/.test(r.url())) esito.richieste.directions += 1; });
    // MAPPA-STILE — quale Map ID chiede la mappa (NAV_MAPID_CERCA: i Map ID da cercare negli indirizzi delle richieste di Google)
    const cercati = (process.env.NAV_MAPID_CERCA || '').split(',').filter(Boolean);
    esito.mapIdVisti = {};
    page.on('request', r => { for (const id of cercati) if (r.url().includes(id)) esito.mapIdVisti[id] = (esito.mapIdVisti[id] || 0) + 1; });
    await caricaGiro(page, giro);
    await page.waitForTimeout(9000);
    await page.getByText('Avvia', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    await page.getByText('Avvia Navigazione').click();
    await page.waitForTimeout(2500);
    const emit = (p, acc = 8) => page.evaluate(([la, ln, a]) => window.__gps.emit(la, ln, a), [p.lat, p.lng, acc]);
    const stile = () => page.evaluate(() => document.querySelector('[data-stile-mappa]')?.getAttribute('data-stile-mappa') ?? null);
    const snap = async (nome) => { await page.screenshot({ path: path.join(OUT, `${TAG}-${nome}.png`) }); };
    // verso la 1ª tappa: qualche posizione sul percorso a piedi (la 1ª tappa e' a ~250 m dalla partenza)
    const pts0 = legs[0].punti;
    await emit({ lat: vere[0].lat + 0.0012, lng: vere[0].lng });
    await page.waitForTimeout(1200);
    esito.stile = await stile();
    // MAPPA-STILE — il filo del giorno non copre il tasto indietro (rettangoli sullo schermo, in px CSS)
    esito.indietro = await page.evaluate(() => {
        const r = (el) => { const b = el?.getBoundingClientRect(); return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null; };
        const ind = document.querySelector('a[aria-label="Torna alla home"]'), filo = document.querySelector('[data-testid="filo"]'), pill = document.querySelector('[data-testid="nav-hud-barra"]');
        const tocca = (a, b) => !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        const top = ind ? document.elementFromPoint(ind.getBoundingClientRect().x + ind.getBoundingClientRect().width / 2, ind.getBoundingClientRect().y + ind.getBoundingClientRect().height / 2) : null;
        return { indietro: r(ind), filo: r(filo), pillola: r(pill), siSovrappongono: tocca(r(ind), r(filo)) || tocca(r(ind), r(pill)), elementoInCimaAlCentro: top ? (top.closest('a')?.getAttribute('aria-label') || top.tagName) : null };
    });
    await snap('stato-1-cammino');
    esito.pillola = await page.getByTestId('nav-pillola').innerText().catch(() => null);
    esito.filo = await page.getByTestId('filo-frase').innerText().catch(() => null);
    if (STATI === 'flusso') {
        for (let i = 0; i < 3; i++) { await emit(vere[0]); await page.waitForTimeout(500); }
        await page.getByTestId('rito-arrivo').waitFor({ timeout: 5000 });
        await snap('stato-8-rito-arrivo');
        esito.rito = await page.getByTestId('rito-arrivo').innerText().catch(() => null);
        await page.getByTestId('arrivo').waitFor({ timeout: 8000 });
        await page.waitForTimeout(700);
        esito.arrivo = await page.getByTestId('arrivo').innerText().catch(() => null);
        await snap('stato-3-arrivo');
        await page.getByText('La scheda').click();
        await page.getByTestId('scheda-scheda').waitFor({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(600);
        await snap('stato-4-scheda-tappa');
        esito.scheda = await page.getByTestId('scheda-tappa').innerText().catch(() => null);
        await page.getByText(/^Riparti/).first().click();
        await page.waitForTimeout(800);
        // si salta fino all'ultima tappa e si arriva: la fine del giro
        for (let k = 0; k < vere.length - 2; k++) { await page.getByText('Salta', { exact: true }).first().click(); await page.waitForTimeout(250); }
        await page.getByText('Sono arrivato').first().click();
        await page.waitForTimeout(4500);
        await snap('stato-5-fine-giro');
        esito.fine = await page.getByTestId('fine-giro').innerText().catch(() => null);
    }
    esito.erroriPagina = errori;
    await ctx.close();
} finally {
    await browser.close();
    fs.writeFileSync(ESITI, JSON.stringify(esito, null, 1));
}
console.log(JSON.stringify({ tag: TAG, stile: esito.stile, pillola: esito.pillola, filo: esito.filo, directions: esito.richieste.directions, errori: esito.erroriPagina?.length }));
