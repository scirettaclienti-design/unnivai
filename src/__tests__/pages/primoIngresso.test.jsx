// ONBOARDING-ACCESSO — il primo ingresso: una volta per account (segno sul server), consenso poi domande brevi e
// saltabili; passo e compagnia sono un PUNTO DI PARTENZA che giri e scelte vere superano; il Profilo lo mostra.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('framer-motion', async () => {
    const React = await import('react');
    const OMIT = new Set(['initial', 'animate', 'exit', 'variants', 'whileHover', 'whileTap', 'transition', 'custom', 'layout']);
    const clean = (p) => Object.fromEntries(Object.entries(p).filter(([k]) => !OMIT.has(k)));
    const motion = new Proxy({}, { get: (_t, tag) => React.forwardRef((props, ref) => React.createElement(tag, { ...clean(props), ref })) });
    return { motion, AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children) };
});
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useNavigate: () => navigateMock }));
let auth = { user: null };
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
const updateUser = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { updateUser: (...a) => updateUser(...a), getSession: vi.fn() }, from: vi.fn() } }));
const upsertOnboardingSeed = vi.fn();
const getOnboardingState = vi.fn();
vi.mock('@/services/dataService', () => ({ dataService: { upsertOnboardingSeed: (...a) => upsertOnboardingSeed(...a), getOnboardingState: (...a) => getOnboardingState(...a) } }));

const Onboarding = (await import('@/pages/Onboarding')).default;
const ConsensoAi = (await import('@/components/ConsensoAi')).default;
const { useOnboardingStatus } = await import('@/hooks/useOnboardingStatus');
const { primoIngressoNeiMetadati, META_PRIMO_INGRESSO } = await import('@/lib/onboardingStatus');
const { consensoRimandato } = await import('@/lib/consensoAi');
const { buildSeed, parseSeed, seedFoodPrefs } = await import('@/lib/foodPrefs');
const { ritmoDelGiro, ritmoAppreso } = await import('@/lib/dnaRitmo');
const { compagniaDelGiro } = await import('@/lib/compagniaDna');
const { dnaGiroDaApprendimento } = await import('@/lib/giroDna');
const { rigaRitmo, rigaCompagnia, TESTI_DNA } = await import('@/lib/dnaDelGiro');
const { pesiDaEventi } = await import('@/services/preferenceEngine');
const { UTENTI } = await import('../../../scripts/prova-dna5/utenti.js');
const { PRIMO_INGRESSO, CONSENSO_AI } = await import('@/lib/testiAccount');

const ID = '11111111-2222-3333-4444-555555555555';
const CON_CONSENSO = { id: ID, user_metadata: { consenso_ai: { v: 1, at: '2026-11-01T10:00:00Z' } } };
const click = (t) => fireEvent.click(screen.getByText(t, { exact: true }).closest('button'));
const avanti = () => fireEvent.click(screen.getByTestId('primo-avanti'));

beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    auth = { user: CON_CONSENSO };
    upsertOnboardingSeed.mockResolvedValue({ success: true });
    getOnboardingState.mockResolvedValue({ ok: true, seed: null });
    updateUser.mockResolvedValue({ data: {}, error: null });
});

