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
vi.mock('../../components/MappaDelGiro', () => ({ default: () => null }));
vi.mock('../../components/FoodPrefsEditor', () => ({ default: () => null }));
vi.mock('../../components/InterestsEditor', () => ({ default: () => null }));
const STOPS_SALVATE_FN = () => STOPS_SALVATE;
let giriFatti = [];
const GIRI_FATTI_FN = () => giriFatti;
const T0 = (hhmm) => new Date(`2026-10-25T${hhmm}:00+01:00`).toISOString();
const STOPS_SALVATE = [
    { title: 'Caffè Puglisi', lat: 37.5, lng: 15.08, latitude: 37.5, longitude: 15.08, place_id: 'p1', moment: 'mattina', momentLabel: 'Mattina', scheduledTime: T0('09:30'), stayMinutes: 20, description: 'Si parte da Caffè Puglisi: un caffè e si comincia.', types: ['cafe'] },
    { title: 'Basilica Cattedrale', lat: 37.502, lng: 15.087, latitude: 37.502, longitude: 15.087, place_id: 'p2', moment: 'mattina', momentLabel: 'Mattina', scheduledTime: T0('10:01'), stayMinutes: 30, description: 'Ti prendi mezz\'ora dentro la Basilica.', types: ['church'] },
];
vi.mock('../../lib/giriSalvati', async () => ({
    ...(await vi.importActual('../../lib/giriSalvati')),
    leggiGiriSalvati: vi.fn(async () => ({ ok: true, giri: [{ id: 's1', title: 'Catania a tavola', city: 'Catania', source: 'crea', stops: STOPS_SALVATE_FN(), created_at: '2026-10-23T10:00:00Z' }] })),
    rimuoviGiroSalvato: vi.fn(async () => ({ ok: true })),
    leggiGiriFatti: vi.fn(async () => ({ ok: true, giri: GIRI_FATTI_FN() })),
}));
const navigaMock = vi.fn();
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useNavigate: () => navigaMock }));
vi.mock('../../lib/supabase', () => {
    const chain = { select: () => chain, eq: () => chain, in: () => chain, order: () => chain, limit: async () => ({ data: [], error: null }) };
    return { supabase: { from: () => chain, auth: { getSession: vi.fn() } } };
});

import ProfilePage from '../../pages/Profile';

const LEGGI = (rel) => readFileSync(resolve(__dirname, '../..', rel), 'utf8');

beforeEach(() => {
    cleanup();
    contesto = { userId: 'u1', firstName: 'Prova', city: 'Catania' };
    giriFatti = [];
    hook = {
        weights: { cultura: 0.2, food: 0.5, nightlife: 0, natura: 0, avventura: 0, shopping: 0, relax: 0, arte: 0 },
        dnaEvents: 4, ritmoPreferito: null, compagniaPreferita: null,
        righeRegistro: righe, correggiDna, onboardingPrefs: {}, saveFoodPrefs: vi.fn(), interestIds: [], saveInterests: vi.fn(),
    };
});
const apri = () => render(h(MemoryRouter, null, h(ProfilePage)));

// PROFILO-SEZIONI — le sezioni del Profilo funzionano o non si vedono
const GIRO_FATTO = (n = 1) => ({ id: `f${n}`, tour_id: `fatto-${n}`, title: `Giro ${n}`, city: 'Catania', source: 'crea', created_at: '2026-11-02T18:00:00Z',
    stops: STOPS_SALVATE.map((s, i) => ({ ...s, fatta: i === 0 })) });
