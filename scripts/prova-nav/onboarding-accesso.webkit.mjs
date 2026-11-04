/**
 * ONBOARDING-ACCESSO — i 6 percorsi d'ingresso su un iPhone 14 (WebKit), con Supabase FINTO (nessuna email, nessuna
 * credenziale, 0 $): utente nuovo con email, accesso esistente, password dimenticata, ospite che si registra a fine giro,
 * secondo accesso dello stesso utente, accesso da un secondo dispositivo. Una schermata JPEG per passo.
 *
 *   ONB_BASE=https://unnivai.vercel.app ONB_OUT=docs/prove/dati/onboarding/prima node scripts/prova-nav/onboarding-accesso.webkit.mjs
 *   ONB_BASE=http://localhost:4319        ONB_OUT=docs/prove/dati/onboarding/dopo  node scripts/prova-nav/onboarding-accesso.webkit.mjs
 *
 * Il sito (pubblicato o locale) parla con l'host vero di Supabase: qui ogni richiesta a quell'host è intercettata e la
 * risponde `supabase-finto.mjs`. Due contesti WebKit = due telefoni, lo stesso «server» finto. Funziona sul codice di
 * prima e su quello di dopo (selettori di entrambi). Esiti in <ONB_OUT>/esiti.json.
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { conVoceTelefono } from './voce-telefono.mjs';
import { creaServer, collegaServer } from './supabase-finto.mjs';

const BASE = (process.env.ONB_BASE || 'https://unnivai.vercel.app').replace(/\/$/, '');
const OUT = path.resolve(process.env.ONB_OUT || 'docs/prove/dati/onboarding/prova');
const SOLO = (process.env.ONB_PERCORSI || '1,2,3,4,5,6').split(',').map(Number);
fs.mkdirSync(OUT, { recursive: true });

const IPHONE = { ...devices['iPhone 14'], deviceScaleFactor: 2, locale: 'it-IT', timezoneId: 'Europe/Rome', permissions: ['geolocation'], geolocation: { latitude: 41.8986, longitude: 12.4769 } };
const PW_ESISTENTE = 'Giro2026ok';
const srv = creaServer();
const esistente = srv.nuovoUtente({ email: 'marta@prova.unnivai.it', password: PW_ESISTENTE, confermato: true, meta: { full_name: 'Marta', role: 'explorer', consenso_ai: { v: 1, at: '2026-10-01T10:00:00Z' } } });
srv.preferenze.set(esistente.id, { user_id: esistente.id, onboarding_seed: { v: 2, interessi: ['food'], vincoli: { dieta: [], budget: null }, gusti: { stile: 'trattoria' } } });

const esiti = { base: BASE, iniziato: new Date().toISOString(), percorsi: {} };
const browser = conVoceTelefono(await webkit.launch());
const salva = () => fs.writeFileSync(path.join(OUT, 'esiti.json'), JSON.stringify({ ...esiti, ultimaPagina: undefined }, null, 1));

async function telefono() {
    const ctx = await browser.newContext(IPHONE);
    await collegaServer(ctx, srv);
    const page = await ctx.newPage();
    esiti.ultimaPagina = page;
    const visti = [];
    const errori = [];
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) visti.push(new URL(f.url()).pathname); });
    page.on('pageerror', (e) => errori.push(String(e?.message || e).slice(0, 160)));
    return { ctx, page, visti, errori };
}
const attesa = (page, ms = 900) => page.waitForTimeout(ms);
async function foto(page, nome, didascalia) {
    await attesa(page, 700);
    const file = path.join(OUT, `${nome}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 42 });
    const p = esiti.percorsi[esiti.corrente];
    p.schermate.push({ nome, didascalia, url: new URL(page.url()).pathname });
    return nome;
}
const visibile = async (loc, ms = 1500) => { try { await loc.first().waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; } };
async function clicca(page, candidati, ms = 4000) {
    const fine = Date.now() + ms;
    while (Date.now() < fine) {
        for (const c of candidati) {
            const l = typeof c === 'string' ? page.getByText(c, { exact: true }) : c;
            if (await l.first().isVisible().catch(() => false)) { await l.first().click(); return true; }
        }
        await page.waitForTimeout(150);
    }
    return false;
}
const testo = (page) => page.evaluate(() => document.body.innerText);
const campo = (page, re) => page.getByPlaceholder(re).first();

async function percorso(n, titolo, fn) {
    if (!SOLO.includes(n)) return;
    esiti.corrente = n;
    esiti.percorsi[n] = { titolo, schermate: [], note: [], inceppi: [] };
    try { await fn(esiti.percorsi[n]); esiti.percorsi[n].ok = esiti.percorsi[n].inceppi.length === 0; }
    catch (e) { esiti.percorsi[n].ok = false; esiti.percorsi[n].errore = String(e?.message || e).split("\n")[0].slice(0, 200); esiti.percorsi[n].urlErrore = esiti.ultimaPagina ? new URL(esiti.ultimaPagina.url()).pathname : null; if (esiti.ultimaPagina) await esiti.ultimaPagina.screenshot({ path: path.join(OUT, `p${n}-errore.jpg`), type: "jpeg", quality: 42 }).catch(() => {}); }
    console.log(`P${n}`, esiti.percorsi[n].ok ? 'ok' : 'NO', esiti.percorsi[n].errore || '', esiti.percorsi[n].inceppi.join(' | '));
    salva();
}

/** /login. Prima: scelta del ruolo e modulo con password. Dopo: email → codice (la password è una seconda strada). */
async function apriLogin(page) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/Unnivai|DoveVai/i.test(await page.title())) throw new Error('titolo non Unnivai');
    await attesa(page, 1200);
    return visibile(page.getByTestId('accesso-con-password'), 2500); // true = interfaccia nuova (codice)
}
async function alModuloVecchio(page, modo) {
    if (await visibile(page.getByText('Voglio Esplorare'), 1500)) await page.getByText('Voglio Esplorare').click();
    await attesa(page, 500);
    if (modo === 'entra') await clicca(page, [page.getByRole('button', { name: /^Accedi$/ })], 2500);
    else await clicca(page, [page.getByRole('button', { name: /^Registrati$/ })], 2500);
}
const invia = (page) => clicca(page, [page.getByTestId('accesso-invia'), page.locator('form button[type=submit]')]);
async function conPassword(page, email, password) {
    await campo(page, /Email/i).fill(email);
    await campo(page, /^Password$/i).fill(password);
    await invia(page);
}
/** Interfaccia nuova: email → codice. `codice` null = si ferma alla schermata del codice. */
async function conCodice(page, email, codice = '123456') {
    await campo(page, /Email/i).fill(email);
    await invia(page);
    await page.getByTestId('accesso-codice-campo').waitFor({ timeout: 8000 });
    if (codice === null) return;
    await page.getByTestId('accesso-codice-campo').fill(codice);
    await invia(page);
}
/** Entra con l'interfaccia che c'è (password prima, codice dopo). */
async function accedi(page, email, password) {
    const nuova = await apriLogin(page);
    if (nuova) await conCodice(page, email);
    else { await alModuloVecchio(page, 'entra'); await conPassword(page, email, password); }
}

