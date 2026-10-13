// ORARI — aperto per tutta la sosta, nel giorno vero, nel fuso del posto.
import { describe, it, expect } from 'vitest';
import { openStatus, localClock, periodsOf, OPEN, CLOSED, UNKNOWN, MESSAGGIO_CHIUSO } from '../../lib/openingHours';

// mercoledi' 14/10/2026 (CEST, +02:00)
const at = (hhmm, day = '2026-10-14') => new Date(`${day}T${hhmm}:00+02:00`);
const P = (day, open, close, closeDay = day) => ({ open: { day, time: open }, close: { day: closeDay, time: close } });
const tutti = (open, close) => [0, 1, 2, 3, 4, 5, 6].map(d => P(d, open, close));
const cand = (periods, extra = {}) => ({ place_id: 'x', openingPeriods: periods, ...extra });

describe('openStatus', () => {
    it('un posto che apre alle 18 proposto alle 9:30 e\' chiuso', () => {
        expect(openStatus(cand(tutti('1800', '2330')), at('09:30'), 30).stato).toBe(CLOSED);
    });
    it('una trattoria che apre alle 19 non va a pranzo alle 12:30; alle 19:30 si', () => {
        const trattoria = cand(tutti('1900', '2300'));
        expect(openStatus(trattoria, at('12:30'), 75).stato).toBe(CLOSED);
        expect(openStatus(trattoria, at('19:30'), 75).stato).toBe(OPEN);
    });
    it('una sosta che sfora la chiusura e\' chiusa, e dice a che ora chiude', () => {
        const museo = cand(tutti('0900', '1800'));
        expect(openStatus(museo, at('17:15'), 60)).toMatchObject({ stato: CLOSED, chiudeAlle: '18:00' }); // finirebbe alle 18:15
        expect(openStatus(museo, at('17:15'), 60).motivo).toMatch(/chiude alle 18:00/);
        expect(openStatus(museo, at('17:00'), 60).stato).toBe(OPEN);   // finisce alle 18:00 esatte: ancora aperto
        expect(openStatus(museo, at('17:00'), 30).stato).toBe(OPEN);
    });
    it('un museo chiuso il mercoledi\' non entra il mercoledi\' (ma il giovedi\' si)', () => {
        const senzaMercoledi = [0, 1, 2, 4, 5, 6].map(d => P(d, '1000', '1900')); // niente giorno 3
        expect(openStatus(cand(senzaMercoledi), at('11:00', '2026-10-14'), 60).stato).toBe(CLOSED);
        expect(openStatus(cand(senzaMercoledi), at('11:00', '2026-10-15'), 60).stato).toBe(OPEN);
    });
    it('orario sconosciuto: nessun periodo, nessun campo, ricerca vecchia — mai un errore', () => {
        expect(openStatus({ place_id: 'y' }, at('10:00'), 30).stato).toBe(UNKNOWN);
        expect(openStatus(cand([]), at('10:00'), 30).stato).toBe(UNKNOWN);
        expect(openStatus(null, at('10:00'), 30).stato).toBe(UNKNOWN);
        expect(openStatus(cand(tutti('1000', '1800')), null, 30).stato).toBe(UNKNOWN);
        expect(periodsOf({ opening_hours: { open_now: true } })).toBeNull(); // la legacy: solo open_now
    });
    it('due fasce (12–15 e 18–23): fra le due e\' chiuso, e una sosta non scavalca la pausa', () => {
        const spezzato = cand(tutti('1200', '1500').map((p, i) => p).concat(tutti('1800', '2300')));
        expect(openStatus(spezzato, at('13:00'), 75).stato).toBe(OPEN);
        expect(openStatus(spezzato, at('14:30'), 75).stato).toBe(CLOSED);   // chiude alle 15
        expect(openStatus(spezzato, at('16:00'), 30).stato).toBe(CLOSED);
        expect(openStatus(spezzato, at('19:00'), 75).stato).toBe(OPEN);
    });
    it('due periodi che si toccano valgono come uno (12–15 e 15–23)', () => {
        const unito = cand(tutti('1200', '1500').concat(tutti('1500', '2300')));
        expect(openStatus(unito, at('14:30'), 75).stato).toBe(OPEN);
    });
    it('chiude dopo la mezzanotte: il locale aperto fino alle 02:00 e\' aperto alle 00:30 del giorno dopo', () => {
        const notte = cand([0, 1, 2, 3, 4, 5, 6].map(d => P(d, '2000', '0200', (d + 1) % 7)));
        expect(openStatus(notte, at('23:30'), 20).stato).toBe(OPEN);
        expect(openStatus(notte, at('00:30', '2026-10-15'), 20).stato).toBe(OPEN);
        expect(openStatus(notte, at('02:30', '2026-10-15'), 20).stato).toBe(CLOSED);
    });
    it('sempre aperto (un periodo senza close) e\' aperto a qualunque ora', () => {
        expect(openStatus(cand([{ open: { day: 0, time: '0000' } }]), at('03:00'), 120).stato).toBe(OPEN);
    });
    it('domenica notte → lunedi\' (giro della settimana)', () => {
        const dom = cand([P(0, '2200', '0100', 1)]);
        expect(openStatus(dom, new Date('2026-10-19T00:30:00+02:00'), 15).stato).toBe(OPEN); // lunedi' 00:30
        expect(openStatus(dom, new Date('2026-10-19T02:00:00+02:00'), 15).stato).toBe(CLOSED);
    });
});

describe('fuso del posto', () => {
    it('Italia: il fuso e\' quello di Roma alla data vera (l\'offset di oggi non vale dopo il cambio dell\'ora)', () => {
        // 28/10/2026 e' ora solare (+01:00), ma Google puo' mandare utcOffsetMinutes: 120 (valore di prima del cambio)
        const d = new Date('2026-10-28T09:30:00+01:00');
        expect(localClock(d, { utcOffsetMinutes: 120 })).toEqual({ day: 3, minutes: 9 * 60 + 30 });
    });
    it('un fuso non italiano si prende com\'e\'', () => {
        const d = new Date('2026-10-14T12:00:00Z'); // a UTC-5 sono le 07:00
        expect(localClock(d, { utcOffsetMinutes: -300 })).toEqual({ day: 3, minutes: 7 * 60 });
    });
});

it('il messaggio notturno provvisorio e\' quello dichiarato', () => {
    expect(MESSAGGIO_CHIUSO).toBe("Meglio domattina: a quest'ora qui è quasi tutto chiuso.");
});
