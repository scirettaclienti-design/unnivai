# DoveVai – Analisi funzionalità dell’app (dettagliata)  
*Documento di riferimento per estrarre descrizioni evocative e narrative*

---

## Cos’è DoveVai e a chi si rivolge

**DoveVai** è un’applicazione mobile-first che mette in relazione viaggiatori e guide locali in Italia. L’obiettivo è far vivere l’Italia “con gli occhi di chi ci vive”: non solo monumenti, ma esperienze guidate da persone del posto, itinerari costruiti su misura (anche con intelligenza artificiale) e tour che si possono prenotare con pochi tap. Gli utenti possono esplorare tour, richiedere una guida per un’esperienza specifica, generare percorsi personalizzati (Itinerario AI o Quiz Veloce) e visualizzare tutto su una mappa interattiva. Le guide hanno una propria area in cui creare e pubblicare tour, ricevere richieste in tempo reale, accettare o declinare, contattare il viaggiatore e proporre un prezzo. Esiste anche un ruolo Business per attività (ristoranti, hotel, negozi) che compaiono sulla mappa vicino ai percorsi dei tour. L’app usa autenticazione (email/password), ruoli (utente, guida, business) e un database in cloud (Supabase) per tour, richieste e profili.

---

## All’apertura dell’app: primo impatto e ingresso

- **Utente non loggato**  
  All’apertura viene mostrata la **Landing** (pagina di benvenuto). Contiene una presentazione visiva dell’app: hero con messaggio sul vivere l’Italia in modo autentico, anteprime a forma di smartphone che mostrano flussi (città e mappa, itinerario, chat con guida, navigazione), elenco di città (Roma, Venezia, Firenze, Napoli, Milano), e call-to-action per esplorare o accedere. L’atmosfera è da prodotto turistico moderno e curato. Non c’è obbligo di login per vedere la landing; per usare le funzioni principali (dashboard, richieste, profilo) serve il login.

- **Utente già loggato**  
  Dopo il login (o se la sessione è già attiva), l’app non mostra la landing ma reindirizza subito alla **dashboard** appropriata al ruolo: utente/esploratore → Dashboard utente (home con Crea tour, Guide Locali, Itinerario AI, Quiz Veloce, Esperienze Uniche); guida → Dashboard guida (tab Richieste Live, I Miei Tour, Profilo); business → Dashboard business. Il reindirizzamento è automatico e immediato, così l’utente si ritrova nella sua “casa” nell’app.

- **Login e recupero password**  
  La pagina **Login** permette l’accesso con email e password; sono presenti link per recupero password. Dopo il recupero (link magico o flusso dedicato), l’utente può essere portato alla pagina **Update Password** per impostare una nuova password e poi rientrare nel flusso normale. L’esperienza è lineare: inserisci credenziali → entri nella tua dashboard.

---

## Ruoli: chi fa cosa nell’app

L’app distingue tre ruoli, ognuno con una dashboard e un set di funzioni dedicate:

1. **Utente (Esploratore)**  
   È il viaggiatore che cerca esperienze, tour guidati e itinerari. Può sfogliare tour in Esplora e in Home (Esperienze Uniche), aprire la scheda dettaglio di ogni tour, richiedere una guida compilando data e numero di persone, usare Itinerario AI e Quiz Veloce per generare percorsi su misura, vedere i percorsi sulla Mappa, gestire preferiti, notifiche, profilo e foto, e candidarsi come guida dalla pagina Diventa guida.

2. **Guida**  
   È chi crea e pubblica tour (Tour Builder), li rende “live” così che compaiano in Esplora e nelle liste utente, e riceve le richieste inviate dagli utenti dalla scheda tour. Nella dashboard guida vede le Richieste Live (nome utente, città, messaggio, data/ora), può accettare, declinare, contattare l’utente o proporre un prezzo. Può anche modificare i tour esistenti da “I Miei Tour” e gestire il proprio profilo (bio, città operative, accreditamento).

