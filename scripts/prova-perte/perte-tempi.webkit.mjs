/**
 * PER-TE-TRE (T27) — quanto ci mette la prima scheda di Per Te, iPhone 14 (WebKit), account di prova, Supabase vero, generazione vera.
 *
 *   PT_BASE=https://unnivai.vercel.app PT_ETICHETTA=prima PT_OUT=docs/prove/schermate/2026-11-07-per-te-tre \
 *     node scripts/prova-perte/perte-tempi.webkit.mjs
 *
 * Tre misure, dall'apertura della home alla prima scheda visibile:
 *   freddo    nessun Per Te salvato sul telefono: si genera
 *   cache     stessa chiave salvata: ricarica
 *   fascia    salvato della stessa fascia ma con un'altra chiave (il DNA ha cambiato gradino): prima skeleton fino alla fine della generazione
 * Le credenziali non si stampano. Prima di inserirle: il titolo della pagina (CLAUDE.md).
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.PT_BASE || '').replace(/\/$/, '');
if (!BASE) throw new Error('PT_BASE mancante');
const ETICHETTA = process.env.PT_ETICHETTA || 'prova';
const OUT = path.resolve(process.env.PT_OUT || 'docs/prove/schermate/2026-11-07-per-te-tre');
const VIEW = process.env.PT_LISTA === '1';
fs.mkdirSync(OUT, { recursive: true });
const env = {};
for (const r of fs.readFileSync('.env.local', 'utf8').split('\n')) { const m = r.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); }

const IPHONE = { ...devices['iPhone 14'], deviceScaleFactor: 2, locale: 'it-IT', timezoneId: 'Europe/Rome', permissions: ['geolocation'], geolocation: { latitude: 41.8986, longitude: 12.4769 } };
const browser = await webkit.launch();
const ctx = await browser.newContext(IPHONE);
const page = await ctx.newPage();
// la città dal GPS: Nominatim limita le richieste ripetute e senza città la home non parte (la query aspetta la città): risposta fissa
await page.route('**/nominatim.openstreetmap.org/**', (r) => r.fulfill({ json: { address: { city: 'Roma', country: 'Italia', country_code: 'it' }, display_name: 'Roma, Italia' } }));
const SCHEDA = 'a[href^="/tour-details/home-"]';
const esiti = { base: BASE, etichetta: ETICHETTA, ora: new Date().toISOString(), misure: {} };
const salva = () => fs.writeFileSync(path.join(OUT, `tempi-${ETICHETTA}.json`), JSON.stringify(esiti, null, 1));

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
if (!/Unnivai|DoveVai/i.test(await page.title())) throw new Error('titolo non Unnivai: niente credenziali');
await page.waitForTimeout(1200);
await page.getByTestId('accesso-con-password').click();
await page.getByPlaceholder(/Email/i).first().fill(env.TEST_ACCOUNT_EMAIL);
await page.getByPlaceholder(/^Password$/i).first().fill(env.TEST_ACCOUNT_PASSWORD);
await page.getByTestId('accesso-invia').click();
await page.waitForURL((u) => /dashboard-user|\/onboarding/.test(u.pathname), { timeout: 30000 });
try { const ok = page.getByTestId('consenso-ai-ok'); await ok.waitFor({ timeout: 4000 }); await ok.click(); } catch { /* già dato */ }
if (/onboarding/.test(page.url())) { console.log('onboarding: salto'); try { await page.getByText(/Salta per ora/).first().click({ timeout: 4000 }); } catch { /* */ } }

async function misura(nome, prepara) {
    await page.goto(`${BASE}/dashboard-user`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    if (prepara) await page.evaluate(prepara);
    const t0 = Date.now();
    await page.reload({ waitUntil: 'commit' });
    let ms = null;
    try { await page.locator(SCHEDA).first().waitFor({ state: 'visible', timeout: 75000 }); ms = Date.now() - t0; } catch { /* nessuna scheda */ }
    const schede = await page.locator(SCHEDA).count();
    esiti.misure[nome] = { ms, schede };
    console.log(`${nome}: ${ms} ms, ${schede} schede`);
    salva();
}
// il Per Te salvato e la cache del telefono: senza, si genera. `places` e `hometours` restano del giro prima: si tolgono.
const vuota = () => { for (const k of Object.keys(localStorage)) if (/per_te|hometours|insider|places|city_center/i.test(k)) localStorage.removeItem(k); };
const altraChiave = () => { const r = JSON.parse(localStorage.getItem('dvai_per_te_v2')); const c = JSON.parse(r.chiave); c[4] = 'f1:altro'; r.chiave = JSON.stringify(c); localStorage.setItem('dvai_per_te_v2', JSON.stringify(r)); };

await misura('freddo', vuota);
await page.waitForTimeout(1500);
await misura('cache', null);
await page.waitForTimeout(1500);
await misura('fascia', altraChiave);
await page.waitForTimeout(25000);
const chiudi = page.getByText('Conferma Posizione');
if (await chiudi.count()) { try { await chiudi.first().click({ timeout: 2000 }); } catch { /* */ } }
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, `home-${ETICHETTA}.jpg`), type: 'jpeg', quality: 60 });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, `home-per-te-${ETICHETTA}.jpg`), type: 'jpeg', quality: 60 });
if (VIEW) {
    await page.getByRole('link', { name: 'Vedi tutte' }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `vedi-tutte-${ETICHETTA}.jpg`), type: 'jpeg', quality: 60 });
    esiti.vediTutte = { url: new URL(page.url()).pathname, schede: await page.locator(SCHEDA).count() };
    salva();
}
await browser.close();
console.log(JSON.stringify(esiti));
