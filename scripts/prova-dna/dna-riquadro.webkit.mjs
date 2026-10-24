/**
 * DNA-RIQUADRO — prova dal vivo sul sito pubblicato (account di prova): il riquadro «Il tuo DNA esplorativo» di un giro di Crea
 * («domani un giorno a Catania con storia e cibo») e di un giro di Per Te (dettaglio). Righe lette dal DOM e screenshot del riquadro.
 *   node scripts/prova-dna/dna-riquadro.webkit.mjs <uscita.json>   (credenziali da .env.local, mai stampate)
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.PROVA_BASE || 'https://unnivai.vercel.app';
const leggi = (f) => (fs.existsSync(f) ? Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')])) : {});
const env = { ...leggi('.env'), ...leggi('.env.local') };
const OUT = 'docs/prove/schermate/dna-riquadro';
fs.mkdirSync(OUT, { recursive: true });
const [, , uscita] = process.argv;
const browser = await webkit.launch();
const esito = { crea: null, perTe: null };
const riquadro = async (page, nome) => {
    const box = page.getByTestId('dna-del-giro').first();
    if (!(await box.count())) return { presente: false, righe: [] };
    await box.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${nome}.png` });
    const righe = await page.locator('[data-dna-riga]').allInnerTexts();
    return { presente: true, righe, trattini: /—/.test(await box.innerText()) };
};
try {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'it-IT', timezoneId: 'Europe/Rome', geolocation: { latitude: 37.5023612, longitude: 15.0873718 }, permissions: ['geolocation'] });
    const page = await ctx.newPage();
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
    // Per Te: dalla home, la prima scheda
    await page.goto(`${BASE}/dashboard-user`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(15000);
    const link = page.locator('a[href^="/tour"]').first();
    if (await link.count()) {
        await link.click();
        await page.waitForTimeout(5000);
        esito.perTe = await riquadro(page, '03-per-te-dettaglio');
    } else esito.perTe = { presente: false, righe: [], nota: 'nessuna scheda di Per Te trovata nella home' };
    // Crea
    await page.goto(`${BASE}/ai-itinerary`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    for (let i = 0; i < 3; i++) { const b = page.getByText('Conferma Posizione'); if (await b.count().catch(() => 0)) await b.first().click().catch(() => {}); await page.waitForTimeout(1500); }
    const testo = page.locator('textarea').first();
    await testo.waitFor({ timeout: 20000 });
    await testo.fill('domani un giorno a Catania con storia e cibo');
    await page.getByText('Genera Viaggio').first().click();
    await page.locator('[data-stop-card]').first().waitFor({ timeout: 150000 });
    await page.waitForTimeout(4000);
    esito.crea = await riquadro(page, '04-crea');
    await ctx.close();
} finally {
    await browser.close();
    if (uscita) fs.writeFileSync(uscita, JSON.stringify(esito, null, 1));
}
console.log(JSON.stringify(esito));
