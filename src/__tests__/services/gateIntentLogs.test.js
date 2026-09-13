import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
    aiRecommendationService,
    deriveKindFromQuery,
    QUERY_KIND_LEXICON,
} from '@/services/aiRecommendationService';
import { QUALITY_THRESHOLDS } from '@/services/placesDiscoveryService';

// Gate INTENT (28/08) — questo diff aggiunge SOLO LOG.
// Il test centrale non e' sui log: e' la prova che il comportamento NON cambia.

const REPO = process.cwd();
const readSrc = (rel) => readFileSync(join(REPO, 'src', rel), 'utf8');

// ─── Il vincolo che conta ────────────────────────────────────────────────────

// ─── Il taglio a 20, provato sul COMPORTAMENTO ───────────────────────────────
//
// Questo blocco asseriva stringhe letterali del sorgente — `all.slice(0, 20)` e
// la riga esatta del qualityScore — cioe' verificava COM'E' SCRITTO il codice,
// non cosa fa. Il 13/09 il taglio si e' spostato da fetchRealPOICandidates al
// chiamante (dopo i filtri di raggio e categoria) e quelle stringhe sono
// sparite per costruzione: il test sarebbe diventato rosso senza che nessuna
// delle due garanzie fosse venuta meno. Riscritto su cio' che deve restare
// vero comunque il codice sia disposto:
//   1. al selettore non arrivano MAI piu' di 20 candidati;
//   2. i 20 sono i migliori per qualityScore = rating * ln(1+recensioni) — non
//      per rating nudo;
//   3. quando la categoria vincola, i 20 si scelgono DOPO averla applicata.

const CABRAS = { latitude: 39.9297, longitude: 8.5297, isSmallTown: true, radiusKm: 5 };

const poi = ({ id, name, km, types, rating, reviews }) => ({
    place_id: id,
    name,
    geometry: { location: { lat: CABRAS.latitude + (km / 111), lng: CABRAS.longitude } },
    rating,
    user_ratings_total: reviews,
    business_status: 'OPERATIONAL',
    types,
});

// 1ª chiamata al proxy = traduttore d'intento, 2ª = selettore. `selectorBody`
// e' il body della seconda: e' li' che si legge cosa gli e' stato dato.
const harness = ({ intent, perQuery }) => {
    const stato = { aiCalls: 0, selectorBody: null };
    const fn = vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes('openai-proxy')) {
            const payload = stato.aiCalls === 0
                ? intent
                : { days: [{ day: 1, title: 'T', stops: [] }] };
            if (stato.aiCalls === 1) stato.selectorBody = String(init?.body ?? '');
            stato.aiCalls += 1;
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
        }
        if (u.includes('textsearch')) {
            const decoded = decodeURIComponent(u);
            const hit = Object.keys(perQuery).find(q => decoded.includes(`${q} Cabras`) || decoded.includes(`${q}+Cabras`));
            return { ok: true, json: async () => ({ status: 'OK', results: hit ? perQuery[hit] : [] }) };
        }
        if (u.includes('details')) return { ok: true, json: async () => ({ status: 'OK', result: {} }) };
        throw new Error(`fetch inatteso: ${u}`);
    });
    return { fn, stato };
};

const GENERICI = ['establishment', 'point_of_interest'];
const RISTORANTE = ['establishment', 'food', 'point_of_interest', 'restaurant'];
const SPIAGGIA = ['establishment', 'natural_feature', 'point_of_interest'];

