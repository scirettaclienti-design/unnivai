import { describe, it, expect } from 'vitest';
import { sunTimes, eBuio } from '@/lib/sunTimes';
import { momentAtClock } from '@/lib/dayMoments';
import { isSeraStart, ALBA_MINUTES } from '@/lib/daySkeleton';

// NOTTE-FIX — la regola unica del buio: la natura «da fuori» sta fra l'alba e il tramonto veri della città,
// con alba e tramonto del giorno della finestra (dopo mezzanotte: il giorno nuovo).
const TROINA = { lat: 37.7823936, lng: 14.5949418 };
const sole = (y, m, d) => sunTimes({ y, m, d }, TROINA.lat, TROINA.lng);
const alle = (iso) => new Date(`${iso}+02:00`); // 21/10/2026: ora legale

describe('eBuio — Troina, 21 ottobre 2026 (alba 07:15, tramonto 18:17)', () => {
    const oggi = sole(2026, 10, 21);
    it('alba e tramonto sono quelli attesi', () => {
        const hm = (d) => d.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
        expect(hm(oggi.sunrise)).toBe('07:15');
        expect(hm(oggi.sunset)).toBe('18:17');
    });
    it.each(['00:30', '02:00', '04:30', '05:30', '07:00', '18:20', '23:30'])('alle %s e\' buio', (hm) => {
        expect(eBuio(alle(`2026-10-21T${hm}:00`), oggi)).toBe(true);
    });
    it.each(['07:20', '09:30', '12:00', '18:10'])('alle %s non e\' buio', (hm) => {
        expect(eBuio(alle(`2026-10-21T${hm}:00`), oggi)).toBe(false);
    });
    it('alle 05:30 (dopo la mattina presto, prima dell\'alba) niente natura da fuori: e\' buio, ma isSeraStart non e\' piu\' sera', () => {
        const d = alle('2026-10-21T05:30:00');
        expect(eBuio(d, oggi)).toBe(true);
        expect(isSeraStart(d)).toBe(false);
        expect(momentAtClock(5, 30).key).toBe('mattina');
    });
    it('senza alba o tramonto non e\' buio (mai una natura tolta per un dato mancante)', () => {
        expect(eBuio(alle('2026-10-21T02:00:00'), { sunrise: null, sunset: null })).toBe(false);
        expect(eBuio(NaN, oggi)).toBe(false);
    });
});

describe('dayMoments — una sola alba per la tabella', () => {
    it('il dopocena arriva fino alle 05:00 (la soglia di isSeraStart), poi e\' la mattina', () => {
        expect(ALBA_MINUTES).toBe(5 * 60);
        expect(momentAtClock(0, 30).key).toBe('dopocena');
        expect(momentAtClock(4, 59).key).toBe('dopocena');
        expect(momentAtClock(5, 0).key).toBe('mattina');
        expect(momentAtClock(23, 30).key).toBe('dopocena');
        expect(momentAtClock(9, 30).key).toBe('mattina');
    });
});
