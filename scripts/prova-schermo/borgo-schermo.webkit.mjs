/**
 * BORGO-SCHERMO — prova in WebKit (Safari di Playwright, profilo iPhone 13) del Quiz Natura di sera e di Sorprendimi Natura
 * a Troina, A 0 $: le risposte di places-proxy e openai-proxy arrivano dai tracciati del giro pagato (la stessa rete del replay,
 * scripts/banco/replay/rete.js), l'orologio del browser e' fermo a giovedi' 15/10 alle 23:00, la posizione e' il centro di Troina.
 * Supabase (accesso, profilo) e' quello vero con l'account di prova; il preflight della quota legge una riga vuota.
 *
 * Uso: PROVA_BASE=http://localhost:<porta> node scripts/prova-schermo/borgo-schermo.webkit.mjs [quiz,sorprendimi]
 *   PROVA_TRACCIATI=<tracciati.json.gz>   (default: docs/prove/dati/2026-10-16-borgo-fix-2-tracciati.json.gz)
 * Prima: la porta deve essere il vite di QUESTO repo e il titolo deve contenere "DoveVai" (CLAUDE.md): lo script lo ricontrolla
 * e si ferma prima delle credenziali se non e' cosi'. Credenziali da .env.local, mai stampate ne' salvate nel repo.
 * Esito e schermate in docs/prove/schermate/borgo-schermo/, riassunto JSON su stdout.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { creaReteReplay } from '../banco/replay/rete.js';

const BASE = process.env.PROVA_BASE || 'http://localhost:5181';
const TRACCIATI = process.env.PROVA_TRACCIATI || 'docs/prove/dati/2026-10-16-borgo-fix-2-tracciati.json.gz';
const OUT = path.resolve('docs/prove/schermate/borgo-schermo');
const TMP = fs.mkdtempSync('/tmp/borgo-schermo-');
const SOLO = (process.argv[2] || '').split(',').filter(Boolean);
const ORA = '2026-10-15T23:00:00+02:00';
const TROINA = { latitude: 37.7823936, longitude: 14.5949418 };
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const grezzo = fs.readFileSync(TRACCIATI);
const tracciati = JSON.parse((TRACCIATI.endsWith('.gz') ? gunzipSync(grezzo) : grezzo).toString('utf8'));
const tracciaDi = (id) => {
    const t = (tracciati.casi || []).find(c => c.id === id);
    if (!t) throw new Error(`caso ${id} assente nei tracciati ${TRACCIATI}`);
    return { ...t, rete: { ...t.rete, places: { ...(tracciati.comune?.places || {}), ...(t.rete?.places || {}) } } };
};

const esiti = [];
const shot = async (page, nome) => { const f = path.join(OUT, `${nome}.png`); await page.screenshot({ path: f, fullPage: true }); return path.relative(process.cwd(), f); };
const vede = async (page, t, timeout = 8000) => { try { await page.getByText(t, { exact: false }).first().waitFor({ state: 'visible', timeout }); return true; } catch { return false; } };

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
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 });
    await ctx.storageState({ path: statePath });
    await ctx.close();
    return statePath;
}

/** Una pagina con l'orologio alle 23:00 del 15/10, la posizione a Troina e i proxy serviti dal tracciato del caso. */
async function nuovaPagina(browser, statePath, casoId) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath, locale: 'it-IT', timezoneId: 'Europe/Rome',
        geolocation: TROINA, permissions: ['geolocation'] });
    const page = await ctx.newPage();
    await page.clock.setSystemTime(new Date(ORA));
    const { fetch: reteReplay, stato } = creaReteReplay({ rete: tracciaDi(casoId).rete }, { racconto: 'registrato' });
    const errori = [];
    page.on('pageerror', e => errori.push(String(e?.message || e)));
    // i proxy: SOLO dal tracciato (0 $); una richiesta che il tracciato non ha e' un'uscita in rete, dichiarata
    await page.route(/functions\/v1\/(places-proxy|openai-proxy)/, async (route) => {
        const req = route.request();
        try {
            const res = await reteReplay(req.url(), { method: req.method(), body: req.postData() ?? undefined });
            route.fulfill({ status: res.status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: res.status === 204 ? '' : await res.text() });
        } catch (e) {
            route.fulfill({ status: 503, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: String(e?.message || e) }) });
        }
    });
    // il nome della citta' dalla posizione: Troina (nessuna chiamata a OSM)
    await page.route(/nominatim\.openstreetmap\.org/, (route) => route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ address: { city: 'Troina', town: 'Troina', village: 'Troina', county: 'Enna', state: 'Sicilia', country: 'Italia' }, display_name: 'Troina, Enna, Sicilia, Italia' }) }));
    // il preflight della quota (TEST-ACC: il contatore personale dell'account di prova cresce anche se e' esente): riga vuota
    await page.route(/rest\/v1\/ai_quota_daily/, (route) => route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'content-range': '*/0' }, body: '[]' }));
    return { ctx, page, errori, stato };
}

