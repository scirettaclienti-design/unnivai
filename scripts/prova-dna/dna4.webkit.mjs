/**
 * DNA-4 — prova dal vivo: Per Te cambia quando il DNA cambia davvero. Sito pubblicato (PROVA_BASE, default https://unnivai.vercel.app),
 * WebKit iPhone 13, account di prova, login e lettura del registro (dna_events) VERI. A 0 $: places-proxy e openai-proxy sono serviti
 * dai tracciati del banco (come doppio-fix-2); una richiesta che il tracciato non ha riceve 503 e non esce in rete.
 *   1. apertura             Catania 15/10 12:05, DNA vero dell'account                               atteso: 1 generazione
 *   2. rientro (3 minuti)   uscendo dalla home e tornandoci, stesso DNA                              atteso: 0
 *   3. ricarica             stesso DNA                                                                atteso: 0
 *   4. DNA cambiato         il registro, letto al rientro, porta 5 giri food in piu' (righe aggiunte alla risposta
 *                           di rete dal test: NESSUNA riga scritta nel database)                       atteso: 1
 *   5. rientro, stesso DNA nuovo                                                                       atteso: 0
 * Per ogni fase: biglietti distinti di openai-proxy, la chiave di Per Te salvata sul telefono (con la fascia di DNA) e il conto del tetto.
 * Credenziali da .env.local, mai stampate. Esito JSON su stdout.
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


const RIGHE_FINTE = Array.from({ length: 5 }, (_, i) => [
    { id: `prova-dna4-r${i}`, kind: 'stop_reached', category: 'food', value: null, tour_id: `prova-dna4-g${i}`, created_at: '2026-10-15T09:00:00.000Z' },
    { id: `prova-dna4-c${i}`, kind: 'tour_completed', category: 'food', value: null, tour_id: `prova-dna4-g${i}`, created_at: '2026-10-15T09:01:00.000Z' },
]).flat();
const salvato = (page) => page.evaluate(() => {
    const per = JSON.parse(localStorage.getItem('dvai_per_te_v1') || 'null');
    const dna = JSON.parse(localStorage.getItem('dvai_per_te_dna_v1') || 'null');
    const reg = JSON.parse(localStorage.getItem('unnivai_dna_registro_v1') || 'null');
    return { chiave: per ? JSON.parse(per.chiave) : null, conto: dna ? { ultima: dna.ultima, rigenerazioni: dna.rigenerazioni } : null, righeRegistro: reg?.rows?.length ?? null };
});

const browser = await webkit.launch();
const esiti = [];
try {
    const { statePath, bloccate } = await accedi(browser);
    esiti.push({ accesso: 'ok', proxyBloccatiDuranteAccesso: bloccate });
    const { ctx, page, stato } = await telefono(browser, statePath, CATANIA);
    let aggiungiRighe = false;
    let righeLette = 0;
    await page.route(/rest\/v1\/dna_events/, async (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        const res = await route.fetch();
        const righe = await res.json();
        righeLette = Array.isArray(righe) ? righe.length : 0;
        const out = aggiungiRighe && Array.isArray(righe) ? [...RIGHE_FINTE, ...righe] : righe;
        route.fulfill({ status: res.status(), headers: { 'content-type': 'application/json' }, body: JSON.stringify(out) });
    });
    stato.rete = replay(GUARDIA, 'home-catania-perte');
    const passo = async (nome, azione, secondi) => {
        stato.fase = nome;
        await azione();
        await osserva(page, secondi);
        esiti.push({ fase: nome, generazioni: fase(stato, nome), ricercheGoogle: stato.placesPerFase[nome] || 0, righeRegistroLette: righeLette, ...(await salvato(page)), carte: await carte(page), uscite: stato.uscite });
    };
    await page.clock.setSystemTime(ora('2026-10-15T12:05:00+02:00'));
    await passo('1 apertura', async () => {
        await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
        if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai: mi fermo.');
    }, 30);
    await page.clock.setSystemTime(ora('2026-10-15T12:08:00+02:00'));
    await passo('2 rientro (stesso DNA)', () => rientra(page), 15);
    await page.clock.setSystemTime(ora('2026-10-15T12:20:00+02:00'));
    await passo('3 ricarica (stesso DNA)', () => page.reload({ waitUntil: 'domcontentloaded' }), 20);
    aggiungiRighe = true;
    stato.rete = replay(GUARDIA, 'home-catania-perte'); // un replay nuovo: i tracciati servono ogni passaggio AI una volta sola, in ordine
    await page.clock.setSystemTime(ora('2026-10-15T12:25:00+02:00'));
    await passo('4 rientro con 5 giri food in piu\' nel registro', () => rientra(page), 30);
    await page.clock.setSystemTime(ora('2026-10-15T12:30:00+02:00'));
    await passo('5 rientro (stesso DNA nuovo)', () => rientra(page), 15);
    await ctx.close();
    console.log(JSON.stringify(esiti, null, 1));
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
}
