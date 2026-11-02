# APP-IPHONE-PROVA — Unnivai sull'App Store il 1/12? (02/11/2026)

Ramo `app/iphone-prova`, worktree `~/unnivai-app-iphone`, ribasato su `origin/main` 27f7b26 (EMAIL-LANCIO).

## Verdetto

**Sì con condizioni.** Il progetto iOS esiste e si sincronizza (`npx cap sync ios` riuscito), la build web è identica a quella di main. Il 1/12 è raggiungibile solo se:

1. entro il **10/11** Ivano ha Xcode installato e l'iscrizione all'Apple Developer Program attiva;
2. entro il **18/11** sono uniti su main i lavori A–I della lista «Cosa manca» (circa 9,5 giorni di lavoro, quasi tutti in `src/`, quindi task separati con PR);
3. l'invio alla revisione parte entro il **20/11**, così restano 11 giorni per uno o due rifiuti.

Senza A (la posizione in background), l'app fa le stesse cose del sito in Safari. Il rischio di rifiuto per la 4.2 sale e la voce con il telefono in tasca non funziona.

**Simulatore: non provato.** Su questo Mac non c'è Xcode:
- `ls /Applications | grep -i xcode` non trova niente;
- `xcode-select -p` = `/Library/Developer/CommandLineTools`;
- `xcodebuild -version` → «requires Xcode, but active developer directory … is a command line tools instance»;
- `xcrun simctl` → «unable to find utility "simctl"».

La prova completa si rifà in un colpo solo, dopo l'installazione di Xcode:

```bash
cd ~/unnivai-1b && git pull && npm ci && bash scripts/ios/prova-simulatore.sh
```

## Le 5 domande

| # | Domanda | Risposta | Motivo | Fonte | Provato / dedotto |
|---|---|---|---|---|---|
| 1 | Audio e voce a schermo bloccato, telefono in tasca | **Web (Safari): no. App: sì per la frase in corso; per le frasi dopo, solo con la 2 risolta** | **Nel web** ogni frase parte da JavaScript a ogni posizione (`src/lib/voce.js:49`, `new Audio()`). Con lo schermo bloccato la pagina è sospesa e le frasi nuove non partono. **Nell'app** ci sono `UIBackgroundModes = audio` e la categoria `.playback`, quindi l'audio in corso continua a schermo bloccato. Dal bug WebKit 203293, chiuso in iOS 14, l'`<audio>` di una WKWebView continua in secondo piano. Quando la frase finisce, però, iOS sospende l'app e la frase dopo non parte, a meno che la posizione in background (2) non tenga viva l'app. Resta da provare se JavaScript nella WKWebView gira mentre l'app nativa è tenuta viva dalla posizione. | Apple, «Configuring your app for media playback» («your app’s audio continues when people … lock their iOS device»); Apple, «Handling location updates in the background» («the system suspends the execution of most apps shortly after they move to the background»); bugs.webkit.org/show_bug.cgi?id=203293; `docs/prove/2026-10-27-voce-1.md` righe 105 e 119 | dedotto |
| 2 | Posizione in background durante il giro | **Oggi no; sì con il plugin** | Oggi la posizione viene da `navigator.geolocation.watchPosition` (`src/lib/navTracking.js:63`). WebKit non attiva `allowsBackgroundLocationUpdates`, che di default è `false`. Con `@capacitor-community/background-geolocation` 1.3.1 (Capacitor 8 dalla 1.2.27, MIT) e `backgroundMessage`, Core Location tiene l'app in esecuzione. Basta il permesso **«Durante l'uso»**: «For apps with When In Use authorization, the system changes the appearance of the status bar» (indicatore blu sempre visibile, non disattivabile). «Sempre» non serve. Il README chiede comunque anche `NSLocationAlwaysAndWhenInUseUsageDescription` in Info.plist; lo spike chiedeva prima «Durante l'uso» e poi avviava il watcher con `requestPermissions: false`. Serve un adattatore in `src/` (solo se `Capacitor.isNativePlatform()`), quindi un task con PR. | Apple, `allowsBackgroundLocationUpdates`, `showsBackgroundLocationIndicator`; README di capacitor-community/background-geolocation; `SPIKE_IOS.md` (ramo `spike/ios`) | dedotto |
| 3 | Notifiche push | **Sì, ma non per il 1/12** | La web app oggi non ha Web Push: nessun `serviceWorker` né `PushManager` in `src/`, le notifiche sono solo nella tabella `notifications`. Per le push native servono: <br>• la capability Push Notifications (entitlement `aps-environment`); <br>• una chiave APNs `.p8` dall'account Apple di Ivano; <br>• `@capacitor/push-notifications` 8.1.3 con codice in `src/` per il permesso e il token; <br>• una tabella dei token (migrazione); <br>• una funzione che invia ad APNs (deploy + secret). | Apple, «Registering your app with APNs»; npm `@capacitor/push-notifications` 8.1.3 | dedotto |
| 4 | Rifiuto per «sito impacchettato» (4.2) | **Rischio medio-alto con questa build, medio-basso con A + I** | La 4.2 chiede «features, content, and UI that elevate it beyond a repackaged website». Oggi l'app nativa fa le stesse cose del sito. Riducono il rischio: <br>• posizione in background e voce con il telefono in tasca (A), che Safari non fa; <br>• controlli della Media Session sulla schermata di blocco; <br>• vibrazione all'arrivo (già in `GuidaSchede.jsx:229`); <br>• in seguito le push. <br>Le pagine sono **impacchettate** nell'app (`webDir: dist`) e non caricate da `server.url`, che Capacitor dichiara «not intended for use in production». Il revisore è lontano da Roma: GIRO-LONTANO ferma «Avvia» oltre 20 km («Sei a … km: la guida parte quando sei lì»). Senza note e un video del giro (I), non vede la funzione principale. | App Review Guidelines 4.2 e 4.2.2 (aggiornate il 16/10/2026); `node_modules/@capacitor/cli/dist/declarations.d.ts` (`server.url`); CLAUDE.md, GIRO-LONTANO | dedotto |
| 5 | Cosa chiede Apple che oggi manca | **Mancano: cancellazione account, privacy policy, consenso AI di terzi, pagine «Prossimamente», icona** | Dettaglio voce per voce nella tabella qui sotto. | App Review Guidelines 5.1.1(i), 5.1.1(v), 5.1.2(i), 2.1, 4.8; Apple, privacy manifest; `ITSAppUsesNonExemptEncryption` | verificato sul codice |

