// C1 — distanza e varieta' nella composizione. I sintomi 1 e 3 vengono dal
// branch diag/composizione (b4dcdf3), dove erano rossi: qui sono verdi.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    flattenSkeleton, bucketCandidates, repairMomentSelection, scheduleMomentPlan,
    candidateFamily, requestedFamilies, mealSearchAnchor, MAX_WALK_MINUTES, MAX_WALK_METERS,
} from '../../services/momentSelection';
import { travelMinutes } from '../../lib/tourTiming';
import { aiRecommendationService } from '../../services/aiRecommendationService';

const romeAt = (iso) => new Date(iso);
const moment = (key, label, startIso, endIso, stops = 1, categories) => ({
    key, label, start: romeAt(startIso), end: romeAt(endIso), stops,
    categories: categories || { mattina: ['cultura', 'monumenti', 'musei', 'passeggiata'], pomeriggio: ['cultura', 'natura', 'shopping', 'passeggiata'], aperitivo: ['bar', 'punti panoramici'], cena: ['cibo'], pranzo: ['cibo'] }[key],
});
const flat = (ms) => flattenSkeleton({ days: [{ moments: ms }] });

describe('C1 — il tetto', () => {
    it('una costante sola: 20 minuti a piedi, ~1.5 km di bias per la ricerca dei pasti', () => {
        expect(MAX_WALK_MINUTES).toBe(20);
        expect(MAX_WALK_METERS).toBe(1500);
    });
});

// ─── Sintomo 1 — pasto a 107 minuti dalla tappa prima ───────────────────────
describe('C1 sintomo (1) — Catania: il pasto lontano dalla tappa prima', () => {
    const CT = { lat: 37.5027, lng: 15.0873 };
    const museo = { place_id: 'ct-museo', name: 'Museo Civico Castello Ursino', types: ['museum'], rating: 4.5, user_ratings_total: 3000, latitude: CT.lat, longitude: CT.lng };
    const lontana = { place_id: 'ct-lontana', name: 'Trattoria Sorano', types: ['restaurant', 'food'], rating: 4.8, user_ratings_total: 90, latitude: CT.lat + 0.072, longitude: CT.lng };
    const vicina = { place_id: 'ct-vicina', name: 'Trattoria del Duomo', types: ['restaurant', 'food'], rating: 4.4, user_ratings_total: 900, latitude: CT.lat + 0.003, longitude: CT.lng };
    const pool = [museo, lontana, vicina];
    const ms = flat([
        moment('pomeriggio', 'Pomeriggio', '2026-10-11T14:30:00+02:00', '2026-10-11T18:00:00+02:00'),
        moment('cena', 'Cena', '2026-10-11T20:00:00+02:00', '2026-10-11T22:30:00+02:00'),
    ]);

    it('controllo dello strumento: la trattoria "lontana" e\' a oltre 100 minuti a piedi', () => {
        expect(travelMinutes(museo, lontana)).toBeGreaterThanOrEqual(100);
        expect(travelMinutes(museo, vicina)).toBeLessThanOrEqual(10);
    });

    it('riparazione: il merito non porta piu\' a 107 minuti se c\'e\' una trattoria entro il tetto', () => {
        const { plan } = repairMomentSelection({ moments: ms, buckets: bucketCandidates(ms, pool), aiStops: [{ place_id: 'ct-museo', moment: 'g1-pomeriggio' }], pool });
        const cena = plan.find(p => p.moment.key === 'cena').stops[0];
        expect(travelMinutes(museo, cena.candidate)).toBeLessThanOrEqual(MAX_WALK_MINUTES);
        expect(cena.trace).toMatchObject({ scelta: 'riparazione', famiglia: null });
    });

    it('scelta del modello: la trattoria a 107 minuti e\' scartata, entra quella vicina', () => {
        const { plan, report } = repairMomentSelection({
            moments: ms, buckets: bucketCandidates(ms, pool), pool,
            aiStops: [{ place_id: 'ct-museo', moment: 'g1-pomeriggio' }, { place_id: 'ct-lontana', moment: 'g1-cena' }],
        });
        const sched = scheduleMomentPlan(plan, romeAt('2026-10-11T14:30:00+02:00'));
        const cena = sched.days[0].find(s => s.moment.key === 'cena');
        expect(travelMinutes(museo, cena.candidate)).toBeLessThanOrEqual(MAX_WALK_MINUTES);
        expect(report.scartate.find(x => x.place_id === 'ct-lontana').motivo).toMatch(/oltre il tetto di cammino/);
        expect(sched.days[0][0].trace).toMatchObject({ scelta: 'modello', minuti: null, famiglia: 'museo' });
    });
});

