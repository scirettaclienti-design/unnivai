# C10c — diagnosi: dove si perdono i posti della lista, e perché Trastevere è ignorato

**Solo lettura, 0 $.**
- Nessuna modifica al codice, nessun deploy, nessuna scrittura sul database.
- Nessuna chiamata a OpenAI o a Google.
- Verifiche iniziali: cartella `~/unnivai-1b`, ramo `c10b3` a `9babc43`, suite verde (2035 test, 154 file).

**Fonti.**
- I 10 tour della fase B di C10b3-chiusura: grezzo `dati/2026-10-17-banco-esteso-c10-3.json` (pool per momento, scelte del modello, chiusi, continuità, tracciato della lista).
- Le righe `c10b-7` del 15/10 in `city_knowledge`, lette con una `select`: tipi Google e orari dei posti della lista.
- Il codice del ramo e di main `8d3fe89`.
- Per gli orari e i momenti ammessi ho fatto girare le **funzioni vere** del motore sui dati salvati, in uno script fuori dal repo (`openStatus`, `candidateMomentCategories`, `momentAdmits`, `stayInMoment`, `zoneReason`). Nessun tour è stato rigenerato.

## In breve

- **142 posti di lista nei 10 tour: 51 entrano, 91 si perdono.** Le prime tre cause:
  - **38 «non scelti».** 23 di questi sono luoghi da visitare che perdono il confronto in un momento che poi resta con un buco di tempo libero.
  - **12 «fuori dal quartiere»**, tutti a Roma (Prati e Borgo).
  - **9 tolti dalla regola delle zone**: piazze e vie della lista che per Google sono una `route`.
- **I posti persi perché chiusi sono 6, ma 5 sono essenziali**: le due ancore di Troina in entrambi i giri, e il Teatro Massimo. Il sesto è la Pescheria di Catania.
  - **Tutti e 6 erano aperti in un altro momento, o più tardi nello stesso momento.**
  - Le ancore di Troina erano aperte più tardi nello stesso momento: il filtro degli orari dei bucket guarda **l'ora d'inizio del momento** (09:30, 14:30), non l'ora in cui ci si arriverebbe.
  - Teatro Massimo e Pescheria erano aperti la mattina, ma non potevano andarci: la mattina aveva già le sue ancore, e i mercati non sono fra le categorie della mattina.
- **Il tempo libero (1.606 min in 16 buchi oltre 20 min) ha quattro cause:**

  | Causa | Minuti | Buchi |
  |---|---|---|
  | Riempimento respinto con candidati aperti a pochi minuti | 524 | 5 |
  | Nessun candidato rimasto che rispetti varietà, strada e tetto di cammino | 568 | 5 |
  | Ancore di Troina tolte dal filtro degli orari all'inizio del momento | 335 | 3 |
  | Tetto di 8 visite (C8), a Catania e Palermo | 179 | 3 |

- **Trastevere:**
  - La lista `c10b-7` di Roma non ha un quartiere «Trastevere».
  - Il motore riconosce il quartiere della richiesta **solo fra i quartieri della lista**, quindi lo ignora e la lista dedicata non parte.
  - **In produzione** (client di main + proxy v23) è uguale: lo ignora.
- **Troina:**
  - Nessuna ancora perché Chiesa Madre e Torre Capitania sono tolte dal bucket alle 09:30 e alle 14:30, ma aprono alle 10:30/10:00 e alle 17:00/16:30.
  - La regola «la durata segue le tappe» non scatta: vale solo sotto 4 posti utilizzabili, e Troina ne ha 5.

## Come leggere l'imbuto

- **Proposti**: i nomi dell'AI.
- **Trovati da Google**: quelli verificati dal proxy.
- **Nel pool**: dopo quartiere, zone, raggio, vincoli del profilo e merito (con gli essenziali «al merito» ammessi).
- **Scelti dal selettore**: i posti della lista fra le scelte del modello, ancore seminate comprese.
- **Nel tour**: le tappe finali.

Il tour può avere più posti della lista di quanti ne abbia scelti il selettore, perché il riparatore ne aggiunge.

**Una causa per posto, la più avanzata nell'imbuto.** Dove il posto non arriva al pool vale il filtro che lo toglie. Dove arriva al pool vale quello che succede nel momento in cui poteva stare:
- non ammesso in nessun momento;
- chiuso in tutti i momenti che lo ammettono;
- oltre il tetto di cammino in tutti i momenti dove compare;
- perso al confronto.

Il **tetto C8** lo assegno a chi perde il confronto in un momento che poi ha un buco, nei due giri dove le 8 visite erano già raggiunte (Catania, Palermo). Lì il riempimento non può aggiungere tappe (`momentsToExpand` torna vuoto).

**I «minuti» del pool sono il cammino misurato dal punto di riferimento del momento quando il motore ha registrato la classifica**, non dalla tappa prima nel giro finale.

**Il tracciato registra al massimo 15 candidati per momento.** Un posto che non vi compare è «mai fra i primi 15».

## 1) Imbuto, tour per tour

### Catania — «Domani un giorno da catanese»

Imbuto: **16 proposti → 15 trovati da Google → 13 nel pool → 4 scelti dal selettore → 5 nel tour.**

Nel tour: Fontana dell'Elefante (uʻ Liotru) (09:51 mattina); Basilica Cattedrale di Sant'Agata (09:30 mattina); Castello Ursino (15:05 pomeriggio); Teatro Antico greco-romano di Catania (16:41 pomeriggio); Trattoria del Cavaliere (20:00 cena).

| Posto perso | Tipo | Causa | Dettaglio |
|---|---|---|---|
| Monastero dei Benedettini di San Nicolò l'Arena | essenziale | tetto visite C8 | buco nel suo momento, nessuna visita in piu' (8 su 8); pomeriggio: fuori strada (7 min) |
| Piazza del Duomo | da locale | regola delle zone | per Google è una via (route) senza altro tipo |
| Via Etnea | da locale | regola delle zone | per Google è una via (route) senza altro tipo |
| Giardino Bellini - Villa Bellini | da locale | tetto visite C8 | buco nel suo momento, nessuna visita in piu' (8 su 8); pomeriggio: regole migliori dello scelto (scelta del modello a pari merito di regole) (13 min); passeggiata: merito e strada minori (a pari regole) (11 min) |
| Chiesa di San Nicolò l'Arena | da locale | tetto visite C8 | buco nel suo momento, nessuna visita in piu' (8 su 8); mattina: merito e strada minori (a pari regole) (6 min); pomeriggio: fuori strada (7 min) |
| Museo Vincenzo Bellini | da locale | altro: sostituito dopo la scelta | scelto in mattina, non nel giro finale |
| Piazza Università | da locale | tetto visite C8 | buco nel suo momento, nessuna visita in piu' (8 su 8); mattina: merito e strada minori (a pari regole) (3 min); pomeriggio: regole migliori dello scelto (scelta del modello a pari merito di regole) (3 min); passeggiata: famiglia gia' presente nel giorno (piazza) (3 min) |
| Pescheria di Catania | da locale | chiuso all'orario | pomeriggio: chiuso all'arrivo |
| Pasticceria Savia | da locale | altro: nessun momento lo ammette | categorie [-], tipo pastry_shop |
| Camelot | da locale | non scelto | pranzo: fuori strada (5 min); cena: pari: lo scelto viene prima (modello o ordine) (11 min) |

