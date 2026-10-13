// TESTI — etichette, meteo, nomi: i moduli di italianLabels.
// Rosso su 2015b5c (il modulo non c'era: a schermo restavano le parole inglesi), verde sul codice di dopo.
//
// 2 etichette di tipo · 3 meteo · 4 nomi con la barra rovesciata · 8 saluto.

import { describe, it, expect } from 'vitest';
import { canonicalizeStopsFromCandidates } from '../../services/aiRecommendationService';
import { typeLabelOf, weatherLabel, capitalizeName, senzaEscape, minutiTesto, minutiInParole, TYPE_LABELS } from '../../lib/italianLabels';

describe('TESTI 2 — etichette di tipo, dal tipo principale, in italiano', () => {
    const casi = [
        ['restaurant', 'ristorante'], ['bar', 'bar'], ['cafe', 'caffè'], ['church', 'chiesa'], ['monument', 'monumento'],
        ['tourist_attraction', 'monumento'], ['museum', 'museo'], ['park', 'parco'], ['cocktail_bar', 'bar'],
        ['pizza_restaurant', 'pizzeria'], ['bakery', 'forno'], ['ice_cream_shop', 'gelateria'], ['garden', 'giardino'],
    ];
    for (const [primaryType, atteso] of casi) {
        it(`${primaryType} → ${atteso}`, () => expect(typeLabelOf({ primaryType, types: [primaryType] })).toBe(atteso));
    }
    it('«Retrò - Cocktail Bar»: tipo interno `restaurant` (tutti i locali), tipo principale cocktail_bar → «bar», mai «restaurant»', () => {
        expect(typeLabelOf({ title: 'Retrò - Cocktail Bar', type: 'restaurant', primaryType: 'cocktail_bar', types: ['bar', 'restaurant', 'food'] })).toBe('bar');
    });
    it('un tipo senza traduzione non ha etichetta, mai la parola inglese', () => {
        expect(typeLabelOf({ primaryType: 'cultural_center', types: ['cultural_center'] })).toBeNull();
        expect(typeLabelOf({ primaryType: 'some_new_google_type' })).toBeNull();
        expect(typeLabelOf({})).toBeNull();
    });
    it('ogni etichetta della tabella è italiana: nessuna parola inglese di Google', () => {
        for (const label of Object.values(TYPE_LABELS)) expect(label, label).not.toMatch(/\b(restaurant|shop|store|museum|park|church|club|house)\b/i);
    });
});

describe('TESTI 3 — meteo in italiano', () => {
    it('le condizioni del servizio meteo si dicono in italiano; senza traduzione, nessuna etichetta', () => {
        expect(weatherLabel('sunny')).toBe('sereno');
        expect(weatherLabel('cloudy')).toBe('nuvoloso');
        expect(weatherLabel('rainy')).toBe('pioggia');
        expect(weatherLabel('sereno')).toBe('sereno');
        expect(weatherLabel('tornado alert')).toBeNull();
        expect(weatherLabel(null)).toBeNull();
    });
});

describe('TESTI 4 — nomi con la barra rovesciata', () => {
    it('nomi con la barra rovesciata, puliti: «Verso \\Catania» → «Verso Catania»', () => {
        const [stop] = canonicalizeStopsFromCandidates([{ place_id: 'v' }], [{ place_id: 'v', name: 'Verso \\Catania', types: [] }], { guard: false });
        expect(stop.title).toBe('Verso Catania');
        expect(senzaEscape('Verso \\Catania')).toBe('Verso Catania');
    });
});

describe('TESTI 8 — il saluto', () => {
    it('il nome ha l\'iniziale maiuscola', () => {
        expect(capitalizeName('ivano')).toBe('Ivano');
        expect(capitalizeName('anna maria')).toBe('Anna Maria');
        expect(capitalizeName('Ivano')).toBe('Ivano');
        expect(capitalizeName('Ospite')).toBe('Ospite');
        expect(capitalizeName('')).toBe('');
    });
});

describe('TESTI 4 — numero e parola concordati', () => {
    it('minuti in cifre e in lettere', () => {
        expect(minutiTesto(1)).toBe('un minuto');
        expect(minutiTesto(2)).toBe('2 minuti');
        expect(minutiInParole(1)).toBe('un minuto');
        expect(minutiInParole(45)).toBe('quarantacinque minuti');
        expect(minutiInParole(23)).toBe('ventitré minuti');
    });
});
