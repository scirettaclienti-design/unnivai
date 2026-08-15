// Gate TOUR-DISTANZA — il raggio prima della chiamata AI.
//
// Sonda 15/08 su dati reali: a Ippocampo la query NATURA restituisce 6
// candidati TUTTI di livello 1 (scaleLevel 1, non 3) a 48-225 km dal centro.
// `radius` in Places Text Search è un bias, non un vincolo.
//
// Il filtro a :1216 li intercettava già, ma gira su `canonized`, cioè dopo che
// il selettore AI è stato chiamato e pagato con fino a 20 candidati nel prompt.
// Qui si scartano prima. Per l'utente l'esito è identico (stesso payload
// no-results, stesso copy error-nothing): cambia solo che non paga il selettore.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyRadiusFilter } from '../../services/tourShape';
import { aiRecommendationService } from '../../services/aiRecommendationService';

// Zapponeta, il comune che contiene Ippocampo — centro risolto dal proxy.
const CENTRO = { latitude: 41.45685, longitude: 15.95664, isSmallTown: true, radiusKm: 5 };
// Oggetto NUDO, come lo passa SurpriseTour.jsx:257: lat/lng validi, niente
// radiusKm né isSmallTown.
const CENTRO_NUDO = { latitude: 41.45685, longitude: 15.95664 };

const vicino = (nome, dLat = 0.005) => ({
    place_id: `pid-${nome}`, name: nome, title: nome,
    latitude: CENTRO.latitude + dLat, longitude: CENTRO.longitude,
    lat: CENTRO.latitude + dLat, lng: CENTRO.longitude,
    rating: 4.4, user_ratings_total: 150,
});

// Villa Comunale reale trovata dalla sonda: 48,7 km dal centro.
const VILLA_LONTANA = {
    place_id: 'pid-villa', name: 'Villa Comunale', title: 'Villa Comunale',
    latitude: 41.0, longitude: 15.6,
    lat: 41.0, lng: 15.6,
    rating: 4.3, user_ratings_total: 40,
};

// ─── applyRadiusFilter — opts.requireCenter ────────────────────────────────────

describe('Gate TOUR-DISTANZA — applyRadiusFilter opts.requireCenter', () => {
    it('(b) cityCenter null + requireCenter:true → []', () => {
        const input = [vicino('Lido'), VILLA_LONTANA];
        expect(applyRadiusFilter(input, null, 'Zapponeta', { requireCenter: true })).toEqual([]);
        expect(applyRadiusFilter(input, undefined, 'Zapponeta', { requireCenter: true })).toEqual([]);
        expect(applyRadiusFilter(input, { latitude: NaN, longitude: 15 }, 'Zapponeta', { requireCenter: true })).toEqual([]);
    });

    it('(c) NON-REGRESSIONE: cityCenter null SENZA requireCenter → rawStops invariato', () => {
        // Protegge i 4 call site esistenti, che chiamano senza il flag.
        const input = [vicino('Lido'), VILLA_LONTANA];
        expect(applyRadiusFilter(input, null, 'Zapponeta')).toEqual(input);
        expect(applyRadiusFilter(input, null, 'Zapponeta', {})).toEqual(input);
        expect(applyRadiusFilter(input, null, 'Zapponeta', { allowWiden: false })).toEqual(input);
        // requireCenter:false esplicito ≡ omesso
        expect(applyRadiusFilter(input, null, 'Zapponeta', { requireCenter: false })).toEqual(input);
    });

    it("(d) cityCenter NUDO (come SurpriseTour) + requireCenter:true → il filtro gira, non ritorna []", () => {
        // L'oggetto nudo HA lat/lng validi: non è "centro assente". Il filtro
        // deve funzionare col fallback 5/10 km di tourShape:52, non arrendersi.
        const out = applyRadiusFilter([vicino('Lido'), VILLA_LONTANA], CENTRO_NUDO, 'Zapponeta', { requireCenter: true });
        expect(out.map(p => p.name)).toEqual(['Lido']);
        expect(out).not.toEqual([]);
    });

    it('requireCenter non altera il comportamento quando il centro c’è', () => {
        const input = [vicino('Lido'), VILLA_LONTANA];
        const con = applyRadiusFilter(input, CENTRO, 'Zapponeta', { requireCenter: true });
        const senza = applyRadiusFilter(input, CENTRO, 'Zapponeta');
        expect(con).toEqual(senza);
    });

    it('requireCenter e allowWiden sono indipendenti', () => {
        const medio = { ...vicino('Masseria'), latitude: CENTRO.latitude + 0.072, lat: CENTRO.latitude + 0.072 }; // ~8 km
        const input = [vicino('Lido'), medio];
        // allowWiden default true → riallarga a 12 km e tiene entrambi
        expect(applyRadiusFilter(input, CENTRO, 'Zapponeta', { requireCenter: true }).map(p => p.name))
            .toEqual(['Lido', 'Masseria']);
        // allowWiden false → solo il vicino
        expect(applyRadiusFilter(input, CENTRO, 'Zapponeta', { requireCenter: true, allowWiden: false }).map(p => p.name))
            .toEqual(['Lido']);
    });
});

