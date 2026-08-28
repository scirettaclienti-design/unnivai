# DoveVAI — Handoff V1 → prossime sessioni

Punto di partenza per chi (o quale sessione di Claude) riprende il progetto.
Aggiornare in coda dopo ogni iterazione importante.

**Ultimo aggiornamento**: 2026-07-17 dopo Gate KK — diagnosi read-only su
finding prod (screenshot ErrorBoundary vecchio con stack + "team notificato").
Codice GG su main confermato corretto; crash causato da CACHE CLIENT STALE
(browser Ivano eseguiva ancora bundle pre-GG con `index.html` vecchio che
referenziava chunk hashati di un build precedente). Auto-risolto al refresh
cache browser. **Verificato device Ivano 17/07**: app entra pulita, nessun
crash attivo in prod. Backlog aggiornato con fix strutturale
`vercel.json` cache policy (P2, pre-lancio) e advisory sicurezza RLS
(4 tabelle senza RLS in prod). Precedenti sessione: Gate II (16-17/07,
commit `00bb209`) narratore unificato N tour Home in 1 call; Gate GG (16/07)
ErrorBoundary chunk-reload + error_logs; Gate FF.1 (16/07) responsive slide.
Vercel verde. CC.3 Esplora rimane pendente.

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

### Gate KK (17/07) — Crash prod ErrorBoundary: NON è bug di codice

