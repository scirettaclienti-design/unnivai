import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// P7a — DNA onesto.
//   1. Il DNA impara dalle azioni che contano (completato +0,3, salvato +0,2,
//      valutato ±0,3, "Dettagli" +0,05, "Rigenera giorno" e tappa saltata
//      −0,1), con la categoria VERA delle tappe (types Google).
//   2. Niente normalizzazione sul massimo: un clic non diventa 100%.
//   3. Fiducia = numero di eventi con categoria. Peso del DNA nel punteggio:
//      0 sotto 5 eventi (semi: al massimo 15%), poi lineare fino a 45% a 20.
//   4. "Per Te": insider col punteggio di Gate MERITO, dedup fra temi che non
//      premia il piu' recensito, luogo ceduto accettato nell'insider se
//      libero, niente tour con meno di 3 tappe.
//   5. Ovvieta': quante tappe stanno nel 10% piu' recensito dei candidati.

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

import { useAILearning } from '../../hooks/useAILearning';
import {
    computeWeights, computeDnaShare, applyDnaEvent, mapTypeToCoreCategory,
    stopCoreCategory, tourCoreCategories, weightsToAIProfile, DNA_EVENT_WEIGHTS,
} from '../../services/preferenceEngine';
import { computeCandidateScore, obviousnessReport } from '../../services/candidateScoring';
import { aiRecommendationService, buildInsiderPool, prepareHomePools } from '../../services/aiRecommendationService';
import { dedupePOIsAcrossThemes } from '../../services/placesDiscoveryService';

const SEED_KEY = 'unnivai_onboarding_seed_v1';

beforeEach(() => {
    vi.clearAllMocks();
    try { window.localStorage.clear(); } catch { /* jsdom */ }
});
afterEach(() => {
    vi.unstubAllGlobals();
});

// ─── 1–2. Un clic non e' una preferenza al 100% ─────────────────────────────
describe('P7a — un clic su un ristorante non porta "food" a 1,0', () => {
    it('"Dettagli" di un ristorante → food 0,05, non 1,0', () => {
        const { result } = renderHook(() => useAILearning());
        act(() => { result.current.trackDnaEvent('stop_detail', [{ title: 'Da Enzo', types: ['restaurant', 'food', 'point_of_interest'], type: 'restaurant' }]); });
        expect(result.current.weights.food).toBe(0.05);
        expect(result.current.weights.food).not.toBe(1);
    });

    it('anche il vecchio clic (trackInteraction con la categoria) non porta food a 1,0', () => {
        const { result } = renderHook(() => useAILearning());
        act(() => { result.current.trackInteraction('stop_detail_view', { category: 'restaurant', city: 'Roma' }); });
        expect(result.current.weights.food).toBeLessThan(1);
    });

    it('un solo clic non accende il DNA: fiducia 0, nessun profilo al modello', () => {
        const { result } = renderHook(() => useAILearning());
        act(() => { result.current.trackDnaEvent('stop_detail', [{ types: ['restaurant'] }]); });
        expect(result.current.dnaShare).toBe(0);
        expect(result.current.getAIContext()).toBe('');
    });
});

