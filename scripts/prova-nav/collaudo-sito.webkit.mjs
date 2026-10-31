/**
 * COLLAUDO-SITO — collaudo automatico sul sito pubblicato dei lavori del 28–30/10 (solo prova: nessuna modifica all'app).
 *   node scripts/prova-nav/collaudo-sito.webkit.mjs [punti, es. 1,2,3]     (difetto: tutti)
 * WebKit, profilo iPhone 14, GPS finto che si muove lungo il percorso (una posizione per volta, come un telefono).
 * Prima delle credenziali: titolo «DoveVai» verificato (CLAUDE.md). Credenziali da .env.local, mai stampate; la sessione salvata sta
 * nella cartella temporanea e si cancella a fine prova. Esiti in docs/prove/dati/2026-10-30-collaudo-sito.json, schermate in
 * docs/prove/schermate/collaudo-sito/.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.COLLAUDO_BASE || 'https://unnivai.vercel.app';
const PUNTI = (process.argv[2] || '1,2,3,4,5,6,7,8').split(',').map(Number);
const OUT = path.resolve('docs/prove/schermate/collaudo-sito');
const ESITI = path.resolve(process.env.COLLAUDO_ESITI || 'docs/prove/dati/2026-10-30-collaudo-sito.json');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'collaudo-'));
fs.mkdirSync(OUT, { recursive: true });
const IPHONE = devices['iPhone 14'];
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));

const R = 6371000, rad = (x) => (x * Math.PI) / 180;
const dist = (a, b) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2));
/** Il punto a `m` metri da `a` verso `b`. */
const verso = (a, b, m) => { const f = m / dist(a, b); return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f }; };

// ── i giri di prova (tappe vere, place_id veri) ──
const NAVSIM = JSON.parse(fs.readFileSync('docs/prove/dati/2026-10-16-nav-sim-giri.json', 'utf8')).casi.find(x => x.id === 'navsim-catania');
const CATANIA = NAVSIM.tours[0].stops.filter(s => !s.tempoLibero).map(s => ({ title: s.title, lat: s.lat, lng: s.lng, place_id: s.place_id, moment: s.moment, types: s.types, stayMinutes: s.stay, description: s.description }));
const T = (title, lat, lng, place_id) => ({ title, lat, lng, place_id, moment: 'mattina', types: ['tourist_attraction'], stayMinutes: 20, description: 'Tappa del collaudo.' });
const giro = (id, city, tappe) => ({ id, title: `Il tuo giro a ${city}`, city, steps: tappe.map((s, i) => ({ id: `s${i + 1}`, latitude: s.lat, longitude: s.lng, ...s })) });
const pt = (s) => ({ lat: s.lat ?? s.latitude, lng: s.lng ?? s.longitude });

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
    window.__toast = [];
    window.addEventListener('dvai:toast', (e) => window.__toast.push(String(e?.detail?.message || '')));
};

const esito = { base: BASE, iniziato: new Date().toISOString(), commitSito: null, punti: {} };
const browser = await webkit.launch();
let statePath = null;

async function controllaTitolo() {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    const titolo = await p.title();
    await ctx.close();
    if (!/DoveVai/i.test(titolo)) throw new Error(`titolo «${titolo}» non DoveVai: niente credenziali`);
}
async function accedi() {
    if (!env.TEST_ACCOUNT_EMAIL || !env.TEST_ACCOUNT_PASSWORD) throw new Error('mancano le credenziali di prova in .env.local');
    const ctx = await browser.newContext({ ...IPHONE, locale: 'it-IT', timezoneId: 'Europe/Rome' });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await p.title())) throw new Error('titolo non DoveVai: niente credenziali');
    await p.getByText('Accedi →').click();
    await p.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await p.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await p.getByText('Accedi Ora').click();
    await p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await p.waitForTimeout(2500);
    const file = path.join(TMP, 'sessione.json');
    await ctx.storageState({ path: file });
    await ctx.close();
    return file;
}

