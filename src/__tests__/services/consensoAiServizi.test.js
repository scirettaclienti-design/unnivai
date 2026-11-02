// ACCOUNT-PRIVACY — senza il consenso ai servizi AI di terzi NON parte nessuna richiesta di rete verso openai-proxy:
// giri, chat, racconti, curiosità, voce. E lo dicono. (Il cancello è mockato in setup.js; qui lo si nega.)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as consenso from '@/lib/consensoAi';
import { CONSENSO_AI } from '../../lib/testiAccount';

let fetchMock;
beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    fetchMock = vi.fn(async () => { throw new Error('fetch inatteso: senza consenso non deve partire niente'); });
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(consenso.consensoAiDato).mockResolvedValue(false);
    vi.mocked(consenso.assicuraConsensoAi).mockResolvedValue(false);
    vi.mocked(consenso.richiediConsensoAi).mockImplementation(async () => { throw new consenso.ConsensoAiError(); });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('senza consenso, niente rete', () => {
    it('il giro: generateItinerary lancia ConsensoAiError (testo onesto) e non chiama nessuno', async () => {
        const { aiRecommendationService } = await import('../../services/aiRecommendationService');
        const err = await aiRecommendationService.generateItinerary('Roma', { interests: ['Arte'] }, 'un giro', {}, '', { latitude: 41.9, longitude: 12.5 }).catch((e) => e);
        expect(consenso.isConsensoAiError(err)).toBe(true);
        expect(err.userMessage).toBe(CONSENSO_AI.SENZA);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('la chat: risponde col testo del consenso, senza chiamare il server', async () => {
        const { chiediAllaGuida } = await import('../../services/chatGuidaService');
        const r = await chiediAllaGuida({ domanda: 'Cos\'è questo posto?', storia: [], citta: 'Roma', tappe: [], aperto: null, prossima: null, centro: null });
        expect(r.testo).toBe(CONSENSO_AI.BLOCCATO);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('il racconto: null e nessuna richiesta', async () => {
        const { richiediRacconto } = await import('../../services/raccontoService');
        const r = await richiediRacconto({ id: 's', place_id: 'ChIJabc', name: 'Fontana', latitude: 41.9, longitude: 12.48, types: ['tourist_attraction'] }, 'Roma');
        expect(r).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('la curiosità: null, e nemmeno la richiesta di via e quartiere a Nominatim', async () => {
        const { richiediCuriosita } = await import('../../services/curiositaService');
        expect(await richiediCuriosita({ lat: 41.9, lng: 12.48, citta: 'Roma' })).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('la voce umana: non parte (parla la voce del telefono)', async () => {
        vi.resetModules();
        const voce = await import('../../lib/voce.js');
        const r = await voce.parla('Fra cinquanta metri gira a sinistra.').catch((e) => e);
        expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('openai-proxy'))).toHaveLength(0);
        expect(r).not.toBe('nuova');
    });
});
