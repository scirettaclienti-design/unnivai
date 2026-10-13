// C7 — composizione della giornata: il tema cibo vale solo nei pasti, un pasto per fascia,
// niente zone come tappe, "tipico" preferisce i locali.
//
// Scenario: Catania, "un giorno da catanese, nei ristoranti tipici" (la richiesta del telefono di
// Ivano, D-CATANIA). Luoghi e modello (traduttore + selettore) simulati; orologio fisso in ora di
// Roma. Il modello sceglie APPOSTA ristoranti per mattina, pomeriggio e aperitivo: e' il difetto
// riprodotto (7 ristoranti su 7), il codice deve ripararlo.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { THEME_TEXTSEARCH } from '../../services/placesDiscoveryService';
import { placeKind } from '../../lib/placeKind';

const CATANIA = { latitude: 37.5079, longitude: 15.083, isSmallTown: false, radiusKm: 10 };

let seq = 0;
const place = (name, primary, types, dLat, dLng, extra = {}) => ({
    place_id: `pid-${++seq}-${name.replace(/\W+/g, '-').toLowerCase()}`,
    name,
    primary_type: primary,
    geometry: { location: { lat: CATANIA.latitude + dLat, lng: CATANIA.longitude + dLng } },
    rating: 4.6, user_ratings_total: 400, business_status: 'OPERATIONAL',
    types,
    ...extra,
});
const R = ['restaurant', 'food', 'point_of_interest', 'establishment'];
const ITA = ['italian_restaurant', 'restaurant', 'food', 'point_of_interest', 'establishment'];

const TRATTORIE = [
    place('Trattoria Sorano', 'italian_restaurant', ITA, -0.004, 0.001),
    place('Osteria Antica Marina', 'restaurant', R, -0.003, -0.002),
    place('Antica Putia Odeon', 'italian_restaurant', ITA, 0.001, 0.003),
    place('Trattoria Il Mare', 'seafood_restaurant', ['seafood_restaurant', ...R], -0.005, 0.002),
    place('Sushi Tokyo Catania', 'japanese_restaurant', ['japanese_restaurant', ...R], 0.002, -0.001),
    place('Bistro Moderno', 'vegetarian_restaurant', ['vegetarian_restaurant', ...R], 0.003, 0.001),
];
const ESPERIENZE = [
    place('Pescheria di Catania', 'market', ['market', 'tourist_attraction', 'point_of_interest', 'establishment'], 0.000, 0.004),
    place('Via dei Crociferi', 'tourist_attraction', ['tourist_attraction', 'point_of_interest', 'establishment'], 0.004, -0.002),
    place('Chiesa di San Benedetto', 'church', ['church', 'place_of_worship', 'tourist_attraction', 'point_of_interest', 'establishment'], 0.003, -0.003),
    place('Palazzo Biscari', 'tourist_attraction', ['tourist_attraction', 'point_of_interest', 'establishment'], -0.001, 0.005),
    place('Museo Civico Castello Ursino', 'museum', ['museum', 'tourist_attraction', 'point_of_interest', 'establishment'], -0.006, -0.001),
    place('Caffè Europa', 'cafe', ['cafe', 'food', 'point_of_interest', 'establishment'], 0.001, 0.001),
    place('Pasticceria Savia', 'bakery', ['bakery', 'food', 'point_of_interest', 'establishment'], 0.002, 0.002),
    // la zona: Google la registra come tourist_attraction, i types non la tradiscono
    place('Centro Storico Catania', 'tourist_attraction', ['tourist_attraction', 'point_of_interest', 'establishment'], 0.000, 0.000),
];
const BARS = [
    place('Bar Popolare', 'cocktail_bar', ['cocktail_bar', 'bar', 'restaurant', 'food', 'point_of_interest', 'establishment'], 0.001, -0.004),
    place('Enoteca Il Cantuccio', 'wine_bar', ['wine_bar', 'bar', 'point_of_interest', 'establishment'], -0.002, 0.003),
];
const TUTTI = [...TRATTORIE, ...ESPERIENZE, ...BARS];
const byName = (n) => TUTTI.find(p => p.name === n);

const INTENT = {
    queries: ['trattoria tipica', 'osteria'],
    categoria: 'cibo',
    oggetto_umano: 'trattorie',
    vincoli: { tempo: null, escludi: [], note: null },
};

