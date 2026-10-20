/**
 * DOPPIO-FIX-2 — conta le generazioni di Per Te (biglietti distinti a openai-proxy) in cinque casi, in WebKit (iPhone 13), con
 * l'account di prova. A 0 $: places-proxy e openai-proxy serviti dai tracciati del banco (una richiesta che il tracciato non ha
 * riceve 503 e non esce in rete); durante l'accesso i proxy sono bloccati.
 *   1. apertura          Catania 15/10 12:05
 *   2. rientro           dopo 3 minuti (12:08), uscendo dalla home e tornandoci dentro l'app
 *   3. ricarica          12:20, ricarica della pagina
 *   4. dna-muto          Catania 12:05, la lettura del DNA (user_preferences) non risponde mai
 *   5. fascia            Troina 12:05 (giorno, mattina) e poi 23:00 (sera, dopocena), rientrando in home: i due tracciati
 *                        coprono queste due ore; il passaggio 17:59 → 18:01 non e' nei tracciati (lo prova il test doppioPerTe)
 * Uso: PROVA_BASE=http://localhost:<porta> node scripts/prova-doppio/doppio-fix-2.webkit.mjs
 * Prima: porta del vite di QUESTO repo e titolo con "DoveVai" (CLAUDE.md); lo script ricontrolla il titolo prima delle
 * credenziali. Credenziali da .env.local, mai stampate. Esito JSON su stdout (nessun id utente, nessuna email).
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { gunzipSync } from 'node:zlib';
import { creaReteReplay } from '../banco/replay/rete.js';

const BASE = process.env.PROVA_BASE || 'http://localhost:5192';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'doppio-fix-2-'));
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
    await page.waitForTimeout(1500);
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
const fase = (stato, nome) => [...new Set(stato.biglietti.filter(b => b.fase === nome).map(b => b.ticket))].length;
const tipi = (stato, nome) => [...new Map(stato.biglietti.filter(b => b.fase === nome).map(b => [b.ticket, b.kind])).values()];
const carte = async (page) => { const l = page.locator('a[href^="/tour-details/"]'); return { n: await l.count(), prima: await l.first().getAttribute('href', { timeout: 1000 }).catch(() => null) }; };
// esce dalla home e ci torna dentro l'app (niente ricarica: la memoria della pagina resta)
const rientra = async (page) => {
    await page.locator('a[href="/explore"]').first().click();
    await page.waitForTimeout(1500);
    await page.goBack();
};

const browser = await webkit.launch();
const esiti = [];
try {
    const { statePath, bloccate } = await accedi(browser);
    esiti.push({ accesso: 'ok', proxyBloccatiDuranteAccesso: bloccate });

    // 1-3: apertura, rientro dopo 3 minuti, ricarica (Catania)
    {
        const { ctx, page, stato } = await telefono(browser, statePath, CATANIA);
        stato.rete = replay(GUARDIA, 'home-catania-perte');
        await page.clock.setSystemTime(ora('2026-10-15T12:05:00+02:00'));
        stato.fase = 'apertura';
        await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
        if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai: mi fermo.');
        await osserva(page, 30);
        const carteApertura = await carte(page);
        stato.fase = 'rientro';
        await page.clock.setSystemTime(ora('2026-10-15T12:08:00+02:00'));
        await rientra(page);
        await osserva(page, 15);
        const carteRientro = await carte(page);
        stato.fase = 'ricarica';
        await page.clock.setSystemTime(ora('2026-10-15T12:20:00+02:00'));
        await page.reload({ waitUntil: 'domcontentloaded' });
        await osserva(page, 20);
        const carteRicarica = await carte(page);
        esiti.push({ caso: 'apertura', generazioni: fase(stato, 'apertura'), tipi: tipi(stato, 'apertura'), ricercheGoogle: stato.placesPerFase['apertura'] || 0, carte: carteApertura });
        esiti.push({ caso: 'rientro dopo 3 minuti', generazioni: fase(stato, 'rientro'), tipi: tipi(stato, 'rientro'), ricercheGoogle: stato.placesPerFase['rientro'] || 0, carte: carteRientro });
        esiti.push({ caso: 'ricarica', generazioni: fase(stato, 'ricarica'), tipi: tipi(stato, 'ricarica'), ricercheGoogle: stato.placesPerFase['ricarica'] || 0, carte: carteRicarica, uscite: stato.uscite, places: stato.places });
        await ctx.close();
    }
    // 4: DNA muto (Catania)
    {
        const { ctx, page, stato } = await telefono(browser, statePath, CATANIA, { dnaMuto: true });
        stato.rete = replay(GUARDIA, 'home-catania-perte');
        await page.clock.setSystemTime(ora('2026-10-15T12:05:00+02:00'));
        stato.fase = 'dna-muto';
        stato.t0 = Date.now();
        await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
        await osserva(page, 30);
        const primo = stato.biglietti.find(b => b.fase === 'dna-muto');
        esiti.push({ caso: 'DNA che non risponde', generazioni: fase(stato, 'dna-muto'), tipi: tipi(stato, 'dna-muto'), ricercheGoogle: stato.placesPerFase['dna-muto'] || 0, primoBigliettoMs: primo?.ms ?? null, carte: await carte(page), uscite: stato.uscite });
        await ctx.close();
    }
    // 5: cambio di fascia (Troina 12:05 → 23:00)
    {
        const { ctx, page, stato } = await telefono(browser, statePath, TROINA);
        stato.rete = replay(GUARDIA, 'home-troina-perte');
        await page.clock.setSystemTime(ora('2026-10-15T12:05:00+02:00'));
        stato.fase = 'fascia-prima';
        await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
        await osserva(page, 30);
        stato.fase = 'fascia-dopo';
        stato.rete = replay(BORGO, 'borgo-a-perte');
        await page.clock.setSystemTime(ora('2026-10-15T23:00:00+02:00'));
        await rientra(page);
        await osserva(page, 30);
        esiti.push({ caso: 'fascia: apertura alle 12:05 (Troina)', generazioni: fase(stato, 'fascia-prima'), tipi: tipi(stato, 'fascia-prima'), ricercheGoogle: stato.placesPerFase['fascia-prima'] || 0 });
        esiti.push({ caso: 'fascia: rientro alle 23:00 (Troina)', generazioni: fase(stato, 'fascia-dopo'), tipi: tipi(stato, 'fascia-dopo'), ricercheGoogle: stato.placesPerFase['fascia-dopo'] || 0, carte: await carte(page), uscite: stato.uscite });
        await ctx.close();
    }
    console.log(JSON.stringify(esiti, null, 1));
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
}
