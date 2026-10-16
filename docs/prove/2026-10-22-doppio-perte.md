# DOPPIO-PERTE — ogni Per Te lascia 2 biglietti nello stesso secondo: è una doppia generazione?

Ramo `doppio-perte` da `main` `5b82249`. **Solo diagnosi:** nessuna modifica al codice dell'app, nessun deploy, nessuna
migrazione, nessuna scrittura nel database (solo `SELECT`). Unico file nuovo oltre a questo report:
`scripts/prova-doppio/doppio-perte.webkit.mjs` (la prova in WebKit).

## In breve

| Domanda | Risposta |
|---|---|
| È una doppia generazione? | **Sì.** Sono due generazioni complete con due biglietti diversi, non due chiamate di un biglietto solo. Lo dicono il database (4 aperture reali di Per Te su 4 in coppia) e la rete (riprodotto in sviluppo **e** nella build di produzione) |
| È il doppio effetto di React in sviluppo? | **No.** `StrictMode` è importato ma non usato (`src/main.jsx`), il `QueryClient` è uno solo a livello di modulo (`src/App.jsx:53`). La build di produzione raddoppia allo stesso modo |
| Dove nasce | `src/pages/DashboardUser.jsx:185`, la `queryKey` di `home-experiences` contiene `totalInteractions` (e `hasPreferences`, `foodPrefsFingerprint(onboardingPrefs)`), che **cambiano dopo l'apertura**, quando `useAILearning` legge il DNA dal server (`src/hooks/useAILearning.js:104-193`). La chiave nuova fa partire una seconda generazione; la prima **non viene fermata** (il `queryFn` non usa il `signal` di React Query) e arriva fino al proxy |
| Quando succede | Quando la copia locale del DNA (`unnivai_ai_learning_brain_v2`) non dice quanto il server al momento dell'apertura: primo accesso dopo il login, telefono nuovo, dati del sito cancellati. **A caldo (copia locale già allineata) la generazione è una sola**, in sviluppo e in produzione |
| Il tetto dei 10 al giorno conta i doppi? | **Sì.** Ogni biglietto nuovo incrementa il contatore personale e quello globale (`ai_quota_consume`). Un Per Te doppio consuma **2 dei 10**; nel tetto globale (1000) conta 2 |
| Costo in più (stima) | Ai volumi di oggi (un solo utente reale): **circa 0,005 $ al giorno** di AI misurata; **fino a circa 0,3 $ al giorno** se anche le ricerche Google raddoppiassero, cosa che nelle mie prove non è successa |
| Correzione minima proposta | Far partire la query di Per Te solo dopo la lettura del DNA dal server (sezione 6). Non applicata |

## 1) Database (sola lettura)

**Limite trovato: i 14 giorni non ci sono.** `ai_quota_consume` cancella i biglietti più vecchi di 2 giorni a ogni
generazione (`DELETE … WHERE created_at < now() - interval '2 days'`, verificato sulla funzione attiva in produzione). In
`ai_generation_ticket` restano **44,8 ore**: dal 14/10 02:12 al 16/10 02:08 (ora di Roma). Nessun'altra tabella ha l'ora delle
generazioni: `ai_quota_daily` e `ai_quota_global` hanno solo il conteggio del giorno. I numeri sono quindi su 44,8 ore, non su 14
giorni.

**Altro limite: il flusso non si legge dal biglietto.** `kind` vale solo `home_tours` (Per Te di giorno) o `itinerary` (Quiz,
Crea, Sorprendimi **e Per Te di sera e nei borghi**, che passano da `generateItinerary`). La tabella separa per tipo e fascia
oraria; il flusso si deduce dall'ora.

Gruppi «stesso soggetto, stesso secondo», solo numeri aggregati:

| Etichetta | Tipo | Fascia (Roma) | Singoli | Coppie | 3 o più | Biglietti |
|---|---|---|---|---|---|---|
| reale | `home_tours` (Per Te di giorno) | giorno | 0 | **2** | 0 | 4 |
| reale | `itinerary` | giorno | 2 | 0 | 0 | 2 |
| reale | `itinerary` (sera: Per Te della sera o altri flussi) | sera (18–06) | 14 | **2** | 0 | 18 |
| test | `home_tours` | sera | 4 | 0 | 0 | 4 |
| test | `itinerary` | giorno | 40 | 0 | 0 | 40 |
| test | `itinerary` | sera | 94 | 0 | 0 | 94 |

- **Biglietti reali: 24 in 44,8 ore, tutti di un solo utente** (illimitato, `is_unlimited`). Nessun ospite e nessun altro utente
  ha generato nella finestra.
- **Le 4 coppie** (15/10 02:15:52, 12:05:41, 12:07:30, 22:57:15): in ogni coppia i due biglietti hanno lo stesso numero di
  chiamate (1 e 1 per `home_tours`, 2 e 2 per `itinerary`): **due generazioni complete in parallelo**.
