// P7b2 — la richiesta rispettata: la dieta si AGGIUNGE come opzione.
//
//   "trattoria romana" + vegetariano → "trattoria romana con opzioni vegetariane"
//   (prima: "trattoria romana vegetariano" nel percorso A, e il tema food del
//   codice diventava "… vegetariano" senza dire "con opzioni").
//   Se la ricerca con la richiesta trova pochi locali si allarga a
//   "ristorante con opzioni vegetariane": mai una ricerca del cibo senza dieta.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { withDietCriteria, dietSearchChain, searchFoodWithDiet, DIET_MIN_RESULTS } from '../../lib/foodPrefs';

const ROMA = { latitude: 41.8986, longitude: 12.4769, isSmallTown: false, radiusKm: 10 };
let seq = 0;
const place = (name, types, dLat, dLng, extra = {}) => ({
    place_id: `do-${++seq}-${name.replace(/\W+/g, '-').toLowerCase()}`,
    name,
    geometry: { location: { lat: ROMA.latitude + dLat, lng: ROMA.longitude + dLng } },
    rating: 4.6, user_ratings_total: 400, business_status: 'OPERATIONAL', types, ...extra,
});
const MUSEO = ['museum', 'tourist_attraction', 'point_of_interest', 'establishment'];
const RISTO = ['restaurant', 'food', 'point_of_interest', 'establishment'];

let queries; let PERQUERY; let INTENT;
const routeFetch = () => vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes('openai-proxy')) {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const sys = String(body.messages?.[0]?.content ?? '');
        const user = String(body.messages?.[1]?.content ?? '');
        let payload;
        if (sys.includes('traduttore di intenti')) payload = INTENT;
        else if (sys.includes('SEI IL NARRATORE')) {
            const giorni = JSON.parse(user.split('TAPPE FINALI:\n')[1]);
            payload = { days: giorni.map(g => ({ day: g.giorno, title: 'G', stops: g.tappe.map(t => ({ place_id: t.place_id, description: 'Le scale sono di pietra chiara.' })) })) };
        } else if (sys.includes('Riscrivi SOLO il campo description')) {
            const tappe = JSON.parse(user.split('TAPPE:\n')[1]);
            payload = { stops: tappe.map(t => ({ place_id: t.place_id, description: 'Le scale sono di pietra chiara.' })) };
        } else {
            const stops = []; const used = new Set();
            for (const m of sys.matchAll(/• (g\d+-[a-z]+) — .*? candidati: (\[.*?\])/g)) {
                const id = JSON.parse(m[2]).find(x => !used.has(x));
                if (id) { used.add(id); stops.push({ place_id: id, moment: m[1] }); }
            }
            payload = { stops };
        }
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }], usage: { total_tokens: 100 } }) };
    }
    if (u.includes('textsearch')) {
        const q = new URL(u, 'http://x').searchParams.get('query');
        queries.push(q);
        const hit = Object.keys(PERQUERY).sort((a, b) => b.length - a.length).find(k => q.startsWith(`${k} `));
        return { ok: true, json: async () => (hit ? { status: 'OK', results: PERQUERY[hit] } : { status: 'ZERO_RESULTS', results: [] }) };
    }
    if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
    throw new Error(`fetch inatteso: ${u}`);
});
const genera = (opts = {}) => aiRecommendationService.generateItinerary(
    'Roma', { interests: ['Arte', 'Cibo'], pace: 'Rilassato', duration: '1 Giorno' },
    'Domani voglio vivere Roma da romano', {}, '', ROMA, { pathType: 'custom', skipUserQuota: true, ...opts },
);

