# NAV-DIAGNOSI — dove si fermano le navigazioni e dove la navigazione può bloccarsi

**Solo lettura, 0 $.** Ramo `nav-diagnosi` da main `b096732`. Ho letto il codice e fatto solo `SELECT` sul database (`nav_events`, `error_logs`, `profiles`, `ai_quota_test_account`). Nessuna modifica al codice, nessuna chiamata a OpenAI o Google, nessuna prova su un iPhone.
**Privacy:** nel report gli utenti sono U1 e U2, i tour T1…T25. Nessuna email, nessun id, nessuna posizione.

## Esito in breve

- **I numeri sono pochissimi:** in tutto il database ci sono **31 navigazioni avviate** (dal 17/07 al 07/10).
  - 2 completate (6%);
  - 21 chiuse con «Fine» prima della fine (68%);
  - 8 senza nessun evento di fine (26%).
- **30 su 31 vengono da un solo account**, U1: esploratore, illimitato, iscritto a febbraio. È quasi certamente l'account con cui si prova l'app. **Un solo utente vero** (U2) ha navigato, una volta. L'account di prova del banco non ha mai navigato.
- **«La maggior parte viene abbandonata» va letto così:**
  - 15 dei 21 abbandoni sono **prove chiuse entro circa un minuto, a 0 tappe**;
  - 2 sono **navigazioni verso una sola tappa**, che il codice conta come abbandono anche quando la tappa è raggiunta;
  - restano **4 tentativi veri** interrotti (sezione 3).
- **Il database non sa quasi niente di come finisce una navigazione:**
  - non registra il numero totale di tappe, il dispositivo, il browser, la chiusura della pagina, gli errori del GPS, la rete;
  - `error_logs` ha **1 riga in tutto il database** (30/08, pagina del profilo).
- **I punti di blocco su iPhone, letti nel codice** (sezione 4). I più gravi:
  1. **se il primo GPS non risponde in 5 secondi, il tracciamento non parte più per tutta la navigazione**: nessuna tappa si sblocca da sola, anche quando il GPS torna, e il messaggio promette «ti raggiungeremo appena il segnale c'è»;
  2. **nessuna ripresa dopo una ricarica**: se iOS chiude la scheda in background, al ritorno la navigazione non c'è più, le tappe fatte sono perse e non resta traccia dell'abbandono;
  3. **lo schermo che si blocca ferma il GPS**: se intanto passi accanto a una tappa, la tappa non si sblocca più da sola. «Sono arrivato» c'è, ma solo dentro la scheda della tappa;
  4. **nessun messaggio** quando il GPS si perde durante la navigazione o la rete cade. Lo stato «offline» è calcolato ma non mostrato da nessuna parte; un errore del percorso compare con il codice inglese di Google.

## 1) La mappa del flusso

**File della navigazione** (trovati con la ricerca, dichiarati):

| File | Ruolo |
|---|---|
| `src/pages/MapPage.jsx` (2.206 righe) | tutta la navigazione: avvio, GPS, geofence, tappe, fine, telemetria |
| `src/components/Map/NavigationHUD.jsx` | la barra in navigazione: prossima tappa, distanza, istruzione, voce, ricentra, **«Fine»** |
| `src/components/Map/POIDetailDrawer.jsx` | la scheda della tappa: **«Sono arrivato»** (solo in navigazione e solo su una tappa del tour) |
| `src/components/Map/TourRoute.jsx`, `src/hooks/useTourRouting.js` | il percorso con Google Directions (JS), distanza e durata |
| `src/lib/navGeo.js` | distanze (`haversineM`) e istruzione attiva (`pickActiveStep`) |
| `src/components/Map/TourSummaryModal.jsx` | il riepilogo a fine giro |
| `src/lib/navTelemetry.js` + `supabase/migrations/20260717_gate_nav_events.sql` | gli eventi in `nav_events` |
| `src/lib/errorReporting.js`, `src/components/ErrorBoundary.jsx` | gli errori in `error_logs` (solo errori di disegno della pagina) |
| Ingressi: `TourDetails.jsx:724`, `QuickPath.jsx:1077`, `AiItinerary.jsx:793` (link), `TourLive.jsx:378` | arrivano a `/map` con il tour nello stato del router (`location.state.tourData`) |