3. **Business**  
   Rappresenta un’attività (ristorante, hotel, negozio, ecc.) con una dashboard dedicata. L’attività può essere mostrata sulla Mappa come punto vicino ai percorsi dei tour, in base a tag/categorie, per offrire suggerimenti lungo il percorso (dove mangiare, dove fare una pausa, ecc.). Il livello di dettaglio delle funzioni business dipende dall’implementazione backend e UI.

---

## Funzionalità per l’utente (Esploratore) – Dettaglio

### 1. Dashboard utente (Home dell’app)

**Scopo:** essere la “casa” dell’utente dopo il login: da qui parte ogni azione (cercare guide, creare un percorso, farsi ispirare da un quiz, sfogliare esperienze).

**Layout e elementi visivi:**  
In alto c’è una **TopBar** con icona del brand (montagna), saluto personalizzato (“Ciao, [nome]!”), sotto il saluto la **città** corrente e la **temperatura** in °C (es. “Roma – 24°C”). Accanto alla città c’è una piccola icona per **cambiare città** (si apre un modale con ricerca/elenco città). A destra nella TopBar: icona **notifiche** (con badge se ci sono nuove), icona **messaggi**, icona **logout**.  
Sotto la TopBar inizia il contenuto principale. Il primo blocco è un **box espandibile** con titolo “Crea il tuo Tour” e sottotitolo “Su misura per te”, con icona bussola. Toccare il box lo espande e mostra due opzioni in una griglia: **“Con Guida”** (trova un esperto locale) e **“Sorprendimi”** (esperienza a sorpresa). Ogni opzione ha icona e breve testo esplicativo.

Seguono **tre grandi card/button** in verticale, stilizzati come “vetro” (glass) con gradienti di colore:
- **Guide Locali** – Card con gradiente terracotta/rosso, badge “LIVE NEW”, icona persone, titolo “Guide Locali”, sottotitolo “Esplora con esperti del posto”. Porta a **Esplora** (lista tour).
- **Crea il tuo Percorso** – Card verde/smeraldo, badge “Gratis & Su Misura”, icona cervello (AI), titolo “Crea il tuo Percorso”, sottotitolo “Intelligenza artificiale per te”. Porta a **Itinerario AI**.
- **Quiz Veloce** – Card ambra/arancione, badge “AI Powered”, icona gamepad/documento, titolo “Quiz Veloce”, sottotitolo “Scopri il tuo stile di viaggio”. Porta a **Quick Path** (Percorso veloce).

Sotto le tre card c’è la sezione **“Esperienze Uniche”**: titolo a sinistra e link “Vedi tutte” a destra (porta a Esplora). Poi un **carousel orizzontale** di card: ogni card è un’esperienza/tour con immagine a tutta larghezza, overlay scuro in basso, stella con rating, categoria, titolo del tour, durata e prezzo in euro. Toccare una card apre la **scheda Dettaglio tour** per quell’esperienza (con passaggio dei dati del tour nello stato di navigazione). Le esperienze mostrate dipendono dalla città selezionata e dai dati in database (o da dati demo se non ci sono tour live).

In fondo alla pagina c’è la **navigazione inferiore (Bottom Navigation)** fissa: quattro voci – **Home** (dashboard attuale), **Esplora**, **Foto**, **Profilo**. La voce attiva è evidenziata (colore terracotta e leggero glow). Questa barra è presente su tutte le pagine principali dell’utente e permette di spostarsi rapidamente tra le quattro aree.

---

### 2. Esplora

**Scopo:** scoprire tutti i tour/esperienze disponibili (per la città scelta o in generale), filtrarli e aprirne i dettagli.

