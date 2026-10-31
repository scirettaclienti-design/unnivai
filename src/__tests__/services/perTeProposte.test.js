import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// PER-TE-PROPOSTE — Per Te mostra sempre almeno 4 proposte, a qualsiasi ora; quelle che non si fanno adesso lo dicono.
// Dati finti di Roma (pool dei temi con gli orari), tre ore: 01:00, 13:00, 20:00. Nessuna rete vera: la chiamata AI dei temi è un
// fetch finto, il motore della sera è finto (restituisce il giro della sera), le proposte «per dopo» non chiamano nessuna AI.

import { aiRecommendationService } from '../../services/aiRecommendationService';
import { riferimentoPerDopo, unisciProposte, PROPOSTE_MINIME, rigaPerDopo, ORA_PER_DOPO } from '../../lib/perTeProposte';
import { DAY_START } from '../../lib/tourWindow';
import { computeAffinityScore, ruoloSerale } from '../../services/candidateScoring';
import { PER_TE_TESTI } from '../../lib/esitoVuoto';

const CITY = 'Roma';
const CENTER = { latitude: 41.9028, longitude: 12.4964 };
const near = (km, lon = 0) => ({ latitude: CENTER.latitude + km * 0.009, longitude: CENTER.longitude + lon });

// orari ogni giorno della settimana
const orari = (apre, chiude, extra = []) => ({
    openingPeriods: [...[apre, ...extra.flat()].length ? [] : [], ...Array.from({ length: 7 }, (_, day) => ({ open: { day, time: apre }, close: { day, time: chiude } })),
        ...extra.flatMap(([a, c]) => Array.from({ length: 7 }, (_, day) => ({ open: { day, time: a }, close: { day, time: c } })))],
});
const poi = (id, name, km, types, ore, extra = {}) => ({
    place_id: id, name, ...near(km, (km % 3) * 0.002), rating: 4.5, user_ratings_total: 400, types, city: CITY, ...ore, ...extra,
});
const MUSEO = orari('0900', '1900');
const PARCO = orari('0600', '2000');
const RISTORANTE = orari('1200', '1500', [['1930', '2300']]);

const POOL = {
    cultura: ['Museo Barracco', 'Galleria Colonna', 'Palazzo Altemps', 'Casa di Goethe', 'Museo Boncompagni'].map((n, i) => poi(`cu${i}`, n, 1 + i * 0.2, ['museum', 'tourist_attraction'], MUSEO)),
    nature: ['Villa Celimontana', 'Orto Botanico', 'Villa Borghese', 'Villa Sciarra', 'Giardino degli Aranci'].map((n, i) => poi(`na${i}`, n, 1.2 + i * 0.2, ['park'], PARCO)),
    romance: ['Terrazza del Pincio', 'Ponte Sisto', 'Gianicolo', 'Fontana dell’Acqua Paola', 'Scalinata di Trinità'].map((n, i) => poi(`ro${i}`, n, 1.3 + i * 0.2, ['viewpoint', 'tourist_attraction'], PARCO)),
    food: ['Trattoria da Enzo', 'Osteria del Pesce', 'Da Felice', 'Il Gattopardo', 'Pizzeria Ai Marmi'].map((n, i) => poi(`fo${i}`, n, 1.1 + i * 0.2, ['restaurant', 'food'], RISTORANTE)),
};

// Il pool insider: posti propri (la perla che nessun tema ha già)
const INSIDER = ['Chiostro del Bramante', 'Museo Hendrik Andersen', 'Villino Ximenes', 'Crypta Balbi', 'Casa Museo Mario Praz'].map((n, i) => poi(`in${i}`, n, 1.5 + i * 0.2, ['museum', 'tourist_attraction'], MUSEO));
const POOL_HOME = { insider: INSIDER, ...POOL };

// Il giro della sera del motore: drink + passeggiata + cena (tre posti veri)
const GIRO_SERA = {
    days: [{
        title: 'Il tuo giro a Roma',
        stops: [
            { place_id: 'se0', title: 'Enoteca Ferrara', latitude: CENTER.latitude + 0.002, longitude: CENTER.longitude, description: 'Un wine bar.' },
            { place_id: 'se1', title: 'Ponte Garibaldi', latitude: CENTER.latitude + 0.004, longitude: CENTER.longitude, description: 'Sul fiume.' },
            { place_id: 'se2', title: 'Trattoria Sora Lella', latitude: CENTER.latitude + 0.006, longitude: CENTER.longitude, description: 'Una cena.' },
        ],
    }],
    _source: 'ai',
};

