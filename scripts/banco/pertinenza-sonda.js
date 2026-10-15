// GUARDIA-PERTINENZA — la SONDA: due righe nuove del grezzo senza toccare il motore.
//   · `senzaMomento`: i candidati del pool che nessun momento prende (come l'imbuto di diagnosi-borgo.giro.js): la funzione
//     vera `bucketCandidates` e' avvolta da vi.mock nel file del giro (esteso.live.js, replay.giro.js) e annota qui chi entra
//     e chi resta fuori. Il motore riceve sempre il risultato della funzione vera.
//   · `intento`: le query e la categoria del traduttore, lette dalla riga che il motore scrive gia' in console
//     («[Gate B] intent tradotto: queries=[…] categoria=…»): giro-caso.js cattura console.info durante la generazione.
// Solo registrazione: niente di qui entra nelle decisioni.

const idOf = (c) => c?.place_id || c?.googlePlaceId || null;
const nomeDi = (c) => c?.name || c?.title || c?.nome || null;

/** La sonda del caso in corso (si azzera a ogni caso). */
export function creaSonda() {
    return { visti: new Map(), inBucket: new Set(), chiamate: 0, chiamateTutte: 0, intento: null };
}

export const sonda = () => globalThis.__pertinenzaSonda || null;
export const azzeraSonda = () => { globalThis.__pertinenzaSonda = creaSonda(); return globalThis.__pertinenzaSonda; };

/**
 * Il modulo momentSelection con `bucketCandidates` avvolta: da usare nella factory di vi.mock del file del giro.
 * Le chiamate con `anyCategory` (la riserva «mai vuoto», che ignora le categorie) non contano come «preso da un momento».
 */
export function avvolgiMomentSelection(m) {
    return {
        ...m,
        bucketCandidates: (moments, candidates, o) => {
            const b = m.bucketCandidates(moments, candidates, o);
            const s = sonda();
            if (s) {
                s.chiamateTutte++;
                if (!o?.anyCategory) {
                    s.chiamate++;
                    for (const c of candidates || []) {
                        const id = idOf(c);
                        if (id && !s.visti.has(id)) s.visti.set(id, { place_id: id, nome: nomeDi(c), types: (c.types || []).slice(0, 5), primaryType: c.primaryType ?? c.primary_type ?? null });
                    }
                    for (const lista of b.values()) for (const c of lista) { const id = idOf(c); if (id) s.inBucket.add(id); }
                }
            }
            return b;
        },
    };
}

/** I candidati che nessun momento ha preso (null se la sonda non ha visto chiamate). */
export function senzaMomentoDellaSonda(s = sonda()) {
    if (!s || s.chiamate === 0) return null;
    return [...s.visti.values()].filter(c => !s.inBucket.has(c.place_id));
}

const RIGA_INTENTO = /\[Gate B\] intent tradotto: queries=(\[.*?\]) categoria=(\S+) oggetto="(.*?)" source=(\S+)/;

/** Legge l'intento del traduttore da una riga di console; null se non e' quella riga. */
export function leggiIntento(riga) {
    const m = RIGA_INTENTO.exec(String(riga || ''));
    if (!m) return null;
    let queries = [];
    try { queries = JSON.parse(m[1]); } catch { queries = []; }
    return { queries: Array.isArray(queries) ? queries.map(String) : [], categoria: m[2], oggetto: m[3], fonte: m[4] };
}

/** Esegue `fn` catturando console.info: la prima riga del traduttore finisce nella sonda come `intento`. */
export async function conIntento(fn) {
    const s = sonda();
    const info = console.info;
    console.info = (...a) => {
        try { const i = leggiIntento(a.map(String).join(' ')); if (i && s && !s.intento) s.intento = i; } catch { /* solo registrazione */ }
        return info.apply(console, a);
    };
    try { return await fn(); } finally { console.info = info; }
}
