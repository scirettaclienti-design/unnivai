// TROINA-FIX — a Troina (borgo, 3 luoghi da visitare in lista: sotto la soglia del giro corto) nessun flusso della home esce
// vuoto se ci sono posti veri; un errore tecnico non diventa «non troviamo»; la guardia del banco fallisce se un flusso e' vuoto.
// Rossi su b096732 (il codice di prima), verdi qui. Lo scenario e' quello del 15/10 alle 12:06: la lista c'e', Google risponde
// con Monte Muganà e il belvedere, il selettore non sceglie niente.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCityKnowledge } from '../../services/cityKnowledgeService';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { buildPromptFromSelections, buildQuickPrefs } from '../../pages/QuickPath';
import { fasciaApertaBorgo, oreDiVisita } from '../../lib/cityKnowledge';
import { esitoVuoto } from '../../lib/esitoVuoto';
import { controllaGuardia } from '../../../scripts/banco/guardia-home.js';

const TECNICO = 'Non sono riuscito a completare il giro: un servizio non ha risposto. Riprova tra poco.';
const TR = { latitude: 37.7823936, longitude: 14.5949418, isSmallTown: true, radiusKm: 5 };
const ORE_1206 = new Date('2026-10-15T12:06:27+02:00');
const orari = (...fasce) => ({ periods: [0, 1, 2, 3, 4, 5, 6].flatMap(d => fasce.map(([da, a]) => ({ open: { day: d, time: da }, close: { day: d, time: a } }))) });

const g = (name, dLat, dLng, extra = {}) => ({
    place_id: `pid-${name.replace(/\W+/g, '-').toLowerCase()}`, name, formatted_address: `${name}, 94018 Troina EN, Italia`,
    geometry: { location: { lat: TR.latitude + dLat, lng: TR.longitude + dLng } }, business_status: 'OPERATIONAL', utc_offset_minutes: 120,
    types: ['tourist_attraction', 'point_of_interest'], rating: 4.6, user_ratings_total: 60, ...extra,
});
const lista = (p, tipo, momento, extra = {}) => ({ ...p, _citta: { tipo, momento, ...extra } });
// la lista c10b-7 di Troina del 15/10, con gli orari veri: 3 luoghi da visitare per la soglia (San Silvestro ha i soli tipi generici)
const LISTA_TROINA = [
    lista(g('Chiesa Madre', 0.003, 0.006, { primary_type: 'church', types: ['church', 'place_of_worship'], opening_hours: orari(['1030', '1230'], ['1700', '2000']) }), 'essenziale', 'mattina', { simbolo: true, categoria: 'chiesa' }),
    lista(g('Chiesa di San Silvestro', 0.001, 0.006, { types: ['point_of_interest', 'establishment'] }), 'essenziale', 'mattina', { categoria: 'chiesa' }),
    lista(g('Torre Capitania', 0.002, 0.0042, { primary_type: 'museum', types: ['museum', 'tourist_attraction'], opening_hours: orari(['1000', '1230'], ['1630', '1900']) }), 'essenziale', 'pomeriggio', { categoria: 'monumento' }),
    lista(g('Convento di Sant\'Agostino', 0.0048, 0.0063, { primary_type: 'place_of_worship', types: ['place_of_worship'] }), 'essenziale', 'pomeriggio', { categoria: 'chiesa' }),
    lista(g('Piazza Conte Ruggero', 0.0028, 0.0058, { types: ['route'] }), 'da locale', 'aperitivo', { categoria: 'piazza' }),
    lista(g('La Contea dei Normanni', 0.0044, -0.0034, { primary_type: 'restaurant', types: ['restaurant', 'food'], opening_hours: orari(['1100', '1500'], ['1800', '2300']) }), 'da locale', 'cena', { categoria: 'ristorante' }),
    lista(g('Via Conte Ruggero', 0.0017, 0.0035, { types: ['route'] }), 'da locale', 'dopocena', { categoria: 'via', passeggiata: true }),
];
// quello che Google ha risposto alle ricerche: natura e panorami veri, e i ristoranti del pranzo
const MUGANA = g('Monte Muganà', 0.0135, 0.0015, { primary_type: 'scenic_spot', types: ['scenic_spot', 'tourist_attraction', 'point_of_interest'], rating: 4.8, user_ratings_total: 45 });
const BELVEDERE = g('Belvedere di Piazza Conte Ruggero', 0.0029, 0.0059, { types: ['tourist_attraction', 'point_of_interest'], rating: 4.7, user_ratings_total: 30 });
const PESCHERIA = g('A\'Pescheria', 0.0021, 0.0012, { primary_type: 'restaurant', types: ['restaurant', 'food'], opening_hours: orari(['1200', '1500'], ['1900', '2300']), rating: 4.6, user_ratings_total: 200 });
const RICERCA = [MUGANA, BELVEDERE, PESCHERIA];

