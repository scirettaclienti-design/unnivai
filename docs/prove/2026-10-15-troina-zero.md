# TROINA-ZERO — perché a Troina l'app non dà più tour

**Esito in breve**

- **La causa è provata.** Il vuoto viene dal **giro corto del borgo**, che dal commit `37425ef` (C10c-piena-1, in produzione dal deploy di `b34bb81` del 14/10 alle 21:30) scatta a Troina.
  - Prima di quel commit San Silvestro contava come luogo da visitare. Da `37425ef` non conta più: per Google ha solo `point_of_interest` ed `establishment`.
  - Così i luoghi da visitare della lista scendono da 4 a 3, sotto la soglia di 4, e scatta il giro corto.
  - Il giro corto dura 90–180 minuti da adesso: alle 12:06 la giornata ha **un solo momento, il pranzo**.
  - Con una categoria (natura, storia) il selettore non trova nel pranzo niente della categoria e risponde vuoto.
- **«Non troviamo» nasconde un'altra cosa.** Il risultato vuoto ha `_source: no-results-error`, che è il ramo degli errori del selettore. Il Quiz lo mostra come «A Troina non troviamo parchi e giardini». Google invece aveva risposto, e a Troina ci sono Monte Muganà e il Belvedere di Piazza Conte Ruggero.
- **Nessun errore tecnico nei log del 15/10, 12:00–12:15.**
  - Tutte le chiamate a places-proxy e openai-proxy rispondono 200.
  - La lista di Troina del 15/10 c'era: `c10b-7`, 7 verificati, servita dal server.
  - Google ha risposto con posti veri. Li hanno scartati il giro corto e il filtro di categoria.
- **«Per Te» a Troina non dipende da questa regressione.**
  - Il suo codice non cambia fra `a7c233f` e `b096732`.
  - A mezzogiorno nessun tema arriva a 3 tappe aperte: i due musei chiusi, la natura tutta a 15–400 km.
  - La home mostra «A quest'ora qui è quasi tutto chiuso.»
- **Riproduzione.**
  - Main a Troina (ora simulata 12:05–12:07 del 15/10): Quiz Natura e Quiz Storia **0 tappe**; Sorprendimi Natura e Arte **1 tappa + tempo libero**; Crea **1 tappa**; Per Te **0 tour**.
  - `9babc43`, il commit prima di C10c-piena-1: Quiz Natura **3 tappe in 4 ore**.
  - Catania su main: Per Te **3 tour**, Quiz Natura **3 tappe**.
- **Costo: 1,75 $ di listino (tetto 2 $), circa 0,77 $ reali.** Quasi tutte le ricerche Google erano nella cache del proxy.
- Nessuna modifica al codice, nessun deploy. Database e log solo in lettura.

## 1) I flussi della home

Tutti e tre i bottoni «Crea» chiamano lo stesso motore: `aiRecommendationService.generateItinerary`, che usa `_neverEmpty` e poi `_generateItinerary`.

