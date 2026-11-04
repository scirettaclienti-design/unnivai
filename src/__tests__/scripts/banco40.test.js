// BANCO-40 — i 40 casi e i cinque controlli si provano senza rete: rosso sul cattivo noto, verde sul buono.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { CASI_BANCO40, CENTRI } from '../../../scripts/banco/casi-banco40.js';
import { aperte, distanze, citta, titolo, frasi, controllaCaso, CONTROLLI40 } from '../../../scripts/banco/controlli40.js';
import { esitoDi, confrontaEsiti, riepilogo } from '../../../scripts/banco/esiti40.js';
import { CASI_GUARDIA_BANCO40 } from '../../../scripts/banco/guardia-banco40.js';
import config from '../../../scripts/banco/banco.config.json';

const stop = (title, lat, lng, at, extra = {}) => ({ place_id: `p-${title}`, title, lat, lng, at, stay: 30, ...extra });
const ROMA = { lat: 41.8955, lng: 12.4823 };
const meta = { attesa: 'Roma', prefs: { pace: 'Attivo' } };
const caso = (stops, extra = {}) => ({ id: 'x', modo: 'crea', luogo: 'Roma', tours: [{ tema: 'Dal Colosseo al Pantheon', stops }], ...extra });

describe('banco 40 — i casi', () => {
    it('sono 40, con ids unici, i 18 di sempre e 22 nuovi', () => {
        expect(CASI_BANCO40).toHaveLength(40);
        expect(new Set(CASI_BANCO40.map(c => c.id)).size).toBe(40);
        expect(CASI_BANCO40.filter(c => c.di === 'sempre')).toHaveLength(18);
        expect(CASI_BANCO40.filter(c => c.di === 'nuovo')).toHaveLength(22);
    });
    it('ogni città dei casi ha il suo centro per il controllo «altra città»', () => {
        for (const c of CASI_BANCO40) expect(CENTRI[c.attesa], c.id).toBeTruthy();
    });
    it('coprono la griglia: grandi città, borghi, ore, generiche e specifiche, ospite, lontano, ritmi, DNA', () => {
        const g = CASI_BANCO40.map(c => c.griglia);
        for (const citta of ['Roma', 'Catania', 'Palermo', 'Napoli', 'Firenze', 'Troina']) expect(CASI_BANCO40.some(c => c.attesa === citta), citta).toBe(true);
        expect(new Set(CASI_BANCO40.filter(c => g[CASI_BANCO40.indexOf(c)].scala === 'borgo').map(c => c.attesa)).size).toBeGreaterThanOrEqual(4);
        for (const ora of ['mattina', '13', 'sera', 'notte']) expect(g.some(x => x.ora === ora), ora).toBe(true);
        for (const r of ['generica', 'specifica']) expect(g.some(x => x.richiesta === r), r).toBe(true);
        expect(g.some(x => x.ospite)).toBe(true);
        expect(g.some(x => x.lontano)).toBe(true);
        expect(g.some(x => x.mezzo)).toBe(true);
        for (const d of ['cibo', 'cultura', 'natura']) expect(g.some(x => x.dna === d), d).toBe(true);
    });
});

