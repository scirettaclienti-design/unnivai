/**
 * NAV-1-FIX — la barra di navigazione: D4 (sfondo leggibile) e «Apri in Mappe» per la tappa corrente.
 * D4 è rosso su main 5b82249: la classe di sfondo `bg-obsidian-card/95` non produce CSS (il colore è una var()).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import NavigationHUD from '@/components/Map/NavigationHUD';

const TAPPA = { id: 's2', name: 'Via Crociferi', latitude: 37.505, longitude: 15.085 };
const ROUTE = [{ id: 's1', name: 'Fontana', latitude: 37.5027, longitude: 15.0871 }, TAPPA];
const barra = (props = {}) => render(
    <NavigationHUD routeStats={null} activeRoute={ROUTE} completedSteps={['s1']} skippedSteps={[]} nextStop={TAPPA}
        onArrived={() => {}} onSkip={() => {}} onToggleVoice={() => {}} onEndNavigation={() => {}} {...props} />,
);

describe('D4 — la barra di navigazione ha uno sfondo e testi che si leggono', () => {
    // il selettore CSS della classe (Tailwind scrive «bg-x/95» come «.bg-x\\/95»), poi reso letterale per la RegExp
    const selettore = (c) => `.${c.replace(/[/[\]().:%]/g, (m) => `\\${m}`)}`;
    const letterale = (t) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    const produce = (css, c, proprieta) => new RegExp(`${letterale(selettore(c))}\\s*\\{[^}]*${proprieta}`).test(css);

    it('il riquadro ha uno sfondo, e ogni colore di sfondo o di testo dentro la barra produce CSS', async () => {
        // la barra con tutte le righe: istruzione, «km totali», voce spenta
        const { container } = barra({ voiceEnabled: false, routeStats: { distanceM: 5200, durationSec: 4920 },
            activeManeuver: { maneuver: 'turn-left', instructionHtml: 'Gira a <b>sinistra</b>' } });
        // il riquadro della barra: l'elemento con l'angolo da 22 px (Scala Ossidiana)
        const riquadro = container.querySelector('[class*="rounded-[22px]"]');
        expect(riquadro).toBeTruthy();
        const { css } = await postcss([tailwind('./tailwind.config.js')]).process('@tailwind utilities;', { from: undefined });
        const sfondi = [...riquadro.classList].filter(c => /^bg-/.test(c));
        expect(sfondi.length).toBeGreaterThan(0);
        for (const c of sfondi) expect(produce(css, c, 'background-color'), `la classe ${c} non produce uno sfondo`).toBe(true);
        const colori = new Set();
        for (const el of [riquadro, ...riquadro.querySelectorAll('*')]) {
            for (const c of el.classList || []) if (/^(bg|text)-(obsidian|brand|status)-/.test(c)) colori.add(c);
        }
        expect(colori.size).toBeGreaterThan(3);
        for (const c of colori) {
            expect(produce(css, c, c.startsWith('bg-') ? 'background-color' : 'color'), `la classe ${c} non produce un colore`).toBe(true);
        }
    }, 30_000);
});

describe('NAV-2 — niente «Apri in Mappe»: l\'utente resta in Unnivai', () => {
    it('nella barra non c\'è nessun link verso un\'altra app, nemmeno con un avviso sul percorso', () => {
        barra({ avviso: { tipo: 'percorso', testo: 'Non riesco a calcolare il percorso fin qui. Intanto segui la mappa o passa alla tappa dopo.' } });
        expect(screen.queryByText(/Apri in Mappe/i)).toBeNull();
        expect(document.querySelector('[data-testid="nav-apri-mappe"]')).toBeNull();
        expect(document.querySelectorAll('a[href]').length).toBe(0);
    });
    it('anche passando un `mappeUrl` (vecchio chiamante) il tasto non esce', () => {
        barra({ mappeUrl: 'https://maps.apple.com/?daddr=37.505,15.085&dirflg=w' });
        expect(screen.queryByText(/Apri in Mappe/i)).toBeNull();
        expect(document.querySelectorAll('a[href]').length).toBe(0);
    });
});
