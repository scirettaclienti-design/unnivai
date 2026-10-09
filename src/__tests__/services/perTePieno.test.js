import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// P7a2 — "Per Te" pieno e meno famoso.
//   1. Ogni pool di tema arriva al modello ordinato col punteggio di Gate
//      MERITO (unicita'), non nell'ordine di Google; al massimo un'icona per
//      tema, misurata su tutti i candidati della generazione.
//   2. Riempire prima di nascondere: un tour sotto le 3 tappe si completa in
//      codice col miglior candidato rimasto nel suo pool, non usato da altri
//      tour. La tappa aggiunta riceve la descrizione nella seconda chiamata
//      (la riscrittura), dentro lo stesso biglietto 'home_tours'. Solo senza
//      candidati validi il tour si nasconde.
//   3. Famosita' nel resoconto: mediana delle recensioni delle tappe servite e
//      tappe sopra 5.000 (citta') / 1.000 (borghi).
//
// Mock solo di infrastruttura: fetch instradato per URL e per prompt.

import { aiRecommendationService, prepareHomePools } from '../../services/aiRecommendationService';
import { rankByMerit, famositaReport } from '../../services/candidateScoring';

const CITY = 'Roma';
const CENTER = { latitude: 41.9028, longitude: 12.4964 };
const near = (km) => ({ latitude: CENTER.latitude + km * 0.009, longitude: CENTER.longitude });
const poi = (id, name, km, extra = {}) => ({
    place_id: id, name, ...near(km), rating: 4.5, user_ratings_total: 500, types: ['tourist_attraction'], city: CITY, ...extra,
});
const stop = (place_id) => ({ place_id, description: `Dentro ${place_id} la pietra e' fresca.`, insiderTip: 'Entra dal lato.', transition: 'Si scende per una scala.' });

let calls;
// Il primo prompt costruisce i tour; quello di riscrittura riceve le TAPPE e
// risponde con `rewrite(tappe)`.
const homeFetch = (tourPayload, rewrite = (tappe) => ({ stops: tappe.map(t => ({ place_id: t.place_id, description: `Da ${t.nome} si vede il quartiere dall'alto.` })) })) => vi.fn(async (url, init) => {
    if (!String(url).includes('openai-proxy')) throw new Error(`fetch inatteso: ${url}`);
    const body = JSON.parse(String(init?.body ?? '{}'));
    const sys = String(body.messages?.[0]?.content ?? '');
    const isRw = sys.includes('Riscrivi SOLO il campo description');
    const tappe = isRw ? JSON.parse(String(body.messages[1].content).split('TAPPE:\n')[1]) : null;
    calls.push({ kind: isRw ? 'riscrittura' : 'tour', body, tappe, sys });
    const payload = isRw ? rewrite(tappe) : tourPayload;
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) }, finish_reason: 'stop' }], usage: { completion_tokens: 900 } }) };
});
const home = (themedCandidates) => aiRecommendationService.generateHomeTours({
    city: CITY, cityCenter: CENTER, themedCandidates, opts: { skipUserQuota: true },
});

beforeEach(() => {
    vi.clearAllMocks();
    calls = [];
    try { window.localStorage.clear(); } catch { /* jsdom */ }
});
afterEach(() => { vi.unstubAllGlobals(); });

// ─── 1. Pool dei temi ordinati per merito ───────────────────────────────────
describe('P7a2 — il pool di un tema arriva al modello ordinato per unicita\'', () => {
    // Ordine di Google: il famoso in testa.
    const CULTURA = [
        poi('famoso', 'Musei Capitolini', 1, { user_ratings_total: 19000 }),
        poi('medio', 'Galleria Colonna', 1.2, { user_ratings_total: 3300 }),
        poi('raro', 'Museo Barracco', 1.4, { user_ratings_total: 900 }),
        poi('rarissimo', 'Casa di Goethe', 1.6, { user_ratings_total: 150 }),
    ];

    it('prepareHomePools: a parita\' di voto, prima il meno recensito', () => {
        const pools = prepareHomePools({ cultura: CULTURA }, CENTER, CITY);
        expect(pools.cultura.map(p => p.place_id)).toEqual(['rarissimo', 'raro', 'medio', 'famoso']);
    });

    it('il prompt elenca i candidati in quell\'ordine', async () => {
        const fn = homeFetch({ tours: [{ themeType: 'cultura', title: 'Cultura', stops: [stop('raro'), stop('medio'), stop('rarissimo')] }] });
        vi.stubGlobal('fetch', fn);
        await home({ cultura: CULTURA });
        const prompt = calls[0].sys;
        expect(prompt.indexOf('"rarissimo"')).toBeLessThan(prompt.indexOf('"famoso"'));
        expect(prompt.indexOf('"raro"')).toBeLessThan(prompt.indexOf('"famoso"'));
    });

    it('al massimo un\'icona per tema, misurata su tutti i candidati', () => {
        // 12 candidati in tutto, il decimo piu' recensito sono 2: tutti e due nel tema cultura.
        const normali = Array.from({ length: 10 }, (_, i) => poi(`n${i}`, `N${i}`, 1 + i * 0.1, { user_ratings_total: 100 + i * 20 }));
        const pools = prepareHomePools({
            cultura: [poi('icona1', 'Pantheon', 1, { user_ratings_total: 200000 }), poi('icona2', 'Fontana di Trevi', 1, { user_ratings_total: 300000 }), ...normali.slice(0, 4)],
            food: normali.slice(4),
        }, CENTER, CITY);
        const icone = pools.cultura.map(p => p.place_id).filter(id => id.startsWith('icona'));
        expect(icone).toHaveLength(1);
        expect(pools.cultura).toHaveLength(5);
    });

    it('rankByMerit tiene l\'ordine di partenza a parita\' di punteggio', () => {
        const a = poi('a', 'A', 1); const b = poi('b', 'B', 1);
        expect(rankByMerit([a, b]).map(p => p.place_id)).toEqual(['a', 'b']);
        expect(rankByMerit([b, a]).map(p => p.place_id)).toEqual(['b', 'a']);
    });
});

