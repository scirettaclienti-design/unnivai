import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pesiDaEventi } from '../../services/preferenceEngine';

// DNA-6 — le correzioni dal Profilo («piu'», «meno», «azzera») entrano nei pesi del registro.

const ORA = new Date('2026-10-23T12:00:00Z');
let n = 0;
const ev = (kind, category, value = null, created_at = '2026-10-23T11:00:00Z', extra = {}) =>
    ({ id: `e${++n}`, kind, category, value, created_at, tour_id: null, ...extra });

describe('DNA-6 — correzioni nei pesi', () => {
    it('«più di questo» alza la categoria di 0,15; «meno di questo» la abbassa di 0,15', () => {
        const base = [ev('tour_completed', 'food', null, '2026-10-23T09:00:00Z', { tour_id: 'g' })];
        const prima = pesiDaEventi(base, [], ORA).pesi.food;
        expect(prima).toBeCloseTo(0.3, 2);
        expect(pesiDaEventi([...base, ev('dna_correction', 'food', 'piu')], [], ORA).pesi.food).toBeCloseTo(0.45, 2);
        expect(pesiDaEventi([...base, ev('dna_correction', 'food', 'meno')], [], ORA).pesi.food).toBeCloseTo(0.15, 2);
    });

    it('«meno» non porta sotto zero', () => {
        const p = pesiDaEventi([ev('dna_correction', 'natura', 'meno'), ev('dna_correction', 'natura', 'meno')], [], ORA);
        expect(p.pesi.natura).toBe(0);
    });

    it('«azzera» porta la categoria a zero: eventi e seme di prima non contano più', () => {
        const righe = [
            ev('tour_completed', 'food', null, '2026-10-22T09:00:00Z', { tour_id: 'g1' }),
            ev('stop_reached', 'food', null, '2026-10-22T09:30:00Z', { tour_id: 'g1' }),
            ev('tour_completed', 'cultura', null, '2026-10-22T09:00:00Z', { tour_id: 'g1' }),
            ev('dna_correction', 'food', 'azzera', '2026-10-23T10:00:00Z'),
        ];
        const p = pesiDaEventi(righe, ['food', 'cultura'], ORA).pesi;
        expect(p.food).toBe(0);          // anche il seme del food e' azzerato
        expect(p.cultura).toBeGreaterThan(0.3); // le altre categorie non si toccano
    });

    it('dopo l\'azzeramento la categoria riparte: contano solo i gesti successivi', () => {
        const righe = [
            ev('tour_completed', 'food', null, '2026-10-22T09:00:00Z', { tour_id: 'g1' }),
            ev('dna_correction', 'food', 'azzera', '2026-10-23T08:00:00Z'),
            ev('dna_correction', 'food', 'piu', '2026-10-23T09:00:00Z'),
            ev('stop_reached', 'food', null, '2026-10-23T10:00:00Z', { tour_id: 'g2' }),
        ];
        expect(pesiDaEventi(righe, [], ORA).pesi.food).toBeCloseTo(0.15 + 0.05, 1);
    });

    it('le correzioni non fanno fiducia e non cambiano il peso nel motore', () => {
        const senza = pesiDaEventi([], ['food'], ORA);
        const con = pesiDaEventi([ev('dna_correction', 'food', 'piu'), ev('dna_correction', 'cultura', 'meno')], ['food'], ORA);
        expect(con.eventi).toBe(0);
        expect(con.share).toBe(senza.share);
    });

    it('una correzione senza categoria o con un valore sconosciuto non fa nulla', () => {
        const p = pesiDaEventi([ev('dna_correction', null, 'piu'), ev('dna_correction', 'food', 'boh')], [], ORA);
        expect(Object.values(p.pesi).every(v => v === 0)).toBe(true);
    });

    it('stessa correzione arrivata due volte (stesso id) conta una volta', () => {
        const c = ev('dna_correction', 'arte', 'piu');
        expect(pesiDaEventi([c, { ...c }], [], ORA).pesi.arte).toBeCloseTo(0.15, 2);
    });
});

describe('DNA-6 — la migrazione', () => {
    const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261023140326_dna6_correzioni_e_giri_salvati.sql'), 'utf8');
    it('aggiunge solo il gesto di correzione e la tabella dei giri salvati', () => {
        expect(sql).toMatch(/'dna_correction'/);
        expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.saved_tours/);
        expect(sql).not.toMatch(/DROP TABLE/i);
    });
    it('la correzione ammette solo piu / meno / azzera e vuole la categoria', () => {
        expect(sql).toMatch(/value IN \('piu', 'meno', 'azzera'\) AND category IS NOT NULL/);
    });
    it('RLS: ogni utente vede, inserisce e toglie solo i propri giri; nessun anonimo; nessun update', () => {
        expect(sql).toMatch(/ALTER TABLE public\.saved_tours ENABLE ROW LEVEL SECURITY/);
        expect(sql).toMatch(/REVOKE ALL ON public\.saved_tours FROM PUBLIC, anon, authenticated/);
        expect(sql).toMatch(/GRANT SELECT, INSERT, DELETE ON public\.saved_tours TO authenticated/);
        expect(sql).not.toMatch(/GRANT[^;]*UPDATE[^;]*saved_tours/i);
        expect(sql).not.toMatch(/saved_tours[^;]*TO anon/i);
        for (const op of ['FOR SELECT', 'FOR INSERT', 'FOR DELETE']) expect(sql).toContain(op);
        expect(sql.match(/user_id = auth\.uid\(\)/g).length).toBeGreaterThanOrEqual(3);
    });
    it('il segno test lo mette il server', () => {
        expect(sql).toMatch(/saved_tours_segna_test/);
        expect(sql).toMatch(/ai_quota_test_account/);
    });
});
