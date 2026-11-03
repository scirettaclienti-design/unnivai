// @vitest-environment node
//
// AVVISI (L6) — la logica pura di supabase/functions/_shared/avvisi.ts: soglie, doppioni, riepilogo, orchestrazione.
// Nessuna rete, nessuna email vera.
import { describe, it, expect, vi } from 'vitest';
import {
    costiGiorno, tassoErrori, valutaAvvisi, decidiRiepilogo, comporreRiepilogo, eseguiOraria, partiRoma, giornoPrima,
    inizioGiornoRoma, PREZZI, MIN_RICHIESTE_ORA,
} from '../../../supabase/functions/_shared/avvisi.ts';

const ORA = new Date('2026-11-03T13:20:00Z'); // 14:20 a Roma
const costo = (totale) => ({ ai: totale, google: 0, totale, googleDisponibile: true });
const base = { ora: ORA, costoOggi: costo(1), sogliaCostoUsd: 15, ultimaOra: { richieste: 1000, errori: 10 }, giaInviati: new Set() };
const conteggi = (x = {}) => ({
    giorno: '2026-11-02', giri: 0, racconti: { passati: 0, scartati: 0, senzaFonti: 0, costoUsd: 0 }, chat: 0, ospiti: 0, vociNuove: 0,
    erroriApp: { totale: 0, top: [] }, ...x,
});

describe('costo del giorno', () => {
    it('somma AI e Google con i prezzi scritti nel codice', () => {
        const c = costiGiorno(conteggi({ giri: 10, chat: 5, vociNuove: 100, racconti: { passati: 1, scartati: 0, senzaFonti: 0, costoUsd: 0.5 } }),
            { proxyRichieste: 0, proxyErrori: 0, placesChiamate: 100, placesFoto: 10 });
        expect(c.ai).toBeCloseTo(10 * PREZZI.giroAi + 5 * PREZZI.contornoAi + 100 * PREZZI.voceAudio + 0.5, 3);
        expect(c.google).toBeCloseTo(100 * PREZZI.googleChiamata + 10 * PREZZI.googleFoto, 3);
        expect(c.totale).toBeCloseTo(c.ai + c.google, 2);
    });
    it('senza log il costo Google non si inventa', () => {
        const c = costiGiorno(conteggi({ giri: 1 }), null);
        expect(c.googleDisponibile).toBe(false);
        expect(c.google).toBe(0);
    });
});

describe('avviso di costo', () => {
    it('sotto la soglia: niente', () => {
        expect(valutaAvvisi({ ...base, costoOggi: costo(14.99) })).toEqual([]);
    });
    it('esattamente alla soglia: niente (si avvisa SOPRA)', () => {
        expect(valutaAvvisi({ ...base, costoOggi: costo(15) })).toEqual([]);
    });
    it('sopra la soglia: un avviso con titolo = dato e messaggio = motivo', () => {
        const a = valutaAvvisi({ ...base, costoOggi: costo(15.01) });
        expect(a).toHaveLength(1);
        expect(a[0].chiave).toBe('costo:2026-11-03');
        expect(a[0].email.oggetto).toBe('Costo di oggi $15,01, soglia $15,00');
        expect(a[0].email.testo).toMatch(/superato la soglia/);
    });
    it('una volta al giorno: già mandato = niente; il giorno dopo di nuovo', () => {
        const gia = new Set(['costo:2026-11-03']);
        expect(valutaAvvisi({ ...base, costoOggi: costo(40), giaInviati: gia })).toEqual([]);
        const domani = new Date('2026-11-04T13:20:00Z');
        expect(valutaAvvisi({ ...base, ora: domani, costoOggi: costo(40), giaInviati: gia })).toHaveLength(1);
    });
});

describe('avviso sugli errori del proxy', () => {
    it('4,9% in un\'ora: niente', () => {
        expect(valutaAvvisi({ ...base, ultimaOra: { richieste: 1000, errori: 49 } })).toEqual([]);
    });
    it('esattamente 5%: niente', () => {
        expect(valutaAvvisi({ ...base, ultimaOra: { richieste: 1000, errori: 50 } })).toEqual([]);
    });
    it('5,1% in un\'ora: un avviso', () => {
        const a = valutaAvvisi({ ...base, ultimaOra: { richieste: 1000, errori: 51 } });
        expect(a).toHaveLength(1);
        expect(a[0].tipo).toBe('errori');
        expect(a[0].chiave).toBe('errori:2026-11-03T14');
        expect(a[0].email.oggetto).toBe("Errori del proxy 5,1% nell'ultima ora");
    });
    it('zero richieste: niente, mai NaN', () => {
        expect(tassoErrori(0, 0)).toBe(0);
        expect(valutaAvvisi({ ...base, ultimaOra: { richieste: 0, errori: 0 } })).toEqual([]);
    });
    it('troppo poche richieste per una percentuale: niente (1 su 3)', () => {
        expect(valutaAvvisi({ ...base, ultimaOra: { richieste: 3, errori: 1 } })).toEqual([]);
        expect(valutaAvvisi({ ...base, ultimaOra: { richieste: MIN_RICHIESTE_ORA, errori: 2 } })).toHaveLength(1);
    });
    it('log non leggibili: niente avviso', () => {
        expect(valutaAvvisi({ ...base, ultimaOra: null })).toEqual([]);
    });
    it('nessun doppio avviso nella stessa ora, sì in un\'ora diversa', () => {
        const peggio = { ...base, ultimaOra: { richieste: 100, errori: 30 } };
        const primo = valutaAvvisi(peggio);
        expect(primo).toHaveLength(1);
        expect(valutaAvvisi({ ...peggio, giaInviati: new Set([primo[0].chiave]) })).toEqual([]);
        expect(valutaAvvisi({ ...peggio, ora: new Date('2026-11-03T14:20:00Z'), giaInviati: new Set([primo[0].chiave]) })).toHaveLength(1);
    });
    it('costo e errori insieme: due avvisi distinti', () => {
        expect(valutaAvvisi({ ...base, costoOggi: costo(50), ultimaOra: { richieste: 100, errori: 30 } }).map((a) => a.tipo)).toEqual(['costo', 'errori']);
    });
});

