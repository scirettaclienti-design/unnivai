// OSPITE-GIRO — il giro di prova senza account, dal lato del telefono: entrare come ospite, il giro di prova finito,
// l'invito nei tre momenti (fine giro, secondo giro, salvataggio; mai prima del primo giro), la registrazione che tiene
// lo stesso account (giro e DNA restano), i limiti del server che arrivano onesti. I limiti veri: openaiProxyOspite.test.js
// e scripts/test-ospite-giro-sql.sh.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = vi.hoisted(() => ({
    signInAnonymously: vi.fn(),
    updateUser: vi.fn(),
    verifyOtp: vi.fn(),
    getSession: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: auth, from: vi.fn(), rpc: vi.fn() } }));

const sessione = vi.hoisted(() => ({ user: null }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: sessione.user }) }));
const naviga = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useNavigate: () => naviga }));
const salvaGiroMock = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock('@/lib/giriSalvati', async () => ({ ...(await vi.importActual('@/lib/giriSalvati')), salvaGiro: (...a) => salvaGiroMock(...a) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import {
    isOspite, entraComeOspite, segnaGiroDiProva, giroDiProva, secondoGiroDaOspite, ospiteDaFermare, chiediRegistrazione,
    confermaCodice, erroreRegistrazione, EVENTO_REGISTRATI, INVITO, TESTI_OSPITE,
} from '@/lib/ospite';
import RegistrazioneOspite from '@/components/RegistrazioneOspite';
import ProvaSenzaAccount from '@/components/ProvaSenzaAccount';
import SalvaGiro from '@/components/SalvaGiro';
import { FineGiro } from '@/components/Nav/GuidaSchede';
import { erroreAuthItaliano } from '@/lib/erroriAuth';

const OSPITE = { id: 'anon-1', is_anonymous: true, email: '' };
const UTENTE = { id: 'u-1', is_anonymous: false, email: 'anna@example.com' };

beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    sessione.user = null;
    salvaGiroMock.mockResolvedValue({ ok: true });
});
afterEach(() => cleanup());

const eventi = () => {
    const visti = [];
    const f = (e) => visti.push(e.detail);
    window.addEventListener(EVENTO_REGISTRATI, f);
    return { visti, stop: () => window.removeEventListener(EVENTO_REGISTRATI, f) };
};

describe('entrare come ospite', () => {
    it('«Prova un giro»: account anonimo, poi la radice decide (gusti la prima volta, poi la home)', async () => {
        auth.signInAnonymously.mockResolvedValue({ data: { user: OSPITE }, error: null });
        render(<ProvaSenzaAccount />);
        expect(screen.getByTestId('prova-senza-account').textContent).toBe(TESTI_OSPITE.PROVA);
        fireEvent.click(screen.getByTestId('prova-senza-account'));
        await waitFor(() => expect(naviga).toHaveBeenCalledWith('/', { replace: true }));
        expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    });

    it('accessi anonimi spenti nel pannello: lo dice, nessuna navigazione', async () => {
        auth.signInAnonymously.mockResolvedValue({ data: null, error: { code: 'anonymous_provider_disabled', status: 422 } });
        render(<ProvaSenzaAccount />);
        fireEvent.click(screen.getByTestId('prova-senza-account'));
        expect((await screen.findByTestId('prova-errore')).textContent).toBe(TESTI_OSPITE.PROVA_CHIUSA);
        expect(naviga).not.toHaveBeenCalled();
    });

    it('rete giù: stesso messaggio, mai un errore inglese', async () => {
        auth.signInAnonymously.mockRejectedValue(new TypeError('Failed to fetch'));
        expect(await entraComeOspite()).toEqual({ ok: false, motivo: TESTI_OSPITE.PROVA_CHIUSA });
    });

    it('isOspite: solo is_anonymous vero', () => {
        expect(isOspite(OSPITE)).toBe(true);
        expect(isOspite(UTENTE)).toBe(false);
        expect(isOspite(null)).toBe(false);
    });
});

describe('il giro di prova finito', () => {
    it('legato all\'account anonimo: un altro account sullo stesso telefono non lo eredita', () => {
        segnaGiroDiProva('anon-1', 'giro-a');
        expect(giroDiProva('anon-1')).toMatchObject({ utente: 'anon-1', giro: 'giro-a' });
        expect(giroDiProva('anon-2')).toBeNull();
    });

    it('prima del primo giro nessun invito; dopo, un giro diverso sì e lo stesso giro no', () => {
        expect(secondoGiroDaOspite(OSPITE, 'giro-a')).toBe(false);
        segnaGiroDiProva('anon-1', 'giro-a');
        expect(secondoGiroDaOspite(OSPITE, 'giro-a')).toBe(false);
        expect(secondoGiroDaOspite(OSPITE, 'giro-b')).toBe(true);
        expect(secondoGiroDaOspite(UTENTE, 'giro-b')).toBe(false);
    });

    it('ospiteDaFermare legge la sessione: ospite con giro fatto sì, utente registrato mai', async () => {
        auth.getSession.mockResolvedValue({ data: { session: { user: OSPITE } } });
        expect(await ospiteDaFermare()).toBe(false);
        segnaGiroDiProva('anon-1', 'giro-a');
        expect(await ospiteDaFermare()).toBe(true);
        auth.getSession.mockResolvedValue({ data: { session: { user: UTENTE } } });
        expect(await ospiteDaFermare()).toBe(false);
    });
});

describe('i tre momenti dell\'invito', () => {
    const baseFine = { data: '2 novembre', citta: 'Catania', tappe: [], numeri: { km: 1, tappe: 3, ore: '40 min' }, imparato: null, onMete: vi.fn(), onCondividi: vi.fn(), onChiudi: vi.fn() };

    it('fine giro da ospite: «Salva questo giro» al posto di «Nelle tue Mete»', () => {
        vi.useFakeTimers();
        const onSalva = vi.fn();
        render(<FineGiro {...baseFine} ospite onSalva={onSalva} />);
        act(() => { vi.advanceTimersByTime(700); });
        expect(screen.queryByText('Nelle tue Mete')).toBeNull();
        fireEvent.click(screen.getByTestId('fine-salva-ospite'));
        expect(onSalva).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('fine giro con l\'account: resta «Nelle tue Mete»', () => {
        render(<FineGiro {...baseFine} />);
        expect(screen.getByText('Nelle tue Mete')).toBeTruthy();
        expect(screen.queryByTestId('fine-salva-ospite')).toBeNull();
    });

    it('«Salva il giro» da ospite: l\'invito «salva», nessun salvataggio', () => {
        sessione.user = OSPITE;
        const ev = eventi();
        const tour = { title: 'Giro', city: 'Catania', steps: [{ title: 'Tappa', latitude: 37.5, longitude: 15.08 }] };
        render(<SalvaGiro tour={tour} sorgente="crea" />);
        fireEvent.click(screen.getByTestId('salva-giro'));
        expect(ev.visti).toEqual([{ momento: 'salva', testo: null }]);
        expect(salvaGiroMock).not.toHaveBeenCalled();
        ev.stop();
    });

    it('i testi dell\'invito: brevi, mai «benvenuti», niente esclamativi né superlativi', () => {
        const tutti = [...Object.values(INVITO).flatMap((x) => [x.titolo, x.testo]), ...Object.values(TESTI_OSPITE).filter((x) => typeof x === 'string')];
        for (const t of tutti) {
            expect(t).not.toMatch(/benvenut|!|bellissim|incredibil|imperdibil|straordinari|unic[oa]\b/i);
            for (const frase of t.split(/(?<=[.:?])\s+/)) expect(frase.split(/\s+/).length, frase).toBeLessThanOrEqual(20);
        }
    });
});

describe('la registrazione tiene lo stesso account', () => {
    const apri = (momento = 'fine') => act(() => { chiediRegistrazione(momento); });

    it('un utente registrato non vede l\'invito', () => {
        sessione.user = UTENTE;
        render(<RegistrazioneOspite />);
        apri();
        expect(screen.queryByTestId('registrazione-ospite')).toBeNull();
    });

    it('email → codice di 6 cifre → «Fatto», sullo stesso account, senza password (updateUser email, verifyOtp email_change)', async () => {
        sessione.user = OSPITE;
        auth.updateUser.mockResolvedValueOnce({ data: { user: OSPITE }, error: null }); // email
        auth.verifyOtp.mockResolvedValue({ data: { user: { ...OSPITE, is_anonymous: false } }, error: null });
        const { rerender } = render(<RegistrazioneOspite />);
        apri('fine');
        expect(screen.getByRole('heading').textContent).toBe(INVITO.fine.titolo);
        fireEvent.change(screen.getByTestId('registrazione-email'), { target: { value: ' anna@example.com ' } });
        fireEvent.click(screen.getByTestId('registrazione-invia'));
        await screen.findByTestId('registrazione-inviata');
        expect(auth.updateUser).toHaveBeenNthCalledWith(1, { email: 'anna@example.com' });
        expect(screen.queryByTestId('registrazione-password')).toBeNull();

        fireEvent.change(screen.getByTestId('registrazione-codice'), { target: { value: '12 34 56' } });
        // dopo il codice l'account non è più anonimo: il foglio deve restare fino al «Fatto»
        sessione.user = { ...OSPITE, is_anonymous: false };
        rerender(<RegistrazioneOspite />);
        fireEvent.click(screen.getByTestId('registrazione-conferma'));
        await screen.findByTestId('registrazione-fatta');
        expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'anna@example.com', token: '123456', type: 'email_change' });
        expect(auth.updateUser).toHaveBeenCalledTimes(1); // nessuna password
        fireEvent.click(screen.getByTestId('registrazione-profilo'));
        expect(naviga).toHaveBeenCalledWith('/profile');
    });

    it('codice sbagliato: lo dice in italiano', async () => {
        auth.verifyOtp.mockResolvedValue({ data: null, error: { code: 'otp_expired', message: 'Token has expired or is invalid' } });
        const r = await confermaCodice('anna@example.com', '000000');
        expect(erroreRegistrazione(r.error, erroreAuthItaliano)).toBe(TESTI_OSPITE.CODICE_SBAGLIATO);
        expect(auth.updateUser).not.toHaveBeenCalled();
    });

    it('email che ha già un account: lo dice in chiaro (il giro di prova non passa a quell\'account)', () => {
        expect(erroreRegistrazione({ code: 'email_exists' }, erroreAuthItaliano)).toBe(TESTI_OSPITE.EMAIL_GIA_USATA);
        expect(erroreRegistrazione({ message: 'A user with this email address has already been registered' }, erroreAuthItaliano)).toBe(TESTI_OSPITE.EMAIL_GIA_USATA);
    });

    it('il limite del server porta il suo testo nell\'invito', () => {
        sessione.user = OSPITE;
        render(<RegistrazioneOspite />);
        act(() => { chiediRegistrazione('limite', 'Per oggi i giri di prova sono finiti.'); });
        expect(screen.getByTestId('registrazione-ospite').textContent).toContain('Per oggi i giri di prova sono finiti.');
    });
});
