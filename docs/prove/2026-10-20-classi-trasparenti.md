# CLASSI-TRASPARENTI — gli sfondi e i colori con opacità tornano visibili in tutta l'app

Ramo `classi-trasparenti` (da `origin/main` 588c636), lavoro in `~/unnivai-2` (worktree). Nessun push su main, nessun deploy, nessuna migrazione. Nessuna chiamata a pagamento: spesa 0 $.

## 1. Elenco e causa

**Causa, in una riga:** i colori della Scala Ossidiana (e brand, ochre, terracotta, shadcn) sono variabili CSS (`var(--obsidian-card)`) e Tailwind v3 non sa applicare un'opacità a un colore che non conosce: `bg-obsidian-card/95` non produceva nessuna regola, quindi nessuno sfondo, bordo, ombra o testo.

**Misura** (build di main, 588c636; ogni classe  scritta in , comprese le varianti , , , , ): 179 classi con opacità distinte, **52 senza CSS, 168 usi**, in 36 file. Il «79 usi» della nota D4 contava solo una parte (le famiglie ): le classi senza CSS sono in realtà di più famiglie.

| Famiglia | Usi senza CSS |
|---|---|
|  | 33 |
|  | 32 |
|  | 28 |
|  (+ ) | 24 |
|  | 13 |
|  | 13 |
|  | 7 |
| ,  | 10 |
| altre (, , , , ) | 8 |

Elenco completo (classe, usi, file in ):

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

Una voce resta nell'elenco della scansione:  in , ma sta solo in un commento (la barra l'ha tolta in NAV-1-FIX): non è un uso.

Guardia contro il ritorno:  scansiona  (commenti esclusi) e fallisce se una classe  non produce CSS. Rosso sulla configurazione di main (elenca le classi mancanti), verde con la correzione.

## 3. Prova visiva (WebKit, iPhone 13, account di prova, GPS finto)

Script: `scripts/prova-nav/classi-trasparenti.webkit.mjs` (due `vite preview`: build di main e build del ramo; porta e titolo verificati prima delle credenziali). Schermate (JPEG): `docs/prove/schermate/classi-trasparenti/prima/` e `.../dopo/`, stesso nome file. Pixel diversi sopra soglia, dopo/prima:

| Schermata | File | Pixel cambiati |
|---|---|---|
| Riquadro «Dove ti trovi?» |  | 1,4% |
| Home |  | 0,9% |
| Scheda giro |  | 1,0% |
| Quiz |  | 0,1% |
| Profilo |  | 0,2% |
| Navigazione (barra) |  | 23,9%* |
| Mappa con giro |  | 1,1% |
| Sorprendimi |  | 1,0% |
| Notifiche, Esplora, Itinerario AI, Tour live, Trending, Impostazioni, Foto, Prossimamente | – | 0,1–0,7% |
| Landing, Login, Onboarding | – | 1,4% / 0,4% / 0,0% |

*La navigazione cambia molto in pixel perché la mappa di Google (3D) non è identica fra due caricamenti; le due differenze dovute al CSS sono sotto.

**Cosa cambia a vista** (tutto ciò che prima non aveva CSS):
- **Bordi arancioni** al posto del bordo bianco/grigio predefinito di Tailwind: «Crea il tuo Percorso» in home, riquadro «Sei passato da…?» e campo città nel riquadro, tasto «Inizia Gratis».
- **Pillole e badge** con fondo arancione tenue (`bg-brand-orange/10`, «GRATIS & SU MISURA»), **ombre arancioni** sui tasti.
- **Barra di navigazione**: la pista di avanzamento non ha più il contorno bianco (ora fondo scuro `border-obsidian-border/50` + tenue).
- **Velo dietro i riquadri** (`bg-obsidian-bg/80`): ora la pagina dietro il riquadro «Dove ti trovi?» è scurita, prima era piena e nitida.
- **Testi attenuati** (`text-obsidian-secondary/40…70`): ora davvero più spenti (Profilo: «TOUR», «GUIDE», «RATING», il trattino delle statistiche; esempio in «Travel Designer AI»; riga «Il tuo primo giro ti aspetta»).

### Testi che diventano poco leggibili col nuovo effetto (da segnalare, non toccati)

Contrasto calcolato sul fondo scuro (secondario `#A8A29E`; AA = 4,5:1): `/80` 5,1 · `/70` 4,2 · `/60` 3,4 · `/50` 2,7 · `/40` 2,2. Per dimensione normale falliscono `/70`, `/60`, `/50`, `/40`:

- **/40 (2,2:1, illeggibili):**  (trattini delle statistiche), , .
- **/50 (2,7:1):** , ,  (testo e segnaposto), , ; segnaposto con .
- **/60 (3,4:1):** , , , , .
- **/70 (4,2:1, al limite):** , , , , , , .
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

