/**
 * nav-camera — N immagini in fila con didascalia (la sequenza panoramica → volo → cammino).
 *   node scripts/prova-nav/sequenza.webkit.mjs <uscita.png> <immagine1.png>::<didascalia> <immagine2.png>::<didascalia> …
 */
import { webkit } from 'playwright';
import fs from 'node:fs';
const [, , uscita, ...voci] = process.argv;
const url = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
const celle = voci.map(v => { const [f, d] = v.split('::'); return `<figure style="margin:0;width:230px"><img src="${url(f)}" style="width:230px;display:block;border-radius:10px"><figcaption style="padding-top:8px;font-size:13px;line-height:1.3;color:#eee">${d || ''}</figcaption></figure>`; }).join('');
const html = `<body style="margin:0;background:#111;font-family:system-ui"><div style="display:flex;gap:14px;padding:16px;align-items:flex-start;width:${voci.length * 244 + 32}px">${celle}</div></body>`;
const browser = await webkit.launch();
try {
    const page = await browser.newPage({ viewport: { width: voci.length * 244 + 32, height: 700 }, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: uscita, fullPage: true });
} finally { await browser.close(); }
