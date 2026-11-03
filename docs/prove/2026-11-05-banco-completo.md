# BANCO-COMPLETO: i 40 casi del banco sono girati e riprodotti (T18, 05/11/2026)

Stato: **fatto**. Il giro dei 20 casi mancanti è girato dal vivo (`npm run banco -- --mancanti`, giorno simulato giovedì 05/11/2026, ora solare), i tracciati contengono ora tutti i 40 casi e `npm run banco -- --replay` li riproduce a 0 $, 0 uscite in rete, con gli stessi esiti del giro vero (40/40 uguali). `npm run banco:guardia` passa. L'app non è stata toccata: qui solo misura, classificazione e tracciati; le correzioni sono di T19.

## Cosa cambia per Ivano

- Il banco a 40 è completo: **35 casi su 40 passano tutti e cinque i controlli, 5 hanno difetti** (tutti sulle distanze; uno anche sulle tappe aperte). I 20 casi nuovi: 19 passano i cinque controlli, 1 no (`n-napoli-dna-cibo`, 1,62 km a piedi verso il pranzo).
- I cinque controlli automatici non vedono molti difetti che si leggono nell'itinerario (richiesta non rispettata, «Tempo libero» da 0 minuti, la città stessa come tappa). Li ho letti caso per caso su tutti i 40 e sono nell'elenco sotto, con id, tappe, distanze e orari: **è l'ingresso di T19**.
- Nuova opzione del banco: `npm run banco -- --replay --tappe` stampa l'itinerario di ogni caso rigiocato (ora locale, sosta, tipo, coordinate), sempre a 0 $. Con `BANCO_CASI=id1,id2` si limita ai casi che interessano.
- Il difetto più serio resta Per Te: tappe fino a 4,14 km a piedi l'una dall'altra, in 4 casi su 4.

## Tabella dei 40 casi

«ok» = il controllo passa, «KO» = fallisce. Costo = spesa del caso a listino (AI + Google) come misurata dal giro; nei casi ripetuti sulla stessa città le ricerche già in cache del proxy non sono contate, quindi il costo del singolo caso dipende dall'ordine (la somma delle colonne non è il costo del giro: vedi «Costo»). Controlli: **Aperte** = tappe aperte all'ora del giro; **Distanze** = distanze plausibili per il mezzo; **Città** = nessun luogo di un'altra città; **Titolo** = titolo coerente con le tappe; **Frasi** = nessuna frase ripetuta.

