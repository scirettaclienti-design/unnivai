/**
 * NAV-SIM — una camminata simulata su un giro VERO (Troina, Catania), registrata in video nel motore di Safari
 * (WebKit di Playwright, profilo iPhone 13). Nessuna modifica all'app: solo la posizione e gli eventi sono finti.
 *
 *   NAV_BASE=http://localhost:<porta> node scripts/prova-nav/navsim.webkit.mjs [troina,catania]
 *
 * - I giri: il grezzo del banco esteso `docs/prove/dati/2026-10-16-nav-sim-giri.json` (casi in casi-nav-sim.js), passati alla
 *   mappa come li passa «Vedi su Mappa» di Crea (AiItinerary.jsx): `route` + `tourData` normalizzato con il normalizeTour vero.
 * - Il percorso a piedi: Google Directions WALKING fra le tappe, calcolato DENTRO la pagina con la libreria della mappa
 *   (la stessa chiave dell'app), salvato una volta in `docs/prove/dati/2026-10-16-nav-sim-percorsi.json`.
 * - La camminata: una posizione al secondo, 15 m più avanti (4,5 km/h × 12); in salita 10 m (3 km/h × 12). Rumore 5–25 m
 *   (PRNG con seme: ogni giro è ripetibile), accuratezza dichiarata coerente col rumore.
 * - Gli eventi scorrono AL VERO (l'app misura il tempo vero): 2 minuti senza segnale, 30 s senza rete, 2 minuti di pagina
 *   nascosta (come lo schermo bloccato: nessuna posizione, poi `visibilitychange`), posizione negata e poi concessa
 *   (ritorno in primo piano), ricarica a metà giro, una sosta lunga (90 s), una tappa superata a 60 m senza fermarsi.
 *   Durante i 2 minuti senza segnale e i 2 minuti nascosti il camminatore va avanti di 150 m (2 minuti a 4,5 km/h).
 * - Le misure: il geofence scrive ogni posizione in console (`[DVAI-Geofence]`: distanza, soglia, scattato): la distanza a cui
 *   scatta l'arrivo viene da lì; la distanza VERA (senza rumore) dalla traccia. La barra si legge ogni mezzo secondo.
 * - Il video va FUORI dal repository (NAV_VIDEO, default ~/DoveVai-prove-video/nav-sim); schermate e cronologia nel repository.
 * Prima delle credenziali: titolo «DoveVai» verificato (CLAUDE.md). Credenziali da .env.local, mai stampate.
 *
 * NAV-1-FIX: stessi giri, stessi percorsi, stesso seme. Le uscite si scelgono (NAV_SCHERMATE, NAV_ESITI) così una nuova
 * camminata non sovrascrive quella di NAV-SIM. Misure in più: «Roma» a schermo dalla ricarica a «Riprendi» (D3) e la mappa
 * montata o ferma su «Preparo la mappa»; ogni domanda «Sei passato da…?» con la distanza vera e se il camminatore ha
 * già passato la tappa sul percorso. Domanda SBAGLIATA = la tappa non è ancora passata E il camminatore è a più di
 * DOMANDA_SBAGLIATA_M veri (100 m = VICINO_M 80 di NAV-1 + 20): sotto, è la domanda «di passaggio» di NAV-1, che scatta
 * mentre costeggi la tappa (Torre Capitania, Palazzo dei Chierici). Il link «Apri in Mappe» a ogni tappa.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.NAV_BASE || 'http://localhost:5181';
const GIRI_FILE = 'docs/prove/dati/2026-10-16-nav-sim-giri.json';
const PERCORSI_FILE = 'docs/prove/dati/2026-10-16-nav-sim-percorsi.json';
const VIDEO = process.env.NAV_VIDEO || path.join(os.homedir(), 'DoveVai-prove-video', 'nav-sim');
const OUT = path.resolve(process.env.NAV_SCHERMATE || 'docs/prove/schermate/nav-sim');
const ESITI = process.env.NAV_ESITI || 'docs/prove/dati/2026-10-16-nav-sim-esiti.json';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'navsim-'));
const SOLO = (process.argv[2] || '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(VIDEO, { recursive: true });
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));

// ─── i piani: dove cade ogni evento (indici delle tappe vere, da 1) ─────────────────────────────────────────────────────
const PIANI = {
    troina: {
        caso: 'navsim-troina', seme: 11,
        sostaLunga: 3,          // A'Pescheria (il pranzo): 90 s fermi col rumore
        superata: 2,            // Torre Capitania: si passa a 60 m senza fermarsi
        salita: 5,              // la salita verso Monte Muganà: 3 km/h
        senzaSegnale: 5,        // nella salita verso Monte Muganà: 2 minuti senza segnale
        ricarica: 4,            // ricarica subito dopo Piazza Conte Ruggero (metà giro)
        offline: 6,             // 30 s senza rete andando verso lo Snack Bar
        nascosta: 7,            // 2 minuti nascosta a cavallo di Via Conte Ruggero (60 m prima, 90 m dopo)
    },
    catania: {
        caso: 'navsim-catania', seme: 23,
        sostaLunga: 2,          // la Cattedrale, a 56 m dalla Fontana dell'Elefante: falsi arrivi?
        superata: 8,            // Palazzo dei Chierici: si passa a 60 m senza fermarsi
        salita: null,
        senzaSegnale: 7,        // i vicoli verso il Castello Ursino
        ricarica: 7,            // ricarica subito dopo il Castello Ursino
        offline: 10,            // 30 s senza rete verso il Bar Popolare
        nascosta: 11,           // 2 minuti nascosta a cavallo della Fontana dell'Amenano
    },
};
const PASSO_M = 15, PASSO_SALITA_M = 10, AVANZA_EVENTO_M = 150, SOSTA_LUNGA_S = 90, SILENZIO_S = 120, NASCOSTA_S = 120, OFFLINE_S = 30;
const OFFSET_SUPERATA_M = 60, PRIMA_NASCOSTA_M = 60, PARTENZA_M = 250, DOMANDA_SBAGLIATA_M = 100;

// ─── geometria ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const R = 6371000, rad = (x) => (x * Math.PI) / 180;
const dist = (a, b) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2));
const sposta = (p, est, nord) => ({ lat: p.lat + nord / 111320, lng: p.lng + est / (111320 * Math.cos(rad(p.lat))) });
const verso = (a, b) => { const d = dist(a, b) || 1; return { est: ((b.lng - a.lng) * 111320 * Math.cos(rad(a.lat))) / d, nord: ((b.lat - a.lat) * 111320) / d }; };
/** La polilinea a passi regolari di `passo` metri. */
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
/** PRNG con seme (mulberry32): il rumore è ripetibile. */
const prng = (seme) => () => { seme |= 0; seme = (seme + 0x6D2B79F5) | 0; let t = Math.imul(seme ^ (seme >>> 15), 1 | seme); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ─── il GPS finto (stessa interfaccia di navigator.geolocation) e lo schermo nascosto ─────────────────────────────────
const GPS_FINTO = () => {
    const g = { watchers: new Map(), id: 0, pos: null, deny: false, chiamate: 0 };
    const mk = (p) => ({ coords: { latitude: p.lat, longitude: p.lng, accuracy: p.acc ?? 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
    const geo = {
        getCurrentPosition(ok, ko) {
            if (g.deny) setTimeout(() => ko?.({ code: 1, message: 'User denied Geolocation' }), 20);
            else if (g.pos) setTimeout(() => ok(mk(g.pos)), 20);
        },
        watchPosition(ok, ko, o) {
            const id = ++g.id;
            g.chiamate += 1;
            g.watchers.set(id, { ok, ko, o });
            if (g.deny) setTimeout(() => ko?.({ code: 1, message: 'User denied Geolocation' }), 20);
            return id;
        },
        clearWatch(id) { g.watchers.delete(id); },
    };
    g.emit = (lat, lng, acc) => { g.pos = { lat, lng, acc }; for (const w of [...g.watchers.values()]) w.ok(mk(g.pos)); };
    g.navWatch = () => [...g.watchers.values()].filter(w => w.o?.enableHighAccuracy).length;
    window.__gps = g;
    Object.defineProperty(Navigator.prototype, 'geolocation', { get: () => geo, configurable: true });
    // lo schermo bloccato: visibilityState «hidden», poi di nuovo «visible», con l'evento come su Safari
    window.__vis = 'visible';
    Object.defineProperty(Document.prototype, 'visibilityState', { get: () => window.__vis, configurable: true });
    Object.defineProperty(Document.prototype, 'hidden', { get: () => window.__vis === 'hidden', configurable: true });
    window.__setVis = (v) => { window.__vis = v; document.dispatchEvent(new Event('visibilitychange')); };
};

// ─── lo stato della pagina, letto ogni mezzo secondo ──────────────────────────────────────────────────────────────────
const AVVISI = {
    attesa: 'Cerco il segnale', perso: 'Ho perso il segnale', negato: 'Senza posizione non posso guidarti',
    offline: 'Sei offline', percorso: 'Non riesco a calcolare il percorso',
};
const leggiStato = (page) => page.evaluate((avvisi) => {
    const testo = document.body?.innerText || '';
    const tappa = testo.match(/Tappa (\d+) di (\d+)/i);   // la barra la scrive in maiuscolo (CSS)
    const domanda = testo.match(/Sei passato da ([^?]+)\?/);
    const ripresa = testo.match(/Hai un giro in corso: tappa (\d+) di (\d+)\. Riprendi\?/);
    let giro = null;
    try { giro = JSON.parse(localStorage.getItem('dvai_nav_giro_v1') || 'null'); } catch { /* niente */ }
    return {
        tappa: tappa ? `${tappa[1]}/${tappa[2]}` : null,
        completato: /(Tour|Giro) completato/i.test(testo),
        // la mappa ha le sue tessere? (dopo la ricarica era nera)
        tessere: document.querySelectorAll('.gm-style img').length,
        avvisi: Object.entries(avvisi).filter(([, t]) => testo.includes(t)).map(([k]) => k),
        domanda: domanda ? domanda[1].trim() : null,
        ripresa: ripresa ? `${ripresa[1]}/${ripresa[2]}` : null,
        fatte: Array.isArray(giro?.completedSteps) ? giro.completedSteps.length : null,
        saltate: Array.isArray(giro?.skippedSteps) ? giro.skippedSteps.length : null,
        watch: window.__gps?.navWatch?.() ?? null,
        vis: window.__vis,
        // NAV-1-FIX: «Roma» a schermo (senza la curiosità sui nasoni di Roma, un avviso del giro), la mappa in attesa
        roma: /\bRoma\b/.test(testo.replace(/Roma ha più di duemila fontanelle[^\n]*/g, '')),
        preparo: testo.includes('Preparo la mappa'),
        mappeHref: document.querySelector('[data-testid="nav-apri-mappe"]')?.getAttribute('href') ?? null,
    };
}, AVVISI).catch(() => null);

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
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await page.waitForTimeout(2500);
    await ctx.storageState({ path: statePath });
    await ctx.close();
    return statePath;
}

/** Le tappe vere del giro (senza il tempo libero), dal grezzo del banco. */
function tappeDelGiro(caso) {
    const g = JSON.parse(fs.readFileSync(GIRI_FILE, 'utf8'));
    const c = g.casi.find(x => x.id === caso);
    if (!c?.tours?.[0]) throw new Error(`giro ${caso} assente in ${GIRI_FILE}`);
    return { luogo: c.luogo, titolo: c.tours[0].tema || `Il tuo giro a ${c.luogo}`,
        stops: c.tours[0].stops.map(s => ({ title: s.title, latitude: s.lat, longitude: s.lng, description: s.description, types: s.types,
            place_id: s.place_id, moment: s.moment, type: s.tipoInterno || null, ...(s.tempoLibero ? { tempoLibero: true, stayMinutes: s.stay } : { stayMinutes: s.stay }) })) };
}

/** Mette il giro nella mappa come «Vedi su Mappa» di Crea: route + tourData (normalizeTour vero, importato dal vite dell'app). */
async function caricaGiro(page, giro) {
    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async (g) => {
        const { normalizeTour } = await import('/src/services/tourShape.js');
        const vere = g.stops.filter(s => !s.tempoLibero);
        const route = vere.map((s, i) => ({ latitude: s.latitude, longitude: s.longitude, label: s.title, title: s.title, name: s.title,
            description: s.description, category: s.type || 'Punto Mappa', image: null, index: i + 1, type: 'waypoint' }));
        const tourData = normalizeTour({ id: `ai-itinerary-navsim-${g.luogo}`, title: g.titolo, type: 'ai-generated', isAiGenerated: true,
            city: g.luogo, tags: ['AI'], stops: g.stops }, { cityFallback: g.luogo });
        window.history.replaceState({ usr: { route, tourData }, key: 'navsim', idx: 0 }, '', '/map');
    }, giro);
    await page.reload({ waitUntil: 'domcontentloaded' });
}

/** I percorsi a piedi fra le tappe (Google Directions WALKING, nella pagina), salvati una volta. */
async function percorsi(page, chiave, punti) {
    const cache = fs.existsSync(PERCORSI_FILE) ? JSON.parse(fs.readFileSync(PERCORSI_FILE, 'utf8')) : {};
    if (cache[chiave]?.length === punti.length - 1) return cache[chiave];
    await page.waitForFunction(() => !!window.google?.maps?.importLibrary, null, { timeout: 60000 });
    const legs = await page.evaluate(async (pts) => {
        const { DirectionsService } = await google.maps.importLibrary('routes');
        const svc = new DirectionsService();
        const out = [];
        for (let i = 1; i < pts.length; i++) {
            const r = await svc.route({ origin: pts[i - 1], destination: pts[i], travelMode: 'WALKING' });
            const leg = r.routes[0].legs[0];
            out.push({ metri: leg.distance.value, secondi: leg.duration.value,
                punti: r.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() })) });
        }
        return out;
    }, punti);
    cache[chiave] = legs;
    fs.writeFileSync(PERCORSI_FILE, JSON.stringify(cache, null, 1));
    return legs;
}

