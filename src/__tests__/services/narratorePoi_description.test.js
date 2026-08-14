// Gate NARRATORE/POI — Fase 2b: la regola locked #16 su generateItinerary.
//
// "Se il narratore non produce una descrizione vera, la tappa NON entra
//  (meno tappe > tappe vuote). Tour con 0 tappe post-filtro → escluso."
//
// Il filtro esisteva solo in generateHomeTours (Gate II.2). generateItinerary —
// dove passano QuickPath, SurpriseTour e AiItinerary — non l'ha mai avuto: è la
// lacuna che ha lasciato entrare la tappa-località di Ippocampo con "le onde si
// infrangono dolcemente" al posto di un fatto.
//
// I due test su generateItinerary sono di INTEGRAZIONE, non unit su un helper:
// il filtro vive dentro una closure e l'unico modo per provare che gira davvero
// nel path reale è farci passare il motore. fetch è instradato per URL
// (openai-proxy vs places-proxy), supabase è mockato globalmente in setup.js.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    hasRealDescription,
    aiRecommendationService,
} from '../../services/aiRecommendationService';

// ─── hasRealDescription — il predicato condiviso ────────────────────────────────

describe('Gate NARRATORE/POI Fase 2b — hasRealDescription', () => {
    it('description valorizzata → true', () => {
        expect(hasRealDescription({ description: 'Il pavimento è consumato da 300 anni di passi' })).toBe(true);
    });

    it('null / undefined / campo assente → false', () => {
        expect(hasRealDescription({ description: null })).toBe(false);
        expect(hasRealDescription({ description: undefined })).toBe(false);
        expect(hasRealDescription({})).toBe(false);
    });

    it("stringa vuota e soli spazi → false", () => {
        expect(hasRealDescription({ description: '' })).toBe(false);
        expect(hasRealDescription({ description: '   ' })).toBe(false);
    });

    it("whitespace non stampabile ('\\n\\t') → false", () => {
        expect(hasRealDescription({ description: '\n\t' })).toBe(false);
        expect(hasRealDescription({ description: '\n  \t \n' })).toBe(false);
    });

    it('tipi inattesi non fanno crashare il predicato', () => {
        expect(hasRealDescription({ description: 42 })).toBe(true);        // String(42).trim() = "42"
        expect(hasRealDescription({ description: 0 })).toBe(false);        // 0 è falsy a monte
        expect(hasRealDescription({ description: {} })).toBe(true);        // "[object Object]"
        expect(hasRealDescription({ description: [] })).toBe(false);       // String([]) = ""
        expect(hasRealDescription(null)).toBe(false);
        expect(hasRealDescription(undefined)).toBe(false);
    });

    it('ritorna sempre un booleano, mai un valore truthy generico', () => {
        expect(hasRealDescription({ description: 'x' })).toBe(true);
        expect(typeof hasRealDescription({ description: null })).toBe('boolean');
    });
});

// ─── generateItinerary — integrazione ───────────────────────────────────────────

const CITY = 'Ippocampo';
const CENTER = { latitude: 41.6489, longitude: 15.9012 };

const PLACE = (place_id, name) => ({
    place_id,
    name,
    geometry: { location: { lat: CENTER.latitude, lng: CENTER.longitude } },
    rating: 4.6,
    user_ratings_total: 120,
    business_status: 'OPERATIONAL',
    types: ['museum'],
});

const PLACES_OK = {
    status: 'OK',
    results: [PLACE('pid-uno', 'Torre Capitania'), PLACE('pid-due', 'Museo del Sale')],
};

const INTENT = {
    queries: ['museo'],
    categoria: 'cultura',
    oggetto_umano: 'musei',
    vincoli: { tempo: null, escludi: [], note: null },
};

// 1ª chiamata AI = traduttore d'intento, 2ª = selettore-narratore.
const routeFetch = (selectorPayload) => {
    let aiCall = 0;
    return vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const payload = aiCall === 0 ? INTENT : selectorPayload;
            aiCall += 1;
            return {
                ok: true,
                json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
            };
        }
        if (u.includes('places-proxy')) {
            return { ok: true, json: async () => PLACES_OK };
        }
        throw new Error(`fetch inatteso nel test: ${u}`);
    });
};