// ─── 3. Fiducia ─────────────────────────────────────────────────────────────
describe('P7a — il DNA pesa in proporzione a quanto sa', () => {
    const conEventi = (n) => ({ 'dna:events': n, 'dna:cultura': 0.3 });

    it('meno di 5 eventi → il DNA pesa 0', () => {
        for (const n of [0, 1, 4]) expect(computeDnaShare(conEventi(n))).toBe(0);
    });

    it('solo i semi del primo accesso → al massimo 15%', () => {
        expect(computeDnaShare({}, ['food', 'arte'])).toBe(0.15);
        expect(computeDnaShare(conEventi(3), ['food'])).toBe(0.15);
    });

    it('lineare da 5 eventi (0) a 20 eventi (45%), poi fermo', () => {
        expect(computeDnaShare(conEventi(5))).toBe(0);
        expect(computeDnaShare(conEventi(10))).toBe(0.15);
        expect(computeDnaShare(conEventi(20))).toBe(0.45);
        expect(computeDnaShare(conEventi(80))).toBe(0.45);
    });

    it('con fiducia 0 l\'affinita\' non conta nel punteggio dei candidati', () => {
        const museo = { place_id: 'm', types: ['museum'], rating: 4.5, user_ratings_total: 300 };
        const bar = { place_id: 'b', types: ['bar'], rating: 4.5, user_ratings_total: 300 };
        const pool = [museo, bar];
        const pesi = { cultura: 1, _share: 0 };
        expect(computeCandidateScore(museo, pool, pesi)).toBe(computeCandidateScore(bar, pool, pesi));
        expect(computeCandidateScore(museo, pool, { cultura: 1, _share: 0.45 }))
            .toBeGreaterThan(computeCandidateScore(bar, pool, { cultura: 1, _share: 0.45 }));
    });

    it('nel hook: 5 tour completati accendono il DNA, 4 no', () => {
        const { result } = renderHook(() => useAILearning());
        const tappe = [{ types: ['museum'] }];
        for (let i = 0; i < 4; i++) act(() => { result.current.trackDnaEvent('tour_completed', tappe); });
        expect(result.current.dnaEvents).toBe(4);
        expect(result.current.dnaShare).toBe(0);
        act(() => { result.current.trackDnaEvent('tour_completed', tappe); });
        expect(result.current.dnaEvents).toBe(5);
        expect(result.current.dnaShare).toBe(0);
        for (let i = 0; i < 5; i++) act(() => { result.current.trackDnaEvent('tour_completed', tappe); });
        expect(result.current.dnaShare).toBe(0.15);
        expect(result.current.dnaWeights._share).toBe(0.15);
    });
});

// ─── 1. Eventi con la categoria vera delle tappe ────────────────────────────
describe('P7a — un tour completato aggiunge +0,3 alle categorie reali delle sue tappe', () => {
    const TAPPE = [
        { title: 'Palazzo Massimo', types: ['museum', 'tourist_attraction', 'point_of_interest'], type: 'museum' },
        { title: 'Al Gallinaccio', types: ['restaurant', 'bar', 'food'], type: 'restaurant' },
        { title: 'Giardino degli Aranci', types: ['park', 'tourist_attraction'], type: 'park' },
        { title: 'Santa Prassede', types: ['church', 'place_of_worship'], type: 'church' },
    ];

    it('completato → cultura, food, natura +0,3 ciascuna (una volta per categoria); nightlife no', () => {
        const { result } = renderHook(() => useAILearning());
        act(() => { result.current.trackDnaEvent('tour_completed', TAPPE); });
        expect(result.current.weights).toMatchObject({ cultura: 0.3, food: 0.3, natura: 0.3, nightlife: 0, arte: 0 });
        expect(result.current.dnaEvents).toBe(1);
    });

    it('i pesi degli eventi sono quelli chiesti', () => {
        expect(DNA_EVENT_WEIGHTS).toEqual({
            tour_completed: 0.3, tour_saved: 0.2, tour_rated: 0.3,
            stop_detail: 0.05, regenerate_day: -0.1, stop_skipped: -0.1,
        });
    });

    it('salvato +0,2; valutato 5 → +0,3, valutato 1 → −0,3, valutato 3 → nessun evento', () => {
        let g = applyDnaEvent({}, 'tour_saved', ['cultura']);
        expect(computeWeights(g).cultura).toBe(0.2);
        g = applyDnaEvent(g, 'tour_rated', ['cultura'], { rating: 5 });
        expect(computeWeights(g).cultura).toBe(0.5);
        g = applyDnaEvent(g, 'tour_rated', ['cultura'], { rating: 1 });
        expect(computeWeights(g).cultura).toBe(0.2);
        const prima = g;
        expect(applyDnaEvent(g, 'tour_rated', ['cultura'], { rating: 3 })).toBe(prima);
    });

    it('"Rigenera giorno" → −0,1 alle categorie del giorno scartato, mai sotto 0', () => {
        let g = applyDnaEvent({}, 'tour_completed', ['food']);
        g = applyDnaEvent(g, 'regenerate_day', ['food', 'natura']);
        expect(computeWeights(g)).toMatchObject({ food: 0.2, natura: 0 });
        expect(g['dna:events']).toBe(2);
    });

    it('tappe senza categoria → nessun evento inventato', () => {
        expect(applyDnaEvent({}, 'tour_completed', [])).toEqual({});
        expect(tourCoreCategories([{ title: 'senza tipi' }])).toEqual([]);
    });
});

