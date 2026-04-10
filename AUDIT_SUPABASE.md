# AUDIT SUPABASE - DoveVai (UnnivAI)

**Data audit:** 2026-04-10
**Progetto:** DoveVai - Piattaforma turismo italiano
**Stack:** React 19 + Vite + Supabase (Auth, DB, Realtime, Storage)

---

## 1. Schema Database Ricostruito

### Tabelle Principali

| Tabella | PK | Campi chiave | Tipo PK | Relazioni (FK) | RLS | Indici |
|---|---|---|---|---|---|---|
| `profiles` | `id` (= auth.users.id) | `full_name`, `avatar_url`, `bio`, `current_city`, `username`, `role`, `first_name`, `last_name`, `image_urls` | UUID | `id` -> `auth.users(id)` | SI | PK |
| `tours` | `id` | `city`, `guide_id`, `is_live`, `price_eur`, `duration_minutes`, `image_urls`, `title`, `description`, `category`, `steps` (JSONB), `route_path`, `tags`, `max_participants`, `start_location` | UUID | `guide_id` -> `profiles(id)` | SI | - |
| `bookings` | `id` | `tour_id`, `user_id`, `status`, `booking_date`, `booking_time`, `guests_count`, `total_amount`, `created_at` | UUID | `tour_id` -> `tours(id)`, `user_id` -> `auth.users(id)` | SI | - |
| `activities` | `id` | `city`, `name`, `latitude`, `longitude`, `category`, `tier`, `owner_id`, `type`, `icon`, `historical_notes`, `fun_facts`, `opening_hours`, `website_url`, `image_url`, `admission_fee`, `duration_minutes`, `vibe_tags`, `tags`, `description` | UUID | `owner_id` -> `auth.users(id)` | SI | `idx_activities_type`, `idx_activities_city_type` |
| `guide_requests` | `id` | `user_id`, `guide_id`, `tour_id`, `status`, `city`, `category`, `duration`, `request_text`, `notes`, `user_name`, `created_at` | UUID | `guide_id` -> `profiles(id)`, `user_id` -> `profiles(id)`, `tour_id` -> `tours(id)` | SI | `idx_guide_requests_guide_id`, `idx_guide_requests_status`, `idx_guide_requests_user_id` |
| `guides_profile` | `id` (UUID auto) | `user_id` (UNIQUE), `full_name`, `avatar_url`, `license_number`, `piva`, `bio`, `status`, `type`, `operating_cities[]`, `tours_count`, `rating` | UUID | `user_id` -> `auth.users(id)` | SI | UNIQUE su `user_id` |
| `businesses_profile` | `id` | `user_id`, `company_name`, `city`, `category_tags[]`, `ai_metadata` (JSONB), `location` (PostGIS POINT), `subscription_tier`, `description`, `address`, `website`, `instagram_handle`, `menu_url`, `image_urls`, `latitude`, `longitude`, `metrics` (JSONB) | UUID | `user_id` -> `auth.users(id)` | SI | `businesses_profile_location_idx` (GIST) |
| `explorers` | `id` (= auth.users.id) | `tours_completed`, `km_walked`, `guides_met`, `photos_uploaded`, `rating` | UUID | `id` -> `auth.users(id)` | SI | PK |
| `user_photos` | `id` | `user_id`, `tour_id`, `media_url`, `caption`, `city`, `created_at` | UUID | `user_id` -> `auth.users(id)`, `tour_id` -> `tours(id)` | SI | `idx_user_photos_user_id` |
| `favorites` | `id` | `user_id`, `tour_id`, `created_at` | UUID | `user_id` -> `auth.users(id)`, `tour_id` -> `tours(id)` | SI | `idx_favorites_user_id`, UNIQUE(`user_id`, `tour_id`) |
| `notifications` | `id` | `user_id`, `title`, `message`, `type`, `is_read`, `read_at`, `action_text`, `action_type`, `action_url`, `action_data` (JSONB), `category`, `city_scope`, `created_at` | UUID | `user_id` -> `auth.users(id)` | SI | `idx_notifications_user_unread` (parziale), `idx_notifications_city_scope` |

### RPC Functions definite

