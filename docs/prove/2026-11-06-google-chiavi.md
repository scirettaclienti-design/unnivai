# GOOGLE-CHIAVI — due chiavi Google, una per il browser e una per il server (06/11/2026)

Stato del task: **codice pronto e su main, passaggio delle chiavi: aspetta Ivano** (riga L10 di `docs/LANCIO.md`, resta «aspetta Ivano»). Nessuna funzione pubblicata, nessun secret toccato, nessuna console toccata, nessuna chiamata a Google fatta in questo task (0 $ AI, 0 $ Google). In questo report non c'è nessuna chiave intera.

## Cosa cambia per Ivano

- Oggi una sola chiave Google (`…kQgM`) serve il browser **e** le funzioni, è nel sito e nella storia git, e risponde da qualunque sito (`docs/prove/2026-11-05-segreti-storia.md`). Dopo i passi qui sotto: una chiave per il browser (ristretta per sito e per API) e una per il server (ristretta per API, nel secret `GOOGLE_SERVER_KEY`), e la `…kQgM` revocata.
- **Il sito non si rompe durante il passaggio**: il codice di main funziona con la chiave di oggi e con quelle nuove. L'ordine dei passi lo garantisce (prima il server, poi il browser, la revoca per ultima).
- Scoperta importante: il **Geocoding REST** (nome della città dal GPS, coordinate di una città) veniva chiamato **dal telefono** con la chiave del browser. Google non ammette quella chiamata con una chiave ristretta per sito (risposta `REQUEST_DENIED`): ristretta la chiave, la città dal GPS sarebbe caduta su Nominatim e le coordinate di una città fuori elenco sarebbero sparite. Ora passa dal server (`places-proxy`, path `geocode`), con il ripiego di oggi finché il server non è aggiornato.

## Dove si usano le chiavi (ricerca nel codice)

Ricerca su `supabase/functions/`, `src/`, `vite.config.js`, `scripts/`, `.github/`, `capacitor.config.json`, `index.html`: `VITE_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_*_KEY`, `maps.googleapis.com`, `places.googleapis.com`, `key=`, `X-Goog-Api-Key`, `google.maps.*`, `useMapsLibrary`.

**Funzioni (server)**: nessuna legge `VITE_*` (controllato da un test, vedi sotto).

| File | Cosa fa con Google | API Google | Chiave letta |
|---|---|---|---|
| `supabase/functions/places-proxy/index.ts` (+ `placesNew.ts`) | ricerca dei posti, dettagli, foto, geocoding (nuovo path `geocode`) | Places API (New) `places:searchText` e foto `…/media`; Places API (legacy) `findplacefromtext`, `details`, `textsearch`, `nearbysearch`, `photo`; Geocoding API | `GOOGLE_SERVER_KEY`, se manca `GOOGLE_MAPS_API_KEY` |
| `supabase/functions/openai-proxy/index.ts` + `curiositaFonti.ts` | geocoding inverso delle curiosità (via, quartiere); le fonti dei racconti passano dal geocoding e da Wikipedia/Photon/Nominatim, non da Places | Geocoding API | `GOOGLE_SERVER_KEY`, se manca `GOOGLE_MAPS_API_KEY` |
| `vite.config.js` (solo `npm run dev`, specchio del proxy) | stesse chiamate di places-proxy, solo in locale | Places legacy, Geocoding | `GOOGLE_SERVER_KEY` o `GOOGLE_MAPS_API_KEY`; **non** più `VITE_GOOGLE_MAPS_API_KEY` (in locale va messa una delle due in `.env.local`) |

Le altre funzioni (`avvisi`, `create-checkout`, `elimina-account`, `lista-attesa-email`, `stripe-webhook`) non usano Google.

**Browser (app e sito)**: chiave `VITE_GOOGLE_MAPS_API_KEY`, letta in `src/components/MapAPIWrapper.jsx` (SDK Maps) e in `src/lib/geocodeGoogle.js` (solo ripiego di transizione).

