// P3d-j — Il modello sceglie, il codice scrive: il flusso nel servizio.
//
// Itinerario: la terza chiamata riceve le opzioni vere e restituisce solo
// scelte; ogni descrizione e' composta dal codice. "Per Te": una chiamata sola.
// (7) Niente meteo di riserva; nessun "null"/"undefined"/vuoto a schermo.

import { titoloDaTappe } from '../../lib/titoliGiro';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { testoPulito } from '../../lib/stopPhrases';

const ROMA = { latitude: 41.8986, longitude: 12.4769, isSmallTown: false, radiusKm: 10 };
let seq = 0;
const place = (name, types, dLat, dLng) => ({
    place_id: `nc-${++seq}`, name,
    geometry: { location: { lat: ROMA.latitude + dLat, lng: ROMA.longitude + dLng } },
    rating: 4.6, user_ratings_total: 400, business_status: 'OPERATIONAL', types,
});
const MUSEO = ['museum', 'tourist_attraction', 'point_of_interest', 'establishment'];
const RISTO = ['restaurant', 'food', 'point_of_interest', 'establishment'];
const BAR = ['bar', 'point_of_interest', 'establishment'];
const MUSEI = [place('Museo Barracco', MUSEO, -0.001, -0.002), place('Galleria Spada', MUSEO, -0.003, -0.003), place('Museo Napoleonico', MUSEO, 0.003, -0.001)];
const TRATTORIE = [place('Trattoria Da Enzo', RISTO, -0.002, 0.000), place('Osteria der Belli', RISTO, -0.003, -0.002)];
const BARS = [place('Enoteca Il Goccetto', BAR, -0.003, -0.004)];
const PERQUERY = { museo: MUSEI, trattoria: TRATTORIE, enoteca: BARS };
const INTENT = { queries: ['museo', 'trattoria', 'enoteca'], categoria: 'misto', oggetto_umano: 'la Roma dei romani', vincoli: { tempo: null, escludi: [], note: null } };
const SELECTOR = { stops: [
    [MUSEI[0], 'mattina'], [TRATTORIE[0], 'pranzo'], [MUSEI[1], 'pomeriggio'], [BARS[0], 'aperitivo'], [TRATTORIE[1], 'cena'],
].map(([p, m]) => ({ place_id: p.place_id, moment: `g1-${m}` })) };

const routeFetch = (choose, { title = 'Musei e osterie di Roma' } = {}) => {
    const stato = { calls: [], scelte: null };
    const fn = vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const body = JSON.parse(String(init?.body ?? '{}'));
            const sys = String(body.messages?.[0]?.content ?? '');
            const user = String(body.messages?.[1]?.content ?? '');
            let payload;
            if (sys.includes('traduttore di intenti')) { stato.calls.push('traduttore'); payload = INTENT; }
            else if (sys.includes('SCEGLI soltanto')) {
                stato.calls.push('scelte');
                stato.scelte = JSON.parse(user.split('TAPPE:\n')[1]);
                payload = { days: stato.scelte.map(g => ({ day: g.giorno, title, stops: g.tappe.map(choose) })) };
            } else { stato.calls.push('selettore'); payload = SELECTOR; }
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }
        if (u.includes('textsearch')) {
            const q = new URL(u, 'http://x').searchParams.get('query');
            const hit = Object.keys(PERQUERY).find(k => q === `${k} Roma`);
            return { ok: true, json: async () => (hit ? { status: 'OK', results: PERQUERY[hit] } : { status: 'ZERO_RESULTS', results: [] }) };
        }
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        throw new Error(`fetch inatteso: ${u}`);
    });
    return { fn, stato };
};
const genera = (weather = {}, prefs = { interests: ['Arte', 'Cibo'], pace: 'Rilassato', duration: '1 Giorno' }, testo = 'Domani voglio vivere Roma da romano') => aiRecommendationService.generateItinerary(
    'Roma', prefs, testo, weather, '', ROMA, { pathType: 'custom', skipUserQuota: true },
);
// CONTINUITA' — le righe di tempo libero non sono tappe composte.
const stops = (r) => r.days.flatMap(d => d.stops).filter(s => !s.tempoLibero);

// Nessun valore "null"/"undefined"/vuoto in un testo che la UI mostra.
const VISIBILI = ['title', 'description', 'momentLabel'];
const visibiliPuliti = (r) => {
    for (const d of r.days) {
        expect(testoPulito(d.title), d.title).toBe(true);
        for (const s of d.stops) for (const k of VISIBILI) if (s[k] != null) expect(testoPulito(String(s[k])), `${k}: ${s[k]}`).toBe(true);
        // CONTINUITA' — il tempo libero non e' una tappa composta: non ha questi campi.
        for (const s of d.stops.filter(x => !x.tempoLibero)) for (const k of ['insiderTip', 'bestTime', 'transition']) expect(s[k]).toBeNull();
    }
};

