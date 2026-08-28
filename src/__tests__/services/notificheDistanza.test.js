// Gate NOTIFICHE-DISTANZA — F9: la notifica proponeva Capodimonte (Napoli) a
// un utente a Ippocampo, ~200 km.
//
// La città era giusta (TopBar e notifiche leggono la stessa useUserContext):
// mancava il vincolo di distanza. Il `radius` della textsearch è un BIAS per
// Google, non un filtro, e su un pool povero restituisce risultati fuori
// raggio. Dei quattro consumatori di discoverRealPOIs, tre path tour avevano
// applyRadiusFilter (:1186, :1403, :1623) e il path notifiche no.
//
// Sono i primi test su questo path: prima c'erano solo le due regole grep di
// forma in anti-fake.test.js (payload delle notifiche AI), niente sulla
// scelta dei POI.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyRadiusFilter } from '../../services/tourShape';
import { aiRecommendationService } from '../../services/aiRecommendationService';

// ─── Fixture geografiche reali ─────────────────────────────────────────────────

// Ippocampo, frazione di Zapponeta (FG). isSmallTown → raggio 5 km.
const IPPOCAMPO = { latitude: 41.6489, longitude: 15.9012, isSmallTown: true, radiusKm: 5 };

const vicino = (nome, dLat = 0.01) => ({
    place_id: `pid-${nome}`, name: nome, title: nome,
    latitude: IPPOCAMPO.latitude + dLat, longitude: IPPOCAMPO.longitude,
    rating: 4.5, user_ratings_total: 120,
});

// Gate INTENT (28/08) — FIXTURE NUOVA, e la ragione va scritta.
// Capodimonte sta a 158 km da Ippocampo, quindi da oggi lo intercetta il TAGLIO
// DI SANITA' GEOGRAFICA (100 km, placesDiscoveryService) prima che
// applyRadiusFilter lo veda. Il comportamento finale non cambia — non entra
// comunque — ma cambia CHI lo scarta, e con esso il log.
// Questi due test verificano `applyRadiusFilter`, quindi devono continuare a
// verificarlo: serve un candidato nella fascia dove e' ancora LUI a decidere,
// cioe' sopra i 5 km del borgo e sotto i 100 della sanita'.
// Capodimonte resta usato piu' sotto, per documentare l'interazione nuova.
const A_50_KM = {
    place_id: 'pid-50km', name: 'Santuario lontano', title: 'Santuario lontano',
    latitude: IPPOCAMPO.latitude + 50 / 111.19, longitude: IPPOCAMPO.longitude,
    rating: 4.6, user_ratings_total: 3000,
};

// Museo e Real Bosco di Capodimonte, Napoli — coordinate reali, 158 km.
const CAPODIMONTE = {
    place_id: 'pid-capodimonte', name: 'Museo e Real Bosco di Capodimonte',
    title: 'Museo e Real Bosco di Capodimonte',
    latitude: 40.8672, longitude: 14.2503,
    rating: 4.6, user_ratings_total: 30000,
};

// ─── applyRadiusFilter — il parametro nuovo ────────────────────────────────────

