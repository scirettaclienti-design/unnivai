# C10b2 — modello nuovo per la conoscenza delle città, metropoli in due quartieri, borghi veri

Verifiche iniziali: cartella `~/unnivai-1b`, HEAD `a7c233f`, suite verde (2004). Account di prova, credenziali solo da `.env.local`, mai stampate. Giro sul codice finale: 8 tour (Roma neutra, A, B, «Domani una giornata a Trastevere», Napoli, Troina ×2, Catania «Domani un giorno da catanese»), ora simulata mercoledì 14/10 22:19 (tour per giovedì 15/10), ricerca nuova come in produzione.

## In breve

| Obiettivo | Esito |
|---|---|
| Lista, traduttore e selettore su `gpt-6.1-sol`, narratore sul modello di prima, un solo punto di configurazione, ripiego scritto nel tracciato | 🟢 fatto. Nel giro: 0 ripieghi su 8 tour; nel confronto: 0 su 6 liste (dopo aver portato il tempo massimo da 28 a 60 s, vedi «Un errore mio») |
| Confronto fra i due modelli sulle 6 liste | 🟢 tabella sotto |
| Roma piena: ≥ 9 tappe, ≤ 150 min di tempo libero | 🔴 **non raggiunto**: 8 / 8 / 9 tappe, 184–222 min (prima 7 tappe, 274–280 min) |
| Trastevere con almeno 3 luoghi da visitare nel quartiere | 🟢 4 (Santa Maria in Trastevere, Villa Farnesina, Porta Settimiana, Orto Botanico), dalla lista dedicata del quartiere |
| Troina con almeno 3 posti verificati | 🟢 nella lista: 4 su 4 (con `gpt-4o-mini` era 1 su 8). 🔴 ma nel tour **0**: due erano «piazze» che per Google sono vie (zone, C7), e la Chiesa Madre è chiusa giovedì mattina (ORARI) |
| Troina: giro corto non gonfiato di tempo libero | 🔴 **non raggiunto** (vedi «Troina») |
| «Conosce la città» verde in Roma ×4 e Troina ×2 | 🟢 Roma 4 su 4; 🔴 Troina 0 su 2 |
| Catania invariata o migliore | 🔴 **peggiore**: 2 essenziali di controllo nel tour (prima 5), 175 min di tempo libero (prima 56) |
| Suite verde, deploy, pubblicato | 🟢 2016 test verdi; `openai-proxy` v20; pubblicato |

