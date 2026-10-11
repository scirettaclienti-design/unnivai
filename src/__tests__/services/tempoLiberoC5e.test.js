// C5e — regole di ripiego: la varieta' fino a 25 min, e O (tempo libero).
import { describe, it, expect } from 'vitest';
import { flattenSkeleton, bucketCandidates, repairMomentSelection } from '../../services/momentSelection';
import { FREE_TIME_MAX_MINUTES, freeTimeDecision, freeTimeStop, realStops } from '../../lib/freeTime';
import { composeFreeTime, FRASI_TEMPO_LIBERO } from '../../lib/stopPhrases';
import { filterBannedWords, voiceIssues } from '../../lib/narrationLight';
import { normalizeTour } from '../../services/tourShape';
import { travelMinutes } from '../../lib/tourTiming';
import { misuraCaso } from '../../../scripts/banco/misure.js';
import config from '../../../scripts/banco/banco.config.json';

const CATS = {
    mattina: ['cultura', 'monumenti', 'musei', 'passeggiata'], pranzo: ['cibo'],
    pomeriggio: ['cultura', 'natura', 'shopping', 'passeggiata'], aperitivo: ['bar', 'punti panoramici'], cena: ['cibo'],
};
const ORE = { mattina: ['09:30', '12:30'], pranzo: ['12:30', '14:30'], pomeriggio: ['14:30', '18:00'], aperitivo: ['18:00', '20:00'], cena: ['20:00', '22:30'] };
const giorno = (spec) => flattenSkeleton({ days: [{ moments: spec.map(([key, stops = 1]) => ({
    key, label: key, stops, categories: CATS[key],
    start: new Date(`2026-10-12T${ORE[key][0]}:00+02:00`), end: new Date(`2026-10-12T${ORE[key][1]}:00+02:00`),
})) }] });
const p = (id, lat, lng, types = ['tourist_attraction'], rating = 4.5) => ({ place_id: id, name: id, latitude: lat, longitude: lng, types, rating, user_ratings_total: 500 });
const seq = (plan) => plan.flatMap(x => x.stops);
const RIST = ['restaurant', 'food'];

// ─── (1) La varieta' fino a 25 minuti ───────────────────────────────────────
// Il caso Napoli: pomeriggio un belvedere, aperitivo solo belvederi. La
// ripetizione si toglie solo cambiando il pomeriggio, con una chiesa lontana.
describe('C5e (1) — una famiglia nuova fra 20 e 25 min toglie una ripetizione evitabile', () => {
    const g = giorno([['mattina'], ['pomeriggio'], ['aperitivo']]);
    const museo = p('Museo', 40.8400, 14.2500, ['museum']);
    const belvA = p('Belvedere Uno', 40.8420, 14.2500);
    const belvB = p('Belvedere Due', 40.8430, 14.2510);
    const scelta = [['Museo', 'mattina'], ['Belvedere Uno', 'pomeriggio'], ['Belvedere Due', 'aperitivo']].map(([place_id, m]) => ({ place_id, moment: `g1-${m}` }));

    it('chiesa a 22 minuti dal museo: entra al posto del belvedere del pomeriggio, dichiarata', () => {
        const chiesa = p('Chiesa Lontana', 40.8400, 14.2695, ['church']);
        expect(travelMinutes(museo, chiesa)).toBe(22);
        const pool = [museo, belvA, belvB, chiesa];
        const { plan, report } = repairMomentSelection({ moments: g, buckets: bucketCandidates(g, pool), aiStops: scelta, pool });
        const ids = seq(plan).map(s => s.candidate.place_id);
        expect(ids).toContain('Chiesa Lontana');
        expect(seq(plan).filter(s => s.trace.famiglia === 'panorama')).toHaveLength(1);
        const messa = seq(plan).find(s => s.candidate.place_id === 'Chiesa Lontana');
        expect(messa.trace.motivo).toMatch(/^famiglia nuova oltre i 20 min \(entro 25\): toglie la ripetizione/);
        expect(report.ripetuti).toEqual([]);
    });

    it('chiesa a 27 minuti: oltre i 25 resta la ripetizione, dichiarata inevitabile con la chiesa come piu\' vicina', () => {
        const chiesa = p('Chiesa Troppo Lontana', 40.8400, 14.2743, ['church']);
        expect(travelMinutes(museo, chiesa)).toBe(27);
        const pool = [museo, belvA, belvB, chiesa];
        const { plan } = repairMomentSelection({ moments: g, buckets: bucketCandidates(g, pool), aiStops: scelta, pool });
        expect(seq(plan).map(s => s.candidate.place_id)).not.toContain('Chiesa Troppo Lontana');
        const ripetuta = seq(plan).find(s => s.trace.varieta);
        expect(ripetuta.trace.varieta).toMatchObject({ esito: 'inevitabile', piuVicina: { nome: 'Chiesa Troppo Lontana', famiglia: 'chiesa' } });
        expect(ripetuta.trace.motivo).toMatch(/inevitabile/);
    });

    it('il tetto dei 20 resta per tutto il resto: una tappa a 22 min non entra per accorciare il giro', () => {
        // nessuna ripetizione: lo scambio con un posto a 22 min non serve alla varieta'
        const verde = p('Giardino Lontano', 40.8400, 14.2695, ['park']);
        const bar = p('Bar Vicino', 40.8431, 14.2512, ['bar']);
        const pool = [museo, belvA, bar, verde];
        const { plan } = repairMomentSelection({ moments: g, buckets: bucketCandidates(g, pool),
            aiStops: [['Museo', 'mattina'], ['Belvedere Uno', 'pomeriggio'], ['Bar Vicino', 'aperitivo']].map(([place_id, m]) => ({ place_id, moment: `g1-${m}` })), pool });
        expect(seq(plan).map(s => s.candidate.place_id)).toEqual(['Museo', 'Belvedere Uno', 'Bar Vicino']);
    });
});

