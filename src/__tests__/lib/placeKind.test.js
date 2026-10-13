// C6a — il tipo del posto lo decide il tipo principale di Google; senza, un ordine di priorita' dei types.
import { describe, it, expect } from 'vitest';
import { placeKind, kindFromPrimaryType, kindFromTypes, TYPES_PRIORITY, KINDS } from '../../lib/placeKind';
import { candidateFamily, candidateMomentCategories, isMealPlace } from '../../services/momentSelection';
import { resolveStayMinutes, stayOf, computeStopTimings } from '../../lib/tourTiming';
import { openStatus, OPEN, CLOSED } from '../../lib/openingHours';
import { stopData, guardComposed } from '../../lib/stopPhrases';

// Wisdomless Club, dalla cache del proxy (13/10/2026): cocktail_bar con una mostra.
const wisdomless = { name: 'Wisdomless Club', primaryType: 'cocktail_bar', types: ['cocktail_bar', 'art_gallery', 'body_art_service', 'bar', 'event_venue', 'store', 'point_of_interest', 'service', 'establishment'] };

describe('C6a — famiglia dal tipo principale', () => {
    it('Wisdomless Club (cocktail_bar con art_gallery tra i types) non e\' un museo', () => {
        expect(candidateFamily(wisdomless)).not.toBe('museo');
        expect(candidateFamily(wisdomless)).toBeNull();
        const cats = candidateMomentCategories(wisdomless);
        expect(cats.has('musei')).toBe(false);
        expect(cats.has('shopping')).toBe(false);
        expect(cats.has('bar')).toBe(true);
        expect(placeKind(wisdomless)).toEqual({ kind: 'bar', fonte: 'principale' });
    });

    it('un bar marcato anche restaurant e\' un bar: non e\' un posto da pasto', () => {
        const sotto = { name: 'Sotto Palazzo', primaryType: 'cocktail_bar', types: ['cocktail_bar', 'italian_restaurant', 'bar', 'european_restaurant', 'restaurant', 'food'] };
        expect(placeKind(sotto).kind).toBe('bar');
        expect(isMealPlace(sotto)).toBe(false);
        expect([...candidateMomentCategories(sotto)].sort()).toEqual(['bar', 'vita notturna']);
    });

    it('un museo con caffetteria resta museo (tipo principale)', () => {
        const museo = { name: 'Museo Nazionale', primaryType: 'museum', types: ['museum', 'cafe', 'restaurant', 'store', 'tourist_attraction'] };
        expect(candidateFamily(museo)).toBe('museo');
        expect(isMealPlace(museo)).toBe(false);
        const cats = candidateMomentCategories(museo);
        expect(cats.has('musei')).toBe(true);
        expect(cats.has('cibo')).toBe(false);
        expect(cats.has('bar')).toBe(false);
        expect(cats.has('shopping')).toBe(false);
        expect(resolveStayMinutes(museo.types, museo.primaryType)).toBe(60);
    });

    it('un museo con caffetteria resta museo anche senza tipo principale (ordine di priorita\')', () => {
        const museo = { name: 'Museo Civico', types: ['restaurant', 'cafe', 'museum'] };
        expect(placeKind(museo)).toEqual({ kind: 'museo', fonte: 'tipi' });
        expect(candidateFamily(museo)).toBe('museo');
        expect(resolveStayMinutes(museo.types)).toBe(60);
    });

    it('un bar con una galleria resta bar anche senza tipo principale', () => {
        const bar = { name: 'Wisdomless Club', types: ['art_gallery', 'bar', 'store'] };
        expect(placeKind(bar)).toEqual({ kind: 'bar', fonte: 'tipi' });
        expect(candidateFamily(bar)).toBeNull();
        expect(candidateMomentCategories(bar).has('musei')).toBe(false);
    });

    it('una galleria vera (tipo principale art_gallery) e\' museo', () => {
        const g = { name: 'Galleria Alfa', primaryType: 'art_gallery', types: ['art_gallery'] };
        expect(candidateFamily(g)).toBe('museo');
    });

    it('un ristorante con uno store di contorno non e\' un negozio; un ristorante senza `restaurant` tra i types (italian_restaurant) e\' da pasto', () => {
        expect(candidateMomentCategories({ name: 'Trattoria Bottega', primaryType: 'restaurant', types: ['restaurant', 'food', 'store'] }).has('shopping')).toBe(false);
        const osteria = { name: 'Du Mori Osteria', primaryType: 'italian_restaurant', types: ['italian_restaurant', 'food'] };
        expect(isMealPlace(osteria)).toBe(true);
        expect(candidateFamily(osteria)).toBeNull();
    });

    it('un giardino e\' verde (tipo principale); uno store di contorno non ne fa un negozio', () => {
        const g = { name: 'Giardino Aretusa', primaryType: 'garden', types: ['garden', 'store'] };
        expect(candidateFamily(g)).toBe('verde');
        const cats = candidateMomentCategories(g);
        expect(cats.has('natura')).toBe(true);
        expect(cats.has('shopping')).toBe(false);
    });

    it('senza tipo decisivo vale quello di prima: un monumento resta monumento', () => {
        const m = { name: 'Fontana', primaryType: 'fountain', types: ['fountain', 'tourist_attraction'] };
        expect(placeKind(m).kind).toBeNull();
        expect([...candidateMomentCategories(m)].sort()).toEqual(['cultura', 'monumenti']);
    });

    it('le regole del nome restano per i locali che non sono un pasto (un bar "Terrazza" e\' un panorama)', () => {
        expect(candidateFamily({ name: 'Terrazza Martini', primaryType: 'cocktail_bar', types: ['bar'] })).toBe('panorama');
    });
});

