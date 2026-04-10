# Analisi Strutturale - Progetto DoveVAI

### Albero cartelle
```
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── postcss.config.js
├── public
│   └── vite.svg
├── scripts
│   ├── check-env.js
│   ├── check_divs.cjs
│   ├── seedNotifications.js
│   └── test_integration_e2e.js
├── tailwind.config.js
├── vercel.json
├── vite.config.js
├── vitest.config.js
├── src
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── assets
│   │   └── react.svg
│   ├── components
│   │   ├── ErrorBoundary.jsx
│   │   ├── Navigation.css
│   │   ├── RoleGuard.jsx
│   │   ├── TopBar.jsx
│   │   ├── BottomNavigation.jsx
│   │   ├── Explore/
│   │   ├── Map/
│   │   └── ui/
│   ├── config
│   │   └── tourSchema.js
│   ├── context
│   │   ├── AuthContext.jsx
│   │   └── CityContext.jsx
│   ├── data
│   │   └── demoData.js
│   ├── hooks
│   │   ├── use-toast.js
│   │   ├── useAILearning.js
│   │   ├── useEnhancedGeolocation.js
│   │   ├── useGeolocation.js
│   │   ├── useTourRouting.js
│   │   ├── useUserContext.js
│   │   ├── useUserNotifications.js
│   │   └── useUserProfile.js
│   ├── lib
│   │   ├── schemas.js
│   │   ├── supabase.js
│   │   └── utils.js
│   ├── pages
│   │   ├── AiItinerary.jsx
│   │   ├── BecomeGuide.jsx
│   │   ├── DashboardBusiness.jsx
│   │   ├── DashboardGuide.jsx
│   │   ├── DashboardUser.jsx
│   │   ├── Explore.jsx
│   │   ├── Home.jsx
│   │   ├── Landing.jsx
│   │   ├── Login.jsx
│   │   ├── MapPage.jsx
│   │   ├── Notifications.jsx
│   │   ├── Photos.jsx
│   │   ├── Profile.jsx
│   │   ├── QuickPath.jsx
│   │   ├── SurpriseTour.jsx
│   │   ├── TodayTours.jsx
│   │   ├── TourDetails.jsx
│   │   ├── TourLive.jsx
│   │   ├── Trending.jsx
│   │   ├── UpdatePassword.jsx
│   │   └── guide/
│   ├── services
│   │   ├── aiRecommendationService.js
│   │   ├── dataService.js
│   │   ├── locationTourService.js
│   │   ├── mapService.js
│   │   ├── placesDiscoveryService.js
│   │   ├── poiService.js
│   │   ├── userContextService.js
│   │   └── weatherService.js
│   └── utils
│       ├── chatSanitizer.js
│       ├── geoUtils.js
│       └── imageUtils.js
└── supabase
    ├── migrations/
    ├── rls_policies.sql
    └── seed.sql
```

### Dipendenze
| Pacchetto | Versione | Ruolo |
|-----------|----------|-------|
| `@supabase/supabase-js` | `^2.97.0` | Client ufficiale per backend DB e Autenticazione |
| `@tanstack/react-query` | `^5.90.19` | Fetching dati, caching asincrono e sincronizzazione state |
| `@vis.gl/react-google-maps` | `^1.8.1` | Integrazione mappa (Google Maps) con React |
| `canvas-confetti` | `^1.9.4` | Gestione di effetti visivi UI (gamification ed eventi) |
| `clsx` | `^2.1.1` | Utility per generare dinamicamente classi CSS |
| `framer-motion` | `^12.26.2` | Libreria per animazioni complesse dell'UI |
| `lucide-react` | `^0.562.0` | Collezione di icone in SVG |
| `openai` | `^6.22.0` | Integrazione con modelli AI / generazione itinerari |
| `react` / `react-dom` | `^19.2.0` | Core rendering library UI |
| `react-router-dom` | `^7.12.0` | Gestione routing applicativo lato client |
| `tailwind-merge` | `^3.4.0` | Risolve conflitti e mergia classi utility Tailwind |
| `zod` | `^4.3.6` | TypeScript-first validation framework (usato per schema form o DTO) |

### Configurazione build
- **Vite:** 
  - *Versione:* `^7.2.4` (in devDependencies).
  - *Plugin:* In `vite.config.js` è configurato `@vitejs/plugin-react` associato all'array standard dei plugin.
  - *Special:* Definisce l'alias path resolution: `@` punta alla cartella base `./src`.
