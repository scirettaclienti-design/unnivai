# BANCO-DIFETTI: i difetti del banco a 40 casi, uno per uno (T19, 05/11/2026)

Stato: **fatto in parte** (codice pronto, PR da unire). Chiusi **D1, D2, D3, D4, D5** (con decisioni scritte sotto) e **D8 in parte** (la città e il municipio); restano aperti **D6, D7, D8-stazione, D9**, con il punto preciso. Nessuna funzione del server toccata: niente deploy di openai-proxy, niente migrazioni, niente secret.

## Cosa cambia per Ivano

- **A piedi mai più di 1,2 km fra due tappe** (la sua regola), in Per Te e in tutti i giri a piedi. Per Te: le tappe lontane escono e il tour si riempie con posti del suo tema vicini; se non ce ne sono il tour sotto le 3 tappe non si mostra (Napoli alle 13: prima 3 tour con tratti fino a 4,14 km, ora 2 tour vicini). Crea: tetto 16 minuti (era 20, con la varietà fino a 25); un ripiego «il più vicino» oltre il tetto esce: un pranzo o una cena senza locale entro il tetto ha la riga «Nessun locale aperto qui vicino a quest'ora.».
- **Eccezione dichiarata**: con la natura chiesta in un borgo (la sua decisione di BORGO-FIX) un tratto verso un luogo di natura arriva a 30 minuti e il giro lo dice sul giorno: «Da A a B sono 2,2 km a piedi, 29 minuti.». Nei 40 casi non scatta (nessun tratto la richiede). Il ritmo Intenso resta «con qualche mezzo» (5 km).
- **Il «Tempo libero» dice il tempo vero**: niente più righe da 0 minuti; la serata con la sola cena dichiara il resto della serata («Tempo libero 21:15–22:30»).
- **Palazzo dei Chierici non era chiuso**: era una proposta «per domattina» che il banco misurava da adesso; il motore l'aveva verificata alle 10:33 di domani (aperto 08:00–13:00). Corretto il banco.
- **Il prezzo**: con il tetto più stretto alcuni giri hanno più «Tempo libero» lungo (D7 peggiora: righe oltre 2 ore fra due tappe da 5 a 8). È la scelta fra «tappe vicine» e «giornata piena»: vedi «Cosa NON risolve».

## Difetti: chiusi e aperti

| Difetto | Gravità | Esito | Regola applicata | Commit | Test |
|---|---|---|---|---|---|
| D1 Per Te oltre 1,5 km | blocca il lancio | **chiuso** | 1,2 km a piedi fra tappe consecutive (Ivano), Per Te e Crea; ultima rete nel piano di Crea; eccezione dichiarata natura nel borgo | `6759e1a`, `fee06c0` | `tettoCammino.test.js` (15), `perTeHome.test.js` (+2), `banco40.test.js` (+1) |
| D2 Palazzo dei Chierici | da correggere | **chiuso** | ogni sosta finisce prima della chiusura (il motore lo faceva già): era il banco a misurare una proposta «per dopo» da adesso | `c00fb9e` | `bancoPerDopo.test.js` (3) |
| D3 pranzo a 1,62 km | da correggere | **chiuso** | il pranzo e la cena stanno nel tetto di 1,2 km come ogni tappa (D1) | `7e75ad7` (test) | `composizioneC1.test.js` D3 |
| D4 «Tempo libero» da 0 min | da correggere | **chiuso** | nessuna riga sotto 15 minuti; i minuti restano attesa (orari invariati); resta la riga del pasto mancante | `5563b03` | `tempoLiberoVero.test.js` (6) |
| D5 giri poveri | da correggere | **chiuso con decisioni** | vedi sotto | `5563b03` | `tempoLiberoVero.test.js` |
| D6 richiesta ignorata | da correggere | **aperto** | nessun controllo nuovo nel banco (motivo sotto) | — | — |
| D7 «Tempo libero» oltre 2 ore | da correggere | **aperto, peggiorato** | — | — | — |
| D8 non-luoghi | da correggere | **chiuso in parte** | fuori la città stessa («Matera, Italia») e il municipio come ufficio (`city_hall` senza `tourist_attraction`); la stazione «Colosseo» resta | `cecb48d`, `826ab90` | `zone.test.js` (+3) |
| D9 nomi generici | estetico | aperto (non gratis) | — | — | — |

