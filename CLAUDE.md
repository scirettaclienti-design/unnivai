# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Corsia F. Prima di toccare un file, controlla docs/corsia-e-permessi.json: un file concesso a un branch estetica non si tocca finché il permesso c'è.** (Regole delle due corsie: `docs/PARALLELO.md`.)

## Commands

```bash
npm run dev       # Start dev server on port 5173 (strict port)
npm run build     # Production build
npm run lint      # ESLint check
npm run preview   # Preview production build
```

```bash
npm test                  # watch mode (Vitest)
npm run test:run          # single pass (CI)
npm run test:ui           # browser UI at localhost
npm run test:coverage     # coverage report (v8)
```

**Stack:** Vitest 3 + jsdom + @testing-library/react + @testing-library/jest-dom
**Location:** `src/__tests__/` mirrors `src/` structure.
**Mocks:** `src/test/mocks/supabase.js` exports `createQueryBuilder()`, `createSessionMock()`, `NO_SESSION`. Use `vi.mocked(supabase.from).mockReturnValue(createQueryBuilder({data, error}))` per test.
**Setup:** `src/test/setup.js` stubs `navigator.geolocation` and silences `console.error/warn` from dataService migration warnings.
**fetch mocking:** Use `vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok, json}))` for Nominatim calls in userContextService tests. Always pair with `vi.unstubAllGlobals()` in `afterEach`. Use `vi.resetAllMocks()` (not `clearAllMocks`) in `beforeEach` so mock implementations don't bleed between tests.

## Prove reali (generazioni vere)

`scripts/prova-reale/prova.live.js` (`PROVA_RICHIESTE=roma,catania,perte npx vitest run -c scripts/prova-reale/vitest.prova.config.js`).
Se `.env.local` ha `TEST_ACCOUNT_EMAIL` e `TEST_ACCOUNT_PASSWORD` entra con l'**account di prova**
(registrato in `public.ai_quota_test_account`, scrivibile solo da service_role): nessun tetto
personale, **tetto globale valido**, generazioni etichettate `label = 'test'` in
`ai_generation_ticket`. Senza quelle variabili resta ospite. Le credenziali vivono solo in
`.env.local` (ignorato da `*.local`): mai stamparle, mai committarle, mai nei report.
`PROVA_RICHIESTE=login` controlla solo l'accesso, senza chiamate AI.

**Banco nazionale** (`npm run banco`, `scripts/banco/`): 18 casi fissi (11 luoghi neutri, profili
A/B a Roma e Catania, Per Te solo tra le 9 e le 19, Troina→"una giornata a Roma") con l'account di
prova; scrive `docs/prove/AAAA-MM-GG-banco.md` (semafori) e il grezzo in `docs/prove/dati/`.
Soglie e prezzi in `scripts/banco/banco.config.json`. Si rilancia dopo ogni modifica del motore;
`BANCO_CASI=a-roma,…` per un sottoinsieme, `npm run banco -- --report <json>` per il solo report.

**Porta e titolo verificati prima di inserire credenziali.** Sulla 5173 gira spesso un'altra
app locale (aispace): `npm run dev` con strictPort fallisce e la pagina che risponde non e'
DoveVai. Il 10-11/10 le credenziali dell'account di prova sono finite nel login di aispace
(password poi ruotata). Prima di ogni prova nel browser:
1. scegli una porta libera (`lsof -iTCP:<porta> -sTCP:LISTEN` vuoto) e avvia
   `npx vite --port <porta> --strictPort`;
2. controlla che chi ascolta su quella porta sia il vite di questo repo (`lsof -p <pid> | grep cwd`);
3. apri la pagina e verifica che il titolo contenga "DoveVai";
4. solo allora inserisci le credenziali. Se un punto fallisce, fermati: niente credenziali.

## Environment Variables

Copy `.env.example` to `.env` and fill in:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_MAPS_API_KEY=
VITE_GOOGLE_MAP_ID=
VITE_PLACES_PROXY_ENABLED=true
VITE_OPENAI_API_KEY=   # Optional: enables real AI itinerary generation
```

All env vars must be prefixed with `VITE_` to be accessible via `import.meta.env`.

## Architecture Overview

**DoveVai** is a mobile-first React 19 + Vite SPA for Italian tourism. It connects travellers (esploratori), local guides, and businesses. The UI language is Italian.

### Provider Stack (outermost → innermost)
```
QueryClientProvider (React Query, 5-min stale cache)
  └── AuthProvider (Supabase auth + role)
        └── CityProvider (active city, GPS vs manual)
              └── Router → ErrorBoundary → Suspense → Routes
