# DIAGNOSI-NOTTE — perché dopo mezzanotte i giri si comportano da mattina, e perché il primo Quiz del giorno va in errore

Solo diagnosi. Ramo `diagnosi-notte` da `origin/main` (`abc3749`). Nessuna correzione nel codice dell'app, nessun push su main, nessun deploy, nessuna migrazione, nessuna scrittura nel database, **spesa 0 $** (nessuna generazione vera: replay dai tracciati e orologio simulato).
Fonti: `~/DoveVai-prove-video/prove-sim/report.md` (+ `prova-2/3/8/9`), `docs/prove/2026-10-16-borgo-completo.md`, `CLAUDE.md`.

**Il codice in produzione è quello di main per i file in causa**: la versione letta nel Profilo (`5b82249`) è antenata di `abc3749` e `git diff 5b82249 origin/main` sui file del motore, di `QuickPath`, `daySkeleton`, `dayMoments`, `tourWindow`, `stopMoments` non mostra differenze (solo 2 righe in `SurpriseTour.jsx` e `AiItinerary.jsx`).

## Sintesi

| | Difetto 1 — dopo mezzanotte «da mattina» | Difetto 2 — il primo Quiz del giorno va in errore |
|---|---|---|
| Ipotesi del regista | **Confermata**, ma non è un solo punto: sono **tre** modi diversi di sbagliare lo stesso giorno | **Confermata** (e il Quiz è l'unico flusso con un tempo massimo di pagina) |
| Causa in una riga | «Sera» e «giorno» si decidono sul **giorno di calendario**: dopo le 00:00 la finestra è del giorno nuovo, il cui tramonto è alle 18:17 (le 02:00 sono «prima del tramonto»), e la tabella dei momenti chiama dopocena solo 00:00–00:29 | Timer fisso di **35 s** nella pagina del Quiz; il motore aspetta la lista nuova della città fino a **110 s** e la lista nuova ha impiegato 31–58 s |
| Punti del codice | `src/lib/dayMoments.js:45`; `src/services/aiRecommendationService.js:2833` e `:3413` | `src/pages/QuickPath.jsx:608-613`; `src/services/aiRecommendationService.js:2436`; `src/services/cityKnowledgeService.js:12` |
| Prova | `scripts/diagnosi-notte/difetto1.diagnosi.js` (11 test rossi su main, 1 controllo verde) + `replay-notte.mjs` (motore vero, 0 $, 6 celle rosse su main) | `scripts/diagnosi-notte/difetto2.diagnosi.js` (3 test rossi su main, 1 controllo verde) |
| Correzione minima | 3 righe (sotto) | 1 riga (sotto), con un limite: l'attesa resta |
| Provata come proposta | Sì, a titolo di esperimento **poi annullato** (`git checkout -- src`): test e replay verdi, suite 2165/2165, guardia 12/12 | Sì, stesso esperimento: 3 test verdi |

Come rilanciare le prove (su main falliscono apposta, per questo sono fuori dalla suite e la CI non le tocca):

```
npx vitest run -c scripts/diagnosi-notte/vitest.config.js      # difetto 1 (puro) + difetto 2 (pagina vera, tempo virtuale)
node scripts/diagnosi-notte/replay-notte.mjs                    # difetto 1 col motore vero, dai tracciati (0 $, nessuna rete); esce 1 su main
DIAGNOSI_SCRIVI=1 npx vitest run -c scripts/diagnosi-notte/vitest.config.js scripts/diagnosi-notte/tabella.diagnosi.js   # rigenera la tabella
```

---

## 1) Difetto 1 — dopo mezzanotte almeno un flusso legge l'ora come mattina

### Causa

Tre punti, tutti con la stessa radice: *la sera del giorno prima* non esiste come concetto, esiste solo «il giorno di calendario» e «l'ora».

1. **La tabella dei momenti** (`dayMoments.js:41-48`, `momentAtClock`): il dopocena finisce alle 24:30, e la funzione lo riconosce con `t + 24*60 < min(dopocena.end)`, cioè solo **00:00–00:29**. Da 00:30 alle 09:29 restituisce **la mattina** («prima della mattina vale la mattina»). Il resto dell'app invece dice che è ancora sera fino alle **05:00** (`isSeraStart`, `daySkeleton.js:87-94`, e `perTeSalvato.js`). Due definizioni di «sera» nello stesso codice.
2. **Sorprendimi e Rigenera giorno** (`SurpriseTour.jsx:224`, `AiItinerary.jsx:345`) non passano `pathType`: la finestra è calcolata come un Veloce (da adesso, +4 ore: `resolveTourWindow` ha `pathType = 'quick'` di default) ma lo scheletro no (`veloce = opts.pathType === 'quick'`, `aiRecommendationService.js:2811`, quindi `false`). Lo scheletro scorre la tabella dei momenti, nessun momento si sovrappone a 00:30–04:30, scatta la riserva «mai uno scheletro vuoto» (`daySkeleton.js:347-352`) che sceglie `momentAtClock` → **mattina**, con le categorie della mattina (`cultura, monumenti, musei, passeggiata`) e `soloCategorie`: **nessun bar, nessun ristorante, nessuna natura**. È la sezione «MATTINA» e l'assenza di locali di Bologna 01:45, ed è il motivo per cui Troina Sorprendimi → Natura era «corretto»: Monte Muganà non c'era *per caso* (la mattina non ha la categoria natura), non per la regola della notte, e infatti **manca anche la nota** «La natura di notte non si vede…».
3. **«Dopo il tramonto»** (BORGO-FIX decisione 3). La regola esiste due volte, sempre confrontando l'inizio del giro col tramonto del **giorno della finestra** (`tourWindow.date`):
   - `aiRecommendationService.js:2831-2833` (`tramontoDi` / `dopoIlTramonto`): toglie dai momenti la natura «da fuori»;
   - `aiRecommendationService.js:3413`: scrive la nota di Ivano.

   Dopo le 00:00 la finestra è del giorno nuovo (alle 02:00 del 21/10 la data è `2026-10-21`, tramonto 18:17 di quella sera): le 02:00 sono «prima del tramonto», la regola non scatta. È il **Quiz** di Troina 02:07: lo scheletro è giusto (`veloce` → `serale`: drink del dopocena + passeggiata, perché `ALBA_MINUTES` = 05:00), ma Monte Muganà entra nella passeggiata e la nota non c'è, quindi il riquadro «Natura» resta. Nota: il codice della nota ha già `p0.h < 6 ? 0 : 24 h` per «domattina alle 9», cioè chi l'ha scritto pensava alle ore piccole; la condizione `start >= tramonto0` subito sopra la rende irraggiungibile.

Per Te non è affetto: usa `isSeraStart` (sera fino alle 05:00) e passa dal giro della sera. Crea Percorso legge l'ora come mattina del giorno nuovo, ma in modo coerente (vedi tabella).

### Prova

- **Test che lo riproduce e fallisce su main**: `scripts/diagnosi-notte/difetto1.diagnosi.js` — 11 test rossi su 12 (il 12° è il controllo: 23:30 dopocena, 09:30 mattina): `momentAtClock` a 00:30, 01:45, 02:00, 04:30, 04:59; primo momento di Sorprendimi e Rigenera a 00:30, 02:00, 04:30 (deve essere un drink, non la mattina).
- **Motore vero, 0 $, nessuna rete**: `scripts/diagnosi-notte/replay-notte.mjs` rigioca Quiz Natura e Sorprendimi Natura di Troina dai tracciati del giro R2 di BORGO-COMPLETO (le ore dopo mezzanotte sul giorno 15/10 per avere la lista registrata). Esce 1 su main:

| Caso (Troina, Natura) | Sezione | Monte Muganà | Nota «La natura di notte…» | Tappe |
|---|---|---|---|---|
| Quiz 23:30 | Dopocena | no | **sì** | Barbera Silvestro · Piazza Conte Ruggero |
| Quiz 00:30 | Dopocena | **SÌ** | **no** | Barbera Silvestro · Monte Muganà |
| Quiz 02:00 | Dopocena | **SÌ** | **no** | Barbera Silvestro · Monte Muganà |
| Quiz 04:30 | Dopocena | **SÌ** | **no** | Barbera Silvestro · Monte Muganà |
| Quiz 05:30 | Mattina | no | no | Piazza Conte Ruggero · tempo libero |
| Sorprendimi 23:30 | Dopocena | no | **sì** | Barbera Silvestro · Piazza Conte Ruggero |
| Sorprendimi 00:30 | **Mattina** | no | no | Piazza Conte Ruggero · tempo libero |
| Sorprendimi 02:00 | **Mattina** | no | no | Piazza Conte Ruggero · tempo libero |
| Sorprendimi 04:30 | **Mattina** | no | no | Piazza Conte Ruggero · tempo libero |
| Sorprendimi 05:30 | Mattina | no | no | Piazza Conte Ruggero · tempo libero |

Il Quiz 02:00 a Troina coincide col fatto della prova 2 (bar + Monte Muganà, nessuna nota, «Natura» nel riquadro); Sorprendimi coincide con la prova 3 (Piazza Conte Ruggero + tempo libero, «MATTINA»). Dati: `docs/prove/dati/2026-10-21-diagnosi-notte-replay-sintesi.json`. Le 5 celle di Sorprendimi dopo mezzanotte hanno 1 uscita in rete (una ricerca per la mattina che il tracciato non ha): il motore va avanti con quello che ha e il tour è identico a quello della prova 3.

### Tabella flusso × ora (main, notte fra martedì 20 e mercoledì 21/10, ora legale, Troina)

Dalle funzioni vere con i parametri che le pagine passano (`scripts/diagnosi-notte/flussi.js`, dati in `docs/prove/dati/2026-10-21-diagnosi-notte-tabella.json`); le celle segnate «replay» sono confermate col motore vero. Alba a Troina il 21/10: **07:15**, tramonto 18:17.

| Flusso (chiamata) | 23:30 | 00:30 | 02:00 | 04:30 | 05:30 |
|---|---|---|---|---|---|
| **Per Te** (`isSeraStart`) | ✅ giro della sera | ✅ giro della sera | ✅ giro della sera | ✅ giro della sera | giorno (temi): confine a 05:00, vedi sotto |
| **Quiz** (`quick`, `veloce`) | ✅ Dopocena + nota, niente natura da fuori (replay) | ❌ momento giusto (drink + passeggiata) ma **Monte Muganà, nessuna nota** (replay) | ❌ idem (replay) | ❌ idem (replay) | scheletro «riserva Mattina» (Piazza + tempo libero), nessuna nota, ancora buio (replay) |
| **Sorprendimi** (nessun `pathType`) | ✅ Dopocena + nota (replay) | ❌ **Mattina**, categorie da museo, niente locali, niente nota (replay) | ❌ idem (replay) | ❌ idem (replay) | ❌ idem, ancora buio (replay) |
| **Rigenera giorno** (nessun `pathType`, come Sorprendimi) | ✅ | ❌ stesso scheletro di Sorprendimi | ❌ | ❌ | ❌ |
| **Crea Percorso**, testo senza giorno (`custom`) | tour di **domani** 09:30–22:30 (finestra spostata: dopo le 22:30 non c'è più oggi) | tour di **oggi**, scheletro da mattina (9:30), coerente con 23:30 (stesso giorno 21/10) | idem | idem | idem |
| **Crea Percorso**, con «domani» nel testo (replay) | tour di domani, identico a tutte le ore | idem | idem | idem | idem |
| *Crea il tuo Tour* | è la pagina che porta a Sorprendimi e a Crea Percorso: non ha un motore suo | | | | |

Il resto: Per Te e Quiz usano `isSeraStart`/`ALBA_MINUTES` (05:00), l'etichetta «Dopocena» dei drink (`italianLabels.js:132-134`, `ALBA_MINUTI`) si ferma alle **06:00**, `momentAtClock` alle **00:30**, il tramonto/l'alba reali sono 18:17 e 07:15. Quattro «albe» diverse (00:30, 05:00, 06:00, 07:15).

### Correzione minima proposta (non applicata)

1. `src/lib/dayMoments.js:45` — il dopocena arriva fino all'alba, come dice `isSeraStart`: `if (t < 5 * 60) return dopocena;` (al posto di `t + 24 * 60 < min(dopocena.end)`). Sistema Sorprendimi e Rigenera: la riserva diventa un drink + passeggiata, e le stesse tappe dopo mezzanotte prendono l'etichetta «Dopocena».
2. `src/services/aiRecommendationService.js:2833` — «dopo il tramonto» vale anche **prima dell'alba**: `i >= tramonto || i < alba` (`sunForDay(...)` restituisce già `sunrise`).
3. `src/services/aiRecommendationService.js:3413` — la stessa condizione per la nota di Ivano.

**Esperimento (poi annullato con `git checkout -- src`)**, replay dello stesso script:

| Caso | Sezione | Monte Muganà | Nota |
|---|---|---|---|
| Quiz 00:30 / 02:00 / 04:30 | Dopocena | no | **sì** |
| Quiz 05:30 | Mattina | no | sì |
| Sorprendimi 00:30 / 02:00 / 04:30 | **Dopocena** | no | **sì** (Barbera Silvestro · Piazza Conte Ruggero, come alle 23:30) |
| Sorprendimi 05:30 | Mattina | no | sì |

Con le tre righe: i test del difetto 1 verdi (17/17 con anche il difetto 2), `npm run test:run` **171 file, 2165 test verdi**, `npm run banco:guardia` **12/12**, pertinenza «nessun ❌ nuovo».

### Cosa NON risolve

- **Le 05:00–07:15 (l'alba vera)**: `isSeraStart` e `ALBA_MINUTES` finiscono alle 05:00, l'etichetta «Dopocena» alle 06:00, l'alba è alle 07:15. Alle 05:30 il Quiz e Sorprendimi restano «Mattina» in pieno buio (la nota ora compare, la sezione no). Una sola «alba» per tutto il codice è una decisione di Ivano, non una riga.
- **Bologna 01:45 non è provato col motore vero** (nessun tracciato): la spiegazione (mattina riserva, categorie da museo, nessun bar) è letta dallo scheletro, che dà lo stesso risultato; con la correzione lo scheletro dà un drink del dopocena, ma se un bar di Bologna sia aperto all'una dipende dagli orari di Google.
- **La data del tour dopo mezzanotte** resta il giorno nuovo: la lista della città è quella del giorno nuovo (vedi difetto 2: ogni mezzanotte la prima persona di ogni città aspetta una lista nuova). Alternativa più larga, **non** proposta come minima: far valere «la sera di ieri» anche come data (`tourWindow.date` = ieri prima dell'alba); toccherebbe orari di apertura, tramonto, titoli e liste, e va decisa a parte.
- **Crea Percorso senza giorno** a mezzanotte e mezza fa un tour di oggi da mattina: è coerente con le 23:30 (che saltano a domani), non l'ho trattato come difetto. Se Ivano vuole «giro serale» anche lì, è una scelta di prodotto.
- **Per Te** non ha bisogno di niente: è l'unico flusso che già leggeva la sera fino alle 05:00.

---

## 2) Difetto 2 — il primo Quiz del giorno va in «Non sono riuscito a completare il giro»

### Causa

La pagina del Quiz ha un tempo massimo fisso: `QuickPath.jsx:608-613`, `setTimeout(..., 35000)` → `error-technical` («Non sono riuscito a completare il giro…»). Il motore, per ogni flusso, **aspetta la lista della città del giorno** prima di fare altro (`aiRecommendationService.js:2436`, `await cittaPromise`), con un tempo massimo di **110 s** (`cityKnowledgeService.js:12`). La prima richiesta del giorno per una città *genera* la lista (AI + verifica Google sul server): **31 s a Troina, 42–58 s nelle città** (prove 2, 5, 6, 7, 8, 9 di PROVE-SIM). 35 s < 31 s + il resto: il Quiz cede quasi sempre alla prima richiesta del giorno in una città nuova.

Il dettaglio della prova 2, primo tentativo (`tentativo-1/prova-2.json`): ricerca del centro città a 13,6 s, lista che parte a 17,0 s, traduttore a 50,0 s (lista = circa 31 s: `costo.ms.totale` 30 867 ms), pagina in errore a 35 s. Secondo tentativo con la lista salvata: lista a 12,8 s (letta), traduttore a 13,4 s, giro finito in 20 s.

Due effetti collaterali, letti dal codice:
- la pagina **non annulla il motore** (`generateItinerary` è chiamato senza `AbortSignal`, `QuickPath.jsx:649-659`): dopo l'errore il motore continua, spende il biglietto e salva la lista. «Riprova» fa un secondo giro, che consuma un altro dei 10 al giorno e questa volta riesce;
- dopo mezzanotte **ogni lista è nuova** (la chiave è la data della finestra): chi fa il primo Quiz di notte in una città è sempre il «primo del giorno». PROVE-SIM è stato fatto alle 01:08–01:51 e ha incontrato questo caso in ogni città.

### Prova

`scripts/diagnosi-notte/difetto2.diagnosi.js`: la pagina vera (`QuickPath`), il motore finto che finisce dopo N secondi di tempo virtuale con un giro riuscito (N dalle prove). Su main: **3 rossi, 1 verde**.

| Motore finto | A 36 s la pagina | Su main |
|---|---|---|
| finisce a 20 s (lista già salvata, come il secondo tentativo) | mostra il giro | ✅ controllo verde |
| finisce a 40 s (Troina, lista nuova 31 s + resto) | **errore tecnico** | ❌ |
| finisce a 65 s (città, lista 57 s + resto) | **errore tecnico** | ❌ |
| finisce a 105 s (sotto i 110 s della lista) | **errore tecnico** | ❌ |

### Tabella flusso × attesa (il fatto «succede anche negli altri flussi?»)

| Flusso | Attesa massima della pagina | Aspetta la lista della città? | Misurato con lista nuova (PROVE-SIM) | Può dare lo stesso errore? |
|---|---|---|---|---|
| **Quiz** | **35 s** (`QuickPath.jsx:613`) | sì, fino a 110 s | prova 2: errore a 35 s; prova 9 (Lecce, lista fatta prima): 16 s | **Sì — il solo** |
| **Sorprendimi** | nessuna: spinner senza tetto (`SurpriseTour.jsx`) | sì, fino a 110 s | prova 8 (Bologna): 60 s, riuscito (lista 43 s) | No (nessun timer di pagina); può restare lo spinner fino a ~110 s + il resto |
| **Rigenera giorno** | nessuna | sì | non misurato | No |
| **Crea Percorso** | nessuna (l'`AbortController` di `AiItinerary.jsx:129` serve solo a uscire dalla pagina) | sì | prove 5, 6, 7, 10: 50–80 s, tutte riuscite | No |
| **Per Te, di giorno** | nessuna di pagina; la chiamata AI ha 45 s (`aiRecommendationService.js:3718`) | **no** (usa i temi, non la lista) | non misurato | No per la lista |
| **Per Te, sera** e **borgo senza temi** | nessuna di pagina (`loadingTimeout` 8 s in `DashboardUser.jsx:431` cambia solo la grafica) | sì (passano da `generateItinerary`) | non misurato (nella prova la home dava 503) | No timer, stessa attesa lunga |

I tempi dei singoli passaggi dentro il motore: traduttore 15 s (modello), selettore 50 s (client, `:2997`), narratore 25 s (`:2222`), lista 110 s.

### Correzione minima proposta (non applicata)

`src/pages/QuickPath.jsx:613` — il tempo massimo della pagina **non può essere più corto di quello che il motore dichiara di aspettare**: `35000` → `120000` (lista 110 s + il resto del giro 7–20 s non entrano in meno; il valore esatto lo decide Ivano, deve stare sopra `CITY_LIST_TIMEOUT_MS`). Il commento e il `console.warn` dicono «35s»: da allineare. Esperimento (poi annullato): i 3 test rossi diventano verdi.

### Cosa NON risolve

- **L'attesa**: il primo Quiz del giorno in una città nuova resta di 30–60 s e la schermata di caricamento deve dirlo; con 120 s non c'è più un errore falso, c'è un minuto di spinner.
- **Il biglietto speso** dal tentativo andato in errore (resta, ma da quando il timer è sopra l'attesa non c'è più il secondo giro per riprovare).
- Una lista che supera davvero i 110 s: il motore va avanti senza lista (`stato: 'assente'`), come previsto, il giro esce peggiore ma esce.
- L'alternativa migliore ma **non minima** (non applicata, non provata): far partire la lista all'apertura del Quiz, mentre l'utente fa le quattro scelte. Rischio non verificato: se `openai-proxy` non fa «una sola richiesta per città e giorno» quando ne arrivano due insieme, la richiesta anticipata e quella del motore potrebbero generare la lista due volte (0,3–0,6 $ ciascuna). Da controllare nel proxy prima di proporla.
- Il caso «dopo mezzanotte tutte le liste ripartono» (sopra): il timer alto lo nasconde, non lo toglie.

---

## 3) Spesa, processi, file

- **Spesa: 0 $**. Nessuna chiamata a Google o a OpenAI, nessuna generazione vera, nessun uso delle credenziali (`.env.local` non letto). Il replay usa solo i tracciati già in repo; i test della pagina usano un motore finto e il tempo virtuale.
- **Produzione invariata**: nessun deploy, nessuna migrazione, nessun merge, nessuna scrittura nel database.
- **Processi**: tutti i miei sono finiti (due lanci di replay e una suite in background, tutti conclusi; controllo finale a fine task: 0 processi `vitest`/`replay-notte`). Non ho avviato server né browser.
- **File aggiunti**: `scripts/diagnosi-notte/` (`vitest.config.js`, `flussi.js`, `difetto1.diagnosi.js`, `difetto2.diagnosi.js`, `tabella.diagnosi.js`, `replay-notte.mjs`), `docs/prove/dati/2026-10-21-diagnosi-notte-tabella.json` e `-replay-sintesi.json`, questo report. Nessun file in `src/`. `AGENTS.md` non committato.
- **Esperimento sul codice**: tre righe in `src/` applicate per provare le proposte e annullate con `git checkout -- src` prima del commit (`git status` pulito su `src/` e nessuna differenza nel commit).

## Cosa ho dato per vero senza verificarlo

- **«Crea Tour» come flusso a sé**: ho letto la lista dei cinque flussi come Per Te, Quiz, Sorprendimi e Crea Percorso più «Crea il tuo Tour», che nel codice è la pagina che porta a Sorprendimi e a Crea Percorso e non ha una chiamata sua. Al suo posto ho aggiunto «Rigenera giorno» (`AiItinerary.jsx:345`), che è l'unica altra chiamata senza `pathType`.
- **Che il codice in produzione sia quello di `5b82249`** per tutta la notte della prova: l'ho letto da una riga del Profilo, una volta (come dice il report di PROVE-SIM). Che `5b82249` e `abc3749` coincidano sui file in causa l'ho verificato con `git diff`.
- **I tempi del Quiz** (13,6 s, 17,0 s, 50,0 s, 12,8 s…) vengono dal `prova-2.json` di PROVE-SIM e li ho letti come secondi dall'avvio della misura dello script; non so se la misura parta esattamente dal tocco su «Genera» né quanto dei 13–17 s prima della lista sia la ricerca del centro città e quanto il rumore delle richieste bloccate dello script (la home dava 503).
- **I tempi del motore finto** (20, 40, 65, 105 s) sono presi dalle prove (lista 31–58 s + resto 7–20 s), non misurati da me in una generazione viva.
- **Il replay di notte** gira sul 15/10 (tracciati di BORGO-COMPLETO) e non sul 21/10: stesso codice, ma tramonto e alba del 15/10 (18:2x e 07:1x) e non quelli di oggi; la conclusione non cambia (le 00:30–04:30 sono prima dell'alba in tutte e due le date).
- **Sorprendimi in replay ha 1 uscita in rete** (ricerca non registrata): ho dato per vero che il tour che ne esce (Piazza Conte Ruggero + tempo libero) sia quello vero perché coincide con la prova 3 di produzione.
- **Bologna** non rigiocata (nessun tracciato): ho attribuito «nessun locale» alle categorie della mattina di riserva leggendo lo scheletro; non l'ho verificato col motore su Bologna.
- **La proposta «funziona»** è provata con l'esperimento a Troina (replay) e con la suite e la guardia; non l'ho provata su altre città né di giorno oltre a ciò che la suite già copre.
- **Il Quiz non annulla il motore** e il biglietto va comunque speso: l'ho letto dal codice (nessun segnale passato a `generateItinerary`) e dal report di PROVE-SIM («il biglietto è stato contato comunque»), non l'ho misurato lato server.
- **Il proxy deduplica o no** le richieste di lista concorrenti: non l'ho guardato (`supabase/functions/openai-proxy` non letto); lo segnalo come rischio dell'alternativa, non come fatto.
- **Che Per Te di notte funzioni** l'ho dedotto da `isSeraStart` e dal replay a 23:30 (Black & White + Piazza); alle 00:30–04:30 il replay di Per Te ha uscite in rete (ricerca del bar) e non l'ho usato come prova.