- **Ogni Per Te di giorno della finestra è doppio** (2 aperture su 2). Di sera sono doppie 2 aperture: i 14 biglietti
  `itinerary` singoli della sera comprendono Quiz, Crea, Sorprendimi e i Per Te non doppi, e il biglietto non permette di separarli.
- **Il banco (`test`): 0 coppie su 142 biglietti.** Il banco chiama il motore da script, senza la home: è coerente con un difetto
  della pagina, non del motore.
- A cavallo di un secondo c'è una coppia `itinerary` in più (3 biglietti entro 1 s dal precedente contro 2 coppie nello stesso
  secondo).

## 2) Rete: l'apertura della home in WebKit

**Prova:** `scripts/prova-doppio/doppio-perte.webkit.mjs`.

- **Ambiente:** Playwright WebKit con il profilo iPhone 13, account di prova (credenziali da `.env.local`, mai stampate). Porta
  verificata: libera prima dell'avvio, processo del vite di questo repo, titolo «DoveVai» prima delle credenziali.
- **Rete:** places-proxy e openai-proxy sono serviti dai tracciati del banco (rete del replay), quindi **0 $**. Una richiesta che
  il tracciato non ha riceve un 503 e non esce in rete. **Durante l'accesso i proxy sono bloccati**, così la home che si apre dopo
  il login non genera niente di vero.
- **Conteggio:** ogni richiesta a openai-proxy viene registrata col suo `dv.ticket`; una generazione è un biglietto distinto.
- **Scenari:**
  - Per Te di giorno: Catania, 15/10 alle 12:05 (`home-catania-perte` della guardia);
  - Per Te di sera: Troina, 15/10 alle 23:00 (`borgo-a-perte` di BORGO-DIAGNOSI).
