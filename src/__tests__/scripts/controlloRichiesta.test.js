// BANCO-DIFETTI-2 (T23) — il sesto controllo del banco: la richiesta precisa è nel giro, o una nota dice perché no.
import { describe, it, expect } from 'vitest';
import { richiesta, richiesteDelCaso, nomiChiesti, eFermata } from '../../../scripts/banco/controlloRichiesta.js';
import { CONTROLLI40, controllaCaso } from '../../../scripts/banco/controlli40.js';
import { CASI_BANCO40 } from '../../../scripts/banco/casi-banco40.js';

const s = (title, extra = {}) => ({ place_id: `p-${title}`, title, lat: 41.89, lng: 12.49, at: '2026-11-05T13:30:00.000Z', stay: 30, moment: 'pomeriggio', types: [], ...extra });
const crea = (richiestaTesto, stops, note = [], extra = {}) => ({ id: 'x', modo: 'crea', luogo: 'Roma', richiesta: richiestaTesto, tours: [{ tema: 't', stops }], schermo: { note }, ...extra });
const meta = { attesa: 'Roma', modo: 'crea' };

describe('sesto controllo — la richiesta precisa', () => {
    it('è il sesto controllo del banco e i cinque di prima restano', () => {
        expect(CONTROLLI40.map(([k]) => k)).toEqual(['aperte', 'distanze', 'citta', 'titolo', 'frasi', 'richiesta']);
    });

    it('legge i luoghi per nome dalla frase, senza la città, i giorni e le parole comuni in testa', () => {
        expect(nomiChiesti('Un pomeriggio tra Colosseo e Fori Imperiali a Roma', 'Roma')).toEqual(['Colosseo', 'Fori Imperiali']);
        expect(nomiChiesti('Pranzo e giro ai mercati di Ballarò e del Capo a Palermo', 'Palermo')).toEqual(['Ballarò', 'Capo']);
        expect(nomiChiesti('Domani, una giornata a Polignano a Mare', 'Polignano a Mare')).toEqual([]);
        expect(nomiChiesti('Domani, una giornata in Ortigia, a Siracusa', 'Siracusa')).toEqual(['Ortigia']);
    });

    it('un luogo chiesto per nome: la fermata dei mezzi col suo nome non basta (D8)', () => {
        const fermata = s('Colosseo', { types: ['subway_station', 'transit_station'], primaryType: 'subway_station' });
        expect(eFermata(fermata)).toBe(true);
        const ko = richiesta(crea('Un pomeriggio al Colosseo a Roma', [fermata, s('Via dei Fori Imperiali')]), meta);
        expect(ko.ok).toBe(false);
        expect(ko.violazioni[0]).toMatch(/Colosseo.*fermata/);
        const ok = richiesta(crea('Un pomeriggio al Colosseo a Roma', [s('Colosseo', { types: ['historical_landmark'] })]), meta);
        expect(ok).toMatchObject({ ok: true, voci: 1, nelGiro: 1 });
    });

    it('«Vaticano» lo è anche «Musei Vaticani» (stessa radice)', () => {
        expect(richiesta(crea('Una giornata a Roma tra Vaticano e centro storico', [s('Musei Vaticani', { types: ['museum'] })]), meta).ok).toBe(true);
    });

    it('quello che manca passa solo se una nota lo nomina con il motivo', () => {
        const giro = [s('Bar Popolare', { types: ['bar'] })];
        const veloce = { id: 'v', modo: 'veloce', luogo: 'Catania', richiesta: 'A Catania cerco: spa, hammam, terme, centri benessere. Escludi: cattedrali, musei.', tours: [{ tema: 't', stops: giro }] };
        const m = { attesa: 'Catania', modo: 'veloce' };
        expect(richiesteDelCaso(veloce, m).map(v => v.cosa)).toEqual(['spa']);
        expect(richiesta({ ...veloce, schermo: { note: [] } }, m).ok).toBe(false);
        expect(richiesta({ ...veloce, schermo: { note: ['Spa e centri benessere: a Catania quelli trovati sono chiusi nelle ore del giro.'] } }, m)).toMatchObject({ ok: true, dichiarate: 1 });
        // una nota che nomina la cosa senza un motivo non vale
        expect(richiesta({ ...veloce, schermo: { note: ['Spa e centri benessere.'] } }, m).ok).toBe(false);
    });

    it('il tema per tutto il giro: ogni visita di mattina e pomeriggio, o la nota che dice quante non lo sono', () => {
        const giro = [s('Teatro Massimo', { moment: 'mattina', types: ['performing_arts_theater'] }), s('Villa Giulia', { types: ['park'] }), s('Trattoria', { moment: 'pranzo', pasto: true })];
        const ko = richiesta(crea('Natura e panorami a Palermo', giro), { attesa: 'Palermo', modo: 'crea' });
        expect(ko.violazioni.join(' ')).toMatch(/natura.*Teatro Massimo/);
        const dich = richiesta(crea('Natura e panorami a Palermo', giro, ['1 tappa su 2 non è di natura: entro 1,2 km non ho trovato altri parchi aperti.', 'Panorami: il posto più vicino è a 6,4 km dalle tappe del giro, oltre 1,2 km a piedi.']), { attesa: 'Palermo', modo: 'crea' });
        expect(dich.ok).toBe(true);
    });

    it('un\'esclusione non ha scuse; il pasto chiesto c\'è o c\'è la riga del pasto mancante', () => {
        expect(richiesta(crea('Una giornata a Roma, niente chiese', [s('San Luigi', { types: ['church'] })]), meta).ok).toBe(false);
        expect(richiesta(crea('Pranzo a Roma', [s('Osteria', { moment: 'pranzo', pasto: true })]), meta).ok).toBe(true);
        expect(richiesta(crea('Pranzo a Roma', [s('Pantheon')]), meta).ok).toBe(false);
    });

    it('Sorprendimi e una richiesta generica non chiedono niente: il controllo passa da sé', () => {
        expect(richiesta({ id: 's', modo: 'sorprendimi', luogo: 'Firenze', richiesta: 'Sei l\'intelligenza di Unnivai. Genera…', tours: [{ stops: [s('Duomo')] }] }, { attesa: 'Firenze' })).toMatchObject({ ok: true, voci: 0 });
        expect(richiesta(crea('Domani, una giornata a Roma', [s('Pantheon')]), meta)).toMatchObject({ ok: true, voci: 0 });
    });

    it('entra nell\'esito del caso: un caso che non rispetta la richiesta non passa', () => {
        const m = CASI_BANCO40.find(c => c.id === 'n-roma-1300-specifica');
        const cfg = { soglie: { kmTraTappePiedi: 1.2, minutiCammino: 16 }, esteso: { camminoKmh: 4.5 } };
        const fermata = { ...s('Colosseo', { types: ['subway_station'], primaryType: 'subway_station' }), lat: 41.8915, lng: 12.4915 };
        const e = controllaCaso({ ...crea(m.richiesta, [fermata]), tours: [{ tema: 'Dal Colosseo', stops: [fermata] }] }, m, cfg);
        expect(e.controlli.richiesta.ok).toBe(false);
        expect(e.stato).toBe('ko');
    });
});