describe('P3d-j — itinerario composto', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-05T20:57:00+02:00'));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('(7) senza meteo: nessun meteo (mai "Soleggiato 22°"); con il meteo vero: quello', async () => {
        const { fn } = routeFetch((t) => ({ place_id: t.place_id, usaFatto: false, gancio: 'distanza', interesse: null }));
        vi.stubGlobal('fetch', fn);
        const senza = await genera({});
        expect(senza.days[0].weather).toBeNull();
        visibiliPuliti(senza);
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        // TESTI — il meteo di adesso vale solo per un tour di oggi, ed e' in italiano.
        const oggi = await genera({ condition: 'sunny', temperature: 19 }, undefined, 'Oggi voglio vivere Roma da romano');
        expect(oggi.days[0].weather).toEqual({ condition: 'sereno', temperature: 19, icon: '☀️' });
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        const domani = await genera({ condition: 'sunny', temperature: 19 }); // «Domani»: il meteo di adesso non e' quello di domani
        expect(domani.days[0].weather).toBeNull();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        const meta = await genera({ condition: 'sunny' }, undefined, 'Oggi voglio vivere Roma da romano'); // temperatura mancante → niente meteo
        expect(meta.days[0].weather).toBeNull();
    });

    it('scelte fuori elenco → riserva del codice, frasi pulite, report che lo dice', async () => {
        const { fn } = routeFetch((t) => ({ place_id: t.place_id, usaFatto: 'si', gancio: 'atmosfera', interesse: 'gelato' }));
        vi.stubGlobal('fetch', fn);
        const r = await genera();
        visibiliPuliti(r);
        for (const x of r._narrationReport.composizione) expect(x.riserva).toEqual(expect.arrayContaining(['usaFatto', 'gancio', 'interesse']));
        expect(r._narrationReport.riserve).toBe(stops(r).length);
    });

    it('(5) legame dagli interessi del wizard: "l\'arte" su un museo, mai su una trattoria', async () => {
        const { fn, stato } = routeFetch((t) => ({ place_id: t.place_id, usaFatto: false, gancio: t.interessi.length ? 'legame' : 'distanza', interesse: t.interessi[0] ?? null }));
        vi.stubGlobal('fetch', fn);
        const r = await genera();
        const museo = stops(r).find(s => s.title === 'Museo Barracco');
        expect(stato.scelte[0].tappe.find(t => t.place_id === museo.place_id).interessi).toContain('arte');
        expect(museo.description).toMatch(/È qui perché cerchi l'arte\.$/);
        for (const s of stops(r).filter(x => /Trattoria|Osteria/.test(x.title))) expect(s.description).not.toMatch(/l'arte/);
        expect(r._narrationReport.interessi).toEqual(['arte']); // P3d-j (chiusura): niente "il cibo"
    });

    it('il titolo con una parola vietata non passa: resta quello del codice', async () => {
        const { fn } = routeFetch((t) => ({ place_id: t.place_id, usaFatto: false, gancio: null, interesse: null }), { title: 'La Roma magica dei romani' });
        vi.stubGlobal('fetch', fn);
        const r = await genera();
        // TESTI-SCHEDE: il titolo viene dalle tappe vere, mai da quello del modello (né dal numero del giorno)
        expect(r.days[0].title).toBe(titoloDaTappe(r.days[0].stops, 'Roma'));
        expect(r.days[0].title).not.toMatch(/magica|giorno/i);
    });

    it('(7) il titolo non nomina meteo o momento (prova reale: "Soleggiato percorso di Roma")', async () => {
        for (const title of ['Soleggiato percorso di Roma', 'Vivace Mattina di Roma', 'Roma al tramonto', 'Elegante piazza di Roma']) {
            try { window.localStorage.clear(); } catch { /* jsdom */ }
            const { fn } = routeFetch((t) => ({ place_id: t.place_id, usaFatto: false, gancio: null, interesse: null }), { title });
            vi.stubGlobal('fetch', fn);
            const r = await genera();
            expect(r.days[0].title, title).toBe(titoloDaTappe(r.days[0].stops, 'Roma'));
            expect(r.days[0].title, title).not.toMatch(/soleggiat|mattina|tramonto|elegante/i);
        }
    });

    it('TESTI — un giro che comincia dopo le 21:30 non ha «aperitivo» nel titolo (la sezione si chiama «Dopocena»)', async () => {
        const gira = async (ora, title) => {
            try { window.localStorage.clear(); } catch { /* jsdom */ }
            vi.setSystemTime(new Date(`2026-10-05T${ora}:00+02:00`));
            const { fn } = routeFetch((t) => ({ place_id: t.place_id, usaFatto: false, gancio: null, interesse: null }), { title });
            vi.stubGlobal('fetch', fn);
            return aiRecommendationService.generateItinerary('Roma', { interests: ['Cibo'], pace: 'Rilassato', duration: 'Veloce' }, 'Percorso rapido', {}, '', ROMA, { pathType: 'quick', skipUserQuota: true });
        };
        const tardi = await gira('21:45', 'Vivace aperitivo di Roma');
        expect(tardi.days?.length, JSON.stringify(tardi._source)).toBeGreaterThan(0);
        expect(tardi.days[0].title).toBe(titoloDaTappe(tardi.days[0].stops, 'Roma'));
        expect(tardi.days[0].title).not.toMatch(/aperitiv/i);
        const presto = await gira('18:30', 'Vivace aperitivo di Roma');
        expect(presto.days?.length, JSON.stringify(presto._source)).toBeGreaterThan(0);
        expect(presto.days[0].title).toBe(titoloDaTappe(presto.days[0].stops, 'Roma')); // il titolo del modello («Vivace aperitivo di Roma») non si usa più
    });

    it('chiamate: traduttore, selettore, scelte — nessuna riscrittura', async () => {
        const { fn, stato } = routeFetch((t) => ({ place_id: t.place_id, usaFatto: false, gancio: 'prima', interesse: null }));
        vi.stubGlobal('fetch', fn);
        await genera();
        expect(stato.calls).toEqual(['traduttore', 'selettore', 'scelte']);
    });
});

