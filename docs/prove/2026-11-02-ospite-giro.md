# OSPITE-GIRO — un giro completo senza account (02/11/2026)

Cartella `/Users/mac2023ivanosciretta/unnivai-ospite` (verificata con `pwd`), ramo `ospite/giro` da `origin/main` (`a177c60`).
Nessuna migrazione applicata, nessun secret, nessun deploy, nessuna modifica alla configurazione di Auth: sono i passi di Ivano (§ 6).
Sul database di produzione solo letture (`select` su policy, trigger, colonne, storico delle migrazioni).

## 1. Cosa cambia per chi apre Unnivai

1. Sulla Landing e sul Login c'è **«Prova un giro, senza account»** (sotto: «Un giro completo, gratis. L'account lo crei dopo, se ti serve.»).
2. Un tocco: Unnivai entra con un **account anonimo di Supabase**. Poi tutto come per un utente: i gusti (si possono saltare), la home, Crea, Quiz, Sorprendimi, Per Te, la mappa, la navigazione, i racconti, le curiosità, la fine giro. Il DNA cresce come per tutti.
3. **Mai un invito prima del primo giro.** I momenti sono tre:
   - **fine giro**: al posto di «Nelle tue Mete» c'è **«Salva questo giro»**;
   - **secondo giro**: Crea, Quiz o Sorprendimi dopo il giro di prova, oppure «Avvia» su un giro diverso → «Il prossimo giro parte dal tuo account»;
   - **salvataggio**: «Salva il giro» su una scheda → «Per salvare serve un account».
4. La registrazione dal foglio: **email → codice di 6 cifre (arriva per email) + password → «Fatto. Il giro è nel tuo Profilo.»** → Profilo.
   L'account resta **lo stesso** (stesso id): il giro (`dna_events`), il DNA, i gusti (`user_preferences`), i giri salvati restano dove sono, senza copiare niente.

Schermate della prova locale: `docs/prove/schermate/ospite-giro/` (`landing.png`, `landing-chiuso.png`, `login.png`).

## 2. La strada: account anonimo + collegamento dell'email

È la strada consigliata nel task, e la tengo. Le alternative valutate:

| Strada | Perché no |
|---|---|
| Giro di prova solo nel telefono, senza account; alla registrazione si copia | Le scritture del giro (DNA, gusti, racconti, tetti) passano dalle RLS con `auth.uid()`: servirebbe un secondo percorso per tutto. La copia alla registrazione è fragile (tabelle nuove = dimenticate). |
| Account nuovo alla registrazione e funzione che sposta le righe | Una funzione con service_role che riscrive `user_id` in N tabelle: stesso problema della copia, più un permesso forte. |
| **Account anonimo, poi email sullo stesso account** | Lo stesso id dall'inizio alla fine: niente da copiare, le RLS di sempre, il server riconosce l'ospite dal JWT (`is_anonymous`). |

Per collegare l'email Supabase chiede che sia verificata prima della password (documentazione «Anonymous Sign-Ins», letta il 02/11): `updateUser({ email })` → codice → `verifyOtp({ type: 'email_change' })` → `updateUser({ password })`. Uso il **codice** e non il link: chi si registra resta nell'app (in iPhone il link aprirebbe Safari).

## 3. I limiti contro gli abusi

Li applica `openai-proxy` prima di chiamare il motore (fail-closed: se il controllo non risponde, 503 e nessuna chiamata), con la funzione nuova `public.ai_quota_ospite` (solo service_role). `ai_quota_consume` non cambia: la funzione nuova sta accanto, così il proxy in produzione oggi continua identico finché non si fa il deploy.

| Limite | Valore | Dove si cambia | Risposta (429) |
|---|---|---|---|
| Giri generati per account anonimo (Crea, Quiz, Sorprendimi) | **1, per sempre** | `OSPITE.giri` nel proxy | `OSPITE_GIRO_USATO` · «Il giro di prova l'hai fatto. Il prossimo parte dal tuo account.» |
| Per Te per account anonimo | **2, per sempre** | `OSPITE.perTe` | `OSPITE_PER_TE_USATO` · la home tiene l'ultimo Per Te, nessun errore a schermo |
| Generazioni di ospiti **per indirizzo IP** al giorno | **10** (difetto) | secret `AI_OSPITE_IP_DAILY_CAP` | `OSPITE_IP_LIMITE` · «Da questa rete oggi sono partiti già molti giri di prova. Con il tuo account parti adesso.» |
| Generazioni di **tutti gli ospiti** al giorno | **100** (difetto) | secret `AI_OSPITI_DAILY_CAP` | `OSPITI_LIMITE` · «Per oggi i giri di prova sono finiti. Con il tuo account parti adesso, oppure riprova domani.» |
| Tetto globale dell'app | come oggi (`AI_GLOBAL_DAILY_CAP`) | — | `GLOBAL_QUOTA_EXCEEDED`, testo di sempre |
| Chiamate di contorno di un ospite | 30 al giorno per account | `OSPITE.aux` | testo di sempre |

