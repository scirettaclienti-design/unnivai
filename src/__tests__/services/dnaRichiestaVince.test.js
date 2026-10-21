// DNA-3 — la richiesta esplicita vince sul DNA. 0 $: casi sintetici, nessuna rete.
// Definizioni e regola: src/lib/richiestaEsplicita.js e docs/prove/2026-10-21-dna-3.md.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { richiestaEsplicita, statoCandidato, luogoNominato } from '../../lib/richiestaEsplicita';
import {
    computeCandidateScore, selectScoredCandidatePool, affinitaEffettiva, computeAffinityScore, mapCandidateToCoreCategories,
} from '../../services/candidateScoring';
import { weightsToAIProfile } from '../../services/preferenceEngine';
import { aiRecommendationService } from '../../services/aiRecommendationService';

const cand = (id, name, types, { rating = 4.5, reviews = 300 } = {}) => ({ place_id: id, name, types, rating, user_ratings_total: reviews });
const MUSEO = cand('m1', 'Museo Civico', ['museum', 'tourist_attraction']);
const MUSEO2 = cand('m2', 'Pinacoteca Comunale', ['museum']);
const CHIESA = cand('c1', 'Chiesa di San Nicolò', ['church', 'place_of_worship', 'tourist_attraction']);
const CHIESA_FORTE = { ...CHIESA, rating: 4.8 }; // la chiesa migliore del pool: senza esclusione sarebbe prima
const TRATTORIA = cand('t1', 'Trattoria Sarda', ['restaurant', 'food']);
const TRATTORIA2 = cand('t2', 'Osteria del Porto', ['restaurant', 'food']);
const PARCO = cand('p1', 'Parco del Sinis', ['park', 'natural_feature']);
const POOL = [MUSEO, MUSEO2, CHIESA, TRATTORIA, TRATTORIA2, PARCO];
const POOL_CHIESE = [MUSEO, MUSEO2, CHIESA_FORTE, TRATTORIA, TRATTORIA2, PARCO];

const dna = (pesi, richiesta = null) => ({ ...pesi, _share: 0.45, ...(richiesta ? { _richiesta: richiesta } : {}) });
const ordine = (pool, w, limit = 20) => selectScoredCandidatePool(pool, { city: 'Cabras', dnaWeights: w, limit, maxIcons: 9 }).map(c => c.place_id);
const intent = (categoria, escludi = []) => ({ queries: [], categoria, vincoli: { tempo: null, escludi, note: null } });

