// BANCO-POOL — il pool di ogni momento nel tracciato, senza cambiare il giro.
import { describe, it, expect } from 'vitest';
import { flattenSkeleton, bucketCandidates, repairMomentSelection, POOL_MAX } from '../../services/momentSelection';

const CATS = {
    mattina: ['cultura', 'monumenti', 'musei', 'passeggiata'], pranzo: ['cibo'],
    pomeriggio: ['cultura', 'natura', 'shopping', 'passeggiata'], aperitivo: ['bar', 'punti panoramici'], cena: ['cibo'],
};
const ORE = { mattina: ['09:30', '12:30'], pranzo: ['12:30', '14:30'], pomeriggio: ['14:30', '18:00'], aperitivo: ['18:00', '20:00'], cena: ['20:00', '22:30'] };
const giorno = (spec) => flattenSkeleton({ days: [{ moments: spec.map(([key, stops = 1]) => ({
    key, label: key, stops, categories: CATS[key],
    start: new Date(`2026-10-12T${ORE[key][0]}:00+02:00`), end: new Date(`2026-10-12T${ORE[key][1]}:00+02:00`),
})) }] });
const GIORNATA = giorno([['mattina', 2], ['pranzo'], ['pomeriggio', 2], ['aperitivo'], ['cena']]);

// Generatore con seme: giornate casuali ma ripetibili.
const rng = (seed) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const TIPI = [['museum'], ['church'], ['park'], ['tourist_attraction'], ['restaurant', 'food'], ['bar'], ['cafe'], ['art_gallery']];
const NOMI = ['Piazza', 'Belvedere', 'Chiesa', 'Museo', 'Trattoria', 'Bar', 'Giardino', 'Palazzo', 'Terrazza', 'Osteria'];
function poolCasuale(seed, n = 30) {
    const r = rng(seed);
    return Array.from({ length: n }, (_, i) => {
        const nome = `${NOMI[Math.floor(r() * NOMI.length)]} ${i}`;
        const types = /Trattoria|Osteria/.test(nome) ? ['restaurant', 'food'] : /Bar/.test(nome) ? ['bar'] : TIPI[Math.floor(r() * TIPI.length)];
        return { place_id: `p${seed}-${i}`, name: nome, types, rating: 3.8 + r(), user_ratings_total: Math.floor(50 + r() * 3000),
            latitude: 41.89 + r() * 0.03, longitude: 12.46 + r() * 0.04 };
    });
}
const sceltaCasuale = (pool, seed) => {
    const r = rng(seed + 7);
    return GIORNATA.flatMap(m => Array.from({ length: m.stops }, () => ({ place_id: pool[Math.floor(r() * pool.length)].place_id, moment: m.id })));
};
const senzaPool = ({ pool: _p, sceltaModello: _s, ...resto }) => resto;
const piano = (plan) => plan.map(p => ({ m: p.moment.id, stops: p.stops.map(s => ({ id: s.candidate.place_id, source: s.source, trace: s.trace })) }));

describe('BANCO-POOL — registrare il pool non cambia il giro', () => {
    it('40 giornate casuali (seme fisso): stesse tappe, stesse tracce, stesso report a parte il pool', () => {
        for (let seed = 1; seed <= 40; seed++) {
            const pool = poolCasuale(seed);
            const args = { moments: GIORNATA, buckets: bucketCandidates(GIORNATA, pool), aiStops: sceltaCasuale(pool, seed), pool };
            const con = repairMomentSelection({ ...args, registraPool: true });
            const senza = repairMomentSelection({ ...args, registraPool: false });
            expect(piano(con.plan), `seme ${seed}`).toEqual(piano(senza.plan));
            expect(senzaPool(con.report), `seme ${seed}`).toEqual(senzaPool(senza.report));
            expect(senza.report.pool).toBeUndefined();
        }
    });
});

describe('BANCO-POOL — cosa c\'e\' nel pool', () => {
    const pool = poolCasuale(99, 40);
    const aiStops = sceltaCasuale(pool, 99);
    const { plan, report } = repairMomentSelection({ moments: GIORNATA, buckets: bucketCandidates(GIORNATA, pool), aiStops, pool });

    it('per ogni momento del giro: al massimo 15 candidati, e ci sono le tappe scelte', () => {
        expect(POOL_MAX).toBe(15);
        for (const p of plan) {
            const e = report.pool[p.moment.id];
            expect(e, p.moment.id).toBeTruthy();
            expect(e.candidati.length).toBeLessThanOrEqual(POOL_MAX);
            for (const s of p.stops) expect(e.candidati.find(c => c.place_id === s.candidate.place_id)?.nelGiro).toBe(true);
        }
    });

    it('ogni candidato: id, nome, famiglia, merito, minuti, deviazione, scelto, motivo dello scarto', () => {
        const tutti = Object.values(report.pool).flatMap(e => e.candidati).filter(c => c.motivo !== 'messo dalla rifinitura');
        expect(tutti.length).toBeGreaterThan(10);
        for (const c of tutti) {
            expect(Object.keys(c).sort()).toEqual(['deviazione', 'famiglia', 'merito', 'minuti', 'motivo', 'nelGiro', 'nome', 'place_id', 'posto', 'scelto'].sort());
            expect(typeof c.merito).toBe('number');
            if (c.scelto) expect(c.motivo).toBe(null);
            else expect(typeof c.motivo).toBe('string');
        }
    });

    it('le scelte del modello cosi\' come sono arrivate, e nessun dato dell\'utente', () => {
        expect(report.sceltaModello).toEqual(aiStops.map(x => ({ place_id: x.place_id, momento: x.moment })));
        const testo = JSON.stringify(report.pool);
        expect(testo).not.toMatch(/@|email|user_id|password|token/i);
    });
});
