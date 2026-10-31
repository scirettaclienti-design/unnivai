// TESTI-SCHEDE — i titoli dei giri vengono dalle tappe vere. I giri sono quelli REGISTRATI del banco (docs/prove/dati/, gli stessi
// che il replay di `npm run banco:guardia` riproduce): nessuna rete, nessuna chiamata.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { titoloDaTappe, nomiPerTitolo, nomeBreve, TITOLO_GENERICO, titoloGiro, titoloFondato } from '../../lib/titoliGiro';

const DATI = path.resolve(__dirname, '../../../docs/prove/dati');

/** Ogni oggetto con un titolo e delle tappe con nome, in ogni JSON del banco. */
function giriRegistrati() {
    const out = new Map();
    for (const f of fs.readdirSync(DATI).filter(x => x.endsWith('.json'))) {
        let j;
        try { j = JSON.parse(fs.readFileSync(path.join(DATI, f), 'utf8')); } catch { continue; }
        const visti = new Set();
        const giro = (o) => {
            if (!o || typeof o !== 'object' || visti.has(o)) return;
            visti.add(o);
            const t = !Array.isArray(o) && (o.titolo || o.title);
            if (typeof t === 'string' && Array.isArray(o.stops) && o.stops.length && typeof o.stops[0]?.title === 'string') {
                const chiave = `${t}|${o.stops.map(s => s.title).join('/')}`;
                if (!out.has(chiave)) out.set(chiave, { file: f, prima: t, stops: o.stops });
                return;
            }
            for (const k of Object.keys(o)) giro(o[k]);
        };
        giro(j);
    }
    return [...out.values()];
}
const GIRI = giriRegistrati();
const CITTA = (g) => ['Catania', 'Troina', 'Firenze', 'Napoli', 'Lecce', 'Palermo', 'Cabras', 'Roma'].find(c => new RegExp(c, 'i').test(g.prima))
    || (/catania|etnea|ursino|elefant|amenano/i.test(g.stops.map(s => s.title).join(' ')) ? 'Catania' : 'Roma');

