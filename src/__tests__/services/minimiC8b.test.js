// C8b — i minimi di tappe, la cena tardi, Per Te nelle sue ore.
//   · 6 ore o piu' → almeno 4 tappe; 3–6 ore → almeno 3; meno di 3 ore → almeno 2; mai 1. Le righe di tempo libero non sono tappe.
//     Di sera drink + cena (o + passeggiata) e' un giro completo. Se il pool non arriva al minimo: ripiego dichiarato.
//   · Chi parte fra le 21:00 e le 22:00 cena per primo (poi la passeggiata).
//   · Per Te: ristorante solo a pranzo e cena, colazione la mattina, e di sera il giro della sera.
// Scenario: Cabras, mercoledi' 14/10/2026 (fuso di Roma esplicito: la CI gira in UTC).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { minStopsForWindow, isEveningComplete, remainingGaps } from '../../lib/continuity';
import { mealFitsClock, perTeMealProblem, isBreakfastPlace } from '../../lib/mealRules';
import { foodQueryForClock, FOOD_QUERY_COLAZIONE, FOOD_QUERY_MERENDA, placesDiscoveryService } from '../../services/placesDiscoveryService';
import { buildDaySkeleton, addEveningWalk, isSeraStart } from '../../lib/daySkeleton';
import { resolveTourWindow, romeParts } from '../../lib/tourWindow';
import { MESSAGGIO_SERA } from '../../lib/openingHours';

const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const aKm = (km) => CABRAS.latitude + (km / 111);
const P = (day, open, close, closeDay = day) => ({ open: { day, time: open }, close: { day: closeDay, time: close } });
const tutti = (open, close) => [0, 1, 2, 3, 4, 5, 6].map(d => P(d, open, close));
const SEMPRE = [{ open: { day: 0, time: '0000' } }];
const TARDI = tutti('1000', '2359').map(p => ({ ...p, close: { day: (p.open.day + 1) % 7, time: '0100' } }));
const luogo = (id, i, { name, types, primary = null, periods = SEMPRE, km = 0.4 + i * 0.25 }) => ({
    place_id: id, name, ...(primary ? { primary_type: primary } : {}),
    geometry: { location: { lat: aKm(km), lng: CABRAS.longitude } },
    rating: 4.5, user_ratings_total: 300, business_status: 'OPERATIONAL', types,
    ...(periods ? { opening_hours: { open_now: true, periods } } : {}),
});
const spiaggia = (id, i, periods) => luogo(id, i, { name: `Spiaggia ${id}`, types: ['natural_feature', 'point_of_interest', 'establishment'], km: 0.5 + i * 0.3, periods });
const bar = (id, i, periods) => luogo(id, i, { name: `Bar ${id}`, types: ['cocktail_bar', 'bar', 'food', 'point_of_interest', 'establishment'], primary: 'cocktail_bar', periods });
const caffe = (id, i, periods) => luogo(id, i, { name: `Caffè ${id}`, types: ['cafe', 'food', 'point_of_interest', 'establishment'], primary: 'cafe', periods });
const forno = (id, i, periods) => luogo(id, i, { name: `Forno ${id}`, types: ['bakery', 'food', 'point_of_interest', 'establishment'], primary: 'bakery', periods });
const osteria = (id, i, periods) => luogo(id, i, { name: `Osteria ${id}`, types: ['italian_restaurant', 'restaurant', 'food', 'point_of_interest', 'establishment'], primary: 'italian_restaurant', periods });
const piazza = (id, i, periods) => luogo(id, i, { name: `Piazza ${id}`, types: ['tourist_attraction', 'point_of_interest', 'establishment'], periods });

