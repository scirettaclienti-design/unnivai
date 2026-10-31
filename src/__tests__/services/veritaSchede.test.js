// VERITA-SCHEDE — i fatti di una scheda (cenni, curiosità, testo letto a voce) vengono solo dalle fonti della tappa. 0 $, nessuna rete.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { controllaRacconto } from '../../../supabase/functions/openai-proxy/racconto.ts';

vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
import { aiRecommendationService } from '../../services/aiRecommendationService';
import { _svuotaMemoPerTest } from '../../services/raccontoService';

const FONTI_CATANIA = {
    nome: "Fontana dell'Elefante", citta: 'Catania',
    wikipedia: { titolo: "Fontana dell'Elefante", testo: "La fontana dell'Elefante è un'opera monumentale, realizzata tra il 1735 e il 1737 dall'architetto Giovanni Battista Vaccarini, al centro di piazza del Duomo a Catania. Una statua di basalto nero raffigura un elefante, detto U Liotru." },
    google: { testo: 'Fontana con una statua di un elefante scolpito nel basalto, simbolo della città.' },
};
const FONTI_ROMA = {
    nome: 'Fontana di Trevi', citta: 'Roma',
    wikipedia: { titolo: 'Fontana di Trevi', testo: 'La fontana di Trevi è la più grande fontana barocca di Roma. Fu progettata da Nicola Salvi e inaugurata nel 1762. Prende il nome dal rione Trevi.' },
    google: { testo: 'Monumentale fontana barocca del Settecento.' },
};

describe('il controllo sulle fonti: un fatto delle fonti passa, un fatto altrui non esce', () => {
    it('Catania: il fatto presente nelle fonti passa', () => {
        expect(controllaRacconto("Guarda l'elefante nero: è scolpito nel basalto, e qui lo chiamano U Liotru. La fontana è di Vaccarini, tra il 1735 e il 1737.", FONTI_CATANIA).ok).toBe(true);
    });
    it('Catania: un fatto di Roma (Salvi, 1762) non passa', () => {
        const c = controllaRacconto("Guarda l'elefante nero. Dicono sia stata progettata da Nicola Salvi e inaugurata nel 1762.", FONTI_CATANIA);
        expect(c.ok).toBe(false);
        expect(c.fuoriFonti.numeri).toContain('1762');
    });
    it('Roma: il fatto presente passa; un fatto di Catania (Vaccarini, 1737) no', () => {
        expect(controllaRacconto('Fermati qui: la fontana la progettò Nicola Salvi. Fu inaugurata nel 1762.', FONTI_ROMA).ok).toBe(true);
        const c = controllaRacconto('Fermati qui: la fontana è di Vaccarini e del 1737.', FONTI_ROMA);
        expect(c.ok).toBe(false);
        expect(c.fuoriFonti.nomi).toContain('Vaccarini');
    });
    it('un fatto assente dalle fonti (nome proprio mai nominato) non passa', () => {
        expect(controllaRacconto("Guarda l'elefante nero. Lo scolpì Gian Lorenzo Bernini nel 1650.", FONTI_CATANIA).ok).toBe(false);
    });
});

describe('enrichMonuments: il testo della scheda viene dal racconto con le fonti, mai dal modello', () => {
    const risposte = {};
    let chiamate;
    beforeEach(() => {
        _svuotaMemoPerTest();
        try { localStorage.clear(); } catch { /* niente storage */ }
        chiamate = [];
        vi.stubEnv('VITE_SUPABASE_URL', 'https://finto.invalid');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
        vi.stubGlobal('fetch', vi.fn(async (url, opt) => {
            const dv = JSON.parse(opt.body).dv;
            chiamate.push({ purpose: dv.purpose, nome: dv.nome });
            return { ok: true, json: async () => ({ racconto: risposte[dv.place_id] }) };
        }));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

    const catania = { googlePlaceId: 'pid-elefante', name: "Fontana dell'Elefante", latitude: 37.5026, longitude: 15.0874, type: 'monument' };
    const roma = { googlePlaceId: 'pid-trevi', name: 'Fontana di Trevi', latitude: 41.9009, longitude: 12.4833, type: 'monument' };

    it('racconto passato (Catania e Roma): il testo del server diventa il cenno, nessuna curiosità', async () => {
        risposte['pid-elefante'] = { esito: 'passato', testo: "Guarda l'elefante nero: è di basalto." };
        risposte['pid-trevi'] = { esito: 'passato', testo: 'La progettò Nicola Salvi.' };
        const [a, b] = await aiRecommendationService.enrichMonuments([catania, roma], 'Italia');
        expect(a.historicalNotes).toBe("Guarda l'elefante nero: è di basalto.");
        expect(b.historicalNotes).toBe('La progettò Nicola Salvi.');
        expect(a.funFacts).toEqual([]);
        expect(b.funFacts).toEqual([]);
        expect(chiamate.every(c => c.purpose === 'racconto')).toBe(true); // nessuna chiamata di testo libero al modello
    });
    it('racconto scartato o tappa senza fonti: nessun testo e nessuna curiosità', async () => {
        risposte['pid-elefante'] = { esito: 'scartato', testo: null };
        risposte['pid-trevi'] = { esito: 'senza-fonti', testo: null };
        const out = await aiRecommendationService.enrichMonuments([catania, roma], 'Italia');
        for (const x of out) { expect(x.historicalNotes).toBeUndefined(); expect(x.funFacts).toEqual([]); }
    });
    it('tappa senza place_id o server giù: nessun testo, nessun errore', async () => {
        const [a] = await aiRecommendationService.enrichMonuments([{ name: 'Posto senza id' }], 'Catania');
        expect(a.historicalNotes).toBeUndefined();
        expect(a.funFacts).toEqual([]);
        expect(chiamate).toHaveLength(0);
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rete'); }));
        const [b] = await aiRecommendationService.enrichMonuments([{ ...catania, googlePlaceId: 'altro' }], 'Catania');
        expect(b.historicalNotes).toBeUndefined();
    });
});
