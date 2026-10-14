# C10b3-ter — prima gli imperdibili: fase A0 e fase A (il cancello non passa, solo per il simbolo di Napoli)

**Esito.**
- **A0:** vince la variante **C**, prima gli imperdibili, con 5,00 essenziali di controllo in media su 8 liste grezze. A ne ha 4,75, B 4,00.
- **Fase A:**
  - **Roma passa tutto**: 6 essenziali su 6, simbolo Colosseo, nessun inventato, solo `gpt-6.1-sol`.
  - **Napoli** ha 4 essenziali su 6, nessun inventato, solo `gpt-6.1-sol`, ma il **simbolo è Castel Nuovo (Maschio Angioino)** invece del Duomo atteso. 🔴

Come chiede il task mi sono fermato: niente Catania, Palermo, Lecce, Troina, niente fase B.

## 0) Il prompt spingeva verso il non ovvio? In parte

Nel prompt `c10b-6` (v22) la voce è quella di un abitante in sei punti:

1. «Sei una persona nata e cresciuta a {città} che conosce la sua città strada per strada.»
2. «… e i posti dove va davvero chi ci abita.» (richiesta iniziale)
3. Ancore: «i posti che un abitante nomina per primi»
4. Essenziale: «i posti che chi ci abita nomina per primi»
5. Simbolo: «l'essenziale che un abitante non ti perdonerebbe mai di aver saltato (uno per quartiere)»
6. Quartiere: «col nome che usa chi ci abita» (solo metropoli)

**Non c'è** un invito a evitare i famosi. C'è anzi il contrario: «… anche se sono famosi» (regola degli essenziali).

**Verdetto: l'ipotesi è confermata solo in parte.** La voce «da abitante» c'è, ma da sola non spiega i buchi:

- in A0 la variante A, cioè il prompt di v22, ha trovato a Roma **6/6 e 5/6** sui nomi grezzi;
- la stessa A, nella lista verificata di C10b3-bis, ne aveva trovato **1/6**.

Pesano altre due cose:

- **la variabilità da una chiamata all'altra**, molto alta;
- **la struttura per quartieri** della metropoli: il modello sceglie i quartieri prima dei posti, e mette un'ancora per quartiere.

La variante C toglie entrambi i problemi: gli imperdibili si nominano prima, a livello di città. Infatti è la più stabile: Roma 6/6 in tutte e tre le sue liste (due in A0, una in fase A), Napoli 4/6 in tutte e tre.

## Cosa ho fatto

1. **Tre varianti del prompt** in `cityKnowledge.ts` (`VARIANTI_LISTA`, `promptCitta(…, variante)`):
   - **A** — quella di v22;
   - **B** — 2 ancore per ogni quartiere principale; quartieri e ancore «dove un abitante porta un amico la prima volta» (in città cambia solo la frase delle ancore);
   - **C** — la lista in due parti:
     - prima **GLI IMPERDIBILI**, «i luoghi che chiunque citerebbe per {città}, anche se ovvi» (città 5–6, metropoli 6–8, a livello di città, campo `imperdibile`);
     - poi i posti da abitante;
     - le ancore si scelgono fra gli imperdibili;
     - il simbolo è «l'imperdibile più riconosciuto al mondo», un luogo da visitare.

   Nella C il codice lo fa rispettare (`leggiLista`):
   - un essenziale che non è imperdibile non è un'ancora;
   - il simbolo indicato diventa ancora;
   - con meno di 3 ancore diventano ancore gli imperdibili, nell'ordine dell'AI.

   Quote, piazze e vie, mercati, dopocena e borgo sono gli stessi nelle tre. Nessun nome delle liste di controllo nel prompt.
2. **In produzione la C** (`VARIANTE_LISTA = 'C'`, lista `c10b-7`, `openai-proxy` **v23**). Il completamento cerca le ancore mancanti fra gli imperdibili. La lista dedicata del quartiere resta come prima (variante A).
3. **Il banco controlla il simbolo giusto** (`asticella-c10.js`, `SIMBOLO_CONTROLLO`, `simboloGiusto`; colonna nuova in `report-c10.js`).
   - Il simbolo atteso è il **primo nome di ogni lista di controllo**: Colosseo, Duomo di Napoli, Cattedrale di Palermo, Basilica di Santa Croce, Cattedrale di Sant'Agata, Chiesa Madre. Le liste non cambiano.
   - Il simbolo della città è il primo segnato dall'AI. Uno dedotto dal codice non vale, quindi a Roma il Pantheon, simbolo di un quartiere, non basta più.
   - **La scelta «il primo nome» è mia**, fatta prima di vedere i numeri: le liste di controllo non avevano un simbolo dichiarato.
