// ORARI — il motore intero (generateItinerary) con gli orari veri che porta la
// ricerca nuova: il modello sceglie un posto chiuso e il codice non lo serve;
// a quell'ora quasi tutto chiuso → messaggio dichiarato; mai una tappa chiusa.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { MESSAGGIO_ORA, MESSAGGIO_SERA } from '../../lib/openingHours';

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
        // C8a — il messaggio vale solo se NIENTE e' aperto: qui i tre posti aprono alle 06:00 e chiudono alle 07:00
        const r = await genera([place('a', 0, tutti('0600', '0700')), place('b', 1, tutti('0600', '0700')), place('c', 2, tutti('0600', '0700'))], '15:00');
        expect(r._source).toBe('closed-now');
        expect(r._messaggio).toBe(MESSAGGIO_ORA);
        expect(nomi(r)).toEqual([]);
    });
    it('C8a — con un solo posto aperto il giro esiste: niente messaggio (prima bastava avere meno di 2 tappe aperte)', async () => {
        const r = await genera([place('a', 0, tutti('1800', '2300')), place('b', 1, tutti('0600', '0700')), place('c', 2, tutti('0600', '0700'))], '15:00');
        expect(r._source).toBe('google-first');
        expect(nomi(r)).toEqual(['a']);
    });
});

// C8a — la sera tarda del Percorso Veloce non parte piu' senza scheletro: e' drink + passeggiata (+ cena se un
// locale e' aperto per tutta la sosta). "Quasi tutto chiuso" solo se nel pool non c'e' niente di aperto.
describe('Percorso Veloce, sera tarda (23:40): drink + passeggiata', () => {
    const bar = (id, i, periods) => ({
        place_id: id, name: `Bar ${id}`, primary_type: 'cocktail_bar', geometry: { location: { lat: aKm(0.5 + i * 0.4), lng: CABRAS.longitude } },
        rating: 4.6, user_ratings_total: 300, business_status: 'OPERATIONAL', types: ['cocktail_bar', 'bar', 'food', 'point_of_interest', 'establishment'],
        ...(periods ? { opening_hours: { open_now: true, periods } } : {}),
    });
    it('le tappe chiuse alle 23:40 si tolgono, le aperte restano; mai una chiusa', async () => {
        const risultati = [bar('bar-chiuso', 0, tutti('0900', '1900')), bar('bar-aperto', 1, SEMPRE), place('verde-chiuso', 2, tutti('0900', '2000')), place('verde-aperto', 3, SEMPRE)];
        const r = await genera(risultati, '23:40', 'quick');
        expect(nomi(r).sort()).toEqual(['bar-aperto', 'verde-aperto']);
    });
    it('il drink e\' un locale aperto e la passeggiata un luogo all\'aperto: il giro ha 2 tappe, in quest\'ordine', async () => {
        const r = await genera([bar('b1', 0, SEMPRE), bar('b2', 1, SEMPRE), place('p1', 2, SEMPRE), place('p2', 3, SEMPRE)], '23:40', 'quick');
        const vere = r.days[0].stops.filter(s => !s.tempoLibero);
        expect(vere.map(s => s.place_id)).toEqual([expect.stringMatching(/^b/), expect.stringMatching(/^p/)]);
        expect(vere[1].passeggiata).toBe(true);
        // mai un secondo bar, mai un ristorante
        expect(vere.filter(s => /^b/.test(s.place_id))).toHaveLength(1);
    });
    it('un locale aperto ma nessuna passeggiata aperta: il giro e\' il drink (un solo posto, dichiarato), non il messaggio di chiuso', async () => {
        const r = await genera([bar('b1', 0, SEMPRE), bar('b2', 3, SEMPRE), place('chiuso1', 1, tutti('0900', '1900')), place('chiuso2', 2, tutti('0900', '2000'))], '23:40', 'quick');
        expect(r._source).toBe('google-first');
        expect(nomi(r)).toHaveLength(1);
        expect(nomi(r)[0]).toMatch(/^b/);
        expect(r._singleStop).toBe(true);
    });
    it('nessuna chiusura: nessuna riga in piu\'', async () => {
        const r = await genera([bar('n1', 0, SEMPRE), place('n2', 1, SEMPRE), place('n3', 2, SEMPRE)], '23:40', 'quick');
        expect(r.days[0].stops.filter(s => s.tempoLibero)).toHaveLength(0);
    });
    it('niente di aperto per tutta la sosta → messaggio dichiarato', async () => {
        const r = await genera([bar('chiuso1', 0, tutti('0900', '1900')), place('chiuso2', 1, tutti('0900', '2000')), place('chiuso3', 2, tutti('0900', '1800'))], '23:40', 'quick');
        expect(r._source).toBe('closed-now');
        expect(r._messaggio).toBe(MESSAGGIO_SERA);
    });
});

