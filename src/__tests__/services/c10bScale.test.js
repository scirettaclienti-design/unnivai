// C10b — tre scale di luogo (decisione di Ivano): borgo, città, metropoli. L'AI le propone, il motore le conferma col
// diametro della lista; in una metropoli la giornata sta in un quartiere camminabile; un borgo con meno di 4 posti
// verificati si gira in mezza giornata; mai un posto fuori comune; il simbolo è sempre fra le ancore.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    verificaPosto, leggiLista, promptScala, leggiAbitanti, scalaDaAbitanti, promptCitta, queryVerifica, raggioVerificaKm, provinciaDa, nelComune,
    POSTI_PER_SCALA, RAGGIO_BORGO_KM, CITY_LIST_VERSION,
} from '../../../supabase/functions/openai-proxy/cityKnowledge.ts';
import { scalaConfermata, scegliQuartiere, diametroLista, poolConLista, SOGLIA_METROPOLI_KM, rigaBorgo, kmTra } from '../../lib/cityKnowledge';
import { selectScoredCandidatePool } from '../../services/candidateScoring';
import { fetchCityKnowledge } from '../../services/cityKnowledgeService';
import { aiRecommendationService } from '../../services/aiRecommendationService';

// ─── la lista e la verifica (il modulo del proxy) ────────────────────────────
const TROINA = { lat: 37.7823936, lng: 14.5949418 };
const gTroina = (name, dLat, dLng, indirizzo, extra = {}) => ({
    place_id: `pid-${name.replace(/\W+/g, '-').toLowerCase()}-${dLat}`, name, formatted_address: indirizzo,
    geometry: { location: { lat: TROINA.lat + dLat, lng: TROINA.lng + dLng } }, business_status: 'OPERATIONAL',
    types: ['bar', 'point_of_interest'], rating: 4.4, user_ratings_total: 60, ...extra,
});

describe('C10b — borgo: «nome, comune, provincia», raggio del comune, mai fuori comune', () => {
    it('un nome generico trovato fuori comune non entra (anche dentro il raggio)', () => {
        // «Bar Centrale» esiste in ogni paese: Google lo trova a 3 km, ma l'indirizzo e' di un altro comune
        const altroComune = gTroina('Bar Centrale', 0.02, 0.018, 'Via Roma, 1, 94010 Cerami EN, Italia');
        const v = verificaPosto({ nome: 'Bar Centrale', citta: 'Troina' }, [altroComune], TROINA, RAGGIO_BORGO_KM, { comune: 'Troina' });
        expect(v.ok).toBe(false);
        expect(v.motivo).toMatch(/^fuori comune/);
        // lo stesso nome con l'indirizzo nel comune entra
        const vero = gTroina('Bar Centrale', 0.001, 0.001, 'Via Conte Ruggero, 3, 94018 Troina EN, Italia');
        expect(verificaPosto({ nome: 'Bar Centrale', citta: 'Troina' }, [altroComune, vero], TROINA, RAGGIO_BORGO_KM, { comune: 'Troina' }).ok).toBe(true);
    });
    it('oltre il raggio del comune (5 km) non entra, con il motivo', () => {
        const lontano = gTroina('Ristorante La Fenice', 0.3, 0, 'Via Etnea, 2, 95100 Catania CT, Italia');
        expect(verificaPosto({ nome: 'Ristorante La Fenice', citta: 'Troina' }, [lontano], TROINA, RAGGIO_BORGO_KM, { comune: 'Troina' }).motivo).toMatch(/^fuori comune \(33\.\d km, raggio 5\)/);
    });
    it('la ricerca della verifica: «nome, comune, provincia» per un borgo, «nome, città» altrimenti; il raggio dichiarato', () => {
        expect(provinciaDa('94018 Troina EN, Italia')).toBe('EN');
        expect(queryVerifica({ nome: 'Chiesa Madre' }, 'Troina', 'borgo', 'EN')).toBe('Chiesa Madre, Troina, EN');
        expect(queryVerifica({ nome: 'Castello Ursino' }, 'Catania', 'città', 'CT')).toBe('Castello Ursino, Catania');
        expect(raggioVerificaKm('Troina', 'borgo')).toBe(5);
        expect(raggioVerificaKm('Roma', 'metropoli')).toBe(20);
        expect(nelComune('Via S. Nicolò Scalfonio, 94018 Troina EN, Italia', 'Troina')).toBe(true);
        expect(nelComune('Via Roma, 1, 94010 Cerami EN, Italia', 'Troina')).toBe(false);
    });
});

