// BANCO-NAZ — le misure del banco nazionale (scripts/banco/misure.js): sono
// loro a decidere i semafori, quindi si provano senza rete.
import { describe, it, expect } from 'vitest';
import { misuraCaso, semafori, inComune, violazioniVincoli, costoUsd } from '../../../scripts/banco/misure.js';
import { buildReport } from '../../../scripts/banco/report.js';
import config from '../../../scripts/banco/banco.config.json';

const stop = (o) => ({ place_id: o.id, title: o.id, min: null, scelta: 'modello', famiglia: o.id, verita: true,
    frasi: [{ testo: 'Si comincia da qui.', problemi: [] }], recensioni: 100, priceLevel: null, pasto: false,
    dietaCercata: null, lat: 41.9, lng: 12.5, description: 'Si comincia da qui.', ...o });
const caso = (stops, extra = {}) => ({ id: 'x', gruppo: 'a', tipo: 'itinerario', luogo: 'Roma', posizione: 'Roma',
    secs: 20, ai: { chiamate: 3, tokenIn: 1000, tokenOut: 100 }, google: { 'place/textsearch': 2 }, tours: [{ stops }], ...extra });

describe('banco — misure', () => {
    it('distanze: il primo tratto non conta, la quota e\' sui tratti misurati', () => {
        const m = misuraCaso(caso([stop({ id: 'a' }), stop({ id: 'b', min: 10 }), stop({ id: 'c', min: 30 })]), config);
        expect(m.maxMinuti).toBe(30);
        expect(m.entro20).toBe(50);
        expect(semafori(m, caso([]), config).distanze).toBe('rosso');
    });

    it('ripetizioni: tappa doppia e famiglia ripetuta per ripiego', () => {
        const m = misuraCaso(caso([stop({ id: 'a' }), stop({ id: 'a' }), stop({ id: 'b', ripiego: 'famiglia', scelta: 'ripiego' })]), config);
        expect(m.ripetizioni).toBe(2);
        expect(m.ripieghi).toBe(1);
    });

    it('voce: quota di frasi senza problemi', () => {
        const s = stop({ id: 'a', frasi: [{ testo: 'x', problemi: [] }, { testo: 'y', problemi: ['zoppa'] }] });
        expect(misuraCaso(caso([s]), config).voce).toBe(50);
    });

    it('vincoli: pasto non cercato come vegetariano, price_level oltre il tetto; sconosciuto ammesso', () => {
        const c = caso([
            stop({ id: 'r1', pasto: true, dietaCercata: false, priceLevel: 3 }),
            stop({ id: 'r2', pasto: true, dietaCercata: true, priceLevel: null }),
            stop({ id: 'museo', pasto: false, dietaCercata: false, priceLevel: 4 }),
        ], { vincoli: { dieta: ['vegetariano'], maxPriceLevel: 2 } });
        expect(violazioniVincoli(c)).toHaveLength(2);
        expect(violazioniVincoli({ ...c, vincoli: undefined })).toEqual([]);
    });

    it('famosita\': mediana e soglie; semaforo solo nelle citta\' grandi', () => {
        const stops = [100, 1500, 2500, 6000].map((n, i) => stop({ id: `s${i}`, recensioni: n }));
        const m = misuraCaso(caso(stops), config);
        expect(m.medianaRecensioni).toBe(2000);
        expect([m.sopra2000, m.sopra5000, m.sotto2000]).toEqual([2, 1, 50]);
        expect(semafori(m, caso(stops), config).famosita).toBe('verde');
        const borgo = caso(stops, { luogo: 'Scicli' });
        expect(semafori(misuraCaso(borgo, config), borgo, config).famosita).toBeNull();
    });

    it('in comune A/B: quota sul giro piu\' corto', () => {
        const a = caso([stop({ id: 'x' }), stop({ id: 'y' }), stop({ id: 'z' }), stop({ id: 'w' })]);
        const b = caso([stop({ id: 'x' }), stop({ id: 'k' })]);
        expect(inComune(a, b)).toMatchObject({ comuni: 1, pct: 50 });
    });

    it('destinazione: citta\' giusta e tappe vicine al centro atteso', () => {
        const c = caso([stop({ id: 'a' })], { attesa: { city: 'Roma', center: { lat: 41.9, lng: 12.5 } }, destinazione: { city: 'Roma' } });
        expect(misuraCaso(c, config).destinazione.ok).toBe(true);
        const lontano = caso([stop({ id: 'a', lat: 37.79, lng: 14.6 })], { attesa: c.attesa, destinazione: { city: 'Roma' } });
        expect(misuraCaso(lontano, config).destinazione.ok).toBe(false);
    });

    it('costo: token + Google + una foto per tappa', () => {
        const c = costoUsd(caso([stop({ id: 'a' })]), config.prezziUsd);
        expect(c.google).toBeCloseTo(0.064);
        expect(c.foto).toBeCloseTo(0.007);
        expect(c.totale).toBeCloseTo(0.064 + 0.007 + (1000 * 0.15 + 100 * 0.6) / 1e6);
    });

    it('caso saltato o in errore: nessuna misura, nel report come non misurato', () => {
        const saltato = { id: 'c-roma', gruppo: 'c', tipo: 'perte', luogo: 'Roma', saltato: 'fuori orario: alle 21:00' };
        expect(misuraCaso(saltato, config)).toBeNull();
        const { markdown } = buildReport({ casi: [saltato, caso([stop({ id: 'a' })])] }, config, { data: '2026-10-11', commit: 'abc' });
        expect(markdown).toContain('saltato — fuori orario');
        expect(markdown).toContain('## Tabella per luogo');
    });
});
