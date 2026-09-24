// Gate MERITO — end-to-end: verifica cosa ARRIVA al selettore (stesso stile di
// raggioCategoria.test.js), non cosa il selettore risponde. Le recensioni
// diventano un filtro di qualita', non piu' un merito nel ranking.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';

// Cabras: borgo (non in TOP_30_CITIES) — soglia qualita' 4.0/10, R=5 km.
const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const aKm = (km) => CABRAS.latitude + (km / 111);

const place = ({ id, name, km, types, rating = 4.4, reviews = 400 }) => ({
    place_id: id,
    name,
    geometry: { location: { lat: aKm(km), lng: CABRAS.longitude } },
    rating,
    user_ratings_total: reviews,
    business_status: 'OPERATIONAL',
    types,
});

const routeFetch = ({ perQuery, selectorPayload, intent }) => {
    const stato = { aiCalls: 0, selectorBodies: [] };
    const fn = vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            // Distinzione per CONTENUTO, non per posizione: il traduttore puo'
            // essere servito da cache (intentCacheKey non dipende da dnaWeights,
            // per disegno — e' corretto, la traduzione della frase e' la stessa
            // per qualunque utente) e saltare la fetch, spostando la parita'.
            const body = String(init?.body ?? '');
            const isSelector = body.includes("SEI L'INSIDER DI");
            const payload = isSelector ? selectorPayload : intent;
            if (isSelector) stato.selectorBodies.push(body);
            stato.aiCalls += 1;
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }
        if (u.includes('textsearch')) {
            const decoded = decodeURIComponent(u).replace(/\+/g, ' ');
            const hit = Object.keys(perQuery).find(q => decoded.includes(`${q} Cabras`));
            return { ok: true, json: async () => ({ status: 'OK', results: hit ? perQuery[hit] : [] }) };
        }
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        throw new Error(`fetch inatteso: ${u}`);
    });
    return { fn, stato };
};

beforeEach(() => {
    vi.clearAllMocks();
    try { window.localStorage.clear(); } catch { /* jsdom */ }
});
afterEach(() => { vi.unstubAllGlobals(); });

const INTENT_CIBO = {
    queries: ['ristoranti'],
    categoria: 'cibo',
    oggetto_umano: 'ristoranti',
    vincoli: { tempo: null, escludi: [], note: null },
};

describe('Gate MERITO — il locale con poche recensioni precede la catena nel pool offerto', () => {
    it('a parita di categoria, "Trattoria da Elvira" (4.6/180) precede "Catena SpA" (4.4/5000)', async () => {
        const catena = place({ id: 'pid-catena', name: 'Catena SpA', km: 0.5, types: ['restaurant', 'food'], rating: 4.4, reviews: 5000 });
        const locale = place({ id: 'pid-locale', name: 'Trattoria da Elvira', km: 0.8, types: ['restaurant', 'food'], rating: 4.6, reviews: 180 });

        const { fn, stato } = routeFetch({
            perQuery: { ristoranti: [catena, locale] },
            intent: INTENT_CIBO,
            selectorPayload: { days: [{ day: 1, stops: [
                { place_id: 'pid-locale', description: 'Un tavolo di legno, il profumo del sugo' },
            ] }] },
        });
        vi.stubGlobal('fetch', fn);

        await aiRecommendationService.generateItinerary('Cabras', {}, 'un ristorante buono', {}, '', CABRAS);

        const body = stato.selectorBodies[0];
        expect(body).toBeTruthy();
        expect(body).toContain('Trattoria da Elvira');
        expect(body).toContain('Catena SpA');
        expect(body.indexOf('Trattoria da Elvira')).toBeLessThan(body.indexOf('Catena SpA'));
    });
});

describe('Gate MERITO — sotto soglia, escluso anche con recensioni fortissime', () => {
    it('un posto a 3.9 non arriva mai al selettore, nemmeno con 9999 recensioni', async () => {
        const buono = place({ id: 'pid-buono', name: 'Osteria del Faro', km: 0.4, types: ['restaurant', 'food'], rating: 4.5, reviews: 100 });
        const scarso = place({ id: 'pid-scarso', name: 'Ristorante Turistico Anonimo', km: 0.6, types: ['restaurant', 'food'], rating: 3.9, reviews: 9999 });

        const { fn, stato } = routeFetch({
            perQuery: { ristoranti: [buono, scarso] },
            intent: INTENT_CIBO,
            selectorPayload: { days: [{ day: 1, stops: [{ place_id: 'pid-buono', description: 'Il pesce del giorno, scritto a gessetto' }] }] },
        });
        vi.stubGlobal('fetch', fn);

        await aiRecommendationService.generateItinerary('Cabras', {}, 'un ristorante buono', {}, '', CABRAS);

        const body = stato.selectorBodies[0];
        expect(body).toContain('Osteria del Faro');
        expect(body).not.toContain('Ristorante Turistico Anonimo');
    });
});