| Flusso | Pagina e chiamata | Motore | Lista della città | Raggio e filtri di luogo | Messaggio sul vuoto |
|---|---|---|---|---|---|
| **Per Te** (home) | `DashboardUser.jsx:242–275`: `discoverAllThemes`, poi `buildInsiderPool`, poi `generateHomeTours` | 4 ricerche Google fisse per tema (`THEME_TEXTSEARCH`); 1 chiamata gpt-4o-mini che compone i tour; dalle 18:00 invece il motore dei momenti (`_homeSera`) | **No** di giorno; sì di sera (passa da `generateItinerary`) | Ricerche a 12 km dal centro. `applyRadiusFilter`: 5 km nei borghi, 10 in città, allargato a 12/20 se ne restano troppo pochi. Ogni tour deve avere **almeno 3 tappe aperte all'arrivo** (`keepOpenStops`, `perTeMealProblem`) | Non dice «non troviamo». Con `closed-now` mostra «A quest'ora qui è quasi tutto chiuso.» (o «È presto…», «…parte domattina»); senza tour «Nessuna guida ha ancora pubblicato un tour a X.» + «Qui intorno non trovo ancora luoghi verificati da proporti.» (`DashboardUser.jsx:730–736`) |
| **Crea il tuo Tour – Su misura per te** | In realtà apre due riquadri, «Con Guida» e **«Sorprendimi»** (`SurpriseTour.jsx:222–238`, categorie Gastronomia, Arte, Natura, Sorpresa). Nessun `pathType`, durata «Mezza Giornata» | Testo fisso, quindi traduttore → ricerche Google (percorso A) → scheletro dei momenti → selettore | **Sì** | Il centro sono le coordinate del contesto. Raggio 5/10 km (+12/20), zone (`zone.js`), regola del borgo | «A X non troviamo {oggetto}.» per qualsiasi risultato a 0 tappe tranne `closed-now` (`SurpriseTour.jsx:255–258`) |
| **Quiz Veloce** (la scelta per categoria: Città, Natura, Storia, Relax; nella card «Quiz Veloce» della home) | `QuickPath.jsx:648–659`. Il testo è costruito dal wizard: «A X cerco: parchi, giardini e aree verdi. Escludi: chiese, musei, monumenti storici.» `pathType: 'quick'` | Come Sorprendimi (percorso A col traduttore). In più il **filtro stretto di categoria** (`candidateMatchesIntentCategoria`), applicato *dopo* l'unione con la lista | **Sì** | Come sopra | «A X non troviamo {oggetto}.» per qualsiasi 0 tappe tranne `closed-now`. Senza oggetto: «Non basta per un tour.» (`QuickPath.jsx:674–679`, `:1093`) |
| **Crea il tuo Percorso – Intelligenza artificiale per te** | `AiItinerary.jsx:207–219`, testo libero, `pathType: 'custom'` | Città dal testo (`resolveTextDestination`), poi lo stesso motore | **Sì** | Come sopra | `search-error`: «Connessione instabile: non riesco a cercare adesso. Riprova tra un momento.» `closed-now`: il suo messaggio. `no-results`, `no-results-error`, `no-results-safety`: «A X non troviamo {oggetto}.» (`AiItinerary.jsx:226–257`) |

**Filtri comuni ai tre «Crea»**, in ordine (`aiRecommendationService.js:2422–2653`):
1. La lista della città viene attesa prima delle ricerche.
2. La scala (borgo, città, metropoli). Nel **borgo con meno di 4 luoghi da visitare** in lista scatta il **giro corto**: la durata è di 45 minuti per luogo aperto (2–4 luoghi), nella fascia aperta (`fasciaApertaBorgo`). Per scegliere la fascia contano solo i posti entro 1,5 km dal centro; il pool non viene tagliato.
3. La regola delle zone.
4. Il raggio (`applyRadiusFilter`, 5 km nel borgo).
5. La categoria stretta (Quiz e testi con categoria).
6. Il merito, poi lo scheletro dei momenti, gli orari e il selettore.

**Filtro del comune.** Nel client non c'è. C'è solo sul server, quando si verifica la lista di un borgo: `nelComune` vuole il nome del comune nell'indirizzo di Google (`openai-proxy/cityKnowledge.ts:615`), con un raggio di 5 km.

**Il banco.**
- Il banco nazionale prova solo «Crea» (`pathType: 'custom'`, «Domani, una giornata a X») e «Per Te» a Roma e Catania.
- L'esteso prova Crea (18 casi), Quiz Veloce (10, uno solo «parco»), Sorprendimi (5) e Per Te (7).
- A Troina il banco fa solo **Crea** («una giornata»/«mezza giornata», con «domani» o con la mattina). Nessun caso fa **Quiz o Sorprendimi in un borgo partendo da adesso a mezzogiorno**, che è il caso rotto.

## 2) I log del 15/10, 12:00–12:15

Fonti: log delle funzioni (`function_edge_logs`), `ai_generation_ticket`, `places_cache`, `city_knowledge`. Una sola persona in tutta la finestra; nessun identificativo è riportato qui.

**Linea del tempo** (ora italiana):

| Ora | Cosa | Prova |
|---|---|---|
| 12:05:37–12:05:53 | **Per Te**: 4 ricerche per tema a Troina (raggio 12 km), la ricerca del pranzo, 3 dettagli degli orari, 2 biglietti `home_tours`, chiamate AI da 1–9 s | tutte **200** |
| 12:06:27–12:06:40 | **Quiz Natura** (biglietto `itinerary`, 3 chiamate). La lista arriva dal server in 223 ms; il traduttore in 3,4 s («villa comunale parco», «orto botanico», «giardino pubblico»); il selettore in 3,3 s. Poi il secondo tentativo: la lista (189 ms), le ricerche di base («parco villa comunale giardino botanico», «trattoria…») e il selettore (2,7 s) | tutte **200** |
| 12:06:54–12:07:06 | **Quiz «luoghi storici»** (biglietto `itinerary`): «piazza storica», «monumenti storici», «centro storico», poi il secondo tentativo con le ricerche di base | tutte **200** |
| 12:07:30 | Di nuovo **Per Te** (2 biglietti `home_tours`) | **200** |