### Roma neutra

Imbuto: **16 proposti → 16 trovati da Google → 13 nel pool → 4 scelti dal selettore → 8 nel tour.**

Nel tour: Colosseo (09:30 mattina); Foro Romano (14:30 pomeriggio); Pantheon (16:53 pomeriggio); Fontana di Trevi (15:44 pomeriggio); Basilica di San Pietro in Vincoli (10:05 mattina); Sant'Eustachio Caffè (18:00 aperitivo); La Taverna dei Fori Imperiali (12:30 pranzo); Blackmarket Hall - Rione Monti (20:00 cena).

| Posto perso | Tipo | Causa | Dettaglio |
|---|---|---|---|
| Basilica di San Pietro | essenziale (simbolo) | oltre il tetto di cammino C5c | mai fra i primi 15 del momento; nel giro B, dove compare, «oltre il tetto di cammino (30 min)» (dedotto per gli altri giri) |
| Musei Vaticani | da locale | fuori dal quartiere | quartiere Prati e Borgo; area del giro: Centro + Monti |
| Castel Sant'Angelo | da locale | non scelto | mattina: merito e strada minori (a pari regole) (20 min) |
| Piazza Navona | da locale | altro: sostituito dopo la scelta | scelto in pomeriggio, non nel giro finale |
| Chiesa di San Luigi dei Francesi | da locale | non scelto | mattina: merito e strada minori (a pari regole) (9 min); pomeriggio: famiglia gia' presente nel giorno (chiesa) (17 min) |
| Piazza di Spagna | da locale | non scelto | mattina: merito e strada minori (a pari regole) (12 min); pomeriggio: fuori strada (19 min); passeggiata: famiglia gia' presente nel giorno (piazza) (13 min) |
| Mercato Trionfale | da locale | fuori dal quartiere | quartiere Prati e Borgo; area del giro: Centro + Monti |
| Hostaria Dino e Tony | da locale | fuori dal quartiere | quartiere Prati e Borgo; area del giro: Centro + Monti |

### Roma A (vegetariano, €€€, Arte e Chiese)

Imbuto: **16 proposti → 16 trovati da Google → 11 nel pool → 4 scelti dal selettore → 5 nel tour.**

Nel tour: Colosseo (09:30 mattina); Pantheon (15:31 pomeriggio); Fontana di Trevi (18:55 aperitivo); Chiesa di San Luigi dei Francesi (15:08 pomeriggio); Sant'Eustachio Caffè (18:00 aperitivo).

