// DURATE-ETICHETTE — ovunque compaia una durata del giro dice cosa misura: «Giornata 9:30–21:15» per la durata complessiva,
// «1h 33 a piedi · 6,9 km» per il cammino. Mai due numeri senza etichetta. Giro di 13 tappe.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { fasciaDelGiro, etichettaGiornata, etichettaCammino, minutiBrevi, distanzaBreve, tourSpanMinutes, displayedTourMinutes } from '@/lib/tourTiming';
import { QuickPathSummary } from '@/components/Map/QuickPathSummary';
import MeteProfilo from '@/components/MeteProfilo';

vi.mock('@/components/SalvaGiro', () => ({ default: () => null }));

// 27/10/2026, ora solare (+01:00): 13 tappe dalle 9:30, l'ultima arriva alle 20:45 e dura 30 minuti → fine 21:15
const T = (hhmm) => new Date(`2026-10-27T${hhmm}:00+01:00`).toISOString();
const ORARI = ['09:30', '10:05', '10:40', '11:20', '12:30', '14:30', '15:10', '15:50', '16:40', '18:00', '18:50', '19:40', '20:45'];
const GIRO13 = ORARI.map((o, i) => ({
    title: `Tappa ${i + 1}`, types: ['tourist_attraction'], latitude: 37.5 + i / 1000, longitude: 15.08, scheduledTime: T(o),
    stayMinutes: i === 12 ? 30 : 25, moment: 'mattina',
}));

describe('la durata complessiva: «Giornata 9:30–21:15»', () => {
    it('13 tappe: dal primo arrivo alla fine dell\'ultima sosta, ora di Roma, ore senza zero davanti', () => {
        expect(fasciaDelGiro(GIRO13)).toMatchObject({ da: '9:30', a: '21:15', nome: 'Giornata', testo: 'Giornata 9:30–21:15' });
        expect(etichettaGiornata(GIRO13)).toBe('Giornata 9:30–21:15');
    });
    it('stessi calcoli di oggi: i minuti sono quelli di tourSpanMinutes e displayedTourMinutes', () => {
        expect(fasciaDelGiro(GIRO13).minuti).toBe(tourSpanMinutes(GIRO13));
        expect(displayedTourMinutes(GIRO13)).toBe(tourSpanMinutes(GIRO13));
        expect(tourSpanMinutes(GIRO13)).toBe(11 * 60 + 45);
    });
    it('un giro breve si chiama «Giro», non «Giornata»', () => {
        const breve = GIRO13.slice(0, 3);
        expect(etichettaGiornata(breve)).toBe('Giro 9:30–11:05');
    });
    it('senza orari non si inventa niente', () => {
        expect(etichettaGiornata(GIRO13.map(({ scheduledTime, ...s }) => s))).toBeNull(); // eslint-disable-line no-unused-vars
        expect(etichettaGiornata([])).toBeNull();
    });
    it('con l\'ora legale (agosto) la fascia è in ora di Roma, non UTC', () => {
        const estate = [{ title: 'A', scheduledTime: new Date('2026-08-10T09:30:00+02:00').toISOString(), stayMinutes: 60 }];
        expect(etichettaGiornata(estate)).toBe('Giro 9:30–10:30');
    });
});

describe('il cammino: «1h 33 a piedi · 6,9 km»', () => {
    it('formato esatto', () => {
        expect(etichettaCammino({ durationMin: 93, distanceM: 6900 })).toBe('1h 33 a piedi · 6,9 km');
        expect(etichettaCammino({ durationMin: 45, distanceM: 850 })).toBe('45 min a piedi · 850 m');
        expect(etichettaCammino({ durationMin: 120, distanceM: 10000 })).toBe('2h a piedi · 10,0 km');
    });
    it('il mezzo cambia l\'etichetta; senza distanza resta il solo tempo etichettato', () => {
        expect(etichettaCammino({ durationMin: 20, distanceM: 4200, mode: 'driving' })).toBe('20 min in auto · 4,2 km');
        expect(etichettaCammino({ durationMin: 20, mode: 'bicycling' })).toBe('20 min in bici');
    });
    it('senza durata niente', () => {
        expect(etichettaCammino({ durationMin: 0, distanceM: 500 })).toBeNull();
        expect(minutiBrevi(null)).toBeNull();
        expect(distanzaBreve(0)).toBeNull();
    });
});

describe('le tre schede', () => {
    it('riepilogo del giro (13 tappe): «Giornata» + «9:30–21:15», niente «Durata» né minuti senza nome', () => {
        render(<QuickPathSummary tourData={{ title: 'Giro', city: 'Catania', steps: GIRO13, duration_minutes: 999 }} choices={{}} onViewMap={() => {}} onHome={() => {}} />);
        expect(screen.getByTestId('durata-etichetta').textContent).toBe('Giornata');
        expect(screen.getByTestId('durata-valore').textContent).toBe('9:30–21:15');
        expect(document.body.textContent).not.toMatch(/circa 11h|~/);
        cleanup();
    });
    it('riepilogo senza orari: «Durata» e il valore di prima', () => {
        const senza = GIRO13.slice(0, 2).map(({ scheduledTime, ...s }) => s); // eslint-disable-line no-unused-vars
        render(<QuickPathSummary tourData={{ title: 'Giro', city: 'Catania', steps: senza, duration_minutes: 180 }} choices={{}} onViewMap={() => {}} onHome={() => {}} />);
        expect(screen.getByTestId('durata-etichetta').textContent).toBe('Durata');
        cleanup();
    });
    it('scheda in Profilo: «Catania • 13 tappe • Giornata 9:30–21:15 • data»', () => {
        const riga = { id: 'g1', title: 'Il tuo giro', city: 'Catania', stops: GIRO13, created_at: '2026-10-24T10:00:00Z' };
        render(<MeteProfilo mete={[]} giriSalvati={[riga]} onRimuovi={() => {}} onApri={() => {}} />);
        const t = screen.getByTestId('giro-salvato').textContent;
        expect(t).toContain('13 tappe');
        expect(t).toContain('Giornata 9:30–21:15');
        cleanup();
    });
    it('scheda in Profilo di un giro salvato prima (senza orari): nessuna durata inventata', () => {
        const vecchio = { id: 'g0', title: 'Vecchio', city: 'Roma', stops: [{ title: 'Colosseo', lat: 41.89, lng: 12.49 }], created_at: '2026-10-01T10:00:00Z' };
        render(<MeteProfilo mete={[]} giriSalvati={[vecchio]} onRimuovi={() => {}} />);
        expect(screen.getByTestId('giro-salvato').textContent).not.toMatch(/Giornata|Giro \d/);
        cleanup();
    });
});
