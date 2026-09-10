// Gate RAGGIO-CATEGORIA — la categoria richiesta come vincolo di CODICE.
//
// Caso reale, Cabras, richiesta "le spiagge piu' belle":
//   1. il traduttore produce queries=["spiagge","lidi","cale"] categoria=natura
//      — corretto, misurato dal vivo;
//   2. "spiagge Cabras" torna 20/20 spiagge vere, ma "lidi"/"cale" tornano
//      ristoranti del paese ("lido" e' un nome comune di ristorante da spiaggia,
//      "cale" fa match debole su esercizi generici). Rumore lessicale della
//      ricerca testuale, non un bug del traduttore;
//   3. le spiagge stanno a 9-12 km (Cabras e' nell'entroterra), i ristoranti a
//      0.1-2.8 km. Con R=5 km sopravvivevano 10 candidati — tutti ristoranti —
//      e 10 >= 2, quindi il widen a 12 km non scattava MAI;
//   4. il selettore riceveva un pool di soli ristoranti e restituiva 3
//      ristoranti, ignorando l'istruzione testuale "categoria: natura, NON
//      aggiungere ristoranti" — non avendo altro fra cui scegliere.
//
// Il fix ha due metA: `countForWiden` (il widen conta solo le tappe pertinenti)
// e il filtro deterministico prima del selettore. Questi test provano che la
// garanzia sta nel codice, non nell'istruzione del prompt: si verifica cosa
// ARRIVA al selettore, non cosa il selettore risponde.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    aiRecommendationService,
    candidateMatchesIntentCategoria,
} from '../../services/aiRecommendationService';

// ─── candidateMatchesIntentCategoria ──────────────────────────────────────────

describe('Gate RAGGIO-CATEGORIA — candidateMatchesIntentCategoria', () => {
    it('spiaggia con natural_feature + categoria "natura" → ammessa', () => {
        expect(candidateMatchesIntentCategoria(
            { types: ['establishment', 'natural_feature'] }, 'natura',
        )).toBe(true);
    });

    it('ristorante + categoria "natura" → NON ammesso', () => {
        expect(candidateMatchesIntentCategoria(
            { types: ['establishment', 'food', 'point_of_interest', 'restaurant'] }, 'natura',
        )).toBe(false);
    });

    it('SOLO types generici + categoria "natura" → ammesso (caso "Spiaggia di Maimoni" sotto-taggata)', () => {
        // 'place' e' zero segnale, non un segnale contrario: escludere per
        // questo butterebbe via spiagge vere che Google non ha taggato.
        expect(candidateMatchesIntentCategoria(
            { types: ['establishment', 'point_of_interest'] }, 'natura',
        )).toBe(true);
    });

    it('categoria "misto" → sempre ammesso, qualunque type', () => {
        expect(candidateMatchesIntentCategoria({ types: ['restaurant', 'food'] }, 'misto')).toBe(true);
        expect(candidateMatchesIntentCategoria({ types: ['natural_feature'] }, 'misto')).toBe(true);
        expect(candidateMatchesIntentCategoria({ types: ['museum'] }, 'misto')).toBe(true);
    });

    it('categorie trasversali (nightlife/famiglia/romantico/sconosciuta) → nessun filtro stretto', () => {
        for (const cat of ['nightlife', 'famiglia', 'romantico', 'sconosciuta']) {
            expect(candidateMatchesIntentCategoria({ types: ['restaurant'] }, cat)).toBe(true);
            expect(candidateMatchesIntentCategoria({ types: ['museum'] }, cat)).toBe(true);
        }
    });

    it('categoria assente/null/undefined → nessun filtro (path B invariato)', () => {
        expect(candidateMatchesIntentCategoria({ types: ['restaurant'] }, null)).toBe(true);
        expect(candidateMatchesIntentCategoria({ types: ['restaurant'] }, undefined)).toBe(true);
        expect(candidateMatchesIntentCategoria({ types: ['restaurant'] }, '')).toBe(true);
    });

    it('categoria "cibo" → il ristorante passa, la spiaggia no (la mappa vale in entrambi i versi)', () => {
        expect(candidateMatchesIntentCategoria({ types: ['restaurant', 'food'] }, 'cibo')).toBe(true);
        expect(candidateMatchesIntentCategoria({ types: ['natural_feature'] }, 'cibo')).toBe(false);
    });

    it('candidato senza types → ammesso (non si giudica senza il dato)', () => {
        expect(candidateMatchesIntentCategoria({}, 'natura')).toBe(true);
        expect(candidateMatchesIntentCategoria({ types: [] }, 'natura')).toBe(true);
        expect(candidateMatchesIntentCategoria(null, 'natura')).toBe(true);
    });
});

