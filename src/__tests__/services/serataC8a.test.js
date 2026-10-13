// C8a — la sera e il Veloce: il motore intero (generateItinerary).
//   · l'aperitivo dura 45 minuti (60 con ritmo Rilassato);
//   · fra il drink e la cena, se restano piu' di 30 minuti, una passeggiata all'aperto (mai un secondo bar);
//   · Percorso Veloce dalle 18:00: drink + passeggiata (+ cena se un locale e' aperto per tutta la sosta);
//     "quasi tutto chiuso" solo se nel pool non c'e' niente di aperto;
//   · mai uno scheletro vuoto.
// Scenario: Cabras, mercoledi' 14/10/2026. Il traduttore risponde sempre con la stessa intenzione; la
// ricerca Google risponde con lo stesso elenco a ogni query (come negli altri test del motore).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { remainingGaps, GAP_MAX_MINUTES } from '../../lib/continuity';
import { romeParts } from '../../lib/tourWindow';
import { MESSAGGIO_SERA } from '../../lib/openingHours';

const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const aKm = (km) => CABRAS.latitude + (km / 111);
const P = (day, open, close, closeDay = day) => ({ open: { day, time: open }, close: { day: closeDay, time: close } });
const tutti = (open, close) => [0, 1, 2, 3, 4, 5, 6].map(d => P(d, open, close));
const NOTTE = tutti('1000', '2359');                                  // aperto fino a un minuto prima di mezzanotte
const SEMPRE = [{ open: { day: 0, time: '0000' } }];
const luogo = (id, i, { name, types, primary = null, periods = SEMPRE, km = 0.4 + i * 0.25 }) => ({
    place_id: id, name, ...(primary ? { primary_type: primary } : {}),
    geometry: { location: { lat: aKm(km), lng: CABRAS.longitude } },
    rating: 4.5, user_ratings_total: 300, business_status: 'OPERATIONAL', types,
    ...(periods ? { opening_hours: { open_now: true, periods } } : {}),
});
const bar = (id, i, periods) => luogo(id, i, { name: `Bar ${id}`, types: ['cocktail_bar', 'bar', 'food', 'point_of_interest', 'establishment'], primary: 'cocktail_bar', periods });
const piazza = (id, i, periods) => luogo(id, i, { name: `Piazza ${id}`, types: ['tourist_attraction', 'point_of_interest', 'establishment'], periods });
const belvedere = (id, i, periods) => luogo(id, i, { name: `Belvedere ${id}`, types: ['tourist_attraction', 'point_of_interest', 'establishment'], periods });
const giardino = (id, i, periods) => luogo(id, i, { name: `Giardino ${id}`, types: ['park', 'point_of_interest', 'establishment'], primary: 'park', periods });
const ristorante = (id, i, periods) => luogo(id, i, { name: `Trattoria ${id}`, types: ['italian_restaurant', 'restaurant', 'food', 'point_of_interest', 'establishment'], primary: 'italian_restaurant', periods });
const spa = (id, i, periods) => luogo(id, i, { name: `Spa ${id}`, types: ['spa', 'point_of_interest', 'establishment'], primary: 'spa', periods });

const INTENT_MISTO = { queries: ['locali'], categoria: 'misto', oggetto_umano: 'locali', vincoli: { tempo: null, escludi: [], note: null } };
const INTENT_RELAX = { queries: ['spa'], categoria: 'relax', oggetto_umano: 'centri benessere', vincoli: { tempo: null, escludi: [], note: null } };
const ai = (payload) => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) });

