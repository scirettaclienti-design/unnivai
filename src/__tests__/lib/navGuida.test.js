// NAV-3 — i pezzi di testo della guida: distanze, svolte, via, riga insider, aperto fino alle, filo, numeri, tracciato. 0 $.
import { describe, it, expect } from 'vitest';
import { formatMetri, versoDa, viaDa, minutiAPiedi, rigaInsider, apertoFinoAlle, rigaTappa, testoTappa, filoDelGiorno, fraseDelFilo, dataDelGiro, numeriDelGiro, prossimaSvolta, percheAdesso, cosaHoImparato, tracciatoSvg, minSec, secondiDiLettura } from '@/lib/navGuida';
import { stileMappa } from '@/lib/stileMappa';

const ore = (da, a) => ({ periods: [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: da }, close: { day: d, time: a } })) });

describe('pillola: distanza, verso, via', () => {
    it('120 m · 45 m · 1,2 km', () => {
        expect(formatMetri(118)).toBe('120 m');
        expect(formatMetri(43)).toBe('45 m');
        expect(formatMetri(1240)).toBe('1,2 km');
        expect(formatMetri(0)).toBeNull();
    });
    it('«a sinistra», «a destra», «dritto»', () => {
        expect(versoDa('turn-left')).toBe('a sinistra');
        expect(versoDa('turn-slight-right')).toBe('leggermente a destra');
        expect(versoDa(null)).toBe('dritto');
    });
    it('la via dall\'istruzione di Google, senza le parole di direzione', () => {
        expect(viaDa('Svolta a <b>sinistra</b> su <b>Via Etnea</b>')).toBe('Via Etnea');
        expect(viaDa('Prosegui verso <b>nord</b>')).toBeNull();
        expect(viaDa(null)).toBeNull();
    });
    it('i minuti a piedi: 75 m al minuto, almeno 1', () => {
        expect(minutiAPiedi(300)).toBe(4);
        expect(minutiAPiedi(10)).toBe(1);
        expect(minutiAPiedi(null)).toBeNull();
    });
});

describe('prossimaSvolta — solo le svolte principali, dentro il tratto', () => {
    const steps = [
        { legIndex: 0, maneuver: null, distanceM: 50, endLatLng: { lat: 37.5, lng: 15.08 } },
        { legIndex: 0, maneuver: 'straight', distanceM: 80, endLatLng: { lat: 37.5005, lng: 15.08 } },
        { legIndex: 0, maneuver: 'turn-left', instructions: 'Svolta a <b>sinistra</b> su <b>Via Crociferi</b>', distanceM: 100, endLatLng: { lat: 37.501, lng: 15.08 } },
        { legIndex: 1, maneuver: 'turn-right', distanceM: 30, endLatLng: { lat: 37.502, lng: 15.08 } },
    ];
    it('salta il «dritto» e dice la svolta vera con la distanza (fino alla fine dello step + gli step in mezzo)', () => {
        const r = prossimaSvolta(steps, 0, { lat: 37.5, lng: 15.08 });
        expect(r.maneuver).toBe('turn-left');
        expect(r.distanzaM).toBe(80); // 0 m allo step + 80 m del «dritto»
        expect(viaDa(r.instructionHtml)).toBe('Via Crociferi');
    });
    it('non guarda oltre la tappa: nessuna svolta nel tratto → null', () => {
        expect(prossimaSvolta(steps, 2, { lat: 37.501, lng: 15.08 })).toBeNull();
    });
});

describe('scheda e riga della tappa', () => {
    it('la prima frase, al massimo 90 caratteri', () => {
        expect(rigaInsider({ description: 'Qui si entra dal lato. Il resto è dopo.' })).toBe('Qui si entra dal lato.');
        expect(rigaInsider({ description: 'x'.repeat(200) }).length).toBeLessThanOrEqual(91);
        expect(rigaInsider({})).toBeNull();
    });
    it('«aperto fino alle»: da quello che si sa, mai inventato', () => {
        const quando = new Date('2026-10-27T10:00:00+01:00');
        expect(apertoFinoAlle({ opening_hours: ore('0900', '1900') }, quando)).toBe('aperto fino alle 19:00');
        expect(apertoFinoAlle({}, quando)).toBeNull();
    });
    it('«chiesa · 20 min · aperto fino alle 19:00»', () => {
        const quando = new Date('2026-10-27T10:00:00+01:00');
        expect(rigaTappa({ categoria: 'chiesa', stayMinutes: 20, stop: { opening_hours: ore('0900', '1900') }, quando })).toBe('chiesa · 20 min · aperto fino alle 19:00');
        expect(rigaTappa({ categoria: 'chiesa' })).toBe('chiesa');
    });
    it('«Tappa 3 di 12» e il racconto 0:12 / 0:40', () => {
        expect(testoTappa(2, 12)).toBe('Tappa 3 di 12');
        expect(testoTappa(12, 12)).toBe('Tappa 12 di 12');
        expect(minSec(12)).toBe('0:12');
        expect(secondiDiLettura('uno due tre')).toBeGreaterThanOrEqual(5);
    });
    it('«perché sei qui adesso»: solo cose vere', () => {
        const f = percheAdesso({ moment: 'mattina', travelMinutesFromPrev: 4, opening_hours: ore('0900', '1900') }, new Date('2026-10-27T10:00:00+01:00'));
        expect(f).toContain('poca gente');
        expect(f).toContain('aperto fino alle 19:00');
        expect(f).toContain('4 minuti a piedi');
        expect(percheAdesso({}, null)).toBeNull();
    });
});