// ─── Sintomo 3 — tre belvederi nello stesso tour ────────────────────────────
describe('C1 sintomo (3) — Roma "da romano": varieta\' delle famiglie', () => {
    const R = { lat: 41.8986, lng: 12.4769 };
    const belv = (i, name) => ({ place_id: `rm-b${i}`, name, types: ['tourist_attraction', 'point_of_interest'], rating: 4.8, user_ratings_total: 60 + i, latitude: R.lat + i * 0.002, longitude: R.lng });
    const pool = [
        belv(1, 'Belvedere Tarpeo'), belv(2, 'Terrazza Belvedere Aventino'), belv(3, 'Belvedere Cederna'), belv(4, 'Belvedere del Gianicolo'),
        { place_id: 'rm-chiesa', name: 'Chiesa di San Clemente', types: ['church', 'tourist_attraction'], rating: 4.7, user_ratings_total: 4000, latitude: R.lat, longitude: R.lng + 0.003 },
        { place_id: 'rm-museo', name: 'Museo Barracco', types: ['museum'], rating: 4.6, user_ratings_total: 2500, latitude: R.lat, longitude: R.lng - 0.003 },
    ];
    const ms = flat([
        moment('mattina', 'Mattina', '2026-10-11T09:30:00+02:00', '2026-10-11T12:30:00+02:00'),
        moment('pomeriggio', 'Pomeriggio', '2026-10-11T14:30:00+02:00', '2026-10-11T18:00:00+02:00'),
        moment('aperitivo', 'Aperitivo', '2026-10-11T18:00:00+02:00', '2026-10-11T20:00:00+02:00'),
    ]);
    const nomi = (plan) => plan.flatMap(p => p.stops.map(s => s.candidate.name));
    const belvederi = (plan) => nomi(plan).filter(n => /belvedere|terrazza/i.test(n));

    it('riparazione per merito: un belvedere solo, all\'aperitivo (l\'unico momento che ha solo belvederi)', () => {
        const { plan } = repairMomentSelection({ moments: ms, buckets: bucketCandidates(ms, pool), aiStops: [], pool });
        expect(belvederi(plan), nomi(plan).join(' | ')).toHaveLength(1);
        expect(plan.map(p => p.stops.length)).toEqual([1, 1, 1]);
        expect(plan[2].stops[0].trace.famiglia).toBe('panorama');
    });

    it('scelta del modello con 3 belvederi: il codice ne tiene uno e dice perche\'', () => {
        const { plan, report } = repairMomentSelection({
            moments: ms, buckets: bucketCandidates(ms, pool), pool,
            aiStops: [{ place_id: 'rm-b1', moment: 'g1-mattina' }, { place_id: 'rm-b2', moment: 'g1-pomeriggio' }, { place_id: 'rm-b3', moment: 'g1-aperitivo' }],
        });
        expect(belvederi(plan), nomi(plan).join(' | ')).toHaveLength(1);
        expect(nomi(plan)).toContain('Belvedere Cederna');
        expect(report.scartate.map(x => x.motivo).join(' | ')).toMatch(/unica alternativa a un momento dopo \(panorama\)/);
    });

    it('richiesta "i belvederi di Roma": la regola si spegne, i belvederi del modello restano', () => {
        const asked = requestedFamilies({ text: 'Voglio vedere i belvederi di Roma' });
        expect([...asked]).toEqual(['panorama']);
        const { plan, report } = repairMomentSelection({
            moments: ms, buckets: bucketCandidates(ms, pool), pool, requestedFamilies: asked,
            aiStops: [{ place_id: 'rm-b1', moment: 'g1-mattina' }, { place_id: 'rm-b2', moment: 'g1-pomeriggio' }, { place_id: 'rm-b3', moment: 'g1-aperitivo' }],
        });
        expect(belvederi(plan)).toHaveLength(3);
        expect(report.scartate).toEqual([]);
        expect(plan.flatMap(p => p.stops.map(s => s.trace.scelta))).toEqual(['modello', 'modello', 'modello']);
    });

    it('la regola vale per giorno: il giorno dopo un belvedere torna possibile', () => {
        const two = flattenSkeleton({ days: [{ moments: [ms[2]] }, { moments: [ms[2]] }] });
        const { plan } = repairMomentSelection({ moments: two, buckets: bucketCandidates(two, pool), aiStops: [], pool });
        expect(plan.map(p => p.stops[0].trace.famiglia)).toEqual(['panorama', 'panorama']);
        expect(plan.map(p => p.stops[0].trace.scelta)).toEqual(['riparazione', 'riparazione']);
    });
});

