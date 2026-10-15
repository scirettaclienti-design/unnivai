// TROINA-FIX — la GUARDIA DELLA HOME: ogni flusso della home deve dare almeno un tour con posti veri, in un borgo (Troina) e in
// una citta' (Catania). Dati puri, nello stesso formato di casi-esteso.js: ogni caso replica la chiamata reale della sua pagina.
//
//   Per Te                         DashboardUser.jsx  (discoverAllThemes + buildInsiderPool + generateHomeTours)
//   Quiz Natura → Parchi e Verde   QuickPath.jsx      («parchi»)
//   Quiz Storia → Cultura e Musei  QuickPath.jsx      («luoghi storici»)
//   Sorprendimi Natura, Arte       SurpriseTour.jsx   (la card «Crea il tuo Tour – Su misura per te»: per categoria)
//   Crea il tuo Percorso           AiItinerary.jsx    («Una giornata a X»)
//
// L'ora e' quella del guasto di Troina (15/10, 12:05–12:07): a mezzogiorno il giro corto del borgo restava col solo pranzo.
// Il giorno e' il 15/10: le liste di Troina e Catania di quel giorno sono gia' sul server (nessuna lista nuova da pagare).
// Il primo giro e' pagato e salva i tracciati (`npm run banco:guardia -- --registra`); da li' la guardia gira in replay a 0 $
// (`npm run banco:guardia`), prima di ogni merge.

export const GIORNO_GUARDIA = '2026-10-15';
export const ORA_GUARDIA = '12:05';

// Le scelte del Quiz come le mostra il wizard (QuickPath.jsx): le stesse di casi-esteso.js.
const Q = {
    natura: { main: 'natura', sub: 'parco', mainTitle: 'Natura', subTitle: 'Parchi e Verde' },
    storia: { main: 'storia', sub: 'musei', mainTitle: 'Storia', subTitle: 'Cultura e Musei' },
};

const flussi = (luogo) => {
    const l = luogo.toLowerCase();
    const base = { luogo, ora: ORA_GUARDIA, giorno: GIORNO_GUARDIA, guardia: true };
    return [
        { ...base, id: `home-${l}-perte`, modo: 'perte', flusso: 'Per Te', onboarding: null },
        { ...base, id: `home-${l}-quiz-natura`, modo: 'veloce', flusso: 'Quiz Natura (parchi)', scelta: Q.natura, durata: 'Medio', gruppo: 'Solo' },
        { ...base, id: `home-${l}-quiz-storia`, modo: 'veloce', flusso: 'Quiz Storia (luoghi storici)', scelta: Q.storia, durata: 'Medio', gruppo: 'Solo' },
        { ...base, id: `home-${l}-sorpresa-natura`, modo: 'sorprendimi', flusso: 'Su misura per te – Natura', tema: 'Natura' },
        { ...base, id: `home-${l}-sorpresa-arte`, modo: 'sorprendimi', flusso: 'Su misura per te – Arte', tema: 'Arte' },
        { ...base, id: `home-${l}-crea`, modo: 'crea', flusso: 'Crea il tuo Percorso', richiesta: `Una giornata a ${luogo}`,
            prefs: { budget: '', group: '', pace: 'Attivo', duration: '1 Giorno', interests: [] }, onboarding: null },
    ];
};

export const CITTA_GUARDIA = ['Troina', 'Catania'];
export const CASI_HOME = CITTA_GUARDIA.flatMap(flussi);
