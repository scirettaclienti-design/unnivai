/**
 * PROFILO-SEZIONI — ogni sezione del Profilo su un iPhone 14 (WebKit), con un account con giri veri e con un account nuovo.
 *
 *   PROFILO_BASE=http://localhost:4371 node scripts/prova-nav/profilo-sezioni.webkit.mjs [vero,nuovo,ospite,finto]
 *
 *   vero   account di prova, Supabase VERO: un giro salvato percorso davvero col GPS finto fino alla fine giro (scrive solo quello che
 *          scrive un giro: dna_events e l'istantanea in saved_tours), poi ogni sezione e ogni tasto che non scrive.
 *   nuovo  account nuovo vuoto, Supabase simulato (supabase-finto.mjs, 0 $): stati vuoti, ogni tasto.
 *   ospite ospite anonimo, Supabase simulato: stati vuoti, ogni tasto.
 *   finto  account simulato con giri: Rivivi senza Google (tracciato), +/− e salvataggi del DNA (scrivono solo sul simulato).
 *
 * Prima delle credenziali: titolo Unnivai verificato (CLAUDE.md). Credenziali da .env.local, mai stampate. Schermate in
 * docs/prove/schermate/2026-11-07-profilo-sezioni/, esiti in docs/prove/dati/2026-11-07-profilo-sezioni.json.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { conVoceTelefono } from './voce-telefono.mjs';
import { creaServer, collegaServer } from './supabase-finto.mjs';

const BASE = (process.env.PROFILO_BASE || 'http://localhost:4371').replace(/\/$/, '');
const SOLO = (process.argv[2] || 'vero,nuovo,ospite,finto').split(',');
const OUT = path.resolve('docs/prove/schermate/2026-11-07-profilo-sezioni');
const ESITI = path.resolve('docs/prove/dati/2026-11-07-profilo-sezioni.json');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'profilo-'));
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries((fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));

const IPHONE = { ...devices['iPhone 14'], deviceScaleFactor: 2, locale: 'it-IT', timezoneId: 'Europe/Rome' };
const browser = conVoceTelefono(await webkit.launch());
let esiti = { base: BASE, iniziato: new Date().toISOString(), parti: {} };
if (fs.existsSync(ESITI)) { try { esiti = { ...JSON.parse(fs.readFileSync(ESITI, 'utf8')), base: BASE }; } catch { /* si riparte */ } }
const salva = () => fs.writeFileSync(ESITI, JSON.stringify(esiti, null, 1));
let ultima = null;
// l'email dell'account di prova non deve finire in una schermata del repo (CLAUDE.md): si maschera ogni email prima dello scatto
const mascheraEmail = (page) => page.evaluate(() => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (/\S+@\S+/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/\S+@\S+/g, 'email nascosta');
}).catch(() => {});
const foto = async (page, nome, opz = {}) => { ultima = page; await page.waitForTimeout(500); await mascheraEmail(page); await page.screenshot({ path: path.join(OUT, `${nome}.jpg`), type: 'jpeg', quality: 55, ...opz }); return nome; };
const aFoto = async (page, sel, nome) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await l.evaluate((e) => e.scrollIntoView({ block: 'start' })); await page.evaluate(() => window.scrollBy(0, -100)); return foto(page, nome); };

/** Il selettore della città si apre da solo quando la posizione cambia: lo si conferma come farebbe l'utente. */
const chiudiCitta = async (page) => { await page.waitForTimeout(1500); const c = page.getByText('Conferma Posizione'); if (await c.isVisible().catch(() => false)) { if (await c.isDisabled().catch(() => false)) await page.getByRole('button', { name: 'Roma', exact: true }).first().click({ timeout: 5000 }); await c.click({ timeout: 5000 }); await page.waitForTimeout(800); } };