`src/pages/TourLive.jsx` non è la navigazione: è l'elenco dei tour dal vivo delle guide.

**Il flusso:**

1. **Arrivo sulla mappa** (`/map`). Il tour viaggia in `location.state`. All'apertura la mappa chiede la posizione: precisione bassa, attesa massima 8 s, poi la città. Parte anche un `watchPosition` di sfondo, a bassa precisione, che muove solo il pallino blu.
2. **«Naviga» o «Avvia»** → pannello del percorso (`handleStartNavigationClick`) → **«Avvia»** (`handleStartNavigationReal`):
   - azzera geofence, tappe fatte, cronometro;
   - decide il bersaglio: «Naviga» su una tappa la insegue da sola, «Avvia» le insegue tutte in ordine;
   - mostra il messaggio «Navigazione avviata»;
   - chiede la posizione **ad alta precisione con 5 s di attesa massima**.
3. **Se la posizione arriva:**
   - evento **`nav_start`**;
   - la mappa vola sull'utente;
   - parte il **`watchPosition` della navigazione**: alta precisione, attesa 15 s, età massima 1 s.
4. **Se la posizione non arriva** (rifiutata, o oltre i 5 s):
   - evento `nav_start` con `gps_denied: true`;
   - messaggio «Partiamo dalla prima tappa…»;
   - la mappa si mette sulla prima tappa;
   - **nessun `watchPosition` della navigazione** (sezione 4, punto B1).
5. **A ogni posizione** (nel `watchPosition`):
   - distanza dalla prossima tappa;
   - soglia = il più grande fra 25 m e la precisione del GPS;
   - la tappa scatta quando la distanza scende sotto la soglia e la tappa era «armata», cioè vista almeno una volta fuori dalla soglia (oppure è la prima della sessione);
   - poi l'istruzione di svolta, la camera, le curiosità ogni 300 m (a piedi).
6. **Una tappa raggiunta** (`handlePOIUnlock`, dal geofence o da «Sono arrivato»):
   - evento **`step_reached`**;
   - messaggio «Tappa n/N completata»;
   - la mappa vola alla tappa dopo.
   - All'ultima: latch di fine, stop del GPS e riepilogo dopo 2 s. **Nessun evento `nav_complete` qui**: arriva solo se poi l'utente preme «Fine».
7. **«Fine»** (`handleEndNavigation`):
   - stop del GPS e della voce;
   - **`nav_complete`** se le tappe fatte sono almeno quante quelle del tour, altrimenti **`nav_abandon`** con `step_index` = tappe fatte;
   - riepilogo se almeno una tappa è stata fatta.
8. **Cosa chiude la navigazione senza «Fine»:** tornare indietro, il link della mappa, ricaricare, chiudere la scheda, iOS che scarica la pagina in background. Lo smontaggio ferma il GPS (`clearWatch`) ma **non registra nessun evento**.

**Stato salvato:** niente. `isNavigating`, tappe fatte, cronometro e bersaglio vivono solo in memoria (React e ref). L'unica cosa scritta in `localStorage` è il registro di debug, solo se `DEBUG_NAV` è acceso.

## 2) I dati

**Tutti gli eventi** (`nav_events`, dal 17/07/2026 al 07/10/2026):

| Evento | Quanti | Tour diversi | Utenti |
|---|---|---|---|
| `nav_start` | 31 | 25 | 2 |
| `nav_abandon` | 21 | 19 | 2 |
| `step_reached` | 10 | 7 | 1 |
| `nav_complete` | 2 | 2 | 1 |

**Utenti:**
- **U1:** esploratore, `is_unlimited`, iscritto il 13/02: 30 sessioni.
- **U2:** esploratore, iscritto il 25/07, il giorno della sua unica navigazione: 1 sessione.
- **Account di prova** (`ai_quota_test_account`): nessuna. Nessuna sessione anonima.