**Layout e elementi visivi:**  
In alto, sotto la TopBar, c’è un link “Torna alla Home” e il titolo “Esplora” con sottotitolo contestuale (es. “Le migliori esperienze a Roma” o “Le migliori esperienze autentiche in Italia”).  
Poi un **campo di ricerca** con icona lente e placeholder tipo “Cerca attività, luoghi, categorie…”. Il testo digitato filtra l’elenco in tempo reale (titolo, luogo, categoria).  
Sono presenti **filtri** per categoria (Tutti, Gastronomia, Cultura, Natura, Arte, Romantico, ecc.) e un selettore per **data** (per filtrare per disponibilità in base al giorno della settimana).  
L’**elenco** delle esperienze è una griglia o lista di card: ogni card mostra immagine, rating con stella, eventuale distanza (es. “2.1 km”), titolo, categoria, durata, prezzo; c’è un’icona cuore per aggiungere/rimuovere dai preferiti (salvati in locale). Le card sono cliccabili: tap apre la **scheda Dettaglio tour** con l’id del tour e i dati passati nello stato (così la scheda può mostrare subito titolo, guida, città, ecc.). I dati delle esperienze provengono dal database (tour con is_live true, eventualmente filtrati per città) e includono guide_id e città per far funzionare “Richiedi Guida”; se non ci sono tour in DB vengono usate esperienze demo per la città.

---

### 3. Dettaglio tour (Scheda tour)

**Scopo:** mostrare tutto ciò che serve per decidere se partecipare a un tour e per richiedere la guida o avviare l’itinerario.

**Layout e elementi visivi:**  
In alto: pulsante indietro e eventuale TopBar. Sotto, **immagine hero** del tour (a tutta larghezza) con eventuale **badge** sovrapposto (es. “Tour Guidato”).  
Poi **titolo** del tour e sottotitolo (es. “Tour del quartiere”).  
Sezione **info rapide**: numero massimo di persone (es. “Max 10 Pers”), lingua (es. “Italiano” con toggle), città (“Dove: Roma”), durata (es. “2 ore”), partecipanti (es. “0/10”), disponibilità (es. “Sempre disponibile”).  
Sezione **“La tua guida”**: nome della guida (es. “Guida locale” o nome reale se caricato dal profilo), rating (es. 4.8), due pulsanti affiancati – **“Profilo”** (apre modale con bio e info della guida) e **“Chat”** (apre modale chat con la guida). La guida mostrata è quella che ha pubblicato il tour (profilo caricato da DB se disponibile).

**Programma del tour:** elenco delle **tappe** (Tappa 1, 2, 3, …) con numero, icona pin, titolo/descrizione breve.  
**Mappatura:** testo tipo “Percorso completo sulla mappa interattiva” e pulsante **“Guarda la Mappa”** che porta alla pagina **Mappa** con il percorso di quel tour (tappe e eventuali partner lungo il percorso).  
**Incluso / Non incluso:** due liste con icona check e minus (verde/rosso): cosa è incluso (es. itinerario digitale, supporto 24/7) e cosa no (es. biglietti se non specificati).

**Pulsante principale (CTA)** in basso:  
- Se il tour è un **tour con guida** (tipo guide, non AI né self-guided): il pulsante è **“Richiedi Guida”** con sottotitolo “Invia una richiesta non vincolante alla guida”. Al tap si apre un **modale** (“Contatta [nome guida]”) con titolo “Richiedi disponibilità per [titolo tour]” e form: **Data desiderata** (date picker), **Numero persone** (numero), **Messaggio (opzionale)** (textarea). Pulsanti “Invia Richiesta” e “Annulla”. Durante l’invio il pulsante mostra “Invio in corso…” e si disabilita. Se il tour non ha una guida associata (dati mancanti) viene mostrato un messaggio di errore nel modale (box rosso); se l’invio va a buon fine appare un box verde di conferma e il modale si chiude dopo un paio di secondi. La richiesta viene salvata nel database (tabella guide_requests) con user_id, guide_id, tour_id, testo, città, nome utente, status “open” e arriva nella sezione **Richieste Live** della dashboard della guida.  
- Per altri tour (es. self-guided o generati da AI): il pulsante può essere **“Avvia Itinerario”** con testo che spiega che si avvierà la navigazione o l’itinerario sulla mappa.

