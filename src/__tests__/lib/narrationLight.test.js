// Gate NARRATORE-DOPO — luce e ora nel racconto, controllate dal CODICE.
//
// Alba e tramonto si calcolano senza rete (src/lib/sunTimes.js); una frase che
// nomina una luce o un'ora incoerente con l'orario di arrivo viene TOLTA, mai
// riscritta (src/lib/narrationLight.js).
//
// Orari di riferimento per Roma (Osservatorio / timeanddate, arrotondati al
// minuto): 21/06/2026 alba 05:35, tramonto 20:48 (CEST); 21/12/2026 alba 07:34,
// tramonto 16:42 (CET). Tolleranza 3 minuti: la formula usata ha un errore di
// 1-2 minuti, e la regola che la usa lavora a 45.

import { describe, it, expect } from 'vitest';
import { sunTimes } from '../../lib/sunTimes';
import { filterTimeIncoherent, SUNSET_TOLERANCE_MINUTES } from '../../lib/narrationLight';
import { romeDate, romeParts } from '../../lib/tourWindow';

const ROMA = { latitude: 41.9028, longitude: 12.4964 };
const minutesOfDay = (d) => { const p = romeParts(d); return p.h * 60 + p.mi; };
const hm = (h, m) => h * 60 + m;

describe('sunTimes — alba e tramonto calcolati nel codice', () => {
    it('Roma, solstizio d\'estate: alba ~05:35, tramonto ~20:48', () => {
        const { sunrise, sunset } = sunTimes({ y: 2026, m: 6, d: 21 }, ROMA.latitude, ROMA.longitude);
        expect(Math.abs(minutesOfDay(sunrise) - hm(5, 35))).toBeLessThanOrEqual(3);
        expect(Math.abs(minutesOfDay(sunset) - hm(20, 48))).toBeLessThanOrEqual(3);
    });

    it('Roma, solstizio d\'inverno: alba ~07:34, tramonto ~16:42', () => {
        const { sunrise, sunset } = sunTimes({ y: 2026, m: 12, d: 21 }, ROMA.latitude, ROMA.longitude);
        expect(Math.abs(minutesOfDay(sunrise) - hm(7, 34))).toBeLessThanOrEqual(3);
        expect(Math.abs(minutesOfDay(sunset) - hm(16, 42))).toBeLessThanOrEqual(3);
    });
});

describe('filterTimeIncoherent — una frase incoerente con l\'arrivo viene tolta', () => {
    const day = { y: 2026, m: 10, d: 6 };
    const { sunrise, sunset } = sunTimes(day, ROMA.latitude, ROMA.longitude);

    it('"al tramonto" su una tappa delle 10:00 → frase tolta, il resto resta intatto', () => {
        const arrival = romeDate(day, { h: 10, m: 0 });
        const out = filterTimeIncoherent(
            'Le scale di pietra sono consumate al centro. Al tramonto la facciata diventa arancione.',
            { arrival, sunrise, sunset },
        );
        expect(out.text).toBe('Le scale di pietra sono consumate al centro.');
        expect(out.removed).toHaveLength(1);
        expect(out.removed[0].frase).toContain('tramonto');
    });

    it('"al tramonto" su una tappa che arriva 20 minuti prima del tramonto → frase tenuta', () => {
        const arrival = new Date(sunset.getTime() - 20 * 60000);
        const text = 'Le scale di pietra sono consumate al centro. Al tramonto la facciata diventa arancione.';
        const out = filterTimeIncoherent(text, { arrival, sunrise, sunset });
        expect(out.text).toBe(text);
        expect(out.removed).toHaveLength(0);
    });

    it(`"tramonto" ammesso solo entro ${SUNSET_TOLERANCE_MINUTES} minuti dal tramonto vero`, () => {
        expect(SUNSET_TOLERANCE_MINUTES).toBe(45);
        const prima = filterTimeIncoherent('Il tramonto si vede dal parapetto.', {
            arrival: new Date(sunset.getTime() - 50 * 60000), sunrise, sunset,
        });
        expect(prima.text).toBeNull();
        const dopo = filterTimeIncoherent('Il tramonto si vede dal parapetto.', {
            arrival: new Date(sunset.getTime() + 40 * 60000), sunrise, sunset,
        });
        expect(dopo.text).toBe('Il tramonto si vede dal parapetto.');
    });

    it('notte e stelle su una tappa del pomeriggio → tolte; la stessa frase alle 23:00 resta', () => {
        const frase = 'Sopra il cortile si vedono le stelle.';
        expect(filterTimeIncoherent(frase, { arrival: romeDate(day, { h: 15, m: 0 }), sunrise, sunset }).text).toBeNull();
        expect(filterTimeIncoherent(frase, { arrival: romeDate(day, { h: 23, m: 0 }), sunrise, sunset }).text).toBe(frase);
    });

    it('luce del mattino alle 19:00 → tolta; sole di mezzogiorno alle 20:30 → tolto', () => {
        const sera = romeDate(day, { h: 19, m: 0 });
        expect(filterTimeIncoherent('La luce del mattino entra di taglio.', { arrival: sera, sunrise, sunset }).text).toBeNull();
        expect(filterTimeIncoherent('Il sole di mezzogiorno picchia sul selciato.', {
            arrival: romeDate(day, { h: 20, m: 30 }), sunrise, sunset,
        }).text).toBeNull();
        expect(filterTimeIncoherent('La luce del mattino entra di taglio.', {
            arrival: romeDate(day, { h: 9, m: 45 }), sunrise, sunset,
        }).text).toBe('La luce del mattino entra di taglio.');
    });

    it('il codice toglie, non riscrive: nessuna parola nuova compare nel testo', () => {
        const text = 'Il bancone è lungo. All\'alba arrivano i fornai. Il caffè si beve in piedi.';
        const out = filterTimeIncoherent(text, { arrival: romeDate(day, { h: 13, m: 0 }), sunrise, sunset });
        expect(out.text).toBe('Il bancone è lungo. Il caffè si beve in piedi.');
        for (const w of out.text.split(/\s+/)) expect(text).toContain(w);
    });

    it('testo vuoto o nullo → null, nessuna frase tolta', () => {
        expect(filterTimeIncoherent(null, { arrival: romeDate(day, { h: 10, m: 0 }), sunrise, sunset }))
            .toEqual({ text: null, removed: [] });
    });

    it('senza orario di arrivo non si giudica: il testo resta com\'e\'', () => {
        const text = 'Al tramonto la facciata diventa arancione.';
        expect(filterTimeIncoherent(text, { arrival: null, sunrise, sunset }).text).toBe(text);
    });
});