/** Il primo ingresso: consenso, poi le domande; una schermata per passo; scelte fisse. Ritorna i passi visti. */
async function primoIngresso(page, pref) {
    const passi = [];
    for (let i = 0; i < 9; i++) {
        await attesa(page, 900);
        const url = new URL(page.url()).pathname;
        const consenso = await visibile(page.getByTestId('consenso-ai-ok'), 600);
        if (!/\/onboarding/.test(url) && !consenso) break;
        passi.push(await foto(page, `${pref}-${String(i + 1).padStart(2, '0')}`, consenso ? 'consenso AI' : `primo ingresso, passo ${i + 1}`));
        if (consenso) { await page.getByTestId('consenso-ai-ok').click(); continue; }
        for (const t of ['Storia e arte', 'Trattoria', 'Tranquillo', 'In coppia']) {
            const l = page.getByText(t, { exact: true });
            if (await l.first().isVisible().catch(() => false)) {
                const premuto = await l.first().evaluate((el) => el.closest('button')?.getAttribute('aria-pressed') === 'true' || el.closest('button')?.className.includes('ivory-bg'));
                if (!premuto) await l.first().click();
            }
        }
        const ok = await clicca(page, [page.getByTestId('primo-avanti'), 'Iniziamo!', 'Continua', 'Entra in Unnivai'], 3000);
        if (!ok) break;
    }
    return passi;
}
const dentro = async (page) => { await page.waitForURL((u) => /dashboard-user|\/onboarding/.test(u.pathname), { timeout: 20000 }); await attesa(page, 1500); };
const esci = async (ctx, page) => { await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^sb-/.test(k)) localStorage.removeItem(k); }); await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }); await attesa(page, 1200); };

