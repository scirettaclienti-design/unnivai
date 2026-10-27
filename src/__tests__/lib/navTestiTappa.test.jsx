/**
 * NAV-TESTI-TAPPA — all'arrivo e nella scheda tappa nessun testo falso, tagliato o ripetuto, nessuna foto vuota.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { primaFraseCompleta, fattoDi } from '@/lib/stopPhrases';
import { percheAdesso, momentoCoerente, alNome, chiccaDistinta, dataDelGiro, fotoVera } from '@/lib/navGuida';
import { NAV_TESTI } from '@/lib/navMessaggi';
import { ArrivoTappa, SchedaTappa } from '@/components/Nav/GuidaSchede';

describe('il taglio delle frasi non spezza alle abbreviazioni', () => {
    it('«tra piazza S. Francesco» resta dentro la frase', () => {
        const t = 'Il teatro greco-romano di Catania è situato nel centro storico, tra piazza S. Francesco e via Vittorio Emanuele. Fu costruito in età romana.';
        expect(primaFraseCompleta(t)).toBe('Il teatro greco-romano di Catania è situato nel centro storico, tra piazza S. Francesco e via Vittorio Emanuele.');
    });
    it('Sant., p.za, ecc., iniziali e punto + minuscola non chiudono la frase', () => {
        expect(primaFraseCompleta('La chiesa di Sant. Agata è in p.za Duomo, con statue, ecc. e un chiostro. Poi altro.')).toBe('La chiesa di Sant. Agata è in p.za Duomo, con statue, ecc. e un chiostro.');
        expect(primaFraseCompleta('Fu opera di G. B. Vaccarini nel Settecento. Poi altro.')).toBe('Fu opera di G. B. Vaccarini nel Settecento.');
        expect(primaFraseCompleta('Costruita nel II sec. a.C. dai Romani. Poi altro.')).toBe('Costruita nel II sec. a.C. dai Romani.');
    });
    it('senza una frase completa: niente (mai una frase spezzata)', () => {
        expect(primaFraseCompleta('Il teatro è situato nel centro, tra piazza S.')).toBeNull();
        expect(primaFraseCompleta('Senza punto finale')).toBeNull();
    });
    it('il fatto da Wikipedia è una frase intera con «S.» dentro', () => {
        const f = fattoDi([{ fonte: 'wikipedia', testo: 'Il teatro antico sorge tra piazza S. Francesco e via Vittorio Emanuele. Altro.' }]);
        expect(f).toBe('Il teatro antico sorge tra piazza S. Francesco e via Vittorio Emanuele.');
    });
});

describe('«Perché sei qui adesso» coerente con l\'ora vera', () => {
    const sera = new Date('2026-10-28T22:02:00+01:00');
    const mattina = new Date('2026-10-28T09:30:00+01:00');
    it('alle 22:02 mai «la mattina…»', () => {
        const t = percheAdesso({ moment: 'mattina', travelMinutesFromPrev: 4 }, null, sera);
        expect(t).not.toMatch(/mattina|poca gente/i);
        expect(t).toBe('È a 4 minuti a piedi dalla tappa prima.');
        expect(momentoCoerente('mattina', sera)).toBe(false);
    });
    it('alle 9:30 la frase della mattina c\'è; di sera quella della cena e del dopocena', () => {
        expect(percheAdesso({ moment: 'mattina' }, null, mattina)).toMatch(/mattina/);
        expect(percheAdesso({ moment: 'cena' }, null, sera)).toMatch(/cena/);
        expect(momentoCoerente('dopocena', new Date('2026-10-28T00:30:00+01:00'))).toBe(true);
        expect(momentoCoerente('pranzo', sera)).toBe(false);
    });
});

describe('la preposizione articolata davanti al nome', () => {
    it.each([
        ['Trattoria Sorano', 'alla Trattoria Sorano'], ['Bar Popolare', 'al Bar Popolare'], ['Osteria del Sole', "all'Osteria del Sole"],
        ['Basilica Cattedrale di Sant\'Agata', "alla Basilica Cattedrale di Sant'Agata"], ['Castello Ursino', 'al Castello Ursino'],
        ['Fontana dell’Amenano', 'alla Fontana dell’Amenano'], ['Via Etnea', 'alla Via Etnea'], ['Camelot', 'al Camelot'],
        ['Il Duomo', 'al Duomo'], ["L'Antica Pizzeria", "all'Antica Pizzeria"], ['Stadio Massimino', 'allo Stadio Massimino'],
    ])('%s → %s', (nome, atteso) => { expect(alNome(nome)).toBe(atteso); });
    it('la scheda tappa dice «Riparti · 2 min alla Trattoria Sorano»', () => {
        render(<SchedaTappa numero={4} nome="Teatro" minutiAllaProssima={2} nomeProssima="Trattoria Sorano" onChiudi={() => {}} onRiparti={() => {}} />);
        expect(screen.getByText('Riparti · 2 min alla Trattoria Sorano')).toBeInTheDocument();
        expect(NAV_TESTI.RIPARTI_VERSO(null, 'al Bar')).toBe('Riparti · al Bar');
    });
});

describe('«La chicca» e «Il racconto» mai con lo stesso testo', () => {
    const T = 'La porta Uzeda collega la piazza Duomo alla via Dusmet.';
    it('chiccaDistinta: uguale o contenuta nel racconto = nessuna chicca', () => {
        expect(chiccaDistinta({ insiderTip: T }, T)).toBeNull();
        expect(chiccaDistinta({ insiderTip: 'alla via Dusmet' }, T)).toBeNull();
        expect(chiccaDistinta({}, T)).toBeNull();
        expect(chiccaDistinta({ insiderTip: 'Vai all\'alba: non c\'è nessuno.' }, T)).toBe('Vai all\'alba: non c\'è nessuno.');
    });
    it('all\'arrivo con un solo testo c\'è una sola sezione (il racconto, una volta)', () => {
        render(<ArrivoTappa numero={1} totale={3} nome="Porta Uzeda" chicca={T} racconto={T} onApri={() => {}} onRiparti={() => {}} />);
        expect(screen.queryByTestId('chicca')).toBeNull();
        expect(screen.getAllByText(T)).toHaveLength(1);
        expect(screen.getByTestId('lettore')).toBeInTheDocument();
    });
    it('con due testi diversi compaiono entrambe', () => {
        render(<ArrivoTappa numero={1} totale={3} nome="Porta Uzeda" chicca="Vai all'alba." racconto={T} onApri={() => {}} onRiparti={() => {}} />);
        expect(screen.getByTestId('chicca').textContent).toContain("Vai all'alba.");
        expect(screen.queryByText(T)).toBeNull(); // il racconto è nel lettore, non ripetuto a schermo
    });
});

describe('foto vera o niente', () => {
    it('arrivo senza foto: nessuna area foto', () => {
        const { container } = render(<ArrivoTappa numero={1} totale={3} nome="Porta Uzeda" foto={null} racconto="Testo." onApri={() => {}} onRiparti={() => {}} />);
        expect(container.querySelector('.w-24.h-24')).toBeNull();
        expect(container.querySelector('img')).toBeNull();
    });
    it('arrivo con foto: c\'è', () => {
        const { container } = render(<ArrivoTappa numero={1} totale={3} nome="Porta Uzeda" foto="https://places.example/foto.jpg" onApri={() => {}} onRiparti={() => {}} />);
        expect(container.querySelector('img').getAttribute('src')).toBe('https://places.example/foto.jpg');
    });
    it('scheda tappa senza foto: niente riquadro da 256 px, ma il tasto per chiudere c\'è', () => {
        const { container } = render(<SchedaTappa numero={4} nome="Teatro" foto={null} onChiudi={() => {}} onRiparti={() => {}} />);
        expect(container.querySelector('.h-64')).toBeNull();
        expect(screen.getByRole('button', { name: 'Chiudi la scheda' })).toBeInTheDocument();
    });
    it('una foto di stock non è una foto di Places', () => {
        expect(fotoVera({ image: 'https://images.unsplash.com/x.jpg' })).toBeNull();
        expect(fotoVera({ googlePhoto: 'https://places.example/p.jpg' })).toBe('https://places.example/p.jpg');
    });
});

describe('la data della fine giro è nel fuso Europe/Rome', () => {
    it('le 23:30 UTC del 27/10 sono già il 28 a Roma', () => {
        expect(dataDelGiro(new Date('2026-10-27T23:30:00Z'))).toBe('28 OTTOBRE');
    });
    it('le 00:30 UTC del 1/11 sono l\'1 novembre; le 22:30 UTC del 30/10 il 30 (ora legale finita)', () => {
        expect(dataDelGiro(new Date('2026-11-01T00:30:00Z'))).toBe('1 NOVEMBRE');
        expect(dataDelGiro(new Date('2026-10-30T22:30:00Z'))).toBe('30 OTTOBRE');
    });
});
