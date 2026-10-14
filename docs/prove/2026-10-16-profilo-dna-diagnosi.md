# PROFILO-DNA-DIAGNOSI — cosa del Profilo arriva al motore e cosa impara il DNA

Verifiche iniziali: cartella `~/unnivai-1b`, ramo `main` a `8db9238` (VERITÀ-PRE-GIRO), suite verde (147 file, 1986 test).
Solo lettura: nessun file del codice toccato, nessuna generazione (0 $). Database: solo letture aggregate (conteggi), nessuna scrittura.
Nota: il file citato nel task come `src/contexts/AuthContext.jsx` è `src/context/AuthContext.jsx`.

## In breve

- **Del Profilo arrivano al motore solo dieta, budget e stile a tavola** (filtro, ricerca, spinta, riga nel prompt). **Gli interessi arrivano solo come peso del DNA** (+0,3 ciascuno, fiducia massima 15%), mai come interessi del giro. **«Ritmo lento» non cambia il ritmo**: il Rilassato lo decide solo il wizard di Crea, l'umore «Relax» di Veloce o Per Te (sempre `rilassato`). La lista della città (C10) non riceve niente dell'utente.
- **Il DNA, oggi, non impara.** In tutto il database **nessuna riga ha un solo evento DNA** (`dna:events` = 0 su 3 righe), nessuna chiave `cat:`, nessuna interazione `tour_generated`. Le cause sono tre, tutte nel codice: (1) generare un tour non è un evento DNA; (2) gli eventi che lo sono (tour completato, salvato, valutato, «Dettagli», «Rigenera giorno») richiedono gesti che quasi nessuno fa; (3) la sincronizzazione verso il server manda **lo stato di prima dell'ultimo evento** e si perde se si cambia pagina.
- **La scheda «Il tuo Tour DNA» di Ivano è vuota per costruzione**: conta solo le chiavi `cat:` (soglia 12), che nascono solo da eventi positivi; decine di tour generati ne aggiungono zero. Il testo della scheda («ogni tour che apri e ogni tappa che raggiungi aggiunge un pezzo») è falso: né aprire un tour generato né raggiungere una tappa scrivono nel DNA.
- **Completamento:** un tour risulta completato solo se l'utente sblocca **tutte** le tappe **e poi** preme «Fine». Anche così il Profilo non lo mostra: i numeri sono fissi a «—», «Rivivi i tuoi tour» legge le foto (`user_photos`, che nessuno scrive), e `completed_tours` non la legge nessuno. Nel database: 31 navigazioni partite, 10 tappe raggiunte, 2 completate, 21 abbandonate.
- **Vegetariano di Ivano: il dato non è nel database.** In nessuna riga di `user_preferences` c'è un seme con la dieta (zero semi in forma v2, uno solo in forma lista, ed è vuoto). La pagina mostra fedelmente ciò che il server le dà: **dati persi (o mai arrivati), non errore di visualizzazione.** Quale riga sia di Ivano non l'ho potuto verificare (vedi punto 4).

---

## 1. I controlli del Profilo

Fonte: `src/pages/Profile.jsx` (893 righe), `src/hooks/useAILearning.js`, `src/components/InterestsEditor.jsx`, `src/components/FoodPrefsEditor.jsx`, `src/lib/interests.js`, `src/lib/foodPrefs.js`.

