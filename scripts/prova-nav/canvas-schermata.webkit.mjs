/**
 * MAPPA-STILE — la schermata di un canvas «DoveVAI — Navigazione» (le due schermate sono HTML statico con SVG) a 390×844, in PNG.
 *   node scripts/prova-nav/canvas-schermata.webkit.mjs <file.dc.html> <uscita.png>
 * Si toglie solo il guscio `<x-dc>`/`<script>` del canvas: il contenuto della schermata non si tocca.
 */
import { webkit } from 'playwright';
import fs from 'node:fs';
const [, , sorgente, uscita] = process.argv;
const html = fs.readFileSync(sorgente, 'utf8')
    .replace(/<script[^>]*support\.js[^>]*><\/script>/g, '')
    .replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/g, '')
    .replace(/<\/?x-dc>/g, '')
    .replace(/<\/?helmet>/g, '');
const browser = await webkit.launch();
try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: uscita });
} finally { await browser.close(); }