| Funzione | Usata in | Stato |
|---|---|---|
| `get_nearby_partners_for_tour(tour_id, radius_meters)` | `TourDetails.jsx:806` | Chiamata ma definizione SQL non trovata nel repo |
| `search_nearby_partners(lat, lng, radius_meters, filter_tag)` | `TourBuilder.jsx:185` | Chiamata ma definizione SQL non trovata nel repo |
| `businesses_within_radius(user_lat, user_lng, radius_m)` | `MapPage.jsx` (commentata) | Solo commento, non usata |
| `get_notifications_policies()` | Migrazione `20260304_rpc_get_policies.sql` | Solo debug/admin |
| `handle_new_user()` | Trigger `on_auth_user_created` | Auto-create profilo su signup |

---

## 2. RLS Policies

### Mappa completa RLS per tabella

| Tabella | SELECT | INSERT | UPDATE | DELETE | Note |
|---|---|---|---|---|---|
| `profiles` | Tutti (public) | Solo proprio (uid = id) | Solo proprio (uid = id) | NESSUNA | Nessuna policy DELETE: impossibile cancellare il proprio profilo |
| `tours` | Tutti (public) | guide_id = uid (da `backend_logic_guides.sql`) | guide_id = uid | guide_id = uid (da `backend_logic_guides.sql`) | Policy INSERT/DELETE in file separato, non in `rls_policies.sql` principale |
| `bookings` | user_id = uid OPPURE guida del tour | user_id = uid | Guida del tour (via JOIN tours) | NESSUNA | Nessuna DELETE policy: booking non cancellabile |
| `activities` | Tutti (public) | owner_id = uid | owner_id = uid | NESSUNA | Nessuna DELETE: activity non cancellabile |
| `guide_requests` | user_id = uid OPPURE guide_id = uid OPPURE guide_id IS NULL | user_id = uid | guide_id = uid OPPURE (guide_id IS NULL AND authenticated) | NESSUNA | Richieste aperte (guide_id NULL) visibili a tutte le guide |
| `guides_profile` | Tutti (public) | user_id = uid | user_id = uid | NESSUNA | Nessuna DELETE |
| `businesses_profile` | Tutti (public) | user_id = uid | user_id = uid | NESSUNA | **CRITICO**: nessuna DELETE policy |
| `explorers` | id = uid | id = uid | id = uid | NESSUNA | Solo dati propri |
| `user_photos` | user_id = uid | user_id = uid | NESSUNA | user_id = uid | Nessuna UPDATE ma ha DELETE |
| `favorites` | user_id = uid | user_id = uid | NESSUNA | user_id = uid | Corretto per toggle |
| `notifications` | user_id = uid | `WITH CHECK (true)` (TUTTI autenticati) | user_id = uid | user_id = uid | INSERT aperto a tutti gli autenticati per cross-user messaging |

---

## 3. Auth Flow

### Step-by-step

1. **Signup** (`Login.jsx`):
   - Metodo: `supabase.auth.signUp()` con email + password
   - Ruolo salvato in `user_metadata.role` (explorer/guide/business)
   - `emailRedirectTo` configurato per conferma email
   - Trigger DB `on_auth_user_created` crea automaticamente riga in `profiles`
   - Se ruolo = business, inserisce anche riga in `activities`
   - **NO OAuth**, **NO magic link** - solo email+password

2. **Login** (`Login.jsx`):
   - Metodo: `supabase.auth.signInWithPassword()`
   - Redirect automatico post-login basato su ruolo

3. **Session Management** (`AuthContext.jsx`):
   - `getSession()` al mount del componente
   - `onAuthStateChange()` listener per refresh automatico del token
   - Supabase JS SDK gestisce internamente il refresh del JWT
   - Loading screen bloccante durante init auth

4. **Password Recovery**:
   - `supabase.auth.resetPasswordForEmail()` in `AuthContext.jsx`
   - `redirectTo` punta a `/update-password`
   - `UpdatePassword.jsx` usa `supabase.auth.updateUser({ password })`
   - `PASSWORD_RECOVERY` event catturato in `onAuthStateChange`

5. **Role Detection**:
   - Primario: `user.user_metadata.role`
   - Fallback: `localStorage.getItem('unnivai_role')`
   - `RoleGuard` protegge le route per ruolo
   - `RootDispatcher` redirige alla dashboard corretta

6. **Logout** (`AuthContext.jsx`):
   - `supabase.auth.signOut()`
   - Pulizia `localStorage` di `unnivai_role`
   - Reset state user a null

### Problemi Auth identificati