| # | Caso | Città | Tipo | Ora | Tappe | Aperte | Distanze | Città | Titolo | Frasi | Costo ($) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `a-roma` | Roma | Crea | 09:30 | 13 | ok | ok | ok | ok | ok | 1.05 |
| 2 | `a-milano` | Milano | Crea | 09:30 | 12 | ok | ok | ok | ok | ok | 1.05 |
| 3 | `a-napoli` | Napoli | Crea | 09:30 | 13 | ok | ok | ok | ok | ok | 0.98 |
| 4 | `a-firenze` | Firenze | Crea | 09:30 | 11 | ok | ok | ok | ok | ok | 0.18 |
| 5 | `a-palermo` | Palermo | Crea | 09:30 | 12 | ok | ok | ok | ok | ok | 0.89 |
| 6 | `a-catania` | Catania | Crea | 09:30 | 13 | ok | ok | ok | ok | ok | 0.78 |
| 7 | `a-siracusa-ortigia` | Siracusa | Crea | 09:30 | 9 | ok | ok | ok | ok | ok | 0.96 |
| 8 | `a-polignano-a-mare` | Polignano a Mare | Crea | 09:30 | 13 | ok | ok | ok | ok | ok | 0.50 |
| 9 | `a-matera` | Matera | Crea | 09:30 | 13 | ok | ok | ok | ok | ok | 0.86 |
| 10 | `a-scicli` | Scicli | Crea | 09:30 | 12 | ok | ok | ok | ok | ok | 0.50 |
| 11 | `a-troina` | Troina | Crea | 09:30 | 9 | ok | ok | ok | ok | ok | 0.49 |
| 12 | `b-roma-A` | Roma | Crea | 09:30 | 13 | ok | ok | ok | ok | ok | 0.08 |
| 13 | `b-roma-B` | Roma | Crea | 09:30 | 13 | ok | ok | ok | ok | ok | 0.04 |
| 14 | `b-catania-A` | Catania | Crea | 09:30 | 13 | ok | ok | ok | ok | ok | 0.11 |
| 15 | `b-catania-B` | Catania | Crea | 09:30 | 13 | ok | ok | ok | ok | ok | 0.04 |
| 16 | `c-roma` | Roma | Per Te | 10:30 | 19 | ok | KO | ok | ok | ok | 0.04 |
| 17 | `c-catania` | Catania | Per Te | 11:30 | 14 | KO | KO | ok | ok | ok | 0.03 |
| 18 | `d-troina-roma` | Roma | Crea | 09:30 | 13 | ok | ok | ok | ok | ok | 1.00 |
| 19 | `n-roma-0830` | Roma | Crea | 08:30 | 13 | ok | ok | ok | ok | ok | 0.04 |
| 20 | `n-roma-1300-specifica` | Roma | Crea | 13:00 | 2 | ok | ok | ok | ok | ok | 0.13 |
| 21 | `n-roma-intenso` | Roma | Crea | 09:30 | 7 | ok | ok | ok | ok | ok | 0.23 |
| 22 | `n-catania-2000` | Catania | Crea | 20:00 | 1 | ok | ok | ok | ok | ok | 0.01 |
| 23 | `n-catania-2315-veloce` | Catania | Veloce | 23:15 | 2 | ok | ok | ok | ok | ok | 0.12 |
| 24 | `n-catania-rilassato` | Catania | Crea | 10:00 | 7 | ok | ok | ok | ok | ok | 0.14 |
| 25 | `n-palermo-1300-mercato` | Palermo | Crea | 13:00 | 3 | ok | ok | ok | ok | ok | 0.09 |
| 26 | `n-palermo-natura` | Palermo | Crea | 09:00 | 10 | ok | ok | ok | ok | ok | 0.14 |
| 27 | `n-napoli-dna-cibo` | Napoli | Crea | 09:30 | 9 | ok | KO | ok | ok | ok | 0.04 |
| 28 | `n-napoli-ospite-1300` | Napoli | Per Te | 13:00 | 10 | ok | KO | ok | ok | ok | 0.03 |
| 29 | `n-firenze-dna-cultura` | Firenze | Crea | 09:30 | 9 | ok | ok | ok | ok | ok | 0.07 |
| 30 | `n-firenze-sorprendimi-2000` | Firenze | Sorprendimi | 20:00 | 1 | ok | ok | ok | ok | ok | 0.08 |
| 31 | `n-firenze-1300` | Firenze | Crea | 13:00 | 3 | ok | ok | ok | ok | ok | 0.06 |
| 32 | `n-palermo-ospite-1600` | Palermo | Per Te | 16:00 | 13 | ok | KO | ok | ok | ok | 0.19 |
| 33 | `n-troina-natura` | Troina | Crea | 09:30 | 7 | ok | ok | ok | ok | ok | 0.16 |
| 34 | `n-troina-2000` | Troina | Crea | 20:00 | 1 | ok | ok | ok | ok | ok | 0.05 |
| 35 | `n-noto-0900` | Noto | Crea | 09:00 | 10 | ok | ok | ok | ok | ok | 0.49 |
| 36 | `n-cefalu-1300` | Cefalù | Crea | 13:00 | 3 | ok | ok | ok | ok | ok | 0.41 |
| 37 | `n-gangi-1000` | Gangi | Crea | 10:00 | 4 | ok | ok | ok | ok | ok | 0.01 |
| 38 | `n-scicli-cibo` | Scicli | Crea | 09:30 | 9 | ok | ok | ok | ok | ok | 0.10 |
| 39 | `n-lontano-catania-roma` | Roma | Crea | 09:30 | 13 | ok | ok | ok | ok | ok | 0.12 |
| 40 | `n-lontano-palermo-firenze` | Firenze | Crea | 13:00 | 3 | ok | ok | ok | ok | ok | 0.03 |