// ─── Ripiego — nessun candidato sotto il tetto ──────────────────────────────
describe('C1 ripiego — borgo con le trattorie tutte lontane', () => {
    const B = { lat: 40.0, lng: 16.0 };
    const chiesa = { place_id: 'bg-chiesa', name: 'Chiesa Madre', types: ['church'], rating: 4.6, user_ratings_total: 200, latitude: B.lat, longitude: B.lng };
    // ~3.3 km e ~5.5 km: 44 e 74 minuti a piedi, entrambe oltre il tetto.
    const media = { place_id: 'bg-media', name: 'Osteria del Ponte', types: ['restaurant'], rating: 4.2, user_ratings_total: 150, latitude: B.lat + 0.03, longitude: B.lng };
    const lontana = { place_id: 'bg-lontana', name: 'Agriturismo La Collina', types: ['restaurant'], rating: 4.9, user_ratings_total: 80, latitude: B.lat + 0.05, longitude: B.lng };
    const pool = [chiesa, media, lontana];
    const ms = flat([
        moment('mattina', 'Mattina', '2026-10-11T09:30:00+02:00', '2026-10-11T12:30:00+02:00'),
        moment('pranzo', 'Pranzo', '2026-10-11T12:30:00+02:00', '2026-10-11T14:30:00+02:00'),
    ]);

    it('il pranzo non resta vuoto: entra la trattoria piu\' vicina, dichiarata come ripiego', () => {
        expect(travelMinutes(chiesa, media)).toBeGreaterThan(MAX_WALK_MINUTES);
        const { plan, report } = repairMomentSelection({ moments: ms, buckets: bucketCandidates(ms, pool), aiStops: [], pool });
        const pranzo = plan.find(p => p.moment.key === 'pranzo').stops[0];
        expect(pranzo.candidate.place_id).toBe('bg-media');
        expect(pranzo.trace).toMatchObject({ scelta: 'ripiego', minuti: travelMinutes(chiesa, media) });
        expect(report.ripieghi).toEqual([expect.objectContaining({ place_id: 'bg-media', momento: 'g1-pranzo' })]);
    });

    it('anche la scelta del modello piu\' lontana cede al ripiego piu\' vicino', () => {
        const { plan, report } = repairMomentSelection({
            moments: ms, buckets: bucketCandidates(ms, pool), pool,
            aiStops: [{ place_id: 'bg-chiesa', moment: 'g1-mattina' }, { place_id: 'bg-lontana', moment: 'g1-pranzo' }],
        });
        expect(plan[1].stops[0].candidate.place_id).toBe('bg-media');
        expect(report.scartate[0]).toMatchObject({ place_id: 'bg-lontana', motivo: expect.stringMatching(/oltre il tetto/) });
    });
});

// ─── Famiglie e richieste ───────────────────────────────────────────────────
describe('C1 — famiglie', () => {
    it('una famiglia per luogo; un posto dove mangiare non ne ha', () => {
        expect(candidateFamily({ name: 'Terrazza del Pincio', types: ['park'] })).toBe('panorama');
        expect(candidateFamily({ name: 'Basilica di San Clemente', types: ['tourist_attraction'] })).toBe('chiesa');
        expect(candidateFamily({ name: 'Galleria Borghese', types: ['art_gallery'] })).toBe('museo');
        expect(candidateFamily({ name: 'Villa Bellini', types: ['park'] })).toBe('verde');
        expect(candidateFamily({ name: 'Piazza Navona', types: ['tourist_attraction'] })).toBe('piazza');
        // Prova reale Roma: Google mette `park` a Piazza d'Aracoeli.
        expect(candidateFamily({ name: "Piazza d'Aracoeli", types: ['establishment', 'park', 'point_of_interest'] })).toBe('piazza');
        expect(candidateFamily({ name: 'Terrazza Borromini', types: ['restaurant', 'bar'] })).toBe(null);
        expect(candidateFamily({ name: 'Fontana di Trevi', types: ['tourist_attraction'] })).toBe(null);
    });

    it('richieste dalla categoria e dal testo', () => {
        expect([...requestedFamilies({ category: 'natura' })]).toEqual(['verde']);
        expect([...requestedFamilies({ category: 'musei' })]).toEqual(['museo']);
        expect([...requestedFamilies({ text: 'un giro per chiese barocche' })]).toEqual(['chiesa']);
        expect([...requestedFamilies({ text: 'Domani voglio vivere Roma da romano' })]).toEqual([]);
        expect([...requestedFamilies({ category: 'cultura', text: '' })]).toEqual([]);
    });
});