4. **Il traduttore senza città del banco.**
   - Via «Villa Bellini» e «il Colosseo», e anche «Villa Borghese», «Villa Sciarra», «Parco Sempione» e gli esempi con Roma e Catania.
   - Al loro posto esempi di Torino, Genova, Bari e Verona: Villa Durazzo Pallavicini, Villa Croce, Parco del Valentino, «la Mole Antonelliana», «via Torino», «corso Genova».

**Test.** File nuovo `src/__tests__/services/c10b3ter.test.js`, 4 test: **tutti rossi su `fa93d80`, verdi ora**.
- il controllo del simbolo boccia il Pantheon a Roma e un simbolo dedotto;
- il traduttore non contiene nessuna città del banco né posti delle liste di controllo;
- la variante in produzione è la C;
- le ancore vengono dagli imperdibili e il simbolo ne fa parte.

I test delle regole di C10b3 e C10b3-bis ora indicano in modo esplicito la variante A. Le loro regole non cambiano: cambia solo la variante di difetto.

**Suite: 2033 test verdi** (153 file). Lint: 0 errori. `deno check`: pulito.

## Fase A0 — 24 liste grezze, senza verifica Google

**Come:** script `scripts/prova-reale/c10b3ter-a0.live.js`, account di prova.
- Ogni lista è **una chiamata al proxy v22 sul percorso generico** col passaggio `lista`: stesso modello, tempo massimo (60 s) e ripiego della lista vera.
- Il prompt lo scrive lo stesso modulo del proxy (`promptCitta`), letto dallo script.
- Il percorso generico non scrive `city_knowledge`: **nessuna lista grezza salvata sul server**, nessun deploy servito per A0.
- La scala è quella già misurata (Napoli e Roma metropoli, Catania e Lecce città), senza la chiamata degli abitanti.
- Chiavi mai lette né stampate dallo script: chiama il proxy con il token di sessione.

Grezzo: `docs/prove/dati/2026-10-17-c10b3ter-a0.json`.

| Variante | Città | Rip. | Essenziali di controllo | Simbolo = atteso | Quote (mancate) | Nomi | Modello | Costo |
|---|---|---|---|---|---|---|---|---|
| A | Napoli | 1 | 4/6 | — (lista non leggibile) | 🔴 4 | 18 | **ripiego** `gpt-4o-mini` (oltre 60 s) | 0,0007 $ |
| A | Napoli | 2 | 3/6 | ✅ Duomo | ✅ 0 | 18 | `gpt-6.1-sol` | 0,0240 $ |
| A | Roma | 1 | 6/6 | 🔴 Pantheon | ✅ 0 | 17 | `gpt-6.1-sol` | 0,0231 $ |
| A | Roma | 2 | 5/6 | 🔴 Pantheon | ✅ 0 | 16 | `gpt-6.1-sol` | 0,0216 $ |
| A | Catania | 1 | 7/8 | ✅ Cattedrale | ✅ 0 | 17 | `gpt-6.1-sol` | 0,0200 $ |
| A | Catania | 2 | 6/8 | ✅ Cattedrale | ✅ 0 | 17 | `gpt-6.1-sol` | 0,0203 $ |
| A | Lecce | 1 | 4/6 | ✅ Santa Croce | ✅ 0 | 16 | `gpt-6.1-sol` | 0,0189 $ |
| A | Lecce | 2 | 3/6 | ✅ Santa Croce | ✅ 0 | 17 | `gpt-6.1-sol` | 0,0197 $ |
| B | Napoli | 1 | 3/6 | 🔴 Sansevero | ✅ 0 | 17 | `gpt-6.1-sol` | 0,0220 $ |
| B | Napoli | 2 | 3/6 | ✅ Duomo | ✅ 0 | 17 | `gpt-6.1-sol` | 0,0234 $ |
| B | Roma | 1 | 5/6 | 🔴 Pantheon | ✅ 0 | 16 | `gpt-6.1-sol` | 0,0205 $ |
| B | Roma | 2 | 4/6 | 🔴 Pantheon | ✅ 0 | 16 | `gpt-6.1-sol` | 0,0207 $ |
| B | Catania | 1 | 6/8 | ✅ Cattedrale | ✅ 0 | 16 | `gpt-6.1-sol` | 0,0189 $ |
| B | Catania | 2 | 6/8 | ✅ Cattedrale | ✅ 0 | 16 | `gpt-6.1-sol` | 0,0191 $ |
| B | Lecce | 1 | 3/6 | ✅ Santa Croce | ✅ 0 | 17 | `gpt-6.1-sol` | 0,0201 $ |
| B | Lecce | 2 | 2/6 | ✅ Santa Croce | ✅ 0 | 17 | `gpt-6.1-sol` | 0,0199 $ |
| **C** | Napoli | 1 | **4/6** | 🔴 Castel Nuovo | ✅ 0 | 18 | `gpt-6.1-sol` | 0,0248 $ |
| **C** | Napoli | 2 | **4/6** | 🔴 Castel Nuovo | ✅ 0 | 17 | `gpt-6.1-sol` | 0,0226 $ |
| **C** | Roma | 1 | **6/6** | ✅ Colosseo | ✅ 0 | 16 | `gpt-6.1-sol` | 0,0223 $ |
| **C** | Roma | 2 | **6/6** | ✅ Colosseo | ✅ 0 | 17 | `gpt-6.1-sol` | 0,0225 $ |
| **C** | Catania | 1 | 6/8 | 🔴 Fontana dell'Elefante | ✅ 0 | 16 | `gpt-6.1-sol` | 0,0192 $ |
| **C** | Catania | 2 | 6/8 | 🔴 Fontana dell'Elefante | ✅ 0 | 17 | `gpt-6.1-sol` | 0,0205 $ |
| **C** | Lecce | 1 | 4/6 | ✅ Santa Croce | ✅ 0 | 17 | `gpt-6.1-sol` | 0,0203 $ |
| **C** | Lecce | 2 | 4/6 | ✅ Santa Croce | ✅ 0 | 16 | `gpt-6.1-sol` | 0,0197 $ |