describe('C6a — l\'ordine di priorita\' dei types (senza tipo principale)', () => {
    it('vince la prima voce della lista, non l\'ordine dell\'array di Google', () => {
        const a = kindFromTypes(['store', 'bar', 'art_gallery']);
        const b = kindFromTypes(['art_gallery', 'bar', 'store']);
        expect(a).toBe('bar');
        expect(b).toBe('bar');
    });
    it('l\'ordine scritto: museum > chiesa > restaurant > bar > cafe > art_gallery > park > store', () => {
        expect(TYPES_PRIORITY.map(([k]) => k)).toEqual(['museo', 'chiesa', 'pasto', 'spuntino', 'bar', 'notte', 'caffe', 'forno', 'dolce', 'museo', 'verde', 'negozio']);
        expect(kindFromTypes(['restaurant', 'museum'])).toBe('museo');
        expect(kindFromTypes(['church', 'restaurant'])).toBe('chiesa');
        expect(kindFromTypes(['bar', 'restaurant'])).toBe('pasto');
        expect(kindFromTypes(['cafe', 'bar'])).toBe('bar');
        expect(kindFromTypes(['art_gallery', 'cafe'])).toBe('caffe');
        expect(kindFromTypes(['park', 'store'])).toBe('verde');
        expect(kindFromTypes(['store'])).toBe('negozio');
    });
    it('types assenti o sconosciuti → nessun tipo', () => {
        expect(kindFromTypes(undefined)).toBeNull();
        expect(kindFromTypes([])).toBeNull();
        expect(kindFromTypes(['establishment', 'premise'])).toBeNull();
        expect(placeKind({})).toEqual({ kind: null, fonte: null });
    });
    it('il tipo principale vince sui types, anche col tipo principale in snake_case', () => {
        expect(placeKind({ primary_type: 'bar', types: ['museum'] }).kind).toBe('bar');
        expect(kindFromPrimaryType('point_of_interest')).toBeNull();
        expect(kindFromPrimaryType('')).toBeNull();
        expect(kindFromPrimaryType(null)).toBeNull();
    });
});