// ─── (2) O — il tempo libero ────────────────────────────────────────────────
describe('C5e (2) — O: fuori dai pasti, niente entro 40 min dalla tappa prima → tempo libero', () => {
    const g = giorno([['mattina'], ['pomeriggio'], ['aperitivo'], ['cena']]);
    const museo = p('Museo', 37.5020, 15.0870, ['museum']);
    const chiesa = p('Chiesa', 37.5040, 15.0880, ['church']);
    // l'unico bar dell'aperitivo e' a ~4,5 km (60 min); una cena vicino a lui e una vicino alla chiesa
    const barLontano = p('Bar Lontano', 37.5420, 15.0880, ['bar']);
    const cenaLontana = p('Trattoria Lontana', 37.5425, 15.0885, RIST, 4.9);
    const cenaVicina = p('Trattoria Vicina', 37.5050, 15.0890, RIST, 4.2);
    const pool = [museo, chiesa, barLontano, cenaLontana, cenaVicina];
    const args = { moments: g, buckets: bucketCandidates(g, pool), aiStops: [], pool };

    it('controllo: il bar e\' oltre i 40 minuti dalla chiesa', () => {
        expect(FREE_TIME_MAX_MINUTES).toBe(40);
        expect(travelMinutes(chiesa, barLontano)).toBeGreaterThan(40);
    });

    it('senza O (come prima): il bar lontano entra, e la cena gli va dietro', () => {
        const { plan } = repairMomentSelection(args);
        const per = Object.fromEntries(plan.map(x => [x.moment.key, x.stops.map(s => s.candidate.place_id)]));
        expect(per).toMatchObject({ aperitivo: ['Bar Lontano'], cena: ['Trattoria Lontana'] });
    });

    it('con O: l\'aperitivo e\' tempo libero, dichiarato; la cena si sceglie dalla tappa vera prima', () => {
        const { plan, report } = repairMomentSelection({ ...args, tempoLiberoMinuti: FREE_TIME_MAX_MINUTES });
        const per = Object.fromEntries(plan.map(x => [x.moment.key, x.stops.map(s => s.candidate.place_id)]));
        expect(per.aperitivo).toBeUndefined();
        expect(per.cena).toEqual(['Trattoria Vicina']);
        expect(report.tempoLibero).toEqual([expect.objectContaining({
            momento: 'g1-aperitivo', key: 'aperitivo', dayIndex: 0, piuVicino: expect.objectContaining({ nome: 'Bar Lontano' }),
            motivo: expect.stringMatching(/^nessun posto entro 40 min dalla tappa prima: il piu' vicino, "Bar Lontano", e' a \d+ min$/),
        })]);
        expect(report.momentiTolti).toEqual([]);
        // nessuna tappa oltre i 40 min in un momento non pasto
        const s = seq(plan);
        for (let i = 1; i < s.length; i++) if (!['pranzo', 'cena'].includes(plan.find(x => x.stops.includes(s[i])).moment.key)) expect(travelMinutes(s[i - 1].candidate, s[i].candidate)).toBeLessThanOrEqual(40);
    });

    it('un pasto non si sostituisce mai: la cena lontana resta (il piu\' vicino valido), dichiarata come ripiego', () => {
        const g2 = giorno([['mattina'], ['pomeriggio'], ['cena']]);
        const pool2 = [museo, chiesa, cenaLontana];
        const { plan, report } = repairMomentSelection({ moments: g2, buckets: bucketCandidates(g2, pool2), aiStops: [], pool: pool2, tempoLiberoMinuti: FREE_TIME_MAX_MINUTES });
        const cena = seq(plan).find(s => s.candidate.place_id === 'Trattoria Lontana');
        expect(cena).toBeTruthy();
        expect(cena.trace).toMatchObject({ scelta: 'ripiego', ripiego: 'distanza' });
        expect(report.tempoLibero).toEqual([]);
    });

    it('la scelta del modello oltre i 40 min fuori dai pasti e\' scartata con il motivo', () => {
        const { report } = repairMomentSelection({ ...args, aiStops: [{ place_id: 'Bar Lontano', moment: 'g1-aperitivo' }], tempoLiberoMinuti: 40 });
        expect(report.scartate).toEqual([expect.objectContaining({ place_id: 'Bar Lontano', motivo: 'nessun posto entro 40 min dalla tappa prima: tempo libero' })]);
    });
});