```

### Role-Based Routing

`RootDispatcher` (at `/`) redirects authenticated users by role:
- `explorer` / `user` → `/dashboard-user`
- `guide` → `/dashboard-guide`
- `business` → `/dashboard-business`
- unauthenticated → `/` (Landing page)

`RoleGuard` wraps protected route groups and enforces role access. Role is read from `user.user_metadata.role`, with fallback to `localStorage.getItem('unnivai_role')`.

All pages are lazy-loaded via `React.lazy()`.

### Path Alias

`@` resolves to `./src/` (configured in `vite.config.js`).

### Key Contexts

| Context | File | What it provides |
|---|---|---|
| `AuthContext` | `src/context/AuthContext.jsx` | `user`, `role`, `isAuthenticated`, `signOut`, `resetPassword`, `isPasswordRecovery` |
| `CityContext` | `src/context/CityContext.jsx` | `city` (default `'Roma'`), `setCity` (marks as manual), `isManual`, `resetToGPS` |

### Key Services (singleton class instances)

| Service | File | Responsibility |
|---|---|---|
| `dataService` | `src/services/dataService.js` | Supabase CRUD: tours, bookings, favorites, notifications, activities, businesses. Exposes `mapTourToUI()` which normalizes DB rows to the UI contract. |
| `aiRecommendationService` | `src/services/aiRecommendationService.js` | AI itinerary generation. Uses OpenAI GPT (if `VITE_OPENAI_API_KEY` set) or falls back to local mock data. Also handles business analysis via vision model. |
| `userContextService` | `src/services/userContextService.js` | Resolves effective city from manual override → GPS → Supabase profile → localStorage. Does reverse geocoding via Nominatim (OSM). |
| `weatherService` | `src/services/weatherService.js` | Provides weather data for the current city. |

### Key Hooks

- `useUserContext()` — composes GPS, auth, and CityContext into a single user context object (`city`, `firstName`, `temperatureC`, `toursCount`, `isGuest`). Used by dashboards and TopBar.
- `useEnhancedGeolocation()` — wraps browser GPS API, reverse geocodes to city name via Nominatim, falls back to Roma on error/denial.
- `useUserNotifications()` — `src/hooks/useUserNotifications.js`

### Supabase Schema

All migrations live in `supabase/migrations/`. Apply them in filename order. RLS base policies in `supabase/rls_policies.sql`.

**Canonical tables and their authoritative columns:**

| Table | PK | Key columns | Notes |
|---|---|---|---|
| `tours` | `id` | `city`, `guide_id`, `is_live`, `price_eur`, `duration_minutes`, `image_urls` | `price_eur` added by `migration_add_filters.sql` |
| `profiles` | `id` (= auth user id) | **colonne REALI, verificate su `information_schema` il 31/08**: `role`, `first_name`, `last_name`, `city`, `preferred_city`, `current_city_override`, `description`, `address`, `website`, `instagram_handle`, `menu_url`, `image_urls`, `ai_metadata`, `is_unlimited` | ⚠️ `full_name`, `avatar_url`, `bio`, `current_city`, `username` **NON esistono**: erano documentate qui e non sono mai state create. Il codice che le legge cade sui fallback |
| `bookings` | `id` | `tour_id`, `user_id`, `status` (`pending_request`→`accepted`/`declined`) | |
| `guide_requests` | `id` | `user_id`, `guide_id`, `tour_id`, `status` (`open`/`accepted`/`declined`/`completed`), `created_at`, `city`, `request_text`, `user_name`, `duration`, `category`, `notes` | Columns added across two migrations |
| `guides_profile` | `id` | `user_id` (unique), `license_number`, `piva`, `bio`, `status`, `type` (`pro`/`host`), `operating_cities[]` | Created in `20260303` migration |
| `explorers` | `id` (= auth user id) | `tours_completed`, `km_walked` | Created in `20260303` migration |
| `user_photos` | `id` | `user_id`, `tour_id`, `media_url` | Created in `20260303` migration |
| `favorites` | `id` | `user_id`, `tour_id` | Unique constraint on `(user_id, tour_id)` |
| `notifications` | `id` | `user_id`, `is_read` (canonical), `read_at`, `action_url`, `action_data`, `city_scope` | |
| `activities` | `id` | `city`, `name`, `latitude`, `longitude`, `category`, `tier`, `owner_id` | |
| `businesses_profile` | `id` | `company_name`, `city`, `category_tags[]`, `ai_metadata` (JSONB), `location` (PostGIS POINT) | |

### Runtime Schema Validation

`src/lib/schemas.js` exports three Zod v4 schemas that act as the authoritative data contracts:

| Schema | Validated in | Purpose |
|---|---|---|
| `TourUISchema` | `dataService.mapTourToUI()` — every call site | Catches DB→UI shape breaks (NaN rating, null images, missing guide fields) |
| `BookingInputSchema` | `dataService.createBooking()` before DB write | Catches bad form data (string price, missing tourId, invalid date format) before the silent-success fallback hides it |
| `NotificationUISchema` | `dataService.getNotifications()` per item | Enforces unified shape; surfaces the realtime vs REST divergence as logged errors |

Validation is **non-blocking** via `validateData(schema, data, label)` (defined in `dataService.js`). A failed parse logs `🚨 [Schema] Validation failed [label]: {fieldErrors}` to the console but always returns the original data so the UI is never broken by a schema change.

### Known Column Contract Issues (do not re-introduce)

- **`avatar_url` vs `avatar_emoji`**: ⚠️ voce da rileggere. `mapTourToUI:98` legge in realta'
  `image_urls` per primo, poi `avatar_url`, poi `avatar_emoji`, poi `'👋'` — e **nessuna delle
  due colonne intermedie esiste** su `profiles`. Funziona solo grazie a `image_urls`.
- **`is_read` is the canonical field** for notification read state. Do not use `read` or `read_at` as primary boolean. `subscribeToNotifications()` in `dataService.js` still uses `n.is_read` — keep it that way.
- **`price_eur` is prioritized** over `price` in `mapTourToUI()`. Both columns exist; `price_eur` requires `migration_add_filters.sql` to be applied.
- **`getPendingBookingsForGuide`**: parzialmente. `dataService.js:587` JOINa
  `profiles!user_id(first_name, last_name, image_urls)` — colonne reali, e su `bookings`
  la FK esiste (a differenza di `tours`). La vecchia dicitura citava `full_name, avatar_url`,
  che non esistono.
- **Explore.jsx direct supabase query**: ⚠️ **NON risolta, e non lo e' mai stata.** Questa voce
  diceva "RESOLVED (CRITICO-1)" ed era falsa. `Explore.jsx:99-103` embedda
  `profiles(username, first_name, last_name, image_urls, bio)` e risponde **400 PGRST200**:
  `tours` non ha **nessuna foreign key**, quindi PostgREST non puo' risolvere l'embed —
  nemmeno con l'hint `profiles!guide_id(...)`. In piu' `username` e `bio` non esistono.
  Stesso difetto in `dataService.js:332` (`subscribeToTours`). Misurato il 31/08.

### AI Itinerary Flow

`aiRecommendationService.generateItinerary()`:
1. Fetches simulated/real weather
2. If `VITE_OPENAI_API_KEY` is set → calls `gpt-3.5-turbo` with partner business context injected into the system prompt
3. Validates/geocodes AI-returned coordinates **via Google Places (proxy)** if missing —
   *non* via Mapbox
4. Falls back to `generateItineraryLocal()` with hardcoded city POIs + partner businesses from Supabase

Business injection into itineraries: `dataService.getBusinessesByCityAndTags()` scores `businesses_profile` rows using tag affinity mapping and injects up to 3 sponsors per tour. Missing coordinates are resolved via Nominatim and cached back to Supabase.

### Continuità della giornata (nessun buco, ogni tappa con il suo orario)

Un'attesa di oltre 45 minuti fra due tappe (`GAP_MAX_MINUTES`, `src/lib/continuity.js`) è un errore:
i momenti cominciano a ore fisse (pranzo 12:30) e con soste corte restavano ore vuote senza riga.
Nel flusso a momenti (`momentSelection.fillGaps`, dopo `settleOpeningHours`) il buco si chiude così:
1. si alza di uno le tappe del momento che lo contiene (solo mattina, pomeriggio, dopocena; mai i pasti,
   mai oltre 8 al giorno, mai con ritmo Rilassato) e si ripete la scelta con le regole di sempre
   (varietà, percorso, orari); il tentativo vale solo se dà una tappa vera in più, meno minuti di buco e
   nessun ripiego/tempo libero/tappa tolta in più;
2. se non c'è, il buco diventa una riga di tempo libero (`gapRows`, testo approvato) ancorata alla tappa
   che segue; `bandFreeTime` le dà la sua fascia (`stayMinutes` = l'attesa che stava sulla tappa dopo).
`computeCumulativeOffsets` non si rompe più su un tempo libero in testa al giorno. A schermo
(`AiItinerary`, `TourStopsByMoment`) il tempo libero mostra "HH:MM–HH:MM" (`freeTimeRangeLabel`).
Il banco ha la classe c11 (`scripts/banco/controlli.js`, soglia `esteso.buchiMinuti`).

### Composizione della giornata (C7): tema solo nei pasti, un pasto per fascia, niente zone

Un tema cibo (testo come «nei ristoranti tipici» / «da catanese», o `categoria=cibo` del traduttore, `src/lib/foodTheme.js`)
vale **solo per i pasti**: pranzo e cena sono cibo, l'aperitivo è un bar, mattina e pomeriggio sono **esperienze**
(`moment.tema = 'esperienze'`, ricerca mirata `esperienze`: mercato storico, palazzi, via storica; una sola per i due
momenti, dentro il tetto di 2). Non scatta più il filtro stretto di categoria per il cibo. `src/lib/mealRules.js`
(nei bucket di `bucketCandidates`, quindi anche per il riempimento dei buchi): un ristorante (tipo principale) sta solo a
pranzo e cena; la mattina un locale è una colazione; l'aperitivo è un bar. Eccezione: una richiesta esplicita per il
momento («il pomeriggio in pasticceria») → `moment.esplicito`, e con ristoranti chiesti `esplicitoPasti`.
`src/lib/zone.js`: un'area («Centro Storico Catania», tipo da zona, `route` come tipo principale) non è mai una tappa
(scartata in `discoverRealPOIs` e sul pool). «Tipico»: cucine estere escluse dai pasti, spinta ai posti locali
(`tipicoBonus`), dichiarato in `_tracciato.tipico`. Banco: c1 (il tipo principale decide cosa è un pasto, momento chiesto,
Per Te escluso), c2 anche ad aperitivo e dopocena, c12 (zone).

### La sera (C8a): drink da 45 minuti, passeggiata, Veloce serale

L'aperitivo è una sosta vera: **45 minuti, 60 con ritmo Rilassato** (`tourTiming.stayInMoment`; la sosta la porta il momento,
`sostaAperitivo`; il bar di giorno resta 20, le altre durate C6a non cambiano). Fra il drink e la cena, se restano **più di 30
minuti**, c'è una **passeggiata**: un momento facoltativo (`daySkeleton.addEveningWalk`, key `passeggiata`, a schermo sotto il
drink: `moment` = `aperitivo`, `passeggiata: true`), un solo luogo all'aperto (punti panoramici / passeggiata / natura, o fontana,
porta, ponte… per `mealRules.isOutdoorWalk`), **mai un secondo bar, mai un ristorante**, dentro il tetto di cammino e la deviazione C5c;
se il pool non ne ha una vicina si cerca **dalla tappa prima** (ricerca mirata C1b, budget suo: 3 ricerche in tutto, 2 per i momenti
veri). Niente passeggiata → il vuoto lo dichiara la CONTINUITÀ.
**Percorso Veloce dalle 18:00** (`veloce` in `buildDaySkeleton`, `pathType === 'quick'`): drink + passeggiata + **cena facoltativa**
(solo se un locale è aperto per tutta la sosta, arrivo entro le 23:00; altrimenti drink + passeggiata, mai 1 tappa). **Mai uno scheletro
vuoto**: una finestra senza momenti riceve il momento sera/notte (`daRiserva`). **"Quasi tutto chiuso" solo con zero tappe aperte.**
QuickPath passa ritmo e umore come Crea (`buildQuickPrefs`: Relax → Rilassato; Natura/Storia/Arte/Gusto/Fashion → l'interesse
omonimo). In un tour che parte di sera il drink è un bar (non un belvedere). Banco: `c4` estesa, `c13` (sera), `BANCO_RUN=sera`
(`report-sera.js`), `BANCO_DATA=AAAA-MM-GG` per il nome dei file.

### Minimi di tappe, cena tardi, Per Te nelle sue ore (C8b)

**Minimi** (`minStopsForWindow`, `src/lib/continuity.js`): finestra di 6 ore o piu' → almeno 4 tappe, da 3 a 6 ore → 3, meno di 3 → 2, mai 1;
le righe di tempo libero non sono tappe. `fillMinimum` (`momentSelection`, dopo `fillGaps`) alza di una le tappe dei momenti non-pasto e non-drink
(anche con ritmo Rilassato: il minimo e' un pavimento); se il pool non arriva, `belowMinimumRows` dichiara con una riga di tempo libero
(frasi approvate, mai un testo nuovo). Una sera completa (drink + cena, drink + passeggiata, cena + passeggiata) e' un giro completo (`isEveningComplete`).
**Cena tardi**: Veloce che parte fra le 21:00 e le 22:00 → prima la cena (facoltativa, solo aperti), poi la passeggiata, un drink solo se resta tempo
(`buildDaySkeleton({ cenaPrima })`); se nessun ristorante e' aperto per tutta la sosta il servizio ripiega sul giro C8a (drink + passeggiata) senza rifare la ricerca del cibo.
Prima delle 21:00 resta drink + passeggiata + cena, dopo le 22:00 drink + passeggiata.
**Per Te** (`generateHomeTours`): dalle 18:00 all'alba e' il giro della sera (`_homeSera` → `generateItinerary` Veloce, un solo tour, niente ricerche per temi);
di giorno restano i 4 temi con le stesse regole di Crea (`mealRules.perTeMealProblem`, via `keepOpenStops({ invalidAt })`): ristorante solo a pranzo e cena,
un solo pasto seduto per tour sotto le 3 ore, la mattina un locale e' una colazione (posto da colazione aperto per tutta la sosta), la ricerca del cibo segue l'ora
(`foodQueryForClock`: colazione prima delle 11, merenda dalle 14:45 alle 18). Banco: c1 vale anche per Per Te, c4 usa il minimo della finestra (`minimiTappe`, `finestraMinuti` nel grezzo).

### Pasti giusti: la sera si cena, la colazione chiesta c'è, un dolce solo e dopo (C8c)

**La sera si cena** (`momentSelection.repairPass`, momento facoltativo `cena` di Veloce e Per Te serale): la cena ha la precedenza sulla passeggiata. Se dal punto della
passeggiata nessun ristorante è a portata (tetto di cammino), si toglie la passeggiata e si sceglie la cena dalla tappa prima (drink → cena, entro `FREE_TIME_MAX_MINUTES`);
poi, se c'è, una passeggiata vicina al ristorante (entro il tetto dal drink e dal ristorante, deviazione C5c). Se nessun ristorante è a portata, al posto della cena c'è
la riga approvata «Nessun locale aperto qui vicino a quest'ora.» (`report.tempoLibero`, `chiuso`+`pasto`), anche per la cena tardi di C8b (`cenaTardiMancante`) e per la
cena dovuta di Crea/Sorprendimi senza ristoranti nel pool. Una sera che parte dopo le 23:00 non ha cena né riga.
**Colazione chiesta** (`foodTheme.asksBreakfast`: colazione, brunch, cornetto, cappuccino, brioche; non «la mattina in pasticceria»): se il tour parte prima delle 11:00 la mattina
parte all'ora chiesta (`buildDaySkeleton`, `colazione: true`, una tappa in più) e la PRIMA tappa è un posto da colazione aperto per tutta la sosta (`repairPass`, `isBreakfastPlace`);
se il pool non ne ha, ricerca mirata `colazione` (`FOOD_QUERY_COLAZIONE`, dentro il tetto di 2); se nessuno è aperto, riga approvata in testa. Senza la richiesta, la regola C7 non cambia.
**Un dolce per tour** (`mealRules.dolceProblem`, via `perTeMealProblem` → `keepOpenStops({ invalidAt })`, solo Per Te di giorno): al massimo un dolce/gelato/pasticceria (tipo, tipi Google o nome:
anche un bar che è gelateria), sempre dopo un pasto (a pranzo dopo un ristorante, di mattina dopo un caffè/forno), mai come prima tappa prima delle 14:45. La ricerca dolci a pranzo di C8b è tolta.
Banco: c1 conta i dolci, c13 la sera senza cena, la voce «Giornata» vale solo per finestre da 6 ore (una sera è completa con drink + cena o cena + passeggiata), `BANCO_RUN=pasti` (`report-pasti.js`).

### I vuoti giusti: mattina presto e pomeriggio lento (C8d)

**Dopo la colazione chiesta** (`repairPass`, `dopoColazione`): fino al pranzo nessun altro locale (caffè, bar, pasticceria, gelato); restano visite aperte per tutta la sosta (ORARI), nessuna ricerca in più.
**Ritmo Rilassato** (`fillGaps`, `GAP_RILASSATO_MINUTES = 90`, `mealRules.isLightStop`): fino a 90 minuti di vuoto resta CONTINUITÀ (tempo libero dichiarato, nessuna tappa in più);
oltre, UNA sola tappa leggera per momento (luogo all'aperto, verde, chiesa, o un caffè — tipo caffè o `cafe`/`coffee_shop` fra i tipi —, mai un dolce né un bar da drink), aperta per tutta la sosta
e dentro le soglie C5c (`moment.extraLeggero`). Banco: `BANCO_RUN=vuoti`.

### Il tetto conta le visite, la tappa leggera segue il tipo principale (C8e)

**Il tetto conta solo le visite** (`daySkeleton.visitStops`/`visitCount`, `MAX_VISITS_PER_DAY = 8`, `MAX_VISITS_RILASSATO = 6`, scritto nei momenti come `tettoVisite`): una visita è una tappa di mattina o pomeriggio, tolta la colazione chiesta;
pasti, drink, dopocena e passeggiata non contano. Lo applicano `capStops` (scheletro) e `momentsToExpand`/`momentsForMinimum` (riempimento). **Tappa leggera** (`isLightStop`): luogo all'aperto, verde, chiesa, o un caffè *per tipo principale* (C6a):
un posto con tipo principale ristorante (Corner AB) non entra. Una per momento. Il riempimento si ferma comunque quando i tentativi non danno una tappa valida (varietà, percorso, orari). Banco: `BANCO_RUN=tetto`, caso `crea-catania-0930`.

### City Data Flow

**T1 — in "Crea il tuo percorso" la città scritta nel testo vince sulla posizione.**
`generateItinerary(..., { pathType: 'custom' })` chiama prima `resolveTextDestination`: il
traduttore restituisce anche `citta` (o null); "via Roma"/"piazza Roma" non contano
(`src/lib/textDestination.js`); UNA `findplacefromtext` la conferma (`confirmCityFromText`).
Confermata → si genera lì, `result.destination.note` = "Tour a Roma (dal tuo testo)".
Non sicura → resta la posizione con "Non ho riconosciuto la città: uso la tua posizione".
Il giorno ("domani", "sabato") lo legge `src/lib/tourWindow.js`. Per Te/Veloce/Sorprendimi: invariati.

The `city` value is resolved through a priority chain managed by `userContextService` (la *posizione*):
1. **Manual** (user selects in TopBar → `CityContext.setCity()`)
2. **GPS** (`useEnhancedGeolocation` → Nominatim reverse geocode)
3. **Supabase profile** (`profiles.current_city_override` for authenticated users — *non* `current_city`, che non esiste)
4. **localStorage** (`user_city` key)
5. **Fallback** hardcoded `'Roma'`

`useUserContext()` merges the GPS hook output with CityContext and sanitizes coordinate strings that can leak from GPS failures (pattern `"Lat: X.XX, Lon: Y.YY"`).

`CityContext.resetToGPS()` exists but is not wired to any UI button.

### UI Conventions

- Styling: Tailwind CSS v3 with `tailwindcss-animate` plugin. `clsx` + `tailwind-merge` for conditional classes (via `src/lib/utils.js`).
- Animations: Framer Motion.
- Icons: Lucide React.
- Map: **Google Maps** via `@vis.gl/react-google-maps` (`MapAPIWrapper` → `APIProvider`,
  `UnnivaiMap` → `GoogleMapContainer`), chiave `VITE_GOOGLE_MAPS_API_KEY`.
  Lo **stile** della mappa NON vive nel repo: sta nello stile cloud legato al Map ID
  (`VITE_GOOGLE_MAP_ID`, fallback `28861a61c07876f819652d2d`), in Google Cloud Console.
  Mapbox/`react-map-gl` sono in `package.json` ma **non usati da nessun codice vivo**.
- Brand color: orange-500 (`#f97316`). Loading spinners use `border-orange-500`.
- The app displays Italian text throughout. City defaults to `'Roma'` as fallback everywhere.
- Demo/fallback data lives in `src/data/demoData.js`.
