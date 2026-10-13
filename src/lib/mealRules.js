/**
 * C7 — UN PASTO PER FASCIA. Quali posti possono stare in quale momento.
 *
 * Regola (approvata da Ivano): un ristorante sta solo a pranzo e a cena. La
 * mattina un locale e' una colazione (caffe', bar, pasticceria, forno); l'aperitivo
 * e' un bar, un'enoteca, un cocktail bar — mai un ristorante; nel pomeriggio e dopo
 * cena un ristorante non entra. Il TIPO decide il tipo principale di Google
 * (placeKind.js), non l'unione dei types: un cocktail bar marcato anche
 * `restaurant` e' un bar.
 *
 * Eccezione: una richiesta ESPLICITA di ristoranti per quel momento ("il pomeriggio nelle
 * osterie") si rispetta (`esplicitoPasti`). Una richiesta di pasticceria o caffe' allarga il
 * momento ai locali (colazione, dolci) ma un ristorante resta fuori.
 *
 * Puro: niente rete.
 */

import { placeKind } from './placeKind';

/** I tipi "da locale" (dove si mangia o si beve). */
const LOCALE = new Set(['pasto', 'spuntino', 'bar', 'caffe', 'forno', 'dolce', 'notte']);
/** Tipo principale dei bar da colazione: il bar semplice, non il cocktail/wine bar/pub. */
const BAR_DA_COLAZIONE = new Set(['bar', 'cafe_bar']);

const kindOf = (c) => placeKind(c).kind;
const primaryOf = (c) => c?.primaryType ?? c?.primary_type ?? null;

/** Un posto dove ci si siede a mangiare: il tipo principale e' un ristorante. */
export const isSitDownMeal = (c) => kindOf(c) === 'pasto';

/** Un posto da colazione: caffe', forno, dolce, o un bar semplice. */
export function isBreakfastPlace(c) {
    const k = kindOf(c);
    if (k === 'caffe' || k === 'forno' || k === 'dolce') return true;
    if (k === 'bar') {
        const pt = primaryOf(c);
        // senza tipo principale (cache vecchie) un `bar` o un `cafe` nei types vale come bar da colazione
        return !pt || BAR_DA_COLAZIONE.has(pt);
    }
    return false;
}

/** Un posto da aperitivo: bar, enoteca, cocktail bar, caffe'; mai un ristorante. */
export const isAperitivoPlace = (c) => {
    const k = kindOf(c);
    return k === 'bar' || k === 'caffe' || k === 'notte' || k === 'dolce' || k === 'forno';
};

/** Un locale (dove si mangia o si beve), a prescindere da quale. */
export const isLocale = (c) => LOCALE.has(kindOf(c));

/**
 * Il posto puo' stare in quel momento?
 * @param {object} candidate
 * @param {{ key: string, esplicito?: boolean }} moment un momento dello scheletro
 * @returns {boolean} false = tolto dal bucket del momento
 */
export function momentAdmits(candidate, moment) {
    // una richiesta esplicita di ristoranti per quel momento ("il pomeriggio nelle osterie") si rispetta
    if (!moment || moment.esplicitoPasti) return true;
    const key = moment.key;
    const k = kindOf(candidate);
    // pranzo e cena: un posto dove si mangia; un forno (colazione) no, salvo lo street food
    if (key === 'pranzo' || key === 'cena') return k !== 'forno' || !!moment.streetFood;
    if (key === 'mattina') return !LOCALE.has(k) || isBreakfastPlace(candidate);
    if (key === 'aperitivo') return k !== 'pasto' && k !== 'spuntino';
    // pomeriggio, dopocena: un posto dove ci si siede o si mangia da asporto non entra
    return k !== 'pasto' && k !== 'spuntino';
}
