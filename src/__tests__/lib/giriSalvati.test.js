import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabase } from '@/lib/supabase';
import { giroDaSalvare, idStabile, salvaGiro, leggiGiriSalvati, rimuoviGiroSalvato, categorieDelGiro } from '../../lib/giriSalvati';
import { scriviCorrezione } from '../../lib/dnaRegistro';

// DNA-6 — salvare un giro generato: la riga, l'esito vero, `tour_saved` solo se il salvataggio è riuscito.

const giro = {
    id: 'home-food-1729',
    title: 'Catania a tavola',
    city: 'Catania',
    steps: [
        { title: 'Pescheria', latitude: 37.5, longitude: 15.08, types: ['market'] },
        { name: 'Trattoria Etna', lat: '37.51', lng: '15.09', types: ['restaurant'] },
        { title: 'Tempo libero', tempoLibero: true },
    ],
};

let inserts;
function dbCon(risposte) {
    inserts = [];
    vi.mocked(supabase.from).mockImplementation((tabella) => ({
        insert: vi.fn((riga) => { inserts.push({ tabella, riga }); return Promise.resolve(risposte[tabella] ?? { error: null }); }),
    }));
}
beforeEach(() => { vi.resetAllMocks(); });

describe('DNA-6 — la riga del giro salvato', () => {
    it('titolo, città, tappe con nome e coordinate; il tempo libero non è una tappa', () => {
        const r = giroDaSalvare(giro, 'per_te');
        expect(r).toMatchObject({ title: 'Catania a tavola', city: 'Catania', source: 'per_te' });
        expect(r.stops).toEqual([
            { title: 'Pescheria', lat: 37.5, lng: 15.08 },
            { title: 'Trattoria Etna', lat: 37.51, lng: 15.09 },
        ]);
    });
    it('l\'id nasce dal contenuto: lo stesso giro ha sempre lo stesso id, anche se l\'id del giro cambia', () => {
        const a = giroDaSalvare(giro, 'quiz').tour_id;
        const b = giroDaSalvare({ ...giro, id: 'altro-id-9999' }, 'quiz').tour_id;
        expect(a).toBe(b);
        expect(a).toBe(idStabile('quiz', ['Catania a tavola', 'Catania', 'Pescheria', 'Trattoria Etna']));
        expect(giroDaSalvare({ ...giro, title: 'Un altro giro' }, 'quiz').tour_id).not.toBe(a);
    });
    it('un giro senza titolo o senza tappe non si salva', () => {
        expect(giroDaSalvare({ ...giro, title: '' }, 'quiz')).toBeNull();
        expect(giroDaSalvare({ title: 'Vuoto', steps: [] }, 'quiz')).toBeNull();
        expect(giroDaSalvare(null, 'quiz')).toBeNull();
    });
    it('una sorgente sconosciuta diventa «altro»; al massimo 30 tappe', () => {
        expect(giroDaSalvare(giro, 'boh').source).toBe('altro');
        const lungo = { title: 'Lungo', stops: Array.from({ length: 40 }, (_, i) => ({ title: `T${i}` })) };
        expect(giroDaSalvare(lungo, 'crea').stops).toHaveLength(30);
    });
    it('le categorie del giro vengono dai tipi delle tappe', () => {
        expect(categorieDelGiro(giro).sort()).toEqual(['food', 'shopping']);
    });
});

