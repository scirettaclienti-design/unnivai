import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { frecciaDaSpegnere, tappaDellaFreccia, partenzaCompiuta } from '@/lib/navGuida';
import { NAV_TESTI } from '@/lib/navMessaggi';
import FrecciaPartenza from '@/components/Nav/FrecciaPartenza';

const giro = [{ id: 'uzeda', name: 'Porta Uzeda' }, { id: 'basilica', name: 'Basilica Cattedrale' }, { id: 'fontana', name: 'Fontana' }];

// Il chiavistello della pagina: accesa solo da un avvio, spenta per sempre da frecciaDaSpegnere.
const nuovaPagina = (ripresa = false) => {
    const p = { accesa: !ripresa, aggiorna(stato) { if (p.accesa && frecciaDaSpegnere(stato)) p.accesa = false; } };
    return p;
};

describe('la freccia di partenza: un lampo solo, all\'avvio', () => {
    it('all\'avvio e\' accesa e nomina la prima tappa', () => {
        const p = nuovaPagina();
        p.aggiorna({ fatte: [], saltate: [], arrivoId: null, gps: 'ok' });
        expect(p.accesa).toBe(true);
        expect(tappaDellaFreccia(giro, [], []).name).toBe('Porta Uzeda');
    });
    it('alla tappa 2 non c\'e\' e, se ci fosse, nominerebbe la Basilica, mai Porta Uzeda', () => {
        const p = nuovaPagina();
        p.aggiorna({ fatte: ['uzeda'], saltate: [], arrivoId: null, gps: 'ok' });
        expect(p.accesa).toBe(false);
        expect(tappaDellaFreccia(giro, ['uzeda'], []).name).toBe('Basilica Cattedrale');
        expect(tappaDellaFreccia(giro, [], ['uzeda']).name).toBe('Basilica Cattedrale');
    });
    it('la prima tappa saltata o la scheda di arrivo aperta la spengono', () => {
        const a = nuovaPagina(); a.aggiorna({ saltate: ['uzeda'] }); expect(a.accesa).toBe(false);
        const b = nuovaPagina(); b.aggiorna({ arrivoId: 'uzeda' }); expect(b.accesa).toBe(false);
    });
    it('«Ho perso il segnale» la spegne e la ripresa del segnale non la riaccende', () => {
        const p = nuovaPagina();
        p.aggiorna({ gps: 'perso' });
        expect(p.accesa).toBe(false);
        p.aggiorna({ gps: 'ok' });
        expect(p.accesa).toBe(false);
        p.aggiorna({ fatte: [], saltate: [], arrivoId: null, gps: 'ok' });
        expect(p.accesa).toBe(false);
    });
    it('la ripresa di un giro salvato non la accende', () => {
        const p = nuovaPagina(true);
        p.aggiorna({ fatte: [], saltate: [], gps: 'ok' });
        expect(p.accesa).toBe(false);
    });
    it('senza fatti, senza arrivo e col segnale in attesa o buono resta accesa', () => {
        expect(frecciaDaSpegnere({ fatte: [], saltate: [], arrivoId: null, gps: 'attesa' })).toBe(false);
        expect(frecciaDaSpegnere({})).toBe(false);
    });
    it('dopo 10 m nel verso giusto verso la tappa nominata la partenza e\' compiuta', () => {
        const partenza = { lat: 37.5, lng: 15.0 }, tappa = { lat: 37.5, lng: 15.005 };
        expect(partenzaCompiuta({ partenza, posizione: { lat: 37.5, lng: 15.0002 }, tappa })).toBe(true);
    });
});

describe('il testo della freccia', () => {
    it('nomina la tappa passata, con il testo di Ivano', () => {
        expect(NAV_TESTI.PARTENZA_VERSO('Basilica Cattedrale')).toBe('Parti da qui verso Basilica Cattedrale');
        render(React.createElement(FrecciaPartenza, { angolo: 10, nome: 'Basilica Cattedrale' }));
        expect(screen.getByText('Parti da qui verso Basilica Cattedrale')).toBeTruthy();
    });
    it('senza nome non inventa una tappa', () => {
        expect(NAV_TESTI.PARTENZA_VERSO(null)).toBe('Parti da qui, nella direzione della freccia');
    });
    it('senza angolo non disegna niente', () => {
        const { container } = render(React.createElement(FrecciaPartenza, { angolo: null, nome: 'X' }));
        expect(container.firstChild).toBeNull();
    });
});
