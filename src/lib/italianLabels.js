/**
 * TESTI — quello che l'utente legge e' italiano, concordato e pulito.
 *
 * Funzioni pure, senza import di rete: etichette di tipo (dal TIPO PRINCIPALE di Google),
 * meteo, numeri con la loro parola, nomi.
 *
 * Regola unica per le etichette: un tipo senza traduzione NON ha etichetta. Mai la parola
 * inglese di Google a schermo.
 */

import { placeKind } from './placeKind';

// ─── Tipo principale → etichetta ────────────────────────────────────────────
export const TYPE_LABELS = {
    // pasti
    restaurant: 'ristorante', italian_restaurant: 'ristorante', pizza_restaurant: 'pizzeria',
    seafood_restaurant: 'ristorante di pesce', steak_house: 'ristorante', bistro: 'bistrot',
    mediterranean_restaurant: 'ristorante', sushi_restaurant: 'ristorante', fine_dining_restaurant: 'ristorante',
    meal_takeaway: 'cibo da asporto', sandwich_shop: 'paninoteca', deli: 'gastronomia',
    // da bere
    bar: 'bar', cocktail_bar: 'bar', lounge_bar: 'bar', sports_bar: 'bar', bar_and_grill: 'bar',
    wine_bar: 'enoteca', pub: 'birreria', irish_pub: 'birreria', brewpub: 'birreria', brewery: 'birrificio',
    cafe: 'caffè', coffee_shop: 'caffè', cafeteria: 'caffè', coffee_stand: 'caffè', coffee_roastery: 'torrefazione',
    tea_house: 'sala da tè', night_club: 'locale notturno',
    // dolci e forno
    bakery: 'forno', ice_cream_shop: 'gelateria', gelato_shop: 'gelateria',
    dessert_shop: 'pasticceria', pastry_shop: 'pasticceria', cake_shop: 'pasticceria', confectionery: 'pasticceria',
    chocolate_shop: 'cioccolateria',
    // cultura
    church: 'chiesa', place_of_worship: 'luogo di culto', mosque: 'moschea', synagogue: 'sinagoga', hindu_temple: 'tempio',
    museum: 'museo', art_museum: 'museo', history_museum: 'museo', art_gallery: 'galleria d’arte',
    monument: 'monumento', tourist_attraction: 'monumento', historical_landmark: 'monumento', cultural_landmark: 'monumento',
    historical_place: 'luogo storico', castle: 'castello', city_hall: 'palazzo comunale',
    library: 'biblioteca', university: 'università', cemetery: 'cimitero',
    performing_arts_theater: 'teatro', opera_house: 'teatro dell’opera', concert_hall: 'sala concerti',
    sculpture: 'scultura', statue: 'statua', bridge: 'ponte', observation_deck: 'punto panoramico',
    // aperto
    park: 'parco', city_park: 'parco', national_park: 'parco', state_park: 'parco', garden: 'giardino',
    botanical_garden: 'orto botanico', plaza: 'piazza', town_square: 'piazza', natural_feature: 'area naturale',
    beach: 'spiaggia', zoo: 'zoo', aquarium: 'acquario', amusement_park: 'parco divertimenti',
    // negozi e servizi
    store: 'negozio', clothing_store: 'negozio di abbigliamento', shoe_store: 'negozio di scarpe', book_store: 'libreria',
    jewelry_store: 'gioielleria', shopping_mall: 'centro commerciale', market: 'mercato', supermarket: 'supermercato',
    spa: 'centro benessere', wellness_center: 'centro benessere', lodging: 'albergo', hotel: 'albergo',
};

// Senza tipo principale (cache vecchie, ricerca vecchia): il tipo di posto che decide `placeKind`.
const KIND_LABELS = {
    museo: 'museo', chiesa: 'chiesa', pasto: 'ristorante', bar: 'bar', caffe: 'caffè', forno: 'forno',
    verde: 'parco', negozio: 'negozio', notte: 'locale notturno',
};

/**
 * L'etichetta di tipo di un posto, in italiano, dal TIPO PRINCIPALE; null se non c'e' una traduzione.
 * @param {{ primaryType?: string, primary_type?: string, types?: string[] }} place
 * @returns {string|null}
 */
export function typeLabelOf(place) {
    const pt = typeof (place?.primaryType ?? place?.primary_type) === 'string' ? (place.primaryType ?? place.primary_type).trim() : '';
    if (pt) return TYPE_LABELS[pt] || null;
    const types = Array.isArray(place?.types) ? place.types : [];
    const { kind } = placeKind({ types, primaryType: null });
    if (kind && KIND_LABELS[kind]) return KIND_LABELS[kind];
    if (types.some(t => ['monument', 'tourist_attraction', 'historical_landmark'].includes(t))) return 'monumento';
    return null;
}

