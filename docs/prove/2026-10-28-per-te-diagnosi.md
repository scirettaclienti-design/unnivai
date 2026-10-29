# Per Te — diagnosi (solo lettura)

Data: 28/10/2026. Cartella `/Users/mac2023ivanosciretta/unnivai-1b`, ramo `per-te-diagnosi` da `origin/main` (`489e35a`). Nessuna modifica al codice dell'app, nessun deploy, **nessuna scrittura sul database** (solo 2 `SELECT` aggregati su `dna_events` e `tours`, progetto UNNIVAI).
Riproduzione: `npx vitest run -c scripts/diagnosi-per-te/vitest.config.js` (funzioni vere del motore, rete finta, ora Roma 28/10 20:06 = CET, 0 $). Le righe `[PROVA]` citate sotto sono l'output di quel comando.

## Risposte in breve

1. **Alle 20:06 il motore genera UNA proposta, per progetto**, non ne perde altre: dalle 18:00 all'alba Per Te è "il giro della sera" (drink + passeggiata + cena) e i 5 temi non vengono nemmeno cercati.
2. **Il DNA di sera pesa pochissimo**: il drink è vincolato alla categoria «bar» e il DNA lo sposta solo di +0,08 di punteggio. Il wine bar è uscito perché il suo elenco di tipi Google include anche `restaurant`/`food`, e il DNA di Ivano ha Cibo 28 ma Serate ~0. La natura non è «esclusa» in città: lo è solo quella «da fuori».
3. **Un giro conta come completato** solo se `concludiGiro` scatta (tutte le tappe fatte *o saltate*) **e** l'ultima tappa è raggiunta o ≥ 60 % raggiunte. I giri di Ivano risultano 0 perché nel database il suo account ha **8 tappe saltate, 7 giri salvati, 0 tappe raggiunte, 0 giri completati**. In più il tasto **Fine** non registra mai un giro completato.
4. **Sì: «Attiva la tua posizione» ricompare con la posizione negata**, a ogni apertura di Home e Mappa.

## 1. Roma 20:06, DNA Natura 37 / Cultura 29 / Cibo 28 — quante proposte

Il percorso del codice:

| Passo | Dove | Cosa fa |
|---|---|---|
| Home, ramo "genera" | `src/pages/DashboardUser.jsx:54` | `sera = isSeraStart(new Date())`; se vero **non** chiama `discoverAllThemes` (`:58-63`): nessuna ricerca dei 4 temi |
| Le card dal DB | `src/services/dataService.js:80,238` | `GUIDE_TOURS_ENABLED = false` → `getToursByCity` restituisce `[]` sempre: nessuna card dal database (la tabella `tours` ha comunque 3 righe, tutte di Roma) |
| Soglia della sera | `src/lib/daySkeleton.js:89-94` | `isSeraStart`: dalle 18:00 (1080 min) all'alba (05:00). Alle 20:06 = 1206 min → vero (`[PROVA] isSeraStart = true`) |
| Scelta del ramo | `src/services/aiRecommendationService.js:3766-3767` | `_homeTemi` → `_homeSera` **prima** di guardare i pool dei temi |
| Il motore | `…:4175-4176`, `…:4190-4219` | `_homeDaMotore({durata:'Veloce', pathType:'quick', serale:true})` → `generateItinerary` → **`tours: [tour]`**, sempre un solo elemento (`…:4210-4218`) |

Prova: con `generateItinerary` finto, `generateHomeTours` a Roma 20:06 restituisce **`tour restituiti = 1`, `_source = unified-home`, `serale = true`**; `generateItinerary` è chiamato una volta con `prefs = {"duration":"Veloce","group":"solo","pace":"rilassato","interests":[]}` e `pathType = quick`. I `themedCandidates` (insider, food, cultura, nature) passati dalla Home **non vengono letti**.

«Dove si perdono le altre» (di giorno, per completezza; è il ramo `_homeTemi`, `…:3768-4160`): le card dei temi passano da (a) pool vuoti → `no-pools` (`:3776-3778`); (b) il modello propone un tema fuori dai pool → scartato (`:3886-3888`); (c) un `place_id` non fra i candidati del tema (`:3920-3930`); (d) dedup cross-tour: un posto già in un altro tour si perde (`:3936-3945`); (e) regola II.2, tappe senza testo tolte, tour sotto le 3 tappe aperte → `closed-now` (`:3750-3754`). Alle 20:06 **nessuno di questi passi viene eseguito**.

Altro limite: la card che Ivano vede è anche l'unica nella lista (`DashboardUser.jsx:198`, `slice(0, 5)` su 1 elemento).

## 2. Il DNA di sera e il wine bar

