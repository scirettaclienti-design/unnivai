// Gate TOUR-SENSATO — F13 (POI non visitabili) e F14 (categoria sbagliata).
//
// Device 16/08, SurpriseTour a Ippocampo, 4 tappe: tre erano lo stesso tratto
// di litorale e la quarta era un condominio. Le categorie non corrispondevano
// ai luoghi: un beach club etichettato CULTURA, un condominio NATURA.
//
// I types qui sotto NON sono inventati: sono quelli restituiti oggi da
// findplacefromtext via places-proxy (sonda 16/08).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    passesHardExclusions,
    NON_VISITABLE_TYPES,
    VISITABLE_TYPES,
    GEO_ENTITY_TYPES,
    REAL_PLACE_TYPES,
    discoverRealPOIs,
} from '../../services/placesDiscoveryService';
import { canonicalizeStopsFromCandidates, aiRecommendationService } from '../../services/aiRecommendationService';

// Rating/recensioni valorizzati apposta: senza, i filtri rumore
// (rating<3.5 && total<=2) e dati-assenti (0/0) scarterebbero il candidato per
// un motivo diverso da quello in esame e il test non direbbe nulla.
const poi = (name, types, rating = 4.2, total = 200) => ({
    name, types, rating, user_ratings_total: total, business_status: 'OPERATIONAL',
});

// ─── types REALI dalla sonda del 16/08 ─────────────────────────────────────────
const CONDOMINIO = poi('VILLAGGIO IPPOCAMPO - Supercondominio', ['establishment', 'lodging', 'point_of_interest'], 3.6, 244);
const BNB        = poi('B&B Centro Storico', ['establishment', 'lodging', 'point_of_interest'], 5.0, 77);
const BEACH_CLUB = poi('Beach Club Ippocampo', ['bar', 'establishment', 'food', 'lodging', 'point_of_interest', 'restaurant', 'travel_agency'], 4.1, 271);
const SPIAGGIA   = poi('Spiaggia Ippocampo di Manfredonia', ['establishment', 'lodging', 'point_of_interest'], 3.4, 9);
const MASSERIA   = poi('La Masseria', ['establishment', 'food', 'point_of_interest', 'restaurant'], 3.6, 347);

describe('Gate TOUR-SENSATO F13 — POI non visitabili', () => {
    it('(a) il condominio viene SCARTATO', () => {
        expect(passesHardExclusions(CONDOMINIO)).toBe(false);
    });

    it('(a) il B&B viene SCARTATO — stessi types del condominio', () => {
        expect(passesHardExclusions(BNB)).toBe(false);
        expect(BNB.types).toEqual(CONDOMINIO.types); // è il punto: sono indistinguibili
    });

    it('(b) il Beach Club è TENUTO: ha bar/food/restaurant nonostante lodging E travel_agency', () => {
        // Porta DUE type non visitabili e sopravvive lo stesso: è la ragione per
        // cui la regola è condizionale e non una blacklist su `lodging`.
        expect(BEACH_CLUB.types).toContain('lodging');
        expect(BEACH_CLUB.types).toContain('travel_agency');
        expect(passesHardExclusions(BEACH_CLUB)).toBe(true);
    });

    it('(c) La Masseria è TENUTA e non entra nemmeno nella regola (nessun lodging)', () => {
        expect(BEACH_CLUB.types.includes('lodging')).toBe(true);
        expect(MASSERIA.types.some(t => NON_VISITABLE_TYPES.has(t))).toBe(false);
        expect(passesHardExclusions(MASSERIA)).toBe(true);
    });

    it('(d) FALSO POSITIVO NOTO E ACCETTATO: la Spiaggia viene scartata', () => {
        // "Spiaggia Ippocampo di Manfredonia" ha ESATTAMENTE gli stessi types del
        // condominio: [establishment, lodging, point_of_interest]. Su Google è
        // registrata come alloggio, non come spiaggia — nessun natural_feature.
        // Con questa regola cade. NON è una svista: è il prezzo dichiarato di
        // scartare i condomini, e nessuna informazione nei types permette di
        // distinguerla. Se un giorno Google le assegnasse `natural_feature`,
        // VISITABLE_TYPES la salverebbe da sola.
        expect(SPIAGGIA.types).toEqual(CONDOMINIO.types);
        expect(passesHardExclusions(SPIAGGIA)).toBe(false);
    });

    it('un lodging con natural_feature sopravvive (il caso che salverebbe la spiaggia)', () => {
        expect(passesHardExclusions(poi('Lido con spiaggia', ['establishment', 'lodging', 'natural_feature']))).toBe(true);
    });

    it('point_of_interest ed establishment NON salvano: se lo facessero la regola sarebbe inerte', () => {
        expect(VISITABLE_TYPES.has('point_of_interest')).toBe(false);
        expect(VISITABLE_TYPES.has('establishment')).toBe(false);
        // Controprova sul caso Troina: un POI con SOLO point_of_interest non ha
        // lodging, quindi la regola non lo tocca affatto.
        expect(passesHardExclusions(poi('Ruderi Monastero Nuovo', ['point_of_interest'], 4.7, 45))).toBe(true);
    });

    it('le tre liste restano separate: nessuna sovrapposizione', () => {
        for (const t of NON_VISITABLE_TYPES) {
            expect(VISITABLE_TYPES.has(t), `"${t}" è in entrambe le liste`).toBe(false);
            expect(GEO_ENTITY_TYPES.has(t), `"${t}" è finito in GEO_ENTITY_TYPES`).toBe(false);
        }
        // REAL_PLACE_TYPES (guard di isCityItself) contiene `lodging` di
        // proposito e resta com'è: serve a un'altra domanda ("è la città?"),
        // non a questa ("si visita?").
        expect(REAL_PLACE_TYPES.has('lodging')).toBe(true);
    });
});

