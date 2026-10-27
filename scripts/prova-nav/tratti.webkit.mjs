/**
 * NAV-TRATTI — il percorso si legge come una guida. Camminata simulata sul giro VERO di Catania (giro e percorso a piedi di NAV-SIM)
 * nel motore di Safari (WebKit di Playwright, iPhone 13), con la posizione simulata. Intercetta ogni Polyline che l'app disegna
 * (colore, spessore, quanti punti, se e' sulla mappa) e fa le schermate: panoramica, inizio, metà tratto, dopo un arrivo.
 *
 *   NAV_BASE=https://unnivai.vercel.app node scripts/prova-nav/tratti.webkit.mjs <etichetta>
 *   NAV_BASE=http://localhost:<porta> node scripts/prova-nav/tratti.webkit.mjs <etichetta>
 *
 * Prima delle credenziali: titolo «DoveVai» verificato (CLAUDE.md). Credenziali da .env.local, mai stampate.
 * Esito: docs/prove/dati/2026-10-27-nav-tratti-<etichetta>.json e schermate in docs/prove/schermate/nav-tratti/<etichetta>-*.png
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.NAV_BASE || 'http://localhost:5181';
const ETICHETTA = process.argv[2] || 'prova';
const GIRI_FILE = 'docs/prove/dati/2026-10-16-nav-sim-giri.json';
const PERCORSI_FILE = 'docs/prove/dati/2026-10-16-nav-sim-percorsi.json';
const ORA = process.env.NAV_ORA || null; // ora simulata (per le fasce: mattina, tramonto, notte)
const MISURA = process.env.NAV_MISURA === '1'; // misura i colori veri della mappa (senza il percorso) invece di fare le 4 schermate
const OUT = `docs/prove/dati/2026-10-27-nav-tratti-${ETICHETTA}.json`;
const SHOTS = path.resolve('docs/prove/schermate/nav-tratti');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tratti-'));
fs.mkdirSync(SHOTS, { recursive: true });
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));

const PASSO_M = 15, PARTENZA_M = 250;
const R = 6371000, rad = (x) => (x * Math.PI) / 180;
const dist = (a, b) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2));
const sposta = (p, est, nord) => ({ lat: p.lat + nord / 111320, lng: p.lng + est / (111320 * Math.cos(rad(p.lat))) });
function campiona(punti, passo) {
    const out = [punti[0]];
    let resto = 0;
    for (let i = 1; i < punti.length; i++) {
        const a = punti[i - 1], b = punti[i], d = dist(a, b);
        let t = passo - resto;
        while (t <= d) { out.push({ lat: a.lat + ((b.lat - a.lat) * t) / d, lng: a.lng + ((b.lng - a.lng) * t) / d }); t += passo; }
        resto = d - (t - passo);
    }
    const ultimo = punti[punti.length - 1];
    if (dist(out[out.length - 1], ultimo) > 1) out.push(ultimo);
    return out;
}

const GPS_FINTO = () => {
    const g = { watchers: new Map(), id: 0, pos: null };
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

/** Intercetta ogni Polyline creata dall'app: opzioni al momento della creazione, e se e' ancora sulla mappa. */
const INTERCETTA = () => {
    const g = window.google?.maps;
    if (!g?.Polyline || g.Polyline.__intercettata) return !!g?.Polyline?.__intercettata;
    const Orig = g.Polyline;
    const elenco = [];
    class Spia extends Orig {
        constructor(o) { super(o); this.__o = { strokeColor: o?.strokeColor ?? null, strokeOpacity: o?.strokeOpacity ?? null, strokeWeight: o?.strokeWeight ?? null, zIndex: o?.zIndex ?? null,
            tratteggio: Array.isArray(o?.icons) && o.icons.length > 0, iconColor: o?.icons?.[0]?.icon?.strokeColor ?? null, visible: o?.visible ?? true }; elenco.push(this); }
    }
    Spia.__intercettata = true;
    g.Polyline = Spia;
    window.__polylines = () => elenco.filter(p => { try { return !!p.getMap(); } catch { return false; } }).map(p => {
        let n = 0, da = null, a = null;
        try { const pa = p.getPath(); n = pa.getLength(); const f = pa.getAt(0), l = pa.getAt(n - 1); da = [+f.lat().toFixed(5), +f.lng().toFixed(5)]; a = [+l.lat().toFixed(5), +l.lng().toFixed(5)]; } catch { /* niente */ }
        return { ...p.__o, punti: n, da, a };
    });
    window.__nascondiPolilinee = () => elenco.forEach(p => { try { p.setMap(null); } catch { /* niente */ } });
    return true;
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
    if (!c?.tours?.[0]) throw new Error(`giro ${caso} assente in ${GIRI_FILE}`);
    return { luogo: c.luogo, titolo: c.tours[0].tema || `Il tuo giro a ${c.luogo}`,
        stops: c.tours[0].stops.map(s => ({ title: s.title, latitude: s.lat, longitude: s.lng, description: s.description, types: s.types,
            place_id: s.place_id, moment: s.moment, type: s.tipoInterno || null, ...(s.tempoLibero ? { tempoLibero: true, stayMinutes: s.stay } : { stayMinutes: s.stay }) })) };
}
/** Il giro nella mappa come lo passa «Vedi su Mappa» di Crea. In produzione il modulo sorgente non c'e' (bundle): si costruisce lo stesso oggetto a mano. */
async function caricaGiro(page, giro) {
    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async (g) => {
        const vere = g.stops.filter(s => !s.tempoLibero);
        const route = vere.map((s, i) => ({ latitude: s.latitude, longitude: s.longitude, label: s.title, title: s.title, name: s.title,
            description: s.description, category: s.type || 'Punto Mappa', image: null, index: i + 1, type: 'waypoint' }));
        let tourData;
        try {
            const { normalizeTour } = await import('/src/services/tourShape.js');
            tourData = normalizeTour({ id: `ai-itinerary-tratti-${g.luogo}`, title: g.titolo, type: 'ai-generated', isAiGenerated: true, city: g.luogo, tags: ['AI'], stops: g.stops }, { cityFallback: g.luogo });
        } catch {
            tourData = { id: `ai-itinerary-tratti-${g.luogo}`, title: g.titolo, type: 'ai-generated', isAiGenerated: true, city: g.luogo, tags: ['AI'],
                steps: vere.map((s, i) => ({ id: `s${i + 1}`, title: s.title, name: s.title, latitude: s.latitude, longitude: s.longitude, description: s.description, index: i + 1, stayMinutes: s.stayMinutes })) };
        }
        window.history.replaceState({ usr: { route, tourData }, key: 'tratti', idx: 0 }, '', '/map');
    }, giro);
    await page.reload({ waitUntil: 'domcontentloaded' });
}

