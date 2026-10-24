// GIRO-EDIT — la colazione parte da sola: un giro che comincia prima delle 10:30 inizia con una colazione vicina.
// Lo scheletro qui; il motore vero (rete finta) in pastiC8c.test.js, dove vive l'harness della colazione.
import { describe, it, expect } from 'vitest';
import { buildDaySkeleton } from '@/lib/daySkeleton';
import { resolveTourWindow } from '@/lib/tourWindow';

describe('colazione automatica — lo scheletro', () => {
    const sk = (ora, o = {}) => buildDaySkeleton({
        window: resolveTourWindow({ text: '', requestTime: new Date(ora), pathType: 'custom', duration: '' }), ...o,
    });
    const colazione = (s) => s.days[0].moments.find(m => m.colazione);
    it('alle 8:00 la mattina ha la colazione (una tappa in più) e parte alle 8:00', () => {
        const m = colazione(sk('2026-10-27T08:00:00+01:00', { colazioneAuto: true }));
        expect(m).toBeTruthy();
        expect(m.stops).toBeGreaterThanOrEqual(2);
        expect(m.start.toISOString()).toBe(new Date('2026-10-27T08:00:00+01:00').toISOString());
    });
    it('alle 10:29 sì, alle 10:30 e alle 11:00 no', () => {
        expect(colazione(sk('2026-10-27T10:29:00+01:00', { colazioneAuto: true }))).toBeTruthy();
        expect(colazione(sk('2026-10-27T10:30:00+01:00', { colazioneAuto: true }))).toBeFalsy();
        expect(colazione(sk('2026-10-27T11:00:00+01:00', { colazioneAuto: true }))).toBeFalsy();
    });
    it('senza il permesso del chiamante (niente bar, una categoria chiesta) non c\'è', () => {
        expect(colazione(sk('2026-10-27T08:00:00+01:00'))).toBeFalsy();
    });
    it('la colazione chiesta per nome vale come prima, fino alle 11:00', () => {
        const s = buildDaySkeleton({ window: resolveTourWindow({ text: 'una colazione', requestTime: new Date('2026-10-27T10:45:00+01:00'), pathType: 'custom', duration: '' }), text: 'una colazione' });
        expect(colazione(s)).toBeTruthy();
    });
});
