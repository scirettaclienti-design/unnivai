// DVAI-057 — Filtro business_status: scarta POI CLOSED_TEMPORARILY / CLOSED_PERMANENTLY.
//
// Motivo: "esiste su Google" ≠ "aperto oggi". Un tour AI Troina proponeva pasticcerie
// cessate e pizzerie fantasma. Con business_status nella field mask + gate
// !== 'OPERATIONAL' → scartiamo prima che finiscano nel tour.
//
// Copre solo il filtro business_status. Il type-check DVAI-051 (EXPECTED_GOOGLE_TYPES
// + BLACKLIST_TYPES) è coperto altrove e deve restare INTATTO — verifichiamo
// implicitamente che un OPERATIONAL con types coerenti passi.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyPOIWithPlaces } from '../../services/aiRecommendationService';

describe('DVAI-057 — verifyPOIWithPlaces filtro business_status', () => {
    let warnSpy;

    beforeEach(() => {
        vi.resetAllMocks();
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        warnSpy.mockRestore();
    });

    const troinaPoi = {
        title: 'Pasticceria Fantasma',
        latitude: 37.7869,
        longitude: 14.6018,
        type: 'food',
    };

    it('scarta POI con business_status=CLOSED_PERMANENTLY', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                status: 'OK',
                candidates: [{
                    name: 'Pasticceria Fantasma',
                    place_id: 'ChIJ_closed_1',
                    geometry: { location: { lat: 37.7870, lng: 14.6020 } },
                    types: ['bakery', 'food', 'establishment'],
                    business_status: 'CLOSED_PERMANENTLY',
                }],
            }),
        }));

        const result = await verifyPOIWithPlaces({ ...troinaPoi }, 'Troina');

        expect(result).toBe(false);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringMatching(/\[DVAI-057\].*Pasticceria Fantasma.*CLOSED_PERMANENTLY/)
        );
    });

    it('scarta POI con business_status=CLOSED_TEMPORARILY', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                status: 'OK',
                candidates: [{
                    name: 'Bar Chiuso Per Ristrutturazione',
                    place_id: 'ChIJ_temp_1',
                    geometry: { location: { lat: 37.7870, lng: 14.6020 } },
                    types: ['bar', 'food'],
                    business_status: 'CLOSED_TEMPORARILY',
                }],
            }),
        }));

        const result = await verifyPOIWithPlaces(
            { ...troinaPoi, title: 'Bar Chiuso Per Ristrutturazione' },
            'Troina'
        );

        expect(result).toBe(false);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringMatching(/\[DVAI-057\].*Bar Chiuso.*CLOSED_TEMPORARILY/)
        );
    });

    it('accetta POI con business_status=OPERATIONAL (type-check DVAI-051 intatto)', async () => {
        const poi = { ...troinaPoi, title: 'Bar del Corso' };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                status: 'OK',
                candidates: [{
                    name: 'Bar del Corso',
                    place_id: 'ChIJ_ok_1',
                    geometry: { location: { lat: 37.7869, lng: 14.6018 } },
                    types: ['cafe', 'food', 'establishment'],
                    business_status: 'OPERATIONAL',
                    rating: 4.3,
                }],
            }),
        }));

        const result = await verifyPOIWithPlaces(poi, 'Troina');

        expect(result).toBe(true);
        // Arricchimento avvenuto → sanity
        expect(poi.googlePlaceId).toBe('ChIJ_ok_1');
    });

    it('accetta POI se business_status manca (retrocompat: non peggiora baseline)', async () => {
        // Se Google non ritorna il campo (proxy vecchio, place con dati incompleti),
        // il gate business_status non deve scartare — altrimenti buttiamo POI validi.
        // La regola: `place.business_status && place.business_status !== 'OPERATIONAL'`.
        const poi = { ...troinaPoi, title: 'Belvedere Troina', type: 'natura' };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                status: 'OK',
                candidates: [{
                    name: 'Belvedere Troina',
                    place_id: 'ChIJ_no_status',
                    geometry: { location: { lat: 37.7869, lng: 14.6018 } },
                    types: ['tourist_attraction', 'point_of_interest'],
                    // business_status assente
                }],
            }),
        }));

        const result = await verifyPOIWithPlaces(poi, 'Troina');
        expect(result).toBe(true);
    });

    it('type-check DVAI-051 continua a scartare officine anche se OPERATIONAL (regressione)', async () => {
        // Anti-regressione: un'officina meccanica dichiarata food dall'AI, aperta e
        // "esistente", deve essere scartata dal type-check DVAI-051 (BLACKLIST_TYPES).
        // Il filtro business_status non deve mascherare / bypassare il gate types.
        const poi = { ...troinaPoi, title: 'Autofficina Rossi', type: 'food' };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                status: 'OK',
                candidates: [{
                    name: 'Autofficina Rossi',
                    place_id: 'ChIJ_car_repair',
                    geometry: { location: { lat: 37.7869, lng: 14.6018 } },
                    types: ['car_repair', 'establishment'],
                    business_status: 'OPERATIONAL',
                }],
            }),
        }));

        const result = await verifyPOIWithPlaces(poi, 'Troina');
        expect(result).toBe(false);
        // Il warn dev'essere DVAI-051 (blacklist), non DVAI-057.
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringMatching(/\[DVAI-051\].*Autofficina/)
        );
    });
});
