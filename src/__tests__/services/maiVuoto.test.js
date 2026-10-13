// T1b — Mai un tour vuoto; la citta' del testo anche senza il traduttore.
//
// Caso del banco (BANCO-NAZ, caso d): posizione Troina, testo "una giornata a
// Roma" → il traduttore restituiva zero query, la citta' si perdeva e il tour
// usciva vuoto a Troina. Rete finta: il modello e Google rispondono per
// percorso, niente chiamate vere.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService, resolveTextDestination } from '@/services/aiRecommendationService';
import { extractCityCandidate } from '@/lib/textDestination';
import { getSurpriseOutcome } from '@/pages/SurpriseTour';

const TROINA = { latitude: 37.7845, longitude: 14.5975, isSmallTown: true, radiusKm: 5 };
const ROMA_C = { lat: 41.9028, lng: 12.4964 };
const ROMA = { name: 'Roma', types: ['locality', 'political'], geometry: { location: ROMA_C } };

const luogo = (id, name, c, i, types) => ({
    place_id: id, name, rating: 4.6, user_ratings_total: 400, business_status: 'OPERATIONAL',
    geometry: { location: { lat: c.lat + i * 0.002, lng: c.lng } }, types,
});
const A_ROMA = [
    luogo('r-piazza', 'Piazza Mattei', ROMA_C, 0, ['point_of_interest', 'tourist_attraction']),
    luogo('r-chiesa', 'Chiesa di San Saba', ROMA_C, 1, ['church', 'place_of_worship']),
    luogo('r-tratt', 'Trattoria Pennestri', ROMA_C, 2, ['restaurant', 'food']),
    luogo('r-museo', 'Museo Boncompagni', ROMA_C, 3, ['museum']),
];
const A_TROINA = [
    luogo('t-chiesa', 'Chiesa Madre', { lat: TROINA.latitude, lng: TROINA.longitude }, 0, ['church', 'place_of_worship']),
    luogo('t-tratt', 'Trattoria del Borgo', { lat: TROINA.latitude, lng: TROINA.longitude }, 1, ['restaurant', 'food']),
    luogo('t-belv', 'Belvedere Troina', { lat: TROINA.latitude, lng: TROINA.longitude }, 2, ['point_of_interest', 'tourist_attraction']),
];
const SELETTORE = { days: [{ day: 1, title: 'Un giro', stops: [...A_ROMA, ...A_TROINA].map(p => ({ place_id: p.place_id })) }] };
const ai = (payload) => ({ ok: true, json: async () => ({ choices: [{ message: { content: typeof payload === 'string' ? payload : JSON.stringify(payload) } }] }) });
const traduzione = (o = {}) => ({ queries: [], categoria: 'misto', oggetto_umano: 'un giro', citta: null, vincoli: { tempo: null, escludi: [], note: null }, ...o });

// net({ traduttore, vuoto }): la prima chiamata al modello e' il traduttore,
// le altre il selettore (e il narratore, tollerante). `vuoto`: Google non
// trova niente in nessuna ricerca.
let rete;
const net = ({ traduttore = traduzione(), vuoto = false } = {}) => {
    rete = { bodies: [], textsearch: [], findplace: [] };
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const n = rete.bodies.length;
            rete.bodies.push(JSON.parse(init.body));
            return ai(n === 0 ? traduttore : SELETTORE);
        }
        const p = new URL(u, 'http://x').searchParams;
        if (u.includes('findplacefromtext')) {
            rete.findplace.push(p.get('input'));
            return { ok: true, json: async () => ({ status: 'OK', candidates: /^Roma\b/.test(p.get('input')) ? [ROMA] : [] }) };
        }
        if (u.includes('textsearch')) {
            rete.textsearch.push(p.get('query'));
            const lat = Number(String(p.get('location') || '').split(',')[0]);
            const results = vuoto ? [] : (Math.abs(lat - ROMA_C.lat) < 0.5 ? A_ROMA : A_TROINA);
            return { ok: true, json: async () => ({ status: 'OK', results }) };
        }
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        throw new Error(`rete non prevista: ${u}`);
    }));
};
// CONTINUITA' — le righe di tempo libero non sono luoghi (niente coordinate): qui si guardano le tappe vere.
const tappe = (r) => (r.days || []).flatMap(d => d.stops || []).filter(s => !s.tempoLibero);
const genera = (prompt, opts = { pathType: 'custom', skipUserQuota: true }) =>
    aiRecommendationService.generateItinerary('Troina', { interests: ['Cultura', 'Cibo'] }, prompt, {}, '', TROINA, opts);

