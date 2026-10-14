// C10c-piena-2 — varieta' come preferenza (decisione di Ivano: «se si puo' evitare si evita, ma non deve essere vincolante»)
// e Trastevere col suo nucleo vero:
//   · un giorno che usa una piazza mantiene la passeggiata della sera con un'altra piazza (gradino b della cascata);
//   · in un borgo con una sola piazza emblematica (ancora) la sera puo' tornare li', con un testo diverso (gradino c);
//   · in una citta' con alternative lo stesso posto non torna;
//   · la lista del quartiere porta la categoria (e ha la sua versione: le liste delle citta' non si rigenerano);
//   · il nucleo del quartiere e' il baricentro dei suoi luoghi verificati: un posto all'Aventino non conta come Trastevere.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { repairMomentSelection } from '../../services/momentSelection';
import { quartiereFuoriLista, dentroNucleo } from '../../lib/cityKnowledge';
import { fetchCityKnowledge } from '../../services/cityKnowledgeService';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { promptQuartiere, leggiListaQuartiere, versioneQuartiere, CITY_LIST_VERSION } from '../../../supabase/functions/openai-proxy/cityKnowledge.ts';

const LAT = 41.9, LNG = 12.47;
const KM_LAT = 1 / 111, KM_LNG = 1 / 82.8;
const posto = (name, kmN, kmE, extra = {}) => ({
    place_id: `pid-${name.replace(/\W+/g, '-').toLowerCase()}`, name, title: name,
    latitude: LAT + kmN * KM_LAT, longitude: LNG + kmE * KM_LNG, lat: LAT + kmN * KM_LAT, lng: LNG + kmE * KM_LNG,
    rating: 4.5, user_ratings_total: 400, types: ['tourist_attraction', 'point_of_interest'], ...extra,
});
const M = (key, stops, extra = {}) => ({ id: `g1-${key}`, key, label: key, dayIndex: 0, stops, ...extra });
const nomiDi = (plan, id) => plan.filter(p => p.moment.id === id).flatMap(p => p.stops.map(s => s.candidate.name));
const tracciaDi = (plan, id) => plan.filter(p => p.moment.id === id).flatMap(p => p.stops.map(s => s.trace))[0];