La sequenza lista → traduttore → selettore → lista → selettore è quella del vuoto riprodotto nella sezione 3, con lo stesso numero di chiamate.

**La lista c'era.** In `city_knowledge` c'è la riga `troina`, giorno 2026-10-15, versione `c10b-7`, scala `borgo`, 7 proposti e 7 verificati, creata il 14/10 alle 17:02 dal banco. I 7 posti:

| Posto | Tipi di Google | Conta come luogo da visitare del borgo? |
|---|---|---|
| Chiesa Madre di Maria SS. Assunta (simbolo) | church, place_of_worship… | sì |
| Chiesa di San Silvestro Monaco Basiliano | **solo** point_of_interest, establishment | **no da `37425ef`** (prima sì) |
| Torre Capitania | museum, tourist_attraction | sì |
| Convento di Sant'Agostino | place_of_worship… | sì |
| Piazza Conte Ruggero | route | no (piazza: passeggiata) |
| La Contea dei Normanni | restaurant | no |
| Via Conte Ruggero | route | no (via principale: passeggiata) |

**Le ricerche non sono andate in errore né in timeout, e non hanno risposto zero.** Da `places_cache` (righe scritte fra 12:05 e 12:07, `status OK`):

| Ricerca | Risultati | Entro 5 km da Troina |
|---|---|---|
| orto botanico Troina | 12 | Torre Capitania, Chiesa San Nicolò, **Monte Muganà (1,5 km)**, più hotel e uffici. Gli orti veri sono a Catania, Messina, Palermo |
| giardino pubblico Troina | 20 | **Monte Muganà**, **Ponte di Failla (3,2 km)**, Torre Capitania, bar e uffici |
| villa comunale parco Troina | 20 | nessuno (la più vicina è a Cerami, 8,2 km) |
| lungomare … belvedere punto panoramico Troina (Per Te) | 4 | **Belvedere di Piazza Conte Ruggero**, **Monte Muganà**, Torre Capitania, Ponte di Failla |
| monumenti storici Troina | 4 | Torre Capitania, Monumento ai caduti, Cimitero monumentale, Ponte di Failla |
| centro storico Troina | 1 | un B&B |

**Esito.** Google ha trovato posti veri a Troina. Sono stati scartati da un filtro del client, non da un errore. Quali filtri lo dice la riproduzione.

## 3) La regressione

### Il commit

**`37425ef`** — fix(c10c-piena-1): «tipi generici non contano nel borgo». In produzione col merge `0f073d8`, deploy di `b34bb81` il 14/10 alle 21:30. Il vuoto arriva dalla catena di tre regole:

1. **`37425ef`** (`cityKnowledge.luogoDaVisitareBorgo`). I tipi `point_of_interest` ed `establishment` da soli non bastano più. San Silvestro esce dal conto: i luoghi da visitare scendono da 4 a 3, sotto `BORGO_MIN_VERIFICATI = 4`, e a Troina scatta il giro corto.
   - Prima, in `a2aeb9f` (lo stesso task), San Silvestro contava ancora. Lo dice il report `2026-10-18-c10c-piena-1.md` («San Silvestro… contava come luogo da visitare», corretto in `37425ef`).
2. **`be59b32`** (C10b3, `fasciaApertaBorgo`) e **`0f6059e`** (C10b2, `durataBorgoCorto`). Il giro corto dura 45 minuti per luogo aperto (2–4) e la finestra non si allunga mai.
   - Un Quiz o un Sorprendimi parte da adesso. Alle 12:06 la finestra è 12:06–13:36 (90 min) o 12:06–15:06 (180 min).
   - Lo scheletro della giornata contiene **un solo momento: il pranzo**.
