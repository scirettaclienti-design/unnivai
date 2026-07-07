// DVAI-060 — Motore Google-first: soglie qualità differenziate per tema.
//
// Ogni caso è calcato sui dati reali raccolti da textsearch Troina + Enna
// (borgo ~9k ab, città media ~26k ab). Non ipotetici.
// Vedi report P0 in chat: rating alto = filtro anti-catena su food,
// rating 4.0 permissivo su cultura per non scartare musei/chiese piccole.

import { describe, it, expect } from 'vitest';
import {
    qualityScore,
    passesHardExclusions,
    applyQualityThreshold,
    QUALITY_THRESHOLDS,
} from '../../services/placesDiscoveryService';

// ─── FIXTURE — dati REALI raccolti da textsearch Troina + Enna il 2026-07-07 ───

// Troina food (6 candidati, tutti operativi, tutti rating≥4.3)
const TROINA_FOOD = [
    { name: 'La Contea dei Normanni', rating: 4.4, user_ratings_total: 660, business_status: 'OPERATIONAL', types: ['restaurant', 'food', 'point_of_interest'] },
    { name: 'Black & White',           rating: 4.6, user_ratings_total: 364, business_status: 'OPERATIONAL', types: ['bar', 'restaurant'] },
    { name: 'Ristorante L\'Orchidea',  rating: 4.4, user_ratings_total: 341, business_status: 'OPERATIONAL', types: ['restaurant'] },
    { name: 'Pizza&Go',                rating: 4.8, user_ratings_total: 194, business_status: 'OPERATIONAL', types: ['restaurant'] },
    { name: 'Pizze&Delizie',           rating: 4.3, user_ratings_total: 57,  business_status: 'OPERATIONAL', types: ['meal_takeaway', 'restaurant'] },
    { name: 'A\'PESCHERIA',            rating: 5.0, user_ratings_total: 28,  business_status: 'OPERATIONAL', types: ['restaurant'] },
];

// Troina cultura (11 candidati) — include coda velenosa reale
const TROINA_CULTURA = [
    { name: 'Museo Robert Capa',       rating: 5.0, user_ratings_total: 209, business_status: 'OPERATIONAL', types: ['museum'] },
    { name: 'Torre Capitania',         rating: 4.8, user_ratings_total: 115, business_status: 'OPERATIONAL', types: ['museum', 'tourist_attraction'] },
    { name: 'Ruderi Monastero Nuovo',  rating: 4.7, user_ratings_total: 45,  business_status: 'OPERATIONAL', types: ['point_of_interest'] },
    { name: 'Chiesa Madre',            rating: 4.4, user_ratings_total: 16,  business_status: 'OPERATIONAL', types: ['church', 'place_of_worship'] },
    { name: 'Parrocchia Carmelo',      rating: 4.4, user_ratings_total: 14,  business_status: 'OPERATIONAL', types: ['church'] },
    { name: 'Ruderi Il Vecchio',       rating: 4.9, user_ratings_total: 8,   business_status: 'OPERATIONAL', types: ['point_of_interest'] },
    { name: 'Madonna della Catena',    rating: 4.8, user_ratings_total: 4,   business_status: 'OPERATIONAL', types: ['point_of_interest'] },
    { name: 'Chiesa Santo Rosario',    rating: 4.7, user_ratings_total: 3,   business_status: 'OPERATIONAL', types: ['church'] },
    { name: 'Church San Giorgio',      rating: 5.0, user_ratings_total: 2,   business_status: 'OPERATIONAL', types: ['church'] },
    { name: 'Cappella Confraternita',  rating: 3.0, user_ratings_total: 1,   business_status: 'OPERATIONAL', types: ['church'] },
    { name: 'Area Archeologica',       rating: 0,   user_ratings_total: 0,   business_status: 'OPERATIONAL', types: ['tourist_attraction'] },
];

// Enna food (subset per test catena)
const ENNA_FOOD_TOP = [
    { name: 'La Rustica',       rating: 4.6, user_ratings_total: 1165, business_status: 'OPERATIONAL', types: ['restaurant'] },
    { name: 'Il Mito di Kore',  rating: 4.6, user_ratings_total: 927,  business_status: 'OPERATIONAL', types: ['restaurant'] },
    { name: 'Al Carrettino',    rating: 4.2, user_ratings_total: 1467, business_status: 'OPERATIONAL', types: ['restaurant'] },
    { name: 'Burger Sicily',    rating: 4.0, user_ratings_total: 519,  business_status: 'OPERATIONAL', types: ['restaurant', 'meal_delivery'] },
    { name: 'La Tana dei Golosi',rating: 4.1, user_ratings_total: 268, business_status: 'OPERATIONAL', types: ['restaurant', 'meal_delivery'] },
];

// ─── ESCLUSIONI HARD ────────────────────────────────────────────────────────────

