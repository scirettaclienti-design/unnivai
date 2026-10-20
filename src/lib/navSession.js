/**
 * NAV-1 — il giro in corso sopravvive a una ricarica e alla chiusura della scheda da parte di iOS.
 * Prima (NAV-DIAGNOSI, B2) lo stato della navigazione viveva solo in memoria: una ricarica lo cancellava.
 * Si salva in localStorage (resta anche se si riapre l'app dalla schermata Home): tour, tappe fatte, tappe saltate,
 * bersaglio, ora d'inizio. Un giro iniziato da più di 12 ore non si propone più (e si cancella).
 */
export const GIRO_KEY = 'dvai_nav_giro_v1';
export const GIRO_SCADENZA_MS = 12 * 60 * 60 * 1000;

const storage = () => { try { return globalThis.localStorage || null; } catch { return null; } };

/** L'identità di un tour: il suo id, o (senza id) le coordinate delle tappe. */
export function chiaveGiro(tourData) {
    const id = tourData?.id ?? tourData?.tourId;
    if (id != null && id !== '') return `id:${id}`;
    const steps = Array.isArray(tourData?.steps) ? tourData.steps : [];
    if (!steps.length) return null;
    return `tappe:${steps.map(s => `${Number(s.lat ?? s.latitude).toFixed(5)},${Number(s.lng ?? s.longitude).toFixed(5)}`).join('|')}`;
}

/** Il tour in una forma che si salva (niente funzioni né riferimenti circolari). */
const salvabile = (tourData) => {
    try { return JSON.parse(JSON.stringify(tourData)); } catch { return null; }
};

/**
 * Salva il giro in corso. Non lancia mai: la navigazione non si ferma per un salvataggio fallito.
 * @param {{ tourData, completedSteps: string[], skippedSteps?: string[], targetStepId?: string|null, singleTarget?: boolean, startedAt: number, mode?: string }} g
 */
export function salvaGiro(g, now = Date.now()) {
    const s = storage();
    const tour = salvabile(g?.tourData);
    const chiave = chiaveGiro(g?.tourData);
    if (!s || !tour || !chiave) return false;
    try {
        s.setItem(GIRO_KEY, JSON.stringify({
            v: 1, chiave, tourData: tour,
            completedSteps: [...(g.completedSteps || [])], skippedSteps: [...(g.skippedSteps || [])],
            targetStepId: g.targetStepId ?? null, singleTarget: !!g.singleTarget,
            startedAt: Number.isFinite(g.startedAt) ? g.startedAt : now, mode: g.mode || 'walking', savedAt: now,
        }));
        return true;
    } catch { return false; }
}

/** Il giro da riprendere, o null (nessuno, illeggibile, o iniziato da più di 12 ore: allora si cancella). */
export function leggiGiro(now = Date.now()) {
    const s = storage();
    if (!s) return null;
    let g = null;
    try { g = JSON.parse(s.getItem(GIRO_KEY) || 'null'); } catch { g = null; }
    if (!g || g.v !== 1 || !g.tourData || !Number.isFinite(g.startedAt)) return null;
    if (now - g.startedAt > GIRO_SCADENZA_MS) { chiudiGiro(); return null; }
    return g;
}

export function chiudiGiro() {
    try { storage()?.removeItem(GIRO_KEY); } catch { /* niente */ }
}

/** «tappa N di M» del giro salvato: N = la prima tappa non ancora fatta né saltata. */
export function puntoDelGiro(g) {
    const steps = Array.isArray(g?.tourData?.steps) ? g.tourData.steps : [];
    const m = steps.length;
    const gestite = (g?.completedSteps?.length || 0) + (g?.skippedSteps?.length || 0);
    return { n: Math.min(m, gestite + 1), m };
}

/**
 * NAV-1-FIX (D3): il centro della mappa alla riapertura con un giro in corso di QUESTO tour: la tappa da raggiungere
 * (la prima né fatta né saltata; in «Naviga» la tappa bersaglio), altrimenti la prima tappa. null se il giro salvato
 * è di un altro tour o non c'è: allora valgono le regole di sempre (src/lib/mapCenter.js), mai Roma.
 * Gli id delle tappe sono quelli della mappa: `s.id`, o `step-<indice>` (MapPage, activeRoute).
 * @returns {{ latitude: number, longitude: number }|null}
 */
export function centroDelGiro(g, tourData) {
    if (!g || !tourData || g.chiave !== chiaveGiro(tourData)) return null;
    const steps = Array.isArray(tourData.steps) ? tourData.steps : [];
    const punti = steps.map((s, i) => ({
        id: s.id || `step-${i}`,
        latitude: parseFloat(s.lat ?? s.latitude),
        longitude: parseFloat(s.lng ?? s.longitude),
    })).filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    if (!punti.length) return null;
    const gestite = new Set([...(g.completedSteps || []), ...(g.skippedSteps || [])]);
    const bersaglio = g.targetStepId ? punti.find(p => p.id === g.targetStepId && !gestite.has(p.id)) : null;
    const p = bersaglio || punti.find(x => !gestite.has(x.id)) || punti[0];
    return { latitude: p.latitude, longitude: p.longitude };
}
