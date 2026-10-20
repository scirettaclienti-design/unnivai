# CLASSI-TRASPARENTI — gli sfondi e i colori con opacità tornano visibili in tutta l'app

Ramo `classi-trasparenti` (da `origin/main` 588c636), lavoro in `~/unnivai-2` (worktree). Nessun push su main, nessun deploy, nessuna migrazione. Nessuna chiamata a pagamento: spesa 0 $.

## 1. Elenco e causa

**Causa, in una riga:** i colori della Scala Ossidiana (e brand, ochre, terracotta, shadcn) sono variabili CSS (`var(--obsidian-card)`) e Tailwind v3 non sa applicare un'opacità a un colore che non conosce: `bg-obsidian-card/95` non produceva nessuna regola, quindi nessuno sfondo, bordo, ombra o testo.

**Misura** (build di main, 588c636; ogni classe `colore/NN` scritta in `src/`, comprese le varianti `hover:`, `group-hover:`, `focus:`, `disabled:`, `placeholder:`): 179 classi con opacità distinte, **52 senza CSS, 168 usi**, in 36 file. Il «79 usi» della nota D4 contava solo una parte delle famiglie: le classi senza CSS sono in realtà di più famiglie.

| Famiglia | Usi senza CSS |
|---|---|
| `border-brand-orange` | 33 |
| `text-obsidian-secondary` | 32 |
| `shadow-brand-orange` | 28 |
| `bg-obsidian-card` (+ `via-obsidian-card`) | 24 |
| `bg-brand-orange` | 13 |
| `bg-obsidian-bg` | 13 |
| `ring-brand-orange` | 7 |
| `bg-obsidian-raised`, `border-obsidian-border` | 10 |
| altre (`border-obsidian-secondary`, `shadow-terracotta-500`, `text-brand-orange`, `border-ochre-500`, `border-terracotta-500`, `bg-obsidian-secondary`) | 8 |

Elenco completo (classe, usi, file in `src/`):

