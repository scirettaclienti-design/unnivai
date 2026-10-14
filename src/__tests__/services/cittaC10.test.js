// C10 — l'AI conosce la città, Google verifica, le regole compongono.
//
// Verifica (il modulo del proxy, puro): un nome che Google non trova non entra; un omonimo fuori città non entra; un posto
// chiuso per sempre non entra. Merito (decisione di Ivano su P7a): un essenziale verificato non viene tagliato dal merito;
// al massimo 3 ancore in una giornata intera, 1 in mezza. Motore intero: con la lista, l'ancora arriva nel tour anche se il
// selettore non la sceglie, e passa per le regole di sempre.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    verificaPosto, nomeCompatibile, leggiLista, giornoValido, promptCitta, raggioCittaKm, TOP_30_CITIES as TOP_PROXY,
    MAX_ESSENZIALI, POSTI_LISTA, voceVerificata,
} from '../../../supabase/functions/openai-proxy/cityKnowledge.ts';
import { poolConLista, seminaAncore, ancorePerGiorno, poiDallaLista, uniscialPool, declassa } from '../../lib/cityKnowledge';
import { selectScoredCandidatePool } from '../../services/candidateScoring';
import { TOP_30_CITIES } from '../../services/tourShape';
import { fetchCityKnowledge } from '../../services/cityKnowledgeService';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { buildPOIFromCandidate } from '../../services/placesDiscoveryService';

const CATANIA = { lat: 37.5079, lng: 15.083 };
const g = (name, dLat, dLng, extra = {}) => ({
    place_id: `pid-${name.replace(/\W+/g, '-').toLowerCase()}`, name,
    geometry: { location: { lat: CATANIA.lat + dLat, lng: CATANIA.lng + dLng } },
    business_status: 'OPERATIONAL', types: ['tourist_attraction', 'point_of_interest', 'establishment'],
    rating: 4.6, user_ratings_total: 500, ...extra,
});

describe('C10 — la verifica su Google', () => {
    const p = (nome) => ({ nome, citta: 'Catania' });
    it('un nome che Google non trova non entra', () => {
        expect(verificaPosto(p('Trattoria Inventata dai Sogni'), [], CATANIA, 20)).toMatchObject({ ok: false, motivo: 'non trovato su Google' });
        expect(verificaPosto(p('Trattoria Inventata dai Sogni'), null, CATANIA, 20).ok).toBe(false);
    });
    it('un nome diverso (Google risponde con un altro posto) non entra', () => {
        const v = verificaPosto(p('Trattoria Inventata dai Sogni'), [g('Pizzeria Etna', 0.001, 0)], CATANIA, 20);
        expect(v.ok).toBe(false);
        expect(v.motivo).toMatch(/^nome diverso/);
    });
    it('un omonimo fuori città non entra (Castello Ursino a 300 km)', () => {
        const lontano = g('Castello Ursino', 2.7, 0);
        const v = verificaPosto(p('Castello Ursino'), [lontano], CATANIA, 20);
        expect(v.ok).toBe(false);
        expect(v.motivo).toMatch(/^fuori città/);
    });
    it('fra un omonimo lontano e quello vero, entra quello vero', () => {
        const vero = g('Castello Ursino', -0.006, -0.001);
        const v = verificaPosto(p('Castello Ursino'), [g('Castello Ursino', 2.7, 0), vero], CATANIA, 20);
        expect(v.ok).toBe(true);
        expect(v.risultato.place_id).toBe(vero.place_id);
    });
    it('chiuso per sempre non entra', () => {
        const v = verificaPosto(p('Bar Chiuso'), [g('Bar Chiuso', 0.001, 0, { business_status: 'CLOSED_PERMANENTLY' })], CATANIA, 20);
        expect(v).toMatchObject({ ok: false, motivo: 'chiuso per sempre' });
    });
    it('nomi compatibili come li scrive Google', () => {
        expect(nomeCompatibile('Teatro Bellini', 'Teatro Massimo Bellini', 'Catania')).toBe(true);
        expect(nomeCompatibile("Fera 'o Luni", 'Market Fera O’Luni', 'Catania')).toBe(true);
        expect(nomeCompatibile('Pescheria', 'Pescheria di Catania', 'Catania')).toBe(true);
        expect(nomeCompatibile("Cattedrale di Sant'Agata", "Basilica Cattedrale di Sant'Agata", 'Catania')).toBe(true);
        expect(nomeCompatibile('Monastero dei Benedettini', "Monastero dei Benedettini di San Nicolò l'Arena", 'Catania')).toBe(true);
        expect(nomeCompatibile('Trattoria da Mario', 'Pizzeria da Mario', 'Catania')).toBe(false);
        expect(nomeCompatibile('Catania', 'Comune di Catania', 'Catania')).toBe(false);
        // il primo giro vero: «Caffè Catania» non è «Costa Caffè Catania» (solo una parola generica in comune)
        expect(nomeCompatibile('Caffè Catania', 'Costa Caffè Catania', 'Catania')).toBe(false);
        expect(nomeCompatibile('Mercato del Pesce', 'Storico mercato del pesce di Catania', 'Catania')).toBe(true);
        expect(nomeCompatibile('Via Etnea', 'Via Etnea', 'Catania')).toBe(true);
        expect(nomeCompatibile('Ristorante Il Covo', 'Il Covo', 'Catania')).toBe(true);
    });
    it('il raggio della città è quello del motore, e la lista delle grandi città è la stessa', () => {
        expect([...TOP_PROXY].sort()).toEqual([...TOP_30_CITIES].sort());
        expect(raggioCittaKm('Catania')).toBe(20);
        expect(raggioCittaKm('Troina')).toBe(12);
    });
    it('al client va il posto di Google con momento e tipo, mai il perché', () => {
        const v = voceVerificata({ nome: 'Pescheria', citta: 'Catania', momento: 'mattina', tipo: 'da locale', perche: 'il pesce del giorno' }, g('Pescheria di Catania', 0, 0.004));
        expect(v._citta).toEqual({ momento: 'mattina', tipo: 'da locale', nomeProposto: 'Pescheria' });
        expect(JSON.stringify(v)).not.toContain('il pesce del giorno');
    });
});

