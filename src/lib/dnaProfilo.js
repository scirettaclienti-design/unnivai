/**
 * DNA-6 — cosa mostra il Profilo: il DNA in parole semplici (dai pesi del registro) e le Mete
 * (i giri completati, letti dal registro). Funzioni pure: niente rete, niente stato.
 */

import { CORE_CATEGORIES, normalizeCategory } from '../services/preferenceEngine.js';

/** Sotto questo peso una categoria non e' «forte»: non entra nella frase. */
export const DNA_SOGLIA_FORTE = 0.1;

/** I nomi delle categorie, come li legge l'utente. */
export const ETICHETTE_CATEGORIA = {
    cultura: 'Cultura e storia',
    food: 'Cibo',
    nightlife: 'Serate',
    natura: 'Natura',
    avventura: 'Avventura',
    shopping: 'Shopping',
    relax: 'Relax',
    arte: 'Arte',
};

/** Una frase per categoria, nello stile dell'app: un fatto, mai un aggettivo. */
const FRASE_CATEGORIA = {
    food: 'Ti fermi dove si mangia bene.',
    cultura: 'I musei li scegli con cura.',
    natura: 'Cerchi parchi, verde e aria aperta.',
    arte: 'Ti fermi davanti a gallerie e street art.',
    nightlife: 'La sera ti piace restare fuori.',
    avventura: 'Preferisci muoverti e fare qualcosa.',
    shopping: 'Ti fermi volentieri tra negozi e mercati.',
    relax: 'Ti prendi il tempo per un panorama o una pausa.',
};

const FRASE_RITMO = {
    lento: 'Preferisci un ritmo tranquillo.',
    medio: 'Preferisci un ritmo attivo.',
    veloce: 'Preferisci un ritmo intenso, con più tappe.',
};

const FRASE_COMPAGNIA = {
    solo: 'Di solito giri per conto tuo.',
    coppia: 'Di solito giri in coppia.',
    amici: 'Di solito giri con gli amici.',
    famiglia: 'Di solito giri in famiglia.',
};

/**
 * Le categorie piu' forti, dalla piu' alta. A parita' di peso vale l'ordine delle categorie di base.
 * @param {object} pesi - { cultura: 0.3, food: 0.4, … }
 * @returns {{ categoria: string, peso: number }[]}
 */
export function categorieForti(pesi = {}, { max = 3, soglia = DNA_SOGLIA_FORTE } = {}) {
    return CORE_CATEGORIES
        .map((categoria, i) => ({ categoria, peso: Number(pesi?.[categoria]) || 0, i }))
        .filter(c => c.peso >= soglia)
        .sort((a, b) => (b.peso - a.peso) || (a.i - b.i))
        .slice(0, max)
        .map(({ categoria, peso }) => ({ categoria, peso }));
}

/**
 * Il DNA in parole semplici. Le due categorie piu' forti; ritmo e compagnia solo se «suggeriti»
 * (almeno 3 scelte e il 60% dello stesso valore, DNA-2).
 * @param {object} pesi
 * @param {{ suggerito?: string|null }} [ritmo]
 * @param {{ suggerito?: string|null }} [compagnia]
 * @returns {{ frasi: string[], forti: {categoria: string, peso: number}[] }}
 */
export function fraseDna(pesi = {}, ritmo = null, compagnia = null) {
    const forti = categorieForti(pesi);
    const frasi = forti.slice(0, 2).map(c => FRASE_CATEGORIA[c.categoria]).filter(Boolean);
    if (ritmo?.suggerito && FRASE_RITMO[ritmo.suggerito]) frasi.push(FRASE_RITMO[ritmo.suggerito]);
    if (compagnia?.suggerito && FRASE_COMPAGNIA[compagnia.suggerito]) frasi.push(FRASE_COMPAGNIA[compagnia.suggerito]);
    return { frasi, forti };
}

// ─── Mete: i giri completati, dal registro ───────────────────────────────────

function senzaDoppioni(righe) {
    const visti = new Set();
    return (Array.isArray(righe) ? righe : []).filter(r => {
        if (!r || typeof r.kind !== 'string') return false;
        if (!r.id) return true;
        if (visti.has(r.id)) return false;
        visti.add(r.id);
        return true;
    });
}

/** Il totale delle tappe, scritto in `value` del giro completato come «raggiunte/totali» (es. «3/5»). */
function totaleDa(value) {
    const m = /^(\d{1,3})\/(\d{1,3})$/.exec(String(value || '').trim());
    return m ? { raggiunte: Number(m[1]), totali: Number(m[2]) } : null;
}

/**
 * Un elemento per ogni giro completato: citta', data, tappe raggiunte (e totali, se note), categorie.
 * Il registro ha una riga `tour_completed` per categoria: qui si riuniscono per giro.
 * @param {object[]} righe - le righe di dna_events
 * @returns {{ tourId: string|null, citta: string|null, data: string, categorie: string[], tappeRaggiunte: number, tappeTotali: number|null }[]}
 *          dal piu' recente
 */
export function meteDalRegistro(righe = []) {
    const tutte = senzaDoppioni(righe);
    const giri = new Map();
    for (const r of tutte) {
        if (r.kind !== 'tour_completed') continue;
        const chiave = r.tour_id ? `id:${r.tour_id}` : `ora:${r.created_at}`; // senza giro: le righe dello stesso istante sono lo stesso giro
        const g = giri.get(chiave) || { tourId: r.tour_id || null, citta: null, data: r.created_at, categorie: new Set(), tappeRaggiunte: 0, tappeTotali: null };
        if (!g.citta && r.city) g.citta = r.city;
        if (String(r.created_at) < String(g.data)) g.data = r.created_at;
        const c = normalizeCategory(r.category);
        if (c) g.categorie.add(c);
        const t = totaleDa(r.value);
        if (t) g.tappeTotali = Math.max(g.tappeTotali ?? 0, t.totali);
        giri.set(chiave, g);
    }
    for (const r of tutte) {
        if (r.kind !== 'stop_reached' || !r.tour_id) continue;
        const g = giri.get(`id:${r.tour_id}`);
        if (g) g.tappeRaggiunte += 1;
    }
    return [...giri.values()]
        .map(g => ({ ...g, categorie: [...g.categorie] }))
        .sort((a, b) => String(b.data).localeCompare(String(a.data)));
}

/**
 * I contatori dell'intestazione del Profilo, tutti dal registro.
 * @param {object[]} righe
 * @returns {{ giri: number, citta: number, tappe: number }}
 */
export function contatoriDalRegistro(righe = []) {
    const mete = meteDalRegistro(righe);
    const citta = new Set(mete.map(m => (m.citta || '').trim().toLowerCase()).filter(Boolean));
    const tappe = senzaDoppioni(righe).filter(r => r.kind === 'stop_reached').length;
    return { giri: mete.length, citta: citta.size, tappe };
}

/** «3 tappe raggiunte su 5» / «3 tappe raggiunte» / «1 tappa raggiunta». */
export function testoTappe(meta) {
    const n = meta?.tappeRaggiunte || 0;
    const base = n === 1 ? '1 tappa raggiunta' : `${n} tappe raggiunte`;
    return meta?.tappeTotali && meta.tappeTotali >= n ? `${base} su ${meta.tappeTotali}` : base;
}