let chiamateAI;
let spiaMotore;
// La chiamata dei temi: restituisce SOLO due tour (insider + cultura), come quando il resto non regge alle 13:00.
const fetchDueTour = () => vi.fn(async (url, init) => {
    if (!String(url).includes('openai-proxy')) throw new Error(`fetch inatteso: ${url}`);
    chiamateAI += 1;
    const body = JSON.parse(String(init?.body ?? '{}'));
    const sys = String(body.messages?.[0]?.content ?? '');
    const isRw = sys.includes('Riscrivi SOLO il campo description');
    const stop = (place_id) => ({ place_id, description: `Dentro ${place_id} la pietra è fresca.`, insiderTip: 'Entra dal lato.', transition: 'Si scende.' });
    const payload = isRw
        ? { stops: JSON.parse(String(body.messages[1].content).split('TAPPE:\n')[1]).map(t => ({ place_id: t.place_id, description: `Da ${t.nome} si vede il quartiere.` })) }
        : { tours: [
            { themeType: 'cultura', title: 'Cultura', stops: [stop('cu0'), stop('cu1'), stop('cu2')] },
            { themeType: 'insider', title: 'Insider', stops: INSIDER.slice(0, 3).map(c => stop(c.place_id)) },
        ] };
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) }, finish_reason: 'stop' }], usage: { completion_tokens: 600 } }) };
});

const alle = (iso) => { vi.setSystemTime(new Date(iso)); };
const home = (themedCandidates = POOL_HOME) => aiRecommendationService.generateHomeTours({
    city: CITY, cityCenter: CENTER, themedCandidates, opts: { skipUserQuota: true },
});

beforeEach(() => {
    vi.clearAllMocks();
    chiamateAI = 0;
    try { window.localStorage.clear(); } catch { /* jsdom */ }
    vi.useFakeTimers({ toFake: ['Date'] });
    spiaMotore = vi.spyOn(aiRecommendationService, 'generateItinerary').mockResolvedValue(GIRO_SERA);
});
afterEach(() => { vi.unstubAllGlobals(); spiaMotore?.mockRestore(); vi.useRealTimers(); });

describe('riferimentoPerDopo — dove cade il «per dopo»', () => {
    it('all’una di notte è questa mattina alle 9:30, di sera e di pomeriggio è domani alle 9:30 (ora di Roma, come GIRO-LONTANO)', () => {
        expect(riferimentoPerDopo(new Date('2026-10-31T01:20:00+01:00'))).toMatchObject({ quando: 'stamattina', data: new Date('2026-10-31T09:30:00+01:00') });
        expect(riferimentoPerDopo(new Date('2026-10-31T13:00:00+01:00'))).toMatchObject({ quando: 'domattina', data: new Date('2026-11-01T09:30:00+01:00') });
        expect(riferimentoPerDopo(new Date('2026-10-31T20:06:00+01:00'))).toMatchObject({ quando: 'domattina', data: new Date('2026-11-01T09:30:00+01:00') });
    });
});