// ─── Mappa esplicita dei tipi ───────────────────────────────────────────────
describe('P7a — mappa dei tipi Google sulle 8 categorie', () => {
    it('"museum" e "tourist_attraction" sono mappati', () => {
        expect(mapTypeToCoreCategory('museum')).toBe('cultura');
        expect(mapTypeToCoreCategory('tourist_attraction')).toBe('cultura');
    });

    // I tipi che le tappe portano davvero: types Google comuni + i tipi interni
    // a sei valori (museum/church/park/restaurant/monument/place).
    const COMUNI = {
        museum: 'cultura', church: 'cultura', place_of_worship: 'cultura', monument: 'cultura',
        historical_landmark: 'cultura', tourist_attraction: 'cultura', place: 'cultura', castle: 'cultura',
        art_gallery: 'arte', performing_arts_theater: 'arte',
        restaurant: 'food', cafe: 'food', bakery: 'food', meal_takeaway: 'food', ice_cream_shop: 'food', food: 'food',
        bar: 'nightlife', night_club: 'nightlife',
        park: 'natura', natural_feature: 'natura', beach: 'natura', campground: 'natura',
        amusement_park: 'avventura', zoo: 'avventura', aquarium: 'avventura',
        store: 'shopping', shopping_mall: 'shopping', clothing_store: 'shopping', book_store: 'shopping',
        spa: 'relax',
    };

    it('nessun tipo comune finisce a peso 0 (senza categoria)', () => {
        for (const [tipo, cat] of Object.entries(COMUNI)) {
            expect(mapTypeToCoreCategory(tipo), tipo).toBe(cat);
        }
    });

    it('una tappa: vince il tipo specifico, non quello generico', () => {
        expect(stopCoreCategory({ types: ['tourist_attraction', 'museum'] })).toBe('cultura');
        expect(stopCoreCategory({ types: ['bar', 'restaurant'] })).toBe('food');
        expect(stopCoreCategory({ types: ['park', 'tourist_attraction'] })).toBe('natura');
        expect(stopCoreCategory({ types: ['art_gallery', 'museum'] })).toBe('arte');
        // Solo tipi generici: e' un luogo → cultura.
        expect(stopCoreCategory({ types: ['point_of_interest', 'establishment'] })).toBe('cultura');
        // Senza types: il tipo interno.
        expect(stopCoreCategory({ type: 'monument' })).toBe('cultura');
        expect(stopCoreCategory({ type: 'restaurant' })).toBe('food');
    });
});

// ─── "Rigenera giorno" passa il DNA ─────────────────────────────────────────
describe('P7a — "Rigenera giorno" passa il DNA come le altre sezioni', () => {
    const src = readFileSync(resolve(__dirname, '../../pages/AiItinerary.jsx'), 'utf8');
    const body = src.slice(src.indexOf('const regenerateDay = async'));
    const regen = body.slice(0, body.indexOf('setGeneratedItinerary(prev =>'));

    it('profilo AI e pesi del DNA nella chiamata, non piu\' \'\' e niente', () => {
        expect(regen).toMatch(/getAIContext\?\.\(\)/);
        expect(regen).toMatch(/dnaWeights:\s*dnaShare > 0 \? dnaWeights : \{\}/);
    });

    it('e il giorno scartato insegna −0,1 al DNA', () => {
        expect(regen).toMatch(/trackDnaEvent\?\.\('regenerate_day'/);
    });

    it('il profilo non arriva al modello senza fiducia', () => {
        expect(weightsToAIProfile({ food: 0.9, _share: 0 })).toBe('');
        expect(weightsToAIProfile({ food: 0.9, _share: 0.2 })).toContain('food');
    });
});

// ─── 4. "Per Te" ────────────────────────────────────────────────────────────
const CITY = 'Roma';
const CENTER = { latitude: 41.9028, longitude: 12.4964 };
const near = (km) => ({ latitude: CENTER.latitude + km * 0.009, longitude: CENTER.longitude });
const poi = (id, name, km, extra = {}) => ({
    place_id: id, name, ...near(km), rating: 4.5, user_ratings_total: 500, types: ['tourist_attraction'], city: CITY, ...extra,
});
const stop = (place_id) => ({ place_id, description: `Dentro ${place_id} la pietra e' fresca.`, insiderTip: 'Entra dal lato.', transition: 'Si scende per una scala.' });
const proxyFetch = (payload) => vi.fn(async (url) => {
    if (String(url).includes('openai-proxy')) {
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) }, finish_reason: 'stop' }], usage: { completion_tokens: 900 } }) };
    }
    throw new Error(`fetch inatteso: ${url}`);
});
const home = (themedCandidates) => aiRecommendationService.generateHomeTours({
    city: CITY, cityCenter: CENTER, themedCandidates, opts: { skipUserQuota: true },
});

