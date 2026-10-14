// C10b2 — modello nuovo per la conoscenza delle città, metropoli piene, borghi veri (decisioni di Ivano).
//   · il passaggio lista usa il modello configurato (modelli.ts), e se non risponde si usa quello di prima;
//   · Roma in giornata intera: mattina in un quartiere, pomeriggio in un quartiere vicino;
//   · «Trastevere» chiesto → la sua lista dedicata, almeno 3 luoghi da visitare nel quartiere;
//   · il centro del quartiere e' il baricentro dei posti verificati, raggio 2 km;
//   · borgo: il nome di Google con la stessa categoria entra; con meno di 4 posti, niente tempo libero aggiunto.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MODELLI, MODELLO_DI_PRIMA, chiamaConRipiego, corpoPer } from '../../../supabase/functions/openai-proxy/modelli.ts';
import { verificaPosto, leggiLista, promptCitta } from '../../../supabase/functions/openai-proxy/cityKnowledge.ts';
import { quartieriDallaLista, kmTra, RAGGIO_QUARTIERE_KM, rigaBorgo } from '../../lib/cityKnowledge';
import { fetchCityKnowledge, fetchQuartiereKnowledge } from '../../services/cityKnowledgeService';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { isMealPlace } from '../../services/momentSelection';

// ─── il modello di ogni passaggio ────────────────────────────────────────────
describe('C10b2 — il modello di ogni passaggio, in un posto solo', () => {
    const payload = { model: MODELLO_DI_PRIMA, temperature: 0.2, max_tokens: 3500, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: 'x' }] };
    const risposta = (testo = '{"posti":[]}') => ({ choices: [{ message: { content: testo } }], usage: { prompt_tokens: 10, completion_tokens: 20 } });

    it('lista, quartiere, traduttore e selettore su gpt-6.1-sol; il narratore resta sul modello di prima', () => {
        expect(MODELLI.lista.modello).toBe('gpt-6.1-sol');
        expect(MODELLI.quartiere.modello).toBe('gpt-6.1-sol');
        expect(MODELLI.traduttore.modello).toBe('gpt-6.1-sol');
        expect(MODELLI.selettore.modello).toBe('gpt-6.1-sol');
        expect(MODELLI.narratore.modello).toBe(MODELLO_DI_PRIMA);
    });

    it('il passaggio lista usa il modello configurato, coi parametri che quel modello accetta', async () => {
        const invia = vi.fn(async () => risposta());
        const { info } = await chiamaConRipiego('lista', payload, invia);
        const [corpo, limite] = invia.mock.calls[0];
        expect(corpo.model).toBe('gpt-6.1-sol');
        expect(corpo.max_completion_tokens).toBeGreaterThan(3500); // la risposta + il margine del ragionamento
        expect(corpo).not.toHaveProperty('max_tokens');
        expect(corpo).not.toHaveProperty('temperature');
        expect(corpo.reasoning_effort).toBe('low');
        expect(limite).toBe(MODELLI.lista.timeoutMs);
        expect(info).toMatchObject({ passaggio: 'lista', chiesto: 'gpt-6.1-sol', usato: 'gpt-6.1-sol', ripiego: false });
        expect(invia).toHaveBeenCalledTimes(1);
        // il modello di prima resta com'era
        expect(corpoPer(MODELLO_DI_PRIMA, payload)).toEqual(payload);
    });

    it('se il modello non risponde in tempo si usa quello di prima, e il tracciato lo scrive', async () => {
        const invia = vi.fn()
            .mockImplementationOnce(async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; })
            .mockImplementationOnce(async () => risposta('{"posti":[{"nome":"X"}]}'));
        const { data, info } = await chiamaConRipiego('lista', payload, invia);
        expect(invia.mock.calls[1][0].model).toBe(MODELLO_DI_PRIMA);
        expect(invia.mock.calls[1][0].temperature).toBe(0.2);
        expect(data.choices[0].message.content).toContain('"X"');
        expect(info).toMatchObject({ chiesto: 'gpt-6.1-sol', usato: MODELLO_DI_PRIMA, ripiego: true, motivo: `oltre il tempo massimo (${MODELLI.lista.timeoutMs / 1000} s)` });
    });

    it('anche un errore (due volte: C10b3-bis) o una risposta vuota del modello nuovo fanno ripiegare', async () => {
        const errore = vi.fn().mockRejectedValueOnce(new Error('HTTP 400 unsupported_parameter')).mockRejectedValueOnce(new Error('HTTP 400 unsupported_parameter'))
            .mockResolvedValueOnce(risposta());
        expect((await chiamaConRipiego('selettore', payload, errore)).info).toMatchObject({ ripiego: true, motivo: 'HTTP 400 unsupported_parameter', tentativi: 2 });
        expect(errore).toHaveBeenCalledTimes(3);
        const vuota = vi.fn().mockResolvedValueOnce(risposta('')).mockResolvedValueOnce(risposta());
        expect((await chiamaConRipiego('traduttore', payload, vuota)).info).toMatchObject({ ripiego: true, motivo: 'risposta vuota' });
    });
});

