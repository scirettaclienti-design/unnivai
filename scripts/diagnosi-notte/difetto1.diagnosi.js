// DIAGNOSI-NOTTE — difetto 1: dopo mezzanotte almeno un flusso legge l'ora come mattina invece che come sera del giorno prima.
// Questi test descrivono il comportamento GIUSTO e su main FALLISCONO (di proposito, vedi vitest.config.js).
// La regola «dopo il tramonto» (Quiz) sta dentro `_generateItinerary`: la prova col motore vero e' replay-notte.mjs.
import { describe, it, expect } from 'vitest';
import { momentAtClock } from '@/lib/dayMoments';
import { isSeraStart } from '@/lib/daySkeleton';
import { cella, ORE } from './flussi.js';

const NOTTE = ORE.filter(o => ['00:30', '02:00', '04:30'].includes(o.etichetta));

describe('difetto 1 — la tabella dei momenti: dopo le 00:30 e fino all\'alba e\' ancora il dopocena di ieri', () => {
    it.each([[0, 30], [1, 45], [2, 0], [4, 30], [4, 59]])('momentAtClock(%i:%i) e\' il dopocena (isSeraStart dice sera fino alle 05:00)', (h, mi) => {
        const d = new Date(`2026-10-21T${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:00+02:00`);
        expect(isSeraStart(d), 'isSeraStart (daySkeleton) lo considera sera').toBe(true);
        expect(momentAtClock(h, mi).key).toBe('dopocena');
    });
    it('controllo: le 23:30 sono dopocena e le 09:30 mattina (la correzione non deve spostare il giorno)', () => {
        expect(momentAtClock(23, 30).key).toBe('dopocena');
        expect(momentAtClock(9, 30).key).toBe('mattina');
    });
});

describe('difetto 1 — Sorprendimi e Rigenera (nessun pathType): di notte il giro non e\' un giro di mattina', () => {
    for (const flusso of ['sorprendimi', 'rigenera']) {
        it.each(NOTTE.map(o => [o.etichetta, o.iso]))(`${flusso} alle %s: il primo momento e' un drink (bar o vita notturna), non la mattina`, (_e, iso) => {
            const c = cella(flusso, iso);
            expect(c.primo, `momenti: ${c.momenti.join(', ')}`).not.toBe('mattina');
            expect(['aperitivo', 'dopocena']).toContain(c.primo);
            expect(c.categoriePrimo.some(x => x === 'bar' || x === 'vita notturna')).toBe(true);
        });
    }
});