3. **Il filtro stretto di categoria** (pre-esistente). Con «natura» o «storia» il pool si riduce a 4 posti. Il pranzo ne riceve 3, cioè i ristoranti, e due sono chiusi.
   - Il selettore risponde senza tappe: `AI returned no stops (F2)`.
   - Il motore lo tratta come errore del selettore: `no-results-error`, con l'oggetto del traduttore.
   - Il secondo tentativo con le ricerche di base rifà lo stesso giro corto e resta vuoto.
   - Il Quiz mostra «A Troina non troviamo parchi e giardini».

Riga per riga, dal log della riproduzione su main:
```
[C10b SCALA] Troina: proposta borgo → borgo
[Gate B] intent tradotto: queries=["villa comunale parco","orto botanico","giardino pubblico"] categoria=natura
[C10b3 BORGO] Troina: 3 posti della lista (< 4) → giro corto 135 min dalle 12:06
[Gate TOUR-DISTANZA] Troina: 16/34 candidati scartati PRIMA della chiamata AI (Taormina, Catania, Nebrodi 17,5 km…)
[Gate RAGGIO-CATEGORIA] Troina: 14/18 candidati scartati per categoria≠"natura"
[P3 SCHELETRO] Troina: 1 momenti — g1-pranzo×1(3 cand.)
[ORARI] Troina: 2 posti chiusi quando ci si arriva — AL216, Pizza&Go
[Gate B] path A selettore fallito (AI returned no stops (F2)) → errore onesto
[T1b mai vuoto] Troina: vuoto anche con le query di base → messaggio onesto
```

**Le altre modifiche lette** (`a7c233f..b096732`, diff di `aiRecommendationService.js`, `cityKnowledge.js`, `QuickPath.jsx`, `AiItinerary.jsx`, `placesDiscoveryService.js`, `cityCenterService.js`):
- Il passaggio del modello (`callOpenAIProxy`), il bias del quartiere (solo metropoli), il prompt del traduttore (solo gli esempi) e il quartiere chiesto (mai nel borgo) non toccano Troina.
- La regola delle zone fa eccezione per piazze e vie della lista: a Troina tiene, non toglie.
- `generateHomeTours` e `prepareHomePools` (Per Te) **non cambiano** nell'intervallo.

### La riproduzione

Script temporaneo, non committato: account di prova con le credenziali solo da `.env.local`, ora simulata con `simulatedNow`. Le chiamate sono identiche a quelle delle pagine: `buildQuickPrefs` e `buildPromptFromSelections` del Quiz, la frase di Sorprendimi, `discoverAllThemes` + `buildInsiderPool` + `generateHomeTours` per Per Te.

**Troina su main (`b096732`).** Ore italiane; finestra Medio per il Quiz, Mezza Giornata per Sorprendimi, giornata per Crea.

| Flusso | Ora | Esito | Cosa vedrebbe l'utente |
|---|---|---|---|
| Per Te | 12:05 | `closed-now`: 4 tour proposti, **0 serviti** | «A quest'ora qui è quasi tutto chiuso.» |
| Quiz Natura | 12:06 | `no-results-error`, oggetto «parchi e giardini», **0 tappe** | «A Troina non troviamo parchi e giardini.» |
| Quiz Storia | 12:06 | `no-results-error`, oggetto «luoghi storici», **0 tappe** | «A Troina non troviamo luoghi storici.» |
| Sorprendimi Natura | 12:06 | giro corto 12:06–13:36: **12:30 La Contea dei Normanni** + tempo libero | un ristorante e un'ora di tempo libero, per «Esperienza Naturale» |
| Sorprendimi Arte | 12:06 | giro corto 12:06–15:06: **12:30 La Contea dei Normanni** + tempo libero | idem, per «Avventura Culturale» |
| Crea («Una giornata a Troina») | 12:07 | giro corto spostato alla fascia aperta 17:07–20:07: **18:00 Chiesa Madre** + tempo libero | una tappa |

Per Te, gli scarti di quel giro:
- **insider**: Pizze&Delizie (secondo pasto), «a mecca i crisafi» (pasto fuori fascia), A'Pescheria (meno di 3 tappe);
- **food**: Pizza&Go e Black & White chiusi all'arrivo;
- **cultura**: MACTRO (chiude alle 13:00) e Museo Robert Capa (chiuso) chiusi; Ponte di Failla da solo;
- **romance**: Belvedere e Monte Muganà soli, sotto le 3 tappe;
- **nature**: 12 parchi, tutti fra 17 e 400 km, tolti dal raggio.

