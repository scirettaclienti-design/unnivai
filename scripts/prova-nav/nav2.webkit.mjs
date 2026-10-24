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
const TAG = process.env.NAV_TAG || 'prova';
const GIRI_FILE = 'docs/prove/dati/2026-10-16-nav-sim-giri.json';
const PERCORSI_FILE = 'docs/prove/dati/2026-10-16-nav-sim-percorsi.json';
const OUT = path.resolve(process.env.NAV_SCHERMATE || 'docs/prove/schermate/nav-2');
const ESITI = process.env.NAV_ESITI || `docs/prove/dati/2026-10-24-nav-2-${TAG}.json`;
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


/** La geometria della pagina: dove sta il fondo dei pannelli rispetto all'altezza visibile. */
const misuraPagina = (page) => page.evaluate(() => {
    const vv = window.visualViewport;
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }; };
    const pulsante = (t) => [...document.querySelectorAll('button')].find(b => new RegExp(t, 'i').test((b.innerText || '').trim()));
    const root = document.querySelector('[data-testid="map-root"]') || document.querySelector('.h-screen');
    const card = pulsante('^Avvia$')?.closest('div.rounded-2xl') || null;
    return {
        innerHeight: window.innerHeight, visualViewportHeight: Math.round(vv?.height ?? window.innerHeight),
        radice: rect(root), cardAvvia: rect(card), pulsanteAvviaNav: rect(pulsante('^Avvia Navigazione')),
        bannerPosizione: /Attiva la tua posizione/.test(document.body.innerText),
        linkEsterni: [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => /maps\.apple|google\.com\/maps/.test(h)),
        apriInMappe: /Apri in Mappe/i.test(document.body.innerText),
        barra: (document.body.innerText.match(/Tappa \d+\/\d+/i) || [null])[0],
    };
});

const browser = await webkit.launch();
const esito = { tag: TAG, base: BASE, fasi: {} };
try {
    // la porta e il titolo, prima di qualunque credenziale
    {
        const c = await browser.newContext(); const p = await c.newPage();
        await p.goto(BASE, { waitUntil: 'domcontentloaded' });
        const titolo = await p.title(); await c.close();
        if (!/DoveVai/i.test(titolo)) throw new Error(`La pagina su ${BASE} non e' DoveVai (titolo: ${titolo}): niente credenziali.`);
    }
    const statePath = await accedi(browser);
    const giro = tappeDelGiro('navsim-catania');
    const vere = giro.stops.filter(s => !s.tempoLibero).map(s => ({ ...s, lat: s.latitude, lng: s.longitude }));
    esito.tappe = vere.length;
    const legs = JSON.parse(fs.readFileSync(PERCORSI_FILE, 'utf8'))['navsim-catania'] || JSON.parse(fs.readFileSync(PERCORSI_FILE, 'utf8')).catania;
    const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath, locale: 'it-IT', timezoneId: 'Europe/Rome', geolocation: { latitude: 37.5024, longitude: 15.0871 }, permissions: ['geolocation'] });
    await ctx.addInitScript(GPS_FINTO);
    const page = await ctx.newPage();
    const errori = [];
    page.on('pageerror', e => errori.push(String(e?.message || e).slice(0, 200)));
    await caricaGiro(page, giro);
    await page.waitForFunction(() => document.querySelectorAll('canvas, gmp-map, [class*="gm-style"]').length > 0, null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(9000); // la mappa e il percorso
    await page.screenshot({ path: path.join(OUT, `${TAG}-01-anteprima.png`) });
    esito.fasi.anteprima = await misuraPagina(page);

    await page.getByText('Avvia', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `${TAG}-02-pannello-mezzo.png`) });
    esito.fasi.pannelloMezzo = await misuraPagina(page);

    await page.getByText('Avvia Navigazione').click();
    await page.waitForTimeout(2500);
    // la partenza: 250 m prima della 1ª tappa, poi si cammina sul percorso a piedi
    const emit = (p, acc = 8) => page.evaluate(([la, ln, a]) => window.__gps.emit(la, ln, a), [p.lat, p.lng, acc]);
    const fermo = async (p, n = 3) => { for (let i = 0; i < n; i++) { await emit(p); await page.waitForTimeout(1100); } };
    await fermo(vere[0], 3);   // arrivato alla 1ª tappa
    // lungo il tratto 0 (1ª -> 2ª): tre quarti della strada
    const pts0 = legs[0].punti;
    for (let k = 1; k <= 3; k++) { await emit(pts0[Math.min(pts0.length - 1, Math.floor((pts0.length * k) / 4))]); await page.waitForTimeout(1200); }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `${TAG}-03-navigazione-tratto-0.png`) });
    esito.fasi.navigazione1 = await misuraPagina(page);
    // arrivo alla 2ª e cammino verso la 3ª: il tratto 0 e' fatto, il tratto 1 e' quello arancione
    const passi = (pts, da, a) => pts.slice(da, a);
    for (const p of passi(pts0, Math.floor(pts0.length * 0.8), pts0.length)) { await emit(p); await page.waitForTimeout(400); }
    await fermo(vere[1], 3);
    const pts1 = legs[1].punti;
    for (let k = 1; k <= 2; k++) { await emit(pts1[Math.min(pts1.length - 1, Math.floor((pts1.length * k) / 3))]); await page.waitForTimeout(1200); }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `${TAG}-04-navigazione-tratto-1.png`) });
    esito.fasi.navigazione2 = await misuraPagina(page);
    esito.erroriPagina = errori;
    await ctx.close();
} finally {
    await browser.close();
    fs.writeFileSync(ESITI, JSON.stringify(esito, null, 1));
}
console.log(JSON.stringify({ tag: TAG, anteprima: { banner: esito.fasi.anteprima?.bannerPosizione, card: esito.fasi.anteprima?.cardAvvia }, nav: { barra: esito.fasi.navigazione2?.barra, apriInMappe: esito.fasi.navigazione2?.apriInMappe, linkEsterni: esito.fasi.navigazione2?.linkEsterni }, errori: esito.erroriPagina?.length }));