describe('il messaggio notturno solo se le chiusure hanno tolto tappe', () => {
    const INTENT_CIBO = { queries: ['trattoria'], categoria: 'cibo', oggetto_umano: 'trattorie', vincoli: { tempo: null, escludi: [], note: null } };
    const ristorante = (id, i, periods) => ({
        place_id: id, name: `Trattoria ${id}`, geometry: { location: { lat: aKm(0.5 + i * 0.3), lng: CABRAS.longitude } },
        rating: 4.6, user_ratings_total: 400, business_status: 'OPERATIONAL', types: ['restaurant', 'food', 'point_of_interest', 'establishment'],
        ...(periods ? { opening_hours: { open_now: true, periods } } : {}),
    });
    const generaCibo = async (results, ora) => {
        window.localStorage.clear();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(`2026-10-14T${ora}:00+02:00`));
        let n = 0;
        vi.stubGlobal('fetch', vi.fn(async (url) => {
            const u = String(url);
            if (u.includes('openai-proxy')) return ai(n++ === 0 ? INTENT_CIBO : { days: [{ day: 1, stops: results.map(p => ({ place_id: p.place_id, moment: 'g1-cena' })) }] });
            if (u.includes('textsearch')) return { ok: true, json: async () => ({ status: 'OK', results: decodeURIComponent(u).includes('Cabras') ? results : [] }) };
            return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        }));
        return aiRecommendationService.generateItinerary('Cabras', {}, 'una cena a Cabras', {}, '', CABRAS, { pathType: 'custom' });
    };
    it('il giro ha una sola tappa per costruzione (la cena) e c\'e\' un posto aperto: resta il giro, niente messaggio', async () => {
        const r = await generaCibo([ristorante('chiusa', 0, tutti('1900', '1930')), ristorante('aperta', 1, tutti('1800', '2359'))], '20:15');
        expect(r._source).toBe('google-first');
        expect(nomi(r)).toEqual(['aperta']);
    });
    it('lo stesso giro ma nessun locale aperto: il messaggio dichiarato', async () => {
        const r = await generaCibo([ristorante('chiusa1', 0, tutti('1900', '1930')), ristorante('chiusa2', 1, tutti('1000', '1500'))], '20:15');
        expect(r._source).toBe('closed-now');
        expect(r._messaggio).toBe(MESSAGGIO_SERA);
    });
});

describe('senza orari (ricerca vecchia)', () => {
    it('orario sconosciuto: nessun errore, nessun posto tolto, tappe segnate "sconosciuto"', async () => {
        const r = await genera([place('a', 0, null), place('b', 1, null), place('c', 2, null)], '15:00');
        expect(r._source).toBe('google-first');
        expect(nomi(r).length).toBeGreaterThan(0);
        for (const s of r.days[0].stops.filter(x => !x.tempoLibero)) expect(s._tracciato?.orario).toBe('sconosciuto');
        expect(r._orari.chiusi).toEqual([]);
    });
    it('a tarda sera, senza orari, il giro resta com\'e\' (niente messaggio)', async () => {
        const r = await genera([place('a', 0, null), place('b', 1, null), place('c', 2, null)], '23:40', 'quick');
        expect(r._source).toBe('google-first');
        expect(nomi(r).length).toBeGreaterThan(0);
        for (const s of r.days[0].stops) expect(s._orario).toBe('sconosciuto');
    });
});
