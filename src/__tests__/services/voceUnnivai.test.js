// P3d-b — La voce di Unnivai.
//
//   · UN elenco di parole vietate per tutto il testo generato (narratore,
//     "Per Te", notifiche): e' l'unione degli elenchi di prima.
//   · Una frase che APRE con un'impressione dei sensi ("L'aria…", "Il
//     profumo…") viene tolta, come una parola vietata, in generazione e cache.
//   · I prompt del narratore e di "Per Te" hanno la regola "perche' qui" e i
//     suoi esempi GIUSTO/SBAGLIATO.
//
// Rosso sul codice di prima: "assapora" era vietata solo nelle notifiche, le
// aperture dei sensi passavano, i prompt chiedevano "un dettaglio sensoriale
// specifico, cosa vedi/senti/odori".

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { placesDiscoveryService } from '../../services/placesDiscoveryService';
import * as voce from '../../lib/narrationLight';

const { filterBannedWords, BANNED_VOICE_WORDS, bannedWordsPromptLines } = voce;

let prompts = [];
const ROMA = { latitude: 41.8986, longitude: 12.4769, isSmallTown: false, radiusKm: 10 };
let seq = 0;
const place = (name, types, dLat, dLng) => ({
    place_id: `pv-${++seq}-${name.replace(/\W+/g, '-').toLowerCase()}`,
    name,
    geometry: { location: { lat: ROMA.latitude + dLat, lng: ROMA.longitude + dLng } },
    rating: 4.6, user_ratings_total: 400, business_status: 'OPERATIONAL', types,
});
const MUSEO = ['museum', 'tourist_attraction', 'point_of_interest', 'establishment'];
const RISTO = ['restaurant', 'food', 'point_of_interest', 'establishment'];
const BAR = ['bar', 'point_of_interest', 'establishment'];

const LIBERAZIONE = place('Museo Storico della Liberazione', MUSEO, 0.002, 0.000);
const MUSEI = [LIBERAZIONE, place('Galleria Doria Pamphilj', MUSEO, -0.002, 0.004), place('Museo Barracco', MUSEO, -0.001, -0.002)];
const TRATTORIE = [place('Armando al Pantheon', RISTO, 0.000, 0.003), place('Da Teo', RISTO, -0.011, 0.001)];
const BARS = [place('Enoteca Il Goccetto', BAR, -0.003, -0.006)];
const PERQUERY = { museo: MUSEI, trattoria: TRATTORIE, enoteca: BARS };
const INTENT = { queries: ['museo', 'trattoria', 'enoteca'], categoria: 'misto', oggetto_umano: 'la Roma dei romani', vincoli: { tempo: null, escludi: [], note: null } };

const SELECTOR = { stops: [
    { place_id: LIBERAZIONE.place_id, moment: 'g1-mattina' },
    { place_id: TRATTORIE[0].place_id, moment: 'g1-pranzo' },
    { place_id: MUSEI[1].place_id, moment: 'g1-pomeriggio' },
    { place_id: BARS[0].place_id, moment: 'g1-aperitivo' },
    { place_id: TRATTORIE[1].place_id, moment: 'g1-cena' },
] };

const routeFetch = (narrate) => vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes('openai-proxy')) {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const sys = String(body.messages?.[0]?.content ?? '');
        prompts.push(sys);
        const user = String(body.messages?.[1]?.content ?? '');
        let payload;
        if (sys.includes('traduttore di intenti')) payload = INTENT;
        else if (sys.includes('SEI IL NARRATORE')) {
            const giorni = JSON.parse(user.split('TAPPE FINALI:\n')[1]);
            payload = { days: giorni.map(g => ({ day: g.giorno, title: 'G', stops: g.tappe.map(narrate) })) };
        } else payload = SELECTOR;
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
    }
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


