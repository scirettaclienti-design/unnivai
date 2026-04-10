# DOVEVAI -- MASTER AUDIT REPORT

**Data:** 2026-04-10
**Analista:** Claude Code
**Progetto:** DoveVAI (unnivai-ricresa) -- Piattaforma turismo italiano
**Stack:** React 19 + Vite 7 + Supabase + Google Maps + OpenAI + Tailwind CSS

---

## EXECUTIVE SUMMARY

DoveVAI e' un progetto con un'interfaccia visivamente curata, un'architettura frontend ben strutturata (React 19 + Vite + Supabase + Google Maps) e feature AI innovative per la generazione di itinerari turistici. Tuttavia, il divario tra "demo impressionante" e "prodotto pronto per il mercato" e' significativo. Le criticita' principali sono: (1) la API key OpenAI esposta nel bundle client, che rappresenta un rischio finanziario immediato; (2) l'assenza totale di un sistema di pagamento (Stripe non integrato), che impedisce qualsiasi monetizzazione; (3) numerose feature simulate o placeholder (BecomeGuide, Photos, Trending, QuickPath) che ingannano l'utente; (4) vulnerabilita' di sicurezza nel layer RLS e nella gestione dei ruoli. Il progetto necessita di un intervento strutturale su sicurezza e pagamenti prima di qualsiasi go-live, ma la base tecnica e' solida e recuperabile con un piano di lavoro mirato.

---

## SCORE CARD

| Area | Score /10 | Stato | Bloccante per go-live? |
|------|-----------|-------|------------------------|
| Frontend | 6/10 | Funzionante con lacune (pagine mock, codice morto, duplicati) | NO (ma richiede pulizia) |
| State Management | 5/10 | Context+Hooks funzionali ma con bug, duplicazioni e codice morto | SI (bug refreshRole, listener orfani) |
| Database + Auth | 6/10 | Schema solido, RLS presente ma con falle critiche | SI (notifiche spoofabili, booking silenzioso) |
| Sicurezza | 2/10 | API key OpenAI esposta, XSS potenziale, role spoofing, test con chiavi hardcoded | SI |
| Performance | 5/10 | Google Maps caricato globalmente, nessun lazy img, nessun clustering, bundle pesante | NO (ma degrada UX) |
| Google Maps | 7/10 | Integrazione ricca (Vector 3D, Directions, Places, navigazione RT) con residui Mapbox | NO |
| AI Integration | 4/10 | Generazione itinerari funzionante ma client-side, modello obsoleto, feature rotte | SI (API key esposta) |
| Stripe | 0/10 | Completamente assente. Zero integrazione. | SI |
| UX/Conversione | 4/10 | UI curata ma flussi incompleti, mock mescolati a dati reali, onboarding assente | SI |
| Brand Alignment | 7/10 | Coerente (orange/terracotta, Quicksand, tono italiano) con eccezioni minori | NO |

---

## PIANO INTERVENTI -- PRIORITA' CRITICA

