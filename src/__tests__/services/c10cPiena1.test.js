// C10c-piena-1 — i posti della lista che si perdevano per difetti (decisioni di Ivano):
//   · ORARI all'arrivo: un posto che apre alle 10:00 entra in una mattina che inizia alle 09:30 se ci si arriva dopo le 10:00;
//     nessuna visita del tour finale cade fuori orario;
//   · un quartiere chiesto che non e' nella lista e' riconosciuto (Google) e ha almeno meta' delle tappe;
//   · una piazza storica della lista non la toglie la regola delle zone;
//   · il simbolo dichiarato dall'AI vince su quello dedotto dal codice;
//   · un borgo con 5 posti, di cui un ristorante, applica «la durata segue le tappe»;
//   · il tracciato dice perche' un riempimento e' stato respinto.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyOpeningToBuckets, scheduleMomentPlan, closedInSchedule, criterioRespinto } from '../../services/momentSelection';
import { poolConLista, spostaAncoreVietate, quartiereFuoriLista, dentroNucleo, luogoDaVisitareBorgo } from '../../lib/cityKnowledge';
import { openStatus } from '../../lib/openingHours';
import { fetchCityKnowledge, fetchQuartiereKnowledge } from '../../services/cityKnowledgeService';
import { aiRecommendationService } from '../../services/aiRecommendationService';

const romaOra = (hh, mm) => new Date(`2026-10-15T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+02:00`);
const orari = (da, a) => ({ periods: [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: da }, close: { day: d, time: a } })) });
const periodi = (da, a) => orari(da, a).periods;

// ─── ORARI all'arrivo ─────────────────────────────────────────────────────────
describe('C10c — orari controllati all\'arrivo', () => {
    const mattina = { id: 'g1-mattina', key: 'mattina', label: 'Mattina', dayIndex: 0, start: romaOra(9, 30), end: romaOra(12, 30), stops: 2,
        categories: ['cultura', 'monumenti', 'musei', 'passeggiata'] };
    const museoDieci = { place_id: 'p-museo', name: 'Museo delle Dieci', types: ['museum'], primaryType: 'museum',
        openingPeriods: periodi('1000', '1800'), utcOffsetMinutes: 120, latitude: 37.5030, longitude: 15.0870 };
    const chiesa = { place_id: 'p-chiesa', name: 'Chiesa Aperta', types: ['church'], primaryType: 'church',
        openingPeriods: periodi('0700', '2000'), utcOffsetMinutes: 120, latitude: 37.5027, longitude: 15.0873 };

    it('un posto che apre alle 10:00 resta nella mattina che inizia alle 09:30 (ci si arriva dopo le 10:00)', () => {
        const { buckets, report } = applyOpeningToBuckets([mattina], new Map([['g1-mattina', [museoDieci, chiesa]]]));
        expect(buckets.get('g1-mattina').map(c => c.place_id)).toContain('p-museo');
        expect(report.chiusi.map(x => x.place_id)).not.toContain('p-museo');
        // la messa in orario: prima la chiesa (aperta), poi il museo quando ha aperto
        const sched = scheduleMomentPlan([{ moment: mattina, stops: [{ candidate: museoDieci }, { candidate: chiesa }] }], [romaOra(9, 30)]);
        const museo = sched.days[0].find(s => s.candidate.place_id === 'p-museo');
        expect(museo).toBeTruthy();
        expect(museo.start.getTime()).toBeGreaterThanOrEqual(romaOra(10, 0).getTime());
    });

    it('nessuna visita messa in orario cade fuori dall\'orario d\'apertura (anche se il giro la mette per prima)', () => {
        const sched = scheduleMomentPlan([{ moment: mattina, stops: [{ candidate: museoDieci }, { candidate: chiesa }] }], [romaOra(9, 30)]);
        expect(closedInSchedule(sched)).toEqual([]);
        // e un posto che nella mattina non apre mai resta fuori dal bucket
        const pomeriggio = { ...museoDieci, place_id: 'p-tardi', openingPeriods: periodi('1600', '1900') };
        const { buckets } = applyOpeningToBuckets([mattina], new Map([['g1-mattina', [pomeriggio]]]));
        expect(buckets.get('g1-mattina')).toEqual([]);
    });
});