/** Il selettore della città della TopBar si apre da solo con la posizione nuova e copre la pagina: si conferma Troina. */
const confermaCitta = async (page) => {
    if (await vede(page, 'Conferma Posizione', 6000)) {
        await page.getByText('Conferma Posizione').click();
        await page.waitForTimeout(500);
    }
};

const leggi = async (page) => page.evaluate(() => {
    const t = (sel) => [...document.querySelectorAll(sel)].map(e => e.textContent.trim());
    const durata = [...document.querySelectorAll('p')].find(p => /^Durata$/i.test(p.textContent.trim()))?.previousElementSibling?.textContent?.trim() || null;
    return {
        riquadroMood: t('[data-riquadro-mood]'), riquadroIspirazione: t('[data-riquadro-ispirazione]'),
        durata, naturaNote: t('[data-natura-note]'), scalaNote: t('[data-scala-note]'),
        testo: document.body.innerText.replace(/\s+/g, ' ').slice(0, 4000),
    };
});

const SCENARI = {
    async quiz(browser, s) {
        const { ctx, page, errori, stato } = await nuovaPagina(browser, s, 'borgo-b-quiz-natura');
        await page.goto(`${BASE}/quick-path`, { waitUntil: 'domcontentloaded' });
        await vede(page, 'Troina', 30000);
        await confermaCitta(page);
        await page.getByText('Natura', { exact: true }).first().click();
        await page.getByText('Parchi e Verde', { exact: true }).first().click();
        await page.getByText('Veloce', { exact: true }).first().click();
        await page.getByText('Solo', { exact: true }).first().click();
        const pronto = await vede(page, 'Il tuo DNA Esplorativo', 120000);
        await page.waitForTimeout(1500);
        const f = await shot(page, '01-quiz-natura-sera');
        const dati = pronto ? await leggi(page) : null;
        esiti.push({ scenario: 'quiz', pronto, schermata: f, ...dati, errori, uscite: stato.uscite, promptDiversi: stato.promptDiversi.length, servite: stato.servite });
        await ctx.close();
    },
    async sorprendimi(browser, s) {
        const { ctx, page, errori, stato } = await nuovaPagina(browser, s, 'borgo-b-sorpresa-natura');
        await page.goto(`${BASE}/surprise-tour`, { waitUntil: 'domcontentloaded' });
        await vede(page, 'Esperienza Naturale', 30000);
        await confermaCitta(page);
        await page.getByText('Esperienza Naturale', { exact: false }).first().click();
        await page.getByText(/Genera esperienza|Sorprendimi/).first().click();
        const pronto = await vede(page, 'Tappe', 120000);
        await page.waitForTimeout(1500);
        const f = await shot(page, '02-sorprendimi-natura-sera');
        const dati = pronto ? await leggi(page) : null;
        esiti.push({ scenario: 'sorprendimi', pronto, schermata: f, ...dati, errori, uscite: stato.uscite, promptDiversi: stato.promptDiversi.length, servite: stato.servite });
        await ctx.close();
    },
};

const browser = await webkit.launch();
try {
    await controllaPorta(browser);
    const s = await accedi(browser);
    for (const [nome, fn] of Object.entries(SCENARI)) {
        if (SOLO.length && !SOLO.includes(nome)) continue;
        try { await fn(browser, s); } catch (e) { esiti.push({ scenario: nome, errore: String(e?.message || e) }); }
    }
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
}
const riassunto = esiti.map(({ testo, ...e }) => e);
fs.writeFileSync(path.join(OUT, 'esito.json'), JSON.stringify(esiti, null, 1));
console.log(JSON.stringify(riassunto, null, 1));
