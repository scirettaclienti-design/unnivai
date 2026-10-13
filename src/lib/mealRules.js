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

/** C8a — un posto per la passeggiata fra il drink e la cena: all'aperto, mai un locale, un museo, una chiesa, un negozio. */
const NON_PASSEGGIATA = new Set(['museo', 'chiesa', 'negozio', 'servizi']);
export const isWalkPlace = (c) => {
    const k = kindOf(c);
    return !LOCALE.has(k) && !NON_PASSEGGIATA.has(k);
};

/**
 * C8a — un luogo all'aperto da camminarci attorno, oltre alle categorie dello scheletro (punti panoramici, passeggiata,
 * natura): una fontana, una porta storica, un ponte, una scalinata, una piazza che Google tipizza come monumento. Si
 * riconosce dal tipo (piazza, belvedere, sentiero, porto) o dal nome. Vale solo per la passeggiata: negli altri momenti
 * un monumento resta cultura.
 */
const TIPI_ALL_APERTO = new Set(['town_square', 'plaza', 'pedestrian_zone', 'scenic_spot', 'observation_deck', 'hiking_area', 'marina', 'beach', 'park', 'garden', 'natural_feature']);
const NOME_ALL_APERTO = /^(fontana|porta|ponte|scalinata|scalea|arco|largo|piazza|piazzale|molo|villa|giardin[oi]|parco|lungomare|lungarno|lungotevere|belvedere|terrazz[ae])\b/i;
export const isOutdoorWalk = (c) => {
    if (!isWalkPlace(c)) return false;
    const name = String(c?.name || c?.title || '').trim();
    const types = [c?.primaryType ?? c?.primary_type, ...(Array.isArray(c?.types) ? c.types : [])].filter(Boolean);
    return NOME_ALL_APERTO.test(name) || types.some(t => TIPI_ALL_APERTO.has(t));
};

/**
 * Il posto puo' stare in quel momento?
 * @param {object} candidate
 * @param {{ key: string, esplicito?: boolean }} moment un momento dello scheletro
 * @returns {boolean} false = tolto dal bucket del momento
 */
export function momentAdmits(candidate, moment) {
    // una richiesta esplicita di ristoranti per quel momento ("il pomeriggio nelle osterie") si rispetta
    if (!moment) return true;
    // C8a — la passeggiata fra il drink e la cena: mai un secondo bar, mai un ristorante, mai un locale
    if (moment.key === 'passeggiata') return isWalkPlace(candidate);
    if (moment.esplicitoPasti) return true;
    const key = moment.key;
    const k = kindOf(candidate);
    // pranzo e cena: un posto dove si mangia; un forno (colazione) no, salvo lo street food
    if (key === 'pranzo' || key === 'cena') return k !== 'forno' || !!moment.streetFood;
    if (key === 'mattina') return !LOCALE.has(k) || isBreakfastPlace(candidate);
    if (key === 'aperitivo') return k !== 'pasto' && k !== 'spuntino';
    // pomeriggio, dopocena: un posto dove ci si siede o si mangia da asporto non entra
    return k !== 'pasto' && k !== 'spuntino';
}

/**
 * C8b — LE STESSE REGOLE DI FASCIA DI CREA, PER "PER TE". Per Te non ha momenti: ogni tappa ha un orario di arrivo
 * (da adesso + soste + cammino) e li' valgono le fasce del banco (c1, c2, c3):
 *   · un ristorante (tipo principale) solo a pranzo (12:00–14:45) e a cena (19:30–23:00);
 *   · prima di mezzogiorno un locale e' una colazione (caffe', forno, dolce, bar semplice), non un pranzo ne' un cocktail bar;
 *   · un pasto veloce da asporto (spuntino) segue le fasce dei pasti.
 * @param {object} candidate un candidato o una tappa (tipo principale + types)
 * @param {number} minutes minuti dalla mezzanotte di Roma dell'arrivo
 * @returns {boolean}
 */