// ─── Scenario Cabras end-to-end ───────────────────────────────────────────────

// Cabras: borgo (non in TOP_30_CITIES), R=5 km, R_wider=12 km.
const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const aKm = (km) => CABRAS.latitude + (km / 111);

const RISTORANTE_TYPES = ['establishment', 'food', 'point_of_interest', 'restaurant'];
const SPIAGGIA_TYPES = ['establishment', 'natural_feature', 'point_of_interest'];

const place = ({ id, name, km, types, rating = 4.4, reviews = 400 }) => ({
    place_id: id,
    name,
    geometry: { location: { lat: aKm(km), lng: CABRAS.longitude } },
    rating,
    user_ratings_total: reviews,
    business_status: 'OPERATIONAL',
    types,
});

// 10 ristoranti dentro il paese: 0.3 → 2.55 km. Sono quelli che le query
// "lidi"/"cale" riportano davvero.
const RISTORANTI = Array.from({ length: 10 }, (_, i) => place({
    id: `pid-risto-${i + 1}`,
    name: `Lido Ristorante ${i + 1}`,
    km: 0.3 + i * 0.25,
    types: RISTORANTE_TYPES,
    reviews: 900, // molte recensioni: dominano il ranking per qualityScore
}));

// 3 spiagge vere del Sinis, tutte fuori R=5 e dentro R_wider=12.
const SPIAGGE = [
    place({ id: 'pid-maimoni', name: 'Spiaggia di Maimoni', km: 9, types: SPIAGGIA_TYPES, reviews: 300 }),
    place({ id: 'pid-arutas', name: 'Spiaggia Is Arutas', km: 10.5, types: SPIAGGIA_TYPES, reviews: 250 }),
    place({ id: 'pid-mari-ermi', name: 'Spiaggia Mari Ermi', km: 11.5, types: SPIAGGIA_TYPES, reviews: 200 }),
];

const INTENT_SPIAGGE = {
    queries: ['spiagge', 'lidi', 'cale'],
    categoria: 'natura',
    oggetto_umano: 'spiagge',
    vincoli: { tempo: null, escludi: [], note: null },
};

// 1ª chiamata al proxy OpenAI = traduttore d'intento; la 2ª = selettore.
// `stato.selectorBody` conserva il body della chiamata al selettore: e' li' che
// si legge COSA gli e' stato dato fra cui scegliere.
const routeFetch = ({ perQuery, selectorPayload, intent = INTENT_SPIAGGE }) => {
    const stato = { aiCalls: 0, selectorBody: null };
    const fn = vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const payload = stato.aiCalls === 0 ? intent : selectorPayload;
            if (stato.aiCalls === 1) stato.selectorBody = String(init?.body ?? '');
            stato.aiCalls += 1;
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }
        if (u.includes('textsearch')) {
            const decoded = decodeURIComponent(u);
            const hit = Object.keys(perQuery).find(q => decoded.includes(`${q} Cabras`) || decoded.includes(`${q}+Cabras`));
            return { ok: true, json: async () => ({ status: 'OK', results: hit ? perQuery[hit] : [] }) };
        }
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        throw new Error(`fetch inatteso: ${u}`);
    });
    return { fn, stato };
};

const warnLines = () => console.warn.mock?.calls?.map(a => String(a[0])) ?? [];