let nuovo = null; // l'utente creato nel percorso 1, riusato da 5 e 6
const PW_NUOVO = 'Nuova2026ok';

await percorso(1, 'Utente nuovo con email', async (P) => {
    const { page, visti } = await telefono();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await attesa(page, 2500);
    await foto(page, 'p1-01-home', 'la home di chi non è dentro');
    const nuova = await apriLogin(page);
    P.interfaccia = nuova ? 'codice' : 'password';
    await foto(page, 'p1-02-login', 'la prima schermata di /login');
    const EMAIL = 'luca@prova.unnivai.it';
    if (nuova) {
        await campo(page, /Email/i).fill('luca@');
        await invia(page);
        await foto(page, 'p1-03-email-sbagliata', 'email scritta male');
        await conCodice(page, EMAIL, null);
        await foto(page, 'p1-04-codice', 'il codice di 6 cifre');
        await page.getByTestId('accesso-codice-campo').fill('000000');
        await invia(page);
        await foto(page, 'p1-05-codice-sbagliato', 'codice sbagliato o scaduto');
        const mail = srv.ultimaPosta('codice-conferma', EMAIL);
        if (!mail) { P.inceppi.push('nessuna email col codice'); return; }
        nuovo = srv.utenti.get(mail.id);
        await page.getByTestId('accesso-codice-campo').fill('123456');
        await invia(page);
    } else {
        await alModuloVecchio(page, 'crea');
        await foto(page, 'p1-03-modulo', 'il modulo di registrazione');
        await campo(page, /Nome Completo/i).fill('Luca');
        await campo(page, /Email/i).fill('luca@');
        await campo(page, /^Password$/i).fill('abc');
        await invia(page);
        await foto(page, 'p1-04-errori', 'email sbagliata e password debole');
        await campo(page, /Email/i).fill(esistente.email);
        await campo(page, /^Password$/i).fill(PW_NUOVO);
        await invia(page);
        await foto(page, 'p1-05-gia-registrata', 'email già registrata');
        await campo(page, /Email/i).fill(EMAIL);
        await invia(page);
        await foto(page, 'p1-06-controlla-posta', 'dopo «registrati»: controlla la posta');
        const mail = srv.ultimaPosta('conferma', EMAIL);
        if (!mail) { P.inceppi.push('nessuna email di conferma'); return; }
        nuovo = srv.utenti.get(mail.id);
        await apriLogin(page);
        await alModuloVecchio(page, 'entra');
        await conPassword(page, EMAIL, PW_NUOVO);
        await foto(page, 'p1-07-non-confermata', 'accesso prima di confermare l\'email');
        nuovo.confermato = true;
        const redirect = mail.redirect ? new URL(mail.redirect) : new URL(`${BASE}/login`);
        await page.goto('about:blank'); // il link si apre come pagina nuova (lo stesso indirizzo col solo # non ricarica)
        await page.goto(`${BASE}${redirect.pathname}${srv.frammento(nuovo, 'signup')}`, { waitUntil: 'domcontentloaded' });
    }
    await dentro(page);
    P.passi = await primoIngresso(page, 'p1-08-primo');
    await page.waitForURL((u) => /dashboard-user/.test(u.pathname), { timeout: 20000 }).catch(() => P.inceppi.push('non arriva alla home'));
    await attesa(page, 2500);
    await foto(page, 'p1-20-home', 'la home dopo il primo ingresso');
    if (await visibile(page.getByTestId('consenso-ai'), 1500)) P.inceppi.push('il consenso ricompare sulla home dopo il primo ingresso');
    P.seme = srv.preferenze.get(nuovo.id)?.onboarding_seed ?? null;
    P.meta = { consenso_ai: !!nuovo.meta.consenso_ai, primo_ingresso_fatto_at: nuovo.meta.primo_ingresso_fatto_at || null, password: !!nuovo.password };
    P.visti = [...new Set(visti)];
    if (!P.seme) P.inceppi.push('seme del primo ingresso non salvato sul server');
    // il Profilo mostra quello che ha detto: «Come giri»
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await attesa(page, 2500);
    await page.locator('[data-ritmo-compagnia]').first().scrollIntoViewIfNeeded().catch(() => {});
    await foto(page, 'p1-21-profilo', 'il Profilo: «Come giri» col punto di partenza');
});