// ─── Gate PAROLE VIETATE — dal log alla rimozione ──────────────────────────
// Le parole vietate erano solo nel testo dei prompt: nessun controllo in codice.
// "tradizionali" e' passata a schermo nel tour di Roma del 7/10. Ora la frase
// che le contiene viene TOLTA, mai riscritta, sullo stesso schema della luce.
import { filterBannedWords, BANNED_VOICE_WORDS, BANNED_VOICE_PHRASES_HOME, bannedWordsPromptLines } from '../../lib/narrationLight';

describe('filterBannedWords — una frase con una parola vietata viene tolta', () => {
    it('"tradizionali" → la frase sparisce, resta solo l\'altra', () => {
        const out = filterBannedWords('Il profumo dei piatti tradizionali riempie la sala. Prova la carbonara.');
        expect(out.text).toBe('Prova la carbonara.');
        expect(out.removed).toHaveLength(1);
        expect(out.removed[0].parole).toEqual(['tradizionale']);
    });

    it('maiuscole e varianti di genere/numero e l\'avverbio', () => {
        for (const frase of ['Tradizionale e basta.', 'Le ricette TRADIZIONALI.', 'Si mangia tradizionalmente.',
            'Una piazza storica.', 'I vicoli storici.', 'Botteghe storiche.', 'Storicamente qui.',
            'Un posto unico.', 'Le uniche panche.', 'Tipiche osterie.', 'Viste suggestive.',
            'Una sera magica.', 'Luci affascinanti.', 'Mostre imperdibili.', 'Dettagli caratteristici.']) {
            expect(filterBannedWords(frase).text, frase).toBeNull();
        }
    });

    it('nessun falso positivo su parole che contengono la radice', () => {
        for (const frase of ['La storia del quartiere.', 'Il bancone è di marmo.', 'Una comunità che si conosce.',
            'Una tipografia sulla destra.', 'Il magazzino è sul retro.']) {
            expect(filterBannedWords(frase).text, frase).toBe(frase);
        }
    });

    it('descrizione fatta solo di frasi vietate → null (nessun testo sostitutivo)', () => {
        expect(filterBannedWords('Un luogo magico. Atmosfera unica e suggestiva.')).toEqual({
            text: null,
            removed: [
                { frase: 'Un luogo magico.', parole: ['magico'] },
                { frase: 'Atmosfera unica e suggestiva.', parole: ['unico', 'suggestivo'] },
            ],
        });
    });

    it('le formule della Home ("ottima scelta", "perfetta scelta") sono vietate anche qui', () => {
        expect(filterBannedWords('Ottima scelta per cena. Il pane arriva caldo.').text).toBe('Il pane arriva caldo.');
    });

    it('testo vuoto o nullo → null, nessuna frase tolta', () => {
        expect(filterBannedWords(null)).toEqual({ text: null, removed: [] });
        expect(filterBannedWords('  ')).toEqual({ text: null, removed: [] });
    });
});

describe('Gate PAROLE VIETATE — un elenco solo, prompt invariati', () => {
    it('l\'elenco del codice e\' quello che i prompt mostrano al modello, carattere per carattere', () => {
        expect(BANNED_VOICE_WORDS).toEqual(['storico', 'tradizionale', 'unico', 'caratteristico', 'suggestivo', 'tipico', 'affascinante', 'magico', 'imperdibile']);
        expect(BANNED_VOICE_PHRASES_HOME).toEqual(['ottima scelta', 'perfetta scelta']);
        expect(bannedWordsPromptLines()).toBe(
            '"storico", "tradizionale", "unico", "caratteristico", "suggestivo", "tipico",\n'
            + '"affascinante", "magico", "imperdibile" — usate sole senza contesto.',
        );
        expect(bannedWordsPromptLines(BANNED_VOICE_PHRASES_HOME)).toBe(
            '"storico", "tradizionale", "unico", "caratteristico", "suggestivo", "tipico",\n'
            + '"affascinante", "magico", "imperdibile", "ottima scelta", "perfetta scelta" — usate sole senza contesto.',
        );
    });
});
