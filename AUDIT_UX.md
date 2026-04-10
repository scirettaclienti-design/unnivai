# AUDIT UX CHIRURGICO - DoveVAI

**Data audit:** 2026-04-10
**Versione analizzata:** Frontend SPA React (src/)
**Metodologia:** Lettura file-per-file di ogni pagina e componente

---

## 1. MAPPA PAGINE

| Pagina | Route | Stato | Mobile | Brand aligned |
|--------|-------|-------|--------|---------------|
| Landing | `/` (guest) | Funzionante - Rich animated page | OK (responsive grid) | SI - dark theme premium |
| Login/Signup | `/login` | Funzionante - 3 ruoli + auth form | OK (max-w-md) | SI - gradient coerente |
| Update Password | `/update-password` | Funzionante - form minimo | OK | PARZIALE - bg-gray-50 diverso dal resto |
| Dashboard User | `/dashboard-user` | Funzionante - hub principale explorer | OK (max-w-md) | SI |
| Home | `/home` | Funzionante - ma DUPLICA dashboard-user | OK | SI |
| Explore | `/explore` | Funzionante - mappa + lista tour | OK | SI |
| Tour Details | `/tour-details/:id` | Funzionante - dettaglio con booking | OK | SI |
| AI Itinerary | `/ai-itinerary` | Funzionante - wizard 3 step | OK | SI |
| Map Page | `/map` | Funzionante - mappa full screen + POI | OK | SI |
| Quick Path | `/quick-path` | Funzionante - quiz multi-step | OK | SI |
| Surprise Tour | `/surprise-tour` | Funzionante - cards statiche | OK | SI |
| Tour Live | `/tour-live` | PARZIALE - mix DB + mock hardcoded | OK | SI |
| Trending | `/trending` | MOCK ONLY - dati hardcoded Roma | OK | SI |
| Photos | `/photos` | MOCK ONLY - feed social statico | OK | SI |
| Notifications | `/notifications` | Funzionante - realtime Supabase | OK | SI |
| Profile | `/profile` | Funzionante - dati reali + mock | OK | SI |
| Become Guide | `/become-guide` | SIMULATO - submit finto (setTimeout) | OK | SI |
| Dashboard Guide | `/dashboard-guide` | Funzionante - tours + requests realtime | OK | SI |
| Tour Builder | `/guide/create-tour` | Funzionante - wizard con mappa | OK | SI |
| Dashboard Business | `/dashboard-business` | Funzionante - profilo + AI analysis | OK | SI |
| Guide Placeholder | `/chat/guide/:id`, `/profile/guide/:id` | PLACEHOLDER - "Coming Soon" | OK | PARZIALE |
| Today Tours | (non in router) | ORFANA - non raggiungibile da nessuna route | N/A | N/A |

---

## 2. PULSANTI E CTA

