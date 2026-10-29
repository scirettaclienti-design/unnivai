import { describe, it, expect } from 'vitest';
import { dire, indicazioneSvolta, SOGLIE_SVOLTA, CURIOSITA } from '../../lib/vociTesti.js';

describe('vociTesti — tutti i testi della voce in un file', () => {
    it('le indicazioni di svolta sono frasi naturali e ricorrenti', () => {
        expect(dire('svolta50', { verso: 'a sinistra' })).toBe('Fra cinquanta metri gira a sinistra.');
        expect(dire('svolta100', { verso: 'a destra' })).toBe('Fra cento metri gira a destra.');
        expect(dire('svoltaOra', { verso: 'dritto' })).toBe('Adesso prosegui dritto.');
        expect(dire('svolta50', { verso: 'inversione a U' })).toBe('Fra cinquanta metri fai inversione.');
        expect(dire('prossimaTappa', { nome: 'Piazza Duomo' })).toBe('Si va verso Piazza Duomo.');
    });
    it('un verso sconosciuto non rompe: dritto', () => { expect(dire('svolta50', { verso: '???' })).toBe('Fra cinquanta metri prosegui dritto.'); });
    it('una lingua sconosciuta ricade sull\'italiano', () => { expect(dire('svoltaOra', { verso: 'a destra' }, 'xx')).toBe('Adesso gira a destra.'); });
    it('la soglia scatta nella sua finestra e in nessun\'altra', () => {
        expect(indicazioneSvolta(100)).toBe('svolta100');
        expect(indicazioneSvolta(50)).toBe('svolta50');
        expect(indicazioneSvolta(15)).toBe('svoltaOra');
        expect(indicazioneSvolta(70)).toBeNull();
        expect(indicazioneSvolta(300)).toBeNull();
        expect(indicazioneSvolta(null)).toBeNull();
    });
    it('le finestre non si sovrappongono', () => {
        for (let m = 0; m <= 200; m += 5) expect(SOGLIE_SVOLTA.filter(s => m <= s.finoAM && m >= s.daM).length).toBeLessThanOrEqual(1);
    });
    it('le curiosità portano la loro città (niente curiosità senza città) e nessuna è vuota', () => { expect(dire('curiosita')).toBeUndefined(); expect(CURIOSITA.length).toBeGreaterThan(0); for (const c of CURIOSITA) { expect(c.citta).toBeTruthy(); expect(c.testo.length).toBeGreaterThan(10); } });
});
