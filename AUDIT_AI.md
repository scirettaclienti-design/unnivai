# AUDIT AI - DoveVAI

**Data audit:** 2026-04-10
**Versione analizzata:** codebase corrente (unnivai ricresa)

---

## 1. Stack AI

| Componente | Tecnologia | Stato | Problemi |
|---|---|---|---|
| SDK | `openai` npm v6.22.0 (installato ma **NON usato**) | Installato, inutilizzato | L'SDK e' nel package.json ma tutte le chiamate usano `fetch` diretto verso `api.openai.com` |
| Modello | `gpt-3.5-turbo` | Attivo | Modello obsoleto (fine-vita imminente). Nessun uso di GPT-4/4o |
| Chiamate AI | **Client-side** (`fetch` dal browser) | CRITICO | Nessuna API route, nessuna edge function, nessun proxy server. Tutto avviene nel browser |
| API Key | `VITE_OPENAI_API_KEY` esposta via `import.meta.env` | **CRITICO** | La chiave e' iniettata nel bundle JS in produzione. Chiunque puo' estrarre la key dalla build |
| Streaming | Non implementato | Assente | Tutte le chiamate attendono la risposta completa (`response.json()`) |
| Response format | `json_object` mode | Funzionante | Buon uso di `response_format: { type: 'json_object' }` |
| Google Places | JS SDK (client-side) | Attivo | Usato per arricchire POI con foto reali |
| Anthropic/Claude | Non presente | Assente | Nessuna integrazione con Anthropic SDK |
| Vercel AI SDK | Non presente | Assente | Nessuna integrazione |

---

## 2. System Prompts Completi

### 2.1 Generazione Itinerario (`generateItinerary`)

```
Sei un esperto di turismo italiano. Genera itinerari in JSON puro, senza commenti ne' markdown.
Segui ESATTAMENTE questo schema JSON (nessun campo aggiuntivo):
{
  "days": [
    {
      "day": 1,
      "title": "Titolo del giorno in italiano",
      "weather": { "condition": "Soleggiato", "temperature": 22, "icon": "..." },
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
- "suggestedTransit": scegli il mezzo di trasporto principale per il giorno tra "bus", "metro" e "walking". Usa "walking" se le tappe sono a piedi, "metro" per spostamenti veloci in citta', "bus" altrimenti.
- "mapMood": associa al giorno un mood scegliendo tra: romantico, storia, avventura, natura, cibo, shopping, arte, sorpresa, sport. Scegli in base al contesto della richiesta e alle tappe del giorno.
Usa SEMPRE coordinate reali e precise per ${city}. Rispondi SOLO con il JSON, nessun testo aggiuntivo.
```

### 2.2 Arricchimento Monumenti (`enrichMonuments`)

```
Sei la voce di DoveVai. Scrivi curiosita' storiche ironiche e colte.
Evita i cliche' come 'storia millenaria'. Focus su aneddoti bizzarri.
Max 150 car per la nota, 80 car per il fun fact.
```

### 2.3 Chat Guida AI (`chatWithGuide`)

```
Sei l'Assistente AI integrato nella mappa 3D premium di DoveVai.
Il tuo compito e' fare da guida turistica esperta, ironica e sintetica per l'utente, che sta esplorando in questo momento: ${contextStr}.
Non dare risposte enciclopediche lunghissime (massimo 3-4 frasi o 450 caratteri). Fai emergere verita' storiche nascoste, aneddoti divertenti o consigli unici. Se ti chiedono indicazioni stradali complesse, ricordagli gentilmente di seguire la scia arancione sulla mappa.
```

### 2.4 Tip Meteo/Social (`generateWeatherSocialTip`)

System:
```
Sei un travel advisor locale amichevole e moderno. Rispondi solo in JSON.
```

