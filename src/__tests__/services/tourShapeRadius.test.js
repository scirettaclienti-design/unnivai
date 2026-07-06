// DVAI-055-b — Test del filtro raggio centralizzato in tourShape.js.
//
// Copre la FALLA del path tematico "Per Te" che DVAI-055 (filtro solo in
// generateItinerary) non catturava. I tour tematici passavano dal normalizer
// senza filtro raggio, producendo "Assapora Troina 51 km" e "Magia al tramonto
// Troina 70 km" con tappa a Castelbuono/Isnello (~60 km).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeTour } from '../../services/tourShape';

const TROINA = { latitude: 37.7869, longitude: 14.6018 };
const ROMA = { latitude: 41.9028, longitude: 12.4964 };

// POI reali dentro Troina
const PIAZZA_POPOLO = { title: 'Piazza del Popolo', latitude: 37.7864, longitude: 14.6021, description: 'Cuore del borgo, panorama sui Nebrodi.', type: 'cultura' };
const CHIESA_MADRE = { title: 'Chiesa Madre', latitude: 37.7910, longitude: 14.5960, description: 'Facciata romanica-normanna del XII secolo.', type: 'cultura' };

// POI a ~60 km — Castelbuono nelle Madonie
const CASTELBUONO = { title: 'Castello di Castelbuono', latitude: 37.9297, longitude: 14.0895, description: 'Rocca medievale nel cuore delle Madonie.', type: 'storia' };

// POI a ~60 km — linea aerea Troina → Taormina
const TAORMINA = { title: 'Teatro Antico Taormina', latitude: 37.8516, longitude: 15.2853, description: 'Teatro greco-romano affacciato sullo Ionio.', type: 'cultura' };

