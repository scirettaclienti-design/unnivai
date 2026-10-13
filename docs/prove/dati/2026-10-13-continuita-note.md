---

## Diagnosi (prima di toccare il motore)

### (a) Catania, martedì 13/10 ore 13:48, Crea senza testo — perché il pomeriggio si fermava

Riprodotto con l'account di prova e l'ora simulata (grezzo: `2026-10-13-banco-esteso-continuita-prima.json`, motore `c71100f`, costo 0,123 $). Le tappe: Palazzo degli Elefanti 14:30 (30 min), Museo Vincenzo Bellini 15:03 (60 min), poi **niente fino all'aperitivo delle 18:00**: 116 minuti senza tappa né riga (nella tua prova erano circa 157, perché la tua seconda tappa era la chiesa da 20 minuti; il pool di Google cambia da una chiamata all'altra).

Il pool del pomeriggio (9 posti dopo il filtro orari) e il loro stato alle 16:05, dal grezzo:

| Ipotesi | Esito |
|---|---|
| Posti chiusi 13–16 | **No.** Erano già stati tolti prima della scelta Palazzo dei Chierici e Palazzo Biscari (chiusi all'arrivo). Alle 16:05 era chiuso il solo Monastero dei Benedettini. |
| Durate nuove (C6a) | **In parte.** Due tappe da 30 + 60 minuti coprono 90 minuti su 210; con la chiesa da 20 minuti (il tuo caso) ne coprono 50. Ma le durate sono quelle giuste: da sole non spiegano il buco. |
| Tetto di cammino | **No.** Un solo posto (Museo degli Antichi Strumenti di Scrittura, 23 min) era oltre il tetto. |
| Numero di tappe del momento | **Sì, è la causa.** Il pomeriggio dura 210 minuti (14:30–18:00), cioè ≥ 180: ritmo Attivo ⇒ **2 tappe** (`daySkeleton.stopsFor`). Il codice sceglie esattamente 2 tappe e non guarda quanto tempo resta. Nel pool avanzavano **almeno 4 posti aperti** a portata di piedi (Chiesa di San Francesco Borgia, Museo Diocesano, Palazzo Platamone, e due con orario sconosciuto: Palazzo della Cultura, Odeon Romano). |

Cioè: i momenti cominciano a ore fisse (pranzo 12:30, aperitivo 18:00), lo scheduling mette ogni tappa all'inizio del suo momento e ricorda l'attesa in `waitMinutesBefore`, ma nessuno guardava se quell'attesa fosse ore. Con soste corte (20–60 min) e 1–2 tappe per momento l'attesa vale spesso più di un'ora.

### (b) crea-firenze-arte — le 4 tappe dopo il tempo libero senza orario

La mattina tutta chiusa diventava una riga di tempo libero **in testa** al giorno. La prima tappa vera dopo di lei ha `travelMinutesFromPrev = null` (per scelta: la prima tappa del giorno non cammina da nessuna parte, non si usa il GPS). `computeCumulativeOffsets` leggeva quel `null` come «dato mancante», lo faceva **assorbire** e dava `null` a quella tappa e a tutte le successive: 4 tappe senza `scheduledTime`, quindi senza orario a schermo e «sconosciute» per il banco. La riga di tempo libero, intanto, aveva sosta 0: la mattina «libera» non occupava nessun tempo.

### Gli stessi difetti in tutti i grezzi salvati (0 $)

c11 (scritta dopo, vedi sotto) applicata ai grezzi del banco esteso già fatti. Nessun grezzo ha tempo libero con fascia: i buchi qui sono quelli che il motore di allora lasciava.

| Grezzo | Casi misurati | Casi con buchi | Buchi | Minuti di buco | Tappe senza orario |
|---|---|---|---|---|---|
| banco-esteso (legacy) | 25 | 13 | 23 | 2312 | 0 |
| banco-esteso-new | 25 | 13 | 23 | 2325 | 0 |
| banco-esteso-orari | 25 | 13 | 24 | 2487 | 0 |
| banco-esteso-c6a | 25 | 12 | 22 | 2262 | 4 (crea-firenze-arte) |
| banco-esteso-festivi (10 casi) | 8 | 6 | 10 | 909 | 4 (crea-firenze-arte) |
| continuita-prima (Catania 13:48) | 1 | 1 | 2 | 206 | 0 |
| **banco-esteso-continuita (questo giro)** | **26** | **0** | **0** | **0** | **0** |

Il difetto dei buchi c'è in tutti i giri, fin dal primo (è del flusso a momenti, non di una modifica recente): in media quasi un caso su due, circa 100 minuti a buco. Le «tappe senza orario» compaiono da C6a in poi, solo in crea-firenze-arte (l'unico caso con la mattina chiusa).

