// C7 — il tema cibo, "tipico", i momenti chiesti esplicitamente, la cucina locale.
import { describe, it, expect } from 'vitest';
import { detectFoodTheme, explicitFoodMoments, isForeignCuisine, localCuisineReason, tipicoBonus, asksSitDownMeal } from '../../lib/foodTheme';

describe('detectFoodTheme', () => {
    it('"un giorno da catanese, nei ristoranti tipici": tema cibo e tipico', () => {
        const t = detectFoodTheme({ text: 'Vorrei vivere un giorno da catanese, nei ristoranti tipici', categoria: 'cibo' });
        expect(t).toMatchObject({ tema: true, tipico: true });
    });
    it('la categoria cibo del traduttore basta, anche senza parole nel testo', () => {
        expect(detectFoodTheme({ text: 'domani a Catania', categoria: 'cibo' })).toMatchObject({ tema: true, fonte: 'categoria del traduttore' });
    });
    it('"una giornata da romano": vita locale, i pasti tipici', () => {
        expect(detectFoodTheme({ text: 'Una giornata da romano a Roma', categoria: 'misto' })).toMatchObject({ tema: true, tipico: true });
    });
    it('"street food": tema e street food', () => {
        expect(detectFoodTheme({ text: 'Palermo street food', categoria: 'cibo' })).toMatchObject({ tema: true, streetFood: true });
    });
    it('un tema d\'arte o una giornata neutra non e\' tema cibo', () => {
        expect(detectFoodTheme({ text: 'Una giornata d\'arte a Firenze', categoria: 'arte' }).tema).toBe(false);
        expect(detectFoodTheme({ text: 'Una giornata a Roma', categoria: 'misto' }).tema).toBe(false);
    });
    it('"da solo", "da Roma", "da turista" non sono "da catanese"', () => {
        for (const t of ['una giornata da solo a Roma', 'partendo da Roma', 'una giornata da turista']) expect(detectFoodTheme({ text: t, categoria: 'misto' }).tema, t).toBe(false);
    });
});

describe('momenti chiesti esplicitamente', () => {
    it('colazione → mattina; il pomeriggio in pasticceria → pomeriggio; "ristoranti tipici" da soli no', () => {
        expect([...explicitFoodMoments('una colazione siciliana')]).toEqual(['mattina']);
        expect([...explicitFoodMoments('il pomeriggio in pasticceria')]).toEqual(['pomeriggio']);
        expect([...explicitFoodMoments('un pomeriggio tra portici e osterie')]).toEqual(['pomeriggio']);
        expect(explicitFoodMoments('un giorno da catanese, nei ristoranti tipici').size).toBe(0);
    });
    it('pasticceria non chiede un posto dove ci si siede; osterie si', () => {
        expect(asksSitDownMeal('il pomeriggio in pasticceria')).toBe(false);
        expect(asksSitDownMeal('un pomeriggio tra portici e osterie')).toBe(true);
    });
});

describe('cucina locale / estera', () => {
    const sushi = { name: 'Sushi Tokyo', primaryType: 'japanese_restaurant' };
    const trattoria = { name: 'Trattoria Sorano', primaryType: 'italian_restaurant' };
    const putia = { name: 'Antica Putia Odeon', primaryType: 'restaurant' };
    const moderno = { name: 'Bistro Moderno', primaryType: 'restaurant' };
    it('estera: tipo principale o nome', () => {
        expect(isForeignCuisine(sushi)).toBe(true);
        expect(isForeignCuisine({ name: 'Kebab da Alì', primaryType: 'restaurant' })).toBe(true);
        expect(isForeignCuisine(trattoria)).toBe(false);
    });
    it('locale: il nome (trattoria, osteria, putia) o il tipo principale', () => {
        expect(localCuisineReason(trattoria)).toMatch(/trattoria/);
        expect(localCuisineReason(putia)).toMatch(/putia/);
        expect(localCuisineReason(moderno)).toBeNull();
        expect(localCuisineReason(sushi)).toBeNull();
    });
    it('la spinta: i locali prima, il bistrot vegetariano dopo', () => {
        const veg = { name: 'Green Bistrot', primaryType: 'vegetarian_restaurant' };
        expect(tipicoBonus(trattoria)).toBeGreaterThan(tipicoBonus(veg, { dieta: ['vegetariano'] }));
        expect(tipicoBonus(veg, { dieta: ['vegetariano'] })).toBeGreaterThan(tipicoBonus(veg, { dieta: [] }));
        expect(tipicoBonus(moderno)).toBe(0);
    });
});