| Controllo | Dove si salva | Arriva al motore? | Dove (file:riga) | Cosa cambia nel tour |
|---|---|---|---|---|
| **Interessi** («I tuoi interessi», `InterestsEditor`, `Profile.jsx:299`) | DB `user_preferences.onboarding_seed.interessi` via `saveInterests` (`useAILearning.js:392-403` → `dataService.upsertOnboardingSeed`); copia nel browser `unnivai_onboarding_seed_v1` | **Solo come peso del DNA** | `computeWeights` `preferenceEngine.js:182-188` (+0,3 a interesse); fiducia `computeDnaShare` :163-170 (max 0,15); pesi al merito `candidateScoring.js:145-155`; testo «Preferenze dominanti: …» nel prompt del selettore (`weightsToAIProfile` :225-240 → `aiRecommendationService.js:1320-1326`; Per Te :1628) | Una spinta di merito ≤15% ai candidati con tipi Google della categoria; una riga nel prompt. **Non** diventano gli interessi del giro: nessuna pagina li mette in `prefs.interests` (scheletro :2634, temi del percorso B :467, ganci `userInterests` :3067 non li vedono). I ganci «È qui perché cerchi…» chiedono peso ≥0,5 (`stopPhrases.js:111`): il seme da solo non basta |
| **«Ritmo lento»** (è l'interesse `relax`, `interests.js:11`) | come sopra | **Solo come peso `relax`** | `preferenceEngine.js:86`: `relax` vale solo per `spa`, `wellness_center`, `beauty_salon`, `viewpoint` | **Il ritmo non cambia.** Il Rilassato (1 tappa per momento, drink 60 min, tetto 6 visite, niente riempimento) legge solo `prefs.pace` (`buildDaySkeleton` `aiRecommendationService.js:2633`, `fillGaps` :2872). `pace` viene da: wizard di Crea (`AiItinerary.jsx:36`), umore «Relax» di Veloce (`QuickPath.jsx:234`), Per Te fisso `'rilassato'` (`DashboardUser.jsx:271`, effetto pieno solo di sera, `_homeSera` :3697). Sorprendimi non passa `pace` → sempre «attivo» (`SurpriseTour.jsx:224-230`). Grep di `relax` verso `pace`: vuoto |
| **Cosa non mangi** (dieta, `FoodPrefsEditor`, `Profile.jsx:302`) | DB `onboarding_seed.vincoli.dieta` via `saveFoodPrefs` (`useAILearning.js:374-383`); copia nel browser | **Sì** | Pagine: `opts.onboardingPrefs` (Crea `AiItinerary.jsx:218`, Veloce `QuickPath.jsx:658`, Sorprendimi `SurpriseTour.jsx:238`, Per Te `DashboardUser.jsx:244, 274`). Gerarchia `resolveFoodPrefs` `foodPrefs.js:131-146`; ricerca `searchFoodWithDiet` `foodPrefs.js:216` (usata a :879-882, :896-899, :1127-1130, `placesDiscoveryService.js:768-785`); filtro `applyFoodConstraints` `foodPrefs.js:272-289` (a :2522-2527, :1151, :1468-1472); prompt `hierarchyPromptBlock` (:1336, solo selettore) | Le ricerche dei pasti aggiungono il criterio («con opzioni vegetariane…»); un posto dove mangiare resta solo se viene da una ricerca col criterio; riga onesta sulla dieta a schermo (:3120, :3613). Il testo dell'utente vince (carne/pesce la sospendono). **Buchi:** la ricerca mirata «colazione» (:1126) non applica la dieta; il prompt di Per Te non ha la regola |
| **Quanto spendere a pasto** (budget) | DB `onboarding_seed.vincoli.budget` | **Sì** | Gerarchia testo → wizard → primo accesso `foodPrefs.js:148-152`; tetto `BUDGET_MAX_PRICE_LEVEL` :34; filtro `passesBudget` :261-265 (a :2523, :1151, :1469); malus prezzo ignoto `foodPrefBonus` :313 | Esclude **tutti** i candidati con livello di prezzo sopra il tetto (non solo i ristoranti); −0,04 a chi non ha prezzo |
| **Stile a tavola** | DB `onboarding_seed.gusti.stile` | **Sì, debole** | `matchesStile` `foodPrefs.js:300-307`, `foodPrefBonus` :309-315 (in `selectScoredCandidatePool` :2549-2557, `searchMomentCandidates` :1157-1158, `prepareHomePools` :1479); riga nel prompt :332-333 | +0,12 ai posti dove mangiare che corrispondono. **Non** agisce in `momentSelection` (riparazione e riempimento: grep di `foodPrefs\|dieta\|stile` trova solo un commento a :391) |
| **Città** (riga sotto il nome, `Profile.jsx:223-226`) | Non si salva dal Profilo: è solo mostrata (`useUserContext().city`: scelta manuale → GPS → `profiles.current_city_override` → `localStorage.user_city` → «Roma») | Sì, ma non dal Profilo | Crea `AiItinerary.jsx:87` + `resolveCityCenter` :186 (il testo vince, :269-279); Veloce `QuickPath.jsx:491-497`; Per Te `DashboardUser.jsx:70, 212`; Sorprendimi `:223` con **il centro dal GPS** (:236); lista C10 `aiRecommendationService.js:2381` | Centro e raggio della ricerca, lista della città, chiavi di cache |
| **Mete** (`Profile.jsx:351-365`, pannello «Esplora Zone» :457-472) | Nulla | No | — | Nulla: testo fisso «Le zone che esplori appariranno qui…» (:470) |
| **Risultati** (:335-349, «I Miei Risultati» :440-455) | Nulla | No | — | Nulla: testo fisso «…il primo si sblocca al tuo primo tour completato.» (:453), nessun codice lo sblocca |
| **Rivivi i tuoi tour** (:475-594) | Legge `user_photos` ⨝ `tours` (:80-97) | No | — | Sempre vuoto: **nessun codice del client scrive `user_photos`** (0 righe nel DB) e i tour generati non sono in `tours` (id `ai-itinerary-<ora>`, mai salvati) |
| **Numeri Tour / Guide / Rating** (:230-245) | Nulla | No | — | Fissi a «—» nel codice; la frase «completane uno e questi numeri prendono vita» (:245) non è vera: completare un tour non li cambia |
| **Richieste** (:313-333, pannello :371-438) | Legge `guide_requests` (:137-143) | No | — | Guide spente in V1: elenco sempre vuoto per chi non ha richieste vecchie |

**Il seme e la lista C10:** il client manda solo `{ dv: { purpose: 'city_list', citta, giorno } }` (`cityKnowledgeService.js:31`), il server legge solo città e giorno (`openai-proxy/index.ts:211-212, 256`). Dieta e budget agiscono dopo, sul pool unito; le ancore e i posti «da locale» stanno fuori dal merito, quindi **fuori dal DNA** (`poolConLista` :2555).
**Il traduttore d'intento** riceve solo città e frase (`aiRecommendationService.js:657`): né interessi né dieta né DNA.

**Due difetti di passaggio trovati lungo la strada (non corretti):**
- Crea, Veloce e Sorprendimi, con fiducia 0, passano `dnaWeights: {}` senza `_share` (`AiItinerary.jsx:218`); `dnaShareOf` in quel caso vale **0,45**, non 0 (`candidateScoring.js:141-143`). L'affinità è 0 per tutti, quindi l'ordine non cambia, ma la parte «unicità + voto» si restringe e lo stile/il malus prezzo pesano ~1,8 volte. Per Te passa correttamente `{ _share: 0 }` (`DashboardUser.jsx:274`).
- Per Te non si rigenera quando cambiano gli interessi dal Profilo: la chiave `['home-experiences', city, totalInteractions, hasPreferences, dieta/budget/stile]` (`DashboardUser.jsx:184`) non contiene i pesi.

## 2. Il DNA

**Dove vive:** browser `unnivai_ai_learning_brain_v2` (`useAILearning.js:11`) + DB `user_preferences.preference_data / interactions / total_interactions`. Il logout svuota la copia del browser (`AuthContext.jsx:83`).

| Evento | Chi lo emette (file:riga) | Cosa scrive nel grafo | Conta per il motore? |
|---|---|---|---|
| Tour **generato** (Crea, Veloce) | `trackGeneratedTour` `AiItinerary.jsx:283`, `QuickPath.jsx:735` | `city:<X>` (+ `mood:`/`duration:` da Veloce). **Nessun `cat:`, nessun `dna:`** (le preferenze di Crea sono `{id: true}`, senza `category`) | **No** |
| Tour generato (Sorprendimi, Per Te) | nessuno | — | No |
| Tour **aperto** (Dettagli tour) | `trackTourView` `TourDetails.jsx:515` | `cat:` solo se `tour.category/type` è una categoria valida; `city:` | **No** (solo `cat:`, che il motore ignora) |
| **Tappa raggiunta** | nessuno: `handlePOIUnlock` scrive solo `step_reached` in `nav_events` (`MapPage.jsx:1378`) | — | No |
| **Tour completato** (tutte le tappe sbloccate) | `trackDnaEvent('tour_completed')` `MapPage.jsx:1421` | `dna:<cat>` +0,3, `cat:<cat>` +1, `dna:events` +1 | Sì |
| Tour **salvato** (cuore) | `TourLive.jsx:413` — pagina raggiungibile solo per URL diretto | +0,2 | Sì, ma di fatto irraggiungibile |
| Tour **valutato** | `ReviewModal` `MapPage.jsx:2189` — compare solo con `guideId` (`TourSummaryModal.jsx:133-139`), **mai per un tour AI** | ±0,3 | Sì, ma irraggiungibile per i tour generati |
| «**Dettagli**» di una tappa | `AiItinerary.jsx:749` | +0,05 | Sì (solo in Crea) |
| «**Rigenera giorno**» | `AiItinerary.jsx:321` | −0,1, `dna:events` +1, nessun `cat:` | Sì |
| Tappa **saltata** | **nessuno**: `stop_skipped` è definito (`preferenceEngine.js:53`) ma grep dei chiamanti vuoto | — | — |
| Tappa **cambiata** | non esiste un evento | — | — |
| Clic CTA notifica | `Notifications.jsx:168` (`trackInteraction`) | `city:` | No |

**Come diventano pesi e fiducia** (`preferenceEngine.js`): peso di categoria = semi (+0,3) + somma dei `dna:<cat>`, tagliato fra 0 e 1 (:178-202). Fiducia = 0 sotto 5 eventi, poi lineare fino a 0,45 a 20 eventi; col solo seme 0,15 (:163-170). Il motore legge `dnaWeights` nel merito (`candidateScoring.js:145-155`, `momentSelection.js:607, 1041`), `getAIContext` nel prompt del selettore e di Per Te, `getTourAffinity` per ordinare i tour di Per Te dal DB (`DashboardUser.jsx:195, 368`, spenti in V1).

**La sincronizzazione perde gli eventi** (`useAILearning.js:205-217, 220-260, 267-288`): `trackInteraction`/`trackDnaEvent` aggiornano lo stato e poi chiamano `syncToDb`, che è la versione creata al render precedente: dopo 3 s manda al server **lo stato prima dell'evento**. Il timer non si cancella quando la pagina si smonta; ogni pagina ha la sua copia del hook. Effetto: l'ultimo evento di ogni pagina non arriva mai al server se dopo non ne avviene un altro sulla stessa pagina. Il caso tipico — «tour completato» seguito dal riepilogo e dall'uscita dalla mappa — è proprio quello perso. (Ragionato sul codice, non riprodotto.)

**Cosa c'è nel database** (conteggi aggregati, nessun dato personale):

| Voce | Valore |
|---|---|
| righe `user_preferences` | 3 |
| righe con `dna:events` | **0** |
| righe con chiavi `cat:` | **0** |
| chiavi presenti in `preference_data` | solo `city:` (3) |
| interazioni salvate | solo `tour_view` (5); **nessuna** `tour_generated` |
| `total_interactions` massimo | 2 |
| `nav_events` | 31 `nav_start`, 10 `step_reached`, 2 `nav_complete`, 21 `nav_abandon` |
| `completed_tours` / `explorers` / `user_photos` | 2 / 0 / 0 |

**Perché la scheda di Ivano è vuota dopo decine di tour.** La scheda (`Profile.jsx:249-296`) somma le chiavi `cat:` e mostra le percentuali da 12 in su (`DNA_MIN_CATEGORIZED`, :22). Generare un tour non scrive `cat:`; i soli eventi che lo scrivono sono tour completato, salvato, valutato ≥4 e «Dettagli» (`applyDnaEvent` :147). Per arrivare a 12 servono, per esempio, 12 «Dettagli» in Crea o 4–6 tour completati fino all'ultima tappa. Se anche Ivano li avesse fatti, la copia del browser li terrebbe, ma il server no (sincronizzazione sopra) e il logout cancella la copia. Il motore, intanto, vede di Ivano solo il seme (e nel DB il seme non c'è: punto 4), quindi **la sua fiducia DNA è 0**.