describe('DNA-3 — le definizioni: cosa e\' «richiesta esplicita»', () => {
    it('Crea: le parole dell\'utente chiedono musei', () => {
        const r = richiestaEsplicita({ intent: intent('misto'), testo: 'solo musei, grazie', pathType: 'custom' });
        expect(r.tipiChiesti).toContain('museum');
        expect(r.catsTesto).toEqual(expect.arrayContaining(['cultura', 'arte']));
        expect(r.vuota).toBe(false);
    });
    it('Crea: i chip degli interessi sono richiesta (Arte → arte e cultura)', () => {
        const r = richiestaEsplicita({ intent: intent('misto'), testo: 'una giornata a Catania', prefs: { interests: ['Arte'] }, pathType: 'custom' });
        expect(r.chieste).toEqual(expect.arrayContaining(['arte', 'cultura']));
    });
    it('Quiz: la richiesta e\' la categoria letta dalle opzioni; il testo costruito dal modello non conta', () => {
        const r = richiestaEsplicita({ intent: intent('natura'), testo: 'una giornata tra musei e ristoranti storici', pathType: 'quick' });
        expect(r.chieste).toEqual(['natura']);
        expect(r.tipiChiesti).toEqual([]);
    });
    it('Quiz: ritmo, compagnia e umore scelti sono richiesta (interessi del Quiz → categorie, ritmo e compagnia nei vincoli)', () => {
        const r = richiestaEsplicita({ intent: intent('misto'), testo: '', prefs: { interests: ['Storia & Arte', 'Gusto'], pace: 'Rilassato', group: 'Coppia', duration: 'Medio' }, pathType: 'quick' });
        expect(r.chieste).toEqual(expect.arrayContaining(['cultura', 'arte', 'food']));
        expect(r.vincoli).toMatchObject({ ritmo: 'Rilassato', compagnia: 'Coppia', durata: 'Medio' });
    });
    it('Sorprendimi senza tema: gli interessi vengono dal DNA, non sono una richiesta', () => {
        const r = richiestaEsplicita({ intent: intent('misto'), testo: 'x', prefs: { interests: ['Arte', 'Cibo', 'Scoperte Urbane'] }, pathType: undefined });
        expect(r.vuota).toBe(true);
    });
    it('Sorprendimi: il testo del modello («passioni storiche») non e\' una richiesta', () => {
        const r = richiestaEsplicita({ intent: intent('misto'), testo: 'Categoria di oggi: Mix delle sue più profonde passioni storiche', pathType: undefined });
        expect(r.vuota).toBe(true);
    });
    it('una frase vaga non chiede niente, anche se il traduttore riempie le query da solo', () => {
        const r = richiestaEsplicita({ intent: { ...intent('misto'), queries: ['piazza storica', 'trattoria tipica', 'belvedere panorama'] }, testo: 'Una giornata a Catania', pathType: 'custom' });
        expect(r.vuota).toBe(true);
        expect(r.chieste).toEqual([]);
    });
    it('esclusioni: «niente chiese» esclude le chiese, non i musei', () => {
        const r = richiestaEsplicita({ intent: intent('misto', ['chiese']), testo: 'giro in centro, niente chiese', pathType: 'custom' });
        expect(statoCandidato(CHIESA, r, mapCandidateToCoreCategories)).toBe('escluso');
        expect(statoCandidato(MUSEO, r, mapCandidateToCoreCategories)).toBe('libero');
    });
    it('un posto escluso resta escluso anche se la categoria generale e\' chiesta (l\'esclusione e\' piu\' precisa)', () => {
        const r = richiestaEsplicita({ intent: intent('cultura', ['chiese']), testo: 'cultura ma niente chiese', pathType: 'custom' });
        expect(statoCandidato(CHIESA, r, mapCandidateToCoreCategories)).toBe('escluso');
        expect(statoCandidato(MUSEO, r, mapCandidateToCoreCategories)).toBe('chiesto');
    });
    it('luoghi per nome: il testo nomina il posto', () => {
        expect(luogoNominato(cand('x', 'Castello Ursino', ['castle']), 'voglio vedere il castello ursino domani')).toBe(true);
        expect(luogoNominato(cand('x', 'Museo Civico', ['museum']), 'voglio vedere un museo')).toBe(false);
    });
    it('budget, durata, ritmo, compagnia, momento: sono nella richiesta e il DNA non li tocca', () => {
        const r = richiestaEsplicita({ intent: { ...intent('misto'), vincoli: { tempo: 'sera', escludi: [], note: null } }, testo: 'x',
            prefs: { budget: '€', duration: 'Mezza Giornata', pace: 'Rilassato', group: 'Coppia' }, pathType: 'custom' });
        expect(r.vincoli).toEqual({ budget: '€', durata: 'Mezza Giornata', ritmo: 'Rilassato', compagnia: 'Coppia', momento: 'sera' });
        // il punteggio dei candidati non legge mai le opzioni: stesso pool, stesso DNA → stessi punteggi
        const w = dna({ food: 1 });
        const a = POOL.map(c => computeCandidateScore(c, POOL, w));
        const b = POOL.map(c => computeCandidateScore(c, POOL, { ...w }));
        expect(a).toEqual(b);
    });
});

