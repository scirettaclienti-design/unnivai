// BANCO-DIFETTI-2 (T23, D7) — niente buchi muti di oltre 2 ore: visite vicine coerenti col giro, o il motivo sulla riga.
import { describe, it, expect } from 'vitest';
import { riempiBuchi, testoBucoLungo, attesaPrima, SOGLIA_BUCO_MINUTI } from '@/lib/riempiBuchi';
import { kmFra } from '@/lib/inserisciTappa';
import { TETTO_PIEDI_KM } from '@/lib/tettoCammino';

const T = (hm) => new Date(`2026-11-05T${hm}:00+01:00`);
const M = (key, da, a) => ({ id: `g1-${key}`, key, label: key, dayIndex: 0, start: T(da), end: T(a) });
const POMERIGGIO = M('pomeriggio', '14:30', '18:00');
const CENA = M('cena', '20:00', '22:30');
const momenti = [M('mattina', '09:30', '12:30'), M('pranzo', '12:30', '14:30'), POMERIGGIO, M('aperitivo', '18:00', '19:30'), CENA];
const posto = (name, lat, lng, extra = {}) => ({ place_id: `id-${name}`, name, latitude: lat, longitude: lng, types: ['tourist_attraction'], rating: 4.5, ...extra });
const voce = (c, moment, hm) => ({ candidate: c, moment, start: T(hm), waitMinutesBefore: 0, source: 'modello' });
const opz = { aperto: () => true, capKm: TETTO_PIEDI_KM, momentiDi: () => momenti, fineDi: () => T('22:30'), ammette: () => true };

// Troina, n-troina-natura: dopo il belvedere delle 15:03 il giro aspettava la cena delle 20:00 (251 minuti di «Tempo libero»)
const BELVEDERE = posto('Belvedere della Piazza Conte Ruggero', 37.7851, 14.6008, { types: ['scenic_spot'] });
const PIZZA = posto('Pizza&Go', 37.7887, 14.5882, { types: ['pizza_restaurant'], primaryType: 'pizza_restaurant' });
const giro = () => ({ days: [[voce(BELVEDERE, POMERIGGIO, '15:03'), voce(PIZZA, CENA, '20:00')]] });

describe('D7 — le attese di oltre 2 ore', () => {
    it('si riempiono con una visita vicina (entro 1,2 km dalla tappa prima e dalla dopo), aperta, coerente col giro', () => {
        const chiesa = posto('Chiesa Madre', 37.7854, 14.6009, { types: ['church'] });
        const lontano = posto('Ponte di Failla', 37.79, 14.63, { rating: 5 }); // 2,7 km: oltre il tetto
        const r = riempiBuchi({ ...opz, sched: giro(), candidati: [lontano, chiesa] });
        const day = r.sched.days[0];
        expect(day.map(e => e.candidate.name)).toEqual(['Belvedere della Piazza Conte Ruggero', 'Chiesa Madre', 'Pizza&Go']);
        expect(day[1].source).toBe('riempimento');
        expect(day[1].moment.key).toBe('pomeriggio');
        // le tappe dopo restano ai loro orari; ogni tratto sta nel tetto
        expect(day[2].start.getTime()).toBe(T('20:00').getTime());
        for (let i = 1; i < day.length; i++) expect(kmFra(day[i - 1].candidate, day[i].candidate)).toBeLessThanOrEqual(TETTO_PIEDI_KM);
        expect(r.report.aggiunte[0]).toMatchObject({ nome: 'Chiesa Madre', momento: 'pomeriggio' });
    });

    it('il tetto di 1,2 km non si tocca: senza posti vicini il buco resta e si dichiara col motivo', () => {
        const r = riempiBuchi({ ...opz, sched: giro(), candidati: [posto('Ponte di Failla', 37.79, 14.63)] });
        expect(r.sched.days[0]).toHaveLength(2);
        expect(r.report.rimasti).toEqual([expect.objectContaining({ motivo: 'nessun posto', prima: 'id-Pizza&Go', coda: false })]);
        const riga = { tempoLibero: true, stayMinutes: 251 };
        expect(testoBucoLungo(riga, { prima: 'id-Pizza&Go', rimasti: r.report.rimasti, capKm: 1.2 }))
            .toBe('Nessuna tappa in questa fascia: entro 1,2 km non ci sono altri posti aperti adatti al giro.');
    });

    it('chiuso, incoerente col giro o gia\' nel giro non entra; mai oltre il tetto delle visite', () => {
        const chiesa = posto('Chiesa Madre', 37.7854, 14.6009, { types: ['church'] });
        expect(riempiBuchi({ ...opz, sched: giro(), candidati: [chiesa], aperto: () => false }).report.aggiunte).toEqual([]);
        expect(riempiBuchi({ ...opz, sched: giro(), candidati: [chiesa], ammette: () => false }).report.aggiunte).toEqual([]);
        expect(riempiBuchi({ ...opz, sched: giro(), candidati: [BELVEDERE] }).report.aggiunte).toEqual([]);
        const pieno = riempiBuchi({ ...opz, sched: giro(), candidati: [chiesa], tettoVisite: 1 });
        expect(pieno.report.aggiunte).toEqual([]);
        expect(pieno.report.rimasti[0]).toMatchObject({ motivo: 'tetto visite', visite: 1 });
        expect(testoBucoLungo({ stayMinutes: 200 }, { prima: 'id-Pizza&Go', rimasti: pieno.report.rimasti }))
            .toBe('Nessuna tappa in questa fascia: il giro ha già 1 visite, il massimo per una giornata.');
    });

    it('riempie finché l\'attesa scende sotto le 2 ore; un\'attesa sotto le 2 ore non si tocca', () => {
        const vicini = [1, 2, 3, 4, 5, 6, 7, 8].map(k => posto(`Luogo ${k}`, 37.7851 + k * 0.0003, 14.6008, { rating: 4 + k / 10 }));
        const r = riempiBuchi({ ...opz, sched: giro(), candidati: vicini });
        const day = r.sched.days[0];
        for (let i = 1; i < day.length; i++) expect(attesaPrima(day, i)).toBeLessThanOrEqual(SOGLIA_BUCO_MINUTI);
        const corto = { days: [[voce(BELVEDERE, POMERIGGIO, '15:03'), voce(PIZZA, CENA, '17:00')]] };
        expect(riempiBuchi({ ...opz, sched: corto, candidati: vicini }).report.aggiunte).toEqual([]);
    });

    it('la coda del giro: si riempie solo dopo una visita; dopo la cena il giro finisce e lo dice', () => {
        const solo = { days: [[voce(BELVEDERE, POMERIGGIO, '14:30')]] };
        const r = riempiBuchi({ ...opz, fineDi: () => T('18:00'), sched: solo, candidati: [posto('Chiesa Madre', 37.7854, 14.6009)] });
        expect(r.sched.days[0].map(e => e.candidate.name)).toEqual(['Belvedere della Piazza Conte Ruggero', 'Chiesa Madre']);
        expect(testoBucoLungo({ stayMinutes: 165 }, { coda: true, rimasti: [] })).toBe('Il giro finisce qui: il resto della fascia chiesta è libero.');
        expect(testoBucoLungo({ stayMinutes: 165 }, { coda: true, rimasti: [{ coda: true, motivo: 'nessun posto' }], capKm: 1.2 }))
            .toBe('Il giro finisce qui: dopo l\'ultima tappa entro 1,2 km non ci sono altri posti aperti adatti al giro.');
        expect(testoBucoLungo({ stayMinutes: 100 }, { coda: true })).toBeNull();
    });
});