## Cosa è stato fatto

- **Regola** (`src/lib/continuity.js`, `momentSelection.fillGaps/gapRows`). Un'attesa di oltre 45 minuti fra due tappe è un errore. Prima si prova ad aggiungere **una tappa in più nel momento che contiene il buco** (mattina, pomeriggio, dopocena), ripetendo la scelta con le regole di sempre (varietà, percorso, tetto di cammino, orari); il tentativo vale solo se dà una tappa vera in più e meno minuti di buco, e non peggiora niente: nessun ripiego, nessun tempo libero, nessuna tappa tolta, **nessun pasto in più**. Se non c'è, il buco diventa una riga di tempo libero (testo già approvato) **con la sua fascia**: `stayMinutes` = l'attesa che prima stava sulla tappa dopo, che ora non aspetta più. Più righe di tempo libero di fila si dividono l'attesa per fascia dei loro momenti.
- **Orari dopo un tempo libero** (`tourTiming.computeCumulativeOffsets`). La prima tappa vera dopo un tempo libero in testa al giorno non rompe più la catena.
- **A schermo.** `AiItinerary` e l'elenco compatto di Percorso Veloce / Sorprendimi (`TourStopsByMoment`) mostrano il tempo libero con la fascia «HH:MM–HH:MM»; le tappe tengono il loro orario. Sorprendimi costruiva il tracciato, i waypoint e la copertina anche con le righe di tempo libero (senza coordinate: «null null»): ora usa le tappe vere.
- **Banco.** Nuova classe **c11** («buco non dichiarato oltre 45 minuti, o tappa senza orario», `controlli.js`, soglia in `banco.config.json`): codice del banco, indipendente dal motore (cammino haversine a 4,5 km/h ricalcolato). Validata prima del giro: **rossa** sul caso Catania 13:48 (116 + 90 minuti) e su Firenze (4 tappe senza orario), **verde** su un pomeriggio pieno e su uno con la riga di tempo libero con fascia (il validatore ha anche smascherato un buco di 54 minuti nel mio primo esempio «buono»). Nuovo caso `crea-catania-1348` nella matrice (31 casi), con il suo giorno simulato.
- Chiavi di cache del browser: itinerari `unnivai_insiderf14_festivi_` → `unnivai_insiderf15_continuita_` (i giri in cache hanno buchi non dichiarati e tempo libero senza fascia).
- Non toccati: regola orari, durate (C6a), varietà, percorso, frasi approvate, quote, prompt del modello. Costo per generazione invariato ($0,144 → $0,144; tappe vere 137 → 136): il riempimento è tutto calcolo, nessuna chiamata in più.

## Prove (rosso → verde)

Suite 1680 → **1718** verdi (stesso gate della CI: lint 0 errori, test, build). Provati sul codice di prima (`c71100f`, in un worktree) e **tutti rossi** lì, verdi qui:

