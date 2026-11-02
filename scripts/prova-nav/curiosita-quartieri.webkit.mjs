/**
 * CURIOSITÀ-QUARTIERI — prova WebKit (iPhone 14) della curiosità del cammino su tre giri veri: Roma Trastevere, Roma Monti, Catania centro storico.
 *   node scripts/prova-nav/curiosita-quartieri.webkit.mjs [trastevere,monti,catania]
 * - Il sito (CURIOSITA_BASE, difetto unnivai.vercel.app) e openai-proxy pubblicato: le curiosità sono quelle vere del server.
 * - Il percorso a piedi: Google Directions WALKING fra le tappe, calcolato dentro la pagina con la libreria della mappa.
 * - L'indirizzo (via, quartiere) lo chiede il telefono a Nominatim, come nell'app.
 * - Il tempo: orologio della pagina finto (page.clock), un passo di 25 m ogni 20 s (1,25 m/s), così 35 minuti di cammino durano pochi minuti
 *   e la regola dei 10 minuti si vede intera. Prima di ogni passo si aspettano le richieste al proxy in volo (il loro tempo massimo è un timer).
 * - La voce: le richieste di audio (`dv.purpose = 'voce'`) rispondono 503, come senza credito OpenAI; parla la «voce del browser», finta, che dura
 *   1 secondo ogni 14 caratteri sull'orologio della pagina. Così inizio e fine di ogni frase (svolte, «Si va verso…», arrivo, curiosità) sono
 *   misurati nel registro della voce (`window.__voceRegistro`: ora, fine, tipo, interrotta). Nessun costo di voce.
 * Prima delle credenziali: titolo «DoveVai» verificato. Credenziali da .env.local, mai stampate. Esiti in docs/prove/dati/2026-11-02-curiosita-quartieri-webkit.json.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.CURIOSITA_BASE || 'https://unnivai.vercel.app';
const SOLO = (process.argv[2] || 'trastevere,monti,catania').split(',').filter(Boolean);
const ESITI = path.resolve(process.env.CURIOSITA_ESITI || 'docs/prove/dati/2026-11-02-curiosita-quartieri-webkit.json');
const OUT = path.resolve('docs/prove/schermate/curiosita-quartieri');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'curiosita-'));
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const IPHONE = devices['iPhone 14'];
const PASSO_M = 25, PASSO_MS = 20_000;

const R = 6371000, rad = (x) => (x * Math.PI) / 180;
const dist = (a, b) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2));

const T = (title, lat, lng) => ({ title, lat, lng, moment: 'mattina', types: ['tourist_attraction'], stayMinutes: 20, description: 'Tappa della prova.' });
const GIRI = {
    trastevere: { citta: 'Roma', partenza: { lat: 41.8913, lng: 12.4743 }, tappe: [
        T('Piazza Trilussa', 41.8918, 12.4697), T('Villa Farnesina', 41.8937, 12.4672), T('Basilica di Santa Maria in Trastevere', 41.8894, 12.4700),
        T('Basilica di Santa Cecilia in Trastevere', 41.8875, 12.4757), T('Chiesa di San Francesco a Ripa', 41.8848, 12.4719)] },
    monti: { citta: 'Roma', partenza: { lat: 41.8924, lng: 12.4877 }, tappe: [
        T('Mercati di Traiano', 41.8957, 12.4862), T('Piazza della Madonna dei Monti', 41.8953, 12.4900), T('Basilica di San Pietro in Vincoli', 41.8938, 12.4931),
        T('Basilica di Santa Maria Maggiore', 41.8976, 12.4984), T('Palazzo delle Esposizioni', 41.8994, 12.4899)] },
    catania: { citta: 'Catania', partenza: { lat: 37.5020, lng: 15.0870 }, tappe: [
        T('Castello Ursino', 37.4990, 15.0832), T("Fontana dell'Elefante", 37.5027, 15.0871), T('Chiesa di San Benedetto', 37.5046, 15.0849),
        T('Teatro Massimo Bellini', 37.5038, 15.0903), T('Villa Bellini', 37.5127, 15.0849)] },
};

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
    window.__toast = [];
    window.addEventListener('dvai:toast', (e) => window.__toast.push({ ora: new Date().toISOString(), testo: String(e?.detail?.message || '') }));
    // la «voce del browser»: 1 secondo ogni 14 caratteri sull'orologio della pagina; cancel() interrompe
    const voce = {
        speaking: false, _t: null, _u: null,
        speak(u) { this.cancel(); this.speaking = true; this._u = u; this._t = setTimeout(() => { this.speaking = false; this._t = null; this._u = null; u.onend?.({}); }, Math.ceil(String(u.text || '').length / 14) * 1000); },
        cancel() { if (this._t) { clearTimeout(this._t); const u = this._u; this._t = null; this._u = null; this.speaking = false; u?.onerror?.({ error: 'interrupted' }); } },
        getVoices() { return []; }, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: voce, configurable: true });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
};

const esito = { base: BASE, iniziato: new Date().toISOString(), passoM: PASSO_M, passoS: PASSO_MS / 1000, giri: {} };
const browser = await webkit.launch();

async function accedi() {
    const ctx = await browser.newContext({ ...IPHONE, locale: 'it-IT', timezoneId: 'Europe/Rome' });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await p.title())) throw new Error('titolo non DoveVai: niente credenziali');
    if (!env.TEST_ACCOUNT_EMAIL || !env.TEST_ACCOUNT_PASSWORD) throw new Error('mancano le credenziali di prova');
    await p.getByText('Accedi →').click();
    await p.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await p.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await p.getByText('Accedi Ora').click();
    await p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await p.waitForTimeout(2500);
    const file = path.join(TMP, 'sessione.json');
    await ctx.storageState({ path: file });
    await ctx.close();
    return file;
}

/** Il punto del percorso a `m` metri dall'inizio. */
function punti(percorso, passo) {
    const out = [percorso[0]];
    let resto = passo;
    for (let i = 1; i < percorso.length; i++) {
        let a = percorso[i - 1]; const b = percorso[i];
        let d = dist(a, b);
        while (d >= resto) {
            const f = resto / d;
            a = { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
            out.push(a); d = dist(a, b); resto = passo;
        }
        resto -= d;
    }
    out.push(percorso[percorso.length - 1]);
    return out;
}

async function giro(nome, statePath) {
    const g = GIRI[nome];
    const tour = { id: `prova-curiosita-${nome}-${Date.now()}`, title: `Il tuo giro a ${g.citta}`, city: g.citta,
        steps: g.tappe.map((s, i) => ({ id: `s${i + 1}`, latitude: s.lat, longitude: s.lng, ...s })) };
    const ctx = await browser.newContext({ ...IPHONE, storageState: statePath, locale: 'it-IT', timezoneId: 'Europe/Rome', permissions: ['geolocation'], geolocation: { latitude: g.partenza.lat, longitude: g.partenza.lng } });
    await ctx.addInitScript(GPS_FINTO);
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date() });
    const reg = { curiosita: [], errori: [] };
    let inVolo = 0;
    page.on('pageerror', e => reg.errori.push(String(e?.message || e).slice(0, 160)));
    // anche l'indirizzo che il telefono chiede a Nominatim prima della curiosità è «in volo» (il suo tempo massimo è un timer della pagina)
    const osm = (r) => /nominatim\.openstreetmap\.org\/reverse/.test(r.url()) && /zoom=17/.test(r.url());
    page.on('request', r => { if (osm(r)) inVolo += 1; });
    page.on('requestfinished', r => { if (osm(r)) inVolo -= 1; });
    page.on('requestfailed', r => { if (osm(r)) inVolo -= 1; });
    await page.route('**/functions/v1/openai-proxy', async (route) => {
        let dv = null; try { dv = route.request().postDataJSON()?.dv; } catch { /* */ }
        if (dv?.purpose === 'voce') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'voce finta: prova', code: 'VOCE_NON_DISPONIBILE' }) });
        if (dv?.purpose !== 'curiosita') return route.continue();
        inVolo += 1;
        const t0 = Date.now();
        try {
            const r = await route.fetch({ timeout: 90_000 });
            const corpo = await r.json().catch(() => null);
            reg.curiosita.push({ stato: r.status(), ms: Date.now() - t0, lat: dv.lat, lng: dv.lng, escludi: dv.escludi, corpo: corpo?.curiosita ?? corpo });
            await route.fulfill({ response: r, json: corpo ?? {} });
        } catch (e) {
            reg.curiosita.push({ stato: 'errore', errore: String(e?.message || e).slice(0, 120) });
            await route.abort().catch(() => {});
        } finally { inVolo -= 1; }
    });
    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await page.title())) throw new Error('titolo non DoveVai');
    await page.evaluate((tour) => {
        const route = tour.steps.map((s, i) => ({ latitude: s.lat, longitude: s.lng, label: s.title, title: s.title, name: s.title, description: s.description, category: 'Punto Mappa', image: null, index: i + 1, type: 'waypoint' }));
        window.history.replaceState({ usr: { route, tourData: tour }, key: 'prova', idx: 0 }, '', '/map');
    }, tour);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.clock.runFor(1000);
    await page.locator('[data-testid="map-avvia-card"]').waitFor({ timeout: 60000 });
    // il percorso a piedi vero, dalla partenza a ogni tappa
    await page.waitForFunction(() => !!window.google?.maps?.importLibrary, null, { timeout: 60000 });
    const legs = await page.evaluate(async (pts) => {
        const { DirectionsService } = await google.maps.importLibrary('routes');
        const svc = new DirectionsService();
        const out = [];
        for (let i = 1; i < pts.length; i++) {
            const r = await svc.route({ origin: pts[i - 1], destination: pts[i], travelMode: 'WALKING' });
            out.push({ metri: r.routes[0].legs[0].distance.value, punti: r.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() })) });
        }
        return out;
    }, [g.partenza, ...g.tappe.map(t => ({ lat: t.lat, lng: t.lng }))]);
    await page.clock.runFor(3000);
    await page.getByText('Avvia', { exact: true }).first().click();
    await page.clock.runFor(2000);
    const emetti = (p) => page.evaluate(([a, b]) => window.__gps.emit(a, b, 8), [p.lat, p.lng]);
    const avanza = async (ms) => {
        for (let k = 0; k < 600 && inVolo > 0; k++) await page.waitForTimeout(100); // la richiesta in volo finisce prima che il tempo scorra
        await page.clock.runFor(ms);
        await page.waitForTimeout(60);
    };
    for (let k = 0; k < 3; k++) { await emetti(g.partenza); await avanza(2000); }
    const tInizio = await page.evaluate(() => Date.now());
    let metri = 0;
    const arrivi = [];
    for (let i = 0; i < legs.length; i++) {
        const ps = punti(legs[i].punti, PASSO_M);
        for (const p of ps) { await emetti(p); await avanza(PASSO_MS); }
        metri += legs[i].metri;
        // all'arrivo: fermo sulla tappa 40 s (due letture dentro la soglia), poi si riparte
        const t = g.tappe[i];
        for (let k = 0; k < 2; k++) { await emetti(t); await avanza(PASSO_MS); }
        arrivi.push({ tappa: t.title, ora: await page.evaluate(() => new Date().toISOString()) });
        const riparti = page.getByRole('button', { name: /Riparti|Avanti/ }).first();
        if (await riparti.count()) await riparti.click({ timeout: 3000 }).catch(() => {});
        await avanza(1000);
    }
    await avanza(30_000);
    const fine = await page.evaluate(() => ({ voce: window.__voceRegistro || [], curiosita: window.__curiositaRegistro || [], toast: window.__toast || [], ora: new Date().toISOString() }));
    await page.screenshot({ path: path.join(OUT, `${nome}-fine.png`) }).catch(() => {});
    await ctx.close();
    return { citta: g.citta, tappe: g.tappe.map(t => t.title), metri, minutiCammino: Math.round((Date.parse(fine.ora) - tInizio) / 60000), inizio: new Date(tInizio).toISOString(), arrivi, ...fine, proxy: reg.curiosita, errori: reg.errori.slice(0, 10) };
}

