// C8d — i vuoti giusti: mattina presto e pomeriggio lento.
//   · dopo la colazione chiesta niente altro cibo fino al pranzo (pasticceria, bar, gelato): le tappe seguenti sono visite aperte;
//   · con luoghi all'aperto aperti nel pool il tempo libero della mattina e' al massimo 45 minuti (se il tetto delle 8 tappe lo permette);
//   · ritmo Rilassato: fino a 90 minuti di vuoto resta il tempo libero dichiarato (CONTINUITA'); oltre, UNA tappa leggera dal pool.
// Scenario: Cabras, mercoledi' 14/10/2026 (fuso di Roma esplicito: la CI gira in UTC).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { isLightStop } from '../../lib/mealRules';
import { romeParts } from '../../lib/tourWindow';

const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const aKm = (km) => CABRAS.latitude + (km / 111);
const P = (day, open, close) => ({ open: { day, time: open }, close: { day, time: close } });
const tutti = (open, close) => [0, 1, 2, 3, 4, 5, 6].map(d => P(d, open, close));
const SEMPRE = [{ open: { day: 0, time: '0000' } }];
const luogo = (id, km, { name, types, primary = null, periods = SEMPRE, rec = 300 }) => ({
    place_id: id, name, ...(primary ? { primary_type: primary } : {}),
    geometry: { location: { lat: aKm(km), lng: CABRAS.longitude } },
    rating: 4.5, user_ratings_total: rec, business_status: 'OPERATIONAL', types,
    ...(periods ? { opening_hours: { open_now: true, periods } } : {}),
});
const caffe = (id, km, periods = tutti('0700', '2300')) => luogo(id, km, { name: `Caffè ${id}`, types: ['cafe', 'food', 'point_of_interest', 'establishment'], primary: 'cafe', periods });
const pasticceria = (id, km, periods = tutti('0700', '2300')) => luogo(id, km, { name: `Pasticceria ${id}`, types: ['bakery', 'food', 'point_of_interest', 'establishment'], primary: 'bakery', periods });
const piazza = (id, km, rec = 300) => luogo(id, km, { name: `Piazza ${id}`, types: ['tourist_attraction', 'point_of_interest', 'establishment'], rec });
const museo = (id, km, periods = tutti('0930', '1800')) => luogo(id, km, { name: `Museo ${id}`, types: ['museum', 'tourist_attraction', 'point_of_interest', 'establishment'], primary: 'museum', periods });
const osteria = (id, km) => luogo(id, km, { name: `Osteria ${id}`, types: ['italian_restaurant', 'restaurant', 'food', 'point_of_interest', 'establishment'], primary: 'italian_restaurant', periods: tutti('1000', '2300') });

