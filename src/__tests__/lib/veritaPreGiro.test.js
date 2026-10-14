import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stopData, apertura, composeStop, maschera, FRASI_LUOGO } from '../../lib/stopPhrases';
import { c13, giroSerale } from '../../../scripts/banco/controlli.js';
import { ESEMPI, validaControlli } from '../../../scripts/banco/validazione.js';

const cfg = JSON.parse(readFileSync(path.resolve(__dirname, '../../../scripts/banco/banco.config.json'), 'utf8'));

// ─── VERITÀ 3 — c13: la cena è dovuta solo nei giri serali che partono prima delle 22:00 ─────────────────────────
describe('VERITÀ 3 — c13(e): la cena dovuta solo prima delle 22:00', () => {
    const senzaCena = (ora) => ({ ...ESEMPI.c13.cattivo4.caso, ora });
    it('rosso: il giro delle 20:00 senza cena né riga dichiarata', () => {
        expect(c13(ESEMPI.c13.cattivo4.caso, cfg).violazioni.map(v => v.testo).join(' ')).toMatch(/nessuna cena/);
    });
    it('verde: il Veloce Catania delle 22:20 (drink + passeggiata, giro TESTI)', () => {
        expect(c13(ESEMPI.c13.buono6.caso, cfg).violazioni).toEqual([]);
    });
    it('il confine: 21:59 la cena è dovuta, 22:00 no', () => {
        expect(c13(senzaCena('21:59'), cfg).violazioni.length).toBeGreaterThan(0);
        expect(c13(senzaCena('22:00'), cfg).violazioni).toEqual([]);
    });
    it('le altre parti di c13 non cambiano: il drink di 20 minuti alle 22:20 resta rosso', () => {
        const corto = { ...ESEMPI.c13.buono6.caso, tours: [{ stops: ESEMPI.c13.buono6.caso.tours[0].stops.map((s, i) => (i === 0 ? { ...s, stay: 20 } : s)) }] };
        expect(c13(corto, cfg).violazioni.map(v => v.testo).join(' ')).toMatch(/il drink dura 20 min/);
    });
    it('`giroSerale` (usata anche dalla voce «Giornata») resta com\'era: alle 22:20 il giro è ancora serale', () => {
        const vere = ESEMPI.c13.buono6.caso.tours[0].stops;
        expect(giroSerale(ESEMPI.c13.buono6.caso, vere)).toBe(true);
    });
    it('la validazione del banco: c13 rosso su tutti i cattivi, verde su tutti i buoni', () => {
        const r = validaControlli(cfg).find(x => x.classe === 'c13');
        expect(r.cattivoRosso).toBe(true);
        expect(r.falsiAllarmi).toEqual([]);
        expect(r.buonoVerde).toBe(true);
    });
});

// ─── VERITÀ 4 — Per Te: il museo prende la famiglia dal tipo principale ─────────────────────────────────────────
// Su b9f4e83 era gia' cosi' (vedi report): questi test fissano il comportamento, non lo cambiano.
describe('VERITÀ 4 — Per Te: il museo ha la sua famiglia', () => {
    const museo = { place_id: 'ChIJ3TLmAi_jExMRkP_79B8grl8', title: 'Museo Diocesano di Catania', types: ['art_museum', 'museum', 'point_of_interest', 'establishment'], primaryType: 'art_museum', stayMinutes: 60 };
    const perTe = (stop) => stopData({ stop, momento: null, minutiDaPrima: 4, giornata: false });
    it('dal tipo principale, anche con un nome che non dice «museo» e senza `museum` fra i types', () => {
        expect(perTe(museo).famiglia).toBe('museo');
        expect(perTe({ ...museo, title: 'Collezione Diocesana', types: ['point_of_interest'] }).famiglia).toBe('museo');
    });
    it('la frase è quella del museo, non la riserva', () => {
        expect(apertura(perTe(museo))).toBe('Museo Diocesano di Catania è la tappa da fare con calma.');
    });
});