Lo scheletro che il motore costruisce alle 20:06 (`[PROVA]`, stesse funzioni di `daySkeleton.js`):

| Momento | Categorie | `soloCategorie` | Dove |
|---|---|---|---|
| aperitivo (drink) | `["bar"]` | sì | `daySkeleton.js:299-315` (dopo le 20:00 "il drink parte da adesso", 120 min) |
| passeggiata | `["punti panoramici","passeggiata","natura"]` | sì, opzionale | `daySkeleton.js:97`, `addEveningWalk` |
| cena | `["cibo"]` | no, opzionale, solo aperti | `daySkeleton.js:316-324` |

- **Il DNA non può cambiare le categorie della sera**: `soloCategorie` le fissa, e `interests: []` (`aiRecommendationService.js:4192`). Natura 37 / Cultura 29 / Cibo 28 entra **solo come punteggio** dentro la categoria (`dnaW` → `selectScoredCandidatePool` e `rankByMerit`, `…:2658-2660, 2814, 2979`) con `share` ≤ 0,45 (`candidateScoring.js:139-190`).
- **Quale categoria subentra quando la natura è esclusa**: nessuna "subentra" per peso. La regola (`…:2864-2894`, `senzaNaturaDiNotte`) toglie solo la natura **«da fuori»**: tipo selvatico, nome da monte/riserva, o parco a più di 3 km dal centro in una città (`src/lib/borgoConfini.js:80-93`). A Roma `[PROVA]`: Villa Borghese (park, 2 km) **resta** (affinità 0,37), Monte Mario e Parco degli Acquedotti **escono**, la Terrazza del Pincio resta (tipo cultura, 0,29). La passeggiata è quindi ancora scelta fra "panoramici/passeggiata/natura dentro la città"; la cena resta «cibo».
- **Perché è uscito un wine bar**: il drink è ristretto ai `bar`. `mapCandidateToCoreCategories` (`candidateScoring.js:56-64`) prende **tutte** le categorie dei tipi Google del locale. Un wine bar ha tipi `bar`+`restaurant`+`food` → `nightlife+food`. `[PROVA]` con DNA {natura .37, cultura .29, food .28, serate 0, share .30}:

| Drink | Categorie | Affinità DNA | Punteggio |
|---|---|---|---|
| Enoteca (wine bar: bar, restaurant, food) | nightlife+food | **0,28** | **0,728** |
| Bar Sport (bar) | nightlife | 0,00 | 0,644 |
| Cocktail Lab (bar, night_club) | nightlife | 0,00 | 0,644 |

  Il DNA «Cibo» dà al wine bar +0,084 su un bar normale a parità di voto/recensioni. È il solo contributo del DNA al drink. Il tipo `wine_bar` non è nella tabella `TYPE_TO_CORE` (`preferenceEngine.js:66-100`); `winery` sì (food).
- **Limite della prova**: i pesi delle altre categorie e la `share` reali di Ivano non li ho (non ho letto il suo profilo dal client); ho assunto Serate = 0 e `share` = 0,30. Il verso del risultato (wine bar > bar semplice) vale per qualunque Serate < Cibo.

## 3. Quando un giro conta come completato, e perché quelli di Ivano non risultano

**Regola** (`src/lib/giroCompletato.js:13-22`, decisione di Ivano): ultima tappa raggiunta **oppure** ≥ 60 % delle tappe raggiunte. "Raggiunta" = fatta, non saltata. `[PROVA]` 12 tappe: 0 raggiunte → no; 7 (58 %) → no; 8 (67 %) → sì; solo l'ultima → sì.

**Quando viene scritto**: `concludiGiro` (`MapPage.jsx:1532-1540`) scrive `tour_completed` solo se `giroCompletato(...)`, ed è chiamato **solo** da `avanzaDopo` quando `fatte + saltate >= totale` (`MapPage.jsx:1615`). `stop_reached` è scritto solo da `handlePOIUnlock` (`:1568`: geofence 25 m, `onArrived`/«Sono arrivato», `onPassataVista`); `stop_skipped` da «Salta» (`:1588`).

**Tre buchi**:
1. **«Fine» non registra niente**: `handleEndNavigation` (`MapPage.jsx:1054-1081`) manda solo `nav_complete`/`nav_abandon` (telemetria), mai `tour_completed`, nemmeno se hai raggiunto l'80 % delle tappe. Dal task NAV-MAPPA il tasto «Fine» sta nella scheda aperta (è mio): non cambia la regola, ma è il modo normale di chiudere un giro a metà.
2. **Un giro fatto a "Salta" non conta**: 12 saltate = 0 raggiunte, `giroCompletato` falso, e le `stop_skipped` non entrano in Mete (`dnaProfilo.js:96-146`).
3. **I giri solo salvati non sono nei contatori**: `contatoriDalRegistro` (`dnaProfilo.js:134-139`) legge solo `tour_completed` e `stop_reached`.