Sulla scheda possono essere presenti anche **partner nelle vicinanze** (business) e link per approfondire. L’esperienza è pensata per essere chiara: l’utente capisce subito chi è la guida, cosa include il tour e come richiederla.

---

### 4. Crea il tuo Percorso (Itinerario AI)

**Scopo:** costruire un itinerario personalizzato con l’aiuto dell’intelligenza artificiale, in base a preferenze esplicite (budget, durata, interessi, gruppo, ritmo).

**Flusso:**  
L’utente arriva dalla Dashboard tramite la card “Crea il tuo Percorso”. La pagina mostra un flusso a **step**.  
**Step 1 – Preferenze:** l’utente compila o seleziona: **Budget** (Economico, Medio, Lusso), **Durata** (Mezza giornata, 1 giorno, 2–3 giorni), **Interessi** (Arte, Cibo, Storia, Natura, Shopping, Vita notturna – multiselezione), **Gruppo** (Solo, Coppia, Famiglia, Amici), **Ritmo** (Rilassato, Attivo, Intenso). Ogni blocco ha icona ed emoji per renderlo riconoscibile.  
**Step 2 – Generazione:** dopo l’invio delle preferenze parte la “generazione” dell’itinerario (chiamata al servizio AI o simulazione). Viene mostrato uno stato di caricamento (animazioni, messaggio tipo “Stiamo creando il tuo itinerario…”).  
**Step 3 – Risultato:** l’itinerario generato è presentato **per giorni** (Day 1, Day 2, …). Per ogni giorno c’è un titolo (es. “Primo giorno – Immersione culturale”), un box **meteo** simulato (condizione, temperatura, icona), e una **timeline di tappe**: orario (es. 09:00, 11:30), titolo della tappa (es. “Duomo di Milano”), descrizione breve, tipo (cultura, food, shopping, relax), luogo, rating e prezzo se applicabili, foto. L’utente può aprire il dettaglio di ogni tappa (modale o pannello). Sono presenti pulsanti per **vedere l’itinerario sulla Mappa** o per aprire un **Dettaglio tour** se una tappa è collegata a un tour. La città usata per la generazione è di solito quella del contesto utente (città selezionata in TopBar).

**Esito:** l’utente ottiene un itinerario strutturato e condivisibile, con possibilità di passare alla Mappa per visualizzare il percorso.

---

### 5. Quiz Veloce (Percorso veloce / Quick Path)

**Scopo:** ottenere un itinerario su misura in pochi tap, attraverso una sequenza di scelte semplici (ambiente, attività, orario, durata, numero persone) e una generazione veloce con fallback in caso di errore.

**Flusso (step numerati, con indicatore di progresso):**  
- **Step 1 – Ambiente principale:** scelta del tipo di contesto (città, natura, mare, montagna, ecc.) con card o pulsanti con immagini/emoji. La scelta influenza le opzioni successive (es. città → attività urbane).  
- **Step 2 – Cosa ti ispira / Attività:** insieme di opzioni dipendenti dalla città/contesto (es. per Roma: Rioni storici, Piazze, Via del Corso, Ville, Lungo il Tevere, Roma imperiale, Street food, Carbonara tour, …). Ogni opzione può avere immagine, titolo, breve descrizione ed emoji. Le immagini hanno fallback in caso di errore di caricamento.  
- **Step 3 – Preferenza oraria:** mattina, pomeriggio, sera (per adattare orari e tipo di tappe).  
- **Step 4 – Durata:** mezza giornata, giornata intera, ecc.  
- **Step 5 – Numero di persone:** per calibrare suggerimenti (es. ristoranti, gruppi).  
- **Step 6 – Generazione:** viene mostrato uno stato di “generazione in corso” (con eventuale timeout di sicurezza, es. 12 secondi). Se la generazione va a buon fine si passa al **Recap**; in caso di errore o timeout viene comunque mostrato un itinerario di fallback (predefinito per quella città) così il flusso non si blocca mai su “Errore generazione”.

