// DNA-3c — nel motore vero (borgo sintetico, rete finta): la ricerca mirata della sosta parte solo nelle condizioni dette. 0 $.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';

const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const ore = { periods: [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: '0700' }, close: { day: d, time: '2300' } })) };
const place = ({ id, name, km, dx = 0, types, primary, rating = 4.6 }) => ({
    place_id: id, name, geometry: { location: { lat: CABRAS.latitude + km / 111, lng: CABRAS.longitude + dx / 85 } }, rating, user_ratings_total: 300,
    business_status: 'OPERATIONAL', types, primaryType: primary, opening_hours: ore,
});
const MUSEI = [place({ id: 'm1', name: 'Museo del Mare', km: 0.4, types: ['museum'], primary: 'museum' }), place({ id: 'm2', name: 'Museo Civico', km: 0.6, types: ['museum'], primary: 'museum' })];
const CHIESA = place({ id: 'c0', name: 'Chiesa di San Giovanni', km: 0.5, dx: 0.2, types: ['church', 'place_of_worship'], primary: 'church' });
const RISTORANTI = [place({ id: 'r1', name: 'Trattoria Sarda', km: 0.5, types: ['restaurant', 'food'], primary: 'restaurant' }), place({ id: 'r2', name: 'Osteria del Porto', km: 0.7, types: ['restaurant', 'food'], primary: 'restaurant' })];
// il caffè che la ricerca mirata trova: vicino al vuoto fra il Museo del Mare e il pranzo
const CAFFE_TROVATO = place({ id: 'k9', name: 'Caffè Storico del Corso', km: 0.45, dx: 0.1, types: ['cafe', 'food'], primary: 'cafe' });
const POOL = [...MUSEI, CHIESA, ...RISTORANTI];
const INTENT = { queries: ['centro'], categoria: 'misto', vincoli: { tempo: null, escludi: [], note: null } };

const genera = async ({ testo = 'una giornata a Cabras', dnaWeights, ricerca = [CAFFE_TROVATO], intent = INTENT, ora = '2026-10-14T09:00:00+02:00', pathType = 'custom', opts = {} }) => {
    vi.setSystemTime(new Date(ora));
    const chiamate = [];
    const fn = vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const body = String(init?.body ?? '');
            const sel = body.includes("SEI L'INSIDER DI");
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(sel ? { days: [{ day: 1, stops: ['m1', 'm2', 'c0'].map(id => ({ place_id: id, description: 'x' })) }] } : intent) } }] }) };
        }
        if (u.includes('textsearch')) {
            const decoded = decodeURIComponent(u).replace(/\+/g, ' ');
            const sosta = /caffè storico|belvedere giardino|libreria bottega/.test(decoded);
            if (sosta) chiamate.push(decoded);
            return { ok: true, json: async () => ({ status: 'OK', results: sosta ? ricerca : POOL }) };
        }
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        throw new Error(`fetch inatteso: ${u}`);
    });
    vi.stubGlobal('fetch', fn);
    const r = await aiRecommendationService.generateItinerary('Cabras', {}, testo, {}, '', CABRAS, { dnaWeights, pathType, ...opts });
    const stops = (r.days || []).flatMap(d => d.stops || []);
    return { r, chiamate, titoli: stops.filter(s => s.title !== 'Tempo libero').map(s => s.title), sosteDna: stops.filter(s => s._tracciato?.dna?.sosta), soste: r._momentReport?.soste };
};

