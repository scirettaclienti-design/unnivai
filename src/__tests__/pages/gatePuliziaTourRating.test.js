// Gate PULIZIA (24/09) — punti 2 e 3: il tour generato da QuickPath e
// SurpriseTour non ha piu' un rating fisso a 5.0.
//
// Prima: entrambi i wizard costruivano l'oggetto tour con `rating: 5.0`
// hardcoded, indipendentemente da qualunque dato reale. Un tour AI non ha
// recensioni: un voto sempre massimo non era un default onesto, era
// un'invenzione permanente sulla fonte di verita' dell'oggetto tour — a
// prescindere da quali componenti a valle lo mostrino oggi o in futuro.
//
// Il codice non espone una funzione pura per l'oggetto tourData (e' costruito
// dentro l'handler async del wizard): stesso principio di verifica gia' usato
// in questo repo per un'assenza di letterale nel sorgente (vedi
// intentPulito.test.js, F65 — "Evita se possibile" non deve piu' comparire).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = join(process.cwd(), 'src');
const readSrc = (rel) => readFileSync(join(SRC, rel), 'utf8');

// Righe di codice, senza i commenti (che citano `rating: 5.0` per spiegare
// cosa e' stato tolto, e farebbero un falso positivo su un match ingenuo).
const codeLinesOf = (rel) => readSrc(rel)
    .split('\n')
    .filter(line => {
        const t = line.trim();
        return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    });

describe('Gate PULIZIA — QuickPath.jsx non costruisce più un tour con rating:5.0', () => {
    it('nessuna riga di codice contiene "rating: 5.0" o "rating:5.0"', () => {
        const bad = codeLinesOf('pages/QuickPath.jsx').filter(l => /rating\s*:\s*5(\.0)?\b/.test(l));
        expect(bad).toEqual([]);
    });
});

describe('Gate PULIZIA — SurpriseTour.jsx non costruisce più un tour con rating:5.0', () => {
    it('nessuna riga di codice contiene "rating: 5.0" o "rating:5.0"', () => {
        const bad = codeLinesOf('pages/SurpriseTour.jsx').filter(l => /rating\s*:\s*5(\.0)?\b/.test(l));
        expect(bad).toEqual([]);
    });
});
