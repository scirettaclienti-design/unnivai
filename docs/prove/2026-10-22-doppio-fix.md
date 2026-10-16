# DOPPIO-FIX — Per Te genera una sola volta anche all'apertura a freddo della home

Ramo `doppio-fix` da `main` `5b82249`, con sopra il commit della diagnosi (`docs/prove/2026-10-22-doppio-perte.md` e la prova
WebKit, portati con `cherry-pick` di `3daef50`). Nessun deploy, nessuna migrazione, nessun push su `main`, nessun merge.

## In breve

| | Prima (diagnosi) | Dopo |
|---|---|---|
| Apertura a freddo, sviluppo | 2 generazioni | **1** |
| Apertura a caldo, sviluppo | 1 | **1** |
| Apertura a freddo, produzione | 2 generazioni | **1** |
| Apertura a caldo, produzione | 1 | **1** |
| Quando parte Per Te | subito, poi di nuovo a DNA letto | **una volta, dopo la lettura del DNA dal server** |
| Cosa lo fa ripartire | città, interazioni, fiducia del DNA, dieta | **città, giorno, dieta e interessi dichiarati** |

## 1) Le tre decisioni, nel codice

1. **Per Te parte solo col DNA del server letto.** `useAILearning` ha lo stato `dnaPronto`
   (`src/hooks/useAILearning.js:104`): vero subito per un ospite, per un utente diventa vero quando `loadFromDb` finisce, **anche se
   la lettura fallisce o il server non ha la riga** (`.finally`, `:197-200`): mai home vuota. In `DashboardUser.jsx`
   `enabled: !!city && !!dnaPronto`. Il DNA, il seme e la dieta del server sono impostati prima di `dnaPronto`, quindi alla prima
   esecuzione il `queryFn` li vede gia'.
2. **Chiave stabile.** `['home-experiences', città, giorno, impronta della dieta, interessi dichiarati]`. Fuori `totalInteractions`
   e la fiducia del DNA (`hasPreferences = dnaShare > 0`), che cambiano con le azioni. Il giorno e' la data del telefono.
