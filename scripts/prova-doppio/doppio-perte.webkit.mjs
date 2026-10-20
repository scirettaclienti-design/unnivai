/**
 * DOPPIO-PERTE — apre la home in WebKit (profilo iPhone 13) con l'account di prova e conta le generazioni che partono:
 * ogni richiesta a openai-proxy viene registrata col suo biglietto (`dv.ticket`, `dv.kind`, `dv.passaggio`). A 0 $:
 * places-proxy e openai-proxy sono serviti dai tracciati del banco (scripts/banco/replay/rete.js); una richiesta che il
 * tracciato non ha riceve un 503 (non esce in rete). Anche durante l'accesso i proxy sono bloccati.
 *
 * Uso: PROVA_BASE=http://localhost:<porta> node scripts/prova-doppio/doppio-perte.webkit.mjs <scenario>[,<scenario>]
 *   scenari: giorno (Per Te a Catania, 15/10 12:05) | sera (Per Te a Troina, 15/10 23:00)
 *   PROVA_SPIA=1      (solo sviluppo) stampa la queryKey di Per Te a ogni avvio del queryFn
 *   PROVA_RICARICA=1  dopo 40 s ricarica la stessa scheda e osserva altri 40 s (apertura "a caldo")
 *   PROVA_FREDDO=1    la prima apertura senza la copia locale del DNA (unnivai_ai_learning_brain_v2)
 *   PROVA_CALDO=1     la copia locale del DNA ha gia' totalInteractions = PROVA_CALDO_N (default 2, quanto il server)
 *   PROVA_AUX_A_PARTE=1  una chiamata a openai-proxy senza `dv` riceve 503 senza passare dal replay (vedi doppio-fix)
 *   PROVA_RIPETI=n  aperture per scenario (default 2: la prima dopo l'accesso, la seconda a freddo con la sessione salvata)
 * Prima: porta del vite di QUESTO repo e titolo con "DoveVai" (CLAUDE.md); lo script ricontrolla il titolo prima delle
 * credenziali. Credenziali da .env.local, mai stampate. Esito JSON su stdout (nessun id utente, nessuna email).
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { gunzipSync } from 'node:zlib';
import { creaReteReplay } from '../banco/replay/rete.js';

const BASE = process.env.PROVA_BASE || 'http://localhost:5181';
const RIPETI = Number(process.env.PROVA_RIPETI || 2);
const SCENARI = (process.argv[2] || 'giorno,sera').split(',').filter(Boolean);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'doppio-perte-'));
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));

const CONF = {
    giorno: { tracciati: 'docs/prove/dati/guardia-home-tracciati.json.gz', caso: 'home-catania-perte', ora: '2026-10-15T12:05:00+02:00',
        pos: { latitude: 37.5023612, longitude: 15.0873718 }, citta: 'Catania', prov: 'Catania' },
    sera: { tracciati: 'docs/prove/dati/2026-10-21-borgo-diagnosi-tracciati.json.gz', caso: 'borgo-a-perte', ora: '2026-10-15T23:00:00+02:00',
        pos: { latitude: 37.7823936, longitude: 14.5949418 }, citta: 'Troina', prov: 'Enna' },
};
const traccia = (file, id) => {
    const g = fs.readFileSync(file);
    const t = JSON.parse(gunzipSync(g).toString('utf8'));
    const c = t.casi.find(x => x.id === id);
    return { ...c, rete: { ...c.rete, places: { ...(t.comune?.places || {}), ...(c.rete?.places || {}) } } };
};
const json = (body, status = 200, extra = {}) => ({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...extra }, body: typeof body === 'string' ? body : JSON.stringify(body) });

async function accedi(browser) {
    if (!env.TEST_ACCOUNT_EMAIL || !env.TEST_ACCOUNT_PASSWORD) throw new Error('Mancano le credenziali di prova in .env.local');
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    let bloccate = 0;
    // durante l'accesso nessun proxy esce: la home che si apre dopo il login non genera niente di vero
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

async function apri(browser, statePath, nome, n) {
    const c = CONF[nome];
    const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath, locale: 'it-IT', timezoneId: 'Europe/Rome',
        geolocation: c.pos, permissions: ['geolocation'] });
    const page = await ctx.newPage();
    await page.clock.setSystemTime(new Date(c.ora));
    // PROVA_FREDDO=1: alla prima apertura la copia locale del DNA non c'e' (telefono nuovo, nuovo accesso, dati cancellati);
    // la ricarica la trova (l'app l'ha riscritta)
    if (process.env.PROVA_FREDDO === '1') await page.addInitScript(() => {
        try { if (!sessionStorage.getItem('__prova_freddo')) { sessionStorage.setItem('__prova_freddo', '1'); localStorage.removeItem('unnivai_ai_learning_brain_v2'); } } catch { /* storage ko */ }
    });
    // PROVA_CALDO=1: la copia locale del DNA dice gia' quanto il server (totalInteractions = PROVA_CALDO_N, default 2)
    if (process.env.PROVA_CALDO === '1') await page.addInitScript((n) => {
        try { const k = 'unnivai_ai_learning_brain_v2'; const v = JSON.parse(localStorage.getItem(k) || '{}'); v.totalInteractions = n; localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage ko */ }
    }, Number(process.env.PROVA_CALDO_N || 2));
    const { fetch: reteReplay, stato } = creaReteReplay({ rete: traccia(c.tracciati, c.caso).rete }, { racconto: 'registrato' });
    const t0 = Date.now();
    const ms = () => Date.now() - t0;
    const openai = [];
    const eventi = [];
    const console_ = [];
    page.on('console', m => { const t = m.text(); if (/DOPPIO|Per Te|TROINA|C8b|home|Quota|quota|C10|city/i.test(t)) console_.push(`${ms()} ${t.slice(0, 160)}`); });
    page.on('request', r => {
        const u = new URL(r.url());
        if (process.env.PROVA_TUTTO === '1' && !/localhost|googleapis|gstatic|fonts/.test(u.hostname)) eventi.push(`${ms()} ${r.method()} ${u.hostname}${u.pathname.replace(/[0-9a-f-]{36}/g, '<id>')}`);
        else if (/supabase\.co$/.test(u.hostname) && !/functions\/v1/.test(u.pathname)) eventi.push(`${ms()} ${r.method()} ${u.pathname.replace(/[0-9a-f-]{36}/g, '<id>')}`);
    });
    const places = [];
    await page.route(/functions\/v1\/places-proxy/, async (route) => {
        const req = route.request();
        places.push(ms());
        try { const res = await reteReplay(req.url(), { method: req.method(), body: req.postData() ?? undefined }); route.fulfill(json(res.status === 204 ? '' : await res.text(), res.status)); }
        catch (e) { route.fulfill(json({ error: String(e?.message || e) }, 503)); }
    });
    await page.route(/functions\/v1\/openai-proxy/, async (route) => {
        const req = route.request();
        let dv = null; try { dv = JSON.parse(req.postData() || '{}').dv || null; } catch { /* corpo non JSON */ }
        const voce = { ms: ms(), purpose: dv?.purpose || 'aux', kind: dv?.kind || null, passaggio: dv?.passaggio || dv?.purpose || null, ticket: dv?.ticket || null, esito: null };
        openai.push(voce);
        // PROVA_AUX_A_PARTE=1 (DOPPIO-FIX): una chiamata senza `dv` non e' nei tracciati del banco e riceve comunque un 503; qui lo
        // riceve senza passare dal replay, che serve le chiamate «altro» in ordine: arrivando prima, prendeva la risposta della generazione
        if (!dv && process.env.PROVA_AUX_A_PARTE === '1') { voce.esito = 'aux: 503 senza replay'; return route.fulfill(json({ error: 'aux non servita nella prova' }, 503)); }
        try { const res = await reteReplay(req.url(), { method: req.method(), body: req.postData() ?? undefined }); voce.esito = res.status; route.fulfill(json(await res.text(), res.status)); }
        catch (e) { voce.esito = `uscita: ${String(e?.message || e).slice(0, 80)}`; route.fulfill(json({ error: 'uscita in rete vietata' }, 503)); }
    });
    await page.route(/nominatim\.openstreetmap\.org/, r => r.fulfill(json({ address: { city: c.citta, town: c.citta, county: c.prov, state: 'Sicilia', country: 'Italia' }, display_name: `${c.citta}, ${c.prov}, Sicilia, Italia` })));
    await page.route(/rest\/v1\/ai_quota_daily/, r => r.fulfill(json('[]', 200, { 'content-range': '*/0' })));
    // PROVA_SPIA=1 (solo server di sviluppo): il browser riceve DashboardUser.jsx con una riga che stampa la queryKey a ogni
    // avvio del queryFn di Per Te. Il file del repo non cambia: e' una modifica di cio' che il browser riceve in questa prova.
    if (process.env.PROVA_SPIA === '1') {
        await page.route(/\/src\/pages\/DashboardUser\.jsx/, async (route) => {
            const res = await route.fetch();
            // prima di DOPPIO-FIX `async () =>`, dopo `async ({ signal }) =>`
            const testo = (await res.text()).replace(/queryFn: async \((\{ signal \})?\) => \{/,
                (_m, s) => `queryFn: async (__ctx) => { const ${s || '__ctxNonUsato'} = __ctx; console.log("[DOPPIO] queryFn " + JSON.stringify(__ctx.queryKey));`);
            route.fulfill({ response: res, body: testo });
        });
    }
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai: mi fermo.');
    // 40 s di osservazione; il selettore della città, se si apre, si conferma
    for (let i = 0; i < 40; i++) {
        await page.waitForTimeout(1000);
        const b = page.getByText('Conferma Posizione');
        if (await b.count().catch(() => 0)) await b.first().click().catch(() => {});
    }
    // PROVA_RICARICA=1: dopo i 40 s (stato locale gia' allineato col server) la stessa scheda si ricarica e si osserva ancora
    const fasi = [{ fase: 'apertura', da: 0 }];
    if (process.env.PROVA_RICARICA === '1') {
        fasi.push({ fase: 'ricarica', da: ms() });
        await page.reload({ waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 40; i++) {
            await page.waitForTimeout(1000);
            const b = page.getByText('Conferma Posizione');
            if (await b.count().catch(() => 0)) await b.first().click().catch(() => {});
        }
    }
    if (process.env.PROVA_FOTO) await page.screenshot({ path: `${process.env.PROVA_FOTO}-${nome}-${n}.png` });
    const testoHome = process.env.PROVA_FOTO ? (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 600) : undefined;
    const url = new URL(page.url()).pathname;
    const card = await page.evaluate(() => document.body.innerText.includes('Per Te') || document.body.innerText.includes('Esperienze Uniche'));
    await ctx.close();
    const biglietti = [...new Set(openai.filter(o => o.purpose === 'generation').map(o => o.ticket))];
    const nomi = new Map(biglietti.map((t, i) => [t, `B${i + 1}`]));
    return {
        scenario: nome, apertura: n, pagina: url, testoHome, sezioneHome: card,
        generazioni: biglietti.length, fasi, richiestePlaces: places.length,
        chiamate: openai.map(o => ({ ms: o.ms, kind: o.kind, passaggio: o.passaggio, biglietto: o.ticket ? nomi.get(o.ticket) : null, esito: o.esito })),
        rest: eventi, console: console_.slice(0, 60), uscite: stato.uscite?.length ?? stato.uscite,
    };
}

const browser = await webkit.launch();
try {
    const { statePath, bloccate } = await accedi(browser);
    const esiti = [{ accesso: 'ok', proxyBloccatiDuranteAccesso: bloccate }];
    for (const s of SCENARI) for (let n = 1; n <= RIPETI; n++) esiti.push(await apri(browser, statePath, s, n));
    console.log(JSON.stringify(esiti, null, 1));
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
}
