/**
 * Gate Navigazione — Fase 1 (17/07) — Telemetria navigazione.
 *
 * Helper event-shaped per la tabella public.nav_events. NON riusa reportError
 * (errorReporting.js) che e' error-shaped (message/stack/error_type + dedup).
 * Qui gli eventi sono volutamente ripetibili, quindi ZERO dedup.
 *
 * Regola N9 (asticella): fire-and-forget. Un errore nella telemetria non deve
 * MAI disturbare la navigazione. try/catch a ogni livello, nessun await nel
 * path nav, nessun re-throw. Un crash nel report di un evento e' l'ultima cosa
 * da rendere fatale.
 *
 * Eventi Fase 1 (agganciati a punti gia' esistenti in MapPage):
 *  - nav_start     { tour_id, mode, context?:{gps_denied} }
 *  - step_reached  { tour_id, step_index }
 *  - nav_complete  { tour_id }
 *  - nav_abandon   { tour_id, step_index }   // step_index = tappa in cui si molla
 * (nav_offroute arrivera' con la Fase 6.)
 */

import { supabase } from './supabase.js';

/**
 * Registra un evento di navigazione. Fire-and-forget: risolve sempre, non
 * rigetta mai, non blocca la UI.
 *
 * @param {string} eventType - nav_start | step_reached | nav_complete | nav_abandon
 * @param {object} payload - { tour_id?, step_index?, mode?, ...context }
 *   I campi tour_id/step_index/mode finiscono nelle colonne dedicate; qualsiasi
 *   altra chiave (es. gps_denied) finisce in `context` JSONB.
 * @returns {Promise<void>}
 */
export async function logNavEvent(eventType, payload = {}) {
    try {
        if (!eventType) return;

        // Separa le colonne dedicate dal resto (che va in context JSONB).
        const { tour_id = null, step_index = null, mode = null, ...rest } = payload;
        const context = Object.keys(rest).length ? rest : null;

        // userId opzionale — getSession, come reportError. Non richiede sessione.
        let userId = null;
        try {
            const { data } = await supabase.auth.getSession();
            userId = data?.session?.user?.id ?? null;
        } catch { /* getSession puo' fallire: non blocchiamo l'evento */ }

        const row = {
            event_type: eventType,
            tour_id: tour_id != null ? String(tour_id) : null,
            step_index: Number.isFinite(step_index) ? step_index : null,
            mode: mode || null,
            user_id: userId,
            context,
        };

        // Fire-and-forget: NON await. Se Supabase e' irraggiungibile, l'errore
        // resta in console. La nav non deve mai accorgersi di un problema di
        // telemetria.
        supabase.from('nav_events').insert(row).then(({ error: e }) => {
            if (e) console.warn('[navTelemetry] insert failed:', e.message);
        });
    } catch (e) {
        // Ultima linea di difesa: log-and-swallow. Mai fatale.
        console.warn('[navTelemetry] exception:', String(e));
    }
}