- `continuita.test.js` (motore intero): un pomeriggio con 2,5 ore vuote viene **riempito** (più di 2 tappe, nessun buco); con 3 soli posti viene **dichiarato** con la fascia; con ritmo Rilassato non si aggiungono tappe; un giro con tempo libero in testa ha l'orario su **tutte** le tappe dopo, e il primo è quello del suo momento (14:30); una tappa dopo il tempo libero **chiusa a quell'ora è sostituita** e quella che la sostituisce ha l'orario; mai più di 8 tappe al giorno; una tappa in più non è mai un altro pasto (`nei ristoranti tipici`: rosso se si spegne la regola).
- `continuity.test.js` (parti pure): buchi, fascia, divisione fra più righe, orari dopo un tempo libero in testa (rosso senza la correzione di `computeCumulativeOffsets`).
- Resa: `aiItinerary_timeline.test.js`, `tourStopsByMoment_tempoLibero.test.jsx` (fascia 09:50–12:30, numeri solo sulle tappe).
- Banco: c11 (rosso/verde, soglia 45/46, cammino tolto dal buco, prima tappa, Per Te non applicabile).
- 18 test di prima diventati rossi, letti uno per uno: 17 contavano le righe di un giro (che ora ha anche le righe di tempo libero dei buchi) e ora asseriscono le stesse cose sulle tappe vere; 1 (`pastiSempreCibo`) ha trovato un difetto mio, corretto nel codice: la riga di un buco dopo un pranzo saltato non deve portare l'intestazione «Pranzo».

## Cosa ho letto dal giro

