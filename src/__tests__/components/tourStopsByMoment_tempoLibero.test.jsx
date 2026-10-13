// CONTINUITA' — l'elenco compatto (Percorso Veloce, Sorprendimi) rimette il tempo libero
// al suo posto, con la sua fascia; le tappe tengono il loro orario e i loro numeri.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { TourStopsByMoment } from '../../components/TourStopsByMoment';
import { withFreeTime, freeTimeRangeLabel } from '../../lib/stopMoments';

const at = (hhmm) => new Date(`2026-10-14T${hhmm}:00+02:00`).toISOString();
const STOPS = [
    { title: 'Chiesa', moment: 'mattina', description: 'a', scheduledTime: at('09:30'), stayMinutes: 20 },
    { title: 'Trattoria', moment: 'pranzo', description: 'b', scheduledTime: at('12:35'), stayMinutes: 75 },
];
const LIBERO = { tempoLibero: true, title: 'Tempo libero', moment: 'mattina', description: 'Tempo libero: per la mattina non c\'è niente che valga il cammino. Il resto lo scegli tu.', scheduledTime: at('09:50'), stayMinutes: 160 };

describe('withFreeTime — il tempo libero torna al suo posto, per orario', () => {
    it('fra la tappa che finisce e quella che segue', () => {
        expect(withFreeTime(STOPS, [LIBERO]).map(s => s.title)).toEqual(['Chiesa', 'Tempo libero', 'Trattoria']);
    });
    it('senza orario va in coda; senza tempo libero la lista e\' quella di prima', () => {
        expect(withFreeTime(STOPS, [{ ...LIBERO, scheduledTime: null }]).map(s => s.title)).toEqual(['Chiesa', 'Trattoria', 'Tempo libero']);
        expect(withFreeTime(STOPS, null)).toEqual(STOPS);
        expect(withFreeTime(STOPS, [])).toEqual(STOPS);
    });
});

describe('freeTimeRangeLabel', () => {
    it('fascia dall\'orario alla fine della sosta, ora di Roma', () => {
        expect(freeTimeRangeLabel(LIBERO)).toBe('09:50–12:30');
    });
    it('senza orario o senza durata: niente fascia', () => {
        expect(freeTimeRangeLabel({ ...LIBERO, scheduledTime: null })).toBeNull();
        expect(freeTimeRangeLabel({ ...LIBERO, stayMinutes: 0 })).toBeNull();
    });
});

describe('TourStopsByMoment con tempo libero', () => {
    it('la riga ha la sua fascia, le tappe il loro orario e il numero 1, 2 (il tempo libero non e\' una tappa)', () => {
        const { container } = render(createElement(TourStopsByMoment, { stops: STOPS, freeTime: [LIBERO] }));
        const cards = [...container.querySelectorAll('[data-stop-card]')];
        expect(cards).toHaveLength(3);
        expect(cards[1].hasAttribute('data-free-time')).toBe(true);
        expect(cards[1].querySelector('[data-free-time-range]').textContent).toBe('09:50–12:30');
        expect(cards[0].textContent).toContain('09:30');
        expect(cards[2].textContent).toContain('12:35');
        const numeri = cards.filter(c => !c.hasAttribute('data-free-time')).map(c => c.querySelector('div.rounded-full').textContent);
        expect(numeri).toEqual(['1', '2']);
    });
    it('senza tempo libero: come prima', () => {
        const { container } = render(createElement(TourStopsByMoment, { stops: STOPS }));
        expect(container.querySelectorAll('[data-free-time]')).toHaveLength(0);
        expect(container.querySelectorAll('[data-stop-card]')).toHaveLength(2);
    });
});