describe('Gate NOTIFICHE-DISTANZA — applyRadiusFilter opts.allowWiden', () => {
    it('(a) un candidato a ~200 km viene scartato (caso Capodimonte)', () => {
        const out = applyRadiusFilter(
            [vicino('Lido'), vicino('Torre', 0.02), CAPODIMONTE],
            IPPOCAMPO, 'Ippocampo', { allowWiden: false },
        );
        expect(out.map(p => p.name)).toEqual(['Lido', 'Torre']);
        expect(out.find(p => p.name.includes('Capodimonte'))).toBeUndefined();
    });

    it('(c) allowWiden:false — nessun riallargamento nemmeno sotto i 2 elementi', () => {
        // 1 solo vicino + 1 lontanissimo: col riallargamento a 12 km il secondo
        // resterebbe comunque fuori, quindi serve un caso a media distanza.
        // ~8 km: dentro R_wider (12) ma fuori R (5).
        const medio = { ...vicino('Masseria'), latitude: IPPOCAMPO.latitude + 0.072 };
        const soloUno = [vicino('Lido'), medio];

        const senzaWiden = applyRadiusFilter(soloUno, IPPOCAMPO, 'Ippocampo', { allowWiden: false });
        expect(senzaWiden.map(p => p.name)).toEqual(['Lido']); // 1 solo, non riallarga
    });

    it('(d) NON-REGRESSIONE: senza opts il riallargamento avviene come oggi', () => {
        // È il test che protegge i tre path tour (:1186, :1403, :1623) e
        // normalizeTour (tourShape.js:358), che chiamano con 3 argomenti.
        const medio = { ...vicino('Masseria'), latitude: IPPOCAMPO.latitude + 0.072 }; // ~8 km
        const input = [vicino('Lido'), medio];

        const conDefault = applyRadiusFilter(input, IPPOCAMPO, 'Ippocampo');
        expect(conDefault.map(p => p.name)).toEqual(['Lido', 'Masseria']); // riallargato a 12 km

        // Esplicito true === default omesso.
        const conTrue = applyRadiusFilter(input, IPPOCAMPO, 'Ippocampo', { allowWiden: true });
        expect(conTrue).toEqual(conDefault);
    });

    it('(e) coordinate assenti → il candidato passa (comportamento :58 invariato)', () => {
        const senzaCoord = { place_id: 'x', name: 'Senza coordinate', title: 'Senza coordinate' };
        const out = applyRadiusFilter(
            [vicino('Lido'), senzaCoord, CAPODIMONTE],
            IPPOCAMPO, 'Ippocampo', { allowWiden: false },
        );
        expect(out.map(p => p.name)).toEqual(['Lido', 'Senza coordinate']);
    });

    it('cityCenter assente → array invariato, il filtro non giudica al buio', () => {
        const input = [vicino('Lido'), CAPODIMONTE];
        expect(applyRadiusFilter(input, null, 'Ippocampo', { allowWiden: false })).toEqual(input);
        expect(applyRadiusFilter(input, { latitude: NaN, longitude: 1 }, 'Ippocampo')).toEqual(input);
    });

    it('accetta sia latitude/longitude sia lat/lng', () => {
        const conLatLng = { place_id: 'y', name: 'Coppia lat/lng', lat: CAPODIMONTE.latitude, lng: CAPODIMONTE.longitude };
        const out = applyRadiusFilter([vicino('Lido'), conLatLng], IPPOCAMPO, 'Ippocampo', { allowWiden: false });
        expect(out.map(p => p.name)).toEqual(['Lido']);
    });
});

// ─── generateWeatherSocialTip — integrazione ───────────────────────────────────
//
// Il filtro vive dentro la funzione: l'unico modo di provare che gira davvero
// è farci passare il motore. fetch instradato per URL, supabase mockato in
// setup.js. Il cityCenter arriva da resolveCityCenter, che passa dal proxy.

const PLACE = (p) => ({
    place_id: p.place_id,
    name: p.name,
    geometry: { location: { lat: p.latitude, lng: p.longitude } },
    rating: p.rating, user_ratings_total: p.user_ratings_total,
    business_status: 'OPERATIONAL',
    types: ['museum'],
});

const routeFetch = (results) => vi.fn(async (url) => {
    const u = String(url);
    // buildPlacesProxyUrl passa il path come query param URL-encoded
    // (place%2Ftextsearch, place%2Fdetails): match su entrambe le forme.
    if (u.includes('textsearch')) {
        return { ok: true, json: async () => ({ status: 'OK', results }) };
    }
    if (u.includes('details')) {
        return { ok: true, json: async () => ({ status: 'OK', result: { opening_hours: { periods: [] } } }) };
    }
    if (u.includes('openai-proxy')) {
        return { ok: true, json: async () => ({
            choices: [{ message: { content: JSON.stringify({ title: 'Nel pomeriggio 🗺️', message: 'Test' }) } }],
        }) };
    }
    throw new Error(`fetch inatteso: ${u}`);
});