// ─── 2. Riempire prima di nascondere ────────────────────────────────────────
describe('P7a2 — un tour a 2 tappe si completa in codice', () => {
    const FOOD = [
        poi('f1', 'Da Enzo', 1, { types: ['restaurant'], user_ratings_total: 4000 }),
        poi('f2', 'Armando', 1.2, { types: ['restaurant'], user_ratings_total: 3500 }),
        poi('f3', 'Trattoria di quartiere', 1.4, { types: ['restaurant'], user_ratings_total: 120 }),
        poi('f4', 'Roscioli', 1.6, { types: ['restaurant'], user_ratings_total: 9000 }),
    ];
    const CULTURA = [poi('c1', 'San Clemente', 1, { user_ratings_total: 2000 }), poi('c2', 'Santa Prassede', 1.1, { user_ratings_total: 1800 }), poi('c3', 'Palazzo Massimo', 1.2, { user_ratings_total: 6400 })];

    it('tour a 2 tappe → completato col miglior candidato rimasto e mostrato, descrizione presente', async () => {
        vi.stubGlobal('fetch', homeFetch({ tours: [
            { themeType: 'food', title: 'Food', stops: [stop('f1'), stop('f2')] },
            { themeType: 'cultura', title: 'Cultura', stops: [stop('c1'), stop('c2'), stop('c3')] },
        ] }));
        const res = await home({ food: FOOD, cultura: CULTURA });
        const food = res.tours.find(t => t.themeType === 'food');
        expect(food).toBeDefined();
        expect(food.stops).toHaveLength(3);
        // Il migliore per merito fra quelli liberi: f3 (120 recensioni), non Roscioli.
        const aggiunta = food.stops.find(s => s.place_id === 'f3');
        expect(aggiunta).toBeDefined();
        expect(aggiunta.description).toBe("Da Trattoria di quartiere si vede il quartiere dall'alto.");
        expect(res._report.aggiunte).toEqual([{ tour: 'food', title: 'Trattoria di quartiere', place_id: 'f3' }]);
        expect(res._report.scarti).toEqual([]);
    });

    it('una sola chiamata in piu\' — la riscrittura — nello stesso biglietto "home_tours"', async () => {
        vi.stubGlobal('fetch', homeFetch({ tours: [{ themeType: 'food', title: 'Food', stops: [stop('f1'), stop('f2')] }] }));
        await home({ food: FOOD });
        expect(calls.map(c => c.kind)).toEqual(['tour', 'riscrittura']);
        expect(new Set(calls.map(c => c.body.dv?.ticket)).size).toBe(1);
        expect(calls[0].body.dv.kind).toBe('home_tours');
        // P3d-e — nella stessa chiamata, prima, i due locali scelti (f1, f2):
        // si riscrivono ancorati ai dati (fascia, motivo). Poi le riserve: una
        // in piu' del necessario, in ordine di merito.
        expect(calls[1].tappe.map(t => t.place_id)).toEqual(['f1', 'f2', 'f3', 'f4']);
        expect(calls[1].tappe[0].locale).toBe(true);
        expect(calls[1].tappe[0].tolto[0].motivo).toBe('riscrivila usando i fatti e i dati forniti');
        expect(calls[1].tappe[2].tolto).toEqual([{ frase: null, motivo: 'mancava la descrizione' }]);
    });

    it('la riserva non e\' un luogo gia\' usato da un altro tour', async () => {
        vi.stubGlobal('fetch', homeFetch({ tours: [
            { themeType: 'cultura', title: 'Cultura', stops: [stop('c1'), stop('c2'), stop('c3')] },
            { themeType: 'insider', title: 'Insider', stops: [stop('i1'), stop('i2')] },
        ] }));
        const res = await home({
            insider: [poi('i1', 'Hortus Urbis', 1, { user_ratings_total: 21 }), poi('i2', 'Pincio', 1.1, { user_ratings_total: 159 }), poi('i3', 'Monte Ciocci', 1.2, { user_ratings_total: 28 })],
            cultura: CULTURA,
        });
        const insider = res.tours.find(t => t.themeType === 'insider');
        expect(insider.stops.map(s => s.place_id).sort()).toEqual(['i1', 'i2', 'i3']);
        expect(res.tours.flatMap(t => t.stops.map(s => s.place_id))).toHaveLength(6); // nessun doppione
    });

    it('il tour con abbastanza tappe non riceve riserve (e niente chiamata in piu\')', async () => {
        vi.stubGlobal('fetch', homeFetch({ tours: [{ themeType: 'cultura', title: 'Cultura', stops: [stop('c1'), stop('c2'), stop('c3')] }] }));
        const res = await home({ cultura: CULTURA });
        // P3d-g — la riscrittura ancorata ai dati parte sempre (stesso biglietto,
        // al massimo 2 chiamate): ma senza riserve dentro.
        expect(calls.map(c => c.kind)).toEqual(['tour', 'riscrittura']);
        expect(calls[1].tappe.map(t => t.place_id).sort()).toEqual(['c1', 'c2', 'c3']);
        expect(res._report.aggiunte).toEqual([]);
    });
});

