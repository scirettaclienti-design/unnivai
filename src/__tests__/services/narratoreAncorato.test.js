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

    it('DIFF 3 chiuso: l\'orario inventato non e\' piu\' un esempio ✓', () => {
        // Era registrato come limite noto del DIFF 1 e ora e' INVERTITO, non
        // cancellato: "Alle 17 la luce entra dalla vetrata sud" era l'esempio ✓
        // che premiava un orario specifico senza alcun dato di orario nel prompt.
        // Resta nel testo come ✗ — i controesempi non vengono imitati (lezione #27).
        const p = prompt();
        expect(p).toContain('← orario inventato');
        expect(p).not.toMatch(/✓ "Alle 17 la luce entra/);
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

describe('Gate NARRATORE ANCORATO DIFF 3 — nessun orario inventato, nessuno stato di apertura', () => {
    it('controllo dello strumento: il sorgente letto e\' quello giusto', () => {
        const src = serviceCode();
        expect(src).toContain('buildSelectorSystemPrompt');
        expect(src).toContain('candidatesLite');
    });

    it('gli orari inventati del punto 9 legacy sono spariti', () => {
        const src = serviceCode();
        expect(src).not.toContain('I musei chiudono alle 19');
        expect(src).not.toContain('aprono alle');
        expect(src).not.toContain('chiudono alle');
    });

    it('resta l\'orario REALE del path notifiche: il marker non punisce chi rispetta la regola', () => {
        // :2066 e' un esempio con orario da closingTimeTodayHH vero, :2068 e' la
        // regola locked scritta bene. Un marker secco su "alle 19" li avrebbe
        // cancellati entrambi.
        const src = serviceCode();
        expect(src).toContain('chiude alle 19:00');
        expect(src).toContain('chiude oggi alle HH:MM');
    });

    it('nessun prompt ordina piu\' di dedurre se un posto e\' chiuso', () => {
        expect(serviceCode()).not.toContain('MAI suggerire posti chiusi ora');
    });

    it('tutti i prompt vietano di AFFERMARE stati di apertura', () => {
        const src = serviceCode();
        // due copie della regola (selettore + "Per Te") piu' il punto 9 legacy
        const occorrenze = src.split('NON AFFERMARE MAI se un posto è aperto o chiuso').length - 1;
        expect(occorrenze).toBe(3);
    });

    it('open_now non entra piu\' nel payload del selettore', () => {
        const src = serviceCode();
        expect(src).not.toContain('lite.open_now');
        // il prompt del selettore non deve nemmeno nominarlo
        expect(prompt()).not.toContain('open_now');
    });

    it('il path notifiche NON e\' stato toccato: li\' la gerarchia era gia\' corretta', () => {
        const src = serviceCode();
        expect(src).toContain('} else if (c.open_now === true) {');
        expect(src).toContain("bits.push('chiuso ora');");
    });

    it('bestTime ammette null quando non c\'e\' un motivo vero', () => {
        const p = prompt();
        expect(p).toContain('"bestTime": null');
        expect(p).toContain('un motivo inventato è peggio di un campo assente');
        expect(p).toContain('NON citare ore');
    });
});

describe('Gate NARRATORE ANCORATO F55 — non attribuire contenuti che non si sanno esistere', () => {
    it('controllo dello strumento: il prompt porta i types e non la categoria UI collassata', () => {
        // Causa A esclusa in FASE A: al modello arrivano i types Google, non
        // "CULTURA". Se questo cambiasse, la diagnosi andrebbe rifatta.
        const p = prompt();
        expect(p).toContain('museum');
        expect(p).toContain('restaurant');
        expect(p).not.toContain('CULTURA');
    });

    it('il divieto e\' presente in tutti e tre i prompt', () => {
        const src = serviceCode();
        const n = src.split('NON ATTRIBUIRE A UN POSTO CONTENUTI').length - 1;
        expect(n).toBe(3);
    });

    it('dichiara esplicitamente cosa il modello SA', () => {
        const p = prompt();
        expect(p).toContain('nome, "types", rating, numero di recensioni');
        expect(p).toContain('NON si deduce cosa c\'e\' dentro');
    });

    it('risolve la tensione specificita\'/verita\': fra generico e falso vince il generico', () => {
        const p = prompt();
        expect(p).toContain('COME SI RISOLVE LA TENSIONE');
        expect(p).toContain('VINCE IL GENERICO');
    });

    it('nessun esempio ✓ asserisce piu\' un contenuto del singolo luogo', () => {
        const p = prompt();
        // erano i quattro che violavano il divieto che li precede
        expect(p).not.toContain('La sala 3 ha una sola panca');
        expect(p).not.toContain('Il bancone è di zinco');
        expect(p).not.toContain('I platani sul lato ovest');
        expect(p).not.toContain('i mosaici non sono abbagliati');
    });

    it('l\'esempio chiesa che citava gli orari e\' passato da ✓ a ✗ (contraddiceva il DIFF 3)', () => {
        const p = prompt();
        expect(p).toContain('← ORARI che non hai');
        expect(p).not.toMatch(/✓ chiesa\s+— "Entra dalla porta laterale/);
    });

    it('le due frasi false viste su device sono ora contro-esempi espliciti', () => {
        const p = prompt();
        expect(p).toContain('artisti emergenti"  ← contenuto INVENTATO');
        expect(p).toContain('opere contemporanee esposte"  ← contenuto INVENTATO');
    });
});

describe('Gate NARRATORE ANCORATO F56 — transition non afferma cosa accade ORA', () => {
    it('il divieto temporale e\' su tutti e tre i prompt', () => {
        const src = serviceCode();
        const n = src.split('NON dire cosa sta accadendo ORA').length - 1;
        expect(n).toBe(3);
    });

    it('la frase vista su device e\' un contro-esempio', () => {
        expect(prompt()).toContain('Le luci dei bar si accendono lentamente"  ← cosa accade ORA');
    });

    it('resta la richiesta di descrivere cosa c\'e\'', () => {
        expect(prompt()).toContain("Descrivi cosa c'è, non cosa sta succedendo");
    });
});
