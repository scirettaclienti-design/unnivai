// BANCO-DIFETTI (T19, D2) — una proposta «per dopo» di Per Te si misura dal prossimo mattino (9:30), come la compone il motore.
// Il caso c-catania (11:30): il tour «insider» per domattina metteva Palazzo dei Chierici alle 12:33 di oggi (chiude alle 13:00);
// il motore lo aveva verificato per le 10:33 di domani (aperto 08:00–13:00).
import { describe, it, expect } from 'vitest';
import { inizioTourPerTe } from '../../../scripts/banco/giro-caso.js';

describe('banco — gli arrivi di Per Te', () => {
    const adesso = new Date('2026-11-05T11:30:00+01:00');
    it('un tour per adesso parte da adesso', () => {
        expect(inizioTourPerTe({ themeType: 'insider' }, adesso).toISOString()).toBe(adesso.toISOString());
    });
    it('una proposta per dopo parte alle 9:30 di domani', () => {
        expect(inizioTourPerTe({ themeType: 'insider', perDopo: { quando: 'domattina' } }, adesso).toISOString()).toBe('2026-11-06T08:30:00.000Z');
    });
    it('alle 2 di notte la proposta per dopo parte alle 9:30 di stamattina', () => {
        expect(inizioTourPerTe({ perDopo: { quando: 'stamattina' } }, new Date('2026-11-05T02:00:00+01:00')).toISOString()).toBe('2026-11-05T08:30:00.000Z');
    });
});
