// C10b3-ter — la lista nomina prima gli imperdibili (decisioni di Ivano):
//   · il controllo del simbolo del banco boccia un'ancora che non e' il simbolo atteso;
//   · il prompt del traduttore non contiene nomi delle citta' del banco (ne' i posti delle liste di controllo);
//   · con la variante scelta (C) le ancore vengono dagli imperdibili e il simbolo ne fa parte.
import { describe, it, expect } from 'vitest';
import { simboloGiusto, ESSENZIALI_CONTROLLO } from '../../../scripts/banco/asticella-c10.js';
import { INTENT_TRANSLATOR_PROMPT } from '../../services/aiRecommendationService';
import { leggiLista, promptCitta, VARIANTE_LISTA } from '../../../supabase/functions/openai-proxy/cityKnowledge.ts';

describe('C10b3-ter — il simbolo atteso', () => {
    it("il controllo del simbolo boccia un'ancora che non è il simbolo atteso", () => {
        // Roma passava col Pantheon (un simbolo di quartiere): il simbolo della citta' e' il primo segnato dall'AI
        expect(simboloGiusto([{ nome: 'Pantheon', quartiere: 'Centro' }, { nome: 'Colosseo', quartiere: 'Monti' }], 'Roma')).toMatchObject({ ok: false, atteso: 'Colosseo', simbolo: 'Pantheon' });
        expect(simboloGiusto([{ nome: 'Colosseo' }, { nome: 'Pantheon' }], 'Roma')).toMatchObject({ ok: true });
        // un simbolo dedotto dal codice non e' una scelta dell'AI: non vale
        expect(simboloGiusto([{ nome: 'Colosseo', dedotto: true }], 'Roma').ok).toBe(false);
        expect(simboloGiusto([{ nome: 'Basilica di Santa Croce' }], 'Lecce').ok).toBe(true);
    });
});

describe('C10b3-ter — il prompt del traduttore', () => {
    it('non contiene nomi delle città del banco né posti delle liste di controllo', () => {
        const CITTA_DEL_BANCO = ['Catania', 'Roma', 'Napoli', 'Troina', 'Palermo', 'Firenze', 'Milano', 'Siracusa', 'Matera', 'Lecce', 'Bologna'];
        for (const c of CITTA_DEL_BANCO) expect(INTENT_TRANSLATOR_PROMPT).not.toMatch(new RegExp(`\\b${c}\\b`));
        for (const [nome, rx] of Object.values(ESSENZIALI_CONTROLLO).flat()) {
            expect(rx.test(INTENT_TRANSLATOR_PROMPT), nome).toBe(false);
        }
        // nemmeno i posti di quelle citta' usati prima come esempi
        for (const n of ['Villa Bellini', 'Colosseo', 'Villa Borghese', 'Villa Sciarra', 'Parco Sempione']) expect(INTENT_TRANSLATOR_PROMPT).not.toContain(n);
    });
});

describe('C10b3-ter — variante C: prima gli imperdibili', () => {
    const p = (nome, categoria, extra = {}) => ({ nome, momento: 'mattina', tipo: 'da locale', categoria, ...extra });

    it('la variante in produzione è la C, e il prompt chiede gli imperdibili per primi', () => {
        expect(VARIANTE_LISTA).toBe('C');
        const sys = promptCitta('Città Prova', '2026-10-15', 'città').system;
        expect(sys).toMatch(/PRIMA PARTE, GLI IMPERDIBILI: da 5 a 6 posti/);
        expect(sys).toMatch(/scelte FRA GLI IMPERDIBILI; fra loro il simbolo/);
        expect(promptCitta('Città Prova', '2026-10-15', 'metropoli').system).toMatch(/da 6 a 8 posti con "imperdibile": true, a livello di città/);
        // il borgo non cambia
        expect(promptCitta('Città Prova', '2026-10-15', 'borgo').system).not.toMatch(/IMPERDIBILI/);
    });

    it('con la variante scelta le ancore vengono dagli imperdibili e il simbolo ne fa parte', () => {
        const l = leggiLista(JSON.stringify({ posti: [
            p('Arena Prova', 'monumento', { imperdibile: true, simbolo: true }), // simbolo, non segnato essenziale: lo diventa
            p('Duomo Prova', 'chiesa', { imperdibile: true }),
            p('Piazza Maggiore Prova', 'piazza', { imperdibile: true }),
            p('Chiesetta del Quartiere', 'chiesa', { tipo: 'essenziale' }), // essenziale ma non imperdibile: non e' un'ancora
            p('Caffè Storico', 'colazione', { imperdibile: true, tipo: 'essenziale', momento: 'colazione' }), // un locale: mai
        ] }), 'Città Prova', 'città');
        const ancore = l.filter(x => x.tipo === 'essenziale');
        expect(ancore.map(x => x.nome)).toEqual(['Arena Prova', 'Duomo Prova', 'Piazza Maggiore Prova']);
        expect(ancore.every(x => x.imperdibile)).toBe(true);
        expect(l.find(x => x.nome === 'Chiesetta del Quartiere').tipo).toBe('da locale');
        expect(l.find(x => x.nome === 'Caffè Storico')).toMatchObject({ tipo: 'da locale' });
        expect(l.find(x => x.nome === 'Caffè Storico').imperdibile).toBeUndefined();
        const simboli = l.filter(x => x.simbolo);
        expect(simboli.map(x => x.nome)).toEqual(['Arena Prova']);
        expect(simboli[0]).toMatchObject({ imperdibile: true, tipo: 'essenziale' });
        expect(simboli[0].simboloDedotto).toBeUndefined();
    });
});
