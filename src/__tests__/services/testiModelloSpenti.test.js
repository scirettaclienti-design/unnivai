// P3d-j (chiusura) — a schermo non resta nessun testo scritto dal modello sulle
// tappe: niente consigli (insiderTip), "momento migliore" (bestTime), passaggi
// (transition), e niente descrizioni di un tour AI che il codice non ha
// composto (caso reale: "propone opzioni vegetariane nel suo menu"). Vale per
// ogni sorgente che passa da normalizeTour, comprese le cache vecchie.

import { describe, it, expect } from 'vitest';
import { normalizeTour } from '../../services/tourShape';

const VECCHIA = {
    title: 'Osteria Romana', latitude: 41.9, longitude: 12.48, types: ['restaurant'],
    description: 'Propone opzioni vegetariane nel suo menu.',
    insiderTip: 'Chiedi il tavolo in fondo.', bestTime: 'Al tramonto la luce è perfetta.', transition: 'Si scende per una scala.',
};
const COMPOSTA = {
    title: 'Museo Barracco', latitude: 41.9, longitude: 12.47, types: ['museum'],
    description: 'Museo Barracco è la tappa da fare con calma.', _comp: { scelta: {} },
    insiderTip: 'Un consiglio rimasto.', transition: 'Un passaggio rimasto.',
};

describe('P3d-j (chiusura) — normalizeTour spegne i testi del modello sui tour AI', () => {
    it('cache vecchia: descrizione non composta, consiglio, momento, passaggio → non arrivano', () => {
        const t = normalizeTour({ isAiGenerated: true, city: 'Roma', steps: [VECCHIA, COMPOSTA] });
        expect(t.steps[0].description).toBe('');
        expect(t.steps[0].insiderTip).toBeNull();
        expect(t.steps[0].bestTime).toBeNull();
        expect(t.steps[0].transition).toBeNull();
        expect(t.itinerary[0].description).toBe('');
        // la frase composta dal codice resta, anche dopo una seconda normalizzazione
        expect(t.steps[1].description).toBe(COMPOSTA.description);
        const due = normalizeTour({ ...t, isAiGenerated: true });
        expect(due.steps[1].description).toBe(COMPOSTA.description);
        expect(due.steps[1].insiderTip).toBeNull();
    });

    it('un tour di una guida (non AI) resta com\'e\'', () => {
        const t = normalizeTour({ isAiGenerated: false, city: 'Roma', steps: [VECCHIA] });
        expect(t.steps[0].description).toBe(VECCHIA.description);
    });
});

describe('P3d-j (chiusura) — il dettaglio tour non ha piu\' i blocchi dei testi del modello', () => {
    it('TourDetails, AiItinerary e MapPage non leggono insiderTip/bestTime/transition', async () => {
        const { readFileSync } = await import('node:fs');
        const { resolve } = await import('node:path');
        for (const f of ['TourDetails.jsx', 'AiItinerary.jsx', 'MapPage.jsx']) {
            const src = readFileSync(resolve(__dirname, '..', '..', 'pages', f), 'utf8')
                .split('\n').filter(l => !/^\s*(\/\/|\*|\{\/\*)/.test(l.trim())).join('\n');
            expect(src, f).not.toMatch(/\.insiderTip|\.bestTime|\.transition\b/);
        }
    });
});