| Pagina | Elemento | Azione prevista | Azione reale | Stato |
|--------|----------|-----------------|--------------|-------|
| Landing | "Inizia Ora" CTA | Porta a signup | Link a `/login` | OK |
| Landing | "Accedi" nav link | Porta a login | Link a `/login` | OK |
| Login | "Scegli questo ruolo" (x3) | Seleziona ruolo e mostra form | Setta state `selectedRole` | OK |
| Login | "Accedi ->" (footer) | Shortcut login per utenti esistenti | Setta role=tourist + authMode=login | OK |
| Login | "Registrati Gratuitamente" | Crea account Supabase | Chiama `supabase.auth.signUp` | OK |
| Login | "Password dimenticata?" | Reset password | Mostra form reset | OK |
| Login | "Cambia ruolo" | Torna a selezione ruolo | Resetta selectedRole | OK |
| Dashboard User | "Crea il tuo Tour" expand | Mostra opzioni | Toggle showCustomOptions | OK |
| Dashboard User | "Con Guida" | Apre modal richiesta guida | `handleGuideRequest()` | OK |
| Dashboard User | "Sorprendimi" | Naviga a surprise tour | Link a `/surprise-tour` | OK |
| Dashboard User | "AI Itinerary" | Naviga a AI wizard | Link a `/ai-itinerary` | OK |
| Dashboard User | "Quiz Veloce" | Naviga a quick path | Link a `/quick-path` | OK |
| Dashboard User | Card esperienza | Naviga a dettaglio tour | Link a `/tour-details/:id` con state | OK |
| Home | "Guide Locali" | Naviga a tour live | Link a `/tour-live` | OK |
| Home | "Crea il tuo Percorso" | Naviga a AI itinerary | Link a `/ai-itinerary` | OK |
| Home | "Ispirami Ora" chevron | Espande opzioni rapide | Toggle showQuickOptions | OK |
| Home | "Quiz Veloce" | Naviga a QuickPath | `navigate('/quick-path')` | OK |
| Home | "Sorprendimi" | Naviga a SurpriseTour | `navigate('/surprise-tour')` | OK |
| Home | Card esperienza | Naviga a tour details | Link a `/tour-details/:id` | OK |
| Explore | "Apri a schermo intero" | Apre mappa full | Link a `/map` | OK |
| Explore | Mappa preview click | Apre mappa full | `navigate('/map')` con center | OK |
| Explore | Card "Vedi Dettagli" | Naviga a tour details | Link a `/tour-details/:id` | OK |
| Explore | "Resetta filtri" | Resetta search/filtri | Setta state a default | OK |
| Tour Details | "Contatta Guida" | Apre modal richiesta | Setta `showRequestModal=true` | OK - MA fallisce silenziosamente per tour mock senza UUID guida |
| Tour Details | "Invia Richiesta" (modal) | Invia richiesta a guida | `createGuideRequest()` | OK per tour reali, ERRORE per mock (guideId invalido) |
| Tour Details | "Prenota Ora" | Apre booking modal | Setta `showBookingModal=true` | OK |
| Tour Details | Profilo guida click | Apre modal profilo | Setta `showGuideProfile=true` | OK |
| Tour Details | Chat icon | Apre chat guida | Setta `showChat=true` | MOCK - chat non invia realmente messaggi |
| Tour Details | "Apri in Maps" | Apre navigazione esterna | `window.open(google maps url)` | OK |
| AI Itinerary | "Crea il Mio Viaggio" | Genera itinerario AI | `generateItinerary()` | OK - con fallback locale se API fallisce |
| AI Itinerary | "Rigenera Giorno" | Rigenera giorno specifico | `regenerateDay()` | FINTO - non cambia realmente i dati |
| Quick Path | Step buttons | Avanzano nel quiz | `setCurrentStep(...)` | OK |
| Quick Path | "Genera Percorso" | Genera tour basato su risposte | Naviga a risultato | OK |
| Surprise Tour | Card "Prenota" | Dovrebbe prenotare | `navigate('/tour-details/...')` con dati mock | PARZIALE - naviga ma dati sono mock |
| Notifications | Pulsante azione | Apre dettaglio notifica | `handleNotificationClick()` | OK |
| Notifications | "INVIA RISPOSTA" | Invia reply a guida | Insert in `notifications` table | OK |
| Notifications | "ACCETTA E PAGA" | Accetta offerta guida | Update guide_request + `alert()` placeholder | INCOMPLETO - nessun pagamento reale |
| Notifications | "Segna lette" | Marca tutte lette | `markAllAsRead()` | OK |
| Notifications | Icona Settings | Naviga a settings notifiche | Link a `/notification-settings` | ROTTO - route non esiste |
| Notifications | Trash icon | Elimina notifica | `deleteNotification()` | OK |
| Profile | "Home" back button | Torna a dashboard | Link a `/dashboard-user` | OK |
| Profile | Share social buttons | Condivide su social | `window.open()` con URL social | OK (ma URL condiviso e' la pagina profilo, non il tour) |
| Photos | Like/Share/Comment | Interagisce con foto | Aggiorna state locale | MOCK - nessun salvataggio persistente |
| Photos | "Upload" button | Carica foto | Apre modal | MOCK - non carica realmente |
| Trending | Card click | Naviga a dettaglio | Link a `/tour-details/:id` | PARZIALE - ID "trend1" ecc. non matchano tour reali |
| Become Guide | "Invia Candidatura" | Invia richiesta guida | `setTimeout` simulato | FINTO - non salva nulla su DB |
| Dashboard Guide | "Crea Tour" | Naviga a TourBuilder | Link a `/guide/create-tour` | OK |
| Dashboard Guide | "Accetta" richiesta | Accetta richiesta utente | Update su guide_requests + notifica | OK |
| Dashboard Guide | "Rifiuta" richiesta | Rifiuta richiesta | Update + persist locale | OK |
| Dashboard Guide | "Messaggio" | Apre chat con utente | Mostra modal con history | OK |
| Dashboard Guide | "Proponi Prezzo" | Apre modal prezzo | Invia notifica con offerta | OK |
| Dashboard Guide | "Modifica" tour | Apre TourBuilder in edit | Navigate con state tourToEdit | OK |
| Dashboard Guide | "Elimina" tour | Elimina tour da DB | `supabase.delete()` con confirm | OK |
| Dashboard Guide | "Logout" | Logout | `signOut()` | OK |
| Dashboard Business | "Salva Profilo" | Salva dati business | Upsert su `businesses_profile` | OK |
| Dashboard Business | "Analizza con AI" | Analisi AI del profilo | `aiRecommendationService.analyzeBusinessDescription()` | OK |
| Dashboard Business | "Aggiorna Posizione GPS" | Acquisisce GPS | `navigator.geolocation` | OK |
| Dashboard Business | "Logout" | Logout | `signOut()` | OK |
| Tour Builder | "Avanti" step wizard | Avanza nello step | `setStep(step+1)` | OK |
| Tour Builder | "Pubblica Tour" | Salva tour su DB | Insert/Update su `tours` | OK |
| TopBar | Logo/Nome click | Naviga a profilo | Link a `/profile` | OK |
| TopBar | Edit city icon | Apre modal cambio citta | `setIsCityModalOpen(true)` | OK |
| TopBar | Notification bell | Naviga a notifiche | Link a `/notifications` | OK |
| TopBar | Logout icon | Logout | `signOut()` | OK |
| BottomNavigation | Home | Naviga a dashboard user | Link a `/dashboard-user` | OK |
| BottomNavigation | Esplora | Naviga a explore | Link a `/explore` | OK |
| BottomNavigation | Foto | Naviga a photos | Link a `/photos` | OK |
| BottomNavigation | Profilo | Naviga a profile | Link a `/profile` | OK |

---

## 3. FLUSSI UTENTE

### FLUSSO A -- Nuovo utente: Landing -> Signup -> Onboarding -> Primo tour

```
Landing (/)
  |-- CTA "Inizia Ora" / "Accedi"
  v
Login (/login) - Selezione Ruolo                          OK
  |-- Click su card ruolo (Tourist/Guide/Business)
  v
Login (/login) - Form Signup                               OK
  |-- Compila Nome, Email, Password
  |-- Click "Registrati Gratuitamente"
  v
Email Conferma (Supabase)                                  OK
  |-- Utente riceve email, clicca link
  v
Login (/login) - Redirect a emailRedirectTo=/login         OK
  |-- Utente fa login con credenziali
  v
RootDispatcher (/) -> redirect per ruolo                   OK
  |-- explorer -> /dashboard-user
  v
Dashboard User                                             OK
  |-- Vede esperienze AI, opzioni tour
  v
[MANCA] ONBOARDING DEDICATO                               MANCANTE
  |-- Non esiste wizard preferenze iniziali
  |-- Non si chiede citta preferita al primo accesso
  |-- Non si mostra tutorial app
```

**Verdetto Flusso A:**
- Landing -> Signup -> Login: OK
- Onboarding post-registrazione: MANCANTE
- Primo tour: l'utente deve capire da solo cosa fare

### FLUSSO B -- Tour AI: Home -> Ricerca -> Generazione AI -> Visualizza -> Naviga -> Completa

```
Dashboard User (/dashboard-user)                           OK
  |-- Click su "AI Itinerary" o link "Crea il tuo Percorso"
  v
AI Itinerary (/ai-itinerary) - Step 1: Preferenze         OK
  |-- Utente compila textarea + seleziona filtri
  |-- Click "Crea il Mio Viaggio"
  v
AI Itinerary - Step 2: Loading (2s delay + API call)       OK
  |-- Spinner + animazione
  v
AI Itinerary - Step 3: Risultato Itinerario               OK
  |-- Mostra giorni con tappe
  |-- Click "Rigenera Giorno"                              FINTO (non rigenera davvero)
  |-- Click su tappa per dettagli                          OK
  v
[MANCA] Navigazione su mappa dell'itinerario              INCOMPLETO
  |-- Non c'e' un pulsante "Avvia navigazione" o "Vedi su mappa"
  |-- Le coordinate sono generate ma non collegate alla MapPage
  v
[MANCA] Completamento tour / tracking                      MANCANTE
  |-- Non esiste tracking progress delle tappe
  |-- Non esiste salvataggio itinerario completato
  |-- Non esiste meccanismo di "Completato"
```

**Verdetto Flusso B:**
- Generazione AI: OK (con fallback robusto)
- Visualizzazione: OK
- Navigazione live: MANCANTE
- Completamento: MANCANTE

### FLUSSO C -- Prenotazione guida: Cerca -> Profilo -> Seleziona data -> Paga -> Conferma

```
Explore (/explore) o Tour Live (/tour-live)                OK
  |-- Utente vede lista tour
  v
Tour Details (/tour-details/:id)                           OK
  |-- Vede dettagli, guida, itinerario
  |-- Click "Contatta Guida"
  v
Request Modal (in TourDetails)                             PARZIALE
  |-- Compila data, persone, messaggio
  |-- Click "Invia Richiesta"
  |-- SE tour mock (id numerico) -> ERRORE guideId invalido
  |-- SE tour reale (UUID) -> OK, inserisce in guide_requests
  v
Guida riceve in Dashboard Guide                            OK
  |-- Guida vede richiesta in "Richieste Live"
  |-- Guida clicca "Accetta" / "Messaggio" / "Proponi Prezzo"
  v
Utente riceve notifica                                     OK
  |-- In /notifications vede messaggio/offerta guida
  v
Utente risponde / accetta offerta                          PARZIALE
  |-- "INVIA RISPOSTA" funziona
  |-- "ACCETTA E PAGA" -> alert() placeholder              PAGAMENTO MANCANTE
  v
[MANCA] PAGAMENTO STRIPE                                  MANCANTE
  |-- Nessuna integrazione Stripe
  |-- Flow si interrompe con alert()
  v
[MANCA] CONFERMA PRENOTAZIONE                             MANCANTE
  |-- Non esiste schermata conferma
  |-- Non esiste email conferma
  |-- Non esiste stato "confermato" nel booking
```

**Verdetto Flusso C:**
- Ricerca -> Richiesta: OK (per tour reali)
- Comunicazione guida-utente: OK (via notifiche)
- Pagamento: MANCANTE
- Conferma: MANCANTE

### FLUSSO D -- Guida: Login -> Dashboard -> Crea tour -> Gestisci prenotazioni

```
Login (/login) - seleziona "Sono una Guida"                OK
  |-- Signup con ruolo guide
  v
RootDispatcher -> /dashboard-guide                         OK
  v
Dashboard Guide - prima visita                             PARZIALE
  |-- SE guides_profile non esiste -> auto-creazione       OK
  |-- Form accreditamento (license, P.IVA, bio)            OK
  |-- MA nessun onboarding guidato                         MANCANTE
  v
Dashboard Guide - tab "I Miei Tour"                        OK
  |-- Lista tour vuota se nuovo
  |-- Click "Crea Tour"
  v
Tour Builder (/guide/create-tour)                          OK
  |-- Step 1: Info base (titolo, desc, citta, prezzo...)   OK
  |-- Step 2: Mappa + tappe                                OK
  |-- Step 3: Review + Pubblica                            OK
  |-- Tour inserito in DB e appare in lista                OK
  v
Dashboard Guide - tab "Richieste Live"                     OK
  |-- Richieste realtime via subscription                  OK
  |-- Accetta / Rifiuta / Messaggio / Prezzo               OK
  v
[MANCA] Gestione prenotazioni confermate                   MANCANTE
  |-- Non c'e' lista di prenotazioni confermate
  |-- Non c'e' calendario guida
  |-- Non c'e' storico guadagni
```

**Verdetto Flusso D:**
- Registrazione e accreditamento: OK
- Creazione tour: OK
- Gestione richieste live: OK
- Gestione post-prenotazione: MANCANTE

### FLUSSO E -- Admin: Login -> Dashboard -> Azioni

```
[NON ESISTE] Dashboard Admin                               MANCANTE
  |-- Nessuna route admin
  |-- Nessun ruolo admin nel sistema
  |-- Nessun pannello moderazione
  |-- Nessun tool di gestione utenti/tour/business
```

**Verdetto Flusso E:** COMPLETAMENTE ASSENTE

---

## 4. STATI DELLA PAGINA

| Pagina | Primo caricamento | Loading | Dati presenti | Empty state | Errore |
|--------|-------------------|---------|---------------|-------------|--------|
| Landing | Animazione ricca | Suspense GlobalLoading | N/A | N/A | ErrorBoundary generico |
| Login | Form con animazioni | "Elaborazione..." su button | N/A | N/A | Messaggio errore inline rosso |
| Dashboard User | Skeleton via isLoading | Spinner orange | Esperienze AI + cards | N/A (ha sempre fallback) | Console.warn, nessun feedback utente |
| Explore | Caricamento da DB | Spinner animato "Ricerca esperienze..." | Lista + mappa | "Nessuna esperienza trovata" + resetta filtri | Console.error, no feedback utente |
| Tour Details | Fetch da DB o mock | Shimmer placeholder | Layout completo | Fallback a mock se non trovato | Messaggio generico |
| AI Itinerary | Form preferenze | Animazione generazione (2s+) | Itinerario multi-giorno | Fallback locale garantito | Fallback automatico a dati statici |
| Map Page | Mappa + POI fetch | Caricamento mappa | Markers interattivi | Mappa vuota senza markers | Console warn |
| Quick Path | Quiz interattivo | Animazione generazione | Risultato con rotta | N/A | Fallback a dati locali |
| Notifications | Fetch da DB | N/A (caricamento istantaneo) | Lista notifiche filtrabili | "Nessuna notifica qui!" con icona | Console.error |
| Profile | Fetch da Supabase | N/A | Dati profilo + storia | Stats a 0, storia vuota | Console.error |
| Dashboard Guide | Fetch profilo + tours + requests | Spinner centrato | Tabs con contenuti | "Nessun tour creato" / lista vuota | Alert + messaggio SQL migration |
| Dashboard Business | Fetch profilo business | Spinner centrato | Form editabile | Auto-crea profilo vuoto | Console.error silenzioso |
| Trending | Dati hardcoded | N/A | Cards trending | N/A (sempre dati mock) | N/A |
| Photos | Dati hardcoded | N/A | Feed social | N/A (sempre dati mock) | N/A |

---

## 5. RESPONSIVE (375px)

| Aspetto | Stato | Note |
|---------|-------|------|
| Layout max-w-md | OK | Tutte le pagine utente usano `max-w-md mx-auto` |
| Touch targets | PARZIALE | La maggior parte dei bottoni ha padding sufficiente (py-3/py-4). TopBar edit city icon ha solo `p-1` con icona 10px = target ~18px, sotto i 44px minimi |
| BottomNavigation | OK | Footer fisso con padding adeguato |
| Scroll orizzontale | OK | Carousel esperienze con `overflow-x-auto` |
| Testo leggibile | OK | Font sizes appropriate (text-sm, text-xs per secondary) |
| Form input | OK | Full width con padding adeguato |
| Modals | OK | Bottom sheet su mobile (`items-end sm:items-center`) |
| Mappa | PARZIALE | Mappa 256px potrebbe essere piccola su mobile |
| Landing role cards | OK | `grid-cols-1 md:grid-cols-3` stacks on mobile |

---

## 6. BRAND ALIGNMENT

| Aspetto | Stato | Note |
|---------|-------|------|
| Colore primario orange-500 | COERENTE | Usato in TopBar, CTA, loader, accent ovunque |
| Colore terracotta | COERENTE | Tema caldo italiano consistente |
| Font | COERENTE | font-quicksand + font-playfair per titoli |
| Tono copy italiano | COERENTE | Tutto in italiano, tono informale-amichevole |
| Animazioni | COERENTE | Framer Motion ovunque, feel premium |
| Eccezione: Landing | DIVERSO | Dark theme (bg-gray-950) vs resto app light (ochre/cream) |
| Eccezione: Login | DIVERSO | Dark theme coerente con landing ma non col resto |
| Eccezione: UpdatePassword | DIVERSO | bg-gray-50 minimal, non ha TopBar ne' branding |

---

## 7. PROBLEMI UX CRITICI (Top 10 per impatto conversione)

### 1. PAGAMENTO ASSENTE (Impatto: CRITICO)
**Dove:** Flusso prenotazione guida (Notifications -> "ACCETTA E PAGA")
**Problema:** Il flow di prenotazione si interrompe con un `alert()` placeholder. Non esiste integrazione Stripe o altro gateway. L'utente non puo' completare una transazione.
**Impatto:** Perdita del 100% delle conversioni a pagamento. La piattaforma non genera revenue.
**Fix:** Integrare Stripe Checkout o Stripe Payment Links.

### 2. ONBOARDING POST-REGISTRAZIONE INESISTENTE (Impatto: ALTO)
**Dove:** Dopo il primo login, l'utente atterra su dashboard-user senza guida.
**Problema:** Nessun wizard di benvenuto, nessuna richiesta di preferenze, nessun tutorial. L'utente deve esplorare da solo.
**Impatto:** Alto tasso di abbandono nei primi 60 secondi. L'utente non capisce il valore di DoveVAI.
**Fix:** Aggiungere onboarding wizard (3-5 step: citta, interessi, tipo viaggio).

### 3. TOUR MOCK vs TOUR REALI NON DISTINGUIBILI (Impatto: ALTO)
**Dove:** TourDetails, TourLive, Home, Trending, SurpriseTour
**Problema:** Molti tour mostrati sono hardcoded (id: 1, 2, 3, "trend1", ecc.). Quando l'utente clicca "Contatta Guida" su un tour mock, il sistema fallisce silenziosamente perché il guideId non e' un UUID valido. L'utente vede un errore criptico.
**Impatto:** Frustrazione utente, perdita fiducia nella piattaforma.
**Fix:** Separare chiaramente tour demo/mock con badge visibile. Disabilitare "Contatta Guida" per tour senza guida reale.

### 4. CHAT GUIDA NON FUNZIONALE (Impatto: ALTO)
**Dove:** TourDetails -> GuideChatModal
**Problema:** La chat nel dettaglio tour e' puramente visiva: l'input non invia messaggi, non c'e' backend. L'utente scrive e pensa di comunicare, ma nulla viene salvato.
**Impatto:** Esperienza ingannevole. L'utente crede di aver contattato la guida.
**Fix:** Rimuovere la finta chat o collegarla al sistema di notifiche gia' funzionante.

### 5. PAGINA HOME (/home) DUPLICA DASHBOARD USER (Impatto: MEDIO)
**Dove:** Route `/home` (protetta) e `/dashboard-user`
**Problema:** Esistono due pagine con funzionalita' quasi identiche (Home.jsx e DashboardUser.jsx). La BottomNavigation punta a `/dashboard-user`, ma alcuni link interni puntano a `/home`. L'utente puo' trovarsi su pagine diverse con contenuti simili.
**Impatto:** Confusione, UX inconsistente.
**Fix:** Eliminare Home.jsx e unificare su DashboardUser.jsx. Redirect `/home` -> `/dashboard-user`.

### 6. RIGENERA GIORNO AI FINTO (Impatto: MEDIO)
**Dove:** AI Itinerary -> Step 3 -> "Rigenera Giorno"
**Problema:** `regenerateDay()` fa un `setTimeout` di 2 secondi e poi setta lo stesso array. Non cambia nulla. L'utente vede uno spinner e poi gli stessi dati.
**Impatto:** Funzionalita' promessa ma non implementata. Perdita fiducia nell'AI.
**Fix:** Implementare reale chiamata a `aiRecommendationService` per il singolo giorno.

### 7. LINK /notification-settings ROTTO (Impatto: MEDIO)
**Dove:** Notifications page -> icona Settings
**Problema:** Il link punta a `/notification-settings` che non esiste nel router. L'utente vede una pagina bianca o errore.
**Impatto:** Dead-end UX.
**Fix:** Creare la pagina o rimuovere l'icona settings.

### 8. PAGES MOCK-ONLY SENZA VALORE REALE (Impatto: MEDIO)
**Dove:** Photos (/photos), Trending (/trending)
**Problema:** Queste pagine mostrano solo dati hardcoded. Photos non permette upload reale. Trending mostra sempre gli stessi tour di Roma. Non c'e' interazione persistente.
**Impatto:** L'utente scopre rapidamente che sono finte. La bottom nav le rende prominenti ma deludono.
**Fix:** O implementare con dati reali, o rimuovere dalla bottom nav e spostarle come "coming soon".

### 9. BECOME GUIDE SIMULATO (Impatto: MEDIO)
**Dove:** /become-guide
**Problema:** Il form di candidatura guida non salva nulla su Supabase. Fa un `setTimeout(1500)` e mostra "Richiesta Inviata!" senza effettivamente registrare la candidatura.
**Impatto:** Potenziali guide credono di essersi candidate ma non vengono mai contattate.
**Fix:** Salvare la candidatura su una tabella `guide_applications` in Supabase.

### 10. TODAYTOURS.JSX ORFANA (Impatto: BASSO)
**Dove:** src/pages/TodayTours.jsx
**Problema:** Il file esiste ma non e' referenziato nel router di App.jsx. Non e' raggiungibile da nessun link. Contiene una UI statica con dati hardcoded.
**Impatto:** Codice morto, confusione per sviluppatori.
**Fix:** Rimuovere il file o integrarlo nel router.

---

## 8. PROBLEMI AGGIUNTIVI

### Touch Target insufficienti
- TopBar: icona Edit2 per cambio citta ha `size={10}` con `p-1` = ~18px di touch target (minimo raccomandato: 44px)
- Explore: pulsante X per rimuovere filtro di ricerca ha `size={12}` senza padding aggiuntivo

### Alert() nativi usati come feedback
- Dashboard Guide: `alert()` per conferma eliminazione tour, accreditamento
- Dashboard Business: `alert()` per GPS acquisito
- Notifications: `alert()` per accettazione offerta
- UpdatePassword: `alert()` per successo
**Dovrebbero essere Toast/Modal in-app per coerenza UX.**

### Booking Modal date hardcoded
- BookingSystem.jsx usa date hardcoded gennaio/febbraio 2025 (gia' passate)
- `availableDates` e `availableTimes` non sono dinamiche

### Nessun feedback di successo dopo signup
- Dopo la registrazione, l'utente vede "Controlla la tua Email!" ma se conferma l'email e torna al sito, non c'e' nessun messaggio di benvenuto personalizzato al primo login

### Missing 404/catch-all route
- Non esiste una route `*` catch-all nel router
- URL invalidi mostrano pagina bianca

### Profile email finta
- In Profile.jsx, l'email mostrata e' `{firstName?.toLowerCase()}@dovevai.it` -- NON l'email reale dell'utente
- Dovrebbe usare `user.email` da AuthContext

---

## 9. RIEPILOGO SCORING

| Area | Score | Note |
|------|-------|------|
| Architettura routing | 7/10 | Ben organizzata ma con duplicati e orfani |
| Flusso autenticazione | 8/10 | Robusto con ruoli, reset password, redirect |
| Flusso prenotazione | 3/10 | Si interrompe prima del pagamento |
| Contenuto reale vs mock | 4/10 | Troppi dati hardcoded mescolati a dati reali |
| Feedback utente | 5/10 | Loading states OK, ma errori spesso silenziosi |
| Mobile UX | 7/10 | Layout responsive, qualche touch target piccolo |
| Brand consistency | 7/10 | Coerente con eccezioni (landing dark vs app light) |
| Completezza funzionale | 5/10 | Molte feature sono placeholder/simulate |

**Score complessivo: 5.75/10**

L'app ha un'interfaccia visivamente curata e un'architettura tecnica solida, ma il gap tra "demo impressionante" e "prodotto funzionale" e' significativo. Le priorita' per il go-to-market sono: (1) pagamento, (2) onboarding, (3) separazione dati mock/reali, (4) eliminazione feature finte.
