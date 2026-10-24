// GIRO-EDIT — togliere e cambiare UNA tappa: gli orari dopo si ricalcolano, i pasti restano alla loro ora.
import { describe, it, expect } from 'vitest';
import { togliTappa, sostituisciTappa, ricalcolaGiorno, conLiberi, chiaveTappa } from '@/lib/giroEdit';
import { stopClockLabel } from '@/lib/stopMoments';

const T = (hhmm) => new Date(`2026-10-27T${hhmm}:00+01:00`).getTime();
const stop = (nome, moment, lat, lng, types, primaryType) => ({ title: nome, place_id: `id-${nome}`, moment, latitude: lat, longitude: lng, lat, lng, types, primaryType });
// Catania, una strada: ogni tappa a ~250 m dalla precedente
const colazione = stop('Caffè Etna', 'mattina', 37.5020, 15.0870, ['cafe', 'food'], 'cafe');
const museo = stop('Museo Belliniano', 'mattina', 37.5042, 15.0870, ['museum'], 'museum');
const chiesa1 = stop('Chiesa Uno', 'mattina', 37.5064, 15.0870, ['church'], 'church');
const trattoria = stop('Trattoria Sorano', 'pranzo', 37.5086, 15.0870, ['restaurant', 'food'], 'restaurant');
const chiesa2 = stop('Chiesa Due', 'pomeriggio', 37.5108, 15.0870, ['church'], 'church');
const giardino = stop('Villa Bellini', 'pomeriggio', 37.5130, 15.0870, ['park'], 'park');

const base = () => ricalcolaGiorno([colazione, museo, chiesa1, trattoria, chiesa2, giardino], { inizioMs: T('08:00') });
const orari = (r) => Object.fromEntries(r.stops.map(s => [s.title, stopClockLabel(s)]));

describe('ricalcolaGiorno', () => {
    it('la prima tappa tiene l\'ora; il pranzo non parte prima delle 12:30; l\'attesa lunga è una riga «Tempo libero»', () => {
        const r = base();
        const o = orari(r);
        expect(o['Caffè Etna']).toBe('08:00');
        expect(o['Trattoria Sorano']).toBe('12:30');
        expect(r.liberi.length).toBeGreaterThan(0);
        expect(r.liberi.every(f => f.tempoLibero && f.stayMinutes > 45)).toBe(true);
    });
});

describe('togliTappa', () => {
    it('toglie la tappa e ricalcola gli orari dopo; il pranzo resta alle 12:30', () => {
        const prima = base();
        const r = togliTappa(prima.stops, chiaveTappa(museo));
        expect(r.ok).toBe(true);
        expect(r.tolta.title).toBe('Museo Belliniano');
        expect(r.stops.map(s => s.title)).toEqual(['Caffè Etna', 'Chiesa Uno', 'Trattoria Sorano', 'Chiesa Due', 'Villa Bellini']);
        const o = orari(r);
        // la chiesa, che veniva dopo il museo (un'ora di sosta), anticipa: arriva appena comincia la mattina
        expect(new Date(r.stops[1].scheduledTime).getTime()).toBeLessThan(new Date(prima.stops[2].scheduledTime).getTime());
        expect(o['Chiesa Uno']).toBe('09:30');
        // il pranzo non si anticipa
        expect(o['Trattoria Sorano']).toBe('12:30');
        const pranzoFine = new Date(r.stops[2].scheduledTime).getTime() + r.stops[2].stayMinutes * 60000;
        expect(new Date(r.stops[3].scheduledTime).getTime()).toBeGreaterThanOrEqual(pranzoFine);
    });

    it('togliere una tappa del pomeriggio anticipa quelle dopo, mai prima del loro momento', () => {
        const prima = base();
        const r = togliTappa(prima.stops, chiaveTappa(chiesa2));
        expect(r.ok).toBe(true);
        const o = orari(r);
        const t = (h) => T(h);
        expect(new Date(r.stops.at(-1).scheduledTime).getTime()).toBeGreaterThanOrEqual(t('14:30'));
        expect(o['Villa Bellini']).not.toBeNull();
    });

    it('togliere la prima tappa (la colazione): la nuova prima non parte prima del suo momento', () => {
        const prima = base();
        const r = togliTappa(prima.stops, chiaveTappa(colazione));
        expect(r.ok).toBe(true);
        expect(r.stops[0].title).toBe('Museo Belliniano');
        expect(orari(r)['Museo Belliniano']).toBe('09:30');
    });

    it('l\'ultima tappa di un giro non si toglie; una tappa che non c\'è non cambia niente', () => {
        expect(togliTappa([colazione], chiaveTappa(colazione)).ok).toBe(false);
        expect(togliTappa(base().stops, 'id-inesistente').ok).toBe(false);
    });
});

describe('sostituisciTappa', () => {
    it('la tappa nuova prende il posto e il momento della vecchia; gli orari dopo si ricalcolano', () => {
        const prima = base();
        const nuova = stop('Libreria Antica', 'qualunque', 37.5064, 15.0872, ['book_store'], 'book_store');
        const r = sostituisciTappa(prima.stops, chiaveTappa(chiesa2), nuova);
        expect(r.ok).toBe(true);
        expect(r.sostituita.title).toBe('Chiesa Due');
        const i = r.stops.findIndex(s => s.title === 'Libreria Antica');
        expect(i).toBe(4);
        expect(r.stops[i].moment).toBe('pomeriggio');
        expect(r.stops[i].scheduledTime).toBe(prima.stops[4].scheduledTime);
        expect(r.stops.length).toBe(prima.stops.length);
        expect(r.stops.at(-1).scheduledTime).not.toBeNull();
    });

    it('conLiberi rimette il tempo libero al suo posto per orario', () => {
        const r = base();
        const unito = conLiberi(r);
        expect(unito.length).toBe(r.stops.length + r.liberi.length);
        const iLibero = unito.findIndex(x => x.tempoLibero);
        const iDopo = unito.findIndex((x, k) => k > iLibero && !x.tempoLibero);
        expect(new Date(unito[iDopo].scheduledTime).getTime()).toBeGreaterThan(new Date(unito[iLibero].scheduledTime).getTime());
    });
});

describe('ricalcolo — dopo la colazione', () => {
    it('una tappa che il motore aveva messo prima dell\'inizio della mattina (dopo la colazione) non viene ritardata', () => {
        const prima = base();
        const dopoColazione = prima.stops[1]; // il museo, subito dopo il caffè delle 8:00
        const r = togliTappa(prima.stops, chiaveTappa(chiesa1));
        const museoDopo = r.stops.find(s => s.title === dopoColazione.title);
        expect(new Date(museoDopo.scheduledTime).getTime()).toBeLessThanOrEqual(new Date(dopoColazione.scheduledTime).getTime());
    });
});