describe('Gate MERITO — al massimo un\'icona nel pool offerto', () => {
    it('con piu candidati nel decimo superiore per recensioni, al piu 1 arriva al selettore', async () => {
        // 9 normali + 2 iconiche = 11, TUTTI in un'unica query (discoverRealPOIs
        // taglia a maxResults=12 per query: restando a 11 quel taglio non
        // interferisce). Decimo superiore = ceil(11*0.1) = 2, cattura
        // esattamente le 2 iconiche.
        const normali = Array.from({ length: 9 }, (_, i) => place({
            id: `pid-normale-${i}`, name: `Trattoria Locale ${i}`, km: 0.3 + i * 0.1,
            types: ['restaurant', 'food'], rating: 4.3, reviews: 60 + i,
        }));
        const iconiche = Array.from({ length: 2 }, (_, i) => place({
            id: `pid-icona-${i}`, name: `Ristorante Famosissimo ${i}`, km: 1 + i * 0.1,
            types: ['restaurant', 'food'], rating: 4.3, reviews: 9000 + i,
        }));

        const { fn, stato } = routeFetch({
            perQuery: { ristoranti: [...normali, ...iconiche] },
            intent: INTENT_CIBO,
            selectorPayload: { days: [{ day: 1, stops: [{ place_id: 'pid-normale-0', description: 'x' }] }] },
        });
        vi.stubGlobal('fetch', fn);

        await aiRecommendationService.generateItinerary('Cabras', {}, 'un ristorante buono', {}, '', CABRAS);

        const body = stato.selectorBodies[0];
        const iconePresenti = iconiche.filter(c => body.includes(c.name)).length;
        expect(iconePresenti).toBeLessThanOrEqual(1);
    });
});

describe('Gate MERITO — pesi DNA diversi non condividono la cache', () => {
    it('due utenti con dnaWeights diversi, stessa richiesta, generano due chiamate AI separate (no cache hit incrociato)', async () => {
        const a = place({ id: 'pid-a', name: 'Museo del Mare', km: 0.4, types: ['museum'], rating: 4.5, reviews: 100 });
        const b = place({ id: 'pid-b', name: 'Osteria del Porto', km: 0.5, types: ['restaurant', 'food'], rating: 4.5, reviews: 100 });

        const INTENT_MISTO = { queries: ['posti belli'], categoria: 'misto', oggetto_umano: 'posti belli', vincoli: {} };
        const { fn, stato } = routeFetch({
            perQuery: { 'posti belli': [a, b] },
            intent: INTENT_MISTO,
            selectorPayload: { days: [{ day: 1, stops: [{ place_id: 'pid-a', description: 'x' }] }] },
        });
        vi.stubGlobal('fetch', fn);

        await aiRecommendationService.generateItinerary('Cabras', {}, 'posti belli', {}, '', CABRAS, { dnaWeights: { cultura: 1, food: 0 } });
        await aiRecommendationService.generateItinerary('Cabras', {}, 'posti belli', {}, '', CABRAS, { dnaWeights: { cultura: 0, food: 1 } });

        // Il traduttore d'intento puo' legittimamente fare cache hit (la frase
        // e' la stessa): non e' quello sotto test. Quello che NON deve
        // succedere e' che il SECONDO utente riceva il tour del primo dalla
        // cache dell'itinerario: deve esserci un secondo giro di selezione.
        expect(stato.selectorBodies.length).toBe(2);
    });
});

describe('Gate MERITO — varieta: niente 3 tappe consecutive dello stesso tipo', () => {
    it('un\'ordinazione con 3 ristoranti di fila viene riordinata prima di tornare', async () => {
        const r1 = place({ id: 'pid-r1', name: 'Ristorante Uno', km: 0.3, types: ['restaurant'], rating: 4.5, reviews: 50 });
        const r2 = place({ id: 'pid-r2', name: 'Ristorante Due', km: 0.5, types: ['restaurant'], rating: 4.5, reviews: 51 });
        const r3 = place({ id: 'pid-r3', name: 'Ristorante Tre', km: 0.7, types: ['restaurant'], rating: 4.5, reviews: 52 });
        const parco = place({ id: 'pid-parco', name: 'Parco del Sinis', km: 0.9, types: ['park', 'natural_feature'], rating: 4.5, reviews: 53 });

        const INTENT_MISTO = { queries: ['giro misto'], categoria: 'misto', oggetto_umano: 'un giro', vincoli: {} };
        const { fn, stato } = routeFetch({
            perQuery: { 'giro misto': [r1, r2, r3, parco] },
            intent: INTENT_MISTO,
            selectorPayload: { days: [{ day: 1, stops: [
                { place_id: 'pid-r1', description: 'a' },
                { place_id: 'pid-r2', description: 'b' },
                { place_id: 'pid-r3', description: 'c' },
                { place_id: 'pid-parco', description: 'd' },
            ] }] },
        });
        vi.stubGlobal('fetch', fn);

        const result = await aiRecommendationService.generateItinerary('Cabras', {}, 'un giro misto', {}, '', CABRAS);
        const stops = result.days[0].stops;
        const hasRunOf3 = stops.some((_, i) => i <= stops.length - 3 &&
            stops[i].type === stops[i + 1].type && stops[i + 1].type === stops[i + 2].type);
        expect(hasRunOf3).toBe(false);
    });
});
