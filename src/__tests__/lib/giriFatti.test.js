// PROFILO-SEZIONI — i giri finiti: l'istantanea per «Rivivi», senza toccare il DNA, e il giro pronto da rifare.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import { giroFattoDaSalvare, salvaGiroFatto, leggiGiriFatti, giroDaRifare, conteggioGiroFatto, isGiroFatto, PREFISSO_FATTO } from '../../lib/giriSalvati';
import { logDnaEvent } from '../../lib/dnaRegistro';

vi.mock('../../lib/dnaRegistro', () => ({ logDnaEvent: vi.fn() }));

const ora = (s) => new Date(s).toISOString();
const GIRO = () => ({
    id: 'g1', title: 'Il tuo giro a Catania', city: 'Catania', sorgente: 'crea',
    steps: [
        { id: 'a', title: 'Caffè', lat: 37.5, lng: 15.08, scheduledTime: ora('2026-11-02T09:30:00+01:00'), openNow: true, currentHours: 'x', stayMinutes: 20 },
        { tempoLibero: true, title: 'Tempo libero', scheduledTime: ora('2026-11-02T10:00:00+01:00') },
        { id: 'b', title: 'Duomo', lat: 37.502, lng: 15.087, scheduledTime: ora('2026-11-02T11:15:00+01:00'), stayMinutes: 30, _tracciato: { diagnosi: 1 } },
    ],
});

beforeEach(() => { vi.resetAllMocks(); });

describe('l\'istantanea del giro finito', () => {
    it('ogni tappa dice se è stata raggiunta; niente diagnosi del motore', () => {
        const r = giroFattoDaSalvare(GIRO(), [0]);
        expect(r.tour_id.startsWith(PREFISSO_FATTO)).toBe(true);
        expect(isGiroFatto(r)).toBe(true);
        expect(r.source).toBe('crea');
        expect(r.stops.map(s => s.fatta)).toEqual([true, false, false]);
        expect(r.stops[2]._tracciato).toBeUndefined();
        expect(conteggioGiroFatto(r)).toEqual({ raggiunte: 1, totali: 2 }); // il tempo libero non è una tappa
    });
    it('stesso giro, stesso giorno: stessa riga; un giro rifatto o un altro giorno: un\'altra', () => {
        const giorno = new Date('2026-11-02T18:00:00+01:00');
        const a = giroFattoDaSalvare(GIRO(), [0], giorno).tour_id;
        expect(giroFattoDaSalvare(GIRO(), [0, 2], new Date('2026-11-02T19:00:00+01:00')).tour_id).toBe(a);
        expect(giroFattoDaSalvare({ ...GIRO(), id: 'rifatto-x' }, [0], giorno).tour_id).not.toBe(a);
        expect(giroFattoDaSalvare(GIRO(), [0], new Date('2026-11-03T10:00:00+01:00')).tour_id).not.toBe(a);
    });
    it('senza titolo prende quello di sempre; senza tappe non si scrive niente', () => {
        expect(giroFattoDaSalvare({ ...GIRO(), title: null }, [0]).title).toBe('Il tuo giro a Catania');
        expect(giroFattoDaSalvare({ steps: [] }, [])).toBeNull();
        expect(giroFattoDaSalvare(null, [])).toBeNull();
    });
    it('si scrive in saved_tours e NON registra un gesto del DNA', async () => {
        const insert = vi.fn().mockResolvedValue({ error: null });
        vi.mocked(supabase.from).mockReturnValue({ insert });
        expect(await salvaGiroFatto('u1', GIRO(), [0, 2])).toEqual({ ok: true });
        expect(supabase.from).toHaveBeenCalledWith('saved_tours');
        expect(insert.mock.calls[0][0].user_id).toBe('u1');
        expect(logDnaEvent).not.toHaveBeenCalled();
    });
    it('la stessa riga due volte non è un errore; un guasto non rigetta; senza utente non scrive', async () => {
        vi.mocked(supabase.from).mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { code: '23505' } }) });
        expect((await salvaGiroFatto('u1', GIRO(), [0])).ok).toBe(true);
        vi.mocked(supabase.from).mockImplementation(() => { throw new Error('boom'); });
        expect((await salvaGiroFatto('u1', GIRO(), [0])).ok).toBe(false);
        expect((await salvaGiroFatto(null, GIRO(), [0])).ok).toBe(false);
    });
    it('legge solo i giri finiti, dal più recente; un guasto dà un elenco vuoto', async () => {
        const chain = { select: vi.fn().mockReturnThis(), like: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [{ id: 'a' }], error: null }) };
        vi.mocked(supabase.from).mockReturnValue(chain);
        expect(await leggiGiriFatti()).toEqual({ ok: true, giri: [{ id: 'a' }] });
        expect(chain.like).toHaveBeenCalledWith('tour_id', 'fatto-%');
        vi.mocked(supabase.from).mockImplementation(() => { throw new Error('boom'); });
        expect(await leggiGiriFatti()).toEqual({ ok: false, giri: [] });
    });
});