describe('C10c-piena-2 — la varieta\' e\' una preferenza a cascata', () => {
    const piazzaUno = posto('Piazza Grande', 0, 0, { primaryType: 'plaza' });
    const chiesa = posto('Chiesa Madre', 0.2, 0.1, { types: ['church', 'place_of_worship'], primaryType: 'church' });
    const pranzo = posto('Trattoria Sotto', -0.2, 0, { types: ['restaurant', 'food'], primaryType: 'italian_restaurant' });
    const bar = posto('Bar Centrale', 0.1, -0.1, { types: ['bar'], primaryType: 'bar' });
    const cena = posto('Osteria Sera', 0.05, -0.15, { types: ['restaurant', 'food'], primaryType: 'italian_restaurant' });
    const giorno = () => [M('mattina', 2), M('pranzo', 1), M('aperitivo', 1, { bevuta: true }), M('passeggiata', 1, { opzionale: true }), M('cena', 1)];
    const scelte = [
        { place_id: piazzaUno.place_id, moment: 'g1-mattina' }, { place_id: chiesa.place_id, moment: 'g1-mattina' },
        { place_id: pranzo.place_id, moment: 'g1-pranzo' }, { place_id: bar.place_id, moment: 'g1-aperitivo' }, { place_id: cena.place_id, moment: 'g1-cena' },
    ];

    it('un giorno che usa una piazza mantiene la passeggiata della sera con un\'altra piazza (gradino b)', () => {
        const piazzaDue = posto('Piazza Piccola', 0.1, -0.05, { primaryType: 'plaza' });
        const buckets = new Map([['g1-mattina', [piazzaUno, chiesa]], ['g1-pranzo', [pranzo]], ['g1-aperitivo', [bar]],
            ['g1-passeggiata', [piazzaDue]], ['g1-cena', [cena]]]);
        const { plan, report } = repairMomentSelection({ moments: giorno(), buckets, aiStops: scelte, pool: [piazzaUno, chiesa, pranzo, bar, piazzaDue, cena], tempoLiberoMinuti: 45 });
        expect(nomiDi(plan, 'g1-passeggiata')).toEqual(['Piazza Piccola']);
        expect(tracciaDi(plan, 'g1-passeggiata').gradino).toBe('b');
        expect(report.facoltativiSenzaPosto).toEqual([]);
        expect(report.cascata.find(x => x.momento === 'g1-passeggiata')).toMatchObject({ gradino: 'b', facoltativo: true });
    });

    it('in un borgo con una sola piazza emblematica (ancora) la sera torna li\', una volta sola (gradino c)', () => {
        const piazzaAncora = { ...piazzaUno, _citta: { tipo: 'essenziale', momento: 'mattina', ancora: true, categoria: 'piazza' } };
        const buckets = new Map([['g1-mattina', [piazzaAncora, chiesa]], ['g1-pranzo', [pranzo]], ['g1-aperitivo', [bar]],
            ['g1-passeggiata', [piazzaAncora]], ['g1-cena', [cena]]]);
        const { plan } = repairMomentSelection({ moments: giorno(), buckets, aiStops: scelte, pool: [piazzaAncora, chiesa, pranzo, bar, cena], tempoLiberoMinuti: 45 });
        expect(nomiDi(plan, 'g1-mattina')).toContain('Piazza Grande');
        expect(nomiDi(plan, 'g1-passeggiata')).toEqual(['Piazza Grande']);
        expect(tracciaDi(plan, 'g1-passeggiata')).toMatchObject({ gradino: 'c', ripetuta: true });
        // prima delle ricerche mirate (nessun tempo libero deciso) non torna: si cerca prima un posto nuovo
        const prima = repairMomentSelection({ moments: giorno(), buckets, aiStops: scelte, pool: [piazzaAncora, chiesa, pranzo, bar, cena] });
        expect(nomiDi(prima.plan, 'g1-passeggiata')).toEqual([]);
        // un posto qualunque (non un'ancora ne' il simbolo) non torna mai
        const qualunque = new Map([...buckets].map(([k, v]) => [k, v.map(c => (c.place_id === piazzaUno.place_id ? piazzaUno : c))]));
        const { plan: p2 } = repairMomentSelection({ moments: giorno(), buckets: qualunque, aiStops: scelte, pool: [piazzaUno, chiesa, pranzo, bar, cena], tempoLiberoMinuti: 45 });
        expect(nomiDi(p2, 'g1-passeggiata')).toEqual([]);
    });

    it('in una citta\' con alternative lo stesso posto non torna: la cascata si ferma prima (gradino b, non c)', () => {
        const piazzaAncora = { ...piazzaUno, _citta: { tipo: 'essenziale', momento: 'mattina', ancora: true, categoria: 'piazza' } };
        const piazzaDue = posto('Piazza Piccola', 0.1, -0.05, { primaryType: 'plaza' });
        const buckets = new Map([['g1-mattina', [piazzaAncora, chiesa]], ['g1-pranzo', [pranzo]], ['g1-aperitivo', [bar]],
            ['g1-passeggiata', [piazzaAncora, piazzaDue]], ['g1-cena', [cena]]]);
        const { plan } = repairMomentSelection({ moments: giorno(), buckets, aiStops: scelte, pool: [piazzaAncora, chiesa, pranzo, bar, piazzaDue, cena], tempoLiberoMinuti: 45 });
        expect(nomiDi(plan, 'g1-passeggiata')).toEqual(['Piazza Piccola']);
        expect(tracciaDi(plan, 'g1-passeggiata').gradino).toBe('b');
        const ids = plan.flatMap(p => p.stops.map(s => s.candidate.place_id));
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('C10c-piena-2 — lo stesso posto in due schede di Google non torna', () => {
    it('Piazza Sant\'Oronzo come monumento al pomeriggio e come piazza alla passeggiata: la seconda non entra', () => {
        const comeMonumento = posto('Piazza Sant\'Oronzo', 0, 0, { primaryType: 'historical_landmark', types: ['historical_landmark', 'tourist_attraction'] });
        const comePiazza = { ...posto('Piazza Sant\'Oronzo', 0.0005, -0.002, { types: ['route'] }), place_id: 'pid-sant-oronzo-via' };
        const chiesa = posto('Chiesa di Santa Chiara', 0.2, 0.1, { types: ['church'], primaryType: 'church' });
        const pranzo = posto('Trattoria Sotto', -0.2, 0, { types: ['restaurant', 'food'], primaryType: 'italian_restaurant' });
        const bar = posto('Bar Centrale', 0.1, -0.1, { types: ['bar'], primaryType: 'bar' });
        const cena = posto('Osteria Sera', 0.05, -0.15, { types: ['restaurant', 'food'], primaryType: 'italian_restaurant' });
        const moments = [M('pomeriggio', 2), M('aperitivo', 1, { bevuta: true }), M('passeggiata', 1, { opzionale: true }), M('cena', 1)];
        const buckets = new Map([['g1-pomeriggio', [comeMonumento, chiesa]], ['g1-aperitivo', [bar]], ['g1-passeggiata', [comePiazza]], ['g1-cena', [cena]]]);
        const aiStops = [{ place_id: comeMonumento.place_id, moment: 'g1-pomeriggio' }, { place_id: chiesa.place_id, moment: 'g1-pomeriggio' },
            { place_id: bar.place_id, moment: 'g1-aperitivo' }, { place_id: comePiazza.place_id, moment: 'g1-passeggiata' }, { place_id: cena.place_id, moment: 'g1-cena' }];
        const { plan, report } = repairMomentSelection({ moments, buckets, aiStops, pool: [comeMonumento, comePiazza, chiesa, pranzo, bar, cena], tempoLiberoMinuti: 45 });
        expect(plan.flatMap(p => p.stops.map(s => s.candidate.name)).filter(n => n === 'Piazza Sant\'Oronzo')).toHaveLength(1);
        expect(report.scartate.find(x => x.place_id === 'pid-sant-oronzo-via')?.motivo).toMatch(/stesso posto/);
    });
});

// ─── il borgo nel motore: la sera torna sulla piazza emblematica, con un testo diverso da quello della mattina ───
describe('C10c-piena-2 — il borgo: la piazza emblematica torna la sera con un altro testo', () => {
    const TR = { latitude: 37.7845, longitude: 14.5975, isSmallTown: true, radiusKm: 5 };
    const g = (name, lat, lng, extra = {}) => ({
        place_id: `pid-${name.replace(/\W+/g, '-').toLowerCase()}`, name, formatted_address: `${name}, 94018 Troina EN, Italia`,
        geometry: { location: { lat, lng } }, business_status: 'OPERATIONAL', utc_offset_minutes: 120,
        types: ['tourist_attraction', 'point_of_interest'], rating: 4.6, user_ratings_total: 120, ...extra,
    });
    const orari = (da, a) => ({ periods: [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: da }, close: { day: d, time: a } })) });
    const lista = (p, tipo, momento, extra = {}) => ({ ...p, _citta: { tipo, momento, ...extra } });
    const BORGO = [
        lista(g('Chiesa Madre', 37.7846, 14.5973, { primary_type: 'church', types: ['church', 'place_of_worship'], opening_hours: orari('0800', '2000') }), 'essenziale', 'mattina', { simbolo: true, categoria: 'chiesa' }),
        lista(g('Piazza Conte Ruggero', 37.7848, 14.5977, { primary_type: 'plaza', types: ['tourist_attraction', 'point_of_interest'] }), 'essenziale', 'mattina', { categoria: 'piazza' }),
        lista(g('Museo Civico', 37.7842, 14.5979, { primary_type: 'museum', types: ['museum'], opening_hours: orari('0900', '1900') }), 'da locale', 'pomeriggio', { categoria: 'museo' }),
        lista(g('Torre Capitania', 37.7850, 14.5970, { primary_type: 'historical_landmark', types: ['historical_landmark', 'tourist_attraction'], opening_hours: orari('0900', '1900') }), 'da locale', 'pomeriggio', { categoria: 'monumento' }),
        lista(g('Convento di Sant\'Agostino', 37.7838, 14.5968, { primary_type: 'church', types: ['church'], opening_hours: orari('0800', '1900') }), 'da locale', 'pomeriggio', { categoria: 'chiesa' }),
        lista(g('Trattoria del Borgo', 37.7844, 14.5981, { primary_type: 'italian_restaurant', types: ['restaurant', 'food'], opening_hours: orari('1200', '2300') }), 'da locale', 'pranzo', { categoria: 'ristorante' }),
        lista(g('Osteria della Torre', 37.7849, 14.5966, { primary_type: 'italian_restaurant', types: ['restaurant', 'food'], opening_hours: orari('1200', '2300') }), 'da locale', 'cena', { categoria: 'ristorante' }),
        lista(g('Bar della Piazza', 37.7847, 14.5978, { primary_type: 'bar', types: ['bar'], opening_hours: orari('0700', '2359') }), 'da locale', 'aperitivo', { categoria: 'dopocena' }),
    ];
    const traduttore = { choices: [{ message: { content: JSON.stringify({ queries: ['piazza storica'], categoria: 'misto', oggetto_umano: 'un giro', citta: null, vincoli: { tempo: null, escludi: [], note: null } }) } }] };
    const fetchFinto = () => vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const sys = String(JSON.parse(String(init?.body || '{}')).messages?.[0]?.content || '');
            if (sys.includes('traduttore di intenti')) return { ok: true, json: async () => traduttore };
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ stops: [
                { place_id: 'pid-chiesa-madre', moment: 'g1-mattina' }, { place_id: 'pid-piazza-conte-ruggero', moment: 'g1-mattina' },
                { place_id: 'pid-trattoria-del-borgo', moment: 'g1-pranzo' }, { place_id: 'pid-museo-civico', moment: 'g1-pomeriggio' },
                { place_id: 'pid-torre-capitania', moment: 'g1-pomeriggio' }, { place_id: 'pid-bar-della-piazza', moment: 'g1-aperitivo' },
                { place_id: 'pid-osteria-della-torre', moment: 'g1-cena' },
            ] }) } }] }) };
        }
        return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [], candidates: [] }) };
    });
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-14T22:19:00+02:00'));
    });
    afterEach(() => {
        vi.unstubAllGlobals(); vi.useRealTimers();
        vi.mocked(fetchCityKnowledge).mockReset(); vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'spenta', verificati: [] });
    });

    it('la piazza dell\'ancora torna nella passeggiata della sera, una volta, con un testo diverso', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'borgo', verificati: BORGO });
        vi.stubGlobal('fetch', fetchFinto());
        const r = await aiRecommendationService.generateItinerary('Troina', { duration: '1 Giorno' }, 'Domani una giornata a Troina', {}, '', TR, { pathType: 'custom', skipUserQuota: true });
        const tappe = r.days.flatMap(d => d.stops).filter(s => !s.tempoLibero);
        const piazza = tappe.filter(s => s.title === 'Piazza Conte Ruggero');
        expect(piazza.map(s => [s.moment, !!s.passeggiata])).toEqual([['mattina', false], ['aperitivo', true]]);
        expect(piazza[1]._tracciato).toMatchObject({ gradino: 'c', ripetuta: true });
        expect(piazza[0].description).toBeTruthy();
        expect(piazza[1].description).toBeTruthy();
        expect(piazza[1].description).not.toBe(piazza[0].description);
        // il gradino c e' della sera: di giorno nessun posto torna
        const giorno = tappe.filter(s => !s.passeggiata).map(s => s.place_id);
        expect(new Set(giorno).size).toBe(giorno.length);
    });
});