// ─── borgo: il nome di Google con la stessa categoria ────────────────────────
const TROINA = { lat: 37.7823936, lng: 14.5949418 };
const gT = (name, dLat, dLng, types, indirizzo = `${name}, 94018 Troina EN, Italia`) => ({
    place_id: `pid-${name.replace(/\W+/g, '-').toLowerCase()}`, name, formatted_address: indirizzo, types, primary_type: types[0],
    geometry: { location: { lat: TROINA.lat + dLat, lng: TROINA.lng + dLng } }, business_status: 'OPERATIONAL', rating: 4.6, user_ratings_total: 80,
});

describe('C10b2 — borgo: il nome di Google con la stessa categoria, dentro il comune', () => {
    const chiesaMadre = gT('Chiesa Madre di Maria Santissima Assunta', 0.003, 0.006, ['church', 'place_of_worship']);
    it('Troina: «Cattedrale di Troina» (chiesa) → «Chiesa Madre…» (chiesa, nel comune) entra, con la sostituzione scritta', () => {
        const v = verificaPosto({ nome: 'Cattedrale di Troina', citta: 'Troina', categoria: 'chiesa' }, [chiesaMadre], TROINA, 5, { comune: 'Troina' });
        expect(v.ok).toBe(true);
        expect(v.sostituzione).toEqual({ proposto: 'Cattedrale di Troina', google: 'Chiesa Madre di Maria Santissima Assunta', categoria: 'chiesa' });
    });
    it('categoria diversa, fuori comune, o senza categoria: non entra', () => {
        const bar = gT('Bar Nazionale', 0.001, 0.001, ['cafe', 'bakery']);
        expect(verificaPosto({ nome: 'Cattedrale di Troina', citta: 'Troina', categoria: 'chiesa' }, [bar], TROINA, 5, { comune: 'Troina' }).ok).toBe(false);
        const altrove = gT('Chiesa Madre', 0.02, 0.02, ['church'], 'Via Roma, 94010 Cerami EN, Italia');
        expect(verificaPosto({ nome: 'Cattedrale di Troina', citta: 'Troina', categoria: 'chiesa' }, [altrove], TROINA, 5, { comune: 'Troina' }).ok).toBe(false);
        expect(verificaPosto({ nome: 'Cattedrale di Troina', citta: 'Troina' }, [chiesaMadre], TROINA, 5, { comune: 'Troina' }).ok).toBe(false);
        // in una città la regola non vale (nessun comune: solo nomi compatibili)
        expect(verificaPosto({ nome: 'Cattedrale di Troina', citta: 'Troina', categoria: 'chiesa' }, [chiesaMadre], TROINA, 20).ok).toBe(false);
    });
    it('il prompt del borgo chiede la categoria; la lista la legge', () => {
        // C10b3 — la categoria la chiede ora ogni scala (decide le quote); nel borgo c'e' in piu' la via principale
        expect(promptCitta('Troina', '2026-10-15', 'borgo').system).toMatch(/"categoria": cos'e' il posto, una fra: chiesa, museo, monumento/);
        expect(promptCitta('Troina', '2026-10-15', 'borgo').system).toMatch(/la via principale del paese, una sola, con "categoria" "via"/);
        const l = leggiLista(JSON.stringify({ posti: [{ nome: 'Cattedrale di Troina', momento: 'mattina', tipo: 'essenziale', categoria: 'Chiesa' }] }), 'Troina', 'borgo');
        expect(l[0].categoria).toBe('chiesa');
    });
});

