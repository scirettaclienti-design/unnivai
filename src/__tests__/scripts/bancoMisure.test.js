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

    // ─── C5c — voce 12: incroci e deviazioni per tappa ──────────────────────
    // Il giro di Roma del banco prima di C5 (banco-3, a-roma), coordinate del grezzo.
    const ROMA_PRE_C5 = [
        ['Piazza del Quirinale', 41.8992412, 12.4864047, 'mattina'],
        ['Palazzo Massimo alle Colonne', 41.8967291, 12.4735541, 'mattina'],
        ['Antica Osteria di Roma', 41.8978439, 12.4685391, 'pranzo'],
        ['Museo Centrale del Risorgimento', 41.894008, 12.4838094, 'pomeriggio'],
        ['Basilica dei Santi XII Apostoli', 41.8982697, 12.4829881, 'pomeriggio'],
        ['Belvedere Cederna', 41.8920952, 12.489715, 'aperitivo'],
        ['Antica Trattoria Al Gallinaccio', 41.9022934, 12.485695, 'cena'],
    ].map(([id, lat, lng, moment]) => stop({ id, lat, lng, moment }));

    it('C5c voce 12: il giro a zig-zag di Roma prima di C5 e\' rosso, e la tappa colpevole e\' nominata', () => {
        const m = misuraCaso(caso(ROMA_PRE_C5), config);
        expect(m.percorso.deviazioniOltre).toBeGreaterThan(config.soglie.deviazioniOltreMax);
        expect(m.percorso.deviazioneMax).toBeGreaterThan(config.soglie.deviazioneMaxMinuti);
        expect(m.percorso.giornate[0].colpevole).toMatchObject({ titolo: 'Belvedere Cederna', momento: 'aperitivo' });
        expect(semafori(m, caso(ROMA_PRE_C5), config).percorso).toBe('rosso');
    });

    it('C5c voce 12: un giro lineare e\' verde, anche se lungo', () => {
        const linea = ['mattina', 'mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'cena'].map((moment, i) => stop({ id: `l${i}`, lat: 41.9 + i * 0.006, lng: 12.48, moment }));
        const m = misuraCaso(caso(linea), config);
        expect(m.percorso).toMatchObject({ incroci: 0, deviazioniOltre: 0, deviazioneMax: 0, ok: true });
        expect(semafori(m, caso(linea), config).percorso).toBe('verde');
    });

    it('C5c voce 12: la deviazione si conta anche a cavallo fra due momenti (pranzo fuori linea fra mattina e pomeriggio)', () => {
        const g = [stop({ id: 'm', lat: 41.900, lng: 12.48, moment: 'mattina' }), stop({ id: 'pr', lat: 41.900, lng: 12.4905, moment: 'pranzo' }),
            stop({ id: 'po', lat: 41.902, lng: 12.48, moment: 'pomeriggio' })];
        const m = misuraCaso(caso(g), config);
        const [d] = m.percorso.giornate[0].deviazioni;
        expect(d).toMatchObject({ titolo: 'pr', momento: 'pranzo' });
        expect(d.minuti).toBeGreaterThan(config.soglie.deviazioneMaxMinuti);
        expect(m.percorso.ok).toBe(false);
    });

    it('C5c voce 12: nessuna esenzione per i giri corti, ma i passi da 100 m non contano', () => {
        // giro di ~0,7 km con zig-zag da 100 m: verde
        const corto = [0, 1, 2, 3, 4].map(i => stop({ id: `c${i}`, lat: 37.502 + i * 0.0015, lng: 15.087 + (i % 2) * 0.0008, moment: 'pomeriggio' }));
        const mc = misuraCaso(caso(corto), config);
        expect(mc.percorso.km).toBeLessThan(2);
        expect(mc.percorso.ok).toBe(true);
        // stesso giro corto con un'andata e ritorno di 600 m: rosso
        const fuori = [...corto.slice(0, 2), stop({ id: 'fuori', lat: 37.5035, lng: 15.094, moment: 'pomeriggio' }), ...corto.slice(2)];
        const mf = misuraCaso(caso(fuori), config);
        expect(mf.percorso.km).toBeLessThan(2);
        expect(mf.percorso.deviazioneMax).toBeGreaterThan(config.soglie.deviazioneMaxMinuti);
        expect(semafori(mf, caso(fuori), config).percorso).toBe('rosso');
    });

    it('C5c voce 12: un incrocio basta per il rosso; il report ha la tabella con la tappa colpevole', () => {
        const zig = [stop({ id: 'a', lat: 0, lng: 0 }), stop({ id: 'c', lat: 0.01, lng: 0.01 }), stop({ id: 'b', lat: 0, lng: 0.01 }), stop({ id: 'd', lat: 0.01, lng: 0 })];
        expect(misuraCaso(caso(zig), config).percorso.incroci).toBe(1);
        expect(semafori(misuraCaso(caso(zig), config), caso(zig), config).percorso).toBe('rosso');
        expect(misuraCaso(caso(zig, { tipo: 'perte' }), config).percorso).toBe(null);
        const { markdown } = buildReport({ casi: [caso(ROMA_PRE_C5)] }, config, {});
        expect(markdown).toMatch(/\| Incroci \| Deviazioni > 5 min \| Deviazione max \| Indice vecchio \|/);
        expect(markdown).toContain('(Belvedere Cederna @aperitivo)');
        expect(markdown).toMatch(/\*\*a-roma|x — Percorso/);
    });

    it('C5b ripetizioni: si contano le famiglie del giro finale, anche senza la dicitura "ripiego"', () => {
        const g = [stop({ id: 'p1', famiglia: 'piazza' }), stop({ id: 'p2', famiglia: 'piazza' }), stop({ id: 'p3', famiglia: 'piazza', ripiego: 'famiglia', scelta: 'ripiego' })];
        const m = misuraCaso(caso(g), config);
        expect(m.ripetizioni).toBe(2);
        expect(m.ripetizioniDaTracce).toBe(1);
    });

    it('caso saltato o in errore: nessuna misura, nel report come non misurato', () => {
        const saltato = { id: 'c-roma', gruppo: 'c', tipo: 'perte', luogo: 'Roma', saltato: 'fuori orario: alle 21:00' };
        expect(misuraCaso(saltato, config)).toBeNull();
        const { markdown } = buildReport({ casi: [saltato, caso([stop({ id: 'a' })])] }, config, { data: '2026-10-11', commit: 'abc' });
        expect(markdown).toContain('saltato — fuori orario');
        expect(markdown).toContain('## Tabella per luogo');
    });
});