const INTENT_NATURA = { queries: ['spiagge'], categoria: 'natura', oggetto_umano: 'spiagge', vincoli: { tempo: null, escludi: [], note: null } };
const INTENT_MISTO = { queries: ['locali'], categoria: 'misto', oggetto_umano: 'locali', vincoli: { tempo: null, escludi: [], note: null } };
const ai = (payload) => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) });
// il selettore prende il primo candidato di ogni momento, letto dal prompt
const routeFetch = (results, intent) => {
    let n = 0;
    return vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            if (intent && n++ === 0) return ai(intent);
            const sys = JSON.parse(init.body).messages?.[0]?.content || '';
            const righe = [...sys.matchAll(/•\s+(g\d+-[a-z]+)\s+—.*?ESATTAMENTE\s+(\d+).*?candidati:\s+(\[[^\]]*\])/g)];
            return ai({ stops: righe.flatMap(m => JSON.parse(m[3]).slice(0, Number(m[2])).map(id => ({ place_id: id, moment: m[1] }))) });
        }
        if (u.includes('textsearch')) return { ok: true, json: async () => ({ status: 'OK', results: decodeURIComponent(u).includes('Cabras') ? results : [] }) };
        return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
    });
};
const genera = async (results, ora, { pathType = 'custom', prefs = {}, testo = 'le spiagge piu belle', intent = INTENT_NATURA } = {}) => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`2026-10-14T${ora}:00+02:00`));
    vi.stubGlobal('fetch', routeFetch(results, intent));
    return aiRecommendationService.generateItinerary('Cabras', prefs, testo, {}, '', CABRAS, { pathType });
};
const righe = (r) => r.days[0].stops;
const vere = (r) => righe(r).filter(s => !s.tempoLibero);
const libere = (r) => righe(r).filter(s => s.tempoLibero);
const ora = (s) => { const p = romeParts(new Date(s.scheduledTime)); return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`; };

beforeEach(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('C8b — il minimo di tappe per la durata (parti pure)', () => {
    it('meno di 3 ore → 2, da 3 a 6 ore → 3, 6 ore o piu\' → 4', () => {
        expect(minStopsForWindow(60)).toBe(2);
        expect(minStopsForWindow(120)).toBe(2);
        expect(minStopsForWindow(179)).toBe(2);
        expect(minStopsForWindow(180)).toBe(3);
        expect(minStopsForWindow(240)).toBe(3);
        expect(minStopsForWindow(359)).toBe(3);
        expect(minStopsForWindow(360)).toBe(4);
        expect(minStopsForWindow(780)).toBe(4);
        expect(minStopsForWindow(NaN)).toBe(2);
    });
    it('un giro serale completo: drink + cena, drink + passeggiata, cena + passeggiata; il solo drink o la sola cena no', () => {
        const e = (key, bevuta = false) => ({ moment: { key, ...(bevuta ? { bevuta: true } : {}) } });
        expect(isEveningComplete([e('aperitivo', true), e('cena')])).toBe(true);
        expect(isEveningComplete([e('aperitivo', true), e('passeggiata')])).toBe(true);
        expect(isEveningComplete([e('cena'), e('passeggiata')])).toBe(true);
        expect(isEveningComplete([e('aperitivo', true)])).toBe(false);
        expect(isEveningComplete([e('cena')])).toBe(false);
        expect(isEveningComplete([])).toBe(false);
    });
});

describe('C8b — un tour sotto il minimo prende una tappa in piu\' o lo dichiara', () => {
    const PREFS_RIL = { interests: ['Natura'], duration: 'Mezza Giornata', pace: 'Rilassato' };
    it('4 ore (14:30–18:30), ritmo Rilassato (1 tappa per momento): 2 tappe prima, 3 ora — il minimo vale sulla scelta del ritmo', async () => {
        const r = await genera([0, 1, 2, 3, 4].map(i => spiaggia(`s${i}`, i)), '14:30', { prefs: PREFS_RIL });
        expect(r._source).toBe('google-first');
        expect(vere(r).length).toBeGreaterThanOrEqual(3);
        expect(r._momentReport.continuita.minimo.richiesto['0']).toBe(3);
        expect(r._momentReport.continuita.minimo.aggiunte.length).toBeGreaterThan(0);
        expect(remainingGaps(righe(r))).toEqual([]);
    });
    it('4 ore con un pool di soli 2 posti: 2 tappe e la riga di tempo libero che lo dichiara (mai un tour corto in silenzio)', async () => {
        const r = await genera([spiaggia('s0', 0), spiaggia('s1', 1)], '14:30', { prefs: PREFS_RIL });
        expect(vere(r)).toHaveLength(2);
        expect(libere(r).length).toBeGreaterThan(0);
        expect(libere(r)[0].description).toMatch(/Tempo libero/);
        expect(r._momentReport.continuita.minimo.dichiarati.length).toBeGreaterThan(0);
    });
    it('6 ore o piu\' (Percorso Veloce Lungo): almeno 4 tappe', async () => {
        const r = await genera([0, 1, 2, 3, 4, 5, 6].map(i => spiaggia(`s${i}`, i)), '10:00', { pathType: 'quick', prefs: { interests: ['Natura'], duration: 'Lungo' } });
        expect(vere(r).length).toBeGreaterThanOrEqual(4);
    });
    it('meno di 3 ore: almeno 2, mai 1 (un solo posto nel pool → dichiarato)', async () => {
        const uno = await genera([spiaggia('s0', 0)], '10:00', { pathType: 'quick', prefs: { interests: ['Natura'], duration: 'Veloce' } });
        expect(vere(uno)).toHaveLength(1);
        expect(libere(uno).length).toBeGreaterThan(0);
        window.localStorage.clear();
        const due = await genera([0, 1, 2].map(i => spiaggia(`s${i}`, i)), '10:00', { pathType: 'quick', prefs: { interests: ['Natura'], duration: 'Veloce' } });
        expect(vere(due).length).toBeGreaterThanOrEqual(2);
    });
    it('un giro che rispetta il minimo non riceve righe in piu\'', async () => {
        const r = await genera([0, 1, 2, 3, 4].map(i => spiaggia(`s${i}`, i)), '14:30', { prefs: { interests: ['Natura'], duration: 'Mezza Giornata', pace: 'Attivo' } });
        expect(vere(r).length).toBeGreaterThanOrEqual(3);
        expect(libere(r)).toHaveLength(0);
    });
});

describe('C8b — cena tardi: chi parte fra le 21:00 e le 22:00 cena per primo', () => {
    const POOL = [bar('b1', 0), bar('b2', 1), piazza('p1', 2), piazza('p2', 3), osteria('r1', 4, TARDI), osteria('r2', 5, TARDI)];
    const quick = (hhmm, dur = 'Veloce') => resolveTourWindow({ text: '', requestTime: new Date(`2026-10-14T${hhmm}:00+02:00`), pathType: 'quick', duration: dur });
    const keys = (sk) => sk.days[0].moments.map(m => m.key);

    it('scheletro: 21:25 → cena (facoltativa), passeggiata; 20:45 e 22:15 restano drink + passeggiata (+ cena)', () => {
        const dopo = addEveningWalk(buildDaySkeleton({ window: quick('21:25'), veloce: true, cenaPrima: true }), { veloce: true });
        expect(keys(dopo)).toEqual(['cena', 'passeggiata']);
        expect(dopo.days[0].moments[0]).toMatchObject({ opzionale: true, soloAperti: true, cenaPrima: true });
        expect(dopo.days[0].moments[1].viewKey).toBe('cena');
        expect(keys(addEveningWalk(buildDaySkeleton({ window: quick('20:45'), veloce: true, cenaPrima: true }), { veloce: true }))).toEqual(['aperitivo', 'passeggiata', 'cena']);
        expect(keys(addEveningWalk(buildDaySkeleton({ window: quick('22:15'), veloce: true, cenaPrima: true }), { veloce: true }))).toEqual(['aperitivo', 'passeggiata']);
    });
    it('con la finestra lunga (Medio, 4 ore) dopo cena e passeggiata c\'e\' il tempo di un drink', () => {
        const sk = addEveningWalk(buildDaySkeleton({ window: quick('21:25', 'Medio'), veloce: true, cenaPrima: true }), { veloce: true });
        expect(keys(sk)).toEqual(['cena', 'passeggiata', 'dopocena']);
        expect(sk.days[0].moments[2]).toMatchObject({ bevuta: true, opzionale: true });
    });
    it('Veloce relax 21:25 con un ristorante aperto per tutta la sosta → PRIMA la cena, poi la passeggiata (non piu\' Bar → Fontana)', async () => {
        const r = await genera(POOL, '21:25', { pathType: 'quick', prefs: { duration: 'Veloce', interests: ['Relax'], pace: 'Rilassato' }, testo: 'A Cabras cerco: locali', intent: INTENT_MISTO });
        const v = vere(r);
        expect(v[0].title).toMatch(/^Osteria/);
        expect(ora(v[0])).toBe('21:25');
        expect(v[1].passeggiata).toBe(true);
        expect(v).toHaveLength(2);
    });
    it('la sera che parte alle 21:30 (Crea, "stasera"): la cena e poi la passeggiata', async () => {
        const r = await genera(POOL, '21:30', { prefs: { duration: '' }, testo: 'stasera', intent: INTENT_MISTO });
        const v = vere(r);
        expect(v[0].moment).toBe('cena');
        expect(v.some(s => s.passeggiata)).toBe(true);
        expect(v.length).toBeGreaterThanOrEqual(2);
    });
});

describe('C8b — Per Te: le fasce dei pasti (parti pure)', () => {
    const OSTERIA = { primaryType: 'italian_restaurant', types: ['italian_restaurant', 'restaurant'] };
    const CAFFE = { primaryType: 'cafe', types: ['cafe', 'food'] };
    const COCKTAIL = { primaryType: 'cocktail_bar', types: ['cocktail_bar', 'bar'] };
    const MUSEO = { primaryType: 'museum', types: ['museum'] };
    const min = (h, m = 0) => h * 60 + m;
    it('un ristorante solo a pranzo (12:00–14:45) e a cena (19:30–23:00): alle 10:00 no', () => {
        expect(mealFitsClock(OSTERIA, min(10))).toBe(false);
        expect(mealFitsClock(OSTERIA, min(11, 41))).toBe(false);
        expect(mealFitsClock(OSTERIA, min(13))).toBe(true);
        expect(mealFitsClock(OSTERIA, min(16))).toBe(false);
        expect(mealFitsClock(OSTERIA, min(20))).toBe(true);
    });
    it('la mattina un locale e\' una colazione: il caffe\' si, il cocktail bar no; un museo non cambia', () => {
        expect(mealFitsClock(CAFFE, min(8, 30))).toBe(true);
        expect(isBreakfastPlace(CAFFE)).toBe(true);
        expect(mealFitsClock(COCKTAIL, min(9))).toBe(false);
        expect(mealFitsClock(MUSEO, min(9))).toBe(true);
        expect(mealFitsClock(COCKTAIL, min(16))).toBe(true);
    });
    it('un solo pasto seduto per tour: il secondo a meno di 3 ore e\' un "secondo pranzo"', () => {
        const t = (h, m) => new Date(`2026-10-14T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+02:00`);
        const primo = [{ c: OSTERIA, arrivo: t(12, 30) }];
        expect(perTeMealProblem(OSTERIA, min(14, 0), t(14, 0), primo)).toMatch(/secondo pasto/);
        expect(perTeMealProblem(CAFFE, min(14, 0), t(14, 0), primo)).toBeNull();
        expect(perTeMealProblem(OSTERIA, min(10), t(10, 0), [])).toBe('pasto fuori fascia');
    });
    it('la ricerca del tema cibo segue l\'ora: colazione prima delle 11:00, merenda dalle 14:45 alle 18:00, altrimenti la query di sempre', () => {
        const at = (hhmm) => new Date(`2026-10-14T${hhmm}:00+02:00`);
        expect(foodQueryForClock(at('08:30'))).toBe(FOOD_QUERY_COLAZIONE);
        expect(foodQueryForClock(at('10:59'))).toBe(FOOD_QUERY_COLAZIONE);
        expect(foodQueryForClock(at('11:00'))).toBeNull();
        expect(foodQueryForClock(at('13:00'))).toBeNull();
        expect(foodQueryForClock(at('16:00'))).toBe(FOOD_QUERY_MERENDA);
        expect(foodQueryForClock(at('19:00'))).toBeNull();
        expect(foodQueryForClock(null)).toBeNull();
    });
    it('"di sera" = dalle 18:00 all\'alba', () => {
        const at = (hhmm) => new Date(`2026-10-14T${hhmm}:00+02:00`);
        expect(isSeraStart(at('17:59'))).toBe(false);
        expect(isSeraStart(at('18:00'))).toBe(true);
        expect(isSeraStart(at('23:30'))).toBe(true);
        expect(isSeraStart(at('04:59'))).toBe(true);
        expect(isSeraStart(at('05:00'))).toBe(false);
    });
});

describe('C8b — Per Te: il motore (tour tematici di giorno, giro della sera di sera)', () => {
    const POI = (id, name, km, types, primary = null, periods = SEMPRE) => ({
        place_id: id, name, ...(primary ? { primaryType: primary, primary_type: primary } : {}), latitude: aKm(km), longitude: CABRAS.longitude, lat: aKm(km), lng: CABRAS.longitude,
        rating: 4.5, user_ratings_total: 300 + Math.round(km * 10), business_status: 'OPERATIONAL', types, city: 'Cabras', openingPeriods: periods,
    });
    const FOOD = [
        POI('o1', 'Osteria Sonnino', 0.4, ['italian_restaurant', 'restaurant', 'food'], 'italian_restaurant'),
        POI('c1', 'Caffè Centrale', 0.6, ['cafe', 'food'], 'cafe'),
        POI('f1', 'Forno Antico', 0.8, ['bakery', 'food'], 'bakery'),
        POI('c2', 'Caffè Piazza', 1.0, ['cafe', 'food'], 'cafe'),
        POI('f2', 'Forno Nuovo', 1.2, ['bakery', 'food'], 'bakery'),
    ];
    const tourFood = (ids) => ({ tours: [{ themeType: 'food', title: 'Food', stops: ids.map(id => ({ place_id: id, description: 'x' })) }] });
    const homeFetch = (payload) => vi.fn(async (url) => {
        if (!String(url).includes('openai-proxy')) throw new Error(`fetch inatteso: ${url}`);
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) }, finish_reason: 'stop' }], usage: { completion_tokens: 500 } }) };
    });
    const home = async (hhmm, pools, payload) => {
        window.localStorage.clear();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(`2026-10-14T${hhmm}:00+02:00`));
        vi.stubGlobal('fetch', homeFetch(payload));
        return aiRecommendationService.generateHomeTours({ city: 'Cabras', cityCenter: CABRAS, themedCandidates: pools, opts: { skipUserQuota: true } });
    };
    const tipi = (tour) => tour.stops.map(s => s.primaryType || s.types?.[0]);

    it('Per Te 10:00 con un\'osteria nel tour: non piu\' osteria (la mattina e\' una colazione)', async () => {
        const res = await home('10:00', { food: FOOD }, tourFood(['o1', 'c1', 'f1']));
        const food = res.tours.find(t => t.themeType === 'food');
        expect(food).toBeDefined();
        expect(food.stops.map(s => s.place_id)).not.toContain('o1');
        for (const s of food.stops) expect(['cafe', 'bakery']).toContain(tipi({ stops: [s] })[0]);
        expect(res._report.orari.chiuse.map(x => x.nome)).toContain('Osteria Sonnino');
        expect(res._report.orari.chiuse.find(x => x.nome === 'Osteria Sonnino').perche).toBe('pasto fuori fascia');
    });
    it('Per Te 13:00: l\'osteria al pranzo resta, un secondo ristorante a meno di 3 ore no', async () => {
        const due = [...FOOD, POI('o2', 'Osteria Due', 0.5, ['italian_restaurant', 'restaurant'], 'italian_restaurant')];
        const res = await home('13:00', { food: due }, tourFood(['o1', 'o2', 'c1', 'f1']));
        const food = res.tours.find(t => t.themeType === 'food');
        expect(food.stops.filter(s => /^Osteria/.test(s.title))).toHaveLength(1);
        expect(food.stops[0].place_id).toBe('o1');
    });
    it('Per Te 8:30: il tour cibo e\' fatto di colazioni in posti da colazione', async () => {
        const res = await home('08:30', { food: FOOD }, tourFood(['c1', 'f1', 'c2']));
        const food = res.tours.find(t => t.themeType === 'food');
        expect(food.stops.map(s => s.place_id)).toEqual(['c1', 'f1', 'c2']);
        expect(food.stops.every(s => isBreakfastPlace(s))).toBe(true);
    });

    // La sera: UN tour dal motore dei momenti (drink + passeggiata + cena), niente temi.
    const SERA_POOL = [bar('b1', 0), bar('b2', 1), piazza('p1', 2), piazza('p2', 3), osteria('r1', 4, TARDI), osteria('r2', 5, TARDI)];
    const homeSera = async (hhmm, results) => {
        window.localStorage.clear();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(`2026-10-14T${hhmm}:00+02:00`));
        vi.stubGlobal('fetch', routeFetch(results, null));
        return aiRecommendationService.generateHomeTours({ city: 'Cabras', cityCenter: CABRAS, themedCandidates: {}, prefs: { duration: '1 Giorno', group: 'solo', pace: 'attivo' }, opts: { skipUserQuota: true } });
    };
    it('Per Te 19:00 → UN tour: drink + passeggiata + cena (non tre tour tematici da 3 tappe)', async () => {
        const res = await homeSera('19:00', SERA_POOL);
        expect(res._source).toBe('unified-home');
        expect(res.tours).toHaveLength(1);
        const st = res.tours[0].stops.filter(s => !s.tempoLibero);
        expect(st.map(s => (/^Bar/.test(s.title) ? 'bar' : /^Osteria/.test(s.title) ? 'cena' : 'altro'))).toEqual(['bar', 'altro', 'cena']);
        expect(st[1].passeggiata).toBe(true);
        expect(res._report.serale).toBe(true);
    });
    it('Per Te 21:25 con un ristorante aperto → prima la cena, poi la passeggiata', async () => {
        const res = await homeSera('21:25', SERA_POOL);
        const st = res.tours[0].stops.filter(s => !s.tempoLibero);
        expect(st[0].title).toMatch(/^Osteria/);
        expect(st[1].passeggiata).toBe(true);
    });
    it('Per Te di sera con niente di aperto → il messaggio dichiarato, nessun tour', async () => {
        const chiusi = [bar('c1', 0, tutti('0900', '1800')), piazza('c2', 1, tutti('0900', '1800')), osteria('c3', 2, tutti('0900', '1800'))];
        const res = await homeSera('23:30', chiusi);
        expect(res.tours).toEqual([]);
        expect(res._source).toBe('closed-now');
        expect(res._messaggio).toBe(MESSAGGIO_SERA);
    });
});

describe('C8b — Per Te: la ricerca del tema cibo segue l\'ora (C8c: a pranzo solo i ristoranti, nessuna ricerca di dolci)', () => {
    const ROMA = { latitude: 41.9028, longitude: 12.4964 };
    const cerca = async (hhmm) => {
        const query = [];
        vi.stubGlobal('fetch', vi.fn(async (url) => {
            const u = new URL(String(url), 'http://x');
            if (u.searchParams.get('query')) query.push(u.searchParams.get('query'));
            return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) };
        }));
        window.localStorage.clear();
        await placesDiscoveryService.discoverAllThemes('Roma', ROMA.latitude, ROMA.longitude, { ora: new Date(`2026-10-14T${hhmm}:00+02:00`) }).catch(() => null);
        return query;
    };
    it('a pranzo: solo i ristoranti (C8c: la ricerca di dolci e gelati e\' tolta); a colazione e a merenda una sola query di cibo', async () => {
        const pranzo = await cerca('13:00');
        expect(pranzo.some(q => q.startsWith(FOOD_QUERY_MERENDA))).toBe(false);
        expect(pranzo.some(q => q.startsWith('trattoria ristorante pizzeria osteria'))).toBe(true);
        const mattina = await cerca('08:30');
        expect(mattina.some(q => q.startsWith(FOOD_QUERY_COLAZIONE))).toBe(true);
        expect(mattina.some(q => q.startsWith('trattoria ristorante pizzeria osteria'))).toBe(false);
        const merenda = await cerca('16:00');
        expect(merenda.filter(q => q.startsWith(FOOD_QUERY_MERENDA))).toHaveLength(1);
        expect(merenda.some(q => q.startsWith('trattoria ristorante pizzeria osteria'))).toBe(false);
    });
});
