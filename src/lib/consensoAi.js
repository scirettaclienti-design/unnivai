/**
 * ACCOUNT-PRIVACY — il consenso all'uso di servizi AI di terzi (Apple 5.1.2(i)): una volta sola, PRIMA del primo invio di dati.
 *
 * Dove si ricorda (nessuna migrazione):
 *  - utente dentro (anche ospite/anonimo): `user_metadata.consenso_ai = { v, at }` su Supabase Auth, così vale su ogni telefono
 *    dello stesso account; in più una copia sul telefono legata all'id utente, per non dipendere dalla rete;
 *  - nessun utente: solo sul telefono (localStorage, chiave `dvai_consenso_ai_v1`, voce «dispositivo»).
 * Perché non una colonna: servirebbe una migrazione, e user_metadata c'è già ed è del solo utente (updateUser).
 * Versione: se cambia l'elenco dei servizi si alza `VERSIONE` e il consenso si richiede.
 *
 * Senza consenso le funzioni AI NON partono (nessuna richiesta di rete) e lo dicono: `assicuraConsensoAi()` risponde false
 * e riapre la schermata; i servizi lanciano `ConsensoAiError` (un AiEngineError con il testo giusto).
 */

import { supabase } from './supabase';
import { AiEngineError } from './aiEngineError';
import { CONSENSO_AI } from './testiAccount';

export const VERSIONE_CONSENSO = 1;
export const CHIAVE_CONSENSO = 'dvai_consenso_ai_v1';
export const EVENTO_CONSENSO_AI = 'dvai:consenso-ai';
const DISPOSITIVO = 'dispositivo';

/** Il consenso manca: la richiesta AI non è partita. Per la UI è un guasto «onesto» con il suo testo. */
export class ConsensoAiError extends AiEngineError {
    constructor() {
        super('consenso');
        this.name = 'ConsensoAiError';
        this.userMessage = CONSENSO_AI.SENZA;
        this.consenso = true;
    }
}
export const isConsensoAiError = (err) => err?.consenso === true;

function leggiLocale() {
    try {
        const v = JSON.parse(localStorage.getItem(CHIAVE_CONSENSO) || 'null');
        return v && typeof v === 'object' && v.chi && typeof v.chi === 'object' ? v : { chi: {} };
    } catch {
        return { chi: {} };
    }
}

/** @returns {boolean} true se questo utente (o questo telefono, senza utente) ha già detto sì alla versione attuale. */
export function haConsensoAi(user) {
    const meta = user?.user_metadata?.consenso_ai;
    if (meta && Number(meta.v) >= VERSIONE_CONSENSO) return true;
    const chi = leggiLocale().chi[user?.id ?? DISPOSITIVO];
    return !!chi && Number(chi.v) >= VERSIONE_CONSENSO;
}

/** Registra il «Va bene». Il telefono subito; l'account se c'è, senza bloccare se la rete non c'è. */
export async function daiConsensoAi(user) {
    const voce = { v: VERSIONE_CONSENSO, at: new Date().toISOString() };
    try {
        const locale = leggiLocale();
        locale.v = VERSIONE_CONSENSO;
        locale.chi[user?.id ?? DISPOSITIVO] = voce;
        localStorage.setItem(CHIAVE_CONSENSO, JSON.stringify(locale));
    } catch { /* storage ko: resta il solo account */ }
    if (user?.id) {
        try {
            await supabase.auth.updateUser({ data: { consenso_ai: voce } });
        } catch { /* niente rete: il consenso è comunque registrato sul telefono */ }
    }
    return voce;
}

/** Chiede alla schermata di aprirsi (la gestisce <ConsensoAi/> in App). */
export function chiediConsensoAi() {
    try { window.dispatchEvent(new CustomEvent(EVENTO_CONSENSO_AI)); } catch { /* niente finestra */ }
}

/** Il consenso c'è? Solo la risposta: non apre nulla (per le richieste di sfondo: racconti, voce, curiosità, lista della città). */
export async function consensoAiDato() {
    let user = null;
    try {
        const { data } = await supabase.auth.getSession();
        user = data?.session?.user ?? null;
    } catch { /* senza sessione vale il telefono */ }
    return haConsensoAi(user);
}

/**
 * Il cancello davanti a un invio di dati a un servizio AI di terzi nato da un gesto dell'utente (giro, chat).
 * @returns {Promise<boolean>} true = si può partire. false = non parte niente e la schermata si riapre.
 */
export async function assicuraConsensoAi() {
    if (await consensoAiDato()) return true;
    chiediConsensoAi();
    return false;
}

/** Come assicuraConsensoAi ma lancia: per i servizi che hanno già un percorso d'errore. */
export async function richiediConsensoAi() {
    if (!(await assicuraConsensoAi())) throw new ConsensoAiError();
}