describe('rifare un giro', () => {
    const riga = () => ({ id: 'r1', source: 'crea', created_at: '2026-11-02T20:00:00Z', ...giroFattoDaSalvare(GIRO(), [0, 2]) });

    it('id nuovo a ogni rifacimento, stesse tappe, niente di quel giorno (fatta, aperto adesso)', () => {
        const t = giroDaRifare(riga(), new Date('2026-11-06T08:00:00+01:00'));
        expect(t.id).not.toBe(giroDaRifare(riga(), new Date('2026-11-06T08:01:00+01:00')).id);
        expect(t.id.startsWith('rifatto-r1-')).toBe(true);
        expect(t.steps.map(s => s.title)).toEqual(['Caffè', 'Tempo libero', 'Duomo']);
        expect(t.steps.some(s => 'fatta' in s || 'openNow' in s || 'currentHours' in s)).toBe(false);
        expect(t.salvatoDa).toBeUndefined();
        expect(t.stops).toBe(t.steps);
    });
    it('prima tappa ancora da venire: oggi, stessi orari sull\'orologio', () => {
        const t = giroDaRifare(riga(), new Date('2026-11-06T08:00:00+01:00'));
        expect(t.steps[0].scheduledTime).toBe(ora('2026-11-06T09:30:00+01:00'));
        expect(t.steps[2].scheduledTime).toBe(ora('2026-11-06T11:15:00+01:00'));
    });
    it('orario già passato: domani', () => {
        const t = giroDaRifare(riga(), new Date('2026-11-06T15:00:00+01:00'));
        expect(t.steps[0].scheduledTime).toBe(ora('2026-11-07T09:30:00+01:00'));
    });
    it('oltre il cambio dell\'ora l\'orologio resta quello', () => {
        const estate = { id: 'r2', title: 'Giro', stops: [{ title: 'A', lat: 1, lng: 2, scheduledTime: ora('2026-07-02T09:30:00+02:00') }] };
        expect(giroDaRifare(estate, new Date('2026-11-06T08:00:00+01:00')).steps[0].scheduledTime).toBe(ora('2026-11-06T09:30:00+01:00'));
    });
    it('un giro su due giorni resta su due giorni', () => {
        const due = { id: 'r3', title: 'Giro', stops: [
            { title: 'A', lat: 1, lng: 2, scheduledTime: ora('2026-11-02T09:30:00+01:00') },
            { title: 'B', lat: 1, lng: 2, scheduledTime: ora('2026-11-03T09:30:00+01:00') },
        ] };
        expect(giroDaRifare(due, new Date('2026-11-06T08:00:00+01:00')).steps[1].scheduledTime).toBe(ora('2026-11-07T09:30:00+01:00'));
    });
    it('una riga senza orari si rifà lo stesso', () => {
        const t = giroDaRifare({ id: 'r4', title: 'Giro', stops: [{ title: 'A', lat: 1, lng: 2 }] }, new Date());
        expect(t.steps[0].scheduledTime).toBeUndefined();
        expect(giroDaRifare(null)).toBeNull();
    });
});
