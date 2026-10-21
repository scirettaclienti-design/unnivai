/**
 * ACCESSO-1 — prova dal vivo (WebKit di Playwright, profilo iPhone 13) su un sito pubblicato.
 *
 * Uso: ACCESSO_BASE=https://unnivai.vercel.app ACCESSO_FOTO=<cartella> node scripts/prova-accesso/accesso1.webkit.mjs
 * Controlla che il titolo contenga "DoveVai" PRIMA di qualunque credenziale; l'account di prova viene da
 * .env.local (TEST_ACCOUNT_EMAIL / TEST_ACCOUNT_PASSWORD), mai stampato. Non crea account, non invia email di recupero.
 * Passi: email non valida, credenziali errate, /update-password senza sessione, login, modifica del nome + ricarica
 * (poi lo rimette com'era), «Esci».
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.ACCESSO_BASE || 'https://unnivai.vercel.app';
const FOTO = process.env.ACCESSO_FOTO || null;
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));

// La mail dell'account di prova non entra negli screenshot: si copre prima di fotografare.
const foto = async (page, nome) => { if (FOTO) { fs.mkdirSync(FOTO, { recursive: true });
    await page.evaluate(() => { for (const el of document.querySelectorAll('p')) if (/@/.test(el.textContent) && el.children.length < 3) el.style.visibility = 'hidden'; }).catch(() => {}); await page.screenshot({ path: path.join(FOTO, nome + '.png') }); } };
const vede = async (page, t, timeout = 15000) => {
    try { await page.getByText(t, { exact: false }).first().waitFor({ state: 'visible', timeout }); return true; } catch { return false; }
};
const esiti = {};
const browser = await webkit.launch();
try {
    const c0 = await browser.newContext();
    const p0 = await c0.newPage();
    await p0.goto(BASE, { waitUntil: 'domcontentloaded' });
    const titolo = await p0.title();
    await c0.close();
    if (!/DoveVai/i.test(titolo)) throw new Error(`La pagina su ${BASE} non è DoveVai (titolo: ${titolo}): niente credenziali.`);
    esiti.titolo = titolo;

    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(() => { try { localStorage.setItem('user_city', 'Roma'); } catch { /* storage ko */ } });
    const page = await ctx.newPage();
    const richiesteAuth = [];
    page.on('request', r => { if (/\/auth\/v1\/(token|recover|signup)/.test(r.url())) richiesteAuth.push(r.url().split('/auth/v1/')[1].split('?')[0]); });

    // A. Email non valida → messaggio dell'app, nessuna richiesta a Supabase.
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai sulla pagina di accesso: niente credenziali.');
    await page.getByText('Voglio Esplorare').click();
    await page.getByText('Accedi', { exact: true }).first().click();
    await page.getByPlaceholder('Email').fill('mario@');
    await page.getByPlaceholder('Password').fill('x');
    await page.getByText('Accedi Ora').click();
    esiti.emailNonValida = await vede(page, 'Email non valida', 5000);
    esiti.emailNonValida_nessunaRichiesta = richiesteAuth.length === 0;
    await foto(page, '01-email-non-valida');

    // B. Credenziali errate (indirizzo inventato) → errore in italiano.
    await page.getByPlaceholder('Email').fill('nessuno.prova@example.com');
    await page.getByPlaceholder('Password').fill('Sbagliata1');
    await page.getByText('Accedi Ora').click();
    esiti.credenzialiErrate_italiano = await vede(page, 'Email o password non corrette.', 15000);
    esiti.credenzialiErrate_nessunInglese = !(await page.getByText('Invalid login credentials').count());
    await foto(page, '02-credenziali-errate');

    // C. /update-password senza sessione di recupero → «password dimenticata» col messaggio.
    await page.goto(`${BASE}/update-password`, { waitUntil: 'domcontentloaded' });
    esiti.updatePasswordSenzaSessione = await vede(page, 'Il link non è valido o è scaduto', 15000);
    esiti.updatePassword_url = new URL(page.url()).pathname + new URL(page.url()).search;
    esiti.updatePassword_modulo = await page.getByRole('button', { name: /Invia Link di Reset/ }).isVisible().catch(() => false);
    await foto(page, '03-update-password-senza-sessione');
    esiti.nessunaEmailInviata = !richiesteAuth.includes('recover');

    // D. Login con l'account di prova (password che il vecchio schema avrebbe potuto rifiutare: qui decide il server).
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Voglio Esplorare').click();
    await page.getByText('Accedi', { exact: true }).first().click();
    await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await page.getByText('Accedi Ora').click();
    await page.waitForURL(u => u.pathname.startsWith('/dashboard'), { timeout: 30000 });
    esiti.login = new URL(page.url()).pathname;
    await foto(page, '04-dopo-login');

    // E. Profilo: il nome si modifica, si salva e resta dopo la ricarica; poi lo rimette com'era.
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.getByText('Profilo', { exact: true }).last().click();
    await page.waitForURL(u => u.pathname === '/profile', { timeout: 20000 });
    await page.getByRole('button', { name: 'Modifica il nome' }).waitFor({ state: 'visible', timeout: 20000 });
    const originale = (await page.getByRole('heading', { level: 2 }).first().innerText()).trim();
    esiti.nomeOriginale = originale;
    const cambia = async (nome) => {
        await page.getByRole('button', { name: 'Modifica il nome' }).click();
        await page.getByRole('textbox', { name: 'Il tuo nome' }).fill(nome);
        await page.locator('form').getByRole('button', { name: 'Salva', exact: true }).click();
        await page.getByRole('heading', { level: 2, name: nome }).waitFor({ state: 'visible', timeout: 15000 });
    };
    await page.getByRole('button', { name: 'Modifica il nome' }).click();
    await foto(page, '05-profilo-nome-in-modifica');
    await page.getByRole('button', { name: 'Annulla' }).click();
    await cambia('ProvaAccesso');
    await foto(page, '06-profilo-nome-salvato');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Modifica il nome' }).waitFor({ state: 'visible', timeout: 20000 });
    esiti.nomeDopoRicarica = (await page.getByRole('heading', { level: 2 }).first().innerText()).trim();
    await foto(page, '07-profilo-dopo-ricarica');
    // L'account di prova può non avere un nome («Viaggiatore» è solo il ripiego a schermo): in quel caso non si può
    // tornare a «nessun nome» dall'interfaccia, e il nome resta quello provato.
    if (originale !== 'Viaggiatore') {
        await cambia(originale);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Modifica il nome' }).waitFor({ state: 'visible', timeout: 20000 });
        esiti.nomeRipristinato = (await page.getByRole('heading', { level: 2 }).first().innerText()).trim() === originale;
    } else {
        esiti.nomeRipristinato = 'impossibile: l\'account non aveva un nome';
    }

    // F. «Esci»: nome accessibile, e porta fuori.
    await page.goto(`${BASE}/dashboard-user`, { waitUntil: 'domcontentloaded' });
    const esci = page.getByRole('button', { name: 'Esci' });
    await esci.waitFor({ state: 'visible', timeout: 20000 });
    esiti.esci_nomeAccessibile = true;
    await foto(page, '08-esci-visibile');
    await esci.click();
    await page.waitForURL(u => u.pathname === '/', { timeout: 20000 });
    esiti.esci_url = new URL(page.url()).pathname;
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(u => u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {});
    esiti.dopoEsci_profilo = new URL(page.url()).pathname;
    await foto(page, '09-dopo-esci');
    esiti.richiesteAuth = [...new Set(richiesteAuth)];
    await ctx.close();
} catch (e) {
    esiti.errore = String(e.message || e).replaceAll(env.TEST_ACCOUNT_PASSWORD || '\u0000', '***').replaceAll(env.TEST_ACCOUNT_EMAIL || '\u0000', '***');
    process.exitCode = 1;
} finally {
    await browser.close();
}
console.log(JSON.stringify(esiti, null, 2));
