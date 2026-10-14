# VERITÀ-PRE-GIRO — meteo, saluto, c13, Per Te, frasi prestate

Ramo `wip/verita-pre-giro` (un commit WIP sul meteo, fatto su `7799442`) ribasato su `b9f4e83` senza conflitti, completato e portato su `main`.
**Nessuna generazione: 0 $.** I «prima» vengono dal codice di `b9f4e83` e dai grezzi già nel repo (`docs/prove/dati/2026-10-15-banco-esteso-testi*.json`); i «dopo» dal codice finale, con test e controlli del banco rigirati sui grezzi (nessuna chiamata AI né Google).

## Esito in breve

| # | Punto | Prima (b9f4e83) | Dopo |
|---|---|---|---|
| 1 | Meteo mai inventato | servizio giù → «sunny, 24°»; badge senza coordinate → «Soleggiato, 22°, vento 10»; pagine `condition \|\| 'sunny'`, `temperature \|\| 20` (0 °C diventava 20 °C) | nessun meteo (`null`), il riquadro non compare; 0 °C resta 0 °C |
| 2 | Saluto | profilo senza nome → nome dalla mail («ivano.rossi85@…» → «Ciao, Ivano!») | «Ciao!»; nessun nome dalla mail in nessun punto di `src` |
| 3 | c13 | cena dovuta in ogni giro serale che parte prima delle **23:00** → Veloce Catania 22:20 rosso | cena dovuta solo prima delle **22:00**: 20:00 senza cena né riga resta **rosso**, Veloce 22:20 **verde** |
| 4 | Per Te, museo | «Museo Diocesano di Catania è la prossima tappa del tuo giro.» | **causa diversa da quella scritta nel report TESTI**: la famiglia «museo» c'era già (dal tipo principale). Niente da correggere lì; proposta sotto |
| 5 | Frasi prestate | 6 coppie di prestiti, 3 frasi che non stanno in piedi («Attraversi Palazzo degli Elefanti», «Ti fermi davanti a una piazza», …) | tolte; «Attraversi…» solo a piazza/passeggiata/porta/arco, mai a una chiesa |

Suite: **1986 test verdi** (147 file). I test nuovi o riscritti, copiati su un worktree di `b9f4e83`: **26 rossi** (elenco in «Test rosso→verde»). Lint: 0 errori, 198 avvisi (gli stessi di `b9f4e83`). Build ok.

## 1. Meteo: il vero o niente (già fatto sul ramo, verificato)

Il lavoro del commit WIP regge sul codice di `b9f4e83`: dopo il rebase la suite aveva **2 rossi** nel test del meteo, e la causa era il test, non il codice: `resolveCityCenter` era simulato con `mockResolvedValue`, che `vi.restoreAllMocks()` (in `afterEach`) cancella dopo il primo test; la pagina Crea riceveva `undefined` e cadeva su `.then`. Ora il mock ha un'implementazione (`vi.fn(async () => …)`) e i 17 test del meteo passano.

| Dove | Prima | Dopo |
|---|---|---|
| `weatherService.getCurrentWeather` | rete giù o HTTP non 2xx → `getFallbackWeather()` = **sunny, 24°, «Soleggiato»** | `null` |
| idem | risposta senza `current` → errore → di nuovo 24° sereno | `null`; anche con temperatura nulla, non numerica o codice mancante |
| idem, codici WMO | neve (71–77, 85–86) e nebbia (45, 48) → **«cloudy»** (il `default`); codice sconosciuto → «cloudy» | neve → `snowy`, nebbia → `foggy`, sconosciuto → `null` |
| `getWeather` senza coordinate né città riconosciuta | 24° sereno | `null` |
| `WeatherAirBadge` (mappa) | senza coordinate **«Soleggiato, 22°, vento 10»**; temporale (95) → **«Neve»**; nebbia (45) → «Sereno» | non compare; temporale «Pioggia», nebbia «Nebbia» (stessa tabella del servizio) |
| `AiItinerary`, `QuickPath`, `Notifications` | `{ condition: weatherCondition \|\| 'sunny', temperature: temperatureC \|\| 20 }` | `?? null`: un meteo che non c'è resta `null`, 0 °C resta 0 °C |

