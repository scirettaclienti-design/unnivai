// Gate BARRA — la progress bar del Percorso Veloce deve avere 4 segmenti
// FISSI (le scelte reali: ambiente, attività, durata, gruppo), mai uno per
// ogni valore di `currentStep` (che arriva a 5: la generazione, che non è
// una scelta e non ha un segmento suo).
//
// Sintomo riportato: i segmenti sembravano passare da 5 a 4 a 3 a 2 avanzando
// negli step. Non ho trovato, nella storia del file, una versione in cui il
// numero di elementi renderizzati cambiasse davvero con `currentStep` — era
// sempre un array letterale fisso (`[1,2,3,4,5]`, prima `[1..6]`), quindi il
// DIFETTO MISURABILE e stabile non è "i segmenti spariscono", è che il totale
// era 5 invece di 4: un segmento per la generazione, che non è una scelta.
// Questo test fissa il numero corretto ed è quello che deve risultare rosso
// prima del fix (PROGRESS_STEPS non esiste ancora) e verde dopo.

import { describe, it, expect } from 'vitest';
import { PROGRESS_STEPS, effectiveProgressStep } from '@/lib/quickPathProgress';

describe('Gate BARRA — PROGRESS_STEPS è fisso a 4', () => {
    it('sono esattamente 4 segmenti, non 5 (currentStep arriva a 5, i segmenti no)', () => {
        expect(PROGRESS_STEPS).toHaveLength(4);
        expect(PROGRESS_STEPS).toEqual([1, 2, 3, 4]);
    });
});

describe('Gate BARRA — effectiveProgressStep: il conteggio non cresce oltre 4', () => {
    it('per i 4 step di scelta, il segmento corrente segue currentStep uno a uno', () => {
        expect(effectiveProgressStep(1)).toBe(1);
        expect(effectiveProgressStep(2)).toBe(2);
        expect(effectiveProgressStep(3)).toBe(3);
        expect(effectiveProgressStep(4)).toBe(4);
    });

    it('durante la generazione (currentStep 5) il quarto segmento resta il corrente — non un quinto inesistente', () => {
        expect(effectiveProgressStep(5)).toBe(4);
    });

    it('per ogni currentStep del wizard (1..5), il segmento effettivo è sempre uno dei 4 fissi', () => {
        for (let currentStep = 1; currentStep <= 5; currentStep++) {
            const effective = effectiveProgressStep(currentStep);
            expect(PROGRESS_STEPS).toContain(effective);
        }
    });
});
