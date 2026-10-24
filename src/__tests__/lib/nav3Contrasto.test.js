// NAV-3 — il contrasto del testo della guida ≥ 4,5:1 (WCAG AA) sui fondi veri della Scala Ossidiana. I colori sono quelli di src/index.css.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { THEME } from '@/styles/themeTokens';

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
const v = (nome) => (css.match(new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`)) || [])[1];
const lum = (hex) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const rapporto = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const COL = { bg: v('obsidian-bg'), card: v('obsidian-card'), raised: v('obsidian-raised'), primario: v('text-primary'), secondario: v('text-secondary'), arancio: v('brand-orange'), errore: THEME.status.error, avviso: THEME.status.warning };

describe('contrasto ≥ 4,5:1 sulle coppie usate dalla guida', () => {
    const coppie = [
        ['testo primario su scheda', 'primario', 'card'], ['testo primario su fondo', 'primario', 'bg'], ['testo primario su sollevato', 'primario', 'raised'],
        ['testo secondario su scheda', 'secondario', 'card'], ['testo secondario su fondo', 'secondario', 'bg'], ['testo secondario su sollevato', 'secondario', 'raised'],
        ['etichette arancioni su scheda («PROSSIMA», «LA CHICCA»)', 'arancio', 'card'], ['etichette arancioni su fondo', 'arancio', 'bg'], ['etichette arancioni su sollevato', 'arancio', 'raised'],
        ['testo su tasto arancione («Voce», «Riparti»)', 'bg', 'arancio'],
        ['«Fine» (errore) su scheda', 'errore', 'card'],
    ];
    it('i colori si leggono dal CSS', () => { for (const k of Object.keys(COL)) expect(COL[k], k).toMatch(/^#[0-9a-fA-F]{6}$/); });
    for (const [nome, a, b] of coppie) {
        it(nome, () => { expect(rapporto(COL[a], COL[b])).toBeGreaterThanOrEqual(4.5); });
    }
});