- Che l'elenco 168 usi / 52 classi sia completo: la scansione cerca classi scritte per intero in . Una classe composta a runtime (bg-\/50\) non la vede; non ho cercato questi casi.
- Che le schermate fotografate coprano ogni punto dove il cambio è visibile: ho fatto 19 schermate raggiungibili con l'account di prova; non ho aperto modali e stati raggiungibili solo con azioni (pagamento, prenotazioni, chat, schede POI, ruoli guida/attività), che usano alcune delle classi.
- Che le differenze della barra (toast in basso, «29 min rimasti») siano tempi di caricamento e non CSS: nel primo giro la mappa non era caricata; ripetuto con attesa maggiore le due schermate coincidono salvo bordo e pista.
- Che i testi «poco leggibili» lo siano davvero a occhio: ho calcolato il contrasto sul fondo card/bg, non l'ho misurato pixel per pixel su ogni schermata.
- Che Safari/Chrome degli utenti supportino `color-mix` (Safari 16.2+): non ho controllato le statistiche dei browser dei visitatori.
- Che la build in locale riproduca quella di produzione: stesso 
> unnivai-ricresa@0.0.0 build
> vite build

vite v7.3.1 building client environment for production...
transforming...
✓ 2413 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                   0.69 kB │ gzip:   0.43 kB
dist/assets/MapPage-CSnHv3Ye.css                  2.54 kB │ gzip:   0.87 kB
dist/assets/index-D5YdlJ1a.css                  113.52 kB │ gzip:  17.27 kB
dist/assets/check-B3nXJcwa.js                     0.13 kB │ gzip:   0.14 kB
dist/assets/chevron-left-EghdUoIG.js              0.13 kB │ gzip:   0.14 kB
dist/assets/chevron-right-CssWOg1g.js             0.13 kB │ gzip:   0.14 kB
dist/assets/arrow-left-Lt7Ylbbt.js                0.16 kB │ gzip:   0.16 kB
dist/assets/arrow-right-CtgghYQa.js               0.16 kB │ gzip:   0.16 kB
dist/assets/search-BpKPhJL9.js                    0.18 kB │ gzip:   0.17 kB
dist/assets/circle-check-DKrIpapT.js              0.18 kB │ gzip:   0.17 kB
dist/assets/play-mrWo1Acm.js                      0.19 kB │ gzip:   0.18 kB
dist/assets/user-CPTAWVch.js                      0.20 kB │ gzip:   0.18 kB
dist/assets/lock-B_0vwDNs.js                      0.20 kB │ gzip:   0.19 kB
dist/assets/mail-DmenicZ9.js                      0.21 kB │ gzip:   0.20 kB
dist/assets/briefcase-DZOg2Hdc.js                 0.22 kB │ gzip:   0.20 kB
dist/assets/log-out-BYgRs59z.js                   0.23 kB │ gzip:   0.19 kB
dist/assets/target-j3ZN2Dkg.js                    0.23 kB │ gzip:   0.16 kB
dist/assets/globe-CJtSF3zz.js                     0.24 kB │ gzip:   0.19 kB
dist/assets/message-circle-B183ULRe.js            0.24 kB │ gzip:   0.21 kB
dist/assets/compass-RTxYDzoI.js                   0.25 kB │ gzip:   0.21 kB
dist/assets/eye-_PLaTd-d.js                       0.26 kB │ gzip:   0.20 kB
dist/assets/calendar-D_gC_o3C.js                  0.26 kB │ gzip:   0.20 kB
dist/assets/map-pin-CNwyjnkx.js                   0.26 kB │ gzip:   0.22 kB
dist/assets/utensils-CaMwKjvr.js                  0.26 kB │ gzip:   0.21 kB
dist/assets/zap-CZDdttZZ.js                       0.26 kB │ gzip:   0.21 kB
dist/assets/image-B4sMi7ax.js                     0.27 kB │ gzip:   0.22 kB
dist/assets/award-DEPRnQi7.js                     0.28 kB │ gzip:   0.23 kB
dist/assets/house-DCOUKZky.js                     0.28 kB │ gzip:   0.22 kB
dist/assets/send-DuAeTnDu.js                      0.29 kB │ gzip:   0.23 kB
dist/assets/users-B6nn2DWu.js                     0.31 kB │ gzip:   0.22 kB
dist/assets/square-pen-BvQil4zV.js                0.32 kB │ gzip:   0.24 kB
dist/assets/tag-uRBjbfJ0.js                       0.33 kB │ gzip:   0.25 kB
dist/assets/trash-2-BQ7YPEyd.js                   0.33 kB │ gzip:   0.22 kB
dist/assets/gift-RFv7ZHII.js                      0.36 kB │ gzip:   0.25 kB
dist/assets/share-2-BjhAUs4U.js                   0.36 kB │ gzip:   0.24 kB
dist/assets/loader-Bmd8sMCE.js                    0.41 kB │ gzip:   0.24 kB
dist/assets/map-DgvNA0g8.js                       0.43 kB │ gzip:   0.27 kB
dist/assets/star-DkOEL1pt.js                      0.47 kB │ gzip:   0.29 kB
dist/assets/sparkles-BssE7Q6r.js                  0.50 kB │ gzip:   0.28 kB
dist/assets/brain-ZshQu3ds.js                     0.58 kB │ gzip:   0.31 kB
dist/assets/esitoVuoto-DB7i_sy3.js                0.63 kB │ gzip:   0.38 kB
dist/assets/volume-x-BqWNVTyW.js                  0.73 kB │ gzip:   0.34 kB
dist/assets/interests-DubissXw.js                 0.93 kB │ gzip:   0.54 kB
dist/assets/chatSanitizer-Bq29V5PW.js             1.21 kB │ gzip:   0.66 kB
dist/assets/GuidePlaceholder-DbT1SQdw.js          1.23 kB │ gzip:   0.65 kB
dist/assets/TourCover-D1bQkQBO.js                 1.51 kB │ gzip:   0.81 kB
dist/assets/NotFound-TfC256Gc.js                  1.80 kB │ gzip:   0.76 kB
dist/assets/notificationRecipes-CdOms_AA.js       1.84 kB │ gzip:   0.68 kB
dist/assets/UpdatePassword-eiFeDmqK.js            1.91 kB │ gzip:   0.95 kB
dist/assets/utensils-crossed-CxBUos9o.js          1.98 kB │ gzip:   0.90 kB
dist/assets/BottomNavigation-De5cJpkL.js          2.04 kB │ gzip:   1.06 kB
dist/assets/ToastNotification-CTzdq2Yu.js         2.06 kB │ gzip:   0.98 kB
dist/assets/GpsActivationBanner-CcqFTea8.js       2.58 kB │ gzip:   1.13 kB
dist/assets/TourStopsByMoment-BGmmYTJB.js         2.79 kB │ gzip:   1.13 kB
dist/assets/FactSources-urF4WKrn.js               2.87 kB │ gzip:   1.33 kB
dist/assets/ReviewModal-CcRV84Tz.js               3.35 kB │ gzip:   1.61 kB
dist/assets/Photos-CT60l4Ag.js                    3.93 kB │ gzip:   1.54 kB
dist/assets/NotificationSettings-D-74TF6M.js      4.64 kB │ gzip:   1.90 kB
dist/assets/cityCenterService-CIc_z_3L.js         4.75 kB │ gzip:   1.63 kB
dist/assets/useUserNotifications-CbPGBMVu.js      4.76 kB │ gzip:   2.02 kB
dist/assets/Trending-CutnT3PX.js                  4.82 kB │ gzip:   2.06 kB
dist/assets/Prossimamente-WePzkcDQ.js             5.07 kB │ gzip:   2.34 kB
dist/assets/categoryPalette-Dmj6j_kM.js           5.30 kB │ gzip:   1.96 kB
dist/assets/useAILearning-C9eyKeqZ.js             5.54 kB │ gzip:   2.08 kB
dist/assets/TopBar-HPNoQteE.js                    5.61 kB │ gzip:   2.28 kB
dist/assets/NotificationBell-Bn2HgCUk.js          5.64 kB │ gzip:   1.85 kB
dist/assets/BecomeGuide-Bl1LK6uL.js               9.50 kB │ gzip:   2.98 kB
dist/assets/useUserContext-DuWOHLYU.js            9.98 kB │ gzip:   3.79 kB
dist/assets/Explore-CcI9-4lz.js                  11.00 kB │ gzip:   4.13 kB
dist/assets/TourLive-g1eXF8Cw.js                 12.35 kB │ gzip:   3.38 kB
dist/assets/Onboarding-Cxs8bX2v.js               13.79 kB │ gzip:   4.32 kB
dist/assets/placesDiscoveryService-BaMRM3-9.js   15.59 kB │ gzip:   6.16 kB
dist/assets/SurpriseTour-i3DYs9F9.js             17.47 kB │ gzip:   5.32 kB
dist/assets/Login-Vsxg0J8G.js                    17.72 kB │ gzip:   5.05 kB
dist/assets/TourBuilder-Cy2U4gAT.js              19.71 kB │ gzip:   6.16 kB
dist/assets/Notifications-Cm8wrCzP.js            20.21 kB │ gzip:   6.46 kB
dist/assets/AiItinerary-CJeumIKU.js              22.46 kB │ gzip:   6.80 kB
dist/assets/DashboardUser-C02WADwl.js            28.70 kB │ gzip:   8.80 kB
dist/assets/DashboardGuide-B9GVors-.js           31.52 kB │ gzip:   9.08 kB
dist/assets/QuickPath-BM0LK9s1.js                33.35 kB │ gzip:  10.27 kB
dist/assets/Landing-DuFBL_ti.js                  35.02 kB │ gzip:  10.56 kB
dist/assets/TourDetails-DZEygLep.js              36.70 kB │ gzip:   9.31 kB
dist/assets/Profile-D3qK9RIk.js                  38.14 kB │ gzip:   9.40 kB
dist/assets/DashboardBusiness-DlaFH_cL.js        41.18 kB │ gzip:  11.55 kB
dist/assets/MapAPIWrapper-5DxvtPTs.js            73.08 kB │ gzip:  24.48 kB
dist/assets/MapPage-B_DlgP-C.js                 136.01 kB │ gzip:  44.80 kB
dist/assets/index-BlprKAKy.js                   955.96 kB │ gzip: 307.88 kB
✓ built in 3.17s, ma non ho confrontato il CSS pubblicato.
