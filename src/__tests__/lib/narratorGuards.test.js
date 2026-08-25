/**
 * Gate NARRATORE ANCORATO — DIFF 4 FASE A: gli invarianti verificabili.
 *
 * L'output di un modello NON è deterministico: "la description è buona" non è
 * un test. Questi sono i TRE invarianti che valgono per QUALSIASI output valido.
 * Due candidati sono stati scartati in FASE 0 e restano fuori di proposito:
 *   · lessico food su POI non-food → è una BLOCKLIST (lezione #19) e produce
 *     falsi positivi su testo vero (un museo con caffetteria);
 *   · description quasi-uguali → richiede una soglia di similarità da tarare,
 *     cioè la prossima skip:true.
 *
 * Metà di questi test verifica che il guard NON scatti. È la metà che tiene il
 * test vivo: un test che fallisce a caso viene disattivato in due settimane.
 */
import { describe, it, expect } from 'vitest';
import { findViolations, findTourViolations } from '../../lib/narratorGuards';

const stop = (campi) => ({ title: 'Basilica di Santa Maria delle Grazie', ...campi });
const campi = (v) => v.map(x => x.campo);
const invarianti = (v) => v.map(x => x.invariante);

describe('FASE A — invariante 1: nessun orario affermato', () => {
    it('rileva "alle 19 la luce entra dalla vetrata"', () => {
        const v = findViolations(stop({ bestTime: 'alle 19 la luce entra dalla vetrata' }));
        expect(v.length).toBeGreaterThan(0);
        expect(invarianti(v)).toContain('no-orario-affermato');
        expect(campi(v)).toContain('bestTime');
    });

    it('rileva "il locale chiude alle 22:30"', () => {
        const v = findViolations(stop({ insiderTip: 'il locale chiude alle 22:30' }));
        expect(invarianti(v)).toContain('no-orario-affermato');
    });

    it('rileva un orario in description e in transition, non solo nei campi "temporali"', () => {
        expect(invarianti(findViolations(stop({ description: 'Apre alle 7 ogni mattina' })))).toContain('no-orario-affermato');
        expect(invarianti(findViolations(stop({ transition: 'passi davanti al bar che chiude alle 20' })))).toContain('no-orario-affermato');
    });

    it("riporta l'estratto, non solo il campo: serve a capire cosa ha fatto scattare", () => {
        const v = findViolations(stop({ bestTime: 'alle 19 la luce entra dalla vetrata' }));
        expect(v[0].estratto).toContain('alle 19');
    });
});

describe('FASE A — invariante 2: nessun riferimento al presente', () => {
    it('rileva "Adesso il locale è pieno di vita"', () => {
        const v = findViolations(stop({ description: 'Adesso il locale è pieno di vita' }));
        expect(invarianti(v)).toContain('no-presente-affermato');
    });

    it('rileva "ora" come parola isolata', () => {
        expect(invarianti(findViolations(stop({ transition: 'Ora le luci dei bar si accendono' })))).toContain('no-presente-affermato');
    });

    it('rileva "in questo momento"', () => {
        expect(invarianti(findViolations(stop({ insiderTip: 'in questo momento è quasi vuoto' })))).toContain('no-presente-affermato');
    });
});

describe('FASE A — invariante 3: nessuna description duplicata nel tour', () => {
    it('rileva due stop con la stessa description', () => {
        const v = findTourViolations([
            stop({ description: 'Il pavimento è consumato dai passi' }),
            stop({ title: 'Altro POI', description: 'Il pavimento è consumato dai passi' }),
        ]);
        expect(invarianti(v)).toContain('no-description-duplicata');
    });

    it('rileva il duplicato anche con maiuscole e spazi diversi', () => {
        const v = findTourViolations([
            stop({ description: 'Il pavimento è consumato' }),
            stop({ title: 'Altro', description: '  IL PAVIMENTO   È CONSUMATO  ' }),
        ]);
        expect(v.length).toBeGreaterThan(0);
    });

    it('indica QUALE stop è il duplicato, non solo che ce n\'è uno', () => {
        const v = findTourViolations([
            stop({ description: 'A' }),
            stop({ title: 'Secondo', description: 'B' }),
            stop({ title: 'Terzo', description: 'A' }),
        ]);
        const dup = v.find(x => x.invariante === 'no-description-duplicata');
        expect(dup.indice).toBe(2);
    });
});

describe('FASE A — i falsi positivi noti, che DEVONO passare', () => {
    // Senza word-boundary la misura in FASE 0 dava 3 falsi positivi su 6.
    it('"Il pavimento è ancora consumato" non è un riferimento al presente', () => {
        expect(findViolations(stop({ description: 'Il pavimento è ancora consumato' }))).toHaveLength(0);
    });

    it('"Una vetrata sonora" non è un riferimento al presente', () => {
        expect(findViolations(stop({ description: 'Una vetrata sonora' }))).toHaveLength(0);
    });

    it('"Si lavora il vetro a mano" non è un riferimento al presente', () => {
        expect(findViolations(stop({ insiderTip: 'Si lavora il vetro a mano' }))).toHaveLength(0);
    });

    it('"Il profumo del mare si mescola" non è un giorno della settimana', () => {
        // il caso \bmar\b, gia' superato dalla regola di FASE A-bis
        expect(findViolations(stop({ description: 'Il profumo del mare si mescola' }))).toHaveLength(0);
    });

    it('un numero nel NOME del POI non è un orario', () => {
        expect(findViolations(stop({ title: 'Caffè 19', description: 'Il bancone è di marmo' }))).toHaveLength(0);
    });

    it('un numero senza preposizione non è un orario affermato', () => {
        expect(findViolations(stop({ description: 'Tre navate e 12 colonne' }))).toHaveLength(0);
    });

    it('i campi null non sono violazioni', () => {
        const v = findViolations(stop({ description: null, insiderTip: null, bestTime: null, transition: null }));
        expect(v).toHaveLength(0);
    });

    it('uno stop senza campi, o null, non esplode', () => {
        expect(findViolations(stop({}))).toHaveLength(0);
        expect(findViolations(null)).toHaveLength(0);
        expect(findTourViolations([])).toHaveLength(0);
        expect(findTourViolations(null)).toHaveLength(0);
    });

    it('description diverse non sono duplicate', () => {
        const v = findTourViolations([
            stop({ description: 'Il pavimento è consumato' }),
            stop({ title: 'Altro', description: 'La volta è affrescata' }),
        ]);
        expect(v).toHaveLength(0);
    });

    it('due stop entrambi senza description non sono un duplicato', () => {
        expect(findTourViolations([stop({}), stop({ title: 'Altro' })])).toHaveLength(0);
    });
});