describe('Gate TOUR-SENSATO F14 — Google è l’autorità sulla categoria', () => {
    const CANDIDATI = [
        { place_id: 'pid-beach', name: 'Beach Club Ippocampo', type: 'restaurant', latitude: 41.6, longitude: 15.9, city: 'Ippocampo' },
        { place_id: 'pid-museo', name: 'Museo Archeologico', type: 'museum', latitude: 41.6, longitude: 15.9, city: 'Manfredonia' },
    ];

    it('(e) c.type="restaurant" e s.type="cultura" → vince restaurant', () => {
        const [stop] = canonicalizeStopsFromCandidates(
            [{ place_id: 'pid-beach', type: 'cultura', description: 'x' }],
            CANDIDATI,
        );
        expect(stop.type).toBe('restaurant');
    });

    it('il condominio-in-NATURA non può più accadere: il type viene da Google', () => {
        const [stop] = canonicalizeStopsFromCandidates(
            [{ place_id: 'pid-museo', type: 'natura', description: 'x' }],
            CANDIDATI,
        );
        expect(stop.type).toBe('museum');
        expect(stop.type).not.toBe('natura');
    });

    it('l’AI resta il fallback quando Google non classifica', () => {
        const senzaType = [{ place_id: 'pid-x', name: 'Posto', latitude: 41.6, longitude: 15.9 }];
        const [stop] = canonicalizeStopsFromCandidates(
            [{ place_id: 'pid-x', type: 'relax', description: 'x' }],
            senzaType,
        );
        expect(stop.type).toBe('relax');
    });

    it('senza né c.type né s.type → "place"', () => {
        const [stop] = canonicalizeStopsFromCandidates(
            [{ place_id: 'pid-x', description: 'x' }],
            [{ place_id: 'pid-x', name: 'Posto', latitude: 41.6, longitude: 15.9 }],
        );
        expect(stop.type).toBe('place');
    });
});

// ─── open_now: dalla textsearch fino al prompt ─────────────────────────────────
//
// Il vincolo ":862 MAI suggerire posti chiusi ora" era una frase che il modello
// non poteva rispettare: gli orari non arrivavano nel prompt.
// La textsearch li restituisce già su tutti i risultati (sonda 16/08 su
// Manfredonia: 20/20), ma solo come { open_now } — niente periods, quindi
// niente orario di chiusura.

const RISULTATO = (place_id, name, opening_hours) => ({
    place_id, name,
    geometry: { location: { lat: 41.63, lng: 15.917 } },
    rating: 4.4, user_ratings_total: 90,
    business_status: 'OPERATIONAL',
    types: ['restaurant', 'food'],
    ...(opening_hours ? { opening_hours } : {}),
});