Screenshot Ivano (deploy 17/07): schermata "Qualcosa è andato storto" + "Il
team tecnico è stato notificato" + stack grezzo `TypeError: 'text/html' is not
a valid JavaScript MIME type` + nessun reload automatico. Sembrava regressione
Gate GG.

Diagnosi read-only:

- **Codice GG su main è CORRETTO e verificato.** Render ErrorBoundary attuale
  NON contiene "team tecnico notificato" (ora "l'errore è stato registrato e
  lo guardiamo"). Nessuno stack esposto. `classifyError` matcha
  `is not a valid javascript mime type`. Chunk-load → spinner + `location.reload()`
  automatico con flag `dvai_chunk_reload_attempted` anti-loop.
- **Tabella `error_logs` esiste in prod** (applicata manualmente via SQL Editor,
  fuori dal migration tracker — `list_migrations` mostra solo `dvai_050_ai_quota_daily`
  registrato). Zero righe nella tabella (nessun crash è mai stato riportato).
- **`curl -sI` su `unnivai.vercel.app/`**: `index.html` servito fresco
  (`age: 0`, `x-vercel-cache: MISS`, `cache-control: public, max-age=0,
  must-revalidate`, `x-vercel-id: fra1::h4lcp-...`). Il server serve la
  versione corretta.

**CAUSA REALE**: cache client stale. Il vecchio `index.html` cachato da Safari
referenziava chunk hashati di un build precedente; post-deploy quei chunk non
esistono più → Vercel risponde `text/html` (SPA fallback) → il boundary
PRE-GG (nel bundle vecchio ancora in esecuzione nel browser) mostra lo stack.
**GG non può intercettare perché GG non è nel bundle che sta girando.**

**Auto-risolto al refresh cache browser.** **Verificato device Ivano 17/07**:
app entra pulita, richiede di nuovo la localizzazione (= ripartenza da zero,
cache svuotata). Nessun crash attivo in prod.

**Perimetro onesto**: il browser di Ivano è a posto, il problema STRUTTURALE
no. Ogni utente con cache vecchia, al prossimo deploy, può rivivere lo stesso
lampo prima che GG (auto-reload) sia caricato. La rete di sicurezza GG
scatta solo se il bundle GG è già attivo — cane che si morde la coda al primo
deploy.

**Advisory sicurezza emerso in diagnosi KK** (da verificare, NON toccato):
4 tabelle con RLS disabilitato in prod — `public.profiles`, `public.bookings`,
`public.guides`, `public.spatial_ref_sys`. Con anon key si legge/scrive
tutto. Da valutare prima del lancio (`profiles` e `guides` sono sensibili).
Aprire gate dedicato security RLS in P2.

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

### Priorità 2 — Ottimizzazione costi + rate limit + cache policy + sicurezza

- **U.2** (rate limit server-side sui numeri finali post-DD + cache narratore
  strada C): se un IP fa >100 chiamate/min al places-proxy → 429. Nuova
  tabella `narrator_cache` per Gate II (pattern DD su OpenAI). Un solo
  commit, due leve costi insieme.
- **`vercel.json` cache policy** (Gate KK backlog, pre-lancio):
  fix strutturale stale-chunk alla radice. Headers da aggiungere:
  - `index.html` → `Cache-Control: no-cache` (rivalida sempre).
  - `/assets/*` (chunk hashati Vite) → `Cache-Control: public,
    max-age=31536000, immutable` (mai stale: l'hash cambia a ogni build).
  Vite già hash-a i filename → immutable è sicuro. Elimina lo stale chunk
  per tutti gli utenti futuri. Da fare con U.2 (un commit). NON urgente:
  nessun crash attivo oggi (l'ultimo Ivano è auto-risolto), ma serve prima
  del lancio per evitare che ogni deploy generi un lampo di errore agli
  utenti con cache vecchia.
- **Gate security RLS** (advisory Gate KK): 4 tabelle in prod con RLS OFF —
  `public.profiles`, `public.bookings`, `public.guides`, `public.spatial_ref_sys`.
  Con anon key si legge/scrive tutto. Valutare policy prima del lancio.
  `profiles` e `guides` sono sensibili (email, PIVA, license_number).
  `spatial_ref_sys` è read-only PostGIS built-in (probabilmente OK escluderla).
  `bookings` V1 non ha usi attivi (V2). Un gate dedicato, non un one-liner.

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

## Gate NAVIGAZIONE — stato al 19/07 (funzionale-base CHIUSO, Livello 2 da aprire)

Correzione di premessa (importante): l'handoff diceva "NavigationHUD funziona".
Era una mezza verità — funzionava il CONTORNO (mappa, polyline, ETA, pallino GPS),
NON l'avanzamento a tappe. La diagnosi ha rivelato che lo sblocco tappa non era mai
stato raggiungibile (bottone gated su level===2 che le tappe non ricevono mai) e
che il turn-by-turn era congelato su steps[0] di leg 0. Ora l'avanzamento a tappe
FUNZIONA e la voce brand è rispettata.

### Fasi chiuse e VERIFICATE su device (Ivano, Troina, a piedi + auto)

- **Fase 1**: propagazione insiderTip/bestTime in activeRoute + telemetria
  nav_events (tabella Supabase pattern Gate GG: nav_start, step_reached,
  nav_complete, nav_abandon; RLS insert public/select service_role; applicata a
  mano via SQL Editor).
- **Fase 2a**: trigger manuale onesto "Sono arrivato" (non "Sblocca Contenuto"):
  durante la nav, su una tappa non completata → handlePOIUnlock. Contratto sanato
  con prop isNavigating/isCompleted/isTourStep (non più poi.level). Verificato:
  contatore avanza, step_reached si scrive, idempotenza N3 regge.
- **Fase 2b-1**: geofence auto-unlock. Legge accuracy, haversine client-side alla
  prossima tappa, soglia adattiva max(GEOFENCE_BASE_M, accuracy). R2 chiuso:
  enableHighAccuracy confinato alla sola nav attiva (clearWatch a fine nav), MOUNT
  tornato a options soft di Gate X (no regressione iOS 45s). Ref anti-stale-closure.
- **Fase 2b-2**: irreversibilità (navCompletedRef latch — no bounce su fluttuazione
  GPS), distanza live in HUD (cala mentre cammini), TTS una volta per tappa
  (spokenIdentitiesRef), camera panTo (no scatti; rotazione heading-up rimossa →
  debito Antigravity), marker completato con ✓.
- **Fase 2b-3**: summary reale (N5) — kill fallback '2.4 km'/'1h 20m', handleShare
  de-Roma-izzato (usa città reale, mai hardcoded). Istruzione HUD onesta:
  "→ Prossima tappa: {nome}" invece del turn-by-turn congelato. Voce allineata.
- **Fase 2c-1**: geofence TARGET-CORRETTO + ANTI-CASCATA. Il geofence inseguiva "la
  prima tappa non completata in ordine d'array" → due bug: (i) "Naviga" su tappa
  saltata non scattava; (ii) CASCATA (tappe vicine nel centro storico si
  sbloccavano tutte da fermo). Fix: navTargetStepIdRef (segue il target di "Naviga")
  + arm-then-fire (una tappa scatta solo se vista fuori→dentro il raggio; eccezione
  isFirstOfSession per la prima). Verificato device: tappe si sbloccano UNA alla
  volta muovendosi, nessuna cascata da fermo, "Naviga" scatta sulla tappa giusta.
- **Fase 2c-2**: summary onesto — tempo REALE (navStartTimeRef = Date.now() all'avvio,
  delta congelato all'apertura summary, non più ETA Directions) + titolo condizionale
  ("Tour Completato!" solo se completedSteps.length >= totalSteps, altrimenti
  "{N} di {M} tappe"). Distanza e conteggio già reali da 2b-3. handleShare coerente.

### Pendente (richiede calibrazione a piedi)

- **Fase 2c-3**: abbassare GEOFENCE_BASE_M 25→~15 (scatto osservato a 20-30m, si
  vuole più vicino — da fissare col distanzaM reale letto in [DVAI-Geofence]) +
  kill fallback distanza HUD "8m" (|| step0?.distance?.text quando live è null).
  Opzionale: chiudere il micro-race post-"Sono arrivato" (flag sincrono
  primoDellaSessione — da confermare se si manifesta sul campo).
- **Verifica finale device**: conferma 2c-2 (tempo+titolo) + 2c-3 (soglia) in un
  giro a piedi.

### Verità note ancora aperte (registrate, non regressioni)
- La "distanza" summary è la lunghezza del percorso Directions pianificato, non
  odometria GPS reale (se giri a vuoto non conta i metri). È coerente, non fake, ma
  non è la distanza-camminata. Perimetro onesto.

---

## NUOVO GATE — "NAVIGAZIONE LIVELLO 2" (da aprire, il salto funzionale)

Decisione Ivano (19/07): la navigazione è un CUORE PULSANTE dell'app e allo stato
attuale (Livello 1: cursore che si muove + "prossima tappa: X" + distanza che cala)
è troppo scarna. Va portata al "Livello 2" — WOW funzionale senza inseguire Google.

**Tre livelli (chiarimento che corregge la vecchia dicotomia asticella):**
- L1 (attuale): cursore + prossima tappa + distanza. Troppo povero per il cuore app.
- L2 (DA COSTRUIRE, raggiungibile): indicazioni stradali essenziali che AVANZANO col
  GPS ("dritto 200m → destra su Via X → tappa a 50m", dai maneuver di Directions,
  fatti BENE — non congelati come prima) + percorso che si COLORA dietro mentre
  cammini (fatto vs da fare) + ricalcolo BASE se esci dal percorso (ridisegna la
  rotta dalla posizione attuale, non rerouting sofisticato) + rotazione heading-up.
- L3 (Google Maps pieno, IRRAGGIUNGIBILE, fuori scope per sempre): turn-by-turn
  maneuver-by-maneuver completo con traffico, rerouting dinamico avanzato.

**Nota chiave:** i dati per L2 CI SONO GIÀ — Google Directions restituisce i maneuver
di ogni step con distanze. Il turn-by-turn "congelato" che abbiamo disattivato era
proprio questo, solo rotto (leggeva steps[0] e non avanzava). Non va costruito da
zero: va fatto avanzare col GPS.

**Da fare all'apertura del gate (NON ora):** asticella dedicata + diagnosi completa
(mappare i maneuver di Directions, come avanzarli col GPS, il ricalcolo base, il
percorso colorato). CANDIDATO per Claude Fable 5 sul terminale (analisi
architetturale ampia); implementazione a fasi con Opus.

**Perimetro onesto del gate (da confermare in asticella):** L2 sì, L3 no. Dà
"quello che serve, non tutto Google".

---

## Backlog aggiornato al 19/07 (ordine)

1. **2c-3** (soglia geofence + fallback HUD) — prossimo giro a piedi.
2. **Profilo fake** (gate di verità, codice puro, verificabile da casa): tab Profile
   mostra dati finti (regioni Unsplash "Toscana 8 tour"). Cleanup + collegamento a
   explorers.tours_completed/km_walked/user_photos reali. NOTA: profiles ha anche
   RLS DISABILITATO in prod (Gate KK) — valutare se chiudere insieme (sensibile).
3. **Gate Navigazione Livello 2** (sopra) — il salto funzionale del cuore app.
4. **Blocco Antigravity** — estetica netta di TUTTO (mappa, HUD, onboarding,
   transizioni, rotazione heading-up) DOPO che L2 è chiuso funzionalmente.
5. **Esplora CC.3, U.2** (rate limit + cache narratore) — come da backlog precedente.

**Fuori scope registrati:**
- Navigazione AUTO pura (l'app è per tour a piedi; l'uso in auto è limitato per
  design, non è un bug).
- Curiosità audio narratore inventate/generiche (es. "gli artisti di strada devono
  avere permesso comunale", "le trattorie coi menù a mano sono le migliori") →
  backlog NARRATORE (stesso filone poesia-del-caffè, nomi POI grezzi da Google tipo
  "Bar Pour Toi di Cantagallo Basilio"). Bug di verità del narratore, gate a sé.

**Nota operativa modelli:** Claude Fable 5 sul terminale per diagnosi/analisi
architetturali ampie (es. apertura Nav Livello 2). Opus per esecuzione a fasi
(diff, un fix alla volta). Cambio modello segnalato di volta in volta per
ottimizzare i token di Ivano.

---

## Gate PROFILO L1 — verità nel tab (22/07) ✅ VERIFICATO DEVICE

Diagnosi: il Profilo non aveva "dati fake da sostituire" — era più rotto.
`Profile.jsx` leggeva `explorers.tours_completed`, colonna che NON ESISTE → query
fallita → contatori a 0 per sempre. `explorers` e `user_photos` vuote (0 righe) e
NESSUN codice le alimenta. `nav_complete` non è collegato al profilo.

**Commit `ba2cb9e`** — estetica INVARIATA (vincolo Ivano), solo contenuto:
- Query rotta rimossa (non legge più colonne inesistenti).
- Contatori: "—" + empty state evocativo (niente numeri finti).
- "Esplora Zone" (Toscana 8/Sicilia 5/Venezia 3/Roma 6 + Unsplash): fake ucciso,
  box mantenuto con testo evocativo.
- "I Miei Risultati" (Esploratore Veterano 10+ tour / Guida Esperta 4.8/5 Top 10%):
  badge inventati uccisi, empty state onesto.
- Storico: kill `rating||5`, `"2 ore"`, `"Guide Expert"`, highlights inventati.
- `shareTour`: kill "fantastico" (aggettivo) + rating tour-level seed (regola O.4)
  che l'utente CONDIVIDEVA pubblicamente. Ora solo il fatto.
- Dati VERI non toccati: "Richieste Attive" (guide_requests reali, chat davvero
  create), card DNA (poi corretta nel gate DNA).

Formulazioni evocative (approvate Ivano): regola locked — **evocativo su un FATTO
VERO (l'assenza), mai un dato inventato per riempire**.

## Gate DNA ONESTO (22/07) ✅ VERIFICATO DEVICE

Domanda Ivano: "il DNA funziona davvero?". Diagnosi su DB: **numeri veri,
significato falso**. Il grafo conteneva `cat:guide=193`, `cat:"Scelto per te"=79`,
`cat:"Consigliato dall'AI"=65` — NON gusti: nomi di sezioni UI + il type di una
feature SPENTA in V1. Il gusto vero (food=6, cultura=5) era sepolto fuori dal top-4.
Doppio fraintendimento: card diceva "4059 interazioni analizzate" ma le % erano su
348 (somma top-4). Il grafo conteneva anche `city:Catania=3624` (rumore da loop di
test, classe Gate Y).

**Fase 1 `fec8e6f`** — pulizia segnale: rimosso il fallback di `getAIContext` che
iniettava "Categorie preferite: guide, Scelto per te…" nei prompt AI.
CORREZIONE ONESTA: la portata era **sovrastimata** in diagnosi. `getTourAffinity`
usava già weights filtrati → il ranking Home NON era distorto. Il fix è difensivo:
chiude il buco per account a segnale-zero (tutti, al lancio).

**Fase 2 `eb9e247`** — tassonomia + card + reset:
- `trackInteraction` normalizza su `CORE_CATEGORIES`/`normalizeCategory` di
  `preferenceEngine.js` (fonte unica, NON duplicata). Se non normalizza → NON
  scrive la chiave (regola #1).
- Card: filtra a CORE, soglia `DNA_MIN_CATEGORIZED = 12` (sotto: "Il tuo DNA si sta
  formando…"; sopra: % vere). Numero e % ora sulla STESSA base (`validTotal`).
- localStorage bump `unnivai_ai_learning_brain` → `_v2`: senza, il brain locale
  sporco avrebbe sovrascritto il DB resettato al primo merge.
- **Reset DB eseguito da Ivano** (tutti gli utenti): `preference_data='{}'`,
  `interactions='[]'`, `total_interactions=0`.

**CORREZIONE HANDOFF — Blocco 3 obsoleto**: diceva "il preference graph esiste ma
non alimenta né la Home, né il traduttore, né le notifiche". FALSO: alimenta
DashboardUser (ranking Home + aiProfile), AiItinerary:195, QuickPath:624,
SurpriseTour. Solo che lo faceva con dati inquinati.

**Perimetro onesto**: il DNA ora si popola SOLO da interazioni con categoria di
gusto CORE valida. I tour "Per Te" con type = nome-tema NON contribuiscono (una
sezione non è un gusto) → il DNA resta "in formazione" più a lungo. È corretto
(lento-e-vero > veloce-e-falso). Fase 3 opzionale: mappare temi → CORE alla
generazione.

## LEZIONI OPERATIVE (22/07) — da applicare sempre

**1. CI verde ≠ deployato.** Il Gate Profilo era committato, CI verde, e NON in
produzione per 13 ore. Catena: E2E cancelled per flakiness infra (mirror apt
Playwright) → gate `vercel-ignored-build-step.sh` fail-CLOSED → skip build →
**il re-run della CI NON ri-triggera Vercel** (deploya sugli eventi di push, non
sui cambi di stato CI). Servono nuovo push o redeploy manuale.
→ **La regola #2 va estesa**: la verità è *CI verde + deploy Vercel effettivo +
verifica device*. Verificare SEMPRE il deploy (interrogando il bundle prod per una
stringa-marker) prima di dire "fatto".

**2. Verificare il contenuto del bundle, non solo l'hash.** Metodo collaudato:
`curl` sull'entry, trovare il chunk, cercare la stringa nuova E l'assenza della
vecchia. Ha smascherato sia il Profilo non deployato sia confermato DNA F1/F2.

**3. Backlog `vercel.json` cache policy** (da Gate KK): `index.html` no-cache +
`/assets/*` immutable. Ancora aperto.

## Backlog aggiornato al 22/07

1. **2c-3** (soglia geofence ~15m + kill fallback distanza "8m") — serve camminata.
2. **Nav Livello 2** — indicazioni stradali che avanzano col GPS, percorso che si
   colora, ricalcolo base. Asticella dedicata + diagnosi (candidato Fable 5).
3. **Ponte nav→profilo** (Profilo L2): colonna `tours_completed`, writer su
   `nav_complete`, riga `explorers` all'onboarding + decisione Home vs Profilo per
   i tour completati.
4. **Allowlist cleanup** ✅ FATTO (22/07): Profile.jsx rimosso dall'allowlist di
   `no-rating-or-reviews-at-tour-level` (0 occorrenze → ora coperto). Correzione:
   Profile.jsx NON era nell'allowlist di `no-unsplash-in-content` (solo nel commento
   skip, ora ripulito). Due findings emersi durante il cleanup (vedi sotto).
5. **Esplora CC.3, U.2** (rate limit + cache narratore), `vercel.json`, RLS profiles.
6. **Blocco Antigravity** — estetica di TUTTO, dopo che il funzionale è chiuso.
   Include: card "DNA in formazione" con trattamento visivo dedicato.

### Findings emersi dal cleanup allowlist (22/07)

- **8 violatori residui di `no-unsplash-in-content`** (perciò la regola resta `skip`):
  `src/components/GroupInviteModal.jsx`, `src/components/Map/QuickPathSummary.jsx`,
  `src/pages/DashboardGuide.jsx`, `src/pages/DashboardUser.jsx`, `src/pages/Landing.jsx`,
  `src/pages/MapPage.jsx`, `src/services/dataService.js`, `src/services/tourShape.js`.
  Ripulirli tutti (foto da Google Places, non Unsplash) → poi si riattiva la regola
  come bloccante.
- **⚠️ FINDING DI VERITÀ (vetrina prodotto, guardare PRE-LANCIO)**: `Landing.jsx`
  contiene ancora `images.unsplash.com`, MA il commento Gate EE in
  `anti-fake.test.js` dichiara "la landing non ha più foto stock" (l'aveva rimossa
  dall'allowlist su quella premessa). O il cleanup EE era incompleto, o un unsplash
  è rientrato. La landing è la PRIMA schermata del prodotto: una foto stock lì è un
  fake sulla vetrina. Da verificare e uccidere prima del lancio (gate a sé).

---

## Sessione 23/07 — Nav L2 (L2-0/L2-1) + ponte profilo + debug panel

### Gate NAV L2 — L2-0 (`5474d1a`) e L2-1 (`0704c55`) chiusi e IN PROD

**L2-0**: `extractDirectionsData` (funzione pura, tutti i legs + overview_path,
LatLng normalizzati) + `directionsDataRef` nell'hook. **L2-1**: istruzione maneuver
che avanza col GPS (`pickActiveStep` proiezione + indice monotòno, trasporto clone
di onRouteStats → ref MapPage, latest-wins scope-minimo, fallback onesto a
"Prossima tappa" fuori tolleranza). `MANEUVER_SNAP_TOLERANCE_M=25` da calibrare.

**VERIFICATO su device a Troina (23/07)**: le istruzioni maneuver esistono,
cambiano, l'icona è corretta. **MA con difetti gravi** (finding sotto).

### FINDING camminata Troina 23/07

**BUG (nav)**
- Istruzione arriva **30-40m DOPO** la svolta, non prima.
- **Puntatore GPS a scatti**: prima era fluido → **regressione introdotta da L2-1**.
- Fallback a "Prossima tappa" **a metà percorso** (la proiezione perde l'aggancio).
- Geofence scatta ancora a **20-25m**, da calibrare.

**VERITÀ (fake sopravvissuti / nuovi)**
- **IL SUMMARY MENTE**: mostra 3,2 km quando l'utente ne ha camminati ~1. È la
  distanza del **tour pianificato** (Directions) spacciata per **percorso fatto**.
  Stessa classe dei fake di Blocco 1, sopravvissuta perché "sembra un dato tecnico".
- **Minuti congelati** a "50 min rimasti" mentre i metri calano.
- **"MONUMENTI SCOPERTE"**: genere sbagliato (→ "Monumenti scoperti").

**PRODOTTO (differenza navigatore vs tour)**
- **Ordine tappe rigido**: utente a 30m dalla tappa 3, il tour lo manda alla tappa 1
  a 1km. Per un tour a piedi si deve partire dal **punto più vicino**.
- **Ritmo arrivo/ripartenza**: appena sblocchi una tappa annuncia subito la
  prossima, non lascia il momento. È la differenza tra navigatore e tour.
- **Curiosità narratore generiche**, non legate al luogo. Voce TTS robotica.
- **Qualità POI**: migliorata (niente invenzioni, orari veri) ma ancora distante
  dall'obiettivo. Troina = banco di prova migliore (pochi POI + giudice che conosce
  la verità sul campo).

### Altri gate chiusi in sessione
- **Ponte nav→profilo Fasi 2+3** (`3dcd7c0`): tabella `completed_tours` + trigger
  `SECURITY DEFINER` su `nav_complete`, migration **TRACCIATA** (`20260722114554`).
  Restano **Fase 1** (nav_complete oggi scritto solo su "Fine", non al completamento
  reale → sotto-conta) e **Fase 4** (lettura Profilo: `COUNT(completed_tours)`).
- **Allowlist cleanup** (`db55418`): Profile.jsx fuori da `no-rating-or-reviews-at-tour-level`.
- **Debug panel** (`ac7f2c4`): pannello calibrazione nav, `?debugnav=1`, buffer su
  ref (zero re-render), riga con `dt` (delta tick), `snapDistM` esposto. Spento di
  default. Serve per la camminata di calibrazione.

### Lezione nuova
Marker per verifica deploy bundle prod = **stringa-letterale o object-key, MAI nome
di simbolo** (i simboli vengono rinominati/tree-shakati in minify).

### Backlog 23/07 (ordine: per cosa sblocca cosa)
1. **Camminata col pannello debug** → numeri veri (snap, dt, distReale, soglia).
2. **Gate ritardo+fluidità+geofence** — tutto nel tick, un gate solo (istruzione in
   anticipo, puntatore fluido, calibrazione soglie).
3. **Gate summary onesto** — verità (km reali vs pianificati, minuti, genere),
   verificabile da casa.
4. **Gate ordine tappe** — partire dal punto più vicino.
5. **Gate ritmo arrivo/ripartenza** — design L2 (lascia il momento).
6. **Gate narratore** — curiosità legate al luogo + voce.
7. **L2-2/3/4**, ponte Fasi 1+4, RLS, `vercel.json`, Esplora CC.3.

---

## Aggiornamento 25/07 — Gate SEME + DEBUG-NAV + ROUTING (3 in prod, 0 verificati device)

Sessione di codice puro (nessuna camminata). Tre gate committati, CI verde,
deploy confermato in prod. **Nessuno verificato su iPhone** → per la regola #3
nessuno è chiuso. Più una correzione importante all'handoff stesso.

### ⚠️ CORREZIONE HANDOFF — colonne `profiles` inesistenti

Diagnosi Gate ROUTING ha interrogato lo schema reale via Supabase MCP.
`public.profiles` **non ha** le colonne `interests`, `onboarding_complete`,
`updated_at`. Colonne reali: `id, role, first_name, last_name, city,
created_at, preferred_city, current_city_override, description, address,
website, instagram_handle, menu_url, image_urls, ai_metadata, is_unlimited`.

Conseguenze:
- `Onboarding.jsx` upsert `{id, interests, onboarding_complete, updated_at}`
  → 3 colonne su 4 inesistenti → PostgREST 400 → **l'upsert fallisce
  interamente**, errore non controllato (`await` senza check `.error`) →
  no-op silenzioso. **L'onboarding non ha mai scritto nulla su `profiles`.**
- Il referto Gate SEME diceva "profiles.interests ora salva gli id CORE":
  **falso**. Il seme funziona solo via localStorage.
- Esiste il trigger `on_auth_user_created → handle_new_user()` (SECURITY
  DEFINER) che crea la riga `profiles` al signup (verificato: 5 auth users /
  5 profiles / 0 orfani). Quindi la riga esiste sempre prima dell'onboarding:
  aggiungendo `onboarding_complete boolean NOT NULL DEFAULT false` ogni nuova
  riga nasce corretta, nessun caso "SELECT vuota" da gestire.

**Terza occorrenza della stessa classe di bug** (dopo `explorers.tours_completed`
del Gate PROFILO e `explorers`/`user_photos` vuote): una write Supabase verso
colonne inesistenti fallisce in silenzio e si traveste da successo.

### Gate SEME (L1) — interessi onboarding → weights ✅ PASS PRATICO (25/07)

**Commit `ff77cc0`** (produzione) + **`67dba21`** (test). CI verde, marker
`unnivai_onboarding_seed_v1` confermato nel bundle prod.

Diagnosi (2 referti read-only) ha trovato: le selezioni onboarding erano
**cosmetiche**. Scritte su `profiles.interests` (che non esiste, vedi sopra),
lette da nessuno. Break point: `useAILearning.js:213` chiamava
`computeWeights(graph, [])` — il 2° parametro `onboardingInterests` esisteva
già con boost +0.3 (`preferenceEngine.js:44-49`) ed era cablato a vuoto.

Fix:
- **Tassonomia**: `INTERESTS` da 8 a 7 voci, ognuna con campo `seeds` (id CORE
  seminati). `romantic` **rimosso** (`normalizeCategory` lo scartava in
  silenzio → seme vuoto indistinguibile da nessuna scelta). Una voce può
  seminare più id: "Storia e arte" → `['cultura','arte']`.
  Voci: food / cultura+arte / natura / nightlife / avventura / relax / shopping.
- **Scrittura**: nuova chiave `unnivai_onboarding_seed_v1` (localStorage,
  array piatto di id CORE, dedup). Scritta in `handleComplete` **prima** del
  navigate, e nel path "salta" con `[]` esplicito (chiave presente = "ho
  saltato", distinguibile da assente).
- **Lettura**: sincrona nell'initializer `useState` di `useAILearning`
  (try/catch → `[]`). Stato separato, **mai** dentro `learningState.preferenceGraph`.
- **`hasPreferences`** (DashboardUser:185): `totalInteractions >= 3 || hasSeed`.
  Senza questo il seme era inerte: il riordino DNA era saltato per un utente
  appena onboardato (R1 della diagnosi).
- **Fix privacy R3**: `AuthContext` cleanup logout rimuoveva
  `unnivai_ai_learning_brain` (v1) ma **non** `_v2` (lo STORAGE_KEY attuale).
  Su device condiviso il prossimo utente ereditava grafo e gusti del
  precedente. Aggiunte entrambe le chiavi (brain v2 + seme).

**Timing verificato read-only**: `/onboarding` è top-level, `/dashboard-user`
è dentro `RoleGuard` → sottoalberi diversi → al navigate React Router monta
ex-novo DashboardUser → l'initializer rigira e legge il seme appena scritto.
Nessun reload necessario. Tutti i 7 call site di `useAILearning` sono
componenti-pagina lazy, nessuno in un provider persistente.

**12 test nuovi** (`67dba21`, solo test, zero produzione):
- `preferenceEngine.test.js`: computeWeights col 2° arg + **invariante cleanup
  logout** — estrae `STORAGE_KEY`/`ONBOARDING_SEED_KEY` dal sorgente di
  `useAILearning` e verifica che `AuthContext` li pulisca. Se qualcuno rinomina
  la chiave senza aggiornare il logout, il test fallisce. Il bug R3 non può
  tornare.
- `useAILearning_seed.test.js`: round-trip seme→weights via `renderHook` con
  `useAuth → user:null` (il sync DB non parte, il grafo resta quello di
  localStorage). **Killer anti-grafo**: il seme muove i weights ma
  `preferenceGraph` resta `{}` e `totalInteractions` 0 — il grafo **non è
  mockato**, quindi se il seme ci finisse il test fallisce. La regola locked
  Gate DNA è ora protetta in CI, non a mano.
- `onboarding_seed.test.js`: derivazione seme via render reale del wizard
  (accorpamento cultura→cultura+arte, 7 voci → 8 id dedup, Salta → `[]`).
- Casi non producibili **dichiarati** invece che finti ("selezione vuota" non
  è raggiungibile: bottone disabilitato senza ≥1 scelta).

**Perimetro onesto**: il seme sposta **l'ordine**, non i temi. I temi discovery
restano fissi (`food/cultura/romance/nature`, `placesDiscoveryService.js:349-352`)
→ chi scegle "nightlife" non vede nascere un tour notturno. Cache di
`generateHomeTours` è city-only (`aiRecommendationService.js:1514`, aiProfile
**non** nella key) → su cache-hit 24h la narrazione è quella del primo utente
della città. Nessun sync cross-device. Nessun seme retroattivo per chi ha già
fatto l'onboarding.

### Gate DEBUG-NAV PERSIST — pannello autosufficiente sul campo ⏳ NON VERIFICATO (DBG non compare, 25/07)

**Commit `1f474f4`**. CI verde, marker `unnivai_debugnav_log_v1` confermato nel
chunk prod `MapPage-*.js` (lazy).

Diagnosi pre-camminata ha trovato che il pannello `?debugnav=1` **non bastava**:
(a) `soglia`, `armata`, `primoDellaSessione`, `scattato` esistevano solo nel
`console.log [DVAI-Geofence]` → leggibili unicamente con Mac collegato via cavo;
(b) buffer solo in memoria (`useRef`), zero persistenza → reload = dati persi;
(c) ring buffer 500 righe = 3-8 min di camminata.

Fix (tutto sotto `if (DEBUG_NAV)`, zero overhead a flag spento):
- Record tick arricchito con `soglia/armata/primo/scattato` (stessa fonte del
  console.log, stesso istante, non ricalcolati). Celle vuote quando il valore
  non esiste a quel punto del codice — mai zero inventato.
- Persistenza su `unnivai_debugnav_log_v1`, flush throttled 5s + su
  `pagehide`/`visibilitychange`. Righe accumulate tra sessioni, separatore
  `# SESSIONE <ISO>`. Cap ~3MB, oltre scarta il 25% più vecchio e marca
  `# TRUNCATED`.
- Ring buffer 500 → 5000 (~83 min di vista live).
- Pannello: contatore righe, KB salvati, ⚠ troncato, export **TSV con header**
  letto da localStorage (non solo dal ref), Pulisci con conferma.

**Logica nav invariata**: non toccati `soglia = max(GEOFENCE_BASE_M, accuracy)`,
arm-then-fire, `handlePOIUnlock`, `clearWatch`, camera, TTS, `logNavEvent`,
`pickActiveStep`. L'inserto è sotto `if (dbg)` e `dbg` è `null` a flag spento
→ la modifica non può alterare ciò che misura.

**Aperto**: la chiave contiene coordinate GPS e **non** è pulita al logout
(pulizia manuale dal pannello). Da aggiungere al cleanup `AuthContext` quando
si tocca quel file. Rilevante quando l'app va in mano ai tester.

### Gate ROUTING — onboarding raggiungibile ✅ CHIUSO / PASS VERIFICATO (25/07)

**Commit `2bbdf02`**. CI verde, deploy confermato con **marker negativo**
(vedi lezioni operative).

Finding device Ivano (utente nuovo): dopo la conferma email l'onboarding **non
parte mai**. Diagnosi: il link di conferma atterra su `/login`
(`emailRedirectTo`, Login.jsx:95); lì `Login.jsx:56-61` redirigeva a
`/dashboard-user` appena `user && role`. Il gate onboarding vive **solo** su `/`
(`RootDispatcher`, App.jsx:94-98) → mai valutato. `RoleGuard` controlla il ruolo,
non l'onboarding.

**Non era il browser sporco: era il flusso.** Riproducibile anche in incognito
pulito. Conseguenza grave: **nessun utente reale avrebbe mai visto l'onboarding**
→ il seme del Gate SEME non lo riceveva nessuno.

Fix a una riga: `Login.jsx` redirige a `/` invece di `/dashboard-user`. Login
smette di sapere cosa sia l'onboarding; **autorità unica** in RootDispatcher
(stessa logica della regola locked #8 "un solo motore di città").

Tre casi verificati, nessun vicolo cieco (regola #7): non autenticato → Landing
(nessun redirect a /login → nessun ping-pong); autenticato senza flag →
`/onboarding`; autenticato con flag → dashboard istantaneo (localStorage).

**Effetto collaterale da registrare**: il logout pulisce `dvai_onboarding_done`
(AuthContext.jsx:87) → **dopo questo fix ogni logout fa rivedere l'onboarding**.
Prima era invisibile perché Login bypassava il gate. Non è un vicolo cieco, ed
è oggi la via di test senza Mac, ma è UX sbagliata. Non si risolve togliendo il
flag dal cleanup (su device condiviso l'utente B erediterebbe il flag di A e
salterebbe l'onboarding): **si risolve solo con la colonna DB**. Il Gate
PERSISTENZA passa da nice-to-have a **necessario**.

**Non risolto, dichiarato**: cross-device; **deep-link a rotte protette** —
`RoleGuard` (App.jsx:130) avvolge tutte le rotte protette e controlla solo il
ruolo, quindi un autenticato-non-onboardato che apre `/map`, `/profile`,
`/home` (App.jsx:134) entra senza gate. `RoleGuard` è la sede architetturalmente
giusta per il gate, ma va progettata **insieme** alla verità DB — altrimenti si
costruisce su localStorage e si rifà. Entra nel Gate PERSISTENZA.

### LEZIONI OPERATIVE (25/07)

**4. Il marker negativo è più forte del marker positivo.** Un fix a una riga può
non introdurre stringhe nuove nel bundle → cercare un marker positivo produce
falsi negativi ("non lo trovo → non deployato"). Metodo collaudato su `2bbdf02`:
provare l'**assenza** della stringa vecchia (`/dashboard-user` non è più nel
chunk Login) + hash chunk cambiato + filename chunk cambiato = tre prove
indipendenti. Una stringa presente può venire da un build precedente; una
scomparsa dimostra la sostituzione.

**5. Attenzione ai chunk lazy nella verifica deploy.** Un marker in un componente
lazy sta in un chunk separato, non nell'entry. Cercarlo solo nell'entry produce
un falso negativo. Metodo: estrarre i chunk referenziati dall'entry e cercare in
tutti.

**6. Una write Supabase senza `.error` controllato è un no-op travestito da
successo.** Terza occorrenza (`explorers.tours_completed`, `explorers`/
`user_photos`, ora `profiles.interests`/`onboarding_complete`). Candidata a
regola locked #18. Serve un **audit delle write contro lo schema reale** —
sospetto che non sia l'ultima.

**7. Il "source scan" come pattern riusabile.** Due test ora leggono il sorgente
invece dell'implementazione: le regole anti-fake (contenuto fake) e l'invariante
cleanup del Gate SEME (accoppiamento silenzioso fra file). Il secondo è
generalizzabile: ogni costante definita in un file che deve comparire in un altro
(chiavi localStorage, nomi tabella, `CACHE_VERSION`, `AI_NOTIF_TYPES`) può essere
protetta da un invariante di tre righe. Da estrarre come helper al terzo uso.

### Backlog aggiornato al 25/07

**Priorità 0 — Verifiche device pendenti (3 gate in volo)**
1. **Test SEME + ROUTING in un colpo**: Esci → Accedi → deve comparire
   l'onboarding (verifica ROUTING) → scegli un solo interesse forte ("Natura e
   panorami") → Home: l'ordine dei "Per Te" deve riflettere la scelta al primo
   accesso (verifica SEME). Città fresca (cache DD 24h). Poi logout → verificare
   che `unnivai_onboarding_seed_v1` e `unnivai_ai_learning_brain_v2` spariscano.
2. **Camminata con `?debugnav=1`** (flag nell'URL al load, verificare bottone
   "DBG" prima di uscire): 3 avvicinamenti puliti in linea retta per la soglia
   (2c-3), 1 minuto fermo tra due tappe vicine per l'anti-cascata, 1 tratto con
   svolta per il ritardo maneuver + snapDistM. Export TSV a fine giro.

**Priorità 1 — Gate PERSISTENZA (ora necessario, non opzionale)**
- Migration: `ALTER TABLE profiles ADD COLUMN onboarding_complete boolean NOT
  NULL DEFAULT false` + `interests`. Da applicare a mano (SQL Editor) come le
  precedenti fuori dal migration tracker.
- Fix upsert `Onboarding.jsx`: inviare solo colonne esistenti + **controllare
  `.error`** e non ingoiarlo.
- `RootDispatcher` esteso: fast path (flag locale presente → decisione sincrona,
  zero DB) / slow path (flag assente → query DB dietro loading, poi Navigate).
  RootDispatcher renderizza solo `<Navigate>` → nessun flash dashboard.
  Dopo lettura DB positiva, scrivere il flag locale come cache.
- Gate onboarding spostato/allargato a `RoleGuard` per chiudere i deep-link.
- Chiude: ri-onboarding a ogni logout, cross-device, deep-link.

**Priorità 2 — Badge fantasma notifica**
La campanella si accende (`unreadCount > 0`) ma il pannello è vuoto. Sospetto
TTL 5 min: contatore e render usano criteri di validità diversi. Precedente:
Gate Z (`isNotificationLive` congelato dallo state React). Gate a sé, non un
one-liner. Diagnosi: `useUserNotifications.js:197, 218, 280, 299`.

**Priorità 3 — Nav (riapre col log della camminata)**
- **2c-3**: soglia geofence 25→~15m + kill fallback distanza HUD "8m".
- **Nav L2**: istruzioni maneuver che avanzano col GPS (oggi ritardo 30-40m),
  percorso che si colora, ricalcolo base, puntatore a scatti. Il campo
  `snapDistM` del log dirà se il ritardo è la tolleranza di snap (25m) o
  l'aggancio dello step. Se è la costante, è un one-liner e non un gate.

**Priorità 4 — Invariato dai giri precedenti**
- Ponte nav→profilo (Profilo L2), Esplora CC.3, U.2 (rate limit + cache
  narratore), `vercel.json` cache policy, RLS `profiles`/`guides`.
- Cleanup: `unnivai_debugnav_log_v1` al logout; allowlist Profile.jsx
  (0 Unsplash, 0 rating tour-level → può uscire da 2 regole).
- Blocco Antigravity: estetica di TUTTO dopo il funzionale. **Include il Gate
  ESTETICA ONBOARDING** (unica eccezione al paletto P1: l'onboarding non tocca
  nav né motore, quindi non brucia lavoro futuro). La tassonomia delle 7 voci
  è ora **fissata** → si disegna su struttura definitiva.

**Priorità 5 — Cleanup interni**
- Consolidare le DUE liste di regole locked in un'unica sezione 1-17 — la
  numerazione divisa ha già prodotto una lettura sbagliata (25/07): "REGOLE
  LOCKED (voce brand + processo)" in fondo (1-6) + "Regole locked NUOVE
  (14→16/07)" a metà file (7-17). La #8 ("Un solo motore di città", Gate AA)
  è stata cercata per errore nella lista in fondo.

**Fuori scope confermati**: estetica HUD/mappa/puntatore/popup nav (cambiano
struttura con i gate nav 2/3/5); voce TTS (gate a sé, breve).

### CHIUSURA SESSIONE 25/07 — verdetti device + decisioni strategiche

#### Verdetti device — 2 gate su 3 CHIUSI

- **Gate ROUTING → ✅ PASS VERIFICATO.** Logout → login → l'onboarding
  compare (screenshot Ivano). Il fix a una riga (`Login.jsx` → `navigate('/')`)
  ha chiuso l'ingresso primario. Gate CHIUSO.
- **Gate SEME (L1) → ✅ PASS PRATICO.** Scelta "Natura e panorami" → i "Per Te"
  cambiano rispetto alla sessione precedente ("Troina al tramonto — Monte
  Muganà" coerente col gusto). **Prova indiretta**: il confronto è con la
  sessione precedente, non un A/B pulito. Prova certa disponibile se serve:
  logout → onboarding con solo "Mangiare e bere" → verificare che l'ordine
  cambi di nuovo. Accettato come PASS.
- **Gate DEBUG-NAV → ⏳ NON VERIFICATO.** Il bottone DBG non compare aprendo
  `unnivai.vercel.app/?debugnav=1`. Causa probabile: il flag è letto una volta
  sola al load di MapPage (const module-level) e React Router non trasporta la
  query string nella navigazione interna → quando MapPage carica, l'URL è già
  pulito. **Prompt di verifica read-only già scritto e girato a Claude Code,
  referto MAI arrivato** (sessione chiusa prima). Da rigirare (vedi sotto).

#### PENDENTE BLOCCANTE — verifica pannello debugnav

Prima della camminata serve il referto read-only su: rotta esatta di MapPage;
se il pannello si monta aprendo la rotta diretta con param SENZA tour caricato;
se i tick GPS si registrano solo a nav attiva o anche a nav spenta (per provare
da casa); comportamento di "Copia log" su Safari iOS senza `navigator.clipboard`.
Il segnale di conferma cercato: **contatore righe del pannello che sale**.

#### Nuovi finding registrati (NON aperti)

- **Badge fantasma notifica** (P2, già a backlog, ora confermato device):
  il pallino si accende (`unreadCount > 0`) ma il pannello è vuoto. Sospetto
  TTL 5 min — contatore e render usano criteri di validità diversi. Precedente
  identico: Gate Z (`isNotificationLive` congelato dallo state React).
  Diagnosi da fare su `useUserNotifications.js:197, 218, 280, 299`.
  Nota Ivano: "è la cosa più bella che l'app fa" → merita un gate suo.
- **Landing con il Colosseo** (screenshot immagine 1): per un'app che promette
  "il posto che nessuno ti aveva mostrato così", il Colosseo è l'esatto
  opposto del posizionamento. → Gate ESTETICA, insieme all'onboarding.
- **"Quiz Veloce — Scopri il tuo stile di viaggio"** (Home, screenshot 4):
  possibile **secondo motore di preferenze** che convive con onboarding e DNA.
  Se scrive gusti da un'altra parte è la stessa classe del bug appena chiuso
  (regola locked #8, un solo motore). **Da diagnosticare prima del lancio.**

#### DECISIONE STRATEGICA — piano di lancio (rivisto)

Piano iniziale Ivano: agosto link privato a esperti + marketing in parallelo,
settembre pubblico + App Store/Play Store.

**Correzione sul punto store**: DoveVAI è React+Vite su Vercel, un sito web.
Per gli store serve incapsulamento (Capacitor) e **Apple rifiuta i wrapper di
siti web** (Guideline 4.2 Minimum Functionality) — servono funzionalità native
vere (GPS background, push native). Più: account dev 99$/anno, privacy policy,
dichiarazione dati, rifiuti probabili al primo submit. Realisticamente
**4-8 settimane di lavoro dedicato** dopo che il web è stabile.
**Alternativa registrata**: PWA installabile da Safari ("Aggiungi a Home") =
icona + fullscreen + zero attrito di distribuzione. Gli store sono una leva di
marketing (visibilità in ricerca), non un requisito tecnico per il lancio.

**Piano rivisto:**
- **fine luglio → ~15 agosto**: sicurezza (RLS) + Gate PERSISTENZA + bug
  strutturali. Poi UNO tra Nav L2 e Temi Adattivi (vedi bivio).
- **~15 → 31 agosto**: link privato agli esperti con credenziali definite
  + **lista scritta dei limiti dichiarati**. Marketing in parallelo.
- **settembre**: iterazione sul feedback, apertura pubblica web + PWA.
- **ott-nov**: store, se i numeri del web lo giustificano.

**Blocca il link privato (non negoziabile prima di dare credenziali a chiunque):**
RLS OFF su `profiles`/`bookings`/`guides` — con la anon key (pubblica nel
bundle) chiunque legge e scrive email e dati di tutti. Un esperto lo trova in
5 minuti con le DevTools. Dare il link a 10 persone = 10 utenti reali in un DB
aperto.

**Altri bloccanti per il test privato**: ri-onboarding a ogni logout;
scritture DB onboarding che falliscono in silenzio; badge notifica fantasma;
**nessun rate limit** (il link girato = chiamate Places/OpenAI sulla carta di
Ivano); `vercel.json` cache policy (ogni deploy = schermata errore per chi ha
cache vecchia, e in un mese di test i deploy sono frequenti).

**Voti attesi dagli esperti (stima onesta)**: codice 8-9 raggiungibile — quello
che un tecnico premia è la disciplina, e 25 regole anti-fake in CI + gate Vercel
fail-closed + perimetri dichiarati sono visibili nel repo. Prodotto 8 realistico,
non 9, se la nav resta L1. Marketing: non prevedibile finché non esiste risposta
a **città di lancio, utente in quella città, perché torna la seconda volta** —
domande a cui il codice non risponde, e la cosa più preziosa che il mese di test
può restituire, ma solo se gliela si chiede esplicitamente.

#### BIVIO DA DECIDERE — Nav L2 vs Temi Adattivi

Non c'è tempo per sicurezza+persistenza **e** Nav L2 **e** Temi Adattivi entro
il 15/08. La sicurezza non è negoziabile. Resta UNO tra:

- **Nav L2**: istruzioni maneuver che avanzano col GPS, percorso che si colora,
  ricalcolo base. Serve se il pitch è "tour a tappe che ti guida".
- **Gate TEMI ADATTIVI**: gli interessi non spostano solo l'ordine ma
  **generano i temi** (oggi fissi `food/cultura/romance/nature`,
  `placesDiscoveryService.js:349-352`). Serve se il pitch è "memoria
  intelligente che si adatta" — che è quello che Ivano ha dichiarato essere
  il motivo-per-tornare.

Stato onesto del DNA oggi: **vero come architettura, parziale come esperienza**.
Sposta l'ordine, non i temi. `DNA_MIN_CATEGORIZED = 12` → impara dopo 12
interazioni categorizzate vere. Un esperto che apre l'app 3 volte in 2 giorni
potrebbe non vedere il DNA muoversi abbastanza da capire che esiste.
**Se il DNA è il motivo-per-tornare, TEMI ADATTIVI non è un nice-to-have:
è la feature che dimostra la tesi.**

Decisione da prendere PRIMA di aprire il prossimo gate: determina l'ordine di
lavoro delle due settimane.

#### Ordine di lavoro concordato per la ripresa

1. Verifica pannello debugnav (referto pendente) → **camminata di calibrazione**
   con `?debugnav=1` (unico dato non producibile da casa).
2. **Gate SICUREZZA RLS** — decide se il 15/08 è una data o un'illusione.
3. **Gate PERSISTENZA** (migration `onboarding_complete` + `interests`, fix
   upsert con `.error` controllato, RootDispatcher fast/slow path, gate su
   RoleGuard per i deep-link).
4. Il ramo scelto al bivio (Nav L2 **oppure** Temi Adattivi).
5. Badge fantasma notifica.
6. Gate ESTETICA (onboarding + landing) — unica eccezione al paletto P1.

### Referto debugnav — causa trovata (25/07, fine sessione)

**Perché DBG non compariva**: `DEBUG_NAV` è una const module-level
(`MapPage.jsx:36-37`) valutata **una sola volta** al lazy-import del modulo
MapPage. Aprendo `unnivai.vercel.app/?debugnav=1` il load avviene su `/`, dove
MapPage non è ancora caricato; la navigazione interna a `/map` non trascina la
query string → al lazy-load `window.location.search` è vuoto → flag false.
Il pannello e la persistenza **funzionano**: il problema era solo dove stava il
param.

**Procedura che funziona (flag sticky, nessun codice da toccare)**:
1. Da loggato, hard-load di `unnivai.vercel.app/map?debugnav=1` (invio nella
   barra indirizzi, non navigazione interna). Rotta `/map`, App.jsx:138, dentro
   RoleGuard. Il pannello si monta anche **senza tour** (nessun early-return).
2. Verifica che compaia DBG in basso a sinistra.
3. Torna in dashboard, scegli un tour, entra in mappa dall'app: il param sparisce
   dall'URL ma `DEBUG_NAV` resta true (già catturato) → DBG persiste + tour
   caricato.

**Tick solo a nav attiva**: `pushNavDebug` è chiamato solo dentro il
`watchPosition` registrato in `handleStartNavigationReal` (:1088). Il watch di
background per il pallino blu (:424) non registra. Prova da casa: flag sticky →
tour con tappe → Avvia → anche da fermo iOS emette aggiornamenti GPS periodici,
il contatore "salvate" sale. **Segnale di conferma cercato: il contatore che sale.**

**Debolezza "Copia log" su iOS**: se `navigator.clipboard` fallisce, il fallback
`window.prompt` è impraticabile per un TSV grande. Mitigazione: copiare presto e
spesso, o spezzare la calibrazione in tratti brevi.

**RISCHIO NON RISOLTO — flag non sopravvive al reload**: se Safari ricarica la
scheda durante la camminata (schermo bloccato, background, pressione memoria), il
modulo si ricarica con URL pulito → `DEBUG_NAV=false` → **il pannello smette di
registrare in silenzio**. Il log già persistito sopravvive; i tick successivi si
perdono, e te ne accorgi solo al rientro. → **Gate DEBUGNAV STICKY** (prompt già
scritto, non ancora girato): leggere il flag da `sessionStorage` oltre che
dall'URL, con `?debugnav=0` per spegnerlo (regola #7 vale anche al contrario:
nessuno stato non-spegnibile).

**Pendente immediato**: provare la procedura sticky da casa (5 min, nessun
codice) e verificare che il contatore salga. Se NON sale, fermarsi: il problema
è un altro e il gate sticky sarebbe cieco.

---

## Aggiornamento 14/08 — Gate SICUREZZA RLS chiuso (device pendente)

Sessione di sola sicurezza + due diagnosi. Nessun file applicativo toccato:
il gate è DB puro, l'effetto è immediato su ogni client già aperto, anche su
bundle vecchi. Commit `22556dd`, 7 file (6 migration + rollback).
**Nessuna verifica bundle da fare** — non c'è bundle nuovo. Verifica device
pendente: per la regola #3 il gate non è chiuso finché Ivano non apre l'app.

### Gate SICUREZZA RLS — stato finale

Il bloccante del piano di lancio (vedi "DECISIONE STRATEGICA" del 25/07) era:
con la anon key, pubblica nel bundle, chiunque leggeva i dati di tutti.
Misurato, non dedotto: `GET /rest/v1/profiles?select=id,first_name` tornava
**5 righe complete** (nome, cognome, città, indirizzo, instagram,
`is_unlimited`) a chi non aveva nemmeno una sessione.

| Tabella | Prima | Dopo |
|---|---|---|
| `profiles` | RLS OFF, 0 policy | **RLS ON + 4 policy**: select/update/insert own (`auth.uid() = id`) + guida→richiedente |
| `bookings` | RLS OFF, 0 policy | **RLS ON + 3 policy**: select own, select guida via `tours.guide_id`, insert own. **Nessuna UPDATE/DELETE dal client** — lo stato lo scrive lo Stripe webhook in service_role |
| `guides` | RLS OFF, 0 policy | **RLS ON, 0 policy** — 0 righe, 0 riferimenti in tutto il codice: chiusa a chiave |
| `guides_profile` | RLS **già ON** ma con 2 `SELECT USING (true)` sovrapposte | **RLS ON + 3 policy own**: rimosse entrambe le letture pubbliche e la policy `ALL` con chiave sbagliata (`id` invece di `user_id`) |

Prove finali con la anon key: `profiles` da 5 righe a `[]`;
`guides_profile?select=piva,license_number` da `200` con i dati a `[]`.

**Perimetro allargato in corsa**: `guides_profile` non era nel referto
originale. La diagnosi ha misurato che PIVA, `license_number`,
`license_file_url`, `insurance_file_url` e `commission_rate` erano leggibili
da chiunque. Oggi quei campi sono vuoti — **non perché il percorso non esista**:
il form di accreditamento è vivo (`DashboardGuide.jsx:475` → `:201-203`). Il
giorno in cui una guida vera lo compila, la PIVA sarebbe diventata pubblica
nello stesso istante e senza nessun altro segnale. Quel giorno è il test
privato di agosto.

**La vista pubblica NON è stata creata**, di proposito: non esiste un solo
consumatore pubblico di `guides_profile` (tutti i lettori filtrano su
`user_id = user.id`). Si progetta quando servirà, insieme al fix del nome
guida in `TourDetails.jsx:585` (rotto: chiede `profiles.username` e
`profiles.bio`, colonne inesistenti). Un gate solo, col consumatore davanti.

### La ricorsione 42P17 — il momento in cui il gate è andato rosso

Al primo `ENABLE` su `profiles`, **ogni** SELECT è fallita con
`42P17: infinite recursion detected in policy for relation "profiles"`.
RLS spenta entro pochi secondi (rollback), causa isolata:

```
profiles."profiles_select_guide_on_request"
  └─ sottoquery su guide_requests
      └─ guide_requests."Guides see local requests"   ← policy PRE-ESISTENTE
          USING (city = (SELECT profiles.city FROM profiles WHERE id = auth.uid()))
          └─ sottoquery su profiles  ⟲
```

**Non era la policy nuova a essere sbagliata**: è `guide_requests` ad averne
una che interroga `profiles`.

**Soluzione**: il lookup è stato spostato in
`public.is_requester_visible_to_guide(uuid)`, **SECURITY DEFINER** con
`search_path` fissato. Il corpo gira con i permessi del proprietario di
`guide_requests` (che non ha `FORCE ROW LEVEL SECURITY`), quindi non attiva le
sue policy e il ciclo non si forma. `EXECUTE` revocata a `public` e `anon`,
concessa solo ad `authenticated`: restituisce un booleano, non righe.

Scartato il rimuovere `"Guides see local requests"`: avrebbe rotto il ciclo e
tolto una policy discutibile (consente a ogni autenticato di leggere tutte le
richieste della propria città), ma cambia il comportamento di **un'altra**
tabella dentro un passo che deve toccarne una sola. Va nel cleanup policy.

**Nota sulla policy guida→richiedente**: espone la **riga intera** del profilo
del richiedente, non solo nome e foto — RLS è *row*-level, non sa restringere
le colonne. Il secondo `EXISTS` (il lettore deve avere una riga in
`guides_profile`) è stato aggiunto perché senza di esso "richiesta a pioggia"
non significa "visibile a qualunque guida" ma **"visibile a qualunque utente
autenticato"**.

### Advisor sicurezza — nuovo stato verde

I **3 ERROR `rls_disabled_in_public`** su `profiles`, `bookings`, `guides`
**sono spariti**. Resta **un solo ERROR: `spatial_ref_sys`** — PostGIS
built-in, di proprietà di `supabase_admin`, il ruolo `postgres` non può
nemmeno fare l'`ALTER`, zero dati personali.

> **Da qui in avanti, "advisor con 1 solo ERROR" È lo stato verde di questo
> progetto. `spatial_ref_sys` è dichiarato accettato: non va più inseguito.**

Due voci nuove, entrambe volute: `INFO rls_enabled_no_policy` su `guides` (è
la scelta), e `WARN` su `is_requester_visible_to_guide` eseguibile da
`authenticated` (inevitabile: la policy la chiama). **Non** compare tra le
SECURITY DEFINER eseguibili da `anon`: la REVOKE ha funzionato.

### Bug scoperti strada facendo (nessuno causato dal gate)

**1. Ogni UPDATE su `guides_profile` ed `explorers` fallisce** — `42703:
record "new" has no field "updated_at"`. Il trigger `set_updated_at()` scrive
`NEW.updated_at` su due tabelle che **non hanno quella colonna**. Sono le
uniche due occorrenze (`profiles` è pulita: ha solo
`protect_profile_is_unlimited`).
**Provato che NON è l'RLS**: lo stesso UPDATE fallisce identico eseguito come
`service_role`, che ha `rolbypassrls = true`. Metodo da riusare ogni volta che
una verifica va rossa dopo aver toccato RLS.
Rompe: form di accreditamento guida (`DashboardGuide.jsx:208`), gestione città
operative (`:735`, `:758`).

**2. Auto-creazione profilo guida rotta** — `428C9: cannot insert a
non-DEFAULT value into column "user_id"`. `DashboardGuide.jsx:75` fa
`insert([{ user_id: user.id }])`, ma **`user_id` è `GENERATED ALWAYS AS (id)
STORED`**: è un mirror di `id`, non è scrivibile.
**Il fix NON è dare un default a `id`**: è inserire `id` e lasciar derivare
`user_id`. La previsione derivata dallo schema (`23502` su `id NOT NULL`) era
**sbagliata**, la misura l'ha corretta. Se il gate fosse partito dalla
derivazione avrebbe scritto la patch sbagliata.
Effetto collaterale positivo: l'incoerenza `id` vs `user_id` nelle policy non
può materializzarsi — il DB vincola le due colonne a coincidere.

**3. Confermato `protect_profile_is_unlimited` funziona** (misurato su un
account con flag `false`; il primo test era invalido perché girato su un
account già `true`). Un client autenticato che prova ad auto-assegnarsi
`is_unlimited` si vede ripristinare `false`; con claim JWT `role=service_role`
l'assegnazione passa. La `UPDATE own` non apre una scalata di privilegi.

### Diagnosi bug città — "sono in Puglia, l'app dice Troina"

**Causa, e non è `current_city_override`.** `useUserContext.js:48` sovrascrive
`userContext.city` con `effectiveCity`: il valore del DB **non raggiunge mai
la UI**. La catena reale ha due soli gradini (`useUserContext.js:23`):

```js
const rawCity = isManual ? manualCity : gpsLocation?.city;
```

Il colpevole è `CityContext.jsx:32`:
```js
isManual = !validGps && !!localStorage.getItem('user_city')
```
combinato con `CityContext.jsx:81`: **è il GPS stesso a scrivere `user_city`**.
Quindi quella chiave non significa "scelta manuale" ma "ultima città
conosciuta, da qualunque fonte". `dvai_gps_data` scade in **1 ora**,
`user_city` **mai** → 60 minuti dopo la camminata di Troina, `isManual`
diventa `true` su un valore che nessuno ha scelto a mano, e da lì il ramo
`gpsLocation?.city` non viene più nemmeno letto.

**L'unica uscita** è `applyLocationAndNotify` con nome città risolto
(`CityContext.jsx:79`), raggiungibile **solo dal bottone del banner**.
`resetToGPS()` esiste ma è destrutturata in `CitySearchBar.jsx:7` e **mai
invocata**. Il GPS automatico al mount non tocca CityContext. Il logout
azzera tutto.

**Rotella infinita**: il loading di `GpsActivationBanner` si spegne solo
dentro i due callback di `requestGPS`. `GPS_POSITION_OPTIONS.timeout = 8000`
**non copre l'attesa del permesso** (per specifica), e non esiste alcun
watchdog indipendente → se il prompt resta appeso, **stato non-uscibile**
(viola la regola #7, stessa classe della #10). Secondo candidato: nel ramo
`catch` del geocode (`CityContext.jsx:118-125`) `setGpsActive(true)` **smonta
il banner** prima che `setIsLoading(false)` abbia effetto, e `onSuccess` riceve
la città **vecchia dalla closure** → nessun messaggio, città invariata.
**Discriminante osservabile sul device**: se la TopBar dice "Ciao, ...!"
mentre gira, `gpsLoading` è bloccato → è il permesso, non un GPS lento.

**Conferma indipendente arrivata durante il gate**: a inizio giornata il DB
diceva `current_city_override = 'Troina'`; a fine giornata dice
**`Ippocampo`** (Puglia, provincia di Foggia). Non l'ha scritto nessuna sonda
(tutte in transazioni rollbackate, e usavano `Bari`/`BaselineTest`): l'ha
scritto l'app dal device. **Il DB sa che Ivano è in Puglia; è lo schermo che
continua a dire Troina.** Non databile: `profiles` non ha `updated_at`.

### LEZIONE OPERATIVA #8 — non è più un bug ricorrente, è uno scollamento

La classe **"scrittura Supabase che fallisce e si traveste da successo"** è
alla **settima occorrenza**: `explorers.tours_completed` → `explorers`/
`user_photos` vuote → `profiles.interests`/`onboarding_complete` → colonne
`bookings` inesistenti → 4 embed PostgREST senza FK → `profiles.username`/
`bio` → `guide_applications` inesistente → trigger `updated_at` su tabelle
senza la colonna → `user_id` generata non scrivibile.

Sette volte non è sfortuna: è uno **scollamento sistematico tra ciò che il
codice crede dello schema e ciò che lo schema è**. E ha un costo già pagato
due volte in questo gate: metà delle query che "sarebbero state rotte da RLS"
erano **già rotte**, e senza misurarlo avremmo attribuito all'RLS danni che
non ha fatto.

→ **Serve un GATE AUDIT SCHEMA prima del Gate PERSISTENZA**: confronto
sistematico di ogni `.from(...).insert/update/select` e di ogni embed
PostgREST contro lo schema reale interrogato dal DB. Il Gate PERSISTENZA sta
per aggiungere colonne a `profiles` senza sapere quali altre query
interrogano cose che non esistono.

### LEZIONE OPERATIVA #9 — un difetto può restare latente perché una protezione è spenta

La ricorsione `42P17` esisteva **da quando è stata scritta**
`"Guides see local requests"`. Non si è mai manifestata perché `profiles`
aveva RLS spenta: senza policy su `profiles`, il ciclo non si chiudeva.

Accendere una protezione non introduce solo il rischio di rompere ciò che
funziona: **rivela difetti che erano lì da sempre e che la protezione spenta
nascondeva**. Conseguenze pratiche:
1. Il rosso di un gate di sicurezza non è automaticamente colpa del gate.
   Prima di rollbackare per sempre, **isolare** — rieseguire come
   `service_role` (che bypassa RLS) è il test che separa i due casi.
2. Le altre protezioni ancora spente (`guide_requests` e `notifications` hanno
   RLS ma con policy larghe) possono nascondere altri cicli. **La RLS FASE 2
   va aperta aspettandosi un 42P17, non sperando di non trovarlo.**

### Backlog aggiornato al 14/08

**Priorità 0 — verifiche device pendenti**
1. **Gate RLS** (oggi): Home carica, dashboard guida mostra i nomi dei
   richiedenti, generare un tour senza 401/403 in console. Rollback a una
   riga: `ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY` (le policy
   restano inerti). Vedi `supabase/GATE_RLS_ROLLBACK.sql`.
2. **Camminata con `?debugnav=1`** (procedura sticky del 25/07) — invariata.
3. **Test SEME + ROUTING** — invariato dal 25/07.

**Priorità 1 — Gate CITTÀ** (nuovo, bloccante per il test privato)
Due bug distinti con una conseguenza condivisa: il bottone del banner è
l'unica uscita dallo stato incollato, e il bug 2 rompe l'unica riparazione
del bug 1. Riparare: (a) `isManual` non va inferito dalla presenza di
`user_city` — serve una chiave distinta per la scelta manuale, oppure un flag
esplicito; (b) watchdog sul bottone GPS; (c) il ramo `catch` del geocode deve
smettere di ripassare la città vecchia; (d) cablare `resetToGPS` a un bottone.
Nota: `applyLocationAndNotify` aggiorna CityContext ma `useUserContext:23`
legge `gpsLocation?.city` da **un altro hook** quando `isManual` è false —
va sciolto insieme, altrimenti uno sblocco riuscito fa **sparire** la città.

**Priorità 1 — GATE AUDIT SCHEMA** (nuovo, prerequisito di PERSISTENZA)
Vedi lezione #8. Deve produrre l'elenco completo delle write/read verso
colonne o FK inesistenti, e i due bug trigger/`GENERATED ALWAYS` di oggi.

**Priorità 2 — Gate RLS FASE 2**
`guide_requests` (anon legge le richieste open con `request_text`; INSERT con
`WITH CHECK (true)` → chiunque inserisce a nome di altri; UPDATE su qualunque
richiesta non assegnata), `notifications` (chiunque scrive a chiunque),
`explorers`/`user_photos` (`USING (true)` che annulla le own-only), le **6 RPC
SECURITY DEFINER anon-eseguibili** (`get_nearby_requests_for_guide` restituisce
`user_name` e `request_text`; `complete_tour` **scrive**), cleanup delle policy
duplicate (`guide_requests` 10, `notifications` 7, `businesses_profile` 6).
Aspettarsi un 42P17 (lezione #9).

**Priorità 3 — Gate PERSISTENZA** — invariato dal 25/07, ma **dopo** l'audit
schema. La policy `profiles_insert_own` è già scritta e in attesa: PostgREST
valuta l'INSERT prima del `DO UPDATE`, quindi senza di essa l'upsert riparato
fallirebbe per un motivo nuovo.

**Priorità 4 — il bivio, ancora NON deciso**: Nav L2 **oppure** Temi Adattivi.
Il piano rivisto del 25/07 dava "fine luglio → ~15 agosto" per sicurezza +
persistenza + bug strutturali, e poi UNO dei due. **Oggi è il 14/08**: la
sicurezza è chiusa (device pendente), la persistenza no, e sono comparsi due
gate nuovi (CITTÀ, AUDIT SCHEMA) che prima non c'erano. La data del test
privato va rinegoziata su questi fatti, non sul piano di tre settimane fa.

**Priorità 5** — badge fantasma notifica, Gate ESTETICA (onboarding +
landing), Esplora CC.3, U.2, `vercel.json` cache policy, cleanup
`unnivai_debugnav_log_v1` al logout, consolidamento delle due liste di regole
locked.

### VERDETTO DEVICE 14/08 — Gate SICUREZZA RLS ✅ PASS

Verificato da Ivano su iPhone. **Per la regola #3 il gate è CHIUSO.**
Nessun rollback eseguito: `profiles`, `bookings`, `guides` e `guides_profile`
restano con RLS attiva. `supabase/GATE_RLS_ROLLBACK.sql` resta in repo come
rete, non è stato usato.

**Perimetro onesto del verdetto**: è un PASS complessivo dichiarato dal
device. Le singole voci della checklist (Home, dashboard guida coi nomi dei
richiedenti, tour generato senza 401/403) **non sono state riportate una per
una**, quindi non risultano da qui quali percorsi siano stati effettivamente
percorsi. Non risultano provati: dashboard business, dashboard guida in
scrittura (che è comunque rotta per il trigger `42703`), signup di un utente
nuovo dal telefono.

### Finding device 14/08 — registrati e riqualificati, NON aperti

**Nessuno riguarda l'RLS**: sono contenuto e presentazione, non permessi.

> **CORREZIONE a una prima stesura di questo blocco.** Il finding
> distanza/tempo era stato registrato come "quarto avvistamento" del summary
> bugiardo del 23/07. **È sbagliato: sono due difetti distinti.** Quello di
> oggi è di **presentazione** (numeri corretti, accostati male, in navigazione
> attiva); quello del 23/07 è di **calcolo** (numero sbagliato, nel riepilogo
> di fine tour). Vanno aperti separatamente e hanno fix diversi. Registrato
> anche l'errore: accorpare per somiglianza superficiale due difetti che
> vivono in schermate diverse ne nasconde uno dei due.

---

**FINDING 1 — POI-località con descrizione poetica** (contenuto)

Dati dal device:
- **Località**: Ippocampo, frazione di Zapponeta, provincia di Foggia, Puglia
- **Città rilevata dall'app**: Ippocampo
- **Schermata**: drawer POI in mappa, durante un tour generato da "Percorso Veloce"
- **Titolo mostrato**: "Ippocampo", con sotto il badge località "IPPOCAMPO"
- **Foto**: un cortile con ghiaia e una pianta — non un luogo di interesse
- **Testo sotto "PANORAMICA"**, esatto:
  > *"Nei pressi di Ippocampo, le onde si infrangono dolcemente, portando un
  > profumo salmastro nell'aria."*
- **Il tour aveva UNA sola tappa** (TAPPA 1/1), ed era la località stessa

**Due regole locked violate insieme:**
- **#12** (la voce del brand è fatti verificabili, mai aggettivi): "onde che si
  infrangono dolcemente" e "profumo salmastro" sono precisamente la poesia che
  la blacklist doveva uccidere. Il post-processing regex non li ha intercettati
  perché non sono nella lista dei termini ("sorseggia", "gusta",
  "spettacolare"…): **la blacklist per termini non regge contro una frase
  nuova**. È il limite strutturale dell'approccio, non una svista.
- **#16** (ogni tappa ha nome vero + descrizione unica del luogo + quando
  visitarlo; se il narratore non produce descrizione vera **la tappa non
  entra**; tour con 0 tappe post-filtro → **escluso**). Qui la tappa è entrata,
  ed era l'unica: applicando la regola alla lettera il tour **non sarebbe
  dovuto esistere**. Il "meno tappe > tappe vuote" non è stato applicato.

**Il titolo è il campanello più forte**: quando titolo POI e badge località
coincidono ("Ippocampo" / "IPPOCAMPO"), l'entità non è un luogo — è il posto
in cui ti trovi. È un invariante verificabile in CI senza chiamare nessuna API.

**Due domande per la diagnosi** (da girare, non risposte qui):
1. **Perché una località entra tra i POI.** Se è il filtro sui `types` di
   Google Places a lasciarla passare (`locality`, `administrative_area_level_*`,
   `sublocality`), il fix sta **a monte del testo** e il narratore è innocente.
2. **Perché il narratore ha prodotto atmosfera invece di fermarsi.** La #16
   prevede esplicitamente il fermarsi. Da capire se il filtro "descrizione
   vera" non esiste su questo path, o se esiste e questa frase l'ha superato.

**Contesto che cambia il peso del finding**: Ippocampo è un piccolo villaggio
turistico con pochissimi POI. È il **caso limite "città con pool quasi
vuoto"** — dove il motore ha meno da cui pescare e quindi raschia il fondo.
Da tenere presente nel decidere il fix: **se l'app funziona solo dove ci sono
50 POI, il posizionamento si restringe alle città già note** — cioè l'opposto
della promessa "il posto che nessuno ti aveva mostrato così". Il
comportamento giusto in pool vuoto non è "inventa qualcosa", è "dillo".

*Candidati da verificare*: `placesDiscoveryService.js` e
`aiRecommendationService.js` per generazione e filtro `types`;
`POIDetailDrawer.jsx` per la resa.

---

**FINDING 2 — HUD navigazione: due grandezze sulla stessa riga senza etichetta**
(presentazione)

Screenshot della navigazione attiva:
```
riga 1:  Procedi in direzione nordest su Via Oceano Atlantico...
riga 2:  720 m • 27 min rimasti
riga 3:  TAPPA 1/1 — Ippocampo
riga 4:  2.0 km totali · ~27 min
```

**I numeri sono CORRETTI.** 720 m è la distanza al **prossimo maneuver**;
27 min è il tempo del **tour intero** (2.0 km a piedi ≈ 4,4 km/h, coerente).
Il difetto è che **due grandezze diverse stanno sulla stessa riga senza
etichetta**, quindi si leggono come "720 m in 27 minuti" — che sarebbe un
passo assurdo. Ivano l'ha letto così, e ha ragione a leggerlo così.

Non è un bug di calcolo e **non è un fake**: è un difetto di presentazione.
Ma l'effetto sull'utente è lo stesso di un dato falso — crede un numero che
il prodotto non ha mai affermato. Vale la pena registrarlo come **estensione
della regola #12**: un dato vero, accostato male, comunica una falsità. La
regola oggi copre il *registro* del testo (fatti, non aggettivi); non copre
l'*accostamento* di due dati veri.

*Superficie*: `NavigationHUD.jsx`. I due formatter (`:73-86`, `${m} min` e
`${(m/1000).toFixed(1)} km`) sono corretti e ricevono le grandezze giuste —
il fix è nell'etichettatura/layout, non nel calcolo.

---

**FINDING 3 — riferimento incrociato: il summary bugiardo resta aperto**

Da non confondere col Finding 2. Registrato il **23/07**, mai chiuso, difetto
di **calcolo** nel **riepilogo di fine tour**: *"IL SUMMARY MENTE: mostra
3,2 km quando l'utente ne ha camminati ~1 — è la distanza del tour pianificato
(Directions) spacciata per percorso fatto"* + *"minuti congelati a '50 min
rimasti' mentre i metri calano"*. Superficie diversa (`TourSummaryModal.jsx` /
`QuickPathSummary.jsx`), causa diversa, fix diverso. Resta al suo posto nel
backlog 23/07 (punto 3, "Gate summary onesto", verificabile da casa).

---

**Backlog — dove vanno.** Finding 1 e 2 entrano in **Priorità 2**, sopra la
RLS FASE 2: sono visibili all'utente al primo sguardo e il test privato agli
esperti è a giorni. Il Finding 1 ha priorità sul 2 — un POI inventato è una
violazione di verità, l'HUD è una lettura ambigua di dati veri.

---

## Sessione 15/08 — Gate NARRATORE/POI chiuso + 18 giorni di deploy fermi

Sessione lunga: una diagnosi in due fasi, un gate in tre fasi, la scoperta che
la produzione era ferma al 27/07, e sei finding dal campo (Ippocampo, FG).

### Gate NARRATORE/POI — commit `1bab486` ✅ PASS DEVICE (parziale)

Origine: il 14/08 a Ippocampo un tour "Percorso Veloce" aveva UNA tappa, ed era
**la località stessa**, con descrizione poetica ("le onde si infrangono
dolcemente, portando un profumo salmastro") e foto di un cortile con ghiaia.
Violava le regole locked #12 e #16.

**Diagnosi — tre difetti indipendenti, non uno:**

1. **Il filtro `types` non esisteva.** `BLACKLIST_TYPES`
   (`aiRecommendationService.js:131-139`) è una lista di *servizi commerciali*
   (meccanici, banche, scuole): nessuna entità geografica. Una `locality` non
   aveva motivo di essere scartata, e `mapGoogleTypeToOurType` la classificava
   `'place'`. **Il narratore era innocente**: gli è stato chiesto di descrivere
   Ippocampo e l'ha descritto.
2. **La regola #16 viveva in un posto solo.** Il filtro `.filter(s =>
   s.description && ...)` di Gate II sta in `generateHomeTours:1591`. Il path
   QuickPath passa da `generateItinerary`, dove il blocco `:1154-1172` fa
   canonicalize → radius → sort e **nessun filtro su description**.
   È la regola #8 ("un solo motore") applicata alla voce invece che alla città:
   due narratori con due regole diverse.
3. **La regola #12 era falsa nell'handoff.** `JUDGMENT_PATTERNS:1955` esiste
   solo per `parsed.message` delle **notifiche**. Sul path tour la blacklist è
   solo testo dentro il prompt — un'istruzione all'AI, non un controllo
   sull'output. L'handoff dichiarava "post-processing regex rimuove le formule
   di giudizio" come se valesse ovunque. **Corretto.**

**Scoperta collaterale grave — `applyQualityThreshold:387-402`:** sotto i 3
candidati qualificati il motore scende a `scaleLevel 3` e ritorna `candidates`
**non filtrati**. In pool quasi vuoto la soglia qualità **cessa di esistere**, e
l'unica traccia è un `console.warn`. Il comportamento in paese piccolo oggi non
è "dillo": è **raschia il fondo in silenzio**.

**Fase 0 (read-only) — quattro risposte che hanno dimensionato il fix:**
- `normalizeTour` NON reintroduce default su `description` (`tourShape.js:285` è
  una coercizione `|| ''`, non un contenuto). Un filtro a monte regge.
- I 4 call site di `generateItinerary` (QuickPath:627, SurpriseTour:228,
  AiItinerary:240 e :329) non filtrano a valle → **un fix solo li copre tutti**.
- `applyQualityThreshold` ha **un solo chiamante** (`:512`), e `scaleLevel` viene
  **loggato e buttato**: un POI raschiato è byte-identico a uno di qualità per
  chiunque lo riceva. MA alimenta **tre superfici** (tour, notifiche via
  `:1804`, temi Home via `:584`) → rimuoverlo violerebbe la regola #4.
- Il paracadute dei 12 km **esiste già ma è inerte**: Places cerca entro 3 km
  (`:481`), `applyRadiusFilter` riallarga a `R_wider=12` km (`tourShape.js:53`)
  — ma non può ripescare ciò che la ricerca non ha mai portato a casa.

**Implementazione — 3 fasi, 1 commit, 42 test nuovi (236 → 278 passed):**

- **Fase 1** — `GEO_ENTITY_TYPES` (19 type: locality, sublocality*,
  administrative_area*, political, postal_code*, neighborhood, country…) in
  `passesHardExclusions`. Lista **separata** da `BLACKLIST_TYPES`, semantica
  diversa. Esclusi di proposito `route`, `point_of_interest`, `establishment`,
  `premise`: li portano anche i POI veri (a Troina `Ruderi Monastero Nuovo` e
  `Madonna della Catena` hanno **solo** `['point_of_interest']` — includerlo li
  avrebbe uccisi).
  Più `isCityItself(candidate, cityName)`: scarta il candidato che è la città
  stessa (normalizzazione NFD + affissi "comune di"/"frazione"/sigla), con
  **guard anti-falso-positivo**: se ha un type di luogo reale, passa sempre.
  Applicata **prima** di `applyQualityThreshold` — un candidato destinato allo
  scarto non deve essere contato per decidere lo scale-down.
- **Fase 2a** — guard consumatori (regola #5). **Due bug pre-esistenti dal Gate
  B, non introdotti dal filtro**: SurpriseTour:243 controllava
  `days.length === 0` che **non scatta mai** (days ha length 1 con stops vuoto) →
  navigava a una scheda tour con zero tappe; AiItinerary `regenerateDay:337`
  faceva `if (newDay)` su `{stops: []}` che è **truthy** → sostituiva il giorno
  con uno vuoto. Il filtro li avrebbe resi frequenti.
  Pattern usato: funzioni pure esportate + testate (`getSurpriseOutcome`,
  `shouldReplaceDay`), come `getTourRenderState` di `TourDetails.jsx:40` nato dal
  Gate E-1.
- **Fase 2b** — `hasRealDescription()` estratto come predicato **condiviso**,
  usato da `generateHomeTours` (invariato, 3 test di non-regressione) e da
  `generateItinerary`. Il tour svuotato cade nel ramo onesto **già esistente**
  a `:1183-1193` (NON `:1211`, che copre "0 candidati Places" e si attiva prima
  della chiamata AI). Nessun ramo nuovo, nessuna modifica al flusso.

**Verdetto device (Ippocampo, 15/08):** con percorso Natura → Parchi e Verde la
tappa è **"La Masseria"**, un POI vero. Il primo tentativo mostrava ancora
"Ippocampo" perché lo stesso percorso nel wizard = stessa cache key = tour
cachato pre-deploy. **Il gate funziona.**
**Perimetro del PASS**: NON verificato su città con pool ricco (Catania/Troina)
— è il test che direbbe se il filtro è troppo stretto. Resta aperto.

**Cosa il gate NON risolve (dichiarato):** il narratore può ancora scrivere prosa
inventata su un luogo vero (confermato device: "il profumo di pane fresco appena
sfornato riempie l'aria mentre entri" su La Masseria); notifiche e temi Home
restano al livello 3; `fetchPlaceDetailsForTour` (precompute) non passa da
`isCityItself`; `regenerateDay` controlla il giorno **prima** di `normalizeTour`,
quindi non vede le tappe svuotate dal filtro raggio; **nessun cache bump** → i
device con cache POI calda vedono i candidati vecchi fino a 24h.

### DECISIONE POOL-VUOTO (presa 15/08, da implementare nel Gate 2)

Scelta **(c) con (a) come fondo**:
1. Pool locale, soglia piena. ≥3 tappe vere → tour normale.
2. Se <3, **secondo textsearch a raggio esteso (~12 km, da calibrare) a soglia
   INVARIATA**, con distanza dichiarata all'utente.
3. Se ancora niente: **nessun tour + messaggio onesto**.

Il punto che la rende difendibile: **`applyQualityThreshold` smette di avere il
livello 3**. Il motore non abbassa più l'asticella, **allarga il territorio ad
asticella invariata**. Scartata (b) "servi con disclaimer": un disclaimer non
trasforma una località in un luogo da visitare.
Motivazione di prodotto: "Il posto esiste" — a Ippocampo il posto esiste, non
dentro il confine della frazione. Un'app che si arrende al confine comunale
contraddice la propria promessa. **Con (a) l'app funziona solo dove c'è già
turismo; con (c) ovunque ci sia qualcosa entro mezz'ora.**
Vincoli noti: raggio da calibrare su casi reali; un POI a 12 km in un'app "a
piedi" richiede il mezzo dichiarato; cache bump obbligatorio.

### LA VICENDA DEPLOY — produzione ferma dal 27/07 al 14/08

Il commit del gate risultava su main con CI verde, ma il bundle in prod non lo
conteneva. Cause e prove:

- **5 deploy `Canceled`, tutti in 1-2 secondi.** Ultimo `Ready`: 27/07.
- Log build: `🛑 GitHub API returned 401 — BLOCKING deploy (fail-closed). PAT
  invalido o senza permesso 'Actions: Read'`. **Il PAT fine-grained era scaduto.**
- Il gate `vercel-ignored-build-step.sh` ha funzionato **come doveva** — ha
  bloccato invece di deployare alla cieca, e stampa già il rimedio nei log.
- **18 giorni di commit mai arrivati in produzione.** Include il Gate RLS
  (`22556dd`), che però era **DB-puro**: l'effetto era immediato via Supabase,
  quindi il PASS device del 14/08 resta valido.
- Fix: PAT rigenerato (**senza scadenza**, `Actions: Read-only` sul solo repo
  `unnivai`), `GH_TOKEN` aggiornato su Vercel (Production + Preview), redeploy.
  Cancellati i token morti in lista (`vercel-ci-gate-unnivai`, `claude`).
  ⚠️ `dove vai` — "last used within 5 months" — **da verificare prima di
  cancellare**: potrebbe servire ad altro (Managed Agents, script locali).

**Verifica bundle post-redeploy: DEPLOYATO ✅** — 4 marker letterali in 4 chunk
emessi separatamente (entry `index-DyWmrz3g`, `placesDiscoveryService-B15ZU2Md`,
`SurpriseTour-4RXhbFlF`, `AiItinerary-BmuhMTve`). `aiRecommendationService` **non
ha un chunk suo**: è bundlato nell'entry.

### LEZIONI OPERATIVE NUOVE

**#10 — Il gate Vercel fail-closed è corretto ma MUTO.** Blocca in 1 secondo e
il segnale vive solo nei log di build, che nessuno apre di routine.
**Il tempo del Canceled è la diagnosi, a costo zero:** 1-2s = lo script è uscito
subito (fail-closed, non ha mai guardato la CI); ~90s+ = ha davvero atteso e
visto un workflow non-success. Vale anche per il Ready: **25s = build cache
riusata, ~1m50s = build pulito**.
Aperto: il gate dovrebbe avere una voce (notifica, o un check visibile su
GitHub) invece di morire in silenzio. E la scadenza dei PAT va tracciata.

**#11 — Un fallimento dello strumento letto come "assenza" è la stessa classe di
errore del marker mal cercato.** Tre occorrenze in una sessione:
(a) `grep` senza `-F` su `[Gate NARRATORE/POI]` → le parentesi quadre lette come
classe di caratteri → falso "trovato in 75 chunk";
(b) un `curl` tornato vuoto dopo ~150 richieste allo stesso host → falso
`ENTRY NON TROVATO`;
(c) `console.warn` è **silenziato globalmente** in `src/test/setup.js:82`
(`vi.spyOn(console,'warn').mockImplementation(()=>{})`) → un grep sull'output dei
test non prova nulla, né in un senso né nell'altro: serve lo spy.
**Regola: prima di fidarsi di un'assenza, provare che lo strumento troverebbe una
presenza nota** (metodo usato: cercare `unnivai_debugnav_log_v1`, marker già
deployato, prima di cercare quello nuovo).

**#12 — Gli hash prod ≠ locale sono NORMALI e non provano nulla.** Vite inlinea
`import.meta.env.VITE_*` a build time e le env di Vercel differiscono dal `.env`
locale. Aspettarsi hash identici produce un falso "non deployato". I criteri
validi sono due: **l'hash di prod è cambiato rispetto a prima**, e **il contenuto
contiene i marker letterali**.

### FINDING DEVICE 15/08 — registrati, NON aperti

**F1 — La foto mostrata non è del posto (CONFERMATO DUE VOLTE).**
`POIDetailDrawer.jsx:21-37`: quando manca l'immagine, fa una seconda query
Places **client-side** `findPlaceFromQuery({query: "${poi.name} ${poi.city}"})` e
prende `results[0].photos[0]` **senza verificare che sia lo stesso place_id**.
Osservato: "Ippocampo" → cortile con ghiaia; "La Masseria" → parco giochi per
bambini. Fetch client-side non passante dal proxy → fuori dalla cache DD e
probabilmente fuori da `no-places-url-outside-builder` (da verificare).
**Priorità alta: è "tutto vero, zero fake" rotto nel modo più visibile.**

**F2 — Il narratore inventa dettagli sensoriali.** "Il profumo di pane fresco
appena sfornato riempie l'aria mentre entri" (La Masseria). La blacklist per
termini non regge contro una frase nuova: **limite strutturale dell'approccio,
non una svista**. Serve un criterio diverso (es. ancorare ogni frase a un dato
verificabile del candidato).

**F3 — Il wizard QuickPath è cieco al contesto.** Box fisse Città/Natura/Storia/
Relax; secondo passo con **una sola opzione** ("Centro Storico" a Ippocampo,
"Parchi e Verde" in un villaggio di mare). Il tour non porta al mare perché
**il wizard non permette di chiedere il mare**. È il Gate C Task 2 (box adattive)
del Blocco 3 — e la dimostrazione sul campo che i temi fissi rompono la promessa.

**F4 — Il wizard chiede e poi ignora.** "In coppia" e "Medio (2-4 ore)"
selezionati → tour con 1 tappa, nessuna differenziazione visibile. Chiedere dati
che non contano è una forma di finzione.

**F5 — `"3h m"`** (minuti vuoti) — è il **Task #159**, aperto dal 13/07. One-liner
mai fatto, ora visto di nuovo sul campo.

**F6 — Empty state con promessa falsa.** "Non ci sono ancora tour a Ippocampo.
**Ne stiamo aggiungendo nuovi ogni settimana. Torna presto.**" La seconda frase è
falsa: i tour li genera l'AI dai POI Google, non c'è una redazione che li carica.
**Regola #14 violata** (stessa classe di "il team tecnico è stato notificato").
One-liner.

**F7 — Landing: il Colosseo non si vede su mobile** (solo fondo azzurro). Si
somma al finding 25/07 (il Colosseo contraddice il posizionamento). Due ragioni
per rifarla, e la seconda rende la prima gratis. → Gate ESTETICA.

**F8 — Onboarding da rifare esteticamente** (giudizio Ivano, 15/08). La
tassonomia delle 7 voci è **fissata**, quindi si disegna su struttura definitiva.

### BACKLOG AGGIORNATO 15/08

**Priorità 0 — verifiche pendenti**
- **NARRATORE/POI su città con pool ricco** (Catania o Troina): il filtro è
  troppo stretto? È il pezzo mancante del PASS.
- Camminata con `?debugnav=1` (procedura sticky del 25/07) — invariata.

**Priorità 1 — verità visibile all'utente**
1. **Gate FOTO** (F1) — il place_id della foto deve coincidere con quello del
   POI, altrimenti nessuna foto. Chirurgico.
2. **Gate POOL-VUOTO** (decisione sopra) — raggio esteso a soglia invariata,
   `scaleLevel` propagato, livello 3 rimosso **solo dal path tour**.
3. **F6 + F5** — one-liner, si chiudono insieme a uno dei due sopra.

**Priorità 2 — quelli già in coda**
- Gate HUD presentazione (distanza al maneuver + tempo totale sulla stessa riga
  senza etichette). Diverso dal summary bugiardo del 23/07, che resta aperto.
- Gate CITTÀ (`user_city` interpretato come scelta manuale, `CityContext:32` +
  `useUserContext:23`; `requestGPS` senza watchdog). Diagnosi già fatta 14/08.
- GATE AUDIT SCHEMA (7 occorrenze, prerequisito di PERSISTENZA).
- Gate PERSISTENZA, Gate RLS FASE 2 (aspettarsi un 42P17, lezione #9).

**Priorità 3 — il bivio, ORA CON UN FATTO IN PIÙ**
Nav L2 **vs** Temi Adattivi. Il 15/08 il campo ha parlato: **F3 e F4 mostrano che
il wizard a temi fissi rompe la promessa dell'app in una città reale.** Non
decide al posto di Ivano, ma il fatto è arrivato. Il 15/08 del piano originale è
passato: la data del test privato va rinegoziata sui fatti, non sul piano.

**Priorità 4** — Gate ESTETICA (landing mobile + onboarding), Esplora CC.3, U.2,
`vercel.json` cache policy, cleanup `unnivai_debugnav_log_v1` al logout,
consolidamento delle due liste di regole locked.

---

## Sessione 15/08 (2) — Gate FOTO chiuso, commit `2729068`

### Gate FOTO ✅ PASS DEVICE (parziale)

F1 chiuso. "La Masseria" a Ippocampo mostra la propria foto (place_id),
non più il parco giochi. Puntatori mappa corretti.

Fix: `resolvePoiPhoto(poi, details)` predicato puro condiviso (senza
`googlePlaceId` → null; `details` null → null; URL unsplash → null).
Drawer e popup passano da `fetchPlaceDetailsForTour` via places-proxy
(regola #8, cache `pd_${placeId}` 24h) al posto di `findPlaceFromQuery`.
Rimossa da `POIPopupCard` la clausola `isTourWaypoint` che sovrascriveva una
`googlePhoto` già corretta. `POIPopupCard` ha ora tre stati: lo spinner non è
più infinito (regola #5, fatto PRIMA di togliere la foto).
`MapPage:376` cancellata: `selectedActivity` è una riga di `tours`, non un POI
Google — nessun place_id per costruzione. Foto da `imageUrl` o nessuna.
Titolo protetto quando manca l'immagine (bianco su fondo chiaro).
Regola anti-fake nuova: `no-places-sdk-search-by-name`, allowlist vuota,
provata ROSSA sul codice pre-fix (3 violazioni = i 3 call site esatti).
287 test passed (era 278), 3 skipped, 0 falliti.

Verifica prod: marker positivo (`justify-end px-2 pt-2`, className del ramo
nuovo) trovato in `MapPage-Cd6031H_`; marker negativo `findPlaceFromQuery`
**0** su entry + 75 chunk (era 3); marker di controllo
`unnivai_debugnav_log_v1` trovato (lezione #11 applicata **prima**, non dopo
un falso allarme).

**PERIMETRO DEL PASS**: non verificato un POI senza foto Google (ramo header
compatto); `POIPopupCard` si monta solo su desktop (`MapPage:1995`) e resta
non verificato.

**NON RISOLVE**: F2 narratore inventivo; cover tour Unsplash (Dashboard,
SurpriseTour, `tourShape:369`); `TourDetails:347` src undefined;
`MapPage:1424` `getDetails` (corretto per costruzione, ma client-side fuori
da proxy e cache); restrizioni `VITE_GOOGLE_MAPS_API_KEY`; geocoding
diretto; `no-unsplash-in-content` resta skip.

**NON COPERTO DA TEST** (testuale): il comportamento runtime dei due
componenti — che l'effetto chiami davvero `fetchPlaceDetailsForTour`, che
il flag `cancelled` impedisca il setState dopo lo smontaggio, e che i tre
rami di render di `POIPopupCard` appaiano nelle condizioni giuste; è
coperto solo il predicato puro.

**EFFETTO VOLUTO, non regressione**: due tour su tre a Roma (`tour quartiere
coppedè`, `roma di notte`) hanno `image_urls` vuoto e ora compaiono senza
copertina. Prima mostravano un'Unsplash hardcoded: non è stata rimossa
un'immagine, è stata rimossa un'affermazione falsa.

### FINDING DEVICE 15/08 (2)

**F9 — La notifica propone Capodimonte (Napoli) con utente a Ippocampo,
~200 km.** Formalmente conforme a regola #16 (orario vero), falsa come
proposta. Ipotesi: città stale nel precompute (Gate CITTÀ, diagnosi
14/08) oppure città diversa passata a `generateSystemPrewarmTour`.
Non verificata. **PRIORITÀ ALTA.**

**F10 — Empty state QuickPath: doppia punteggiatura `".:"`** da concatenazione
messaggio+suggerimento. One-liner, con F5 e F6.

Riconfermati sul campo: **F2** (narratore: "profumo di pane fresco",
"odore del mare fresco"), **F3** (box QuickPath fisse, non adattive né alla
città né alle scelte precedenti — **secondo voto del campo** sul bivio
Nav L2 vs Temi Adattivi).

### BACKLOG — riordinato

Questo riordino **sostituisce** l'ordine di Priorità 1 del blocco 15/08 sopra.

1. **Gate CITTÀ** (era priorità 2) — sale **sopra** POOL-VUOTO: se la città è
   sbagliata, allargare il raggio allarga attorno al punto sbagliato.
2. **Gate POOL-VUOTO** (decisione 15/08 invariata).
3. **F5 + F6 + F10** one-liner.

---

## Sessione 15/08 (3) — Sonda dati reali: IL PIANO POOL-VUOTO DEL 15/08 È SUPERATO

6 chiamate Places reali via proxy, filtri importati dal sorgente con `vite-node`
(non reimplementati). Cachate 24h.

### La premessa era sbagliata: il pool non è vuoto

A Ippocampo, query NATURA, `isSmall=true`: **6 risultati, 6 passano
`passesHardExclusions`, 6 sono LIVELLO 1**. `scaleLevel` effettivo = **1**.
Distanze reali (haversine dal centro): **48,7 / 56,4 / 79,5 / 108,8 / 143,9 /
225,2 km**. Nessuno entro 5 km. Il più vicino a 48,7.
`radius=5000` e `radius=10000` danno risultati **BYTE-IDENTICI**: Google ignora
il raggio quando localmente non trova (conferma del bias, non vincolo).

**Conseguenze sui 4 punti della decisione 15/08:**
- **Punto 1** (">=3 qualificati → tour normale") **SCATTEREBBE**, producendo un
  tour di ville comunali a 50-225 km. È F9 sul path tour: distanza calcolata e
  mai usata come filtro.
- **Punto 2** (secondo textsearch allargato) **NON VERREBBE MAI RAGGIUNTO**: la
  condizione "<3" non si verifica. Avremmo scritto codice mai eseguito.
- **Punto 3** (nessun tour + messaggio onesto) irraggiungibile per lo stesso
  motivo.
- **Punto 4** (togliere il livello 3 dal path tour) **UCCIDEREBBE "La
  Masseria"**: 3,6 stelle / 347 rec, soglia FOOD small `minRating 4,2` → fuori
  dal livello 1; livello 2 richiede >=3,8 → fuori anche da lì. L'unico POI vero
  locale sopravvive **SOLO al livello 3**. Risultato: zero tour a Ippocampo, non
  per mancanza di posti, ma perché il posto vero è sotto soglia mentre sei ville
  a 200 km sono sopra.

### La leva non è il raggio: è la query

Stessa città, stesso raggio, query diverse:

| Query | risultati | entro 10 km |
|---|---|---|
| `museo chiesa palazzo storico` | 1 | **0** — l'unico è **Musei Vaticani, 295 km** |
| `parco villa comunale giardino` | 6-9 | 0-2 |
| `trattoria ristorante pizzeria` | 9 | 1 (**La Masseria, 7,0 km**) |
| **`lungomare spiaggia`** | 5 | **5 SU 5** |

Ippocampo è un villaggio balneare: ha lidi, campeggi, spiagge. Il wizard offre
"Centro Storico" e "Parchi e Verde", e il motore cerca ville comunali che lì non
esistono.

**È F3 misurato in numeri**: non più un'impressione di UX, ma la ragione tecnica
per cui l'app non funziona fuori dalle città d'arte. **TERZO voto del campo sul
bivio Nav L2 vs Temi Adattivi**, questa volta con i dati.

### F11 — NUOVO, latente con data di scadenza

`resolveCityCenter('Ippocampo')` **FALLISCE oggi**. `findplacefromtext` torna una
cooperativa a Bergamo (`types: establishment/point_of_interest/school`);
`textsearch` torna 9 risultati, **0** con un type in `ACCEPTED_CITY_TYPES`
(`cityCenterService:74-78`) → throw `not_found` (`:221`).
Per confronto: `'Zapponeta'` risolve (`locality, political`).

Il tour del 15/08 è uscito perché c'era un `cityCenter` in cache (TTL 30 giorni,
`:199`). Quando scade, Ippocampo smette di funzionare del tutto.
**Classe della lezione #9**: un difetto latente perché una protezione (la cache)
lo stava mascherando.

> ⚠️ Precisazione onesta: la causa "cache" è un'**inferenza**, non un dato
> verificato. La sonda ha provato che oggi `resolveCityCenter('Ippocampo')`
> fallisce; *perché* il 15/08 il tour sia uscito comunque non è determinabile
> da qui (cache 30gg oppure stringa città diversa sul device). Si verifica
> leggendo `unnivai_citycenter_*` nel localStorage del telefono.

**Nota aggiuntiva**: centrare su Zapponeta (comune) **scarta Ippocampo**
(frazione) — i lidi stanno a 6,7-7,5 km, cioè **oltre R=5 e dentro R_wider=12**.
Col centro comunale, il filtro stretto eliminerebbe proprio i POI del posto dove
l'utente si trova.

### Cosa resta valido della decisione 15/08

Il principio: **"il motore non abbassa l'asticella, allarga il territorio"**.
Regge. Quello che non regge è il **meccanismo** scelto per attuarlo — il raggio
non è la leva.

### PROSSIMA SESSIONE — un gate da aprire (1) e quattro decisioni (2-5)

1. **Gate TOUR-DISTANZA** — da aprire. La sonda mostra 6 candidati livello 1 a
   48-225 km da Ippocampo. **NON è verificato se arrivino all'utente**:
   `applyRadiusFilter` esiste già a `:1186`, e il difetto potrebbe essere la sua
   **INEFFICACIA** e non la sua assenza. Nota che `:1186` gira su `canonized`,
   cioè **DOPO** la scelta dell'AI: anche filtrando, la chiamata AI è già stata
   pagata su un pool sbagliato. **Prima domanda della Fase 0: le sei ville
   arrivano all'utente sì o no, con prova.**
2. **Cosa diventa POOL-VUOTO**: soglie geografiche? soglie per kind ricalibrate
   (La Masseria)? query adattive?
3. **Il bivio temi adattivi**, ora con i numeri.
4. **F11** — `resolveCityCenter` sulle frazioni.
5. **BLOCCO MAPPA, promosso**: non è estetica, è la superficie del prodotto. Tre
   pezzi distinti: **MAPPA-VERITÀ** (summary che mostra la distanza pianificata
   come camminata, aperto dal 23/07), **MAPPA-NAVIGAZIONE** (HUD: istruzioni
   30-40m late, cursore a scatti, proiezione persa, geofence a 20-25m — test L2-1
   Troina), **MAPPA-IDENTITÀ** (pin di sistema, nessuna identità Unnivai).
   Il freeze Antigravity va sbloccato per la sola **MAPPA-IDENTITÀ**: file
   diversi, non tocca la logica di navigazione.

### LEZIONI OPERATIVE

**#13 — Una sonda sui dati reali prima di implementare un gate costa centesimi e
può invalidare l'intero piano.** Qui ha risparmiato una settimana di codice su
una premessa falsa. Da fare ogni volta che un gate si fonda su un'**ipotesi sul
mondo esterno** ("il pool è vuoto") e non su una lettura del codice.

**#14 — Verifica bundle: TRE marker, non uno.** Un marker di controllo già
deployato (prova che lo strumento funziona), uno positivo per il codice nuovo,
uno negativo per il codice rimosso. Il positivo dev'essere una **stringa
letterale** (className, testo UI), MAI un nome di simbolo.
Aggiunta: usare anche un marker di un **gate precedente** per provare che non è
regredito.

**#15 — Una regola anti-fake che non è mai stata vista fallire non protegge
niente.** Ogni gate che introduce una regola deve provarla **rossa sul codice
pre-fix, nello stesso commit**.

**#16 — Un test verde su un path mai raggiunto è un'assenza travestita da
presenza.** Asserire sull'**effetto osservabile** (il `console.warn` del filtro),
non sul valore di ritorno: un `null` non distingue "filtrato" da "mai arrivato".

---

## Sessione 16/08 — TOUR-DISTANZA, TOUR SENSATO, e la scoperta che i finding sono uno solo

Due gate in produzione (`5663200`, `65428d9`), una sonda su Manfredonia, sei
finding dal campo. E la conclusione che conta più dei sei fix: **non sono sei
problemi, sono uno.**

### Gate TOUR-DISTANZA — commit `5663200`

La Fase 0 ha **smentito la voce di backlog**, che era sbagliata due volte. Il
filtro a `:1216` esiste e funziona: su QuickPath e AiItinerary le sei ville a
200 km **non arrivavano** all'utente. Quello che ha trovato invece:

**Difetto 1 — SurpriseTour senza vincolo geografico.** `applyRadiusFilter` con
`cityCenter` assente ritornava `rawStops` **invariato** (`tourShape:48-50`): un
filtro che si spegne da solo quando manca il dato che gli serve. Stessa classe
del `radius` Places che non vincola e del `distanceMinutes` che non filtrava le
notifiche. SurpriseTour passa `lat/lng` da `useUserContext`, **null in 4
condizioni** (nessuna città risolta, query in volo, città manuale non
geocodificabile, re-verify fallito) → nessun filtro → POI a 200 km a schermo.

**Difetto 2 — il filtro girava 39 righe DOPO la chiamata AI.** Il selettore
(`gpt-4o-mini`, fino a 20 candidati serializzati, il prompt più pesante del
sistema) veniva pagato su un pool poi buttato.

Fix: `opts.requireCenter` (default FALSE, i 4 call site esistenti identici) +
filtro sui `candidates` prima della guardia. `:1216` non toccato, resta la
seconda rete.

**Perimetro dichiarato**: la quota utente si consuma comunque
(`checkAndIncrementQuota` è a `:1111`, **23 righe prima** dei candidati — nessun
filtro sui candidati può recuperarla, correzione a quanto scritto in Fase 0); il
traduttore d'intento è già pagato; `hasGps` a `SurpriseTour:189-190` resta
calcolato e usato **solo per il log**; SurpriseTour continua a usare la
posizione utente come centro città quando il GPS c'è (retrocompat DVAI-055).

### Blocco TOUR SENSATO — commit `65428d9`

Origine: device Ippocampo, SurpriseTour, 4 tappe — Beach Club, Spiaggia, La
Masseria, **"VILLAGGIO IPPOCAMPO - Supercondominio"** — con categorie
CULTURA/RELAX/FOOD/NATURA. Tre tappe su quattro erano lo stesso tratto di
litorale, la quarta un condominio, e nessuna categoria corrispondeva al luogo.

**F13 — un condominio entrava nel tour.** Types reali (sonda Places): condominio
e B&B hanno `[establishment, lodging, point_of_interest]` — nessuno tocca
`BLACKLIST_TYPES` né `GEO_ENTITY_TYPES`. Ma `lodging` sta **anche** su Beach Club
e Spiaggia: **la tassonomia Google dice chi ha registrato il posto, non cosa è.**
Una lista secca non discrimina. Fix: `NON_VISITABLE_TYPES` + `VISITABLE_TYPES`,
regola **condizionale** — scarta solo se non c'è nessun type di visita accanto.

> **FALSO POSITIVO NOTO E ACCETTATO**: "Spiaggia Ippocampo di Manfredonia" ha
> gli **stessi** types del condominio — su Google è registrata come alloggio,
> nessun `natural_feature`. **Viene scartata.** È nel test come comportamento
> atteso, con l'asserzione che i types sono identici, più il test complementare:
> un `lodging` con `natural_feature` sopravvive senza toccare codice.

**F14 — Google è l'autorità sulla categoria, non l'AI.** Il Beach Club era
CULTURA perché il modello ha scritto quella parola. Il prompt chiede
`cultura|storia|food|relax|arte|natura`, `mapGoogleTypeToOurType` produce
`museum|church|park|restaurant|monument|place`: **due vocabolari**, riconciliati
solo a valle da `CATEGORY_ALIASES`. `:1074` da `s.type || c.type` a
`c.type || s.type`, dopo aver verificato che ogni valore Google-derived ha un
alias.

**F16 (solo il dato) — `open_now` entra nel prompt.** Il prompt diceva *"MAI
suggerire posti chiusi ora"* ma `candidatesLite` non portava gli orari: un
vincolo che il modello non poteva rispettare. Google restituisce
`opening_hours` su **tutti** i risultati della textsearch a costo zero (sonda:
20/20 su Manfredonia), e `buildPOIFromCandidate` lo scartava. Se il dato manca,
la chiave viene **omessa**: `false` o `null` inventerebbero un fatto. Nessuna
chiamata `place/details` aggiunta — `closingTimeTodayHH` sarebbero 20 chiamate
per tour.

**F18 — una lettura che era sempre `undefined`.** `aiRecommendationService:1898`
leggeva `p.opening_hours?.open_now`, campo che `buildPOIFromCandidate`
eliminava; il `?? null` lo mascherava. Il ramo `c.open_now === false → "chiuso
ora"` **non scattava MAI**: un silenzio, non un errore. Provato rosso sulla
lettura vecchia e verde con il fix.

319 test passed (era 303), 3 skipped, 0 falliti.

### La sonda Manfredonia — e la domanda che resta aperta

`resolveCityCenter('Manfredonia')` **risolve al primo tentativo**
(`41.62999, 15.91731`, types `[locality|political]`), a differenza di Ippocampo.
`isSmallTown = true` → raggio 5 km.

| tema | totali | hard | **L1** | dopo raggio | scaleLevel |
|---|---|---|---|---|---|
| **FOOD** | 20 | 20 | **16** | **16** | **1** |
| CULTURA | 6 | 6 | 5 | 4 | 1 |
| NATURA | 1 | 1 | **0** | 1 | **3** |

**16 ristoranti di livello 1, tutti entro 2,8 km.** Il pool gastronomico di
Manfredonia è pieno e vicino: la catena arriva intatta al selettore AI e in
nessun punto verificabile l'array va a zero.

> ⚠️ **NON SPIEGATO, RESTA APERTO**: sul device il tour gastronomico a
> Manfredonia **non usciva comunque**. La sonda si ferma al selettore — cosa
> scelga `gpt-4o-mini` fra 16 candidati non è determinabile senza chiamarlo, e
> non è stato fatto. Il difetto è **oltre** il punto che la sonda copre.

Due osservazioni di qualità dalla stessa sonda: **"B&B Centro Storico"** entrava
fra i 5 POI culturali di livello 1 (ora scartato da F13), e **"VisitManfredonia"**
con 1 recensione è probabilmente un ufficio turistico. Il pool culturale reale
era **4**, non 6.

E la classificazione small/large **non è una leva**: se Manfredonia fosse
`large`, FOOD scenderebbe da 16 a 14 e NATURA resterebbe 0 (l'unico risultato
fallisce sul **rating**, non sulle recensioni).

### REGOLA LOCKED #18 — `open_now` è un vincolo, mai un'affermazione

**`open_now` è un vincolo per il motore, mai un'affermazione all'utente.**
`openNow` da Google è inaffidabile per bar e ristoranti (già registrato). Può
**filtrare candidati** ed **entrare in un prompt come vincolo negativo**; non può
comparire — né letterale né parafrasato — in una stringa che l'utente legge.
Per dire all'utente qualcosa sull'apertura serve `closingTimeTodayHH`, che è un
fatto con un orario.

Sul path notifiche `"chiuso ora"` entra **oggi** nel prompt del messaggio
(`:1968-1975`): **da verificare che non finisca parafrasato nell'output.**
**Non protetto da codice — candidato a regola anti-fake.**

### LEZIONE OPERATIVA #17 — il marker nuovo può finire in un chunk lazy

Fino a oggi ogni marker positivo era nell'**entry**, perché
`aiRecommendationService` è bundlato lì. `[Gate TOUR-SENSATO]` vive in
`placesDiscoveryService`, che ha **un chunk suo**: in produzione compare in
`placesDiscoveryService-*.js` e **zero volte nell'entry**.

Cercarlo nell'entry avrebbe dato un falso negativo — la lezione #11 in una forma
che non avevamo ancora incontrato. **Il marker va cercato dove vive il file che
lo contiene, non dove vivevano i marker precedenti.**

Verifica del deploy di oggi, tre marker: controllo `unnivai_debugnav_log_v1`
→ `MapPage-_wnuvVqm.js × 1`; controllo `[Gate TOUR-DISTANZA]` → `entry × 2`
(nessuna regressione); positivo `[Gate TOUR-SENSATO]` →
`placesDiscoveryService-D3vyJj_V.js × 1`.

### ⚠️ Numerazione finding: F12 e F17 non esistono

Verificato: **zero occorrenze** di `F12` e `F17` in tutto l'handoff, e nessuna
definizione in sessione. La numerazione va da F11 a F13 e da F16 a F18 con due
buchi. Non li ho inventati per riempirli: se corrispondono a qualcosa di
osservato e non registrato, vanno scritti; altrimenti i buchi restano e vanno
saputi.

---

## ⭐ LA COSA PIÙ IMPORTANTE — i sei finding sono UNO

F13 (un condominio nel tour), F14 (categorie che non corrispondono), F15 (tre
tappe sullo stesso posto), F16 (nessun ordine orario), F3 (box fisse), F4 (il
wizard chiede e ignora) **non sono sei problemi indipendenti**.

**Il motore fa liste, non giornate.**

Sceglie N posti che superano una soglia, li ordina per vicinanza geografica, e
li serve. Non sa che una giornata ha un ritmo, che un ristorante ha senso
all'una e un belvedere al tramonto, che tre tappe sullo stesso litorale sono una
tappa sola, che una categoria è una promessa su cosa troverai.

Ogni fix di oggi ha tolto un modo di sbagliare dalla lista. **Nessuno ha
trasformato la lista in una giornata.**

### Il prossimo è UN BLOCCO SOLO: **TOUR = GIORNATA**

Non sei gate. Un blocco, con dentro:

1. **Ordine per orario** invece che per vicinanza. Oggi `sortByProximity`
   (`:1218`) **riscrive** la scelta narrativa dell'AI — il prompt le chiede un
   percorso *"che abbia senso NARRATIVO, non solo geometrico"* (`:834-836`) e il
   codice subito dopo la sovrascrive con un nearest-neighbor greedy.
2. **Durate vere**. `suggestedMinutes` è inventato dal modello e defaultato a 30
   in **due** punti (`:1073`, `tourShape:321`). O diventa un dato, o non deve
   comparire come se lo fosse.
3. **Dedup per prossimità**. Oggi il dedup è **solo su `place_id`**
   (`:742-751`): tre POI a 200 metri con "Ippocampo" nel nome hanno tre id
   distinti e passano tutti e tre. Sono le tappe 1, 2 e 4 del device.
4. **Stessa forma su QuickPath / SurpriseTour / Per Te**. Tre path che oggi
   divergono su cityCenter, su `suggestedTransit`, sui guard.

**E il motore sa già farlo su un path**: il titolo *"Manfredonia che non dorme
mai"* lo dimostra. Non è un problema di capacità del modello — è che il codice
attorno non gli chiede una giornata e gli riscrive l'ordine.

---

## Sessione 18/08 (2) — Gate VERITÀ VISIVA (F26), parte 1 in produzione

Commit **`5deca9c`**. Diff 1-3 di 6: `tourShape`, `POIDetailDrawer`,
`POIPopupCard`, `MapPage`.

### Il difetto osservato

Mappa Esplora a schermo intero, Ippocampo (Manfredonia). Il POI *"Manfredonia
Ippocampo — Viale Picardi 25"* mostrava **una foto del Colosseo**. Nella stessa
sessione "Cornetteria XXL" e "Beach Club Ippocampo" avevano la foto giusta.

### La causa: il predicato funzionava, era il codice intorno a ignorarlo

Il Gate FOTO (`2729068`) aveva introdotto `resolvePoiPhoto(poi, details)` come
predicato puro. Faceva il suo lavoro. Veniva scavalcato in quattro punti:

| punto | file:riga | cosa faceva |
|---|---|---|
| il seme | `POIDetailDrawer.jsx:15` | `useState(poi.image \|\| poi.image_urls?.[0])` — la foto falsa era nello stato **prima** di ogni verifica |
| la guardia | `:25` | `!displayImage.includes('unsplash.com')` — test **per esclusione**: lasciava passare qualunque altro URL inventato |
| l'uscita | `:26` | `if (!poi?.googlePlaceId) return` — silenzioso, il valore ereditato sopravviveva per inerzia |
| **il null scartato** | `:36` | `if (url) setDisplayImage(url)` — senza `else`. Quando `resolvePoiPhoto` faceva esattamente il suo lavoro, il verdetto veniva buttato e il falso restava a schermo |

E la sorgente del Colosseo: **`tourShape.js:13`**, `STEP_FALLBACK_IMAGE =
photo-1552832230-c0197dd311b5`, assegnato a `:287` a **ogni tappa senza foto
reale** e a `:396` a **ogni copertina**. Il repo lo dichiarava da sé
(`imageUtils.js:84`: `// Colosseum / Palatine Hill`).

`MapPage.jsx:1418` era il moltiplicatore: il POI nativo portava `id: place.place_id`
ma **non** `googlePlaceId` — quindi su quei POI `resolvePoiPhoto` non veniva
**mai** invocato.

### Decisione di prodotto (Ivano)

- **Schede POI** → nessuna immagine senza foto Google ancorata al place_id.
  Modello: `MapPage.jsx:360-367`.
- **Copertine tour** → gradient categoria + glifo. Modello: `TourCover.jsx:36-63`.
- Discriminante: *sul POI l'immagine pretende di essere QUEL posto. Sulla
  copertina no.*

### Fatto

- `tourShape`: via `STEP_FALLBACK_IMAGE`; `imageSource` `'fallback'` → `'none'`;
  la catena della cover finisce a `null` (`TourCover` cade nel ramo B da sé —
  `isPlacesPhoto(null) === false`).
- `POIDetailDrawer` / `POIPopupCard`: quattro punti ciascuno. La guardia ora è
  `isPlacesPhoto` — **test per inclusione**, stesso discriminante di `TourCover`
  (regola locked #8, un motore solo). Il null è **onorato**.
- `MapPage`: `googlePlaceId` portato sul POI nativo (`:1394`, `:1421`); via gli
  unsplash a `:247`, `:1397`, `:1411`. Il contenitore partner conserva un fondo
  neutro perché porta quattro elementi veri oltre alla foto (X, badge, nome,
  indirizzo in overlay bianco).

Suite 341 verdi. CI verde (Lint & Test 36s, E2E 83s).

### Marker sul bundle SERVITO (non sul dist locale)

| marker | pre `771f94e` | post `5deca9c` |
|---|---|---|
| `photo-1555396273-367ea4eb4db5` | 1 | **0** |
| `photo-1552832230-c0197dd311b5` | 6 | **5** |
| `[Gate NARRATORE/POI]` | 2 | 2 |
| `È visibile alle guide registrate su DoveVAI` | 1 | 1 |

Il 6 → 5 è il risultato **atteso**: il chunk che ha perso il Colosseo è quello
di `tourShape`, provato incrociando i due bundle e confermato direttamente (il
chunk con `[Gate TOUR-DISTANZA]` ora contiene il Colosseo 0 volte). Le 5 residue
sono `imageUtils`, `QuickPath`, `SurpriseTour`, `DashboardGuide` — assegnate ai
diff 4-5 — e `Landing.jsx:520`, che è uso dichiarato e non si tocca.

**Effetto reale già in produzione**: il Colosseo non può più comparire su
nessuna tappa né su nessuna copertina. È la superficie del difetto osservato.

### Restano da fare in F26

- **DIFF 4** — `getItemImage` (`imageUtils.js:133-169`, consumato da
  `TourDetails.jsx:828`), catena `DashboardUser.jsx:23/326/335`
  (THEME → CITY → GENERIC), `QuickPathSummary.jsx:8`, `Explore.jsx:349`
  (`placehold.co`), hero `PlaceDetailsView` (`TourDetails.jsx:346`).
- **DIFF 5** — mappe locali duplicate: `SurpriseTour.jsx:9-15`,
  `DashboardGuide.jsx:978`, `locationTourService.js:64/78`. Da misurare prima:
  se quei dati demo sono raggiungibili da un path utente. Se sono morti, non si
  toccano.
- **DIFF 6** — riattivare `no-unsplash-in-content` (`anti-fake.test.js:136`,
  oggi `skip: true`) svuotando l'allowlist (`:123-131`), più una **regola
  strutturale** contro `if (url) setX(url)` senza ramo `else`: il difetto
  osservato non era un URL sbagliato, era un null ignorato. Entrambe da provare
  **rosse** sul codice pre-gate. `Landing.jsx:520` va esentato per nome, non per
  categoria.

### Esito test device — F26 diff 1-3

| punto | esito |
|---|---|
| **1 — scheda POI mappa** | **NON TESTATO** (non "bloccato"). Il guard è verificato nel bundle servito, ma la scheda POI **non è apribile** a causa di F38. Il caso osservato — il Colosseo su Viale Picardi — **resta aperto** finché non lo si vede su device. |
| **2 — `/tour-details`** | **PASS.** 6 immagini, tutte caricate, `naturalWidth` 600, nessuna rotta. **Le foto vere non sono state toccate.** È il test che conta più del punto 1: prova che il gate non ha spento anche ciò che funzionava. |
| **3 — tappe senza foto** | **PASS strutturale.** Tutte e 3 le tappe avevano foto vera, quindi il ramo "senza foto" **non si è attivato**. Nel bundle il fallback esiste (`onError` → `display:none` + div gradient). Non è una verifica del ramo, è una verifica della sua presenza. |

Il punto 2 vale più del punto 1 perché un gate che rimuove immagini false ha un
solo modo di fallire davvero: rimuovere anche quelle vere. Quello è stato
misurato, e non è successo.

### Nota tecnica per il DIFF 4

Restano **due** condizioni `includes('unsplash.com')` scritte a mano che **non**
passano da `isPlacesPhoto`:

- `MapPage.jsx:367` — `activityPhotoUrl` (che è anche il *modello* citato nella
  decisione di prodotto)
- `poiPhoto.js:40` — dentro `resolvePoiPhoto` stesso

> Correzione al brief: non sono entrambe in MapPage. Misurato con
> `grep -rn "includes('unsplash"` su `src/`, escludendo i test: le occorrenze
> fuori da `isPlacesPhoto` sono esattamente queste due, una per file.

L'allowlist di host esiste già (`categoryPalette.js:75`, `PLACES_URL_PATTERNS` a
`:68-72`) ed è quella che i drawer usano dal DIFF 2. **Non serve un predicato
nuovo: serve che anche quelle due ci passino.** Un motore solo (regola locked #8).

Il punto non è stilistico: **una allowlist di host non si bypassa aggiungendo un
provider di stock; una blocklist sì.** Oggi basta che qualcuno introduca
`pexels.com` o `picsum.photos` perché entrambe quelle condizioni lo lascino
passare come se fosse una foto vera.

### Nuovi finding aperti

> **Sintesi**: in questa sessione sono registrati **F27-F41**. `F26` è il nome
> del **gate** (VERITÀ VISIVA), non un finding — il messaggio di commit
> `c66d4d6` dice "F26-F41" ed è impreciso, ma è già pushato e non si riscrive
> la storia per un refuso: la versione corretta è questa riga.

**Difetti di contenuto — cosa entra in un tour**

- **F27 — un indirizzo stradale entra come tappa.** *"Manfredonia Ippocampo -
  Viale Picardi 25"* è finito dentro un tour come tappa. `VISITABLE_TYPES` non
  lo scarta. È lo stesso POI del difetto foto di F26: un indirizzo non è un
  posto visitabile, e prima ancora di non avere una foto vera non doveva
  esserci.

- **F33 — quattro tappe di fila tutte FOOD**, 60/45/60/60 min. Non è una
  giornata, è una lista di ristoranti. **Confluisce in TOUR = GIORNATA.**

- **F35 — un tour con UNA sola tappa esce comunque**: *"1 TAPPE — 3h"*, un
  camping. Serve una **soglia minima** di tappe sotto la quale il tour non si
  produce (e l'empty state onesto esiste già).

**Difetti di contesto — l'app non guarda dove/quando sei**

- **F31 — city-lock confermato su device**: la posizione è passata da Ippocampo
  a **Foggia da sola**. **Distinto da F38**: qui è la **città che cambia da
  sola**; in F38 è la **mappa che non segue** la città selezionata. Due sintomi
  vicini, da non fondere prima di aver misurato.

- **F28 — fascia oraria preselezionata "Mattina 08:00-12:00" alle 21:10.**
  Il wizard non guarda l'orologio.

**Difetti di copy e di stato del controllo**

- **F29 — "1 tappe programmate"**: plurale non gestito (`AiItinerary`).
- **F36 — "1 TAPPE"** nel riepilogo QuickPath: **stesso plurale di F29,
  superficie diversa**. Da chiudere insieme, o si riapre sul terzo path.
- **F30 — categoria "Avventura Culturale" → bottone "Genera esperienza Arte".**
  L'etichetta scelta e l'azione offerta non coincidono.
- **F34 — bottone "Crea il tuo percorso" grigio spento** nell'empty state
  Esplora: è **l'unica azione della pagina** e sembra disabilitato. (È il
  bottone introdotto dal Gate PULIZIA, DIFF 5 — il testo è giusto, lo stile
  contraddice l'invito.)

**Difetti di layout**

- **F32 — testo che tocca i bordi** nelle schede tappa, parole tagliate a
  sinistra (*"calda"* → *"cala"*).

**Difetti già dettagliati sopra**

- **F37 — `POIPopupCard.jsx:49-50`**: `rating` default `4.5` e
  `user_ratings_total` generato con `Math.random()` **a ogni apertura**. Numeri
  fabbricati a runtime: più grave dei default fissi, perché cambiano tra due
  aperture dello stesso posto. Il commento sopra dice già *"Fake rating"*.
  **Da chiudere nel gate subito dopo F26.**

- **F38 — `/map` ignora la città selezionata. PRIORITÀ ALTA.** L'header dice
  "Manfredonia", la mappa è centrata su **Roma** (default hardcoded).
  Selezionando "Ippocampo" dall'autocomplete la mappa **non si muove**.
  Blocca la verifica device di F26 (la scheda POI del difetto non è
  raggiungibile) **e** blocca metà del blocco MAPPA. È il prossimo lavoro utile:
  senza F38 il punto 1 di F26 resta non verificabile.

- **F39 — deep link tour rotti.** Gli ID sono timestamp di sessione (es.
  `home-romance-1787088869446`); l'URL diretto dà *"Questo tour non esiste più"*.
  Esiste un pulsante **Condividi** che condivide un link morto.
  **Decisione Ivano: il Condividi si SPEGNE, non si ripara** — stessa sorte di
  "Prenota Esperienza". La riparazione vera è **GATE PERSISTENZA TOUR**, che
  dipende da **GATE AUDIT SCHEMA** (schema mismatch sistemico, già noto).

- **F40 — modale "Dove ti trovi?"** si riapre a **ogni** navigazione e blocca il
  click; **Escape non la chiude**. Stato non-uscibile → regola locked #7.

- **F41 — sessione sloggata da sola** durante il test.

### TEST DEVICE — F38 + F26 punto 1

Deployment `Bf65671jg`, commit `29f4a2c`.

**F26 punto 1: PASS.** Tappa con foto Google vera, nessun Colosseo.
**Il caso osservato — il Colosseo su "Manfredonia Ippocampo - Viale Picardi 25" —
è chiuso su device.** Era rimasto non verificato dal giro precedente perché F38
rendeva la scheda POI irraggiungibile: la sequenza F38 → F26 era corretta.

**F38: PARZIALE.**

| | esito |
|---|---|
| **funziona** | la mappa **dentro Esplora** segue la città: Milano → Milano, Ippocampo → Ippocampo. Prima era **sempre** Roma. |
| **non funziona** | **a schermo intero** l'header dice "Foggia" e la mappa resta su Milano. Cambiare città dalla barra **dentro la mappa espansa** non la muove; cambiarla dalla **home** sì, e poi Esplora la segue. |

Diagnosi Ivano: `manualCenter` viene scritto ma **quella superficie non lo
osserva**. Il DIFF 1 ha sistemato il **centro iniziale**, non la **selezione
dall'interno** della mappa.

> ⚠️ **Prima di implementare F38-bis, identificare la superficie — non assumere
> che sia `MapPage`.** È esattamente la lezione della D1 di questo gate ("non
> assumere che sia POIDetailDrawer: verificalo"). Il fatto che la barra dentro
> la mappa espansa si comporti diversamente da quella della home suggerisce due
> istanze o due componenti distinti. Va misurato, non dedotto.

Registrato come **F38-bis**, coda dello stesso gate.

### FINDING NUOVI

- **F45 — il quiz adatta le opzioni solo per le grandi città.** A Napoli compare
  "siti vulcanici"; nei piccoli centri restano le quattro box fisse. **Conferma e
  precisa F3/F24**: esistono profili per capoluogo. (Il codice lo mostra:
  `QuickPath.jsx` ha un profilo `'default'` con 4 sub-opzioni fisse — vedi F26 D2,
  dove `'Centro Storico'` / `'Monumenti e piazze principali'` sono proprio quelle.)

- **F46 — il Diario mostra un tour a 221,9 km** (*"I colori e i volti di Napoli"*)
  mentre l'utente è a Ippocampo. **Il Gate TOUR-DISTANZA copre la generazione, non
  il Diario.** Stessa card: **"1 Tappe"** — cioè **F35 + F36 insieme**, la soglia
  minima mancante e il plurale non gestito sulla stessa superficie.

### INFRASTRUTTURA

Deploy sbloccato con **redeploy manuale** su `29f4a2c`: **19s**, contro i 3m06 dei
tentativi Canceled. Il gate ha trovato la CI **già 3/3 completa** e ha proseguito
al primo tentativo — il che esclude il PAT e conferma il timeout.

- **F43 — `vercel-ignored-build-step.sh`.** `MAX_ATTEMPTS=18` (~3 min) era tarato
  su una E2E da 50s che ora ne impiega 234. **Ma alzarlo da solo non basta**: il
  difetto vero è la logica `total/in_progress` — con "nessuna in_progress" il gate
  passerebbe **mentre le check non sono ancora registrate**, cioè un fail-closed
  che diventa **fail-open**. Serve: *settle period*, **lista delle tre check attese
  per nome**, e **exit code distinti** per timeout vs CI rossa (oggi producono lo
  stesso Cancel muto).
  Diventa un gate a sé **dopo** il test device, non mentre la produzione è appena
  ripartita.

- **F44 — la E2E è quadruplicata in quattro commit**: 50s → 83s → 3m06 → 3m54.
  Causa sconosciuta. Secondo finding a sé, indipendente da F43: F43 è il gate che
  non regge il tempo, F44 è il tempo che cresce.

### LEZIONI OPERATIVE

*(La numerazione prosegue da **#17**, `Sessione 16/08`. Non esiste una lezione
#18: il `#18` già presente nell'handoff è una **regola locked**, serie diversa.)*

**#18 — Un predicato corretto non protegge niente se il chiamante ne scarta il
verdetto.** `resolvePoiPhoto` funzionava, aveva 8 test verdi ed era condiviso da
due componenti. Mostrava comunque il Colosseo, perché a valle stava scritto
`if (url) setDisplayImage(url)`: quando il predicato rispondeva `null` — cioè
quando faceva esattamente il suo lavoro — la risposta veniva buttata via.
Quando si introduce un predicato di verità, **testare anche che il suo `null`
venga onorato**, non solo che il `null` venga prodotto. Il test del valore di
ritorno e il test dell'effetto sono due test diversi (vedi #16).

**#19 — Allowlist di host, mai blocklist.** La guardia era
`!url.includes('unsplash.com')`: un test **per esclusione**, che rispondeva "non
è unsplash" e concludeva "allora è vera". Sostituita da `isPlacesPhoto(url)`,
test **per inclusione** su un elenco di host Google. La differenza non è
stilistica: **una allowlist non si bypassa aggiungendo un provider di stock, una
blocklist sì.** Vale per URL, per tipi Places, per qualunque cosa si stia
filtrando: elencare ciò che è ammesso, non ciò che è vietato.

**#20 — "NON TESTATO" non è "bloccato", e nessuno dei due è "PASS".** Il punto 1
del test device di F26 non è stato eseguito perché F38 rende la scheda POI
irraggiungibile. Scriverlo "bloccato" avrebbe suggerito che il codice è a posto
e l'ambiente no; scriverlo "PASS" sarebbe stato falso. **Un caso osservato su
device si chiude solo rivedendolo su device.** Corollario emerso lo stesso
giorno: quando un gate *rimuove* qualcosa, il test che conta di più è quello che
prova che **non ha rimosso anche il resto** (punto 2, le 6 foto vere ancora
caricate) — non quello sul difetto originale.

> **Aggiornamento 19/08**: la lezione #20 ha avuto la sua conferma. Il punto 1 è
> stato eseguito dopo F38 ed è **PASS**. Il "NON TESTATO" era corretto: il codice
> era a posto già dal 18/08, ma dichiararlo chiuso sarebbe stato falso per un
> giorno intero.

**#21 — Un HTTP 200 su un asset non prova che l'asset esista.** Il fallback SPA
risponde **200 a qualunque path**, con lo stesso `index.html`. Durante lo sblocco
del deploy di F38 stavo per dichiarare "deploy avvenuto" perché il chunk nuovo
rispondeva 200: era `text/html`, **690 byte**, identico byte per byte alla
risposta per un hash **inventato**. Verificare sempre **content-type e
dimensione**, o confrontare con un hash che non può esistere. Vale per ogni
verifica su un bundle servito — cioè per il marker check di **ogni** gate (#14).
Corollario: scaricando N chunk per un `grep`, controllare che siano **tutti JS**.
Un chunk servito come HTML darebbe zero occorrenze del marker negativo, e il
gate risulterebbe passato per il motivo sbagliato.

---

### Fuori da F26, dichiarato

- **D6 / `enrichMonuments`** (`MapPage.jsx:598` → `aiRecommendationService.js:1781`):
  riceve **solo `name` e `type`** — niente place_id, niente coordinate — e scrive
  il risultato in `poi.description` (`:609`), che è ciò che la scheda rende sotto
  "PANORAMICA". Su un indirizzo stradale ha prodotto *"Il profumo del mare si
  mescola alla salsedine, mentre i gabbiani volano sopra le onde."* È un
  **percorso e un prompt separati** da quelli delle descrizioni tappa
  (`DOVEVAI_NARRATOR_PROMPT:10` vs `buildSelectorSystemPrompt:791`).
  **Non è in questo gate.**

---

## Sessione 21/08 — Gate F43 CHIUSO: il gate CI decide sui job per nome

Commit **`607f249`**. Tre file: `vercel-ignored-build-step.sh` riscritto,
`scripts/ci-gate-parser.mjs` e `src/test/ci-gate-parser.test.js` nuovi.

### I tre difetti, in ordine di scoperta

**1 — conteggio dei workflow_run invece dei job per nome.** Nel repo esiste
**un solo** workflow (`.github/workflows/ci.yml`, name `"CI"`), quindi
`/actions/runs?head_sha=` restituisce `total_count = 1`, **non 2**. I due job
`"Lint & Test"` ed `"E2E Smoke"` vivono solo in `/actions/runs/{id}/jobs`,
endpoint che il gate **non chiamava mai**. Conseguenza: *"nessun run
in_progress"* veniva letto come *"CI verde"* anche nella finestra in cui le
check non sono ancora registrate. **Alzare il solo timeout avrebbe reso quella
finestra più probabile, non meno: un fail-closed che diventa fail-open.**

**2 — budget contato in tentativi, non in wall-clock.** `18 × 10s` non
significava 180s: il tempo delle chiamate non entrava nel conto.

**3 — `curl` senza timeout.** Una chiamata appesa **35s** ha portato una fase da
30s a **69s**. Con `curl` illimitato il tetto reale **non esisteva**.
Emerso **solo nel dry-run contro l'API vera** — i 22 unit test erano tutti verdi.

### I numeri, tutti misurati

| | |
|---|---|
| durata CI storica (40 run) | mediana **93s**, p90 **126s**, coda **228-277s** |
| dry-run ALL_GREEN | `exit=1` in **2-3s**, entrambi i nomi job nel log |
| dry-run CI_FAILED | `exit=0` in **2s**, con nome job e `html_url` |
| dry-run NOT_REGISTERED | `exit=0` in **30s esatti**, 3 ripetizioni su 3 (prima: 69s) |
| dry-run API_UNREACHABLE | `exit=0`, **6/6 chiamate scadute** (forzato con `CURL_MAX_TIME=0.1`) |
| run di chiusura | totale **106s** — Lint & Test 43s, E2E Smoke **56s** |
| deploy `607f249` | **Ready, 2m 1s**, Production |

### Marker

`ALL_GREEN` · `CI_FAILED` · `NOT_REGISTERED` · `TIMEOUT_JOB_PENDING` ·
`MISSING_EXPECTED_JOB` · `RATE_LIMITED` · `API_UNREACHABLE` · `AUTH_ERROR` ·
`HTTP_ERROR` · `PARSE_ERROR` · `NO_TOKEN` · `NO_SHA`

Ultima riga, su **ogni** percorso di uscita:
```
GATE_VERDICT exit=<0|1> REASON=<marker> elapsed=<Ns> chiamate: N, scadute: M
```
**Vercel legge solo exit 0/1**: la diagnosi vive nel marker, non nell'exit code.
`TIMEOUT_JOB_PENDING ≠ CI_FAILED` e `RATE_LIMITED ≠ AUTH_ERROR` sono coppie che
prima producevano lo stesso identico Cancel muto.

### Esito in produzione — parte osservata, parte dedotta

**Osservato** (Ivano, dashboard Vercel): deployment su `607f249` → **Ready,
2m 1s, Production**.

**Dedotto, non osservato**: Ready implica `exit=1`, e nel codice nuovo `exit=1`
ha **un solo percorso** — `PROCEED` / `ALL_GREEN`. Quindi il gate ha letto i job
per nome e ha lasciato passare.
**La riga `GATE_VERDICT` dal log di build NON è stata letta: l'`elapsed` reale in
ambiente Vercel resta non misurato.**

### FASE 5a — lo stato del deploy È leggibile dall'esterno

Misurato, con controllo positivo su uno SHA storico:

```
GET /repos/{owner}/{repo}/commits/{sha}/status
  → state: "success", statuses[].context == "Vercel"
GET /repos/{owner}/{repo}/deployments?sha={sha}
  → environment "Production", created_at
```

Controllo positivo su `29f4a2c`: `target_url` contiene
`…/unnivai/Bf65671jgwHkXFBo` — **lo stesso ID che Ivano aveva letto sulla
dashboard**. Su `607f249`: `state: success`, deployment `6017826612`.

**Permesso richiesto: nessuno.** Il repo è pubblico e la chiamata funziona
**senza token** (HTTP 200, `state: success`), con il rate limit anonimo di
60 req/h. Con token si ottiene in più il `target_url` con l'ID del deployment.

**Limite:** GitHub registra **un solo** `deployment_status` (`success`), senza
un record `pending`. Quindi lo **stato finale** è leggibile, la **durata** no.

### VOCI APERTE

- **F44 — riformulato, non chiuso.** Vedi sotto.
- **Lezione #10 intatta**: il gate resta muto fuori dai log di build Vercel.
  **Ma ora esiste `GATE_VERDICT`, marker stabile e grepabile, e la 5a dimostra
  che lo stato del deploy è interrogabile senza token.** È la materia prima per
  chiuderla — **non è ancora chiusa**.
- **`RATE_LIMITED` provato solo dagli unit test**, mai dal campo.
- **`elapsed` reale del gate in Vercel non misurato.**
- **Scadenza del PAT non monitorata.**
- **eslint `globalIgnores` su `scripts/` e `src/test/`**: i due file nuovi non
  sono analizzati. "Lint pulito" su di loro non prova nulla.
- **`note_call` viene chiamata dopo `deny_and_exit`**: su un'uscita per 403 i
  contatori dicono "chiamate effettuate", non "previste". Nessun effetto sui
  verdetti — `API_UNREACHABLE` si valuta solo sui percorsi di deadline.

---

## F44 — RIFORMULATO (era: "la E2E è quadruplicata in quattro commit")

**La formulazione precedente era sbagliata e va sostituita, non integrata.**
Descriveva quattro punti scelti male.

Serie reale di `E2E Smoke`, sei punti:
**52 → 83 → 186 → 234 → 56 → 84**.

Non è una crescita monotona: è **bimodale**. Due regimi netti — ~50-85s e
~186-234s — senza valori intermedi. Il fenomeno da spiegare non è "perché
cresce" ma "perché a volte impiega 3-4× la mediana".

### Ipotesi cache Playwright — ESCLUSA CON I DATI (21/08)

Non "non confermata": **smentita**. L'ipotesi era che i run lenti pagassero un
cache miss dei browser (~93 MB di download).

| run id | E2E | chiave | esito | `cache not found` |
|---|---|---|---|---|
| `32275949454` | **186s** | `playwright-Linux-1.61.1` | restored | 0 |
| `32296513827` | **234s** | `playwright-Linux-1.61.1` | restored | 0 |
| `32136719605` | 52s | `playwright-Linux-1.61.1` | restored | 0 |
| `32186339414` | 83s | `playwright-Linux-1.61.1` | restored | 0 |
| `32461361555` | 56s | `playwright-Linux-1.61.1` | restored | 0 |
| `32492356855` | 84s | `playwright-Linux-1.61.1` | restored | 0 |

**Stessa chiave, stessa dimensione al byte (`273964501 B`), `Cache restored
successfully` in tutti e sei, zero `cache not found` — inclusi i due lenti.**
Se la causa fosse la cache, i due sopra i 180s avrebbero dovuto mostrare un
miss. Non lo mostrano.

**Campo ristretto:** il ripristino della cache costa **15-20s in entrambi i
regimi** (run da 186s: job alle 16:27:31, cache ripristinata alle 16:27:51; run
da 56s: 08:03:48 → 08:04:03). Quindi i ~150s di differenza si accumulano **dopo
la cache** — dentro l'esecuzione dei test o nel bootstrap del browser.
**Causa ignota, ma il campo è più stretto di prima.**

### F44 CHIUSO COME FINDING (21/08) — non come gate

**Non è "E2E lenta". Non lo è mai stata.**

Scomposizione per step del job `E2E Smoke`, run `32296513827` (234s) contro
`32461361555` (56s). Tredici step per parte, **stessi nomi**, confrontabili uno
a uno:

| step | lento | veloce | delta |
|---|---:|---:|---:|
| **Install Playwright chromium** | **189s** | **16s** | **+173s** |
| Setup Node.js 22 | 12s | 7s | +5s |
| Run E2E smoke tests | 13s | 12s | +1s |
| **Cache Playwright browsers** | **5s** | **5s** | **0s** |
| altri nove step | — | — | ±1s ciascuno |
| | | | **+180s** |

**Un solo step su tredici vale +173s dei ~180s.** Gli altri dodici insieme fanno
+7s: rumore.

**I test veri durano 13s contro 12s.** L'esecuzione non c'entra niente. Per
settimane abbiamo detto "la E2E è lenta" perché quello è **il nome del job**, e
il job contiene tredici step di cui uno solo varia — e non è quello che esegue
i test.

`Cache Playwright browsers` costa **5s in entrambi**. L'ipotesi *cache miss* era
già esclusa con i dati (sei run, stessa chiave, stessi `273964501 B`, restored
ovunque, zero `cache not found`); la scomposizione lo conferma dal lato del
tempo.

**Fatto non spiegato, e ora preciso.** Letto `ci.yml` (sola lettura):

```yaml
      - name: Cache Playwright browsers      # :69-73
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ steps.playwright-version.outputs.version }}

      - name: Install Playwright chromium    # :75-76
        run: npx playwright install --with-deps chromium
```

Lo step di install **non ha alcuna condizione `if:`: gira sempre**, anche dopo
un cache hit riuscito. E lo step di cache **non ha un `id:`**, quindi
`steps.<id>.outputs.cache-hit` oggi non sarebbe nemmeno referenziabile.
Perché quel comando impieghi 16s in un regime e 189s nell'altro **resta ignoto**:
qui è registrato il fatto, non una spiegazione.

**Impatto reale sul prodotto: nessuno.** Solo minuti di CI. È per questo che
resta un **finding registrato e non un gate**.

Serie bimodale a sei punti: **52 → 83 → 186 → 234 → 56 → 84**.

### Conseguenza su F43

**F43 resta il pezzo di infrastruttura meno verificato che abbiamo.** Non è mai
stato messo alla prova da un run oltre i 180s — la condizione esatta per cui è
stato scritto.

E ora **non sappiamo nemmeno quando accadrà**: l'ipotesi cache prometteva un
innesco prevedibile (il prossimo bump di Playwright, che invalida la chiave), e
**quella promessa cade insieme all'ipotesi**. Senza una causa nota, il prossimo
run lento arriva quando arriva.

**Il rovescio controintuitivo, da tenere scritto.** Lo step
`Install Playwright chromium` oggi gira **sempre**, senza `if:`. Se un giorno lo
si condizionasse al cache-miss — che è la cosa ovvia da fare per accorciare la
CI — **sparirebbe l'unico innesco noto dei run oltre 180s**. Il gate F43
diventerebbe **ancora meno verificabile** di adesso: nessun run lento, quindi
nessuna occasione di provarlo nella condizione per cui è stato scritto.
Ottimizzare la CI e collaudare il gate tirano in direzioni opposte. Chi tocca
quello step deve saperlo.

---

## LEZIONI OPERATIVE (21/08)

**#22 — Un commit che non tocca il bundle non è verificabile dal bundle.**
`607f249` tocca solo `vercel-ignored-build-step.sh`, `scripts/` e `src/test/`:
nessuno è importato dall'app, e il build locale produce **lo stesso identico
hash**. Ho sondato l'entry servita 18 volte in 13 minuti e stavo per riportare
"deploy non avvenuto": sarebbe stato **falso**. L'hash è identico **per
costruzione**, a deploy riuscito come a deploy fallito.
Gli altri due segnali che ho provato sono anch'essi inutilizzabili:
`x-vercel-id` non contiene il deployment, e `last-modified` coincide con
`date − age` (verificato: `08:17:37 − 631s = 08:07:06 = last-modified`) — cioè è
l'istante in cui **la mia stessa sonda** ha riempito la cache. **Stavo misurando
me stesso.**
Per i commit di sola infrastruttura l'unica verifica è il log di build, che la
lezione #10 dice essere invisibile: **le due lezioni si sommano, e insieme
producono un gate che non ha modo di dimostrarsi da fuori.** La FASE 5a apre la
prima crepa in questo muro.

**#23 — Corollario operativo della #22.** Prima di dichiarare un deploy "non
avvenuto", **verificare se quel commit poteva cambiare il bundle**. Se non
poteva, l'assenza di cambiamento **non è un'informazione**: è il comportamento
atteso in entrambi gli scenari.

**#24 — `import.meta.url` si rompe se il path contiene uno spazio.** Il guard
`import.meta.url === \`file://${process.argv[1]}\`` è sempre falso in
`unnivai ricresa`, perché `import.meta.url` è percent-encoded (`%20`). Il CLI
non stampava nulla, lo script leggeva output vuoto e cadeva su `PARSE_ERROR`:
**avrei sostituito un fail-closed intermittente con uno permanente, a ogni
push.** Si usa `pathToFileURL`.
**I test puri non lo prendevano**: 13 test verdi su `decide()`, che è pura e non
sa niente dell'entrypoint. L'ho trovato solo eseguendo il CLI vero con fixture
su `/tmp`. È la #16 in una forma nuova: **testare la funzione non è testare il
programma.**


**#25 — Il nome di un job non è la sua causa.** Per settimane "E2E Smoke lenta"
ha descritto **tredici step come se fossero uno**. I test veri duravano 13s
contro 12s nei due regimi estremi: non erano mai stati loro. La variazione stava
tutta in `Install Playwright chromium`, +173s su +180s.
La scomposizione per step è costata **due letture API** (`/runs/<id>/jobs` per
il job_id, poi `/actions/jobs/<job_id>` per gli step con `started_at` e
`completed_at`) e ha ristretto il campo **da un job intero a una riga di YAML**.
Prima di cercare la causa di un job lento, chiedersi **quale step** è lento: il
nome del contenitore non è una diagnosi.

**#26 — Un commento che sopravvive alla cosa che descrive è un dato falso, solo
più lento a farsi vedere.** In `SurpriseTour` la riga sopra il call site diceva
*"cover reale dal primo POI (Google Places) o **fallback tematico città**"*: il
fallback l'avevo appena rimosso, e il commento avrebbe continuato a promettere
un comportamento inesistente a chiunque leggesse quel punto. Stessa forma della
dichiarazione falsa del Gate EE su `Landing.jsx`, corretta nel DIFF 4 (punto 7),
e dello scanner che salta le righe di commento e quindi **non può accorgersene**.
Regola: **quando si rimuove un comportamento, il commento che lo descrive fa
parte della rimozione**, non della documentazione.


**#27 — Un esempio dentro un prompt non è un'illustrazione: è un template.**
Il modello lo copia **alla lettera**, e il difetto si presenta come
allucinazione mentre è **obbedienza**. Su device abbiamo visto un tip da
pasticceria su un museo, e un tour gastronomico intitolato *"I vicoli segreti di
Venezia"*: erano **i nostri esempi**, trasposti su un posto del tipo sbagliato.
Avevamo cercato dei pool di frasi — non esistevano.
Regole operative: **un esempio per categoria, mai uno solo**; dichiarare
esplicitamente che l'esempio mostra il *registro* e non il *contenuto*; e
ricordare che gli esempi **✗** (cosa non scrivere) non vengono imitati — sono i
**✓** il template. Quando un output di modello sembra inventato, **rileggere il
prompt prima di accusare il modello**.


**#28 — Un dato falso può vivere dentro una regola di sicurezza.**
*"Non suggerire MAI posti chiusi"* sembrava proteggere l'utente, e conteneva
tre orari inventati (*"i musei chiudono alle 19, i ristoranti aprono alle 12 e
19, i bar alle 7"*). Nessuno li aveva mai riletti perché l'**intenzione** della
riga era difensiva: si legge il verbo, non il complemento.
**Le regole di sicurezza vanno lette come contenuto, non solo come intenzione** —
e sono il posto dove un fatto inventato sopravvive più a lungo, perché
sembra che stia proteggendo qualcosa.
Corollario trovato lo stesso giorno: **il rimedio ovvio è una seconda trappola.**
Citare la frase falsa per negarla (*"«i musei chiudono alle 19» NON è un fatto
che conosci"*) la rimette nel prompt, e i modelli negano male. Il divieto va
scritto **senza ripetere ciò che vieta**.

**#29 — Un esempio che viola la regola che lo precede vince sulla regola.**
Aggiunto il divieto di attribuire contenuti a un posto, **8 esempi ✓ su 10 lo
violavano**: erano tutti asserzioni sul singolo luogo (*"La sala 3 ha una sola
panca"*, *"Il bancone è di zinco"*, *"I platani sul lato ovest"*). Non basta
aggiungere la regola sopra: **gli esempi ✓ vanno riletti a ogni divieto nuovo**,
perché sono la parte del prompt che il modello imita (#27) e quindi battono la
prosa normativa che li precede.

**#30 — Rileggendo un prompt si trova ciò che si sta cercando.**
Il DIFF 3 aveva riletto gli stessi esempi il giorno prima cercando **orari**, e
non aveva visto *"la porta principale è chiusa **lun/mar**"* — che afferma
**giorni** di apertura, cioè viola la stessa regola. Un'occhiata mirata non è
una revisione: quando si vieta una classe di affermazioni, **elencare le forme
che quella classe può assumere** (ore, giorni, stagioni, "adesso") prima di
cercarle.

**#31 — `REVOKE` riesce anche quando non revoca niente.**
In Postgres `REVOKE` rimuove solo i grant di cui **tu** sei il concedente. Il
grant su `spatial_ref_sys` era `anon=arwdDxtm/**supabase_admin**` — il pezzo
dopo la barra è il concedente. Eseguito da `postgres`, il `REVOKE` è tornato
senza errori e **non ha cambiato un bit**: `anon` aveva ancora `DELETE`. Una
sonda che chiedeva "l'istruzione va a buon fine?" ha risposto `RIUSCITO` ed era
una risposta vera a una domanda inutile. **La prova di un permesso non è che
l'istruzione passi: è che il permesso dopo sia diverso da prima.** Misurare
`has_table_privilege` PRIMA e DOPO, sempre.

**#32 — Un `DO $$ ... EXCEPTION ... $$` non è una transazione.**
La prima sonda diceva "in transazione con ROLLBACK" e nessuna transazione era
aperta: a impedire la modifica erano state le eccezioni, cioè il fatto che i
comandi **fallissero**. Se uno fosse riuscito, sarebbe stato committato. Il
blocco `BEGIN ... EXCEPTION` di plpgsql è una **sotto**transazione e annulla solo
se ne esce per eccezione — da qui il `RAISE EXCEPTION 'annulla'` dopo ogni
tentativo riuscito, che è il modo corretto di provare un DDL senza applicarlo.
Scrivere "rollback" non fa rollback.
---

## Sessione 21/08 (2) — Gate F26 DIFF 4: le catene di fallback

Commit **`e4e19e0`**, deploy **success** (`Fnv7XvMFDMjopVt8H7vgNsdGwBNm`).
CI 126s — Lint & Test 35s, E2E Smoke 84s. **391 test** (+8).

**Regola applicata** (decisione Ivano): sulla **copertina** un'illustrazione
dichiarata va bene, non pretende di essere una foto di quel posto; sulla
**scheda POI** l'immagine pretende di essere **quel** posto, quindi senza foto
ancorata al `place_id` non si mostra niente.

Sette punti: hero `TourDetails` → `TourCover`; catena
`THEME_FALLBACK_IMAGES → CITY_IMAGES → GENERIC.piazza` in `DashboardUser`
(**due** siti, non uno); stock di ripiego in `QuickPathSummary`; `placehold.co`
in `Explore`; hero `PlaceDetailsView` sotto `isPlacesPhoto`; push dello stock in
`dataService.js:48`; correzione del commento falso in `anti-fake.test.js`.

### F1 — CHIUSO, e non da F26

**`findPlaceFromQuery` non esiste più come codice.** Le uniche occorrenze sono
commenti-lapide (`POIDetailDrawer.jsx:27`, `POIPopupCard.jsx:24`,
`poiPhoto.js:5`) e test. Fu ucciso dal **Gate FOTO (`2729068`)**, non da questo
gate.

**Va tolto dal backlog**: era un finding sopravvissuto nel documento al codice
che lo aveva già risolto. Verificato anche che la regola che lo vieta
(`no-places-sdk-search-by-name`) **morde davvero**: file sonda con il pattern →
`× 1 violazione`. Non è più una regola mai vista fallire.

### La dichiarazione falsa del Gate EE

`anti-fake.test.js:125-126` diceva: *"rimosso `src/pages/Landing.jsx` (unsplash
avatar '+2.800 viaggiatori' cancellato — **la landing non ha più foto stock**)"*.

**Falso.** Il Gate EE rimosse l'avatar, **non l'hero**: `Landing.jsx:520` è
tuttora `photo-1552832230`, il Colosseo. La dichiarazione affermava più di
quanto fosse stato fatto — **la stessa bugia che quel file esiste per uccidere,
scritta dentro lo strumento**.

**Era invisibile perché la regola sopra è `skip: true`.** Corretta al punto 7:
`Landing.jsx` resta in allowlist per un **motivo nominato** (hero della landing,
non contenuto POI né copertina tour, non ancora sostituito), non per categoria.
Togliere lo `skip` resta **DIFF 6**.

### Tecnica nuova — per un diff di sola rimozione

**La sparizione di un chunk dal bundle è prova più forte di un marker positivo.**

Il chunk `imageUtils-*.js` c'era nel bundle PRE e nel POST **non esiste**: i
punti 1 e 2 gli hanno tolto gli unici due import vivi. È una prova strutturale,
non un conteggio.

Serve perché **un diff che solo rimuove non ha un marker positivo**: non
aggiunge nessuna stringa letterale. Avevo scelto `isPlacesPhoto` e dà **0
chunk**, perché è un **nome di simbolo** e la minificazione lo rinomina — cioè
esattamente la violazione della lezione #14. Dichiarare l'assenza del marker
positivo è più onesto che inventarne uno.

Marker: `photo-1552832230` bundle **5 → 4** (i 4 residui: `Landing` eccezione
dichiarata, più `DashboardGuide`/`QuickPath`/`SurpriseTour` di DIFF 5);
`placehold.co` **1 → 0**; `[Gate NARRATORE/POI]` **2 → 2**.

> Attenzione a due misure che **non** vanno a zero nel **sorgente** e non è un
> difetto: `placehold.co` resta a `Explore.jsx:350` e `getItemImage` a
> `TourDetails.jsx:833` **dentro i commenti di gate**, che citano ciò che è stato
> rimosso. Nel bundle sono zero. È la stessa trappola già vista nel Gate PULIZIA.

### Il difetto trovato dal test, non da me

`QuickPathSummary` aveva **due** Unsplash: `mainImage` (visto) e **un secondo
dentro l'`onError` dell'`<img>`** (`:42`), che rimetteva la stessa piazza quando
la foto si rompeva. Avrei chiuso il diff col buco aperto.

8/8 asserzioni rosse pre-fix. Le 3 che restavano rosse dopo avevano **tre cause
diverse**: un mio commento che citava il simbolo, questo difetto vero, e
un'asserzione sbagliata (`not.toContain` non distingue una **citazione** da
un'**affermazione**).

`dataService.test.js:212` invertito **e rinominato**: asseriva che
`mapTourToUI` restituisse uno stock, cioè **proteggeva il difetto invece del
contratto**. Un nome falso in un file di test è lo stesso difetto del punto 7.
Provato rosso contro il `dataService` pre-diff.

### NON risolto

- **DIFF 5**: `QuickPath` 26, `SurpriseTour` 25, `locationTourService` 12,
  `AiItinerary` 9, `DashboardGuide` 6. Con essi va cancellato `imageUtils.js`,
  ora **orfano nel sorgente** ma già fuori dal bundle (lo importa solo
  `UnnivaiMap.old.jsx`, dead code).
- **DIFF 6**: `skip: true`, svuotamento allowlist, regola strutturale contro
  `if (url) setX(url)` senza `else`.
- **`GroupInviteModal.jsx:44`**: avatar persona, regola diversa.
- **Raggiungibilità di `locationTourService`**: domanda ancora aperta, si
  risponde nel DIFF 5.
- **Il DIFF 4 NON è verificato su device.** Le copertine ora cadono sul gradient
  di categoria: **che sia bello non lo prova nessun test.**

---

## Sessione 21/08 (3) — Gate F26 DIFF 5 chiuso

Commit **`cb58368`**, deploy **success** (`Y7vRaMtfdeva2eUovoGzvB1nrDe1`).
CI 89s. **399 test** (+8). Marker **6/6** dichiarati prima e verificati dopo.

Tre punti: `SurpriseTour` (`CITY_IMAGES` + `getAdaptiveImage`, 25 URL),
`QuickPath` (26 `image` dalle opzioni del quiz), `AiItinerary:814` (lo stock sui
waypoint di "Vedi su Mappa").

**Il perimetro è stato deciso misurando la raggiungibilità**, non a memoria:
delle 5 superfici con 78 Unsplash, **2 VIVE, 1 SPENTA, 2 MORTE**. Il criterio ha
retto; la mia **classificazione di `AiItinerary` era sbagliata** — avevo contato
9 occorrenze dandole tutte al mock, ma la nona (`:814`) era codice vivo.

### ORDINE DEI GATE — cambiato

> **DIFF 5 → GATE CLEANUP → DIFF 6**

Il cleanup va **prima** del DIFF 6: il DIFF 6 svuota le allowlist, e tre di
quelle nominano file che stiamo per cancellare. Cancellarli prima **riduce** il
lavoro del DIFF 6 invece di duplicarlo.

**I 4 file da cancellare** (tutti a **0 chunk** nel bundle, verificato):

| file | perché morto | occ. |
|---|---|---:|
| `src/services/locationTourService.js` | importato da `NotificationBell.jsx:6` ma **mai chiamato**; 0 call site per tutti e 6 i suoi metodi | 12 |
| `src/pages/AiItinerary.jsx` → `sampleItinerary` (`:26`) | dichiarato e mai referenziato | 8 |
| `src/utils/imageUtils.js` | orfano dal DIFF 4; unico importatore residuo è dead code | 52 |
| `src/components/UnnivaiMap.old.jsx` | nessun import (i 5 `UnnivaiMap` puntano al file vivo) | 2 |

**Le tre allowlist che li nominano**, in `src/__tests__/anti-fake.test.js`:
`:68`/`:71` e `:88` (`locationTourService.js`), `:124` e `:145`
(`imageUtils.js`, `locationTourService.js`, `AiItinerary.jsx`). Vanno rimosse
insieme ai file, non dopo.

### Da decidere nel DIFF 6, registrato ora per non trovarselo come sorpresa

**`DashboardUser.jsx:554` e `:587`** — due `bg-[url('https://images.unsplash.com/…')]`
a **`opacity-10`**: texture decorative dietro le card della dashboard, non
affermazioni su un posto. Sono fuori dal perimetro di F26 per questo motivo, **ma
con l'allowlist svuotata faranno fallire `no-unsplash-in-content`.** Decisione da
prendere lì: rimuoverle, o esentarle per nome e motivo come `Landing.jsx:520`.

**`DashboardGuide.jsx`** (6 occorrenze) — **SPENTO**, non morto: il codice è nel
bundle ma `V1LockedGuard` non monta mai i children. **Debito differito: torna
visibile il giorno che V2 si accende.**

### Nessuna verifica su device

**Né il DIFF 4 né il DIFF 5 sono stati visti su device.** Le copertine ora cadono
sul gradient di categoria e le opzioni del quiz sul gradient + emoji: **che sia
bello non lo prova nessun test.**

---

## Sessione 22/08 — GATE NARRATORE ANCORATO aperto, DIFF 1 chiuso

Commit **`e104140`**, deploy **success** (`3HTzuhj5kgebCMjxvngD4gTQoRTU`).
CI 87s. **411 test** (+12).

### La causa — l'ipotesi iniziale era sbagliata

Sospettavamo **pool fissi** di frasi. **Smentito sul codice**: nessuna delle
frasi viste su device esiste nel sorgente. La causa vera è che il modello
**imita gli esempi del prompt**.

| evidenza device (Venezia, 21/08) | esempio che la produceva |
|---|---|
| tip da pasticceria sulla **Collezione Peggy Guggenheim** | `insiderTip` ✓ = *"Chiedi il caffè al bancone"* — un consiglio da bar dato come modello per **tutte** le categorie |
| *"I vicoli segreti di Venezia"* su un tour **Gastronomia** | l'esempio di titolo, copiato **alla lettera**. Era **il nostro** esempio |
| *"Alle 19 il locale è meno affollato"* | `bestTime` ✓ premia un orario specifico, e nel prompt **non arriva nessun orario** |

**Il difetto si presentava come allucinazione ed era obbedienza.**

### Fatto nel DIFF 1

- **Esempi per categoria** (museo/galleria, chiesa, ristorante/bar, parco/natura,
  panorama) su `description`, `insiderTip`, `transition`, con una riga sopra:
  *gli esempi mostrano il REGISTRO, non il contenuto da copiare*. Scelta la
  strada degli esempi e **non** la rimozione: i ✗ insegnano cosa evitare ma non
  che aspetto abbia un dettaglio concreto, e toglierli tutti rischiava il
  ritorno alla prosa generica già combattuta dal Gate NARRATORE/POI.
- **Coerenza col `types`**: era **"dato passato ma non usato"** — `types` è in
  `candidatesLite` da sempre e non vincolava la voce. Ora `"insiderTip": null`
  è dichiarato preferibile a un tip di altra categoria. Il render regge `null`
  senza modifiche (`TourDetails:1275`, `AiItinerary:907`, `tourShape:333`,
  `MapPage:709` già guardati).
- **Titolo su tutti e tre i prompt** del file — selettore, `titleHint` del tema
  insider (`buildUnifiedHomeToursPrompt`, "Per Te"), punto 12 del legacy.
  Ragione: non sappiamo da quale path venisse il titolo visto su device, e
  lasciarne due avrebbe reso **il giro di verifica non interpretabile**.
- Marker `"I vicoli segreti di"`: sorgente **2 → 0**, bundle **1 chunk → 0**.
  Un solo marker negativo **sul sorgente**, così prende anche una quarta porta.

### DIFF 2, 3, 4 — in coda, con le decisioni già prese
<!-- SUPERATO: al 25/08 DIFF 2, 3 e 4 sono tutti CHIUSI. Quanto segue resta
     solo come registro delle decisioni prese PRIMA di eseguirli. Per lo stato
     vero vedi "Sessione 25/08" in fondo al file. -->

- **DIFF 2 — `hasRealDescription`.** Il predicato è
  `!!(s?.description && String(s.description).trim().length > 0)`: verifica
  **solo che la stringa non sia vuota**, e **non guarda `insiderTip`**. Il tip
  food sul Guggenheim non è mai stato esaminato da nessun predicato.
  **Decisione presa: rinominare** (`hasNonEmptyDescription`), non gonfiare.
- **DIFF 3 — orari.** *Decisione presa: **vietare di affermare orari**, non
  comprare `place/details`.* Dentro il DIFF 3 va anche **`open_now`**: arriva al
  modello (`candidatesLite`, se boolean) mentre la **regola locked dice di non
  usarlo** e di preferire l'orario di chiusura reale — che esiste come capacità
  (`closingTimeTodayHH`, `placesDiscoveryService:907`) ma **non raggiunge** i
  candidati.
  Nel file di test c'è un'asserzione che registra il limite noto
  (`"Alle 17 la luce entra dalla vetrata sud"`): **va invertita, non cancellata.**
  > Trovato passando, utile per il DIFF 3: il prompt legacy al punto 9 dice
  > letteralmente *"I musei chiudono alle 19. I ristoranti aprono alle 12 e 19."*
  > È una candidata diretta per il "19" visto su device.
- **DIFF 4 — la superficie che l'anti-fake non raggiunge.** Le regole
  **scansionano il sorgente**; il testo del narratore **nasce a runtime**. Non è
  una regola mancante: è una superficie che quel meccanismo non tocca. Provato
  con una sonda: su cinque frasi vere del difetto, **una sola** violazione — e
  solo perché conteneva il placeholder letterale.

### DIFF 3 CHIUSO (22/08) — commit `ea59c1a`, deploy success

**"Alle 19" non era un'allucinazione: era una nostra riga.** Il punto 9 del
prompt legacy affermava, *come regola di sicurezza*:

> *"Non suggerire MAI posti chiusi. **I musei chiudono alle 19. I ristoranti
> aprono alle 12 e 19. I bar aprono alle 7.** Adatta al contesto orario."*

Tre orari inventati dentro un'istruzione che sembrava proteggere l'utente.

**E la regola esisteva in TRE copie** — selettore, "Per Te", legacy — non una.

Fatto: tutte e tre riformulate come **divieto di affermare** stati di apertura,
non come istruzione a dedurli; **`open_now` rimosso** dal payload del selettore
(verificato prima che nessun `filter`/`sort`/`find` lo usasse: la selezione non
dipendeva da lui); **`bestTime: null`** quando non c'è un motivo verificabile.

**Path notifiche NON toccato**: lì `closingTimeTodayHH → open_now` è già la
gerarchia corretta e il dato viene da `place/details`. Presidiato da un test.

Due decisioni di metodo:

- **Il marker `"alle 19" → 0` era sbagliato**, corretto prima di eseguirlo:
  avrebbe cancellato `:2066` (esempio con orario **reale**) e `:2068` (la regola
  locked scritta bene). **Un marker che punisce chi rispetta la regola non è un
  marker.** Finale: `"alle 19"` 3→2, `"aprono alle"` 1→0, `"chiudono alle"` 1→0,
  `"MAI suggerire posti chiusi"` 2→0.
- **`tourSensato.test.js:251` invertito e rinominato**, non cancellato. Il
  commento racconta **entrambi** i gate: F18 aggiunse `open_now`
  deliberatamente, il DIFF 3 lo rimuove. Senza quella storia, fra sei mesi
  sembra un test che ha sempre detto questo.

### F55 + F56 CHIUSI (23/08) — commit `8a74cb7`, deploy success

Su device (Milano, 16:29) la **Basilica di Santa Maria delle Grazie** — chiesa
domenicana del XV secolo, UNESCO — aveva `insiderTip` *"Non perderti la sezione
dedicata agli artisti emergenti"* e `description` *"L'eco delle voci risuona tra
le opere contemporanee esposte"*. Due affermazioni false.

**Due ipotesi provate ed escluse prima di scrivere codice:**

| ipotesi | verdetto | prova |
|---|---|---|
| tassonomia collassata (arriva "CULTURA" invece dei types) | **esclusa** | prompt reale costruito con candidato basilica: arrivano `["church","place_of_worship",…]`, `"CULTURA"` **non entra**. La categoria UI nasce a valle in `normalizeStepCategory`, è solo display |
| esempi trasposti (lessico galleria su chiesa) | **esclusa** | lessico osservato: `artisti` 0, `contemporane` 0, `mostre` 0, `esposte` 0 occorrenze nel sorgente. E `museo/galleria` e `chiesa` erano **già** separate dal DIFF 1 |

**Causa vera (C): nulla vietava di affermare cosa un posto CONTIENE, mentre il
prompt premiava la specificità.** Il modello non ha osservazioni — riceve nome,
`types`, rating, indirizzo — quindi per obbedire **inventa** un contenuto
plausibile. **La licenza di inventare viveva dentro la richiesta di qualità.**
Il DIFF 1 aveva ridotto la *distanza* dell'errore (da food-su-museo a
galleria-su-chiesa) rendendolo più verosimile, quindi **più difficile da vedere**.

Fatto: divieto sopra i campi nei tre prompt, con la dichiarazione di cosa il
modello sa e la regola che risolve la tensione (**fra generico e falso vince il
generico**); `transition` esteso col divieto temporale del DIFF 3, su **tre**
prompt; le due frasi false promosse a contro-esempi ✗.

**`description` NON nullable — decisione presa, con la ragione.**
`hasRealDescription` filtra le tappe (`:1230`), quindi renderla nullable
cambierebbe il **motore**, non il testo. Con *"zero tappe accettabile, tappe
finte no"*, un modello prudente che risponde `null` su metà dei POI produce
**tour vuoti** — e non si vedrebbe in un test, si vedrebbe su device dopo il
deploy.
Se su device le description scivolano nel generico, `description` nullable
diventa un diff, **intrecciato col DIFF 2**.

> **La strada che NON si prende in quel caso**: tornare indietro sugli esempi.
> Si dà invece al modello **dati veri su cui essere specifico** — gate
> `place/details`, oggi fuori scope per costi API e cache.

**Trade-off assunto deliberatamente**: gli esempi ✓ sono ora più generici.
*"Le sale in fondo restano le più silenziose"* è più debole di *"La sala 3 ha
una sola panca"*. È la **conseguenza attesa** del fix, non un effetto imprevisto.
La domanda aperta è **di quanto**.

### Restano

**Debito device aggiornato**: F26 DIFF 4/5 e NARRATORE DIFF 1/3 sono
**verificati** (21-23/08). Restano da verificare F55 e F56 — su un POI
religioso, guardando due cose insieme: che non compaiano più contenuti inventati,
e che le description **non siano diventate intercambiabili** fra POI diversi.
<!-- SUPERATO il 25/08: diceva "solo F55 e F56". Con la DIFF 4 in produzione il
     debito device è di TRE voci — vedi "DEBITO DEVICE" nel blocco 25/08. -->

- **DIFF 2 — CHIUSO** (24/08, commit `c918e78`, deploy success).
  `hasRealDescription` → **`hasNonEmptyDescription`**. Verificava che la stringa
  non fosse vuota; il nome prometteva un controllo di verità che non c'è mai
  stato, e contava perché quel predicato **decide se una tappa entra nel tour**
  (`:1335`, `:1778`).
  Rinomina e basta, come deciso: il predicato vero non si costruisce prima di
  sapere cosa vincola la voce, e `description` resta non nullable.
  **Comportamento invariato, provato:** 429 test — *lo stesso numero* — e
  **bundle byte-identico** (stesso hash `index-DaXaP6VP.js`, stesso md5). Era il
  controllo decisivo: il simbolo è minificato via, quindi un bundle diverso
  avrebbe significato che era successo altro oltre alla rinomina.
  Se servirà un predicato che verifica la **qualità** e non la lunghezza, nasce
  **accanto**, non dentro: sono due domande diverse.

- **DIFF 4** — harness runtime. ~~**È il pezzo che rende il gate durevole**~~
  → **SUPERATO il 25/08, vedi il blocco in fondo.** Questa frase era una
  promessa scritta *prima* di costruirlo, ed è risultata falsa: la DIFF 4 copre i
  difetti di **forma** (orari, temporalità, duplicati), **non** quelli di
  contenuto. Due su cinque. Resta vero il resto: le regole anti-fake scansionano
  il sorgente, il testo del narratore nasce a runtime.

### Onestà

**Nessun test prova che il narratore sia migliorato.** L'output è non
deterministico. Provano che **il prompt non detta più il testo che veniva
copiato**. La prova è un giro su device, su un tour con **almeno un POI
non-food**.

---

## Sessione 24-25/08 — CHIUSURA GATE NARRATORE ANCORATO

> Etichettata "chiusura 24/08" da Ivano; il lavoro è stato eseguito e misurato
> il **25/08**. Le date nei comandi e nelle misure sotto sono quelle vere.

Commit **`7211cc4`**, push su `main`, deploy **success** (verificato via
`/commits/7211cc4…/status` → `Vercel=success`, 7 poll da 25s).
**456 test** (+6), build pulita, lint **0 errori** (221 warning, la baseline di
sempre). Marker: sorgente 1, bundle 1.

### Il gate in sei diff — cosa ha chiuso ciascuno

| Diff | Commit | Cosa ha chiuso |
|---|---|---|
| **DIFF 1** | `e104140` | Gli **esempi del prompt** dettavano il testo. Esempi per categoria su `description`/`insiderTip`/`transition` + titolo su tutti e tre i prompt. Marker `"I vicoli segreti di"` 2→0. |
| **DIFF 2** | `c918e78` | `hasRealDescription` → **`hasNonEmptyDescription`**. Il nome prometteva un controllo di verità inesistente su un predicato che **decide se una tappa entra**. Bundle byte-identico: rinomina e nulla più. |
| **DIFF 3** | `ea59c1a` | **Orari affermati**. Vietato affermare aperto/chiuso su tutti e tre i prompt; `open_now` tolto da `candidatesLite` (regola locked #18: vincolo, mai affermazione). |
| **F55** | `8a74cb7` | **Contenuti attribuiti** a un posto che non li ha ("la sezione dedicata agli artisti emergenti" su una basilica). |
| **F56** | `8a74cb7` | **Presente affermato** ("cosa sta accadendo ORA"); `transition` esteso col divieto temporale su tre prompt. |
| **DIFF 4** | `7211cc4` | Le tre fasi di questa sessione: A-bis (regola anti-fake sugli **esempi ✓** dei prompt), A (`narratorGuards.js`, invarianti puri), B (innesto solo-log nel motore). |

### Cosa resta INVISIBILE — senza sconti

La DIFF 4 copre i difetti di **forma**. Dei cinque difetti trovati su device ne
intercetta **due**. Restano fuori, e non per pigrizia ma **per costruzione** —
vederli richiederebbe sapere cosa contiene davvero quel posto:

- **F55, contenuti inventati.** *"Non perderti la sezione dedicata agli artisti
  emergenti"* su una basilica non viola **nessun** invariante: niente orario,
  niente presente, nessun duplicato. È **il più grave dei cinque**.
- **Scivolamento nel generico.** Prosa che va bene per qualunque posto passa
  tutti i controlli proprio perché non afferma niente di falsificabile.
- **Titoli scollegati dal testo.** Nessun invariante lega titolo e corpo.
- **Tip pertinenti-al-tipo-ma-falsi.** Un consiglio plausibile per una chiesa,
  detto su *quella* chiesa dove è falso: forma perfetta, contenuto inventato.
- **Description SIMILI** (non identiche). Il confronto è esatto su testo
  normalizzato. La similarità richiederebbe una soglia da tarare, cioè un test
  che fallisce a caso, cioè la prossima `skip: true`. Scartata di proposito.

**Nessun test prova che il narratore sia migliorato.** L'output non è
deterministico. Provano che il prompt non detta più il testo che veniva copiato.

### DEBITO DEVICE — tre voci, nessuna saldata

1. **F55** — POI religioso: che non compaiano contenuti inventati.
2. **F56** — che non si affermi cosa accade *adesso*.
3. **DIFF 4** — attenzione, qui la domanda è diversa. È **solo-log**: va
   verificato che **i log COMPAIANO** in console, non che l'app regga. Che
   l'app regga è già provato dal test "numero di tappe invariato"; un giro
   device che non trova violazioni **non dimostra nulla** — potrebbe voler dire
   che i guard non sono innestati. Cercare `[Narratore] VIOLAZIONE`, e se non
   compare mai, provocarne una prima di concludere che va tutto bene.

Da guardare in tutti e tre insieme: se le description sono diventate
**intercambiabili** fra POI diversi.

### DIFF 4 FASE B — CHIUSA

Innesto di `findTourViolations` in `canonicalizeStopsFromCandidates`
(`aiRecommendationService.js:1177`). **Solo log**, marker
`[Narratore] VIOLAZIONE <invariante> | campo=… | POI="…" | estratto="…"`.
Il nome POI è quello **canonico di Google**, non quello che credeva l'AI:
serve a rendere la riga utile quando la si leggerà in produzione.

Il log sta **dopo** il `.filter(Boolean)`: una tappa scartata per `place_id`
inventato non esiste, segnalarne il testo sarebbe rumore. I guard sono avvolti
in `try/catch` — un guard che rompe la generazione del tour sarebbe peggio del
difetto che sorveglia.

**Prova del rosso** (metodo sonda): prima dell'innesto **3 test rossi su 6**, e
i tre fallivano **sull'asserzione** (`expected [] to have a length of 1`), non
sull'import. Gli altri tre erano verdi da subito **di proposito**: sono quelli
che asseriscono che *nulla cambia*, e dovevano restare verdi anche dopo. Dopo:
6/6. Marker dichiarati prima della misura e rispettati — sorgente 1, bundle 1,
simbolo `findTourViolations` 0 perché minificato (zero spiegato, non zero cieco).

**Il test che conta non è quello sul warn**: è `il numero di tappe e' invariato`.
È la prova che la Fase B non cambia comportamento — bundle diverso, output
identico. Quando qualcuno aprirà la Fase C, quel test diventerà rosso, ed è
esattamente ciò che deve fare: **la Fase C è una decisione, non manutenzione**,
e non deve poter entrare di soppiatto.

**Condizione che ANNULLA la Fase C**, da leggere prima di aprirla: se i log
mostrano violazioni **frequenti**, il problema è il **prompt**, e annullare il
campo mascherebbe un tour scadente invece di ripararlo — nasconderebbe la
diagnosi proprio mentre la si sta raccogliendo. La Fase C si apre solo dopo aver
letto log **veri**, e la decide Ivano.

### Onestà sulla DIFF 4

**Copre i difetti di FORMA** (orari affermati, riferimenti al presente,
description duplicate). **Non è "il gate reso durevole".** Dei cinque difetti
trovati su device, ne intercetta **2 su 5**. F55 — *"non perderti la sezione
dedicata agli artisti emergenti"* su una basilica — non viola **nessun**
invariante: nessun orario, nessun presente, nessun duplicato. È il più grave dei
cinque e **resta invisibile**; vederlo richiederebbe sapere cosa contiene la
basilica. La FASE A-bis è **l'unica** fase che chiude un difetto già avvenuto.

### Gate SICUREZZA — `public.spatial_ref_sys` ⚠️ APERTO, NON RISOLVIBILE DA QUI

Allarme Supabase CRITICAL `rls_disabled_in_public`. **Non riguarda dati utente**:
è la tabella EPSG di PostGIS, 8.500 righe, di proprietà di `supabase_admin` e
appartenente all'estensione `postgis`.

**INDAGINE APERTA. Non è un fix, e non è nemmeno una diagnosi completa.**

Misurato: `GET /rest/v1/spatial_ref_sys` con la sola **chiave anon** (quella che
viaggia nel bundle del frontend) → **HTTP 200**, la tabella è esposta e leggibile.
`DELETE ?srid=eq.-999999` → **HTTP 204**.

**Il 204 NON prova la cancellazione.** PostgREST risponde 204 anche a un
`DELETE` il cui filtro non matcha nessuna riga, ed è esattamente il caso: `srid
= -999999` non esiste, quel filtro era scelto apposta per non distruggere nulla.
Prova che la richiesta è stata accettata, non che una riga possa sparire.
**La verifica decisiva — `count` PRIMA / `DELETE` di una riga vera / `count`
DOPO — NON È STATA FATTA.** Finché non lo è, la scrivibilità da `anon` resta
**indiziaria**: coerente con `has_table_privilege` = true e con un `DELETE`
eseguito in-database sotto `SET LOCAL ROLE anon`, ma non dimostrata.

Vale anche il rovescio: **non è dimostrato che sia innocua**. Non è chiusa in
nessuna delle due direzioni.

**Quattro rimedi, quattro strade chiuse** (tutte provate e annullate):

| Tentativo | Esito |
|---|---|
| `ALTER TABLE … ENABLE ROW LEVEL SECURITY` | `must be owner of table spatial_ref_sys` |
| `REVOKE INSERT,UPDATE,DELETE FROM anon, authenticated` | **eseguito, effetto zero** — vedi lezione #31 |
| `SET ROLE supabase_admin` | `permission denied to set role` |
| `ALTER EXTENSION postgis SET SCHEMA extensions` | `extension "postgis" does not support SET SCHEMA` |
| `ALTER TABLE … SET SCHEMA extensions` | `must be owner` |
| `REVOKE ALL … FROM PUBLIC` | eseguito, `anon` mantiene il grant diretto |

ACL vera: `anon=arwdDxtm/**supabase_admin**`. Il grant è **diretto** e il
concedente è `supabase_admin`, che `postgres` non può né impersonare né revocare.
**Serve Supabase Support: non esiste una mossa lato progetto.**

**Bozza del ticket — NON INVIATO.** Scriverlo a nome di Ivano è una sua chiamata,
non è mai stato aperto:

> Progetto `ahecpiwsdhghkndncejb`. Il security advisor segnala
> `rls_disabled_in_public` su `public.spatial_ref_sys`. Il ruolo `anon` ha un
> grant diretto `arwdDxtm` concesso da `supabase_admin`, quindi il ruolo
> `postgres` non può revocarlo. Verificati e tutti impossibili da `postgres`:
> `ENABLE ROW LEVEL SECURITY` (*must be owner*), `SET ROLE supabase_admin`
> (*permission denied*), `ALTER EXTENSION postgis SET SCHEMA`
> (*does not support SET SCHEMA*), `ALTER TABLE … SET SCHEMA` (*must be owner*),
> `REVOKE … FROM PUBLIC` (ineffcace, il grant è diretto).
> Richiesta: eseguire come `supabase_admin`
> `REVOKE INSERT, UPDATE, DELETE ON public.spatial_ref_sys FROM anon, authenticated;`
> lasciando `SELECT`, che serve a PostGIS.

**Impatto, SE la scrivibilità verrà dimostrata al punto b**: nessuna fuga di
dati in ogni caso — le definizioni EPSG sono pubbliche per natura, non c'è nulla
da esfiltrare. Il rischio sarebbe la **corruzione** della base spaziale, che
romperebbe `businesses_profile.location`, `search_nearby_partners` e
`get_nearby_partners_for_tour`. Sarebbe comunque **recuperabile**: il dataset è
quello standard distribuito con PostGIS.

**Controllo compensativo** — impronta al 25/08, per rendere la corruzione
*rilevabile*:
```
righe = 8500   md5 = c4485917b4b7a60fe515dee472f7b51a   SRID 4326/3857/4258/32633 = 4 presenti
```
```sql
SELECT count(*), md5(string_agg(srid::text||'|'||coalesce(auth_name,'')||'|'||
       coalesce(auth_srid::text,'')||'|'||coalesce(srtext,''), E'\n' ORDER BY srid))
FROM public.spatial_ref_sys;
```

**Da NON "correggere" per riflesso**: `public.guides` è `rls_enabled_no_policy`
(INFO). RLS attiva con zero policy = deny-all, cioè l'esito fail-closed **voluto**
dal Gate RLS precedente. È corretto così.

### File toccati in questa sessione

| File | Stato | Cosa |
|---|---|---|
| `src/lib/narratorGuards.js` | **nuovo** | invarianti puri (FASE A) |
| `src/__tests__/lib/narratorGuards.test.js` | **nuovo** | 20 test sui puri |
| `src/__tests__/services/narratorGuardsInnesto.test.js` | **nuovo** | 6 test sull'innesto (FASE B) |
| `src/services/aiRecommendationService.js` | modificato | import + innesto solo-log; A-bis −1/+1 |
| `src/__tests__/anti-fake.test.js` | modificato | regola `no-forbidden-forms-in-prompt-examples` (A-bis) |
| `DOVEVAI_HANDOFF.md` | modificato | lezioni #31/#32 + questo blocco (commit separato) |

I primi cinque sono in **`7211cc4`**. `spatial_ref_sys` **non è nel commit**: è
un'indagine aperta, non un fix, e non aveva niente da committare.

Nessuna migration, nessun DDL applicato con effetto: il solo `REVOKE` eseguito
non ha cambiato nulla (lezione #31).

## Sessione 26/08 — GATE CLEANUP chiuso

Commit **`a250a95`**, push su `main`. CI **verde** (Lint & Test + E2E Smoke),
Vercel **success** (8 poll da 25s, curl anonimo). **457 test** (+1), build
pulita, lint **0 errori / 206 warning** (era 221).

### Cosa ha chiuso

**Cinque file morti, non quattro.** Il censimento del 21/08 ne contava quattro;
**`GroupInviteModal.jsx` era un morto mai censito** — zero importatori, nemmeno
`lazy()` o `import()` dinamici, assente dal bundle.

| cancellato | perché | occ. |
|---|---|---:|
| `src/utils/imageUtils.js` | unico importatore era `UnnivaiMap.old.jsx` | 52 |
| `src/services/locationTourService.js` | importato da `NotificationBell.jsx:6` ma **0 call site** per tutti e 6 i metodi | 12 |
| `src/components/UnnivaiMap.old.jsx` | 0 importatori. Cancellato **PRIMA** di imageUtils, di cui era l'unico importatore | — |
| `src/components/GroupInviteModal.jsx` | 0 importatori, statici e dinamici | 1 + 2 `Sofia` |
| `sampleItinerary` in `AiItinerary.jsx` | **solo la costante**, il file resta vivo | 8 |

La morte è stata **riprovata prima di cancellare**, non ereditata dall'handoff.

**Allowlist 45 → 28.** Undici cadute col cleanup, **sette già scadute su regole
ATTIVE** — ognuna una porta aperta *oggi*, non un debito differito. Ognuna
verificata individualmente (file esistente + 0 occorrenze reali) prima di
toglierla, e la suite riprovata dopo: se una non fosse stata scaduta, la sua
regola sarebbe diventata rossa. **`no-price-eur-hardcoded` ha ora allowlist
vuota**: da qui qualunque prezzo hardcoded, ovunque, blocca la build.
Nel file non resta **nessuna** voce che nomina un file inesistente o che esenta
zero occorrenze.

**Il test di `gateF26diff5` INVERTITO, non cancellato.** Asseriva che i morti
*contenessero* ancora unsplash: proteggeva «non ho ripulito un morto per far
scendere un numero». Cancellati i file quell'asserzione non è diventata falsa,
è diventata **inapplicabile**. Ora asserisce la loro **assenza** — stesso
contratto, altra metà. Se qualcuno li ricrea vuoti per far passare un test,
diventa rosso.

### Il bundle — la parte che vale

**md5 cambiato, ZERO JavaScript modificato.** Non l'ho accettato come normale:

1. Tre build dello stesso sorgente → hash identici: il build è **deterministico**,
   quindi il cambiamento era reale.
2. Ricostruito `c212832` in un **worktree isolato** → riproduce esattamente
   l'md5 originale `4b960ab…`. Un PRIMA affidabile.
3. Confronto a **nomi normalizzati** (hash tolti da nomi e riferimenti interni,
   `.js` **e** `.css`): **0 chunk JS su 77 differiscono.**
4. Cambia solo il CSS: **−866 byte, 1642 → 1629 regole**. Tailwind scansiona i
   **sorgenti** (`content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"]`),
   quindi cancellare un JSX morto smette di emettere le sue classi. Le 13
   sparite sono tutte e sole classi presenti solo in `UnnivaiMap.old.jsx` (10) e
   `GroupInviteModal.jsx` (3).
5. Controllo che nessun vivo fosse derubato: due classi sembravano usate da file
   vivi, ma erano **match di sottostringa** — i vivi usano `max-h-[85vh]` e
   `md:rounded-[24px]`, classi Tailwind **diverse** dalle nude `h-[85vh]` e
   `rounded-[24px]` dei morti. Nel CSS nuovo le vive ci sono (1→1), le nude no.

**Il marker dichiarato era impreciso, non il codice.**

### LEZIONE #33 — «bundle invariato» è il marker sbagliato per una cancellazione

Cancellare un JSX morto **cambia sempre il CSS** via Tailwind, anche quando
nessun JavaScript cambia: le classi del markup morto smettono di essere emesse.
Il marker giusto per una cancellazione di file è **«zero chunk JS differenti a
nomi normalizzati»**, non «bundle invariato». E il confronto va fatto a
sottostringa **esclusa**: `max-h-[85vh]` contiene `h-[85vh]` e un grep ingenuo
dà falso allarme proprio nel momento in cui si sta decidendo se fermarsi.

### LEZIONE #34 — `not.toContain` non distingue una citazione da un'affermazione

Già registrata nel DIFF 4, **ripetuta due volte in questo gate**. Riscrivendo il
commento di `TourDetails` ho reintrodotto la stringa `utils/imageUtils`, che
`gateF26diff4.test.js:28` asserisce assente per intercettare un **import**: la
suite è diventata rossa su un **commento**. Poi è successo di nuovo con la nota
che avvertiva del problema, perché conteneva la stringa stessa. Nel codice ora
c'è un NB che dice di nominare quel modulo **senza il suo path di import**.

### LEZIONE #35 — una classe Tailwind citata in un commento viene EMESSA nel CSS

Scoperta nel DIFF 6 (27/08). `tailwind.config.js` scansiona
`./src/**/*.{js,jsx,ts,tsx}`, che include `src/__tests__/`. Scrivendo la forma
letterale di una utility arbitraria dentro il **commento** di una voce di
allowlist — per descrivere il motivo dell'eccezione — lo scanner l'ha letta come
un uso reale e ha aggiunto al bundle **48 byte e un selettore che non esiste in
nessun componente**.

L'effetto non si ferma lì: il CSS cambia → l'entry cambia → **tutti e 76 i chunk
cambiano hash**, perché ognuno importa l'entry. Per venti minuti il confronto
bundle ha mostrato «tutto diverso» compresi chunk-foglia come `arrow-left`, che
il diff non poteva aver toccato. La diagnosi è arrivata **confrontando il
contenuto e non l'hash** (lezione #2): dentro `arrow-left` l'unica differenza era
la stringa `./index-<hash>.js`.

È la #34 in un secondo strumento: **Tailwind non distingue una citazione da un
uso**, come `not.toContain` non distingue una citazione da un'affermazione. La
regola operativa è la stessa e va estesa: nei commenti **descrivere** le utility
(«sfondo al 10% di opacità in blend overlay»), mai scriverne la forma letterale.

Corollario sul metodo: prima di attribuire una differenza di bundle al proprio
diff, **provare che la build sia deterministica** — due build di seguito senza
toccare nulla. Qui lo era, il che ha reso la differenza reale e degna di essere
inseguita fino alla causa.

### LEZIONE #36 — uno slice fra due `index()` puo' essere VUOTO, e `replace('')` esplode il file

Costata un `DOVEVAI_HANDOFF.md` da **719 MB** e un push rifiutato da GitHub
(`GH001: Large files detected`, limite 100 MB). Lo script era:

```python
old = s[s.index(A) : s.index(B)]
s = s.replace(old, new)
```

`B` era `"### Cosa ha chiuso"`, un'intestazione che si ripete in **ogni** blocco
di sessione. `s.index(B)` ha trovato l'occorrenza del blocco **precedente**, che
sta PRIMA di `A`. In Python uno slice con start > end non e' un errore: e' la
**stringa vuota**. E `str.replace("", new)` non e' un no-op — inserisce `new`
**fra ogni carattere** del file. 258 KB diventano 719 MB senza un solo warning.

Due regole, non una:
1. **Mai delimitare uno slice con due `index()` senza asserire `end > start`.**
   In un file dove le intestazioni si ripetono per convenzione, la seconda
   ancora e' quasi sempre ambigua. Lavorare per indici di RIGA verificati
   (stampandoli prima), non per offset indovinati.
2. **Mai passare a `replace` un `old` che puo' essere vuoto.** L'assert va sul
   valore, non sull'intenzione.

Il danno e' stato nullo perche' il commit rotto non era mai stato pushato: il
`pre-receive hook` di GitHub e' stato l'unico controllo che ha visto il problema
— lint, test e build non guardano la dimensione dei file. **Il recupero corretto
non e' `reset --hard`**: `reset --soft` sul commit buono, poi ricostruzione del
file dal blob con `git cat-file blob <sha>:<path>`, che non tocca nient'altro
nell'albero.

Corollario, ed e' il vero motivo per cui questa lezione sta qui: al secondo
tentativo lo script aveva gia' gli assert, e uno e' **scattato** su un offset
sbagliato di una riga. Non ha rotto niente. La differenza fra i due tentativi
non e' l'attenzione: sono le guardie.


### LEZIONE #37 — un TODO non evaso diventa un dato

`placesDiscoveryService:909` diceva:

```js
suggestedMinutes: 30, // default: si affinera' se serve
```

Non e' mai successo. Per mesi **ogni POI ha dichiarato mezz'ora di visita**
qualunque cosa fosse — una chiesa, un museo, un ristorante. Il commento diceva
"provvisorio"; il codice diceva "30" a ogni utente che apriva un tour.

Un valore-ponte con accanto la promessa di sistemarlo **non e' provvisorio: e' un
dato**, e si comporta come un dato in ogni riga che lo legge. La promessa vive
nel commento, che nessun utente apre. Vale la regola gia' locked sui fallback
(#5, "un fallback che produce contenuto e' una gamba tolta al tavolo"), con
un'aggravante: qui il fallback si era **dichiarato temporaneo**, e questo ha
comprato mesi di immunita' dalla revisione.

Quando serve un valore-ponte, la domanda non e' "lo sistemero'?" ma **"cosa
mostra all'utente finche' non lo sistemo?"**. Se la risposta e' un'affermazione,
il ponte non si posa.

### LEZIONE #38 — un test puo' difendere ATTIVAMENTE il difetto che stai togliendo

`googleFirstItinerary.test.js:176` asseriva:

```js
// Fallback su valori sicuri
expect(result[0].suggestedMinutes).toBe(30);
```

Non era sicuro: **era il difetto**, e il test lo proteggeva. Rimuovendo la durata
inventata la suite e' diventata rossa, e il commento sopra l'asserzione spiegava
che stava tutelando la robustezza — non che stava congelando un numero prodotto
dal codice e mostrato come dato del posto.

**Terza forma della stessa famiglia in una settimana**, dopo #34
(`not.toContain` non distingue una citazione da un'affermazione) e #35 (Tailwind
non distingue una citazione da un uso): qui e' un **test** che non distingue un
invariante da uno stato di fatto. Un'asserzione scritta su "com'e' adesso"
diventa indistinguibile da una scritta su "come deve essere".

Regola operativa: quando un test diventa rosso mentre si rimuove un difetto, la
prima domanda non e' "come lo faccio ripassare" ma **"questo test cosa stava
proteggendo davvero?"**. E il commento sopra l'asserzione non e' la risposta: e'
l'intenzione di chi l'ha scritto, che e' esattamente cio' che va verificato.
Aggiornare, mai aggirare — e scrivere nel test perche' l'asserzione vecchia era
sbagliata, cosi' la prossima persona non la ripristina.


### LEZIONE #39 — il motore ordina per "e' per tutti", il prodotto promette "e' per te"

Non e' un bug: e' una **tensione strutturale**, e va tenuta come tale.

Il pool dei candidati e' ordinato — e poi troncato a 20 — per
`qualityScore = rating x ln(1 + user_ratings_total)`. Il logaritmo attenua il
volume ma non lo neutralizza: fra un ristorante milanese con 5.000 recensioni a
4.5 (score 38) e una chiesa antica minore con 300 a 4.1 (score 23) vince sempre
il primo. **Il criterio e' la popolarita', mascherata da qualita'.**

DoveVAI dice all'utente *"non e' per tutti, e' per te"*: tour insider, perle
nascoste, posti che le guide non elencano. Ma la selezione dei candidati
premia esattamente cio' che **tutti** hanno gia' visto. Piu' un posto e'
nascosto, meno recensioni ha, e piu' certamente esce dai top-20 — cioe' **il
motore filtra via proprio la cosa che il prodotto promette**.

Non e' risolvibile abolendo il ranking: senza, entrerebbe qualunque cosa e la
qualita' crollerebbe. Le strade sono altre — una quota per query (ogni famiglia
richiesta ha diritto a N posti nel pool), o un punteggio che premi il rapporto
rating/popolarita' invece del prodotto.

Il punto della lezione non e' la formula: e' che **una metrica di ordinamento e'
una dichiarazione di valori**, e questa ne dichiara uno opposto a quello del
prodotto. Quando un motore e una promessa divergono, non e' il motore ad avere
ragione — ed e' il tipo di difetto che nessun test coglie, perche' ogni singolo
pezzo funziona correttamente.


### LEZIONE #40 — una stringa iniettata in un campo che dichiara di contenere l'input dell'utente e' una bugia detta al modello

Il prompt del traduttore d'intenti ha un campo esplicito:

```
Frase dell'utente: "..."
```

Dentro ci finiva `userPrompt + "[Profilo utente: … Evita se possibile: natura …]"`.
Il campo **dichiara** di contenere cio' che l'utente ha scritto. Non lo
conteneva.

**Il modello ha obbedito, ed e' questo che rende il difetto insidioso**: chiesta
una lista di parchi e ricevuta l'istruzione di evitare la natura, ha mediato — e
il risultato si presentava come *un errore del modello*. Per due giri abbiamo
cercato la causa nel prompt e negli esempi (ipotesi tutte ragionevoli, tutte
sbagliate). Il prompt era corretto. L'input era falso.

**Come si trova**: non con le fixture, che testano cio' che il codice fa con
l'input che gli diamo noi. Serve **estrarre il prompt reale e chiamare il modello
con l'input pulito**. Se risponde bene, il difetto e' a monte — in cosa gli
arriva, non in come ragiona. Costo: nove chiamate a gpt-4o-mini.

E' la **#28** (un dato falso puo' vivere dentro una regola di sicurezza)
applicata all'**input** invece che alle istruzioni. La forma generale: *ogni campo
di un prompt che dichiara la provenienza di un dato e' un'affermazione, e va
verificata come tale*. `Frase dell'utente`, `candidati verificati su Google`,
`orario attuale`: se il contenuto non corrisponde all'etichetta, il modello non
puo' accorgersene e noi daremo la colpa a lui.


