// RACCONTO DI TAPPA — lato client: audio preparato prima dell'arrivo, richiesta al server una volta per tappa, quando si prepara. 0 $.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));

let voce, servizio, chiamate, audioPlayed, parlatiBrowser;
class AudioFinto {
    constructor() { this.src = ''; this.dataset = {}; }
    load() {}
    play() { audioPlayed.push(this.src); setTimeout(() => { this.onplaying?.(); setTimeout(() => this.onended?.(), 0); }, 0); return Promise.resolve(); }
    pause() {}
}
const TESTO = "Guarda l'elefante nero al centro della piazza: è scolpito nel basalto. Per i catanesi è il simbolo della città.";

beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    chiamate = []; audioPlayed = []; parlatiBrowser = [];
    vi.stubEnv('VITE_SUPABASE_URL', 'http://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    vi.stubGlobal('Audio', AudioFinto);
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(t) { this.text = t; } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel: vi.fn(), speak: (u) => { parlatiBrowser.push(u.text); setTimeout(() => u.onend?.(), 0); } } });
    voce = await import('../../lib/voce.js');
    servizio = await import('../../services/raccontoService.js');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const fetchCon = (fn) => vi.stubGlobal('fetch', vi.fn(async (url, init) => { const dv = JSON.parse(init.body).dv; chiamate.push(dv); return fn(dv); }));
const voceOk = (dv) => ({ ok: true, status: 200, json: async () => ({ url: `https://x.test/${encodeURIComponent(dv.testo).slice(0, 20)}.mp3`, source: 'nuova' }) });
const TAPPA = { id: 's2', place_id: 'ChIJV63v_C7jExMRLThjTCcPppk', name: "Fontana dell'Elefante", latitude: 37.50241, longitude: 15.08772, types: ['tourist_attraction'] };

describe('audio preparato prima dell\'arrivo', () => {
    it('preparaVoce chiede l\'audio al server; il Play dopo non richiama il server e parte subito (preparata, avvioMs misurato)', async () => {
        fetchCon(voceOk);
        expect(await voce.preparaVoce(TESTO)).toBe('pronta');
        expect(chiamate).toHaveLength(1);
        expect(await voce.parla(TESTO)).toBe('cache'); // l'url è già in sessione
        expect(chiamate).toHaveLength(1); // nessuna seconda richiesta: l'audio era già pronto
        const riga = voce.registroVoce.find(r => !r.preparazione);
        expect(riga.preparata).toBe(true);
        expect(Number.isFinite(riga.avvioMs)).toBe(true);
        expect(riga.avvioMs).toBeLessThan(1000);
    });
    it('senza preparazione il Play deve prima chiedere il server (preparata false)', async () => {
        fetchCon(voceOk);
        await voce.parla(TESTO);
        expect(chiamate).toHaveLength(1);
        expect(voce.registroVoce.at(-1).preparata).toBe(false);
    });
    it('se l\'audio è ancora in viaggio, il Play lo aspetta senza fare una seconda richiesta', async () => {
        let sblocca; const lenta = new Promise(r => { sblocca = r; });
        fetchCon(async (dv) => { await lenta; return voceOk(dv); });
        const prep = voce.preparaVoce(TESTO);
        const play = voce.parla(TESTO);
        sblocca();
        await prep; await play;
        expect(chiamate).toHaveLength(1);
    });
    it('due preparazioni della stessa frase fanno una richiesta sola', async () => {
        fetchCon(voceOk);
        await Promise.all([voce.preparaVoce(TESTO), voce.preparaVoce(TESTO)]);
        await voce.preparaVoce(TESTO);
        expect(chiamate).toHaveLength(1);
    });
    it('voce umana non disponibile (nessun credito, tetto): la preparazione fallisce in silenzio e il Play parla il browser', async () => {
        fetchCon(() => ({ ok: false, status: 502, json: async () => ({ code: 'VOCE_OPENAI' }) }));
        await expect(voce.preparaVoce(TESTO)).resolves.toBe('fallita');
        await expect(voce.parla(TESTO)).resolves.toBe('browser');
        expect(parlatiBrowser).toEqual([TESTO]);
    });
    it('un testo vuoto non prepara niente', async () => {
        fetchCon(voceOk);
        expect(await voce.preparaVoce('  ')).toBe('fallita');
        expect(chiamate).toHaveLength(0);
    });
});