describe('tempo a Roma', () => {
    it('giorno e ora con l\'ora legale e senza', () => {
        expect(partiRoma(new Date('2026-07-01T22:30:00Z'))).toMatchObject({ giorno: '2026-07-02', ora: 0 });
        expect(partiRoma(new Date('2026-11-02T23:30:00Z'))).toMatchObject({ giorno: '2026-11-03', ora: 0 });
    });
    it('inizio del giorno: 23:00Z d\'inverno, 22:00Z d\'estate', () => {
        expect(inizioGiornoRoma('2026-11-02').toISOString()).toBe('2026-11-01T23:00:00.000Z');
        expect(inizioGiornoRoma('2026-07-02').toISOString()).toBe('2026-07-01T22:00:00.000Z');
    });
    it('giorno prima', () => expect(giornoPrima('2026-03-01')).toBe('2026-02-28'));
});

describe('riepilogo di ieri', () => {
    it('prima delle 7: niente', () => {
        expect(decidiRiepilogo(new Date('2026-11-03T05:30:00Z'), new Set())).toBeNull(); // 06:30
    });
    it('dalle 7: il riepilogo di ieri, una volta sola', () => {
        const r = decidiRiepilogo(new Date('2026-11-03T06:05:00Z'), new Set()); // 07:05
        expect(r).toEqual({ giorno: '2026-11-02', chiave: 'riepilogo:2026-11-02' });
        expect(decidiRiepilogo(new Date('2026-11-03T12:05:00Z'), new Set([r.chiave]))).toBeNull();
    });
    it('contiene giri, racconti, chat, ospiti, errori, costo AI e Google', () => {
        const m = comporreRiepilogo(conteggi({ giri: 12, chat: 7, ospiti: 3, racconti: { passati: 5, scartati: 1, senzaFonti: 0, costoUsd: 0.1 } }),
            { proxyRichieste: 200, proxyErrori: 4, placesChiamate: 10, placesFoto: 0 });
        for (const t of ['Giri generati: 12', 'Ospiti nuovi: 3', 'Errori del proxy: 4 su 200 (2,0%)', 'Costo AI stimato', 'Costo Google stimato', 'Totale stimato']) expect(m.testo).toContain(t);
        expect(m.html).toContain('<table');
    });
    it('senza log lo dice', () => {
        expect(comporreRiepilogo(conteggi(), null).testo).toMatch(/log non leggibili/);
    });
});

describe('esecuzione oraria', () => {
    function dip(extra = {}) {
        const inviati = new Set(); const mandate = [];
        return {
            inviati, mandate,
            d: {
                ora: new Date('2026-11-03T06:05:00Z'), sogliaCostoUsd: 15,
                leggiConteggi: async (g) => conteggi({ giorno: g }),
                leggiTraffico: async () => ({ proxyRichieste: 1000, proxyErrori: 100, placesChiamate: 0, placesFoto: 0 }),
                leggiInviati: async () => new Set(inviati),
                prendi: async (k) => { if (inviati.has(k)) return false; inviati.add(k); return true; },
                rilascia: async (k) => { inviati.delete(k); },
                invia: async (m) => { mandate.push(m.oggetto); return true; },
                ...extra,
            },
        };
    }
    it('manda l\'avviso sugli errori e il riepilogo; la seconda esecuzione non rimanda niente', async () => {
        const { d, mandate } = dip();
        const e1 = await eseguiOraria(d);
        expect(e1.mandati).toEqual(['errori:2026-11-03T07', 'riepilogo:2026-11-02']);
        const e2 = await eseguiOraria(d);
        expect(e2.mandati).toEqual([]);
        expect(mandate).toHaveLength(2);
    });
    it('due esecuzioni insieme: la chiave la prende una sola', async () => {
        const { d, mandate } = dip();
        await Promise.all([eseguiOraria(d), eseguiOraria(d)]);
        expect(mandate).toHaveLength(2);
    });
    it('se Resend fallisce la chiave si rilascia e il giro dopo riprova', async () => {
        let ok = false;
        const { d, mandate } = dip({ invia: vi.fn(async (m) => { if (ok) mandate.push(m.oggetto); return ok; }) });
        const e1 = await eseguiOraria(d);
        expect(e1.errori.length).toBe(2);
        ok = true;
        const e2 = await eseguiOraria(d);
        expect(e2.mandati.length).toBe(2);
    });
    it('zero richieste e costo basso: nessun avviso', async () => {
        const { d, mandate } = dip({ ora: new Date('2026-11-03T04:05:00Z'), leggiTraffico: async () => ({ proxyRichieste: 0, proxyErrori: 0, placesChiamate: 0, placesFoto: 0 }) });
        const e = await eseguiOraria(d);
        expect(e.mandati).toEqual([]);
        expect(mandate).toEqual([]);
    });
});
