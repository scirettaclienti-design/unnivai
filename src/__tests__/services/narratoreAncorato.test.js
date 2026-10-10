/**
 * Gate NARRATORE ANCORATO — DIFF 1: il prompt non detta più ciò che il modello copiava.
 *
 * Diagnosi (device, Venezia 21/08): tre evidenze, una causa sola. Il narratore
 * NON pescava da pool — nessuna delle frasi osservate esiste nel sorgente — ma
 * IMITAVA GLI ESEMPI del prompt:
 *   · esempio ✓ di insiderTip = consiglio da bar  → tip food sul Guggenheim
 *   · esempio di titolo = "I vicoli segreti di X" → copiato su un tour Gastronomia
 *   · esempi ✓ di bestTime premiano un orario     → "Alle 19" inventato
 *
 * ONESTÀ SUL PERIMETRO: questi test ispezionano il PROMPT COSTRUITO, non
 * l'output del modello. L'output è non deterministico e NESSUN test può provare
 * che il narratore sia migliorato. Provano che il prompt non detta più il testo
 * che veniva copiato. La prova vera è un giro su device.
 *
 * P3d-j — il modello non scrive piu' testo per le tappe (sceglie fra opzioni
 * chiuse, il codice compone): le regole di stile per description, insiderTip,
 * bestTime e transition non hanno piu' un destinatario e sono uscite dai
 * prompt. Resta qui cio' che vale ancora: titolo dalle tappe, nessun orario
 * inventato, open_now fuori, ORA VERA, elenco unico.
 */
import { describe, it, expect } from 'vitest';
import { bannedWordsPromptLines } from '../../lib/narrationLight';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSelectorSystemPrompt, buildChooserSystemPrompt } from '../../services/aiRecommendationService';

// Il letterale va cercato su TUTTO il file, non prompt per prompt: i prompt che
// lo contengono sono il selettore e il titleHint del tema insider
// (buildUnifiedHomeToursPrompt, "Per Te").
// Gate SOLO-GOOGLE (27/09): erano TRE — il terzo era il system prompt del motore
// AI-first, rimosso insieme al motore. I conteggi qui sotto scendono da 3 a 2 per
// quel motivo, non perche' una regola sia stata indebolita.
// Un marker sul sorgente prende anche una terza porta che oggi non esiste.
// Le righe di commento si escludono: le note di gate CITANO cio' che e' stato
// rimosso e falserebbero il conteggio (lezione #26).
const serviceCode = () => readFileSync(
    resolve(__dirname, '..', '..', 'services', 'aiRecommendationService.js'), 'utf8',
).split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l.trim())).join('\n');

// Due candidati di TIPO DIVERSO: con un solo tipo, un prompt che ignora la
// categoria passerebbe lo stesso.
const MUSEO = {
    place_id: 'pid-museo',
    name: 'Collezione Peggy Guggenheim',
    rating: 4.6,
    user_ratings_total: 12000,
    types: ['museum', 'art_gallery', 'tourist_attraction'],
    address: 'Dorsoduro 701, Venezia',
    latitude: 45.4308,
    longitude: 12.3319,
};
const RISTORANTE = {
    place_id: 'pid-osteria',
    name: 'Osteria al Squero',
    rating: 4.5,
    user_ratings_total: 800,
    types: ['restaurant', 'food'],
    address: 'Dorsoduro 943, Venezia',
    latitude: 45.4312,
    longitude: 12.3265,
};

const selectorPrompt = () => buildSelectorSystemPrompt({
    city: 'Venezia',
    timeContext: 'notte — locali, jazz bar, piazze illuminate, passeggiate notturne',
    weather: { condition: 'Sereno', temperature: 18 },
    weatherIcon: '🌙',
    prefs: {},
    aiProfile: '',
    cityCenter: { latitude: 45.4341, longitude: 12.3388, isSmallTown: false, radiusKm: 10 },
    candidates: [MUSEO, RISTORANTE],
    userPrompt: '',
    intent: null,
});

