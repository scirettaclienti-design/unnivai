# AUDIT BACKEND - DoveVAI

**Data audit:** 2026-04-10
**Progetto:** DoveVAI (unnivai)
**Stack backend:** Supabase (PostgreSQL + PostGIS + RLS + Realtime) | Frontend: React 19 + Vite
**Nessun server backend dedicato** - tutta la logica e' in: SQL functions/triggers (Supabase), RLS policies, e codice frontend (services JS).

---

## 1. Sistema Guide

| Feature | Stato | Dettaglio | File coinvolti |
|---------|-------|-----------|----------------|
| Registrazione guida (flow) | PARZIALE | Form 3 step in `BecomeGuide.jsx` raccoglie nome, cognome, citta, email, motivazione, lingue, foto. **Il submit e' SIMULATO** (`await setTimeout`) - NON salva nulla in DB. Commento nel codice: "In a real app, we would send this data to Supabase/Backend". | `src/pages/BecomeGuide.jsx` |
| Creazione profilo guida (DB) | IMPLEMENTATO | Al primo accesso a DashboardGuide, se `guides_profile` non esiste per user_id, viene creato automaticamente via INSERT con defaults (status=pending, type=host). | `src/pages/DashboardGuide.jsx` (riga 74-79), `supabase/migrations/20260303_fix_missing_tables_and_columns.sql` |
| Accreditamento guida | IMPLEMENTATO | Form in DashboardGuide per: license_number (opzionale), P.IVA, bio. Submit aggiorna `guides_profile` e imposta `status='verified'`. Trigger DB `tr_update_guide_type` imposta automaticamente `type='pro'` se license_number presente, altrimenti `type='host'`. | `src/pages/DashboardGuide.jsx` (riga 180-208), `api/migration_backend_v3.sql` |
| Dashboard guida | IMPLEMENTATO | Due tab: "Richieste Live" e "I Miei Tour". Mostra profilo, stato accreditamento (pending/verified), tipo (pro/host), lista tour con CRUD. | `src/pages/DashboardGuide.jsx` |
| Creazione tour (TourBuilder) | IMPLEMENTATO | Wizard 3 step: 1) Info generali (titolo, citta, prezzo, durata, tag, descrizione, immagini), 2) Mappa interattiva per aggiungere tappe con click, ricerca partner nelle vicinanze via RPC `search_nearby_partners`, arricchimento AI delle descrizioni tappe, 3) Pubblicazione. Genera route_path WKT via Mapbox Directions API. | `src/pages/guide/TourBuilder.jsx`, `src/services/mapService.js` |
| Modifica tour | IMPLEMENTATO | TourBuilder accetta `location.state.tourToEdit` per modalita edit. Update via Supabase con RLS check `guide_id = auth.uid()`. | `src/pages/guide/TourBuilder.jsx` (riga 71-98, 301-317) |
| Eliminazione tour | IMPLEMENTATO | Conferma con `window.confirm`, delete via Supabase con verifica RLS. | `src/pages/DashboardGuide.jsx` (riga 212-240) |
| Prenotazione tour (booking classico) | IMPLEMENTATO | `BookingModal` con selezione data/ora/ospiti. Insert in tabella `bookings` con status `pending_request`. Date/orari HARDCODED nel frontend (non dalla disponibilita reale della guida). | `src/components/BookingSystem.jsx`, `src/services/dataService.js` (createBooking) |
| Sistema richieste guida (Uber model) | IMPLEMENTATO | Utente crea `guide_request` (open). Guide vedono richieste filtrate per citta operativa o indirizzate direttamente. Guide possono: accettare, rifiutare, contattare utente, proporre prezzo. Realtime subscription su `guide_requests`. | `src/pages/DashboardGuide.jsx`, `src/services/dataService.js` (createGuideRequest), `api/migration_backend_v3.sql` |
| Pagamenti guida | NON IMPLEMENTATO | Nessuna integrazione Stripe/payment gateway. Commissioni calcolate in DB (`get_tour_commission`: 20% esploratore, 15% ambasciatore, 10% mentore) ma MAI usate in codice applicativo. Profit simulato: `totalAmount * 0.8` hardcoded. | `backend_logic_guides.sql` (riga 43-71), `src/services/dataService.js` (riga 549) |
| Rating/Recensioni | NON IMPLEMENTATO | Campo `rating` esiste su `guides_profile` (default 5.00) e `tours` ma nessun sistema di raccolta recensioni. Tutti i rating sono mock o default. | `supabase/migrations/20260303_fix_missing_tables_and_columns.sql` |
| Disponibilita guida (calendario) | NON IMPLEMENTATO | Nessun sistema di slot orari o calendario. Le date nel BookingModal sono hardcoded. La guida non puo impostare disponibilita. | `src/components/BookingSystem.jsx` (riga 12-15) |
| Comunicazione guida-utente | IMPLEMENTATO (workaround) | Chat bidirezionale via tabella `notifications`. Guida invia `guide_message`, utente risponde con `user_reply`. Chat history recuperata filtrando notifications per `action_data->>request_id`. **Anti-disintermediazione**: sanitizer oscura telefoni, email, link social prima dell'invio. | `src/pages/DashboardGuide.jsx`, `src/components/ChatModalUser.jsx`, `src/utils/chatSanitizer.js` |
| Proposta prezzo | IMPLEMENTATO | Guida invia offerta economica via notification `price_offer` all'utente. | `src/pages/DashboardGuide.jsx` (sendPriceOffer, riga 307-327) |
| Livelli guida (gamification) | PARZIALE | Due sistemi sovrapposti: 1) `backend_logic_guides.sql` definisce ENUM `guide_level` (esploratore/ambasciatore/mentore) con commissioni, 2) `migration_backend_v2.sql` definisce ENUM `guide_level_v2` (bronze/silver/gold). Il codice frontend usa solo `type` (pro/host). Nessuna logica di promozione automatica. | `backend_logic_guides.sql`, `api/migration_backend_v2.sql`, `api/migration_backend_v3.sql` |
| Citta operative guida | IMPLEMENTATO | Array `operating_cities` in `guides_profile`. Usato per filtrare richieste in arrivo: guida vede solo richieste dalla propria citta o richieste indirizzate direttamente. | `src/pages/DashboardGuide.jsx` (riga 156) |

