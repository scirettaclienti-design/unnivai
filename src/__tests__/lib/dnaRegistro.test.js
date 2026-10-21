import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { supabase } from '@/lib/supabase';
import {
    DNA_REGISTRO_KINDS, righeDelGesto, logDnaEvent, gestiDelQuiz, gestiDiCrea, logDnaGesti,
} from '../../lib/dnaRegistro';

// DNA-1 — il registro degli eventi del DNA: un test per ciascun tipo di evento,
// il comportamento senza sessione e con la rete che cade, e le regole della migrazione (RLS).

const ORIGINE = (rel) => readFileSync(resolve(__dirname, '../../..', rel), 'utf8');

let insert;
function sessione(userId) {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: userId ? { user: { id: userId } } : null } });
}
beforeEach(() => {
    vi.resetAllMocks();
    insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockReturnValue({ insert });
    sessione('utente-1');
});

describe('DNA-1 — un test per ciascun tipo di evento', () => {
    it('i gesti ammessi sono esattamente i sette della tabella', () => {
        expect(DNA_REGISTRO_KINDS).toEqual([
            'tour_completed', 'stop_skipped', 'tour_saved', 'quiz_choice',
            'pace_chosen', 'company_chosen', 'stop_reached',
        ]);
        expect(ORIGINE('supabase/migrations/20261021_dna_events.sql'))
            .toContain("'tour_completed', 'stop_skipped', 'tour_saved', 'quiz_choice',\n        'pace_chosen', 'company_chosen', 'stop_reached'");
    });

    it('giro completato: una riga per categoria, con città e giro', async () => {
        await logDnaEvent('tour_completed', { categories: ['food', 'cultura'], city: 'Roma', tourId: 'giro-7' });
        expect(supabase.from).toHaveBeenCalledWith('dna_events');
        expect(insert).toHaveBeenCalledWith([
            { kind: 'tour_completed', category: 'food', city: 'Roma', value: null, moment: null, tour_id: 'giro-7', user_id: 'utente-1' },
            { kind: 'tour_completed', category: 'cultura', city: 'Roma', value: null, moment: null, tour_id: 'giro-7', user_id: 'utente-1' },
        ]);
    });

    it('tappa saltata: categoria, città, momento e giro', async () => {
        await logDnaEvent('stop_skipped', { category: 'natura', city: 'Catania', moment: 'mattina', tourId: 'g1' });
        expect(insert).toHaveBeenCalledWith([
            { kind: 'stop_skipped', category: 'natura', city: 'Catania', value: null, moment: 'mattina', tour_id: 'g1', user_id: 'utente-1' },
        ]);
    });

    it('giro salvato: le categorie del giro', async () => {
        await logDnaEvent('tour_saved', { categories: ['arte'], city: 'Napoli', tourId: 42 });
        expect(insert.mock.calls[0][0]).toEqual([
            { kind: 'tour_saved', category: 'arte', city: 'Napoli', value: null, moment: null, tour_id: '42', user_id: 'utente-1' },
        ]);
    });

    it('scelta del Quiz: la categoria della scelta principale e la sotto-scelta', async () => {
        const gesti = gestiDelQuiz({ main: 'natura', sub: 'parchi', group: 'coppia', city: 'Roma' });
        logDnaGesti(gesti);
        await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(2));
        expect(insert.mock.calls[0][0][0]).toMatchObject({ kind: 'quiz_choice', category: 'natura', value: 'natura:parchi', city: 'Roma' });
    });

    it('scelta del Quiz senza categoria di gusto (città): categoria nulla, valore registrato', () => {
        const [g] = gestiDelQuiz({ main: 'citta', sub: 'centro' });
        expect(righeDelGesto(g.kind, g.campi)[0]).toMatchObject({ kind: 'quiz_choice', category: null, value: 'citta:centro' });
    });

    it('ritmo scelto (Crea il tuo Percorso)', async () => {
        logDnaGesti(gestiDiCrea({ pace: 'Rilassato', group: '', city: 'Lecce' }));
        await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
        expect(insert.mock.calls[0][0][0]).toMatchObject({ kind: 'pace_chosen', value: 'Rilassato', city: 'Lecce', category: null });
    });

    it('compagnia scelta (Quiz e Crea)', async () => {
        logDnaGesti(gestiDiCrea({ pace: '', group: 'Amici', city: 'Lecce' }));
        await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
        expect(insert.mock.calls[0][0][0]).toMatchObject({ kind: 'company_chosen', value: 'Amici' });
        expect(gestiDelQuiz({ main: 'storia', group: 'solo' }).map(g => g.kind)).toEqual(['quiz_choice', 'company_chosen']);
    });

    it('tappa raggiunta: categoria, città e momento', async () => {
        await logDnaEvent('stop_reached', { category: 'food', city: 'Roma', moment: 'pranzo', tourId: 'g9' });
        expect(insert.mock.calls[0][0]).toEqual([
            { kind: 'stop_reached', category: 'food', city: 'Roma', value: null, moment: 'pranzo', tour_id: 'g9', user_id: 'utente-1' },
        ]);
    });
});

