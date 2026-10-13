// BANCO-ESTESO — la matrice dei casi: modalità × ora × richiesta × vincoli × luogo.
// Dati puri. Ogni caso replica la chiamata reale della sua pagina:
//   crea         AiItinerary.jsx   pathType 'custom', prefs del wizard (budget, durata, interessi, gruppo, ritmo)
//   veloce       QuickPath.jsx     pathType 'quick', testo da buildPromptFromSelections, prefs da buildQuickPrefs (ritmo e umore come Crea)
//   sorprendimi  SurpriseTour.jsx  nessun pathType, 'Mezza Giornata', cityCenter = {latitude, longitude}
//   perte        DashboardUser.jsx discoverAllThemes + buildInsiderPool + generateHomeTours
// `ora` = ora di Roma simulata (giorno: config.esteso.giornoSimulato).

const VEG = { dieta: ['vegetariano'], budget: null, stile: null };

// Veloce: i titoli delle scelte come li mostra il wizard (QuickPath.jsx, CITY_CONFIG).
const V = {
    relax: { main: 'relax', sub: 'spa', mainTitle: 'Relax', subTitle: 'Benessere' },
    cultura: { main: 'storia', sub: 'musei', mainTitle: 'Storia', subTitle: 'Cultura e Musei' },
    rione: { main: 'citta', sub: 'rione', mainTitle: 'Città', subTitle: 'Rioni Storici' },
    pizza: { main: 'cibo', sub: 'pizza', mainTitle: 'Gusto', subTitle: 'Vera Pizza' },
    parco: { main: 'natura', sub: 'parco', mainTitle: 'Natura', subTitle: 'Parchi e Verde' },
    duomo: { main: 'citta', sub: 'duomo', mainTitle: 'Città', subTitle: 'Zona Duomo' },
};

const crea = (id, luogo, ora, richiesta, prefs, onboarding = null) => ({ id, modo: 'crea', luogo, ora, richiesta, prefs: { budget: '', group: '', pace: '', ...prefs }, onboarding });
const veloce = (id, luogo, ora, scelta, durata, gruppo = 'Solo') => ({ id, modo: 'veloce', luogo, ora, scelta: V[scelta], durata, gruppo });
const sorprendimi = (id, luogo, ora, tema = null) => ({ id, modo: 'sorprendimi', luogo, ora, tema });
const perte = (id, luogo, ora, onboarding = null) => ({ id, modo: 'perte', luogo, ora, onboarding });