describe('DVAI-055-b — normalizeTour con filtro raggio centralizzato', () => {
    let warnSpy;

    beforeEach(() => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    describe('FALLA #1 — path tematico Per Te (bug reale su device)', () => {
        it('tour tematico "Assapora Troina" con tappa a Castelbuono → tappa scartata', () => {
            // Simula l'output di buildSmartExperiencesAsync: 4 POI di cui 1 a 60 km.
            const rawTour = {
                id: 'smart-food-troina',
                title: 'Street Food Tour su misura - Troina',
                isAiGenerated: true,
                city: 'Troina',
                steps: [
                    PIAZZA_POPOLO,
                    CHIESA_MADRE,
                    { title: 'Bar del Corso', latitude: 37.7870, longitude: 14.6015, description: 'Colazione con granita al pistacchio.', type: 'food' },
                    CASTELBUONO, // ← quello che l'AI ha inventato
                ],
            };
            const result = normalizeTour(rawTour, {
                cityFallback: 'Troina',
                cityCenter: TROINA,
            });
            // Castelbuono a ~60 km viene scartato dal filtro.
            expect(result.steps).toHaveLength(3);
            expect(result.steps.map(s => s.title)).not.toContain('Castello di Castelbuono');
            expect(result.steps.map(s => s.title)).toEqual(['Piazza del Popolo', 'Chiesa Madre', 'Bar del Corso']);
        });

        it('tour tematico "Magia al tramonto" con tappa a Taormina → tappa scartata', () => {
            const rawTour = {
                id: 'smart-romance-troina',
                title: 'Magia al tramonto a Troina',
                isAiGenerated: true,
                city: 'Troina',
                steps: [
                    { title: 'Belvedere Troina', latitude: 37.7855, longitude: 14.6030, description: 'Panorama sull\'Etna al tramonto.', type: 'natura' },
                    PIAZZA_POPOLO,
                    TAORMINA, // ← inventato
                ],
            };
            const result = normalizeTour(rawTour, {
                cityFallback: 'Troina',
                cityCenter: TROINA,
            });
            expect(result.steps.map(s => s.title)).not.toContain('Teatro Antico Taormina');
            expect(result.steps).toHaveLength(2);
        });
    });

    describe('TOUR DI GUIDA DB — enforceRadius: false, no filtro', () => {
        it('tour di guida DB "Roma → Ostia Antica" (25 km) NON viene filtrato quando enforceRadius: false', () => {
            const OSTIA = { title: 'Ostia Antica', latitude: 41.7549, longitude: 12.2913, description: 'Sito archeologico romano fondamentale.', type: 'storia' };
            const COLOSSEO = { title: 'Colosseo', latitude: 41.8902, longitude: 12.4922, description: 'L\'anfiteatro romano più famoso.', type: 'storia' };
            const rawTour = {
                id: 'guide-roma-ostia',
                title: 'Roma → Ostia Antica',
                isAiGenerated: false, // tour di guida vera
                city: 'Roma',
                guide_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // UUID guida DB
                steps: [COLOSSEO, OSTIA],
            };
            const result = normalizeTour(rawTour, {
                cityFallback: 'Roma',
                enforceRadius: false, // gate DVAI-055-b: no filtro per guide
                cityCenter: ROMA,
            });
            // Anche Ostia a ~25 km da Roma (fuori raggio città 10) passa perché filtro spento.
            expect(result.steps).toHaveLength(2);
            expect(result.steps.map(s => s.title)).toContain('Ostia Antica');
        });

        it('senza opts.enforceRadius e SENZA cityCenter → nessun filtro (retrocompat)', () => {
            const rawTour = {
                id: 'legacy',
                title: 'Tour legacy',
                city: 'Troina',
                steps: [PIAZZA_POPOLO, TAORMINA],
            };
            const result = normalizeTour(rawTour, { cityFallback: 'Troina' });
            expect(result.steps).toHaveLength(2); // Taormina passa perché no cityCenter
        });
    });

    describe('COVER — regola "no fake content" (DVAI-055-b)', () => {
        it('quando il filtro scarta lo step 0, la cover si ricalcola dal nuovo step 0 (mai fake)', () => {
            const FAR_WITH_PHOTO = {
                title: 'Taormina lontana',
                latitude: TAORMINA.latitude, longitude: TAORMINA.longitude,
                description: 'Foto reale ma fuori raggio.',
                type: 'cultura',
                googlePhoto: 'https://real-photo-taormina.jpg',
            };
            const NEAR_WITH_PHOTO = {
                title: 'Piazza Troina',
                latitude: PIAZZA_POPOLO.latitude, longitude: PIAZZA_POPOLO.longitude,
                description: 'Foto reale entro raggio.',
                type: 'cultura',
                googlePhoto: 'https://real-photo-troina.jpg',
            };
            const rawTour = {
                id: 'test-cover-safe',
                title: 'Cover test',
                isAiGenerated: true,
                city: 'Troina',
                // steps[0] è quello lontano — sarebbe stata cover del tour!
                steps: [FAR_WITH_PHOTO, NEAR_WITH_PHOTO],
                // image esplicito NON passato → cover deriva dagli steps
            };
            const result = normalizeTour(rawTour, {
                cityFallback: 'Troina',
                cityCenter: TROINA,
            });
            expect(result.steps).toHaveLength(1);
            expect(result.steps[0].title).toBe('Piazza Troina');
            // Cover NON è la foto Taormina scartata, è quella di Troina rimasta.
            expect(result.image).toBe('https://real-photo-troina.jpg');
            expect(result.image).not.toBe('https://real-photo-taormina.jpg');
        });

        it('cover explicit tour-level ha priorità e non viene toccata dal filtro', () => {
            const rawTour = {
                id: 'test-cover-explicit',
                title: 'Test',
                image: 'https://explicit-cover.jpg',
                isAiGenerated: true,
                city: 'Troina',
                steps: [PIAZZA_POPOLO, TAORMINA],
            };
            const result = normalizeTour(rawTour, {
                cityFallback: 'Troina',
                cityCenter: TROINA,
            });
            expect(result.steps).toHaveLength(1); // Taormina scartata
            expect(result.image).toBe('https://explicit-cover.jpg');
        });
    });

    describe('SCALATA ONESTA da 5 km → 12 km per borghi', () => {
        it('se solo 1 tappa dentro R=5, allarga a R=12 e include tappe fino a 12 km', () => {
            const NEAR_8KM = {
                title: 'Rifugio Nebrodi',
                // 8 km a nord da Troina
                latitude: TROINA.latitude + (8 / 111),
                longitude: TROINA.longitude,
                description: 'Rifugio di montagna nei Nebrodi.',
                type: 'natura',
            };
            const rawTour = {
                id: 'scalata',
                title: 'Test scalata',
                isAiGenerated: true,
                city: 'Troina',
                steps: [PIAZZA_POPOLO, NEAR_8KM, CASTELBUONO],
            };
            const result = normalizeTour(rawTour, {
                cityFallback: 'Troina',
                cityCenter: TROINA,
            });
            // Con R=5: solo Piazza (1 tappa) → scala a R=12 → Piazza + Rifugio 8 km.
            // Castelbuono a 60 km resta fuori.
            expect(result.steps).toHaveLength(2);
            expect(result.steps.map(s => s.title)).toEqual(expect.arrayContaining(['Piazza del Popolo', 'Rifugio Nebrodi']));
        });
    });

    describe('SORGENTI CHE PASSANO DAL NORMALIZER — nessun bypass', () => {
        it('normalizeTour con stops → filtra (path SurpriseTour/AiItinerary)', () => {
            const rawTour = { id: 't', title: 'x', isAiGenerated: true, city: 'Troina', stops: [PIAZZA_POPOLO, TAORMINA] };
            const result = normalizeTour(rawTour, { cityFallback: 'Troina', cityCenter: TROINA });
            expect(result.steps).toHaveLength(1);
        });

        it('normalizeTour con steps → filtra (path DashboardUser tematici e insider)', () => {
            const rawTour = { id: 't', title: 'x', isAiGenerated: true, city: 'Troina', steps: [PIAZZA_POPOLO, TAORMINA] };
            const result = normalizeTour(rawTour, { cityFallback: 'Troina', cityCenter: TROINA });
            expect(result.steps).toHaveLength(1);
        });
    });
});
