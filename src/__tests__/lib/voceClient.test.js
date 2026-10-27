// VOCE-1 — il lettore della voce nel client: cache di sessione (0 chiamate), ricadute senza errori a schermo,
// selettore salvato, registro di ogni frase detta, Media Session.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));

let voce, chiamate, risposta, parlatiBrowser, audioPlayed;

const PLAY_ORIGINALE = function () { audioPlayed.push(this.src); if (!this.src.startsWith('data:')) setTimeout(() => this.onended?.(), 0); return Promise.resolve(); };
class AudioFinto {
    constructor() { this.src = ''; this.dataset = {}; AudioFinto.ultimo = this; }
    play() { return PLAY_ORIGINALE.call(this); }
    pause() {}
}

beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    chiamate = []; audioPlayed = []; parlatiBrowser = [];
    AudioFinto.prototype.play = function () { return PLAY_ORIGINALE.call(this); };
    risposta = (dv) => ({ ok: true, status: 200, json: async () => ({ url: `https://x.test/${encodeURIComponent(dv.voce + dv.testo)}.mp3`, source: 'nuova' }) });
    vi.stubEnv('VITE_SUPABASE_URL', 'http://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    vi.stubGlobal('fetch', vi.fn(async (url, init) => { const dv = JSON.parse(init.body).dv; chiamate.push(dv); return risposta(dv); }));
    vi.stubGlobal('Audio', AudioFinto);
    vi.stubGlobal('MediaMetadata', class { constructor(o) { Object.assign(this, o); } });
    Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: { metadata: null, playbackState: 'none', setActionHandler: vi.fn() } });
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(t) { this.text = t; } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel: vi.fn(), speak: (u) => { parlatiBrowser.push(u.text); setTimeout(() => u.onend?.(), 0); } } });
    voce = await import('../../lib/voce.js');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('voce — cache e registro', () => {
    it('la stessa frase due volte: una sola richiesta al server, due righe nel registro (nuova, poi cache)', async () => {
        expect(await voce.parla('Fra cinquanta metri gira a sinistra.')).toBe('nuova');
        expect(await voce.parla('Fra cinquanta metri gira a sinistra.')).toBe('cache');
        expect(chiamate).toHaveLength(1);
        expect(voce.registroVoce.map(r => r.sorgente)).toEqual(['nuova', 'cache']);
        expect(voce.registroVoce[0]).toMatchObject({ testo: 'Fra cinquanta metri gira a sinistra.', voce: 'marin' });
        expect(Date.parse(voce.registroVoce[0].ora)).not.toBeNaN();
        expect(window.__voceRegistro).toBe(voce.registroVoce);
    });
    it('il server dice «cache»: la sorgente è cache anche alla prima volta in sessione', async () => {
        risposta = (dv) => ({ ok: true, status: 200, json: async () => ({ url: 'https://x.test/a.mp3', source: 'cache' }) });
        expect(await voce.parla('Una frase già detta da qualcuno.')).toBe('cache');
    });
    it('una voce diversa è una richiesta diversa', async () => {
        await voce.parla('Eccoci.', { voce: 'marin' });
        await voce.parla('Eccoci.', { voce: 'cedar' });
        expect(chiamate.map(c => c.voce)).toEqual(['marin', 'cedar']);
    });
    it('manda al server solo scopo, testo e voce: modello e tono non li sceglie il client', async () => {
        await voce.parla('Eccoci.');
        expect(chiamate[0]).toEqual({ purpose: 'voce', testo: 'Eccoci.', voce: 'marin' });
    });
});

