# C10b — ancore che restano, tre scale di luogo, simbolo sempre presente

Verifiche iniziali: cartella `~/unnivai-1b`, HEAD `8db9238`, suite verde (1986). Primo commit, da solo: il report PROFILO-DNA-DIAGNOSI (`cc39689`). Account di prova, credenziali solo da `.env.local`, mai stampate. Giro sul codice finale: 13 tour (gli 11 di C10 + «Domani una giornata a Trastevere» + «Domani mezza giornata a Troina»), ora simulata mercoledì 14/10 22:19 (tour per giovedì 15/10), ricerca nuova come in produzione.

## In breve

- **Ancore perse: trovate e corrette.** Erano due passaggi del riparatore. Nel giro finale **tutte le 26 ancore seminate in 10 tour sono rimaste nel giro** (Catania 3 su 3 in 4 tour; Roma 2 su 2 in 3 tour; Napoli, Palermo e Lecce tutte). Prima, nel giro C10: Teatro Massimo Bellini, Piazza Navona e Duomo di Napoli scelti e poi tolti.
- **Tre scale:** l'AI propone, il motore conferma col diametro della lista. Esito: Roma e Napoli **metropoli**; Catania, Palermo e Lecce **città**; Troina **borgo**. Tutte confermate dai dati.
- **Metropoli in un quartiere:**
  - Roma: Celio (neutro, profilo A, profilo B) e **Trastevere** quando la richiesta lo nomina.
  - Napoli: Centro Storico.
  - Nessuna tappa fuori dal cerchio del quartiere.
- **Simbolo nella lista in 5 città su 6, e nel tour in 5:**
  - Catania: Cattedrale di Sant'Agata. Roma: Colosseo. Napoli: Duomo. Palermo: Cattedrale. Lecce: Santa Croce.
  - Troina: il simbolo proposto («Cattedrale di Troina») non passa la verifica, perché Google la chiama «Chiesa Madre di Maria Santissima Assunta».
- **Borgo:**
  - Troina ha **1 posto verificato su 8**, quindi la giornata diventa mezza giornata, con la riga «Troina si gira in mezza giornata.».
  - **Nessun posto fuori comune** («Trattoria Da Nino» a 94,7 km scartata).
  - Il giro però è povero: 2 tappe e 145 minuti di tempo libero.
- **«Conosce la città» verde in 9 tour su 13, non negli 11 richiesti.** Rossi:
  - Lecce: 3 visite su 7 dalla lista, serve la metà;
  - Trastevere: l'AI ha messo nel quartiere solo trattorie e bar, nessun essenziale, quindi zero ancore;
  - i due giri di Troina: 1 solo posto verificato.
- **Peggiora la giornata piena nelle metropoli.**
  - Roma: 7 tappe e 274–280 minuti di tempo libero; in C10 erano 8–9 tappe e 124–185 minuti.
  - Napoli: 152 minuti; in C10 erano 123.
  - Causa: il cerchio di 1,5 km del quartiere toglie molti candidati, e il tetto di cammino (non allargato) fa il resto.
- **Controlli c1–c13:** tutti verdi tranne **c11 a Palermo**: 45 minuti senza riga prima del pranzo, al limite esatto della soglia.
- **Spesa del task: ≈ 7,0 $**, sotto i 7,5 $ approvati (prima 6 $, poi 7,5 $):
  - giro interrotto: 1,18 $ registrati, più ≈ 0,65 $ stimati per lista e tour di Roma, non registrati;
  - 6 sonde del prompt: ≈ 0,07 $;
  - giro finale: 5,126 $.
  - Dettaglio in «Spesa».

## 1. Le ancore perse: causa e correzione

**Causa.** Il riparatore (`momentSelection.repairMomentSelection`) tratta un'ancora come una qualunque scelta del modello: la tiene solo se nessuna alternativa del momento «costa meno». Il costo però contiene anche preferenze di forma, e le ancore uscivano in tre punti (dal grezzo del giro C10, `pool` e `nelGiro`):

1. **Secondo giro del riparatore, «fuori strada».** Al primo giro un'ancora entra. Al secondo, quando il motore conosce la tappa dopo, un'ancora che allunga la strada verso il pranzo di oltre 5 minuti rispetto all'alternativa perde. È il **Teatro Massimo Bellini** a Catania: seminato in mattina, scartato al secondo giro. Il registro mostra «pari: lo scelto viene prima» perché quel motivo viene dal posto precedente e non si aggiorna: era un'etichetta fuorviante, non la regola.
2. **Rifinitura (`polishRoute`).** Sostituisce una tappa con un'altra dello stesso momento se il cambio toglie una famiglia ripetuta, un incrocio o una deviazione, anche quando la tappa è un'ancora. **Piazza Navona** (Roma, profilo A) e il **Duomo di Napoli**: «scelto: sì, nel giro: no», cambiati per togliere una piazza ripetuta.
3. **Semina oltre i posti del momento** (`seminaAncore`). Tre ancore in una mattina da due tappe: la terza cadeva «oltre il numero di tappe».

**Correzione.**
- **Riparatore** (`isAncora`): un'ancora resta salvo **una regola dura**. Orari e pasti agiscono già prima: un posto chiuso o fuori dal suo momento non è nel bucket, e `settleOpeningHours` lo vieta se risulta chiuso all'arrivo. Qui resta il **tetto di cammino**. Strada, deviazione, varietà, «toglie l'alternativa a un momento dopo» non la tolgono più.
- **Rifinitura:** non cambia un'ancora, salvo per togliere un tratto oltre il tetto di cammino.
- **Semina:** mai più ancore delle tappe del momento.
- **Tracciato:** ogni ancora tolta va in `report.ancoreTolte` col motivo «regola dura: …», e l'esito di ogni ancora seminata in `_citta.ancoreEsito` (sotto, tabella «Scala, quartiere, simbolo, ancore»).

**Nel giro finale:** 26 ancore seminate in 10 tour, 26 nel giro, 0 tolte (Trastevere e i due giri di Troina non avevano ancore da seminare). Catania 3 su 3 in tutti e 4 i tour: in C10 il Teatro Massimo Bellini mancava nel tour neutro e Castello Ursino nel profilo A.

## 2. Tre scale (decisione di Ivano)

**Come si propone la scala.**
- La prima versione (`c10b-1`) chiedeva la scala a parole. Nel giro gpt-4o-mini ha risposto «città» per Catania **e per Roma**. In una sonda ha risposto «città» anche per Troina, scrivendo «10000 abitanti» accanto a una regola che diceva «meno di 30000 → borgo»: il numero lo sa, la regola non la applica.
- Ho fermato il giro e cambiato metodo (`c10b-2`).
- Una chiamata minuscola (≈ 0,0001 $) chiede all'AI **gli abitanti del comune**.
- Il codice applica la regola (`scalaDaAbitanti`): **meno di 30.000 → borgo; almeno 800.000 → metropoli; altrimenti città**.
- Poi parte il prompt della lista, **scritto per quella scala**: senza condizioni da valutare, coi quartieri solo per la metropoli.
- L'AI resta la fonte (il numero è suo). La regola però è nel codice: è una deviazione da «l'AI la propone» presa alla lettera, e la dichiaro.

**Come la conferma il motore** (`scalaConfermata`, `src/lib/cityKnowledge.js`):
- il **diametro** della lista è la distanza massima fra due essenziali verificati (con meno di due essenziali, fra tutti i verificati);
- **metropoli** solo se il diametro supera **2 km**, cioè 27 minuti a piedi, oltre il tetto di cammino di 20 minuti (1,5 km): le ancore non stanno in un giro a piedi;
- **borgo** solo se il diametro **non** supera 2 km;
- in ogni altro caso **città**.

