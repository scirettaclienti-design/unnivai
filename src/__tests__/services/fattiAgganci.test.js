// P3d-h — Fatti più trovabili: tre modi di agganciare una tappa a una voce,
// in ordine di fiducia, e gli agganci dubbi scartati.
//
//   1. OSM esatto: l'elemento OSM della tappa porta wikipedia/wikidata;
//   2. ricerca su Wikipedia per nome + città, accettata solo nel raggio del tipo;
//   3. ricerca per coordinate nel raggio del tipo, con abbinamento del nome.
//
// I dati delle risposte sono quelli veri delle tappe P3d-e (misurati il
// 09/10/2026): Rupe Tarpea a 23 m dal Belvedere Tarpeo, Galleria Colonna in
// OSM con wikipedia=it:Palazzo Colonna, la pagina di disambiguazione "Porta
// Garibaldi", la "Villa Pamphili" zona urbanistica, la Basilica dei XII
// Apostoli di Lodi Vecchio.
//
// Rosso sul codice di prima (afe78f5): solo geosearch entro 100 m, nessuna
// ricerca per nome, nessun aggancio dal tag OSM se il titolo era diverso.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const cacheRows = { value: [] };
const rpcCalls = [];
vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: () => ({ select: () => ({ in: async () => ({ data: cacheRows.value, error: null }) }) }),
        rpc: async (fn, args) => { rpcCalls.push({ fn, args }); return { data: 0, error: null }; },
    },
}));

import {
    fetchFactsForStops, acceptArticle, coreName, namesMatch, radiusForKinds, stopKinds,
} from '../../services/factsService';

const page = (title, description, extract, coords = null) => ({
    title, description, descriptionsource: 'central', extract,
    ...(coords ? { coordinates: [{ lat: coords[0], lon: coords[1] }] } : {}),
});
// Coordinate vere (Google) delle tappe P3d-e.
const TARPEO = { place_id: 'ChIJtarpeo_belvedere', name: 'Belvedere Tarpeo', lat: 41.8916005, lng: 12.4824864, types: ['tourist_attraction'] };
const COLONNA = { place_id: 'ChIJgalleria_colonna', name: 'Galleria Colonna', lat: 41.8975648, lng: 12.4847388, types: ['museum'] };
const APOSTOLI = { place_id: 'ChIJbasilica_apostoli', name: 'Basilica dei Santi XII Apostoli', lat: 41.8982697, lng: 12.4829881, types: ['church', 'place_of_worship'] };
const PORTA = { place_id: 'ChIJporta_garibaldi_ct', name: 'Porta Garibaldi', lat: 37.4996307, lng: 15.0739144, types: ['tourist_attraction'] };
const INGRESSO = { place_id: 'ChIJingresso_pamphili', name: 'Ingresso di Villa Pamphili', lat: 41.8905967, lng: 12.4329212, types: ['park'] };
const TRATTORIA = { place_id: 'ChIJtrattoria_stampa', name: 'Trattoria Della Stampa', lat: 41.9, lng: 12.48, types: ['restaurant', 'food'] };

const RUPE = page('Rupe Tarpea', 'Rupe del colle Campidoglio a Roma', 'La rupe Tarpea è la parete rocciosa posta sul lato meridionale del Campidoglio a Roma.', [41.8914, 12.4826]);
const TARPEA = page('Tarpea', 'vergine vestale ai tempi di Romolo', 'Tarpea fu una vestale.');
const PALAZZO_COLONNA = page('Palazzo Colonna', 'palazzo storico di Roma', 'Palazzo Colonna è un palazzo di Roma che ospita la Galleria Colonna.', [41.8981, 12.4862]);
const APOSTOLI_ROMA = page('Basilica dei Santi XII Apostoli', 'edificio religioso di Roma', 'La basilica dei Santi XII Apostoli è un luogo di culto cattolico del centro storico di Roma.', [41.8984, 12.4831]);
const APOSTOLI_LODI = page('Basilica dei XII Apostoli', 'chiesa di Lodi Vecchio', 'La basilica è a Lodi Vecchio.', [45.3005, 9.4174]);
const PORTA_DISAMB = page('Porta Garibaldi', 'pagina di disambiguazione di un progetto Wikimedia', 'Porta Garibaldi può riferirsi a…');
const VILLA_ZONA = page('Villa Pamphili', 'zona urbanistica di Roma', 'Villa Pamphili è la zona urbanistica 16E di Roma.', [41.8883, 12.4383]);
const VILLA_DORIA = page('Villa Doria Pamphilj', 'villa storica di Roma', 'Villa Doria Pamphilj è una residenza storica con il terzo parco pubblico di Roma.', [41.8865, 12.4486]);

