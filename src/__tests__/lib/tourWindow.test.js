// Gate FINESTRA TEMPORALE (G3) — tabella dei casi di resolveTourWindow.
//
// Gli istanti sono scritti con l'offset di Roma esplicito (+02:00 ora legale,
// +01:00 ora solare): il test non dipende dal fuso della macchina, e la CI gira
// in UTC. Lunedi' 5 ottobre 2026, ore 20:57, e' il riferimento della richiesta.

import { describe, it, expect } from 'vitest';
import { resolveTourWindow, romeHour } from '@/lib/tourWindow';

const LUN_2057 = new Date('2026-10-05T20:57:00+02:00');
const LUN_1500 = new Date('2026-10-05T15:00:00+02:00');
const LUN_2200 = new Date('2026-10-05T22:00:00+02:00');
const LUN_1000 = new Date('2026-10-05T10:00:00+02:00');

const at = (iso) => new Date(iso).toISOString();

// [descrizione, input, atteso]
const CASI = [
    ['"Domani voglio vivere Roma da romano" alle 20:57 → mar 9:30–22:30',
        { text: 'Domani voglio vivere Roma da romano', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-10-06', start: '2026-10-06T09:30:00+02:00', end: '2026-10-06T22:30:00+02:00', shifted: false }],
    ['"stasera" alle 15:00 → oggi 18:00–22:30',
        { text: 'stasera aperitivo a Trastevere', requestTime: LUN_1500, pathType: 'custom' },
        { date: '2026-10-05', start: '2026-10-05T18:00:00+02:00', end: '2026-10-05T22:30:00+02:00', shifted: false }],
    ['"sabato pomeriggio" senza durata → sabato prossimo 15:00–18:00',
        { text: 'sabato pomeriggio tra le botteghe', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-10-10', start: '2026-10-10T15:00:00+02:00', end: '2026-10-10T18:00:00+02:00', shifted: false }],
    ['"sabato pomeriggio" con Mezza Giornata → 15:00–19:00',
        { text: 'sabato pomeriggio', requestTime: LUN_2057, pathType: 'custom', duration: 'Mezza Giornata' },
        { date: '2026-10-10', start: '2026-10-10T15:00:00+02:00', end: '2026-10-10T19:00:00+02:00', shifted: false }],
    ['"sabato pomeriggio" con 1 Giorno → 15:00–22:30',
        { text: 'sabato pomeriggio', requestTime: LUN_2057, pathType: 'custom', duration: '1 Giorno' },
        { date: '2026-10-10', start: '2026-10-10T15:00:00+02:00', end: '2026-10-10T22:30:00+02:00', shifted: false }],
    ['Percorso Veloce con "domani" nel testo → da adesso',
        { text: 'domani mattina al Colosseo', requestTime: LUN_2057, pathType: 'quick', duration: 'Veloce' },
        { date: '2026-10-05', start: '2026-10-05T20:57:00+02:00', end: '2026-10-05T22:57:00+02:00', shifted: false }],
    ['richiesta alle 22:00 senza giorno → domani 9:30, slittamento attivo',
        { text: 'un giro tra le fontane', requestTime: LUN_2200, pathType: 'custom' },
        { date: '2026-10-06', start: '2026-10-06T09:30:00+02:00', end: '2026-10-06T22:30:00+02:00', shifted: true }],
    ['nessuna indicazione di tempo → da adesso',
        { text: 'carbonara e vicoli', requestTime: LUN_1500, pathType: 'custom' },
        { date: '2026-10-05', start: '2026-10-05T15:00:00+02:00', end: '2026-10-05T22:30:00+02:00', shifted: false }],
    ['"fra una settimana" → lun 12 ottobre, giornata intera',
        { text: 'fra una settimana voglio vedere i musei', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-10-12', start: '2026-10-12T09:30:00+02:00', end: '2026-10-12T22:30:00+02:00', shifted: false }],
    ['"tra 3 giorni" → gio 8 ottobre, giornata intera',
        { text: 'tra 3 giorni sono a Roma', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-10-08', start: '2026-10-08T09:30:00+02:00', end: '2026-10-08T22:30:00+02:00', shifted: false }],
    ['"la prossima settimana" → lunedi prossimo, giornata intera',
        { text: 'la prossima settimana un tour del barocco', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-10-12', start: '2026-10-12T09:30:00+02:00', end: '2026-10-12T22:30:00+02:00', shifted: false }],
    ['"questo weekend" → sabato, giornata intera',
        { text: 'questo weekend con gli amici', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-10-10', start: '2026-10-10T09:30:00+02:00', end: '2026-10-10T22:30:00+02:00', shifted: false }],
    ['"il 15 ottobre" → 15 ottobre, giornata intera',
        { text: 'il 15 ottobre festeggio il compleanno', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-10-15', start: '2026-10-15T09:30:00+02:00', end: '2026-10-15T22:30:00+02:00', shifted: false }],
    ['"15/10" → 15 ottobre, giornata intera',
        { text: 'arrivo il 15/10', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-10-15', start: '2026-10-15T09:30:00+02:00', end: '2026-10-15T22:30:00+02:00', shifted: false }],
    ['"il 15" → il prossimo 15 del mese, giornata intera',
        { text: 'il 15 voglio fare un giro', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-10-15', start: '2026-10-15T09:30:00+02:00', end: '2026-10-15T22:30:00+02:00', shifted: false }],
    ['"il 3" quando il 3 e\' passato → il 3 del mese dopo',
        { text: 'il 3 sono in citta', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-11-03', start: '2026-11-03T09:30:00+01:00', end: '2026-11-03T22:30:00+01:00', shifted: false }],
    ['"alle 17" detto alle 10:00 → oggi dalle 17',
        { text: 'alle 17 un aperitivo', requestTime: LUN_1000, pathType: 'custom' },
        { date: '2026-10-05', start: '2026-10-05T17:00:00+02:00', end: '2026-10-05T22:30:00+02:00', shifted: false }],
    ['"alle 17" detto alle 20:57 → domani dalle 17, slittamento attivo',
        { text: 'alle 17 un aperitivo', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-10-06', start: '2026-10-06T17:00:00+02:00', end: '2026-10-06T22:30:00+02:00', shifted: true }],
    ['"sabato alle 17:30" → sabato dalle 17:30',
        { text: 'sabato alle 17:30', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-10-10', start: '2026-10-10T17:30:00+02:00', end: '2026-10-10T22:30:00+02:00', shifted: false }],
    ['"domani" con Mezza Giornata → 9:30–13:30',
        { text: 'domani', requestTime: LUN_2057, pathType: 'custom', duration: 'Mezza Giornata' },
        { date: '2026-10-06', start: '2026-10-06T09:30:00+02:00', end: '2026-10-06T13:30:00+02:00', shifted: false }],
    ['"dopodomani" → mer 7 ottobre (non domani)',
        { text: 'dopodomani', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-10-07', start: '2026-10-07T09:30:00+02:00', end: '2026-10-07T22:30:00+02:00', shifted: false }],
    ['"lunedì" detto di lunedì → il lunedì dopo',
        { text: 'lunedì al Pantheon', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-10-12', start: '2026-10-12T09:30:00+02:00', end: '2026-10-12T22:30:00+02:00', shifted: false }],
    ['"stasera" alle 20:57 → da adesso (piu\' tardi delle 18)',
        { text: 'stasera', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-10-05', start: '2026-10-05T20:57:00+02:00', end: '2026-10-05T22:30:00+02:00', shifted: false }],
    ['"il 26 ottobre" → dopo il cambio d\'ora, 9:30 di Roma (+01:00)',
        { text: 'il 26 ottobre', requestTime: LUN_2057, pathType: 'custom' },
        { date: '2026-10-26', start: '2026-10-26T09:30:00+01:00', end: '2026-10-26T22:30:00+01:00', shifted: false }],
];

describe('resolveTourWindow — la tabella (lunedi 5/10/2026)', () => {
    it.each(CASI)('%s', (_desc, input, atteso) => {
        const w = resolveTourWindow(input);
        expect(w.date).toBe(atteso.date);
        expect(w.start.toISOString()).toBe(at(atteso.start));
        expect(w.end.toISOString()).toBe(at(atteso.end));
        expect(w.shiftedToNextDay).toBe(atteso.shifted);
        expect(w.timeZone).toBe('Europe/Rome');
    });
});

describe('resolveTourWindow — proprieta\'', () => {
    it('"2-3 Giorni" → una finestra per ogni giorno, dalla prima in poi', () => {
        const w = resolveTourWindow({ text: 'domani', requestTime: LUN_2057, pathType: 'custom', duration: '2-3 Giorni' });
        expect(w.windows.map(x => x.date)).toEqual(['2026-10-06', '2026-10-07', '2026-10-08']);
        expect(w.windows.map(x => [x.start.toISOString(), x.end.toISOString()])).toEqual([
            [at('2026-10-06T09:30:00+02:00'), at('2026-10-06T22:30:00+02:00')],
            [at('2026-10-07T09:30:00+02:00'), at('2026-10-07T22:30:00+02:00')],
            [at('2026-10-08T09:30:00+02:00'), at('2026-10-08T22:30:00+02:00')],
        ]);
    });

    it('una durata a giorno singolo → una sola finestra', () => {
        const w = resolveTourWindow({ text: 'domani', requestTime: LUN_2057, pathType: 'custom', duration: '1 Giorno' });
        expect(w.windows).toHaveLength(1);
    });

    it('Percorso Veloce alle 22:00 → da adesso, mai slittato', () => {
        const w = resolveTourWindow({ text: 'domani', requestTime: LUN_2200, pathType: 'quick', duration: 'Lungo' });
        expect(w.start.getTime()).toBe(LUN_2200.getTime());
        expect(w.shiftedToNextDay).toBe(false);
        expect(w.anchored).toBe(false);
        expect(w.end.getTime() - w.start.getTime()).toBe(360 * 60000);
    });

    it('pathType assente = Percorso Veloce (comportamento di prima per gli altri chiamanti)', () => {
        const w = resolveTourWindow({ text: 'domani', requestTime: LUN_2057 });
        expect(w.start.getTime()).toBe(LUN_2057.getTime());
    });

    it('anchored = true solo quando la partenza non e\' "adesso"', () => {
        expect(resolveTourWindow({ text: 'domani', requestTime: LUN_2057, pathType: 'custom' }).anchored).toBe(true);
        expect(resolveTourWindow({ text: 'vicoli', requestTime: LUN_1500, pathType: 'custom' }).anchored).toBe(false);
    });

    it('romeHour legge l\'ora di Roma, non del dispositivo', () => {
        expect(romeHour(new Date('2026-10-06T07:30:00Z'))).toBe(9);
        expect(romeHour(new Date('2026-12-06T08:30:00Z'))).toBe(9);
    });

    it('e\' pura: stessa entrata, stessa uscita, e non legge l\'orologio', () => {
        const a = resolveTourWindow({ text: 'sabato pomeriggio', requestTime: LUN_2057, pathType: 'custom' });
        const b = resolveTourWindow({ text: 'sabato pomeriggio', requestTime: LUN_2057, pathType: 'custom' });
        expect(a.start.toISOString()).toBe(b.start.toISOString());
        expect(a.end.toISOString()).toBe(b.end.toISOString());
    });
});
