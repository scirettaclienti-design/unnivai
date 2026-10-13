## Esito in breve

- **c8 = 0** sui 6 casi. **c1 = 0**. **c7 = 2** (solo Per Te Catania 13:00, due frasi ripetute fra i tour tematici): la causa era il set delle frasi per tour invece che per giro di tour; corretto dopo il giro (vedi «Cosa non è stato rigirato»), **non rigirato** perché un nuovo giro di Per Te (0,221 $) avrebbe portato la spesa a 1,36 $, sopra il punto di stop (1,35 $).
- Altri semafori rossi sui 6 casi, **non di testo**: c6 e c13 sul Veloce Catania 22:20 (§ «Cose trovate»).
- Spesa **1,142 $** su 1,5 $ (stop a 1,35). Le schermate non costano AI (sessione dell'account di prova, tour dei grezzi nella pagina vera).
- Suite: **1920 test verdi** (1877 + 43 nuovi); i test nuovi falliscono su `2015b5c` (34 rossi, elenco in «Test rosso→verde»).

## Prima / dopo di ogni testo

«Prima» = i grezzi di tutti i giri del banco fino a C8e (233 casi, 1198 tappe, `docs/prove/dati`); «dopo» = i 6 casi di questo giro sul codice finale (30 tappe).

| # | Testo | Prima (frequenza, esempio reale) | Dopo |
|---|---|---|---|
| 1 | Tempo libero | 85 righe: «Tempo libero: per il dopocena non c'è niente che valga il cammino. Il resto lo scegli tu.» (e «per la mattina…», «per questo momento…») | «Tempo libero» + fascia «10:33–12:29» + «Niente in agenda: cammina dove ti porta la strada.» (screenshot 02) |
| 2 | Etichetta di tipo | tipo interno a schermo: `restaurant` per ogni bar e locale, `monument`, `place`, `church`… | dal tipo principale: «bar», «ristorante», «monumento», «chiesa»; nessuna etichetta se il tipo non ha traduzione (tabella sotto) |
| 3 | Meteo | 158 volte «sunny, 20°C»; anche su tour di domani | «Sereno, 20°C» sul tour di oggi (03); nessun riquadro sul tour di domani (02) |
| 4a | «Qui la giornata si chiude» | 133 volte, anche a metà pomeriggio | solo sull'ultima tappa di un giro che arriva alla sera (dalle 18:00): cena 20:00 (03), fontana 23:22 (04) |
| 4b | «Ti prendi cinque minuti» | 28 volte, per chiese da 20 minuti | «Ti prendi venti minuti dentro…» (durata vera della sosta, in lettere) |
| 4c | «Sono 1 minuti» | 65 volte | «È a un minuto a piedi dalla tappa prima.» / «A un minuto a piedi ti siedi da…» (02) |
| 4d | «Verso \Catania» | 2 volte (nome di un locale con la barra) | «Verso Catania» (`senzaEscape` su nomi e titoli) |
| 5 | «Aperitivo» dopo le 21:30 | sezione «Aperitivo» e «L'aperitivo lo prendi da…» a 21:45 | sezione «Dopocena» (04), «Il drink lo prendi da…»; titolo senza «aperitivo» |
| 6 | Prezzi | 221 volte «in fascia €€» | «con prezzi medi» / «bassi» / «alti» (02, 03) |
| 7 | Titolo | 59 volte «Giorno 1 a Catania» in tour di un giorno | «Il tuo giro a Catania» (04); «Giorno N a X» solo con più giorni; niente navigatore dei giorni con un giorno solo |
| 8 | Saluto | «Ciao, ivano!»; dalla mail «Ciao, Ivano.rossi85!» | «Ciao, Ivano!» (01) |
| 10 | Frasi ripetute | c7 sui giri C8e: 7 violazioni su 4 casi (es. «Sono 3 minuti a piedi dalla tappa prima.» 6 volte in una giornata) | 5 casi su 6 senza nessuna frase ripetuta nemmeno a 2 volte; Per Te: 2 ripetizioni (causa trovata, corretta, non rigirata) |

Baseline misurata a 0 $ sul grezzo di C8e (4 casi): c7 = 7, c8 = 10.

## Etichette di tipo: tabella completa

La regola: **tipo principale di Google → italiano**; senza tipo principale (cache vecchie, 169 tappe nei giri precedenti) il tipo di posto che decide `placeKind`; senza traduzione **nessuna etichetta**.

**«Retrò - Cocktail Bar» etichettato restaurant — spiegazione.** Il tipo interno `type` di ogni tappa viene da `mapGoogleTypeToOurType` (`placesDiscoveryService`), che riduce a `restaurant` *ogni* locale (pasto, bar, caffè, forno, dolce, notte). Retrò ha tipo principale `cocktail_bar`: il motore lo trattava già bene (bar, 45 minuti), ma `AiItinerary` stampava `stop.type` così com'era. Ora stampa `typeLabelOf(stop)`: «bar».

| Tipo principale Google | Etichetta | Tappe nei giri precedenti |
|---|---|---|
| `restaurant` | **ristorante** | 95 |
| `italian_restaurant` | **ristorante** | 157 |
| `pizza_restaurant` | **pizzeria** | 8 |
| `seafood_restaurant` | **ristorante di pesce** | 14 |
| `steak_house` | **ristorante** | 0 |
| `bistro` | **bistrot** | 12 |
| `diner` | **tavola calda** | 5 |
| `vegetarian_restaurant` | **ristorante vegetariano** | 2 |
| `mediterranean_restaurant` | **ristorante** | 0 |
| `sushi_restaurant` | **ristorante** | 0 |
| `fine_dining_restaurant` | **ristorante** | 0 |
| `meal_takeaway` | **cibo da asporto** | 1 |
| `sandwich_shop` | **paninoteca** | 0 |
| `deli` | **gastronomia** | 1 |
| `bar` | **bar** | 15 |
| `cocktail_bar` | **bar** | 45 |
| `lounge_bar` | **bar** | 1 |
| `sports_bar` | **bar** | 0 |
| `bar_and_grill` | **bar** | 0 |
| `wine_bar` | **enoteca** | 1 |
| `pub` | **pub** | 5 |
| `irish_pub` | **pub** | 0 |
| `gastropub` | **pub** | 5 |
| `brewpub` | **birreria** | 0 |
| `brewery` | **birrificio** | 0 |
| `cafe` | **caffè** | 1 |
| `coffee_shop` | **caffè** | 11 |
| `cafeteria` | **caffè** | 0 |
| `coffee_stand` | **caffè** | 0 |
| `coffee_roastery` | **torrefazione** | 0 |
| `tea_house` | **sala da tè** | 0 |
| `night_club` | **locale notturno** | 0 |
| `bakery` | **forno** | 5 |
| `ice_cream_shop` | **gelateria** | 1 |
| `gelato_shop` | **gelateria** | 0 |
| `dessert_shop` | **pasticceria** | 2 |
| `pastry_shop` | **pasticceria** | 2 |
| `cake_shop` | **pasticceria** | 4 |
| `confectionery` | **pasticceria** | 1 |
| `chocolate_shop` | **cioccolateria** | 0 |
| `church` | **chiesa** | 38 |
| `place_of_worship` | **luogo di culto** | 11 |
| `mosque` | **moschea** | 0 |
| `synagogue` | **sinagoga** | 0 |
| `hindu_temple` | **tempio** | 0 |
| `museum` | **museo** | 42 |
| `art_museum` | **museo** | 21 |
| `history_museum` | **museo** | 10 |
| `art_gallery` | **galleria d’arte** | 14 |
| `monument` | **monumento** | 0 |
| `tourist_attraction` | **monumento** | 83 |
| `historical_landmark` | **monumento** | 92 |
| `cultural_landmark` | **monumento** | 1 |
| `landmark` | **monumento** | 25 |
| `historical_place` | **luogo storico** | 4 |
| `castle` | **castello** | 0 |
| `city_hall` | **palazzo comunale** | 0 |
| `library` | **biblioteca** | 0 |
| `university` | **università** | 0 |
| `cemetery` | **cimitero** | 0 |
| `performing_arts_theater` | **teatro** | 0 |
| `opera_house` | **teatro dell’opera** | 0 |
| `concert_hall` | **sala concerti** | 0 |
| `sculpture` | **scultura** | 0 |
| `statue` | **statua** | 0 |
| `bridge` | **ponte** | 0 |
| `fountain` | **fontana** | 4 |
| `observation_deck` | **punto panoramico** | 23 |
| `scenic_spot` | **punto panoramico** | 41 |
| `park` | **parco** | 37 |
| `city_park` | **parco** | 22 |
| `national_park` | **parco** | 0 |
| `state_park` | **parco** | 0 |
| `garden` | **giardino** | 37 |
| `botanical_garden` | **orto botanico** | 9 |
| `plaza` | **piazza** | 5 |
| `town_square` | **piazza** | 0 |
| `natural_feature` | **area naturale** | 0 |
| `beach` | **spiaggia** | 0 |
| `hiking_area` | **sentiero** | 6 |
| `zoo` | **zoo** | 0 |
| `aquarium` | **acquario** | 0 |
| `amusement_park` | **parco divertimenti** | 0 |
| `store` | **negozio** | 0 |
| `clothing_store` | **negozio di abbigliamento** | 0 |
| `shoe_store` | **negozio di scarpe** | 0 |
| `book_store` | **libreria** | 0 |
| `jewelry_store` | **gioielleria** | 0 |
| `shopping_mall` | **centro commerciale** | 0 |
| `market` | **mercato** | 2 |
| `supermarket` | **supermercato** | 0 |
| `spa` | **centro benessere** | 7 |
| `wellness_center` | **centro benessere** | 0 |
| `massage_spa` | **centro benessere** | 2 |
| `massage` | **centro massaggi** | 6 |
| `lodging` | **albergo** | 0 |
| `hotel` | **albergo** | 0 |

Tipi visti nei giri e **senza traduzione** (nessuna etichetta):

`(manca)` ×170, `government_office` ×19, `apartment_complex` ×4, `transit_station` ×4, `food_store` ×3, `beauty_salon` ×3, `event_venue` ×2, `health` ×2, `community_center` ×1, `service` ×1

## Cose trovate (non di testo, non toccate)

1. **c13 e c6 sul Veloce Catania 22:20.** Il Veloce fra le 22:00 e le 23:00 è «drink + passeggiata» per C8b (cena tardi solo 21:00–22:00), ma c13 pretende la cena (o la riga «Nessun locale aperto…») per ogni giro che parte prima delle 23:00. Uno dei due va allineato: **proposta**, non scritta: o il motore mette la riga approvata anche fra le 22:00 e le 23:00, o c13(e) vale fino alle 22:00. c6: il drink con ritmo Rilassato dura 60 minuti (C8a) e c6 lo legge come «un caffè che dura quanto un museo»: proposta, c6 non vale per il drink serale.
2. **Meteo inventato dal servizio.** `weatherService.getFallbackWeather()` risponde «sunny, 24°» quando l'API non risponde, e `AiItinerary`/`QuickPath` passano `condition || 'sunny'`, `temperature || 20`: con la rete giù il tour dice «Sereno, 20°C» senza saperlo. Stesso difetto in `WeatherAirBadge` («Soleggiato, 22°» senza coordinate). **Proposta**: nessun meteo quando non è vero (il codice `realWeather` già lo sa fare; manca di non inventare a monte).
3. **Per Te: un museo senza famiglia.** «Museo Diocesano di Catania» (tipo `art_museum`) ha avuto la frase di riserva: nel flusso Per Te la tappa non porta la famiglia del tracciato e `famigliaFrase` non la riconosce. Proposta: leggere la famiglia dal tipo principale anche lì.
4. **«Ciao, …!» nelle pagine Crea.** In `AiItinerary` la TopBar mostra «Ciao, ...!» (stato di caricamento) mentre la home mostra «Ciao, Ivano!»: non è un errore di testo, si vede nelle schermate 02 e 03.
5. **Validazione del banco.** In `validazione.js` (c1) le chiavi `buono2`, `buono3`, `buono4` erano scritte due volte: le prime (C8c, C8d) venivano coperte dalle seconde e non giravano mai. Rinominate (`buono7/8/9`): passano tutte e tre verdi.

## La frase di riserva «X è la prossima tappa del tuo giro»

Nei grezzi precedenti: **152 volte su 1198 tappe (12,7%)**. Perché esce: (a) **119 volte** è un locale (ristorante, bar, caffè) in un momento in cui nessuna frase da locale vale — Per Te senza momento, un bar di pomeriggio, un ristorante di mattina — e `aperture()` cade sulla famiglia «altro», che ha due varianti scelte dal seme (il 50% è questa); (b) **33 volte** è un posto senza famiglia (spa, massaggi, mercati, stazioni: 8 senza nemmeno il tipo principale). Nel giro di adesso: **1 volta su 30 tappe (3%)** (il museo di Per Te, punto 3), perché le frasi dei luoghi simili ora si prestano le frasi approvate (monumento ↔ piazza ↔ porta/arco, chiesa → monumento) prima di arrivare alla generica.

**Tre alternative da approvare** (nessuna è scritta nel codice):
1. «Il giro continua da {nome}.»
2. «Da {nome} si riparte.»
3. «Ti fermi a {nome}, poi si va avanti.»

## Validazione dei controlli (rosso su un esempio cattivo, verde su uno buono)

`docs/prove/dati/2026-10-15-testi-validazione.txt`: per ogni esempio, il controllo **nuovo** contro quello **di prima** (`HEAD` di C8e).

- **c1** — dolce vero prima del pasto (gelateria 11:00 prima tappa): **ROSSO** (nuovo e vecchio); secondo dolce vero all'aperitivo (gelateria `ice_cream_shop`): **ROSSO**; **Bar Sgroi** (tipo principale `bar`, `cake_shop` fra i types, all'aperitivo, dopo una colazione in pasticceria): **verde** col controllo nuovo, **ROSSO** (falso allarme) con quello di prima.
- **c8** — «Aperitivo» alle 21:45: ROSSO (prima: verde); «Aperitivo» alle 21:25 e «Dopocena» alle 21:45: verde; «trattoria in fascia €€»: ROSSO (prima: verde), «con prezzi medi»: verde; «Giorno 1 a Troina» in un tour di un giorno: ROSSO (prima: verde), «Giorno 1/Giorno 2» in un tour di due giorni: verde; «sunny» su un tour di domani: ROSSO come prima.
- Il controllo c8 legge le sezioni **come le intitola la schermata** (`groupStopsByDayAndMoment`, la stessa funzione di `AiItinerary` e `TourStopsByMoment`), registrate nel grezzo (`schermo.sezioni`).