| Città | Abitanti (AI) | Proposta | Diametro | Confermata | Verificati / proposti |
|---|---|---|---|---|---|
| Roma | 2.873.000 | metropoli | 3,78 km (essenziali) | **metropoli** | 17 / 17 |
| Napoli | ≈ 960.000 | metropoli | 2,67 km (essenziali) | **metropoli** | 19 / 19 |
| Palermo | ≈ 670.000 | città | 1,10 km (essenziali) | **città** | 14 / 15 |
| Catania | ≈ 311.000 | città | 0,75 km (essenziali) | **città** | 12 / 14 |
| Lecce | 95.000 | città | 0,47 km (essenziali) | **città** | 11 / 14 |
| Troina | 6.000 | borgo | — (1 verificato) | **borgo** | 1 / 8 |

**Borgo.**
- L'AI propone al massimo 8 nomi.
- La verifica cerca «nome, comune, provincia», con la sigla presa dall'indirizzo del centro: «…, Troina, EN».
- Accetta solo posti **entro 5 km dal centro del comune** (`RAGGIO_BORGO_KM`, lo stesso raggio di base del motore per un borgo) **e con l'indirizzo nel comune** (`nelComune`).
- Con meno di 4 verificati, la giornata intera diventa una mezza giornata (240 minuti) e il giorno porta la riga approvata «X si gira in mezza giornata.», a schermo in AiItinerary sotto il titolo del giorno.
- Troina: 7 scartati. Sei per nome diverso: Cattedrale ↔ Chiesa Madre, Castello ↔ Torre Capitania, F.lli Rizzo ↔ Antonino Rizzo, Mercato ↔ Mercato di sabato, Bar Centrale ↔ Bar Nazionale, Piazza Garibaldi ↔ Via Garibaldi. Uno fuori comune: Trattoria Da Nino a 94,7 km.

**Città:** come C10.

**Metropoli.**
- Fino a 20 posti, ognuno col suo quartiere indicato dall'AI; da 1 a 2 essenziali per quartiere; un simbolo per quartiere.
- In un giro di un giorno il motore sceglie il quartiere **nominato nella richiesta**; altrimenti quello con **più ancore aperte**, e a parità il più vicino alla partenza.
- Lista, ricerche e ricerche mirate stanno nel cerchio del quartiere: raggio uguale al tetto di cammino (1,5 km), fino a 2,5 km se gli essenziali del quartiere stanno più lontani.
- Un quartiere vicino entra solo per la parte che cade nel cerchio («due quartieri vicini»): il passaggio fra mattina e pomeriggio resta dentro il tetto di cammino C5c, che non è allargato.
- Le ancore sono solo gli essenziali del quartiere scelto.

| Tour | Quartiere | Perché | Ancore del quartiere nel tour |
|---|---|---|---|
| c10-roma, -a, -b | Celio | più ancore aperte (Colosseo, San Giovanni in Laterano) | Colosseo, San Giovanni in Laterano |
| c10b-trastevere | Trastevere | nominato nella richiesta | nessuna: nella lista Trastevere ha solo Trattoria Da Enzo, Bar San Calisto, Trattoria Da Teo (tutti «da locale») |
| c10-napoli | Centro Storico | più ancore aperte | Duomo di Santa Maria Assunta, Cappella Sansevero |

**Trastevere, da sapere.** Il centro del quartiere è la media dei suoi tre posti in lista e cade vicino al Tevere. Il cerchio da 1,5 km arriva fino a Campo de' Fiori e al Colosseo (1,40 km): il giro di «Trastevere» passa per Campo de' Fiori, l'Aventino e il Colosseo. Nessuna tappa sta fuori dal cerchio, ma la giornata non è «dentro Trastevere».

## 3. Il simbolo

Il prompt (regola generale, senza nomi di città) chiede fra gli essenziali **il posto che un abitante non ti perdonerebbe mai di aver saltato**: uno per lista, uno per quartiere in una metropoli. Il simbolo deve essere un luogo da visitare (monumento, chiesa, museo, castello, teatro), non una strada né una piazza. Questa seconda regola è nata dal giro interrotto: il simbolo di Catania era «Piazza del Duomo», che Google registra come via, e la regola delle zone C7 lo toglieva dal pool. Senza un simbolo segnato, il primo essenziale diventa simbolo «dedotto». Il simbolo è la prima ancora.

| Città | Simbolo nella lista | Nel tour |
|---|---|---|
| Catania | Basilica Cattedrale di Sant'Agata | sì, in tutti e 4 i tour |
| Roma | Colosseo [Celio]; e per gli altri quartieri Piazza Navona, Villa Borghese, Castel Sant'Angelo, Piazza di Spagna, Palazzo Massimo (dedotto), Piazza Venezia | Colosseo sì (Celio, anche in Trastevere); Trastevere non ha un simbolo |
| Napoli | Duomo di Santa Maria Assunta [Centro Storico]; Piazza del Plebiscito [Chiaia]; Cimitero delle Fontanelle [Materdei] (dedotto) | Duomo sì |
| Palermo | Cattedrale di Palermo | sì |
| Lecce | Basilica di Santa Croce | sì |
| Troina | proposto «Cattedrale di Troina», non verificato (Google: «Chiesa Madre di Maria Santissima Assunta») | no |

Le regole di forma non sono state rispettate sempre dall'AI: in Roma due simboli sono piazze (Navona, Venezia), e in Napoli due quartieri su sette hanno un simbolo segnato (il terzo è dedotto). Il giro non ne è toccato: le piazze di Roma stanno in quartieri non scelti.

## 4. Il runner del banco

Prima di ogni caso stima il costo: un tour 0,20 $, più 0,75 $ se è il primo tour della città nel giro (lista nuova). Valori in `banco.config.json → esteso.stimaCaso`. Il caso non parte se la stima supera il tetto restante. **Dopo** ogni caso confronta la spesa vera col tetto: se l'ha superato, i casi seguenti non partono e il grezzo lo dice (`oltreTetto`). Nel giro: le stime (0,95 $ / 0,20 $) sono state sempre sopra la spesa vera (0,46–0,81 $ / 0,12–0,19 $), e nessun caso è stato fermato.

## Deploy

- Migrazione `c10b_city_knowledge_scala` (colonna `scala` con il suo vincolo), **solo con `apply_migration`**.
- `openai-proxy`: **versione 17** col prompt `c10b-1`, poi **versione 18** col prompt `c10b-2`. Prima del primo deploy ho confrontato la versione 16 in produzione con il repo: uguali.
- `places-proxy`: non toccato (versione 11).
- Il client esce col prossimo deploy di Vercel.

## Test rosso → verde

Falliscono tutti sul commit di partenza `cc39689` (provati in un worktree) e passano ora.

**`src/__tests__/services/c10bAncore.test.js`** (3 test):
- la seconda ancora della mattina non cade «fuori strada» (il caso del Bellini);
- la rifinitura non cambia un'ancora per una famiglia ripetuta (il caso di Navona);
- il tetto di cammino la toglie, e il tracciato lo scrive.

**`src/__tests__/services/c10bScale.test.js`** (12 test):
- un nome generico trovato fuori comune non entra, anche dentro il raggio;
- oltre il raggio del comune non entra;
- query e raggio della verifica;
- abitanti → scala;
- la lista per scala, col quartiere;
- il simbolo, uno per lista e uno per quartiere;
- il prompt scritto per la scala, senza altri nomi di città;
- Roma e Napoli metropoli, Catania città, Troina borgo, con le coordinate vere del 15/10;
- il quartiere;
- il simbolo come prima ancora;
- **Roma in giornata intera sta in un quartiere**;
- **«Trastevere» nella richiesta → quartiere Trastevere**;
- **borgo con meno di 4 verificati → mezza giornata con la riga**.

**`asticellaC10.test.js`** (+3): la voce «conosce la città» per metropoli e borgo.

**Suite: 149 file, 2004 test verdi.** Lint: 0 errori. Build ok.

