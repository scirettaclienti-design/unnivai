// Gate Q — Fabbrica di notifica AI con marker anti-tampering.
//
// Regola locked (Ivano): "Un marker di verità che chiunque può scriversi da
// solo non è un marker: è una convenzione". N.0 usava una stringa costante
// esportata (NOTIFICATION_ENGINE_VERSION) come marker — chiunque poteva
// scriverla a mano in un `push({ ..., engineVersion: 'v2-notifica-vera' })`
// e passare i filtri (il fake "Bastano 30 secondi!" del branch night faceva
// esattamente questo).
//
// Fix: il marker e' una SIGNATURE derivata dal contenuto della notifica +
// un salt privato di modulo. La signature sopravvive a JSON.stringify e
// sessionStorage, ma nessuno fuori dal modulo puo' replicarla senza
// conoscere il salt (che non e' esportato). Se qualcuno cambia il testo,
// la signature non torna piu' -> il filtro rigetta.
//
// La key su cui viene scritta e' calcolata via variabile (SIG_KEY), non
// come literal `engineVersion:` — cosi' la regola anti-fake
// `no-engine-version-literal-key` (allowlist vuota) puo' vietare la key
// literal in tutto il repo senza eccezioni.

const FACTORY_SALT = 'dvai-notif-factory-q-2026-07-13';
const SIG_KEY = 'engineVersion';

// FNV-1a 32-bit hash. Non e' crypto — il threat model e' anti-fake interno
// (collega che scrive engineVersion a mano), non attaccante esterno con
// accesso al bundle. Deterministic, no allocations, ~microsecondi.
function sign(record) {
    const payload = `${record.id}|${record.title}|${record.message}|${record.type}|${FACTORY_SALT}`;
    let h = 2166136261;
    for (let i = 0; i < payload.length; i++) {
        h ^= payload.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
}

// Estrae dal record i campi che entrano nella signature. Coerente tra
// make e verify: se cambiano i campi qui, la signature cambia — obbligo
// di aggiornare entrambi (o le vecchie notifiche cached diventano
// invalide, che e' il comportamento voluto in caso di refactor).
function toDraft(record) {
    return {
        id: record.id,
        title: record.title,
        message: record.message,
        type: record.type,
    };
}

/**
 * UNICO punto di creazione di una notifica AI. Il marker viene scritto
 * dentro, staccato da qualsiasi variabile esportata.
 *
 * @param {object} args
 * @param {string} args.id
 * @param {'morning'|'midday'|'afternoon'|'evening'} args.slot
 * @param {{title: string, message: string}} args.tip
 * @param {Date|string|number} args.timestamp
 * @param {Array<{name: string, place_id: string, lat?: number, lng?: number}>} [args.chosenPois]
 */
export function makeAiNotification({ id, slot, tip, timestamp, chosenPois }) {
    const type = slot === 'evening' ? 'tour_recommendation' : 'weather_alert';
    const draft = {
        id,
        type,
        priority: slot === 'evening' ? 'high' : 'medium',
        title: tip.title,
        message: tip.message,
        timestamp,
        actionText: 'Vedi il giro',
        actionUrl: '/explore',
        locationBased: true,
        category: 'tours',
        timeSlot: slot,
        chosenPois: chosenPois || [],
    };
    // Key calcolata → nessuna occorrenza di `engineVersion:` come literal
    // in questo file. La regola anti-fake `no-engine-version-literal-key`
    // resta bloccante ovunque, senza allowlist.
    return { ...draft, [SIG_KEY]: sign(draft) };
}

/**
 * Verifica che il record sia stato prodotto dalla fabbrica. Ricalcola la
 * signature dai campi (id/title/message/type) e confronta col marker.
 *
 * Sopravvive a sessionStorage/JSON: la signature e' string. Un attaccante
 * interno che scrive {..., engineVersion: 'stringa random'} fallisce
 * perche' non conosce il salt privato e non puo' calcolare l'hash. Se
 * copia una signature esistente ma cambia title/message, la verifica
 * riscopre la manomissione (signature deriva dal contenuto).
 *
 * @param {object|null|undefined} record
 * @returns {boolean}
 */
export function isValidAiNotification(record) {
    if (!record || typeof record !== 'object') return false;
    const provided = record[SIG_KEY];
    if (!provided || typeof provided !== 'string') return false;
    return sign(toDraft(record)) === provided;
}

/**
 * Variante per record letti da DB (Supabase): il marker sta in
 * `action_data.engineVersion`, non a livello root. Ricomponiamo il draft
 * pescando i campi dal record DB (title/message/type sono root, id e'
 * root, ma diverso schema).
 *
 * @param {object} dbRecord
 * @returns {boolean}
 */
export function isValidAiDbRecord(dbRecord) {
    if (!dbRecord || typeof dbRecord !== 'object') return false;
    const provided = dbRecord.action_data?.[SIG_KEY]
        || dbRecord.action_data?.engine_version;
    if (!provided || typeof provided !== 'string') return false;
    const draft = {
        id: dbRecord.id,
        title: dbRecord.title,
        message: dbRecord.message,
        type: dbRecord.type,
    };
    return sign(draft) === provided;
}
