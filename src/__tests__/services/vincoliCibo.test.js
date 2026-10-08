// P7b — Primo accesso e vincoli a tavola.
//
//   • dieta  → la ricerca del cibo fatta dal codice porta il criterio, un posto
//              dove mangiare trovato senza criterio non entra, e a schermo c'e'
//              la riga onesta "Locali cercati come vegetariani: verifica sul posto."
//   • budget → fuori i price_level sopra il tetto (€ → niente 3-4); ignoto
//              ammesso ma dopo; il budget del wizard vince sul primo accesso.
//   • stile  → una spinta: sposta l'ordine, non esclude.
//   • gerarchia → testo → wizard → DNA → primo accesso → base, in codice e nel
//              prompt del selettore: "voglio una cena di pesce" vince sul DNA.
//
// Mock solo di infrastruttura: fetch instradato per URL e per prompt.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService, prepareHomePools } from '../../services/aiRecommendationService';
import { placesDiscoveryService } from '../../services/placesDiscoveryService';
import { selectScoredCandidatePool } from '../../services/candidateScoring';
import { isMealPlace } from '../../services/momentSelection';
import {
    resolveFoodPrefs, foodPrefBonus, dietNoteLine, parseSeed, buildSeed, applyFoodConstraints,
} from '../../lib/foodPrefs';

const ROMA = { latitude: 41.8986, longitude: 12.4769, isSmallTown: false, radiusKm: 10 };
let seq = 0;
const place = (name, types, dLat, dLng, extra = {}) => ({
    place_id: `vc-${++seq}-${name.replace(/\W+/g, '-').toLowerCase()}`,
    name,
    geometry: { location: { lat: ROMA.latitude + dLat, lng: ROMA.longitude + dLng } },
    rating: 4.6, user_ratings_total: 400, business_status: 'OPERATIONAL', types,
    ...extra,
});
const MUSEO = ['museum', 'tourist_attraction', 'point_of_interest', 'establishment'];
const RISTO = ['restaurant', 'food', 'point_of_interest', 'establishment'];

let calls;        // chiamate al proxy: [{ kind, body, user, sys }]
let queries;      // query textsearch, decodificate
let PERQUERY;     // { 'prefisso della query': [risultati] }
let INTENT;

// Il selettore sceglie, per ogni momento, il primo candidato elencato.
const selectorPick = (sys) => {
    const stops = [];
    const used = new Set();
    for (const m of sys.matchAll(/• (g\d+-[a-z]+) — .*? candidati: (\[.*?\])/g)) {
        const id = JSON.parse(m[2]).find(x => !used.has(x));
        if (id) { used.add(id); stops.push({ place_id: id, moment: m[1] }); }
    }
    return { stops };
};

const routeFetch = () => vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes('openai-proxy')) {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const sys = String(body.messages?.[0]?.content ?? '');
        const user = String(body.messages?.[1]?.content ?? '');
        let payload; let kind;
        if (sys.includes('traduttore di intenti')) { kind = 'traduttore'; payload = INTENT; }
        else if (sys.includes('SEI IL NARRATORE')) {
            kind = 'narratore';
            const giorni = JSON.parse(user.split('TAPPE FINALI:\n')[1]);
            payload = { days: giorni.map(g => ({ day: g.giorno, title: 'G', stops: g.tappe.map(t => ({ place_id: t.place_id, description: 'Le scale sono di pietra chiara.' })) })) };
        } else if (sys.includes('Riscrivi SOLO il campo description')) {
            kind = 'riscrittura';
            const tappe = JSON.parse(user.split('TAPPE:\n')[1]);
            payload = { stops: tappe.map(t => ({ place_id: t.place_id, description: 'Le scale sono di pietra chiara.' })) };
        } else if (sys.includes('SEI L\'INSIDER')) { kind = 'selettore'; payload = selectorPick(sys); }
        else { kind = 'altro'; payload = { title: 'x', message: 'y' }; }
        calls.push({ kind, body, user, sys });
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }], usage: { total_tokens: 100 } }) };
    }
    if (u.includes('textsearch')) {
        const q = new URL(u, 'http://x').searchParams.get('query');
        queries.push(q);
        // La chiave piu' lunga che prefissa la query vince ("trattoria vegetariano" prima di "trattoria").
        const hit = Object.keys(PERQUERY).sort((a, b) => b.length - a.length).find(k => q.startsWith(`${k} `));
        return { ok: true, json: async () => (hit ? { status: 'OK', results: PERQUERY[hit] } : { status: 'ZERO_RESULTS', results: [] }) };
    }
    if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
    throw new Error(`fetch inatteso: ${u}`);
});