const routeFetch = (results, intent) => {
    let n = 0;
    return vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            if (intent && n++ === 0) return ai(intent);
            return ai({ days: [{ day: 1, stops: results.map(p => ({ place_id: p.place_id, description: 'x' })) }] });
        }
        if (u.includes('textsearch')) return { ok: true, json: async () => ({ status: 'OK', results: decodeURIComponent(u).includes('Cabras') ? results : [] }) };
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        return { ok: false, status: 404, json: async () => ({}) };
    });
};
const genera = async (results, ora, { pathType = 'custom', prefs = {}, testo = 'stasera', intent = INTENT_MISTO } = {}) => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`2026-10-14T${ora}:00+02:00`));
    vi.stubGlobal('fetch', routeFetch(results, intent));
    return aiRecommendationService.generateItinerary('Cabras', prefs, testo, {}, '', CABRAS, { pathType });
};
const righe = (r) => r.days[0].stops;
const vere = (r) => righe(r).filter(s => !s.tempoLibero);
const ora = (s) => { const p = romeParts(new Date(s.scheduledTime)); return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`; };
const tipo = (s) => (/^b/.test(s.place_id) ? 'bar' : /^r/.test(s.place_id) ? 'ristorante' : /^s/.test(s.place_id) ? 'spa' : 'aperto');

const POOL_SERA = [bar('b1', 0), bar('b2', 1), piazza('p1', 2), belvedere('p2', 3), giardino('p3', 4), ristorante('r1', 5), ristorante('r2', 6)];

beforeEach(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('C8a — Crea, stasera alle 18:00: drink 45 minuti, passeggiata, cena', () => {
    it('il drink dura 45 minuti, la passeggiata sta fra il drink e la cena, la cena e\' alle 20:00', async () => {
        const r = await genera(POOL_SERA, '18:00');
        expect(r._source).toBe('google-first');
        const v = vere(r);
        expect(v.map(tipo)).toEqual(['bar', 'aperto', 'ristorante']);
        const [drink, walk, cena] = v;
        expect(drink.moment).toBe('aperitivo');
        expect(ora(drink)).toBe('18:00');
        expect(drink.stayMinutes).toBe(45);
        expect(walk.passeggiata).toBe(true);
        expect(walk.moment).toBe('aperitivo');           // a schermo sotto il drink
        expect(walk.stayMinutes).toBeLessThanOrEqual(30);
        expect(cena.moment).toBe('cena');
        expect(ora(cena)).toBe('20:00');
        // nessun buco oltre i 45 minuti, e nessuna riga di tempo libero
        expect(remainingGaps(righe(r))).toEqual([]);
        expect(righe(r).filter(s => s.tempoLibero)).toHaveLength(0);
    });
    it('mai un secondo bar e mai un ristorante fra il drink e la cena', async () => {
        const r = await genera(POOL_SERA, '18:00');
        const v = vere(r);
        expect(v.filter(s => tipo(s) === 'bar')).toHaveLength(1);
        expect(v.filter(s => s.moment === 'aperitivo' && tipo(s) === 'ristorante')).toHaveLength(0);
    });
    it('ritmo Rilassato: il drink dura 60 minuti', async () => {
        const r = await genera(POOL_SERA, '18:00', { prefs: { pace: 'Rilassato' } });
        const drink = vere(r).find(s => tipo(s) === 'bar');
        expect(drink.stayMinutes).toBe(60);
    });
    it('un buco di 1h30 fra drink e cena (prima: drink da 20 minuti) ora e\' una passeggiata, non un buco', async () => {
        const r = await genera(POOL_SERA, '18:00');
        const [drink, walk] = vere(r);
        const finePrima = new Date(drink.scheduledTime).getTime() + drink.stayMinutes * 60000;
        const buco = (new Date(walk.scheduledTime).getTime() - finePrima) / 60000 - (walk.travelMinutesFromPrev ?? 0);
        expect(buco).toBeLessThanOrEqual(GAP_MAX_MINUTES);
        expect(walk.passeggiata).toBe(true);
    });
    it('senza luoghi all\'aperto nel pool il buco resta dichiarato (CONTINUITA\'), mai un secondo bar al suo posto', async () => {
        const r = await genera([bar('b1', 0), bar('b2', 1), ristorante('r1', 5), ristorante('r2', 6)], '18:00');
        const v = vere(r);
        expect(v.filter(s => tipo(s) === 'bar')).toHaveLength(1);
        expect(v.some(s => s.passeggiata)).toBe(false);
        expect(remainingGaps(righe(r))).toEqual([]);
        // il buco c'e' (75 minuti): ha la sua riga di tempo libero
        expect(righe(r).filter(s => s.tempoLibero).length).toBeGreaterThan(0);
    });
    it('un parco chiuso alle 19:00 non e\' una passeggiata alle 19:00: si sceglie un luogo aperto', async () => {
        const chiuso = giardino('p3', 4, tutti('0800', '1800'));
        const r = await genera([bar('b1', 0), piazza('p1', 2), chiuso, ristorante('r1', 5), ristorante('r2', 6)], '18:00');
        const walk = vere(r).find(s => s.passeggiata);
        expect(walk?.place_id).toBe('p1');
    });
});

describe('C8a — Percorso Veloce (relax) a Catania di sera: mai una tappa sola, mai il messaggio falso', () => {
    // il pool di Catania a quell'ora: le spa sono chiuse, i bar e i luoghi all'aperto no
    const SPA_CHIUSE = [spa('s1', 0, tutti('1000', '1900')), spa('s2', 1, tutti('1000', '1900')), spa('s3', 2, tutti('0900', '2000'))];
    const veloce = (extra, ora_, prefs = { duration: 'Veloce', interests: ['Relax', 'Benessere'], pace: 'Rilassato' }) =>
        genera([...SPA_CHIUSE, ...extra], ora_, { pathType: 'quick', prefs, testo: 'A Cabras cerco: spa, hammam, terme, centri benessere. Escludi: cattedrali, musei, monumenti turistici.', intent: INTENT_RELAX });

    it('21:45 con bar aperti nel pool: almeno 2 tappe (drink + passeggiata), non il messaggio', async () => {
        const r = await veloce([bar('b1', 3), bar('b2', 4), piazza('p1', 5), belvedere('p2', 6)], '21:45');
        expect(r._source).toBe('google-first');
        const v = vere(r);
        expect(v.length).toBeGreaterThanOrEqual(2);
        expect(tipo(v[0])).toBe('bar');
        expect(v[1].passeggiata).toBe(true);
        expect(v.filter(s => tipo(s) === 'bar')).toHaveLength(1);
        // il ritmo Rilassato arriva al motore: il drink dura 60 minuti
        expect(v[0].stayMinutes).toBe(60);
        expect(ora(v[0])).toBe('21:45');
    });
    it('23:30: drink + passeggiata', async () => {
        const r = await veloce([bar('b1', 3, NOTTE), bar('b2', 4, SEMPRE), piazza('p1', 5), belvedere('p2', 6)], '23:30');
        expect(r._source).toBe('google-first');
        const v = vere(r);
        expect(v.length).toBeGreaterThanOrEqual(2);
        expect(tipo(v[0])).toBe('bar');
        expect(v[1].passeggiata).toBe(true);
    });
    it('23:30 con un bar che chiude a mezzanotte: la sosta (60 min) non ci sta, si sceglie quello aperto', async () => {
        const r = await veloce([bar('b1', 3, NOTTE), bar('b2', 4, SEMPRE), piazza('p1', 5), belvedere('p2', 6)], '23:30');
        expect(vere(r)[0].place_id).toBe('b2');
    });
    it('"quasi tutto chiuso" solo se nel pool non c\'e\' niente di aperto per tutta la sosta', async () => {
        const chiusi = [bar('b1', 3, tutti('1000', '2200')), bar('b2', 4, tutti('1000', '2100')), piazza('p1', 5, tutti('0800', '2000')), belvedere('p2', 6, tutti('0800', '2000'))];
        const r = await veloce(chiusi, '23:30');
        expect(r._source).toBe('closed-now');
        expect(r._messaggio).toBe(MESSAGGIO_SERA);
        // con un solo locale aperto il messaggio non compare
        window.localStorage.clear();
        const r2 = await veloce([...chiusi, bar('b3', 7, SEMPRE)], '23:30');
        expect(r2._source).toBe('google-first');
        expect(vere(r2).length).toBeGreaterThanOrEqual(1);
    });
    it('18:00 con un ristorante aperto: drink + passeggiata + cena', async () => {
        const r = await veloce([bar('b1', 3), piazza('p1', 5), belvedere('p2', 6), ristorante('r1', 7), ristorante('r2', 8)], '18:00', { duration: 'Veloce', interests: ['Relax'], pace: 'Attivo' });
        const v = vere(r);
        expect(v.map(tipo)).toEqual(['bar', 'aperto', 'ristorante']);
        expect(v[0].stayMinutes).toBe(45);
        expect(ora(v[2])).toBe('20:00');
    });
    it('21:25 con un ristorante aperto per tutta la sosta (fino a mezzanotte e mezza): la cena c\'e\' ancora', async () => {
        const tardi = tutti('1000', '2359');
        tardi.forEach(p => { p.close = { day: (p.open.day + 1) % 7, time: '0100' }; });
        const r = await veloce([bar('b1', 3), bar('b2', 4), piazza('p1', 5), belvedere('p2', 6), ristorante('r1', 7, tardi), ristorante('r2', 8, tardi)], '21:25', { duration: 'Veloce', interests: ['Relax'], pace: 'Attivo' });
        const v = vere(r);
        expect(v.map(tipo)).toEqual(['bar', 'aperto', 'ristorante']);
        // l'arrivo a cena e' dopo drink e passeggiata, e il ristorante e' aperto fino all'una
        expect(ora(v[2]) >= '22:30').toBe(true);
    });
    it('21:25 con ristoranti che chiudono alle 23:00: la cena non e\' piu\' possibile → drink + passeggiata (2 tappe)', async () => {
        const presto = tutti('1000', '2300');
        const r = await veloce([bar('b1', 3), bar('b2', 4), piazza('p1', 5), belvedere('p2', 6), ristorante('r1', 7, presto), ristorante('r2', 8, presto)], '21:25', { duration: 'Veloce', interests: ['Relax'], pace: 'Attivo' });
        const v = vere(r);
        expect(v.map(tipo)).toEqual(['bar', 'aperto']);
        expect(v[1].passeggiata).toBe(true);
    });
    it('21:45 senza nessun ristorante aperto: la cena si cerca (nel tetto di 3 ricerche) ma non c\'e\' → drink + passeggiata', async () => {
        const r = await veloce([bar('b1', 3), bar('b2', 4), piazza('p1', 5), belvedere('p2', 6)], '21:45');
        expect(vere(r).some(s => tipo(s) === 'ristorante')).toBe(false);
        expect(vere(r)).toHaveLength(2);
        expect(r._momentReport.ricercheMirate.length + (r._momentReport.ricercheDopo || []).length).toBeLessThanOrEqual(3);
    });
});

describe('C8a — la passeggiata si cerca dalla tappa prima, con il suo budget', () => {
    const fontana = (id, i) => luogo(id, i, { name: `Fontana ${id}`, types: ['tourist_attraction', 'point_of_interest', 'establishment'], km: 0.05 + i * 0.05 });
    const lontano = (id) => luogo(id, 9, { name: `Lungomare ${id}`, types: ['tourist_attraction', 'point_of_interest', 'establishment'], km: 4.2 });
    // la ricerca larga porta il lungomare lontano; quella stretta (raggio = tetto di cammino) porta le fontane vicine al bar
    const routeStretta = (largo, vicino) => {
        let n = 0;
        const ricerche = [];
        const fn = vi.fn(async (url, init) => {
            const u = String(url);
            if (u.includes('openai-proxy')) {
                if (n++ === 0) return ai(INTENT_RELAX);
                // il selettore prende il primo candidato di ogni momento, letto dal prompt
                const sys = JSON.parse(init.body).messages?.[0]?.content || '';
                const righeM = [...sys.matchAll(/•\s+(g\d+-[a-z]+)\s+—.*?ESATTAMENTE\s+(\d+).*?candidati:\s+(\[[^\]]*\])/g)];
                return ai({ stops: righeM.flatMap(m => JSON.parse(m[3]).slice(0, Number(m[2])).map(id => ({ place_id: id, moment: m[1] }))) });
            }
            if (u.includes('textsearch')) {
                const sp = new URL(u, 'http://x').searchParams;
                ricerche.push({ q: sp.get('query'), radius: sp.get('radius') });
                const stretta = Number(sp.get('radius')) <= 2000;
                return { ok: true, json: async () => ({ status: 'OK', results: stretta ? vicino : largo }) };
            }
            return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        });
        return { fn, ricerche };
    };
    it('nel pool c\'e\' solo un lungomare a 4 km: la passeggiata cerca dal bar (raggio stretto) e prende la fontana', async () => {
        window.localStorage.clear();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-14T21:45:00+02:00'));
        const { fn, ricerche } = routeStretta([spa('s1', 0, tutti('1000', '1900')), spa('s2', 1, tutti('1000', '1900')), bar('b1', 3), bar('b2', 4), lontano('l1')], [fontana('f1', 1), fontana('f2', 2)]);
        vi.stubGlobal('fetch', fn);
        const r = await aiRecommendationService.generateItinerary('Cabras', { duration: 'Veloce', pace: 'Attivo' }, 'A Cabras cerco: spa', {}, '', CABRAS, { pathType: 'quick' });
        const v = vere(r);
        expect(v.map(tipo)).toEqual(['bar', 'aperto']);
        expect(v[1]).toMatchObject({ passeggiata: true });
        expect(v[1].title).toMatch(/^Fontana/);
        // una sola ricerca stretta, quella della passeggiata (il budget dei momenti veri e' intatto)
        expect(ricerche.filter(x => Number(x.radius) <= 2000)).toHaveLength(1);
        expect(r._momentReport.ricercheDopo.map(x => x.tema)).toEqual(['romance']);
        expect(r._momentReport.ricercheDopo[0]).toMatchObject({ momento: 'g1-passeggiata' });
    });
    it('se nemmeno la ricerca stretta porta qualcosa il giro resta il drink (la passeggiata e\' facoltativa), con una ricerca sola in piu\'', async () => {
        window.localStorage.clear();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-14T21:45:00+02:00'));
        const { fn, ricerche } = routeStretta([spa('s1', 0, tutti('1000', '1900')), bar('b1', 3), bar('b2', 4), lontano('l1')], []);
        vi.stubGlobal('fetch', fn);
        const r = await aiRecommendationService.generateItinerary('Cabras', { duration: 'Veloce', pace: 'Attivo' }, 'A Cabras cerco: spa', {}, '', CABRAS, { pathType: 'quick' });
        expect(vere(r)).toHaveLength(1);
        expect(r._singleStop).toBe(true);
        expect(ricerche.filter(x => Number(x.radius) <= 2000)).toHaveLength(1);
        expect(r._momentReport.facoltativiSenzaPosto.map(x => x.momento)).toEqual(['g1-passeggiata']);
    });
});

describe('C8a — mai uno scheletro vuoto (non solo il Veloce)', () => {
    it('Sorprendimi alle 21:45 (nessun pathType): il momento sera/notte invece di partire senza scheletro', async () => {
        const r = await genera([bar('b1', 0), bar('b2', 1), piazza('p1', 2)], '21:45', { pathType: null, prefs: { duration: 'Veloce' }, testo: '', intent: null });
        expect(r._source).toBe('google-first');
        expect(vere(r).length).toBeGreaterThan(0);
        expect(vere(r).every(s => s.moment === 'dopocena')).toBe(true);
        expect(r._momentReport).toBeTruthy();
    });
});