describe('DVAI-060 — passesHardExclusions', () => {
    it('scarta CLOSED_PERMANENTLY anche con rating alto (DVAI-057 gate)', () => {
        expect(passesHardExclusions({
            rating: 4.9, user_ratings_total: 500,
            business_status: 'CLOSED_PERMANENTLY',
            types: ['restaurant'],
        })).toBe(false);
    });

    it('scarta CLOSED_TEMPORARILY', () => {
        expect(passesHardExclusions({
            rating: 4.5, user_ratings_total: 100,
            business_status: 'CLOSED_TEMPORARILY',
            types: ['restaurant'],
        })).toBe(false);
    });

    it('accetta OPERATIONAL', () => {
        expect(passesHardExclusions({
            rating: 4.2, user_ratings_total: 50,
            business_status: 'OPERATIONAL',
            types: ['restaurant'],
        })).toBe(true);
    });

    it('scarta tipi BLACKLIST (DVAI-051): car_repair, bank, hospital, gas_station', () => {
        for (const bad of ['car_repair', 'bank', 'hospital', 'gas_station', 'pharmacy']) {
            expect(passesHardExclusions({
                rating: 4.8, user_ratings_total: 300,
                business_status: 'OPERATIONAL',
                types: [bad, 'establishment'],
            })).toBe(false);
        }
    });

    it('scarta rumore garantito: rating<3.5 e total<=2 (Cappella Confraternita 3.0/1 su Troina)', () => {
        expect(passesHardExclusions({
            name: 'Cappella Confraternita',
            rating: 3.0, user_ratings_total: 1,
            business_status: 'OPERATIONAL',
            types: ['church'],
        })).toBe(false);
    });

    it('scarta dati assenti: rating=0 e total=0 (Area Archeologica Troina)', () => {
        expect(passesHardExclusions({
            name: 'Area Archeologica',
            rating: 0, user_ratings_total: 0,
            business_status: 'OPERATIONAL',
            types: ['tourist_attraction'],
        })).toBe(false);
    });

    it('accetta 5⭐ con solo 2 recensioni (Church San Giorgio Troina) — non è rumore hard', () => {
        // La soglia qualità (livello 1) scarta questo per total<3, ma le
        // esclusioni HARD non lo tagliano perché rating 5 non è rumore.
        expect(passesHardExclusions({
            name: 'Church San Giorgio',
            rating: 5.0, user_ratings_total: 2,
            business_status: 'OPERATIONAL',
            types: ['church'],
        })).toBe(true);
    });
});

// ─── qualityScore ───────────────────────────────────────────────────────────────

describe('DVAI-060 — qualityScore = rating × ln(1+total)', () => {
    it('ordina Troina food come atteso dai dati reali', () => {
        const sorted = [...TROINA_FOOD].sort((a, b) => qualityScore(b) - qualityScore(a));
        expect(sorted[0].name).toBe('La Contea dei Normanni'); // 4.4 × ln(661) ≈ 28.6
        expect(sorted[sorted.length - 1].name).toBe('A\'PESCHERIA'); // 5.0 × ln(29) ≈ 16.8
    });

    it('privilegia rating alto senza dimenticare popolarità', () => {
        const chicca = { rating: 4.9, user_ratings_total: 8 };    // Ruderi Il Vecchio
        const solido = { rating: 4.4, user_ratings_total: 341 };  // L'Orchidea
        // Il solido con volume vince sulla chicca — è l'ordinamento voluto:
        // prima i validati dal volume, poi le perle.
        expect(qualityScore(solido)).toBeGreaterThan(qualityScore(chicca));
    });
});

// ─── SOGLIE differenziate — FOOD borgo ──────────────────────────────────────────

describe('DVAI-060 — applyQualityThreshold FOOD borgo (4.2 / 3)', () => {
    it('Troina food: passano 6/6 (tutti ≥4.3 con ≥28 recensioni)', () => {
        const { pois, scaleLevel } = applyQualityThreshold(TROINA_FOOD, 'FOOD', true);
        expect(pois.length).toBe(6);
        expect(scaleLevel).toBe(1);
    });
});

// ─── SOGLIE — FOOD città (anti-catena implicito) ────────────────────────────────

describe('DVAI-060 — applyQualityThreshold FOOD città (4.2 / 50)', () => {
    it('Enna food: scarta Burger Sicily (4.0/519) — soglia rating è anti-catena', () => {
        const { pois } = applyQualityThreshold(ENNA_FOOD_TOP, 'FOOD', false);
        const names = pois.map(p => p.name);
        expect(names).not.toContain('Burger Sicily');
        expect(names).toContain('La Rustica');
        expect(names).toContain('Il Mito di Kore');
        expect(names).toContain('Al Carrettino');
    });

    it('Enna food: scarta anche La Tana dei Golosi (4.1/268) — rating<4.2', () => {
        const { pois } = applyQualityThreshold(ENNA_FOOD_TOP, 'FOOD', false);
        expect(pois.map(p => p.name)).not.toContain('La Tana dei Golosi');
    });
});

