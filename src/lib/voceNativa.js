/**
 * APP-NATIVA — la voce del telefono detta dall'app (AVSpeechSynthesizer, ios/App/App/VoceNativaPlugin.swift).
 * Nell'app nativa sostituisce lo speechSynthesis della pagina come ripiego della voce umana (voce.js):
 * parla dal processo dell'app, che la posizione in background tiene vivo a schermo bloccato.
 * Sul web non si usa mai: `voceNativaDisponibile()` è falso.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { isAppNativa } from './appNativa';

export const NOME_PLUGIN_VOCE = 'VoceNativa';

let pluginVoce = null;
function plugin() {
    if (!pluginVoce) pluginVoce = registerPlugin(NOME_PLUGIN_VOCE);
    return pluginVoce;
}

export function voceNativaDisponibile() {
    if (!isAppNativa()) return false;
    try {
        return Capacitor.isPluginAvailable(NOME_PLUGIN_VOCE) === true;
    } catch {
        return false;
    }
}

/** Dice `testo` con la voce del telefono. Si risolve a fine frase: true se detta, false se interrotta o fallita. Mai lancia. */
export async function parlaNativa(testo, { lingua = 'it-IT', velocita = 0.95 } = {}) {
    try {
        const r = await plugin().parla({ testo, lingua, velocita });
        return r?.detta !== false;
    } catch {
        return false;
    }
}

export function fermaVoceNativa() {
    if (!voceNativaDisponibile()) return;
    try { plugin().ferma()?.catch?.(() => { /* niente */ }); } catch { /* niente */ }
}
