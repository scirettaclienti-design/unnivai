# Unnivai 2025: Rapporto Completo Esperienza Utente (UX) e Comportamento

> **Data:** 27 Gennaio 2026
> **Stato:** Prototipo High-Fidelity (Frontend Avanzato)
> **Obiettivo:** Documento di riferimento per il team AI per il completamento delle funzionalità.

---

## 1. 🌟 Sintesi Esecutiva
Unnivai 2025 si presenta come un'applicazione web **estremamente curata dal punto di vista visivo**, con animazioni fluide e un design system coerente ("Terracotta & Ochre"). L'esperienza "Demo" è eccellente per mostrare le potenzialità interattive (mappe 3D, wizard AI, flussi gamificati), ma **manca la logica funzionale profonda** necessaria per un utilizzo reale.

**Il sito si comporta attualmente come una "Vetrina Interattiva":**
*   ✅ **Visivamente:** Sembra un'app finita e premium.
*   ⚠️ **Funzionalmente:** Molti pulsanti e filtri sono "placeholders" non collegati ai dati.
*   ❌ **Accessibilità:** Non esiste modo per un utente di registrarsi o accedere, rendendo le Dashboard irraggiungibili.

---

## 2. 📍 Analisi Comportamentale dei Flussi

### A. Home Page (Entry Point)
*   **Comportamento:** L'utente viene accolto con un saluto personalizzato (default: "Marco Rossi" o "Ospite") e widget meteo realistici.
*   **Punti di Forza:** I tre pulsanti principali ("Tour Live", "AI Itinerary", "Quick Path") usano animazioni 3D accattivanti che invitano al click.
*   **Criticità:** La sezione "Notifiche" è puramente estetica e non aggiorna lo stato reale.

### B. AI Itinerary (Il "Mago" dei Viaggi)
*   **Comportamento:** Un wizard passo-passo dove l'utente inserisce prompt o tag.
*   **L'Illusione:** L'app simula un caricamento di 3 secondi ("L'AI sta pensando...") e poi mostra un itinerario.
*   **Realtà Tecnica:** L'itinerario generato è un **mock statico** (sempre lo stesso o con variazioni minime casuali).
*   **Problema di Flusso:** Il pulsante "Vedi su Mappa" passa dei dati, ma la mappa non sempre li renderizza correttamente se la città non è "Roma".

### C. Quick Path (Gamification)
*   **Comportamento:** Un flusso rapido a 5 step (Mare/Montagna -> Attività -> Tempo -> etc.).
*   **Feedback:** Eccellente uso di micro-interazioni e confetti finali. È la parte più "divertente" dell'app.
*   **Disconnect:** Il risultato finale porta spesso a una pagina generica o alla mappa, senza "ricordare" le scelte fatte nei filtri successivi.

### D. Esplora & Trending (Discovery)
*   **Comportamento Attuale:**
    *   Le card sono bellissime e animate.
    *   **I Filtri NON Funzionano:** Cliccando su "Gastronomia" o cercando nella barra di ricerca, la lista dei risultati **non cambia**.
    *   **Dati Disconnessi:** La pagina `Explore.jsx` usa dati hardcoded (`sampleExperiences`) diversi da quelli di `Trending.jsx` o `TourLive.jsx`, creando incoerenza (un tour potrebbe esistere in una pagina ma non nell'altra).

### E. Mappa Interattiva
*   **Comportamento:** Mostra una mappa Leaflet con cluster di pin.
*   **Limitazione:** La barra di ricerca e i filtri in alto ("Cibo", "Cultura") sono puramente grafici e inefficaci.

### F. Profilo Utente & Autenticazione
*   **Stato Critico:** Il profilo è statico su "Marco Rossi".
*   **Il Muro:** Non esiste una pagina di Login. Se l'utente prova ad andare su `/dashboard-user` (o Guide/Business), viene reindirizzato alla Home perché il sistema lo vede come "Ospite", ma non offre modo di autenticarsi.

---

## 3. 🛠️ Le 3 Cosa da Chiedere alle AI (Priorità)

Per trasformare questo prototipo in un MVP funzionante, ecco le istruzioni precise da dare alle tue Intelligenze Artificiali:

### 1. "Costruisci il Modulo di Autenticazione" (🔴 Critico)
*   **Problema:** Le Dashboard User/Guide/Business sono inaccessibili.
*   **Richiesta:** Creare una pagina `/login` con un semplice switch "Accedi come Utente/Guida/Business" che imposti lo stato globale `isAuthenticated: true`.
*   **Perché:** Senza questo, il 40% dell'app (la parte gestionale) è invisibile.

### 2. "Collega i Filtri alla Logica" (🟡 Medio)
*   **Problema:** In `Explore.jsx` e `Trending.jsx`, i filtri categories e la barra di ricerca non fanno nulla.
*   **Richiesta:** Aggiornare il codice affinché l'array dei tour venga effettivamente filtrato in base allo stato `activeFilter` e `searchQuery`.

### 3. "Unifica i Dati dei Tour" (🟢 Ottimizzazione)
*   **Problema:** Ogni pagina ha i suoi "dati finti" separati.
*   **Richiesta:** Fare in modo che tutte le pagine (`Explore`, `Trending`, `Map`) attingano dallo stesso `dataService`, così se aggiungo un tour, appare ovunque.

---

## 4. Conclusione
Il sito è un **"Ferrari senza motore"**. La carrozzeria (Frontend) è da premio, gli interni (UX Flows) sono comodi, ma manca il motore (Logica di Filtro e Auth) per portarlo su strada. Con i 3 interventi sopra elencati, diventerà un'applicazione perfettamente funzionante.
