/**
 * CLASSI-TRASPARENTI — schermate prima/dopo nel motore di Safari (WebKit di Playwright, profilo iPhone 13).
 *
 * Uso: PRIMA=http://localhost:<porta> DOPO=http://localhost:<porta> node scripts/prova-nav/classi-trasparenti.webkit.mjs
 * «prima» e «dopo» sono due `vite preview` (build di main e build del ramo). Le porte devono essere vite di QUESTO
 * repo e il titolo deve contenere "DoveVai" (CLAUDE.md): lo script lo ricontrolla prima di inserire le credenziali.
 * Credenziali: TEST_ACCOUNT_EMAIL / TEST_ACCOUNT_PASSWORD da .env.local, mai stampate né salvate nel repo
 * (la sessione vive solo nella cartella temporanea, cancellata alla fine).
 * Esce con schermate in docs/prove/schermate/classi-trasparenti/{prima,dopo}/ e un JSON con i percorsi su stdout.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BASI = { prima: process.env.PRIMA, dopo: process.env.DOPO };
const OUT = path.resolve('docs/prove/schermate/classi-trasparenti');
const SOLO = (process.env.SOLO || '').split(',').filter(Boolean);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-'));

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));

const TOUR = {
    id: 'prova-ct-catania',
    title: 'Il tuo giro a Catania',
    city: 'Catania',
    duration: '3 ore',
    image: null,
    steps: [
        { id: 'p1', title: 'Fontana dell\'Elefante', lat: 37.50270, lng: 15.08710, time: '10:00', description: 'Il simbolo della città.' },
        { id: 'p2', title: 'Via dei Crociferi', lat: 37.50520, lng: 15.08460, time: '10:45', description: 'La via barocca.' },
        { id: 'p3', title: 'Teatro Massimo Bellini', lat: 37.50380, lng: 15.09030, time: '11:30', description: 'Il teatro dell\'opera.' },
        { id: 'p4', title: 'Castello Ursino', lat: 37.49930, lng: 15.08320, time: '12:15', description: 'Il castello svevo.' },
    ],
};

const GPS_FINTO = () => {
    const g = { watchers: new Map(), id: 0, pos: { lat: 37.5027, lng: 15.0871 } };
    const mk = (p) => ({ coords: { latitude: p.lat, longitude: p.lng, accuracy: 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
    const geo = {
        getCurrentPosition(ok) { setTimeout(() => ok(mk(g.pos)), 20); },
        watchPosition(ok) { const id = ++g.id; g.watchers.set(id, ok); setTimeout(() => ok(mk(g.pos)), 20); return id; },
        clearWatch(id) { g.watchers.delete(id); },
    };
    window.__gps = g;
    Object.defineProperty(Navigator.prototype, 'geolocation', { get: () => geo, configurable: true });
};

// [nome, percorso, tourData?, azione?]  (completo = pagina intera, altrimenti solo lo schermo)
// Senza città scelta il riquadro «Dove ti trovi?» si apre da solo e copre ogni pagina: lo si tiene chiuso,
// e lo si mostra apposta in una schermata (il suo fondo è una delle classi corrette).
const CITTA_SCELTA = () => {
    try { localStorage.setItem('user_city', 'Catania'); sessionStorage.setItem('dvai_city_onboarding_prompted', 'true'); } catch { /* ignorato */ }
};
const SCHERMATE = [
    ['00-riquadro-citta', '/dashboard-user', null, 'riquadro'],
    ['01-home', '/dashboard-user', null, null],
    ['02-scheda-giro', '/tour-details', TOUR, null],
    ['03-quiz', '/quick-path', null, null],
    ['04-profilo', '/profile', null, null],
    ['05-navigazione', '/map', TOUR, 'naviga'],
    ['06-mappa-scheda-tappa', '/map', TOUR, 'mappa'],
    ['07-sorprendimi', '/surprise-tour', null, null],
    ['08-notifiche', '/notifications', null, null],
    ['09-esplora', '/explore', null, null],
    ['10-itinerario-ai', '/ai-itinerary', TOUR, null],
    ['11-tour-live', '/tour-live', TOUR, null],
    ['12-trending', '/trending', null, null],
    ['13-impostazioni-notifiche', '/notification-settings', null, null],
    ['14-foto', '/photos', null, null],
    ['15-prossimamente', '/prossimamente/guide', null, null],
];
const PUBBLICHE = [
    ['16-landing', '/'],
    ['17-login', '/login'],
    ['18-onboarding', '/onboarding'],
];