**Riepilogo (Recap):**  
- Titolo tipo “Riepilogo”.  
- Blocco **“Le tue scelte”**: riepilogo testuale delle scelte fatte (ambiente, attività, orario, durata, persone).  
- Blocco **“Il tuo itinerario”**: card con **immagine** della città (o generica Italia), **nome città**, icona pin, **badge “N tappe”**, testo breve sul percorso.  
- Pulsanti: **“Vedi mappa”** (navigazione alla pagina Mappa con i dati dell’itinerario e tappe normalizzate) e **“Torna alla home”** (ritorno alla Dashboard utente).  
L’esperienza è pensata per essere rapida, senza blocchi: immagini sempre visibili (fallback), messaggi chiari in caso di errore e sempre un risultato (itinerario reale o fallback) con possibilità di andare subito sulla mappa.

---

### 6. Mappa

**Scopo:** visualizzare il percorso di un tour o di un itinerario generato (Quick Path o Itinerario AI) su una mappa interattiva e scoprire attività/partner nelle vicinanze.

**Layout e elementi visivi:**  
La pagina usa una **mappa Mapbox** a tutto schermo (o in un contenitore principale). Se l’utente arriva da un tour o da Quick Path, il **percorso** (linea che collega le tappe) viene disegnato sulla mappa; i **punti** (tappe) sono marcatori cliccabili.  
È presente una **barra “Avvia tour”** (o simile) per avviare l’itinerario (navigazione o solo visualizzazione). Un **drawer** o pannello laterale mostra l’anteprima del tour (titolo, immagine, breve info) e un link al **Dettaglio tour**.  
I **business/partner** nelle vicinanze del percorso vengono caricati (query per distanza e tag compatibili con il tour) e mostrati come punti sulla mappa; cliccando un punto si può vedere nome, categoria, descrizione. Così l’utente vede non solo il percorso ma anche dove fermarsi (ristoranti, bar, hotel) in base al tipo di tour.  
La mappa supporta zoom, pan e centratura sulla posizione utente o sul percorso. L’integrazione è con i dati tour (coordinate delle tappe) e con la tabella business per i partner.

---

### 7. Tour Live (Guide Locali)

**Scopo:** mostrare l’elenco dei tour “live” (pubblicati da guide reali, spesso con prossima partenza o orario).

**Layout:**  
Lista di **card** tour: ogni card ha immagine, badge “LIVE”, titolo, nome guida, luogo (città/quartiere), durata (es. “90 min”), prezzo (es. “€18”), rating e recensioni, partecipanti attuali/max, orario di partenza o “Prossima partenza” (es. “Tra 2 ore”, “In corso”, “Domani”). Le card sono cliccabili e aprono la **scheda Dettaglio tour**; da lì l’utente può “Richiedi Guida” se è un tour con guida. I dati possono venire dal database (tour con is_live true) o da mock per demo.

---

### 8. Tour a sorpresa (Sorprendimi)

**Scopo:** offrire un’esperienza scelta in modo casuale per la città selezionata, per chi vuole farsi sorprendere senza scegliere.

**Flusso:**  
L’utente arriva dalla Dashboard (box “Crea il tuo Tour” → “Sorprendimi”). La pagina mostra la **città** (dal contesto) e un’**esperienza** scelta casualmente tra un set predefinito per quella città (titolo, categoria, immagine, descrizione, prezzo, durata, tag). Un pulsante **“Scopri”** o “Ancora” permette di ottenere un’altra proposta casuale. Quando l’utente è soddisfatto può aprire il **Dettaglio tour** dell’esperienza o andare alla **Mappa**. Le immagini sono adattate alla città e alla categoria (cibo, arte, natura, vista) per evitare immagini generiche fuori contesto.

---

### 9. Trending

