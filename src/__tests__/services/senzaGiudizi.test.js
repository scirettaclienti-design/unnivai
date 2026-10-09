// P3d-g — Senza fatti, niente giudizi.
//
// Le 8 frasi ✗ delle prove reali P3d-e (09/10/2026), parola per parola, con la
// loro tappa: nessuna aveva fatti, e ognuna dava un giudizio che nessuno puo'
// verificare ("uno dei migliori", "cuore culturale", "collezioni uniche"…) o
// chiamava il locale con il tipo sbagliato (Osteria Navona → "Trattoria").
// Ora il codice le toglie; un giudizio passa solo se e' scritto nei fatti.
//
// Rosso sul codice di prima (7ee2584): passavano tutte (il controllo guardava
// solo gli oggetti concreti), tipoTappa non leggeva "bar", il narratore non
// riceveva tipo/motivo/minuti dei luoghi, "Per Te" non controllava l'ora.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    filterInventedObjects, UNSUPPORTED_JUDGMENTS, unsupportedJudgments, tipoTappa, safeDescription, localeTypeOfName, misattributedFact,
} from '../../lib/narrationLight';
import { aiRecommendationService, placeReasons } from '../../services/aiRecommendationService';

const LE_8 = [
    ['Belvedere Tarpeo', 'Situato sulla cima del Campidoglio, offre una vista straordinaria su Roma e i suoi antichi fori.'],
    ['Terrazza Belvedere Aventino', 'Affacciata su Roma, è uno dei migliori punti panoramici della città.'],
    ['Piazza Vincenzo Bellini', 'Una piazza che rappresenta il cuore culturale di Catania.'],
    ['Belvedere del Salviati · Terrazza Panoramica Passeggiata del Gianicolo', 'Un angolo meno frequentato, dove il panorama si apre sulle colline romane.'],
    ['Osteria Navona', 'Trattoria, fascia €€, a 6 minuti dalla tappa prima.'],
    ['Galleria Colonna', 'Un museo con collezioni uniche che raccontano la storia di Roma attraverso i secoli.'],
    ['Gianicolo Belvedere', 'Un belvedere che offre una vista incantevole sui tetti di Roma al chiaro di luna.'],
    ['Ingresso di Villa Pamphili', 'Un ingresso a un parco che invita a scoprire angoli di natura incontaminata.'],
];

describe('P3d-g — le 8 frasi ✗ di P3d-e vengono tolte', () => {
    for (const [nome, frase] of LE_8) {
        it(`${nome}: "${frase}"`, () => {
            const r = filterInventedObjects(frase, { fatti: [], nomi: [nome] });
            expect(r.text).toBeNull();
            expect(r.removed).toHaveLength(1);
            expect(['giudizio', 'tipo-locale', 'invenzione']).toContain(r.removed[0].regola);
        });
    }

    it('Osteria Navona → "Trattoria": tolta per il tipo, e la frase sicura dice "osteria"', () => {
        const r = filterInventedObjects('Trattoria, fascia €€, a 6 minuti dalla tappa prima.', { nomi: ['Osteria Navona'] });
        expect(r.removed[0]).toMatchObject({ regola: 'tipo-locale', oggetti: ['trattoria'], tipoNome: 'osteria' });
        // il nome vince sul tipo Google ("bar")
        expect(tipoTappa({ title: 'Osteria Navona', types: ['bar', 'establishment', 'food'] })).toBe('osteria');
        expect(safeDescription({ stop: { title: 'Osteria Navona', types: ['bar', 'food'] }, momento: 'cena', locale: true, priceLevel: 2, minutiDaPrima: 6 }))
            .toBe('Per la cena: osteria, fascia €€, a 6 minuti a piedi dalla tappa prima.');
        // e la stessa frase con il tipo giusto passa
        expect(filterInventedObjects('Osteria, fascia €€, a 6 minuti dalla tappa prima.', { nomi: ['Osteria Navona'] }).removed).toEqual([]);
    });

    it('il nome vince sul tipo Google anche per bar, enoteca, pizzeria, trattoria', () => {
        expect(tipoTappa({ title: 'Bar del Fico', types: ['restaurant'] })).toBe('bar');
        expect(tipoTappa({ title: 'Enoteca Il Goccetto', types: ['bar'] })).toBe('enoteca');
        expect(tipoTappa({ title: 'Pizzeria da Remo', types: ['restaurant'] })).toBe('pizzeria');
        expect(tipoTappa({ title: 'Trattoria Della Stampa', types: ['restaurant'] })).toBe('trattoria');
        expect(localeTypeOfName('Barberini Palace')).toBeNull(); // "bar" solo come parola intera
    });
});

