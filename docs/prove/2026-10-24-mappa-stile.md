# MAPPA-STILE — la navigazione usa lo stile Google vero, non filtri CSS

Ramo `mappa-stile-nav` → `main` (commit `cb59db7`), deploy `unnivai-jvzv7x2x9` READY, CI verde sullo stesso SHA.

## ⚠️ Cosa serve ancora da Ivano (blocca la prova finale)

**La variabile `VITE_GOOGLE_MAP_ID_NAV` non è impostata su Vercel e io non ho il Map ID** (non è nel repo, nel `.env` né nel canvas). Finché non c'è, sul sito pubblicato la navigazione usa il Map ID di sempre, cioè la **mappa chiara di base**: i filtri scuri di NAV-3 sono stati tolti come chiesto, quindi **oggi in produzione la navigazione non è più scura** (vedi lo screenshot affiancato a destra). Per chiudere: Vercel › Settings › Environment Variables › `VITE_GOOGLE_MAP_ID_NAV` = il Map ID di «DoveVAI — Navigazione» (Production), poi redeploy; oppure mandami il Map ID e lo imposto io. Dopo, la prova «sul sito pubblicato la navigazione mostra lo stile del Map ID» e gli screenshot affiancati definitivi si rifanno in 5 minuti con lo stesso script.

## Fatto

| Richiesta | Esito |
|---|---|
| Map ID solo da `VITE_GOOGLE_MAP_ID_NAV`, mai nel codice | ✅ `src/lib/mapId.js` (`MAP_ID_NAV`, `mapIdPer`); `.env.example` ha la variabile vuota; test che la legge solo dall'ambiente |
| Tolti i 4 filtri CSS | ✅ regole in `index.css`, attributo `data-stile-mappa`, `src/lib/stileMappa.js` e il calcolo in `MapPage` rimossi (test che non tornino) |
| Variabile assente → la mappa funziona come oggi | ✅ test (`mapIdPer`) e prova WebKit locale senza variabile: Map ID di sempre, navigazione ok |
| Il filo del giorno non copre il tasto indietro | ✅ il tasto ha la sua riga in alto (`z-[80]`, safe-area), filo e pillola partono 3,5 rem sotto. **Sul sito pubblicato**: indietro y 8–54, filo y 64–144, pillola y 152–226, nessuna sovrapposizione, in cima al centro del tasto c'è il tasto (`docs/prove/dati/2026-10-24-mappa-stile-live.json`). Prima: il filo (z 70) copriva il tasto (z 40, y 64–112) |
| Tratto fatto / prossimo / resto ≥ 3:1 | ✅ in test (`navStileMappa.test.js`, 9 coppie) contro i colori dello stile del canvas (terra `#0F0E0D`, edifici `#171513`, strade `#26231F`): fatto `#A8A29E` tratteggiato, prossimo `#F97316`, resto `#8F8880`; si distinguono anche per tratteggio e spessore. Prima il fatto era `#5A5048` (≈ 2:1) |
| Sul sito pubblicato la navigazione mostra lo stile del Map ID | ⏳ **non verificabile senza il Map ID** (sopra). Meccanismo provato in locale con il Map ID pubblico di Google `DEMO_MAP_ID`: la mappa chiede quel Map ID (2 richieste) invece di quello di sempre, la navigazione funziona (pillola, Directions, 0 errori), `con-id-stato-1-cammino.png` |
| Screenshot affiancati al canvas, schermate 1 e 6 | ⏳ **provvisori**: `affiancato-1-cammino.png`, `affiancato-6-mattina.png` (canvas a sinistra, sito pubblicato a destra, senza il Map ID). Da rifare con lo stile vero |
| `docs/estetica/palette.md` | ✅ sezione «La mappa di navigazione» |

## Controlli

- Suite 210 file / **2578 test verdi**; lint **0 errori, 191 avvisi** (prima 193); build ok; guardia 12/12, pertinenza nessun ❌ nuovo; CI verde.
- Spesa: ≈0,07 $ (una prova dal vivo con 0,064 $ di Google al listino).

## Cosa NON risolve

- **La schermata 6 (mattina, chiara) e la 1 (scura) hanno stili diversi**: con UN solo Map ID la navigazione ha UNO stile. Per la mattina chiara serve un secondo Map ID (es. `VITE_GOOGLE_MAP_ID_NAV_GIORNO`) e una regola per scegliere (alba → +2 h): non fatto, serve una tua decisione.
- Cambiando Map ID passando da esplorazione a navigazione **la libreria ricrea la mappa**: in locale con `DEMO_MAP_ID` non ho visto errori, ma lo sfondo del Map ID demo è rimasto vuoto nello screenshot (1,2 s dopo l'avvio): con il Map ID vero va controllato che le tessere si carichino subito e che la camera resti dov'è.
- I colori dei tratti sono scelti sui colori del canvas: se lo stile Google vero ha altri grigi per terra e strade, il contrasto va ricalcolato (cambiare le costanti e il test).

## Cosa ho dato per vero senza verificarlo

- Che lo stile Google «DoveVAI — Navigazione» abbia i colori della schermata 1 del canvas (terra `#0F0E0D`, strade `#26231F`).
- Che il tasto indietro in cima, a ~46 px, non confligga con la barra di stato dell'iPhone vero: ho usato `env(safe-area-inset-top)` ma provato solo in WebKit con profilo iPhone 13.
- Che `DEMO_MAP_ID` si comporti come un Map ID qualunque nel cambio di istanza.
- Che gli screenshot del canvas (rese locali dell'HTML statico delle schermate, senza il suo runtime) siano fedeli alle schermate.

## Processi

Vite di prova (porta 5191) chiuso; nessun altro processo mio acceso.
