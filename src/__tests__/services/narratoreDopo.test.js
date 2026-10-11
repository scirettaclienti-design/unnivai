// Gate NARRATORE-DOPO — il narratore scrive DOPO che il codice ha fissato
// tappe e orari. IL FATTO QUANDO.
//
// Ordine delle chiamate al proxy per generazione (biglietto 'itinerary', max 3):
//   1) traduttore, solo con testo libero; 2) selettore, solo place_id per
//   momento; 3) scelte (P3d-j), sulle tappe finali gia' riparate, ordinate e
//   con l'orario: il modello sceglie fra opzioni chiuse, il codice scrive.
//
// Luoghi (textsearch) e modello simulati; il mock instrada per CONTENUTO del
// prompt, non per posizione, cosi' l'ordine delle chiamate e' una cosa che il
// test osserva e non una cosa che presuppone. Orologio fisso in ora di Roma.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { romeParts } from '../../lib/tourWindow';
import { sunTimes } from '../../lib/sunTimes';

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
const CHIESA = ['church', 'place_of_worship', 'point_of_interest', 'establishment'];
const RISTO = ['restaurant', 'food', 'point_of_interest', 'establishment'];
const BAR = ['bar', 'point_of_interest', 'establishment'];

const MUSEI = [
    place('Museo di Palazzo Altemps', MUSEO, 0.002, 0.000),
    place('Chiesa di San Luigi dei Francesi', CHIESA, 0.001, 0.002),
    place('Galleria Doria Pamphilj', MUSEO, -0.002, 0.004),
    place('Museo Barracco', MUSEO, -0.001, -0.002),
    place('Chiesa di Sant\'Ivo', CHIESA, 0.000, 0.001),
    place('Museo Napoleonico', MUSEO, 0.003, -0.001),
    place('Chiesa del Gesu\'', CHIESA, -0.002, 0.003),
    place('Galleria Spada', MUSEO, -0.003, -0.003),
];
const TRATTORIE = [
    place('Trattoria Da Enzo', RISTO, -0.010, 0.000),
    place('Osteria der Belli', RISTO, -0.009, -0.002),
    place('Armando al Pantheon', RISTO, 0.000, 0.003),
    place('Da Teo', RISTO, -0.011, 0.001),
    place('Roscioli', RISTO, -0.003, -0.002),
    place('Da Francesco', RISTO, 0.001, -0.004),
    place('Osteria dell\'Ingegno', RISTO, 0.002, 0.004),
    place('Trattoria Monti', RISTO, 0.004, 0.006),
];
const BARS = [
    place('Bar del Fico', BAR, 0.003, -0.003),
    place('Enoteca Il Goccetto', BAR, -0.003, -0.006),
    place('Freni e Frizioni', BAR, -0.008, -0.004),
    place('Il Goccetto Due', BAR, -0.004, -0.005),
];
const TUTTI = [...MUSEI, ...TRATTORIE, ...BARS];
const byName = (n) => TUTTI.find(p => p.name === n);
const PERQUERY = { museo: MUSEI, trattoria: TRATTORIE, enoteca: BARS };

const INTENT_ROMANO = {
    queries: ['museo', 'trattoria', 'enoteca'],
    categoria: 'misto',
    oggetto_umano: 'la Roma dei romani',
    vincoli: { tempo: null, escludi: [], note: null },
};

// Il modello delle scelte risponde per OGNI tappa che riceve (o per quelle
// che `pick` sceglie): solo usaFatto, gancio, interesse — niente testo.
const narratore = ({ gancio = () => 'distanza', pick = () => true } = {}) =>
    (tappeGiorni) => ({
        days: tappeGiorni.map(g => ({
            day: g.giorno,
            title: `Roma da romano, giorno ${g.giorno}`,
            mapMood: 'cibo',
            stops: g.tappe.filter(pick).map(t => ({ place_id: t.place_id, usaFatto: false, gancio: gancio(t, g), interesse: null })),
        })),
    });

