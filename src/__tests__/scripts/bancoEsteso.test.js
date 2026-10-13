// BANCO-ESTESO — i controlli si provano senza rete: rosso sul cattivo noto, verde sul buono.
import { describe, it, expect } from 'vitest';
import { validaControlli } from '../../../scripts/banco/validazione.js';
import { CLASSI, DEFINIZIONI, eseguiControlli, c1, c4, c11, minimoPerFinestra } from '../../../scripts/banco/controlli.js';
import { apertoAlle, giornoEMinuti } from '../../../scripts/banco/orari.js';
import { CASI_ESTESI, MODI } from '../../../scripts/banco/casi-esteso.js';
import config from '../../../scripts/banco/banco.config.json';

describe('banco esteso — validazione degli 11 controlli', () => {
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

describe('ORARI — il report del giro con la regola', () => {
    it('c5 prima/dopo e le righe dichiarate si leggono dai due grezzi', async () => {
        const { reportOrari } = await import('../../../scripts/banco/report-orari.js');
        const PERIODI_SERA = [3].map(d => ({ open: { day: d, time: '1800' }, close: { day: d, time: '2300' } }));
        const S = (id, o = {}) => ({ place_id: id, title: id, types: ['museum'], moment: 'mattina', at: '2026-10-14T09:30:00+02:00', stay: 60, min: 5, scelta: 'modello', verita: true,
            frasi: [{ testo: 'Si comincia da qui.', problemi: [] }], recensioni: 100, pasto: false, lat: 41.9, lng: 12.5, description: 'Si comincia da qui.', ...o });
        const caso = (stops, o = {}) => ({ id: 'crea-x', modo: 'crea', tipo: 'itinerario', luogo: 'Roma', ora: '09:30', oggi: '2026-10-14', secs: 10,
            ai: { chiamate: 3, tokenIn: 1000, tokenOut: 100 }, google: { 'place/textsearch#new': 3 }, richiesta: 'x', schermo: { giorni: [], note: [] }, tours: [{ stops }], ...o });
        const base = { motore: 'new', casi: [caso([S('a'), S('b')], { orari: { a: { chiamato: true, periods: PERIODI_SERA }, b: { chiamato: true, periods: null } } })], costo: { totale: 0.5 } };
        const nuovo = { motore: 'new', casi: [caso([S('c', { orario: 'noto' }), S('d', { orario: 'sconosciuto' }), { tempoLibero: true, title: 'Tempo libero', moment: 'pomeriggio', description: 'x' }],
            { orari: { c: { chiamato: true, periods: [3].map(d => ({ open: { day: d, time: '0800' }, close: { day: d, time: '1800' } })) }, d: { chiamato: true, periods: null } },
                orariMotore: { chiusi: [{ momento: 'g1-mattina', place_id: 'a' }], vietati: [], giri: 1, ignoti: 1, righeDichiarate: [{ momento: 'g1-pomeriggio', pasto: false }] } })], costo: { totale: 0.6 } };
        const { markdown, sintesi } = reportOrari(base, nuovo, config, { baseNome: 'b.json', nuovoNome: 'n.json' });
        expect(sintesi.c5).toMatchObject({ prima: 1, dopo: 0, casiPrima: 1, casiDopo: 0 });
        expect(markdown).toContain('**Prima 1 violazioni in 1 casi → dopo 0 violazioni in 0 casi.**');
        expect(markdown).toContain('sconosciuto');
    });
});

describe('banco esteso — c5 con gli orari del giorno (ORARI-FESTIVI)', () => {
    // sabato 17/10/2026 12:00 a Roma; il posto e' aperto ogni giorno 10-20 secondo la settimana
    const SETT = [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: '1000' }, close: { day: d, time: '2000' } }));
    const finestra = (sabato) => ({
        from: '2026-10-13', to: '2026-10-19',
        periods: [13, 14, 15, 16, 17, 18, 19].flatMap(d => {
            const date = `2026-10-${d}`;
            if (d !== 17) return [{ date, open: '1000', close: '2000' }];
            return sabato.map(([open, close]) => ({ date, open, close }));
        }),
    });
    const caso = (orari, stay = 60) => ({
        id: 'x', modo: 'crea', tipo: 'itinerario', luogo: 'Roma', ora: '12:00', oggi: '2026-10-17', tourDate: '2026-10-17', richiesta: '',
        schermo: { giorni: [], note: [] }, ripiegoDichiarato: false,
        orari: { p1: { chiamato: true, periods: SETT, ...orari } },
        tours: [{ stops: [{ place_id: 'p1', title: 'Museo', types: ['museum'], moment: 'mattina', at: '2026-10-17T12:00:00+02:00', stay }] }],
    });
    const c5 = (c) => eseguiControlli(c, config).c5;
    it('chiuso per un giorno speciale (la settimana lo darebbe aperto): violazione, e la sola settimana non la vedrebbe', () => {
        const r = c5(caso({ current: finestra([]) }));
        expect(r.violazioni).toHaveLength(1);
        expect(r.violazioni[0].testo).toMatch(/17\/10 chiuso \(orario del giorno\)/);
        expect(r.daOrarioDelGiorno).toBe(1);
        expect(r.verdettoDiversoDallaSettimana).toBe(1);
        expect(c5(caso({})).violazioni).toHaveLength(0);            // senza orari del giorno: come ORARI
    });
    it('orario ridotto: la sosta ci sta -> verde; non ci sta -> violazione oltre la chiusura', () => {
        expect(c5(caso({ current: finestra([['1000', '1300']]) }, 60)).violazioni).toHaveLength(0);
        const r = c5(caso({ current: finestra([['1000', '1230']]) }, 60));
        expect(r.violazioni).toHaveLength(1);
        expect(r.oltreChiusura).toBe(1);
    });
    it('data fuori dalla finestra: vale la settimana', () => {
        const c = caso({ current: finestra([]) });
        c.tours[0].stops[0].at = '2026-10-24T12:00:00+02:00';
        const r = c5(c);
        expect(r.violazioni).toHaveLength(0);
        expect(r.daOrarioDellaSettimana).toBe(1);
    });
});

