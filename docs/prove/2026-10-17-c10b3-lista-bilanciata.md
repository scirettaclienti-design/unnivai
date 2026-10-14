# C10b3 — la lista della città bilanciata: fase A (il cancello non passa)

**Esito: 🔴 cancello non passato. La fase B (il giro dei tour) non l'ho fatta, come chiede il task.**

- Simbolo presente: **6 città su 6** ✅
- Essenziali di controllo trovati, almeno quanti nella lista C10b: **3 città su 6** 🔴
  - Catania: 5 contro 6
  - Napoli: 1 contro 3
  - Lecce: 3 contro 4

Le quote ci sono in tutte e 6 le liste (a Roma dopo il completamento, tranne il dopocena), ma da sole non portano i posti delle liste di controllo. Il perché è nella sezione «Perché il cancello non passa».

Codice sul commit locale di C10b3 (base 8d3fe89). `openai-proxy` è alla **v21** in produzione, lista `c10b-5`. Nessuna migrazione: le quote si salvano nel campo `costo` (jsonb) di `city_knowledge`, che c'era già.

## Cosa ho fatto

1. **La lista ha una composizione fissa** (`supabase/functions/openai-proxy/cityKnowledge.ts`, `CITY_LIST_VERSION = 'c10b-5'`). Le quote sono nel prompt, per città e metropoli:
   - almeno 8 luoghi da visitare: chiese, musei, monumenti, palazzi, giardini; piazze e belvedere al massimo 2;
   - 3–4 ancore, simbolo compreso;
   - 1–2 colazioni o caffè storici;
   - 1 mercato, se esiste, con giorni e orari;
   - 2 pasti tipici;
   - 1 dopocena.

   In metropoli ogni quartiere principale deve avere almeno 3 luoghi da visitare. Nel borgo: al massimo 8 nomi, almeno 4 luoghi da visitare, più la via principale (una sola). Ogni posto dice la sua **categoria** (`CATEGORIE`).
2. **Il codice controlla le quote** (`quoteLista`). Se mancano luoghi da visitare, fa **una sola** richiesta di completamento (`completaLista`, `promptCompletamento`). Le aggiunte sono solo luoghi da visitare «da locale»: mai ancore, mai simbolo, mai doppioni. Le quote prima e dopo, e cosa è stato aggiunto, finiscono in `costo.quote` e nella risposta (`cityKnowledge.quote`).
3. **Il simbolo è un luogo da visitare.** Un posto con categoria da locale (colazione, ristorante, dopocena, bar, pasticceria) non può essere essenziale. Il simbolo non è mai una piazza, un belvedere, una via o un mercato; se l'AI lo segna lì, passa al primo essenziale visitabile (`simboloDedotto`).
4. **Roma: in metropoli le ricerche iniziali partono dal quartiere scelto** (`aiRecommendationService._generateItinerary`).
   - Il motore aspetta la lista, sceglie il quartiere (o i due quartieri) e poi chiama `fetchRealPOICandidates` dal centro dell'area, col suo raggio come bias (`radiusMeters`, 2 km).
   - Il tracciato lo scrive in `_citta.centroRicerche`.
