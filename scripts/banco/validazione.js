// BANCO-ESTESO — la validazione dei controlli, prima di usarli.
// Ogni controllo deve dare ROSSO su un esempio cattivo noto e VERDE su uno buono.
// Gli esempi cattivi sono i casi del telefono del 12/10 (D-CATANIA) dove esistono;
// per le classi 1, 9 e 10 l'esempio cattivo è costruito (marcato "costruito").
// Se un controllo non vede il suo caso cattivo è sbagliato: si corregge prima del giro.
import { CONTROLLI, c9 } from './controlli.js';
import { giornataSemaforo } from './misure.js';

const G = '2026-10-14'; // mercoledì
const at = (hhmm) => `${G}T${hhmm}:00+02:00`;
const st = (title, o = {}) => ({ place_id: `id-${title}`, title, types: ['tourist_attraction'], moment: 'pomeriggio', at: null, stay: 30, pasto: false,
    description: 'Passi da qui senza fretta.', tempoLibero: false, ripiego: null, scelta: 'modello', dietaCercata: null, dietaSolo: false, ...o });
const caso = (stops, o = {}) => ({ id: 'x', modo: 'crea', tipo: 'itinerario', luogo: 'Catania', ora: '09:30', oggi: G, tourDate: G, richiesta: 'Una giornata a Catania',
    vincoli: null, schermo: { giorni: [], note: [] }, ripiegoDichiarato: false, orari: {}, tours: [{ stops }], ...o });
const orari = (id, periods) => ({ [id]: { periods, chiamato: true } });
// mer 18:00–00:00 (come la Casbah del Moro: mai aperta di mattina)
const SOLO_SERA = [3, 4, 5, 6].map(d => ({ open: { day: d, time: '1800' }, close: { day: d === 6 ? 0 : d + 1, time: '0000' } }));
const GIORNO = [0, 1, 2, 3, 4, 5, 6].map(d => ({ open: { day: d, time: '0600' }, close: { day: d, time: '2000' } }));

const quattro = [
    st('Castello Ursino', { types: ['museum'], moment: 'mattina', at: at('09:30'), stay: 60 }),
    st('Trattoria del Duomo', { types: ['restaurant', 'food'], moment: 'pranzo', at: at('12:30'), stay: 75, pasto: true }),
    st('Villa Bellini', { types: ['park'], moment: 'pomeriggio', at: at('15:00'), stay: 30 }),
    st('Osteria Antica', { types: ['restaurant', 'food'], moment: 'cena', at: at('20:00'), stay: 75, pasto: true }),
];