## Test rosso→verde

I test nuovi o riscritti, copiati su un worktree di `2015b5c`: **34 falliscono**. Punto per punto: 1 `testiFrasi` (tempo libero), `tempoLiberoC5e`, `continuita`, `minimiC8b`, `vuotiC8d`, `composizioneC1`; 2 `testiAiItinerary` (etichette), `testiItaliano` (modulo assente); 3 `testiAiItinerary` (meteo), `narratoreComposto` (meteo di domani); 4 `testiFrasi` (giornata, durata, minuto), `testiItaliano` (barra); 5 `testiFrasi` e `testiAiItinerary` (Dopocena, «Il drink…», titolo dopo le 21:30); 6 `testiFrasi`, `stopPhrases`, `senzaGiudizi`; 7 `narratoreComposto` (titolo), `testiAiItinerary` (un giorno senza numero); 8 `topBar_saluto`, `useUserContext_nome`; 10 `testiFrasi`, `narratoreDopo`, `narratoreComposto` (fra i tour di Per Te).

## Schermate (`docs/prove/schermate/`)

Playwright con il Chromium già installato (149), iPhone 390×844 @2x. **Porta libera (5188) e titolo «DoveVai | Esplora l'Italia Autentica» verificati prima di qualunque credenziale**; vite di questo repo (cwd controllata). La sessione dell'account di prova (credenziali solo da `.env.local`, mai stampate) è entrata nella pagina già verificata; nessuna password digitata in un modulo.

