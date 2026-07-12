// Gate J2: DEMO_CITIES ridotto ai soli `center` (coord città reali).
// Prima conteneva anche `activities`, `tours`, `landmarks`, `experiences`
// con rating/prezzo/coord inventati mostrati come luoghi reali:
//   - `tours`: già uccisi da Gate D-4 nel fallback Explore, ma il payload
//     restava nel file
//   - `activities`: id fake tipo cat1, pal1, con description "Il mercato del
//     pesce storico" — spacciate come POI reali
//   - `landmarks`: monumenti hardcoded con coord inline
// La verifica ha mostrato che i consumatori (MapPage.jsx:264, Explore.jsx:35-36,
// AiItinerary.jsx:158, sim_itinerary.js:39) leggono SOLO `cityData.center` —
// nessuno accedeva più a tours/activities/landmarks. Il payload finto era
// solo peso morto pronto per rientrare per errore.
//
// `center` è un default tecnico coord (per centrare la mappa quando GPS/manual
// mancano). Non contenuto utente. Resta.
//
// MOCK_ROUTES: già uccise in Gate D-3.

export const ENABLE_DEMO_MODE = false;

export const DEMO_CITIES = {
    'Catania':   { center: { latitude: 37.5079, longitude: 15.0830 } },
    'Palermo':   { center: { latitude: 38.1157, longitude: 13.3615 } },
    'Roma':      { center: { latitude: 41.9028, longitude: 12.4964 } },
    'Milano':    { center: { latitude: 45.4642, longitude: 9.1900  } },
    'Firenze':   { center: { latitude: 43.7696, longitude: 11.2558 } },
    'Venezia':   { center: { latitude: 45.4408, longitude: 12.3155 } },
    'Napoli':    { center: { latitude: 40.8518, longitude: 14.2681 } },
    'Torino':    { center: { latitude: 45.0703, longitude: 7.6869  } },
    'Bologna':   { center: { latitude: 44.4949, longitude: 11.3426 } },
    'Genova':    { center: { latitude: 44.4056, longitude: 8.9463  } },
    'Bari':      { center: { latitude: 41.1177, longitude: 16.8719 } },
    'Verona':    { center: { latitude: 45.4384, longitude: 10.9916 } },
    'Trieste':   { center: { latitude: 45.6495, longitude: 13.7768 } },
    'Perugia':   { center: { latitude: 43.1122, longitude: 12.3888 } },
    'Cagliari':  { center: { latitude: 39.2238, longitude: 9.1217  } },
    'Padova':    { center: { latitude: 45.4064, longitude: 11.8768 } },
    'Brescia':   { center: { latitude: 45.5416, longitude: 10.2118 } },
    'Salerno':   { center: { latitude: 40.6824, longitude: 14.7681 } },
};
