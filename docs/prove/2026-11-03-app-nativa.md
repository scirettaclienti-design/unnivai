# APP-NATIVA — posizione e voce in tasca, account demo, icona (03/11/2026)

Ramo `notte/app-nativa`, worktree `~/unnivai-notte-app-nativa`, da `origin/main` 76e3f61 (GEOCODING-LANCIO).
Punto di partenza: `docs/prove/2026-11-02-app-iphone-prova.md` (voci A, F, I e account per la revisione) e BRAND-UNNIVAI (`isAppNativa()`).

## Cosa cambia per Ivano

- **Nell'app iOS la posizione del giro continua a schermo bloccato, col solo permesso «Durante l'uso».** Durante la guida c'è l'indicatore blu in alto. «Sempre» non si chiede mai e in `Info.plist` non c'è nessuna chiave «Always».
- **Nell'app la voce del telefono la dice l'app (AVSpeechSynthesizer), non la pagina.** Oggi il credito OpenAI è finito, quindi è la voce che si sente davvero. Così una frase non si ferma a metà quando iOS sospende la pagina.
- **Account demo per il revisore Apple.** Un account con un flag scritto solo dal server vede in home «Giro di prova per la revisione»: 5 tappe vere di Catania, tutte con il racconto già in cache. Il tasto «Simula il cammino» fa camminare la posizione lungo il giro, quindi il revisore vede navigazione, arrivi, racconti, voce e fine giro anche da Cupertino. Nessun altro utente lo vede, né sul web né nell'app.
- **Icona e schermata di avvio proposte.** Sono il segnaposto del logo su fondo Ossidiana: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`. **Le deve approvare Ivano.**
- **Il sito resta com'è.** Tutto il codice nuovo passa da `isAppNativa()` più il plugin presente, oppure dal flag dell'account demo (confronto della build più sotto).

## Xcode: non c'è

- `ls /Applications | grep -i xcode`: niente.
- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: «requires Xcode, but active developer directory … is a command line tools instance».
- `xcrun --sdk iphonesimulator`: «SDK "iphonesimulator" cannot be located».

Quindi niente simulatore e niente screenshot iOS. Per il codice Swift ho fatto quello che si può fare senza Xcode (sotto). `scripts/ios/prova-simulatore.sh` è aggiornato per provare tutto in un colpo appena Xcode c'è. **Aspetta Ivano: Xcode.**

## 1. Posizione in background (voce A)

### La strada scelta: un plugin Swift locale, non `@capacitor-community/background-geolocation`

- **Il plugin della comunità è scartato.** La 1.3.1 (22/10/2026, Capacitor 8 dalla 1.2.27) chiede «Sempre». Nel suo `Plugin.swift` (righe 113–134) un watcher con `backgroundMessage` chiama `requestAlwaysAuthorization()` quando il permesso è già «Durante l'uso». Il README chiede anche `NSLocationAlwaysAndWhenInUseUsageDescription`. Il task e la nostra privacy vogliono solo «Durante l'uso».
- **Apple dice che «Durante l'uso» basta.** Fonte: documentazione di `CLLocationManager.allowsBackgroundLocationUpdates`, letta il 03/11. Dice: «When the value of this property is true and you start location updates while the app is in the foreground, Core Location configures the system to keep the app running to receive continuous background location updates, and arranges to show the background location indicator (blue bar or pill) if needed. Updates continue even if the app subsequently enters the background.» E ancora: «Setting the value to true but omitting the UIBackgroundModes key and location value in your app's Info.plist file is a fatal error».
- **L'indicatore blu con «Durante l'uso» è automatico.** Fonte: documentazione di `showsBackgroundLocationIndicator`: «For apps with When In Use authorization, the system changes the appearance of the status bar when the app uses location services in the background.»
- **Da iOS 17 serve anche una sessione.** Fonte: «Handling location updates in the background». La `CLBackgroundActivitySession` va creata in primo piano: «Create the session while your app is in the foreground».
- **Linee guida (versione del 16/10/2026).** La 2.5.4 dice: «Multitasking apps may only use background services for their intended purposes: VoIP, audio playback, location…». Qui la posizione si usa per la navigazione a piedi, che è uno scopo previsto. La 5.1.5 dice: «Use Location Services in your app only when it is directly relevant… be sure to explain the purpose in your app». Il testo del permesso lo spiega (sotto).

### Cosa c'è nel codice

| File | Cosa fa |
|---|---|
| `ios/App/App/PosizioneGiroPlugin.swift` | Plugin `PosizioneGiro`. **`avvia`** chiede «Durante l'uso» solo se non è mai stato chiesto (`requestWhenInUseAuthorization`), poi imposta `kCLLocationAccuracyBest`, `distanceFilter` 5 m, `activityType .fitness`, `pausesLocationUpdatesAutomatically = false`, `allowsBackgroundLocationUpdates = true`, `showsBackgroundLocationIndicator = true` e, da iOS 17, `CLBackgroundActivitySession()`. **`ferma`** spegne tutto. **`stato`** dà il permesso e se è attivo. Eventi: `posizione` (lat, lng, precisione, direzione, velocità, ora, `sfondo`) ed `errore` (1 negato, 2 non disponibile). |
| `ios/App/App/UnnivaiViewController.swift` | Sottoclasse di `CAPBridgeViewController`. Registra i due plugin in `capacitorDidLoad` e diventa la classe di `Main.storyboard`. I tre file Swift sono nel target App (`project.pbxproj`, fase Sources). |
| `ios/App/App/Info.plist` | `UIBackgroundModes` = `audio`, `location`. Nuovo testo di `NSLocationWhenInUseUsageDescription`: «La posizione serve per costruire il giro vicino a te e per guidarti tappa per tappa. Mentre la guida è accesa la usiamo anche a schermo bloccato, col telefono in tasca: lo vedi dall'indicatore blu.» |
| `src/lib/posizioneNativa.js` | Veste il plugin da `navigator.geolocation` (`watchPosition`/`clearWatch`). Così `avviaTracciamento` (NAV-1) non cambia: stessi stati `attesa | ok | perso | negato`, stesso contratto per MapPage. **La sessione nativa è una sola**: un `clearWatch` seguito da un nuovo `watchPosition` entro 3 s (i riavvii di NAV-1 dopo silenzio, errore o ritorno in primo piano) non la spegne. Su iPhone conta, perché in background iOS lascia continuare solo gli aggiornamenti partiti in primo piano. |
| `src/lib/navTracking.js` | `geolocationDellaNavigazione()`: il plugin nativo solo se `isAppNativa()` e `Capacitor.isPluginAvailable('PosizioneGiro')`. In tutti gli altri casi resta `navigator.geolocation`: il sito, e un'app costruita prima di questo lavoro. |
| `src/pages/MapPage.jsx` | La navigazione chiama `avviaTracciamento({ geolocation: geolocationDellaNavigazione() })` (o la posizione simulata del demo). Il pallino della mappa fuori dalla guida resta su `navigator.geolocation`. |

## 2. Voce e racconti col telefono in tasca

### Cosa ferma l'audio della pagina, con le fonti

1. **L'audio `<audio>` della WKWebView continua in background.** Bug WebKit 203293, chiuso in iOS 14 (citato nel report del 02/11). Servono `UIBackgroundModes = audio` e la categoria `.playback`, che c'erano già. Capacitor 8.5.3 imposta `mediaTypesRequiringUserActionForPlayback = []` (`CAPBridgeViewController.swift:125`): nell'app nessun tocco serve per far partire l'audio.
2. **La pagina viene sospesa poco dopo l'uscita dall'app**, anche se l'app nativa resta viva. Lo dicono Capawesome («the web view that runs your JavaScript is suspended shortly after the user leaves the app… the event only fires while the web view is alive», 12/10/2026) e il README di Cap-go («The callback only runs while the WebView does»).
3. **Gli eventi del plugin svegliano la pagina, se l'app è viva senza limite di tempo.** Lo dice il codice di WebKit (`main`, letto il 03/11):
   - Capacitor manda gli eventi del plugin con `webView.evaluateJavaScript` (`CapacitorBridge.swift:603`).
   - In WebKit, `WebPageProxy::runJavaScriptInFrameInScriptWorld` prende una **foreground activity** sul processo della pagina se `canTakeForegroundAssertions()` (`WebPageProxy.cpp:8528`).
   - Su iOS (`PageClientImplIOS.mm:219–231`) quella funzione è vera se l'app è visibile **oppure** se il processo dell'app non ha limiti di tempo in background: «If there is no run time limitation… we let such processes take foreground assertions».
   - Con la posizione in background Core Location «keep[s] the app running».
   - **Deduzione:** ogni posizione arriva al JavaScript, che fa girare arrivo, curiosità e `parla()`. Mentre l'audio suona, l'audio stesso tiene viva la pagina (punto 1). **Resta da provare su iPhone:** la deduzione vale solo se un'app tenuta viva dalla posizione non ha limiti di tempo.
4. **Lo `speechSynthesis` della pagina** parla dal processo della pagina e non ha l'assicurazione dell'audio di un `<audio>`: a schermo bloccato può fermarsi a metà frase. Per questo, nell'app, il ripiego è **`VoceNativa`** (`ios/App/App/VoceNativaPlugin.swift`, `src/lib/voceNativa.js`):
   - AVSpeechSynthesizer nel processo dell'app, con la sessione `.playback`/`.voicePrompt` dell'AppDelegate;
   - l'ultima frase vince;
   - `fermaVoce()` la zittisce;
   - a fine frase la sessione si disattiva con `notifyOthersOnDeactivation`, così la musica abbassata torna su.

   In `voce.js` cambiano tre righe: `paroleDelBrowser` → `parlaNativa` se `voceNativaDisponibile()`, più due `fermaVoceNativa()`. Sul web non cambia niente.

### Cosa è provato e cosa no

| Cosa | Esito | Come |
|---|---|---|
| Adattatore della posizione: stati, riavvii senza spegnere il nativo, negato, scelta web/nativo | **provato** | `posizioneNativa.test.js`, 11 test (Capacitor simulato nativo e web) |
| Voce di ripiego nativa nell'app, speechSynthesis sul web, «ferma», plugin assente | **provato** | `voceNativa.test.js`, 5 test, più i 17 di `voceClient.test.js` invariati |
| Swift: sintassi e tipi | **provato senza Xcode** | `bash scripts/ios/controlla-swift.sh`: `swiftc -parse` dei 5 file. Poi controllo dei tipi dei 3 file nuovi compilandoli per **Mac Catalyst** (SDK macOS + `iOSSupport`: UIKit, CoreLocation, AVFAudio) contro uno stub delle firme di Capacitor 8.5.3 (`scripts/ios/capacitor-stub.swift`), per iOS 15.0 e 17.0 in modalità Swift 5 come il progetto. 0 errori, 1 avviso «Sendable» su `AVSpeechSynthesizer` (solo avviso). |
| Build nativa, simulatore, posizione in background nel simulatore, eventi JS a schermo bloccato | **non provato** (manca Xcode) | `scripts/ios/prova-simulatore.sh`: in secondo piano conta le righe «posizione nativa in background» del registro (il client ne scrive una ogni 10 posizioni con `sfondo: true`) |
| La voce che parla col telefono in tasca e il giro che avanza | **non provato** | spetta a Ivano su iPhone vero (CLAUDE.md): procedura sotto |

### Procedura su iPhone per Ivano (un giro vero, telefono in tasca)

1. Installa la build sul tuo iPhone: TestFlight interno, oppure da Xcode col tuo Team.
2. Apri l'app, entra, scegli un giro vicino (5–6 tappe) e premi «Avvia». Concedi la posizione **«Mentre usi l'app»**. Se iOS chiede «Sempre», è un difetto: annotalo.
3. Accendi la voce (tasto Voce). Blocca lo schermo e metti il telefono in tasca.
4. Cammina fino alla prima tappa. Annota:
   - (a) l'indicatore blu in alto quando riaccendi lo schermo;
   - (b) se la voce dice le svolte e «Si va verso…»;
   - (c) se all'arrivo senti la prima frase del racconto;
   - (d) se una curiosità parla durante il cammino.
5. Alla seconda tappa sblocca: la mappa deve mostrarti dove sei, la tappa 1 segnata come fatta e niente «Sei passato da…» per la tappa 1.
6. Ripeti per altre 2 tappe con la musica accesa: la voce la abbassa e poi la musica torna su.
7. Se la voce tace a schermo bloccato ma parla a schermo acceso, vale il piano B nelle proposte. Mandami l'ora e cosa non è partito.

## 3. Account demo per il revisore Apple

| Pezzo | Dove |
|---|---|
| Chi è il demo | `src/lib/demoRevisore.js`: `app_metadata.unnivai_demo_revisore === true`. `app_metadata` lo scrive solo il server (service role). Il flag in `user_metadata`, che l'utente può cambiare con `updateUser`, **non conta**. Un account anonimo non è mai il demo. |
| Il giro | `src/data/giroDemo.js`: 5 tappe vere di Catania con place_id e coordinate da `places_cache`, tutte con il racconto **passato** in `place_racconti` (lettura del 03/11, solo SELECT): Fontana dell'Elefante r5, Cattedrale di Sant'Agata r4, Porta Uzeda r6, Fontana dell'Amenano r6, Castello Ursino r6. Sono versioni ancora valide (`VERSIONI_ANCORA_VALIDE`), quindi i racconti si leggono dalla cache. Nessun testo inventato. |
| La posizione simulata | `src/lib/camminoSimulato.js`, nella forma di `navigator.geolocation`. Sta ferma in via Etnea, ~250 m a nord di piazza Duomo (vicina, quindi GIRO-LONTANO non ferma «Avvia»). Con «Simula il cammino» cammina a 2,5 m/s (dentro gli 0,4–3 m/s delle curiosità) lungo ~940 m e si ferma 25 s a ogni tappa, il tempo della scheda d'arrivo. Finisce al Castello Ursino. |
| Dove si vede | `CardGiroDemo` in home (DashboardUser) apre la mappa col giro. `SimulaCammino` (tasto a sinistra a metà schermo, ≥ 44 px) compare solo in navigazione e solo se `giroDemoAttivo(utente, giro)`. MapPage dà la posizione simulata al centro della mappa e al tracciamento solo in quel caso. Testi in `src/lib/testiAppNativa.js`. |
| Test | `demoRevisore.test.js` (12): solo quel flag; mai `user_metadata`, valori non booleani, ospite; il cammino tocca le 5 tappe in ordine entro 25 m e non supera il passo; lo script di Ivano. `cardGiroDemo.test.jsx` (4). `mapPageDemo.test.jsx` (4, la mappa vera in jsdom). Con l'account demo e il telefono «a Cupertino», «Avvia» guida, il GPS vero non si usa e il cammino arriva a tutte le tappe fino alla **fine giro** («Catania, a modo tuo.»). Un altro utente con lo stesso giro ha il GPS vero, vede «Sei a … km da Catania» e nessun tasto. L'account demo con un altro giro ha il GPS vero. |

**L'utente non l'ho creato** (regola). Comandi per Ivano, a scelta:

```bash
# A) con la chiave service role nell'ambiente (mai nel repo): crea l'utente con email confermata, ruolo explorer e flag
DEMO_EMAIL='…' DEMO_PASSWORD='…' SUPABASE_SERVICE_ROLE_KEY='…' node scripts/ios/account-demo.mjs --crea
# B) registrazione dall'app o dal sito come un utente qualunque, poi la riga per il SQL Editor:
node scripts/ios/account-demo.mjs --sql <email-del-demo>
# controllo: deve essere 1
SUPABASE_SERVICE_ROLE_KEY='…' node scripts/ios/account-demo.mjs --controlla
```

Dopo aver acceso il flag bisogna uscire e rientrare, perché il flag viaggia nel token. Per la prova sul simulatore metti `DEMO_EMAIL` e `DEMO_PASSWORD` in `~/unnivai-1b/.env.local`.

### Testo per «Notes for Review» (App Store Connect, inglese)

> Unnivai is a walking guide for Italian cities: it builds a walk, then guides you on foot stop by stop with voice directions and a short story at each stop, also with the screen locked (location in the background, "While Using the App" permission only, blue indicator visible).
>
> The guide only starts when you are near the walk (within 20 km). Because you are not in Italy, the demo account has a fixed demo walk in Catania with simulated location:
> 1. Sign in with the demo account below. Accept the AI notice ("Va bene").
> 2. On the home screen tap "Giro di prova per la revisione".
> 3. Tap "Avvia" (Start), then the speaker icon to turn on the voice.
> 4. Tap "Simula il cammino" (Simulate the walk). The position walks along the route (about 7 minutes plus a short pause at each of the 5 stops): you will see turn-by-turn guidance, the arrival card with the story of each stop, and the end-of-walk screen.
> 5. You can lock the screen during the walk: the guide keeps tracking and speaking.
>
> The simulated walk exists only for this demo account; regular users always use their real location. The app is in Italian.
> Demo account: [email] / [password]

## 4. Icona e schermata di avvio (voce F) — proposta

- **Icona:** `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`, 1024×1024, RGB a 8 bit, **senza alfa** (`sips`: `hasAlpha: no`).
- **Segno:** il segnaposto del logo di unnivai.com, col cerchio vuoto e i quadratini che si staccano in alto a destra. Il logo pubblicato è 441×125 e orizzontale, quindi non è un'icona: il pin è ridisegnato in vettoriale.
- **Colori:** fondo Ossidiana `#06161E`; sfumatura da `#FF6B3D` (in basso a sinistra) all'ambra `#FFA63D` (in alto a destra), come il logo.
- **Avvio:** i tre `splash-2732x2732*.png` sono uguali tra loro, con lo stesso segno più piccolo al centro su Ossidiana (la LaunchScreen li ritaglia «aspect fill»).
- **Riproducibile:** `node scripts/ios/genera-icona.mjs` (nessuna dipendenza: forme calcolate punto per punto e PNG scritto con zlib); `--controlla` confronta coi file, ed è anche un test.
- **È una proposta: la deve approvare Ivano.** Il nome «Unnivai» non è nell'icona, perché Apple lo mostra sotto.

