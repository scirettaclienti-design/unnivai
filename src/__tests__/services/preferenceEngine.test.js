import { describe, it, expect } from 'vitest';
import { computeWeights, normalizeCategory, CORE_CATEGORIES } from '../../services/preferenceEngine';

// Gate SEME (L1) — prima rete su computeWeights col 2o argomento (seme onboarding).
// Il seme e' un array piatto di id CORE seminati dall'onboarding. Entra a +0.3/id
// normalizzato, si somma ai click impliciti del grafo (+0.05/count), poi tutto
// viene ri-normalizzato col peso massimo = 1.0.

// Le 7 voci onboarding e i loro id CORE seminati (specchio di Onboarding.jsx).
const ONBOARDING_SEEDS = {
    food: ['food'],
    cultura: ['cultura', 'arte'],
    natura: ['natura'],
    nightlife: ['nightlife'],
    avventura: ['avventura'],
    relax: ['relax'],
    shopping: ['shopping'],
};

describe('computeWeights — seme onboarding (2o arg)', () => {
    it('seme ["food","arte"] → food e arte > 0, tutte le altre CORE = 0', () => {
        const w = computeWeights({}, ['food', 'arte']);
        expect(w.food).toBeGreaterThan(0);
        expect(w.arte).toBeGreaterThan(0);
        for (const cat of CORE_CATEGORIES) {
            if (cat !== 'food' && cat !== 'arte') {
                expect(w[cat]).toBe(0);
            }
        }
    });

    it('non-regressione: seme [] identico al comportamento default (arg omesso)', () => {
        const graph = { 'cat:food': 4, 'cat:cultura': 2, 'cat:natura': 1 };
        expect(computeWeights(graph, [])).toEqual(computeWeights(graph));
    });

    it('id ignoto ["romantic"] → scartato, nessun peso alterato, nessun crash', () => {
        const graph = { 'cat:food': 3 };
        // romantic non e' in CORE ne' negli alias → normalizeCategory = null.
        expect(normalizeCategory('romantic')).toBeNull();
        expect(computeWeights(graph, ['romantic'])).toEqual(computeWeights(graph, []));
    });

    it('seme + grafo: additivo, poi normalizzato a max 1.0', () => {
        // cultura ha 2 click (0.1), food e' seminato (0.3): il seme deve spingere
        // food sopra cultura, entrambi > 0, il max diventa 1.0.
        const w = computeWeights({ 'cat:cultura': 2 }, ['food']);
        expect(w.food).toBe(1.0);            // peso massimo → 1.0
        expect(w.cultura).toBeGreaterThan(0); // il click implicito resta
        expect(w.cultura).toBeLessThan(w.food);
        expect(Math.max(...Object.values(w))).toBe(1.0);
    });

    it('ogni id seminato dalle 7 voci supera normalizeCategory (nessun null)', () => {
        const allSeeded = [...new Set(Object.values(ONBOARDING_SEEDS).flat())];
        for (const id of allSeeded) {
            expect(normalizeCategory(id), `id seminato "${id}" non deve essere null`).not.toBeNull();
        }
        // e ognuno produce effettivamente un peso quando seminato da solo
        for (const id of allSeeded) {
            const w = computeWeights({}, [id]);
            expect(w[normalizeCategory(id)]).toBeGreaterThan(0);
        }
    });
});