const browser = await webkit.launch();
const risultati = {};

async function controllaPorta(base) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const titolo = await page.title();
    await ctx.close();
    if (!/DoveVai/i.test(titolo)) throw new Error(`La pagina su ${base} non è DoveVai (titolo: ${titolo}): niente credenziali.`);
}

async function accedi(base, nome) {
    const statePath = path.join(TMP, `sessione-${nome}.json`);
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai sulla pagina di accesso: niente credenziali.');
    await page.getByText('Accedi →').click();
    await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await page.getByText('Accedi Ora').click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 });
    await ctx.storageState({ path: statePath });
    await ctx.close();
    return statePath;
}

async function scatta(ctx, base, nome, percorso, tour, azione, cartella, completo = true) {
    const page = await ctx.newPage();
    if (azione !== 'riquadro') await page.addInitScript(CITTA_SCELTA);
    const errori = [];
    page.on('pageerror', e => errori.push(String(e?.message || e)));
    await page.goto(`${base}${percorso}`, { waitUntil: 'domcontentloaded' });
    if (tour) {
        await page.evaluate((t) => window.history.replaceState({ usr: { tourData: t }, key: 'ct', idx: 0 }, '', location.pathname), tour);
        await page.reload({ waitUntil: 'domcontentloaded' });
    }
    await page.waitForTimeout(azione ? 9000 : 3500); // la mappa di Google carica più lenta delle pagine
    let nota = '';
    if (azione === 'naviga') {
        try {
            await page.getByText('Avvia', { exact: true }).click({ timeout: 15000 });
            await page.getByText('Avvia Navigazione').click({ timeout: 10000 });
            await page.waitForTimeout(3000);
            await page.evaluate(() => { const p = window.__gps.pos; for (const ok of window.__gps.watchers.values()) ok({ coords: { latitude: p.lat + 0.004, longitude: p.lng - 0.004, accuracy: 8 }, timestamp: Date.now() }); });
            await page.waitForTimeout(1500);
        } catch (e) { nota = 'avvio navigazione non riuscito'; }
    } else if (azione === 'riquadro') {
        await page.waitForTimeout(500);
    } else if (azione === 'mappa') {
        await page.waitForTimeout(1500);
    }
    const file = path.join(OUT, cartella, `${nome}.jpg`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, type: 'jpeg', quality: 80, fullPage: completo && !['naviga', 'mappa', 'riquadro'].includes(azione) });
    const url = new URL(page.url()).pathname;
    await page.close();
    return { file: path.relative(process.cwd(), file), url, errori, nota };
}

try {
    for (const [nome, base] of Object.entries(BASI)) {
        if (!base) throw new Error(`Manca ${nome.toUpperCase()}=http://localhost:<porta>`);
        await controllaPorta(base);
    }
    for (const [nome, base] of Object.entries(BASI)) {
        const stato = await accedi(base, nome);
        risultati[nome] = {};
        const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: stato, locale: 'it-IT', geolocation: { latitude: 37.5027, longitude: 15.0871 }, permissions: ['geolocation'] });
        await ctx.addInitScript(GPS_FINTO);
        for (const [n, p, t, a] of SCHERMATE) {
            if (SOLO.length && !SOLO.some(x => n.startsWith(x))) continue;
            try { risultati[nome][n] = await scatta(ctx, base, n, p, t, a, nome); }
            catch (e) { risultati[nome][n] = { errore: String(e?.message || e).slice(0, 200) }; }
        }
        await ctx.close();
        const pub = await browser.newContext({ ...devices['iPhone 13'], locale: 'it-IT' });
        for (const [n, p] of PUBBLICHE) {
            if (SOLO.length && !SOLO.some(x => n.startsWith(x))) continue;
            try { risultati[nome][n] = await scatta(pub, base, n, p, null, null, nome); }
            catch (e) { risultati[nome][n] = { errore: String(e?.message || e).slice(0, 200) }; }
        }
        await pub.close();
    }
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(JSON.stringify(risultati, null, 1));
