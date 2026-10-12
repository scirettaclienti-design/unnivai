import { describe, it, expect, beforeEach, vi } from 'vitest';

// ONB-1 — "onboarding fatto" e' un dato dell'ACCOUNT (user_preferences.onboarding_seed
// sul server: NULL = mai fatto, [] = saltato, [...] / {v:2,...} = fatto). Il browser
// ne tiene solo una copia. Questi test inchiodano il contratto del gate:
//   - il server dice "fatto"  → mai onboarding, qualunque cosa abbia il browser
//   - server vuoto + browser valido → il browser sale sul server UNA volta, senza perdere niente
//   - server vuoto + browser vuoto → onboarding (utente nuovo)
//   - server irraggiungibile → MAI onboarding (un utente gia' registrato non deve ripassarci,
//     e rifarlo sovrascriverebbe i suoi gusti)
const getOnboardingStateMock = vi.fn();
const upsertOnboardingSeedMock = vi.fn();
vi.mock('@/services/dataService', () => ({
    dataService: {
        getOnboardingState: (...a) => getOnboardingStateMock(...a),
        upsertOnboardingSeed: (...a) => upsertOnboardingSeedMock(...a),
    },
}));

import {
    resolveOnboardingStatus, localOnboardingDone, markOnboardingDone,
    ONBOARDING_FLAG_KEY, ONBOARDING_SEED_KEY,
} from '../../lib/onboardingStatus';

const ME = '11111111-2222-3333-4444-555555555555';
const OTHER = '99999999-2222-3333-4444-555555555555';

beforeEach(() => {
    localStorage.clear();
    getOnboardingStateMock.mockReset();
    upsertOnboardingSeedMock.mockReset();
    upsertOnboardingSeedMock.mockResolvedValue({ success: true });
});