describe('C10 — la lista dell\'AI, ripulita', () => {
    const cinque = Array.from({ length: 6 }, (_, i) => ({ nome: `Essenziale ${i}`, momento: 'mattina', tipo: 'essenziale', perche: 'x' }));
    it('al massimo 4 essenziali (gli altri diventano «da locale»), al massimo 15 posti, momenti validi, niente doppioni', () => {
        const molti = Array.from({ length: 20 }, (_, i) => ({ nome: `Posto ${i}`, momento: 'pomeriggio', tipo: 'da locale', perche: 'y' }));
        const l = leggiLista(JSON.stringify({ posti: [...cinque, { nome: 'Posto 1', momento: 'cena', tipo: 'da locale' }, { nome: 'Senza momento', momento: 'notte fonda', tipo: 'da locale' }, ...molti] }), 'Catania');
        expect(l.length).toBe(POSTI_LISTA);
        expect(l.filter(x => x.tipo === 'essenziale').length).toBe(MAX_ESSENZIALI);
        expect(l.some(x => x.nome === 'Senza momento')).toBe(false);
        expect(l.filter(x => x.nome === 'Posto 1').length).toBe(1);
    });
    it('una risposta illeggibile è una lista vuota, non un errore', () => {
        expect(leggiLista('non è json', 'Catania')).toEqual([]);
    });
    it('il giorno: da ieri a sette giorni', () => {
        expect(giornoValido('2026-10-15', '2026-10-14')).toBe(true);
        expect(giornoValido('2026-10-13', '2026-10-14')).toBe(true);
        expect(giornoValido('2026-10-25', '2026-10-14')).toBe(false);
        expect(giornoValido('domani', '2026-10-14')).toBe(false);
    });
    it('il prompt chiede colazione, mercato con giorni e orari, dopocena, al massimo 4 essenziali, il giorno', () => {
        const { system, user } = promptCitta('Catania', '2026-10-15');
        expect(system).toMatch(/colazione vera/);
        expect(system).toMatch(/mercato, con i suoi giorni e orari/);
        expect(system).toMatch(/dopo cena/);
        expect(system).toMatch(/"essenziale" \(da 3 a 4\)/);
        expect(system).toMatch(/Un essenziale non è MAI un bar, un caffè, una pasticceria, un ristorante/);
        expect(user).toBe('Città: Catania. Giorno: giovedì 15 ottobre 2026.');
    });
});