### LEZIONE #41 — `\b` non regge gli accenti, e una radice troncata col confine di parola diventa una voce morta

Due trappole trovate insieme correggendo il lessico dei kind, e sono la stessa
famiglia: **passare da match a sottostringa a match a parola non e' una
sostituzione meccanica.** Cambia cosa il lessico puo' esprimere.

**1. `\b` in JavaScript non conosce le lettere accentate.** La classe di parola
di JS e' `[A-Za-z0-9_]`: `è` non ne fa parte. Quindi `\bcaffè\b` fallisce,
perche' dopo `caffè` la regex cerca un confine e la `è` **e' gia'** un
non-carattere-di-parola — il confine e' fra `caff` ed `è`, non dopo. Vale per
ogni voce con accento in un lessico italiano, cioe' molte. Il confine va scritto
a mano: `[^a-zà-ù]` o inizio/fine stringa.

**2. Una radice troncata sopravvive al cambio di semantica come voce morta.**
Il lessico aveva `spiagg` e `archeolog`, pensate per coprire piu' forme con
`includes`. Col confine di parola **non matchano piu' niente** — nessuna query
contiene la parola `spiagg`. Non danno errore, non danno rosso: restano nella
tabella, sembrano coprire una famiglia, e coprono zero.
E' la stessa classe dell'allowlist scaduta della **#26** (una voce che non
esenta nulla e' una dichiarazione falsa), ma piu' insidiosa perche' la voce
**era** corretta prima e lo ha smesso senza che nessuno la toccasse.