describe('P7a — "Per Te": l\'insider con il punteggio di Gate MERITO', () => {
    it('a parita\' di voto l\'insider sceglie il luogo meno recensito', () => {
        const famoso = poi('famoso', 'Musei Capitolini', 1, { rating: 4.7, user_ratings_total: 40000, types: ['museum'] });
        const raro = poi('raro', 'Museo Barracco', 1.2, { rating: 4.7, user_ratings_total: 900, types: ['museum'] });
        const altri = [poi('a', 'A', 2, { user_ratings_total: 2000 }), poi('b', 'B', 2.2, { user_ratings_total: 3000 })];
        const insider = buildInsiderPool({ cultura: [famoso, ...altri, raro] }, CENTER, CITY);
        const ids = insider.map(p => p.place_id);
        expect(ids.indexOf('raro')).toBeLessThan(ids.indexOf('famoso'));
        expect(ids[0]).toBe('raro');
    });

    it('al massimo un\'icona (decimo piu\' recensito) nell\'insider', () => {
        // 12 candidati → il decimo superiore sono 2: proprio le due icone.
        const pool = Array.from({ length: 10 }, (_, i) => poi(`p${i}`, `P${i}`, 1 + i * 0.1, { user_ratings_total: 100 + i * 10 }));
        pool.push(poi('icona1', 'Pantheon', 1, { user_ratings_total: 200000 }));
        pool.push(poi('icona2', 'Fontana di Trevi', 1, { user_ratings_total: 300000 }));
        // Insider grande quanto il pool: senza tetto entrerebbero tutte e due.
        const ids = buildInsiderPool({ cultura: pool }, CENTER, CITY, 30).map(p => p.place_id);
        expect(ids).toHaveLength(11);
        expect(ids.filter(id => id.startsWith('icona'))).toHaveLength(1);
    });
});

describe('P7a — "Per Te": la dedup fra temi non premia il piu\' recensito', () => {
    it('dentro il tema resta l\'ordine della ricerca, non quello delle recensioni', () => {
        const piccolo = poi('piccolo', 'Trattoria di quartiere', 1, { user_ratings_total: 80 });
        const grande = poi('grande', 'Roscioli', 1, { user_ratings_total: 9000 });
        const out = dedupePOIsAcrossThemes({ food: [piccolo, grande], cultura: [] });
        expect(out.food.map(p => p.place_id)).toEqual(['piccolo', 'grande']);
    });

    it('un luogo in due temi resta al primo tema che lo trova', () => {
        const x = poi('x', 'Mercato', 1, { user_ratings_total: 9000 });
        const out = dedupePOIsAcrossThemes({ food: [x], cultura: [{ ...x, rating: 4.9 }] });
        expect(out.food.map(p => p.place_id)).toEqual(['x']);
        expect(out.cultura).toEqual([]);
    });
});

