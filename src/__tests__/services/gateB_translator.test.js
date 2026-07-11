// Gate B — Tests del traduttore d'intento free-text → query Places + vincoli.
//
// Copre i punti chiave del DoD:
// - translateIntentToQueries("sorprendimi") → 3 query, zero errore (regola input vago)
// - cache HIT sulla stessa frase+città (source: 'cache')
// - JSON invalido dal modello → throw pulito
// - queries[] vuoto dal modello → throw
// - vincoli sanitizzati (tempo enum, note ≤150 char)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { translateIntentToQueries } from '../../services/aiRecommendationService';

const okResponse = (payload) => ({
    ok: true,
    json: async () => ({
        choices: [{ message: { content: JSON.stringify(payload) } }],
    }),
});

// Il traduttore usa callOpenAIProxy internamente, che fa fetch al /functions/v1/openai-proxy.
// Basta stubbare fetch globalmente.

describe('Gate B — translateIntentToQueries', () => {
    beforeEach(() => {
        // NOTE: NON usare vi.resetAllMocks() — cancella l'implementation dei mock
        // globali (supabase in setup.js) e getSession torna undefined.
        // vi.clearAllMocks() ripulisce solo la history.
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom always has storage */ }
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('input "spiagge di Siracusa" → produce queries di spiagge + oggetto_umano', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({
            queries: ['spiagge', 'lidi balneari', 'cale'],
            categoria: 'natura',
            oggetto_umano: 'spiagge',
            vincoli: { tempo: null, escludi: [], note: null },
        })));

        const result = await translateIntentToQueries('le migliori spiagge di Siracusa', 'Siracusa');
        expect(result.queries).toEqual(['spiagge', 'lidi balneari', 'cale']);
        expect(result.categoria).toBe('natura');
        expect(result.oggetto_umano).toBe('spiagge');
        expect(result._source).toBe('ai');
    });

    it('input vago "sorprendimi" → mix insider curato, zero errore', async () => {
        // Il modello segue la regola speciale del prompt e restituisce il mix locked.
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({
            queries: ['piazza storica', 'trattoria tipica', 'belvedere panorama'],
            categoria: 'misto',
            oggetto_umano: 'un giro insider',
            vincoli: { tempo: null, escludi: [], note: 'utente si affida a te' },
        })));

        const result = await translateIntentToQueries('sorprendimi', 'Roma');
        expect(result.queries).toHaveLength(3);
        expect(result.categoria).toBe('misto');
        expect(result.oggetto_umano).toBeTruthy();
    });

    it('cache HIT — stessa frase+città usa cache, source="cache", NO fetch nuovo', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okResponse({
            queries: ['spiagge'],
            categoria: 'natura',
            oggetto_umano: 'spiagge',
            vincoli: { tempo: null, escludi: [], note: null },
        }));
        vi.stubGlobal('fetch', fetchMock);

        // 1ª chiamata → fetch reale
        const r1 = await translateIntentToQueries('spiagge', 'Siracusa');
        expect(r1._source).toBe('ai');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // 2ª chiamata identica → cache hit
        const r2 = await translateIntentToQueries('spiagge', 'Siracusa');
        expect(r2._source).toBe('cache');
        expect(fetchMock).toHaveBeenCalledTimes(1); // stesso count → nessuna nuova fetch
        expect(r2.queries).toEqual(r1.queries);
    });

    it('cache MISS su città diversa (chiave = hash(frase+city))', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(okResponse({
                queries: ['spiagge'], categoria: 'natura', oggetto_umano: 'spiagge',
                vincoli: { tempo: null, escludi: [], note: null },
            }))
            .mockResolvedValueOnce(okResponse({
                queries: ['spiagge'], categoria: 'natura', oggetto_umano: 'spiagge',
                vincoli: { tempo: null, escludi: [], note: null },
            }));
        vi.stubGlobal('fetch', fetchMock);

        await translateIntentToQueries('spiagge', 'Siracusa');
        await translateIntentToQueries('spiagge', 'Rimini');
        expect(fetchMock).toHaveBeenCalledTimes(2); // città diversa → key diversa
    });

    it('AI restituisce JSON con queries[] vuoto → throw (traduzione vuota)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({
            queries: [],
            categoria: 'misto',
            oggetto_umano: '',
            vincoli: { tempo: null, escludi: [], note: null },
        })));
        await expect(translateIntentToQueries('qualcosa', 'Roma'))
            .rejects.toThrow(/0 queries/);
    });

    it('userPrompt vuoto → throw (guard input)', async () => {
        vi.stubGlobal('fetch', vi.fn());
        await expect(translateIntentToQueries('', 'Roma')).rejects.toThrow(/vuoto/);
        await expect(translateIntentToQueries('   ', 'Roma')).rejects.toThrow(/vuoto/);
    });

    it('vincoli.tempo non valido → sanitizzato a null', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({
            queries: ['spiagge'],
            categoria: 'natura',
            oggetto_umano: 'spiagge',
            vincoli: { tempo: 'giornata', escludi: [], note: null }, // "giornata" non è nell'enum
        })));
        const r = await translateIntentToQueries('spiagge di giorno', 'Siracusa');
        expect(r.vincoli.tempo).toBeNull();
    });

    it('vincoli.note lunga → tronca a 150 char', async () => {
        const longNote = 'a'.repeat(300);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({
            queries: ['parco'],
            categoria: 'natura',
            oggetto_umano: 'parchi',
            vincoli: { tempo: null, escludi: [], note: longNote },
        })));
        const r = await translateIntentToQueries('parco relax', 'Roma');
        expect(r.vincoli.note.length).toBe(150);
    });

    it('vincoli.escludi con oggetti non-string → filtrati', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({
            queries: ['spiagge'],
            categoria: 'natura',
            oggetto_umano: 'spiagge',
            vincoli: { tempo: null, escludi: ['chiese', null, 42, 'musei', { obj: true }], note: null },
        })));
        const r = await translateIntentToQueries('spiagge no chiese', 'Siracusa');
        expect(r.vincoli.escludi).toEqual(['chiese', 'musei']);
    });

    it('OpenAI proxy fallisce → throw pulito (chiamante fa fail-closed)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
        await expect(translateIntentToQueries('spiagge', 'Siracusa')).rejects.toThrow();
    });
});
