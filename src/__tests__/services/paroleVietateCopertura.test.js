// Gate PAROLE VIETATE (P3d) — nessuna parola vietata in cio' che l'utente legge:
// itinerario e "Per Te", generazione e cache; il nome proprio della tappa resta.
// P3d-j — il modello non scrive piu' testo per le tappe: un testo che prova a
// mandare (description, transition…) non arriva a schermo; la frase la compone
// il codice. Il filtro resta sulla cache di "Per Te" per le voci non composte.

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

// C5d — sulla linea delle altre tappe: questo test guarda la frase, non la forma del giro
// (a nord, fuori linea, la rifinitura lo sostituiva per togliere una deviazione).
const LIBERAZIONE = place('Museo Storico della Liberazione', MUSEO, -0.001, 0.0015);
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

const routeFetch = (choose) => vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes('openai-proxy')) {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const sys = String(body.messages?.[0]?.content ?? '');
        const user = String(body.messages?.[1]?.content ?? '');
        let payload;
        if (sys.includes('traduttore di intenti')) payload = INTENT;
        else if (sys.includes('SCEGLI soltanto')) {
            const giorni = JSON.parse(user.split('TAPPE:\n')[1]);
            payload = { days: giorni.map(g => ({ day: g.giorno, title: 'G', stops: g.tappe.map(choose) })) };
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
// CONTINUITA' — le righe di tempo libero non sono tappe composte: qui si guardano le tappe vere.
const allStops = (r) => r.days.flatMap(d => d.stops).filter(s => !s.tempoLibero);
const pulita = (s) => filterBannedWords(s.description, { exempt: [s.title] }).removed.length === 0;

// C8b — di sera "Per Te" e' il giro della sera: i test dei tour tematici girano a pranzo, qualunque ora sia.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-14T13:00:00+02:00')); });
afterEach(() => { vi.useRealTimers(); });

describe('Gate PAROLE VIETATE (P3d) — itinerario', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-05T20:57:00+02:00'));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('P3d-j — il testo che il modello prova a scrivere non arriva a schermo (generazione e cache)', async () => {
        vi.stubGlobal('fetch', routeFetch((t) => ({
            place_id: t.place_id, usaFatto: false, gancio: 'prima', interesse: null,
            description: 'Un posto magico.', transition: 'Sulla destra una fontana imperdibile.',
        })));
        const r1 = await genera();
        for (const s of allStops(r1)) {
            expect(s.transition, s.title).toBeNull();
            expect(s.description).not.toMatch(/magico|imperdibile/);
            expect(pulita(s), s.description).toBe(true);
        }
        const r2 = await genera(); // cache HIT: la frase si ricompone
        expect(allStops(r2).map(s => s.description)).toEqual(allStops(r1).map(s => s.description));
        for (const s of allStops(r2)) expect(s.transition).toBeNull();
    });

    it('tappa "Museo Storico della Liberazione" → il nome resta nella frase composta', async () => {
        vi.stubGlobal('fetch', routeFetch((t) => ({ place_id: t.place_id, usaFatto: false, gancio: null, interesse: null })));
        const r = await genera();
        const s = allStops(r).find(x => x.place_id === LIBERAZIONE.place_id);
        expect(s.title).toBe('Museo Storico della Liberazione');
        expect(s.description).toContain('Museo Storico della Liberazione');
        expect(pulita(s)).toBe(true);
    });
});

describe('Gate PAROLE VIETATE (P3d) — tour "Per Te" della Home', () => {
    const CITY = 'Ippocampo';
    const CENTER = { latitude: 41.6489, longitude: 15.9012 };
    const POOL = {
        cultura: [
            { place_id: 'pid-uno', name: 'Torre Capitania', latitude: CENTER.latitude, longitude: CENTER.longitude, rating: 4.6, type: 'museum', city: CITY },
            { place_id: 'pid-due', name: 'Museo del Sale', latitude: CENTER.latitude + 0.001, longitude: CENTER.longitude, rating: 4.4, type: 'museum', city: CITY },
            { place_id: 'pid-tre', name: 'Chiesa Madre', latitude: CENTER.latitude + 0.002, longitude: CENTER.longitude, rating: 4.5, type: 'church', city: CITY },
            { place_id: 'pid-quattro', name: 'Porta Marina', latitude: CENTER.latitude + 0.003, longitude: CENTER.longitude, rating: 4.3, type: 'monument', city: CITY },
        ],
    };
    const homeFetch = (payload) => vi.fn(async (url) => {
        if (String(url).includes('openai-proxy')) {
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }
        throw new Error(`fetch inatteso: ${url}`);
    });
    const TOUR = { tours: [{ themeType: 'cultura', title: 'Cultura a Ippocampo', stops: [
        { place_id: 'pid-uno', description: 'Un portico storico sul mare.', transition: 'Un tratto imperdibile.' },
        { place_id: 'pid-due', usaFatto: false, gancio: 'distanza' },
        { place_id: 'pid-tre', gancio: 'prima' },
        { place_id: 'pid-quattro', gancio: 'ultima' },
    ] }] };
    const home = () => aiRecommendationService.generateHomeTours({ city: CITY, cityCenter: CENTER, themedCandidates: POOL, opts: { skipUserQuota: true } });

    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('P3d-j — il testo del modello non resta: frasi composte, nessuna parola vietata, tutte le tappe', async () => {
        vi.stubGlobal('fetch', homeFetch(TOUR));
        const res = await home();
        expect(res.tours[0].stops.map(s => s.place_id).sort()).toEqual(['pid-due', 'pid-quattro', 'pid-tre', 'pid-uno']);
        for (const s of res.tours[0].stops) {
            expect(s.description).not.toMatch(/storic|imperdibil/);
            expect(s.transition).toBeNull();
            expect(pulita(s)).toBe(true);
        }
    });

    it('dalla CACHE: una tappa composta non si tocca; una voce non composta passa ancora dal filtro', async () => {
        const fn = homeFetch(TOUR);
        vi.stubGlobal('fetch', fn);
        await home();
        const dopoLaPrima = fn.mock.calls.filter(([u]) => String(u).includes('openai-proxy')).length;
        const key = Object.keys(window.localStorage).find(k => k.startsWith('hometours_v2_'));
        const entry = JSON.parse(window.localStorage.getItem(key));
        const uno = entry.data.tours[0].stops.find(s => s.place_id === 'pid-uno');
        delete uno._comp;
        uno.description = 'Un portico storico sul mare. La pietra è chiara.';
        window.localStorage.setItem(key, JSON.stringify(entry));

        const res = await home();
        expect(fn.mock.calls.filter(([u]) => String(u).includes('openai-proxy'))).toHaveLength(dopoLaPrima); // cache HIT
        expect(res.tours[0].stops.find(s => s.place_id === 'pid-uno').description).toBe('La pietra è chiara.');
        expect(res.tours[0].stops.find(s => s.place_id === 'pid-due').description).toContain('Museo del Sale');
    });
});