| Variante | Essenziali in media | Quota media | Quote rispettate | Simbolo = atteso | Nomi in media |
|---|---|---|---|---|---|
| A | 4,75 (4,86 senza il ripiego) | 72% | 7/8 | 5/8 | 17,0 |
| B | 4,00 | 60% | 8/8 | 5/8 | 16,5 |
| **C** | **5,00** | **77%** | **8/8** | 4/8 | 16,75 |

**Perché vince C:** è la regola fissata dal task, cioè più essenziali in media senza perdere quote. Il simbolo non era fra i criteri della scelta.
- C è la sola variante che non scende mai sotto 4/6 a Roma, Napoli e Lecce.
- Tra le sue due ripetizioni gli essenziali non cambiano mai. In A cambiano in tutte e 4 le città, in B in 2 su 4.
- A Napoli C trova sempre Spaccanapoli (come Via Benedetto Croce o Via San Biagio dei Librai), che A e B non trovano mai.

**Casi dubbi** (nomi simili a un essenziale mancante, non contati):
- «Giardino Bellini» / «Villa Bellini» per il Teatro Massimo Bellini: è un altro posto;
- «Castel Nuovo» e «Castel Sant'Elmo» per Castel dell'Ovo: altri castelli;
- «Mercato di Porta Rudiae» per Porta Napoli: un'altra porta.

Nessuno è lo stesso posto con un altro nome.

## Fase A — la variante C con verifica Google (`c10b-7`, v23, giorno 15/10)

Grezzo: `docs/prove/dati/2026-10-17-c10b3ter-fase-a-1.json`; script `scripts/prova-reale/c10b3ter-liste.live.js`.

