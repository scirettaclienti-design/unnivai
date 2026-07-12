// Gate C Task 1 — Tests di buildPromptFromSelections.
//
// Verifica che il prompt generato dal wizard sia un BRIEF OPERATIVO per il
// traduttore Gate B, non prosa turistica. Prima del fix, "Relax + Benessere
// a Siracusa" generava "Voglio scoprire Siracusa attraverso luoghi
// tranquilli, giardini e caffè letterari" e il traduttore restituiva
// queries vaghe → textsearch pescava il Duomo.

import { describe, it, expect } from 'vitest';
import { buildPromptFromSelections } from '../../pages/QuickPath';

describe('Gate C Task 1 — buildPromptFromSelections', () => {
    it('Relax + Benessere → queries concrete (spa/hammam/terme), escludi cattedrali', () => {
        const p = buildPromptFromSelections({
            main: 'relax', sub: 'benessere', time: 'pomeriggio',
            duration: 'medio', group: 'coppia', city: 'Siracusa',
        });
        expect(p).toMatch(/A Siracusa cerco:/);
        expect(p).toMatch(/spa|hammam|terme|benessere/i);
        expect(p).toMatch(/Escludi:/);
        expect(p).toMatch(/cattedrali|musei/i);
        // La vecchia prosa "Voglio scoprire" non deve più comparire.
        expect(p).not.toMatch(/Voglio scoprire/);
    });

    it('Relax senza sub → _default concreto (spa/giardini/spiagge)', () => {
        const p = buildPromptFromSelections({
            main: 'relax', sub: '', time: '', duration: 'medio',
            group: '', city: 'Siracusa',
        });
        expect(p).toMatch(/spa|giardini|spiagge/i);
        expect(p).toMatch(/Escludi:.*cattedrali|Escludi:.*musei/i);
        // "luoghi tranquilli" era il vecchio _default vago, non deve più comparire.
        expect(p).not.toMatch(/luoghi tranquilli/);
        expect(p).not.toMatch(/caffè letterari/);
    });

    it('Mare + Lungomare a Napoli → escludi chiese/musei', () => {
        const p = buildPromptFromSelections({
            main: 'mare', sub: 'lungomare', time: 'sera',
            duration: 'lungo', group: 'amici', city: 'Napoli',
        });
        expect(p).toMatch(/A Napoli cerco:/);
        expect(p).toMatch(/lungomare|spiagge|panorami sul mare/i);
        expect(p).toMatch(/Escludi:.*chiese|Escludi:.*musei/i);
    });

    it('Cibo NON aggiunge EXCLUSION_CLAUSE food-generica (isFoodMain=true)', () => {
        const p = buildPromptFromSelections({
            main: 'cibo', sub: 'street', time: 'pomeriggio',
            duration: 'medio', group: 'coppia', city: 'Roma',
        });
        expect(p).toMatch(/street food|mercati|cucina/i);
        // Il main "cibo" ha un exclude hint (musei/chiese) ma NON la clausola
        // generica "Solo tappe di questa categoria: non aggiungere ristoranti…".
        expect(p).not.toMatch(/non aggiungere ristoranti, bar o caffè/);
    });

    it('Città + Rione a Roma → nessun Escludi (main storico/urbano)', () => {
        const p = buildPromptFromSelections({
            main: 'citta', sub: 'rione', time: 'mattina',
            duration: 'veloce', group: 'solo', city: 'Roma',
        });
        expect(p).toMatch(/quartieri caratteristici|vicoli/i);
        // "citta" non è in EXCLUDE_HINTS_BY_MAIN → nessun "Escludi:" specifico,
        // ma la EXCLUSION_CLAUSE food-generica torna a comparire come rinforzo.
        expect(p).not.toMatch(/Escludi:/);
        expect(p).toMatch(/non aggiungere ristoranti, bar o caffè/);
    });

    it('Cita numero tappe corretto per ogni durata', () => {
        const short = buildPromptFromSelections({
            main: 'citta', sub: '', time: '', duration: 'veloce',
            group: '', city: 'Roma',
        });
        expect(short).toMatch(/Esattamente 2 tappe/);

        const long = buildPromptFromSelections({
            main: 'citta', sub: '', time: '', duration: 'lungo',
            group: '', city: 'Roma',
        });
        expect(long).toMatch(/Esattamente 5-6 tappe/);
    });

    it('main sconosciuto → dominant di default, prompt non rotto', () => {
        const p = buildPromptFromSelections({
            main: 'quantumteleport', sub: '', time: '', duration: 'medio',
            group: '', city: 'Roma',
        });
        expect(p).toMatch(/monumenti principali/);
        expect(p).toMatch(/Roma/);
    });

    it('città vuota → variante "Cerco:" senza "A <city>"', () => {
        const p = buildPromptFromSelections({
            main: 'relax', sub: 'benessere', time: '', duration: 'medio',
            group: '', city: '',
        });
        expect(p).toMatch(/^Cerco:/);
        expect(p).not.toMatch(/A\s+\.\s+cerco/);
    });

    // Gate H — REGRESSION TEST del bug scoperto da Ivano su device (Catania,
    // Natura+Parchi vs Città → stesso identico tour). Causa: selectedOption
    // era una STRING ma il codice la trattava come oggetto (.id/.title) → main
    // sempre undefined → prompt sempre = dominant di default → cache hit.
    // Questi 3 test avrebbero preso il bug in CI.

    it('selezioni diverse → prompt diversi (regression Gate H)', () => {
        const natura = buildPromptFromSelections({
            main: 'natura', sub: 'parco', time: '', duration: 'medio',
            group: '', city: 'Catania',
        });
        const citta = buildPromptFromSelections({
            main: 'citta', sub: 'centro', time: '', duration: 'medio',
            group: '', city: 'Catania',
        });
        const cibo = buildPromptFromSelections({
            main: 'cibo', sub: 'street', time: '', duration: 'medio',
            group: '', city: 'Catania',
        });
        expect(natura).not.toBe(citta);
        expect(natura).not.toBe(cibo);
        expect(citta).not.toBe(cibo);
    });

    it('main "natura" → prompt contiene parole di natura, non "monumenti principali"', () => {
        const p = buildPromptFromSelections({
            main: 'natura', sub: 'parco', time: '', duration: 'medio',
            group: '', city: 'Catania',
        });
        expect(p).toMatch(/parchi|giardini|aree verdi/i);
        // Il dominant di default ("monumenti principali") NON deve comparire
        // — se compare, il main è collassato su undefined come nel bug Gate H.
        expect(p).not.toMatch(/monumenti principali/);
    });

    it('main "cibo" → prompt contiene "street food"/"trattorie", non "monumenti"', () => {
        const p = buildPromptFromSelections({
            main: 'cibo', sub: 'street', time: '', duration: 'medio',
            group: '', city: 'Roma',
        });
        expect(p).toMatch(/street food|mercati|cucina di strada/i);
        expect(p).not.toMatch(/monumenti principali/);
    });
});