- **TypeScript:** 
  - Il progetto *NON contiene TypeScript strict config (manca tsconfig.json/jsconfig.json)* ed espone estensioni `.jsx` o `.js` e `.mjs`. Utilizza `@types/react` tra le librerie dev come supporto autocompletamento.
- **Tailwind:** 
  - Definisce `darkMode` basato su classi. I *colori personalizzati* estendono palette semantiche per l'intera UI (`card`, `popover`, `muted`, `destructive`, ecc.) includendo layer brand specifici: `ochre` (50..500), `terracotta` (50..500) ed `olive` (50..500).
  - Customizza le curve degli arrotondamenti (`borderRadius`: lg, md, sm calc-based).
  - Configura *font grafici moderni*, integrando esplicitamente la famiglia `Quicksand`.
  - Include logiche di animazione UI integrate (`accordion-down`, `accordion-up`).
  - Utilizza i *plugin ufficiali*: `tailwindcss-animate`, `@tailwindcss/typography`.

### Variabili ambiente
L'elenco delle chiavi rilevate (file: `.env` / `.env.example`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_GOOGLE_MAP_ID`
- `VITE_OPENAI_API_KEY`

### Catena di rendering
L'albero di dipendenza DOM parte da `index.html` → `src/main.jsx` → `src/App.jsx`.

La macrostruttura del contesto reattivo all'interno di *App* elabora in sequenza:
`main.jsx`
 → `<ErrorBoundary>`
  → `<App>`
   → `<QueryClientProvider>`
    → `<AuthProvider>`
     → `<CityProvider>`
      → `<APIProvider>` (Google Maps Context)
       → `<Router>`
        → `<ErrorBoundary>` (per isolamento route error)
         → `<Suspense>` (per il caricamento Pagine Lazy e fallback: *GlobalLoading*)
          → `<Routes>`
           → `[Route Component Auth / RootDispatcher]`
            → `[Pagine Lavorate... Layout Specifico...]`

### Route definite
| Path | Componente | Layout | Auth required |
|------|-----------|--------|---------------|
| `/` | `RootDispatcher` | Gatekeeper Redirect | Misto (redireziona o LandingGuest) |
| `/login` | `Login` | Root / Public | No |
| `/update-password` | `UpdatePassword` | Root / Public | No |
| `/explore` | `Explore` | Root / Public | No |
| `/tour-details`, `/:id` | `TourDetails` | Root / Public | No |
| `/dashboard-user` | `DashboardUser` | `RoleGuard` | Sì (`explorer`, `user`) |
| `/app/*` | `DashboardUser` | `RoleGuard` | Sì (`explorer`, `user`) |
| `/home` | `Home` | `RoleGuard` | Sì (`explorer`, `user`) |
| `/photos` | `Photos` | `RoleGuard` | Sì (`explorer`, `user`) |
| `/profile` | `Profile` | `RoleGuard` | Sì (`explorer`, `user`) |
| `/ai-itinerary` | `AiItinerary` | `RoleGuard` | Sì (`explorer`, `user`) |
| `/map` | `MapPage` | `RoleGuard` | Sì (`explorer`, `user`) |
| `/quick-path` | `QuickPath` | `RoleGuard` | Sì (`explorer`, `user`) |
| `/notifications` | `Notifications` | `RoleGuard` | Sì (`explorer`, `user`) |
| `/tour-live` | `TourLive` | `RoleGuard` | Sì (`explorer`, `user`) |
| `/surprise-tour` | `SurpriseTour` | `RoleGuard` | Sì (`explorer`, `user`) |
| `/trending` | `Trending` | `RoleGuard` | Sì (`explorer`, `user`) |
| `/become-guide` | `BecomeGuide` | `RoleGuard` | Sì (`explorer`, `user`) |
| `/dashboard-guide` | `DashboardGuide` | `RoleGuard` | Sì (`guide`) |
| `/guide/create-tour` | `TourBuilder` | `RoleGuard` | Sì (`guide`) |
| `/guide/*` | `DashboardGuide` | `RoleGuard` | Sì (`guide`) |
| `/chat/guide/:id` | `GuidePlaceholder` | `RoleGuard` | Sì (`guide`) |
| `/profile/guide/:id`| `GuidePlaceholder`| `RoleGuard` | Sì (`guide`) |
| `/dashboard-business` | `DashboardBusiness` | `RoleGuard` | Sì (`business`) |
| `/business/*` | `DashboardBusiness` | `RoleGuard` | Sì (`business`) |