await percorso(2, 'Accesso esistente', async (P) => {
    const { page, visti } = await telefono();
    const nuova = await apriLogin(page);
    if (nuova) {
        await foto(page, 'p2-01-accedi', 'accesso: email');
        await conCodice(page, esistente.email, null);
        await foto(page, 'p2-02-codice', 'il codice per entrare');
        await page.getByTestId('accesso-codice-campo').fill('123456');
        await invia(page);
        await dentro(page);
        await foto(page, 'p2-03-home', 'dentro: la home');
        // chi ha una password la usa ancora (nessun account bloccato), da un altro telefono
        const t2 = await telefono();
        await apriLogin(t2.page);
        await t2.page.getByTestId('accesso-con-password').click();
        await conPassword(t2.page, esistente.email, 'sbagliata1');
        await foto(t2.page, 'p2-04-password-sbagliata', 'con la password: sbagliata');
        await campo(t2.page, /^Password$/i).fill(PW_ESISTENTE);
        await invia(t2.page);
        await dentro(t2.page);
        await foto(t2.page, 'p2-05-home-password', 'con la password: dentro');
        visti.push(...t2.visti);
    } else {
        await alModuloVecchio(page, 'entra');
        await foto(page, 'p2-01-accedi', 'il modulo di accesso');
        await conPassword(page, esistente.email, 'sbagliata1');
        await foto(page, 'p2-02-password-sbagliata', 'password sbagliata');
        await campo(page, /^Password$/i).fill(PW_ESISTENTE);
        await invia(page);
        await dentro(page);
        await foto(page, 'p2-03-home', 'dentro: la home');
    }
    P.visti = [...new Set(visti)];
    if (P.visti.includes('/onboarding')) P.inceppi.push('primo ingresso mostrato a un utente che l\'ha già fatto');
});