// ─── il motore, con fetch finto ──────────────────────────────────────────────
const g = (name, lat, lng, extra = {}) => ({
    place_id: `pid-${name.replace(/\W+/g, '-').toLowerCase()}`, name, formatted_address: `${name}, Italia`,
    geometry: { location: { lat, lng } }, business_status: 'OPERATIONAL', utc_offset_minutes: 120,
    types: ['tourist_attraction', 'point_of_interest'], rating: 4.6, user_ratings_total: 300, ...extra,
});
const traduttore = { choices: [{ message: { content: JSON.stringify({ queries: ['piazza storica', 'trattoria tipica'], categoria: 'misto', oggetto_umano: 'un giro', citta: null, vincoli: { tempo: null, escludi: [], note: null } }) } }] };
const fetchFinto = (findplace = () => null) => vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes('openai-proxy')) {
        const sys = String(JSON.parse(String(init?.body || '{}')).messages?.[0]?.content || '');
        if (sys.includes('traduttore di intenti')) return { ok: true, json: async () => traduttore };
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ stops: [{ place_id: 'pid-nessuno', moment: 'g1-mattina' }] }) } }] }) };
    }
    if (u.includes('textsearch')) return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) };
    if (u.includes('findplacefromtext')) {
        const input = new URL(u, 'http://x').searchParams.get('input') || '';
        const c = findplace(input);
        return { ok: true, json: async () => (c ? { status: 'OK', candidates: [c] } : { status: 'ZERO_RESULTS', candidates: [] }) };
    }
    return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', candidates: [] }) };
});
const titoli = (r) => r.days.flatMap(d => d.stops).filter(s => !s.tempoLibero).map(s => s.title);