### D5 — decisioni prese da T19, rivedibili da Ivano
- **(a) Serata con la sola cena**: ammessa quando il pool non ha altro di valido entro il tetto; il resto della finestra è dichiarato come «Tempo libero» con la sua fascia (n-catania-2000: cena 20:00–21:15, poi «Tempo libero 21:15–22:30»; prima: «Tempo libero 21:15», 0 minuti). Aggiungere un dopocena obbligatorio avrebbe chiesto ricerche nuove e una forma nuova della serata: non è la regola più semplice.
- **(b) «Un pomeriggio» chiesto alle 13:00**: il pomeriggio comincia alle 14:30 (tabella dei momenti); la prima tappa lo dice col suo orario. Nessun cambio. Ho provato a dichiarare l'attesa in testa come «Tempo libero 13:00–14:30»: toccava anche i borghi corti e le partenze delle 14:00 (5 test di regole già decise rossi), quindi l'ho tolto.
- **(c) Giro notturno con una tappa dopo mezzanotte** (n-catania-2315-veloce, Piazza del Duomo alle 00:18): ammessa. Regola: i luoghi all'aperto non chiudono, i locali entrano solo aperti per tutta la sosta (C5). Nessun cambio.

### D6 — perché niente controllo automatico
Un controllo «luoghi nominati nel giro» farebbe fallire 6 casi che oggi non so far passare senza lavori grossi sul motore: il Vaticano in un giro Intenso, le spa a Catania (Veloce: le esclusioni del Quiz non sono un filtro, decisione DNA-3b), il cioccolato a Scicli, la natura a Palermo. Aggiungerlo ora renderebbe il banco rosso senza correzione. Punto preciso trovato per un caso: in `n-roma-1300-specifica` il Colosseo vero è nella ricerca («Colosseo Roma», tipo `historical_landmark`) ma lo toglie il **Gate RAGGIO-CATEGORIA** (`candidateConflictsWithCategoria`, aiRecommendationService.js: con categoria «storia», `tourist_attraction` vale «cultura» e conta come conflitto); passa solo la stazione della metro (tipi senza categoria). È la stessa radice di D8-stazione.

### D7 — perché resta aperto
Il tetto di 1,2 km riduce i candidati raggiungibili: righe di «Tempo libero» oltre 120 minuti fra due tappe da 5 a 8 casi (nuove: `a-troina` 143, `d-troina-roma` 157, `n-napoli-dna-cibo` 131; `n-troina-natura` 144 → 251). Le altre due nuove oltre 120 sono la coda dichiarata di D5 (`n-roma-1300-specifica` 175, `n-firenze-sorprendimi-2000` 165). Correggerlo vuol dire riempire i pomeriggi con ricerche mirate in più dentro il tetto (costo Google e tracciati nuovi): proposta per un task dopo.

### D8 — la stazione
Togliere la fermata «Colosseo» lasciava `n-roma-1300-specifica` con una tappa sola (prova dal vivo di T19), perché il Colosseo vero lo toglie il gate della categoria (sopra). Ho rimesso la stazione e scritto il punto in `zone.js`.

## Prove

- **Suite**: 3380 test verdi (`npm run test:run`); lint 0 errori; `npm run build` ok.
- **Guardia** prima del merge: `npm run banco:guardia` → home 12/12, pertinenza nessun ❌ nuovo, banco 40 10/10.
- **Riproduzione a 0 $ dei 40 casi** (`npm run banco -- --replay`, codice finale): **40/40 passano tutti e cinque i controlli** (a piedi a 1,2 km), **0 uscite in rete**. 25/40 uguali al giro registrato: i 10 casi rifatti dal vivo sul codice di T19 più 15 che il codice nuovo non cambia; gli altri 15 (Crea, `a-roma`, `a-milano`, …) hanno itinerari nuovi per il tetto e passano tutti, ma differiscono dal giro vero di T15/T18, quindi il comando esce con 1 finché non si rifanno dal vivo (circa 3 $; non fatto per il tetto di spesa).
- **Dal vivo** (account di prova, giorno simulato 05/11, `BANCO_CASI=… npm run banco`): `c-catania`, `n-napoli-ospite-1300`, `n-palermo-ospite-1600` (i tre richiesti), `n-napoli-dna-cibo`, `n-troina-natura`, `c-roma`, e i casi che con il codice nuovo facevano ricerche non registrate (`a-firenze`, `n-palermo-natura`, `n-lontano-catania-roma`, `n-roma-1300-specifica`). Tutti passano i cinque controlli; i loro tracciati sono aggiornati e la riproduzione li rifà identici (coerente).
- **Tabella prima/dopo** sotto. «Prima rimisurato a 1,2» = gli itinerari del codice vecchio (replay) con il controllo nuovo: 12 casi su 40 avevano un tratto oltre 1,2 km (5 fallivano già a 1,5 km, 7 in più col tetto nuovo).

