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


const GIUSTO = [
    "L'ombra vera è sotto gli alberi grandi, non lungo i vialetti.",
    "Bastano pochi passi di lato per togliersi la folla dall'inquadratura.",
    "Se ha piovuto da poco, i vialetti in terra battuta diventano fango.",
];
const SBAGLIATO = [
    "L'aria fresca qui è un sollievo dopo la passeggiata.",
    "Il profumo della pasta fresca riempie l'aria.",
    "L'odore del sugo si mescola al profumo del pane.",
];

describe('P3d-b — un elenco solo per tutto il testo generato', () => {
    it("l'elenco unico contiene le parole di narratore, \"Per Te\" e notifiche (prompt e filtro)", () => {
        for (const w of [
            'storico', 'tradizionale', 'unico', 'caratteristico', 'suggestivo', 'tipico', 'affascinante', 'magico', 'imperdibile',
            'ottima scelta', 'perfetta scelta',
            'spettacolare', 'indimenticabile', 'atmosfera intima', 'vista mozzafiato',
            'sorseggia', 'gusta', 'immergiti', 'assapora',
            'vale la pena', 'da provare', 'consigliato', 'perfetto per', 'ideale per', 'consiglio', 'assolutamente da',
            'ottima idea', 'ottimo posto', 'non perdere', 'un must', 'una chicca', 'una scoperta', 'una perla', 'un gioiello',
        ]) expect(BANNED_VOICE_WORDS, w).toContain(w);
        expect(new Set(BANNED_VOICE_WORDS).size).toBe(BANNED_VOICE_WORDS.length);
        expect(voce.BANNED_VOICE_PHRASES_HOME).toBeUndefined(); // nessun elenco a parte
    });

    it('"assapora" (e le sue forme) → frase tolta', () => {
        for (const f of ['Assapora la carbonara al bancone.', 'Da assaporare piano.', 'Si gusta in piedi.', 'Un caffè consigliato.']) {
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


describe('P3d-b — narratore dell\'itinerario', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prompts = [];
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-05T20:57:00+02:00'));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('"assapora" (parola delle notifiche) → frase tolta anche dal narratore', async () => {
        vi.stubGlobal('fetch', routeFetch((t) => ({
            place_id: t.place_id,
            description: 'Assapora il pane caldo al bancone. Le scale sono di pietra chiara.',
        })));
        const r = await genera();
        for (const s of allStops(r)) expect(s.description, s.title).toBe('Le scale sono di pietra chiara.');
        expect(r._narrationReport.frasiTolte.some(x => (x.parole || []).includes('assapora'))).toBe(true);
    });

    it('frase che apre con "Il profumo" → tolta; se era l\'unica, descrizione vuota (generazione e cache)', async () => {
        vi.stubGlobal('fetch', routeFetch((t) => ({
            place_id: t.place_id,
            description: t.place_id === LIBERAZIONE.place_id
                ? 'Il profumo della pasta fresca riempie l\'aria.'
                : 'Il profumo del sugo arriva in strada. Le scale sono di pietra chiara.',
        })));
        const r1 = await genera();
        const lib = allStops(r1).find(s => s.place_id === LIBERAZIONE.place_id);
        expect(lib.description).toBeNull();
        for (const s of allStops(r1).filter(s => s.place_id !== LIBERAZIONE.place_id)) {
            expect(s.description, s.title).toBe('Le scale sono di pietra chiara.');
        }
        expect(r1._narrationReport.frasiTolte.filter(x => x.regole.includes('apertura-sensi')).length).toBeGreaterThan(0);

        // cache scritta prima del controllo: l'apertura dei sensi e' li'
        const key = Object.keys(window.localStorage).find(k => k.startsWith('unnivai_insiderf10_narratore_'));
        const entry = JSON.parse(window.localStorage.getItem(key));
        entry.data.days[0].stops[1].description = "L'odore del sugo si mescola al profumo del pane. Il selciato scende.";
        window.localStorage.setItem(key, JSON.stringify(entry));
        const r2 = await genera();
        expect(allStops(r2)[1].description).toBe('Il selciato scende.');
    });

    it('il nome proprio della tappa resta salvo', async () => {
        const frase = 'Il Museo Storico della Liberazione ha sale fresche anche ad agosto.';
        vi.stubGlobal('fetch', routeFetch((t) => ({
            place_id: t.place_id,
            description: t.place_id === LIBERAZIONE.place_id ? frase : 'Passeggia nel centro storico fino al Duomo.',
        })));
        const r = await genera();
        expect(allStops(r).find(s => s.place_id === LIBERAZIONE.place_id).description).toBe(frase);
        expect(allStops(r).filter(s => s.place_id !== LIBERAZIONE.place_id).every(s => s.description === 'Passeggia nel centro storico fino al Duomo.')).toBe(true);
    });

    it('il prompt del narratore contiene la regola "perché qui", gli esempi e l\'elenco unico', async () => {
        vi.stubGlobal('fetch', routeFetch((t) => ({ place_id: t.place_id, description: 'Le scale sono di pietra chiara.' })));
        await genera();
        const p = prompts.find(x => x.includes('SEI IL NARRATORE'));
        expect(p).toBeTruthy();
        expect(p).toContain('PERCHÉ QUI');
        expect(p).toContain('UNA frase, massimo 20 parole');
        expect(p).toContain('cosa guardare, da dove guardarlo o quando');
        expect(p).toContain("NON aprire con un'impressione dei sensi");
        for (const f of GIUSTO) expect(p).toContain(`GIUSTO: "${f}"`);
        for (const f of SBAGLIATO) expect(p).toContain(`SBAGLIATO: "${f}"`);
        expect(p).toContain(bannedWordsPromptLines());
        expect(p).not.toContain('cosa vedi/senti/odori');
    });
});

describe('P3d-b — "Per Te" della Home', () => {
    const CITY = 'Ippocampo';
    const CENTER = { latitude: 41.6489, longitude: 15.9012 };
    const POOL = {
        cultura: [
            { place_id: 'pid-uno', name: 'Torre Capitania', latitude: CENTER.latitude, longitude: CENTER.longitude, rating: 4.6, type: 'museum', city: CITY },
            { place_id: 'pid-due', name: 'Museo del Sale', latitude: CENTER.latitude + 0.001, longitude: CENTER.longitude, rating: 4.4, type: 'museum', city: CITY },
        ],
    };
    const homeFetch = (payload) => vi.fn(async (url, init) => {
        if (String(url).includes('openai-proxy')) {
            prompts.push(String(JSON.parse(String(init?.body ?? '{}')).messages?.[0]?.content ?? ''));
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }
        throw new Error(`fetch inatteso: ${url}`);
    });
    const tour = (stops) => ({ tours: [{ themeType: 'cultura', title: 'Cultura a Ippocampo', stops }] });
    const home = () => aiRecommendationService.generateHomeTours({ city: CITY, cityCenter: CENTER, themedCandidates: POOL, opts: { skipUserQuota: true } });

    beforeEach(() => {
        vi.clearAllMocks();
        prompts = [];
        try { window.localStorage.clear(); } catch { /* jsdom */ }
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('descrizione che apre con "Il profumo" → frase tolta; se era l\'unica, la tappa esce', async () => {
        vi.stubGlobal('fetch', homeFetch(tour([
            { place_id: 'pid-uno', description: "Il profumo della pasta fresca riempie l'aria." },
            { place_id: 'pid-due', description: 'Assapora il sale. Le vasche hanno bordi bianchi.' },
            { place_id: 'pid-uno', description: 'x' },
        ].slice(0, 2))));
        const res = await home();
        const stops = res.tours[0]?.stops || [];
        expect(stops.map(s => s.place_id)).toEqual(['pid-due']);
        expect(stops[0].description).toBe('Le vasche hanno bordi bianchi.');
    });

    it('dalla CACHE: apertura dei sensi tolta, nessuna nuova chiamata', async () => {
        const fn = homeFetch(tour([
            { place_id: 'pid-uno', description: 'Le panche sono di pietra.' },
            { place_id: 'pid-due', description: 'Le vasche hanno bordi bianchi.' },
        ]));
        vi.stubGlobal('fetch', fn);
        await home();
        const key = Object.keys(window.localStorage).find(k => k.startsWith('hometours_v1_'));
        const entry = JSON.parse(window.localStorage.getItem(key));
        entry.data.tours[0].stops[0].description = "L'aria qui è ferma. Le panche sono di pietra.";
        window.localStorage.setItem(key, JSON.stringify(entry));
        const res = await home();
        expect(fn.mock.calls).toHaveLength(1);
        expect(res.tours[0].stops[0].description).toBe('Le panche sono di pietra.');
    });

    it('il prompt di "Per Te" contiene la regola "perché qui", gli esempi e l\'elenco unico', async () => {
        vi.stubGlobal('fetch', homeFetch(tour([
            { place_id: 'pid-uno', description: 'Le panche sono di pietra.' },
            { place_id: 'pid-due', description: 'Le vasche hanno bordi bianchi.' },
        ])));
        await home();
        const p = prompts[0];
        expect(p).toContain('PERCHÉ QUI');
        expect(p).toContain('UNA frase, massimo 20 parole');
        for (const f of GIUSTO) expect(p).toContain(`GIUSTO: "${f}"`);
        for (const f of SBAGLIATO) expect(p).toContain(`SBAGLIATO: "${f}"`);
        expect(p).toContain(bannedWordsPromptLines());
        expect(p).not.toContain('cosa vedi/senti/odori');
    });
});

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
