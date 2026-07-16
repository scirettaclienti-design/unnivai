# DoveVAI — Handoff V1 → prossime sessioni

Punto di partenza per chi (o quale sessione di Claude) riprende il progetto.
Aggiornare in coda dopo ogni iterazione importante.

**Ultimo aggiornamento**: 2026-07-17 dopo Gate II (commit `00bb209`, verificato
device Ivano su Troina) — narratore unificato su TUTTI i tour Home in 1 sola
call OpenAI, kill placeholder "Luogo di interesse", isMockTour su flag
esplicito `isDemoTour`. Coerenza narrativa raggiunta: ogni tappa di ogni tour
"Per Te" ora ha description + insiderTip + bestTime + transition dal
narratore. Precedenti stessa sessione: Gate GG (16/07) ErrorBoundary con
chunk-reload automatico + tabella `error_logs` Supabase (frase "team
notificato" ora vera), Gate FF.1 (16/07) responsive slide HowItWorks per
iPhone. Vercel verde. CC.3 Esplora rimane pendente.

---

## Stato attuale — 13/07/2026

Due giorni intensi. Blocco 1 (Verità) chiuso il 12/07. Blocco 2.1 (Notifiche)
chiuso e verificato device oggi. Gate O aperto oggi dopo verifica device di
Ivano sul primo lancio: la Home mostrava contenuto-ponte fake mentre
"Per Te" caricava. Chiuso in 4 sub-commit (O.1/O.2/O.3/O.4), tutti verificati
su device. Blocco 1 al 100%, Blocco 2.1 al 100%. Blocco 2.2-2.7 pipeline.

## Stato al 12/07/2026 (Blocco 1)

Un giorno di lavoro intenso. La V1 non era pronta per essere lanciata: il motore
Places-first era spento in prod, QuickPath era ancora un mock, la notifica era
inventata, il paywall era un gate silenzioso, le dashboard V2/V3 mostravano
metriche fake sotto la landing pubblica. Adesso il percorso viaggiatore è vero
end-to-end. Blocco 1 chiuso. Blocco 2 in corso su 8 aree (2.1 chiusa il 12/07).

**Stack** (invariato):
- React 19 + Vite 7 + Supabase (Auth/DB/Realtime/Storage)
- OpenAI gpt-4o-mini via Edge Function `openai-proxy`
- Google Places Legacy via Edge Function `places-proxy`
- Vercel deploy da main, gated su CI GitHub Actions (Blocco 1)

---

## BLOCCO 1 — VERITÀ ✅ CHIUSO

14 commit oggi. Ogni finding dell'audit anti-fake indirizzato: uccisione, guard,
sostituzione con dato vero, o esclusione onesta.

### Motore & flusso viaggiatore

- **`51589c5` Gate E — hotfix prod TourDetails crash + paywall silenzioso**.
  Post-Gate D2 il render di TourDetails leggeva `tour.type/steps/id` con `tour=null`
  → TypeError globale su qualsiasi apertura tour da Home. E il paywall dopo 10
  tour vita silenziava il click su gruppo QuickPath: `if (hasHitPaywall) { setShowPaywall(true); return; }` ma il modal non era mai renderizzato.
  Fix: early return skeleton/not-found DOPO l'ultimo useEffect e PRIMA delle
  espressioni tour.* + kill paywall completo (import, hasHitPaywall,
  generatedToursCount, unlockPremium).

- **`6c74955` Gate H — QuickPath selectedOption STRINGA vs .id undefined**.
  Bug scoperto da Ivano su device (Catania): due wizard diversi
  (Natura+Parchi vs Città+X) producevano lo STESSO tour. Causa: `handleMainSelection(option.id)`
  passa la stringa `"natura"`; poi `buildPromptFromSelections({main: selectedOption?.id})`
  legge `"natura".id === undefined` → dominant collassava sul fallback default
  → prompt identico per ogni scelta → cache hit. Fix chirurgico (4 righe) +
  cache bump `unnivai_insiderf6_qp_` + 3 test di regressione.

- **`efc0244` Gate I — soglie per categoria + query realistica + soglia candidati 1**.
  Catania → Natura → "A Catania non troviamo parchi" mentre Villa Bellini
  (4.4★, 148 rec) esiste. Tre fix in un commit:
  - CULTURA large 4.0/20→4.0/50, NATURA/RELAX large 4.0/20 (nuovo). Un parco
    non fa recensioni come un ristorante.
  - `customKind` inferito da `intent.categoria` (natura→NATURA, relax→RELAX,
    cibo→FOOD, altro→CULTURA).
  - INTENT_TRANSLATOR_PROMPT: nuova regola "usa nomi come Google li registra"
    (villa comunale/orto botanico, non "parchi/giardini/aree verdi").
  - Motore accetta ≥1 candidato (era ≥3); flag `_singleStop=true` → description
    onesta "A Catania abbiamo trovato un solo posto che vale per questa richiesta".
  - Cache bump `unnivai_insiderf7_soglia_` + intent v1→v2.

- **`Places-proxy flag acceso in prod**: `VITE_PLACES_PROXY_ENABLED=true` — era
  spento da settimane. Sbloccato dopo che Ivano ha verificato Gate B+I su device
  (spiagge di Siracusa produce spiagge reali via textsearch, non più nomi inventati).

### Rete di sicurezza

- **`af6afd1`, `bc4ccc1`, `beabe2c` Gate F — smoke E2E + blocco deploy Vercel su CI rosso**.
  @playwright/test + chromium only. 6 percorsi critici (Home / Scheda Tour reale
  / Scheda 404 / QuickPath / AiItinerary / Mappa). Auth mock via
  `addInitScript` su `sb-test-auth-token`, route interception su
  supabase/openai-proxy/places-proxy/nominatim/ipapi/mapbox — zero costo, zero
  flakiness. Job GH `e2e` con `needs: test`. Vercel "Ignored Build Step"
  script (Node parser, non jq che non è installato lato Vercel) fa polling
  su `/actions/runs?head_sha=` (permesso `Actions: Read` del PAT fine-grained,
  `Checks: Read` non esiste per Repository permissions) e blocca `exit 0`
  se qualche workflow_run è failure/cancelled/timed_out. Fail-CLOSED su ogni
  situazione ambigua (GH_TOKEN mancante, timeout, HTTP 5xx). Verificato con
  test negativo su branch dedicato: Vercel skip build su commit failing +
  procede su commit verde. Regola locked: "il CI è l'unica verità".

### Kill delle bugie

- **`648f054` Gate J1 → `fcf88a5` Gate K — Guide/Business V2/V3 fuori V1**.
  Audit anti-fake (Explore agent) ha trovato 83 findings, 60 CRITICA. Le 15 CRITICA
  più visibili erano dashboard Guide/Business con analytics/guadagni/messaggi
  fake (Marco R., Sofia B., €2450 di guadagno inventato). Modello di lancio
  locked: V1 = viaggiatore + AI. Guide V2. Business V3. Prima J1 spegneva
  brutalmente (rotte rimosse → 404 muta); Gate K ha rifatto con `V1LockedGuard`:
  rotta esiste, guard redirige a `/dashboard-user` con toast "Disponibile
  prossimamente". Signup ROLES ridotto a solo "Viaggiatore" (guide/business
  commented, riaperti in V2/V3 togliendo un commento).

- **`fd79da1` Gate J2 → `fcf88a5` Gate K — kill fake percorso viaggiatore**.
  TourDetails PlaceDetailsView bottoni "Chiama"/"Prenota Tavolo" facevano toast
  falsi. Rimossi. POIDetailDrawer `tel:` link sostituito con **testo** selezionabile
  del `poi.phone_number` (dato vero da Places, azione all'utente). Bottone
  "Prenota" fallback level=1 (toast "Prenotazione non disponibile") RIMOSSO —
  un bottone che dichiara di non funzionare è una funzione che finge. SurpriseTour
  lista "Ispirazioni del Momento" (3 esperienze €75-95 Unsplash) rimossa. TourLive
  `liveToursMock` (3 tour fake Roma/Palermo/Venezia con guide Maria Benedetti/
  Giuseppe Torrisi/Andrea Morosini) rimosso. QuickPath 26 Unsplash in
  `CITY_CONFIG.sub` forzati a `null` → gradient `categoryPalette` come cover
  (dead URL restano nei dict, cleanup fisico in coda). `PersonalizedWelcome.jsx`
  orfano eliminato dal file system. `DEMO_CITIES` ridotto ai soli `center`
  (default tecnico mappa) — activities/tours/landmarks ripuliti. `ENABLE_DEMO_MODE=false`
  → badge Demo scomparso.

- **`fcf88a5` Gate K CRITICO — `groupParticipants` fake killed**.
  Ivano l'ha definito "il fake peggiore dell'audit". TourDetails mostrava
  "Ti stai unendo a Sofia e altri 4 esploratori per vivere questa storia dal
  vivo" + avatar stack di 5 foto Unsplash + badge "Confermati" — pressione
  sociale fabbricata su un tour che l'utente fa da solo. Rimosso array
  `groupParticipants` + sezione "💌 Invito Speciale" + `handleJoinGroup`
  ("Ti sei unito al gruppo di Sofia!") + CTA "Unisciti al Gruppo" + variabile
  `isGroupMode` + deep link `?mode=group`. Group Mode come funzione non esiste
  in V1; quando esisterà sarà con persone vere dal DB.

- **`107ebd3` Gate L — gate silenziosi defense-in-depth**. AIDrawer Enter con
  input vuoto (bug UI raggiungibile) fixato in Gate J3 con toast. Gate L copre
  gli altri 4 (DashboardUser.submitGuideRequest, BookingSystem.handleConfirm,
  ChatModalUser.sendChatMessage, Notifications.handleReplySubmit) — bottone già
  disabled quando dati mancano, ma se un refactor sblocca il disabled, il toast
  onesto ("Scrivi qualcosa prima di inviare", "Compila data, ora, numero di
  ospiti prima di confermare") copre il caso. Zero return nudo raggiungibile via UI.

- **Test anti-rientro fake** (`src/__tests__/anti-fake.test.js`). Grep-based
  Vitest con 12 regole configurabili + allowlist esplicita per file. Stato al
  12/07: 3 attive + 7 skip (cleanup in coda). Stato al 13/07 dopo Gate N + O:
  **9 attive**, 4 skip. Il dettaglio per data corrente sta nella sezione
  Gate O.4 sotto (Blocco 2.1).

### Verità sul cruscotto

- Cache bumps totali oggi: 3 chiavi insider (`insiderf3`→`insiderf6`→`insiderf7`)
  + 1 chiave intent (`intent_v1`→`intent_v2`). I tour vecchi malformati
  scompaiono al primo click post-deploy.
- `ai_quota_daily` (cap 10/day utente) + nuova tabella `is_unlimited` boolean
  su profiles con trigger protect (solo service_role scrive, utente RLS
  read-only). Account test sbloccato via SQL Editor a mano. Cap syswarm
  6/day nuovo per il precompute sistema (Blocco 2.1 Fase 2).

**Stato blocco 1 in prod**: verificato da Ivano su device dopo ogni gate.
Tutti green fino a `d7ea56f`. CI verde. Vercel gate attivo.

---

## BLOCCO 2 — COMPLETEZZA 🔄 IN CORSO

### 2.1 Notifiche 🟢 CHIUSA oggi (4 fasi, 3 commit)

La notifica è la promessa del prodotto: "arriva alle 18:12 a Catania e ti trova
tu". Diagnosi ha mostrato che nascondeva 3 bug: nomi di locali inventati
dall'LLM ("Bar Mola", "Il Sale" non esistono), 2 CTA che non facevano nulla,
notifiche di guide V2 con testo sporco ("iv guida €50 a null").

- **`ef739b9` Fase 3** — filtro `dataService.getNotifications` + `subscribeToNotifications`
  su tipi V2/V3 (`guide_offer`, `guide_request`, `guide_response`, `business_lead`,
  `business_promo`, `payment_confirmed`) e su testi con `null`/`undefined`
  letterali. Retrocompat totale: le vecchie notifiche restano nel DB ma non
  raggiungono più l'utente.

- **`5af440e` Fase 1** — Notifica-vera: pipeline `contesto → recipe → Places
  → AI vincolata`.
  - `src/lib/notificationRecipes.js`: dizionario `slot × weatherClass` (sereno/
    pioggia/caldo/freddo) → `{ categoria, query, kind }`. Recipe null (es. night)
    o Places 0 candidati → NIENTE notifica (silenzio > invenzione).
  - `generateWeatherSocialTip` riscritto: prende cityCenter (da `resolveCityCenter`),
    chiama `discoverRealPOIs` con `customQuery`+`customKind` (soglie Gate I),
    top-3 candidati arricchiti con `distanceMinutes` (haversine × 12 SOLO se GPS
    attivo, altrimenti no distanza), `open_now`, rating.
  - System prompt vincolato: title = fatto nudo, message = motivo verificabile
    (ora/temp/meteo/distanza/open_now), blacklist esplicita di verbi da menu
    ("sorseggia") e aggettivi vuoti ("spettacolare"). L'AI può rispondere
    `{skip:true}` se non ha un motivo forte. Verifica post-response: il
    messaggio DEVE contenere almeno un nome della lista candidati, altrimenti
    → scarto.
  - `useUserNotifications` accetta `ctx = { userLat, userLng, temperatureC, condition }`.
    Se AI ritorna null → NESSUNA notifica pubblicata.
  - `NotificationBell` + `Notifications.jsx` passano lat/lng/temperature dal
    `useUserContext`.

- **`d7ea56f` Fase 2+4** — precompute lazy + CTA singolo + dedup.
  - `aiRecommendationService.generateSystemPrewarmTour` con contatore separato
    `unnivai_syswarm_<userId>_<YYYY-MM-DD>` cap 6/day. Bypassa
    `checkAndIncrementQuota` utente via `opts.skipUserQuota=true` (nuovo param
    di `generateItinerary`, retrocompat). Verifica promessa: il tour DEVE
    contenere almeno uno dei `chosenPois` (POI citati nel testo notifica),
    altrimenti → scarto (la notifica prometteva X, se il tour porta a Y è
    un'esca).
  - Notifications.jsx modal: UN solo CTA "Vedi il giro" (rimossi
    "Scopri il tuo giro" + "Tour AI"). Precompute lanciato in useEffect
    quando l'utente apre il modal (letture 3-4s → tour pronto). Copy CTA
    per status: `loading` → "Sto preparando il giro..." (spinner),
    `ready` → "Vedi il giro" + navigate to `/tour-details/<id>` col
    tourData in state, `cap_exceeded` → "🌅 Domani nuovi giri" (disabled),
    `error` → "Non riesco a preparare il giro" (disabled).
  - Fase 4 dedup: lista notifiche `line-clamp-2` sul message (preview 2 righe);
    modal mostra title+message UNA volta.

**Verifica device**: ✅ verificato da Ivano su iPhone il 13/07. Gate N (sotto)
apre 3 refit sul finding sbucato in prod.

### 2.1 Gate N (post-verdict device) — refit su 3 finding di Ivano

Ivano su iPhone ha visto una vecchia notifica pre-fix ("Bar Mola / sorseggia /
Prenota ora") sopravvivere al filtro Fase 3. Ha aperto Gate N per:

- **`735e044` N.0 — engine_version marker**: costante
  `NOTIFICATION_ENGINE_VERSION = 'v2-notifica-vera'` in
  `src/lib/notificationRecipes.js`. Fabbrica `makeAiNotification`
  come unico punto di creazione. Cache sessionStorage filtra
  **per-elemento** (`parsed.filter`, non `every` che scartava tutto l'array).
  DataService.getNotifications + subscribeToNotifications filtrano
  **per-record** DB: se `action_data.engineVersion !== 'v2-notifica-vera'`
  per tipi AI (`tour_recommendation`/`weather_alert`/`recommendation`) →
  scarto. Regola anti-fake **attiva** (non skip)
  `[no-ai-notif-without-engine-version]` — se un file pubblica notifica AI
  senza marker, il test fallisce.

- **`c1697ee` N.1 — place/details opening_hours + regola preferenza prompt**:
  `fetchPlaceOpeningHours(placeId)` in placesDiscoveryService legge
  `opening_hours.periods` di Google Places Basic Data, estrae
  `closingTimeTodayHH` (giorno corrente). Prompt regola PRIORITÀ locked:
  1. Se candidato ha "chiude oggi alle HH:MM" → PREFERISCILO (dato strutturale).
  2. Solo se manca closingTime E c'è `open_now` → "aperto adesso" (istantaneo).
  3. Se nessuno dei due → NON dire nulla sull'apertura.
  Esempi prompt aggiornati con orario esplicito.

- **`f5b6fcf` N.2 — generateSystemPrewarmTour deterministico**:
  Zero `generateItinerary`, zero LLM. Nuova
  `placesDiscoveryService.fetchPlaceDetailsForTour(placeId, cityName)` con
  Basic Data (name, geometry, photos, types, opening_hours). Per ogni
  `chosenPoi` fetcha in parallelo → filtra POI arricchiti con successo →
  `sortByProximity` (nearest-neighbor greedy) → `tourData.days[0].stops` =
  i chosenPois arricchiti, ordinati. Coerenza notifica↔tour è
  **strutturale**, non verificata a posteriori. Guard "almeno un POI"
  rimossa. `description = ''` (Blocco 2.7 farà il narratore).

**Verifica device Gate N.0/N.1/N.2**: ✅ verificato da Ivano su iPhone il 13/07.
Notifica-vera + tour precomputato + regola "chiude alle" testati.

### 2.1 Gate O (post-verdict device 13/07) — Home onesta durante il caricamento

Ivano su iPhone ha visto due fake gravi sulla Home dopo Blocco 2.1: (1) POI di
Roma spacciati per POI locali per 2-5s prima del refetch quando il GPS arrivava;
(2) TopBar mostrava 24°C con la faccia del dato reale per svariati secondi
prima di saltare a 27°C vero. Diagnosi read-only ha trovato la catena:
`useEnhancedGeolocation` fallback Roma hardcoded → `useUserContext` initialData
`{city:'Roma', temperatureC:24}` → `buildSmartExperiencesAsync` fallback
41.9028/12.4964 → useQuery refetch quando GPS arriva → 6 chiamate Places doppie
+ POI errati mostrati.

- **`e801377` Gate O.1 — cityCenter autoritativo per POI Home + no refetch su GPS**.
  `buildSmartExperiencesAsync(cityName, cityCenter, userDNA)`: firma cambia,
  cityCenter garantito dal chiamante (risolto una volta a monte via
  `resolveCityCenter` — Places-auth). Rimosso fallback Roma 41.9028/12.4964.
  useQuery `home-experiences` queryKey `[city, totalInteractions, hasPreferences]`
  senza lat/lng → il primo blocco POI non aspetta il GPS e non rifetcha quando
  arriva. Costo Places dimezzato. Se `CityCenterUnresolvedError` → return []
  → empty state onesto. Le distanze utente-POI si calcolano client-side dai
  lat/lng già presenti quando arriva il GPS (le card Home attuali non le
  mostrano). **Verificato device**: POI della città giusta al primo render,
  zero sfarfallio, zero POI di Roma per utenti Catania.

- **`7f84af0` Gate O.2 — kill fake residui Home + 3 skip riattivate + regola anti-rientro**.
  10 file, +267/-203. Fix strutturale null-propagation:
  - `useUserContext.js`: `initialData` rimosso, `enabled: !!effectiveCity`, no
    fallback 'Roma'. Il consumer riceve `city`/`temperatureC` undefined finché
    non esistono davvero.
  - `useEnhancedGeolocation.js`: `setSimulatedLocation` → `markLocationUnavailable`
    (location:null). `reverseGeocode` fallback Nominatim `|| null` (era `|| 'Roma'`).
  - `userContextService.js`: `let city = null`, `let temperatureC = null`,
    `let weatherCondition = null`. Weather fetch e tours count skippati se
    city null. `reverseGeocodeCity` ritorna null (non 'Roma').
  - `CityContext.jsx`: `useState(null)` initial state (era `'Roma'`). Consumer
    protetto da isManual guard.
  - `notificationRecipes.js`: `computeWeatherClass` ritorna null se temp+condition
    entrambi assenti (era: `22°C sereno` cablato). Il chiamante skippa la notifica.
  - `TopBar.jsx`: currentTemp solo se `Number.isFinite`. currentCity fallback
    "Scegli città" italic (invito, non fake). NotificationBell `currentLocation`
    senza fallback 'Roma'.
  - `DashboardUser.jsx buildSmartExperiencesAsync`: rating/reviews via `Math.random`
    RIMOSSI. `theme.price` hardcoded RIMOSSO. THEME_CONFIGS senza campo price.
    Branch tappe finte con `Math.random` lat/lng SOSTITUITO da filter: tema
    senza POI reali → tema saltato. Bug preesistente #180 (isAiGenerated
    duplicato) risolto en passant.
  - Insider featured: `rating: 4.9, reviews: 0, price: 0` rimossi.
  - Notifications.jsx tour precomputed: `rating: 5.0, price_eur: 0` rimossi.
  - Card Home render: badge rating condizionale, prezzo condizionale.
  - Test userContextService.test.js aggiornati per null-propagation (5 test).
  - Anti-fake: 3 regole da skip a bloccanti (`no-rating-hardcoded`,
    `no-price-eur-hardcoded`, `no-math-random-in-rating-or-reviews`) con
    allowlist per pagine non-Home (cleanup Blocco 2.2/2.3). Nuova 4a regola
    attiva: `no-hardcoded-city-or-temp-defaults` (pattern `|| 'Roma'`,
    `city: 'Roma'`, `city = 'Roma'`, `temperatureC: <numero>`). Blocca
    rientro nel path Home; allowlist per componenti non-Home.
  - **Verificato device**: startup pulito senza Roma-lampo. 24°C sparito.
    Card AI senza rating/prezzo finto. Refetch GPS assente.

- **`1d8c98e` Gate O.3 — dead code**. `FeaturedExperience.jsx` orfano
  (Toscana €45 4.8★ Unsplash) eliminato. `DemoHint.jsx` (ENABLE_DEMO_MODE=false
  stabile, ritornava null) eliminato + rimossi 3 import residui da
  SurpriseTour.jsx, QuickPath.jsx, AiItinerary.jsx. `MapPage.jsx`: verifica
  passata, skeleton onesto già presente per loading tour + indicator
  "Aggiorno tour…" per refetch. **Verificato device**: nessuna regressione.

- **Gate O.4 — Rating POI-level + featuredPoi Home + regola anti-tour-rating**.
  Diagnosi in O.3 ha rivelato che `poi.rating` e `poi.user_ratings_total` da
  Google Places arrivavano al motore (usati dalle soglie Gate I) ma **si perdevano
  nel mapping** `generatedSteps` di `buildSmartExperiencesAsync`. Regola locked
  Ivano: il rating è un fatto del singolo POI, MAI del tour aggregato (nessuna
  media, nessuna somma). Fix:
  - `buildSmartExperiencesAsync`: rating/reviewsCount preservati su ogni step
    (guard: null se 0/assente, mai "N/D" mai 0★).
  - `featuredPoi` selezionato via qualityScore = rating × ln(1+total) — lo
    stesso indice usato dalle soglie Gate I. Solo tra step con rating reale.
  - Card Home: sotto il title, "Include {featuredPoi.name} · ★{rating}". Un
    solo POI, un solo numero, verificabile su Maps.
  - `normalizeTourStep`: `reviewsCount` aggiunto alla shape canonica (era
    solo `rating`).
  - Rimosso il render `{exp.rating}` a livello card (era il rating tour-level
    dal DB, oggi comunque fake seed in V1 senza review-writing utenti).
  - Nuova regola anti-fake attiva `no-rating-or-reviews-at-tour-level`:
    pattern `\{(?:exp|tour|experience|item)\.(?:rating|reviews|reviewsCount|user_ratings_total)\b`.
    Non matcha `{step.rating}` né `{exp.featuredPoi.rating}`. Allowlist per
    TourLive.jsx / Profile.jsx / Explore.jsx (cleanup Blocco 2.2/2.3).

**Anti-fake test — stato al 13/07**:
- 5 regole attive/bloccanti (era 3 il 12/07):
  `no-reviews-hardcoded`, `no-roma-coords-in-tour-content`,
  `no-alert-instead-of-action`, `no-ai-notif-without-engine-version` (Gate N.0),
  `no-rating-hardcoded` (O.2), `no-price-eur-hardcoded` (O.2),
  `no-math-random-in-rating-or-reviews` (O.2), `no-hardcoded-city-or-temp-defaults` (O.2 NEW),
  `no-rating-or-reviews-at-tour-level` (O.4 NEW).
- 4 skip rimaste (era 7): `no-fake-reviewer-names`, `no-luogo-di-interesse-placeholder`,
  `no-unsplash-in-content`, `no-in-arrivo-toast`. Cleanup Blocco 2.

**Nota costi**: Gate N.2 cambia natura al budget syswarm 6/day. Prima era
6 completion OpenAI (gpt-4o-mini) per precompute. Ora è **3 place/details
Basic Data × N notifiche** (gratis su Places legacy Basic Data). Il costo
per notifica-vera è ora: 1 openai call (generateWeatherSocialTip)
+ 3 opening_hours details (Basic Data) al momento della notifica
+ 3 details per il precompute (Basic Data) all'apertura modal.
Ricalcolare `COST_PER_TOUR.md` al prossimo giro sui costi (non urgente,
Places legacy Basic Data non ha costo per call).

**Come forzare rigenerazione notifica su device** (per verifiche Ivano):
Safari desktop connesso a iPhone via cavo → Sviluppo → seleziona iPhone
→ pagina Notifications → Console:
```
Object.keys(sessionStorage).filter(k => k.startsWith('dvai_smart_notif_')).forEach(k => sessionStorage.removeItem(k)); location.reload();
```
Al mount successivo la cache è miss → nuova notifica-vera (o silenzio se
Places 0 candidati con la ricetta corrente).

### 2.2 Profilo reale 🔴 DA FARE

Oggi il tab Profile mostra dati finti (regioni "Toscana 8 tour", "Sicilia 5 tour"
con foto Unsplash — dead data). Cleanup + collegamento a `explorers.tours_completed`,
`explorers.km_walked`, `user_photos` reali.

### 2.3 Esplora = tour AI + tour guide 🔴 DA FARE

Explore oggi mostra solo `tours` DB. Con guide dashboards spente in V1, il DB
è quasi vuoto. Serve: mescolare `smartTours` (Places tematici via
`buildSmartExperiencesAsync`) + tour DB reali quando ci saranno. Empty state
onesto in mezzo (già in place da Gate D-4).

### 2.4 Schermate "Prossimamente" 🔴 DA FARE

`V1LockedGuard` oggi è un redirect + toast. Ivano ha corretto la rotta:
`Guide Locali` / `Attività/Business` / `Foto` devono avere una **schermata
dedicata** che dice COSA arriva e PERCHÉ servirà. Non "torna più tardi". Un
"Prossimamente" fatto bene è una promessa, non un buco. Design coerente col
brand, non cheap.

### 2.5 language=it 🔴 DA FARE (Task #162)

`buildPlacesProxyUrl` senza `language=it` → Google restituisce alcuni nomi in
inglese ("Syracuse Cathedral" invece di "Duomo di Siracusa"). Fix un-liner:
default `language=it` nel builder.

### 2.6 Durata autorevole 🔴 DA FARE (Task #159)

Bug UI: scheda tour mostra "3h m" — minuti vuoti. E in QuickPath tour di 165
minuti compare "2h 45m" ma altrove "165 min fantasma". Un solo formatter,
autorevole, usato ovunque.

### 2.7 Narratore: fatti non poesia 🔴 DA FARE

`buildSelectorSystemPrompt` (Gate B F2) narra "il marmo che riflette la luce" —
poesia inventata. Applicare la stessa regola locked delle notifiche
(feedback_dovevai_voce.md): title/description dei POI = FATTO verificabile, mai
aggettivi. + Estendere il narratore ai 5 tour tematici "Per Te" nella Home
(oggi buildSmartExperiencesAsync ritorna POI Places senza description AI,
mostrati con description vuota).

### 2.x — Due duplicati JSX (Task #179 #180) ✅ CHIUSI Gate O (side effect)

Entrambi risolti nel corso di Gate O.2 (`7f84af0`).

---

## Aggiornamento 14→16/07 — Gate P → EE (2 giorni intensi)

Filo conduttore: 15 giorni al lancio. Ogni gate = un problema tolto dalla
vetrina di un utente nuovo che apre l'app per la prima volta senza cache. Ogni
verdict device di Ivano genera un nuovo gate mirato.

### Gate P — Home coerente e SurpriseTour onesto (14/07)

- **`P.1` Deduplica POI cross-tema + copertine ripetute**. Home mostrava lo
  stesso POI in più tour tematici (2-3 copertine identiche). Fix in
  `buildSmartExperiencesAsync`: `seenPlaceIds` cross-tema, ogni POI compare
  in un solo tour (il primo tema che lo abbraccia).
- **`P.2` SurpriseTour categoria prima del bottone**. Ivano: "premo Sorprendimi
  e non so cosa mi arriva". Ora la card mostra la categoria (Cultura/Natura/
  Cibo/Panorama) PRIMA del click. Il "surprise" è nel POI specifico, non nel
  tipo di esperienza.
- **`P.3` Schermate "Prossimamente" dedicate** (era 2.4). Rotte `V1LockedGuard`
  ora hanno pagine vere: `Prossimamente.jsx` + `GuidePlaceholder.jsx`. Copy
  onesto: "COSA arriva e PERCHÉ servirà", non "torna più tardi".

### Gate Q — Marker opaco fabbrica notifiche (14/07)

Buco identificato: la costante `NOTIFICATION_ENGINE_VERSION = 'v2-notifica-vera'`
di Gate N.0 era una stringa scrivibile a mano. Chiunque pusha `engineVersion:
'v2-notifica-vera'` a mano passa il filtro. Un marker che chiunque può scriversi
non è un marker: è una convenzione.

- Nuovo file `src/lib/aiNotificationFactory.js`: signature FNV-1a hash con
  `FACTORY_SALT` privato di modulo. `makeAiNotification(payload)` è l'UNICO
  punto di creazione: computa hash da `type|title|message|slot|city|weatherClass`
  + salt e lo scrive con **computed key** `[SIG_KEY]:` (opaca).
  `isValidAiNotification(notif)` ricalcola l'hash e confronta.
- Nuova regola anti-fake bloccante `no-engine-version-literal-key`: pattern
  `\bengineVersion\s*:` in tutto il repo. Allowlist ZERO. La fabbrica passa
  per costruzione (usa `[SIG_KEY]:` non literal).
- Kill del `night` branch che pubblicava `type:'recommendation'` per bypass
  del filtro AI_NOTIF_TYPES di Gate N.0. AI_NOTIF_TYPES esteso a
  `recommendation` come difesa in profondità.

### Gate R — CTA notifica coerente col contenuto (14/07)

Bug diagnosi: notifica citava "Bar Savia" ma CTA apriva `/tour-details/<id-fisso>`
che portava altrove. Fallback statico `'/explore'` faceva sembrare che il
bottone funzionasse mentre portava a Explore.

- `Notifications.jsx handleVediGiro` costruisce il tour dai `chosenPois` via
  `generateSystemPrewarmTour` e naviga con `state: {tourData}`. Nessun
  `actionUrl` literal.
- Nuova regola anti-fake bloccante `no-static-action-url-on-ai-notification`:
  pattern `\bactionUrl\s*:\s*["']`. Allowlist: `DashboardGuide.jsx` (V2 spento
  dal V1LockedGuard). Zero eccezioni in path AI.

### Gate S — TTL 5min + userId cache key + signOut cleanup + title cue (14/07)

Bug scoperto: utente B leggeva notifica di utente A col nome di A dentro. Cache
`dvai_smart_notif_${slot}-${city}-${date}` senza userId.

- Cache key con userId scoped: `dvai_smart_notif_${userId}_${slot}_${city}_${date}`.
- TTL 5min al render (chokepoint `isNotificationLive` calcolato live, non dentro
  cache read — la state React congelava il badge). Badge = lista, sempre.
- `signOut` cleanup: `.filter(k => k.startsWith('dvai_smart_notif_')).forEach(removeItem)`.
- Title notifica include cue di slot ("🌅 Colazione a Catania", "🌇 Aperitivo a Roma")
  → l'utente capisce a colpo d'occhio quale contesto sta consigliando.
- Nuova regola anti-fake attiva `no-user-derived-storage-key-without-userid`:
  se una line contiene `dvai_smart_notif_`/`read_generated_notifs`/
  `deleted_generated_notifs` deve contenere userId marker o essere cleanup
  helper (`.filter`/`.forEach`).

### Gate T — Cap syswarm rimosso + kill giudizio "ottima scelta" + copy CTA (14/07)

- Cap 6/day `unnivai_syswarm_` di Gate N.2 rimosso: era premature optimization
  contro un costo che dopo Gate N.2 non esiste più (place/details Basic Data
  = gratis su Places legacy).
- Blacklist prompt AI estesa: `"ottima scelta"`, `"perfetta scelta"`, tutti i
  giudizi di merito che l'AI non ha strumenti per fare.
- Post-processing regex rimuove formule di giudizio residue dal message se
  bucano il prompt.
- CTA lista notifica: copy per status (`ready`/`loading`/`cap_exceeded`/`error`).

### Gate V — Timeout su tutti fetch Places + regola anti-fake (14/07)

Ogni `await fetch(url)` senza `signal` è una promise che può pendere per
sempre. Bug scoperto in Gate N.2: `fetchPlaceDetailsForTour` senza timeout
appendeva Promise.all in generateSystemPrewarmTour → spinner infinito nel modal.

- `AbortController` + timeout 5s (Places/GPS) o 12s+ (OpenAI) su tutti i fetch
  di `placesDiscoveryService.js`, `useEnhancedGeolocation.js` (Gate X),
  `aiRecommendationService.js` path Home critico.
- Nuova regola custom bloccante `no-fetch-without-abort-signal` in file
  `services/`, `lib/`, `hooks/`, `context/`: scan `fetch(` con lookforward
  +8 righe per `signal:`. Allowlist per file legacy (`userContextService.js`,
  `weatherService.js`, `poiService.js`, `dataService.js`,
  `aiRecommendationService.js` verifyPOIWithPlaces) — cleanup Blocco 2 pianificato.
- Regola locked (Ivano 14/07): "una fetch senza timeout che pende è la stessa
  classe di bug dello spinner infinito — solo che qui l'utente aspetta senza
  nemmeno una rotella".
- Guard useEffect precompute anti-loop (dep list corretta: no funzioni ricreate
  a ogni render).

### Gate W — Kill "LIVE NOW" + schermate Prossimamente V2/V3 (14/07)

- Badge "LIVE NOW" (dashboard e TopBar) rimosso: era una promessa di feature
  live che V1 non ha.
- Schermate `/prossimamente/guide`, `/prossimamente/business`, `/prossimamente/foto`
  con contenuto vero (cosa arriva, quando, perché). Badge "◇ IN COSTRUZIONE"
  (senza numero di fase — "Fase 2/3" rivelava roadmap interna, Gate CC.1).

### Gate X — GPS regressione fixata (14/07)

`enableHighAccuracy: true` iOS causava 45s indoor prima di fallire → app
bloccata in "Trovo la tua posizione…" per un ciclo intero. Options tourism-mobile
uniformate: `enableHighAccuracy: false, timeout: 8000, maximumAge: 5*60*1000`.
Timeout Nominatim/ipapi/Google Maps geocode. Fallback ipapi nel banner GPS
user-gesture (era asimmetrico).

### Gate Y — Fix loop useEffect + fallback IP banner + badge (14/07)

`trackInteraction` ricreata ogni chiamata da `useAILearning` → `useEffect`
deps sempre nuovo → re-mount infinito → spinner infinito Home.
Fix: rimossa `trackInteraction` dalle deps + spostata in handleVediGiro.
Fallback IP nel `requestGPS` banner (era asimmetrico rispetto al primo mount).
Badge `◇ IN COSTRUZIONE` unificato su rotte V2/V3.

### Gate Z — Badge fantasma chokepoint + GPS desktop strumentato (14/07)

- Chokepoint `isNotificationLive` calcolato ad ogni render (non dentro cache
  read che React congelava). Badge = lista, sempre.
- Log strumentali GPS desktop (dove tipicamente il coarse IP-based fallback
  ha lat/lng lontano dalla città reale) per capire dove il flow prende scorciatoie.
- SurpriseTour categoria prima del bottone (side effect di P.2 esteso).

### Gate AA — Deadlock isLoading + CityModal onboarding (14/07)

Bug del "Ciao, …!" eterno: `useUserContext.isLoading` includeva `!effectiveCity`
→ se GPS negato/fallito la città non arriva mai → loading eterno → vicolo
cieco.

- Fix: `isLoading = gpsLoading || contextFetching` (NO `!effectiveCity`).
  Nuovo stato esplicito `needsCityChoice = !gpsLoading && !effectiveCity`.
- `TopBar` reagisce a `needsCityChoice`: apre `CityModal` mode="onboarding"
  automaticamente al primo mount della dashboard (una sola volta per sessione),
  titolo "Da dove cominciamo?". L'utente sceglie città → `setCity(...)` →
  Home carica.
- Regola strutturale locked (Ivano 14/07): "un solo motore di città in tutta
  l'app". Il CityModal Gate AA è l'unico posto dove si chiede la città.
- Nuova regola anti-fake bloccante `no-loading-without-exit`: pattern
  `isLoading\s*[:=][^,;{}]*\|\|\s*!`. Blocca il pattern "isLoading dipende
  dalla negazione di dato user-scoped" ovunque. Allowlist ZERO. Regola locked
  (Ivano 14/07): "nessun guard può creare uno stato non-uscibile".

### Gate BB — Tagli costi U.1 (15/07)

Diagnosi costi pre-lancio: la Home consumava $17/utente/mese di Places
(textsearch × 5 temi × 2 refetch GPS = 10 chiamate a $0.017/each).

- **Kill setInterval 30min** in `useUserNotifications` (era: rigenera notifica
  ogni 30 min anche se l'utente non guarda). Nuovo trigger: focus tab + cambio
  slot temporale (mattina/pranzo/pomeriggio/sera).
- **Separa candidati/testo**: `fetchPlaceOpeningHours` e
  `fetchPlaceDetailsForTour` con cache 24h (localStorage per-browser, chiave
  `unnivai_place_details_v1_<placeId>`). Prima re-fetchava a ogni notifica.
- **Fields ridotti a Basic** (no Atmosphere SKU): `fields=place_id,name,geometry,
  opening_hours,photos,types` — niente `rating`, `user_ratings_total`,
  `formatted_phone_number` nel path notifica (rating serve solo per soglie
  Gate I, viene già via textsearch che è Basic).
- `chosenPois` payload esteso con `rating`/`user_ratings_total` da textsearch
  → notifica sa se il POI ha review threshold Gate I senza chiamare details.

**Costo teorico post-BB**: ~$2.61/utente/mese (era $17). Ma vale solo dal
secondo giorno dello stesso utente (localStorage per-browser).

### Gate CC — "Fase 2/3" rimosso + diagnosi Esplora V1 (15/07)

- CC.1: rimosso "Fase 2/3" dal testo interno Prossimamente (rivelava roadmap
  interna a utenti esterni).
- CC.2: Esplora marker mappa su coordinate vere (era: fallback Roma per tour
  senza latitude/longitude). `mapCenter` da `resolveCityCenter` (no fallback
  hardcoded). Kill 3 fake: rating tour-level (regola O.4 estesa a Explore),
  prezzo hardcoded, coord Roma inline.
- CC.3 (pending, prossima sessione): Esplora completo — mostra tour DB reali
  + tour AI-generated + card "Presto guide locali" onesta come segnaposto V2.

### Gate DD (U.1-bis) — Cache condivisa server-side Supabase (15/07) 💰

**Il taglio costi che vale davvero**. Diagnosi Ivano: cache localStorage di
Gate BB è per-browser. Al lancio, ogni utente NUOVO paga la Home piena
($0.157 di textsearch). Il "hit rate 90%" della stima Gate BB vale solo dal
secondo giorno dello stesso utente. La cache condivisa è la leva vera: la
prima persona che apre una città paga; tutte le successive leggono a costo zero.

- Nuova tabella `public.places_cache` (migration
  `supabase/migrations/20260715_gate_dd_places_cache.sql`): `cache_key TEXT
  PRIMARY KEY, data JSONB, created_at TIMESTAMPTZ`. RLS public read (debugging),
  service_role write (edge function).
- `supabase/functions/places-proxy/index.ts` Gate DD update:
  - `computeCacheKey(path, params)` deterministico (params sorted, escluso
    `path`/`key`, prefix `CACHE_VERSION='v1':`).
  - `cacheLookup(cacheKey)`: fail-OPEN (errore Supabase → miss → chiamata
    Google). L'utente non deve mai vedere errore perché la cache è down.
  - `cacheWrite(cacheKey, data)`: fail-CLOSED (errore → log, non blocca risposta
    al client). Fire-and-forget, non await.
  - Solo `status:'OK'` cachato (ZERO_RESULTS oggi potrebbe essere OK domani,
    OVER_QUERY_LIMIT non è dato buono da servire 24h).
  - Path cachable: `place/findplacefromtext`, `place/textsearch`,
    `place/nearbysearch`, `place/details`. Photo esclusa (302 verso CDN
    firmato temporaneo).
  - Header `X-Cache: HIT|MISS` per debugging.
- TTL 24h. Cleanup manuale via SQL comment nella migration (`DELETE FROM
  places_cache WHERE created_at < NOW() - INTERVAL '25 hours'`) — da schedulare
  in Supabase Cron una volta al giorno se lo storage cresce.
- **Costo atteso post-DD**: -85% chiamate Places al lancio. La prima persona
  su Catania paga (~$0.157); dalla seconda in poi cache HIT per 24h → zero
  costo Places. Ricalcolo `COST_PER_TOUR.md` pendente.

**Verificato device**: Gate BB + DD verificati da Ivano su iPhone il 15/07.
Rimane pending: verifica end-to-end 3× di fila su device (browser nuovo,
utente diverso, città diversa).

### Gate EE — Landing + Onboarding + Login onesti V1 (16/07) 🏁

Screenshot Ivano ha mostrato che la PRIMA cosa che vede un utente nuovo era
piena di fake gravi:

- Persona finta con foto stock ("Giulia Romano" + foto randomuser.me + 218 tour
  + prezzi €45 + chat "in tempo reale") — mock di funzione V2/V3 come UI reale.
- Prezzi tour hardcoded (€18, €28, €45).
- Social proof inventato ("+2.800 viaggiatori" + 4 avatar randomuser + 5 stelle
  senza recensione dietro).
- Feature V2/V3 promesse come V1: "guide locali certificate", "navigazione live",
  "storie in diretta", "chatta con la guida", "audioguida".
- "Roma" hardcoded in Onboarding travestito da "posizione rilevata
  automaticamente" (era `useState('Roma')` per `selectedCity`).
- "Tour con guide locali · Esperienze autentiche" nella welcome card
  Onboarding.

Ivano: "prima la verità, poi la forma. Un prezzo finto è peggio di un design
brutto: dice che l'app fa cose che non fa".

**Commit `63e3948`** — 5 file, +207/-250:

- **Landing.jsx** — riscrittura V1 onesta:
  - Hero: "Il posto esiste. Nessuno te lo aveva mostrato così." (frase-firma
    locked Ivano).
  - Eliminati `Step3Phone` (chat Giulia) e `Step4Phone` (live navigation).
  - `Step2Phone` mock ora ASTRATTO: "Tappa 1/2/3" + categoria + orario, zero
    nomi POI veri, zero prezzi in euro, zero città hardcoded nell'header.
  - `STEPS` ridotto da 4 a 3.
  - Rimosso blocco social proof "+2.800 viaggiatori" + 4 avatar randomuser.me
    + 5 stelle piene senza recensione dietro.
  - Feature grid: Motore AI / Mappa vera / Personalizzazione (era: "Guide
    Locali Vere / Esperti del territorio certificati" = V2 spacciato per V1).
  - UNA riga linkata a `/prossimamente/guide` in fondo (senza usare il
    termine-trigger V2 nel testo user-visible).
  - "in tutta Italia" (promessa di copertura fisica) → "in qualunque città
    scegli" (vero: il motore funziona ovunque ci siano POI Google).

- **Onboarding.jsx** — vincolo strutturale locked Ivano:
  - RIMOSSO `useState('Roma')` per `selectedCity`. L'onboarding NON ha più un
    suo motore di città.
  - RIMOSSO `setCity` da `useCity()` idem.
  - RIMOSSO import `useCity`, `MapPin`, `ITALIAN_CITIES`.
  - RIMOSSO riepilogo "Città: {selectedCity}" nella ready card (mostrava
    "Roma" hardcoded travestito da riepilogo scelte).
  - RIMOSSA card welcome "Tour con guide locali · Esperienze autentiche fuori
    dai circuiti turistici" (V2 promesse come V1). Le 2 card restanti
    ("Itinerari AI" + "Mappa vera") descrivono solo ciò che V1 fa.
  - Subtitle ready step: "Ci siamo. Inizia." / "La città te la chiediamo
    tra un secondo."
  - **Un solo motore di città in tutta l'app**: la città si chiede solo nel
    `CityModal` di Gate AA, al primo mount della dashboard. L'onboarding fa:
    benvenuto → interessi → pronto → dashboard → (Gate AA apre CityModal).

- **Login.jsx**:
  - Rimosso blocco social proof (3 avatar randomuser + 5 stelle + "+2.800
    utenti attivi") — Login è la seconda schermata del prodotto, stesse regole.
  - `perks` esploratore: da "Guide locali verificate / Mappa interattiva live"
    (V2) a "Luoghi veri da Google Places / Coordinate reali" (V1 vero).
  - `desc` role: da "Scopri tour unici creati da locali" a "Ogni giorno l'AI
    ti costruisce un percorso su misura in qualunque città italiana, con
    luoghi veri e orari veri".

- **validationSchemas.js**: `Prezzo massimo €5000` → `Prezzo massimo 5000 euro`
  (side effect regola `no-fake-price-in-copy` — validationSchemas parla dell'
  input dashboard guide V2 spenta, ma il pattern trigger vale ovunque).

**5 nuove regole anti-fake bloccanti** in `src/__tests__/anti-fake.test.js`
(grep-based CI wall — Landing/Onboarding/Login MAI in allowlist):

- `no-fake-price-in-copy`: pattern `€\s?\d{1,4}(?:[.,]\d{1,2})?(?!\w)`. Allowlist:
  `MVPEnhancements.jsx` (dead code pitch deck, non importato). Regola locked
  (Ivano 15/07): "prima la verità, poi la forma".
- `no-fake-persona-avatars`: `randomuser\.me|unsplash\.com/(?:photos|portraits)/[^"'\s]*face|thispersondoesnotexist|generated\.photos`.
  Allowlist ZERO.
- `no-fake-social-proof-numbers`: `\+?\d{1,3}[.,]?\d{3}\s+(viaggiatori|utenti|clienti|persone|iscritti|scaricamenti|download)`.
  Allowlist ZERO.
- `no-v2-features-in-copy`: `guide locali|esperti certificati|audioguida|storie in diretta|navigazione live|chatta con la guida|prenota (?:un|una) guida|booking guida`.
  Allowlist: `Prossimamente.jsx`, `GuidePlaceholder.jsx` (pagine che
  DICHIARANO esplicitamente che la feature non c'è ancora), + file legacy con
  cleanup Blocco 2 pianificato: `TourDetails.jsx` (copy "esplora tour reali
  delle nostre guide locali" in ramo tour demo V2), `AiItinerary.jsx`
  (loading text "L'IA sta consultando le guide locali" — menzogna operativa:
  consulta Google Places), `DashboardUser.jsx` (conferma guide_request V2),
  `MVPEnhancements.jsx` (dead code pitch deck).
- Estensione `no-hardcoded-city-or-temp-defaults` a pattern
  `useState\s*\(\s*["']Roma["']\s*\)` — blocca il rientro del bug
  Onboarding fix.

**Landing.jsx rimossa** da allowlist `no-unsplash-in-content` (skip:true in
attesa cleanup completo Profile.jsx, ma niente più terreno franco per Landing).

**Test finale**: 202 passed | 4 skipped | 0 failed. Build OK. CI verde
(Lint&Test + E2E Smoke). Vercel verde (`63e3948`).

---

## Anti-fake test — stato al 16/07 (dopo Gate EE)

**14 regole attive bloccanti** (era 9 il 13/07 dopo Gate O.4):

Rating/coord/price/city (dal 12→13/07):
1. `no-rating-hardcoded` (O.2)
2. `no-reviews-hardcoded`
3. `no-price-eur-hardcoded` (O.2)
4. `no-roma-coords-in-tour-content`
5. `no-alert-instead-of-action`
6. `no-math-random-in-rating-or-reviews` (O.2)
7. `no-hardcoded-city-or-temp-defaults` (O.2, esteso a `useState('Roma')` in EE)
8. `no-rating-or-reviews-at-tour-level` (O.4)

Loading/CTA/marker (14/07):
9. `no-loading-without-exit` (AA)
10. `no-static-action-url-on-ai-notification` (R)
11. `no-engine-version-literal-key` (Q)
12. `no-places-url-outside-builder` (Gate 3 T1)
13. `no-fetch-without-abort-signal` (V, custom loop con allowlist)
14. `no-user-derived-storage-key-without-userid` (S, custom loop)
15. `no-ai-notif-without-engine-version` (N.0, custom loop)

Landing/vetrina (16/07 Gate EE):
16. `no-fake-price-in-copy` (EE)
17. `no-fake-persona-avatars` (EE)
18. `no-fake-social-proof-numbers` (EE)
19. `no-v2-features-in-copy` (EE)

(La numerazione salta perché `no-in-arrivo-toast`, `no-fake-reviewer-names`,
`no-luogo-di-interesse-placeholder`, `no-unsplash-in-content` restano skip
in attesa di cleanup — 4 skip totali.)

**Landing.jsx / Onboarding.jsx / Login.jsx MAI in allowlist di regole EE**
— sono la vetrina del prodotto, valgono le stesse regole del resto.

---

## Stato costi al 16/07 (post Gate DD)

Modello a **2 livelli di cache**:

1. **Supabase `places_cache` condivisa** (Gate DD, server-side, TTL 24h):
   la prima persona che apre una città paga textsearch/details Google (Basic
   Data ~$0.017/chiamata textsearch, $0/details Basic). Da quel momento, per
   24h, tutti gli altri utenti che chiedono la stessa cosa leggono a costo zero
   dalla `places_cache`.
2. **localStorage per-browser** (Gate BB, client-side, TTL 24h):
   evita round-trip Supabase per richieste ripetute dallo stesso browser.

**Stima costi pre/post gate** (per Home tematica × 5 categorie):

| Fase             | textsearch/utente | note                                        |
|------------------|-------------------|---------------------------------------------|
| Pre Gate O       | 10 chiamate       | 5 temi × 2 refetch GPS. ~$17/utente/mese.   |
| Gate O.1         | 5 chiamate        | Kill refetch GPS. ~$8.5/utente/mese.        |
| Gate BB          | 5 chiamate primo giorno, 0 dal secondo (per-browser) | ~$2.61/utente/mese teorico. Vale solo dal 2° giorno. |
| Gate DD (attuale)| 5 chiamate primo utente sulla città, 0 per tutti gli altri per 24h | -85% atteso al lancio. |

**Ricalcolo `COST_PER_TOUR.md`** rimane pendente. Non urgente: Places legacy
Basic Data non ha costo per call (solo textsearch cost). Il vero risparmio DD
è sul cost-per-user, non sul cost-per-tour.

**Verifica cache hit device**: pendente (verificare `X-Cache: HIT` header
Supabase edge function nelle DevTools Network dopo secondo utente sulla stessa
città entro 24h).

---

## Regole locked NUOVE (14→16/07)

Le 6 originali (blocco 1) restano. Nuove aggiunte:

7. **Nessun guard può creare uno stato non-uscibile** (Gate AA, 14/07). Se un
   guard blocca una query, deve esistere un percorso che permetta all'utente
   di sbloccarla. Bug del "Ciao, …!" eterno: isLoading dipendeva da
   `!effectiveCity` → GPS negato → loading eterno. Fix strutturale: distinguere
   "non lo so ancora" (loading vero) da "non lo so" (stato noto → apre modal).
   Regola grep-based blocca `isLoading\s*[:=][^,;{}]*\|\|\s*!` ovunque.

8. **Un solo motore di città in tutta l'app** (Gate AA, 14/07). La città si
   chiede solo nel `CityModal` di Gate AA, al primo mount della dashboard.
   Bug Onboarding: `useState('Roma')` era un secondo motore che mostrava Roma
   travestito da "posizione rilevata". Due erano il bug — uno solo è la regola.
   Regola grep-based (parte di `no-hardcoded-city-or-temp-defaults`) blocca
   `useState('Roma')` ovunque.

9. **Un marker di verità che chiunque può scriversi non è un marker: è una
   convenzione** (Gate Q, 14/07). Marker notifiche AI = signature opaca
   FNV-1a hash da fabbrica con salt privato di modulo, key computata
   `[SIG_KEY]:` (non literal `engineVersion:`). Regola grep-based
   `no-engine-version-literal-key` blocca literal key ovunque.

10. **Ogni stato di loading ha un timeout e una via d'uscita** (Gate V, 14/07).
    Un `await fetch` senza signal è una promise che può pendere per sempre.
    Regola grep-based `no-fetch-without-abort-signal` blocca fetch senza
    AbortController in services/lib/hooks/context.

11. **Prima la verità, poi la forma. Un prezzo finto è peggio di un design
    brutto: dice che l'app fa cose che non fa** (Gate EE, 15/07). La landing
    è la prima schermata del prodotto: vale le stesse regole del resto.
    Zero mock di UI futura come UI reale, zero personas inventate, zero prezzi
    inventati, zero social proof scritto a mano, zero feature V2/V3 promesse
    come V1. 5 regole grep-based (`no-fake-price-in-copy`,
    `no-fake-persona-avatars`, `no-fake-social-proof-numbers`,
    `no-v2-features-in-copy`, estensione `no-hardcoded-city-or-temp-defaults`).
    Landing/Onboarding/Login MAI in allowlist.

12. **La voce del brand è fatti verificabili, mai aggettivi** (`feedback_dovevai_voce.md`,
    consolidata da Gate T + Gate N). Title = dato nudo. Message = motivo
    verificabile. Blacklist: "sorseggia", "gusta", "spettacolare", "ottima
    scelta", "perfetta scelta", storia inventata del POI. Post-processing
    regex rimuove formule di giudizio residue.

13. **Segreti mai in chat** (locked Ivano 15/07, 2 volte enforced). Se l'utente
    incolla un `SUPABASE_ACCESS_TOKEN`/PAT GitHub/key API in chat: rifiutalo
    come compromesso, chiedi di revocarlo e usarlo via `export` in shell.
    Security grep pre-commit obbligatorio: `AIza|sk-|eyJ|sbp_|SUPABASE_SERVICE`.
    Mai committare `.env`. PAT GitHub: solo read-only permissions. Mai
    committare senza OK esplicito user.

---

## Backlog aperto al 16/07 (in ordine di priorità 15 giorni al lancio)

### Priorità 1 — Vetrina + primo accesso completi

- **Gate CC.3** (task #221, pending): Esplora completo — mostra tour AI +
  segnaposto "Presto guide locali" onesto. Vincolo: kill "Guida DoveVai"
  default (era: ogni tour AI attribuito a una guida fittizia "DoveVai
  Concierge"). Prossima sessione.
- **Verifica notifiche end-to-end 3× di fila su device**: browser nuovo,
  utente diverso, città diversa. Verifica anche `X-Cache: HIT` per DD.

### Priorità 2 — Bug residui piccoli

- **Task #159**: durata scheda tour mostra "3h m" — minuti vuoti. Bug UI
  formatter, un-liner.
- **Task #163**: `POIDetailDrawer` legge `insiderTip`/`description`/`bestTime`
  reali (oggi placeholder generici).
- **Task #164**: kill "Luogo di interesse a X" placeholder + commento
  ottimistico ("Un posto che merita una visita" default).
- **Bug MapPage `|| 'Roma'` residuo di O.2**: Gate O.2 ha rimosso i fallback
  Roma nel path Home ma MapPage ha ancora `city || 'Roma'` in un branch che
  non è path Home. Non urgente ma va tolto per coerenza.

### Priorità 3 — Blocco 2 restante (dal 13/07)

- **2.2 Profilo reale**: tab Profile mostra regioni fake ("Toscana 8 tour"
  Unsplash). Cleanup + collegamento a `explorers.tours_completed`,
  `explorers.km_walked`, `user_photos` reali.
- **2.3 Esplora = tour AI + tour guide** (parte di CC.3): mescolare
  `smartTours` (Places tematici) + tour DB reali. Empty state onesto.
- **2.5 language=it** (task #162): fixato ma verificare uniformità in tutti i
  path (POI del Duomo di Siracusa deve essere italiano, non "Syracuse
  Cathedral").
- **2.7 Narratore**: `buildSelectorSystemPrompt` (Gate B F2) narra poesia
  inventata. Applicare regola locked #12 (voce fatti non aggettivi). Estendere
  al narratore dei 5 tour tematici "Per Te" (oggi description vuota).

### Priorità 4 — Rate limit + operativi

- **U.2 rate limit server-side** sui numeri finali post-DD: se un IP fa >100
  chiamate/min al places-proxy → 429. Contro abuso post-lancio.
- **Cleanup FETCH_ALLOWLIST Blocco 2**: `userContextService.js`,
  `weatherService.js`, `poiService.js`, `dataService.js`,
  `aiRecommendationService.js` verifyPOIWithPlaces — cleanup timeout su tutti.
- **Cleanup allowlist regole EE**: `TourDetails.jsx` (copy tour demo V2),
  `AiItinerary.jsx` (loading text menzogna operativa), `DashboardUser.jsx`
  (conferma guide_request V2), `MVPEnhancements.jsx` (dead code pitch deck)
  — quando il Blocco 2 completa il cleanup, rimuovere da allowlist di
  `no-v2-features-in-copy` e `no-fake-price-in-copy`.
- **Riattivare 4 skip anti-fake**: `no-in-arrivo-toast`, `no-fake-reviewer-names`,
  `no-luogo-di-interesse-placeholder`, `no-unsplash-in-content` dopo cleanup
  dei file residui che li violano.

### Priorità 5 — Osservabilità pre-lancio

- **Cost-per-user monitoring**: dashboard Supabase per contare places_cache
  hits vs misses giornalieri. Se DD funziona, hit rate deve salire sopra
  80% dopo 48h dal lancio.
- **Cron cleanup places_cache**: `DELETE FROM places_cache WHERE created_at
  < NOW() - INTERVAL '25 hours'` giornaliero (evita crescita storage).

---

---

## Aggiornamento 16→17/07 — Gate FF/GG/II

Sessione dopo commit handoff `f1e3e66`. Tre gate su tre finding device
diversi + un allineamento infrastrutturale.

### Gate FF.2 (16/07) — Diagnosi READ-ONLY: HowItWorks vs Onboarding + design system

Finding Ivano: le slide "Come funziona DoveVai" hanno il mockup iPhone
tagliato sotto la fold su mobile. Diagnosi a 3 domande:

- (a) Screenshot = **modal HowItWorks** (`Landing.jsx:268`), NON Onboarding
  wizard. Due componenti distinti in file diversi con lifecycle diverso.
  HowItWorks: pitch marketing pre-signup con mockup iPhone finto (PhoneShell
  260×520 fisso). Onboarding: card wizard chiara post-signup, nessun mockup.
- (b) Onboarding wizard post-EE: welcome (2 card + hero "Il posto esiste") →
  interessi (grid 2×4 con 8 categorie) → pronto (subtitle "Ci siamo. Inizia.
  La città te la chiediamo tra un secondo."). `useState('Roma')` rimosso in
  EE; nessun riferimento a città. La città arriva dal CityModal Gate AA
  al mount della dashboard.
- (c) Non condividono design system. HowItWorks: `font-sans`, `bg-gray-950`,
  gradienti dinamici scuri, mesh + grid overlay, split 50/50 desktop.
  Onboarding: `font-quicksand`, `bg-gradient ochre→terracotta`, card unica
  centrata, palette warm chiara. Sono due mondi opposti (marketing scuro
  vs onboarding chiaro friendly). Per allinearli servono ~1 giornata di
  tokenizzazione tailwind → design system condiviso (V1.1 con Antigravity,
  non pre-lancio).

### Gate FF.1 (16/07) — Responsive HowItWorks + Onboarding

- `PhoneShell` scalabile: `w-[190px] h-[380px] sm:w-[220px] sm:h-[440px]
  md:w-[260px] md:h-[520px]`. Su iPhone 390×844 il mockup resta visibile
  "quasi completo" (~73% dell'originale), mai tagliato sotto la fold.
- HowItWorksModal compresso mobile: padding/font/margini/chip/nav-buttons
  responsive (`p-4→p-6`, `text-2xl→3xl→4xl`, chip `text-[10px]→xs`,
  buttons `h-10→h-11`). Container `h-svh` (dynamic viewport per Safari
  toolbar).
- Onboarding grid interessi compressa: card `p-2→p-3`, emoji
  `text-xl→2xl`, label/desc font ridotti. Wrapper `min-h-svh + p-3`.
- Verifica Playwright viewport 390×844: step 0/1/2 tutto entra, phone
  visibile completo.
- Estetica FINE (design system condiviso, colori, tipografia) rimandata
  a V1.1 con Antigravity.

### Gate GG (16/07) — ErrorBoundary onesto: chunk-reload + reporting reale

Finding Ivano: schermata "Qualcosa è andato storto" con dettaglio "...ml' is
not a valid JavaScript MIME type" (stale chunk post-deploy) + frase "Il team
tecnico è stato notificato" mentre nessuno riceveva niente + stack tecnico
grezzo esposto all'utente.

- **GG.1** — ErrorBoundary riconosce chunk-load come categoria a sé.
  Nuovo `classifyError` in `src/lib/errorReporting.js`: pattern per
  ChunkLoadError / "Failed to fetch dynamically imported module" /
  "Importing a module script failed" / "is not a valid JavaScript MIME
  type" / "Loading chunk N failed". `componentDidCatch`: se
  `errorType='chunk_load'` → `location.reload()` automatico UNA volta.
  Flag `sessionStorage['dvai_chunk_reload_attempted']` anti-loop
  (se già presente → fallback UI normale = bug vero, non stale cache).
  `componentDidMount` pulisce il flag → il prossimo deploy avrà di nuovo
  il suo reload disponibile. Durante il reload, spinner neutro.

- **GG.2** — "Team tecnico notificato" ora è VERO.
  - Nuova migration `20260716_gate_gg_error_logs.sql`: tabella
    `public.error_logs` (`id, created_at, user_id, error_type, message,
    stack, url, user_agent, context JSONB`). RLS insert PUBLIC (anche anon,
    perché spesso è il flow signup che rompe pre-sessione), select solo
    `service_role`.
  - Nuovo `src/lib/errorReporting.js`: `reportError(error, context)`
    fire-and-forget. Dedup per hash FNV-1a entro 5min (evita spam loop
    render). Try/catch a ogni livello: un crash nel report di un crash
    non deve mai essere fatale.
  - ErrorBoundary chiama `reportError` sempre (anche per `chunk_load`
    per sapere quanti stiamo avendo). Copy fallback: "L'errore è stato
    registrato e lo guardiamo" (vero: sta in `error_logs`).

- **GG.3** — Zero stack tecnico esposto all'utente.
  Rimossi `{error.toString()}` + `{error.stack}` dalla fallback UI.
  Nuovo copy umano: "Qualcosa non ha funzionato. Non siamo riusciti a
  caricare questa schermata. L'errore è stato registrato e lo guardiamo.
  Riprova, o torna alla home." Stack va in `console.error` + `error_logs`
  Supabase. Mai in faccia all'utente.

**Nuova regola anti-fake bloccante** (24° totale post-EE, ora 25° in Gate II):
`no-reassuring-lie-without-action` (grep-based). Blocca in CI qualunque file
JSX/JS che contenga frasi tipo "team notificato / email inviata / abbiamo
salvato / salvato con successo" SENZA una call verificabile (`reportError(`,
`sendEmail(`, `mailto:`, `supabase.from(...).insert/upsert/update`,
`error_logs`). Zero allowlist.

**Deploy necessario post-Gate GG**: apply migration
`20260716_gate_gg_error_logs.sql` su Supabase (via `apply_migration` MCP o
SQL Editor con SQL puro). Senza tabella, `reportError` fallisce silenzioso
(fire-and-forget → log console warn) e i crash non finiscono da nessuna
parte. Verifica: apri Supabase Table Editor → `error_logs` → dopo un test
di crash deve avere righe con `error_type='chunk_load'` o `generic`.

### Gate II (16-17/07) — Narratore unificato su TUTTI i tour Home

Finding Ivano su Troina: 3 tour Home, 3 comportamenti diversi.
- "I vicoli segreti" (insider): description + insiderTip + bestTime per
  ogni tappa. GIUSTO.
- "Vista mare" (romance): luoghi veri ma solo "Luogo di interesse a X"
  come description. SBAGLIATO.
- "Verde relax" (nature): badge "Tour di esempio" (isMockTour scattato
  su tour reale). SBAGLIATO doppiamente.

Diagnosi read-only (Gate II diagnosi #229): UN bug, 3 sintomi. Il narratore
`buildSelectorSystemPrompt` girava **solo sul tour insider** (chiamato in
un solo posto: `aiRecommendationService.js:985` dentro `generateItinerary`).
I 4 tour tematici (`buildSmartExperiencesAsync`) passavano da
`placesDiscoveryService.discoverAllThemes` → `buildPOIFromCandidate` che
scriveva `description: ''` con commento "sarà scritta dall'AI in Fase 2".
La Fase 2 non è mai stata implementata per il path tematico. Il fallback
`|| \`Luogo di interesse a ${cityName}\`` in DashboardUser:138 completava
il fake. isMockTour scattava perché `applyRadiusFilter` a volte svuotava
gli steps di un tema → `hasRealSteps=false` → guard implicito attivo su
id "smart-N-timestamp" non-UUID.

Decisione Ivano (strada A): 1 sola call OpenAI per tutti e 5 i tour Home.
Costo invariato (era 1 call, resta 1 call). Vincoli: non degradare l'insider
+ regole voce identiche + descrizione vera per ogni tappa altrimenti tappa
esclusa + tour senza tappe esclusi + resta dentro cache DD dove possibile.

**Commit `00bb209`** — 5 file, +471 / -270:

- **`aiRecommendationService.js`** (+306):
  - Nuovo `buildUnifiedHomeToursPrompt`: prompt che accetta candidati
    raggruppati per tema (`insider + food + cultura + romance + nature`).
    Regole voce identiche a `buildSelectorSystemPrompt` locked (fatti
    sensoriali, blacklist aggettivi vuoti, insiderTip pratico, bestTime
    "perché ORA"). Response format JSON: `{tours: [{themeType, title,
    mapMood, suggestedTransit, stops: [{place_id, description, insiderTip,
    bestTime, transition, suggestedMinutes, type}]}]}`.
  - Nuovo `generateHomeTours({city, cityCenter, themedCandidates, prefs,
    aiProfile, weather})`. 1 call gpt-4o-mini, timeout 45s (era 35s per
    insider da solo), max_tokens 4000 (era 2000).
  - Post-processing per ogni tour: `canonicalizeStopsFromCandidates`
    (title/lat/lng/photo/rating dal candidato Google), dedup cross-tour
    su place_id (primo tour che lo usa lo tiene), filtro stops con
    description vuota (regola II.2), applyRadiusFilter safety,
    sortByProximity. Tour con 0 stops post-filtro scartati.
  - Cache: `insiderCacheKey` esistente, key include fingerprint pool
    (city + cityCenter + hash FNV-1a dei sorted place_ids). Cambia il
    pool → cache invalidata automaticamente.
  - Nuovo helper `hashStr` FNV-1a 32-bit per cache key deterministica
    su pool grandi.

- **`DashboardUser.jsx`** (-150 dead code, +100 nuovo flusso):
  - `buildSmartExperiencesAsync` RIMOSSO completamente (dead code
    post-fix).
  - `THEME_CONFIGS` + `getPoiTypeImage` RIMOSSI (titoli statici ora
    generati dal narratore, image fallback coperto da tourShape).
  - queryFn 'home-experiences' nuovo flusso: `discoverAllThemes` →
    pool per tema (parallelo, cache DD) → pool insider (unione top-15
    by qualityScore) → 1 call `generateHomeTours` → mapping output.
    Insider sempre in cima (badge "✨ Insider AI"), riordinamento DNA
    preferences esclude insider (resta primo per costruzione).

- **`TourDetails.jsx`** (II.3):
  - `isMockTour` ora dipende SOLO dal flag esplicito
    `tour.isDemoTour === true`. Prima era regola implicita
    `!isAiSelfGuided && !isValidGuideId(...) && (id numerico O non-UUID)`
    che scattava sui tour REALI quando `applyRadiusFilter` svuotava gli
    steps. "Verde relax" a Troina finiva così.
  - Zero call site oggi setta `isDemoTour` → nessun tour Home mostra
    più il badge. Se in futuro serve un demo intenzionale, va marcato
    esplicitamente.

- **`placesDiscoveryService.js`** (II.2):
  - `discoverPOIs` fallback path (template inventati con `Math.random`
    coords + rating 4.5 + description placeholder) ora ritorna `[]`.
    Se non ci sono POI reali Google, non c'è tour. Regola locked #1
    applicata: nessun fallback produce mai contenuto.

- **`anti-fake.test.js`**:
  - Regola `no-luogo-di-interesse-placeholder` **RIATTIVATA** (era
    skip da Gate M). Allowlist: `MapPage.jsx` + `POIDetailDrawer.jsx`
    (letterali di GUARD `description !== "Punto..."` — anti-fake, non
    fake). 25° regola bloccante totale (era 24° post-GG).

**Verifica device** ✅ (Ivano su Troina, 17/07): tutti i tour narrano,
"Vista mare" ha description + orario per tappa come "I vicoli segreti",
"Verde relax" non è più "Tour di esempio", l'insider è rimasto identico.

---

## Regole locked NUOVE (16-17/07)

Aggiornate le 13 esistenti (blocco 1 + 6 nuove 14-16/07). Dopo Gate GG + II
salgono a **17 totali**:

14. **Nessun messaggio all'utente può affermare un'azione di sistema che
    non avviene** (Gate GG, 16/07). "Team notificato", "email inviata",
    "salvato con successo" richiedono il codice che esegue davvero
    l'azione (`reportError`, `sendEmail`, `supabase.from(...).insert`).
    Regola grep-based `no-reassuring-lie-without-action` in CI. Bugia
    rassicurante = stessa classe di "Marco R." e Giulia — peggio, promette
    un processo inesistente.

15. **Zero stack tecnico esposto all'utente** (Gate GG, 16/07). Un
    messaggio tecnico grezzo ("'...ml' is not a valid JavaScript MIME
    type") non deve mai comparire in UI. Va nei log (console +
    `error_logs` Supabase) + copy umano in interfaccia. Stessa regola
    del GPS in inglese di Gate W: tecnico nei log, umano in faccia.

16. **Ogni tappa di ogni tour Home ha nome vero + descrizione unica del
    luogo + quando visitarlo** (Gate II, 17/07). Stessa pipeline
    (narratore) per TUTTI i tour, nessuno escluso. Se il narratore non
    produce descrizione vera → la tappa non entra (regola sub-locked:
    meno tappe > tappe vuote). Tour con 0 tappe post-filtro → escluso.
    Mai placeholder generico. Grep-based
    `no-luogo-di-interesse-placeholder` in CI.

17. **`isMockTour` dipende SOLO da flag esplicito, non da euristiche
    su campi vuoti** (Gate II.3, 17/07). Un tour reale con un campo vuoto
    NON è un tour di esempio. Se serve marcare un tour come demo, si
    aggiunge `isDemoTour: true` esplicitamente. Guard impliciti su
    "steps vuoti" o "id non-UUID" hanno scattato su tour reali (Verde
    relax) — regola sepolta = bug latente.

---

## Stato costi al 17/07 (post Gate II)

Invariato vs 16/07 sul lato Places (Gate DD attivo). Sul lato OpenAI:

- **Home tour narrati**: 1 call `generateHomeTours` gpt-4o-mini per utente
  al primo mount (cache client + insider cache condivisa city+pool). Era
  1 call `generateItinerary` insider (invariato). Il narratore ora produce
  N tour invece di 1 → output ~2-3× più grande in tokens output, delta
  ~$0.0002-0.0004 per call su gpt-4o-mini (trascurabile).
- **Notifiche**: 1 call `generateWeatherSocialTip` + 3 place/details Basic
  (gratis) al trigger notifica. Invariato.
- **Precompute tour da notifica**: `generateSystemPrewarmTour` è
  deterministico (no LLM), solo place/details Basic. Invariato.

**Tabella pre/post gate aggiornata**:

| Fase             | textsearch/utente | note                                        |
|------------------|-------------------|---------------------------------------------|
| Pre Gate O       | 10 chiamate       | 5 temi × 2 refetch GPS. ~$17/utente/mese.   |
| Gate O.1         | 5 chiamate        | Kill refetch GPS.                           |
| Gate BB          | 5 primo giorno, 0 dal secondo per-browser | Cache localStorage per-browser. |
| Gate DD (attuale)| 5 primo utente sulla città, 0 tutti gli altri per 24h | -85% atteso al lancio. |
| Post Gate II     | Invariato (Places) + 1 call OpenAI narratore per Home (era 1 call insider) | Zero delta costi. |

---

## Ottimizzazione (C) PIANIFICATA per U.2

Cache condivisa server-side sul narratore, stesso pattern Gate DD ma su
OpenAI invece che Places:

- Nuova tabella Supabase `narrator_cache` con `cache_key TEXT PRIMARY KEY,
  data JSONB, created_at TIMESTAMPTZ`.
- Cache key deterministica: `city + theme_pool_hash(sorted place_ids)`.
- TTL 24h. Prima persona su Troina paga la call `generateHomeTours` (1
  call), dalle successive per 24h → 0 call OpenAI, cache HIT dal server.
- Overhead: edge function proxy per il narratore (o direct write da
  client con service_role via edge function). ~40 righe di codice + 1
  migration.
- Effetto atteso al lancio: la Home narrata diventa gratis dalla seconda
  persona sulla stessa città. Combinato con Gate DD (cache Places): la
  prima persona su una città paga tutto (~$0.16 Places + ~$0.001 narratore),
  tutte le successive per 24h leggono da cache condivisa a costo zero.

**Da fare con U.2** (rate limit server-side + ottimizzazione costi bloc).
NON mescolare con altri lavori prima del lancio: prima il narratore
funziona (Gate II fatto), poi (C) lo rende gratis dalla seconda persona.

---

## Backlog aperto al 17/07 (aggiornato, in ordine di priorità)

### Priorità 1 — Contenuto vero end-to-end

- **Profilo dati finti** (task pending, era Blocco 2.2): tab Profile mostra
  regioni fake ("Toscana 8 tour" Unsplash). Cleanup + collegamento a
  `explorers.tours_completed`, `explorers.km_walked`, `user_photos` reali.
- **Gate CC.3** (task #221, pending): Esplora completo — mostra tour AI
  + segnaposto "Presto guide locali" onesto. Kill "Guida DoveVai" default
  (ogni tour AI attribuito a una guida fittizia "DoveVai Concierge").

### Priorità 2 — Ottimizzazione costi + rate limit

- **U.2** (rate limit server-side sui numeri finali post-DD + cache narratore
  strada C): se un IP fa >100 chiamate/min al places-proxy → 429. Nuova
  tabella `narrator_cache` per Gate II (pattern DD su OpenAI). Un solo
  commit, due leve costi insieme.

### Priorità 3 — Verifica finale

- **Verifica notifiche end-to-end 3× di fila su device**: browser nuovo,
  utente diverso, città diversa. Verifica anche `X-Cache: HIT` per DD.
- **Verifica GG in prod**: apri Supabase Table Editor → `error_logs`.
  Dopo 24-48h dal lancio deve avere righe (crash reali). Chunk-load
  reload automatico funzionante = pattern `error_type='chunk_load'`
  presente con dedup.

### Priorità 4 — Bug residui minori

- **Task #159**: durata scheda tour "3h m" — minuti vuoti. Bug UI formatter.
- **Task #163**: `POIDetailDrawer` legge `insiderTip/description/bestTime`
  reali (oggi placeholder generici — dopo Gate II i dati esistono, serve
  solo cablare il render).
- **Task #164**: kill "Luogo di interesse a X" placeholder + commento
  ottimistico ("Un posto che merita una visita" default) — coperto da
  Gate II ma verificare cleanup residuo.
- **Bug MapPage `|| 'Roma'` residuo** di O.2: MapPage ha ancora
  `city || 'Roma'` in un branch non-Home. Non urgente ma va tolto.

### Priorità 5 — Cleanup interni

- **Cleanup FETCH_ALLOWLIST Blocco 2**: `userContextService.js`,
  `weatherService.js`, `poiService.js`, `dataService.js`,
  `aiRecommendationService.js verifyPOIWithPlaces`.
- **Cleanup allowlist regole EE**: `TourDetails.jsx` / `AiItinerary.jsx` /
  `DashboardUser.jsx` / `MVPEnhancements.jsx` — quando il Blocco 2 completa
  il cleanup, rimuovere da allowlist di `no-v2-features-in-copy` e
  `no-fake-price-in-copy`.
- **Riattivare 3 skip anti-fake residue**: `no-in-arrivo-toast`,
  `no-fake-reviewer-names`, `no-unsplash-in-content` dopo cleanup dei file
  residui che li violano.
- **Cron cleanup places_cache + error_logs**: `DELETE WHERE created_at <
  NOW() - INTERVAL '25 hours'` (places) / `'30 days'` (errors).

---

## Blocco SEPARATO — Post-lancio con Antigravity

Estetica FINE, non fixabile in 15 giorni senza compromettere altro:

- **Navigazione TourLive/MapPage**: NavigationHUD (DVAI-062-065) funziona
  ma non stampa telemetria d'uso. Serve capire dove gli utenti abbandonano
  la nav per iterare.
- **Transizioni pagine**: Framer Motion enter/exit oggi minimali. Da
  polishare con Antigravity per un feel premium.
- **Design system condiviso Landing ↔ Onboarding**: strada 3 della
  diagnosi FF.2. Tokenizzare font/palette/radius/spacing in
  `tailwind.config.js` come design tokens. 1 giornata di lavoro,
  vale tutto il prodotto in V1.1.
- **Estetica card Home**: layout uniforme per tutti i tour narrati
  (post Gate II tutti hanno description+bestTime, serve solo un
  visual pass per mostrarli bene).

Sessione dedicata ad Antigravity dopo il lancio.

---

## BLOCCO 3 — INTELLIGENZA ⏳ DA APRIRE

- **Box wizard adattive alla città**. Gate C Task 2 progettato ma non implementato.
  Idea: 1 textsearch generica per città (`"attrazioni ${city}"`) → cluster POI
  types Google → top-4 categorie diventano le box del wizard (non hardcoded
  Roma/Milano/Napoli/default). Cache 7 giorni. Prefetch al cambio città in
  TopBar per attesa 0.
- **DNA che impara**. Preference graph (`useAILearning.preferenceGraph`) esiste
  ma non alimenta né la Home ("Per Te" ordina per rating), né il traduttore
  Gate B, né le notifiche. Cablare dove serve (senza inquinare i posti che devono
  essere sempre veri).
- **Navigazione**. TourLive/MapPage con NavigationHUD (DVAI-062-065) funziona
  ma non stampa telemetria d'uso. Serve: capire dove gli utenti abbandonano
  la nav per iterare.

---

## REGOLE LOCKED (voce brand + processo)

1. **Nessun fallback produce mai contenuto**. Se il motore fallisce → errore
   onesto ("A Catania non troviamo spiagge. Cambia richiesta.") o schermata
   vuota. Zero tour finti mai. Zero "Ops".

2. **Il CI è l'unica verità**. "Verde in locale" non è verde. Dopo ogni push,
   verifica GitHub Actions e riporta lo stato. Se rosso, si ferma tutto e si
   sistema prima di aprire il gate successivo. Il gate Vercel `vercel-ignored-build-step.sh`
   blocca il deploy su qualsiasi workflow_run non-success.

3. **Niente è "done" finché Ivano non verifica su iPhone**. Il codice non testato
   in prod non esiste. Suite + E2E + CI verdi sono prerequisiti, non conferma.

4. **Un gate alla volta**. Ogni gate = un problema chiuso end-to-end (fix +
   commit + push + CI verde + Vercel deploy verde + verdict device). Poi si
   apre il gate successivo. Non aggrupparne di categorie diverse in un solo
   commit.

5. **Uccidere un mock senza proteggere il render è togliere una gamba al tavolo**.
   Impararlo da Gate D-1 → Bug 1 Gate E (TourDetails.tour null crash). Ogni
   kill di un fallback = verifica che il codice che lo consumava gestisca
   l'assenza (early return, empty state, guard).

6. **La notifica dice un FATTO, non un aggettivo**. Vale ovunque nel prodotto
   (notifiche, narratore, descrizioni POI, tooltip). Title = dato di contesto
   nudo ("Sono le 18:12 🌇"). Message = motivo verificabile ("Palazzo Biscari
   è a 6 minuti da te e non chiude fino alle 19"). Blacklist: "sorseggia",
   "gusta", "spettacolare", "unico", "atmosfera intima", storia inventata
   del POI. Se non hai un motivo forte con dati verificabili → non generare
   quella stringa. Vedi `~/.claude/projects/-Users-mac2023ivanosciretta/memory/feedback_dovevai_voce.md`.

---

## Setup che serve per lavorare

- Env vars locali: `.env` con `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MAPBOX_TOKEN`.
- Vercel env vars: sopra + `VITE_PLACES_PROXY_ENABLED=true` (acceso ora) + `GH_TOKEN`
  (PAT fine-grained, Actions:Read su unnivai — usato dal build-step gate).
- Ogni push su main triggera CI (Lint & Test → E2E Smoke con `needs:test`) →
  Vercel Ignored Build Step polla GH → se verde builda, se rosso skippa.

## Come simulare CI in locale

```
mv .env .env.tmp && (npm run test:run; mv .env.tmp .env)
```

Verifica che tutti i test passino anche senza `.env` (come in CI). Vedi
`src/test/setup.js` per gli stub env di default.
