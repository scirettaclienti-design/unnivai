# AUDIT State Management - DoveVAI

**Data**: 2026-04-10
**Progetto**: unnivai-ricresa (DoveVAI)
**Risultato**: Zustand NON presente. Il progetto usa **React Context + Custom Hooks + React Query**.

---

## 0. Zustand: assente

`zustand` non compare in `package.json` (ne dependencies ne devDependencies). Non esistono file con `create()` da zustand ne una cartella `src/store/`. Tutto lo state management avviene tramite:

- 2 React Context (AuthContext, CityContext)
- 6 custom hooks con state locale (`useState`)
- React Query (`@tanstack/react-query`) per il data fetching
- `localStorage` come persistenza manuale

---

## 1. CONTEXT: Analisi completa

### 1.1 AuthContext

| Campo | Tipo | Note |
|---|---|---|
| **File** | `src/context/AuthContext.jsx` | |
| **Provider** | `AuthProvider` | Wrappa tutto sotto `QueryClientProvider` |
| **Hook** | `useAuth()` | |

**State shape:**

```
user          : object | null     (Supabase auth.user)
loading       : boolean           (true durante init/signOut)
isPasswordRecovery : boolean      (true se evento PASSWORD_RECOVERY)
role          : string | null     (derivato: user_metadata.role -> localStorage -> 'user' -> null)
isAuthenticated : boolean         (derivato: !!user)
```

**Actions:**
- `signOut()` -- async, chiama supabase.auth.signOut(), pulisce localStorage
- `resetPassword(email)` -- async, chiama supabase.auth.resetPasswordForEmail()

**Middleware/Persistenza:**
- `localStorage.getItem('unnivai_role')` come fallback per il role
- `localStorage.removeItem('unnivai_role')` al signOut

**Consumatori (9 file):**
- `App.jsx` -- `{ user, loading, role, isPasswordRecovery }`
- `RoleGuard.jsx` -- `{ user, role, loading }`
- `TopBar.jsx` -- `{ signOut }`
- `Login.jsx` -- `{ refreshRole, user, role, resetPassword }`
- `DashboardGuide.jsx` -- `{ user, signOut }`
- `DashboardBusiness.jsx` -- `{ user, signOut }`
- `TourDetails.jsx` -- `{ user }`
- `TourBuilder.jsx` -- `{ user }`
- `useUserContext.js` (hook interno) -- `{ user }`

---

### 1.2 CityContext

| Campo | Tipo | Note |
|---|---|---|
| **File** | `src/context/CityContext.jsx` | |
| **Provider** | `CityProvider` | Dentro AuthProvider |
| **Hook** | `useCity()` | |

**State shape:**

```
city      : string       (default: 'Roma')
isManual  : boolean      (default: false)
```

**Actions:**
- `setCity(newCity)` -- setta city + isManual=true
- `resetToGPS()` -- setta isManual=false (MA non resetta city!)

**Persistenza:** Nessuna. Alla ricarica torna a 'Roma'.

**Consumatori (6 file):**
- `TopBar.jsx` -- `{ setCity }`
- `CitySearchBar.jsx` -- `{ setCity, resetToGPS }`
- `MapPage.jsx` -- `{ isManual }`
- `Explore.jsx` -- `{ isManual }`
- `ExploreMiniMap.old.jsx` -- `{ city }` (file .old, probabilmente morto)
- `useUserContext.js` (hook interno) -- `{ city: manualCity, isManual }`

---

## 2. CUSTOM HOOKS (pseudo-store)

### 2.1 useUserContext()

| Campo | Tipo | Note |
|---|---|---|
| **File** | `src/hooks/useUserContext.js` | |
| **Dipendenze** | useAuth, useCity, useEnhancedGeolocation, React Query | Composizione di 3 fonti |

**State shape (ritornato):**