---
**TASK ID:** DVAI-001
**AREA:** Sicurezza / AI
**PROBLEMA:** API Key OpenAI (`sk-proj-...`) esposta nel bundle JS client-side. Chiunque puo' estrarre la chiave da DevTools e generare costi illimitati sull'account OpenAI.
**IMPATTO:** Rischio finanziario immediato e illimitato. Un singolo script malevolo puo' consumare centinaia di dollari in ore.
**SOLUZIONE:** Creare una Supabase Edge Function (o Vercel API route) che faccia da proxy per tutte le chiamate OpenAI. Rimuovere `VITE_OPENAI_API_KEY` dal `.env` frontend. Revocare la chiave attuale e generarne una nuova solo per il backend.
**FILE:** `src/services/aiRecommendationService.js`, `src/services/placesDiscoveryService.js`, `.env`
**EFFORT:** 8 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-002
**AREA:** Sicurezza
**PROBLEMA:** `dangerouslySetInnerHTML` con dati da Google Directions API senza sanitizzazione. Rischio XSS se la risposta viene manipolata.
**IMPATTO:** Attacco XSS potenziale tramite istruzioni di navigazione manipolate.
**SOLUZIONE:** Installare `DOMPurify` e sanitizzare l'HTML prima del rendering: `DOMPurify.sanitize(routeStats.steps[0].instructions)`.
**FILE:** `src/pages/MapPage.jsx:1057`
**EFFORT:** 1 ora
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-003
**AREA:** Sicurezza
**PROBLEMA:** 12+ file di test con Supabase Anon Key hardcoded nella root del progetto. Non in `.gitignore`. Se deployati su Vercel, espongono logica interna.
**IMPATTO:** Esposizione credenziali e logica di test in produzione.
**SOLUZIONE:** Spostare tutti i file `test_*.mjs/js`, `verify_*.js`, `check_*.mjs` in una cartella `tests/` aggiunta a `.gitignore`, oppure eliminarli. Far leggere le chiavi da `.env` via `dotenv`.
**FILE:** Root: `test_*.mjs`, `verify_*.js`, `check_mario.mjs`, `test-db.js`, `test-rls.js` (12+ file)
**EFFORT:** 2 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-004
**AREA:** Sicurezza / Database
**PROBLEMA:** Policy INSERT su `notifications` con `WITH CHECK (true)` permette a qualsiasi utente autenticato di inserire notifiche a nome di qualsiasi altro utente (spoofing).
**IMPATTO:** Un utente malintenzionato puo' inviare notifiche false a qualsiasi user_id, impersonando guide o la piattaforma.
**SOLUZIONE:** Restringere la policy a `auth.uid() = user_id` oppure creare una Edge Function per l'invio cross-user con validazione server-side.
**FILE:** `supabase/migrations/20260304_force_notifications_insert_policy.sql`
**EFFORT:** 3 ore
**DIPENDENZE:** DVAI-001 (se si usa Edge Function)
---

---
**TASK ID:** DVAI-005
**AREA:** Database / UX
**PROBLEMA:** `createBooking()` ritorna SEMPRE `{ success: true }` anche quando Supabase fallisce. L'utente crede di aver prenotato ma la prenotazione non esiste.
**IMPATTO:** Perdita totale di prenotazioni senza feedback. L'utente e la guida non vengono mai connessi.
**SOLUZIONE:** Propagare l'errore Supabase al chiamante: `return { success: false, error: error.message }`. Mostrare un toast di errore nell'UI.
**FILE:** `src/services/dataService.js:262-277`
**EFFORT:** 1 ora
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-006
**AREA:** Stripe / Monetizzazione
**PROBLEMA:** Stripe non e' integrato. Nessun SDK, nessuna chiave API, nessun webhook, nessun checkout. Il flusso di prenotazione si interrompe con un `alert()` placeholder. La piattaforma non puo' generare revenue.
**IMPATTO:** Zero conversioni a pagamento. Il modello di business non funziona.
**SOLUZIONE:** Integrare Stripe Checkout (server-side via Edge Function): (1) creare endpoint per generare sessioni Checkout, (2) aggiungere webhook per conferma pagamento e aggiornamento status booking, (3) collegare il flusso Notifications "ACCETTA E PAGA" al Checkout reale.
**FILE:** Nuovo: `supabase/functions/create-checkout/`, `supabase/functions/stripe-webhook/`. Modifica: `src/pages/Notifications.jsx`, `src/components/BookingSystem.jsx`, `src/services/dataService.js`
**EFFORT:** 20 ore
**DIPENDENZE:** DVAI-001 (infrastruttura Edge Functions)
---

