// P3 — la scelta dei luoghi segue lo scheletro della giornata. IL FATTO QUANDO.
//
// Luoghi (textsearch) e modello (traduttore + selettore) simulati; orologio
// fisso in ora di ROMA esplicita (la CI gira in UTC).
//
// Il caso "il modello restituisce 3 ristoranti" e' il rosso riprodotto sul
// codice di prima di P3: li' il tour usciva con 3 ristoranti e nessun momento.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { MOMENT_BY_KEY } from '../../lib/dayMoments';
import { romeDate } from '../../lib/tourWindow';

const ROMA = { latitude: 41.8986, longitude: 12.4769, isSmallTown: false, radiusKm: 10 };

let seq = 0;
const place = (name, types, dLat, dLng) => ({
    place_id: `pid-${++seq}-${name.replace(/\W+/g, '-').toLowerCase()}`,
    name,
    geometry: { location: { lat: ROMA.latitude + dLat, lng: ROMA.longitude + dLng } },
    rating: 4.6,
    user_ratings_total: 400,
    business_status: 'OPERATIONAL',
    types,
});
const MUSEO = ['museum', 'tourist_attraction', 'point_of_interest', 'establishment'];
const CHIESA = ['church', 'place_of_worship', 'tourist_attraction', 'point_of_interest', 'establishment'];
const RISTO = ['restaurant', 'food', 'point_of_interest', 'establishment'];
const BAR = ['bar', 'point_of_interest', 'establishment'];

const MUSEI = [
    place('Museo di Palazzo Altemps', MUSEO, 0.002, 0.000),
    place('Chiesa di San Luigi dei Francesi', CHIESA, 0.001, 0.002),
    place('Galleria Doria Pamphilj', MUSEO, -0.002, 0.004),
    place('Museo Barracco', MUSEO, -0.001, -0.002),
];
const TRATTORIE = [
    place('Trattoria Da Enzo', RISTO, -0.010, 0.000),
    place('Osteria der Belli', RISTO, -0.009, -0.002),
    place('Armando al Pantheon', RISTO, 0.000, 0.003),
    place('Da Teo', RISTO, -0.011, 0.001),
];
const BARS = [
    place('Bar del Fico', BAR, 0.003, -0.003),
    place('Enoteca Il Goccetto', BAR, -0.003, -0.006),
    place('Freni e Frizioni', BAR, -0.008, -0.004),
];
const TUTTI = [...MUSEI, ...TRATTORIE, ...BARS];
const byName = (n) => TUTTI.find(p => p.name === n);

const INTENT_ROMANO = {
    queries: ['museo', 'trattoria', 'enoteca'],
    categoria: 'misto',
    oggetto_umano: 'la Roma dei romani',
    vincoli: { tempo: null, escludi: [], note: null },
};

// Instradamento: 1ª chiamata al proxy OpenAI = traduttore, 2ª = selettore.
// La textsearch risponde solo alle query note: tutto il resto e' ZERO_RESULTS.
const routeFetch = ({ intent, perQuery, selector }) => {
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
            const hit = Object.keys(perQuery).find(k => q === `${k} Roma`);
            return hit
                ? { ok: true, json: async () => ({ status: 'OK', results: perQuery[hit] }) }
                : { ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) };
        }
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        throw new Error(`fetch inatteso: ${u}`);
    });
    return { fn, stato };
};

const stop = (name, moment) => ({
    place_id: byName(name).place_id,
    ...(moment ? { moment } : {}),
    description: `Dentro ${name} il rumore della strada si spegne`,
});
const selectorOf = (stops) => ({ days: [{ day: 1, title: 'Roma da romano', stops }] });

const LUNEDI_2057 = '2026-10-05T20:57:00+02:00';
const MARTEDI = { y: 2026, m: 10, d: 6 };
const LUNEDI = { y: 2026, m: 10, d: 5 };

const genera = (prompt, prefs) => aiRecommendationService.generateItinerary(
    'Roma', prefs, prompt, {}, '', ROMA, { pathType: 'custom', skipUserQuota: true },
);

