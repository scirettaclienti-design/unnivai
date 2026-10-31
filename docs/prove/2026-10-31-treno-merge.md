# TRENO-MERGE: le PR della notte su main, con le decisioni di Ivano (31/10/2026)

Cartella di lavoro: `/Users/mac2023ivanosciretta/unnivai-curiosita`, verificata con `pwd` all'avvio. Le credenziali di prova (`.env.local`) sono state copiate da `~/unnivai-1b` senza stamparle e cancellate a fine task. Nessuna PR tocca `supabase/functions`: nessun deploy di funzioni.

## Esito

Le PR #2–#6 sono unite su main in quest'ordine.

Per ognuna, prima del merge:
- rebase sulla precedente già unita;
- suite verde, lint con 0 errori, build ok;
- `npm run banco:guardia` 12/12 e nessun ❌ nuovo di pertinenza;
- CI della PR verde.

Dopo ogni merge: CI di main verde e deploy Vercel `success` sul commit.

**Collaudo del sito pubblicato** (main `75737a9`): **10/10** sui punti 1–10 e **3/3** sui punti nuovi. Il punto 7 è passato al secondo lancio, dopo una correzione dello script (vedi sotto).

| PR | Cosa | Commit su main | Suite | Guardia | CI PR / main | Vercel |
|---|---|---|---|---|---|---|
| #2 CLAUDE-MD | unita così com'è | `c4452d4` | 2926 ✓ | 12/12 | ✓ / ✓ | success |
| #3 PER-TE-PROPOSTE | + decisioni di Ivano | `063b291` | 2940 ✓ | 12/12 | ✓ / ✓ | success |
| #4 VERITA-SCHEDE | + verifica WebKit e due correzioni | `e53cc5a` | 2947 ✓ | 12/12 | ✓ / ✓ | success |
| #5 TESTI-SCHEDE | + decisioni di Ivano | `75737a9` | 3001 ✓ | 12/12 | ✓ / ✓ | success |
| #6 NOTTE-RIEPILOGO | aggiornato con questo esito, + correzione del punto 7 del collaudo | ultimo commit | 3001 ✓ | 12/12 | ✓ / ✓ | success |

Il lint ha sempre 0 errori; gli avvisi sono quelli di prima (189–190).

## Cosa è stato applicato prima di ogni merge

### #3 PER-TE-PROPOSTE
- **Ricerche serali con cache per città e fascia, condivisa fra gli utenti.** La cache c'era già, sul server.
  - `places-proxy` salva ogni risposta in `public.places_cache` per 24 ore.
  - La chiave è fatta di path e parametri ordinati: centro della città, query, raggio, lingua. Niente dell'utente.
  - La query del cibo cambia con la fascia; di sera è quella della colazione, perché il giro parte alle 9:30. Gli altri temi hanno la stessa query a ogni ora, quindi di sera riusano le risposte del giorno.
  - Il test `perTeCacheSerale.test.js` fissa che alle 20:00, alle 21:30 e all'1:00, da telefoni diversi, le richieste sono identiche.
- **Le frasi delle schede «per dopo» le scrive il codice.** Era già così (`senzaAI`, 0 $).
- **L'ora «per dopo» è le 9:30**, come GIRO-LONTANO (`ORA_PER_DOPO = DAY_START`).
  - La riga sopra le card dice «stamattina» o «domattina» e «dalle 9:30».

### #4 VERITA-SCHEDE
Verifica in WebKit prima del merge: punto 12 del collaudo, sul ramo servito in locale, con il racconto ritardato di 8 s. La prima prova ha trovato **due difetti, già su main da prima**: con loro i cenni della scheda sulla mappa non arrivavano mai.
1. `MapPage` chiamava `aiRecommendationService.enrichMonuments` senza importarlo. Il ReferenceError finiva nel `catch`.
2. Le tappe del giro sulla mappa perdevano `place_id` e `types`.

Ho tolto anche un rischio di giro infinito: senza racconto, l'effetto richiedeva i cenni a ogni `setSelectedPOI`. Ora c'è una richiesta sola per luogo.

Dopo le correzioni:
- la scheda si apre in 85 ms;
- nessuno spinner;
- i cenni arrivano dopo l'attesa;
- una sola richiesta del racconto.