Tratto U1 come **account di sviluppo o prova**: è illimitato, iscritto da mesi, ha 30 sessioni, molte di sera tardi o di notte (00:05, 01:21). È un'assunzione, nell'ultima sezione.

**Le 31 sessioni.** Una sessione va da un `nav_start` al successivo dello stesso utente. «Tappe» sono gli eventi `step_reached` nella sessione. Le ore sono di Roma, arrotondate al minuto.

| # | Utente | Giorno | Tour | Mezzo | GPS | Tappe | Fine | Minuti | Causa più probabile |
|---|---|---|---|---|---|---|---|---|---|
| 1 | U1 | 17/07 15:33 | Per Te cibo | a piedi | negato | 0 | abbandono a 0 | 0,4 | A prova |
| 2 | U1 | 17/07 15:35 | Per Te cibo | a piedi | negato | 0 | nessuna | — | B nessun evento di fine |
| 3 | U1 | 17/07 20:39 | Per Te insider | a piedi | ok | 0 | nessuna (ripartita) | — | B ripartita dopo 30 s |
| 4 | U1 | 17/07 20:39 | Per Te insider | a piedi | negato | 0 | abbandono a 0 | 0,1 | A prova |
| 5 | U1 | 17/07 21:18 | Crea | a piedi | negato | 2 | nessuna (ripartita) | — | B ripartita dopo 7 min |
| 6 | U1 | 17/07 21:25 | Crea | a piedi | negato | 1 | nessuna | — | B nessun evento di fine |
| 7 | U1 | 18/07 09:14 | notifica | a piedi | ok | 1 | **completata** | 5,6 | E completata |
| 8 | U1 | 19/07 10:42 | Crea | a piedi | ok | 0 | nessuna (ripartita) | — | B ripartita dopo 2 min |
| 9 | U1 | 19/07 10:45 | Crea | a piedi | ok | 1 (la tappa 4) | abbandono a 1 | 0,2 | D una tappa sola |
| 10 | U1 | 19/07 11:19 | Per Te insider | a piedi | ok | 1 | **completata** | 12,4 | E completata |
| 11 | U1 | 19/07 11:44 | Per Te cibo | a piedi | ok | 0 | abbandono a 0 | 0,5 | A prova |
| 12 | U1 | 20/07 10:58 | Crea | auto | ok | 0 | nessuna (ripartita) | — | B ripartita dopo 1 min |
| 13 | U1 | 20/07 10:59 | Crea | auto | ok | 0 | abbandono a 0 | 5,8 | C tentativo vero |
| 14 | U1 | 20/07 11:11 | Crea | auto | ok | 2 | abbandono a 2 | 5,9 | C tentativo vero |
| 15 | U1 | 22/07 21:47 | Sorprendimi | a piedi | ok | 0 | abbandono a 0 | 0,4 | A prova |
| 16 | U1 | 22/07 21:47 | Sorprendimi | a piedi | ok | 0 | abbandono a 0 | 0,1 | A prova |
| 17 | U1 | 22/07 21:49 | Per Te insider | a piedi | ok | 0 | abbandono a 0 | 0,1 | A prova |
| 18 | U1 | 23/07 08:06 | Crea | a piedi | ok | 1 | abbandono a 1 | 25,4 | C tentativo vero |
| 19 | **U2** | 25/07 20:30 | Crea | a piedi | ok | 0 | abbandono a 0 | 15,8 | C tentativo vero (utente) |
| 20 | U1 | 14/08 14:43 | Crea | a piedi | ok | 0 | nessuna | — | B nessun evento di fine |
| 21 | U1 | 15/08 15:37 | Crea | a piedi | ok | 0 | abbandono a 0 | 0,3 | A prova |
| 22 | U1 | 15/08 15:37 | Crea | a piedi | ok | 0 | abbandono a 0 | 0,1 | A prova |
| 23 | U1 | 15/08 18:42 | Crea | a piedi | ok | 0 | abbandono a 0 | 0,3 | A prova |
| 24 | U1 | 16/08 21:25 | Crea | a piedi | ok | 0 | abbandono a 0 | 0,1 | A prova |
| 25 | U1 | 20/08 00:05 | Crea | auto | ok | 1 (dopo 3 s) | abbandono a 1 | 0,2 | D una tappa sola |
| 26 | U1 | 22/08 00:22 | Sorprendimi | a piedi | ok | 0 | nessuna | — | B nessun evento di fine |
| 27 | U1 | 01/09 21:44 | Per Te insider | a piedi | ok | 0 | abbandono a 0 | 1,1 | A prova |
| 28 | U1 | 03/09 20:16 | Crea | a piedi | ok | 0 | abbandono a 0 | 0,1 | A prova |
| 29 | U1 | 24/09 01:21 | Crea | a piedi | ok | 0 | abbandono a 0 | 0,3 | A prova |
| 30 | U1 | 06/10 20:58 | Crea | a piedi | ok | 0 | abbandono a 0 | 0,3 | A prova |
| 31 | U1 | 07/10 11:33 | Sorprendimi | a piedi | ok | 0 | abbandono a 0 | 0,3 | A prova |