- Tutti i rifiuti dell'ospite aprono l'invito a registrarsi con il testo del server (tranne Per Te).
- L'IP non esce mai in chiaro: `sha256(AI_QUOTA_IP_SALT + IP)`, come per gli ospiti di prima.
- Se il motore si ferma, la generazione si rimborsa (`ai_quota_ospite_rimborso`): il giro di prova resta da fare.
- Racconti, curiosità e voce non cambiano: hanno i loro tetti globali (`RACCONTO_DAILY_CAP`, `VOCE_DAILY_CAP`).
- I testi dei quattro limiti sono miei: **da rivedere con Ivano** (stanno in `index.ts` accanto agli altri «testi decisi da Ivano»).

**Costo massimo al giorno**: 100 generazioni di ospiti × circa 0,11 $ (giro di Catania misurato in FORNITORE-AI) ≈ **11 $**, più racconti e voce già sotto i loro tetti.

**Un ospite non scrive dove lo leggono gli altri.** Le policy di oggi permettono a ogni `authenticated` di scrivere recensioni, tour, profili di guida e di attività, foto, prenotazioni, richieste alle guide e notifiche a un altro utente; un account anonimo è `authenticated`. La migrazione aggiunge policy **RESTRICTIVE** (in AND con quelle di sempre) che vietano a un account anonimo `INSERT` e `UPDATE` su `reviews`, `tours`, `guides_profile`, `businesses_profile`, `activities`, `user_photos`, `bookings`, `guide_requests`, e le notifiche verso altri. DNA, gusti, giri salvati, notifiche proprie: come per tutti.

### Anti-bot (Cloudflare Turnstile): non serve per il lancio

Valutazione:
- **Costo**: limitato senza captcha. Un ospite ha 1 giro; tanti account dalla stessa rete si fermano a 10 al giorno; tutti gli ospiti insieme a 100. Il peggio è ~11 $ al giorno.
- **Database**: Supabase limita la creazione di account anonimi a 30 all'ora per IP (documentazione). Una botnet con molti IP può riempire `auth.users` e consumare i 100 giri del giorno: i veri ospiti vedrebbero «Per oggi i giri di prova sono finiti», gli utenti registrati no.
- **Il costo di Turnstile**: in Supabase il captcha vale per **tutti** i punti di accesso (registrazione, accesso con password, reset, anonimo). Attivarlo vuol dire mettere il widget anche nel Login, che è un altro lavoro (ACCESSO-1). Attivarlo solo in Supabase senza il widget **romperebbe l'accesso**.

Quindi non l'ho preparato. Si accende se in un giorno il tetto degli ospiti si riempie con traffico che non porta registrazioni. Il controllo è:
`select day, count from public.ai_quota_ospiti_global order by day desc limit 7;`
contro le registrazioni dagli ospiti:
`select count(*) from auth.users where is_anonymous = false and created_at::date = current_date and id in (select user_id from public.ai_quota_ospite);`.

## 4. File

