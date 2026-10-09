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
    hasNonEmptyDescription,
    aiRecommendationService,
} from '../../services/aiRecommendationService';

// ─── hasNonEmptyDescription — il predicato condiviso ───
// (era `hasRealDescription` fino al DIFF 2 del Gate NARRATORE ANCORATO: rinomina,
//  nessun cambio di comportamento — le asserzioni qui sotto sono invariate.)─────────────────────────────

describe('Gate NARRATORE/POI Fase 2b — hasNonEmptyDescription', () => {
    it('description valorizzata → true', () => {
        expect(hasNonEmptyDescription({ description: 'Il pavimento è consumato da 300 anni di passi' })).toBe(true);
    });

    it('null / undefined / campo assente → false', () => {
        expect(hasNonEmptyDescription({ description: null })).toBe(false);
        expect(hasNonEmptyDescription({ description: undefined })).toBe(false);
        expect(hasNonEmptyDescription({})).toBe(false);
    });

    it("stringa vuota e soli spazi → false", () => {
        expect(hasNonEmptyDescription({ description: '' })).toBe(false);
        expect(hasNonEmptyDescription({ description: '   ' })).toBe(false);
    });

    it("whitespace non stampabile ('\\n\\t') → false", () => {
        expect(hasNonEmptyDescription({ description: '\n\t' })).toBe(false);
        expect(hasNonEmptyDescription({ description: '\n  \t \n' })).toBe(false);
    });

    it('tipi inattesi non fanno crashare il predicato', () => {
        expect(hasNonEmptyDescription({ description: 42 })).toBe(true);        // String(42).trim() = "42"
        expect(hasNonEmptyDescription({ description: 0 })).toBe(false);        // 0 è falsy a monte
        expect(hasNonEmptyDescription({ description: {} })).toBe(true);        // "[object Object]"
        expect(hasNonEmptyDescription({ description: [] })).toBe(false);       // String([]) = ""
        expect(hasNonEmptyDescription(null)).toBe(false);
        expect(hasNonEmptyDescription(undefined)).toBe(false);
    });

    it('ritorna sempre un booleano, mai un valore truthy generico', () => {
        expect(hasNonEmptyDescription({ description: 'x' })).toBe(true);
        expect(typeof hasNonEmptyDescription({ description: null })).toBe('boolean');
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

// 1ª chiamata AI = traduttore d'intento, 2ª = selettore, 3ª = narratore
// (Gate NARRATORE-DOPO: selettore e narratore ricevono la stessa risposta finta;
// il selettore ne tiene solo i place_id, il narratore i testi).
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


// P3 — lo scheletro della giornata dipende dall'ora: senza un orologio fisso
// questo test cambierebbe esito con l'ora in cui gira la CI. Ora di ROMA
// esplicita (+02:00): la CI gira in UTC. Si finge solo Date, non i timer.
const pinRomeClock = (iso) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
};

describe('Gate NARRATORE/POI Fase 2b — generateItinerary applica la regola #16', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Cache insider + cache intent + cache POI vivono tutte in localStorage:
        // senza pulizia il secondo test leggerebbe il risultato del primo.
        try { window.localStorage.clear(); } catch { /* jsdom ha sempre storage */ }
        // 10:00, Veloce di 2 ore → solo la mattina, 1 tappa (Attivo).
        pinRomeClock('2026-10-07T10:00:00+02:00');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('Veloce 2 ore alle 10 → una tappa sola, il tour esiste e accende _singleStop', async () => {
        vi.stubGlobal('fetch', routeFetch({
            days: [{
                day: 1,
                title: 'Ippocampo tra sale e pietra',
                stops: [
                    { place_id: 'pid-uno', description: 'Dai merli si vede il sale fin dentro le mura' },
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

    // Gate NARRATORE-DOPO — la regola #16 cambia SU QUESTO PATH, per decisione
    // esplicita del task: il racconto arriva DOPO la scelta, sulle tappe finali,
    // e una tappa che il narratore non racconta NON viene piu' tolta. Resta con
    // nome e categoria, i campi di testo null (nessun testo inventato al loro
    // posto), e il report (_narrationReport + console.warn) lo dice. Su
    // generateHomeTours la regola #16 resta com'era (describe sotto).
    // P3d-e — "mai una descrizione vuota": le tappe restano con la frase sicura
    // del codice (tipo, momento, orario), il report continua a elencarle.
    it('il narratore non racconta nessuna tappa → il tour resta, tappe con la frase sicura, il report le elenca', async () => {
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

        expect(result._source).toBe('google-first');
        const stops = result.days[0].stops;
        expect(stops.length).toBeGreaterThan(0);
        for (const st of stops) {
            expect(st.title).toBeTruthy();
            expect(st.type).toBeTruthy();
            expect(st._fraseSicura).toBe(true);
            expect(st.description).toMatch(/: arrivo alle \d{2}:\d{2}\.$/);
        }
        expect(result._narrationReport.nonRaccontate.map(x => x.title)).toEqual(stops.map(st => st.title));
    });

    it('il console.warn delle tappe senza racconto riporta quante e quali (serve sul campo)', async () => {
        // setup.js:82 silenzia console.warn globalmente: il log non arriva su
        // stdout, quindi l'unico modo di provare che il segnale esiste è lo spy.
        // Intenso: la mattina fa 2 tappe, il narratore ne racconta una.
        vi.stubGlobal('fetch', routeFetch({
            days: [{
                day: 1,
                title: 'Ippocampo tra sale e pietra',
                stops: [
                    { place_id: 'pid-uno', description: 'Dai merli si vede il sale fin dentro le mura' },
                    { place_id: 'pid-due', description: '' },
                ],
            }],
        }));

        const result = await aiRecommendationService.generateItinerary(
            CITY, { interests: ['Arte'], pace: 'Intenso' }, 'cerco musei', {}, '', CENTER,
        );
        expect(result.days[0].stops).toHaveLength(2);

        const righe = console.warn.mock.calls
            .map(args => String(args[0]))
            .filter(m => m.includes('[Gate NARRATORE-DOPO]') && m.includes('senza racconto'));

        expect(righe).toHaveLength(1);
        expect(righe[0]).toContain('1/2 tappe senza racconto');
        expect(righe[0]).toContain('Museo del Sale'); // il nome della tappa non raccontata
        expect(righe[0]).toContain(CITY);
    });

    it('NON-REGRESSIONE: tutte le tappe descritte → tutte raccontate, nessuna nel report', async () => {
        vi.stubGlobal('fetch', routeFetch({
            days: [{
                day: 1,
                title: 'Ippocampo tra sale e pietra',
                stops: [
                    { place_id: 'pid-uno', description: 'Dai merli si vede il sale fin dentro le mura' },
                    // Era "Le vasche cambiano colore col tramonto": su una tappa
                    // delle 10 il controllo luce/ora la toglie (Gate NARRATORE-DOPO).
                    { place_id: 'pid-due', description: 'Le vasche hanno bordi di pietra bianca' },
                ],
            }],
        }));

        // P3 — Intenso: la mattina fa 2 tappe, quante ne racconta il modello.
        const result = await aiRecommendationService.generateItinerary(
            CITY, { interests: ['Arte'], pace: 'Intenso' }, 'cerco musei', {}, '', CENTER,
        );

        expect(result._source).toBe('google-first');
        expect(result.days[0].stops).toHaveLength(2);
        expect(result.days[0].stops.every(s => s.description)).toBe(true);
        expect(result._narrationReport.nonRaccontate).toEqual([]);
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
            // P7a — un tour "Per Te" sotto le 3 tappe non si serve: due tappe
            // in piu', sempre descritte, perche' i test guardino la descrizione.
            { place_id: 'pid-tre', name: 'Chiesa Madre', latitude: CENTER.latitude, longitude: CENTER.longitude, rating: 4.5, type: 'church', city: CITY },
            { place_id: 'pid-quattro', name: 'Porta Marina', latitude: CENTER.latitude, longitude: CENTER.longitude, rating: 4.3, type: 'monument', city: CITY },
        ],
    };

    const homeToursFetch = (payload) => vi.fn(async (url) => {
        if (String(url).includes('openai-proxy')) {
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }
        throw new Error(`fetch inatteso: ${url}`);
    });

    // P3d-e — la tappa senza descrizione non esce piu': frase sicura del codice
    // (mai un placeholder tipo "Luogo di interesse": solo tipo e momento).
    it('description vuota → la tappa resta con la frase sicura del codice', async () => {
        vi.stubGlobal('fetch', homeToursFetch({
            tours: [{
                themeType: 'cultura',
                title: 'Cultura a Ippocampo',
                stops: [
                    { place_id: 'pid-uno', description: 'Dai merli si vede il sale fin dentro le mura' },
                    { place_id: 'pid-due', description: '  ' },
                    { place_id: 'pid-tre', description: 'Sul sagrato si vendono le reti la domenica' },
                    { place_id: 'pid-quattro', description: 'La porta guarda il molo dei pescatori' },
                ],
            }],
        }));

        const res = await aiRecommendationService.generateHomeTours({
            city: CITY, cityCenter: CENTER, themedCandidates: POOL,
        });

        expect(res._source).toBe('unified-home');
        expect(res.tours).toHaveLength(1);
        expect(res.tours[0].stops).toHaveLength(4);
        expect(res.tours[0].stops.map(st => st.title)).toContain('Torre Capitania');
        const sale = res.tours[0].stops.find(st => st.title === 'Museo del Sale');
        expect(sale._fraseSicura).toBe(true);
        expect(sale.description).not.toMatch(/Luogo di interesse/);
        expect(sale.description.trim().length).toBeGreaterThan(0);
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
                    { place_id: 'pid-uno', description: 'Dai merli si vede il sale fin dentro le mura' },
                    { place_id: 'pid-due', description: 'Le vasche cambiano colore col tramonto' },
                    { place_id: 'pid-tre', description: 'Sul sagrato si vendono le reti la domenica' },
                ],
            }],
        }));

        const res = await aiRecommendationService.generateHomeTours({
            city: CITY, cityCenter: CENTER, themedCandidates: POOL,
        });

        expect(res.tours).toHaveLength(1);
        expect(res.tours[0].stops).toHaveLength(3);
    });
});
