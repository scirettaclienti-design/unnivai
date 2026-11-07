/**
 * COLLAUDO-FINALE (T31) — i punti nuovi dopo T26–T30, sul sito pubblicato (solo prova: nessuna modifica all'app).
 *   node scripts/prova-nav/collaudo-finale.webkit.mjs [parti, es. home,profilo]   (difetto: movimento,home,profilo,giri)
 * WebKit, iPhone 14, account di prova di .env.local (mai stampato). Prima delle credenziali: titolo «Unnivai» verificato.
 * Per Te gira con l'ora VERA (nessun orologio finto) e GPS a Roma. L'email non compare negli screenshot (la home e il Profilo non la mostrano;
 * si controlla che il testo della pagina non la contenga).
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { conVoceTelefono } from './voce-telefono.mjs';

const BASE = (process.env.COLLAUDO_BASE || 'https://unnivai.vercel.app').replace(/\/$/, '');
const PARTI = (process.argv[2] || 'movimento,home,profilo,giri').split(',');
const OUT = path.resolve(process.env.COLLAUDO_OUT || 'docs/prove/schermate/collaudo-finale');
const ESITI = path.resolve(process.env.COLLAUDO_ESITI || 'docs/prove/dati/2026-11-07-collaudo-finale-nuovi.json');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'collaudo-finale-'));
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const IPHONE = { ...devices['iPhone 14'], locale: 'it-IT', timezoneId: 'Europe/Rome', permissions: ['geolocation'], geolocation: { latitude: 41.9009, longitude: 12.4833 } };
const browser = conVoceTelefono(await webkit.launch());
const esito = { base: BASE, iniziato: new Date().toISOString(), oraRoma: new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' }), parti: {} };
const salva = () => fs.writeFileSync(ESITI, JSON.stringify(esito, null, 1));
const foto = async (page, nome) => { const f = path.join(OUT, `${nome}.png`); await page.screenshot({ path: f }); return path.relative(process.cwd(), f); };
const testoPagina = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const ora = () => new Date().toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome' });

async function consensoAi(page, attesa = 6000) {
    const ok = page.getByTestId('consenso-ai-ok');
    try { await ok.waitFor({ timeout: attesa }); await ok.click(); await page.getByTestId('consenso-ai').waitFor({ state: 'detached', timeout: 8000 }); return true; } catch { return false; }
}
async function accedi() {
    const ctx = await browser.newContext({ ...IPHONE });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/Unnivai|DoveVai/i.test(await p.title())) throw new Error('titolo non Unnivai: niente credenziali');
    await p.getByText('Accedi →').click();
    await p.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await p.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await p.getByText('Accedi Ora').click();
    await p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await consensoAi(p);
    await p.waitForTimeout(2500);
    const file = path.join(TMP, 'sessione.json');
    await ctx.storageState({ path: file });
    await ctx.close();
    return file;
}
async function parte(nome, fn) {
    if (!PARTI.includes(nome)) return;
    const t0 = Date.now();
    try { esito.parti[nome] = await fn(); } catch (e) { esito.parti[nome] = { ok: false, errore: String(e?.message || e).slice(0, 400) }; }
    esito.parti[nome].secondi = Math.round((Date.now() - t0) / 1000);
    console.log(nome, JSON.stringify(esito.parti[nome]).slice(0, 900));
    salva();
}
const nuovoCtx = (state, extra = {}) => browser.newContext({ ...IPHONE, ...(state ? { storageState: state } : {}), ...extra });

try {
    const state = await accedi();
    const email = env.TEST_ACCOUNT_EMAIL;

    // ── T30: movimento della Landing (con e senza «riduci movimento») ──
    await parte('movimento', async () => {
        const r = {};
        for (const modo of ['movimento', 'ridotto']) {
            const ctx = await browser.newContext({ ...IPHONE, reducedMotion: modo === 'ridotto' ? 'reduce' : 'no-preference' });
            const page = await ctx.newPage();
            await page.goto(BASE, { waitUntil: 'load' });
            await page.waitForTimeout(1500);
            r[`foto_${modo}_1`] = await foto(page, `m-landing-${modo}-1s`);
            const a = await page.evaluate(() => { const img = document.querySelector('header img'); return img ? getComputedStyle(img).transform : null; });
            await page.waitForTimeout(5000);
            const b = await page.evaluate(() => { const img = document.querySelector('header img'); return img ? getComputedStyle(img).transform : null; });
            r[`foto_${modo}_6`] = await foto(page, `m-landing-${modo}-6s`);
            r[modo] = await page.evaluate(() => {
                const img = document.querySelector('header img');
                const cs = img && getComputedStyle(img);
                return { fotoAnimazione: cs?.animationName || null, animazioniAttive: document.getAnimations().filter(x => x.playState === 'running' && /camera|curve|logo|bussola/.test(x.animationName || '')).map(x => x.animationName) };
            });
            r[modo].transformPrima = a; r[modo].transformDopo = b; r[modo].fotoCambia = a !== b;
            await ctx.close();
        }
        r.ok = r.movimento.animazioniAttive.length > 0 && r.movimento.fotoCambia && r.ridotto.animazioniAttive.length === 0 && !r.ridotto.fotoCambia;
        return r;
    });

    // ── T27 + home: Per Te in ora vera, «Vedi tutte», nomi nuovi ──
    await parte('home', async () => {
        const ctx = await nuovoCtx(state);
        const page = await ctx.newPage();
        const errori = [];
        page.on('pageerror', e => errori.push(String(e?.message || e).slice(0, 160)));
        const r = { oraRoma: ora(), data: new Date().toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' }) };
        await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
        await consensoAi(page, 4000);
        const t0 = Date.now();
        await page.waitForFunction(() => document.querySelectorAll('a[href^="/tour-details/"] h4').length > 0 || /Riprova|non troviamo|Non sono riuscito/i.test(document.body.innerText), null, { timeout: 240000 });
        await page.waitForTimeout(3000);
        r.secondi = Math.round((Date.now() - t0) / 1000);
        r.url = new URL(page.url()).pathname;
        const schede = (p) => p.evaluate(() => [...document.querySelectorAll('a[href^="/tour-details/"]')].map(a => ({ titolo: a.querySelector('h4')?.innerText?.trim() || null, badge: a.querySelector('span')?.innerText?.trim() || null, href: a.getAttribute('href') })).filter(x => x.titolo));
        r.schedeHome = await schede(page);
        r.fotoHome = await foto(page, 'h-home');
        const t = await testoPagina(page);
        r.testiNuovi = {
            suMisura: /Su misura/.test(t), suMisuraSottotitolo: /Scrivi cosa cerchi\. Città, gusti, budget, ritmo: il giro lo costruiamo da qui\./.test(t),
            alVolo: /Al volo/.test(t), alVoloSottotitolo: /Tre scelte e sei in strada\./.test(t),
            aiPowered: /AI POWERED/i.test(t), vecchi: [/Crea il tuo Percorso/i, /Quiz Veloce/i].filter(x => x.test(t)).map(String),
            emailVisibile: t.includes(email),
        };
        // scorro fino alle due schede per lo screenshot
        await page.getByText('Al volo').first().scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(600);
        r.fotoNomi = await foto(page, 'h-nomi-su-misura-al-volo');
        // «Vedi tutte»
        const vt = page.getByRole('link', { name: 'Vedi tutte' }).first();
        await vt.scrollIntoViewIfNeeded();
        r.fotoVediTutte = await foto(page, 'h-vedi-tutte-link');
        await vt.click();
        await page.waitForURL(u => u.pathname === '/per-te', { timeout: 15000 });
        await page.waitForTimeout(2500);
        r.urlElenco = new URL(page.url()).pathname;
        r.schedeElenco = await page.evaluate(() => [...document.querySelectorAll('[data-testid="per-te-elenco"] a[href^="/tour-details/"]')].map(a => ({ titolo: a.querySelector('h4')?.innerText?.trim() || null, href: a.getAttribute('href') })));
        r.vuotoElenco = await page.getByTestId('per-te-vuoto').count();
        r.fotoElenco = await foto(page, 'h-per-te-elenco');
        const titoliHome = r.schedeHome.map(x => x.titolo), titoliElenco = r.schedeElenco.map(x => x.titolo);
        r.stesseSchede = titoliHome.every(x => titoliElenco.includes(x));
        // si torna indietro: prima col tasto del browser, poi col tasto della pagina
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        r.tornaConIndietro = new URL(page.url()).pathname;
        await page.getByRole('link', { name: 'Vedi tutte' }).first().click();
        await page.waitForURL(u => u.pathname === '/per-te', { timeout: 15000 });
        const torna = page.getByText('Torna alla home').first();
        r.tastoTorna = await torna.count();
        if (r.tastoTorna) { await torna.click(); await page.waitForTimeout(1500); r.tornaConTasto = new URL(page.url()).pathname; }
        // una scheda dell'elenco si apre
        await page.goto(`${BASE}${r.schedeElenco[0]?.href || '/per-te'}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
        r.aperturaScheda = { url: new URL(page.url()).pathname, vuota: (await testoPagina(page)).length < 80 };
        r.fotoScheda = await foto(page, 'h-scheda-aperta');
        r.errori = errori.slice(0, 5);
        r.nSchede = r.schedeHome.length;
        r.ok = {
            perTe3oPiu: r.nSchede >= 3,
            vediTutte: r.urlElenco === '/per-te' && r.schedeElenco.length >= r.nSchede && r.stesseSchede,
            indietro: ['/dashboard-user', '/'].includes(r.tornaConIndietro),
            nomi: r.testiNuovi.suMisura && r.testiNuovi.suMisuraSottotitolo && r.testiNuovi.alVolo && r.testiNuovi.alVoloSottotitolo && !r.testiNuovi.aiPowered && r.testiNuovi.vecchi.length === 0,
        };
        await ctx.close();
        return r;
    });

    // ── T28: Profilo, con l'account di prova e con un account vuoto (risposte del registro svuotate) ──
    const profilo = async (vuoto) => {
        const ospite = vuoto === 'ospite';
        const ctx = await nuovoCtx(ospite ? null : state);
        const page = await ctx.newPage();
        if (ospite) {
            await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
            const b = page.getByTestId('prova-senza-account');
            await b.waitFor({ timeout: 20000 }).catch(() => {});
            if (!(await b.count())) return { ok: false, errore: 'tasto «Prova un giro, senza account» assente' };
            await b.click({ timeout: 20000 });
            await page.waitForURL((u) => /^\/(onboarding|dashboard-user)/.test(u.pathname), { timeout: 30000 });
            await page.waitForURL((u) => /^\/onboarding/.test(u.pathname), { timeout: 8000 }).catch(() => {});
            await consensoAi(page);
            if (/\/onboarding/.test(page.url())) {
                await page.getByText('Salta per ora').click({ timeout: 20000 });
                await page.waitForURL((u) => /^\/dashboard-user/.test(u.pathname), { timeout: 20000 });
                await page.waitForTimeout(1500);
            }
            esito.ospiteUrl = new URL(page.url()).pathname;
        }
        const errori = [];
        page.on('pageerror', e => errori.push(String(e?.message || e).slice(0, 160)));
        if (vuoto === true) {
            for (const tab of ['dna_events', 'saved_tours']) {
                await page.route(new RegExp(`/rest/v1/${tab}`), (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' }));
            }
        }
        const r = { vuoto };
        const nm = ospite ? 'p-ospite' : vuoto ? 'p-vuoto' : 'p-account';
        await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('contatore-giri').waitFor({ timeout: 25000 });
        await page.waitForTimeout(2500);
        { const b = page.getByText('Conferma Posizione'); if (await b.count().catch(() => 0)) { r.dialogoPosizione = true; await b.first().click().catch(() => {}); } }
        await page.waitForTimeout(1500);
        const t = await testoPagina(page);
        r.contatori = { giri: await page.getByTestId('contatore-giri').innerText(), citta: await page.getByTestId('contatore-citta').innerText(), tappe: await page.getByTestId('contatore-tappe').innerText() };
        r.titoli = await page.evaluate(() => [...document.querySelectorAll('h2,h3')].map(h => h.innerText.trim()).filter(Boolean));
        r.richiesteVisibile = /Richieste/.test(t);
        r.emailVisibile = t.includes(email);
        r.sezioni = { dna: /DNA/i.test(t), interessi: /Interess/i.test(t), comeGiri: /Come giri/i.test(t), riviviTitolo: /Rivivi i tuoi giri/.test(t), mete: /Mete/.test(t), risultati: /Risultati/.test(t) };
        await page.evaluate((em) => { for (const el of document.querySelectorAll('main p, main span, main div')) if (el.children.length === 0 && el.textContent.includes(em)) el.textContent = 'email dell\'account di prova (nascosta)'; }, email);
        r.foto1 = await foto(page, `${nm}-1-alto`);
        await page.getByTestId('rivivi-giri').scrollIntoViewIfNeeded().catch(() => {});
        r.rivivi = { giri: await page.getByTestId('rivivi-giro').count(), vuotoTesto: await page.getByTestId('rivivi-vuoto').innerText().catch(() => null) };
        r.foto2 = await foto(page, `${nm}-2-rivivi`);
        if (r.rivivi.giri > 0) {
            await page.getByTestId('rivivi-giro').first().click();
            await page.getByTestId('rivivi-scheda').waitFor({ timeout: 10000 });
            await page.waitForTimeout(2500);
            r.rivivi.scheda = { tappe: await page.getByTestId('rivivi-tappa').count(), rifai: await page.getByTestId('rivivi-rifai').count() };
            r.foto3 = await foto(page, `${nm}-3-rivivi-scheda`);
            await page.getByTestId('rivivi-rifai').click();
            await page.waitForURL(u => u.pathname === '/map', { timeout: 15000 });
            await page.waitForTimeout(4000);
            r.rivivi.dopoRifai = { url: new URL(page.url()).pathname, tappeSullaMappa: (await testoPagina(page)).length, avvia: await page.locator('[data-testid="map-avvia-card"]').count() };
            r.foto4 = await foto(page, `${nm}-4-rifai-mappa`);
            await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
            await page.getByTestId('contatore-giri').waitFor({ timeout: 25000 });
            await page.waitForTimeout(2500);
            { const b = page.getByText('Conferma Posizione'); if (await b.count().catch(() => 0)) await b.first().click().catch(() => {}); }
            await page.waitForTimeout(800);
        }
        // Mete e Risultati
        const tab = async (nome, testid) => {
            const b = page.getByRole('tab', { name: nome, exact: true }).first();
            await b.scrollIntoViewIfNeeded();
            await b.click(); await page.waitForTimeout(900);
            return { visibile: await page.getByTestId(testid).count(), foto: await foto(page, `${nm}-5-${nome.toLowerCase()}`) };
        };
        r.tabMete = await tab('Mete', 'mete-profilo');
        r.mete = { elementi: await page.getByTestId('meta').count(), vuote: await page.getByTestId('mete-vuote').count(), altre: await page.getByTestId('mete-altre').count() };
        if (r.mete.altre) { await page.getByTestId('mete-altre').click(); await page.waitForTimeout(600); r.mete.dopoAltre = await page.getByTestId('meta').count(); }
        r.tabRisultati = await tab('Risultati', 'risultati-profilo');
        r.risultati = { vuoti: await page.getByTestId('risultati-vuoti').count(), valori: await page.evaluate(() => [...document.querySelectorAll('[data-testid^="risultato-"][data-testid$="-valore"]')].map(e => e.innerText.trim())) };
        // impostazioni del DNA: si cambia e si rilegge il riquadro (senza salvare nulla: si guardano i controlli presenti)
        r.dnaControlli = await page.evaluate(() => ({ bottoni: [...document.querySelectorAll('main button')].map(b => (b.innerText || b.getAttribute('aria-label') || '').trim()).filter(Boolean).slice(0, 60) }));
        await page.getByText(/Il tuo DNA/i).first().scrollIntoViewIfNeeded().catch(() => {});
        r.foto6 = await foto(page, `${nm}-6-dna`);
        await page.getByText(/Come giri/i).first().scrollIntoViewIfNeeded().catch(() => {});
        r.foto7 = await foto(page, `${nm}-7-come-giri`);
        // pagine a cui portano i collegamenti del Profilo (mai «Esci», mai «Elimina account»)
        r.collegamenti = [];
        const hrefs = await page.evaluate(() => [...new Set([...document.querySelectorAll('main a[href^="/"]')].map(a => a.getAttribute('href')))]);
        for (const h of hrefs) {
            const p2 = await ctx.newPage();
            await p2.goto(`${BASE}${h}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
            await p2.waitForTimeout(2500);
            const tt = await testoPagina(p2);
            r.collegamenti.push({ href: h, url: new URL(p2.url()).pathname, caratteri: tt.length, nonTrovata: /404|non trovata|Pagina non/i.test(tt) });
            await p2.close();
        }
        r.errori = errori.slice(0, 5);
        r.ok = { richiesteNonVisibile: !r.richiesteVisibile, sezioni: r.sezioni.dna && r.sezioni.riviviTitolo && r.sezioni.mete && r.sezioni.risultati && r.sezioni.comeGiri, tabMete: r.tabMete.visibile > 0, tabRisultati: r.tabRisultati.visibile > 0, collegamentiNonVuoti: r.collegamenti.every(c => c.caratteri > 80 && !c.nonTrovata) };
        await ctx.close();
        return r;
    };
    await parte('profilo', () => profilo(false));
    await parte('profiloVuoto', () => profilo(true));
    await parte('profiloOspite', () => profilo('ospite'));

    // ── ospite: gli accessi anonimi sono spenti dal 31/10? ──
    await parte('ospite', async () => {
        const ctx = await browser.newContext({ ...IPHONE });
        const page = await ctx.newPage();
        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
        const b = page.getByText(/Prova un giro, senza account/i).first();
        const r = { bottone: await b.count() };
        if (r.bottone) { await b.click(); await page.waitForTimeout(6000); r.url = new URL(page.url()).pathname; r.testo = (await testoPagina(page)).slice(0, 300); r.foto = await foto(page, 'o-ospite'); }
        await ctx.close();
        return r;
    });

    // ── T29: un giro «Al volo» e uno «Su misura» con un chip e una frase (generazioni vere, account di prova) ──
    await parte('giri', async () => {
        const r = {};
        const ctx = await nuovoCtx(state);
        const page = await ctx.newPage();
        // Su misura
        await page.goto(`${BASE}/ai-itinerary`, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 3; i++) { const b = page.getByText('Conferma Posizione'); if (await b.count().catch(() => 0)) await b.first().click().catch(() => {}); await page.waitForTimeout(800); }
        r.suMisuraTitolo = (await testoPagina(page)).slice(0, 200);
        await page.getByText('Cibo', { exact: true }).first().click();
        await page.locator('textarea').first().fill('domani alle 10 una mattina a Roma, con una pasticceria');
        r.fotoSuMisura1 = await foto(page, 'g-su-misura-1-compilato');
        const t0 = Date.now();
        await page.getByText('Genera Viaggio').first().click();
        await page.locator('[data-stop-card]').first().waitFor({ timeout: 170000 });
        await page.waitForTimeout(2500);
        r.suMisuraSecondi = Math.round((Date.now() - t0) / 1000);
        r.suMisuraTappe = await page.locator('[data-stop-card]:not([data-free-time])').evaluateAll(els => els.map(e => (e.innerText || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 3).join(' | ')));
        r.suMisuraNota = (await testoPagina(page)).match(/(Ho tolto[^.]*\.|[^.]*non (ho trovato|trovato)[^.]*\.)/)?.[0] || null;
        r.fotoSuMisura2 = await foto(page, 'g-su-misura-2-giro');
        await ctx.close();
        r.ok = r.suMisuraTappe.length >= 2;
        return r;
    });

    await parte('alVolo', async () => {
        const r = {};
        const ctx = await nuovoCtx(state);
        const page = await ctx.newPage();
        // Al volo
        await page.goto(`${BASE}/quick-path`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
        for (let i = 0; i < 3; i++) { const b = page.getByText('Conferma Posizione'); if (await b.count().catch(() => 0)) await b.first().click().catch(() => {}); await page.waitForTimeout(800); }
        r.alVoloPasso1 = (await testoPagina(page)).slice(0, 200);
        r.fotoAlVolo1 = await foto(page, 'g-al-volo-1');
        const passi = [];
        for (let i = 0; i < 4; i++) {
            const bottoni = page.locator('main button, [class*="min-h-screen"] button').filter({ hasNot: page.locator('svg.lucide-arrow-left') });
            const cand = []; for (const c of await page.locator('button.cursor-pointer').all()) if ((await c.innerText().catch(() => '')).trim()) cand.push(c);
            const titoli = [];
            for (const c of cand) titoli.push((await c.innerText().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 50));
            passi.push(titoli.slice(0, 8));
            if (!cand.length) break;
            await cand[0].click();
            await page.waitForTimeout(1200);
            if (await page.locator('[data-stop-card]').count() || /Vedi su Mappa/.test(await testoPagina(page))) break;
        }
        r.alVoloPassi = passi;
        const t1 = Date.now();
        try {
            await page.waitForFunction(() => /Vedi su Mappa|Tappe|tappe/.test(document.body.innerText) && document.querySelectorAll('[data-stop-card], [data-testid*="tappa"]').length > 0, null, { timeout: 170000 });
        } catch { /* si legge com'è */ }
        await page.waitForTimeout(2500);
        r.alVoloSecondi = Math.round((Date.now() - t1) / 1000);
        r.alVoloTesto = (await testoPagina(page)).slice(0, 500);
        r.fotoAlVolo2 = await foto(page, 'g-al-volo-2-esito');
        await ctx.close();
        r.ok = /Vedi su Mappa/.test(r.alVoloTesto || '');
        return r;
    });
} catch (e) {
    console.error('ERRORE', e);
    esito.errore = String(e?.message || e);
    salva();
} finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
}
