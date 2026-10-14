// C10c-replay — il banco rigiocato dai tracciati (0 $, nessuna rete) e la tappa che si perde quando un momento ne prende una
// in piu':
//   · il replay di un tracciato finto da' il tour atteso (lo stesso del giro registrato: stesse tappe, stessi orari);
//   · un replay che prova a chiamare la rete fallisce (la richiesta che il tracciato non ha non esce mai);
//   · il tracciato dice quale tappa si perde, in quale momento e per quale regola (solo registrazione).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { tappaPersa, criterioRespinto } from '../../services/momentSelection';
import { creaRegistratore, creaReteReplay, ReteVietataError, chiavePlaces, chiaveDaCache, confrontaTour, fattiDalTracciato } from '../../../scripts/banco/replay/rete.js';

// come nel runner del replay (scripts/banco/replay.giro.js): i fatti aperti delle tappe vengono dal tracciato, mai da
// Wikipedia o OSM (qui il tracciato non ne ha: le tappe restano senza fatti, tappe e orari non cambiano)
vi.mock('../../services/factsService', async (importOriginal) => {
    const m = await importOriginal();
    return { ...m, fetchFactsForStops: async (stops) => fattiDalTracciato({}, stops) };
});

const orari = (da, a) => ({ periods: [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: da }, close: { day: d, time: a } })) });
const g = (name, lat, lng, extra = {}) => ({
    place_id: `pid-${name.replace(/\W+/g, '-').toLowerCase()}`, name, formatted_address: `${name}, Catania`,
    geometry: { location: { lat, lng } }, business_status: 'OPERATIONAL', utc_offset_minutes: 120,
    types: ['tourist_attraction', 'point_of_interest'], rating: 4.6, user_ratings_total: 400, ...extra,
});
const VISITE = [
    g('Museo Civico', 37.5032, 15.0868, { primary_type: 'museum', types: ['museum', 'tourist_attraction'], opening_hours: orari('0900', '1900') }),
    g('Chiesa Grande', 37.5025, 15.0877, { primary_type: 'church', types: ['church', 'place_of_worship'], opening_hours: orari('0700', '2000') }),
    g('Palazzo Antico', 37.5021, 15.0866, { primary_type: 'historical_landmark', types: ['historical_landmark', 'tourist_attraction'], opening_hours: orari('0900', '1900') }),
    g('Giardino Pubblico', 37.5038, 15.0880, { primary_type: 'park', types: ['park'], opening_hours: orari('0700', '2100') }),
    g('Teatro Antico', 37.5029, 15.0850, { primary_type: 'historical_landmark', types: ['tourist_attraction'], opening_hours: orari('0900', '1900') }),
];
const LOCALI = [
    g('Trattoria Uno', 37.5029, 15.0862, { primary_type: 'italian_restaurant', types: ['restaurant', 'food'], opening_hours: orari('1200', '2300'), rating: 4.5 }),
    g('Trattoria Due', 37.5019, 15.0879, { primary_type: 'italian_restaurant', types: ['restaurant', 'food'], opening_hours: orari('1200', '2300'), rating: 4.5 }),
    g('Bar Sera', 37.5031, 15.0884, { primary_type: 'bar', types: ['bar'], opening_hours: orari('0700', '2359'), rating: 4.5 }),
];
const traduttore = { choices: [{ message: { content: JSON.stringify({ queries: ['piazza storica', 'trattoria tipica'], categoria: 'misto', oggetto_umano: 'un giro', citta: null, vincoli: { tempo: null, escludi: [], note: null } }) } }] };
const selettore = { choices: [{ message: { content: JSON.stringify({ stops: [
    { place_id: 'pid-museo-civico', moment: 'g1-mattina' }, { place_id: 'pid-chiesa-grande', moment: 'g1-mattina' },
    { place_id: 'pid-trattoria-uno', moment: 'g1-pranzo' }, { place_id: 'pid-palazzo-antico', moment: 'g1-pomeriggio' },
    { place_id: 'pid-bar-sera', moment: 'g1-aperitivo' }, { place_id: 'pid-trattoria-due', moment: 'g1-cena' },
] }) } }] };
// il «giro vero» del test: le risposte dei proxy (Google e AI) per un giro a Catania
const reteVera = () => vi.fn(async (url, init) => {
    const u = String(url);
    const ok = (corpo) => new Response(JSON.stringify(corpo), { status: 200, headers: { 'content-type': 'application/json' } });
    if (u.includes('openai-proxy')) {
        const corpo = JSON.parse(String(init?.body || '{}'));
        if (String(corpo.messages?.[0]?.content || '').includes('traduttore di intenti')) return ok(traduttore);
        if (corpo.dv?.passaggio === 'narratore') return ok({ choices: [{ message: { content: JSON.stringify({ days: [] }) } }] });
        return ok(selettore);
    }
    if (u.includes('textsearch')) {
        const q = new URL(u, 'http://x').searchParams.get('query') || '';
        return ok({ status: 'OK', results: /trattoria|ristorante|bar|cocktail/.test(q) ? LOCALI : VISITE });
    }
    return ok({ status: 'ZERO_RESULTS', candidates: [], results: [] });
});
const CT = { latitude: 37.5027, longitude: 15.0873, isSmallTown: false, radiusKm: 10 };
const generaCatania = () => aiRecommendationService.generateItinerary('Catania', { duration: '1 Giorno' }, 'Domani una giornata a Catania', {}, '', CT, { pathType: 'custom', skipUserQuota: true });
// il grezzo del banco ridotto a quello che conta per la fedelta': titolo, ora, momento
const comeGrezzo = (r) => ({ tours: (r.days || []).map(d => ({ stops: d.stops.map(s => ({ title: s.title, place_id: s.place_id, at: s.scheduledTime ?? null, moment: s.moment ?? null, ...(s.tempoLibero ? { tempoLibero: true, stay: s.stayMinutes } : {}) })) })) });