describe('P3d-g — un giudizio passa solo se e\' scritto nei fatti', () => {
    it('"uno dei sette colli" nei fatti dell\'Aventino: la frase passa; senza fatti, no', () => {
        const frase = "L'Aventino è uno dei sette colli di Roma, il più a sud.";
        const fatti = [{ testo: "L'Aventino è uno dei sette colli su cui venne fondata Roma, il più a sud.", fonte: 'wikipedia' }];
        expect(filterInventedObjects(frase, { fatti, nomi: ['Terrazza Belvedere Aventino'] }).removed).toEqual([]);
        expect(filterInventedObjects(frase, { fatti: [], nomi: ['Terrazza Belvedere Aventino'] }).removed[0].regola).toBe('giudizio');
    });

    it('"affacciato sul Campo Marzio" nei fatti del Pincio: la vista passa', () => {
        const fatti = [{ testo: 'Il Pincio è un colle di Roma, affacciato ad ovest sul Campo Marzio.', fonte: 'wikipedia' }];
        expect(filterInventedObjects('Il Pincio, affacciato sul Campo Marzio: ci arrivi nel pomeriggio.', { fatti, nomi: ['Terrazza del Pincio'] }).removed).toEqual([]);
    });

    it('il nome non vale come fatto, ma non fa scattare il controllo ("Unico Bar" e\' un nome)', () => {
        expect(unsupportedJudgments('Per il pranzo: Unico Bar, a 3 minuti.', '', ['Unico Bar'])).toEqual([]);
    });

    it('le frasi ✓ di P3d-e restano: dati e fatti, senza giudizi', () => {
        for (const [nome, frase, fatti] of [
            ['È Passata la Moretta | Osteria Romana di un Tempo', 'Per il pranzo: osteria, fascia €€, a 18 minuti dalla tappa prima.', []],
            ['Belvedere Cederna', "Belvedere, tappa dell'aperitivo: arrivo alle 18:00, il tramonto è alle 18:37.", []],
            ['Musei Capitolini', 'I Musei Capitolini sono la principale struttura museale civica di Roma con 12.977 m² di esposizione.',
                [{ testo: 'I Musei Capitolini costituiscono la principale struttura museale civica comunale di Roma, con una superficie espositiva di 12.977 m².' }]],
            ['Basilica dei Santi XII Apostoli', 'La basilica dei Santi XII Apostoli è un luogo di culto cattolico nel rione Trevi.',
                [{ testo: 'La basilica dei Santi XII Apostoli è un luogo di culto cattolico del centro storico di Roma situato nel rione Trevi.' }]],
            ['Belvedere Tarpeo', 'Un belvedere a 8 minuti dalla tappa prima: è qui per la tua richiesta, la Roma dei romani.', []],
        ]) {
            expect(filterInventedObjects(frase, { fatti, nomi: [nome] }).removed, frase).toEqual([]);
        }
    });

    it('l\'elenco dei giudizi e\' esplicito e contiene quelli chiesti', () => {
        const nomi = UNSUPPORTED_JUDGMENTS.map(j => j.nome);
        for (const n of ['migliore', 'unico', 'cuore di', 'straordinario', 'incontaminato', 'imperdibile', 'uno dei', 'vista su']) expect(nomi).toContain(n);
        expect(unsupportedJudgments('Una vista incantevole.', '')).toContain('straordinario');
    });
});

describe('P3d-g — il "perche\' qui, per te" di un luogo senza fatti si fa con i dati', () => {
    it('placeReasons: richiesta, ricerca che l\'ha trovato, tema del tour', () => {
        expect(placeReasons({ _ricerca: 'belvedere panorama Roma' }, { intent: { oggetto_umano: 'la Roma dei romani' } }))
            .toEqual(['per la richiesta dell\'utente: la Roma dei romani', 'trovato cercando "belvedere panorama Roma"']);
        expect(placeReasons({}, { tema: 'romance' })).toEqual(['scelto per il tour in coppia']);
    });
});

