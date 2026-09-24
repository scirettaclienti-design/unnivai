// Gate MERITO — test del modulo di scoring puro. Vedi candidateScoring.js per
// il razionale (soglia come filtro, punteggio 0.45 affinita' + 0.35 unicita' +
// 0.20 voto, mai le recensioni come merito sopra soglia).

import { describe, it, expect } from 'vitest';
import {
    passesQualityThreshold,
    mapPlaceTypeToCoreCategory,
    mapCandidateToCoreCategories,
    computeAffinityScore,
    identifyIcons,
    computeUniquenessScore,
    computeCandidateScore,
    selectScoredCandidatePool,
    enforceCategoryVariety,
    weightsFingerprint,
} from '../../services/candidateScoring';

const p = (over = {}) => ({
    place_id: 'pid-x', name: 'Posto X', rating: 4.5, user_ratings_total: 100, types: ['restaurant'], ...over,
});

describe('Gate MERITO — passesQualityThreshold', () => {
    it('citta TOP_30 (Roma): 4.2/20 passa, 4.1/20 no', () => {
        expect(passesQualityThreshold(p({ rating: 4.2, user_ratings_total: 20 }), 'Roma')).toBe(true);
        expect(passesQualityThreshold(p({ rating: 4.1, user_ratings_total: 20 }), 'Roma')).toBe(false);
        expect(passesQualityThreshold(p({ rating: 4.2, user_ratings_total: 19 }), 'Roma')).toBe(false);
    });

    it('comune fuori TOP_30 (Cabras): soglia scende a 4.0/10', () => {
        expect(passesQualityThreshold(p({ rating: 4.0, user_ratings_total: 10 }), 'Cabras')).toBe(true);
        expect(passesQualityThreshold(p({ rating: 3.9, user_ratings_total: 10 }), 'Cabras')).toBe(false);
    });

    it('3.9 e escluso anche a Cabras, dove la soglia e piu bassa — nessuna affinita puo compensarlo', () => {
        // 3.9 < 4.0 anche con la soglia ridotta dei piccoli comuni: la soglia e
        // un filtro, non aggirabile da nessun punteggio a valle.
        const candidato = p({ rating: 3.9, user_ratings_total: 5000 });
        expect(passesQualityThreshold(candidato, 'Cabras')).toBe(false);
        expect(passesQualityThreshold(candidato, 'Roma')).toBe(false);
    });
});

describe('Gate MERITO — vocabolario Places -> CORE_CATEGORIES (sola lettura)', () => {
    it('museum/church -> cultura, art_gallery -> arte, beach/park -> natura, store -> shopping', () => {
        expect(mapPlaceTypeToCoreCategory('museum')).toBe('cultura');
        expect(mapPlaceTypeToCoreCategory('church')).toBe('cultura');
        expect(mapPlaceTypeToCoreCategory('art_gallery')).toBe('arte');
        expect(mapPlaceTypeToCoreCategory('beach')).toBe('natura');
        expect(mapPlaceTypeToCoreCategory('park')).toBe('natura');
        expect(mapPlaceTypeToCoreCategory('store')).toBe('shopping');
    });

    it('type sconosciuto -> null (zero segnale, non segnale contrario)', () => {
        expect(mapPlaceTypeToCoreCategory('point_of_interest')).toBeNull();
        expect(mapCandidateToCoreCategories(p({ types: ['establishment', 'point_of_interest'] })).size).toBe(0);
    });

    it('un candidato con piu type riconosciuti porta piu CORE_CATEGORIES', () => {
        const cats = mapCandidateToCoreCategories(p({ types: ['museum', 'cafe', 'point_of_interest'] }));
        expect([...cats].sort()).toEqual(['cultura', 'food']);
    });
});

describe('Gate MERITO — computeAffinityScore', () => {
    it('nessun peso DNA (utente nuovo, senza seme) -> affinita 0 sempre', () => {
        expect(computeAffinityScore(p({ types: ['museum'] }), {})).toBe(0);
    });

    it('candidato senza type riconosciuto -> affinita 0 anche con pesi forti', () => {
        expect(computeAffinityScore(p({ types: ['point_of_interest'] }), { cultura: 1 })).toBe(0);
    });

    it('prende il peso migliore fra le CORE_CATEGORIES del candidato', () => {
        const pesi = { cultura: 0.3, food: 0.9 };
        expect(computeAffinityScore(p({ types: ['museum', 'cafe'] }), pesi)).toBeCloseTo(0.9);
    });
});

describe('Gate MERITO — computeCandidateScore: il locale con poche recensioni batte la catena', () => {
    it('ristorante 4.4/5000 vs locale 4.6/180, stessa affinita -> vince il locale', () => {
        const ristorante = p({ place_id: 'r1', name: 'Catena SpA', rating: 4.4, user_ratings_total: 5000, types: ['restaurant'] });
        const locale = p({ place_id: 'l1', name: 'Trattoria da Elvira', rating: 4.6, user_ratings_total: 180, types: ['restaurant'] });
        const pool = [ristorante, locale];
        const dnaWeights = { food: 0.6 }; // stessa affinita per entrambi (stesso type)

        const scoreRistorante = computeCandidateScore(ristorante, pool, dnaWeights);
        const scoreLocale = computeCandidateScore(locale, pool, dnaWeights);

        expect(scoreLocale).toBeGreaterThan(scoreRistorante);
    });
});