**Il presidio**: un test che asserisce che **ogni voce del lessico matchi se
stessa**. Una voce che non si riconosce e' morta, e si vede subito. Costa tre
righe e avrebbe intercettato entrambe le trappole.

Corollario sulla scelta delle voci: nel match a sottostringa le parole **corte**
sono pericolose (`bar` dentro "barocca", `pub` dentro "pubblico" — 14 falsi
positivi misurati); nel match a parola sono pericolose le **radici** e le
**forme mancanti** (i plurali cadevano sul default). Si scambia una classe di
difetti con l'altra, e la seconda e' piu' silenziosa: la prima classifica male,
la seconda non classifica affatto e nessuno se ne accorge.


### Marker

| marker | prima | dopo |
|---|---:|---:|
| unsplash sorgente, allowlist svuotata | 82 | **9** |
| `no-fake-reviewer-names` | 3 | **0** |
| `Sofia` fuori test | 5 | **2** (commenti `//`, lo scanner li salta) |
| voci allowlist totali | 45 | **28** |
| file `.js/.jsx` in `src` | 107 | **103** |
| chunk / unsplash nel bundle | 77 / 9 | **77 / 9** |
| lint warning | 221 | **206** |

### Device

**Non richiesto**: zero JavaScript cambiato. Il debito device resta quello di
prima — **F55, F56, DIFF 4**, nessuno saldato.