describe('P7a — "Per Te": tour con meno di 3 tappe e luogo ceduto', () => {
    const CULTURA = [poi('c1', 'Pantheon', 0.5), poi('c2', 'San Clemente', 2), poi('c3', 'Santa Prassede', 2.2), poi('c4', 'Palazzo Massimo', 2.4)];
    const FOOD = [poi('f1', 'Da Enzo', 1), poi('f2', 'Armando', 2), poi('f3', 'Roscioli', 1.5)];
    const INSIDER = [poi('c1', 'Pantheon', 0.5), poi('i1', 'Museo Barracco', 1), poi('i2', 'Casa di Goethe', 1.1), poi('i3', 'Cripta dei Cappuccini', 1.3)];

    it('un tour "Per Te" con 2 tappe non viene mostrato', async () => {
        vi.stubGlobal('fetch', proxyFetch({ tours: [
            { themeType: 'cultura', title: 'Cultura', stops: [stop('c1'), stop('c2'), stop('c3')] },
            { themeType: 'food', title: 'Food', stops: [stop('f1'), stop('f2')] },
        ] }));
        const res = await home({ cultura: CULTURA, food: FOOD });
        expect(res.tours.map(t => t.themeType)).toEqual(['cultura']);
        expect(res._report.scarti.filter(s => /meno di 3 tappe/.test(s.motivo))).toHaveLength(2);
    });

    it('prepareHomePools: c1 resta a "cultura" (le servono le tappe) e viene segnato come ceduto', () => {
        const pools = prepareHomePools({ insider: INSIDER, cultura: CULTURA }, CENTER, CITY);
        expect(pools.insider.map(p => p.place_id)).not.toContain('c1');
        expect(pools.cultura.map(p => p.place_id)).toContain('c1');
        expect([...pools.ceduti.keys()]).toEqual(['c1']);
        expect(Object.keys(pools)).toEqual(['insider', 'cultura']);
    });

    it('il luogo ceduto viene accettato nell\'insider se nessun altro tour lo usa', async () => {
        vi.stubGlobal('fetch', proxyFetch({ tours: [
            { themeType: 'insider', title: 'Insider', stops: [stop('c1'), stop('i1'), stop('i2')] },
            { themeType: 'cultura', title: 'Cultura', stops: [stop('c2'), stop('c3'), stop('c4')] },
        ] }));
        const res = await home({ insider: INSIDER, cultura: CULTURA });
        const insider = res.tours.find(t => t.themeType === 'insider');
        expect(insider.stops.map(s => s.place_id)).toContain('c1');
        expect(res._report.cedutiAccettati).toEqual(['c1']);
        expect(res._report.scarti).toEqual([]);
    });

    it('…ma se un altro tour lo usa, all\'insider no', async () => {
        vi.stubGlobal('fetch', proxyFetch({ tours: [
            { themeType: 'insider', title: 'Insider', stops: [stop('c1'), stop('i1'), stop('i2'), stop('i3')] },
            { themeType: 'cultura', title: 'Cultura', stops: [stop('c1'), stop('c2'), stop('c3')] },
        ] }));
        const res = await home({ insider: INSIDER, cultura: CULTURA });
        expect(res.tours.find(t => t.themeType === 'insider').stops.map(s => s.place_id)).not.toContain('c1');
        expect(res.tours.find(t => t.themeType === 'cultura').stops.map(s => s.place_id)).toContain('c1');
        expect(res._report.cedutiAccettati).toEqual([]);
    });
});

// ─── 5. Ovvieta' ────────────────────────────────────────────────────────────
describe('P7a — ovvieta\': tappe nel 10% piu\' recensito dei candidati', () => {
    it('conta le tappe che stanno nel decimo superiore per recensioni', () => {
        const candidati = Array.from({ length: 20 }, (_, i) => ({ place_id: `p${i}`, name: `P${i}`, user_ratings_total: (i + 1) * 100 }));
        // decimo superiore di 20 = 2 candidati: p18 (1900) e p19 (2000)
        const r = obviousnessReport([{ place_id: 'p19', title: 'P19' }, { place_id: 'p3', title: 'P3' }, { place_id: 'p18', title: 'P18' }], candidati);
        expect(r).toMatchObject({ tappe: 3, nelTop10: 2, candidati: 20, sogliaRecensioni: 1800 });
        expect(r.ovvie).toEqual(['P19', 'P18']);
    });

    it('il resoconto "Per Te" porta l\'ovvieta\'', async () => {
        const CULTURA = [poi('c1', 'Pantheon', 0.5, { user_ratings_total: 90000 }), poi('c2', 'San Clemente', 2, { user_ratings_total: 300 }), poi('c3', 'Santa Prassede', 2.2, { user_ratings_total: 200 })];
        vi.stubGlobal('fetch', proxyFetch({ tours: [{ themeType: 'cultura', title: 'Cultura', stops: [stop('c1'), stop('c2'), stop('c3')] }] }));
        const res = await home({ cultura: CULTURA });
        expect(res._report.ovvieta).toMatchObject({ tappe: 3, nelTop10: 1, ovvie: ['Pantheon'] });
    });
});
