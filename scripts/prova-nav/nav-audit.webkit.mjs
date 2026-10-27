/**
 * NAV-AUDIT — «revisione a video» della navigazione sul SITO PUBBLICATO, WebKit profilo iPhone 15, account di prova, giro di Catania
 * (12 tappe vere + 1 tempo libero), GPS finto, ora finta (NAV_ORA). SOLA LETTURA sul codice dell'app: nessuna modifica, nessun deploy.
 *
 *   NAV_BASE=https://unnivai.vercel.app NAV_TAG=1000 NAV_ORA=2026-10-28T10:00:00+01:00 node scripts/prova-nav/nav-audit.webkit.mjs
 *
 * Registra: il video di tutto il percorso (recordVideo), uno screenshot e una misura per ogni stato, la latenza fra tocco e risposta
 * (dentro la pagina: dal pointerdown al primo cambio di DOM e allo stato atteso visibile, senza il tempo di Playwright), ogni frase
 * detta dalla voce (registro dell'app + speechSynthesis + play() dei media) con l'istante sul video.
 * Passo: la 1ª tratta (fino alla 1ª tappa) a passo d'uomo vero (1,4 m/s); le altre a ~8x (11 m/s) per stare nel tetto di 60 minuti.
 * Il giro entra nella mappa come «Vedi su Mappa» di Crea (history.state, normalizeTour vero). Credenziali solo da .env.local, mai stampate.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeTour } from '../../src/services/tourShape.js';

const BASE = process.env.NAV_BASE || 'https://unnivai.vercel.app';
const TAG = process.env.NAV_TAG || '1000';
const ORA = process.env.NAV_ORA || '2026-10-28T10:00:00+01:00';
const FINE_ONLY = process.env.NAV_SOLO_FINE === '1'; // giro corto: si salta fino all'ultima tappa e si prova solo la fine del giro
const GIRI_FILE = 'docs/prove/dati/2026-10-16-nav-sim-giri.json';
const PERCORSI_FILE = 'docs/prove/dati/2026-10-16-nav-sim-percorsi.json';
const SHOTS = path.resolve('docs/prove/schermate/nav-audit');
const VIDEO_DIR = path.resolve('docs/prove/video');
const OUT = `docs/prove/dati/2026-10-28-nav-audit-${TAG}.json`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'navaudit-'));
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const R = 6371000, rad = (x) => (x * Math.PI) / 180;
const dist = (a, b) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2));
const rotta = (a, b) => (Math.atan2((b.lng - a.lng) * Math.cos(rad(a.lat)), b.lat - a.lat) * 180) / Math.PI;
const sposta = (p, est, nord) => ({ lat: p.lat + nord / 111320, lng: p.lng + est / (111320 * Math.cos(rad(p.lat))) });
function campiona(punti, passo) {
    const out = [punti[0]];
    let resto = 0;
    for (let i = 1; i < punti.length; i++) {
        const a = punti[i - 1], b = punti[i], d = dist(a, b);
        let t = passo - resto;
        while (t <= d) { out.push({ lat: a.lat + ((b.lat - a.lat) * t) / d, lng: a.lng + ((b.lng - a.lng) * t) / d }); t += passo; }
        resto = d - (t - passo);
    }
    const ultimo = punti[punti.length - 1];
    if (dist(out[out.length - 1], ultimo) > 1) out.push(ultimo);
    return out;
}

/* ---------- dentro la pagina ---------- */
const INIT = () => {
    const g = { watchers: new Map(), id: 0, pos: null };
    const mk = (p) => ({ coords: { latitude: p.lat, longitude: p.lng, accuracy: p.acc ?? 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
    const geo = {
        getCurrentPosition(ok) { if (g.pos) setTimeout(() => ok(mk(g.pos)), 20); },
        watchPosition(ok, ko, o) { const id = ++g.id; g.watchers.set(id, { ok, ko, o }); return id; },
        clearWatch(id) { g.watchers.delete(id); },
    };
    g.emit = (lat, lng, acc) => { g.pos = { lat, lng, acc }; for (const w of [...g.watchers.values()]) w.ok(mk(g.pos)); };
    window.__gps = g;
    Object.defineProperty(Navigator.prototype, 'geolocation', { get: () => geo, configurable: true });
    // audio: ogni play() di un media e ogni speechSynthesis.speak()
    window.__audioEv = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...a) { window.__audioEv.push({ t: performance.now(), tipo: 'media.play', src: String(this.currentSrc || this.src || '').slice(0, 80) }); if (window.__lat && window.__lat.t0 != null && window.__lat.audio == null) window.__lat.audio = performance.now(); return play.apply(this, a); };
    try {
        const speak = window.speechSynthesis?.speak?.bind(window.speechSynthesis);
        if (speak) window.speechSynthesis.speak = (u) => { window.__audioEv.push({ t: performance.now(), tipo: 'speechSynthesis', testo: String(u?.text || '').slice(0, 160) }); if (window.__lat && window.__lat.t0 != null && window.__lat.audio == null) window.__lat.audio = performance.now(); return speak(u); };
    } catch { /* niente */ }
    // latenza tocco → risposta
    window.__lat = { t0: null, ui: null, audio: null, pronto: null, sel: null };
    const visibile = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    addEventListener('pointerdown', () => { if (window.__lat.armata) { window.__lat.t0 = performance.now(); window.__lat.armata = false; const tick = () => { const L = window.__lat; if (L.pronto == null && L.sel) { const el = document.querySelector(L.sel); if (el && visibile(el)) L.pronto = performance.now(); } if (L.pronto == null && performance.now() - L.t0 < 6000) requestAnimationFrame(tick); }; requestAnimationFrame(tick); } }, true);
    const avvia = () => {
        new MutationObserver((ms) => {
            const L = window.__lat;
            if (L.t0 == null || L.ui != null) return;
            for (const m of ms) {
                const n = m.target?.nodeType === 1 ? m.target : m.target?.parentElement;
                if (n?.closest?.('.gm-style, [data-testid="utente-marker"], [data-testid="utente-cono"]')) continue;
                if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) { L.ui = performance.now(); return; }
                if (m.type === 'characterData') { L.ui = performance.now(); return; }
            }
        }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    };
    if (document.documentElement) avvia(); else document.addEventListener('DOMContentLoaded', avvia);
};

/** La misura di uno stato: copertura della mappa, tasti < 44 px, testi tagliati, sovrapposizioni. Rettangoli in px CSS. */
const MISURA = () => {
    const W = innerWidth, H = innerHeight;
    const rectOf = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
    const opEff = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const v = parseFloat(getComputedStyle(n).opacity); o *= isNaN(v) ? 1 : v; } return o; };
    const vis = (el) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const b = rectOf(el);
        if (b.w < 1 || b.h < 1 || b.b <= 0 || b.r <= 0 || b.y >= H || b.x >= W) return false;
        return opEff(el) >= 0.2;
    };
    const inMappa = (el) => !!el.closest('.gm-style, [data-testid="utente-marker"], [data-testid="utente-cono"], [data-testid="mappa"]');
    const contieneMappa = (el) => !!el.querySelector('.gm-style');
    const alfa = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(/[ ,\/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1; };
    const dipinto = (el) => { const cs = getComputedStyle(el); return alfa(cs.backgroundColor) >= 0.1 || (cs.backgroundImage && cs.backgroundImage !== 'none') || (cs.backdropFilter && cs.backdropFilter !== 'none') || (parseFloat(cs.borderTopWidth) > 0 && alfa(cs.borderTopColor) >= 0.15 && alfa(cs.borderTopColor) > 0); };
    const nome = (el) => { const t = el.getAttribute('data-testid'); const a = el.getAttribute('aria-label'); const tx = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 28); return t ? `[${t}]` : a ? `${el.tagName.toLowerCase()}«${a}»` : `${el.tagName.toLowerCase()}«${tx}»`; };
    const tutti = [...document.body.querySelectorAll('*')].filter(el => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'PATH', 'CIRCLE', 'LINE', 'POLYLINE', 'RECT', 'G', 'DEFS'].includes(el.tagName.toUpperCase()) && !inMappa(el) && !contieneMappa(el) && el.id !== 'root' && vis(el));
    // blocchi dipinti più esterni
    const dip = tutti.filter(dipinto);
    const esterni = dip.filter(el => !dip.some(o => o !== el && o.contains(el)));
    const grid = 4, gw = Math.ceil(W / grid), gh = Math.ceil(H / grid), cella = new Uint8Array(gw * gh);
    const segna = (b) => { const x0 = Math.max(0, Math.floor(b.x / grid)), x1 = Math.min(gw, Math.ceil(b.r / grid)), y0 = Math.max(0, Math.floor(b.y / grid)), y1 = Math.min(gh, Math.ceil(b.b / grid)); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) cella[y * gw + x] = 1; };
    esterni.forEach(el => segna(rectOf(el)));
    // testo e immagini fuori dai blocchi dipinti
    const nonDentro = (el) => !esterni.some(o => o.contains(el));
    const testi = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const p = n.parentElement; if (!p || !n.textContent.trim() || inMappa(p) || !vis(p)) continue;
        const rg = document.createRange(); rg.selectNodeContents(n); const b = rg.getBoundingClientRect();
        if (b.width < 1 || b.height < 1) continue;
        testi.push({ el: p, b: { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height } });
    }
    testi.filter(t => nonDentro(t.el)).forEach(t => segna(t.b));
    [...document.querySelectorAll('img, svg, canvas, video')].filter(e => vis(e) && !inMappa(e) && !contieneMappa(e) && nonDentro(e)).forEach(e => segna(rectOf(e)));
    let coperte = 0; for (let i = 0; i < cella.length; i++) coperte += cella[i];
    const copertura = Math.round((coperte / cella.length) * 1000) / 10;
    // tasti sotto i 44 px (fuori dai controlli di Google)
    const interattivi = tutti.filter(el => el.matches('button, a[href], [role="button"], input, select, textarea, [onclick]') && getComputedStyle(el).pointerEvents !== 'none');
    const piccoli = interattivi.map(el => ({ n: nome(el), r: rectOf(el) })).filter(o => Math.min(o.r.w, o.r.h) < 43.5).map(o => ({ nome: o.n, w: Math.round(o.r.w), h: Math.round(o.r.h) }));
    // testi tagliati
    const tagliati = [];
    for (const t of testi) {
        const el = t.el, cs = getComputedStyle(el), motivi = [];
        const ox = cs.overflowX, oy = cs.overflowY;
        if (el.scrollWidth > el.clientWidth + 1 && (ox === 'hidden' || ox === 'clip' || cs.textOverflow === 'ellipsis')) motivi.push('largo');
        if (el.scrollHeight > el.clientHeight + 1 && (oy === 'hidden' || oy === 'clip' || /-webkit-box|flex/.test(cs.display) && cs.webkitLineClamp !== 'none' && cs.webkitLineClamp)) motivi.push('alto');
        if (t.b.x < -1 || t.b.r > W + 1) motivi.push('fuori-schermo');
        if (t.b.y < -1 && getComputedStyle(el).position === 'fixed') motivi.push('sopra-lo-schermo');
        if (motivi.length) tagliati.push({ nome: nome(el), testo: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40), motivi: motivi.join('+') });
    }
    // sovrapposizioni fra blocchi: dipinti più esterni + interattivi non dentro un blocco
    const blocchi = [...esterni, ...interattivi.filter(nonDentro)];
    const sovr = [];
    for (let i = 0; i < blocchi.length; i++) for (let j = i + 1; j < blocchi.length; j++) {
        const a = blocchi[i], b = blocchi[j];
        if (a.contains(b) || b.contains(a)) continue;
        const A = rectOf(a), B = rectOf(b);
        const w = Math.min(A.r, B.r) - Math.max(A.x, B.x), h = Math.min(A.b, B.b) - Math.max(A.y, B.y);
        if (w > 4 && h > 4 && w * h >= 200) {
            // un pannello a tutta pagina sopra la mappa non si «sovrappone» a se stesso: salto i blocchi ≥ 90% dello schermo
            if ((A.w * A.h) / (W * H) > 0.9 || (B.w * B.h) / (W * H) > 0.9) continue;
            sovr.push({ a: nome(a), b: nome(b), px2: Math.round(w * h) });
        }
    }
    const testids = [...new Set([...document.querySelectorAll('[data-testid]')].filter(vis).map(e => e.getAttribute('data-testid')))];
    return { W, H, copertura, mappaLibera: Math.round((100 - copertura) * 10) / 10, piccoli, tagliati, sovr, testids, blocchi: esterni.map(e => ({ n: nome(e), ...Object.fromEntries(Object.entries(rectOf(e)).map(([k, v]) => [k, Math.round(v)])) })).slice(0, 14) };
};