export const FASCIA_PRANZO_MIN = [12 * 60, 14 * 60 + 45];
export const FASCIA_CENA_MIN = [19 * 60 + 30, 23 * 60];
export function mealFitsClock(candidate, minutes) {
    if (!Number.isFinite(minutes)) return true;
    const k = kindOf(candidate);
    const inFascia = (f) => minutes >= f[0] && minutes <= f[1];
    const aTavola = inFascia(FASCIA_PRANZO_MIN) || inFascia(FASCIA_CENA_MIN);
    if (k === 'pasto' || k === 'spuntino') return aTavola;
    if (minutes < FASCIA_PRANZO_MIN[0] && LOCALE.has(k)) return isBreakfastPlace(candidate);
    return true;
}

/**
 * C8b — il motivo per cui un posto non va bene, in "Per Te", a quell'ora e con quelle tappe: fuori fascia, o un SECONDO pasto
 * seduto a meno di 3 ore dal primo (il "secondo pranzo" di c1). null = va bene.
 */
/**
 * C8c — UN DOLCE PER TOUR, E DOPO UN PASTO. Un dolce, un gelato, una pasticceria (tipo dolce, o un forno/dolce che si chiama
 * pasticceria/gelateria) sta al massimo una volta per tour e mai prima del pasto: a pranzo dopo un ristorante, di mattina dopo una
 * colazione (un caffe', un forno), dalla merenda (14:45) in poi quando il pranzo e' passato. Mai come prima tappa prima di pranzo.
 */
const NOME_DOLCE = /\b(pasticceri[ae]|gelateri[ae]|gelato|cioccolateri[ae])\b/i;
const TIPI_DOLCE = new Set(['ice_cream_shop', 'gelato_shop', 'pastry_shop', 'dessert_shop', 'cake_shop', 'confectionery', 'chocolate_shop', 'candy_store', 'donut_shop']);
export const isDolce = (c) => {
    const k = kindOf(c);
    if (k === 'dolce') return true;
    // un bar, un caffe' o un forno che e' anche gelateria/pasticceria (nome o tipi di Google) e' un dolce; un ristorante no
    if (k !== 'forno' && k !== 'caffe' && k !== 'bar') return false;
    const types = Array.isArray(c?.types) ? c.types : [];
    return NOME_DOLCE.test(String(c?.name || c?.title || '')) || types.some(t => TIPI_DOLCE.has(t));
};
export function dolceProblem(candidate, minutes, altre = []) {
    if (!isDolce(candidate)) return null;
    if (altre.some(o => isDolce(o.c))) return 'secondo dolce nello stesso tour';
    if (!Number.isFinite(minutes) || minutes >= FASCIA_PRANZO_MIN[1]) return null;
    const dopoPasto = minutes < FASCIA_PRANZO_MIN[0]
        ? altre.some(o => isBreakfastPlace(o.c) && !isDolce(o.c))
        : altre.some(o => kindOf(o.c) === 'pasto');
    return dopoPasto ? null : 'dolce prima del pasto';
}

/**
 * C8d — UNA TAPPA LEGGERA (il vuoto lungo con ritmo Rilassato): un luogo all'aperto, il verde, una chiesa, o un caffe' fuori dai pasti
 * (mai un dolce: regola C8c, mai un bar da drink). Un caffe' e' un posto con tipo caffe', o con `cafe`/`coffee_shop` fra i tipi di Google.
 */
export const isLightStop = (c) => {
    const k = kindOf(c);
    if (isOutdoorWalk(c) || k === 'verde' || k === 'chiesa') return true;
    if (isDolce(c)) return false;
    const types = Array.isArray(c?.types) ? c.types : [];
    return k === 'caffe' || types.includes('cafe') || types.includes('coffee_shop');
};

export const SECONDO_PASTO_MIN_ORE = 3;
export function perTeMealProblem(candidate, minutes, arrivo, altre = []) {
    if (!mealFitsClock(candidate, minutes)) return 'pasto fuori fascia';
    const dolce = dolceProblem(candidate, minutes, altre);
    if (dolce) return dolce;
    if (kindOf(candidate) === 'pasto') {
        const t = arrivo instanceof Date ? arrivo.getTime() : NaN;
        const vicino = altre.some(o => kindOf(o.c) === 'pasto' && Math.abs(o.arrivo.getTime() - t) < SECONDO_PASTO_MIN_ORE * 3600000);
        if (vicino) return 'secondo pasto seduto a meno di 3 ore dal primo';
    }
    return null;
}