**Prova sul database** (`SELECT` aggregato su `public.dna_events`):

| Account | label | `stop_reached` | `tour_completed` | `stop_skipped` | `tour_saved` |
|---|---|---|---|---|---|
| `813d9dc6…` (unico account non-test con eventi) | — | **0** | **0** | **8** (24–27/10) | **7** (24/10) |
| `cee972ab…` (account di prova) | test | 218 | 64 | 43 | 26 |

`[PROVA]` `contatoriDalRegistro` con le righe di quell'account (8 skipped + 7 saved) → `{"giri":0,"citta":0,"tappe":0}`, `mete = 0`: esattamente «0 giri, 0 città, 0 tappe». Il registro **funziona** (l'account di prova ha 64 giri completati): è il comportamento di Ivano a non toccare nessuna delle tre condizioni. Assunzione: `813d9dc6` è l'account di Ivano (è l'unico non-test; non l'ho verificato con la mail).

## 4. «Attiva la tua posizione» con la posizione negata

**Sì, ricompare.** `serveBannerPosizione` (`src/hooks/useGeoPermesso.js:27-31`) restituisce falso solo con GPS già letto, coordinate presenti o permesso `granted`. `[PROVA]`: `denied` → **banner**; `prompt` → banner; `unknown` (Safari senza Permissions API) → banner; `granted` → nessuno; `denied` con coordinate di ripiego → nessuno.
- Compare in `DashboardUser.jsx:473` e `MapPage.jsx:2170`, a **ogni** montaggio. Nessuna memoria del "no".
- Premendo, `requestGPS` fallisce e il banner diventa «Posizione non disponibile» (`GpsActivationBanner.jsx:36-39`); il messaggio d'errore **non ha timeout** (quello di successo sì, 3 s) e resta fino al prossimo montaggio. Su iOS, con permesso negato, il tasto non può riaprire la richiesta: il banner promette qualcosa che non può fare.
- Non riprodotto con Safari vero (WebKit simulato non ha il pannello permessi iOS).

## Correzioni proposte, in ordine

1. **«Fine» registra il giro completato** quando `giroCompletato(activeRoute, completedSteps)` è vero (`handleEndNavigation`, riuso di `concludiGiro`). Risolve i giri persi a metà. Piccola, test facile.
2. **Contare anche i giri salvati o fatti a "Salta"**: decidere con Ivano cosa significa "giro" nelle Mete (oggi: 60 % raggiunte). Opzione: contatore separato "salvati". Decisione di prodotto.
3. **Per Te di sera: più di una proposta** (es. giro con cena prima / giro con drink e panorama, due ancore diverse) dallo stesso motore, senza AI nuova ma con più ricerche Places. Cambia costo e tempi: da pesare.
4. **DNA vero nel drink e nella passeggiata**: mappare `wine_bar` (e simili) a `nightlife` in `TYPE_TO_CORE`, o contare la categoria prevalente invece di tutte; dare ai pesi Serate un ruolo nel drink. Valutare se `interests: []` (`:4192`) debba prendere i primi interessi del DNA.
5. **Banner posizione**: nascondere con permesso `denied` e testo diverso ("Riattiva la posizione dalle impostazioni"), ricordare il rifiuto per la sessione, timeout al messaggio d'errore.

## Cosa NON risolvono

- Le correzioni 1–2 non cambiano retroattivamente i giri già fatti: i 7 giri salvati e le tappe saltate di Ivano restano 0 giri completati.
- Nessuna delle correzioni 3–4 rende Per Te «più Natura» di sera: il motore serale è drink + passeggiata + cena per costruzione, e la natura «da fuori» è esclusa per decisione di Ivano (NOTTE-FIX/BORGO-FIX).
- Il peso del DNA resta ≤ 0,45 del punteggio con 20+ eventi: il DNA ordina, non decide.
- La diagnosi usa un motore con rete finta e candidati d'esempio: **non** dice quale wine bar e quali tappe siano uscite a Ivano alle 20:06 (non ho il suo giro registrato); dice perché un wine bar vince su un bar semplice.
- Il banner non si prova su iPhone vero, e la `share` e i pesi reali del profilo di Ivano non sono letti.

## File

`scripts/diagnosi-per-te/per-te.diagnosi.js`, `scripts/diagnosi-per-te/vitest.config.js` (fuori dalla suite). Nessun file dell'app toccato.
