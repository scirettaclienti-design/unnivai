// DNA-6 — la pagina Profilo: contatori veri al posto dei «—», DNA dai pesi, Mete dal registro;
// e il tasto Salva è collegato in tutte le superfici dei giri generati.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement as h } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const righe = [
    { id: '1', kind: 'tour_completed', category: 'food', city: 'Catania', value: '3/3', tour_id: 'g1', created_at: '2026-10-21T12:00:00Z' },
    { id: '2', kind: 'stop_reached', category: 'food', city: 'Catania', value: null, tour_id: 'g1', created_at: '2026-10-21T11:00:00Z' },
    { id: '3', kind: 'stop_reached', category: 'cultura', city: 'Catania', value: null, tour_id: 'g1', created_at: '2026-10-21T11:30:00Z' },
];
const correggiDna = vi.fn().mockResolvedValue({ ok: true });
let hook;
vi.mock('../../hooks/useAILearning', () => ({ useAILearning: () => hook }));
let contesto = { userId: 'u1', firstName: 'Prova', city: 'Catania' };
vi.mock('../../hooks/useUserContext', () => ({ useUserContext: () => contesto }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'p@example.com' } }) }));
vi.mock('../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../components/TopBar', () => ({ default: () => null }));
vi.mock('../../components/BottomNavigation', () => ({ default: () => null }));
vi.mock('../../components/ChatModalUser', () => ({ default: () => null }));
vi.mock('../../components/FoodPrefsEditor', () => ({ default: () => null }));
vi.mock('../../components/InterestsEditor', () => ({ default: () => null }));
vi.mock('../../lib/giriSalvati', () => ({
    leggiGiriSalvati: vi.fn(async () => ({ ok: true, giri: [{ id: 's1', title: 'Catania a tavola', city: 'Catania', stops: [{}, {}], created_at: '2026-10-23T10:00:00Z' }] })),
    rimuoviGiroSalvato: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../../lib/supabase', () => {
    const chain = { select: () => chain, eq: () => chain, in: () => chain, order: () => chain, limit: async () => ({ data: [], error: null }) };
    return { supabase: { from: () => chain, auth: { getSession: vi.fn() } } };
});

import ProfilePage from '../../pages/Profile';

const LEGGI = (rel) => readFileSync(resolve(__dirname, '../..', rel), 'utf8');

beforeEach(() => {
    cleanup();
    contesto = { userId: 'u1', firstName: 'Prova', city: 'Catania' };
    hook = {
        weights: { cultura: 0.2, food: 0.5, nightlife: 0, natura: 0, avventura: 0, shopping: 0, relax: 0, arte: 0 },
        dnaEvents: 4, ritmoPreferito: null, compagniaPreferita: null,
        righeRegistro: righe, correggiDna, onboardingPrefs: {}, saveFoodPrefs: vi.fn(), interestIds: [], saveInterests: vi.fn(),
    };
});
const apri = () => render(h(MemoryRouter, null, h(ProfilePage)));

describe('DNA-6 — Profilo', () => {
    it('i contatori sono veri (giri, città, tappe), non trattini', () => {
        apri();
        expect(screen.getByTestId('contatore-giri').textContent).toBe('1');
        expect(screen.getByTestId('contatore-citta').textContent).toBe('1');
        expect(screen.getByTestId('contatore-tappe').textContent).toBe('2');
        expect(screen.getByTestId('contatori-profilo').textContent).not.toContain('—');
    });
    it('registro vuoto: zeri veri e la frase del primo giro', () => {
        hook.righeRegistro = [];
        apri();
        expect(screen.getByTestId('contatore-giri').textContent).toBe('0');
        expect(screen.getByText(/Il tuo primo giro ti aspetta/)).toBeTruthy();
    });
    it('Il tuo DNA mostra i pesi del registro, non i vecchi contatori cat:', () => {
        apri();
        expect(screen.getByTestId('dna-frasi').textContent).toContain('Ti fermi dove si mangia bene.');
        fireEvent.click(screen.getByLabelText('Più cibo'));
        expect(correggiDna).toHaveBeenCalledWith('food', 'piu');
    });
    it('senza posizione (userId di useUserContext vuoto) chi ha fatto l\'accesso corregge lo stesso il DNA e vede i giri salvati', async () => {
        contesto = { firstName: 'Prova' };
        apri();
        expect(screen.queryByText(/Accedi per correggere/)).toBeNull();
        fireEvent.click(screen.getByLabelText('Più cibo'));
        expect(correggiDna).toHaveBeenCalledWith('food', 'piu');
        fireEvent.click(screen.getByText('Mete'));
        await waitFor(() => expect(screen.getByTestId('giro-salvato')).toBeTruthy());
    });
    it('Mete: il giro completato e il giro salvato', async () => {
        apri();
        fireEvent.click(screen.getByText('Mete'));
        const meta = await screen.findByTestId('meta');
        expect(meta.textContent).toContain('Catania');
        expect(meta.textContent).toContain('2 tappe raggiunte su 3');
        await waitFor(() => expect(screen.getByTestId('giro-salvato').textContent).toContain('Catania a tavola'));
    });
});

describe('DNA-6 — il tasto Salva è nelle quattro superfici', () => {
    it('Quiz (riepilogo), Crea, Per Te e Sorprendimi (dettaglio) usano SalvaGiro con la loro sorgente', () => {
        expect(LEGGI('components/Map/QuickPathSummary.jsx')).toContain('<SalvaGiro tour={tourData} sorgente="quiz" />');
        expect(LEGGI('pages/AiItinerary.jsx')).toMatch(/<SalvaGiro[\s\S]*?sorgente="crea"/);
        const td = LEGGI('pages/TourDetails.jsx');
        expect(td).toContain('<SalvaGiro tour={tour}');
        expect(td).toContain("'sorprendimi'");
        expect(td).toContain("'per_te'");
        expect(LEGGI('pages/DashboardUser.jsx')).toContain("origine: 'per_te'");
        expect(LEGGI('pages/SurpriseTour.jsx')).toContain("origine: 'sorprendimi'");
    });
    it('il giro completato scrive «raggiunte/totali» e il motore dei giri non è toccato', () => {
        expect(LEGGI('pages/MapPage.jsx')).toContain('value: `${raggiunte}/${activeRoute.length}`');
        expect(LEGGI('hooks/useAILearning.js')).toContain('value: opts.value');
    });
});
