#!/usr/bin/env node
// EMAIL-LANCIO — anteprime delle quattro email in Playwright WebKit, viewport iPhone 14, in chiaro e in scuro.
// Le variabili di Supabase si sostituiscono con valori d'esempio; il logo arriva dal suo URL pubblico.
// Non spedisce niente.
//
//   node --experimental-strip-types scripts/email/anteprime.webkit.mjs
//
// Scrive docs/prove/schermate/email-lancio/<email>-<chiaro|scuro>.png.
// WebKit con prefers-color-scheme è il motore di Apple Mail, non Apple Mail: l'inversione automatica di
// Gmail e Outlook non si vede qui.
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { MODELLI_AUTH, emailListaAttesa } = await import(path.join(root, 'supabase/functions/_shared/emailUnnivai.ts'));
const OUT = path.join(root, 'docs/prove/schermate/email-lancio');
fs.mkdirSync(OUT, { recursive: true });

const ESEMPIO = {
    '{{ .ConfirmationURL }}': 'https://ahecpiwsdhghkndncejb.supabase.co/auth/v1/verify?token=pkce_8f3a2c1d9e&type=signup&redirect_to=https://unnivai.vercel.app/login',
    '{{ .SiteURL }}': 'https://unnivai.vercel.app',
    '{{ .TokenHash }}': 'a1b2c3d4e5f6',
    '{{ .Email }}': 'anna.rossi@example.com',
};
const riempi = (html) => Object.entries(ESEMPIO).reduce((h, [k, v]) => h.split(k).join(v), html);

const EMAIL = [
    ['conferma', riempi(MODELLI_AUTH.confirmation.html)],
    ['accesso', riempi(MODELLI_AUTH.magic_link.html)],
    ['password', riempi(MODELLI_AUTH.recovery.html)],
    ['lista-attesa', emailListaAttesa({ email: 'anna.rossi@example.com', citta: 'Bologna' }).html],
    ['lista-attesa-catania', emailListaAttesa({ email: 'anna.rossi@example.com', citta: 'Catania' }).html],
];

const browser = await webkit.launch();
try {
    for (const schema of ['light', 'dark']) {
        const ctx = await browser.newContext({ ...devices['iPhone 14'], colorScheme: schema });
        const page = await ctx.newPage();
        for (const [nome, html] of EMAIL) {
            await page.setContent(html, { waitUntil: 'load' });
            const logo = await page.evaluate(() => { const i = document.querySelector('img'); return i && i.complete && i.naturalWidth > 0; });
            if (!logo) throw new Error(`${nome}: il logo non si è caricato`);
            const file = path.join(OUT, `${nome}-${schema === 'light' ? 'chiaro' : 'scuro'}.png`);
            await page.screenshot({ path: file, fullPage: true });
            console.log(`${path.relative(root, file)}`);
        }
        await ctx.close();
    }
} finally {
    await browser.close();
}