Lettura: **35 casi passano i cinque controlli, 5 no**. Per controllo: aperte 39/40 (fallisce `c-catania`), distanze 35/40 (falliscono `c-roma`, `c-catania`, `n-napoli-ospite-1300`, `n-palermo-ospite-1600`, `n-napoli-dna-cibo`), città 40/40, titolo 40/40, frasi 40/40. Dei 368 luoghi dei 40 giri, **86 non hanno gli orari di Google** e il controllo «aperte» non li può misurare (la colonna «sconosciute» del file degli esiti dice dove).

## Elenco unico dei difetti (T15 + T18, senza doppioni): ingresso di T19

Gravità: **blocca il lancio** = l'utente trova un giro che l'app non può mantenere; **da correggere** = giro sbagliato o povero ma usabile; **estetico** = nome o dettaglio. Gli orari sono ora locale del 05/11/2026 (+01:00). «Riprodurre a 0 $»: ogni comando legge i tracciati salvati, nessuna rete.

### D1 — Per Te: tappe a più di 1,5 km a piedi l'una dall'altra · BLOCCA IL LANCIO (da T15)
Casi: `c-roma`, `c-catania`, `n-napoli-ospite-1300`, `n-palermo-ospite-1600` (4 Per Te su 4; i giri di Crea, Veloce e Sorprendimi non hanno il difetto, a parte D3).

| Caso | Tour | Tratto | Distanza | Orari |
|---|---|---|---|---|
| `c-roma` | romance | Piazza del Campidoglio → Belvedere del Salviati (Gianicolo) | 1,80 km | 11:02 → 11:56 |
| `c-roma` | nature | Orto Botanico di Roma → Villa Doria Pamphili | 1,92 km | 12:03 → 12:59 |
| `c-catania` | romance | Porta Uzeda → Lungomare di Catania | 2,55 km | 12:01 → 13:05 |
| `n-napoli-ospite-1300` | romance | Belvedere San Martino → «Terrazza Panoramica» (40,8159; 14,2085) | 4,14 km | 13:35 → 15:00 |
| `n-napoli-ospite-1300` | nature | Giardini di Palazzo Reale → Parco «Re Ladislao» | 2,23 km | 14:00 → 14:38 |
| `n-palermo-ospite-1600` | nature | Villa Giulia → Villa Bonanno | 1,76 km | 17:15 → 18:09 |
| `n-palermo-ospite-1600` | insider | Museo Diocesano → Giardino Rosa Balistreri (38,1431; 13,3394) | 3,56 km | 16:44 → 18:31 |

Riprodurre a 0 $: `BANCO_CASI=c-roma,c-catania,n-napoli-ospite-1300,n-palermo-ospite-1600 npm run banco -- --replay` (riga «Distanze plausibili» con i 4 id; esce con 0 perché gli esiti sono uguali al giro vero: i violati si leggono nella tabella di `npm run banco -- --report`); l'itinerario con `--replay --tappe`.
Regola che lo correggerebbe: in Per Te, fra due tappe consecutive di uno stesso tour, la distanza in linea d'aria non supera 1,5 km (20 minuti a 4,5 km/h, lo stesso tetto di Crea) e il tempo fra gli arrivi basta; la tappa che non rispetta il tetto si sostituisce con una candidata entro il tetto; se un tour resta sotto 3 tappe si accorcia. Il controllo `distanze` del banco già lo misura: dopo la correzione deve dare 40/40.

