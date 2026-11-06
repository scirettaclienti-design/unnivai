// DNA-6 — Profilo: la scheda «Il tuo DNA» con la correzione, le Mete, i contatori veri e il tasto Salva.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement as h, useState } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn(() => ({ user: { id: 'u1' } })) }));
vi.mock('../../hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
const mockToast = vi.fn();
vi.mock('../../lib/giriSalvati', async (orig) => ({ ...(await orig()), salvaGiro: vi.fn() }));

import DnaProfilo from '../../components/DnaProfilo';
import InterestsEditor from '../../components/InterestsEditor';
import FoodPrefsEditor from '../../components/FoodPrefsEditor';
import RitmoCompagniaEditor from '../../components/RitmoCompagniaEditor';
import { INTERESTS } from '../../lib/interests';
import { COMPAGNIE_PROFILO } from '../../lib/foodPrefs';
import MeteProfilo from '../../components/MeteProfilo';
import SalvaGiro from '../../components/SalvaGiro';
import { useAuth } from '../../context/AuthContext';
import { salvaGiro } from '../../lib/giriSalvati';

const PESI = { cultura: 0.4, food: 0.6, nightlife: 0, natura: 0.1, avventura: 0, shopping: 0, relax: 0, arte: 0 };

beforeEach(() => { cleanup(); vi.clearAllMocks(); vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1' } }); });

describe('PROFILO-SEZIONI — il DNA si legge', () => {
    const correzioneVera = () => {
        // come il Profilo: l'esito arriva dopo che i pesi si sono ricalcolati
        const Pagina = () => {
            const [pesi, setPesi] = useState(PESI);
            return h(DnaProfilo, { pesi, puoCorreggere: true, onCorreggi: async (c, a) => { setPesi(p => ({ ...p, [c]: a === 'piu' ? p[c] + 0.15 : Math.max(0, p[c] - 0.15) })); return { ok: true }; } });
        };
        render(h(Pagina));
    };
    it('dice come si legge la percentuale e cosa fanno + e −', () => {
        render(h(DnaProfilo, { pesi: PESI, puoCorreggere: true, onCorreggi: vi.fn() }));
        const l = screen.getByTestId('dna-legenda').textContent;
        expect(l).toContain('0% non conta, 100% è il massimo');
        expect(l).toContain('15 punti');
        expect(screen.getByTestId('dna-food').textContent).toContain('Forte');
        expect(screen.getByTestId('dna-cultura').textContent).toContain('Medio');
        expect(screen.getByTestId('dna-natura').textContent).toContain('Leggero');
        expect(screen.getByTestId('dna-arte').textContent).toContain('Non conta');
    });
    it('senza accesso non promette i tasti', () => {
        render(h(DnaProfilo, { pesi: PESI, puoCorreggere: false, onCorreggi: vi.fn() }));
        expect(screen.getByTestId('dna-legenda').textContent).not.toContain('15 punti');
    });
    it('dice quanto il DNA guida i giri, dalla fiducia vera', () => {
        const { rerender } = render(h(DnaProfilo, { pesi: PESI, fiducia: 0, onCorreggi: vi.fn() }));
        expect(screen.getByTestId('dna-fiducia').textContent).toContain('non lo usano ancora');
        rerender(h(DnaProfilo, { pesi: PESI, fiducia: 0.15, onCorreggi: vi.fn() }));
        expect(screen.getByTestId('dna-fiducia').textContent).toContain('guida poco');
        rerender(h(DnaProfilo, { pesi: PESI, fiducia: 0.45, onCorreggi: vi.fn() }));
        expect(screen.getByTestId('dna-fiducia').textContent).toContain('guida molto');
    });
    it('dopo un + l\'esito sta sotto quel gusto, con il numero che si è mosso', async () => {
        correzioneVera();
        fireEvent.click(screen.getByLabelText('Più cultura e storia'));
        await waitFor(() => expect(screen.getByTestId('dna-esito-numeri').textContent).toBe('40% → 55%'));
        expect(screen.getByTestId('dna-cultura').textContent).toContain('Fatto: più cultura e storia.');
    });
    it('la riga corretta non scappa: l\'ordine resta fermo anche se il peso sorpassa', async () => {
        correzioneVera();
        const ordine = () => screen.getAllByTestId(/^dna-(food|cultura)$/).map(e => e.dataset.testid);
        expect(ordine()).toEqual(['dna-food', 'dna-cultura']);
        fireEvent.click(screen.getByLabelText('Più cultura e storia'));
        await screen.findByTestId('dna-esito');
        fireEvent.click(screen.getByLabelText('Più cultura e storia'));
        await waitFor(() => expect(screen.getByTestId('dna-esito-numeri').textContent).toBe('55% → 70%'));
        expect(ordine()).toEqual(['dna-food', 'dna-cultura']);
    });
    it('«−» su un gusto a zero non finge un numero: dice cosa succede', async () => {
        render(h(DnaProfilo, { pesi: PESI, puoCorreggere: true, onCorreggi: vi.fn().mockResolvedValue({ ok: true }) }));
        fireEvent.click(screen.getByLabelText('Meno arte'));
        await waitFor(() => expect(screen.getByTestId('dna-esito-fermo').textContent).toContain('risalirà più piano'));
        expect(screen.queryByTestId('dna-esito-numeri')).toBeNull();
    });
    it('un gusto a zero non offre «Azzera»', () => {
        render(h(DnaProfilo, { pesi: PESI, puoCorreggere: true, onCorreggi: vi.fn() }));
        expect(screen.queryByLabelText('Azzera arte')).toBeNull();
    });
});

describe('PROFILO-SEZIONI — il salvataggio si vede', () => {
    const toast = vi.fn();
    const tasto = () => screen.getByTestId('profilo-salva');
    it('interessi: «Salvato» spento finché non cambi; con una modifica il tasto si accende e lo dice', async () => {
        const onSave = vi.fn().mockResolvedValue({ success: true });
        const Pagina = () => {
            const [v, setV] = useState(['storia']);
            return h(InterestsEditor, { value: v, toast, onSave: async (x) => { setV(x); return onSave(x); } });
        };
        render(h(Pagina));
        expect(tasto().dataset.stato).toBe('salvato');
        expect(tasto().disabled).toBe(true);
        expect(tasto().textContent).toBe('Salvato');
        fireEvent.click(screen.getByRole('button', { name: INTERESTS.find(i => i.id !== 'storia').label }));
        expect(tasto().dataset.stato).toBe('modificato');
        expect(tasto().disabled).toBe(false);
        expect(screen.getByTestId('profilo-da-salvare').textContent).toBe('Modifiche non ancora salvate.');
        fireEvent.click(tasto());
        await waitFor(() => expect(tasto().dataset.stato).toBe('salvato'));
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('profilo-da-salvare')).toBeNull();
    });
    it('interessi: senza nessuno scelto non si salva e lo dice', () => {
        const primo = INTERESTS[0];
        render(h(InterestsEditor, { value: [primo.id], onSave: vi.fn(), toast }));
        fireEvent.click(screen.getByRole('button', { name: primo.label }));
        expect(tasto().disabled).toBe(true);
        expect(screen.getByTestId('profilo-da-salvare').textContent).toBe('Scegline almeno uno.');
    });
    it('salvataggio fallito: resta da salvare e lo dice il messaggio', async () => {
        render(h(FoodPrefsEditor, { value: { dieta: [], budget: null, stile: null }, onSave: vi.fn().mockResolvedValue({ success: false, error: 'rete' }), toast }));
        fireEvent.click(screen.getByRole('button', { name: '€€' }));
        fireEvent.click(tasto());
        await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })));
        expect(tasto().dataset.stato).toBe('modificato');
    });
    it('a tavola e come giri: togliere la modifica riporta a «Salvato»', () => {
        render(h(RitmoCompagniaEditor, { value: { ritmo: null, compagnia: 'coppia' }, onSave: vi.fn(), toast }));
        expect(tasto().dataset.stato).toBe('salvato');
        fireEvent.click(screen.getAllByRole('button', { name: 'Lo impara Unnivai' })[1]);
        expect(tasto().dataset.stato).toBe('modificato');
        fireEvent.click(screen.getByRole('button', { name: COMPAGNIE_PROFILO.coppia }));
        expect(tasto().dataset.stato).toBe('salvato');
    });
});

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
