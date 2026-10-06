// Gate INTERESSI-VERI — ogni interesse del Percorso B produce una ricerca Google.
//
// Il difetto: derivePrimaryThemes traduceva "Arte" e "Storia" nel tema `art`, e
// il mix di riserva (nessun interesse) iniziava con `walking`. Nessuno dei due
// esiste in THEME_TEXTSEARCH dal Gate P.1 (`art` rinominato `cultura`, `walking`
// assorbito da `cultura`), e la ricerca di riserva puntava proprio a `walking`.
// `themeCfg.query` su undefined lanciava un TypeError PRIMA della fetch: nessuna
// chiamata a Google, e il catch esterno lo trasformava in "A Roma non trovo
// luoghi verificati per questi interessi." — una frase falsa, Google non era
// mai stato interpellato.
//
// Questo test usa solo l'API pubblica che esisteva gia' prima del fix
// (generateItinerary + fetch finto), cosi' il rosso si riproduce sul codice
// vecchio senza che manchi un export.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';

const ROMA = { latitude: 41.9028, longitude: 12.4964, isSmallTown: false, radiusKm: 12 };
const near = (i) => ({ lat: ROMA.latitude + 0.002 * (i + 1), lng: ROMA.longitude + 0.001 * (i + 1) });

const PLACES = ['pid-1', 'pid-2', 'pid-3', 'pid-4'].map((id, i) => ({
    place_id: id,
    name: `Luogo ${i + 1}`,
    geometry: { location: near(i) },
    rating: 4.6,
    user_ratings_total: 900,
    business_status: 'OPERATIONAL',
    types: ['museum', 'tourist_attraction', 'point_of_interest', 'establishment'],
}));

const SELECTOR = {
    days: [{
        day: 1,
        title: 'Roma a piedi',
        stops: PLACES.slice(0, 3).map(p => ({ place_id: p.place_id, description: 'Il marmo fresco sotto le dita' })),
    }],
};

let textsearchQueries;
const routeFetch = () => vi.fn(async (url) => {
    const u = decodeURIComponent(String(url)).replace(/\+/g, ' ');
    if (u.includes('openai-proxy')) {
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(SELECTOR) } }] }) };
    }
    if (u.includes('textsearch')) {
        textsearchQueries.push(new URL(String(url), 'http://x').searchParams.get('query'));
        return { ok: true, json: async () => ({ status: 'OK', results: PLACES }) };
    }
    if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
    throw new Error(`fetch inatteso: ${u}`);
});

const percorsoB = (interests) => aiRecommendationService.generateItinerary(
    'Roma', { interests }, '', {}, '', ROMA,
);

describe('Gate INTERESSI-VERI — il Percorso B chiama davvero Google', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        textsearchQueries = [];
        try { window.localStorage.clear(); } catch { /* jsdom */ }
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('"arte" + "passeggiate" → textsearch reale su Google e un tour vero', async () => {
        vi.stubGlobal('fetch', routeFetch());
        const tour = await percorsoB(['arte', 'passeggiate']);

        expect(textsearchQueries.length).toBeGreaterThan(0);
        // la ricerca e' quella di cultura (musei, chiese, monumenti, centro storico)
        expect(textsearchQueries.some(q => q.includes('museo') && q.includes('Roma'))).toBe(true);
        expect(tour._source).toBe('google-first');
        expect(tour.days[0].stops.length).toBeGreaterThan(0);
    });

    // I 6 interessi di AiItinerary (src/pages/AiItinerary.jsx:28) uno per uno,
    // piu' nessun interesse (mix di riserva). Ognuno deve arrivare a Google.
    it.each([
        [['Arte']], [['Cibo']], [['Storia']], [['Natura']], [['Shopping']], [['Vita Notturna']], [[]],
    ])('interessi %j → almeno una textsearch e, con Google che risponde, un tour vero', async (interests) => {
        vi.stubGlobal('fetch', routeFetch());
        const tour = await percorsoB(interests);
        expect(textsearchQueries.length).toBeGreaterThan(0);
        // Senza interessi la fetch di `food` partiva lo stesso, ma `walking`/`art`
        // lanciavano e il Promise.all buttava via tutto: "non trovo" con Google
        // che aveva risposto. La sola fetch non basta come prova.
        expect(tour._source).toBe('google-first');
    });
});
