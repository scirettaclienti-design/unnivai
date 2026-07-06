// DVAI-055 — Test del vincolo geografico "tappe entro raggio città".
// Scenario canonico Ivano: utente a Troina, l'AI aveva prodotto una tappa a
// Taormina (~97 km). Il filtro Haversine deve scartarla.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { haversineKm, applyRadiusFilter, isSmallTown } from '../../services/aiRecommendationService';

// Centro di Troina (Sicilia, borgo ~9k abitanti).
const TROINA = { latitude: 37.7869, longitude: 14.6018 };

// Piazza del Popolo Troina — stessa città, ~0.1 km dal centro.
const PIAZZA_TROINA = { title: 'Piazza del Popolo', latitude: 37.7864, longitude: 14.6021 };

// Taormina — ~97 km da Troina. Comune diverso.
const TAORMINA = { title: 'Taormina', latitude: 37.8516, longitude: 15.2853 };

// Enna — capoluogo a ~35 km da Troina. Comune diverso, ma sotto la soglia allargata (12 km) no.
const ENNA = { title: 'Enna', latitude: 37.5646, longitude: 14.2795 };

// Un secondo POI dentro Troina, ~1 km dal centro.
const MADRICE_TROINA = { title: 'Chiesa Madre', latitude: 37.7910, longitude: 14.5960 };

describe('DVAI-055 — haversineKm', () => {
    it('ritorna ~0 per lo stesso punto', () => {
        expect(haversineKm(TROINA.latitude, TROINA.longitude, TROINA.latitude, TROINA.longitude))
            .toBeLessThan(0.01);
    });

    it('calcola Troina → Taormina come ~60 km linea d\'aria (il "97 km" del ticket è distanza stradale, non geodetica)', () => {
        const d = haversineKm(TROINA.latitude, TROINA.longitude, TAORMINA.latitude, TAORMINA.longitude);
        // Linea d'aria: ~60 km. Comunque > R=5 di un borgo → viene scartato.
        expect(d).toBeGreaterThan(55);
        expect(d).toBeLessThan(65);
    });

    it('calcola Troina → Enna come ~35 km (±5)', () => {
        const d = haversineKm(TROINA.latitude, TROINA.longitude, ENNA.latitude, ENNA.longitude);
        expect(d).toBeGreaterThan(30);
        expect(d).toBeLessThan(40);
    });

    it('è simmetrica: A→B == B→A', () => {
        const dAB = haversineKm(TROINA.latitude, TROINA.longitude, TAORMINA.latitude, TAORMINA.longitude);
        const dBA = haversineKm(TAORMINA.latitude, TAORMINA.longitude, TROINA.latitude, TROINA.longitude);
        expect(dAB).toBeCloseTo(dBA, 5);
    });
});

describe('DVAI-055 — isSmallTown', () => {
    it('classifica Troina come borgo (non top-30)', () => {
        expect(isSmallTown('Troina')).toBe(true);
    });

    it('classifica Roma come NON borgo', () => {
        expect(isSmallTown('Roma')).toBe(false);
    });

    it('case-insensitive: MILANO ≡ milano', () => {
        expect(isSmallTown('MILANO')).toBe(false);
        expect(isSmallTown('milano')).toBe(false);
    });

    it('gestisce spazi/undefined', () => {
        expect(isSmallTown(undefined)).toBe(true);
        expect(isSmallTown('  Firenze  ')).toBe(false);
    });
});