// ─── Integrazione: il narratore dell'itinerario riceve i dati di ogni tappa ──
const ROMA = { latitude: 41.8986, longitude: 12.4769, isSmallTown: false, radiusKm: 10 };
let seq = 0;
const place = (name, types, dLat, dLng, extra = {}) => ({
    place_id: `pg-${++seq}-${name.replace(/\W+/g, '-').toLowerCase()}`, name,
    geometry: { location: { lat: ROMA.latitude + dLat, lng: ROMA.longitude + dLng } },
    rating: 4.6, user_ratings_total: 400, business_status: 'OPERATIONAL', types, ...extra,
});
const BELV = place('Belvedere Tarpeo', ['tourist_attraction', 'point_of_interest'], 0.002, 0.000);
const MUSEI = [BELV, place('Galleria Doria Pamphilj', ['museum'], -0.002, 0.004), place('Museo Barracco', ['museum'], -0.001, -0.002)];
// types veri di Osteria Navona in P3d-e: bar, establishment, food (qui anche
// restaurant, perche' lo scheletro la metta a pranzo).
const OSTERIA = place('Osteria Navona', ['bar', 'restaurant', 'food', 'point_of_interest'], 0.000, 0.003, { price_level: 2 });
const TRATTORIE = [OSTERIA, place('Da Teo', ['restaurant', 'food'], -0.011, 0.001, { price_level: 2 })];
const BARS = [place('Enoteca Il Goccetto', ['bar'], -0.003, -0.006)];
const PERQUERY = { belvedere: MUSEI, osteria: TRATTORIE, enoteca: BARS };
const INTENT = { queries: ['belvedere', 'osteria', 'enoteca'], categoria: 'misto', oggetto_umano: 'la Roma dei romani', vincoli: { tempo: null, escludi: [], note: null } };
const SELECTOR = { stops: [
    { place_id: BELV.place_id, moment: 'g1-mattina' }, { place_id: OSTERIA.place_id, moment: 'g1-pranzo' },
    { place_id: MUSEI[1].place_id, moment: 'g1-pomeriggio' }, { place_id: BARS[0].place_id, moment: 'g1-aperitivo' },
    { place_id: TRATTORIE[1].place_id, moment: 'g1-cena' },
] };
let calls;
const routeFetch = (narrate, rewrite = () => ({ stops: [] })) => vi.fn(async (url, init) => {
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
            kind = 'riscrittura'; payload = rewrite(JSON.parse(user.split('TAPPE:\n')[1]));
        } else { kind = 'selettore'; payload = SELECTOR; }
        calls.push({ kind, body, user });
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }], usage: { total_tokens: 100 } }) };
    }
    if (u.includes('textsearch')) {
        const q = new URL(u, 'http://x').searchParams.get('query');
        const hit = Object.keys(PERQUERY).find(k => q === `${k} Roma`);
        return { ok: true, json: async () => (hit ? { status: 'OK', results: PERQUERY[hit] } : { status: 'ZERO_RESULTS', results: [] }) };
    }
    if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
    throw new Error(`fetch inatteso: ${u}`); // fatti: nessuno (Wikipedia/Overpass irraggiungibili)
});
const genera = () => aiRecommendationService.generateItinerary(
    'Roma', { interests: ['Arte', 'Cibo'], pace: 'Rilassato', duration: '1 Giorno' },
    'Domani voglio vivere Roma da romano', {}, '', ROMA, { pathType: 'custom', skipUserQuota: true },
);
const allStops = (r) => r.days.flatMap(d => d.stops);