## 3. Il completamento

| Passo | Cosa deve fare l'utente | Dove |
|---|---|---|
| 1 | Essere loggato (il trigger vuole `user_id`) | `navTelemetry.js:42-46` |
| 2 | Portare il tour sulla mappa: Crea «Vedi su Mappa» (id `ai-itinerary-<ora>`), Veloce (`ai-quiz-<ora>`), Sorprendimi/Per Te passando da Dettagli tour «Avvia Itinerario» | `AiItinerary.jsx:815, 846`; `QuickPath.jsx:702, 1077`; `TourDetails.jsx:673-748, 1341` |
| 3 | «Avvia», poi «Avvia Navigazione» → `nav_start` | `MapPage.jsx:1882, 1815, 1079` |
| 4 | Sbloccare **tutte** le tappe: geofence automatico, o «Sono arrivato» (solo mobile, solo durante la navigazione) → `step_reached` per tappa | `MapPage.jsx:1131-1216`; `POIDetailDrawer.jsx:270-276`; `MapPage.jsx:1378` |
| 5 | All'ultima tappa: toast «Tour completato!», **evento DNA `tour_completed`**, riepilogo | `MapPage.jsx:1388, 1421, 1424` |
| 6 | **Premere «Fine»** nella barra di navigazione → `nav_complete` (solo se tutte le tappe sono fatte, altrimenti `nav_abandon`) | `NavigationHUD.jsx:225-232`; `MapPage.jsx:986-989` |
| 7 | Il trigger scrive `completed_tours` (user, tour_id) | `20260722_gate_bridge_completed_tours.sql:39-62` |