describe('DVAI-055 — applyRadiusFilter', () => {
    let warnSpy;

    beforeEach(() => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    it('SCENARIO CANONICO — Troina + Taormina: la tappa a 97 km viene scartata', () => {
        const stops = [PIAZZA_TROINA, MADRICE_TROINA, TAORMINA];
        const result = applyRadiusFilter(stops, TROINA, 'Troina');
        // 3 tappe entrano, 2 restano (Piazza + Chiesa Madre). Taormina scartata.
        expect(result).toHaveLength(2);
        expect(result.map(s => s.title)).toEqual(['Piazza del Popolo', 'Chiesa Madre']);
        expect(result.map(s => s.title)).not.toContain('Taormina');
    });

    it('senza cityCenter → non filtra (retrocompat)', () => {
        const stops = [PIAZZA_TROINA, TAORMINA];
        const result = applyRadiusFilter(stops, null, 'Troina');
        expect(result).toHaveLength(2);
    });

    it('cityCenter con lat/lng non finiti → non filtra', () => {
        const stops = [PIAZZA_TROINA, TAORMINA];
        const result = applyRadiusFilter(stops, { latitude: NaN, longitude: NaN }, 'Troina');
        expect(result).toHaveLength(2);
    });

    it('borgo, R=5km: 2 tappe dentro passano, 1 fuori scartata', () => {
        const stops = [PIAZZA_TROINA, MADRICE_TROINA, TAORMINA];
        const result = applyRadiusFilter(stops, TROINA, 'Troina');
        expect(result).toHaveLength(2);
    });

    it('borgo: se <2 tappe dopo R=5km, allarga a R=12km (Enna a ~35 km resta fuori)', () => {
        // Solo 1 tappa vicina + Enna (35 km) + Taormina (97 km).
        // Con R=5 → 1 tappa dentro. Allarga a R=12 → ancora 1 (Enna oltre 12, Taormina oltre).
        const stops = [PIAZZA_TROINA, ENNA, TAORMINA];
        const result = applyRadiusFilter(stops, TROINA, 'Troina');
        // Dopo scalata: 1 tappa (solo Piazza). Il filtro non "gonfia" magicamente.
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Piazza del Popolo');
    });

    it('borgo: se allargamento sblocca una tappa entro 12 km, viene inclusa', () => {
        // POI a 8 km da Troina — fuori R=5 ma dentro R=12.
        const NEARBY_8KM = { title: 'Rifugio Monte', latitude: 37.7869 + (8 / 111), longitude: 14.6018 };
        // Solo 1 dentro R=5 + il nearby a 8 km. Con R=5 → 1 tappa → scala a R=12 → 2 tappe.
        const stops = [PIAZZA_TROINA, NEARBY_8KM];
        const result = applyRadiusFilter(stops, TROINA, 'Troina');
        expect(result).toHaveLength(2);
        expect(result.map(s => s.title)).toContain('Rifugio Monte');
    });

    it('città grande (Roma): R=10km, il filtro usa la soglia maggiore', () => {
        const ROMA = { latitude: 41.9028, longitude: 12.4964 };
        // 2 POI dentro R=10 (~3 e ~8 km) evitano la scalata onesta a R=20,
        // così testiamo davvero il valore iniziale R=10 per città non-borgo.
        const AT_3KM = { title: 'Colosseo', latitude: 41.9028 + (3 / 111), longitude: 12.4964 };
        const AT_8KM = { title: 'Via Appia', latitude: 41.9028 + (8 / 111), longitude: 12.4964 };
        // POI a 12 km → oltre R=10, va scartato.
        const AT_12KM = { title: 'Ostia', latitude: 41.9028 + (12 / 111), longitude: 12.4964 };
        const result = applyRadiusFilter([AT_3KM, AT_8KM, AT_12KM], ROMA, 'Roma');
        expect(result).toHaveLength(2);
        expect(result.map(s => s.title)).toEqual(['Colosseo', 'Via Appia']);
        expect(result.map(s => s.title)).not.toContain('Ostia');
    });

    it('rispetta radiusKm esplicito quando fornito (override)', () => {
        // Con R=50 forzato, Enna (35 km) passa
        const stops = [PIAZZA_TROINA, ENNA];
        const result = applyRadiusFilter(stops, { ...TROINA, radiusKm: 50 }, 'Troina');
        expect(result).toHaveLength(2);
    });

    it('rawStops vuoto → risultato vuoto (non crasha)', () => {
        expect(applyRadiusFilter([], TROINA, 'Troina')).toEqual([]);
    });

    it('non muta l\'array originale', () => {
        const stops = [PIAZZA_TROINA, TAORMINA];
        applyRadiusFilter(stops, TROINA, 'Troina');
        expect(stops).toHaveLength(2);
    });
});