// ctx MINIMO perché il motore arrivi davvero al filtro. Serve tutto:
//  - temperatureC/condition → computeWeatherClass (senza, weatherClass null
//    e si esce a "no recipe → skip" SENZA mai filtrare)
//  - cityCenter → letto da ctx (:1826), NON risolto internamente
//  - userLat/userLng → distanza a piedi
const CTX = {
    temperatureC: 22,
    condition: 'sunny',
    cityCenter: IPPOCAMPO,
    userLat: IPPOCAMPO.latitude,
    userLng: IPPOCAMPO.longitude,
};

// Il ramo che ha girato si legge dai console.info di [SmartNotif]: sono quattro
// `return null` diversi (no recipe / cityCenter mancante / 0 candidati Places /
// 0 candidati entro il raggio) e un test verde non dice da solo quale.
const infoLines = () => console.info.mock?.calls?.map(a => String(a[0])) ?? [];

describe('Gate NOTIFICHE-DISTANZA — generateWeatherSocialTip', () => {
    let infoSpy;
    beforeEach(() => {
        // NON vi.resetAllMocks()/restoreAllMocks(): azzerano l'implementation
        // dei mock globali di setup.js (supabase.auth.getSession torna
        // undefined e callOpenAIProxy esplode sul destructuring). Stessa
        // trappola già annotata in gateB_translator.test.js:26-28.
        vi.clearAllMocks();
        infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        try { window.localStorage.clear(); window.sessionStorage.clear(); } catch { /* jsdom */ }
    });
    afterEach(() => { vi.unstubAllGlobals(); infoSpy.mockRestore(); });

    it('(b) se il filtro svuota il pool, la notifica NON viene generata', async () => {
        // Un solo candidato, a 50 km: sotto la sanita' geografica (100 km), quindi
        // arriva ad applyRadiusFilter, che e' cio' che questo test verifica.
        // Dopo il filtro raggio (5 km) restano 0.
        vi.stubGlobal('fetch', routeFetch([PLACE(A_50_KM)]));

        const tip = await aiRecommendationService.generateWeatherSocialTip(
            'Ippocampo', 'Ivano', 'afternoon', CTX,
        );

        expect(tip).toBeNull();
        // …e null per IL motivo giusto: senza questa asserzione il test sarebbe
        // verde anche uscendo a "no recipe" senza mai filtrare nulla.
        expect(infoLines().some(l => l.includes('0 candidati entro il raggio'))).toBe(true);
        expect(infoLines().some(l => l.includes('no recipe'))).toBe(false);
    });

    it('il candidato lontano viene scartato, quello vicino sopravvive', async () => {
        vi.stubGlobal('fetch', routeFetch([PLACE(A_50_KM), PLACE(vicino('Lido'))]));

        await aiRecommendationService.generateWeatherSocialTip(
            'Ippocampo', 'Ivano', 'afternoon', CTX,
        );

        // Prova diretta dello scarto: applyRadiusFilter logga il POI e i km.
        // console.warn è silenziato in setup.js:82, quindi si legge dallo spy.
        const warns = console.warn.mock?.calls?.map(a => String(a[0])) ?? [];
        const scarto = warns.find(l => l.includes('[AI-radius] Scartata') && l.includes('Santuario lontano'));
        expect(scarto, 'il POI a 50 km doveva essere scartato dal filtro raggio').toBeTruthy();
        expect(scarto).toContain('> 5 km da Ippocampo');

        // Il pool non si svuota (Lido resta) → nessuno skip…
        expect(infoLines().some(l => l.includes('0 candidati entro il raggio'))).toBe(false);
        // …e nessuna uscita anticipata prima del filtro.
        expect(infoLines().some(l => l.includes('no recipe'))).toBe(false);
        expect(infoLines().some(l => l.includes('cityCenter mancante'))).toBe(false);
        expect(infoLines().some(l => l.includes('0 candidati Places'))).toBe(false);
    });
});