describe('banco esteso — c11, buchi non dichiarati e tappe senza orario (CONTINUITA\')', () => {
    const G = '2026-10-14';
    const at = (hhmm) => `${G}T${hhmm}:00+02:00`;
    // due posti vicinissimi (cammino ~0) salvo diversa indicazione
    const st = (title, hhmm, stay, o = {}) => ({ title, place_id: `id-${title}`, at: hhmm ? at(hhmm) : null, stay, lat: 37.5, lng: 15.08, ...o });
    const caso = (stops, o = {}) => ({ id: 'x', tipo: 'itinerario', tours: [{ stops }], ...o });
    const libero = (hhmm, stay) => ({ title: 'Tempo libero', place_id: null, tempoLibero: true, at: at(hhmm), stay, lat: null, lng: null });

    it('il caso di Ivano (Catania, martedi\' 13:48, Crea senza testo) e\' nella matrice', () => {
        const c = CASI_ESTESI.find(x => x.id === 'crea-catania-1348');
        expect(c).toMatchObject({ modo: 'crea', luogo: 'Catania', ora: '13:48', richiesta: '' });
    });
    it('Per Te non si applica: l\'arrivo e\' stimato, non c\'e\' un orario vero', () => {
        expect(c11({ tipo: 'perte', tours: [{ stops: [st('a', '10:00', 30), st('b', '15:00', 30)] }] }, config).applicabile).toBe(false);
    });
    it('2 ore vuote fra due tappe: una violazione che dice quanto; con la riga di tempo libero e la sua fascia: verde', () => {
        const rosso = c11(caso([st('a', '15:03', 20), st('b', '18:00', 20)]), config);
        expect(rosso.violazioni).toHaveLength(1);
        expect(rosso.violazioni[0].testo).toMatch(/^157 min senza tappa né riga prima di b/);
        const verde = c11(caso([st('a', '15:03', 20), libero('15:23', 157), st('b', '18:00', 20)]), config);
        expect(verde.violazioni).toEqual([]);
        expect(verde.righeTempoLibero).toBe(1);
    });
    it('un tempo libero senza fascia (sosta 0) non copre niente', () => {
        expect(c11(caso([st('a', '15:03', 20), libero('15:23', 0), st('b', '18:00', 20)]), config).violazioni.length).toBeGreaterThan(0);
    });
    it('45 minuti non sono un buco, 46 si; il cammino fra le due tappe si toglie', () => {
        expect(c11(caso([st('a', '10:00', 30), st('b', '11:15', 20)]), config).violazioni).toEqual([]);
        expect(c11(caso([st('a', '10:00', 30), st('b', '11:16', 20)]), config).violazioni).toHaveLength(1);
        // 0.0225 gradi di latitudine ~2.5 km ~33 min a 4.5 km/h: dalle 10:30, 90 min di vuoto - 33 di cammino = 57 > 45; 60 - 33 = 27 ok
        const lontana = (hhmm) => st('b', hhmm, 20, { lat: 37.5225 });
        expect(c11(caso([st('a', '10:00', 30), lontana('12:00')]), config).violazioni).toHaveLength(1);
        expect(c11(caso([st('a', '10:00', 30), lontana('11:30')]), config).violazioni).toEqual([]);
    });
    it('l\'attesa prima della prima tappa del giorno non e\' un buco', () => {
        expect(c11(caso([st('a', '12:30', 75)]), config).violazioni).toEqual([]);
    });
    it('una tappa vera senza orario e\' una violazione; il tempo libero senza orario no', () => {
        const r = c11(caso([libero('09:30', 0), st('a', null, 60), st('b', null, 60)]), config);
        expect(r.senzaOrario).toBe(2);
        expect(r.violazioni).toHaveLength(2);
        expect(c11(caso([st('a', '10:00', 30), { ...libero('10:30', 0), at: null }]), config).violazioni).toEqual([]);
    });
});

