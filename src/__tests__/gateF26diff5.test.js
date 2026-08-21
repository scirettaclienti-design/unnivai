/**
 * Gate VERITÀ VISIVA (F26) — DIFF 5: le due superfici VIVE.
 *
 * Perimetro: solo SurpriseTour e QuickPath. locationTourService,
 * AiItinerary/sampleItinerary, imageUtils.js e UnnivaiMap.old.jsx sono MORTI
 * (0 chunk nel bundle) e DashboardGuide e' SPENTO (dietro V1LockedGuard):
 * ripulirli sarebbe lavoro che sembra progresso. Vanno cancellati, non puliti,
 * e non qui.
 *
 * Ogni asserzione provata ROSSA sul codice pre-DIFF-5.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(__dirname, '..');
// Stesso criterio dello scanner di anti-fake.test.js: i commenti di gate
// CITANO le stringhe rimosse, e falserebbero il conteggio.
const codeOf = (rel) => readFileSync(resolve(SRC, rel), 'utf8')
    .split('\n')
    .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l.trim()))
    .join('\n');

describe('F26 DIFF 5 — nessuno stock nelle due superfici vive', () => {
    it('SurpriseTour: via CITY_IMAGES e getAdaptiveImage', () => {
        const src = codeOf('pages/SurpriseTour.jsx');
        expect(src).not.toContain('images.unsplash.com');
        expect(src).not.toContain('CITY_IMAGES');
        expect(src).not.toContain('getAdaptiveImage');
    });

    it('SurpriseTour: la copertina e\' la foto Places o niente', () => {
        const src = codeOf('pages/SurpriseTour.jsx');
        expect(src).toContain('const cover = stop0.googlePhoto || null;');
    });

    it('QuickPath: nessuna delle 26 opzioni del quiz porta piu\' un\'immagine', () => {
        const src = codeOf('pages/QuickPath.jsx');
        expect(src).not.toContain('images.unsplash.com');
    });

    it('QuickPath: il render senza immagine esisteva gia\' — nessun ridisegno', () => {
        // Il vincolo era "sostituire la sorgente, NON ridisegnare": si verifica
        // che il ramo alternativo (gradient di categoria + emoji) sia intatto.
        const src = codeOf('pages/QuickPath.jsx');
        expect(src).toContain('getCoverPalette(selectedOption, null).gradient');
        expect(src).toContain('{subOption.emoji}');
    });
});

describe('F26 DIFF 5 — controllo dello strumento', () => {
    it('il filtro trova una presenza NOTA prima che ci si fidi di uno zero', () => {
        // Landing.jsx e' l'eccezione dichiarata: se qui non trovasse l'Unsplash,
        // gli zero qui sopra non proverebbero niente.
        expect(codeOf('pages/Landing.jsx')).toContain('images.unsplash.com');
    });

    it('le superfici MORTE non sono state toccate: si cancellano, non si puliscono', () => {
        expect(codeOf('services/locationTourService.js')).toContain('images.unsplash.com');
        expect(codeOf('utils/imageUtils.js')).toContain('images.unsplash.com');
    });
});

describe('F26 DIFF 5 punto 3 — AiItinerary:814, codice vivo classificato male in FASE 0', () => {
    it('il waypoint di "Vedi su Mappa" non porta piu\' uno stock', () => {
        const src = codeOf('pages/AiItinerary.jsx');
        expect(src).toContain('image: s.photos?.[0] || null,');
        expect(src).not.toContain('photo-1552566626');
    });

    it('image: null e\' sicuro — i consumatori sono gia\' null-guarded', () => {
        // Nessun componente mappa legge .image dai waypoint; i due che lo
        // leggono passano da isPlacesPhoto, che su null ritorna false.
        for (const f of ['components/Map/POIDetailDrawer.jsx', 'components/Map/POIPopupCard.jsx']) {
            expect(codeOf(f)).toMatch(/isPlacesPhoto\(poi\??\.?image\)/);
        }
    });
});
