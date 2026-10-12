// BANCO-ESTESO — i controlli si provano senza rete: rosso sul cattivo noto, verde sul buono.
import { describe, it, expect } from 'vitest';
import { validaControlli } from '../../../scripts/banco/validazione.js';
import { CLASSI, DEFINIZIONI, eseguiControlli } from '../../../scripts/banco/controlli.js';
import { apertoAlle, giornoEMinuti } from '../../../scripts/banco/orari.js';
import { CASI_ESTESI, MODI } from '../../../scripts/banco/casi-esteso.js';
import config from '../../../scripts/banco/banco.config.json';

describe('banco esteso — validazione dei 10 controlli', () => {
    const righe = validaControlli(config);
    it('ogni classe ha una definizione scritta e una riga di validazione', () => {
        expect(righe.map(r => r.classe)).toEqual(CLASSI.map(([k]) => k));
        for (const [k] of CLASSI) expect(DEFINIZIONI[k], k).toBeTruthy();
    });
    for (const [k] of CLASSI) {
        it(`${k}: rosso sul cattivo, verde sul buono`, () => {
            const r = righe.find(x => x.classe === k);
            expect(r.cattivoRosso, `non vede: ${r.cattivo}`).toBe(true);
            expect(r.buonoVerde, `falsi allarmi: ${r.falsiAllarmi.join(' | ')}`).toBe(true);
        });
    }
});

describe('banco esteso — orari', () => {
    const SERA = [3, 4, 5, 6].map(d => ({ open: { day: d, time: '1800' }, close: { day: d === 6 ? 0 : d + 1, time: '0000' } }));
    it('mercoledì 9:30 chiuso, mercoledì 19:00 aperto, 00:30 del giovedì chiuso', () => {
        expect(apertoAlle(SERA, 3, 9 * 60 + 30)).toBe(false);
        expect(apertoAlle(SERA, 3, 19 * 60)).toBe(true);
        expect(apertoAlle(SERA, 4, 30)).toBe(false);
    });
    it('chiusura oltre la mezzanotte e sempre aperto', () => {
        const notte = [{ open: { day: 5, time: '2000' }, close: { day: 6, time: '0200' } }];
        expect(apertoAlle(notte, 6, 60)).toBe(true);
        expect(apertoAlle([{ open: { day: 0, time: '0000' } }], 2, 300)).toBe(true);
        expect(apertoAlle([], 2, 300)).toBeNull();
    });
    it('giorno e minuti sono dell\'ora di Roma', () => {
        expect(giornoEMinuti('2026-10-14T09:30:00+02:00')).toEqual({ giorno: 3, minuti: 570 });
    });
});

describe('banco esteso — la matrice', () => {
    it('ha ≈30 casi, tutte e 4 le modalità, ognuna in almeno 3 ore diverse', () => {
        expect(CASI_ESTESI.length).toBeGreaterThanOrEqual(28);
        for (const m of MODI) expect(new Set(CASI_ESTESI.filter(c => c.modo === m).map(c => c.ora)).size, m).toBeGreaterThanOrEqual(3);
    });
    it('contiene i casi obbligatori', () => {
        const ha = (f) => CASI_ESTESI.some(f);
        expect(ha(c => c.luogo === 'Catania' && /catanese/.test(c.richiesta || '') && c.onboarding?.dieta?.length)).toBe(true);
        expect(ha(c => c.luogo === 'Catania' && /catanese/.test(c.richiesta || '') && !c.onboarding)).toBe(true);
        for (const ora of ['21:25', '21:45', '23:30']) expect(ha(c => c.modo === 'veloce' && c.luogo === 'Catania' && c.ora === ora && c.scelta.main === 'relax')).toBe(true);
        expect(ha(c => c.luogo === 'Napoli' && c.ora === '19:30' && c.richiesta === 'aperitivo e cena')).toBe(true);
        expect(ha(c => c.modo === 'crea' && c.luogo === 'Roma' && c.ora === '09:30')).toBe(true);
        expect(ha(c => c.modo === 'perte' && c.luogo === 'Roma' && c.ora === '10:00')).toBe(true);
        expect(ha(c => c.modo === 'perte' && c.luogo === 'Roma' && c.ora === '16:00')).toBe(true);
        expect(ha(c => c.modo === 'sorprendimi' && c.ora < '12:00')).toBe(true);
        expect(ha(c => c.luogo === 'Firenze' && c.scelta?.main === 'storia')).toBe(true);
        expect(ha(c => c.modo === 'veloce' && c.luogo === 'Palermo' && c.ora === '14:30' && c.scelta.main === 'relax')).toBe(true);
        expect(ha(c => ['Lecce', 'Siracusa'].includes(c.luogo))).toBe(true);
        expect(ha(c => c.luogo === 'Troina')).toBe(true);
        expect(new Set(CASI_ESTESI.map(c => c.id)).size).toBe(CASI_ESTESI.length);
    });
    it('eseguiControlli salta i casi in errore', () => {
        expect(eseguiControlli({ errore: 'x' }, config)).toBeNull();
    });
});

