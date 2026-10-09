import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Gate PER TE — "Per Te" in Home:
//   1. la distanza si decide in codice PRIMA del prompt (un candidato a 50 km
//      non arriva mai al modello, che non ha le coordinate per giudicarla);
//   2. ogni luogo compare una sola volta nel prompt (il blocco insider non
//      ripete i luoghi dei temi);
//   3. una risposta tagliata a meta' non manda "Per Te" in errore: si servono
//      i tour completi;
//   4. il momento della giornata viene da dayMoments.js e la chiave di cache
//      porta data e momento (ora di Roma): un racconto scritto a pranzo non si
//      riusa a cena, ne' il giorno dopo.
//
// Mock solo di infrastruttura: fetch instradato per URL, supabase da setup.js.

import { aiRecommendationService, buildInsiderPool } from '../../services/aiRecommendationService';

const CITY = 'Roma';
const CENTER = { latitude: 41.9028, longitude: 12.4964 };
// ~0.009° di latitudine ≈ 1 km
const near = (km) => ({ latitude: CENTER.latitude + km * 0.009, longitude: CENTER.longitude });
const poi = (id, name, km, extra = {}) => ({
    place_id: id, name, ...near(km), rating: 4.5, user_ratings_total: 500, types: ['tourist_attraction'], city: CITY, ...extra,
});

const POOLS = {
    food: [poi('f1', 'Da Enzo', 1), poi('f2', 'Armando', 2), poi('f3', 'Roscioli', 1.5), poi('f4', 'Pizzeria Ai Marmi', 2.5), poi('f5', 'Da Teo', 3), poi('f6', 'Felice', 3.5)],
    cultura: [poi('c1', 'Pantheon', 0.5), poi('c2', 'Galleria Borghese', 2), poi('c3', 'San Clemente', 2.2), poi('c4', 'Palazzo Massimo', 2.4), poi('c5', 'Santa Prassede', 2.6), poi('c6', 'Villa Adriana', 50)],
    nature: [poi('n1', 'Villa Pamphilj', 3), poi('n2', 'Orto Botanico', 2), poi('n3', 'Villa Ada', 4)],
};

const openaiCalls = (fn) => fn.mock.calls.filter(([u]) => String(u).includes('openai-proxy'));
const sentPrompt = (fn) => JSON.parse(openaiCalls(fn)[0][1].body).messages[0].content;

const proxyFetch = (content, extra = {}) => vi.fn(async (url) => {
    if (String(url).includes('openai-proxy')) {
        return {
            ok: true,
            json: async () => ({
                choices: [{ message: { content }, finish_reason: extra.finish_reason || 'stop' }],
                usage: { completion_tokens: extra.completion_tokens ?? 1234 },
            }),
        };
    }
    throw new Error(`fetch inatteso: ${url}`);
});

const stop = (place_id) => ({ place_id, description: `Dentro ${place_id} la pietra e' fresca.`, insiderTip: 'Entra dal lato.', transition: 'Si scende per una scala.' });
const tourJson = (themeType, ids) => ({ themeType, title: `Tour ${themeType}`, stops: ids.map(stop) });

const home = (themedCandidates) => aiRecommendationService.generateHomeTours({
    city: CITY, cityCenter: CENTER, themedCandidates, opts: { skipUserQuota: true },
});

