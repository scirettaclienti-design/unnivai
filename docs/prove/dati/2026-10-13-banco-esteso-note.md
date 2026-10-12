## Prova che il motore non è cambiato

Le sole modifiche in `src/` sono `src/lib/simulatedNow.js` (nuovo) e **due righe** in `aiRecommendationService.js`:
`const requestTime = new Date()` → `requestNow(opts)` (generateItinerary) e `const now = new Date()` → `requestNow(opts)` (generateHomeTours).
`requestNow` restituisce `new Date()` se `opts.simulatedNow` manca, non è valido, o se `import.meta.env.PROD` (build di produzione).

- **Byte per byte, sul codice vero.** Stesso test (6 generazioni complete: 3 orari × `custom`/`quick`, Places e OpenAI finti, orologio fisso, senza `simulatedNow`) eseguito sul codice di HEAD `f18a7a0` (modifica tolta con `git apply -R`) e su quello nuovo: **entrambi 31 417 byte, sha256 `8f6402f9137ff186f10f52e1e2a3fd4162e0729403f93a0b6c70aee0f29661b4`** (`cmp` identico).
- **Test permanente** `src/__tests__/services/simulatedNow.test.js`: senza parametro = con il parametro uguale all'orologio (JSON identico); in produzione (`vi.stubEnv('PROD', true)`) un'ora simulata diversa è ignorata (JSON identico); nelle prove il parametro conta (la finestra del tour cambia).
- **Suite**: 1478 → 1503 test verdi (+25: ora simulata, controlli, orari, matrice, report).
- Non toccati: regole del motore, frasi, quote, prompt. Il secondo vincolo (testo libero, dieta, ritmo, umore, modalità come li passa l'app) è tutto negli script (`scripts/banco/esteso.live.js`), nessun cambio al motore.
- Non verificato: `generateHomeTours` (Per Te) non ha un test byte-per-byte come `generateItinerary`: la modifica è identica (stessa funzione, stessa riga) ma il test di JSON identico è solo sull'itinerario.

## Cosa ho letto da questo primo giro

- **Riprodotto dal telefono**: Veloce relax 21:25 a Catania → **1 sola tappa** (un'osteria, c4); trattorie a mattina/pomeriggio con «nei ristoranti tipici» (c2: 4 per caso a Catania); trattoria alle 12:30 chiusa fino alle 19:00 (c5); «Sono 1 minuti a piedi» presente in 5 casi su 30 (c7); `sunny` a schermo in tutti i 20 casi Crea/Veloce (c8, vedi sotto).
- **Veloce alle 21:45 e alle 23:30 NON seguono la previsione di D-CATANIA** («0 momenti» dalle 21:31): qui escono 4 e 5 tappe, di cui 3 e 4 chiuse all'ora di arrivo (c5). Il caso 21:45/23:30 va riletto: il motore costruisce un giro, ma di posti chiusi.
- **c6 = 0 su dati veri.** Nessun caffè da 75 min è comparso: i posti `bar+restaurant` del giro avevano nomi da tavola (Trattoria, Osteria…) e il controllo li tratta da pasti. Il controllo vede il caso cattivo noto (Caffè Savia), ma questo giro non ne ha prodotti: non è una prova che il difetto sia sparito.
- **c9 verde**: ONB-1 ha 13 passi (12 + il ripristino finale), tutti OK; il controllo richiede almeno 12.
- **c10 verde su 3 casi vegetariani**, ma il controllo (b) «esteso ai non pasti» ha come segnale solo le query del pool: ha una sola forma di evidenza.

## Cosa ho dato per vero senza verificarlo

1. **Il meteo.** Crea e Veloce ricevono `{ sunny, 20 }`, il valore di ripiego che le pagine usano quando `weatherCondition`/`temperatureC` mancano. L'app vera passa il meteo di `weatherService` (che usa le stesse parole inglesi), ma non l'ho chiamato: i **20 casi rossi di c8 vengono tutti da questa scelta**, non da un errore osservato nell'app. Inoltre **«meteo di adesso su tour futuro» non è mai stato esercitato**: nessun caso della matrice chiede «domani», quindi quella metà di c8 è provata solo sull'esempio costruito.
2. **Gli orari di apertura.** Il pool porta solo `open_now`, non i periodi: li ho presi con `place/details` (`fields=opening_hours`) **dopo** la generazione, per 120 posti distinti su 141 (21 non richiesti per il tetto di spesa, 8 senza orari su Google → «sconosciuto», 29 tappe in totale). Sono gli orari **settimanali di oggi**, applicati al mercoledì simulato 14/10/2026; chiusure straordinarie o festività non entrano. L'ordine di priorità (dove si mangia e beve, poi musei e negozi, poi il resto) significa che i non richiesti sono soprattutto chiese, parchi, piazze.
3. **Per Te non ha orari.** L'arrivo di ogni tappa è **stimato** (ora simulata + cammino + soste dichiarate): c1 e c5 su Per Te valgono per quella stima. Per Te gira a 3 tappe per tour per progetto: c4 non gli si applica.
4. **c4 su Veloce** usa la soglia di 4 tappe per tutti: un Veloce da «1-2 ore» difficilmente le contiene, quindi 7 Veloce su 9 rossi a «Giornata» nelle 12 voci è in parte la soglia, non il motore. Il difetto vero (1 tappa, nessuna dichiarazione) sta nei casi con 1 tappa.
5. **c1 e c2 si sovrappongono** (una trattoria alle 9:30 è sia c2 sia c3; il «secondo pranzo» è sia c1 sia c2): i totali per classe non si sommano in un numero di tour sbagliati. Le soglie (fasce 12:00–14:45 e 19:30–23:00, 3 ore fra due pasti, scala 2,5× per le soste) sono scelte mie, in `banco.config.json`.
6. **Il campione.** Un giro per caso: il modello non è deterministico, un numero come «6 su 30» non è una percentuale stabile. Le 12 voci usano le soglie del banco nazionale (costo $0,20 a caso con le foto stimate: rosso su Per Te perché ha 12-15 tappe).
7. **Le scelte del wizard di Veloce** (titoli «Relax › Benessere» ecc.) sono copiate da `QuickPath.jsx`; lo script si ferma se i titoli non ci sono più, ma non verifica che i **sotto-id** esistano per ogni città (Siracusa, Palermo e Firenze usano il ramo `default`).
8. **ONB-1 per c9** è l'unica prova «dopo logout» che ho: non copre un altro dispositivo né il rendering. L'esempio cattivo di c9 è costruito sul comportamento descritto nel report ONB-1, non rieseguito sul codice vecchio.
9. **Il costo** è stimato col listino di `banco.config.json` (token + chiamate Google contate), non letto dalla fatturazione; place/details pesa $3,00 dei $6,91 perché l'ho prudenzialmente contata $0,025 (per `fields=opening_hours` potrebbe costare molto meno). Le foto non sono caricate dallo script.
10. **Il deploy.** Vedi la sezione sotto.

## Deploy

- Push su `main`: commit `f9998d4`. Gate CI **ALL_GREEN**: «Lint & Test» e «E2E Smoke» entrambi `success`. Il primo push (`531ddff`) era rosso: `simulatedNow.test.js` dipendeva da `VITE_SUPABASE_URL` presente solo in locale (in CI manca `.env`) e il test «produzione» passava a vuoto; riprodotto in locale con ambiente vuoto, corretto in `f9998d4`.
- Vercel: i deployment non sono visibili dal team collegato a questa sessione (`list_deployments` vuoto, anche per lo sha). **Deploy da verificare da Ivano.**