describe('il primo ingresso', () => {
    it('con il consenso già dato si parte dagli interessi; tre domande, poi seme e segno sul server', async () => {
        render(<Onboarding />);
        expect(screen.queryByTestId('consenso-ai')).toBeNull();
        expect(screen.getByText(PRIMO_INGRESSO.INTERESSI_TITOLO)).toBeInTheDocument();
        click('Storia e arte');
        avanti();
        click('Vegetariano'); click('€€'); click('Trattoria');
        avanti();
        click('Tranquillo'); click('In coppia');
        click(PRIMO_INGRESSO.FINE);
        await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard-user', { replace: true }));
        const [uid, seme] = upsertOnboardingSeed.mock.calls[0];
        expect(uid).toBe(ID);
        expect(seme).toEqual({
            v: 2, interessi: ['cultura', 'arte'], vincoli: { dieta: ['vegetariano'], budget: '€€' },
            gusti: { stile: 'trattoria', ritmo_iniziale: 'lento', compagnia_iniziale: 'coppia' },
        });
        // passo e compagnia NON sono la scelta del Profilo: sono il punto di partenza
        expect(seme.gusti.ritmo).toBeUndefined();
        expect(updateUser).toHaveBeenCalledWith({ data: { [META_PRIMO_INGRESSO]: expect.any(String) } });
    });

    it('senza consenso il primo passo è il consenso; «Va bene» lo salva sull\'account', async () => {
        auth = { user: { id: ID, user_metadata: {} } };
        render(<Onboarding />);
        expect(screen.getByTestId('consenso-ai')).toBeInTheDocument();
        expect(screen.getByText(CONSENSO_AI.TITOLO)).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('consenso-ai-ok'));
        await screen.findByText(PRIMO_INGRESSO.INTERESSI_TITOLO);
        expect(updateUser).toHaveBeenCalledWith({ data: { consenso_ai: expect.objectContaining({ v: 1 }) } });
    });

    it('«Non adesso» va avanti e la finestra del consenso non si riapre da sola in questa apertura', async () => {
        auth = { user: { id: ID, user_metadata: {} } };
        render(<Onboarding />);
        fireEvent.click(screen.getByTestId('consenso-ai-no'));
        await screen.findByText(PRIMO_INGRESSO.INTERESSI_TITOLO);
        expect(consensoRimandato()).toBe(true);
        render(<MemoryRouter initialEntries={['/dashboard-user']}><ConsensoAi /></MemoryRouter>);
        expect(screen.queryByTestId('consenso-ai')).toBeNull();
    });

    it('ogni domanda si salta; «Salta per ora» salva [] (fatto, senza gusti)', async () => {
        render(<Onboarding />);
        avanti(); avanti();
        click(PRIMO_INGRESSO.SALTA);
        await waitFor(() => expect(upsertOnboardingSeed).toHaveBeenCalled());
        expect(upsertOnboardingSeed.mock.calls[0][1]).toEqual({ v: 2, interessi: [], vincoli: { dieta: [], budget: null }, gusti: { stile: null } });
        upsertOnboardingSeed.mockClear();
        render(<Onboarding />);
        fireEvent.click(screen.getAllByTestId('primo-salta-tutto').at(-1));
        await waitFor(() => expect(upsertOnboardingSeed).toHaveBeenCalledWith(ID, []));
    });

    it('chi l\'ha già fatto (segno nei metadati dell\'account, anche da un altro telefono) torna a «/»', async () => {
        auth = { user: { ...CON_CONSENSO, user_metadata: { ...CON_CONSENSO.user_metadata, [META_PRIMO_INGRESSO]: '2026-11-04T10:00:00Z' } } };
        render(<Onboarding />);
        await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/', { replace: true }));
    });
});

describe('«fatto» sul server: i metadati dell\'account', () => {
    it('con il segno nei metadati è done subito, senza leggere user_preferences', () => {
        const { result } = renderHook(() => useOnboardingStatus(ID, { [META_PRIMO_INGRESSO]: '2026-11-04T10:00:00Z' }));
        expect(result.current).toBe('done');
        expect(getOnboardingState).not.toHaveBeenCalled();
    });
    it('senza segno decide il server (utente nuovo → todo)', async () => {
        const { result } = renderHook(() => useOnboardingStatus(ID, {}));
        await waitFor(() => expect(result.current).toBe('todo'));
    });
    it('il segno vale solo se è una data scritta', () => {
        expect(primoIngressoNeiMetadati(null)).toBe(false);
        expect(primoIngressoNeiMetadati({ [META_PRIMO_INGRESSO]: '' })).toBe(false);
        expect(primoIngressoNeiMetadati({ [META_PRIMO_INGRESSO]: true })).toBe(false);
    });
});

describe('ConsensoAi: mai sopra il primo ingresso, mai un lampo su «/»', () => {
    it.each(['/onboarding', '/'])('%s: la finestra non si apre da sola', (path) => {
        auth = { user: { id: 'altro', user_metadata: {} } };
        render(<MemoryRouter initialEntries={[path]}><ConsensoAi /></MemoryRouter>);
        expect(screen.queryByTestId('consenso-ai')).toBeNull();
    });
});

