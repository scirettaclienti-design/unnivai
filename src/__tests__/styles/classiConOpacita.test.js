/**
 * CLASSI-TRASPARENTI — ogni classe di colore con opacità usata in src (es. `bg-obsidian-card/95`) deve produrre CSS.
 * I colori sono variabili CSS (`var(--x)`): senza la funzione di `tailwind.config.js` Tailwind v3 non scriveva nulla.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import tailwind from 'tailwindcss';

const RADICE = path.resolve(__dirname, '../../..');
const file = (cartella) => fs.readdirSync(cartella, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(cartella, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : file(p);
    return /\.(jsx?|tsx?)$/.test(e.name) ? [p] : [];
});
const UTILITA = '(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|shadow|decoration|caret|accent)';
const CLASSE = new RegExp(`(?<![\\w-])((?:[a-z-]+:)*${UTILITA}-[a-z0-9-]+/(?:\\d+|\\[[\\d.]+\\]))(?![\\w/])`, 'g');
const esc = (c) => c.replace(/[:/[\].]/g, (m) => `\\${m}`);

describe('classi con opacità', () => {
    it('ogni classe `colore/NN` usata in src produce una regola CSS', async () => {
        const usate = new Set();
        for (const f of file(path.join(RADICE, 'src'))) {
            // i commenti non sono classi: Tailwind li scansiona ma qui non contano
            const codice = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
            for (const m of codice.matchAll(CLASSE)) usate.add(m[1]);
        }
        expect(usate.size).toBeGreaterThan(50);
        const { css } = await postcss([tailwind('./tailwind.config.js')]).process('@tailwind utilities;', { from: undefined });
        const mancanti = [...usate].filter((c) => !css.includes(`.${esc(c)}`) && !css.includes(`.${esc(c)}:`));
        expect(mancanti, `classi senza CSS: ${mancanti.join(', ')}`).toEqual([]);
    }, 60_000);

    it('un colore a variabile con opacità si mescola con trasparente, senza opacità resta la variabile', async () => {
        const { css } = await postcss([tailwind('./tailwind.config.js')]).process('@tailwind utilities;', { from: undefined });
        expect(css).toMatch(/\.bg-obsidian-card\\\/95\s*\{[^}]*color-mix\(in srgb,\s*var\(--obsidian-card\)\s*(?:95%|calc\(0\.95 \* 100%\))\s*,\s*transparent\)/);
        expect(css).toMatch(/\.bg-obsidian-card\s*\{[^}]*background-color:\s*var\(--obsidian-card\)/);
    }, 60_000);
});