describe('DNA-6 — salvaGiro', () => {
    it('salva sul server e, solo allora, registra tour_saved con le categorie', async () => {
        supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
        dbCon({});
        const r = await salvaGiro('u1', giro, 'per_te');
        expect(r).toEqual({ ok: true, giaSalvato: false });
        const salvati = inserts.filter(i => i.tabella === 'saved_tours');
        expect(salvati).toHaveLength(1);
        expect(salvati[0].riga).toMatchObject({ user_id: 'u1', source: 'per_te', title: 'Catania a tavola' });
        await Promise.resolve(); await Promise.resolve();
        const eventi = inserts.filter(i => i.tabella === 'dna_events').flatMap(i => i.riga);
        expect(eventi.map(e => e.kind)).toEqual(['tour_saved', 'tour_saved']);
        expect(eventi.map(e => e.category).sort()).toEqual(['food', 'shopping']);
        expect(eventi[0].tour_id).toBe(salvati[0].riga.tour_id);
    });
    it('se il server rifiuta, non dice «salvato» e non registra tour_saved', async () => {
        supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
        dbCon({ saved_tours: { error: { message: 'rete caduta', code: '08006' } } });
        const r = await salvaGiro('u1', giro, 'quiz');
        expect(r.ok).toBe(false);
        expect(inserts.some(i => i.tabella === 'dna_events')).toBe(false);
    });
    it('lo stesso giro salvato due volte non è un errore e non conta due volte', async () => {
        supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
        dbCon({ saved_tours: { error: { code: '23505', message: 'duplicate' } } });
        const r = await salvaGiro('u1', giro, 'quiz');
        expect(r).toEqual({ ok: true, giaSalvato: true });
        expect(inserts.some(i => i.tabella === 'dna_events')).toBe(false);
    });
    it('un ospite non salva; un errore che lancia non rigetta', async () => {
        dbCon({});
        expect(await salvaGiro(null, giro, 'quiz')).toMatchObject({ ok: false });
        expect(inserts).toHaveLength(0);
        vi.mocked(supabase.from).mockImplementation(() => { throw new Error('boom'); });
        expect(await salvaGiro('u1', giro, 'quiz')).toMatchObject({ ok: false });
    });
});

describe('DNA-6 — lettura e rimozione', () => {
    it('legge i giri salvati dal più recente', async () => {
        const chain = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [{ id: 'a' }], error: null }) };
        vi.mocked(supabase.from).mockReturnValue(chain);
        expect(await leggiGiriSalvati()).toEqual({ ok: true, giri: [{ id: 'a' }] });
        expect(supabase.from).toHaveBeenCalledWith('saved_tours');
        expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });
    it('lettura fallita: ok falso, mai un\'eccezione', async () => {
        vi.mocked(supabase.from).mockImplementation(() => { throw new Error('boom'); });
        expect(await leggiGiriSalvati()).toEqual({ ok: false, giri: [] });
    });
    it('rimuove un giro per id', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null });
        vi.mocked(supabase.from).mockReturnValue({ delete: vi.fn(() => ({ eq })) });
        expect(await rimuoviGiroSalvato('x1')).toEqual({ ok: true });
        expect(eq).toHaveBeenCalledWith('id', 'x1');
    });
});

describe('DNA-6 — scriviCorrezione', () => {
    it('scrive la correzione e restituisce la riga', async () => {
        const single = vi.fn().mockResolvedValue({ data: { id: 'r1', kind: 'dna_correction', category: 'food', value: 'piu', created_at: 'now' }, error: null });
        const insert = vi.fn(() => ({ select: () => ({ single }) }));
        vi.mocked(supabase.from).mockReturnValue({ insert });
        const r = await scriviCorrezione('u1', 'food', 'piu');
        expect(insert).toHaveBeenCalledWith({ user_id: 'u1', kind: 'dna_correction', category: 'food', value: 'piu' });
        expect(r.ok).toBe(true);
        expect(r.row.id).toBe('r1');
    });
    it('server che rifiuta: ok falso; dati sbagliati: nessuna scrittura', async () => {
        const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'no' } });
        vi.mocked(supabase.from).mockReturnValue({ insert: () => ({ select: () => ({ single }) }) });
        expect((await scriviCorrezione('u1', 'food', 'meno')).ok).toBe(false);
        vi.mocked(supabase.from).mockClear();
        expect((await scriviCorrezione('u1', 'food', 'molto')).ok).toBe(false);
        expect((await scriviCorrezione('u1', '', 'piu')).ok).toBe(false);
        expect((await scriviCorrezione(null, 'food', 'piu')).ok).toBe(false);
        expect(supabase.from).not.toHaveBeenCalled();
    });
});