| Cosa | Dove | API Google |
|---|---|---|
| Mappa, marcatori, Map ID (stile Ossidiana) | `MapAPIWrapper.jsx`, `Map/GoogleMapContainer.jsx` (libreria `marker`) | Maps JavaScript API |
| Ricerca città con suggerimenti | `Map/CitySearchBar.jsx`: `AutocompleteService`, `AutocompleteSessionToken` | Places API (legacy, tramite libreria `places`) |
| Dettagli di un posto | `pages/MapPage.jsx` (`PlacesService`) | Places API (legacy) |
| Indirizzo → posizione | `Map/CitySearchBar.jsx` (`Geocoder` della libreria `geocoding`) | Geocoding API (servizio JS, ammette referrer) |
| Percorsi a piedi nel giro | `hooks/useTourRouting.js` (`DirectionsService`, libreria `routes`) | Directions API |
| Geocoding REST (città dal GPS, coordinate di una città) | `hooks/useEnhancedGeolocation.js`, `services/userContextService.js` (due punti) | **era diretto, ora via `places-proxy` path `geocode`**; ripiego diretto solo di transizione |

Nessun altro punto del browser chiama Google con una chiave (`key=` compare solo in `geocodeGoogle.js` e nelle funzioni). Le foto dei posti arrivano da `places-proxy` con un 302 verso il CDN di Google, senza chiave.

## Cosa è cambiato nel codice

- `places-proxy` e `openai-proxy`: leggono prima `GOOGLE_SERVER_KEY`, poi (ripiego) `GOOGLE_MAPS_API_KEY`. Pubblicare il codice prima del secret nuovo non cambia nulla.
- `places-proxy`: nuovo path `geocode` (Geocoding API, in cache 24 h come gli altri JSON). Un path non ammesso risponde 403: è così che l'app capisce che il server non è ancora aggiornato.
- `src/lib/geocodeGoogle.js` (nuovo): prima il server, poi — solo se il server non risponde o il path non c'è ancora — la chiamata diretta di oggi con la chiave del browser; ogni tentativo ha 5 s di tempo massimo. Se Google la nega, i chiamanti hanno il loro ripiego (Nominatim per la città dal GPS; nessuna coordinata per una città fuori elenco).
- Il ripiego diretto è da togliere dopo la pubblicazione (nota nel file). Il ripiego `GOOGLE_MAPS_API_KEY` nelle funzioni si toglie dopo la revoca (passo 10).

## Prove

