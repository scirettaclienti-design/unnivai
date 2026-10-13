// ORARI — la selezione per momenti non propone posti chiusi quando ci si arriva.
// Motore vero (bucket, riparazione, scheduling); i luoghi sono finti ma con orari veri.
import { describe, it, expect } from 'vitest';
import {
    flattenSkeleton, bucketCandidates, repairMomentSelection, scheduleMomentPlan,
    applyOpeningToBuckets, settleOpeningHours, closedMomentRows, closedInSchedule, scheduleHoursLabels,
} from '../../services/momentSelection';

// mercoledi' 14/10/2026 (CEST)
const T = (hhmm, day = '2026-10-14') => new Date(`${day}T${hhmm}:00+02:00`);
const P = (day, open, close, closeDay = day) => ({ open: { day, time: open }, close: { day: closeDay, time: close } });
const tuttiIGiorni = (open, close) => [0, 1, 2, 3, 4, 5, 6].map(d => P(d, open, close));
const R = { lat: 41.9, lng: 12.48 };
let n = 0;
const luogo = (name, types, periods, dx = 0) => ({
    place_id: `p${++n}-${name}`, name, types, rating: 4.5, user_ratings_total: 300,
    latitude: R.lat, longitude: R.lng + dx, ...(periods ? { openingPeriods: periods } : {}),
});
const museo = (name, periods, dx) => luogo(name, ['museum'], periods, dx);
const trattoria = (name, periods, dx) => luogo(name, ['restaurant', 'food'], periods, dx);
const bar = (name, periods, dx) => luogo(name, ['cafe', 'bar', 'food'], periods, dx);

const CAT = {
    mattina: ['cultura', 'monumenti', 'musei', 'passeggiata'], pranzo: ['cibo'], pomeriggio: ['cultura', 'natura', 'shopping', 'passeggiata'],
    aperitivo: ['bar', 'punti panoramici'], cena: ['cibo'],
};
const moment = (key, label, a, b, stops = 1, categories) => ({ key, label, start: T(a), end: T(b), stops, categories: categories || CAT[key] });
const flat = (ms) => flattenSkeleton({ days: [{ moments: ms }] });

// Il giro come lo fa generateItinerary: bucket senza i chiusi, scelta, orari, controllo, nuova scelta.
const gira = ({ ms, pool, aiStops, anyCategory = false }) => {
    const raw = bucketCandidates(ms, pool, { anyCategory });
    const veto = new Map();
    const out = settleOpeningHours({
        veto,
        repair: () => repairMomentSelection({ moments: ms, buckets: applyOpeningToBuckets(ms, raw, { veto }).buckets, aiStops, pool }),
        schedule: (plan) => scheduleMomentPlan(plan, ms[0].start),
    });
    const nomi = out.sched.days.flat().map(s => s.candidate.name);
    return { ...out, nomi, veto, raw, report: applyOpeningToBuckets(ms, raw, { veto }).report };
};

describe('un posto che apre alle 18 proposto alle 9:30', () => {
    it('il modello lo sceglie, il codice lo sostituisce con uno aperto', () => {
        const chiuso = museo('Museo Serale', tuttiIGiorni('1800', '2300'));
        const aperto = museo('Museo del Mattino', tuttiIGiorni('0900', '1900'), 0.001);
        const ms = flat([moment('mattina', 'Mattina', '09:30', '12:30')]);
        const r = gira({ ms, pool: [chiuso, aperto], aiStops: [{ place_id: chiuso.place_id, moment: 'g1-mattina' }] });
        expect(r.nomi).toEqual(['Museo del Mattino']);
        expect(r.residui).toEqual([]);
    });
    it('senza orari (ricerca vecchia) il motore sceglie esattamente come prima', () => {
        const a = museo('Museo A', null), b = museo('Museo B', null, 0.001);
        const ms = flat([moment('mattina', 'Mattina', '09:30', '12:30')]);
        const raw = bucketCandidates(ms, [a, b]);
        const { buckets, report } = applyOpeningToBuckets(ms, raw);
        expect(buckets.get('g1-mattina')).toEqual(raw.get('g1-mattina'));
        expect(report.chiusi).toEqual([]);
        const r = gira({ ms, pool: [a, b], aiStops: [{ place_id: a.place_id, moment: 'g1-mattina' }] });
        expect(r.nomi).toEqual(['Museo A']);
        expect(r.giri).toEqual([]);
    });
});

