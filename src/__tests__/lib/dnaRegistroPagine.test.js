import { describe, it, expect, vi, beforeEach } from 'vitest';

// T29 — oltre 1000 righe il registro si legge a pagine: Mete e Risultati contano tutto.
const stato = vi.hoisted(() => ({ righe: [], rotta: false, chiamate: [] }));
vi.mock('../../lib/supabase.js', () => {
    const builder = () => {
        const b = {
            select: () => b,
            order: () => b,
            limit: (n) => { stato.chiamate.push(['limit', n]); return Promise.resolve({ data: stato.righe.slice(0, n), error: null }); },
            range: (da, a) => {
                stato.chiamate.push(['range', da, a]);
                return Promise.resolve(stato.rotta ? { data: null, error: { message: 'x' } } : { data: stato.righe.slice(da, a + 1), error: null });
            },
        };
        return b;
    };
    return { supabase: { from: () => builder() } };
});

import { leggiRegistro, REGISTRO_LETTURA_MAX, REGISTRO_PAGINE_MAX } from '../../lib/dnaRegistro';

const righe = (n) => Array.from({ length: n }, (_, i) => ({ id: `r${i}` }));
beforeEach(() => { stato.righe = []; stato.rotta = false; stato.chiamate = []; });

describe('leggiRegistro a pagine', () => {
    it('sotto il limite basta una richiesta', async () => {
        stato.righe = righe(770);
        const r = await leggiRegistro();
        expect(r.rows).toHaveLength(770);
        expect(stato.chiamate).toHaveLength(1);
    });
    it('oltre il limite legge le altre pagine', async () => {
        stato.righe = righe(2300);
        const r = await leggiRegistro();
        expect(r.rows).toHaveLength(2300);
        expect(stato.chiamate.map(c => c[0])).toEqual(['limit', 'range', 'range']);
    });
    it('si ferma al tetto delle pagine', async () => {
        stato.righe = righe(REGISTRO_LETTURA_MAX * (REGISTRO_PAGINE_MAX + 2));
        expect((await leggiRegistro()).rows).toHaveLength(REGISTRO_LETTURA_MAX * REGISTRO_PAGINE_MAX);
    });
    it('una pagina che fallisce non butta via la prima', async () => {
        stato.righe = righe(1500);
        stato.rotta = true;
        const r = await leggiRegistro();
        expect(r.ok).toBe(true);
        expect(r.rows).toHaveLength(REGISTRO_LETTURA_MAX);
    });
});