**Troina su `9babc43`** (C10b3-chiusura, subito prima di C10c-piena-1), Quiz Natura alle 12:06:
- nessun giro corto (`mezzaGiornata` assente), finestra 12:06–16:06;
- **12:30 A'Pescheria, 14:30 Via Conte Ruggero, 15:03 Chiesa di San Silvestro**: il tour esce.
- Non è un tour di natura: il filtro di categoria ne lascia passare pochi, e il resto lo riempie il codice. Ma non è vuoto.

**Catania su main**, stesse ore:
- Per Te: **3 tour serviti** (insider, cultura, romance), 3 tappe ciascuno.
- Quiz Natura: 12:30 Maccarruni, 14:30 Via Etnea, 15:02 Piazza del Duomo.
- Catania è una città: niente giro corto. A margine: anche qui il «Natura» non dà verde. Lo segnalo, non l'ho indagato.

**Commit provati dal vivo:** main e `9babc43`.

**`a2aeb9f` contro `37425ef`, a 0 $.** Ho applicato la regola del borgo alla lista vera di Troina del 15/10 (`c10b-7`, `city_knowledge.verificati`, solo nomi, tipi, tipo principale e `_citta`).
- Il conteggio usa lo stesso filtro del motore (`aiRecommendationService.js:2542`): niente passeggiate, piazze e vie della lista, zone.
- Per `37425ef` ho usato il `luogoDaVisitareBorgo` di main, identico a quello del commit. Per `a2aeb9f` ho usato la stessa funzione senza il filtro `TIPI_GENERICI`, che è l'unica differenza nel diff della funzione.
- Nessuna chiamata AI né Google. Il test era temporaneo e non è committato.

| Regola | Luoghi da visitare | Soglia | Giro corto |
|---|---|---|---|
| `a2aeb9f` | Chiesa Madre, **San Silvestro**, Torre Capitania, Convento di Sant'Agostino: **4** | 4 | no |
| `37425ef` = main | Chiesa Madre, Torre Capitania, Convento di Sant'Agostino: **3** | 4 | **sì** |

San Silvestro ha per Google solo `point_of_interest` ed `establishment`. Con `37425ef` esce dal conto, ed è l'unico posto che cambia.

## 4) Tutti i «non troviamo», veri o no

| Dove | Testo | Quando | Vero? |
|---|---|---|---|
| Quiz Veloce `QuickPath.jsx:1093` | «A X non troviamo {oggetto}.» | Qualsiasi risultato a 0 tappe tranne `closed-now`; `_source` non guardato | **Può essere falso.** Copre: `no-results` vero; `no-results` dopo i filtri (giro corto, categoria, raggio, zone); **`no-results-error`** (selettore caduto, in timeout o vuoto, eccezione nelle ricerche); `no-results-safety`. **Troina 15/10: falso**, perché è il giro corto che lascia solo il pranzo |
| Quiz Veloce, senza oggetto | «Non basta per un tour.» | 0 tappe senza oggetto, es. `search-error` (tutte le ricerche fallite) | **Falso** con `search-error`: è la rete, non la città |
| Quiz Veloce, timeout di pagina 35 s | errore tecnico | La lista del giorno nuova può metterci fino a 110 s | Vero (è un errore) |
| Sorprendimi `SurpriseTour.jsx:258` | «A X non troviamo {oggetto}.» / «Non basta per un tour.» | Come il Quiz | **Può essere falso**, stessi casi del Quiz |
| Crea `AiItinerary.jsx:257` | «A X non troviamo {oggetto}.» | `no-results`, `no-results-error`, `no-results-safety` | `no-results`: vero o «vero dopo i filtri». **`no-results-error`: falso**, è un errore del selettore o un'eccezione. `no-results-safety`: un difetto del codice. `search-error` ha il suo messaggio di rete (giusto) |
| Crea, dopo il secondo tentativo riuscito | «Non ho trovato {oggetto}: ti propongo un giro di X» (`aiRecommendationService.js:763`) | Il primo tentativo vuoto per qualunque motivo, anche tecnico | **Può essere falso** se il primo tentativo era caduto per errore |
| Per Te `DashboardUser.jsx:730–736` | «Nessuna guida ha ancora pubblicato un tour a X.» + «Qui intorno non trovo ancora luoghi verificati da proporti.» | Nessun tour: `no-pools`, eccezioni inghiottite (`:251`, `:279`), di sera `search-error`/`no-results-error` passati come `_source` | **Può essere falso**: un errore di `generateHomeTours` diverso da quota e motore AI, o una ricerca fallita a metà, finisce qui |
| Per Te, `closed-now` | «A quest'ora qui è quasi tutto chiuso.» | Nessun tour servito **e** almeno una tappa tolta perché chiusa | **Mezzo vero**: scatta anche quando la causa principale è il minimo di 3 tappe in un borgo piccolo (Troina: Torre Capitania, Belvedere e Monte Muganà erano aperti) |