const genera = (prompt, prefs, opts = {}) => aiRecommendationService.generateItinerary(
    'Roma', { interests: ['Arte', 'Cibo'], pace: 'Rilassato', duration: '1 Giorno', ...prefs },
    prompt, {}, '', ROMA, { pathType: 'custom', skipUserQuota: true, ...opts },
);
const selectorIds = () => {
    const sys = calls.find(c => c.kind === 'selettore')?.sys || '';
    return [...sys.matchAll(/"place_id": "([^"]+)"/g)].map(m => m[1]);
};
const allStops = (r) => r.days.flatMap(d => d.stops);

beforeEach(() => {
    vi.clearAllMocks();
    calls = []; queries = [];
    try { window.localStorage.clear(); } catch { /* jsdom */ }
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T20:57:00+02:00'));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

// ─── Dieta ───────────────────────────────────────────────────────────────────
describe('P7b — dieta vegetariana: il criterio nella ricerca e la riga onesta', () => {
    const MUSEI = [place('Museo Barracco', MUSEO, 0.002, 0), place('Galleria Doria Pamphilj', MUSEO, -0.002, 0.004)];
    const NORMALI = [place('Armando al Pantheon', RISTO, 0, 0.003), place('Da Teo', RISTO, -0.011, 0.001)];
    const VEG = [place('Margutta Vegetariano', RISTO, 0.001, 0.001), place('Il Margutta Bio', RISTO, -0.001, 0.002), place('Ops Veggie', RISTO, 0.003, -0.002)];

    beforeEach(() => {
        INTENT = { queries: ['museo', 'trattoria'], categoria: 'misto', oggetto_umano: 'la Roma dei romani', vincoli: { tempo: null, escludi: [], note: null } };
        PERQUERY = { museo: MUSEI, trattoria: NORMALI, 'trattoria vegetariano': VEG, 'trattoria ristorante pizzeria osteria vegetariano': VEG };
    });

    it('ogni ricerca del cibo porta "vegetariano"; i ristoranti senza criterio non arrivano al selettore', async () => {
        vi.stubGlobal('fetch', routeFetch());
        const r = await genera('Domani voglio vivere Roma da romano', {}, { onboardingPrefs: { dieta: ['vegetariano'], budget: null, stile: null } });

        const cibo = queries.filter(q => /trattoria|ristorante/.test(q));
        expect(cibo.length).toBeGreaterThan(0);
        for (const q of cibo) expect(q, q).toContain('vegetariano');
        const ids = selectorIds();
        for (const p of NORMALI) expect(ids).not.toContain(p.place_id);
        expect(ids.some(id => VEG.some(v => v.place_id === id))).toBe(true);

        const pasti = allStops(r).filter(st => isMealPlace(st));
        expect(pasti.length).toBeGreaterThan(0);
        for (const st of pasti) expect(VEG.map(v => v.name)).toContain(st.title);
        expect(r._vincoliCibo.tappePasto.every(x => x.criterio === 'vegetariano')).toBe(true);
    });

    it('la riga onesta sul giorno: "cercati come", mai "e\' vegetariano"', async () => {
        vi.stubGlobal('fetch', routeFetch());
        const r = await genera('Domani voglio vivere Roma da romano', {}, { onboardingPrefs: { dieta: ['vegetariano'], budget: null, stile: null } });
        expect(r.days[0].dietNote).toBe('Locali cercati come vegetariani: verifica sul posto.');
        expect(r.days[0].dietNote).not.toMatch(/è vegetarian|e' vegetarian/);
    });

    it('senza dieta: nessun criterio, nessuna riga (comportamento di prima)', async () => {
        vi.stubGlobal('fetch', routeFetch());
        const r = await genera('Domani voglio vivere Roma da romano', {}, {});
        expect(queries.some(q => q.includes('vegetariano'))).toBe(false);
        expect(r.days[0].dietNote).toBeUndefined();
        expect(r._vincoliCibo).toBeUndefined();
    });

    it('le parole della riga, per ogni dieta', () => {
        expect(dietNoteLine(['vegano'])).toBe('Locali cercati come vegani: verifica sul posto.');
        expect(dietNoteLine(['vegetariano', 'senza_glutine'])).toBe('Locali cercati come vegetariani e con opzioni senza glutine: verifica sul posto.');
        expect(dietNoteLine(['halal'])).toBe('Locali cercati come halal: verifica sul posto.');
        expect(dietNoteLine([])).toBeNull();
    });
});

// ─── Budget ──────────────────────────────────────────────────────────────────
describe('P7b — budget: filtro di codice sul price_level', () => {
    const MUSEI = [place('Museo Barracco', MUSEO, 0.002, 0)];
    const CARI = [place('La Pergola', RISTO, 0.001, 0, { price_level: 4 }), place('Il Pagliaccio', RISTO, -0.001, 0.001, { price_level: 3 })];
    const ECONOMICI = [place('Da Enzo', RISTO, 0, 0.002, { price_level: 1 }), place('Armando', RISTO, 0.002, 0.002, { price_level: 2 }), place('Forno Campo', RISTO, -0.002, 0.001, { price_level: null })];

    beforeEach(() => {
        INTENT = { queries: ['museo', 'ristorante'], categoria: 'misto', oggetto_umano: 'Roma', vincoli: { tempo: null, escludi: [], note: null } };
        PERQUERY = { museo: MUSEI, ristorante: [...CARI, ...ECONOMICI], 'trattoria ristorante pizzeria osteria': [...CARI, ...ECONOMICI] };
    });

    it('budget € → nessun locale con price_level 3-4 al selettore; 1, 2 e ignoto restano', async () => {
        vi.stubGlobal('fetch', routeFetch());
        await genera('Domani voglio vivere Roma da romano', {}, { onboardingPrefs: { dieta: [], budget: '€', stile: null } });
        const ids = selectorIds();
        for (const p of CARI) expect(ids).not.toContain(p.place_id);
        for (const p of ECONOMICI) expect(ids).toContain(p.place_id);
    });

    it('il budget del WIZARD vince sul primo accesso (Economico batte €€€)', async () => {
        vi.stubGlobal('fetch', routeFetch());
        const r = await genera('Domani voglio vivere Roma da romano', { budget: 'Economico' }, { onboardingPrefs: { dieta: [], budget: '€€€', stile: null } });
        const ids = selectorIds();
        for (const p of CARI) expect(ids).not.toContain(p.place_id);
        expect(r._vincoliCibo).toMatchObject({ budget: '€', budgetFonte: 'wizard' });
    });

    it('…e al contrario: Lusso nel wizard ammette i locali cari anche con € al primo accesso', async () => {
        vi.stubGlobal('fetch', routeFetch());
        await genera('Domani voglio vivere Roma da romano', { budget: 'Lusso' }, { onboardingPrefs: { dieta: [], budget: '€', stile: null } });
        const ids = selectorIds();
        for (const p of CARI) expect(ids).toContain(p.place_id);
    });

    it('la gerarchia del budget: testo → wizard → primo accesso', () => {
        expect(resolveFoodPrefs({ wizardBudget: 'Lusso', onboarding: { budget: '€' } })).toMatchObject({ budget: '€€€', budgetFonte: 'wizard', maxPriceLevel: 4 });
        expect(resolveFoodPrefs({ onboarding: { budget: '€' } })).toMatchObject({ budget: '€', budgetFonte: 'primo accesso', maxPriceLevel: 2 });
        expect(resolveFoodPrefs({ userPrompt: 'una cena low cost', wizardBudget: 'Lusso', onboarding: { budget: '€€€' } }))
            .toMatchObject({ budget: '€', budgetFonte: 'testo' });
        expect(resolveFoodPrefs({})).toMatchObject({ budget: null, maxPriceLevel: null });
    });

    it('price_level ignoto: ammesso, ma dopo un locale equivalente con il prezzo noto', () => {
        const fp = resolveFoodPrefs({ onboarding: { budget: '€€' } });
        const noto = { place_id: 'noto', name: 'Noto', types: RISTO, rating: 4.5, user_ratings_total: 300, price_level: 2 };
        const ignoto = { place_id: 'ignoto', name: 'Ignoto', types: RISTO, rating: 4.5, user_ratings_total: 300, price_level: null };
        const out = selectScoredCandidatePool([ignoto, noto], { city: 'Roma', bonus: (c) => foodPrefBonus(c, fp, isMealPlace) });
        expect(out.map(c => c.place_id)).toEqual(['noto', 'ignoto']);
    });
});

// ─── Stile ───────────────────────────────────────────────────────────────────
describe('P7b — stile "street food": sposta l\'ordine, non esclude', () => {
    const tratt = { place_id: 't', name: 'Osteria del Sole', types: RISTO, rating: 4.7, user_ratings_total: 300 };
    const forno = { place_id: 'f', name: 'Forno Campo de\' Fiori', types: ['bakery', 'food', 'point_of_interest'], rating: 4.5, user_ratings_total: 300 };
    const museo = { place_id: 'm', name: 'Museo', types: MUSEO, rating: 4.6, user_ratings_total: 300 };

    it('senza stile il forno viene dopo; con "street" passa davanti; nessuno sparisce', () => {
        const prima = selectScoredCandidatePool([tratt, forno, museo], { city: 'Roma' }).map(c => c.place_id);
        const fp = resolveFoodPrefs({ onboarding: { stile: 'street' } });
        const dopo = selectScoredCandidatePool([tratt, forno, museo], { city: 'Roma', bonus: (c) => foodPrefBonus(c, fp, isMealPlace) }).map(c => c.place_id);
        expect(prima.indexOf('f')).toBeGreaterThan(prima.indexOf('t'));
        expect(dopo.indexOf('f')).toBeLessThan(dopo.indexOf('t'));
        expect([...dopo].sort()).toEqual([...prima].sort());
    });

    it('lo stile non tocca i posti che non sono pasti, e non esclude con applyFoodConstraints', () => {
        const fp = resolveFoodPrefs({ onboarding: { stile: 'autore' } });
        expect(foodPrefBonus(museo, fp, isMealPlace)).toBe(0);
        expect(applyFoodConstraints([tratt, forno, museo], fp, isMealPlace).candidates).toHaveLength(3);
    });
});

// ─── Gerarchia ───────────────────────────────────────────────────────────────
describe('P7b — gerarchia: il testo scritto vince sul DNA (e sul primo accesso)', () => {
    const PESCE = [place('Pescheria Rosciòli', RISTO, 0.001, 0), place('Il Sanlorenzo', RISTO, -0.001, 0.002), place('Pierluigi', RISTO, 0.002, -0.001)];
    const MUSEO_RUMORE = place('Museo Nazionale Romano', MUSEO, 0.0015, 0.001);

    beforeEach(() => {
        INTENT = { queries: ['ristorante di pesce'], categoria: 'cibo', oggetto_umano: 'una cena di pesce', vincoli: { tempo: 'sera', escludi: [], note: null } };
        PERQUERY = { 'ristorante di pesce': [...PESCE, MUSEO_RUMORE] };
    });

    it('"voglio una cena di pesce" con DNA tutto cultura → al selettore solo cibo; la regola e\' scritta nel prompt', async () => {
        vi.stubGlobal('fetch', routeFetch());
        await genera('voglio una cena di pesce', {}, {
            dnaWeights: { cultura: 1, arte: 1, _share: 0.45 },
            onboardingPrefs: { dieta: [], budget: null, stile: null },
        });
        const ids = selectorIds();
        expect(ids).not.toContain(MUSEO_RUMORE.place_id);
        expect(ids.some(id => PESCE.some(p => p.place_id === id))).toBe(true);
        const sys = calls.find(c => c.kind === 'selettore').sys;
        expect(sys).toContain('GERARCHIA DELLE FONTI');
        expect(sys).toContain('1. la richiesta scritta dall\'utente');
        expect(sys).toContain('3. il profilo implicito (DNA)');
        expect(sys).toContain('Una fonte piu\' bassa non scavalca MAI una piu\' alta');
    });

    it('il testo che chiede pesce sospende il "vegetariano" del primo accesso (fonte piu\' bassa)', async () => {
        vi.stubGlobal('fetch', routeFetch());
        const r = await genera('voglio una cena di pesce', {}, { onboardingPrefs: { dieta: ['vegetariano'], budget: '€€', stile: null } });
        expect(queries.some(q => q.includes('vegetariano'))).toBe(false);
        expect(r._vincoliCibo).toMatchObject({ dieta: [], dietaSospesa: ['vegetariano'], budget: '€€' });
    });

    it('resolveFoodPrefs: una dieta scritta nel testo vince su quella del primo accesso', () => {
        expect(resolveFoodPrefs({ userPrompt: 'un pranzo vegano a Trastevere', onboarding: { dieta: ['halal'] } }))
            .toMatchObject({ dieta: ['vegano'], dietaFonte: 'testo' });
        expect(resolveFoodPrefs({ userPrompt: 'Domani voglio vivere Roma da romano', onboarding: { dieta: ['vegetariano'] } }))
            .toMatchObject({ dieta: ['vegetariano'], dietaFonte: 'primo accesso' });
    });
});

// ─── "Per Te" e notifiche ────────────────────────────────────────────────────
describe('P7b — "Per Te": il tour food cerca col criterio, il budget filtra', () => {
    it('discoverAllThemes con senza glutine: la query del tema food contiene il criterio', async () => {
        PERQUERY = {};
        vi.stubGlobal('fetch', routeFetch());
        await placesDiscoveryService.discoverAllThemes('Roma', ROMA.latitude, ROMA.longitude, { foodPrefs: { dieta: ['senza_glutine'] } });
        const food = queries.filter(q => q.startsWith('trattoria ristorante pizzeria osteria'));
        expect(food).toEqual(['trattoria ristorante pizzeria osteria senza glutine Roma']);
    });

    it('prepareHomePools: budget € toglie i 3-4 da ogni pool; un pasto non cercato col criterio esce', () => {
        const fp = resolveFoodPrefs({ onboarding: { dieta: ['vegetariano'], budget: '€' } });
        const near = (id, extra) => ({ place_id: id, name: id, latitude: ROMA.latitude + 0.001, longitude: ROMA.longitude, rating: 4.5, user_ratings_total: 300, types: RISTO, ...extra });
        const pools = prepareHomePools({
            food: [near('veg-ok', { _dietaCercata: ['vegetariano'], price_level: 1 }), near('veg-caro', { _dietaCercata: ['vegetariano'], price_level: 4 })],
            cultura: [near('trattoria-in-cultura', {}), near('museo', { types: MUSEO })],
        }, ROMA, 'Roma', { foodPrefs: fp });
        expect(pools.food.map(p => p.place_id)).toEqual(['veg-ok']);
        expect(pools.cultura.map(p => p.place_id)).toEqual(['museo']);
    });
});

describe('P7b — notifiche: rispettano dieta e budget', () => {
    it('una notifica di pranzo cerca col criterio e scarta i locali sopra budget', async () => {
        const caro = { ...place('Il Pagliaccio', RISTO, 0.001, 0, { price_level: 4 }) };
        const ok = { ...place('Trattoria Veg', RISTO, 0.001, 0.001, { price_level: 1 }) };
        PERQUERY = { trattoria: [caro, ok] };
        vi.stubGlobal('fetch', routeFetch());
        await aiRecommendationService.generateWeatherSocialTip('Roma', 'Ivo', 'midday', {
            temperatureC: 22, condition: 'sunny', cityCenter: ROMA,
            onboardingPrefs: { dieta: ['vegetariano'], budget: '€', stile: null },
        });
        expect(queries.length).toBeGreaterThan(0);
        for (const q of queries) expect(q).toContain('vegetariano');
        const prompt = calls.map(c => `${c.sys}\n${c.user}`).join('\n');
        expect(calls.length).toBeGreaterThan(0);          // il modello e' stato chiamato davvero
        expect(prompt).toContain('Trattoria Veg');        // con il locale ammesso
        expect(prompt).not.toContain('Il Pagliaccio');    // e senza quello sopra budget
    });
});

// ─── Il seme ─────────────────────────────────────────────────────────────────
describe('P7b — il seme separa vincoli e gusti, e legge anche la forma vecchia', () => {
    it('forma vecchia (array) → solo interessi, nessun vincolo', () => {
        expect(parseSeed(['food', 'arte'])).toEqual({ interessi: ['food', 'arte'], vincoli: { dieta: [], budget: null }, gusti: { stile: null } });
    });
    it('forma nuova → vincoli e gusti separati; valori ignoti scartati', () => {
        const seed = buildSeed({ interessi: ['food'], dieta: ['vegano', 'carnivoro'], budget: '€€', stile: 'street' });
        expect(seed).toEqual({ v: 2, interessi: ['food'], vincoli: { dieta: ['vegano'], budget: '€€' }, gusti: { stile: 'street' } });
        expect(parseSeed(seed).vincoli.dieta).toEqual(['vegano']);
    });
});