---

## Sessione 27/08 — GATE F26 DIFF 6 chiuso. **F26 CHIUSO PER INTERO: sei diff.**

Commit **`102605e`**. **461 test** (+1), build pulita, lint **0 errori / 199
warning** (era 204). Suite verde anche con `.env` spostato fisicamente.
CI **verde**. **DEPLOYATO** — ma solo al secondo giro, e il perche' vale piu'
del fatto.

### Il primo deploy e' stato bloccato dal gate. Diagnosi DIMOSTRATA.

Il deploy di `102605e` e' stato **Canceled**. Non per un difetto del gate: per
una latenza di GitHub. I log di build, letti con `vercel inspect --logs`:

```
16:04:33  Budget: fase A 30s - fase B 300s - timeout per chiamata 15s
16:04:33  [A] nessun workflow_run per lo SHA - restano 30s
   ... sei tentativi, uno ogni 5s ...
16:05:03  Nessun workflow_run per 102605e... entro 30s - BLOCKING (fail-closed).
16:05:03  GATE_VERDICT exit=0 REASON=NOT_REGISTERED elapsed=30s chiamate: 6, scadute: 0
```

`chiamate: 6, scadute: 0` — GitHub rispondeva regolarmente. Il run **non
esisteva**, e non sarebbe esistito per altri diciotto minuti.

