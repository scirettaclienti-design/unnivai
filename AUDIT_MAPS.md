# AUDIT_MAPS.md -- Integrazione Google Maps SDK e Geolocalizzazione

**Progetto:** DoveVAI (unnivai-ricresa)
**Data audit:** 2026-04-10
**Scope:** Google Maps SDK, Mapbox, Nominatim (OSM), geolocalizzazione browser

---

## 1. Configurazione SDK

### SDK principale: `@vis.gl/react-google-maps` v1.8.1

| Aspetto | Dettaglio |
|---|---|
| **Libreria** | `@vis.gl/react-google-maps` (Google Maps JS SDK wrapper ufficiale Vis.gl) |
| **Caricamento** | `<APIProvider>` in `App.jsx`, wrappa l'intera app |
| **API Key env var** | `VITE_GOOGLE_MAPS_API_KEY` (file `.env`) |
| **Map ID env var** | `VITE_GOOGLE_MAP_ID` (per Cloud-based Map Styling) |
| **Libraries caricate** | `['places']` -- dichiarate nell'`APIProvider` |
| **Fallback Map ID** | Hardcoded `'28861a61c07876f819652d2d'` in `GoogleMapContainer.jsx` |
| **Rendering** | `renderingType="VECTOR"` (WebGL 3D, supporto tilt/heading) |

**Gerarchia Provider:**
```
QueryClientProvider
  AuthProvider
    CityProvider
      APIProvider (apiKey, libraries=['places'])   <-- Google Maps
        Router
          ErrorBoundary
            Suspense
              Routes
```

### SDK legacy/secondario: Mapbox (`VITE_MAPBOX_TOKEN`)

Mapbox e ancora referenziato in:
- `mapService.js` -- Directions API per calcolo rotte (walking)
- `TourBuilder.jsx` -- token importato ma usato solo come backup
- `UnnivaiMap.old.jsx`, `ExploreMiniMap.old.jsx` -- file `.old` deprecati

**PROBLEMA:** Il progetto ha effettuato una migrazione da Mapbox a Google Maps ma `mapService.js` usa ancora l'endpoint Mapbox Directions. Questo servizio NON e attivamente usato dal flow principale (che usa `useTourRouting.js` con Google Directions), ma resta nel bundle.

### Nominatim (OSM) -- Geocoding gratuito

Usato come fallback in:
- `useGeolocation.js` -- reverse geocoding (Nominatim primario)
- `useEnhancedGeolocation.js` -- reverse geocoding (Google primario, Nominatim fallback)
- `AddressAutocomplete.jsx` -- ricerca indirizzi (Nominatim puro, nessun Google)

---

## 2. Componenti Mappa

| Componente | File | Ruolo | SDK usato |
|---|---|---|---|
| `GoogleMapContainer` | `src/components/Map/GoogleMapContainer.jsx` | Wrapper base `<Map>` con Vector 3D, stili, controlli | `@vis.gl/react-google-maps` |
| `UnnivaiMap` | `src/components/UnnivaiMap.jsx` | Composizione mappa + marker + route, gestione mood/stile | `@vis.gl/react-google-maps` |
| `MapMarker` | `src/components/Map/MapMarker.jsx` | Marker custom con `<AdvancedMarker>`, icone per categoria | `@vis.gl/react-google-maps` |
| `SmartMarker` | `src/components/Map/SmartMarker.jsx` | Marker legacy con livelli (0=monumento, 1=business, 2=step) | **Mapbox stub** (Marker = hidden div) |
| `TourRoute` | `src/components/Map/TourRoute.jsx` | Wrapper per `useTourRouting` (polyline Directions) | `@vis.gl/react-google-maps` |
| `CitySearchBar` | `src/components/Map/CitySearchBar.jsx` | Autocomplete citta con Google Places | `@vis.gl/react-google-maps` |
| `POIPopupCard` | `src/components/Map/POIPopupCard.jsx` | Popup su click POI con foto Google Places | `@vis.gl/react-google-maps` |
| `POIDetailDrawer` | `src/components/Map/POIDetailDrawer.jsx` | Drawer full dettaglio POI + speech synthesis + foto | `@vis.gl/react-google-maps` |
| `WeatherAirBadge` | `src/components/Map/WeatherAirBadge.jsx` | Badge meteo sulla mappa | N/A |
| `GeminiDrawer` | `src/components/Map/GeminiDrawer.jsx` | Chat AI contestuale al POI selezionato | OpenAI (non Google) |
| `ExploreMiniMap` | `src/components/Explore/ExploreMiniMap.jsx` | Mini mappa in pagina Explore | `@vis.gl/react-google-maps` |
| `MapPage` | `src/pages/MapPage.jsx` | Pagina principale mappa (~700 righe), orchestra tutto | `@vis.gl/react-google-maps` |
| `AddressAutocomplete` | `src/components/AddressAutocomplete.jsx` | Autocomplete indirizzi per business | **Nominatim (OSM)** |