// ─── generateItinerary — il filtro gira PRIMA della chiamata AI ────────────────

const PLACE = (p) => ({
    place_id: p.place_id,
    name: p.name,
    geometry: { location: { lat: p.latitude, lng: p.longitude } },
    rating: p.rating, user_ratings_total: p.user_ratings_total,
    business_status: 'OPERATIONAL',
    types: ['park'],
});

const INTENT = {
    queries: ['parco'], categoria: 'natura', oggetto_umano: 'parchi',
    vincoli: { tempo: null, escludi: [], note: null },
};

// 1ª chiamata AI = traduttore d'intento; la 2ª (selettore) NON deve avvenire
// quando tutti i candidati sono fuori raggio: il contatore lo dimostra.
const routeFetch = (results, selectorPayload) => {
    const stato = { aiCalls: 0 };
    const fn = vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const payload = stato.aiCalls === 0 ? INTENT : selectorPayload;
            stato.aiCalls += 1;
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }
        if (u.includes('textsearch')) return { ok: true, json: async () => ({ status: 'OK', results }) };
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        throw new Error(`fetch inatteso: ${u}`);
    });
    return { fn, stato };
};

const warnLines = () => console.warn.mock?.calls?.map(a => String(a[0])) ?? [];

describe('Gate TOUR-DISTANZA — generateItinerary scarta prima di chiamare l’AI', () => {
    beforeEach(() => {
        // NON resetAllMocks/restoreAllMocks: azzerano i mock globali di setup.js.
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('(a) candidati oltre raggio scartati PRIMA della chiamata AI', async () => {
        const { fn, stato } = routeFetch([PLACE(VILLA_LONTANA)], { days: [] });
        vi.stubGlobal('fetch', fn);

        await aiRecommendationService.generateItinerary(
            'Zapponeta', { interests: ['Natura'] }, 'cerco parchi', {}, '', CENTRO,
        );

        // La prova richiesta: il marker, non il valore di ritorno.
        const riga = warnLines().find(l => l.includes('[Gate TOUR-DISTANZA]'));
        expect(riga, 'il candidato a 48 km doveva essere scartato prima dell’AI').toBeTruthy();
        expect(riga).toContain('1/1 candidati scartati PRIMA della chiamata AI');
        expect(riga).toContain('Villa Comunale');
        expect(riga).toMatch(/\d+\.\d+ km/); // la distanza reale è nel log

        // E la controprova che il risparmio è vero: solo il traduttore ha girato,
        // il selettore no.
        expect(stato.aiCalls).toBe(1);
    });

    it('NON-REGRESSIONE: candidati dentro il raggio arrivano all’AI', async () => {
        const { fn, stato } = routeFetch(
            [PLACE(vicino('Lido')), PLACE(VILLA_LONTANA)],
            { days: [{ day: 1, title: 'Un giro', stops: [{ place_id: 'pid-Lido', description: 'Il vento porta il sale' }] }] },
        );
        vi.stubGlobal('fetch', fn);

        const result = await aiRecommendationService.generateItinerary(
            'Zapponeta', { interests: ['Natura'] }, 'cerco parchi', {}, '', CENTRO,
        );

        expect(result._source).toBe('google-first');
        expect(result.days[0].stops.map(s => s.title)).toEqual(['Lido']);
        // Il selettore È stato chiamato: il filtro non blocca i tour buoni.
        expect(stato.aiCalls).toBe(2);
        // Solo la villa lontana è finita nel log di scarto.
        const riga = warnLines().find(l => l.includes('[Gate TOUR-DISTANZA]'));
        expect(riga).toContain('1/2 candidati scartati');
        expect(riga).toContain('Villa Comunale');
        expect(riga).not.toContain('Lido');
    });

    it('nessuno scartato → nessuna riga di log (il marker non è rumore)', async () => {
        const { fn } = routeFetch(
            [PLACE(vicino('Lido'))],
            { days: [{ day: 1, title: 'Un giro', stops: [{ place_id: 'pid-Lido', description: 'Il vento porta il sale' }] }] },
        );
        vi.stubGlobal('fetch', fn);

        await aiRecommendationService.generateItinerary(
            'Zapponeta', { interests: ['Natura'] }, 'cerco parchi', {}, '', CENTRO,
        );

        expect(warnLines().some(l => l.includes('[Gate TOUR-DISTANZA]'))).toBe(false);
    });
});