describe('C10c — il motore: orari, quartiere chiesto, piazze storiche, borgo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-14T22:19:00+02:00'));
    });
    afterEach(() => {
        vi.unstubAllGlobals(); vi.useRealTimers();
        vi.mocked(fetchCityKnowledge).mockReset(); vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'spenta', verificati: [] });
        vi.mocked(fetchQuartiereKnowledge).mockReset(); vi.mocked(fetchQuartiereKnowledge).mockResolvedValue({ stato: 'spenta', verificati: [] });
    });

    const CT = { latitude: 37.5027, longitude: 15.0873, isSmallTown: false, radiusKm: 10 };
    const lista = (p, tipo, momento, extra = {}) => ({ ...p, _citta: { tipo, momento, ...extra } });
    const CITTA = [
        lista(g('Museo delle Dieci', 37.5032, 15.0868, { primary_type: 'museum', types: ['museum'], opening_hours: orari('1000', '1230') }), 'essenziale', 'mattina', { simbolo: true, categoria: 'museo' }),
        lista(g('Chiesa Grande', 37.5025, 15.0877, { primary_type: 'church', types: ['church'], opening_hours: orari('0700', '2000') }), 'essenziale', 'mattina', { categoria: 'chiesa' }),
        lista(g('Palazzo Antico', 37.5021, 15.0866, { primary_type: 'historical_landmark', types: ['historical_landmark', 'tourist_attraction'], opening_hours: orari('0900', '1900') }), 'da locale', 'pomeriggio', { categoria: 'palazzo' }),
        lista(g('Giardino Pubblico', 37.5038, 15.0880, { primary_type: 'park', types: ['park'], opening_hours: orari('0700', '2100') }), 'da locale', 'pomeriggio', { categoria: 'giardino' }),
        lista(g('Piazza del Duomo', 37.5026, 15.0871, { types: ['route'] }), 'da locale', 'mattina', { categoria: 'piazza' }),
        lista(g('Trattoria Uno', 37.5029, 15.0862, { primary_type: 'italian_restaurant', types: ['restaurant', 'food'], opening_hours: orari('1200', '2300') }), 'da locale', 'pranzo', { categoria: 'ristorante' }),
        lista(g('Trattoria Due', 37.5019, 15.0879, { primary_type: 'italian_restaurant', types: ['restaurant', 'food'], opening_hours: orari('1200', '2300') }), 'da locale', 'cena', { categoria: 'ristorante' }),
        lista(g('Bar Sera', 37.5031, 15.0884, { primary_type: 'bar', types: ['bar'], opening_hours: orari('0700', '2359') }), 'da locale', 'aperitivo', { categoria: 'dopocena' }),
    ];
    const orariDi = new Map(CITTA.map(p => [p.name, p.opening_hours?.periods || null]));
    const generaCatania = () => aiRecommendationService.generateItinerary('Catania', { duration: '1 Giorno' }, 'Domani una giornata a Catania', {}, '', CT, { pathType: 'custom', skipUserQuota: true });

    it('il simbolo aperto solo dalle 10:00 alle 12:30 entra nella mattina, e nessuna visita del tour cade fuori orario', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'città', verificati: CITTA });
        vi.stubGlobal('fetch', fetchFinto());
        const r = await generaCatania();
        expect(titoli(r)).toContain('Museo delle Dieci');
        for (const s of r.days.flatMap(d => d.stops).filter(x => !x.tempoLibero)) {
            const per = orariDi.get(s.title);
            if (!per) continue;
            const st = openStatus({ openingPeriods: per, utcOffsetMinutes: 120 }, new Date(s.scheduledTime), s.stayMinutes);
            expect({ tappa: s.title, stato: st.stato }).toEqual({ tappa: s.title, stato: 'aperto' });
        }
    });

    it('una piazza storica della lista non viene tolta dalle zone: vale come passeggiata', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'città', verificati: CITTA });
        vi.stubGlobal('fetch', fetchFinto());
        const r = await generaCatania();
        expect((r._momentReport?.tema?.zoneTolte || []).map(z => z.nome)).not.toContain('Piazza del Duomo');
        expect(r._citta.storicheTenute.map(x => x.nome)).toContain('Piazza del Duomo');
        expect(r._citta.nelPool.map(x => x.nome)).toContain('Piazza del Duomo');
    });

    // Roma: la lista del giorno ha Monti e Centro, non Trastevere
    const ROMA_C = { latitude: 41.8967068, longitude: 12.4822025, isSmallTown: false, radiusKm: 10 };
    const LISTA_ROMA = [
        lista(g('Colosseo', 41.8902, 12.4922, { primary_type: 'historical_landmark', types: ['historical_landmark'] }), 'essenziale', 'mattina', { quartiere: 'Monti', simbolo: true }),
        lista(g('Pantheon', 41.8986, 12.4769, { primary_type: 'historical_landmark', types: ['historical_landmark'] }), 'essenziale', 'mattina', { quartiere: 'Centro', simbolo: true, simboloDedotto: true }),
        lista(g('San Pietro', 41.9022, 12.4539, { primary_type: 'church', types: ['church'] }), 'essenziale', 'mattina', { quartiere: 'Prati', simbolo: true, simboloDedotto: true }),
    ];
    const TRASTEVERE = { name: 'Trastevere', types: ['neighborhood', 'political'],
        geometry: { location: { lat: 41.8867, lng: 12.4692 }, viewport: { northeast: { lat: 41.8935, lng: 12.4790 }, southwest: { lat: 41.8810, lng: 12.4620 } } } };
    const LISTA_TRASTEVERE = [
        lista(g('Santa Maria in Trastevere', 41.8895, 12.4699, { primary_type: 'church', types: ['church'] }), 'essenziale', 'mattina'),
        lista(g('Villa Farnesina', 41.8933, 12.4672, { primary_type: 'museum', types: ['museum'] }), 'essenziale', 'mattina'),
        lista(g('Santa Cecilia', 41.8876, 12.4760, { primary_type: 'church', types: ['church'] }), 'da locale', 'pomeriggio'),
        lista(g('Orto Botanico', 41.8918, 12.4689, { primary_type: 'botanical_garden', types: ['park'] }), 'da locale', 'pomeriggio'),
        lista(g('Fontana dell\'Acqua Paola', 41.8885, 12.4664, { primary_type: 'historical_landmark', types: ['historical_landmark'] }), 'da locale', 'pomeriggio'),
        lista(g('Trattoria da Enzo', 41.8880, 12.4772, { primary_type: 'italian_restaurant', types: ['restaurant', 'food'] }), 'da locale', 'pranzo'),
        lista(g('Osteria Trastevere', 41.8890, 12.4710, { primary_type: 'italian_restaurant', types: ['restaurant', 'food'] }), 'da locale', 'cena'),
        lista(g('Bar San Calisto', 41.8888, 12.4703, { primary_type: 'bar', types: ['bar'] }), 'da locale', 'aperitivo'),
    ];

    it('un quartiere chiesto che non è nella lista è riconosciuto su Google: la giornata parte da lì e almeno metà delle tappe ci stanno', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'metropoli', verificati: LISTA_ROMA });
        vi.mocked(fetchQuartiereKnowledge).mockResolvedValue({ stato: 'ok', cached: true, verificati: LISTA_TRASTEVERE });
        vi.stubGlobal('fetch', fetchFinto((input) => (/^Trastevere, Roma$/.test(input) ? TRASTEVERE : null)));
        const r = await aiRecommendationService.generateItinerary('Roma', { duration: '1 Giorno' }, 'Domani una giornata a Trastevere', {}, '', ROMA_C, { pathType: 'custom', skipUserQuota: true });
        expect(r._citta.quartiere).toMatchObject({ nome: 'Trastevere' });
        expect(r._citta.quartiere.motivo).toMatch(/fuori lista/);
        expect(vi.mocked(fetchQuartiereKnowledge)).toHaveBeenCalledWith('Roma', '2026-10-15', 'Trastevere');
        const q = r._citta.tappeNelQuartiere;
        expect(q.parteDaLi).toBe(true);
        expect(q.nel * 2).toBeGreaterThanOrEqual(q.totali);
        expect(titoli(r)).not.toContain('Colosseo');
    });

    // un borgo: 5 posti della lista, di cui un ristorante (e la via principale, che e' una passeggiata)
    const TR = { latitude: 37.7823936, longitude: 14.5949418, isSmallTown: true, radiusKm: 5 };
    const vicino = (name, dLat, dLng, extra) => g(name, TR.latitude + dLat, TR.longitude + dLng, { formatted_address: `${name}, 94018 Troina EN, Italia`, user_ratings_total: 40, ...extra });
    const BORGO = [
        lista(vicino('Chiesa Madre', 0.003, 0.006, { primary_type: 'church', types: ['church'], opening_hours: orari('1030', '1230') }), 'essenziale', 'mattina', { simbolo: true, categoria: 'chiesa' }),
        lista(vicino('Torre Capitania', 0.0036, 0.0079, { primary_type: 'museum', types: ['museum'], opening_hours: orari('1000', '1230') }), 'essenziale', 'mattina', { categoria: 'monumento' }),
        lista(vicino('Convento', 0.002, 0.003, { primary_type: 'place_of_worship', types: ['place_of_worship'] }), 'essenziale', 'pomeriggio', { categoria: 'chiesa' }),
        lista(vicino('La Contea', 0.001, 0.004, { primary_type: 'restaurant', types: ['restaurant', 'food'], opening_hours: orari('1100', '2300') }), 'da locale', 'cena', { categoria: 'ristorante' }),
        lista(vicino('Via Conte Ruggero', 0.0025, 0.004, { types: ['route'] }), 'da locale', 'pomeriggio', { categoria: 'via', passeggiata: true }),
    ];

    it('un borgo con 5 posti di cui un ristorante applica «la durata segue le tappe» (contano i luoghi da visitare)', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'borgo', verificati: BORGO });
        vi.stubGlobal('fetch', fetchFinto());
        const r = await aiRecommendationService.generateItinerary('Troina', { duration: '1 Giorno' }, 'Domani una giornata a Troina', {}, '', TR, { pathType: 'custom', skipUserQuota: true });
        expect(r._citta.mezzaGiornata).toMatchObject({ utilizzabili: 3 });
        const w = r.tourWindow.windows[0];
        expect((w.end.getTime() - w.start.getTime()) / 60000).toBeLessThanOrEqual(180);
        expect(r.days[0].scalaNote).toBe('Troina si gira in mezza giornata.');
    });
});