### Marker e InfoWindow

- **AdvancedMarker**: usato in `MapMarker.jsx` e `UnnivaiMap.jsx` (user location blue dot)
- **InfoWindow**: importato in `MapPage.jsx` ma usato programmaticamente per POI nativi Google
- **Clustering**: **NON implementato** -- i marker vengono filtrati per citta (server-side) e raggio (client-side, max 8 business partner), ma non c'e `MarkerClusterer`
- **Custom rendering**: tutti i marker usano HTML/CSS custom dentro `<AdvancedMarker>`, con `React.memo` e shallow comparison per anti-stutter

### Eventi mappa

| Evento | Dove | Come |
|---|---|---|
| Click su marker | `MapMarker` | `onClick` prop -> `onActivityClick` in `UnnivaiMap` |
| Camera move | `MapPage.jsx` | `map.moveCamera()` per fly-to, zoom, tilt, heading |
| Bounds change | `MapPage.jsx` | `map.getBounds()` per "Cerca qui" |
| Drag | `GoogleMapContainer` | `gestureHandling="greedy"` (touch/trackpad senza restrizioni) |

### Performance

- **React.memo** su `MapMarker` con shallow prop comparison (anti-stutter 60fps)
- **useMemo** su `validActivities` in `UnnivaiMap`
- **Signature dedup** in `useTourRouting` per evitare Directions API call duplicate
- **Props stripping** in `GoogleMapContainer` per prevenire re-render del `<Map>` SDK
- **RISCHIO**: nessun clustering; se il numero di business/attivita per citta cresce oltre ~50, possibili cali di performance

---

## 3. Geolocalizzazione -- Flow Completo

### Hook disponibili

| Hook | File | Tipo richiesta | Reverse Geocoding |
|---|---|---|---|
| `useGeolocation` | `src/hooks/useGeolocation.js` | `getCurrentPosition` (single) | Nominatim (OSM) |
| `useEnhancedGeolocation` | `src/hooks/useEnhancedGeolocation.js` | `getCurrentPosition` (single) + save backend | Google Geocoding -> Nominatim fallback |
| Inline in `MapPage.jsx` | `src/pages/MapPage.jsx` L.342-357 | `getCurrentPosition` (single) | Nessuno (solo coordinate) |
| Navigation tracking | `src/pages/MapPage.jsx` L.688 | `watchPosition` (continuous) | Nessuno |

### Flow completo con edge case

```
APP MOUNT
  |
  v
useEnhancedGeolocation() auto-runs
  |
  +--[navigator.geolocation non supportato?]
  |     |
  |     v
  |   triggerIpFallback() -> ipapi.co/json
  |     +--[successo] -> usa IP location (citta, lat, lng)
  |     +--[fallimento] -> setSimulatedLocation() -> Roma (41.9028, 12.4964)
  |
  +--[supportato] -> getCurrentPosition()
        |
        +--[enableHighAccuracy: true, timeout: 15000, maximumAge: 0]
        |
        +--[SUCCESSO] -> coordinate valide?
        |     +--[SI] -> reverseGeocode(lat, lon)
        |     |           +--[Google API key presente?]
        |     |           |     +--[SI] -> Google Geocoding API (result_type=locality)
        |     |           |     |     +--[OK] -> citta rilevata
        |     |           |     |     +--[FAIL] -> Nominatim fallback
        |     |           |     +--[NO] -> Nominatim diretto
        |     |           +--[Nominatim fallback se tutto fallisce] -> Roma
        |     |
        |     +--[NO, coordinate invalide (0,0 etc)] -> throw Error
        |
        +--[ERRORE]
              +--[code 1: PERMISSION_DENIED] -> "Accesso GPS negato"
              +--[code 2: POSITION_UNAVAILABLE] -> "GPS non disponibile"
              +--[code 3: TIMEOUT] -> "GPS timeout"
              |
              v
           triggerIpFallback() -> ipapi.co/json -> Roma fallback
```

