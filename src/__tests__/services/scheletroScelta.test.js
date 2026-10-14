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
// CONTINUITA' — le righe di tempo libero (buchi dichiarati) non sono tappe: la scelta si guarda sulle tappe vere.
const reali = (stops) => stops.filter(s => !s.tempoLibero);

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
        // C10c-piena-2 — varieta' come preferenza: un vuoto lungo puo' prendere una tappa in piu' anche della stessa famiglia
        // (gradino b); lo scheletro resta quello, nell'ordine dei momenti
        expect([...new Set(reali(stops).map(s => s.moment))]).toEqual(['mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'cena']);
        // Ritmo Rilassato: nessuna tappa in piu', i buchi oltre 45 minuti sono righe dichiarate con la loro fascia.
        expect(stops.filter(s => s.tempoLibero).every(s => s.stayMinutes > 45)).toBe(true);
        expect(stops.filter(isFood).length).toBeLessThanOrEqual(2);
        expectInsideMoments(stops, MARTEDI);
        // Ordine cronologico.
        const times = stops.map(s => new Date(s.scheduledTime).getTime());
        expect([...times].sort((a, b) => a - b)).toEqual(times);
        // Il selettore ha ricevuto i momenti, con orario e candidati.
        expect(stato.selectorBody).toContain('g1-mattina');
        expect(stato.selectorBody).toContain('09:30');
        expect(stato.selectorBody).toContain('ESATTAMENTE 1 tappa');
        // Il modello ha rispettato lo scheletro: nessuno scarto per momento,
        // numero o luogo. L'unico cambio e' di strada (C5): l'Enoteca Il
        // Goccetto fa 12 minuti di giro verso la cena da Teo, Freni e Frizioni
        // sta sulla strada.
        expect(result._momentReport.scartate.map(x => [x.place_id, x.motivo.replace(/\d+ min/, 'N min')]))
            .toEqual([[expect.stringContaining('goccetto'), 'fuori strada: N min di giro verso "Da Teo"']]);
        // Ogni altro riempimento e' un ritocco di strada dichiarato (C5).
        const ritocchi = new Set(result._momentReport.ritocchi.map(x => x.messa));
        expect(result._momentReport.riempite.filter(x => !ritocchi.has(x.place_id)).map(x => x.name)).toEqual(['Freni e Frizioni']);
        // C5 — la forma del giro nel tracciato.
        expect(result._momentReport.percorso).toEqual([expect.objectContaining({ tappe: 5, incroci: 0, catene: 0 })]);
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
        // C10c-piena-2 — varieta' come preferenza: un vuoto lungo puo' prendere una tappa in piu' anche della stessa famiglia
        // (gradino b); lo scheletro resta quello, nell'ordine dei momenti
        expect([...new Set(reali(stops).map(s => s.moment))]).toEqual(['mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'cena']);
        expect(stops.filter(isFood).length).toBe(2);
        expect(stops.filter(isFood).map(s => s.moment)).toEqual(['pranzo', 'cena']);
        expectInsideMoments(stops, MARTEDI);
        // Ogni tappa e' un luogo vero dei candidati: mai un luogo inventato.
        const ids = new Set(TUTTI.map(p => p.place_id));
        expect(reali(stops).every(s => ids.has(s.place_id))).toBe(true);
        // I due ristoranti fuori momento; in piu' (C5) l'Osteria der Belli a
        // pranzo, fuori strada rispetto ad Armando al Pantheon.
        expect(result._momentReport.scartate.map(x => x.motivo).filter(m => !m.startsWith('fuori strada')))
            .toEqual(['fuori dal suo momento', 'fuori dal suo momento']);
    });

    it('"ristoranti stasera" → C7: il tema cibo vale per la cena; l\'aperitivo e\' un bar, non un ristorante', async () => {
        vi.setSystemTime(new Date('2026-10-05T17:00:00+02:00'));
        const { fn } = routeFetch({
            intent: { ...INTENT_ROMANO, queries: ['trattoria', 'enoteca'], oggetto_umano: 'ristoranti' },
            perQuery: { trattoria: TRATTORIE, enoteca: BARS },
            // Il modello mette un bar all'aperitivo (giusto) e un ristorante a cena.
            selector: selectorOf([
                stop('Bar del Fico', 'g1-aperitivo'),
                stop('Da Teo', 'g1-cena'),
            ]),
        });
        vi.stubGlobal('fetch', fn);

        const result = await genera('ristoranti stasera', { interests: ['Cibo'] });

        const stops = reali(result.days[0].stops);
        expect(stops.map(s => s.moment)).toEqual(['aperitivo', 'cena']);
        expect(isFood(stops[0])).toBe(false);          // l'aperitivo: un bar
        expect(stops[0].title).toBe('Bar del Fico');
        expect(isFood(stops[1])).toBe(true);           // la cena: un ristorante
        expectInsideMoments(stops, LUNEDI);
    });

    it('C7 — "ristoranti stasera" col modello che mette un RISTORANTE all\'aperitivo: il codice lo scarta, all\'aperitivo va un bar', async () => {
        vi.setSystemTime(new Date('2026-10-05T17:00:00+02:00'));
        const { fn } = routeFetch({
            intent: { ...INTENT_ROMANO, queries: ['trattoria', 'enoteca'], oggetto_umano: 'ristoranti' },
            perQuery: { trattoria: TRATTORIE, enoteca: BARS },
            selector: selectorOf([
                stop('Trattoria Da Enzo', 'g1-aperitivo'),
                stop('Da Teo', 'g1-cena'),
            ]),
        });
        vi.stubGlobal('fetch', fn);

        const result = await genera('ristoranti stasera', { interests: ['Cibo'] });

        const stops = reali(result.days[0].stops);
        const aperitivo = stops.find(s => s.moment === 'aperitivo');
        expect(aperitivo).toBeTruthy();
        expect(isFood(aperitivo)).toBe(false);
        expect(stops.filter(isFood).every(s => s.moment === 'cena')).toBe(true);
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

        const stops = reali(result.days[0].stops);
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
        // C8a — oltre alle 2 ricerche dei momenti veri, una per la passeggiata fra aperitivo e cena
        // (momento facoltativo senza luoghi all'aperto nel pool): il tetto e' 3 in tutto.
        expect(stato.textsearch.length).toBeLessThanOrEqual(PRIMA + 3);
        expect(stato.textsearch.length).toBe(6);
        // C7 — "da romano" e' un tema di vita locale: mattina e pomeriggio cercano esperienze, non cultura generica.
        expect(result._momentReport.ricercheMirate).toEqual(['esperienze', 'nightlife']);
        // C8a — la passeggiata fra aperitivo e cena cerca DOPO la scelta, dalla tappa prima (ricerca mirata C1b)
        expect((result._momentReport.ricercheDopo || []).map(x => x.tema)).toEqual(['romance']);
        // Le ricerche mirate qui non trovano niente: i momenti vuoti sono tolti
        // e il report lo dice — nessun luogo inventato per riempirli.
        expect(reali(result.days[0].stops).map(s => s.moment)).toEqual(['pranzo', 'cena']);
        // Fra pranzo e cena restano ore vuote: una riga di tempo libero, con la sua fascia.
        expect(result.days[0].stops.filter(s => s.tempoLibero)).toHaveLength(1);
        expect(result._momentReport.momentiTolti.map(m => m.momento))
            .toEqual(['g1-mattina', 'g1-pomeriggio', 'g1-aperitivo']);
    });
});