### D2 — Per Te, Catania: la sosta finisce dopo la chiusura · da correggere (da T15)
Caso: `c-catania`, tour «insider» (secondo): Palazzo dei Chierici, arrivo 12:33, sosta 30 minuti (fino alle 13:03), orario del 05/11: 08:00–13:00 e 15:30–17:00. Nei giri di Crea la stessa tappa è messa alle 15:31 (`a-catania`) e alle 15:32 (`b-catania-A`) e passa.
Riprodurre a 0 $: `BANCO_CASI=c-catania npm run banco -- --replay` (colonna «Aperte»: la violazione è nel file `docs/prove/dati/banco-40-esiti.json`, campo `controlli.aperte`).
Regola: anche in Per Te una tappa entra solo se arrivo + sosta ≤ chiusura del turno in cui cade l'arrivo (lo stesso filtro «aperto per tutta la sosta» del c5 di Crea); altrimenti la tappa passa al turno aperto o si sostituisce.

### D3 — Crea: il pranzo è a più di 1,5 km dalla tappa prima · da correggere (nuovo, T18)
Caso: `n-napoli-dna-cibo`: Teatro di San Carlo (arrivo 10:59, sosta fino alle 11:29) → Trattoria Don Vincenzo (12:30): 1,62 km, oltre il tetto di 1,5 km (con la tolleranza del 5% del controllo, 1,575). È l'unica violazione di distanza fuori da Per Te.
Riprodurre a 0 $: `BANCO_CASI=n-napoli-dna-cibo npm run banco -- --replay --tappe`.
Regola: la scelta del ristorante del pranzo (e della cena) rispetta lo stesso tetto di 1,5 km dalla tappa precedente; se nessun ristorante lo rispetta, si sposta la tappa precedente.

### D4 — «Tempo libero» da 0 minuti in fondo al giro · da correggere (da T15, esteso)
Casi: `n-troina-2000` (Black & White 20:00–21:15, poi «Tempo libero» 21:15, 0 min), `n-catania-2000` (Ciauru i mari 20:00, «Tempo libero» 21:15, 0 min), `n-firenze-sorprendimi-2000` (Osteria Nolarium 20:00, «Tempo libero» 21:15, 0 min), `n-roma-1300-specifica` (Colosseo 14:30, Via dei Fori Imperiali 15:05, «Tempo libero» 15:35, 0 min).
Riprodurre a 0 $: `BANCO_CASI=n-troina-2000,n-catania-2000,n-firenze-sorprendimi-2000,n-roma-1300-specifica npm run banco -- --replay --tappe` (riga `[TEMPO LIBERO 0 min]`).
Regola: nessuna riga «Tempo libero» sotto i 15 minuti; la riga non si emette (nuovo controllo del banco: «nessun tempo libero sotto 15 minuti»).

