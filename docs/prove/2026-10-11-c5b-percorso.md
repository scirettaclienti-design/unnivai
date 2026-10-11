# C5b — misura del percorso, prima tappa, ripetizioni (11/10/2026)

Un giro di banco: [2026-10-11-banco-7](2026-10-11-banco-7.md), motore `c1ab754`, gruppi a + b (15 casi),
account di prova, ora di Roma 15:40–15:46. Nessun caso Per Te, quindi nessun vincolo d'orario. Il banco
non apre pagine (entra su Supabase da Vitest): niente porta né titolo da verificare.

## Esito contro il "fatto quando"

| Obiettivo | Esito |
|---|---|
| ≥ 9/11 città verdi (0 incroci e indice ≤ 1,3) con la misura nuova | **10/11** 🟢 |
| Napoli verde o motivo nel `_tracciato` | 🔴 rossa (1 incrocio), **motivo scritto**: «incrocio rimasto: toglierlo costerebbe un tratto oltre il tetto o una famiglia ripetuta» |
| Ripetizioni ≤ 2 (livello prima di C5) | **3** 🔴 (a-napoli, a-troina, b-roma-A) |
| Numero di tappe | 7 in tutti i 15 casi, invariato |
| Costo del giro (tetto 3 $) | **2,28 $** di chiamate fatte dal banco (token 0,02 + Google 2,26); **3,01 $** contando le foto che il browser caricherebbe (0,74, stimate, non chiamate dal banco) |

## Città × misure (banco-7)

Indice vecchio = cammino reale / minimo libero (C5). Indice nuovo = cammino reale / minimo che rispetta
l'ordine dei momenti, pasti fissi, ottimizzando solo dentro ogni momento (C5b): è quello del semaforo.
Sotto 2 km l'indice nuovo non si giudica. Ripetizioni = famiglie ripetute nel giro finale + tappe doppie.

| Caso | Incroci | Indice vecchio | Indice nuovo | Km | Ripetizioni | Catene doppie | Esito |
|---|---|---|---|---|---|---|---|
| a-roma | 0 | 1,08 | 1 | 3,99 | 0 | 0 | 🟢 |
| a-milano | 0 | 1,39 | 1 | 4,02 | 0 | 0 | 🟢 |
| a-napoli | 1 | 1,46 | 1 | 4,29 | 1 | 0 | 🔴 |
| a-firenze | 0 | 1,11 | 1 | 2,54 | 0 | 0 | 🟢 |
| a-palermo | 0 | 1,14 | 1 | 3,38 | 0 | 0 | 🟢 |
| a-catania | 0 | 1,37 | giro corto, indice non applicato | 1,09 | 0 | 0 | 🟢 |
| a-siracusa-ortigia | 0 | 1,15 | 1 | 3,75 | 0 | 0 | 🟢 |
| a-polignano-a-mare | 0 | 1,19 | giro corto, indice non applicato | 0,64 | 0 | 0 | 🟢 |
| a-matera | 0 | 1,05 | giro corto, indice non applicato | 1,26 | 0 | 0 | 🟢 |
| a-scicli | 0 | 1,58 | giro corto, indice non applicato | 1,26 | 0 | 0 | 🟢 |
| a-troina | 0 | 1,29 | giro corto, indice non applicato | 1,74 | 1 | 0 | 🟢 |
| b-roma-A | 0 | 1,14 | 1 | 3,13 | 1 | 0 | 🟢 |
| b-roma-B | 0 | 1 | 1 | 3,67 | 0 | 0 | 🟢 |
| b-catania-A | 0 | 1,34 | giro corto, indice non applicato | 0,73 | 0 | 0 | 🟢 |
| b-catania-B | 0 | 1,72 | 1 | 15,54 | 0 | 0 | 🟢 |

## Leggere i due indici: l'asticella si è spostata, e molto

Gli stessi giri di prima rimisurati con la misura nuova:

| Giro | Motore | Verdi gruppo a, misura vecchia | Verdi gruppo a, misura nuova | Indice nuovo più alto |
|---|---|---|---|---|
| banco-3 (prima di C5) | `ac474ea` | 0/11 | 3/11 | 1,15 |
| banco-6 (fine di C5) | `0398aec` | 8/11 | 10/11 | 1,00 |
| banco-7 (C5b) | `c1ab754` | — | **10/11** | 1,00 |

**L'indice nuovo, così definito, non boccia più nessuno**, nemmeno il giro prima di C5 (massimo 1,15).
Dentro ogni momento l'ordine lo sceglie già il 2-opt di C5, e fra i momenti la misura non guarda per
costruzione. Il verdetto "verde" lo decidono di fatto gli **incroci**, più l'esenzione dei giri corti:
6 città su 11 sono sotto i 2 km. L'indice vecchio resta in tabella perché è l'unico che vede ancora
l'andata e ritorno fra i momenti (Scicli 1,58, b-catania-B 1,72).

## Ripetizioni: diagnosi

Confronto fra banco-3 (prima di C5) e banco-6 (dopo C5), tracce e log delle ricerche mirate C1b:

- **Troina**: stessa ripetizione prima e dopo (Torre Capitania + Museo Robert Capa, ripiego anche dopo
  la ricerca mirata, che trova un solo candidato). **Non è C5.** Non toccata.
- **Firenze**: **è C5, ma non il 2-opt né la deviazione: la rifinitura.** Scambiava Piazza Strozzi
  (piazza ripetuta) con l'Annunziata (un'altra piazza) e toglieva dal report le ripetizioni *di tutto il
  momento*, compresa quella di Piazza dei Ciompi. La ricerca mirata C1b non partiva: nel log di banco-6
  Firenze non ha ricerche, in banco-3 sì («g1-pomeriggio da "Trattoria De' Benci" (cultura) → 5
  candidati»). In più la nuova tappa riceveva la traccia "riparazione" e il banco non la contava: il giro
  aveva tre piazze e risultava una ripetizione sola. **Corretto**: in banco-7 Firenze ha 0 ripetizioni.