describe('P7a2 — senza candidati validi il tour si nasconde', () => {
    it('pool esaurito → tour nascosto, col motivo', async () => {
        vi.stubGlobal('fetch', homeFetch({ tours: [{ themeType: 'food', title: 'Food', stops: [stop('f1'), stop('f2')] }] }));
        const res = await home({ food: [poi('f1', 'Da Enzo', 1), poi('f2', 'Armando', 1.2)] });
        expect(res.tours).toEqual([]);
        expect(calls.map(c => c.kind)).toEqual(['tour', 'riscrittura']); // P3d-g: la riscrittura ancorata, nessuna riserva
        expect(res._report.scarti.map(s => s.motivo)).toEqual([
            'tour con meno di 3 tappe: nessun candidato valido rimasto nel pool',
            'tour con meno di 3 tappe: nessun candidato valido rimasto nel pool',
        ]);
    });

    it('le riserve non ricevono una descrizione valida → tour nascosto', async () => {
        vi.stubGlobal('fetch', homeFetch(
            { tours: [{ themeType: 'food', title: 'Food', stops: [stop('f1'), stop('f2')] }] },
            (tappe) => ({ stops: tappe.map(t => ({ place_id: t.place_id, description: 'Un posto magico.' })) }),
        ));
        const res = await home({ food: [poi('f1', 'Da Enzo', 1), poi('f2', 'Armando', 1.2), poi('f3', 'Felice', 1.4)] });
        expect(res.tours).toEqual([]);
        expect(res._report.aggiunte).toEqual([]);
    });
});

// ─── 3. Famosita' ───────────────────────────────────────────────────────────
describe('P7a2 — famosita\' nel resoconto', () => {
    it('mediana e tappe sopra 5.000 in citta\', sopra 1.000 nei borghi', () => {
        const cand = [{ place_id: 'a', user_ratings_total: 200 }, { place_id: 'b', user_ratings_total: 6000 }, { place_id: 'c', user_ratings_total: 1500 }];
        const tappe = [{ place_id: 'a', title: 'A' }, { place_id: 'b', title: 'B' }, { place_id: 'c', title: 'C' }];
        expect(famositaReport(tappe, 'Roma', cand)).toMatchObject({ tappe: 3, mediana: 1500, soglia: 5000, sopraSoglia: 1, famose: ['B (6000)'] });
        expect(famositaReport(tappe, 'Troina', cand)).toMatchObject({ soglia: 1000, sopraSoglia: 2 });
        expect(famositaReport(tappe.slice(0, 2), 'Roma', cand).mediana).toBe(3100);
    });

    it('il resoconto "Per Te" porta la famosita\' delle tappe servite', async () => {
        const CULTURA = [poi('c1', 'Pantheon', 1, { user_ratings_total: 90000 }), poi('c2', 'San Clemente', 1.1, { user_ratings_total: 300 }), poi('c3', 'Santa Prassede', 1.2, { user_ratings_total: 200 })];
        vi.stubGlobal('fetch', homeFetch({ tours: [{ themeType: 'cultura', title: 'Cultura', stops: [stop('c1'), stop('c2'), stop('c3')] }] }));
        const res = await home({ cultura: CULTURA });
        expect(res._report.famosita).toMatchObject({ tappe: 3, mediana: 300, sopraSoglia: 1, soglia: 5000 });
        expect(res._report.ovvieta).toBeDefined(); // resta, per confronto
    });
});