describe('Gate RAGGIO-CATEGORIA — generateItinerary, scenario Cabras', () => {
    beforeEach(() => {
        // NON resetAllMocks/restoreAllMocks: azzerano i mock globali di setup.js.
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('le spiagge lontane arrivano al selettore, i ristoranti vicini NO', async () => {
        const { fn, stato } = routeFetch({
            perQuery: { spiagge: SPIAGGE, lidi: RISTORANTI, cale: RISTORANTI },
            // Il selettore sceglie liberamente fra i place_id che gli sono stati
            // dati: se il guard-rail non funzionasse, sceglierebbe i ristoranti.
            selectorPayload: {
                days: [{
                    day: 1, title: 'Il vento del Sinis',
                    stops: [
                        { place_id: 'pid-maimoni', description: 'Sabbia di quarzo sotto i piedi' },
                        { place_id: 'pid-arutas', description: 'I chicchi bianchi rotolano nell’acqua' },
                        { place_id: 'pid-mari-ermi', description: 'Il maestrale piega i giunchi' },
                    ],
                }],
            },
        });
        vi.stubGlobal('fetch', fn);

        const result = await aiRecommendationService.generateItinerary(
            'Cabras', { interests: ['Natura'] }, 'le spiagge piu belle', {}, '', CABRAS,
        );

        // (1) La prova diretta: il selettore E' stato chiamato, e nel suo prompt
        //     ci sono SOLO le spiagge. Nessun ristorante fra cui scegliere.
        expect(stato.aiCalls).toBe(2);
        expect(stato.selectorBody).toBeTruthy();
        expect(stato.selectorBody).toContain('Spiaggia di Maimoni');
        expect(stato.selectorBody).toContain('Spiaggia Is Arutas');
        expect(stato.selectorBody).not.toContain('Lido Ristorante');

        // (2) Il widen e' scattato nonostante 10 candidati grezzi entro 5 km.
        expect(warnLines().some(l => l.includes('tappe pertinenti entro 5 km, allargo a 12 km'))).toBe(true);

        // (3) Il guard-rail deterministico ha dichiarato lo scarto.
        const riga = warnLines().find(l => l.includes('[Gate RAGGIO-CATEGORIA]'));
        expect(riga).toBeTruthy();
        expect(riga).toContain('10/13 candidati scartati per categoria≠"natura"');

        // (4) Il risultato: tre spiagge, zero food.
        expect(result._source).toBe('google-first');
        const stops = result.days[0].stops;
        expect(stops.map(s => s.title).sort()).toEqual(
            ['Spiaggia Is Arutas', 'Spiaggia Mari Ermi', 'Spiaggia di Maimoni'],
        );
        expect(stops.every(s => s.type !== 'restaurant')).toBe(true);
        expect(stops.some(s => (s.types || []).some(t => ['restaurant', 'food', 'bar', 'cafe'].includes(t)))).toBe(false);
    });

    it('zero candidati in categoria anche dopo il widen → _source "no-results" (mai un tour di ripiego)', async () => {
        // Nessuna spiaggia in nessuna delle tre query: solo ristoranti.
        const { fn, stato } = routeFetch({
            perQuery: { spiagge: RISTORANTI, lidi: RISTORANTI, cale: RISTORANTI },
            selectorPayload: { days: [] },
        });
        vi.stubGlobal('fetch', fn);

        const result = await aiRecommendationService.generateItinerary(
            'Cabras', { interests: ['Natura'] }, 'le spiagge piu belle', {}, '', CABRAS,
        );

        expect(result._source).toBe('no-results');
        expect(result._categoria).toBe('natura');
        expect(result._oggetto_umano).toBe('spiagge');
        expect(result.days[0].stops).toEqual([]);
        // Il selettore non e' mai stato pagato: solo il traduttore ha girato.
        expect(stato.aiCalls).toBe(1);
    });

    it('NON-REGRESSIONE — categoria "misto": nessun filtro stretto, il pool arriva intero al selettore', async () => {
        const { fn, stato } = routeFetch({
            perQuery: { spiagge: SPIAGGE, lidi: RISTORANTI, cale: RISTORANTI },
            // Il traduttore, in questo scenario, dichiara "misto".
            intent: { ...INTENT_SPIAGGE, categoria: 'misto', oggetto_umano: 'un giro insider' },
            selectorPayload: {
                days: [{
                    day: 1, title: 'Un giro',
                    stops: [
                        { place_id: 'pid-risto-1', description: 'Tovaglie di carta e fritto misto' },
                        { place_id: 'pid-risto-2', description: 'Il bancone di zinco e le olive' },
                    ],
                }],
            },
        });
        vi.stubGlobal('fetch', fn);

        const result = await aiRecommendationService.generateItinerary(
            'Cabras', { interests: ['Natura'] }, 'sorprendimi', {}, '', CABRAS,
        );

        // Nessuna riga di scarto per categoria: il gate non gira su "misto".
        expect(warnLines().some(l => l.includes('[Gate RAGGIO-CATEGORIA]'))).toBe(false);
        // E il pool grezzo (10 ristoranti entro 5 km) NON allarga: comportamento
        // storico, i ristoranti arrivano al selettore e finiscono nel tour.
        expect(stato.selectorBody).toContain('Lido Ristorante');
        expect(result._source).toBe('google-first');
        expect(result.days[0].stops).toHaveLength(2);
    });
});