- **b-roma-A** (banco-6): stesso meccanismo, panorama al posto di panorama. Corretto per Firenze, resta in
  banco-7 in un'altra forma (sotto).
- **Napoli**: probabile effetto indiretto della forma del percorso, **non dimostrato**. Le due ricerche
  mirate vanno all'aperitivo e alla cena (in un piano intermedio la cena risulta lontana da un
  belvedere a Pizzofalcone). Al pomeriggio con la piazza ripetuta arriva "ricerche mirate esaurite".
  Prima di C5 la seconda ricerca andava al pomeriggio.

Correzione (`c1ab754`): una famiglia ripetuta nel giro finale è sempre dichiarata, in traccia,
`report.ripieghi` e `report.ripetuti`, così C1b la vede. Quando la rifinitura toglie una tappa, toglie dal
report solo la voce di quella tappa. La regola "famiglia nuova fino a 25 minuti" (C1b) e le soglie non
sono cambiate.

Perché resta 3:
- **Troina**: c'era già prima di C5.
- **Napoli**: il tetto di 2 ricerche si spende prima sui momenti lontani. È l'ordine di C1b, che non ho
  toccato.
- **b-roma-A**: la rifinitura può scambiare una ripetizione con una di un'altra famiglia (il totale non
  sale). La ricerca per quella nuova arriva quando il tetto è già speso.

Due modi per scendere a 2, che sono decisioni:
- in C1b, cercare prima le ripetizioni e poi i lontani;
- nella rifinitura, vietare gli scambi che spostano una ripetizione da una famiglia all'altra.

## Prima tappa del giorno

Si misura dal punto di partenza (`opts.startPoint`, oggi nessun chiamante lo passa) o dal centro del
gruppo, con il tetto di 20 minuti. In banco-7 nessuna prima tappa è risultata fuori (nessun ripiego
"partenza"). Misurate sul giro finale dal banco, tutte e 15 le prime tappe stanno fra 1 e 13 minuti dalla
mediana delle altre (il massimo è b-roma-B). La traccia `daPartenza` c'è solo in 7 casi: negli altri 8 la
prima tappa l'hanno cambiata l'ordine o la rifinitura, che non riscrivono quel campo. **Napoli**: il "punto panoramico sulla città" è a 12 minuti dal
centro del gruppo, quindi dentro la regola: il suo incrocio non viene da lì.

Scostamenti dalla lettera del task, da confermare:
- **"Centro del gruppo" = mediana delle altre tappe del giorno, non la media.** Su b-catania-B (15 km di
  giro) la media, tirata da una tappa lontana, metteva "fuori" una prima tappa che aveva un'altra tappa
  a 0 minuti. Il gruppo deve avere almeno 2 tappe.
- **Dal centro del gruppo vale solo il tetto, non la deviazione.** In un giro lineare la partenza
  naturale sta a un capo: misurata dal centro "devia" per definizione, e il motore scartava la prima
  tappa giusta. La deviazione vale solo da un punto di partenza vero.

## Altre voci (banco-7)

- Incroci 14/15 (rosso solo a-napoli). Catene 0.
- Distanze: rosse a-siracusa-ortigia e b-catania-B, come in banco-6.
- Verità: rossa b-catania-B, una tappa con frasi tolte dalla rete (narratore non toccato).
- Tempo e giornata completa: verdi.

## Test

Rosso su `a459e0e` e verde su `c1ab754` (14 test, lanciati sul codice vecchio in una copia separata):
- misura con le ancore dei momenti (4);
- esenzione sotto i 2 km, nel modulo e nel report del banco;
- ripetizioni contate sul giro finale;
- prima tappa fuori dal gruppo: alternativa del pool, nessuna alternativa con motivo nel tracciato,
  punto di partenza vero, centro come mediana;
- varietà contro rifinitura: piazza al posto di piazza resta dichiarata e la voce dell'altra tappa non
  sparisce;
- motivo dell'incrocio rimasto.

"Una famiglia nuova vince su una piazza più sulla strada" era già verde: è la regola C1.
Suite: 1412 test verdi.

## Cosa ho dato per vero senza verificarlo

- **La causa di Napoli.** Che la cena "lontana" del piano intermedio venga dalla forma del percorso è
  una lettura dei log, non una prova: il pool e la risposta del modello non si possono rigiocare.
- **La varianza fra un giro e l'altro.** Il giro di Napoli è identico in banco-6 e banco-7, gli altri
  no: non so quanto dipenda dalle cache e quanto dal motore. 10/11 al prossimo giro può cambiare.
- **Che la mediana delle altre tappe sia il "gruppo" giusto.** Su giornate con due grappoli lontani
  (un test lo mostra: due grappoli a 7 km) cade fra i due, e una prima tappa nel primo grappolo risulta
  "fuori".
- **Che la deviazione dalla partenza vera sia utile.** Nessun chiamante passa `startPoint`: quel ramo
  è provato solo dai test.
- **Che 2 km sia la soglia giusta per il "giro corto".** L'ha fissata il task; 6 città su 11 ci stanno
  sotto.
- **Le soglie di C5** (5 minuti fuori strada, 0,02 di merito per minuto, 2 minuti di guadagno minimo
  nella rifinitura). Restano stime, non tarate.
- **Il costo.** 2,28 $ sono le chiamate contate dal banco con i listini di `banco.config.json` (da
  ricontrollare); le foto sono una stima. Non è una fattura.
