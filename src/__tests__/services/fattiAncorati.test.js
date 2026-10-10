// P3d-e — Narratore ancorato ai fatti.
//
// Il narratore scrive solo cose vere: per i luoghi riceve fatti aperti
// (Wikipedia, Wikidata, OpenStreetMap) sulle tappe FINALI; per i locali i dati
// della scelta (fascia di prezzo, minuti dalla tappa prima, motivo). Una frase
// che nomina un oggetto concreto assente dai fatti e dal nome si toglie e si
// riscrive una volta; se fallisce ancora, frase sicura costruita dal codice.
// Mai una descrizione vuota. Le fonti a schermo solo dove servono.
//
// Rosso sul codice di prima (acc74ba): nessun campo "fatti" al narratore,
// nessun dato dei locali, "albero" passava, la tappa restava muta, nessuna
// riga delle fonti.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, cleanup } from '@testing-library/react';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import {
    fetchFactsForStops, nameMatchScore, namesMatch, wikipediaFacts, stopKinds, kindsCompatible, buildOverpassQuery,
} from '../../services/factsService';
import { CONCRETE_OBJECTS, filterInventedObjects, inventedObjects } from '../../lib/narrationLight';
import { TourStopsByMoment } from '../../components/TourStopsByMoment';

const ROMA = { latitude: 41.8986, longitude: 12.4769, isSmallTown: false, radiusKm: 10 };
let seq = 0;
const place = (name, types, dLat, dLng, extra = {}) => ({
    place_id: `pf-${++seq}-${name.replace(/\W+/g, '-').toLowerCase()}`,
    name,
    geometry: { location: { lat: ROMA.latitude + dLat, lng: ROMA.longitude + dLng } },
    rating: 4.6, user_ratings_total: 400, business_status: 'OPERATIONAL', types, ...extra,
});
const MUSEO = ['museum', 'tourist_attraction', 'point_of_interest', 'establishment'];
const RISTO = ['restaurant', 'food', 'point_of_interest', 'establishment'];
const BAR = ['bar', 'point_of_interest', 'establishment'];

const CAPITOLINI = place('Musei Capitolini', MUSEO, 0.002, 0.000);
const MUSEI = [CAPITOLINI, place('Galleria Doria Pamphilj', MUSEO, -0.002, 0.004), place('Museo Barracco', MUSEO, -0.001, -0.002)];
const TRATTORIA = place('Trattoria Da Enzo', RISTO, 0.000, 0.003, { price_level: 2 });
const TRATTORIE = [TRATTORIA, place('Da Teo', RISTO, -0.011, 0.001, { price_level: 2 })];
const BARS = [place('Enoteca Il Goccetto', BAR, -0.003, -0.006)];
const PERQUERY = { museo: MUSEI, trattoria: TRATTORIE, enoteca: BARS };
const INTENT = { queries: ['museo', 'trattoria', 'enoteca'], categoria: 'misto', oggetto_umano: 'la Roma dei romani', vincoli: { tempo: null, escludi: [], note: null } };
const SELECTOR = { stops: [
    { place_id: CAPITOLINI.place_id, moment: 'g1-mattina' },
    { place_id: TRATTORIA.place_id, moment: 'g1-pranzo' },
    { place_id: MUSEI[1].place_id, moment: 'g1-pomeriggio' },
    { place_id: BARS[0].place_id, moment: 'g1-aperitivo' },
    { place_id: TRATTORIE[1].place_id, moment: 'g1-cena' },
] };

// I fatti veri dei Musei Capitolini (estratto Wikipedia, 09/10/2026).
const CAPITOLINI_EXTRACT = "I Musei Capitolini costituiscono la principale struttura museale civica comunale di Roma. Aperti al pubblico nell'anno 1734, sotto papa Clemente XII, sono considerati il primo museo pubblico al mondo.";

