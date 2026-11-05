# ONBOARDING-ACCESSO — registrazione, accesso, password, ospite e primo ingresso (06/11/2026)

Ramo `onboarding/accesso` (worktree `~/unnivai-onboarding`), da `origin/main` `15fe93c`, PR #50. **PR pronta, merge in attesa di PASSI-IVANO**
(istruzione di Ivano: i percorsi ospite, email e cancellazione dell'account si stanno verificando sul sito pubblicato e non devono
cambiare a metà). Le prove del «fatto quando» sono quindi sulla **build locale del ramo** (vite preview, porta e titolo verificati),
non ancora sul sito pubblicato.

Galleria prima/dopo da guardare sul telefono: [`docs/prove/onboarding-galleria.html`](onboarding-galleria.html) (84 schermate,
`docs/prove/dati/onboarding/prima|dopo/`, JPEG 600 px, 2,5 MB).

## 1. La mappa dei percorsi di oggi (prima)

WebKit, iPhone 14, sito pubblicato `unnivai.vercel.app` (main `15fe93c`), Supabase **simulato** (`scripts/prova-nav/supabase-finto.mjs`:
oggi le email non escono e gli accessi anonimi sono spenti, quindi nessun percorso nuovo si può fare dal vivo; il sito vero risponde,
le chiamate a Supabase le risponde il finto). Script: `ONB_BASE=https://unnivai.vercel.app ONB_OUT=docs/prove/dati/onboarding/prima node scripts/prova-nav/onboarding-accesso.webkit.mjs`.