- **Stato locale del DNA:**
  - **freddo**: senza la copia locale del DNA, come al primo accesso;
  - **caldo**: copia locale con lo stesso `totalInteractions` del server (2, quello dell'account di prova).

  Due aperture per scenario.
- **Server:**
  - sviluppo: `vite` sulla porta 5191;
  - produzione: `vite build` + `vite preview` sulla porta 5192, con `VITE_PLACES_PROXY_ENABLED=true` come su Vercel (senza quella
    variabile la build locale non chiama nessun proxy e la home dice «Non sono riuscito a completare il giro», vedi «Cosa ho dato
    per vero»).

Generazioni (biglietti distinti) partite nei primi secondi di ogni apertura:

| Server | Stato DNA | Per Te giorno (2 aperture) | Per Te sera (2 aperture) | Distanza fra i due biglietti |
|---|---|---|---|---|
| sviluppo | freddo | **2 e 2** | **2 e 2** | 1–291 ms |
| sviluppo | caldo | 1 e 1 | 1 e 1 | — |
| produzione | freddo | **2 e 2** | **2 e 2** | 16–473 ms |
| produzione | caldo | 1 e 1 | 1 e 1 | — |

- **Nelle tracce compare anche un terzo biglietto, circa 1,2 s dopo.** È un artefatto della prova: il replay ha la risposta di
  una sola generazione, quindi il doppione riceve un 503 e React Query lo **ritenta** (`retry: 1`, `App.jsx:57`). Non l'ho contato
  nella tabella. In produzione vera il doppione riceve una risposta e non ritenta.
- **La chiave che cambia**, letta nel solo server di sviluppo con una riga aggiunta a ciò che il browser riceve (`PROVA_SPIA=1`;
  il file del repo non cambia):

  ```
  1207 ms  queryFn ["home-experiences","Catania",0,false,""]
  1414 ms  queryFn ["home-experiences","Catania",2,false,""]   ← dopo GET user_preferences (775 ms)
  ```
  Sera, Troina: 1993 ms con `0`, 3123 ms con `2` (`user_preferences` a 2046 ms).
- **Il motore gira due volte per intero.**
  - Sera: due volte la lista della città, il giro corto «dalle 21:00:01.957» e «dalle 21:00:02.132», due selettori a 1 ms
    l'uno dall'altro.
  - Le due esecuzioni partono a 200 ms–1,1 s di distanza ma arrivano al proxy AI insieme: aspettano le stesse risposte.
    Per questo nel database i due biglietti cadono nello stesso secondo.
- **Ricerche Google (places-proxy) in produzione:**

  | Scenario | Freddo (2 generazioni) | Caldo (1 generazione) |
  |---|---|---|
  | giorno | 6 | 9 |
  | sera | 3 | 4 |

  **Non raddoppiano.** Il numero varia con la cache locale delle ricerche (`unnivai_poiv6_bias_`), quindi non è un confronto pulito.

## 3) Il punto del codice

1. `DashboardUser.jsx:185`:
   ```js
   queryKey: ['home-experiences', city, totalInteractions, hasPreferences, foodPrefsFingerprint(onboardingPrefs)]
   ```
2. **`useAILearning`:**
   - al montaggio legge lo stato dal `localStorage` (`useAILearning.js:59-85`, `98`);
   - poi, a `userId` noto, carica `user_preferences` (`:104-193`);
   - `totalInteractions = Math.max(server, locale)`, il seme e la dieta del server vincono.

   Se il locale è indietro, la chiave cambia.
3. **React Query** avvia il `queryFn` per la chiave nuova. La chiave vecchia diventa inattiva ma il suo `queryFn` non viene
   interrotto: React Query v5 ferma una query superata solo se il `queryFn` legge `signal`, e qui non lo legge
   (`queryFn: async () => {…}`). La prima generazione arriva a `generateHomeTours` → `newGenerationTicket` → openai-proxy, e il
   suo risultato si butta.
4. Il commento in `useAILearning.js:419-427` lo dice come comportamento voluto («il cambio provoca un refetch sotto la chiave
   nuova»). Non considera che la richiesta vecchia continua e consuma una generazione.

Tutti i pezzi della chiave dipendenti dal DNA possono scatenarlo:
- `totalInteractions`, misurato nella prova;
- `hasPreferences`, quando il grafo o il seme arrivano dal server;
- `foodPrefsFingerprint`, quando la dieta del server differisce da quella locale.

Anche `city` può farlo, se cambia durante il caricamento. Non l'ho osservato.

## 4) Effetto sul tetto dei 10 giri al giorno

- **`ai_quota_consume`:**
  - un biglietto **nuovo** = una generazione;
  - incrementa `ai_quota_daily.count` dell'utente (tetto `LIMITS.user.generation = 10`, ospiti 5 per IP);
  - poi `ai_quota_global.count` (tetto `AI_GLOBAL_DAILY_CAP`, default 1000);
  - le chiamate successive dello stesso biglietto non contano.
- **I due biglietti del doppio sono due biglietti nuovi:** l'apertura a freddo di Per Te consuma **2 dei 10** del giorno, e **2**
  nel tetto globale.
- **Il preflight del client** (`assertQuotaAvailable`) legge il contatore prima di ciascuna delle due. Con 9 usati, la prima passa
  e la seconda riceve il 429 del server. La seconda è quella con la chiave attuale, quindi quella che la home mostra: la home
  mostrerebbe «Per oggi hai usato tutti i tuoi percorsi», pur avendo il server generato il giro della prima. Dedotto dal codice,
  non provato.
- **Per Ivano oggi non conta sul personale** (account illimitato) ma conta sul globale: 4 generazioni in più nelle 44,8 ore.
- Il rimborso (`ai_quota_refund`) scatta solo su un errore di OpenAI, non per una generazione buttata.

## 5) Costo in più: stima, non misura

Il costo di un Per Te misurato dal banco (listino di `banco.config.json`):

| Per Te | Totale | Ricerche Google | AI |
|---|---|---|---|
| Catania, giorno (`home-catania-perte`) | 0,158 $ | 1 findplace + 4 textsearch | gpt-4o-mini 5442 in / 1094 out ≈ **0,0015 $** |
| Troina, sera (`borgo-a-perte`) | 0,125 $ | 1 + 3 | gpt-6.1-sol 1166/74 + gpt-4o-mini 890/173 ≈ **0,0034 $** |

- **Volumi della beta:** 1 utente reale, **4 aperture doppie in 44,8 ore**, cioè circa 2 al giorno.
- **Stima bassa:** solo l'AI raddoppia, come nelle mie prove. Circa **0,005 $ al giorno**.
- **Stima alta:** raddoppiano anche le ricerche Google. Circa **0,25–0,3 $ al giorno**.
- **Per 100 utenti** con un'apertura a freddo al giorno: 0,15–0,35 $ di AI, fino a 13–16 $ con Google. **Il danno vero è la quota:**
  1 dei 10 giri dell'utente a ogni apertura a freddo.

## 6) Proposta di correzione minima (NON applicata)

**A — la query di Per Te parte dopo la lettura del DNA dal server.**
- **`useAILearning`:** uno stato `dnaPronto`:
  - vale `true` subito per un ospite (`!userId`);
  - per un utente, alla fine di `loadFromDb`, in un `finally`, anche se `getUserPreferences` risponde `null` o fallisce.
- **`DashboardUser.jsx:186`:** `enabled: !!city && dnaPronto`.
- **Righe:** circa 6 in due file.
- *Effetto:*
  - la chiave è già quella finale alla prima esecuzione, quindi una generazione per apertura;
  - nessun cambio al server, al motore, ai tracciati della guardia;
  - in più Per Te parte dopo `user_preferences` (nella prova 0,3–2 s dopo il caricamento della pagina, prima di qualunque ricerca).
- *Non risolve:*
  - una chiave che cambia per altri motivi: la città che passa da quella salvata a quella del GPS durante il caricamento, o
    un'interazione registrata mentre Per Te sta generando;
  - il nuovo tentativo di React Query dopo un errore (`retry: 1`), che è una generazione nuova con biglietto nuovo;
  - un ospite non ha mai il doppio per questa via (nessun `user_preferences`), ma non lo cambia.

**B — in aggiunta, se si vuole chiudere anche gli altri cambi di chiave:**
- il `queryFn` legge `{ signal }` e lo controlla prima della chiamata AI (`if (signal.aborted) return []` subito prima di
  `generateHomeTours`): React Query interrompe la query superata e la generazione vecchia non apre il biglietto;
- più completo ma non minimo: le ricerche già partite si pagano comunque, e la chiamata del motore va interrotta anche dentro
  `generateItinerary` per il Per Te della sera.

**Da non fare:** togliere `totalInteractions` dalla chiave da solo. Restano `hasPreferences` e la dieta, che cambiano allo stesso
momento.

**Prova consigliata dopo la correzione** (0 $): la stessa prova a freddo in produzione
(`PROVA_FREDDO=1 … giorno,sera`) deve dare 1 generazione per apertura. Poi `npm run banco:guardia`.

## 7) Spesa

| Voce | Spesa |
|---|---|
| Prove WebKit (proxy dal replay), query SQL di sola lettura, build locale | **0 $** |
| Generazioni vere | nessuna (tetto 0,30 $ non toccato) |

## 8) Produzione e processi

- **Produzione invariata:** nessun deploy, nessuna migrazione, nessuna scrittura nel database. Le prove non hanno raggiunto i proxy
  veri: places-proxy e openai-proxy sono serviti dal replay, e durante l'accesso sono bloccati (contatore: 0 richieste bloccate).
- **Le prove hanno toccato Supabase vero** come ogni apertura della home con l'account di prova:
  - letture di profilo, preferenze, notifiche;
  - `PATCH profiles` (lo fa l'app all'apertura);
  - il salvataggio del DNA dell'account di prova (`user_preferences`, scritto dall'app).

  Nessuna scrittura fatta da me.