// ─── il centro del quartiere ─────────────────────────────────────────────────
const p = (name, lat, lng, tipo, quartiere, extra = {}) => ({
    place_id: `pid-${name.replace(/\W+/g, '-').toLowerCase()}`, name, title: name, latitude: lat, longitude: lng, lat, lng,
    types: ['tourist_attraction'], primaryType: 'tourist_attraction', rating: 4.6, user_ratings_total: 900, _citta: { tipo, momento: 'mattina', quartiere }, ...extra,
});

describe('C10b2 — il centro del quartiere è il baricentro dei posti verificati, il raggio 2 km', () => {
    it('baricentro dei posti del quartiere (non il punto del nome), raggio 2 km', () => {
        const poi = [p('A', 41.880, 12.460, 'essenziale', 'Trastevere'), p('B', 41.890, 12.470, 'da locale', 'Trastevere'), p('C', 41.900, 12.480, 'essenziale', 'Monti')];
        const q = quartieriDallaLista(poi).find(x => x.nome === 'Trastevere');
        expect(q.centro.latitude).toBeCloseTo(41.885, 6);
        expect(q.centro.longitude).toBeCloseTo(12.465, 6);
        expect(RAGGIO_QUARTIERE_KM).toBe(2);
        expect(q.raggioKm).toBe(2);
    });
});