let calls;
let rewriteFn;
let wikiMode; // 'ok' | 'hang'
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
            payload = rewriteFn(JSON.parse(user.split('TAPPE:\n')[1]));
        } else { kind = 'selettore'; payload = SELECTOR; }
        calls.push({ kind, body, user });
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }], usage: { total_tokens: 100 } }) };
    }
    if (u.includes('it.wikipedia.org')) {
        if (wikiMode === 'hang') {
            return new Promise((resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
            });
        }
        const q = new URL(u).searchParams;
        if (q.get('list') === 'geosearch') {
            const [lat] = q.get('gscoord').split('|').map(Number);
            const vicino = Math.abs(lat - CAPITOLINI.geometry.location.lat) < 0.0005;
            return { ok: true, json: async () => ({ query: { geosearch: vicino ? [{ title: 'Musei Capitolini', dist: 12 }, { title: 'Ritratto di Commodo come Ercole', dist: 30 }] : [] } }) };
        }
        if (q.get('prop')?.includes('extracts')) {
            return { ok: true, json: async () => ({ query: { pages: [{ title: 'Musei Capitolini', extract: CAPITOLINI_EXTRACT, description: 'museo civico della città di Roma, Italia', descriptionsource: 'central' }] } }) };
        }
    }
    if (u.includes('overpass')) return { ok: true, json: async () => ({ elements: [] }) };
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
const narratorTappe = () => JSON.parse(calls.find(c => c.kind === 'narratore').user.split('TAPPE FINALI:\n')[1]).flatMap(g => g.tappe);
const PULITA = 'Una tappa da guardare con calma.';

// P3d-j — "i fatti arrivano al narratore" e la riscrittura anti-invenzione sono
// sostituiti dalla composizione (narratoreComposto.test.js): il fatto entra
// nella frase solo come prima frase intera, scelto con usaFatto.

describe('P3d-e — fetchFactsForStops: abbinamento stretto e tetto di tempo', () => {
    afterEach(() => { vi.useRealTimers(); });

    it('nome stretto: stesse parole sul nome PIU\' LUNGO (diagnosi P3d-f)', () => {
        expect(namesMatch('Musei Capitolini', 'Musei Capitolini', 'Roma')).toBe(true);
        expect(namesMatch('Museo Centrale del Risorgimento', 'Museo centrale del Risorgimento al Vittoriano', 'Roma')).toBe(true);
        expect(namesMatch('Museo Nazionale Romano, Palazzo Massimo alle Terme', 'Museo nazionale romano di palazzo Massimo', 'Roma')).toBe(true);
        // i falsi abbinamenti visti nella diagnosi
        // P3d-h: "Gianicolo Belvedere" → "Gianicolo" ora SI' (il belvedere e' sul
        // colle; "Belvedere" non fa il nome): lo tengono vero il raggio e il tipo.
        expect(namesMatch('Gianicolo Belvedere', 'Gianicolo', 'Roma')).toBe(true);
        expect(namesMatch('Terrazza Belvedere Aventino', 'Lungotevere Aventino', 'Roma')).toBe(false);
        expect(namesMatch('Palazzo degli Elefanti', "Palazzo dell'Università (Catania)", 'Catania')).toBe(false);
        expect(namesMatch("Giardino di Sant'Alessio", 'Basilica dei Santi Bonifacio e Alessio', 'Roma')).toBe(false);
        expect(namesMatch('Galleria Colonna', 'Palazzo Colonna', 'Roma')).toBe(false);
        expect(nameMatchScore('Al Massimo', 'Museo Nazionale Romano, Palazzo Massimo alle Terme', 'Roma')).toBeLessThan(0.6);
    });

    it('tipo compatibile: un museo non prende i fatti di un caffe\', una piazza quelli di una piazza', () => {
        expect(kindsCompatible(stopKinds({ name: 'Musei Capitolini', types: ['museum'] }), stopKinds({ name: 'Al Massimo', types: ['cafe'] }))).toBe(false);
        expect(kindsCompatible(stopKinds({ name: 'Piazza del Quirinale', types: ['establishment'] }), stopKinds({ name: 'piazza di Roma' }))).toBe(true);
    });

    // P3d-h — raggio per tipo (parco 800 m, museo 200 m) e nome per radice.
    it('Overpass: UNA sola interrogazione per tutte le tappe, raggio per tipo', () => {
        const q = buildOverpassQuery([
            { name: 'Giardino degli Aranci', lat: 41.885, lng: 12.48, types: ['park'] },
            { name: 'Musei Capitolini', lat: 41.893, lng: 12.482, types: ['museum'] },
        ], 'Roma');
        expect(q.match(/nwr\(around:/g)).toHaveLength(2);
        expect(q).toContain('nwr(around:800,41.885,12.48)');
        expect(q).toContain('nwr(around:200,41.893,12.482)["name"~"capitolin",i]');
        expect(q.startsWith('[out:json]')).toBe(true);
    });

    it('i fatti di Wikipedia: le prime frasi, senza parentesi', () => {
        const f = wikipediaFacts('Il giardino degli Aranci (o parco Savello) è un parco di Roma. Si trova sull\'Aventino. Terza frase. Quarta.');
        expect(f).toEqual(['Il giardino degli Aranci è un parco di Roma.', "Si trova sull'Aventino.", 'Terza frase.']);
    });

    it('oltre il tetto: nessun fatto, report.timeout, e le richieste vengono interrotte', async () => {
        vi.useFakeTimers();
        let aborted = 0;
        const fetchImpl = vi.fn((url, init) => new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => { aborted += 1; reject(new Error('aborted')); });
        }));
        const p = fetchFactsForStops([{ place_id: 'ChIJ_test_capitolini', name: 'Musei Capitolini', lat: 41.893, lng: 12.482, types: ['museum'] }],
            { city: 'Roma', fetchImpl, useCache: false });
        await vi.advanceTimersByTimeAsync(4000);
        const r = await p;
        expect(r.report.timeout).toBe(true);
        expect(r.byId.get('ChIJ_test_capitolini')?.fatti || []).toEqual([]);
        expect(aborted).toBeGreaterThan(0);
    });

    it('User-Agent identificato verso Wikimedia (Api-User-Agent) e fuori dal browser anche User-Agent', async () => {
        const seen = [];
        const fetchImpl = vi.fn(async (url, init) => {
            seen.push({ url: String(url), headers: init?.headers || {} });
            return { ok: true, json: async () => (String(url).includes('overpass') ? { elements: [] } : { query: { geosearch: [] } }) };
        });
        await fetchFactsForStops([{ place_id: 'ChIJ_test_ua', name: 'Musei Capitolini', lat: 41.893, lng: 12.482, types: ['museum'] }],
            { city: 'Roma', fetchImpl, useCache: false });
        const wiki = seen.find(x => x.url.includes('wikipedia'));
        expect(wiki.headers['Api-User-Agent']).toMatch(/^Unnivai\//);
        expect(wiki.headers['User-Agent']).toMatch(/^Unnivai\//);
        expect(seen.filter(x => x.url.includes('overpass'))).toHaveLength(1);
    });
});