---

## 2. Sistema Attivita

| Feature | Stato | Dettaglio | File coinvolti |
|---------|-------|-----------|----------------|
| Tabella `activities` | IMPLEMENTATO | Colonne: id, name, lat/lng, city, category, tier, owner_id, vibe_tags, tags, description, type, icon, historical_notes, fun_facts, opening_hours (JSONB), website_url, image_url, admission_fee, duration_minutes. | `supabase/migrations/20260303_enhance_activities_monuments.sql` |
| Chi crea le attivita | MISTO | 1) **Owner/Business** via DashboardBusiness (attivita con owner_id). 2) **Seed SQL** con dati demo. 3) **POI reali da OpenStreetMap** via Overpass API (`poiService.fetchRealPois`). 4) **Arricchimento AI** delle descrizioni via GPT. Nessun pannello admin per gestione centralizzata. | `src/services/poiService.js`, `src/services/dataService.js` (getActivitiesByCity), `supabase/seed.sql` |
| Categorie/Tag | IMPLEMENTATO | `category` (singolo: food, culture, shop, etc.), `vibe_tags` (array), `tags` (array). Tipo POI: monument, museum, church, viewpoint, poi, food, shopping, nature, sport. Tag predefiniti business: Ristorazione, Ospitalita, Shopping, Artigianato, Cultura, Tech, Lusso, Storia, Nightlife, Relax, Avventura. | `supabase/migrations/20260303_enhance_activities_monuments.sql`, `src/pages/DashboardBusiness.jsx` |
| Filtri | PARZIALE | Filtro per citta (`eq('city', city)`). Filtro per tipo (indice `idx_activities_city_type`). Nessun filtro avanzato esposto in UI per utente finale (budget, orari, etc.). | `src/services/dataService.js` (getActivitiesByCity) |
| Immagini attivita | PARZIALE | Campo `image_url` (singolo URL). Per businesses: `image_urls` (array). Le immagini vengono da: URL manuali inseriti dal business, Unsplash hardcoded come fallback, o sono null. Upload immagini presente (`ImageUploader.jsx`). | `src/components/ImageUploader.jsx`, `src/utils/imageUtils.js` |
| Prezzi attivita | IMPLEMENTATO | Campo `admission_fee` (NUMERIC). Mostrato in UI come "Ingresso: X EUR". Null = gratuito. | `supabase/migrations/20260303_enhance_activities_monuments.sql` |
| Orari apertura | IMPLEMENTATO (struttura) | Campo `opening_hours` (JSONB). Formato: `{"lun": "09:00-18:00", ...}`. Letto in `getActivitiesByCity`. La UI ha il rendering ma i dati sono quasi sempre null (nessun meccanismo di popolamento automatico). | `supabase/migrations/20260303_enhance_activities_monuments.sql`, `src/services/dataService.js` |
| Tabella `businesses_profile` | IMPLEMENTATO | Profilo business con: company_name, category_tags[], subscription_tier (free/pro/elite), metrics (JSONB), location (PostGIS POINT), ai_metadata (JSONB con vibe, style, pace, story_hook, price_range), description, address, image_urls[], website, instagram_handle, menu_url, city. | `api/migration_backend_v2.sql`, `src/pages/DashboardBusiness.jsx` |
| Dashboard Business | IMPLEMENTATO | Modifica profilo, selezione categoria tag, upload immagini, analisi AI della descrizione/immagini, analytics mock (views/clicks/saves/conversions). Autocompletion indirizzo. Tier mostrato ma non modificabile dall'utente (protetto da trigger). | `src/pages/DashboardBusiness.jsx` |
| Matching tour-business | IMPLEMENTATO | RPC `match_businesses_for_tour`: cerca businesses entro raggio dal tour, matching per tag diretti + mapping semantico (Cibo->Ristorazione, Arte->Cultura, etc.), bonus subscription tier. RPC `search_nearby_partners`: usata da TourBuilder per trovare partner nelle vicinanze di ogni tappa. | `backend_business_matching.sql`, `backend_logic_partners.sql` |
| Iniezione business nei tour AI | IMPLEMENTATO | `dataService.getBusinessesByCityAndTags()`: affinity scoring (vibe match +3, category match +2, elite boost +5), geocoding on-the-fly via Nominatim, max 3 business per tour, iniettati come stop sponsorizzati. | `src/services/dataService.js` (riga 564-728) |