- `src/__tests__/functions/googleChiavi.test.js` (nuovo, 16 prove):
  - **fallisce se un file di `supabase/functions/` contiene `VITE_`** e se `vite.config.js` legge `VITE_GOOGLE`;
  - fallisce se una funzione legge `GOOGLE_MAPS_API_KEY` senza leggere prima `GOOGLE_SERVER_KEY` (e fissa l'elenco: solo places-proxy e openai-proxy);
  - places-proxy caricato davvero: con `GOOGLE_SERVER_KEY` usa quella; senza, usa quella di oggi; secret nuovo vuoto = assente; nessuna delle due = 500 e nessuna chiamata a Google; una `VITE_GOOGLE_MAPS_API_KEY` nell'ambiente non viene mai usata; il path `geocode` va a Geocoding;
  - browser: `VITE_GOOGLE_MAPS_API_KEY` si legge solo in `MapAPIWrapper.jsx` e `geocodeGoogle.js`; `maps.googleapis.com/maps/api/geocode` compare solo in `geocodeGoogle.js`;
  - `geocodeGoogle`: server prima (mai Google diretto), 403 del server → ripiego di oggi, chiave ristretta + server giù → `null`, nessuna chiave + server giù → nessuna richiesta a Google.
- Adattati due test esistenti (stesso significato): `placesProxyLegacy.test.js` (l'elenco dei path ammessi ora include `geocode`, unica differenza voluta) e `userContextService.test.js` (il modulo importa il builder del proxy; il test del nome intatto legge il parametro decodificato).
- Suite completa 279 file, 3459 prove, tutte verdi; lint 0 errori (188 avvisi già presenti); build ok; `npm run banco:guardia` passata prima del merge (home 12/12, banco 40 10/10).
- Non provato qui: il comportamento reale di Google con chiavi ristrette (non ho creato né toccato chiavi); la pubblicazione delle funzioni (vietata in questo task).

## Restrizioni da impostare in console Google (https://console.cloud.google.com/apis/credentials)

### Chiave del BROWSER (nuova, nome suggerito «Unnivai browser»)

- **Application restrictions: HTTP referrers (web sites)**, queste voci:
  - `https://unnivai.vercel.app/*`
  - `https://unnivai.com/*`
  - `https://*.unnivai.com/*`
  - `http://localhost:*/*`
  - per l'app iOS: `capacitor://localhost/*` (vedi sotto; da provare)
  - Anteprime Vercel (`https://unnivai-*-….vercel.app`): non incluse, perché `https://*.vercel.app/*` sarebbe aperto a tutti i progetti Vercel. Se servono, aggiungere solo il prefisso del progetto, ad esempio `https://unnivai-*.vercel.app/*`.
- **API restrictions: Restrict key**, queste 4 API: **Maps JavaScript API**, **Places API** (la legacy, serve a `AutocompleteService` e `PlacesService`), **Geocoding API** (serve al `Geocoder` JS della ricerca città), **Directions API** (serve a `DirectionsService`). Niente altro (non «Places API (New)», non Routes, non Static Maps).
- Il Map ID (`VITE_GOOGLE_MAP_ID…`) non è una chiave: non si tocca.

### Chiave del SERVER (nuova, nome suggerito «Unnivai server»)

- **Application restrictions: nessuna.** Un limite per IP non è possibile: le Edge Functions di Supabase non hanno IP in uscita fissi (cambiano e non sono pubblicati), un elenco di IP romperebbe le funzioni a caso. Un limite per referrer non vale per le chiamate server (nessun Referer).
- **API restrictions: Restrict key**, queste 3 API: **Places API**, **Places API (New)**, **Geocoding API**. Niente Maps JavaScript, niente Directions.
- Compenso al limite mancante per IP: la chiave sta solo nei secret di Supabase (mai nel codice, nel sito o nel repo), ha il limite per API, e si mettono **quote giornaliere e un avviso di budget** (console → APIs & Services → ogni API → Quotas; Billing → Budgets & alerts, avvisi al 50/90/100 %).

### Origine dell'app iOS (Capacitor 8)

- Stato nel repo: `capacitor.config.json` ha solo `appId: it.unnivai.app`, `appName`, `webDir: dist`, **nessuna sezione `server`**. Quindi l'app iOS gira con l'origine predefinita di Capacitor su iOS, **`capacitor://localhost`** (nessun `iosScheme` né `hostname` impostati).
- **Google accetta quello schema come referrer?** Non l'ho potuto verificare senza toccare la console. Evidenza trovata: la discussione ionic-team/capacitor #6576 riferisce che aggiungere `capacitor://localhost/*` fra i siti ammessi della chiave ha risolto una Maps JS in un'app Capacitor. Non è documentazione Google, quindi: **prima prova**, da fare quando c'è l'app su un telefono (da Xcode, dal 10/11).
  - Verifica: aggiungere `capacitor://localhost/*`, salvare (se la console rifiuta la riga, è il segnale per il piano B), aprire la mappa nell'app: se la mappa resta grigia con l'errore `RefererNotAllowedMapError` nel Web Inspector di Safari, piano B.
- **Piano B — chiave separata per iOS**: una terza chiave «Unnivai iOS» con le stesse 4 API del browser e **senza** restrizione di applicazione (l'opzione «iOS apps» con bundle id `it.unnivai.app` vale solo per Maps SDK nativo, non per Maps JavaScript, che accetta solo referrer). Più debole: chi la estrae dall'app può usarla ovunque, ma solo per quelle 4 API; si compensa con una quota giornaliera bassa dedicata e si può revocare senza toccare il sito. Si costruisce l'app iOS con quella chiave in `VITE_GOOGLE_MAPS_API_KEY` (variabile del build iOS, non di Vercel).
- **Piano C — `server.iosScheme: 'https'` con `server.hostname` dedicato** (es. `app.unnivai.com`): l'origine diventa `https://app.unnivai.com` e il referrer standard `https://*.unnivai.com/*` (già in lista) la copre, senza chiave né voce speciale. Pro: nessuna voce non standard; la stessa chiave del browser. Contro: cambia l'origine, quindi `localStorage`/sessione di chi ha già l'app si azzerano (oggi non è un problema: l'app non è ancora pubblicata); `iosScheme: https` è riferito come accettato da Capacitor ma da provare su un telefono (alcune versioni lo rifiutano e ripiegano su `capacitor`); i cookie e le chiamate cross-origin cambiano origine (le regole CORS di Supabase non sono un problema: usa `*`, ma da provare login e pagamenti).
- **Consiglio**: ordine di prova 1) `capacitor://localhost/*`; 2) se non funziona, piano C; 3) piano B solo se C non funziona. Non cambio `capacitor.config.json` in questo task: la scelta dipende da una prova su dispositivo.