/**
 * Un finto Wikipedia/Overpass: `search` per testo cercato, `geo` per tappa
 * (latitudine), `pages` per titolo, `osm` gli elementi di Overpass.
 */
const fakeNet = ({ search = {}, geo = {}, pages = {}, osm = [] } = {}) => {
    const calls = [];
    const fetchImpl = vi.fn(async (url, init) => {
        const u = String(url);
        calls.push(u);
        if (u.includes('overpass')) return { ok: true, json: async () => ({ elements: osm }) };
        const q = new URL(u).searchParams;
        if (q.get('generator') === 'search') {
            const hit = Object.keys(search).find(k => q.get('gsrsearch').startsWith(k));
            return { ok: true, json: async () => ({ query: { pages: (hit ? search[hit] : []).map((p, i) => ({ ...p, index: i + 1 })) } }) };
        }
        if (q.get('list') === 'geosearch') {
            const lat = Number(q.get('gscoord').split('|')[0]);
            const hit = Object.keys(geo).find(k => Math.abs(Number(k) - lat) < 1e-6);
            return { ok: true, json: async () => ({ query: { geosearch: hit ? geo[hit] : [] } }) };
        }
        if (q.get('titles')) {
            const want = q.get('titles').split('|');
            return { ok: true, json: async () => ({ query: { pages: want.map(t => pages[t]).filter(Boolean) } }) };
        }
        if (u.includes('wikidata')) return { ok: true, json: async () => ({ entities: {} }) };
        throw new Error(`inatteso: ${u}`);
    });
    return { fetchImpl, calls };
};
const run = (stops, net, city = 'Roma') => fetchFactsForStops(stops, { city, fetchImpl: net.fetchImpl });

beforeEach(() => { cacheRows.value = []; rpcCalls.length = 0; });

describe('P3d-h — i tre agganci', () => {
    it('(1) OSM esatto: "Galleria Colonna" con wikipedia=it:Palazzo Colonna → la voce del palazzo, anche se il nome e\' diverso', async () => {
        const net = fakeNet({
            search: { 'Galleria Colonna': [PALAZZO_COLONNA] }, // dalla ricerca da solo NON passerebbe (nome diverso)
            pages: { 'Palazzo Colonna': PALAZZO_COLONNA },
            osm: [{ type: 'node', id: 1649776329, lat: 41.8975, lon: 12.4848, tags: { name: 'Galleria Colonna', tourism: 'gallery', wikidata: 'Q1971299', wikipedia: 'it:Palazzo Colonna' } }],
        });
        const r = await run([COLONNA], net);
        const e = r.byId.get(COLONNA.place_id);
        expect(e.aggancio).toMatchObject({ metodo: 'osm', titolo: 'Palazzo Colonna' });
        expect(e.fatti[0].testo).toContain('Galleria Colonna');
        expect(e.fonti.map(f => f.fonte)).toEqual(['wikipedia']);
    });

    it('(1) senza l\'elemento OSM, "Galleria Colonna" resta senza fatti: la ricerca da sola non aggancia il palazzo', async () => {
        const net = fakeNet({ search: { 'Galleria Colonna': [PALAZZO_COLONNA] }, pages: { 'Palazzo Colonna': PALAZZO_COLONNA } });
        const r = await run([COLONNA], net);
        expect(r.byId.get(COLONNA.place_id).fatti).toEqual([]);
    });

    it('(2) ricerca per nome + citta\': "Belvedere Tarpeo" → "Rupe Tarpea" (23 m), la vestale "Tarpea" scartata', async () => {
        const net = fakeNet({ search: { 'Tarpeo Roma': [RUPE, TARPEA] } });
        const r = await run([TARPEO], net);
        const e = r.byId.get(TARPEO.place_id);
        expect(e.aggancio).toMatchObject({ metodo: 'ricerca', titolo: 'Rupe Tarpea' });
        expect(e.aggancio.distanza).toBeLessThan(50);
        expect(e.fatti[0]).toEqual({ testo: 'La rupe Tarpea è la parete rocciosa posta sul lato meridionale del Campidoglio a Roma.', fonte: 'wikipedia' });
        expect(net.calls.some(u => u.includes('list=geosearch'))).toBe(false); // trovata per nome: niente coordinate
        expect(r.report.scartati.some(x => x.titolo === 'Tarpea')).toBe(true);
    });

    it('(3) per coordinate: la ricerca per nome non trova, il geosearch nel raggio della chiesa (200 m) si', async () => {
        const net = fakeNet({
            geo: { [APOSTOLI.lat]: [{ title: 'Basilica dei Santi XII Apostoli', dist: 20, lat: 41.8984, lon: 12.4831 }, { title: 'Palazzo Odescalchi', dist: 60 }] },
            pages: { 'Basilica dei Santi XII Apostoli': APOSTOLI_ROMA },
        });
        const r = await run([APOSTOLI], net);
        const e = r.byId.get(APOSTOLI.place_id);
        expect(e.aggancio).toMatchObject({ metodo: 'coordinate', titolo: 'Basilica dei Santi XII Apostoli' });
        const geo = net.calls.find(u => u.includes('list=geosearch'));
        expect(new URL(geo).searchParams.get('gsradius')).toBe('200');
    });

    it('ordine di fiducia: con OSM e ricerca entrambi buoni, vince OSM', async () => {
        const net = fakeNet({
            search: { 'Porta Garibaldi Catania': [page('Porta Garibaldi (Catania)', 'porta cittadina di Catania', 'La porta Ferdinandea, dopo il 1860 intitolata porta Garibaldi, è un arco trionfale.', [37.4996, 15.0739])] },
            pages: { 'Porta Garibaldi (Catania)': page('Porta Garibaldi (Catania)', 'porta cittadina di Catania', 'La porta Ferdinandea…', [37.4996, 15.0739]) },
            osm: [{ type: 'way', id: 1, bounds: { minlat: 37.4995, minlon: 15.0738, maxlat: 37.4997, maxlon: 15.0740 }, tags: { name: 'Porta Garibaldi', historic: 'city_gate', wikipedia: 'it:Porta Garibaldi (Catania)' } }],
        });
        const r = await run([PORTA], net, 'Catania');
        expect(r.byId.get(PORTA.place_id).aggancio.metodo).toBe('osm');
    });
});

