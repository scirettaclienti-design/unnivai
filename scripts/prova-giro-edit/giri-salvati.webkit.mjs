/**
 * GIRI-SALVATI — prova dal vivo sul sito pubblicato: genera un giro («domani un giorno a Catania»), lo salva, toglie una tappa, lo salva,
 * poi dal Profilo › Mete apre i giri salvati e confronta tappe e orari. WebKit iPhone 13, account di prova (credenziali solo da .env.local).
 *   node scripts/prova-giro-edit/giri-salvati.webkit.mjs <uscita.json>
 * Costo: UNA generazione (la riapertura non genera: si conta ogni richiesta ad openai-proxy / places-proxy DOPO il salvataggio).
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.PROVA_BASE || 'https://unnivai.vercel.app';
const leggi = (f) => (fs.existsSync(f) ? Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')])) : {});
const env = { ...leggi('.env'), ...leggi('.env.local') };
const CATANIA = { latitude: 37.5023612, longitude: 15.0873718 };
const [, , uscita] = process.argv;
const browser = await webkit.launch();
const esito = { fasi: {}, richiesteDopoSalvataggio: { openai: 0, places: 0, altre: [] }, console: [] };
const righe = async (page) => {
    const carte = page.locator('[data-stop-card]'); const n = await carte.count(); const out = [];
    for (let i = 0; i < n; i++) { const c = carte.nth(i); const libero = (await c.getAttribute('data-free-time')) !== null; out.push({ libero, righe: (await c.innerText()).split('\n').map(x => x.trim()).filter(Boolean).slice(0, 3) }); }
    return out;
};
const chiave = (tappe) => tappe.filter(t => !t.libero).map(t => `${t.righe[0]}|${t.righe[1]}`);
try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'it-IT', timezoneId: 'Europe/Rome', geolocation: CATANIA, permissions: ['geolocation'] });
    const page = await ctx.newPage();
    let contaDopo = false;
    page.on('request', (r) => {
        if (!contaDopo) return;
        const u = r.url();
        if (u.includes('/functions/v1/openai-proxy')) esito.richiesteDopoSalvataggio.openai += 1;
        else if (u.includes('/functions/v1/places-proxy')) esito.richiesteDopoSalvataggio.places += 1;
    });
    page.on('response', async (r) => { if (/rest\/v1\/saved_tours/.test(r.url()) && r.request().method() === 'POST') esito.console.push(`POST saved_tours → ${r.status()}`); });
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai: niente credenziali.');
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    if (!/DoveVai/i.test(await page.title())) throw new Error('Titolo non DoveVai al login: niente credenziali.');
    await page.getByText('Accedi →').click();
    await page.getByPlaceholder('Email').fill(env.TEST_ACCOUNT_EMAIL);
    await page.getByPlaceholder('Password').fill(env.TEST_ACCOUNT_PASSWORD);
    await page.getByText('Accedi Ora').click();
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await page.waitForTimeout(6000);
    await page.goto(`${BASE}/ai-itinerary`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    for (let i = 0; i < 3; i++) { const b = page.getByText('Conferma Posizione'); if (await b.count().catch(() => 0)) await b.first().click().catch(() => {}); await page.waitForTimeout(1500); }
    const testo = page.locator('textarea').first();
    await testo.waitFor({ timeout: 20000 });
    await testo.fill('domani un giorno a Catania');
    await page.getByText('Genera Viaggio').first().click();
    await page.locator('[data-stop-card]').first().waitFor({ timeout: 150000 });
    await page.waitForTimeout(4000);
    esito.fasi.generato = await righe(page);
    // 1) salva il giro com'e'
    await page.getByTestId('salva-giro').first().scrollIntoViewIfNeeded();
    await page.getByTestId('salva-giro').first().click();
    await page.getByText(/Giro salvato nel tuo Profilo|era già nel tuo Profilo/).first().waitFor({ timeout: 15000 });
    contaDopo = true; // da qui in poi nessuna generazione e nessuna ricerca
    esito.fasi.salvatoOriginale = chiave(esito.fasi.generato);
    // 2) toglie la terza tappa vera, salva di nuovo
    const togli = page.locator('[data-tappa-togli]').nth(2);
    await togli.scrollIntoViewIfNeeded();
    await togli.click();
    await page.waitForTimeout(1500);
    esito.fasi.modificato = await righe(page);
    await page.getByTestId('salva-giro').first().scrollIntoViewIfNeeded();
    // il tasto torna «Salva il giro» perche' il giro e' cambiato? Il componente tiene lo stato: si ricarica il tasto se serve
    const stato = await page.getByTestId('salva-giro').first().getAttribute('aria-pressed');
    esito.fasi.tastoDopoTogli = stato;
    if (stato === 'true') { esito.fasi.nota = 'il tasto resta «Salvato» dopo Togli: il giro modificato non si ri-salva da questa scheda'; }
    else {
        await page.getByTestId('salva-giro').first().click();
        await page.getByText(/Giro salvato nel tuo Profilo|era già nel tuo Profilo/).first().waitFor({ timeout: 15000 });
    }
    esito.fasi.salvatoModificato = chiave(esito.fasi.modificato);
    // 3) Profilo › Mete › giri salvati
    await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await page.getByText('Mete', { exact: true }).first().click();
    await page.getByTestId('giro-salvato-apri').first().waitFor({ timeout: 20000 });
    esito.fasi.carteProfilo = await page.getByTestId('giro-salvato').allInnerTexts();
    await page.screenshot({ path: 'docs/prove/schermate/2026-10-24-giri-salvati-profilo.png', fullPage: true });
    // la prima card e' il giro piu' recente (il modificato, o l'originale se il tasto non ha ri-salvato)
    await page.getByTestId('giro-salvato-apri').first().click();
    await page.getByText('Vedi mappa').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    esito.fasi.riapertoPiuRecente = await righe(page);
    esito.fasi.vedeMappa = await page.getByText('Vedi mappa').count();
    await page.screenshot({ path: 'docs/prove/schermate/2026-10-24-giri-salvati-riaperto.png' });
    // «Vedi mappa» porta alla mappa col giro
    await page.getByText('Vedi mappa').first().click();
    await page.waitForURL(u => u.pathname.startsWith('/map'), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(4000);
    esito.fasi.urlDopoVediMappa = new URL(page.url()).pathname;
    esito.fasi.confronto = {
        riapertoUgualeAlModificato: JSON.stringify(chiave(esito.fasi.riapertoPiuRecente)) === JSON.stringify(esito.fasi.salvatoModificato),
    };
    await ctx.close();
} finally {
    await browser.close();
    if (uscita) fs.writeFileSync(uscita, JSON.stringify(esito, null, 1));
}
console.log(JSON.stringify({ confronto: esito.fasi.confronto, dopoSalvataggio: esito.richiesteDopoSalvataggio, vedeMappa: esito.fasi.vedeMappa, url: esito.fasi.urlDopoVediMappa, nota: esito.fasi.nota }));