// ─── il motore intero ────────────────────────────────────────────────────────
const ROMA_C = { latitude: 41.8967068, longitude: 12.4822025, isSmallTown: false, radiusKm: 10 };
const g = (name, lat, lng, extra = {}) => ({
    place_id: `pid-${name.replace(/\W+/g, '-').toLowerCase()}`, name, formatted_address: `${name}, Roma RM, Italia`,
    geometry: { location: { lat, lng } }, business_status: 'OPERATIONAL',
    types: ['tourist_attraction', 'point_of_interest'], rating: 4.6, user_ratings_total: 300, ...extra,
});
// Monti (mattina) e Esquilino (pomeriggio) a 1,6 km; Trastevere dall'altra parte del fiume; un gruppo lontano a nord
const Q = { monti: { lat: 41.8935, lng: 12.4920 }, esquilino: { lat: 41.8960, lng: 12.5100 }, nord: { lat: 41.930, lng: 12.480 } };
const gruppo = (k, { lat, lng }) => [
    ...['Piazza', 'Fontana', 'Porta', 'Palazzo', 'Chiesa', 'Arco'].map((n, i) => g(`${n} ${k}`, lat + 0.0011 * (i + 1) * (i % 2 ? 1 : -1), lng + 0.0009 * (i % 3 - 1),
        n === 'Chiesa' ? { primary_type: 'church', types: ['church', 'place_of_worship'] } : { primary_type: 'tourist_attraction' })),
    ...[0, 1, 2].map(i => g(`Trattoria ${k} ${i}`, lat - 0.0010 * (i + 1), lng + 0.0006, { primary_type: 'italian_restaurant', types: ['italian_restaurant', 'restaurant', 'food'] })),
    g(`Bar ${k}`, lat + 0.0005, lng - 0.0012, { primary_type: 'cocktail_bar', types: ['cocktail_bar', 'bar'] }),
];
const RICERCA = Object.entries(Q).flatMap(([k, c]) => gruppo(k, c));
const ess = (name, lat, lng, quartiere, extra = {}) => ({ ...g(name, lat, lng, { primary_type: 'church', types: ['church', 'tourist_attraction'], ...extra }), _citta: { tipo: 'essenziale', momento: 'mattina', quartiere } });
const loc = (name, lat, lng, quartiere, extra = {}) => ({ ...g(name, lat, lng, { primary_type: 'italian_restaurant', types: ['restaurant', 'food'], ...extra }), _citta: { tipo: 'da locale', momento: 'cena', quartiere } });
const LISTA_ROMA = [
    ess('Colosseo', 41.8902, 12.4922, 'Monti', { primary_type: 'historical_landmark', types: ['historical_landmark', 'tourist_attraction'] }),
    ess('Santa Maria ai Monti', 41.8950, 12.4930, 'Monti'),
    ess('Santa Maria Maggiore', 41.8976, 12.4984, 'Esquilino'),
    ess('Palazzo Massimo', 41.9013, 12.4980, 'Esquilino', { primary_type: 'museum', types: ['museum'] }),
    ess('Villa Nord', 41.930, 12.480, 'Nord', { primary_type: 'park', types: ['park'] }),
    // Trastevere: nella lista solo locali (come nel giro C10b del 16/10)
    loc('Trattoria Da Enzo', 41.8881, 12.4779, 'Trastevere'), loc('Bar San Calisto', 41.8890, 12.4696, 'Trastevere', { primary_type: 'bar', types: ['bar'] }),
];
// la lista dedicata di Trastevere: 6 luoghi da visitare
const T = { lat: 41.8889, lng: 12.4695 };
const LISTA_TRASTEVERE = [
    ['Basilica di Santa Maria in Trastevere', 0.0006, 0.0004, 'church'], ['Basilica di Santa Cecilia', -0.0020, 0.0060, 'church'],
    ['Villa Farnesina', 0.0047, -0.0023, 'museum'], ['Orto Botanico di Roma', 0.0060, -0.0040, 'park'],
    ['San Pietro in Montorio', -0.0010, -0.0045, 'church'], ['Palazzo Corsini', 0.0055, -0.0030, 'museum'],
].map(([n, dLat, dLng, t], i) => ({ ...g(n, T.lat + dLat, T.lng + dLng, { primary_type: t, types: [t, 'tourist_attraction'] }), _citta: { tipo: i < 2 ? 'essenziale' : 'da locale', momento: i % 2 ? 'pomeriggio' : 'mattina', quartiere: 'Trastevere' } }));

const traduttore = { choices: [{ message: { content: JSON.stringify({ queries: ['piazza storica', 'trattoria tipica'], categoria: 'misto', oggetto_umano: 'un giro', citta: null, vincoli: { tempo: null, escludi: [], note: null } }) } }] };
const routeFetch = () => vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes('openai-proxy')) {
        const body = JSON.parse(String(init?.body || '{}'));
        const sys = String(body.messages?.[0]?.content || '');
        if (sys.includes('traduttore di intenti')) return { ok: true, json: async () => traduttore };
        // il selettore sceglie un posto lontano: il codice lo deve scartare; il proxy dice che modello ha usato
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ stops: [{ place_id: 'pid-piazza-nord', moment: 'g1-mattina' }] }) } }],
            _modello: { passaggio: body.dv?.passaggio ?? null, chiesto: 'gpt-6.1-sol', usato: 'gpt-6.1-sol', ripiego: false } }) };
    }
    if (u.includes('textsearch')) {
        const q = new URL(u, 'http://x').searchParams.get('query') || '';
        const res = /trattoria|ristorante|osteria/.test(q) ? RICERCA.filter(c => /Trattoria/.test(c.name))
            : /bar|cocktail|vino/.test(q) ? RICERCA.filter(c => /^Bar/.test(c.name))
            : RICERCA.filter(c => !/Trattoria|^Bar/.test(c.name));
        return { ok: true, json: async () => ({ status: 'OK', results: res }) };
    }
    return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', result: {}, candidates: [] }) };
});