«Tour» è il tipo, letto dal prefisso dell'id: `home-food` = Per Te cibo, `home-insider` = Per Te insider, `ai-quiz`/`ai-itinerary` = Crea, `surprise` = Sorprendimi, `notif-tour` = notifica.

**Tappa n su N:** il database registra le tappe raggiunte, **non quante tappe aveva il tour**. Il «su N» non si può dire per nessuna sessione.

**Dispositivo e browser:** `nav_events` non li registra. L'unico errore di U1 in `error_logs` viene da un Mac con Chrome, ma non è durante una navigazione.

**Errori registrati durante le navigazioni:** nessuno. L'unica riga di `error_logs` (30/08) cade nella finestra della sessione 26 (aperta il 22/08, mai chiusa), ma è un errore della pagina del profilo, non della mappa.

**Cosa il database NON registra:**
- quante tappe ha il tour;
- dispositivo, browser, sistema;
- la chiusura o la ricarica della pagina, il ritorno indietro, il passaggio in background;
- la perdita del GPS durante la navigazione, la precisione, il permesso negato dopo l'avvio;
- la rete che cade, e gli eventi persi per questo (l'invio è «spara e dimentica»: senza rete l'evento si perde);
- gli errori del percorso (Directions);
- se la navigazione era verso una tappa sola o tutto il giro;
- come è stata raggiunta una tappa (geofence o «Sono arrivato»);
- gli errori fuori dal disegno della pagina: nessun `window.onerror` né `unhandledrejection`;
- la versione dell'app.

## 3) Le cause

| Causa | Sessioni | Quante | Prova |
|---|---|---|---|
| **A — prova o chiusura volontaria subito** | 1, 4, 11, 15, 16, 17, 21, 22, 23, 24, 27, 28, 29, 30, 31 | 15 | «Fine» premuto entro 4–66 s, a 0 tappe, tutte dall'account U1. In 2 casi l'utente riparte entro un minuto sullo stesso tour (15→16, 21→22). Il codice registra `nav_abandon` solo dal tasto «Fine», quindi è una scelta dell'utente, non un blocco |
| **B — nessun evento di fine** | 2, 3, 5, 6, 8, 12, 20, 26 | 8 | Nessun `nav_abandon` né `nav_complete`. In 4 casi (3, 5, 8, 12) arriva un nuovo `nav_start` entro 7 minuti, quindi la navigazione è stata lasciata senza «Fine» e rifatta. Il codice non registra la chiusura della pagina né lo smontaggio. Causa vera non determinabile: pagina chiusa, ricaricata, indietro, o iOS che scarica la scheda |
| **C — tentativo vero interrotto** | 13, 14, 18, 19 | 4 | Durata da 5,8 a 25,4 minuti. 13 e 14 in auto: 0 e 2 tappe. 18 a piedi: 1 tappa in 25 minuti. **19 è l'unico utente vero: 16 minuti a piedi, nessuna tappa.** Il GPS c'era all'avvio (nessun `gps_denied`). Senza tracce di posizione non si sa se la prima tappa era lontana, se il geofence non è scattato (schermo bloccato, tappa superata, sezione 4) o se l'utente ha rinunciato |
| **D — navigazione verso una tappa sola contata come abbandono** | 9, 25 | 2 | In 9 la tappa raggiunta ha `step_index` 3 (la quarta del tour) dopo 9 secondi, poi «Fine»: è un «Naviga» verso una tappa precisa, o «Sono arrivato». In 25 la tappa scatta dopo 3 s (eri già lì: prima tappa della sessione), poi «Fine». Il codice dice `nav_complete` solo se le tappe fatte sono quante quelle del giro intero: una navigazione verso una tappa sola **non è mai completa** |
| **E — completate** | 7, 10 | 2 | `nav_complete` dopo una tappa sola: tour di una tappa, oppure il conteggio delle tappe (`activeRoute`) era 1. Non verificabile: N non è registrato |
| **GPS negato** | 1, 2, 4, 5, 6 | 5 (tutte il 17/07) | `gps_denied: true` (rifiuto, oppure primo fix oltre 5 s). Sono tutte sessioni di prova del primo giorno della telemetria |
| **Errore o blocco tecnico registrato** | — | 0 | Nessun errore registrato in nessuna sessione. Ma il database non registra gli errori del GPS né quelli fuori dal disegno, quindi «0» vuol dire «non visto», non «non successo» |
| **Tappa chiusa o irraggiungibile** | — | non determinabile | Nessun dato |