// ─── SOGLIE — CULTURA borgo (4.0/3, più permissiva del food) ────────────────────

describe('DVAI-060 — applyQualityThreshold CULTURA borgo (4.0 / 3)', () => {
    it('Troina cultura: passano i primi 8 candidati puliti (esclusi 3 di coda)', () => {
        // Nota: la funzione qui NON applica passesHardExclusions — quello va
        // prima. Simulo la pipeline completa.
        const cleaned = TROINA_CULTURA.filter(passesHardExclusions);
        const { pois, scaleLevel } = applyQualityThreshold(cleaned, 'CULTURA', true);
        expect(scaleLevel).toBe(1);
        // Livello 1 CULTURA borgo (4.0/3): passano tutti quelli con rating≥4.0
        // E total≥3. Church San Giorgio 5.0/2 è total<3 → non passa qui.
        // Ma passesHardExclusions lo tiene: viene scartato solo dalla soglia.
        const names = pois.map(p => p.name);
        expect(names).toContain('Museo Robert Capa');
        expect(names).toContain('Chiesa Madre');
        expect(names).toContain('Ruderi Il Vecchio');
        expect(names).toContain('Chiesa Santo Rosario');  // 4.7/3 al bordo, passa
        expect(names).not.toContain('Church San Giorgio'); // 5.0/2, total<3
        expect(names).not.toContain('Cappella Confraternita'); // già escluso hard
        expect(names).not.toContain('Area Archeologica');       // già escluso hard
    });

    it('CULTURA soglia 4.0 accetta il Regional Museum caso Enna (4.1/44)', () => {
        // Un museo pubblico con rating 4.1 e 44 recensioni verrebbe scartato
        // dalla soglia FOOD (4.2) ma passa CULTURA (4.0). Regola-chiave.
        const { pois } = applyQualityThreshold(
            [{ name: 'Regional Museum', rating: 4.1, user_ratings_total: 44, business_status: 'OPERATIONAL', types: ['museum'] }],
            'CULTURA',
            false,
        );
        expect(pois.length).toBe(1);
    });
});

// ─── SCALE-DOWN progressivo ─────────────────────────────────────────────────────

describe('DVAI-060 — scale-down progressivo (borghi micro con pochi POI)', () => {
    it('livello 2 attiva se meno di 3 passano livello 1', () => {
        // Solo 1 candidato passa il livello 1, 2 al livello 2.
        const set = [
            { rating: 4.5, user_ratings_total: 10, business_status: 'OPERATIONAL', types: ['restaurant'] }, // L1 ok
            { rating: 3.9, user_ratings_total: 5,  business_status: 'OPERATIONAL', types: ['restaurant'] }, // L2 ok
            { rating: 3.8, user_ratings_total: 2,  business_status: 'OPERATIONAL', types: ['restaurant'] }, // L2 ok
        ];
        const { scaleLevel, pois } = applyQualityThreshold(set, 'FOOD', true);
        expect(scaleLevel).toBe(2);
        expect(pois.length).toBe(3);
    });

    it('livello 3 (permissivo) se anche livello 2 fallisce', () => {
        const set = [
            { rating: 3.6, user_ratings_total: 0, business_status: 'OPERATIONAL', types: ['restaurant'] },
        ];
        const { scaleLevel, pois } = applyQualityThreshold(set, 'FOOD', true);
        expect(scaleLevel).toBe(3);
        expect(pois.length).toBe(1);
    });
});

// ─── CONFIG THRESHOLDS ──────────────────────────────────────────────────────────

describe('DVAI-060 — QUALITY_THRESHOLDS shape', () => {
    it('food/cultura/natura definiti con small e large', () => {
        for (const kind of ['FOOD', 'CULTURA', 'NATURA']) {
            expect(QUALITY_THRESHOLDS[kind]).toBeDefined();
            expect(QUALITY_THRESHOLDS[kind].small).toMatchObject({ minRating: expect.any(Number), minTotal: expect.any(Number) });
            expect(QUALITY_THRESHOLDS[kind].large).toMatchObject({ minRating: expect.any(Number), minTotal: expect.any(Number) });
        }
    });

    it('food ha soglia rating più alta di cultura (anti-catena)', () => {
        expect(QUALITY_THRESHOLDS.FOOD.small.minRating).toBeGreaterThanOrEqual(QUALITY_THRESHOLDS.CULTURA.small.minRating);
        expect(QUALITY_THRESHOLDS.FOOD.large.minRating).toBeGreaterThanOrEqual(QUALITY_THRESHOLDS.CULTURA.large.minRating);
    });

    it('città ha soglia total più alta di borgo per lo stesso tema', () => {
        for (const kind of ['FOOD', 'CULTURA', 'NATURA']) {
            expect(QUALITY_THRESHOLDS[kind].large.minTotal).toBeGreaterThan(QUALITY_THRESHOLDS[kind].small.minTotal);
        }
    });
});