- **Processi:** server di sviluppo (5191) e anteprima della build (5192) chiusi a fine task; WebKit si chiude da sé a fine script.
  Build in una cartella temporanea fuori dal repo, cancellata.

## Cosa ho dato per vero senza verificarlo

- **Che le 4 coppie reali vengano da questo meccanismo.** Il database dice che sono due generazioni complete nello stesso secondo,
  come nella prova. Non posso vedere la copia locale del DNA sul telefono di Ivano, quindi non so quale pezzo della chiave cambi
  per lui ad ogni apertura:
  - `totalInteractions`, il seme o la dieta: ha 3 interazioni e il seme sul server, aggiornati il 15/10 alle 23:03;
  - oppure la città.

  Che anche la sua seconda apertura delle 12:07 sia doppia fa pensare a una copia locale che non resta allineata, ad esempio Safari
  e app dalla schermata Home con memorie diverse. Non verificato.
- **Che le coppie della sera siano Per Te.** Il biglietto dice solo `itinerary`. Lo deduco dalla forma (due generazioni intere nello
  stesso secondo, come nella prova della sera) e dal fatto che gli altri flussi partono da un tasto, una volta.
- **Che su Vercel `VITE_PLACES_PROXY_ENABLED` sia `true`.** Non ho letto le variabili di Vercel. Lo deduco dal fatto che in
  produzione Per Te funziona, e senza quella variabile non potrebbe.
- **Che il replay rappresenti i tempi veri.** Nel replay le risposte dei proxy sono immediate. Con la rete vera la distanza fra le
  due generazioni può cambiare, ma il meccanismo (chiave che cambia, prima esecuzione non fermata) non dipende dai tempi.
- **Che le ricerche Google non raddoppino.** Nelle mie prove no (6 contro 9, 3 contro 4), ma il conteggio dipende dalla cache
  locale. Con la rete vera due ricerche identiche partite insieme mancano entrambe la cache del server e si pagano due volte: da qui
  la stima alta.
- **Il messaggio di quota sbagliato con 9 giri usati** (sezione 4) l'ho dedotto dal codice, non l'ho provato.
- **I prezzi** sono quelli del listino del banco, «da ricontrollare» per sua stessa nota.
- **I 14 giorni:** i biglietti più vecchi di 2 giorni non esistono più, quindi la storia prima del 14/10 non è ricostruibile.
