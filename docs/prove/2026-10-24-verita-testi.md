# VERITA-TESTI — l'app non dice più niente di falso in 5 punti noti

Ramo `verita-testi` → `main` (commit di codice `dccdd8e`), deploy `unnivai-n9zkvw7xz` READY, CI verde sullo stesso SHA.
Non toccati: motore di composizione (salvo la correzione del punto 5, dichiarata sotto), proxy AI, navigazione.

## I 5 punti

| # | Fatto quando | Esito | Come |
|---|---|---|---|
| 1 | nessuna notifica mostra un orario già passato (ora finta 17:41, chiusura 13:00) | ✅ | `src/lib/orariNotifica.js` (nuovo). In `generateWeatherSocialTip` la chiusura entra nel prompt solo se è davanti all'ora di chi legge; un locale già chiuso non è un candidato; se il modello scrive comunque un orario passato («chiude alle 13:00») la notifica si scarta. `ctx.now` permette l'ora finta. Test: `veritaNotificheOrari.test.js` (6) |
| 2 | il caricamento non nomina guide locali né meteo | ✅ | `AiItinerary.jsx`. Testi nuovi sotto |
| 3 | «Si comincia da qui» solo se la prima tappa è entro 150 m dall'utente | ✅ | `stopPhrases.js`: `PRIMA_TAPPA_MAX_M = 150`, `stopData({ distanzaUtenteM })`; il motore passa la distanza dal `startPoint` della richiesta. Senza posizione nota la frase non compare. Test in `veritaTesti.test.jsx` (100 m, 150 m sì; 151 m, 2 km, nessuna posizione no) |
| 4 | la durata è una sola e coerente fra intestazione e riepilogo | ✅ | Il numero era già unico (`displayedTourMinutes`); erano diversi **il formato** («circa 3h 30min» nell'intestazione, «3h 30m» nel riepilogo e in Sorprendimi) e **la fonte nei dettagli**: il «Durata» di `TourDetails` restava quello della creazione dopo un «Togli»/«Cambia». Ora una sola funzione di formato (`formatEstimate`) in `QuickPathSummary`, `SurpriseTour`, `DashboardUser`, e `TourDetails` ricalcola la durata dalle tappe di adesso per i giri dell'app |
| 5 | «domani un giorno a Catania» senza orario parte con la colazione | ✅ trovata la causa e corretta | sotto |

### Testo del caricamento (punto 2)

| prima | dopo |
|---|---|
| Creazione Itinerario... | Sto preparando il tuo giro |
| L'IA sta consultando le guide locali e analizzando il meteo. | Cerco i posti aperti agli orari del tuo giro e li metto in ordine a piedi. |
| Analisi preferenze | Le tue preferenze |
| Selezione gemme nascoste | Posti aperti all'ora giusta |
| Ottimizzazione percorso | Ordine a piedi |

Ogni riga descrive un passo che il motore fa davvero (preferenze, filtro sugli orari di apertura, ordine per distanza a piedi). Da approvare.

### Punto 5 — la causa

- Lo scheletro del giorno **metteva** la colazione: «domani un giorno a Catania» parte alle 9:30, prima delle 10:30. Test del solo scheletro e del motore con rete finta: colazione presente.
- **Prova dal vivo sul sito pubblicato** (WebKit iPhone 13, account di prova, `scripts/prova-giro-edit/domani-colazione.webkit.mjs`): prima della correzione la colazione mancava in **2 giri su 3** (09:30 Castello Ursino invece di Caffè Puglisi).
- Il log del motore dei giri senza colazione conteneva tutti `[C5 PERCORSO] g1-mattina "Castello Ursino" al posto di …`: il **ritocco di percorso** (`polishRoute`, `momentSelection.js`) scambia qualunque tappa di un momento con una «più sulla strada», colazione compresa. Quando lo scambio accorciava il cammino, il caffè diventava una visita.
- Correzione (4 righe): nel ritocco, la prima tappa di un momento con colazione, se è un posto da colazione, si scambia solo con un altro posto da colazione.
- Test sul caso esatto (`veritaColazionePercorso.test.js`): scheletro di «domani un giorno a Catania» chiesto alle 18:30, caffè lontano, visita più comoda nel bucket → senza la correzione la prima tappa è «Museo A» (il test fallisce), con la correzione resta il caffè.
- **Dopo il deploy: 4 giri su 4 con Caffè Puglisi alle 09:30** (`docs/prove/dati/2026-10-24-verita-domani-dopo1..4.json`). Prima: `…-prova2.json` e `…-prova3.json` senza colazione, `…-prova1.json` e `…-prima.json` con.
- Il difetto riguardava anche «alle 8:30»: non era comparso nella prova di GIRO-EDIT perché è intermittente (dipende da quali altri luoghi sono nel pool).

## Controlli

- Suite: 209 file, **2562 test verdi** (prima 206/2547; +3 file, +15 test). Aggiornati 3 file di test: formato della durata («circa 2h 10min», «~40 min»), ora finta nei test delle notifiche con chiusura 15:00, «prima» non più presente senza posizione.
- Lint: **0 errori**, 193 avvisi (gli stessi di `main`). Build ok.
- Guardia: **12/12**, pertinenza **nessun ❌ nuovo** (3 ❌ già noti).
- CI su `dccdd8e`: verde. Vercel: `unnivai-n9zkvw7xz` READY.
- Spesa: ≈0,45 $ (8 giri dal vivo con rete vera: Google ≈0,2 $ ai prezzi di listino, OpenAI ≈0,25 $; molte risposte erano in cache).

## Prova di 10 minuti per Ivano

Con il telefono, su https://unnivai.vercel.app:
1. **Colazione (2 min)** — «Crea», scrivi «domani un giorno a Catania», genera. Prima tappa: un caffè alle 9:30. Ripeti 3 volte, cancellando il giro: deve esserci sempre.
2. **Caricamento (1 min)** — durante la generazione leggi la schermata: niente guide locali, meteo, «gemme nascoste».
3. **Durata (2 min)** — nel riepilogo del giro e nei dettagli la durata è scritta uguale («circa 3h 30min»). Premi «Togli» su una tappa: la durata nei dettagli cambia.
4. **«Si comincia da qui» (2 min)** — leggi la prima tappa di un giro: la frase non c'è. Compare solo se sei a meno di 150 m dalla prima tappa e l'app conosce la tua posizione.
5. **Notifiche (3 min)** — dopo le 13:00 le notifiche dei locali non devono dire «chiude alle 13:00» o altri orari già passati; se nessun locale chiude più tardi, nessuna notifica.

## `git log --oneline -5 main`

```
dccdd8e VERITA-TESTI: nessun orario passato nelle notifiche, caricamento onesto, «Si comincia da qui» solo entro 150 m, durata unica, colazione non più scambiata dal ritocco di percorso
585599b NAV-3: report con gli stati costruiti, controlli, merge, deploy, 8 prove a piedi e cosa non è risolto
8050cca NAV-3: la navigazione diventa una guida — stati 1 (cammino), 3 (arrivo), 4 (scheda tappa), 5 (fine giro), 6 (mappa che cambia con l'ora), 8 (rito d'arrivo), 9 (filo del giorno)
9924ab9 NAV-3 (stati 1,3,4,5,8,9 e stile mappa): la navigazione diventa una guida
fa20daa NAV-2: report con km prima/dopo, prove WebKit, replay NAV-SIM, controlli, merge, deploy e cosa non è risolto
```

## Cosa NON risolve

- **Punto 3**: il motore conosce la posizione dell'utente solo tramite `opts.startPoint`. «Per Te» non lo passa, quindi lì «Si comincia da qui» non compare mai (meglio che dirlo falso; passare la posizione è un lavoro a parte). Nei giri già salvati (cache) la frase si ricompone senza posizione, quindi non c'è.
- **Punto 1**: copre le notifiche del meteo/social (`generateWeatherSocialTip`). Altre notifiche generate (ricette fisse, `notificationRecipes`) non contengono orari. La cache degli orari di apertura dura 24 ore: la chiusura «di oggi» letta ieri sera potrebbe essere del giorno prima (non cambiato).
- **Punto 4**: per i tour delle guide umane (non generati) `TourDetails` mostra ancora la durata salvata.
- Il difetto della colazione era intermittente: 4 giri su 4 corretti non sono una prova di assenza.

## Cosa ho dato per vero senza verificarlo

- Che l'«ora di chi legge» sia l'ora del dispositivo (`new Date()`), come nel resto del codice delle notifiche; non ho provato un utente con fuso diverso da Roma.
- Che `opts.startPoint` sia la posizione dell'utente: nei chiamanti che ho letto è il punto di partenza dichiarato (può essere un albergo). «Entro 150 m dall'utente» vale per il punto di partenza.
- Che il difetto della colazione abbia come unica causa il ritocco di percorso: lo dicono il log (la riga compare in entrambi i giri senza colazione e non in quelli con) e il test che fallisce senza la correzione; non ho escluso altre cause rare.
- Che 4 giri dal vivo su un solo account e una sola città bastino a dire «corretto»: sono una prova, non una garanzia.
- Che il nuovo testo del caricamento sia nella voce Unnivai: non l'ho fatto leggere a nessuno.
- Nessuna prova su iPhone vero: solo WebKit con profilo iPhone 13.

## Processi

Nessun server avviato da me; i browser di Playwright si chiudono a fine script.