describe('DNA-3 — il punteggio: il DNA decide solo le scelte libere', () => {
    it('utente food=1 che chiede «solo musei»: i musei passano davanti ai ristoranti (senza regola, no)', () => {
        const senza = ordine(POOL, dna({ food: 1 }));
        const r = richiestaEsplicita({ intent: intent('arte'), testo: 'solo musei', pathType: 'custom' });
        const con = ordine(POOL, dna({ food: 1 }, r));
        const posMusei = (o) => [o.indexOf('m1'), o.indexOf('m2')];
        const posRistoranti = (o) => [o.indexOf('t1'), o.indexOf('t2')];
        // prima: il DNA mette i ristoranti in testa
        expect(Math.max(...posRistoranti(senza))).toBeLessThan(Math.min(...posMusei(senza)));
        // dopo: i musei sono i primi due
        expect(con.slice(0, 2).sort()).toEqual(['m1', 'm2']);
        console.info(`[DNA-3] food=1 + «solo musei»: primi 2 prima ${JSON.stringify(senza.slice(0, 2))} → dopo ${JSON.stringify(con.slice(0, 2))}`);
    });

    it('utente natura=0 che chiede natura: il parco c\'e\' (senza regola, il DNA lo manda in fondo)', () => {
        const base = { cultura: 1, food: 1, natura: 0 };
        const senza = ordine(POOL, dna(base), 3);
        const r = richiestaEsplicita({ intent: intent('misto'), testo: 'voglio un parco', pathType: 'custom' });
        const con = ordine(POOL, dna(base, r), 3);
        expect(senza).not.toContain('p1');
        expect(con).toContain('p1');
        expect(con[0]).toBe('p1');
        console.info(`[DNA-3] natura=0 + «voglio un parco»: primi 3 prima ${JSON.stringify(senza)} → dopo ${JSON.stringify(con)}`);
    });

    it('«niente chiese» vince su un DNA cultura=1: la chiesa esce dai primi due posti', () => {
        const base = { cultura: 1 };
        const senza = ordine(POOL_CHIESE, dna(base), 2);
        const r = richiestaEsplicita({ intent: intent('misto', ['chiese']), testo: 'giro in centro, niente chiese', pathType: 'custom' });
        const con = ordine(POOL_CHIESE, dna(base, r), 2);
        const chiese = (o) => o.filter(id => id === 'c1').length;
        expect(chiese(senza)).toBe(1);
        expect(chiese(con)).toBe(0);
        // il DNA non l'ha portata su: la chiesa ha affinita' 0, non quella di cultura=1
        expect(affinitaEffettiva(CHIESA_FORTE, POOL_CHIESE, dna(base, r))).toBe(0);
        expect(computeAffinityScore(CHIESA_FORTE, dna(base))).toBe(1);
        console.info(`[DNA-3] cultura=1 + «niente chiese»: chiese nei primi 2 prima ${chiese(senza)} → dopo ${chiese(con)}`);
    });

    it('la negazione nel testo basta anche se il traduttore non ha riempito `escludi`', () => {
        const r = richiestaEsplicita({ intent: intent('misto', []), testo: 'una giornata a Catania, senza chiese', pathType: 'custom' });
        expect(r.tipiEsclusi).toContain('church');
        expect(r.chieste).not.toContain('cultura');
    });

    it('il DNA non puo\' mai alzare un posto escluso: con o senza DNA il punteggio non sale', () => {
        const r = richiestaEsplicita({ intent: intent('misto', ['chiese']), testo: 'niente chiese', pathType: 'custom' });
        for (const pesi of [{ cultura: 1 }, { cultura: 0.5, food: 1 }, { natura: 1 }]) {
            const conDna = computeCandidateScore(CHIESA, POOL, dna(pesi, r));
            const senzaDna = computeCandidateScore(CHIESA, POOL, { _share: 0 });
            // con DNA il termine DNA vale 0 e il resto si riduce: mai sopra il giro senza DNA
            expect(conDna).toBeLessThanOrEqual(senzaDna + 1e-12);
        }
    });

    it('stessa città senza richiesta: un utente food=1 vede piu\' cibo di un utente nuovo (il DNA decide le scelte libere)', () => {
        const nuovo = ordine(POOL, { _share: 0 }, 3);
        const food = ordine(POOL, dna({ food: 1 }), 3);
        const nCibo = (o) => o.filter(id => id.startsWith('t')).length;
        expect(nCibo(food)).toBeGreaterThan(nCibo(nuovo));
        console.info(`[DNA-3] senza richiesta, primi 3: ristoranti utente nuovo ${nCibo(nuovo)} → utente food=1 ${nCibo(food)}`);
    });

    it('utente nuovo: punteggio e ordine identici a prima, con o senza richiesta nel pacchetto', () => {
        const r = richiestaEsplicita({ intent: intent('arte', ['chiese']), testo: 'solo musei, niente chiese', pathType: 'custom' });
        for (const nuovo of [{}, { _share: 0 }]) {
            const a = POOL.map(c => computeCandidateScore(c, POOL, nuovo));
            const b = POOL.map(c => computeCandidateScore(c, POOL, { ...nuovo, _richiesta: r }));
            expect(b).toEqual(a);
        }
    });

    it('la curva del peso resta: il termine DNA non supera mai 0,45 (+ il gradino dei posti chiesti, che e\' solo ordine)', () => {
        const w = dna({ cultura: 1, food: 1, natura: 1 });
        for (const c of POOL) expect(computeCandidateScore(c, POOL, w)).toBeLessThanOrEqual(1.000001);
    });
});

describe('DNA-3 — il profilo che va al modello', () => {
    it('senza richiesta: identico a prima', () => {
        expect(weightsToAIProfile({ cultura: 0.9, food: 0.5, _share: 0.45 })).toBe('Preferenze dominanti: cultura (90%), food (50%).');
        expect(weightsToAIProfile({ cultura: 0.9, _share: 0 })).toBe('');
    });
    it('con richiesta: niente categorie chieste o escluse, e «la richiesta vince»', () => {
        const r = richiestaEsplicita({ intent: intent('misto', ['chiese']), testo: 'niente chiese', pathType: 'custom' });
        const t = weightsToAIProfile({ cultura: 0.9, food: 0.5, _share: 0.45 }, r);
        expect(t).not.toContain('cultura');
        expect(t).toContain('food (50%)');
        expect(t).toContain("La richiesta dell'utente vince sempre sul profilo.");
    });
});