describe('P3d-g — itinerario: dati per ogni tappa, giudizi tolti, mai vuota', () => {
    beforeEach(() => {
        vi.clearAllMocks(); calls = [];
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-05T20:57:00+02:00'));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('il narratore riceve per ogni tappa tipo, minuti, tramonto davanti e motivo (anche per i luoghi)', async () => {
        vi.stubGlobal('fetch', routeFetch((t) => ({ place_id: t.place_id, description: 'Una tappa sul percorso.' })));
        await genera();
        const tappe = JSON.parse(calls.find(c => c.kind === 'narratore').user.split('TAPPE FINALI:\n')[1]).flatMap(g => g.tappe);
        const belv = tappe.find(t => t.place_id === BELV.place_id);
        expect(belv.tipo).toBe('belvedere');
        expect(belv.motivo).toEqual(['per la richiesta dell\'utente: la Roma dei romani', 'trovato cercando "belvedere"']);
        expect(typeof belv.tramonto_ancora_davanti).toBe('boolean');
        expect('minuti_a_piedi_da_prima' in belv).toBe(true);
        const ost = tappe.find(t => t.place_id === OSTERIA.place_id);
        expect(ost.tipo).toBe('osteria');
        expect(ost.locale).toBe(true);
        expect(Number.isFinite(ost.minuti_a_piedi_da_prima)).toBe(true);
        expect(calls.map(c => c.kind)).toEqual(['traduttore', 'selettore', 'narratore']); // chiamate invariate
    });

    it('"uno dei migliori punti panoramici" senza fatti → tolta, UNA riscrittura con il motivo, poi frase sicura', async () => {
        vi.stubGlobal('fetch', routeFetch(
            (t) => ({ place_id: t.place_id, description: t.place_id === BELV.place_id ? 'Affacciata su Roma, è uno dei migliori punti panoramici della città.' : 'Una tappa sul percorso.' }),
            (tappe) => ({ stops: tappe.map(t => ({ place_id: t.place_id, description: 'Un belvedere straordinario.' })) }),
        ));
        const r = await genera();
        const rw = calls.filter(c => c.kind === 'riscrittura');
        expect(rw).toHaveLength(1);
        const item = JSON.parse(rw[0].user.split('TAPPE:\n')[1]).find(t => t.place_id === BELV.place_id);
        expect(item.tolto[0].motivo).toMatch(/giudizio/);
        expect(item.motivo).toContain('per la richiesta dell\'utente: la Roma dei romani');
        const s = allStops(r).find(x => x.place_id === BELV.place_id);
        expect(s._fraseSicura).toBe(true);
        expect(s.description).toMatch(/^Belvedere, tappa della mattina: arrivo alle \d{2}:\d{2}/);
        for (const st of allStops(r)) expect(String(st.description || '').trim().length, st.title).toBeGreaterThan(0);
    });

    it('Osteria Navona chiamata "trattoria" dal narratore → tolta, la riscrittura riceve tipo "osteria"', async () => {
        vi.stubGlobal('fetch', routeFetch(
            (t) => ({ place_id: t.place_id, description: t.place_id === OSTERIA.place_id ? 'Trattoria, fascia €€, a 6 minuti dalla tappa prima.' : 'Una tappa sul percorso.' }),
            (tappe) => ({ stops: tappe.map(t => ({ place_id: t.place_id, description: `Per il pranzo: ${t.tipo}, fascia €€.` })) }),
        ));
        const r = await genera();
        const item = JSON.parse(calls.find(c => c.kind === 'riscrittura').user.split('TAPPE:\n')[1]).find(t => t.place_id === OSTERIA.place_id);
        expect(item.tipo).toBe('osteria');
        expect(item.tolto[0].motivo).toContain('il nome dice "osteria"');
        expect(allStops(r).find(x => x.place_id === OSTERIA.place_id).description).toBe('Per il pranzo: osteria, fascia €€.');
    });
});