### Accuracy Settings

| Parametro | `useGeolocation` | `useEnhancedGeolocation` | `MapPage` (inline) |
|---|---|---|---|
| `enableHighAccuracy` | `true` | `true` | `true` |
| `timeout` | 15000ms | 15000ms | 5000ms |
| `maximumAge` | 60000ms (1min cache) | 0 (no cache) | 0 |

### Watch Position (navigazione real-time)

Solo in `MapPage.jsx` durante la navigazione attiva:
- `watchPosition` con `enableHighAccuracy: true, maximumAge: 1000`
- Camera follow throttled a max 2 FPS (500ms)
- Heading usato per orientare la mappa 3D
- `clearWatch` su fine navigazione o unmount

### Problemi rilevati

1. **useEnhancedGeolocation tenta save su `/api/location/save`** -- endpoint API backend che NON esiste nel progetto (nessun backend Express/API routes). Il save fallisce silenziosamente.
2. **useEnhancedGeolocation tenta fetch da `/api/location/nearby`** -- stesso problema, endpoint inesistente.
3. **IP fallback via ipapi.co** -- servizio terzo non controllato; puo essere bloccato da CORS o rate limiting.
4. **useGeolocation: reverse geocoding fallback** restituisce coordinate come nome citta se Nominatim fallisce (`"Lat: 41.90, Lon: 12.49"`). Gestito a valle da `userContextService` con sanitizzazione, ma fragile.
5. **Nessun prompt UI** per re-richiedere permessi GPS dopo denial.

---

## 4. API Utilizzate

| Google API | Usata dove | Come | Campi richiesti |
|---|---|---|---|
| **Maps JavaScript API** | `GoogleMapContainer`, `UnnivaiMap`, `MapPage` | `<Map>` Vector rendering, tilt, heading, zoom | N/A (core) |
| **Places API** -- AutocompleteService | `CitySearchBar.jsx` | `getPlacePredictions({ types: ['(cities)'] })` | predictions (structured_formatting, place_id) |
| **Places API** -- PlacesService.findPlaceFromQuery | `POIPopupCard`, `POIDetailDrawer`, `MapPage`, `placesDiscoveryService` | Photo lookup per POI | `['photos']` oppure `['photos', 'name']` |
| **Geocoding API** (REST) | `userContextService.js`, `useEnhancedGeolocation.js` | Reverse geocoding (latlng->city), Forward geocoding (city->latlng) | `address_components`, `geometry.location` |
| **Directions API** (JS SDK) | `useTourRouting.js` via `DirectionsService` + `DirectionsRenderer` | Calcolo e rendering percorsi | origin, destination, waypoints, travelMode |
| **Cloud Map Styling** | `GoogleMapContainer`, `UnnivaiMap` | Map IDs per mood-based styling | N/A (configurazione Cloud Console) |

| API NON-Google | Usata dove | Come |
|---|---|---|
| **Nominatim (OSM)** | `useGeolocation`, `useEnhancedGeolocation`, `AddressAutocomplete` | Reverse geocoding, address search (gratuito, rate-limited 1 req/s) |
| **Mapbox Directions** | `mapService.js` | Walking route geometry (LEGACY, non attivamente usato nel flow principale) |
| **OpenAI** | `aiRecommendationService`, `placesDiscoveryService`, `GeminiDrawer` | Generazione itinerari, discovery POI, chat AI |
| **ipapi.co** | `useEnhancedGeolocation` | IP-based geolocation fallback |

### Places API -- Ottimizzazione campi