// ─── il motore vero (Cabras, borgo), con una rete finta ──────────────────────
const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };
const aKm = (km) => CABRAS.latitude + (km / 111);
const place = ({ id, name, km, types, rating = 4.5, reviews = 300 }) => ({
    place_id: id, name, geometry: { location: { lat: aKm(km), lng: CABRAS.longitude } }, rating, user_ratings_total: reviews, business_status: 'OPERATIONAL', types,
});
const routeFetch = ({ perQuery, selectorPayload, intent: intentPayload }) => {
    const stato = { selectorBodies: [] };
    const fn = vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const body = String(init?.body ?? '');
            const isSelector = body.includes("SEI L'INSIDER DI");
            if (isSelector) stato.selectorBodies.push(body);
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(isSelector ? selectorPayload : intentPayload) } }] }) };
        }
        if (u.includes('textsearch')) {
            const decoded = decodeURIComponent(u).replace(/\+/g, ' ');
            const hit = Object.keys(perQuery).find(q => decoded.includes(`${q} Cabras`));
            return { ok: true, json: async () => ({ status: 'OK', results: hit ? perQuery[hit] : [] }) };
        }
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        throw new Error(`fetch inatteso: ${u}`);
    });
    return { fn, stato };
};

describe('DNA-3 — nel motore vero', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-14T12:30:00+02:00'));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    const musei = [place({ id: 'pid-m1', name: 'Museo del Mare', km: 0.4, types: ['museum'] }), place({ id: 'pid-m2', name: 'Museo Civico', km: 0.6, types: ['museum'] })];
    const ristoranti = [place({ id: 'pid-r1', name: 'Trattoria Sarda', km: 0.5, types: ['restaurant', 'food'] }), place({ id: 'pid-r2', name: 'Osteria del Porto', km: 0.7, types: ['restaurant', 'food'] })];
    const INTENT_MUSEI = { queries: ['musei'], categoria: 'cultura', oggetto_umano: 'musei', vincoli: { tempo: null, escludi: [], note: null } };

    it('utente food=1 che chiede «solo musei»: al selettore arrivano solo musei (nessun ristorante nelle visite)', async () => {
        const { fn, stato } = routeFetch({
            perQuery: { musei: [...musei, ...ristoranti] }, intent: INTENT_MUSEI,
            selectorPayload: { days: [{ day: 1, stops: [{ place_id: 'pid-m1', description: 'x' }, { place_id: 'pid-m2', description: 'x' }] }] },
        });
        vi.stubGlobal('fetch', fn);
        await aiRecommendationService.generateItinerary('Cabras', {}, 'solo musei', {}, 'Preferenze dominanti: food (100%).', CABRAS,
            { dnaWeights: { food: 1, _share: 0.45 }, pathType: 'custom' });
        const body = stato.selectorBodies[0];
        expect(body).toContain('Museo del Mare');
        expect(body).toContain('Museo Civico');
        // il profilo che il modello legge non spinge il cibo contro la richiesta, e dice chi vince
        expect(body).toContain("La richiesta dell'utente vince sempre sul profilo.");
    });

    it('«niente chiese» con DNA cultura=1: il profilo al modello non nomina la cultura e la richiesta vince', async () => {
        const intentEscludi = { queries: ['centro storico'], categoria: 'misto', oggetto_umano: 'centro', vincoli: { tempo: null, escludi: ['chiese'], note: null } };
        const { fn, stato } = routeFetch({
            perQuery: { 'centro storico': [...musei, ...ristoranti] }, intent: intentEscludi,
            selectorPayload: { days: [{ day: 1, stops: [{ place_id: 'pid-m1', description: 'x' }] }] },
        });
        vi.stubGlobal('fetch', fn);
        await aiRecommendationService.generateItinerary('Cabras', {}, 'giro in centro, niente chiese', {}, 'Preferenze dominanti: cultura (100%), food (40%).', CABRAS,
            { dnaWeights: { cultura: 1, food: 0.4, _share: 0.45 }, pathType: 'custom' });
        const body = stato.selectorBodies[0];
        expect(body).toContain("La richiesta dell'utente vince sempre sul profilo.");
        expect(body).not.toMatch(/profilo implicito:[^\n]*cultura \(/);
    });

    it('utente nuovo: il profilo e il pool arrivano al selettore come prima (nessuna clausola)', async () => {
        const { fn, stato } = routeFetch({
            perQuery: { musei: [...musei, ...ristoranti] }, intent: INTENT_MUSEI,
            selectorPayload: { days: [{ day: 1, stops: [{ place_id: 'pid-m1', description: 'x' }] }] },
        });
        vi.stubGlobal('fetch', fn);
        await aiRecommendationService.generateItinerary('Cabras', {}, 'solo musei', {}, '', CABRAS, { dnaWeights: {}, pathType: 'custom' });
        const body = stato.selectorBodies[0];
        expect(body).toContain('Museo del Mare');
        expect(body).not.toContain("La richiesta dell'utente vince");
    });
});