const GPS_FINTO = (inizio) => {
    const g = { watchers: new Map(), id: 0, pos: inizio || null };
    const mk = (p) => ({ coords: { latitude: p.lat, longitude: p.lng, accuracy: 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
    const geo = {
        getCurrentPosition(ok) { if (g.pos) setTimeout(() => ok(mk(g.pos)), 20); },
        watchPosition(ok, ko, o) { const id = ++g.id; g.watchers.set(id, { ok, ko, o }); return id; },
        clearWatch(id) { g.watchers.delete(id); },
    };
    g.emit = (lat, lng) => { g.pos = { lat, lng }; for (const w of [...g.watchers.values()]) w.ok(mk(g.pos)); };
    window.__gps = g;
    Object.defineProperty(Navigator.prototype, 'geolocation', { get: () => geo, configurable: true });
};
const emit = (page, p) => page.evaluate(([a, b]) => window.__gps.emit(a, b), [p.lat, p.lng]);
const R = 6371000, rad = (x) => (x * Math.PI) / 180;
const dist = (a, b) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2));
async function cammina(page, a, b, passo = 45, ms = 450) {
    const n = Math.max(1, Math.round(dist(a, b) / passo));
    for (let k = 1; k <= n; k++) { await emit(page, { lat: a.lat + (b.lat - a.lat) * k / n, lng: a.lng + (b.lng - a.lng) * k / n }); await page.waitForTimeout(ms); }
}
async function arriva(page, p) {
    for (let k = 0; k < 6; k++) { await emit(page, p); await page.waitForTimeout(700); }
    await page.waitForTimeout(2500);
    const riparti = page.getByRole('button', { name: /Riparti|Avanti/ }).first();
    if (await riparti.isVisible().catch(() => false)) await riparti.click().catch(() => {});
    await page.waitForTimeout(800);
}

/**
 * Ogni tasto e link del Profilo: si tocca, si guarda dove porta. Una pagina senza testo, un errore o una rotta sconosciuta è un difetto.
 * `salta`: i tasti che in quella prova non si toccano (Esci, Elimina, e sul Supabase vero quelli che scrivono).
 */
async function tuttiITasti(page, { salta }) {
    const leggi = () => page.evaluate(() => [...document.querySelectorAll('a[href], button')].filter(e => {
        const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.disabled;
    }).map((e, i) => ({ i, nome: (e.getAttribute('aria-label') || e.innerText || e.title || '').replace(/\s+/g, ' ').trim().slice(0, 60), href: e.getAttribute('href') })));
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('contatori-profilo').waitFor({ timeout: 25000 });
    await page.waitForTimeout(2500);
    const elenco = await leggi();
    const fatti = [], difetti = [];
    const visti = new Set();
    for (const t of elenco) {
        const chiave = `${t.nome}|${t.href || ''}`;
        if (visti.has(chiave)) continue;
        visti.add(chiave);
        if (salta(t.nome)) { fatti.push({ nome: t.nome, saltato: true }); continue; }
        await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('contatori-profilo').waitFor({ timeout: 25000 });
        await page.waitForTimeout(1500);
        const ora = await leggi();
        const q = ora.find(x => x.nome === t.nome && x.href === t.href);
        if (!q) { fatti.push({ nome: t.nome, assente: true }); continue; }
        const errori = [];
        const h = (e) => errori.push(String(e?.message || e).slice(0, 120));
        page.on('pageerror', h);
        await page.locator('a[href], button').evaluateAll((els, nome) => {
            const v = els.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.disabled; });
            const x = v.find(e => (e.getAttribute('aria-label') || e.innerText || e.title || '').replace(/\s+/g, ' ').trim().slice(0, 60) === nome.nome && e.getAttribute('href') === nome.href);
            x?.scrollIntoView({ block: 'center' }); x?.click();
        }, { nome: t.nome, href: t.href });
        await page.waitForTimeout(1600);
        const stato = await page.evaluate(() => ({ url: location.pathname, testo: (document.body.innerText || '').replace(/\s+/g, ' ').trim().length, h: document.title, nonTrovata: /non trovat|404/i.test(document.body.innerText || '') }));
        page.off('pageerror', h);
        const r = { nome: t.nome, href: t.href, dopo: stato.url, testo: stato.testo, errori };
        // «Foto» e' nella barra di tutte le pagine: sul web e' la pagina «in costruzione» con il suo contenuto, nell'app non c'e' (SoloWeb)
        if (stato.testo < 40 || stato.nonTrovata || errori.length || (/prossimamente|\/photos/.test(stato.url) && t.nome !== 'Foto')) { r.difetto = true; difetti.push(r); }
        fatti.push(r);
    }
    return { tasti: fatti.length, toccati: fatti.filter(f => f.dopo).length, difetti, elenco: fatti };
}

