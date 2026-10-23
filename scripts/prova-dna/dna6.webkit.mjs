/**
 * DNA-6 — prova dal vivo sul sito pubblicato (PROVA_BASE, default https://unnivai.vercel.app), WebKit iPhone 13, account di prova.
 *   A. Profilo: «Il tuo DNA» e le Mete dalle righe VERE di dna_events; schermate.
 *   B. Una correzione («Più natura») scritta davvero, poi ricarica e rilettura: la riga dna_correction c'e' e il peso cambia.
 *   C. Un giro Per Te (Catania 15/10 12:05, places/openai serviti dai tracciati del banco: 0 $) salvato col tasto «Salva il giro»:
 *      POST su saved_tours, riga riletta, giro nel Profilo.
 * Credenziali da .env.local, mai stampate. Esito JSON su stdout, schermate in PROVA_OUT.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { gunzipSync } from 'node:zlib';
import { creaReteReplay } from '../banco/replay/rete.js';

const BASE = process.env.PROVA_BASE || 'https://unnivai.vercel.app';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dna-4-'));
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const GUARDIA = 'docs/prove/dati/guardia-home-tracciati.json.gz';
const BORGO = 'docs/prove/dati/2026-10-21-borgo-diagnosi-tracciati.json.gz';
const CATANIA = { latitude: 37.5023612, longitude: 15.0873718, citta: 'Catania', prov: 'Catania' };
const TROINA = { latitude: 37.7823936, longitude: 14.5949418, citta: 'Troina', prov: 'Enna' };

const traccia = (file, id) => {
    const t = JSON.parse(gunzipSync(fs.readFileSync(file)).toString('utf8'));
    const c = t.casi.find(x => x.id === id);
    return { ...c, rete: { ...c.rete, places: { ...(t.comune?.places || {}), ...(c.rete?.places || {}) } } };
};
const replay = (file, id) => creaReteReplay({ rete: traccia(file, id).rete }, { racconto: 'registrato' });
const json = (body, status = 200, extra = {}) => ({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...extra }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const ora = (iso) => new Date(iso);

async function accedi(browser) {
    if (!env.TEST_ACCOUNT_EMAIL || !env.TEST_ACCOUNT_PASSWORD) throw new Error('Mancano le credenziali di prova in .env.local');
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    let bloccate = 0;
    await page.route(/functions\/v1\/(places-proxy|openai-proxy)/, r => { bloccate++; r.fulfill(json({ error: 'bloccato durante l\'accesso' }, 503)); });
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await page.title())) throw new Error(`Titolo non DoveVai su ${BASE}/login: niente credenziali.`);
    await page.getByText('Accedi →').click();
    await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await page.getByText('Accedi Ora').click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 });
    await page.waitForTimeout(3000);
    const statePath = path.join(TMP, 'sessione.json');
    await ctx.storageState({ path: statePath });
    await ctx.close();
    return { statePath, bloccate };
}

// Un contesto (un telefono) con la rete del replay che si puo' cambiare a meta' prova (la fascia nuova ha il suo tracciato).
async function telefono(browser, statePath, pos, { dnaMuto = false } = {}) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath, locale: 'it-IT', timezoneId: 'Europe/Rome',
        geolocation: pos, permissions: ['geolocation'] });
    const page = await ctx.newPage();
    const stato = { fase: null, rete: null, t0: Date.now(), biglietti: [], uscite: 0, places: 0, placesPerFase: {}, avvii: {} };
    const ms = () => Date.now() - stato.t0;
    await page.route(/functions\/v1\/places-proxy/, async (route) => {
        const req = route.request();
        stato.places++; stato.placesPerFase[stato.fase] = (stato.placesPerFase[stato.fase] || 0) + 1;
        try { const res = await stato.rete.fetch(req.url(), { method: req.method(), body: req.postData() ?? undefined }); route.fulfill(json(res.status === 204 ? '' : await res.text(), res.status)); }
        catch { stato.uscite++; route.fulfill(json({ error: 'uscita in rete vietata' }, 503)); }
    });
    await page.route(/functions\/v1\/openai-proxy/, async (route) => {
        const req = route.request();
        let dv = null; try { dv = JSON.parse(req.postData() || '{}').dv || null; } catch { /* corpo non JSON */ }
        if (dv?.ticket) stato.biglietti.push({ fase: stato.fase, ms: ms(), ticket: dv.ticket, kind: dv.kind || null });
        // una chiamata senza `dv` non e' nei tracciati: 503 senza passare dal replay (come PROVA_AUX_A_PARTE in doppio-perte)
        if (!dv) return route.fulfill(json({ error: 'aux non servita nella prova' }, 503));
        try { const res = await stato.rete.fetch(req.url(), { method: req.method(), body: req.postData() ?? undefined }); route.fulfill(json(await res.text(), res.status)); }
        catch { stato.uscite++; route.fulfill(json({ error: 'uscita in rete vietata' }, 503)); }
    });
    await page.route(/nominatim\.openstreetmap\.org/, r => r.fulfill(json({ address: { city: pos.citta, town: pos.citta, county: pos.prov, state: 'Sicilia', country: 'Italia' }, display_name: `${pos.citta}, ${pos.prov}, Sicilia, Italia` })));
    await page.route(/rest\/v1\/ai_quota_daily/, r => r.fulfill(json('[]', 200, { 'content-range': '*/0' })));
    // DNA muto: la richiesta di user_preferences resta appesa (nessuna risposta, nessun errore)
    if (dnaMuto) await page.route(/rest\/v1\/user_preferences/, (route) => { if (route.request().method() !== 'GET') return route.continue(); });
    return { ctx, page, stato, ms };
}