describe('P3d-e — il controllo anti-invenzione: elenco esplicito, ogni oggetto testato', () => {
    // Una frase per oggetto dell'elenco: senza fatti va tolta, con l'oggetto nei
    // fatti (o nel nome) resta.
    const FRASI = {
        albero: "Sotto l'albero c'è ombra.", pini: 'I pini fanno ombra.', palme: 'Le palme segnano il viale.',
        ulivi: 'Gli ulivi sono antichi.', aranci: 'Gli aranci fanno ombra.', giardino: 'Il giardino è sul retro.',
        prato: 'Il prato è curato.', fiori: 'I fiori sono gialli.', laghetto: 'Il laghetto è al centro.',
        acqua: "L'acqua è limpida.", finestra: 'Dalla finestra si vede il fiume.', fontana: 'La fontana è al centro.',
        scala: 'La scala porta su.', terrazza: 'La terrazza guarda la città.', soffitti: 'I soffitti sono alti.',
        cupola: 'La cupola domina.', campanile: 'Il campanile è storto.', colonne: 'Le colonne sono di marmo.',
        portico: 'Il portico ripara.', cortile: 'Il cortile è interno.', chiostro: 'Il chiostro è quieto.',
        balcone: 'Il balcone dà sulla via.', ponte: 'Il ponte è vicino.', torre: 'La torre è alta.',
        cancello: 'Il cancello è di ferro.', tetti: 'Si vedono i tetti rossi.', panchina: 'Una panchina guarda il mare.', murales: 'I murales coprono il muro.',
        quadri: 'I quadri sono piccoli.', affreschi: 'Gli affreschi sono chiari.', statua: 'La statua è in bronzo.',
        mosaici: 'I mosaici sono dorati.', vetrate: 'Le vetrate sono colorate.', altare: "L'altare è in fondo.",
        tavolini: 'I tavolini sono fuori.', bancone: 'Il bancone è lungo.', 'forno a legna': "C'è un forno a legna.",
        pergola: 'Si mangia sotto la pergola.', dehors: 'Il dehors è ampio.', 'cucina a vista': "C'è la cucina a vista.",
        vino: 'Il vino è della casa.', pizza: 'La pizza è sottile.', gelato: 'Il gelato è artigianale.',
        pesce: 'Il pesce è fresco.', carbonara: 'La carbonara è cremosa.', amatriciana: "L'amatriciana è piccante.",
        'cacio e pepe': 'La cacio e pepe è densa.', suppli: 'Il supplì è grande.', carciofi: 'I carciofi sono fritti.',
        arancini: 'Gli arancini sono caldi.', cannoli: 'I cannoli sono freschi.', granita: 'La granita è al limone.',
        maritozzo: 'Il maritozzo è pieno.', tiramisu: 'Il tiramisù è della casa.', cornetto: 'Il cornetto è caldo.',
    };

    it('l\'elenco ha una frase di prova per ogni oggetto', () => {
        expect(Object.keys(FRASI).sort()).toEqual(CONCRETE_OBJECTS.map(o => o.nome).sort());
    });

    for (const o of CONCRETE_OBJECTS) {
        it(`"${o.nome}": tolto senza fatti, salvo con i fatti`, () => {
            const frase = FRASI[o.nome];
            expect(inventedObjects(frase, ''), frase).toContain(o.nome);
            expect(inventedObjects(frase, frase), frase).not.toContain(o.nome);
        });
    }

    it('il nome della tappa vale come fatto ("Giardino degli Aranci" ammette giardino e aranci)', () => {
        const r = filterInventedObjects('Il giardino è sul colle e gli aranci fanno ombra.', { fatti: [], nomi: ['Giardino degli Aranci'] });
        expect(r.removed).toEqual([]);
    });

    it('i fatti larghi: "Pinacoteca" nei fatti ammette i quadri', () => {
        expect(inventedObjects('I quadri sono al secondo piano.', 'fu aggiunta la Pinacoteca Capitolina')).toEqual([]);
    });

    it('frase senza oggetti concreti → resta', () => {
        expect(filterInventedObjects('Aperti nel 1734, il primo museo pubblico al mondo.', { fatti: [] }).removed).toEqual([]);
    });
});