User prompt:
```
Sei un esperto locale di ${city}. Scrivi un breve consiglio (max 150 caratteri) per ${userName || 'il viaggiatore'} basato sul meteo di oggi a ${city} (immagina una condizione realistica) suggerendo un'attivita' appropriata e aggiungi un piccolo consiglio o hashtag per i social.
Formato JSON richiesto:
{
  "title": "Titolo accattivante con emoji",
  "message": "Il messaggio con il consiglio e l'hashtag"
}
```

### 2.5 POI Discovery (`placesDiscoveryService`)

System:
```
Sei un esperto di turismo e geografia italiana. Conosci ogni singolo paese e citta' d'Italia, inclusi i borghi piu' piccoli.
Rispondi ESCLUSIVAMENTE in JSON valido, senza markdown, senza commenti.
```

User prompt:
```
Elenca 4-5 punti di interesse REALI e VERIFICABILI a "${cityName}" (Italia, coordinate centro: ${lat}, ${lng}).
Tematica: ${themeDesc}.

REGOLE FONDAMENTALI:
- I nomi devono essere REALI (esistono veramente nel paese/citta')
- Le coordinate devono essere PRECISE e nel raggio di 3km dal centro
- Le descrizioni devono essere specifiche per quel luogo (non generiche)
- Se ${cityName} e' un piccolo paese, includi anche luoghi delle frazioni/aree limitrofe

Formato JSON richiesto:
{
  "pois": [
    {
      "name": "Nome reale del luogo",
      "description": "Descrizione specifica e interessante (max 120 caratteri)",
      "latitude": 41.xxxx,
      "longitude": 15.xxxx,
      "type": "church|piazza|monument|restaurant|park|museum|palazzo|viewpoint",
      "rating": 4.5
    }
  ]
}
```

---

## 3. User Preference Graph

### Schema attuale: NESSUNA tabella Supabase

Il "preference graph" e' **interamente client-side** tramite `localStorage`.

**Hook:** `src/hooks/useAILearning.js`
**Chiave localStorage:** `unnivai_ai_learning_brain`

| Campo | Tipo | Aggiornato quando | Usato dove |
|---|---|---|---|
| `generatedToursCount` | `number` | Dopo ogni generazione itinerario completata | `QuickPath.jsx` per contare tentativi e triggerare paywall (limite: 10) |
| `userDNAPreferences` | `Array<{mood, inspiration, duration, group, city, date}>` | Dopo ogni generazione (max ultimi 10) | **NON iniettato nel prompt AI** - registrato ma mai utilizzato |
| `hasUnlockedPremium` | `boolean` | Dopo submit form lead-gen (PaywallModal) | `QuickPath.jsx` per bypassare il paywall |

### Problemi del Preference Graph

1. **NON e' un grafo**: e' un semplice array di oggetti in localStorage
2. **NON alimenta la generazione AI**: i dati raccolti non vengono mai iniettati nel prompt
3. **Nessuna persistenza server-side**: cancellando localStorage si perde tutto
4. **Nessun controllo privacy**: l'utente non puo' vedere ne' eliminare le preferenze salvate
5. **Il paywall e' aggirabile**: basta cancellare `unnivai_ai_learning_brain` da localStorage
6. **Il form PaywallModal non invia realmente i dati**: il submit e' un `setTimeout` simulato, non salva ne' email ne' nome

---

## 4. Flow Generazione Itinerario

### Da AiItinerary.jsx (pagina dedicata)

