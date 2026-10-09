// P3d-c — Riscrivere invece di cancellare.
//
// Dopo i filtri della voce (parole vietate, aperture dei sensi, luce/ora) le
// descrizioni svuotate o accorciate vanno al modello in UNA sola chiamata, con
// il motivo di ognuna ("hai usato "magico""), dentro lo stesso biglietto della
// generazione. Il testo nuovo ripassa dagli stessi filtri; se non passa, il
// campo resta vuoto. Mai un secondo giro. In "Per Te" la tappa non si perde.
//
// Rosso sul codice di prima: nessuna chiamata di riscrittura, la descrizione
// restava vuota e in "Per Te" la tappa usciva; "l'unica panchina all'ombra" e
// "Consiglio: entra dal lato" venivano tolte; "ogni angolo racconta una storia"
// passava.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { filterBannedWords } from '../../lib/narrationLight';

const ROMA = { latitude: 41.8986, longitude: 12.4769, isSmallTown: false, radiusKm: 10 };
let seq = 0;
const place = (name, types, dLat, dLng) => ({
    place_id: `pv-${++seq}-${name.replace(/\W+/g, '-').toLowerCase()}`,
    name,
    geometry: { location: { lat: ROMA.latitude + dLat, lng: ROMA.longitude + dLng } },
    rating: 4.6, user_ratings_total: 400, business_status: 'OPERATIONAL', types,
});
const MUSEO = ['museum', 'tourist_attraction', 'point_of_interest', 'establishment'];
const RISTO = ['restaurant', 'food', 'point_of_interest', 'establishment'];
const BAR = ['bar', 'point_of_interest', 'establishment'];

const LIBERAZIONE = place('Museo Storico della Liberazione', MUSEO, 0.002, 0.000);
const MUSEI = [LIBERAZIONE, place('Galleria Doria Pamphilj', MUSEO, -0.002, 0.004), place('Museo Barracco', MUSEO, -0.001, -0.002)];
const TRATTORIE = [place('Armando al Pantheon', RISTO, 0.000, 0.003), place('Da Teo', RISTO, -0.011, 0.001)];
const BARS = [place('Enoteca Il Goccetto', BAR, -0.003, -0.006)];
const PERQUERY = { museo: MUSEI, trattoria: TRATTORIE, enoteca: BARS };
const INTENT = { queries: ['museo', 'trattoria', 'enoteca'], categoria: 'misto', oggetto_umano: 'la Roma dei romani', vincoli: { tempo: null, escludi: [], note: null } };

const SELECTOR = { stops: [
    { place_id: LIBERAZIONE.place_id, moment: 'g1-mattina' },
    { place_id: TRATTORIE[0].place_id, moment: 'g1-pranzo' },
    { place_id: MUSEI[1].place_id, moment: 'g1-pomeriggio' },
    { place_id: BARS[0].place_id, moment: 'g1-aperitivo' },
    { place_id: TRATTORIE[1].place_id, moment: 'g1-cena' },
] };


let calls;      // [{ kind, body }]
let rewriteFn;  // (tappe) => payload
const routeFetch = (narrate) => vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes('openai-proxy')) {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const sys = String(body.messages?.[0]?.content ?? '');
        const user = String(body.messages?.[1]?.content ?? '');
        let payload; let kind;
        if (sys.includes('traduttore di intenti')) { kind = 'traduttore'; payload = INTENT; }
        else if (sys.includes('SEI IL NARRATORE')) {
            kind = 'narratore';
            const giorni = JSON.parse(user.split('TAPPE FINALI:\n')[1]);
            payload = { days: giorni.map(g => ({ day: g.giorno, title: 'G', stops: g.tappe.map(narrate) })) };
        } else if (sys.includes('Riscrivi SOLO il campo description')) {
            kind = 'riscrittura';
            const tappe = JSON.parse(user.split('TAPPE:\n')[1]);
            if (rewriteFn === 'errore') return { ok: false, status: 502, json: async () => ({ code: 'OPENAI_ERROR', error: 'x' }) };
            payload = rewriteFn(tappe);
        } else { kind = 'selettore'; payload = SELECTOR; }
        calls.push({ kind, body, user });
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }], usage: { total_tokens: 100 } }) };
    }
    if (u.includes('textsearch')) {
        const q = new URL(u, 'http://x').searchParams.get('query');
        const hit = Object.keys(PERQUERY).find(k => q === `${k} Roma`);
        return { ok: true, json: async () => (hit ? { status: 'OK', results: PERQUERY[hit] } : { status: 'ZERO_RESULTS', results: [] }) };
    }
    if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
    throw new Error(`fetch inatteso: ${u}`);
});

