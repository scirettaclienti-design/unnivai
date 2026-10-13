// ORARI — il motore intero (generateItinerary) con gli orari veri che porta la
// ricerca nuova: il modello sceglie un posto chiuso e il codice non lo serve;
// a quell'ora quasi tutto chiuso → messaggio dichiarato; mai una tappa chiusa.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { MESSAGGIO_CHIUSO } from '../../lib/openingHours';

const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const aKm = (km) => CABRAS.latitude + (km / 111);
const P = (day, open, close, closeDay = day) => ({ open: { day, time: open }, close: { day: closeDay, time: close } });
const tutti = (open, close) => [0, 1, 2, 3, 4, 5, 6].map(d => P(d, open, close));
const SEMPRE = [{ open: { day: 0, time: '0000' } }];
const place = (id, i, periods) => ({
    place_id: id, name: `Spiaggia ${id}`, geometry: { location: { lat: aKm(0.5 + i * 0.4), lng: CABRAS.longitude } },
    rating: 4.5, user_ratings_total: 300, business_status: 'OPERATIONAL',
    types: ['establishment', 'natural_feature', 'point_of_interest'],
    ...(periods ? { opening_hours: { open_now: true, periods } } : {}),
});
const INTENT = { queries: ['spiagge'], categoria: 'natura', oggetto_umano: 'spiagge', vincoli: { tempo: null, escludi: [], note: null } };
const ai = (payload) => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) });

// il modello sceglie SEMPRE tutti i posti, nell'ordine dato (anche i chiusi)
const routeFetch = (results) => {
    let n = 0;
    return vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            if (n++ === 0) return ai(INTENT);
            return ai({ days: [{ day: 1, stops: results.map(p => ({ place_id: p.place_id, description: 'x' })) }] });
        }
        if (u.includes('textsearch')) return { ok: true, json: async () => ({ status: 'OK', results: decodeURIComponent(u).includes('Cabras') ? results : [] }) };
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        return { ok: false, status: 404, json: async () => ({}) };
    });
};
const genera = async (results, ora, pathType = 'custom') => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`2026-10-14T${ora}:00+02:00`));
    vi.stubGlobal('fetch', routeFetch(results));
    return aiRecommendationService.generateItinerary('Cabras', { interests: ['Natura'] }, 'le spiagge piu belle', {}, '', CABRAS, { pathType });
};
const nomi = (r) => (r.days || []).flatMap(d => d.stops).filter(s => !s.tempoLibero).map(s => s.place_id);

beforeEach(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('flusso a momenti (pomeriggio)', () => {
    it('il modello sceglie il posto che apre alle 18 alle 15:00: il codice non lo serve, serve uno aperto', async () => {
        const chiuso = place('serale', 0, tutti('1800', '2300'));
        const aperto = place('aperto', 1, tutti('0900', '1900'));
        const r = await genera([chiuso, aperto], '15:00');
        const stops = r.days[0].stops.filter(s => !s.tempoLibero);
        expect(stops.find(s => s.moment === 'pomeriggio').place_id).toBe('aperto');
        // il posto che apre alle 18 non va nel pomeriggio; all'aperitivo (18:00) invece e' aperto e puo' entrare
        expect(stops.filter(s => s.place_id === 'serale').every(s => s.moment === 'aperitivo')).toBe(true);
        for (const s of stops) expect(s._tracciato?.orario).toBe('noto');
    });
    it('a quell\'ora tutto chiuso → messaggio dichiarato, non "non troviamo" e non un giro', async () => {
        const r = await genera([place('a', 0, tutti('1800', '2300')), place('b', 1, tutti('1800', '2300')), place('c', 2, tutti('1900', '2300'))], '15:00');
        expect(r._source).toBe('closed-now');
        expect(r._messaggio).toBe(MESSAGGIO_CHIUSO);
        expect(nomi(r)).toEqual([]);
    });
});

describe('flusso senza scheletro (sera tarda, Veloce)', () => {
    it('le tappe chiuse alle 23:40 si tolgono, le aperte restano; mai una chiusa', async () => {
        const risultati = [place('chiuso1', 0, tutti('0900', '1900')), place('notte1', 1, SEMPRE), place('chiuso2', 2, tutti('0900', '2000')), place('notte2', 3, SEMPRE)];
        const r = await genera(risultati, '23:40', 'quick');
        expect(nomi(r).sort()).toEqual(['notte1', 'notte2']);
    });
    it('2 tappe aperte su 4: il giro e\' piu\' corto e lo dichiara con la riga di tempo libero (c4)', async () => {
        const risultati = [place('chiuso1', 0, tutti('0900', '1900')), place('notte1', 1, SEMPRE), place('chiuso2', 2, tutti('0900', '2000')), place('notte2', 3, SEMPRE), place('chiuso3', 4, tutti('0900', '1800'))];
        const r = await genera(risultati, '23:40', 'quick');
        const righe = r.days[0].stops.filter(s => s.tempoLibero);
        expect(nomi(r).sort()).toEqual(['notte1', 'notte2']);
        expect(righe).toHaveLength(1);
        expect(righe[0].description).toMatch(/Tempo libero/);
        expect(r.days[0].stops.at(-1).tempoLibero).toBe(true);        // in coda al giro
        expect(r._orari.riga.chiuso).toBe(true);
    });
    it('nessuna chiusura: nessuna riga in piu\'', async () => {
        const r = await genera([place('n1', 0, SEMPRE), place('n2', 1, SEMPRE), place('n3', 2, SEMPRE)], '23:40', 'quick');
        expect(r.days[0].stops.filter(s => s.tempoLibero)).toHaveLength(0);
    });
    it('meno di 2 tappe aperte → messaggio dichiarato', async () => {
        const r = await genera([place('chiuso1', 0, tutti('0900', '1900')), place('chiuso2', 1, tutti('0900', '2000')), place('notte1', 2, SEMPRE)], '23:40', 'quick');
        expect(r._source).toBe('closed-now');
        expect(r._messaggio).toBe(MESSAGGIO_CHIUSO);
    });
});

describe('senza orari (ricerca vecchia)', () => {
    it('orario sconosciuto: nessun errore, nessun posto tolto, tappe segnate "sconosciuto"', async () => {
        const r = await genera([place('a', 0, null), place('b', 1, null), place('c', 2, null)], '15:00');
        expect(r._source).toBe('google-first');
        expect(nomi(r).length).toBeGreaterThan(0);
        for (const s of r.days[0].stops) expect(s._tracciato?.orario).toBe('sconosciuto');
        expect(r._orari.chiusi).toEqual([]);
    });
    it('a tarda sera, senza orari, il giro resta com\'e\' (niente messaggio)', async () => {
        const r = await genera([place('a', 0, null), place('b', 1, null), place('c', 2, null)], '23:40', 'quick');
        expect(r._source).toBe('google-first');
        expect(nomi(r).length).toBeGreaterThan(0);
        for (const s of r.days[0].stops) expect(s._orario).toBe('sconosciuto');
    });
});