/** [classe, cattivo, buono] — ognuno { nome, origine, caso, atteso (testo) }. */
export const ESEMPI = {
    c1: {
        cattivo: { nome: 'pranzo doppio: trattoria 12:30 e un\'altra alle 14:30; pizzeria alle 16:10', origine: 'telefono 12/10 (la trattoria alle 14:30 dopo il pranzo) + costruito (16:10)',
            caso: caso([
                st('Trattoria Sorano', { types: ['restaurant'], moment: 'pranzo', at: at('12:30'), stay: 75, pasto: true }),
                st('Trattoria del Duomo', { types: ['restaurant'], moment: 'pomeriggio', at: at('14:30'), stay: 75, pasto: true }),
                st('Pizzeria Etna', { types: ['restaurant'], moment: 'pomeriggio', at: at('16:10'), stay: 75, pasto: true }),
            ]) },
        // C8c — un dolce per tour, e dopo un pasto: il tour cibo di Per Te Catania 13:00 (gelato → trattoria → gelato)
        cattivo2: { nome: 'C8c — gelato alle 13:00 (prima tappa), trattoria alle 13:26, un altro gelato alle 14:55', origine: 'misura del 14/10 (perte-catania-1300, tour cibo)',
            caso: caso([
                st('Gelateria e Pasticceria Blu Notte', { types: ['ice_cream_shop', 'food'], primaryType: 'ice_cream_shop', moment: null, at: at('13:00'), stay: 20 }),
                st('Trattoria Giglio Rosso', { types: ['restaurant', 'food'], primaryType: 'italian_restaurant', moment: null, at: at('13:26'), stay: 75, pasto: true }),
                st('Gelateria Pellegrino', { types: ['ice_cream_shop', 'food'], primaryType: 'ice_cream_shop', moment: null, at: at('14:55'), stay: 20 }),
            ], { modo: 'perte', tipo: 'tour' }) },
        buono7: { nome: 'C8c — trattoria alle 13:00, un gelato alle 14:25, un caffè alle 14:50', caso: caso([
            st('Trattoria Giglio Rosso', { types: ['restaurant', 'food'], primaryType: 'italian_restaurant', moment: null, at: at('13:00'), stay: 75, pasto: true }),
            st('Gelateria Pellegrino', { types: ['ice_cream_shop', 'food'], primaryType: 'ice_cream_shop', moment: null, at: at('14:25'), stay: 20 }),
            st('Caffetteria Roma', { types: ['cafe', 'food'], primaryType: 'cafe', moment: null, at: at('14:50'), stay: 20 }),
        ], { modo: 'perte', tipo: 'tour' }) },
        buono8: { nome: 'C8d — «con colazione» alle 8:00: la pasticceria e\' la colazione (prima tappa), poi una visita', caso: caso([
            st('Pasticceria Giuffrida', { types: ['bakery', 'food'], primaryType: 'bakery', moment: 'mattina', at: at('08:00'), stay: 20 }),
            st('Porta Uzeda', { types: ['tourist_attraction'], moment: 'mattina', at: at('08:24'), stay: 30 }),
        ], { richiesta: 'Una giornata a Catania con colazione' }) },
        // TESTI — c1 non conta come dolce un bar scelto per l'aperitivo o il drink (Bar Sgroi, C8e); un dolce vero resta un dolce
        cattivo5: { nome: 'TESTI — un gelato vero PRIMA del pasto: gelateria alle 11:00 (prima tappa), trattoria alle 12:30', origine: 'costruito (stessa forma di cattivo2, in Crea)',
            caso: caso([
                st('Gelateria Pellegrino', { types: ['ice_cream_shop', 'food'], primaryType: 'ice_cream_shop', moment: 'mattina', at: at('11:00'), stay: 20 }),
                st('Trattoria Sorano', { types: ['restaurant', 'food'], primaryType: 'italian_restaurant', moment: 'pranzo', at: at('12:30'), stay: 75, pasto: true }),
            ], { richiesta: 'Una giornata a Catania', ora: '11:00' }) },
        cattivo6: { nome: 'TESTI — un secondo dolce VERO all\'aperitivo: pasticceria alla colazione, poi una gelateria (primaryType ice_cream_shop) alle 19:00', origine: 'costruito',
            caso: caso([
                st('Pasticceria Giuffrida', { types: ['bakery', 'food'], primaryType: 'bakery', moment: 'mattina', at: at('08:00'), stay: 20 }),
                st('Trattoria Sorano', { types: ['restaurant', 'food'], primaryType: 'italian_restaurant', moment: 'pranzo', at: at('12:30'), stay: 75, pasto: true }),
                st('Gelateria Pellegrino', { types: ['ice_cream_shop', 'food'], primaryType: 'ice_cream_shop', moment: 'aperitivo', at: at('19:00'), stay: 45 }),
            ], { richiesta: 'Una giornata a Catania con colazione', ora: '08:00' }) },
        buono6: { nome: 'TESTI — Bar Sgroi (primaryType bar, cake_shop tra i types) all\'aperitivo, dopo la colazione in pasticceria: non è un secondo dolce', origine: 'C8e (crea-catania-colazione-0800)',
            caso: caso([
                st('Pasticceria Giuffrida', { types: ['bakery', 'food'], primaryType: 'bakery', moment: 'mattina', at: at('08:00'), stay: 20 }),
                st('Trattoria Sorano', { types: ['restaurant', 'food'], primaryType: 'italian_restaurant', moment: 'pranzo', at: at('12:30'), stay: 75, pasto: true }),
                st('Bar Sgroi', { types: ['bar', 'cake_shop', 'bakery', 'food_store', 'food', 'establishment'], primaryType: 'bar', moment: 'aperitivo', at: at('19:00'), stay: 45 }),
            ], { richiesta: 'Una giornata a Catania con colazione', ora: '08:00' }) },
        buono9: { nome: 'C8c — merenda delle 16:00: una pasticceria per prima (il pranzo e\' passato)', caso: caso([
            st('Pasticceria Savia', { types: ['bakery', 'food'], primaryType: 'bakery', moment: null, at: at('16:00'), stay: 20 }),
            st('Caffetteria Roma', { types: ['cafe', 'food'], primaryType: 'cafe', moment: null, at: at('16:30'), stay: 20 }),
        ], { modo: 'perte', tipo: 'tour' }) },
        buono: { nome: 'pranzo 13:00 e cena 20:30', caso: caso([
            st('Trattoria Sorano', { types: ['restaurant'], moment: 'pranzo', at: at('13:00'), stay: 75, pasto: true }),
            st('Osteria Antica', { types: ['restaurant'], moment: 'cena', at: at('20:30'), stay: 75, pasto: true }),
        ]) },
        // C7 — SOGLIA CORRETTA 1: il tipo principale decide cosa e' un pasto. Bar Popolare (cocktail_bar, con `restaurant` tra i types)
        // all'aperitivo delle 18:00 era contato come "pasto fuori fascia": e' un bar. Origine: giro CONTINUITA', sorprendimi-catania-pomeriggio.
        buono2: { nome: 'cocktail bar marcato anche restaurant all\'aperitivo 18:00 (Bar Popolare): un bar, non un pasto', caso: caso([
            st('Bar Popolare', { types: ['cocktail_bar', 'bar', 'restaurant', 'food'], primaryType: 'cocktail_bar', moment: 'aperitivo', at: at('18:00'), stay: 20, pasto: true }),
            st('Trattoria Sorano', { types: ['restaurant'], primaryType: 'italian_restaurant', moment: 'cena', at: at('20:00'), stay: 75, pasto: true }),
        ]) },
        // C7 — SOGLIA CORRETTA 2: un ristorante in un momento che il testo chiede esplicitamente non e' un errore
        // ("Un pomeriggio a Bologna tra portici e osterie", osteria alle 15:00). Origine: giro CONTINUITA', crea-bologna-pomeriggio.
        buono3: { nome: 'osteria alle 15:00 con la richiesta "un pomeriggio tra portici e osterie"', caso: caso([
            st('Osteria Angolo degli Orefici', { types: ['bistro', 'italian_restaurant'], primaryType: 'bistro', moment: 'pomeriggio', at: at('15:00'), stay: 75, pasto: true }),
        ], { richiesta: 'Un pomeriggio a Bologna tra portici e osterie' }) },
        // C8b — Per Te rientra in c1 (gli orari d'arrivo sono stimati): era una soglia corretta in C7, ora e' una regola.
        cattivo3: { nome: 'C8b — Per Te gastronomico: osterie alle 10:00, 11:41 e 13:13 (orari stimati)', origine: 'giro CONTINUITA\' / C7 (perte-roma-1000: Osteria Pizzeria Come Va?, Osteria Sonnino)',
            caso: caso([
                st('Osteria Pizzeria Come Va?', { types: ['italian_restaurant'], primaryType: 'italian_restaurant', moment: null, at: at('10:00'), stay: 75, pasto: true }),
                st('Osteria Sonnino', { types: ['restaurant'], primaryType: 'restaurant', moment: null, at: at('11:41'), stay: 75, pasto: true }),
            ], { tipo: 'perte', modo: 'perte' }) },
        buono4: { nome: 'C8b — Per Te di mattina: colazioni in caffe\' e forni; un\'osteria solo a pranzo (13:00)', caso: caso([
            st('Caffè Centrale', { types: ['cafe'], primaryType: 'cafe', moment: 'mattina', at: at('08:30'), stay: 20 }),
            st('Forno Antico', { types: ['bakery'], primaryType: 'bakery', moment: 'mattina', at: at('09:00'), stay: 20 }),
            st('Osteria Sonnino', { types: ['restaurant'], primaryType: 'restaurant', moment: null, at: at('13:00'), stay: 75, pasto: true }),
        ], { tipo: 'perte', modo: 'perte' }) },
    },
    c2: {
        cattivo: { nome: 'trattoria alle 14:30 (pomeriggio) con richiesta "ristoranti tipici" e un ristorante alle 9:30', origine: 'telefono 12/10',
            caso: caso([
                st('Trattoria del Duomo', { types: ['restaurant'], moment: 'pomeriggio', at: at('14:30'), stay: 75, pasto: true }),
                st('Trattoria Sorano', { types: ['restaurant'], moment: 'mattina', at: at('09:30'), stay: 75, pasto: true }),
            ], { richiesta: 'Vorrei vivere un giorno da catanese, nei ristoranti tipici' }) },
        cattivo2: { nome: 'C7 — un ristorante all\'aperitivo (18:00) e uno al dopocena (22:45)', origine: 'giro CONTINUITA\' (crea-bologna-pomeriggio: Trattoria del Tempo Buono all\'aperitivo; crea-milano-sera: The Roof Milano al dopocena)',
            caso: caso([
                st('Trattoria del Tempo Buono', { types: ['italian_restaurant'], primaryType: 'italian_restaurant', moment: 'aperitivo', at: at('18:00'), stay: 75, pasto: true }),
                st('The Roof Milano', { types: ['restaurant', 'lounge_bar', 'night_club'], primaryType: 'restaurant', moment: 'dopocena', at: at('22:45'), stay: 75, pasto: true }),
            ], { richiesta: 'Una giornata a Bologna' }) },
        buono: { nome: 'ristorante a pranzo; la merenda richiesta nel pomeriggio', caso: caso([
            st('Trattoria Sorano', { types: ['restaurant'], moment: 'pranzo', at: at('13:00'), stay: 75, pasto: true }),
            st('Trattoria del Duomo', { types: ['restaurant'], moment: 'pomeriggio', at: at('15:00'), stay: 75, pasto: true }),
        ], { richiesta: 'Una merenda in trattoria a Catania' }) },
        buono2: { nome: 'C7 — aperitivo in un cocktail bar (anche `restaurant` fra i types) e pranzo/cena in ristorante', caso: caso([
            st('Trattoria Sorano', { types: ['restaurant'], primaryType: 'italian_restaurant', moment: 'pranzo', at: at('13:00'), stay: 75, pasto: true }),
            st('Bar Popolare', { types: ['cocktail_bar', 'bar', 'restaurant'], primaryType: 'cocktail_bar', moment: 'aperitivo', at: at('18:00'), stay: 20, pasto: true }),
            st('Osteria Antica', { types: ['restaurant'], primaryType: 'restaurant', moment: 'cena', at: at('20:00'), stay: 75, pasto: true }),
        ], { richiesta: 'Un giorno da catanese, nei ristoranti tipici' }) },
    },
    c3: {
        cattivo: { nome: 'colazione alla Casbah del Moro alle 9:30 (bar/ristorante, apre alle 18:00)', origine: 'telefono 12/10 (D-CATANIA B6)',
            caso: caso([st('Casbah del Moro', { place_id: 'casbah', types: ['bar', 'restaurant', 'food'], moment: 'mattina', at: at('09:30'), stay: 75, pasto: true })],
                { orari: orari('casbah', SOLO_SERA) }) },
        buono: { nome: 'colazione in un bar-pasticceria aperto', caso: caso([st('Bar Pasticceria Centrale', { place_id: 'bar', types: ['cafe', 'bakery', 'food'], moment: 'mattina', at: at('09:30'), stay: 20 })],
            { orari: orari('bar', GIORNO) }) },
    },
    c4: {
        cattivo: { nome: 'Veloce con 1 tappa (una gastronomia alle 21:25), nessun ripiego', origine: 'telefono 12/10 (D-CATANIA A)',
            caso: caso([st('Gastronomia Etnea', { types: ['meal_takeaway', 'food'], moment: 'cena', at: at('21:25'), stay: 30, pasto: true })], { modo: 'veloce', ora: '21:25' }) },
        buono: { nome: 'giro serale aperitivo + cena (2 tappe); e 4 tappe di giorno', caso: caso([
            st('Wine Bar Etna', { types: ['bar'], moment: 'aperitivo', at: at('19:00'), stay: 20 }),
            st('Osteria Antica', { types: ['restaurant'], moment: 'cena', at: at('20:00'), stay: 75, pasto: true }),
        ], { modo: 'veloce', ora: '19:00' }) },
        // C8b — il minimo dipende dalla durata: 4 ore → 3 tappe; un giro da 2 tappe senza ripiego e' rosso
        cattivo2: { nome: 'C8b — Mezza Giornata di 4 ore (14:30–18:30) con 2 tappe e nessun ripiego', origine: 'misura del 14/10 (la regola "mai meno di 3 tappe in 3–6 ore")',
            caso: caso([
                st('Villa Bellini', { types: ['park'], moment: 'pomeriggio', at: at('14:30'), stay: 30 }),
                st('Castello Ursino', { types: ['museum'], moment: 'pomeriggio', at: at('15:30'), stay: 60 }),
            ], { finestraMinuti: [240] }) },
        cattivo3: { nome: 'C8b — Veloce lungo di 6 ore con 3 tappe e nessun ripiego (il minimo e\' 4)', origine: 'costruito',
            caso: caso([
                st('Villa Bellini', { types: ['park'], moment: 'mattina', at: at('09:30'), stay: 30 }),
                st('Castello Ursino', { types: ['museum'], moment: 'mattina', at: at('10:30'), stay: 60 }),
                st('Piazza Duomo', { types: ['tourist_attraction'], moment: 'pomeriggio', at: at('13:00'), stay: 30 }),
            ], { modo: 'veloce', finestraMinuti: [360] }) },
        buono3: { nome: 'C8b — 4 ore con 3 tappe', caso: caso([
            st('Villa Bellini', { types: ['park'], moment: 'pomeriggio', at: at('14:30'), stay: 30 }),
            st('Castello Ursino', { types: ['museum'], moment: 'pomeriggio', at: at('15:30'), stay: 60 }),
            st('Piazza Duomo', { types: ['tourist_attraction'], moment: 'pomeriggio', at: at('17:00'), stay: 30 }),
        ], { finestraMinuti: [240] }) },
        buono4: { nome: 'C8b — Veloce 21:25: prima la cena, poi la passeggiata (2 tappe in 2 ore)', caso: caso([
            st('Ristorante EtnaSicilia', { types: ['restaurant'], primaryType: 'italian_restaurant', moment: 'cena', at: at('21:25'), stay: 75, pasto: true }),
            st('Fontana dell\u2019Amenano', { types: ['tourist_attraction'], moment: 'cena', at: at('22:43'), stay: 30, passeggiata: true }),
        ], { modo: 'veloce', ora: '21:25', finestraMinuti: [120] }) },
        // C8a — la cena non e' piu' possibile (nessun locale aperto per tutta la sosta): il giro serale e' drink + passeggiata.
        buono2: { nome: 'Veloce 23:30: drink + passeggiata (la cena non e\' piu\' possibile)', caso: caso([
            st('Retrò - Cocktail Bar', { types: ['cocktail_bar', 'bar'], primaryType: 'cocktail_bar', moment: 'dopocena', at: at('23:30'), stay: 45 }),
            st('Piazza Università', { types: ['tourist_attraction'], moment: 'dopocena', at: '2026-10-15T00:20:00+02:00', stay: 30, passeggiata: true }),
        ], { modo: 'veloce', ora: '23:30' }) },
    },
    c5: {
        cattivo: { nome: 'Casbah del Moro alle 9:30, chiusa (mer 18:00–00:00); un museo da 60 min alle 9:30 che chiude alle 10:15', origine: 'telefono 12/10 (D-CATANIA B6) + ORARI (sosta oltre la chiusura)',
            caso: caso([st('Casbah del Moro', { place_id: 'casbah', types: ['bar', 'restaurant'], moment: 'mattina', at: at('09:30'), pasto: true }),
                st('Museo Chiude Presto', { place_id: 'museo', types: ['museum'], moment: 'mattina', at: at('09:30'), stay: 60 })],
            { orari: { ...orari('casbah', SOLO_SERA), ...orari('museo', [3].map(d => ({ open: { day: d, time: '0900' }, close: { day: d, time: '1015' } }))) } }) },
        buono: { nome: 'bar aperto alle 9:30; museo che finisce esattamente alla chiusura (10:30); un posto senza orari: "sconosciuto", non violazione', caso: caso([
            st('Bar Centrale', { place_id: 'bar', types: ['cafe'], moment: 'mattina', at: at('09:30'), stay: 20 }),
            st('Museo Finisce Alla Chiusura', { place_id: 'museo2', types: ['museum'], moment: 'mattina', at: at('09:30'), stay: 60 }),
            st('Villa Bellini', { place_id: 'villa', types: ['park'], moment: 'pomeriggio', at: at('15:00') }),
        ], { orari: { ...orari('bar', GIORNO), ...orari('museo2', [3].map(d => ({ open: { day: d, time: '0900' }, close: { day: d, time: '1030' } }))), villa: { periods: null, chiamato: true } } }), verificaSconosciuto: 1 },
    },
    c6: {
        cattivo: { nome: 'caffè da 1h 15min (75 min, come un ristorante)', origine: 'telefono 12/10 (D-CATANIA B5)',
            caso: caso([st('Caffè Savia', { types: ['cafe', 'restaurant'], moment: 'mattina', at: at('09:30'), stay: 75 }),
                st('Trattoria del Duomo', { types: ['restaurant'], moment: 'pranzo', at: at('12:30'), stay: 75, pasto: true })]) },
        buono: { nome: 'caffè 20 min, ristorante 75, chiesa 20; un cocktail bar marcato anche restaurant dura 20 (tipo principale)', caso: caso([st('Caffè Savia', { types: ['cafe'], moment: 'mattina', at: at('09:30'), stay: 20 }),
            st('Trattoria del Duomo', { types: ['restaurant'], moment: 'pranzo', at: at('12:30'), stay: 75, pasto: true }),
            st('Chiesa di San Nicolò', { types: ['church'], moment: 'pomeriggio', at: at('15:00'), stay: 20 }),
            st('Folia Bar & Lab', { types: ['cocktail_bar', 'restaurant', 'bar'], primaryType: 'cocktail_bar', moment: 'aperitivo', at: at('18:30'), stay: 20 })]) },
    },
    c7: {
        cattivo: { nome: '"Sono 1 minuti a piedi dalla tappa prima." e la stessa frase 3 volte', origine: 'telefono 12/10',
            caso: caso([
                st('Villa Bellini', { description: 'Sono 1 minuti a piedi dalla tappa prima.' }),
                st('Piazza Duomo', { description: 'Qui la giornata prende ritmo, senza fretta.' }),
                st('Via Etnea', { description: 'Qui la giornata prende ritmo, senza fretta.' }),
                st('Castello Ursino', { description: 'Qui la giornata prende ritmo, senza fretta.' }),
            ]) },
        buono: { nome: 'frasi diverse, "1 minuto" e "5 minuti" corretti', caso: caso([
            st('Villa Bellini', { description: 'Sono 1 minuto a piedi dalla tappa prima.' }),
            st('Piazza Duomo', { description: 'Sono 5 minuti a piedi dalla tappa prima.' }),
            st('Via Etnea', { description: 'Alle 15 sei a Via Etnea: è qui che ti porta la giornata.' }),
        ]) },
    },
    c8: {
        cattivo: { nome: '"sunny, 20°C" alle 21:23 su un tour di domani', origine: 'telefono 12/10',
            caso: caso([st('Villa Bellini')], { tourDate: '2026-10-15', schermo: { giorni: [{ titolo: 'Il tuo giro a Catania', meteo: { condition: 'sunny', temperature: 20 } }], note: [] } }) },
        buono: { nome: 'meteo in italiano sul tour di oggi; nessun meteo su un tour di domani', caso: caso([st('Villa Bellini')],
            { schermo: { giorni: [{ titolo: 'Il tuo giro a Catania', meteo: { condition: 'sereno', temperature: 20 } }], note: [] } }) },
        buono2: { nome: 'tour di domani senza meteo', caso: caso([st('Villa Bellini')], { tourDate: '2026-10-15', schermo: { giorni: [{ titolo: 'Il tuo giro a Catania', meteo: null }], note: [] } }) },
        // TESTI — «Aperitivo» dopo le 21:30
        cattivo2: { nome: 'TESTI — la sezione «Aperitivo» alle 21:45 (Veloce Catania 21:25)', origine: 'giro sera del 14/10 (veloce-catania-relax-2125): il drink delle 21:45 sotto «Aperitivo»',
            caso: caso([st('Retrò - Cocktail Bar', { types: ['cocktail_bar'], primaryType: 'cocktail_bar', moment: 'aperitivo', at: at('21:45'), stay: 45 })],
                { modo: 'veloce', ora: '21:25', schermo: { giorni: [{ titolo: 'Il tuo giro a Catania', meteo: null }], sezioni: [{ etichetta: 'Aperitivo', ora: '21:45' }], note: [] } }) },
        buono3: { nome: 'TESTI — «Aperitivo» alle 21:25 (prima delle 21:30) e «Dopocena» alle 21:45', caso: caso([st('Retrò - Cocktail Bar', { types: ['cocktail_bar'], primaryType: 'cocktail_bar', moment: 'aperitivo', at: at('21:25'), stay: 45 })],
            { modo: 'veloce', ora: '21:25', schermo: { giorni: [{ titolo: 'Il tuo giro a Catania', meteo: null }], sezioni: [{ etichetta: 'Aperitivo', ora: '21:25' }, { etichetta: 'Dopocena', ora: '21:45' }], note: [] } }) },
        // TESTI — «fascia €»
        cattivo3: { nome: 'TESTI — «trattoria in fascia €€» a schermo', origine: 'tutti i giri del banco prima di TESTI (221 frasi nei grezzi precedenti)',
            caso: caso([st('Trattoria Sorano', { types: ['restaurant'], primaryType: 'italian_restaurant', moment: 'pranzo', at: at('12:30'), stay: 75, pasto: true, description: 'Pranzi da Trattoria Sorano, trattoria in fascia €€.' })]) },
        buono4: { nome: 'TESTI — «trattoria con prezzi medi»', caso: caso([st('Trattoria Sorano', { types: ['restaurant'], primaryType: 'italian_restaurant', moment: 'pranzo', at: at('12:30'), stay: 75, pasto: true, description: 'Pranzi da Trattoria Sorano, trattoria con prezzi medi.' })]) },
        // TESTI — il numero del giorno in un tour di un giorno
        cattivo4: { nome: 'TESTI — «Giorno 1 a Troina» per un giro di 1h22', origine: 'telefono di Ivano (Troina)',
            caso: caso([st('Villa Bellini')], { schermo: { giorni: [{ titolo: 'Giorno 1 a Troina', meteo: null }], note: [] } }) },
        buono5: { nome: 'TESTI — due giorni: «Giorno 1 a Roma» e «Giorno 2 a Roma» restano', caso: caso([st('Villa Bellini')],
            { schermo: { giorni: [{ titolo: 'Giorno 1 a Roma', meteo: null }, { titolo: 'Giorno 2 a Roma', meteo: null }], note: [] } }) },
    },
    // C7 — c12. L'esempio cattivo e' il caso reale: Veloce Catania del 13/10 con la tappa "Centro Storico Catania".
    c12: {
        cattivo: { nome: 'tappa "Centro Storico Catania" (tourist_attraction) e un quartiere (neighborhood)', origine: 'telefono di Ivano 13/10 (Veloce Catania)',
            caso: caso([
                st('Centro Storico Catania', { types: ['tourist_attraction', 'point_of_interest', 'establishment'], primaryType: 'tourist_attraction' }),
                st('Quartiere San Berillo', { types: ['neighborhood', 'political'], primaryType: 'neighborhood' }),
            ]) },
        buono: { nome: 'posti veri: una via monumento, un mercato, una piazza, un museo del centro storico', caso: caso([
            st('Via dei Crociferi', { types: ['route', 'tourist_attraction'], primaryType: 'tourist_attraction' }),
            st('Pescheria di Catania', { types: ['market', 'point_of_interest'], primaryType: 'market' }),
            st('Museo del Centro Storico', { types: ['museum'], primaryType: 'museum' }),
        ]) },
    },
    c10: {
        cattivo: { nome: 'vegetariano: un pasto non cercato come vegetariano; un museo trovato solo da ricerche vegetariane', origine: 'costruito',
            caso: caso([
                st('Trattoria del Duomo', { types: ['restaurant'], moment: 'pranzo', at: at('12:30'), pasto: true, dietaCercata: false }),
                st('Museo Civico', { types: ['museum'], dietaCercata: true, dietaSolo: true }),
            ], { vincoli: { dieta: ['vegetariano'] } }) },
        buono: { nome: 'vegetariano: pasti cercati col criterio; museo trovato da ricerche normali', caso: caso([
            st('Trattoria del Duomo', { types: ['restaurant'], moment: 'pranzo', at: at('12:30'), pasto: true, dietaCercata: true }),
            st('Museo Civico', { types: ['museum'], dietaCercata: false, dietaSolo: false }),
        ], { vincoli: { dieta: ['vegetariano'] } }) },
    },
    // CONTINUITA' — c11. L'esempio cattivo e' la prova di Ivano (martedi' 13/10 ore 13:48, Catania, Crea senza testo),
    // rigirata col motore di prima: pomeriggio con 2 tappe (30 + 60 min), poi niente fino all'aperitivo delle 18:00.
    // Il grezzo e' in docs/prove/dati/2026-10-13-banco-esteso-continuita-prima.json (orari e coordinate di li').
    c11: {
        cattivo: { nome: 'Catania 13:48: Elefanti 14:30 (30 min), Museo Bellini 15:03 (60 min), poi niente fino all\'aperitivo delle 18:00 (circa 2 ore senza una riga)',
            origine: 'telefono di Ivano 13/10 ore 13:48, rigirato (docs/prove/dati/2026-10-13-banco-esteso-continuita-prima.json)',
            caso: caso([
                st('Palazzo degli Elefanti', { moment: 'pomeriggio', at: at('14:30'), stay: 30, lat: 37.50285, lng: 15.08715 }),
                st('Museo Vincenzo Bellini', { types: ['museum'], moment: 'pomeriggio', at: at('15:03'), stay: 60, lat: 37.50276, lng: 15.08444 }),
                st('Deliziosa Café & Cocktail Bar', { types: ['cocktail_bar'], moment: 'aperitivo', at: at('18:00'), stay: 20, lat: 37.50310, lng: 15.08484 }),
                st('Trattoria del Lago', { types: ['restaurant', 'food'], moment: 'cena', at: at('20:00'), stay: 75, pasto: true, lat: 37.50791, lng: 15.07927 }),
            ]) },
        cattivo2: { nome: 'tempo libero in testa al giorno e le 4 tappe dopo senza orario (crea-firenze-arte)', origine: 'grezzo 2026-10-13-banco-esteso-festivi.json, crea-firenze-arte',
            caso: caso([
                st('Tempo libero', { place_id: null, types: [], moment: 'mattina', at: at('09:30'), stay: 0, tempoLibero: true }),
                st('Osteria dei Leoni', { types: ['restaurant', 'food'], moment: 'pranzo', at: null, stay: 75, pasto: true }),
                st('Galleria Poggiali', { types: ['art_gallery'], moment: 'pomeriggio', at: null, stay: 60 }),
            ]) },
        buono: { nome: 'lo stesso pomeriggio pieno: 6 tappe una dopo l\'altra, nessun buco oltre 45 minuti', caso: caso([
            st('Palazzo degli Elefanti', { moment: 'pomeriggio', at: at('14:30'), stay: 30, lat: 37.50285, lng: 15.08715 }),
            st('Museo Vincenzo Bellini', { types: ['museum'], moment: 'pomeriggio', at: at('15:03'), stay: 60, lat: 37.50276, lng: 15.08444 }),
            st('Chiesa di San Francesco Borgia', { types: ['church'], moment: 'pomeriggio', at: at('16:10'), stay: 20, lat: 37.50300, lng: 15.08460 }),
            st('Palazzo Platamone', { moment: 'pomeriggio', at: at('16:35'), stay: 30, lat: 37.50330, lng: 15.08520 }),
            st('Odeon Romano', { moment: 'pomeriggio', at: at('17:08'), stay: 30, lat: 37.50340, lng: 15.08560 }),
            st('Deliziosa Café & Cocktail Bar', { types: ['cocktail_bar'], moment: 'aperitivo', at: at('18:00'), stay: 20, lat: 37.50310, lng: 15.08484 }),
        ]) },
        buono2: { nome: 'il buco e\' una riga di tempo libero con la sua fascia (16:03–18:00); la tappa dopo ha il suo orario', caso: caso([
            st('Palazzo degli Elefanti', { moment: 'pomeriggio', at: at('14:30'), stay: 30, lat: 37.50285, lng: 15.08715 }),
            st('Museo Vincenzo Bellini', { types: ['museum'], moment: 'pomeriggio', at: at('15:03'), stay: 60, lat: 37.50276, lng: 15.08444 }),
            st('Tempo libero', { place_id: null, types: [], moment: 'pomeriggio', at: at('16:03'), stay: 117, tempoLibero: true }),
            st('Deliziosa Café & Cocktail Bar', { types: ['cocktail_bar'], moment: 'aperitivo', at: at('18:00'), stay: 20, lat: 37.50310, lng: 15.08484 }),
        ]) },
    },
    // C8a — c13. L'esempio cattivo e' il caso di Ivano (13/10 ore 13:48, Catania): all'aperitivo delle 18:00 il bar dura 20 minuti
    // (Deliziosa Café & Cocktail Bar), poi 97 minuti di tempo libero fino alla cena. Il secondo cattivo e' costruito: un secondo bar prima della cena.
    c13: {
        cattivo: { nome: 'aperitivo delle 18:00 di soli 20 minuti (Deliziosa Café & Cocktail Bar), poi 97 minuti di tempo libero fino alla cena',
            origine: 'telefono di Ivano 13/10 ore 13:48, rigirato (docs/prove/dati/2026-10-13-banco-esteso-continuita-prima.json)',
            caso: caso([
                st('Deliziosa Café & Cocktail Bar', { types: ['cocktail_bar'], primaryType: 'cocktail_bar', moment: 'aperitivo', at: at('18:00'), stay: 20 }),
                st('Tempo libero', { place_id: null, types: [], moment: 'aperitivo', at: at('18:20'), stay: 97, tempoLibero: true }),
                st('Ristorante EtnaSicilia', { types: ['restaurant', 'food'], primaryType: 'italian_restaurant', moment: 'cena', at: at('20:00'), stay: 75, pasto: true }),
            ]) },
        cattivo2: { nome: 'un secondo bar prima della cena, e un buco di 70 minuti senza passeggiata né riga', origine: 'costruito',
            caso: caso([
                st('Bar Uno', { types: ['cocktail_bar'], primaryType: 'cocktail_bar', moment: 'aperitivo', at: at('18:00'), stay: 45 }),
                st('Wine Bar Due', { types: ['wine_bar', 'bar'], primaryType: 'wine_bar', moment: 'aperitivo', at: at('18:50'), stay: 45 }),
                st('Trattoria del Lago', { types: ['restaurant', 'food'], primaryType: 'italian_restaurant', moment: 'cena', at: at('21:00'), stay: 75, pasto: true }),
            ]) },
        buono: { nome: 'drink di 45 minuti, una passeggiata di 30, la cena alle 20:00', caso: caso([
            st('Retrò - Cocktail Bar', { types: ['cocktail_bar'], primaryType: 'cocktail_bar', moment: 'aperitivo', at: at('18:00'), stay: 45 }),
            st('Piazza Università', { types: ['tourist_attraction'], moment: 'aperitivo', at: at('18:52'), stay: 30, passeggiata: true }),
            st('Ristorante EtnaSicilia', { types: ['restaurant', 'food'], primaryType: 'italian_restaurant', moment: 'cena', at: at('20:00'), stay: 75, pasto: true }),
        ]) },
        // C8c — la sera si cena: drink + passeggiata alle 20:00 senza la cena e senza la riga (Per Te Napoli 20:00)
        cattivo4: { nome: 'C8c — Veloce 20:00: drink e passeggiata, nessuna cena e nessuna riga al suo posto', origine: 'misura del 14/10 (perte-napoli-2000)',
            caso: caso([
                st('MMB Music Melody Bar', { types: ['cocktail_bar', 'bar'], primaryType: 'cocktail_bar', moment: 'aperitivo', at: at('20:00'), stay: 60 }),
                st('Belvedere di Pizzofalcone', { types: ['tourist_attraction'], moment: 'aperitivo', at: at('21:25'), stay: 30, passeggiata: true }),
            ], { modo: 'veloce', ora: '20:00', finestraMinuti: [120] }) },
        buono4: { nome: 'C8c — Veloce 20:00: drink + cena (la passeggiata e\' stata tolta)', caso: caso([
            st('Botanical Bar', { types: ['cocktail_bar', 'bar'], primaryType: 'cocktail_bar', moment: 'aperitivo', at: at('20:00'), stay: 60 }),
            st('Osteria Paladino', { types: ['restaurant', 'food'], primaryType: 'italian_restaurant', moment: 'cena', at: at('21:25'), stay: 75, pasto: true }),
        ], { modo: 'veloce', ora: '20:00', finestraMinuti: [120] }) },
        buono5: { nome: 'C8c — Veloce 20:00 senza nessun ristorante aperto: drink + passeggiata + la riga «Nessun locale aperto qui vicino a quest\'ora.»', caso: caso([
            st('Botanical Bar', { types: ['cocktail_bar', 'bar'], primaryType: 'cocktail_bar', moment: 'aperitivo', at: at('20:00'), stay: 60 }),
            st('Belvedere di Pizzofalcone', { types: ['tourist_attraction'], moment: 'aperitivo', at: at('21:25'), stay: 30, passeggiata: true }),
            st('Tempo libero', { place_id: null, types: [], moment: 'cena', at: at('21:55'), stay: 0, tempoLibero: true, description: 'Nessun locale aperto qui vicino a quest\u2019ora.' }),
        ], { modo: 'veloce', ora: '20:00', finestraMinuti: [120] }) },
        // VERITÀ-PRE-GIRO — la cena e' dovuta solo prima delle 22:00: il Veloce Catania delle 22:20 (drink + passeggiata, nessuna riga) e' verde.
        buono6: { nome: 'Veloce 22:20 (Bar Popolare 60 min + Fontana dell\u2019Amenano): dalle 22:00 la cena non e\' dovuta', origine: 'giro TESTI 15/10 (docs/prove/dati/2026-10-15-banco-esteso-testi-2.json, veloce-catania-relax-2220)',
            caso: caso([
                st('Bar Popolare', { types: ['cocktail_bar', 'bar', 'restaurant', 'food'], primaryType: 'cocktail_bar', moment: 'aperitivo', at: '2026-10-14T20:20:00.000Z', stay: 60 }),
                st('Fontana dell\u2019Amenano', { types: ['tourist_attraction'], primaryType: 'tourist_attraction', moment: 'aperitivo', at: '2026-10-14T21:22:00.000Z', stay: 30, passeggiata: true }),
            ], { modo: 'veloce', ora: '22:20', finestraMinuti: [120] }) },
        cattivo3: { nome: 'Veloce 23:30 con una tappa sola: il solo drink (Retrò - Cocktail Bar), senza passeggiata', origine: 'giro sera, versione intermedia del codice (veloce-catania-relax-2330)',
            caso: caso([
                st('Retrò - Cocktail Bar', { types: ['cocktail_bar'], primaryType: 'cocktail_bar', moment: 'dopocena', at: at('23:30'), stay: 60 }),
            ], { modo: 'veloce', ora: '23:30' }) },
        buono3: { nome: 'Veloce 23:30: drink + passeggiata; un Veloce di giorno con una tappa sola non e\' un caso serale', caso: caso([
            st('Retrò - Cocktail Bar', { types: ['cocktail_bar'], primaryType: 'cocktail_bar', moment: 'dopocena', at: at('23:30'), stay: 60 }),
            st('Fontana dell\u2019Amenano', { types: ['tourist_attraction'], moment: 'dopocena', at: '2026-10-15T00:32:00+02:00', stay: 30, passeggiata: true }),
        ], { modo: 'veloce', ora: '23:30' }) },
        buono2: { nome: 'senza luoghi all\'aperto nel pool il buco e\' una riga di tempo libero che lo dichiara; un bar di giorno da 20 minuti non conta', caso: caso([
            st('Caffè Savia', { types: ['cafe'], primaryType: 'cafe', moment: 'pomeriggio', at: at('16:00'), stay: 20 }),
            st('Retrò - Cocktail Bar', { types: ['cocktail_bar'], primaryType: 'cocktail_bar', moment: 'aperitivo', at: at('18:00'), stay: 45 }),
            st('Tempo libero', { place_id: null, types: [], moment: 'aperitivo', at: at('18:45'), stay: 75, tempoLibero: true }),
            st('Ristorante EtnaSicilia', { types: ['restaurant', 'food'], primaryType: 'italian_restaurant', moment: 'cena', at: at('20:00'), stay: 75, pasto: true }),
        ]) },
    },
};