const INTENT = { queries: ['locali'], categoria: 'misto', oggetto_umano: 'locali', vincoli: { tempo: null, escludi: [], note: null } };
const ai = (payload) => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) });
const routeFetch = (results, colazione = []) => {
    let n = 0;
    return vi.fn(async (url, init) => {
        const u = decodeURIComponent(String(url)).replace(/\+/g, ' ');
        if (u.includes('openai-proxy')) {
            if (n++ === 0) return ai(INTENT);
            const sys = JSON.parse(init.body).messages?.[0]?.content || '';
            const righe = [...sys.matchAll(/•\s+(g\d+-[a-z]+)\s+—.*?ESATTAMENTE\s+(\d+).*?candidati:\s+(\[[^\]]*\])/g)];
            return ai({ stops: righe.flatMap(m => JSON.parse(m[3]).slice(0, Number(m[2])).map(id => ({ place_id: id, moment: m[1] }))) });
        }
        if (u.includes('textsearch')) return { ok: true, json: async () => ({ status: 'OK', results: u.includes('Cabras') ? (/colazione caffetteria/.test(u) ? colazione : results) : [] }) };
        return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
    });
};
const genera = async (results, ora, { prefs, testo, colazione = [] }) => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`2026-10-14T${ora}:00+02:00`));
    vi.stubGlobal('fetch', routeFetch(results, colazione));
    return aiRecommendationService.generateItinerary('Cabras', prefs, testo, {}, '', CABRAS, { pathType: 'custom' });
};
const righe = (r) => r.days[0].stops;
const vere = (r) => righe(r).filter(s => !s.tempoLibero);
const libere = (r) => righe(r).filter(s => s.tempoLibero);
const ora = (s) => { const p = romeParts(new Date(s.scheduledTime)); return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`; };
const cibo = (s) => /^(c|f|q)\d/.test(s.place_id);

beforeEach(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('C8d — dopo la colazione niente altro cibo fino al pranzo', () => {
    const PREFS = { duration: '1 Giorno', pace: 'Attivo', interests: [] };
    const POOL = [piazza('p1', 0.5, 200), piazza('p2', 0.7, 150), piazza('p3', 0.9, 120), piazza('p4', 1.1, 100), museo('m1', 1.0),
        caffe('c2', 0.45), pasticceria('f1', 0.35), pasticceria('f2', 0.55), osteria('r1', 1.2), osteria('r2', 1.3)];
    it('colazione alle 8:00: la prima tappa e\' un caffè, poi nessuna pasticceria ne\' altro locale fino al pranzo', async () => {
        const r = await genera(POOL, '08:00', { prefs: PREFS, testo: 'Una giornata a Cabras con colazione', colazione: [caffe('c1', 0.3), caffe('c3', 0.6), pasticceria('f3', 0.4)] });
        const mattina = vere(r).filter(s => s.moment === 'mattina');
        expect(mattina.length).toBeGreaterThan(1);
        expect(cibo(mattina[0])).toBe(true);
        expect(ora(mattina[0])).toBe('08:00');
        for (const s of mattina.slice(1)) expect(cibo(s), s.title).toBe(false);
    });
    it('con luoghi all\'aperto aperti nel pool il tempo libero della mattina e\' al massimo 45 minuti', async () => {
        const r = await genera([...POOL, piazza('p5', 1.3, 90), piazza('p6', 1.5, 80)], '08:00', { prefs: { duration: 'Mezza Giornata', pace: 'Attivo', interests: [] }, testo: 'Una mattina a Cabras con colazione', colazione: [caffe('c1', 0.3)] });
        const mattina = righe(r).filter(s => s.moment === 'mattina');
        const liberi = mattina.filter(s => s.tempoLibero).reduce((a, s) => a + (s.stayMinutes || 0), 0);
        expect(vere(r).filter(s => s.moment === 'mattina').length).toBeGreaterThan(2);
        expect(liberi).toBeLessThanOrEqual(45);
    });
});

describe('C8d — ritmo Rilassato: il vuoto lungo ha UNA tappa leggera', () => {
    it('isLightStop: all\'aperto, caffè, chiesa sì; museo, ristorante, pasticceria no', () => {
        expect(isLightStop(piazza('p1', 0.5))).toBe(true);
        expect(isLightStop(caffe('c1', 0.5))).toBe(true);
        expect(isLightStop({ name: 'Chiesa X', types: ['church'], primaryType: 'church' })).toBe(true);
        expect(isLightStop(museo('m1', 0.5))).toBe(false);
        expect(isLightStop(osteria('r1', 0.5))).toBe(false);
        expect(isLightStop(pasticceria('f1', 0.5))).toBe(false);
    });
});

describe('C8d — ritmo Rilassato: oltre 90 minuti di vuoto UNA tappa leggera, fino a 90 resta il tempo libero', () => {
    const PREFS = { duration: '1 Giorno', pace: 'Rilassato', interests: [] };
    const bar = (id, km) => luogo(id, km, { name: `Bar ${id}`, types: ['cocktail_bar', 'bar', 'food', 'point_of_interest', 'establishment'], primary: 'cocktail_bar', periods: tutti('1000', '2300') });
    const POOL = [
        luogo('v1', 0.72, { name: 'Belvedere v1', types: ['tourist_attraction', 'point_of_interest'] }),
        luogo('f1', 0.74, { name: 'Fontana f1', types: ['tourist_attraction', 'point_of_interest'] }),
        luogo('x1', 0.76, { name: 'Porta x1', types: ['tourist_attraction', 'point_of_interest'] }),
        luogo('g1', 0.9, { name: 'Giardino g1', types: ['park', 'point_of_interest'], primary: 'park' }),
        luogo('h1', 0.8, { name: 'Chiesa h1', types: ['church', 'place_of_worship', 'point_of_interest'], primary: 'church' }),
        piazza('p1', 0.85), piazza('p2', 0.7, 100), museo('m1', 0.75, tutti('0900', '1800')),
        osteria('r1', 1.0), osteria('r2', 1.1), bar('b1', 0.6), bar('b2', 0.65),
    ];
    const mattina = (r) => ({ vere: vere(r).filter(s => s.moment === 'mattina'), libere: libere(r).filter(s => s.moment === 'mattina') });
    it('vuoto della mattina di 150 minuti (partenza 9:30): UNA tappa leggera in piu\', il resto resta tempo libero dichiarato', async () => {
        const r = await genera(POOL, '09:30', { prefs: PREFS, testo: 'Una giornata a Cabras' });
        const m = mattina(r);
        expect(m.vere).toHaveLength(2);
        expect(m.vere.every(s => isLightStop({ ...s, name: s.title }))).toBe(true);
        expect(m.libere).toHaveLength(1);
        expect(m.libere[0].description).toMatch(/^Tempo libero:/);
    });
    it('vuoto della mattina di 86 minuti (partenza 10:30): nessuna tappa in piu\', tempo libero dichiarato', async () => {
        const r = await genera(POOL, '10:30', { prefs: PREFS, testo: 'Una giornata a Cabras' });
        const m = mattina(r);
        expect(m.vere).toHaveLength(1);
        expect(m.libere).toHaveLength(1);
        expect(m.libere[0].stayMinutes).toBeLessThanOrEqual(90);
        expect(m.libere[0].stayMinutes).toBeGreaterThan(45);
    });
    it('vuoto lungo ma nessuna tappa leggera nel pool (solo un museo): resta il tempo libero', async () => {
        const solo = [piazza('p2', 0.7, 100), museo('m1', 0.75, tutti('0900', '1800')), osteria('r1', 1.0), osteria('r2', 1.1), bar('b1', 0.6), bar('b2', 0.65)];
        const r = await genera(solo, '09:30', { prefs: PREFS, testo: 'Una giornata a Cabras' });
        const m = mattina(r);
        expect(m.vere.map(s => s.place_id)).not.toContain('m1');
        expect(m.libere.length).toBeGreaterThan(0);
    });
    it('con ritmo Attivo la regola e\' quella di sempre (nessuna tappa «leggera» riservata)', async () => {
        const r = await genera(POOL, '09:30', { prefs: { ...PREFS, pace: 'Attivo' }, testo: 'Una giornata a Cabras' });
        expect(mattina(r).vere.length).toBeGreaterThanOrEqual(2);
    });
});