const SALTA_SEMPRE = (n) => /^Esci$|Elimina|elimina/i.test(n);
const SCRIVE = (n) => /^(Più|Meno|Azzera) |^Azzera tutto|^Rimuovi |^Salva|Sicuro\?/.test(n);

async function parte(id, fn) {
    if (!SOLO.includes(id)) return;
    const r = process.env.PROFILO_TESTATA ? { ...(esiti.parti[id] || {}) } : {};
    esiti.parti[id] = r;
    try { await fn(r); r.ok = !r.errore && !(r.difetti?.length); } catch (e) { r.ok = false; r.errore = String(e?.message || e).split('\n').slice(0, 3).join(' ').slice(0, 400); if (ultima) await ultima.screenshot({ path: path.join(OUT, `${id}-errore.jpg`), type: 'jpeg', quality: 55 }).catch(() => {}); }
    console.log(id, r.ok ? 'ok' : 'NO', JSON.stringify({ ...r, tastiElenco: undefined }).slice(0, 900));
    salva();
}

async function sezioni(page, pref) {
    ultima = page;
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('contatori-profilo').waitFor({ timeout: 25000 });
    await page.waitForTimeout(3000);
    const consenso = page.getByTestId('consenso-ai-ok');
    if (await consenso.isVisible().catch(() => false)) { await consenso.click(); await page.waitForTimeout(800); }
    await chiudiCitta(page);
    await foto(page, `${pref}-01-profilo`);
    await aFoto(page, '[data-testid="dna-profilo"]', `${pref}-02-dna`);
    await aFoto(page, '[data-testid="dna-food"]', `${pref}-03-dna-gusti`);
    await aFoto(page, '[data-interests]', `${pref}-04-interessi`);
    await aFoto(page, '[data-ritmo-compagnia]', `${pref}-05-come-giri`);
    await aFoto(page, '[data-food-prefs]', `${pref}-06-a-tavola`);
    await aFoto(page, '[data-testid="mete-profilo"]', `${pref}-07-mete`);
    await page.getByRole('tab', { name: 'Risultati' }).click();
    await page.waitForTimeout(500);
    await aFoto(page, '[data-testid="risultati-profilo"]', `${pref}-08-risultati`);
    await aFoto(page, '[data-testid="rivivi-giri"]', `${pref}-09-rivivi`);
    return {
        richieste: await page.getByText('Richieste', { exact: true }).count(),
        contatori: (await page.getByTestId('contatori-profilo').innerText()).replace(/\s+/g, ' '),
        risultati: (await page.getByTestId('risultati-profilo').innerText()).replace(/\s+/g, ' ').slice(0, 300),
    };
}