// P3d-e — gli esempi GIUSTO di prima ("gli alberi grandi", "i vialetti")
// insegnavano a inventare dettagli: ora vengono dai fatti e dai dati.
const GIUSTO = [
    'Aperti nel 1734, sono considerati il primo museo pubblico al mondo.',
    'Per il pranzo: trattoria, fascia €€, a 6 minuti dalla tappa prima.',
];
// P3d-i — gli esempi del prompt: 3 giusti e 3 sbagliati dalle prove reali P3d-g.
const GIUSTO_P3DI = [
    "L'Aventino è uno dei sette colli su cui venne fondata Roma, il più a sud.",
    "Piazza Colonna deve il suo nome alla colonna di Marco Aurelio, che qui sorge sin dall'antichità.",
    "La fontana dell'Amenano è una fontana monumentale del 1867 sul lato sud di piazza del Duomo.",
];
const SBAGLIATO_P3DI = [
    'Un belvedere a 18:00, per la tua richiesta: un giro insider, trovato cercando "belvedere panorama".',
    'Piazza Umbrella, un luogo per la tua richiesta, un giro insider.',
    "Un'osteria a disposizione, scelto per il tuo dopocena.",
];
// Le aperture dei sensi restano tolte dal filtro (P3d-b), anche se non sono
// piu' fra gli esempi del prompt.
const SBAGLIATO = [
    "L'aria fresca qui è un sollievo dopo la passeggiata.",
    "Il profumo della pasta fresca riempie l'aria.",
    "L'odore del sugo si mescola al profumo del pane.",
];

describe('P3d-b — un elenco solo per tutto il testo generato', () => {
    it("l'elenco unico contiene le parole di narratore, \"Per Te\" e notifiche (prompt e filtro)", () => {
        for (const w of [
            // P3d-c: senza i falsi positivi "unico", "gusta", "consiglio", "non perdere", "una scoperta"
            'storico', 'tradizionale', 'esperienza unica', 'caratteristico', 'suggestivo', 'tipico', 'affascinante', 'magico', 'imperdibile',
            'ottima scelta', 'perfetta scelta',
            'spettacolare', 'indimenticabile', 'atmosfera intima', 'vista mozzafiato',
            'sorseggia', 'immergiti', 'assapora',
            'vale la pena', 'da provare', 'consigliato', 'perfetto per', 'ideale per', 'assolutamente da',
            'ottima idea', 'ottimo posto', 'da non perdere', 'un must', 'una chicca', 'una perla', 'un gioiello',
        ]) expect(BANNED_VOICE_WORDS, w).toContain(w);
        expect(new Set(BANNED_VOICE_WORDS).size).toBe(BANNED_VOICE_WORDS.length);
        expect(voce.BANNED_VOICE_PHRASES_HOME).toBeUndefined(); // nessun elenco a parte
    });

    it('"assapora" (e le sue forme) → frase tolta', () => {
        for (const f of ['Assapora la carbonara al bancone.', 'Da assaporare piano.', 'Un caffè consigliato.']) {
            expect(filterBannedWords(f).text, f).toBeNull();
        }
        expect(filterBannedWords('Il gusto della casa è nel pane.').text).toBe('Il gusto della casa è nel pane.');
    });
});

