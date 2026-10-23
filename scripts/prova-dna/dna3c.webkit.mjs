/**
 * DNA-3c — prova dal vivo: «un giro a Catania» da «Crea il tuo Percorso» sul sito pubblicato, con un DNA food forte e da utente nuovo.
 * WebKit iPhone 13, GPS finto a Catania, chiamate VERE (Google Places e OpenAI dal proxy). Conta le richieste e le costa col listino del banco.
 *   node scripts/prova-dna/dna3c.webkit.mjs inserisci          → inserisce fino a 10 eventi food col segno 'test' per l'account di prova
 *   node scripts/prova-dna/dna3c.webkit.mjs giro dna <uscita>   → il giro dell'account di prova (DNA food)
 *   node scripts/prova-dna/dna3c.webkit.mjs giro nuovo <uscita> → lo stesso account, ma la lettura del registro (dna_events) risponde vuota: per l'app e' un utente nuovo
 *                                                               (un ospite non entra: la pagina rimanda al login). Nessuna riga viene scritta nel registro in nessuno dei due giri.
 * Credenziali solo da .env.local, mai stampate. Uscita: JSON con tappe, soste, richieste e costo; screenshot in docs/prove/schermate/.
 */
import { webkit, devices } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const BASE = process.env.PROVA_BASE || 'https://unnivai.vercel.app';
const leggi = (f) => (fs.existsSync(f) ? Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')])) : {});
const env = { ...leggi('.env'), ...leggi('.env.local') };
const CATANIA = { latitude: 37.5023612, longitude: 15.0873718 };
const LISTINO = { textsearch: 0.032, details: 0.025, findplacefromtext: 0.017, photo: 0.007, altro: 0.032 };
const OPENAI = { 'gpt-4o-mini': [0.15, 0.6], 'gpt-6.1-sol': [2, 10] };
const [, , modo, quale, uscita] = process.argv;

if (modo === 'inserisci') {
    if (!env.TEST_ACCOUNT_EMAIL || !env.TEST_ACCOUNT_PASSWORD) throw new Error('Mancano le credenziali di prova in .env.local');
    const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
    const { data: s, error: e1 } = await sb.auth.signInWithPassword({ email: env.TEST_ACCOUNT_EMAIL, password: env.TEST_ACCOUNT_PASSWORD });
    if (e1) throw new Error(`accesso fallito: ${e1.message}`);
    const uid = s.user.id;
    const { data: gia } = await sb.from('dna_events').select('id,kind,category,tour_id,label').order('created_at', { ascending: false }).limit(1000);
    const miei = (gia || []).filter(r => String(r.tour_id || '').startsWith('prova-dna3c-'));
    const daInserire = 10 - miei.length;
    let inseriti = 0;
    if (daInserire > 0) {
        const righe = Array.from({ length: daInserire }, (_, i) => ({ user_id: uid, kind: 'tour_completed', category: 'food', city: 'Catania', tour_id: `prova-dna3c-g${miei.length + i + 1}` }));
        const { error: e2 } = await sb.from('dna_events').insert(righe);
        if (e2) throw new Error(`inserimento fallito: ${e2.message}`);
        inseriti = righe.length;
    }
    const { data: dopo } = await sb.from('dna_events').select('id,kind,category,tour_id,label').order('created_at', { ascending: false }).limit(1000);
    const tot = (dopo || []).length;
    const prova = (dopo || []).filter(r => String(r.tour_id || '').startsWith('prova-dna3c-'));
    console.log(JSON.stringify({ righeTotaliDellAccount: tot, righeProvaDna3c: prova.length, inseritiOra: inseriti, segni: [...new Set(prova.map(r => r.label))] }));
    await sb.auth.signOut();
    process.exit(0);
}

if (modo !== 'giro' || !['dna', 'nuovo'].includes(quale)) throw new Error('uso: inserisci | giro dna|nuovo <uscita.json>');
const browser = await webkit.launch();
const esito = { quale, richieste: { places: {}, placesMiss: {}, sosta: [], sostaMiss: 0, openai: 0 }, console: [], tappe: [], momenti: [], note: [], costoUsd: {} };
try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'it-IT', timezoneId: 'Europe/Rome', geolocation: CATANIA, permissions: ['geolocation'] });
    const page = await ctx.newPage();
    let costoOpenai = 0;
    page.on('console', (m) => { const t = m.text(); if (/DNA-3|RICERCA SOSTA|C10 CITTA|CONTINUITA|C8b MINIMO/.test(t)) esito.console.push(t.slice(0, 260)); });
    page.on('request', (r) => {
        const u = r.url();
        if (u.includes('/functions/v1/places-proxy')) {
            const p = decodeURIComponent(u).replace(/\+/g, ' ');
            const path = (p.match(/path=([^&]+)/) || [])[1] || 'altro';
            const chiave = path.replace('place/', '');
            esito.richieste.places[chiave] = (esito.richieste.places[chiave] || 0) + 1;
            if (/caffè storico pasticceria gelateria|belvedere giardino parco|libreria bottega storica/.test(p)) esito.richieste.sosta.push(p.replace(/key=[^&]*/g, 'key=…').slice(0, 220));
        }
        if (u.includes('/functions/v1/openai-proxy')) esito.richieste.openai += 1;
    });
    page.on('response', async (r) => {
        const u = r.url();
        if (u.includes('/functions/v1/places-proxy')) {
            // X-Cache: HIT = dalla cache del proxy (nessun costo Google), MISS = chiamata vera a Google
            const miss = (r.headers()['x-cache'] || '').toUpperCase() === 'MISS';
            const p = decodeURIComponent(u).replace(/\+/g, ' ');
            const chiave = ((p.match(/path=([^&]+)/) || [])[1] || 'altro').replace('place/', '');
            if (miss) esito.richieste.placesMiss[chiave] = (esito.richieste.placesMiss[chiave] || 0) + 1;
            if (miss && /caffè storico pasticceria gelateria|belvedere giardino parco|libreria bottega storica/.test(p)) esito.richieste.sostaMiss += 1;
            return;
        }
        if (!u.includes('/functions/v1/openai-proxy')) return;
        try {
            const j = await r.json();
            const mod = j?._modello?.usato || j?.model || 'gpt-4o-mini';
            const k = Object.keys(OPENAI).find(x => String(mod).includes(x)) || 'gpt-4o-mini';
            const inT = j?.usage?.prompt_tokens || 0, outT = j?.usage?.completion_tokens || 0;
            costoOpenai += (inT * OPENAI[k][0] + outT * OPENAI[k][1]) / 1e6;
        } catch { /* risposta non JSON */ }
    });
    // il registro: nessuna scrittura in nessuno dei due giri; nel giro «nuovo» la lettura risponde vuota (utente nuovo per l'app)
    await page.route(/rest\/v1\/dna_events/, async (route) => {
        const m = route.request().method();
        if (m === 'GET' && quale === 'nuovo') return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'content-range': '*/0' }, body: '[]' });
        if (m === 'POST') return route.fulfill({ status: 201, headers: { 'content-type': 'application/json' }, body: '' });
        return route.continue();
    });
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await page.title())) throw new Error(`Titolo non DoveVai su ${BASE}: niente credenziali.`);
    {
        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
        if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai al login: niente credenziali.');
        await page.getByText('Accedi →').click();
        await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
        await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
        await page.getByText('Accedi Ora').click();
        await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
        await page.waitForTimeout(6000); // il DNA si legge dal registro alla prima apertura
    }
    await page.goto(`${BASE}/ai-itinerary`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    for (let i = 0; i < 3; i++) { const b = page.getByText('Conferma Posizione'); if (await b.count().catch(() => 0)) await b.first().click().catch(() => {}); await page.waitForTimeout(800); }
    const testo = page.locator('textarea').first();
    await testo.waitFor({ timeout: 20000 });
    await testo.fill('un giro a Catania');
    esito.ora = new Date().toISOString();
    await page.getByText('Genera Viaggio').first().click();
    await page.locator('[data-stop-card]').first().waitFor({ timeout: 150000 });
    await page.waitForTimeout(4000);
    esito.momenti = await page.locator('[data-moment-header]').allInnerTexts();
    const carte = page.locator('[data-stop-card]');
    const n = await carte.count();
    for (let i = 0; i < n; i++) {
        const c = carte.nth(i);
        const libero = (await c.getAttribute('data-free-time')) !== null;
        const t = (await c.innerText()).split('\n').map(x => x.trim()).filter(Boolean);
        esito.tappe.push({ libero, righe: t.slice(0, 4) });
    }
    esito.note = await page.locator('[data-scala-note]').allInnerTexts();
    const file = `docs/prove/schermate/2026-10-23-dna-3c-${quale}.png`;
    await page.screenshot({ path: file, fullPage: true });
    esito.screenshot = file;
    const stima = Object.entries(esito.richieste.places).reduce((a, [k, v]) => a + v * (LISTINO[k] ?? LISTINO.altro), 0);
    const reale = Object.entries(esito.richieste.placesMiss).reduce((a, [k, v]) => a + v * (LISTINO[k] ?? LISTINO.altro), 0);
    esito.costoUsd = { googleRealeMiss: Number(reale.toFixed(3)), googleAlListino: Number(stima.toFixed(3)), openai: Number(costoOpenai.toFixed(4)), totale: Number((stima + costoOpenai).toFixed(3)), ricercheSosta: esito.richieste.sosta.length, ricercheSostaAlListino: Number((esito.richieste.sosta.length * LISTINO.textsearch).toFixed(3)), ricercheSostaMiss: esito.richieste.sostaMiss, totaleReale: Number((reale + costoOpenai).toFixed(3)) };
    await ctx.close();
} finally {
    await browser.close();
    if (uscita) fs.writeFileSync(uscita, JSON.stringify(esito, null, 1));
}
console.log(JSON.stringify({ quale, tappe: esito.tappe.length, costo: esito.costoUsd, ricerche: esito.richieste }));
