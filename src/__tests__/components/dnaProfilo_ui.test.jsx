// DNA-6 — Profilo: la scheda «Il tuo DNA» con la correzione, le Mete, i contatori veri e il tasto Salva.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement as h } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn(() => ({ user: { id: 'u1' } })) }));
vi.mock('../../hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
const mockToast = vi.fn();
vi.mock('../../lib/giriSalvati', async (orig) => ({ ...(await orig()), salvaGiro: vi.fn() }));

import DnaProfilo from '../../components/DnaProfilo';
import MeteProfilo from '../../components/MeteProfilo';
import SalvaGiro from '../../components/SalvaGiro';
import { useAuth } from '../../context/AuthContext';
import { salvaGiro } from '../../lib/giriSalvati';

const PESI = { cultura: 0.4, food: 0.6, nightlife: 0, natura: 0.1, avventura: 0, shopping: 0, relax: 0, arte: 0 };

beforeEach(() => { cleanup(); vi.clearAllMocks(); vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1' } }); });

describe('DNA-6 — Il tuo DNA', () => {
    it('mostra le categorie più forti in parole semplici e tutte le barre dei pesi', () => {
        render(h(DnaProfilo, { pesi: PESI, eventi: 7, puoCorreggere: true, onCorreggi: vi.fn() }));
        expect(screen.getByTestId('dna-frasi').textContent).toBe('Ti fermi dove si mangia bene. I musei li scegli con cura.');
        expect(screen.getByTestId('dna-food').textContent).toContain('60%');
        expect(screen.getByText('Costruito su 7 tuoi gesti.')).toBeTruthy();
    });
    it('«più di questo» scrive la correzione e dice «Fatto» solo se è andata a buon fine', async () => {
        const onCorreggi = vi.fn().mockResolvedValue({ ok: true });
        render(h(DnaProfilo, { pesi: PESI, puoCorreggere: true, onCorreggi }));
        fireEvent.click(screen.getByLabelText('Più cibo'));
        await waitFor(() => expect(screen.getByTestId('dna-esito').textContent).toBe('Fatto: più cibo.'));
        expect(onCorreggi).toHaveBeenCalledWith('food', 'piu');
        fireEvent.click(screen.getByLabelText('Meno natura'));
        await waitFor(() => expect(onCorreggi).toHaveBeenCalledWith('natura', 'meno'));
    });
    it('correzione non salvata: lo dice, non finge', async () => {
        render(h(DnaProfilo, { pesi: PESI, puoCorreggere: true, onCorreggi: vi.fn().mockResolvedValue({ ok: false }) }));
        fireEvent.click(screen.getByLabelText('Più cibo'));
        await waitFor(() => expect(screen.getByTestId('dna-esito').textContent).toMatch(/Non sono riuscito a salvare/));
    });
    it('«Azzera» di una categoria; «Azzera tutto» chiede conferma e azzera solo le categorie con peso', async () => {
        const onCorreggi = vi.fn().mockResolvedValue({ ok: true });
        render(h(DnaProfilo, { pesi: PESI, puoCorreggere: true, onCorreggi }));
        fireEvent.click(screen.getByLabelText('Azzera cibo'));
        await waitFor(() => expect(onCorreggi).toHaveBeenCalledWith('food', 'azzera'));
        onCorreggi.mockClear();
        fireEvent.click(screen.getByText('Azzera tutto il DNA'));
        expect(onCorreggi).not.toHaveBeenCalled(); // prima conferma
        fireEvent.click(screen.getByText(/Sicuro\?/));
        await waitFor(() => expect(screen.getByTestId('dna-esito').textContent).toBe('Fatto: il tuo DNA riparte da zero.'));
        expect(onCorreggi.mock.calls.map(c => c[0]).sort()).toEqual(['cultura', 'food', 'natura']);
    });
    it('senza segnale: «si sta formando»; da ospite niente correzione', () => {
        render(h(DnaProfilo, { pesi: {}, puoCorreggere: false, onCorreggi: vi.fn() }));
        expect(screen.getByText(/Il tuo DNA si sta formando/)).toBeTruthy();
        expect(screen.queryByLabelText('Più cibo')).toBeNull();
        expect(screen.getByText('Accedi per correggere il tuo DNA.')).toBeTruthy();
    });
});

describe('DNA-6 — Mete', () => {
    const mete = [{ tourId: 'g1', citta: 'Catania', data: '2026-10-21T12:00:00Z', categorie: ['food', 'cultura'], tappeRaggiunte: 3, tappeTotali: 5 }];
    it('un elemento per giro: città, data, tappe, categorie', () => {
        render(h(MeteProfilo, { mete, giriSalvati: [] }));
        const el = screen.getByTestId('meta');
        expect(el.textContent).toContain('Catania');
        expect(el.textContent).toContain('2026');
        expect(el.textContent).toContain('3 tappe raggiunte su 5');
        expect(el.textContent).toContain('Cibo');
    });
    it('senza giri: un testo onesto, nessun elemento', () => {
        render(h(MeteProfilo, { mete: [], giriSalvati: [] }));
        expect(screen.getByTestId('mete-vuote')).toBeTruthy();
        expect(screen.queryByTestId('meta')).toBeNull();
    });
    it('i giri salvati si vedono e si possono togliere', () => {
        const onRimuovi = vi.fn();
        render(h(MeteProfilo, { mete: [], giriSalvati: [{ id: 's1', title: 'Catania a tavola', city: 'Catania', stops: [{}, {}], created_at: '2026-10-23T10:00:00Z' }], onRimuovi }));
        expect(screen.getByTestId('giro-salvato').textContent).toContain('Catania a tavola');
        expect(screen.getByTestId('giro-salvato').textContent).toContain('2 tappe');
        fireEvent.click(screen.getByLabelText('Rimuovi Catania a tavola'));
        expect(onRimuovi).toHaveBeenCalledWith('s1');
    });
});

describe('DNA-6 — il tasto Salva', () => {
    const tour = { title: 'Catania a tavola', city: 'Catania', steps: [{ title: 'Pescheria', latitude: 37.5, longitude: 15.08 }] };
    it('salva e passa a «Salvato» solo a salvataggio riuscito', async () => {
        vi.mocked(salvaGiro).mockResolvedValue({ ok: true, giaSalvato: false });
        render(h(SalvaGiro, { tour, sorgente: 'quiz' }));
        fireEvent.click(screen.getByTestId('salva-giro'));
        await waitFor(() => expect(screen.getByTestId('salva-giro').textContent).toContain('Salvato'));
        expect(salvaGiro).toHaveBeenCalledWith('u1', tour, 'quiz');
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Giro salvato nel tuo Profilo.', type: 'success' }));
    });
    it('salvataggio fallito: il tasto resta «Salva» e avvisa', async () => {
        vi.mocked(salvaGiro).mockResolvedValue({ ok: false, errore: 'rete' });
        render(h(SalvaGiro, { tour, sorgente: 'crea' }));
        fireEvent.click(screen.getByTestId('salva-giro'));
        await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' })));
        expect(screen.getByTestId('salva-giro').textContent).toContain('Salva il giro');
    });
    it('ospite: non salva, dice di accedere', () => {
        vi.mocked(useAuth).mockReturnValue({ user: null });
        render(h(SalvaGiro, { tour, sorgente: 'per_te' }));
        fireEvent.click(screen.getByTestId('salva-giro'));
        expect(salvaGiro).not.toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/Accedi/) }));
    });
    it('un giro senza tappe non mostra il tasto', () => {
        const { container } = render(h(SalvaGiro, { tour: { title: 'Vuoto', steps: [] }, sorgente: 'quiz' }));
        expect(container.firstChild).toBeNull();
    });
    it('MemoryRouter non serve: il tasto non dipende dal router', () => {
        expect(() => render(h(MemoryRouter, null, h(SalvaGiro, { tour, sorgente: 'quiz' })))).not.toThrow();
    });
});
