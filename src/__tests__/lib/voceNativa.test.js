// APP-NATIVA — nell'app iOS la voce di ripiego la dice l'app (AVSpeechSynthesizer); sul web resta lo speechSynthesis.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
const cap = { nativo: false, plugin: true };
const nativa = { parla: vi.fn(), ferma: vi.fn() };
vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => cap.nativo, isPluginAvailable: (n) => cap.plugin && n === 'VoceNativa' },
    registerPlugin: () => nativa,
}));

let voce, parlatiBrowser;
beforeEach(async () => {
    vi.resetModules();
    cap.nativo = false; cap.plugin = true;
    parlatiBrowser = [];
    nativa.parla = vi.fn(async () => ({ detta: true }));
    nativa.ferma = vi.fn(async () => {});
    // senza configurazione la voce umana non parte: si va dritti al ripiego
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(t) { this.text = t; } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel: vi.fn(), speak: (u) => { parlatiBrowser.push(u.text); setTimeout(() => u.onend?.(), 0); } } });
    voce = await import('../../lib/voce.js');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('voce di ripiego', () => {
    it('web: parla lo speechSynthesis della pagina, il plugin nativo non si tocca', async () => {
        expect(await voce.parla('Si va verso Porta Uzeda.')).toBe('browser');
        expect(parlatiBrowser).toEqual(['Si va verso Porta Uzeda.']);
        expect(nativa.parla).not.toHaveBeenCalled();
        voce.fermaVoce();
        expect(nativa.ferma).not.toHaveBeenCalled();
    });

    it('app nativa: parla AVSpeechSynthesizer via plugin, non la pagina', async () => {
        cap.nativo = true;
        expect(await voce.parla('Si va verso Porta Uzeda.')).toBe('browser');
        expect(nativa.parla).toHaveBeenCalledWith({ testo: 'Si va verso Porta Uzeda.', lingua: 'it-IT', velocita: 0.95 });
        expect(parlatiBrowser).toEqual([]);
        expect(voce.registroVoce.at(-1)).toMatchObject({ sorgente: 'browser', testo: 'Si va verso Porta Uzeda.' });
    });

    it('app nativa: «ferma» e una frase nuova zittiscono anche la voce nativa', async () => {
        cap.nativo = true;
        voce.fermaVoce();
        expect(nativa.ferma).toHaveBeenCalledTimes(1);
        await voce.parla('Fermati qui.');
        expect(nativa.ferma).toHaveBeenCalledTimes(2);
    });

    it('app nativa con frase interrotta o plugin che sbaglia: «muto», mai un errore', async () => {
        cap.nativo = true;
        nativa.parla = vi.fn(async () => ({ detta: false }));
        expect(await voce.parla('Uno.')).toBe('muto');
        nativa.parla = vi.fn(async () => { throw new Error('rotto'); });
        expect(await voce.parla('Due.')).toBe('muto');
    });

    it('app costruita senza il plugin: si torna allo speechSynthesis', async () => {
        cap.nativo = true; cap.plugin = false;
        expect(await voce.parla('Tre.')).toBe('browser');
        expect(parlatiBrowser).toEqual(['Tre.']);
    });
});