Le quote esaurite e gli errori del motore AI non diventano «non troviamo»: `mustReachUi` li porta alla pagina col loro messaggio.

## 5) Proposte, ordinate per effetto (nessuna applicata)

1. **Il giro corto del borgo non tronca un giro che parte da adesso.**
   - Oggi un Quiz o un Sorprendimi a mezzogiorno resta col solo pranzo.
   - Proposta: il giro corto vale solo per «Crea, una giornata» (dove nasce: una giornata intera troppo lunga per un borgo). Oppure non scende mai sotto la durata scelta dall'utente (Veloce/Medio/Lungo, Mezza Giornata).
   - Effetto: Troina torna a dare tour in Quiz e Sorprendimi. Si prova col replay a 0 $ su un tracciato del Quiz a Troina.
2. **Un errore tecnico non diventa mai «non troviamo».**
   - `no-results-error`, `no-results-safety` e `search-error` hanno un messaggio loro in **tutte** le pagine. Il Quiz e Sorprendimi oggi non guardano `_source`.
   - Il selettore che risponde «nessuna tappa» quando ha candidati è un caso a sé: va scritto nel tracciato e non chiamato errore né «non troviamo».
   - Per Te: le eccezioni inghiottite non diventano «non trovo luoghi verificati».
   - Il testo per l'errore lo decide Ivano; esiste già «Connessione instabile: non riesco a cercare adesso. Riprova tra un momento.»
