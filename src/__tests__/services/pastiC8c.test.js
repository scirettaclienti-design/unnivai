// C8c — pasti giusti: la sera si cena, la colazione chiesta c'e', un dolce solo e dopo.
//   · la cena ha la precedenza sulla passeggiata (Veloce, Per Te di sera): ristorante lontano dalla passeggiata → si cambia
//     la passeggiata o si toglie; nessun ristorante aperto → la riga approvata, mai una sera senza cena in silenzio;
//   · «colazione» nel testo + tour prima delle 11:00 → la prima tappa e' un posto da colazione aperto e il tour parte all'ora chiesta;
//   · al massimo un dolce/gelato/pasticceria per tour, sempre dopo un pasto, mai come prima tappa prima di pranzo.
// Scenario: Cabras, mercoledi' 14/10/2026 (fuso di Roma esplicito: la CI gira in UTC).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { dolceProblem, isDolce, perTeMealProblem } from '../../lib/mealRules';
import { asksBreakfast } from '../../lib/foodTheme';
import { buildDaySkeleton } from '../../lib/daySkeleton';
import { resolveTourWindow, romeParts } from '../../lib/tourWindow';
import { keepOpenStops } from '../../lib/openStops';
import { TESTO_NESSUN_LOCALE_APERTO } from '../../lib/openingHours';

const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const aKm = (km) => CABRAS.latitude + (km / 111);
const P = (day, open, close, closeDay = day) => ({ open: { day, time: open }, close: { day: closeDay, time: close } });
const tutti = (open, close) => [0, 1, 2, 3, 4, 5, 6].map(d => P(d, open, close));
const SEMPRE = [{ open: { day: 0, time: '0000' } }];
const luogo = (id, i, { name, types, primary = null, periods = SEMPRE, km = 0.4 + i * 0.25 }) => ({
    place_id: id, name, ...(primary ? { primary_type: primary } : {}),
    geometry: { location: { lat: aKm(km), lng: CABRAS.longitude } },
    rating: 4.5, user_ratings_total: 300, business_status: 'OPERATIONAL', types,
    ...(periods ? { opening_hours: { open_now: true, periods } } : {}),
});
const bar = (id, km, periods) => luogo(id, 0, { name: `Bar ${id}`, types: ['cocktail_bar', 'bar', 'food', 'point_of_interest', 'establishment'], primary: 'cocktail_bar', periods, km });
const caffe = (id, km, periods) => luogo(id, 0, { name: `Caffè ${id}`, types: ['cafe', 'food', 'point_of_interest', 'establishment'], primary: 'cafe', periods, km });
const ristorante = (id, km, periods) => luogo(id, 0, { name: `Trattoria ${id}`, types: ['italian_restaurant', 'restaurant', 'food', 'point_of_interest', 'establishment'], primary: 'italian_restaurant', periods, km });
const belvedere = (id, km, periods) => luogo(id, 0, { name: `Belvedere ${id}`, types: ['tourist_attraction', 'point_of_interest', 'establishment'], periods, km });
const museo = (id, km, periods) => luogo(id, 0, { name: `Museo ${id}`, types: ['museum', 'tourist_attraction', 'point_of_interest', 'establishment'], primary: 'museum', periods, km });
const piazza = (id, km, periods) => luogo(id, 0, { name: `Piazza ${id}`, types: ['tourist_attraction', 'point_of_interest', 'establishment'], periods, km });