// ─── Ricerca mirata dei pasti: parte dalla tappa prima ─────────────────────
describe('C1 — ancora della ricerca dei pasti', () => {
    const museo = { place_id: 'm', name: 'Museo Diocesano', types: ['museum'], rating: 4.5, user_ratings_total: 300, latitude: 37.51, longitude: 15.09 };
    const parco = { place_id: 'p', name: 'Villa Bellini', types: ['park'], rating: 4.5, user_ratings_total: 300, latitude: 37.52, longitude: 15.08 };

    it('pranzo senza ristoranti: la ricerca parte dalla tappa della mattina', () => {
        const ms = flat([
            moment('mattina', 'Mattina', '2026-10-11T09:30:00+02:00', '2026-10-11T12:30:00+02:00'),
            moment('pranzo', 'Pranzo', '2026-10-11T12:30:00+02:00', '2026-10-11T14:30:00+02:00'),
            moment('pomeriggio', 'Pomeriggio', '2026-10-11T14:30:00+02:00', '2026-10-11T18:00:00+02:00'),
        ]);
        const pool = [museo, parco];
        expect(mealSearchAnchor(ms, bucketCandidates(ms, pool), pool)).toEqual({ latitude: 37.51, longitude: 15.09, name: 'Museo Diocesano' });
    });

    it('il pasto apre la giornata: la tappa dopo; nessun pasto corto: null', () => {
        const ms = flat([
            moment('pranzo', 'Pranzo', '2026-10-11T12:30:00+02:00', '2026-10-11T14:30:00+02:00'),
            moment('pomeriggio', 'Pomeriggio', '2026-10-11T14:30:00+02:00', '2026-10-11T18:00:00+02:00'),
        ]);
        expect(mealSearchAnchor(ms, bucketCandidates(ms, [parco]), [parco])?.name).toBe('Villa Bellini');
        const trattoria = { place_id: 't', name: 'Trattoria', types: ['restaurant'], latitude: 37.5, longitude: 15.0 };
        expect(mealSearchAnchor(ms, bucketCandidates(ms, [parco, trattoria]), [parco, trattoria])).toBe(null);
    });
});