await percorso(3, 'Password dimenticata', async (P) => {
    const { page, visti } = await telefono();
    await page.goto(`${BASE}/update-password`, { waitUntil: 'domcontentloaded' });
    await attesa(page, 2000);
    await foto(page, 'p3-01-link-scaduto', '/update-password senza un link valido');
    const nuova = await apriLogin(page);
    if (nuova) {
        await page.getByTestId('accesso-con-password').click();
        await page.getByTestId('accesso-dimenticata').click();
        await foto(page, 'p3-02-recupero', 'password dimenticata: si entra col codice');
        await conCodice(page, esistente.email, null);
        await foto(page, 'p3-03-codice', 'il codice al posto della password');
        await page.getByTestId('accesso-codice-campo').fill('123456');
        await invia(page);
        await dentro(page);
        await foto(page, 'p3-04-dentro', 'dentro, senza password');
        // un vecchio link «reimposta la password» (mandato prima del cambio) funziona ancora
        await page.goto(`${BASE}/update-password${srv.frammento(esistente, 'recovery')}`, { waitUntil: 'domcontentloaded' });
    } else {
        await alModuloVecchio(page, 'entra');
        await clicca(page, ['Password dimenticata?']);
        await foto(page, 'p3-02-recupero', 'password dimenticata');
        await campo(page, /email/i).fill('marta@');
        await clicca(page, [page.locator('form button[type=submit]')]);
        await foto(page, 'p3-03-email-sbagliata', 'email scritta male');
        await campo(page, /email/i).fill(esistente.email);
        await clicca(page, [page.locator('form button[type=submit]')]);
        await attesa(page, 800);
        await foto(page, 'p3-04-posta', 'link mandato');
        const mail = srv.ultimaPosta('recupero', esistente.email);
        if (!mail) { P.inceppi.push('nessuna email di recupero'); return; }
        await page.goto(`${BASE}/update-password${srv.frammento(esistente, 'recovery')}`, { waitUntil: 'domcontentloaded' });
    }
    await attesa(page, 2500);
    await foto(page, 'p3-05-nuova-password', 'il link «reimposta la password»: nuova password');
    const pw = campo(page, /password/i);
    await pw.fill('abc');
    await invia(page);
    await foto(page, 'p3-06-debole', 'password debole');
    await pw.fill(PW_ESISTENTE);
    await invia(page);
    await foto(page, 'p3-07-uguale', 'la stessa password di prima');
    await pw.fill('Nuova2026ok');
    await invia(page);
    await page.waitForURL((u) => /dashboard-user|onboarding/.test(u.pathname), { timeout: 20000 }).catch(() => P.inceppi.push('dopo la nuova password non entra'));
    await attesa(page, 2500);
    await foto(page, 'p3-08-dentro', 'password cambiata: dentro');
    P.passwordCambiata = esistente.password === 'Nuova2026ok';
    esistente.password = PW_ESISTENTE; // per i percorsi dopo
    P.visti = [...new Set(visti)];
});

await percorso(4, 'Ospite che si registra a fine giro', async (P) => {
    const { page, visti } = await telefono();
    await apriLogin(page);
    await page.getByTestId('prova-senza-account').first().click();
    await dentro(page).catch(() => P.inceppi.push('il giro di prova non parte'));
    const anonimo = [...srv.utenti.values()].find((u) => u.anonimo);
    P.passi = await primoIngresso(page, 'p4-01-primo');
    await page.waitForURL((u) => /dashboard-user/.test(u.pathname), { timeout: 20000 }).catch(() => P.inceppi.push('non arriva alla home'));
    await attesa(page, 2500);
    await foto(page, 'p4-10-home-ospite', 'la home dell\'ospite');
    // il giro di prova finito: l'invito di FineGiro («Salva questo giro»), senza generare un giro (0 $)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('dvai:registrati', { detail: { momento: 'fine' } })));
    await foto(page, 'p4-11-invito', 'fine giro: «Salva questo giro»');
    await page.getByTestId('registrazione-email').fill(esistente.email);
    await page.getByTestId('registrazione-invia').click();
    await foto(page, 'p4-12-email-usata', 'email di un account che esiste già');
    await page.getByTestId('registrazione-email').fill('giulia@prova.unnivai.it');
    await page.getByTestId('registrazione-invia').click();
    await foto(page, 'p4-13-codice', 'il codice di 6 cifre');
    const conPw = await visibile(page.getByTestId('registrazione-password'), 800);
    await page.getByTestId('registrazione-codice').fill('000000');
    if (conPw) await page.getByTestId('registrazione-password').fill('Giulia2026ok');
    await page.getByTestId('registrazione-conferma').click();
    await foto(page, 'p4-14-codice-scaduto', 'codice scaduto');
    await page.getByTestId('registrazione-codice').fill('123456');
    await page.getByTestId('registrazione-conferma').click();
    await foto(page, 'p4-15-fatto', 'account creato');
    await clicca(page, [page.getByTestId('registrazione-profilo')]);
    await attesa(page, 2500);
    await foto(page, 'p4-16-profilo', 'il Profilo dopo la registrazione');
    P.stessoId = !!anonimo && anonimo.email === 'giulia@prova.unnivai.it' && !anonimo.anonimo;
    P.seme = anonimo ? srv.preferenze.get(anonimo.id)?.onboarding_seed ?? null : null;
    P.primoIngressoMeta = anonimo?.meta?.primo_ingresso_fatto_at || null;
    if (!P.stessoId) P.inceppi.push('l\'account non è lo stesso dell\'ospite');
    // rientro dal telefono di un amico: il primo ingresso non torna
    const t2 = await telefono();
    await accedi(t2.page, 'giulia@prova.unnivai.it', 'Giulia2026ok');
    await dentro(t2.page);
    await foto(t2.page, 'p4-17-altro-telefono', 'la stessa persona da un altro telefono');
    if (t2.visti.includes('/onboarding')) P.inceppi.push('primo ingresso ripetuto dopo la registrazione da ospite');
    P.visti = [...new Set(visti)];
});

