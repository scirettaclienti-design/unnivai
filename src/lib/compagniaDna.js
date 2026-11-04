/**
 * DNA-5 — LA COMPAGNIA DEL DNA: da solo, in coppia, con bambini, con amici. Cambia il tipo di tappe e le soste per mangiare.
 *
 * ─── CHI VINCE ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 * il testo della richiesta («con i bambini») → la scelta di Crea (Gruppo) → il Profilo (compagnia impostata) → le scelte
 * passate (company_chosen: almeno 3 scelte e il 60% dello stesso valore, DNA-2). Senza nessuna di queste il giro e' quello di
 * sempre.
 *
 * ─── COSA CAMBIA (REGOLE_COMPAGNIA) ─────────────────────────────────────────────────────────────────────────────────────
 *   solo     — pasti da 60 minuti; nessuna spinta sui tipi.
 *   coppia   — la cena dura 90 minuti; spinta a belvedere e giardini.
 *   famiglia — pasti da 75; una MERENDA (gelateria, pasticceria, forno) nel pomeriggio; spinta a parchi, zoo, acquari, giochi;
 *              i bar e i locali da sera scendono in fondo; niente dopocena (regola di sempre di daySkeleton).
 *   amici    — la cena dura 90 minuti; spinta allo street food.
 * Le spinte si sommano al merito (come lo stile a tavola, P7b): non escludono nessuno, salvo i locali da sera per la famiglia in
 * Per Te (il pool dei temi li perde: un tour di Per Te non ha un momento del drink).
 *
 * Funzioni pure.
 */

import { placeKind } from './placeKind.js';

export const COMPAGNIE = ['solo', 'coppia', 'famiglia', 'amici'];

/** L'etichetta del Gruppo di Crea (la stessa che il motore e il prompt conoscono). */
export const GRUPPO_DI = { solo: 'Solo', coppia: 'Coppia', famiglia: 'Famiglia', amici: 'Amici' };

/** 'Solo' | 'In coppia' | 'Famiglia' | 'In famiglia' | 'Amici' | 'con amici'… → chiave, o null. */
export function compagniaDa(valore) {
    const v = String(valore || '').toLowerCase().trim();
    if (!v) return null;
    if (/famigl|bambin|figli/.test(v)) return 'famiglia';
    if (/coppia/.test(v)) return 'coppia';
    if (/amic/.test(v)) return 'amici';
    if (/^(solo|sola|da solo|da sola)$/.test(v)) return 'solo';
    return null;
}

const nel = (t, re) => re.test(t);
/** La compagnia scritta nella frase dell'utente, o null. A parola intera, minuscolo. */
export function compagniaDalTesto(testo) {
    const t = ` ${String(testo || '').toLowerCase().replace(/\s+/g, ' ')} `;
    if (nel(t, /\b(bambin[oiae]|figli[oae]?|bimb[oiae]|piccoli|passeggino|in famiglia|con la famiglia|famiglia)\b/)) return 'famiglia';
    if (nel(t, /\b(in coppia|con (la mia|il mio) (ragazz[ao]|fidanzat[ao]|moglie|marito|compagn[ao])|romantic[oa])\b/)) return 'coppia';
    if (nel(t, /\b(con (gli |degli |i miei |le mie |delle )?amic[ih]e?|tra amici|fra amici)\b/)) return 'amici';
    if (nel(t, /\b(da sol[oa]|per conto mio)\b/)) return 'solo';
    return null;
}

/**
 * La compagnia che guida QUESTO giro, con la sua fonte. null = nessuna fonte.
 * @param {{ testo?: string, scelta?: string|null, profilo?: string|null, scelte?: string|null }} p
 * @returns {{ valore: string, fonte: 'testo'|'richiesta'|'profilo'|'scelte', gruppo: string }|null}
 */