Il confronto fra i due commit di questa sessione misura il fenomeno:

| commit | push | workflow_run registrato | ritardo | esito deploy |
|---|---|---|---|---|
| `102605e` | 16:04:19Z | 16:22:25Z | **+18 min** | Canceled a **32s** |
| `e94ad95` | 20:17:39Z | 20:17:40Z | **+1 s** | **Ready** in 2m |

Stesso repo, stesso gate, stesso giorno: **1 secondo contro 18 minuti**. Il
budget di fase A (30s) e' tarato sulla propagazione normale e dopo la fase A non
c'e' ritentativo. Il gate e' fail-closed e ha fatto il suo mestiere; il
presupposto che salta e' che GitHub registri il run in pochi secondi.

**La durata del Canceled e' la firma, come dice la lezione #10**: 32s = i 30s di
fase A piu' l'avvio. Non 1-2s (uscita immediata), non 90s+ (attesa vera sui job).
Si diagnostica dalla lista dei deployment, senza aprire un log.

### Come e' finito in produzione

**Non con un redeploy: trascinato dal commit dell'handoff.** Il push di
`e94ad95` ha triggerato un deploy nuovo, il suo run e' stato registrato in 1
secondo, il gate e' passato e ha buildato — e siccome `e94ad95` discende da
`102605e`, quella build contiene il DIFF 6.