## 5. Script del simulatore

`scripts/ios/prova-simulatore.sh`, aggiornato:

1. prima della build: `controlla-swift.sh` e `genera-icona.mjs --controlla`;
2. dopo la build: `location` in `UIBackgroundModes` del pacchetto, nessuna chiave «Always», `Assets.car` presente;
3. screenshot della schermata di avvio;
4. secondo piano di 90 s col cammino simulato acceso: screenshot (indicatore blu) e conteggio delle posizioni arrivate al JavaScript;
5. con `DEMO_EMAIL`/`DEMO_PASSWORD`: account demo con la posizione del simulatore a Cupertino (37.3349, -122.0090), giro di prova, «Simula il cammino», screenshot all'arrivo e alla fine giro;
6. icona sulla Home.

Lanciato qui: esce con 2 («Xcode non è installato…») e non lascia file.

## Prove

| Controllo | Esito |
|---|---|
| `npm run test:run` | **264 file, 3272/3272** (47 test nuovi in 6 file) |
| `npm run lint` | **0 errori**, 186 avvisi (`origin/main`: 187) |
| `npm run build` | ok |
| `node scripts/controlla-chiavi.mjs` (+ `--dist`) | nessuna chiave (1812 file tracciati, 96 in `dist/`) |
| `npm run banco:guardia` | **12/12**, pertinenza: nessun ❌ nuovo (3 ❌, tutti già noti) |
| `npx cap sync ios` | ok (nessun plugin npm: i due plugin sono nel target App) |
| `bash scripts/ios/controlla-swift.sh` | sintassi ok (5 file); tipi ok per iOS 15 e 17 (Mac Catalyst + stub) |
| `node scripts/ios/genera-icona.mjs --controlla` | uguali ai file |

