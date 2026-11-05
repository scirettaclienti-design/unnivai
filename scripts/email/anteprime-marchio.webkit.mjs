/**
 * ONBOARDING-ACCESSO — anteprime delle email di Unnivai e delle icone, per la galleria (docs/prove/onboarding-galleria.html).
 *   node --experimental-strip-types scripts/email/anteprime-marchio.webkit.mjs
 * WebKit, iPhone 14, tema chiaro e scuro (prefers-color-scheme). Le variabili di Supabase sono riempite con valori finti; il logo e il
 * carattere dei titoli, che in produzione stanno su https://unnivai.vercel.app/brand/… (dal merge della PR #50), qui li serve il repo
 * (public/brand/). Una prova in più: le stesse email con le immagini bloccate. Le icone: la Home di iOS e una barra di schede sono
 * RIPRODUZIONI (WebKit senza interfaccia non ha né Home né schede): mostrano i file veri alle misure vere.
 * Schermate in docs/prove/dati/onboarding/email/ (JPEG 600 px).
 */
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { MODELLI_AUTH, emailListaAttesa, emailRiepilogo, emailAvviso } from '../../supabase/functions/_shared/emailUnnivai.ts';

const OUT = path.resolve('docs/prove/dati/onboarding/email');
fs.mkdirSync(OUT, { recursive: true });
const VAR = {
    '{{ .Token }}': '482913', '{{ .Email }}': 'anna@esempio.it', '{{ .NewEmail }}': 'anna@esempio.it',
    '{{ .SiteURL }}': 'https://unnivai.vercel.app', '{{ .TokenHash }}': 'a1b2c3d4e5f6', '{{ .ConfirmationURL }}': 'https://unnivai.vercel.app/login#esempio',
};
const riempi = (h) => Object.entries(VAR).reduce((t, [k, v]) => t.split(k).join(v), h);
const EMAIL = [
    ['conferma', 'Conferma (account nuovo): codice e link', MODELLI_AUTH.confirmation.html],
    ['accesso', 'Accesso con codice (account che c\'è): codice e link', MODELLI_AUTH.magic_link.html],
    ['codice-ospite', 'Codice dell\'ospite che crea l\'account', MODELLI_AUTH.email_change.html],
    ['password', 'Reimposta la password (vecchi account)', MODELLI_AUTH.recovery.html],
    ['lista-attesa', 'Lista d\'attesa (unnivai.com)', emailListaAttesa({ email: 'anna@esempio.it', citta: 'Catania' }).html],
    ['riepilogo', 'Avvisi: riepilogo del giorno', emailRiepilogo({ giornoEtichetta: '5 novembre 2026', titolo: 'Ieri: 41 giri, 2,84 $', righe: [{ etichetta: 'Giri generati', valore: '41' }, { etichetta: 'Costo stimato', valore: '2,84 $' }, { etichetta: 'Errori del proxy', valore: '0,4%' }], note: ['Costo della voce non incluso.'] }).html],
    ['avviso', 'Avvisi: avviso immediato', emailAvviso({ titolo: 'Costo di oggi: 15,20 $', messaggio: 'Superata la soglia di 15 $ alle 18:40.', righe: [{ etichetta: 'Giri', valore: '212' }, { etichetta: 'Soglia', valore: '15 $' }] }).html],
];
const browser = await webkit.launch();
const esiti = [];
async function scatta(nome, html, schema, bloccate = false) {
    const ctx = await browser.newContext({ ...devices['iPhone 14'], deviceScaleFactor: 2, colorScheme: schema });
    await ctx.route(/https:\/\/unnivai\.vercel\.app\/brand\/(.+)$/, (r) => {
        if (bloccate) return r.abort();
        const f = path.resolve('public/brand', new URL(r.request().url()).pathname.replace(/^\/brand\//, ''));
        return r.fulfill({ path: f });
    });
    const page = await ctx.newPage();
    // immagini bloccate come in Gmail/Outlook: l'immagine non arriva e il client mostra il testo alternativo (qui: niente src)
    await page.setContent(bloccate ? riempi(html).replace(/ src="https:\/\/unnivai\.vercel\.app\/brand\/logo-email\.png"/, '') : riempi(html), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const file = path.join(OUT, `${nome}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 60, fullPage: true });
    await ctx.close();
    return path.basename(file);
}
for (const [id, titolo, html] of EMAIL) {
    esiti.push({ id, titolo, chiaro: await scatta(`${id}-chiaro`, html, 'light'), scuro: await scatta(`${id}-scuro`, html, 'dark') });
}
esiti.push({ id: 'senza-immagini', titolo: 'Accesso con le immagini bloccate: resta il nome in arancione', chiaro: await scatta('senza-immagini-chiaro', MODELLI_AUTH.magic_link.html, 'light', true), scuro: await scatta('senza-immagini-scuro', MODELLI_AUTH.magic_link.html, 'dark', true) });

// ─── icone: riproduzioni con i file veri ───
const img = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
const home = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
body{margin:0;height:100vh;background:linear-gradient(160deg,#2b3a55,#7a4b3a);font-family:-apple-system,sans-serif;color:#fff}
.griglia{display:grid;grid-template-columns:repeat(4,1fr);gap:26px 0;padding:70px 22px}.app{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px}
.icona{width:62px;height:62px;border-radius:14px;overflow:hidden;background:#444}.icona img{width:100%;height:100%;display:block}
.vuota{background:rgba(255,255,255,.25)}</style></head><body><div class="griglia">
${['Foto', 'Mappe', 'Meteo', 'Note', 'Unnivai', 'Musica', 'Posta', 'Orologio'].map((n) => `<div class="app"><div class="icona ${n === 'Unnivai' ? '' : 'vuota'}">${n === 'Unnivai' ? `<img src="${img('public/apple-touch-icon.png')}">` : ''}</div>${n}</div>`).join('')}
</div></body></html>`;
const schede = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
body{margin:0;background:#f2f2f7;font-family:-apple-system,sans-serif}.barra{display:flex;gap:6px;padding:10px;background:#dcdce1}
.scheda{display:flex;align-items:center;gap:8px;background:#fff;border-radius:8px;padding:8px 10px;font-size:13px;flex:1}.scheda img{width:16px;height:16px}
.grande{padding:20px;display:flex;gap:24px;align-items:end}.grande figure{margin:0;text-align:center;font-size:11px;color:#555}
.ios{width:120px;height:120px;border-radius:27px;overflow:hidden}.ios img,.mask img{width:100%;height:100%}.mask{width:96px;height:96px;border-radius:50%;overflow:hidden}
</style></head><body><div class="barra"><div class="scheda"><img src="${img('public/favicon-32.png')}">Unnivai | Esplora l'Italia…</div><div class="scheda" style="opacity:.6">Altra scheda</div></div>
<div class="grande"><figure><div class="ios"><img src="${img('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')}"></div>app iOS 1024</figure>
<figure><div class="mask"><img src="${img('public/icon-maskable-512.png')}"></div>maskable (cerchio)</figure>
<figure><img src="${img('public/favicon-32.png')}" style="width:32px;height:32px;image-rendering:pixelated"><br>favicon 32</figure></div></body></html>`;
for (const [nome, html] of [['icona-home', home], ['icona-favicon', schede]]) {
    const ctx = await browser.newContext({ ...devices['iPhone 14'], deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: path.join(OUT, `${nome}.jpg`), type: 'jpeg', quality: 60 });
    await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'esiti.json'), JSON.stringify(esiti, null, 1));
console.log(`${esiti.length * 2 + 2} anteprime in ${path.relative(process.cwd(), OUT)}`);
