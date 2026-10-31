// TESTI-SCHEDE — i titoli dei giri vengono dalle tappe vere. I giri sono quelli REGISTRATI del banco (docs/prove/dati/, gli stessi
// che il replay di `npm run banco:guardia` riproduce): nessuna rete, nessuna chiamata.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { titoloDaTappe, nomiPerTitolo, nomeBreve, TITOLO_GENERICO } from '../../lib/titoliGiro';

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
const CITTA = (g) => (/catania|etnea|ursino|elefant/i.test(g.stops.map(s => s.title).join(' ')) ? 'Catania' : 'Roma');

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
