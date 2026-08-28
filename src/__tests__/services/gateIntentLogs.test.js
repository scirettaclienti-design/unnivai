import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { deriveKindFromQuery, QUERY_KIND_LEXICON } from '@/services/aiRecommendationService';
import { QUALITY_THRESHOLDS } from '@/services/placesDiscoveryService';

// Gate INTENT (28/08) — questo diff aggiunge SOLO LOG.
// Il test centrale non e' sui log: e' la prova che il comportamento NON cambia.

const REPO = process.cwd();
const readSrc = (rel) => readFileSync(join(REPO, 'src', rel), 'utf8');

// ─── Il vincolo che conta ────────────────────────────────────────────────────

describe('Gate INTENT — nessun cambio di comportamento', () => {
    it('il ranking del merge e il taglio a 20 sono invariati', () => {
        const src = readSrc('services/aiRecommendationService.js');
        // Il taglio resta 20 e resta dopo lo stesso sort per qualityScore.
        expect(src).toContain('all.slice(0, 20)');
        expect(src).toContain('const qsA = (a.rating || 0) * Math.log(1 + (a.user_ratings_total || 0));');
        // Il log del taglio NON deve poter modificare `all`: nessuna mutazione
        // dentro il blocco diagnostico (niente splice/sort/push su `all`).
        const bloccoLog = src.slice(src.indexOf('[Gate B] merge:') - 900, src.indexOf('[Gate B] merge:') + 600);
        expect(bloccoLog).not.toContain('all.splice');
        expect(bloccoLog).not.toContain('all.push');
        expect(bloccoLog).not.toContain('all =');
    });

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
