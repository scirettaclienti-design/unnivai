// PER-TE-TRE (T27) — «Vedi tutte»: l'elenco completo delle proposte, con ritorno alla home e stato vuoto onesto. I testi dei due ingressi.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { MemoryRouter } from 'react-router-dom';
import PerTeTutte from '@/pages/PerTeTutte';
import { salvaPerTe, giornoEFasciaPerTe } from '@/lib/perTeSalvato';
import { TESTI_HOME, TESTI_PER_TE } from '@/lib/testiHome';

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useUserContext', () => ({ useUserContext: () => ({ city: 'Roma', isLoading: false }) }));
vi.mock('@/components/BottomNavigation', () => ({ default: () => null }));
vi.mock('@/components/TourCover', () => ({ default: () => null }));

const apri = () => render(<MemoryRouter><PerTeTutte /></MemoryRouter>);
const chiave = () => { const { giorno, fascia } = giornoEFasciaPerTe(new Date()); return ['home-experiences', 'Roma', giorno, fascia, 'dna0']; };
const proposta = (i) => ({ id: `home-t${i}-1`, themeType: `t${i}`, title: `Giro ${i}`, category: 'Per te', duration: 'Durata 2 ore' });

beforeEach(() => window.localStorage.clear());

describe('Vedi tutte', () => {
    it('mostra tutte le proposte salvate, anche oltre le 5 della home', () => {
        salvaPerTe(chiave(), 'u1', { tours: [1, 2, 3, 4, 5, 6].map(proposta), chiusoOra: null });
        apri();
        expect(screen.getByTestId('per-te-elenco').querySelectorAll('a[href^="/tour-details/home-"]').length).toBe(6);
        expect(screen.getByLabelText(TESTI_PER_TE.tornaAllaHome)).toBeTruthy();
    });
    it('senza niente di pronto lo dice e riporta alla home, mai la mappa vuota', () => {
        apri();
        expect(screen.getByTestId('per-te-vuoto')).toBeTruthy();
        expect(screen.getByText(TESTI_PER_TE.vuoto.titolo)).toBeTruthy();
        expect(screen.getByRole('link', { name: TESTI_PER_TE.tornaAllaHome }).getAttribute('href')).toBe('/dashboard-user');
    });
    it('dice la passione senza proposta', () => {
        salvaPerTe(chiave(), 'u1', { tours: [proposta(1)], chiusoOra: null, passioniMancanti: ['nature'] });
        apri();
        expect(screen.getByText(TESTI_PER_TE.passioneMancante(['nature'], 'Roma'))).toBeTruthy();
    });
});

describe('I due ingressi della home', () => {
    const home = readFileSync('src/pages/DashboardUser.jsx', 'utf8');
    it('i nomi nuovi, coi sottotitoli di Ivano', () => {
        expect(TESTI_HOME.suMisura.titolo).toBe('Su misura');
        expect(TESTI_HOME.suMisura.sottotitolo).toBe('Scrivi cosa cerchi. Città, gusti, budget, ritmo: il giro lo costruiamo da qui.');
        expect(TESTI_HOME.alVolo.titolo).toBe('Al volo');
        expect(TESTI_HOME.alVolo.sottotitolo).toBe('Tre scelte e sei in strada.');
    });
    it('i vecchi testi non restano a schermo, le route non cambiano', () => {
        for (const vecchio of ['AI Powered', 'Quiz Veloce', '>Crea il tuo Percorso<', 'Gratis & Su Misura', 'Su misura per te', 'Intelligenza artificiale per te']) expect(home).not.toContain(vecchio);
        expect(home).toContain('to="/ai-itinerary"');
        expect(home).toContain('to="/quick-path"');
    });
    it('«Vedi tutte» apre l’elenco, non la mappa di Esplora', () => {
        expect(home).toContain('to="/per-te"');
        expect(home).not.toContain('to="/explore"');
    });
    it('«Su misura» compare una volta sola: l’etichetta non lo ripete', () => {
        expect(TESTI_HOME.suMisura.etichetta.toLowerCase()).not.toContain('misura');
        expect(TESTI_HOME.creaIlTuoTour.etichetta.toLowerCase()).not.toContain('misura');
    });
});