```
Input utente (preferenze UI)
    |
    v
[budget, duration, interests[], group, pace] + userPrompt libero
    |
    v
aiRecommendationService.generateItinerary(city, prefs, userPrompt, weather)
    |
    v
Costruzione user prompt:
  - "Citta': ${city}"
  - "Meteo attuale: ${condition}, ${temp}C"
  - "Durata: ${duration}"
  - "Budget: ${budget}"
  - "Interessi: ${interests.join(', ')}"
  - "Tipo di gruppo: ${group}"
  - "Ritmo: ${pace}"
  - "Richiesta specifica: ${userPrompt}"
    |
    v
fetch('https://api.openai.com/v1/chat/completions')
  model: gpt-3.5-turbo
  temperature: 0.7
  max_tokens: 2000
  response_format: json_object
  timeout: 35s (AbortController)
    |
    +--- SUCCESSO ---> JSON.parse(raw)
    |                    |
    |                    v
    |              Sanitizzazione:
    |              - parseFloat coordinate
    |              - Filtra stops senza lat/lng
    |              - Valida mood e transit
    |              - Filtra giorni senza stops
    |                    |
    |                    v
    |              return { days: [...] }
    |                    |
    |                    v
    |              setGeneratedItinerary(days)
    |              Render UI cards
    |
    +--- ERRORE/TIMEOUT ---> generateItineraryLocal()
                              |
                              v
                        POI hardcoded (5 citta': Roma, Milano,
                        Firenze, Venezia, Napoli)
                        Citta' sconosciute: 1 stop generico
```

### Da QuickPath.jsx (quiz a step)

```
Quiz 5 step:
  1. Ambiente (citta/natura/etc - specifico per citta')
  2. Sub-opzione (es. "Rioni Storici", "Carbonara Tour")
  3. Orario (mattina/pomeriggio/sera)
  4. Durata (veloce/medio/lungo)
  5. Gruppo (solo/coppia/amici/famiglia)
    |
    v
*** NON chiama AI ***
Usa route hardcoded da SPECIFIC_ROUTES + MOCK_ROUTES
Safety timeout 12s con fallback al centro citta'
    |
    v
Naviga a /tour/:id con dati mock

NOTA: QuickPath importa aiRecommendationService ma in pratica
NON lo usa per la generazione. Usa solo dati mock/hardcoded.
```

### Da DashboardUser.jsx (Discovery POI)

```
Cambio citta' / caricamento dashboard
    |
    v
placesDiscoveryService.discoverAllThemes(cityName, lat, lng)
    |
    v
Per ogni tema (food, walking, romance, art, nature):
  1. Check localStorage cache (TTL 1h)
  2. Se cache miss: fetch OpenAI gpt-3.5-turbo
     - temperature: 0.4
     - max_tokens: 1200
     - timeout: 15s
  3. Parse JSON, filtra POI senza coordinate
  4. Arricchisci con Google Places photos (max 5 POI)
  5. Salva in localStorage cache
    |
    v
Render experience cards con foto reali
```

---

## 5. Punti di Chiamata AI (tutte client-side)

| Funzione | File | Modello | max_tokens | temperature | Timeout |
|---|---|---|---|---|---|
| `generateItinerary` | `aiRecommendationService.js` | gpt-3.5-turbo | 2000 | 0.7 | 35s |
| `enrichMonuments` | `aiRecommendationService.js` | gpt-3.5-turbo | default | default | nessuno |
| `chatWithGuide` | `aiRecommendationService.js` | gpt-3.5-turbo | 350 | 0.7 | 12s |
| `generateWeatherSocialTip` | `aiRecommendationService.js` | gpt-3.5-turbo | default | default | nessuno |
| `discoverPOIs` | `placesDiscoveryService.js` | gpt-3.5-turbo | 1200 | 0.4 | 15s |
| `analyzeBusinessDescription` | **NON ESISTE** (chiamato in DashboardBusiness ma mai definito) | - | - | - | - |

---

## 6. Validazione Output e Integrazione POI

### Validazione output AI

- **Sanitizzazione coordinate**: `parseFloat()` con filtro `!== null` per rimuovere stop senza coordinate valide
- **Validazione mood/transit**: whitelist di valori ammessi con fallback a `'default'`/`'walking'`
- **Struttura JSON**: accetta sia `{ days: [...] }` che array bare
- **Fallback su errore**: restituisce sempre un itinerario locale, mai un errore all'utente

