# BRAND-UNNIVAI — 03/11/2026

## Cosa cambia per Ivano
- Il nome che l'utente vede è **Unnivai** ovunque: Login, Landing (nav «UNNIVAI»), caricamento (GlobalLoading e AuthContext), `<title>` e descrizione di `index.html`, assistente AI («Assistente Unnivai»), testi di condivisione (MapPage, Profile, TourSummaryModal), notifiche (hashtag nel prompt), nome prodotto nel checkout Stripe (nel sorgente: vale dopo il deploy di `create-checkout`, che non ho fatto), onboarding, dashboard, prompt AI, guida predefinita («Intelligenza Unnivai», «Unnivai Guide»).
- Nell'app iOS (Capacitor nativo) niente pagine «Prossimamente»: sparisce la voce **Foto** dalla barra, i link «Presto: persone del posto…» (Landing), la card «Guide Locali» (DashboardUser) e i link a /photos nel Profilo. Le rotte `/prossimamente/*`, `/become-guide`, guide/business (via `V1LockedGuard`), `/photos`, `/trending` portano alla home. Sul web è tutto come prima.
- Nuovi file: `src/lib/appNativa.js` (`isAppNativa()`, `Capacitor.isNativePlatform()`), `src/components/SoloWeb.jsx`.

## Occorrenze prima (visibili, file:riga)
index.html:9,10; create-checkout/index.ts:80; AuthContext.jsx:57; App.jsx:79; ComingSoonOverlay.jsx:152; BookingSystem.jsx:94; AIAskButton.jsx:28; GeminiAskButton.jsx:28; AIDrawer.jsx:74,105; TourSummaryModal.jsx:50; Onboarding.jsx:208,468; Landing.jsx:165,350,617; Profile.jsx:211; Notifications.jsx:266; BecomeGuide.jsx:272; Photos.jsx:15; MapPage.jsx:2585,2697; Login.jsx:151,185; QuickPath.jsx:734,753; NotificationSettings.jsx:114; DashboardGuide.jsx:463; DashboardUser.jsx:833; DashboardBusiness.jsx:914; tourShape.js:512; aiRecommendationService.js:557,4793; useUserNotifications.js:66. (35 punti in 27 file.)
Già Unnivai: capacitor.config.json (appName), Info.plist (CFBundleDisplayName), email/modelli (nessuna occorrenza). Non c'è un manifest web nel repo.

## Dopo
Comando: `grep -rniE "dove ?vai" index.html src supabase public ios/App/App capacitor.config.json -I --exclude-dir=__tests__`
Restano solo occorrenze interne (nessuna visibile): commenti (index.css:67, App.jsx:69, themeTokens.js:2, ComingSoonOverlay.jsx:8, GoogleMapContainer.jsx:24, useUserNotifications.js:35, notificationRecipes.js:6, schemas.js:47, Landing.jsx:236, MapPage.jsx:2414, AiItinerary.jsx:323, TourDetails.jsx:222,477, preferenceEngine.js:2, dataService.js:167, DashboardUser.jsx:67, aiRecommendationService.js:1263,4462, placesDiscoveryService.js:158); `User-Agent: 'DoveVAI/1.0'` (CityContext.jsx:109, intestazione verso Nominatim, non visibile; non l'ho toccata); `test@dovevai.it` (mock di test); `'DoveVai Guide'` in TourDetails.jsx:539 tenuto apposta insieme a «Unnivai Guide»: serve a riconoscere nomi generici già salvati nei dati. In più: «Scegli dove sei o dove vai» (Landing.jsx:241) è italiano comune, non il nome.
Documenti storici (DOVEVAI_HANDOFF.md, AUDIT_*.md, ANALISI_*.md, docs/) non sono testo per l'utente e non sono stati toccati. Test e script: aggiornati dove cercavano il vecchio testo (Entra in Unnivai, gatePulizia).

## Titolo nei collaudi
Tutti gli script con `/DoveVai/i` (scripts/prova-*, collaudo-sito, ecc.) ora usano `/Unnivai|DoveVai/i`; `scripts/ios/prova-simulatore.sh` accetta `<title>(Unnivai|DoveVai)`; CLAUDE.md aggiornato (il titolo deve contenere «Unnivai»).

## Prove
- Suite 258 file / 3214 test verdi; lint 0 errori; build ok; `banco:guardia` 12/12, nessun ❌ nuovo (3 già noti).
- Test nuovo `src/__tests__/components/appNativaProssimamente.test.jsx`: con Capacitor nativo simulato la barra non ha Foto, `V1LockedGuard` e `SoloWeb` rimandano alla home; sul web restano Foto, `/prossimamente/guide` e le pagine; controllo sul sorgente che link Landing/Dashboard/Profilo e rotte siano dietro `isAppNativa`.
- Dopo il merge (`065161b`): CI su main verde, Vercel READY (il sito serve `<title>Unnivai | Esplora l'Italia Autentica`).

## Costo AI
0 (nessuna chiamata AI a pagamento prima del collaudo).

## Cosa NON risolve
- Icone: nessun file in `public/` con il nome scritto; l'icona dell'app iOS (Assets.xcassets) non l'ho aperta né modificata: da guardare a mano.
- `cap sync ios` non necessario (capacitor.config.json invariato).
- Il nome sull'App Store Connect e il dominio/URL (unnivai.vercel.app) non dipendono da questo task.
- Il nome Stripe «Tour Unnivai» e i testi AI vanno online solo con il deploy di `create-checkout` (funzione: non deployata da me). Comando che aspetta Ivano: `supabase functions deploy create-checkout`.
- Le email di Auth non dicevano DoveVai: nessun caricamento. Il comando resta `node scripts/email/carica-modelli.mjs --invia` solo se cambiano.

## Da provare su iPhone
Aprire l'app: nome Unnivai in caricamento e Login; nella barra in basso solo Home, Esplora, Profilo; nessuna card o link «Presto / Guide»; il profilo senza «Vedi tutte» sulle foto.

## Esito sul sito pubblicato (dopo il merge)
- `curl https://unnivai.vercel.app` e `/login`: `<title>Unnivai | Esplora l'Italia Autentica`. WebKit: Login e Landing mostrano «UNNIVAI», nessun «DoveVai» nel testo.
- `node scripts/prova-nav/collaudo-sito.webkit.mjs` (account di prova, WebKit iPhone 14): punti 1-6 e 8-13 passati; punto 7 con l'account passato, da ospite non passa (accessi anonimi spenti nel pannello Supabase, atteso come nei collaudi del 02 e 03/11). Il controllo del titolo accetta Unnivai e non ha fermato la prova. Costo AI: le generazioni solite del collaudo con l'account di prova (nessun contatore); il lavoro del task in sé 0 $.
