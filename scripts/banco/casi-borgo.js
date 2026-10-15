// BORGO-DIAGNOSI — i casi reali di Ivano a Troina (giovedì 15/10, sera) e il confronto con Catania. Dati puri, nello stesso
// formato di casi-esteso.js: ogni caso replica la chiamata reale della sua pagina con l'ora simulata (opts.simulatedNow).
//
//   A   Per Te alle 23:00                                    DashboardUser.jsx (giro della sera)
//   B   Natura alle 23:00: Quiz Veloce (Parchi e Verde)      QuickPath.jsx
//       e «Crea il tuo Tour → Su misura per te» Natura       SurpriseTour.jsx
//   C   Crea il tuo Percorso alle 23:00, il testo di Ivano   AiItinerary.jsx (wizard vuoto: solo il testo)
//   C2  lo stesso testo alle 10:00 dello stesso giorno
//   Cat lo stesso testo a Catania alle 23:00, ma del 14/10: la lista di Catania del 16/10 non c'è e generarla scriverebbe in
//       produzione; il 15/10 la lista c'è già (vedi report). Il tour è quindi per giovedì 15/10, non per venerdì 16/10.
//
// Si girano con il banco esteso: BANCO_CASI=borgo-a-perte,… (esteso.live.js li sceglie per nome).

export const GIORNO_BORGO = '2026-10-15';
export const TESTO_C = 'fammi fare domani una giornata tra natura e luoghi storici';

// Le scelte del Quiz come le mostra il wizard (QuickPath.jsx): le stesse di casi-esteso.js.
const NATURA = { main: 'natura', sub: 'parco', mainTitle: 'Natura', subTitle: 'Parchi e Verde' };
// Il wizard di AiItinerary.jsx parte con tutte le scelte vuote: Ivano ha scritto solo il testo (assunzione dichiarata).
const VUOTE = { budget: '', duration: '', interests: [], group: '', pace: '' };

export const CASI_BORGO = [
    { id: 'borgo-a-perte', modo: 'perte', luogo: 'Troina', ora: '23:00', giorno: GIORNO_BORGO, onboarding: null },
    { id: 'borgo-b-quiz-natura', modo: 'veloce', luogo: 'Troina', ora: '23:00', giorno: GIORNO_BORGO, scelta: NATURA, durata: 'Veloce', gruppo: 'Solo' },
    { id: 'borgo-b-sorpresa-natura', modo: 'sorprendimi', luogo: 'Troina', ora: '23:00', giorno: GIORNO_BORGO, tema: 'Natura' },
    { id: 'borgo-c-crea-2300', modo: 'crea', luogo: 'Troina', ora: '23:00', giorno: GIORNO_BORGO, richiesta: TESTO_C, prefs: VUOTE, onboarding: null },
    { id: 'borgo-c2-crea-1000', modo: 'crea', luogo: 'Troina', ora: '10:00', giorno: GIORNO_BORGO, richiesta: TESTO_C, prefs: VUOTE, onboarding: null },
    { id: 'borgo-cat-crea-2300', modo: 'crea', luogo: 'Catania', ora: '23:00', giorno: '2026-10-14', richiesta: TESTO_C, prefs: VUOTE, onboarding: null },
];