### Domanda 5, voce per voce

| Voce | Stato nel codice | Cosa dice Apple |
|---|---|---|
| Cancellazione dell'account in app | **Manca.** Nessuna funzione in `src/` né in `supabase/` (cercato: elimina/cancella/delete account) | 5.1.1(v): «If your app supports account creation, you must also offer account deletion within the app» |
| Privacy policy (URL e in app) | **Manca.** Nessuna pagina né rotta `/privacy`, nessun link | 5.1.1(i): link nel campo di App Store Connect **e** dentro l'app |
| Consenso per l'AI di terzi | **Manca.** Testo di Crea, città e tappe arrivano a OpenAI e Anthropic tramite `openai-proxy` | 5.1.2(i): «clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission» |
| Testi dei permessi | **Fatto in `ios/`:** `NSLocationWhenInUseUsageDescription` e `NSCameraUsageDescription` (`<input type="file" accept="image/*">` in `ImageUploader.jsx:95` offre la fotocamera) | 5.1.5; senza la chiave della fotocamera l'app si chiude quando si sceglie «Scatta foto» |
| Privacy manifest | **Fatto (bozza da confermare):** `ios/App/App/PrivacyInfo.xcprivacy`, tracking `false`, 9 tipi di dato (email, nome, ID utente, posizione precisa, foto, contenuti dell'utente, interazioni, acquisti, diagnostica), nessuna API «required reason» nel codice dell'app. Capacitor 8.5.3 porta i suoi `PrivacyInfo.xcprivacy` (Capacitor e Cordova) | Obbligatorio per le API «required reason» dal 1/5/2024 |
| Sign in with Apple | **Non serve.** Solo email e password (`signInWithOAuth` non esiste in `src/`) | 4.8 vale solo con login di terzi |
| Età e rating | **Da compilare** in App Store Connect (nuovo sistema dal 31/01/2026). Ci sono contenuti degli utenti: recensioni (`ReviewModal.jsx`, `TourDetails.jsx:579`) | 1.2: con contenuti degli utenti visibili ad altri servono segnalazione e blocco |
| Export compliance | **Fatto:** `ITSAppUsesNonExemptEncryption = false` (solo HTTPS di sistema) | Senza la chiave, il questionario si ripete a ogni caricamento |
| Contenuti provvisori | **Da togliere nell'app:** le pagine «Prossimamente» (`/prossimamente/*`, link da `DashboardUser.jsx:634` e `Landing.jsx`) | 2.1(a): «placeholder text … and other temporary content should be scrubbed» |
| Account per la revisione | **C'è:** l'account di prova (`ai_quota_test_account`) | 2.1: «provide either an active demo account or fully-featured demo mode» |
| Icona e schermata di avvio | **Mancano:** icona e splash sono quelli di Capacitor (`AppIcon-512@2x.png` di default) | Serve l'icona 1024×1024 vera |

## Cosa è stato fatto in questo task

- **Capacitor 8.5.3** (`@capacitor/core`, `@capacitor/ios`, `@capacitor/cli`, versioni esatte). L'8.6.0 è uscita il 28/10 ed è più nuova di due settimane, quindi non l'ho presa. `capacitor.config.json`:
  - `appId` `it.unnivai.app`;
  - `appName` `Unnivai`;
  - `webDir` `dist`.
- **`ios/`** creato con `npx cap add ios`. Con Capacitor 8 il gestore è SPM per difetto e il difetto della 7.6.9 (`--packagemanager SPM` → «CocoaPods is not installed») non c'è più. Deployment target iOS 15.0, Swift Package `capacitor-swift-pm` 8.5.3.
- **`Info.plist`:**
  - lingua `it`;
  - nome «Unnivai»;
  - testo della posizione «Durante l'uso» e testo della fotocamera;
  - `UIBackgroundModes = audio` (`location` entra insieme al plugin, voce A: dichiararla senza usarla è un motivo di rifiuto, 2.5.4);
  - `ITSAppUsesNonExemptEncryption = false`;
  - solo verticale;
  - `UIRequiredDeviceCapabilities = arm64` (era `armv7` nel modello).
- **`AppDelegate.swift`:** `AVAudioSession` con categoria `.playback`, modo `.voicePrompt`, opzioni `.duckOthers` e `.interruptSpokenAudioAndMixWithOthers`. La sessione non viene attivata all'avvio (Apple consiglia di attivarla quando l'audio parte). Sintassi controllata con `swiftc -parse`.
- **`PrivacyInfo.xcprivacy`** aggiunto alle risorse del target (`project.pbxproj`; `plutil -lint` OK). `TARGETED_DEVICE_FAMILY = 1`: solo iPhone, così servono solo gli screenshot iPhone.
- **`scripts/ios/prova-simulatore.sh`:**
  1. controlla Xcode;
  2. copia `.env` e `.env.local` da `~/unnivai-1b` senza stamparli e li cancella all'uscita;
  3. esegue `npm run build`, `controlla-chiavi --dist` e `cap sync`;
  4. costruisce per il simulatore senza firma (`CODE_SIGNING_ALLOWED=NO`), installa, concede la posizione e la mette in Piazza Navona;
  5. **controlla che l'app in esecuzione sia `it.unnivai.app` con la pagina «DoveVai»**, e solo dopo mette email e password dell'account di prova negli appunti del simulatore, che poi svuota;
  6. guida login, Crea, mappa e «Avvia»;
  7. simula il cammino con `simctl location start --speed=1.4` (10 punti nel centro di Roma);
  8. manda l'app in secondo piano per 90 secondi e prova il racconto;
  9. salva screenshot, registro e riepilogo in `docs/prove/schermate/ios-AAAA-MM-GG/`.

  Lanciato qui: esce con 2 («Xcode non è installato…») e non lascia file.