describe('ONB-1 — resolveOnboardingStatus', () => {
    it('logout + login: browser svuotato, il server ha il seme → done, niente onboarding', async () => {
        getOnboardingStateMock.mockResolvedValue({ ok: true, seed: { v: 2, interessi: ['food'], vincoli: { dieta: [], budget: null }, gusti: { stile: null } } });
        expect(await resolveOnboardingStatus(ME)).toBe('done');
        expect(upsertOnboardingSeedMock).not.toHaveBeenCalled();
    });

    it('altro browser, stesso account: nessun dato locale, seme sul server → done + interessi copiati in cache', async () => {
        const seed = { v: 2, interessi: ['cultura', 'arte'], vincoli: { dieta: [], budget: null }, gusti: { stile: null } };
        getOnboardingStateMock.mockResolvedValue({ ok: true, seed });
        expect(await resolveOnboardingStatus(ME)).toBe('done');
        expect(JSON.parse(localStorage.getItem(ONBOARDING_SEED_KEY))).toEqual(seed);
        expect(localOnboardingDone(ME)).toBe(true);
    });

    it('seme [] sul server (saltato di proposito) vale "fatto"', async () => {
        getOnboardingStateMock.mockResolvedValue({ ok: true, seed: [] });
        expect(await resolveOnboardingStatus(ME)).toBe('done');
    });

    it('il server vince sul locale: non lo riscrive mai', async () => {
        localStorage.setItem(ONBOARDING_SEED_KEY, JSON.stringify(['nightlife']));
        localStorage.setItem(ONBOARDING_FLAG_KEY, '1');
        getOnboardingStateMock.mockResolvedValue({ ok: true, seed: ['food'] });
        await resolveOnboardingStatus(ME);
        expect(upsertOnboardingSeedMock).not.toHaveBeenCalled();
        expect(JSON.parse(localStorage.getItem(ONBOARDING_SEED_KEY))).toEqual(['food']);
    });

    it('utente esistente (Ivano): DB vuoto, browser con flag legacy "1" e seme → il seme sale sul server, done', async () => {
        localStorage.setItem(ONBOARDING_SEED_KEY, JSON.stringify(['food', 'natura']));
        localStorage.setItem(ONBOARDING_FLAG_KEY, '1');
        getOnboardingStateMock.mockResolvedValue({ ok: true, seed: null });
        expect(await resolveOnboardingStatus(ME)).toBe('done');
        expect(upsertOnboardingSeedMock).toHaveBeenCalledTimes(1);
        expect(upsertOnboardingSeedMock).toHaveBeenCalledWith(ME, ['food', 'natura']);
        expect(localStorage.getItem(ONBOARDING_FLAG_KEY)).toBe(ME);
    });

    it('migrazione: il seme v2 (dieta, budget, stile) sale intero, senza perdere niente', async () => {
        const v2 = { v: 2, interessi: ['food'], vincoli: { dieta: ['vegano'], budget: '€€' }, gusti: { stile: 'trattoria' } };
        localStorage.setItem(ONBOARDING_SEED_KEY, JSON.stringify(v2));
        localStorage.setItem(ONBOARDING_FLAG_KEY, '1');
        getOnboardingStateMock.mockResolvedValue({ ok: true, seed: null });
        await resolveOnboardingStatus(ME);
        expect(upsertOnboardingSeedMock).toHaveBeenCalledWith(ME, v2);
    });

    it('flag legacy senza seme in cache → si porta [] (saltato): fatto, e nessun gusto inventato', async () => {
        localStorage.setItem(ONBOARDING_FLAG_KEY, '1');
        getOnboardingStateMock.mockResolvedValue({ ok: true, seed: null });
        expect(await resolveOnboardingStatus(ME)).toBe('done');
        expect(upsertOnboardingSeedMock).toHaveBeenCalledWith(ME, []);
    });

    it('migrazione fallita: resta done (non rimostra il wizard) e il flag locale NON viene riscritto, cosi\' riprova al prossimo accesso', async () => {
        localStorage.setItem(ONBOARDING_SEED_KEY, JSON.stringify(['food']));
        localStorage.setItem(ONBOARDING_FLAG_KEY, '1');
        getOnboardingStateMock.mockResolvedValue({ ok: true, seed: null });
        upsertOnboardingSeedMock.mockResolvedValue({ success: false, error: 'rete' });
        expect(await resolveOnboardingStatus(ME)).toBe('done');
        expect(localStorage.getItem(ONBOARDING_FLAG_KEY)).toBe('1');
    });

    it('utente nuovo: server vuoto e browser vuoto → todo, niente scritture', async () => {
        getOnboardingStateMock.mockResolvedValue({ ok: true, seed: null });
        expect(await resolveOnboardingStatus(ME)).toBe('todo');
        expect(upsertOnboardingSeedMock).not.toHaveBeenCalled();
    });

    it('utente nuovo su browser che ha il flag di un ALTRO account → todo (il flag e\' legato all\'utente)', async () => {
        localStorage.setItem(ONBOARDING_FLAG_KEY, OTHER);
        localStorage.setItem(ONBOARDING_SEED_KEY, JSON.stringify(['food']));
        getOnboardingStateMock.mockResolvedValue({ ok: true, seed: null });
        expect(await resolveOnboardingStatus(ME)).toBe('todo');
        expect(upsertOnboardingSeedMock).not.toHaveBeenCalled();
    });

    it('server irraggiungibile e nessuna copia locale → unknown, MAI todo', async () => {
        getOnboardingStateMock.mockResolvedValue({ ok: false, error: 'Failed to fetch' });
        expect(await resolveOnboardingStatus(ME)).toBe('unknown');
    });

    it('server irraggiungibile ma flag locale di questo utente → done', async () => {
        markOnboardingDone(ME);
        getOnboardingStateMock.mockResolvedValue({ ok: false, error: 'Failed to fetch' });
        expect(await resolveOnboardingStatus(ME)).toBe('done');
    });

    it('eccezione imprevista → unknown, non crash', async () => {
        getOnboardingStateMock.mockRejectedValue(new Error('boom'));
        expect(await resolveOnboardingStatus(ME)).toBe('unknown');
    });
});

describe('ONB-1 — localOnboardingDone (corsia veloce, solo copia)', () => {
    it('vale solo col flag legato a QUESTO utente; "1" legacy e altri id no', () => {
        expect(localOnboardingDone(ME)).toBe(false);
        localStorage.setItem(ONBOARDING_FLAG_KEY, '1');
        expect(localOnboardingDone(ME)).toBe(false);
        localStorage.setItem(ONBOARDING_FLAG_KEY, OTHER);
        expect(localOnboardingDone(ME)).toBe(false);
        markOnboardingDone(ME);
        expect(localOnboardingDone(ME)).toBe(true);
    });
});