3. **Il conto del borgo.**
   - La soglia di 4 luoghi da visitare con il filtro dei tipi generici fa cadere Troina da un giorno all'altro, per un tipo di Google di una chiesa.
   - Proposta: una chiesa della lista (categoria `chiesa` dell'AI) conta come luogo da visitare anche se Google ha solo i tipi generici.
   - Oppure: soglia a 3.
4. **Natura e panorami appena fuori dal centro.**
   - Monte Muganà (1,5 km, `scenic_spot`, indirizzo «94018 Troina») e Ponte di Failla (3,2 km) **non li toglie un filtro del comune**: nel client non ce n'è uno, e l'indirizzo dice Troina.
   - Monte Muganà si perde per altre ragioni:
     - nel Quiz, perché il giro corto lascia solo il pranzo (proposta 1);
     - in Per Te, perché il tema «romance» resta sotto le 3 tappe (proposta 5);
     - e perché non è nella lista della città.
   - Il giro corto non lo toglie: il suo limite di 1,5 km serve solo a scegliere la fascia oraria.
   - Proposta: nel prompt della lista del borgo, chiedere anche un luogo di natura o un panorama entro 5 km dal centro (oggi le quote del borgo non lo chiedono).
   - Proposta: sul server, `nelComune` (verifica della lista del borgo) potrebbe accettare un posto naturale entro 5 km anche con l'indirizzo di un comune vicino. Oggi un posto appena oltre il confine, con l'indirizzo dell'altro comune, è scartato «fuori comune».
5. **Per Te nei borghi.**
   - Il minimo di 3 tappe aperte per tour, con i pool a 4 temi, in un borgo a mezzogiorno dà zero tour.
   - Proposta: nel borgo un solo tour misto (i posti aperti di tutti i temi) invece dei 4 temi.
   - In più, il messaggio «quasi tutto chiuso» solo quando le chiusure sono davvero la causa.
6. **I flussi della home: ridurli.**
   - «Su misura per te» apre «Sorprendimi», che usa una frase di sistema come richiesta dell'utente e nessun `pathType`. Il Quiz Veloce manda una frase costruita.
   - Sono due ingressi diversi per la stessa cosa: scegliere una categoria.
   - Proposta: un solo ingresso per categoria (il Quiz), con le categorie di Sorprendimi dentro. Tre flussi in tutto: Per Te, per categoria, testo libero.
7. **Il banco.** Aggiungere al banco esteso un caso Quiz Natura e uno Sorprendimi in un borgo (Troina) che partono da adesso a mezzogiorno. Il caso rotto oggi non lo misura nessuno. Proposta, non toccato.

## 6) Costo

| Voce | Chiamate AI | Ricerche Google | Listino |
|---|---|---|---|
| Troina su main (6 flussi) | 27 (gpt-6.1-sol e gpt-4o-mini) | 33 | 1,209 $ |
| Troina su `9babc43` (Quiz Natura) | 5 | 5 | 0,180 $ |
| Catania su main (Per Te, Quiz Natura) | 6 | 10 | 0,362 $ |
| **Totale** | | | **≈ 1,75 $** (tetto 2 $, soglia 1,8 $) |

- Il listino conta ogni ricerca Google a prezzo pieno, come il banco.
- Le ricerche nuove sono 19 textsearch e 2 findplace (righe scritte in `places_cache` durante le prove); le altre venivano dalla cache.
- Costo reale stimato **≈ 0,77 $**: circa 0,70 di Google e 0,07 di AI.
- Mi sono fermato prima di altre prove pagate. Il confronto `a2aeb9f`/`37425ef` l'ho fatto dopo, a 0 $: la regola del borgo applicata alla lista salvata, senza rete (vedi §3).
- **Scritture sul database:** solo quelle che fa il proxy da sé, cioè 21 righe di `places_cache` e i biglietti `ai_generation_ticket` dell'account di prova (`label = 'test'`). Nessuna lista nuova: quella di Troina e quella di Catania erano già sul server.

## 7) Verifiche e commit

- Cartella `~/unnivai-1b`, main a `b096732`, suite **2061 verdi** prima di cominciare.
- Ramo `troina-zero` da main. Committato solo questo report. `AGENTS.md` fuori.
- Lo script della prova e il worktree di `9babc43` erano temporanei e sono stati tolti.

## Cosa ho dato per vero senza verificarlo

1. **Quale bottone ha premuto l'utente alle 12:06.** I log non dicono la pagina. «orto botanico», «giardino pubblico», «villa comunale parco» coincidono col traduttore del Quiz Natura riprodotto; la stessa sequenza di chiamate (lista, traduttore, selettore, secondo tentativo) vale per Sorprendimi. «piazza storica», «monumenti storici», «centro storico» possono essere il Quiz Storia o il Quiz Città: la mia riproduzione del Quiz Storia ha tradotto in «museo, sito archeologico, monumento storico». Il meccanismo del giro corto è lo stesso.
2. **Che cosa ha visto l'utente.** Lo deduco dal codice delle pagine e dal `_source` riprodotto, non da uno schermo.
3. **`a2aeb9f` contro `37425ef`.** Il conteggio del borgo l'ho verificato sulla lista salvata (4 contro 3, §3). Non ho rigenerato un tour completo sui due commit. Che con 4 luoghi il Quiz esca pieno lo deduco da `9babc43`, che non fa il giro corto e dà 3 tappe.
4. **Il proxy è quello di oggi in tutte le prove.** Anche `9babc43` ha usato `openai-proxy` v24 e la lista `c10b-7` del server. Sui commit vecchi, in produzione, la lista dipendeva dal proxy pubblicato in quel momento.
5. **Il vuoto poteva esserci a tratti anche prima.** Con la lista `c10b-2` del 14/10 mattina (1 solo verificato) il giro corto scattava già (regola C10b). Non l'ho riprodotto.
6. **Per Te prima di oggi.** Che a Troina desse tour «prima» non l'ho verificato. Il suo codice non cambia nell'intervallo; il vuoto viene dagli orari veri (ORARI, 13/10) e dal minimo di 3 tappe, e dipende dall'ora.
7. **Il ripiego dei modelli.** Nelle prove il traduttore e il selettore hanno usato `gpt-6.1-sol`, senza ripiego. Il 15/10 alle 12:06 non so quale modello abbia risposto: i log delle funzioni non lo dicono.
8. **Costo reale.** È una stima: le ricerche nuove al prezzo della ricerca nuova di Google, l'AI dai token restituiti dal proxy al listino del banco. I dettagli degli orari non hanno righe in `places_cache` e non li ho contati.
9. **Catania «Natura» senza verde.** L'ho visto in un solo giro e non l'ho indagato.
