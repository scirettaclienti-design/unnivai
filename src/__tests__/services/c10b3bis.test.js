// C10b3-bis — quote corrette (decisioni di Ivano):
//   · una piazza o una via storica entra nella lista senza contare negli 8 luoghi da visitare;
//   · un'ancora puo' essere una piazza, il simbolo no;
//   · un solo completamento copre piu' quote mancanti; il dopocena mancante viene completato;
//   · un errore di gpt-6.1-sol da' un nuovo tentativo prima del ripiego;
//   · il costo della lista conta anche i token del completamento.
import { describe, it, expect, vi } from 'vitest';
import { leggiLista, quoteLista, completaLista, QUOTE, promptCitta } from '../../../supabase/functions/openai-proxy/cityKnowledge.ts';
import { chiamaConRipiego, usageTotale, MODELLO_DI_PRIMA } from '../../../supabase/functions/openai-proxy/modelli.ts';

const posto = (nome, categoria, extra = {}) => ({ nome, momento: 'mattina', tipo: 'da locale', categoria, ...extra });
const visite = (n) => Array.from({ length: n }, (_, i) => posto(`Chiesa numero ${i + 1}`, i % 2 ? 'museo' : 'chiesa'));
const locali = [
    posto('Caffè della Piazza', 'colazione', { momento: 'colazione' }), posto('Trattoria Prima', 'ristorante', { momento: 'pranzo' }),
    posto('Osteria Seconda', 'ristorante', { momento: 'cena' }),
];
// C10b3-ter — le regole di C10b3-bis con la variante A del prompt (con la C le ancore vengono dagli imperdibili)
const leggi = (posti, scala = 'città') => leggiLista(JSON.stringify({ posti }), 'Città Prova', scala, 'A');

describe('C10b3-bis — piazze e vie storiche, ancore, simbolo', () => {
    it('una piazza o una via storica entra nella lista senza contare negli 8 luoghi da visitare', () => {
        const l = leggi([...visite(7), posto('Piazza Grande', 'piazza'), posto('Via Antica', 'via', { momento: 'pomeriggio' }), ...locali]);
        expect(l.map(p => p.nome)).toEqual(expect.arrayContaining(['Piazza Grande', 'Via Antica']));
        const q = quoteLista(l, 'città');
        expect(q.visite).toBe(7);
        expect(q.storiche).toBe(2);
        expect(q.mancanti.visite).toBe(QUOTE.visiteMin - 7);
        expect(q.mancanti.storiche).toBe(0);
        // la via storica vale come passeggiata
        expect(l.find(p => p.nome === 'Via Antica').passeggiata).toBe(true);
    });

    it("un'ancora può essere una piazza o una via storica, il simbolo no", () => {
        const l = leggi([
            posto('Piazza Grande', 'piazza', { tipo: 'essenziale', simbolo: true }),
            posto('Via Antica', 'via', { tipo: 'essenziale' }),
            posto('Cattedrale Prova', 'chiesa', { tipo: 'essenziale' }),
        ]);
        expect(l.find(p => p.nome === 'Piazza Grande')).toMatchObject({ tipo: 'essenziale' });
        expect(l.find(p => p.nome === 'Via Antica')).toMatchObject({ tipo: 'essenziale' });
        expect(l.find(p => p.nome === 'Piazza Grande').simbolo).toBeUndefined();
        expect(l.find(p => p.nome === 'Cattedrale Prova')).toMatchObject({ simbolo: true, simboloDedotto: true });
        // il prompt lo chiede cosi' (citta' e metropoli): ancore anche piazze e vie storiche, il simbolo un luogo da visitare
        for (const scala of ['città', 'metropoli']) {
            const sys = promptCitta('Città Prova', '2026-10-15', scala, 'A').system;
            expect(sys).toMatch(/possono essere un luogo da visitare, una piazza o una via storica, mai un locale; fra loro il simbolo/);
            expect(sys).toMatch(/Il simbolo è un luogo da visitare .*non una strada, una piazza o un locale/);
        }
    });
});

