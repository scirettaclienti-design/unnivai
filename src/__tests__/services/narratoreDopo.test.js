// Gate NARRATORE-DOPO — il narratore scrive DOPO che il codice ha fissato
// tappe e orari. IL FATTO QUANDO.
//
// Ordine delle chiamate al proxy per generazione (biglietto 'itinerary', max 3):
//   1) traduttore, solo con testo libero; 2) selettore, solo place_id per
//   momento; 3) narratore, sulle tappe finali gia' riparate, ordinate e con
//   l'orario.
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

// Il narratore simulato racconta OGNI tappa che riceve (o quelle che `pick`
// sceglie), con il testo di `text`.
const narratore = ({ text = (t) => `Da ${t.nome} si sente il rumore dei passi sul selciato.`, pick = () => true } = {}) =>
    (tappeGiorni) => ({
        days: tappeGiorni.map(g => ({
            day: g.giorno,
            title: `Roma da romano, giorno ${g.giorno}`,
            mapMood: 'cibo',
            stops: g.tappe.filter(pick).map(t => ({
                place_id: t.place_id,
                description: text(t, g),
                insiderTip: null,
                bestTime: null,
                transition: null,
            })),
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
            } else if (sys.includes('SEI IL NARRATORE')) {
                stato.calls.push('narratore');
                stato.narratorBodies.push(body);
                const tappe = JSON.parse(user.split('TAPPE FINALI:\n')[1]);
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

describe('Gate NARRATORE-DOPO — il narratore racconta le tappe finali', () => {
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

    it('ordine: traduttore → selettore (solo place_id) → narratore con nome, categoria, momento, orario, data, alba e tramonto', async () => {
        const { fn, stato } = routeFetch({ selector: sel(GIORNO_1) });
        vi.stubGlobal('fetch', fn);

        const result = await genera(ROMANO, ARTE_CIBO_RILASSATO);

        expect(stato.calls).toEqual(['traduttore', 'selettore', 'narratore']);

        // Il selettore non scrive testi: il suo formato di uscita non li chiede.
        const selSys = stato.selectorBodies[0].messages[0].content;
        expect(selSys).not.toContain('"description"');
        expect(selSys).not.toContain('"insiderTip"');

        // Il narratore riceve le tappe FINALI, con l'orario che il codice ha fissato.
        const [giorni] = stato.narratorInputs;
        expect(giorni).toHaveLength(1);
        const { sunrise, sunset } = sunTimes({ y: 2026, m: 10, d: 6 }, ROMA.latitude, ROMA.longitude);
        expect(giorni[0].data).toBe('2026-10-06');
        expect(giorni[0].alba).toBe(hhmm(sunrise.toISOString()));
        expect(giorni[0].tramonto).toBe(hhmm(sunset.toISOString()));
        const stops = allStops(result);
        expect(giorni[0].tappe.map(t => t.place_id)).toEqual(stops.map(s => s.place_id));
        giorni[0].tappe.forEach((t, i) => {
            expect(t.nome).toBe(stops[i].title);
            expect(t.categoria).toBeTruthy();
            expect(t.momento).toBe(stops[i].momentLabel);
            expect(t.arrivo).toBe(hhmm(stops[i].scheduledTime));
            expect(t.arrivo).toMatch(/^\d\d:\d\d$/);
        });

        // Ogni tappa ha la sua descrizione.
        for (const s of stops) expect(s.description, s.title).toBeTruthy();
    });

    it('al massimo 3 chiamate al proxy per generazione (2 senza testo libero)', async () => {
        const { fn, stato } = routeFetch({ selector: sel(GIORNO_1) });
        vi.stubGlobal('fetch', fn);
        await genera(ROMANO, ARTE_CIBO_RILASSATO);
        expect(stato.calls.length).toBeLessThanOrEqual(3);

        const proxyCalls = fn.mock.calls.filter(([u]) => String(u).includes('openai-proxy'));
        const tickets = new Set(proxyCalls.map(([, init]) => JSON.parse(init.body).dv?.ticket));
        expect(tickets.size).toBe(1);
        expect(proxyCalls.every(([, init]) => JSON.parse(init.body).dv?.kind === 'itinerary')).toBe(true);
    });

    it('le tappe riparate dal codice ricevono la loro descrizione', async () => {
        // Il selettore restituisce 3 ristoranti: il codice ripara la giornata.
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
        // Il narratore le ha ricevute tutte, riparate comprese.
        const ricevute = stato.narratorInputs[0].flatMap(g => g.tappe.map(t => t.place_id));
        for (const s of riparate) expect(ricevute).toContain(s.place_id);
    });

    it('"2-3 Giorni" con un selettore che restituisce un solo giorno → 3 giorni completi, tutti raccontati', async () => {
        const { fn, stato } = routeFetch({ selector: sel(GIORNO_1) });
        vi.stubGlobal('fetch', fn);

        const result = await genera(ROMANO, { ...ARTE_CIBO_RILASSATO, duration: '2-3 Giorni' });

        // Il messaggio al selettore dichiara le tappe di OGNI giorno.
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

    it('una frase "al tramonto" su una tappa del mattino viene tolta dal codice, il resto resta', async () => {
        const { fn } = routeFetch({
            selector: sel(GIORNO_1),
            narrator: narratore({ text: (t) => `Da ${t.nome} il selciato e' liscio. Al tramonto la luce diventa arancione.` }),
        });
        vi.stubGlobal('fetch', fn);

        const result = await genera(ROMANO, ARTE_CIBO_RILASSATO);
        const mattina = allStops(result).find(s => s.moment === 'mattina');
        expect(mattina.description).toBe(`Da ${mattina.title} il selciato e' liscio.`);
        expect(result._narrationReport.frasiTolte.some(f => f.place_id === mattina.place_id)).toBe(true);
    });

    // P3d-e — "mai una descrizione vuota": la tappa saltata riceve la frase
    // sicura del CODICE (tipo, momento, orario), non un testo inventato.
    it('il narratore salta una tappa → resta, con la frase sicura del codice (non testo inventato), e il report lo dice', async () => {
        const saltata = byName('Galleria Doria Pamphilj').place_id;
        const { fn } = routeFetch({
            selector: sel(GIORNO_1),
            narrator: narratore({ pick: (t) => t.place_id !== saltata }),
        });
        vi.stubGlobal('fetch', fn);

        const result = await genera(ROMANO, ARTE_CIBO_RILASSATO);
        const s = allStops(result).find(x => x.place_id === saltata);
        expect(s).toBeTruthy();
        expect(s.title).toBe('Galleria Doria Pamphilj');
        expect(s.type).toBeTruthy();
        expect(s.description).toMatch(/^Galleria, tappa del pomeriggio: arrivo alle \d{2}:\d{2}\.$/);
        expect(s._fraseSicura).toBe(true);
        expect(s.insiderTip ?? null).toBeNull();
        expect(result._narrationReport.nonRaccontate.map(x => x.place_id)).toEqual([saltata]);
    });

    // ─── Gate PAROLE VIETATE ────────────────────────────────────────────
    const TRADIZIONALI = 'Il profumo dei piatti tradizionali riempie la sala. Prova la carbonara.';

    // P3d-e — in generazione "Prova la carbonara." cadrebbe anche per il
    // controllo anti-invenzione (piatto assente dai fatti): qui si prova solo
    // il filtro delle parole, con una seconda frase senza oggetti.
    it('parole vietate: la frase con "tradizionali" viene tolta, resta solo l\'altra', async () => {
        const cena = byName('Da Teo').place_id;
        const { fn } = routeFetch({
            selector: sel(GIORNO_1),
            narrator: narratore({ text: (t) => (t.place_id === cena ? 'Il profumo dei piatti tradizionali riempie la sala. Si arriva a fine passeggiata.' : `Da ${t.nome} il selciato e' liscio.`) }),
        });
        vi.stubGlobal('fetch', fn);

        const result = await genera(ROMANO, ARTE_CIBO_RILASSATO);
        const s = allStops(result).find(x => x.place_id === cena);
        expect(s.description).toBe('Si arriva a fine passeggiata.');
        expect(result._narrationReport.frasiTolte.some(f => f.place_id === cena && f.regole.includes('parola-vietata'))).toBe(true);
    });

    it('parole vietate: vale anche per una tappa letta dalla CACHE', async () => {
        const cena = byName('Da Teo').place_id;
        const { fn, stato } = routeFetch({ selector: sel(GIORNO_1) });
        vi.stubGlobal('fetch', fn);
        await genera(ROMANO, ARTE_CIBO_RILASSATO);

        // Una voce di cache scritta prima del controllo: la frase vietata e' li'.
        const key = Object.keys(window.localStorage).find(k => k.startsWith('unnivai_insiderf10_narratore_'));
        const entry = JSON.parse(window.localStorage.getItem(key));
        for (const d of entry.data.days) for (const st of d.stops) if (st.place_id === cena) {
            st.description = TRADIZIONALI;
            st.insiderTip = 'Un posto tipico. Chiedi il pane.';
            st.bestTime = 'Atmosfera magica.';
        }
        window.localStorage.setItem(key, JSON.stringify(entry));

        const r2 = await genera(ROMANO, ARTE_CIBO_RILASSATO);
        expect(stato.calls.filter(c => c === 'narratore')).toHaveLength(1); // e' davvero un cache HIT
        const s = allStops(r2).find(x => x.place_id === cena);
        expect(s.description).toBe('Prova la carbonara.');
        expect(s.insiderTip).toBe('Chiedi il pane.');
        expect(s.bestTime).toBeNull();
    });

    // P3d-e — mai vuota: al posto del testo tolto, la frase sicura del codice.
    it('parole vietate: descrizione fatta solo di frasi vietate → frase sicura del codice, nessun testo del modello', async () => {
        const cena = byName('Da Teo').place_id;
        const { fn } = routeFetch({
            selector: sel(GIORNO_1),
            narrator: narratore({ text: (t) => (t.place_id === cena ? 'Cucina tradizionale. Un locale magico.' : `Da ${t.nome} il selciato e' liscio.`) }),
        });
        vi.stubGlobal('fetch', fn);

        const result = await genera(ROMANO, ARTE_CIBO_RILASSATO);
        const s = allStops(result).find(x => x.place_id === cena);
        expect(s).toBeTruthy();
        expect(s.description).toMatch(/^Per la cena: ristorante/);
        expect(s.description).not.toMatch(/tradizional|magico/);
        expect(s._fraseSicura).toBe(true);
        expect(result._narrationReport.nonRaccontate.map(x => x.place_id)).toContain(cena);
    });

    it('cache: la stessa richiesta in un\'altra DATA non riusa la narrazione', async () => {
        const { fn, stato } = routeFetch({ selector: sel(GIORNO_1) });
        vi.stubGlobal('fetch', fn);

        await genera(ROMANO, ARTE_CIBO_RILASSATO);                 // lunedi': "domani" = martedi' 6
        vi.setSystemTime(new Date('2026-10-06T20:57:00+02:00'));
        const r2 = await genera(ROMANO, ARTE_CIBO_RILASSATO);      // martedi': "domani" = mercoledi' 7

        expect(stato.calls.filter(c => c === 'narratore')).toHaveLength(2);
        expect(stato.narratorInputs[1][0].data).toBe('2026-10-07');
        expect(r2._source).toBe('google-first');
    });

    it('cache: la stessa richiesta in un\'altra FASCIA dello stesso giorno non riusa la narrazione', async () => {
        const { fn, stato } = routeFetch({ selector: sel(GIORNO_1.slice(1)) });
        vi.stubGlobal('fetch', fn);
        const prompt = 'Voglio vivere Roma da romano';

        vi.setSystemTime(new Date('2026-10-06T10:00:00+02:00'));   // mattina
        await genera(prompt, ARTE_CIBO_RILASSATO);
        vi.setSystemTime(new Date('2026-10-06T15:00:00+02:00'));   // pomeriggio
        await genera(prompt, ARTE_CIBO_RILASSATO);

        expect(stato.calls.filter(c => c === 'narratore')).toHaveLength(2);
        expect(stato.narratorInputs[1][0].tappe[0].momento).not.toBe('Mattina');
    });

    it('cache: stessa richiesta, stessa data e stessa fascia → la narrazione si riusa (nessuna chiamata)', async () => {
        const { fn, stato } = routeFetch({ selector: sel(GIORNO_1) });
        vi.stubGlobal('fetch', fn);
        await genera(ROMANO, ARTE_CIBO_RILASSATO);
        vi.setSystemTime(new Date('2026-10-05T21:10:00+02:00'));
        await genera(ROMANO, ARTE_CIBO_RILASSATO);
        expect(stato.calls.filter(c => c === 'narratore')).toHaveLength(1);
    });
});