const traduttore = { choices: [{ message: { content: JSON.stringify({ queries: ['villa comunale parco', 'orto botanico', 'giardino pubblico'], categoria: 'natura', oggetto_umano: 'parchi e giardini', citta: null, vincoli: { tempo: null, escludi: [], note: null } }) } }] };
const selettoreVuoto = { choices: [{ message: { content: JSON.stringify({ stops: [] }) } }] };

/** Il fetch del 15/10: Google risponde, il selettore non sceglie niente; `opzioni` cambia i pezzi per i casi di errore. */
const fetchTroina = ({ textsearch = () => ({ status: 'OK', results: RICERCA }), selettore = () => selettoreVuoto, homeTours = null } = {}) => vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes('openai-proxy')) {
        const body = JSON.parse(String(init?.body || '{}'));
        const sys = String(body.messages?.[0]?.content || '');
        const user = String(body.messages?.[1]?.content || '');
        if (sys.includes('traduttore di intenti')) return { ok: true, json: async () => traduttore };
        if (body.dv?.passaggio === 'selettore' || user.startsWith('Scegli le tappe')) {
            const r = selettore();
            if (r instanceof Error) throw r;
            return { ok: true, json: async () => r };
        }
        if (homeTours && user.startsWith('Costruisci i tour')) return { ok: true, json: async () => homeTours };
        return { ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) };
    }
    if (u.includes('textsearch')) {
        const r = textsearch(u);
        if (r instanceof Error) throw r;
        return { ok: true, json: async () => r };
    }
    return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [], candidates: [] }) };
});

const vere = (r) => (r.days || []).flatMap(d => d.stops || []).filter(s => !s.tempoLibero);
const quizNatura = () => aiRecommendationService.generateItinerary('Troina',
    buildQuickPrefs({ main: 'natura', mainTitle: 'Natura', subTitle: 'Parchi e Verde', durationTitle: 'Medio', groupTitle: 'Solo' }),
    buildPromptFromSelections({ main: 'natura', sub: 'parco', duration: 'medio', group: 'solo', city: 'Troina' }),
    {}, '', TR, { pathType: 'quick', skipUserQuota: true });

describe('TROINA-FIX — a Troina a mezzogiorno nessun flusso esce vuoto', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(ORE_1206);
    });
    afterEach(() => {
        vi.unstubAllGlobals(); vi.useRealTimers();
        vi.mocked(fetchCityKnowledge).mockReset(); vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'spenta', verificati: [] });
    });

    it('borgo con 3 luoghi da visitare e natura nei dintorni: il Quiz Natura delle 12:06 non è vuoto e ha un posto di natura', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'borgo', verificati: LISTA_TROINA });
        vi.stubGlobal('fetch', fetchTroina());
        const r = await quizNatura();
        const titoli = vere(r).map(s => s.title);
        expect(r._citta.mezzaGiornata).toMatchObject({ utilizzabili: 3 });
        expect(titoli.length).toBeGreaterThan(0);
        expect(titoli.some(t => /Muganà|Belvedere/.test(t))).toBe(true);
        // BORGO-FIX — decisione 1: la natura delle ricerche entra nel conto della mezza giornata (3 luoghi + Monte Muganà = 4):
        // niente giro corto, niente riga «si gira in mezza giornata»
        expect(r._citta.mezzaGiornata.naturaContate).toEqual(expect.arrayContaining([expect.stringMatching(/Muganà|Belvedere/)]));
        expect(r._citta.mezzaGiornata.riga).toBeNull();
        expect(r.days[0].scalaNote).toBeUndefined();
    });

    it('Per Te in un borgo sotto soglia, con i temi tutti sotto le 3 tappe aperte: almeno un tour con posti veri', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'borgo', verificati: LISTA_TROINA });
        const homeTours = { choices: [{ message: { content: JSON.stringify({ tours: [
            { themeType: 'romance', title: 'Panorami', stops: [{ place_id: MUGANA.place_id }, { place_id: BELVEDERE.place_id }] },
        ] }) } }] };
        vi.stubGlobal('fetch', fetchTroina({ homeTours }));
        const { buildPOIFromCandidate } = await import('../../services/placesDiscoveryService');
        const poi = (p) => buildPOIFromCandidate(p, 'Troina');
        const r = await aiRecommendationService.generateHomeTours({
            city: 'Troina', cityCenter: TR,
            themedCandidates: { insider: [], romance: [poi(MUGANA), poi(BELVEDERE)], food: [], cultura: [], nature: [] },
            prefs: { duration: '1 Giorno', group: 'solo', pace: 'rilassato' }, aiProfile: '',
            opts: { dnaWeights: { _share: 0 }, skipUserQuota: true },
        });
        expect(r.tours.length).toBeGreaterThan(0);
        expect(r.tours.some(t => t.stops.some(s => !s.tempoLibero && s.place_id))).toBe(true);
    });

    it('un errore di rete → mai «non troviamo»: il selettore che non risponde è il guasto del motore, la ricerca che non si fa è il messaggio tecnico', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'borgo', verificati: LISTA_TROINA });
        // il proxy dell'AI non risponde: il motore lo dice col suo testo (Gate P8b), la pagina non arriva a «non troviamo»
        vi.stubGlobal('fetch', fetchTroina({ selettore: () => new TypeError('Failed to fetch') }));
        await expect(quizNatura()).rejects.toMatchObject({ code: 'AI_ENGINE_DOWN' });
        // Google non risponde (rete): giro vuoto, ma non uno zero vero → il messaggio tecnico col tasto «Riprova»
        vi.stubGlobal('fetch', fetchTroina({ textsearch: () => new TypeError('Failed to fetch') }));
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        const r2 = await quizNatura();
        expect(vere(r2)).toEqual([]);
        expect(r2._zeroVero).not.toBe(true);
        expect(esitoVuoto(r2, 'Troina')).toMatchObject({ tipo: 'tecnico', testo: TECNICO, riprova: true });
    });

    it('uno zero vero (Google risponde zero e la lista c\'è) → «A Troina non troviamo parchi e giardini. Cambia richiesta e riprovo.»', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'borgo', verificati: [] });
        vi.stubGlobal('fetch', fetchTroina({ textsearch: () => ({ status: 'ZERO_RESULTS', results: [] }) }));
        const r = await quizNatura();
        expect(vere(r)).toEqual([]);
        expect(r._zeroVero).toBe(true);
        expect(esitoVuoto(r, 'Troina').testo).toBe('A Troina non troviamo parchi e giardini. Cambia richiesta e riprovo.');
    });
});