| # | Percorso | Cosa vede, in ordine | Dove si inceppa |
|---|---|---|---|
| 1 | Utente nuovo con email | home → /login «Scegli come vivere l'esperienza» (UN ruolo) → modulo Nome/Email/Password → «Controlla la tua Email!» → link → primo ingresso: il **consenso si apre sopra** il manifesto → manifesto → interessi → dieta → a tavola → «Ora tocca alla strada» → home | passo inutile del ruolo; regole della password solo dopo l'errore; **conferma con link: oggi la mail parte solo verso il team (2 l'ora)** → chi si registra resta fermo e non può farsela rimandare; «Non adesso» del consenso esce dallo schermo; interessi obbligatori («Continua» spento); **passo e compagnia non si chiedono**; 6 schermate; testi fuori voce («Unisciti alla piattaforma…», «Registrati Gratuitamente», «Controlla la tua Email!») |
| 2 | Accesso esistente | /login → ruolo → scheda «Accedi» → home | il passo del ruolo |
| 3 | Password dimenticata | «Password dimenticata?» → email → «Email inviata!» → link → **pagina bianca** «Nuova Password» → home | link per email (stesso limite di invio); pagina fuori tema |
| 4 | Ospite che si registra a fine giro | «Prova un giro, senza account» → primo ingresso → home → «Salva questo giro» → email → codice **+ password** → Profilo | sul sito pubblicato oggi **non parte** (accessi anonimi spenti); tre campi per registrarsi |
| 5 | Secondo accesso | /login → home, senza primo ingresso | — (il seme sul server dice «fatto») |
| 6 | Secondo dispositivo | /login → home, senza primo ingresso né consenso | il caricamento è una **schermata bianca «Loading Unnivai...»** in inglese |

## 2. Cosa cambia (dopo)

**Accesso e registrazione solo con email e codice di 6 cifre** (istruzione nuova di Ivano). Supabase lo consente senza perdere i dati
dell'ospite (§ 3): `src/lib/accessoCodice.js` → `signInWithOtp({ email, options: { shouldCreateUser: true, data: { role: 'explorer' } } })`,
poi `verifyOtp({ email, token, type: 'email' })`.
- **Login** (`src/pages/Login.jsx`): logo e curve di livello del marchio, «Entra con la tua email» → «Guarda nella posta» → codice → «Entra».
  Nessun ruolo, nessuna password da inventare, nessun link da aspettare. «Mandamene un altro» dopo 60 s (il limite di Supabase è 1 al
  minuto per indirizzo); «Cambia email». Errori in italiano: email scritta male, codice corto, «Codice sbagliato o scaduto. Fatti
  mandare un codice nuovo.», troppe richieste. Il campo accetta 6–10 cifre (se un giorno il progetto allunga l'OTP non si blocca nessuno).
- **Chi ha già una password** entra col codice (stessa email = stesso account) **e** può ancora usare la password: «Hai una password?
  Accedi →» → Email + Password → «Accedi ora». Nessun account bloccato; gli script WebKit (collaudo e gli altri, che cliccano «Accedi →» e
  «Accedi Ora») funzionano senza modifiche. «Password dimenticata?» porta al codice. `/update-password` resta per i vecchi link «reimposta
  la password» (pagina col marchio sul fondo scuro).
- **Ospite → account** (`RegistrazioneOspite.jsx`, `ospite.confermaCodice`): email → codice, **niente password**; stesso id.
- **Primo ingresso** (`src/pages/Onboarding.jsx`): `01 · Prima di partire` (consenso, solo se manca) → `02 · Interessi` → `03 · A tavola`
  (cosa non mangi, quanto spendi, che cucina) → `04 · Come giri` (passo, con chi). Ogni domanda «Salta questa domanda», tutto «Salta per
  ora»; i tasti restano in vista (footer fisso: sull'iPhone 14 il consenso è più lungo dello schermo). La finestra `ConsensoAi` non si
  apre più sopra `/onboarding` né da sola su `/` (niente lampo); «Non adesso» nel primo ingresso vale per tutta l'apertura.
- **Una volta per account, stato sul server**: il seme in `user_preferences.onboarding_seed` (c'era già, ONB-1) **e** il segno
  `user_metadata.primo_ingresso_fatto_at` (nuovo, nessuna migrazione: arriva con la sessione, quindi su un telefono nuovo si sa subito).
- **Il DNA iniziale è un punto di partenza**: passo e compagnia si salvano come `gusti.ritmo_iniziale` / `compagnia_iniziale`, non come
  la scelta del Profilo. Nel motore valgono per ULTIMI: richiesta → Profilo → giri → scelte → primo ingresso (fonte `'primo ingresso'`,
  riga del riquadro «Tranquillo: l'hai detto al primo ingresso. Cambia con i tuoi giri.»). Gli interessi del seme erano già un seme
  che gli eventi attenuano (`pesiDaEventi`). Il Profilo («Come giri») mostra «Al primo ingresso: Tranquillo, In coppia. È il punto di
  partenza: poi decidono i tuoi giri.».
- **Grafica del marchio** dalla cartella `~/Desktop/UNNIVAI-Site-FINAL` (il sito unnivai.com): copiati solo `logo.png` (→ `src/assets/brand/unnivai-logo.webp`,
  17 KB) e 5 caratteri (Bricolage Grotesque 500/800 per i titoli, Instrument Sans 400/600 per il testo, IBM Plex Mono 500 per le etichette
  `01 · ACCESSO`, 103 KB); le curve di livello del sito in SVG (`FondoMarchio`). Colori: quelli dell'app (Ossidiana e `brand-orange`),
  per coerenza col tema scuro; il teal del sito non entra. Applicati a Login, codice, password, password nuova, consenso, primo ingresso
  e caricamento (`SchermataCaricamento`, al posto della schermata bianca).
- **Testi** nel file unico `src/lib/testiAccount.js` (`ACCESSO`, `NUOVA_PASSWORD`, `CARICAMENTO`, `PRIMO_INGRESSO`): frasi brevi, prima
  persona («Ti ho scritto a…»), nessun «Benvenuti», nessun punto esclamativo.
- **Email** (`supabase/functions/_shared/emailUnnivai.ts` → `supabase/templates/`): «confirmation» e «magic_link» portano **sia** il
  codice di 6 cifre in grande (`{{ .Token }}`) **sia** il link di sempre («Oppure apri questo link:», pulsante e indirizzo scritto,
  `{{ .ConfirmationURL }}`): l'app di oggi usa il link, quella nuova il codice, quindi i modelli **si caricano in qualsiasi momento**,
  prima o dopo il merge, senza finestre rotte. «email_change» resta solo codice (l'ospite usa il codice in entrambe le versioni),
  «recovery» solo link. **Nel file `_shared` cambia solo `MODELLI_AUTH`**: le email
  della lista d'attesa e degli avvisi (funzioni `lista-attesa-email`, `avvisi`) restano identiche byte per byte; un loro deploy dopo il
  merge porterebbe il file nuovo senza cambiare niente di ciò che mandano.

## 3. Email e codice senza perdere l'ospite: perché funziona

- L'ospite è un account anonimo; diventa un account vero con `updateUser({ email })` + `verifyOtp({ type: 'email_change' })` sullo
  **stesso id** (com'era in OSPITE-GIRO): la password era un terzo passo facoltativo, tolto. Dopo, rientra con `signInWithOtp` sulla sua
  email (`shouldCreateUser` non crea un doppione: l'account esiste) → stesso id, giro, gusti, DNA e primo ingresso restano.
- Un ospite non arriva mai al login col codice mentre è dentro (Login lo rimanda a `/`): non può aprire per sbaglio un altro account.
  Se sceglie un'email già usata, lo dice come prima («Con questa email c'è già un account…»).
- **Durata e tentativi** (configurazione letta in EMAIL-LANCIO, `docs/prove/2026-11-02-email-lancio.md`): `mailer_otp_exp = 3600` → il
  codice vale **un'ora** e funziona **una volta**; un codice nuovo annulla il precedente; Supabase manda **un codice al minuto** per
  indirizzo e limita le verifiche per IP (`rate_limit_verify`). La **lunghezza** (`mailer_otp_length`) non era nell'elenco letto: di
  difetto 6; il client accetta 6–10 cifre, i testi dicono 6 (passo 2 di § 6 per controllarla).
- **Utenti con password**: entrano col codice o con la password, a scelta. Nessuno resta fuori, nemmeno se un giorno l'email non parte
  (la password funziona senza email).

## 4. Le prove

| Prova | Esito |
|---|---|
| 6 percorsi, Supabase simulato, **sito pubblicato** (prima) | 6/6 arrivano in fondo, con gli inceppi di § 1 (`docs/prove/dati/onboarding/prima/esiti.json`) |
| 6 percorsi, Supabase simulato, **build locale del ramo** (dopo; porta 4377, cwd e titolo verificati) | 6/6 senza inceppi: primo ingresso alla prima apertura (4 passi), **mai** al secondo accesso né sul secondo telefono, consenso mai due volte; ospite → stesso id, seme e `primo_ingresso_fatto_at` restano (`dopo/esiti.json`) |
| Supabase **vero**, build locale del ramo (porta 4378, titolo verificato prima delle credenziali), account di prova | accesso esistente con la password: home, niente `/onboarding`, niente consenso; secondo telefono uguale; esci e rientra: niente primo ingresso (`vero-locale/esiti.json`) |
| Seme e metadati | nuovo utente: `{ interessi: [cultura, arte], gusti: { stile: trattoria, ritmo_iniziale: lento, compagnia_iniziale: coppia } }`, `primo_ingresso_fatto_at` scritto, nessuna password |
| DNA iniziale → DNA vero (`primoIngresso.test.jsx`, utenti di DNA-5) | passo iniziale «lento»: vale da solo; con i giri dell'utente B vince «veloce» (fonte giri); 3 scelte su 3 «veloce» lo superano; Profilo e richiesta vincono sempre; compagnia «coppia» superata dalle scelte «famiglia»; dopo **un** giro con tappe di cibo e natura il peso del cibo sale e quello della cultura del seme scende |
| Suite | **3480/3480** verdi (280 file; 16 test nuovi, 3 nuovi sui modelli email (codice E link) in `primoIngresso.test.jsx`, `accesso1.test.jsx` riscritto: 16), lint **0 errori** (184 avvisi, come prima), build ok |
| `npm run banco:guardia` | home 12/12, banco 40 10/10 (0 $) |

## 5. Apple, linea guida 4.8

L'app **non offre accessi con terzi** (nessun `signInWithOAuth`, solo email in `auth/v1/settings`: `external.email = true`, gli altri
spenti). La 4.8 («Login Services») chiede «Accedi con Apple» solo a chi offre Google, Facebook o simili: **oggi non serve**. Se un
giorno si aggiunge Google, va aggiunto anche Apple (provider Apple di Supabase + `signInWithIdToken` col plugin nativo in Capacitor;
servono Services ID e chiave del Developer Program). Nessun fornitore aggiunto.

## 6. PASSI-IVANO (i modelli si caricano quando si vuole: portano codice E link)

1. **Caricare i modelli** (in qualsiasi momento, anche subito, anche dal main di oggi e poi di nuovo da questo ramo: l'app di oggi usa
   il link, l'app nuova il codice): `SUPABASE_ACCESS_TOKEN=… node scripts/email/carica-modelli.mjs` (prova, nessuna scrittura) poi
   `SUPABASE_ACCESS_TOKEN=… node scripts/email/carica-modelli.mjs --invia`. Sono gli 8 campi dei 4 modelli. Se si caricano dal main di
   oggi, dopo il merge vanno ricaricati da main (i modelli di oggi hanno solo il link: l'app nuova direbbe «ti ho scritto un codice»).
2. **Controllare la lunghezza del codice** (solo lettura):
   `curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" https://api.supabase.com/v1/projects/ahecpiwsdhghkndncejb/config/auth | jq '{mailer_otp_length, mailer_otp_exp, rate_limit_verify, rate_limit_otp}'`
   — se `mailer_otp_length` non è 6: `curl -s -X PATCH -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d '{"mailer_otp_length":6}' https://api.supabase.com/v1/projects/ahecpiwsdhghkndncejb/config/auth`.
   (L'app accetta 6–10 cifre; i testi dicono 6.)
3. Restano quelli di EMAIL-LANCIO e OSPITE-GIRO (SMTP/Resend, Site URL, accessi anonimi): senza SMTP la mail arriva solo agli indirizzi del team.
4. Merge della PR #50, CI di main, Vercel READY; se al passo 1 i modelli venivano dal main di prima, ricaricarli ora (`--invia`).
5. **Prova dal vivo, un solo comando** (codici letti dalla posta e scritti nel file che lo script indica):
   `PROVA_EMAIL=<indirizzo di prova> node scripts/prova-nav/onboarding-accesso-vero.webkit.mjs --tutto`
   (utente nuovo con codice, primo ingresso una volta e non sul secondo telefono, password dimenticata → codice, ospite → codice → stesso id).
   E i 6 percorsi simulati sul sito pubblicato: `ONB_BASE=https://unnivai.vercel.app ONB_OUT=docs/prove/dati/onboarding/pubblicato node scripts/prova-nav/onboarding-accesso.webkit.mjs`.

Nessuna migrazione, nessun secret, nessun deploy di funzione.

## 7. Cosa NON risolve

- **Il nome**: con email e codice non si chiede più «Come ti chiami»; la home dice «Ciao!» (decisione di Ivano per chi non ha nome)
  finché non lo scrive nel Profilo. Proposta: una riga facoltativa «Come ti chiamo?» nel primo ingresso (non fatta: non chiesta).
- **Gli utenti di prima** non hanno `primo_ingresso_fatto_at`: per loro decide il seme sul server (come prima, una lettura in più al primo
  avvio su un telefono nuovo). Nessuna scrittura in massa.
- **Il primo ingresso non chiede la città** (prima «Ora tocca alla strada» era solo una frase: la posizione la chiede la home come sempre).
- **Email vere, ospite dal vivo, sito pubblicato**: aspettano PASSI-IVANO e il merge (§ 6).
- `scripts/prova-accesso/accesso1.webkit.mjs` (prova di ACCESSO-1, 10/10) clicca «Voglio Esplorare»: dopo il merge non serve più e non è
  stato adattato; collaudo, ospite-giro e gli altri script sì (testi compatibili, password facoltativa nell'ospite).
- La Landing (`unnivai.vercel.app/` per chi non è dentro) non è stata ridisegnata: resta con la bussola e la grafica di prima.

## 8. Costo

0 $ di AI e di Google: Supabase simulato, Google bloccato nelle prove, l'accesso vero dell'account di prova senza generazioni
(`ai_generation_ticket` delle ultime 3 ore: 0 righe).

## 9. Aggiunta di Ivano (05/11): marchio nelle email e icone dell'app

Fonte: `~/Desktop/UNNIVAI-Site-FINAL` (il sito unnivai.com). File copiati nel repo:

| Nel repo | Dalla cartella del marchio | Uso |
|---|---|---|
| `src/assets/brand/sorgenti/icon-512.png` | `icon-512.png` | sorgente di icona iOS e maskable |
| `src/assets/brand/sorgenti/favicon-64.png` | `favicon.png` | sorgente della favicon |
| `src/assets/brand/sorgenti/logo-441x125.png` | `logo.png` | sorgente del logo delle email |
| `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png` | `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` | copiati così come sono |
| `public/brand/fonts/bricolage-grotesque-latin-800-normal.woff2` | `fonts/` (stesso nome) | titoli delle email |

Generati da `node scripts/brand/genera-icone.mjs` (Node puro, Lanczos-3, `--controlla` nel test iOS): `public/favicon.ico` (16/32/48),
`public/favicon-32.png`, `public/icon-maskable-192.png` e `-512.png` (segno all'80% sul fondo #06161E, dentro la zona sicura),
`public/brand/logo-email.png` (282×80, mostrato a 141×40), **icona iOS** `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
1024×1024 RGB **senza alfa** (`sips -g hasAlpha` → `no`), che sostituisce la proposta disegnata di APP-NATIVA (`genera-icona.mjs` ora fa
solo l'avvio). Il file più grande del marchio è 512 px: l'icona iOS è ingrandita 2× (un po' morbida da vicino; un file a 1024 dal
grafico la renderebbe nitida). `index.html`: favicon, apple-touch-icon, `manifest.webmanifest` (192/512 «any» e «maskable», `display:
standalone`), `theme-color` #0E0C0B (il fondo dell'app). Prima: la favicon era il logo di Vite, nessun manifest.

**Email** (`supabase/functions/_shared/emailUnnivai.ts`, solo HTML e testo; la logica delle funzioni non cambia): logo PNG
`https://unnivai.vercel.app/brand/logo-email.png` con `width`/`height` e testo alternativo «Unnivai» in arancione (immagini bloccate),
titoli in Bricolage Grotesque dove il client carica i caratteri (Apple Mail), codice di 6 cifre in un riquadro a cifre larghe e
spaziatura fissa, pulsante #FF6B3D con testo #1A0A04, modalità scura (Apple Mail con `prefers-color-scheme`, Outlook con `[data-ogsc]`);
il codice e le righe degli avvisi non stanno più dentro un `<p>` (HTML valido). Vale per conferma, accesso, codice dell'ospite,
password, lista d'attesa, riepilogo e avviso. **Il logo esiste solo dopo il merge della #50 e il READY di Vercel**: i modelli di Auth si
ricaricano su Supabase dopo, le due funzioni si ripubblicano dopo. Anteprime chiaro/scuro e icone nella galleria (sezioni 07 e 08),
script `node --experimental-strip-types scripts/email/anteprime-marchio.webkit.mjs`.

**Deploy delle due funzioni** (DOPO il merge, da una cartella su `main` aggiornato, con il «sì» di Ivano; non eseguiti):
`supabase functions deploy lista-attesa-email --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api` e
`supabase functions deploy avvisi --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api` (le stesse opzioni dei report EMAIL-LANCIO e AVVISI).

**Rebase su LINK-DOMINIO (PR #51, già su main)**: tenute entrambe le modifiche. I link di conferma e accesso portano al sito
(`{{ .SiteURL }}/login?token_hash={{ .TokenHash }}&type=email`, recupero `/update-password?…&type=recovery`) e li verifica l'app
(`src/lib/linkEmail.js`, chiamato da `AuthContext`); conferma e accesso portano anche il codice di 6 cifre. `/login?link=scaduto` (link
non valido) apre l'accesso col codice col messaggio chiaro. Suite 3493/3493, lint 0 errori, build ok, guardia 12/12 e 10/10.


## 10. Ripresa del 05/11: rebase su PASSI-IVANO, i due aperti, merge

- **Rebase** su `main` `f3576f7` (PASSI-IVANO, PR #53): unico conflitto `docs/LANCIO.md`, tenuta la versione di main (P10 già «fatto»), poi la riga aggiornata.
- **Icone**: in `~/Desktop/UNNIVAI-Site-FINAL/` il file più grande del marchio è ancora `icon-512.png` (nessun sorgente a 1024×1024): icone di oggi lasciate com'erano.
- **«Account eliminato.» non compariva** (PASSI-IVANO, aperto 1). Causa: `signOut` mette `loading` a vero, `AuthProvider` mostra la schermata
  di caricamento e smonta tutto, `ToastProvider` compreso; il messaggio partiva come evento mentre nessuno lo ascoltava. Ora `toast({ …, persistente: true })`
  lo lascia in `sessionStorage` (`dvai_toast_in_attesa_v1`) finché `ToastProvider` lo mostra (subito se è montato, appena si rimonta altrimenti), una volta sola.
  Test `src/__tests__/components/eliminaAccountMessaggio.test.jsx` (smonta e rimonta come l'AuthProvider vero): fallisce senza la correzione, passa con.
- **2 righe `tour_completed` per lo stesso giro** (PASSI-IVANO, osservazione): non è una doppia scrittura. In produzione (lettura del 05/11) le righe
  doppie dei tre giri del 05/11 hanno lo stesso istante, lo stesso giro e lo stesso «7/7» o «8/8», con **categorie diverse** (cultura e food): il registro
  di DNA-1 scrive una riga per categoria e i pesi di DNA-2 le leggono così. Profilo (`meteDalRegistro`) e fiducia (`pesiDaEventi`) raggruppano per giro e
  istante: un giro conta 1. Decisione di Ivano (05/11): il formato resta. Test `src/__tests__/lib/giroUnaVolta.test.js` (il caso vero di Catania:
  2 righe, 1 giro nel Profilo, 1 evento di fiducia, peso su entrambe le categorie).
- Suite 3497/3497, lint 0 errori, build ok, `banco:guardia` 12/12 e 10/10, pertinenza senza ❌ nuovi.