---

## 3. Generazione Tour AI

### Modello AI
- **Modello principale:** `gpt-3.5-turbo` (OpenAI)
- **API Key:** `VITE_OPENAI_API_KEY` (variabile d'ambiente, opzionale)
- **Se API key assente:** fallback locale con POI hardcoded per 5 citta (Roma, Milano, Firenze, Venezia, Napoli)

### Prompt completo (system prompt)

```
Sei un esperto di turismo italiano. Genera itinerari in JSON puro, senza commenti né markdown.
Segui ESATTAMENTE questo schema JSON (nessun campo aggiuntivo):
{
  "days": [
    {
      "day": 1,
      "title": "Titolo del giorno in italiano",
      "weather": { "condition": "Soleggiato", "temperature": 22, "icon": "☀️" },
      "suggestedTransit": "bus|metro|walking",
      "mapMood": "romantico|storia|avventura|natura|cibo|shopping|arte|sorpresa|sport",
      "stops": [
        {
          "time": "HH:MM",
          "title": "Nome del posto",
          "description": "Descrizione breve (max 100 caratteri)",
          "type": "cultura|storia|food|shopping|relax|arte|natura",
          "location": "Indirizzo o zona",
          "latitude": 41.9028,
          "longitude": 12.4964,
          "price": 0,
          "rating": 4.5
        }
      ]
    }
  ]
}
Regole aggiuntive:
- "suggestedTransit": scegli il mezzo di trasporto principale per il giorno tra "bus", "metro" e "walking". Usa "walking" se le tappe sono a piedi, "metro" per spostamenti veloci in città, "bus" altrimenti.
- "mapMood": associa al giorno un mood scegliendo tra: romantico, storia, avventura, natura, cibo, shopping, arte, sorpresa, sport. Scegli in base al contesto della richiesta e alle tappe del giorno.
Usa SEMPRE coordinate reali e precise per ${city}. Rispondi SOLO con il JSON, nessun testo aggiuntivo.
```

### User prompt (costruito dinamicamente)

```
Genera un itinerario di ${numDays} giorno/i con 4-5 tappe per giorno.
Città: ${city}
Meteo attuale: ${weather.condition}, ${weather.temperature}°C
Durata: ${prefs.duration}
Budget: ${prefs.budget}
Interessi: ${prefs.interests.join(', ')}
Tipo di gruppo: ${prefs.group}
Ritmo: ${prefs.pace}
Richiesta specifica: ${userPrompt}
```

### Input del prompt
| Campo | Fonte |
|-------|-------|
| city | CityContext (GPS / manuale / fallback Roma) |
| weather | weatherService o useUserContext |
| duration | Selezione utente: "Mezza Giornata" / "1 Giorno" / "2-3 Giorni" |
| budget | Selezione utente: "Economico" / "Medio" / "Lusso" |
| interests | Selezione multipla: Arte, Cibo, Storia, Natura, Shopping, Vita Notturna |
| group | Selezione utente: Solo, Coppia, Famiglia, Amici |
| pace | Selezione utente: Rilassato, Attivo, Intenso |
| userPrompt | Testo libero dell'utente |

### Output del prompt
JSON con array `days`, ciascuno contenente: day number, title, weather, suggestedTransit, mapMood, array di stops con time/title/description/type/location/latitude/longitude/price/rating.

### Flusso Input -> Output
1. Utente seleziona preferenze in `AiItinerary.jsx` o `QuickPath.jsx`
2. Viene chiamato `aiRecommendationService.generateItinerary(city, prefs, userPrompt, weather)`
3. Se `VITE_OPENAI_API_KEY` presente: chiamata OpenAI con timeout 35s, response_format json_object
4. Risposta parsata, sanitizzata (coordinate valide, mood/transit validati), filtrata (stop senza coords rimossi)
5. Se API fallisce/timeout: `generateItineraryLocal()` con POI hardcoded per 5 citta
6. Risultato restituito come `{ days: [...] }` alla pagina

### Salvataggio tour generato
| Aspetto | Stato |
|---------|-------|
| Salvataggio in DB | **NON IMPLEMENTATO** - Il tour AI generato vive solo nello state React della pagina. Non viene salvato in nessuna tabella. |
| Modifica post-generazione | **NON IMPLEMENTATO** - L'utente puo solo "rigenerare" (che rifa la chiamata AI) ma non puo modificare singole tappe, riordinare, o aggiungere/rimuovere stop. |
| Navigazione su mappa | **PARZIALE** - QuickPath ha `QuickPathSummary` che mostra il tour, e c'e un link a MapPage/TourLive, ma il passaggio dati tra pagine dipende da state/navigation. |

### Stato complessivo: FUNZIONANTE ma senza persistenza

### Altre funzioni AI
| Funzione | Modello | Scopo |
|----------|---------|-------|
| `enrichMonuments()` | gpt-3.5-turbo | Arricchisce POI con curiosita storiche e fun facts (prompt: DOVEVAI_NARRATOR_PROMPT) |
| `chatWithGuide()` | gpt-3.5-turbo | Chat AI sulla mappa 3D, guida turistica ironica e sintetica |
| `generateWeatherSocialTip()` | gpt-3.5-turbo | Genera consiglio social/meteo per la citta |

---

## 4. Pannello Admin

| Feature | Stato | Note |
|---------|-------|------|
| Pannello admin dedicato | **NON ESISTE** | Nessuna pagina /admin, nessun ruolo 'admin' nel routing, nessuna UI di amministrazione |
| Approvazione guide | **NON IMPLEMENTATO** | Le guide si auto-verificano (`status='verified'` impostato dal frontend stesso nel submit accreditamento). Nessuna review umana. |
| Gestione tour | **NON IMPLEMENTATO** | Nessun modo per admin di moderare, approvare, o rimuovere tour |
| Gestione business tier | **PARZIALE (solo DB)** | Trigger `protect_activity_subscription` impedisce upgrade tier da utente. Ma nessuna UI admin per cambiarlo. Upgrade possibile solo via service_role key (backend diretto). |
| Analytics piattaforma | **NON IMPLEMENTATO** | Analytics business sono mock hardcoded nel frontend |
| Gestione utenti | **NON IMPLEMENTATO** | Nessuna UI per ban, sospensione, o gestione utenti |
| Moderazione contenuti | **PARZIALE** | `chatSanitizer.js` oscura automaticamente contatti nei messaggi. Nessuna moderazione manuale. |

---

## 5. Mappa Interazioni tra i 3 Sistemi

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UTENTE (Explorer)                          │
│                                                                     │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐     │
│   │ Tour con      │    │  Tour AI     │    │ Tour Veloce AI   │     │
│   │ Guida Locale  │    │ (AiItinerary)│    │ (QuickPath)      │     │
│   └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘     │
│          │                    │                      │               │
└──────────┼────────────────────┼──────────────────────┼───────────────┘
           │                    │                      │
           ▼                    ▼                      ▼
┌──────────────────┐  ┌─────────────────┐  ┌──────────────────────┐
│  SISTEMA GUIDE   │  │  SISTEMA AI     │  │  SISTEMA AI          │
│                  │  │                 │  │  (QuickPath)         │
│  guide_requests  │  │  OpenAI GPT     │  │  OpenAI GPT          │
│  bookings        │  │  3.5-turbo      │  │  3.5-turbo           │
│  guides_profile  │  │  OR             │  │  +                   │
│  tours (DB)      │  │  Local fallback │  │  Business injection  │
│                  │  │                 │  │  (getBusinesses      │
│  Chat via        │  │  Output: JSON   │  │   ByCityAndTags)     │
│  notifications   │  │  in-memory only │  │  Output: JSON        │
│                  │  │  (NON salvato)  │  │  in-memory only      │
└────────┬─────────┘  └────────┬────────┘  └───────────┬──────────┘
         │                     │                        │
         │                     │                        │
         ▼                     ▼                        ▼
┌────────────────────────────────────────────────────────────────────┐
│                        SUPABASE (PostgreSQL)                       │
│                                                                    │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │   tours    │  │  activities  │  │  businesses_profile     │   │
│  │ (guide     │  │  (POI/       │  │  (partner commerciali)  │   │
│  │  created)  │  │   monumenti) │  │                         │   │
│  └─────┬──────┘  └──────┬───────┘  └────────────┬────────────┘   │
│        │                │                        │                │
│        │    ┌───────────┴────────────────────────┘                │
│        │    │                                                     │
│        ▼    ▼                                                     │
│  ┌──────────────────────────────────────────────┐                │
│  │  match_businesses_for_tour (RPC)             │                │
│  │  search_nearby_partners (RPC)                │                │
│  │  Tag matching + Spatial query (PostGIS)      │                │
│  │  Score: tag diretto(+3) + semantico(+2)      │                │
│  │         + tier premium(+3) + elite(+5)       │                │
│  └──────────────────────────────────────────────┘                │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  bookings    │  │ guide_       │  │ notifications│           │
│  │              │  │ requests     │  │ (+ chat)     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└────────────────────────────────────────────────────────────────────┘
```

### Come coesistono Tour Guida e Tour AI

| Aspetto | Tour con Guida | Tour AI / Tour Veloce AI |
|---------|---------------|-------------------------|
| Creazione | Guida crea via TourBuilder, salvato in `tours` | Generato al volo da GPT, NON salvato in DB |
| Persistenza | Persistente in DB, visibile in Explore, ricercabile | Effimero, esiste solo nella sessione utente |
| Monetizzazione | Prezzo impostato dalla guida, booking system | Gratuito (con paywall dopo 10 generazioni in QuickPath) |
| Business injection | TourBuilder cerca partner via `search_nearby_partners` (guida sceglie) | QuickPath inietta automaticamente via `getBusinessesByCityAndTags` (scoring automatico) |
| Navigazione | TourLive con mappa, route_path calcolato | Mostra stop su mappa ma senza route_path persistente |
| Interazione sociale | Chat, booking, recensioni (future) | Nessuna interazione sociale |

### Un tour guida puo includere attivita dal database AI?
**SI, parzialmente.** Il TourBuilder permette alla guida di cercare partner/attivita nelle vicinanze di ogni tappa via RPC `search_nearby_partners` e linkarli (`linked_business_id`). Le attivita/POI dal poiService (OSM) vengono mostrate sulla mappa ma non sono direttamente linkabili nel TourBuilder.

### Conflitti di UX tra le 3 modalita
1. **Nessun bridge tra tour AI e tour guida**: Un utente che genera un tour AI non puo "chiedere una guida" per quel percorso specifico.
2. **Prenotazione solo su tour guida**: Il BookingModal appare solo su tour da DB (con guide_id). I tour AI non hanno prenotazione.
3. **Tour AI non salvabili**: L'utente non puo salvare, condividere, o riprendere un tour AI generato in precedenza.
4. **Duplicazione dati**: POI hardcoded in `aiRecommendationService.js` (CITY_POIS) vs POI in tabella `activities` vs POI da Overpass API -- tre fonti dati non sincronizzate.
5. **Due sistemi di prenotazione sovrapposti**: `bookings` (classico, con date) e `guide_requests` (modello Uber, real-time). Non e' chiaro quando usare uno o l'altro.
6. **QuickPath vs AiItinerary**: Due pagine separate per generazione AI con UX diverse ma stesso backend (`aiRecommendationService.generateItinerary`). QuickPath ha selezione citta-specifica multi-step + business injection. AiItinerary ha preferenze standard.

---

## Appendice: File chiave del backend

| File | Ruolo |
|------|-------|
| `backend_logic_guides.sql` | RLS guide/tours, commissioni, trigger defaults nuova guida, constraint tour |
| `backend_logic_users.sql` | RLS explorers/photos, gamification complete_tour con geofencing, validazione foto geo, feed locale |
| `backend_logic_partners.sql` | RLS activities, protezione subscription tier, RPC search_nearby_partners |
| `backend_business_matching.sql` | RPC match_businesses_for_tour, count_matching_tours_for_business, VIEW public_business_partners |
| `api/migration_backend_v2.sql` | Tabelle guides_profile, businesses_profile, tours extensions, RPC distanza |
| `api/migration_backend_v3.sql` | Modello Uber: guide_requests, tipo pro/host, RPC get_nearby_requests_for_guide |
| `supabase/migrations/20260303_fix_missing_tables_and_columns.sql` | Creazione tabelle: guides_profile, explorers, user_photos, favorites, fix notifications |
| `supabase/migrations/20260303_enhance_activities_monuments.sql` | Colonne monument-specific su activities |
| `src/services/aiRecommendationService.js` | Tutte le chiamate OpenAI: itinerario, enrichment, chat, weather tip |
| `src/services/dataService.js` | CRUD Supabase: tours, bookings, favorites, notifications, activities, businesses, mapping UI |
| `src/services/poiService.js` | Fetch POI reali da OpenStreetMap Overpass API |
| `src/utils/chatSanitizer.js` | Anti-disintermediazione: oscura telefoni, email, link social nei messaggi |
| `src/pages/DashboardGuide.jsx` | Dashboard guida completa: profilo, tour CRUD, richieste live, chat, proposte prezzo |
| `src/pages/guide/TourBuilder.jsx` | Creazione/modifica tour con mappa interattiva |
| `src/pages/DashboardBusiness.jsx` | Dashboard business: profilo, tag, immagini, analytics mock, analisi AI |
| `src/pages/AiItinerary.jsx` | Generazione itinerario AI con preferenze |
| `src/pages/QuickPath.jsx` | Tour veloce AI con selezione citta-specifica + business injection |
| `src/components/BookingSystem.jsx` | Modal prenotazione tour |
| `src/components/ChatModalUser.jsx` | Chat utente verso guida |