**Scopo:** mostrare le esperienze “in tendenza” (più prenotate o popolari) per dare idee e creare urgenza.

**Layout:**  
Titolo “Trending” o simile, eventuali **filtri** (categoria, ordine). **Card** per ogni esperienza: immagine, titolo, descrizione breve, luogo, prezzo, rating, numero recensioni, **trend score** (es. 98, 95) o badge (Best Seller, Esclusivo), host/organizzatore. Tap su una card → **Dettaglio tour**. I dati possono essere ordinati per punteggio di tendenza (reale o simulato).

---

### 10. Notifiche

**Scopo:** centralizzare raccomandazioni, avvisi meteo e inviti social (es. invito a un tour di gruppo).

**Layout:**  
Lista di **notifiche** con icona, titolo, messaggio breve, eventuale immagine, ora (“10 min fa”, “Oggi”, “4 ore fa”), stato letto/non letto. **Filtri** per tipo: tutte, tour, meteo, social. Tap su una notifica porta al **Dettaglio tour** (con id eventuale in query, es. mode=group) o alla pagina pertinente. Le notifiche possono essere costruite in base alla città e alla temperatura del contesto (es. “Sole e 24°C a Roma – Ideale per il tour…”).

---

### 11. Profilo

**Scopo:** mostrare e modificare i dati dell’utente, le statistiche di utilizzo, lo storico e i preferiti.

**Layout e contenuti:**  
- **Nome** (modificabile), **email** (es. nome@dovevai.it se simulato), **città**.  
- **Statistiche:** tour completati, km percorsi (se disponibili dal backend, es. da tabella explorers).  
- **Storico / Ricordi:** tour associati alle foto caricate dall’utente (query su user_photos con join su tours); ogni elemento mostra tour, città, rating, durata e foto collegate.  
- **Preferiti** e **zone da esplorare** (se implementati).  
- Pulsanti o link per **condividere il profilo** (social, link).  
- Link **“Diventa guida”** che porta alla pagina **Become Guide** (candidatura come guida locale).

---

### 12. Foto

**Scopo:** galleria delle foto dell’utente (caricate durante o dopo i tour).

**Layout:**  
Griglia di **foto** (thumbnail); tap su una foto apre una **vista dettaglio** (full screen o modale) con immagine, eventuale titolo, tag, tour associato. Possono essere presenti azioni (condividi, elimina) e un’opzione di upload. I dati possono venire dalla tabella user_photos collegate ai tour.

---

### 13. Diventa guida (Become Guide)

**Scopo:** permettere a un utente di candidarsi come guida locale inviando i propri dati.

**Flusso:**  
Form con campi: **Nome**, **Cognome**, **Città**, **Email**, **Telefono**, **Esperienza** (testo), **Motivazione** (testo), **Lingue** (multiselezione). Dopo l’invio viene mostrata una **schermata di successo**: icona check verde, titolo “Richiesta Inviata!”, messaggio tipo “Grazie [nome], il nostro team valuterà la tua candidatura come Local Guide. Ti contatteremo presto!” e pulsante “Torna ai Tour” (link a Tour Live). L’effettiva conversione da utente a guida (ruolo e accesso alla dashboard guida) dipende dal backend e dai processi amministrativi.

---

## Funzionalità per la Guida – Dettaglio

### 1. Dashboard guida (struttura)

**Scopo:** essere il centro di controllo per la guida: richieste in arrivo, tour pubblicati, profilo.

**Layout:**  
In alto: **header** con avatar/iniziale, nome della guida (da profilo, es. guides_profile), badge tipo “LOCAL HOST” o “GUIDA PRO”, pulsante **“Crea Tour”** (link al Tour Builder) e icona logout.  
Sotto, **tre tab** orizzontali con sottolineatura animata su quello attivo: **Richieste Live**, **I Miei Tour**, **Profilo**. Il contenuto sotto cambia in base alla tab selezionata.

---

### 2. Richieste Live