// ─── Trastevere: la lista del quartiere con la categoria, il nucleo vero ──────
describe('C10c-piena-2 — il quartiere chiesto: categoria e nucleo vero', () => {
    it('la lista del quartiere porta la categoria, e ha una versione sua (le liste delle citta\' non si rigenerano)', () => {
        const { system } = promptQuartiere('Roma', 'Trastevere', '2026-10-15');
        expect(system).toMatch(/"categoria":"[^"]*piazza[^"]*via/);
        expect(system).toMatch(/una piazza storica e' "piazza", una strada storica e' "via"/);
        const posti = leggiListaQuartiere(JSON.stringify({ posti: [
            { nome: 'Piazza di Santa Maria in Trastevere', citta: 'Roma', quartiere: 'Trastevere', categoria: 'piazza', momento: 'mattina', tipo: 'da locale' },
            { nome: 'Via della Lungaretta', citta: 'Roma', quartiere: 'Trastevere', categoria: 'via', momento: 'pomeriggio', tipo: 'da locale' },
        ] }), 'Roma', 'Trastevere');
        expect(posti.map(p => p.categoria)).toEqual(['piazza', 'via']);
        expect(versioneQuartiere('Trastevere')).toMatch(/#q:trastevere$/);
        expect(versioneQuartiere('Trastevere').startsWith(`${CITY_LIST_VERSION}#`)).toBe(false);
    });

    // coordinate vere (Google, giro del 14/10): i luoghi della lista dedicata di Trastevere e le tappe del giro
    const pt = (name, lat, lng) => ({ place_id: name, name, latitude: lat, longitude: lng, lat, lng, _citta: { tipo: 'da locale' } });
    const LISTA = [
        pt('Basilica di Santa Maria in Trastevere', 41.889493, 12.4698361), pt('Basilica di Santa Cecilia in Trastevere', 41.8875482, 12.4759469),
        pt('Villa Farnesina', 41.8932, 12.4673), pt('Piazza di Santa Maria in Trastevere', 41.8892, 12.4703),
        pt('Piazza Trilussa', 41.8916, 12.4705), pt('Via della Lungaretta', 41.8892, 12.4727), pt('Vicolo del Cinque', 41.8911, 12.4693),
    ];
    // il punto di Google del quartiere e il suo riquadro largo (fino al Pantheon)
    const GOOGLE = { name: 'Trastevere', types: ['neighborhood', 'political'], geometry: { location: { lat: 41.8848294, lng: 12.4704017 },
        viewport: { northeast: { lat: 41.8949, lng: 12.4810 }, southwest: { lat: 41.8788, lng: 12.4600 } } } };

    it('il nucleo e\' il baricentro dei luoghi verificati della lista: l\'Aventino non e\' Trastevere', () => {
        const q = quartiereFuoriLista({ nome: 'Trastevere', candidato: GOOGLE, poiQuartiere: LISTA });
        const bar = { latitude: LISTA.reduce((a, p) => a + p.latitude, 0) / LISTA.length, longitude: LISTA.reduce((a, p) => a + p.longitude, 0) / LISTA.length };
        expect(q.nucleo.fonte).toBe('lista');
        expect(q.nucleo.centro.latitude).toBeCloseTo(bar.latitude, 6);
        expect(q.nucleo.centro.longitude).toBeCloseTo(bar.longitude, 6);
        expect(q.nucleo.raggioKm).toBeLessThanOrEqual(1);
        expect(q.nucleo.riquadro).toBeUndefined();
        // tutti i luoghi della lista ci stanno
        for (const p of LISTA) expect(dentroNucleo(p, q.nucleo), p.name).toBe(true);
        // l'Aventino (oltre il Tevere, entro 1 km dal punto di Google) e Piazza Navona no
        expect(dentroNucleo(pt('Giardino degli Aranci', 41.8851338, 12.48039), q.nucleo)).toBe(false);
        expect(dentroNucleo(pt('Terrazza Belvedere Aventino', 41.8854348, 12.479942), q.nucleo)).toBe(false);
        expect(dentroNucleo(pt('Piazza Navona', 41.8991633, 12.4730742), q.nucleo)).toBe(false);
        // una trattoria di Trastevere (via dei Vascellari) si'
        expect(dentroNucleo(pt('Trattoria Da Enzo', 41.8880847, 12.4778554), q.nucleo)).toBe(true);
    });

    it('senza la lista dedicata il nucleo resta il punto di Google (dichiarato)', () => {
        const q = quartiereFuoriLista({ nome: 'Trastevere', candidato: GOOGLE, poiQuartiere: [] });
        expect(q.nucleo).toMatchObject({ fonte: 'google', raggioKm: 1 });
    });
});