describe('banco esteso — C8b: minimi per durata e Per Te dentro c1', () => {
    it('il minimo dalla finestra: 6 ore o piu\' → 4, da 3 a 6 ore → 3, meno di 3 ore → 2 (mai 1)', () => {
        expect([60, 120, 179, 180, 240, 359, 360, 780].map(m => minimoPerFinestra(m, config))).toEqual([2, 2, 2, 3, 3, 3, 4, 4]);
        expect(minimoPerFinestra(null, config)).toBe(2);
    });
    const st = (title, o = {}) => ({ title, place_id: title, types: [], stay: 30, ...o });
    it('c4: la riga di tempo libero dichiara, ma non conta come tappa; senza finestra vale il vecchio minimo fisso', () => {
        const base = { tipo: 'itinerario', ripiegoDichiarato: false, tours: [{ stops: [st('a', { at: '2026-10-14T14:30:00+02:00' }), st('b', { at: '2026-10-14T15:30:00+02:00' })] }] };
        expect(c4({ ...base, finestraMinuti: [240] }, config).violazioni).toHaveLength(1);
        const dichiarato = { ...base, finestraMinuti: [240], tours: [{ stops: [...base.tours[0].stops, st('Tempo libero', { tempoLibero: true })] }] };
        expect(c4(dichiarato, config).violazioni).toHaveLength(0);
        expect(c4({ ...base }, config).violazioni).toHaveLength(1);   // senza finestra: minimo fisso 4
        expect(c4({ ...base, finestraMinuti: [120] }, config).violazioni).toHaveLength(0);
    });
    it('c1 guarda anche Per Te: un\'osteria alle 10:00 e\' rossa', () => {
        const r = c1({ tipo: 'perte', richiesta: null, tours: [{ stops: [st('Osteria X', { primaryType: 'italian_restaurant', types: ['restaurant'], pasto: true, at: '2026-10-14T10:00:00+02:00' })] }] }, config);
        expect(r.applicabile).toBe(true);
        expect(r.violazioni).toHaveLength(1);
    });
});