describe('Gate TOUR-SENSATO — open_now sul candidato', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('buildPOIFromCandidate porta open_now; senza il dato resta null', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url) => {
            if (String(url).includes('textsearch')) {
                return { ok: true, json: async () => ({ status: 'OK', results: [
                    RISULTATO('pid-chiuso', 'Osteria Sotto Casa', { open_now: false }),
                    RISULTATO('pid-ignoto', 'Senza orari', null),
                ] }) };
            }
            throw new Error(`fetch inatteso: ${url}`);
        }));

        const pois = await discoverRealPOIs('Manfredonia', 41.63, 15.917, 'food', { skipLegacyFallback: true });
        const chiuso = pois.find(p => p.name === 'Osteria Sotto Casa');
        const ignoto = pois.find(p => p.name === 'Senza orari');

        expect(chiuso.open_now).toBe(false);
        expect(ignoto.open_now).toBeNull();
    });

    it('il candidato porta open_now PIATTO, non l’oggetto annidato', async () => {
        // È la ragione per cui la lettura del path notifiche era rotta:
        // buildPOIFromCandidate costruisce un oggetto nuovo e copia solo
        // open_now, mai `opening_hours`.
        vi.stubGlobal('fetch', vi.fn(async (url) => {
            if (String(url).includes('textsearch')) {
                return { ok: true, json: async () => ({ status: 'OK', results: [
                    RISULTATO('pid-chiuso', 'Osteria Sotto Casa', { open_now: false }),
                ] }) };
            }
            throw new Error(`fetch inatteso: ${url}`);
        }));

        const [poi] = await discoverRealPOIs('Manfredonia', 41.63, 15.917, 'food', { skipLegacyFallback: true });
        expect(poi.open_now).toBe(false);
        expect(poi.opening_hours).toBeUndefined();
    });
});

// ─── F18 — la lettura rotta del path notifiche ────────────────────────────────
//
// generateWeatherSocialTip leggeva `p.opening_hours?.open_now` sui candidati:
// sempre undefined, quindi il valore cadeva in silenzio sul fallback `?? null`.
// Con open_now piatto sul candidato e la lettura corretta, ora vale false.

describe('Gate TOUR-SENSATO F18 — open_now arriva ai chosenPois della notifica', () => {
    const INTENT_NOTIF = { queries: ['osteria'], categoria: 'cibo', oggetto_umano: 'osterie', vincoli: { tempo: null, escludi: [], note: null } };
    const CC = { latitude: 41.63, longitude: 15.917, isSmallTown: true, radiusKm: 5 };

    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); window.sessionStorage.clear(); } catch { /* jsdom */ }
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('un POI chiuso produce "chiuso ora" nel prompt, prima taceva', async () => {
        const bodies = [];
        vi.stubGlobal('fetch', vi.fn(async (url, init) => {
            const u = String(url);
            if (u.includes('openai-proxy')) {
                bodies.push(JSON.parse(init.body));
                return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ title: 'Nel pomeriggio 🗺️', message: 'Osteria Sotto Casa è a due passi.' }) } }] }) };
            }
            if (u.includes('textsearch')) {
                return { ok: true, json: async () => ({ status: 'OK', results: [
                    RISULTATO('pid-chiuso', 'Osteria Sotto Casa', { open_now: false }),
                ] }) };
            }
            // place/details senza periods: oh.openNow resta null e il valore
            // deve venire dal candidato — è esattamente il caso che era rotto.
            if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
            throw new Error(`fetch inatteso: ${u}`);
        }));

        await aiRecommendationService.generateWeatherSocialTip(
            'Manfredonia', 'Ivano', 'afternoon',
            { temperatureC: 22, condition: 'sunny', cityCenter: CC, userLat: CC.latitude, userLng: CC.longitude },
        );

        // `open_now` non compare nel valore di ritorno: i chosenPois finali
        // tengono solo { name, place_id, lat, lng }. Il dato alimenta il PROMPT
        // (:1968-1975), quindi è lì che si verifica.
        const prompt = bodies.map(b => JSON.stringify(b)).join('\n');
        expect(prompt).toContain('Osteria Sotto Casa');
        // Con la lettura rotta il ramo `c.open_now === false` non scattava mai
        // e nessun claim sull'apertura finiva nel prompt.
        expect(prompt).toContain('chiuso ora');
    });
});