| Chiamata | Campi richiesti | Ottimale? |
|---|---|---|
| `findPlaceFromQuery` in `POIPopupCard` | `['photos']` | SI -- minimo necessario |
| `findPlaceFromQuery` in `POIDetailDrawer` | `['photos']` | SI |
| `findPlaceFromQuery` in `placesDiscoveryService` | `['photos', 'name']` | QUASI -- `name` non strettamente necessario |
| `getPlacePredictions` in `CitySearchBar` | `types: ['(cities)']` | SI -- filtro citta riduce risultati |
| `Geocoder.geocode` in `CitySearchBar` | `placeId` (post-selezione) | SI -- usa session token correttamente |

**Session Token**: implementato correttamente in `CitySearchBar.jsx` -- `AutocompleteSessionToken` creato all'init e rinnovato dopo ogni selezione. Questo bundla autocomplete + geocode in una sola sessione di billing.

---

## 5. Directions API -- Dettaglio

### Implementazione: `useTourRouting.js`

| Aspetto | Dettaglio |
|---|---|
| **Servizio** | `google.maps.DirectionsService` (JS SDK) |
| **Renderer** | Due `DirectionsRenderer` sovrapposti: outline (arancione glow 14px 30% opacita) + inner (arancione solido 6px) |
| **suppressMarkers** | `true` -- usa `MapMarker` custom al posto dei marker nativi Directions |
| **optimizeWaypoints** | `false` -- ordine waypoint rispettato come da itinerario AI |
| **Waypoints** | SI, supportati come `stopovers` (tutti i punti intermedi tra origin e destination) |

### Travel Mode -- Selezione automatica intelligente

| Condizione | Modo scelto |
|---|---|
| `travelModePreference` contiene TRANSIT/BUS/MEZZI/METRO | `TRANSIT` |
| `travelModePreference` contiene DRIVING/AUTO/CAR | `DRIVING` |
| `travelModePreference` contiene WALKING/PIEDI | `WALKING` |
| `travelModePreference` contiene BICYCLING/BICI/BIKE | `BICYCLING` |
| Nessuna preferenza + distanza > 3.5km | `DRIVING` |
| Nessuna preferenza + distanza 1.5-3.5km | `TRANSIT` |
| Nessuna preferenza + distanza < 1.5km | `WALKING` (default) |

### Anti-duplicate

Signature-based dedup: `waypoints.map(lat,lng).join('|') + '_' + travelMode`. Se la signature non cambia, nessuna nuova richiesta API. Evita burst a 60fps durante il rendering React.

---

## 6. Tour AI + Mappa -- Interazione

### Flow end-to-end

```
1. UTENTE seleziona preferenze in AiItinerary.jsx
     |
     v
2. aiRecommendationService.generateItinerary(city, prefs, userPrompt, weather)
     |
     +--[VITE_OPENAI_API_KEY presente?]
     |     +--[SI] -> OpenAI GPT-3.5-turbo genera JSON itinerario
     |     |          (con coordinate lat/lng per ogni stop)
     |     +--[NO] -> generateItineraryLocal() usa CITY_POIS hardcoded
     |
     v
3. Itinerario contiene: days[].stops[].{title, latitude, longitude, type, ...}
     |
     v
4. UTENTE clicca "Apri Mappa" -> naviga a MapPage con tourData in location.state
     |
     v
5. MapPage.jsx:
     a. Estrae steps/waypoints dal tourData
     b. Passa routePoints a UnnivaiMap -> TourRoute -> useTourRouting
     c. useTourRouting chiama Google Directions API per la polyline
     d. DirectionsRenderer disegna il percorso sulla mappa
     e. MapMarker renderizza ogni stop come marker numerato
     |
     v
6. BUSINESS MATCHING (parallelo):
     a. fetchMatchingBusinesses() interroga Supabase businesses_profile
     b. Filtra per citta (server-side) + raggio haversine + tag affinity (client-side)
     c. Business partner appaiono come marker gialli sulla mappa
     |
     v
7. NAVIGAZIONE REAL-TIME (se utente avvia):
     a. watchPosition() con enableHighAccuracy
     b. Camera 3D follow mode (zoom 19, tilt 60, heading dal GPS)
     c. Throttle 2 FPS per smoothness
     d. Prossimita step -> "Sblocca Contenuto" -> confetti + AI enrichment
     |
     v
8. AI ENRICHMENT ON-CLICK:
     a. Click su POI/step -> POIDetailDrawer si apre
     b. Se mancano historicalNotes/funFacts -> aiRecommendationService.enrichMonuments()
     c. Google Places findPlaceFromQuery per foto reale
     d. Speech synthesis (it-IT) per audio guide
```