```
firstName       : string       (da auth metadata -> email -> 'Ospite')
email           : string       (da auth)
isGuest         : boolean      (!!user)
city            : string       (manual -> GPS -> 'Roma', con sanitize coords)
temperatureC    : number       (da userContextService)
weatherCondition: string       (da userContextService)
toursCount      : number       (da userContextService)
isLoading       : boolean      (gpsLoading || contextLoading)
userId          : string|null  (da userContextService)
source          : string       (da userContextService)
lat             : number       (se presente da userContextService)
lng             : number       (se presente da userContextService)
```

**Consumatori (17 file):** DashboardUser, MapPage, Explore, TopBar, NotificationBell, Profile, AiItinerary, QuickPath, SurpriseTour, Home, Notifications, BecomeGuide, Trending, TourLive, PersonalizedWelcome, UnnivaiMap.old

---

### 2.2 useUserProfile()

| Campo | Tipo | Note |
|---|---|---|
| **File** | `src/hooks/useUserProfile.js` | |

**State shape:**

```
profile.name            : string
profile.firstName       : string
profile.lastName        : string
profile.initials        : string
profile.isDetected      : boolean
profile.isAuthenticated : boolean
profile.id              : string|null
profile.email           : string       (solo se autenticato)
profile.role            : string       (solo se autenticato)
isLoading               : boolean
```

**Actions:**
- `updateUserName(newName)` -- aggiorna profile + localStorage
- `detectUserProfile()` -- rileva profilo da browser/localStorage

**Persistenza:** `localStorage.getItem('user_name')` per guest

**Consumatori: 0 file** (NESSUN componente lo importa -- CODICE MORTO)

---

### 2.3 useUserNotifications(userId, city, firstName)

| Campo | Tipo | Note |
|---|---|---|
| **File** | `src/hooks/useUserNotifications.js` | |

**State shape:**

```
notifications     : array     (merge di real + generated, sorted by time)
unreadCount       : number    (derivato)
isLoading         : boolean
```

**Actions:**
- `markAsRead(id)` -- Supabase update o localStorage
- `deleteNotification(id)` -- Supabase delete o localStorage
- `markAllAsRead()` -- bulk update

**Persistenza:**
- `localStorage: read_generated_notifs` (array di id letti)
- `localStorage: deleted_generated_notifs` (array di id cancellati)

**Consumatori (2 file):**
- `Notifications.jsx`
- `NotificationBell.jsx`

---

### 2.4 useEnhancedGeolocation(options)

| Campo | Tipo | Note |
|---|---|---|
| **File** | `src/hooks/useEnhancedGeolocation.js` | |

**State shape:**

```
location          : { latitude, longitude, city, country } | null
loading           : boolean
error             : string | null
nearbyData        : array | null
savedToDatabase   : boolean
isSupported       : boolean    (derivato)
hasPermission     : boolean    (derivato)
```

**Consumatori (1 file):**
- `useUserContext.js` (solo `location` e `loading`)

---

### 2.5 useGeolocation(options)

| Campo | Tipo | Note |
|---|---|---|
| **File** | `src/hooks/useGeolocation.js` | |

**State shape:** identico a useEnhancedGeolocation ma senza nearbyData/savedToDatabase.

**Consumatori: 0 file** (NESSUN componente lo importa -- CODICE MORTO)

---

### 2.6 useAILearning()

| Campo | Tipo | Note |
|---|---|---|
| **File** | `src/hooks/useAILearning.js` | |

**State shape:**

```
generatedToursCount  : number          (default: 0)
userDNAPreferences   : array<object>   (max 10 entries)
hasUnlockedPremium   : boolean         (default: false)
hasHitPaywall        : boolean         (derivato: count >= 10 && !premium)
```

**Actions:**
- `trackGeneratedTour(preferences)` -- aggiunge a DNA, incrementa count
- `unlockPremium()` -- setta premium a true

**Persistenza:** `localStorage: unnivai_ai_learning_brain` (intero state serializzato)

**Consumatori (3 file):**
- `DashboardUser.jsx`
- `SurpriseTour.jsx`
- `QuickPath.jsx`