3. **`signal` di React Query.** Il `queryFn` riceve `{ signal }` e controlla se la richiesta e' superata prima di ogni passo che
   spende (centro città, ricerche dei temi, **motore: l'ultimo punto prima del biglietto**) e prima di scrivere lo stato
   «chiuso a quest'ora».

Altro: tolti dal destrutturamento di DashboardUser `userDNAPreferences`, `preferenceGraph`, `totalInteractions` (non piu' usati);
riscritto il commento di `useAILearning` che descriveva il secondo avvio come voluto. Nei due test che montano DashboardUser con un
`useQuery` minimo (`guastiVisibili`, `searchErrorMessages`) il finto passa ora il contesto con `signal`, come React Query, e il
mock del hook ha `dnaPronto: true`.

## 2) Prove a 0 $ (WebKit, proxy dai tracciati del banco)

Stessa prova della diagnosi (`scripts/prova-doppio/doppio-perte.webkit.mjs`): iPhone 13, account di prova, places-proxy e
openai-proxy serviti dai tracciati (una richiesta che il tracciato non ha riceve 503, non esce in rete), proxy bloccati durante
l'accesso. Per Te di giorno a Catania (15/10 12:05), di sera a Troina (15/10 23:00), 2 aperture per scenario. Porte verificate
(libere, processo del vite di questo repo, titolo «DoveVai» prima delle credenziali): sviluppo `vite` 5191, produzione
`vite build` (con `VITE_PLACES_PROXY_ENABLED=true`, in una cartella fuori dal repo) + `vite preview` 5192.

Generazioni (biglietti distinti) per apertura, codice finale:

| Server | Stato DNA | Per Te giorno (2 aperture) | Per Te sera (2 aperture) | Avvii del `queryFn` per apertura (spia) |
|---|---|---|---|---|
| sviluppo | freddo | **1 e 1** | **1 e 1** | 1 |
| sviluppo | caldo | **1 e 1** | **1 e 1** | 1 |
| produzione | freddo | **1 e 1** | **1 e 1** | — (la spia vale solo in sviluppo) |
| produzione | caldo | **1 e 1** | **1 e 1** | — |

- **Una sola chiave, dopo il DNA.** In sviluppo la spia (`PROVA_SPIA=1`) stampa un solo avvio per apertura,
  `["home-experiences","Catania","2026-10-15","",""]` (Troina di sera), sempre dopo `GET user_preferences` (per esempio 732 → 975 ms,
  2085 → 3593 ms). Nella diagnosi: `[…,"Catania",0,false,""]` e poi `[…,"Catania",2,false,""]`.
- **Sparito anche il terzo biglietto** della diagnosi (il doppione che riceveva 503 e veniva ritentato): non c'è più il doppione.
- Di sera il biglietto ha due chiamate (selettore e narratore): una generazione.
- **Ricerche Google in produzione:** 9 per apertura di giorno e 4 di sera, a freddo come a caldo.
- **Sviluppo, `PROVA_AUX_A_PARTE=1` (opzione nuova dello script).** In sviluppo la home fa anche una chiamata a openai-proxy senza
  `dv` e senza biglietto, che i tracciati del banco non hanno: riceve 503. Il replay serve queste chiamate in ordine: quando arrivava
  qualche millisecondo **prima** della generazione, prendeva la risposta registrata per la generazione; la generazione riceveva 503,
  Per Te andava in errore e React Query la ritentava (`retry: 1`) con **la stessa chiave**. Successo in 2 aperture di giorno su 4
  nelle due prove a caldo senza l'opzione (giro 1: #1; giro 2: #2; tutte le altre aperture: 1). Con l'opzione la chiamata riceve
  il suo 503 senza passare dal replay; la tabella di sviluppo è con l'opzione. In produzione la chiamata non c'è e l'opzione non
  cambia niente. La prova a freddo in sviluppo senza l'opzione aveva gia' dato 1 generazione in tutte e 4 le aperture.

## 3) Test automatico

`src/__tests__/pages/doppioPerTe.test.jsx` (9 test): DashboardUser, `useAILearning` e React Query **veri** (opzioni di `App.jsx`),
motore e Supabase finti; conta le chiamate a `generateHomeTours`.

| Caso | Correzione | Codice di `main` |
|---|---|---|
| a freddo (nessuna copia locale), dopo la lettura, col DNA del server | ✅ 1 | ❌ 2 |
| a caldo (copia allineata) | ✅ 1 | ✅ 1 |
| copia locale indietro | ✅ 1 | ❌ 2 |
| lettura del DNA fallita | ✅ 1 | ✅ 1 |
| il server non ha la riga | ✅ 1 | ✅ 1 |
| ospite | ✅ 1 | ✅ 1 |
| `dnaPronto`: utente / lettura fallita / ospite | ✅ | ❌ (non esiste) |

Il caso a freddo controlla anche l'ordine (la generazione parte dopo la risposta del server) e che parta gia' col seme del server
(fiducia del DNA > 0).

## 4) Controlli

| Controllo | Esito |
|---|---|
| Suite (`npx vitest run`) | **167 file, 2138 test, tutti verdi** (prima: 166 e 2129; +1 file, +9 test) |
| Lint (`npm run lint`) | **0 errori**, 194 warning (su `main` 196: 2 in meno in `DashboardUser.jsx`, variabili non usate tolte; nessun warning nuovo nei file toccati) |
| Build (`vite build`) | ok |
| Guardia (`npm run banco:guardia`) | **12/12** flussi della home con posti veri |
| Pertinenza (nella guardia) | **nessun ❌ nuovo** (3 in tutto, 3 già noti) |

## 5) Cosa NON risolve

- **Una generazione gia' partita sul server non si ferma.** Il `signal` si controlla nel `queryFn`; non entra in
  `generateHomeTours` ne' in `generateItinerary` (Per Te della sera e dei borghi). Una chiave superata dopo l'apertura del biglietto
  consuma comunque la sua generazione; il risultato si butta.
- **Il nuovo tentativo dopo un errore** (`retry: 1` in `App.jsx`) e' una generazione nuova con un biglietto nuovo. Si vede nella
  prova (sezione 2).
- **Uscire dalla home mentre Per Te genera.** Con il `signal` letto, React Query annulla la query quando la home si smonta
  (`removeObserver` → `cancel({ revert: true })`, `@tanstack/query-core` 5.90.19, `query.js:142-154`). Se si esce prima del
  biglietto non si spende niente; se si esce dopo, la generazione finisce sul server e al ritorno ne parte una nuova. Prima la query
  continuava e al ritorno si riusava. Letto nel codice di React Query, non provato.
- **La rigenerazione a tempo resta.** `staleTime: 120_000` sulla query: rientrando nella home dopo 2 minuti Per Te si rigenera, come
  prima; ricaricando la pagina pure (la cache e' in memoria). L'obiettivo «si rigenera solo quando cambiano città, giorno o
  preferenze dichiarate» vale quindi per la sessione aperta, non oltre. **Proposta (non applicata):** `staleTime: Infinity` sulla
  query di Per Te, con il giorno nella chiave come scadenza. *(Applicata in DOPPIO-FIX-2, sotto.)*
- **La città che cambia durante il caricamento** (quella salvata, poi quella del GPS): chiave nuova, seconda generazione; il `signal`
  la evita solo se la prima non ha ancora aperto il biglietto. Non osservata.
- **Una lettura del DNA che non risponde mai** (ne' risposta ne' errore) lascia Per Te in attesa. Non e' un modo nuovo di restare
  vuoti: il primo passo del `queryFn`, `getToursByCity`, va sullo stesso Supabase senza tempo massimo. **Proposta (non applicata):**
  un tempo massimo per la lettura del DNA, oltre il quale Per Te parte con la copia locale. *(Applicata in DOPPIO-FIX-2: 4 s.)*
- **Le interazioni della sessione non cambiano il Per Te gia' generato**: ordine per affinita' ed etichette («Scelto per te») sono
  quelli dell'apertura fino alla prossima rigenerazione. E' l'obiettivo, ma e' un cambio visibile.
- **Per Te parte piu' tardi**: dopo `GET user_preferences` (nelle prove 0,55–1,8 s dal caricamento), prima di qualunque ricerca.

## 6) Spesa, produzione, processi

- **Spesa: 0 $.** Nessuna generazione vera: i proxy rispondono dai tracciati; guardia e pertinenza in replay.
- **Produzione invariata:** nessun deploy, nessuna migrazione, nessuna scrittura mia nel database. Le aperture della home con
  l'account di prova hanno fatto cio' che l'app fa sempre su Supabase (letture di profilo, preferenze, notifiche; `PATCH profiles`).
- **Processi:** server di sviluppo (5191) e anteprima della build (5192) chiusi a fine prove (porte di nuovo libere, nessun vite,
  vitest o WebKit di Playwright acceso); WebKit si chiude da sé a fine script; la build stava in una cartella temporanea fuori dal
  repo, cancellata. Le prime due prove in sviluppo le ho interrotte a metà perché il hook è cambiato mentre giravano: rilanciate sul
  codice finale, come la build.

## Cosa ho dato per vero senza verificarlo

- **Che su unnivai.vercel.app valga lo stesso.** Le prove sono su una build locale con i proxy serviti dal replay. Il meccanismo
  (chiave fissa, partenza dopo la lettura del DNA) non dipende dai tempi della rete, ma non l'ho visto in produzione vera.
- **Che le coppie reali del database venissero da questo meccanismo** (lo dava per vero gia' la diagnosi). La correzione toglie il
  meccanismo provato; se le coppie di Ivano avessero un'altra causa (per esempio la città che cambia), resterebbero: si vedrà dai
  biglietti dei prossimi giorni.
- **Che la chiamata AI senza `dv` di sviluppo sia innocua.** Non ho cercato chi la fa; nella prova riceve 503 sia prima sia dopo
  questa correzione, e in produzione non compare.
- **Che React Query annulli la query all'uscita dalla home** (sezione 5): letto nel codice della libreria, non provato.
- **Che l'utente non cambi a home aperta.** `AuthProvider` mostra il caricamento (e smonta la pagina) all'uscita, e all'accesso si
  arriva alla home dalla pagina di login, quindi `useAILearning` nasce con l'utente gia' noto. Se un ospite diventasse utente con la
  home montata, Per Te partirebbe senza aspettare il DNA.
- **Il giorno della chiave** e' la data del telefono, non quella di Roma: per un telefono con un altro fuso cambia a un'altra ora.
- **Il conteggio dei warning di `main`** (196) l'ho ricavato: 194 di questo ramo + i 2 tolti in `DashboardUser.jsx`, misurati file
  per file su `main`. Non ho lanciato il lint completo su `main`.

---

# DOPPIO-FIX-2 — Per Te non brucia giri al rientro e alla ricarica; cambia con la fascia del giorno

Stesso ramo `doppio-fix`, sopra `bf125ea`. Nessun deploy, nessuna migrazione, nessun push su `main`, nessun merge.

## In breve

Generazioni (biglietti distinti a openai-proxy) per caso. WebKit (iPhone 13), account di prova, **build di produzione** del codice
finale (`vite build` con `VITE_PLACES_PROXY_ENABLED=true` in una cartella fuori dal repo, `vite preview` sulla 5192: porta libera,
processo di questo repo, titolo «DoveVai» prima delle credenziali), places-proxy e openai-proxy dai tracciati del banco (0 $).
Script: `scripts/prova-doppio/doppio-fix-2.webkit.mjs`.

| Caso | Atteso | Prova WebKit | Test `doppioPerTe` |
|---|---|---|---|
| Prima apertura (Catania, 12:05) | 1 | **1** (`home_tours`) | **1** |
| Rientro in home dopo 3 minuti (12:08) | 0 | **0**, stesso Per Te a schermo (3 carte, stessa prima carta) | **0** |
| Ricarica della pagina (12:20) | 0 | **0**, stesso Per Te (3 carte, **stesso id** della prima carta: viene dalla copia salvata; un `queryFn` ripartito avrebbe un id nuovo) | **0** |
| Cambio di fascia | 1 | **1** (Troina 12:05 → 23:00, `itinerary`: il giro della sera) | **1** (17:59 → 18:01) |
| DNA che non risponde | 1 dopo 4 s | **1**, primo biglietto a 6,2 s dall'apertura | **1**, partita dopo ≥ 4 s |

- **Il cambio di fascia in WebKit è 12:05 → 23:00, non 17:59 → 18:01**: i tracciati del banco hanno Per Te a Troina solo alle 12:05
  (guardia) e alle 23:00 (BORGO-DIAGNOSI); a 17:59 e 18:01 le ricerche e le chiamate non ci sono. Il passaggio delle 18:00 esatto
  lo prova il test automatico. Le due ore cadono in fasce diverse (`giorno:mattina` → `sera:dopocena`) dello stesso giorno.
- **Troina alle 12:05 apre 2 biglietti in una sola esecuzione di Per Te**: i temi (`home_tours`) non danno un tour e il motore fa
  il tour misto del borgo (`itinerary`, TROINA-FIX). Il tracciato della guardia è registrato così (una generazione dei temi più
  lista, selettore e narratore del tour misto). Non è un doppio avvio: la chiave è una sola.
- **Ricerche Google per fase:** apertura 9, DNA muto 9, Troina 7 e poi 1. Al rientro 5 e alla ricarica 4: non sono di Per Te (la
  prima carta ha lo stesso id, quindi il `queryFn` non è ripartito); vengono dalla pagina «Vedi tutte» visitata per uscire dalla
  home e dal resto della home. Non ho cercato quali.

## A) Le fasce: quelle del motore, nessuna nuova

> **Superata da DOPPIO-FIX-3** (in fondo): la chiave ora ha 3 fasce, non i 7 momenti descritti qui.

La chiave di Per Te è `['home-experiences', città, giorno, fascia, dieta, interessi]`
(`src/lib/perTeSalvato.js`, `giornoEFasciaPerTe`, ora di Roma). La fascia è fatta di due funzioni che il motore usa già:

| Pezzo | Funzione del motore | Valori |
|---|---|---|
| sera o giorno | `isSeraStart` (`src/lib/daySkeleton.js`, `SERA_FROM_MINUTES` 18:00, `ALBA_MINUTES` 05:00): di sera Per Te è il giro della sera (`_homeSera`) | `sera` dalle 18:00 alle 05:00, altrimenti `giorno` |
| momento | `momentAtClock` (`src/lib/dayMoments.js`): lo stesso momento che il motore mette nelle sue cache di Per Te (`hometours_v2_…_<momento>_…` di giorno, `…_<data>_<momento>` del giro della sera) | mattina (fino alle 12:30), pranzo (12:30–14:30), pomeriggio (14:30–18:00), aperitivo (18:00–20:00), cena (20:00–22:30), dopocena (22:30–00:30); dalle 00:30 alle 09:30 la tabella dice «mattina» |

Esempi: 17:59 → `giorno:pomeriggio`, 18:01 → `sera:aperitivo`, 01:00 → `sera:mattina` (diverso da `giorno:mattina` delle 09:00:
per questo c'è il pezzo sera/giorno). **La sera dopo mezzanotte resta la sera del giorno prima** (giorno della chiave = il giorno
prima, fino alle 05:00): rientrare alle 00:10 non rigenera il giro delle 23:50. Il giorno ora è quello di Roma (prima: la data del
telefono).

Quindi Per Te si rigenera al massimo una volta per momento: 6 momenti di giorno e di sera, più la notte (00:30–05:00).
La ricerca del cibo cambia anche alle 11:00 e alle 14:45 (`foodQueryForClock`, colazione e merenda), dentro la mattina e il
pomeriggio: **non** l'ho messa nella chiave, perché il motore stesso riusa Per Te per momento; un Per Te delle 10:50 resta quello
fino alle 12:30.

## B) Le quattro decisioni, nel codice

1. **Chiave** con giorno e fascia (sopra).
2. **Nessuna scadenza dentro la chiave:** `staleTime: Infinity` sulla query di Per Te (prima 2 minuti). Rientrare in home non
   rigenera; il tasto «Riprova» sì (è una richiesta esplicita).
3. **Ricarica.** *Cosa ho trovato, prima di cambiare:* sul codice di `bf125ea`, in WebKit a 0 $ (build di produzione, ricarica 40 s
   dopo l'apertura), la ricarica **non** ha aperto nessun biglietto, né di giorno (Catania 12:05) né di sera (Troina 23:00). Non lo
   evita il server (openai-proxy non ha una cache delle generazioni; `ai_quota_consume` conta ogni biglietto nuovo): lo evita **la
   cache del motore sul telefono** (`localStorage`, 24 ore). La sera la sua chiave è città, preferenze, data e momento: la ricarica
   nello stesso momento la ritrova. **Di giorno la chiave contiene anche l'impronta dei posti trovati**: la ricarica rifà le ricerche
   Google e trova la cache solo se tornano gli stessi posti. Nella prova tornavano uguali (stesse risposte del tracciato, ricerche
   in cache sul telefono); non tornano uguali quando la ricerca del cibo cambia dentro lo stesso momento (alle 11:00 e alle 14:45) o
   quando scade la cache delle ricerche, e allora **la ricarica apre un biglietto** (dedotto dal codice, non provato). Quindi la
   ricarica può crearlo, e ho applicato la decisione: **l'ultimo Per Te si salva sul telefono** (`dvai_per_te_v1`: chiave, utente,
   tour e riga «chiuso a quest'ora») e, con la stessa chiave e lo stesso utente, torna come dato iniziale della query: niente
   generazione, niente ricerche Google, Per Te a schermo subito. Si salva solo un Per Te riuscito (un errore no); il logout lo
   cancella (`AuthContext`, con le altre chiavi dell'utente). La riga «chiuso a quest'ora» ora viaggia col dato (prima era uno
   stato a parte, che dalla copia salvata non sarebbe tornato).
4. **DNA in 4 secondi** (`DNA_ATTESA_MAX_MS` in `useAILearning.js`): se la lettura non risponde, `dnaPronto` diventa vero dopo 4 s e
   Per Te parte con la copia locale. Se il DNA arriva dopo, si applica come sempre.

## C) Test automatico

`src/__tests__/pages/doppioPerTe.test.jsx`: 14 test (9 di DOPPIO-FIX + 5 nuovi). Quelli nuovi:

| Caso | Correzione | Codice di `bf125ea` |
|---|---|---|
| rientro in home dopo 3 minuti, stessa fascia | ✅ 0 generazioni in più, Per Te a schermo | ❌ 1 in più |
| ricarica (client nuovo, stesso telefono), stessa fascia | ✅ 0 in più (il DNA si rilegge, Per Te no) | ❌ 1 in più |
| cambio di fascia 17:59 → 18:01 | ✅ 1 in più | ✅ 1 in più (ma per la scadenza di 2 minuti, non per la fascia) |
| DNA che non risponde | ✅ 1, partita dopo ≥ 4 s | ❌ 0: Per Te resta fermo |
| le fasce (17:59, 18:01, 12:31, 23:50, 00:10 del giorno dopo) | ✅ | — (la funzione è nuova) |

Anche `dashboardUser_emptyState.test.js`: il dato finto ha la forma nuova (`{ tours, chiusoOra }`).

## D) Controlli

| Controllo | Esito |
|---|---|
| Suite (`npx vitest run`) | **167 file, 2143 test, tutti verdi** (prima 2138: +5) |
| Lint (`npm run lint`) | **0 errori**, 194 warning, come `bf125ea`; nei file toccati nessun warning nuovo (`DashboardUser.jsx` 7, `useAILearning.js` 0, `AuthContext.jsx` 1, `perTeSalvato.js` 0) |
| Build (`vite build`) | ok |
| Guardia (`npm run banco:guardia`) | **12/12** flussi della home con posti veri |
| Pertinenza (nella guardia) | **nessun ❌ nuovo** (3 in tutto, 3 già noti) |

## E) Cosa NON risolve

- **Con la home aperta il cambio di fascia si vede al prossimo rientro o ricarica**: la chiave si ricalcola quando la pagina si
  ridisegna; nessun timer la aggiorna alle 18:00 in punto.
- **Il DNA che arriva dopo i 4 secondi** con dieta o interessi diversi da quelli del telefono cambia la chiave: Per Te si rigenera
  una volta (è un cambio di preferenze). Con lo stesso DNA, niente.
- **Tutto quello che restava da DOPPIO-FIX:** una generazione già partita sul server non si ferma; il nuovo tentativo dopo un errore
  (`retry: 1`) è un biglietto nuovo; uscire dalla home durante la generazione la annulla lato client.
- **Il Per Te salvato vale per un telefono**: su un secondo telefono, o con i dati del sito cancellati, la prima apertura nella
  fascia genera (o trova la cache del motore).
- **Il tasto «Riprova»** genera sempre, anche nella stessa fascia.
- **Un Per Te vuoto** («Qui intorno non trovo…», o tutto chiuso) si salva come gli altri: nella stessa fascia non si riprova da solo.

## F) Spesa, produzione, processi

- **Spesa: 0 $.** Nessuna generazione vera.
- **Produzione invariata:** nessun deploy, nessuna migrazione, nessuna scrittura mia nel database (le aperture della home hanno fatto
  su Supabase cio' che l'app fa sempre con l'account di prova).
- **Processi:** l'anteprima della build di `bf125ea` (per la prova della ricarica di prima) e quella del codice finale, entrambe
  sulla 5192, chiuse; le due build stavano nella cartella temporanea della sessione, fuori dal repo, cancellate. WebKit si chiude da
  sé a fine script. Nessun server di sviluppo avviato in questa parte.

## Cosa ho dato per vero senza verificarlo (DOPPIO-FIX-2)

- **Che di giorno la ricarica apra un biglietto quando la ricerca del cibo cambia dentro lo stesso momento** (11:00, 14:45) o quando
  scade la cache delle ricerche: dedotto dalla chiave della cache del motore (contiene l'impronta dei posti), non provato. È il motivo
  per cui ho applicato la copia sul telefono; nella prova la ricarica di `bf125ea` dava 0.
- **Che i momenti siano la fascia giusta.** Le ho prese dal motore (le usa nelle sue cache di Per Te); la decisione citava solo «il
  giro della sera dalle 18». Con questa scelta Per Te può rigenerarsi fino a 7 volte al giorno se la home si apre in ogni momento
  (6 momenti più la notte); con sole sera/giorno sarebbero 2, ma un Per Te del pranzo resterebbe fino alle 18.
- **Che il giorno di Roma vada bene a un telefono con un altro fuso**: la fascia del motore è sull'ora di Roma, la chiave pure.
- **Che le ricerche Google del rientro e della ricarica non siano di Per Te**: lo deduco dall'id della prima carta, che non cambia;
  non ho registrato quali richieste fossero.
- **Che su unnivai.vercel.app valga lo stesso**: build locale, proxy dai tracciati.
- **Che i tour di Per Te reggano il passaggio in JSON** della copia salvata: la cache del motore li salva già così, e nella prova le
  carte tornano uguali dopo la ricarica; non ho aperto il dettaglio di un tour tornato dalla copia.

---

# DOPPIO-FIX-3 — tre fasce nella chiave di Per Te: al massimo tre rigenerazioni al giorno

Stesso ramo `doppio-fix`, sopra `cc3b216`. Nessun deploy, nessuna migrazione, nessun push su `main`, nessun merge. 0 $.

## Cosa cambia

Solo la fascia nella chiave di Per Te (`giornoEFasciaPerTe`, `src/lib/perTeSalvato.js`); `DashboardUser.jsx` non cambia (usa già
quella funzione) e **il motore non cambia**: continua a scegliere i posti coi suoi momenti (`momentAtClock`, cache comprese).

| Fascia | Ore (Roma) | Da dove viene il confine |
|---|---|---|
| `mattina` | 05:00–14:30 | fine della sera (`ALBA_MINUTES`) e inizio del momento «pomeriggio» |
| `pomeriggio` | 14:30–18:00 | il momento «pomeriggio» di `momentAtClock` (`dayMoments.js`) |
| `sera` | 18:00–05:00 | `isSeraStart` (`SERA_FROM_MINUTES`, `ALBA_MINUTES`) |

Dopo mezzanotte vale la sera del giorno prima (il giorno della chiave resta quello della sera fino alle 05:00), come in
DOPPIO-FIX-2. Nessuna soglia scritta a mano: i tre confini sono costanti e tabelle che il motore usa già.

## Test

`src/__tests__/pages/doppioPerTe.test.jsx`: **20 test** (14 di prima + 6 passaggi nuovi; la verifica della funzione delle fasce è
riscritta per le 3 fasce). Ogni passaggio apre la home all'ora di partenza, esce e rientra all'ora d'arrivo con lo stesso telefono.

| Passaggio | Atteso | Con 3 fasce | Con le 7 fasce di `cc3b216` |
|---|---|---|---|
| 14:29 → 14:31 | rigenera | ✅ 1 | 1 |
| 15:00 → 17:00 | no | ✅ 0 | 0 |
| 17:59 → 18:01 | rigenera | ✅ 1 | 1 |
| 23:50 → 00:10 | no | ✅ 0 | 0 |
| 12:00 → 13:00 (aggiunto) | no | ✅ 0 | ❌ 1 (mattina → pranzo) |
| 18:30 → 22:45 (aggiunto) | no | ✅ 0 | ❌ 1 (aperitivo → dopocena) |
| la funzione delle fasce (05:00, 12:31, 14:29, 14:31, 17:59, 18:01, 23:50, 00:10, 04:59) | — | ✅ | ❌ |

I quattro passaggi chiesti danno lo stesso esito anche con le 7 fasce; i due aggiunti sono quelli che mostrano la differenza (con
le 7 fasce rigeneravano). Rilanciati sul file di `cc3b216` e poi ripristinato.

## Controlli

| Controllo | Esito |
|---|---|
| Suite (`npx vitest run`) | **167 file, 2149 test, tutti verdi** (prima 2143: +6) |
| Lint (`npm run lint`) | **0 errori**, 194 warning, come `cc3b216` (`perTeSalvato.js` 0 prima e dopo) |
| Build (`vite build`) | ok |
| Guardia (`npm run banco:guardia`) | **12/12** flussi della home con posti veri |
| Pertinenza (nella guardia) | **nessun ❌ nuovo** (3 in tutto, 3 già noti) |

## Cosa NON risolve

- **Al massimo tre Per Te al giorno per chiave**: un cambio di città, di dieta o di interessi, o il tasto «Riprova», generano anche
  dentro la fascia, come prima.
- **Un Per Te fatto alle 05:30 resta fino alle 14:30**: la ricerca del cibo del motore cambia alle 11:00 (colazione) e i momenti alle
  12:30 (pranzo), ma la chiave no. Un giro scritto per la colazione può restare a schermo all'ora di pranzo: le tappe chiuse
  all'arrivo il motore le ha escluse all'ora della generazione, non all'ora in cui si guarda.
- Tutto il resto di DOPPIO-FIX e DOPPIO-FIX-2 (generazione già partita sul server, nuovo tentativo dopo un errore, cambio di fascia
  visto al prossimo rientro).

## Processi

Nessun server avviato in questa parte: solo test, lint, build (in una cartella temporanea fuori dal repo, cancellata) e la guardia
in replay, tutti finiti da soli. Nessun processo acceso a fine task. Produzione invariata: nessun deploy, `main` su GitHub a `5b82249`.

## Cosa ho dato per vero senza verificarlo (DOPPIO-FIX-3)

- **Che «mattina» parta alle 05:00.** Il prompt dice «mattina fino alle 14:30» e «sera dalle 18:00 alle 05:00»: tra le 05:00 e le
  14:30 ho messo mattina.
- **Che tre Per Te al giorno bastino a non svuotare il tetto dei 10**: lo dice la decisione; non ho misurato quante volte un utente
  vero apre la home per fascia.
- **Che nessuna prova WebKit serva qui**: la chiave è una funzione pura dell'ora, provata nel test con DashboardUser, React Query e
  `useAILearning` veri; il resto del percorso (copia sul telefono, rientro, ricarica) non cambia rispetto a DOPPIO-FIX-2, dove è stato
  provato in WebKit.
- **Che su unnivai.vercel.app valga lo stesso**: nessuna prova in produzione vera.