// ─── Account di prova, Supabase vero ─────────────────────────────────────────
await parte('vero', async (r) => {
    if (!env.TEST_ACCOUNT_EMAIL || !env.TEST_ACCOUNT_PASSWORD) throw new Error('mancano le credenziali di prova in .env.local');
    const c0 = await browser.newContext(IPHONE);
    const p0 = await c0.newPage();
    await p0.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/Unnivai/i.test(await p0.title())) throw new Error('titolo non Unnivai: niente credenziali');
    await p0.getByTestId('accesso-con-password').click({ timeout: 10000 });
    await p0.getByPlaceholder(/Email/i).first().fill(env.TEST_ACCOUNT_EMAIL);
    await p0.getByPlaceholder(/^Password$/i).first().fill(env.TEST_ACCOUNT_PASSWORD);
    await p0.locator('form button[type=submit]').first().click();
    await p0.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await p0.waitForTimeout(2500);
    const ok = p0.getByTestId('consenso-ai-ok');
    if (await ok.isVisible().catch(() => false)) await ok.click();
    const stato = path.join(TMP, 'sessione.json');
    await c0.storageState({ path: stato });
    await c0.close();

    let salvati = [];
    const contesto = async (inizio) => {
        const ctx = await browser.newContext({ ...IPHONE, storageState: stato, permissions: ['geolocation'], geolocation: { latitude: inizio.lat, longitude: inizio.lng } });
        await ctx.addInitScript(GPS_FINTO, inizio);
        const page = await ctx.newPage();
        page.on('response', async (x) => {
            if (!/rest\/v1\/saved_tours/.test(x.url()) || x.request().method() !== 'GET' || !/not\.like/.test(decodeURIComponent(x.url()))) return;
            salvati = await x.json().catch(() => salvati);
        });
        return { ctx, page };
    };
    const roma = { lat: 41.8986, lng: 12.4769 };
    const { ctx, page } = await contesto(roma);
    // PROFILO_TESTATA=1: solo le schermate con la testata del Profilo, gli esiti del giro restano
    if (process.env.PROFILO_TESTATA) {
        await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('contatori-profilo').waitFor({ timeout: 25000 });
        await page.waitForTimeout(3500);
        await chiudiCitta(page);
        for (const nome of ['vero-00-prima-del-giro', 'vero-01-profilo', 'vero-14-dopo-rifai']) await foto(page, nome);
        await ctx.close();
        return;
    }
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('contatori-profilo').waitFor({ timeout: 25000 });
    await page.waitForTimeout(3500);
    await foto(page, 'vero-00-prima-del-giro');
    r.contatoriPrima = (await page.getByTestId('contatori-profilo').innerText()).replace(/\s+/g, ' ');

    if (process.env.PROFILO_GIRO !== 'no') {
        const vere = (g) => (g.stops || []).filter(s => !s.tempoLibero && Number.isFinite(Number(s.lat ?? s.latitude)));
        const candidati = salvati.map(g => ({ g, t: vere(g) })).filter(x => x.t.length >= 3 && x.t.length <= 6);
        const conOrari = (x) => (x.t.every(s => s.scheduledTime) ? 0 : 1); // un giro con gli orari salvati, se c'e'
        const scelto = candidati.sort((a, b) => conOrari(a) - conOrari(b) || a.t.length - b.t.length)[0];
        if (!scelto) throw new Error(`nessun giro salvato da percorrere (${salvati.length})`);
        const pt = (s) => ({ lat: Number(s.lat ?? s.latitude), lng: Number(s.lng ?? s.longitude) });
        r.giro = { titolo: scelto.g.title, citta: scelto.g.city, tappe: scelto.t.map(s => s.title) };
        await ctx.close();
        const inizio = { lat: pt(scelto.t[0]).lat + 0.001, lng: pt(scelto.t[0]).lng };
        const c2 = await contesto(inizio);
        const pg = c2.page;
        ultima = pg;
        await pg.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
        await pg.getByTestId('giro-salvato-apri').first().waitFor({ timeout: 25000 });
        await chiudiCitta(pg);
        await pg.getByLabel(`Apri ${scelto.g.title}`).first().click();
        await pg.getByText('Vedi mappa').first().click({ timeout: 10000 });
        await pg.locator('[data-testid="map-avvia-card"]').waitFor({ timeout: 30000 });
        await pg.waitForTimeout(4000);
        await pg.getByText('Avvia', { exact: true }).first().click();
        await pg.waitForTimeout(3500);
        await emit(pg, inizio);
        await pg.waitForTimeout(1000);
        let qui = inizio;
        for (const s of scelto.t) {
            await cammina(pg, qui, pt(s));
            await arriva(pg, pt(s));
            qui = pt(s);
        }
        await pg.getByTestId('fine-giro').waitFor({ timeout: 15000 });
        await pg.waitForTimeout(1500);
        await foto(pg, 'vero-10-fine-giro');
        await pg.getByText('Nelle tue Mete').click();
        await pg.waitForURL(u => u.pathname === '/profile', { timeout: 10000 });
        await pg.getByTestId('rivivi-giro').first().waitFor({ timeout: 20000 });
        await c2.ctx.close();
    } else await ctx.close();

    const { ctx: c3, page: p3 } = await contesto(roma);
    Object.assign(r, await sezioni(p3, 'vero'));
    r.rivivi = await p3.getByTestId('rivivi-giro').count();
    if (r.rivivi > 0) {
        await p3.getByTestId('rivivi-giro').first().click();
        await p3.getByTestId('rivivi-scheda').waitFor({ timeout: 10000 });
        await p3.waitForTimeout(6000);
        await foto(p3, 'vero-11-rivivi-scheda');
        r.mappaVera = await p3.getByTestId('rivivi-mappa').count() > 0;
        r.tappeScheda = await p3.getByTestId('rivivi-tappa').count();
        await p3.getByTestId('rivivi-tappe').scrollIntoViewIfNeeded();
        await foto(p3, 'vero-12-rivivi-tappe');
        await p3.getByTestId('rivivi-rifai').click();
        await p3.locator('[data-testid="map-avvia-card"]').waitFor({ timeout: 30000 });
        await p3.waitForTimeout(4000);
        await foto(p3, 'vero-13-rifai-mappa');
        r.rifaiUrl = new URL(p3.url()).pathname;
    }
    const t = await tuttiITasti(p3, { salta: (n) => SALTA_SEMPRE(n) || SCRIVE(n) });
    r.tasti = t.tasti; r.toccati = t.toccati; r.difetti = t.difetti; r.tastiElenco = t.elenco;
    await c3.close();

    // «Rifai» fino in fondo: lo stesso giro una seconda volta lascia la sua riga in Rivivi e la sua Meta
    if (process.env.PROFILO_RIFAI === '1') {
        const leggiNumeri = async (pg) => { await pg.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' }); await pg.getByTestId('rivivi-giro').first().waitFor({ timeout: 25000 }); await pg.waitForTimeout(2500); await chiudiCitta(pg); return { giri: Number(await pg.getByTestId('contatore-giri').innerText()), tappe: Number(await pg.getByTestId('contatore-tappe').innerText()), rivivi: (await pg.getByTestId('rivivi-altri').count()) ? Number((await pg.getByTestId('rivivi-altri').innerText()).replace(/\D/g, '')) : await pg.getByTestId('rivivi-giro').count() }; };
        const catania = { lat: 37.5027, lng: 15.0873 };
        const c4 = await contesto(catania);
        const p4 = c4.page;
        ultima = p4;
        r.rifaiPrima = await leggiNumeri(p4);
        await p4.getByTestId('rivivi-giro').first().click();
        const nomi = await p4.getByTestId('rivivi-tappa').locator('p').allInnerTexts();
        await p4.getByTestId('rivivi-rifai').click();
        await p4.locator('[data-testid="map-avvia-card"]').waitFor({ timeout: 30000 });
        await p4.waitForTimeout(4000);
        const tappe = await p4.evaluate(() => { const s = history.state?.usr?.tourData?.steps || []; return s.filter(x => !x.tempoLibero).map(x => ({ lat: Number(x.lat ?? x.latitude), lng: Number(x.lng ?? x.longitude) })); });
        r.rifaiId = await p4.evaluate(() => String(history.state?.usr?.tourData?.id || '').replace(/-[^-]+$/, '-…'));
        const inizio = { lat: tappe[0].lat + 0.001, lng: tappe[0].lng };
        await emit(p4, inizio);
        await p4.waitForTimeout(1500);
        await p4.getByText('Avvia', { exact: true }).first().click();
        await p4.waitForTimeout(3500);
        await emit(p4, inizio);
        let qui = inizio;
        for (const s of tappe) { await cammina(p4, qui, s); await arriva(p4, s); qui = s; }
        await p4.getByTestId('fine-giro').waitFor({ timeout: 15000 });
        await p4.waitForTimeout(1500);
        await p4.getByText('Nelle tue Mete').click();
        await p4.waitForURL(u => u.pathname === '/profile', { timeout: 10000 });
        r.rifaiDopo = await leggiNumeri(p4);
        r.rifaiTappe = nomi.length && tappe.length;
        await foto(p4, 'vero-14-dopo-rifai');
        await c4.ctx.close();
        if (r.rifaiDopo.giri !== r.rifaiPrima.giri + 1 || r.rifaiDopo.rivivi !== r.rifaiPrima.rivivi + 1) r.errore = 'il giro rifatto non ha lasciato la sua riga';
    }
});