// P3d-j — il prompt delle scelte (terza chiamata): niente testo per le tappe.
const prompt = () => buildChooserSystemPrompt({ city: 'Venezia' });

describe('P3d-j — nessun prompt vivo chiede testo per le tappe', () => {
    it('controllo dello strumento: il prompt delle scelte chiede usaFatto, gancio, interesse', () => {
        const p = prompt();
        expect(p).toContain('"usaFatto"');
        expect(p).toContain('"gancio"');
        expect(p).toContain('"interesse"');
    });

    it('nessun formato di uscita contiene description, insiderTip, bestTime o transition', () => {
        for (const campo of ['"description"', '"insiderTip"', '"bestTime"', '"transition"']) {
            expect(serviceCode(), campo).not.toContain(campo);
        }
    });

    it('il selettore riceve davvero i candidati e i loro types', () => {
        const p = selectorPrompt();
        expect(p).toContain('pid-museo');
        expect(p).toContain('pid-osteria');
        expect(p).toContain('museum');
        expect(p).toContain('restaurant');
    });
});

describe('Gate NARRATORE ANCORATO DIFF 1 — il titolo dettato, su TUTTI i prompt', () => {
    it('controllo dello strumento: il sorgente letto e\' quello giusto', () => {
        // Se questo fallisse, lo zero qui sotto non proverebbe niente.
        const src = serviceCode();
        expect(src).toContain('buildSelectorSystemPrompt');
        expect(src).toContain('buildChooserSystemPrompt');
        expect(src).toContain('buildUnifiedHomeToursPrompt');
        expect(src).toContain('titleHint');
    });

    it('"I vicoli segreti di" non compare in NESSUN prompt del file', () => {
        expect(serviceCode()).not.toContain('I vicoli segreti di');
    });

    it('anche l\'altro prompt deriva il titolo dalle tappe', () => {
        const src = serviceCode();
        // titleHint del tema insider (prompt "Per Te")
        expect(src).toContain('DERIVATO dalle tappe che hai scelto');
        // P3d-j — il prompt delle scelte scrive solo il titolo, dalle tappe del giorno.
        expect(prompt()).toContain('nasce dalle TAPPE del giorno');
    });
});

describe('Gate NARRATORE ANCORATO DIFF 3 — nessun orario inventato, nessuno stato di apertura', () => {
    it('controllo dello strumento: il sorgente letto e\' quello giusto', () => {
        const src = serviceCode();
        expect(src).toContain('buildSelectorSystemPrompt');
        expect(src).toContain('candidatesLite');
    });

    it('gli orari inventati del punto 9 legacy sono spariti', () => {
        const src = serviceCode();
        expect(src).not.toContain('I musei chiudono alle 19');
        expect(src).not.toContain('aprono alle');
        expect(src).not.toContain('chiudono alle');
    });

    it('resta l\'orario REALE del path notifiche: il marker non punisce chi rispetta la regola', () => {
        // :2066 e' un esempio con orario da closingTimeTodayHH vero, :2068 e' la
        // regola locked scritta bene. Un marker secco su "alle 19" li avrebbe
        // cancellati entrambi.
        const src = serviceCode();
        expect(src).toContain('chiude alle 19:00');
        expect(src).toContain('chiude oggi alle HH:MM');
    });

    it('nessun prompt ordina piu\' di dedurre se un posto e\' chiuso', () => {
        expect(serviceCode()).not.toContain('MAI suggerire posti chiusi ora');
    });

    it('tutti i prompt vietano di AFFERMARE stati di apertura', () => {
        const src = serviceCode();
        // P3d-j — una copia: "Per Te" (per i titoli). Il narratore libero non
        // c'e' piu', e il prompt delle scelte non fa scrivere frasi sulle tappe.
        const occorrenze = src.split('NON AFFERMARE MAI se un posto è aperto o chiuso').length - 1;
        expect(occorrenze).toBe(1);
    });

    it('open_now non entra piu\' nel payload del selettore', () => {
        const src = serviceCode();
        expect(src).not.toContain('lite.open_now');
        // il prompt del selettore non deve nemmeno nominarlo
        expect(selectorPrompt()).not.toContain('open_now');
        expect(prompt()).not.toContain('open_now');
    });

    it('il path notifiche NON e\' stato toccato: li\' la gerarchia era gia\' corretta', () => {
        const src = serviceCode();
        expect(src).toContain('} else if (c.open_now === true) {');
        expect(src).toContain("bits.push('chiuso ora');");
    });

});

