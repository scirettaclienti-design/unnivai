// P3d-i — Voce del "perché qui".
//
// Le frasi goffe delle prove reali P3d-g (10/10/2026), parola per parola: vere,
// ma nella voce di un modulo. Citavano il motivo ("per la tua richiesta", "giro
// insider", "scelto per il tour", "trovato cercando"), erano elenchi senza
// verbo ("Per il pranzo: osteria, fascia €€…") o attaccavano l'orario in coda
// ("Arriverai alle 14:30."). Ora il codice le toglie (poi riscrittura, poi
// frase sicura); le frasi sicure hanno 5 varianti per famiglia, fisse per tappa,
// sempre con un verbo, al massimo 2 frasi, l'orario come gancio.
//
// Rosso sul codice di prima (960b7f9): nessun controllo di voce, frase sicura
// unica e senza verbo ("Belvedere, tappa dell'aperitivo: arrivo alle 18:00…").

import { describe, it, expect } from 'vitest';
import {
    filterVoice, voiceIssues, safeDescription, SAFE_VARIANTS, filterInventedObjects, filterBannedWords, DESCRIPTION_RULE_PROMPT,
} from '../../lib/narrationLight';

const GOFFE_P3DG = [
    // [tappa, frase, richiesta/oggetto della prova]
    ['Belvedere Cederna', 'Un belvedere a 18:00, per la tua richiesta: un giro insider, trovato cercando "belvedere panorama".', 'un giro insider'],
    ['Piazza Umbrella', 'Piazza Umbrella, un luogo per la tua richiesta, un giro insider.', 'un giro insider'],
    ['Belvedere Di Carminello', 'Un belvedere: è qui per la tua richiesta, la vista panoramica che stai cercando.', ''],
    ['Terrazza Belvedere Aventino', 'Arriverai qui per la tua richiesta alle 09:30.', ''],
    ['Piazza Colonna', 'Arriverai alle 14:30.', ''],
    ['Hortus Urbis', 'Un giardino da esplorare, scelto per il tour "insider" di Per Te.', ''],
    ['Basilica dei Santi XII Apostoli', 'Una basilica da visitare, scelta per il tour della cultura.', ''],
    ['Villa Sciarra', 'Una villa da visitare, scelta per il tour del verde.', ''],
    ['È Passata la Moretta | Osteria Romana di un Tempo', 'Per il pranzo: osteria, fascia €€, a 22 minuti dalla tappa prima.', ''],
    ['Trattoria Sorano', 'Per la cena: trattoria, fascia €€, a 112 minuti dalla tappa prima.', ''],
    ['Osteria da Fortunata - Baullari', "Un'osteria a disposizione, scelto per il tuo dopocena.", ''],
];

describe('P3d-i — le frasi goffe di P3d-g vengono tolte (voce)', () => {
    for (const [tappa, frase, oggetto] of GOFFE_P3DG) {
        it(`${tappa}: "${frase}"`, () => {
            const v = filterVoice(frase, { oggetto });
            const t = filterInventedObjects(frase, { nomi: [tappa] });
            // tolta dalla voce, o (gia') dalla verita': mai a schermo cosi'
            expect(v.text === null || t.text === null, frase).toBe(true);
        });
    }

    it('una descrizione con un fatto e l\'orario in coda: resta il fatto, la coda va', () => {
        const r = filterVoice("L'Aventino è uno dei sette colli su cui venne fondata Roma, il più a sud. Arriverai qui per la tua richiesta alle 09:30.");
        expect(r.text).toBe("L'Aventino è uno dei sette colli su cui venne fondata Roma, il più a sud.");
        expect(r.removed[0].oggetti).toEqual(expect.arrayContaining(['per la tua richiesta']));
    });

    it('il testo della richiesta non si ripete', () => {
        expect(voiceIssues('Qui per vivere Roma da romano, ci arrivi alle 10.', { richiesta: 'Domani voglio vivere Roma da romano' })).toEqual([]);
        expect(voiceIssues('Domani voglio vivere Roma da romano: ecco la piazza.', { richiesta: 'Domani voglio vivere Roma da romano' })).toContain('ripete la richiesta');
        expect(voiceIssues('È qui per la Roma dei romani.', { oggetto: 'la Roma dei romani' })).toContain('ripete la richiesta');
    });

    it('le frasi giuste passano: i 3 GIUSTO del prompt, l\'orario come gancio, il legame detto con parole proprie', () => {
        for (const f of [
            "L'Aventino è uno dei sette colli su cui venne fondata Roma, il più a sud.",
            "Piazza Colonna deve il suo nome alla colonna di Marco Aurelio, che qui sorge sin dall'antichità.",
            "La fontana dell'Amenano è una fontana monumentale del 1867 sul lato sud di piazza del Duomo.",
            "Sul Gianicolo ci arrivi alle 18, mezz'ora prima del tramonto.",
            'È la vista che cercavi: Belvedere Cederna, a 8 minuti a piedi dalla tappa prima.',
            "Per chi ama le chiese barocche, la basilica è a 5 minuti dalla tappa prima.",
        ]) {
            expect(voiceIssues(f), f).toEqual([]);
        }
    });
});