// ─── un giro ───────────────────────────────────────────────────────────────────────────────────────────────────────────
async function camminata(browser, statePath, nome) {
    const piano = PIANI[nome];
    const giro = tappeDelGiro(piano.caso);
    const vere = giro.stops.filter(s => !s.tempoLibero).map(s => ({ ...s, lat: s.latitude, lng: s.longitude }));
    const N = vere.length;
    const dirVideo = path.join(VIDEO, nome);
    fs.mkdirSync(dirVideo, { recursive: true });
    const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: statePath, locale: 'it-IT', timezoneId: 'Europe/Rome',
        recordVideo: { dir: dirVideo, size: { width: 390, height: 844 } } });
    await ctx.addInitScript(GPS_FINTO);
    const page = await ctx.newPage();
    const t0 = Date.now();
    const ora = () => { const s = Math.round((Date.now() - t0) / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
    const cronologia = [];
    const evento = (tipo, dettaglio = {}) => { const e = { t: ora(), s: Math.round((Date.now() - t0) / 1000), tipo, ...dettaglio }; cronologia.push(e); console.error(`[navsim ${nome}] ${e.t} ${tipo} ${JSON.stringify(dettaglio)}`); return e; };
    const errori = [];
    page.on('pageerror', e => errori.push({ t: ora(), errore: String(e?.message || e).slice(0, 200) }));
    // il geofence scrive ogni posizione in console: ogni sblocco con la sua distanza
    let veroOra = null;            // il punto vero (senza rumore) dell'ultima posizione emessa, e a quale tappa si va
    const scatti = [];
    let ultimoTick = null;
    page.on('console', async (msg) => {
        // l'avviso «Non riesco a calcolare il percorso» nasce da qui (useTourRouting): lo stato di Google, per la diagnosi
        if (msg.text().startsWith('Directions failed')) { evento('directions-errore', { stato: msg.text().replace('Directions failed:', '').trim(), verso: veroOra?.verso ?? null }); return; }
        if (!msg.text().startsWith('[DVAI-Geofence]')) return;
        try {
            const v = await msg.args()[1]?.jsonValue();
            if (!v) return;
            ultimoTick = { ...v, t: ora() };
            if (v.scattato) {
                const tappa = vere.find(s => s.title === v.prossimaTappa);
                const reale = tappa && veroOra ? Math.round(dist(veroOra.p, tappa)) : null;
                scatti.push({ t: ora(), tappa: v.prossimaTappa, distanzaM: v.distanzaM, accuracy: v.accuracy, soglia: v.soglia, distanzaVeraM: reale, versoTappa: veroOra?.verso ?? null });
                evento('arrivo-da-solo', { tappa: v.prossimaTappa, distanzaM: v.distanzaM, soglia: v.soglia, distanzaVeraM: reale });
            }
        } catch { /* console mentre la pagina cambia */ }
    });
    const rnd = prng(piano.seme);
    const rumore = (p) => {
        const r = 5 + rnd() * 20, a = rnd() * 2 * Math.PI;
        const q = sposta(p, r * Math.cos(a), r * Math.sin(a));
        return { ...q, acc: Math.round(Math.max(5, r + (rnd() - 0.5) * 6)) };
    };
    const lente = [];
    // oltre = il camminatore ha già passato, sul percorso, il punto più vicino alla tappa verso cui va (D1)
    const emetti = async (p, versoTappa, oltre = false) => {
        veroOra = { p, verso: versoTappa, oltre };
        const q = rumore(p);
        const t = Date.now();
        await page.evaluate(([a, b, c]) => window.__gps?.emit(a, b, c), [q.lat, q.lng, q.acc]).catch(() => {});
        const ms = Date.now() - t;
        if (ms > 2000) { lente.push({ t: ora(), cosa: 'emit', ms }); console.error(`[navsim ${nome}] ${ora()} LENTA emit ${ms} ms`); }
    };
    const shot = async (nomeShot) => {
        const f = path.join(OUT, nome, `${nomeShot}.png`);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        await page.screenshot({ path: f }).catch(() => {});
        return path.relative(process.cwd(), f);
    };
    const schermate = {};
    // la barra letta ogni mezzo secondo: ogni cambio è un evento della cronologia
    let ultimo = {};
    let osserva = true;
    const verita = [];
    const mappe = [];
    const finestraRicarica = { attiva: false, letture: 0, roma: 0, preparo: 0 };
    const osservatore = (async () => {
        while (osserva) {
            const tL = Date.now();
            const s = await leggiStato(page);
            if (Date.now() - tL > 2000) console.error(`[navsim ${nome}] ${ora()} LENTA lettura ${Date.now() - tL} ms`);
            if (s) {
                if (s.tappa !== ultimo.tappa && s.tappa) evento('barra', { tappa: s.tappa, fatte: s.fatte, saltate: s.saltate });
                for (const a of s.avvisi) if (!(ultimo.avvisi || []).includes(a)) evento('avviso-mostrato', { avviso: a });
                for (const a of ultimo.avvisi || []) if (!s.avvisi.includes(a)) evento('avviso-tolto', { avviso: a });
                if (s.domanda && s.domanda !== ultimo.domanda) {
                    const a = vere.findIndex(x => x.title === s.domanda) + 1;
                    const veroM = a > 0 && veroOra ? Math.round(dist(veroOra.p, vere[a - 1])) : null;
                    const nonPassata = !!veroOra && veroOra.verso === a && !veroOra.oltre;
                    const sbagliata = nonPassata && veroM != null && veroM > DOMANDA_SBAGLIATA_M;
                    verita.push({ t: ora(), tappa: s.domanda, veroM, nonPassata, sbagliata });
                    evento('domanda', { tappa: s.domanda, veroM, nonPassata, sbagliata });
                }
                if (finestraRicarica.attiva) { finestraRicarica.letture += 1; if (s.roma) finestraRicarica.roma += 1; if (s.preparo) finestraRicarica.preparo += 1; }
                if (s.tappa && s.tappa !== ultimo.tappa) {
                    const n = Number(s.tappa.split('/')[0]);
                    const st = vere[n - 1];
                    const m = String(s.mappeHref || '').match(/(?:daddr|destination)=(-?[\d.]+),(-?[\d.]+)/);
                    mappe.push({ tappa: st?.title ?? null, href: s.mappeHref, giusto: !!(m && st && Math.abs(Number(m[1]) - st.lat) < 1e-6 && Math.abs(Number(m[2]) - st.lng) < 1e-6),
                        soloTappa: !!s.mappeHref && !/saddr|origin=/.test(s.mappeHref) });
                }
                if (s.ripresa && s.ripresa !== ultimo.ripresa) evento('proposta-ripresa', { tappa: s.ripresa });
                if (s.completato && !ultimo.completato) evento('tour-completato', {});
                ultimo = s;
            }
            await page.waitForTimeout(500).catch(() => {});
        }
    })();
    const attendi = async (cond, ms) => { const fine = Date.now() + ms; while (Date.now() < fine) { if (cond(ultimo)) return true; await page.waitForTimeout(250); } return false; };
    const rispondiDomanda = async (motivo) => {
        if (!ultimo.domanda) return false;
        const tappa = ultimo.domanda;
        schermate[`domanda-${tappa}`] = await shot(`domanda-${vere.findIndex(s => s.title === tappa) + 1}`);
        await page.getByText('Vista', { exact: true }).click({ timeout: 5000 }).catch(() => {});
        evento('risposta-vista', { tappa, motivo });
        await attendi(s => !s.domanda, 4000);
        return true;
    };
    // a giro concluso il salvataggio si cancella: tutte fatte
    const fatteOra = () => (ultimo.completato ? N : (ultimo.fatte ?? Number(String(ultimo.tappa || '1/').split('/')[0]) - 1));

    // ── avvio: tour caricato, percorsi a piedi, posizione NEGATA, poi concessa ──
    await caricaGiro(page, giro);
    const partenza = sposta(vere[0], -PARTENZA_M * 0.6, -PARTENZA_M * 0.8);
    const legs = await percorsi(page, nome, [partenza, ...vere].map(p => ({ lat: p.lat, lng: p.lng })));
    evento('percorsi', { gambe: legs.length, metri: legs.reduce((a, l) => a + l.metri, 0) });
    await page.evaluate(() => { window.__gps.deny = true; });
    await page.getByText('Avvia', { exact: true }).click({ timeout: 30000 });
    await page.getByText('Avvia Navigazione').click({ timeout: 15000 });
    evento('avvia', { tappe: N });
    const negatoVisto = await attendi(s => s.avvisi?.includes('negato'), 10000);
    schermate.negata = await shot('01-posizione-negata');
    await page.waitForTimeout(4000);
    // l'utente attiva la posizione in Impostazioni e torna su Safari (ritorno in primo piano)
    await page.evaluate(() => { window.__gps.deny = false; window.__setVis('hidden'); });
    await page.waitForTimeout(800);
    const tConcessa = Date.now();
    await page.evaluate(() => window.__setVis('visible'));
    evento('posizione-concessa', {});
    const watchDopo = await attendi(s => (s.watch || 0) > 0, 8000);
    await emetti(partenza, 1);
    const negatoVia = await attendi(s => !s.avvisi?.includes('negato'), 8000);
    const riagganciNegato = Math.round((Date.now() - tConcessa) / 100) / 10;
    evento('dopo-concessa', { watchAttivo: watchDopo, avvisoTolto: negatoVia, secondi: riagganciNegato });
    schermate.concessa = await shot('02-posizione-concessa');

    const misure = { riaggancio: [], ripresa: null, nascosta: null, offline: null, negata: { avvisoVisto: negatoVisto, watchRipartito: watchDopo, avvisoTolto: negatoVia, secondi: riagganciNegato }, tasto: [], domande: [] };
    // ── le gambe ──
    let ripartiDa = null;   // dopo una tappa superata o una pausa il camminatore è già oltre la tappa: la gamba dopo riparte da lì
    for (let k = 1; k <= N; k++) {
        const tappa = vere[k - 1];
        const leg = legs[k - 1];
        const passo = piano.salita === k ? PASSO_SALITA_M : PASSO_M;
        let punti = campiona(leg.punti, passo);
        // il percorso arriva sulla tappa vera (Directions si ferma sulla strada più vicina): l'ultimo pezzo a piedi fin lì
        punti = [...punti, ...campiona([punti[punti.length - 1], { lat: tappa.lat, lng: tappa.lng }], passo).slice(1)];
        if (ripartiDa) {
            // si salta l'inizio della gamba (attorno alla tappa prima) e si raccorda dalla posizione vera del camminatore
            const via = punti.findIndex(p => dist(p, vere[k - 2]) > ripartiDa.oltreM);
            const resto = via >= 0 ? punti.slice(via) : punti.slice(-1);
            punti = [...campiona([ripartiDa.p, resto[0]], passo), ...resto.slice(1)];
            ripartiDa = null;
        }
        // tappa superata: ci si avvicina fino a 110 m, si gira attorno alla tappa a 60 m di lato, si prosegue verso la tappa dopo.
        // Il percorso costruito non entra mai nei 50 m (controllato: `minimoM`).
        if (piano.superata === k && vere[k]) {
            const dopo = vere[k];
            const v = verso(tappa, dopo);
            const lato = { est: -v.nord, nord: v.est };
            const at = (av, la) => sposta(tappa, v.est * av + lato.est * la, v.nord * av + lato.nord * la);
            const primo = punti.findIndex(p => dist(p, tappa) < 110);
            const prima = primo > 0 ? punti.slice(0, primo) : punti.slice(0, 1);
            const accanto = at(0, OFFSET_SUPERATA_M);
            const fuori = at(80, OFFSET_SUPERATA_M);
            const giro = campiona([prima[prima.length - 1], at(-100, OFFSET_SUPERATA_M + 30), at(-50, OFFSET_SUPERATA_M), accanto, fuori], passo).slice(1);
            punti = [...prima, ...giro];
            ripartiDa = { p: fuori, oltreM: OFFSET_SUPERATA_M + 40 };
            const minimoM = Math.round(Math.min(...punti.map(p => dist(p, tappa))));
            evento('superata-pianificata', { tappa: tappa.title, accantoM: Math.round(dist(accanto, tappa)), minimoM });
        }
        const metaIdx = Math.floor(punti.length / 2);
        // il punto del percorso più vicino alla tappa: da lì in poi il camminatore l'ha «passata»
        let idxVicino = 0;
        punti.forEach((q, j) => { if (dist(q, tappa) < dist(punti[idxVicino], tappa)) idxVicino = j; });
        for (let i = 0; i < punti.length; i++) {
            // NAV-1-FIX: `let`, riletto dopo i 2 minuti senza segnale e dopo la rete assente. Prima restava il punto di
            // PRIMA dell'evento e veniva emesso subito dopo quello nuovo: un salto indietro di 150 m (o di 30 m) in 1 s
            // che il GPS vero non fa (al Castello Ursino: 7 m, poi 123 m).
            let p = punti[i];
            // ── 2 minuti senza segnale (i vicoli, la salita) ──
            if (piano.senzaSegnale === k && i === metaIdx) {
                evento('segnale-perso-inizio', { tappa: tappa.title });
                const tS = Date.now();
                const persoVisto = await attendi(s => s.avvisi?.includes('perso'), SILENZIO_S * 1000);
                const secondiAlMessaggio = Math.round((Date.now() - tS) / 1000);
                if (persoVisto) schermate.perso = await shot('03-segnale-perso');
                const resto = SILENZIO_S * 1000 - (Date.now() - tS);
                if (resto > 0) await page.waitForTimeout(resto);
                // il camminatore è andato avanti di 150 m
                let j = i, fatto = 0;
                while (j < punti.length - 1 && fatto < AVANZA_EVENTO_M) { fatto += dist(punti[j], punti[j + 1]); j++; }
                i = j;
                p = punti[i];
                const tR = Date.now();
                await emetti(punti[i], k, i >= idxVicino);
                const tornato = await attendi(s => !s.avvisi?.includes('perso'), 15000);
                const r = { tappa: tappa.title, secondiAlMessaggio, messaggioVisto: persoVisto, riaggancioS: Math.round((Date.now() - tR) / 100) / 10, tornato };
                misure.riaggancio.push(r);
                evento('segnale-tornato', r);
                schermate.tornato = await shot('04-segnale-tornato');
            }
            // ── 30 s senza rete ──
            if (piano.offline === k && i === metaIdx) {
                await ctx.setOffline(true);
                const tO = Date.now();
                evento('rete-spenta', { tappa: tappa.title });
                // si cammina al vero (1,25 m/s) per 30 s
                const visto = await attendi(s => s.avvisi?.includes('offline'), 6000);
                const secondiAvviso = Math.round((Date.now() - tO) / 100) / 10;
                schermate.offline = await shot('05-offline');
                let j = i;
                while (Date.now() - tO < OFFLINE_S * 1000) {
                    const target = Math.min(punti.length - 1, i + Math.floor(((Date.now() - tO) / 1000) * 1.25 / passo));
                    j = target; await emetti(punti[j], k, j >= idxVicino); await page.waitForTimeout(1000);
                }
                i = j;
                p = punti[i];
                await ctx.setOffline(false);
                const tOn = Date.now();
                const via = await attendi(s => !s.avvisi?.includes('offline'), 10000);
                misure.offline = { tappa: tappa.title, avvisoVisto: visto, secondiAvviso, avvisoTolto: via, secondiAlRitorno: Math.round((Date.now() - tOn) / 100) / 10 };
                evento('rete-tornata', misure.offline);
            }
            // ── 2 minuti nascosta (schermo bloccato), a cavallo della tappa ──
            if (piano.nascosta === k && dist(p, tappa) <= PRIMA_NASCOSTA_M && !misure.nascosta) {
                await page.evaluate(() => window.__setVis('hidden'));
                evento('pagina-nascosta', { tappa: tappa.title, mancanoM: Math.round(dist(p, tappa)) });
                await page.waitForTimeout(NASCOSTA_S * 1000);
                // il camminatore ha passato la tappa ed è 90 m oltre, verso la tappa dopo
                const dopo = vere[k] || tappa;
                const v = verso(tappa, dopo);
                const oltre = sposta(tappa, v.est * (AVANZA_EVENTO_M - PRIMA_NASCOSTA_M), v.nord * (AVANZA_EVENTO_M - PRIMA_NASCOSTA_M));
                const tV = Date.now();
                await page.evaluate(() => window.__setVis('visible'));
                evento('pagina-visibile', {});
                await attendi(s => (s.watch || 0) > 0, 6000);
                await emetti(oltre, k + 1, true);
                await page.waitForTimeout(700);
                await emetti(sposta(oltre, v.est * PASSO_M, v.nord * PASSO_M), k + 1, true);
                const domanda = await attendi(s => !!s.domanda, 8000);
                misure.nascosta = { tappa: tappa.title, watchRipartitoS: Math.round((Date.now() - tV) / 100) / 10, domanda: domanda ? ultimo.domanda : null };
                evento('dopo-nascosta', misure.nascosta);
                schermate.nascosta = await shot('06-dopo-pagina-nascosta');
                if (domanda) { misure.domande.push({ tappa: ultimo.domanda, dopo: 'pagina nascosta' }); await rispondiDomanda('dopo la pagina nascosta'); }
                // si prosegue verso la tappa dopo, a partire da `oltre`
                ripartiDa = { p: oltre, oltreM: AVANZA_EVENTO_M - PRIMA_NASCOSTA_M };
                break;
            }
            await emetti(p, k, i >= idxVicino);
            if (ultimo.domanda) { misure.domande.push({ tappa: ultimo.domanda, dopo: 'in cammino' }); await rispondiDomanda('in cammino'); }
            await page.waitForTimeout(1000);
        }
        // ── alla tappa: sosta (corta, o lunga) ──
        if (piano.superata !== k && !(piano.nascosta === k && misure.nascosta)) {
            const lunga = piano.sostaLunga === k;
            const secondi = lunga ? SOSTA_LUNGA_S : 4;
            if (lunga) evento('sosta-lunga-inizio', { tappa: tappa.title, secondi });
            const fine = Date.now() + secondi * 1000;
            // da fermi iOS manda posizioni più di rado: una ogni 3 s nella sosta lunga
            while (Date.now() < fine) { await emetti({ lat: tappa.lat, lng: tappa.lng }, k, true); await page.waitForTimeout(lunga ? 3000 : 1000); }
            if (lunga) { schermate.sosta = await shot('07-sosta-lunga'); evento('sosta-lunga-fine', { tappa: tappa.title, fatte: fatteOra() }); }
            // non scattata da sola? la domanda arriva allontanandosi; se non arriva nemmeno quella, il tasto
            await attendi(s => fatteOra() >= k || !!s.domanda, 3000);
            if (ultimo.domanda) { misure.domande.push({ tappa: ultimo.domanda, dopo: 'alla tappa' }); await rispondiDomanda('alla tappa'); }
            if (fatteOra() < k && !ultimo.domanda) {
                // un passo verso la tappa dopo: se il GPS chiede «Sei passato da…?» è la regola di NAV-1, non un tasto
                if (vere[k]) {
                    const v = verso(tappa, vere[k]);
                    for (let m = 1; m <= 4 && !ultimo.domanda; m++) { await emetti(sposta(tappa, v.est * 30 * m, v.nord * 30 * m), k + 1, true); await page.waitForTimeout(1000); }
                }
                if (ultimo.domanda) { misure.domande.push({ tappa: ultimo.domanda, dopo: 'allontanandosi' }); await rispondiDomanda('allontanandosi'); }
                if (fatteOra() < k) {
                    const cliccato = await page.getByText('Sono arrivato', { exact: true }).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
                    if (cliccato) {
                        misure.tasto.push({ tappa: tappa.title });
                        evento('arrivo-col-tasto', { tappa: tappa.title });
                        await attendi(s => fatteOra() >= k, 4000);
                    } else evento('tasto-non-trovato', { tappa: tappa.title });
                }
            }
        } else if (piano.superata === k) {
            // la domanda arriva allontanandosi (la gamba dopo comincia dalla posizione oltre la tappa)
            const domanda = await attendi(s => !!s.domanda || fatteOra() >= k, 8000);
            if (ultimo.domanda) { misure.domande.push({ tappa: ultimo.domanda, dopo: 'superata' }); await rispondiDomanda('tappa superata'); }
            else if (fatteOra() < k) evento('superata-senza-domanda', { tappa: tappa.title, attesa: domanda });
        }
        if (k === 1) schermate.primaTappa = await shot('08-prima-tappa');
        // ── ricarica a metà giro ──
        if (piano.ricarica === k) {
            const atteso = fatteOra() + 1;
            const tR = Date.now();
            evento('ricarica', { tappaAttesa: atteso });
            finestraRicarica.attiva = true;
            await page.reload({ waitUntil: 'domcontentloaded' });
            const proposta = await attendi(s => !!s.ripresa, 30000);
            const secondiProposta = Math.round((Date.now() - tR) / 100) / 10;
            // D3: 3 s con la proposta a schermo (la barra in alto, la mappa), prima di «Riprendi»
            await page.waitForTimeout(3000);
            const mappaMontata = await page.evaluate(() => !!document.querySelector('.gm-style')).catch(() => null);
            finestraRicarica.attiva = false;
            const propostaTesto = ultimo.ripresa;
            schermate.ripresa = await shot('09-ripresa-proposta');
            if (proposta) await page.getByText('Riprendi', { exact: true }).click({ timeout: 5000 }).catch(() => {});
            await emetti({ lat: tappa.lat, lng: tappa.lng }, k + 1, false);
            const ripresa = await attendi(s => s.tappa === `${atteso}/${N}`, 15000);
            await page.waitForTimeout(5000);
            misure.ripresa = { attesa: `${atteso}/${N}`, proposta: propostaTesto, propostaS: secondiProposta, barraDopo: ultimo.tappa, tessereMappa: ultimo.tessere, corretta: proposta && propostaTesto === `${atteso}/${N}` && ripresa,
                secondiTotali: Math.round((Date.now() - tR) / 100) / 10,
                d3: { letture: finestraRicarica.letture, conRoma: finestraRicarica.roma, conPreparo: finestraRicarica.preparo, mappaMontataPrimaDiRiprendi: mappaMontata } };
            evento('ripresa', misure.ripresa);
            schermate.ripreso = await shot('10-ripreso');
        }
    }
    const completato = await attendi(s => s.completato, 15000);
    schermate.fine = await shot('11-fine-giro');
    evento('fine', { completato, fatte: ultimo.fatte, saltate: ultimo.saltate });
    osserva = false;
    await osservatore;
    const video = page.video();
    await ctx.close();
    let fileVideo = null;
    try { const v = await video.path(); fileVideo = path.join(dirVideo, `${nome}-${new Date().toISOString().slice(0, 10)}.webm`); fs.renameSync(v, fileVideo); } catch { /* niente */ }

    // ── misure ──
    const daSole = [...new Set(scatti.map(s => s.tappa))];
    const falsi = scatti.filter(s => s.distanzaVeraM != null && s.distanzaVeraM > 40);
    return {
        giro: nome, luogo: giro.luogo, tappe: N, metriPercorso: legs.reduce((a, l) => a + l.metri, 0), secondi: Math.round((Date.now() - t0) / 1000),
        video: fileVideo ? fileVideo.replace(os.homedir(), '~') : null, completato,
        misure: { ...misure, arriviDaSoli: daSole.length, scatti, falsiArrivi: falsi, verita, domandeSbagliate: verita.filter(v => v.sbagliata).length, mappe },
        cronologia, schermate, errori, ultimoTick,
    };
}

const browser = await webkit.launch();
let codice = 0;
const esiti = [];
try {
    await controllaPorta(browser);
    const s = await accedi(browser);
    for (const nome of Object.keys(PIANI)) {
        if (SOLO.length && !SOLO.includes(nome)) continue;
        try { esiti.push(await camminata(browser, s, nome)); } catch (e) { esiti.push({ giro: nome, errore: String(e?.stack || e).slice(0, 600) }); codice = 1; }
        fs.writeFileSync(ESITI, JSON.stringify({ webkit: browser.version(), base: BASE, esiti }, null, 1));
    }
} catch (e) {
    console.error('[navsim] fermo:', e.message);
    codice = 2;
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(JSON.stringify(esiti.map(e => ({ giro: e.giro, errore: e.errore, completato: e.completato, arriviDaSoli: e.misure?.arriviDaSoli, tappe: e.tappe, video: e.video })), null, 1));
process.exit(codice);