### La build web: identica salvo il codice dietro `isAppNativa()` e il flag del demo

Stesso metodo del 02/11: `new Date()` fissato al 2026-11-03T12:00:00Z (precaricamento di Node, solo per la prova). Due build: `origin/main` 76e3f61 in un worktree a parte e questo ramo.

- **Build normale:** 96 file contro 96. Gli hash cambiano a cascata perché cambia `index.js`, quindi il confronto utile è il prossimo.
- **Stessa build senza hash nei nomi e senza minificazione:** 93 file per parte. **81 identici**, 11 diversi, 1 rinominato. Uno per uno:

| File | Differenza | Effetto sul web |
|---|---|---|
| `index.js` | 2 export in più (`Capacitor`, `registerPlugin`, già nel bundle per `isAppNativa`); le lettere degli alias si spostano. Nessuna riga di codice diversa | nessuno |
| `TopBar`, `useAILearning`, `useUserContext`, `useUserNotifications`, `cityCenterService`, `placesDiscoveryService`, `MapAPIWrapper` | solo la riga `import` (lettere degli alias) | nessuno |
| `GpsActivationBanner.js` → `testiAppNativa.js` | Rollup rinomina il pezzo condiviso. Dentro ci sono lo stesso codice di prima, `demoRevisore` (4 righe) e i testi | nessuno |
| `DashboardUser.js` | `CardGiroDemo` e `GIRO_DEMO`. La scheda rende `null` senza il flag del server | nessuno per chi non è il demo |
| `MapPage.js` | `posizioneNativa`, `voceNativa`, `camminoSimulato`, `SimulaCammino`. `navigator.geolocation` passa da `geoMappa()`/`geolocationDellaNavigazione()`, che sul web danno `navigator.geolocation`. Due parametri `distanzaM` rinominati dal bundler | nessuno (stesso oggetto di prima) |
| `index.css` | `.sr-only` in più (la usa solo la scheda del demo) | nessuno |