const browser = await webkit.launch();
try {
    await controllaPorta(browser);
    const statePath = await accedi(browser);
    const giro = tappeDelGiro('navsim-catania');
    const vere = giro.stops.filter(s => !s.tempoLibero).map(s => ({ ...s, lat: s.latitude, lng: s.longitude }));
    const legs = JSON.parse(fs.readFileSync(PERCORSI_FILE, 'utf8')).catania;
    const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath, locale: 'it-IT', timezoneId: 'Europe/Rome' });
    if (ORA) await ctx.clock.install({ time: new Date(ORA) });
    await ctx.addInitScript(GPS_FINTO);
    const page = await ctx.newPage();
    const errori = [];
    page.on('pageerror', e => errori.push(String(e?.message || e).slice(0, 200)));
    const consoleApp = [];
    page.on('console', m => { const t = m.text(); if (/Directions failed|DVAI-Nav\]|routePoints/.test(t)) consoleApp.push(t.slice(0, 160)); });
    const t0 = Date.now();
    const log = (m) => console.error(`[tratti ${ETICHETTA}] ${Math.round((Date.now() - t0) / 1000)}s ${m}`);
    const emit = (p) => page.evaluate(([a, b]) => window.__gps.emit(a, b, 8), [p.lat, p.lng]).catch(() => {});
    const esito = { base: BASE, etichetta: ETICHETTA, momenti: {} };
    const momento = async (nome, extra = {}) => {
        await page.waitForTimeout(1500);
        const polilinee = await page.evaluate(() => (window.__polylines ? window.__polylines() : null)).catch(() => null);
        const file = path.join(SHOTS, `${ETICHETTA}-${nome}.png`);
        await page.screenshot({ path: file });
        esito.momenti[nome] = { ...extra, polilinee, schermata: path.relative(process.cwd(), file) };
        log(`${nome}: ${polilinee ? polilinee.length : '?'} tratti sulla mappa`);
    };

    /** I colori VERI della mappa in questo momento: la mappa senza il percorso, ridotta e contata a gruppi di colore (8 livelli per canale). */
    const paletta = async () => {
        await page.evaluate(() => window.__nascondiPolilinee?.());
        await page.waitForTimeout(1200);
        const buf = await page.screenshot();
        return page.evaluate(async (b64) => {
            const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
            const c = document.createElement('canvas'); c.width = 195; c.height = 300; const x = c.getContext('2d');
            // solo la fascia centrale dello schermo (tra i riquadri in alto e in basso): li' passa il percorso
            x.drawImage(img, 0, img.height * 0.28, img.width, img.height * 0.40, 0, 0, 195, 300);
            const d = x.getImageData(0, 0, 195, 300).data; const m = new Map();
            for (let i = 0; i < d.length; i += 4) { const k = [d[i] >> 3, d[i + 1] >> 3, d[i + 2] >> 3].join(','); m.set(k, (m.get(k) || 0) + 1); }
            const tot = d.length / 4;
            return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => { const [r, g, bl] = k.split(',').map(v => v * 8 + 4); return { rgb: [r, g, bl], quota: Math.round((n / tot) * 1000) / 10 }; });
        }, buf.toString('base64'));
    };

    await caricaGiro(page, giro);
    const partenza = sposta(vere[0], -PARTENZA_M * 0.6, -PARTENZA_M * 0.8);
    await page.evaluate(([a, b]) => { window.__gps.pos = { lat: a, lng: b, acc: 8 }; }, [partenza.lat, partenza.lng]);
    await page.waitForFunction(() => !!window.google?.maps?.Polyline, null, { timeout: 60000 });
    await page.evaluate(INTERCETTA);
    await page.waitForTimeout(4000);

    // 1. PANORAMICA: prima di «Avvia»
    await emit(partenza);
    await momento('1-panoramica');

    // 2. INIZIO: Avvia, ancora fermo alla partenza
    await page.getByText('Avvia', { exact: true }).click({ timeout: 30000 });
    await page.waitForTimeout(800);
    if (!(await page.getByTestId('nav-hud').count())) await page.getByText('Avvia Navigazione').click({ timeout: 15000 });
    await emit(partenza);
    await page.waitForTimeout(3000);
    await momento('2-inizio', { tappaVerso: vere[0].title });

    // 3. METÀ TRATTO: a metà della strada verso la prima tappa
    const p0 = campiona(legs[0].punti, PASSO_M);
    for (let i = 0; i < Math.floor(p0.length / 2); i++) { await emit(p0[i]); await page.waitForTimeout(500); }
    if (MISURA) {
        esito.ora = ORA; esito.paletta = await paletta();
        fs.writeFileSync(OUT, JSON.stringify(esito, null, 1));
        console.log(JSON.stringify(esito.paletta));
        await ctx.close();
        process.exit(0);
    }
    await momento('3-meta-tratto', { tappaVerso: vere[0].title });

    // 4. DOPO UN ARRIVO: alla prima tappa, poi verso la seconda
    for (let i = Math.floor(p0.length / 2); i < p0.length; i++) { await emit(p0[i]); await page.waitForTimeout(500); }
    for (let i = 0; i < 4; i++) { await emit(vere[0]); await page.waitForTimeout(1000); }
    await page.getByText('Tappa 2 di', { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => log('arrivo non rilevato'));
    await page.waitForTimeout(2800);
    await page.getByText('Riparti', { exact: true }).click({ timeout: 2000 }).catch(() => {});
    const p1 = campiona(legs[1].punti, PASSO_M);
    for (let i = 0; i < Math.min(4, p1.length); i++) { await emit(p1[i]); await page.waitForTimeout(700); }
    await momento('4-dopo-arrivo', { tappaVerso: vere[1].title });

    esito.errori = errori; esito.consoleApp = consoleApp.slice(-30); esito.tappe = vere.map(v => [+v.lat.toFixed(5), +v.lng.toFixed(5)]); esito.partenza = [+partenza.lat.toFixed(5), +partenza.lng.toFixed(5)];
    fs.writeFileSync(OUT, JSON.stringify(esito, null, 1));
    console.log(JSON.stringify(Object.fromEntries(Object.entries(esito.momenti).map(([k, v]) => [k, (v.polilinee || []).filter(p => p.strokeWeight !== 12).map(p => `${p.strokeColor} w${p.strokeWeight} ${p.tratteggio ? 'tratteggio' : 'pieno'} ${p.punti}pt ${JSON.stringify(p.da)}→${JSON.stringify(p.a)}`)])), null, 1));
    await ctx.close();
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
}
