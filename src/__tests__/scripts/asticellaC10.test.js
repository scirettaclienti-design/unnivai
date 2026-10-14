// C10 — le voci nuove dell'asticella, validate: ROSSE sul giro registrato di Ivano (14/10, «Domani un giorno da catanese»,
// docs/prove/dati/2026-10-15-c9-catania-ivano.json), verdi su un giro buono costruito.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { conosceCitta, giornataPiena, suMisura, invenzioni, costoETempo, ESSENZIALI_CONTROLLO } from '../../../scripts/banco/asticella-c10.js';

const radice = path.resolve(__dirname, '../../..');
const leggi = (f) => JSON.parse(readFileSync(path.join(radice, f), 'utf8'));

/** Il giro registrato di C9 nella forma dei grezzi del banco. */
const dalGiroC9 = (out) => {
    const r = out.risultato;
    const fin = (r.tourWindow?.windows || []).map(w => (Date.parse(w.end) - Date.parse(w.start)) / 60000);
    return {
        id: 'ivano-14-10', luogo: 'Catania', tipo: 'itinerario', finestraMinuti: fin, chiamata: { prefs: out.chiamata.prefs }, secs: out.secs, citta: null,
        pool: r.momentReport?.pool || {},
        tours: r.giorni.map(g => ({ stops: g.stops.map(s => ({ ...s, stay: s.stay, pasto: /restaurant/.test(String(s.primaryType || '')) })) })),
    };
};
const IVANO = dalGiroC9(leggi('docs/prove/dati/2026-10-15-c9-catania-ivano.json'));

const at = (h) => `2026-10-15T${h}:00+02:00`;
const st = (title, moment, extra = {}) => ({ place_id: `p-${title}`, title, moment, at: at('10:00'), stay: 30, ...extra });
const BUONO = {
    id: 'buono', luogo: 'Catania', tipo: 'itinerario', finestraMinuti: [780], secs: 24,
    citta: { cached: true, verificati: ['Cattedrale di Sant\'Agata', 'Pescheria di Catania', 'Villa Bellini', 'Fera O\'Luni', 'Palazzo Biscari'].map(t => ({ place_id: `p-${t}` })) },
    tours: [{ stops: [
        st("Cattedrale di Sant'Agata", 'mattina'), st('Pescheria di Catania', 'mattina'), st("Fera O'Luni", 'mattina'),
        st('Trattoria Sorano', 'pranzo', { pasto: true }), st('Villa Bellini', 'pomeriggio'), st('Palazzo Biscari', 'pomeriggio'),
        st('Tempo libero', 'pomeriggio', { tempoLibero: true, stay: 30, place_id: null }), st('Bar Popolare', 'aperitivo'), st('Trattoria U Fucularu', 'cena', { pasto: true }),
    ] }],
};

describe('C10 — le voci nuove sul giro di Ivano del 14/10: rosse', () => {
    it('Conosce la città: nessun essenziale della lista nel tour → rosso', () => {
        const v = conosceCitta(IVANO);
        expect(v.applicabile).toBe(true);
        expect(v.essenziali).toEqual([]);
        expect(v.ok).toBe(false);
    });
    it('Giornata piena: 264 minuti di tempo libero → rosso', () => {
        const v = giornataPiena(IVANO);
        expect(v.minuti).toBe(264);
        expect(v.ok).toBe(false);
    });
    it('Su misura: due giri della stessa città con le stesse tappe → rosso (il giro di Ivano e il suo replay)', () => {
        const replay = dalGiroC9(leggi('docs/prove/dati/2026-10-15-c9-catania-ivano.json'));
        expect(suMisura(IVANO, replay).ok).toBe(false);
    });
    it('Invenzioni e costo: il giro di Ivano non ha una lista (voce non applicabile); il costo era sotto i 0,20 $', () => {
        expect(invenzioni(null).applicabile).toBe(false);
        expect(costoETempo(IVANO, 0.147, 21.2).okCosto).toBe(true);
    });
});

