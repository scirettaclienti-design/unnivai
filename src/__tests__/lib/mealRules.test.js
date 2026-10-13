// C7 — un pasto per fascia: chi puo' stare in quale momento.
import { describe, it, expect } from 'vitest';
import { momentAdmits, isBreakfastPlace, isSitDownMeal, isAperitivoPlace } from '../../lib/mealRules';

const P = (primaryType, types = []) => ({ name: 'x', primaryType, types });
const RISTORANTE = P('italian_restaurant', ['restaurant', 'food']);
const PIZZERIA = P('pizza_restaurant', ['restaurant']);
const CAFFE = P('cafe', ['cafe', 'food']);
const FORNO = P('bakery', ['bakery', 'food']);
const BAR = P('bar', ['bar']);
const COCKTAIL = P('cocktail_bar', ['cocktail_bar', 'bar', 'restaurant']);   // marcato anche restaurant
const MUSEO = P('museum', ['museum']);
const m = (key, o = {}) => ({ key, ...o });

describe('tipo di posto', () => {
    it('un cocktail bar marcato anche restaurant e\' un bar, non un pasto', () => {
        expect(isSitDownMeal(COCKTAIL)).toBe(false);
        expect(isAperitivoPlace(COCKTAIL)).toBe(true);
        expect(isSitDownMeal(RISTORANTE)).toBe(true);
    });
    it('colazione: caffe\', forno, bar semplice; non cocktail bar, non ristorante', () => {
        expect(isBreakfastPlace(CAFFE)).toBe(true);
        expect(isBreakfastPlace(FORNO)).toBe(true);
        expect(isBreakfastPlace(BAR)).toBe(true);
        expect(isBreakfastPlace(COCKTAIL)).toBe(false);
        expect(isBreakfastPlace(P('wine_bar', ['bar']))).toBe(false);
        expect(isBreakfastPlace(RISTORANTE)).toBe(false);
    });
});

describe('momentAdmits', () => {
    it('un ristorante sta solo a pranzo e cena', () => {
        expect(momentAdmits(RISTORANTE, m('pranzo'))).toBe(true);
        expect(momentAdmits(RISTORANTE, m('cena'))).toBe(true);
        for (const k of ['mattina', 'pomeriggio', 'aperitivo', 'dopocena']) expect(momentAdmits(RISTORANTE, m(k)), k).toBe(false);
        expect(momentAdmits(PIZZERIA, m('aperitivo'))).toBe(false);
    });
    it('la mattina un locale e\' una colazione; i posti non da locale (musei, chiese) entrano', () => {
        expect(momentAdmits(CAFFE, m('mattina'))).toBe(true);
        expect(momentAdmits(FORNO, m('mattina'))).toBe(true);
        expect(momentAdmits(COCKTAIL, m('mattina'))).toBe(false);
        expect(momentAdmits(RISTORANTE, m('mattina'))).toBe(false);
        expect(momentAdmits(MUSEO, m('mattina'))).toBe(true);
    });
    it('l\'aperitivo e\' un bar (cocktail bar compreso)', () => {
        expect(momentAdmits(BAR, m('aperitivo'))).toBe(true);
        expect(momentAdmits(COCKTAIL, m('aperitivo'))).toBe(true);
        expect(momentAdmits(RISTORANTE, m('aperitivo'))).toBe(false);
    });
    it('un forno non e\' un pranzo (salvo lo street food)', () => {
        expect(momentAdmits(FORNO, m('pranzo'))).toBe(false);
        expect(momentAdmits(FORNO, m('pranzo', { streetFood: true }))).toBe(true);
    });
    it('una richiesta esplicita di ristoranti per quel momento si rispetta; una di pasticceria no allarga ai ristoranti', () => {
        expect(momentAdmits(RISTORANTE, m('pomeriggio', { esplicito: true, esplicitoPasti: true }))).toBe(true);
        expect(momentAdmits(RISTORANTE, m('pomeriggio', { esplicito: true }))).toBe(false);
        expect(momentAdmits(CAFFE, m('pomeriggio', { esplicito: true }))).toBe(true);
    });
});