// ─── Nel servizio: la ricerca dei pasti dalla tappa prima, stesse chiamate ──
describe('C1 — generateItinerary: ricerca dei pasti dalla tappa prima e tracciato', () => {
    const ROMA = { latitude: 41.8986, longitude: 12.4769, isSmallTown: false, radiusKm: 10 };
    let seq = 0;
    const place = (name, types, dLat, dLng) => ({
        place_id: `c1-${++seq}`, name, geometry: { location: { lat: ROMA.latitude + dLat, lng: ROMA.longitude + dLng } },
        rating: 4.6, user_ratings_total: 400, business_status: 'OPERATIONAL', types,
    });
    const LANDMARK = ['historical_landmark', 'point_of_interest', 'establishment'];
    const RIONI = [
        place('Basilica di Santa Maria in Trastevere', LANDMARK, -0.006, -0.004),
        place('Chiesa di San Crisogono', LANDMARK, -0.005, -0.002),
        place('Fontana dell\'Acqua Paola', LANDMARK, -0.007, -0.008),
        place('Arco degli Acetari', LANDMARK, 0.001, -0.001),
    ];
    const TRATTORIE = [
        place('Da Enzo al 29', ['restaurant', 'food', 'point_of_interest'], -0.005, -0.003),
        place('Trattoria Da Teo', ['restaurant', 'food', 'point_of_interest'], -0.006, -0.001),
    ];
    const FOOD_QUERY = 'trattoria ristorante pizzeria osteria';

    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('la textsearch del cibo parte dalla tappa prima del pranzo, con bias 1.5 km, una volta sola', async () => {
        vi.setSystemTime(new Date('2026-10-08T11:30:00+02:00'));
        const searches = [];
        let aiCalls = 0;
        vi.stubGlobal('fetch', vi.fn(async (url) => {
            const u = String(url);
            if (u.includes('openai-proxy')) {
                const payload = aiCalls++ === 0
                    ? { queries: ['chiesa', 'monumento'], categoria: 'storia', oggetto_umano: 'storia', vincoli: { tempo: null, escludi: [], note: null } }
                    : { stops: RIONI.map(p => ({ place_id: p.place_id, moment: 'g1-pranzo' })) };
                return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
            }
            if (u.includes('textsearch')) {
                const sp = new URL(u, 'http://x').searchParams;
                searches.push({ q: sp.get('query'), location: sp.get('location'), radius: sp.get('radius') });
                const per = { chiesa: RIONI.slice(0, 2), monumento: RIONI.slice(2), [FOOD_QUERY]: TRATTORIE };
                const hit = Object.keys(per).find(k => sp.get('query') === `${k} Roma`);
                return { ok: true, json: async () => (hit ? { status: 'OK', results: per[hit] } : { status: 'ZERO_RESULTS', results: [] }) };
            }
            if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
            throw new Error(`fetch inatteso: ${u}`);
        }));

        const result = await aiRecommendationService.generateItinerary(
            'Roma', { duration: 'Medio', group: 'Solo', interests: ['Città', 'Rioni Storici'] },
            'A Roma cerco: vicoli, rioni storici e vita di quartiere.', { condition: 'sunny', temperature: 20 }, '', ROMA,
            { dnaWeights: {}, pathType: 'quick', skipUserQuota: true },
        );

        const food = searches.filter(s => s.q === `${FOOD_QUERY} Roma`);
        expect(food).toHaveLength(1);
        expect(food[0].radius).toBe(String(MAX_WALK_METERS));
        const [lat, lng] = food[0].location.split(',').map(Number);
        expect(RIONI.some(p => p.geometry.location.lat === lat && p.geometry.location.lng === lng), food[0].location).toBe(true);
        // Le altre ricerche restano sul centro, col bias di prima.
        for (const s of searches.filter(x => x.q !== `${FOOD_QUERY} Roma`)) expect(s.location).toBe(`${ROMA.latitude},${ROMA.longitude}`);

        const stops = result.days.flatMap(d => d.stops);
        expect(stops.length).toBeGreaterThan(0);
        for (const [i, s] of stops.entries()) {
            expect(['modello', 'riparazione', 'ripiego']).toContain(s._tracciato.scelta);
            expect(s._tracciato.minuti).toBe(i === 0 ? null : s.travelMinutesFromPrev);
        }
    });
});

// ─── Prova reale Roma: l'alternativa lontana non conta ──────────────────────
describe('C1 — varieta\' a portata di piedi', () => {
    const R = { lat: 41.8986, lng: 12.4769 };
    const at = (id, name, types, dLat, extra = {}) => ({ place_id: id, name, types, rating: 4.6, user_ratings_total: 500, latitude: R.lat + dLat, longitude: R.lng, ...extra });
    // L'unico bar dell'aperitivo e' a ~4 km: oltre il tetto da qualunque tappa.
    const pool = [
        at('piazza', 'Piazza Colonna', ['establishment'], 0),
        at('tarpeo', 'Belvedere Tarpeo', ['tourist_attraction'], 0.004, { rating: 4.9, user_ratings_total: 90 }),
        at('cederna', 'Belvedere Cederna', ['tourist_attraction'], 0.006),
        at('chiesa', 'Chiesa di San Marcello', ['church'], 0.003, { rating: 4.4, user_ratings_total: 2000 }),
        at('bar', 'Bar Lontano', ['bar'], 0.04),
    ];
    const ms = flat([
        moment('mattina', 'Mattina', '2026-10-11T09:30:00+02:00', '2026-10-11T12:30:00+02:00'),
        moment('pomeriggio', 'Pomeriggio', '2026-10-11T14:30:00+02:00', '2026-10-11T18:00:00+02:00'),
        moment('aperitivo', 'Aperitivo', '2026-10-11T18:00:00+02:00', '2026-10-11T20:00:00+02:00'),
    ]);

    it('il belvedere del pomeriggio lascerebbe l\'aperitivo solo col bar a 4 km: il pomeriggio prende la chiesa', () => {
        const { plan, report } = repairMomentSelection({
            moments: ms, buckets: bucketCandidates(ms, pool), pool,
            aiStops: [{ place_id: 'piazza', moment: 'g1-mattina' }],
        });
        expect(plan.map(p => p.stops[0].candidate.place_id)).toEqual(['piazza', 'chiesa', 'tarpeo']);
        expect(plan.map(p => p.stops[0].trace.scelta)).toEqual(['modello', 'riparazione', 'riparazione']);
        expect(report.ripieghi).toEqual([]);
    });
});