const passi = (n, ko = []) => Array.from({ length: n }, (_, i) => ({ nome: `passo ${i + 1}`, ok: !ko.includes(i + 1) }));
export const ESEMPIO_C9 = {
    cattivo: { nome: 'dopo il logout il flag "onboarding fatto" è cancellato e al login su browser vuoto lo stato è "todo" (il comportamento prima di ONB-1)',
        origine: 'costruito sul comportamento descritto in docs/prove/2026-10-12-onb1.md §1', onb1: { passi: passi(12, [5, 8]) } },
    buono: { nome: 'tutti i 12 passi OK', onb1: { passi: passi(12) } },
    incompleto: { nome: 'la prova si ferma a 7 passi', onb1: { passi: passi(7) } },
};

// C8c — la voce «Giornata completa»: vale solo per finestre da 6 ore o piu'; una sera e' completa con drink + cena o cena + passeggiata.
const misuraTappe = (c) => ({ tappe: (c.tours || []).flatMap(t => t.stops || []).filter(x => !x.tempoLibero).length });
export const ESEMPI_GIORNATA = {
    cattivo: { nome: 'sera di 2 ore: drink + passeggiata, nessuna cena (Per Te Napoli 20:00)', origine: 'misura del 14/10 (perte-napoli-2000)', atteso: 'rosso',
        caso: ESEMPI.c13.cattivo4.caso },
    cattivo2: { nome: 'giornata di 8 ore con 3 tappe', origine: 'costruito', atteso: 'rosso',
        caso: caso(quattro.slice(0, 3), { finestraMinuti: [480] }) },
    buono: { nome: 'sera di 2 ore: drink + cena', atteso: 'verde', caso: ESEMPI.c13.buono4.caso },
    buono2: { nome: 'sera di 2 ore: cena + passeggiata (la cena tardi)', atteso: 'verde', caso: caso([
        st('Ristorante EtnaSicilia', { types: ['restaurant', 'food'], primaryType: 'italian_restaurant', moment: 'cena', at: at('21:25'), stay: 75, pasto: true }),
        st('Fontana dell\u2019Amenano', { types: ['tourist_attraction'], moment: 'cena', at: at('22:43'), stay: 30, passeggiata: true }),
    ], { modo: 'veloce', ora: '21:25', finestraMinuti: [120] }) },
    buono3: { nome: 'pomeriggio di 4 ore con 3 tappe: non e\' una giornata, la voce non si applica (il minimo e\' di c4)', atteso: null,
        caso: caso(quattro.slice(0, 3).map(x => ({ ...x, moment: 'pomeriggio' })), { finestraMinuti: [240], ora: '14:30' }) },
    buono4: { nome: 'giornata di 8 ore con 4 tappe', atteso: 'verde', caso: caso(quattro, { finestraMinuti: [480] }) },
};
export function validaGiornata(cfg) {
    return Object.entries(ESEMPI_GIORNATA).map(([k, e]) => {
        const visto = giornataSemaforo(misuraTappe(e.caso), e.caso, cfg.soglie);
        return { esempio: k, nome: e.nome, atteso: e.atteso, visto, ok: visto === e.atteso };
    });
}