const genera = () => aiRecommendationService.generateItinerary(
    'Roma', { interests: ['Arte', 'Cibo'], pace: 'Rilassato', duration: '1 Giorno' },
    'Domani voglio vivere Roma da romano', {}, '', ROMA, { pathType: 'custom', skipUserQuota: true },
);
const allStops = (r) => r.days.flatMap(d => d.stops);
const kinds = () => calls.map(c => c.kind);
// P3d-e — testi senza oggetti concreti (cortile, scale…): qui si prova la
// riscrittura P3d-c, non il controllo anti-invenzione (fattiAncorati.test.js).
const BUONA = 'La facciata si vede intera solo dal lato opposto della strada.';
const PULITA = 'La pietra della facciata è chiara.';
const MAGICA = 'Il belvedere regala una vista che appare magica.';

describe('P3d-c — elenco: via i falsi positivi, dentro le frasi generiche', () => {
    it('le frasi buone restano', () => {
        for (const f of ["C'è l'unica panchina all'ombra di tutta la piazza.", 'Consiglio: entra dal lato del giardino.',
            "Esci presto per non perdere l'ultimo autobus.", 'Lì sotto una scoperta archeologica del 1938.', 'Si gusta in piedi al bancone.']) {
            expect(filterBannedWords(f).text, f).toBe(f);
        }
    });

    it('restano vietate le forme da brochure', () => {
        for (const f of ["Un'esperienza unica.", 'Un piatto da non perdere.', 'Assapora la carbonara.']) {
            expect(filterBannedWords(f).text, f).toBeNull();
        }
    });

    it('le frasi generiche vengono tolte', () => {
        for (const f of ['Osserva le statue, ogni angolo racconta una storia.', 'Le pareti raccontano storie di epoche passate.',
            'Le stanze sembrano raccontare storie.', 'Ogni sala è un viaggio nel tempo.', 'Goditi la vista dalla scalinata.',
            'Sentire la crosta sotto le dita è un’esperienza.', 'I dettagli barocchi raccontano molto.']) {
            expect(filterBannedWords(f).text, f).toBeNull();
        }
    });
});