- **`eslint.config.js`:** `ios` fra le cartelle ignorate. Dopo `cap sync`, `ios/App/App/public` contiene il bundle minificato, e ESLint dava 115 errori su quei file.
- Lo spike `~/unnivai-spike-ios` (ramo `spike/ios`) è stato solo letto.

### La build web non cambia

- `npm run build` prima e dopo: entrambe riuscite. Gli hash differiscono solo per `__DV_BUILD__ = new Date().toISOString()` (`vite.config.js:81`), che cambia a ogni build.
- **Confronto a data fissa:** stessa build con `new Date()` fissato al 2026-11-02T12:00:00Z (precaricamento di Node, solo per la prova), su `origin/main` (prima 4f67944, poi di nuovo dopo il rebase su 27f7b26) e su questo ramo:
  - **93 file su 93 identici**;
  - hash dell'elenco `sha256` dei file di `dist/`: **`022f7c1b542b73f072496e537b37e787de1378ada24839ecaf62f6f63703b3b0`** per tutti e due.
- Nessun file in `src/` toccato.

### Controlli

| Controllo | Esito |
|---|---|
| `npm run test:run` | 248 file, **3092/3092** (dopo il rebase) |
| `npm run lint` | **0 errori**, 189 avvisi (come `origin/main`) |
| `npm run build` | ok |
| `npm run banco:guardia` | **12/12**, pertinenza: nessun ❌ nuovo (3 ❌, tutti già noti) |
| `node scripts/controlla-chiavi.mjs` (+ `--dist`) | nessuna chiave nei file tracciati (1742) né in `dist/` (93) |
| `npx cap sync ios` | ok (0,05 s) |