**Cosa non funziona:**
- Uscire dalla mappa senza «Fine» non registra niente (nessuna scrittura all'uscita, `MapPage.jsx:1000-1005`); ripremere «Avvia» azzera le tappe senza registrare.
- L'id del tour cambia a ogni generazione (e in Crea a ogni render): `UNIQUE(user_id, tour_id)` non deduplica nulla, e nessuna tabella tiene il tour (titolo, città, tappe): un completamento è un id senza contenuto.
- **Nessuno legge `completed_tours`** nel client (grep vuoto); `nav_events` è leggibile solo dal service role.
- **«Rivivi i tuoi tour»** legge le foto, non i completamenti. **I numeri** sono testo fisso. `explorers.tours_completed`/`km_walked` non li scrive nessuno (solo `backend_logic_users.sql:74-81` alla radice, mai chiamato).
- Il riepilogo (`TourSummaryModal.jsx:21-41`) scrive `localStorage.user_tour_history` anche per tour parziali; lo legge solo «Il tuo Diario» della Home (`DashboardUser.jsx:398`) e il logout lo cancella.

**La navigazione registra davvero?** Sì, tappe raggiunte e partenze arrivano a `nav_events` (10 e 31). Il completamento arriva solo col passo 6: 2 su 31 nel database.

## 4. I dati di Ivano (vegetariano, nessun interesse)

**Esito: dati persi o mai arrivati al server, non un errore di visualizzazione.**

- **Pagina:** il Profilo mostra quello che il hook riceve. `FoodPrefsEditor` mostra «Nessuna restrizione» quando `dieta` è `[]`; `InterestsEditor` mostra gli interessi i cui id CORE sono tutti nel seme (`interestIdsFromSeed`, `interests.js:22-24`). Il server vince sempre sul browser appena risponde (`useAILearning.js:136-154`).
- **Database** (conteggi aggregati): 3 righe di `user_preferences`; semi `NULL` 2, in forma lista 1 (**vuota**, cioè «saltato»), in forma v2 (quella che contiene la dieta) **0**. **Nessuna riga, di nessun utente, contiene una dieta.** Il vegetariano non è sul server.
- **Browser:** non leggibile da qui.
- **Quale riga è di Ivano: non verificato.** La lettura riga per utente è stata bloccata dal controllo dei permessi (dati personali); ho fatto solo conteggi. Ragionamento, non prova: chi ha seme `NULL` e nessun flag locale rivede l'onboarding (`onboardingStatus.js:82`); se Ivano non lo rivede e vede il Profilo vuoto, la sua riga è con ogni probabilità quella col seme `[]`.
- **Come può essere andato perso** (ipotesi in ordine di plausibilità, nessuna verificata):
  1. **La migrazione ONB-1 ha scritto `[]`.** `resolveOnboardingStatus` (`onboardingStatus.js:73-75`): server vuoto + flag «fatto» nel browser + **nessuna copia del seme** → scrive `readLocalSeed() ?? []`. Il vecchio logout cancellava la copia del seme; se il flag era rimasto (o è tornato da un altro percorso), al primo accesso dopo il 12/10 il server ha ricevuto «saltato». Da lì il `[]` del server vince sempre.
  2. **La dieta non è mai salita.** La domanda sulla dieta esiste dal 08/10 (`5c1343a`); prima di ONB-1 (12/10) l'onboarding di un utente non loggato salvava solo nel browser (`Onboarding.jsx:146-153`), e il logout cancellava la copia.
  3. **Scelta in un altro account o come ospite** (il Profilo da ospite salva solo nel browser, `useAILearning.js:376-380`).
- Non ho scritto niente. Per chiudere il punto serve la lettura della sola riga di Ivano (vedi «Decisioni»).

## 5. Guide, attività, foto (cosa vede un esploratore)

**Interruttori che esistono già:** `V1LockedGuard` (`src/components/V1LockedGuard.jsx:23-25`, rimanda sempre a `/prossimamente/<kind>`, nessun flag) su `/become-guide`, `/dashboard-guide`, `/guide/*`, `/chat/guide/:id`, `/profile/guide/:id`, `/dashboard-business`, `/business/*` (`App.jsx:160, 174-178, 183-184`); `GUIDE_TOURS_ENABLED = false` (`dataService.js:80`) spegne i tour delle guide in Home, Mappa, TourLive. Nessun `isV1` né flag `VITE_*` di funzione.

| Schermata | Elemento — testo | File:riga | Già nascosto? |
|---|---|---|---|
| Barra in basso | voce «Foto» → `/photos` | `BottomNavigation.jsx:9` | No |
| Barra in basso | voce «Esplora» → `/explore` (interroga `tours` direttamente, oggi vuota solo perché la query va in errore 400) | `BottomNavigation.jsx:8`; `Explore.jsx:120-126` | No (vuota per errore) |
| Foto | «In Costruzione», «Foto dei Tour», «Presto potrai condividere i tuoi scatti migliori…», «Galleria immersiva», «Like e commenti», «Condivisione social», «Tag automatici», «Esplora Luoghi» | `Photos.jsx:14-17, 47, 57, 60, 91` | No |
| Profilo | numeri «Tour», «Guide», «Rating» (fissi «—») e «Il tuo primo giro ti aspetta…» | `Profile.jsx:230-245` | No |
| Profilo | «Richieste», «Richieste Attive», «Non hai richieste attive al momento.», «Assegnata a una guida locale», «Apri Chat» (→ `ChatModalUser`) | `Profile.jsx:326, 382, 387, 423, 429, 881-887` | No |
| Profilo | «Risultati», «I Miei Risultati», «…il primo si sblocca al tuo primo tour completato.» | `Profile.jsx:348, 451, 453` | No |
| Profilo | «Mete», «Esplora Zone», «Le zone che esplori appariranno qui…» | `Profile.jsx:364, 468, 470` | No |
| Profilo | «Rivivi i tuoi Tour», «Le tue tappe raccontano dove sei stato… Le foto dei tuoi tour appariranno qui.», «{n} foto», «Vedi tutte», «Ricordi», «Rivivi Ricordo»; modale «Guida», «Gallery», «altre foto», «Visualizza Album Completo», «Condividi Tour» | `Profile.jsx:485, 491-493, 502, 532, 575, 689, 730-733, 781, 792, 822` | No |
| Profilo | scheda DNA: «Il tuo DNA si sta formando: ogni tour che apri e ogni tappa che raggiungi aggiunge un pezzo.» (testo non vero, punto 2) | `Profile.jsx:272` | — |
| Dettagli tour | «La tua guida», «({n} recensioni)», «Profilo» guida, «Recensioni ({n})», «Richiedi Guida», «Invierai una richiesta non vincolante alla guida.» | `TourDetails.jsx:889, 908, 917-921, 955, 1336, 1346` | Sì, di fatto (solo con `isGuideTour`, :664) |
| Dettagli tour | «Consigliati nei dintorni» (partner, RPC `get_nearby_partners_for_tour`) | `TourDetails.jsx:1250, 581` | No (saltato solo per `ai-quiz-`, :574) |
| Mappa | partner da `businesses_profile`: «{n} partner compatibili», «Ricerca partner...», «Partner DoveVai», «Attività partner — fai tappa qui durante il tour!», «Vai qui» | `MapPage.jsx:166-170, 858-868, 1638, 1824, 1873, 2053, 2086-2096` | No |
| Mappa | riepilogo «Lascia una Recensione» / «Guida: …» | `TourSummaryModal.jsx:133-139`; `ReviewModal.jsx:77-78` | Sì per i tour AI (solo con `guideId`) |
| Home | card «In costruzione — Guide Locali — Persone del posto — non ancora disponibili» → `/prossimamente/guide` | `DashboardUser.jsx:598-632` | È già una porta «Prossimamente» |
| Home | «Il tuo Diario», «Tappe e Scoperte», «{n} Tour» (da `user_tour_history` nel browser) | `DashboardUser.jsx:451-486` | No |
| Landing | «Presto: persone del posto in carne e ossa» → `/prossimamente/guide` | `Landing.jsx:746-749` | Porta «Prossimamente» |
| Tour Live | «Tour Live», «Nessun tour live oggi», «Nessuna guida sta conducendo un tour a…», «La tua guida», «Prenota» | `TourLive.jsx:124, 187, 190, 285, 387` | Solo per URL diretto (`/tour-live`, `App.jsx:156`) |
| Trending | «Trending Ora», «tour che tutti stanno prenotando…» | `Trending.jsx:9-22`; `App.jsx:158` | Nessun link (solo URL diretto) |
| Notifiche | risposta alla guida (`action_url '/dashboard-guide'`), ReviewModal su `payment_confirmed` (tipi filtrati) | `Notifications.jsx:208-213, 636-645`; `dataService.js:488-492` | In parte |
| Prossimamente | `/prossimamente/guide|attivita|foto` | `App.jsx:165-167`; `Prossimamente.jsx:20-86` | `foto` e `attivita` senza link |

**Proposta (non scritta): un interruttore unico.**
- Un modulo `src/lib/v1.js` con una costante, per esempio `export const V1_SOLO_GIRI = true` (oppure letta da `import.meta.env.VITE_V1_SOLO_GIRI`, con `true` di difetto), e tre funzioni di comodo: `mostraGuide()`, `mostraFoto()`, `mostraPartner()`.
- Dove si usa (solo condizioni di rendering, niente cancellato, nessuna tabella toccata):
  1. `BottomNavigation.jsx:8-9`: «Esplora» e «Foto» escono dall'elenco.
  2. `App.jsx:138, 148, 156, 158`: `/explore`, `/photos`, `/tour-live`, `/trending` avvolte in `V1LockedGuard` (che c'è già) quando l'interruttore è acceso.
  3. `Profile.jsx`: numeri Guide/Rating, Richieste, Risultati, Mete, «Rivivi» basato sulle foto e testi che citano foto/guide non si montano (il blocco «I tuoi giri» del punto 6 li sostituisce).
  4. `TourDetails.jsx:1250` e `MapPage.jsx` (partner): non si montano.
  5. `V1LockedGuard` legge la stessa costante: spenta la costante, le rotte tornano attive senza toccare `App.jsx`.
- Stima: mezza giornata più i test (un test per voce: con la costante accesa l'elemento non c'è). Rischio basso: nessuna logica del motore coinvolta.

## 6. Proposta (non scritta): il Profilo V1 come pannello del DNA

**Chi sei — i controlli che il motore usa davvero**
1. **Interessi e ritmo, separati e veri.** Gli interessi restano (peso del DNA), ma diventano anche `prefs.interests` di Crea/Veloce/Sorprendimi/Per Te quando l'utente non ne sceglie altri; «Ritmo lento» esce dagli interessi e diventa un controllo **Ritmo** (Rilassato / Attivo / Intenso) salvato nel seme e usato come `pace` di difetto da tutte le pagine (Sorprendimi compresa). *1–1,5 giorni; tocca le 4 pagine e `foodPrefs`/seme; banco su Crea e Per Te.*
2. **A tavola** (dieta, budget, stile) com'è oggi, più i due buchi: dieta nella ricerca «colazione» (:1126) e regola dieta nel prompt di Per Te. *0,5 giorni; tocca il motore → banco.*
3. **Città**: mostrata con la sua origine («dalla posizione» / «scelta da te») e il pulsante «Torna alla posizione» (`CityContext.resetToGPS` esiste e non è collegato). *0,5 giorni.*

**Cosa ho capito di te — il DNA in parole, correggibile**
4. **Riparare l'apprendimento prima di mostrarlo.** `syncToDb` deve mandare lo stato **dopo** l'evento (calcolare il grafo nuovo e mandarlo, o un effetto che sincronizza quando il grafo cambia) e svuotare il timer all'uscita dalla pagina. *0,5 giorni + test. Senza questo i punti 5–6 mostrano un DNA che il server non ha.*
5. **Eventi che un utente fa davvero:** «tappa raggiunta» (+0,05 alla categoria della tappa, dallo stesso punto di `step_reached`), «tappa saltata» (`stop_skipped` esiste e nessuno lo emette), voto del tour anche per i tour AI (oggi solo con `guideId`). Decisione di prodotto: se anche «tour generato» debba contare (proposta: no, è un'intenzione, non un gusto). *1 giorno; **dipende dalla navigazione** (geofence e «Sono arrivato» funzionanti).*
6. **La scheda in parole:** al posto delle percentuali di `cat:` (che il motore non usa), le frasi dai pesi veri (`dna:` + seme) e la fiducia: «Ti piacciono i musei e i panorami (da 6 tour completati)»; ogni riga con «Non è vero» che scrive un evento negativo, e un «Ricomincia» che azzera `dna:*` lasciando il seme. Testi nuovi da approvare. *1 giorno.*
7. **Testi onesti subito:** la frase della scheda DNA (`Profile.jsx:272`) e quella dei numeri (:245) dicono cose che il codice non fa; vanno riscritte anche se il resto aspetta. *Un'ora, testi da approvare.*

**I tuoi giri — tutti i tour e il loro stato**
8. **Salvare il tour generato**: una tabella `user_tours` (id stabile uuid, titolo, città, giorno, tappe, origine Crea/Veloce/Sorprendimi/Per Te, stato `generato → avviato → completato | interrotto`), scritta alla generazione; la mappa riceve l'id stabile. *1,5 giorni + migrazione; tocca le 4 pagine e `MapPage`.*
9. **Stato dalla navigazione**: `avviato` su `nav_start`, `completato` all'ultima tappa sbloccata (non su «Fine»: oggi `nav_complete` arriva solo col pulsante), `interrotto` all'uscita; `completed_tours` resta come registro. «Rivivi» e i numeri (solo **Tour** e **Tappe**: Guide e Rating escono in V1) si leggono da qui. *1 giorno; **dipende dalla navigazione** (completamento all'ultima tappa, uscita senza «Fine»).*
10. **Riapri un giro**: dal Profilo, «Rivedi sulla mappa» e «Rifallo» riaprono il tour salvato senza rigenerarlo (0 $). *0,5 giorni; dipende dall'8.*

Totale indicativo: 8–9 giorni. Ordine consigliato: 7 → 4 → 1–2 → 8–9 → 5–6 → 3, 10. Tutto ciò che tocca il motore (1, 2) si chiude con un giro del banco sul codice finale.

## Decisioni per Ivano

1. **Lettura della tua riga.** Per chiudere il punto 4 serve leggere la sola riga di `user_preferences` del tuo account: il controllo dei permessi ha bloccato la query che identificava l'account fra tutti gli utenti. Basta che tu mi dica l'id del tuo account (o che autorizzi esplicitamente la ricerca per email), e leggo solo quella riga.
2. Se rimettere il vegetariano dal Profilo (lo scrive `saveFoodPrefs` sul server) o aspettare la diagnosi della riga.
3. «Tour generato» come evento DNA: sì o no (proposta: no).
4. Le proposte 1–10 e l'interruttore del punto 5.

## Cosa ho dato per vero senza verificarlo

1. **Quale riga del database sia di Ivano.** Non l'ho identificata (lettura bloccata); la conclusione «dati persi» vale per tutto il database (nessuna dieta in nessuna riga), il resto del punto 4 è ragionamento.
2. **Il browser di Ivano.** Non ho visto il suo localStorage: non so se lì il vegetariano c'è ancora.
3. **La perdita della sincronizzazione** (`syncToDb` un passo indietro, timer non cancellato all'uscita): ricavata leggendo il codice, coerente coi dati (nessuna `tour_generated` e nessun `dna:` nel DB), **non riprodotta** con un test.
4. **Il DB di produzione è `ahecpiwsdhghkndncejb`**: dall'URL in `.env` locale, non dalle variabili di Vercel.
5. **Le righe citate dagli agenti di lettura**: ho controllato a campione (passaggio di `dnaWeights` in Crea, `prefs` di Per Te, `dnaShareOf`, chiamata della lista C10, messaggio del traduttore, chiave di Per Te, barra in basso, `V1LockedGuard`, id `ai-itinerary-`, `user_tour_history`); le altre le ho prese per buone.
6. **«Sono arrivato» solo su mobile e geofence funzionante sul campo**: dal codice, non provati su un telefono.
7. **Le stime di lavoro del punto 6** sono a occhio, senza contare il giro del banco.