const routeFetch = ({ intent = INTENT, perQuery, selector }) => {
    const stato = { aiCalls: 0, textsearch: [], selectorBody: null };
    const fn = vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const payload = stato.aiCalls === 0 ? intent : selector;
            if (stato.aiCalls === 1) stato.selectorBody = String(init?.body ?? '');
            stato.aiCalls += 1;
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }
        if (u.includes('textsearch')) {
            const q = new URL(u, 'http://x').searchParams.get('query');
            stato.textsearch.push(q);
            const hit = Object.keys(perQuery).find(k => q === `${k} Catania`);
            return hit
                ? { ok: true, json: async () => ({ status: 'OK', results: perQuery[hit] }) }
                : { ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) };
        }
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        throw new Error(`fetch inatteso: ${u}`);
    });
    return { fn, stato };
};
const stop = (name, moment) => ({ place_id: byName(name).place_id, ...(moment ? { moment } : {}), description: `Dentro ${name}` });
const selectorOf = (stops) => ({ days: [{ day: 1, title: 'Catania da catanese', stops }] });

const PER_QUERY = {
    'trattoria tipica': TRATTORIE,
    osteria: TRATTORIE.slice(0, 3),
    [THEME_TEXTSEARCH.esperienze.query]: ESPERIENZE,
    [THEME_TEXTSEARCH.nightlife.query]: BARS,
};

// Il modello sbaglia apposta: ristoranti ovunque (il difetto di D-CATANIA).
const MODELLO_SBAGLIATO = selectorOf([
    stop('Trattoria Sorano', 'g1-mattina'),
    stop('Osteria Antica Marina', 'g1-mattina'),
    stop('Antica Putia Odeon', 'g1-pranzo'),
    stop('Trattoria Il Mare', 'g1-pomeriggio'),
    stop('Bistro Moderno', 'g1-pomeriggio'),
    stop('Sushi Tokyo Catania', 'g1-aperitivo'),
    stop('Trattoria Sorano', 'g1-cena'),
]);

const TESTO = 'Domani vorrei vivere un giorno da catanese, nei ristoranti tipici';
const SERA_PRIMA = '2026-10-13T20:57:00+02:00';
const genera = (testo = TESTO, prefs = { interests: ['Cibo'], pace: 'Attivo', duration: '1 Giorno' }, opts = {}) => aiRecommendationService.generateItinerary(
    'Catania', prefs, testo, {}, '', CATANIA, { pathType: 'custom', skipUserQuota: true, ...opts },
);
const kind = (s) => placeKind({ types: s.types, primaryType: byName(s.title)?.primary_type ?? s.primaryType }).kind;
const vere = (r) => r.days.flatMap(d => d.stops).filter(s => !s.tempoLibero);

