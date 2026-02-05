# 📉 Rapporto di Allineamento Tecnico: Stress-Test Frontend Unnivai

> **A:** User Head of Product
> **Da:** Antigravity AI
> **Data:** 27 Gennaio 2026
> **Stato:** 🟡 Parziale - Core Flows Validati, Gap Funzionali Identificati

---

## 1. ✅ Core Flows & Map Unification (Validato)
Abbiamo completato l'unificazione di tutti i flussi di esperienza verso la `MapPage`. Non ci sono più "vicoli ciechi" nei flussi primari di scoperta.

| Flusso | Input Utente | Handoff alla Mappa | Esito Test Logico |
| :--- | :--- | :--- | :--- |
| **AI Itinerary** | Mood, Tempo, Interessi | `state: { route: [points] }` | **PASS**. La mappa riceve e disegna il percorso. |
| **Quick Path** | Scelta Rapida (Mood) | `state: { route: [], focusedActivity: {generated} }` | **PASS**. La mappa focalizza il punto finale calcolato. |
| **Tour Live** | Card Tour, Click "Mappa" | `state: { focusedActivity: tourData }` | **PASS**. Nuovo bottone testato, focus immediato sul punto di ritrovo. |
| **Trending** | Lista Esperienze | `state: { focusedActivity: item }` | **PASS**. Focus coerente. |
| **Surprise Tour**| Shuffle -> Click "Vedi" | `state: { route: [1 point], focusedActivity: item }` | **PASS**. L'effetto sorpresa transiziona in geolocalizzazione precisa. |

> **Nota Tecnica**: `MapPage.jsx` è stata rifattorizzata per gestire con priorità `focusedActivity` > `activeRoute` > `CityCenter`. Questo garantisce che se l'utente arriva da un'attività specifica, la vede subito.

---

## 2. ⚠️ Analisi Cruscotti e Ruoli (Gap Rilevati)

I dashboard sono stati analizzati per la segregazione dei ruoli. Qui risiedono le principali criticità per il "Via Libera" al Backend.

### Dashboard Guida (`DashboardGuide.jsx`)
*   ✅ **Booking Requests**: UI presente per accettare/rifiutare.
*   ✅ **Live Status**: Toggle "Vai Live" presente.
*   ❌ **Tour Builder (CRITICO)**: **ASSENTE**. Non esiste interfaccia per "disegnare" il tour. La guida vede le prenotazioni ma non può creare l'offerta geografica. È un blocco per l'Use Case "Guida crea tour".

### Dashboard Utente (`DashboardUser.jsx`)
*   ❌ **Stato**: Placeholder "Work in progress".
*   **Impatto**: L'utente non vede i suoi "Preferiti" o "Itinerari Salvati" creati nei flussi precedenti.

### Dashboard Business (`DashboardBusiness.jsx`)
*   ✅ **Visibility Tier**: Visualizzazione chiara del livello (Free/Pro/Premium).
*   ✅ **Activity List**: Lista semplice presente.

---

## 3. 🌍 City-Awareness & Performance

*   **Context System**: `useUserContext` è configurato correttamente per reagire al cambio di `gpsLocation.city`. I componenti `Explore`, `Trending`, e `Map` usano questo contesto come dipendenza nelle query React Query (`queryKey: ['key', city]`).
*   **Skeletons**: Le pagine principali hanno stati di loading, ma le transizioni rapide verso la mappa potrebbero beneficiare di uno skeleton overlay della mappa stessa mentre Mapbox carica i tiles (attualmente mostra solo sfondo grigio/container).

---

## 4. 🛑 Conclusioni e Azioni Immediate

Il Frontend è **solido sulla parte Consumer (Discovery -> Map)** ma **carente sulla parte Creator (Guide Builder)**.

### Piano d'Azione Proposto (Backend Integration Prep):

1.  **Priorità A:** Costruire il componente **"Tour Route Builder"** per la Dashboard Guida. Le guide devono poter cliccare sulla mappa per definire i waypoint. Senza questo, il backend non avrà dati di percorso da salvare.
2.  **Priorità B:** Implementare la UI dei **"Viaggi Salvati"** nella Dashboard Utente per chiudere il cerchio del flusso "Salva Itinerario AI".
3.  **Priorità C (Backend):** Procedere con l'integrazione, sapendo che i payload "Tour" sono ora standardizzati nel frontend.

**Attendo conferma per procedere con la Task Priorità A (Tour Route Builder).**