## Cosa manca, con la stima

| Voce | Cosa | Dove | Giorni |
|---|---|---|---|
| A | Posizione in background + voce in tasca: plugin, adattatore in `navTracking.js` solo nell'app nativa, `location` in `UIBackgroundModes`, testo «Sempre» richiesto dal plugin, 1 giro vero di Ivano con il telefono in tasca | `src/` + `ios/` (PR) | 2 |
| B | Cancellazione dell'account in app: tasto nel profilo + funzione con service_role che cancella utente e dati | `src/` + funzione (PR + deploy) | 2 |
| C | Privacy policy: testo (Supabase, Google Maps/Places, OpenAI, Anthropic, Stripe, Wikipedia, OpenStreetMap), pagina pubblica, link in app, URL in App Store Connect | `src/` (PR) + revisione di Ivano | 1 |
| D | Consenso esplicito prima del primo invio all'AI di terzi (5.1.2(i)) | `src/` (PR) | 0,5 |
| E | Togliere i link alle pagine «Prossimamente» nell'app (2.1) | `src/` (PR) | 0,5 |
| F | Icona 1024×1024 e schermata di avvio | `ios/` | 0,5 |
| G | Mappa nell'app: chiave Google Maps che accetti l'origine `capacitor://localhost` (DVAI-009 elenca solo `https://unnivai.vercel.app` e `localhost`; Google issue 124858510 sui referrer non http). Da vedere al primo avvio nel simulatore; se compare `RefererNotAllowedMapError`, serve una chiave per l'app o una voce nelle restrizioni | Google Cloud Console (Ivano) | 0,5 |
| H | Prova completa sul simulatore con lo script; margini dello schermo (`index.html` senza `viewport-fit=cover`, quindi `env(safe-area-inset-*)` vale 0); Screen Wake Lock nella WKWebView (se non va: `isIdleTimerDisabled` con un plugin) | `ios/` (+ `src/` se serve) | 1 |
| I | Note per la revisione + video di un giro a Roma (GIRO-LONTANO ferma il revisore lontano) | App Store Connect | 0,5 |
| J | Recensioni visibili ad altri: segnala e blocca (1.2), se restano visibili nella prima versione | `src/` (PR) | 1 |
| K | Push native (facoltative, dopo il 1/12) | `src/` + migrazione + funzione + chiave APNs | 3–4 |

Totale per il 1/12 (A–J): **9,5 giorni**.

Punti che non bloccano l'invio:
- i link delle email di conferma e di reset (`emailRedirectTo`/`redirectTo` = `window.location.origin`, `Login.jsx:98` e `AuthContext.jsx:141`) nell'app diventano `capacitor://localhost/...`, quindi si aprono sul sito e non nell'app;
- Stripe Checkout si apre in Safari e torna al sito (`APP_URL` in `create-checkout`). Per una prenotazione di un tour vale la 3.1.3(e), quindi senza acquisto in-app.

Una nota sul Mac: `~/unnivai-1b/.env` contiene `VITE_OPENAI_API_KEY`.
- Il codice non la legge: nessun riferimento in `src/`, quindi non finisce nel bundle.
- Lo script controlla `dist/` con `controlla-chiavi --dist` prima di impacchettare.
- Va comunque tolta dal file: un segreto non deve avere il prefisso `VITE_`.

## I passi di Ivano per inviare entro il 20/11, in ordine