describe('P3d-j — "Per Te" composto', () => {
    const CITY = 'Roma';
    const CENTER = { latitude: 41.8986, longitude: 12.4769 };
    const p = (id, name, types, d) => ({ place_id: id, name, latitude: CENTER.latitude + d, longitude: CENTER.longitude, rating: 4.6, user_ratings_total: 300, types, city: CITY });
    const POOL = { romance: [p('r1', 'Belvedere del Gianicolo', ['tourist_attraction'], 0.001), p('r2', 'Terrazza delle Quadrighe', ['tourist_attraction'], 0.002), p('r3', 'Piazza del Campidoglio', ['tourist_attraction'], 0.003)] };
    let prompts;
    const fetchMock = vi.fn(async (url, init) => {
        if (!String(url).includes('openai-proxy')) throw new Error(`fetch inatteso: ${url}`);
        prompts.push(JSON.parse(String(init?.body ?? '{}')).messages?.[0]?.content || '');
        const payload = { tours: [{ themeType: 'romance', title: 'Roma dall\'alto', stops: POOL.romance.map(c => ({ place_id: c.place_id, usaFatto: true, gancio: 'tramonto', interesse: null, description: 'Al tramonto la vista è magica.' })) }] };
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
    });
    beforeEach(() => {
        prompts = []; fetchMock.mockClear();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.stubGlobal('fetch', fetchMock);
        vi.useFakeTimers({ toFake: ['Date'] });
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('alle 5 del mattino: una chiamata, nessun tramonto, nessun testo del modello, nessun meteo inventato nel prompt', async () => {
        // C8b — a mezzanotte "Per Te" e' il giro della sera (motore dei momenti): qui si prova il tour tematico, subito dopo l'alba
        vi.setSystemTime(new Date('2026-10-10T05:04:00+02:00'));
        const res = await aiRecommendationService.generateHomeTours({ city: CITY, cityCenter: CENTER, themedCandidates: POOL, opts: { skipUserQuota: true } });
        expect(prompts).toHaveLength(1);
        expect(prompts[0]).not.toMatch(/meteo: sereno|22°/);
        const st = res.tours.flatMap(t => t.stops);
        expect(st.length).toBe(3);
        for (const s of st) {
            expect(s.description).not.toMatch(/tramont|magic/);
            expect(testoPulito(s.description)).toBe(true);
            expect(s.transition).toBeNull();
        }
        expect(res._report.composizione.every(x => x.riserva.includes('gancio'))).toBe(true); // "tramonto" non vale senza orario
    });

    it('TESTI — i tour di Per Te stanno insieme sulla home: nessuna frase uguale due volte fra uno e l\'altro', async () => {
        vi.setSystemTime(new Date('2026-10-10T10:04:00+02:00'));
        const pool = { romance: POOL.romance, insider: [p('i1', 'Piazza Navona', ['tourist_attraction'], 0.004), p('i2', 'Piazza Farnese', ['tourist_attraction'], 0.005), p('i3', 'Campo de\' Fiori', ['tourist_attraction'], 0.006)] };
        fetchMock.mockImplementationOnce(async (url, init) => {
            prompts.push(JSON.parse(String(init?.body ?? '{}')).messages?.[0]?.content || '');
            const tour = (themeType, cs) => ({ themeType, title: themeType, stops: cs.map(c => ({ place_id: c.place_id, usaFatto: false, gancio: 'prima', interesse: null })) });
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ tours: [tour('romance', pool.romance), tour('insider', pool.insider)] }) } }] }) };
        });
        const res = await aiRecommendationService.generateHomeTours({ city: CITY, cityCenter: CENTER, themedCandidates: pool, opts: { skipUserQuota: true } });
        expect(res.tours.length).toBe(2);
        const frasi = res.tours.flatMap(t => t.stops.flatMap(s => s.description.split(/(?<=[.!?])\s+/).map(f => f.replace(s.title, '<nome>').replace(/\d+/g, '<n>'))));
        expect(new Set(frasi).size, frasi.join(' | ')).toBe(frasi.length);
    });
});