beforeEach(() => {
    vi.clearAllMocks();
    try { window.localStorage.clear(); } catch { /* jsdom */ }
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(SERA_PRIMA));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('C7 — "un giorno da catanese, nei ristoranti tipici"', () => {
    it('mattina e pomeriggio senza ristoranti; pranzo e cena sono ristoranti; niente trattoria alle 14:30 dopo il pranzo', async () => {
        const { fn } = routeFetch({ perQuery: PER_QUERY, selector: MODELLO_SBAGLIATO });
        vi.stubGlobal('fetch', fn);
        const r = await genera();
        expect(r._source).toBe('google-first');
        const stops = vere(r);
        for (const s of stops.filter(x => x.moment === 'mattina' || x.moment === 'pomeriggio')) {
            expect(kind(s), `${s.title} @${s.moment} e' un ${kind(s)}`).not.toBe('pasto');
        }
        // niente trattoria alle 14:30 (o in nessun momento del pomeriggio)
        expect(stops.filter(s => s.moment === 'pomeriggio' && kind(s) === 'pasto')).toEqual([]);
        // i pasti sono pasti
        for (const s of stops.filter(x => x.moment === 'pranzo' || x.moment === 'cena')) expect(kind(s)).toBe('pasto');
        // e mattina e pomeriggio hanno davvero delle tappe (esperienze), non solo tempo libero
        expect(stops.filter(s => s.moment === 'mattina').length).toBeGreaterThan(0);
        expect(stops.filter(s => s.moment === 'pomeriggio').length).toBeGreaterThan(0);
    });

    it('un solo pasto per fascia: nessun ristorante fuori da pranzo e cena (aperitivo compreso)', async () => {
        const { fn } = routeFetch({ perQuery: PER_QUERY, selector: MODELLO_SBAGLIATO });
        vi.stubGlobal('fetch', fn);
        const r = await genera();
        const fuori = vere(r).filter(s => kind(s) === 'pasto' && !['pranzo', 'cena'].includes(s.moment));
        expect(fuori.map(s => `${s.title}@${s.moment}`)).toEqual([]);
        const aperitivo = vere(r).filter(s => s.moment === 'aperitivo');
        for (const s of aperitivo) expect(['bar', 'caffe', 'notte', 'dolce', 'forno', null]).toContain(kind(s));
        // un solo pranzo e una sola cena
        expect(vere(r).filter(s => s.moment === 'pranzo')).toHaveLength(1);
        expect(vere(r).filter(s => s.moment === 'cena')).toHaveLength(1);
    });

    it('colazione: se la mattina ha un locale e\' un caffe\', una pasticceria o un forno (mai un ristorante)', async () => {
        const { fn } = routeFetch({
            perQuery: PER_QUERY,
            selector: selectorOf([stop('Trattoria Sorano', 'g1-mattina'), stop('Caffè Europa', 'g1-mattina'), stop('Antica Putia Odeon', 'g1-pranzo'), stop('Trattoria Il Mare', 'g1-cena')]),
        });
        vi.stubGlobal('fetch', fn);
        const r = await genera();
        const locali = vere(r).filter(s => s.moment === 'mattina' && ['pasto', 'spuntino', 'bar', 'caffe', 'forno', 'dolce', 'notte'].includes(kind(s)));
        for (const s of locali) expect(['caffe', 'forno', 'dolce', 'bar'], `${s.title}: ${kind(s)}`).toContain(kind(s));
        expect(locali.map(s => s.title)).not.toContain('Trattoria Sorano');
    });

    it('"Centro Storico Catania" non e\' mai una tappa: una zona orienta la ricerca, non e\' un posto', async () => {
        const { fn, stato } = routeFetch({
            perQuery: PER_QUERY,
            // il modello prova a metterla come tappa
            selector: selectorOf([stop('Centro Storico Catania', 'g1-mattina'), stop('Pescheria di Catania', 'g1-mattina'), stop('Antica Putia Odeon', 'g1-pranzo'), stop('Via dei Crociferi', 'g1-pomeriggio'), stop('Trattoria Il Mare', 'g1-cena')]),
        });
        vi.stubGlobal('fetch', fn);
        const r = await genera();
        expect(vere(r).map(s => s.title)).not.toContain('Centro Storico Catania');
        // e non e' nemmeno fra i luoghi offerti al selettore
        expect(stato.selectorBody).not.toContain('Centro Storico Catania');
        expect(stato.selectorBody).toContain('Pescheria di Catania');
    });

    it('tipico: le cucine estere non entrano nei pasti, e il tracciato dichiara se il posto e\' locale', async () => {
        const { fn } = routeFetch({ perQuery: PER_QUERY, selector: MODELLO_SBAGLIATO });
        vi.stubGlobal('fetch', fn);
        const r = await genera();
        const titoli = vere(r).map(s => s.title);
        expect(titoli).not.toContain('Sushi Tokyo Catania');
        expect(r._momentReport.tema).toMatchObject({ cibo: true, tipico: true });
        expect(r._momentReport.tema.cucineEstereEscluse).toContain('Sushi Tokyo Catania');
        for (const s of vere(r).filter(x => x.moment === 'pranzo' || x.moment === 'cena')) {
            expect(s._tracciato.tipico).toMatchObject({ richiesto: true });
            expect(s._tracciato.tema).toBe('pasto del tema cibo');
        }
        for (const s of vere(r).filter(x => x.moment === 'mattina' || x.moment === 'pomeriggio')) {
            expect(s._tracciato.tema).toBe('esperienza nello spirito del tema cibo');
        }
    });

    it('mattina e pomeriggio cercano esperienze dentro il tetto di 2 ricerche mirate', async () => {
        const { fn, stato } = routeFetch({ perQuery: PER_QUERY, selector: MODELLO_SBAGLIATO });
        vi.stubGlobal('fetch', fn);
        const r = await genera();
        // le 2 query del traduttore + al massimo 2 ricerche mirate per i momenti veri
        // C8a — + una per la passeggiata fra aperitivo e cena (momento facoltativo: il tetto e' 3 in tutto, e la
        // passeggiata e' l'unica che puo' prendere il posto in piu')
        expect(stato.textsearch.length).toBeLessThanOrEqual(5);
        expect(r._momentReport.ricercheMirate).toContain('esperienze');
        const veri = (r._momentReport.ricercheDopo || []).filter(x => x.tema !== 'romance');
        expect(r._momentReport.ricercheMirate.length + veri.length).toBeLessThanOrEqual(2);
        expect(r._momentReport.ricercheMirate.length + (r._momentReport.ricercheDopo || []).length).toBeLessThanOrEqual(3);
    });

    it('il modello non vede piu\' "categoria cibo" come clausola per tutte le tappe', async () => {
        const { fn, stato } = routeFetch({ perQuery: PER_QUERY, selector: MODELLO_SBAGLIATO });
        vi.stubGlobal('fetch', fn);
        await genera();
        expect(stato.selectorBody).toContain('categoria richiesta: \\"misto\\"');
        expect(stato.selectorBody).not.toContain('categoria richiesta: \\"cibo\\"');
    });
});

describe('C7 — con il vegetariano i pasti restano tipici se possibile', () => {
    const VEG_ONB = { dieta: ['vegetariano'], budget: null, stile: null };
    const PER_QUERY_VEG = {
        'trattoria tipica con opzioni vegetariane': TRATTORIE,
        'osteria con opzioni vegetariane': TRATTORIE.slice(0, 3),
        [THEME_TEXTSEARCH.esperienze.query]: ESPERIENZE,
        [THEME_TEXTSEARCH.nightlife.query]: BARS,
    };
    it('trattorie locali prima del bistrot vegetariano; la dieta non tocca le esperienze', async () => {
        const { fn } = routeFetch({
            perQuery: PER_QUERY_VEG,
            selector: selectorOf([stop('Bistro Moderno', 'g1-pranzo'), stop('Bistro Moderno', 'g1-cena')]),
        });
        vi.stubGlobal('fetch', fn);
        const r = await genera(TESTO, { interests: ['Cibo'], pace: 'Attivo', duration: '1 Giorno' }, { onboardingPrefs: VEG_ONB });
        const pasti = vere(r).filter(s => s.moment === 'pranzo' || s.moment === 'cena');
        expect(pasti.length).toBeGreaterThan(0);
        // almeno un pasto e' un posto locale (non il bistrot moderno): il tipico vince sul solo vegetariano
        expect(pasti.some(s => s._tracciato.tipico?.locale)).toBe(true);
        // il vincolo vale solo per i posti dove si mangia: le esperienze non vengono dalle ricerche con la dieta
        for (const s of vere(r).filter(x => x.moment === 'mattina' || x.moment === 'pomeriggio')) {
            expect(s._tracciato.tema).toBe('esperienza nello spirito del tema cibo');
        }
    });
});

describe('C7 — una richiesta esplicita per quel momento si rispetta e si dichiara', () => {
    it('"domani il pomeriggio in pasticceria": il pomeriggio e\' la pasticceria, dichiarato nel tracciato', async () => {
        const { fn } = routeFetch({
            intent: { queries: ['pasticceria'], categoria: 'cibo', oggetto_umano: 'pasticcerie', vincoli: { tempo: 'pomeriggio', escludi: [], note: null } },
            perQuery: { pasticceria: [byName('Pasticceria Savia'), byName('Caffè Europa'), byName('Trattoria Sorano')] },
            selector: selectorOf([stop('Pasticceria Savia', 'g1-pomeriggio')]),
        });
        vi.stubGlobal('fetch', fn);
        const r = await genera('Domani il pomeriggio in pasticceria', { pace: 'Attivo' });
        const pom = vere(r).filter(s => s.moment === 'pomeriggio');
        expect(pom.map(s => s.title)).toContain('Pasticceria Savia');
        expect(pom.find(s => s.title === 'Pasticceria Savia')._tracciato.esplicito).toBe('richiesto dal testo per questo momento');
        // ma un ristorante non entra nemmeno qui: e' una pasticceria, non una trattoria
        expect(pom.map(s => s.title)).not.toContain('Trattoria Sorano');
    });
});
