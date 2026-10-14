// C10b3-chiusura — i simboli accettati decisi da Ivano (banco, scripts/banco/asticella-c10.js):
//   · un simbolo fra quelli accettati passa;
//   · un'ancora fuori dall'insieme non passa come simbolo.
import { describe, it, expect } from 'vitest';
import { simboloGiusto, SIMBOLI_ACCETTATI } from '../../../scripts/banco/asticella-c10.js';

describe('C10b3-chiusura — simboli accettati', () => {
    it('un simbolo fra quelli accettati passa (anche col nome che ha su Google)', () => {
        expect(simboloGiusto([{ nome: 'Castel Nuovo - Maschio Angioino' }], 'Napoli')).toMatchObject({ ok: true, riconosciuto: 'Castel Nuovo' });
        expect(simboloGiusto([{ nome: "Castel dell'Ovo" }], 'Napoli').ok).toBe(true);
        expect(simboloGiusto([{ nome: 'Duomo di Santa Maria Assunta' }], 'Napoli').ok).toBe(true);
        expect(simboloGiusto([{ nome: "Fontana dell'Elefante (uʻ Liotru)" }], 'Catania')).toMatchObject({ ok: true, riconosciuto: "Fontana dell'Elefante" });
        expect(simboloGiusto([{ nome: "Basilica Cattedrale di Sant'Agata" }], 'Catania').ok).toBe(true);
        expect(simboloGiusto([{ nome: 'Palazzo dei Normanni' }], 'Palermo').ok).toBe(true);
        expect(simboloGiusto([{ nome: 'Cattedrale di Maria Santissima Assunta' }], 'Lecce')).toMatchObject({ ok: true, riconosciuto: 'Duomo' });
        expect(simboloGiusto([{ nome: 'Colosseo' }], 'Roma').ok).toBe(true);
        expect(Object.keys(SIMBOLI_ACCETTATI).sort()).toEqual(['Catania', 'Lecce', 'Napoli', 'Palermo', 'Roma', 'Troina']);
    });

    it("un'ancora fuori dall'insieme non passa come simbolo", () => {
        // il rifiuto dice quali simboli erano accettati (l'insieme di Ivano, non un nome solo)
        expect(simboloGiusto([{ nome: 'Museo Cappella Sansevero' }, { nome: 'Castel Nuovo' }], 'Napoli'))
            .toMatchObject({ ok: false, simbolo: 'Museo Cappella Sansevero', riconosciuto: null, atteso: "Castel Nuovo | Castel dell'Ovo | Duomo" });
        expect(simboloGiusto([{ nome: 'Pantheon' }], 'Roma').ok).toBe(false);
        expect(simboloGiusto([{ nome: 'Teatro Massimo di Palermo' }], 'Palermo').ok).toBe(false);
        expect(simboloGiusto([{ nome: 'Anfiteatro Romano di Lecce' }], 'Lecce').ok).toBe(false);
        // un simbolo dedotto dal codice non e' una scelta dell'AI
        expect(simboloGiusto([{ nome: 'Castel Nuovo', dedotto: true }], 'Napoli').ok).toBe(false);
    });
});