describe('PROFILO-SEZIONI', () => {
    it('Richieste (guide, V2) non c\'è e il Profilo non legge guide_requests né user_photos', async () => {
        apri();
        expect(screen.queryByText('Richieste')).toBeNull();
        expect(screen.queryByText(/Richieste Attive/)).toBeNull();
        expect(LEGGI('pages/Profile.jsx')).not.toMatch(/guide_requests|user_photos|ChatModalUser/);
    });
    it('si apre sulle Mete; Risultati mostra i numeri del registro', () => {
        apri();
        expect(screen.getByTestId('mete-profilo')).toBeTruthy();
        fireEvent.click(screen.getByText('Risultati'));
        return waitFor(() => {
            expect(screen.getByTestId('risultato-giri-valore').textContent).toBe('1');
            expect(screen.getByTestId('risultato-tappe-valore').textContent).toBe('2');
            expect(screen.getByTestId('traguardi-presi').textContent).toContain('Primo giro');
            expect(screen.getByTestId('risultati-citta').textContent).toContain('Catania');
        });
    });
    it('Risultati senza dati: zeri e il primo traguardo, nessun numero inventato', async () => {
        hook.righeRegistro = [];
        apri();
        fireEvent.click(screen.getByText('Risultati'));
        expect((await screen.findByTestId('risultati-vuoti')).textContent).toContain('Tutto a zero');
        expect(screen.getByTestId('risultato-giri').textContent).toContain('Prossimo traguardo: Primo giro');
        expect(screen.queryByTestId('traguardi-presi')).toBeNull();
    });
    it('Rivivi vuoto: account nuovo e account con solo Mete vecchie hanno la loro frase', async () => {
        const { unmount } = apri();
        expect(screen.getByTestId('rivivi-vuoto').textContent).toContain('Di quelli di prima ho solo città e numeri');
        unmount();
        hook.righeRegistro = [];
        apri();
        expect(screen.getByTestId('rivivi-vuoto').textContent).toBe('Finisci un giro e lo ritrovi qui, con la mappa e le tappe.');
    });
    it('Rivivi: scheda con tappe e data; «Rifai questo giro» apre la mappa con un giro nuovo, senza generazioni', async () => {
        giriFatti = [GIRO_FATTO()];
        navigaMock.mockClear();
        const fetchSpia = vi.fn();
        vi.stubGlobal('fetch', fetchSpia);
        apri();
        const card = await screen.findByTestId('rivivi-giro');
        expect(card.textContent).toContain('Giro 1');
        expect(card.textContent).toContain('1 tappa su 2');
        expect(card.textContent).toContain('2 nov 2026');
        fireEvent.click(card);
        const tappe = await screen.findAllByTestId('rivivi-tappa');
        expect(tappe[0].textContent).toContain('Caffè Puglisi');
        expect(tappe[0].textContent).toContain('09:30 · Raggiunta');
        expect(tappe[1].textContent).toContain('Non raggiunta');
        fireEvent.click(screen.getByTestId('rivivi-rifai'));
        expect(navigaMock).toHaveBeenCalledTimes(1);
        const [rotta, opzioni] = navigaMock.mock.calls[0];
        expect(rotta).toBe('/map');
        expect(opzioni.state.tourData.id).toMatch(/^rifatto-f1-/);
        expect(opzioni.state.tourData.steps.map(s => s.title)).toEqual(['Caffè Puglisi', 'Basilica Cattedrale']);
        expect(fetchSpia).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });
    it('Rivivi: la scheda si chiude; oltre 3 giri c\'è «Vedi tutti»', async () => {
        giriFatti = [1, 2, 3, 4].map(GIRO_FATTO);
        apri();
        expect(await screen.findAllByTestId('rivivi-giro')).toHaveLength(3);
        fireEvent.click(screen.getByTestId('rivivi-altri'));
        expect(screen.getAllByTestId('rivivi-giro')).toHaveLength(4);
        fireEvent.click(screen.getAllByTestId('rivivi-giro')[0]);
        fireEvent.click(await screen.findByTestId('rivivi-chiudi'));
        expect(screen.queryByTestId('rivivi-scheda')).toBeNull();
    });
    it('Mete: con molti giri l\'elenco si ferma a 5 e «Vedi tutte» apre il resto', async () => {
        hook.righeRegistro = Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, kind: 'tour_completed', category: 'food', city: 'Roma', value: '1/1', tour_id: `g${i}`, created_at: `2026-10-1${i}T12:00:00Z` }));
        apri();
        expect(screen.getAllByTestId('meta')).toHaveLength(5);
        fireEvent.click(screen.getByTestId('mete-altre'));
        expect(screen.getAllByTestId('meta')).toHaveLength(7);
    });
});

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
    // GIRI-SALVATI — il tocco sulla card riapre il giro com'era, con «Vedi mappa»
    it('tocco sulla card in Profilo → il giro si apre con le tappe e gli orari salvati e «Vedi mappa»', async () => {
        navigaMock.mockClear();
        const fetchSpia = vi.fn();
        vi.stubGlobal('fetch', fetchSpia);
        apri();
        fireEvent.click(screen.getByText('Mete'));
        const card = await screen.findByTestId('giro-salvato-apri');
        expect(card.textContent).toContain('2 tappe');
        fireEvent.click(card);
        const vedi = await screen.findByText('Vedi mappa');
        expect(screen.getByText('Caffè Puglisi')).toBeTruthy();
        expect(screen.getByText('Basilica Cattedrale')).toBeTruthy();
        expect(screen.getByText('09:30')).toBeTruthy();
        expect(screen.getByText('10:01')).toBeTruthy();
        fireEvent.click(vedi.closest('button'));
        expect(navigaMock).toHaveBeenCalledTimes(1);
        const [rotta, opzioni] = navigaMock.mock.calls[0];
        expect(rotta).toBe('/map');
        const steps = opzioni.state.tourData.steps;
        expect(steps.map(x => [x.title, x.scheduledTime])).toEqual(STOPS_SALVATE.map(x => [x.title, x.scheduledTime]));
        expect(opzioni.state.isAiGenerated).toBe(true);
        expect(fetchSpia).not.toHaveBeenCalled(); // nessuna generazione: 0 $
        vi.unstubAllGlobals();
    });
});

describe('DNA-6 — il tasto Salva è nelle quattro superfici', () => {
    it('Quiz (riepilogo), Crea, Per Te e Sorprendimi (dettaglio) usano SalvaGiro con la loro sorgente', () => {
        expect(LEGGI('components/Map/QuickPathSummary.jsx')).toContain('<SalvaGiro tour={tourData} sorgente={sorgente} />');
        expect(LEGGI('pages/AiItinerary.jsx')).toMatch(/<SalvaGiro[\s\S]*?sorgente="crea"/);
        const td = LEGGI('pages/TourDetails.jsx');
        expect(td).toContain('<SalvaGiro tour={tour}');
        expect(td).toContain("'sorprendimi'");
        expect(td).toContain("'per_te'");
        expect(LEGGI('components/PerTeCard.jsx')).toContain("origine: 'per_te'"); // PER-TE-TRE: la scheda della home e di «Vedi tutte»
        expect(LEGGI('pages/SurpriseTour.jsx')).toContain("origine: 'sorprendimi'");
    });
    it('il giro completato scrive «raggiunte/totali» e il motore dei giri non è toccato', () => {
        expect(LEGGI('pages/MapPage.jsx')).toContain('value: `${raggiunte.length}/${activeRoute.length}`');
        expect(LEGGI('hooks/useAILearning.js')).toContain('value: opts.value');
    });
});