describe('Gate INTENT — il taglio a 20 e il suo ranking (comportamento)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        try { window.localStorage.clear(); } catch { /* jsdom */ }
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('21 candidati ammessi → al selettore ne arrivano 20, e il 21° e\' quello col qualityScore piu\' basso', async () => {
        // 20 "solidi": 4.1 stelle su 500 recensioni → qs = 4.1*ln(501) ≈ 25.5.
        // 1 "civetta": 5.0 stelle su 5 recensioni  → qs = 5.0*ln(6)   ≈  9.0.
        // La civetta ha il rating PIU' ALTO del pool: se il ranking fosse per
        // rating nudo sarebbe prima, e a cadere sarebbe un solido. Cade lei
        // solo se il volume di recensioni pesa — cioe' se la formula e' quella.
        const solidi = (n, from) => Array.from({ length: n }, (_, i) => poi({
            id: `pid-solido-${from + i}`,
            name: `Posto Solido ${from + i}`,
            km: 0.2 + (from + i) * 0.15,   // tutti entro R=5 km
            types: GENERICI, rating: 4.1, reviews: 500,
        }));
        const civetta = poi({
            id: 'pid-civetta', name: 'Chiosco Civetta',
            km: 1.1, types: GENERICI, rating: 5.0, reviews: 5,
        });

        // maxResults di discoverRealPOIs e' 12 per query: 12 + 9 = 21.
        const { fn, stato } = harness({
            // Query di UNA parola: il proxy serializza con URLSearchParams, che
            // codifica lo spazio come "+", e il routing del mock confronta
            // `<query> Cabras` / `<query>+Cabras`.
            intent: {
                queries: ['panorami', 'scorci'],
                categoria: 'misto',              // nessun filtro stretto di categoria
                oggetto_umano: 'posti belli',
                vincoli: { tempo: null, escludi: [], note: null },
            },
            perQuery: {
                panorami: solidi(12, 1),
                scorci: [...solidi(8, 13), civetta],
            },
        });
        vi.stubGlobal('fetch', fn);

        await aiRecommendationService.generateItinerary(
            'Cabras', { interests: ['Natura'] }, 'portami in posti belli', {}, '', CABRAS,
        );

        expect(stato.aiCalls).toBe(2);
        // Il messaggio utente del selettore dichiara la dimensione del pool.
        expect(stato.selectorBody).toContain('20 luoghi disponibili');
        // L'escluso e' la civetta, nonostante sia la meglio votata.
        expect(stato.selectorBody).not.toContain('Chiosco Civetta');
        expect(stato.selectorBody).toContain('Posto Solido 1');
    });

    it('quando la categoria vincola, i 20 si scelgono DOPO il filtro di categoria', async () => {
        // 24 ristoranti (2000 recensioni, qs ≈ 35) + 3 spiagge (200, qs ≈ 23).
        // In un ranking puro i ristoranti prendono tutti e 20 i posti: se il
        // taglio precedesse il filtro di categoria, al selettore arriverebbero
        // zero spiagge e la richiesta "spiagge" resterebbe senza risposta.
        const risto = (pfx, n, kmStart) => Array.from({ length: n }, (_, i) => poi({
            id: `pid-${pfx}-${i}`, name: `Ristorante ${pfx} ${i}`,
            km: kmStart + i * 0.2, types: RISTORANTE, rating: 4.6, reviews: 2000,
        }));
        const spiagge = ['Maimoni', 'Is Arutas', 'Mari Ermi'].map((n, i) => poi({
            id: `pid-sp-${i}`, name: `Spiaggia ${n}`,
            km: 9 + i * 1.2, types: SPIAGGIA, rating: 4.4, reviews: 200,
        }));

        const { fn, stato } = harness({
            intent: {
                queries: ['spiagge', 'lidi', 'cale'],
                categoria: 'natura',
                oggetto_umano: 'spiagge',
                vincoli: { tempo: null, escludi: [], note: null },
            },
            perQuery: { spiagge, lidi: risto('lido', 12, 0.2), cale: risto('cala', 12, 2.6) },
        });
        vi.stubGlobal('fetch', fn);

        await aiRecommendationService.generateItinerary(
            'Cabras', { interests: ['Natura'] }, 'le spiagge piu belle', {}, '', CABRAS,
        );

        expect(stato.aiCalls).toBe(2);
        expect(stato.selectorBody).toContain('3 luoghi disponibili');
        for (const n of ['Spiaggia Maimoni', 'Spiaggia Is Arutas', 'Spiaggia Mari Ermi']) {
            expect(stato.selectorBody, `${n} non e' arrivata al selettore`).toContain(n);
        }
        expect(stato.selectorBody).not.toContain('Ristorante');
    });
});

