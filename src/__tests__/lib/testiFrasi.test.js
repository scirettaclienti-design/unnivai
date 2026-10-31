// TESTI — le frasi del tour, lette dal codice (stopPhrases, stopMoments).
// Rosso su 2015b5c (le frasi di prima), verde sul codice di dopo.
//
// 1 tempo libero · 4 frasi che contraddicono il tour · 5 «Dopocena» · 6 prezzi a parole · 10 nessuna frase uguale due volte.

import { describe, it, expect } from 'vitest';
import {
    stopData, composeStop, apertura, ganciValidi, composeFreeTime, registraFrasi, maschera, FRASI_TEMPO_LIBERO,
} from '../../lib/stopPhrases';
import { groupStopsByDayAndMoment } from '../../lib/stopMoments';

const at = (hhmm, day = '2026-10-16') => new Date(`${day}T${hhmm}:00+02:00`).toISOString();

describe('TESTI 1 — il tempo libero dice sempre la stessa cosa', () => {
    it('una sola frase, uguale per mattina, pomeriggio, aperitivo e dopocena', () => {
        expect(FRASI_TEMPO_LIBERO).toEqual(['Niente in agenda: cammina dove ti porta la strada.']);
        for (const momento of ['mattina', 'pomeriggio', 'aperitivo', 'dopocena', 'altro', undefined]) {
            const t = composeFreeTime({ momento });
            expect(t).toBe('Niente in agenda: cammina dove ti porta la strada.');
            expect(t).not.toMatch(/non c'è niente che valga|valga il cammino|Il resto lo scegli tu/);
        }
    });
});

describe('TESTI 4 — frasi che contraddicono il tour', () => {
    const luogo = { title: 'Parco delle Valli', place_id: 'pv', types: ['park'] };
    it('«Qui la giornata si chiude» solo sull\'ultima tappa di un giro che finisce di sera', () => {
        const metaPomeriggio = stopData({ stop: luogo, momento: 'pomeriggio', orario: '15:30', ultimo: true });
        expect(ganciValidi(metaPomeriggio).has('ultima')).toBe(false);
        expect(composeStop(metaPomeriggio, { gancio: 'ultima' }).text).not.toMatch(/giornata si chiude/);
        const sera = stopData({ stop: luogo, momento: 'cena', orario: '20:30', ultimo: true });
        expect(ganciValidi(sera).get('ultima')).toBe('Qui la giornata si chiude.');
        const nonUltima = stopData({ stop: luogo, momento: 'cena', orario: '20:30', ultimo: false });
        expect(ganciValidi(nonUltima).has('ultima')).toBe(false);
    });
    it('«Chiudi la giornata a tavola» solo a cena sull\'ultima tappa', () => {
        const ristorante = { title: 'Osteria Navona', types: ['restaurant'] };
        for (let i = 0; i < 40; i++) {
            const d = stopData({ stop: { ...ristorante, place_id: `o${i}` }, momento: 'cena', orario: '20:30', locale: true, priceLevel: 2, ultimo: false });
            expect(apertura(d), `o${i}`).not.toMatch(/Chiudi la giornata/);
        }
    });
    it('la durata scritta è la durata vera della tappa (non «cinque minuti» per una chiesa da venti)', () => {
        let vista = null;
        for (let i = 0; i < 60 && !vista; i++) {
            const d = stopData({ stop: { title: 'Chiesa del Gesù', place_id: `c${i}`, types: ['church'], primaryType: 'church', stayMinutes: 20 }, momento: 'mattina', orario: '10:00' });
            if (/Ti prendi/.test(apertura(d))) vista = apertura(d);
        }
        expect(vista).toBe('Ti prendi venti minuti dentro la Chiesa del Gesù.');
        const museoChiesa = stopData({ stop: { title: 'Abbazia', place_id: 'ab', types: ['church', 'museum'], primaryType: 'church', stayMinutes: 60 }, momento: 'mattina', orario: '10:00' });
        expect(museoChiesa.durata).toBe('sessanta minuti');
        for (let i = 0; i < 60; i++) {
            const d = stopData({ stop: { title: 'Chiesa', place_id: `c${i}`, types: ['church'], stayMinutes: 20 }, momento: 'mattina' });
            expect(apertura(d)).not.toMatch(/cinque minuti/);
        }
    });
    it('numero e parola concordati: «un minuto», mai «1 minuti»', () => {
        const d1 = stopData({ stop: { title: 'Museo Barracco', place_id: 'mb', types: ['museum'] }, momento: 'mattina', orario: '10:00', minutiDaPrima: 1 });
        expect(ganciValidi(d1).get('distanza')).toBe('È a un minuto a piedi dalla tappa prima.');
        const d5 = stopData({ stop: { title: 'Museo Barracco', place_id: 'mb', types: ['museum'] }, momento: 'mattina', orario: '10:00', minutiDaPrima: 5 });
        expect(ganciValidi(d5).get('distanza')).toBe('Sono 5 minuti a piedi dalla tappa prima.');
        let pranzo1 = null;
        for (let i = 0; i < 60 && !pranzo1; i++) {
            const d = stopData({ stop: { title: 'Trattoria Uno', place_id: `t${i}`, types: ['restaurant'] }, momento: 'pranzo', locale: true, priceLevel: 2, minutiDaPrima: 1 });
            if (/a piedi ti siedi/.test(apertura(d))) pranzo1 = apertura(d);
        }
        expect(pranzo1).toBe('A un minuto a piedi ti siedi dalla Trattoria Uno, trattoria con prezzi medi.');
        // anche l'anticipo sul tramonto
        const sole = stopData({ stop: { title: 'Belvedere', place_id: 'bv', types: ['tourist_attraction'] }, momento: 'aperitivo', orario: '18:29', tramonto: '18:30' });
        expect(ganciValidi(sole).get('tramonto')).toBe('Il sole tramonta alle 18:30: sei qui un minuto prima.');
        const adesso = stopData({ stop: { title: 'Belvedere', place_id: 'bv', types: ['tourist_attraction'] }, momento: 'aperitivo', orario: '18:30', tramonto: '18:30' });
        expect(ganciValidi(adesso).has('tramonto')).toBe(false);
    });
});

describe('TESTI 5 — dalle 21:30 la sezione è «Dopocena», mai «Aperitivo»', () => {
    const drink = (hhmm) => ({ title: `Bar ${hhmm}`, moment: 'aperitivo', scheduledTime: at(hhmm), place_id: hhmm });
    const etichette = (stops) => groupStopsByDayAndMoment(stops).flatMap(d => d.groups).map(g => g.moment.label);
    it('21:25 resta Aperitivo, 21:30 e dopo sono Dopocena', () => {
        expect(etichette([drink('21:25')])).toEqual(['Aperitivo']);
        expect(etichette([drink('21:30')])).toEqual(['Dopocena']);
        expect(etichette([drink('22:10')])).toEqual(['Dopocena']);
        expect(etichette([drink('18:30')])).toEqual(['Aperitivo']);
    });
    it('drink alle 21:25 e passeggiata alle 22:10: due sezioni, mai «Aperitivo» dopo le 21:30', () => {
        expect(etichette([drink('21:25'), { ...drink('22:10'), passeggiata: true }])).toEqual(['Aperitivo', 'Dopocena']);
    });
    it('la frase: «L\'aperitivo lo prendi da…» → «Il drink lo prendi da…» dalle 21:30', () => {
        const bar = { title: 'Bar Drinkeria', place_id: 'dk', types: ['bar'] };
        const tardi = stopData({ stop: bar, momento: 'aperitivo', orario: '21:45', locale: true, priceLevel: 2 });
        expect(apertura(tardi)).toBe('Il drink lo prendi da Bar Drinkeria, bar con prezzi medi.');
        const presto = stopData({ stop: bar, momento: 'aperitivo', orario: '19:00', locale: true, priceLevel: 2 });
        expect(apertura(presto)).toBe("L'aperitivo lo prendi da Bar Drinkeria, bar con prezzi medi.");
    });
});

describe('TESTI 6 — i prezzi a parole', () => {
    it('«fascia €» → prezzi bassi, «fascia €€» → prezzi medi, «fascia €€€» → prezzi alti', () => {
        const frase = (priceLevel) => apertura(stopData({ stop: { title: 'Osteria Navona', place_id: 'on', types: ['restaurant'] }, momento: 'cena', orario: '20:30', locale: true, priceLevel }));
        expect(frase(1)).toBe('La cena è dall\'Osteria Navona, osteria con prezzi bassi.');
        expect(frase(2)).toBe('La cena è dall\'Osteria Navona, osteria con prezzi medi.');
        expect(frase(3)).toBe('La cena è dall\'Osteria Navona, osteria con prezzi alti.');
        for (const l of [1, 2, 3, 4]) expect(frase(l)).not.toMatch(/fascia|€/);
        // senza il livello di prezzo: nessun buco
        expect(frase(null)).toBe('La cena è dall\'Osteria Navona, osteria.');
    });
});

describe('TESTI 10 — nello stesso tour nessuna frase uguale due volte', () => {
    it('due chiese e due musei: la seconda sceglie un\'altra frase approvata, non la stessa', () => {
        const usate = new Set();
        const testi = [];
        const tappe = [
            { title: 'Chiesa Alfa', types: ['church'], primaryType: 'church', stayMinutes: 20 },
            { title: 'Chiesa Beta', types: ['church'], primaryType: 'church', stayMinutes: 20 },
            { title: 'Museo Gamma', types: ['museum'], primaryType: 'museum', stayMinutes: 60 },
            { title: 'Museo Delta', types: ['museum'], primaryType: 'museum', stayMinutes: 60 },
        ];
        // un seme per cui entrambe le chiese partirebbero dalla stessa variante
        tappe.forEach((t, i) => {
            const d = stopData({ stop: { ...t, place_id: `x${i}` }, momento: 'mattina', orario: '10:00', minutiDaPrima: 7 });
            const r = composeStop(d, { gancio: 'distanza' }, [], { evita: usate });
            registraFrasi(usate, r.text, d.nome);
            testi.push(r.text);
        });
        const frasi = testi.flatMap((t, i) => t.split(/(?<=[.!?])\s+/).map(f => maschera(f, tappe[i].title)));
        expect(new Set(frasi).size, testi.join(' | ')).toBe(frasi.length);
    });
    it('«Sono N minuti a piedi» si dice una volta sola: le altre tappe scelgono un altro gancio vero', () => {
        const usate = new Set();
        const out = [];
        for (let i = 0; i < 4; i++) {
            const d = stopData({ stop: { title: `Piazza ${i}`, place_id: `p${i}`, types: ['establishment'] }, momento: 'pomeriggio', orario: `1${5 + i}:00`, minutiDaPrima: 5 + i });
            const r = composeStop(d, { gancio: 'distanza' }, [], { evita: usate });
            registraFrasi(usate, r.text, d.nome);
            out.push(r);
        }
        expect(out.filter(r => r.gancio === 'distanza')).toHaveLength(1);
        expect(out.filter(r => /minuti a piedi/.test(r.text))).toHaveLength(1);
    });
});