// ─── il merito e le ancore ───────────────────────────────────────────────────
const W = (h1, m1, h2, m2) => ({ start: new Date(`2026-10-15T${String(h1).padStart(2, '0')}:${String(m1).padStart(2, '0')}:00+02:00`), end: new Date(`2026-10-15T${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}:00+02:00`) });
const GIORNATA = { windows: [W(9, 30, 22, 30)] };
const MEZZA = { windows: [W(15, 0, 19, 0)] };
const poi = (name, extra = {}) => ({ ...buildPOIFromCandidate(g(name, Math.random() * 0.004, Math.random() * 0.004, extra), 'Catania') });
const ess = (name, types, extra = {}) => ({ ...poi(name, { types, ...extra }), _citta: { tipo: 'essenziale', momento: 'mattina' } });
const seleziona = (altri) => selectScoredCandidatePool(altri, { city: 'Catania', limit: 20 });

describe('C10 — il merito (decisione di Ivano su P7a)', () => {
    // 24 trattorie e piazze "da merito" + un essenziale con 11.472 recensioni: senza la lista il merito lo taglia
    const altri = Array.from({ length: 24 }, (_, i) => poi(`Trattoria ${i}`, { types: ['restaurant', 'food'], primary_type: 'italian_restaurant', rating: 4.6, user_ratings_total: 300 + i * 40 }));
    const cattedrale = ess("Basilica Cattedrale di Sant'Agata", ['church', 'place_of_worship', 'tourist_attraction'], { primary_type: 'church', user_ratings_total: 11472, rating: 4.7 });
    it('senza lista: il merito anti-ovvio la taglia (è il difetto di C9)', () => {
        const { _citta, ...nuda } = cattedrale;
        const fuori = seleziona([...altri, nuda]);
        expect(fuori.some(c => c.place_id === cattedrale.place_id)).toBe(false);
    });
    it('un essenziale verificato non viene tagliato dal merito e non conta nel limite dei 20', () => {
        const r = poolConLista([...altri, cattedrale], { seleziona, tourWindow: GIORNATA });
        expect(r.candidates.some(c => c.place_id === cattedrale.place_id)).toBe(true);
        expect(r.ancore.map(c => c.place_id)).toEqual([cattedrale.place_id]);
        // i 20 del merito restano 20: l'ancora è in più
        expect(r.candidates.filter(c => !c._citta).length).toBe(20);
    });
    it('non più di 3 ancore in una giornata intera, 1 in mezza: le candidate in più si declassano', () => {
        const cinque = [
            ess('Cattedrale', ['church'], { primary_type: 'church' }), ess('Museo Civico', ['museum'], { primary_type: 'museum' }),
            ess('Villa Bellini', ['park'], { primary_type: 'park' }), ess('Teatro Massimo', ['tourist_attraction']), ess('Pescheria', ['market'], { primary_type: 'market' }),
        ];
        const r = poolConLista([...altri, ...cinque], { seleziona, tourWindow: GIORNATA });
        // candidate: al massimo 4 (gli essenziali della lista); il quinto torna al merito
        expect(r.ancore.length).toBe(4);
        expect(r.essenzialiAlMerito.length).toBe(1);
        const moments = [{ id: 'g1-mattina', key: 'mattina', dayIndex: 0, stops: 3 }, { id: 'g1-pomeriggio', key: 'pomeriggio', dayIndex: 0, stops: 3 }];
        const buckets = new Map(moments.map(m => [m.id, r.ancore]));
        const g1 = seminaAncore([], r.ancore, moments, buckets, GIORNATA);
        expect(g1.seminate.length).toBe(3);
        expect(g1.nonSeminate.length).toBe(1);
        declassa(g1.nonSeminate);
        expect(r.candidates.filter(c => c._citta?.ancora).length).toBe(3);
        const r2 = poolConLista([...altri, ...cinque.map(c => ({ ...c, _citta: { ...c._citta } }))], { seleziona, tourWindow: MEZZA });
        const m = seminaAncore([], r2.ancore, moments, new Map(moments.map(x => [x.id, r2.ancore])), MEZZA);
        expect(m.seminate.length).toBe(1);
        expect(ancorePerGiorno(GIORNATA)).toEqual([3]);
        expect(ancorePerGiorno(MEZZA)).toEqual([1]);
    });
    it('un essenziale che nessun momento ammette non è un\'ancora (la Pescheria di pomeriggio, chiusa)', () => {
        const moments = [{ id: 'g1-pomeriggio', key: 'pomeriggio', dayIndex: 0, stops: 2 }];
        const pescheria = { ...ess('Pescheria', ['market'], { primary_type: 'market' }), _citta: { tipo: 'essenziale', momento: 'mattina', ancora: true } };
        const { seminate, nonSeminate } = seminaAncore([], [pescheria], moments, new Map([['g1-pomeriggio', []]]), GIORNATA);
        expect(seminate).toEqual([]);
        declassa(nonSeminate);
        expect(pescheria._citta).toBeUndefined();
    });
    it('un essenziale che è un locale (Caffè del Duomo) non è un\'ancora: resta un posto «da locale»', () => {
        const caffe = { ...poi('Caffè del Duomo e Ristorante', { types: ['cafe', 'restaurant', 'food'], primary_type: 'cafe' }), _citta: { tipo: 'essenziale', momento: 'colazione' } };
        const r = poolConLista([...altri, caffe], { seleziona, tourWindow: GIORNATA });
        expect(r.ancore).toEqual([]);
        expect(r.daLocale.map(c => c.place_id)).toEqual([caffe.place_id]);
    });
    it('due chiese non sono due ancore (la varietà ne terrebbe una)', () => {
        const r = poolConLista([...altri, ess('Chiesa Uno', ['church'], { primary_type: 'church' }), ess('Chiesa Due', ['church'], { primary_type: 'church' })], { seleziona, tourWindow: GIORNATA });
        expect(r.ancore.length).toBe(1);
    });
    it('la semina: in testa al momento, al massimo le ancore del giorno', () => {
        const moments = [{ id: 'g1-mattina', key: 'mattina', dayIndex: 0, stops: 2 }, { id: 'g1-pomeriggio', key: 'pomeriggio', dayIndex: 0, stops: 2 }];
        const quattro = ['A', 'B', 'C', 'D'].map(n => ({ ...ess(`Ancora ${n}`, ['tourist_attraction']), _citta: { tipo: 'essenziale', momento: 'mattina', ancora: true } }));
        const buckets = new Map(moments.map(m => [m.id, quattro]));
        const { aiStops, seminate } = seminaAncore([{ place_id: 'x', moment: 'g1-mattina' }], quattro, moments, buckets, GIORNATA);
        expect(seminate.length).toBe(3);
        expect(aiStops[0]).toEqual({ place_id: quattro[0].place_id, moment: 'g1-mattina' });
        expect(aiStops.at(-1)).toEqual({ place_id: 'x', moment: 'g1-mattina' });
    });
    it('un posto della lista già trovato dalla ricerca resta uno solo, con la sua etichetta', () => {
        const trovato = poi('Pescheria di Catania');
        const lista = poiDallaLista([{ ...g('Pescheria di Catania', 0, 0), place_id: trovato.place_id, _citta: { tipo: 'da locale', momento: 'mattina' } }], 'Catania', buildPOIFromCandidate);
        const u = uniscialPool([trovato], lista);
        expect(u.length).toBe(1);
        expect(u[0]._citta).toEqual({ tipo: 'da locale', momento: 'mattina' });
    });
});