### Verifica POI reali

- **NON c'e' verifica**: il modello genera nomi e coordinate. Non c'e' cross-check con Google Places, Mapbox, o altri database
- **Google Places e' usato SOLO per foto**: `placesDiscoveryService` usa `findPlaceFromQuery` ma solo per ottenere foto, non per validare l'esistenza del luogo
- **Rischio allucinazioni**: GPT-3.5-turbo puo' generare posti inesistenti con coordinate inventate. Nessun meccanismo di verifica

### Integrazione mappe

- **Mapbox**: usato per rendering mappa (`react-map-gl`), ma NON per geocoding/verifica POI
- **Google Places JS SDK**: usato solo per foto arricchimento

---

## 7. Altre Integrazioni AI

| Feature | Stato | Dettaglio |
|---|---|---|
| Content generation | Parziale | `enrichMonuments` genera note storiche e fun facts per POI |
| AI per raccomandazioni | **Non implementato** | `userDNAPreferences` raccolte ma mai usate nel prompt |
| AI per search/filtro | **Non implementato** | Nessun uso di AI per ricerca |
| Business analysis (vision) | **Rotto** | `analyzeBusinessDescription` chiamato in `DashboardBusiness.jsx:152` ma la funzione non esiste nel service. Crash a runtime |
| Chat guida turistica | Funzionante | `chatWithGuide` via GeminiDrawer (nome fuorviante, usa OpenAI non Gemini) |
| Weather social tip | Funzionante | Genera tip meteo/social nelle notifiche |

---

## 8. Problemi e Rischi (ordinati per criticita')

### CRITICO

1. **API KEY OPENAI ESPOSTA NEL BUNDLE CLIENT** - La chiave `sk-proj-...` e' leggibile da chiunque apra DevTools o scarichi il JS. Puo' essere usata per generare costi illimitati sull'account OpenAI. La chiave nel file `.env` e' in chiaro e committabile nel repo.

2. **GOOGLE MAPS API KEY ESPOSTA** - `AIzaSyAm6PP5A9E39h1G42rdgiVK9AhvanUkQgM` e' anch'essa nel `.env` e nel bundle client.

3. **SUPABASE ANON KEY ESPOSTA** - Stesso problema. Anche se la anon key e' "pubblica by design", averla nel `.env` insieme alle altre e' una pratica pericolosa.

4. **TUTTE LE CHIAMATE AI SONO CLIENT-SIDE** - Zero protezione: nessun rate limiting, nessuna autenticazione, nessun proxy. Un attaccante puo' fare migliaia di chiamate usando la key esposta.

### ALTO

5. **`analyzeBusinessDescription` non esiste** - Chiamato in `DashboardBusiness.jsx:152` ma mai definito nel service. Runtime crash quando un business tenta l'analisi AI.

6. **Nessuna verifica dei POI generati** - Il modello puo' inventare posti inesistenti. Le coordinate non vengono validate contro nessun database reale.

7. **Modello obsoleto (gpt-3.5-turbo)** - OpenAI ha deprecato progressivamente gpt-3.5-turbo. Qualita' inferiore rispetto a gpt-4o-mini (stesso costo) per task strutturati.

8. **Nessuno streaming** - L'utente attende fino a 35 secondi senza feedback progressivo. Pessima UX per generazioni lunghe.

9. **Naming fuorviante: "Gemini"** - I componenti `GeminiDrawer.jsx` e `GeminiAskButton.jsx` usano OpenAI, non Google Gemini. Confusione nel codebase.

### MEDIO

10. **User preference graph inutilizzato** - Le preferenze vengono raccolte ma mai iniettate nel prompt AI. Feature di "apprendimento" puramente cosmetica.

11. **Paywall client-side aggirabile** - Basta cancellare `unnivai_ai_learning_brain` da localStorage per resettare il contatore.