const routeFetch = ({ intent = INTENT_ROMANO, perQuery = PERQUERY, selector, narrator = narratore() }) => {
    const stato = { calls: [], selectorBodies: [], narratorInputs: [], narratorBodies: [] };
    const fn = vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const body = JSON.parse(String(init?.body ?? '{}'));
            const sys = String(body.messages?.[0]?.content ?? '');
            const user = String(body.messages?.[1]?.content ?? '');
            let payload;
            if (sys.includes('traduttore di intenti')) {
                stato.calls.push('traduttore');
                payload = intent;
            } else if (sys.includes('SCEGLI soltanto')) {
                stato.calls.push('narratore');
                stato.narratorBodies.push(body);
                const tappe = JSON.parse(user.split('TAPPE:\n')[1]);
                stato.narratorInputs.push(tappe);
                payload = narrator(tappe);
            } else {
                stato.calls.push('selettore');
                stato.selectorBodies.push(body);
                payload = typeof selector === 'function' ? selector(body) : selector;
            }
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }
        if (u.includes('textsearch')) {
            const q = new URL(u, 'http://x').searchParams.get('query');
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

// Il selettore restituisce SOLO place_id e momento: niente testi.
const sel = (pairs) => ({ stops: pairs.map(([name, moment]) => ({ place_id: byName(name).place_id, moment })) });

const GIORNO_1 = [
    ['Chiesa di San Luigi dei Francesi', 'g1-mattina'],
    ['Armando al Pantheon', 'g1-pranzo'],
    ['Galleria Doria Pamphilj', 'g1-pomeriggio'],
    ['Enoteca Il Goccetto', 'g1-aperitivo'],
    ['Da Teo', 'g1-cena'],
];

const LUNEDI_2057 = '2026-10-05T20:57:00+02:00';
const ARTE_CIBO_RILASSATO = { interests: ['Arte', 'Cibo'], pace: 'Rilassato', duration: '1 Giorno' };
const ROMANO = 'Domani voglio vivere Roma da romano';

const genera = (prompt, prefs, opts = {}) => aiRecommendationService.generateItinerary(
    'Roma', prefs, prompt, {}, '', ROMA, { pathType: 'custom', skipUserQuota: true, ...opts },
);

const hhmm = (iso) => {
    const p = romeParts(new Date(iso));
    return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
};
const allStops = (r) => r.days.flatMap(d => d.stops);

describe('Gate NARRATORE-DOPO — le scelte sulle tappe finali, il testo dal codice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(LUNEDI_2057));
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('ordine: traduttore → selettore (solo place_id) → scelte sulle tappe finali, con le opzioni vere', async () => {
        const { fn, stato } = routeFetch({ selector: sel(GIORNO_1) });
        vi.stubGlobal('fetch', fn);

        const result = await genera(ROMANO, ARTE_CIBO_RILASSATO);

        expect(stato.calls).toEqual(['traduttore', 'selettore', 'narratore']);
        const selSys = stato.selectorBodies[0].messages[0].content;
        expect(selSys).not.toContain('"description"');
        expect(selSys).not.toContain('"insiderTip"');

        // Le scelte arrivano sulle tappe FINALI, nell'ordine della giornata.
        const [giorni] = stato.narratorInputs;
        expect(giorni).toHaveLength(1);
        const stops = allStops(result);
        expect(giorni[0].tappe.map(t => t.place_id)).toEqual(stops.map(s => s.place_id));
        giorni[0].tappe.forEach((t, i) => {
            expect(t.nome).toBe(stops[i].title);
            expect(t.momento).toBe(stops[i].moment);
            // "Da Teo" dentro "…da Teo": la preposizione assorbe il "Da" del nome.
            const nomeInFrase = (n) => n.replace(/^Da /, '');
            expect(t.apertura).toContain(nomeInFrase(stops[i].title));
            expect(Array.isArray(t.ganci)).toBe(true);
            expect(t.ganci.every(g => ['tramonto', 'legame', 'distanza', 'prima', 'ultima', 'orario'].includes(g))).toBe(true);
        });
        // La prima tappa del giorno ha "prima", l'ultima "ultima".
        expect(giorni[0].tappe[0].ganci).toContain('prima');
        // (salvo che l'apertura lo dica gia': "Chiudi la giornata a tavola…")
        const ultima = giorni[0].tappe.at(-1);
        if (!/Chiudi la giornata/.test(ultima.apertura)) expect(ultima.ganci).toContain('ultima');
        else expect(ultima.ganci).not.toContain('ultima');
        // Il prompt non chiede testo per le tappe.
        const sys = stato.narratorBodies[0].messages[0].content;
        expect(sys).not.toMatch(/"description"|"insiderTip"|"bestTime"|"transition"/);
        // La frase e' del codice: con il gancio scelto ("distanza") e i minuti veri.
        for (const s of stops.slice(1)) {
            expect(s.description).toContain(s.title.replace(/^Da /, ''));
            if (Number.isFinite(s.travelMinutesFromPrev) && s.travelMinutesFromPrev > 0) {
                expect(s.description).toMatch(new RegExp(`${s.travelMinutesFromPrev} minuti a piedi`));
            }
            expect(s.insiderTip).toBeNull();
            expect(s.transition).toBeNull();
        }
    });

    it('al massimo 3 chiamate al proxy per generazione, stesso biglietto, nessuna riscrittura', async () => {
        const { fn, stato } = routeFetch({ selector: sel(GIORNO_1) });
        vi.stubGlobal('fetch', fn);
        await genera(ROMANO, ARTE_CIBO_RILASSATO);
        expect(stato.calls.length).toBeLessThanOrEqual(3);
        const proxyCalls = fn.mock.calls.filter(([u]) => String(u).includes('openai-proxy'));
        const tickets = new Set(proxyCalls.map(([, init]) => JSON.parse(init.body).dv?.ticket));
        expect(tickets.size).toBe(1);
        expect(proxyCalls.every(([, init]) => JSON.parse(init.body).dv?.kind === 'itinerary')).toBe(true);
    });

    it('le tappe riparate dal codice ricevono la loro frase', async () => {
        const { fn, stato } = routeFetch({
            selector: sel([
                ['Trattoria Da Enzo', 'g1-mattina'],
                ['Osteria der Belli', 'g1-pranzo'],
                ['Da Teo', 'g1-pomeriggio'],
            ]),
        });
        vi.stubGlobal('fetch', fn);
        const result = await genera(ROMANO, ARTE_CIBO_RILASSATO);
        const stops = allStops(result);
        const riparate = stops.filter(s => s.repaired);
        expect(riparate.length).toBeGreaterThan(0);
        for (const s of stops) expect(s.description, `${s.title} (${s.moment})`).toBeTruthy();
        const ricevute = stato.narratorInputs[0].flatMap(g => g.tappe.map(t => t.place_id));
        for (const s of riparate) expect(ricevute).toContain(s.place_id);
    });

    it('"2-3 Giorni" con un selettore che restituisce un solo giorno → 3 giorni completi, tutti con la frase', async () => {
        const { fn, stato } = routeFetch({ selector: sel(GIORNO_1) });
        vi.stubGlobal('fetch', fn);
        const result = await genera(ROMANO, { ...ARTE_CIBO_RILASSATO, duration: '2-3 Giorni' });
        const selSys = stato.selectorBodies[0].messages[0].content;
        for (const g of [1, 2, 3]) expect(selSys).toMatch(new RegExp(`Giorno ${g}[^\\n]*\\b5 tappe`));
        expect(result.days).toHaveLength(3);
        for (const d of result.days) {
            expect(d.stops.map(s => s.moment)).toEqual(['mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'cena']);
            for (const s of d.stops) expect(s.description, `${s.title} (${s.moment})`).toBeTruthy();
        }
        const ids = allStops(result).map(s => s.place_id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(stato.calls).toEqual(['traduttore', 'selettore', 'narratore']);
        expect(stato.narratorInputs[0]).toHaveLength(3);
    });

    it('il modello salta una tappa → la frase c\'e\' lo stesso, con la riserva del codice, e il report lo dice', async () => {
        const saltata = byName('Galleria Doria Pamphilj').place_id;
        const { fn } = routeFetch({ selector: sel(GIORNO_1), narrator: narratore({ pick: (t) => t.place_id !== saltata }) });
        vi.stubGlobal('fetch', fn);
        const result = await genera(ROMANO, ARTE_CIBO_RILASSATO);
        const s = allStops(result).find(x => x.place_id === saltata);
        expect(s.description).toContain('Galleria Doria Pamphilj');
        expect(result._narrationReport.composizione.find(x => x.place_id === saltata).riserva).toEqual(expect.arrayContaining(['usaFatto']));
    });

    it('un gancio non vero (tramonto alle 9:30) → riserva del codice, mai una frase di luce falsa', async () => {
        const { fn } = routeFetch({ selector: sel(GIORNO_1), narrator: narratore({ gancio: () => 'tramonto' }) });
        vi.stubGlobal('fetch', fn);
        const result = await genera(ROMANO, ARTE_CIBO_RILASSATO);
        const mattina = allStops(result).find(s => s.moment === 'mattina');
        expect(mattina.description).not.toMatch(/tramont/);
        expect(result._narrationReport.composizione.find(x => x.place_id === mattina.place_id).riserva).toContain('gancio');
    });

    it('cache: la stessa richiesta in un\'altra DATA non riusa le scelte', async () => {
        const { fn, stato } = routeFetch({ selector: sel(GIORNO_1) });
        vi.stubGlobal('fetch', fn);
        await genera(ROMANO, ARTE_CIBO_RILASSATO);
        vi.setSystemTime(new Date('2026-10-06T20:57:00+02:00'));
        const r2 = await genera(ROMANO, ARTE_CIBO_RILASSATO);
        expect(stato.calls.filter(c => c === 'narratore')).toHaveLength(2);
        expect(r2.days[0].stops[0].scheduledTime.slice(0, 10)).toBe('2026-10-07');
        expect(r2._source).toBe('google-first');
    });

    it('cache: la stessa richiesta in un\'altra FASCIA dello stesso giorno non riusa le scelte', async () => {
        const { fn, stato } = routeFetch({ selector: sel(GIORNO_1.slice(1)) });
        vi.stubGlobal('fetch', fn);
        const prompt = 'Voglio vivere Roma da romano';
        vi.setSystemTime(new Date('2026-10-06T10:00:00+02:00'));
        await genera(prompt, ARTE_CIBO_RILASSATO);
        vi.setSystemTime(new Date('2026-10-06T15:00:00+02:00'));
        await genera(prompt, ARTE_CIBO_RILASSATO);
        expect(stato.calls.filter(c => c === 'narratore')).toHaveLength(2);
        expect(stato.narratorInputs[1][0].tappe[0].momento).not.toBe('mattina');
    });

    it('cache: stessa richiesta, stessa data e fascia → nessuna chiamata, la frase si ricompone uguale', async () => {
        const { fn, stato } = routeFetch({ selector: sel(GIORNO_1) });
        vi.stubGlobal('fetch', fn);
        const r1 = await genera(ROMANO, ARTE_CIBO_RILASSATO);
        vi.setSystemTime(new Date('2026-10-05T21:10:00+02:00'));
        const r2 = await genera(ROMANO, ARTE_CIBO_RILASSATO);
        expect(stato.calls.filter(c => c === 'narratore')).toHaveLength(1);
        expect(allStops(r2).map(s => s.description)).toEqual(allStops(r1).map(s => s.description));
    });
});
