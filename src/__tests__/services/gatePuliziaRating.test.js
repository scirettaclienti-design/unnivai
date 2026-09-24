// Gate PULIZIA (24/09) — nessun numero mostrato all'utente e' inventato.
//
// Punto 1: discoverPOIs (motore legacy AI-first, placesDiscoveryService.js)
// non deve MAI trasportare un rating prodotto dal modello — nemmeno quando il
// modello restituisce esattamente 4.5, il valore che l'esempio few-shot del
// prompt mostrava (e che il modello poteva copiare invece di trattarlo come
// un'istruzione di formato).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { placesDiscoveryService } from '../../services/placesDiscoveryService';

beforeEach(() => {
    // clearAllMocks, non resetAllMocks: resetAllMocks svuota anche
    // l'implementazione di supabase.auth.getSession del mock globale
    // (src/test/setup.js), da cui dipende callOpenAIProxy.
    vi.clearAllMocks();
    try { window.localStorage.clear(); } catch { /* jsdom */ }
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('Gate PULIZIA — discoverPOIs non trasporta mai un rating dal modello', () => {
    it('il modello restituisce rating 4.5 (il valore del vecchio few-shot) — il POI ha rating null', async () => {
        const fetchMock = vi.fn(async (url) => {
            const u = String(url);
            if (u.includes('openai-proxy')) {
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                            message: {
                                content: JSON.stringify({
                                    pois: [{
                                        name: 'Piazza del Test',
                                        description: 'Una piazza vera, non inventata',
                                        latitude: 41.1171,
                                        longitude: 15.0699,
                                        type: 'piazza',
                                        rating: 4.5,
                                    }],
                                }),
                            },
                        }],
                    }),
                };
            }
            // Foto Places: risposta onesta "non trovato", nessun crash.
            return { ok: false, status: 404, json: async () => ({}) };
        });
        vi.stubGlobal('fetch', fetchMock);

        const pois = await placesDiscoveryService.discoverPOIs('Troina', 37.78, 14.60, 'walking');

        expect(pois.length).toBeGreaterThan(0);
        expect(pois[0].name).toBe('Piazza del Test');
        expect(pois[0].rating).toBeNull();
    });
});