describe('C6a — durata dal tipo principale (tabella tipo → minuti)', () => {
    const casi = [
        ['museum', 60], ['art_museum', 60], ['art_gallery', 60],
        ['restaurant', 75], ['italian_restaurant', 75], ['pizza_restaurant', 75], ['bistro', 75],
        ['fast_food_restaurant', 30], ['meal_takeaway', 30], ['sandwich_shop', 30],
        ['church', 20], ['place_of_worship', 20],
        ['bar', 20], ['cocktail_bar', 20], ['wine_bar', 20], ['pub', 20],
        ['cafe', 20], ['coffee_shop', 20], ['bakery', 20], ['ice_cream_shop', 20], ['dessert_shop', 20],
        ['park', 30], ['garden', 30], ['night_club', 30], ['clothing_store', 30], ['spa', 30],
    ];
    it.each(casi)('%s → %i minuti', (pt, min) => {
        expect(resolveStayMinutes([], pt)).toBe(min);
    });
    it('un caffe\' marcato anche restaurant dura 20, non 75', () => {
        const caffe = { primaryType: 'cafe', types: ['cafe', 'restaurant', 'food'] };
        expect(stayOf(caffe)).toBe(20);
    });
    it('un bar marcato anche restaurant dura come un bar', () => {
        const bar = { primaryType: 'cocktail_bar', types: ['cocktail_bar', 'restaurant', 'bar', 'food'] };
        expect(stayOf(bar)).toBe(20);
        expect(stayOf(bar)).toBe(stayOf({ primaryType: 'bar', types: ['bar'] }));
    });
    it('un ristorante marcato anche cafe dura da pasto', () => {
        expect(stayOf({ primaryType: 'restaurant', types: ['restaurant', 'cafe', 'bar'] })).toBe(75);
    });
    it('un posto senza tipo principale: l\'ordine di priorita\' (restaurant + cafe resta 75, come prima)', () => {
        expect(resolveStayMinutes(['cafe', 'restaurant', 'food'])).toBe(75);
    });
    it('i tempi della tappa (computeStopTimings) usano il tipo principale', () => {
        const { stops } = computeStopTimings([
            { latitude: 41.9, longitude: 12.48, primaryType: 'cafe', types: ['cafe', 'restaurant'] },
            { latitude: 41.9, longitude: 12.481, primaryType: 'restaurant', types: ['restaurant'] },
        ]);
        expect(stops.map(s => s.stayMinutes)).toEqual([20, 75]);
    });
    it('la tabella dei tipi del posto ha ogni durata dichiarata', () => {
        expect(Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.minuti]))).toEqual({
            museo: 60, chiesa: 20, pasto: 75, spuntino: 30, bar: 20, caffe: 20, forno: 20, dolce: 20, notte: 30, verde: 30, negozio: 30, servizi: 30,
        });
    });
});

describe('C6a — il controllo orari usa la durata nuova', () => {
    // mercoledi' 14/10/2026 (CEST): aperto fino alle 21:00
    const periods = [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: '1700' }, close: { day: d, time: '2100' } }));
    const arrivo = new Date('2026-10-14T20:15:00+02:00');
    it('un bar marcato restaurant che chiude alle 21: con 75 minuti sforava (chiuso), con 20 no (aperto)', () => {
        const bar = { place_id: 'b', primaryType: 'cocktail_bar', types: ['cocktail_bar', 'restaurant', 'bar'], openingPeriods: periods };
        expect(openStatus(bar, arrivo, resolveStayMinutes(bar.types)).stato).toBe(CLOSED);   // senza tipo principale: 75
        expect(openStatus(bar, arrivo, stayOf(bar)).stato).toBe(OPEN);                         // con il tipo principale: 20
    });
});

describe('C6a — il narratore non scarta piu\' la frase di un posto per la coda del nome', () => {
    const arrival = new Date('2026-10-14T15:30:00+02:00');
    const sun = { sunrise: new Date('2026-10-14T06:30:00+02:00'), sunset: new Date('2026-10-14T18:00:00+02:00') };
    const stop = (title) => ({ place_id: 'p1', title, types: ['cocktail_bar', 'bar'], primaryType: 'cocktail_bar' });
    const frase = (title) => {
        const d = stopData({ stop: stop(title), momento: 'aperitivo', orario: '15:30', locale: true, priceLevel: 2, primo: false, ultimo: false });
        return guardComposed(d, {}, { arrival, ...sun });
    };
    it('con la coda "Apericena e Colazione" la frase delle 15:30 viene tolta (il difetto)', () => {
        const r = frase('Deliziosa Café & Cocktail Bar | Apericena e Colazione');
        expect(r.rete.length).toBeGreaterThan(0);
    });
    it('col nome pulito la rete non toglie niente', () => {
        const r = frase('Deliziosa Café & Cocktail Bar');
        expect(r.rete).toEqual([]);
    });
});