**Scopo:** mostrare in tempo reale le richieste inviate dagli utenti dalla scheda tour (“Richiedi Guida”) e permettere alla guida di accettare, declinare, contattare o proporre un prezzo.

**Layout e contenuti:**  
Se non ci sono richieste: messaggio centrato “Nessuna richiesta attiva” con icona e testo “Le richieste per le tue città operative appariranno qui in tempo reale.”.  
Se il database non ha le colonne necessarie per le richieste guida (guide_id, tour_id, request_text, city, user_name): viene mostrato un **box giallo/ambra** con titolo “Configurazione richiesta” e messaggio che invita a eseguire lo script SQL in Supabase (migration guide_requests).  
Se tutto è configurato e ci sono richieste: **lista di card**. Ogni card ha una **barra colorata** in alto (gradiente arancione/terracotta), poi **intestazione** con avatar (iniziale del nome utente), **nome utente**, **categoria** (es. “Tour”), **città** con icona pin, **ora** di creazione della richiesta. Sotto, un **box con il testo della richiesta** (request_text: messaggio dell’utente con data, ospiti, messaggio opzionale). Poi una riga con **durata richiesta** (es. “3 ore richieste”). Pulsanti principali: **“Accetta”** (verde) e **“Declina”** (grigio/rosso). Sotto, due pulsanti secondari: **“Contatta”** (apre modale chat con l’utente) e **“Proponi €”** (apre modale per inserire un prezzo e vedere scomposizione commissione e guadagno netto). Le richieste sono filtrate per guide_id = guida loggata e status “open”; le richieste declinate nella sessione vengono nascoste (ref). Un **canale realtime** (Supabase) è in ascolto sulla tabella guide_requests: quando arriva una nuova riga (o modifica) la lista viene aggiornata senza ricaricare la pagina.

---

### 3. I Miei Tour

**Scopo:** elencare i tour creati dalla guida e permettere di modificarli o crearne di nuovi.

**Layout:**  
Griglia di **card** (una o due colonne). Ogni card mostra **immagine** di copertura (o fallback per città), **città** e **titolo** del tour in overlay, **prezzo** (€), **durata** (minuti), **data di creazione**. In basso a destra il link **“Gestisci”** con freccia. Tap su “Gestisci” → navigazione a **Tour Builder** in modalità modifica (state: tourToEdit con l’oggetto tour). Il pulsante “Crea Tour” in header porta al Tour Builder per un **nuovo** tour. I tour sono caricati dal database (tours dove guide_id = guida loggata).

---

### 4. Tour Builder (Crea / Modifica tour)

**Scopo:** creare un nuovo tour o modificare un tour esistente (titolo, descrizione, città, prezzo, durata, tag, tappe su mappa, immagini) e salvarlo nel database associato alla guida.

**Flusso e campi:**  
- **Step 1 (o form unico):** Titolo, Descrizione, Città (select, es. Roma, Milano, Firenze, Napoli, Venezia), Prezzo (numero), Durata (minuti), Numero massimo partecipanti, Lingua (es. Italiano). **Tag** (multiselezione): Arte, Cultura, Cibo, Natura, Storia, Romantico, Avventura (e altri se presenti).  
- **Tappe su mappa:** una **mappa Mapbox** (centrata sulla città scelta) permette di aggiungere **punti/tappe**: cliccando sulla mappa si aggiunge un marker; ogni tappa ha coordinate (lat/lng), titolo/descrizione. Le tappe possono essere riordinate o eliminate. Le coordinate vengono salvate (es. in un array steps con coordinates per ogni step).  
- **Immagini:** caricamento di una o più immagini (upload o URL) salvate in image_urls.  
- **Salvataggio:** al submit i dati vengono inviati a Supabase (tabella tours) con guide_id = user.id della guida loggata. In modifica (tourToEdit) si aggiorna il tour esistente. Dopo il salvataggio può essere mostrato un toast di conferma e redirect (es. a I Miei Tour). Il tour può essere reso “live” (is_live true) così da comparire in Esplora e nelle liste utente.