describe('Gate INTENT — nessun cambio di comportamento', () => {
    it('customKind resta derivato SOLO da intent.categoria, non dal lessico', () => {
        const src = readSrc('services/aiRecommendationService.js');
        expect(src).toContain("const customKind = CATEGORIA_TO_KIND[String(intent.categoria || '').toLowerCase()] || 'CULTURA';");
        // `deriveKindFromQuery` non deve comparire nell'assegnazione di customKind
        // ne' essere passata a discoverRealPOIs: in questo diff e' diagnostica.
        const dopo = src.slice(src.indexOf('const customKind ='));
        const chiamata = dopo.slice(0, dopo.indexOf('lists = await Promise.all') + 400);
        expect(chiamata).toContain('customQuery: q, customKind');
        expect(chiamata).not.toMatch(/customKind:\s*deriveKindFromQuery/);
    });

    it('applyQualityThreshold: soglie e condizioni di scale-down invariate', () => {
        const src = readSrc('services/placesDiscoveryService.js');
        expect(src).toContain('if (level1.length >= 3) return { pois: level1, scaleLevel: 1 };');
        expect(src).toContain("(c.rating || 0) >= 3.8 && (c.user_ratings_total || 0) >= 1");
        // Le quattro soglie non si toccano.
        expect(QUALITY_THRESHOLDS.FOOD.large).toEqual({ minRating: 4.2, minTotal: 50 });
        expect(QUALITY_THRESHOLDS.CULTURA.large).toEqual({ minRating: 4.0, minTotal: 50 });
        expect(QUALITY_THRESHOLDS.NATURA.large).toEqual({ minRating: 4.0, minTotal: 20 });
        expect(QUALITY_THRESHOLDS.RELAX.large).toEqual({ minRating: 4.0, minTotal: 20 });
    });

    it('il log degli scarti non filtra: e\' una funzione a parte che non ritorna il pool', () => {
        const src = readSrc('services/placesDiscoveryService.js');
        // `logScartiSoglia` e' void e viene chiamata SENZA assegnazione.
        expect(src).toContain('logScartiSoglia(candidates, level1, kind, t, isSmall);');
        expect(src).not.toMatch(/=\s*logScartiSoglia\(/);
    });
});

// ─── La mappa lessicale (diagnostica in questo diff, decisione forse domani) ──

describe('deriveKindFromQuery — la mappa lessicale', () => {
    it('classifica il caso device che ha aperto il gate', () => {
        expect(deriveKindFromQuery('chiesa antica')).toBe('CULTURA');
        expect(deriveKindFromQuery("museo d'arte")).toBe('CULTURA');
        expect(deriveKindFromQuery('caffe storico')).toBe('FOOD');
    });

    it('due query su tre divergono da FOOD: e\' il numero che il log deve stampare', () => {
        const queries = ['chiesa antica', "museo d'arte", 'caffe storico'];
        const globale = 'FOOD';
        const divergenti = queries.filter(q => deriveKindFromQuery(q) !== globale).length;
        expect(divergenti).toBe(2);
    });

    it('copre le quattro famiglie', () => {
        expect(deriveKindFromQuery('trattoria tipica')).toBe('FOOD');
        expect(deriveKindFromQuery('villa comunale parco')).toBe('NATURA');
        expect(deriveKindFromQuery('belvedere panorama')).toBe('RELAX');
        expect(deriveKindFromQuery('museo archeologico')).toBe('CULTURA');
    });

    it('non mappata → CULTURA, la soglia PIU\' PERMISSIVA', () => {
        expect(deriveKindFromQuery('posti strani')).toBe('CULTURA');
        expect(deriveKindFromQuery('')).toBe('CULTURA');
        expect(deriveKindFromQuery(null)).toBe('CULTURA');
        expect(deriveKindFromQuery(undefined)).toBe('CULTURA');
        // Il fallback deve essere il permissivo: sbagliare verso l'inclusione.
        expect(QUALITY_THRESHOLDS.CULTURA.large.minRating)
            .toBeLessThan(QUALITY_THRESHOLDS.FOOD.large.minRating);
    });

    it('e\' case-insensitive e tollera accenti nelle due forme di "caffe"', () => {
        expect(deriveKindFromQuery('CHIESA ANTICA')).toBe('CULTURA');
        expect(deriveKindFromQuery('Caffè storico')).toBe('FOOD');
        expect(deriveKindFromQuery('caffe storico')).toBe('FOOD');
    });

    it('nessuna parola della mappa e\' vuota (matcherebbe qualunque query)', () => {
        for (const { kind, parole } of QUERY_KIND_LEXICON) {
            for (const w of parole) {
                expect(w.trim().length, `${kind}: parola vuota`).toBeGreaterThan(1);
            }
        }
    });

    it('e\' deterministica: nessuna chiamata al modello, stesso input stesso output', () => {
        for (const q of ['chiesa antica', 'trattoria tipica', 'qualsiasi cosa']) {
            expect(deriveKindFromQuery(q)).toBe(deriveKindFromQuery(q));
        }
    });
});

// ─── I marker letterali dei log ──────────────────────────────────────────────
// Grepati come stringhe fisse: contengono parentesi quadre, che in regex
// sarebbero una classe di caratteri (lezione #11).

describe('Gate INTENT — i marker dei log esistono nel sorgente', () => {
    const ai = () => readSrc('services/aiRecommendationService.js');
    const places = () => readSrc('services/placesDiscoveryService.js');

    it('[Gate B] kind globale', () => expect(ai()).toContain('[Gate B] kind globale='));
    it('[Gate B] merge:', () => expect(ai()).toContain('[Gate B] merge:'));
    it('[Narratore] check avviato', () => expect(ai()).toContain('[Narratore] check avviato'));
    it('[Qualita] scartati', () => expect(places()).toContain('[Qualita] scartati'));

    it('il log del narratore sta DENTRO il try, prima del ciclo', () => {
        const src = ai();
        const iLog = src.indexOf('[Narratore] check avviato');
        const iCiclo = src.indexOf('for (const v of findTourViolations(stops))');
        const iTry = src.lastIndexOf('try {', iLog);
        expect(iTry).toBeGreaterThan(0);
        expect(iLog).toBeGreaterThan(iTry);   // dentro il try: non puo' rompere la generazione
        expect(iLog).toBeLessThan(iCiclo);    // di ingresso: stampa anche con zero violazioni
    });
});

// ─── La correzione del difetto introdotto dal DIFF 1a ────────────────────────

describe('Gate INTENT — correzione del path legacy (difetto del DIFF 1a)', () => {
    it('il ramo AI-first non finge piu\' di leggere i types dal modello', () => {
        const src = readSrc('services/aiRecommendationService.js');
        // `s` e' lo stop del MODELLO: non ha mai avuto types, lo schema glielo vieta.
        expect(src).not.toContain('types: Array.isArray(s.types) ? s.types : []');
        // Sul path Google-first invece i types VERI arrivano dal candidato.
        expect(src).toContain('types: Array.isArray(c.types) ? c.types : []');
    });
});

// ─── Costo ───────────────────────────────────────────────────────────────────

describe('Gate INTENT — costo della diagnostica', () => {
    let warnSpy;
    beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
    afterEach(() => { warnSpy.mockRestore(); });

    it('la mappa gira sulle QUERY (max 3), non sui candidati', () => {
        const src = readSrc('services/aiRecommendationService.js');
        expect(src).toContain('const perQuery = queriesToRun.map(q => ({ q, kind: deriveKindFromQuery(q) }));');
        expect(src).toContain('const queriesToRun = intent.queries.slice(0, 3);');
    });

    it('3 query costano meno di un millisecondo', () => {
        const queries = ['chiesa antica', "museo d'arte", 'caffe storico'];
        const t0 = performance.now();
        for (let i = 0; i < 1000; i++) queries.map(deriveKindFromQuery);
        const perGenerazione = (performance.now() - t0) / 1000;
        expect(perGenerazione).toBeLessThan(1);
    });

    it('il log degli scarti non costruisce stringhe quando non ci sono scarti', () => {
        const src = readSrc('services/placesDiscoveryService.js');
        const i = src.indexOf('const logScartiSoglia');
        const corpo = src.slice(i, i + 700);
        // L'uscita anticipata precede qualunque costruzione di stringa.
        expect(corpo.indexOf('if (scartati <= 0) return;')).toBeLessThan(corpo.indexOf('.map(c =>'));
    });
});

// ─── Gate INTENT (28/08, verifica sul campo) — il lessico matcha PAROLE ──────
//
// Il giro device che ha confermato F65 ha mostrato un residuo nel log per-query:
// "giardino pubblico" -> FOOD, 1/3 divergenti. Oggi non rompe nulla — il lessico
// alimenta solo il log — ma e' lo STESSO lessico che diventerebbe decisione se
// promuovessimo la soglia per query. Un difetto che non morde ancora e' comunque
// un difetto: qui morderebbe il giorno esatto in cui gli si da' potere.
//
// L'audit ha trovato 14 falsi positivi da match a sottostringa e 8 forme
// plurali che cadevano sul default.

describe('deriveKindFromQuery — nessun match a sottostringa', () => {
    // Quattro parole corte — bar, pub, spa, cala — dirottavano intere famiglie.
    const FALSI_POSITIVI = [
        ['chiesa barocca',      'CULTURA', 'bar'],
        ['palazzo barocco',     'CULTURA', 'bar'],
        ['basilica barocca',    'CULTURA', 'bar'],
        ['arte barocca',        'CULTURA', 'bar'],
        ['barbiere',            'CULTURA', 'bar'],
        ['giardino pubblico',   'NATURA',  'pub'],
        ['giardini pubblici',   'NATURA',  'pub'],
        ['biblioteca pubblica', 'CULTURA', 'pub'],
        ['trasporto pubblico',  'CULTURA', 'pub'],
        ['spazio espositivo',   'CULTURA', 'spa'],
        ['scala monumentale',   'CULTURA', 'cala'],
        ['calata del porto',    'CULTURA', 'cala'],
    ];

    it.each(FALSI_POSITIVI)('"%s" -> %s (non aggancia "%s")', (query, atteso) => {
        expect(deriveKindFromQuery(query)).toBe(atteso);
    });

    it('il caso osservato sul campo: "giardino pubblico" e\' NATURA, non FOOD', () => {
        // Era il residuo 1/3 divergenti nel log del giro di verifica F65.
        expect(deriveKindFromQuery('giardino pubblico')).toBe('NATURA');
    });

    it('le parole vere continuano a matchare: il fix non ha spento il lessico', () => {
        expect(deriveKindFromQuery('bar storico')).toBe('FOOD');
        expect(deriveKindFromQuery('pub irlandese')).toBe('FOOD');
        expect(deriveKindFromQuery('spa e benessere')).toBe('RELAX');
        expect(deriveKindFromQuery('cala nascosta')).toBe('NATURA');
    });

    it('funziona con gli accenti, dove \\b di JS non basterebbe', () => {
        expect(deriveKindFromQuery('caffè storico')).toBe('FOOD');
        expect(deriveKindFromQuery('un caffè')).toBe('FOOD');
    });
});

describe('deriveKindFromQuery — i plurali non cadono piu\' sul default', () => {
    const PLURALI = [
        ['parchi',      'NATURA'],
        ['ville',       'CULTURA'],   // "ville" da solo e' ambiguo: ville comunali -> NATURA
        ['giardini',    'NATURA'],
        ['ristoranti',  'FOOD'],
        ['osterie',     'FOOD'],
        ['trattorie',   'FOOD'],
        ['chiese',      'CULTURA'],
        ['musei',       'CULTURA'],
        ['castelli',    'CULTURA'],
        ['spiagge',     'NATURA'],
    ];
    it.each(PLURALI)('"%s" -> %s', (query, atteso) => {
        expect(deriveKindFromQuery(query)).toBe(atteso);
    });

    it('il caso che ha aperto il gate: "parchi e ville" -> NATURA', () => {
        // Cadeva sul default CULTURA perche' il lessico aveva `parco` e non
        // `parchi`. Con la soglia per query avrebbe dato la soglia sbagliata
        // proprio alla richiesta che il gate esiste per proteggere.
        expect(deriveKindFromQuery('parchi e ville')).toBe('NATURA');
    });

    it('nessuna radice tronca sopravvive nel lessico', () => {
        // Con il confine di parola una radice come `spiagg` non matcherebbe piu'
        // nulla: sarebbe una voce morta che finge di coprire.
        for (const { parole } of QUERY_KIND_LEXICON) {
            for (const w of parole) {
                expect(deriveKindFromQuery(w), `"${w}" non matcha se stessa`).not.toBe(undefined);
                expect(w).not.toMatch(/^(spiagg|archeolog)$/);
            }
        }
    });

    it('ogni voce del lessico matcha se stessa', () => {
        for (const { kind, parole } of QUERY_KIND_LEXICON) {
            for (const w of parole) {
                expect(deriveKindFromQuery(w), `"${w}" (${kind})`).toBe(kind);
            }
        }
    });
});