**Spesa del task: ≈ 8,37 $ al listino** del banco (≈ 5,0 $ reali), sotto il tetto approvato di 8,5 $ (5 $ all'inizio, poi 6,5 $, poi 8,5 $: due richieste mie, due risposte tue). Dettaglio in «Spesa».

## 0. Il modello

- **Disponibile sull'account:** `GET /v1/models/gpt-6.1-sol` → HTTP 200 con la chiave locale; poi una chiamata vera dal proxy in produzione (chiave del server) col passaggio traduttore: risposta da `gpt-6.1-sol` in 7,8 s, nessun ripiego. Chiavi mai stampate.
- **Prezzo** (listino ufficiale OpenAI, https://developers.openai.com/api/docs/pricing, letto il 14/10/2026, tariffa Standard): `gpt-6.1-sol` **2,00 $** per milione di token in ingresso, **10,00 $** in uscita (0,10 $ in cache); `gpt-4o-mini` 0,15 $ / 0,60 $.
- **Come si chiama** (provato sull'account il 14/10): è un modello che ragiona. Rifiuta `max_tokens` (vuole `max_completion_tokens`, che conta anche il ragionamento), accetta solo `temperature` 1, `reasoning_effort` da `low` in su; con 60 token di budget la risposta usciva vuota (tutti spesi nel ragionamento). Il proxy adatta la chiamata: via `temperature`, `max_completion_tokens` = quelli chiesti + 3.000 (tetto 8.000), `reasoning_effort: 'low'`.
- **Un solo punto di configurazione:** `supabase/functions/openai-proxy/modelli.ts` (`MODELLI`). Il client manda sempre il modello di prima (`gpt-4o-mini`) e il **passaggio** (`dv.passaggio`: traduttore, selettore, narratore); la lista della città e quella del quartiere passano dal server. Il proxy usa il modello del passaggio; se non risponde, sbaglia, risponde vuoto o va oltre il tempo massimo, **rifà la stessa chiamata col modello di prima** (`chiamaConRipiego`) e lo scrive nella risposta (`_modello`: chiesto, usato, ripiego, motivo, ms). Il giro lo riporta in `_modelli`; il banco conta i token per modello.

| Passaggio | Modello | Tempo massimo |
|---|---|---|
| lista della città (abitanti + lista) | `gpt-6.1-sol` | 60 s per chiamata (il client aspetta 110 s) |
| lista dedicata del quartiere | `gpt-6.1-sol` | 60 s |
| traduttore | `gpt-6.1-sol` | 15 s |
| selettore | `gpt-6.1-sol` | 22 s (il client aspetta 50 s, prima 35) |
| narratore (frasi chiuse) | `gpt-4o-mini` | 25 s |

**Un errore mio, e il costo.** Nella prima versione il tempo massimo della lista era 28 s. `gpt-6.1-sol` scrive ~37 token al secondo e una lista da 15–18 posti sono 1.000–1.600 token: 5 liste su 6 sono ripiegate su `gpt-4o-mini` (solo Troina, 8 posti, è arrivata in 15 s). Ho alzato il tempo a 60 s e la versione della lista a `c10b-4` (le `c10b-3` del 15/10 sono di `gpt-4o-mini`, non si riusano), e rifatto il confronto. Costo dello sbaglio: 3,09 $ al listino (0,47 $ reali: 75 ricerche su 85 dalla cache del proxy) più 5 tentativi interrotti di `gpt-6.1-sol`, che non so se OpenAI fattura. Grezzo: `dati/2026-10-17-c10b2-confronto-ripiego-28s.json`.

## 0b. Il confronto, solo sulla lista della città

Stesso prompt per città e metropoli (quello di `c10b-2`; il borgo con `gpt-6.1-sol` chiede in più la categoria). `gpt-4o-mini` = liste `c10b-2` del 14/10 (verificate con la regola di allora: per Troina senza la sostituzione per categoria); `gpt-6.1-sol` = liste `c10b-4` (`dati/2026-10-17-c10b2-confronto.json` e `city_knowledge`). «Inventati» = nomi proposti che la verifica scarta (non tutti sono inventati: «Duomo di Lecce» esiste, Google lo chiama «Cattedrale di Maria Santissima Assunta»). Essenziali di controllo = le liste di `scripts/banco/asticella-c10.js`.

| Città | Modello | Proposti | Verificati | Scartati (%) | Simbolo | Essenziali di controllo | Scala a parole | Tempo AI | Costo AI | Costo Google |
|---|---|---|---|---|---|---|---|---|---|---|
| Catania | 4o-mini | 14 | 12 | 2 (14%) | Cattedrale di Sant'Agata | 6/8 | metropoli* | 12,8 s | 0,0008 $ | 0,51 $ |
| Catania | 6.1-sol | 15 | 14 | 1 (7%) | Cattedrale di Sant'Agata | 4/8 | città | 42,8 s | 0,0174 $ | 0,54 $ |
| Roma | 4o-mini | 17 | 17 | 0 (0%) | Colosseo + 6 (uno per quartiere) | 2/6 | metropoli | 12,4 s | 0,0010 $ | 0,61 $ |
| Roma | 6.1-sol | 14 | 13 | 1 (7%) | Piramide Cestia, Santa Maria in Trastevere, San Pietro in Vincoli | **0/6** | metropoli | 37,0 s | 0,0173 $ | 0,51 $ |
| Napoli | 4o-mini | 19 | 19 | 0 (0%) | Duomo, Plebiscito, Fontanelle | 3/6 | metropoli | 10,7 s | 0,0008 $ | 0,68 $ |
| Napoli | 6.1-sol | 16 | 14 | 2 (13%) | Duomo, Santa Maria della Sanità, Castel Sant'Elmo | 2/6 | metropoli | 40,3 s | 0,0169 $ | 0,58 $ |
| Palermo | 4o-mini | 15 | 14 | 1 (7%) | Cattedrale | 4/6 | metropoli | 11,7 s | 0,0008 $ | 0,54 $ |
| Palermo | 6.1-sol | 15 | 15 | 0 (0%) | Cattedrale | 3/6 | metropoli | 33,0 s | 0,0164 $ | 0,54 $ |
| Lecce | 4o-mini | 14 | 11 | 3 (21%) | Santa Croce | 4/6 | città | 16,8 s | 0,0007 $ | 0,51 $ |
| Lecce | 6.1-sol | 15 | 13 | 2 (13%) | Santa Croce | 2/6 | città | 45,2 s | 0,0147 $ | 0,54 $ |
| Troina | 4o-mini | 8 | 1 | 7 (88%) | — | 0/3 | borgo | 5,1 s | 0,0004 $ | 0,30 $ |
| Troina | 6.1-sol | 4 | 4 | 0 (0%) | Chiesa Madre | 1/3 | borgo | 21,4 s | 0,0089 $ | 0,16 $ |

\* La scala a parole di `gpt-4o-mini` per Catania cambia da una chiamata all'altra: «città» nel primo confronto, «metropoli» nel secondo. Palermo è «metropoli» a parole per tutti e due i modelli; con la regola degli abitanti (≈ 630.000) e il diametro (1,1 km) è città.

Tempo e costo AI = le due chiamate della lista (abitanti + lista); costo Google = verifica al listino (nomi × 0,035 $ + il centro). **Cosa dice il confronto:** `gpt-6.1-sol` inventa meno (Troina: 4 nomi tutti veri invece di 1 su 8; scartati 0–13% contro 0–88%) ma **sceglie meno simboli**: propone più posti «da locale» e meno essenziali famosi (Roma senza Colosseo, Pantheon, Navona; Catania senza Teatro Bellini e Villa Bellini; Lecce senza Piazza del Duomo e Carlo V). Le liste di controllo ne trovano meno in 5 città su 6. Costa ~20 volte di più in token (sempre sotto 2 centesimi a lista: il costo della lista resta la verifica su Google) e ci mette 3–4 volte tanto (33–45 s invece di 10–17 s): il primo tour del giorno di una città aspetta di più.

## 1. Metropoli: due quartieri in giornata intera

- **Raggio del quartiere 2 km**, **centro = baricentro dei posti verificati** del quartiere (lista della città e, se c'è, lista dedicata). Il baricentro c'era già da C10b; nuovo è il raggio fisso di 2 km (prima 1,5–2,5).
- **Giornata intera** (6 ore o più) e nessun quartiere nominato: la **mattina nel quartiere con più ancore aperte** (a parità il più vicino alla partenza), il **pomeriggio nel quartiere con un essenziale più vicino al primo**, se i centri stanno entro 3 km (i cerchi da 2 km si sovrappongono per almeno 1 km: il passaggio sta nel tetto di cammino C5c, che non cambia e che il riparatore controlla tappa per tappa). Il pranzo sta in uno dei due; aperitivo, passeggiata e cena nel secondo (`bucketsNelleAree`). Le ancore sono gli essenziali dei due quartieri.
- **Senza richiesta** un quartiere si sceglie solo se ha almeno 1 essenziale verificato.

| Tour | Quartieri | Ancore seminate → esito |
|---|---|---|
| c10-roma | Trastevere (mattina) → Testaccio (pomeriggio), centri a 1,66 km | Piramide Cestia, Santa Maria in Trastevere, Cimitero Acattolico: tutte nel giro |
| c10-roma-a | Trastevere → Testaccio | Santa Maria in Trastevere nel giro; Piramide tolta (regola dura: prima tappa a 26 min dal gruppo), Cimitero Acattolico tolto (regola dura: 33 min > 20) |
| c10-roma-b | Trastevere → Testaccio | tutte e tre nel giro |
| c10-napoli | Decumani → Sanità, centri a 0,46 km | Duomo, Cappella Sansevero: nel giro |

**Perché Roma non arriva a 9 tappe e 150 minuti.** I due quartieri sono quelli della lista di `gpt-6.1-sol`, che ha 13 posti verificati per tutta Roma, di cui 3 essenziali; gli altri sono soprattutto locali (Trastevere ha 2 luoghi da visitare in lista). Il resto del pool viene dalle ricerche, che cercano dal centro della città e dal quartiere: nel cerchio dei due quartieri ci sono pochi posti aperti e «di famiglia nuova» entro il tetto di cammino, e il tempo libero resta (99 + 47 + 76 min nel tour neutro). Prima (C10b, un quartiere da 1,5 km al Celio) erano 7 tappe e 274–280 min: il giro è più pieno, non abbastanza.

## 2. Il quartiere chiesto

- Se la richiesta nomina un quartiere, vale quello (anche senza essenziali). Se in lista ha **meno di 3 luoghi da visitare**, il proxy fa una **lista dedicata** del quartiere (`purpose: 'quartiere_list'`, `gpt-6.1-sol`, 6–8 luoghi da visitare, verificati come la lista; una per città, giorno e quartiere, `city_knowledge.versione = 'c10b-4#q:trastevere'`). I suoi luoghi da visitare sono le ancore candidate della giornata (al massimo 3, una per famiglia, il simbolo per primo).
- **Trastevere, nel giro:** in lista 2 luoghi da visitare → lista dedicata: 7 verificati su 7 (Santa Maria in Trastevere, Santa Cecilia, Villa Farnesina, Orto Botanico, Porta Settimiana, Piazza di Santa Maria in Trastevere, Piazza Trilussa), in 9,0 s. **Costo della lista dedicata: 0,25 $ al listino** (7 ricerche × 0,035 $ + 2 centri; token di `gpt-6.1-sol` ≈ 0,01 $). Nel tour: **4 luoghi da visitare del quartiere** (Santa Maria in Trastevere ⚓, Villa Farnesina ⚓, Porta Settimiana, Orto Botanico ⚓), 9 tappe, 188 min di tempo libero.

## 3. Borghi

- **Il nome di Google con la stessa categoria:** nel borgo l'AI dà anche la categoria di ogni posto (chiesa, monumento, museo, piazza, mercato, bar, pasticceria, ristorante, parco). Se nessun risultato ha un nome compatibile, si accetta il primo **dentro il comune** (5 km e indirizzo nel comune) con la **stessa categoria** (`categoriaGoogle`, dai tipi di Google; castello e torre sono «monumento», pasticceria e bar la stessa famiglia), e la sostituzione si scrive (`_citta.sostituzione`, `_citta.sostituzioni`). Nel giro non è servita: `gpt-6.1-sol` ha dato per Troina direttamente i nomi di Google («Chiesa Madre di Maria Santissima Assunta»). È provata dai test sul caso del 14/10 («Cattedrale di Troina» → «Chiesa Madre…»).
- **Giro corto:** con meno di 4 posti verificati la durata segue le tappe (45 min per luogo da visitare, 2–4 luoghi, `durataBorgoCorto`), senza tempo libero aggiunto; la riga «Troina si gira in mezza giornata.» resta.

**Troina, cosa è successo.** La lista di `gpt-6.1-sol` ha 4 posti, tutti verificati: Chiesa Madre, Chiesa di San Silvestro, Piazza Conte Ruggero, Piazza Giacomo Matteotti. Ma:
1. le due piazze per Google sono **vie** (tipo `route`): la regola delle zone (C7, non toccata) le toglie;
2. la **Chiesa Madre è chiusa** giovedì mattina secondo Google (come Torre Capitania e il Museo Robert Capa): ORARI, regola dura;
3. San Silvestro non entra nel pool (non so per quale filtro: non è nel tracciato);
4. con 4 verificati la regola «meno di 4» non scatta: la giornata resta intera (6 tappe, 316 min di tempo libero), la mezza giornata chiesta ha 2 tappe e 145 min.

Ho provato a contare solo i posti utilizzabili (senza le vie) e i luoghi a portata di piedi: il giro diventava di 3 ore, ma con **una sola tappa** e una riga di tempo libero da 0 minuti, perché la mattina a Troina è aperta solo Piazza Matteotti. **L'ho annullato** (peggio di prima): il codice finale è quello del giro degli 8 tour. Il tentativo è nel grezzo `dati/2026-10-17-banco-esteso-c10-2.json` (0,40 $).

## Deploy

- `openai-proxy`: **v19** (modelli e lista del quartiere, tempo massimo 28 s), poi **v20** (tempo massimo 60 s, versione `c10b-4`). Prima del primo deploy la v18 in produzione era quella del commit `a7c233f`.
- **Nessuna migrazione:** la lista del quartiere usa la stessa tabella con la sua versione.
- `places-proxy` non toccato (v11). Il client esce col prossimo deploy di Vercel.

## Test rosso → verde

`src/__tests__/services/c10b2.test.js`, 12 test. Sul commit `a7c233f` il file non si carica (`modelli.ts` non esiste). La copia senza la parte dei modelli fallisce in 7 test su 8; l'ottavo, «categoria diversa o fuori comune: non entra», è un controllo che deve restare vero anche prima.
- il passaggio lista usa il modello configurato, coi parametri che quel modello accetta;
- se il modello non risponde in tempo si usa quello di prima, e il tracciato lo scrive (anche per un errore o una risposta vuota);
- **Roma in giornata intera: mattina in un quartiere, pomeriggio in un quartiere vicino**;
- **«Trastevere» chiesto → la lista dedicata e almeno 3 luoghi da visitare a Trastevere nel tour**;
- **centro del quartiere dal baricentro, raggio 2 km**;
- **Troina: «Cattedrale di Troina» (chiesa) → «Chiesa Madre…» (chiesa, nel comune) entra**;
- **borgo con meno di 4 posti: nessun tempo libero aggiunto**, la riga resta;
- senza richiesta, un quartiere senza essenziali non si sceglie.

Aggiornati 3 test esistenti ai cambi voluti: la versione della lista; la durata del borgo, non più fissa a 240 min; il biglietto del proxy, che ora porta anche il passaggio (resta lo stesso biglietto).

**Suite: 150 file, 2016 test verdi.** Lint 0 errori. `deno check` del proxy ok.

## Tour × voci dell'asticella

Soglie: conosce la città ≥ 3 essenziali della lista di controllo nel tour e ≥ 50% delle visite dalla lista verificata (metropoli: ≥ 2 ancore del quartiere scelto e la stessa quota; borgo: ≥ 2 posti della lista, anche in mezza giornata); giornata piena ≤ 45 min di tempo libero; costo primo tour della città nel giorno ≤ 0,60 $, gli altri ≤ 0,20 $; tempo ≤ 21.2 s + 5 s.

| Tour | Tappe | Conosce la città | Essenziali nel tour | Visite dalla lista | Giornata piena (tempo libero) | Lista | Costo | Tempo |
|---|---|---|---|---|---|---|---|---|
| c10-ivano | 10 | 🔴 | Cattedrale di Sant'Agata, Castello Ursino | 2/6 | 🔴 175 min | dal server | 🔴 $0,262 | 🔴 32.8 s |
| c10-roma | 8 | 🟢 | Trastevere + Testaccio: Basilica di Santa Maria in Trastevere, Piramide di Caio Cestio, Cimitero Acattolico per gli Stranieri di Roma | 4/5 | 🔴 222 min | dal server | 🔴 $0,290 | 🔴 33.1 s |
| c10-roma-a | 8 | 🟢 | Trastevere + Testaccio: Basilica di Santa Maria in Trastevere, Villa Farnesina | 2/4 | 🔴 220 min | dal server | 🔴 $0,283 | 🔴 31.7 s |
| c10-roma-b | 9 | 🟢 | Trastevere + Testaccio: Basilica di Santa Maria in Trastevere, Piramide di Caio Cestio, Cimitero Acattolico per gli Stranieri di Roma | 4/6 | 🔴 184 min | dal server | 🔴 $0,333 | 🔴 32.2 s |
| c10-napoli | 7 | 🟢 | Decumani + Sanità: Duomo di Santa Maria Assunta, Museo Cappella Sansevero | 2/4 | 🔴 273 min | dal server | 🔴 $0,247 | 🔴 43.4 s |
| c10-troina | 6 | 🔴 | — | 0 posti della lista | 🔴 316 min | dal server | 🔴 $0,297 | 🔴 28.6 s |
| c10b-trastevere | 9 | 🟢 | Trastevere: Basilica di Santa Maria in Trastevere, Villa Farnesina, Porta Settimiana, Orto Botanico di Roma | 4/5 | 🔴 188 min | dal server | 🔴 $0,505 | 🔴 39.2 s |
| c10b-troina-mezza | 2 | 🔴 | — | 0 posti della lista | ⚪ — min | dal server | 🔴 $0,223 | 🟢 22.5 s |

**Su misura** (profili A e B, stessa città: almeno metà delle tappe diverse)

| Città | Tappe A | Tappe B | In comune | Diverse | Esito | In comune |
|---|---|---|---|---|---|---|
| catania | — | — | — | — | ⚪ | caso mancante |
| Roma | 8 | 9 | 2 | 78% | 🟢 | Basilica di Santa Maria in Trastevere, Belvedere Tarpeo |

**Invenzioni** (nomi proposti dall'AI che Google non verifica; indicatore, obiettivo sotto il 20%)

| Città | Proposti | Verificati | Scartati | Quota | Esito |
|---|---|---|---|---|---|
| Catania | 15 | 14 | 1 | 7% | 🟢 |
| Roma | 14 | 13 | 1 | 7% | 🟢 |
| Napoli | 16 | 14 | 2 | 13% | 🟢 |
| Troina | 4 | 4 | 0 | 0% | 🟢 |

## Scala, quartiere, simbolo, ancore (C10b)

| Tour | Scala (proposta → confermata, diametro) | Quartiere | Simbolo nella lista | Simbolo nel tour | Ancore seminate → esito |
|---|---|---|---|---|---|
| c10-ivano | città → **città** (0.7 km, essenziali) | — | Basilica Cattedrale di Sant'Agata | Basilica Cattedrale di Sant'Agata | Basilica Cattedrale di Sant'Agata: nel giro; Castello Ursino: nel giro |
| c10-roma | metropoli → **metropoli** (2.25 km, essenziali) | Trastevere [mattina (e pranzo)] (il quartiere con piu' ancore aperte, il piu' vicino alla partenza a parita') → Testaccio [(pranzo e) pomeriggio, sera] (il quartiere con un essenziale piu' vicino a Trastevere (1.66 km fra i centri)) | Piramide di Caio Cestio [Testaccio]; Basilica di Santa Maria in Trastevere [Trastevere]; Basilica di San Pietro in Vincoli [Monti] | Piramide di Caio Cestio, Basilica di Santa Maria in Trastevere | Piramide di Caio Cestio: nel giro; Basilica di Santa Maria in Trastevere: nel giro; Cimitero Acattolico per gli Stranieri di Roma: nel giro |
| c10-roma-a | metropoli → **metropoli** (2.25 km, essenziali) | Trastevere [mattina (e pranzo)] (il quartiere con piu' ancore aperte, il piu' vicino alla partenza a parita') → Testaccio [(pranzo e) pomeriggio, sera] (il quartiere con un essenziale piu' vicino a Trastevere (1.66 km fra i centri)) | Piramide di Caio Cestio [Testaccio]; Basilica di Santa Maria in Trastevere [Trastevere]; Basilica di San Pietro in Vincoli [Monti] | Basilica di Santa Maria in Trastevere | Piramide di Caio Cestio: tolta (regola dura: prima tappa fuori dal gruppo: 26 min dal centro del gruppo (tetto 20)); Basilica di Santa Maria in Trastevere: nel giro; Cimitero Acattolico per gli Stranieri di Roma: tolta (regola dura: oltre il tetto di cammino (33 min > 20)) |
| c10-roma-b | metropoli → **metropoli** (2.25 km, essenziali) | Trastevere [mattina (e pranzo)] (il quartiere con piu' ancore aperte, il piu' vicino alla partenza a parita') → Testaccio [(pranzo e) pomeriggio, sera] (il quartiere con un essenziale piu' vicino a Trastevere (1.66 km fra i centri)) | Piramide di Caio Cestio [Testaccio]; Basilica di Santa Maria in Trastevere [Trastevere]; Basilica di San Pietro in Vincoli [Monti] | Piramide di Caio Cestio, Basilica di Santa Maria in Trastevere | Piramide di Caio Cestio: nel giro; Basilica di Santa Maria in Trastevere: nel giro; Cimitero Acattolico per gli Stranieri di Roma: nel giro |
| c10-napoli | metropoli → **metropoli** (3.25 km, essenziali) | Decumani [mattina (e pranzo)] (il quartiere con piu' ancore aperte, il piu' vicino alla partenza a parita') → Sanità [(pranzo e) pomeriggio, sera] (il quartiere con un essenziale piu' vicino a Decumani (0.46 km fra i centri)) | Duomo di Santa Maria Assunta [Decumani]; Basilica di Santa Maria della Sanità [Sanità]; Castel Sant'Elmo [Vomero] | Duomo di Santa Maria Assunta | Duomo di Santa Maria Assunta: nel giro; Museo Cappella Sansevero: nel giro |
| c10-troina | borgo → **borgo** (0.23 km, essenziali) | — | Chiesa Madre di Maria Santissima Assunta | — | — |
| c10b-trastevere | metropoli → **metropoli** (2.25 km, essenziali) | Trastevere [tutta la giornata] (nominato nella richiesta) | Piramide di Caio Cestio [Testaccio]; Basilica di Santa Maria in Trastevere [Trastevere]; Basilica di San Pietro in Vincoli [Monti] | Basilica di Santa Maria in Trastevere | Basilica di Santa Maria in Trastevere: nel giro; Villa Farnesina: nel giro; Orto Botanico di Roma: nel giro |
| c10b-troina-mezza | borgo → **borgo** (0.23 km, essenziali) | — | Chiesa Madre di Maria Santissima Assunta | — | — |

## Il modello di ogni passaggio (C10b2)

| Tour | Lista | Lista del quartiere | Traduttore | Selettore | Ripieghi | Token per modello |
|---|---|---|---|---|---|---|
| c10-ivano | gpt-6.1-sol, 2.3 s; gpt-6.1-sol, 40.5 s (lista dal server) | — | gpt-6.1-sol, 4.7 s | gpt-6.1-sol, 10.0 s | 0 | gpt-6.1-sol: 7312/538; gpt-4o-mini: 1633/569 |
| c10-roma | gpt-6.1-sol, 2.0 s; gpt-6.1-sol, 35.0 s (lista dal server) | — | gpt-6.1-sol, 3.9 s | gpt-6.1-sol, 10.1 s | 0 | gpt-6.1-sol: 7563/573; gpt-4o-mini: 1494/478 |
| c10-roma-a | gpt-6.1-sol, 2.0 s; gpt-6.1-sol, 35.0 s (lista dal server) | — | gpt-6.1-sol, 3.0 s | gpt-6.1-sol, 10.9 s | 0 | gpt-6.1-sol: 7192/572; gpt-4o-mini: 1497/486 |
| c10-roma-b | gpt-6.1-sol, 2.0 s; gpt-6.1-sol, 35.0 s (lista dal server) | — | gpt-6.1-sol, 3.5 s | gpt-6.1-sol, 11.3 s | 0 | gpt-6.1-sol: 7448/628; gpt-4o-mini: 1554/551 |
| c10-napoli | gpt-6.1-sol, 1.9 s; gpt-6.1-sol, 38.5 s (lista dal server) | — | gpt-6.1-sol, 3.5 s | gpt-6.1-sol, 8.1 s | 0 | gpt-6.1-sol: 7283/516; gpt-4o-mini: 1352/425 |
| c10-troina | gpt-6.1-sol, 3.2 s; gpt-6.1-sol, 18.2 s (lista dal server) | — | gpt-6.1-sol, 3.6 s | gpt-6.1-sol, 7.5 s | 0 | gpt-6.1-sol: 4465/448; gpt-4o-mini: 1223/377 |
| c10b-trastevere | gpt-6.1-sol, 2.0 s; gpt-6.1-sol, 35.0 s (lista dal server) | gpt-6.1-sol, 9.0 s | gpt-6.1-sol, 3.6 s | gpt-6.1-sol, 8.6 s | 0 | gpt-6.1-sol: 8240/963; gpt-4o-mini: 1552/534 |
| c10b-troina-mezza | gpt-6.1-sol, 3.2 s; gpt-6.1-sol, 18.2 s (lista dal server) | — | gpt-6.1-sol, 4.1 s | gpt-6.1-sol, 3.1 s | 0 | gpt-6.1-sol: 3659/215; gpt-4o-mini: 925/191 |

## Costo per tour e per città-giorno

| Città | Primo tour (con la lista nuova) | Altri tour (lista dal server) | Città-giorno (lista + tour del giro) |
|---|---|---|---|
| Catania | — | $0,262 (c10-ivano) | $0,262 |
| Roma | — | $0,290 (c10-roma), $0,283 (c10-roma-a), $0,333 (c10-roma-b), $0,505 (c10b-trastevere) | $1,410 |
| Napoli | — | $0,247 (c10-napoli) | $0,247 |
| Troina | — | $0,297 (c10-troina), $0,223 (c10b-troina-mezza) | $0,520 |

Totale del giro: **$1,900** (listino del banco: token + Google, foto non caricate; le chiamate che il server fa per la lista sono contate allo stesso listino). Chiamate Google della lista servite dalla cache del proxy: 3.

## I controlli di sempre (c1–c13, invariati)

| Tour | c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8 | c10 | c11 | c12 | c13 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| c10-ivano | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |
| c10-roma | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |
| c10-roma-a | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| c10-roma-b | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |
| c10-napoli | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |
| c10-troina | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |
| c10b-trastevere | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |
| c10b-troina-mezza | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |

## I tour, col testo che vede l'utente

### c10-ivano — Domani un giorno da catanese

- 09:30 **Basilica Cattedrale di Sant'Agata** (mattina) ⚓ ancora: Ti prendi venti minuti dentro Basilica Cattedrale di Sant'Agata. Si comincia da qui.
- 09:51 **Palazzo dei Chierici** (mattina): Ti fermi davanti a Palazzo dei Chierici il tempo che serve. È a un minuto a piedi dalla tappa prima.
- 10:24 **Piazza Giuseppe Mazzini** (mattina): Piazza Giuseppe Mazzini, originariamente nota col nome di Piano di San Filippo, è una piazza monumentale del centro storico di Catania, la cui progettazione risale al XVIII secolo. Sono 3 minuti a piedi dalla tappa prima.
- 10:54 **Tempo libero** (mattina): Tempo libero (94 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **Trattoria Giglio Rosso** (pranzo): A 2 minuti a piedi ti siedi da Trattoria Giglio Rosso, trattoria con prezzi medi. Ci arrivi alle 12:30.
- 14:30 **Castello Ursino** (pomeriggio) ⚓ ancora: Il castello Ursino di Catania fu costruito dal re Federico II di Svevia nel XIII secolo.
- 15:35 **Fontana dell’Amenano** (pomeriggio): La fontana dell'Amenano è una fontana monumentale del 1867 ubicata sul lato sud di piazza del Duomo, a Catania, in Sicilia, Italia.
- 16:06 **Palazzo degli Elefanti** (pomeriggio): Passi da Palazzo degli Elefanti: guardati intorno prima di ripartire.
- 16:36 **Tempo libero** (pomeriggio): Tempo libero (81 min). Niente in agenda: cammina dove ti porta la strada.
- 18:00 **Sotto Palazzo** (aperitivo): L'aperitivo lo prendi da Sotto Palazzo. Il sole tramonta alle 18:23: sei qui 23 minuti prima.
- 18:48 **Porta Uzeda** (aperitivo): La porta Uzeda collega la piazza Duomo alla via Dusmet, nel cuore della Catania settecentesca.
- 20:00 **Scirocco** (cena) · lista: Chiudi la giornata a tavola da Scirocco. Ci arrivi alle 20.

### c10-roma — Domani una giornata a Roma

- 09:30 **Mercato di Testaccio** (mattina) · lista: Alle 9:30 sei a Mercato di Testaccio: è qui che ti porta la giornata. Si comincia da qui.
- 10:18 **Basilica di Santa Maria in Trastevere** (mattina) ⚓ ancora: Basilica di Santa Maria in Trastevere è sulla tua strada: entri, guardi, riparti. Sono 18 minuti a piedi dalla tappa prima.
- 10:38 **Tempo libero** (mattina): Tempo libero (99 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **Grano Trattoria** (pranzo): Pranzi da Grano Trattoria, trattoria con prezzi medi. Ci arrivi alle 12:30.
- 14:30 **Piazza d'Aracoeli** (pomeriggio): Piazza d'Aracoeli è una piazza di Roma, situata alle pendici del Campidoglio, nel rione Campitelli.
- 15:27 **Piramide di Caio Cestio** (pomeriggio) ⚓ ancora: La Piramide Cestia è un monumento funerario di età augustea situato a Roma, fra porta San Paolo e il cimitero acattolico.
- 16:29 **Cimitero Acattolico per gli Stranieri di Roma** (pomeriggio) ⚓ ancora: Cimitero Acattolico per gli Stranieri di Roma: rallenti qui, prima della prossima tappa.
- 16:59 **Tempo libero** (pomeriggio): Tempo libero (47 min). Niente in agenda: cammina dove ti porta la strada.
- 18:00 **Terrazza Belvedere Aventino** (aperitivo): L'Aventino è uno dei sette colli su cui venne fondata Roma, il più a sud. Il sole tramonta alle 18:29: sei qui 29 minuti prima.
- 18:30 **Tempo libero** (aperitivo): Tempo libero (76 min). Niente in agenda: cammina dove ti porta la strada.
- 20:00 **Flavio al Velavevodetto** (cena) · lista: Chiudi la giornata a tavola da Flavio al Velavevodetto. Ci arrivi alle 20.

### c10-roma-a — Domani una giornata a Roma (profilo A)

- 09:30 **Basilica di Santa Maria in Trastevere** (mattina) ⚓ ancora: Basilica di Santa Maria in Trastevere è sulla tua strada: entri, guardi, riparti. Si comincia da qui.
- 09:57 **Villa Farnesina** (mattina) · lista: La villa Farnesina è un edificio storico di Roma, oggi sede dell'Accademia Nazionale dei Lincei. È qui perché cerchi l'arte.
- 10:57 **Tempo libero** (mattina): Tempo libero (86 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **Osteria Dai Senatori** (pranzo): Pranzi da Osteria Dai Senatori, osteria con prezzi medi. Sono 7 minuti a piedi dalla tappa prima.
- 14:30 **Piazza del Campidoglio** (pomeriggio): Piazza del Campidoglio è una piazza monumentale posta sulla cima del colle Campidoglio a Roma. Ci arrivi alle 14:30.
- 15:03 **Belvedere Tarpeo** (pomeriggio): Ti fermi a Belvedere Tarpeo: qui si guarda, non si corre.
- 15:33 **Tempo libero** (pomeriggio): Tempo libero (134 min). Niente in agenda: cammina dove ti porta la strada.
- 18:00 **Bar San Calisto** (aperitivo) · lista: L'aperitivo lo prendi da Bar San Calisto, bar con prezzi bassi. Il sole tramonta alle 18:29: sei qui 29 minuti prima.
- 18:52 **Fontana dell'Acqua Paola (Fontanone)** (aperitivo): La fontana, o fontanone, dell'Acqua Paola, nota anche come fontanone del Gianicolo, è una fontana monumentale situata sul colle Gianicolo, a Roma. È qui perché cerchi la storia.
- 20:00 **Aromaticus Trastevere** (cena): Chiudi la giornata a tavola da Aromaticus Trastevere. Ci arrivi alle 20.

### c10-roma-b — Domani una giornata a Roma (profilo B)

- 09:30 **Mercato di Testaccio** (mattina) · lista: Alle 9:30 sei a Mercato di Testaccio: è qui che ti porta la giornata. Si comincia da qui.
- 10:18 **Basilica di Santa Maria in Trastevere** (mattina) ⚓ ancora: Basilica di Santa Maria in Trastevere è sulla tua strada: entri, guardi, riparti. Sono 18 minuti a piedi dalla tappa prima.
- 10:47 **Piazza Farnese** (mattina): Piazza Farnese è una piazza di Roma, sita nel rione Regola. Ci arrivi alle 10:47.
- 11:17 **Tempo libero** (mattina): Tempo libero (65 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **Grano Trattoria** (pranzo): Pranzi da Grano Trattoria, trattoria con prezzi medi.
- 14:30 **Belvedere Tarpeo** (pomeriggio): Ti fermi a Belvedere Tarpeo: qui si guarda, non si corre. È qui perché cerchi i panorami.
- 15:23 **Piramide di Caio Cestio** (pomeriggio) ⚓ ancora: La Piramide Cestia è un monumento funerario di età augustea situato a Roma, fra porta San Paolo e il cimitero acattolico.
- 16:25 **Cimitero Acattolico per gli Stranieri di Roma** (pomeriggio) ⚓ ancora: Cimitero Acattolico per gli Stranieri di Roma: rallenti qui, prima della prossima tappa.
- 16:55 **Tempo libero** (pomeriggio): Tempo libero (61 min). Niente in agenda: cammina dove ti porta la strada.
- 18:00 **Lonely Avenue - Premium Spirits Cocktail Bar in Rome** (aperitivo): L'aperitivo lo prendi da Lonely Avenue - Premium Spirits Cocktail Bar in Rome, bar con prezzi medi. Il sole tramonta alle 18:29: sei qui 29 minuti prima.
- 18:45 **Tempo libero** (aperitivo): Tempo libero (58 min). Niente in agenda: cammina dove ti porta la strada.
- 20:00 **La vita è’ n’osteria** (cena): La cena è da La vita è’ n’osteria, osteria con prezzi medi. Qui la giornata si chiude.

### c10-napoli — Domani una giornata a Napoli

- 09:30 **Piazza Garibaldi** (mattina): Piazza Garibaldi è una piazza di Napoli situata al limite dei quartieri Pendino, Mercato, San Lorenzo e Zona Industriale. Si comincia da qui.
- 10:12 **Duomo di Santa Maria Assunta** (mattina) ⚓ ancora: La Cattedrale Metropolitana di Santa Maria Assunta è il duomo di Napoli, in Campania, sede vescovile dell'arcidiocesi di Napoli. Sono 12 minuti a piedi dalla tappa prima.
- 10:32 **Tempo libero** (mattina): Tempo libero (113 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **Gino e Toto Sorbillo** (pranzo) · lista: Pranzi da Gino e Toto Sorbillo. Ci arrivi alle 12:30.
- 14:30 **Museo Cappella Sansevero** (pomeriggio) ⚓ ancora: La Cappella Sansevero è tra i più importanti musei di Napoli.
- 15:48 **punto panoramico sulla città** (pomeriggio): punto panoramico sulla città è il punto in cui la giornata rallenta.
- 16:18 **Tempo libero** (pomeriggio): Tempo libero (88 min). Niente in agenda: cammina dove ti porta la strada.
- 18:00 **Libreria Berisio** (aperitivo) · lista: L'aperitivo lo prendi da Libreria Berisio. Il sole tramonta alle 18:23: sei qui 23 minuti prima.
- 18:45 **Tempo libero** (aperitivo): Tempo libero (72 min). Niente in agenda: cammina dove ti porta la strada.
- 20:00 **Osteria da Carmela** (cena): La cena è da Osteria da Carmela, osteria con prezzi medi. Qui la giornata si chiude.

### c10-troina — Domani una giornata a Troina

- 09:30 **Piazza Giacomo Matteotti** (mattina): Attraversi Piazza Giacomo Matteotti piano, senza fretta. Si comincia da qui.
- 10:00 **Tempo libero** (mattina): Tempo libero (145 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **A'PESCHERIA ristorante pesce con pescheria vendita a dettaglio** (pranzo): Pranzi da A'PESCHERIA ristorante pesce con pescheria vendita a dettaglio, ristorante con prezzi alti. Sono 5 minuti a piedi dalla tappa prima.
- 14:30 **IGustosi** (pomeriggio): Alle 14:30 sei a IGustosi: è qui che ti porta la giornata.
- 15:00 **Tempo libero** (pomeriggio): Tempo libero (171 min). Niente in agenda: cammina dove ti porta la strada.
- 18:00 **Caffè del borgo** (aperitivo): L'aperitivo lo prendi da Caffè del borgo. Il sole tramonta alle 18:25: sei qui 25 minuti prima.
- 19:03 **Monte Muganà** (aperitivo): Monte Muganà è la prossima tappa del tuo giro. Ci arrivi alle 19:03.
- 20:00 **Black & White** (cena): Chiudi la giornata a tavola da Black & White. Ci arrivi alle 20.

### c10b-trastevere — Domani una giornata a Trastevere

- 09:30 **Basilica di Santa Maria in Trastevere** (mattina) ⚓ ancora: Basilica di Santa Maria in Trastevere è sulla tua strada: entri, guardi, riparti. Si comincia da qui.
- 09:57 **Villa Farnesina** (mattina) ⚓ ancora: La villa Farnesina è un edificio storico di Roma, oggi sede dell'Accademia Nazionale dei Lincei. Sono 7 minuti a piedi dalla tappa prima.
- 10:57 **Tempo libero** (mattina): Tempo libero (88 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **Osteria da Fortunata - Baullari** (pranzo): Pranzi da Osteria da Fortunata - Baullari, osteria con prezzi medi. Ci arrivi alle 12:30.
- 14:30 **Piazza Farnese** (pomeriggio): Piazza Farnese è una piazza di Roma, sita nel rione Regola. È a un minuto a piedi dalla tappa prima.
- 15:06 **Porta Settimiana** (pomeriggio): Passi sotto Porta Settimiana, poi ti giri e la guardi dall'altra parte.
- 15:41 **Orto Botanico di Roma** (pomeriggio) ⚓ ancora: L'Orto botanico di Roma è situato alle pendici del Gianicolo, nell'antico parco di villa Corsini, un tempo residenza di Cristina di Svezia.
- 16:11 **Tempo libero** (pomeriggio): Tempo libero (100 min). Niente in agenda: cammina dove ti porta la strada.
- 18:00 **Bar San Calisto** (aperitivo) · lista: L'aperitivo lo prendi da Bar San Calisto, bar con prezzi bassi. Il sole tramonta alle 18:29: sei qui 29 minuti prima.
- 18:58 **Belvedere Tarpeo** (aperitivo): Ti fermi a Belvedere Tarpeo: qui si guarda, non si corre.
- 20:00 **Ai Tre Scalini - Bottiglieria dal 1895** (cena) · lista: Chiudi la giornata a tavola da Ai Tre Scalini - Bottiglieria dal 1895. Ci arrivi alle 20.

### c10b-troina-mezza — Domani mezza giornata a Troina

- 09:30 **Piazza Giacomo Matteotti** (mattina): Attraversi Piazza Giacomo Matteotti piano, senza fretta. Si comincia da qui.
- 10:00 **Tempo libero** (mattina): Tempo libero (145 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **A'PESCHERIA ristorante pesce con pescheria vendita a dettaglio** (pranzo): Pranzi da A'PESCHERIA ristorante pesce con pescheria vendita a dettaglio, ristorante con prezzi alti. Sono 5 minuti a piedi dalla tappa prima.

## Roma, Napoli, Catania: prima e dopo

| Tour | Prima (C10b, 16/10: `gpt-4o-mini`, un quartiere) | Dopo (C10b2: `gpt-6.1-sol`, due quartieri) |
|---|---|---|
| c10-roma | 7 tappe, 280 min di tempo libero (Celio) | **8 tappe, 222 min** (Trastevere → Testaccio) |
| c10-roma-a | 7 tappe, 274 min | **8 tappe, 220 min** |
| c10-roma-b | 7 tappe, 280 min | **9 tappe, 184 min** |
| c10b-trastevere | 9 tappe, 189 min, 0 luoghi del quartiere (nessuna ancora) | **9 tappe, 188 min, 4 luoghi da visitare di Trastevere** |
| c10-napoli | 10 tappe, 152 min (Centro Storico) | **7 tappe, 273 min** (Decumani → Sanità): peggio |
| c10-ivano (Catania) | 12 tappe, 56 min, 5 essenziali di controllo | **10 tappe, 175 min, 2 essenziali**: peggio |

Obiettivo Roma (≥ 9 tappe e ≤ 150 min): **non raggiunto in nessuno dei 4 tour**. Più tappe e meno tempo libero di prima, non abbastanza. Napoli e Catania peggiorano, e la causa è la stessa: la lista di `gpt-6.1-sol` è più «da locale» e ha meno luoghi da visitare. A Catania mancano Teatro Bellini, Villa Bellini, Via Etnea e Fera 'o Luni, che `gpt-4o-mini` proponeva. A Napoli la mattina ai Decumani resta con 2 tappe e 113 minuti liberi.

**Il testo che vede l'utente, Roma neutra, dopo:** 09:30 Mercato di Testaccio · 10:18 Basilica di Santa Maria in Trastevere ⚓ · tempo libero 99 min · 12:30 Grano Trattoria · 14:30 Piazza d'Aracoeli · 15:27 Piramide di Caio Cestio ⚓ · 16:29 Cimitero Acattolico ⚓ · tempo libero 47 min · 18:00 Terrazza Belvedere Aventino · tempo libero 76 min · 20:00 Flavio al Velavevodetto. Prima (C10b): 09:30 Colosseo ⚓ · 10:16 San Giovanni in Laterano ⚓ · tempo libero 102 min · 12:30 Trattoria Vecchia Roma · 14:30 Piazza Vittorio · 15:12 Palazzo Massimo · tempo libero 91 min · 18:00 Belvedere Cederna · tempo libero 87 min · 20:00 Taverna Romana.

**Trastevere, dopo:** 09:30 Santa Maria in Trastevere ⚓ · 09:57 Villa Farnesina ⚓ · tempo libero 88 min · 12:30 Osteria da Fortunata · 14:30 Piazza Farnese · 15:06 Porta Settimiana · 15:41 Orto Botanico ⚓ · tempo libero 100 min · 18:00 Bar San Calisto · 18:58 Belvedere Tarpeo · 20:00 Ai Tre Scalini. Prima: 09:30 Campo de' Fiori · Piazza Farnese · tempo libero 106 min · … · Colosseo · … (nessun luogo di Trastevere).

## Costo e tempo col modello nuovo

**Per lista** (prima del giorno per città, poi la lista è dal server per tutti):

| | Catania | Roma | Napoli | Palermo | Lecce | Troina | Trastevere (lista del quartiere) |
|---|---|---|---|---|---|---|---|
| Tempo della chiamata AI | 42,8 s | 37,0 s | 40,3 s | 33,0 s | 45,2 s | 21,4 s | 9,0 s |
| Tempo totale (con la verifica) | 44,2 s | 38,3 s | 41,4 s | 35,5 s | 46,5 s | 22,3 s | — |
| Costo (token + Google, listino) | 0,56 $ | 0,53 $ | 0,59 $ | 0,56 $ | 0,56 $ | 0,17 $ | 0,26 $ |

**Per tour** (lista dal server; listino del banco con una foto per tappa; tempo dal via al tour pronto):

| Tour | Costo | Tempo | Token `gpt-6.1-sol` (in/out) | Token `gpt-4o-mini` (narratore) | Traduttore | Selettore |
|---|---|---|---|---|---|---|
| c10-ivano | 0,26 $ | 32,8 s | 7.312 / 538 | 1.633 / 569 | 4,7 s | 10,0 s |
| c10-roma | 0,29 $ | 33,1 s | 7.563 / 573 | 1.494 / 478 | 3,9 s | 10,1 s |
| c10-roma-a | 0,28 $ | 31,7 s | 7.192 / 572 | 1.497 / 486 | 3,0 s | 10,9 s |
| c10-roma-b | 0,33 $ | 32,2 s | 7.448 / 628 | 1.554 / 551 | 3,5 s | 11,3 s |
| c10-napoli | 0,25 $ | 43,4 s | 7.283 / 516 | 1.352 / 425 | 3,5 s | 8,1 s |
| c10-troina | 0,30 $ | 28,6 s | 4.465 / 448 | 1.223 / 377 | 3,6 s | 7,5 s |
| c10b-trastevere | 0,51 $ (con la lista del quartiere) | 39,2 s | 8.240 / 963 | 1.552 / 534 | 3,6 s | 8,6 s |
| c10b-troina-mezza | 0,22 $ | 22,5 s | 3.659 / 215 | 925 / 191 | 4,1 s | 3,1 s |

Il modello nuovo costa ≈ 0,02 $ di token per tour (≈ 7.500 token in ingresso a 2 $/M + 550 in uscita a 10 $/M). Il resto è Google e foto, come prima. Il selettore impiega 8–11 s (prima ~3–5 s); nessun ripiego in tutto il giro.

## Spesa

| Voce | Listino del banco | Reale (ricerche dalla cache del proxy a 0) |
|---|---|---|
| Prove del modello (2 chiamate dirette + 1 dal proxy) | ≈ 0,003 $ | ≈ 0,003 $ |
| Confronto 1 (tempo massimo 28 s, 5 liste ripiegate) | 3,094 $ | 0,469 $ |
| 5 tentativi interrotti di `gpt-6.1-sol` nel confronto 1 | non misurato | non misurato |
| Confronto 2 (6 liste `c10b-4` + scala a parole) | 2,961 $ | 2,226 $ |
| Giro (8 tour, con la lista di Trastevere) | 1,900 $ | ≈ 1,9 $ (non separato) |
| Giro di prova su Troina (modifica poi annullata) | 0,401 $ | ≈ 0,4 $ |
| **Totale del task** | **≈ 8,36 $** (tetto approvato 8,5 $) | **≈ 5,0 $** |

## Proposte (non scritte)

1. **Il prompt della lista con `gpt-6.1-sol` chiede troppi locali e pochi simboli.** Proposta: per città e metropoli fissare la quota, cioè almeno 6 luoghi da visitare su 15 e gli essenziali «famosi anche se sono famosi». Nel prompt c'è già, ma il modello nuovo lo pesa meno. Oppure tornare a `gpt-4o-mini` per la lista e tenere `gpt-6.1-sol` dove inventa meno: borghi e quartieri. Il confronto dice che è il modello nuovo a perdere i simboli.
2. **Roma piena:** cercare dal **centro del quartiere** anche nelle ricerche iniziali (oggi partono dal centro città e solo le mirate guardano il quartiere), e una ricerca «esperienze» per quartiere. Tocca il budget delle ricerche: da decidere.
3. **Troina:** quando i posti verificati di un borgo sono vie (zone C7) o chiusi la mattina, partire dal **pomeriggio**, o lasciare la scelta dell'ora al giro corto. Tocca ORARI e la finestra: da decidere.
4. **San Silvestro a Troina:** capire quale filtro lo toglie; il tracciato oggi non lo dice.
5. **Il tempo del primo tour del giorno:** con `gpt-6.1-sol` la lista chiede 35–45 s. Una lista preparata di notte per le città più cercate (proposta 2 di C10) toglierebbe l'attesa.

## Decisioni per Ivano

1. Tenere `gpt-6.1-sol` per la lista della città (meno invenzioni, meno simboli) o solo per borghi e quartieri (proposta 1).
2. Roma piena: proposta 2.
3. Troina: proposta 3.

## Cosa ho dato per vero senza verificarlo

1. **La chiave del server e quella locale** non sono necessariamente dello stesso account OpenAI. Il modello l'ho provato con tutte e due: chiamata diretta con la locale, chiamata dal proxy con la server. Il prezzo l'ho letto sul listino pubblico, non sulla fatturazione dell'account.
2. **I tentativi interrotti** di `gpt-6.1-sol` (5 da 28 s) non so se OpenAI li fattura: non sono nel conto.
3. **Il costo reale** conta a zero le ricerche che il proxy ha servito dalla sua cache (lo dice l'intestazione `X-Cache`). Non l'ho confrontato con la fatturazione di Google.
4. **Gli orari di Troina** (Chiesa Madre, Torre Capitania, Museo Capa chiusi giovedì mattina) sono quelli di Google, presi così come sono.
5. **Le liste di controllo** degli essenziali (asticella C10) le ho usate come metro per «conosce i simboli». Non dicono se i posti nuovi di `gpt-6.1-sol` siano migliori o peggiori per un abitante (Piramide Cestia, Santa Maria della Sanità, Castel Sant'Elmo).
6. **Un campione per tour e per lista:** i modelli e Google cambiano da una chiamata all'altra. Lo mostra la scala a parole di Catania con `gpt-4o-mini`: «città» nel primo confronto, «metropoli» nel secondo.
7. **Il passaggio fra i due quartieri dentro C5c:** lo garantisce il riparatore tappa per tappa, come sempre. La regola dei centri entro 3 km è mia e dichiarata.
8. **Il deploy del client:** esce col prossimo deploy di Vercel; `openai-proxy` v20 è già in produzione. **Deploy da verificare da Ivano.**