describe('P3d-i — le frasi sicure hanno una voce', () => {
    const VERBO = /(?:^|[\s'])(?:è|arrivi|trovi|ti fermi|passi|cammini|attraversi|pranzi|ceni|prendi|fai)(?=[\s,.:]|$)/i;
    const frasi = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean);
    const TAPPE = [
        { title: 'Belvedere Cederna', types: ['establishment'] }, { title: 'Basilica dei Santi XII Apostoli', types: ['church'] },
        { title: 'Galleria Colonna', types: ['museum'] }, { title: 'Villa Sciarra', types: ['park'] },
        { title: 'Piazza Umbrella', types: ['route'] }, { title: 'Ascensori Panoramici', types: ['establishment'] },
        { title: 'Porta Garibaldi', types: ['tourist_attraction'] },
    ];
    const LOCALI = [{ title: 'Osteria Navona', types: ['bar', 'food'] }, { title: 'Trattoria Sorano', types: ['restaurant'] }, { title: 'Enoteca Il Goccetto', types: ['bar'] }];
    const MOMENTI = ['mattina', 'pranzo', 'pomeriggio', 'aperitivo', 'cena', 'dopocena'];

    it('5 varianti per i luoghi e 5 per i locali', () => {
        expect(SAFE_VARIANTS).toEqual({ luogo: 5, locale: 5 });
    });

    it('stessa tappa = stessa frase; tappe diverse usano varianti diverse', () => {
        const a = safeDescription({ stop: { place_id: 'pid-a', ...TAPPE[0] }, momento: 'aperitivo', orario: '18:00', tramonto: '18:37' });
        const b = safeDescription({ stop: { place_id: 'pid-a', ...TAPPE[0] }, momento: 'aperitivo', orario: '18:00', tramonto: '18:37' });
        expect(a).toBe(b);
        const diverse = new Set(Array.from({ length: 30 }, (_, i) => safeDescription({ stop: { place_id: `pid-${i}`, title: 'Piazza Umbrella', types: [] }, momento: 'mattina', orario: '09:30' })
            .replace('Piazza Umbrella', 'N')));
        expect(diverse.size).toBe(5);
    });

    it('ogni variante, per ogni famiglia e momento: un verbo, ≤ 2 frasi, nessuna "tappa del", e passa verita\' e voce', () => {
        let n = 0;
        for (const [lista, locale] of [[TAPPE, false], [LOCALI, true]]) {
            for (const t of lista) {
                for (const momento of MOMENTI) {
                    for (let i = 0; i < 12; i += 1) {
                        for (const orario of ['09:30', '18:00', null]) {
                            const d = safeDescription({
                                stop: { place_id: `p${i}`, ...t }, momento, orario, tramonto: '18:37', locale,
                                priceLevel: locale ? 2 : null, minutiDaPrima: i % 2 ? 7 : null,
                            });
                            n += 1;
                            expect(d, d).toMatch(VERBO);
                            expect(frasi(d).length, d).toBeLessThanOrEqual(2);
                            expect(d, d).not.toMatch(/tappa (?:del|della|dell')/i);
                            expect(filterVoice(d).removed, d).toEqual([]);
                            expect(filterInventedObjects(d, { nomi: [t.title] }).removed, d).toEqual([]);
                            expect(filterBannedWords(d, { exempt: [t.title] }).removed, d).toEqual([]);
                        }
                    }
                }
            }
        }
        expect(n).toBeGreaterThan(1000);
    });

    it('l\'orario e\' un gancio: "ci arrivi alle 18, 35 minuti prima del tramonto" (panorama), mai una coda', () => {
        const d = safeDescription({ stop: { place_id: 'pid-x', title: 'Belvedere Cederna' }, momento: 'aperitivo', orario: '18:00', tramonto: '18:37' });
        expect(d).toContain('alle 18, 35 minuti prima del tramonto');
        expect(d).not.toMatch(/arrivo alle/);
        // la vecchia frase sicura
        expect(d).not.toBe("Belvedere, tappa dell'aperitivo: arrivo alle 18:00, il tramonto è alle 18:37.");
    });
});

describe('P3d-i — il prompt: 3 esempi giusti e 3 sbagliati dalle prove P3d-g', () => {
    it('la regola della description li contiene, e niente altri esempi', () => {
        expect(DESCRIPTION_RULE_PROMPT.match(/GIUSTO:/g)).toHaveLength(3);
        expect(DESCRIPTION_RULE_PROMPT.match(/SBAGLIATO:/g)).toHaveLength(3);
        expect(DESCRIPTION_RULE_PROMPT).toContain('IL MOTIVO SI TRADUCE, NON SI CITA');
        expect(DESCRIPTION_RULE_PROMPT).toContain("L'ORARIO È UN GANCIO DENTRO LA FRASE");
        expect(DESCRIPTION_RULE_PROMPT).toContain('"la vista che cercavi", "per chi ama le chiese barocche"');
        expect(DESCRIPTION_RULE_PROMPT).toContain('massimo 2 frasi, sempre con un verbo');
    });
});
