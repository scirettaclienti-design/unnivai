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