| Classe | Usi | File |
|---|---|---|
| `shadow-brand-orange/20` | 26 | components/Map/POIDetailDrawer.jsx components/Map/QuickPathSummary.jsx components/TopBar.jsx pages/AiItinerary.jsx pages/DashboardUser.jsx pages/Explore.jsx pages/Login.jsx pages/Notifications.jsx pages/Photos.jsx pages/QuickPath.jsx pages/SurpriseTour.jsx pages/TourDetails.jsx pages/TourLive.jsx |
| `text-obsidian-secondary/70` | 9 | components/Map/POIPopupCard.jsx components/TopBar.jsx pages/Landing.jsx pages/Notifications.jsx pages/Onboarding.jsx pages/Profile.jsx pages/TourDetails.jsx |
| `border-brand-orange/30` | 9 | components/GpsActivationBanner.jsx components/Map/POIDetailDrawer.jsx pages/DashboardUser.jsx pages/Landing.jsx pages/MapPage.jsx pages/Notifications.jsx pages/Profile.jsx pages/SurpriseTour.jsx |
| `bg-obsidian-card/90` | 9 | pages/MapPage.jsx pages/TourDetails.jsx |
| `placeholder:text-obsidian-secondary/50` | 7 | components/TopBar.jsx pages/Login.jsx pages/Notifications.jsx |
| `border-brand-orange/40` | 6 | App.jsx pages/DashboardUser.jsx pages/Login.jsx pages/SurpriseTour.jsx pages/TourDetails.jsx |
| `ring-brand-orange/40` | 6 | components/FoodPrefsEditor.jsx components/InterestsEditor.jsx pages/AiItinerary.jsx pages/DashboardUser.jsx pages/SurpriseTour.jsx |
| `bg-brand-orange/10` | 6 | components/Map/MapMarker.jsx components/Map/POIPopupCard.jsx pages/Landing.jsx pages/MapPage.jsx pages/SurpriseTour.jsx |
| `bg-obsidian-bg/75` | 5 | components/TopBar.jsx pages/AiItinerary.jsx pages/Notifications.jsx pages/TourDetails.jsx |
| `bg-obsidian-card/80` | 5 | pages/Landing.jsx pages/TourDetails.jsx |
| `hover:border-brand-orange/60` | 5 | pages/Login.jsx pages/QuickPath.jsx |
| `border-brand-orange/20` | 4 | components/Map/POIPopupCard.jsx pages/Landing.jsx pages/MapPage.jsx |
| `text-obsidian-secondary/40` | 4 | pages/AiItinerary.jsx pages/Profile.jsx |
| `bg-obsidian-bg/80` | 4 | pages/DashboardUser.jsx pages/Profile.jsx |
| `bg-obsidian-card/60` | 3 | components/NotificationBell.jsx pages/DashboardUser.jsx pages/Notifications.jsx |
| `via-obsidian-card/40` | 3 | components/Map/QuickPathSummary.jsx pages/Profile.jsx pages/SurpriseTour.jsx |
| `text-obsidian-secondary/60` | 3 | components/Map/POIDetailDrawer.jsx pages/DashboardUser.jsx pages/Profile.jsx |
| `text-obsidian-secondary/50` | 3 | components/Map/POIDetailDrawer.jsx pages/Notifications.jsx pages/SurpriseTour.jsx |
| `bg-obsidian-card/95` | 3 | components/Map/NavigationHUD.jsx pages/DashboardUser.jsx pages/MapPage.jsx |
| `bg-brand-orange/20` | 3 | pages/AiItinerary.jsx pages/MapPage.jsx pages/SurpriseTour.jsx |
| `placeholder:text-obsidian-secondary/60` | 3 | pages/DashboardUser.jsx pages/Explore.jsx pages/MapPage.jsx |
| `border-brand-orange/60` | 3 | pages/DashboardUser.jsx pages/Login.jsx pages/MapPage.jsx |
| `group-hover:border-brand-orange/40` | 3 | pages/QuickPath.jsx |
| `shadow-brand-orange/30` | 2 | components/NotificationBell.jsx pages/QuickPath.jsx |
| `bg-obsidian-raised/60` | 2 | components/Map/QuickPathSummary.jsx pages/SurpriseTour.jsx |
| `border-brand-orange/50` | 2 | components/Map/MapMarker.jsx components/Map/NavigationHUD.jsx |
| `bg-brand-orange/15` | 2 | components/Map/POIDetailDrawer.jsx pages/DashboardUser.jsx |
| `border-obsidian-border/50` | 2 | components/Map/NavigationHUD.jsx pages/Notifications.jsx |
| `disabled:text-obsidian-secondary/40` | 2 | pages/Notifications.jsx |
| `hover:border-obsidian-border/80` | 2 | pages/DashboardUser.jsx |
| `focus:ring-brand-orange/50` | 1 | components/TopBar.jsx |
| `shadow-terracotta-500/30` | 1 | components/ChatModalUser.jsx |
| `hover:border-brand-orange/40` | 1 | components/GpsActivationBanner.jsx |
| `text-brand-orange/50` | 1 | components/TourCover.jsx |
| `hover:bg-obsidian-raised/80` | 1 | components/NotificationBell.jsx |
| `via-obsidian-card/70` | 1 | components/Map/POIDetailDrawer.jsx |
| `text-obsidian-secondary/80` | 1 | components/Map/NavigationHUD.jsx |
| `bg-obsidian-bg/70` | 1 | pages/Landing.jsx |
| `bg-brand-orange/40` | 1 | pages/Landing.jsx |
| `border-ochre-500/20` | 1 | pages/Landing.jsx |
| `border-terracotta-500/20` | 1 | pages/Landing.jsx |
| `shadow-terracotta-500/20` | 1 | pages/Prossimamente.jsx |
| `hover:bg-obsidian-raised/60` | 1 | pages/SurpriseTour.jsx |
| `bg-obsidian-secondary/60` | 1 | pages/Profile.jsx |
| `bg-obsidian-bg/60` | 1 | pages/Profile.jsx |
| `border-obsidian-secondary/40` | 1 | pages/Notifications.jsx |
| `bg-obsidian-bg/95` | 1 | pages/MapPage.jsx |
| `hover:bg-obsidian-raised/50` | 1 | pages/MapPage.jsx |
| `border-obsidian-border/40` | 1 | pages/MapPage.jsx |
| `border-obsidian-secondary/50` | 1 | pages/TourDetails.jsx |
| `bg-obsidian-bg/85` | 1 | pages/Explore.jsx |
| `bg-brand-orange/60` | 1 | pages/QuickPath.jsx |

