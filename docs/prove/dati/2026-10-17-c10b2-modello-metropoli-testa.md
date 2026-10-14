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