/** Un contesto iPhone 14 con il GPS finto in `inizio`; `ospite` = senza accesso. Registra toast, richieste di voce e di racconto. */
async function nuovo(inizio, { ospite = false } = {}) {
    const ctx = await browser.newContext({ ...IPHONE, ...(ospite ? {} : { storageState: statePath }), locale: 'it-IT', timezoneId: 'Europe/Rome', permissions: ['geolocation'], geolocation: { latitude: inizio.lat, longitude: inizio.lng } });
    await ctx.addInitScript(GPS_FINTO, inizio);
    const page = await ctx.newPage();
    const reg = { voce: [], racconto: [], errori: [] };
    page.on('pageerror', e => reg.errori.push(String(e?.message || e).slice(0, 160)));
    page.on('request', r => {
        if (!/functions\/v1\/openai-proxy/.test(r.url()) || r.method() !== 'POST') return;
        const dv = (() => { try { return r.postDataJSON()?.dv; } catch { return null; } })();
        if (dv?.purpose === 'voce') reg.voce.push({ testo: String(dv.testo || '').slice(0, 160) });
        if (dv?.purpose === 'racconto') reg.racconto.push({ nome: dv.nome, place_id: dv.place_id });
    });
    page.on('response', async r => {
        if (!/functions\/v1\/openai-proxy/.test(r.url()) || r.request().method() !== 'POST') return;
        let dv = null; try { dv = r.request().postDataJSON()?.dv; } catch { /* */ }
        if (dv?.purpose !== 'racconto') return;
        const corpo = await r.json().catch(() => null);
        const x = reg.racconto.find(q => q.place_id === dv.place_id && q.stato == null);
        if (x) Object.assign(x, { stato: r.status(), esito: corpo?.racconto?.esito ?? null, errore: corpo?.error ? String(corpo.error).slice(0, 120) : null, testo: corpo?.racconto?.testo ? String(corpo.racconto.testo).slice(0, 300) : null });
    });
    return { ctx, page, reg };
}
const emit = (page, p, acc = 8) => page.evaluate(([la, ln, a]) => window.__gps.emit(la, ln, a), [p.lat, p.lng, acc]);
const freccia = (page) => page.evaluate(() => { const f = document.querySelector('[data-testid="freccia-partenza"]'); return f ? (f.innerText || '').replace(/\s+/g, ' ').trim() || 'presente' : null; });
const testo = (page, sel) => page.evaluate((s) => document.querySelector(s)?.innerText?.replace(/\s+/g, ' ').trim() || null, sel);
const foto = async (page, nome) => { const f = path.join(OUT, `${nome}.png`); await page.screenshot({ path: f }); return path.relative(process.cwd(), f); };