beforeEach(() => {
    vi.clearAllMocks();
    try { window.localStorage.clear(); } catch { /* jsdom */ }
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('Per Te — distanza decisa in codice, prima del prompt', () => {
    it('un candidato a 50 km non compare mai nel prompt', async () => {
        const fn = proxyFetch(JSON.stringify({ tours: [tourJson('cultura', ['c1', 'c2', 'c3'])] }));
        vi.stubGlobal('fetch', fn);
        await home({ insider: buildInsiderPool(POOLS, CENTER, CITY), ...POOLS });
        const prompt = sentPrompt(fn);
        expect(prompt).not.toContain('c6');
        expect(prompt).not.toContain('Villa Adriana');
        expect(prompt).toContain('c1');
    });

    it('il prompt non chiede piu\' al modello di rispettare una distanza che non puo\' verificare', async () => {
        const fn = proxyFetch(JSON.stringify({ tours: [tourJson('cultura', ['c1', 'c2', 'c3'])] }));
        vi.stubGlobal('fetch', fn);
        await home(POOLS);
        expect(sentPrompt(fn)).not.toMatch(/entro \d+ km/);
    });

    it('buildInsiderPool non sceglie mai un luogo oltre il raggio', () => {
        const insider = buildInsiderPool(POOLS, CENTER, CITY);
        expect(insider.map(p => p.place_id)).not.toContain('c6');
    });
});

describe('Per Te — ogni luogo una sola volta nel prompt', () => {
    it('il blocco insider non ripete i luoghi dei temi', async () => {
        const fn = proxyFetch(JSON.stringify({ tours: [tourJson('cultura', ['c1', 'c2', 'c3'])] }));
        vi.stubGlobal('fetch', fn);
        // L'insider costruito come in Home: i luoghi migliori di TUTTI i temi.
        await home({ insider: buildInsiderPool(POOLS, CENTER, CITY), ...POOLS });
        const ids = [...sentPrompt(fn).matchAll(/"place_id": "([^"]+)"/g)].map(m => m[1]);
        expect(ids.length).toBeGreaterThan(0);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('Per Te — risposta tagliata a meta\'', () => {
    it('JSON tagliato a meta\' del 4° tour → i 3 tour completi, nessun errore', async () => {
        const full = JSON.stringify({
            tours: [
                tourJson('food', ['f1', 'f2', 'f3']),
                tourJson('cultura', ['c1', 'c2', 'c3']),
                tourJson('nature', ['n1', 'n2', 'n3']),
                tourJson('insider', ['f4', 'c4', 'n1']),
            ],
        });
        const cut = full.slice(0, full.indexOf('"themeType":"insider"') + 40);
        vi.stubGlobal('fetch', proxyFetch(cut, { finish_reason: 'length', completion_tokens: 4000 }));
        const res = await home(POOLS);
        expect(res._source).not.toBe('error');
        expect(res.tours.map(t => t.themeType)).toEqual(['food', 'cultura', 'nature']);
        expect(res._report.troncata).toBe(true);
        expect(res._report.tokenRisposta).toBe(4000);
    });

    it('risposta tagliata dentro il 1° tour → nessun tour, ma nessun errore', async () => {
        const full = JSON.stringify({ tours: [tourJson('food', ['f1', 'f2', 'f3'])] });
        vi.stubGlobal('fetch', proxyFetch(full.slice(0, 60), { finish_reason: 'length', completion_tokens: 4000 }));
        const res = await home(POOLS);
        expect(res._source).not.toBe('error');
        expect(res.tours).toEqual([]);
    });
});

describe('Per Te — momento della giornata e chiave di cache', () => {
    const hometourKeys = () => Object.keys(window.localStorage).filter(k => k.startsWith('hometours_v1_'));
    const at = async (iso) => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(iso));
        vi.stubGlobal('fetch', proxyFetch(JSON.stringify({ tours: [tourJson('cultura', ['c1', 'c2', 'c3'])] })));
        await home(POOLS);
        vi.useRealTimers();
    };

    it('stesso giorno, 12:00 e 19:00 (Roma) → due chiavi diverse', async () => {
        await at('2026-10-08T12:00:00+02:00');
        await at('2026-10-08T19:00:00+02:00');
        expect(hometourKeys()).toHaveLength(2);
    });

    it('stessa ora, due giorni diversi → due chiavi diverse', async () => {
        await at('2026-10-08T12:00:00+02:00');
        await at('2026-10-09T12:00:00+02:00');
        expect(hometourKeys()).toHaveLength(2);
    });

    it('stesso momento della giornata, stesso giorno → cache riusata (una sola chiamata)', async () => {
        const fn = proxyFetch(JSON.stringify({ tours: [tourJson('cultura', ['c1', 'c2', 'c3'])] }));
        vi.stubGlobal('fetch', fn);
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-08T12:40:00+02:00'));
        await home(POOLS);
        // P3d-g — la prima generazione fa le sue 2 chiamate (tour + riscrittura
        // ancorata); la seconda, dalla cache, nessuna.
        const dopoLaPrima = openaiCalls(fn).length;
        expect(dopoLaPrima).toBeLessThanOrEqual(2);
        vi.setSystemTime(new Date('2026-10-08T13:50:00+02:00'));
        await home(POOLS);
        expect(openaiCalls(fn)).toHaveLength(dopoLaPrima);
    });

    it('alle 19:00 di Roma il prompt dice Aperitivo, letto dalla tabella dei momenti', async () => {
        const fn = proxyFetch(JSON.stringify({ tours: [tourJson('cultura', ['c1', 'c2', 'c3'])] }));
        vi.stubGlobal('fetch', fn);
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-08T19:00:00+02:00'));
        await home(POOLS);
        expect(sentPrompt(fn)).toContain('• orario: Aperitivo (18:00–20:00)');
    });

    it('nessuna soglia oraria scritta a mano nel motore della Home', () => {
        const src = readFileSync(resolve(__dirname, '../../services/aiRecommendationService.js'), 'utf8');
        const body = src.slice(src.indexOf('async generateHomeTours('), src.indexOf('async generateSystemPrewarmTour('));
        expect(body).not.toMatch(/getHours\(\)/);
        expect(body).not.toMatch(/hour\s*>=\s*\d/);
    });
});

describe('Per Te — nessuno scarto silenzioso', () => {
    it('ogni tappa scartata finisce nel log con il motivo, e nel resoconto', async () => {
        const warn = vi.spyOn(console, 'warn');
        vi.stubGlobal('fetch', proxyFetch(JSON.stringify({
            tours: [
                // P7a — ogni tour ha 3 tappe buone: sotto le 3 un tour non si
                // serve piu', e qui si vogliono vedere gli SCARTI di tappa.
                tourJson('cultura', ['c1', 'c2', 'c4', 'inventato']),
                // c1 ripetuto: il secondo tour lo perde
                { themeType: 'food', title: 'Food', stops: [stop('f1'), stop('f2'), stop('f4'), { place_id: 'f3', description: 'Un posto magico.' }] },
                { themeType: 'nature', title: 'Verde', stops: [stop('n1'), stop('n2'), stop('n3'), stop('c1')] },
            ],
        })));
        const res = await home(POOLS);
        const motivi = res._report.scarti.map(s => s.motivo);
        expect(motivi.every(m => /non fra i candidati/.test(m))).toBe(true);
        // P3d-e — f3 ("Un posto magico.") non e' piu' uno scarto: resta con la
        // frase sicura del codice, e il resoconto lo dice.
        expect(res._report.scarti).toHaveLength(2);
        // P3d-g — senza fatti e senza riscrittura (qui il finto motore non la
        // da'), le tappe prendono la frase sicura: f3 compresa.
        expect(res._report.frasiSicure.map(x => x.tour)).toContain('food');
        const righe = warn.mock.calls.map(c => String(c[0])).filter(l => l.includes('[Per Te]') && l.includes('scartata'));
        expect(righe).toHaveLength(2);
        expect(res._report.tappeRaccontate).toBe(12);
        expect(res._report.tappeServite).toBe(10);
    });
});
