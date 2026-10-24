/**
 * MAPPA-STILE — due immagini affiancate (canvas | app) con le loro didascalie, in un PNG.
 *   node scripts/prova-nav/affianca.webkit.mjs <canvas.png> <app.png> "<didascalia canvas>" "<didascalia app>" <uscita.png>
 */
import { webkit } from 'playwright';
import fs from 'node:fs';
const [, , a, b, da, db, uscita] = process.argv;
const url = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
const html = `<body style="margin:0;background:#111;font-family:system-ui;color:#eee"><div style="display:flex;gap:24px;padding:24px;align-items:flex-start">
${[[a, da], [b, db]].map(([f, d]) => `<figure style="margin:0;width:390px"><img src="${url(f)}" style="width:390px;display:block;border-radius:12px"><figcaption style="padding-top:10px;font-size:15px;line-height:1.35">${d}</figcaption></figure>`).join('')}
</div></body>`;
const browser = await webkit.launch();
try {
    const page = await browser.newPage({ viewport: { width: 860, height: 1000 }, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: uscita, fullPage: true });
} finally { await browser.close(); }