// ─── Simulati ────────────────────────────────────────────────────────────────
const srv = creaServer();
const META = { role: 'explorer', consenso_ai: { v: 1, at: '2026-10-01T10:00:00Z' }, primo_ingresso_fatto_at: '2026-10-01T10:00:00Z' };
async function telefono(email, password) {
    const ctx = await browser.newContext({ ...IPHONE, permissions: ['geolocation'], geolocation: { latitude: 41.8986, longitude: 12.4769 } });
    await collegaServer(ctx, srv);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/Unnivai/i.test(await page.title())) throw new Error('titolo non Unnivai');
    await page.getByTestId('accesso-con-password').click({ timeout: 10000 });
    await page.getByPlaceholder(/Email/i).first().fill(email);
    await page.getByPlaceholder(/^Password$/i).first().fill(password);
    await page.locator('form button[type=submit]').first().click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 });
    await page.waitForTimeout(1500);
    return { ctx, page };
}

await parte('nuovo', async (r) => {
    const u = srv.nuovoUtente({ email: 'nuova@prova.unnivai.it', password: 'Giro2026ok', confermato: true, meta: { ...META } });
    srv.preferenze.set(u.id, { user_id: u.id, onboarding_seed: { v: 2, interessi: [], vincoli: { dieta: [], budget: null }, gusti: {} } });
    const { ctx, page } = await telefono(u.email, u.password);
    Object.assign(r, await sezioni(page, 'nuovo'));
    r.vuoti = { rivivi: await page.getByTestId('rivivi-vuoto').innerText(), risultati: await page.getByTestId('risultati-vuoti').innerText() };
    const t = await tuttiITasti(page, { salta: SALTA_SEMPRE });
    r.tasti = t.tasti; r.toccati = t.toccati; r.difetti = t.difetti; r.tastiElenco = t.elenco;
    await ctx.close();
});