describe('C10c-replay — il banco rigiocato dai tracciati', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-14T22:19:00+02:00'));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('il replay di un tracciato da\' il tour del giro registrato: stesse tappe, stessi orari, nessuna rete', async () => {
        // il giro «vero», registrato
        const vera = reteVera();
        const reg = creaRegistratore();
        vi.stubGlobal('fetch', async (url, init) => { const res = await vera(url, init); reg.annota(url, init, res.status, await res.clone().json()); return res; });
        const registrato = await generaCatania();
        expect(Object.keys(reg.rete.places).length).toBeGreaterThan(0);
        expect(reg.rete.ai.traduttore).toHaveLength(1);
        expect(reg.rete.ai.selettore).toHaveLength(1);
        // il replay: cache del browser vuota, la rete solo dal tracciato
        window.localStorage.clear();
        const { fetch, stato } = creaReteReplay({ rete: reg.rete });
        vi.stubGlobal('fetch', fetch);
        const rigiocato = await generaCatania();
        expect(stato.uscite).toEqual([]);
        expect(stato.servite).toBeGreaterThan(0);
        // il tour atteso: quello registrato (e le tappe scelte dal selettore ci sono)
        const f = confrontaTour(comeGrezzo(registrato), comeGrezzo(rigiocato));
        expect(f.diff).toEqual([]);
        expect(f.identico).toBe(true);
        const titoli = rigiocato.days.flatMap(d => d.stops).filter(s => !s.tempoLibero).map(s => s.title);
        expect(titoli).toEqual(expect.arrayContaining(['Museo Civico', 'Trattoria Uno', 'Bar Sera', 'Trattoria Due']));
        expect(vera).toHaveBeenCalled();
    });

    it('un replay che prova a chiamare la rete fallisce: la richiesta che il tracciato non ha non esce mai', async () => {
        const vera = reteVera();
        const reg = creaRegistratore();
        vi.stubGlobal('fetch', async (url, init) => { const res = await vera(url, init); reg.annota(url, init, res.status, await res.clone().json()); return res; });
        await generaCatania();
        // al tracciato manca una ricerca di Google
        const tolta = Object.keys(reg.rete.places).find(k => k.startsWith('place/textsearch'));
        delete reg.rete.places[tolta];
        window.localStorage.clear();
        vera.mockClear();
        const { fetch, stato } = creaReteReplay({ rete: reg.rete });
        vi.stubGlobal('fetch', fetch);
        await generaCatania().catch(() => null);
        expect(stato.uscite.map(x => x.chiave)).toContain(tolta);
        expect(vera).not.toHaveBeenCalled();
        // e qualunque indirizzo fuori dai proxy lancia
        await expect(fetch('https://it.wikipedia.org/w/api.php?action=query')).rejects.toBeInstanceOf(ReteVietataError);
        await expect(fetch('https://replay.invalid/functions/v1/places-proxy?path=place%2Ftextsearch&query=altro')).rejects.toBeInstanceOf(ReteVietataError);
    });

    it('una richiesta fallita nel giro vero (timeout) si registra e nel replay fallisce allo stesso modo, senza uscire in rete', async () => {
        const reg = creaRegistratore();
        const u = 'https://x/functions/v1/places-proxy?path=place%2Ftextsearch&query=piazza+storica+Roma&location=41.9%2C12.4&radius=2670&language=it&engine=new';
        const timeout = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
        reg.annotaErrore(u, {}, timeout);
        const { fetch, stato } = creaReteReplay({ rete: reg.rete });
        await expect(fetch(u)).rejects.toMatchObject({ name: 'AbortError' });
        expect(stato.uscite).toEqual([]);
        expect(stato.fallimentiRigiocati).toHaveLength(1);
    });

    it('la chiave di una richiesta e quella della cache del proxy coincidono (motore nuovo e findplace)', () => {
        expect(chiavePlaces('https://x/functions/v1/places-proxy?path=place%2Ftextsearch&query=piazza+storica+Roma&location=41.9%2C12.4&radius=2000&language=it&engine=new'))
            .toBe(chiaveDaCache('v1:new2-1x08rj6:place/textsearch:language=it&location=41.9,12.4&query=piazza storica Roma&radius=2000'));
        expect(chiavePlaces('/__dev/places-proxy?path=place/findplacefromtext&input=Roma, Italia&inputtype=textquery&fields=name,geometry,types&language=it'))
            .toBe(chiaveDaCache('v1:place/findplacefromtext:fields=name,geometry,types&input=Roma, Italia&inputtype=textquery&language=it'));
    });
});

