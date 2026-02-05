# PLAN DI ABILITAZIONE PIATTAFORMA UNNIVAI (POST-DESIGN-LOCK)

Questo documento definisce la strategia per trasformare l'attuale "Full Site Restore" (Frontend-only/Mocked) in una piattaforma operativa completa su Supabase, rispettando rigorosamente il vincolo di **NON ALTERARE L'INTERFACCIA UTENTE (Design & UX Lock)**.

---

## 1. FASE 1: ANALISI FUNZIONALE & MAPPING MOCK

Attualmente, l'applicazione simula dati e stati. Di seguito la mappatura puntuale di cosa deve essere migrato su Backend reale.

### 1.1 Funzionalità Core (Mock vs Real)

| Entità | Stato Attuale (Mock) | Destinazione Backend (Supabase) | Dettagli UI da Preservare |
| :--- | :--- | :--- | :--- |
| **Utente** | `useUserProfile.js` (Detect locale/Hardcoded) | **Auth + Table `profiles`** | Nome, Avatar, Ruolo (Viaggiatore/Guida) |
| **Tour** | `locationTourService.js`, Object `tourDetails` | **Table `tours`** | Titolo, Prezzo, Foto, Highlights, Itinerario (JSON) |
| **Live Status** | Flag `live: true` hardcoded | **Realtime Database** | Banner "LIVE ORA", Badge pulsante |
| **Prenotazioni** | `BookingModal` (conferma visiva finta) | **Table `bookings`** | Salvataggio su DB, email conferma (Edge Function) |
| **Preferiti** | Local state / non persistente | **Table `favorites`** | Toggle cuore persistente |
| **Recensioni** | Array statico in componenti | **Table `reviews`** | Rating numerico, conteggio, testo |
| **Trending** | `trendingExperiences` array | **Query Aggregata** | Score calcolato su views/bookings reali |
| **AI Itinerary** | Generazione simulata client-side | **Table `ai_itineraries`** | Prompt utente, Risposta JSON salvata |
| **Meteo** | `aiRecommendationService` (random/statico) | **Edge Function (Weather API)** | Descrizione testuale per "PersonalizedWelcome" |

### 1.2 Analisi UI-Data Binding (Vincoli Strutturali)

I componenti React si aspettano strutture dati precise. Il backend DEVE restituire JSON che matchano esattamente queste interfacce per evitare refactoring UI.

**Esempio Struttura Tour (Critical):**
```json
{
  "id": "uuid o int",
  "title": "Stringa",
  "guide": {
    "name": "Stringa",
    "avatar": "Emoji o URL",
    "bio": "Stringa"
  },
  "price": Number,
  "originalPrice": Number (opzionale),
  "images": ["url1", "url2"],
  "highlights": ["Stringa1", "Stringa2"],
  "itinerary": [
     { "time": "HH:MM", "activity": "Descrizione", "emoji": "Char" }
  ],
  "live": Boolean (fondamentale per UI switch)
}
```

---

## 2. FASE 2: ARCHITETTURA BACKEND (SUPABASE)

### 2.1 Schema Database (PostgreSQL)

Utilizziamo `jsonb` per preservare la flessibilità degli array UI (highlights, itinerary) senza creare troppe tabelle di giunzione che complicherebbero le query semplici del frontend.

#### Tables

1.  **`profiles`** (Estende `auth.users`)
    *   `id` (uuid, PK, ref `auth.users`)
    *   `username` (text)
    *   `full_name` (text)
    *   `avatar_url` (text)
    *   `role` (enum: 'user', 'guide', 'activity_provider', 'admin')
    *   `bio` (text, per le guide)

2.  **`tours`**
    *   `id` (bigint/uuid, PK)
    *   `guide_id` (uuid, ref `profiles.id`)
    *   `title` (text)
    *   `description` (text)
    *   `location` (text) - es. "Roma, Trastevere"
    *   `city` (text) - per filtri (Roma, Milano, etc.)
    *   `price` (numeric)
    *   `original_price` (numeric, nullable)
    *   `duration_text` (text) - es. "90 min" (mantiene formattazione UI)
    *   `images` (text[]) - Array di URL
    *   `highlights` (text[]) - Array di stringhe
    *   `included` (text[])
    *   `not_included` (text[])
    *   `meeting_point` (text)
    *   `itinerary` (jsonb) - `[{time, activity, emoji}]`
    *   `category` (enum: 'food', 'culture', 'adventure', 'shopping')
    *   `is_live` (boolean) - Triggera UI Live
    *   `live_start_time` (timestamptz, nullable)
    *   `next_start_label` (text) - per UI flessibile "Tra 2 ore"
    *   `max_participants` (int)
    *   `rating` (numeric, default 5.0) - Cache del rating calcolato