await parte('ospite', async (r) => {
    const ctx = await browser.newContext({ ...IPHONE, permissions: ['geolocation'], geolocation: { latitude: 41.8986, longitude: 12.4769 } });
    await collegaServer(ctx, srv);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/Unnivai/i.test(await page.title())) throw new Error('titolo non Unnivai');
    ultima = page;
    await page.getByTestId('prova-senza-account').click({ timeout: 10000 });
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 });
    await page.waitForTimeout(2000);
    // l'ospite non ha ancora dato il consenso ai servizi AI: lo da' come un utente (CLAUDE.md, ACCOUNT-PRIVACY)
    const consenso = page.getByTestId('consenso-ai-ok');
    if (await consenso.isVisible().catch(() => false)) { await consenso.click(); await page.waitForTimeout(800); }
    Object.assign(r, await sezioni(page, 'ospite'));
    const t = await tuttiITasti(page, { salta: SALTA_SEMPRE });
    r.tasti = t.tasti; r.toccati = t.toccati; r.difetti = t.difetti; r.tastiElenco = t.elenco;
    await ctx.close();
});

await parte('finto', async (r) => {
    const u = srv.nuovoUtente({ email: 'giri@prova.unnivai.it', password: 'Giro2026ok', confermato: true, meta: { ...META } });
    srv.preferenze.set(u.id, { user_id: u.id, onboarding_seed: { v: 2, interessi: ['food', 'natura'], vincoli: { dieta: [], budget: null }, gusti: {} } });
    const ora = (m) => new Date(Date.now() - m * 60000).toISOString();
    const tappe = [['Pantheon', 41.8986, 12.4769], ['Piazza Navona', 41.8992, 12.4731], ["Campo de' Fiori", 41.8956, 12.4722]];
    srv.giri.set(u.id, [{ id: 'gf1', tour_id: 'fatto-1', source: 'crea', title: 'Il tuo giro a Roma', city: 'Roma', created_at: ora(90), stops: tappe.map(([title, lat, lng], i) => ({ title, lat, lng, fatta: i < 2, scheduledTime: new Date(Date.now() - (200 - i * 40) * 60000).toISOString() })) }]);
    srv.dna.set(u.id, [
        { id: 'a', kind: 'tour_completed', category: 'food', city: 'Roma', value: '2/3', tour_id: 't1', created_at: ora(90) },
        { id: 'b', kind: 'stop_reached', category: 'food', city: 'Roma', value: 'km=0.40;sosta=30;tipo=museo', tour_id: 't1', created_at: ora(120) },
        { id: 'c', kind: 'stop_reached', category: 'cultura', city: 'Roma', value: 'km=0.35;sosta=30;tipo=museo', tour_id: 't1', created_at: ora(100) },
    ]);
    const { ctx, page } = await telefono(u.email, u.password);
    Object.assign(r, await sezioni(page, 'finto'));
    await page.getByTestId('rivivi-giro').first().click();
    await page.getByTestId('rivivi-scheda').waitFor({ timeout: 10000 });
    await page.waitForTimeout(2500);
    await foto(page, 'finto-11-rivivi-senza-google');
    r.tracciato = await page.getByTestId('rivivi-tracciato').count() > 1 || await page.locator('[data-testid="rivivi-scheda"] [data-testid="rivivi-tracciato"]').count() > 0;
    await page.getByTestId('rivivi-chiudi').click();
    // il DNA: + scrive, l'esito sta sotto il gusto col numero che si muove; poi un interesse e il tasto Salva
    await page.getByLabel('Più natura').click();
    await page.getByTestId('dna-esito').waitFor({ timeout: 8000 });
    await page.getByTestId('dna-natura').scrollIntoViewIfNeeded();
    await foto(page, 'finto-12-dna-dopo-piu');
    r.dnaEsito = (await page.getByTestId('dna-natura').innerText()).replace(/\s+/g, ' ');
    r.righeCorrezione = (srv.dna.get(u.id) || []).filter(x => x.kind === 'dna_correction').length;
    const scheda = page.locator('[data-interests]');
    await scheda.getByRole('button', { name: 'Shopping e mercati' }).click();
    await scheda.scrollIntoViewIfNeeded();
    await foto(page, 'finto-13-interessi-da-salvare');
    await scheda.getByTestId('profilo-salva').click();
    await page.waitForTimeout(1000);
    await foto(page, 'finto-14-interessi-salvati');
    r.interessiStato = await scheda.getByTestId('profilo-salva').getAttribute('data-stato');
    const t = await tuttiITasti(page, { salta: SALTA_SEMPRE });
    r.tasti = t.tasti; r.toccati = t.toccati; r.difetti = t.difetti; r.tastiElenco = t.elenco;
    await ctx.close();
});

salva();
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });
