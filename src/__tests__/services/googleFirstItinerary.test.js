// DVAI-060 F2 — generateItinerary da GENERATORE a SELETTORE-NARRATORE.
//
// L'AI non inventa più i luoghi: riceve una lista di candidati REALI (da
// discoverRealPOIs) e li sceglie/ordina/racconta. Test qui:
// - derivePrimaryThemes: mapping prefs.interests → temi textsearch
// - canonicalizeStopsFromCandidates: sostituzione title/lat/lng dai candidati,
//   scarto degli stop con place_id hallucinato dall'AI
// - INSIDER_CACHE_PREFIX bumpato (retrocompat)
//
// Test integration completo (mock fetch openai+textsearch) fuori scope V1:
// preferisco unit test dei helper puri per stabilità e velocità.

import { describe, it, expect, vi } from 'vitest';
import {
    derivePrimaryThemes,
    canonicalizeStopsFromCandidates,
} from '../../services/aiRecommendationService';

// ─── derivePrimaryThemes ──────────────────────────────────────────────────────

describe('DVAI-060 F2 — derivePrimaryThemes', () => {
    it('senza interests → mix default walking+art+food (featured insider)', () => {
        expect(derivePrimaryThemes({ duration: '1 Giorno', group: 'solo' }))
            .toEqual(['walking', 'art', 'food']);
    });

    it('senza prefs → mix default', () => {
        expect(derivePrimaryThemes()).toEqual(['walking', 'art', 'food']);
        expect(derivePrimaryThemes(null)).toEqual(['walking', 'art', 'food']);
    });

    it('interests=["Cibo"] → ["food"]', () => {
        expect(derivePrimaryThemes({ interests: ['Cibo'] })).toEqual(['food']);
    });

    it('interests=["Arte","Storia","Cultura"] → ["art"] (dedup)', () => {
        // Tutti mappano su art → un solo tema dopo dedup.
        expect(derivePrimaryThemes({ interests: ['Arte', 'Storia', 'Cultura'] }))
            .toEqual(['art']);
    });

    it('interests=["Cibo","Arte","Natura","Shopping"] → primi 3 (max 3)', () => {
        const themes = derivePrimaryThemes({
            interests: ['Cibo', 'Arte', 'Natura', 'Shopping'],
        });
        expect(themes.length).toBeLessThanOrEqual(3);
        expect(themes[0]).toBe('food');
        expect(themes[1]).toBe('art');
        expect(themes[2]).toBe('nature');
    });

    it('interest "Vita notturna" → nightlife (nuovo theme DVAI-060 F2)', () => {
        expect(derivePrimaryThemes({ interests: ['Vita notturna'] }))
            .toEqual(['nightlife']);
    });

    it('interest "Shopping" → shopping (nuovo theme)', () => {
        expect(derivePrimaryThemes({ interests: ['Shopping'] }))
            .toEqual(['shopping']);
    });

    it('interest sconosciuto → fallback mix default', () => {
        // "Teatro" non è in INTEREST_TO_THEME → fallback su default mix.
        expect(derivePrimaryThemes({ interests: ['Teatro'] }))
            .toEqual(['walking', 'art', 'food']);
    });

    it('interest come oggetto UI con .title accettato', () => {
        // SurpriseTour può passare interests come oggetti (dal UI picker).
        expect(derivePrimaryThemes({
            interests: [{ title: 'Cibo' }, { title: 'Natura' }],
        })).toEqual(['food', 'nature']);
    });

    it('case-insensitive: "CIBO"/"cibo"/"Cibo" tutti → food', () => {
        for (const v of ['CIBO', 'cibo', 'Cibo']) {
            expect(derivePrimaryThemes({ interests: [v] })).toEqual(['food']);
        }
    });

    it('interest substring match: "vita notturna a Roma" → nightlife', () => {
        expect(derivePrimaryThemes({ interests: ['vita notturna a Roma'] }))
            .toEqual(['nightlife']);
    });
});

// ─── canonicalizeStopsFromCandidates ─────────────────────────────────────────

describe('DVAI-060 F2 — canonicalizeStopsFromCandidates', () => {
    const CANDIDATES = [
        {
            place_id: 'ChIJ_pantheon',
            name: 'Pantheon',
            latitude: 41.8986, longitude: 12.4769,
            rating: 4.7, user_ratings_total: 300000,
            types: ['tourist_attraction', 'church'],
            googlePhoto: 'https://places-proxy/photo?ref=pantheon',
            city: 'Roma',
            type: 'monument',
        },
        {
            place_id: 'ChIJ_navona',
            name: 'Piazza Navona',
            latitude: 41.8992, longitude: 12.4731,
            rating: 4.8, user_ratings_total: 80000,
            types: ['tourist_attraction'],
            googlePhoto: 'https://places-proxy/photo?ref=navona',
            city: 'Roma',
            type: 'place',
        },
    ];

    it('canonizza title/lat/lng/rating/googlePhoto dai candidati', () => {
        const aiStops = [{
            place_id: 'ChIJ_pantheon',
            time: '10:00',
            description: 'La luce che scende dal buco al centro',
            insiderTip: 'Vai al mattino, meno folla',
            bestTime: 'Prima delle 10',
            transition: 'A piedi verso Piazza Navona, 3 min',
            suggestedMinutes: 30,
            type: 'cultura',
            // AI ha (erroneamente) prodotto anche title/lat/lng — devono essere ignorati
            title: 'FAKE Pantheon Fasullo',
            latitude: 0, longitude: 0,
        }];
        const result = canonicalizeStopsFromCandidates(aiStops, CANDIDATES);
        expect(result).toHaveLength(1);
        // title canonico dal candidato Google
        expect(result[0].title).toBe('Pantheon');
        // lat/lng canoniche
        expect(result[0].latitude).toBe(41.8986);
        expect(result[0].longitude).toBe(12.4769);
        // rating dal candidato (non dall'AI)
        expect(result[0].rating).toBe(4.7);
        // googlePhoto canonicizzata
        expect(result[0].googlePhoto).toBe('https://places-proxy/photo?ref=pantheon');
        expect(result[0].image).toBe('https://places-proxy/photo?ref=pantheon');
        // googlePlaceId presente (signals verifyPOIWithPlaces skip)
        expect(result[0].googlePlaceId).toBe('ChIJ_pantheon');
        // Voce dall'AI preservata
        expect(result[0].description).toBe('La luce che scende dal buco al centro');
        expect(result[0].insiderTip).toBe('Vai al mattino, meno folla');
        expect(result[0].bestTime).toBe('Prima delle 10');
        expect(result[0].transition).toBe('A piedi verso Piazza Navona, 3 min');
    });

    it('scarta stop con place_id NON presente nei candidati (halluc AI)', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const aiStops = [
            { place_id: 'ChIJ_navona', description: 'ok' },
            { place_id: 'ChIJ_FAKE_INVENTATO', description: 'halluc' },
        ];
        const result = canonicalizeStopsFromCandidates(aiStops, CANDIDATES);
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Piazza Navona');
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringMatching(/\[DVAI-060 F2\].*place_id sconosciuto.*ChIJ_FAKE_INVENTATO/)
        );
        warnSpy.mockRestore();
    });

    it('tiene la voce anche se AI omette qualche campo', () => {
        const aiStops = [{
            place_id: 'ChIJ_pantheon',
            description: 'Bella',
            // no insiderTip, no bestTime, no transition
        }];
        const result = canonicalizeStopsFromCandidates(aiStops, CANDIDATES);
        expect(result).toHaveLength(1);
        expect(result[0].description).toBe('Bella');
        expect(result[0].insiderTip).toBeNull();
        expect(result[0].bestTime).toBeNull();
        expect(result[0].transition).toBeNull();
        // Fallback su valori sicuri
        expect(result[0].suggestedMinutes).toBe(30);
    });

    it('funziona con candidato che usa googlePlaceId invece di place_id', () => {
        const alt = [{ ...CANDIDATES[0], place_id: undefined, googlePlaceId: 'ChIJ_pantheon' }];
        const aiStops = [{ place_id: 'ChIJ_pantheon', description: 'ok' }];
        const result = canonicalizeStopsFromCandidates(aiStops, alt);
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Pantheon');
    });

    it('array di stops vuoto → risultato vuoto', () => {
        expect(canonicalizeStopsFromCandidates([], CANDIDATES)).toEqual([]);
    });
});