// ─── il motore intero ────────────────────────────────────────────────────────
const CENTRO = { latitude: CATANIA.lat, longitude: CATANIA.lng, isSmallTown: false, radiusKm: 10 };
const piazza = (n, d) => g(n, d, d / 2, { primary_type: 'tourist_attraction', user_ratings_total: 120 });
const TRATT = Array.from({ length: 6 }, (_, i) => g(`Trattoria ${i}`, -0.002 - i * 0.0005, 0.001, { primary_type: 'italian_restaurant', types: ['italian_restaurant', 'restaurant', 'food'] }));
const PIAZZE = ['Piazza Uno', 'Piazza Due', 'Porta Tre', 'Fontana Quattro', 'Palazzo Cinque'].map((n, i) => piazza(n, 0.001 * (i + 1)));
const BAR = [g('Bar Sera', 0.001, -0.002, { primary_type: 'cocktail_bar', types: ['cocktail_bar', 'bar'] })];
const ANCORA = g("Basilica Cattedrale di Sant'Agata", 0.0005, 0.0005, { primary_type: 'church', types: ['church', 'place_of_worship', 'tourist_attraction'], user_ratings_total: 11472, rating: 4.7 });

const routeFetch = (selector) => {
    const stato = { ai: 0, selettore: null };
    return {
        stato,
        fn: vi.fn(async (url, init) => {
            const u = String(url);
            if (u.includes('openai-proxy')) {
                const body = JSON.parse(String(init?.body || '{}'));
                const sys = String(body.messages?.[0]?.content || '');
                stato.ai += 1;
                if (sys.includes('traduttore di intenti')) return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ queries: ['piazza storica', 'trattoria tipica'], categoria: 'misto', oggetto_umano: 'un giro', vincoli: { tempo: null, escludi: [], note: null } }) } }] }) };
                if (stato.selettore === null) { stato.selettore = String(init?.body); return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(selector) } }] }) }; }
                return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ days: [] }) } }] }) };
            }
            if (u.includes('textsearch')) {
                const q = new URL(u, 'http://x').searchParams.get('query') || '';
                const res = q.startsWith('piazza') ? PIAZZE : q.startsWith('trattoria') ? TRATT : /bar|cocktail/.test(q) ? BAR : [];
                return { ok: true, json: async () => ({ status: res.length ? 'OK' : 'ZERO_RESULTS', results: res }) };
            }
            return { ok: true, json: async () => ({ status: 'OK', result: {}, candidates: [] }) };
        }),
    };
};