// ─── VERITÀ 5 — frasi prestate: mai «Attraversi…» a una chiesa, mai un verbo che col luogo non sta ──────────────────
describe('VERITÀ 5 — frasi prestate', () => {
    // la frase della propria famiglia gia' detta nel tour: si passa alle frasi prestate
    const giaDette = (d) => new Set([...(FRASI_LUOGO[d.famiglia] || [])].map(t => maschera(t.replace('{nome}', d.nome).replace('{durata}', d.durata || ''), d.nome)));
    const tutte = (stop, extra = {}) => {
        const d = stopData({ stop, momento: 'pomeriggio', minutiDaPrima: 3, ...extra });
        return { d, frase: apertura(d, { evita: giaDette(d) }) };
    };
    it('una chiesa che il codice riconosce solo come monumento (Badia, tipo principale da monumento): mai «Attraversi…»', () => {
        const { d, frase } = tutte({ place_id: 'badia', title: "Badia di Sant'Agata", types: ['tourist_attraction', 'point_of_interest'], primaryType: 'tourist_attraction' });
        expect(d.famiglia).toBe('monumento');
        expect(frase).not.toMatch(/^Attraversi\b/);
        expect(frase).toBe("Passi da Badia di Sant'Agata: guardati intorno prima di ripartire.");
    });
    it('una chiesa vera non prende mai «Attraversi…», nemmeno finite le sue frasi', () => {
        const { frase } = tutte({ place_id: 'cattedrale', title: "Basilica Cattedrale di Sant'Agata", types: ['church', 'place_of_worship'], primaryType: 'church', stayMinutes: 20 });
        expect(frase).not.toMatch(/^Attraversi\b/);
    });
    it('un palazzo o una statua non si attraversano', () => {
        for (const stop of [
            { place_id: 'elefanti', title: 'Palazzo degli Elefanti', types: ['government_office'], primaryType: 'government_office' },
            { place_id: 'genio', title: 'Statua del Genio di Palermo', types: ['historical_landmark'], primaryType: 'historical_landmark' },
        ]) expect(tutte(stop).frase).not.toMatch(/^Attraversi\b/);
    });
    it('a una piazza o a una passeggiata non ci si ferma «davanti»', () => {
        for (const stop of [
            { place_id: 'mazzini', title: 'Piazza Giuseppe Mazzini', types: ['historical_landmark'], primaryType: 'historical_landmark' },
            { place_id: 'gianicolo', title: 'Passeggiata del Gianicolo', types: ['tourist_attraction'], primaryType: 'tourist_attraction' },
        ]) expect(tutte(stop).frase).not.toMatch(/^Ti fermi davanti\b/);
    });
    it('un luogo qualunque (un mercato) non prende «Attraversi…» né «Ti fermi davanti…»: resta «Passi da…»', () => {
        const { d, frase } = tutte({ place_id: 'capo', title: 'Mercato del Capo', types: ['market'], primaryType: 'market' });
        expect(d.famiglia).toBe('altro');
        const altre = new Set([...giaDette(d), maschera(apertura(d), d.nome)]);
        const seconda = apertura(d, { evita: altre });
        for (const f of [frase, seconda]) expect(f).not.toMatch(/^(Attraversi|Ti fermi davanti)\b/);
    });
    it('i prestiti che stanno in piedi restano: una porta si attraversa, davanti a un monumento ci si ferma', () => {
        const porta = tutte({ place_id: 'uzeda', title: 'Porta Uzeda', types: ['landmark'], primaryType: 'landmark' });
        expect(porta.d.famiglia).toBe('porta');
        expect(['Ti fermi davanti a Porta Uzeda il tempo che serve.', 'Attraversi Porta Uzeda piano, senza fretta.']).toContain(porta.frase);
        const chiesa = tutte({ place_id: 'sannicolo', title: 'Chiesa di San Nicolò', types: ['church'], primaryType: 'church', stayMinutes: 20 });
        expect(chiesa.frase).toBe('Ti fermi davanti a Chiesa di San Nicolò il tempo che serve.');
    });
    it('nessuna frase nuova: ogni apertura composta è una frase approvata', () => {
        const approvate = Object.values(FRASI_LUOGO).flat().map(t => new RegExp('^' + t.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, '.+') + '$'));
        const d = stopData({ stop: { place_id: 'x', title: 'Palazzo degli Elefanti', types: ['government_office'] }, momento: 'pomeriggio', minutiDaPrima: 3 });
        const { text } = composeStop(d, {}, [], { evita: giaDette(d) });
        expect(approvate.some(re => re.test(text.split(/(?<=[.!?])\s+/)[0]))).toBe(true);
    });
});