describe('P3d-c — itinerario: riscrivere invece di cancellare', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        calls = [];
        rewriteFn = (tappe) => ({ stops: tappe.map(t => ({ place_id: t.place_id, description: BUONA })) });
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-05T20:57:00+02:00'));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('descrizione svuotata → parte UNA riscrittura con il motivo; riscrittura buona → campo pieno', async () => {
        vi.stubGlobal('fetch', routeFetch((t) => ({
            place_id: t.place_id, description: t.place_id === LIBERAZIONE.place_id ? MAGICA : PULITA,
        })));
        const r = await genera();

        expect(kinds()).toEqual(['traduttore', 'selettore', 'narratore', 'riscrittura']);
        const rw = calls.find(c => c.kind === 'riscrittura');
        const tappe = JSON.parse(rw.user.split('TAPPE:\n')[1]);
        expect(tappe.map(t => t.place_id)).toEqual([LIBERAZIONE.place_id]); // solo la tappa svuotata
        expect(tappe[0].tolto).toEqual([{ frase: MAGICA, motivo: 'hai usato "magico"' }]);
        // regola "perché qui" ed esempi GIUSTO/SBAGLIATO nel prompt di riscrittura
        const sys = rw.body.messages[0].content;
        expect(sys).toContain('PERCHÉ QUI');
        expect(sys).toContain('GIUSTO: "Per il pranzo: trattoria, fascia €€, a 6 minuti dalla tappa prima."');
        expect(sys).toContain('SBAGLIATO: "Il profumo della pasta fresca riempie l\'aria."');
        // stesso biglietto della generazione
        const tickets = new Set(calls.map(c => c.body.dv?.ticket));
        expect(tickets.size).toBe(1);
        expect(calls[0].body.dv.kind).toBe('itinerary');

        const lib = allStops(r).find(s => s.place_id === LIBERAZIONE.place_id);
        expect(lib.description).toBe(BUONA);
        expect(r._narrationReport.nonRaccontate).toEqual([]);
        expect(r._narrationReport.riscrittura).toMatchObject({ richieste: 1, riscritte: 1, ancoraVuote: [] });
    });

    // P3d-e — mai vuota: dopo l'unica riscrittura fallita, la frase sicura del codice.
    it('riscrittura ancora vietata → frase sicura del codice e nessun secondo giro', async () => {
        rewriteFn = (tappe) => ({ stops: tappe.map(t => ({ place_id: t.place_id, description: 'Un posto magico, da non perdere.' })) });
        vi.stubGlobal('fetch', routeFetch((t) => ({
            place_id: t.place_id, description: t.place_id === LIBERAZIONE.place_id ? MAGICA : PULITA,
        })));
        const r = await genera();
        expect(kinds().filter(k => k === 'riscrittura')).toHaveLength(1);
        const lib = allStops(r).find(s => s.place_id === LIBERAZIONE.place_id);
        expect(lib.description).toMatch(/^Museo, tappa della mattina: arrivo alle \d{2}:\d{2}\.$/);
        expect(lib._fraseSicura).toBe(true);
        expect(r._narrationReport.riscrittura.riscritte).toBe(0);
        expect(r._narrationReport.riscrittura.scartate[0].motivo).toContain('"magico"');
    });

    it('"ogni angolo racconta una storia" → tolta e riscritta', async () => {
        vi.stubGlobal('fetch', routeFetch((t) => ({
            place_id: t.place_id,
            description: t.place_id === LIBERAZIONE.place_id ? 'Osserva le statue, ogni angolo racconta una storia.' : PULITA,
        })));
        const r = await genera();
        const rw = calls.find(c => c.kind === 'riscrittura');
        const tappe = JSON.parse(rw.user.split('TAPPE:\n')[1]);
        expect(tappe[0].tolto[0].motivo).toBe('hai usato "racconta una storia", "ogni angolo"');
        expect(allStops(r).find(s => s.place_id === LIBERAZIONE.place_id).description).toBe(BUONA);
    });

    it('una frase sola tolta da una descrizione lunga → si riscrive; se la riscrittura fallisce resta il resto', async () => {
        rewriteFn = () => ({ stops: [] });
        vi.stubGlobal('fetch', routeFetch((t) => ({
            place_id: t.place_id,
            description: t.place_id === LIBERAZIONE.place_id ? `${MAGICA} ${PULITA}` : PULITA,
        })));
        const r = await genera();
        expect(kinds()).toContain('riscrittura');
        expect(allStops(r).find(s => s.place_id === LIBERAZIONE.place_id).description).toBe(PULITA);
    });

    it('niente da riscrivere → nessuna chiamata in più', async () => {
        vi.stubGlobal('fetch', routeFetch((t) => ({ place_id: t.place_id, description: PULITA })));
        const r = await genera();
        expect(kinds()).toEqual(['traduttore', 'selettore', 'narratore']);
        expect(r._narrationReport.riscrittura).toBeNull();
    });

    it('riscrittura che fallisce (motore giù) → il tour esce lo stesso, con la frase sicura', async () => {
        rewriteFn = 'errore';
        vi.stubGlobal('fetch', routeFetch((t) => ({
            place_id: t.place_id, description: t.place_id === LIBERAZIONE.place_id ? MAGICA : PULITA,
        })));
        const r = await genera();
        expect(r._source).toBe('google-first');
        expect(allStops(r).find(s => s.place_id === LIBERAZIONE.place_id)._fraseSicura).toBe(true);
        expect(r._narrationReport.riscrittura.errore).toBe('AI_ENGINE_DOWN');
    });

    it('la riscrittura ripassa anche dal filtro di luce/ora', async () => {
        rewriteFn = (tappe) => ({ stops: tappe.map(t => ({ place_id: t.place_id, description: 'Vieni qui per le stelle.' })) });
        vi.stubGlobal('fetch', routeFetch((t) => ({
            place_id: t.place_id, description: t.place_id === LIBERAZIONE.place_id ? MAGICA : PULITA,
        })));
        const r = await genera(); // Liberazione: mattina → "stelle" e' incoerente
        const lib = allStops(r).find(s => s.place_id === LIBERAZIONE.place_id);
        expect(lib.description).not.toContain('stelle');
        expect(lib._fraseSicura).toBe(true);
    });
});