beforeEach(() => {
    vi.clearAllMocks();
    try { window.localStorage.clear(); } catch { /* jsdom */ }
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T10:00:00+02:00'));
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('T1b — la citta\' letta dal testo con regole fisse', () => {
    it.each([
        ['una giornata a Roma', 'Roma'],
        ['Domani Roma in una giornata da Romano', 'Roma'],
        ['domani Roma', 'Roma'],
        ['Roma', 'Roma'],
        ['Domani, una giornata a Polignano a Mare', 'Polignano a Mare'],
        ['Polignano a Mare', 'Polignano a Mare'],
        ['sabato a San Gimignano con amici', 'San Gimignano'],
        ['Una giornata a Reggio di Calabria', 'Reggio di Calabria'],
        ['una giornata da Roma a Napoli', 'Napoli'],
        ['a Roma a Pasqua', 'Roma'],
    ])('"%s" → %s', (testo, citta) => {
        expect(extractCityCandidate(testo)).toBe(citta);
    });

    it.each([
        'un giro in via Roma', 'un giro in Via Roma', 'aperitivo in piazza Roma stasera', 'Cena in Corso Italia',
        'Spiagge segrete', 'tour per Natale', 'un giro tra trattorie e belvedere', 'una giornata a roma', '',
    ])('"%s" → nessun candidato', (testo) => {
        expect(extractCityCandidate(testo)).toBeNull();
    });
});

describe('T1b — dove si fa il tour, anche senza il traduttore', () => {
    it('"una giornata a Roma" da Troina, traduttore senza citta\' e senza query → Roma, con UNA ricerca', async () => {
        net({ traduttore: traduzione({ citta: null, queries: [] }) });
        const d = await resolveTextDestination('una giornata a Roma', 'Troina');
        expect(d).toMatchObject({ city: 'Roma', fromText: true, note: 'Tour a Roma (dal tuo testo)' });
        expect(rete.findplace).toEqual(['Roma, Italia']);
    });

    it('traduttore caduto (JSON rotto) → la regola legge Roma lo stesso', async () => {
        net({ traduttore: 'non json' });
        const d = await resolveTextDestination('una giornata a Roma', 'Troina');
        expect(d).toMatchObject({ city: 'Roma', fromText: true });
        expect(d.intent._source).toBe('error-translator');
    });

    it('"un giro in via Roma" a Troina → Troina, nessuna ricerca, anche se il modello dice Roma', async () => {
        net({ traduttore: traduzione({ citta: 'Roma', queries: ['piazza storica'] }) });
        const d = await resolveTextDestination('un giro in via Roma', 'Troina');
        expect(d).toMatchObject({ city: 'Troina', fromText: false, note: null });
        expect(rete.findplace).toEqual([]);
    });

    it('il candidato del testo non e\' una citta\' → il traduttore e\' il secondo segnale', async () => {
        net({ traduttore: traduzione({ citta: 'Roma', queries: ['anfiteatro'] }) });
        const d = await resolveTextDestination('Voglio vedere il Colosseo', 'Troina');
        expect(d).toMatchObject({ city: 'Roma', fromText: true });
        expect(rete.findplace).toEqual(['Colosseo, Italia', 'Roma, Italia']);
    });
});

describe('T1b — zero query: le query di base della citta\'', () => {
    it('traduttore con 0 query → tappe dalle query di base, le stesse di un tour senza testo', async () => {
        net({ traduttore: traduzione({ queries: [] }) });
        const r = await genera('un giro come piace a me');
        expect(tappe(r).length).toBeGreaterThan(0);
        // C8a — la ricerca mirata della passeggiata (lungomare, belvedere…) non e' una query di base
        const baseQ = (qs) => [...new Set(qs)].filter(q => !/lungomare lungofiume/.test(q)).sort();
        const conTesto = baseQ(rete.textsearch);

        window.localStorage.clear();
        // senza testo non c'e' traduttore: la prima chiamata al modello e' il selettore
        net({ traduttore: SELETTORE });
        const senzaTesto = await genera('', {});
        expect(tappe(senzaTesto).length).toBeGreaterThan(0);
        expect(conTesto).toEqual(baseQ(rete.textsearch));
        // un solo giro: il secondo tentativo non serve
        expect(r._queryDiBaseDopoVuoto).toBeUndefined();
    });

    it('"una giornata a Roma" da Troina con citta\' del traduttore null → tour a Roma, tappe a Roma', async () => {
        net({ traduttore: traduzione({ citta: null, queries: [] }) });
        const r = await genera('una giornata a Roma');
        expect(r.destination).toMatchObject({ city: 'Roma', fromText: true, note: 'Tour a Roma (dal tuo testo)' });
        const s = tappe(r);
        expect(s.length).toBeGreaterThan(0);
        for (const t of s) expect(Math.abs(t.latitude - ROMA_C.lat)).toBeLessThan(0.1);
    });

    it('"un giro in via Roma" a Troina → il tour esce a Troina', async () => {
        net({ traduttore: traduzione({ citta: null, queries: ['piazza storica'] }) });
        const r = await genera('un giro in via Roma');
        expect(r.destination).toMatchObject({ city: 'Troina', fromText: false });
        for (const t of tappe(r)) expect(Math.abs(t.latitude - TROINA.latitude)).toBeLessThan(0.1);
    });
});

describe('T1b — mai un tour vuoto a schermo', () => {
    it('0 tappe con le query del testo → secondo tentativo sulle query di base, e la nota lo dice', async () => {
        // Il traduttore chiede "grotte segrete"; Google non ne trova, i temi di base si'.
        net({ traduttore: traduzione({ queries: ['grotte segrete'], categoria: 'natura', oggetto_umano: 'grotte segrete' }) });
        const fetchVero = globalThis.fetch;
        globalThis.fetch = vi.fn((url, init) => (String(url).includes('grotte')
            ? Promise.resolve({ ok: true, json: async () => ({ status: 'OK', results: [] }) })
            : fetchVero(url, init)));
        const r = await genera('le grotte segrete');
        expect(tappe(r).length).toBeGreaterThan(0);
        expect(r.destination.note).toBe('Non ho trovato grotte segrete: ti propongo un giro di Troina');
        // Una generazione sola: tutte le chiamate al modello sullo stesso biglietto,
        // il traduttore una volta (il secondo tentativo non ritraduce).
        const biglietti = new Set(rete.bodies.map(b => b.dv?.ticket));
        expect(biglietti.size).toBe(1);
        expect(rete.bodies.filter(b => b.response_format && b.max_tokens === 200).length).toBe(1);
    });

    it('vuoto anche con le query di base → messaggio onesto, nessun tour, un tentativo in piu\' e basta', async () => {
        net({ traduttore: traduzione({ queries: ['grotte segrete'], oggetto_umano: 'grotte segrete' }), vuoto: true });
        const spy = vi.spyOn(aiRecommendationService, '_generateItinerary');
        const r = await genera('le grotte segrete');
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[1][6]).toMatchObject({ baseQueries: true, skipUserQuota: true });
        spy.mockRestore();
        expect(tappe(r)).toEqual([]);
        expect(['no-results', 'no-results-error', 'no-results-safety', 'search-error']).toContain(r._source);
        expect(r._oggetto_umano).toBe('grotte segrete');
        // la pagina che guarda le tappe lo tratta come vuoto, non come tour
        expect(getSurpriseOutcome(r)).toBe('empty');
        // e resta UNA generazione: un biglietto solo
        expect(new Set(rete.bodies.map(b => b.dv?.ticket)).size).toBe(1);
    });

    it('anche fuori da "Crea il tuo percorso" (Percorso Veloce) un risultato vuoto ha il suo _source onesto', async () => {
        net({ traduttore: traduzione({ queries: ['grotte segrete'] }), vuoto: true });
        const r = await genera('le grotte segrete', { pathType: 'quick', skipUserQuota: true });
        expect(tappe(r)).toEqual([]);
        expect(r._source).toMatch(/^no-results|search-error/);
    });
});