Nessun file in `supabase/`. Nessuna migrazione, nessun secret, nessun deploy di funzioni.

## Dopo il merge (`31c9c75`)

- CI su `main` verde (run 41530989585); Vercel «Deployment has completed». Il sito serve `<title>Unnivai | …`. Il pezzo `MapPage-*.js` pubblicato contiene `PosizioneGiro` e `VoceNativa`.
- `node scripts/prova-nav/collaudo-sito.webkit.mjs 1,2,3,7` (WebKit iPhone 14, account di prova, sul sito pubblicato), cioè i punti della navigazione toccata da questo task:
  - **1, 2, 3 ok** (freccia dopo 10 m, tappa 2 dopo «Salta», GPS muto 60 s e ripresa);
  - **7 ok con l'account**;
  - **7 da ospite non passa**: gli accessi anonimi sono spenti nel pannello Supabase. È atteso, come nei collaudi del 02 e 03/11.
- Esiti in `docs/prove/dati/2026-10-30-collaudo-sito.json`, schermate in `docs/prove/schermate/collaudo-sito/`.
- `.env.local` copiato da `~/unnivai-1b` solo per il collaudo e cancellato subito dopo.

## Costo AI

**0 $ per il lavoro del task.** Nessuna chiamata ad Anthropic né a OpenAI durante il lavoro. Il collaudo dopo il merge ha fatto le generazioni solite dei punti 1, 2, 3 e 7 con l'account di prova (nessun contatore). Le letture del database sono solo SELECT (Supabase MCP) per scegliere tappe con racconto in cache. Le ricerche web sono state fatte con Firecrawl (crediti di ricerca, non costo AI del progetto).