## Prima e dopo (il testo che vede l'utente)

**Catania, «Domani una giornata a Catania».**

Prima (C10, 16/10): 09:30 Castello Ursino ⚓ · 10:34 Piazza Umbrella · 11:05 Storico mercato del pesce · tempo libero 54 min · 12:30 Caffè del Duomo e Ristorante · 14:30 Fontana dell'Amenano · 15:01 Porta Uzeda · 15:33 Palazzo degli Elefanti · 16:15 Villa Bellini · 16:56 San Nicolò l'Arena · 18:00 Bar Popolare · 18:58 Porta Garibaldi · 20:00 Trattoria Giglio Rosso. Il **Teatro Massimo Bellini**, seminato, mancava.

Dopo: 09:30 **Teatro Massimo Bellini** ⚓ · 10:04 **Basilica Cattedrale di Sant'Agata** ⚓ · 10:26 Storico mercato del pesce · tempo libero 93 min · 12:30 Caffè del Duomo e Ristorante · 14:30 Palazzo degli Elefanti · 15:01 Piazza Università · 15:38 **Castello Ursino** ⚓ · 16:44 Odeon Romano · 18:00 Deliziosa Café & Cocktail Bar · 18:56 Villa Bellini · 20:00 Osteria del mar. **Tre ancore su tre**, Cattedrale compresa (il simbolo). Il tempo libero sale (54 → 93 minuti).

**Roma, «Domani una giornata a Roma».**

Prima (C10): 09:30 Castel Sant'Angelo · 10:43 Campo de' Fiori · tempo libero 71 min · 12:30 Bar del Fico · 14:30 Piazza Navona ⚓ · 15:13 Terrazza delle Quadrighe · 15:55 Colosseo ⚓ · tempo libero 76 min · 18:00 8 e 1/2 · 19:02 Villa Borghese · 20:00 Trattoria Della Stampa. Il giro attraversa la città: da Castel Sant'Angelo al Colosseo ci sono 3 km.

Dopo (Celio): 09:30 **Colosseo** ⚓ · 10:16 **San Giovanni in Laterano** ⚓ · tempo libero 102 min · 12:30 Trattoria Vecchia Roma · 14:30 Piazza Vittorio · 15:12 Palazzo Massimo · tempo libero 91 min · 18:00 Belvedere Cederna · tempo libero 87 min · 20:00 Taverna Romana. **Un quartiere camminabile, due ancore che restano**, ma **7 tappe e 280 minuti di tempo libero**: è il prezzo del cerchio da 1,5 km con il tetto di cammino invariato.