describe('una trattoria che apre alle 19 non va a pranzo alle 12:30', () => {
    it('sostituita da una aperta; alla cena (20:00) invece va bene', () => {
        const serale = trattoria('Trattoria Serale', tuttiIGiorni('1900', '2300'));
        const pranzo = trattoria('Trattoria da Pranzo', tuttiIGiorni('1200', '1500'), 0.001);
        const ms = flat([moment('pranzo', 'Pranzo', '12:30', '14:30'), moment('cena', 'Cena', '20:00', '22:30')]);
        const r = gira({ ms, pool: [serale, pranzo], aiStops: [{ place_id: serale.place_id, moment: 'g1-pranzo' }, { place_id: serale.place_id, moment: 'g1-cena' }] });
        expect(r.nomi[0]).toBe('Trattoria da Pranzo');
        expect(r.nomi).toContain('Trattoria Serale');
        expect(r.sched.days.flat().find(s => s.candidate.name === 'Trattoria Serale').moment.key).toBe('cena');
    });
});

describe('una sosta che sfora la chiusura', () => {
    it('apre ma chiude prima della fine della sosta (60 min dalle 9:30): sostituita', () => {
        const corto = museo('Museo Chiude Presto', tuttiIGiorni('0900', '1015'));
        const lungo = museo('Museo Tutto il Giorno', tuttiIGiorni('0900', '1800'), 0.001);
        const ms = flat([moment('mattina', 'Mattina', '09:30', '12:30')]);
        const r = gira({ ms, pool: [corto, lungo], aiStops: [{ place_id: corto.place_id, moment: 'g1-mattina' }] });
        expect(r.nomi).toEqual(['Museo Tutto il Giorno']);
    });
    it('l\'arrivo vero e\' piu\' tardi dell\'inizio del momento: il secondo posto del mattino chiude alle 11:00 ed e\' scartato col controllo sugli orari veri', () => {
        const a = museo('Museo Primo', tuttiIGiorni('0900', '1800'));
        const b = museo('Museo Chiude alle 11', tuttiIGiorni('0900', '1100'), 0.001);   // dal 9:30 + 60 = 10:30: sembra ok; ci si arriva alle 10:32 → finisce alle 11:32
        const c = museo('Museo Terzo', tuttiIGiorni('0900', '1800'), 0.002);
        const ms = flat([moment('mattina', 'Mattina', '09:30', '12:30', 2)]);
        const r = gira({ ms, pool: [a, b, c], aiStops: [a, b].map(x => ({ place_id: x.place_id, moment: 'g1-mattina' })) });
        expect(r.nomi).not.toContain('Museo Chiude alle 11');
        expect(r.nomi.length).toBe(2);
        expect(r.giri.length).toBeGreaterThan(0);          // il primo giro l'aveva scelto: il controllo vero l'ha vietato
        expect(r.residui).toEqual([]);
        expect(closedInSchedule(r.sched)).toEqual([]);
    });
});

describe('un museo chiuso il mercoledi\' non entra il mercoledi\'', () => {
    const senzaMercoledi = [0, 1, 2, 4, 5, 6].map(d => P(d, '1000', '1900'));
    it('mercoledi: sostituito; giovedi\' (giorno vero del tour): scelto', () => {
        const chiusoMer = museo('Museo Chiuso il Mercoledi', senzaMercoledi);
        const altro = museo('Museo Sempre Aperto', tuttiIGiorni('0900', '1900'), 0.001);
        const mer = flat([moment('mattina', 'Mattina', '10:00', '12:30')]);
        const gio = flattenSkeleton({ days: [{ moments: [{ ...moment('mattina', 'Mattina', '10:00', '12:30'), start: T('10:00', '2026-10-15'), end: T('12:30', '2026-10-15') }] }] });
        const ai = [{ place_id: chiusoMer.place_id, moment: 'g1-mattina' }];
        expect(gira({ ms: mer, pool: [chiusoMer, altro], aiStops: ai }).nomi).toEqual(['Museo Sempre Aperto']);
        expect(gira({ ms: gio, pool: [chiusoMer, altro], aiStops: ai }).nomi).toEqual(['Museo Chiuso il Mercoledi']);
    });
});