Per il revisore:
- i racconti delle 5 tappe sono in cache: 0 $;
- le curiosità del cammino di Catania possono generarne qualcuna nuova (al più una per richiesta, dentro `RACCONTO_DAILY_CAP`);
- la voce umana costa 0 $ finché il credito OpenAI è finito (parla la voce del telefono); dopo, una frase nuova costa la prima volta e poi viene dalla cache.

## Cosa NON risolve

- **Simulatore e iPhone non provati** (manca Xcode). La build Xcode vera può trovare errori di firma di Capacitor che lo stub non vede.
- **La pagina in background** (punto 2.3) è una deduzione dal codice di WebKit. Se su iPhone la WebView non riceve gli eventi a schermo bloccato, la voce delle svolte e degli arrivi tace finché non si sblocca (vedi la proposta B).
- I controlli della **Media Session** sulla schermata di blocco nella WKWebView non sono verificati.
- **Screen Wake Lock** nella WKWebView (voce H) e **chiave Google Maps per `capacitor://localhost`** (voce G): non toccati.
- **Il video del giro** per la revisione (voce I) lo fa Ivano. L'account demo lo rende meno necessario, ma il video aiuta.
- **Crea / Quiz / Sorprendimi** dal revisore genereranno giri dove si trova lui. GIRO-LONTANO non cambia: le note lo spiegano.
- Il flag del demo vale dopo un nuovo accesso (il token porta `app_metadata`).