describe("P3d-b — niente attacchi da audioguida", () => {
    it('gli esempi SBAGLIATO sono tolti, con la regola "apertura-sensi"', () => {
        for (const f of SBAGLIATO) {
            const r = filterBannedWords(f);
            expect(r.text, f).toBeNull();
            expect(r.removed[0].regola, f).toBe('apertura-sensi');
        }
        for (const f of ['Il silenzio del chiostro ti accoglie.', 'Panorama aperto sui tetti.', 'Camminando senti le campane di Santa Maria.',
            'Il vento porta il sale fin dentro le mura.', '“Il profumo del caffè arriva in strada.”', 'Profumi di forno all\'angolo.']) {
            expect(filterBannedWords(f).text, f).toBeNull();
        }
    });

    it('gli esempi GIUSTO restano, e anche le frasi che nominano i sensi senza aprire con loro', () => {
        for (const f of [...GIUSTO, 'Venti minuti a piedi e sei al porto.', 'Dal muretto il panorama arriva fino al Gianicolo.',
            'Ariccia è a mezz\'ora di treno.', 'Arianna aspetta al bancone.', 'Silenziosi i cortili interni, la mattina presto.']) {
            expect(filterBannedWords(f).text, f).toBe(f);
        }
    });

    it('in un testo di più frasi si toglie solo quella che apre con i sensi', () => {
        expect(filterBannedWords("L'aria qui è ferma. Guarda il campanile dal lato del mercato.").text)
            .toBe('Guarda il campanile dal lato del mercato.');
    });

    it('"centro storico" e il nome proprio della tappa restano salvi', () => {
        expect(filterBannedWords('Passeggia nel centro storico fino al Duomo.').text).toBe('Passeggia nel centro storico fino al Duomo.');
        const f = 'Il Museo Storico della Liberazione ha sale fresche anche ad agosto.';
        expect(filterBannedWords(f, { exempt: ['Museo Storico della Liberazione'] }).text).toBe(f);
        expect(filterBannedWords('Il centro storico è magico.').text).toBeNull();
    });
});


// P3d-j — il narratore e "Per Te" non scrivono piu' testo per le tappe: le
// frasi composte e la rete sono provate in stopPhrases.test.js e
// narratoreComposto.test.js. Restano qui l'elenco unico e le notifiche.

describe('P3d-b — notifiche: stesso elenco, nel prompt e nel filtro', () => {
    const CC = { latitude: 41.8986, longitude: 12.4769, radiusKm: 10 };
    const CAND = [{ name: 'Da Teo', place_id: 'pid-teo', latitude: 41.899, longitude: 12.477, rating: 4.5, user_ratings_total: 300, types: ['restaurant'] }];
    let notifPrompt;
    const notifFetch = (message) => vi.fn(async (url, init) => {
        if (String(url).includes('openai-proxy')) {
            notifPrompt = String(JSON.parse(String(init?.body ?? '{}')).messages?.[0]?.content ?? '');
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ message }) } }] }) };
        }
        throw new Error(`fetch inatteso: ${url}`);
    });
    const tip = () => aiRecommendationService.generateWeatherSocialTip('Roma', 'Ivano', 'midday', {
        temperatureC: 22, condition: 'sunny', cityCenter: CC, source: 'gps', userLat: 41.8986, userLng: 12.4769,
    });

    let spies = [];
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        spies = [
            vi.spyOn(placesDiscoveryService, 'discoverRealPOIs').mockResolvedValue(CAND),
            vi.spyOn(placesDiscoveryService, 'fetchPlaceOpeningHours').mockResolvedValue({ closingTimeTodayHH: '15:00' }),
        ];
    });
    afterEach(() => { vi.unstubAllGlobals(); for (const sp of spies) sp.mockRestore(); });

    it('"Assapora" in coda → frase tolta; il prompt mostra l\'elenco unico', async () => {
        vi.stubGlobal('fetch', notifFetch('Da Teo è a 4 minuti da te e chiude alle 15:00. Assapora la carbonara.'));
        const t = await tip();
        expect(t.message).toBe('Da Teo è a 4 minuti da te e chiude alle 15:00.');
        expect(notifPrompt).toContain(bannedWordsPromptLines());
        expect(notifPrompt).toContain('"storico"');
    });

    it('una formula di giudizio resta tolta come prima ("Da provare!")', async () => {
        vi.stubGlobal('fetch', notifFetch('Da Teo è a 4 minuti da te e chiude alle 15:00. Da provare!'));
        const t = await tip();
        expect(t.message).toBe('Da Teo è a 4 minuti da te e chiude alle 15:00.');
    });
});
