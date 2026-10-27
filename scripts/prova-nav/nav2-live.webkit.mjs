/**
 * NAV-2 — prova dal VIVO sul sito pubblicato: «un giro a Catania» da «Crea il tuo Percorso» (chiamate vere, cache permettendo), «Vedi su Mappa»,
 * anteprima, pannello, navigazione con il GPS finto sulle tappe vere del giro. WebKit iPhone 13, account di prova.
 *   NAV_BASE=https://unnivai.vercel.app NAV_TAG=live node scripts/prova-nav/nav2-live.webkit.mjs
 * Misura anche i km del giro (tappe in ordine) e conta le richieste a Google. Credenziali solo da .env.local, mai stampate.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
const BASE = process.env.NAV_BASE || 'https://unnivai.vercel.app';
const TAG = process.env.NAV_TAG || 'live';
const OUT = process.env.NAV_SCHERMATE || 'docs/prove/schermate/nav-2';
const ESITI = process.env.NAV_ESITI || `docs/prove/dati/2026-10-24-nav-2-${TAG}.json`;
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const LISTINO = { textsearch: 0.032, details: 0.025, findplacefromtext: 0.017, photo: 0.007, altro: 0.032 };
const km = (a, b) => { const t = x => x * Math.PI / 180; const d = Math.sin(t(b.lat - a.lat) / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(t(b.lng - a.lng) / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(d)); };

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


const misura = (page) => page.evaluate(() => {
    const vv = window.visualViewport;
    const btn = (re) => [...document.querySelectorAll('button')].find(b => re.test((b.innerText || '').trim()));
    const r = (el) => { if (!el) return null; const q = el.getBoundingClientRect(); return { top: Math.round(q.top), bottom: Math.round(q.bottom) }; };
    return {
        innerHeight: window.innerHeight, visibile: Math.round(vv?.height ?? window.innerHeight),
        cardAvvia: r(btn(/^Avvia$/i)?.closest('div.rounded-2xl')), pulsanteNav: r(btn(/^Avvia Navigazione/i)),
        banner: /Attiva la tua posizione/.test(document.body.innerText), apriInMappe: /Apri in Mappe/i.test(document.body.innerText),
        linkEsterni: [...document.querySelectorAll('a[href]')].filter(a => !a.closest('.gm-style')).map(a => a.href).filter(h => /maps\.apple|google\.com\/maps/.test(h)),
        barra: (document.body.innerText.match(/Tappa \d+\/\d+/i) || [null])[0],
    };
});
const browser = await webkit.launch();
const esito = { tag: TAG, base: BASE, richieste: { places: {}, miss: {} } };
try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'it-IT', timezoneId: 'Europe/Rome', geolocation: { latitude: 37.5024, longitude: 15.0871 }, permissions: ['geolocation'] });
    await ctx.addInitScript(GPS_FINTO);
    const page = await ctx.newPage();
    page.on('request', (r) => { const u = r.url(); if (u.includes('/functions/v1/places-proxy')) { const k = ((decodeURIComponent(u).match(/path=([^&]+)/) || [])[1] || 'altro').replace('place/', ''); esito.richieste.places[k] = (esito.richieste.places[k] || 0) + 1; } });
    page.on('response', (r) => { const u = r.url(); if (u.includes('/functions/v1/places-proxy') && (r.headers()['x-cache'] || '').toUpperCase() === 'MISS') { const k = ((decodeURIComponent(u).match(/path=([^&]+)/) || [])[1] || 'altro').replace('place/', ''); esito.richieste.miss[k] = (esito.richieste.miss[k] || 0) + 1; } });
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai: niente credenziali.');
    await page.waitForTimeout(3000);
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai al login: niente credenziali.');
    await page.getByText('Accedi →').click();
    await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await page.getByText('Accedi Ora').click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await page.waitForTimeout(6000);
    await page.goto(`${BASE}/ai-itinerary`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    for (let i = 0; i < 3; i++) { const b = page.getByText('Conferma Posizione'); if (await b.count().catch(() => 0)) await b.first().click().catch(() => {}); await page.waitForTimeout(800); }
    const testo = page.locator('textarea').first();
    await testo.waitFor({ timeout: 20000 });
    await testo.fill('domani alle 8:30 un giro a Catania');
    await page.getByText('Genera Viaggio').first().click();
    await page.locator('[data-stop-card]').first().waitFor({ timeout: 150000 });
    await page.waitForTimeout(4000);
    esito.scheda = await page.locator('[data-stop-card]:not([data-free-time])').evaluateAll(els => els.map(e => (e.innerText || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 2).join(' | ')));
    await page.getByText('Vedi su Mappa').first().click();
    await page.waitForURL(u => u.pathname.startsWith('/map'), { timeout: 30000 });
    await page.waitForTimeout(10000);
    await page.screenshot({ path: `${OUT}/${TAG}-01-anteprima.png` });
    esito.anteprima = await misura(page);
    // DURATE-ETICHETTE — dopo qualche secondo il percorso e' calcolato: la card dice la giornata, il cammino e le tappe
    await page.waitForTimeout(15000);
    esito.etichetteCard = await page.getByTestId('avvia-etichette').innerText().catch(() => null);
    await page.screenshot({ path: `${OUT}/${TAG}-01b-anteprima-percorso.png` });
    await page.getByText('Avvia', { exact: true }).first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${TAG}-02-pannello-mezzo.png` });
    esito.pannelloMezzo = await misura(page);
    // DURATE-ETICHETTE — nel pannello il cammino e' calcolato: «1h 33 a piedi · 6,9 km»
    await page.waitForTimeout(12000);
    esito.camminoPannello = await page.getByTestId('percorso-cammino').innerText().catch(() => null);
    await page.locator('[data-testid="percorso-cammino"]').scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: `${OUT}/${TAG}-02b-pannello-cammino.png` });
    await page.getByText('Avvia Navigazione').click();
    await page.waitForTimeout(3000);
    // le tappe vere dal giro salvato nella sessione di navigazione
    const giro = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('dvai_nav_giro_v1') || 'null'); } catch { return null; } });
    const steps = (giro?.tourData?.steps || []).map(s => ({ lat: Number(s.lat ?? s.latitude), lng: Number(s.lng ?? s.longitude), title: s.title }));
    esito.tappe = steps.length;
    esito.kmGiro = Number(steps.slice(1).reduce((a, s, i) => a + km(steps[i], s), 0).toFixed(2));
    const emit = (p) => page.evaluate(([la, ln]) => window.__gps.emit(la, ln, 8), [p.lat, p.lng]);
    const fermo = async (p, n = 3) => { for (let i = 0; i < n; i++) { await emit(p); await page.waitForTimeout(1100); } };
    const verso = async (a, b, passi = 6) => { for (let k = 1; k < passi; k++) { await emit({ lat: a.lat + (b.lat - a.lat) * k / passi, lng: a.lng + (b.lng - a.lng) * k / passi }); await page.waitForTimeout(900); } };
    if (steps.length >= 3) {
        await fermo(steps[0]);
        await verso(steps[0], steps[1]);
        await fermo(steps[1]);
        await verso(steps[1], steps[2], 4);
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${OUT}/${TAG}-03-navigazione.png` });
        esito.navigazione = await misura(page);
        // MAPPA-STILE — il filo del giorno non copre il tasto indietro (rettangoli in px CSS)
        esito.indietro = await page.evaluate(() => {
            const r = (el) => { const b = el?.getBoundingClientRect(); return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null; };
            const ind = document.querySelector('a[aria-label="Torna alla home"]'), filo = document.querySelector('[data-testid="filo"]'), pill = document.querySelector('[data-testid="nav-hud-barra"]');
            const tocca = (a, b) => !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
            const bi = ind?.getBoundingClientRect();
            const top = bi ? document.elementFromPoint(bi.x + bi.width / 2, bi.y + bi.height / 2) : null;
            return { indietro: r(ind), filo: r(filo), pillola: r(pill), siSovrappongono: tocca(r(ind), r(filo)) || tocca(r(ind), r(pill)), elementoInCimaAlCentro: top ? (top.closest('a')?.getAttribute('aria-label') || top.tagName) : null };
        });
    }
    await ctx.close();
} finally {
    await browser.close();
    const stima = Object.entries(esito.richieste.miss).reduce((a, [k, v]) => a + v * (LISTINO[k] ?? LISTINO.altro), 0);
    esito.costoGoogleMissUsd = Number(stima.toFixed(3));
    fs.writeFileSync(ESITI, JSON.stringify(esito, null, 1));
}
console.log(JSON.stringify({ tag: TAG, tappe: esito.tappe, kmGiro: esito.kmGiro, costoGoogleMissUsd: esito.costoGoogleMissUsd, anteprima: { banner: esito.anteprima?.banner, card: esito.anteprima?.cardAvvia }, nav: { barra: esito.navigazione?.barra, apriInMappe: esito.navigazione?.apriInMappe, linkEsterni: esito.navigazione?.linkEsterni } }));