const INTENT_MISTO = { queries: ['locali'], categoria: 'misto', oggetto_umano: 'locali', vincoli: { tempo: null, escludi: [], note: null } };
const ai = (payload) => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) });
// il selettore prende il primo candidato di ogni momento, letto dal prompt; la ricerca risponde dal pool (e, per la query della
// colazione, dall'elenco dei posti da colazione)
const routeFetch = (results, intent, { colazione = [], query = [] } = {}) => {
    let n = 0;
    return vi.fn(async (url, init) => {
        const u = decodeURIComponent(String(url)).replace(/\+/g, ' ');
        if (u.includes('openai-proxy')) {
            if (intent && n++ === 0) return ai(intent);
            const sys = JSON.parse(init.body).messages?.[0]?.content || '';
            const righe = [...sys.matchAll(/•\s+(g\d+-[a-z]+)\s+—.*?ESATTAMENTE\s+(\d+).*?candidati:\s+(\[[^\]]*\])/g)];
            if (righe.length === 0) return ai({ days: [{ day: 1, stops: results.map(p => ({ place_id: p.place_id, description: 'x' })) }] });
            return ai({ stops: righe.flatMap(m => JSON.parse(m[3]).slice(0, Number(m[2])).map(id => ({ place_id: id, moment: m[1] }))) });
        }
        if (u.includes('textsearch')) {
            query.push(u);
            const solo = /colazione caffetteria/.test(u);
            return { ok: true, json: async () => ({ status: 'OK', results: u.includes('Cabras') ? (solo ? colazione : results) : [] }) };
        }
        return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
    });
};
const genera = async (results, ora, { pathType = 'custom', prefs = {}, testo = 'stasera', intent = INTENT_MISTO, colazione = [], query = [] } = {}) => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`2026-10-14T${ora}:00+02:00`));
    vi.stubGlobal('fetch', routeFetch(results, intent, { colazione, query }));
    return aiRecommendationService.generateItinerary('Cabras', prefs, testo, {}, '', CABRAS, { pathType });
};
const righe = (r) => r.days[0].stops;
const vere = (r) => righe(r).filter(s => !s.tempoLibero);
const ora = (s) => { const p = romeParts(new Date(s.scheduledTime)); return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`; };
const tipo = (s) => (/^b/.test(s.place_id) ? 'bar' : /^r/.test(s.place_id) ? 'ristorante' : /^c/.test(s.place_id) ? 'caffe' : 'aperto');
const VELOCE = { duration: 'Veloce', group: 'solo', pace: 'Rilassato', interests: [] };

beforeEach(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('C8c — la sera si cena (Veloce / Per Te di sera)', () => {
    // il drink a 0,4 km; la passeggiata piu' a nord (1,6 km); i ristoranti a sud (-0,5 km): dalla passeggiata sono oltre il tetto di
    // cammino, dal drink no.
    const POOL = [bar('b1', 0.4), belvedere('p1', 1.6), ristorante('r1', -0.5), ristorante('r2', -0.55)];
    it('il ristorante e\' lontano dalla passeggiata ma vicino al drink: la sera ha la cena (drink → cena), non drink + passeggiata', async () => {
        const r = await genera(POOL, '20:00', { pathType: 'quick', prefs: VELOCE, testo: '', intent: null });
        const v = vere(r);
        expect(v.map(tipo)).toContain('ristorante');
        expect(v.at(-1).moment).toBe('cena');
        expect(v[0].moment).toBe('aperitivo');
        // nessuna passeggiata lontana dal ristorante: se c'e' una passeggiata sta fra drink e cena
        const walk = v.find(s => s.passeggiata);
        if (walk) expect(v.indexOf(walk)).toBe(1);
        expect(righe(r).filter(s => s.tempoLibero)).toHaveLength(0);
    });
    it('una passeggiata vicina al ristorante resta: drink + passeggiata + cena', async () => {
        const r = await genera([bar('b1', 0.4), belvedere('p1', 1.6), belvedere('p2', -0.2), ristorante('r1', -0.5), ristorante('r2', -0.55)], '20:00', { pathType: 'quick', prefs: VELOCE, testo: '', intent: null });
        const v = vere(r);
        expect(v.at(-1).moment).toBe('cena');
        expect(v.map(tipo)).toContain('ristorante');
        const walk = v.find(s => s.passeggiata);
        if (walk) expect(walk.place_id).not.toBe('p1');
    });
    it('nessun ristorante nel pool: al posto della cena c\'e\' la riga approvata, mai una sera senza cena in silenzio', async () => {
        const r = await genera([bar('b1', 0.4), belvedere('p1', 0.9)], '20:00', { pathType: 'quick', prefs: VELOCE, testo: '', intent: null });
        const righeLibere = righe(r).filter(s => s.tempoLibero);
        expect(vere(r).length).toBeGreaterThanOrEqual(2);
        expect(righeLibere.some(s => s.description === TESTO_NESSUN_LOCALE_APERTO && s.moment === 'cena')).toBe(true);
        expect(righe(r).at(-1).tempoLibero).toBe(true);
    });
    it('cena tardi (21:25) senza nessun ristorante aperto: drink + passeggiata e la riga approvata', async () => {
        const chiuso = ristorante('r1', 0.6, tutti('1000', '2100'));
        const r = await genera([bar('b1', 0.4), belvedere('p1', 0.9), chiuso], '21:25', { pathType: 'quick', prefs: VELOCE, testo: '', intent: null });
        expect(vere(r).map(tipo)).not.toContain('ristorante');
        expect(righe(r).some(s => s.tempoLibero && s.description === TESTO_NESSUN_LOCALE_APERTO)).toBe(true);
    });
    it('cena tardi (21:25) con un ristorante aperto: la cena c\'e\' e non ha riga', async () => {
        const tardi = ristorante('r1', 0.6, tutti('1000', '2359'));
        const r = await genera([bar('b1', 0.4), belvedere('p1', 0.9), tardi], '21:25', { pathType: 'quick', prefs: VELOCE, testo: '', intent: null });
        expect(vere(r).map(tipo)).toContain('ristorante');
        expect(righe(r).filter(s => s.tempoLibero)).toHaveLength(0);
    });
});

describe('C8c — la sera si cena anche in Crea e Sorprendimi (la cena dovuta)', () => {
    it('Crea alle 18:00 senza nessun ristorante nel pool: la cena ha la riga approvata, non sparisce in silenzio', async () => {
        const r = await genera([bar('b1', 0.4), belvedere('p1', 0.9), belvedere('p2', 1.1)], '18:00');
        expect(vere(r).map(tipo)).not.toContain('ristorante');
        const cena = righe(r).filter(s => s.tempoLibero && s.moment === 'cena');
        expect(cena).toHaveLength(1);
        expect(cena[0].description).toBe(TESTO_NESSUN_LOCALE_APERTO);
    });
    it('Crea alle 18:00 con un ristorante: la cena c\'e\' e nessuna riga', async () => {
        const r = await genera([bar('b1', 0.4), belvedere('p1', 0.9), ristorante('r1', 1.0)], '18:00');
        expect(vere(r).map(tipo)).toContain('ristorante');
        expect(righe(r).filter(s => s.tempoLibero)).toHaveLength(0);
    });
});

describe('C8c — la colazione chiesta', () => {
    it('asksBreakfast: colazione, brunch, cornetto sì; «la mattina in pasticceria» no', () => {
        expect(asksBreakfast('Una giornata a Catania con colazione')).toBe(true);
        expect(asksBreakfast('un brunch in centro')).toBe(true);
        expect(asksBreakfast('cornetto e cappuccino')).toBe(true);
        expect(asksBreakfast('la mattina in pasticceria')).toBe(false);
        expect(asksBreakfast('')).toBe(false);
    });
    const scheletro = (testo, h, mi = 0) => {
        const requestTime = new Date(`2026-10-14T${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:00+02:00`);
        const win = resolveTourWindow({ text: testo, requestTime, pathType: 'custom', duration: '1 Giorno' });
        return buildDaySkeleton({ window: win, pace: 'Attivo', text: testo }).days[0].moments;
    };
    it('«con colazione» alle 8:00: la mattina parte alle 8:00 (non alle 9:30), con una tappa in piu\' per la colazione', () => {
        const con = scheletro('Una giornata con colazione', 8).find(m => m.key === 'mattina');
        const senza = scheletro('Una giornata', 8).find(m => m.key === 'mattina');
        expect(con.colazione).toBe(true);
        expect(romeParts(con.start).h).toBe(8);
        expect(romeParts(senza.start)).toMatchObject({ h: 9, mi: 30 });
        expect(senza.colazione).toBeUndefined();
        expect(con.stops).toBe(senza.stops + 1);
    });
    it('dopo le 11:00 la richiesta non cambia lo scheletro (resta la regola C7)', () => {
        const con = scheletro('Una giornata con colazione', 11, 30);
        expect(con.some(m => m.colazione)).toBe(false);
    });

    const POOL_GIORNO = [museo('m1', 0.5), museo('m2', 0.8), piazza('p1', 1.0), ristorante('r1', 0.9), ristorante('r2', 1.1), bar('b1', 1.2), belvedere('p2', 1.3)];
    const PRESTO = tutti('0700', '2300');
    it('Crea 8:00 «con colazione»: la prima tappa e\' un caffè aperto alle 8:00 e il giro parte alle 8:00', async () => {
        // piu' di un caffè: con un posto solo la ricerca lo toglie come «icona» (stessa regola di tutte le ricerche mirate)
        const c = [caffe('c1', 0.3, PRESTO), { ...caffe('c2', 0.6, PRESTO), user_ratings_total: 40 }, { ...caffe('c3', 0.7, PRESTO), user_ratings_total: 900 }];
        const query = [];
        const r = await genera(POOL_GIORNO, '08:00', { testo: 'Una giornata a Cabras con colazione', prefs: { duration: '1 Giorno', pace: 'Attivo', interests: [] }, colazione: c, query });
        const v = vere(r);
                expect(tipo(v[0])).toBe('caffe');
        expect(ora(v[0])).toBe('08:00');
        expect(query.some(q => /colazione caffetteria/.test(q))).toBe(true);
    });
    it('Crea «con colazione» senza nessun posto da colazione aperto: riga approvata in testa, il giro parte comunque all\'ora chiesta', async () => {
        const chiuso = caffe('c1', 0.3, tutti('1000', '1800'));
        const r = await genera(POOL_GIORNO, '08:00', { testo: 'Una giornata a Cabras con colazione', prefs: { duration: '1 Giorno', pace: 'Attivo', interests: [] }, colazione: [chiuso] });
        const prima = righe(r)[0];
        expect(prima.tempoLibero).toBe(true);
        expect(prima.description).toBe(TESTO_NESSUN_LOCALE_APERTO);
        expect(ora(vere(r)[0])).toBe('08:00');
    });
    it('senza la richiesta la giornata parte alle 9:30 come prima e non cerca la colazione', async () => {
        const query = [];
        const r = await genera(POOL_GIORNO, '08:00', { testo: 'Una giornata a Cabras', prefs: { duration: '1 Giorno', pace: 'Attivo', interests: [] }, query });
        expect(ora(vere(r)[0])).toBe('09:30');
        expect(query.some(q => /colazione caffetteria/.test(q))).toBe(false);
    });
});

describe('C8c — un dolce per tour, e dopo un pasto', () => {
    const gelateria = { place_id: 'g1', name: 'Gelateria Centrale', types: ['ice_cream_shop', 'food'], primaryType: 'ice_cream_shop' };
    const gelateria2 = { place_id: 'g2', name: 'Gelateria Nord', types: ['ice_cream_shop', 'food'], primaryType: 'ice_cream_shop' };
    const pasticceria = { place_id: 'pa', name: 'Pasticceria Savia', types: ['bakery', 'food'], primaryType: 'bakery' };
    const forno = { place_id: 'fo', name: 'Antico Forno', types: ['bakery', 'food'], primaryType: 'bakery' };
    const caffetteria = { place_id: 'ca', name: 'Caffetteria Roma', types: ['cafe', 'food'], primaryType: 'cafe' };
    const trattoria = { place_id: 'tr', name: 'Trattoria Mare', types: ['italian_restaurant', 'restaurant', 'food'], primaryType: 'italian_restaurant' };
    const min = (h, m = 0) => h * 60 + m;

    it('isDolce: un bar che e\' anche gelateria/pasticceria (tipi o nome) e\' un dolce', () => {
        const barGelateria = { place_id: 'bg', name: 'Caffè Blanca', types: ['bar', 'ice_cream_shop', 'cake_shop', 'dessert_shop'], primaryType: 'bar' };
        const barPasticceria = { place_id: 'bp', name: 'Pasticceria Quaranta', types: ['bar', 'pastry_shop', 'bakery'], primaryType: 'bar' };
        expect(isDolce(barGelateria)).toBe(true);
        expect(isDolce(barPasticceria)).toBe(true);
        expect(dolceProblem(barGelateria, 14 * 60 + 44, [{ c: { place_id: 'x', name: 'Altro', types: ['museum'] }, arrivo: new Date() }])).toBe('dolce prima del pasto');
    });
    it('isDolce: gelateria e pasticceria sì, forno e caffè no', () => {
        expect(isDolce(gelateria)).toBe(true);
        expect(isDolce(pasticceria)).toBe(true);
        expect(isDolce(forno)).toBe(false);
        expect(isDolce(caffetteria)).toBe(false);
        expect(isDolce(trattoria)).toBe(false);
    });
    it('a pranzo un gelato come prima tappa non va: prima viene il pasto', () => {
        expect(dolceProblem(gelateria, min(13), [])).toBe('dolce prima del pasto');
        expect(dolceProblem(gelateria, min(13, 30), [{ c: trattoria, arrivo: new Date() }])).toBeNull();
    });
    it('un solo dolce per tour, anche dopo il pasto', () => {
        const altre = [{ c: trattoria, arrivo: new Date() }, { c: gelateria, arrivo: new Date() }];
        expect(dolceProblem(gelateria2, min(14), altre)).toBe('secondo dolce nello stesso tour');
    });
    it('di mattina il dolce va dopo la colazione (un caffè), mai per primo', () => {
        expect(dolceProblem(pasticceria, min(8, 30), [])).toBe('dolce prima del pasto');
        expect(dolceProblem(pasticceria, min(9), [{ c: caffetteria, arrivo: new Date() }])).toBeNull();
    });
    it('dalla merenda (14:45) in poi un dolce solo va bene anche per primo', () => {
        expect(dolceProblem(gelateria, min(16), [])).toBeNull();
    });
    it('perTeMealProblem include la regola del dolce', () => {
        expect(perTeMealProblem(gelateria, min(13), new Date(), [])).toBe('dolce prima del pasto');
        expect(perTeMealProblem(caffetteria, min(13), new Date(), [])).toBeNull();
    });
    it('keepOpenStops: gelato → trattoria → gelato a pranzo diventa trattoria + un dolce + il resto senza secondo dolce', () => {
        // posti in linea retta, tutti aperti; il giro di partenza e' quello brutto del banco
        const at = (c, lat) => ({ ...c, latitude: lat, longitude: 8.5, lat, lng: 8.5, stayMinutes: 20, travelMinutesFromPrev: 2 });
        const start = new Date('2026-10-14T13:00:00+02:00');
        const brutta = [at(gelateria, 39.930), at(trattoria, 39.931), at(gelateria2, 39.932)];
        const pool = [at(caffetteria, 39.9305), at(forno, 39.9312), at(pasticceria, 39.9325)];
        const retime = (list) => list;
        const romaMin = (d) => { const p = romeParts(d); return p.h * 60 + p.mi; };
        const out = keepOpenStops({
            stops: brutta, pool, start, retime, toStop: (c) => c, maxPasses: 6,
            invalidAt: (c, arrivo, altre) => perTeMealProblem(c, romaMin(arrivo), arrivo, altre),
        });
        const nomi = out.stops.map(s => s.name);
        expect(nomi[0]).not.toMatch(/Gelateria/);
        expect(out.stops.filter(s => isDolce(s)).length).toBeLessThanOrEqual(1);
    });
});