| File | Cosa |
|---|---|
| `supabase/migrations/20261102200000_ospite_giro.sql` | `ai_quota_ospite`, `ai_quota_ospiti_ip`, `ai_quota_ospiti_global`; funzioni `ai_quota_ospite` e `ai_quota_ospite_rimborso` (solo service_role); policy RESTRICTIVE per gli account anonimi. Ripetibile. |
| `supabase/functions/openai-proxy/index.ts` | soggetto `ospite` dal JWT (`is_anonymous`), `consumaQuota` e `rifiutoQuota` (una sola strada per giri, contorno e lista della città), rimborso dell'ospite, secret `AI_OSPITE_IP_DAILY_CAP` e `AI_OSPITI_DAILY_CAP`. |
| `src/lib/ospite.js` | entrare come ospite, il giro di prova finito (sul telefono, legato all'id anonimo), l'invito (evento `dvai:registrati`), la registrazione (email → codice → password), i testi. |
| `src/components/ProvaSenzaAccount.jsx` | il tasto, in `Landing.jsx` e `Login.jsx`. |
| `src/components/RegistrazioneOspite.jsx` | il foglio dell'invito, uno solo, montato in `App.jsx`. |
| `src/components/Nav/GuidaSchede.jsx` (`FineGiro`), `src/pages/MapPage.jsx` | «Salva questo giro»; il giro di prova si segna alla fine; «Avvia» su un giro diverso apre l'invito. |
| `src/components/SalvaGiro.jsx` | «Salva il giro» da ospite apre l'invito. |
| `src/services/aiRecommendationService.js` | i codici dell'ospite diventano un errore di quota con il testo del server e aprono l'invito; dopo il giro di prova Crea/Quiz/Sorprendimi non chiamano il motore. |
| `src/pages/DashboardUser.jsx`, `src/lib/perTeSalvato.js` | Per Te dell'ospite finito: resta l'ultimo. |
| `src/pages/Profile.jsx` | «Giro di prova, senza account» al posto dell'email. |
| `supabase/functions/_shared/emailUnnivai.ts`, `supabase/templates/codice.html`, `soggetti.json`, `scripts/email/carica-modelli.mjs` | l'email col codice (`email_change` di Supabase), in voce Unnivai; il caricamento ora tocca 8 campi. |
| `scripts/prova-nav/collaudo-sito.webkit.mjs` | punto 7: da ospite entra con «Prova un giro» e deve arrivare alla fine giro con «Salva questo giro». |
| `scripts/prova-nav/ospite-giro.webkit.mjs` | la prova completa sul sito pubblicato (§ 7). |
| `scripts/test-ospite-giro-sql.sh` | la migrazione su un Postgres 17 vero (Docker). |

## 5. Prove fatte

| Prova | Esito |
|---|---|
| `bash scripts/test-ospite-giro-sql.sh` (Postgres 17, migrazioni della quota in ordine, poi la nuova due volte) | **41 asserzioni su 41**: ospite nuovo, stesso biglietto che non conta, secondo giro rifiutato senza muovere contatori, Per Te 2, tetto IP, da un'altra rete passa, tetto ospiti, utente registrato non toccato, globale, rimborso, cancellazione a cascata, permessi, policy (recensione e notifica a un altro vietate all'ospite, permesse dopo la registrazione e agli utenti) |
| `src/__tests__/functions/openaiProxyOspite.test.js` (il file vero del proxy) | **14/14**: primo giro, stesso biglietto, secondo giro 429 senza OpenAI, Per Te, utente registrato, tetto IP (anche con più indirizzi in `x-forwarded-for`), tetto ospiti, secret non validi, tetto globale, contorno, rimborso, sale mancante (503), token non valido (401) |
| `src/__tests__/lib/ospite.test.jsx` | **17/17**: tasto, accessi spenti, rete giù, giro di prova legato all'id, nessun invito prima del primo giro, fine giro, salvataggio, testi in voce, registrazione con lo stesso account (`updateUser` → `verifyOtp email_change` → `updateUser password`), foglio che resta dopo il codice, codice sbagliato, email già registrata, password debole |
| `src/__tests__/services/quotaOspiteClient.test.js` | **5/5**: primo giro, `OSPITE_GIRO_USATO` e `OSPITI_LIMITE` dal server, secondo giro senza chiamate, utente registrato non fermato |
| Test dei modelli email | 26/26 (con il modello nuovo) |
| Suite intera | **251 file, 3131 test, tutti verdi** |
| `npm run lint` | **0 errori** (189 avvisi, nessuno nei file nuovi) |
| `npm run build` | ok |
| `npm run banco:guardia` | **12/12**, pertinenza senza ❌ nuovi (3 ❌ già noti) |
| WebKit in locale (porta 5191, cartella del vite verificata, titolo «DoveVai»), Supabase di produzione | il tasto c'è su Landing e Login; con gli accessi anonimi ancora spenti in produzione risponde «Il giro di prova non è disponibile adesso. Crea l'account e parti.» e resta sulla pagina |

**Non provato ancora** (serve produzione dopo i passi di § 6): il collaudo punto 7 da ospite e la prova completa § 7.

## 6. I passi di Ivano, in quest'ordine

**Prima, EMAIL-LANCIO.** Senza SMTP proprio, Supabase manda email solo agli indirizzi del team e al massimo 2 all'ora. Il codice della registrazione non arriverebbe a nessun ospite. Quindi prima vanno fatti i passi 1–8 di `docs/prove/2026-11-02-email-lancio.md`: Resend, DNS, SMTP, Site URL, modelli, secret, funzione, migrazione. La sua migrazione `20261102160000` **non è ancora in produzione** (storico letto oggi: l'ultima è `20261029120000`).

Poi, da `~/unnivai-1b` su `main` aggiornato (`git pull`) dopo il merge e la CI verde:

1. **La migrazione**
   ```bash
   supabase db push --dry-run   # deve elencare solo 20261102200000_ospite_giro.sql (anche 20261102160000 se EMAIL-LANCIO non è ancora fatto)
   supabase db push
   ```