/** @returns {Array<{ classe, cattivo, buono, ok, dettagli }>} */
export function validaControlli(cfg) {
    const righe = Object.entries(ESEMPI).map(([k, e]) => {
        const f = CONTROLLI[k];
        // tutti gli esempi cattivi (cattivo, cattivo2, …) devono dare rosso; tutti i buoni (buono, buono2, …) verde
        const cattivi = Object.keys(e).filter(x => /^cattivo\d*$/.test(x)).map(x => e[x]);
        const buoni = Object.keys(e).filter(x => /^buono\d*$/.test(x)).map(x => e[x]);
        const rossi = cattivi.map(c => f(c.caso, cfg).violazioni);
        const verdi = buoni.map(b => f(b.caso, cfg).violazioni);
        const sc = e.buono.verificaSconosciuto != null ? f(e.buono.caso, cfg).sconosciuti === e.buono.verificaSconosciuto : true;
        return { classe: k, cattivo: cattivi.map(c => c.nome).join(' · '), origine: cattivi.map(c => c.origine).filter(Boolean).join(' · '), buono: buoni.map(b => b.nome).join(' · '),
            cattivoRosso: rossi.every(r => r.length > 0), buonoVerde: verdi.every(v => v.length === 0) && sc,
            visto: rossi.flat().map(v => v.testo), falsiAllarmi: verdi.flat().map(v => v.testo) };
    });
    const r = c9(ESEMPIO_C9.cattivo.onb1, cfg).violazioni;
    const v = c9(ESEMPIO_C9.buono.onb1, cfg).violazioni;
    const inc = c9(ESEMPIO_C9.incompleto.onb1, cfg).violazioni;
    righe.push({ classe: 'c9', cattivo: ESEMPIO_C9.cattivo.nome, origine: ESEMPIO_C9.cattivo.origine, buono: ESEMPIO_C9.buono.nome,
        cattivoRosso: r.length > 0 && inc.length > 0, buonoVerde: v.length === 0, visto: [...r, ...inc].map(x => x.testo), falsiAllarmi: v.map(x => x.testo) });
    return righe.sort((a, b) => Number(a.classe.slice(1)) - Number(b.classe.slice(1)));
}