---
**TASK ID:** DVAI-007
**AREA:** State Management
**PROBLEMA:** `refreshRole` destructurato in `Login.jsx` da `useAuth()` ma inesistente in AuthContext. Causa `undefined` e potenziale runtime error se invocato.
**IMPATTO:** Crash a runtime durante il flusso di login.
**SOLUZIONE:** Implementare `refreshRole()` in AuthContext (re-fetch ruolo da `user.user_metadata.role`) oppure rimuovere la destructurazione da Login.jsx.
**FILE:** `src/pages/Login.jsx:70`, `src/context/AuthContext.jsx`
**EFFORT:** 1 ora
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-008
**AREA:** Sicurezza / Auth
**PROBLEMA:** Il ruolo utente usa `localStorage.getItem('unnivai_role')` come fallback. Un utente puo' modificare il localStorage via DevTools e accedere a dashboard guide/business non autorizzate.
**IMPATTO:** Esposizione di funzionalita' non autorizzate (le RLS DB proteggono i dati, ma l'UI espone feature).
**SOLUZIONE:** Rimuovere il fallback localStorage. Leggere il ruolo esclusivamente da `user.user_metadata.role` o da query a tabella `profiles` con RLS.
**FILE:** `src/context/AuthContext.jsx:59`
**EFFORT:** 2 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-009
**AREA:** Sicurezza / Google Maps
**PROBLEMA:** Google Maps API Key esposta nel bundle client senza conferma di restrizioni HTTP Referrer nella Google Cloud Console. Chiunque puo' abusare della chiave.
**IMPATTO:** Costi Google Maps incontrollati.
**SOLUZIONE:** Nella Google Cloud Console: (1) restringere la key a `*.tuodominio.com/*`, (2) limitare le API abilitate (Maps JS, Places, Geocoding, Directions), (3) impostare budget cap giornaliero.
**FILE:** Configurazione Google Cloud Console (non codice)
**EFFORT:** 1 ora
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-010
**AREA:** AI
**PROBLEMA:** `analyzeBusinessDescription` chiamato in `DashboardBusiness.jsx:152` ma la funzione non esiste in `aiRecommendationService.js`. Crash a runtime quando un business tenta l'analisi AI.
**IMPATTO:** Funzionalita' "Analizza con AI" nella dashboard business completamente rotta.
**SOLUZIONE:** Implementare la funzione `analyzeBusinessDescription()` nel service, oppure rimuovere il pulsante "Analizza con AI" dalla dashboard.
**FILE:** `src/services/aiRecommendationService.js`, `src/pages/DashboardBusiness.jsx:152`
**EFFORT:** 3 ore
**DIPENDENZE:** DVAI-001 (se implementata, deve passare per il proxy)
---

---

## PIANO INTERVENTI -- PRIORITA' ALTA