// ─── "Per Te": dopo cena il tramonto non compare ─────────────────────────────
describe('P3d-g — "Per Te": luce e ora sull\'ora di adesso', () => {
    const CITY = 'Ippocampo';
    const CENTER = { latitude: 41.6489, longitude: 15.9012 };
    const POOL = {
        romance: [
            { place_id: 'pid-belv', name: 'Belvedere del Faro', latitude: CENTER.latitude, longitude: CENTER.longitude, rating: 4.6, types: ['tourist_attraction'], city: CITY },
            { place_id: 'pid-due', name: 'Museo del Sale', latitude: CENTER.latitude + 0.001, longitude: CENTER.longitude, rating: 4.4, types: ['museum'], city: CITY },
            { place_id: 'pid-tre', name: 'Chiesa Madre', latitude: CENTER.latitude + 0.002, longitude: CENTER.longitude, rating: 4.5, types: ['church'], city: CITY },
        ],
    };
    let homeCalls;
    const homeFetch = (tourPayload, rewrite) => vi.fn(async (url, init) => {
        if (!String(url).includes('openai-proxy')) throw new Error(`fetch inatteso: ${url}`);
        const body = JSON.parse(String(init?.body ?? '{}'));
        const isRw = String(body.messages?.[0]?.content ?? '').includes('Riscrivi SOLO il campo description');
        const tappe = isRw ? JSON.parse(String(body.messages[1].content).split('TAPPE:\n')[1]) : null;
        homeCalls.push({ kind: isRw ? 'riscrittura' : 'tour', tappe });
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(isRw ? rewrite(tappe) : tourPayload) } }] }) };
    });
    beforeEach(() => {
        vi.clearAllMocks(); homeCalls = [];
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-09T22:40:00+02:00')); // dopocena, il tramonto e' passato da ore
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('dopocena: "al tramonto" del selettore e della riscrittura si toglie; la frase sicura non nomina il tramonto', async () => {
        vi.stubGlobal('fetch', homeFetch(
            { tours: [{ themeType: 'romance', title: 'Sera', stops: [
                { place_id: 'pid-belv', description: 'Al tramonto il mare diventa arancione.' },
                { place_id: 'pid-due', description: 'Una tappa del tuo tour.' },
                { place_id: 'pid-tre', description: 'Una tappa del tuo tour.' },
            ] }] },
            (tappe) => ({ stops: tappe.map(t => ({ place_id: t.place_id, description: t.place_id === 'pid-belv' ? 'Vieni qui per il tramonto.' : `Un ${t.tipo} per il tuo tour in coppia.` })) }),
        ));
        const res = await aiRecommendationService.generateHomeTours({ city: CITY, cityCenter: CENTER, themedCandidates: POOL, opts: { skipUserQuota: true } });
        expect(homeCalls.map(c => c.kind)).toEqual(['tour', 'riscrittura']); // 2 chiamate, invariate
        const belv = res.tours[0].stops.find(s => s.place_id === 'pid-belv');
        expect(belv.description).not.toMatch(/tramont/i);
        expect(belv._fraseSicura).toBe(true);
        expect(belv.description).toBe('Belvedere, tappa del dopocena.');
        const item = homeCalls[1].tappe.find(t => t.place_id === 'pid-belv');
        expect(item.tramonto_ancora_davanti).toBe(false);
        expect(item.motivo).toEqual(['scelto per il tour in coppia']);
        for (const st of res.tours[0].stops) expect(String(st.description || '').trim().length).toBeGreaterThan(0);
    });
});

