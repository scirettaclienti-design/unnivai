/**
 * T29 IMPOSTAZIONI-VERIFICA — I CHIP «INTERESSI» DI SU MISURA.
 *
 * Con una frase scritta i chip non arrivavano da nessuna parte: le ricerche seguivano solo la frase, il selettore non li leggeva e
 * il merito li guardava solo con un DNA forte. Il giro con Arte e quello con Natura erano lo stesso giro. Ora un chip:
 *   · spinge i posti del suo tipo nel merito e nel riparatore (`bonusInteressi`: si somma, non esclude nessuno);
 *   · si legge nel prompt del selettore;
 *   · fa UNA ricerca mirata, solo se dalla frase e dalla lista non e' arrivato quasi niente del suo tipo (`ricercheDegliInteressi`).
 *
 * I tipi sono precisi (il tipo principale di Google): Arte e Storia sono due chip, non «tutto cio' che e' cultura». Il cibo non ha
 * tipi di ristorante: pranzo e cena ci sono sempre, il chip premia i posti da assaggio (mercati, forni, pasticcerie). Il chip Vita
 * Notturna agisce gia' sullo scheletro (dopocena) e sui bar. Funzioni pure.
 */

export const BONUS_INTERESSE = 0.25;
/** Sotto questi posti del tipo giusto parte la ricerca mirata del chip. */
export const POSTI_MINIMI_INTERESSE = 2;
/** Al massimo due ricerche per generazione, come le ricerche mirate dei momenti. */
export const RICERCHE_INTERESSI_MAX = 2;

export const INTERESSI_CHIP = {
    arte: { tipi: ['art_museum', 'art_gallery', 'sculpture', 'cultural_center', 'performing_arts_theater', 'opera_house'],
        ricerca: { customQuery: "museo d'arte galleria", customKind: 'CULTURA' } },
    storia: { tipi: ['historical_landmark', 'history_museum', 'museum', 'castle', 'monument', 'archaeological_site', 'ruins', 'fortress', 'historical_place'],
        ricerca: { customQuery: 'sito storico monumento', customKind: 'CULTURA' } },
    natura: { tipi: ['park', 'city_park', 'garden', 'botanical_garden', 'national_park', 'natural_feature', 'hiking_area', 'beach', 'scenic_spot', 'observation_deck', 'viewpoint'],
        ricerca: { customQuery: 'parco giardino belvedere', customKind: 'NATURA' } },
    shopping: { tipi: ['market', 'store', 'clothing_store', 'shoe_store', 'shopping_mall', 'department_store', 'book_store', 'jewelry_store', 'gift_shop', 'food_store'],
        ricerca: { customQuery: 'negozi storici botteghe mercato', customKind: 'CULTURA' } },
    cibo: { tipi: ['market', 'food_store', 'bakery', 'pastry_shop', 'ice_cream_shop', 'cake_shop', 'confectionery', 'deli'],
        ricerca: { customQuery: 'mercato storico botteghe del gusto', customKind: 'FOOD' } },
    'vita notturna': { tipi: ['bar', 'cocktail_bar', 'wine_bar', 'pub', 'night_club', 'lounge_bar'], ricerca: null },
};

const chiave = (s) => String(s || '').toLowerCase().trim();

/** I chip scelti in Su misura (solo quelli che hanno un tipo di posto). In Al volo e in Sorprendimi non ce ne sono: decide la scelta o il tema. */
export function chipDegliInteressi(prefs, pathType) {
    if (pathType !== 'custom') return [];
    const scelti = Array.isArray(prefs?.interests) ? prefs.interests : [];
    return [...new Set(scelti.map(chiave))].filter(k => INTERESSI_CHIP[k]);
}

/**
 * Un posto e' del chip per il suo tipo principale; solo senza, per i tipi di Google. Google da' `museum` al Foro Romano e `store` a mezze
 * pasticcerie: con tutti i tipi un giro qualunque contava gia' come «Arte» e «Shopping» e il chip non cambiava niente.
 */
export const postoDelChip = (c, chip) => {
    const t = INTERESSI_CHIP[chip]?.tipi;
    if (!t) return false;
    const principale = c?.primaryType ?? c?.primary_type;
    return principale ? t.includes(principale) : (Array.isArray(c?.types) ? c.types : []).some(x => t.includes(x));
};

/** La spinta di un posto: una sola, anche se sta in due chip. */
export const bonusInteressi = (c, chip = []) => (chip.some(k => postoDelChip(c, k)) ? BONUS_INTERESSE : 0);

/** Le ricerche da fare: i chip con una ricerca propria che dalla frase e dalla lista hanno portato troppo poco. */
export function ricercheDegliInteressi(chip, posti) {
    const lista = Array.isArray(posti) ? posti : [];
    return chip
        .filter(k => INTERESSI_CHIP[k]?.ricerca && lista.filter(c => postoDelChip(c, k)).length < POSTI_MINIMI_INTERESSE)
        .slice(0, RICERCHE_INTERESSI_MAX)
        .map(k => ({ chip: k, ...INTERESSI_CHIP[k].ricerca }));
}

// ─── Il budget scelto nel modulo: la ricerca dei locali della sua fascia ───────────────────────────────────────────────────
// Le ricerche del cibo portano trattorie di fascia 2: con «Lusso» a Catania non c'era quasi niente da preferire. Una ricerca sola, solo se la
// fascia manca e solo per il budget del modulo (quello del primo accesso resta un tetto e una spinta).
export const LOCALI_MINIMI_FASCIA = 3;
export const RICERCA_BUDGET = {
    '€': { customQuery: 'trattoria economica cucina popolare', customKind: 'FOOD' },
    '€€€': { customQuery: 'ristorante raffinato alta cucina', customKind: 'FOOD' },
};

/** La ricerca del budget, o null. `nellaFascia(c)`: il posto e' un locale di quella fascia (lo decide chi chiama, con isMealPlace). */
export function ricercaDelBudget(fp, posti, nellaFascia) {
    if (fp?.budgetFonte !== 'wizard' || !RICERCA_BUDGET[fp.budget]) return null;
    const lista = Array.isArray(posti) ? posti : [];
    return lista.filter(nellaFascia).length < LOCALI_MINIMI_FASCIA ? { chip: `budget ${fp.budget}`, ...RICERCA_BUDGET[fp.budget] } : null;
}

// ─── Al volo: l'umore scelto conta piu' della lista della citta' ───────────────────────────────────────────────────────────
// Con le soste corte di Al volo (2 visite in una mattina) i posti «da locale» e le ancore riempivano tutto: Città e Storia a Catania erano
// lo stesso giro. I posti trovati dalla ricerca dell'umore (`_ricerca`) hanno la stessa spinta di un chip.
export const bonusUmore = (c) => (c?._ricerca ? BONUS_INTERESSE : 0);

/** La riga del prompt del selettore. */
export const rigaInteressi = (chip = []) => (chip.length ? `\n   • interessi scelti: ${chip.join(', ')}` : '');