---

### 2.7 useTourRouting(waypoints, travelModePreference)

| Campo | Tipo | Note |
|---|---|---|
| **File** | `src/hooks/useTourRouting.js` | |

Hook specializzato per Google Maps DirectionsService. Non e' un "store" ma gestisce state di routing. Consumato internamente da componenti mappa.

---

### 2.8 useToast()

| Campo | Tipo | Note |
|---|---|---|
| **File** | `src/hooks/use-toast.js` | |

Stub: ritorna solo `{ toast: (props) => console.log("TOAST:", props) }`. Non funzionale.

---

## 3. PROBLEMI IDENTIFICATI

### CRITICO

#### P1: Stato duplicato - Profilo utente in 3 posti
Lo stato dell'utente autenticato viene mantenuto in:
1. **AuthContext** (`user`, `role`)
2. **useUserContext()** (`firstName`, `email`, `isGuest`, `userId`)
3. **useUserProfile()** (`profile.name`, `profile.role`, `profile.id`, `profile.email`, `profile.isAuthenticated`)

Tutti e tre fanno `supabase.auth.getSession()` e/o `onAuthStateChange()` indipendentemente. Questo causa:
- **3 listener paralleli** sullo stesso evento auth
- Possibili race condition (uno aggiorna prima dell'altro)
- `useUserProfile` e' totalmente inutilizzato ma mantiene un listener attivo

**Raccomandazione:** Eliminare `useUserProfile` (zero consumatori). Centralizzare firstName/role in AuthContext.

---

#### P2: `refreshRole` non esiste in AuthContext
`Login.jsx` linea 70 destructura `refreshRole` da `useAuth()`:
```js
const { refreshRole, user, role, resetPassword } = useAuth();
```
Ma AuthContext non espone nessun metodo `refreshRole`. Il valore sara' `undefined`. Se viene chiamato, causera' un runtime error.

---

#### P3: `useGeolocation` e' codice morto
`src/hooks/useGeolocation.js` non e' importato da nessun file. E' una versione precedente di `useEnhancedGeolocation`. Duplica ~195 righe di logica identica (GPS + reverse geocoding + fallback Roma).

**Raccomandazione:** Eliminare `useGeolocation.js`.

---

#### P4: `useUserProfile` e' codice morto
`src/hooks/useUserProfile.js` non e' importato da nessun componente. Mantiene un listener `onAuthStateChange` che gira a vuoto se istanziato. Il suo state (firstName, role, email) duplica AuthContext + useUserContext.

**Raccomandazione:** Eliminare `useUserProfile.js`.

---

### ALTO

#### P5: CityContext non persiste la citta' selezionata
Quando l'utente seleziona manualmente una citta' via TopBar, questa viene persa al refresh della pagina (torna a 'Roma'). `userContextService` usa `localStorage.getItem('user_city')` come fallback, ma CityContext non scrive mai in `user_city`.

**Raccomandazione:** Aggiungere persistenza localStorage in CityContext.setCity(), oppure sincronizzare con `user_city` in localStorage.

---

#### P6: resetToGPS() non resetta la citta'
`CityContext.resetToGPS()` fa solo `setIsManual(false)` ma non tocca `city`. Dopo il reset, `city` rimane il valore manuale precedente. In `useUserContext`, il fallback va a `gpsLocation?.city || 'Roma'` solo se `isManual` e' false, quindi funziona **solo se** il GPS ha gia' rilevato una citta'. Se GPS non e' disponibile, l'utente resta bloccato sulla vecchia city manuale.

---

#### P7: Nessun selettore - re-render cascata su AuthContext
Tutti i consumatori di `useAuth()` ricevono l'intero oggetto `value`. Quando `loading` cambia (es. durante signOut), **tutti** i 9+ componenti che usano `useAuth()` re-renderano, anche quelli che usano solo `user` o solo `signOut`.

Con React Context non c'e' selezione granulare nativa. Soluzioni:
- Splittare AuthContext in `AuthStateContext` (user, role) e `AuthActionsContext` (signOut, resetPassword)
- Oppure migrare a Zustand con selettori

---

#### P8: useUserContext() ha staleTime: 0
```js
staleTime: 0, // Always fresh
```
Ogni componente che monta e usa `useUserContext()` triggera un refetch di `userContextService.getUserContext()`. Con 17 consumatori, al mount iniziale dell'app si generano molte chiamate ridondanti (anche se React Query deduplica quelle simultanee, i remount dopo navigazione lazy causano refetch).

**Raccomandazione:** Settare `staleTime: 60_000` o superiore (il meteo non cambia ogni secondo).

---

#### P9: Role spoofing via localStorage
Il campo `role` in AuthContext usa `localStorage.getItem('unnivai_role')` come fallback. Un utente puo' editare il localStorage e forzare la vista di dashboard non autorizzate (es. business). La sicurezza lato DB (RLS) resta intatta, ma la UI e' manipolabile.

**Raccomandazione:** Forzare la lettura del ruolo da Supabase (JWT claims o query profiles) e non da localStorage.

---

### MEDIO

#### P10: localStorage frammentato e non tipizzato
Lo stato persistito e' sparso su 8+ chiavi localStorage senza schema:

| Chiave | Usato da | Contenuto |
|---|---|---|
| `unnivai_role` | AuthContext | string (role) |
| `user_city` | userContextService | string (city name) |
| `user_name` | useUserProfile (morto) | string |
| `unnivai_ai_learning_brain` | useAILearning | JSON object |
| `unnivai_favorites` | Explore.jsx | JSON array |
| `unnivai_mode` | DashboardGuide, useUserNotifications | 'guide' / 'user' |
| `read_generated_notifs` | useUserNotifications | JSON array |
| `deleted_generated_notifs` | useUserNotifications | JSON array |
| `user_tour_history` | DashboardUser, TourSummaryModal | JSON array |

Nessuna validazione al read. Se il JSON e' corrotto, alcuni hook crashano (quelli senza try/catch).

---

#### P11: Logica asincrona Supabase dentro i hook
`useUserNotifications` fa chiamate dirette a `supabase.from('notifications').update(...)` e `.delete(...)` invece di passare per `dataService`. Questo bypassa la validazione Zod (NotificationUISchema) e rende il codice meno testabile.

**Raccomandazione:** Spostare le mutation in `dataService` e usare `useMutation` di React Query.

---

#### P12: `useEnhancedGeolocation` chiama API backend inesistenti
Le funzioni `saveLocationToBackend()` e `getNearbyData()` chiamano `/api/location/save` e `/api/location/nearby`, endpoint che non esistono nel progetto (non c'e' backend Express/API routes). Queste chiamate falliscono silenziosamente ad ogni mount.

---

#### P13: useToast() e' uno stub non funzionale
`use-toast.js` fa solo `console.log`. Se qualche componente lo usa per notifiche UI, l'utente non vedra' nulla.

---

## 4. FLUSSO DATI - Mappa componenti/stato

```
QueryClientProvider
  |
  AuthProvider [user, role, loading, signOut, resetPassword, isPasswordRecovery]
  |  |-- App.jsx (user, loading, role, isPasswordRecovery)
  |  |-- RoleGuard.jsx (user, role, loading)
  |  |-- Login.jsx (user, role, resetPassword, refreshRole[BUG:undefined])
  |  |-- DashboardGuide.jsx (user, signOut)
  |  |-- DashboardBusiness.jsx (user, signOut)
  |  |-- TourDetails.jsx (user)
  |  |-- TourBuilder.jsx (user)
  |
  CityProvider [city, setCity, isManual, resetToGPS]
  |  |-- TopBar.jsx (setCity)
  |  |-- CitySearchBar.jsx (setCity, resetToGPS)
  |  |-- MapPage.jsx (isManual)
  |  |-- Explore.jsx (isManual)
  |
  useUserContext() [firstName, city, email, isGuest, temperatureC, ...]
  |  |-- DashboardUser, MapPage, Explore, TopBar, NotificationBell
  |  |-- Profile, AiItinerary, QuickPath, SurpriseTour, Home
  |  |-- Notifications, BecomeGuide, Trending, TourLive
  |  |-- PersonalizedWelcome, UnnivaiMap.old
  |
  useAILearning() [generatedToursCount, hasHitPaywall, ...]
  |  |-- DashboardUser, SurpriseTour, QuickPath
  |
  useUserNotifications(userId, city, firstName)
     |-- NotificationBell, Notifications
```

### Circular dependencies: NESSUNA
Il flusso e' unidirezionale: AuthContext -> CityContext -> useUserContext -> componenti.

### Stato orfano (definito ma mai consumato):
1. **`useUserProfile`** -- intero hook mai importato da componenti
2. **`useGeolocation`** -- intero hook mai importato da componenti
3. **`CityContext.resetToGPS`** -- wired solo a CitySearchBar, mai visibile in UI principale
4. **`useEnhancedGeolocation.nearbyData`** -- calcolato ma mai letto da useUserContext
5. **`useEnhancedGeolocation.savedToDatabase`** -- calcolato ma mai letto
6. **`AuthContext.loading`** nel value esposto -- hardcoded a `false` (il vero loading blocca il render prima)

---

## 5. RACCOMANDAZIONI ARCHITETTURALI

### Quick Wins (senza refactor)
1. Eliminare `useGeolocation.js` e `useUserProfile.js` (codice morto)
2. Fixare il bug `refreshRole` in Login.jsx (rimuovere o implementare in AuthContext)
3. Settare `staleTime: 60000` in useUserContext per ridurre refetch
4. Aggiungere `try/catch` ai `localStorage.getItem` mancanti

### Refactor Medio
5. Persistere city in localStorage dentro CityContext
6. Spostare le mutation Supabase da useUserNotifications a dataService
7. Rimuovere le chiamate a `/api/location/save` e `/api/location/nearby` da useEnhancedGeolocation
8. Implementare un vero useToast (o rimuoverlo)
9. Rimuovere localStorage fallback per role, usare JWT claims o query DB

### Refactor Strutturale (se il progetto cresce)
10. Valutare migrazione a Zustand per:
    - Selettori granulari (evita re-render su AuthContext)
    - Persistenza integrata (middleware `persist` vs localStorage manuale)
    - DevTools per debug dello state
11. Splittare AuthContext in AuthStateContext + AuthActionsContext
12. Centralizzare tutto il localStorage dietro un singolo servizio tipizzato con validazione
13. Creare un dizionario `queryKeys.ts` per standardizzare tutte le chiavi React Query

---

## 6. RIEPILOGO SEVERITA'

| ID | Severita' | Descrizione |
|----|-----------|-------------|
| P1 | CRITICO | Stato utente duplicato in 3 posti con 3 listener auth paralleli |
| P2 | CRITICO | `refreshRole` destructurato ma inesistente in AuthContext |
| P3 | CRITICO | `useGeolocation` codice morto (195 righe) |
| P4 | CRITICO | `useUserProfile` codice morto con listener auth attivo |
| P5 | ALTO | CityContext non persiste la citta' selezionata |
| P6 | ALTO | `resetToGPS()` non resetta effettivamente la city |
| P7 | ALTO | Re-render cascata: nessun selettore su AuthContext |
| P8 | ALTO | staleTime: 0 causa refetch eccessivi su 17 consumatori |
| P9 | ALTO | Role spoofing via localStorage |
| P10 | MEDIO | localStorage frammentato, nessuna validazione |
| P11 | MEDIO | Chiamate Supabase dirette bypassano dataService/Zod |
| P12 | MEDIO | Chiamate a endpoint backend inesistenti in useEnhancedGeolocation |
| P13 | MEDIO | useToast stub non funzionale |