describe('P3d-c — "Per Te": la tappa non si perde', () => {
    const CITY = 'Ippocampo';
    const CENTER = { latitude: 41.6489, longitude: 15.9012 };
    const POOL = {
        cultura: [
            { place_id: 'pid-uno', name: 'Torre Capitania', latitude: CENTER.latitude, longitude: CENTER.longitude, rating: 4.6, type: 'museum', types: ['museum'], city: CITY },
            { place_id: 'pid-due', name: 'Museo del Sale', latitude: CENTER.latitude + 0.001, longitude: CENTER.longitude, rating: 4.4, type: 'museum', types: ['museum'], city: CITY },
            // P7a — sotto le 3 tappe un tour "Per Te" non si serve: due tappe
            // pulite in piu' (EXTRA), che non chiedono riscrittura.
            { place_id: 'pid-tre', name: 'Chiesa Madre', latitude: CENTER.latitude + 0.002, longitude: CENTER.longitude, rating: 4.5, type: 'church', types: ['church'], city: CITY },
            { place_id: 'pid-quattro', name: 'Porta Marina', latitude: CENTER.latitude + 0.003, longitude: CENTER.longitude, rating: 4.3, type: 'monument', types: ['tourist_attraction'], city: CITY },
        ],
    };
    const EXTRA = [
        { place_id: 'pid-tre', description: 'Sul sagrato si vendono le reti la domenica.' },
        { place_id: 'pid-quattro', description: 'La porta guarda il molo dei pescatori.' },
    ];
    let homeCalls;
    const homeFetch = (tourPayload, rewrite) => vi.fn(async (url, init) => {
        if (!String(url).includes('openai-proxy')) throw new Error(`fetch inatteso: ${url}`);
        const body = JSON.parse(String(init?.body ?? '{}'));
        const sys = String(body.messages?.[0]?.content ?? '');
        const isRw = sys.includes('Riscrivi SOLO il campo description');
        homeCalls.push({ kind: isRw ? 'riscrittura' : 'tour', body });
        const payload = isRw ? rewrite(JSON.parse(String(body.messages[1].content).split('TAPPE:\n')[1])) : tourPayload;
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
    });
    const tour = (stops) => ({ tours: [{ themeType: 'cultura', title: 'Cultura a Ippocampo', stops: [...stops, ...EXTRA] }] });
    const home = () => aiRecommendationService.generateHomeTours({ city: CITY, cityCenter: CENTER, themedCandidates: POOL, opts: { skipUserQuota: true } });

    beforeEach(() => {
        vi.clearAllMocks();
        homeCalls = [];
        try { window.localStorage.clear(); } catch { /* jsdom */ }
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('descrizione svuotata → riscritta, la tappa resta; stesso biglietto "home_tours", 2 chiamate', async () => {
        vi.stubGlobal('fetch', homeFetch(tour([
            { place_id: 'pid-uno', description: 'Osserva le statue, ogni angolo racconta una storia.' },
            { place_id: 'pid-due', description: 'Le vasche hanno bordi bianchi.' },
        ]), (tappe) => ({ stops: tappe.map(t => ({ place_id: t.place_id, description: 'Dai merli si vede la salina intera.' })) })));
        const res = await home();
        expect(homeCalls.map(c => c.kind)).toEqual(['tour', 'riscrittura']);
        expect(new Set(homeCalls.map(c => c.body.dv?.ticket)).size).toBe(1);
        expect(homeCalls[0].body.dv.kind).toBe('home_tours');
        const stops = res.tours[0].stops;
        expect(stops.map(s => s.place_id).sort()).toEqual(['pid-due', 'pid-quattro', 'pid-tre', 'pid-uno']);
        expect(stops.find(s => s.place_id === 'pid-uno').description).toBe('Dai merli si vede la salina intera.');
        expect(res._report.scarti).toEqual([]);
        // P3d-g — tutte e 4 le tappe vanno alla riscrittura ancorata (nessuna ha fatti).
        expect(res._report.riscrittura).toMatchObject({ richieste: 4, riscritte: 4 });
    });

    // P3d-e — la tappa non esce piu': mai una descrizione vuota, frase sicura.
    it('riscrittura ancora vietata → la tappa resta con la frase sicura, nessun secondo giro', async () => {
        vi.stubGlobal('fetch', homeFetch(tour([
            { place_id: 'pid-uno', description: 'Un posto magico.' },
            { place_id: 'pid-due', description: 'Le vasche hanno bordi bianchi.' },
        ]), (tappe) => ({ stops: tappe.map(t => ({ place_id: t.place_id, description: "Un'esperienza unica." })) })));
        const res = await home();
        expect(homeCalls.filter(c => c.kind === 'riscrittura')).toHaveLength(1);
        expect(res.tours[0].stops.map(s => s.place_id).sort()).toEqual(['pid-due', 'pid-quattro', 'pid-tre', 'pid-uno']);
        const uno = res.tours[0].stops.find(s => s.place_id === 'pid-uno');
        expect(uno._fraseSicura).toBe(true);
        expect(uno.description).toMatch(/^Museo, tappa d/);
        expect(res._report.scarti).toEqual([]);
        // P3d-g — tutte senza fatti, tutte riscritte male → tutte frase sicura.
        expect(res._report.frasiSicure.map(x => x.title).sort()).toEqual(['Chiesa Madre', 'Museo del Sale', 'Porta Marina', 'Torre Capitania']);
    });
});
