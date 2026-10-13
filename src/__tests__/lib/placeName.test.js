// C6a — il nome mostrato e' il nome del posto, senza code commerciali sicure.
import { describe, it, expect } from 'vitest';
import { cleanPlaceName } from '../../lib/placeName';

const pulito = (n, city) => cleanPlaceName(n, { city }).name;

describe('cleanPlaceName — taglia solo le code commerciali sicure', () => {
    it('"Deliziosa Café … | Apericena e Colazione" → "Deliziosa Café …"', () => {
        const r = cleanPlaceName('Deliziosa Café & Cocktail Bar | Apericena e Colazione', { city: 'Catania' });
        expect(r).toEqual({ name: 'Deliziosa Café & Cocktail Bar', original: 'Deliziosa Café & Cocktail Bar | Apericena e Colazione', tagliato: true });
    });
    it.each([
        ['Er Marchese all’Anima | Trattoria Romana', 'Roma', 'Er Marchese all’Anima'],
        ['Osteria Fiaschetto | Ristorante a Milano', 'Milano', 'Osteria Fiaschetto'],
        ['Catania Social Club | Ristorante Pizzeria Cocktail Bar', 'Catania', 'Catania Social Club'],
        ['Razmataz | Wine Bar Catania', 'Catania', 'Razmataz'],
        ['Pizzeria Donna Sofia Ai Tribunali | Napoli Pizza', 'Napoli', 'Pizzeria Donna Sofia Ai Tribunali'],
        ['Deliziosa Ristorante | Cucina Tipica Siciliana & Pizzoleria', 'Catania', 'Deliziosa Ristorante'],
        ['The Dome | Rooftop & Restaurant', 'Catania', 'The Dome'],
        ['Ginny | Cocktail Bar | Wine Bar | Ristorante', 'Catania', 'Ginny'],
    ])('%s → %s', (n, city, atteso) => {
        expect(pulito(n, city)).toBe(atteso);
    });
});

describe('cleanPlaceName — mai tagliare nomi composti veri', () => {
    it.each([
        ['MUST | Museo Storico della Città di Lecce', 'Lecce'],
        ['FAF | Female Arts in Florence', 'Firenze'],
        ['Fondazione Biscozzi | Rimbaud ETS - Museo d\'arte contemporanea', 'Lecce'],
        ['LEONARDO INTERACTIVE MUSEUM® - OFFICIAL MUSEUM | 6 LANGUAGES', 'Firenze'],
        ['Don Peppinu | Ragusa CC Ibleo', 'Ragusa'],
        ['Sotto Palazzo | Cocktail e Sapori Mediterranei Rari', 'Catania'],
    ])('%s resta intero', (n, city) => {
        expect(pulito(n, city)).toBe(n);
        expect(cleanPlaceName(n, { city }).tagliato).toBe(false);
    });
    it('una coda fatta solo della citta\' non si taglia ("Gallerie d\'Italia | Napoli")', () => {
        expect(pulito("Gallerie d'Italia | Napoli", 'Napoli')).toBe("Gallerie d'Italia | Napoli");
    });
    it('"Museo X - Palazzo Y" (niente barra) resta intero', () => {
        expect(pulito('Museo Nazionale - Palazzo Altemps', 'Roma')).toBe('Museo Nazionale - Palazzo Altemps');
    });
    it('una parola fuori elenco in una coda blocca il taglio (anche se il resto e\' commerciale)', () => {
        expect(pulito('Bar Centrale | Colazione Garibaldi', 'Roma')).toBe('Bar Centrale | Colazione Garibaldi');
    });
    it('nomi senza barra, vuoti o non stringa non lanciano', () => {
        expect(pulito('Trattoria da Mario', 'Roma')).toBe('Trattoria da Mario');
        expect(pulito('', 'Roma')).toBe('');
        expect(pulito(null, 'Roma')).toBe('');
        expect(pulito(undefined)).toBe('');
    });
    it('una testa troppo corta non si salva con un taglio', () => {
        expect(pulito('| Apericena e Colazione', 'Roma')).toBe('| Apericena e Colazione');
    });
});
