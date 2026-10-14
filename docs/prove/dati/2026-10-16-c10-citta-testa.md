# C10 — l'AI conosce la città, Google verifica, le regole compongono

Verifiche iniziali: cartella `~/unnivai-1b`, HEAD `7799442`, suite verde (1920). Il lavoro interrotto di VERITÀ-PRE-GIRO (meteo fatto, saluto e c13 no) è sul ramo locale `wip/verita-pre-giro`, non pubblicato. Account di prova, credenziali solo da `.env.local`, mai stampate. Giro sul codice finale: 11 tour, 6 liste, ora simulata mercoledì 14/10 22:19 (tour per giovedì 15/10), ricerca nuova (`engine=new`, come in produzione).

## In breve

- **La lista c'è e funziona come chiesto:** una per città e per giorno, uguale per tutti; l'AI propone 15 posti, Google li verifica uno per uno, entrano solo i verificati, il «perché» non esce dal server. Al primo tour del giorno nasce, gli altri la leggono (0,7–1,7 s).
- **Conosce la città: 🟢 in 7 tour su 11** (Catania ×4, Palermo, Lecce, Troina). Prima (C9): nessun essenziale in nessuna città. Roma e Napoli restano 🔴: le ancore ci sono, ma il **tetto di cammino** (20 min) ne tiene una o due per giornata (Colosseo e Vaticano sono lontani fra loro).
- **Giornata piena: 🔴 in tutti gli 11.** Il tempo libero scende (Catania 264 → 54–125 min; Palermo 46 min) ma non arriva a 45 in nessun tour.
- **Su misura: 🔴** (Catania 42%, Roma 44% di tappe diverse, serve 50%): le ancore e la lista sono le stesse per i due profili.
- **Invenzioni: 0% a Roma, Napoli, Palermo; 13% a Lecce; 21% a Catania; 73% a Troina** (l'AI non conosce un borgo: nomi generici che Google trova in altri paesi a 38–146 km).
- **Costo:** primo tour della giornata 0,74–0,84 $ (obiettivo 0,60: **non raggiunto**, la verifica di 15 nomi costa 0,525 $ al listino); gli altri 0,19–0,26 $ (Roma 🟢, Catania 🔴 di 5 centesimi).
- **Tempo:** primo tour +2,5…+12,3 s rispetto ai 21,2 s di oggi (la lista nuova si aspetta 8–12 s); con la lista dal server 17,8–23,0 s (🟢).
- **I controlli di sempre (c1–c13): tutti 🟢 su tutti gli 11 tour.**
- **Spesa del task: 5,495 $** al listino (prova 0,632 + giro 4,863): **ho superato la soglia di stop (5,4 $) di 0,095 $**, sotto il tetto di 6 $. Dettagli in «Spesa».

## Come è fatto (e perché così)

1. **Conoscenza della città — una chiamata AI per città e giorno, nel proxy esistente.** `openai-proxy` riceve `dv: { purpose: 'city_list', citta, giorno }` e **il prompt lo scrive il proxy** (`supabase/functions/openai-proxy/cityKnowledge.ts`): il client non manda testo, nessuno può riscrivere la lista degli altri. Se la lista del giorno c'è, la restituisce senza chiamare OpenAI e senza quota; altrimenti consuma una chiamata di contorno, chiama OpenAI (`gpt-4o-mini`, JSON, temperatura 0,2), verifica, salva.
2. **Verifica su Google — sul server, con places-proxy.** Ogni nome: `place/textsearch` «nome, città», con il centro della città (la stessa `findplacefromtext` del client) e il raggio massimo del motore (20 km città, 12 km borgo) come bias: **stessa ricerca, stessa maschera di campi, stessa cache condivisa** del motore. Entra solo se: trovato; nome compatibile (le parole che contano del nome più corto stanno quasi tutte nell'altro, senza articoli e senza il nome della città; un nome fatto solo di parole generiche deve combaciare tutto); dentro il raggio; non `CLOSED_PERMANENTLY`. Gli scartati restano col motivo.
3. **Condivisione — una tabella nuova, `public.city_knowledge`** (città, giorno, versione del prompt; proposti con il perché, verificati, scartati, costo). **Perché non la cache di places-proxy:** quella tiene risposte di Google per 24 ore dalla scrittura, per chiave di ricerca; la lista è una risposta dell'AI *più* la verifica, per città e *giorno del tour*, e deve restare una sola anche quando due utenti la chiedono insieme (vince la prima scritta: `upsert … ignoreDuplicates`, poi si rilegge). RLS attiva, **nessuna policy**: la leggono e scrivono solo le funzioni con la chiave di servizio.
4. **Merito — decisione di Ivano su P7a** (`src/lib/cityKnowledge.js`, `momentSelection.bonusLista`). I verificati entrano nel pool come risultati di ricerca e passano per **tutti i filtri di sempre** (zone, raggio, categoria, dieta e budget, cucine estere col tipico). Poi: i posti «da locale» e gli essenziali candidati ad ancora stanno **davanti e fuori dal merito** (non contano nel limite dei 20 né nel tetto delle icone); gli altri essenziali tornano al merito anti-ovvio. **Le ancore vere si scelgono alla semina**: al massimo 3 per giornata intera (1 per mezza), una per famiglia, mai un locale, solo se un momento le ammette (aperte, categoria giusta); vengono proposte al riparatore come scelte del modello, in testa al loro momento, e **valgono solo se nessuna alternativa costa meno per le regole** (cammino, varietà, orari, percorso C5c). Quelle che non entrano perdono la priorità.
5. **Personalizzazione:** interessi, dieta e DNA arrivano al selettore come prima; nessuna chiamata AI in più per utente (la lista si paga una volta al giorno per città).

**Deployato:** migrazione `20261016_c10_city_knowledge` (con `apply_migration`, mai `db push`); `openai-proxy` **versione 16** (due deploy: 15 col primo prompt, 16 col prompt corretto). `places-proxy` **non toccato**. Prima del deploy ho confrontato la versione in produzione (14) con il repo: uguali.

## Il prompt (versione `c10-2`, esempio per Catania)

```
SYSTEM:
Sei una persona nata e cresciuta a Catania che conosce la sua città strada per strada.
Ti chiedono quali posti di Catania vivere giovedì 15 ottobre 2026: i simboli che non faresti mai saltare a un amico in visita, e i posti dove va davvero chi ci abita.

Rispondi SOLO con un JSON, senza testo fuori:
{"posti":[{"nome":"...","citta":"Catania","momento":"colazione|mattina|pranzo|pomeriggio|aperitivo|cena|dopocena","tipo":"essenziale|da locale","perche":"...","giorni":"...","orari":"..."}]}

REGOLE
- Esattamente 15 posti, tutti dentro Catania (non nei paesi intorno).
- "nome": il nome proprio esatto del posto, come compare su Google Maps. Niente indirizzi, niente descrizioni, niente zone generiche ("centro storico", "lungomare" senza nome).
- "tipo" "essenziale" (da 3 a 4): i luoghi simbolo da vedere a Catania — monumenti, cattedrale e chiese, musei, castelli, teatri, piazze, strade storiche, mercati storici, giardini — anche se sono famosi. Un essenziale non è MAI un bar, un caffè, una pasticceria, un ristorante o un locale.
- "tipo" "da locale": tutti gli altri — dove va davvero chi ci abita: la colazione, il mercato, la trattoria, il bar dell'aperitivo, il posto del dopocena, un angolo che i turisti non conoscono.
- Se esistono a Catania, devono esserci: una colazione vera (il bar o la pasticceria dove i locali fanno colazione, momento "colazione"); un mercato, con i suoi giorni e orari nei campi "giorni" e "orari"; cosa fa un locale dopo cena (momento "dopocena").
- "momento": quando quel posto si vive meglio. Copri la giornata: colazione, mattina, pranzo, pomeriggio, aperitivo, cena, dopocena.
- Solo posti aperti giovedì 15 ottobre 2026: un mercato che quel giorno non c'è, o un posto chiuso quel giorno, non va in lista.
- Niente catene, niente posti chiusi per sempre, niente posti inventati: se non sei sicuro che un posto esista con quel nome, non scriverlo.
- "perche": una riga, al massimo 90 caratteri, il motivo per cui un locale ci va.
- "giorni" e "orari" solo per i mercati; per gli altri posti ometti i due campi.

USER:
Città: Catania. Giorno: giovedì 15 ottobre 2026.
```

Il primo prompt (`c10-1`, girato una volta su Catania) diceva solo «i posti che chi è di Catania non salterebbe mai portando un amico»: il modello ha dato come essenziali un caffè, una pasticceria e due mercati, e **nessun monumento**. La versione `c10-2` dice cosa è un essenziale e che non è mai un locale; in più il codice non fa mai ancora un locale.

## Le 6 liste (giovedì 15/10, versione `c10-2`)

Formato: nome proposto (tipo, momento) → nome su Google, oppure **scartato: motivo**. ⚓ = ancora seminata nel tour neutro.

**Catania — 14 proposti, 11 verificati, 3 scartati.** Piazza del Duomo (essenziale, mattina) → Piazza del Duomo · Castello Ursino (essenziale, mattina) → Castello Ursino ⚓ · Teatro Massimo Bellini (essenziale, mattina) → Teatro Massimo Bellini · Mercato del pesce (da locale, mattina; lun–sab 5:00–14:00) → Storico mercato del pesce di Catania · Caffè del Duomo (da locale, colazione) → Caffè del Duomo e Ristorante · Via Etnea (essenziale, pomeriggio) → Via Etnea · Piazza Università (da locale, pomeriggio) → Piazza Università · Trattoria da Antonio (da locale, pranzo) → **scartato: nome diverso (Google: «Ristorante da Antonio»)** · Bar Mola (da locale, aperitivo) → **scartato: fuori città (71,8 km)** · Pasticceria Savia (da locale, dopocena) → Pasticceria Savia · Giardino Bellini (da locale, pomeriggio) → Giardino Bellini - Villa Bellini · Chiesa di San Nicolò l'Arena (da locale, mattina) → Chiesa di San Nicolò l'Arena · Ristorante Il Sale (da locale, cena) → **scartato: nome diverso (Google: «Il Sale Art Cafe'»)** · Piazza Stesicoro (da locale, pomeriggio) → Piazza Stesicoro. *La Cattedrale di Sant'Agata non è stata proposta.*

**Roma — 15 proposti, 15 verificati.** Colosseo (ess.) ⚓ · Piazza Navona (ess.) ⚓ · Vaticano (ess.) → Musei Vaticani · Foro Romano (ess.) · Pasticceria Regoli (colazione) → Regoli Pasticceria · Mercato di Campo de' Fiori (lun–sab 7:00–14:00) → Campo de' Fiori · Trattoria Da Enzo al 29 → Trattoria Da Enzo · Villa Borghese · Piazza di Spagna · Bar del Fico → Bar del Fico Ristorante · Trattoria Da Teo · Gelateria Giolitti → Giolitti · Castel Sant'Angelo · Piazza del Popolo · Caffè Sant'Eustachio → Sant'Eustachio Caffè.

**Napoli — 15 proposti, 15 verificati.** Duomo di Napoli (ess.) → Duomo di Santa Maria Assunta · Museo Archeologico Nazionale di Napoli (ess.) ⚓ · Castel dell'Ovo (ess.) · Piazza del Plebiscito (ess.) · Via Toledo · Caffè Gambrinus (colazione) → Gran Caffè Gambrinus · Mercato di Porta Nolana (lun–sab 6:00–14:00) → Mercato Porta Nolana · Trattoria Da Nennella · Pizzeria Sorbillo → Pizzeria Antonio Sorbillo · Chiesa di Santa Chiara → Complesso Monumentale di Santa Chiara · Via San Gregorio Armeno · Bar Nilo · Gelateria della Scimmia → Gelateria Scimmia Factory · Teatro di San Carlo · Rione Sanità → Stella (Rione Sanità).

**Palermo — 15 proposti, 15 verificati.** Cattedrale di Palermo (ess.) ⚓ · Teatro Massimo (ess.) → Teatro Massimo di Palermo ⚓ · Palazzo dei Normanni (ess.) ⚓ · Piazza Pretoria (ess.) · Mercato di Ballarò (lun–sab 8:00–14:00) → Mercato Ballarò · Bar Pasticceria Cappello (colazione) → Pasticceria Cappello · Via Maqueda · Trattoria da Pino · Giardino Inglese → Parco Piersanti Mattarella (Giardino Inglese) · Piazza San Domenico · Caffè Spinnato → Antico Caffè Spinnato · Ristorante Osteria dei Vespri → Osteria dei Vespri · Piazza Castelnuovo · Chiesa del Gesù → Chiesa del Gesù di Casa Professa · Mercato del Capo (lun–sab 7:00–14:00).

**Lecce — 15 proposti, 13 verificati, 2 scartati.** Basilica di Santa Croce (ess.) ⚓ · Piazza del Duomo (ess.) · Castello Carlo V (ess.) → Castello Carlo V di Lecce ⚓ · Teatro Romano (ess.) ⚓ · Caffè Alvino (colazione) · Mercato di Lecce (giovedì 7:00–14:00) → **scartato: nome diverso (Google: «Mercato Bisettimanale»)** · Osteria degli Spiriti · Piazza Sant'Oronzo · Bar F.lli Mazzotta → **scartato: nome diverso (Google: «Bar Bottazzi di Cosma Michael»)** · Trattoria Le Zie → Le Zie Trattoria Casereccia · Pasticceria Natale · Giardini Pubblici → Giardini Pubblici Giuseppe Garibaldi · Chiesa di San Matteo · Piazza Mazzini → Piazza Mazzini Giuseppe · Caffè Letterario → Caffè Letterario di Lecce.

**Troina — 15 proposti, 4 verificati, 11 scartati.** Cattedrale di Troina (ess.) → **scartato: nome diverso (Google: «Chiesa Madre di Maria Santissima Assunta»)** · Castello di Troina (ess.) → **scartato: nome diverso (Google: «Torre Capitania»)** · Piazza Garibaldi (ess.) → **scartato: nome diverso («Via Giuseppe Garibaldi»)** · Chiesa di San Nicolò (ess.) → Chiesa San Nicolò ⚓ · Mercato di Troina (giovedì 8:00–13:00) → **scartato: nome diverso («Mercato di sabato»)** · Bar Pasticceria Da Franco → **scartato: fuori città (38,5 km)** · Trattoria Da Nino → **scartato: fuori città (61,7 km)** · Caffè Centrale → **scartato: nome diverso** · Chiesa di Santa Maria Assunta → Chiesa Madre di Maria Santissima Assunta · Giardini di Piazza Garibaldi → **scartato: fuori città (48,2 km)** · Ristorante La Fenice → **scartato: fuori città (145,9 km)** · Bar Gelateria Il Chiosco → Il Chiosco · Museo Civico di Troina → **scartato: nome diverso («MACTRO»)** · Chiesa di San Michele → Ruderi Monastero San Michele Arcangelo «Il Vecchio» · Pizzeria Da Salvo → **scartato: fuori città (48,6 km)**. *Qui la verifica fa il suo lavoro: i nomi generici che l'AI dà a un borgo li trova Google in altri paesi, e non entrano.*

## Il giro di Ivano, prima e dopo («Domani un giorno da catanese», Catania)

**Prima** (C9, giro registrato del 14/10, codice `8feb364`): 09:30 Palazzo dei Chierici · 10:01 Piazza Umbrella · *tempo libero 118 min* · 12:30 Trattoria Sorano · 14:30 Fontana dell'Amenano · 15:01 Palazzo degli Elefanti · *tempo libero 146 min* · 18:00 Sotto Palazzo · 18:48 Porta Uzeda · 20:00 Trattoria U Fucularu. **8 tappe, 264 min di tempo libero, nessun essenziale.**

**Dopo** (C10, codice finale): 09:30 **Castello Ursino** ⚓ («Il castello Ursino di Catania fu costruito dal re Federico II di Svevia nel XIII secolo. Si comincia da qui.») · 10:35 **Storico mercato del pesce di Catania** (la Pescheria) · 11:07 Piazza Giuseppe Mazzini · *tempo libero 51 min* · 12:30 Trattoria Giglio Rosso · 14:30 **Chiesa di San Nicolò l'Arena** (i Benedettini) · 15:01 **Giardino Bellini - Villa Bellini** · 15:43 Palazzo degli Elefanti · 16:14 Fontana dell'Amenano · *tempo libero 74 min* · 18:00 Bar Popolare · 18:48 Porta Uzeda · 20:00 Trattoria U Fucularu. **11 tappe, 125 min di tempo libero, 4 essenziali della lista di controllo** (il testo completo di ogni tappa è più sotto, «I tour»).

## Test rosso → verde

`src/__tests__/services/cittaC10.test.js` (22 test) e `src/__tests__/scripts/asticellaC10.test.js` (10). Copiati su un worktree di `7799442` **falliscono tutti** (i moduli della lista e della verifica non esistono). Coprono le quattro richieste: un nome non trovato da Google non entra; un omonimo fuori città non entra (Castello Ursino a 300 km); un essenziale verificato non viene tagliato dal merito (la Cattedrale con 11.472 recensioni, che il merito di oggi taglia) e non conta nei 20; non più di 3 ancore in una giornata intera (1 in mezza). In più: nomi compatibili e generici, una lista illeggibile, un essenziale-locale che non è ancora, il motore intero con la lista (l'ancora arriva nel tour anche se il selettore non la sceglie) e senza (proxy giù: il giro esce come prima). **Suite: 144 file, 1952 test verdi** (1920 + 32); lint 0 errori. Nei test unitari la lista è spenta per difetto (`src/test/setup.js`): i test del motore contano le stesse chiamate di prima.

**Le voci nuove, validate rosse sul giro di Ivano del 14/10** (`asticellaC10.test.js`): conosce la città 🔴 (nessun essenziale), giornata piena 🔴 (264 min), su misura 🔴 (il giro di Ivano e il suo replay: tappe uguali). Invenzioni e costo **non possono essere rossi** su quel giro: non ha una lista (la voce non si applica) e costava 0,147 $ (sotto 0,20); le ho validate su esempi costruiti (2 su 15 → verde, 4 su 15 → rosso; 0,25 $ → rosso).