// P3d-i — la frase sicura ha la sua voce: varianti fisse per tappa, sempre un
// verbo, l'orario come gancio. Qui si provano i DATI che deve portare.
// P3d-j — la frase sicura e' sostituita dalle frasi approvate (stopPhrases.test.js).

describe('P3d-e — la riga delle fonti compare solo dove serve', () => {
    afterEach(() => cleanup());

    it('sotto la tappa con fonti sì (con i link), sotto una frase senza fatto no', () => {
        const stops = [
            { title: 'Musei Capitolini', description: 'Aperti nel 1734.', fonti: [
                { fonte: 'wikipedia', url: 'https://it.wikipedia.org/wiki/Musei_Capitolini', titolo: 'Musei Capitolini' },
                { fonte: 'osm', url: 'https://www.openstreetmap.org/way/1', titolo: 'Musei Capitolini' },
            ] },
            { title: 'Trattoria Da Enzo', description: 'Per il pranzo: trattoria, fascia €€.', fonti: null },
        ];
        const { container } = render(createElement(TourStopsByMoment, { stops }));
        const righe = container.querySelectorAll('[data-fact-sources]');
        expect(righe).toHaveLength(1);
        expect(righe[0].textContent).toBe('Fonti: Wikipedia (CC BY-SA) · © OpenStreetMap contributors');
        const links = [...righe[0].querySelectorAll('a')].map(a => a.getAttribute('href'));
        expect(links).toContain('https://it.wikipedia.org/wiki/Musei_Capitolini');
        expect(links).toContain('https://www.openstreetmap.org/copyright');
    });
});