### Dati AI -> Mappa

| Dato AI | Usato sulla mappa come |
|---|---|
| `stops[].latitude/longitude` | Posizione `MapMarker` |
| `stops[].title` | Label nel marker e popup |
| `stops[].type` | Colore/icona del marker (categoria) |
| `suggestedTransit` | Travel mode per Directions API |
| `mapMood` | Map Style ID (Cloud Map Styling) |
| Business partner coords | Marker gialli aggiuntivi sulla rotta |

### Real-time updates durante il tour

- **SI**: `watchPosition` aggiorna la posizione utente in tempo reale
- **SI**: Camera follow mode 3D con heading
- **SI**: Step completion tracking (proximity-based, gestito via UI "Sblocca")
- **NO**: Non c'e ricalcolo automatico del percorso se l'utente devia (no rerouting)
- **NO**: Non ci sono notifiche push per prossimita POI (geofencing assente)

---

## 7. Costi Stimati

### Prezzi Google Maps Platform (Pay-As-You-Go, prezzi 2025/2026)

> Nota: Google offre $200/mese di credito gratuito. Le stime sotto sono PRIMA del credito.

| API | Prezzo per 1000 chiamate | Nota |
|---|---|---|
| Maps JavaScript API (Dynamic Maps) | $7.00 | Per 1000 map loads |
| Places API -- Autocomplete (session) | $2.83 | Per sessione (autocomplete + geocode bundled) |
| Places API -- Find Place | $17.00 | Per 1000 richieste |
| Places API -- Place Photo | $7.00 | Per 1000 richieste |
| Geocoding API | $5.00 | Per 1000 richieste |
| Directions API | $5.00 | Per 1000 richieste (fino a 10 waypoints) |
| Cloud Map Styling | Incluso | Nessun costo aggiuntivo |

### Stima per sessione utente tipica

Una sessione tipo (apri app -> cerca citta -> genera itinerario -> esplora mappa -> navigazione):

| Azione | API call | Costo unitario |
|---|---|---|
| App load (mappa render) | 1x Maps JS | $0.007 |
| Reverse geocoding (posizione utente) | 1x Geocoding | $0.005 |
| Cerca citta (autocomplete + geocode) | 1x Places session | $0.00283 |
| Genera itinerario + apri mappa | 1x Directions (route) | $0.005 |
| Visualizza 5 POI popup (foto) | 5x Find Place | $0.085 |
| Click dettaglio 2 POI (foto drawer) | 2x Find Place | $0.034 |
| **Totale per sessione** | | **~$0.138** |

### Proiezione per volume utenti (mensile)

| Utenti/mese | Sessioni stimate (2x/utente) | Costo lordo | Credito Google ($200) | **Costo netto** |
|---|---|---|---|---|
| **100** | 200 | $27.60 | -$200 | **$0** (dentro il credito) |
| **1,000** | 2,000 | $276 | -$200 | **~$76/mese** |
| **10,000** | 20,000 | $2,760 | -$200 | **~$2,560/mese** |

### Costi Nominatim (OSM)

**$0** -- Gratuito, ma con rate limit di 1 richiesta/secondo e obbligo di attribution. Usato solo come fallback.

### Costi Mapbox (residuo)

Se `mapService.js` venisse attivamente usato: Mapbox Directions costa $0.50 per 1000 richieste. Attualmente il servizio NON e nel flow principale, quindi costo = $0.

### Costi OpenAI (collegati al flusso mappa)

