# AUDIT SICUREZZA & PERFORMANCE - DoveVAI

**Data:** 2026-04-10
**Progetto:** DoveVAI (unnivai-ricresa)
**Stack:** React 19 + Vite 7 + Supabase + Google Maps + OpenAI + Tailwind CSS

---

## ROSSO CRITICO (fix immediato)

| # | Problema | File | Rischio | Fix |
|---|---------|------|---------|-----|
| C1 | **OpenAI API Key esposta lato client** | `.env` (VITE_OPENAI_API_KEY=sk-proj-...) | CRITICO: La chiave OpenAI e' nel bundle JS del browser. Chiunque puo' aprire DevTools, leggere la key e usarla a tuo carico (fatture illimitate). | Spostare TUTTE le chiamate OpenAI in una Supabase Edge Function o API route serverless. Il client chiama `/api/ai-itinerary`, il server chiama OpenAI con la key nel backend. Rimuovere `VITE_OPENAI_API_KEY` dal .env. |
| C2 | **Google Maps API Key senza restrizioni verificabili** | `.env` (VITE_GOOGLE_MAPS_API_KEY=AIzaSy...) | ALTO: La key Google Maps e' nel bundle JS (necessario per il client SDK), ma senza conferma di restrizioni HTTP Referrer nella Google Cloud Console, chiunque puo' usarla. | Nella Google Cloud Console: (1) Restringere la key a `*.tuodominio.com/*`, (2) Limitare le API abilitate solo a Maps JS API + Places API, (3) Impostare un budget cap giornaliero. |
| C3 | **Anon Key Supabase hardcoded in 8+ file di test** | `verify_userid.js`, `test_tours.mjs`, `test_db_write.js`, `test_rls.js`, `test_schema.mjs`, `verify_setup.js`, `verify_userid_final.js`, `test_roles.mjs`, `test_roles2.mjs`, `test_explicit_fk.mjs` | MEDIO-ALTO: Anche se e' la anon key (non service_role), il pattern di hardcoding e' pericoloso. Se qualcuno copia il pattern con una service_role key, sarebbe catastrofico. I file di test NON sono in .gitignore. | (1) Eliminare o spostare tutti i file test_*.mjs/js dalla root in una cartella `tests/` gitignored oppure farli leggere da .env. (2) Usare `dotenv` per caricare le variabili nei test. (3) Verificare con `git log` che la service_role key non sia MAI stata committata. |
| C4 | **dangerouslySetInnerHTML con dati da Google Directions API** | `src/pages/MapPage.jsx:1057` | ALTO: Le istruzioni di navigazione da Google Directions vengono iniettate come HTML raw. Se un attaccante riesce a manipolare la risposta (MITM, proxy) puo' iniettare script (XSS). | Usare un parser HTML sicuro come `DOMPurify` per sanitizzare l'HTML prima del rendering: `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(routeStats.steps[0].instructions) }}` oppure estrarre solo il testo con un regex che rimuova i tag HTML. |
| C5 | **Booking "silent success" nasconde errori critici** | `src/services/dataService.js:262-277` | ALTO: `createBooking()` ritorna SEMPRE `{ success: true }` anche quando il DB fallisce. L'utente crede di aver prenotato, la guida non riceve nulla. | Ritornare `{ success: false, error: error.message }` quando Supabase fallisce e mostrare un toast di errore nell'UI. |

---

## GIALLO IMPORTANTE (pre-lancio)