2. **Il deploy del proxy**, dal codice su main:
   ```bash
   supabase functions deploy openai-proxy --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api
   ```
   Senza la migrazione prima, le generazioni degli ospiti rispondono 503 (la funzione SQL non c'è). Gli utenti non sono toccati.
3. **I secret** (facoltativi, valgono senza deploy):
   ```bash
   supabase secrets set AI_OSPITI_DAILY_CAP=100 AI_OSPITE_IP_DAILY_CAP=10 --project-ref ahecpiwsdhghkndncejb
   ```
4. **L'email col codice** (insieme agli altri tre modelli):
   ```bash
   SUPABASE_ACCESS_TOKEN=… node scripts/email/carica-modelli.mjs           # prova: elenca gli 8 campi
   SUPABASE_ACCESS_TOKEN=… node scripts/email/carica-modelli.mjs --invia   # «8 campi uguali ai file del repo»
   ```
5. **Gli accessi anonimi, per ultimi.** Si aprono solo quando tutto il resto è pronto.
   Dashboard → Authentication → Sign In / Providers:
   - **«Allow anonymous sign-ins»** acceso;
   - **«Allow manual linking»** acceso: Supabase lo chiede per collegare l'email a un account anonimo.

   Oppure con la Management API:
   ```bash
   curl -sS -X PATCH https://api.supabase.com/v1/projects/ahecpiwsdhghkndncejb/config/auth \
     -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
     -d '{"external_anonymous_users_enabled":true,"security_manual_linking_enabled":true}'
   ```
6. **Dimmelo**: lancio il collaudo punto 7 e la prova § 7 sul sito pubblicato.

**Per tornare indietro**: si spengono gli accessi anonimi (passo 5 al contrario). Il tasto dice «Il giro di prova non è disponibile adesso» e il resto dell'app non cambia.

## 7. La prova sul sito pubblicato (dopo § 6)

```bash
node scripts/prova-nav/collaudo-sito.webkit.mjs 7
OSPITE_EMAIL=<indirizzo di prova nuovo> node scripts/prova-nav/ospite-giro.webkit.mjs
```

`ospite-giro.webkit.mjs` fa questi passi:
1. «Prova un giro» e gusti saltati.
2. Crea a Catania (una generazione vera, ~0,11 $).
3. «Vedi su Mappa» → «Avvia» → cammino col GPS finto tappa per tappa, con i racconti chiesti.
4. Fine giro con «Salva questo giro».
5. Secondo Crea: l'invito «secondo» e nessuna generazione.
6. Registrazione. Il codice si legge dalla posta e si scrive nel file indicato dallo script; la password è casuale e non si stampa.
7. Profilo: **stesso id utente**, non più anonimo, contatore dei giri ≥ 1, Catania nelle Mete.

Esiti in `docs/prove/dati/<data>-ospite-giro.json`.

## 8. Cosa NON risolve

- **Email di un account che esiste già**: il foglio lo dice. Se l'ospite entra in quell'account, il giro di prova resta sull'account anonimo e non passa. Unire due account è un altro lavoro.
- **Account anonimi abbandonati**: restano in `auth.users`. Supabase non li pulisce da solo. Pulizia a mano (cancella anche le loro righe, a cascata):
  `delete from auth.users where is_anonymous is true and created_at < now() - interval '30 days';`
  Un'automazione (pg_cron) non c'è.
- **Captcha**: vedi § 3. Non preparato.
- **Un giro per telefono, non per persona**: con un'altra app, un altro browser o i dati del sito cancellati si è un ospite nuovo. Lo fermano il tetto per rete e quello giornaliero.
- **Ricerche Google degli ospiti** (`places-proxy`): non hanno un tetto per ospite. Valgono le protezioni di oggi del proxy dei posti.
- **«Accedi» da ospite**: chi ha già un account e tocca «Accedi» lascia il giro di prova sull'account anonimo.
- **Il codice nell'email**: la documentazione dei modelli (letta il 02/11) dice che `{{ .Token }}` è il codice di 6 cifre, `{{ .NewEmail }}` il nuovo indirizzo e `{{ .Email }}` è vuoto quando si collega un'email a un account anonimo (per questo il modello usa `NewEmail`). Che il codice arrivi davvero si vede solo nella prova § 7.
- **Il primo giro da Per Te**: un ospite può fare il giro di prova da Per Te (nessun giro generato). Dopo la fine giro Crea, Quiz, Sorprendimi e «Avvia» su un altro giro aprono l'invito. Prima della fine giro può anche generare il suo unico giro di Crea.
- **I quattro testi dei limiti e dell'invito** sono da rivedere con Ivano.
- **L'app iPhone**: il link del codice non serve (si scrive il codice), quindi nessun problema di `capacitor://`.