/** Il giro sulla mappa come «Vedi su Mappa» (stato del router), poi «Avvia» dalla panoramica. */
async function avvia(page, tour) {
    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((tour) => {
        const route = tour.steps.map((s, i) => ({ latitude: s.lat, longitude: s.lng, label: s.title, title: s.title, name: s.title, description: s.description, category: 'Punto Mappa', image: null, index: i + 1, type: 'waypoint' }));
        window.history.replaceState({ usr: { route, tourData: tour }, key: 'collaudo', idx: 0 }, '', '/map');
    }, tour);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="map-avvia-card"]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(4000);
    await page.getByText('Avvia', { exact: true }).first().click();
    await page.waitForTimeout(500);
}
/** Il giro salvato sul telefono e «Riprendi» (come dopo una chiusura dell'app). */
async function riprendi(page, tour, { fatte = [] } = {}) {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ tour, fatte }) => localStorage.setItem('dvai_nav_giro_v1', JSON.stringify({ v: 1, chiave: `id:${tour.id}`, tourData: tour, completedSteps: fatte, skippedSteps: [], targetStepId: null, singleTarget: false, startedAt: Date.now() - 60_000, mode: 'walking', savedAt: Date.now() })), { tour, fatte });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Riprendi' }).first().click({ timeout: 20000 });
    await page.getByTestId('nav-scheda-maniglia').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
}
/** Cammina da `a` a `b` a passi di `passo` metri, una posizione ogni `ms`. */
async function cammina(page, a, b, passo = 40, ms = 600) {
    const n = Math.max(1, Math.round(dist(a, b) / passo));
    for (let k = 1; k <= n; k++) { await emit(page, { lat: a.lat + (b.lat - a.lat) * k / n, lng: a.lng + (b.lng - a.lng) * k / n }); await page.waitForTimeout(ms); }
}
/** Fermo sulla tappa (letture consecutive dentro la soglia), poi «Riparti» se compare. */
async function arriva(page, p) {
    for (let k = 0; k < 6; k++) { await emit(page, p); await page.waitForTimeout(700); }
    const r = { rito: await page.locator('[data-testid="rito-arrivo"], [data-testid="arrivo"]').count() > 0 };
    await page.waitForTimeout(2500);
    const riparti = page.getByRole('button', { name: /Riparti|Avanti/ }).first();
    if (await riparti.count()) { await riparti.click({ timeout: 5000 }).catch(() => {}); r.riparti = true; }
    await page.waitForTimeout(1200);
    return r;
}
async function salta(page) {
    const b = page.getByLabel('Salta tappa').first();
    const box = await b.boundingBox();
    await b.click({ timeout: 8000 });
    await page.waitForTimeout(1200);
    return box;
}
async function contatoreGiri(page) {
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    const c = page.getByTestId('contatore-giri');
    await c.waitFor({ timeout: 20000 });
    await page.waitForTimeout(2500);
    return Number((await c.innerText()).trim());
}
async function punto(n, nome, fn) {
    if (!PUNTI.includes(n)) return;
    const t0 = Date.now();
    try { esito.punti[n] = { nome, ...(await fn()) }; } catch (e) { esito.punti[n] = { nome, ok: false, errore: String(e?.message || e).slice(0, 300) }; }
    esito.punti[n].secondi = Math.round((Date.now() - t0) / 1000);
    console.log(n, JSON.stringify(esito.punti[n]).slice(0, 600));
    fs.writeFileSync(ESITI, JSON.stringify(esito, null, 1));
}