| # | Problema | File | Impatto | Fix |
|---|---------|------|---------|-----|
| I1 | **Nessuna validazione password in fase di registrazione** | `src/pages/Login.jsx` | L'unica validazione e' `required` e `type="password"` nell'HTML. Supabase di default richiede 6+ caratteri ma non forza complessita'. Utenti possono registrarsi con "123456". | Aggiungere validazione client-side: minimo 8 caratteri, almeno 1 lettera e 1 numero. Mostrare indicatore di forza password. |
| I2 | **Nessuna validazione input nei form** | `src/pages/Login.jsx`, `src/pages/BecomeGuide.jsx`, `src/pages/guide/TourBuilder.jsx` | I form si affidano solo a `required` HTML. Nessuna validazione Zod lato client per email formato, lunghezza nomi, numeri di telefono validi nel form BecomeGuide. | Usare Zod (gia' in dipendenze) per validare i form prima del submit. Creare schemi per RegistrationInput, BecomeGuideInput, TourInput. |
| I3 | **Role spoofing via localStorage** | `src/context/AuthContext.jsx:59` | Il ruolo utente ha fallback su `localStorage.getItem('unnivai_role')`. Un utente malintenzionato puo' modificare il localStorage e accedere a dashboard non sue (guide/business). | La role deve essere verificata SOLO da `user.user_metadata.role` (server-side via Supabase). Rimuovere il fallback localStorage o usarlo solo come cache read-only che viene sovrascritta al primo login reale. Le RLS Supabase proteggono i dati, ma l'UI espone funzionalita' non autorizzate. |
| I4 | **businesses_profile: RLS presente ma policy troppo permissiva** | `api/migration_backend_v2.sql:91-115` | La policy "Public can view businesses" permette SELECT a tutti (corretto per la mappa). Ma manca una verifica se DELETE e' protetto (nessuna policy DELETE trovata = default deny, OK). Tuttavia la INSERT/UPDATE non verifica il ruolo 'business'. | Aggiungere check `auth.jwt() ->> 'role' = 'business'` nelle policy INSERT/UPDATE di businesses_profile per impedire che un utente explorer crei un profilo business. |
| I5 | **Nessuna gestione session expiry/refresh** | `src/context/AuthContext.jsx` | Il listener `onAuthStateChange` gestisce il cambio di sessione, ma non c'e' handling esplicito per token scaduti. Se il JWT scade durante una sessione attiva, le chiamate Supabase falliranno silenziosamente. | Supabase JS v2 gestisce il refresh automaticamente, ma aggiungere un handler per l'evento `TOKEN_REFRESHED` e `SIGNED_OUT` per forzare re-render e redirect al login se il refresh fallisce. |
| I6 | **Form BecomeGuide non salva su Supabase** | `src/pages/BecomeGuide.jsx:35-44` | Il submit del form simula un API call con `setTimeout` ma non salva nulla. I dati vanno persi. | Implementare il salvataggio su una tabella `guide_applications` o `guide_requests` in Supabase. |
| I7 | **File di test/debug nella root del progetto** | Root: `test_*.mjs`, `verify_*.js`, `check_mario.mjs`, `test-db.js`, `test-rls.js`, etc. | 12+ file di test con credenziali sparse nella root. Se deployati (Vercel serve tutto in `public/`), potrebbero esporre logica interna. | Spostare in `tests/` directory, aggiungere a `.gitignore`, oppure eliminarli se non piu' necessari. |
| I8 | **Explore e TourDetails: route pubbliche con dati sensibili** | `src/App.jsx:94-96` | `/explore` e `/tour-details/:id` sono pubblici (nessun RoleGuard). OK per SEO, ma le query Supabase lato server espongono tutti i dati dei tour inclusi guide_id. | Verificare che le RLS Supabase limitino i dati sensibili. Le SELECT policy su tours sono `using(true)` = pubbliche. OK se intenzionale, ma valutare se nascondere campi come `guide_id` per utenti non autenticati. |

---

## VERDE OTTIMIZZAZIONI (post-lancio)

| # | Problema | File | Beneficio | Fix |
|---|---------|------|-----------|-----|
| O1 | **framer-motion importato in 39 file** | Quasi tutti i componenti | framer-motion pesa circa 30-40KB gzipped. E' gia' tree-shakable, ma l'uso pervasivo in ogni componente aumenta il bundle. | Valutare CSS animations per micro-interazioni semplici (fade, slide) e riservare framer-motion per animazioni complesse (page transitions, gestures). |
| O2 | **openai package in package.json ma non usato** | `package.json:24` | Il pacchetto `openai` (SDK ufficiale) e' nelle dipendenze ma il codice usa `fetch` diretto verso `api.openai.com`. Bundle inutile di circa 50KB. | Rimuovere `"openai": "^6.22.0"` da package.json e fare `npm prune`. |
| O3 | **Nessun lazy loading sulle immagini** | `src/pages/Landing.jsx`, `src/pages/MapPage.jsx`, `src/pages/TourDetails.jsx`, `src/components/Map/*.jsx` | Tutte le `<img>` mancano di `loading="lazy"`. Su pagine con molte immagini (tour cards, gallery), il browser scarica tutto immediatamente. | Aggiungere `loading="lazy"` a tutte le `<img>` che non sono above-the-fold. Considerare un componente `<LazyImage>` wrapper. |
| O4 | **Index come key in liste renderizzate** | `src/pages/DashboardBusiness.jsx` (12+ istanze), `src/pages/TourDetails.jsx`, `src/pages/AiItinerary.jsx`, `src/pages/Landing.jsx`, `src/components/NotificationBell.jsx` | Usare `key={i}` o `key={index}` causa ri-rendering inefficiente quando gli elementi cambiano posizione o vengono filtrati. | Sostituire con ID stabili: `key={item.id}` o `key={item.uniqueField}`. Per liste statiche (stelle rating, etc.) `key={i}` e' accettabile. |
| O5 | **Mappa Google caricata globalmente (non lazy)** | `src/App.jsx:83` | `<APIProvider>` wrappa TUTTA l'app, caricando il Google Maps JS SDK (circa 200KB) anche su pagine che non usano la mappa (Login, Profile, Notifications, etc.). | Spostare `<APIProvider>` solo nei componenti che usano la mappa: MapPage, TourBuilder, Explore. Oppure lazy-loadare il provider con un wrapper. |
| O6 | **Nessun marker clustering sulla mappa** | `src/components/UnnivaiMap.jsx` | Tutti i marker vengono renderizzati individualmente. Con 50+ POI per citta', la mappa diventa lenta e illeggibile. | Implementare `@googlemaps/markerclusterer` o `@vis.gl/react-google-maps` ClusteredMarkers per raggruppare i marker a zoom bassi. |
| O7 | **Componenti pesanti senza React.memo** | `src/pages/MapPage.jsx`, `src/pages/DashboardUser.jsx`, `src/pages/DashboardBusiness.jsx` | Solo `MapMarker` usa `React.memo`. Componenti come MapPage (1200+ righe), DashboardUser, DashboardBusiness ri-renderizzano completamente ad ogni cambio di stato. | Wrappare sotto-componenti pesanti con `React.memo()`. Usare `useMemo` per calcoli derivati (gia' presente in MapPage, mancante altrove). |
| O8 | **Chiamate Supabase duplicate** | `src/pages/Profile.jsx`, `src/pages/MapPage.jsx` | Profile.jsx fa query dirette a Supabase senza React Query. MapPage ha query con React Query ma anche query dirette miste. Nessun dedup automatico. | Standardizzare TUTTE le query Supabase tramite React Query hooks dedicati (gia' presente per tours). Creare `useProfile()`, `useBusinesses()`, etc. |
| O9 | **canvas-confetti in dipendenze** | `package.json:20` | Libreria per effetti confetti. Se usata solo in un componente, puo' essere lazy-imported. | Verificare dove e' usata e fare dynamic import: `const confetti = (await import('canvas-confetti')).default`. |
| O10 | **Console.log/warn abbondanti in produzione** | `src/services/dataService.js`, `src/services/aiRecommendationService.js` | Decine di `console.log`, `console.warn`, `console.error` con emoji e messaggi di debug. In produzione rallentano e espongono logica interna. | Creare un logger utility che disabilita i log in produzione: `const log = import.meta.env.DEV ? console.log : () => {}`. |
| O11 | **Nessun formato immagine ottimizzato** | Immagini esterne (Unsplash, randomuser.me) | Le immagini usano URL Unsplash senza parametri di dimensione/qualita' ottimali. | Aggiungere parametri URL Unsplash: `?w=400&q=80&fm=webp` per card, `?w=800&q=85&fm=webp` per hero. |

---

## Dettaglio Analisi RLS Supabase

| Tabella | RLS Attiva | SELECT | INSERT | UPDATE | DELETE | Note |
|---------|-----------|--------|--------|--------|--------|------|
| `profiles` | SI | Tutti | Solo owner (auth.uid()=id) | Solo owner | NESSUNA POLICY (default deny) | OK |
| `tours` | SI | Tutti | NESSUNA POLICY (default deny) | Solo guide (guide_id=auth.uid()) | NESSUNA POLICY (default deny) | ATTENZIONE: le guide non possono INSERT tour via RLS. Verificare se usano un trigger o service_role. |
| `bookings` | SI | Owner + Guide del tour | Solo owner (user_id) | Solo guide del tour | NESSUNA POLICY (default deny) | OK |
| `activities` | SI | Tutti | Solo owner (owner_id) | Solo owner | NESSUNA POLICY (default deny) | OK |
| `notifications` | SI | Solo owner (user_id) | Tutti gli autenticati | Solo owner | Solo owner | OK |
| `favorites` | SI | Solo owner | Solo owner | NESSUNA | Solo owner | OK |
| `guide_requests` | SI | Guide (propri + open) | Utenti autenticati | Solo guide assegnate | NESSUNA | OK |
| `guides_profile` | SI | Tutti | Solo guide (user_id) | Solo guide (user_id) | NESSUNA | OK |
| `explorers` | SI | Solo owner | Solo owner | Solo owner | NESSUNA | OK |
| `user_photos` | SI | Solo owner | Solo owner | NESSUNA | Solo owner | OK |
| `businesses_profile` | SI | Tutti | Solo owner | Solo owner | NESSUNA | Manca check ruolo 'business' |

---

## Dettaglio API Key

| Key | Dove | Esposta Client? | Rischio |
|-----|------|-----------------|---------|
| Supabase Anon Key | `.env` (corretto) + 8 file test (hardcoded) | SI (necessario, anon key e' safe con RLS) | BASSO se RLS e' corretto |
| Supabase Service Role | Non trovata nel codebase | NO | OK |
| Google Maps API Key | `.env` (corretto), usata via `import.meta.env` | SI (necessario per client SDK) | MEDIO senza restrizioni |
| OpenAI API Key | `.env` (corretto), usata via `import.meta.env` | SI nel bundle JS | CRITICO - costo illimitato |
| Mapbox Token | `.env` (corretto), usata via `import.meta.env` | SI nel bundle JS | MEDIO - configurare restrizioni |

---

## Metriche Stimate

| Metrica | Valore Stimato | Target Consigliato |
|---------|---------------|-------------------|
| **Bundle JS (gzipped)** | circa 250-350KB (React 19 + framer-motion + Google Maps SDK + Supabase + React Query + Zod + lucide-react) | < 200KB con lazy loading aggressivo |
| **Bundle CSS** | circa 15-20KB (Tailwind purged) | OK |
| **First Contentful Paint** | circa 2.5-3.5s (Google Maps SDK blocker) | < 1.8s spostando Maps a lazy |
| **Time to Interactive** | circa 4-6s (dipende da OpenAI + Supabase round-trip) | < 3s |
| **Largest Contentful Paint** | circa 3-5s (immagini Unsplash senza lazy loading) | < 2.5s |
| **Chiamate API al caricamento dashboard** | 3-5 (Supabase auth + tours + notifications + activities) | OK con React Query cache |
| **Marker contemporanei mappa** | Potenzialmente 50-100+ senza clustering | Max 20 visibili con clustering |
| **Pacchetto `openai` inutilizzato** | circa 50KB nel bundle | 0KB (rimuovere) |

---

## Piano d'Azione Prioritizzato

### Settimana 1 (Sicurezza Critica)
1. **[C1]** Creare Edge Function Supabase per proxy OpenAI
2. **[C2]** Configurare restrizioni Google Maps API Key
3. **[C3]** Ripulire file test dalla root, rimuovere chiavi hardcoded
4. **[C4]** Installare DOMPurify e sanitizzare dangerouslySetInnerHTML
5. **[C5]** Implementare error handling reale in createBooking

### Settimana 2 (Pre-Lancio)
6. **[I1-I2]** Aggiungere validazione Zod a tutti i form
7. **[I3]** Rimuovere fallback localStorage per il ruolo
8. **[I5]** Gestire session expiry
9. **[I6]** Implementare salvataggio BecomeGuide
10. **[I7]** Pulizia file di test

### Settimana 3-4 (Performance)
11. **[O2]** Rimuovere pacchetto `openai` inutilizzato
12. **[O3]** Aggiungere lazy loading immagini
13. **[O5]** Lazy-loadare Google Maps APIProvider
14. **[O6]** Implementare marker clustering
15. **[O10]** Disabilitare console.log in produzione

---

*Audit generato automaticamente. Verificare manualmente le configurazioni Google Cloud Console e Supabase Dashboard per confermare restrizioni API key e policy RLS effettive.*