describe('P3d-h — gli agganci dubbi si scartano (un fatto sbagliato e\' peggio di nessun fatto)', () => {
    it('pagina di disambiguazione: "Porta Garibaldi" senza citta\' → scartata, vince "Porta Garibaldi (Catania)"', async () => {
        const giusta = page('Porta Garibaldi (Catania)', 'porta cittadina di Catania', 'La porta Ferdinandea, dopo il 1860 intitolata porta Garibaldi, è un arco trionfale costruito nel 1768.', [37.49962, 15.07392]);
        const net = fakeNet({ search: { 'Porta Garibaldi Catania': [PORTA_DISAMB, giusta] } });
        const r = await run([PORTA], net, 'Catania');
        expect(r.byId.get(PORTA.place_id).aggancio.titolo).toBe('Porta Garibaldi (Catania)');
        expect(r.report.scartati.find(x => x.titolo === 'Porta Garibaldi').motivo).toMatch(/non e' un luogo/);
    });

    it('omonima lontana: la "Basilica dei XII Apostoli" di Lodi Vecchio (450 km) → fuori raggio', () => {
        const r = acceptArticle(APOSTOLI, APOSTOLI_LODI, { city: 'Roma' });
        expect(r.ok).toBe(false);
        expect(r.motivo).toMatch(/fuori raggio/);
    });

    it('zona urbanistica: "Villa Pamphili" (zona 16E) non e\' il parco → scartata', () => {
        expect(acceptArticle(INGRESSO, VILLA_ZONA, { city: 'Roma' })).toMatchObject({ ok: false });
        expect(acceptArticle(INGRESSO, VILLA_ZONA, { city: 'Roma' }).motivo).toMatch(/zona urbanistica/);
    });

    it('stesso nome, troppo lontano: "Ingresso di Villa Pamphili" → "Villa Doria Pamphilj" a 1,5 km → oltre gli 800 m del parco', () => {
        const r = acceptArticle(INGRESSO, VILLA_DORIA, { city: 'Roma' });
        expect(r.ok).toBe(false);
        expect(r.motivo).toMatch(/fuori raggio \(1\d{3} m > 800 m\)/);
    });

    it('nome diverso: "Terrazza Belvedere Aventino" non e\' il "Lungotevere Aventino"', () => {
        expect(acceptArticle({ name: 'Terrazza Belvedere Aventino', lat: 41.8854348, lng: 12.479942, types: [] },
            page('Lungotevere Aventino', 'lungotevere di Roma', 'Il lungotevere…', [41.8862, 12.4790]), { city: 'Roma' }).motivo).toBe('nome diverso');
    });

    it('senza coordinate non si verifica: la vestale "Tarpea" e "Terrazza del Pincio" (voce senza coordinate) scartate', () => {
        expect(acceptArticle(TARPEO, TARPEA, { city: 'Roma' }).ok).toBe(false);
        expect(acceptArticle({ name: 'Terrazza del Pincio', lat: 41.9111, lng: 12.4779, types: [] },
            page('Terrazza del Pincio', null, 'La terrazza…'), { city: 'Roma' })).toEqual({ ok: false, motivo: 'senza coordinate' });
    });

    it('OSM: un elemento con lo stesso pezzo di nome ma un altro posto ("Faro del Gianicolo") non aggancia il Gianicolo Belvedere', async () => {
        const net = fakeNet({
            osm: [{ type: 'node', id: 2, lat: 41.8917, lon: 12.4612, tags: { name: 'Faro del Gianicolo', man_made: 'lighthouse', wikipedia: 'it:Faro del Gianicolo' } }],
            pages: { 'Faro del Gianicolo': page('Faro del Gianicolo', 'monumento di Roma', 'Il faro fu donato nel 1911.', [41.8917, 12.4612]) },
        });
        const r = await run([{ place_id: 'ChIJgianicolo_belv', name: 'Gianicolo Belvedere', lat: 41.8915625, lng: 12.4611054, types: [] }], net);
        expect(r.byId.get('ChIJgianicolo_belv').fatti).toEqual([]);
    });
});

describe('P3d-h — nomi normalizzati e raggi per tipo', () => {
    it('via "Ingresso di", "Belvedere", "Terrazza"; Pamphilj = Pamphili; Tarpeo = Rupe Tarpea; accenti', () => {
        expect(coreName('Ingresso di Villa Pamphili')).toBe('villa pamphili');
        expect(coreName('Terrazza del Pincio')).toBe('del pincio');
        expect(coreName('Gianicolo Belvedere')).toBe('gianicolo');
        expect(namesMatch('Villa Doria Pamphili', 'Villa Doria Pamphilj', 'Roma')).toBe(true);
        expect(namesMatch('Belvedere Tarpeo', 'Rupe Tarpea', 'Roma')).toBe(true);
        expect(namesMatch('Gianicolo Belvedere', 'Gianicolo', 'Roma')).toBe(true);
        expect(namesMatch('Piazza Duomo', 'Piazza del Duòmo', 'Catania')).toBe(true);
        // ma la parola in piu' deve essere un'altura, non un altro edificio
        expect(namesMatch('Belvedere Salviati', 'Palazzo Salviati', 'Roma')).toBe(false);
        expect(namesMatch('Galleria Colonna', 'Palazzo Colonna', 'Roma')).toBe(false);
    });

    it('raggi: monumento/chiesa/museo 200 m, piazza/belvedere/porta 300 m, parco/villa/colle 800 m', () => {
        expect(radiusForKinds(stopKinds({ name: 'Musei Capitolini', types: ['museum'] }))).toBe(200);
        expect(radiusForKinds(stopKinds({ name: 'Basilica dei Santi XII Apostoli', types: ['church'] }))).toBe(200);
        expect(radiusForKinds(stopKinds({ name: 'Piazza del Campidoglio', types: [] }))).toBe(300);
        expect(radiusForKinds(stopKinds({ name: 'Belvedere Tarpeo', types: [] }))).toBe(300);
        expect(radiusForKinds(stopKinds({ name: 'Porta Garibaldi', types: [] }))).toBe(300);
        expect(radiusForKinds(stopKinds({ name: 'Villa Doria Pamphili', types: ['park'] }))).toBe(800);
        expect(radiusForKinds(stopKinds({ name: 'Gianicolo', types: [] }))).toBe(200); // nome senza tipo: il minimo
        expect(radiusForKinds(new Set(['altura']))).toBe(800);
    });
});

describe('P3d-h — locali e cache', () => {
    it('locali e ristoranti: nessun fatto e nessuna richiesta (decisione G)', async () => {
        const net = fakeNet();
        const r = await run([TRATTORIA], net);
        expect(r.byId.get(TRATTORIA.place_id)).toEqual({ fatti: [], fonti: [] });
        expect(net.calls).toEqual([]);
        expect(r.report.locali).toBe(1);
    });

    it('una riga "senza fatti" in place_facts non impedisce la nuova ricerca', async () => {
        cacheRows.value = [{ place_id: TARPEO.place_id, fatti: [], fonti: [], data: new Date().toISOString() }];
        const net = fakeNet({ search: { 'Tarpeo Roma': [RUPE] } });
        const r = await fetchFactsForStops([TARPEO], { city: 'Roma', fetchImpl: net.fetchImpl });
        expect(r.report.daCache).toBe(0);
        expect(r.byId.get(TARPEO.place_id).aggancio.titolo).toBe('Rupe Tarpea');
    });

    it('una riga CON fatti fresca vale: nessuna richiesta a Wikipedia', async () => {
        cacheRows.value = [{ place_id: TARPEO.place_id, fatti: [{ testo: 'La rupe Tarpea…', fonte: 'wikipedia' }], fonti: [], data: new Date().toISOString() }];
        const net = fakeNet();
        const r = await fetchFactsForStops([TARPEO], { city: 'Roma', fetchImpl: net.fetchImpl });
        expect(r.report.daCache).toBe(1);
        expect(net.calls.filter(u => u.includes('wikipedia'))).toEqual([]);
    });
});

describe('P3d-h — Overpass oltre il tetto: la generazione non aspetta, i fatti vanno in cache', () => {
    it('Galleria Colonna: OSM arriva dopo il tetto → subito nessun fatto, poi la riga in cache con il palazzo', async () => {
        const OSM_COLONNA = [{ type: 'node', id: 1649776329, lat: 41.8975, lon: 12.4848, tags: { name: 'Galleria Colonna', tourism: 'gallery', wikipedia: 'it:Palazzo Colonna' } }];
        const fetchImpl = vi.fn(async (url) => {
            const u = String(url);
            if (u.includes('overpass')) {
                await new Promise(r => { setTimeout(r, 150); }); // piu' lento del tetto (60 ms)
                return { ok: true, json: async () => ({ elements: OSM_COLONNA }) };
            }
            const q = new URL(u).searchParams;
            if (q.get('generator') === 'search') return { ok: true, json: async () => ({ query: { pages: [{ ...PALAZZO_COLONNA, index: 1 }] } }) };
            if (q.get('list') === 'geosearch') return { ok: true, json: async () => ({ query: { geosearch: [] } }) };
            if (q.get('titles')) return { ok: true, json: async () => ({ query: { pages: [PALAZZO_COLONNA] } }) };
            throw new Error(`inatteso: ${u}`);
        });
        const t0 = Date.now();
        const r = await fetchFactsForStops([COLONNA], { city: 'Roma', fetchImpl, budgetMs: 60 });
        expect(Date.now() - t0).toBeLessThan(140); // non ha aspettato Overpass
        expect(r.report.timeout).toBe(true);
        expect(r.report.osmInSottofondo).toBe(true);
        expect(r.byId.get(COLONNA.place_id).fatti).toEqual([]);
        await new Promise(res => { setTimeout(res, 250); });
        const scritta = rpcCalls.find(c => c.fn === 'save_place_facts');
        expect(scritta).toBeTruthy();
        expect(scritta.args.p_rows[0].place_id).toBe(COLONNA.place_id);
        expect(scritta.args.p_rows[0].fonti[0].url).toBe('https://it.wikipedia.org/wiki/Palazzo_Colonna');
    });
});

describe('P3d-h — fatti OSM e nomi doppi (verifica a mano)', () => {
    it('il fatto OSM di un luogo piu\' grande porta il suo nome: "Pincio: parco." per la Terrazza del Pincio', async () => {
        const net = fakeNet({
            osm: [{ type: 'relation', id: 14026944, bounds: { minlat: 41.909, minlon: 12.476, maxlat: 41.913, maxlon: 12.481 }, tags: { name: 'Pincio', leisure: 'park' } }],
        });
        const st = { place_id: 'ChIJterrazza_pincio', name: 'Terrazza del Pincio', lat: 41.9111207, lng: 12.4779391, types: ['tourist_attraction'] };
        const r = await run([st], net);
        expect(r.byId.get(st.place_id).fatti).toEqual([{ testo: 'Pincio: parco.', fonte: 'osm' }]);
    });

    it('nome doppio "A · B": si abbina solo A (il belvedere non prende i fatti della Passeggiata)', async () => {
        const net = fakeNet({
            osm: [{ type: 'way', id: 583506757, bounds: { minlat: 41.890, minlon: 12.459, maxlat: 41.894, maxlon: 12.463 }, tags: { name: 'Passeggiata del Gianicolo', leisure: 'park' } }],
        });
        const st = { place_id: 'ChIJbelvedere_salviati', name: 'Belvedere del Salviati · Terrazza Panoramica Passeggiata del Gianicolo', lat: 41.8917246, lng: 12.4611328, types: [] };
        const r = await run([st], net);
        expect(r.byId.get(st.place_id).fatti).toEqual([]);
    });
});
