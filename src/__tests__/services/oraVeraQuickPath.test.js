// Gate ORA VERA — end-to-end: dal wizard al prompt del selettore, nessuna
// fascia oraria.
//
// I test unitari (quickPath_prompt.test.js, narratoreAncorato.test.js) provano
// i due estremi separatamente: il wizard non produce più una fascia oraria, e
// il selettore non la cita quando `intent.vincoli.tempo` è nullo. Questo test
// chiude la catena in mezzo — buildPromptFromSelections → traduttore d'intento
// → prompt del selettore — e ispeziona il body REALE mandato al selettore,
// cioè l'unica cosa che il modello legge davvero.
//
// PERIMETRO ONESTO: si verifica cosa ARRIVA al selettore, non cosa il selettore
// risponde (l'output del modello è non deterministico). Stesso metodo e stesso
// helper `routeFetch` di raggioCategoria.test.js / cacheOrariFreschi.test.js.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { buildPromptFromSelections } from '../../pages/QuickPath';

const SIRACUSA = { latitude: 37.0755, longitude: 15.2866, isSmallTown: false, radiusKm: 10 };
const aKm = (km) => SIRACUSA.latitude + (km / 111);

const place = ({ id, name, km }) => ({
    place_id: id,
    name,
    geometry: { location: { lat: aKm(km), lng: SIRACUSA.longitude } },
    rating: 4.5,
    user_ratings_total: 400,
    business_status: 'OPERATIONAL',
    types: ['establishment', 'spa', 'point_of_interest'],
});

const SPA = [
    place({ id: 'pid-spa-1', name: 'Hammam Ortigia', km: 0.8 }),
    place({ id: 'pid-spa-2', name: 'Terme di Aretusa', km: 1.4 }),
    place({ id: 'pid-spa-3', name: 'Centro Benessere Plemmirio', km: 2.2 }),
    place({ id: 'pid-spa-4', name: 'Bagni del Ninfeo', km: 3.1 }),
];

// Il traduttore, su un prompt SENZA riferimenti temporali, deve restituire
// tempo: null (regola esplicita di INTENT_TRANSLATOR_PROMPT).
const INTENT_RELAX = {
    queries: ['spa', 'hammam', 'centro benessere'],
    categoria: 'misto', // "misto" ⇒ nessun filtro stretto di categoria: qui si misura il tempo, non il raggio
    oggetto_umano: 'centri benessere',
    vincoli: { tempo: null, escludi: ['cattedrali', 'musei'], note: null },
};

// 1ª chiamata al proxy OpenAI = traduttore d'intento; la 2ª = selettore.
// `stato.selectorBody` conserva il body della chiamata al selettore.
const routeFetch = ({ intent = INTENT_RELAX, selectorPayload }) => {
    const stato = { aiCalls: 0, selectorBody: null, translatorBody: null };
    const fn = vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const payload = stato.aiCalls === 0 ? intent : selectorPayload;
            if (stato.aiCalls === 0) stato.translatorBody = String(init?.body ?? '');
            if (stato.aiCalls === 1) stato.selectorBody = String(init?.body ?? '');
            stato.aiCalls += 1;
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }
        if (u.includes('textsearch')) {
            return { ok: true, json: async () => ({ status: 'OK', results: SPA }) };
        }
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        throw new Error(`fetch inatteso: ${u}`);
    });
    return { fn, stato };
};

describe('Gate ORA VERA — dal wizard al selettore, zero fascia oraria', () => {
    beforeEach(() => {
        // NON resetAllMocks/restoreAllMocks: azzerano i mock globali di setup.js.
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('il body mandato al selettore non contiene "momento del giorno" né una fascia dal wizard', async () => {
        const prompt = buildPromptFromSelections({
            main: 'relax', sub: 'benessere', duration: 'medio',
            group: 'coppia', city: 'Siracusa',
        });

        const { fn, stato } = routeFetch({
            selectorPayload: {
                days: [{
                    day: 1, title: 'Acqua e pietra',
                    stops: [
                        { place_id: 'pid-spa-1', description: 'Il vapore appanna le maioliche' },
                        { place_id: 'pid-spa-2', description: 'Le vasche scavate nella pietra' },
                        { place_id: 'pid-spa-3', description: 'Il legno scuro delle cabine' },
                    ],
                }],
            },
        });
        vi.stubGlobal('fetch', fn);

        const result = await aiRecommendationService.generateItinerary(
            'Siracusa',
            { duration: 'Medio', group: 'In coppia', interests: ['Relax', 'Benessere'] },
            prompt, { condition: 'sunny', temperature: 24 }, '', SIRACUSA,
        );

        // (0) Controllo dello strumento: il selettore E' stato chiamato e il suo
        //     body contiene davvero il prompt del wizard e i candidati. Senza
        //     questo, i `not.toContain` sotto non proverebbero niente.
        expect(stato.aiCalls).toBe(2);
        expect(stato.selectorBody).toBeTruthy();
        expect(stato.selectorBody).toContain('Hammam Ortigia');
        expect(stato.selectorBody).toContain('A Siracusa cerco');

        // (1) La clausola condizionale del Gate B non entra: tempo è null.
        expect(stato.selectorBody).not.toContain('momento del giorno');

        // (2) Le tre etichette che il wizard iniettava (TIME_LABEL) sono sparite
        //     dalla catena intera — prompt utente incluso.
        for (const label of ['Al mattino', 'Nel pomeriggio', 'In serata']) {
            expect(stato.selectorBody).not.toContain(label);
            expect(stato.translatorBody).not.toContain(label);
        }

        // (3) Il tour esiste comunque: la rimozione non ha rotto la generazione.
        expect(result._source).toBe('google-first');
        expect(result.days[0].stops).toHaveLength(3);
    });
});
