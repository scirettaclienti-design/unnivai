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
  query di Per Te, con il giorno nella chiave come scadenza.
- **La città che cambia durante il caricamento** (quella salvata, poi quella del GPS): chiave nuova, seconda generazione; il `signal`
  la evita solo se la prima non ha ancora aperto il biglietto. Non osservata.
- **Una lettura del DNA che non risponde mai** (ne' risposta ne' errore) lascia Per Te in attesa. Non e' un modo nuovo di restare
  vuoti: il primo passo del `queryFn`, `getToursByCity`, va sullo stesso Supabase senza tempo massimo. **Proposta (non applicata):**
  un tempo massimo per la lettura del DNA, oltre il quale Per Te parte con la copia locale.
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