**Validazione:** può essere usato uno schema (tourSchema) per validare i passi (presenza coordinate, campi obbligatori) prima del salvataggio.

---

### 5. Profilo guida (tab Profilo)

**Scopo:** gestire bio, accreditamento e città in cui la guida opera.

**Layout e contenuti:**  
- **Bio:** textarea per la biografia (salvata su guides_profile, campo bio).  
- **Accreditamento:** numero di licenza (opzionale), P.IVA (opzionale); stato account (Attivo, Guida certificata / Local Host).  
- **Città operative:** select multiplo o lista di città (es. Roma, Milano, Firenze, …) in cui la guida opera; le richieste possono essere filtrate o etichettate in base a queste città (nell’attuale implementazione le richieste sono mostrate tutte per la guida, senza filtro città).  
- Salvataggio con pulsante “Salva” o simile; i dati vengono aggiornati su guides_profile (Supabase).

---

## Funzionalità per il Business – Cenni

**Scopo:** dare alle attività (ristoranti, hotel, negozi) una dashboard dedicata e visibilità sulla Mappa.

**Elementi:** Dashboard business con gestione del **profilo aziendale** (nome, categoria, descrizione, indirizzo, immagini, tag). Le attività sono memorizzate (es. businesses_profile) con coordinate (location) e category_tags. Sulla **Mappa** utente i business vengono recuperati in base a distanza dal percorso del tour e compatibilità di tag (TAG_MAPPING tra tag tour e tag business) e mostrati come punti cliccabili. Il livello di dettaglio (modifica orari, promozioni, statistiche) dipende dall’implementazione.

---

## Elementi comuni a tutta l’app

- **TopBar:** presente sulle pagine principali; contiene saluto, città (con modale per cambiarla), temperatura, notifiche, messaggi, logout. La città mostrata non deve essere mai in formato “Lat: … Lon: …”; in caso di fallback da geolocalizzazione si usa “Roma” o “Posizione rilevata”.  
- **Bottom Navigation (utente):** Home, Esplora, Foto, Profilo; sempre visibile in basso sulle pagine dell’utente.  
- **Contesto città:** la città effettiva può derivare da scelta manuale (CityContext) o da geolocalizzazione (reverse geocoding); se il reverse geocoding fallisce si evita di mostrare coordinate raw.  
- **Autenticazione:** login con email/password, recupero password, redirect per ruolo dopo login.  
- **Dati e realtime:** tour e richieste su Supabase; le guide ricevono aggiornamenti in tempo reale sulle nuove richieste tramite sottoscrizione alla tabella guide_requests.

---

## Riepilogo per estrazione di testi evocativi

- **Utente:** da una home accogliente con saluto e città parte verso guide locali, percorsi costruiti con AI o un quiz veloce; sfoglia esperienze uniche, esplora con filtri e ricerca, apre schede tour ricche di dettagli e della guida; con un tap richiede la guida (data, persone, messaggio) e la richiesta arriva in tempo reale alla guida; può generare itinerari su misura (step per step o con preferenze) e vedere tutto su una mappa con partner lungo il percorso; gestisce notifiche, profilo, foto e può candidarsi come guida.  
- **Guida:** dalla propria dashboard vede subito le richieste live (nome, città, messaggio, ora), le accetta o declina, contatta l’utente o propone un prezzo; gestisce i propri tour (crea e modifica) con titolo, descrizione, prezzo, tappe su mappa e immagini; definisce bio e città operative nel profilo.  
- **Business:** ha una dashboard e appare sulla mappa come punto di interesse vicino ai percorsi dei tour, per essere scoperto dai viaggiatori lungo il percorso.

Questo documento fornisce il dettaglio necessario per far estrarre in un secondo momento descrizioni più evocative e narrative (copy, presentazioni, storytelling) senza dover rileggere il codice.