3.  **`bookings`**
    *   `id` (uuid, PK)
    *   `user_id` (uuid, ref `profiles.id`)
    *   `tour_id` (ref `tours.id`)
    *   `status` (enum: 'pending', 'confirmed', 'cancelled')
    *   `booking_date` (timestamptz)
    *   `participants_count` (int)

4.  **`favorites`** (User Wishlist)
    *   `user_id` (uuid)
    *   `tour_id` (ref `tours.id`)
    *   PK composita (user_id, tour_id)

5.  **`ai_itineraries`**
    *   `id` (uuid)
    *   `user_id` (uuid)
    *   `prompt_data` (jsonb) - Input utente (budget, interessi)
    *   `generated_result` (jsonb) - Struttura completa itinerario generato
    *   `created_at` (timestamptz)

### 2.2 Security & Roles (RLS)

*   **Public**: `SELECT` su `tours` (solo attivi).
*   **User**: `SELECT` su `profiles` (se stessi), `INSERT/SELECT` su `bookings` (propri), `favorites`, `ai_itineraries`.
*   **Guide**: `INSERT/UPDATE` su `tours` (propri), `SELECT` su `bookings` (dei propri tour).
*   **Admin**: Full Access.

---

## 3. FASE 3: DATA INTEGRATION PLAN (Strategy)

Eviteremo il "Big Bang Rewrite". Sostituiremo i servizi mock uno ad uno utilizzando il pattern **Adapter**.

### Step 3.1: Setup Client Supabase
1.  Installare `@supabase/supabase-js`.
2.  Creare `src/lib/supabase.js` (Singleton client).
3.  Configurare variabili d'ambiente `.env` (URL, Anon Key).

### Step 3.2: Auth Layer (Sostituzione `useUserProfile`)
1.  Creare `src/hooks/useAuth.js` che wrappa `supabase.auth`.
2.  Mantenere l'interface dell'hook esistente (`profile`, `isAuthenticated`, `isLoading`) ma riempirla con dati reali.
3.  Se l'utente non è loggato, mantenere il fallback "Guest" attuale per non rompere la UI.

### Step 3.3: Data Service Layer (Sostituzione `locationTourService`)
1.  Creare `src/services/dataService.js`.
2.  Implementare metodi che ricalcano ESATTAMENTE le chiamate attuali ma fetchano da Supabase.
3.  **Adapter Pattern**: Convertire i campi DB (snake_case) in campi UI (camelCase) all'interno del service, prima che arrivino ai componenti.
    *   *Db*: `original_price` -> *UI*: `originalPrice`
    *   *Db*: `guide_id` join `profiles` -> *UI*: `guide: { name, avatar... }`

### Step 3.4: React Query Refactoring
Attualmente i componenti leggono costanti importate (`import { tourDetails }...`).
1.  Modificare i componenti (`TourDetails.jsx`, `TourLive.jsx`, etc.) per usare `useQuery`.
2.  **IMPORTANTE**: Impostare `initialData` o `placeholderData` con i vecchi dati mock durante la transizione per evitare schermate bianche di loading che altererebbero l'UX percepita ("Visual Literalism").

### Step 3.5: Funzionalità "Write" (Prenotazioni)
1.  Collegare `BookingModal` a una mutation React Query.
2.  Al successo, inserire row in `bookings` e mostrare il `Toast` esistente (nessuna nuova UI).

### Step 3.6: Realtime (Live & Notifiche)
1.  Sottoscriversi ai cambiamenti sulla tabella `tours` (colonna `is_live`).
2.  Aggiornare lo store locale di React Query quando un tour va "LIVE", aggiornando istantaneamente il badge rosso nella UI senza refresh.

---

## 4. NEXT STEPS IMMEDIATI

1.  **Confermare questo piano**: Se approvato, procedo con l'installazione delle dipendenze e la creazione della struttura file.
2.  **Creazione Schema**: Fornirò lo script SQL per inizializzare Supabase.
3.  **Implementazione Auth**: Primo touchpoint.