describe('C10 — il motore con la lista della città', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-14T22:19:00+02:00'));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.mocked(fetchCityKnowledge).mockReset(); vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'spenta', verificati: [] }); });

    it('l\'ancora entra nel tour anche se il selettore non la sceglie, e il rapporto lo dice', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, verificati: [{ ...ANCORA, _citta: { tipo: 'essenziale', momento: 'mattina' } }] });
        const sel = { stops: [{ place_id: PIAZZE[0].place_id, moment: 'g1-mattina' }, { place_id: PIAZZE[1].place_id, moment: 'g1-mattina' }, { place_id: TRATT[0].place_id, moment: 'g1-pranzo' }] };
        const { fn, stato } = routeFetch(sel);
        vi.stubGlobal('fetch', fn);
        const r = await aiRecommendationService.generateItinerary('Catania', { duration: '1 Giorno' }, 'Domani una giornata a Catania', {}, '', CENTRO, { pathType: 'custom', skipUserQuota: true });
        const titoli = r.days.flatMap(d => d.stops).filter(s => !s.tempoLibero).map(s => s.title);
        expect(titoli).toContain("Basilica Cattedrale di Sant'Agata");
        expect(r._citta.ancore.map(a => a.nome)).toEqual(["Basilica Cattedrale di Sant'Agata"]);
        expect(r._citta.seminate.length).toBe(1);
        // il selettore l'ha vista fra i candidati (è nel pool, fuori dal merito)
        expect(stato.selettore).toContain(ANCORA.place_id);
        // il «perché» non c'è da nessuna parte
        expect(JSON.stringify(r)).not.toMatch(/perche/);
    });

    it('senza lista (proxy giù) il giro esce come prima, e il rapporto dice «assente»', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'assente', verificati: [], errore: '503 CITY_LIST_UNAVAILABLE' });
        const { fn } = routeFetch({ stops: [{ place_id: PIAZZE[0].place_id, moment: 'g1-mattina' }] });
        vi.stubGlobal('fetch', fn);
        const r = await aiRecommendationService.generateItinerary('Catania', { duration: '1 Giorno' }, 'Domani una giornata a Catania', {}, '', CENTRO, { pathType: 'custom', skipUserQuota: true });
        expect(r._source).toBe('google-first');
        expect(r._citta.stato).toBe('assente');
        expect(r._citta.ancore).toEqual([]);
    });
});