## 2. Correzione (alla radice)

Un solo file: `tailwind.config.js`. Ogni colore del tema che è una `var(...)` passa da `abilitaOpacita`: senza modificatore la classe resta **identica a prima** (`background-color: var(--obsidian-card)`); con `/NN` diventa `color-mix(in srgb, var(--x) NN%, transparent)`, qualunque sia il formato della variabile (esadecimale o hsl). I colori già esadecimali (`status-*`, `ivory-badge`) e quelli di Tailwind non cambiano. Nessun colore, font, spaziatura o layout è stato toccato: nessun file in `src/` modificato. **Nessun caso corretto a mano.**

Ricaduta: le classi senza opacità non cambiano; le 168 classi con opacità ora esistono. `color-mix` richiede Safari 16.2+ / Chrome 111+ (browser del 2023): un browser più vecchio ignora la regola, come prima.

Una voce resta nell'elenco della scansione: `text-obsidian-secondary/80` in `components/Map/NavigationHUD.jsx`, ma sta solo in un commento (la barra l'ha tolta in NAV-1-FIX): non è un uso.

Guardia contro il ritorno: `src/__tests__/styles/classiConOpacita.test.js` scansiona `src/` (commenti esclusi) e fallisce se una classe `colore/NN` non produce CSS. Rosso sulla configurazione di main (elenca le classi mancanti), verde con la correzione.

## 3. Prova visiva (WebKit, iPhone 13, account di prova, GPS finto)

Script: `scripts/prova-nav/classi-trasparenti.webkit.mjs` (due `vite preview`: build di main e build del ramo; porta e titolo verificati prima delle credenziali). Schermate (JPEG): `docs/prove/schermate/classi-trasparenti/prima/` e `.../dopo/`, stesso nome file. Pixel diversi sopra soglia, dopo/prima:

| Schermata | File | Pixel cambiati |
|---|---|---|
| Riquadro «Dove ti trovi?» | `00-riquadro-citta.jpg` | 1,4% |
| Home | `01-home.jpg` | 0,9% |
| Scheda giro | `02-scheda-giro.jpg` | 1,0% |
| Quiz | `03-quiz.jpg` | 0,1% |
| Profilo | `04-profilo.jpg` | 0,2% |
| Navigazione (barra) | `05-navigazione.jpg` | 23,9%* |
| Mappa con giro | `06-mappa-scheda-tappa.jpg` | 1,1% |
| Sorprendimi | `07-sorprendimi.jpg` | 1,0% |
| Notifiche, Esplora, Itinerario AI, Tour live, Trending, Impostazioni, Foto, Prossimamente | `08-notifiche`, `09-esplora`, `10-itinerario-ai`, `11-tour-live`, `12-trending`, `13-impostazioni-notifiche`, `14-foto`, `15-prossimamente` | 0,1–0,7% |
| Landing, Login, Onboarding | `16-landing`, `17-login`, `18-onboarding` | 1,4% / 0,4% / 0,0% |

*La navigazione cambia molto in pixel perché la mappa di Google (3D) non è identica fra due caricamenti; le due differenze dovute al CSS sono sotto.

