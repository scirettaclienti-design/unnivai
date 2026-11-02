/**
 * APP-NATIVA — il giro dimostrativo per il revisore Apple (solo l'account demo lo vede: demoRevisore.js).
 *
 * Cinque tappe vere del centro di Catania, tutte con il racconto già passato in `public.place_racconti`
 * (letto il 03/11/2026: Fontana dell'Elefante r5, Cattedrale di Sant'Agata r4, Porta Uzeda r6, Fontana dell'Amenano r6,
 * Castello Ursino r6): il revisore sente racconti dalla cache, nessuna scrittura nuova. Nomi, place_id, coordinate
 * e tipi dalla cache di Google (`public.places_cache`). Nessun testo inventato: le descrizioni le dà il racconto.
 *
 * `percorsoDemo` è la strada della posizione simulata (camminoSimulato.js): parte da via Etnea, ~250 m a nord di
 * piazza Duomo, passa da ogni tappa e finisce al Castello Ursino. Circa 940 m.
 */
export const ID_GIRO_DEMO = 'demo-revisore-catania';

const tappa = (id, title, place_id, lat, lng, types) => ({
    id, title, name: title, place_id, googlePlaceId: place_id,
    lat, lng, latitude: lat, longitude: lng,
    types, city: 'Catania', moment: 'mattina',
});

export const TAPPE_DEMO = Object.freeze([
    tappa('demo-elefante', "Fontana dell'Elefante", 'ChIJV63v_C7jExMRLThjTCcPppk', 37.5025169, 15.0870996, ['tourist_attraction', 'point_of_interest', 'establishment']),
    tappa('demo-cattedrale', "Cattedrale di Sant'Agata", 'ChIJP0UjWi7jExMRJytI986aC6g', 37.5024087, 15.0877191, ['church', 'place_of_worship', 'tourist_attraction', 'point_of_interest', 'establishment']),
    tappa('demo-uzeda', 'Porta Uzeda', 'ChIJ246EAS_jExMR__mpdyI1ULw', 37.5017967, 15.0876359, ['landmark', 'tourist_attraction', 'point_of_interest', 'establishment']),
    tappa('demo-amenano', "Fontana dell'Amenano", 'ChIJjfE4n-jjExMR0gwbhCQ0rk4', 37.5020407, 15.0870139, ['tourist_attraction', 'point_of_interest', 'establishment']),
    tappa('demo-ursino', 'Castello Ursino', 'ChIJH_LNACbjExMR3WPlQ82DyEw', 37.4991663, 15.0844932, ['castle', 'museum', 'historical_place', 'tourist_attraction', 'point_of_interest', 'establishment']),
]);

const [elefante, cattedrale, uzeda, amenano, ursino] = TAPPE_DEMO;

export const PERCORSO_DEMO = Object.freeze([
    { lat: 37.50500, lng: 15.08712 }, // via Etnea, partenza
    { lat: 37.50275, lng: 15.08712 }, // via Etnea all'ingresso di piazza Duomo
    { lat: elefante.lat, lng: elefante.lng },
    { lat: cattedrale.lat, lng: cattedrale.lng },
    { lat: uzeda.lat, lng: uzeda.lng },
    { lat: 37.50195, lng: 15.08735 }, // angolo sud-ovest di piazza Duomo
    { lat: amenano.lat, lng: amenano.lng },
    { lat: 37.50192, lng: 15.08660 }, // via Garibaldi
    { lat: 37.50176, lng: 15.08490 }, // piazza Mazzini
    { lat: 37.50030, lng: 15.08470 }, // verso il castello
    { lat: ursino.lat, lng: ursino.lng },
]);

export const GIRO_DEMO = Object.freeze({
    id: ID_GIRO_DEMO,
    title: 'Catania, centro storico',
    city: 'Catania',
    center: { latitude: 37.5021, longitude: 15.0862 },
    demoRevisore: true,
    steps: TAPPE_DEMO,
    percorsoDemo: PERCORSO_DEMO,
});