const osserva = async (page, secondi) => {
    for (let i = 0; i < secondi; i++) {
        await page.waitForTimeout(1000);
        const b = page.getByText('Conferma Posizione');
        if (await b.count().catch(() => 0)) await b.first().click().catch(() => {});
    }
};
const carte = async (page) => { const l = page.locator('a[href^="/tour-details/"]'); return { n: await l.count(), prima: await l.first().getAttribute('href', { timeout: 1000 }).catch(() => null) }; };
const OUT = process.env.PROVA_OUT || 'docs/prove/img/dna-6';
fs.mkdirSync(OUT, { recursive: true });
const righeReg = [];
const sorveglia = (page) => page.on('response', async (r) => {
    if (/rest\/v1\/dna_events/.test(r.url()) && r.request().method() === 'GET') { try { const j = await r.json(); if (Array.isArray(j)) righeReg.push(j); } catch { /* non JSON */ } }
});
const ultime = () => righeReg[righeReg.length - 1] || [];
const pesoNatura = (page) => page.getByTestId('dna-natura').innerText().then(t => (t.match(/(\d+)%/) || [])[1] ?? null);

const browser = await webkit.launch();
const esiti = [];
try {
    const { statePath } = await accedi(browser);
    esiti.push({ accesso: 'ok' });

    // ── A + B: Profilo, correzione, rilettura ─────────────────────────────────
    {
        const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath, locale: 'it-IT', timezoneId: 'Europe/Rome' });
        const page = await ctx.newPage();
        sorveglia(page);
        await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
        if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai: mi fermo.');
        await page.getByTestId('dna-profilo').waitFor({ timeout: 20000 });
        await page.waitForTimeout(2500);
        const prima = ultime();
        const frasi = await page.getByTestId('dna-frasi').innerText().catch(() => null);
        const pesoPrima = await pesoNatura(page);
        const contatori = await page.getByTestId('contatori-profilo').innerText().catch(() => null);
        await page.getByTestId('dna-profilo').screenshot({ path: `${OUT}/profilo-dna.png` });
        await page.screenshot({ path: `${OUT}/profilo-intero.png`, fullPage: false });
        await page.getByText('Mete', { exact: true }).first().evaluate(e => (e.closest('button') || e).click());
        await page.getByTestId('mete-profilo').waitFor({ timeout: 10000 });
        const mete = await page.getByTestId('meta').allInnerTexts();
        await page.getByTestId('mete-profilo').screenshot({ path: `${OUT}/profilo-mete.png` });
        esiti.push({ fase: 'A profilo', righeRegistro: prima.length, frasi, pesoNaturaPrima: pesoPrima, contatori, mete });

        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByTestId('dna-profilo').waitFor({ timeout: 20000 });
        await page.waitForTimeout(2500);
        await page.getByTestId('dna-profilo').getByRole('button', { name: 'Più natura' }).waitFor({ timeout: 20000 }).catch(async (e) => { console.error('DNA BLOCCO:', JSON.stringify((await page.getByTestId('dna-profilo').innerText()).slice(-300)), page.url()); await page.screenshot({ path: `${OUT}/debug.png` }); throw e; });
        await page.getByRole('button', { name: 'Più natura' }).evaluate(e => e.click());
        await page.getByTestId('dna-esito').waitFor({ timeout: 15000 });
        const esito = await page.getByTestId('dna-esito').innerText();
        const pesoDopo = await pesoNatura(page);
        await page.getByTestId('dna-profilo').screenshot({ path: `${OUT}/profilo-dna-dopo-correzione.png` });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByTestId('dna-profilo').waitFor({ timeout: 20000 });
        await page.waitForTimeout(2500);
        const riletto = ultime();
        const correzioni = riletto.filter(r => r.kind === 'dna_correction');
        esiti.push({ fase: 'B correzione', esito, pesoNaturaDopo: pesoDopo, pesoNaturaDopoRicarica: await pesoNatura(page),
            righeDopoRicarica: riletto.length, righeCorrezione: correzioni.length, ultimaCorrezione: correzioni.map(r => ({ category: r.category, value: r.value, created_at: r.created_at })).slice(0, 1) });
        await ctx.close();
    }

    // ── C: salvare un giro Per Te ─────────────────────────────────────────────
    {
        const { ctx, page, stato } = await telefono(browser, statePath, CATANIA);
        sorveglia(page);
        const post = [];
        page.on('response', async (r) => { if (/rest\/v1\/saved_tours/.test(r.url()) && r.request().method() === 'POST') post.push({ status: r.status() }); });
        stato.rete = replay(GUARDIA, 'home-catania-perte');
        stato.fase = 'salva';
        await page.clock.setSystemTime(ora('2026-10-15T12:05:00+02:00'));
        await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
        if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai: mi fermo.');
        await osserva(page, 30);
        const c = await carte(page);
        await page.locator('a[href^="/tour-details/"]').first().click();
        await page.waitForTimeout(3000);
        const tasto = page.getByTestId('salva-giro');
        const visibile = await tasto.count();
        let toast = null;
        if (visibile) {
            await tasto.scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${OUT}/tasto-salva.png` });
            await tasto.evaluate(e => e.click());
            await page.waitForTimeout(3500);
            toast = await page.getByText(/Giro salvato|già nel tuo Profilo|Non sono riuscito/).first().innerText().catch(() => null);
            await page.screenshot({ path: `${OUT}/tasto-salva-fatto.png` });
        }
        esiti.push({ fase: 'C salva', carte: c.n, tastoVisibile: visibile, toast, postSavedTours: post, statoTasto: visibile ? await tasto.getAttribute('aria-pressed') : null, uscite: stato.uscite });
        await ctx.close();
    }

    // ── C2: il giro salvato nel Profilo (rilettura) ───────────────────────────
    {
        const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath, locale: 'it-IT', timezoneId: 'Europe/Rome' });
        const page = await ctx.newPage();
        sorveglia(page);
        await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('dna-profilo').waitFor({ timeout: 20000 });
        await page.getByText('Mete', { exact: true }).first().evaluate(e => (e.closest('button') || e).click());
        await page.waitForTimeout(3000);
        const salvati = await page.getByTestId('giro-salvato').allInnerTexts();
        await page.getByTestId('mete-profilo').screenshot({ path: `${OUT}/profilo-giri-salvati.png` });
        const tourSaved = ultime().filter(r => r.kind === 'tour_saved').length;
        esiti.push({ fase: 'C2 profilo', giriSalvati: salvati, righeTourSavedNelRegistro: tourSaved });
        await ctx.close();
    }
    console.log(JSON.stringify(esiti, null, 1));
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
}