// Il prompt del selettore: si ispeziona il body inviato a openai-proxy, non il
// valore di ritorno (lezione #16).
//
// ── STORIA DELL'INVERSIONE — leggere prima di modificare ────────────────────
// Questo test ASSERIVA IL CONTRARIO fino al 22/08, ed è stato invertito, non
// riscritto da zero. Le due decisioni, in ordine:
//
//   F18 — Gate TOUR-SENSATO (16/08). `open_now` fu aggiunto DELIBERATAMENTE al
//     payload del selettore, e questo test lo difendeva. Motivo di allora: il
//     prompt conteneva la regola "MAI suggerire posti chiusi ora", che il
//     modello non poteva rispettare perché nessun dato di apertura gli
//     arrivava. Dargli `open_now` sembrava il minimo per rendere la regola
//     applicabile.
//
//   DIFF 3 — Gate NARRATORE ANCORATO (22/08). `open_now` è stato RIMOSSO dal
//     payload del selettore. Due ragioni:
//     1. la regola locked dice di NON usarlo — è istantaneo e perde freschezza
//        in ~30 min — e di preferire closingTimeTodayHH, che su questo path
//        non arriva (la textsearch non restituisce `periods`);
//     2. sul campo la sua presenza INDUCEVA il difetto invece di prevenirlo:
//        avendo un dato di apertura, il modello si sentiva autorizzato ad
//        affermare stati di apertura ("Adesso il locale è pieno di vita",
//        osservato alle 00:18 su un locale chiuso).
//     La regola è stata riscritta come divieto di AFFERMARE stati di apertura:
//     al modello non serve più alcun dato di apertura, quindi non lo riceve.
//
// Il path NOTIFICHE non è stato toccato: lì la gerarchia
// closingTimeTodayHH → open_now è già corretta e il dato viene da place/details.
// Lo presidia il test "un POI chiuso produce 'chiuso ora' nel prompt" qui sopra.
describe('Gate NARRATORE ANCORATO DIFF 3 — open_now NON arriva più nel prompt del selettore', () => {
    const INTENT = { queries: ['osteria'], categoria: 'cibo', oggetto_umano: 'osterie', vincoli: { tempo: null, escludi: [], note: null } };
    const CENTRO = { latitude: 41.63, longitude: 15.917, isSmallTown: true, radiusKm: 5 };

    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('nessun candidato porta open_now nel payload, nemmeno quello con il dato', async () => {
        const bodies = [];
        let aiCall = 0;
        vi.stubGlobal('fetch', vi.fn(async (url, init) => {
            const u = String(url);
            if (u.includes('openai-proxy')) {
                bodies.push(JSON.parse(init.body));
                const payload = aiCall === 0 ? INTENT : { days: [] };
                aiCall += 1;
                return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
            }
            if (u.includes('textsearch')) {
                return { ok: true, json: async () => ({ status: 'OK', results: [
                    RISULTATO('pid-chiuso', 'Osteria Sotto Casa', { open_now: false }),
                    RISULTATO('pid-ignoto', 'Senza orari', null),
                ] }) };
            }
            throw new Error(`fetch inatteso: ${u}`);
        }));

        await aiRecommendationService.generateItinerary(
            'Manfredonia', { interests: ['Cibo'] }, 'cerco osterie', {}, '', CENTRO,
        );

        // bodies[0] = traduttore d'intento, bodies[1] = selettore
        expect(bodies.length).toBe(2);
        const prompt = bodies[1].messages[0].content;
        // La lista serializzata è in coda al prompt, dopo un'etichetta fissa.
        // Ancorarsi a quella: il primo '[' del prompt appartiene al testo.
        const dopoEtichetta = prompt.lastIndexOf('usa i place_id da qui');
        expect(dopoEtichetta).toBeGreaterThan(-1);
        const lista = JSON.parse(prompt.slice(prompt.indexOf('[', dopoEtichetta)));

        const chiuso = lista.find(c => c.name === 'Osteria Sotto Casa');
        const ignoto = lista.find(c => c.name === 'Senza orari');

        // PRIMA (F18): `chiuso.open_now === false`, e omesso su chi non l'aveva.
        // ORA (DIFF 3): il campo non esiste per NESSUNO dei due. Il candidato con
        // il dato è quello che conta: prova che la rimozione è a monte, nel
        // payload, e non un effetto del candidato che il dato non ce l'aveva.
        expect('open_now' in chiuso).toBe(false);
        expect('open_now' in ignoto).toBe(false);
        // I candidati arrivano comunque: si è tolto un campo, non la lista.
        expect(chiuso.name).toBe('Osteria Sotto Casa');
        expect(chiuso.place_id).toBe('pid-chiuso');
    });
});