describe('il DNA iniziale è un punto di partenza', () => {
    it('il seme porta passo e compagnia iniziali; un seme senza resta identico a prima', () => {
        const s = buildSeed({ interessi: ['food'], ritmoIniziale: 'veloce', compagniaIniziale: 'famiglia' });
        expect(seedFoodPrefs(s)).toMatchObject({ ritmo: null, compagnia: null, ritmoIniziale: 'veloce', compagniaIniziale: 'famiglia' });
        expect(parseSeed(s).gusti).toMatchObject({ ritmoIniziale: 'veloce', compagniaIniziale: 'famiglia' });
        expect(buildSeed({ interessi: ['food'] }).gusti).toEqual({ stile: null });
        expect(seedFoodPrefs(buildSeed({ interessi: ['food'] }))).toEqual({ dieta: [], budget: null, stile: null, ritmo: null, compagnia: null });
        // il salvataggio dal Profilo (useAILearning.saveFoodPrefs: buildSeed({ ...onboardingPrefs, ...next })) li conserva
        expect(buildSeed({ ...seedFoodPrefs(s), ritmo: 'medio' }).gusti).toMatchObject({ ritmo: 'medio', ritmo_iniziale: 'veloce' });
    });

    it('passo: vale solo finché giri e scelte non dicono altro; Profilo e richiesta vincono sempre', () => {
        expect(ritmoDelGiro({ iniziale: 'lento' })).toMatchObject({ valore: 'lento', fonte: 'primo ingresso' });
        // utente B: i suoi giri dicono «veloce» → il passo iniziale «lento» non conta più
        const appreso = ritmoAppreso(UTENTI.B.registro);
        expect(ritmoDelGiro({ iniziale: 'lento', appreso })).toMatchObject({ valore: 'veloce', fonte: 'giri' });
        expect(ritmoDelGiro({ iniziale: 'lento', scelte: { suggerito: 'veloce', conteggi: { veloce: 3 }, totale: 3 } })).toMatchObject({ valore: 'veloce', fonte: 'scelte' });
        expect(ritmoDelGiro({ iniziale: 'lento', profilo: 'medio' })).toMatchObject({ fonte: 'profilo' });
        expect(ritmoDelGiro({ iniziale: 'lento', scelto: 'Intenso' })).toMatchObject({ fonte: 'richiesta' });
    });

    it('compagnia: le scelte vere (Gruppo in Crea) superano quella detta al primo ingresso', () => {
        expect(compagniaDelGiro({ iniziale: 'coppia' })).toMatchObject({ valore: 'coppia', fonte: 'primo ingresso' });
        expect(compagniaDelGiro({ iniziale: 'coppia', scelte: { suggerito: 'famiglia', conteggi: { famiglia: 3 }, totale: 3 } })).toMatchObject({ valore: 'famiglia', fonte: 'scelte' });
        expect(compagniaDelGiro({ iniziale: 'coppia', scelta: 'Amici' })).toMatchObject({ fonte: 'richiesta' });
    });

    it('dalla pagina (Crea, Per Te): il seme arriva al motore; dopo i giri vince il registro', () => {
        const prefs = seedFoodPrefs(buildSeed({ ritmoIniziale: 'lento', compagniaIniziale: 'solo' }));
        expect(dnaGiroDaApprendimento({ onboardingPrefs: prefs }).ritmo).toMatchObject({ valore: 'lento', fonte: 'primo ingresso' });
        expect(dnaGiroDaApprendimento({ onboardingPrefs: prefs, righeRegistro: UTENTI.B.registro }).ritmo).toMatchObject({ valore: 'veloce', fonte: 'giri' });
    });

    it('il riquadro lo dice con la fonte giusta', () => {
        expect(rigaRitmo({ valore: 'lento', fonte: 'primo ingresso' })).toMatch(/primo ingresso/);
        expect(rigaCompagnia({ valore: 'coppia', fonte: 'primo ingresso' })).toBe(TESTI_DNA.compagniaInizio('In coppia'));
    });

    it('interessi: dopo UN giro finito i pesi si spostano verso quello che hai fatto davvero', () => {
        const ora = Date.parse('2026-11-04T18:00:00Z');
        const prima = pesiDaEventi([], ['cultura', 'arte'], ora);
        const giro = ['food', 'food', 'natura'].map((c, i) => ({ id: `t${i}`, kind: 'tour_completed', category: c, tour_id: 'g1', created_at: '2026-11-04T17:00:00Z' }));
        const dopo = pesiDaEventi(giro, ['cultura', 'arte'], ora);
        expect(dopo.pesi.food).toBeGreaterThan(prima.pesi.food);
        expect(dopo.pesi.cultura).toBeLessThan(prima.pesi.cultura);
        expect(dopo.eventi).toBeGreaterThan(prima.eventi);
    });
});
