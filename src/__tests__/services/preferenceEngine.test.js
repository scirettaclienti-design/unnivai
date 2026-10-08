import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeWeights, normalizeCategory, CORE_CATEGORIES } from '../../services/preferenceEngine';

// Gate SEME (L1) — prima rete su computeWeights col 2o argomento (seme onboarding).
// Il seme e' un array piatto di id CORE seminati dall'onboarding. Entra a +0.3/id
// e si somma agli eventi pesati del grafo (`dna:<cat>`). P7a: niente piu'
// normalizzazione sul massimo.

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

    it('seme + eventi: additivo, SENZA normalizzazione sul massimo (P7a)', () => {
        // Prima: tutto ri-normalizzato col massimo = 1.0, cosi' un seme solo
        // diventava "food 100%". Ora il seme vale 0,3 e un "Dettagli" su un
        // museo 0,05: i numeri dicono quanto il DNA sa davvero.
        const w = computeWeights({ 'dna:cultura': 0.05, 'dna:events': 1 }, ['food']);
        expect(w.food).toBe(0.3);
        expect(w.cultura).toBe(0.05);
        expect(Math.max(...Object.values(w))).toBe(0.3);
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

// Gate SEME (L1) — invariante cleanup logout (#3). Scan cross-file del sorgente:
// la lista localKeys di AuthContext DEVE contenere sia lo STORAGE_KEY attuale del
// brain sia la chiave del seme. Se qualcuno rinomina STORAGE_KEY in useAILearning
// senza aggiornare il cleanup, questo test fallisce (bug di privacy R3 di ritorno).
// Nessun mock: si legge il codice reale a runtime.
const SRC = resolve(__dirname, '..', '..'); // src/
const learnSrc = readFileSync(resolve(SRC, 'hooks/useAILearning.js'), 'utf8');
const authSrc = readFileSync(resolve(SRC, 'context/AuthContext.jsx'), 'utf8');
const STORAGE_KEY = learnSrc.match(/STORAGE_KEY\s*=\s*['"]([^'"]+)['"]/)?.[1];
const SEED_KEY = learnSrc.match(/ONBOARDING_SEED_KEY\s*=\s*['"]([^'"]+)['"]/)?.[1];

describe('Gate SEME (L1) — invariante cleanup logout (source scan)', () => {
    it('STORAGE_KEY e ONBOARDING_SEED_KEY sono definiti in useAILearning', () => {
        expect(STORAGE_KEY, 'STORAGE_KEY non trovato in useAILearning.js').toBeTruthy();
        expect(SEED_KEY, 'ONBOARDING_SEED_KEY non trovato in useAILearning.js').toBeTruthy();
    });

    it('la cleanup logout rimuove il brain ATTUALE (STORAGE_KEY) — fallisce se rinominato senza aggiornare AuthContext', () => {
        expect(authSrc, `AuthContext non pulisce '${STORAGE_KEY}'`).toContain(`'${STORAGE_KEY}'`);
    });

    it('la cleanup logout rimuove la chiave seme onboarding', () => {
        expect(authSrc, `AuthContext non pulisce '${SEED_KEY}'`).toContain(`'${SEED_KEY}'`);
    });
});