**Trastevere:** il tour completo è più sotto («I tour, col testo che vede l'utente»).

**Troina, «Domani una giornata a Troina».**
- Prima: giornata intera di 7 tappe, una sola dalla lista, 293 minuti di tempo libero.
- Dopo: mezza giornata con la riga «Troina si gira in mezza giornata.». Tappe: 09:30 Piazza Giacomo Matteotti · tempo libero 145 min · 12:30 A'Pescheria. Il giro è corto, ma non vero abbastanza: 2 tappe, nessuna dalla lista.

## Tour × voci dell'asticella

Soglie: conosce la città ≥ 3 essenziali della lista di controllo nel tour e ≥ 50% delle visite dalla lista verificata (metropoli: ≥ 2 ancore del quartiere scelto e la stessa quota; borgo: ≥ 2 posti della lista, anche in mezza giornata); giornata piena ≤ 45 min di tempo libero; costo primo tour della città nel giorno ≤ 0,60 $, gli altri ≤ 0,20 $; tempo ≤ 21.2 s + 5 s.

| Tour | Tappe | Conosce la città | Essenziali nel tour | Visite dalla lista | Giornata piena (tempo libero) | Lista | Costo | Tempo |
|---|---|---|---|---|---|---|---|---|
| c10-ivano | 12 | 🟢 | Cattedrale di Sant'Agata, Castello Ursino, Teatro Massimo Bellini, Villa Bellini, Fera 'o Luni | 6/8 | 🔴 56 min | **nuova** | 🔴 $0,758 | 🔴 43.3 s |
| c10-catania | 11 | 🟢 | Cattedrale di Sant'Agata, Pescheria, Castello Ursino, Teatro Massimo Bellini, Villa Bellini | 5/7 | 🔴 93 min | dal server | 🔴 $0,208 | 🔴 36.8 s |
| c10-catania-a | 12 | 🟢 | Cattedrale di Sant'Agata, Castello Ursino, Teatro Massimo Bellini, Villa Bellini | 4/8 | 🔴 60 min | dal server | 🔴 $0,250 | 🟢 25.2 s |
| c10-catania-b | 12 | 🟢 | Cattedrale di Sant'Agata, Castello Ursino, Teatro Massimo Bellini, Villa Bellini, Fera 'o Luni | 6/8 | 🔴 56 min | dal server | 🔴 $0,250 | 🔴 28.2 s |
| c10-roma | 7 | 🟢 | Celio: Colosseo, Basilica di San Giovanni in Laterano | 3/4 | 🔴 280 min | **nuova** | 🔴 $0,841 | 🔴 36.2 s |
| c10-roma-a | 7 | 🟢 | Celio: Colosseo, Basilica di San Giovanni in Laterano | 3/4 | 🔴 274 min | dal server | 🔴 $0,264 | 🟢 24.7 s |
| c10-roma-b | 7 | 🟢 | Celio: Colosseo, Basilica di San Giovanni in Laterano | 3/4 | 🔴 280 min | dal server | 🔴 $0,228 | 🟢 22.7 s |
| c10-napoli | 10 | 🟢 | Centro Storico: Museo Cappella Sansevero, Duomo di Santa Maria Assunta | 5/6 | 🔴 152 min | **nuova** | 🔴 $0,891 | 🔴 35.5 s |
| c10-palermo | 10 | 🟢 | Cattedrale di Palermo, Palazzo dei Normanni / Cappella Palatina, Teatro Massimo, Mercato di Ballarò | 5/6 | 🔴 91 min | **nuova** | 🔴 $0,744 | 🔴 37.7 s |
| c10-lecce | 10 | 🔴 | Basilica di Santa Croce, Teatro Romano, Castello di Carlo V | 3/7 | 🔴 243 min | **nuova** | 🔴 $0,757 | 🔴 42.3 s |
| c10-troina | 2 | 🔴 | — | 0 posti della lista | ⚪ — min | **nuova** | 🟢 $0,476 | 🔴 29.6 s |
| c10b-trastevere | 9 | 🔴 | Trastevere: nessuna ancora del quartiere | 2/5 | 🔴 189 min | dal server | 🔴 $0,218 | 🟢 25.1 s |
| c10b-troina-mezza | 2 | 🔴 | — | 0 posti della lista | ⚪ — min | dal server | 🟢 $0,179 | 🟢 22.8 s |

**Su misura** (profili A e B, stessa città: almeno metà delle tappe diverse)

| Città | Tappe A | Tappe B | In comune | Diverse | Esito | In comune |
|---|---|---|---|---|---|---|
| Catania | 12 | 12 | 7 | 42% | 🔴 | Basilica Cattedrale di Sant'Agata, Palazzo degli Elefanti, Piazza Università, Teatro Massimo Bellini, Fontana dell’Amenano, Castello Ursino, Giardino Bellini - Villa Bellini |
| Roma | 7 | 7 | 5 | 29% | 🔴 | Colosseo, Basilica di San Giovanni in Laterano, Trattoria Vecchia Roma, Piazza Vittorio Emanuele II di Savoia, Museo Nazionale Romano, Palazzo Massimo alle Terme |

**Invenzioni** (nomi proposti dall'AI che Google non verifica; indicatore, obiettivo sotto il 20%)

| Città | Proposti | Verificati | Scartati | Quota | Esito |
|---|---|---|---|---|---|
| Catania | 14 | 12 | 2 | 14% | 🟢 |
| Roma | 17 | 17 | 0 | 0% | 🟢 |
| Napoli | 19 | 19 | 0 | 0% | 🟢 |
| Palermo | 15 | 14 | 1 | 7% | 🟢 |
| Lecce | 14 | 11 | 3 | 21% | 🔴 |
| Troina | 8 | 1 | 7 | 88% | 🔴 |

## Scala, quartiere, simbolo, ancore (C10b)

| Tour | Scala (proposta → confermata, diametro) | Quartiere | Simbolo nella lista | Simbolo nel tour | Ancore seminate → esito |
|---|---|---|---|---|---|
| c10-ivano | città → **città** (0.75 km, essenziali) | — | Basilica Cattedrale di Sant'Agata | Basilica Cattedrale di Sant'Agata | Basilica Cattedrale di Sant'Agata: nel giro; Teatro Massimo Bellini: nel giro; Castello Ursino: nel giro |
| c10-catania | città → **città** (0.75 km, essenziali) | — | Basilica Cattedrale di Sant'Agata | Basilica Cattedrale di Sant'Agata | Basilica Cattedrale di Sant'Agata: nel giro; Teatro Massimo Bellini: nel giro; Castello Ursino: nel giro |
| c10-catania-a | città → **città** (0.75 km, essenziali) | — | Basilica Cattedrale di Sant'Agata | Basilica Cattedrale di Sant'Agata | Basilica Cattedrale di Sant'Agata: nel giro; Teatro Massimo Bellini: nel giro; Castello Ursino: nel giro |
| c10-catania-b | città → **città** (0.75 km, essenziali) | — | Basilica Cattedrale di Sant'Agata | Basilica Cattedrale di Sant'Agata | Basilica Cattedrale di Sant'Agata: nel giro; Teatro Massimo Bellini: nel giro; Castello Ursino: nel giro |
| c10-roma | metropoli → **metropoli** (3.78 km, essenziali) | Celio (il quartiere con piu' ancore aperte, il piu' vicino alla partenza a parita', 1.5 km) | Colosseo [Celio]; Piazza Navona [Navona]; Villa Borghese [Pinciano]; Castel Sant'Angelo [Borgo]; Piazza di Spagna [Spagna]; Museo Nazionale Romano, Palazzo Massimo alle Terme [Esquilino] (dedotto); Piazza Venezia [Venezia] | Colosseo, Museo Nazionale Romano, Palazzo Massimo alle Terme | Colosseo: nel giro; Basilica di San Giovanni in Laterano: nel giro |
| c10-roma-a | metropoli → **metropoli** (3.78 km, essenziali) | Celio (il quartiere con piu' ancore aperte, il piu' vicino alla partenza a parita', 1.5 km) | Colosseo [Celio]; Piazza Navona [Navona]; Villa Borghese [Pinciano]; Castel Sant'Angelo [Borgo]; Piazza di Spagna [Spagna]; Museo Nazionale Romano, Palazzo Massimo alle Terme [Esquilino] (dedotto); Piazza Venezia [Venezia] | Colosseo, Museo Nazionale Romano, Palazzo Massimo alle Terme | Colosseo: nel giro; Basilica di San Giovanni in Laterano: nel giro |
| c10-roma-b | metropoli → **metropoli** (3.78 km, essenziali) | Celio (il quartiere con piu' ancore aperte, il piu' vicino alla partenza a parita', 1.5 km) | Colosseo [Celio]; Piazza Navona [Navona]; Villa Borghese [Pinciano]; Castel Sant'Angelo [Borgo]; Piazza di Spagna [Spagna]; Museo Nazionale Romano, Palazzo Massimo alle Terme [Esquilino] (dedotto); Piazza Venezia [Venezia] | Colosseo, Museo Nazionale Romano, Palazzo Massimo alle Terme | Colosseo: nel giro; Basilica di San Giovanni in Laterano: nel giro |
| c10-napoli | metropoli → **metropoli** (2.67 km, essenziali) | Centro Storico (il quartiere con piu' ancore aperte, il piu' vicino alla partenza a parita', 1.5 km) | Duomo di Santa Maria Assunta [Centro Storico]; Piazza del Plebiscito [Chiaia]; Cimitero delle Fontanelle [Materdei] (dedotto) | Duomo di Santa Maria Assunta | Duomo di Santa Maria Assunta: nel giro; Museo Cappella Sansevero: nel giro |
| c10-palermo | città → **città** (1.1 km, essenziali) | — | Cattedrale di Palermo | Cattedrale di Palermo | Cattedrale di Palermo: nel giro; Palazzo dei Normanni: nel giro; Teatro Massimo di Palermo: nel giro |
| c10-lecce | città → **città** (0.47 km, essenziali) | — | Basilica di Santa Croce | Basilica di Santa Croce | Basilica di Santa Croce: nel giro; Castello Carlo V di Lecce: nel giro; Teatro Romano: nel giro |
| c10-troina | borgo → **borgo** (0 km, tutti i verificati) | — | — | — | — |
| c10b-trastevere | metropoli → **metropoli** (3.78 km, essenziali) | Trastevere (nominato nella richiesta, 1.5 km) | Colosseo [Celio]; Piazza Navona [Navona]; Villa Borghese [Pinciano]; Castel Sant'Angelo [Borgo]; Piazza di Spagna [Spagna]; Museo Nazionale Romano, Palazzo Massimo alle Terme [Esquilino] (dedotto); Piazza Venezia [Venezia] | Colosseo | — |
| c10b-troina-mezza | borgo → **borgo** (0 km, tutti i verificati) | — | — | — | — |

## Costo per tour e per città-giorno

| Città | Primo tour (con la lista nuova) | Altri tour (lista dal server) | Città-giorno (lista + tour del giro) |
|---|---|---|---|
| Catania | $0,758 (c10-ivano) | $0,208 (c10-catania), $0,250 (c10-catania-a), $0,250 (c10-catania-b) | $1,466 |
| Roma | $0,841 (c10-roma) | $0,264 (c10-roma-a), $0,228 (c10-roma-b), $0,218 (c10b-trastevere) | $1,551 |
| Napoli | $0,891 (c10-napoli) | — | $0,891 |
| Palermo | $0,744 (c10-palermo) | — | $0,744 |
| Lecce | $0,757 (c10-lecce) | — | $0,757 |
| Troina | $0,476 (c10-troina) | $0,179 (c10b-troina-mezza) | $0,655 |

Totale del giro: **$5,126** (listino del banco: token + Google, foto non caricate; le chiamate che il server fa per la lista sono contate allo stesso listino). Chiamate Google della lista servite dalla cache del proxy: 52.

## I controlli di sempre (c1–c13, invariati)

| Tour | c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8 | c10 | c11 | c12 | c13 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| c10-ivano | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |
| c10-catania | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |
| c10-catania-a | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| c10-catania-b | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |
| c10-roma | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |
| c10-roma-a | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| c10-roma-b | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |
| c10-napoli | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |
| c10-palermo | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🔴1 | 🟢 | 🟢 |
| c10-lecce | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |
| c10-troina | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |
| c10b-trastevere | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |
| c10b-troina-mezza | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 |

Violazioni:

- **c10-palermo** (c11) — 45 min senza tappa né riga prima di Trattoria da Pino (alle 12:30), dopo la voce che finiva alle 11:35

## I tour, col testo che vede l'utente

### c10-ivano — Domani un giorno da catanese

- 09:30 **Market Fera O’Luni** (mattina) · lista: Market Fera O’Luni è la prossima tappa del tuo giro. Si comincia da qui.
- 10:08 **Teatro Massimo Bellini** (mattina) ⚓ ancora: Il Teatro Massimo Vincenzo Bellini è il teatro dell'opera di Catania. Sono 8 minuti a piedi dalla tappa prima.
- 10:42 **Piazza Università** (mattina) · lista: Piazza dell'Università si trova a Catania, lungo la via Etnea, a meno di cento metri da piazza Duomo, ed è una delle piazze più scenografiche del centro storico catanese. Ci arrivi alle 10:42.
- 11:14 **Basilica Cattedrale di Sant'Agata** (mattina) ⚓ ancora: Ti prendi venti minuti dentro Basilica Cattedrale di Sant'Agata.
- 11:35 **Palazzo dei Chierici** (mattina): Ti fermi davanti a Palazzo dei Chierici il tempo che serve. È a un minuto a piedi dalla tappa prima.
- 12:30 **Caffè del Duomo e Ristorante** (pranzo) · lista: A un minuto a piedi ti siedi da Caffè del Duomo e Ristorante, ristorante con prezzi bassi.
- 14:30 **Palazzo degli Elefanti** (pomeriggio): Passi da Palazzo degli Elefanti: guardati intorno prima di ripartire.
- 15:12 **Giardino Bellini - Villa Bellini** (pomeriggio) · lista: Il Giardino Bellini è uno dei due giardini più antichi e uno dei quattro parchi principali di Catania.
- 15:59 **Castello Ursino** (pomeriggio) ⚓ ancora: Il castello Ursino di Catania fu costruito dal re Federico II di Svevia nel XIII secolo.
- 16:59 **Tempo libero** (pomeriggio): Tempo libero (56 min). Niente in agenda: cammina dove ti porta la strada.
- 18:00 **Bar Popolare** (aperitivo): L'aperitivo lo prendi da Bar Popolare, bar con prezzi bassi. Il sole tramonta alle 18:23: sei qui 23 minuti prima.
- 18:47 **Fontana dell’Amenano** (aperitivo): La fontana dell'Amenano è una fontana monumentale del 1867 ubicata sul lato sud di piazza del Duomo, a Catania, in Sicilia, Italia.
- 20:00 **Trattoria Sorano** (cena): La cena è da Trattoria Sorano, trattoria con prezzi medi. Qui la giornata si chiude.

### c10-catania — Domani una giornata a Catania

- 09:30 **Teatro Massimo Bellini** (mattina) ⚓ ancora: Il Teatro Massimo Vincenzo Bellini è il teatro dell'opera di Catania. Si comincia da qui.
- 10:04 **Basilica Cattedrale di Sant'Agata** (mattina) ⚓ ancora: Ti prendi venti minuti dentro Basilica Cattedrale di Sant'Agata. Sono 4 minuti a piedi dalla tappa prima.
- 10:26 **Storico mercato del pesce di Catania** (mattina) · lista: Alle 10:26 sei a Storico mercato del pesce di Catania: è qui che ti porta la giornata.
- 10:56 **Tempo libero** (mattina): Tempo libero (93 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **Caffè del Duomo e Ristorante** (pranzo) · lista: A un minuto a piedi ti siedi da Caffè del Duomo e Ristorante, ristorante con prezzi bassi. Ci arrivi alle 12:30.
- 14:30 **Palazzo degli Elefanti** (pomeriggio): Ti fermi davanti a Palazzo degli Elefanti il tempo che serve. È a un minuto a piedi dalla tappa prima.
- 15:01 **Piazza Università** (pomeriggio) · lista: Piazza dell'Università si trova a Catania, lungo la via Etnea, a meno di cento metri da piazza Duomo, ed è una delle piazze più scenografiche del centro storico catanese.
- 15:38 **Castello Ursino** (pomeriggio) ⚓ ancora: Il castello Ursino di Catania fu costruito dal re Federico II di Svevia nel XIII secolo.
- 16:44 **Odeon Romano** (pomeriggio): Passi da Odeon Romano: guardati intorno prima di ripartire.
- 18:00 **Deliziosa Café & Cocktail Bar** (aperitivo): L'aperitivo lo prendi da Deliziosa Café & Cocktail Bar, bar con prezzi medi. Il sole tramonta alle 18:23: sei qui 23 minuti prima.
- 18:56 **Giardino Bellini - Villa Bellini** (aperitivo) · lista: Il Giardino Bellini è uno dei due giardini più antichi e uno dei quattro parchi principali di Catania.
- 20:00 **Osteria del mar** (cena): La cena è da Osteria del mar, osteria con prezzi medi. Qui la giornata si chiude.

### c10-catania-a — Domani una giornata a Catania (profilo A)

- 09:30 **Basilica Cattedrale di Sant'Agata** (mattina) ⚓ ancora: Ti prendi venti minuti dentro Basilica Cattedrale di Sant'Agata. Si comincia da qui.
- 09:51 **Palazzo degli Elefanti** (mattina): Ti fermi davanti a Palazzo degli Elefanti il tempo che serve. È a un minuto a piedi dalla tappa prima.
- 10:22 **Piazza Università** (mattina) · lista: Piazza dell'Università si trova a Catania, lungo la via Etnea, a meno di cento metri da piazza Duomo, ed è una delle piazze più scenografiche del centro storico catanese. Ci arrivi alle 10:22.
- 10:56 **Teatro Massimo Bellini** (mattina) ⚓ ancora: Il Teatro Massimo Vincenzo Bellini è il teatro dell'opera di Catania. È qui perché cerchi la storia.
- 11:26 **Tempo libero** (mattina): Tempo libero (60 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **La Cucina Dei Colori** (pranzo): Pranzi da La Cucina Dei Colori. Sono 4 minuti a piedi dalla tappa prima.
- 14:30 **Anfiteatro Romano di Catania** (pomeriggio): Passi da Anfiteatro Romano di Catania: guardati intorno prima di ripartire.
- 15:08 **Fontana dell’Amenano** (pomeriggio): La fontana dell'Amenano è una fontana monumentale del 1867 ubicata sul lato sud di piazza del Duomo, a Catania, in Sicilia, Italia.
- 15:39 **Porta Uzeda** (pomeriggio): La porta Uzeda collega la piazza Duomo alla via Dusmet, nel cuore della Catania settecentesca.
- 16:14 **Castello Ursino** (pomeriggio) ⚓ ancora: Il castello Ursino di Catania fu costruito dal re Federico II di Svevia nel XIII secolo. È qui perché cerchi l'arte.
- 18:00 **Deliziosa Café & Cocktail Bar** (aperitivo): L'aperitivo lo prendi da Deliziosa Café & Cocktail Bar, bar con prezzi medi. Il sole tramonta alle 18:23: sei qui 23 minuti prima.
- 18:56 **Giardino Bellini - Villa Bellini** (aperitivo) · lista: Il Giardino Bellini è uno dei due giardini più antichi e uno dei quattro parchi principali di Catania.
- 20:00 **Cucina Casalinga "da Mimmo"** (cena): Chiudi la giornata a tavola da Cucina Casalinga "da Mimmo". Ci arrivi alle 20.

### c10-catania-b — Domani una giornata a Catania (profilo B)

- 09:30 **Market Fera O’Luni** (mattina) · lista: Market Fera O’Luni è la prossima tappa del tuo giro. Si comincia da qui.
- 10:08 **Teatro Massimo Bellini** (mattina) ⚓ ancora: Il Teatro Massimo Vincenzo Bellini è il teatro dell'opera di Catania. Sono 8 minuti a piedi dalla tappa prima.
- 10:42 **Basilica Cattedrale di Sant'Agata** (mattina) ⚓ ancora: Ti prendi venti minuti dentro Basilica Cattedrale di Sant'Agata. Ci arrivi alle 10:42.
- 11:03 **Palazzo dei Chierici** (mattina): Ti fermi davanti a Palazzo dei Chierici il tempo che serve. È a un minuto a piedi dalla tappa prima.
- 11:33 **Tempo libero** (mattina): Tempo libero (56 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **Caffè del Duomo e Ristorante** (pranzo) · lista: A un minuto a piedi ti siedi da Caffè del Duomo e Ristorante, ristorante con prezzi bassi.
- 14:30 **Palazzo degli Elefanti** (pomeriggio): Passi da Palazzo degli Elefanti: guardati intorno prima di ripartire.
- 15:01 **Piazza Università** (pomeriggio) · lista: Piazza dell'Università si trova a Catania, lungo la via Etnea, a meno di cento metri da piazza Duomo, ed è una delle piazze più scenografiche del centro storico catanese.
- 15:42 **Giardino Bellini - Villa Bellini** (pomeriggio) · lista: Il Giardino Bellini è uno dei due giardini più antichi e uno dei quattro parchi principali di Catania.
- 16:29 **Castello Ursino** (pomeriggio) ⚓ ancora: Il castello Ursino di Catania fu costruito dal re Federico II di Svevia nel XIII secolo.
- 18:00 **Bar Popolare** (aperitivo): L'aperitivo lo prendi da Bar Popolare, bar con prezzi bassi. Il sole tramonta alle 18:23: sei qui 23 minuti prima.
- 18:47 **Fontana dell’Amenano** (aperitivo): La fontana dell'Amenano è una fontana monumentale del 1867 ubicata sul lato sud di piazza del Duomo, a Catania, in Sicilia, Italia.
- 20:00 **Trattoria Sorano** (cena): La cena è da Trattoria Sorano, trattoria con prezzi medi. Qui la giornata si chiude.

### c10-roma — Domani una giornata a Roma

- 09:30 **Colosseo** (mattina) ⚓ ancora: Il Colosseo, originariamente conosciuto come Anfiteatro Flavio o semplicemente Amphitheatrum, era il più grande anfiteatro romano del mondo, situato nel centro della città di Roma. Si comincia da qui.
- 10:16 **Basilica di San Giovanni in Laterano** (mattina) ⚓ ancora: La Basilica di San Giovanni in Laterano è la cattedrale di Roma, nel Rione Monti, e in quanto tale ha il ruolo di chiesa madre della diocesi di Roma. Sono 16 minuti a piedi dalla tappa prima.
- 10:36 **Tempo libero** (mattina): Tempo libero (102 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **Trattoria Vecchia Roma** (pranzo): A 12 minuti a piedi ti siedi da Trattoria Vecchia Roma, trattoria con prezzi medi. Ci arrivi alle 12:30.
- 14:30 **Piazza Vittorio Emanuele II di Savoia** (pomeriggio): Piazza Vittorio Emanuele II, comunemente nota come piazza Vittorio, è una piazza di Roma, sita nel Rione Esquilino.
- 15:12 **Museo Nazionale Romano, Palazzo Massimo alle Terme** (pomeriggio) · lista: Museo Nazionale Romano, Palazzo Massimo alle Terme è la tappa da fare con calma.
- 16:12 **Tempo libero** (pomeriggio): Tempo libero (91 min). Niente in agenda: cammina dove ti porta la strada.
- 18:00 **Belvedere Cederna** (aperitivo): Ti fermi a Belvedere Cederna: qui si guarda, non si corre. Il sole tramonta alle 18:29: sei qui 29 minuti prima.
- 18:30 **Tempo libero** (aperitivo): Tempo libero (87 min). Niente in agenda: cammina dove ti porta la strada.
- 20:00 **Taverna Romana** (cena): La cena è da Taverna Romana, taverna con prezzi medi. Qui la giornata si chiude.

### c10-roma-a — Domani una giornata a Roma (profilo A)

- 09:30 **Colosseo** (mattina) ⚓ ancora: Il Colosseo, originariamente conosciuto come Anfiteatro Flavio o semplicemente Amphitheatrum, era il più grande anfiteatro romano del mondo, situato nel centro della città di Roma. Si comincia da qui.
- 10:16 **Basilica di San Giovanni in Laterano** (mattina) ⚓ ancora: La Basilica di San Giovanni in Laterano è la cattedrale di Roma, nel Rione Monti, e in quanto tale ha il ruolo di chiesa madre della diocesi di Roma. È qui perché cerchi la storia.
- 10:36 **Tempo libero** (mattina): Tempo libero (102 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **Trattoria Vecchia Roma** (pranzo): A 12 minuti a piedi ti siedi da Trattoria Vecchia Roma, trattoria con prezzi medi. Ci arrivi alle 12:30.
- 14:30 **Piazza Vittorio Emanuele II di Savoia** (pomeriggio): Piazza Vittorio Emanuele II, comunemente nota come piazza Vittorio, è una piazza di Roma, sita nel Rione Esquilino. Sono 3 minuti a piedi dalla tappa prima.
- 15:12 **Museo Nazionale Romano, Palazzo Massimo alle Terme** (pomeriggio) · lista: Museo Nazionale Romano, Palazzo Massimo alle Terme è la tappa da fare con calma. È qui perché cerchi l'arte.
- 16:12 **Tempo libero** (pomeriggio): Tempo libero (88 min). Niente in agenda: cammina dove ti porta la strada.
- 18:00 **Terrazza delle Quadrighe** (aperitivo): Terrazza delle Quadrighe è il punto in cui la giornata rallenta. Il sole tramonta alle 18:29: sei qui 29 minuti prima.
- 18:30 **Tempo libero** (aperitivo): Tempo libero (84 min). Niente in agenda: cammina dove ti porta la strada.
- 20:00 **OSTERIA DA SAMU** (cena): Chiudi la giornata a tavola da OSTERIA DA SAMU, osteria con prezzi medi. Ci arrivi alle 20.

### c10-roma-b — Domani una giornata a Roma (profilo B)

- 09:30 **Colosseo** (mattina) ⚓ ancora: Il Colosseo, originariamente conosciuto come Anfiteatro Flavio o semplicemente Amphitheatrum, era il più grande anfiteatro romano del mondo, situato nel centro della città di Roma. Si comincia da qui.
- 10:16 **Basilica di San Giovanni in Laterano** (mattina) ⚓ ancora: La Basilica di San Giovanni in Laterano è la cattedrale di Roma, nel Rione Monti, e in quanto tale ha il ruolo di chiesa madre della diocesi di Roma. Sono 16 minuti a piedi dalla tappa prima.
- 10:36 **Tempo libero** (mattina): Tempo libero (102 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **Trattoria Vecchia Roma** (pranzo): A 12 minuti a piedi ti siedi da Trattoria Vecchia Roma, trattoria con prezzi medi. Ci arrivi alle 12:30.
- 14:30 **Piazza Vittorio Emanuele II di Savoia** (pomeriggio): Piazza Vittorio Emanuele II, comunemente nota come piazza Vittorio, è una piazza di Roma, sita nel Rione Esquilino.
- 15:12 **Museo Nazionale Romano, Palazzo Massimo alle Terme** (pomeriggio) · lista: Museo Nazionale Romano, Palazzo Massimo alle Terme è la tappa da fare con calma.
- 16:12 **Tempo libero** (pomeriggio): Tempo libero (91 min). Niente in agenda: cammina dove ti porta la strada.
- 18:00 **Belvedere Cederna** (aperitivo): Ti fermi a Belvedere Cederna: qui si guarda, non si corre. Il sole tramonta alle 18:29: sei qui 29 minuti prima.
- 18:30 **Tempo libero** (aperitivo): Tempo libero (87 min). Niente in agenda: cammina dove ti porta la strada.
- 20:00 **Taverna Romana** (cena): La cena è da Taverna Romana, taverna con prezzi medi. Qui la giornata si chiude.

### c10-napoli — Domani una giornata a Napoli

- 09:30 **Museo Cappella Sansevero** (mattina) ⚓ ancora: La Cappella Sansevero è tra i più importanti musei di Napoli. Si comincia da qui.
- 10:37 **Duomo di Santa Maria Assunta** (mattina) ⚓ ancora: Ti prendi venti minuti dentro Duomo di Santa Maria Assunta. Sono 7 minuti a piedi dalla tappa prima.
- 11:07 **Mercato Porta Nolana** (mattina) · lista: Mercato Porta Nolana è la prossima tappa del tuo giro. Ci arrivi alle 11:07.
- 11:37 **Tempo libero** (mattina): Tempo libero (52 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **Trattoria da Giovanni** (pranzo): A un minuto a piedi ti siedi da Trattoria da Giovanni, trattoria con prezzi medi.
- 14:30 **Piazza del Gesù Nuovo** (pomeriggio): Piazza del Gesù Nuovo è una delle piazze più importanti del centro storico di Napoli.
- 15:05 **Mercato Pignasecca** (pomeriggio) · lista: Alle 15:05 sei a Mercato Pignasecca: è qui che ti porta la giornata.
- 15:48 **Teatro di San Carlo** (pomeriggio) · lista: Il Real Teatro di San Carlo, anche noto come Teatro San Carlo o semplicemente San Carlo, è il teatro lirico di Napoli, fra i più importanti e prestigiosi al mondo.
- 16:18 **Tempo libero** (pomeriggio): Tempo libero (100 min). Niente in agenda: cammina dove ti porta la strada.
- 18:00 **Gran Caffè Gambrinus** (aperitivo) · lista: L'aperitivo lo prendi da Gran Caffè Gambrinus. Il sole tramonta alle 18:23: sei qui 23 minuti prima.
- 19:00 **punto panoramico sulla città** (aperitivo): punto panoramico sulla città è il punto in cui la giornata rallenta. Ci arrivi alle 19.
- 20:00 **Pizzeria Starita** (cena) · lista: La cena è da Pizzeria Starita, pizzeria con prezzi medi. Qui la giornata si chiude.

### c10-palermo — Domani una giornata a Palermo

- 09:30 **Palazzo dei Normanni** (mattina) ⚓ ancora: Il Palazzo dei Normanni, noto anche come Palazzo Reale, si trova a Palermo ed è attualmente sede dell'Assemblea regionale siciliana. Si comincia da qui.
- 10:36 **Cattedrale di Palermo** (mattina) ⚓ ancora: Cattedrale di Palermo è sulla tua strada: entri, guardi, riparti. Sono 6 minuti a piedi dalla tappa prima.
- 11:05 **Teatro Massimo di Palermo** (mattina) ⚓ ancora: Ti fermi davanti a Teatro Massimo di Palermo il tempo che serve. Ci arrivi alle 11:05.
- 12:30 **Trattoria da Pino** (pranzo) · lista: Pranzi da Trattoria da Pino, trattoria con prezzi medi.
- 14:30 **Parco Piersanti Mattarella (Giardino Inglese)** (pomeriggio) · lista: Ti prendi una pausa a Parco Piersanti Mattarella (Giardino Inglese).
- 15:22 **Mercato del Capo** (pomeriggio) · lista: Mercato del Capo è la prossima tappa del tuo giro.
- 16:04 **Piazza Ballaro** (pomeriggio): Alle 16:04 sei a Piazza Ballaro: è qui che ti porta la giornata.
- 16:24 **Tempo libero** (pomeriggio): Tempo libero (91 min). Niente in agenda: cammina dove ti porta la strada.
- 18:00 **BAR MAROCCO** (aperitivo) · lista: L'aperitivo lo prendi da BAR MAROCCO, bar con prezzi bassi. Il sole tramonta alle 18:29: sei qui 29 minuti prima.
- 18:55 **Mercato Ballarò** (aperitivo) · lista: Passi da Mercato Ballarò: guardati intorno prima di ripartire.
- 20:00 **Trattoria Trapani** (cena): La cena è da Trattoria Trapani, trattoria con prezzi medi. Qui la giornata si chiude.

### c10-lecce — Domani una giornata a Lecce

- 09:30 **Basilica di Santa Croce** (mattina) ⚓ ancora: Ti prendi venti minuti dentro Basilica di Santa Croce. Si comincia da qui.
- 09:52 **Piazza Sant'Oronzo** (mattina): Piazza Sant'Oronzo è la principale piazza del centro storico di Lecce, intitolata a sant'Oronzo primo vescovo della città. Sono 2 minuti a piedi dalla tappa prima.
- 10:22 **Colonna di Sant'Oronzo** (mattina): La colonna di Sant'Oronzo, alta circa 29 metri, è situata in piazza Sant'Oronzo a Lecce. Ci arrivi alle 10:22.
- 10:52 **Tempo libero** (mattina): Tempo libero (96 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **Dall'antiquario** (pranzo): Pranzi da Dall'antiquario.
- 14:30 **Teatro Romano** (pomeriggio) ⚓ ancora: Il teatro greco-romano di Lecce è un monumento di epoca romana situato nel centro storico della città.
- 15:02 **ArtWork Cooperativa Sociale** (pomeriggio): Ti fermi davanti a ArtWork Cooperativa Sociale il tempo che serve.
- 15:33 **Campanile del Duomo** (pomeriggio): Passi da Campanile del Duomo: guardati intorno prima di ripartire. È a un minuto a piedi dalla tappa prima.
- 16:09 **Castello Carlo V di Lecce** (pomeriggio) ⚓ ancora: Alle 16:09 sei a Castello Carlo V di Lecce: è qui che ti porta la giornata.
- 16:39 **Tempo libero** (pomeriggio): Tempo libero (79 min). Niente in agenda: cammina dove ti porta la strada.
- 18:00 **Caffè Alvino** (aperitivo) · lista: L'aperitivo lo prendi da Caffè Alvino. Il sole tramonta alle 18:08: sei qui 8 minuti prima.
- 18:45 **Tempo libero** (aperitivo): Tempo libero (68 min). Niente in agenda: cammina dove ti porta la strada.
- 20:00 **Le Zie Trattoria Casereccia** (cena) · lista: La cena è da Le Zie Trattoria Casereccia, trattoria con prezzi medi. Qui la giornata si chiude.

### c10-troina — Domani una giornata a Troina

- 09:30 **Piazza Giacomo Matteotti** (mattina): Attraversi Piazza Giacomo Matteotti piano, senza fretta. Si comincia da qui.
- 10:00 **Tempo libero** (mattina): Tempo libero (145 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **A'PESCHERIA ristorante pesce con pescheria vendita a dettaglio** (pranzo): Pranzi da A'PESCHERIA ristorante pesce con pescheria vendita a dettaglio, ristorante con prezzi alti. Sono 5 minuti a piedi dalla tappa prima.

### c10b-trastevere — Domani una giornata a Trastevere

- 09:30 **Campo de' Fiori** (mattina) · lista: Ti fermi davanti a Campo de' Fiori il tempo che serve. Si comincia da qui.
- 10:01 **Piazza Farnese** (mattina): Piazza Farnese è una piazza di Roma, sita nel rione Regola. È a un minuto a piedi dalla tappa prima.
- 10:31 **Tempo libero** (mattina): Tempo libero (106 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **Trattoria Da Enzo** (pranzo) · lista: A 13 minuti a piedi ti siedi da Trattoria Da Enzo, trattoria con prezzi medi. Ci arrivi alle 12:30.
- 14:30 **Giardino degli Aranci** (pomeriggio): Il giardino degli Aranci, o parco Savello, è un parco di Roma di circa 7.800 m², posto sul colle Aventino, nel rione Ripa, da cui si gode un'ottima visuale della città. Sono 5 minuti a piedi dalla tappa prima.
- 15:15 **Colosseo** (pomeriggio) · lista: Il Colosseo, originariamente conosciuto come Anfiteatro Flavio o semplicemente Amphitheatrum, era il più grande anfiteatro romano del mondo, situato nel centro della città di Roma.
- 15:57 **Terrazza delle Quadrighe** (pomeriggio): Terrazza delle Quadrighe è il punto in cui la giornata rallenta.
- 16:27 **Tempo libero** (pomeriggio): Tempo libero (83 min). Niente in agenda: cammina dove ti porta la strada.
- 18:00 **Sant'Eustachio Caffè** (aperitivo) · lista: L'aperitivo lo prendi da Sant'Eustachio Caffè. Il sole tramonta alle 18:29: sei qui 29 minuti prima.
- 19:03 **Passeggiata del Gianicolo** (aperitivo): Passi da Passeggiata del Gianicolo: guardati intorno prima di ripartire.
- 20:00 **Da Tonino - Trattoria Bassetti** (cena): La cena è da Tonino - Trattoria Bassetti, trattoria con prezzi medi. Qui la giornata si chiude.

### c10b-troina-mezza — Domani mezza giornata a Troina

- 09:30 **Piazza Giacomo Matteotti** (mattina): Attraversi Piazza Giacomo Matteotti piano, senza fretta. Si comincia da qui.
- 10:00 **Tempo libero** (mattina): Tempo libero (145 min). Niente in agenda: cammina dove ti porta la strada.
- 12:30 **A'PESCHERIA ristorante pesce con pescheria vendita a dettaglio** (pranzo): Pranzi da A'PESCHERIA ristorante pesce con pescheria vendita a dettaglio, ristorante con prezzi alti. Sono 5 minuti a piedi dalla tappa prima.

## Spesa

| Voce | Al listino |
|---|---|
| Primo giro (prompt `c10b-1`), fermato a Roma: 4 tour di Catania con la lista nuova (grezzo `…-c10-2.json`) | 1,179 $ |
| Lista di Roma (`c10b-1`, 15 nomi verificati) e tour di Roma interrotto: non registrati dal runner (fermato a metà caso), stimati | ≈ 0,65 $ |
| 6 sonde del prompt (solo AI, nessuna verifica Google) | ≈ 0,07 $ |
| Giro finale (prompt `c10b-2`): 6 liste + 13 tour (grezzo `…-c10-3.json`) | 5,126 $ |
| **Totale del task** | **≈ 7,03 $** (tetto approvato 7,5 $) |

Il tetto iniziale era 4,5 $, con lo stop a 4 $. Prima del giro ho chiesto e ottenuto 6 $: la stima del giro completo era 5,4–5,6 $. Dopo il giro fermato ho chiesto e ottenuto 7,5 $. Il giro fermato è spesa persa: l'ho fermato appena la lista di Roma è uscita «città», perché i casi di Roma non avrebbero provato niente. Il costo è al listino del banco (token + Google, foto escluse). 52 chiamate Google della lista sono state servite dalla cache del proxy e contate come pagate.

## Perché le voci rosse restano rosse

- **Trastevere, conosce la città.** Il motore sceglie il quartiere giusto, ma nella lista Trastevere ha solo tre locali. Il prompt chiede «almeno un essenziale per quartiere», e l'AI non l'ha fatto per Trastevere. Senza essenziali non ci sono ancore da tenere.
- **Troina, conosce la città.** 1 verificato su 8. La verifica è quella di C10 (nomi compatibili) più il comune. I nomi che l'AI dà a un borgo sono generici o diversi da quelli di Google: è la proposta 6 del report C10, non toccata qui.
- **Lecce, conosce la città.** 3 essenziali nel tour (Santa Croce, Teatro Romano, Carlo V), ma 3 visite su 7 dalla lista (43%). Le altre sono posti delle ricerche: Piazza Sant'Oronzo, le chiese del barocco.
- **Giornata piena (tutti).** Il tempo libero resta. Nelle metropoli cresce, perché il quartiere riduce il pool e il tetto di cammino resta quello di sempre.
- **c11 a Palermo.** 45 minuti senza riga prima del pranzo: la soglia è «oltre 45», e qui il vuoto è esattamente 45. Il controllo non l'ho cambiato.

## Proposte (non scritte)

1. **Il quartiere di una metropoli deve avere almeno un essenziale verificato per essere scelto.** Se il quartiere nominato ne è senza (Trastevere), una seconda chiamata, solo per quel quartiere, chiede 3 essenziali. Costa ≈ 0,1 $ di verifica.
2. **Il centro del quartiere dai suoi essenziali, non dalla media di tutti i posti** (oggi Trastevere cade sul fiume).
3. **Metropoli e giornata piena:** cerchio da 2 km invece di 1,5, oppure due quartieri vicini espliciti (mattina e pomeriggio). Tocca la regola del quartiere, non C5c: da decidere.
4. **Borgo:** accettare il nome di Google quando proposto e trovato condividono il tipo e stanno nel comune («Cattedrale di Troina» → «Chiesa Madre»). È la proposta 6 di C10: oggi a Troina passa 1 nome su 8.
5. **Il simbolo segnato «dedotto»** (Napoli, Roma) andrebbe chiesto di nuovo all'AI invece di dedurlo, se la si vuole sempre esplicita.

## Decisioni per Ivano

1. **Soglie della scala** (mie, dichiarate): borgo sotto 30.000 abitanti, metropoli da 800.000, conferma col diametro di 2 km. Palermo (≈ 670.000) resta città, ed è giusto per i dati: 1,1 km fra gli essenziali.
2. **La scala la propone l'AI con un numero (gli abitanti), la regola è nel codice.** Con la scala chiesta a parole l'AI diceva «città» per tutti.
3. Le proposte 1–4.
4. **La spesa del task è arrivata a ≈ 7,0 $** (approvati 7,5).

## Cosa ho dato per vero senza verificarlo

1. **Gli abitanti dell'AI.** Roma 2.873.000, Napoli ≈ 960.000, Palermo ≈ 670.000, Catania ≈ 311.000, Lecce 95.000, Troina 6.000 (sonda e lista). Li ho presi così: un errore di un ordine di grandezza sposta la scala proposta. Il diametro poi la corregge solo fra città e metropoli o borgo, non il contrario.
2. **Il nome del quartiere** («Trastevere» nella richiesta = «Trastevere» nella lista). Il confronto è a parola intera, senza accenti né maiuscole. Un quartiere scritto diversamente dall'AI («Rione Trastevere») non verrebbe riconosciuto. Non provato.
3. **Il comune dall'indirizzo di Google.** Un posto è «nel comune» se il nome del comune sta nell'indirizzo. Per un comune che si chiama come una frazione di un altro, il controllo può sbagliare. Non provato.
4. **La provincia dal centro.** La sigla viene dall'indirizzo del centro trovato da `findplacefromtext` («94018 Troina EN»). Per Roma l'indirizzo non ha il CAP: provincia `null`, ma per una metropoli non serve.
5. **Un campione per tour.** L'AI, il selettore e Google cambiano da una chiamata all'altra: ogni numero viene da una generazione. In particolare la lista di Roma è cambiata fra la sonda (Trastevere con 3–4 posti, un simbolo) e il giro (Trastevere con 3 locali, nessun essenziale).
6. **«Due quartieri vicini».** Non c'è una regola esplicita per il quartiere del pomeriggio: il cerchio da 1,5 km (fino a 2,5) e il tetto di cammino fanno da limite. È la mia lettura della richiesta.
7. **La spesa del giro fermato** (≈ 0,65 $ per lista e tour di Roma) è stimata: il runner è stato fermato a metà caso e non l'ha registrata.
8. **Il deploy del client.** Il codice del client esce col prossimo deploy di Vercel; `openai-proxy` v18 è già in produzione. **Deploy da verificare da Ivano.**
9. **Il tempo** (33–43 s per il primo tour di una città, 23–37 s per gli altri) l'ho confrontato coi 21,2 s del giro di Ivano in C9, come in C10, non con una misura nuova del codice di prima.