describe('DNA-1 — non blocca mai, non registra ciò che non deve', () => {
    it('senza sessione (ospite) non scrive niente', async () => {
        sessione(null);
        await logDnaEvent('stop_skipped', { category: 'natura' });
        expect(insert).not.toHaveBeenCalled();
    });

    it('un gesto non ammesso non scrive niente', async () => {
        await logDnaEvent('tour_rated', { categories: ['food'] });
        await logDnaEvent('stop_detail', { categories: ['food'] });
        expect(insert).not.toHaveBeenCalled();
    });

    it('se il salvataggio fallisce non lancia e non rigetta', async () => {
        insert.mockResolvedValue({ error: { message: 'rete caduta' } });
        await expect(logDnaEvent('stop_reached', { category: 'food' })).resolves.toBeUndefined();
        insert.mockRejectedValue(new Error('boom'));
        await expect(logDnaEvent('stop_reached', { category: 'food' })).resolves.toBeUndefined();
        vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error('sessione'));
        await expect(logDnaEvent('stop_reached', { category: 'food' })).resolves.toBeUndefined();
    });

    it('non aspetta il salvataggio: la funzione risolve anche se la scrittura è ancora in corso', async () => {
        insert.mockReturnValue(new Promise(() => {})); // non risolve mai
        await expect(logDnaEvent('stop_reached', { category: 'food' })).resolves.toBeUndefined();
    });

    it('taglia i valori alle lunghezze della tabella e non porta altri campi', () => {
        const r = righeDelGesto('quiz_choice', { value: 'x'.repeat(200), city: 'y'.repeat(200), sconosciuto: 'email@x.it' })[0];
        expect(r.value).toHaveLength(80);
        expect(r.city).toHaveLength(80);
        expect(Object.keys(r).sort()).toEqual(['category', 'city', 'kind', 'moment', 'tour_id', 'value']);
    });

    it('la scrittura va solo su dna_events', async () => {
        await logDnaEvent('stop_reached', { category: 'food' });
        expect(vi.mocked(supabase.from).mock.calls.every(c => c[0] === 'dna_events')).toBe(true);
    });
});

describe('DNA-1 — dove il registro è collegato (i gesti dell\'app)', () => {
    it('MapPage registra tappa raggiunta e tappa saltata, e il giro completato passa dal DNA', () => {
        const mappa = ORIGINE('src/pages/MapPage.jsx');
        expect(mappa).toMatch(/logDnaEvent\('stop_reached', gestoDellaTappa\(poiObj\)\)/);
        expect(mappa).toMatch(/logDnaEvent\('stop_skipped', gestoDellaTappa\(poiObj\)\)/);
        expect(mappa).toMatch(/trackDnaEvent\?\.\('tour_completed'[^\n]*tourId/);
    });

    it('la tappa saltata NON passa da trackDnaEvent: i pesi non cambiano (sarà DNA-2)', () => {
        expect(ORIGINE('src/pages/MapPage.jsx')).not.toMatch(/trackDnaEvent\?\.\('stop_skipped'/);
    });

    it('giro salvato, Quiz e Crea sono collegati', () => {
        expect(ORIGINE('src/pages/TourLive.jsx')).toMatch(/trackDnaEvent\?\.\('tour_saved'[^\n]*tourId: tour\.id/);
        expect(ORIGINE('src/pages/QuickPath.jsx')).toMatch(/logDnaGesti\(gestiDelQuiz\(/);
        expect(ORIGINE('src/pages/AiItinerary.jsx')).toMatch(/logDnaGesti\(gestiDiCrea\(/);
    });

    it('i pesi non cambiano: il motore dei pesi non è toccato da DNA-1', () => {
        const motore = ORIGINE('src/services/preferenceEngine.js');
        expect(motore).not.toMatch(/dnaRegistro|dna_events/);
        expect(ORIGINE('src/hooks/useAILearning.js')).toMatch(/applyDnaEvent\(prev\.preferenceGraph, kind, categories, opts\)/);
    });
});

describe('DNA-1 — RLS della tabella (dalla migrazione)', () => {
    const sql = ORIGINE('supabase/migrations/20261021_dna_events.sql');

    it('RLS attiva, nessun accesso anonimo, solo SELECT e INSERT agli utenti', () => {
        expect(sql).toMatch(/ALTER TABLE public\.dna_events ENABLE ROW LEVEL SECURITY/);
        expect(sql).toMatch(/REVOKE ALL ON public\.dna_events FROM PUBLIC, anon, authenticated/);
        expect(sql).toMatch(/GRANT SELECT, INSERT ON public\.dna_events TO authenticated/);
        expect(sql).not.toMatch(/GRANT[^;]*\b(UPDATE|DELETE)\b[^;]*TO authenticated/);
        expect(sql).not.toMatch(/TO anon/);
    });

    it('ogni utente inserisce e legge solo le proprie righe', () => {
        expect(sql).toMatch(/FOR INSERT TO authenticated\s+WITH CHECK \(user_id = auth\.uid\(\)\)/);
        expect(sql).toMatch(/FOR SELECT TO authenticated\s+USING \(user_id = auth\.uid\(\)\)/);
        expect((sql.match(/CREATE POLICY/g) || []).length).toBe(2);
    });

    it('il segno test lo decide il server, non il client', () => {
        expect(sql).toMatch(/dna_events_segna_test/);
        expect(sql).toMatch(/ai_quota_test_account/);
        expect(sql).toMatch(/BEFORE INSERT/);
    });
});
