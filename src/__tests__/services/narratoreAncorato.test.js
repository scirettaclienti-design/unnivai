/**
 * Gate NARRATORE ANCORATO — DIFF 1: il prompt non detta più ciò che il modello copiava.
 *
 * Diagnosi (device, Venezia 21/08): tre evidenze, una causa sola. Il narratore
 * NON pescava da pool — nessuna delle frasi osservate esiste nel sorgente — ma
 * IMITAVA GLI ESEMPI del prompt:
 *   · esempio ✓ di insiderTip = consiglio da bar  → tip food sul Guggenheim
 *   · esempio di titolo = "I vicoli segreti di X" → copiato su un tour Gastronomia
 *   · esempi ✓ di bestTime premiano un orario     → "Alle 19" inventato
 *
 * ONESTÀ SUL PERIMETRO: questi test ispezionano il PROMPT COSTRUITO, non
 * l'output del modello. L'output è non deterministico e NESSUN test può provare
 * che il narratore sia migliorato. Provano che il prompt non detta più il testo
 * che veniva copiato. La prova vera è un giro su device.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSelectorSystemPrompt } from '../../services/aiRecommendationService';

// Il letterale va cercato su TUTTO il file, non prompt per prompt: i tre prompt
// che lo contenevano erano il selettore, il titleHint del tema insider
// (buildUnifiedHomeToursPrompt, "Per Te") e il punto 12 del prompt legacy.
// Un marker sul sorgente prende anche una quarta porta che oggi non esiste.
// Le righe di commento si escludono: le note di gate CITANO cio' che e' stato
// rimosso e falserebbero il conteggio (lezione #26).
const serviceCode = () => readFileSync(
    resolve(__dirname, '..', '..', 'services', 'aiRecommendationService.js'), 'utf8',
).split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l.trim())).join('\n');

// Due candidati di TIPO DIVERSO: con un solo tipo, un prompt che ignora la
// categoria passerebbe lo stesso.
const MUSEO = {
    place_id: 'pid-museo',
    name: 'Collezione Peggy Guggenheim',
    rating: 4.6,
    user_ratings_total: 12000,
    types: ['museum', 'art_gallery', 'tourist_attraction'],
    address: 'Dorsoduro 701, Venezia',
    latitude: 45.4308,
    longitude: 12.3319,
};
const RISTORANTE = {
    place_id: 'pid-osteria',
    name: 'Osteria al Squero',
    rating: 4.5,
    user_ratings_total: 800,
    types: ['restaurant', 'food'],
    address: 'Dorsoduro 943, Venezia',
    latitude: 45.4312,
    longitude: 12.3265,
};

const prompt = () => buildSelectorSystemPrompt({
    city: 'Venezia',
    timeContext: 'notte — locali, jazz bar, piazze illuminate, passeggiate notturne',
    weather: { condition: 'Sereno', temperature: 18 },
    weatherIcon: '🌙',
    prefs: {},
    aiProfile: '',
    cityCenter: { latitude: 45.4341, longitude: 12.3388, isSmallTown: false, radiusKm: 10 },
    candidates: [MUSEO, RISTORANTE],
    userPrompt: '',
    intent: null,
});

describe('Gate NARRATORE ANCORATO DIFF 1 — il prompt del selettore', () => {
    it('controllo dello strumento: il prompt contiene davvero i candidati e i loro types', () => {
        // Prima di fidarsi di un `not.toContain`, provare che lo strumento
        // vedrebbe una presenza nota. Se questo fallisse, gli zero sotto non
        // proverebbero niente.
        const p = prompt();
        expect(p).toContain('Collezione Peggy Guggenheim');
        expect(p).toContain('Osteria al Squero');
        expect(p).toContain('museum');
        expect(p).toContain('restaurant');
    });

    it('non detta piu\' il titolo che veniva copiato alla lettera', () => {
        expect(prompt()).not.toContain('I vicoli segreti di');
    });

    it('il titolo deve derivare dalle tappe scelte, non da un modello', () => {
        const p = prompt();
        expect(p).toContain('nasce dalle TAPPE CHE HAI SCELTO');
        // deve restare vietata la forma piatta
        expect(p).toContain('Tour di ');
    });

    it('impone la coerenza fra la voce e il types del POI', () => {
        const p = prompt();
        expect(p).toContain('COERENZA COL TIPO');
        expect(p).toContain('rileggi il "types" di QUEL candidato');
    });

    it('ammette insiderTip null invece di un tip di un\'altra categoria', () => {
        const p = prompt();
        expect(p).toContain('"insiderTip": null');
        expect(p).toContain('Nessun consiglio è meglio di un consiglio di un\'altra');
    });

    it('gli esempi di tip coprono piu\' di una categoria, non solo il bar', () => {
        const p = prompt();
        for (const cat of ['museo/galleria', 'chiesa', 'ristorante/bar', 'parco/natura', 'panorama']) {
            expect(p).toContain(cat);
        }
    });

    it('dichiara che gli esempi mostrano il registro, non il contenuto da copiare', () => {
        const p = prompt();
        expect(p).toContain('mostrano il REGISTRO');
        expect(p).toContain('NON copiarli');
    });

    it('gli esempi ✗ restano: insegnano cosa evitare e non vengono imitati', () => {
        const p = prompt();
        expect(p).toContain('Chiesa barocca del XVIII secolo');
        expect(p).toContain('Consigliata visita mattutina');
    });

    it('DIFF 3, non ancora fatto: bestTime puo\' ancora affermare un orario', () => {
        // Registrato come limite noto. Quando il DIFF 3 chiudera' questo punto,
        // questa asserzione va invertita — non cancellata.
        expect(prompt()).toContain('Alle 17 la luce entra dalla vetrata sud');
    });
});

describe('Gate NARRATORE ANCORATO DIFF 1 — il titolo dettato, su TUTTI i prompt', () => {
    it('controllo dello strumento: il sorgente letto e\' quello giusto', () => {
        // Se questo fallisse, lo zero qui sotto non proverebbe niente.
        const src = serviceCode();
        expect(src).toContain('buildSelectorSystemPrompt');
        expect(src).toContain('buildUnifiedHomeToursPrompt');
        expect(src).toContain('titleHint');
    });

    it('"I vicoli segreti di" non compare in NESSUN prompt del file', () => {
        expect(serviceCode()).not.toContain('I vicoli segreti di');
    });

    it('anche gli altri due prompt derivano il titolo dalle tappe', () => {
        const src = serviceCode();
        // titleHint del tema insider (prompt "Per Te")
        expect(src).toContain('DERIVATO dalle tappe che hai scelto');
        // punto 12 del prompt legacy
        expect(src).toContain('Il TITOLO nasce dalle TAPPE CHE HAI SCELTO');
    });
});