describe('DNA-3c — la ricerca mirata della sosta, nel motore vero', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('food alta, nessun caffè nel pool: la ricerca parte vicino allo spazio libero, la sosta è il caffè trovato; la seconda ricerca (fiducia alta) c\'è perché manca ancora una sosta', async () => {
        const out = await genera({ dnaWeights: { food: 1, _share: 0.45 } });
        expect(out.chiamate).toHaveLength(2); // al massimo due con fiducia alta, mai di più
        expect(out.chiamate[0]).toContain('caffè storico pasticceria gelateria');
        expect(out.chiamate[0]).not.toBe(out.chiamate[1]); // due spazi liberi diversi
        expect(out.sosteDna.map(s => s.title)).toEqual(['Caffè Storico del Corso']);
        expect(out.sosteDna[0].stayMinutes).toBe(20);
        expect(out.soste.ricerca.fatte.length).toBeLessThanOrEqual(2);
        expect(out.soste.ricerca.fatte[0]).toMatchObject({ categoria: 'food', raggioM: 300, trovati: 1, costoMassimoUsd: 0.032 });
    });

    it('i 300 m sono veri: un caffè trovato dalla ricerca ma a 1,5 km dallo spazio libero non diventa una sosta', async () => {
        const lontano = place({ id: 'k8', name: 'Caffè Lontano', km: 2.0, dx: 0, types: ['cafe', 'food'], primary: 'cafe' });
        const out = await genera({ dnaWeights: { food: 1, _share: 0.45 }, ricerca: [lontano] });
        expect(out.sosteDna).toHaveLength(0);
        expect(out.soste.ricerca.fatte[0].trovati).toBe(0);
    });

    it('utente nuovo: nessuna ricerca e nessuna sosta', async () => {
        const out = await genera({ dnaWeights: {} });
        expect(out.chiamate).toHaveLength(0);
        expect(out.sosteDna).toHaveLength(0);
    });

    it('fiducia poca (solo il seme): nessuna ricerca', async () => {
        const out = await genera({ dnaWeights: { food: 1, _share: 0.15 } });
        expect(out.chiamate).toHaveLength(0);
        expect(out.soste.ricerca.motivo).toMatch(/poca/);
    });

    it('fiducia media: una ricerca', async () => {
        const out = await genera({ dnaWeights: { food: 1, _share: 0.25 } });
        expect(out.chiamate).toHaveLength(1);
        expect(out.sosteDna).toHaveLength(1);
    });

    it('food alta + «solo musei»: nessuna ricerca', async () => {
        const out = await genera({
            testo: 'solo musei', dnaWeights: { food: 1, _share: 0.45 },
            intent: { queries: ['musei'], categoria: 'cultura', vincoli: { tempo: null, escludi: [], note: null } },
        });
        expect(out.chiamate).toHaveLength(0);
        expect(out.sosteDna).toHaveLength(0);
    });

    it('la ricerca non porta niente di adatto (o fallisce): il giro è quello di prima, senza errori', async () => {
        const nessuno = await genera({ dnaWeights: { food: 1, _share: 0.45 }, ricerca: [] });
        const base = await genera({ dnaWeights: {} });
        expect(nessuno.chiamate).toHaveLength(2);
        expect(nessuno.sosteDna).toHaveLength(0);
        expect(nessuno.titoli).toEqual(base.titoli);
    });

    it('la stessa ricerca lo stesso giorno non si rifà: cache per città e punto', async () => {
        const w = { food: 1, _share: 0.45 };
        const a = await genera({ dnaWeights: w });
        const b = await genera({ dnaWeights: w });
        expect(a.chiamate).toHaveLength(2);
        expect(b.chiamate).toHaveLength(0);
        expect(b.sosteDna.map(s => s.title)).toEqual(['Caffè Storico del Corso']);
    });

    it('Per Te (giornata: false): nessuna ricerca', async () => {
        const out = await genera({ dnaWeights: { food: 1, _share: 0.45 }, pathType: undefined, opts: { giornata: false } });
        expect(out.chiamate).toHaveLength(0);
    });

    it('«senza ristoranti»/categoria esclusa: nessuna ricerca di cibo', async () => {
        const out = await genera({ testo: 'giro in centro, senza ristoranti', dnaWeights: { food: 1, _share: 0.45 } });
        expect(out.chiamate).toHaveLength(0);
    });
});