| # | Caso | Prima (T18, giro vero, tetto 1,5) | Prima rimisurato a 1,2 (codice vecchio, replay) | Dopo (codice T19, replay) | Tappe | TL < 15 min dopo | Dal vivo T19 |
|---|---|---|---|---|---|---|---|
| 1 | `a-roma` | ok | ok (1.13 km) | ok (1.07 km) | 13 → 12 | 0 |  |
| 2 | `a-milano` | ok | ko: distanze (1.47 km) | ok (1.16 km) | 12 → 13 | 0 |  |
| 3 | `a-napoli` | ok | ko: distanze (1.46 km) | ok (1.11 km) | 13 → 13 | 0 |  |
| 4 | `a-firenze` | ok | ok (0.67 km) | ok (0.97 km) | 11 → 13 | 0 | sì |
| 5 | `a-palermo` | ok | ok (1.25 km) | ok (0.86 km) | 12 → 12 | 0 |  |
| 6 | `a-catania` | ok | ok (0.69 km) | ok (0.69 km) | 13 → 13 | 0 |  |
| 7 | `a-siracusa-ortigia` | ok | ko: distanze (1.26 km) | ok (0.64 km) | 9 → 9 | 0 |  |
| 8 | `a-polignano-a-mare` | ok | ok (0.52 km) | ok (0.84 km) | 13 → 13 | 0 |  |
| 9 | `a-matera` | ok | ok (0.41 km) | ok (0.5 km) | 13 → 10 | 0 |  |
| 10 | `a-scicli` | ok | ok (0.54 km) | ok (0.54 km) | 12 → 12 | 0 |  |
| 11 | `a-troina` | ok | ko: distanze (1.39 km) | ok (0.88 km) | 9 → 8 | 0 |  |
| 12 | `b-roma-A` | ok | ok (1.26 km) | ok (1.19 km) | 13 → 12 | 0 |  |
| 13 | `b-roma-B` | ok | ko: distanze (1.49 km) | ok (1.09 km) | 13 → 13 | 0 |  |
| 14 | `b-catania-A` | ok | ok (0.84 km) | ok (1.1 km) | 13 → 12 | 0 |  |
| 15 | `b-catania-B` | ok | ok (0.87 km) | ok (0.87 km) | 13 → 13 | 0 |  |
| 16 | `c-roma` | ko: distanze | ko: distanze (1.92 km) | ok (1.07 km) | 19 → 16 | 0 | sì |
| 17 | `c-catania` | ko: aperte, distanze | ko: aperte, distanze (2.55 km) | ok (0.93 km) | 14 → 11 | 0 | sì |
| 18 | `d-troina-roma` | ok | ko: distanze (1.33 km) | ok (1.13 km) | 13 → 11 | 0 |  |
| 19 | `n-roma-0830` | ok | ko: distanze (1.35 km) | ok (1.11 km) | 13 → 13 | 0 |  |
| 20 | `n-roma-1300-specifica` | ok | ok (0.41 km) | ok (0.41 km) | 2 → 2 | 0 | sì |
| 21 | `n-roma-intenso` | ok | ok (1.87 km) | ok (1.87 km) | 7 → 6 | 0 |  |
| 22 | `n-catania-2000` | ok | ok (0 km) | ok (0 km) | 1 → 1 | 0 |  |
| 23 | `n-catania-2315-veloce` | ok | ok (0.23 km) | ok (0.23 km) | 2 → 2 | 0 |  |
| 24 | `n-catania-rilassato` | ok | ok (1.08 km) | ok (1.08 km) | 7 → 7 | 0 |  |
| 25 | `n-palermo-1300-mercato` | ok | ok (0.41 km) | ok (0.41 km) | 3 → 3 | 0 |  |
| 26 | `n-palermo-natura` | ok | ok (1.25 km) | ok (1.01 km) | 10 → 10 | 0 | sì |
| 27 | `n-napoli-dna-cibo` | ko: distanze | ko: distanze (1.62 km) | ok (1.03 km) | 9 → 9 | 0 | sì |
| 28 | `n-napoli-ospite-1300` | ko: distanze | ko: distanze (4.14 km) | ok (0.82 km) | 10 → 8 | 0 | sì |
| 29 | `n-firenze-dna-cultura` | ok | ok (0.55 km) | ok (0.55 km) | 9 → 9 | 0 |  |
| 30 | `n-firenze-sorprendimi-2000` | ok | ok (0 km) | ok (0 km) | 1 → 1 | 0 |  |
| 31 | `n-firenze-1300` | ok | ok (0.46 km) | ok (0.46 km) | 3 → 3 | 0 |  |
| 32 | `n-palermo-ospite-1600` | ko: distanze | ko: distanze (3.56 km) | ok (0.98 km) | 13 → 12 | 0 | sì |
| 33 | `n-troina-natura` | ok | ok (0.89 km) | ok (1.18 km) | 7 → 6 | 0 | sì |
| 34 | `n-troina-2000` | ok | ok (0 km) | ok (0 km) | 1 → 1 | 0 |  |
| 35 | `n-noto-0900` | ok | ok (0.32 km) | ok (0.32 km) | 10 → 10 | 0 |  |
| 36 | `n-cefalu-1300` | ok | ok (0.18 km) | ok (0.18 km) | 3 → 3 | 0 |  |
| 37 | `n-gangi-1000` | ok | ok (0.11 km) | ok (0.11 km) | 4 → 4 | 0 |  |
| 38 | `n-scicli-cibo` | ok | ok (0.41 km) | ok (0.41 km) | 9 → 9 | 0 |  |
| 39 | `n-lontano-catania-roma` | ok | ok (1.12 km) | ok (1.09 km) | 13 → 13 | 0 | sì |
| 40 | `n-lontano-palermo-firenze` | ok | ok (0.39 km) | ok (0.33 km) | 3 → 3 | 0 |  |

