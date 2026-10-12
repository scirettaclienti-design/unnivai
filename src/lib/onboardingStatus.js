import { dataService } from '@/services/dataService';
import { parseSeed, buildSeed } from '@/lib/foodPrefs';

// ONB-1 — "onboarding fatto" e' un dato dell'ACCOUNT, non del browser.
//
// Fonte di verita': user_preferences.onboarding_seed (riga dell'utente, RLS
// proprietarie). NULL = mai fatto, [] = saltato di proposito, [...] o {v:2,...}
// = gusti dichiarati. Qualunque valore non-NULL vale "fatto".
//
// Il browser tiene solo una COPIA: il flag locale e' legato all'id utente (su un
// browser condiviso il flag di un altro account non vale) e serve a non aspettare
// la rete a ogni apertura. Se manca o e' stato svuotato, decide il DB.
export const ONBOARDING_FLAG_KEY = 'dvai_onboarding_done';
export const ONBOARDING_SEED_KEY = 'unnivai_onboarding_seed_v1';

const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* cache: il DB resta la fonte */ } };

// Corsia veloce: SOLO il flag legato a questo utente. Il "1" dei vecchi
// client non basta (non dice di chi sia): va confermato dal DB.
export const localOnboardingDone = (userId) => !!userId && safeGet(ONBOARDING_FLAG_KEY) === userId;

export const markOnboardingDone = (userId) => safeSet(ONBOARDING_FLAG_KEY, userId);

// Il flag locale dice "questo browser ha visto l'onboarding per questo utente"
// (id) oppure, nei client vecchi, "per qualcuno" ('1').
const localFlagClaimsDone = (userId) => {
    const f = safeGet(ONBOARDING_FLAG_KEY);
    return f === userId || f === '1';
};

// Seme in cache, normalizzato; null se assente o illeggibile.
const readLocalSeed = () => {
    const raw = safeGet(ONBOARDING_SEED_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        const p = parseSeed(parsed);
        if (!p) return null;
        // [] resta [] (saltato); la forma v2 si rinormalizza; la vecchia array di id si conserva.
        if (Array.isArray(parsed)) return parsed.filter(x => typeof x === 'string');
        return buildSeed({ interessi: p.interessi, dieta: p.vincoli.dieta, budget: p.vincoli.budget, stile: p.gusti.stile });
    } catch {
        return null;
    }
};

/**
 * @returns {Promise<'done'|'todo'|'unknown'>}
 *  - 'done'    → non mostrare MAI l'onboarding
 *  - 'todo'    → utente nuovo: mostrarlo (una volta)
 *  - 'unknown' → server irraggiungibile e nessuna copia: NON mostrarlo (rifarlo
 *                sovrascriverebbe i gusti di un utente che li ha gia' dati)
 */
export async function resolveOnboardingStatus(userId) {
    if (!userId) return 'unknown';
    try {
        const state = await dataService.getOnboardingState(userId);

        if (!state?.ok) {
            return localFlagClaimsDone(userId) ? 'done' : 'unknown';
        }

        // Il server dice "fatto": vince sempre. Il browser si riallinea (copia).
        if (state.seed !== null && state.seed !== undefined) {
            safeSet(ONBOARDING_SEED_KEY, JSON.stringify(state.seed));
            markOnboardingDone(userId);
            return 'done';
        }

        // Server vuoto. Se il browser ha dati validi di QUESTO utente (o di un client
        // vecchio, flag '1'), salgono sul server una volta sola, senza perdere niente.
        if (localFlagClaimsDone(userId)) {
            const seed = readLocalSeed() ?? [];
            const r = await dataService.upsertOnboardingSeed(userId, seed);
            // Se la scrittura fallisce NON si rimostra il wizard (l'utente l'ha gia'
            // fatto) e il flag resta com'e': al prossimo accesso riprova.
            if (r?.success) markOnboardingDone(userId);
            return 'done';
        }

        return 'todo';
    } catch {
        return localFlagClaimsDone(userId) ? 'done' : 'unknown';
    }
}