describe('banco 40 — i controlli', () => {
    // BANCO-DIFETTI (T19, D1): a piedi il tetto e' 1,2 km (decisione di Ivano), prima 1,5
    it('distanze: a piedi 1,2 km — 1,3 km fallisce, 1,1 passa', () => {
        expect(config.soglie.kmTraTappePiedi).toBe(1.2);
        const t = (km) => caso([stop('A', 41.8955, 12.4823, '2026-11-05T09:00:00Z'), stop('B', 41.8955 + km * 0.009, 12.4823, '2026-11-05T10:00:00Z')]);
        expect(distanze(t(1.1), meta, config).ok).toBe(true);
        const r = distanze(t(1.3), meta, config);
        expect(r.ok).toBe(false);
        expect(r.violazioni[0]).toMatch(/oltre il tetto a piedi \(1\.2 km\)/);
        expect(distanze(t(1.3), { attesa: 'Roma', prefs: { pace: 'Intenso' } }, config).ok).toBe(true);
    });
    it('distanze: il ritmo Intenso arriva a 5 km', () => {
        const vicino = caso([stop('A', 41.8955, 12.4823, '2026-11-05T09:00:00Z'), stop('B', 41.9, 12.49, '2026-11-05T09:45:00Z')]);
        expect(distanze(vicino, meta, config).ok).toBe(true);
        const lontano = caso([stop('A', 41.8955, 12.4823, '2026-11-05T09:00:00Z'), stop('B', 41.93, 12.49, '2026-11-05T11:00:00Z')]);
        const r = distanze(lontano, meta, config);
        expect(r.ok).toBe(false);
        expect(r.violazioni[0]).toMatch(/oltre il tetto a piedi/);
        expect(distanze(lontano, { attesa: 'Roma', prefs: { pace: 'Intenso' } }, config).ok).toBe(true);
    });
    it('distanze: il tempo fra due arrivi deve bastare per la strada', () => {
        const fretta = caso([stop('A', 41.8955, 12.4823, '2026-11-05T09:00:00Z'), stop('B', 41.9, 12.49, '2026-11-05T09:31:00Z')]);
        expect(distanze(fretta, meta, config).violazioni.join()).toMatch(/ne servono/);
    });
    it('città: una tappa a 40 km da Roma è di un\'altra città; la destinazione sbagliata pure', () => {
        expect(citta(caso([stop('A', ROMA.lat, ROMA.lng, 'x')]), meta).ok).toBe(true);
        expect(citta(caso([stop('Tivoli', 41.96, 12.8, 'x')]), meta).ok).toBe(false);
        expect(citta(caso([stop('A', ROMA.lat, ROMA.lng, 'x')], { destinazione: { city: 'Napoli' } }), meta).violazioni[0]).toMatch(/destinazione/);
    });
    it('titolo: nomina luoghi del giro e nessun\'altra città', () => {
        const stops = [stop('Colosseo', 41.89, 12.49, 'x'), stop('Pantheon', 41.9, 12.477, 'x')];
        expect(titolo(caso(stops), meta).ok).toBe(true);
        expect(titolo({ ...caso(stops), tours: [{ tema: 'Dal Duomo al Battistero', stops }] }, meta).ok).toBe(false);
        expect(titolo({ ...caso(stops), tours: [{ tema: 'Il tuo giro a Napoli', stops }] }, meta).violazioni[0]).toMatch(/nomina Napoli/);
        expect(titolo({ ...caso(stops), tours: [{ tema: 'Il tuo giro a Roma', stops }] }, meta).ok).toBe(true);
        expect(titolo({ ...caso(stops), tours: [{ tema: '', stops }] }, meta).ok).toBe(false);
    });
    it('frasi: la stessa frase due volte nel giro non passa (il nome della tappa non conta)', () => {
        const a = stop('Colosseo', 41.89, 12.49, 'x', { description: 'Qui la città si ferma ad ascoltare.' });
        const b = stop('Pantheon', 41.9, 12.477, 'x', { description: 'Qui la città si ferma ad ascoltare.' });
        expect(frasi(caso([a, b])).ok).toBe(false);
        expect(frasi(caso([a, { ...b, description: 'Una cupola aperta sul cielo.' }])).ok).toBe(true);
    });
    it('aperte: una tappa chiusa all\'ora dell\'arrivo non passa', () => {
        const s = stop('Museo', 41.9, 12.49, '2026-11-05T09:00:00+01:00');
        const chiuso = { ...caso([s]), orari: { [s.place_id]: { chiamato: true, periods: [{ open: { day: 4, time: '1000' }, close: { day: 4, time: '1800' } }] } } };
        expect(aperte(chiuso, config).ok).toBe(false);
        const aperto = { ...caso([{ ...s, at: '2026-11-05T11:00:00+01:00' }]), orari: chiuso.orari };
        expect(aperte(aperto, config).ok).toBe(true);
    });
    it('un giro con errore, saltato o senza tappe non passa nessun controllo', () => {
        expect(controllaCaso({ id: 'x', errore: 'timeout' }, meta, config).stato).toBe('errore');
        expect(controllaCaso({ id: 'x', saltato: 'tetto' }, meta, config).stato).toBe('saltato');
        expect(controllaCaso({ id: 'x', tours: [{ stops: [] }], source: 'google-first' }, meta, config).stato).toBe('errore');
        expect(controllaCaso({ id: 'x', tours: [], ripiegoDichiarato: true, chiusoOra: 'Tutto chiuso' }, meta, config).stato).toBe('ok');
    });
    it('la riproduzione uguale al giro vero ha la stessa firma e gli stessi controlli', () => {
        const c = caso([stop('Colosseo', 41.89, 12.49, '2026-11-05T09:00:00+01:00')]);
        const e = esitoDi(c, meta, config);
        expect(confrontaEsiti([e], [esitoDi(c, meta, config)])[0].uguale).toBe(true);
        const altro = esitoDi(caso([stop('Colosseo', 41.89, 12.49, '2026-11-05T09:10:00+01:00')]), meta, config);
        expect(confrontaEsiti([e], [altro])[0].uguale).toBe(false);
        expect(riepilogo([e]).totale).toBe(1);
        expect(CONTROLLI40).toHaveLength(6); // T23: il sesto, la richiesta (ordinato da Ivano)
    });
});

