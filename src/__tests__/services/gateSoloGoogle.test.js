// Gate SOLO-GOOGLE (27/09) — il modello non produce più luoghi su nessun percorso.
//
// Prima esistevano due motori AI-first: `discoverPOIs` (placesDiscoveryService,
// fallback interno dei tre cammini di errore di `discoverRealPOIs`) e il
// generatore dentro `generateItinerary` (~200 righe che facevano inventare al
// modello nome + coordinate, poi filtrate da `verifyPOIWithPlaces`). Il Percorso
// A era già blindato (`skipLegacyFallback: true` + safety belt); il Percorso B
// (solo interessi selezionati, senza frase — AiItinerary.jsx:451 abilita
// "Genera" anche così) e `discoverAllThemes` ("Per Te") ci cadevano dentro.
//
// Qui si verifica il contratto nuovo su entrambi i casi di fallimento di Google:
//   (b) textsearch risponde OK ma nessun candidato supera i filtri
//   (c) textsearch fallisce (rete/HTTP)
// In tutti e due: ZERO chiamate al modello per generare luoghi, risultato vuoto.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { placesDiscoveryService } from '../../services/placesDiscoveryService';

const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };

// Percorso B = nessuna frase dell'utente. `interests: ['Cibo']` produce il tema
// 'food', che esiste in THEME_TEXTSEARCH: così la textsearch viene davvero
// tentata e sono i mock qui sotto a decidere come va.
const PREFS_PATH_B = { interests: ['Cibo'], duration: '1 Giorno', group: 'solo' };

// Router di fetch: conta le chiamate al modello e decide la risposta di Places.
const routeFetch = ({ textsearch }) => {
    const stato = { aiCalls: 0, textsearchCalls: 0 };
    const fn = vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            stato.aiCalls += 1;
            // Se qualcuno prova a far generare luoghi al modello, il test deve
            // accorgersene dal contatore, non da una risposta plausibile.
            return { ok: true, json: async () => ({ choices: [{ message: { content: '{"days":[]}' } }] }) };
        }
        if (u.includes('textsearch')) {
            stato.textsearchCalls += 1;
            return textsearch();
        }
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        throw new Error(`fetch inatteso: ${u}`);
    });
    return { fn, stato };
};

// (b) Google risponde, ma nessun candidato sopravvive ai filtri.
const ZERO_CANDIDATI = () => ({ ok: true, json: async () => ({ status: 'OK', results: [] }) });
// (c) la textsearch fallisce.
const TEXTSEARCH_KO = () => { throw new Error('ECONNRESET simulato'); };

beforeEach(() => {
    vi.clearAllMocks();
    try { window.localStorage.clear(); } catch { /* jsdom */ }
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('Gate SOLO-GOOGLE — Percorso B (solo interessi, nessuna frase)', () => {
    it('(b) zero candidati validi → risultato vuoto, nessuna chiamata al modello', async () => {
        const { fn, stato } = routeFetch({ textsearch: ZERO_CANDIDATI });
        vi.stubGlobal('fetch', fn);

        const result = await aiRecommendationService.generateItinerary(
            'Cabras', PREFS_PATH_B, '', { condition: 'sunny', temperature: 20 }, '', CABRAS,
        );

        expect(stato.textsearchCalls).toBeGreaterThan(0); // Google è stato interrogato
        expect(stato.aiCalls).toBe(0);                    // il modello non è stato usato
        expect(result._source).toBe('no-results');
        expect(result._pathB).toBe(true);
        expect(result.days[0].stops).toEqual([]);
    });

    // Gate INTERESSI-VERI (06/10): con la textsearch in errore il risultato e'
    // 'search-error', non 'no-results' — prima la UI diceva "non trovo luoghi
    // verificati" senza che Google avesse risposto. L'invariante di questo gate
    // resta intatto: nessuna chiamata al modello, nessuna tappa.
    it('(c) textsearch in errore → search-error, nessuna chiamata al modello', async () => {
        const { fn, stato } = routeFetch({ textsearch: TEXTSEARCH_KO });
        vi.stubGlobal('fetch', fn);

        const result = await aiRecommendationService.generateItinerary(
            'Cabras', PREFS_PATH_B, '', { condition: 'sunny', temperature: 20 }, '', CABRAS,
        );

        expect(stato.aiCalls).toBe(0);
        expect(result._source).toBe('search-error');
        expect(result._pathB).toBe(true);
        expect(result.days[0].stops).toEqual([]);
    });
});

describe('Gate SOLO-GOOGLE — discoverAllThemes (il pool di "Per Te")', () => {
    it('(b) zero candidati validi → tutti i temi vuoti, nessuna chiamata al modello', async () => {
        const { fn, stato } = routeFetch({ textsearch: ZERO_CANDIDATI });
        vi.stubGlobal('fetch', fn);

        const pools = await placesDiscoveryService.discoverAllThemes('Cabras', CABRAS.latitude, CABRAS.longitude);

        expect(stato.aiCalls).toBe(0);
        const tutti = Object.values(pools).flat();
        expect(tutti).toEqual([]);
    });

    // Gate INTERESSI-VERI (06/10): tutte le ricerche in errore → errore di
    // ricerca (la Home mostra il testo di connessione), non pool vuoti che
    // diventerebbero "non trovo". Sempre zero chiamate al modello.
    it('(c) textsearch in errore → PlacesSearchError, nessuna chiamata al modello', async () => {
        const { fn, stato } = routeFetch({ textsearch: TEXTSEARCH_KO });
        vi.stubGlobal('fetch', fn);

        await expect(placesDiscoveryService.discoverAllThemes('Cabras', CABRAS.latitude, CABRAS.longitude))
            .rejects.toMatchObject({ code: 'PLACES_SEARCH_FAILED' });

        expect(stato.aiCalls).toBe(0);
    });
});

describe('Gate SOLO-GOOGLE — il motore AI-first non esiste più nel sorgente', () => {
    it('placesDiscoveryService non espone più discoverPOIs', () => {
        expect(placesDiscoveryService.discoverPOIs).toBeUndefined();
    });

    it('aiRecommendationService non espone più verifyPOIWithPlaces', async () => {
        const mod = await import('../../services/aiRecommendationService');
        expect(mod.verifyPOIWithPlaces).toBeUndefined();
    });
});