### D5 — Giro troppo povero per la finestra chiesta · da correggere (da T15 per `n-troina-2000`; il resto nuovo)
- Una serata = una sola tappa, la cena: `n-troina-2000`, `n-catania-2000`, `n-firenze-sorprendimi-2000` (tutte alle 20:00, cena da 75 minuti, nient'altro).
- «Un pomeriggio» chiesto alle 13:00 inizia alle 14:30: i 90 minuti prima non hanno né pranzo né tappe in `n-roma-1300-specifica` (2 tappe), `n-cefalu-1300` (3 tappe, 14:30–16:32) e `n-lontano-palermo-firenze` (3 tappe, 14:30–15:56). Gli altri due giri delle 13:00 hanno almeno il pranzo: `n-firenze-1300` (Osteria del Corso 13:00, poi Duomo 14:30 e Accademia 14:56, 3 tappe, finisce prima delle 16:00) e `n-palermo-1300-mercato` (3 tappe, finisce alle 15:15).
- `n-catania-2315-veloce`: 2 tappe, la seconda arriva dopo mezzanotte (Piazza del Duomo 00:18).
Riprodurre a 0 $: `BANCO_CASI=n-troina-2000,n-catania-2000,n-firenze-sorprendimi-2000,n-roma-1300-specifica,n-cefalu-1300,n-lontano-palermo-firenze,n-firenze-1300,n-palermo-1300-mercato npm run banco -- --replay --tappe`.
Regole (da decidere in T19): (a) con una finestra serale di almeno 2 ore, almeno una tappa in più oltre la cena (passeggiata, bar, belvedere aperto) oppure il testo dichiara che c'è solo la cena; (b) se l'ora di partenza è prima delle 14:30 e non c'è pranzo, la prima tappa parte entro 30 minuti dall'ora chiesta; (c) nessuna tappa dopo mezzanotte nei giri «veloce» salvo bar o locali aperti.

### D6 — La richiesta specifica non è rispettata · da correggere (nuovo, T18; i cinque controlli non lo misurano)
| Caso | Richiesta | Cosa propone | Cosa manca |
|---|---|---|---|
| `n-palermo-1300-mercato` | «Pranzo e giro ai mercati di Ballarò e del Capo» | 13:00 Street fruit e food Ballarò (ristorante), 14:30 Piazza Ballaro (tipo `coffee_shop`), 14:55 Cattedrale di Palermo | Mercato del Capo; il giro è di 3 tappe (nel giro generico `a-palermo` il Mercato del Capo è alle 16:12) |
| `n-roma-intenso` | «tra Vaticano e centro storico», ritmo Intenso | Terrazza Italia 09:30, Piazza Farnese 10:13, Mastrociccia 12:30, Via dei Fori Imperiali 18:00, Belvedere Cederna 18:33, Antica Osteria di Roma 20:00, Belvedere del Salviati 22:30 | nessuna tappa in zona Vaticano; 236 minuti di «Tempo libero» (D7) |
| `n-catania-2315-veloce` | «spa, hammam, terme, centri benessere. Escludi: cattedrali, musei, monumenti turistici» | Bar Popolare (cocktail bar) 23:15, Piazza del Duomo 00:18 | nessuna spa; la seconda tappa è la piazza della cattedrale, esclusa dalla richiesta |
| `n-scicli-cibo` | «Cioccolato e cucina tipica a Scicli» | Colle di San Matteo 09:30, Chiesa di San Matteo, Museo dell'Antica Farmacia Cartia, Commissariato di Vigata 14:30, Palazzo Rosso (tipo `grocery_store`) 15:05 | nessuna cioccolateria o laboratorio; 141 minuti di «Tempo libero» (D7) |
| `n-palermo-natura` | «Natura e panorami a Palermo», ore 09:00 | Teatro Massimo 09:30 (prima tappa), Piazza Pretoria 15:46, Via Maqueda 18:00 | un teatro e due vie in un giro «natura»; nessun belvedere; la partenza è alle 09:30 e non alle 09:00 |
| `n-troina-natura` | «Natura e panorami a Troina» | Comune di Troina (`city_hall`) 14:30, Via Conte Ruggero 18:00 | le prime due tappe (Monte Muganà 09:30, Belvedere 10:12) sono giuste; il pomeriggio no |
Riprodurre a 0 $: `BANCO_CASI=n-palermo-1300-mercato,n-roma-intenso,n-catania-2315-veloce,n-scicli-cibo,n-palermo-natura,n-troina-natura npm run banco -- --replay --tappe`.
Regola: quando la richiesta nomina luoghi (Mercato del Capo, Vaticano) o un tema (natura, cioccolato, spa), ogni luogo nominato entra nel giro o il testo dice che non è stato trovato; le tappe di un tema hanno il tipo di quel tema (parco, giardino, belvedere; non teatro, via o municipio); i luoghi esclusi dalla richiesta non entrano. Controllo da aggiungere al banco: «luoghi nominati nel giro» (il controllo `titolo` lo fa solo sul titolo).

### D7 — «Tempo libero» di oltre due ore · da correggere (nuovo, T18)
`n-roma-intenso` 13:45, 236 min (ritmo Intenso, a Roma, pranzo 12:30 poi vuoto fino alle 18:00); `n-catania-rilassato` 15:20, 159 min; `n-noto-0900` 15:33, 145 min; `n-troina-natura` 15:33, 144 min (e 10:42, 104 min); `n-scicli-cibo` 15:35, 141 min. Poco sotto: `n-napoli-dna-cibo` 119 min (15:50), `n-firenze-dna-cultura` 114 min (16:03), `a-siracusa-ortigia` 108 e 96 min. Nei borghi (Troina, Noto, Scicli) il vuoto dipende dai pochi luoghi; a Roma e Catania no.
Riprodurre a 0 $: `BANCO_CASI=n-roma-intenso,n-catania-rilassato,n-noto-0900,n-troina-natura,n-scicli-cibo npm run banco -- --replay --tappe`.
Regola: un «Tempo libero» supera 90 minuti solo se non c'è nessuna candidata entro il tetto di cammino; in una città grande (Roma, Catania) il pomeriggio ha almeno 2 tappe. Controllo da aggiungere: «nessun tempo libero oltre 120 minuti in città grandi».

### D8 — Una tappa che non è un luogo da visitare · da correggere (`a-matera` da T15; il resto nuovo)
- `a-matera`: «Matera, Italia» (tipo `tourist_attraction`, 40,6664; 16,6044), tappa delle 16:09 fra Fontana Ferdinandea e Palombaro lungo: è la città stessa.
- `a-troina` (09:30) e `n-troina-natura` (14:30): «Comune di Troina» (tipo `city_hall`), il municipio come prima tappa del giro.
- `n-roma-1300-specifica`: «Colosseo» alle 14:30 è la stazione della metro (tipo primario `subway_station`, 41,8915; 12,4915, a circa 150 m dal monumento).
Riprodurre a 0 $: `BANCO_CASI=a-matera,a-troina,n-troina-natura,n-roma-1300-specifica npm run banco -- --replay --tappe`.
Regola: fuori dalle tappe i luoghi il cui nome è la città (o «Città, Italia»), i tipi `city_hall` e `subway_station`/`train_station`/`transit_station` (eccezione: se il luogo ha anche `tourist_attraction` e un nome proprio); per il monumento si cerca per nome e si scartano le stazioni.

### D9 — Nomi generici o di un'altra città · estetico (nuovo, T18)
«punto panoramico sulla città» (`a-napoli`, 17:11), «Punto panoramico» (`a-scicli` 14:30; `a-polignano-a-mare` 16:38), «Terrazza Panoramica» (`n-napoli-ospite-1300`, 15:00), «Trattoria in Siracusa» (`a-siracusa-ortigia`, 12:30), «Cassatelle e Caffè- Dolci Tipici di Agira» come prima tappa a Catania (`a-catania` 09:30, `b-catania-A` 09:30, `n-catania-rilassato` 10:00: il locale è a Catania, il nome è di Agira), «Piazza Ballaro» di tipo `coffee_shop` (`n-palermo-1300-mercato`, 14:30). In `a-napoli` tre belvedere in fila nello stesso tratto (Scalinata del Petraio 16:36, «punto panoramico» 17:11, Belvedere San Martino 18:00, a meno di 500 m l'uno dall'altro).
Riprodurre a 0 $: `BANCO_CASI=a-napoli,a-scicli,a-polignano-a-mare,a-siracusa-ortigia,a-catania,b-catania-A,n-catania-rilassato,n-palermo-1300-mercato npm run banco -- --replay --tappe`.
Regola: un nome senza nome proprio («punto panoramico», «trattoria in …») si sostituisce con il nome del luogo in Google o si arricchisce con la via; due tappe dello stesso tipo a meno di 500 m si fondono in una.

### Osservazione non classificata
Nel registro del giro il Narratore segnala 54 volte una violazione sulle descrizioni: 44 `no-orario-affermato` (la frase «Ci arrivi alle 9:30» è l'orario d'arrivo del giro, non d'apertura) e 10 `no-description-duplicata` sulla riga «Tempo libero» («Niente in agenda: cammina dove ti porta la strada.»). Non entrano nei cinque controlli, non cambiano gli esiti; le segnalo perché T19 le vedrà nel log.

## Prove

- **Giro vero dei 20 casi mancanti**: `npm run banco -- --mancanti`, 20/20 girati (323 secondi), 0 errori, 0 saltati. Il giro si è fermato da sé al tetto: l'ho impostato a 9,0 $ (`BANCO_TETTO=9.0`; il banco lo applica a ogni caso con la stima 0,25 $ per un tour e 1,05 $ per una lista nuova, e salta i casi che non ci stanno) e non l'ha raggiunto.
- **Riproduzione a 0 $**: `npm run banco -- --replay`: **40 casi rigiocati dai tracciati, 40/40 uguali al giro vero** (stesse tappe agli stessi orari, stessi esiti in ogni controllo), **0 uscite in rete**.
- **Guardia**: `npm run banco:guardia` esce con 0 (12 flussi della home, pertinenza, 10 casi del banco con tutti e cinque i controlli).
- **Tracciati**: `docs/prove/dati/banco-40-tracciati.json.gz` contiene ora i 40 casi (prima 20), `banco-40-esiti.json` gli esiti dei 40, `banco-40-tabella.md` la tabella. Nessuna chiave, intestazione o corpo di richiesta nei tracciati.
- **Modifica al banco**: `scripts/banco/banco40.mjs` ha ora `--tappe` (solo stampa, non cambia nessun controllo né esito). Nessun controllo era sbagliato; nessuna modifica all'app.

## Costo (a listino, AI e Google insieme)

| Parte | AI | Google | Totale |
|---|---|---|---|
| Primo lancio (fallito prima di ogni chiamata: mancava il `.env` con l'indirizzo pubblico di Supabase) | 0 $ | 0 $ | 0 $ |
| Giro dei 20 casi mancanti (63 chiamate AI: Sonnet 5.5 206.052 token in e 21.588 out, Haiku 4.5 46.482 in e 2.507 out; Google: 99 ricerche nuove e 7 ricerche per nome, 61 risposte dalla cache del proxy non contate) | 0,69 $ | 3,58 $ | **4,27 $** |
| Riproduzione e guardia | 0 $ | 0 $ | 0 $ |
| **Totale T18** | **0,69 $** | **3,58 $** | **4,27 $** (tetto 10 $) |

Il banco a 40 costa in tutto 13,30 $ a listino (9,03 $ di T15 + 4,27 $ di T18). Rifarlo per intero dal vivo costerebbe circa 13 $ (meno se il proxy ha le liste in cache); la riproduzione costa 0 $.

## Cosa NON risolve

- Nessuno dei difetti: l'app non è stata toccata (sono di T19). Dopo ogni correzione al motore: `npm run banco -- --replay` (non cambia niente finché i tracciati sono quelli del giro vecchio) e un giro vero dei soli casi toccati: `BANCO_CASI=<id,…> BANCO_TETTO=<tetto> npm run banco`, che aggiorna esiti e tracciati di quei casi.
- I 86 luoghi senza orari di Google non sono misurabili dal controllo «aperte».
- Ospite, mezzi e controllo «altra città» restano come nel report di T15 (`2026-11-04-banco-40.md`).
- La classificazione dei difetti D3–D9 è mia, letta sugli itinerari; solo D1–D3 sono misurati dai cinque controlli.

## Passi che aspettano Ivano

Nessun comando. Decisioni per T19: le tre regole di D5 («solo la cena» ammesso o no; partenza entro 30 minuti; dopo mezzanotte) e se D6 vuole un controllo automatico nuovo nel banco.

## File

`docs/prove/dati/banco-40-tracciati.json.gz`, `banco-40-esiti.json`, `banco-40-tabella.md` (aggiornati), `scripts/banco/banco40.mjs` (`--tappe`), `docs/LANCIO.md` (riga L7), questo report.