describe('C5e (2) — la funzione riusabile, la voce del giro e le frasi', () => {
    it('freeTimeDecision: mai per un pasto, mai senza tappa prima, si\' oltre la soglia', () => {
        const a = p('A', 41.90, 12.48), lontano = p('L', 41.94, 12.48), vicino = p('V', 41.905, 12.48);
        expect(freeTimeDecision({ prev: a, candidates: [lontano], pasto: false })).toMatchObject({ libero: true, piuVicino: { nome: 'L' } });
        expect(freeTimeDecision({ prev: a, candidates: [lontano, vicino], pasto: false }).libero).toBe(false);
        expect(freeTimeDecision({ prev: a, candidates: [lontano], pasto: true }).libero).toBe(false);
        expect(freeTimeDecision({ prev: null, candidates: [lontano], pasto: false }).libero).toBe(false);
        expect(freeTimeDecision({ prev: a, candidates: [lontano], pasto: false, maxMinutes: 120 }).libero).toBe(false);
    });

    it('la voce del giro: niente coordinate, sosta e cammino 0, fuori dalle tappe vere', () => {
        const tl = freeTimeStop({ moment: 'aperitivo', description: 'x' });
        expect(tl).toMatchObject({ tempoLibero: true, title: 'Tempo libero', latitude: null, longitude: null, stayMinutes: 0, travelMinutesFromPrev: 0 });
        expect(realStops([{ title: 'A' }, tl])).toEqual([{ title: 'A' }]);
    });

    it('le due frasi proposte: composte dal codice, accordate, senza parole vietate ne\' problemi di voce', () => {
        expect(FRASI_TEMPO_LIBERO).toHaveLength(2);
        expect(composeFreeTime({ momento: 'aperitivo' })).toBe("Tempo libero: per l'aperitivo non c'è niente che valga il cammino. Il resto lo scegli tu.");
        expect(composeFreeTime({ momento: 'mattina', variante: 1 })).toBe('La mattina è tua: nessuna tappa da raggiungere, giri la zona come vuoi.');
        expect(composeFreeTime({ momento: 'pomeriggio', variante: 1 })).toBe('Il pomeriggio è tuo: nessuna tappa da raggiungere, giri la zona come vuoi.');
        for (const v of [0, 1]) for (const m of ['mattina', 'pomeriggio', 'aperitivo', 'dopocena']) {
            const t = composeFreeTime({ momento: m, variante: v });
            expect(filterBannedWords(t).removed).toEqual([]);
            for (const f of t.split(/(?<=[.!?])\s+/)) expect(voiceIssues(f), f).toEqual([]);
        }
    });

    it('normalizeTour: il tempo libero esce dai passi (niente pin, la navigazione lo salta) e resta in freeTime', () => {
        const tl = freeTimeStop({ moment: 'aperitivo', description: composeFreeTime({ momento: 'aperitivo' }) });
        const t = normalizeTour({ city: 'Catania', isAiGenerated: true, stops: [p('A', 37.50, 15.08), tl, p('B', 37.505, 15.085)] });
        expect(t.steps.map(s => s.title)).toEqual(['A', 'B']);
        expect(t.freeTime).toEqual([tl]);
    });

    it('banco: il percorso si misura senza il tempo libero; il tratto piu\' lungo fuori dai pasti e\' contato', () => {
        const st = (o) => ({ title: o.id, place_id: o.id, min: null, scelta: 'modello', verita: true, frasi: [], recensioni: 100, pasto: false, ...o });
        const caso = { id: 'x', gruppo: 'b', tipo: 'itinerario', luogo: 'Catania', posizione: 'Catania', secs: 10, ai: {}, google: {}, tours: [{ stops: [
            st({ id: 'm', lat: 37.502, lng: 15.087, moment: 'mattina' }), st({ id: 'c', lat: 37.504, lng: 15.088, moment: 'pomeriggio', min: 3 }),
            st({ id: 'tl', lat: null, lng: null, moment: 'aperitivo', tempoLibero: true }),
            st({ id: 'v', lat: 37.505, lng: 15.089, moment: 'cena', min: 2 }),
        ] }] };
        const m = misuraCaso(caso, config);
        expect(m).toMatchObject({ tempoLibero: 1, maxMinutiNonPasto: 3 });
        expect(m.percorso.giornate[0].deviazioni.map(d => d.titolo)).toEqual(['c']);
    });
});