Verificato in produzione con curl anonimo:

| | prima | dopo |
|---|---|---|
| entry | `index-CAiV8Dg4.js` | **`index-sVBp4KeF.js`** |
| chunk TourDetails | `TourDetails-BC9IEmEU.js` | **`TourDetails-DR_Kih9F.js`** |
| `chat sicura e crittografata` | PRESENTE | **assente** |
| `09:42` | PRESENTE | **assente** |
| `Aggiunto ai preferiti` | PRESENTE | **assente** |

**Il codice del DIFF 6 e' servito agli utenti. La chat finta non c'e' piu'.**

**Resta aperto, e non va risolto per riflesso**: se la fase A debba avere piu'
budget o un ritentativo. Attenzione al difetto #2 gia' catalogato nel commento
dello script — "nessun run in_progress letto come CI verde" — cioe' un
fail-closed che diventerebbe fail-open. Alzare il timeout **non e' gratis**: e'
la trappola che F43 aveva gia' chiuso una volta. Costo attuale del difetto:
basso, un commit successivo trascina il precedente. Costo di sbagliare il
rimedio: alto.

### Cosa ha chiuso

**I tre `skip: true` sono via.** `anti-fake.test.js`: 26 test, 26 passed, 0
skipped — 27 con la regola nuova. Tutte e quattro le regole coinvolte sono state
provate col **metodo sonda**, perché uno zero non prova che la regola sia verde:
prova che potrebbe non girare.

| regola | sonda piantata | esito |
|---|---|---|
| `no-fake-reviewer-names` | `'Sofia'` in TourDetails | rosso `:556` |
| `no-in-arrivo-toast` | `'Coming soon'` in TourDetails | rosso `:556` |
| `no-unsplash-in-content` | allowlist svuotata | rosso, 9 violazioni |
| `no-security-claims-in-copy` | `'chat crittografata'` | rosso `:357` |

**`no-unsplash-in-content`** — allowlist a tre voci, ognuna per NOME e per
MOTIVO: `Landing.jsx:520` (hero), `DashboardUser:554/:587` (texture di sfondo),
`DashboardGuide.jsx` (6, spento dietro `V1LockedGuard`). Residuo ad allowlist
svuotata: **9**, esattamente quelle coperte.

**`no-in-arrivo-toast`** — `GuidePlaceholder:30` ESENTATO, non rimosso: dichiara
onestamente che la V2 non è pronta, l'opposto di una promessa falsa. L'esenzione
è **per file** perché `isAllowlisted` confronta il path intero; la perdita di
granularità è misurata a zero (nel file matcha una riga sola — la `:23` ha
un'interpolazione in mezzo e non matcha). Decisione confermata: un numero di riga
marcirebbe al primo edit sopra la 30.

### F60 — chat finta. **RIMOSSA.**

`GuideChatModal` (era `TourDetails:254`) rimosso, non disabilitato. Il bottone
che lo apriva stava dietro `isGuideTour` (`:716`), che è una **condizione sui
dati e non un guard**: era raggiungibile in produzione da chiunque aprisse un
tour guidato. **Verificato via curl anonimo prima del deploy**: le tre stringhe
erano servite da `TourDetails-BC9IEmEU.js` in prod.

Conteneva: pallino verde `Online` hardcoded, messaggio della guida con timestamp
fisso `09:42`, `<input autoFocus>` senza `onChange` né submit, e la frase
*"Questa è una chat sicura e crittografata con la tua guida ufficiale DoveVai"*
sopra un canale che non trasmetteva niente.

**Il toast "Funzione in arrivo" rimosso poco prima era l'etichetta onesta sulla
scatola vuota. Tolta l'etichetta, andava tolta la scatola** — altrimenti il diff
peggiorava il prodotto invece di migliorarlo.

Rimosso anche un **secondo ingresso mancato**: un `useEffect` su
`location.state.openChat`, flag che nessuno setta più (le altre occorrenze nel
repo sono `openChatRequestId`, cosa diversa e viva lato guida). L'ha trovato
**ESLint, non il grep**: cercavo `showChatModal` e la variabile era
`setShowChatModal`. **La lezione #11 rivolta contro chi la applica.**

### F61 — tre `toast()` in ReferenceError. **CHIUSO.**

`toast` era dichiarato **solo** dentro `RequestModal:50`. In `TourDetailsPage`
non era in scope, e le tre chiamate (`:747` errore mappa, `:875` preferiti,
`:893` link copiato) erano `ReferenceError`, non messaggi. ESLint lo diceva, ma
qui `no-undef` è **warning** e la CI non lo prendeva.

Fix: **una riga**, `const { toast } = useToast()` in cima al componente. Nessun
sistema nuovo — stesso `useToast` di altri 13 file, `ToastProvider` già montato
in `App.jsx:113`. Le chiamate non sono state rimosse perché comunicano fatti
veri: `:747` in particolare segnala un fallimento mappa realmente accaduto, e
tacerlo lascerebbe l'utente davanti a uno schermo che non spiega niente.

### F62 — preferiti che non salvano. Cuore **RIMOSSO**, difetto sotto **APERTO**.

Il cuore (`:871-875`) faceva `classList.toggle` sull'icona e non scriveva da
nessuna parte. Non è stato collegato a `dataService.toggleFavorite` per **tre
difetti sovrapposti**, tutti misurati:

1. **Mismatch di tipo, non di colonna.** La tabella `favorites` esiste
   (`20260303_fix_missing_tables_and_columns.sql:381`) con RLS e le tre policy.
   Ma `tour_id` è `UUID NOT NULL REFERENCES tours(id)`, e gli id che arrivano a
   TourDetails non sono sempre UUID di `tours`: il file stesso ha un ramo di
   recovery per `id.startsWith('ai-quiz-')` (`:451`). Il cuore stava nell'hero,
   cioè su **ogni** tour. Per i tour AI l'insert violerebbe tipo e FK.
2. **Il fallimento sarebbe muto.** `toggleFavorite` (`dataService.js:287`)
   ritorna `{success:true}` in **tutti e quattro** i rami — flag spento, guest,
   successo, e `catch`. Collegarlo avrebbe dato un cuore che si colora sempre e
   salva a volte.
3. **Non esiste il verso della lettura.** Nessun `getFavorites`, nessun
   `isFavorite`. Anche salvando, il cuore ripartirebbe **grigio** su un tour già
   preferito, perché legge lo stato da `classList`.

Un bottone assente è onesto; un cuore che si colora e non salva no.

### APERTO — i preferiti come gate a sé

Il cuore è via, il difetto sotto no. Dati raccolti oggi, da non ri-scoprire:

- **Due motori divergenti.** `Explore.jsx:138` tiene i preferiti in
  `localStorage['unnivai_favorites']`; `dataService.toggleFavorite` scrive su
  Supabase. Non si parlano. È la **regola locked #8** (un solo motore).
- **`getFavorites` non esiste.** Manca metà del contratto: si scrive e non si
  rilegge.
- **`toggleFavorite` è silent-success anche dal `catch`.** Classe della lezione
  #6 (una write senza `.error` controllato è un no-op travestito da successo).
- Call site vivo esistente: `TourLive.jsx:363`.

### REGOLA NUOVA — `no-security-claims-in-copy`

0 violazioni, **allowlist VUOTA e da tenere vuota**. Nata da F60: un'affermazione
di sicurezza falsa è la cosa più grave che questo prodotto possa dire, perché
l'utente non ha modo di verificarla e **decide cosa scrivere fidandosi**.

**Vieta** l'affermazione di un MECCANISMO (crittografia, cifratura, end-to-end) e
la GARANZIA ASSOLUTA (`100% sicuro`, `sicurezza garantita`). Sono verificabili: o
il meccanismo è nel codice, o la frase è falsa.

**Non vieta** l'aggettivo applicato a un processo delegato a un terzo che la
sicurezza la implementa davvero. Caso vivo, misurato: `BookingSystem.jsx:260`
dice *"Verrai reindirizzato a Stripe per completare il pagamento in sicurezza"* —
nomina il terzo, descrive il reindirizzamento, non afferma un meccanismo che
DoveVai non ha. **Passa, e deve passare.** Per questo `sicur` nudo NON è nel
pattern: ha 12 occorrenze, fra cui quella riga, `Assicurati di...` e `Sei sicuro
di voler eliminare`. Fuori dal pattern anche `e2e` (16 occorrenze fra path,
config e test).

Se una violazione emerge **non si esenta il file: si verifica se l'affermazione è
vera.** Se un giorno lo diventa, la strada non è l'allowlist ma un registro dei
claim verificati, dove ogni frase è accompagnata dal meccanismo che la rende vera
e da dove controllarlo. Oggi quel registro non va costruito: non c'è un solo
claim vero da registrarci.

### Accessibilità — un dato che era nascosto sotto il falso

`sr-only` è sparito dal CSS con la chat finta, ed era **l'unica etichetta
screen-reader dell'intero progetto**. Oggi l'app non ne ha nessuna. Non è un
regresso causato qui — la rimozione è corretta — ma va scritto: **l'unico segno
di accessibilità che il progetto aveva era sostenuto da codice falso.** Era
apparente.

### Marker

| marker | prima | dopo |
|---|---:|---:|
| `skip: true` in anti-fake | 3 | **0** |
| test anti-fake | 26 (3 skipped) | **27, 0 skipped** |
| `chat sicura e crittografata` nel bundle | 1 chunk | **0** |
| `09:42` | 1 chunk | **0** |
| `Aggiunto ai preferiti` | 1 chunk | **0** |
| `toast` no-undef (tutto il repo) | 3 | **0** |
| chunk `TourDetails` | 38235 B | **33842 B** |
| CSS | 131575 B | **130788 B** |
| chunk JS | 77 | **77** |
| lint warning | 204 | **199** (0 errori) |
| suite | 460 | **461** |

Le **10 classi CSS sparite** verificate a confine di parola, zero usi vivi, con
controprova dello strumento su `flex-1` (89 usi trovati: gli zeri sono reali).

### Due correzioni di metodo, entrambe su errori commessi qui

**Il marker «il bundle DEVE cambiare» era sbagliato.** Dichiarato per la
rimozione del toast chat-guida. Quel toast era **sorgente morto** — zero call
site, `toast` nemmeno in scope — e il minifier lo droppava già: `Funzione in
arrivo` era assente dal bundle **PRE**. Il bundle era e restava invariato. Era un
atteso dichiarato **senza misurarlo**, che è la cosa che questo metodo esiste per
impedire. Nel giro successivo il PRE è stato misurato prima di dichiarare.

**Il primo monitor CI ha dichiarato SUCCESS leggendo il run del commit
precedente.** Interrogava `--limit 1` senza filtrare per SHA. Il run del commit
nuovo non era ancora nato e la risposta è arrivata verde e falsa. **Lezione #11,
terza occorrenza in questa sessione**: prima di fidarsi di un segnale, provare
che riguardi la cosa cercata. Monitor rifatto con `select(.headSha)`.

### Lezioni nuove di questa sessione: **#35** e **#36**

**Tailwind emette le classi che trova nei COMMENTI.** Testo completo nel corpo
delle lezioni sopra. In breve: `tailwind.config.js` scansiona
`./src/**/*.{js,jsx,ts,tsx}`, test inclusi; una utility *citata* dentro il
commento di una allowlist è stata letta come un uso reale (+48 byte di CSS e un
selettore inesistente), il CSS cambiato ha cambiato l'entry e l'entry ha
cambiato l'hash di **tutti e 76 i chunk**, foglie comprese. Diagnosi arrivata
confrontando il **contenuto** e non l'hash (lezione #2).
Terza forma in una settimana di *«lo strumento non distingue una citazione da un
uso»* — dopo #34 (`not.toContain`) e #26 (commenti che sopravvivono alla cosa
che descrivono).

La **#36** — *uno slice fra due `index()` puo' essere vuoto, e `replace('')`
esplode il file* — e' costata un handoff da 719 MB e un push rifiutato da GitHub, mentre si
scriveva questo stesso blocco. Testo completo nel corpo delle lezioni. Il punto
che vale oltre il bug: al secondo tentativo lo script aveva gli assert e uno e'
**scattato** su un offset sbagliato di una riga, senza rompere niente. La
differenza fra i due tentativi non e' stata l'attenzione: sono state le guardie.

### Device

**Richiesto, una voce sola**: il bottone **Profilo** ora occupa la riga intera al
posto della coppia Chat+Profilo. Non è uno spazio vuoto — è un bottone che si
allarga — ma è UI che cambia forma e va guardata.

Il debito device precedente resta invariato: **F55, F56, DIFF 4**.

---

## Sessione 27/08 (2) — GATE RAGGIO DIFF 1a chiuso

Commit **`f0d122b`**. **493 test** (+32), build pulita, lint 0 errori / 199
warning (invariato). Suite verde anche con `.env` spostato.

### F64 — la durata era inventata quanto l'orario. **RISOLTO.**

`suggestedMinutes` era chiesto al modello nello **stesso schema JSON** di `time`,
due righe sotto, e accettato con lo stesso `|| 30` senza validazione. **Sei**
consumatori vivi, non quattro: oltre a `DashboardUser:303`, `TourDetails:1126` e
`Notifications:171`, anche `tourShape:330` (il normalizzatore condiviso) e
`placesDiscoveryService:909`.

**Nessuno se n'era accorto perche' un numero di minuti sembra sempre
plausibile.** "30 min" su una chiesa non stona come "19:30" alle 23:10: il
difetto era identico, ma invisibile.

**Perche' il DIFF 1 originale era sbagliato, non incompleto.** Il piano era
calcolare `time` sommando `suggestedMinutes` a partire dall'ora reale. Avrebbe
prodotto un orario onesto nella forma e falso nella sostanza — e **peggiore di
oggi**: 19:30 alle 23:10 e' visibilmente assurdo e l'utente lo scarta, mentre
`23:15 → 23:45 → 00:30` sembra derivato da un sistema che sa quanto dura una
visita. Avremmo reso credibile un dato inventato.

### Cosa c'e' al suo posto — `src/lib/tourTiming.js`

Non e' una durata vera: e' una **STIMA DEL PRODOTTO**. La differenza con
l'invenzione del modello e' che questa e' uguale per tutti, ispezionabile e
testabile. Google Places non vende durate di visita: non e' un dato comprabile.

- **Sosta** da tabella sui `types` GOOGLE, non su `type` (la categoria UI
  collassata perde l'informazione: `church` e `museum` finiscono entrambi su
  'cultura' ma durano 20 e 60).
- **Precedenza per specificita' dell'esperienza dominante**, non per durata: si
  scorre la lista e vince la prima voce che matcha, **mai** l'ordine dell'array
  di Google. Una chiesa turistica dura 20 e non 30 perche' il motivo per cui ci
  entri e' che e' una chiesa. I generici (`tourist_attraction`,
  `point_of_interest`) stanno in fondo: dicono "e' un posto", non "e' QUESTO
  posto".