---
**TASK ID:** DVAI-011
**AREA:** UX
**PROBLEMA:** Nessun onboarding post-registrazione. L'utente atterra sulla dashboard senza guida, tutorial, o richiesta di preferenze.
**IMPATTO:** Alto tasso di abbandono nei primi 60 secondi. L'utente non capisce il valore della piattaforma.
**SOLUZIONE:** Creare un wizard onboarding (3-5 step): citta' preferita, interessi, tipo viaggio, breve tutorial delle funzionalita'.
**FILE:** Nuovo: `src/pages/Onboarding.jsx`. Modifica: `src/App.jsx` (route), `src/context/AuthContext.jsx` (flag primo accesso)
**EFFORT:** 10 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-012
**AREA:** UX / Dati
**PROBLEMA:** Tour mock (id numerici, dati hardcoded) mescolati a tour reali (UUID da Supabase) senza distinzione. Cliccando "Contatta Guida" su un tour mock, il sistema fallisce silenziosamente (guideId non e' UUID valido).
**IMPATTO:** Frustrazione utente, perdita fiducia nella piattaforma.
**SOLUZIONE:** (1) Aggiungere badge visibile "Demo" ai tour senza guida reale, (2) disabilitare "Contatta Guida" e "Prenota" per tour mock, (3) a medio termine eliminare i tour mock e popolare con dati reali o seed DB coerenti.
**FILE:** `src/pages/TourDetails.jsx`, `src/pages/TourLive.jsx`, `src/pages/Home.jsx`, `src/pages/Trending.jsx`, `src/pages/SurpriseTour.jsx`
**EFFORT:** 6 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-013
**AREA:** Database
**PROBLEMA:** Nessuna policy DELETE su `profiles`, `bookings`, `activities`, `guides_profile`, `businesses_profile`. Gli utenti non possono cancellare i propri dati.
**IMPATTO:** Non conformita' GDPR. Impossibilita' di cancellare account/dati.
**SOLUZIONE:** Aggiungere DELETE policies con `auth.uid() = user_id/id` per ogni tabella. Creare un flusso "Elimina Account" nell'UI.
**FILE:** Nuova migrazione SQL, `src/pages/Profile.jsx` (pulsante elimina account)
**EFFORT:** 5 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-014
**AREA:** Database
**PROBLEMA:** RPC functions `get_nearby_partners_for_tour` e `search_nearby_partners` chiamate nel codice ma definizioni SQL non presenti nelle migrations del repository. Potenziale 404 a runtime.
**IMPATTO:** Funzionalita' partner matching e TourBuilder rotte se le RPC non sono definite manualmente nel Dashboard.
**SOLUZIONE:** Aggiungere le definizioni SQL come migrations versionabili nel repository.
**FILE:** Nuova migrazione in `supabase/migrations/`, `src/pages/TourDetails.jsx:806`, `src/pages/guide/TourBuilder.jsx:185`
**EFFORT:** 4 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-015
**AREA:** UX
**PROBLEMA:** Pagina BecomeGuide (`/become-guide`) simula il submit con `setTimeout`. I dati del form vanno persi. Le guide candidate credono di essersi registrate ma nulla viene salvato.
**IMPATTO:** Perdita totale delle candidature guide. Impossibile reclutare guide.
**SOLUZIONE:** Salvare la candidatura su una tabella `guide_applications` in Supabase con notifica admin.
**FILE:** `src/pages/BecomeGuide.jsx:35-44`, nuova migrazione SQL
**EFFORT:** 4 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-016
**AREA:** State Management
**PROBLEMA:** CityContext non persiste la citta' selezionata. Al refresh della pagina, la citta' torna a 'Roma' anche se l'utente aveva scelto Milano.
**IMPATTO:** Esperienza utente frustrante. L'utente deve ri-selezionare la citta' ad ogni visita.
**SOLUZIONE:** Aggiungere persistenza localStorage in `CityContext.setCity()`, sincronizzando con la chiave `user_city`.
**FILE:** `src/context/CityContext.jsx`
**EFFORT:** 1 ora
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-017
**AREA:** Sicurezza / Database
**PROBLEMA:** `businesses_profile` INSERT/UPDATE non verificano il ruolo 'business'. Un utente explorer potrebbe creare un profilo business.
**IMPATTO:** Inquinamento dati, profili business non autorizzati.
**SOLUZIONE:** Aggiungere check `auth.jwt() ->> 'role' = 'business'` nelle policy INSERT/UPDATE.
**FILE:** Nuova migrazione SQL
**EFFORT:** 1 ora
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-018
**AREA:** Sicurezza / Database
**PROBLEMA:** `businesses_profile.subscription_tier` non ha trigger di protezione (a differenza di `activities`). Un utente puo' auto-promuoversi a `elite` via client.
**IMPATTO:** Business non paganti accedono a vantaggi premium (boost visibilita', matching prioritario).
**SOLUZIONE:** Aggiungere trigger `protect_business_subscription` analogo a quello su `activities`.
**FILE:** Nuova migrazione SQL
**EFFORT:** 1 ora
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-019
**AREA:** Frontend / Validazione
**PROBLEMA:** Nessuna validazione input nei form (Login, BecomeGuide, TourBuilder). Solo `required` HTML. Password accettata con "123456".
**IMPATTO:** Account con password deboli, dati malformati nel DB.
**SOLUZIONE:** Usare Zod (gia' in dipendenze) per validare form prima del submit. Creare schemi per RegistrationInput, BecomeGuideInput, TourInput. Aggiungere indicatore forza password.
**FILE:** `src/pages/Login.jsx`, `src/pages/BecomeGuide.jsx`, `src/pages/guide/TourBuilder.jsx`
**EFFORT:** 5 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-020
**AREA:** AI
**PROBLEMA:** Modello `gpt-3.5-turbo` obsoleto (fine-vita imminente). Qualita' inferiore rispetto a `gpt-4o-mini` allo stesso costo.
**IMPATTO:** Itinerari meno accurati, POI potenzialmente inventati, coordinate imprecise.
**SOLUZIONE:** Sostituire `gpt-3.5-turbo` con `gpt-4o-mini` in tutte le chiamate AI. Nessuna modifica ai prompt necessaria.
**FILE:** `src/services/aiRecommendationService.js`, `src/services/placesDiscoveryService.js`
**EFFORT:** 1 ora
**DIPENDENZE:** DVAI-001 (dopo migrazione a proxy server)
---

---

## PIANO INTERVENTI -- PRIORITA' MEDIA

---
**TASK ID:** DVAI-021
**AREA:** State Management
**PROBLEMA:** `useUserProfile.js` e `useGeolocation.js` sono codice morto (zero importazioni). `useUserProfile` mantiene un listener `onAuthStateChange` attivo inutilmente.
**IMPATTO:** Bundle size inutile, listener orfani, confusione per sviluppatori.
**SOLUZIONE:** Eliminare entrambi i file.
**FILE:** `src/hooks/useUserProfile.js`, `src/hooks/useGeolocation.js`
**EFFORT:** 0.5 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-022
**AREA:** Performance
**PROBLEMA:** `<APIProvider>` (Google Maps SDK ~200KB) wrappa TUTTA l'app, caricando l'SDK anche su pagine che non usano la mappa (Login, Profile, Notifications).
**IMPATTO:** First Contentful Paint stimato 2.5-3.5s invece del target <1.8s.
**SOLUZIONE:** Spostare `<APIProvider>` solo nei componenti mappa (MapPage, TourBuilder, Explore) o lazy-loadare il provider.
**FILE:** `src/App.jsx:83`
**EFFORT:** 3 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-023
**AREA:** Performance / Maps
**PROBLEMA:** Nessun clustering marker sulla mappa. Oltre 50 POI/business la mappa rallenta e diventa illeggibile.
**IMPATTO:** Performance degradata su citta' con molte attivita'.
**SOLUZIONE:** Implementare `@googlemaps/markerclusterer` per raggruppare i marker a zoom bassi.
**FILE:** `src/components/UnnivaiMap.jsx`, `src/pages/MapPage.jsx`
**EFFORT:** 4 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-024
**AREA:** Database / Performance
**PROBLEMA:** Query Supabase senza `.limit()` in 6+ punti: `getActivitiesByCity`, `getBusinessesByCityAndTags`, `Explore.jsx`, `MapPage.jsx`, `Profile.jsx` (user_photos, guide_requests).
**IMPATTO:** Potenziale OOM su mobile con molti dati. Performance degradata.
**SOLUZIONE:** Aggiungere `.limit(100)` o paginazione a tutte le query senza limit.
**FILE:** `src/services/dataService.js:436,585`, `src/pages/Explore.jsx:98`, `src/pages/MapPage.jsx:113`, `src/pages/Profile.jsx:55,107`
**EFFORT:** 2 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-025
**AREA:** State Management
**PROBLEMA:** `staleTime: 0` in `useUserContext()` causa refetch eccessivi su 17 componenti consumatori. Ogni mount/remount triggera una nuova query.
**IMPATTO:** Chiamate API ridondanti, latenza percepita, consumo dati mobile.
**SOLUZIONE:** Settare `staleTime: 60_000` (il meteo non cambia ogni secondo).
**FILE:** `src/hooks/useUserContext.js`
**EFFORT:** 0.5 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-026
**AREA:** UX
**PROBLEMA:** Pagina Home (`/home`) duplica quasi interamente Dashboard User (`/dashboard-user`). Due pagine con contenuti simili raggiungibili da link diversi.
**IMPATTO:** Confusione utente, UX inconsistente.
**SOLUZIONE:** Eliminare `Home.jsx` e fare redirect `/home` -> `/dashboard-user`.
**FILE:** `src/pages/Home.jsx`, `src/App.jsx`
**EFFORT:** 1 ora
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-027
**AREA:** UX
**PROBLEMA:** Link `/notification-settings` in pagina Notifications punta a route inesistente. Pagina bianca.
**IMPATTO:** Dead-end UX.
**SOLUZIONE:** Creare la pagina NotificationSettings o rimuovere l'icona settings.
**FILE:** `src/pages/Notifications.jsx`
**EFFORT:** 1 ora (rimuovere) o 4 ore (implementare)
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-028
**AREA:** UX
**PROBLEMA:** "Rigenera Giorno" in AI Itinerary fa `setTimeout` di 2s e poi mostra gli stessi dati. Non rigenera nulla.
**IMPATTO:** Feature promessa ma non implementata. Perdita fiducia nell'AI.
**SOLUZIONE:** Implementare chiamata reale a `aiRecommendationService` per il singolo giorno con preferenze aggiornate.
**FILE:** `src/pages/AiItinerary.jsx`
**EFFORT:** 3 ore
**DIPENDENZE:** DVAI-001 (proxy AI)
---

---
**TASK ID:** DVAI-029
**AREA:** Maps
**PROBLEMA:** `SmartMarker.jsx` e' codice morto Mapbox (renderizza `<div hidden>`). `mapService.js` usa ancora Mapbox Directions (legacy, non nel flow principale).
**IMPATTO:** Confusione codebase, bundle size inutile.
**SOLUZIONE:** Eliminare `SmartMarker.jsx` e `mapService.js`. Rimuovere `VITE_MAPBOX_TOKEN` se non piu' necessario.
**FILE:** `src/components/Map/SmartMarker.jsx`, `src/services/mapService.js`
**EFFORT:** 1 ora
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-030
**AREA:** Maps
**PROBLEMA:** `MAP_MOODS` in `schemas.js` usa placeholder string (`'GOOGLE_MAP_ID_ROMANTIC'`, etc.) invece di Map ID reali. Solo `default` ha un ID vero. Il mood switching sulla mappa non funziona.
**IMPATTO:** Feature "mood sulla mappa" non funzionante.
**SOLUZIONE:** Creare Map Styles nella Google Cloud Console e sostituire i placeholder con Map ID reali.
**FILE:** `src/lib/schemas.js`
**EFFORT:** 2 ore
**DIPENDENZE:** Configurazione Google Cloud Console
---

---
**TASK ID:** DVAI-031
**AREA:** Database
**PROBLEMA:** Query JSONB `action_data->>request_id` su tabella `notifications` senza indice specifico. Usata in chat guida-utente.
**IMPATTO:** Performance degradata con crescita delle notifiche.
**SOLUZIONE:** `CREATE INDEX idx_notifications_action_data_request_id ON notifications ((action_data->>'request_id'));`
**FILE:** Nuova migrazione SQL
**EFFORT:** 0.5 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-032
**AREA:** Maps / Geolocalizzazione
**PROBLEMA:** `useEnhancedGeolocation` chiama endpoint API inesistenti (`/api/location/save`, `/api/location/nearby`). Errori 404 silenziosi ad ogni mount.
**IMPATTO:** Chiamate HTTP inutili, errori silenziosi.
**SOLUZIONE:** Rimuovere le chiamate a `saveLocationToBackend()` e `getNearbyData()`, oppure implementare gli endpoint come Edge Functions.
**FILE:** `src/hooks/useEnhancedGeolocation.js`
**EFFORT:** 1 ora
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-033
**AREA:** Database
**PROBLEMA:** `useUserNotifications` fa chiamate Supabase dirette (update, delete) senza try/catch e senza passare per dataService.
**IMPATTO:** Errori silenziosi su operazioni di lettura/cancellazione notifiche.
**SOLUZIONE:** Aggiungere try/catch. Spostare le mutation in dataService e usare `useMutation` di React Query.
**FILE:** `src/hooks/useUserNotifications.js:114,126,138`
**EFFORT:** 2 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-034
**AREA:** AI
**PROBLEMA:** Nessuna verifica dei POI generati dall'AI. Il modello puo' inventare posti inesistenti con coordinate sbagliate.
**IMPATTO:** Utente navigato verso luoghi inesistenti. Perdita fiducia totale.
**SOLUZIONE:** Cross-check i POI generati con Google Places `findPlaceFromQuery`. Filtrare i risultati con confidence score basso.
**FILE:** `src/services/aiRecommendationService.js`
**EFFORT:** 6 ore
**DIPENDENZE:** DVAI-001 (proxy)
---

---
**TASK ID:** DVAI-035
**AREA:** UX
**PROBLEMA:** Pagine Photos e Trending sono completamente mock (dati hardcoded) ma prominenti nella bottom navigation. Photos non permette upload reale.
**IMPATTO:** L'utente scopre rapidamente che sono finte. Perdita credibilita'.
**SOLUZIONE:** Implementare con dati reali oppure rimuovere dalla bottom nav e spostarle come "Coming Soon" con badge.
**FILE:** `src/pages/Photos.jsx`, `src/pages/Trending.jsx`, `src/components/BottomNavigation.jsx`
**EFFORT:** 2 ore (rimozione) o 15 ore (implementazione)
**DIPENDENZE:** Nessuna
---

---

## PIANO INTERVENTI -- PRIORITA' BASSA

---
**TASK ID:** DVAI-036
**AREA:** Performance
**PROBLEMA:** Nessun `loading="lazy"` sulle immagini. Tutte le `<img>` vengono scaricate immediatamente.
**IMPATTO:** Largest Contentful Paint stimato 3-5s. Consumo dati mobile elevato.
**SOLUZIONE:** Aggiungere `loading="lazy"` a tutte le immagini below-the-fold. Creare componente `<LazyImage>`.
**FILE:** `src/pages/Landing.jsx`, `src/pages/MapPage.jsx`, `src/pages/TourDetails.jsx`, componenti Map
**EFFORT:** 3 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-037
**AREA:** Performance / Bundle
**PROBLEMA:** Pacchetto `openai` (SDK ufficiale, ~50KB) installato ma mai usato (il codice usa `fetch` diretto).
**IMPATTO:** Bundle size inutilmente aumentato.
**SOLUZIONE:** Rimuovere `"openai": "^6.22.0"` da package.json.
**FILE:** `package.json`
**EFFORT:** 0.5 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-038
**AREA:** Performance
**PROBLEMA:** Decine di `console.log`, `console.warn`, `console.error` con emoji in produzione.
**IMPATTO:** Performance degradata su mobile, logica interna esposta.
**SOLUZIONE:** Creare un logger utility che disabilita i log in produzione: `const log = import.meta.env.DEV ? console.log : () => {}`.
**FILE:** `src/services/dataService.js`, `src/services/aiRecommendationService.js`, vari componenti
**EFFORT:** 2 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-039
**AREA:** UX
**PROBLEMA:** `alert()` nativi usati come feedback in 5+ punti (DashboardGuide, DashboardBusiness, Notifications, UpdatePassword).
**IMPATTO:** UX inconsistente, non professionale.
**SOLUZIONE:** Implementare `useToast()` reale (attualmente e' uno stub) o usare una libreria toast. Sostituire tutti gli `alert()`.
**FILE:** `src/hooks/use-toast.js`, `src/pages/DashboardGuide.jsx`, `src/pages/DashboardBusiness.jsx`, `src/pages/Notifications.jsx`, `src/pages/UpdatePassword.jsx`
**EFFORT:** 3 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-040
**AREA:** UX
**PROBLEMA:** BookingSystem.jsx usa date hardcoded di gennaio/febbraio 2025 (gia' passate). Nessun calendario reale della guida.
**IMPATTO:** Prenotazione con date non valide.
**SOLUZIONE:** Generare date dinamiche a partire da oggi. A medio termine, implementare calendario disponibilita' guida.
**FILE:** `src/components/BookingSystem.jsx:12-15`
**EFFORT:** 2 ore (date dinamiche) o 12 ore (calendario completo)
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-041
**AREA:** UX
**PROBLEMA:** Profile.jsx mostra email finta `{firstName}@dovevai.it` invece dell'email reale dell'utente.
**IMPATTO:** Informazione errata nel profilo.
**SOLUZIONE:** Usare `user.email` da AuthContext.
**FILE:** `src/pages/Profile.jsx`
**EFFORT:** 0.5 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-042
**AREA:** UX / Routing
**PROBLEMA:** Nessuna route catch-all (`*`). URL invalidi mostrano pagina bianca. `TodayTours.jsx` e' un file orfano non raggiungibile.
**IMPATTO:** Dead-end per URL invalidi.
**SOLUZIONE:** Aggiungere route `*` con pagina 404. Eliminare `TodayTours.jsx`.
**FILE:** `src/App.jsx`, `src/pages/TodayTours.jsx`
**EFFORT:** 1 ora
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-043
**AREA:** Performance
**PROBLEMA:** `index` usato come `key` in liste renderizzate in 12+ punti (DashboardBusiness, TourDetails, AiItinerary, Landing).
**IMPATTO:** Re-rendering inefficiente quando elementi cambiano posizione.
**SOLUZIONE:** Sostituire con ID stabili: `key={item.id}`.
**FILE:** `src/pages/DashboardBusiness.jsx`, `src/pages/TourDetails.jsx`, `src/pages/AiItinerary.jsx`, `src/pages/Landing.jsx`
**EFFORT:** 2 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-044
**AREA:** AI
**PROBLEMA:** Nessuno streaming nelle chiamate OpenAI. L'utente attende fino a 35 secondi senza feedback progressivo.
**IMPATTO:** UX pessima per generazioni lunghe.
**SOLUZIONE:** Implementare streaming via SSE nel proxy Edge Function. Mostrare il testo progressivamente nell'UI.
**FILE:** `src/services/aiRecommendationService.js`, Edge Function (da DVAI-001)
**EFFORT:** 6 ore
**DIPENDENZE:** DVAI-001
---

---
**TASK ID:** DVAI-045
**AREA:** AI
**PROBLEMA:** User preference graph (`useAILearning`) raccoglie preferenze ma non le inietta mai nel prompt AI. Feature "apprendimento" puramente cosmetica.
**IMPATTO:** Nessuna personalizzazione reale. Feature marketing ingannevole.
**SOLUZIONE:** Iniettare le ultime 5 preferenze dal DNA nel prompt AI come contesto aggiuntivo. Persistere server-side in Supabase.
**FILE:** `src/hooks/useAILearning.js`, `src/services/aiRecommendationService.js`
**EFFORT:** 4 ore
**DIPENDENZE:** DVAI-001
---

---
**TASK ID:** DVAI-046
**AREA:** AI
**PROBLEMA:** Naming fuorviante: `GeminiDrawer.jsx` e `GeminiAskButton.jsx` usano OpenAI, non Google Gemini.
**IMPATTO:** Confusione nel codebase per sviluppatori.
**SOLUZIONE:** Rinominare in `AIDrawer.jsx` / `AIAskButton.jsx`.
**FILE:** `src/components/Map/GeminiDrawer.jsx`, `src/components/Map/GeminiAskButton.jsx`
**EFFORT:** 0.5 ore
**DIPENDENZE:** Nessuna
---

---
**TASK ID:** DVAI-047
**AREA:** Database / Storage
**PROBLEMA:** Nessuna policy di storage definita nei file SQL. Bucket creati a runtime dal client. Nessuna validazione file type/size server-side.
**IMPATTO:** Upload non controllati, potenziale abuso storage.
**SOLUZIONE:** Definire bucket policies nei file SQL di migrazione. Aggiungere validazione size/type.
**FILE:** Nuova migrazione SQL, `src/components/ImageUploader.jsx`
**EFFORT:** 3 ore
**DIPENDENZE:** Nessuna
---

---

## METRICHE TOTALI

- **Task totali:** 47
- **Effort stimato totale:** ~155 ore (~19 giorni lavorativi a 8h)
- **Effort critico (go-live, DVAI-001 a DVAI-010):** ~45 ore (~6 giorni lavorativi)
- **Componenti completi:** 8/22 pagine funzionano correttamente con dati reali
- **Componenti parziali:** 9/22 pagine funzionano ma con lacune (mock mescolati, feature incomplete)
- **Componenti rotti:** 3/22 (analyzeBusinessDescription crash, refreshRole undefined, /notification-settings 404)
- **Componenti assenti:** 5 (Stripe, Admin Panel, Onboarding, Calendario Guida, 404 Page)

---

## RACCOMANDAZIONE STRATEGICA

### Fase 1 -- Sicurezza e Fondamenta (Settimana 1-2)

La priorita' assoluta e' la sicurezza. La API key OpenAI esposta nel bundle client deve essere risolta PRIMA di qualsiasi deploy pubblico: revocare la chiave attuale, creare un proxy Edge Function in Supabase, e spostare tutte le chiamate AI server-side. Contemporaneamente, configurare le restrizioni Google Maps nella Cloud Console, ripulire i file di test dalla root, fixare il `dangerouslySetInnerHTML` con DOMPurify, e risolvere i bug bloccanti (refreshRole, booking silent success, notifications spoofing). Questo blocco di lavoro richiede circa 20 ore e rende il progetto sicuro per un deploy limitato.

### Fase 2 -- MVP Monetizzabile (Settimana 2-4)

Con la sicurezza risolta, il focus deve spostarsi sulla monetizzazione. Integrare Stripe Checkout tramite Edge Function per completare il flusso prenotazione guida (attualmente interrotto con `alert()`). Parallelamente, implementare l'onboarding post-registrazione, separare chiaramente tour mock da tour reali, e implementare il salvataggio reale di BecomeGuide. Per un MVP veloce, si consiglia di TAGLIARE le pagine Photos e Trending (spostarle come "Coming Soon") piuttosto che investire ore per implementarle con dati reali. Eliminare Home.jsx (duplicato di DashboardUser). Questo blocco richiede circa 40 ore.

### Fase 3 -- Qualita' e Scalabilita' (Settimana 4-6)

Una volta che il prodotto genera revenue, investire in performance (lazy loading Google Maps, clustering marker, lazy images), qualita' AI (migrare a gpt-4o-mini, implementare streaming, verifica POI reali), e pulizia del codebase (eliminare codice morto, standardizzare query su React Query, implementare toast reale). Valutare seriamente la migrazione dello state management a Zustand se il progetto cresce oltre le 30+ pagine: i selettori granulari e la persistenza integrata risolverebbero molti dei problemi attuali (re-render cascata, localStorage frammentato). Il pannello admin puo' essere posticipato usando il Dashboard Supabase come workaround temporaneo per moderazione e gestione utenti.