describe('Gate NARRATORE/POI Fase 2b — generateItinerary applica la regola #16', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Cache insider + cache intent + cache POI vivono tutte in localStorage:
        // senza pulizia il secondo test leggerebbe il risultato del primo.
        try { window.localStorage.clear(); } catch { /* jsdom ha sempre storage */ }
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('2 tappe di cui 1 senza description → resta 1 tappa, il tour esiste', async () => {
        vi.stubGlobal('fetch', routeFetch({
            days: [{
                day: 1,
                title: 'Ippocampo tra sale e pietra',
                stops: [
                    { place_id: 'pid-uno', description: 'Il vento porta il sale fin dentro le mura' },
                    { place_id: 'pid-due', description: '' },
                ],
            }],
        }));

        const result = await aiRecommendationService.generateItinerary(
            CITY, { interests: ['Arte'] }, 'cerco musei', {}, '', CENTER,
        );

        expect(result._source).toBe('google-first');
        expect(result.days).toHaveLength(1);
        expect(result.days[0].stops).toHaveLength(1);
        expect(result.days[0].stops[0].title).toBe('Torre Capitania');
        // Gate I: una tappa sola accende il flag per il banner onesto in UI.
        expect(result._singleStop).toBe(true);
    });

    it('tutte le tappe senza description → nessun tour servito, _source no-results', async () => {
        vi.stubGlobal('fetch', routeFetch({
            days: [{
                day: 1,
                title: 'Ippocampo tra sale e pietra',
                stops: [
                    { place_id: 'pid-uno', description: '' },
                    { place_id: 'pid-due', description: '   ' },
                ],
            }],
        }));

        const result = await aiRecommendationService.generateItinerary(
            CITY, { interests: ['Arte'] }, 'cerco musei', {}, '', CENTER,
        );

        expect(result._source).toBe('no-results');
        expect(result.days[0].stops).toEqual([]);
        // Il ramo di uscita onesto porta con sé l'oggetto per il copy utente.
        expect(result._oggetto_umano).toBe('musei');
    });

    it('il console.warn di scarto riporta quante tappe e quali nomi (serve sul campo)', async () => {
        // setup.js:82 silenzia console.warn globalmente: il log non arriva su
        // stdout, quindi l'unico modo di provare che il segnale esiste è lo spy.
        vi.stubGlobal('fetch', routeFetch({
            days: [{
                day: 1,
                title: 'Ippocampo tra sale e pietra',
                stops: [
                    { place_id: 'pid-uno', description: 'Il vento porta il sale fin dentro le mura' },
                    { place_id: 'pid-due', description: '' },
                ],
            }],
        }));

        await aiRecommendationService.generateItinerary(
            CITY, { interests: ['Arte'] }, 'cerco musei', {}, '', CENTER,
        );

        const righe = console.warn.mock.calls
            .map(args => String(args[0]))
            .filter(m => m.includes('[Gate NARRATORE/POI]'));

        expect(righe).toHaveLength(1);
        expect(righe[0]).toContain('1/2 tappe scartate');
        expect(righe[0]).toContain('Museo del Sale'); // il nome della tappa scartata
        expect(righe[0]).toContain(CITY);
    });

    it('NON-REGRESSIONE: tutte le tappe descritte → nessuna viene scartata', async () => {
        vi.stubGlobal('fetch', routeFetch({
            days: [{
                day: 1,
                title: 'Ippocampo tra sale e pietra',
                stops: [
                    { place_id: 'pid-uno', description: 'Il vento porta il sale fin dentro le mura' },
                    { place_id: 'pid-due', description: 'Le vasche cambiano colore col tramonto' },
                ],
            }],
        }));

        const result = await aiRecommendationService.generateItinerary(
            CITY, { interests: ['Arte'] }, 'cerco musei', {}, '', CENTER,
        );

        expect(result._source).toBe('google-first');
        expect(result.days[0].stops).toHaveLength(2);
        expect(result._singleStop).toBe(false);
    });
});

// ─── generateHomeTours — non-regressione dell'estrazione ────────────────────────

describe('Gate NARRATORE/POI Fase 2b — generateHomeTours invariato dopo l\'estrazione', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const POOL = {
        cultura: [
            { place_id: 'pid-uno', name: 'Torre Capitania', latitude: CENTER.latitude, longitude: CENTER.longitude, rating: 4.6, type: 'museum', city: CITY },
            { place_id: 'pid-due', name: 'Museo del Sale', latitude: CENTER.latitude, longitude: CENTER.longitude, rating: 4.4, type: 'museum', city: CITY },
        ],
    };

    const homeToursFetch = (payload) => vi.fn(async (url) => {
        if (String(url).includes('openai-proxy')) {
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }
        throw new Error(`fetch inatteso: ${url}`);
    });

    it('description vuota → stop scartato, esattamente come prima (Gate II.2)', async () => {
        vi.stubGlobal('fetch', homeToursFetch({
            tours: [{
                themeType: 'cultura',
                title: 'Cultura a Ippocampo',
                stops: [
                    { place_id: 'pid-uno', description: 'Il vento porta il sale fin dentro le mura' },
                    { place_id: 'pid-due', description: '  ' },
                ],
            }],
        }));

        const res = await aiRecommendationService.generateHomeTours({
            city: CITY, cityCenter: CENTER, themedCandidates: POOL,
        });

        expect(res._source).toBe('unified-home');
        expect(res.tours).toHaveLength(1);
        expect(res.tours[0].stops).toHaveLength(1);
        expect(res.tours[0].stops[0].title).toBe('Torre Capitania');
    });

    it('tour i cui stop restano tutti senza description → tour escluso, come prima', async () => {
        vi.stubGlobal('fetch', homeToursFetch({
            tours: [{
                themeType: 'cultura',
                title: 'Cultura a Ippocampo',
                stops: [
                    { place_id: 'pid-uno', description: '' },
                    { place_id: 'pid-due', description: null },
                ],
            }],
        }));

        const res = await aiRecommendationService.generateHomeTours({
            city: CITY, cityCenter: CENTER, themedCandidates: POOL,
        });

        expect(res.tours).toEqual([]);
    });

    it('NON-REGRESSIONE: tutte descritte → tour completo, nessuno scarto', async () => {
        vi.stubGlobal('fetch', homeToursFetch({
            tours: [{
                themeType: 'cultura',
                title: 'Cultura a Ippocampo',
                stops: [
                    { place_id: 'pid-uno', description: 'Il vento porta il sale fin dentro le mura' },
                    { place_id: 'pid-due', description: 'Le vasche cambiano colore col tramonto' },
                ],
            }],
        }));

        const res = await aiRecommendationService.generateHomeTours({
            city: CITY, cityCenter: CENTER, themedCandidates: POOL,
        });

        expect(res.tours).toHaveLength(1);
        expect(res.tours[0].stops).toHaveLength(2);
    });
});
