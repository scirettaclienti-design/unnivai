/**
 * NAV-1 — prove nel motore di Safari (WebKit di Playwright, profilo iPhone 13) con la posizione simulata.
 *
 * Uso: NAV_BASE=http://localhost:<porta> node scripts/prova-nav/nav1.webkit.mjs [scenario,…]
 * Prima: la porta deve essere il vite di QUESTO repo e il titolo deve contenere "DoveVai" (CLAUDE.md):
 * lo script lo ricontrolla e si ferma prima delle credenziali se non è così.
 * Credenziali: TEST_ACCOUNT_EMAIL / TEST_ACCOUNT_PASSWORD da .env.local, mai stampate né salvate nel repo
 * (la sessione vive solo nella cartella temporanea passata in NAV_TMP, cancellata alla fine).
 *
 * La posizione è un GPS finto messo al posto di navigator.geolocation (stessa interfaccia: watchPosition,
 * getCurrentPosition, clearWatch, errori con code 1/2/3). Le tappe sono monumenti pubblici di Catania.
 * Esito per scenario + schermate in docs/prove/schermate/nav-1/, riassunto in JSON su stdout.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.NAV_BASE || 'http://localhost:5181';
const OUT = path.resolve('docs/prove/schermate/nav-1');
const TMP = process.env.NAV_TMP || fs.mkdtempSync('/tmp/nav1-');
const SOLO = (process.argv[2] || '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));

const TOUR = {
    id: 'prova-nav1-catania',
    title: 'Prova NAV-1 a Catania',
    city: 'Catania',
    steps: [
        { id: 'p1', title: 'Fontana dell\'Elefante', lat: 37.50270, lng: 15.08710 },
        { id: 'p2', title: 'Via dei Crociferi', lat: 37.50520, lng: 15.08460 },
        { id: 'p3', title: 'Teatro Massimo Bellini', lat: 37.50380, lng: 15.09030 },
        { id: 'p4', title: 'Castello Ursino', lat: 37.49930, lng: 15.08320 },
    ],
};
const LONTANO = [37.5090, 15.0800]; // ~800 m a nord-ovest della prima tappa

// Il GPS finto: niente posizione finché la prova non la manda.
const GPS_FINTO = () => {
    const g = { watchers: new Map(), id: 0, pos: null, deny: false };
    const mk = (p) => ({ coords: { latitude: p.lat, longitude: p.lng, accuracy: p.acc ?? 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
    const geo = {
        getCurrentPosition(ok, ko) {
            if (g.deny) setTimeout(() => ko?.({ code: 1, message: 'User denied Geolocation' }), 20);
            else if (g.pos) setTimeout(() => ok(mk(g.pos)), 20);
        },
        watchPosition(ok, ko, o) {
            const id = ++g.id;
            g.watchers.set(id, { ok, ko, o });
            if (g.deny) setTimeout(() => ko?.({ code: 1, message: 'User denied Geolocation' }), 20);
            return id;
        },
        clearWatch(id) { g.watchers.delete(id); },
    };
    g.emit = (lat, lng, acc) => { g.pos = { lat, lng, acc }; for (const w of [...g.watchers.values()]) w.ok(mk(g.pos)); };
    g.fail = (code) => { for (const w of [...g.watchers.values()]) w.ko?.({ code, message: 'x' }); };
    g.navWatch = () => [...g.watchers.values()].filter(w => w.o?.enableHighAccuracy).length;
    window.__gps = g;
    Object.defineProperty(Navigator.prototype, 'geolocation', { get: () => geo, configurable: true });
};

const esiti = [];
const shot = async (page, nome) => {
    const file = path.join(OUT, `${nome}.png`);
    await page.screenshot({ path: file });
    return path.relative(process.cwd(), file);
};
const testo = (page, t) => page.getByText(t, { exact: false }).first();
const vede = async (page, t, timeout = 8000) => {
    try { await testo(page, t).waitFor({ state: 'visible', timeout }); return true; } catch { return false; }
};
const emit = (page, [lat, lng], acc) => page.evaluate(([a, b, c]) => window.__gps.emit(a, b, c), [lat, lng, acc]);

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
    if (fs.existsSync(statePath)) return statePath;
    if (!env.TEST_ACCOUNT_EMAIL || !env.TEST_ACCOUNT_PASSWORD) throw new Error('Mancano le credenziali di prova in .env.local');
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
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

async function nuovaPagina(browser, statePath, { conTour = true } = {}) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath, locale: 'it-IT' });
    await ctx.addInitScript(GPS_FINTO);
    const page = await ctx.newPage();
    const errori = [];
    page.on('pageerror', e => errori.push(String(e?.message || e)));
    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    if (conTour) {
        await page.evaluate((tour) => {
            window.history.replaceState({ usr: { tourData: tour }, key: 'nav1', idx: 0 }, '', '/map');
        }, TOUR);
        await page.reload({ waitUntil: 'domcontentloaded' });
    }
    return { ctx, page, errori };
}

async function avvia(page) {
    // Al primo caricamento a freddo il pannello può non aprirsi al primo tocco: un secondo tentativo
    // (instabilità vista una volta in «gps-lento» come primo scenario del giro; dichiarata nel report).
    for (let i = 0; i < 2; i++) {
        await page.getByText('Avvia', { exact: true }).click({ timeout: 20000 });
        try {
            await page.getByText('Avvia Navigazione').click({ timeout: 10000 });
            return;
        } catch (e) {
            if (i === 1) throw e;
        }
    }
}

const SCENARI = {
    // 1. Il primo GPS arriva dopo 30 secondi.
    async 'gps-lento'(browser, s) {
        const { ctx, page, errori } = await nuovaPagina(browser, s);
        await avvia(page);
        await page.waitForTimeout(6000);
        const attesa = await vede(page, 'Cerco il segnale. Intanto segui la mappa');
        const f1 = await shot(page, '01-gps-lento-attesa');
        await page.waitForTimeout(24000);
        const watchDopo30 = await page.evaluate(() => window.__gps.navWatch());
        await emit(page, LONTANO);
        await page.waitForTimeout(800);
        await emit(page, [TOUR.steps[0].lat, TOUR.steps[0].lng]);
        const sbloccata = await vede(page, 'Tappa 2/4');
        const messaggioVia = !(await testo(page, 'Cerco il segnale').isVisible().catch(() => false));
        const f2 = await shot(page, '02-gps-lento-tappa-sbloccata');
        await ctx.close();
        return { ok: attesa && watchDopo30 > 0 && sbloccata && messaggioVia, attesa, watchDopo30, sbloccata, messaggioVia, errori, schermate: [f1, f2] };
    },
    // 2. Il GPS sparisce e torna.
    async 'gps-perso'(browser, s) {
        const { ctx, page, errori } = await nuovaPagina(browser, s);
        await page.evaluate(([a, b]) => { window.__gps.pos = { lat: a, lng: b }; }, LONTANO);
        await avvia(page);
        await page.waitForTimeout(500);
        await emit(page, LONTANO);
        await page.waitForTimeout(1000);
        const f0 = await shot(page, '03-gps-ok');
        // Silenzio: nessuna posizione per 40 s.
        await page.waitForTimeout(40000);
        const perso = await vede(page, 'Ho perso il segnale. Continua pure');
        const f1 = await shot(page, '04-gps-perso');
        await emit(page, [LONTANO[0] - 0.001, LONTANO[1]]);
        await page.waitForTimeout(1000);
        const tornato = !(await testo(page, 'Ho perso il segnale').isVisible().catch(() => false));
        const f2 = await shot(page, '05-gps-tornato');
        await ctx.close();
        return { ok: perso && tornato, perso, tornato, errori, schermate: [f0, f1, f2] };
    },
    // 3. Posizione negata: messaggio e tappe a mano.
    async 'negata'(browser, s) {
        const { ctx, page, errori } = await nuovaPagina(browser, s);
        await page.evaluate(() => { window.__gps.deny = true; });
        await avvia(page);
        const msg = await vede(page, 'Senza posizione non posso guidarti');
        const f1 = await shot(page, '06-posizione-negata');
        await page.getByText('Sono arrivato', { exact: true }).click();
        const aMano = await vede(page, 'Tappa 2/4');
        const f2 = await shot(page, '07-negata-tappa-a-mano');
        await ctx.close();
        return { ok: msg && aMano, msg, aMano, errori, schermate: [f1, f2] };
    },
    // 4. Ricarica a metà giro, ripresa; e il giro di oltre 12 ore non si propone.
    async 'ripresa'(browser, s) {
        const { ctx, page, errori } = await nuovaPagina(browser, s);
        await page.evaluate(([a, b]) => { window.__gps.pos = { lat: a, lng: b }; }, LONTANO);
        await avvia(page);
        await page.waitForTimeout(500);
        await emit(page, LONTANO);
        await page.waitForTimeout(500);
        await emit(page, [TOUR.steps[0].lat, TOUR.steps[0].lng]);
        const fatta = await vede(page, 'Tappa 2/4');
        await page.reload({ waitUntil: 'domcontentloaded' });
        const proposta = await vede(page, 'Hai un giro in corso: tappa 2 di 4. Riprendi?', 20000);
        const f1 = await shot(page, '08-ripresa-proposta');
        await page.getByText('Riprendi', { exact: true }).click();
        const ripreso = await vede(page, 'Tappa 2/4');
        const f2 = await shot(page, '09-ripresa-ripreso');
        // All'apertura dell'app (cruscotto) il giro si propone di nuovo.
        await page.goto(`${BASE}/dashboard-user`, { waitUntil: 'domcontentloaded' });
        const sulCruscotto = await vede(page, 'Hai un giro in corso: tappa 2 di 4. Riprendi?', 20000);
        await page.waitForTimeout(1500); // fine dell'animazione d'ingresso
        const f3 = await shot(page, '10-ripresa-dal-cruscotto');
        // Iniziato 13 ore fa: niente proposta.
        await page.evaluate(() => {
            const k = 'dvai_nav_giro_v1';
            const g = JSON.parse(localStorage.getItem(k));
            g.startedAt = Date.now() - 13 * 3600 * 1000;
            localStorage.setItem(k, JSON.stringify(g));
        });
        await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
        await page.evaluate((tour) => { window.history.replaceState({ usr: { tourData: tour }, key: 'nav1b', idx: 0 }, '', '/map'); }, TOUR);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByText('Avvia', { exact: true }).waitFor({ timeout: 20000 });
        const vecchio = await vede(page, 'Hai un giro in corso', 3000);
        const cancellato = await page.evaluate(() => localStorage.getItem('dvai_nav_giro_v1') === null);
        const f4 = await shot(page, '11-giro-oltre-12-ore');
        await ctx.close();
        return { ok: fatta && proposta && ripreso && sulCruscotto && !vecchio && cancellato, fatta, proposta, ripreso, sulCruscotto, oltre12oreProposto: vecchio, cancellato, errori, schermate: [f1, f2, f3, f4] };
    },
    // 5. Rete assente.
    async 'offline'(browser, s) {
        const { ctx, page, errori } = await nuovaPagina(browser, s);
        await page.evaluate(([a, b]) => { window.__gps.pos = { lat: a, lng: b }; }, LONTANO);
        await avvia(page);
        await page.waitForTimeout(500);
        await emit(page, LONTANO);
        await page.waitForTimeout(2000);
        await ctx.setOffline(true);
        const msg = await vede(page, 'Sei offline. La mappa resta');
        const f1 = await shot(page, '12-offline');
        await ctx.setOffline(false);
        await page.waitForTimeout(1500);
        const via = !(await testo(page, 'Sei offline').isVisible().catch(() => false));
        await ctx.close();
        return { ok: msg && via, msg, tornaLaRete: via, errori, schermate: [f1] };
    },
    // 6. Il percorso non si calcola (Directions risponde con un errore).
    async 'percorso'(browser, s) {
        const { ctx, page, errori } = await nuovaPagina(browser, s);
        await page.route(/DirectionsService\.Route/, route => route.abort('failed'));
        await page.evaluate(([a, b]) => { window.__gps.pos = { lat: a, lng: b }; }, LONTANO);
        await avvia(page);
        await page.waitForTimeout(500);
        await emit(page, LONTANO);
        const msg = await vede(page, 'Non riesco a calcolare il percorso fin qui', 20000);
        const html = await page.content();
        const codiceInglese = /ZERO_RESULTS|NOT_FOUND|OVER_QUERY_LIMIT|REQUEST_DENIED|UNKNOWN_ERROR|INVALID_REQUEST|MAX_ROUTE_LENGTH_EXCEEDED/.test(await page.locator('body').innerText());
        const mappe = await page.getByText('Apri in Mappe').getAttribute('href').catch(() => null);
        const f1 = await shot(page, '13-percorso-non-calcolabile');
        await ctx.close();
        return { ok: msg && !codiceInglese && !!mappe, msg, codiceInglese, linkMappe: mappe ? mappe.replace(/daddr=[^&]+/, 'daddr=<tappa>') : null, errori, schermate: [f1], htmlLen: html.length };
    },
    // 7. Tappa superata senza fermarsi.
    async 'superata'(browser, s) {
        const { ctx, page, errori } = await nuovaPagina(browser, s);
        await page.evaluate(([a, b]) => { window.__gps.pos = { lat: a, lng: b }; }, LONTANO);
        await avvia(page);
        await page.waitForTimeout(500);
        // Si passa a ~50 m dalla Fontana (fuori dai 25 m) e si prosegue.
        for (const p of [LONTANO, [37.50500, 15.08710], [37.50315, 15.08710], [37.50360, 15.08800], [37.50400, 15.08900]]) {
            await emit(page, p);
            await page.waitForTimeout(700);
        }
        const domanda = await vede(page, 'Sei passato da Fontana dell\'Elefante?');
        const f1 = await shot(page, '14-tappa-superata-domanda');
        await page.getByText('Vista', { exact: true }).click();
        const vista = await vede(page, 'Tappa 2/4');
        const f2 = await shot(page, '15-tappa-superata-vista');
        const wakeLock = await page.evaluate(() => ({ api: 'wakeLock' in navigator }));
        await ctx.close();
        return { ok: domanda && vista, domanda, vista, wakeLock, errori, schermate: [f1, f2] };
    },
};

const browser = await webkit.launch();
let codice = 0;
try {
    await controllaPorta(browser);
    const s = await accedi(browser);
    for (const [nome, fn] of Object.entries(SCENARI)) {
        if (SOLO.length && !SOLO.includes(nome)) continue;
        const t0 = Date.now();
        try {
            const r = await fn(browser, s);
            esiti.push({ scenario: nome, secondi: Math.round((Date.now() - t0) / 1000), ...r });
        } catch (e) {
            esiti.push({ scenario: nome, ok: false, errore: String(e?.message || e).slice(0, 300) });
        }
        console.error(`[nav1] ${nome}: ${esiti.at(-1).ok ? 'OK' : 'NO'}`);
    }
} catch (e) {
    console.error('[nav1] fermo:', e.message);
    codice = 2;
} finally {
    await browser.close();
    if (!process.env.NAV_TMP) fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(JSON.stringify({ webkit: webkit.name(), base: BASE, esiti }, null, 2));
process.exit(codice || (esiti.every(e => e.ok) ? 0 : 1));