describe('il filo del giorno', () => {
    const tappe = [{ moment: 'mattina' }, { moment: 'mattina' }, { moment: 'pranzo' }, { moment: 'pomeriggio' }, { moment: 'cena' }];
    it('un gruppo per momento, un puntino per tappa, quella attuale evidenziata', () => {
        const g = filoDelGiorno(tappe, 2);
        expect(g.map(x => x.key)).toEqual(['mattina', 'pranzo', 'pomeriggio', 'cena']);
        expect(g[0].punti).toHaveLength(2);
        expect(g.flatMap(x => x.punti).filter(p => p.attuale)).toHaveLength(1);
        expect(g[1].punti[0].attuale).toBe(true);
        expect(g[0].punti.every(p => p.fatta)).toBe(true);
    });
    it('la frase sullo stato', () => {
        expect(fraseDelFilo(2, 12, { sera: true })).toBe('Ultime due tappe. La serata è tua.');
        expect(fraseDelFilo(1, 12)).toBe('Ultima tappa.');
        expect(fraseDelFilo(12, 12)).toBe('Si parte.');
    });
});

describe('la fine del giro', () => {
    it('data, numeri, tracciato, cosa ho imparato', () => {
        expect(dataDelGiro(new Date('2026-10-24T12:00:00+02:00'))).toBe('24 OTTOBRE');
        const n = numeriDelGiro({ tappe: [{ lat: 37.5, lng: 15.08 }, { lat: 37.51, lng: 15.08 }], elapsedMs: 5400000 });
        expect(n).toMatchObject({ km: '1,1', tappe: 2, ore: '1,5 h' });
        const punti = tracciatoSvg([{ lat: 37.5, lng: 15.08 }, { lat: 37.51, lng: 15.09 }, { lat: 37.505, lng: 15.1 }], 320, 190, 24);
        expect(punti).toHaveLength(3);
        for (const p of punti) { expect(p.x).toBeGreaterThanOrEqual(24); expect(p.x).toBeLessThanOrEqual(296); expect(p.y).toBeGreaterThanOrEqual(24); expect(p.y).toBeLessThanOrEqual(166); }
        expect(cosaHoImparato({ fatte: [{ categoria: 'cultura' }, { categoria: 'cultura' }, { categoria: 'food' }], totale: 4, saltate: 1, dnaWeights: { cultura: 0.5 } })).toMatch(/cultura: 2 tappe su 4/);
        expect(cosaHoImparato({ fatte: [], totale: 0 })).toBeNull();
    });
});

describe('lo stile della mappa segue il sole', () => {
    // 27/10/2026 a Catania: alba ~06:00, tramonto ~16:50 (ora solare)
    const sole = { sunrise: new Date('2026-10-27T05:55:00+01:00'), sunset: new Date('2026-10-27T16:50:00+01:00') };
    const a = (hhmm) => stileMappa(new Date(`2026-10-27T${hhmm}:00+01:00`), sole);
    it('mattina fino a 2 h dopo l\'alba; giorno; tramonto da 1 h prima a 30 min dopo; notte dal buio', () => {
        expect(a('05:30')).toBe('notte');
        expect(a('06:30')).toBe('mattina');
        expect(a('07:54')).toBe('mattina');
        expect(a('08:00')).toBe('giorno');
        expect(a('12:00')).toBe('giorno');
        expect(a('15:49')).toBe('giorno');
        expect(a('15:50')).toBe('tramonto');
        expect(a('17:10')).toBe('tramonto');
        expect(a('17:20')).toBe('notte');
        expect(a('22:00')).toBe('notte');
    });
    it('senza sole (nessun dato) lo stile scuro di giorno', () => {
        expect(stileMappa(new Date(), { sunrise: null, sunset: null })).toBe('giorno');
    });
});