// ─── il simbolo dell'AI, le ancore spostate, il tracciato dei riempimenti ─────
describe('C10c — simbolo dell\'AI, ancore vietate, riempimenti respinti', () => {
    it('il simbolo dichiarato dall\'AI vince su quello dedotto dal codice (anche della stessa famiglia)', () => {
        const ess = (name, extra) => ({ place_id: `p-${name}`, name, types: ['museum'], primaryType: 'museum', latitude: 40.85, longitude: 14.25,
            _citta: { tipo: 'essenziale', momento: 'mattina', simbolo: true, ...extra } });
        const r = poolConLista([ess('Sansevero', { simboloDedotto: true }), ess('Castel Nuovo', {})], { seleziona: (x) => x });
        expect(r.ancore[0].name).toBe('Castel Nuovo');
        expect(r.ancore.map(c => c.name)).not.toContain('Sansevero');
    });

    it('un\'ancora vietata nel suo momento va in un altro momento del giorno dove è aperta', () => {
        const m = (key, stops = 2) => ({ id: `g1-${key}`, key, dayIndex: 0, stops });
        const moments = [m('mattina'), m('pranzo', 1), m('pomeriggio')];
        const buckets = new Map([['g1-mattina', [{ place_id: 'teatro' }]], ['g1-pomeriggio', []], ['g1-pranzo', []]]);
        const veto = new Map([['g1-pomeriggio', new Set(['teatro'])]]);
        const r = spostaAncoreVietate([{ place_id: 'teatro', moment: 'g1-pomeriggio' }], new Set(['teatro']), moments, buckets, veto);
        expect(r.aiStops[0].moment).toBe('g1-mattina');
        expect(r.spostate).toEqual([{ place_id: 'teatro', da: 'g1-pomeriggio', a: 'g1-mattina' }]);
    });

    it('il nucleo del quartiere chiesto non è il riquadro di Google (largo): 1 km dal suo punto, dentro il riquadro', () => {
        // il riquadro di Trastevere per Google arriva al Pantheon
        const cand = { name: 'Trastevere', types: ['neighborhood'], geometry: { location: { lat: 41.8848, lng: 12.4704 },
            viewport: { northeast: { lat: 41.9002, lng: 12.4792 }, southwest: { lat: 41.8821, lng: 12.4569 } } } };
        const q = quartiereFuoriLista({ nome: 'Trastevere', candidato: cand, poiQuartiere: [] });
        expect(dentroNucleo({ latitude: 41.8895, longitude: 12.4699 }, q.nucleo)).toBe(true);   // Santa Maria in Trastevere
        expect(dentroNucleo({ latitude: 41.8986, longitude: 12.4769 }, q.nucleo)).toBe(false);  // Pantheon: nel riquadro, a 1,6 km
    });

    it('nel borgo un posto con i soli tipi generici di Google non è un luogo da visitare', () => {
        expect(luogoDaVisitareBorgo({ types: ['point_of_interest', 'establishment'] })).toBe(false);
        expect(luogoDaVisitareBorgo({ types: ['church', 'point_of_interest'], primaryType: 'church' })).toBe(true);
        expect(luogoDaVisitareBorgo({ types: ['restaurant', 'food'], primaryType: 'restaurant' })).toBe(false);
    });

    it('il tracciato registra il criterio che ha fermato un riempimento (varietà, cammino, orario)', () => {
        const sched = (n) => ({ days: [Array.from({ length: n }, () => ({ candidate: { types: ['church'] } }))], tolte: [] });
        const cur = { repaired: { report: { ripieghi: [], tempoLibero: [] } }, sched: sched(3) };
        const varieta = { repaired: { report: { ripieghi: [{ place_id: 'x', momento: 'g1-mattina', motivo: 'nessuna famiglia nuova vicina: chiesa ripetuta' }], tempoLibero: [] } }, residui: [] };
        expect(criterioRespinto({ trial: varieta, trialSched: sched(4), cur })).toMatchObject({ criterio: 'varietà' });
        const cammino = { repaired: { report: { ripieghi: [{ place_id: 'y', momento: 'g1-mattina', motivo: 'nessun candidato entro 20 min: il piu\' vicino' }], tempoLibero: [] } }, residui: [] };
        expect(criterioRespinto({ trial: cammino, trialSched: sched(4), cur })).toMatchObject({ criterio: 'cammino' });
        const orario = { repaired: { report: {} }, residui: [{ nome: 'Museo' }] };
        expect(criterioRespinto({ trial: orario, trialSched: sched(4), cur })).toMatchObject({ criterio: 'orario' });
    });
});