## Passi per Ivano, in ordine (il sito non si rompe mai)

Prima di cominciare: tieni le chiavi in variabili d'ambiente (`export CHIAVE_SERVER=…`), non incollarle in chat, nei file o nella cronologia.

1. **Aspetta il «sì» a T22 VOCE-TEST** (il deploy di `openai-proxy` da main pubblica anche il suo codice) oppure pubblica solo `places-proxy` al passo 4 e rimanda `openai-proxy`: in quel caso la riga «curiosità con Google» continua con la chiave vecchia fino a quando lo pubblichi; la revoca (passo 10) va dopo.
   - Verifica: `git -C ~/unnivai-ricresa log origin/main --oneline -3` mostra il merge del task GOOGLE-CHIAVI.
2. **Crea la chiave del server** (console, restrizioni sopra: nessuna applicazione, 3 API). Non toccare ancora nulla di vecchio.
   - Verifica (la chiave in variabile, non scritta nel comando):
     `curl -s "https://maps.googleapis.com/maps/api/geocode/json?address=Roma&key=$CHIAVE_SERVER" | head -c 200` → `"status" : "OK"`;
     `curl -s "https://maps.googleapis.com/maps/api/directions/json?origin=Roma&destination=Napoli&key=$CHIAVE_SERVER" | head -c 300` → `REQUEST_DENIED` (prova che la restrizione per API tiene; può servire un minuto dopo il salvataggio).
3. **Metti il secret**: `supabase secrets set GOOGLE_SERVER_KEY="$CHIAVE_SERVER" --project-ref ahecpiwsdhghkndncejb`. Le funzioni oggi in linea non lo leggono ancora: nessun effetto.
   - Verifica: `supabase secrets list --project-ref ahecpiwsdhghkndncejb | grep GOOGLE` mostra `GOOGLE_SERVER_KEY` e `GOOGLE_MAPS_API_KEY`; il sito funziona come prima.
4. **Pubblica `places-proxy`** da main aggiornato: `supabase functions deploy places-proxy --project-ref ahecpiwsdhghkndncejb`. Da qui il server usa la chiave nuova e l'app prende il geocoding dal server.
   - Verifica: `curl -s "https://ahecpiwsdhghkndncejb.supabase.co/functions/v1/places-proxy?path=geocode&address=Roma&language=it" | head -c 200` → `"status":"OK"` (prima del deploy: `Path not allowed`); `…?path=place/textsearch&query=trattoria%20Catania&location=37.5,15.08&radius=20000&language=it` → risultati; poi in console → APIs & Services → Credentials → «Unnivai server» → il grafico delle richieste sale; nel sito, apri un giro e guarda che i posti compaiano.
5. **Pubblica `openai-proxy`** da main aggiornato (secondo gli stessi passi che usi di solito, dopo CI verde): le curiosità usano la chiave nuova.
   - Verifica: genera una curiosità dal telefono (voce del telefono) e guarda i log della funzione: la riga `curiosità: fonti nuove richieste google=1 …` compare e non c'è `REQUEST_DENIED`.