beforeEach(() => {
    vi.clearAllMocks();
    queries = [];
    try { window.localStorage.clear(); } catch { /* jsdom */ }
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T20:57:00+02:00'));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('P7b2 — la dieta si aggiunge alla richiesta, non la cancella', () => {
    it('"trattoria romana" + vegetariano → "trattoria romana con opzioni vegetariane"', () => {
        expect(withDietCriteria('trattoria romana', ['vegetariano'])).toBe('trattoria romana con opzioni vegetariane');
    });

    it('cucina e stile restano: siciliano, di pesce, tipico', () => {
        expect(withDietCriteria('cucina siciliana', ['vegano'])).toBe('cucina siciliana con opzioni vegane');
        expect(withDietCriteria('ristorante di pesce', ['senza_glutine'])).toBe('ristorante di pesce con opzioni senza glutine');
        expect(withDietCriteria('trattoria tipica', ['halal'])).toBe('trattoria tipica con opzioni halal');
        expect(withDietCriteria('osteria tipica', ['vegetariano', 'senza_glutine'])).toBe('osteria tipica con opzioni vegetariane e senza glutine');
    });

    it('una dieta gia\' scritta nella richiesta non si ripete', () => {
        expect(withDietCriteria('ristorante vegano', ['vegano'])).toBe('ristorante vegano');
        expect(withDietCriteria('pizzeria gluten free', ['senza_glutine', 'vegetariano'])).toBe('pizzeria gluten free con opzioni vegetariane');
    });

    it('la catena: prima la richiesta con la dieta, poi "ristorante" con la dieta — mai senza', () => {
        expect(dietSearchChain('trattoria romana', ['vegetariano'])).toEqual([
            'trattoria romana con opzioni vegetariane', 'ristorante con opzioni vegetariane',
        ]);
        for (const q of dietSearchChain('trattoria romana', ['vegano'])) expect(q).toContain('con opzioni vegane');
    });

    it('si allarga solo se la prima trova meno di DIET_MIN_RESULTS locali; ogni risultato porta la ricerca usata', async () => {
        const run = vi.fn(async (q) => (q.startsWith('trattoria')
            ? [{ place_id: 'a', name: 'A' }]
            : [{ place_id: 'a', name: 'A' }, { place_id: 'b', name: 'B' }, { place_id: 'c', name: 'C' }]));
        const { results, ricerche } = await searchFoodWithDiet(run, 'trattoria romana', ['vegetariano']);
        expect(ricerche).toEqual(['trattoria romana con opzioni vegetariane', 'ristorante con opzioni vegetariane']);
        expect(results.map(r => r.place_id)).toEqual(['a', 'b', 'c']);
        expect(results[0]._ricercaCibo).toBe('trattoria romana con opzioni vegetariane');
        expect(results[1]._ricercaCibo).toBe('ristorante con opzioni vegetariane');
        expect(results.every(r => r._dietaCercata.includes('vegetariano'))).toBe(true);

        const pieno = vi.fn(async () => Array.from({ length: DIET_MIN_RESULTS }, (_, i) => ({ place_id: `p${i}` })));
        const r2 = await searchFoodWithDiet(pieno, 'trattoria romana', ['vegetariano']);
        expect(r2.ricerche).toEqual(['trattoria romana con opzioni vegetariane']);
    });
});

describe('P7b2 — nel motore: "Roma da romano" + vegetariano', () => {
    const MUSEI = [place('Museo Barracco', MUSEO, 0.002, 0), place('Galleria Doria Pamphilj', MUSEO, -0.002, 0.004)];
    const ROMANE = [place('Trattoria Romana Veg', RISTO, 0.001, 0.001)];
    const LARGHI = [place('Ristorante Veg Uno', RISTO, -0.001, 0.002), place('Ristorante Veg Due', RISTO, 0.003, -0.002)];

    beforeEach(() => {
        INTENT = { queries: ['piazza storica', 'trattoria romana'], categoria: 'misto', oggetto_umano: 'la Roma dei romani', vincoli: { tempo: null, escludi: [], note: null } };
        PERQUERY = {
            'piazza storica': MUSEI,
            'trattoria romana': [place('Da Teo', RISTO, -0.011, 0.001)],
            'trattoria romana con opzioni vegetariane': ROMANE,
            'ristorante con opzioni vegetariane': LARGHI,
            'trattoria ristorante pizzeria osteria con opzioni vegetariane': LARGHI,
        };
    });

    it('la ricerca contiene sia "romana" sia "vegetarian"; con pochi risultati si allarga tenendo la dieta', async () => {
        vi.stubGlobal('fetch', routeFetch());
        const r = await genera({ onboardingPrefs: { dieta: ['vegetariano'], budget: null, stile: null } });
        expect(queries).toContain('trattoria romana con opzioni vegetariane Roma');
        const romana = queries.find(q => q.includes('romana'));
        expect(romana).toMatch(/vegetarian/);
        // 1 solo locale con la richiesta → allargata, sempre con la dieta.
        expect(queries).toContain('ristorante con opzioni vegetariane Roma');
        for (const q of queries.filter(q => /trattoria|ristorante|osteria/.test(q))) expect(q, q).toMatch(/vegetarian/);
        // e la ricerca usata finisce nel resoconto delle tappe pasto.
        for (const x of r._vincoliCibo.tappePasto) expect(x.ricerca, x.title).toMatch(/con opzioni vegetariane/);
    });
});