/* ---------- da Node ---------- */
async function accedi(browser) {
    const statePath = path.join(TMP, 'sessione.json');
    if (!env.TEST_ACCOUNT_EMAIL || !env.TEST_ACCOUNT_PASSWORD) throw new Error('Mancano le credenziali di prova in .env.local');
    const ctx = await browser.newContext({ ...devices['iPhone 15'] });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai sulla pagina di accesso: niente credenziali.');
    await page.getByText('Accedi →').click();
    await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await page.getByText('Accedi Ora').click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await page.waitForTimeout(2500);
    await ctx.storageState({ path: statePath });
    await ctx.close();
    return statePath;
}
function giroDaFile(caso) {
    const g = JSON.parse(fs.readFileSync(GIRI_FILE, 'utf8'));
    const c = g.casi.find(x => x.id === caso);
    if (!c?.tours?.[0]) throw new Error(`giro ${caso} assente`);
    const titolo = c.tours[0].tema || `Il tuo giro a ${c.luogo}`;
    const stops = c.tours[0].stops.map(s => ({ title: s.title, latitude: s.lat, longitude: s.lng, description: s.description, types: s.types,
        place_id: s.place_id, moment: s.moment, type: s.tipoInterno || null, composta: !!s.description, ...(s.tempoLibero ? { tempoLibero: true, stayMinutes: s.stay } : { stayMinutes: s.stay }) }));
    const vere = stops.filter(s => !s.tempoLibero);
    const route = vere.map((s, i) => ({ latitude: s.latitude, longitude: s.longitude, label: s.title, title: s.title, name: s.title,
        description: s.description, category: s.type || 'Punto Mappa', image: null, index: i + 1, type: 'waypoint' }));
    const tourData = normalizeTour({ id: `ai-itinerary-navaudit-${c.luogo}`, title: titolo, type: 'ai-generated', isAiGenerated: true,
        city: c.luogo, tags: ['AI'], stops }, { cityFallback: c.luogo });
    return { luogo: c.luogo, titolo, route, tourData, vere: vere.map(s => ({ title: s.title, lat: s.latitude, lng: s.longitude })) };
}