- **Spostamento** da haversine / **4.5 km/h**, dichiarata come scelta e non
  misurata (sotto i 5 km/h del profilo pedonale OSRM, per semafori e centri
  storici affollati). Se un giorno si misura, `nav_events` esiste.
- **Prima tappa senza spostamento e senza GPS.** Un tour si guarda ora e si
  cammina dopo, spesso da un altro punto: un avvicinamento sul GPS attuale
  sarebbe preciso e falso.
- `travelMinutes` ritorna **null e mai zero** su coordinate mancanti: zero
  direbbe "stesso posto", che e' un'affermazione.

**La UI dichiara la stima.** `formatEstimate` e' l'unico modo di mostrare una
durata (`~30 min`, `circa 1h 35min`), e un test asserisce che **nessun output sia
un numero secco**.

### Effetto collaterale gestito PRIMA di produrlo

Tolto `time` dagli schemi, il modello non lo produce piu' e `AiItinerary:626`
(`{stop.time || '--:--'}`) avrebbe mostrato `--:--` su ogni tappa. Ora il badge
non si monta finche' `time` e' null. Terzo punto di copy, obbligato e dichiarato.

### DIFF 1b — SBLOCCATO

`computeStopTimings` gira **dentro la stessa espressione** di `sortByProximity`
nei quattro call site: `stayMinutes` e `travelMinutesFromPrev` sono gia'
nell'ordine definitivo, e il calcolo **non puo' piu' finire prima
dell'ordinamento senza che si veda nel diff**. Il 1b poggia direttamente su
questi due campi.

### Marker

| marker | prima | dopo |
|---|---:|---:|
| `"suggestedMinutes"` negli schemi JSON | 3 | **0** |
| `"time": "HH:MM"` negli schemi JSON | 3 | **0** |
| `.suggestedMinutes` in codice vivo | 6 | **0** |
| `suggestedMinutes` nel bundle | 5 chunk | **0** |
| `--:--` nel bundle | 1 chunk | **0** |
| `stayMinutes` nel bundle | 0 | **2 chunk** |
| chunk JS / CSS | 77 / 130788 | **invariati** |
| suite | 461 | **493** |

### Device — il debito si allunga di quattro superfici

Badge minuti in **TourDetails**, durata sulle card **"Per Te"**,
`duration_minutes` del tour da **notifica**, e la timeline di **AiItinerary**
senza badge orario. Da guardare: che `~20 min` su una chiesa e `~1h` su un museo
siano plausibili sul campo, e che la colonna sinistra della timeline non
collassi senza l'orario.

Il debito precedente resta: **F55, F56, DIFF 4**, piu' il bottone Profilo a
piena larghezza (DIFF 6).


## Sessione 28/08 — GATE INTENT D3 chiuso (solo log)

Commit **`d45f54a`**. **513 test** (+20), build pulita, lint 0 errori / 199
warning (invariato). Suite verde anche senza `.env`.

**Questo diff non decide niente**, ed e' provato: quattro asserzioni
(`customKind` invariato, taglio a 20 invariato, soglie invariate,
`logScartiSoglia` void) e tre sonde con rosso mirato. Nessuna superficie
cambia: serve un giro device per **leggere** le righe, non per verificarne
l'effetto.

### Le quattro righe, e a quale domanda risponde ciascuna

| riga | domanda |
|---|---|
| `[Gate B] kind globale=… \| per-query: … \| 2/3 divergenti` | **quanto spesso** `categoria` (prodotta dal modello) e' incoerente con le query. E' il numero che manca per scegliere fra strada A e B |
| `[Gate B] merge: N candidati -> top 20 \| il piu' alto escluso: "…" score=…` | se il **taglio** mangia la famiglia richiesta. Era del tutto invisibile |
| `[Qualita] scartati N/M \| kind=… soglia=…` | se la **soglia** taglia, e **chi**. Prima muto, mentre `[AI-radius]` logga ogni scarto per distanza |
| `[Narratore] check avviato, N tappe` | che il **guard giri davvero** |

### IL CASO CHE SCIOGLIE TUTTO — leggerlo cosi' al prossimo giro

> **`0/3 divergenti` + la chiesa fra gli esclusi del merge**
> ⇒ **`categoria` e' INNOCENTE.** Il lavoro e' sul **ranking** (terzo diff),
> non su A ne' su B.

E il rovescio: se i divergenti sono molti **e** la famiglia richiesta compare
in `[Qualita] scartati`, allora e' la soglia, e la strada B chiude il difetto.

### A4 resta APERTO — due meccanismi candidati, nessuno provato

1. **Soglia FOOD** (`categoria=cibo` → `customKind=FOOD` → rating 4.2 anche
   sulla query "chiesa antica", contro il 4.0 di CULTURA). Difetto **reale e
   misurato**, ma **indebolito dallo scale-down** `[DVAI-060]`: se la soglia
   piena lascia meno di 3 candidati si scende a 3.8/1, quindi tre chiese
   entrerebbero comunque nel pool.
2. **Ranking top-20** (`:749-763`): le tre query diventano **un ranking solo**
   per `rating × ln(1+reviews)`, senza quota per query. Le chiese antiche
   minori (~300 recensioni) perdono strutturalmente contro ristoranti e musei
   milanesi (5.000-25.000). **Spiega il fenomeno senza bisogno che `categoria`
   sia sbagliata**, ed e' il candidato piu' forte.

### Il limite del log narratore, che e' controintuitivo

Usa `path=canonicalize`, non `path=google-first`: la funzione e' condivisa e non
sa da quale path e' chiamata. **Il segnale utile sta nell'ASSENZA** — se si
genera dal ramo AI-first legacy la riga **non compare affatto**, e quel silenzio
e' il dato che due path su tre sono coperti. L'obiettivo principale e' comunque
raggiunto: "gate eseguito" ora e' distinguibile da "gate mai eseguito".

### La correzione :1603 chiesta NON esisteva

Era stato chiesto `s.types` → `c.types`. In quello scope **`c` non esiste**: il
ramo e' AI-first legacy, il modello inventa il posto e non c'e' nessun candidato
Google. La riga valutava **sempre `[]`** fingendo di leggere qualcosa.
Sostituita con `[]` esplicito; la strada vera, se servira', e' `place/details`.

Ed e' stata la **terza ricaduta sulla #34**: il commento che spiegava la forma
vietata la conteneva, e il test e' diventato rosso su un commento.


## Sessione 28/08 (2) — GATE INTENT: taglio di sanita' geografica

Commit **`b6daeea`**. **531 test** (+18), build pulita, lint invariato. Suite
verde anche senza `.env`. Nessuna superficie cambia.

### Il difetto: il bias di Places non e' un vincolo

`textsearch` riceve `location` + `radius`, ma sono un **bias di rilevanza**, non
un filtro. E il testo della query contiene il nome della localita'
(`${query} ${cityName}`): per un borgo il cui nome e' anche un nome commerciale
comune, la ricerca trova omonimi in tutta Italia — con ottima corrispondenza
testuale. Device Ippocampo: **185, 279, 513, 532 km**.

**Il rumore non gonfiava solo un conteggio: RUBAVA SLOT.** Un omonimo con 2000
recensioni a 4.6 passa la soglia FOOD, sale in cima al ranking per qualityScore
e **occupa un posto di `maxResults`**, cacciando fuori un POI locale vero —
molto prima che `applyRadiusFilter` lo veda. Ad Ippocampo i quattro omonimi
possono aver contribuito ai 0 candidati **quanto il raggio**: due meccanismi,
non uno.

### Cosa e' entrato

`applyGeoSanity` in `placesDiscoveryService`, **dopo** le esclusioni hard e
**prima** di `applyQualityThreshold` — e' li' che il rumore comincia a fare
danni. Soglia **100 km**, con margine **legato da un test** a `R_wider` (12 km
borgo / 20 km citta'): fattore 5, e se un domani il raggio salisse sopra 20 il
test diventa **rosso** invece che il margine erodersi in silenzio.

**Nessun centro, nessuna decisione**: coordinate non finite → pool intatto e
nessun log. Vale anche per il singolo candidato. Un predicato che non puo'
decidere non decide.

Log come categoria a se': `[Places] rumore geografico: N oltre 100 km | piu'
lontano: "X" D km`. **Mai fuso con `[Qualita]`**, e un test lo asserisce: il
rumore dentro quel conteggio sarebbe un numero che nasconde invece di uno
gonfiato — lo stesso difetto girato.

### Due test esistenti riportati al loro intento

`notificheDistanza` usava **Capodimonte** (158 km da Ippocampo) come fixture per
provare `applyRadiusFilter`. Da oggi lo intercetta la sanita' **prima**:
comportamento finale identico, ma cambia **chi** scarta e il log che il test
cercava. Fixture spostate a **50 km** — dove a decidere e' ancora il raggio — piu'
un test nuovo che **documenta l'interazione** fra i due filtri invece di
lasciarla implicita.

E' la **#38 con esito opposto**: li' il test proteggeva un difetto e andava
corretto, qui protegge una cosa legittima e va riportato al suo intento, non
silenziato. Nota che vale oltre il test: quella fixture e' un **caso reale
documentato** — Capodimonte proposto in una notifica per Ippocampo.

### Perche' questo diff veniva per primo

**I numeri del prossimo giro dati sono leggibili.** Il denominatore di
`[Qualita]` non e' piu' gonfiato dagli omonimi, quindi il conteggio degli scarti
per soglia dice finalmente qualcosa — proprio nel momento in cui serve per
decidere fra i due meccanismi candidati di A4.

### Marker

| marker | prima | dopo |
|---|---:|---:|
| `[Places] rumore geografico` | 0 | **1** sorgente, **1** bundle |
| chunk JS | 77 | **77** |
| CSS | 130788 | **130788**, identico |
| suite | 513 | **531** |

Sul bundle: tutti gli hash cambiano, ma e' la **cascata**, non la #35 — CSS
byte-identico e il confronto sul **contenuto** dei chunk-foglia mostra che
l'unica differenza e' il riferimento all'entry. Il solo chunk realmente diverso
e' `placesDiscoveryService` (14742 → 15515 byte).


## Sessione 28/08 (3) — GATE INTENT: raggi riconciliati + F65

Due commit. **554 test**, build e lint puliti, entrambi in produzione.

### `37d2100` — il bias della ricerca segue il raggio massimo del filtro

Tre raggi convivevano scollegati: bias textsearch **3 km**, filtro **5**, widen
**12**. Il primo passo era il piu' stretto — si scartava prima di decidere.
`location`+`radius` sono un BIAS di rilevanza, non un vincolo: devono coprire il
raggio massimo APPLICABILE.

Misurato su API reale (query "chiesa antica"):

| | bias 3 km | bias 12 km |
|---|---:|---:|
| **Ippocampo** | **1** risultato | **4** (12.6, 13.5, 13.8, 14.1 km) |
| Manfredonia | 20 | 20, stesse distanze |
| Venezia | 20 | 20, stesse distanze |

**Il pool cresce solo dove era vuoto.** Dove l'offerta e' densa Google satura a
20 e li prende gia' tutti vicini, quindi il denominatore di `[Qualita]` non si
ri-gonfia — che era il rischio da escludere.

**CHIUDE UNA CAUSA SU DUE**: i 4 POI stanno a 12.6-14.1 km, cioe' **fuori da
`R_wider`=12**, e `applyRadiusFilter` li scarta comunque. Questo diff cambia
cosa viene **chiesto**, non cosa viene **accettato**. Un test lo asserisce.

`R_wider` da letterale inline a **`widerRadiusKm` esportata**: una fonte sola, e
un test lega bias e raggio massimo — se qualcuno alza l'uno senza l'altro, rosso.

**Cache**: prefix bumpato a `unnivai_poiv6_bias_`. La chiave conteneva `isSmall`
ma **non il radius**: senza bump, un client con cache calda avrebbe continuato a
servire i pool col bias stretto. **Un fix invisibile e' un fix non fatto.**

### `c319dfd` — F65: il traduttore riceve la frase, non la frase piu' il profilo

**Osservato**: "parchi e ville" a Milano → `queries=["trattoria tipica","osteria","bar"]`,
`categoria=cibo`. E "chiese e musei" dava `cultura` a Milano ma `cibo` a Ippocampo.

**Tre ipotesi smentite.** Estratto il system prompt reale e chiamato il modello
con l'input **pulito**:

| input | citta' | categoria |
|---|---|---|
| `parchi e ville` | Milano | **natura** ✅ |
| `chiese e musei` | **Ippocampo** | **cultura** ✅ |
| `chiese e musei` | Milano | storia ✅ |

Non era il nome citta'. Non era un esempio mancante per `natura` — l'esempio
c'e' ed e' proprio *"un giro nei parchi di Catania"*, e il modello lo usa: le
queries prodotte sono identiche a quelle dell'esempio. Non era la copia
dell'INPUT VAGO. **Il traduttore funzionava: gli arrivava un input falso.**

**La causa — `AiItinerary:122`**:
```js
const enrichedPrompt = [userPrompt, `[Profilo utente: ${aiProfile}]`]
```
Quel terzo argomento arriva a `translateIntentToQueries`, che lo mette nel campo
`Frase dell'utente: "..."`. Il modello leggeva:

> `Frase dell'utente: "parchi e ville [Profilo utente: … Evita se possibile: natura …]"`

**Gli dicevamo di evitare natura dentro una richiesta di parchi.** Misurato,
stesso prompt, sola differenza l'iniezione: pulito → `natura`, con profilo →
`cultura`.

**Errore di categoria**: il profilo serve al **selettore** (quale POI scegliere),
non al **traduttore** (cosa e' stato chiesto). E il selettore lo riceveva gia' —
**due volte**, dentro `richiesta utente` e come `profilo implicito`. Ora una
volta sola. Il profilo continua a influenzare **quale POI**, smette di
influenzare **cosa si e' chiesto**.

**Cache: nessun bump, ed e' il caso opposto ai raggi.** `intentCacheKey`
**contiene** il prompt: la chiave cambia da sola e la vecchia decade col TTL. Nei
raggi serviva perche' la chiave **non** conteneva il radius. Due casi opposti,
distinguibili solo guardando cosa c'e' **dentro** la chiave — mai per analogia.

### FINDING STRUTTURALE — il ciclo di retroazione del DNA. **Registrato, NON aperto.**

Piu' tour di un tipo generi → il grafo pesa quel tipo → il profilo influenza →
generi altri tour dello stesso tipo. **Il sistema si convince da solo, e piu'
l'utente lo usa meno riesce a chiedere qualcosa di diverso.**

F65 ne taglia il tratto piu' dannoso — il profilo non riscrive piu' *cosa e'
stato chiesto* — ma il ciclo **resta** dove e' legittimo, sulla scelta dei POI.

La domanda aperta, che e' di prodotto: **quanto un segnale esplicito deve battere
una statistica storica?** Con "non e' per tutti, e' per te", una frase scritta
adesso dovrebbe pesare piu' della media dei comportamenti passati. Oggi non c'e'
nessuna regola che lo dichiari. Imparentato con la **#39**: li' il motore ordina
per popolarita' mentre il prodotto promette il contrario; qui la personalizzazione
si auto-conferma mentre il prodotto promette di ascoltarti.

### Verifica sul campo — ✅ FATTA, F65 CONFERMATO

`[Gate B] intent tradotto` su **"parchi e ville" a Milano → `categoria=natura`,
`source=ai`**. Il tour esce con **Parco Sempione, Orto Botanico di Brera, BAM,
Parco di Villa Finzi**. Il caso osservato e' risolto.

**F55 verificato di striscio nello stesso giro**: le description dei quattro
parchi sono **specifiche per il posto e non intercambiabili** — *"il fruscio
delle foglie"*, *"una dolce fragranza di erbe aromatiche"* — e nessun contenuto
inventato. Il debito device su F55 si puo' considerare **saldato per il caso
natura**; resta il **caso religioso**, non ancora visto.

**F59 confermato, registrato e NON aperto**: i badge mostrano i `types` Google
**grezzi in inglese** (`park`, `monument`) invece della categoria italiana.

### Il residuo nel lessico, chiuso subito

Lo stesso giro ha mostrato **1/3 divergenti** nel log per-query: `"giardino
pubblico" → FOOD`. Causa: **`pub` dentro "pubblico"** — match a sottostringa
invece che a confine di parola, la **#11 applicata al lessico**.

L'audit dell'intero lessico ha trovato **14 falsi positivi** da quattro parole
corte, e il peggiore non era `pub`:

| parola | casi | esempio |
|---|---:|---|
| **`bar`** | 5 | **`chiesa barocca` → FOOD** |
| `pub` | 4 | `biblioteca pubblica` → FOOD |
| `spa` | 2 | `spazio espositivo` → RELAX |
| `cala` | 2 | `scala monumentale` → NATURA |

E **8 forme plurali** cadevano sul default perche' il lessico aveva solo i
singolari: `ristoranti`, `osterie`, `trattorie`, `parchi`, `ville`, `giardini`.
**Incluso `"parchi e ville"` → CULTURA, il caso stesso che ha aperto il gate.**

Corretto con confine di parola esplicito (`[^a-zà-ù]`, non `\b`, che in JS non
regge gli accenti: `caffè` finisce su `è`) e forme esplicite al posto delle
radici tronche — con il confine, `spiagg` non matcherebbe piu' nulla e sarebbe
una voce morta che finge di coprire.

**Il lessico resta DIAGNOSTICO**: non entra in `customKind`, alimenta solo il
log. Ma e' lo stesso che diventerebbe decisione con la soglia per query — **un
difetto che non morde ancora morderebbe il giorno esatto in cui gli si da'
potere.**

Due trappole del passaggio da sottostringa a parola sono registrate nella
**#41**: `\b` non regge gli accenti in JS, e una radice troncata diventa una
voce morta che finge di coprire.

**Deploy `b89ed02` verificato su tre livelli** (29/08):
- `commits/b89ed02/status` → `state: success`; check-runs *Lint & Test* ed
  *E2E Smoke* entrambi `completed/success`;
- entry servita cambiata: `index-5aMfnu5a.js` → **`index-CuPK3nfj.js`**;
- **contenuto** del bundle, non il nome del simbolo (che il minifier mangia):
  `archeologico`, `archeologica`, `spiagge`, `spiaggia`, `parchi`, `giardini`,
  `ristoranti`, `trattorie`, `pinacoteche` **presenti**; le radici tronche
  `spiagg` e `archeolog` **assenti**; la classe di confine `[^a-zà-ù]`
  **presente**.

### Costi API della diagnosi

10 `textsearch` + 10 Geocoding (raggi/viewport) + 9 `gpt-4o-mini` (F65).
Trascurabili, ma tracciati: **e' il metodo che ha trovato la causa**. Le fixture
non l'avrebbero mai mostrata, perche' il difetto stava in cosa arrivava al
modello, non in come il modello rispondeva.


## GATE INTENT — CHIUSO (28/08). Cinque diff, tutti in produzione.

| # | commit | cosa |
|---|---|---|
| 1 | `d45f54a` | **quattro righe di log** — misurare prima di decidere |
| 2 | `b6daeea` | **taglio di sanita' geografica** (100 km) — pulisce il segnale |
| 3 | `37d2100` | **raggi riconciliati** — bias = `R_wider` |
| 4 | `c319dfd` | **F65** — il traduttore riceve la frase, non la frase + il profilo |
| 5 | `b89ed02` | **lessico a parole intere** — non a sottostringhe |

Suite **582 test** (era 493 a inizio gate), lint 0 errori, tutti deployati e
verificati sul **contenuto** del bundle servito, non sull'hash.

### La strada abbandonata dai dati

**Raggio dal viewport** — sembrava il fix col miglior rapporto valore/costo e
**non lo era**. Misurato con l'API reale: Venezia **19.28 km** (il viewport e'
del COMUNE, non del centro storico: Mestre passerebbe col doppio del margine),
Ippocampo **0.66 km** (viewport della frazione: zero candidati garantiti),
`bounds != viewport` con **Milano a 83 km** sul campo sbagliato. Peggiorava in
**4 localita' su 6**, e la premessa "dato gia' pagato" era falsa — il campo
affidabile e' `bounds`, che `findplacefromtext` non restituisce.

**Cio' che resta vale piu' del fix mancato**: il viewport misura l'estensione
**amministrativa**, il raggio utile misura **dove sta l'offerta**, e sui due casi
noti vanno in **direzioni opposte**. Nessun dato geografico sul comune puo' dire
il raggio giusto — per questo la strada e' il **conteggio**.

### Il lessico, ultimo diff

**14 falsi positivi** da quattro parole corte col match a sottostringa, e il
peggiore non era quello osservato: **`chiesa barocca` → FOOD**, per `bar` dentro
"barocca". Piu' `pub` in "pubblico" (4 casi), `spa` in "spazio", `cala` in
"scala".

**8 forme plurali** cadevano sul default perche' il lessico aveva solo i
singolari — **incluso `"parchi e ville"`, il caso che ha aperto il gate**.

Due trappole del passaggio a match-per-parola, in **#41**: `\b` non regge gli
accenti in JS (`\bcaffè\b` fallisce), e una radice troncata come `spiagg`
diventa una **voce morta che finge di coprire**.

### Cosa e' cambiato nel metodo

Il gate si e' chiuso perche' a un certo punto abbiamo smesso di ragionare sul
codice e **abbiamo chiamato le API vere**: Places per i viewport e i candidati,
OpenAI per il traduttore con l'input pulito. **Le fixture non avrebbero mai
mostrato F65**, perche' il difetto stava in *cosa arrivava* al modello, non in
come rispondeva. Costo totale: 20 chiamate Places/Geocoding + 9 gpt-4o-mini.

---


## PROSSIMA SESSIONE — la coda, in quest'ordine

Una riga di contesto per voce, così si riapre senza rileggere tremila righe.

**0) ~~REDEPLOY~~** — **NON SERVE PIU'.** Il DIFF 6 e' in produzione dal 26/08
20:17Z, trascinato dal push del commit handoff `e94ad95` (il deploy diretto di
`102605e` era stato bloccato dal gate: vedi sessione 27/08). Verificato con curl
anonimo: entry `index-sVBp4KeF.js`, chunk `TourDetails-DR_Kih9F.js`, i tre
marker della chat finta **assenti**.
Resta la domanda aperta sul budget di fase A del gate — **da non toccare per
riflesso**, la nota sta nella sessione 27/08.


### DEBITO DEVICE — aggiornato al 28/08

| voce | stato |
|---|---|
| **F55** — description intercambiabili | ✅ **SALDATO per il caso NATURA** (i quattro parchi di Milano: *"il fruscio delle foglie"*, *"una dolce fragranza di erbe aromatiche"*, specifiche e non intercambiabili). ❌ **APERTO per il caso RELIGIOSO**, mai visto |
| **F56** — non affermare cosa accade *adesso* | aperto |
| **DIFF 4** — che i log `[Narratore] VIOLAZIONE` compaiano | aperto. Ora c'e' anche `[Narratore] check avviato`: se **non compare**, il guard non gira su quel path |
| **DIFF 1a** — quattro superfici | badge minuti **TourDetails**, durata card **"Per Te"**, `duration_minutes` **notifica**, timeline **AiItinerary** senza badge orario |
| **DIFF 6** — bottone **Profilo** a piena larghezza in TourDetails | aperto |

---

## PROSSIMA SESSIONE — la coda, in quest'ordine

**a) DIFF 1b — il calcolo degli orari.** Poggia su terreno **gia' misurato**:
`computeStopTimings` gira dentro la stessa espressione di `sortByProximity`,
quindi gli orari nascerebbero nell'**ordine definitivo** e il difetto di F57 non
puo' ripresentarsi. Serve il guard: nessun orario nel passato raggiunge la UI, e
test con l'ora **iniettata**, mai `new Date()` reale.
**Include A1**: `AiItinerary` non legge `stayMinutes` — non era fra i sei
consumatori del 1a e non mostrava durate nemmeno prima. Stessa timeline, stesso
diff: aprirla due volte e' sprecato. E il badge orario, oggi non montato perche'
`time` e' null, si riaccende qui.

**a-bis) DIFF 2 — l'ordinamento (F52).** *Tour generato alle 16:30 a Milano:
osteria, poi castello, poi basilica.* Va **dopo il 1b**, che potrebbe chiuderlo
da solo: se gli orari vengono calcolati nel codice dopo `sortByProximity`, la
contraddizione sparisce. Se resta aperto, il nodo e' che **due autorita'
ordinano** — il modello "in narrativa" e `sortByProximity` per vicinanza — e va
scelta una, che e' una decisione di prodotto. Qui dentro anche
`Math.hypot` → haversine (`sortByProximity` misura su gradi: a 45° un grado di
longitudine vale ~0.7 di uno di latitudine, quindi la metrica e' distorta).

**b) Raggio adattivo (F47)** — *POI proposti a **Mestre** per un tour di
Venezia; e a Ippocampo zero candidati.* **Unica causa aperta su Ippocampo**. I POI ora vengono
*chiesti* (4 invece di 1) ma stanno a **12.6-14.1 km** e il filtro a 12 li
scarta. **Vincolo doppio**: Venezia richiede l'**opposto** — fermarsi presto
quando i candidati abbondano. `allowWiden` esiste ma si ferma a una soglia fissa.
**Da misurare coi log prima di scriverlo**: cambia quali POI entrano nei tour
ovunque.

**b-bis) Verifica `spatial_ref_sys` count-prima / count-dopo** — l'unica prova
che manca all'indagine aperta dal 25/08. `SELECT count(*)`, poi `DELETE` di una
riga vera via REST con la chiave anon, poi `count(*)` di nuovo. Se cala, la
scrivibilita' e' dimostrata e il ticket (in bozza, mai inviato) va spedito; se
non cala, il 204 era vuoto e la diagnosi va rifatta. Riga da usare: uno SRID
**non** fra 4326/3857/4258/32633, con l'`INSERT` di ripristino pronto **prima**
di premere invio.

**c) GATE PREFERITI** — aperto dal DIFF 6, con **tre difetti gia' misurati** da
non ri-scoprire: due motori divergenti (`Explore.jsx:138` su localStorage vs
`dataService.toggleFavorite` su Supabase — regola locked #8), `getFavorites`
**inesistente** (si scrive e non si rilegge), e `toggleFavorite` che ritorna
`{success:true}` **anche dal `catch`**. Attenzione al vincolo che ha ucciso il
cuore: `favorites.tour_id` e' `UUID REFERENCES tours(id)`, ma i tour AI hanno id
`ai-quiz-…`. Finche' non e' chiuso, **nessun bottone preferiti in UI**.

**d) GATE CITTA'** — `user_city` sopravvive **oltre il TTL** e viene letto come
scelta manuale: la citta' vecchia vince su quella nuova.

**e) AUDIT SCHEMA → PERSISTENZA** — i tour AI non vengono salvati. **Sblocca
anche F53** (Esplora vuoto). Il piu' grosso: cambia il contratto dati, quindi va
dopo i piccoli, non prima — renderebbe illeggibili i giri device degli altri.

**f) A2 — il catch muto sulla quota.** `DashboardUser:293` cattura e scrive solo
in console: *"hai finito le generazioni di oggi"* e *"l'app e' rotta"* producono
**due skeleton identici**. Il fix non e' la quota, e' togliere il catch muto.

**g) Soglia per query** — **chiude META' difetto**, e va saputo prima di aprirla:
`intent.categoria` resta usato nel prompt selettore (`:912`, *"TUTTE le tappe
devono appartenere a questa categoria"*), quindi con una categoria sbagliata il
selettore riceverebbe comunque l'istruzione sbagliata. Il lessico e' pronto e
ora corretto; il **voto di maggioranza NON e' fattibile** (su tre query e'
rumore, e con `chiesa`/`trattoria`/`villa` una maggioranza non esiste).

**h) Bug minori, in un gate unico** — **F37, F39, F45, F46, F51, F54, F57
residuo, F58, F59**. Uno solo per non pagare nove volte il costo di apertura e
chiusura.

**i) FINDING STRUTTURALI — registrati e NON aperti.** Non sono bug: sono
tensioni fra il motore e la promessa del prodotto, e nessun test le coglie
perche' ogni singolo pezzo funziona.
- **#39 — il ranking premia la popolarita'.** `rating x ln(1+recensioni)`: piu'
  un posto e' nascosto, meno recensioni ha, e piu' certamente esce dai top-20.
  Il motore filtra via proprio cio' che *"non e' per tutti, e' per te"* promette.
- **Il ciclo di retroazione del DNA.** Piu' tour di un tipo generi, piu' il
  profilo spinge in quella direzione. F65 ne ha tagliato il tratto peggiore (il
  profilo non riscrive piu' *cosa e' stato chiesto*) ma il ciclo resta sulla
  scelta dei POI. La domanda e' di prodotto: **quanto un segnale esplicito deve
  battere una statistica storica?**

**j) Regola strutturale `if (url) setX(url)` senza `else`** — misura gia' fatta:
16 occorrenze, ~14 guardie legittime. Bersaglio vivo reale: **uno**. Una regola
larga sarebbe **l'88% eccezione**, cioe' la prossima `skip: true`. Se si apre, si
apre stretta.


### Problemi aperti (non in coda, ma vivi)

- **`spatial_ref_sys`** — indagine **APERTA**: scrivibilità **indiziaria**, non
  dimostrata (manca la prova al punto **b**). Rimedio bloccato su Supabase
  Support, ticket in **bozza**, mai inviato.
- **Funzioni `SECURITY DEFINER` eseguibili da `anon`** (WARN, mai gattato):
  `handle_new_user`, `record_completed_tour`, `complete_tour`,
  `search_nearby_partners`, `get_nearby_partners_for_tour`,
  `get_nearby_requests_for_guide`, `get_notifications_policies`. Più 14 funzioni
  con `function_search_path_mutable` e `auth_leaked_password_protection` spento.
  `handle_new_user` e `record_completed_tour` aperte ad `anon` meritano un gate.
- **DIFF 4 FASE C** — non aperta. **Condizione che la annulla**: se i log
  mostrano violazioni frequenti, il problema è il **prompt**, e annullare il
  campo mascherebbe un tour scadente. Si apre solo dopo aver letto log veri.
- **P3** (description triplicata) — mai attribuita.
- **F44** — perché uno step CI passa da 16s a 189s: causa ignota.
- **F38-bis** — la mappa a schermo intero non segue la selezione città.
- **F40, F41, F42** — non ancora collocati in nessun gate della coda.
- **F60 / F61 / F62** — chiusi il 27/08 (chat finta rimossa, toast in scope,
  cuore preferiti rimosso). Il difetto sotto F62 resta aperto: vedi **d-bis**.
  Nota di numerazione: **F57, F58, F59 non esistono** — si è passati da F56 a
  F60, non è un buco da colmare.
- **Accessibilità zero, e prima era mascherata.** `sr-only` era l'unica etichetta
  screen-reader del progetto e viveva dentro la chat finta rimossa da F60. Oggi
  l'app non ne ha nessuna. Non è un regresso introdotto dal DIFF 6, è un dato che
  il codice falso teneva nascosto.
- **`RequestModal:52`** dichiara `const { toast } = useToast()` e non lo usa.
  Innocuo, un lint warning.

---

## BLOCCO 3 — INTELLIGENZA ⏳ DA APRIRE

> ⚠️ **SEZIONE OBSOLETA** — corretta dal Gate DNA ONESTO (22/07, vedi sopra):
> il preference graph **alimenta** DashboardUser, `AiItinerary:195`,
> `QuickPath:624`, SurpriseTour; la telemetria nav **esiste** (`nav_events`).
> Vale la regola: in caso di conflitto vince il blocco datato più recente.

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