| Posto perso | Tipo | Causa | Dettaglio |
|---|---|---|---|
| Foro Romano | da locale | non scelto | mattina: merito e strada minori (a pari regole) (13 min); pomeriggio: fuori strada (19 min) |
| Basilica di San Pietro | essenziale (simbolo) | oltre il tetto di cammino C5c | mai fra i primi 15 del momento; nel giro B, dove compare, «oltre il tetto di cammino (30 min)» (dedotto per gli altri giri) |
| Musei Vaticani | da locale | fuori dal quartiere | quartiere Prati e Borgo; area del giro: Centro + Monti |
| Castel Sant'Angelo | da locale | non scelto | mattina: merito e strada minori (a pari regole) (15 min) |
| Piazza Navona | da locale | non scelto | mattina: merito e strada minori (a pari regole) (6 min); pomeriggio: merito e strada minori (a pari regole) (18 min); passeggiata: famiglia gia' presente nel giorno (piazza) (3 min) |
| Basilica di San Pietro in Vincoli | da locale | non scelto | mattina: merito e strada minori (a pari regole) (20 min) / anche chiuso: pomeriggio (chiuso all'arrivo) |
| Piazza di Spagna | da locale | non scelto | mattina: merito e strada minori (a pari regole) (17 min); pomeriggio: oltre il tetto di cammino (30 min); passeggiata: famiglia gia' presente nel giorno (piazza) (13 min) |
| Mercato Trionfale | da locale | fuori dal quartiere | quartiere Prati e Borgo; area del giro: Centro + Monti |
| La Taverna dei Fori Imperiali | da locale | altro: vincoli del profilo (P7b) | dieta ["vegetariano"], budget €€€ |
| Hostaria Dino e Tony | da locale | fuori dal quartiere | quartiere Prati e Borgo; area del giro: Centro + Monti |
| Blackmarket Hall - Rione Monti | da locale | altro: vincoli del profilo (P7b) | dieta ["vegetariano"], budget €€€ |

### Roma B (budget €, Street food e Panorami)

Imbuto: **16 proposti → 16 trovati da Google → 12 nel pool → 5 scelti dal selettore → 6 nel tour.**

Nel tour: Colosseo (09:30 mattina); Pantheon (14:30 pomeriggio); Fontana di Trevi (18:55 aperitivo); Piazza Navona (15:25 pomeriggio); Chiesa di San Luigi dei Francesi (15:03 pomeriggio); Sant'Eustachio Caffè (18:00 aperitivo).

| Posto perso | Tipo | Causa | Dettaglio |
|---|---|---|---|
| Foro Romano | da locale | non scelto | mattina: merito e strada minori (a pari regole) (11 min); pomeriggio: fuori strada (10 min) |
| Basilica di San Pietro | essenziale (simbolo) | oltre il tetto di cammino C5c | mattina: oltre il tetto di cammino (30 min) |
| Musei Vaticani | da locale | fuori dal quartiere | quartiere Prati e Borgo; area del giro: Centro + Monti |
| Castel Sant'Angelo | da locale | non scelto | mattina: merito e strada minori (a pari regole) (17 min) |
| Basilica di San Pietro in Vincoli | da locale | non scelto | mattina: merito e strada minori (a pari regole) (15 min) / anche chiuso: pomeriggio (chiuso all'arrivo) |
| Piazza di Spagna | da locale | non scelto | mattina: merito e strada minori (a pari regole) (12 min); pomeriggio: fuori strada (16 min); passeggiata: famiglia gia' presente nel giorno (piazza) (13 min) |
| Mercato Trionfale | da locale | fuori dal quartiere | quartiere Prati e Borgo; area del giro: Centro + Monti |
| La Taverna dei Fori Imperiali | da locale | altro: vincoli del profilo (P7b) | dieta [], budget € |
| Hostaria Dino e Tony | da locale | fuori dal quartiere | quartiere Prati e Borgo; area del giro: Centro + Monti |
| Blackmarket Hall - Rione Monti | da locale | altro: sostituito dopo la scelta | scelto in cena, non nel giro finale / anche chiuso: pranzo (chiuso all'arrivo) |

### Napoli

Imbuto: **17 proposti → 17 trovati da Google → 14 nel pool → 6 scelti dal selettore → 5 nel tour.**

Nel tour: Museo Cappella Sansevero (09:30 mattina); Complesso Monumentale di Santa Chiara (14:30 pomeriggio); Mercato Pignasecca (14:56 pomeriggio); Gran Caffè Gambrinus (18:00 aperitivo); Ristorante Pizzeria Gorizia 1916 (20:00 cena).

| Posto perso | Tipo | Causa | Dettaglio |
|---|---|---|---|
| Duomo di Santa Maria Assunta | da locale | non scelto | mattina: merito e strada minori (a pari regole) (15 min); pomeriggio: fuori strada (13 min) |
| Castel Nuovo - Maschio Angioino | essenziale (simbolo) | altro: merito anti-ovvio | essenziale non ancora (una per famiglia) e poi fuori dal Gate MERITO |
| Palazzo Reale di Napoli | da locale | non scelto | mattina: merito e strada minori (a pari regole) (15 min); pomeriggio: famiglia gia' presente nel giorno (museo) (18 min) |
| Certosa di San Martino | essenziale (simbolo) | altro: merito anti-ovvio | essenziale non ancora (una per famiglia) e poi fuori dal Gate MERITO |
| Piazza del Plebiscito | da locale | non scelto | mattina: merito e strada minori (a pari regole) (16 min); pomeriggio: famiglia gia' presente nel giorno (piazza) (19 min); passeggiata: famiglia gia' presente nel giorno (piazza) (1 min) |
| Via San Biagio dei Librai | da locale | regola delle zone | per Google è una via (route) senza altro tipo |
| Basilica di San Francesco di Paola | da locale | non scelto | mattina: merito e strada minori (a pari regole) (17 min) / anche chiuso: pomeriggio (chiuso all'arrivo) |
| Castel Sant'Elmo | da locale | non scelto | mattina: merito e strada minori (a pari regole) (11 min); pomeriggio: famiglia gia' presente nel giorno (museo) (13 min) |
| Villa Floridiana | da locale | oltre il tetto di cammino C5c | pomeriggio: famiglia nuova ma oltre i 20 min (25 min) / anche chiuso: passeggiata (chiuso quando ci si arriva (orario del giro)); passeggiata (chiuso quando ci si arriva (orario del giro)) |
| Pasticceria Giovanni Scaturchio | da locale | altro: nessun momento lo ammette | categorie [-], tipo dessert_shop |
| Osteria Della Mattonella | da locale | non scelto | cena: pari: lo scelto viene prima (modello o ordine) (13 min) / anche chiuso: pranzo (chiuso all'arrivo) |
| Fonoteca | da locale | oltre il tetto di cammino C5c | aperitivo: oltre il tetto di cammino (22 min) |

### Palermo

Imbuto: **17 proposti → 17 trovati da Google → 15 nel pool → 7 scelti dal selettore → 5 nel tour.**

Nel tour: Cattedrale di Palermo (10:36 mattina); Palazzo dei Normanni (09:30 mattina); Orto Botanico di Palermo (15:11 pomeriggio); Mercato Ballarò (14:30 pomeriggio); Botteghe Colletti (18:00 aperitivo).

| Posto perso | Tipo | Causa | Dettaglio |
|---|---|---|---|
| Teatro Massimo di Palermo | essenziale | chiuso all'orario | ancora seminata nel pomeriggio (la mattina aveva gia' 2 ancore su 2 tappe); vietata: «chiuso quando ci si arriva (orario del giro)», aperto 09:30–15:30, sosta 30 min |
| Chiesa di Santa Maria dell'Ammiraglio (Chiesa della Martorana) | da locale | non scelto | pomeriggio: famiglia gia' presente nel giorno (chiesa) (6 min) / anche chiuso: mattina (chiuso all'arrivo) |
| Quattro Canti | da locale | tetto visite C8 | buco nel suo momento, nessuna visita in piu' (8 su 8); mattina: merito e strada minori (a pari regole) (4 min); pomeriggio: fuori strada (7 min); passeggiata: fuori strada (6 min) |
| Piazza Pretoria | da locale | regola delle zone | per Google è una via (route) senza altro tipo |
| Palazzo Abatellis | da locale | tetto visite C8 | buco nel suo momento, nessuna visita in piu' (8 su 8); mattina: merito e strada minori (a pari regole) (9 min); pomeriggio: famiglia gia' presente nel giorno (museo) (13 min) |
| Villa Giulia | da locale | altro: sostituito dopo la scelta | scelto in pomeriggio, non nel giro finale |
| Chiesa e Monastero di Santa Caterina d'Alessandria | da locale | non scelto | pomeriggio: famiglia gia' presente nel giorno (chiesa) (6 min) / anche chiuso: mattina (chiuso all'arrivo) |
| Piazza Marina | da locale | regola delle zone | per Google è una via (route) senza altro tipo |
| Antico Caffè Spinnato | da locale | non scelto | aperitivo: fuori strada (13 min) |
| BAR MAROCCO | da locale | non scelto | aperitivo: fuori strada (12 min) |
| Trattoria Ai Cascinari | da locale | non scelto | cena: pari: lo scelto viene prima (modello o ordine) (16 min) / anche chiuso: pranzo (chiuso all'arrivo) |
| Osteria Ballarò | da locale | non scelto | pranzo: fuori strada (8 min); cena: pari: lo scelto viene prima (modello o ordine) (3 min) |

### Lecce

Imbuto: **16 proposti → 15 trovati da Google → 12 nel pool → 8 scelti dal selettore → 6 nel tour.**

Nel tour: Basilica di Santa Croce (10:43 mattina); Anfiteatro Romano di Lecce (10:10 mattina); Castello Carlo V di Lecce (14:30 pomeriggio); Museo Sigismondo Castromediano (15:09 pomeriggio); Mercatino Porta rudiae (09:30 mattina); Quanto Basta Cocktail Bar (18:00 aperitivo).

| Posto perso | Tipo | Causa | Dettaglio |
|---|---|---|---|
| Cattedrale di Maria Santissima Assunta | essenziale | altro: merito anti-ovvio | essenziale non ancora (una per famiglia) e poi fuori dal Gate MERITO |
| Piazza del Duomo | da locale | regola delle zone | per Google è una via (route) senza altro tipo |
| Piazza Sant'Oronzo | da locale | regola delle zone | per Google è una via (route) senza altro tipo |
| Chiesa di Santa Chiara | da locale | non scelto | mattina: merito e strada minori (a pari regole) (0 min); pomeriggio: famiglia gia' presente nel giorno (chiesa) (4 min) |
| Chiesa di San Matteo | da locale | non scelto | mattina: merito e strada minori (a pari regole) (2 min); pomeriggio: famiglia gia' presente nel giorno (chiesa) (5 min) |
| Chiesa di Santa Irene | da locale | non scelto | mattina: merito e strada minori (a pari regole) (3 min) / anche chiuso: pomeriggio (chiuso all'arrivo) |
| Caffè Alvino | da locale | non scelto | aperitivo: merito e strada minori (a pari regole) (9 min) |
| Le Zie Trattoria Casereccia | da locale | non scelto | pranzo: fuori strada (15 min); cena: pari: lo scelto viene prima (modello o ordine) (7 min) |
| Trattoria Nonna Tetti | da locale | non scelto | pranzo: pari: lo scelto viene prima (modello o ordine) (8 min); cena: merito e strada minori (a pari regole) (5 min) |

### Troina, giornata

Imbuto: **7 proposti → 7 trovati da Google → 6 nel pool → 2 scelti dal selettore → 2 nel tour.**

Nel tour: Convento di Sant'Agostino (14:30 pomeriggio); Via Conte Ruggero (10:04 mattina).

| Posto perso | Tipo | Causa | Dettaglio |
|---|---|---|---|
| Chiesa Madre di Maria Santissima Assunta | essenziale (simbolo) | chiuso all'orario | mattina: chiuso all'arrivo; pomeriggio: chiuso all'arrivo |
| Chiesa di San Silvestro Monaco Basiliano | essenziale | altro: nessun momento lo ammette | categorie [-], tipo nessuno |
| Torre Capitania | essenziale | chiuso all'orario | mattina: chiuso all'arrivo; pomeriggio: chiuso all'arrivo |
| Piazza Conte Ruggero | da locale | regola delle zone | per Google è una via (route) senza altro tipo |
| La Contea dei Normanni | da locale | non scelto | pranzo: fuori strada (9 min); cena: oltre il tetto di cammino (22 min) |

### Trastevere

Imbuto: **16 proposti → 16 trovati da Google → 13 nel pool → 3 scelti dal selettore → 7 nel tour.**

Nel tour: Colosseo (09:30 mattina); Foro Romano (14:30 pomeriggio); Pantheon (16:53 pomeriggio); Fontana di Trevi (15:44 pomeriggio); Basilica di San Pietro in Vincoli (10:05 mattina); Sant'Eustachio Caffè (18:00 aperitivo); La Taverna dei Fori Imperiali (12:30 pranzo).

| Posto perso | Tipo | Causa | Dettaglio |
|---|---|---|---|
| Basilica di San Pietro | essenziale (simbolo) | oltre il tetto di cammino C5c | mai fra i primi 15 del momento; nel giro B, dove compare, «oltre il tetto di cammino (30 min)» (dedotto per gli altri giri) |
| Musei Vaticani | da locale | fuori dal quartiere | quartiere Prati e Borgo; area del giro: Centro + Monti |
| Castel Sant'Angelo | da locale | non scelto | mai fra i primi 15 del suo momento (mattina,pomeriggio) |
| Piazza Navona | da locale | non scelto | mattina: merito e strada minori (a pari regole) (12 min); pomeriggio: fuori strada (19 min); passeggiata: famiglia gia' presente nel giorno (piazza) (3 min) |
| Chiesa di San Luigi dei Francesi | da locale | non scelto | mattina: merito e strada minori (a pari regole) (11 min); pomeriggio: famiglia gia' presente nel giorno (chiesa) (17 min) |
| Piazza di Spagna | da locale | non scelto | mattina: merito e strada minori (a pari regole) (16 min); pomeriggio: fuori strada (19 min); passeggiata: famiglia gia' presente nel giorno (piazza) (13 min) |
| Mercato Trionfale | da locale | fuori dal quartiere | quartiere Prati e Borgo; area del giro: Centro + Monti |
| Hostaria Dino e Tony | da locale | fuori dal quartiere | quartiere Prati e Borgo; area del giro: Centro + Monti |
| Blackmarket Hall - Rione Monti | da locale | non scelto | cena: pari: lo scelto viene prima (modello o ordine) (8 min) / anche chiuso: pranzo (chiuso all'arrivo) |

### Troina, mezza giornata

Imbuto: **7 proposti → 7 trovati da Google → 6 nel pool → 1 scelto dal selettore → 2 nel tour.**

Nel tour: Convento di Sant'Agostino (09:30 mattina); Via Conte Ruggero (09:56 mattina).

| Posto perso | Tipo | Causa | Dettaglio |
|---|---|---|---|
| Chiesa Madre di Maria Santissima Assunta | essenziale (simbolo) | chiuso all'orario | mattina: chiuso all'arrivo |
| Chiesa di San Silvestro Monaco Basiliano | essenziale | altro: nessun momento lo ammette | categorie [-], tipo nessuno |
| Torre Capitania | essenziale | chiuso all'orario | mattina: chiuso all'arrivo |
| Piazza Conte Ruggero | da locale | regola delle zone | per Google è una via (route) senza altro tipo |
| La Contea dei Normanni | da locale | non scelto | pranzo: pari: lo scelto viene prima (modello o ordine) (9 min) |

Nelle liste di Roma ogni quartiere ha il suo simbolo, quindi «simbolo» accanto a San Pietro vuol dire simbolo di Prati e Borgo.

## 2) Le cause, con i totali su tutti i tour

Sigle: CT Catania, RM Roma neutra, RA Roma A, RB Roma B, NA Napoli, PA Palermo, LE Lecce, TR Troina giornata, TV Trastevere, TM Troina mezza.

| Causa | Posti persi | di cui essenziali | Dove |
|---|---|---|---|
| non scelto | 38 | 0 | CT 1, RM 3, RA 5, RB 4, NA 6, PA 6, LE 6, TR 1, TV 5, TM 1 |
| fuori dal quartiere | 12 | 0 | RM 3, RA 3, RB 3, TV 3 |
| regola delle zone | 9 | 0 | CT 2, NA 1, PA 2, LE 2, TR 1, TM 1 |
| tetto visite C8 | 6 | 1 | CT 4, PA 2 |
| chiuso all'orario | 6 | 5 | CT 1, PA 1, TR 2, TM 2 |
| oltre il tetto di cammino C5c | 6 | 4 | RM 1, RA 1, RB 1, NA 2, TV 1 |
| altro: sostituito dopo la scelta | 4 | 0 | CT 1, RM 1, RB 1, PA 1 |
| altro: nessun momento lo ammette | 4 | 2 | CT 1, NA 1, TR 1, TM 1 |
| altro: vincoli del profilo (P7b) | 3 | 0 | RA 2, RB 1 |
| altro: merito anti-ovvio | 3 | 3 | NA 2, LE 1 |
| **Totale** | **91** | **15** | 51 posti della lista entrano nei tour |

### Cosa c'è dentro le cause

- **Non scelto (38).** I 38 si dividono così:
  - **23 luoghi da visitare** perdono il confronto «merito e strada minori» in mattina, e nel pomeriggio risultano «fuori strada» o di una famiglia già presente.
    - In quasi tutti i casi il loro momento finisce con un buco di tempo libero.
    - Il posto c'era ed era aperto; mancava il posto in agenda (vedi §3).
  - **12 locali** (pranzo, cena, bar): un altro locale è stato scelto, e un pasto è uno solo.
  - **2** perdono per varietà.
  - **1** non è mai fra i primi 15: Castel Sant'Angelo a Trastevere.
- **Fuori dal quartiere (12).** Musei Vaticani, Mercato Trionfale e Hostaria Dino e Tony, in tutti e 4 i giri di Roma.
  - Il giro sta in «Centro + Monti».
  - Prati e Borgo ha un essenziale, ma è a 2,4 km dalla partenza.
- **Regola delle zone (9).** Piazza del Duomo (Catania e Lecce), Via Etnea, Piazza Pretoria, Piazza Marina, Piazza Sant'Oronzo, Via San Biagio dei Librai, Piazza Conte Ruggero (in entrambi i giri di Troina).
  - Google le registra come `route` senza altro tipo, e `zoneReason` le toglie.
  - Sono proprio le «piazze e vie storiche» che la quota di C10b3-bis chiede alla lista (2–3).
  - Fanno eccezione Via Etnea a Catania, Piazza Sant'Oronzo a Lecce e Via Conte Ruggero a Troina, che nel giro entrano per un'altra strada:
    - Via Etnea e Piazza Sant'Oronzo entrano con un altro place_id trovato dalle ricerche;
    - Via Conte Ruggero è la via principale del borgo, esente dalla regola.
- **Sostituito dopo la scelta (4).** Il riparatore lo sceglie, ma il giro finale non lo ha: la rifinitura del percorso (`polishRoute`) lo cambia con un altro posto.
  - Museo Vincenzo Bellini → Palazzo dei Chierici.
  - Piazza Navona (Roma neutra).
  - Villa Giulia.
  - Blackmarket Hall (Roma B).
- **Nessun momento lo ammette (4).**
  - **Pasticceria Savia** e **Scaturchio**: sono colazioni, e la colazione non era chiesta. La mattina non ha la categoria cibo, e un dolce non ha categoria di momento.
  - **San Silvestro Monaco Basiliano** (Troina): per Google non ha né tipi né tipo principale, quindi nessuna categoria.
- **Vincoli del profilo (3).**
  - La Taverna dei Fori Imperiali e Blackmarket Hall per Roma A (vegetariano): un posto dove mangiare resta solo se lo trova una ricerca con la dieta.
  - La Taverna per Roma B (budget €).
- **Merito anti-ovvio (3).** Castel Nuovo, Certosa di San Martino, Cattedrale di Lecce.
  - Sono essenziali ma non diventano ancore, per la regola «un'ancora per famiglia»: Sansevero a Napoli è già un museo, Santa Croce a Lecce è già una chiesa.
  - Passano quindi al Gate MERITO, e lì restano fuori.
  - Il tracciato non dice se per il tetto di un'icona, il limite dei 20 o la soglia. Tutti e tre sono molto recensiti, quindi probabilmente il tetto di un'icona.
  - **Castel Nuovo è il simbolo accettato di Napoli, ed è l'unico simbolo scelto dall'AI**, per il quartiere San Ferdinando.
    - La lista è da metropoli: un simbolo per quartiere. Quelli di Centro storico (Sansevero) e di Vomero (Certosa) li ha **dedotti il codice**.
    - Il motore conferma Napoli «città» (1,35 km), ma i simboli per quartiere restano.
    - `poolConLista` mette i simboli davanti senza distinguere quelli dedotti, e Sansevero viene prima nella lista: prende la famiglia museo.
    - **Il simbolo vero della città esce dal pool** (tracciato `citta.simboli`: Sansevero «dedotto», Castel Nuovo no).

## 3) Il tempo libero: ogni buco oltre 20 minuti

**I candidati che il pool del momento aveva, e se erano aperti nel buco**, vengono dal tracciato (al massimo 15 per momento) e dagli orari settimanali salvati dal banco. Li ho controllati con `openStatus`.

**«Visite» sono i posti di mattina e pomeriggio dello scheletro.** Lo scheletro parte da 2 per momento; il riempimento dei buchi (`fillGaps`) ne aggiunge uno alla volta, fino al tetto di 8.

| Tour | Fascia | Min | Visite | Causa | Perché non c'era un posto |
|---|---|---|---|---|---|
| Catania | 11:22–12:28 | 66 | 8/8 | **tetto visite C8** | Museo Vincenzo Bellini a 1 min, San Nicolò l'Arena a 6 min, Piazza Università a 3 min, tutti aperti. Il riempimento si ferma: `momentsToExpand` torna vuoto con 8 visite |
| Catania | 17:11–17:59 | 48 | 8/8 | **tetto visite C8** | Villa Bellini a 13 min, San Nicolò a 7 min, aperti |
| Palermo | 11:21–12:26 | 65 | 8/8 | **tetto visite C8** | Teatro Massimo a 12 min, Palazzo Abatellis a 9 min, Quattro Canti a 4 min, aperti |
| Roma neutra | 10:25–12:25 | 120 | 6/8 | **riempimento respinto** | Aperti: Piazza d'Aracoeli a 4 min, Belvedere Tarpeo a 9 min, San Luigi dei Francesi a 9 min, tutti di famiglia nuova per la mattina. Il tentativo di una terza tappa (4 tentativi, 2 riusciti nel pomeriggio) è respinto da uno dei criteri «non peggiora niente» di `fillGaps`; **quale, il tracciato non lo dice** |
| Trastevere | 10:25–12:25 | 120 | 6/8 | **riempimento respinto** | Come Roma neutra (stesso giro): Aracoeli a 1 min, Tarpeo a 5 min, aperti |
| Roma A | 10:45–12:20 | 95 | 5/8 | **riempimento respinto** | Aperti: Piazza Navona a 6 min, Piazza d'Aracoeli a 7 min, Foro Romano a 13 min |
| Roma B | 10:41–12:23 | 102 | 5/8 | **riempimento respinto** | Aperti: Piazza d'Aracoeli a 5 min, Foro Romano a 11 min, Piazza Farnese a 10 min |
| Napoli | 11:01–12:28 | 87 | 4/8 | **riempimento respinto** | Aperti: Duomo a 15 min (famiglia nuova), Piazza del Gesù Nuovo e Piazza Dante a 4 min. 2 tentativi, 0 riusciti |
| Roma A | 16:01–17:58 | 117 | 5/8 | **varietà, strada, tetto** | Navona (piazza, famiglia già presente con Piazza Farnese); Aracoeli e Campidoglio «fuori strada»; Piazza Colonna a 22 min; Spagna e Trinità oltre il tetto (30–31 min); Foro Romano chiude alle 16:30 |
| Roma B | 15:55–17:57 | 122 | 5/8 | **strada (deviazione)** | Tutti i candidati rimasti sono «fuori strada» (Aracoeli, Farnese, Trinità dei Monti, Spagna); il Foro Romano chiude alle 16:30 |
| Napoli | 15:26–17:46 | 140 | 4/8 | **varietà, strada, tetto** | Castel Sant'Elmo e Palazzo Reale: museo già presente. Plebiscito e Dante: piazza già presente. Duomo «fuori strada». Villa Floridiana a 25 min |
| Lecce | 11:03–12:27 | 84 | 5/8 | **varietà** (dedotto) | Le tre chiese della lista (Santa Chiara a 0 min, San Matteo a 2, Santa Irene a 3), aperte, ma la famiglia chiesa c'è già con Santa Croce; Piazza Mazzini «toglie l'unica alternativa a un momento dopo» |
| Lecce | 16:09–17:54 | 105 | 5/8 | **varietà** | Le stesse chiese («famiglia già presente») e Piazza Mazzini |
| Troina | 10:34–12:28 | 114 | 4/8 | **orari all'inizio del momento** | **Chiesa Madre (aperta 10:30–12:30) e Torre Capitania (10:00–12:30) tolte dal bucket della mattina perché chiuse alle 09:30.** L'unico altro candidato è il Ponte di Failla a 37 min (oltre il tetto) |
| Troina | 15:35–17:51 | 136 | 4/8 | **orari all'inizio del momento** | **Torre (16:30–19:00) e Chiesa Madre (17:00–20:00) tolte perché chiuse alle 14:30**; Ponte di Failla a 38 min |
| Troina mezza | 11:00–12:25 | 85 | 3/8 | **orari all'inizio del momento** | Chiesa Madre e Torre tolte alle 09:30; nel pool non resta nessun altro luogo da visitare |

**Totali.**

| Causa | Minuti | Buchi |
|---|---|---|
| Riempimento respinto | 524 | 5 |
| Varietà, strada, tetto | 568 | 5 |
| Orari all'inizio del momento | 335 | 3 |
| Tetto visite C8 | 179 | 3 |
| **Totale** | **1.606** | **16** |

**Due cose valgono per tutti i buchi.**

1. **Lo scheletro parte da 2 tappe per una mattina di 3 ore** (`stopsFor`: 2 da 180 minuti in su).
   - Le soste C6a sono di 20–60 minuti (Colosseo 30, una chiesa 20).
   - Due tappe lasciano circa due ore vuote, e tutto il resto lo deve fare `fillGaps`, una tappa alla volta.
   - `fillGaps` accetta una tappa in più solo se il giro non ha né un ripiego, né una riga di tempo libero, né una tappa tolta in più, e se scendono i minuti di buco. Al primo giro senza tentativi riusciti si ferma.
2. **I criteri «non peggiora niente» non lasciano traccia del motivo per cui un tentativo è respinto** (`continuita` ha solo aggiunte e tentativi).
   - Per i 5 buchi «respinti» ho la prova che c'erano posti aperti di famiglia nuova a pochi minuti, ma non il criterio che ha fermato il tentativo.
   - L'ipotesi più probabile è un ripiego in più: la nuova tappa sposta un posto da un momento all'altro, e il momento che lo perde ripiega. **È un'ipotesi: non l'ho verificata.**

## 4) I posti persi perché chiusi: si potevano spostare?

| Tour | Posto | Dove e quando è stato tolto | Orari del 15/10 (giovedì) | Aperto in un altro momento (o più tardi nello stesso)? |
|---|---|---|---|---|
| Troina giornata | Chiesa Madre (simbolo) | mattina, alle 09:30; pomeriggio, alle 14:30 | 10:30–12:30, 17:00–20:00 | **Sì**: nella stessa mattina dalle 10:30 (il buco è 10:34–12:28) e nello stesso pomeriggio dalle 17:00 (buco fino alle 17:51; sosta 20 min) |
| Troina giornata | Torre Capitania | mattina 09:30; pomeriggio 14:30 | 10:00–12:30, 16:30–19:00 | **Sì**: mattina dalle 10:00, pomeriggio dalle 16:30 (sosta 60 min, ci sta fino alle 17:30) |
| Troina mezza | Chiesa Madre (simbolo) | mattina 09:30 | 10:30–12:30 | **Sì**: dalle 10:30, nella stessa mattina (buco 11:00–12:25) |
| Troina mezza | Torre Capitania | mattina 09:30 | 10:00–12:30 | **Sì**: dalle 10:00 |
| Palermo | Teatro Massimo (ancora) | seminata nel pomeriggio, vietata: «chiuso quando ci si arriva (orario del giro)» | 09:30–15:30 | **Sì, la mattina**, ma la mattina aveva già 2 ancore su 2 posti (`seminaAncore` non ne mette più delle tappe del momento), e più tardi il giro è arrivato a 8 visite |
| Catania | Pescheria | pomeriggio, alle 14:30 | 07:00–14:00 | **Sì, la mattina**, ma la mattina non ammette un mercato (categoria `shopping`, solo pomeriggio) e il giro era a 8 visite |

**Il punto.** `applyOpeningToBuckets` toglie dal bucket un posto chiuso **all'inizio del momento** (09:30, 14:30). Il commento del codice lo dice: «il primo filtro usa l'inizio del momento».
- Un posto che apre alle 10:00 sparisce dall'intera mattina, anche quando la mattina ha due ore vuote.
- Per Troina è tutto: le due ancore non arrivano mai a `seminaAncore`, che le declassa, quindi `ancoreEsito` resta vuoto.

**Altri posti chiusi in un momento ma persi per un'altra causa** (aperti in un altro momento):
- Martorana, Orto Botanico e Santa Caterina a Palermo: chiusi alle 09:30, aprono alle 10:00.
- San Pietro in Vincoli a Roma, chiuso alle 14:30.
- San Francesco di Paola a Napoli, chiuso alle 14:30.
- Santa Irene a Lecce, chiusa il pomeriggio.
- Osteria della Mattonella a Napoli: chiusa alle 12:30, apre alle 12:45.
- Ai Cascinari e Blackmarket Hall: chiusi a pranzo.

## 5) Trastevere

**Causa esatta: la lista, e il riconoscimento che dipende dalla lista.** La lista dedicata del quartiere, di conseguenza, non parte.

1. **La lista `c10b-7` di Roma del 15/10 ha i quartieri Monti, Centro, Prati e Borgo.** Trastevere non c'è.
2. **Riconoscimento.** `scegliQuartiere` (`src/lib/cityKnowledge.js:207`) cerca il nome nel testo **solo fra i quartieri della lista** (`quartieriDallaLista(poi)`).
   - «Trastevere» non è fra quelli, quindi `nominato` resta vuoto.
   - Il motore sceglie il quartiere con più ancore aperte, il più vicino a parità: Centro, poi Monti per il pomeriggio. È quello che dice il tracciato.
3. **La lista dedicata non parte.** `fetchQuartiereKnowledge` parte solo con `motivo === 'nominato nella richiesta'` (`aiRecommendationService.js`, ramo metropoli).

**La differenza con C10b2**, dove Trastevere era verde (grezzo `dati/2026-10-17-banco-esteso-c10.json`, stesso giorno 15/10):
- La lista era la `c10b-4`, con i quartieri Testaccio, **Trastevere**, Monti.
- Il quartiere era riconosciuto («nominato nella richiesta») con 2 luoghi da visitare. Sotto i 3 parte la lista dedicata, che ne verificò 7.
- Il codice del riconoscimento è lo stesso. **È cambiata la lista.**
- Con la variante C la lista parte dagli imperdibili e i quartieri seguono gli imperdibili; Trastevere non ne ha. **È una deduzione**: il prompt non dice come scegliere i quartieri, e non l'ho provato.

**In produzione (client di main `8d3fe89` + proxy v23): sì, la stessa richiesta ignora Trastevere.** Lo dico leggendo il codice, senza tour:
- Il proxy v23 serve la lista `c10b-7`. Per Roma del 15/10 è la riga già salvata, quella del giro.
- Il client di main ha la stessa `scegliQuartiere`: nessuna differenza fra `8d3fe89` e `9babc43` in quella funzione.
- Ha lo stesso ramo della lista dedicata (`aiRecommendationService.js:2467` su main) e lo stesso filtro del pool sull'area (`:2504`).
- Cambiano solo le ricerche iniziali, che su main partono dal centro della città e non dal quartiere. Poi il filtro dell'area toglie comunque ciò che sta fuori da Centro + Monti.
- Vale per ogni giorno la cui lista non abbia un quartiere chiamato Trastevere. Vale anche per un giorno in cui Roma è confermata «città» (come il 16/10): lì non c'è nessun quartiere.

## 6) Troina

**Perché nessuna ancora entra nel giro.**
- Le ancore candidate sono la Chiesa Madre (simbolo) e Torre Capitania.
- `seminaAncore` mette un'ancora solo in un momento il cui bucket la contiene. Il bucket arriva dopo il filtro degli orari, che guarda l'inizio del momento:
  - **mattina, 09:30**: Chiesa Madre apre alle 10:30, Torre alle 10:00 → «chiuso all'arrivo»;
  - **pomeriggio, 14:30**: Chiesa Madre apre alle 17:00, Torre alle 16:30 → «chiuso all'arrivo».
- Nessun momento le ammette, quindi tutte e due finiscono in `declassate`, e `ancoreEsito` resta vuoto. Lo stesso nella mezza giornata, che ha solo la mattina.
- Gli altri due essenziali:
  - **San Silvestro** non ha tipi Google, quindi nessuna categoria di momento;
  - **Sant'Agostino** entra nel giro (14:30 nella giornata, 09:30 nella mezza), ma come essenziale al merito, non come ancora: un'ancora per famiglia, e la famiglia chiesa è già presa dalla Chiesa Madre.

**Perché resta tempo libero (250 e 85 min) nonostante «la durata segue le tappe».**
- Quella regola (`durataBorgoCorto`, dentro `fasciaApertaBorgo`) vale **solo se i posti della lista utilizzabili sono meno di 4** (`BORGO_MIN_VERIFICATI`).
- Utilizzabili = verificati meno la via principale e meno le zone. A Troina sono **5**:
  - Chiesa Madre, San Silvestro, Torre, Sant'Agostino;
  - **La Contea dei Normanni, che è un ristorante**.
- Quindi il giro è di una giornata intera con lo scheletro normale, e la mezza giornata chiesta usa la finestra di 240 minuti dalle 09:30. Non c'è né la fascia aperta né la durata corta.
- I buchi restano perché il pool, tolte le ancore per gli orari, non ha altri luoghi da visitare entro il tetto di cammino: l'unico è il Ponte di Failla, a 37 minuti.
- Nella mezza giornata il riempimento aggiunge una tappa (Piazza Matteotti) e si ferma.
- **Di San Silvestro e del ristorante:** il conto degli utilizzabili include un posto che nessun momento ammette e un ristorante. Due dei 5 «posti del borgo» non sono luoghi da visitare. Con il conto dei soli luoghi da visitare ammessi in un momento, Troina avrebbe 3 posti, sotto la soglia, quindi giro corto nella fascia aperta.

## 7) Proposte (nessuna applicata), ordinate per effetto stimato

Le stime sono sui 10 tour di questa fase B, un campione per tour.

| # | Correzione | Effetto stimato | Rischi | Tocca |
|---|---|---|---|---|
| 1 | **Riempimento meno rigido**, in due passi: (a) scrivere nel tracciato il criterio che respinge ogni tentativo di `fillGaps`, senza cambiare il comportamento; (b) con un buco oltre 60 min, accettare la tappa anche se porta un ripiego di varietà (una famiglia ripetuta), mai uno di cammino | Fino a 524 min nei 5 buchi «respinti» e parte dei 568 di varietà; **stima: 5–9 tappe**. Prima del passo (b) serve (a), per sapere quale criterio scatta | Tappe di famiglia ripetuta (due piazze, due chiese) | CONTINUITÀ e varietà; **non** C5c se il cammino resta nel tetto |
| 2 | **Lo scheletro parte da 3 tappe per mattina e pomeriggio** in una giornata intera con ritmo normale (oggi 2 da 180 min) | Simile alla 1, sullo stesso gruppo di buchi; il primo giro di scelta vede già 3 posti, senza i criteri di `fillGaps` | Più cammino; un pomeriggio con 3 tappe deve stare in 3 ore e mezza con le soste C6a | Scheletro (ritmo); C8 resta (3+3 = 6 visite) |
| 3 | **Orari: un posto resta nel bucket se è aperto per una sosta intera in un punto qualsiasi del momento**, non solo all'inizio. Il controllo vero resta `settleOpeningHours` sull'orario del giro, che fa aspettare l'apertura dentro il momento | Troina: Chiesa Madre e Torre entrano (+2 ancore nella giornata, +2 nella mezza), circa 80 min occupati per giro sui 250/85; Palermo: Martorana, Orto Botanico, Santa Caterina tornano candidati la mattina; **335 min di buco toccati, +4 tappe** | Il giro può mettere il posto prima che apra; serve che l'ordine del momento lo porti dopo l'apertura, altrimenti `settleOpeningHours` lo vieta e si ripete il giro | **ORARI** (il modo, non la regola «aperto per tutta la sosta») |
| 4 | **Tetto visite: non contare come visita piena le soste corte all'aperto** (piazze, fontane: 30 min), oppure 10 visite invece di 8 | Catania e Palermo: 179 min, **+3 tappe** (candidati aperti a 1–13 min) | Giornate più dense; il tetto nasce per non stancare | **C8** |
| 5 | **Un quartiere chiesto che non è nella lista** (Trastevere): riconoscerlo dal testo anche fuori dalla lista (un nome verificato da Google come `neighborhood`/`sublocality` nella città) e far partire la lista dedicata | Trastevere torna a Trastevere (1 tour su 10); nessun minuto in sé | Una chiamata Google e una lista AI in più (circa 40 s la prima volta del giorno, 0,05–0,10 $); falsi quartieri («via Trastevere» in un'altra città) | — |
| 6 | **Borgo: contare fra gli utilizzabili solo i luoghi da visitare ammessi in un momento** (né ristoranti, né posti senza tipi) | Troina scende a 3 utilizzabili: giro corto nella fascia aperta (`fasciaApertaBorgo`), quindi i 250/85 min diventano un giro di 2–3 tappe senza tempo libero aggiunto | Un borgo con 4 posti di cui un ristorante diventa «corto» | — |
| 7 | **Piazze e vie storiche della lista che Google chiama `route`**: farle entrare come passeggiata (come la via principale del borgo) anche in città e metropoli | 9 posti della lista recuperabili come passeggiata serale o tappa breve; pochi minuti (la passeggiata è una sola) | Una «via» qualunque come tappa | **C7** (zone) |
| 8 | **Gli essenziali che non diventano ancore per la regola della famiglia** non vanno al Gate MERITO ma restano «da locale» (davanti e fuori merito) | Castel Nuovo, Certosa, Cattedrale di Lecce nel pool (+3 candidati); 0 minuti diretti | Più posti molto recensiti nel pool | Merito anti-ovvio fuori dalle ancore |
| 8b | **Il simbolo scelto dall'AI prima di quelli dedotti** nell'ordine delle ancore (`poolConLista`) | Napoli: Castel Nuovo (simbolo accettato) diventa la prima ancora al posto di Sansevero; 1 essenziale | Nessuno evidente; Sansevero resta un candidato | — |
| 9 | **La rifinitura non toglie un posto della lista** per uno che non lo è, a pari tratto | 4 posti della lista restano (Museo Bellini, Piazza Navona, Villa Giulia, Blackmarket) | Percorso un po' più lungo | — |
| 10 | **Mercato la mattina**: categoria della mattina anche per un mercato (`shopping`) | Pescheria di Catania (aperta 07:00–14:00), Mercato Trionfale fuori dal quartiere; 1 posto | I mercati serali o del pomeriggio non cambiano | Categorie dei momenti |

Fuori classifica, perché toccano testi e durate decise:
- la sosta del Colosseo (30 min, tipo generico) e delle icone;
- la colazione non chiesta (pasticcerie della lista mai usabili).

Le segnalo senza stima.

## Cosa ho dato per vero senza verificarlo

1. **Un tour per caso.** Le cause valgono per questi 10 giri del 15/10; un altro giorno (un'altra lista) può dare altre cause.
2. **I «minuti» del pool** sono quelli del momento in cui il motore ha registrato la classifica, misurati dal suo punto di riferimento, non dalla tappa prima del giro finale. Li ho usati come indicazione di distanza, non come cammino esatto.
3. **Il tracciato registra al massimo 15 candidati per momento.** «Mai fra i primi 15» vuol dire solo che non era fra quei 15.
4. **Gli orari** del controllo «aperto nel buco» sono quelli settimanali salvati dal banco (senza gli orari del giorno). Il 15/10 è un giovedì non festivo e non ho trovato giorni speciali, ma non l'ho controllato posto per posto.
5. **Basilica di San Pietro «oltre il tetto di cammino»**: è scritto solo nel giro B (30 min); negli altri tre giri di Roma è dedotto.
6. **Il criterio che respinge i tentativi di `fillGaps`** (5 buchi, 524 min) non è nel tracciato. «Un ripiego in più» è un'ipotesi.
7. **I due buchi di Lecce «per varietà»**: il motivo registrato per le chiese è «merito e strada minori» contro lo scelto. Che il tentativo di aggiungerne una sia caduto sulla famiglia ripetuta lo deduco dal criterio, non dal tracciato.
8. **Il Gate MERITO su Castel Nuovo, Certosa e Cattedrale di Lecce**: il tracciato dice «non ammesso», non quale dei tre filtri (tetto icone, limite 20, soglia).
9. **Il simbolo di Napoli.** Che Sansevero passi davanti a Castel Nuovo per l'ordine della lista, a parità di «simbolo», lo leggo dal codice di `poolConLista` (ordinamento solo su `simbolo`) e dal tracciato. Non l'ho riprodotto.
10. **Perché la lista `c10b-7` non ha Trastevere**: deduzione dalla variante C (quartieri attorno agli imperdibili), non provata.
11. **La produzione** (main + v23) l'ho letta nel codice, non provata dall'app pubblicata.
12. **Le stime delle proposte** sono fatte a mano dai buchi e dai candidati di questi tour, non da un giro.

**Strumenti usati, tutti a 0 $:**
- due script fuori dal repo (nella cartella temporanea della sessione), che fanno girare le funzioni del motore sui dati salvati;
- una `select` su `city_knowledge` per i tipi e gli orari dei posti della lista.

Nessun file del repo è cambiato, tranne questo report.