export function compagniaDelGiro({ testo = '', scelta = null, profilo = null, scelte = null, iniziale = null } = {}) {
    const dalTesto = compagniaDalTesto(testo);
    if (dalTesto) return { valore: dalTesto, fonte: 'testo', gruppo: GRUPPO_DI[dalTesto] };
    const daScelta = compagniaDa(scelta);
    if (daScelta) return { valore: daScelta, fonte: 'richiesta', gruppo: GRUPPO_DI[daScelta] };
    const daProfilo = compagniaDa(profilo);
    if (daProfilo) return { valore: daProfilo, fonte: 'profilo', gruppo: GRUPPO_DI[daProfilo] };
    // le scelte passate: il valore suggerito (stringa) o l'oggetto di pesiDaEventi ({ suggerito, conteggi, totale })
    const daScelte = compagniaDa(typeof scelte === 'string' ? scelte : scelte?.suggerito);
    if (daScelte) {
        const quante = scelte && typeof scelte === 'object' && scelte.totale ? { k: Number(scelte.conteggi?.[daScelte]) || 0, tot: scelte.totale } : null;
        return { valore: daScelte, fonte: 'scelte', gruppo: GRUPPO_DI[daScelte], ...(quante ? { quante } : {}) };
    }
    // ONBOARDING-ACCESSO — la compagnia detta al primo ingresso: ultima, vale finché le scelte vere non dicono altro.
    const daInizio = compagniaDa(iniziale);
    if (daInizio) return { valore: daInizio, fonte: 'primo ingresso', gruppo: GRUPPO_DI[daInizio] };
    return null;
}

/** Le regole, una riga per compagnia (minuti dei pasti; merenda; spinte per tipo di posto). */
export const REGOLE_COMPAGNIA = {
    solo: { sostaPasto: { pranzo: 60, cena: 60 }, merenda: false, spinte: {} },
    coppia: { sostaPasto: { pranzo: 75, cena: 90 }, merenda: false, spinte: { verde: 0.08, belvedere: 0.12 } },
    famiglia: { sostaPasto: { pranzo: 75, cena: 75 }, merenda: true, spinte: { verde: 0.15, giochi: 0.2, dolce: 0.1, bar: -0.3, notte: -0.4 } },
    amici: { sostaPasto: { pranzo: 75, cena: 90 }, merenda: false, spinte: { spuntino: 0.1 } },
};

const TIPI_GIOCHI = new Set(['amusement_park', 'zoo', 'aquarium', 'playground', 'amusement_center', 'water_park', 'childrens_camp']);
const tipiDi = (c) => (Array.isArray(c?.types) ? c.types : []).map(t => String(t).toLowerCase());

/** Il «tipo per la compagnia» di un posto: giochi, belvedere, o il tipo di posto (placeKind). */
export function tipoPerCompagnia(c) {
    const tipi = tipiDi(c);
    const primo = String(c?.primaryType || c?.primary_type || '').toLowerCase();
    if (TIPI_GIOCHI.has(primo) || tipi.some(t => TIPI_GIOCHI.has(t))) return 'giochi';
    if (tipi.includes('viewpoint') || tipi.includes('observation_deck') || /\bbelvedere\b/i.test(c?.name || c?.title || '')) return 'belvedere';
    return placeKind({ types: c?.types, primaryType: c?.primaryType ?? c?.primary_type }).kind;
}

/** La spinta della compagnia per un candidato (si somma al merito; 0 senza compagnia). */
export function bonusCompagnia(c, compagnia) {
    const regole = REGOLE_COMPAGNIA[compagnia];
    if (!regole) return 0;
    const tipo = tipoPerCompagnia(c);
    return Number(regole.spinte[tipo]) || 0;
}

/** Un posto che con questa compagnia non entra in un tour di Per Te (oggi: i locali da sera, con la famiglia). */
export const fuoriPerTe = (c, compagnia) => compagnia === 'famiglia' && ['bar', 'notte'].includes(tipoPerCompagnia(c));