// ─── Gate ORA VERA — la clausola "momento del giorno" ────────────────────────
// Test di REGOLA, non di regressione: il comportamento verificato qui è già
// corretto oggi e nessun diff di questa sessione lo ha cambiato. Serve a
// impedire che qualcuno reintroduca un default su `intent.vincoli.tempo`.
//
// Il traduttore d'intento (translateIntentToQueries) mette `tempo: null` ogni
// volta che l'utente non nomina ESPLICITAMENTE un momento del giorno — e ora
// che QuickPath non chiede più una fascia oraria, `null` è il caso normale per
// ogni tour generato dal wizard. Con `tempo` nullo la clausola non deve entrare
// nel prompt: sarebbe l'unico punto in cui il selettore riceverebbe un orario
// che non è l'ora vera della richiesta.
describe('Gate ORA VERA — "momento del giorno" solo se l\'utente lo ha chiesto', () => {
    const promptWithIntent = (intent) => buildSelectorSystemPrompt({
        city: 'Siracusa',
        timeContext: 'sera — aperitivi, ristoranti, panorami al tramonto, locali con atmosfera',
        weather: { condition: 'Sereno', temperature: 22 },
        weatherIcon: '☀️',
        prefs: {},
        aiProfile: '',
        cityCenter: { latitude: 37.0755, longitude: 15.2866, isSmallTown: false, radiusKm: 10 },
        candidates: [MUSEO, RISTORANTE],
        userPrompt: 'A Siracusa cerco: spa, hammam, terme, centri benessere.',
        intent,
    });

    const INTENT_SENZA_TEMPO = {
        queries: ['spa', 'hammam'],
        categoria: 'relax',
        oggetto_umano: 'centri benessere',
        vincoli: { tempo: null, escludi: [], note: null },
    };

    it('controllo dello strumento: con tempo valorizzato la clausola C\'È', () => {
        // Senza questa prova, gli `not.toContain` sotto non proverebbero nulla.
        const p = promptWithIntent({
            ...INTENT_SENZA_TEMPO,
            vincoli: { ...INTENT_SENZA_TEMPO.vincoli, tempo: 'mattina' },
        });
        expect(p).toContain('momento del giorno');
        expect(p).toContain('"mattina"');
    });

    it('tempo: null → nessuna clausola "momento del giorno"', () => {
        const p = promptWithIntent(INTENT_SENZA_TEMPO);
        expect(p).toContain('VINCOLI DELL\'UTENTE'); // il blocco intent resta
        expect(p).not.toContain('momento del giorno');
    });

    it('vincoli senza la chiave `tempo` → nessuna clausola "momento del giorno"', () => {
        const p = promptWithIntent({
            ...INTENT_SENZA_TEMPO,
            vincoli: { escludi: [], note: null },
        });
        expect(p).not.toContain('momento del giorno');
    });

    it('intent null (path B) → nessuna clausola "momento del giorno"', () => {
        expect(promptWithIntent(null)).not.toContain('momento del giorno');
    });
});

// Gate PAROLE VIETATE — l'elenco vive in narrationLight.js e il prompt lo
// interpola. P3d-b: e' l'elenco unico di tutto il testo generato.
describe('Gate PAROLE VIETATE — il prompt delle scelte mostra l\'elenco unico (per il titolo)', () => {
    it('le righe dell\'elenco sono quelle di bannedWordsPromptLines(), carattere per carattere', () => {
        expect(prompt()).toContain('Parole vietate nel titolo: ' + bannedWordsPromptLines());
    });
});