describe('Gate MERITO — identifyIcons', () => {
    it('il decimo superiore per recensioni nel pool e "icona"', () => {
        const pool = Array.from({ length: 10 }, (_, i) => p({
            place_id: `pid-${i}`, name: `Posto ${i}`, user_ratings_total: (i + 1) * 100,
        }));
        const icons = identifyIcons(pool);
        expect(icons.has('pid-9')).toBe(true); // 1000 recensioni, il piu' alto
        expect(icons.size).toBe(1); // ceil(10*0.1) = 1
        expect(icons.has('pid-0')).toBe(false);
    });

    it('pool vuoto -> nessuna icona', () => {
        expect(identifyIcons([]).size).toBe(0);
    });
});

describe('Gate MERITO — selectScoredCandidatePool: mai piu di un\'icona nel pool offerto', () => {
    it('con piu candidati nel decimo superiore, al massimo 1 icona sopravvive alla selezione', () => {
        // 20 candidati sopra soglia, i primi 4 con recensioni molto alte (tutti
        // nel decimo superiore visto che il pool e' piccolo), gli altri normali.
        const pool = Array.from({ length: 20 }, (_, i) => p({
            place_id: `pid-${i}`,
            name: `Posto ${i}`,
            rating: 4.3,
            user_ratings_total: i < 4 ? 9000 + i : 50 + i,
            types: ['restaurant'],
        }));
        const selected = selectScoredCandidatePool(pool, { city: 'Roma', dnaWeights: {}, limit: 20 });
        const icons = identifyIcons(pool.filter(c => passesQualityThreshold(c, 'Roma')));
        const selectedIds = new Set(selected.map(c => c.place_id));
        const iconiSelezionate = [...icons].filter(id => selectedIds.has(id));
        expect(iconiSelezionate.length).toBeLessThanOrEqual(1);
    });

    it('sotto soglia (rating/recensioni) il candidato non entra mai nel pool, a parita di affinita', () => {
        const buono = p({ place_id: 'ok', rating: 4.5, user_ratings_total: 100, types: ['museum'] });
        const scarso = p({ place_id: 'no', rating: 3.9, user_ratings_total: 9999, types: ['museum'] });
        const selected = selectScoredCandidatePool([buono, scarso], { city: 'Roma', dnaWeights: { cultura: 1 } });
        expect(selected.map(c => c.place_id)).toEqual(['ok']);
    });

    it('due dnaWeights diversi possono cambiare l\'ordine/la composizione del pool', () => {
        const museo = p({ place_id: 'museo', rating: 4.3, user_ratings_total: 200, types: ['museum'] });
        const ristorante = p({ place_id: 'risto', rating: 4.3, user_ratings_total: 200, types: ['restaurant'] });
        const pool = [museo, ristorante];

        const perCultura = selectScoredCandidatePool(pool, { city: 'Roma', dnaWeights: { cultura: 1, food: 0 } });
        const perFood = selectScoredCandidatePool(pool, { city: 'Roma', dnaWeights: { cultura: 0, food: 1 } });

        expect(perCultura[0].place_id).toBe('museo');
        expect(perFood[0].place_id).toBe('risto');
    });
});

describe('Gate MERITO — enforceCategoryVariety', () => {
    it('rompe una sequenza di 3 tappe consecutive dello stesso tipo scambiando con una successiva diversa', () => {
        const stops = [
            { title: 'A', type: 'food' },
            { title: 'B', type: 'food' },
            { title: 'C', type: 'food' },
            { title: 'D', type: 'natura' },
        ];
        const out = enforceCategoryVariety(stops);
        const hasRunOf3 = out.some((_, i) => i <= out.length - 3 &&
            out[i].type === out[i + 1].type && out[i + 1].type === out[i + 2].type);
        expect(hasRunOf3).toBe(false);
        // Nessuna tappa persa o duplicata, solo riordinata.
        expect(out.map(s => s.title).sort()).toEqual(['A', 'B', 'C', 'D']);
    });

    it('se tutte le tappe condividono il tipo, non puo fare nulla e lo dichiara restituendo invariato', () => {
        const stops = [{ type: 'food' }, { type: 'food' }, { type: 'food' }];
        expect(enforceCategoryVariety(stops)).toEqual(stops);
    });

    it('meno di 3 tappe -> nessuna modifica', () => {
        const stops = [{ type: 'food' }, { type: 'food' }];
        expect(enforceCategoryVariety(stops)).toBe(stops);
    });
});

describe('Gate MERITO — weightsFingerprint per la cache', () => {
    it('due pesi diversi producono impronte diverse', () => {
        const a = weightsFingerprint({ cultura: 0.8, food: 0.2 });
        const b = weightsFingerprint({ cultura: 0.2, food: 0.8 });
        expect(a).not.toBe(b);
    });

    it('pesi a zero o assenti non entrano nell\'impronta; oggetto vuoto -> stringa vuota', () => {
        expect(weightsFingerprint({})).toBe('');
        expect(weightsFingerprint({ cultura: 0 })).toBe('');
        expect(weightsFingerprint(null)).toBe('');
    });

    it('stessi pesi, ordine diverso di inserimento -> stessa impronta (ordinamento interno stabile)', () => {
        const a = weightsFingerprint({ cultura: 0.5, food: 0.3 });
        const b = weightsFingerprint({ food: 0.3, cultura: 0.5 });
        expect(a).toBe(b);
    });
});