**Cosa cambia a vista** (tutto ciò che prima non aveva CSS):
- **Bordi arancioni** al posto del bordo bianco/grigio predefinito di Tailwind: «Crea il tuo Percorso» in home, riquadro «Sei passato da…?» e campo città nel riquadro, tasto «Inizia Gratis».
- **Pillole e badge** con fondo arancione tenue (`bg-brand-orange/10`, «GRATIS & SU MISURA»), **ombre arancioni** sui tasti.
- **Barra di navigazione**: la pista di avanzamento non ha più il contorno bianco (ora fondo scuro `border-obsidian-border/50` + tenue).
- **Velo dietro i riquadri** (`bg-obsidian-bg/80`): ora la pagina dietro il riquadro «Dove ti trovi?» è scurita, prima era piena e nitida.
- **Testi attenuati** (`text-obsidian-secondary/40…70`): ora davvero più spenti (Profilo: «TOUR», «GUIDE», «RATING», il trattino delle statistiche; esempio in «Travel Designer AI»; riga «Il tuo primo giro ti aspetta»).

### Testi che diventano poco leggibili col nuovo effetto (segnalati qui; corretti in CLASSI-TRASPARENTI-2, sezione 7)

Contrasto calcolato sul fondo scuro (secondario `#A8A29E`; AA = 4,5:1): `/80` 5,1 · `/70` 4,2 · `/60` 3,4 · `/50` 2,7 · `/40` 2,2. Per dimensione normale falliscono `/70`, `/60`, `/50`, `/40`:

- **/40 (2,2:1, illeggibili):** `pages/Profile.jsx` (trattini delle statistiche), `pages/AiItinerary.jsx` (tasto spento), `pages/Notifications.jsx` (`disabled:`, 2 tasti).
- **/50 (2,7:1):** `components/Map/POIDetailDrawer.jsx`, `pages/Notifications.jsx`, `pages/SurpriseTour.jsx` (tasti spenti); segnaposto con `placeholder:` in `components/TopBar.jsx`, `pages/Login.jsx`, `pages/Notifications.jsx`.
- **/60 (3,4:1):** `components/Map/POIDetailDrawer.jsx`, `pages/DashboardUser.jsx`, `pages/Profile.jsx` (versione); segnaposto in `pages/DashboardUser.jsx`, `pages/Explore.jsx`, `pages/MapPage.jsx`.
- **/70 (4,2:1, al limite):** `components/Map/POIPopupCard.jsx`, `components/TopBar.jsx`, `pages/Landing.jsx`, `pages/Notifications.jsx`, `pages/Onboarding.jsx`, `pages/Profile.jsx`, `pages/TourDetails.jsx`.
- Bordi `border-brand-orange/20…30` e `ring-…/10`: volutamente tenui, non sono testo.
Proposta (non fatta, non richiesta): portare i testi `/40…/60` a `/80` o al secondario pieno, come già fatto per la barra in NAV-1-FIX.

## 4. Controlli

| Controllo | Esito |
|---|---|
| Suite | **171 file, 2165 test verdi** (2163 prima + 2 nuovi) |
| Lint | **0 errori** (194 avvisi, già presenti) |
| Build | ok |
| Guardia della home (`npm run banco:guardia`) | **PASSATA 12/12**; i ❌ di pertinenza sono quelli già noti (`pertinenza-noti.json`), nessuno nuovo; il replay non tocca CSS |
| Produzione | invariata (nessun push su main, nessun deploy) |

## 5. Processi

I due `vite preview` (porte 5191, 5192) e i browser WebKit sono chiusi. La cartella `~/unnivai-2` resta. `.env` e `.env.local` copiati in `~/unnivai-2` (ignorati da git, mai stampati).

## 6. Cosa ho dato per vero senza verificarlo