| Modello | Per 1000 sessioni (stima ~800 token/sessione) | Note |
|---|---|---|
| GPT-3.5-turbo | ~$0.80 | Itinerario generation |
| GPT-3.5-turbo | ~$0.40 | POI enrichment (on-click) |
| GPT-3.5-turbo | ~$0.20 | POI discovery |

---

## 8. Problemi Critici e Raccomandazioni

### CRITICO

| # | Problema | File | Impatto |
|---|---|---|---|
| C1 | **API Key non ristretta** -- `.env.example` non documenta restrizioni. La key Google Maps va ristretta per dominio HTTP referrer e per API (Maps JS, Places, Geocoding, Directions). Senza restrizioni, chiunque puo abusare della key. | `.env.example` | Sicurezza / Costi |
| C2 | **`useEnhancedGeolocation` chiama endpoint API inesistenti** (`/api/location/save`, `/api/location/nearby`) | `src/hooks/useEnhancedGeolocation.js` | Errori 404 silenziosi |
| C3 | **Nessun clustering marker** -- oltre 50 marker la mappa rallenta | `UnnivaiMap.jsx` | Performance |

### ALTO

| # | Problema | File | Impatto |
|---|---|---|---|
| A1 | **Places API Find Place non usa session token** -- ogni `findPlaceFromQuery` per foto e una chiamata singola ($0.017). Servirebbe caching piu aggressivo. | `POIPopupCard`, `POIDetailDrawer`, `placesDiscoveryService` | Costi |
| A2 | **`SmartMarker.jsx` usa stub Mapbox** -- il componente Marker e un `<div className="hidden">`, quindi SmartMarker non renderizza nulla. Codice morto. | `src/components/Map/SmartMarker.jsx` | Dead code |
| A3 | **`mapService.js` usa Mapbox Directions** -- servizio legacy non usato dal flow principale. Da rimuovere o migrare. | `src/services/mapService.js` | Confusione, bundle size |
| A4 | **MAP_MOODS usa placeholder string** (`'GOOGLE_MAP_ID_ROMANTIC'`, etc.) invece di Map ID reali. Solo `default` ha un ID vero. | `src/lib/schemas.js` | Mood switching non funzionante |

### MEDIO

| # | Problema | File | Impatto |
|---|---|---|---|
| M1 | **Nessun rerouting** durante la navigazione real-time | `MapPage.jsx` | UX |
| M2 | **Nessun geofencing** per notifiche prossimita POI | N/A | UX |
| M3 | **IP fallback via ipapi.co** -- servizio terzo non SLA-garantito | `useEnhancedGeolocation.js` | Affidabilita |
| M4 | **`AddressAutocomplete` usa Nominatim** mentre il resto dell'app usa Google. Inconsistenza UX. | `AddressAutocomplete.jsx` | UX consistency |
| M5 | **`useGeolocation` restituisce coordinate come nome citta** se Nominatim fallisce | `useGeolocation.js` L.163 | Bug UX |

---

## 9. Riepilogo Architettura Mappe

```
                    +------------------+
                    |   APIProvider    |  (Google Maps JS SDK loader)
                    |  apiKey + places |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
    +---------+----------+     +-----------+---------+
    | GoogleMapContainer |     |   CitySearchBar     |
    | (Map, Vector 3D)   |     | (Places Autocomplete)|
    +---------+----------+     +---------------------+
              |
    +---------+----------+
    |    UnnivaiMap       |
    | (markers, route,    |
    |  mood styling)      |
    +---------+----------+
              |
    +---------+-----+--------+-------------+
    |               |        |             |
 MapMarker    TourRoute   UserDot     InfoWindow
 (AdvancedMarker) (useTourRouting)  (AdvancedMarker)  (POIPopupCard)
    |               |
    |        DirectionsService
    |        DirectionsRenderer x2
    |        (glow + solid polyline)
    |
    +-- POIDetailDrawer (Places photos + AI enrichment + Speech)
    +-- GeminiDrawer (AI chat contestuale)
```

**Servizi geocoding (priorita):**
1. Google Geocoding API (se key presente)
2. Nominatim (OSM) -- fallback gratuito
3. Hardcoded city coordinates (12 citta italiane)
4. Default: Roma (41.9028, 12.4964)