Il contenuto della scheda non si bloccava, quindi non è servito toccarlo. La curiosità di Roma sulle fontanelle resta.

### #5 TESTI-SCHEDE
- **Preposizioni articolate nei titoli:** «Dal Lungomare», «Dal Corso», «Dal Viale», «Dal Lungotevere», «Dal Piazzale», «Al Ponte». Piazze, vie, ville, porte, largo, campo e borgo restano senza articolo («Da Piazza Navona», «Da Via Etnea»).
- **Il titolo del motore resta se ogni suo elemento trova riscontro nelle tappe** (`titoloFondato`).
  - Un elemento è un nome di luogo (deve stare nei nomi o negli indirizzi delle tappe) o un tipo di posto (panorami, fontane, chiese, a tavola…: almeno una tappa di quel tipo).
  - «Da A a B» è la riserva, per i titoli generici o falsi.
  - Sui 54 titoli diversi dei giri registrati: 33 restano, 21 passano alla riserva.

**10 titoli prima e dopo** (giri registrati del banco):

| Titolo del motore | Dopo | Perché |
|---|---|---|
| Tour di Roma | Dall'Albero Monumentale Pioppo Nero al Palazzo dei Conservatori | generico |
| Tesori di Catania | Dalla Basilica Cattedrale di Sant'Agata al Palazzo Platamone | generico |
| Il tuo giro a Catania | Dal Palazzo dei Chierici a Porta Uzeda | generico |
| Catania dall'alto (Piazza Università, Fontana dell'Amenano, Porta Uzeda) | Da Piazza Università a Porta Uzeda | falso: nessun panorama |
| Riflessi d'Amore a Catania | Dalla Chiesa della Badia di Sant'Agata al Lungomare di Acicastello | non verificabile |
| Roma dall'alto (Gianicolo Belvedere, Giardino degli Aranci, Terrazza delle Quadrighe) | Roma dall'alto | resta |
| Panorami Romantici di Roma | Panorami Romantici di Roma | resta |
| Vista mare a Catania (Lungomare di Acicastello, porto) | Vista mare a Catania | resta |
| A tavola a Catania (due trattorie) | A tavola a Catania | resta |
| Relax Verde a Roma (tre ville) | Relax Verde a Roma | resta |

## Collaudo del sito pubblicato

Collaudo: `node scripts/prova-nav/collaudo-sito.webkit.mjs 1,2,3,4,5,6,7,8,11,12,13` sul sito pubblicato da main `75737a9`, con WebKit, profilo iPhone 14 e account di prova. Il punto 8 fa anche 9 e 10. Esiti in `docs/prove/dati/2026-10-31-treno-merge-collaudo.json`, schermate in `docs/prove/schermate/treno-merge/`. Le schermate dei collaudi precedenti in `collaudo-sito/` non sono state toccate.

| Punto | Esito | Cosa si è visto |
|---|---|---|
| 1 Freccia sparisce dopo 10 m | ✅ | «Parti da qui verso Porta Uzeda» a 5 m, nessuna freccia a 15 m |
| 2 Tappa 2 dopo «Salta»: niente freccia | ✅ | pillola «55 m · verso Basilica Cattedrale di Sant'Agata» |
| 3 GPS muto 60 s e ripresa | ✅ | «Ho perso il segnale. Continua pure: quando torna, riparto da dove sei.», nessuna freccia |
| 4 Curiosità: Roma sì, Catania no | ✅ | a Roma il toast dei nasoni e la voce; a Catania niente |
| 5 Schede: racconto o frase breve | ✅ | 6 schede su 6 con testo a schermo. In `place_racconti`: Orto Botanico, Villa Sciarra, Palazzo Massimo, Fontana dell'Elefante r5 passato; Piazza del Campidoglio r5 scartato (frase breve); Cattedrale passato in cache |
| 6 «Fine» a 2/3 | ✅ | «Sei arrivato a 2 tappe su 3.», Profilo da 15 a 16, nessun doppione dopo ricarica e Home |
| 7 «Salta» fino in fondo + 3 tocchi | ✅ (2° lancio) | con l'account: fine giro su `/map`, «Hai saltato tutte le tappe: il giro finisce qui.», nessun login. Da ospite `/map` porta al login (come il 30/10) |
| 8 Crea «un giro a Catania» da Roma | ✅ | «Domani · 9:30 · cambia» |
| 9 Panoramica | ✅ | «Il centro barocco e i giardini di Catania · 4,9 km · 13 tappe» |
| 10 «Avvia» da lontano | ✅ | «Sei a 537 km da Catania: la guida parte quando sei lì.», niente navigazione, mappa non nera |
| **11 Per Te a Roma alle 01:00 e alle 20:00** | ✅ | 5 schede a ogni ora. All'1:00: 1 per adesso + 4 «Per stamattina», riga «Adesso è aperto poco. Le altre sono per stamattina.». Alle 20:00: 1 per adesso + 4 «Per domattina» |
| **12 Scheda monumento che si apre subito** | ✅ | Palazzo Massimo alle Colonne: scheda in 84 ms, 0 spinner, la pagina risponde (1 ms), cenni (racconto r5 passato) dopo 8,9 s con il racconto ritardato di 8 s, 1 sola richiesta |
| **13 Titoli dei giri generati** | ✅ | 4 giri a Catania (Per Te adesso), 5 a Roma (punto 11): elenco sotto |

