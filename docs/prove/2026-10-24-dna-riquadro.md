# DNA-RIQUADRO — «Il tuo DNA esplorativo» mostra solo dati veri

Ramo `dna-riquadro` → `main` (codice `6f1ffa2`), deploy READY, CI verde. Nessuna chiamata AI nuova, motore dei giri e navigazione non toccati.

## Cosa non andava

- **Quiz** (`QuickPathSummary`): il riquadro scriveva «—» quando mancavano durata o compagnia, e «Mood»/«Ispirazione» come etichette fisse.
- **Sorprendimi**: righe inventate — «Ritmo: Mezza Giornata» e «Esperienza Unica» erano testo fisso, non dati; «Sorpresa Totale» come categoria anche senza scelta.
- **Crea** e **Per Te**: il riquadro non c'era.

## Cosa fa adesso

Un solo riquadro (`DnaDelGiro`) e una sola funzione pura (`righeDnaDelGiro`, `src/lib/dnaDelGiro.js`) in tutte e 4 le sorgenti: **al massimo 3 righe, una per dato vero, senza righe il riquadro non compare** (mai «—»).

| Riga | Quando c'è |
|---|---|
| «Hai scelto natura · parchi e verde.» | Quiz e Sorprendimi: la scelta cliccata (nel Quiz solo se almeno una tappa è di quella famiglia: regola BORGO già esistente) |
| «Hai chiesto cultura e cibo.» | Crea: categorie che la frase o i chip chiedono davvero (`richiestaEsplicita`, la stessa che usa il motore) |
| «Più cibo: è il tuo 40%.» | DNA forte (stessa percentuale del Profilo), **solo se il DNA guida** (fiducia > 0, come nel motore) **e solo se il giro ha almeno una tappa di quella categoria**; mai una categoria già nominata dalla richiesta |

Per Te non ha richiesta: solo righe di DNA. Palette Ossidiana (fondo sollevato, testo primario, un solo accento sull'icona).

## Fatto quando

- ✅ **Test con DNA pieno, vuoto e con richiesta esplicita**: `src/__tests__/lib/dnaDelGiro.test.jsx` (12): DNA pieno → «Più cibo: è il tuo 40%.», «Più cultura: è il tuo 30%.», «Più natura: è il tuo 12%.»; DNA vuoto (fiducia 0 o pesi a zero) → nessuna riga; categoria forte assente dal giro → non nominata; richiesta esplicita → «Hai chiesto cultura.» prima del DNA, senza ripetere; massimo 3 righe, nessun «—», nessun `undefined`/`NaN`; il riquadro senza righe non compare.
- ✅ **Zero trattini in tutte e 4 le sorgenti**: test sul riepilogo (con e senza DNA) e sui 4 file sorgente (`QuickPathSummary`, `AiItinerary`, `SurpriseTour`, `TourDetails` usano `<DnaDelGiro>` e `righeDnaDelGiro`, nessuna riga fissa); dal vivo/riprodotto: `dnaTrattini: false` in tutti.
- ✅ **Screenshot WebKit con righe vere dell'account di prova** (`docs/prove/schermate/dna-riquadro/`):
  - Crea, sito pubblicato: «Hai chiesto cultura e cibo.» (`04-crea.png`)
  - Per Te, sito pubblicato: «Più cultura: è il tuo 100%.» «Più cibo: è il tuo 100%.» (`03-per-te-dettaglio.png`)
  - Quiz (Troina, rete riprodotta, 0 $): «Più cultura: è il tuo 100%.» «Più cibo: è il tuo 100%.» (`01-quiz-natura-sera.png`; «Hai scelto natura» non compare perché nessuna tappa di quel giro è di natura: è la regola del Quiz, giusta)
  - Sorprendimi (Troina, 0 $): «Hai scelto natura.» + le due righe di DNA (`02-sorprendimi-natura-sera.png`)
- ✅ `git log --oneline -5 main`: sotto.

## Controlli

Suite 213 file / **2603 test verdi**; lint 0 errori, 191 avvisi (come `main`); build ok; CI verde su `6f1ffa2`. Spesa ≈ 0,15 $ (un giro di Crea e uno di Per Te dal vivo).

## `git log --oneline -5 main`

```
6f1ffa2 DNA-RIQUADRO: «Il tuo DNA esplorativo» mostra solo cosa del DNA e della richiesta ha guidato quel giro (max 3 righe, mai trattini) in Crea, Quiz, Sorprendimi e Per Te
1b163ba NAV-OSSIDIANA: report con la prova dal vivo, il contrasto misurato sui pixel e lo screenshot affiancato al canvas
b4cb674 NAV-OSSIDIANA: la mappa di navigazione si crea con il Map ID Ossidiana (da VITE_GOOGLE_MAP_ID_NAV), colorScheme DARK e inclinazione 0
6751bef GIRI-SALVATI: report con la prova dal vivo, i controlli e cosa non è risolto
3aacab3 GIRI-SALVATI: dopo «Togli» o «Cambia» il tasto torna «Salva il giro» (il giro è un altro); script della prova dal vivo
```

## Cosa NON risolve

- **«100%» due volte**: l'account di prova ha cultura e cibo entrambi al peso 1,0; è il numero vero (il Profilo mostra lo stesso), ma letto così pare strano. I pesi non sono normalizzati sul massimo (P7a). Se vuoi, si può mostrare «tra i tuoi più forti» invece della percentuale quando il peso è 100%: decisione tua.
- **Il giro riaperto dal Profilo** usa lo stesso riepilogo senza passargli il DNA: lì il riquadro mostra solo righe di scelta (nessuna, per i giri salvati) e quindi non compare.
- **Per Te e Sorprendimi dal vivo con la richiesta**: Quiz e Sorprendimi sono provati con la rete riprodotta (stesso codice, 0 $), non con un giro pagato.
- `scripts/prova-schermo/borgo-schermo.webkit.mjs` cerca ancora `[data-riquadro-mood]`: il Quiz ora ha le righe `[data-dna-riga]` (lo script le legge, ma quei due campi restano vuoti).

## Cosa ho dato per vero senza verificarlo

- Che `dnaShare > 0` sia davvero «il DNA ha guidato il giro» (è la condizione con cui Crea, Quiz e Sorprendimi passano i pesi al motore; Per Te passa `dnaWeights._share`).
- Che «il giro ha una tappa di quella categoria» (`tourCoreCategories` sui `types`) coincida con quello che l'utente chiamerebbe «cibo» o «cultura».
- Che la lettura di `richiestaEsplicita` su frase e chip sia ciò che il motore ha davvero applicato (stessa funzione, non il suo risultato dal giro).

## Processi

Vite di prova (porta 5191) chiuso; nessun altro processo mio acceso.