// Ogni orario dentro il suo momento: [inizio, fine).
const expectInsideMoments = (stops, day) => {
    for (const s of stops) {
        const m = MOMENT_BY_KEY[s.moment];
        const t = new Date(s.scheduledTime).getTime();
        expect(t, `${s.title} @${s.moment}`).toBeGreaterThanOrEqual(romeDate(day, m.start).getTime());
        expect(t, `${s.title} @${s.moment}`).toBeLessThan(romeDate(day, m.end).getTime());
    }
};
const isFood = (s) => (s.types || []).includes('restaurant');

describe('P3 — la scelta segue lo scheletro della giornata', () => {
    beforeEach(() => {
        // NON resetAllMocks/restoreAllMocks: azzerano i mock globali di setup.js.
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(LUNEDI_2057));
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    const PERQUERY_ROMANO = { museo: MUSEI, trattoria: TRATTORIE, enoteca: BARS };
    const ARTE_CIBO_RILASSATO = { interests: ['Arte', 'Cibo'], pace: 'Rilassato', duration: '1 Giorno' };

    it('"Domani voglio vivere Roma da romano", Arte+Cibo, Rilassato → mattina, pranzo, pomeriggio, aperitivo, cena', async () => {
        const { fn, stato } = routeFetch({
            intent: INTENT_ROMANO,
            perQuery: PERQUERY_ROMANO,
            selector: selectorOf([
                stop('Chiesa di San Luigi dei Francesi', 'g1-mattina'),
                stop('Armando al Pantheon', 'g1-pranzo'),
                stop('Galleria Doria Pamphilj', 'g1-pomeriggio'),
                stop('Enoteca Il Goccetto', 'g1-aperitivo'),
                stop('Da Teo', 'g1-cena'),
            ]),
        });
        vi.stubGlobal('fetch', fn);

        const result = await genera('Domani voglio vivere Roma da romano', ARTE_CIBO_RILASSATO);

        expect(result._source).toBe('google-first');
        const stops = result.days[0].stops;
        expect(stops.map(s => s.moment)).toEqual(['mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'cena']);
        expect(stops.filter(isFood).length).toBeLessThanOrEqual(2);
        expectInsideMoments(stops, MARTEDI);
        // Ordine cronologico.
        const times = stops.map(s => new Date(s.scheduledTime).getTime());
        expect([...times].sort((a, b) => a - b)).toEqual(times);
        // Il selettore ha ricevuto i momenti, con orario e candidati.
        expect(stato.selectorBody).toContain('g1-mattina');
        expect(stato.selectorBody).toContain('09:30');
        expect(stato.selectorBody).toContain('ESATTAMENTE 1 tappa');
        // Nessuna riparazione: il modello ha rispettato lo scheletro.
        expect(result._momentReport.riempite).toEqual([]);
    });

    it('il modello restituisce 3 ristoranti → il codice ripara e lo scheletro viene rispettato', async () => {
        const { fn } = routeFetch({
            intent: INTENT_ROMANO,
            perQuery: PERQUERY_ROMANO,
            selector: selectorOf([
                stop('Trattoria Da Enzo', 'g1-mattina'),      // fuori momento
                stop('Osteria der Belli', 'g1-pranzo'),
                stop('Armando al Pantheon', 'g1-pomeriggio'), // fuori momento
            ]),
        });
        vi.stubGlobal('fetch', fn);

        const result = await genera('Domani voglio vivere Roma da romano', ARTE_CIBO_RILASSATO);

        expect(result._source).toBe('google-first');
        const stops = result.days[0].stops;
        expect(stops.map(s => s.moment)).toEqual(['mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'cena']);
        expect(stops.filter(isFood).length).toBe(2);
        expect(stops.filter(isFood).map(s => s.moment)).toEqual(['pranzo', 'cena']);
        expectInsideMoments(stops, MARTEDI);
        // Ogni tappa e' un luogo vero dei candidati: mai un luogo inventato.
        const ids = new Set(TUTTI.map(p => p.place_id));
        expect(stops.every(s => ids.has(s.place_id))).toBe(true);
        expect(result._momentReport.scartate.map(x => x.motivo))
            .toEqual(['fuori dal suo momento', 'fuori dal suo momento']);
    });

    it('"ristoranti stasera" → solo cibo', async () => {
        vi.setSystemTime(new Date('2026-10-05T17:00:00+02:00'));
        const { fn } = routeFetch({
            intent: { ...INTENT_ROMANO, queries: ['trattoria', 'enoteca'], oggetto_umano: 'ristoranti' },
            perQuery: { trattoria: TRATTORIE, enoteca: BARS },
            // Il modello prova a mettere un bar all'aperitivo: non e' cibo.
            selector: selectorOf([
                stop('Bar del Fico', 'g1-aperitivo'),
                stop('Da Teo', 'g1-cena'),
            ]),
        });
        vi.stubGlobal('fetch', fn);

        const result = await genera('ristoranti stasera', { interests: ['Cibo'] });

        const stops = result.days[0].stops;
        expect(stops.length).toBeGreaterThan(0);
        expect(stops.every(isFood)).toBe(true);
        expect(stops.map(s => s.moment)).toEqual(['aperitivo', 'cena']);
        expectInsideMoments(stops, LUNEDI);
    });

    it('Intenso → mai 2 pranzi ne\' 2 cene', async () => {
        const { fn } = routeFetch({
            intent: INTENT_ROMANO,
            perQuery: PERQUERY_ROMANO,
            selector: selectorOf([
                stop('Trattoria Da Enzo', 'g1-pranzo'),
                stop('Osteria der Belli', 'g1-pranzo'),
                stop('Armando al Pantheon', 'g1-cena'),
                stop('Da Teo', 'g1-cena'),
            ]),
        });
        vi.stubGlobal('fetch', fn);

        const result = await genera('Domani voglio vivere Roma da romano',
            { interests: ['Arte', 'Cibo'], pace: 'Intenso', duration: '1 Giorno' });

        const stops = result.days[0].stops;
        expect(stops.filter(s => s.moment === 'pranzo')).toHaveLength(1);
        expect(stops.filter(s => s.moment === 'cena')).toHaveLength(1);
        expect(stops.filter(isFood)).toHaveLength(2);
        expectInsideMoments(stops, MARTEDI);
    });

    it('chiamate Places per generazione ≤ quelle di prima + 2', async () => {
        // Prima di P3 una generazione del Percorso A faceva UNA textsearch per
        // query del traduttore (al massimo 3; misurato: 3 con questa frase).
        // Qui tre query di solo cibo: mattina, pomeriggio e aperitivo restano
        // vuoti e servono ricerche mirate — al massimo 2.
        const { fn, stato } = routeFetch({
            intent: { ...INTENT_ROMANO, queries: ['trattoria', 'osteria', 'pizzeria'] },
            perQuery: { trattoria: TRATTORIE.slice(0, 2), osteria: TRATTORIE.slice(2), pizzeria: [] },
            selector: selectorOf([stop('Trattoria Da Enzo', 'g1-pranzo'), stop('Da Teo', 'g1-cena')]),
        });
        vi.stubGlobal('fetch', fn);

        const result = await genera('Domani voglio vivere Roma da romano', ARTE_CIBO_RILASSATO);

        const PRIMA = 3;
        expect(stato.textsearch.length).toBeLessThanOrEqual(PRIMA + 2);
        expect(stato.textsearch.length).toBe(5);
        expect(result._momentReport.ricercheMirate).toEqual(['cultura', 'nightlife']);
        // Le ricerche mirate qui non trovano niente: i momenti vuoti sono tolti
        // e il report lo dice — nessun luogo inventato per riempirli.
        expect(result.days[0].stops.map(s => s.moment)).toEqual(['pranzo', 'cena']);
        expect(result._momentReport.momentiTolti.map(m => m.momento))
            .toEqual(['g1-mattina', 'g1-pomeriggio', 'g1-aperitivo']);
    });
});