describe('C10b2 — il motore: due quartieri, il quartiere chiesto, il borgo corto', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-14T22:19:00+02:00'));
    });
    afterEach(() => {
        vi.unstubAllGlobals(); vi.useRealTimers();
        vi.mocked(fetchCityKnowledge).mockReset(); vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'spenta', verificati: [] });
        vi.mocked(fetchQuartiereKnowledge).mockReset(); vi.mocked(fetchQuartiereKnowledge).mockResolvedValue({ stato: 'spenta', verificati: [] });
    });
    const tappe = (r) => r.days.flatMap(d => d.stops).filter(s => !s.tempoLibero);
    const genera = (testo) => aiRecommendationService.generateItinerary('Roma', { duration: '1 Giorno' }, testo, {}, '', ROMA_C, { pathType: 'custom', skipUserQuota: true });

    it('Roma in giornata intera: mattina in un quartiere, pomeriggio in un quartiere vicino', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'metropoli', verificati: LISTA_ROMA });
        vi.stubGlobal('fetch', routeFetch());
        const r = await genera('Domani una giornata a Roma');
        const qs = r._citta.quartieri;
        expect(qs.map(q => q.nome)).toEqual(['Monti', 'Esquilino']);
        expect(kmTra(qs[0].centro, qs[1].centro)).toBeLessThanOrEqual(3);
        const t = tappe(r);
        const mattina = t.filter(s => s.moment === 'mattina');
        const pomeriggio = t.filter(s => s.moment === 'pomeriggio');
        expect(mattina.length).toBeGreaterThan(0);
        expect(pomeriggio.length).toBeGreaterThan(0);
        for (const s of mattina) expect(kmTra(qs[0].centro, s)).toBeLessThanOrEqual(2 + 1e-6);
        for (const s of pomeriggio) expect(kmTra(qs[1].centro, s)).toBeLessThanOrEqual(2 + 1e-6);
        expect(t.map(s => s.title)).not.toContain('Piazza nord');
        // il tracciato dice quale modello ha scelto le tappe
        expect(r._modelli.selettore).toMatchObject({ passaggio: 'selettore', usato: 'gpt-6.1-sol' });
    });

    it('«Trastevere» chiesto → la lista dedicata del quartiere, e almeno 3 luoghi da visitare a Trastevere nel tour', async () => {
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'metropoli', verificati: LISTA_ROMA });
        vi.mocked(fetchQuartiereKnowledge).mockResolvedValue({ stato: 'ok', cached: false, verificati: LISTA_TRASTEVERE });
        vi.stubGlobal('fetch', routeFetch());
        const r = await genera('Domani una giornata a Trastevere');
        expect(fetchQuartiereKnowledge).toHaveBeenCalledWith('Roma', expect.any(String), 'Trastevere');
        expect(r._citta.quartieri.map(q => q.nome)).toEqual(['Trastevere']);
        const centro = r._citta.quartieri[0].centro;
        const daVisitare = tappe(r).filter(s => !isMealPlace(s) && !/^Bar /.test(s.title) && kmTra(centro, s) <= 2 && LISTA_TRASTEVERE.some(x => x.name === s.title));
        expect(daVisitare.length).toBeGreaterThanOrEqual(3);
    });

    it('senza richiesta, un quartiere senza essenziali non si sceglie', async () => {
        const soloLocali = [loc('Trattoria Uno', 41.8881, 12.4779, 'Trastevere'), loc('Trattoria Due', 41.8890, 12.4696, 'Trastevere'),
            ess('Villa Nord', 41.930, 12.480, 'Nord', { primary_type: 'park', types: ['park'] }), ess('Colosseo', 41.8902, 12.4922, 'Monti')];
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'metropoli', verificati: soloLocali });
        vi.stubGlobal('fetch', routeFetch());
        const r = await genera('Domani una giornata a Roma');
        expect(r._citta.quartieri.map(q => q.nome)).not.toContain('Trastevere');
    });

    it('un borgo con meno di 4 posti: il giro dura quanto le sue tappe, nessun tempo libero aggiunto, la riga resta', async () => {
        const TR = { latitude: TROINA.lat, longitude: TROINA.lng, isSmallTown: true, radiusKm: 5 };
        const vicino = (name, dLat, dLng, extra) => g(name, TR.latitude + dLat, TR.longitude + dLng, { formatted_address: `${name}, 94018 Troina EN, Italia`, user_ratings_total: 40, ...extra });
        const lista = [
            { ...vicino('Chiesa San Nicolò', 0.0036, 0.0079, { primary_type: 'church', types: ['church'] }), _citta: { tipo: 'essenziale', momento: 'mattina', simbolo: true } },
            { ...vicino('Chiesa Madre', 0.003, 0.006, { primary_type: 'church', types: ['church'] }), _citta: { tipo: 'da locale', momento: 'mattina' } },
            { ...vicino('Il Chiosco', 0.0018, 0.0002, { primary_type: 'bar', types: ['bar'] }), _citta: { tipo: 'da locale', momento: 'aperitivo' } },
        ];
        const pochi = [vicino('Piazza Matteotti', 0.001, 0.001, { primary_type: 'tourist_attraction' }), vicino('Torre Capitania', 0.002, 0.004, { primary_type: 'historical_landmark', types: ['historical_landmark', 'tourist_attraction'] }),
            vicino('Trattoria Troina', -0.001, 0.001, { primary_type: 'italian_restaurant', types: ['restaurant', 'food'] })];
        vi.mocked(fetchCityKnowledge).mockResolvedValue({ stato: 'ok', cached: true, scala: 'borgo', verificati: lista });
        vi.stubGlobal('fetch', vi.fn(async (url, init) => {
            const u = String(url);
            if (u.includes('openai-proxy')) {
                const sys = String(JSON.parse(String(init?.body || '{}')).messages?.[0]?.content || '');
                if (sys.includes('traduttore di intenti')) return { ok: true, json: async () => traduttore };
                return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ stops: [{ place_id: 'pid-chiesa-san-nicol-', moment: 'g1-mattina' }] }) } }] }) };
            }
            if (u.includes('textsearch')) {
                const q = new URL(u, 'http://x').searchParams.get('query') || '';
                const res = /trattoria|ristorante/.test(q) ? pochi.filter(c => /Trattoria/.test(c.name)) : pochi.filter(c => !/Trattoria/.test(c.name));
                return { ok: true, json: async () => ({ status: res.length ? 'OK' : 'ZERO_RESULTS', results: res }) };
            }
            return { ok: true, json: async () => ({ status: 'ZERO_RESULTS', candidates: [] }) };
        }));
        const r = await aiRecommendationService.generateItinerary('Troina', { duration: '1 Giorno' }, 'Domani una giornata a Troina', {}, '', TR, { pathType: 'custom', skipUserQuota: true });
        const w = r.tourWindow.windows[0];
        expect((w.end.getTime() - w.start.getTime()) / 60000).toBeLessThan(240);
        expect(r.days.flatMap(d => d.stops).filter(s => s.tempoLibero)).toEqual([]);
        expect(tappe(r).length).toBeGreaterThanOrEqual(2);
        expect(r.days[0].scalaNote).toBe(rigaBorgo('Troina'));
    });
});