**Punto 7 al primo lancio:** il tentativo da ospite non trovava la panoramica, perché `/map` porta al login. Lo script lanciava l'errore invece di registrarlo come «non raggiungibile», come faceva il 30/10, e il punto cadeva intero. Ho corretto lo script nella PR #6 (`prova(true).catch(...)`) e rilanciato solo il punto 7. Il primo tentativo resta nel JSON come `7_primo_tentativo`.

**Come si è simulata l'ora (punto 11):** si è spostato l'orologio della pagina con `page.clock` all'1:00 del 31/10 e alle 20:00 del 30/10, quindi all'indietro, perché la sessione resti valida. La schermata mostra l'alto della Home; le schede vengono lette dal DOM.

### 5 titoli di giri generati, letti

| Dove | Titolo a schermo | Tappe | Lettura |
|---|---|---|---|
| Roma, giro della sera | Un giro di sapori nel centro di Roma | Freni e Frizioni · Campo de' Fiori · Roscioli Salumeria con Cucina | titolo del motore tenuto: «sapori» ha la Salumeria con Cucina. Vero |
| Roma, per domattina | Panorami a Roma | Piazza del Campidoglio · Terrazza Italia · Terrazza Belvedere del Palatino · Belvedere Cederna | titolo del tema tenuto: tre terrazze/belvedere. Vero, ma un po' generico |
| Roma, per domattina | Dall'Albero Monumentale Pioppo Nero all'Hortus Urbis | Albero Monumentale Pioppo Nero · Foresta di bambù · Giardino di Sant'Alessio · Hortus Urbis | riserva «Da A a B»: prima e ultima tappa vere |
| Catania, adesso | Dalla Basilica Cattedrale di Sant'Agata al Palazzo Biscari | Basilica Cattedrale · Chiesa della Badia di Sant'Agata · Palazzo Platamone · Palazzo Biscari | riserva: preposizioni giuste |
| Catania, adesso | Dalla Fontana dell'Elefante al Lungomare di Catania | Fontana dell'Elefante · Porta Uzeda · Lungomare di Catania | riserva, con «al Lungomare» articolato |

Da notare:
- **«Dove si mangia a Roma» su quattro forni** (Antico Forno Santini, Le Levain, Forno Monteforte, Il Fornaio), per le 9:30. Il titolo del tema regge perché Google dà ai forni anche un tipo da ristorante. Alle 9:30 è una colazione, non un pasto: il titolo non mente, ma è poco preciso.
- **All'1:00 il giro della sera è «Intorno a Piazza Navona»** con solo due tappe (un bar e la piazza): a quell'ora non c'è altro aperto.

## Spesa AI della giornata (31/10)

Fonti: `place_racconti.costo_usd`, `city_knowledge.costo` (token × listino Sonnet 5.5: 2 $ / 10 $ per milione), il report RACCONTO-RIFINITURE e i log delle funzioni (sola lettura).

