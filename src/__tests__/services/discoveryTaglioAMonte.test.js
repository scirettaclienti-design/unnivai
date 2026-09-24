// Gate MERITO-A-MONTE — il taglio a maxResults dentro discoverRealPOIs
// (placesDiscoveryService.js) non deve più avvenire per qualityScore.
//
// Il Gate MERITO (24/09, aiRecommendationService.js/candidateScoring.js) ha
// tolto le recensioni come merito nel pool che arriva al selettore. Ma un
// livello più a monte, dentro discoverRealPOIs, un secondo taglio — per
// SINGOLA query, PRIMA che i risultati delle query si uniscano nel pool che
// aiRecommendationService/candidateScoring vedono — ordinava ancora per
// qualityScore = rating*ln(1+reviews) e teneva solo i primi `maxResults`
// (default 12). Un luogo valido (sopra la soglia qualità per kind/scaleLevel)
// ma con poche recensioni, in una query affollata (>12 risultati pertinenti),
// non sopravviveva MAI fino al Gate MERITO — che quindi non lo vedeva mai,
// qualunque fosse la sua affinità DNA.
//
// Misurato (non dedotto) prima di questo fix, con le funzioni REALI del
// modulo (applyQualityThreshold, qualityScore), su 14 candidati di un borgo
// (soglia CULTURA small = rating>=4.0, reviews>=3): 13 "popolari" (rating 4.1,
// 200-2600 recensioni) + 1 "gemma" (Chiesetta del Rosario, rating 4.9, 8
// recensioni) messa in posizione 4 dell'array originale. Tutti e 14 passano
// applyQualityThreshold (livello 1). Ordinando per qualityScore e tagliando a
// 12, la gemma (qs=4.9*ln(9)≈10.8) perde contro tutti i 13 popolari
// (qs minimo 4.1*ln(201)≈21.7) e resta fuori. Tenendo invece l'ordine
// originale (quello di Google, non un nostro ri-ranking) e tagliando a 12, la
// gemma sopravvive perché è in posizione 4.

import { describe, it, expect } from 'vitest';
import { discoverRealPOIs, applyQualityThreshold, qualityScore } from '../../services/placesDiscoveryService';

const GEMMA_NAME = 'Chiesetta del Rosario';

const buildQueryResults = () => {
    const popolari = Array.from({ length: 13 }, (_, i) => ({
        place_id: `pid-popolare-${i}`,
        name: `Popolare ${i}`,
        rating: 4.1,
        user_ratings_total: 200 + i * 200,
        business_status: 'OPERATIONAL',
        types: ['museum'],
        geometry: { location: { lat: 37.5, lng: 14.0 } },
    }));
    const gemma = {
        place_id: 'pid-gemma',
        name: GEMMA_NAME,
        rating: 4.9,
        user_ratings_total: 8,
        business_status: 'OPERATIONAL',
        types: ['church'],
        geometry: { location: { lat: 37.5, lng: 14.0 } },
    };
    // Gemma in posizione 3 (indice, 0-based) su 14 candidati totali: dentro i
    // primi 12 se si taglia per ordine originale, fuori se si taglia per
    // qualityScore (qs troppo basso per competere con 13 posti popolari).
    return [...popolari.slice(0, 3), gemma, ...popolari.slice(3)];
};

describe('Gate MERITO-A-MONTE — misura di cosa sopravvive oggi al taglio per query', () => {
    it('MISURA: applyQualityThreshold+qualityScore, chi sopravvive a slice(0,12)', () => {
        const candidati = buildQueryResults();
        const { pois: qualified, scaleLevel } = applyQualityThreshold(candidati, 'CULTURA', true);
        // eslint-disable-next-line no-console
        console.log(`[MISURA] candidati in ingresso=${candidati.length} qualificati=${qualified.length} scaleLevel=${scaleLevel}`);
        expect(qualified.length).toBe(14); // tutti passano la soglia (rating/reviews minimi bassissimi per borgo)

        const perQualityScore = qualified
            .map(p => ({ ...p, _qs: qualityScore(p) }))
            .sort((a, b) => b._qs - a._qs)
            .slice(0, 12);
        // eslint-disable-next-line no-console
        console.log(`[MISURA] ordinati per qualityScore, sopravvivono 12/14: gemma presente=${perQualityScore.some(p => p.name === GEMMA_NAME)}`);
        expect(perQualityScore.some(p => p.name === GEMMA_NAME)).toBe(false);

        const perOrdineOriginale = qualified.slice(0, 12);
        // eslint-disable-next-line no-console
        console.log(`[MISURA] ordine originale, sopravvivono 12/14: gemma presente=${perOrdineOriginale.some(p => p.name === GEMMA_NAME)}`);
        expect(perOrdineOriginale.some(p => p.name === GEMMA_NAME)).toBe(true);
    });
});

describe('Gate MERITO-A-MONTE — discoverRealPOIs: la gemma con poche recensioni sopravvive al taglio per query', () => {
    it('14 candidati per una query affollata, borgo — la gemma (4.9/8) e i 12 posti sono nel risultato finale', async () => {
        const candidati = buildQueryResults();
        const fetchMock = async (url) => {
            const u = String(url);
            if (u.includes('textsearch')) {
                return { ok: true, json: async () => ({ status: 'OK', results: candidati }) };
            }
            throw new Error(`fetch inatteso in questo test: ${u}`);
        };
        globalThis.fetch = fetchMock;

        const risultato = await discoverRealPOIs('Troina', 37.5, 14.0, 'cultura', { forceSmallTown: true, maxResults: 12 });

        expect(risultato.length).toBeLessThanOrEqual(12); // il tetto di costo/prompt non cresce
        expect(risultato.some(p => p.name === GEMMA_NAME)).toBe(true);
    });
});
