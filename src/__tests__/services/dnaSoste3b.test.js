// DNA-3b — nel motore vero (borgo sintetico, rete finta): il DNA cambia com'e' fatto il giro e le esclusioni sono un filtro duro. 0 $.
// Unit test della regola: src/__tests__/lib/sosteDna.test.js. Numeri e corrispondenze: docs/prove/2026-10-22-dna-3b.md.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';

const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const ore = { periods: [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: '0700' }, close: { day: d, time: '2300' } })) };
const place = ({ id, name, km, dx = 0, types, primary, rating = 4.6 }) => ({
    place_id: id, name, geometry: { location: { lat: CABRAS.latitude + km / 111, lng: CABRAS.longitude + dx / 85 } }, rating, user_ratings_total: 300,
    business_status: 'OPERATIONAL', types, primaryType: primary, opening_hours: ore,
});
const MUSEI = [place({ id: 'm1', name: 'Museo del Mare', km: 0.4, types: ['museum'], primary: 'museum' }), place({ id: 'm2', name: 'Museo Civico', km: 0.6, types: ['museum'], primary: 'museum' })];
const CHIESE = Array.from({ length: 6 }, (_, i) => place({ id: `c${i}`, name: `Chiesa di San ${['Giovanni', 'Pietro', 'Paolo', 'Marco', 'Luca', 'Matteo'][i]}`, km: 0.45 + i * 0.03, dx: 0.1 * i, types: ['church', 'place_of_worship'], primary: 'church' }));
const RISTORANTI = [place({ id: 'r1', name: 'Trattoria Sarda', km: 0.5, types: ['restaurant', 'food'], primary: 'restaurant' }), place({ id: 'r2', name: 'Osteria del Porto', km: 0.7, types: ['restaurant', 'food'], primary: 'restaurant' })];
const BAR = place({ id: 'k1', name: 'Caffè Storico Vittoria', km: 0.45, dx: 0.1, types: ['cafe', 'food'], primary: 'cafe' });
const GELATERIA = place({ id: 'k2', name: 'Gelateria del Corso', km: 0.55, types: ['ice_cream_shop', 'food'], primary: 'ice_cream_shop' });
const VERDE = [  // giardini e parchi per il test di sera
    place({ id: 'g1', name: 'Giardino Pubblico', km: 0.5, dx: -0.1, types: ['park'], primary: 'park' }),
    place({ id: 'g2', name: 'Parco del Sinis', km: 0.52, dx: -0.12, types: ['park'], primary: 'park' }),
    place({ id: 'g3', name: 'Villa Comunale', km: 0.54, dx: -0.1, types: ['park'], primary: 'park' }),
    place({ id: 'g4', name: 'Giardino dei Pini', km: 0.56, dx: -0.14, types: ['park'], primary: 'park' }),
];

const routeFetch = ({ risultati, selezione, intent }) => {
    const stato = { selectorBodies: [] };
    const fn = vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const body = String(init?.body ?? '');
            const sel = body.includes("SEI L'INSIDER DI");
            if (sel) stato.selectorBodies.push(body);
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(sel ? { days: [{ day: 1, stops: selezione.map(id => ({ place_id: id, description: 'x' })) }] } : intent) } }] }) };
        }
        if (u.includes('textsearch')) return { ok: true, json: async () => ({ status: 'OK', results: risultati }) };
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        throw new Error(`fetch inatteso: ${u}`);
    });
    return { fn, stato };
};
const INTENT_MISTO = { queries: ['centro'], categoria: 'misto', vincoli: { tempo: null, escludi: [], note: null } };
const genera = async ({ testo, dnaWeights, risultati, selezione, intent = INTENT_MISTO, ora = '2026-10-14T09:00:00+02:00' }) => {
    vi.setSystemTime(new Date(ora));
    const { fn } = routeFetch({ risultati, selezione, intent });
    vi.stubGlobal('fetch', fn);
    const r = await aiRecommendationService.generateItinerary('Cabras', {}, testo, {}, '', CABRAS, { dnaWeights, pathType: 'custom' });
    const stops = (r.days || []).flatMap(d => d.stops || []);
    return { r, stops, titoli: stops.filter(s => s.title !== 'Tempo libero').map(s => s.title), sosteDna: stops.filter(s => s._tracciato?.dna?.sosta), soste: r._momentReport?.soste };
};