// ─── I 5 ✗ della prova reale P3d-g ("Per Te" Roma, 10/10/2026 00:04) ─────────
describe('P3d-g — i ✗ della prova reale vengono tolti', () => {
    const PINCIO = [
        { testo: 'Il Pincio è un colle di Roma, alto 61 m s.l.m., che si trova a nord del Quirinale.', fonte: 'wikipedia' },
        { testo: 'Pincio: colle di Roma.', fonte: 'wikidata' },
    ];
    const VILLA = [{ testo: 'Villa Doria Pamphilj è una residenza storica che comprende il terzo più grande parco pubblico di Roma.', fonte: 'wikipedia' }];

    it('Ingresso di Villa Pamphili: "maestoso… ricco di storia e bellezza" non e\' nei fatti → tolta', () => {
        const r = filterInventedObjects('Un ingresso maestoso che preannuncia un parco ricco di storia e bellezza.', { fatti: VILLA, nomi: ['Ingresso di Villa Pamphili'], fattiSu: 'Villa Doria Pamphilj' });
        expect(r.removed[0]).toMatchObject({ regola: 'giudizio', oggetti: ['maestoso'] });
    });

    it('i 3 locali "a disposizione" (alle 00:04 sembra un "e\' aperto") → tolta', () => {
        for (const [nome, frase] of [
            ['Osteria da Fortunata - Baullari', "Un'osteria a disposizione, scelto per il tuo dopocena."],
            ['Trattoria Della Stampa', 'Una trattoria a disposizione, scelto per il tuo dopocena.'],
            ['OSTERIA DA SAMU', "Un'osteria a disposizione, scelto per il tuo dopocena."],
        ]) {
            expect(filterInventedObjects(frase, { nomi: [nome] }).removed[0]?.oggetti, frase).toEqual(['a disposizione']);
        }
    });

    it('Terrazza del Pincio: "Un colle di Roma" attribuisce alla terrazza i fatti del Pincio → tolta; "Sul Pincio, colle di Roma" passa', () => {
        expect(misattributedFact('Un colle di Roma, scelto per il tour "insider" di Per Te.', { fatti: PINCIO, fattiSu: 'Pincio', nomi: ['Terrazza del Pincio'] })).toBe('colle');
        const r = filterInventedObjects('Un colle di Roma, scelto per il tour "insider" di Per Te.', { fatti: PINCIO, nomi: ['Terrazza del Pincio'], fattiSu: 'Pincio' });
        expect(r.removed[0]).toMatchObject({ regola: 'attribuzione', fattiSu: 'Pincio' });
        expect(filterInventedObjects('Sul Pincio, colle di Roma alto 61 metri: ci arrivi nel pomeriggio.', { fatti: PINCIO, nomi: ['Terrazza del Pincio'], fattiSu: 'Pincio' }).removed).toEqual([]);
        // stesso luogo (fatti dei Musei Capitolini per i Musei Capitolini): niente controllo
        expect(misattributedFact('Un museo civico di Roma.', { fatti: [{ testo: 'I Musei Capitolini sono un museo civico.' }], fattiSu: 'Musei Capitolini', nomi: ['Musei Capitolini'] })).toBeNull();
    });
});

describe('P3d-g — "Per Te": il testo del selettore non resta mai', () => {
    const CITY = 'Ippocampo';
    const CENTER = { latitude: 41.6489, longitude: 15.9012 };
    const POOL = { nature: [
        { place_id: 'pid-ingr', name: 'Ingresso di Villa Saline', latitude: CENTER.latitude, longitude: CENTER.longitude, rating: 4.6, types: ['park'], city: CITY },
        { place_id: 'pid-due', name: 'Parco del Sale', latitude: CENTER.latitude + 0.001, longitude: CENTER.longitude, rating: 4.4, types: ['park'], city: CITY },
        { place_id: 'pid-tre', name: 'Giardino Madre', latitude: CENTER.latitude + 0.002, longitude: CENTER.longitude, rating: 4.5, types: ['park'], city: CITY },
    ] };
    afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('riscrittura ancorata scartata → frase sicura, anche se il testo del selettore passava i controlli', async () => {
        try { window.localStorage.clear(); } catch { /* jsdom */ }
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-09T16:00:00+02:00'));
        vi.stubGlobal('fetch', vi.fn(async (url, init) => {
            if (!String(url).includes('openai-proxy')) throw new Error(`fetch inatteso: ${url}`);
            const body = JSON.parse(String(init?.body ?? '{}'));
            const isRw = String(body.messages?.[0]?.content ?? '').includes('Riscrivi SOLO il campo description');
            const payload = isRw
                ? { stops: JSON.parse(String(body.messages[1].content).split('TAPPE:\n')[1]).map(t => ({ place_id: t.place_id, description: 'Un parco da scoprire.' })) }
                : { tours: [{ themeType: 'nature', title: 'Verde', stops: [
                    { place_id: 'pid-ingr', description: 'Un ingresso che porta al parco.' },
                    { place_id: 'pid-due', description: 'Un parco sul percorso.' },
                    { place_id: 'pid-tre', description: 'Un giardino sul percorso.' },
                ] }] };
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }));
        const res = await aiRecommendationService.generateHomeTours({ city: CITY, cityCenter: CENTER, themedCandidates: POOL, opts: { skipUserQuota: true } });
        for (const st of res.tours[0].stops) {
            expect(st._fraseSicura, st.title).toBe(true); // "da scoprire" tolto, il selettore non resta
            expect(st.description).not.toMatch(/scoprire|sul percorso|porta al parco/);
        }
    });
});