## Passi che aspettano Ivano

1. **Xcode** (passo 1 del report del 02/11), poi `cd ~/unnivai-1b && git pull && npm ci && bash scripts/ios/prova-simulatore.sh` (con `DEMO_EMAIL`/`DEMO_PASSWORD` in `.env.local` per la parte del demo).
2. **Approvare o cambiare l'icona** (`ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`). Per cambiarla: colori e forme in `scripts/ios/genera-icona.mjs`, poi rilanciarlo.
3. **Creare l'account demo**: `scripts/ios/account-demo.mjs --crea` (oppure registrazione + `--sql`), poi `--controlla` = 1. Email e password vanno in App Store Connect (Sign-In Information) con il testo delle Notes for Review qui sopra.
4. **Un giro vero col telefono in tasca** (procedura al punto 2), con TestFlight interno.

## Proposte (non fatte: niente funzioni non chieste)

- **B. Se a schermo bloccato la pagina non riceve le posizioni:** il plugin nativo controlla da solo l'arrivo alla prossima tappa (25 m, la soglia di MapPage) e dice con `VoceNativa` la frase d'arrivo che la pagina gli ha passato prima. È un geofence nativo, senza «Sempre», perché la sessione è già attiva.
- **Avviso sulla scelta del permesso:** se l'utente concede la posizione «Una volta», la guida a schermo bloccato funziona fino alla fine della sessione. Si può dire nella scheda «Avvia».
- **Lingua per il revisore:** una riga inglese nella scheda del giro demo (oggi tutto in italiano, come l'app).

## Fonti lette il 03/11/2026

- **Apple Developer Documentation:**
  - `CLLocationManager.allowsBackgroundLocationUpdates`;
  - `showsBackgroundLocationIndicator`;
  - «Handling location updates in the background»;
  - `CLBackgroundActivitySession`.
- **App Review Guidelines** («Last Updated: October 16, 2026»): 2.5.4, 5.1.5.
- **capacitor-community/background-geolocation:** README e `ios/Plugin/Swift/Plugin.swift` (1.3.1).
- **Capawesome**, «How to Track Location in the Background with Capacitor» (12/10/2026).
- **Cap-go/capacitor-background-geolocation:** README.
- **WebKit** `main`:
  - `Source/WebKit/UIProcess/WebPageProxy.cpp` (`runJavaScriptInFrameInScriptWorld`);
  - `Source/WebKit/UIProcess/ios/PageClientImplIOS.mm` (`canTakeForegroundAssertions`).
- **Capacitor iOS 8.5.3** (`node_modules/@capacitor/ios`):
  - `CapacitorBridge.swift` (`toJs` → `evaluateJavaScript`, `registerPluginInstance`);
  - `CAPBridgeViewController.swift` (`capacitorDidLoad`, `mediaTypesRequiringUserActionForPlayback`).