const browser = await webkit.launch();
const esito = { tag: TAG, ora: ORA, base: BASE, device: 'iPhone 15', stati: {}, tocchi: [], voce: [], note: [], errori: [] };
let ctx;
try {
    { const c = await browser.newContext(); const p = await c.newPage(); await p.goto(BASE, { waitUntil: 'domcontentloaded' }); const t = await p.title(); await c.close(); if (!/DoveVai/i.test(t)) throw new Error(`La pagina su ${BASE} non e' DoveVai (titolo: ${t}): niente credenziali.`); }
    const statePath = await accedi(browser);
    const giro = giroDaFile('navsim-catania');
    const vere = giro.vere;
    const pj = JSON.parse(fs.readFileSync(PERCORSI_FILE, 'utf8'));
    const legs = pj['navsim-catania'] || pj.catania;
    const N = legs.length;
    esito.tappe = N;
    const dev = devices['iPhone 15'];
    ctx = await browser.newContext({ ...dev, storageState: statePath, locale: 'it-IT', timezoneId: 'Europe/Rome',
        recordVideo: { dir: path.join(TMP, 'video'), size: { width: dev.viewport.width, height: dev.viewport.height } } });
    await ctx.clock.install({ time: new Date(ORA) });
    await ctx.addInitScript(INIT);
    await ctx.addInitScript(() => { try { localStorage.setItem('dvai_voce_scelta_v1', 'marin'); } catch { /* niente */ } });
    const page = await ctx.newPage();
    const T0 = Date.now();
    const sec = () => Math.round((Date.now() - T0) / 100) / 10;
    const log = (m) => console.error(`[audit ${TAG}] ${sec()}s ${m}`);
    page.on('pageerror', e => esito.errori.push(`${sec()}s ${String(e?.message || e).slice(0, 200)}`));
    let statoCorrente = 'inizio';
    let nVoce = 0;
    const leggiVoce = async () => {
        const reg = await page.evaluate(() => (window.__voceRegistro || []).map(r => ({ testo: r.testo, voce: r.voce, sorgente: r.sorgente, server: r.server }))).catch(() => []);
        const ev = await page.evaluate(() => window.__audioEv.slice()).catch(() => []);
        for (const r of reg.slice(nVoce)) esito.voce.push({ t: sec(), stato: statoCorrente, ...r });
        nVoce = reg.length;
        esito.audioEventi = ev.length;
        esito.audioEv = ev;
    };
    const misura = async (nome, extra = {}) => {
        statoCorrente = nome;
        const m = await page.evaluate(MISURA).catch(e => ({ errore: String(e).slice(0, 120) }));
        const file = `${TAG}-${String(Object.keys(esito.stati).length + 1).padStart(2, '0')}-${nome.replace(/[^a-z0-9]+/gi, '-')}.png`;
        await page.screenshot({ path: path.join(SHOTS, file) }).catch(() => {});
        (esito.stati[nome] ||= []).push({ t: sec(), file, ...extra, ...m });
        await leggiVoce();
        log(`stato ${nome}: mappa coperta ${m.copertura}% · tasti<44: ${m.piccoli?.length} · tagliati: ${m.tagliati?.length} · sovrapp.: ${m.sovr?.length}`);
        return m;
    };
    /** Un tocco con la latenza misurata dentro la pagina. `atteso` = selettore CSS dello stato che deve comparire. */
    const tocca = async (nome, loc, atteso = null) => {
        await page.evaluate((sel) => { window.__lat = { t0: null, ui: null, audio: null, pronto: null, sel, armata: true }; window.__audioEv.length = 0; }, atteso);
        const t = sec();
        await loc.click({ timeout: 8000 });
        await page.waitForTimeout(atteso ? 2500 : 1500);
        const L = await page.evaluate(() => window.__lat);
        const r = { tocco: nome, t, rispostaDomMs: L.t0 != null && L.ui != null ? Math.round(L.ui - L.t0) : null,
            statoAttesoMs: L.t0 != null && L.pronto != null ? Math.round(L.pronto - L.t0) : null,
            suonoMs: L.t0 != null && L.audio != null ? Math.round(L.audio - L.t0) : null, atteso };
        esito.tocchi.push(r);
        log(`tocco «${nome}»: DOM ${r.rispostaDomMs} ms · stato ${r.statoAttesoMs} ms · suono ${r.suonoMs} ms`);
        return r;
    };
    const emit = (p, acc = 8) => page.evaluate(([la, ln, a]) => window.__gps.emit(la, ln, a), [p.lat, p.lng, acc]).catch(() => {});
    const esiste = (id) => page.getByTestId(id).first().isVisible().catch(() => false);
    const presente = async (id) => (await page.getByTestId(id).count().catch(() => 0)) > 0;

    // ---- PANORAMICA ----
    const partenza = sposta(vere[0], -250 * 0.6, -250 * 0.8);
    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((g) => { window.history.replaceState({ usr: { route: g.route, tourData: g.tourData }, key: 'navaudit', idx: 0 }, '', '/map'); }, giro);
    await page.evaluate(([a, b]) => { window.__gps.pos = { lat: a, lng: b, acc: 8 }; }, [partenza.lat, partenza.lng]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(([a, b]) => { window.__gps.pos = { lat: a, lng: b, acc: 8 }; }, [partenza.lat, partenza.lng]);
    await page.waitForTimeout(4000);
    await misura('1 panoramica (appena aperta)');
    await page.waitForTimeout(9000);
    await misura('1 panoramica (percorso calcolato)');

    // ---- AVVIO E VOLO ----
    await tocca('Avvia', page.getByText('Avvia', { exact: true }).first(), '[data-testid="nav-hud-barra"]');
    await misura('2 avvio e volo (+2,5 s)');
    if (!(await presente('nav-hud'))) { await tocca('Avvia Navigazione', page.getByText('Avvia Navigazione'), '[data-testid="nav-hud-barra"]'); }
    await page.waitForTimeout(1500);
    await misura('2 avvio e volo (+4 s)');
    await emit(partenza);
    await page.waitForTimeout(2500);

    // ---- FRECCIA DI PARTENZA ----
    if (await esiste('freccia-partenza')) await misura('3 freccia di partenza');
    else { esito.note.push('freccia-partenza non visibile a 250 m dalla 1ª tappa'); await misura('3 freccia di partenza (assente)'); }

    // ---- CAMMINO + SVOLTE (1ª tratta a passo d'uomo vero) ----
    const tratta0 = campiona(legs[0].punti, 1.4);
    // la prima svolta: primo vertice della traccia a ~12 m con cambio di rotta > 40°
    const rada = campiona(legs[0].punti, 12);
    let iSvolta = -1;
    for (let i = 2; i < rada.length - 2; i++) { let d = Math.abs(rotta(rada[i - 1], rada[i]) - rotta(rada[i], rada[i + 1])); if (d > 180) d = 360 - d; if (d > 40 && i > 6) { iSvolta = i; break; } }
    esito.note.push(iSvolta < 0 ? 'nessuna svolta > 40° trovata nella 1ª tratta' : `1ª svolta alla traccia ${iSvolta * 12} m (rotta ${Math.round(rotta(rada[iSvolta - 1], rada[iSvolta]))}° → ${Math.round(rotta(rada[iSvolta], rada[iSvolta + 1]))}°)`);
    const posSvolta = iSvolta > 0 ? rada[iSvolta] : null;
    const soglie = [100, 50, 0];
    const fatte = new Set();
    let primoCammino = false, avvicinamento = false, ritoGiaMisurato = false;
    for (let i = 0; i < tratta0.length && !FINE_ONLY; i++) {
        const p = tratta0[i];
        await emit(p);
        await page.waitForTimeout(1000);
        if (!primoCammino && i === 12) { primoCammino = true; await misura('4 cammino', { pillola: await page.getByTestId('nav-pillola').innerText().catch(() => null), filo: await page.getByTestId('filo-frase').innerText().catch(() => null) }); }
        if (posSvolta) {
            const dSv = dist(p, posSvolta);
            for (const s of soglie) if (!fatte.has(s) && dSv <= s && (i > 12)) {
                fatte.add(s);
                await misura(`5 svolta a ${s} m`, { distanzaReale: Math.round(dSv), pillola: await page.getByTestId('nav-pillola').innerText().catch(() => null), filo: await page.getByTestId('filo-frase').innerText().catch(() => null) });
            }
        }
        const dStop = dist(p, vere[0]);
        if (!avvicinamento && dStop <= 40) { avvicinamento = true; await misura('6 avvicinamento (≤ 40 m)', { distanzaReale: Math.round(dStop), pillola: await page.getByTestId('nav-pillola').innerText().catch(() => null) }); }
        if (await esiste('rito-arrivo')) { await misura("7 rito d'arrivo", { tappa: 1, daAvvicinamento: true }); ritoGiaMisurato = true; break; }
        if (i > 400) break;
    }
    log('1ª tratta fatta');

    // ---- ARRIVO / SCHEDA / RACCONTO / RIPARTI (per ogni tappa) ----
    const arrivi = [];
    const arrivo = async (k, dettaglio) => {
        const stop = vere[k];
        for (let i = 0; i < 4; i++) { await emit(stop); await page.waitForTimeout(500); }
        const rito = ritoGiaMisurato || await page.getByTestId('rito-arrivo').waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
        if (rito && !ritoGiaMisurato) await misura('7 rito d\'arrivo', { tappa: k + 1 });
        ritoGiaMisurato = false;
        const sc = await page.getByTestId('arrivo').waitFor({ timeout: 9000 }).then(() => true).catch(() => false);
        let daSolo = sc;
        if (!sc) { const b = page.getByText('Sono arrivato', { exact: true }).first(); if (await b.count()) { await b.click().catch(() => {}); await page.getByTestId('arrivo').waitFor({ timeout: 6000 }).catch(() => {}); } }
        await page.waitForTimeout(900);
        await misura('8 scheda tappa (arrivo)', { tappa: k + 1, daSolo });
        if (dettaglio) {
            const play = page.getByRole('button', { name: /Ascolta il racconto/ }).first();
            if (await play.count()) {
                await tocca(`Play racconto (arrivo, tappa ${k + 1})`, play, '[data-testid="lettore"] button[aria-label^="Metti in pausa"]');
                await page.waitForTimeout(1500);
                await misura('9 racconto in lettura', { tappa: k + 1 });
                await page.waitForTimeout(2500);
                await leggiVoce();
                const pausa = page.getByRole('button', { name: /Metti in pausa il racconto/ }).first();
                if (await pausa.count()) await tocca('Pausa racconto', pausa, '[data-testid="lettore"] button[aria-label^="Ascolta"]');
            } else esito.note.push(`tappa ${k + 1}: nessun tasto «Ascolta il racconto» nella scheda d'arrivo`);
            const apri = page.getByText('La scheda', { exact: true }).first();
            if (await apri.count()) {
                await tocca(`La scheda (tappa ${k + 1})`, apri, '[data-testid="scheda-tappa"]');
                await page.waitForTimeout(700);
                await misura('10 scheda completa della tappa', { tappa: k + 1 });
                const p2 = page.getByRole('button', { name: /Ascolta il racconto/ }).first();
                if (await p2.count()) { await tocca(`Play racconto (scheda, tappa ${k + 1})`, p2, '[data-testid="lettore"] button[aria-label^="Metti in pausa"]'); await page.waitForTimeout(2500); await leggiVoce(); const pz = page.getByRole('button', { name: /Metti in pausa il racconto/ }).first(); if (await pz.count()) await pz.click().catch(() => {}); }
            } else esito.note.push(`tappa ${k + 1}: nessun tasto «La scheda»`);
        }
        const ultimo = k === N - 1;
        const riparti = page.getByText(ultimo ? /^(Riparti|Avanti|Concludi|Fine|Termina)/ : /^Riparti/).first();
        if (await riparti.count()) {
            await tocca(`Riparti (tappa ${k + 1})`, riparti, ultimo ? '[data-testid="fine-giro"]' : '[data-testid="nav-hud-barra"]');
            await page.waitForTimeout(500);
            if (!ultimo) await misura('11 riparti (+1 s)', { tappa: k + 1 });
        } else esito.note.push(`tappa ${k + 1}: nessun tasto Riparti`);
        arrivi.push({ tappa: stop.title, rito, daSolo });
    };
    if (FINE_ONLY) {
        for (let k = 0; k < N - 1; k++) { await page.getByText('Salta', { exact: true }).first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400); }
        await arrivo(N - 1, true);
    } else await arrivo(0, true);

    // ---- LE ALTRE TAPPE (~8x), dettaglio completo alla 4ª e all'ultima ----
    for (let k = 1; k < N && !FINE_ONLY; k++) {
        const tratta = campiona(legs[k].punti, 11);
        for (let i = 0; i < tratta.length; i++) {
            await emit(tratta[i]);
            await page.waitForTimeout(1000);
            if (i === Math.floor(tratta.length / 2) && (k === 1 || k === 6)) await misura('4 cammino', { tratta: k + 1 });
            if (await esiste('rito-arrivo')) { await misura("7 rito d'arrivo", { tappa: k + 1, daAvvicinamento: true }); ritoGiaMisurato = true; break; }
        }
        log(`tappa ${k + 1}/${N} raggiunta`);
        await arrivo(k, k === 3 || k === N - 1);
    }
    await page.waitForTimeout(3000);
    await misura('12 fine giro', { titolo: await page.getByTestId('fine-titolo').innerText().catch(() => null) });
    await leggiVoce();
    esito.arrivi = arrivi;
    esito.durataS = sec();
    await ctx.close();
    const vids = fs.readdirSync(path.join(TMP, 'video')).filter(f => f.endsWith('.webm'));
    if (vids[0]) { fs.copyFileSync(path.join(TMP, 'video', vids[0]), path.join(VIDEO_DIR, `nav-audit-${TAG}.webm`)); esito.video = `docs/prove/video/nav-audit-${TAG}.webm`; }
    ctx = null;
} catch (e) {
    esito.errori.push(`FATALE: ${String(e?.message || e).slice(0, 300)}`);
    console.error(e);
    try {
        if (ctx) { await ctx.close(); const d = path.join(TMP, 'video'); const vids = fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.webm')) : []; if (vids[0]) { fs.copyFileSync(path.join(d, vids[0]), path.join(VIDEO_DIR, `nav-audit-${TAG}.webm`)); esito.video = `docs/prove/video/nav-audit-${TAG}.webm`; } }
    } catch { /* niente */ }
} finally {
    await browser.close();
    fs.writeFileSync(OUT, JSON.stringify(esito, null, 1));
    fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(JSON.stringify({ tag: TAG, durataS: esito.durataS, stati: Object.keys(esito.stati).length, tocchi: esito.tocchi.length, voce: esito.voce.length, errori: esito.errori }));
