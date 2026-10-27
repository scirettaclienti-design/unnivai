/**
 * VOCE-1 — una camminata simulata sul giro VERO di Catania (stesso giro e stesso percorso a piedi di NAV-SIM), nel motore di Safari
 * (WebKit di Playwright, profilo iPhone 13), con la voce accesa. Registra ogni frase detta (ora, testo, voce, sorgente) e ogni richiesta
 * di audio al server (nuova o cache), e ne ricava il costo del giro.
 *
 *   NAV_BASE=http://localhost:<porta> node scripts/prova-nav/voce.webkit.mjs prima|seconda [marin|cedar]
 *
 * «prima» e «seconda» fanno la stessa camminata: la prima genera le frasi nuove, la seconda deve trovarle tutte nella cache (0 $).
 * Prima delle credenziali: titolo «DoveVai» verificato (CLAUDE.md). Credenziali da .env.local, mai stampate.
 * Esito: docs/prove/dati/2026-10-27-voce-giro-<prima|seconda>.json
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.NAV_BASE || 'http://localhost:5181';
const ETICHETTA = process.argv[2] || 'prima';
const VOCE = process.argv[3] || 'marin';
const GIRI_FILE = 'docs/prove/dati/2026-10-16-nav-sim-giri.json';
const PERCORSI_FILE = 'docs/prove/dati/2026-10-16-nav-sim-percorsi.json';
const OUT = `docs/prove/dati/2026-10-27-voce-giro-${ETICHETTA}.json`;
const SHOTS = path.resolve('docs/prove/schermate/voce-1');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'voce-'));
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
async function caricaGiro(page, giro) {
    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async (g) => {
        const { normalizeTour } = await import('/src/services/tourShape.js');
        const vere = g.stops.filter(s => !s.tempoLibero);
        const route = vere.map((s, i) => ({ latitude: s.latitude, longitude: s.longitude, label: s.title, title: s.title, name: s.title,
            description: s.description, category: s.type || 'Punto Mappa', image: null, index: i + 1, type: 'waypoint' }));
        const tourData = normalizeTour({ id: `ai-itinerary-voce-${g.luogo}`, title: g.titolo, type: 'ai-generated', isAiGenerated: true,
            city: g.luogo, tags: ['AI'], stops: g.stops }, { cityFallback: g.luogo });
        window.history.replaceState({ usr: { route, tourData }, key: 'voce', idx: 0 }, '', '/map');
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
    await ctx.addInitScript(GPS_FINTO);
    // la voce scelta, come dal selettore (salvata nel telefono)
    await ctx.addInitScript((v) => { try { localStorage.setItem('dvai_voce_scelta_v1', v); } catch { /* niente */ } }, VOCE);
    const page = await ctx.newPage();
    const errori = [];
    page.on('pageerror', e => errori.push(String(e?.message || e).slice(0, 200)));
    const richieste = []; // ogni richiesta di audio al server
    page.on('response', async (res) => {
        try {
            const req = res.request();
            if (!res.url().includes('/functions/v1/openai-proxy') || !(req.postData() || '').includes('"purpose":"voce"')) return;
            const dv = JSON.parse(req.postData()).dv;
            const j = await res.json().catch(() => ({}));
            richieste.push({ ora: new Date().toISOString(), status: res.status(), testo: dv.testo, voce: dv.voce, source: j.source ?? null, costoStimatoUsd: j.costoStimatoUsd ?? 0, code: j.code ?? null });
        } catch { /* niente */ }
    });
    const t0 = Date.now();
    const log = (m) => console.error(`[voce ${ETICHETTA}] ${Math.round((Date.now() - t0) / 1000)}s ${m}`);

    await caricaGiro(page, giro);
    const partenza = sposta(vere[0], -PARTENZA_M * 0.6, -PARTENZA_M * 0.8);
    await page.evaluate(([a, b]) => { window.__gps.pos = { lat: a, lng: b, acc: 8 }; }, [partenza.lat, partenza.lng]);
    await page.getByText('Avvia', { exact: true }).click({ timeout: 30000 });
    await page.waitForTimeout(800);
    if (!(await page.getByTestId('nav-hud').count())) await page.getByText('Avvia Navigazione').click({ timeout: 15000 });
    log('navigazione avviata');
    const emit = (p) => page.evaluate(([a, b]) => window.__gps.emit(a, b, 8), [p.lat, p.lng]).catch(() => {});
    await emit(partenza);
    await page.waitForTimeout(2500);
    const selettoreVisibile = await page.getByTestId('voce-selettore').isVisible().catch(() => false);
    await page.screenshot({ path: path.join(SHOTS, `${ETICHETTA}-01-partenza.png`) });

    const N = legs.length;
    const arrivi = [];
    for (let k = 1; k <= N; k++) {
        const stop = vere[k - 1];
        for (const p of campiona(legs[k - 1].punti, PASSO_M)) { await emit(p); await page.waitForTimeout(1000); }
        for (let i = 0; i < 4; i++) { await emit(stop); await page.waitForTimeout(1000); }
        const prossima = k < N ? `Tappa ${k + 1} di ${N}` : null;
        let arrivato = false;
        for (let i = 0; i < 12 && !arrivato; i++) {
            arrivato = prossima ? await page.getByText(prossima, { exact: false }).first().isVisible().catch(() => false)
                : await page.getByText('Fine', { exact: false }).first().isVisible().catch(() => false);
            if (!arrivato) await page.waitForTimeout(1000);
        }
        if (!arrivato && prossima) { await page.getByText('Sono arrivato', { exact: true }).click({ timeout: 3000 }).catch(() => {}); log(`tappa ${k}: arrivo a mano`); }
        arrivi.push({ tappa: stop.title, daSolo: arrivato });
        log(`tappa ${k}/${N} ${stop.title} ${arrivato ? 'arrivo da solo' : 'a mano'}`);
        await page.waitForTimeout(2600); // il rito d'arrivo (2 s) e la scheda
        if (k === 2) await page.screenshot({ path: path.join(SHOTS, `${ETICHETTA}-02-arrivo.png`) });
        await page.getByText('Riparti', { exact: true }).click({ timeout: 1500 }).catch(() => {});
    }
    await page.waitForTimeout(3000);
    const registro = await page.evaluate(() => window.__voceRegistro || []);
    const nuove = richieste.filter(r => r.source === 'nuova');
    const esito = {
        etichetta: ETICHETTA, voce: VOCE, giro: giro.titolo, tappe: N, durataS: Math.round((Date.now() - t0) / 1000),
        selettoreVisibile, frasiDette: registro.length,
        perSorgente: registro.reduce((a, r) => { a[r.sorgente] = (a[r.sorgente] || 0) + 1; return a; }, {}),
        richiesteAlServer: richieste.length, audioNuovi: nuove.length, dallaCache: richieste.filter(r => r.source === 'cache').length,
        richiesteFallite: richieste.filter(r => r.status !== 200).length,
        costoStimatoUsd: Math.round(nuove.reduce((a, r) => a + (r.costoStimatoUsd || 0), 0) * 1e6) / 1e6,
        arrivi, errori, registro, richieste,
    };
    fs.writeFileSync(OUT, JSON.stringify(esito, null, 1));
    console.log(JSON.stringify({ ...esito, registro: undefined, richieste: undefined, arrivi: undefined }, null, 1));
    await ctx.close();
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
}