| Problema | Gravita | Dettaglio |
|---|---|---|
| Nessun rate limiting su login | MEDIA | Tentativi illimitati di password bruteforce (mitigato solo da Supabase infra) |
| Ruolo in localStorage come fallback | ALTA | Un utente puo modificare `localStorage.unnivai_role` per accedere a dashboard non sue |
| Nessun refresh esplicito del token | BASSA | Il SDK gestisce il refresh, ma non c'e handling esplicito per token scaduto durante operazioni |
| `getSession()` vs `getUser()` usati in modo inconsistente | BASSA | Alcune parti usano `getSession()`, altre `getUser()`. `getUser()` valida il token server-side |

---

## 4. Chiamate Supabase

### Lista completa chiamate

| File | Tabella | Operazione | Try/catch | Loading state | Problema |
|---|---|---|---|---|---|
| `dataService.js:144` | `tours` | SELECT (by city) | SI | No diretto | `select('*')` senza JOIN profiles - guide info mancante |
| `dataService.js:172` | `tours` | SELECT (by id, con JOIN profiles) | SI | No diretto | Corretto con `.single()` |
| `dataService.js:249` | `bookings` | INSERT | SI | No diretto | **CRITICO**: errore fallback silenzioso `return { success: true }` anche su errore |
| `dataService.js:292` | `favorites` | SELECT + DELETE/INSERT | SI | No diretto | Corretto con `.maybeSingle()` |
| `dataService.js:327` | `tours` | SELECT (realtime refetch) | SI | No | Dentro callback realtime |
| `dataService.js:348` | `notifications` | SELECT (by user, limit 20) | SI | No diretto | Corretto con `.limit(20)` |
| `dataService.js:436` | `activities` | SELECT (by city) | SI | No diretto | **Select senza limit** - potenzialmente lento con molti POI |
| `dataService.js:488` | `activities` | SELECT (by owner) | SI | No diretto | `select('*')` - overfetch colonne |
| `dataService.js:524` | `bookings` | SELECT (pending, JOIN tours+profiles) | SI | No diretto | Corretto |
| `dataService.js:585` | `businesses_profile` | SELECT (by city) | SI | No diretto | **Select `*` senza limit** - carica TUTTI i business della citta |
| `dataService.js:673` | `businesses_profile` | UPDATE (geocode cache) | No (fire-and-forget `.then()`) | No | **Nessun try/catch**, fire-and-forget |
| `dataService.js:755` | `guide_requests` | INSERT | SI (throw) | No | Corretto |
| `DashboardGuide.jsx:67` | `guides_profile` | SELECT + auto-INSERT | SI | SI (`loading`) | Corretto |
| `DashboardGuide.jsx:97` | `tours` | SELECT (by guide) | SI | SI | `select('*')` - overfetch |
| `DashboardGuide.jsx:123` | `guide_requests` | SELECT (con JOIN profiles+tours) | SI | No | Query complessa con `.or()` |
| `DashboardGuide.jsx:192` | `guides_profile` | UPDATE | SI | SI (`submitting`) | Corretto |
| `DashboardGuide.jsx:225` | `tours` | DELETE | SI | No | Corretto con verifica `.select()` |
| `DashboardGuide.jsx:244` | `notifications` | INSERT | Parziale (solo log) | No | **Nessun try/catch completo** |
| `DashboardGuide.jsx:260` | `guide_requests` | UPDATE (accept/decline) | SI | No | Corretto |
| `DashboardGuide.jsx:290` | `guide_requests` | UPDATE (decline) | SI | No | Corretto |
| `DashboardGuide.jsx:311` | `guide_requests` | UPDATE (claim guide_id) | Parziale | No | Dentro try ma errore non bloccante |
| `DashboardGuide.jsx:340` | `notifications` | SELECT (chat history via JSONB filter) | SI | SI (`loadingHistory`) | Query su `action_data->>request_id` - **no indice JSONB** |
| `DashboardGuide.jsx:414` | `guide_requests` | REALTIME subscribe | No | No | Corretto |
| `DashboardGuide.jsx:714` | `guides_profile` | UPDATE (operating_cities) | In JSX inline | No | **Update dentro render JSX** - anti-pattern |
| `DashboardBusiness.jsx:69` | `businesses_profile` | SELECT + auto-INSERT | SI | SI (`loading`) | Corretto |
| `DashboardBusiness.jsx:278` | `businesses_profile` | UPSERT | SI | No diretto | Corretto |
| `DashboardBusiness.jsx:726` | `tours` | SELECT (tags match) | No (`.then()`) | SI (`loading`) | **Nessun try/catch** - fire-and-forget con `.then()` |
| `Login.jsx:89` | auth | signInWithPassword | SI | SI (`loading`) | Corretto |
| `Login.jsx:92` | auth | signUp | SI | SI | Corretto |
| `Login.jsx:102` | `activities` | INSERT (business default) | `.catch(() => {})` | No | **Errore silenzioso totale** |
| `Notifications.jsx:70` | `notifications` | INSERT (reply) | SI | SI (`isReplying`) | Corretto |
| `Notifications.jsx:104` | `guide_requests` | UPDATE (accept offer) | SI | No | Corretto |
| `Notifications.jsx:111` | `notifications` | INSERT (accept notification) | SI | No | Corretto |
| `Explore.jsx:87` | `tours` | SELECT (live, JOIN profiles) | SI | SI (`loading`) | **Senza limit** - carica tutti i tour live |
| `TourDetails.jsx:753` | `profiles` | SELECT (guide profile) | SI | No | Corretto con `.single()` |
| `TourDetails.jsx:806` | RPC | `get_nearby_partners_for_tour` | Parziale | No | **RPC potrebbe non esistere** nel DB |
| `Profile.jsx:40` | `explorers` | SELECT | SI | No | Corretto con `.single()` |
| `Profile.jsx:55` | `user_photos` | SELECT (JOIN tours) | SI | No | **Senza limit** |
| `Profile.jsx:107` | `guide_requests` | SELECT (user's requests) | SI | No | **Senza limit** |
| `MapPage.jsx:113` | `businesses_profile` | SELECT (con filtri) | SI | No | **Senza limit** - carica tutti i business |
| `TourBuilder.jsx:185` | RPC | `search_nearby_partners` | Parziale | No | **RPC potrebbe non esistere** nel DB |
| `TourBuilder.jsx:303` | `tours` | UPDATE | SI | SI | Corretto |
| `TourBuilder.jsx:314` | `tours` | INSERT | SI | SI | Corretto |
| `TourBuilder.jsx:503` | Storage | upload `tour-images` | SI | No diretto | Bucket potrebbe non esistere |
| `useUserNotifications.js:114` | `notifications` | UPDATE (mark read) | No | No | **Nessun try/catch** |
| `useUserNotifications.js:126` | `notifications` | DELETE | No | No | **Nessun try/catch** |
| `useUserNotifications.js:138` | `notifications` | UPDATE (mark all read) | No | No | **Nessun try/catch** |
| `useUserProfile.js:32` | `profiles` | SELECT (role) | SI | SI | Corretto con `.maybeSingle()` |
| `ChatModalUser.jsx:22` | `notifications` | SELECT (chat history) | SI | SI | Query JSONB senza indice |
| `ChatModalUser.jsx:48` | `notifications` | INSERT | SI | No | Corretto |
| `ImageUploader.jsx:22` | Storage | upload `business-media` | SI | SI (`uploading`) | Corretto con retry e bucket auto-create |
| `userContextService.js:143` | `tours` | SELECT (count only, head:true) | SI | No | Corretto con `{ count: 'exact', head: true }` |
| `userContextService.js:240` | `profiles` | UPSERT (city) | SI (catch vuoto) | No | Corretto |
| `userContextService.js:249` | `profiles` | SELECT (city) | SI | No | Corretto con `.single()` |
| `UpdatePassword.jsx:19` | auth | updateUser | SI | SI | Corretto |
| `DashboardUser.jsx:206` | auth | getUser + realtime | Parziale | No | Corretto |
| `DashboardUser.jsx:246` | auth + `createGuideRequest` | getUser + INSERT | SI | SI | Corretto |
| `Landing.jsx:627` | `explorers` | SELECT (test ping) | SI | No | Solo connectivity test |

### Realtime Subscriptions

| File | Channel | Tabella | Evento | Cleanup |
|---|---|---|---|---|
| `dataService.js:323` | `public:tours` | `tours` | UPDATE | Return channel |
| `dataService.js:397` | `notifications:{userId}` | `notifications` | INSERT (filtrato per user) | Return channel |
| `DashboardGuide.jsx:166` | `guide_requests_channel` | `guide_requests` | ALL (*) | SI (removeChannel) |
| `DashboardUser.jsx:210` | `user_notifications_{userId}` | `notifications` | INSERT (filtrato per user) | SI (removeChannel) |

---

## 5. Vulnerabilita Sicurezza

### Ordinate per gravita (CRITICA -> BASSA)

#### CRITICA

1. **Notifications INSERT aperto a tutti gli autenticati**
   - File: `20260304_force_notifications_insert_policy.sql`, `20260304_add_city_scope_notifications.sql`
   - Policy: `WITH CHECK (true)` su INSERT
   - Rischio: **Qualsiasi utente autenticato puo inserire notifiche a nome di qualsiasi altro utente** (spoofing notifiche). Un utente malintenzionato puo inviare notifiche false a qualsiasi user_id.
   - Fix: Aggiungere validazione server-side o edge function per l'invio cross-user, oppure restringere a `auth.uid() = user_id OR <logica di ruolo>`.

2. **Ruolo utente leggibile/modificabile da localStorage**
   - File: `AuthContext.jsx:59`
   - Codice: `localStorage.getItem('unnivai_role')` come fallback
   - Rischio: Un utente puo cambiare il proprio ruolo a "guide" o "business" via DevTools e accedere a dashboard non autorizzate.
   - Fix: Validare sempre il ruolo da `user_metadata` o da una tabella DB con RLS, mai da localStorage.

3. **Booking errori mascherati come successo**
   - File: `dataService.js:264-276`
   - Codice: `return { success: true }` sia su errore che su catch
   - Rischio: L'utente crede di aver prenotato ma la prenotazione non esiste nel DB. Nessun feedback all'utente.
   - Fix: Propagare l'errore al chiamante e mostrare feedback.

#### ALTA

4. **RPC functions non definite nel repo**
   - `get_nearby_partners_for_tour` e `search_nearby_partners` sono chiamate nel codice ma le definizioni SQL non sono presenti nelle migrations.
   - Rischio: Errori 404 runtime; se definite manualmente nel Dashboard, non sono version-controlled.
   - Fix: Aggiungere le definizioni SQL come migrations.

5. **Nessuna policy DELETE su bookings, activities, profiles, guides_profile, businesses_profile**
   - Rischio: Gli utenti non possono mai cancellare i propri dati (problema GDPR).
   - Fix: Aggiungere DELETE policies con `auth.uid() = user_id/id`.

6. **guide_requests UPDATE aperto a tutti gli autenticati quando guide_id IS NULL**
   - File: `20260303_fix_missing_tables_and_columns.sql`
   - Policy: `USING (auth.uid() = guide_id OR (guide_id IS NULL AND auth.uid() IS NOT NULL))`
   - Rischio: Qualsiasi utente autenticato (anche un explorer) puo aggiornare richieste aperte non assegnate.

7. **`getActivitiesByCity` senza limit**
   - File: `dataService.js:436`
   - Rischio: Se una citta ha migliaia di POI, la query restituisce tutto. Performance degradata e potenziale OOM su mobile.
   - Fix: Aggiungere `.limit(100)` o paginazione.

#### MEDIA

8. **Query N+1 potenziale in `getToursByCity`**
   - File: `dataService.js:144`
   - Il `select('*')` non include JOIN a `profiles`. Ogni tour non ha info guida.
   - Nota: `Explore.jsx` fa il JOIN corretto, ma `dataService.getToursByCity` no.

9. **Query JSONB senza indice**
   - File: `DashboardGuide.jsx:342`, `ChatModalUser.jsx:24`
   - `.eq('action_data->>request_id', req.id)` su colonna JSONB senza indice specifico.
   - Fix: `CREATE INDEX idx_notifications_action_data_request_id ON notifications ((action_data->>'request_id'));`

10. **Fire-and-forget database writes senza error handling**
    - `dataService.js:673`: update businesses_profile coords in `.then()` senza catch
    - `DashboardBusiness.jsx:726`: query tours con `.then()` senza catch
    - `Login.jsx:106`: insert activities con `.catch(() => {})`

11. **`useUserNotifications` - markAsRead/delete senza try/catch**
    - File: `useUserNotifications.js:114,126,138`
    - Le operazioni di update/delete su notifications non hanno error handling.

#### BASSA

12. **`select('*')` overfetch in vari punti**
    - `DashboardGuide.jsx:98`: tours select *
    - `DashboardGuide.jsx:67`: guides_profile select *
    - `dataService.js:488`: activities select *
    - Fix: Specificare solo le colonne necessarie.

13. **`Explore.jsx` senza limit sui tour**
    - File: `Explore.jsx:98`
    - `query.order('created_at', { ascending: false })` senza `.limit()`
    - In produzione con molti tour, performance degradata.

14. **user_photos e guide_requests SELECT senza limit**
    - File: `Profile.jsx:55,107`
    - Potenziale overfetch per utenti molto attivi.

15. **`businesses_profile` SELECT senza limit in MapPage**
    - File: `MapPage.jsx:113`
    - Carica tutti i business con location non-null.

---

## 6. Storage

### Bucket identificati nel codice

| Bucket | Usato in | Tipo | Policy |
|---|---|---|---|
| `business-media` | `ImageUploader.jsx` (default) | Pubblico (auto-created con `public: true`) | **Nessuna policy SQL definita** - il bucket viene creato runtime con `createBucket()` se non esiste |
| `tour-images` | `TourBuilder.jsx:504` | Non specificato | **Nessuna policy SQL definita** |

### Problemi Storage

1. **Nessuna policy di storage definita nei file SQL** - Le bucket policies (chi puo upload/download) non sono version-controlled. Dipendono dalla configurazione manuale nel Dashboard Supabase.

2. **Auto-creazione bucket lato client** (`ImageUploader.jsx:31`) - Il client tenta `createBucket()` se il bucket non esiste. Questo richiede permessi elevati e potrebbe fallire con anon key.

3. **Nessuna validazione file type/size** - `ImageUploader.jsx` accetta qualsiasi file con `accept="image/*"` ma non valida dimensione o tipo server-side.

4. **File path prevedibile** - `${userId}/${Date.now()}.${fileExt}` - un utente puo enumerare i file di altri utenti se il bucket e pubblico.

---

## 7. Edge Functions

**Nessuna Edge Function trovata nel repository.**

La directory `supabase/functions/` non esiste.

### Funzionalita che beneficerebbero di Edge Functions

| Funzionalita | Stato attuale | Rischio |
|---|---|---|
| Invio notifiche cross-user | INSERT diretto da client con RLS aperta | Spoofing notifiche |
| Geocoding e cache coordinate | Fatto client-side con fire-and-forget update | Inconsistenza dati |
| Validazione booking | Tutto lato client, errori mascherati | Booking fantasma |
| Business AI analysis | Chiamata OpenAI da client | API key esposta nel bundle |
| Calcolo partner nearby (RPC) | RPC SQL non trovate | Potenziale 404 |

---

## 8. Trigger Database

| Trigger | Tabella | Evento | Funzione | Scopo |
|---|---|---|---|---|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` | Auto-crea riga in `profiles` con ruolo da metadata |
| `trg_guides_profile_updated_at` | `guides_profile` | BEFORE UPDATE | `set_updated_at()` | Aggiorna `updated_at` automaticamente |
| `trg_explorers_updated_at` | `explorers` | BEFORE UPDATE | `set_updated_at()` | Aggiorna `updated_at` automaticamente |

---

## 9. Riepilogo Azioni Raccomandate

### Priorita 1 (Sicurezza)
- [ ] Restringere la policy INSERT su `notifications` per impedire spoofing cross-user
- [ ] Rimuovere fallback `localStorage` per il ruolo utente, validare sempre server-side
- [ ] Propagare errori booking al frontend (rimuovere `return { success: true }` su errore)
- [ ] Creare Edge Function per invio notifiche cross-user
- [ ] Aggiungere DELETE policies per conformita GDPR (profiles, bookings, businesses_profile)

### Priorita 2 (Stabilita)
- [ ] Aggiungere le definizioni SQL per le RPC `get_nearby_partners_for_tour` e `search_nearby_partners` nelle migrations
- [ ] Aggiungere indice JSONB su `notifications.action_data->>'request_id'`
- [ ] Aggiungere try/catch in `useUserNotifications` per markAsRead/delete/markAllAsRead
- [ ] Definire storage bucket policies nei file SQL di migrazione

### Priorita 3 (Performance)
- [ ] Aggiungere `.limit()` alle query senza paginazione (activities, tours explore, businesses, user_photos, guide_requests)
- [ ] Sostituire `select('*')` con colonne specifiche dove possibile
- [ ] Aggiungere JOIN profiles in `getToursByCity()` per evitare query N+1
- [ ] Validare file size/type lato server per upload Storage

### Priorita 4 (Code Quality)
- [ ] Rimuovere fire-and-forget `.then()` e aggiungere error handling
- [ ] Spostare update DB fuori dal JSX render (`DashboardGuide.jsx:714`)
- [ ] Unificare uso `getSession()` vs `getUser()` - preferire `getUser()` per validazione server-side