describe('C10b — la lista per scala, il quartiere, il simbolo', () => {
    const posti = (n, extra = (i) => ({})) => Array.from({ length: n }, (_, i) => ({ nome: `Posto ${i}`, momento: 'pomeriggio', tipo: 'da locale', ...extra(i) }));
    it('la scala proposta: l\'AI dice gli abitanti, il codice applica la regola; un borgo al massimo 8 posti, una metropoli fino a 20, col quartiere', () => {
        expect(promptScala('Troina').system).toMatch(/"abitanti"/);
        expect(leggiAbitanti('{"abitanti": 9800}')).toBe(9800);
        expect(leggiAbitanti('{"abitanti": "2.873.000"}')).toBe(2873000);
        expect(leggiAbitanti('non json')).toBeNull();
        expect(scalaDaAbitanti(6000)).toBe('borgo');
        expect(scalaDaAbitanti(311584)).toBe('città');
        expect(scalaDaAbitanti(670000)).toBe('città');
        expect(scalaDaAbitanti(960000)).toBe('metropoli');
        expect(scalaDaAbitanti(null)).toBe('città');
        expect(leggiLista(JSON.stringify({ posti: posti(20) }), 'Troina', 'borgo').length).toBe(POSTI_PER_SCALA.borgo);
        const m = leggiLista(JSON.stringify({ posti: posti(25, (i) => ({ quartiere: i % 2 ? 'Trastevere' : 'Monti' })) }), 'Roma', 'metropoli');
        expect(m.length).toBe(20);
        expect(m[0].quartiere).toBe('Monti');
        // in una città il quartiere non c'e'
        expect(leggiLista(JSON.stringify({ posti: posti(3, () => ({ quartiere: 'X' })) }), 'Catania', 'città')[0].quartiere).toBeUndefined();
    });
    it('il simbolo: uno per lista, sempre un essenziale; in una metropoli uno per quartiere; senza, il primo essenziale (dedotto)', () => {
        const l = leggiLista(JSON.stringify({ posti: [
            { nome: 'Bar Simbolo', momento: 'colazione', tipo: 'da locale', simbolo: true },
            { nome: 'Castello', momento: 'mattina', tipo: 'essenziale' },
            { nome: 'Cattedrale', momento: 'mattina', tipo: 'essenziale', simbolo: true },
            { nome: 'Teatro', momento: 'pomeriggio', tipo: 'essenziale', simbolo: true },
        ] }), 'Catania', 'città');
        expect(l.filter(p => p.simbolo).map(p => p.nome)).toEqual(['Cattedrale']);
        const m = leggiLista(JSON.stringify({ posti: [
            { nome: 'Colosseo', momento: 'mattina', tipo: 'essenziale', quartiere: 'Monti', simbolo: true },
            { nome: 'Santa Maria in Trastevere', momento: 'pomeriggio', tipo: 'essenziale', quartiere: 'Trastevere' },
        ] }), 'Roma', 'metropoli');
        expect(m.map(p => [p.nome, !!p.simbolo, !!p.simboloDedotto])).toEqual([['Colosseo', true, false], ['Santa Maria in Trastevere', true, true]]);
    });
    it('il prompt è scritto per la scala: quartiere solo in metropoli, 8 posti nel borgo, il simbolo (un luogo); nessun nome di città oltre a quella chiesta', () => {
        expect(CITY_LIST_VERSION).toBe('c10b-5');
        const citta = promptCitta('Lecce', '2026-10-15').system;
        const metro = promptCitta('Lecce', '2026-10-15', 'metropoli').system;
        const borgo = promptCitta('Lecce', '2026-10-15', 'borgo').system;
        expect(citta).not.toMatch(/quartiere/);
        expect(metro).toMatch(/"quartiere": per ogni posto, il quartiere camminabile/);
        expect(metro).toMatch(/uno per quartiere/);
        expect(borgo).toMatch(/al massimo 8 posti, tutti dentro il comune/);
        for (const sys of [citta, metro, borgo]) {
            expect(sys).toMatch(/il posto che un abitante non ti perdonerebbe mai di aver saltato|l'essenziale che un abitante non ti perdonerebbe mai di aver saltato/);
            expect(sys).toMatch(/Il simbolo è un luogo da visitare/);
            for (const altra of ['Roma', 'Napoli', 'Catania', 'Palermo', 'Milano', 'Troina', 'Trastevere']) expect(sys).not.toContain(altra);
        }
    });
});

// ─── la conferma della scala (il motore) ─────────────────────────────────────
const p = (name, lat, lng, tipo = 'essenziale', extra = {}) => ({
    place_id: `pid-${name.replace(/\W+/g, '-').toLowerCase()}`, name, title: name, latitude: lat, longitude: lng, lat, lng,
    types: ['tourist_attraction'], rating: 4.6, user_ratings_total: 900, _citta: { tipo, momento: 'mattina', ...extra },
});

describe('C10b — la scala confermata dal motore (diametro degli essenziali verificati)', () => {
    // le coordinate vere degli essenziali verificati il 15/10 (city_knowledge, c10-2)
    const ROMA = [p('Colosseo', 41.8902102, 12.4922309), p('Piazza Navona', 41.8991633, 12.4730742), p('Musei Vaticani', 41.9064878, 12.4536413), p('Foro Romano', 41.8920906, 12.4864378)];
    const CATANIA = [p('Piazza del Duomo', 37.5022684, 15.0874745), p('Castello Ursino', 37.4991663, 15.0844932), p('Teatro Massimo Bellini', 37.504245, 15.0900442), p('Via Etnea', 37.503894, 15.0871153)];
    const NAPOLI = [p('Duomo', 40.8525429, 14.2593205), p('MANN', 40.8535985, 14.2505254), p("Castel dell'Ovo", 40.8283157, 14.2476044), p('Plebiscito', 40.8358256, 14.2485831)];
    const TROINA_L = [p('Chiesa San Nicolò', 37.7859629, 14.6028675), p('Chiesa Madre', 37.7854245, 14.6008864, 'da locale'), p('Il Chiosco', 37.7842124, 14.5950942, 'da locale'), p('Ruderi San Michele', 37.7734834, 14.6072174, 'da locale')];
    it('Roma e Napoli metropoli (oltre 2 km), Catania città, Troina borgo; una metropoli piccola resta città', () => {
        expect(SOGLIA_METROPOLI_KM).toBe(2);
        expect(scalaConfermata({ proposta: 'metropoli', poi: ROMA })).toMatchObject({ scala: 'metropoli' });
        expect(diametroLista(ROMA).km).toBeGreaterThan(3.5);
        expect(scalaConfermata({ proposta: 'metropoli', poi: NAPOLI }).scala).toBe('metropoli');
        expect(scalaConfermata({ proposta: 'città', poi: CATANIA }).scala).toBe('città');
        expect(scalaConfermata({ proposta: 'metropoli', poi: CATANIA }).scala).toBe('città');
        expect(scalaConfermata({ proposta: 'borgo', poi: TROINA_L })).toMatchObject({ scala: 'borgo', su: 'tutti i verificati' });
        expect(scalaConfermata({ proposta: null, poi: ROMA }).scala).toBe('città');
    });
    it('il quartiere: quello nominato nella richiesta; altrimenti quello con più ancore aperte, vicino alla partenza', () => {
        const poi = [
            p('Colosseo', 41.8902, 12.4922, 'essenziale', { quartiere: 'Monti' }), p('Foro Romano', 41.8921, 12.4864, 'essenziale', { quartiere: 'Monti' }),
            p('Santa Maria in Trastevere', 41.8895, 12.4699, 'essenziale', { quartiere: 'Trastevere' }), p('Bar San Calisto', 41.8890, 12.4696, 'da locale', { quartiere: 'Trastevere' }),
        ];
        expect(scegliQuartiere({ poi, testo: 'Domani una giornata a Trastevere' }).quartiere.nome).toBe('Trastevere');
        const s = scegliQuartiere({ poi, testo: 'Domani una giornata a Roma', partenza: { latitude: 41.8967, longitude: 12.4822 } });
        expect(s.quartiere.nome).toBe('Monti');
        expect(s.motivo).toMatch(/piu' ancore aperte/);
    });
    it('il simbolo è la prima ancora', () => {
        const ess = [p('Teatro', 37.504, 15.09), p('Cattedrale', 37.502, 15.087, 'essenziale', { simbolo: true })];
        const r = poolConLista(ess, { seleziona: (a) => selectScoredCandidatePool(a, { city: 'Catania', limit: 20 }), tourWindow: null });
        expect(r.ancore[0].name).toBe('Cattedrale');
    });
});

// ─── il motore intero ────────────────────────────────────────────────────────
const ROMA_C = { latitude: 41.8967068, longitude: 12.4822025, isSmallTown: false, radiusKm: 10 };
const g = (name, lat, lng, extra = {}) => ({
    place_id: `pid-${name.replace(/\W+/g, '-').toLowerCase()}`, name, formatted_address: `${name}, Roma RM, Italia`,
    geometry: { location: { lat, lng } }, business_status: 'OPERATIONAL',
    types: ['tourist_attraction', 'point_of_interest'], rating: 4.6, user_ratings_total: 300, ...extra,
});
// due quartieri a 2,4 km l'uno dall'altro (Centro e Trastevere), piu' un gruppo lontano a nord
const Q = {
    centro: { lat: 41.8967, lng: 12.4822 }, trastevere: { lat: 41.8889, lng: 12.4695 }, nord: { lat: 41.925, lng: 12.49 },
};
const gruppo = (k, { lat, lng }) => [
    ...['Piazza', 'Fontana', 'Porta', 'Palazzo'].map((n, i) => g(`${n} ${k}`, lat + 0.0012 * (i + 1), lng + 0.0008 * (i % 2 ? 1 : -1), { primary_type: 'tourist_attraction' })),
    ...[0, 1, 2].map(i => g(`Trattoria ${k} ${i}`, lat - 0.0010 * (i + 1), lng + 0.0006, { primary_type: 'italian_restaurant', types: ['italian_restaurant', 'restaurant', 'food'] })),
    g(`Bar ${k}`, lat + 0.0005, lng - 0.0012, { primary_type: 'cocktail_bar', types: ['cocktail_bar', 'bar'] }),
];
const RICERCA = Object.entries(Q).flatMap(([k, c]) => gruppo(k, c));
const LISTA_ROMA = [
    { ...g('Pantheon', 41.8986, 12.4769, { primary_type: 'church', types: ['church', 'tourist_attraction'] }), _citta: { tipo: 'essenziale', momento: 'mattina', quartiere: 'Centro', simbolo: true } },
    { ...g('Galleria Doria Pamphilj', 41.8978, 12.4813, { primary_type: 'museum', types: ['museum', 'tourist_attraction'] }), _citta: { tipo: 'essenziale', momento: 'pomeriggio', quartiere: 'Centro' } },
    { ...g('Santa Maria in Trastevere', 41.8895, 12.4699, { primary_type: 'church', types: ['church', 'tourist_attraction'] }), _citta: { tipo: 'essenziale', momento: 'mattina', quartiere: 'Trastevere', simbolo: true } },
    { ...g('Villa Farnesina', 41.8936, 12.4672, { primary_type: 'museum', types: ['museum', 'tourist_attraction'] }), _citta: { tipo: 'essenziale', momento: 'pomeriggio', quartiere: 'Trastevere' } },
    // un terzo quartiere a nord: gli essenziali della lista stanno in piu' di 2 km (metropoli confermata)
    { ...g('Villa Nord', 41.925, 12.49, { primary_type: 'park', types: ['park', 'tourist_attraction'] }), _citta: { tipo: 'essenziale', momento: 'pomeriggio', quartiere: 'Nord' } },
];

const routeFetch = () => vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes('openai-proxy')) {
        const body = JSON.parse(String(init?.body || '{}'));
        const sys = String(body.messages?.[0]?.content || '');
        if (sys.includes('traduttore di intenti')) return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ queries: ['piazza storica', 'trattoria tipica'], categoria: 'misto', oggetto_umano: 'un giro', citta: null, vincoli: { tempo: null, escludi: [], note: null } }) } }] }) };
        // il selettore sceglie posti lontani dal quartiere: il codice li deve scartare
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ stops: [{ place_id: 'pid-piazza-nord', moment: 'g1-mattina' }, { place_id: 'pid-trattoria-nord-0', moment: 'g1-pranzo' }] }) } }] }) };
    }
    if (u.includes('textsearch')) {
        const q = new URL(u, 'http://x').searchParams.get('query') || '';
        const res = /trattoria|ristorante|osteria/.test(q) ? RICERCA.filter(c => /Trattoria/.test(c.name))
            : /bar|cocktail|vino/.test(q) ? RICERCA.filter(c => /^Bar/.test(c.name))
            : RICERCA.filter(c => !/Trattoria|^Bar/.test(c.name));
        return { ok: true, json: async () => ({ status: 'OK', results: res }) };
    }
    return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', result: {}, candidates: [] }) };
});