5. **Borghi.**
   - La via principale della lista (`passeggiata: true`) vale come passeggiata (`candidateMomentCategories`) e la regola delle zone non la toglie; è scritto in `_citta.viaPrincipale`.
   - Il giro corto si colloca nella **fascia in cui i posti della lista sono aperti** (`fasciaApertaBorgo`, `src/lib/cityKnowledge.js`). Prova le partenze a passi di 30 minuti dentro la finestra; un posto conta se è aperto per una sosta intera (45 min). Vince la fascia con più posti della lista aperti, a parità quella in cui sono già aperti all'inizio. La finestra non si allunga mai.
   - La durata segue i luoghi aperti (`durataBorgoCorto`, 45 min l'uno, da 2 a 4).

Non ho toccato ORARI, C5c, C7 (tranne l'eccezione della via del borgo, chiesta dal task), C8, minimi, merito anti-ovvio, testi approvati, quote d'uso, Profilo e DNA. I controlli del banco sono invariati.

**Test.** Il file nuovo è `src/__tests__/services/c10b3.test.js`, con 7 test: **tutti e 7 rossi su 8d3fe89, verdi ora**.
- la lista senza abbastanza luoghi da visitare viene completata (anche per quartiere);
- il simbolo non può essere un locale;
- in metropoli le ricerche iniziali partono dal quartiere (centro di Trastevere, raggio 2000 m);
- nel borgo la via principale resta, come passeggiata;
- il giro corto del borgo cade nella fascia aperta (16:00–19:00 per posti aperti solo il pomeriggio), con 2 posti della lista e nessun tempo libero.

Quattro test esistenti cambiano solo perché leggono il testo del prompt o la riga della ricerca (ora con `...bias`): `cittaC10`, `c10bScale`, `c10b2`, `gateIntentLogs`. Ognuno controlla ancora la stessa cosa.
- **Suite: 2023 test verdi** (151 file).
- Lint: 0 errori.
- `deno check` del proxy: pulito.

## Fase A — le 6 liste (`c10b-5`, giorno 15/10, solo liste)

Grezzo: `docs/prove/dati/2026-10-17-c10b3-fase-a.json`, script `scripts/prova-reale/c10b3-liste.live.js`, righe in `city_knowledge`. Le colonne:
- **Inventati** = nomi proposti che la verifica su Google scarta.
- **Costo** = token (listino OpenAI) + Google a listino del banco; tra parentesi il reale, cioè senza le ricerche servite dalla cache del proxy.

| Città | Scala | Quote | Completamento | Simbolo | Essenziali di controllo (C10b → **C10b3**) | Inventati | Tempo | Costo |
|---|---|---|---|---|---|---|---|---|
| Catania | città | ✅ tutte (9 visite, 4 ancore, 2 colazioni, 1 mercato, 2 pasti, 1 dopocena) | — | Fontana dell'Elefante (monumento) | 6/8 → **5/8** 🔴 | 2/15 (13%) | 52,5 s | 0,56 $ (0,24) |
| Roma | metropoli | 🟡 prima mancavano 5 luoghi da visitare (3 su 8; Celio 1, Esquilino 1) e il dopocena; **dopo**: tutte tranne il dopocena | 5 aggiunti: Santi Giovanni e Paolo, Santa Maria in Domnica, Santa Maria Maggiore, Sant'Alfonso (non verificato), Pantheon | Colosseo (Celio), Palazzo Massimo (Esquilino) | 2/6 → **2/6** ✅ | 2/14 (14%) | **69,3 s** | 0,51 $ (0,27) |
| Napoli | metropoli | ✅ tutte (9 visite, 3 per quartiere: Decumani, San Ferdinando, Vomero) | — | Cappella Sansevero, Palazzo Reale, Castel Sant'Elmo | 3/6 → **1/6** 🔴 | 0/15 (0%) | 39,4 s | 0,56 $ (0,35) |
| Palermo | città | ✅ tutte | — | Cattedrale | 4/6 → **5/6** ✅ | 0/14 (0%) | 43,2 s | 0,52 $ (0,28) |
| Lecce | città | ✅ tutte (8 visite) | — | Basilica di Santa Croce | 4/6 → **3/6** 🔴 | 1/14 (7%) | 35,8 s | 0,52 $ (0,14) |
| Troina | borgo | ✅ (7 nomi, 5 visite, via Conte Ruggero) | — | Chiesa Madre | 0/3 → **2/3** ✅ | 0/7 (0%) | 35,8 s | 0,27 $ (0,10) |

**Rispetto alle liste C10b2** (`gpt-6.1-sol`, `c10b-4`, senza quote), gli essenziali di controllo:

| Città | C10b2 | C10b3 |
|---|---|---|
| Catania | 4 | 5 |
| Roma | 0 | 2 |
| Napoli | 2 | 1 |
| Palermo | 3 | 5 |
| Lecce | 2 | 3 |
| Troina | 1 | 2 |

Le quote migliorano 5 città su 6 rispetto al modello nuovo senza quote. Il cancello però confronta con C10b (`gpt-4o-mini`), e lì 3 città restano sotto.

**Roma, la lista principale è di `gpt-4o-mini`.** `gpt-6.1-sol` ha risposto HTTP 500 dopo 39,9 s ed è scattato il ripiego, com'è scritto. Il completamento invece è di `gpt-6.1-sol`, in 10,8 s. Per questo Roma supera i 60 s: 39,9 s del tentativo fallito, 9,5 s del ripiego, 10,8 s del completamento e la verifica.

## Perché il cancello non passa

1. **Le quote fissano quanti luoghi da visitare, non quali.** A Napoli la lista ha 9 luoghi da visitare, 3 per quartiere:
   - Decumani: Sansevero, Santa Chiara, San Lorenzo Maggiore;
   - San Ferdinando: Palazzo Reale, San Francesco di Paola, Galleria Umberto;
   - Vomero: Castel Sant'Elmo, Certosa di San Martino, Villa Floridiana.

   Sono luoghi veri e famosi, ma fuori dalla lista di controllo: mancano Duomo, Museo Archeologico Nazionale e Castel dell'Ovo. A Lecce mancano Teatro Romano e Castello di Carlo V, al loro posto ci sono San Matteo, Santa Chiara e Museo Faggiano.
2. **Alcuni essenziali di controllo sono piazze, vie o un secondo mercato, e le quote li spingono fuori.**
   - Piazza del Plebiscito, Spaccanapoli (una via), Piazza del Duomo di Lecce, Via Etnea, Fera 'o Luni (il secondo mercato di Catania, oltre la quota «1 mercato»). Per Roma: Piazza Navona.
   - In città la categoria «via» non c'è fra i luoghi da visitare (ci sono solo nel borgo), e piazze e belvedere contano al massimo 2.
   - Fra gli essenziali di controllo mancanti, sono piazze, vie o il secondo mercato: a Catania 2 su 3 (Via Etnea e Fera 'o Luni; manca anche il Teatro Bellini), a Lecce 1 su 3 (Piazza del Duomo), a Napoli 2 su 5 (Plebiscito e Spaccanapoli). Non ho confrontato posto per posto con le liste C10b, quindi non so quale di questi la lista C10b avesse.
3. **Il completamento non è mai scattato dove serviva.** Catania, Napoli e Lecce avevano già le quote, quindi niente seconda richiesta. È scattato solo a Roma, dove ha portato il Pantheon (essenziale di controllo) e 3 luoghi verificati del Celio e dell'Esquilino.

## Spesa

| Voce | Listino del banco | Reale |
|---|---|---|
| Fase A: 6 liste (token 0,09 $ + Google) | **≈ 2,96 $** | ≈ 1,38 $ |
| Fase B | non fatta | — |
| **Totale del task** | **≈ 2,96 $** (tetto 5 $) | ≈ 1,38 $ |

## Proposte (non scritte)

1. **Quote per i luoghi «di controllo» che sono piazze o vie.** Due strade:
   - in città e metropoli, la via storica principale come in borgo (una, categoria «via», fuori dal conteggio delle piazze);
   - le piazze monumentali fra le ancore possibili.

   Il simbolo resta un luogo chiuso, come chiede già la regola. Senza, Plebiscito, Spaccanapoli, Via Etnea e Piazza Navona restano fuori per costruzione.
2. **Un secondo mercato storico** quando la città ne ha due: a Catania Pescheria e Fera 'o Luni (oggi la quota è «1 mercato»).
3. **Il completamento anche per le ancore**, non solo per il numero. Per esempio: «fra gli essenziali la cattedrale o il duomo della città e il suo museo principale, se esistono». È una regola nuova sul contenuto, da decidere: tocca il merito anti-ovvio delle ancore.
4. **Il tempo di Roma:** un ripiego più un completamento possono superare i 60 s. Proposta: niente completamento quando la lista è già un ripiego, oppure un tetto al tempo totale.
5. **Il conto dei token:** `costo.usage` della riga somma solo abitanti e lista, non il completamento (che resta in `costo.modelli`). Nel report l'ho contato a mano. Va corretto col prossimo deploy.

## Decisioni per Ivano

1. Accettare le liste `c10b-5` come sono e passare alla fase B, oppure applicare prima le proposte 1–3 e rifare la fase A (≈ 3 $ a listino).
2. Le liste di controllo stesse: Plebiscito, Spaccanapoli, Via Etnea e Piazza Navona sono piazze o vie, mentre le quote chiedono «luoghi da visitare». Vanno tenute come metro di «conosce la città» per la lista, o solo per il tour (dove la via e la piazza ci sono come passeggiata)?

## Cosa ho dato per vero senza verificarlo

1. **Un campione per città:** una lista per città, e il modello cambia da una chiamata all'altra. Il 500 di `gpt-6.1-sol` su Roma l'ho preso così come l'ha scritto il proxy, senza indagarne la causa.
2. **Le liste di controllo** (`scripts/banco/asticella-c10.js`) le ho usate come metro, come chiede il cancello. Non dicono se Certosa di San Martino o Palazzo Reale valgano meno del Duomo per un napoletano.
3. **Il costo reale** conta a zero le ricerche servite dalla cache del proxy (`google.hit`). Non l'ho confrontato con la fatturazione di Google. I prezzi dei token sono quelli del listino pubblico. Il tentativo fallito di 39,9 s su Roma non so se OpenAI lo fatturi: non è nel conto.
4. **Il motore nuovo (ricerche dal quartiere, borgo nella fascia aperta, via principale) l'ho provato solo nei test**, non su un tour vero: la fase B non c'è stata.
5. **L'attesa del primo tour del giorno in metropoli:** il motore ora aspetta la lista prima delle ricerche (prima le faceva in parallelo). Con la lista già sul server non cambia nulla. Per la prima lista del giorno le ricerche si aggiungono dopo i 40–70 s della lista; non l'ho misurato.
6. **Il deploy:** `openai-proxy` v21 è in produzione, con prompt `c10b-5`, quote e completamento. Le liste `c10b-5` del 15/10 sono già in `city_knowledge`, e l'app in produzione le legge (i campi nuovi le sono indifferenti). Il codice del client non è pubblicato: il commit è solo locale, non spinto.