describe('richiesta del racconto al server', () => {
    const rispondi = (racconto) => ({ ok: true, status: 200, json: async () => ({ racconto }) });
    it('manda al server solo scopo, place_id, nome, città e coordinate: niente fonti, niente testo', async () => {
        fetchCon(() => rispondi({ esito: 'passato', testo: TESTO, motivi: [], fonti: [], cached: false }));
        const r = await servizio.richiediRacconto(TAPPA, 'Catania');
        expect(r).toMatchObject({ testo: TESTO, esito: 'passato' });
        expect(chiamate[0]).toEqual({ purpose: 'racconto', place_id: TAPPA.place_id, nome: "Fontana dell'Elefante", citta: 'Catania', lat: 37.50241, lng: 15.08772 });
    });
    it('una richiesta sola per tappa, anche chiesta due volte (avvio del tratto e 300 m)', async () => {
        fetchCon(() => rispondi({ esito: 'passato', testo: TESTO }));
        await Promise.all([servizio.richiediRacconto(TAPPA, 'Catania'), servizio.richiediRacconto(TAPPA, 'Catania')]);
        await servizio.richiediRacconto(TAPPA, 'Catania');
        expect(chiamate).toHaveLength(1);
    });
    it('un racconto già avuto sta sul telefono: una nuova sessione non richiama il server', async () => {
        fetchCon(() => rispondi({ esito: 'passato', testo: TESTO }));
        await servizio.richiediRacconto(TAPPA, 'Catania');
        vi.resetModules();
        const nuovo = await import('../../services/raccontoService.js');
        const r = await nuovo.richiediRacconto(TAPPA, 'Catania');
        expect(r).toMatchObject({ testo: TESTO, cached: true });
        expect(chiamate).toHaveLength(1);
    });
    it('scartato o senza fonti: testo null (resta la frase breve)', async () => {
        fetchCon(() => rispondi({ esito: 'senza-fonti', testo: null }));
        expect((await servizio.richiediRacconto(TAPPA, 'Catania')).testo).toBeNull();
        servizio._svuotaMemoPerTest();
        fetchCon(() => rispondi({ esito: 'scartato', testo: 'Un testo scartato che non deve arrivare.' }));
        expect((await servizio.richiediRacconto({ ...TAPPA, place_id: 'ChIJaltroPostoDiProva1' }, 'Catania')).testo).toBeNull();
    });
    it('server giù: null senza eccezioni, e la volta dopo si riprova', async () => {
        fetchCon(() => ({ ok: false, status: 502, json: async () => ({ code: 'RACCONTO_MOTORE' }) }));
        expect(await servizio.richiediRacconto(TAPPA, 'Catania')).toBeNull();
        fetchCon(() => rispondi({ esito: 'passato', testo: TESTO }));
        expect((await servizio.richiediRacconto(TAPPA, 'Catania')).testo).toBe(TESTO);
    });
    it('un locale o una tappa senza place_id non si raccontano e non chiamano il server', async () => {
        fetchCon(() => rispondi({ esito: 'passato', testo: TESTO }));
        expect(servizio.tappaRaccontabile({ ...TAPPA, types: ['restaurant', 'food'] })).toBe(false);
        expect(servizio.tappaRaccontabile({ ...TAPPA, place_id: undefined })).toBe(false);
        expect(servizio.tappaRaccontabile({ ...TAPPA, place_id: undefined, googlePlaceId: TAPPA.place_id })).toBe(true); // il passo normalizzato lo chiama googlePlaceId
        expect((await servizio.richiediRacconto({ ...TAPPA, types: ['bar'] }, 'Catania')).esito).toBe('non-raccontabile');
        expect(chiamate).toHaveLength(0);
    });
});

describe('quando si prepara', () => {
    it('appena la tappa è la prossima si chiede il racconto; con il testo si prepara l\'audio; poi niente', async () => {
        const { cosaPreparare, raccontoOFrase } = await import('../../lib/raccontoTappa.js');
        expect(cosaPreparare({})).toBe('richiedi');
        expect(cosaPreparare({ testoPronto: true })).toBe('audio');
        expect(cosaPreparare({ testoPronto: true, audioPronto: true })).toBe('niente');
        // richiesta già fatta e senza racconto (senza fonti): non si richiede finché non si è a 300 m
        expect(cosaPreparare({ richiestaFatta: true, distanzaM: 800 })).toBe('niente');
        expect(cosaPreparare({ richiestaFatta: true, distanzaM: 250 })).toBe('richiedi');
        expect(raccontoOFrase({ s2: 'Il racconto.' }, { id: 's2' }, 'La frase breve.')).toBe('Il racconto.');
        expect(raccontoOFrase({}, { id: 's2' }, 'La frase breve.')).toBe('La frase breve.');
        expect(raccontoOFrase({}, { id: 's2' }, null)).toBeNull();
    });
});