describe('Per Te dà almeno 4 proposte a qualsiasi ora (Roma, dati finti)', () => {
    it('la riga sopra le card dice «stamattina» o «domattina» e l’ora vera (9:30)', () => {
        expect(rigaPerDopo('stamattina', true)).toBe('A quest’ora è quasi tutto chiuso. Sono giri per stamattina, dalle 9:30.');
        expect(rigaPerDopo('domattina', true)).toBe('A quest’ora è quasi tutto chiuso. Sono giri per domattina, dalle 9:30.');
        expect(rigaPerDopo('domattina', false)).toBe('Adesso è aperto poco. Le altre sono per domattina.');
        expect(ORA_PER_DOPO).toEqual(DAY_START);
    });

    it('01:00 — il giro della sera è per adesso, le altre sono per stamattina; nessuna chiamata AI', async () => {
        alle('2026-10-31T01:00:00+01:00');
        const fn = fetchDueTour(); vi.stubGlobal('fetch', fn);
        const r = await home();
        expect(r.tours.length).toBeGreaterThanOrEqual(PROPOSTE_MINIME);
        expect(r.tours[0].perDopo).toBeUndefined();            // il giro della sera: adesso
        expect(r.tours[0].stops.map(s => s.place_id)).toEqual(['se0', 'se1', 'se2']);
        const dopo = r.tours.slice(1);
        expect(dopo.length).toBeGreaterThanOrEqual(3);
        for (const t of dopo) {
            expect(t.perDopo).toMatchObject({ quando: 'stamattina', badge: PER_TE_TESTI.badgePerStamattina });
            expect(t.stops.length).toBeGreaterThanOrEqual(3);
        }
        expect(chiamateAI).toBe(0);
        expect(r._report.proposte).toMatchObject({ raggiunte: true, adesso: 1 });
    });

    it('20:00 — il giro della sera è per adesso, le altre sono per domattina; nessuna chiamata AI', async () => {
        alle('2026-10-31T20:00:00+01:00');
        const fn = fetchDueTour(); vi.stubGlobal('fetch', fn);
        const r = await home();
        expect(r.tours.length).toBeGreaterThanOrEqual(PROPOSTE_MINIME);
        expect(r.tours[0].perDopo).toBeUndefined();
        for (const t of r.tours.slice(1)) expect(t.perDopo).toMatchObject({ quando: 'domattina', badge: 'Per domattina' });
        expect(chiamateAI).toBe(0);
    });

    it('13:00 — due giri per adesso dall’AI, gli altri due temi si completano per domattina', async () => {
        alle('2026-10-31T13:00:00+01:00');
        const fn = fetchDueTour(); vi.stubGlobal('fetch', fn);
        const r = await home();
        expect(r.tours.length).toBeGreaterThanOrEqual(PROPOSTE_MINIME);
        const adesso = r.tours.filter(t => !t.perDopo);
        const dopo = r.tours.filter(t => t.perDopo);
        expect(adesso.length).toBeGreaterThanOrEqual(1);
        expect(dopo.length).toBeGreaterThanOrEqual(2);
        expect(dopo.every(t => t.perDopo.quando === 'domattina')).toBe(true);
        // le adesso stanno in testa e nessun posto compare due volte
        expect(r.tours.findIndex(t => t.perDopo)).toBeGreaterThanOrEqual(adesso.length);
        const ids = r.tours.flatMap(t => t.stops.map(s => s.place_id));
        expect(new Set(ids).size).toBe(ids.length);
        // la chiamata AI è quella di sempre: una per i temi (+ l'eventuale riscrittura), non una in più per le proposte per dopo
        expect(chiamateAI).toBeLessThanOrEqual(2);
    });

    it('mai un posto chiuso come «adesso»: di notte le proposte per dopo non hanno il tema cibo (i ristoranti aprono a pranzo)', async () => {
        alle('2026-10-31T01:00:00+01:00');
        vi.stubGlobal('fetch', fetchDueTour());
        const r = await home();
        const ristoranti = r.tours.filter(t => t.perDopo).flatMap(t => t.stops).filter(s => /restaurant/.test((s.types || []).join(' ')));
        expect(ristoranti).toEqual([]);
        for (const t of r.tours.filter(x => x.perDopo)) expect(t.themeType).not.toBe('food');
    });

    it('con 4 giri già per adesso (di giorno) non si aggiunge niente', () => {
        const quattro = ['a', 'b', 'c', 'd'].map(x => ({ themeType: x, stops: [{ place_id: x }] }));
        expect(unisciProposte(quattro, [{ themeType: 'e', stops: [{ place_id: 'e' }] }], 'domattina').length).toBe(5);
    });
});

describe('Il DNA pesa anche su drink e passeggiata', () => {
    const wineBar = { place_id: 'w', types: ['wine_bar', 'bar', 'restaurant', 'food'] };
    const barSemplice = { place_id: 'b', types: ['bar', 'point_of_interest'] };
    const parco = { place_id: 'p', types: ['park', 'point_of_interest'] };
    const piazza = { place_id: 'z', types: ['plaza', 'tourist_attraction'] };

    it('i ruoli: wine bar e bar sono drink, parco e piazza sono passeggiata, un ristorante no', () => {
        expect(ruoloSerale(wineBar)).toBe('drink');
        expect(ruoloSerale(barSemplice)).toBe('drink');
        expect(ruoloSerale(parco)).toBe('passeggiata');
        expect(ruoloSerale(piazza)).toBe('passeggiata');
        expect(ruoloSerale({ types: ['restaurant', 'food'] })).toBeNull();
    });

    it('DNA Cibo 0,28 e Serate 0: il drink prende l’80% di Cibo (prima: 0 per un bar semplice)', () => {
        const dna = { food: 0.28, nightlife: 0, natura: 0.37, cultura: 0.29, _share: 0.3 };
        expect(computeAffinityScore(barSemplice, dna)).toBeCloseTo(0.8 * 0.28, 5);
        expect(computeAffinityScore(wineBar, dna)).toBeCloseTo(0.28, 5);
    });

    it('con Serate alto il drink segue Serate', () => {
        expect(computeAffinityScore(barSemplice, { nightlife: 0.9, food: 0.1 })).toBeCloseTo(0.9, 5);
    });

    it('la passeggiata segue Natura o Cultura: un parco con DNA Cultura alto e Natura 0 non è a zero', () => {
        expect(computeAffinityScore(piazza, { natura: 0.37, cultura: 0 })).toBeCloseTo(0.8 * 0.37, 5);
        expect(computeAffinityScore(parco, { natura: 0, cultura: 0.5 })).toBeCloseTo(0.8 * 0.5, 5);
    });

    it('utente nuovo (tutti i pesi a zero): resta 0, nessun segnale inventato', () => {
        expect(computeAffinityScore(barSemplice, {})).toBe(0);
        expect(computeAffinityScore(parco, { natura: 0, cultura: 0 })).toBe(0);
    });
});
