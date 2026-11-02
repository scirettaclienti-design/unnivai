/**
 * OSPITE-GIRO — la prova da ospite sul sito pubblicato, dopo i passi di Ivano (accessi anonimi, migrazione, deploy, modello email).
 *   OSPITE_EMAIL=<indirizzo di prova> node scripts/prova-nav/ospite-giro.webkit.mjs
 * Un telefono nuovo (WebKit, iPhone 14, GPS finto a Catania), nessuna credenziale:
 *   1. «Prova un giro, senza account» → gusti saltati → Crea un giro a Catania (una generazione vera, ~0,11 $);
 *   2. «Vedi su Mappa» → «Avvia» → cammino tappa per tappa (racconti chiesti) → fine giro con «Salva questo giro»;
 *   3. un secondo Crea: l'invito «Il prossimo giro parte dal tuo account», nessuna chiamata al motore;
 *   4. registrazione: email → codice (lo scrive chi prova nel file CODICE_FILE, letto dalla posta) → password → Profilo:
 *      stesso id utente di prima, contatore dei giri ≥ 1, la Meta di Catania.
 * La password è casuale e non si stampa. Esiti in docs/prove/dati/<data>-ospite-giro.json, schermate in docs/prove/schermate/ospite-giro/.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const BASE = process.env.COLLAUDO_BASE || 'https://unnivai.vercel.app';
const EMAIL = process.env.OSPITE_EMAIL || '';
const CODICE_FILE = process.env.CODICE_FILE || path.join(os.tmpdir(), 'codice-ospite');
const DATA = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
const OUT = path.resolve('docs/prove/schermate/ospite-giro');
const ESITI = path.resolve(`docs/prove/dati/${DATA}-ospite-giro.json`);
fs.mkdirSync(OUT, { recursive: true });
if (!EMAIL) throw new Error('serve OSPITE_EMAIL (un indirizzo di prova di Ivano)');

const R = 6371000, rad = (x) => (x * Math.PI) / 180;
const dist = (a, b) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2));
const PARTENZA = { lat: 37.5027, lng: 15.0873 }; // piazza del Duomo, Catania

const GPS_FINTO = (inizio) => {
    const g = { watchers: new Map(), id: 0, pos: inizio || null };
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

const esito = { base: BASE, iniziato: new Date().toISOString(), passi: {}, ok: false };
const salva = () => fs.writeFileSync(ESITI, JSON.stringify(esito, null, 1));
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: 'it-IT', timezoneId: 'Europe/Rome', permissions: ['geolocation'], geolocation: { latitude: PARTENZA.lat, longitude: PARTENZA.lng } });
await ctx.addInitScript(GPS_FINTO, PARTENZA);
const page = await ctx.newPage();
const reg = { generazioni: [], racconti: [], errori: [] };
page.on('pageerror', (e) => reg.errori.push(String(e?.message || e).slice(0, 160)));
page.on('request', (r) => {
    if (!/functions\/v1\/openai-proxy/.test(r.url()) || r.method() !== 'POST') return;
    const dv = (() => { try { return r.postDataJSON()?.dv; } catch { return null; } })();
    if (dv?.purpose === 'generation') reg.generazioni.push({ kind: dv.kind, ticket: dv.ticket, passaggio: dv.passaggio || null });
    if (dv?.purpose === 'racconto') reg.racconti.push(dv.nome);
});
const foto = async (nome) => { const f = path.join(OUT, `${nome}.png`); await page.screenshot({ path: f }); return path.relative(process.cwd(), f); };
const emit = (p) => page.evaluate(([la, ln]) => window.__gps.emit(la, ln, 8), [p.lat, p.lng]);
const idUtente = () => page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => /^sb-.*-auth-token$/.test(x));
    try { const s = JSON.parse(localStorage.getItem(k)); return { id: s?.user?.id || null, anonimo: s?.user?.is_anonymous ?? null }; } catch { return null; }
});
/** ACCOUNT-PRIVACY — il consenso ai servizi AI di terzi: lo dà come un utente, se la schermata c'è (una volta per account). */
async function consensoAi(page, attesa = 8000) {
    const ok = page.getByTestId('consenso-ai-ok');
    try {
        await ok.waitFor({ timeout: attesa });
        await ok.click();
        await page.getByTestId('consenso-ai').waitFor({ state: 'detached', timeout: 8000 });
        return true;
    } catch { return false; }
}
async function passo(nome, fn) {
    const t0 = Date.now();
    try { esito.passi[nome] = { ...(await fn()), secondi: Math.round((Date.now() - t0) / 1000) }; }
    catch (e) { esito.passi[nome] = { ok: false, errore: String(e?.message || e).slice(0, 300), foto: await foto(`${nome}-errore`).catch(() => null) }; salva(); throw e; }
    console.log(nome, JSON.stringify(esito.passi[nome]).slice(0, 500));
    salva();
}
async function crea(testo) {
    await page.goto(`${BASE}/ai-itinerary`, { waitUntil: 'domcontentloaded' });
    const campo = page.getByPlaceholder(/Es: 'Voglio perdermi/);
    await campo.waitFor({ timeout: 30000 });
    await campo.fill(testo);
    await page.getByText('Genera Viaggio', { exact: true }).click();
}

try {
    await passo('0-titolo', async () => {
        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
        const titolo = await page.title();
        if (!/DoveVai/i.test(titolo)) throw new Error(`titolo «${titolo}» non DoveVai`);
        return { ok: true, titolo };
    });

    await passo('1-ospite', async () => {
        await page.getByTestId('prova-senza-account').click({ timeout: 20000 });
        await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 30000 });
        await consensoAi(page);
        if (/\/onboarding/.test(page.url())) {
            await page.getByText('Salta per ora').click({ timeout: 20000 });
            await page.waitForURL((u) => /\/dashboard-user/.test(u.pathname), { timeout: 30000 });
        }
        const u = await idUtente();
        esito.utenteOspite = u;
        return { ok: !!u?.id && u.anonimo === true, url: new URL(page.url()).pathname, anonimo: u?.anonimo, foto: await foto('1-home-ospite') };
    });

    await passo('2-crea', async () => {
        await crea('Due ore a piedi nel centro di Catania, tra chiese e piazze');
        await page.getByText('Vedi su Mappa').waitFor({ timeout: 180000 });
        return { ok: reg.generazioni.length > 0, generazioni: reg.generazioni.length, foto: await foto('2-giro-creato') };
    });

    await passo('3-giro', async () => {
        await page.getByText('Vedi su Mappa').click();
        await page.locator('[data-testid="map-avvia-card"]').waitFor({ timeout: 30000 });
        const tappe = await page.evaluate(() => (window.history.state?.usr?.route || []).map((s) => ({ lat: s.latitude, lng: s.longitude, nome: s.title })));
        if (tappe.length < 2) throw new Error(`tappe sulla mappa: ${tappe.length}`);
        await page.waitForTimeout(3000);
        await page.getByText('Avvia', { exact: true }).first().click();
        await page.waitForTimeout(1500);
        let qui = PARTENZA;
        await emit(qui);
        const arrivi = [];
        for (const t of tappe) {
            const n = Math.max(1, Math.round(dist(qui, t) / 40));
            for (let k = 1; k <= n; k++) { await emit({ lat: qui.lat + (t.lat - qui.lat) * k / n, lng: qui.lng + (t.lng - qui.lng) * k / n }); await page.waitForTimeout(500); }
            for (let k = 0; k < 6; k++) { await emit(t); await page.waitForTimeout(700); }
            const rito = await page.locator('[data-testid="rito-arrivo"]').count() > 0;
            await page.waitForTimeout(2500);
            const riparti = page.getByRole('button', { name: /Riparti|Avanti/ }).first();
            if (await riparti.count()) await riparti.click({ timeout: 5000 }).catch(() => {});
            arrivi.push({ nome: t.nome, rito });
            qui = t;
            await page.waitForTimeout(1000);
        }
        await page.getByTestId('fine-giro').waitFor({ timeout: 20000 });
        await page.waitForTimeout(1000);
        const salvaOspite = await page.getByTestId('fine-salva-ospite').count() > 0;
        const mete = await page.getByText('Nelle tue Mete').count() > 0;
        return { ok: salvaOspite && !mete, tappe: tappe.length, arrivi, racconti: [...new Set(reg.racconti)], salvaOspite, foto: await foto('3-fine-giro') };
    });

    await passo('4-salva-questo-giro', async () => {
        await page.getByTestId('fine-salva-ospite').click();
        const foglio = page.getByTestId('registrazione-ospite');
        await foglio.waitFor({ timeout: 5000 });
        const momento = await foglio.getAttribute('data-momento');
        const f = await foto('4-salva-questo-giro');
        await page.getByLabel('Chiudi').first().click();
        return { ok: momento === 'fine', momento, foto: f };
    });

    await passo('5-secondo-giro', async () => {
        const prima = reg.generazioni.length;
        await crea('Un altro giro: il lungomare di Catania');
        const foglio = page.getByTestId('registrazione-ospite');
        await foglio.waitFor({ timeout: 15000 });
        const momento = await foglio.getAttribute('data-momento');
        return { ok: momento === 'secondo' && reg.generazioni.length === prima, momento, generazioniNuove: reg.generazioni.length - prima, testo: (await foglio.innerText()).replace(/\s+/g, ' ').slice(0, 200), foto: await foto('5-secondo-giro') };
    });

    await passo('6-registrazione', async () => {
        try { fs.unlinkSync(CODICE_FILE); } catch { /* non c'era */ }
        await page.getByTestId('registrazione-email').fill(EMAIL);
        await page.getByTestId('registrazione-invia').click();
        await page.getByTestId('registrazione-inviata').waitFor({ timeout: 20000 });
        console.log(`ASPETTO IL CODICE: scrivi le 6 cifre in ${CODICE_FILE}`);
        let codice = null;
        for (let i = 0; i < 600 && !codice; i++) {
            await page.waitForTimeout(1000);
            try { codice = fs.readFileSync(CODICE_FILE, 'utf8').trim().match(/^\d{6}$/)?.[0] || null; } catch { /* non ancora */ }
        }
        if (!codice) throw new Error('codice non arrivato in 10 minuti');
        fs.unlinkSync(CODICE_FILE);
        await page.getByTestId('registrazione-codice').fill(codice);
        await page.getByTestId('registrazione-password').fill(`Ospite${crypto.randomBytes(9).toString('base64url')}9`);
        await page.getByTestId('registrazione-conferma').click();
        await page.getByTestId('registrazione-fatta').waitFor({ timeout: 30000 });
        const u = await idUtente();
        return { ok: u?.id === esito.utenteOspite?.id && u?.anonimo === false, stessoId: u?.id === esito.utenteOspite?.id, anonimo: u?.anonimo, foto: await foto('6-registrato') };
    });

    await passo('7-profilo', async () => {
        await page.getByTestId('registrazione-profilo').click();
        await page.waitForURL((u) => /\/profile/.test(u.pathname), { timeout: 20000 });
        const c = page.getByTestId('contatore-giri');
        await c.waitFor({ timeout: 20000 });
        await page.waitForTimeout(3000);
        const giri = Number((await c.innerText()).trim());
        const catania = await page.getByText(/Catania/).count();
        return { ok: giri >= 1 && catania > 0, giri, menzioniCatania: catania, foto: await foto('7-profilo') };
    });
    esito.ok = Object.values(esito.passi).every((p) => p.ok);
} finally {
    esito.finito = new Date().toISOString();
    esito.errori = reg.errori.slice(0, 10);
    esito.generazioni = reg.generazioni.length;
    salva();
    await browser.close();
    console.log(esito.ok ? 'OSPITE-GIRO: TUTTO OK' : 'OSPITE-GIRO: NON OK');
}