**Lettura.**
- Sui dati di oggi la navigazione **non è misurabile come prodotto**: 1 sessione di un utente vero, 30 di prova.
- Il 68% di «abbandoni» è soprattutto il tasto «Fine» premuto subito dopo l'avvio, mentre si prova l'app.
- I 4 tentativi veri finiscono tutti presto (0–2 tappe), e in nessuno il dato dice perché.

## 4) I punti di blocco nel codice

| # | Dove | Cosa succede | Effetto per chi cammina |
|---|---|---|---|
| **B1** | `MapPage.jsx:1074-1361` | All'avvio `getCurrentPosition` ad alta precisione con **5 s di attesa massima**. Se fallisce (anche solo perché il primo fix arriva dopo 5 s), il ramo d'errore **non avvia il `watchPosition` della navigazione**, e nessuno lo riprova più | Nessuna tappa si sblocca da sola per tutta la navigazione; nessuna distanza live; la camera non segue. Il messaggio dice «poi ti raggiungeremo appena il segnale c'è», ma non succede. Il pallino blu si muove lo stesso (watch di sfondo, `:468`), quindi sembra che funzioni |
| **B2** | stato solo in memoria (`:353`, `:482`, ref `:488-519`) | Ricaricare, chiudere, tornare indietro, o **iOS che scarica la scheda in background** cancella `isNavigating`, le tappe fatte e il cronometro. Il tour resta (`location.state` sopravvive a una ricarica), la navigazione no | Al ritorno la mappa mostra il tour fermo. Si deve premere di nuovo «Avvia» e si riparte dalla prima tappa: quelle già fatte vanno rifatte o sbloccate a mano. Nessun evento registrato |
| **B3** | nessun Wake Lock (non c'è in tutto `src`) | Lo schermo si blocca secondo le impostazioni del telefono. Con lo schermo bloccato Safari sospende la pagina e il `watchPosition` | Se passi accanto alla tappa a telefono bloccato, al risveglio sei già oltre. La tappa era «armata» ma non scatta più, perché ora sei fuori dalla soglia. La navigazione resta su quella tappa e l'unica uscita è «Sono arrivato» |
| **B4** | «Sono arrivato» (`POIDetailDrawer.jsx:275`) | Sta solo dentro la scheda della tappa, che si apre toccando il segnaposto. L'HUD (`NavigationHUD.jsx`) ha voce, ricentra e «Fine», ma non «Sono arrivato» né «Salta» | Chi non sa di dover toccare la tappa sulla mappa resta bloccato su una tappa che il GPS non sblocca (B1, B3) e l'unica cosa visibile è «Fine». Plausibile per la sessione 19 |
| **B5** | `watchPosition` della navigazione, errore (`:1320`) | Un errore (timeout 15 s, posizione non disponibile, permesso tolto) va solo in `console.warn` | Nessun messaggio; l'HUD tiene l'ultima distanza come se fosse vera |
| **B6** | `isOffline` (`:611`, `:634-641`) | La rete è controllata (`online`/`offline`), ma `isOffline` **non è usato da nessuna parte** nel disegno | Senza rete nessun messaggio; la mappa e il percorso smettono di aggiornarsi in silenzio; gli eventi di telemetria si perdono |
| **B7** | errore del percorso (`useTourRouting.js:141`, `NavigationHUD.jsx:132`) | Lo stato di Google Directions finisce nell'HUD così com'è | A schermo compare un codice inglese (`ZERO_RESULTS`, `OVER_QUERY_LIMIT`…), contro la regola TESTI |
| **B8** | nessun limite di tempo su `directionsService.route` (`useTourRouting.js:113`) | Se la risposta non arriva, il percorso resta vuoto senza errore | HUD su «→ Prossima tappa» senza istruzioni; rischio basso (la libreria di Google di solito risponde) |
| **B9** | la fine del giro (`:1417-1429`) | All'ultima tappa: latch, stop del GPS e riepilogo, ma `nav_complete` parte solo dal tasto «Fine» | Chi chiude dal riepilogo o lascia la pagina conta come «nessun evento di fine», non come completato |
| **B10** | `step_index` (`:1380`, `:989`) | Nel `step_reached` è la posizione della tappa nel tour (`poiObj.index`); nel `nav_abandon` è il numero di tappe fatte | I due numeri non si confrontano (sessione 9: tappa 4 raggiunta, abbandono «a 1») |
| **B11** | errori fuori dal disegno | `reportError` è chiamato solo da `ErrorBoundary`; nessun gestore globale | Un errore in un callback del GPS, in un timer o in un tocco non lascia traccia: per questo `error_logs` ha 1 riga |
| **B12** | voce (`speechSynthesis`) | Su iOS la sintesi vocale parla solo dopo un gesto dell'utente; non c'è nessun controllo | La voce può restare muta senza che nessuno lo sappia (non blocca, ma l'utente aspetta istruzioni) |

Cosa invece è già protetto:
- l'attesa del primo GPS all'apertura della mappa ha un tetto duro di 8 s (`:441`);
- il GPS si ferma allo smontaggio (`:634-643`);
- la telemetria non blocca mai la navigazione (`navTelemetry.js`);
- il geofence non sblocca a catena le tappe vicine da fermo («arm-then-fire»);
- un permesso negato all'avvio ha il suo messaggio.

## 5) Il comportamento su iPhone (dal codice, non provato su un telefono)

| Situazione | Cosa fa il codice | Cosa vede l'utente |
|---|---|---|
| **App in background** (altra app, Home) | Safari sospende la pagina: niente `watchPosition`, niente timer. Nessun ascoltatore di `visibilitychange` per la navigazione (c'è solo quello del registro di debug, spento) | Al ritorno, se la pagina è ancora in memoria, il GPS riprende e la navigazione continua; le tappe passate intanto non scattano (B3). Se iOS ha scaricato la scheda, la navigazione è persa (B2) |
| **Schermo bloccato** | Come sopra; nessun Wake Lock per tenerlo acceso | Chi cammina col telefono in tasca non ha sblocchi automatici; al risveglio può trovarsi «dopo» la tappa (B3) |
| **Posizione negata all'avvio** | Messaggio «Posizione non condivisa. Partiamo dalla prima tappa del tour.»; nessun tracciamento (B1) | La navigazione c'è ma non segue; le tappe si sbloccano solo con «Sono arrivato» dentro la scheda (B4). Nessuna indicazione su come fare |
| **Primo fix lento (oltre 5 s)** | Stesso ramo del permesso negato, con «GPS non disponibile ora… poi ti raggiungeremo» (B1) | Come sopra, ma il messaggio promette un aggancio che non arriva |
| **Posizione imprecisa** (100 m e più, in mezzo ai palazzi) | Soglia = la precisione: con 120 m la tappa scatta a 120 m | Sblocchi in anticipo o, se la precisione migliora vicino alla tappa, nessun problema; nessun messaggio sulla precisione |
| **Permesso tolto durante la navigazione** | Errore nel `watchPosition` → `console.warn` (B5) | Nessun messaggio; distanza ferma |
| **Rete che cade** | Nessun messaggio (B6); Directions fallisce col codice inglese (B7); eventi persi | Mappa e istruzioni ferme; le tappe si sbloccano lo stesso (il geofence è locale, se il GPS c'è) |
| **Ricarica o scheda scaricata** | Stato perso (B2), nessun evento | Tour visibile ma fermo; si riparte da capo |

## 6) Proposte (nessuna applicata), dalla più efficace

1. **Il tracciamento parte sempre.** Se il primo GPS fallisce o tarda, avviare comunque il `watchPosition` della navigazione e tenere il messaggio onesto finché il primo fix arriva. Oggi un fix lento spegne il geofence per tutto il giro (B1).
   - **Effetto:** alto, ogni avvio al chiuso o a freddo su iPhone.
   - **Rischio:** basso; un po' più di batteria.
2. **Ripresa dopo ricarica o chiusura.** Salvare in `sessionStorage` (o `localStorage` con una scadenza di qualche ora) tour, tappe fatte, bersaglio e ora d'avvio; al ritorno su `/map` proporre «Riprendi il giro dalla tappa n» (B2).
   - **Effetto:** alto su iPhone, dove la scheda viene scaricata spesso.
   - **Rischio:** riprendere un giro vecchio o di un altro giorno, da limitare con la scadenza e con lo stesso id del tour.
3. **Tappa superata e «Sono arrivato» nell'HUD.**
   - Un tasto «Sono arrivato» e uno «Salta» nella barra in navigazione, non solo nella scheda (B4).
   - Una regola per la tappa superata: dopo un periodo senza posizione, se ora sei più vicino alla tappa dopo, chiedere conferma invece di restare fermi (B3).
   - **Effetto:** alto per chi tiene il telefono in tasca.
   - **Rischio:** sblocchi sbagliati, se la regola è automatica: meglio chiedere.
4. **Schermo acceso durante la navigazione** (Screen Wake Lock, dove il browser lo offre; riattivarlo al ritorno in primo piano) (B3).
   - **Effetto:** medio.
   - **Rischio:** batteria; l'utente deve poterlo spegnere.
5. **Mai un blocco senza messaggio** (B5, B6, B7): GPS perso da più di 30 s, rete assente, errore del percorso in italiano.
   - **Effetto:** medio; più fiducia, meno «Fine» a vuoto.
   - **Rischio:** testi nuovi, da far approvare a Ivano (regola TESTI).
6. **Telemetria che dice perché** (B9, B10, B11):
   - un evento di fine anche senza «Fine» (`pagehide` o `visibilitychange` con `fetch` `keepalive`), con il motivo;
   - nel `nav_start` il numero di tappe, il tipo (giro o tappa sola), il browser e il sistema in forma ridotta (es. «iOS 18, Safari»);
   - gli errori del GPS (codice, non la posizione);
   - come è stata raggiunta ogni tappa (geofence o a mano);
   - `nav_complete` quando l'ultima tappa scatta;
   - lo stesso significato di `step_index` in tutti gli eventi;
   - un gestore globale degli errori verso `error_logs`.
   - **Effetto:** nessuno per l'utente, decisivo per misurare.
   - **Rischio:** privacy: mai posizioni, mai id in chiaro nei report; migrazione non necessaria (`context` è JSON libero).
7. **Navigazione verso una tappa sola**: «completata» quando la tappa è raggiunta, e contata a parte (sessioni 9, 25).
   - **Effetto:** solo misura.
   - **Rischio:** nessuno.
8. **Separare le prove dagli utenti** nei numeri: escludere l'account di sviluppo e quello di prova, oppure una colonna o etichetta come per le generazioni.
   - **Effetto:** solo misura.
   - **Rischio:** decidere quali account sono «prova» (decisione di Ivano).

## 7) La voce «Navigazione» proposta per l'asticella

Le misure da utente valgono solo su navigazioni di utenti veri (senza account di prova e di sviluppo) **durate più di 2 minuti**, con almeno 20 sessioni nel periodo; sotto le 20 la voce è «non misurabile», non verde.

| # | Voce | Come si misura | Soglia |
|---|---|---|---|
| N1 | **Giri completati** | `nav_complete` (giro intero) ÷ navigazioni di giro intero durate più di 2 minuti | ≥ 50% (verde), 30–50% (giallo), < 30% (rosso) |
| N2 | **Fine registrata** | navigazioni con un evento di fine (completa, «Fine», pagina chiusa) ÷ `nav_start` | ≥ 95% |
| N3 | **Ripresa dopo ricarica** | prova automatica (test) + prova su iPhone: ricarica a metà giro → «Riprendi» riporta alla stessa tappa, con le tappe fatte | 100% (sì/no) |
| N4 | **Ripresa dopo blocco schermo** | prova su iPhone: 5 minuti a schermo bloccato camminando, al risveglio posizione aggiornata entro 10 s e, se la tappa è stata superata, la domanda «Sei già passato da…?» | sì/no |
| N5 | **Mai un blocco senza messaggio** | test: GPS negato, primo fix oltre 5 s, GPS perso 30 s, rete assente, percorso in errore → ognuno ha un messaggio italiano approvato entro 10 s; e in produzione 0 errori non gestiti in `error_logs` nelle sessioni di navigazione | 5 su 5, 0 errori |
| N6 | **Il tracciamento non si spegne** | test: con il primo fix in errore, il `watchPosition` della navigazione è attivo e la prima tappa si sblocca quando la posizione arriva | sì/no |
| N7 | **Tappe raggiunte** | mediana delle tappe raggiunte ÷ tappe del giro, sulle navigazioni di giro intero | ≥ 60% |

N1, N2 e N7 richiedono prima la telemetria della proposta 6 (numero di tappe, evento di fine, prove separate). N3–N6 sono test e prove su telefono, e si possono scrivere subito.

## 8) Stato

- Ramo `nav-diagnosi`, commit del solo report, pubblicato su GitHub.
- Nessuna modifica al codice, nessuna migrazione, nessuna scrittura sul database (solo `SELECT`), nessun deploy, 0 $.

## Cosa ho dato per vero senza verificarlo

1. **U1 è l'account di sviluppo o di prova di Ivano.** Lo deduco da `is_unlimited`, dall'iscrizione di febbraio, dalle 30 sessioni e dagli orari. Non l'ho confrontato con nessun elenco di account interni, e non ho guardato la sua email (privacy).
2. **Il comportamento su iPhone** (pagina sospesa con lo schermo bloccato, scheda scaricata in background, voce solo dopo un gesto) viene da come funziona Safari su iOS, non da una prova: in questo task nessun telefono.
3. **B1 (primo fix oltre 5 s) succede spesso su iPhone.** Il codice lo rende possibile; quanto spesso non lo so. Il registro di debug lo direbbe, ma vive solo nel `localStorage` del telefono.
4. **La causa C (tentativi veri)** non ha prove: senza posizioni né errori registrati non posso dire se la tappa era lontana, se il geofence non è scattato o se l'utente ha rinunciato.
5. **Le sessioni senza evento di fine (B)** le attribuisco a pagina chiusa, ricaricata o lasciata, perché il codice non registra altro. Potrebbero anche essere eventi persi senza rete.
6. **«Tappa n su N»:** il totale delle tappe non è nel database. Le sessioni 7 e 10 «completate» con una tappa le leggo come giri di una tappa, o con `activeRoute` di lunghezza 1, senza poterlo verificare.
7. **I tipi di tour** li leggo dal prefisso dell'id (`home-food`, `ai-quiz`…): è una convenzione del codice, non un campo del database.
8. **Il ramo di `isOffline`** l'ho cercato con la ricerca nel file: non compare nel disegno. Non ho aperto la pagina senza rete.
