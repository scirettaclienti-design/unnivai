// NAV-2 — l'ordine del percorso: dentro ogni momento le tappe si camminano nell'ordine che fa meno strada; pasti, colazione, soste del
// DNA e orari vincolati restano dove sono. 0 $: funzione pura.
import { describe, it, expect } from 'vitest';
import { riordinaPerPercorso, kmDelPercorso, eMovibile } from '@/lib/ordinePercorso';

const ore = (da = '0700', a = '2300') => ({ periods: [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: da }, close: { day: d, time: a } })) });
const LAT = 37.5, LNG = 15.08;
// metri a nord / est dal punto zero
const posto = (id, nome, nord, est, types = ['church'], primary = 'church', extra = {}) => ({
    place_id: id, name: nome, types, primaryType: primary, latitude: LAT + nord / 111000, longitude: LNG + est / 88000, opening_hours: ore(), ...extra,
});
const T = (hhmm) => new Date(`2026-10-27T${hhmm}:00+01:00`);
const mattina = { key: 'mattina', label: 'Mattina' };
const pranzo = { key: 'pranzo', label: 'Pranzo' };
const pomeriggio = { key: 'pomeriggio', label: 'Pomeriggio' };
const e = (c, moment, hhmm, extra = {}) => ({ candidate: c, moment, start: T(hhmm), waitMinutesBefore: 0, source: 'modello', trace: {}, ...extra });
const nomi = (s, d = 0) => s.days[d].map(x => x.candidate.name);

// una strada nord–sud: A (0 m) · B (300) · C (600) · D (900); il giro del motore le visita A, C, B, D (torna indietro)
const A = posto('a', 'A Duomo', 0, 0), B = posto('b', 'B Chiostro', 300, 0), C = posto('c', 'C Teatro', 600, 0), D = posto('d', 'D Castello', 900, 0);
const TRATTORIA = posto('t', 'Trattoria', 1000, 0, ['restaurant'], 'restaurant');

describe('riordinaPerPercorso — la fila di un momento', () => {
    it('A, C, B, D diventa A, B, C, D: meno strada, stessi posti', () => {
        const sched = { days: [[e(A, mattina, '09:30'), e(C, mattina, '10:15'), e(B, mattina, '10:50'), e(D, mattina, '11:25'), e(TRATTORIA, pranzo, '12:30', { waitMinutesBefore: 25 })]] };
        const { sched: dopo, report } = riordinaPerPercorso(sched);
        expect(nomi(dopo)).toEqual(['A Duomo', 'B Chiostro', 'C Teatro', 'D Castello', 'Trattoria']);
        expect(report.kmDopo).toBeLessThan(report.kmPrima);
        expect(report.file).toHaveLength(1);
        expect(report.file[0]).toMatchObject({ momento: 'mattina', prima: ['A Duomo', 'C Teatro', 'B Chiostro', 'D Castello'] });
        // l'ordine originale non si tocca (copia)
        expect(sched.days[0].map(x => x.candidate.name)).toEqual(['A Duomo', 'C Teatro', 'B Chiostro', 'D Castello', 'Trattoria']);
    });

    it('il pranzo resta alle 12:30 e le tappe del momento non lo spingono più tardi', () => {
        const sched = { days: [[e(A, mattina, '09:30'), e(C, mattina, '10:15'), e(B, mattina, '10:50'), e(D, mattina, '11:25'), e(TRATTORIA, pranzo, '12:30', { waitMinutesBefore: 25 })]] };
        const { sched: dopo } = riordinaPerPercorso(sched);
        const pr = dopo.days[0].at(-1);
        expect(pr.start.getTime()).toBe(T('12:30').getTime());
        expect(pr.waitMinutesBefore).toBeGreaterThanOrEqual(0);
        // ogni tappa del momento arriva dopo la fine della precedente
        const m = dopo.days[0].slice(0, 4);
        for (let i = 1; i < m.length; i++) expect(m[i].start.getTime()).toBeGreaterThan(m[i - 1].start.getTime());
    });

    it('il pranzo non si sposta: una fila prima e una dopo si ordinano ciascuna per conto suo', () => {
        const sched = { days: [[
            e(A, mattina, '09:30'), e(C, mattina, '10:15'), e(B, mattina, '10:50'),
            e(posto('t2', 'Osteria', 400, 0, ['restaurant'], 'restaurant'), pranzo, '12:30', { waitMinutesBefore: 60 }),
            e(D, pomeriggio, '14:30', { waitMinutesBefore: 40 }),
        ]] };
        const { sched: dopo } = riordinaPerPercorso(sched);
        expect(nomi(dopo).indexOf('Osteria')).toBe(3);
        expect(dopo.days[0][3].start.getTime()).toBe(T('12:30').getTime());
    });

    it('i pasti, la colazione e le soste del DNA non sono movibili', () => {
        const caff = posto('k', 'Caffè', 50, 0, ['cafe'], 'cafe');
        const momCol = { ...mattina, colazione: true };
        const giorno = [e(caff, momCol, '08:30'), e(C, momCol, '09:00'), e(TRATTORIA, pranzo, '12:30'), e(B, mattina, '14:00', { source: 'dna' })];
        // la colazione (prima tappa del momento) no; una visita dopo la colazione sì; il pranzo no; la sosta del DNA no
        expect(giorno.map((x, i) => eMovibile(x, i, giorno))).toEqual([false, true, false, false]);
    });

    it('un ordine che farebbe arrivare una tappa quando è chiusa non si prende', () => {
        // B apre solo alle 11:00: nell'ordine nuovo arriverebbe alle 10:00
        const Bchiuso = posto('b', 'B Chiostro', 300, 0, ['church'], 'church', { opening_hours: ore('1100', '1800') });
        const sched = { days: [[e(A, mattina, '09:30'), e(C, mattina, '10:15'), e(Bchiuso, mattina, '11:00', { waitMinutesBefore: 10 }), e(D, mattina, '11:35'), e(TRATTORIA, pranzo, '12:30', { waitMinutesBefore: 20 })]] };
        const { sched: dopo, report } = riordinaPerPercorso(sched);
        expect(nomi(dopo)).toEqual(nomi(sched));
        expect(report.file).toHaveLength(0);
    });

    it('già in ordine di strada: niente cambia', () => {
        const sched = { days: [[e(A, mattina, '09:30'), e(B, mattina, '10:00'), e(C, mattina, '10:30'), e(D, mattina, '11:00')]] };
        const { sched: dopo, report } = riordinaPerPercorso(sched);
        expect(nomi(dopo)).toEqual(nomi(sched));
        expect(report.kmPrima).toBe(report.kmDopo);
    });

    it('i km: kmDelPercorso somma i tratti, il tempo libero non conta', () => {
        const libero = { title: 'Tempo libero', tempoLibero: true, latitude: null, longitude: null };
        const km3 = kmDelPercorso([A, libero, B, C]);
        expect(km3).toBeGreaterThan(0.55);
        expect(km3).toBeLessThan(0.65);
    });
});
