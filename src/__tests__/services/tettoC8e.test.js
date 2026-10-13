// C8e — il tetto conta solo le visite; la tappa leggera segue il tipo principale.
//   · pasti (colazione, pranzo, drink, cena) e passeggiata non contano nel tetto: una giornata con colazione (9 tappe, 4 visite) puo'
//     ancora riempire il vuoto della mattina;
//   · ritmo Rilassato: al massimo 6 visite; giornata: 8;
//   · un posto con tipo principale ristorante non e' un caffe' (mai tappa leggera), anche con `cafe` fra i tipi.
// Scenario: Cabras, mercoledi' 14/10/2026 (fuso di Roma esplicito: la CI gira in UTC).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { isLightStop } from '../../lib/mealRules';
import { momentsToExpand } from '../../services/momentSelection';
import { buildDaySkeleton, visitCount, visitStops } from '../../lib/daySkeleton';
import { resolveTourWindow, romeParts } from '../../lib/tourWindow';

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
const caffe = (id, km) => luogo(id, km, { name: `Caffè ${id}`, types: ['cafe', 'food', 'point_of_interest', 'establishment'], primary: 'cafe', periods: tutti('0700', '2300') });
const bar = (id, km) => luogo(id, km, { name: `Bar ${id}`, types: ['cocktail_bar', 'bar', 'food', 'point_of_interest', 'establishment'], primary: 'cocktail_bar', periods: tutti('1000', '2300') });
const osteria = (id, km) => luogo(id, km, { name: `Osteria ${id}`, types: ['italian_restaurant', 'restaurant', 'food', 'point_of_interest', 'establishment'], primary: 'italian_restaurant', periods: tutti('1000', '2300') });
const aperto = (id, km, name, types = ['tourist_attraction', 'point_of_interest', 'establishment'], primary = null) => luogo(id, km, { name, types, primary, rec: 100 + Math.round(km * 40) });
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
const ora = (s) => { const p = romeParts(new Date(s.scheduledTime)); return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`; };

beforeEach(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('C8e — il tetto conta solo le visite', () => {
    it('lo scheletro: la colazione, il pranzo, il drink, la cena non sono visite', () => {
        const requestTime = new Date('2026-10-14T08:00:00+02:00');
        const win = resolveTourWindow({ text: 'Una giornata con colazione', requestTime, pathType: 'custom', duration: '1 Giorno' });
        const moments = buildDaySkeleton({ window: win, pace: 'Attivo', text: 'Una giornata con colazione' }).days[0].moments;
        const totale = moments.reduce((n, m) => n + m.stops, 0);
        expect(totale).toBe(8);                       // 3 (colazione + 2 visite) + 1 + 2 + 1 + 1
        expect(visitCount(moments)).toBe(4);
        expect(visitStops(moments.find(m => m.key === 'mattina'))).toBe(2);
        expect(moments.every(m => m.tettoVisite === 8)).toBe(true);
    });
    it('ritmo Rilassato: il tetto e\' 6 visite; momentsToExpand non ne aggiunge oltre', () => {
        const requestTime = new Date('2026-10-14T09:30:00+02:00');
        const win = resolveTourWindow({ text: '', requestTime, pathType: 'custom', duration: '1 Giorno' });
        const sk = buildDaySkeleton({ window: win, pace: 'Rilassato' }).days[0].moments;
        expect(sk.every(m => m.tettoVisite === 6)).toBe(true);
        const day = (visiteMattina, visitePomeriggio) => [
            { id: 'g1-mattina', key: 'mattina', dayIndex: 0, stops: visiteMattina, tettoVisite: 6, start: new Date('2026-10-14T09:30:00+02:00'), end: new Date('2026-10-14T12:30:00+02:00'), minutes: 180 },
            { id: 'g1-pranzo', key: 'pranzo', dayIndex: 0, stops: 1, tettoVisite: 6, start: new Date('2026-10-14T12:30:00+02:00'), end: new Date('2026-10-14T14:30:00+02:00'), minutes: 120 },
            { id: 'g1-pomeriggio', key: 'pomeriggio', dayIndex: 0, stops: visitePomeriggio, tettoVisite: 6, start: new Date('2026-10-14T14:30:00+02:00'), end: new Date('2026-10-14T18:00:00+02:00'), minutes: 210 },
        ];
        const gap = { dayIndex: 0, from: new Date('2026-10-14T10:00:00+02:00'), to: new Date('2026-10-14T17:00:00+02:00'), minutes: 420 };
        expect(momentsToExpand(gap, day(3, 3))).toEqual([]);                  // 6 visite: al tetto
        expect(momentsToExpand(gap, day(3, 4))).toEqual([]);                  // 7 candidate: oltre il tetto, non se ne aggiunge
        expect(momentsToExpand(gap, day(3, 2)).length).toBeGreaterThan(0);    // 5 visite: si puo'
    });
    it('Catania-8:00: 9 tappe, 4 visite e un vuoto di ore la mattina: il tetto non lo blocca piu\', il vuoto scende a 45 minuti', async () => {
        const pool = [
            aperto('p1', 0.5, 'Piazza p1'), aperto('p2', 0.6, 'Fontana p2'), aperto('p3', 0.7, 'Porta p3'), aperto('p4', 0.8, 'Belvedere p4'),
            aperto('p5', 0.9, 'Lungomare p5'), aperto('p6', 1.0, 'Villa p6', ['park', 'point_of_interest'], 'park'),
            aperto('h1', 0.65, 'Chiesa h1', ['church', 'place_of_worship', 'point_of_interest'], 'church'),
            aperto('h2', 0.95, 'Chiesa h2', ['church', 'place_of_worship', 'point_of_interest'], 'church'),
            luogo('m1', 0.75, { name: 'Museo m1', types: ['museum', 'tourist_attraction'], primary: 'museum', periods: tutti('0930', '1800') }),
            osteria('r1', 1.2), osteria('r2', 1.3), bar('b1', 0.55), bar('b2', 0.58),
        ];
        const r = await genera(pool, '08:00', { prefs: { duration: '1 Giorno', pace: 'Attivo', interests: [] }, testo: 'Una giornata a Cabras con colazione', colazione: [caffe('c1', 0.3)] });
        const mattina = righe(r).filter(s => s.moment === 'mattina');
        const libero = mattina.filter(s => s.tempoLibero).reduce((a, s) => a + (s.stayMinutes || 0), 0);
        expect(ora(vere(r)[0])).toBe('08:00');
        expect(mattina.filter(s => !s.tempoLibero).length).toBeGreaterThan(3);
        expect(libero).toBeLessThanOrEqual(45);
    });
});

describe('C8e — la tappa leggera segue il tipo principale (C6a)', () => {
    const cornerAB = { place_id: 'q1', name: 'Corner AB', primaryType: 'restaurant', types: ['coffee_shop', 'cafe', 'cocktail_bar', 'bar', 'restaurant', 'food'] };
    it('un posto con tipo principale restaurant non e\' una tappa leggera, anche con cafe fra i tipi', () => {
        expect(isLightStop(cornerAB)).toBe(false);
    });
    it('un caffe\' (tipo principale cafe), un luogo all\'aperto, una chiesa sì; un cocktail bar, un museo no', () => {
        expect(isLightStop({ name: 'Caffè Centrale', primaryType: 'cafe', types: ['cafe', 'food'] })).toBe(true);
        expect(isLightStop({ name: 'Piazza Duomo', types: ['tourist_attraction'] })).toBe(true);
        expect(isLightStop({ name: 'Chiesa X', primaryType: 'church', types: ['church'] })).toBe(true);
        expect(isLightStop({ name: 'Bar Luna', primaryType: 'cocktail_bar', types: ['cocktail_bar', 'bar'] })).toBe(false);
        expect(isLightStop({ name: 'Museo X', primaryType: 'museum', types: ['museum'] })).toBe(false);
    });
});
