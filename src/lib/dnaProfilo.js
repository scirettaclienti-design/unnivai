/**
 * DNA-6 — cosa mostra il Profilo: il DNA in parole semplici (dai pesi del registro) e le Mete
 * (i giri completati, letti dal registro). Funzioni pure: niente rete, niente stato.
 */

import { CORE_CATEGORIES, normalizeCategory } from '../services/preferenceEngine.js';
import { leggiValoreTappa } from './dnaRitmo.js';
import { FASCIA_SOGLIA_LIVELLO_1, FASCIA_SOGLIA_LIVELLO_2 } from './fasciaDna.js';

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

/** Le righe `tour_completed` di uno stesso giro nascono nello stesso istante: oltre questo intervallo lo stesso id e' un altro giro. */
const STESSO_GIRO_MS = 60_000;

const ms = (iso) => { const t = new Date(iso).getTime(); return Number.isFinite(t) ? t : 0; };

/**
 * Un elemento per ogni giro completato: citta', data, tappe raggiunte (e totali, se note), categorie.
 * Il registro ha una riga `tour_completed` per categoria: qui si riuniscono per giro. Lo stesso giro rifatto (un giro salvato
 * riaperto ha sempre lo stesso id) sono due Mete: le righe si separano per istante, e ogni tappa va al giro che l'ha chiusa.
 * @param {object[]} righe - le righe di dna_events
 * @returns {{ tourId: string|null, citta: string|null, data: string, categorie: string[], tappeRaggiunte: number, tappeTotali: number|null }[]}
 *          dal piu' recente
 */
export function meteDalRegistro(righe = []) {
    const tutte = senzaDoppioni(righe);
    const giri = [];
    const perChiave = new Map(); // chiave del giro → i suoi completamenti, dal primo
    const completati = tutte.filter(r => r.kind === 'tour_completed').sort((a, b) => ms(a.created_at) - ms(b.created_at));
    for (const r of completati) {
        const chiave = r.tour_id ? `id:${r.tour_id}` : `ora:${r.created_at}`; // senza giro: le righe dello stesso istante sono lo stesso giro
        const elenco = perChiave.get(chiave) || [];
        let g = elenco.at(-1);
        if (!g || ms(r.created_at) - ms(g.fine) > STESSO_GIRO_MS) {
            g = { tourId: r.tour_id || null, citta: null, data: r.created_at, fine: r.created_at, categorie: new Set(), tappeRaggiunte: 0, tappeTotali: null };
            elenco.push(g);
            giri.push(g);
            perChiave.set(chiave, elenco);
        }
        g.fine = r.created_at;
        if (!g.citta && r.city) g.citta = r.city;
        const c = normalizeCategory(r.category);
        if (c) g.categorie.add(c);
        const t = totaleDa(r.value);
        if (t) g.tappeTotali = Math.max(g.tappeTotali ?? 0, t.totali);
    }
    for (const r of tutte) {
        if (r.kind !== 'stop_reached' || !r.tour_id) continue;
        const elenco = perChiave.get(`id:${r.tour_id}`);
        if (!elenco) continue;
        const g = elenco.find(x => ms(r.created_at) <= ms(x.fine)) || elenco.at(-1);
        g.tappeRaggiunte += 1;
    }
    return giri
        .map(({ fine, ...g }) => ({ ...g, categorie: [...g.categorie] })) // eslint-disable-line no-unused-vars
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

// ─── Il DNA, da leggere ──────────────────────────────────────────────────────

/** Una parola per il peso: le stesse soglie della fascia di DNA (Per Te). */
export function livelloPeso(peso) {
    const p = Number(peso) || 0;
    if (p >= FASCIA_SOGLIA_LIVELLO_2) return 'forte';
    if (p >= FASCIA_SOGLIA_LIVELLO_1) return 'medio';
    return p > 0 ? 'leggero' : 'zero';
}

// ─── Risultati: quanto hai girato, dal registro ──────────────────────────────

/** Le soglie dei traguardi. Solo conteggi del registro: niente punti, niente livelli inventati. */
export const SOGLIE_TRAGUARDI = {
    giri: [1, 5, 10, 25, 50],
    citta: [1, 3, 5, 10],
    tappe: [5, 25, 50, 100, 250],
    km: [5, 25, 50, 100],
};

/** La voce di un conteggio: valore, soglie gia' passate, prossima soglia (null: finite) e da dove parte la barra. */
function voceRisultato(id, valore) {
    const soglie = SOGLIE_TRAGUARDI[id];
    const presi = soglie.filter(s => valore >= s);
    const prossimo = soglie.find(s => valore < s) ?? null;
    return { id, valore, presi, prossimo, base: presi.at(-1) ?? 0 };
}

/**
 * Risultati del Profilo: i contatori, i km fra le tappe raggiunte (dal `value` di stop_reached: le righe vecchie non li hanno),
 * le citta' dalla piu' girata e la categoria dove ti fermi di piu'.
 * @param {object[]} righe - le righe di dna_events
 * @returns {{ voci: object[], citta: {nome: string, giri: number}[], categoria: {categoria: string, tappe: number}|null, vuoto: boolean }}
 */
export function risultatiDalRegistro(righe = []) {
    const tappe = senzaDoppioni(righe).filter(r => r.kind === 'stop_reached');
    const { giri, citta: nCitta } = contatoriDalRegistro(righe);
    const km = Math.round(tappe.reduce((tot, r) => tot + (leggiValoreTappa(r.value).km ?? 0), 0) * 10) / 10;

    const perCitta = new Map();
    for (const m of meteDalRegistro(righe)) {
        const nome = (m.citta || '').trim();
        if (!nome) continue;
        const chiave = nome.toLowerCase();
        const c = perCitta.get(chiave) || { nome: nome[0].toLocaleUpperCase('it') + nome.slice(1), giri: 0 };
        c.giri += 1;
        perCitta.set(chiave, c);
    }
    const perCategoria = {};
    for (const r of tappe) {
        const c = normalizeCategory(r.category);
        if (c) perCategoria[c] = (perCategoria[c] || 0) + 1;
    }
    const top = CORE_CATEGORIES
        .map((categoria, i) => ({ categoria, tappe: perCategoria[categoria] || 0, i }))
        .filter(c => c.tappe > 0)
        .sort((a, b) => (b.tappe - a.tappe) || (a.i - b.i))[0];

    return {
        voci: [voceRisultato('giri', giri), voceRisultato('citta', nCitta), voceRisultato('tappe', tappe.length), voceRisultato('km', km)],
        citta: [...perCitta.values()].sort((a, b) => (b.giri - a.giri) || a.nome.localeCompare(b.nome, 'it')),
        categoria: top ? { categoria: top.categoria, tappe: top.tappe } : null,
        vuoto: giri === 0 && tappe.length === 0,
    };
}