| File | Cosa mostra |
|---|---|
| `01-home-saluto.png` | home, «Ciao, Ivano!» |
| `02-crea-catania-giorno-tempo-libero-futuro.png` | Crea Catania di giorno, **domani**: due righe di tempo libero con fascia, etichette («monumento», «ristorante», «pub»), prezzi a parole, nessun meteo, «9 tappe programmate», nessun «Giorno 1» |
| `03-crea-catania-serale.png` | Crea Catania 18:00: Aperitivo, passeggiata (card propria con orario 18:46, non toccata), Cena; «Sereno, 20°C»; «Qui la giornata si chiude» solo sulla cena |
| `04-veloce-catania-dopo-le-2130.png` | Veloce Catania 22:20: sezione «Dopocena», «Il tuo giro a Catania» |

**Limiti dichiarati.** (1) La pagina non accetta l'ora simulata: i tour sono quelli **generati dal banco con l'ora simulata** (grezzi di questo giro), mostrati nella pagina vera di Crea con l'hook di anteprima già presente (`__setAiItineraryPreview`); il riepilogo del Veloce è il vero componente `QuickPathSummary` in una pagina di prova temporanea (non committata). (2) Nella home il profilo dell'account di prova non ha un nome: solo in quel browser la sessione e la risposta di `/auth/v1/user` portano `first_name: 'ivano'` (come l'ha scritto Ivano); il server non è toccato. Una prima schermata, fatta col profilo vero, mostrava un pezzo della mail dell'account: **cancellata, mai salvata**. (3) La schermata 03 viene dal giro su `ddcce67` (vedi sotto).

## Spesa

Giro 1 (3 casi, `ddcce67`): **0,510 $**. Giro 2 (4 casi, `3a880c9`): **0,632 $**. Schermate: **0 $** (nessuna chiamata AI né Google). **Totale del task: 1,142 $** su 1,5 $ (stop a 1,35 $). Nessun caso sul codice vecchio (il «prima» viene dai grezzi già nel repo, 0 $).

## Cosa non è stato rigirato

I numeri finali vengono da un giro sul codice finale **tranne**:
- `crea-catania-1800` e `crea-catania-domani` (giro 1, `ddcce67`): da allora sono cambiati solo la tabella delle etichette (le etichette di queste tappe sono ricalcolate dal tipo principale registrato nel grezzo: `pub` al posto di «birreria») e la regola del titolo dopo le 21:30, che non riguarda giri che partono alle 09:30 e alle 18:00. Non rigirati per non superare il tetto.
- `perte-catania-1300` (giro 2, `3a880c9`): dopo il giro ho spostato il registro delle frasi usate **fuori dal singolo tour**, perché i tour tematici di Per Te stanno insieme sulla home e c7 conta sull'intero caso. Il test su due tour passa; **il giro vivo non è stato rifatto** (0,221 $ → 1,36 $ totali). Se vuoi che lo rifaccia, mi serve il tuo via libera sopra 1,35 $.

## Decisioni da confermare

1. **Tempo libero**: a schermo titolo «Tempo libero» + fascia + «Niente in agenda: cammina dove ti porta la strada.» (tre righe, non una sola frase). Due righe di tempo libero nello stesso tour dicono la stessa cosa (voluto da te) e c7 non le conta; la riga «Nessun locale aperto qui vicino a quest'ora.» di un pasto senza locali aperti resta.
2. **«con prezzi medi»** al posto di «in fascia €€» (non «in prezzi medi»); `priceLevel` 4 → «prezzi alti».
3. **`pub`** per pub e gastropub (parola italiana nei dizionari); «bar» per cocktail bar.
4. **Frasi che dicevano il falso**, oltre a «Qui la giornata si chiude»: «Chiudi la giornata a tavola» solo sull'ultima tappa serale, «Si parte da…» solo sulla prima; «sei qui 0 minuti prima» non si dice più.
5. **Ripetizioni**: per non scrivere frasi nuove le famiglie simili si prestano le frasi approvate (monumento ↔ piazza ↔ porta/arco, chiesa → monumento). Con tanti luoghi dello stesso tipo la ripetizione può restare: il banco la conta (c7 scatta a 3, qui si conta anche 2).
6. **Titolo di un giorno**: «Il tuo giro a X» (stringa già nel codice per il prewarm); navigatore dei giorni nascosto con un giorno solo.
7. **Saluto dalla mail**: solo la prima parola prima di punti, «+», trattini o cifre.
8. **Dopocena**: per tappa (drink alle 21:25 sotto «Aperitivo», passeggiata delle 22:10 sotto «Dopocena»).

## Cosa ho dato per vero senza verificarlo

- Che i 6 casi (4 «Catania», 1 Firenze) bastino per c7 e c8: un campione per caso, 30 tappe.
- Che «dalle 21:30 all'alba» sia la regola del Dopocena (l'hai detto per «dalle 21:30»; fino alle 6:00 è una mia estensione).
- Che «finisce di sera» voglia dire «arriva dalle 18:00» (inizio dell'aperitivo nella tabella dei momenti).
- Che l'etichetta del tipo principale sia sempre vera per il luogo (Google a volte sbaglia: «Drinkeria cocktail bar» ha tipo principale `pub`).
- Che le schermate dai grezzi rappresentino la pagina dopo una generazione vera: stessi dati e stessi componenti, ma non è passata dal flusso di generazione nel browser.
- Che la home col nome «ivano» iniettato nel solo browser sia equivalente a un profilo con quel nome.
- Che il Chromium 149 già installato renda come un iPhone: è un viewport mobile, non un iPhone.
- Deploy da verificare da Ivano.