1. **Installa Xcode** dal Mac App Store con il tuo Apple ID. Apple accetta solo build fatte con Xcode 26 o successivo e SDK iOS 26 (requisito dal 28/04/2026); questo Mac ha macOS 26.6.2. Poi lancia:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept && xcodebuild -runFirstLaunch
   xcodebuild -downloadPlatform iOS
   ```
2. **Prova sul simulatore:** `cd ~/unnivai-1b && git pull && npm ci && bash scripts/ios/prova-simulatore.sh`. Gli screenshot finiscono in `docs/prove/schermate/ios-<data>/`. Se la mappa è vuota, è la voce G.
3. **Apple Developer Program:** https://developer.apple.com/programs/enroll/, **99 USD all'anno**.
   - **Come individuo:** Apple Account con autenticazione a due fattori e nome legale. La conferma arriva per email; se non arriva entro 24 ore dall'acquisto, Apple dice di contattarla.
   - **Come organizzazione:** serve il numero **D-U-N-S**, che richiede giorni in più.
   - Sulla pagina dell'app compare come venditore il tuo nome (individuo) o la ragione sociale (organizzazione).
4. **Decidi nome e bundle id.** Proposti «Unnivai» e `it.unnivai.app`. Il bundle id non si cambia dopo il primo caricamento, e il nome deve essere libero sull'App Store. Il titolo del sito oggi è «DoveVai».
5. **Firma.** In Xcode: progetto `ios/App/App.xcodeproj`, target App, Signing & Capabilities, scegli il tuo Team, firma automatica. Xcode crea l'App ID, i certificati (Development e Distribution) e i profili. Le capability Background Modes (Audio; Location con la voce A) sono già nel progetto tramite `Info.plist`. Push Notifications solo con la voce K.
6. **App Store Connect → Le mie app → Nuova app:**
   - piattaforma iOS, nome, lingua principale italiano, bundle id, SKU;
   - **App Information:** categoria (Viaggi, seconda Navigazione), questionario dell'**età**, **URL della privacy policy** (voce C);
   - **stato di trader UE (DSA):** se sei trader, indirizzo, telefono ed email compaiono sulla pagina dell'app nell'UE.
7. **App Privacy (privacy nutrition label):** dichiara gli stessi 9 tipi di dato di `PrivacyInfo.xcprivacy` (tutti legati all'utente, nessun tracciamento, scopo «funzionalità dell'app»; interazioni anche «personalizzazione»). Controlla la bozza prima di inviare.
8. **Pagina dell'app:**
   - descrizione, parole chiave, URL di supporto;
   - **screenshot iPhone 6,9″** da 1320×2868 o 1290×2796, oppure 1260×2736 (da 1 a 10), presi dal simulatore iPhone Pro Max con lo script;
   - prezzo gratuito, disponibilità Italia/UE.
9. **Archivia e carica:** Xcode → Product → Archive (Release) → Organizer → Distribute App → App Store Connect. L'elaborazione della build richiede da qualche minuto a un'ora.
10. **Prova sul tuo iPhone** con TestFlight interno (lo fai tu con il tuo account): 10 minuti a piedi con lo schermo bloccato e il telefono in tasca. Annota se la voce parla e se il giro avanza.
11. **Invia alla revisione** entro il 20/11 con l'account di prova nelle credenziali per il revisore e le note con il video del giro (voce I). Apple rivede almeno il 50% delle app in meno di 24 ore e il 90% in meno di 48.
12. **Rilascio manuale il 1/12** (opzione «rilascia manualmente» nella versione).

## Fonti lette il 02/11/2026

- App Review Guidelines, «Last Updated: October 16, 2026»: 2.1, 2.5.4, 3.1.3(e), 4.2, 4.2.2, 4.8, 5.1.1(i), 5.1.1(v), 5.1.2(i), 5.1.5 — developer.apple.com/app-store/review/guidelines/.
- Apple Developer Documentation: «Handling location updates in the background», `allowsBackgroundLocationUpdates`, `showsBackgroundLocationIndicator`, `UIBackgroundModes`, «Configuring your app for media playback», «Privacy manifest files», «Describing use of required reason API», `ITSAppUsesNonExemptEncryption`, «Registering your app with APNs».
- Apple: programs/enroll (99 USD, D-U-N-S), support/enrollment (24 ore), distribute/app-review (50% < 24 h, 90% < 48 h), news/upcoming-requirements (Xcode 26 dal 28/04/2026, età dal 31/01/2026), App Store Connect Help (DSA trader, specifiche degli screenshot).
- Capacitor: `@capacitor/cli` 8.5.3, `declarations.d.ts` (`server.url`, `contentInset`); README di capacitor-community/background-geolocation (1.3.1, 22/10/2026).
- WebKit: bugs.webkit.org/show_bug.cgi?id=203293 (audio della WKWebView in secondo piano, chiuso in iOS 14).
- Google: issuetracker.google.com/issues/124858510 (referrer non http per le chiavi API).