// ─── la tappa persa (solo registrazione) ──────────────────────────────────────
describe('C10c-replay — quale tappa si perde quando un momento ne prende una in piu\'', () => {
    const M = (id) => ({ id });
    const t = (nome, momento) => ({ candidate: { place_id: `p-${nome}`, name: nome }, moment: M(momento) });
    const sched = (...tappe) => ({ days: [tappe], tolte: [] });
    // prima: 2 in mattina, 1 al pomeriggio, la piazza alla passeggiata; poi la mattina ne prende 3 e la piazza scivola al pomeriggio
    const cur = { sched: sched(t('A', 'g1-mattina'), t('B', 'g1-mattina'), t('C', 'g1-pomeriggio'), t('Piazza', 'g1-passeggiata')), repaired: { report: {} } };
    const trialSched = sched(t('A', 'g1-mattina'), t('B', 'g1-mattina'), t('C', 'g1-mattina'), t('Piazza', 'g1-pomeriggio'));

    it('la passeggiata resta vuota perche\' i candidati ripetono una famiglia: la tappa persa, il suo momento, la regola', () => {
        const trial = { giri: [], repaired: { report: { facoltativiSenzaPosto: [{ momento: 'g1-passeggiata', label: 'Passeggiata', motivo: 'nessun candidato valido (all\'aperto, entro il tetto di cammino e sulla strada)',
            senzaPosto: { migliore: { nome: 'Piazza Due', minuti: 5, prove: ['famiglia gia\' presente nel giorno (piazza)'] }, candidati: 3, cammino: 0, famiglia: 3, deviazione: 0, marchio: 0 } }] } } };
        const p = tappaPersa({ trial, trialSched, cur, moment: M('g1-mattina') });
        expect(p).toMatchObject({ nome: 'Piazza', momento: 'g1-passeggiata', passataIn: 'g1-pomeriggio', regola: 'altro', prova: 'varietà' });
        expect(p.dettaglio).toContain('Piazza Due');
        // ed e' nel criterio del tentativo respinto
        const c = criterioRespinto({ trial: { ...trial, residui: [] }, trialSched, cur, moment: { id: 'g1-mattina', stops: 3 } });
        expect(c.persa).toMatchObject({ nome: 'Piazza', regola: 'altro' });
    });

    it('la deviazione oltre la soglia e\' cammino C5c; una tappa arrivata chiusa e\' orario', () => {
        const dev = { giri: [], repaired: { report: { facoltativiSenzaPosto: [{ momento: 'g1-passeggiata', motivo: 'x',
            senzaPosto: { migliore: { nome: 'Mercato', minuti: 16, prove: ['deviazione di 32 min (oltre 10)'] }, candidati: 4, cammino: 1, famiglia: 2, deviazione: 4, marchio: 0 } }] } } };
        expect(tappaPersa({ trial: dev, trialSched, cur, moment: M('g1-mattina') })).toMatchObject({ regola: 'cammino C5c', prova: 'deviazione C5c' });
        const chiusa = { giri: [[{ place_id: 'p-Piazza', momento: 'g1-passeggiata', nome: 'Piazza', perche: 'chiude alle 19:00' }]], repaired: { report: {} } };
        const senza = sched(t('A', 'g1-mattina'), t('B', 'g1-mattina'), t('C', 'g1-mattina'), t('D', 'g1-pomeriggio'));
        expect(tappaPersa({ trial: chiusa, trialSched: senza, cur, moment: M('g1-mattina') })).toMatchObject({ nome: 'Piazza', regola: 'orario' });
    });

    it('un momento che cambia solo posto (un altro ristorante a pranzo) non perde niente', () => {
        const prima = { sched: sched(t('A', 'g1-mattina'), t('Trattoria', 'g1-pranzo'), t('Piazza', 'g1-passeggiata')), repaired: { report: {} } };
        const dopo = sched(t('A', 'g1-mattina'), t('B', 'g1-mattina'), t('Osteria', 'g1-pranzo'));
        expect(tappaPersa({ trial: { giri: [], repaired: { report: {} } }, trialSched: dopo, cur: prima, moment: M('g1-mattina') }))
            .toMatchObject({ nome: 'Piazza', momento: 'g1-passeggiata' });
    });
});
