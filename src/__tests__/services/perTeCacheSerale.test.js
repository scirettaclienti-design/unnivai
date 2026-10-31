// PER-TE-PROPOSTE — le ricerche dei temi di sera (decisione di Ivano: vanno bene solo con una cache per città e fascia oraria condivisa
// fra gli utenti). La cache c'è già sul server: places-proxy salva ogni risposta in public.places_cache per 24 ore con la chiave =
// path + parametri ordinati (computeCacheKey), uguale per tutti. Qui si prova che le richieste di sera NON hanno niente dell'utente:
// stessa città → stessa URL a ogni ora della sera e per ogni utente; la query del cibo cambia solo con la fascia.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { placesDiscoveryService, foodQueryForClock, FOOD_QUERY_COLAZIONE } from '../../services/placesDiscoveryService';
import { riferimentoPerDopo } from '../../lib/perTeProposte';

const ROMA = { lat: 41.8933203, lng: 12.4829321 };

let urls;
beforeEach(() => {
    urls = [];
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async (u) => {
        urls.push(String(u));
        return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) };
    }));
});
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

// Le richieste di un'apertura di Per Te alla sera (ora = la prima proposta per dopo, come DashboardUser), senza parametri di cache del client.
async function richiesteDiSera(adesso, foodPrefs = null) {
    urls = [];
    localStorage.clear(); // un altro telefono: nessuna cache del client
    await placesDiscoveryService.discoverAllThemes('Roma', ROMA.lat, ROMA.lng, { foodPrefs, ora: riferimentoPerDopo(adesso).data });
    return urls.map(u => { const p = new URL(u, 'http://x').searchParams; p.delete('key'); return [...p.entries()].sort().map(e => e.join('=')).join('&'); }).sort();
}

describe('Per Te di sera: le ricerche dei temi sono le stesse per tutti (cache del server condivisa per città e fascia)', () => {
    it('alle 20:00, alle 21:30 e all’1:00 le richieste sono identiche: nessun dato dell’utente, nessun orario nei parametri', async () => {
        const a = await richiesteDiSera(new Date('2026-10-31T20:00:00+01:00'));
        const b = await richiesteDiSera(new Date('2026-10-31T21:30:00+01:00'));
        const c = await richiesteDiSera(new Date('2026-11-01T01:00:00+01:00'));
        expect(a.length).toBeGreaterThanOrEqual(4);
        expect(b).toEqual(a);
        expect(c).toEqual(a);
        for (const q of a) expect(q).not.toMatch(/opennow|sessiontoken|user|uid|time/i);
    });

    it('di sera il cibo si cerca con la query della colazione (la fascia delle 9:30), la stessa di chi apre Per Te la mattina presto', async () => {
        expect(foodQueryForClock(riferimentoPerDopo(new Date('2026-10-31T20:00:00+01:00')).data)).toBe(FOOD_QUERY_COLAZIONE);
        const sera = await richiesteDiSera(new Date('2026-10-31T20:00:00+01:00'));
        expect(sera.some(q => decodeURIComponent(q.replace(/\+/g, ' ')).includes(FOOD_QUERY_COLAZIONE))).toBe(true);
    });
});