describe('TESTI-SCHEDE — i titoli dei giri registrati nel banco', () => {
    it('ci sono giri registrati su cui provare (almeno 100, con titoli veri)', () => {
        expect(GIRI.length).toBeGreaterThanOrEqual(100);
    });
    it('i titoli di prima: generici o con un luogo che nel giro non c\'è (la prova che il difetto è reale)', () => {
        const generici = GIRI.filter(g => TITOLO_GENERICO.test(g.prima));
        expect(generici.length).toBeGreaterThanOrEqual(30);
        expect(GIRI.some(g => /^Tour di (Roma|Catania|Firenze)$/.test(g.prima))).toBe(true);
    });
    it('ogni giro ha un titolo del codice: non generico, entro 90 caratteri, con il nome di una tappa vera', () => {
        for (const g of GIRI) {
            const t = titoloDaTappe(g.stops, CITTA(g));
            expect(t, g.prima).toBeTruthy();
            expect(t.length, t).toBeLessThanOrEqual(90);
            expect(t, t).not.toMatch(TITOLO_GENERICO);
            const nomi = nomiPerTitolo(g.stops);
            if (nomi.length > 0) expect(nomi.some(n => t.includes(n) || t.includes(n.replace(/^(Il|Lo|La|L'|I|Gli|Le)\s+/i, ''))), t).toBe(true);
        }
    });
    it('il titolo nomina solo tappe del giro: prima e ultima visita, nell\'ordine', () => {
        for (const g of GIRI) {
            const nomi = nomiPerTitolo(g.stops);
            if (nomi.length < 2) continue;
            const t = titoloDaTappe(g.stops, CITTA(g));
            if (/^\d+ tappe/.test(t)) continue;
            const senzaArt = (n) => n.replace(/^(Il|Lo|La|L'|I|Gli|Le)\s+/i, '');
            expect(t.indexOf(senzaArt(nomi[0]))).toBeGreaterThanOrEqual(0);
            expect(t.indexOf(senzaArt(nomi[nomi.length - 1]))).toBeGreaterThan(t.indexOf(senzaArt(nomi[0])) - 1);
        }
    });
    it('«Roma vista dal colle del Gianicolo» con Piazza del Campidoglio dentro: il titolo dice le tappe vere', () => {
        const stops = [{ title: 'Gianicolo Belvedere', types: ['tourist_attraction'] }, { title: 'Giardino degli Aranci', types: ['park'] }, { title: 'Piazza del Campidoglio', types: ['tourist_attraction'] }];
        expect(titoloDaTappe(stops, 'Roma')).toBe('Dal Gianicolo Belvedere a Piazza del Campidoglio');
    });
    it('una tappa sola, tempo libero e locali', () => {
        expect(titoloDaTappe([{ title: 'Passeggiata del Gianicolo', types: ['tourist_attraction'] }], 'Roma')).toBe('Intorno alla Passeggiata del Gianicolo');
        const stops = [{ title: 'Tempo libero', tempoLibero: true }, { title: 'Osteria Navona', types: ['restaurant'] }, { title: 'Fontana dei Quattro Fiumi', types: ['tourist_attraction'] }, { title: 'Bar Popolare', types: ['bar'] }];
        expect(titoloDaTappe(stops, 'Roma')).toBe('Intorno alla Fontana dei Quattro Fiumi'); // i locali non reggono il titolo se ci sono visite
        expect(titoloDaTappe([{ title: 'Osteria Navona', types: ['restaurant'] }, { title: 'Bar Popolare', types: ['bar'] }], 'Roma')).toBe("Dall'Osteria Navona al Bar Popolare");
        expect(titoloDaTappe([], 'Roma')).toBeNull();
    });
    it('nomi lunghi o con code commerciali: nome breve, e se non entra «N tappe, da …»', () => {
        expect(nomeBreve('Villa Bellini - Parco Maestranze')).toBe('Villa Bellini');
        expect(nomeBreve("Fontana dell'Elefante (uʻ Liotru)")).toBe("Fontana dell'Elefante");
        const lungo = [{ title: 'Museo Nazionale Romano, Palazzo Altemps', types: ['museum'] }, { title: 'Chiesa di Sant’Agostino in Campo Marzio', types: ['church'] }, { title: 'Piazza Navona', types: ['tourist_attraction'] }];
        const t = titoloDaTappe(lungo, 'Roma');
        expect(t.length).toBeLessThanOrEqual(90);
        expect(t).not.toMatch(/Tour|Tesori/);
    });
});

// Decisione di Ivano (31/10): il titolo evocativo del motore resta se ogni elemento trova riscontro nelle tappe; «Da A a B» è la riserva
// per i titoli generici o falsi.
describe('TESTI-SCHEDE — il titolo del motore resta se è fondato sulle tappe', () => {
    const t = (title, types = ['tourist_attraction']) => ({ title, types });
    const GIANICOLO = [t('Gianicolo Belvedere'), t('Giardino degli Aranci', ['park']), t('Terrazza delle Quadrighe')];
    it('evocativo e vero: resta', () => {
        expect(titoloGiro("Roma dall'alto", GIANICOLO, 'Roma')).toBe("Roma dall'alto");
        expect(titoloGiro('Panorami romantici di Roma', GIANICOLO, 'Roma')).toBe('Panorami romantici di Roma');
        expect(titoloGiro('Roma vista dal colle del Gianicolo', GIANICOLO, 'Roma')).toBe('Roma vista dal colle del Gianicolo');
        expect(titoloGiro('A tavola a Catania', [t('Trattoria Sorano', ['restaurant']), t('Trattoria del Cavaliere', ['restaurant'])], 'Catania')).toBe('A tavola a Catania');
        expect(titoloGiro('Vista mare a Catania', [t('Lungomare di Acicastello'), t('Porto di Catania')], 'Catania')).toBe('Vista mare a Catania');
    });
    it('generico: «Da A a B»', () => {
        for (const g of ['Tour di Roma', 'Tesori di Roma', 'Il tuo giro a Roma', 'Da insider a Roma']) {
            expect(titoloFondato(g, GIANICOLO, 'Roma'), g).toBe(false);
            expect(titoloGiro(g, GIANICOLO, 'Roma')).toBe('Dal Gianicolo Belvedere alla Terrazza delle Quadrighe');
        }
    });
    it('falso (un luogo o un tipo di posto che fra le tappe non c\'è): «Da A a B»', () => {
        const campidoglio = [t('Piazza del Campidoglio'), t('Il Palazzo dei Conservatori', ['museum'])];
        expect(titoloGiro('Roma vista dal colle del Gianicolo', campidoglio, 'Roma')).toBe('Da Piazza del Campidoglio al Palazzo dei Conservatori');
        expect(titoloGiro("Catania dall'alto", [t('Piazza Università'), t('Fontana dell’Amenano'), t('Porta Uzeda')], 'Catania')).toBe('Da Piazza Università a Porta Uzeda');
        expect(titoloGiro('Fontane di Trastevere', [t('Fontana di Trevi'), t('Piazza di Spagna')], 'Roma')).toBe('Dalla Fontana di Trevi a Piazza di Spagna');
        expect(titoloGiro('Street food di Roma', [t('Pasticceria Regoli', ['bakery', 'food']), t('Antico Forno Roscioli', ['bakery', 'food'])], 'Roma')).toBe('Dalla Pasticceria Regoli all’Antico Forno Roscioli'.replace('’', "'"));
    });
    it('la riserva usa «Dal Lungomare», «Dal Corso», «Dal Viale»', () => {
        expect(titoloGiro('Tour di Catania', [t('Lungomare di Catania'), t('Corso Italia')], 'Catania')).toBe('Dal Lungomare di Catania al Corso Italia');
        expect(titoloGiro('Tour di Roma', [t('Viale Trastevere'), t('Piazza di Santa Maria in Trastevere')], 'Roma')).toBe('Dal Viale Trastevere a Piazza di Santa Maria in Trastevere');
    });
    it('sui giri registrati: ogni titolo tenuto è fondato, ogni titolo generico è sostituito; ne restano e ne cambiano', () => {
        let tenuti = 0, cambiati = 0;
        for (const g of GIRI) {
            const dopo = titoloGiro(g.prima, g.stops, CITTA(g));
            expect(dopo, g.prima).toBeTruthy();
            expect(dopo.length).toBeLessThanOrEqual(90);
            if (dopo === g.prima) { tenuti += 1; expect(titoloFondato(g.prima, g.stops, CITTA(g))).toBe(true); } else cambiati += 1;
            if (/^(Tour|Tesori|Il tuo giro) (di|a) /.test(g.prima)) expect(dopo, g.prima).not.toBe(g.prima);
        }
        expect(tenuti).toBeGreaterThanOrEqual(30);
        expect(cambiati).toBeGreaterThanOrEqual(30);
    });
});