describe('banco 40 — i file salvati (se ci sono)', () => {
    const dati = (f) => path.join(process.cwd(), 'docs/prove/dati', f);
    it('la guardia nuova sta nei 40 casi e nei tracciati, e i suoi casi passano nei loro esiti', () => {
        expect(CASI_GUARDIA_BANCO40.length).toBeGreaterThan(0);
        for (const id of CASI_GUARDIA_BANCO40) expect(CASI_BANCO40.some(c => c.id === id), id).toBe(true);
        if (!existsSync(dati('banco-40-tracciati.json.gz')) || !existsSync(dati('banco-40-esiti.json'))) return;
        const tr = JSON.parse(gunzipSync(readFileSync(dati('banco-40-tracciati.json.gz'))).toString('utf8'));
        const ids = new Set(tr.casi.map(c => c.id));
        const esiti = JSON.parse(readFileSync(dati('banco-40-esiti.json'), 'utf8'));
        for (const id of CASI_GUARDIA_BANCO40) {
            expect(ids.has(id), `${id} nei tracciati`).toBe(true);
            expect(esiti.casi.find(e => e.id === id)?.stato, `${id} negli esiti`).toBe('ok');
        }
    });
    it('i file salvati non contengono chiavi, token né indirizzi email', () => {
        for (const f of ['banco-40-esiti.json', 'banco-40-tabella.md']) {
            if (!existsSync(dati(f))) continue;
            const t = readFileSync(dati(f), 'utf8');
            expect(t, f).not.toMatch(/(^|[^A-Za-z0-9])AIza[0-9A-Za-z_-]{30,}|eyJ[0-9A-Za-z_-]{20,}\.|(^|[^A-Za-z0-9])sk-[0-9A-Za-z]{20,}|@[a-z0-9-]+\.(com|it)/);
        }
        if (existsSync(dati('banco-40-tracciati.json.gz'))) {
            const t = gunzipSync(readFileSync(dati('banco-40-tracciati.json.gz'))).toString('utf8');
            expect(t).not.toMatch(/(^|[^A-Za-z0-9])AIza[0-9A-Za-z_-]{30,}|eyJ[0-9A-Za-z_-]{20,}\.|(^|[^A-Za-z0-9])sk-[0-9A-Za-z]{20,}|"authorization"|"apikey"/i);
        }
    });
});