describe('TROINA-FIX — la fascia del giro corto sta nelle ore di visita', () => {
    it('alle 12:06 la fascia non è tutta pranzo: comincia quando c\'è il tempo di una visita', () => {
        const finestra = { start: ORE_1206, end: new Date('2026-10-15T16:06:27+02:00') };
        const candidati = [{ place_id: 'm', name: 'Monte', types: ['natural_feature'] }];
        const prima = fasciaApertaBorgo({ candidati, lista: [], finestra });
        const dopo = fasciaApertaBorgo({ candidati, lista: [], finestra, visite: oreDiVisita(ORE_1206) });
        expect(prima.start.getTime()).toBe(ORE_1206.getTime());
        const pomeriggio = new Date('2026-10-15T14:30:00+02:00').getTime();
        // almeno 45 minuti di visita (mattina o pomeriggio) dentro la fascia
        expect(dopo.end.getTime() - Math.max(dopo.start.getTime(), pomeriggio)).toBeGreaterThanOrEqual(45 * 60000);
        expect(dopo.minuti).toBeLessThanOrEqual(180);
    });
});

describe('TROINA-FIX — la guardia del banco fallisce se un flusso esce vuoto', () => {
    const pieno = (id) => ({ id, modo: 'veloce', luogo: 'Troina', tours: [{ stops: [{ place_id: 'p1', title: 'Monte Muganà' }] }] });
    it('tutti i flussi con posti veri → passa; uno vuoto → fallisce e dice quale', () => {
        expect(controllaGuardia({ casi: [pieno('a'), pieno('b')] }).ok).toBe(true);
        const vuoto = { id: 'home-troina-quiz-natura', modo: 'veloce', luogo: 'Troina', source: 'no-results-error', tours: [{ stops: [{ tempoLibero: true, title: 'Tempo libero' }] }] };
        const esito = controllaGuardia({ casi: [pieno('a'), vuoto] });
        expect(esito.ok).toBe(false);
        expect(esito.righe.find(r => r.id === 'home-troina-quiz-natura')).toMatchObject({ ok: false, tappe: 0 });
    });
    it('un caso atteso che manca, un errore o un\'uscita in rete del replay → fallisce', () => {
        expect(controllaGuardia({ casi: [pieno('a')] }, { attesi: ['a', 'home-troina-perte'] }).ok).toBe(false);
        expect(controllaGuardia({ casi: [{ ...pieno('a'), errore: 'timeout' }] }).ok).toBe(false);
        expect(controllaGuardia({ casi: [{ ...pieno('a'), replay: { uscite: [{ tipo: 'places', chiave: 'x' }] } }] }).ok).toBe(false);
    });
});