describe('DNA-3b — nel motore vero', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    const pool = [...MUSEI, CHIESE[0], ...RISTORANTI, BAR, GELATERIA];
    const selezione = ['m1', 'm2', 'c0'];

    it('food alta contro utente nuovo: l\'utente nuovo non ha soste; food alta ha +1 sosta di cibo (stesso giro per il resto)', async () => {
        const nuovo = await genera({ testo: 'una giornata a Cabras', dnaWeights: {}, risultati: pool, selezione });
        const food = await genera({ testo: 'una giornata a Cabras', dnaWeights: { food: 1, _share: 0.45 }, risultati: pool, selezione });
        expect(nuovo.sosteDna).toHaveLength(0);
        expect(food.sosteDna.length).toBeGreaterThanOrEqual(1);
        expect(food.titoli.length).toBe(nuovo.titoli.length + food.sosteDna.length);
        // il giro dell'utente nuovo e' tutto presente, nello stesso ordine, nel giro food (con le soste in piu')
        const senzaSoste = food.titoli.filter(t => !food.sosteDna.some(s => s.title === t));
        expect(senzaSoste).toEqual(nuovo.titoli);
        for (const s of food.sosteDna) { expect(s.stayMinutes).toBeGreaterThanOrEqual(15); expect(s.stayMinutes).toBeLessThanOrEqual(30); expect(s._tracciato.dna.deviazioneM).toBeLessThanOrEqual(300); }
        // una sosta di cibo e' un caffe', una pasticceria, una gelateria: mai un ristorante
        expect(food.sosteDna.every(s => /caffè|gelateria|pasticceria/i.test(s.title))).toBe(true);
            });

    it('fiducia 0 (share 0) o pesi vuoti: identico all\'utente nuovo', async () => {
        const nuovo = await genera({ testo: 'una giornata a Cabras', dnaWeights: {}, risultati: pool, selezione });
        const zero = await genera({ testo: 'una giornata a Cabras', dnaWeights: { food: 1, _share: 0 }, risultati: pool, selezione });
        expect(zero.titoli).toEqual(nuovo.titoli);
        expect(zero.soste?.motivo).toBe('fiducia del DNA 0');
    });

    it('food alta + «solo musei»: nessuna sosta, solo musei', async () => {
        const out = await genera({
            testo: 'solo musei', dnaWeights: { food: 1, _share: 0.45 }, risultati: [...pool],
            selezione: ['m1', 'm2'], intent: { queries: ['musei'], categoria: 'cultura', vincoli: { tempo: null, escludi: [], note: null } },
        });
        expect(out.sosteDna).toHaveLength(0);
        expect(out.soste?.motivo).toBeTruthy();
    });

    it('natura alta, di sera (giro che parte alle 20:30): nessuna sosta', async () => {
        const risultati = [...MUSEI, ...RISTORANTI, ...VERDE, BAR];
        const out = await genera({ testo: 'una serata a Cabras', dnaWeights: { natura: 1, _share: 0.45 }, risultati, selezione: ['m1'], ora: '2026-10-14T20:30:00+02:00' });
        expect(out.sosteDna).toHaveLength(0);
    });

    it('«niente chiese» con un pool pieno di chiese: 0 chiese nel giro e la riga «Ho tolto le chiese come chiesto: il giro è più corto.»', async () => {
        const risultati = [...CHIESE, MUSEI[0], RISTORANTI[0]];
        const out = await genera({
            testo: 'giro in centro, niente chiese', dnaWeights: {}, risultati, selezione: CHIESE.map(c => c.place_id),
            intent: { queries: ['centro storico'], categoria: 'misto', vincoli: { tempo: null, escludi: ['chiese'], note: null } },
        });
        expect(out.titoli.some(t => /^Chiesa/.test(t))).toBe(false);
        expect(out.r.days[0].scalaNote).toContain('Ho tolto le chiese come chiesto: il giro è più corto.');
    });

    it('stesso pool senza «niente chiese»: le chiese ci sono (il filtro scatta solo con l\'esclusione) e nessuna nota', async () => {
        const risultati = [...CHIESE, MUSEI[0], RISTORANTI[0]];
        const out = await genera({ testo: 'giro in centro', dnaWeights: {}, risultati, selezione: CHIESE.map(c => c.place_id) });
        expect(out.titoli.some(t => /^Chiesa/.test(t))).toBe(true);
        expect(out.r.days[0].scalaNote || '').not.toContain('Ho tolto');
    });
});