describe('C10b — il motore: metropoli in un quartiere, borgo in mezza giornata', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-14T22:19:00+02:00'));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.mocked(fetchCityKnowledge).mockReset(); vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'spenta', verificati: [] }); });

    const tappe = (r) => r.days.flatMap(d => d.stops).filter(s => !s.tempoLibero);
    const genera = (testo) => aiRecommendationService.generateItinerary('Roma', { duration: '1 Giorno' }, testo, {}, '', ROMA_C, { pathType: 'custom', skipUserQuota: true });

    it('Roma in giornata intera sta in un quartiere (o due vicini): nessuna tappa oltre il raggio del quartiere', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'metropoli', verificati: LISTA_ROMA });
        vi.stubGlobal('fetch', routeFetch());
        const r = await genera('Domani una giornata a Roma');
        const q = r._citta.quartiere;
        expect(r._citta.scala.scala).toBe('metropoli');
        expect(q.nome).toBe('Centro');
        expect(tappe(r).length).toBeGreaterThanOrEqual(4);
        for (const s of tappe(r)) expect(kmTra(q.centro, s)).toBeLessThanOrEqual(q.raggioKm + 1e-6);
        expect(tappe(r).map(s => s.title)).not.toContain('Piazza nord');
    });

    it('«Trastevere» nella richiesta → la giornata a Trastevere', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'metropoli', verificati: LISTA_ROMA });
        vi.stubGlobal('fetch', routeFetch());
        const r = await genera('Domani una giornata a Trastevere');
        expect(r.destination?.city ?? 'Roma').toBe('Roma');
        expect(r._citta.quartiere).toMatchObject({ nome: 'Trastevere', motivo: 'nominato nella richiesta' });
        const t = tappe(r);
        expect(t.map(s => s.title)).toContain('Santa Maria in Trastevere');
        for (const s of t) expect(kmTra(r._citta.quartiere.centro, s)).toBeLessThanOrEqual(r._citta.quartiere.raggioKm + 1e-6);
    });

    it('un borgo con meno di 4 posti verificati: mezza giornata, con la riga «Troina si gira in mezza giornata.»', async () => {
        const T = { latitude: 37.7823936, longitude: 14.5949418, isSmallTown: true, radiusKm: 5 };
        const vicino = (name, dLat, dLng, extra) => g(name, T.latitude + dLat, T.longitude + dLng, { formatted_address: `${name}, 94018 Troina EN, Italia`, user_ratings_total: 40, ...extra });
        const lista = [
            { ...vicino('Chiesa San Nicolò', 0.0036, 0.0079, { primary_type: 'church', types: ['church'] }), _citta: { tipo: 'essenziale', momento: 'mattina', simbolo: true } },
            { ...vicino('Chiesa Madre', 0.003, 0.006, { primary_type: 'church', types: ['church'] }), _citta: { tipo: 'da locale', momento: 'mattina' } },
            { ...vicino('Il Chiosco', 0.0018, 0.0002, { primary_type: 'bar', types: ['bar'] }), _citta: { tipo: 'da locale', momento: 'aperitivo' } },
        ];
        const borgo = [...gruppo('troina', { lat: T.latitude, lng: T.longitude })];
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'borgo', verificati: lista });
        vi.stubGlobal('fetch', vi.fn(async (url, init) => {
            const u = String(url);
            if (u.includes('openai-proxy')) {
                const sys = String(JSON.parse(String(init?.body || '{}')).messages?.[0]?.content || '');
                if (sys.includes('traduttore di intenti')) return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ queries: ['piazza storica', 'trattoria tipica'], categoria: 'misto', oggetto_umano: 'un giro', citta: null, vincoli: { tempo: null, escludi: [], note: null } }) } }] }) };
                return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ stops: [{ place_id: 'pid-piazza-troina', moment: 'g1-mattina' }] }) } }] }) };
            }
            if (u.includes('textsearch')) {
                const q = new URL(u, 'http://x').searchParams.get('query') || '';
                const res = /trattoria|ristorante/.test(q) ? borgo.filter(c => /Trattoria/.test(c.name)) : /bar|cocktail/.test(q) ? borgo.filter(c => /^Bar/.test(c.name)) : borgo.filter(c => !/Trattoria|^Bar/.test(c.name));
                return { ok: true, json: async () => ({ status: 'OK', results: res }) };
            }
            return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', candidates: [] }) };
        }));
        const r = await aiRecommendationService.generateItinerary('Troina', { duration: '1 Giorno' }, 'Domani una giornata a Troina', {}, '', T, { pathType: 'custom', skipUserQuota: true });
        const w = r.tourWindow.windows[0];
        // C10b2 — la durata segue le tappe del borgo (45 min per luogo da visitare, 2–4 luoghi), non la mezza giornata fissa
        expect((w.end.getTime() - w.start.getTime()) / 60000).toBeLessThanOrEqual(240);
        expect(r.days[0].scalaNote).toBe(rigaBorgo('Troina'));
        expect(r.days[0].scalaNote).toBe('Troina si gira in mezza giornata.');
        expect(r._citta.mezzaGiornata).toMatchObject({ verificati: 3, minimo: 4 });
    });
});