export const CASI_ESTESI = [
    // ── Crea il tuo percorso (11) ──
    crea('crea-catania-catanese-veg', 'Catania', '09:30', 'Vorrei vivere un giorno da catanese, nei ristoranti tipici', { duration: '1 Giorno', interests: ['Cibo'], pace: 'Attivo' }, VEG),
    crea('crea-catania-catanese', 'Catania', '09:30', 'Vorrei vivere un giorno da catanese, nei ristoranti tipici', { duration: '1 Giorno', interests: ['Cibo'], pace: 'Attivo' }),
    crea('crea-napoli-aperitivo-cena', 'Napoli', '19:30', 'aperitivo e cena', { duration: 'Mezza Giornata', pace: 'Attivo' }),
    crea('crea-roma-neutra', 'Roma', '09:30', 'Una giornata a Roma', { duration: '1 Giorno', pace: 'Attivo' }),
    crea('crea-lecce', 'Lecce', '09:30', 'Una giornata a Lecce', { duration: '1 Giorno', pace: 'Rilassato' }),
    crea('crea-troina', 'Troina', '09:30', 'Una giornata a Troina', { duration: '1 Giorno', pace: 'Attivo' }),
    crea('crea-bologna-pomeriggio', 'Bologna', '15:00', 'Un pomeriggio a Bologna tra portici e osterie', { duration: 'Mezza Giornata', pace: 'Rilassato' }),
    crea('crea-milano-sera', 'Milano', '20:30', 'Una cena e due passi a Milano', { duration: 'Mezza Giornata', pace: 'Intenso' }),
    crea('crea-firenze-arte', 'Firenze', '09:30', "Una giornata d'arte a Firenze", { duration: '1 Giorno', interests: ['Arte', 'Storia'], pace: 'Rilassato' }),
    crea('crea-palermo-mercato-veg', 'Palermo', '12:00', 'Pranzo e giro al mercato a Palermo', { duration: 'Mezza Giornata', interests: ['Cibo'], pace: 'Attivo' }, VEG),
    crea('crea-siracusa', 'Siracusa', '09:30', "Una giornata a Siracusa, a Ortigia", { duration: '1 Giorno', pace: 'Attivo' }),
    // CONTINUITA' — la prova di Ivano (martedi' 13/10 ore 13:48): Crea SENZA testo, solo le scelte del wizard.
    // Le scelte esatte non sono note: interessi Storia e Cibo, 1 Giorno, ritmo Attivo (assunzione dichiarata nel report).
    // `giorno`: il suo giorno simulato (martedi' 13/10), diverso da quello del giro.
    { ...crea('crea-catania-1348', 'Catania', '13:48', '', { duration: '1 Giorno', interests: ['Storia', 'Cibo'], pace: 'Attivo' }), giorno: '2026-10-13' },

    // C7 — i tre casi del tema: street food, "da romano", un tema d'arte (la composizione della giornata).
    crea('crea-palermo-streetfood', 'Palermo', '09:30', 'Palermo street food', { duration: '1 Giorno', interests: ['Cibo'], pace: 'Attivo' }),
    crea('crea-roma-da-romano', 'Roma', '09:30', 'Una giornata da romano a Roma', { duration: '1 Giorno', interests: ['Cibo'], pace: 'Attivo' }),
    crea('crea-napoli-arte', 'Napoli', '09:30', "Una giornata d'arte a Napoli", { duration: '1 Giorno', interests: ['Arte', 'Storia'], pace: 'Attivo' }),

    // C8a — la sera: Crea neutra alle 18:00 a Catania (drink, passeggiata, cena senza buchi).
    crea('crea-catania-1800', 'Catania', '18:00', 'Una giornata a Catania', { duration: '1 Giorno', pace: 'Attivo' }),

    // C8b — la colazione: Crea e Per Te alla mattina presto (il tour comincia con una colazione in un posto da colazione, aperto).
    // C8e — il controllo della giornata senza colazione: una giornata neutra a Catania non si gonfia col nuovo tetto
    crea('crea-catania-0930', 'Catania', '09:30', 'Una giornata a Catania', { duration: '1 Giorno', pace: 'Attivo' }),
    // TESTI — la giornata di domani a Catania (il meteo di adesso non e' quello di domani; di giorno, con il tempo libero dei vuoti)
    crea('crea-catania-domani', 'Catania', '09:30', 'Domani una giornata a Catania', { duration: '1 Giorno', pace: 'Attivo' }),
    crea('crea-catania-colazione-0800', 'Catania', '08:00', 'Una giornata a Catania con colazione', { duration: '1 Giorno', pace: 'Attivo' }),

    // ── Percorso Veloce (9) — ritmo e umore come QuickPath.jsx (buildQuickPrefs) ──
    veloce('veloce-catania-relax-2125', 'Catania', '21:25', 'relax', 'Veloce'),
    veloce('veloce-catania-relax-2145', 'Catania', '21:45', 'relax', 'Veloce'),
    // TESTI — il Veloce serale dopo le 21:30: il drink e' un «Dopocena», non un «Aperitivo»
    veloce('veloce-catania-relax-2220', 'Catania', '22:20', 'relax', 'Veloce'),
    veloce('veloce-catania-relax-2330', 'Catania', '23:30', 'relax', 'Veloce'),
    veloce('veloce-firenze-cultura', 'Firenze', '10:30', 'cultura', 'Medio'),
    veloce('veloce-palermo-relax', 'Palermo', '14:30', 'relax', 'Veloce'),
    veloce('veloce-roma-rione', 'Roma', '17:00', 'rione', 'Medio', 'In coppia'),
    veloce('veloce-napoli-pizza', 'Napoli', '19:00', 'pizza', 'Veloce', 'Con gli amici'),
    veloce('veloce-siracusa-parco', 'Siracusa', '08:15', 'parco', 'Medio'),
    veloce('veloce-milano-duomo', 'Milano', '12:45', 'duomo', 'Lungo', 'In famiglia'),

    // ── Sorprendimi (5) ──
    sorprendimi('sorprendimi-roma-mattina', 'Roma', '10:30'),
    sorprendimi('sorprendimi-catania-pomeriggio', 'Catania', '15:30'),
    sorprendimi('sorprendimi-milano-sera', 'Milano', '20:30'),
    sorprendimi('sorprendimi-firenze-cultura', 'Firenze', '11:00', 'Cultura'),
    sorprendimi('sorprendimi-napoli-tardi', 'Napoli', '22:30'),

    // ── Per Te (5) ──
    perte('perte-roma-1000', 'Roma', '10:00'),
    perte('perte-roma-1600', 'Roma', '16:00'),
    perte('perte-catania-1300', 'Catania', '13:00'),
    perte('perte-napoli-2000', 'Napoli', '20:00'),
    perte('perte-firenze-1100-veg', 'Firenze', '11:00', VEG),
    // C8a — la sera di Per Te: non cambia (tour tematici senza momenti), si misura.
    perte('perte-catania-1900', 'Catania', '19:00'),
    // C8b — Per Te nelle sue ore: la colazione al mattino presto.
    perte('perte-catania-0830', 'Catania', '08:30'),
];

export const MODI = ['crea', 'veloce', 'sorprendimi', 'perte'];
export const NOMI_MODO = { crea: 'Crea il tuo percorso', veloce: 'Percorso Veloce', sorprendimi: 'Sorprendimi', perte: 'Per Te' };

/** L'istante simulato di un caso: giorno del config + ora di Roma. */
export const istanteSimulato = (caso, esteso) => `${caso.giorno ?? esteso.giornoSimulato}T${caso.ora}:00${esteso.fusoOffset}`;
