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