/** Le categorie interne di una tappa (tourShape) a parole italiane; null se non c'e' una voce. */
export const CATEGORY_LABELS = { food: 'cibo', cultura: 'cultura', storia: 'storia', arte: 'arte', natura: 'natura', shopping: 'negozi', relax: 'benessere' };
export const categoryLabelOf = (category) => CATEGORY_LABELS[String(category || '').toLowerCase()] || null;

// ─── Meteo ──────────────────────────────────────────────────────────────────
const WEATHER = {
    sunny: { it: 'sereno', icon: '☀️' }, clear: { it: 'sereno', icon: '☀️' },
    cloudy: { it: 'nuvoloso', icon: '☁️' }, overcast: { it: 'coperto', icon: '☁️' },
    'partly cloudy': { it: 'poco nuvoloso', icon: '⛅' }, partly_cloudy: { it: 'poco nuvoloso', icon: '⛅' },
    rainy: { it: 'pioggia', icon: '🌧️' }, rain: { it: 'pioggia', icon: '🌧️' },
    stormy: { it: 'temporale', icon: '⛈️' }, thunderstorm: { it: 'temporale', icon: '⛈️' },
    snowy: { it: 'neve', icon: '❄️' }, snow: { it: 'neve', icon: '❄️' },
    foggy: { it: 'nebbia', icon: '🌫️' }, fog: { it: 'nebbia', icon: '🌫️' },
};
const ITALIAN_WEATHER = new Set(Object.values(WEATHER).map(w => w.it));

/** La condizione meteo in italiano ("sunny" → "sereno"); una voce gia' italiana resta; altrimenti null. */
export function weatherLabel(condition) {
    const c = String(condition || '').trim().toLowerCase();
    if (!c) return null;
    if (WEATHER[c]) return WEATHER[c].it;
    return ITALIAN_WEATHER.has(c) ? c : null;
}
export const weatherIconOf = (condition) => WEATHER[String(condition || '').trim().toLowerCase()]?.icon || null;

// ─── Numeri con la loro parola ──────────────────────────────────────────────
const UNITA = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici', 'quattordici',
    'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
const DECINE = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];
/** 0–99 in lettere ("20" → "venti", "45" → "quarantacinque"). Fuori scala: le cifre. */
export function numeroInParole(n) {
    if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
    if (n < 20) return UNITA[n];
    const d = DECINE[Math.floor(n / 10)];
    const u = n % 10;
    if (u === 0) return d;
    const base = (u === 1 || u === 8) ? d.slice(0, -1) : d; // ventuno, ventotto
    return u === 3 ? `${base}tré` : `${base}${UNITA[u]}`;
}

/** "un minuto" / "5 minuti": numero e parola concordati. */
export const minutiTesto = (n) => (n === 1 ? 'un minuto' : `${n} minuti`);
/** "venti minuti" (durata in lettere, come nelle frasi approvate). */
export const minutiInParole = (n) => `${n === 1 ? 'un' : numeroInParole(n)} ${n === 1 ? 'minuto' : 'minuti'}`;
/** "1 tappa programmata" / "3 tappe programmate". */
export const tappeProgrammate = (n) => `${n} ${n === 1 ? 'tappa programmata' : 'tappe programmate'}`;

// ─── Nomi ───────────────────────────────────────────────────────────────────
/** Iniziale maiuscola a ogni parola scritta tutta in minuscolo ("ivano" → "Ivano"); il resto non si tocca. */
export function capitalizeName(name) {
    const s = String(name || '').trim();
    if (!s) return s;
    return s.replace(/(^|[\s-])(\p{Ll})/gu, (_, sep, ch) => `${sep}${ch.toUpperCase()}`);
}

/** Via le barre rovesciate e i caratteri di escape rimasti nei nomi ("Verso \Catania" → "Verso Catania"). */
export function senzaEscape(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/\\+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/** Le 21:30 e' dove la sera diventa dopocena (minuti dalla mezzanotte). */
export const DOPOCENA_DA_MINUTI = 21 * 60 + 30;
/** Fino all'alba (le 6:00) l'orario e' ancora la sera di prima. */
export const ALBA_MINUTI = 6 * 60;
/** true se l'orario (minuti dalla mezzanotte di Roma) e' da dopocena: dalle 21:30 all'alba. */
export const isDopocenaClock = (minuti) => Number.isFinite(minuti) && (minuti >= DOPOCENA_DA_MINUTI || minuti < ALBA_MINUTI);