12. **PaywallModal non salva i dati lead** - Il form di "sblocco premium" simula un submit con `setTimeout` ma non invia ne' email ne' nome a nessun backend/CRM.

13. **SDK OpenAI installato ma mai usato** - `openai` v6.22.0 e' nel `package.json` ma tutte le chiamate usano `fetch`. Peso morto nel bundle.

14. **`enrichMonuments` senza timeout** - Puo' bloccarsi indefinitamente se l'API non risponde.

15. **`generateWeatherSocialTip` senza timeout** - Stesso problema.

16. **QuickPath non usa AI** - Importa `aiRecommendationService` ma genera itinerari da dati hardcoded/mock. Feature AI pubblicizzata ma non reale.

### BASSO

17. **Cache solo in localStorage** - Nessuna cache server-side. Ogni utente su device diverso ripete le stesse chiamate AI.

18. **Fallback locale limitato a 5 citta'** - Solo Roma, Milano, Firenze, Venezia, Napoli hanno POI hardcoded. Tutte le altre citta' ricevono un itinerario generico con 1 solo stop.

19. **Nessun logging/analytics delle chiamate AI** - Impossibile monitorare costi, errori, o latenza in produzione.

---

## 9. Costi AI Stimati

### Prezzi GPT-3.5-turbo (riferimento aprile 2026)

- Input: $0.50 / 1M tokens
- Output: $1.50 / 1M tokens

### Stima token per tipo di chiamata

| Funzione | Token input (stima) | Token output (stima) | Costo per chiamata |
|---|---|---|---|
| `generateItinerary` | ~800 | ~1500 | ~$0.0027 |
| `enrichMonuments` | ~300 | ~500 | ~$0.0009 |
| `chatWithGuide` | ~400 | ~300 | ~$0.0007 |
| `generateWeatherSocialTip` | ~300 | ~200 | ~$0.0005 |
| `discoverPOIs` (per tema) | ~500 | ~800 | ~$0.0015 |
| `discoverAllThemes` (5 temi) | ~2500 | ~4000 | ~$0.0073 |

### Scenario: utente tipo genera 1 itinerario + esplora dashboard

Una sessione tipica implica:
- 1x `generateItinerary` = $0.0027
- 1x `discoverAllThemes` (5 chiamate) = $0.0073
- 1x `generateWeatherSocialTip` = $0.0005
- 1x `enrichMonuments` = $0.0009
- **Totale per sessione = ~$0.011**

| Generazioni/mese | Sessioni stimate | Costo OpenAI | Costo Google Places (foto) |
|---|---|---|---|
| 100 | 100 | ~$1.10 | ~$5-15 (Places API) |
| 1,000 | 1,000 | ~$11 | ~$50-150 |
| 10,000 | 10,000 | ~$110 | ~$500-1,500 |

**ATTENZIONE**: Senza rate limiting e con la API key esposta, un attaccante potrebbe generare costi illimitati. Un singolo script malevolo potrebbe consumare centinaia di dollari in poche ore.

---

## 10. Raccomandazioni Immediate

1. **REVOCARE IMMEDIATAMENTE** la API key OpenAI esposta e generarne una nuova
2. **Creare un proxy server** (Supabase Edge Function o Vercel API route) per tutte le chiamate AI
3. Implementare **rate limiting** per utente (es. 10 generazioni/giorno per utente free)
4. Migrare a **gpt-4o-mini** (stesso costo, qualita' molto superiore)
5. Implementare **streaming** per migliorare la UX durante la generazione
6. Aggiungere **verifica POI** via Google Places per validare i luoghi generati dall'AI
7. Persistere le preferenze utente in **Supabase** e iniettarle nel prompt per personalizzazione reale
8. Implementare il **backend del paywall** con verifica server-side
9. Rimuovere il pacchetto `openai` inutilizzato o iniziare a usarlo (supporta streaming nativo)
10. Definire `analyzeBusinessDescription` nel service o rimuovere la chiamata
