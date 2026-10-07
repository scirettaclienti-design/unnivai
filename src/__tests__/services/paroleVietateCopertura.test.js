// Gate PAROLE VIETATE (P3d) — il filtro copre tutto il testo che l'utente legge:
// anche `transition`, anche i tour "Per Te" della Home (generazione e cache),
// e non toglie frasi buone (nome proprio della tappa, "centro storico").

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';

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

const routeFetch = (narrate) => vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes('openai-proxy')) {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const sys = String(body.messages?.[0]?.content ?? '');
        const user = String(body.messages?.[1]?.content ?? '');
        let payload;
        if (sys.includes('traduttore di intenti')) payload = INTENT;
        else if (sys.includes('SEI IL NARRATORE')) {
            const giorni = JSON.parse(user.split('TAPPE FINALI:\n')[1]);
            payload = { days: giorni.map(g => ({ day: g.giorno, title: 'G', stops: g.tappe.map(narrate) })) };
        } else payload = SELECTOR;
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

const genera = () => aiRecommendationService.generateItinerary(
    'Roma', { interests: ['Arte', 'Cibo'], pace: 'Rilassato', duration: '1 Giorno' },
    'Domani voglio vivere Roma da romano', {}, '', ROMA, { pathType: 'custom', skipUserQuota: true },
);
const allStops = (r) => r.days.flatMap(d => d.stops);

describe('Gate PAROLE VIETATE (P3d) — itinerario: transition e nome della tappa', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-05T20:57:00+02:00'));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('transition con "imperdibile" → tolta (generazione e cache)', async () => {
        vi.stubGlobal('fetch', routeFetch((t) => ({
            place_id: t.place_id,
            description: 'Le scale sono di pietra chiara.',
            transition: 'Sulla destra una fontana imperdibile.',
        })));
        const r1 = await genera();
        for (const s of allStops(r1)) expect(s.transition, s.title).toBeNull();

        // cache scritta prima del controllo: la transition vietata e' li'
        const key = Object.keys(window.localStorage).find(k => k.startsWith('unnivai_insiderf10_narratore_'));
        const entry = JSON.parse(window.localStorage.getItem(key));
        entry.data.days[0].stops[0].transition = 'Un vicolo imperdibile. Il selciato scende.';
        window.localStorage.setItem(key, JSON.stringify(entry));
        const r2 = await genera();
        expect(allStops(r2)[0].transition).toBe('Il selciato scende.');
    });

    it('tappa "Museo Storico della Liberazione" → la descrizione che ne riporta il nome resta', async () => {
        const frase = 'Il Museo Storico della Liberazione ha sale fresche anche ad agosto.';
        vi.stubGlobal('fetch', routeFetch((t) => ({
            place_id: t.place_id,
            description: t.place_id === LIBERAZIONE.place_id ? frase : 'Le scale sono di pietra chiara.',
        })));
        const r = await genera();
        const s = allStops(r).find(x => x.place_id === LIBERAZIONE.place_id);
        expect(s.title).toBe('Museo Storico della Liberazione');
        expect(s.description).toBe(frase);
    });
});

describe('Gate PAROLE VIETATE (P3d) — tour "Per Te" della Home', () => {
    const CITY = 'Ippocampo';
    const CENTER = { latitude: 41.6489, longitude: 15.9012 };
    const POOL = {
        cultura: [
            { place_id: 'pid-uno', name: 'Torre Capitania', latitude: CENTER.latitude, longitude: CENTER.longitude, rating: 4.6, type: 'museum', city: CITY },
            { place_id: 'pid-due', name: 'Museo del Sale', latitude: CENTER.latitude + 0.001, longitude: CENTER.longitude, rating: 4.4, type: 'museum', city: CITY },
        ],
    };
    const homeFetch = (payload) => vi.fn(async (url) => {
        if (String(url).includes('openai-proxy')) {
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }
        throw new Error(`fetch inatteso: ${url}`);
    });
    const tour = (stops) => ({ tours: [{ themeType: 'cultura', title: 'Cultura a Ippocampo', stops }] });
    const home = () => aiRecommendationService.generateHomeTours({ city: CITY, cityCenter: CENTER, themedCandidates: POOL, opts: { skipUserQuota: true } });

    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('"storico" in descrizione → la frase viene tolta, il resto resta', async () => {
        vi.stubGlobal('fetch', homeFetch(tour([
            { place_id: 'pid-uno', description: 'Un portico storico sul mare. Le panche sono di pietra.', transition: 'Un tratto imperdibile.' },
            { place_id: 'pid-due', description: 'Le vasche hanno bordi bianchi.' },
        ])));
        const res = await home();
        const uno = res.tours[0].stops.find(s => s.place_id === 'pid-uno');
        expect(uno.description).toBe('Le panche sono di pietra.');
        expect(uno.transition).toBeNull();
    });

    it('"storico" in descrizione letta dalla CACHE → frase tolta, nessuna chiamata', async () => {
        const fn = homeFetch(tour([
            { place_id: 'pid-uno', description: 'Le panche sono di pietra.' },
            { place_id: 'pid-due', description: 'Le vasche hanno bordi bianchi.' },
        ]));
        vi.stubGlobal('fetch', fn);
        await home();
        const key = Object.keys(window.localStorage).find(k => k.startsWith('hometours_v1_'));
        const entry = JSON.parse(window.localStorage.getItem(key));
        entry.data.tours[0].stops[0].description = 'Un portico storico sul mare. Le panche sono di pietra.';
        window.localStorage.setItem(key, JSON.stringify(entry));

        const res = await home();
        expect(fn.mock.calls.filter(([u]) => String(u).includes('openai-proxy'))).toHaveLength(1); // cache HIT
        expect(res.tours[0].stops[0].description).toBe('Le panche sono di pietra.');
    });

    it('descrizione fatta solo di frasi vietate → la tappa esce, come per la regola #16 della Home', async () => {
        vi.stubGlobal('fetch', homeFetch(tour([
            { place_id: 'pid-uno', description: 'Un posto magico.' },
            { place_id: 'pid-due', description: 'Le vasche hanno bordi bianchi.' },
        ])));
        const res = await home();
        expect(res.tours[0].stops.map(s => s.place_id)).toEqual(['pid-due']);
    });
});
