# BORGO-DIAGNOSI — perché a Troina la natura non esce, la «giornata» diventa mezza e di sera il riquadro dice «Natura» su un bar

Ramo `borgo-diagnosi` da `main` `012e6a5`. **Solo diagnosi:** nessuna modifica al codice dell'app, nessun deploy, nessuna
migrazione. Suite verde prima del lavoro (2098 test) e dopo (sezione 9).

Giro pagato con l'account di prova (credenziali da `.env.local`), 6 casi, giovedì 15/10 con l'**ora simulata**
(`opts.simulatedNow`: il motore la accetta, quindi nessuna ricostruzione dell'ora). Posizione: il centro di Troina che
risolve il motore (`resolveCityCenter`), come nell'app. Tracciati salvati e rigiocati a 0 $: **6 casi su 6 identici al giro,
0 uscite in rete.**

## In breve

| # | Cosa ha visto Ivano | Cosa succede davvero | Dove si perde |
|---|---|---|---|
| A | «Per Te alle 23: Bar Sunshine 22:58 e Via Conte Ruggero 00:00, riquadro DNA Natura / Parchi e Verde» | **È la schermata del Quiz Veloce Natura, non di Per Te.** Il riquadro «Il tuo DNA Esplorativo» esiste solo nel riepilogo del Quiz (`QuickPathSummary.jsx:79-101`). Il biglietto del server delle 22:58:38 coincide con l'arrivo al bar delle 22:58. Per Te alle 23:00 dà Bar Sunshine e **Piazza** Conte Ruggero, senza riquadro | vedi B |
| B | Natura alle 23:00, nessuna tappa natura | **Quiz Veloce** risponde come ha visto Ivano: bar + via. **Sorprendimi** (la card «Crea il tuo Tour → Su misura per te») dà invece Monte Muganà alle 23:00 | Quiz: di sera il drink è sempre un bar (scelta voluta). **Monte Muganà era candidato per la passeggiata ma a 29 min dal bar, oltre il tetto di 20** (`momentSelection.js`, `MAX_WALK_MINUTES`). Nessun messaggio, e il riquadro dice comunque «Natura» |
| C | «Culturale», 3 tappe, mezza giornata, zero natura | Confermato: Chiesa Madre 10:30, Torre Capitania 10:53, A'Pescheria 12:30, «Troina si gira in mezza giornata.». **Nessuna colazione**: la prima tappa è la Chiesa Madre alle 10:30, come nello screenshot | **Due cause in serie.** 1) La regola del borgo conta solo la lista del server (3 posti utilizzabili su 7, la soglia è 4): giro corto 10:30–13:30, cioè solo mattina e pranzo. 2) La mattina non ammette la natura, e Monte Muganà non ha **nessuna** categoria di momento (`scenic_spot` manca in `TYPE_CATEGORIES`). Monte Muganà e Azienda Silvo Pastorale sono nel pool, ma nessun momento li prende |
| C2 | — | **Identico a C** (stesse tappe, stessi orari, stesso titolo «Culturale…») | L'ora non c'entra: è il borgo |
| D | Pub Black & White mai proposto | Esiste, è OPERATIONAL, 4,6 su 367 recensioni, il giovedì aperto 12:30–15:00 e 19:00–01:00, quindi aperto alle 23. Tipo principale `italian_restaurant` (fra i tipi anche `pub`, `bar`, `irish_pub`). **Entra nel pool, poi nessun momento lo prende** | Passaggio **tipo/momento**: col tipo principale da ristorante ha solo la categoria «cibo». Alle 23 lo scheletro ha solo il dopocena (bar, vita notturna) e la passeggiata, niente cena. La ricerca dei locali della sera non lo restituisce: arriva solo da quella dei ristoranti |
| E | Scheda in home «circa 1h48», dettaglio «1h32» | **Sono due giri diversi.** «circa 1h48» = scheda di **Per Te** (bar 60 min + 18 a piedi + piazza 30 = 108 min). «1h32» = riepilogo del **Quiz** (bar 45 min + 17 + via 30 = 92 min, dalle 22:58 alle 00:30) | Sono due formule diverse in due schermate (sezione 6). Sui giri della sera danno lo stesso numero, quindi la differenza viene dal giro, non dal calcolo |
| Cat. | — | Catania, stesso testo: **13 righe, storia e natura** (Villa Bellini), mattina e pomeriggio | Il difetto è solo dei borghi |

## 1) Come ho girato i casi

- **File dei flussi** (dichiarati):

  | Flusso | Pagina | Chiamata |
  |---|---|---|
  | Per Te | `src/pages/DashboardUser.jsx` | `generateHomeTours`; dalle 18:00 `_homeSera` → `_homeDaMotore` → `generateItinerary` (quick, serale) |
  | Quiz Veloce | `src/pages/QuickPath.jsx` | `generateItinerary`, `pathType: 'quick'` |
  | Crea il tuo Tour | card espandibile in `DashboardUser.jsx:499` | due bottoni: «Con Guida» e «Sorprendimi» → `src/pages/SurpriseTour.jsx` (per categoria) |
  | Crea il tuo Percorso | `src/pages/AiItinerary.jsx` | `generateItinerary`, `pathType: 'custom'` |

  Motore: `src/services/aiRecommendationService.js` (ARS), `momentSelection.js`, `lib/daySkeleton.js`, `lib/cityKnowledge.js`, `lib/borgoConfini.js`.
- **Casi:** `scripts/banco/casi-borgo.js`. Si girano con il banco esteso (`BANCO_CASI=borgo-…`; `esteso.live.js` ora li sceglie per nome, una riga).
- **Ipotesi sulle scelte di Ivano** (non note):
  - Crea: wizard vuoto, solo il testo.
  - Quiz: durata «Veloce», gruppo «Solo».
  - Sorprendimi: categoria Natura.
- **Catania:** il giorno è il 14/10 alle 23:00, quindi il tour è per giovedì 15/10. La lista di Catania del 16/10 non esiste, e generarla avrebbe scritto una lista nuova in produzione. Quella del 15/10 c'è (`c10b-7`, 15 verificati). La lista di Troina del 16/10 c'era già: l'ha creata alle 23:01 del 15/10 il giro C di Ivano.
- **L'imbuto:** `scripts/banco/diagnosi-borgo.giro.js` è il replay dei tracciati (0 $, nessuna rete). Avvolge con `vi.mock`, senza cambiarle, quattro funzioni vere: `applyRadiusFilter`, `selectScoredCandidatePool`, `bucketCandidates`, `applyOpeningToBuckets`. Annota chi entra e chi esce a ogni passaggio. I filtri che il motore scrive solo in console (voto della ricerca, «non visitabile», categoria) vengono dal log del giro, che il replay riproduce identico.

  ```
  REPLAY_IN=docs/prove/dati/2026-10-21-borgo-diagnosi-tracciati.json.gz REPLAY_OUT=<grezzo> DIAG_OUT=<imbuto.json> \
    npx vitest run -c scripts/banco/vitest.diagnosi-borgo.config.js
  ```
  `DIAG_BORGO_MIN=n` è un controfattuale: cambia la soglia della mezza giornata del borgo.

## 2) Le catene, caso per caso

«Utilizzabili» = posti della lista che contano per la regola del borgo. I numeri del merito riguardano solo i candidati delle
ricerche: i posti della lista non passano da quel filtro.

### A — Per Te, 23:00

- **Richiesta:** nessun testo. Dopo le 18 Per Te è il giro della sera: Veloce, 120 minuti da adesso.
  - Intenzioni: natura no, storia no, giornata no.
- **Lista:** 7 verificati; 3 utilizzabili, sotto la soglia di 4. Ne segue il giro corto, 120 min dalle 23:00.
- **Ricerche:**
  - ristoranti: 10 risultati;
  - «museo chiesa palazzo storico…»: 5;
  - mirata dei locali della sera: 13.
- **Imbuto:**
  1. **Raggio:** 19 → 18 (Antica Osteria, 17,7 km).
  2. **Merito:** 14 → 12 (Bar Pour Toi, MACTRO).
  3. **Momenti:** pool di 16, dopocena con 0 candidati, quindi ricerca mirata.
  4. **Ricerca mirata:**
     - raggio 9 → 5 (4 bar fra 24 e 37 km);
     - merito 5 → 3;
     - pool di 19: dopocena 3 (Terzo Tempo, Bar Nazionale, Bar Sunshine), passeggiata 3 (Piazza e Via Conte Ruggero, Ponte di Failla).
  5. **Senza momento:** 13 posti, fra cui Black & White e tutte le chiese e i musei.
  6. **Orari all'arrivo:** Terzo Tempo e Bar Nazionale chiusi.
- **Finale:** Bar Sunshine 23:00, Piazza Conte Ruggero 00:18. L'ultima tappa dice «Qui la giornata si chiude.».

### B1 — Quiz Veloce Natura (Parchi e Verde), 23:00 — risponde come ha visto Ivano

- **Richiesta:** «parchi», categoria `natura`.
  - Intenzioni: natura sì, storia no, giornata no.
- **Ricerche:**
  - «orto botanico»: 12;
  - «giardino pubblico»: 20;
  - «villa comunale parco»: **timeout a 5 s, nessun risultato**.
  - Dopo i filtri della ricerca restano 17 candidati. Tolti 2 alberghi e un'agenzia («non visitabile»), 1 posto a più di 100 km, 2 sotto il voto.
- **Imbuto:**
  1. **Raggio:** 22 → 18 (orti botanici di Catania, 52 km, e dell'Università, 95 km; Parco dei Nebrodi, 17,5 e 18,8 km). Anche con i 12 km della natura nei borghi resterebbero tutti fuori.
  2. **Categoria natura:** 14 su 18 tolti (RAGGIO-CATEGORIA).
  3. **Pool:** 4 (San Silvestro, Piazza, Via, Monte Muganà).
  4. **Scheletro della sera:** dopocena (bar) + passeggiata (panorami, passeggiata, natura). Il dopocena non ha candidati, quindi ricerca mirata dei locali: 13, raggio → 8, merito → 5; dopo gli orari resta Bar Sunshine.
  5. **Passeggiata**, 3 candidati:
     - Via Conte Ruggero, 17 min dal bar: **scelta**;
     - Piazza Conte Ruggero, 18 min: pari merito;
     - **Monte Muganà, 29 min: «oltre il tetto di cammino»**.
- **Finale:** Bar Sunshine 23:00, Via Conte Ruggero 00:02.
- **Sullo schermo:**
  - il riquadro dice «Natura / Parchi e Verde»;
  - la nota dice «Troina si gira in mezza giornata.» (anche alle 23, per un giro di due ore);
  - nessun messaggio sulla natura.

### B2 — Sorprendimi Natura («Crea il tuo Tour → Su misura per te»), 23:00

- **Richiesta:** categoria Natura, da `SurpriseTour.jsx`, 240 minuti da adesso.
- **Ricerche:**
  - «riserva naturale»: 20;
  - «belvedere panorama»: 1;
  - «sentiero naturalistico»: 1, che non passa il controllo Google-first.
  - Sotto il voto della ricerca: 3 su 20, cioè Sambuchetti (4,0 su 2), **Parco Monte Troina** (3,8 su 98, a 45 km: un omonimo lontano), Pineta del Simeto.
- **Imbuto:**
  1. **Raggio:** 19 → 11 (8 riserve fra 17 e 73 km).
  2. **Categoria:** 4 su 11 tolti.
  3. **Merito:** 4 → 3. Il tolto è il **Belvedere della Piazza Conte Ruggero** (5,0 ma 8 recensioni; il borgo ne chiede 10).
  4. **Scheletro:** nessun momento della sera senza vita notturna, quindi la riserva «mai vuoto» prende il dopocena e lo trasforma in «natura».
  5. **Orari:** tolti San Silvestro, la piazza, la via, l'Azienda Silvo Pastorale. Restano Monte Muganà e «Cammina con Turi», entrambi aperti 24 ore per Google.
- **Finale:** Monte Muganà 23:00 («Alle 23 sei a Monte Muganà»), «Cammina con Turi – Escursioni Nebrodi» (un'agenzia di escursioni), tempo libero.
- **Sullo schermo:** la durata è «3h», fissa (`SurpriseTour.jsx:294`, `duration_minutes: 180`); il giro reale dura 79 min.

### C — Crea il tuo Percorso, «fammi fare domani una giornata tra natura e luoghi storici», 23:00

- **Intenzioni lette:**
  - il traduttore restituisce le query «riserva naturale», «centro storico», «castello», `categoria = misto` («natura e storia»);
  - natura sì e storia sì, ma **solo come query**. Con `misto` non c'è filtro di categoria e non scatta l'estensione a 12 km della natura nel borgo (`catStretta === 'natura'`, ARS:2657);
  - il tipo per la soglia di voto è CULTURA;
  - «domani» → giornata 09:30–22:30 (`parseDay`, `resolveTourWindow`). «Giornata» non ha regola sua: la porta già «domani».
- **Regola del borgo** (ARS:2549-2571):
  - 7 verificati, 3 utilizzabili: Chiesa Madre, Chiesa San Nicolò, Torre Capitania. Esclusi Via e Piazza Conte Ruggero (storiche), La Contea dei Normanni (ristorante), San Silvestro (Google le dà solo tipi generici);
  - 3 < 4, quindi **giro corto di 180 min**, fascia 10:30–13:30, con la riga «Troina si gira in mezza giornata.».
- **Ricerche:**
  - «centro storico»: 1, un B&B tolto come non visitabile;
  - «riserva naturale»: 20;
  - «castello»: 9;
  - ristoranti: 10.
  - Sotto il voto: 3 su 20, gli stessi di B2.
- **Imbuto:**
  1. **Raggio:** 20 → 10 (8 riserve fra 17 e 73 km, Castello Normanno a 24,7 km, Castello di Torremuzza a 14,8 km).
  2. **Merito:** 5 → 4 (Chiesa San Nicolò).
  3. **Pool di 9**, con le categorie di momento:
     - Chiesa Madre: cultura, monumenti;
     - Torre Capitania: musei, cultura, monumenti;
     - Via e Piazza: passeggiata;
     - Contea: cibo;
     - **Monte Muganà (`scenic_spot`): nessuna categoria**;
     - **Azienda Silvo Pastorale (`park`): natura**;
     - San Silvestro e Cammina con Turi: nessuna.
  4. **Scheletro:** mattina (cultura, monumenti, musei, passeggiata) ×1 e pranzo. Non c'è pomeriggio, perché la fascia finisce alle 13:30.
  5. **Momenti:** mattina 4 candidati, tutti della lista. **Senza momento: Monte Muganà, Azienda Silvo Pastorale, San Silvestro, Cammina con Turi. Qui si perde la natura.**
  6. **Orari:** al pranzo 3 ristoranti chiusi all'arrivo.
- **Finale:** Chiesa Madre 10:30, Torre Capitania 10:53, A'Pescheria 12:30. Titolo dell'AI: «Culturale viaggio di Troina».
- **Le tre domande del task:**
  1. **La richiesta con due intenzioni ne perde una?** Sì. Il traduttore le tiene tutte e due solo come ricerche: la natura viene trovata (Monte Muganà, Silvo Pastorale) e poi si perde allo scheletro, non alla ricerca.
  2. **I posti natura di TROINA-FIX entrano nel conto dei verificati?** No. Il conto (`postiBorgo`, ARS:2549) è fatto **solo** sulla lista del server, che nel borgo ha chiese, torre, piazza, via e un ristorante. I posti trovati dalle ricerche non contano mai, natura compresa. Monte Muganà è a 1,5 km, dentro il raggio di 5 km anche senza i 12 km della natura.
  3. **La mezza giornata scatta perché la natura resta fuori dal conto?** Sì. Con i due posti natura del pool (Monte Muganà, Silvo Pastorale) gli utilizzabili sarebbero 5, sopra la soglia di 4.
- **Controfattuale a 0 $** (`DIAG_BORGO_MIN=0`, stesso tracciato):
  - senza giro corto la giornata ha mattina, pranzo, pomeriggio, aperitivo e cena;
  - **la natura entra**: Azienda Silvo Pastorale nel pomeriggio, Monte Muganà come passeggiata (per `isOutdoorWalk`, non per categoria);
  - il controfattuale non è un giro completo: 2 ricerche nuove (pasti da un altro punto, locali della sera) non sono nel tracciato, quindi quei momenti restano «tempo libero», e il prompt del selettore cambia.

### C2 — lo stesso testo alle 10:00

Identico a C: stesse ricerche, stesso imbuto, stesse 3 tappe agli stessi orari, titolo «Culturale visita di Troina». Con «domani» l'ora della richiesta non conta: **il difetto è del borgo, non della sera.**

### Confronto — lo stesso testo a Catania (23:00 del 14/10, tour del 15/10)

- **Intenzioni:** query «villa comunale parco», «sito archeologico», «palazzo storico», `misto`, tipo CULTURA per una città grande.
- **Imbuto:**
  1. **Voto** (4,0 su 50 nelle città grandi): scartati 12 su 20 e 10 su 20.
  2. **Raggio:** 32 → 28 (4 ville comunali di altri comuni).
  3. **Lista:** 15 verificati, 14 nel pool.
  4. **Merito:** 14 → 12.
  5. **Momenti:** pool di 26. Mattina 18, **pomeriggio 22 (con 4 posti natura)**, passeggiata 10.
- **Finale:** 13 righe, 09:30–21:15. Storia: Cattedrale, Fontana dell'Elefante, Palazzo dei Chierici, Castello Ursino, Villa Cerami, Palazzo Platamone. Natura: Villa Bellini. Più pranzo, aperitivo, Via Etnea, cena.
- **Natura e storia ci sono tutte e due.**
- **Difetto di contorno:** Villa Bellini compare due volte, come due schede Google diverse dello stesso parco («Parco Maestranze» e «Giardino Bellini»). È il difetto già noto da PIENA-2 («lo stesso posto non torna»), non è del borgo.

## 3) D — Black & White, passaggio per passaggio

| Passaggio | Esito |
|---|---|
| Esiste su Google | Sì: OPERATIONAL, 4,6 su 367 recensioni, tipo principale `italian_restaurant`; tipi `irish_pub`, `pub`, `bar`, `restaurant`… |
| Orari | Lun chiuso. Mar–gio 12:30–15:00 e 19:00–01:00. Ven–sab–dom 12:30–15:00 e 19:00–03:00. **Giovedì alle 23 è aperto** |
| Ricerca | Esce dalla ricerca **dei ristoranti** (A, B1, C). Non esce da «bar cocktail pub locale musica vino Troina», la mirata della sera |
| Raggio, comune | Passa (0,6 km dal centro) |
| Merito | Passa in A e B1. In C è tolto (8 → 5), per affinità e voto fra i ristoranti |
| **Tipo / momento** | **Qui si perde.** Col tipo principale da ristorante il motore gli dà solo la categoria «cibo» (`candidateMomentCategories`: un locale ha solo le categorie del suo tipo). Alle 23:00 i momenti sono dopocena (bar, vita notturna) e passeggiata: la cena finisce alle 22:30. Nessun momento lo ammette. In A e B1 è fra i «senza momento» |
| Orario all'arrivo, zona, AI | Non ci arriva |

Bar Sunshine (4,4 su 348, tipo principale `bar`, giovedì 05:30–02:00) è l'unico locale della sera rimasto aperto dopo gli orari.

## 4) E — da dove viene ciascun numero

| Schermata | Formula | Giro | Valore |
|---|---|---|---|
| Scheda in home (Per Te) | `totalTourMinutes`: somma di soste + spostamenti, senza attese (`DashboardUser.jsx:300`, `tourTiming.js:196`) → `formatEstimate` | Per Te: Bar Sunshine (sosta 60, ritmo rilassato) + 18 min + Piazza 30 | **108 → «circa 1h 48min»** |
| Dettaglio di Per Te (`TourDetails.jsx:1019`) | stampa la stessa stringa | stesso giro | «circa 1h 48min» |
| Riepilogo del Quiz (`QuickPathSummary.jsx:26`) | `tourSpanMinutes`: sull'orologio, dal primo arrivo alla fine dell'ultima sosta | Quiz: Bar Sunshine (sosta 45) + 17 + Via 30 | **92 → «1h 32m»** |
| Scheda di Sorprendimi (`SurpriseTour.jsx:294, 438`) | fissa | qualunque giro | «3h» (il giro reale dura 79 min) |

- **Su uno stesso giro le due formule divergono solo quando ci sono attese:**

  | Giro | Somma | Orologio |
  |---|---|---|
  | A | 108 | 108 |
  | B1 | 92 | 92 |
  | B2 | 79 | 79 |
  | C, C2 | 160 | 195 (35 min di attesa prima del pranzo) |
  | Catania | 601 | 705 (104 min) |

- La somma è anche quella delle Notifiche (`Notifications.jsx:177`).

## 5) I 5 controlli di pertinenza (decisi prima dei numeri, applicati alla lettera)

| Caso | 1 Natura | 2 Due intenzioni | 3 Giornata | 4 Durata scheda = dettaglio | 5 Colazione |
|---|---|---|---|---|---|
| A Per Te | — non chiesta | — | — | ✅ 108 = 108 | non compare |
| B1 Quiz Natura | ❌ | — | — | — | non compare |
| B2 Sorprendimi Natura | ✅ | — | — | ❌ | non compare |
| C Crea 23:00 | ❌ | ❌ | ✅ | — | non compare |
| C2 Crea 10:00 | ❌ | ❌ | ✅ | — | non compare |
| Catania | ✅ | ✅ | ✅ | — | non compare |

Note sulle singole celle:
- **B1, controllo 1:** Monte Muganà era raggiungibile (candidato della passeggiata), ma è stato scartato; nessun messaggio, e il riquadro «Natura» sta su un bar e una via.
- **B2, controllo 1:** Monte Muganà c'è, ma alle 23.
- **B2, controllo 4:** la scheda dice «3h», il giro dura 79 min.
- **C e C2, controllo 1:** Monte Muganà e Silvo Pastorale erano nel pool; zero tappe natura e nessun messaggio.
- **C e C2, controllo 2:** c'è solo la storia.
- **C e C2, controllo 3:** passa per il messaggio «Troina si gira in mezza giornata.», ma il messaggio dà una ragione falsa: la natura c'era.
- **Catania:** controllo 1 con Villa Bellini; controllo 3 con mattina e pomeriggio.
- **Controllo 4 dove c'è il trattino:** la schermata mostra un solo numero.

**Errori:** 4 casi su 6 hanno almeno un ❌ (B1, B2, C, C2); A e Catania passano. Il caso di Ivano «stesso giro, 1h48 contro 1h32» non è un errore del controllo 4: sono due giri (sezione 4). La colazione di Ivano in C non c'è: la prima tappa è la Chiesa Madre alle 10:30.

## 6) Le cause, con le proposte (non applicate)

La direzione è quella di Ivano: nel borgo il filtro si allenta, nelle città resta com'è. Ogni proposta vale **solo con
`scala === 'borgo'`**, tranne dove è detto.

**Causa 1 — la mezza giornata del borgo conta solo la lista** (ARS:2549, `postiBorgo`; `cityKnowledge.js:71`)
- **1a.** Nel conto dei «posti da visitare» entrano anche i posti natura e panorama delle ricerche (`isNaturaOPanorama`, entro `NATURA_BORGO_KM`, che passano voto e orari), almeno quando il testo chiede natura (`requestedFamilies` → verde).
  - *Effetto:* in C gli utilizzabili passano da 3 a 5 e la giornata è intera: il controfattuale mostra la natura nel pomeriggio e nella passeggiata. Città: nessuno, la regola vale solo nel borgo.
  - *Non risolve:* un borgo senza natura vicina resta a mezza giornata. I pasti e la sera della giornata intera richiedono ricerche in più (≈ +0,07 $ a giro, 2 ricerche).
- **1b.** Con «giornata» o «domani» nel testo il borgo non scende sotto mattina + pomeriggio. Il giro corto resta per le richieste senza durata.
  - *Effetto:* C e C2 hanno il pomeriggio, che ammette la natura.
  - *Non risolve:* il pomeriggio di un borgo piccolo può riempirsi di «tempo libero».

**Causa 2 — i tipi della ricerca nuova non hanno categoria di momento** (`momentSelection.js:73`, `TYPE_CATEGORIES`)
- Mancano `scenic_spot`, `observation_deck`, `hiking_area`, `nature_preserve`, `national_park`, `state_park`, `garden`. `borgoConfini.js:23` li conosce già.
- **2a.** Aggiungerli: `scenic_spot` e `observation_deck` → «punti panoramici», «natura»; gli altri → «natura».
  - *Effetto:* Monte Muganà e il Belvedere entrano nel pomeriggio e nell'aperitivo panoramico.
  - *Città:* **cambia anche le città** (è riconoscimento del tipo, non un filtro), quindi va misurato col replay dei 10 casi di PIENA-2 prima di decidere.
  - *Non risolve:* la mattina, che non ha «natura» fra le sue categorie.
- **2b.** Se Ivano vuole le città intatte: la stessa tabella, solo nel borgo.

**Causa 3 — di sera il Quiz Natura non privilegia la natura e la scarta per il cammino** (`momentSelection.js`, passeggiata, `MAX_WALK_MINUTES = 20`)
- **3a.** Con natura chiesta, la passeggiata della sera prende per prima una natura o un panorama entro il tetto. È la regola `dellaRichiesta` di `polishRoute`, portata alla scelta. Nel borgo il tetto per quella tappa sale a 30 min.
  - *Effetto:* B1 avrebbe Monte Muganà a mezzanotte. Città: nessuno con il tetto solo nel borgo.
  - *Non risolve:* un monte di notte è una proposta discutibile.
- **3b.** Di sera, con natura chiesta e nessuna natura sensata, al posto del riquadro «Natura» un messaggio: «Di sera la natura di [città] non si visita: ti propongo un giro della sera» (testo da decidere con Ivano), e il riquadro mostra ciò che il giro è davvero.
  - *Effetto:* niente più «Natura» su un bar, nel borgo e in città.
  - *Non risolve:* non dà la natura.
- **Consiglio la 3b per la sera e la 3a solo di giorno**, ma è una decisione di prodotto.

**Causa 4 — il riquadro DNA ripete la scelta del quiz, non il giro** (`QuickPath.jsx:1066-1073`)
- Coperta dalla 3b.
- Variante minima: se nessuna tappa è della categoria scelta, il riquadro non la mostra.
- *Non risolve:* niente sul giro.

**Causa 5 — Black & White: un locale che è ristorante e pub non entra nel dopocena** (`candidateMomentCategories`, `COMMERCIAL_KINDS`)
- **5a.** Nel borgo, nel dopocena, è ammesso anche un posto aperto all'arrivo che ha `bar` o `pub` fra i tipi, anche se il tipo principale è da ristorante: «se ci sono due cose non se ne scarta una».
  - *Effetto:* Black & White entra fra i candidati del dopocena accanto a Bar Sunshine. Città: nessuno, perché la regola C7 «un cocktail bar marcato `restaurant` è un bar» resta com'è.
  - *Non risolve:* la scelta fra i due la fa il merito; nessuna garanzia che vinca Black & White.
- **5b.** La ricerca mirata della sera nel borgo aggiunge «pub» al testo.
  - *Non risolve:* da sola non basta, il filtro del tipo resta.

**Causa 6 — il merito del borgo chiede 10 recensioni** (`candidateScoring.js:26`)
- **6a.** Nel borgo il minimo scende a 5 per natura e panorami.
  - *Effetto:* il Belvedere della Piazza Conte Ruggero (5,0 su 8) entra.
  - *Città:* nessuno, a patto che la soglia si legga da `scala === 'borgo'` e non da `isSmallTown`, che vale anche per città medie come Lecce.
  - *Non risolve:* niente di C, dove la natura c'era già.

**Causa 7 — le due durate** (`DashboardUser.jsx:300` contro `QuickPathSummary.jsx:26`; `SurpriseTour.jsx:294`)
- **7a.** Una sola funzione per la durata mostrata: l'orologio (`tourSpanMinutes`) quando ci sono gli orari, la somma solo senza. Sorprendimi usa la stessa, non 180 fisso.
  - *Effetto:* stesso numero ovunque, borghi e città.
  - *Non risolve:* Per Te e Quiz restano due giri diversi (soste 60 e 45 min).

**Causa 8 — «Qui la giornata si chiude» nei giri della sera di Per Te** (ARS:2083-2094)
- `stopData` qui non riceve `giornata: false`, che invece passa nel percorso dei temi (ARS:3835).
- **8a.** Passarlo nel giro della sera e nel tour misto del borgo.
  - *Effetto:* frase giusta, borghi e città.
  - *Non risolve:* nient'altro.

## 7) Come aggiungere i controlli a `banco:guardia` (non scritti)

- **Funzione:** una funzione pura `controllaPertinenza(caso)` accanto a `controllaGuardia` (`guardia-home.js`), sul grezzo del giro o del replay. Usa solo campi che il grezzo ha già. Solo per il controllo 1 e il 3 serve una riga in più nel grezzo.
- **Casi:** quelli di `casi-borgo.js`, più quelli della guardia. I tracciati sono salvati, quindi tutto gira a 0 $.
- **Uscita:** la guardia fallisce su ❌; il «—» non conta.

| # | Come si legge dal grezzo |
|---|---|
| 1 | **Natura chiesta:**<br>• quiz `scelta.main === 'natura'`;<br>• Sorprendimi `tema === 'Natura'`;<br>• Crea, se il testo passa `requestedFamilies` → verde.<br>**Tappa natura:** `types` in `TIPI_NATURA`, oppure `isNaturaOPanorama`.<br>**Raggiungibile:** una natura in `pool[momento].candidati`, o fra i «senza momento» dell'imbuto (riga nuova nel grezzo: `rec.senzaMomento`).<br>**Messaggio:** una nota in `schermo.note` che nomina la natura.<br>**Riquadro:** il quiz lo mostra sempre col titolo della scelta: `chiamata.prefs` + `scelta.subTitle`; è ❌ se c'è e nessuna tappa è natura |
| 2 | **Intenzioni:** le query del traduttore per famiglia (riga nuova nel grezzo: `rec.intento = { queries, categoria }`), oppure le famiglie del testo.<br>**Presenza:** ogni famiglia chiesta ha almeno una tappa (`famiglia`/`types`) |
| 3 | **«Giornata» o «domani» nel testo:** `schermo.sezioni` contiene Mattina e Pomeriggio, oppure `schermo.note` ha una riga che spiega perché meno |
| 4 | Somma (`stay` + `min`) e orologio (primo `at` → ultimo `at` + `stay`) dello stesso tour, calcolati con le funzioni vere di `tourTiming.js` (`totalTourMinutes`, `tourSpanMinutes`) sulle schermate che il flusso mostra.<br>Per Sorprendimi conta il 180 fisso della pagina |
| 5 | Conta le tappe con `_tema === 'colazione'` o `isBreakfastPlace`: solo un numero nel report, la regola la decide Ivano |

## 8) Spesa

| Voce | Spesa |
|---|---|
| Giro dei 6 casi (`BANCO_TETTO=1.35`), listino del banco | **0,897 $** |
| Replay, imbuto, controfattuale, cache Places, Supabase in lettura | 0 $ |
| **Totale** | **0,897 $** su 1,5 $ (stop a 1,35 $) |

Per caso: A 0,125, B1 0,131, B2 0,131, C 0,167, C2 0,167, Catania 0,177.

## 9) File, prove e produzione

| File | Contenuto |
|---|---|
| `docs/prove/dati/2026-10-21-borgo-diagnosi.json` | grezzo del giro |
| `docs/prove/dati/2026-10-21-borgo-diagnosi-tracciati.json.gz` | tracciati nel formato del replay (`tracciato-banco/1`) |
| `scripts/banco/casi-borgo.js` | i casi |
| `scripts/banco/esteso.live.js` | una riga: sceglie anche i casi del borgo per nome |
| `scripts/banco/diagnosi-borgo.giro.js` + `vitest.diagnosi-borgo.config.js` | l'imbuto |

- **Rigiocare a 0 $:**
  ```
  npm run banco:replay -- docs/prove/dati/2026-10-21-borgo-diagnosi-tracciati.json.gz --confronta docs/prove/dati/2026-10-21-borgo-diagnosi.json
  ```
  Oggi dà 6 su 6 identici, 0 uscite in rete.
- **Privacy:** nessun token, email o UUID nei file (controllato). Le posizioni sono quelle dei posti di Google, non di persone.
- **Produzione:**
  - codice, proxy e database invariati: nessun deploy, nessuna migrazione;
  - **nessuna lista nuova**: `city_knowledge` ha 0 righe dopo l'avvio del giro;
  - il giro ha scritto, come ogni banco, 6 biglietti con `label = 'test'` in `ai_generation_ticket` e le righe di cache delle sue ricerche in `places_cache` (condivisa, scade in 24 h).
- **Suite:** 2098 verdi prima e dopo; i file nuovi non entrano nella suite.

## Cosa ho dato per vero senza verificarlo

- **Che la schermata A di Ivano sia il Quiz e non Per Te.** Lo dicono il riquadro (esiste solo nel Quiz), le tappe e l'orario (22:58, come il biglietto del server delle 22:58:38). Non ho lo screenshot e non so cosa abbia mostrato il suo Per Te delle 22:57.
- **Le scelte di Ivano:** wizard di Crea vuoto, durata del Quiz «Veloce», gruppo «Solo». Con «Medio» il giro della sera può cambiare.
- **Che la sua posizione non conti.** Il motore usa il centro della città risolto da Google, non il GPS, nel Quiz e in Crea; l'ho dedotto dal codice (`resolveCityCenter`).
- **Che Catania col tour del 15/10 valga come col tour del 16/10.** La lista del 16/10 non esiste: ho usato quella del 15/10 per non scrivere in produzione. Gli orari di Google sono quelli di un giovedì invece che di un venerdì.
- **Che 1h48 e 1h32 vengano dai due giri che ho ricostruito.** I numeri tornano esatti (108 e 92), ma non ho visto le schermate di Ivano.
- **Che Monte Muganà a 29 min dal bar sia una stima fedele.** È la stima del motore in linea d'aria, non un percorso su strada, ed è in salita.
- **Che «Azienda Speciale Silvo Pastorale» e «Cammina con Turi» siano posti da visitare.** Per Google sono un `park` e un posto generico; dai nomi sembrano un ente forestale e un'agenzia di escursioni. Non ho aperto le schede.
- **Il controfattuale della giornata intera:** 2 ricerche nuove non sono nei tracciati, quindi il giro intero vero può differire nei pasti e nella sera. La natura che entra, invece, viene dal pool già registrato.
- **I 2 biglietti per ogni Per Te di Ivano** (22:57:15 e 23:00:40, due per volta): ho visto i conteggi, non perché siano doppi. Potrebbe essere la home che genera due volte. Fuori perimetro, da guardare.
- **L'effetto della proposta 2a sulle città** non è misurato: richiede un cambio della tabella dei tipi che il replay non sa simulare senza toccare il codice.