- **c11: 26 violazioni in 13 casi → 0**, in tutte e 3 le modalità con orari (Crea 21 → 0, Veloce 2 → 0, Sorprendimi 3 → 0; Per Te non si applica). **Tappe senza orario 4 → 0.** Il caso di Ivano (Catania 13:48): pomeriggio con **5 tappe** (14:30–17:32), poi l'aperitivo alle 18:00; il vuoto fra l'aperitivo e la cena (97 minuti) è una riga di tempo libero 18:20–19:57. **c5 resta 0** su tutti e 31 i casi.
- **Percorso (C5c) 3 → 3, verità 0 → 0, ripetizioni 1 → 1**, nessuna voce peggiora oltre la varianza (Giornata 17 → 14, Distanze 8 → 7, Famosità 3 → 2; solo crea-siracusa diventa rosso su Distanze). Altre classi: c4 6 → 3, c3 3 → 1, c6 1 → 0, c8 20 → 19; c1 39 → 37, c2 8 → 6; c7 23 → 24 (compreso il nuovo caso Catania con 2: frasi approvate uguali ripetute 3–4 volte quando un momento ha più tappe).
- **Il riempimento ha aggiunto 10 tappe in 6 casi** (Catania 13:48 e Sorprendimi Catania 3 ciascuno, gli altri 1); **le righe di tempo libero sono i buchi che non si riempiono**: 4 → 24 sui 30 casi di prima (2525 minuti dichiarati con la fascia), 25 con il caso Catania (2622 minuti, in 12 dei 26 giri con orari, circa 105 minuti l'una). Dove cadono: pomeriggio → aperitivo 8, mattina → pranzo 7, aperitivo → cena 7, mattina chiusa in testa 2, pranzo → pomeriggio 1. Cause: ritmo Rilassato (Lecce, Bologna, Firenze), tetto di 8 tappe (Roma, Siracusa), pool esaurito (Troina), «nei ristoranti tipici» (nessun altro pasto), momenti che non si espandono (aperitivo, pranzo, cena).
- Rigiro di 2 casi: nel primo giro il riempimento aveva aggiunto **un altro ristorante a metà pomeriggio** nelle richieste «nei ristoranti tipici» (crea-catania-catanese e -veg): «pranzare due volte». Ho aggiunto la regola «una tappa in più non è un altro pasto», ho rigirato quei due casi col codice finale e **li ho sostituiti nel grezzo** (`rigiro` nel JSON tiene i vecchi). Con la regola: c1 su crea-catania-catanese 10 → 6, c2 4 → 2.
- Percorso serale (Veloce 21:45 e 23:30): ora «A quest'ora qui è quasi tutto chiuso. Il giro giusto parte domattina.» invece di 2 tappe + riga. È il flusso senza scheletro, che non ho toccato: il pool di Google era diverso (33 candidati contro 37 e 40). Non l'ho rigirato col codice vecchio per provarlo.

## Spesa

Diagnosi Catania 0,123 $ + Catania col motore nuovo 0,123 $ + giro completo di 31 casi 4,449 $ + rigiro di 2 casi 0,247 $ = **4,942 $** (tetto 5 $). Nessuna chiamata a `place/details`.

## Decisioni mie da confermare

1. **Ritmo Rilassato non riceve tappe in più**: «1 tappa per momento» è una scelta esplicita dell'utente, il buco si dichiara. Lecce, Bologna e Firenze hanno 3, 1 e 3 righe di tempo libero. Con una riga si cambia: oggi il riempimento si applica a Attivo, Intenso e a chi non ha scelto il ritmo.
2. **Aperitivo, pranzo e cena restano 1 tappa**: sono i 7 buchi «aperitivo → cena» (circa 80 minuti l'uno) e parte dei «mattina → pranzo». Se l'aperitivo potesse avere una seconda tappa (un panorama dopo il bar) sparirebbero quasi tutti; non l'ho fatto perché lo scheletro dice «l'aperitivo è uno».
3. **Il tempo libero è ormai una voce ordinaria del giorno** (25 righe in 12 giri su 26, circa 105 minuti l'una): è il risultato diretto della regola «un buco è un errore o si dichiara». Il testo approvato («per il pomeriggio non c'è niente che valga il cammino…») dopo una tappa dello stesso momento è meno vero (c'era l'aperitivo, manca il resto): non ho scritto frasi nuove, la seconda variante (`FRASI_TEMPO_LIBERO[1]`) non è approvata.
4. **L'attesa prima della prima tappa del giorno non è un buco** (il giro comincia lì: ore 9:30 se ti connetti alle 8:15) e una riga in coda non ha fascia: non si inventa una fine.

## Cosa ho dato per vero senza verificarlo

1. **Le scelte del wizard della tua prova su Catania**: non le conosco. Ho assunto Storia + Cibo, 1 Giorno, ritmo Attivo, nessun testo; il pomeriggio che ne esce ha 2 tappe come il tuo, ma non è lo stesso giro (Bellini da 60 minuti dove tu avevi la chiesa da 20).
2. **Il cammino** nel buco è la stima del prodotto (haversine a 4,5 km/h), non il cammino vero; la soglia di 45 minuti è la tua e non l'ho confrontata con niente.
3. **Un campione per caso**, un solo giro più il rigiro di due casi; la varianza «±2 casi per voce» è una mia scelta, non misurata. Il pool di Google cambia tra un giro e l'altro (l'ho visto nei due Veloce serali e in `crea-milano-sera`, dove c1 passa da 1 a 3 con 0 tappe aggiunte da me): c7 +1 e c1 −2 non si possono attribuire al riempimento con un giro solo. Per Te non è toccato (c7 3 → 5 su perte-roma-1600 è varianza).
4. **I 28 casi non rigirati** sono del codice senza la regola «mai un altro pasto». Ho controllato nei grezzi che nessun riempimento ha aggiunto un posto dove si mangia fuori dai pasti (solo i due casi catanesi), quindi col codice finale dovrebbero dare lo stesso giro, ma non l'ho provato: il tetto di 5 $ era finito.
5. **Le schermate** sono provate con test di render (fascia, numeri, orari), non nel browser: non ho avviato l'app. Quello che l'utente vede dipende anche dallo stile della corsia estetica (resa minima, come per la regola O).
6. **Sorprendimi**: ho letto dal codice che `mappedTour.stops` è l'elenco grezzo (tempo libero compreso) e che prima la riga di tempo libero compariva là come una tappa numerata; non l'ho visto sullo schermo.
7. **«Una tappa in più non è un pasto»** si basa su `isMealPlace` (tipo `cibo`); un bar-ristorante con tipi misti può contare come pasto o no a seconda dei tipi (Bar Popolare, nel giro Sorprendimi Catania, il banco lo segna come pasto).
8. **Deploy**: dopo il push serve il verde di «Lint & Test» e «E2E Smoke» sullo stesso commit perché il gate di Vercel dia ALL_GREEN; l'esito è sotto.