describe('C10b3-bis — un solo completamento per tutte le quote', () => {
    // 6 luoghi da visitare (mancano 2), nessuna piazza o via (mancano 2), 1 ancora (mancano 2), nessun dopocena (manca 1)
    const base = () => leggi([posto('Duomo Prova', 'chiesa', { tipo: 'essenziale' }), ...visite(5), ...locali]);

    it('un solo completamento copre più quote mancanti: luoghi, piazze e vie, ancore', async () => {
        const l = base();
        const q = quoteLista(l, 'città');
        expect(q.mancanti).toEqual({ visite: 2, storiche: 2, ancore: 2, dopocena: 1 });
        const chiedi = vi.fn(async () => JSON.stringify({ posti: [
            posto('Palazzo Nobile', 'palazzo'), posto('Giardino Pubblico', 'giardino'), posto('Museo in più', 'museo'),
            posto('Piazza Maggiore', 'piazza', { tipo: 'essenziale' }), posto('Via dei Mercanti', 'via'),
            posto('Chiesa numero 1', 'chiesa', { tipo: 'essenziale' }), // un'ancora ripetuta: diventa essenziale
            posto('Bar Notturno', 'dopocena', { momento: 'dopocena' }),
        ] }));
        const r = await completaLista({ posti: l, scala: 'città', citta: 'Città Prova', giorno: '2026-10-15', chiedi, variante: 'A' });
        expect(chiedi).toHaveBeenCalledTimes(1);
        const sys = chiedi.mock.calls[0][0].system;
        expect(sys).toMatch(/- 2 LUOGHI DA VISITARE/);
        expect(sys).toMatch(/- 2 PIAZZE MONUMENTALI o VIE STORICHE/);
        expect(sys).toMatch(/- 2 ANCORE/);
        expect(sys).toMatch(/- 1 posto per il DOPOCENA/);
        expect(r.completamento.aggiunti).toEqual(['Palazzo Nobile', 'Giardino Pubblico', 'Piazza Maggiore', 'Via dei Mercanti', 'Bar Notturno']);
        expect(r.completamento.promossi).toEqual(['Chiesa numero 1']);
        expect(r.quoteDopo.mancanti).toEqual({ visite: 0, storiche: 0, ancore: 0, dopocena: 0 });
        expect(r.posti.find(p => p.nome === 'Piazza Maggiore')).toMatchObject({ tipo: 'essenziale', completamento: true });
        // le aggiunte non diventano simbolo: il simbolo resta il luogo da visitare che c'era
        expect(r.posti.filter(p => p.simbolo).map(p => p.nome)).toEqual(['Duomo Prova']);
    });

    it('il dopocena mancante viene completato (anche quando è l’unica quota che manca)', async () => {
        const l = leggi([posto('Duomo Prova', 'chiesa', { tipo: 'essenziale' }), posto('Castello Prova', 'monumento', { tipo: 'essenziale' }),
            posto('Museo Prova', 'museo', { tipo: 'essenziale' }), ...visite(5), posto('Piazza Grande', 'piazza'), posto('Via Antica', 'via'), ...locali]);
        expect(quoteLista(l, 'città').mancanti).toEqual({ visite: 0, storiche: 0, ancore: 0, dopocena: 1 });
        const chiedi = vi.fn(async () => JSON.stringify({ posti: [posto('Enoteca Tarda', 'dopocena', { momento: 'dopocena' }), posto('Chiesa in più', 'chiesa')] }));
        const r = await completaLista({ posti: l, scala: 'città', citta: 'Città Prova', giorno: '2026-10-15', chiedi, variante: 'A' });
        expect(chiedi).toHaveBeenCalledTimes(1);
        expect(r.completamento.aggiunti).toEqual(['Enoteca Tarda']);
        expect(r.quoteDopo.dopocena).toBe(1);
    });
});

describe('C10b3-bis — il modello e il costo', () => {
    const payload = { model: MODELLO_DI_PRIMA, temperature: 0.2, max_tokens: 1200, messages: [{ role: 'user', content: 'x' }] };
    const risposta = (content = '{"posti":[]}', usage = { prompt_tokens: 10, completion_tokens: 5 }) => ({ choices: [{ message: { content } }], usage });

    it('un errore di gpt-6.1-sol dà un nuovo tentativo prima del ripiego', async () => {
        const invia = vi.fn().mockRejectedValueOnce(new Error('HTTP 500 - server_error -')).mockResolvedValueOnce(risposta('{"posti":[{"nome":"X"}]}'));
        const { data, info } = await chiamaConRipiego('lista', payload, invia);
        expect(invia).toHaveBeenCalledTimes(2);
        expect(invia.mock.calls[1][0].model).toBe('gpt-6.1-sol');
        expect(data.choices[0].message.content).toContain('"X"');
        expect(info).toMatchObject({ usato: 'gpt-6.1-sol', ripiego: false, tentativi: 2, primoErrore: 'HTTP 500 - server_error -' });
        // il tempo scaduto non ha un nuovo tentativo: si ripiega subito
        const scaduto = vi.fn()
            .mockImplementationOnce(async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; })
            .mockResolvedValueOnce(risposta());
        expect((await chiamaConRipiego('lista', payload, scaduto)).info).toMatchObject({ ripiego: true, usato: MODELLO_DI_PRIMA });
        expect(scaduto).toHaveBeenCalledTimes(2);
        expect(scaduto.mock.calls[1][0].model).toBe(MODELLO_DI_PRIMA);
    });

    it('il costo della lista include i token del completamento', () => {
        const u = usageTotale([
            { cosa: 'abitanti', usato: 'gpt-6.1-sol', usage: { prompt_tokens: 50, completion_tokens: 10 } },
            { cosa: 'lista', usato: 'gpt-6.1-sol', usage: { prompt_tokens: 900, completion_tokens: 1500 } },
            { cosa: 'completamento', usato: 'gpt-6.1-sol', usage: { prompt_tokens: 300, completion_tokens: 400 } },
        ]);
        expect(u).toMatchObject({ prompt_tokens: 1250, completion_tokens: 1910 });
        expect(u.perModello['gpt-6.1-sol']).toEqual({ prompt_tokens: 1250, completion_tokens: 1910 });
    });
});
