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
(registrato in `public.ai_quota_test_account`, scrivibile solo da service_role): **nessun contatore**
(né personale né globale: `ai_quota_daily` resta a 0, così il preflight del client non lo ferma), generazioni
etichettate `label = 'test'` in `ai_generation_ticket`; il tetto globale lo ferma solo se è già pieno
(migrazione `20261021_ai_quota_test_senza_contatori.sql`). Senza quelle variabili resta ospite. Le credenziali vivono solo in
`.env.local` (ignorato da `*.local`): mai stamparle, mai committarle, mai nei report.
`PROVA_RICHIESTE=login` controlla solo l'accesso, senza chiamate AI.

**Banco nazionale** (`npm run banco`, `scripts/banco/`): 18 casi fissi (11 luoghi neutri, profili
A/B a Roma e Catania, Per Te solo tra le 9 e le 19, Troina→"una giornata a Roma") con l'account di
prova; scrive `docs/prove/AAAA-MM-GG-banco.md` (semafori) e il grezzo in `docs/prove/dati/`.
Soglie e prezzi in `scripts/banco/banco.config.json`. Si rilancia dopo ogni modifica del motore;
`BANCO_CASI=a-roma,…` per un sottoinsieme, `npm run banco -- --report <json>` per il solo report.

**Si lavora solo da `unni <modello>` nell'app Terminale** (`~/bin/unni`, alias `unni` e `dv` in `~/.zshrc`; modelli `sonnet|opus|fable`): apre Claude Code in `~/unnivai-1b` dopo aver mostrato cartella, ramo, stato rispetto a GitHub e commit in produzione su unnivai.vercel.app. La cartella «unnivai ricresa» è archiviata: non si apre più.

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
OPENAI_API_KEY=   # SOLO server (segreto di Supabase per openai-proxy): mai con prefisso VITE_, mai nel client
```

Le variabili che il browser deve leggere hanno il prefisso `VITE_` (`import.meta.env`) e sono pubbliche per natura (Supabase anon, Google Maps, Map ID). **Un segreto non ha mai il prefisso `VITE_`** (finirebbe nel sito): `OPENAI_API_KEY` vive solo nei segreti di Supabase. `scripts/controlla-chiavi.mjs` (CI) blocca le chiavi nei file tracciati e in `dist/`.

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
| `aiRecommendationService` | `src/services/aiRecommendationService.js` | AI itinerary generation. Uses OpenAI GPT (via `openai-proxy`, la chiave `OPENAI_API_KEY` sta solo sul server) or falls back to local mock data. Also handles business analysis via vision model. |
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
2. Via `openai-proxy` (chiave `OPENAI_API_KEY` solo sul server) → calls `gpt-3.5-turbo` with partner business context injected into the system prompt
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
Banco: c1 conta i dolci, c13 la sera senza cena (dovuta solo nei giri che partono **prima delle 22:00**, VERITÀ-PRE-GIRO), la voce «Giornata» vale solo per finestre da 6 ore (una sera è completa con drink + cena o cena + passeggiata), `BANCO_RUN=pasti` (`report-pasti.js`).

### I vuoti giusti: mattina presto e pomeriggio lento (C8d)

**Dopo la colazione chiesta** (`repairPass`, `dopoColazione`): fino al pranzo nessun altro locale (caffè, bar, pasticceria, gelato); restano visite aperte per tutta la sosta (ORARI), nessuna ricerca in più.
**Ritmo Rilassato** (`fillGaps`, `GAP_RILASSATO_MINUTES = 90`, `mealRules.isLightStop`): fino a 90 minuti di vuoto resta CONTINUITÀ (tempo libero dichiarato, nessuna tappa in più);
oltre, UNA sola tappa leggera per momento (luogo all'aperto, verde, chiesa, o un caffè — tipo caffè o `cafe`/`coffee_shop` fra i tipi —, mai un dolce né un bar da drink), aperta per tutta la sosta
e dentro le soglie C5c (`moment.extraLeggero`). Banco: `BANCO_RUN=vuoti`.

### Il tetto conta le visite, la tappa leggera segue il tipo principale (C8e)

**Il tetto conta solo le visite** (`daySkeleton.visitStops`/`visitCount`, `MAX_VISITS_PER_DAY = 8`, `MAX_VISITS_RILASSATO = 6`, scritto nei momenti come `tettoVisite`): una visita è una tappa di mattina o pomeriggio, tolta la colazione chiesta;
pasti, drink, dopocena e passeggiata non contano. Lo applicano `capStops` (scheletro) e `momentsToExpand`/`momentsForMinimum` (riempimento). **Tappa leggera** (`isLightStop`): luogo all'aperto, verde, chiesa, o un caffè *per tipo principale* (C6a):
un posto con tipo principale ristorante (Corner AB) non entra. Una per momento. Il riempimento si ferma comunque quando i tentativi non danno una tappa valida (varietà, percorso, orari). Banco: `BANCO_RUN=tetto`, caso `crea-catania-0930`.

### I testi a schermo: italiani, concordati, onesti, mai ripetuti (TESTI)

**Tempo libero**: sempre «Tempo libero», la fascia «HH:MM–HH:MM» e «Niente in agenda: cammina dove ti porta la strada.» (`stopPhrases.composeFreeTime`; la riga «Nessun locale aperto qui vicino a quest'ora.» di un pasto senza locali aperti resta).
**Etichette di tipo** (`src/lib/italianLabels.js`, `typeLabelOf`): dal tipo principale di Google, sempre in italiano (restaurant → ristorante, bar/cocktail_bar → bar, cafe → caffè, church → chiesa, monument/tourist_attraction → monumento…); un tipo senza traduzione non ha etichetta, mai la parola inglese. Il tipo interno `type` della tappa (tutti i locali sono `restaurant`) non si mostra più.
**Meteo**: in italiano (`weatherLabel`: sereno, nuvoloso, pioggia…); solo per un tour di oggi (`weatherForDay`), mai il meteo di adesso su un altro giorno.
**Meteo vero o niente** (VERITÀ-PRE-GIRO): `weatherService` risponde `null` se la rete cade, la risposta è incompleta o il codice WMO è sconosciuto (niente più `getFallbackWeather`, «sunny, 24°»); il badge della mappa non compare; le pagine passano `?? null` (mai `|| 'sunny'`, `|| 20`).
**Frasi vere** (`stopPhrases`): «Qui la giornata si chiude» e «Chiudi la giornata a tavola» solo sull'ultima tappa di un giro che arriva alla sera (dalle 18:00); «Si parte da…» solo sulla prima; ogni durata scritta è la sosta vera (`{durata}`, «venti minuti»); numero e parola concordati («un minuto», «È a un minuto a piedi»); i nomi senza barre rovesciate (`senzaEscape`).
**Dopocena**: dalle 21:30 all'alba il momento del drink (`aperitivo`) si intitola «Dopocena» (`stopMoments.stopMoment`, le sezioni si raggruppano per nome), la frase è «Il drink lo prendi da…». **Prezzi**: «con prezzi bassi / medi / alti», mai «fascia €».
**Titolo**: «Giorno N a X» solo nei tour di più giorni (un giorno: «Il tuo giro a X»; il navigatore dei giorni solo con più giorni). **Saluto**: il nome ha l'iniziale maiuscola (`capitalizeName`); senza nome nel profilo «Ciao!» (decisione di Ivano): **mai un nome ricavato dalla mail** (`email.split('@')` vietato in `src`, lo controlla un test).
**Nessuna frase uguale due volte nello stesso tour** (`composeDays`, `registraFrasi`, `maschera`, come il controllo c7 del banco): la scelta cade fra le frasi approvate esistenti — quelle della famiglia, poi quelle delle famiglie sorelle (`SORELLE`), poi le generiche —,
un gancio già detto non si ripete. Prestiti (VERITÀ-PRE-GIRO, `frasePossibile`): «Attraversi…» solo a piazza/passeggiata, porta, arco (mai a una chiesa, un palazzo, un luogo qualunque); «Ti fermi davanti a…» solo a monumento, porta, arco, chiesa. Finite le frasi approvate la ripetizione resta (si propone nel report, mai una frase nuova). Banco: c8 segna anche «Aperitivo» dopo le 21:30, «fascia €», il numero del giorno in un tour di un giorno; c1 non conta come dolce un bar scelto per l'aperitivo o il drink; `BANCO_RUN=testi`.

### La lista della città: l'AI propone, Google verifica, le regole compongono (C10)

**Una lista per città e per giorno, uguale per tutti** (`public.city_knowledge`, chiave città + giorno + versione del prompt; solo service role, nessuna policy). La fa `openai-proxy` con `dv: { purpose: 'city_list', citta, giorno }`: se c'e' la restituisce (niente OpenAI, niente quota), altrimenti una chiamata AI col prompt scritto nel proxy (`supabase/functions/openai-proxy/cityKnowledge.ts`, `CITY_LIST_VERSION`), 15 posti (nome, momento, essenziale | da locale, un perche'), al massimo 4 essenziali, mai un locale come essenziale.
**Verifica sul server**: ogni nome passa da places-proxy («nome, città», stessa maschera e stessa cache del motore, centro con `findplacefromtext`, raggio 20 km città / 12 borgo); entra solo se trovato, nome compatibile (`nomeCompatibile`: parole generiche da sole non bastano), nel raggio, non chiuso per sempre. Gli scartati restano col motivo. **Il «perche'» non esce mai dal server** (decisione M).
**Nel motore** (`_generateItinerary`, `src/services/cityKnowledgeService.js`, `src/lib/cityKnowledge.js`): la lista parte in parallelo, i verificati entrano nel pool come risultati di ricerca e passano per tutti i filtri; i «da locale» e gli essenziali candidati ad ancora stanno davanti e **fuori dal merito** (non contano nei 20 ne' nel tetto delle icone: decisione di Ivano su P7a); le **ancore** (max 3 in giornata intera, 1 in mezza, una per famiglia, mai un locale, solo se un momento le ammette) si seminano in testa al loro momento e valgono solo se le regole le tengono; le altre perdono la priorita' (`declassa`). `momentSelection.bonusLista`: ancora +1, da locale +0,2. Senza lista (proxy giu') il giro esce come prima. Nei test la lista e' spenta per difetto (`src/test/setup.js`).
Banco: `BANCO_RUN=c10`, voci nuove in `scripts/banco/asticella-c10.js` (conosce la città, giornata piena, su misura, invenzioni, costo e tempo), report `report-c10.js`.

### Ancore che restano, tre scale, il simbolo (C10b)

**Un'ancora scelta resta** (`momentSelection.isAncora`): il riparatore la tiene salvo una regola dura — il tetto di cammino (orari e pasti stanno già nei bucket; `settleOpeningHours` la vieta se è chiusa) —; strada, deviazione, varietà non la tolgono. La rifinitura (`polishRoute`) non la sostituisce, salvo per togliere un tratto oltre il tetto. Ogni ancora tolta va in `report.ancoreTolte` col motivo («regola dura: …»); l'esito di ogni ancora seminata in `_citta.ancoreEsito`. `seminaAncore` non mette in un momento più ancore delle sue tappe.
**Tre scale** (decisione di Ivano; colonna `city_knowledge.scala`; dal prompt `c10b-2` l'AI dà gli abitanti e il codice ricava la scala, vedi C10b2), il motore conferma col **diametro** della lista (distanza massima fra due essenziali verificati, `SOGLIA_METROPOLI_KM = 2`: metropoli solo oltre, borgo solo entro; altrimenti città; `scalaConfermata`). **Borgo**: al massimo 8 nomi, verifica «nome, comune, provincia» (provincia dall'indirizzo del centro), raggio del comune `RAGGIO_BORGO_KM = 5` e indirizzo nel comune (`nelComune`: mai un posto fuori comune); con meno di 4 verificati e una giornata intera → mezza giornata (240 min) con la riga «X si gira in mezza giornata.» (`day.scalaNote`, a schermo in AiItinerary). **Città**: come C10. **Metropoli**: fino a 20 posti, ciascuno col suo quartiere (al massimo 2 essenziali per quartiere); in un giro di un giorno il motore sceglie il quartiere nominato nella richiesta, altrimenti quello con più ancore aperte (a parità il più vicino alla partenza) (`scegliQuartiere`); pool, lista e ricerche mirate stanno nel cerchio del quartiere (raggio = tetto di cammino 1,5 km, fino a 2,5 se gli essenziali del quartiere stanno più lontani: un quartiere vicino entra solo per la parte dentro); le ancore sono gli essenziali del quartiere scelto.
**Simbolo**: il prompt chiede fra gli essenziali il posto che un abitante non ti perdonerebbe di saltare (uno per lista, uno per quartiere in metropoli); senza, il primo essenziale (`simboloDedotto`). È la prima ancora.
Banco: «conosce la città» in metropoli = ≥ 2 ancore del quartiere scelto + metà delle visite dalla lista; un borgo si misura anche in mezza giornata. Il runner stima ogni caso prima di lanciarlo (`esteso.stimaCaso` in `banco.config.json`) e si ferma dopo un caso che passa il tetto.

### Modello nuovo, metropoli in due quartieri, borghi veri (C10b2)

**Il modello di ogni passaggio** (decisione di Ivano; un solo punto: `supabase/functions/openai-proxy/modelli.ts`, `MODELLI`):
| Passaggio | Modello | Tempo massimo | Chi chiama |
|---|---|---|---|
| lista della città (abitanti + lista) | `gpt-6.1-sol` | 60 s per chiamata (il client aspetta 110 s) | proxy (`city_list`) |
| lista dedicata del quartiere | `gpt-6.1-sol` | 60 s | proxy (`quartiere_list`) |
| traduttore | `gpt-6.1-sol` | 15 s | client, `dv.passaggio = 'traduttore'` |
| selettore | `gpt-6.1-sol` | 22 s (il client aspetta 50 s) | client, `dv.passaggio = 'selettore'` |
| narratore (frasi chiuse) | `gpt-4o-mini` | 25 s | client, `dv.passaggio = 'narratore'` |
Il client manda sempre `gpt-4o-mini` e il passaggio; il proxy usa il modello del passaggio e, se non risponde, sbaglia, risponde vuoto o va oltre il tempo, rifà la chiamata con `gpt-4o-mini` (`MODELLO_DI_PRIMA`, `chiamaConRipiego`); la risposta lo dice (`_modello`: chiesto, usato, ripiego, motivo), il giro lo riporta in `_modelli`. `gpt-6.1-sol` ragiona: niente `temperature`, `max_completion_tokens` (+3000 di margine per il ragionamento, tetto 8000) al posto di `max_tokens`, `reasoning_effort: 'low'` (`corpoPer`). Per Te e le chiamate di contorno restano su `gpt-4o-mini`. Prezzi per modello nel banco: `prezziUsd.openaiPerModello`.
**Scale** (decisione di Ivano): l'AI dice gli abitanti del comune, il codice ne ricava la scala (`scalaDaAbitanti`): **borgo sotto 30.000 abitanti, metropoli da 800.000**, altrimenti città; il motore conferma con la **distanza fra gli essenziali verificati oltre 2 km** per la metropoli (entro 2 km per il borgo; altrimenti città).
**Metropoli** (lista `c10b-4`): raggio del quartiere **2 km**, centro = **baricentro dei posti verificati** del quartiere. In giornata intera (6 ore o più) la **mattina in un quartiere e il pomeriggio in un quartiere vicino** (centri entro 3 km: i cerchi si sovrappongono e il passaggio sta nel tetto C5c, che non cambia), il pranzo in uno dei due (`bucketsNelleAree`); salvo che la richiesta nomini un quartiere: allora vale solo quello, anche senza essenziali. Senza richiesta un quartiere si sceglie solo se ha almeno 1 essenziale verificato. Un quartiere chiesto con meno di 3 luoghi da visitare in lista riceve la sua **lista dedicata** (6–8 luoghi, verificati come la lista, una per città, giorno e quartiere: `city_knowledge.versione = 'c10b-4#q:<quartiere>'`); i suoi luoghi sono le ancore candidate.
**Borgo**: l'AI dà anche la categoria di ogni posto; se nessun nome di Google è compatibile si accetta il risultato **dentro il comune con la stessa categoria** (`categoriaGoogle`), e la sostituzione si scrive (`_citta.sostituzione`, `_citta.sostituzioni` nel tracciato). Con meno di 4 posti la **durata segue le tappe** (`durataBorgoCorto`: 45 min per luogo da visitare, 2–4 luoghi), niente tempo libero per riempire la mezza giornata; la riga «X si gira in mezza giornata.» resta.

### La lista bilanciata (C10b3, lista `c10b-5`)

**Composizione a quote** (`cityKnowledge.ts`, `QUOTE`, `CATEGORIE`): citta' e metropoli almeno 8 luoghi da visitare (piazze e belvedere al massimo 2), 3–4 ancore col simbolo, 1–2 colazioni, 1 mercato, 2 pasti, 1 dopocena; metropoli almeno 3 luoghi da visitare per quartiere principale; borgo al massimo 8 nomi, almeno 4 luoghi da visitare e la via principale (`passeggiata: true`). Ogni posto ha la `categoria`.
`quoteLista` controlla, `completaLista` fa **una sola** richiesta di completamento se mancano luoghi da visitare (aggiunte «da locale», mai ancore); quote in `costo.quote` e `cityKnowledge.quote`. Un locale non e' mai essenziale; il simbolo e' un luogo da visitare (mai piazza, belvedere, via, mercato).
**Metropoli**: il motore aspetta la lista, sceglie il quartiere e fa le ricerche iniziali dal suo centro (`biasMeters` → `radiusMeters`, `_citta.centroRicerche`).
**Borgo**: la via principale vale come passeggiata e la regola delle zone non la toglie (`_citta.viaPrincipale`); il giro corto va nella fascia in cui i posti della lista sono aperti per una sosta intera (`fasciaApertaBorgo`).
Fase A del 14/10: cancello non passato (`docs/prove/2026-10-17-c10b3-lista-bilanciata.md`).
**C10b3-bis (lista `c10b-6`)**: in citta' e metropoli le piazze monumentali e le vie storiche sono una categoria a se' (2–3, fuori dagli 8 luoghi da visitare; le vie valgono come passeggiata), belvedere al massimo 1, mercati 1–2, ancore anche piazze o vie (il simbolo no), dopocena obbligatorio; `completaLista` fa UNA richiesta per tutte le quote mancanti (luoghi, piazze e vie, ancore — anche promuovendo un posto gia' in lista —, dopocena). Il borgo resta C10b3. Un errore di `gpt-6.1-sol` (non il tempo scaduto) ha un nuovo tentativo prima del ripiego (lista, traduttore, selettore); `costo.usage` conta tutte le chiamate (`usageTotale`). Nessun nome delle liste di controllo del banco nel prompt della lista. Fase A: cancello non passato su Napoli e Roma (`docs/prove/2026-10-17-c10b3bis-quote-corrette.md`).
**C10b3-ter (lista `c10b-7`, v23)**: tre varianti del prompt (`VARIANTI_LISTA`, `promptCitta(…, variante)`): A (v22), B (2 ancore per quartiere, «dove un abitante porta un amico»), C (prima GLI IMPERDIBILI — citta' 5–6, metropoli 6–8, campo `imperdibile` —, poi i posti da abitante; ancore e simbolo solo dagli imperdibili, imposto da `leggiLista`). In produzione la **C** (`VARIANTE_LISTA`), scelta in A0 su liste grezze (script `scripts/prova-reale/c10b3ter-a0.live.js`: proxy generico, passaggio `lista`, niente salvato). La lista del quartiere resta A. Il banco controlla il **simbolo atteso** (`SIMBOLO_CONTROLLO` = primo nome di ogni lista di controllo, `simboloGiusto`: il primo simbolo segnato dall'AI, mai uno dedotto). Il prompt del traduttore non ha nomi di citta' del banco. Fase A: cancello non passato per il simbolo di Napoli (Castel Nuovo invece del Duomo) (`docs/prove/2026-10-17-c10b3ter-imperdibili.md`).
**C10b3-chiusura**: il banco accetta per ogni citta' un insieme di simboli deciso da Ivano (`SIMBOLI_ACCETTATI` in `asticella-c10.js`, al posto del «primo nome»): Roma {Colosseo}, Napoli {Castel Nuovo, Castel dell'Ovo, Duomo}, Catania {Fontana dell'Elefante, Cattedrale di Sant'Agata}, Palermo {Cattedrale, Palazzo dei Normanni}, Lecce {Santa Croce, Duomo}, Troina {Chiesa Madre}. La variante C non si applica al borgo. Fase A passata su 6 citta'; fase B: obiettivi C10b3 non raggiunti salvo «Conosce la citta'» (9/10), Trastevere ignorato se il quartiere non e' nella lista (`docs/prove/2026-10-17-c10b3-chiusura.md`). Casi `c10b3-attesa-roma`/`-lecce` (lista da generare) in `casi-esteso.js`.

### I posti della lista che si perdevano (C10c-piena-1)

Diagnosi in `docs/prove/2026-10-17-c10c-diagnosi-perdite.md`; decisioni di Ivano:
- **ORARI all'arrivo** (la garanzia resta): `applyOpeningToBuckets` tiene nel bucket un posto chiuso all'inizio del momento se apre piu' tardi nello stesso momento per tutta la sosta (`primaAperturaNelMomento`, `report.apronoDopo`); `scheduleMomentPlan` mette prima una tappa gia' aperta (entro il tetto di cammino dalla tappa prima) o aspetta l'apertura dentro il momento; `settleOpeningHours` vieta come sempre cio' che resta chiuso all'arrivo. Un'ancora vietata nel suo momento va in un altro momento del giorno dove il bucket la ammette (`spostaAncoreVietate`, `_citta.ancoreSpostate`).
- **Quartiere chiesto fuori lista**: se la richiesta nomina un quartiere che la lista non ha (`nomiDiLuogoNelTesto`), una findplacefromtext «nome, citta'» (`cercaQuartiere`, `cityCenterService`) lo conferma (`quartiereConfermato`: tipo da quartiere, nome compatibile, entro 20 km); parte la lista dedicata (C10b2) e la giornata sta nel quartiere (`quartiereFuoriLista`): area 2 km, **nucleo** = 1 km dal punto di Google, dentro il suo riquadro (+150 m); mattina, pranzo e pomeriggio nel nucleo (`bucketsNelNucleo`, un momento che li' resterebbe vuoto tiene l'area). Vale anche quando la lista conferma «città»; mai nel borgo. Tracciato: `_citta.quartiereChiesto`, `_citta.tappeNelQuartiere`. Anche un quartiere della lista chiesto per nome ha il suo nucleo (1 km). Giro: `docs/prove/2026-10-18-c10c-piena-1.md` (Trastevere: la lista dedicata non ha `categoria`, le sue piazze e vie cadono nelle zone; il nucleo esclude Villa Farnesina e include l'Aventino — proposte nel report).
- **Piazze e vie storiche della lista** (`categoria` piazza/via, `isStoricaLista`): la regola delle zone non le toglie (`_citta.storicheTenute`), valgono come passeggiata, al massimo una per mattina e una per pomeriggio (riparatore).
- **Simbolo**: il simbolo dichiarato dall'AI viene prima di quelli dedotti (`rangoSimbolo` in `poolConLista`); in metropoli, senza quartiere chiesto, la giornata parte dal quartiere del simbolo (`scegliQuartiere`). Con un quartiere chiesto il simbolo entra solo se sta nell'area a piedi.
- **Borgo**: la soglia del giro corto conta solo i luoghi da visitare (`luogoDaVisitareBorgo`: non ristoranti, bar, negozi, non posti senza tipi Google); la durata conta luoghi da visitare e passeggiate.
- **Tracciato dei riempimenti**: `fillGaps` registra ogni tentativo respinto con il criterio (`criterioRespinto`: varieta', strada, cammino, orario, altro) in `continuita.respinti`. Solo registrazione.

### Il banco rigiocato a 0 $ (C10c-replay)

**Ogni giro del banco esteso salva il suo tracciato** accanto al grezzo (`docs/prove/dati/<giro>-tracciati.json.gz`, `scripts/banco/replay/rete.js`, `creaRegistratore`): per ogni caso il caso, l'ora simulata, ogni risposta di places-proxy (chiave = parametri ordinati senza `path`, `key`, `engine`, come la cache del proxy; foto ridotte al primo riferimento), di openai-proxy (lista e lista del quartiere per citta', giorno e quartiere; traduttore, selettore e narratore in ordine di chiamata, con l'impronta del prompt) e i fatti aperti delle tappe per place_id. Mai intestazioni, token o corpi delle richieste.
**Replay**: `npm run banco:replay -- <tracciati> [--confronta <grezzo.json>] [--casi a,b] [--out <file>]` (`scripts/banco/replay.mjs` → `replay.giro.js`, `vitest.replay.config.js`): il motore vero con le risposte del tracciato, nessuna rete (indirizzi `.invalid`, Supabase finto in memoria `replay/supabase-finto.js`, fatti dal tracciato, XMLHttpRequest e WebSocket vietati). Una richiesta che il tracciato non ha e' un'**uscita in rete**: `fetch` lancia `ReteVietataError` e il caso fallisce. `REPLAY_RACCONTO=vuoto`: solo il narratore non registrato risponde con un errore (il motore lascia le frasi al codice; tappe e orari non cambiano). Il grezzo del replay ha il formato del banco + `replay` (servite, uscite, prompt diversi, racconto mancante, scritture sul database) e, con `--confronta`, `fedelta` (stesse tappe, stessi orari, stesso tempo libero). Per Te si rigioca (TROINA-FIX: le ricerche dei temi e la chiamata dei tour dal tracciato). Il caso del banco e il suo grezzo vivono in `scripts/banco/giro-caso.js` (lo usano giro vero e replay; Per Te in `generaPerTe`/`registraPerTe`).
**Tracciati di un giro registrato prima del replay**: `scripts/banco/replay/ricostruisci.mjs` (grezzo + `places_cache` nella finestra del giro + `city_knowledge`, letti e mai scritti; traduttore, selettore e assunzioni dichiarati). Il giro 2 di C10c-piena-1 ricostruito si rigioca identico nei 10 casi (`docs/prove/2026-10-18-c10c-replay.md`).
**La tappa persa** (solo registrazione): quando un tentativo di `fillGaps` riempie il suo momento ma il giro non guadagna una tappa, `criterioRespinto` porta `persa` (`tappaPersa`: la tappa, il suo momento, dove e' passata, la regola — cammino C5c, tetto C8, orario, altro — e la prova); un momento facoltativo senza posto porta `senzaPosto` in `facoltativiSenzaPosto` (il migliore dei candidati e la prova che non passa, i conti per famiglia ripetuta, tetto di cammino, deviazione, marchio). Nel tour non esce mai la parola «perche» (test C10).

### Varietà come preferenza, il nucleo vero del quartiere (C10c-piena-2)

**Varietà come preferenza** (decisione di Ivano: «se si può evitare si evita, ma non deve essere vincolante»; `momentSelection.repairPass`): per la passeggiata della sera e per ogni riempimento la cascata è a) un posto di una famiglia nuova (la classifica lo mette davanti), b) un altro posto della stessa famiglia (un'altra piazza, un altro panorama: `fitsOptional` non guarda più la famiglia), c) **solo la sera** (passeggiata, dopocena) e solo nella scelta finale dopo le ricerche mirate (`tempoLiberoMinuti`), lo stesso posto già visto di giorno se è un'ancora o il simbolo, una volta sola nel giorno (`ripetibile`, `ripetutiNelGiorno`); il testo non si ripete (TESTI). Dove c'è un gradino prima la cascata si ferma lì. Una famiglia ripetuta non è più un peggioramento che respinge un riempimento (`ripieghiVeri`: i ripieghi `tipo: 'famiglia'` non contano in `fillGaps`, `fillMinimum`, `criterioRespinto`). Tracciato: `_tracciato.gradino` (a|b|c), `ripetuta`, `report.cascata`; nel grezzo del banco `gradino` per tappa e `cascata`.
**Il nucleo del quartiere chiesto** (`cityKnowledge.nucleoDellaLista`): il baricentro dei luoghi verificati della sua lista dedicata, raggio = il luogo più lontano + 150 m, fra 500 m e 1 km (con 1 km pieno l'Aventino sarebbe Trastevere); senza lista il punto di Google (1 km, `fonte: 'google'`). Tracciato `_citta.nucleo`. **La lista del quartiere dice la categoria** (`promptQuartiere`) e ha una versione sua (`QUARTIERE_LIST_VERSION = 'c10c-q2'`, `c10c-q2#q:<quartiere>`): si rigenera solo lei, le liste delle città restano `c10b-7`.
**Lo stesso posto in due schede di Google** (Piazza Sant'Oronzo come monumento e come piazza): nel riparatore e nella rifinitura un candidato con lo stesso nome di una tappa gia' nel giro conta come gia' usato (`nomeNorm`, `usedNames`, `giaNelGiro`).
**Il tracciato salva anche le richieste fallite** (timeout, rete: `annotaErrore`): il replay le fa fallire allo stesso modo (`fallimentiRigiocati`), mai una chiamata vera.
Proxy pubblicato: `openai-proxy` v24 (ramo `c10c`, `7a4426f`). Report: `docs/prove/2026-10-19-c10c-piena-2.md`.

### In produzione (main dal merge di c10b3 e di c10c)

- **Lista della città = variante C** («prima gli imperdibili», `VARIANTE_LISTA = 'C'` in `supabase/functions/openai-proxy/cityKnowledge.ts`, lista `c10b-7`); dal merge di c10c il codice del proxy su main coincide con `openai-proxy` **v24** pubblicato (lista del quartiere con la categoria, versione `c10c-q2`).
- **Varietà come preferenza a cascata** (C10c-piena-2): tipo diverso → stesso tipo → lo stesso posto, solo la sera e solo se è un'ancora o il simbolo, una volta nel giorno.
- **Stesso nome = stesso posto**: due schede di Google con lo stesso nome contano come lo stesso posto (mai due volte nel giro).
- **Nucleo del quartiere chiesto = baricentro dei luoghi della sua lista** (raggio fino al luogo più lontano + 150 m, fra 500 m e 1 km).
- **Ogni correzione al motore si prova prima col replay** (`npm run banco:replay`, 0 $), poi **un solo giro pagato con 2 ripetizioni**.
- **Prima di ogni merge: la guardia di tutti i flussi della home, `npm run banco:guardia`** (replay, 0 $): Per Te, Quiz Natura e Storia, Sorprendimi Natura e Arte, Crea il tuo Percorso, a Troina e a Catania; deve dare 12 su 12, nessun flusso vuoto.
- **Prima di ogni merge: guardia 12/12 e pertinenza senza ❌ nuovi.** `npm run banco:guardia` esegue anche i 5 controlli di pertinenza di BORGO-DIAGNOSI (`scripts/banco/pertinenza.js`, mai da cambiare) sui 6 casi del borgo e sui 12 della guardia, a 0 $ dai tracciati; i ❌ già noti stanno in `scripts/banco/pertinenza-noti.json`, un ❌ nuovo fa fallire la guardia.
- **Deploy di `openai-proxy` sempre con `--use-api`** (`supabase functions deploy openai-proxy --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api`); dopo il deploy si confronta la versione attiva con i file del repo.
- **Simboli accettati dal banco**: `SIMBOLI_ACCETTATI` in `scripts/banco/asticella-c10.js` (non in `banco.config.json`).
- **Orari verificati all'arrivo** (C10c-piena-1): un posto conta aperto o chiuso all'ora in cui ci arrivi, per tutta la sosta, non all'inizio del momento.

### Nei borghi nessun flusso della home esce vuoto; «non troviamo» solo per uno zero vero (TROINA-FIX)

Diagnosi in `docs/prove/2026-10-15-troina-zero.md`, giro in `docs/prove/2026-10-16-troina-fix.md`.
- **Giro corto del borgo** (sotto `BORGO_MIN_VERIFICATI`): la fascia si sceglie su **tutti i posti veri** della lista e delle ricerche (non solo quelli che contano per la soglia; fuori pasti e zone, entro il raggio del borgo) e **solo nelle ore di visita** (`oreDiVisita`: mattina e pomeriggio, C8e): una fascia senza il tempo di una visita (45 min) non si sceglie (alle 12:06 la fascia era tutta pranzo). Senza ore di visita nella finestra vale la regola di prima. **La durata non cambia** (45 min per luogo, 2–4).
- **Il selettore che non sceglie niente** non svuota il giro: con posti veri aperti nei momenti sceglie il riparatore del codice (`_citta.selettoreVuoto`).
- **Natura nei borghi** (`src/lib/borgoConfini.js`): con una richiesta di natura i luoghi di natura e i panorami entrano fino a **`NATURA_BORGO_KM` = 12 km** (= `widerRadiusKm(true)`, il bias delle ricerche) anche fuori dal comune (`_citta.naturaOltre`); **i luoghi storici restano nel comune** (indirizzo di Google, `_citta.fuoriComune`). Un monte, un belvedere, un parco non contrastano con «natura» anche se Google li segna `tourist_attraction`. Con una richiesta di natura **una tappa di natura non si cambia «per strada» con una che non lo è** (`polishRoute`, `dellaRichiesta`; come l'ancora, solo la regola dura del cammino la toglie): a Troina Monte Muganà diventava Piazza Conte Ruggero.
- **Per Te in un borgo** senza tour dai temi (tutti sotto le 3 tappe aperte, o nessun pool): **un tour misto** dal motore dei momenti, mezza giornata da adesso (`_homeBorgo`). Un errore resta un errore.
- **Messaggi** (`src/lib/esitoVuoto.js`, Quiz, Sorprendimi, Crea, Per Te): «A [città] non troviamo [categoria]. Cambia richiesta e riprovo.» **solo se il motore segna `_zeroVero`** (ricerca riuscita, zero candidati dopo raggio e categoria, lista arrivata); ogni altro vuoto (rete, timeout, lista mancante, selettore caduto, posti nel pool che nessun momento prende) è **«Non sono riuscito a completare il giro: un servizio non ha risposto. Riprova tra poco.»** col tasto «Riprova» (testo di Ivano). Quote e guasto del motore AI tengono i loro testi.
- **GUARDIA DELLA HOME** (`scripts/banco/casi-home.js`, `guardia-home.js`, `guardia.mjs`): «ogni flusso della home dà almeno un tour con posti veri» a Troina e a Catania (Per Te, Quiz Natura/parchi, Quiz Storia/luoghi storici, Su misura per te Natura e Arte, Crea il tuo Percorso), alle 12:05 del 15/10. **`npm run banco:guardia` va lanciato prima di ogni merge** (replay dei tracciati `docs/prove/dati/guardia-home-tracciati.json.gz`, 0 $, nessuna rete; esce con 1 se un flusso è vuoto o se il replay prova a uscire in rete). Se una modifica cambia le richieste ai proxy (uscite in rete), si rifanno i tracciati con `npm run banco:guardia -- --registra` (giro pagato, account di prova, tetto `BANCO_TETTO`).

### La navigazione non si blocca (NAV-1)

Diagnosi in `docs/prove/2026-10-20-nav-diagnosi.md`, lavoro in `docs/prove/2026-10-20-nav-1.md`.
- **Tracciamento sempre attivo** (`src/lib/navTracking.js`, `avviaTracciamento`): il `watchPosition` della navigazione parte subito, anche senza un primo fix; riprova dopo un errore, dopo 30 s di silenzio e al ritorno in primo piano (anche dopo un «negato»). Stati `attesa | ok | perso | negato`. MapPage passa ogni posizione a `onNavPosition` (via `navPositionRef`). I timer si chiamano avvolti: Safari lancia se `setInterval` è chiamato come metodo di un altro oggetto.
- **Giro salvato** (`src/lib/navSession.js`, `localStorage` `dvai_nav_giro_v1`): tour, tappe fatte e saltate, bersaglio, ora d'inizio; oltre 12 ore non si propone e si cancella. Proposta di ripresa: sulla mappa con lo stesso tour (MapPage) e all'apertura dell'app fuori dalla mappa (`GiroInCorso` in App). `GiroRipresaDialog` per entrambe.
- **Comandi nella barra** (`NavigationHUD`): «Sono arrivato», «Salta»; tappa superata (`src/lib/navPassaggio.js`): «Sei passato da [nome]?» «Vista» / «Saltala», mai uno sblocco da solo. Le tappe saltate (`skippedSteps`) non si inseguono più e contano per la fine del giro.
- **Schermo acceso** (`src/lib/wakeLock.js`): Screen Wake Lock durante la navigazione, richiesto di nuovo al ritorno in primo piano; dove manca, niente.
- **Messaggi** (`src/lib/navMessaggi.js`, `NAV_TESTI`): testi di Ivano alla lettera, uno alla volta (`avvisoNavigazione`); un errore di Directions non si mostra mai col suo codice.
- Telemetria invariata (NAV-2). Prova WebKit: `scripts/prova-nav/nav1.webkit.mjs` (porta e titolo verificati, GPS finto).

### Regole di lavoro (decise da Ivano)

- **I numeri finali vengono da un giro sul codice finale** (mai da un giro su un commit precedente, né da un replay).
- **I controlli del banco non si cambiano senza una proposta approvata**: se un controllo sembra sbagliato, si propone nel report e si lascia com'è.
- **Niente funzioni nuove non chieste**: se qualcosa sembra servire, si propone nel report.

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