describe('C10 — le voci nuove su un giro buono: verdi', () => {
    it('Conosce la città', () => expect(conosceCitta(BUONO).ok).toBe(true));
    it('Giornata piena', () => expect(giornataPiena(BUONO).ok).toBe(true));
    it('Su misura', () => {
        const altro = { ...BUONO, tours: [{ stops: [st("Cattedrale di Sant'Agata", 'mattina'), st('Monastero dei Benedettini', 'mattina'), st('Museo Civico', 'pomeriggio'), st('Ristorante Vegetariano', 'pranzo', { pasto: true })] }] };
        expect(suMisura(BUONO, altro).ok).toBe(true);
    });
    it('Invenzioni: 2 su 15 non verificati → sotto il 20%; 4 su 15 → sopra', () => {
        expect(invenzioni({ proposti: 15, verificati: 13, scartati: 2 }).ok).toBe(true);
        expect(invenzioni({ proposti: 15, verificati: 11, scartati: 4 }).ok).toBe(false);
    });
    it('Costo: il primo tour della città nel giorno fino a 0,60 $, gli altri fino a 0,20 $; tempo al massimo 5 s peggio di oggi', () => {
        expect(costoETempo({ citta: { cached: false }, secs: 25 }, 0.55, 21.2)).toMatchObject({ primo: true, okCosto: true, okTempo: true });
        expect(costoETempo({ citta: { cached: true }, secs: 30 }, 0.25, 21.2)).toMatchObject({ primo: false, okCosto: false, okTempo: false });
    });
    it('le liste di controllo: Catania 8, Roma/Napoli/Palermo/Lecce 6, Troina 3', () => {
        expect(ESSENZIALI_CONTROLLO.Catania.length).toBe(8);
        for (const c of ['Roma', 'Napoli', 'Palermo', 'Lecce']) expect(ESSENZIALI_CONTROLLO[c].length).toBe(6);
        expect(ESSENZIALI_CONTROLLO.Troina.length).toBe(3);
    });
});

describe('C10b — conosce la città in una metropoli e in un borgo', () => {
    const verificati = [
        { place_id: 'p-Santa Maria in Trastevere', tipo: 'essenziale', quartiere: 'Trastevere' },
        { place_id: 'p-Villa Farnesina', tipo: 'essenziale', quartiere: 'Trastevere' },
        { place_id: 'p-Colosseo', tipo: 'essenziale', quartiere: 'Monti' },
        { place_id: 'p-Piazza di Santa Maria', tipo: 'da locale', quartiere: 'Trastevere' },
    ];
    const giro = (titoli) => ({
        id: 'trastevere', luogo: 'Roma', tipo: 'itinerario', finestraMinuti: [780],
        citta: { cached: true, scala: { scala: 'metropoli' }, quartiere: { nome: 'Trastevere' }, verificati },
        tours: [{ stops: titoli.map(([t, m]) => st(t, m)) }],
    });
    it('verde con 2 ancore del quartiere scelto e metà delle visite dalla lista', () => {
        const v = conosceCitta(giro([['Santa Maria in Trastevere', 'mattina'], ['Villa Farnesina', 'mattina'], ['Piazza di Santa Maria', 'pomeriggio'], ['Orto Botanico', 'pomeriggio']]));
        expect(v).toMatchObject({ applicabile: true, metropoli: true, ok: true });
        expect(v.ancoreQuartiere).toEqual(['Santa Maria in Trastevere', 'Villa Farnesina']);
    });
    it('rossa con una sola ancora del quartiere (il Colosseo è di un altro quartiere)', () => {
        expect(conosceCitta(giro([['Santa Maria in Trastevere', 'mattina'], ['Colosseo', 'mattina'], ['Piazza di Santa Maria', 'pomeriggio']])).ok).toBe(false);
    });
    it('un borgo si misura anche in mezza giornata (almeno 2 posti della lista)', () => {
        const borgo = { id: 'troina', luogo: 'Troina', tipo: 'itinerario', finestraMinuti: [240],
            citta: { scala: { scala: 'borgo' }, verificati: [{ place_id: 'p-Chiesa Madre' }, { place_id: 'p-Chiesa San Nicolò' }] },
            tours: [{ stops: [st('Chiesa Madre', 'mattina'), st('Chiesa San Nicolò', 'mattina')] }] };
        expect(conosceCitta(borgo)).toMatchObject({ applicabile: true, borgo: true, ok: true });
    });
});
