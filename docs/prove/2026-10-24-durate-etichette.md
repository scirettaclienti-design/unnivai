# DURATE-ETICHETTE — ogni durata dice cosa misura

Ramo `durate-etichette` → `main` (codice `f76dbaf`), deploy READY, CI verde. Stessi calcoli di oggi (`tourSpanMinutes`, `displayedTourMinutes`, i numeri di Directions): cambia solo la presentazione. Motore e navigazione non toccati.

## Le due forme

- **Durata complessiva** (sull'orologio, dal primo arrivo alla fine dell'ultima sosta, ora di Roma): **«Giornata 9:30–21:15»**; sotto le 6 ore **«Giro 9:30–12:10»**. Senza orari nelle tappe non si scrive nessuna fascia: resta «Durata» e il valore di prima.
- **Cammino** (i numeri di Directions): **«1h 33 a piedi · 6,9 km»**; il mezzo cambia l'etichetta («in auto», «in bici», «con i mezzi»); sotto l'ora «45 min a piedi · 850 m».

`src/lib/tourTiming.js`: `fasciaDelGiro`, `etichettaGiornata`, `etichettaCammino`, `minutiBrevi`, `distanzaBreve`.

## Dove

| Punto | Prima | Adesso |
|---|---|---|
| **Card della mappa prima di «Avvia»** (`MapPage`) | «93 min · 6.9 km · 13 Tappe» (tre numeri, nessuna etichetta) | «Giornata 8:30–21:15 · 1h 33 a piedi · 6,9 km · 13 tappe» (senza percorso calcolato: «Giornata 8:30–21:15 · 13 tappe») |
| **Pannello «Percorso Consigliato»** | «93 min (6.9 km)» | «1h 33 a piedi · 6,9 km» |
| **Riepilogo del giro** (Quiz, Sorprendimi, giro riaperto) | «DURATA circa 11h 45min» | «GIORNATA 9:30–21:15» (senza orari: «DURATA circa 3h») |
| **Dettaglio del giro** (`TourDetails`, Per Te) | «Durata: circa 11h 45min» | «Giornata: 9:30–21:15» |
| **Scheda in Profilo** (Mete › Giri salvati) | «Catania • 13 tappe • data» | «Catania • 13 tappe • Giornata 9:30–21:15 • data» (i giri salvati prima, senza orari, non ricevono nessuna durata inventata) |
| **Home** (card di Per Te) | «circa 3h 30min» | «Giornata 9:30–21:15» o «Durata circa 3h» |

## Fatto quando

- ✅ **Test su un giro di 13 tappe** (`src/__tests__/lib/durateEtichette.test.jsx`, 12 test + 2 sulla mappa in `mapPageNav3.test.jsx`): 13 tappe dalle 9:30, l'ultima alle 20:45 per 30 min → «Giornata 9:30–21:15»; i minuti sono quelli di `tourSpanMinutes` (11h 45); «Giro» sotto le 6 ore; ora legale in agosto; `etichettaCammino` esatta («1h 33 a piedi · 6,9 km», «45 min a piedi · 850 m», «2h a piedi · 10,0 km», auto, bici); riepilogo e scheda in Profilo; **la card della mappa dice «Giornata 9:30–21:15 · 1h 33 a piedi · 6,9 km · 13 tappe»** quando arrivano i numeri di Directions (`onRouteStats`) e solo «Giornata 9:30–21:15 · 13 tappe» senza.
- ✅ **Screenshot WebKit dei 3 punti, sito pubblicato, account di prova** (`docs/prove/schermate/durate-etichette/`):
  1. card della mappa: `durate4-01b-anteprima-percorso.png` — «Giornata 8:30–21:15 · 13 tappe»
  2. riepilogo del giro (giro riaperto dal Profilo): `profilo-riaperto.png` — «9:30–21:15 / GIORNATA»
  3. scheda in Profilo: `profilo-profilo.png` — «Catania • 12 tappe • Giornata 9:30–21:15 • 27 ott 2026» (e il resto dei giri salvati)
- ✅ `git log --oneline -5 main`: sotto.

## Controlli

Suite 214 file / **2617 test verdi** (aggiornati 3 test al nuovo testo: durata del Quiz, riepilogo di VERITA-TESTI); lint 0 errori, 191 avvisi (come `main`); build ok; CI verde su `f76dbaf`.

## `git log --oneline -5 main`

```
f76dbaf DURATE-ETICHETTE: ogni durata dice cosa misura — «Giornata 9:30–21:15» per il giro, «1h 33 a piedi · 6,9 km» per il cammino
40c89db DNA-RIQUADRO: report, prove dal vivo e screenshot
6f1ffa2 DNA-RIQUADRO: «Il tuo DNA esplorativo» mostra solo cosa del DNA e della richiesta ha guidato quel giro (max 3 righe, mai trattini) in Crea, Quiz, Sorprendimi e Per Te
1b163ba NAV-OSSIDIANA: report con la prova dal vivo, il contrasto misurato sui pixel e lo screenshot affiancato al canvas
b4cb674 NAV-OSSIDIANA: la mappa di navigazione si crea con il Map ID Ossidiana (da VITE_GOOGLE_MAP_ID_NAV), colorScheme DARK e inclinazione 0
```

## Cosa NON risolve

- **Il cammino dal vivo non l'ho visto nella card**: nella prova WebKit il pannello del percorso resta su «Attiva posizione» (manca l'origine) e Directions non parte, quindi `routeStats` non arriva e la card mostra solo la giornata e le tappe. «1h 33 a piedi · 6,9 km» è provato dal test sulla mappa montata (con i numeri di Directions simulati), non dal vivo.
- **La card dice «Giornata 8:30–21:15»** in questo giro (il motore ha messo la prima tappa alle 8:30 perché la prova gira prima delle 10:30: colazione): coerente col giro, non con l'esempio «9:30».
- Un giro più lungo di mezzanotte mostrerebbe «Giornata 9:30–0:30» (ore senza zero davanti, come richiesto dall'esempio).
- La **Home** di Per Te (card piccola) non l'ho fotografata.
- Altre durate nell'app (es. la durata di un tour di una guida, «45 min» salvati dal database) restano come sono: sono già una sola grandezza con la sua etichetta («Durata»).

## Cosa ho dato per vero senza verificarlo

- Che «Giornata» valga da 6 ore in su (soglia mia, la stessa dei giri a giornata intera del motore); sotto è «Giro».
- Che l'ora di Roma sia quella giusta per chi legge (il resto dell'app ragiona in ora di Roma).
- Che nessuno scriva a mano un testo che si aspetta «Durata» in un altro punto (cercato nel codice e nei test: tre test adeguati).

## Processi

Nessun server avviato da me; i browser Playwright si chiudono a fine script.