I casi dal vivo prima/dopo (tratto più lungo): `c-catania` 2,55 → 0,93 km (aperte: KO → ok, era il banco); `n-napoli-ospite-1300` 4,14 → 0,82 km (3 tour → 2); `n-palermo-ospite-1600` 3,56 → 0,98 km (4 tour → 3); `n-napoli-dna-cibo` 1,62 → 1,03 km (il pranzo ora è Trattoria da Concetta, 0,59 km); `n-troina-natura` 0,89 → 1,18 km (resta nel tetto; Comune di Troina non è più una tappa).

## Costo (a listino, AI e Google)

| Parte | AI | Google | Totale |
|---|---|---|---|
| Giro dal vivo 1 (9 casi) | 0,29 $ | 1,12 $ | 1,41 $ |
| Giro dal vivo 2 (4 casi, codice finale) | 0,13 $ | 0,17 $ | 0,30 $ |
| Giro dal vivo 3 (`n-roma-1300-specifica`; un primo lancio con tetto 0,5 $ è stato saltato dalla stima, 0 $) | 0,01 $ | 0 $ | 0,01 $ |
| Riproduzioni, guardia, test | 0 $ | 0 $ | 0 $ |
| **Totale T19** | **≈ 0,43 $** | **≈ 1,29 $** | **1,72 $** (tetto 5 $) |

AI: Sonnet 5.5 125.807 token in e 15.152 out, Haiku 4.5 23.174 in e 1.134 out. Google: 34 ricerche nuove e 6 per nome (gli altri dalla cache del proxy).

## Cosa NON risolve

- D6, D7 (peggiorato dal tetto), D8-stazione, D9: sopra, con il punto preciso.
- 15 casi del banco non sono stati rifatti dal vivo: `npm run banco -- --replay` dice «25/40 uguali» finché non si rifanno (`BANCO_CASI=a-roma,a-milano,a-napoli,a-palermo,a-siracusa-ortigia,a-polignano-a-mare,a-matera,a-troina,b-roma-A,b-roma-B,b-catania-A,d-troina-roma,n-roma-0830,n-roma-intenso,n-lontano-palermo-firenze BANCO_TETTO=4 npm run banco`). I loro esiti salvati sono ancora quelli del giro di T15/T18 (controllati a 1,5 km).
- Il bias delle ricerche mirate resta 1,5 km (cerca un po' più largo del tetto): tiene uguali le richieste a Google e la cache.
- Per Te può mostrare meno tour: un tema senza 3 posti entro 1,2 km l'uno dall'altro non si serve.
- Il testo del tratto dichiarato («Da A a B sono X km a piedi, N minuti.») sta sulla riga del giorno in Crea, non sulla scheda della tappa; nei 40 casi non compare.

## Passi che aspettano Ivano

Nessun comando obbligatorio. Decisioni: le tre regole di D5 (sopra, rivedibili); se vuole il controllo D6 nel banco (renderebbe rossi 6 casi oggi); se vale la pena rifare dal vivo i 15 casi (~3 $) per riportare la riproduzione a 40/40 uguali. Su iPhone non serve una prova (niente voce, GPS o audio); se vuole guardare: Per Te a Napoli o Palermo (tappe vicine) e una serata di Crea alle 20 a Catania («Tempo libero» con la fascia fino alle 22:30).

## File

`src/lib/tettoCammino.js` (nuovo), `src/lib/openStops.js`, `src/lib/continuity.js`, `src/lib/zone.js`, `src/services/momentSelection.js`, `src/services/aiRecommendationService.js`, `scripts/banco/controlli40.js`, `scripts/banco/banco.config.json`, `scripts/banco/giro-caso.js`, test in `src/__tests__/` (lib/tettoCammino, lib/tempoLiberoVero, scripts/bancoPerDopo, e attese aggiornate al tetto in C1, C5, C5b, C5d, C5e, C5c, C10b, perTeHome, dnaOnesto, zone, banco40), `docs/prove/dati/banco-40-*` (esiti, tabella, tracciati dei 10 casi rifatti), `CLAUDE.md`, `docs/LANCIO.md` (L7), questo report.