6. **Crea la chiave del browser** (console, referrer e 4 API sopra). Ancora **non** cambiare il sito.
   - Verifica: la pagina Credentials mostra le 5 voci di referrer e le 4 API; la vecchia `…kQgM` è ancora attiva.
7. **Cambia la chiave nel sito**: Vercel → progetto unnivai → Settings → Environment Variables → `VITE_GOOGLE_MAPS_API_KEY` (Production e Preview) = chiave del browser; poi Redeploy (la chiave entra nel sito al build, un redeploy è necessario).
   - Verifica: apri https://unnivai.vercel.app, la mappa, la ricerca città e un percorso a piedi funzionano; Console del browser senza `RefererNotAllowedMapError`; nel sito pubblicato cerca la chiave vecchia: `curl -s https://unnivai.vercel.app/assets/MapAPIWrapper-*.js | grep -c kQgM` (il nome del file cambia a ogni build: lo trovi in `curl -s https://unnivai.vercel.app/ | grep -o 'assets/[^"]*\.js'` e nei chunk collegati) deve dare 0. Prova di restrizione: apri il sito in locale su `http://127.0.0.1:5173` (non è in lista) → mappa grigia con `RefererNotAllowedMapError`; su `http://localhost:5173` → mappa normale.
8. **App iOS**: con l'app su un telefono, prova `capacitor://localhost/*` (vedi sopra) e, se serve, piano C o B. Verifica: mappa visibile nell'app.
9. **Aspetta 24 ore**, poi in console (APIs & Services → Metrics, raggruppa per credenziale): la vecchia `…kQgM` deve avere richieste quasi a zero (restano schede aperte con il vecchio sito). Se no, trova chi la usa prima di revocare.
10. **Revoca la `…kQgM`**: console → Credentials → elimina la chiave; poi `supabase secrets unset GOOGLE_MAPS_API_KEY --project-ref ahecpiwsdhghkndncejb` (le funzioni usano già `GOOGLE_SERVER_KEY`).
    - Verifica: `curl -s "https://maps.googleapis.com/maps/api/geocode/json?address=Roma&key=$CHIAVE_VECCHIA" | head -c 200` → `REQUEST_DENIED` (chiave non valida); sito, giro, ricerca città e una curiosità funzionano ancora; `…?path=geocode&address=Roma` risponde `OK`.
11. **Scrivi la data della revoca nella riga L10** di `docs/LANCIO.md` (insieme a Mapbox `…QIdA`, da eliminare, e Anthropic `…UQAa`, da confermare revocata). Poi un piccolo task di pulizia: togliere il ripiego diretto da `src/lib/geocodeGoogle.js` e il ripiego `GOOGLE_MAPS_API_KEY` dalle due funzioni (il test `googleChiavi.test.js` va adattato).

Se qualcosa si rompe dopo il passo 7: rimetti la chiave vecchia in `VITE_GOOGLE_MAPS_API_KEY` e redeploy (la `…kQgM` è ancora viva fino al passo 10).

## Costo

- AI: 0 $ (nessuna chiamata a modelli).
- Google: 0 $ (nessuna chiamata a Google in questo task; nessun test con rete).
- A regime: il geocoding del telefono passa dal server con cache di 24 h per richieste identiche: non aumenta il costo Google, lo riduce se più persone chiedono la stessa città.

## Cosa NON risolve

- La chiave `…kQgM` resta nella storia git e nei vecchi bundle: l'unico rimedio è la revoca (passo 10); la storia non si riscrive.
- Una chiave del browser, per natura, si legge dal sito: la restrizione per sito protegge da altri siti, non da chi falsifica l'intestazione `Referer` con uno script fuori dal browser. Per questo le quote giornaliere e l'avviso di budget (passi 2 e 6) contano quanto le restrizioni.
- La chiave del server non può avere un limite per IP (Edge Functions senza IP fissi).
- Mapbox `…QIdA` e Anthropic `…UQAa` non sono toccate (restano in L10).
- Non è stata provata dal vivo né la pubblicazione delle funzioni né la restrizione reale in console; l'origine `capacitor://localhost` è da provare su un telefono.