| Voce | Spesa |
|---|---|
| Misura dal vivo r4 → r5 (RACCONTO-RIFINITURE, notte) | 0,700 $ |
| Racconti nuovi in `place_racconti` (8: 5 del collaudo dopo il deploy delle 01:59, 1 di oggi pomeriggio, 1 senza fonti, 1 altro) | 0,080 $ |
| Liste della città (Roma 00:52, Catania 13:46) | 0,051 $ |
| Giri generati nel collaudo (Per Te ×3, Crea Catania, Home dei contesti) | **non registrata**: l'account di prova non scrive biglietti. Stima ≤ 0,46 $ (46 chiamate riuscite a `openai-proxy` fra le 13:30 e le 14:20, molte racconti in cache a 0 $, a ~0,01 $ l'una al massimo) |
| Voce umana | 0 $: OpenAI risponde 429 «no credits remaining» (16 volte nel collaudo), la voce è quella del telefono |
| Lavori della notte T0–T3 | 0 $ (nessuna chiamata a pagamento) |
| **Totale misurato** | **0,83 $**; con la stima dei giri, al massimo ~1,29 $ |

## Cosa NON risolve

- **La voce umana è ferma: il credito OpenAI è finito.** Il collaudo passa lo stesso, perché la voce ripiega su quella del telefono come previsto. Va ricaricato il credito OpenAI.
- La chat libera con la guida può ancora dire fatti non verificati (T2).
- «Almeno 4 proposte» vale solo dove i pool hanno posti: a Troina ne escono 2.
- Il vocabolario dei titoli (`CATEGORIE`, `VUOTE` in `titoliGiro.js`) è chiuso. Una parola nuova del motore che il codice non conosce manda il titolo alla riserva «Da A a B»: è voluto, meglio un titolo nudo che uno falso.
- I titoli del tema di Per Te «per dopo» («Panorami a Roma», «Dove si mangia a Roma») restano quando sono veri, ma sono poco evocativi.
- La spesa dei giri dell'account di prova non si misura dal database. Serve la console di Anthropic, oppure un biglietto anche per l'account di prova (da decidere).

## git log --oneline -8 main

Il log è preso prima del merge di #6; i commit di #6 sono quelli in cima dopo il merge (vedi la PR #6).

```
75737a9 TESTI-SCHEDE: decisioni di Ivano — il titolo del motore resta se ogni elemento ha riscontro nelle tappe («Roma dall'alto» col Belvedere del Gianicolo), «Da A a B» solo per i titoli generici o falsi; «Dal Lungomare», «Dal Corso», «Dal Viale» nei titoli; 10 titoli prima/dopo nel report
4f5dc5c TESTI-SCHEDE: preposizioni articolate nelle frasi delle schede (una sola regola con alNome), titoli dalle tappe vere, niente etichette interne a schermo, frasi non ripetute fra le schede della lista
e53cc5a VERITA-SCHEDE: la scheda di una tappa sulla mappa riceve davvero i cenni (import di aiRecommendationService che mancava, place_id e types nelle tappe, una sola richiesta per luogo); collaudo con i punti 11–13 (Per Te alle 01:00 e alle 20:00, scheda che si apre subito, titoli dei giri); prova WebKit: scheda in 85 ms, cenni dopo l'attesa, nessuno spinner
d010df9 VERITA-SCHEDE: i cenni di un luogo vengono solo dal racconto con le fonti; tolte le curiosità senza fonti (enrichMonuments, database, blocco Dettaglio); test Catania e Roma
063b291 PER-TE-PROPOSTE: decisioni di Ivano — «per dopo» alle 9:30 come GIRO-LONTANO (riga con stamattina/domattina), frasi delle schede per dopo dal codice, ricerche serali sulla cache condivisa del server per città e fascia (test)
91101ba PER-TE-PROPOSTE: Per Te ha sempre almeno 4 proposte; quelle non fattibili adesso dicono «Per domattina» (composte dal codice, senza AI); il DNA pesa su drink e passeggiata
c4452d4 CLAUDE-MD: racconti r5, guardia prima del merge, migrazioni salvate, deploy da main, collaudo e iPhone
a564ffe RACCONTO-RIFINITURE: report (resa r4 → r5, costo per racconto passato, lettura a mano, cosa non risolve); collaudo del punto 5 ripetuto dopo il deploy di openai-proxy v38: 3 tappe di Roma con racconto passato in place_racconti, i 3 scartati r4 riscritti
```