- Che l'elenco 168 usi / 52 classi sia completo: la scansione cerca classi scritte per intero in `src/`. Una classe composta a runtime (bg-${colore}/50) non la vede; non ho cercato questi casi.
- Che le schermate fotografate coprano ogni punto dove il cambio è visibile: ho fatto 19 schermate raggiungibili con l'account di prova; non ho aperto modali e stati raggiungibili solo con azioni (pagamento, prenotazioni, chat, schede POI, ruoli guida/attività), che usano alcune delle classi.
- Che le differenze della barra (toast in basso, «29 min rimasti») siano tempi di caricamento e non CSS: nel primo giro la mappa non era caricata; ripetuto con attesa maggiore le due schermate coincidono salvo bordo e pista.
- Che i testi «poco leggibili» lo siano davvero a occhio: ho calcolato il contrasto sul fondo card/bg, non l'ho misurato pixel per pixel su ogni schermata.
- Che Safari/Chrome degli utenti supportino `color-mix` (Safari 16.2+): non ho controllato le statistiche dei browser dei visitatori.
- Che la build in locale riproduca quella di produzione: stesso comando (`npm run build`) sullo stesso commit, ma non ho confrontato il CSS pubblicato. (Voce rimasta troncata dall'output della build: completata in CLASSI-TRASPARENTI-2.)

## 7. CLASSI-TRASPARENTI-2 — testi leggibili e avvisi distinti

Ramo `classi-trasparenti` (da b44ccf6), `~/unnivai-2`. Nessun push su main, nessun deploy, nessuna migrazione. Nessuna chiamata a pagamento. Il report sopra (sezioni 1–6) è stato riparato: i nomi di classe, famiglia e file persi (scritti nella shell senza protezione) sono ricostruiti dall'elenco intatto, dal test `classiConOpacita.test.js` e dallo script delle schermate; la voce troncata della sezione 6 è completata; l'output della build è tolto.

### 7.1 Avvisi ed errori (ESTETICA-COERENZA li aveva portati all'arancione)

`NavigationHUD.jsx`: icona avviso `text-brand-orange` → `text-status-warning`; tasto «Fine» `text-brand-orange` → `text-status-error`. I due token sono attenuati e intonati alla Ossidiana (`src/styles/themeTokens.js`): **avviso `#EAB308` → `#D9B25A`**, **errore `#F87171` → `#E0817A`** (successo `#10B981` invariato). Un solo colore di avviso e uno di errore; l'accento `#F97316` resta solo per azioni. Contrasto su bg / card / raised: avviso 9,7 / 9,2 / 8,6; errore 7,1 / 6,7 / 6,3 (prima 10,2 / 9,6 / 9,0 e 7,1 / 6,7 / 6,3). Regola aggiunta in `docs/estetica/palette.md` (punto 7, 1 riga). Gli altri usi di `status-*` (toast, ErrorBoundary, Onboarding, MapPage «Percorso non disponibile») cambiano tinta insieme al token.

### 7.2 Testi attenuati: 31 classi, tutte → `/80`

Secondario `#A8A29E` su fondo; `/80` dà 5,3 su bg · 5,1 su card · 4,9 su raised (minimo 4,86). Il fondo è quello della riga o del componente (dichiarato nella colonna; dove la riga non lo dice, ho assunto la superficie del componente). Scelta: sempre `/80` (non il secondario pieno), per tenere la gerarchia rispetto al testo primario; i tasti spenti restano più tenui dei tasti attivi per il fondo `raised` e il cursore, non per il testo.

| File:riga | Classe prima → dopo | Fondo | Contrasto prima → dopo |
|---|---|---|---|
| `components/Map/POIDetailDrawer.jsx:150` | `text-obsidian-secondary/60` → `text-obsidian-secondary/80` | card | 3,4 → 5,1 |
| `components/Map/POIDetailDrawer.jsx:265` | `text-obsidian-secondary/50` → `text-obsidian-secondary/80` | raised | 2,7 → 4,9 |
| `components/Map/POIPopupCard.jsx:142` | `text-obsidian-secondary/70` → `text-obsidian-secondary/80` | card | 4,2 → 5,1 |
| `components/TopBar.jsx:141` | `text-obsidian-secondary/70` → `text-obsidian-secondary/80` | bg | 4,3 → 5,3 |
| `components/TopBar.jsx:243` | `placeholder:text-obsidian-secondary/50` → `placeholder:text-obsidian-secondary/80` | bg | 2,7 → 5,3 |
| `pages/AiItinerary.jsx:543` | `text-obsidian-secondary/40` → `text-obsidian-secondary/80` | raised | 2,2 → 4,9 |
| `pages/DashboardUser.jsx:726` | `text-obsidian-secondary/60` → `text-obsidian-secondary/80` | card | 3,4 → 5,1 |
| `pages/DashboardUser.jsx:865` | `placeholder:text-obsidian-secondary/60` → `placeholder:text-obsidian-secondary/80` | bg | 3,4 → 5,3 |
| `pages/Explore.jsx:291` | `placeholder:text-obsidian-secondary/60` → `placeholder:text-obsidian-secondary/80` | card | 3,4 → 5,1 |
| `pages/Landing.jsx:702` | `text-obsidian-secondary/70` → `text-obsidian-secondary/80` | card | 4,2 → 5,1 |
| `pages/Login.jsx:311` | `placeholder:text-obsidian-secondary/50` → `placeholder:text-obsidian-secondary/80` | raised | 2,7 → 4,9 |
| `pages/Login.jsx:383` | `placeholder:text-obsidian-secondary/50` → `placeholder:text-obsidian-secondary/80` | raised | 2,7 → 4,9 |
| `pages/Login.jsx:396` | `placeholder:text-obsidian-secondary/50` → `placeholder:text-obsidian-secondary/80` | raised | 2,7 → 4,9 |
| `pages/Login.jsx:408` | `placeholder:text-obsidian-secondary/50` → `placeholder:text-obsidian-secondary/80` | raised | 2,7 → 4,9 |
| `pages/Login.jsx:421` | `placeholder:text-obsidian-secondary/50` → `placeholder:text-obsidian-secondary/80` | raised | 2,7 → 4,9 |
| `pages/MapPage.jsx:1856` | `placeholder:text-obsidian-secondary/60` → `placeholder:text-obsidian-secondary/80` | card | 3,4 → 5,1 |
| `pages/Notifications.jsx:433` | `text-obsidian-secondary/70` → `text-obsidian-secondary/80` | card | 4,2 → 5,1 |
| `pages/Notifications.jsx:484` | `text-obsidian-secondary/70` → `text-obsidian-secondary/80` | bg | 4,3 → 5,3 |
| `pages/Notifications.jsx:610` | `placeholder:text-obsidian-secondary/50` → `placeholder:text-obsidian-secondary/80` | bg | 2,7 → 5,3 |
| `pages/Notifications.jsx:632` | `disabled:text-obsidian-secondary/40` → `disabled:text-obsidian-secondary/80` | raised | 2,2 → 4,9 |
| `pages/Notifications.jsx:654` | `disabled:text-obsidian-secondary/40` → `disabled:text-obsidian-secondary/80` | raised | 2,2 → 4,9 |
| `pages/Notifications.jsx:689` | `text-obsidian-secondary/50` → `text-obsidian-secondary/80` | raised | 2,7 → 4,9 |
| `pages/Onboarding.jsx:408` | `text-obsidian-secondary/70` → `text-obsidian-secondary/80` | card | 4,2 → 5,1 |
| `pages/Profile.jsx:234` | `text-obsidian-secondary/40` → `text-obsidian-secondary/80` | card | 2,2 → 5,1 |
| `pages/Profile.jsx:238` | `text-obsidian-secondary/40` → `text-obsidian-secondary/80` | card | 2,2 → 5,1 |
| `pages/Profile.jsx:242` | `text-obsidian-secondary/40` → `text-obsidian-secondary/80` | card | 2,2 → 5,1 |
| `pages/Profile.jsx:246` | `text-obsidian-secondary/70` → `text-obsidian-secondary/80` | card | 4,2 → 5,1 |
| `pages/Profile.jsx:292` | `text-obsidian-secondary/70` → `text-obsidian-secondary/80` | card | 4,2 → 5,1 |
| `pages/Profile.jsx:891` | `text-obsidian-secondary/60` → `text-obsidian-secondary/80` | card | 3,4 → 5,1 |
| `pages/SurpriseTour.jsx:653` | `text-obsidian-secondary/50` → `text-obsidian-secondary/80` | raised | 2,7 → 4,9 |
| `pages/TourDetails.jsx:991` | `text-obsidian-secondary/70` → `text-obsidian-secondary/80` | card | 4,2 → 5,1 |

Altri testi con opacità, decisi uno per uno:
- `components/ChatModalUser.jsx:117` `text-white/70` → `text-white` (icona chiudi su intestazione terracotta, gli altri testi dell'intestazione sono già `text-white`/`/80`).
- `pages/MapPage.jsx:2213` `text-white/70` → `text-white` (indirizzo su foto con gradiente nero in basso).
- `components/NavDebugPanel.jsx:104` `text-white/50`: **lasciato**, 5,3:1 su `bg-black/90` (pannello di debug).
- `components/TourCover.jsx:73` `text-brand-orange/50`: **lasciato**, è un'icona decorativa (`aria-hidden`) sulla copertina, non testo.
- `pages/Notifications.jsx:484` `border-obsidian-secondary/40` è un bordo, non testo: non toccato.
Scansione finale: nessuna classe `text-*/40…70` in `src/` oltre alle due lasciate.

### 7.3 Prova visiva «dopo» (WebKit, iPhone 13, account di prova, GPS finto)

Script `scripts/prova-nav/classi-trasparenti-2.webkit.mjs` (build del ramo con `vite preview` sulla porta 5193; titolo «DoveVai» verificato prima delle credenziali). Schermate in `docs/prove/schermate/classi-trasparenti-2/dopo/`: `04-profilo`, `05-navigazione` (tasto «Fine» in colore errore), `05b-navigazione-segnale-perso` (avviso «Ho perso il segnale»: icona nel colore di avviso, distinta dall'arancione dei tasti), `08-notifiche`, `09-esplora`, `17-login`. Per far comparire l'avviso il GPS finto tace per 40 s dopo il primo fix (soglia dell'app: 30 s). Prima dello scatto 05b la prima versione dello script lasciava rispondere il GPS finto alla ripartenza del tracciamento e l'avviso non compariva: corretto nello script, non nell'app.

### 7.4 Controlli

| Controllo | Esito |
|---|---|
| Suite | **171 file, 2165 test verdi** |
| Lint | **0 errori** (194 avvisi, già presenti) |
| Build | ok |
| Guardia della home | **PASSATA 12/12**; pertinenza: nessun ❌ nuovo (3 in tutto, tutti già noti) |
| Produzione | invariata |

### 7.5 Processi

Il solo processo avviato (`vite preview` sulla porta 5193) e i browser WebKit sono chiusi; porta 5193 libera.

### 7.6 Cosa ho dato per vero senza verificarlo

- Che il fondo di ogni testo sia quello dichiarato: l'ho dedotto dalla riga o dal componente; per `Profile.jsx:891` (versione) e le righe senza `bg-obsidian-*` ho assunto `card`, ma il caso peggiore (`raised`, 4,86) passa comunque. Non ho misurato i pixel.
- Che `/80` su `raised` basti anche per testo grande o piccolo: 4,86 ≥ 4,5, ma sul fondo reale (con trasparenze sovrapposte) non l'ho misurato.
- Che `text-white` sulla foto del partner (`MapPage.jsx:2213`) e sull'intestazione terracotta della chat sia ≥ 4,5:1: dipende dalla foto; non misurato. La chat resta fuori palette (terracotta, fondo bianco), fuori dall'ambito.
- Che le schermate fotografate coprano ogni testo cambiato: 6 su 11 file toccati; non ho aperto la scheda tappa, il riquadro itinerario AI, Sorprendimi, Dashboard, Landing, Onboarding, TourDetails né la chat.
- Che i token `status-*` non servano altrove con un contrasto più basso: ho calcolato solo su bg/card/raised; `ErrorBoundary` usa `bg-status-error/15` e `Toast` il bordo, non li ho fotografati.
- Che `#D9B25A` e `#E0817A` siano abbastanza distinti dall'arancione `#F97316` per chi ha una visione dei colori diversa: li ho distinti a occhio e per tinta, non con una simulazione.
- Che nessun'altra sessione Claude usasse `~/unnivai-2`: ho controllato la cartella corrente dei processi `claude` (nessuno lì), non altro.