/** Le misure di un giro: curiosità dette, intervalli, ripetizioni, sovrapposizioni con le frasi di navigazione. */
function misura(r) {
    const ms = (s) => Date.parse(s);
    const dette = r.curiosita.filter(x => x.evento === 'detta');
    const voci = r.voce.map(v => ({ ...v, tipo: v.tipo || (/^(Fra (cento|cinquanta) metri|Adesso )/.test(v.testo) ? 'svolta' : /^Si va verso/.test(v.testo) ? 'prossimaTappa' : 'altro') }));
    const curVoci = voci.filter(v => v.tipo === 'curiosita');
    const nav = voci.filter(v => v.tipo !== 'curiosita');
    const sovrapposizioni = [];
    for (const c of curVoci) {
        const a = ms(c.ora), b = ms(c.fine || c.ora);
        for (const n of nav) {
            const x = ms(n.ora), y = ms(n.fine || n.ora);
            if (x < b && y > a) sovrapposizioni.push({ curiosita: c.testo.slice(0, 40), nav: n.testo, curOra: c.ora, curFine: c.fine, navOra: n.ora, navFine: n.fine });
        }
    }
    const intervalliMin = dette.slice(1).map((d, i) => +((ms(d.ora) - ms(dette[i].ora)) / 60000).toFixed(1));
    const chiavi = dette.map(d => d.chiave);
    return {
        curiositaDette: dette.length,
        testi: dette.map(d => ({ ora: d.ora, minuto: +((ms(d.ora) - ms(r.inizio)) / 60000).toFixed(1), luogo: d.luogo, tipo: d.tipo, fonte: d.fonte?.url, testo: d.testo, distanzaSvoltaM: d.distanzaSvoltaM, distanzaTappaM: d.distanzaTappaM })),
        intervalliMin, dieciMinutiRispettati: intervalliMin.every(m => m >= 10),
        ripetizioni: chiavi.length - new Set(chiavi).size,
        frasiNavigazione: nav.length, svolte: nav.filter(v => v.tipo === 'svolta').length,
        curiositaInterrotte: curVoci.filter(v => v.interrotta).length,
        sovrapposizioni,
        attese: Object.entries(r.curiosita.filter(x => x.evento === 'attesa').reduce((o, x) => ({ ...o, [x.motivo]: (o[x.motivo] || 0) + 1 }), {})),
        richieste: r.proxy.length, richiesteSenza: r.proxy.filter(p => p.corpo?.esito !== 'passata').length,
        spesaUsd: +r.proxy.reduce((s, p) => s + (Number(p.corpo?.costoUsd) || 0), 0).toFixed(5),
    };
}

try {
    const statePath = await accedi();
    for (const nome of SOLO) {
        const t0 = Date.now();
        try {
            const r = await giro(nome, statePath);
            esito.giri[nome] = { misure: misura(r), grezzo: r, secondiVeri: Math.round((Date.now() - t0) / 1000) };
        } catch (e) { esito.giri[nome] = { errore: String(e?.message || e).slice(0, 300) }; }
        console.log(nome, JSON.stringify(esito.giri[nome].misure || esito.giri[nome]).slice(0, 1500));
        fs.writeFileSync(ESITI, JSON.stringify(esito, null, 1));
    }
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
    esito.finito = new Date().toISOString();
    fs.writeFileSync(ESITI, JSON.stringify(esito, null, 1));
}