await percorso(5, 'Secondo accesso dello stesso utente', async (P) => {
    if (!nuovo) throw new Error('serve il percorso 1');
    const { ctx, page, visti } = await telefono();
    await accedi(page, nuovo.email, PW_NUOVO);
    await dentro(page);
    await foto(page, 'p5-01-primo-accesso', 'primo accesso su questo telefono');
    await primoIngresso(page, 'p5-02-primo');
    await esci(ctx, page);
    await accedi(page, nuovo.email, PW_NUOVO);
    await dentro(page);
    await foto(page, 'p5-03-secondo-accesso', 'secondo accesso: dritto alla home');
    P.visti = [...new Set(visti)];
    if (visti.includes('/onboarding')) P.inceppi.push('primo ingresso ripetuto al secondo accesso');
});

await percorso(6, 'Accesso da un secondo dispositivo', async (P) => {
    if (!nuovo) throw new Error('serve il percorso 1');
    const { page, visti } = await telefono();
    await accedi(page, nuovo.email, PW_NUOVO);
    await dentro(page);
    await attesa(page, 1500);
    await foto(page, 'p6-01-secondo-telefono', 'un altro telefono, stesso account');
    const consenso = await visibile(page.getByTestId('consenso-ai'), 1500);
    P.visti = [...new Set(visti)];
    if (visti.includes('/onboarding')) P.inceppi.push('primo ingresso ripetuto sul secondo telefono');
    if (consenso) P.inceppi.push('consenso richiesto di nuovo sul secondo telefono');
    // il caricamento: sessione scaduta, rinnovo lento
    const s = JSON.parse(await page.evaluate(() => localStorage.getItem(Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k)))));
    s.expires_at = Math.floor(Date.now() / 1000) - 10;
    await page.evaluate((v) => localStorage.setItem(Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k)), v), JSON.stringify(s));
    srv.ritardo = 4000;
    page.goto(`${BASE}/`, { waitUntil: 'commit' }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, 'p6-02-caricamento.jpg'), type: 'jpeg', quality: 42 });
    P.schermate.push({ nome: 'p6-02-caricamento', didascalia: 'la schermata di caricamento', url: '/' });
    srv.ritardo = 0;
    await attesa(page, 4000);
});

esiti.finito = new Date().toISOString();
esiti.posta = srv.posta.map(({ tipo, a }) => ({ tipo, a }));
salva();
await browser.close();
console.log('esiti in', path.relative(process.cwd(), path.join(OUT, 'esiti.json')));