describe('banco esteso — il report', () => {
    it('si costruisce da un grezzo e conta gli errori per classe e modalità', async () => {
        const { buildReportEsteso } = await import('../../../scripts/banco/report-esteso.js');
        const { ESEMPI } = await import('../../../scripts/banco/validazione.js');
        const caso = { ...ESEMPI.c3.cattivo.caso, id: 'veloce-x', modo: 'veloce', secs: 10, ai: { chiamate: 3, tokenIn: 1000, tokenOut: 100 },
            google: { 'place/textsearch': 4 }, chiamata: { prefs: { interests: ['a'], duration: 'Veloce' }, testo: 'x' } };
        const raw = { avvio: '2026-10-13T10:00:00Z', identita: 'account di prova', casi: [caso, { id: 'crea-y', modo: 'crea', luogo: 'Roma', ora: '09:30', errore: 'boom', tours: [] }],
            onb1: { passi: [] }, costo: { totale: 1, ai: { chiamate: 1, tokenIn: 1, tokenOut: 1 }, google: {}, tettoUsd: 7 } };
        const { markdown, analisi } = buildReportEsteso(raw, config, {});
        expect(analisi.perClasse.find(c => c.k === 'c5').violazioni).toBe(0 + 0 + 0 + 1);
        expect(analisi.perModo.find(m => m.modo === 'perte').casi).toBe(0);
        expect(markdown).toContain('non coperta');
        expect(markdown).toContain('I 10 errori più gravi');
        expect(markdown).toContain('crea-y');
    });
});

describe('MIG-PLACES — il confronto legacy / new', () => {
    const stop = (id, o = {}) => ({ place_id: id, title: id, min: 5, scelta: 'modello', famiglia: id, verita: true, frasi: [{ testo: 'Si comincia da qui.', problemi: [] }],
        recensioni: 100, pasto: false, lat: 41.9, lng: 12.5, description: 'Si comincia da qui.', moment: 'mattina', at: '2026-10-14T09:30:00+02:00', stay: 30, types: ['museum'], ...o });
    const caso = (id, orari = {}) => ({ id, modo: 'crea', tipo: 'itinerario', luogo: 'Roma', ora: '09:30', oggi: '2026-10-14', secs: 20, ai: { chiamate: 3, tokenIn: 1000, tokenOut: 100 },
        google: { 'place/textsearch': 4 }, richiesta: 'x', schermo: { giorni: [], note: [] }, orari,
        pool: { 'g1-mattina': { candidati: ['a', 'b', 'c', 'd'].map(p => ({ place_id: p, scelto: p === 'a', nelGiro: p === 'a' })) } },
        tours: [{ stops: [stop('a'), stop('b'), stop('e'), stop('f')] }] });
    const PER = [{ open: { day: 3, time: '0900' }, close: { day: 3, time: '1900' } }];
    it('copertura: legacy conosce solo i posti scelti, new quelli del pool; costo con la ricerca Enterprise', async () => {
        const { confrontoPlaces, copertura } = await import('../../../scripts/banco/confronto-places.js');
        const legacy = { casi: [caso('crea-x', { a: { chiamato: true, periods: PER } })], costo: { totale: 1, google: { 'place/details': 4 } } };
        const nuovo = { motore: 'new', casi: [{ ...caso('crea-x'), google: { 'place/textsearch#new': 4 }, candidatiVisti: 20, candidatiConOrari: 16 }],
            luoghiOrari: { a: { periods: PER }, b: { periods: PER }, c: { periods: null }, d: { periods: PER } }, costo: { totale: 0.5 } };
        const cl = copertura(legacy), cn = copertura(nuovo);
        expect([cl.poolNoti, cl.pool, cl.altNoti, cl.alt]).toEqual([1, 4, 0, 2]);
        expect([cn.poolNoti, cn.pool, cn.altNoti, cn.alt]).toEqual([3, 4, 1, 2]);
        const { markdown, peggiorate } = confrontoPlaces(legacy, nuovo, config, { legacyNome: 'l.json', nuovoNome: 'n.json' });
        expect(peggiorate).toBe(0);
        expect(markdown).toContain('16 su 20');
        // 4 ricerche × $0,035 (Enterprise) contro 4 × $0,032 (legacy) + i token
        expect(markdown).toContain('crea-x');
        expect(config.prezziUsd.google['place/textsearch#new']).toBe(0.035);
    });
});
