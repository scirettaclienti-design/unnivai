import { describe, it, expect } from 'vitest';
import { extractPromptTags } from '@/lib/promptTags';

// Gate C2 — i tag estratti dal prompt libero devono conservare gli accenti.
//
// AiItinerary.jsx:705 costruiva i `tags` del tour cosi':
//     userPrompt.split(/\s+/).map(w => w.replace(/[^\w\s]/gi, ''))
//
// `\w` SENZA flag `u` e' ASCII-only: [A-Za-z0-9_]. Ogni lettera accentata
// finiva dentro la classe negata e veniva cancellata, in silenzio:
//     "citta'"  (con accento) -> "citt"
//     "perche'" (con accento) -> "perch"
//     "pero'"   (con accento) -> "per"
//     "e'" da solo            -> ""      (tag vuoto dentro la lista)
//
// Non e' cosmesi: questi tag vanno al matching dei business
// (getBusinessesByCityAndTags). Un tag mutilato non matcha niente, e un tag
// vuoto e' rumore che viaggia fino al normalizer del tour.
//
// Il fix usa una classe Unicode con flag `u` e tratta l'apostrofo da
// separatore (elisione italiana): vedi il commento esteso sulla funzione.
//
// La riga vive ora in src/lib/promptTags.js — funzione pura, file separato,
// test propri, come mapCenter / poiPhoto / narratorGuards / quickPathProgress.
// Il call site (AiItinerary) la importa e basta.

describe('Gate C2 — extractPromptTags conserva le lettere accentate', () => {
    it('"città" resta "città" (prima: "citt")', () => {
        expect(extractPromptTags('voglio vedere la città')).toContain('città');
    });

    it('"perché" resta "perché" (prima: "perch")', () => {
        expect(extractPromptTags('dimmi perché vale la pena')).toContain('perché');
    });

    it('"però" resta "però" (prima: "per")', () => {
        expect(extractPromptTags('mi piace però costa troppo')).toContain('però');
    });

    it('tutte le vocali accentate italiane sopravvivono, minuscole e maiuscole', () => {
        const tags = extractPromptTags('città caffè perché così più È À Ù');
        expect(tags).toEqual(['città', 'caffè', 'perché', 'così', 'più', 'È', 'À', 'Ù']);
    });

    it('nessun tag e\' una stringa vuota', () => {
        // "è" da solo diventava '' e restava in lista.
        const tags = extractPromptTags('è bello , . ! ? qui');
        expect(tags).not.toContain('');
        expect(tags).toContain('è');
        expect(tags).toContain('bello');
    });
});

describe('Gate C2 — extractPromptTags toglie ancora la punteggiatura', () => {
    it('virgole e punti spariscono dai tag', () => {
        expect(extractPromptTags('Roma, Milano. Napoli!')).toEqual(['Roma', 'Milano', 'Napoli']);
    });

    it('parentesi, trattini e due punti spariscono', () => {
        expect(extractPromptTags('(arte) mezza-giornata: musei')).toEqual(['arte', 'mezzagiornata', 'musei']);
    });

    it('i numeri restano (durate, orari, quantita\')', () => {
        expect(extractPromptTags('2 giorni a Roma')).toEqual(['2', 'giorni', 'a', 'Roma']);
    });
});

describe('Gate C2 — extractPromptTags: apostrofo come separatore di elisione', () => {
    // Decisione motivata: in italiano l'apostrofo e' quasi sempre un'elisione
    // ("un'esperienza", "l'arte", "dell'olio"), e il pezzo che vale come TAG e'
    // quello DOPO. Cancellandolo si otteneva "unesperienza", che non matcha
    // nulla; separando si ottiene "esperienza", che e' il tag utile.
    // La riga produce TAG per il matching, non conserva la frase originale.

    it('"un\'esperienza" produce "esperienza", non "unesperienza"', () => {
        const tags = extractPromptTags("cerco un'esperienza diversa");
        expect(tags).toContain('esperienza');
        expect(tags).not.toContain('unesperienza');
    });

    it('"l\'arte" produce "arte"', () => {
        expect(extractPromptTags("mi piace l'arte")).toContain('arte');
        expect(extractPromptTags("mi piace l'arte")).not.toContain('larte');
    });

    it('"dell\'olio" produce "olio"', () => {
        expect(extractPromptTags("il museo dell'olio")).toContain('olio');
    });

    it('"c\'è" produce "è" intatto, non lo cancella', () => {
        const tags = extractPromptTags("dimmi cosa c'è");
        expect(tags).toContain('è');
        expect(tags).not.toContain('');
    });

    it('l\'apostrofo tipografico (’) delle tastiere mobili si comporta uguale', () => {
        expect(extractPromptTags('cerco un’esperienza')).toContain('esperienza');
    });
});

describe('Gate C2 — extractPromptTags: input degenere', () => {
    it('prompt vuoto → lista vuota', () => {
        expect(extractPromptTags('')).toEqual([]);
    });

    it('null / undefined → lista vuota, nessuna eccezione', () => {
        expect(extractPromptTags(null)).toEqual([]);
        expect(extractPromptTags(undefined)).toEqual([]);
    });

    it('solo punteggiatura → lista vuota, non una lista di stringhe vuote', () => {
        expect(extractPromptTags('... ,,, !!!')).toEqual([]);
    });

    it('spazi ai bordi non producono tag vuoti', () => {
        expect(extractPromptTags('   Roma   ')).toEqual(['Roma']);
    });
});