describe('orario sconosciuto', () => {
    it('a colazione un locale senza orario perde contro uno aperto con orario noto', () => {
        const ignoto = bar('Bar Senza Orari', null);
        const noto = bar('Bar con Orari', tuttiIGiorni('0600', '2000'), 0.0005);
        const ms = flat([moment('mattina', 'Mattina', '09:30', '12:30', 1, ['bar'])]);
        const r = gira({ ms, pool: [ignoto, noto], aiStops: [{ place_id: ignoto.place_id, moment: 'g1-mattina' }] });
        expect(r.nomi).toEqual(['Bar con Orari']);
        expect(r.report.scartatiIgnoti.map(x => x.nome)).toEqual(['Bar Senza Orari']);
    });
    it('a colazione, se nessuno ha l\'orario, resta ammesso (e viene segnato)', () => {
        const a = bar('Bar Uno', null), b = bar('Bar Due', null, 0.0005);
        const ms = flat([moment('mattina', 'Mattina', '09:30', '12:30', 1, ['bar'])]);
        const r = gira({ ms, pool: [a, b], aiStops: [{ place_id: a.place_id, moment: 'g1-mattina' }] });
        expect(r.nomi).toEqual(['Bar Uno']);
        expect(scheduleHoursLabels(r.sched).get(a.place_id)).toBe('sconosciuto');
    });
    it('dopo le 21 un posto senza orario perde contro uno aperto noto; di giorno no', () => {
        const ignoto = bar('Bar Notturno Ignoto', null);
        const noto = bar('Bar Notturno Noto', tuttiIGiorni('1800', '0200').map(p => ({ ...p, close: { ...p.close, day: (p.open.day + 1) % 7 } })), 0.0005);
        const sera = flat([moment('aperitivo', 'Aperitivo', '21:30', '23:30', 1, ['bar'])]);
        const giorno = flat([moment('aperitivo', 'Aperitivo', '18:00', '20:00', 1, ['bar'])]);
        const aiS = [{ place_id: ignoto.place_id, moment: 'g1-aperitivo' }];
        expect(gira({ ms: sera, pool: [ignoto, noto], aiStops: aiS }).nomi).toEqual(['Bar Notturno Noto']);
        expect(gira({ ms: giorno, pool: [ignoto, noto], aiStops: aiS }).nomi).toEqual(['Bar Notturno Ignoto']);
    });
});

describe('nessun momento resta vuoto senza un ripiego dichiarato', () => {
    it('non pasto: tutto chiuso → riga di tempo libero; pasto: riga "nessun locale aperto"', () => {
        const chiuso = museo('Museo Chiuso', tuttiIGiorni('1800', '2200'));
        const pChiuso = trattoria('Trattoria Chiusa', tuttiIGiorni('1900', '2300'));
        const ms = flat([moment('mattina', 'Mattina', '09:30', '12:30'), moment('pranzo', 'Pranzo', '12:30', '14:30')]);
        const r = gira({ ms, pool: [chiuso, pChiuso], aiStops: [] });
        expect(r.nomi).toEqual([]);
        const chiusiPerMomento = new Set(r.report.chiusi.map(x => x.momento));
        const righe = closedMomentRows({ moments: ms, sched: r.sched, chiusiPerMomento });
        expect(righe.map(x => [x.key, x.pasto])).toEqual([['mattina', false], ['pranzo', true]]);
    });
    it('un momento vuoto per ragioni che non sono gli orari non diventa una riga', () => {
        const ms = flat([moment('mattina', 'Mattina', '09:30', '12:30')]);
        expect(closedMomentRows({ moments: ms, sched: { days: [[]] }, chiusiPerMomento: new Set() })).toEqual([]);
    });
});