describe('voce — ricadute senza errori a schermo', () => {
    it.each([
        ['server 503', () => ({ ok: false, status: 503, json: async () => ({ code: 'VOCE_NON_DISPONIBILE' }) })],
        ['tetto 429', () => ({ ok: false, status: 429, json: async () => ({ code: 'VOCE_TETTO' }) })],
        ['risposta illeggibile', () => ({ ok: true, status: 200, json: async () => { throw new Error('x'); } })],
    ])('%s → parla il browser, nessuna eccezione', async (_n, r) => {
        risposta = r;
        await expect(voce.parla('Si va verso Piazza Duomo.')).resolves.toBe('browser');
        expect(parlatiBrowser).toEqual(['Si va verso Piazza Duomo.']);
        expect(voce.registroVoce.at(-1).sorgente).toBe('browser');
    });
    it('rete caduta (fetch lancia) → voce del browser', async () => {
        fetch.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
        await expect(voce.parla('Adesso gira a destra.')).resolves.toBe('browser');
    });
    it('riproduzione bloccata dal telefono (play rifiuta) → voce del browser', async () => {
        AudioFinto.prototype.play = function () { return Promise.reject(new Error('NotAllowedError')); };
        await expect(voce.parla('Eccoci.')).resolves.toBe('browser');
    });
    it('né voce umana né voce del browser: tace, senza eccezioni', async () => {
        risposta = () => ({ ok: false, status: 503, json: async () => ({}) });
        Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
        await expect(voce.parla('Eccoci.')).resolves.toBe('muto');
    });
    it('testo vuoto: non chiama nessuno', async () => {
        expect(await voce.parla('   ')).toBe('muto');
        expect(chiamate).toHaveLength(0);
    });
    it('una frase vecchia che arriva tardi non parla sopra quella nuova', async () => {
        let sblocca; const lenta = new Promise(r => { sblocca = r; });
        fetch.mockImplementationOnce(async () => { await lenta; return { ok: true, status: 200, json: async () => ({ url: 'https://x.test/vecchia.mp3', source: 'nuova' }) }; });
        const vecchia = voce.parla('Frase vecchia.');
        voce.fermaVoce();
        sblocca();
        expect(await vecchia).toBe('muto');
        expect(audioPlayed.filter(s => s.includes('vecchia'))).toHaveLength(0);
    });
});

describe('voce — selettore e Media Session', () => {
    it('marin di default; la scelta di cedar si salva e si rilegge; una voce inventata è ignorata', () => {
        expect(voce.voceScelta()).toBe('marin');
        voce.scegliVoce('cedar');
        expect(localStorage.getItem('dvai_voce_scelta_v1')).toBe('cedar');
        expect(voce.voceScelta()).toBe('cedar');
        voce.scegliVoce('alloy');
        expect(voce.voceScelta()).toBe('cedar');
    });
    it('storage bloccato: nessuna eccezione, vale marin', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloccato'); });
        expect(voce.voceScelta()).toBe('marin');
    });
    it('parlando attiva la Media Session (titolo, stato, pausa)', async () => {
        await voce.parla('Eccoci.', { titolo: 'Il racconto' });
        expect(navigator.mediaSession.metadata.title).toBe('Il racconto');
        expect(navigator.mediaSession.setActionHandler).toHaveBeenCalledWith('pause', expect.any(Function));
    });
});

describe('voce — una frase, una riga di registro', () => {
    it('audio arrivato ma riproduzione bloccata: una sola riga «browser» che ricorda cosa aveva risposto il server', async () => {
        AudioFinto.prototype.play = function () { return Promise.reject(new Error('NotAllowedError')); };
        await voce.parla('Eccoci qui.');
        expect(voce.registroVoce).toHaveLength(1);
        expect(voce.registroVoce[0]).toMatchObject({ sorgente: 'browser', server: 'nuova' });
    });
});

describe('voce — un annuncio che non interrompe', () => {
    it('«senzaInterrompere» aspetta la frase in corso invece di coprirla; senza il flag la copre', async () => {
        let sblocca; const lenta = new Promise(r => { sblocca = r; });
        let primaChiamata = true;
        fetch.mockImplementation(async (url, init) => {
            const dv = JSON.parse(init.body).dv; chiamate.push(dv);
            if (primaChiamata) { primaChiamata = false; await lenta; }
            return risposta(dv);
        });
        const arrivo = voce.parla('Una frase di arrivo.');
        const prossima = voce.parla('Si va verso Piazza Duomo.', { senzaInterrompere: true });
        await new Promise(r => setTimeout(r, 20));
        expect(chiamate.map(c => c.testo)).toEqual(['Una frase di arrivo.']); // la seconda aspetta
        sblocca();
        expect(await arrivo).toBe('nuova');
        expect(await prossima).toBe('nuova');
        expect(voce.registroVoce.map(r => r.testo)).toEqual(['Una frase di arrivo.', 'Si va verso Piazza Duomo.']);
    });
});
