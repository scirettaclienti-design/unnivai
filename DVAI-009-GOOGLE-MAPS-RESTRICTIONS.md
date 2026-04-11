# DVAI-009 — Google Maps API Key: Restrizioni Obbligatorie

**Priorità:** CRITICA  
**Stato:** ⚠️ Richiede configurazione manuale in Google Cloud Console

---

## Problema

La Google Maps API Key è esposta nel bundle client (`VITE_GOOGLE_MAPS_API_KEY`).
Se non ristretta nella Google Cloud Console, chiunque può usarla per generare
costi illimitati sull'account Google.

**L'API key non può essere nascosta nel codice client** (è richiesta pubblicamente
dal browser per inizializzare l'SDK Maps). La mitigazione corretta è **restringere la key lato Google Cloud**.

---

## Azioni da eseguire in Google Cloud Console

### 1. Limitazione HTTP Referrer (OBBLIGATORIA)

1. Vai su [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials
3. Seleziona la API Key usata per Maps
4. In "Application restrictions" → seleziona **"HTTP referrers (web sites)"**
5. Aggiungi i seguenti referrer:
   ```
   https://unnivai.vercel.app/*
   https://*.unnivai.vercel.app/*
   http://localhost:5173/*
   http://127.0.0.1:5173/*
   ```
6. **Salva**

> Dopo questa configurazione, la key funzionerà SOLO dai domini autorizzati.

### 2. Limitazione API abilitate (OBBLIGATORIA)

Nella stessa key, in "API restrictions" → "Restrict key":
Seleziona SOLO le API effettivamente usate:

- ✅ Maps JavaScript API
- ✅ Places API
- ✅ Geocoding API  
- ✅ Directions API
- ❌ Tutte le altre (disabilita per prevenire abusi)

### 3. Budget cap giornaliero (FORTEMENTE CONSIGLIATO)

1. Vai su Billing → Budgets & alerts
2. Crea un budget per il progetto con:
   - **Budget:** €50/mese (o il valore appropriato)
   - **Alert:** 50%, 90%, 100%
   - **Azione al 100%:** considera di disabilitare la key (richiede webhook)

### 4. Monitoraggio utilizzo

- Vai su APIs & Services → Dashboard
- Imposta alerting su picchi anomali di utilizzo

---

## Verifica configurazione

Dopo aver applicato le restrizioni, puoi verificare che la key **non** funzioni da
un dominio non autorizzato con questo test:

```bash
# Da un dominio NON autorizzato, questa chiamata deve ritornare REQUEST_DENIED
curl "https://maps.googleapis.com/maps/api/geocode/json?address=Roma&key=VOSTRA_KEY" \
  -H "Referer: https://attacker.com"
```

Una risposta corretta sarà:
```json
{ "status": "REQUEST_DENIED", "error_message": "API keys with referer restrictions cannot be used with this API." }
```

---

## Stato nel codice

La key è referenziata tramite:
- `VITE_GOOGLE_MAPS_API_KEY` in `.env`
- `src/App.jsx` nel componente `<APIProvider apiKey={...}>`

Nessuna modifica al codice è richiesta — solo la configurazione Cloud Console.

---

**Effort stimato:** 30 minuti  
**Responsabile:** DevOps / Owner progetto  
**Da completare PRIMA del go-live pubblico**