| | Napoli | Roma |
|---|---|---|
| Simbolo della città (segnato dall'AI) | 🔴 **Castel Nuovo – Maschio Angioino** (atteso: Duomo di Napoli) | ✅ **Colosseo** |
| Simboli per quartiere dedotti dal codice | Cappella Sansevero (Centro storico), Certosa di San Martino (Vomero) | Pantheon (Centro), Basilica di San Pietro (Prati e Borgo) |
| Modello | ✅ `gpt-6.1-sol` (abitanti 2,0 s, lista 50,1 s) | ✅ `gpt-6.1-sol` (abitanti 1,9 s, lista 40,3 s) |
| Inventati | ✅ 0/17 (0%) | ✅ 0/16 (0%) |
| Essenziali di controllo | ✅ **4/6**: Duomo, Sansevero, Plebiscito, Spaccanapoli; mancano Museo Archeologico Nazionale, Castel dell'Ovo | ✅ **6/6**: Colosseo, Trevi, Pantheon, San Pietro, Foro Romano, Navona |
| Imperdibili | Sansevero, Duomo, Castel Nuovo, Palazzo Reale, Certosa di San Martino, Plebiscito, Via San Biagio dei Librai (7) | Colosseo, Foro Romano, Pantheon, Fontana di Trevi, San Pietro, Musei Vaticani, Castel Sant'Angelo, Piazza Navona (8) |
| Ancore | Sansevero, Castel Nuovo, Certosa di San Martino | Colosseo, Pantheon, San Pietro |
| Quote | ✅ tutte (9 visite, 2 piazze/vie, 3 ancore, 2 colazioni, 1 mercato, 2 pasti, 1 dopocena; 3 per quartiere) | ✅ tutte (9 visite, 2 piazze/vie, 3 ancore, 1 colazione, 1 mercato, 2 pasti, 1 dopocena; 3 per quartiere) |
| Completamento | non servito | non servito |
| Quartieri | Centro storico, San Ferdinando, Vomero | Monti, Centro, Prati e Borgo |
| Tempo (dal client) | 56,3 s | 44,0 s |
| Costo (listino del banco) | 0,64 $ | 0,60 $ |
| Costo reale | 0,11 $ | 0,28 $ |

**Il cancello cade su una voce sola: il simbolo di Napoli.** Il modello, alla domanda «l'imperdibile più riconosciuto al mondo», risponde Castel Nuovo in tutte e tre le liste C (due in A0, una qui). A Catania, in A0, ha risposto Fontana dell'Elefante tutte e due le volte. Castel Nuovo non è nella lista di controllo di Napoli. La Fontana dell'Elefante non è in quella di Catania.

È un conflitto fra due regole del task:

- il prompt C chiede il simbolo «più riconosciuto al mondo»;
- il cancello vuole il simbolo «della lista di controllo», che io ho fissato come il primo nome di ogni lista: per Napoli il Duomo, per Catania la Cattedrale.

Le due regole indicano posti diversi a Napoli e a Catania.

## Spesa

| Voce | Listino del banco | Reale |
|---|---|---|
| A0: 24 liste grezze (solo token) | 0,48 $ (tetto A0: 1 $) | 0,48 $ |
| Fase A: Napoli e Roma | 1,23 $ | 0,39 $ |
| **Totale del task** | **≈ 1,72 $** (tetto 6 $) | ≈ 0,88 $ |

## Scritture sul database

Due righe nuove, scritte dal proxy v23: `(napoli, 2026-10-15, c10b-7)` e `(roma, 2026-10-15, c10b-7)`. Le righe `c10b-5` e `c10b-6` sono dove erano: nessuna cancellazione, nessuna modifica.

## Proposte (non scritte)

1. **Il simbolo atteso, deciso da Ivano.** Due strade:
   - un simbolo per città scritto nella lista di controllo;
   - un piccolo insieme di simboli accettati: Napoli {Duomo, Castel Nuovo}, Catania {Cattedrale di Sant'Agata, Fontana dell'Elefante}.

   Con la seconda, la fase A di oggi passerebbe su Napoli e Roma. Il cancello però non si cambia dopo aver visto i numeri: va deciso prima di rifarla.
2. **Il prompt C senza «al mondo»:** «il simbolo è l'imperdibile che chiunque nominerebbe per primo» potrebbe portare il Duomo. Va provato in A0 (circa 0,15 $ per Napoli e Catania × 2).

## Decisioni per Ivano

1. Il simbolo atteso di Napoli e di Catania (proposta 1). Poi si continua la fase A da Catania, Palermo, Lecce e Troina, e Napoli si rifà solo se il simbolo atteso non cambia.
2. Oppure: provare il prompt C con il simbolo «nominato per primo» (proposta 2) e rifare la fase A.

## Cosa ho dato per vero senza verificarlo

1. **Il simbolo atteso = il primo nome della lista di controllo.** È una mia lettura dell'ordine delle liste, non una decisione scritta di Ivano. Decide l'esito del cancello a Napoli.
2. **I campioni:** due liste per variante e città in A0, una in fase A. Le differenze fra A e C (4,75 contro 5,00) stanno dentro la variabilità di una chiamata all'altra. Il vantaggio più solido di C è che le sue liste si somigliano tra loro.
3. **A0 senza la chiamata degli abitanti:** la scala l'ho data io (quella misurata nei giri precedenti). Nella lista vera la decide la chiamata degli abitanti: oggi ha dato metropoli per Napoli e Roma, come prevedevo.
4. **Corrispondenza per nome:** gli essenziali di A0 si contano con le espressioni delle liste di controllo sui nomi grezzi, prima che Google li verifichi. Un nome scritto in modo diverso dal modello potrebbe sfuggire; i casi dubbi sono elencati sopra.
5. **Il costo reale** conta a zero le ricerche servite dalla cache del proxy. Non l'ho confrontato con le fatture, e i prezzi dei token sono quelli del listino pubblico.
6. **Il client in produzione** riceve ora liste `c10b-7` dal proxy v23. La forma è la stessa, e `imperdibile` è un campo in più che ignora. L'ho stabilito leggendo il codice, come in C10b3-bis, non con un tour vero dall'app pubblicata.