Chi consuma il servizio: `userContextService` (scrive `temperatureC`/`weatherCondition` solo se la risposta c'è) e il badge. Il riquadro del tour era già nascosto senza meteo (`weatherForDay`, TESTI). Nei grezzi precedenti «sunny, 20°C» compariva 158 volte (report TESTI): era quel `|| 'sunny'`, `|| 20`.

## 2. Saluto (decisione di Ivano): senza nome «Ciao!»

| Dove | Prima | Dopo |
|---|---|---|
| `useUserContext` | `full_name` → `first_name` → **prima parola della mail** → … | `full_name` → `first_name` → nome del contesto; utente senza nome → `null`; ospite → «Ospite» (come prima) |
| `userContextService` | `email.split('@')[0]` («giulia@…» → «giulia») | `full_name` / `name` / `first_name`, altrimenti `null` |
| `TopBar` | «Ciao, {nome}!» anche con nome vuoto → **«Ciao, !»** | «Ciao, Ivano!» con il nome, **«Ciao!»** senza; in caricamento «Ciao, ...!» come prima |
| `TourDetails` | `userName` cadeva sulla mail | cade su «Utente» (la variabile, già prima, non viene inviata: è codice morto, lasciato) |

Un test legge tutto `src` (test esclusi) e fallisce se compare `email.split('@')`: su `b9f4e83` lo trovava in 3 file.

## 3. c13: la cena dovuta solo prima delle 22:00

Unico cambio ai controlli: in `sera_senza_cena_ok` (la parte (e) di c13) la cena è dovuta solo se il giro parte **prima delle 22:00** (`CENA_DOVUTA_FINO_A`). `giroSerale` non è cambiata, perché la usa anche la voce «Giornata» (`misure.giornataSemaforo`): la voce «Giornata» dà gli stessi verdetti di prima su tutti gli esempi. Le parti (a)–(d) di c13 non cambiano (un test lo verifica: il drink da 20 minuti alle 22:20 resta rosso). Descrizione di c13 aggiornata.

Validazione (`docs/prove/dati/2026-10-16-verita-pre-giro-validazione.txt`):

| Esempio | c13 di b9f4e83 | c13 nuovo |
|---|---|---|
| **cattivo4** — Veloce 20:00: drink (MMB Music Melody Bar) + passeggiata, nessuna cena, nessuna riga | 🔴 «nessuna cena… e nessuna riga» | 🔴 stesso testo |
| **buono6** (nuovo) — Veloce Catania 22:20 del giro TESTI: Bar Popolare 60 min + Fontana dell'Amenano | 🔴 **falso allarme** «Giro serale delle 22:20: nessuna cena» | 🟢 |
| confine 21:59 / 22:00 (test) | 🔴 / 🔴 | 🔴 / 🟢 |
| tutti gli altri esempi di c13 (cattivo, 2, 3; buono, 2, 3, 4, 5) | invariati | invariati |

Sui grezzi veri del giro TESTI (7 casi, 0 $): c13 passa da 1 violazione (veloce-catania-relax-2220, in tutti e due i file) a **0**. Gli altri casi non cambiano. Tutte le altre classi della validazione restano «cattivi rossi, buoni verdi».

### Perché c6 è rosso sul Veloce 22:20 (c6 non si cambia)

`c6` segna una tappa la cui sosta è **uguale alla sosta tipica di un tipo molto diverso** (`sostaScala` = 2,5 volte). Bar Popolare ha tipo principale `cocktail_bar`: per il banco è un «caffe» (sosta tipica 20 min). Il caso è con ritmo **Rilassato**, e per C8a il drink serale con ritmo Rilassato dura **60 minuti** (`tourTiming.stayInMoment`, `sostaAperitivo`). 60 è esattamente la sosta tipica del **museo**, e 60/20 = 3 ≥ 2,5: c6 legge «un bar che dura quanto un museo». Il motore fa quello che C8a ha deciso; c6 confronta la sosta col tipo, non col momento. Con il ritmo normale il drink dura 45 minuti, che non è la sosta tipica di nessun tipo (20, 30, 60, 75): c6 tace. **Proposta** (già nel report TESTI, non scritta): c6 non si applica al drink dell'aperitivo/dopocena, oppure la sosta tipica del bar dipende dal momento.

## 4. Per Te: il museo e la frase di riserva

Il report TESTI diceva: «nel flusso Per Te la tappa non porta la famiglia del tracciato e `famigliaFrase` non la riconosce». **Non è così**, verificato su `b9f4e83`:
- Per Te passa a `stopData` la tappa canonica, che porta `types` e `primaryType` (`canonicalizeStopsFromCandidates`); `famigliaFrase` cade su `candidateFamily`, che legge il tipo principale (C6a): «Museo Diocesano di Catania» (`art_museum`) → **museo**. Anche un museo con un nome qualunque e senza `museum` fra i types prende «museo» dal solo tipo principale. La colonna «Famiglia» vuota del report TESTI era il campo `famiglia` del grezzo, cioè il tracciato C1, che Per Te non ha.
- La causa vera, riprodotta: nello stesso tour «insider» c'era prima **Palazzo della Cultura** (museo), che ha usato «{nome} è la tappa da fare con calma.». La famiglia museo ha solo un'altra frase, «Entri a {nome} alle {ora}…», che in Per Te non si può dire (non c'è l'orario d'arrivo). Il museo non ha famiglie sorelle, quindi la regola «nessuna frase uguale due volte» porta alla generica «{nome} è la prossima tappa del tuo giro.». Senza il registro delle frasi la stessa tappa avrebbe avuto la frase del museo.

Non ho cambiato niente per questo punto: il comportamento chiesto («il museo usa la famiglia dal tipo principale») c'era già. Due test lo fissano (verdi anche su `b9f4e83`: **non** sono rosso→verde, e non possono esserlo).
**Proposta, nessuna frase nuova**: prestare al museo le frasi della chiesa, che sono vere anche per un museo: «{nome} è sulla tua strada: entri, guardi, riparti.» e «Ti prendi {durata} dentro {nome}.» (la durata è la sosta vera, «un'ora»). Serve il tuo sì: è un prestito nuovo.

## 5. Frasi prestate

Il prestito (`SORELLE` in `stopPhrases.js`, TESTI) entra in gioco solo quando le frasi della propria famiglia sono già state dette nel tour. Ecco tutte le coppie che c'erano e cosa ne è stato. «Nei grezzi» = quante volte la frase prestata compare nei giri già nel repo (scansione delle tappe la cui prima frase è di un'altra famiglia).

| Famiglia della tappa | Frase prestata (di) | Sta in piedi? | Nei grezzi | Dopo |
|---|---|---|---|---|
| monumento | «Attraversi {nome} piano, senza fretta.» (piazza) | **no**: un palazzo, una statua, una fontana non si attraversano; e se il «monumento» è una chiesa che il codice riconosce solo dal tipo da monumento (una Badia con `tourist_attraction`) diventa «Attraversi Badia di Sant'Agata» | 4 (Palazzo degli Elefanti, Statua del Genio di Palermo, Campo de' Fiori) | **tolta** |
| monumento | «Passi da {nome}: guardati intorno prima di ripartire.» (piazza) | sì | 2 (Palazzo degli Elefanti, Colosseo) | resta |
| piazza (anche passeggiata, via, lungomare) | «Ti fermi davanti a {nome} il tempo che serve.» (monumento) | **no**: in una piazza ci sei, non le stai davanti (prova P3d-j: «Ti fermi davanti a Passeggiata del Gianicolo») | 0 | **tolta** |
| porta, arco | «Ti fermi davanti a {nome} il tempo che serve.» (monumento) | sì | 0 | resta |
| porta, arco | «Attraversi {nome} piano, senza fretta.» (piazza) | sì: una porta, un arco si attraversano | 0 | resta |
| porta, arco | «Passi da {nome}: guardati intorno prima di ripartire.» (piazza) | sì | 0 | resta |
| chiesa | «Ti fermi davanti a {nome} il tempo che serve.» (monumento) | sì | 0 | resta |
| altro (mercato, spa, stazione, chiesa non riconosciuta) | «Attraversi {nome} piano, senza fretta.» (piazza) | **no**: un luogo qualunque non si attraversa, e può essere una chiesa | 0 | **tolta** |
| altro | «Ti fermi davanti a {nome} il tempo che serve.» (monumento) | **no**: un mercato o una spa non sono qualcosa davanti a cui fermarsi | 0 | **tolta** |
| altro | «Passi da {nome}: guardati intorno prima di ripartire.» (piazza) | sì | 1 (Mercato del Capo) | resta |
| tutte | «Alle {ora} sei a {nome}: è qui che ti porta la giornata.», «{nome} è la prossima tappa del tuo giro.» (generiche) | sì: vere per ogni luogo | 10 (8 a musei, 2 a una piazza, nei giri precedenti) | restano |

Come: due regole in `frasePossibile` («Attraversi…» solo per piazza, porta, arco; «Ti fermi davanti a…» solo per monumento, porta, arco, chiesa) e `SORELLE` senza le coppie che non danno più niente (piazza ← monumento, altro ← monumento). Le regole valgono anche per le frasi proprie di una famiglia, che però non le toccano (la piazza ha «Attraversi», il monumento «Ti fermi davanti»). Nessuna frase approvata è cambiata, nessuna è nuova (un test lo controlla).

Effetto sui testi già visti (dal report TESTI, non rigirato): «Attraversi Palazzo degli Elefanti piano, senza fretta.» (Crea Catania domani, 15:33) diventa «Passi da Palazzo degli Elefanti: guardati intorno prima di ripartire.» se quella frase non è già stata detta nel tour, altrimenti la generica.
Nei grezzi c'è anche «Monastero dei Benedettini… è sulla tua strada: entri, guardi, riparti.» su un posto che oggi è museo (types `museum`): è una frase della chiesa uscita con un codice precedente, quando la famiglia veniva dal nome; con il codice di oggi non è un prestito.

## Test rosso→verde

I test nuovi o riscritti, copiati su un worktree di `b9f4e83` (con `validazione.js` nuovo per avere l'esempio del 22:20, ma il **vecchio** `controlli.js`): **26 falliscono**, 52 passano.
- **Meteo (15 rossi)** `veritaMeteo.test.js`: servizio (6), badge (3), pagine Veloce e Crea (4), sorgente senza valori di riserva (2).
- **Saluto (4)**: `topBar_saluto` («Ciao!»), `useUserContext_nome` (niente nome dalla mail), `userContextService` (`firstName` null), `veritaSaluto` (nessun `email.split('@')` in `src`).
- **c13 (3)** `veritaPreGiro.test.js`: Veloce 22:20 verde, confine 22:00, validazione del banco senza falsi allarmi.
- **Frasi prestate (4)** `veritaPreGiro.test.js`: Badia (chiesa vista come monumento) senza «Attraversi», palazzo e statua, piazza e passeggiata senza «Ti fermi davanti», mercato.
- **Non rossi su b9f4e83, per costruzione**: Per Te museo (2: il comportamento c'era già), il 20:00 rosso di c13 (era già rosso), «una chiesa vera non prende Attraversi» e «i prestiti buoni restano» (fissano ciò che non doveva cambiare), le altre parti di c13.

## Su main

`wip/verita-pre-giro` → `main` in avanti veloce, push su `origin/main`, ramo locale eliminato dopo il merge. Esito del gate in fondo.

**Deploy da verificare da Ivano.**

## Cosa ho dato per vero senza verificarlo

- Che «prima delle 22:00» si legga sull'ora di partenza del caso (`caso.ora`), come l'altra soglia di c13 (le 23:00); non sull'arrivo alla prima tappa.
- Che la Badia di Sant'Agata (o un'altra chiesa) possa davvero arrivare come monumento: l'esempio del test è costruito (tipo principale `tourist_attraction`, niente `church` fra i types); nei grezzi non ho trovato una chiesa con «Attraversi».
- Che «Attraversi Porta…» stia in piedi: l'ho tenuto perché una porta si attraversa; non l'ho visto a schermo.
- Che il meteo «nessuno» non lasci buchi in pagine che non ho aperto nel browser (provato con test di render su Crea, Veloce, badge; Notifiche solo dal sorgente). Nessuna schermata, nessuna prova nel browser in questo task.
- Che nessun altro punto dell'app ricavi un nome dalla mail con una forma diversa da `email.split('@')` (il test cerca quella forma).
- Che `TourDetails.userName` sia davvero inutilizzato (non compare altrove nel file).
- Deploy da verificare da Ivano.
