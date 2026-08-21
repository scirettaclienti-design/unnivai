/**
 * Gate VERITÀ VISIVA (F26) — DIFF 4: le catene di fallback.
 *
 * Decisione Ivano: copertine tour → gradient categoria (TourCover ramo B);
 * schede POI → nessuna immagine. Discriminante: sul POI l'immagine pretende
 * di essere QUEL posto, sulla copertina no.
 *
 * Ogni asserzione qui e' stata provata ROSSA sul codice pre-DIFF-4.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(__dirname, '..');
// Lo scanner di anti-fake.test.js salta le righe che iniziano con // * /* :
// qui si usa lo stesso criterio, altrimenti i commenti di gate — che CITANO
// le stringhe rimosse — farebbero passare o fallire per il motivo sbagliato.
const codeOf = (rel) => readFileSync(resolve(SRC, rel), 'utf8')
    .split('\n')
    .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l.trim()))
    .join('\n');

describe('F26 DIFF 4 — nessuno stock come copertina o come foto POI', () => {
    it('TourDetails non chiama piu\' getItemImage: la copertina passa da TourCover', () => {
        const src = codeOf('pages/TourDetails.jsx');
        expect(src).not.toContain('getItemImage');
        expect(src).not.toContain('imgOnError');
        expect(src).not.toContain('utils/imageUtils');
        expect(src).toContain('<TourCover');
    });

    it('l\'hero di PlaceDetailsView non monta un\'img senza ancoraggio Places', () => {
        const src = codeOf('pages/TourDetails.jsx');
        expect(src).toContain('isPlacesPhoto(place.images?.[0] || place.imageUrl)');
    });

    it('DashboardUser non ha piu\' la catena THEME -> CITY -> GENERIC', () => {
        const src = codeOf('pages/DashboardUser.jsx');
        expect(src).not.toContain('THEME_FALLBACK_IMAGES');
        expect(src).not.toContain('cityFallbackImg');
        expect(src).not.toContain('CITY_IMAGES');
        expect(src).not.toContain('GENERIC.piazza');
        expect(src).not.toContain('utils/imageUtils');
        expect(src).toContain('image: firstStop?.googlePhoto || null');
    });

    it('QuickPathSummary non ha uno stock di ripiego per la copertina', () => {
        const src = codeOf('components/Map/QuickPathSummary.jsx');
        expect(src).not.toContain('images.unsplash.com');
        expect(src).toContain('tourData.images?.[0] || null');
    });

    it('Explore non sostituisce una foto rotta con un placeholder testuale', () => {
        const src = codeOf('pages/Explore.jsx');
        expect(src).not.toContain('placehold.co');
    });

    it('dataService non inietta piu\' uno stock dentro un tour reale del DB', () => {
        const src = codeOf('services/dataService.js');
        expect(src).not.toContain('images.unsplash.com');
    });
});

describe('F26 DIFF 4 — lo strumento e la dichiarazione', () => {
    it('controllo dello strumento: il filtro trova una presenza NOTA', () => {
        // Prima di fidarsi di uno zero, provare che il grep vedrebbe un uno.
        expect(codeOf('pages/TourDetails.jsx')).toContain('TourCover');
        expect(codeOf('pages/Landing.jsx')).toContain('images.unsplash.com');
    });

    it('la nota su Landing.jsx in anti-fake dice il vero e nomina il motivo', () => {
        const raw = readFileSync(resolve(SRC, '__tests__/anti-fake.test.js'), 'utf8');
        // NOTA sull'assertion, imparata sbagliando: NON si puo' asserire
        // `not.toContain("la landing non ha piu' foto stock")`, perche' la
        // correzione CITA la frase vecchia per documentare cosa era falso.
        // Un grep non distingue una citazione da un'affermazione. Si asserisce
        // quindi sulla presenza della correzione e del motivo nominato.
        expect(raw).toContain('CORREZIONE F26 DIFF 4');
        expect(raw).toContain('ed era FALSO');
        expect(raw).toContain("'src/pages/Landing.jsx',");
        expect(raw).toContain("e' l'hero della landing");
    });
});