try {
    await controllaTitolo();
    statePath = await accedi();
    const c3 = giro('collaudo-freccia', 'Catania', CATANIA.slice(0, 4));
    const t1 = pt(CATANIA[0]);
    const partenza = { lat: t1.lat + 0.0012, lng: t1.lng }; // ~130 m a nord della tappa 1

    // 1) la freccia sparisce dopo 10 m nel verso giusto
    await punto(1, 'freccia sparisce dopo 10 m', async () => {
        const { ctx, page, reg } = await nuovo(partenza);
        await avvia(page, c3);
        for (let k = 0; k < 4; k++) { await emit(page, partenza); await page.waitForTimeout(700); }
        await page.waitForTimeout(2500);
        const r = { allAvvio: await freccia(page), fotoAvvio: await foto(page, '1-avvio') };
        await emit(page, verso(partenza, t1, 5)); await page.waitForTimeout(1500);
        r.a5m = await freccia(page);
        for (let k = 0; k < 3; k++) { await emit(page, verso(partenza, t1, 15)); await page.waitForTimeout(800); }
        await page.waitForTimeout(1500);
        r.a15m = await freccia(page);
        r.ok = !!r.allAvvio && !r.a15m;
        if (!r.ok) r.foto = await foto(page, '1-no');
        else r.fotoDopo = await foto(page, '1-dopo-15m');
        r.errori = reg.errori.slice(0, 5);
        await ctx.close();
        return r;
    });

    // 2) alla tappa 2 dopo «Salta» niente freccia
    await punto(2, 'tappa 2 dopo «Salta»: niente freccia', async () => {
        const { ctx, page, reg } = await nuovo(partenza);
        await avvia(page, c3);
        for (let k = 0; k < 4; k++) { await emit(page, partenza); await page.waitForTimeout(700); }
        await page.waitForTimeout(2500);
        const r = { allAvvio: await freccia(page) };
        await salta(page);
        const t2 = pt(CATANIA[1]);
        for (let k = 1; k <= 3; k++) { await emit(page, verso(partenza, t2, k * 3)); await page.waitForTimeout(800); }
        await page.waitForTimeout(2000);
        r.tappa2 = await freccia(page);
        r.pillola = await testo(page, '[data-testid="nav-pillola"]');
        r.ok = !!r.allAvvio && !r.tappa2;
        r[r.ok ? 'fotoDopo' : 'foto'] = await foto(page, r.ok ? '2-tappa-2' : '2-no');
        r.errori = reg.errori.slice(0, 5);
        await ctx.close();
        return r;
    });

    // 3) GPS muto 60 s e ripresa: niente freccia
    await punto(3, 'GPS muto 60 s e ripresa: niente freccia', async () => {
        const { ctx, page, reg } = await nuovo(partenza);
        await avvia(page, c3);
        for (let k = 0; k < 4; k++) { await emit(page, partenza); await page.waitForTimeout(700); }
        await page.waitForTimeout(2500);
        const r = { allAvvio: await freccia(page) };
        await page.waitForTimeout(62_000); // nessuna posizione per ~65 s
        r.avvisoDuranteSilenzio = await testo(page, '[data-testid="nav-avviso"]');
        r.frecciaDuranteSilenzio = await freccia(page);
        r.fotoSilenzio = await foto(page, '3-silenzio');
        for (let k = 0; k < 4; k++) { await emit(page, partenza); await page.waitForTimeout(800); } // stessa posizione: nessun passo verso la tappa
        await page.waitForTimeout(2500);
        r.dopoRipresa = await freccia(page);
        r.avvisoDopo = await testo(page, '[data-testid="nav-avviso"]');
        r.ok = !!r.allAvvio && !r.dopoRipresa;
        r[r.ok ? 'fotoDopo' : 'foto'] = await foto(page, r.ok ? '3-ripresa' : '3-no');
        r.errori = reg.errori.slice(0, 5);
        await ctx.close();
        return r;
    });

    // 4) Roma: 700 m camminati → curiosità dei nasoni a schermo e richiesta di voce; Catania: nessuna curiosità
    await punto(4, 'curiosità: Roma sì (schermo + voce), Catania no', async () => {
        const camminata = async (tour, a, b, nome) => {
            const { ctx, page, reg } = await nuovo(a);
            await riprendi(page, tour);
            await emit(page, a); await page.waitForTimeout(800);
            await cammina(page, a, b, 50, 700);
            await page.waitForTimeout(2500);
            const toast = (await page.evaluate(() => window.__toast)).filter(m => m.startsWith('🎧'));
            const voceNasoni = reg.voce.filter(v => /fontanelle|nasoni/i.test(v.testo));
            const out = { metri: Math.round(dist(a, b)), toast, voceNasoni, voceTutte: reg.voce.length, foto: await foto(page, `4-${nome}`), errori: reg.errori.slice(0, 5) };
            await ctx.close();
            return out;
        };
        // Roma: da piazza Venezia verso nord lungo via del Corso; le tappe stanno a sud-est (Colosseo), mai raggiunte
        const roma = giro('collaudo-curiosita-roma', 'Roma', [T('Colosseo', 41.8902, 12.4922, null), T('Arco di Costantino', 41.8898, 12.4906, null)]);
        const ra = { lat: 41.8962, lng: 12.4823 }, rb = { lat: 41.9025, lng: 12.4806 };
        const catania = giro('collaudo-curiosita-catania', 'Catania', CATANIA.slice(0, 3));
        const ca = { lat: 37.5027 + 0.002, lng: 15.0871 }, cb = { lat: 37.5027 + 0.0085, lng: 15.0871 }; // via Etnea verso nord
        const r = { roma: await camminata(roma, ra, rb, 'roma'), catania: await camminata(catania, ca, cb, 'catania') };
        const romaOk = r.roma.toast.some(m => /fontanelle|nasoni/i.test(m)) && r.roma.voceNasoni.length > 0;
        const cataniaOk = r.catania.toast.length === 0 && r.catania.voceNasoni.length === 0;
        r.ok = romaOk && cataniaOk;
        r.romaOk = romaOk; r.cataniaOk = cataniaOk;
        return r;
    });

    // 5) schede: Orto Botanico di Roma e Villa Sciarra (scartati r4 in produzione, si riscrivono con r5), Palazzo Massimo alle Colonne e
    //    Piazza del Campidoglio (Roma, passati nelle prove r4), due tappe di Catania
    await punto(5, 'schede: racconto o frase breve; riga in place_racconti', async () => {
        const schede = async (tour, nome) => {
            const s1 = pt(tour.steps[0]);
            const { ctx, page, reg } = await nuovo({ lat: s1.lat + 0.002, lng: s1.lng });
            await riprendi(page, tour);
            const out = [];
            for (let i = 0; i < 2; i++) {
                const st = tour.steps[i];
                await page.waitForTimeout(1500);
                await page.getByLabel(`Apri la scheda: ${st.title}`).first().click({ timeout: 15000 });
                await page.getByTestId('scheda-tappa').waitFor({ timeout: 15000 });
                // il racconto lo chiede la mappa appena la tappa è la prossima: si aspetta la risposta (tetto 50 s)
                for (let k = 0; k < 50 && !reg.racconto.find(q => q.place_id === st.place_id && q.stato != null); k++) await page.waitForTimeout(1000);
                await page.waitForTimeout(1500);
                out.push({ tappa: st.title, place_id: st.place_id, racconto: await testo(page, '[data-testid="racconto"]'), perche: await testo(page, '[data-testid="perche"]'), server: reg.racconto.find(q => q.place_id === st.place_id) || null, foto: await foto(page, `5-${nome}-${i + 1}`) });
                await page.getByLabel('Chiudi la scheda').first().click({ timeout: 5000 }).catch(async () => { await page.keyboard.press('Escape'); });
                await page.waitForTimeout(1000);
                if (i === 0) await salta(page);
            }
            await ctx.close();
            return out;
        };
        const roma = giro('collaudo-schede-roma', 'Roma', [
            T('Orto Botanico di Roma', 41.8918051, 12.4630388, 'ChIJa-FrY0BgLxMRDN1UR07SMIE'),
            T('Villa Sciarra', 41.8834801, 12.4646959, 'ChIJ4ya6TTxgLxMR8atV3UYz5ZA'),
            T('Parco del Gianicolo', 41.8923774, 12.4622083, 'ChIJOwPcv0FgLxMRALWOCzn7gbU'),
        ]);
        const roma2 = giro('collaudo-schede-roma-2', 'Roma', [
            T('Palazzo Massimo alle Colonne', 41.8967291, 12.4735541, 'ChIJn7lmdk9gLxMR-uB8_zP3zPE'),
            T('Piazza del Campidoglio', 41.8933592, 12.4828018, 'ChIJOclom0xgLxMRURy9OLL7Hg4'),
            T('Il Palazzo dei Conservatori', 41.8932176, 12.4826273, 'ChIJo6a_XktgLxMRmpblS064lu8'),
        ]);
        const scelte = ['Cattedrale', 'Elefante'].map(k => CATANIA.find(s => s.title.includes(k)));
        const catania = giro('collaudo-schede-catania', 'Catania', [...scelte, CATANIA.find(s => /Bellini|Ursino/.test(s.title)) || CATANIA[5]]);
        const r = { schede: [...await schede(roma, 'roma'), ...await schede(roma2, 'roma-2'), ...await schede(catania, 'catania')] };
        // ok della scheda: un racconto o la frase breve a schermo (mai vuota); la riga in place_racconti la controlla il report (SQL, sola lettura)
        r.schedeOk = r.schede.every(s => !!(s.racconto || s.perche));
        r.ok = null; // si decide con la lettura di place_racconti
        return r;
    });

    // 6) 2 tappe su 3 raggiunte e «Fine»: «2 tappe su 3», Profilo +1, nessun doppione dopo il ricaricamento
    await punto(6, '«Fine» a 2/3: nota, Profilo +1, nessun doppione', async () => {
        const tappe = [T('Pantheon', 41.8986, 12.4769, null), T('Piazza Navona', 41.8992, 12.4731, null), T("Campo de' Fiori", 41.8956, 12.4722, null)];
        const tour = giro(`collaudo-fine-${Date.now()}`, 'Roma', tappe);
        const inizio = { lat: 41.8998, lng: 12.4785 };
        const { ctx, page, reg } = await nuovo(inizio);
        const r = { prima: await contatoreGiri(page) };
        await riprendi(page, tour);
        await emit(page, inizio); await page.waitForTimeout(800);
        await cammina(page, inizio, pt(tappe[0]));
        r.arrivo1 = await arriva(page, pt(tappe[0]));
        await cammina(page, pt(tappe[0]), pt(tappe[1]));
        r.arrivo2 = await arriva(page, pt(tappe[1]));
        r.salvato = await page.evaluate(() => { try { const g = JSON.parse(localStorage.getItem('dvai_nav_giro_v1')); return g ? { fatte: g.completedSteps, saltate: g.skippedSteps } : null; } catch { return null; } });
        await page.getByTestId('nav-scheda-maniglia').click();
        await page.getByLabel('Termina navigazione').click();
        await page.getByTestId('fine-giro').waitFor({ timeout: 10000 });
        r.nota = await testo(page, '[data-testid="fine-nota"]');
        r.fotoFine = await foto(page, '6-fine');
        await page.waitForTimeout(2500);
        r.dopo = await contatoreGiri(page);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByTestId('contatore-giri').waitFor({ timeout: 20000 });
        await page.waitForTimeout(3000);
        r.dopoRicarica = Number((await page.getByTestId('contatore-giri').innerText()).trim());
        await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        r.proposteRipresa = await page.getByRole('button', { name: 'Riprendi' }).count();
        r.dopoHome = await contatoreGiri(page);
        r.tourId = tour.id;
        r.ok = r.nota === 'Sei arrivato a 2 tappe su 3.' && r.dopo === r.prima + 1 && r.dopoRicarica === r.prima + 1 && r.dopoHome === r.prima + 1 && r.proposteRipresa === 0;
        if (!r.ok) r.foto = await foto(page, '6-no');
        r.errori = reg.errori.slice(0, 5);
        await ctx.close();
        return r;
    });

    // 7) «Salta» fino in fondo + 3 tocchi: fine giro, mai login né «Nelle tue Mete» (da ospite: come il caso originale)
    await punto(7, '«Salta» fino in fondo + 3 tocchi', async () => {
        const tour = giro('collaudo-salta', 'Catania', CATANIA.slice(0, 4));
        const r = {};
        const prova = async (ospite) => {
            const { ctx, page, reg } = await nuovo(partenza, { ospite });
            let via = 'riprendi';
            // da ospite la home non propone «Riprendi»: il giro parte da «Avvia» sulla panoramica
            try { await riprendi(page, tour); } catch { via = 'avvia'; await avvia(page, tour); }
            await emit(page, partenza); await page.waitForTimeout(800);
            await page.getByLabel('Salta tappa').first().waitFor({ timeout: 15000 });
            let box = null;
            for (let k = 0; k < tour.steps.length; k++) box = await salta(page).catch(() => box);
            // 3 tocchi di troppo nello stesso punto dell'ultimo «Salta», di seguito come un pollice impaziente
            for (let k = 0; k < 3; k++) { if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(150); }
            await page.waitForTimeout(2500);
            const out = { ospite, via, url: new URL(page.url()).pathname, fineGiro: await page.getByTestId('fine-giro').count() > 0, nota: await testo(page, '[data-testid="fine-nota"]'),
                login: /\/login/.test(page.url()) || (await page.getByPlaceholder('Password').count()) > 0, testo: (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 200) };
            out.ok = out.fineGiro && out.url === '/map' && !out.login;
            out.foto = await foto(page, `7-${ospite ? 'ospite' : 'account'}${out.ok ? '' : '-no'}`);
            out.errori = reg.errori.slice(0, 5);
            await ctx.close();
            return out;
        };
        r.ospite = await prova(true);
        r.account = await prova(false);
        r.ok = [r.ospite, r.account].filter(x => x.riprendi !== false).every(x => x.ok) && [r.ospite, r.account].some(x => x.riprendi !== false);
        return r;
    });

    // 8, 9, 10) GPS a Roma, Crea «un giro a Catania»: «Domani · 9:30 · cambia»; panoramica con pochi km; «Avvia» da lontano
    if (PUNTI.includes(8)) {
        const ROMA = { lat: 41.9009, lng: 12.4833 };
        const { ctx, page, reg } = await nuovo(ROMA);
        const c = {};
        try {
            await page.goto(`${BASE}/ai-itinerary`, { waitUntil: 'domcontentloaded' });
            await page.locator('textarea').first().waitFor({ timeout: 30000 });
            await page.waitForTimeout(3000);
            if (await page.getByText('Conferma Posizione').count()) { await page.getByText('Conferma Posizione').click(); await page.waitForTimeout(1500); }
            await page.locator('textarea').first().fill('un giro a Catania');
            const t0 = Date.now();
            await page.getByText('Genera Viaggio').click();
            await page.getByText('Vedi su Mappa').waitFor({ timeout: 240000 });
            c.generazioneS = Math.round((Date.now() - t0) / 1000);
            await page.waitForTimeout(1000);
            c.partenza = await testo(page, '[data-partenza]');
            c.orari = await page.evaluate(() => [...new Set((document.body.innerText).match(/\b\d{1,2}:\d{2}\b/g) || [])].slice(0, 12));
            c.fotoGiro = await foto(page, '8-crea');
            await page.getByText('Vedi su Mappa').click();
            await page.locator('[data-testid="map-avvia-card"]').waitFor({ timeout: 30000 });
            await page.waitForTimeout(6000);
            c.card = await testo(page, '[data-testid="map-avvia-card"]');
            c.camPanoramica = await page.evaluate(() => window.__dvCamera?.() ?? null);
            c.fotoPanoramica = await foto(page, '9-panoramica');
            await page.getByText('Avvia', { exact: true }).first().click();
            await page.waitForTimeout(5000);
            c.avviso = await testo(page, '[data-testid="avviso-lontano"]');
            c.navigazione = await page.locator('[data-testid="nav-scheda-maniglia"]').count() > 0;
            c.camDopo = await page.evaluate(() => window.__dvCamera?.() ?? null);
            c.segnaposti = await page.evaluate(() => document.querySelectorAll('[data-testid^="segnaposto"], [data-testid="map-marker"], [data-marker-index]').length);
            c.fotoAvvia = await foto(page, '10-avvia');
            c.errori = reg.errori.slice(0, 5);
        } catch (e) { c.errore = String(e?.message || e).slice(0, 300); c.fotoErrore = await foto(page, '8-errore').catch(() => null); }
        await ctx.close();
        esito.crea = c;
        const km = Number(String(c.card || '').match(/(\d+(?:,\d+)?)\s?km/)?.[1]?.replace(',', '.'));
        const centro = c.camDopo?.center || c.camDopo?.centro || null;
        const latC = Number(centro?.lat ?? centro?.latitude);
        esito.punti[8] = { nome: 'GPS a Roma, Crea «un giro a Catania»: «Domani · 9:30 · cambia»', ok: /Domani\s*·\s*9:30\s*·\s*cambia/.test(c.partenza || ''), partenza: c.partenza, orari: c.orari, foto: c.fotoGiro, errore: c.errore };
        esito.punti[9] = { nome: 'panoramica con pochi km fra le tappe', ok: Number.isFinite(km) && km < 15, card: c.card, km, foto: c.fotoPanoramica };
        esito.punti[10] = { nome: '«Avvia» da lontano: «Sei a … km», mappa non nera', ok: /^Sei a \d+ km da /.test(c.avviso || '') && !c.navigazione && (!Number.isFinite(latC) || latC < 38.5), avviso: c.avviso, navigazione: c.navigazione, camDopo: c.camDopo, segnaposti: c.segnaposti, foto: c.fotoAvvia };
        for (const n of [8, 9, 10]) console.log(n, JSON.stringify(esito.punti[n]).slice(0, 500));
        fs.writeFileSync(ESITI, JSON.stringify(esito, null, 1));
    }
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true }); // la sessione dell'account di prova non resta su disco
    esito.finito = new Date().toISOString();
    fs.writeFileSync(ESITI, JSON.stringify(esito, null, 1));
}
