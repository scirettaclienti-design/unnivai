# RACCONTO-FONTI — le tappe senza fonti per colpa della ricerca per nome (02/11/2026)

Cartella `/Users/mac2023ivanosciretta/unnivai-notte-racconto-fonti` (verificata con `pwd` all'avvio), worktree del ramo `notte/racconto-fonti` da `origin/main` (`dcc51c0`). Prompt, controllo automatico, revisore, soglia di 200 caratteri, TTL e app **non toccati**.

## Cosa cambia per Ivano
- **7 tappe su 9 che erano senza fonti ora hanno la loro fonte** (Porta Uzeda, Chiesa Madre di Troina, Torre Capitania, Piazza Conte Ruggero, Roseto comunale, Terrazza delle Quadrighe, Galleria Colonna). **6 hanno un racconto passato**; il Roseto è scartato (più di 4 frasi, anche dopo la riscrittura).
- Restano senza racconto: **Giardino di Sant'Alessio** (nessuna voce lo descrive: compare solo in un elenco), **Monte Muganà** (la voce di Troina gli dedica 97 caratteri), **Galleria del Cardinale Colonna** (nessuna voce la nomina; vedi sotto).
- Le tappe che avevano già le fonti non cambiano: la strada nuova parte solo quando la ricerca per nome dà meno di 200 caratteri fra Wikipedia e Google.

## Come si cercano le fonti (solo `supabase/functions/openai-proxy`)
`allargaWikipedia` (`raccontoFonti.ts`), chiamata da `handleRacconto` solo se `haFonti` è falso e Wikipedia ha risposto. Tre strade, in quest'ordine; vince la prima che dà un testo, poi decide la soglia di sempre.
1. **Voce intera.** La ricerca per nome ha trovato la voce giusta ma l'introduzione è corta: si prende il resto della voce, a frase intera, fino a 1500 caratteri, senza Note, Bibliografia, Curiosità, Voci correlate, Collegamenti. Porta Uzeda: da 94 a 606 caratteri. Roseto di Roma: da 119 a 1375.
2. **Voce vicina.** Geosearch di Wikipedia entro **200 m**; vale una voce con nome compatibile o con **lo stesso nome proprio** (`stessoNomeProprio`: tolte le parole di tipo, gli articoli e la città restano le stesse parole; il tipo, se c'è in tutti e due, è della stessa famiglia). Chiesa Madre di Maria Santissima Assunta → «Ex cattedrale di Maria Santissima Assunta (Troina)», 12 m. «Giardino di Sant'Alessio» ↔ «Basilica dei Santi Bonifacio e Alessio» (37 m) non vale.
3. **Menzioni.** Ricerca della frase esatta `"nome"`; valgono le voci entro **300 m** dalla tappa o la voce della città (titolo = città) entro **5 km**. Si prendono **solo le frasi che nominano la tappa** (o una sezione intitolata col suo nome); di una frase a pezzi (trattini, punto e virgola) solo il pezzo col nome (`pezzoColNome`).
   - Terrazza delle Quadrighe → Vittoriano (29 m): «Dal giugno 2007 è possibile salire alla terrazza delle quadrighe…».
   - Galleria Colonna → Palazzo Colonna (145 m): la frase sulla Galleria (1654, 1693, 1703). La voce «Galleria Alberto Sordi» («già Galleria Colonna», un'altra galleria, in piazza Colonna) sta a circa 500 m e resta fuori.
   - Torre Capitania, Piazza Conte Ruggero → voce «Troina».
- **Wikidata**: provato a mano (ricerca per nome, `it`) su 7 tappe. Torre Capitania e Galleria Colonna hanno un elemento senza voce di Wikipedia (descrizioni «torre di Troina», «galleria d'arte a Palazzo Colonna a Roma»): rimandano alle stesse voci della strada 3. Roseto comunale → la stessa voce «Roseto di Roma». Giardino di Sant'Alessio, Monte Muganà, Piazza Conte Ruggero, Terrazza delle Quadrighe: nessun elemento. Non aggiunge fonti: non l'ho messo nel codice.
- **User-Agent vero verso Wikipedia.** Le regole di Wikimedia del 2026 (mediawiki.org/wiki/Wikimedia_APIs/Rate_limits, lette il 02/11) danno 10 richieste al minuto per IP alle richieste «non identificate» e 200 a quelle con un User-Agent conforme. Il proxy mandava solo `Api-User-Agent`; ora manda anche `User-Agent` (stesso testo, con l'URL del sito). Durante la prova il mio IP, senza User-Agent, ha ricevuto 429 dopo poche decine di richieste.
- **Versione `r7`** (`racconto.ts`): stesso prompt e stessi controlli di r5. In cache restano valide le righe r5 passate e scartate (stesse fonti) e le r3/r4 passate; ogni «senza fonti» di r5 o prima si ricerca alla prossima richiesta. Le righe r6 valgono salvo quelle con fonti `via: 'menzioni'` (vedi «Due pubblicazioni»).
- `place_racconti.fonti` porta `via` (`voce-intera`, `vicina`, `menzioni`) quando la fonte non viene dalla ricerca per nome. Nessuna colonna nuova, nessuna migrazione, nessun secret.

## Due pubblicazioni: r6, poi r7
- **r6** (`d9de53d`, `openai-proxy` **v39**, 02/11 01:21 UTC). Nella prima misura il Monte Muganà ha preso come fonte la frase della voce di Troina «Il sito su cui sorge l'odierna città di Troina fu abitato… — una fattoria del 6000 a. C. — e la necropoli ancora visitabile e sita sul monte Muganà». Il racconto passato diceva «Qui sotto i tuoi piedi c'è un sito abitato fin dai tempi più antichi… una fattoria del 6000 a. C.»: **la fattoria non è sul Muganà**, il revisore l'ha lasciato passare.
- **r7** (`bd32e7c`, `openai-proxy` **v40**, 02/11 01:32 UTC): `pezzoColNome` tiene solo il pezzo col nome («e la necropoli ancora visitabile e sita sul monte Muganà»). Il Muganà scende a 97 caratteri e resta senza racconto. Le righe r6 da menzioni (Torre Capitania, Piazza Conte Ruggero, Terrazza delle Quadrighe, Galleria Colonna, Monte Muganà) si sono riscritte alla richiesta dopo; la riga del Muganà in `place_racconti` ora è `r7 senza-fonti`. Nessuna scrittura sul database fuori dall'app.

## Tappa per tappa: prima e dopo
**Prima** = RACCONTO-R4 (fonti, 30/10) e RACCONTO-RIFINITURE (esito r5 nei 3 lanci, 31/10). **Dopo** = funzione pubblicata **v40**, account di prova, `dv.purpose = 'racconto'`, una richiesta per tappa (02/11, 01:34–01:36 UTC). «cache» = riga già in `place_racconti` (scritta da v39 o prima: per le tappe con fonti già trovate per nome, la fonte è la stessa). Grezzo: `docs/prove/dati/2026-11-02-racconti-fonti-r7.json` (e `…-r6.json` per v39); script `scripts/prova-reale/racconti-fonti.live.js`.

| Città | Tappa | Prima: fonte | Prima: racconto r5 | Dopo: fonte (strada, distanza, caratteri W+G) | Dopo: racconto |
|---|---|---|---|---|---|
| Catania | Porta Uzeda | senza fonti (W 94 car.) | — | **Porta Uzeda** (voce intera, 7 m, 606) | **passato** (v39, cache) |
| Catania | Cattedrale di Sant'Agata | Cattedrale di Sant'Agata | PPP | uguale (nome, 655) | passato (cache r4) |
| Catania | Fontana dell'Elefante | Fontana dell'Elefante | PPP | uguale (nome, 460) | passato (cache r5) |
| Catania | Teatro Antico | Teatro greco-romano di Catania | PPP | uguale (nome, 382) | passato (cache r5) |
| Catania | Castello Ursino | Castello Ursino | PPP | uguale (nome, 576) | passato (v39) |
| Catania | Fontana dell'Amenano | Fontana dell'Amenano | PPP | uguale (nome, 233) | passato, riscritto (v39) |
| Catania | Piazza Mazzini | Piazza Mazzini (Catania) | PPP | uguale (nome, 1460) | passato, riscritto (v39) |
| Catania | Palazzo dei Chierici | Palazzo del Seminario dei Chierici | PPP | uguale (nome, 380) | passato (v39) |
| Catania | Via Etnea | Via Etnea | PPP | uguale (nome, 295) | passato (v39) |
| Troina | Chiesa Madre | senza fonti (nessuna voce) | — | **Ex cattedrale di Maria Santissima Assunta (Troina)** (vicina, 12 m, 840) | **passato** (v39) |
| Troina | Torre Capitania | senza fonti | — | **Troina** (menzioni, 131 m, 991) | **passato**, riscritto (v40) |
| Troina | Piazza Conte Ruggero | senza fonti | — | **Troina** (menzioni, 223 m, 339) | **passato**, riscritto (v40) |
| Troina | Monte Muganà | senza fonti | — | Troina (menzioni, 97: sotto la soglia) | senza fonti (v40) |
| Roma | Giardino di Sant'Alessio | senza fonti | — | nessuna | senza fonti |
| Roma | Roseto comunale | senza fonti (W 119) | — | **Roseto di Roma** (voce intera, 6 m, 1375) | scartato: più di 4 frasi, anche dopo la riscrittura (v39) |
| Roma | Villa Sciarra | Villa Sciarra (Roma) | PPP | uguale (nome, 678) | passato (cache r5) |
| Roma | Orto Botanico di Roma | Orto botanico di Roma | PPP | uguale (nome, 338) | passato (cache r5) |
| Roma | Palazzo dei Conservatori | Palazzo dei Conservatori | PPP | uguale (nome, 413) | passato, riscritto (v39) |
| Roma | Palazzo Massimo alle Colonne | Palazzo Massimo alle Colonne | PPP | uguale (nome, 211) | passato (cache r5) |
| Roma | Terrazza delle Quadrighe | senza fonti (G 96) | — | **Vittoriano** (menzioni, 29 m, 310) | **passato** (v40) |
| Roma | Galleria Colonna | senza fonti (G 102) | — | **Palazzo Colonna** (menzioni, 145 m, 479) | **passato** (v40) |
| Roma | Parco del Gianicolo | Gianicolo | PSP | uguale (nome, 959) | passato (v39) |
| Roma | Piazza del Campidoglio | Piazza del Campidoglio | PPS | uguale (nome, 1084) | scartato (cache r5) |
| Roma (in più) | Galleria del Cardinale Colonna | — | — | nessuna | senza fonti |

**In tutto, sulle 23 tappe di RACCONTO-R4:** con fonti **14 prima, 21 dopo**; racconto passato nell'ultima richiesta **19** (prima, nel lancio migliore di r5, 14).

## Lettura a mano dei 7 racconti nuovi (W = fonte Wikipedia trovata, G = Google)
- **Porta Uzeda** (v39): «Questa porta si apre nelle mura cinquecentesche di Carlo V. Porta il nome del viceré spagnolo Giovanni Francesco Paceco, duca di Uceda. Da piazza del Duomo è l'uscita verso sud: da qui si passa a via Dusmet. Guarda la facciata: si rifà a quella del seminario dei chierici.» — tutte le frasi in W ✓.
- **Chiesa Madre di Troina** (v39): «…la chiesa madre di Troina, il principale luogo di culto della città. Nel 1082 fu elevata a cattedrale, e fu la prima cattedrale normanna della Sicilia. La volle Ruggero I per ringraziare l'Assunta dopo la vittoria sugli arabi… Nel 1088 qui arrivò papa Urbano II, che celebrò messa e consacrò la sede.» — ✓; «arrivò» per «ospitò» ⚠.
- **Torre Capitania** (v40, riscritto: la prima stesura metteva la torre «sulla via Conte Ruggero», il revisore l'ha fermata): «…ha un impianto del XII secolo. Nel tempo è stata torre difensiva, capitanato di giustizia, carcere e cineteatro. Oggi dentro c'è un museo civico: un Antiquarium Archeologico, un Lapidarium architettonico, una mostra del Libro Antico e una Pinacoteca d'arte Moderna.» — ✓. Il museo di Robert Capa, che sta nella stessa frase della fonte ma in un altro edificio, non compare.
- **Piazza Conte Ruggero** (v40, riscritto: tolto «per scendere» sul bus navetta): «Sei nella piazza principale di Troina. Sta nella parte più alta del centro storico. Da qui riesci a vedere l'Etna, la costa del Mar Jonio e il monte San Pantheon. Un bus navetta collega la piazza con il piazzale Sant'Agostino.» — ✓.
- **Terrazza delle Quadrighe** (v40): «Sei in cima al Vittoriano: questa è la terrazza più alta del monumento. Dal giugno 2007 ci sali con l'ascensore. Se preferisci i gradini, sono 196 e partono dal sommoportico. Da qui la vista sulla città è completa.» — W e G ✓.
- **Galleria Colonna** (v40): «Guarda, è l'ala più famosa del palazzo. Antonio Del Grande la inizia nel 1654, Girolamo Fontana la riprende nel 1693. Il connestabile Filippo II la inaugura nel 1703. Dentro c'è la collezione di famiglia, cominciata da Filippo I.» — ✓; W dice «destinata ad ospitare» la collezione, «c'è» ⚠ (G: «collezione d'arte di antichi maestri»).
- **Monte Muganà** (v39, ora tolto): ✗, vedi «Due pubblicazioni».

## Costo AI (misurato)
| | Racconti scritti | Spesa |
|---|---|---|
| Misura su v39 (r6), 24 tappe | 15 (9 in cache, 0 $) | 0,1166 $ |
| Misura su v40 (r7), 24 tappe | 4 (20 in cache o senza fonti) | 0,0376 $ |
| Collaudo del punto 5 | 0 (tutte in cache) | 0 $ |
| **Totale** | 19 | **0,1542 $** |

- Fonte: il campo `costoUsd` della risposta del proxy per ogni racconto (listino Anthropic del proxy: Sonnet 5.5 narratore, Haiku 4.5 revisore), sommato nel grezzo (`spesaUsd`). Controllo: `select versione, esito, count(*), sum(costo_usd) from public.place_racconti where versione in ('r6','r7') group by 1,2;` → r6 0,0875 $ + r7 0,0430 $; la differenza con 0,1542 $ sono le 5 righe r6 sovrascritte da r7 (0,0291 $), la cui spesa resta solo nel grezzo.
- Per racconto nuovo da fonti allargate: da 0,0053 $ (Piazza Conte Ruggero, primo colpo) a 0,0145 $ (Torre Capitania, riscritto).
- Tempo: una tappa che passa dalle tre strade e resta senza fonti risponde in 2,7–3,1 s (Giardino di Sant'Alessio, Galleria del Cardinale Colonna, Monte Muganà); una con fonti allargate e racconto in 5,2–11,1 s. Il racconto si chiede quando la tappa diventa la prossima, non all'arrivo.

## Deploy e collaudo
- **Merge su main**: `d9de53d` (r6) e `bd32e7c` (r7), fast-forward dopo `git fetch` e rebase (nessun commit nuovo su `origin/main`, nessun conflitto). PR #7. **CI verde** su tutti e due (run 41371761021, 41372768769); **Vercel** «success» su tutti e due.
- **Deploy** da questo worktree staccato su `origin/main` (HEAD = `origin/main` verificato), `supabase functions deploy openai-proxy --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api`: **v39** (`d9de53d`) poi **v40** (`bd32e7c`). Dopo ogni deploy i 7 file pubblicati sono identici a quelli del repo (lettura della funzione). Commit per un eventuale ritorno: `dcc51c0` (= v38, nessun cambio al proxy fra `482733a` e `dcc51c0`).
- **Collaudo** `COLLAUDO_ESITI=docs/prove/dati/2026-11-02-collaudo-sito-p5-fonti.json node scripts/prova-nav/collaudo-sito.webkit.mjs 5`, WebKit iPhone 14, account di prova, sito pubblicato. Al punto 5 ho aggiunto due giri (variabile `COLLAUDO_P5_FONTI=0` per toglierli): Terrazza delle Quadrighe + Galleria Colonna a Roma, Torre Capitania + Chiesa Madre a Troina.

| Tappa | Proxy | Scheda |
|---|---|---|
| Orto Botanico di Roma | 200 passato | racconto, lettore 0:21 |
| Villa Sciarra | 200 passato | racconto |
| Palazzo Massimo alle Colonne | 200 passato | racconto |
| Piazza del Campidoglio | 200 scartato | frase breve |
| Cattedrale di Sant'Agata | 200 passato | racconto |
| Fontana dell'Elefante | 200 passato | racconto |
| **Terrazza delle Quadrighe** | 200 passato | racconto |
| **Galleria Colonna** | 200 passato | racconto, lettore 0:15 |
| **Torre Capitania** | 200 passato | racconto, lettore 0:18 (`5-fonti-troina-1.png`) |
| **Chiesa Madre di Troina** | 200 passato | racconto |

Esito: **10 schede su 10 con un racconto o la frase breve**, nessun errore a schermo; le 6 schede di prima come il 31/10. Non è peggiorato: nessun ritorno alla versione precedente. Schermate in `docs/prove/schermate/collaudo-sito/5-*.png`.

## Verifiche
- Suite verde: **243 file, 3020 test**; 19 test nuovi in `src/__tests__/functions/raccontoFonti.test.js` (frasi e sezioni, voce intera, menzioni, pezzo col nome, stesso nome proprio, le tre strade con Wikipedia finta, errore che non diventa «senza fonti», User-Agent, versioni in cache), `racconto.test.js` aggiornato per r7.
- Lint 0 errori (189 avvisi già presenti). Build ok. `deno check` del proxy: il solo errore già noto a `index.ts:389`.
- `npm run banco:guardia`: **12/12**, pertinenza senza ❌ nuovi (3 già noti), prima di ciascun merge.
- `docs/corsia-e-permessi.json` vuoto: nessun file concesso.
- `.env.local` copiato da `~/unnivai-1b` senza stamparlo e `.env` con URL e chiave anon pubblici (dal progetto Supabase): tutti e due cancellati a fine task.

## Cosa NON risolve
- **Giardino di Sant'Alessio**: nessuna voce di Wikipedia lo descrive (solo un elenco della Sovrintendenza), nessun elemento Wikidata. Resta senza racconto.
- **Galleria del Cardinale Colonna** (Google, via della Pilotta 17/A, place_id `ChIJI2zkpLJhLxMRHoL_R8vaBNI`) **non è la stessa scheda** della «Galleria Colonna» (via della Pilotta 17, `ChIJoZRZT01gLxMR0C1IBGiGv1c`). Wikipedia non la nomina; la voce Palazzo Colonna parla di due gallerie fatte costruire da cardinali Colonna (la Galleria Colonna del cardinale Girolamo, 1654–1703, e la «seconda galleria» su via della Pilotta del cardinale Girolamo II, 1757–1764). Scegliere una delle due sarebbe un'ipotesi: resta senza racconto. La Galleria Colonna ha il suo.
- **Monte Muganà**: la voce di Troina gli dà una frase e mezza (la necropoli visitabile, la cinta muraria): 97 caratteri, sotto la soglia.
- **Roseto comunale**: fonte trovata (1375 caratteri), racconto scartato per più di 4 frasi anche dopo la riscrittura. Si riprova dopo 7 giorni. La soglia e i controlli non si toccano.
- **Il revisore lascia passare ancora le invenzioni di posizione**: il Monte Muganà r6 ne è la prova. Ora la fonte non la contiene più, ma il revisore è lo stesso.
- **Le menzioni da una voce non dedicata restano più fragili** di una voce sul posto: una frase che nomina la tappa può portare con sé fatti di un altro luogo (la frase sul museo di Robert Capa nella fonte di Torre Capitania). Il pezzo col nome toglie solo i pezzi staccati da trattini e punti e virgola.
- **Una riga sovrascritta tiene le colonne vecchie**: quando un «senza fonti» sovrascrive un racconto, `costo_usd`, `modello` e `verifica` restano quelli di prima (la riga del Muganà r7 ha ancora 0,00545 $). L'upsert del proxy scrive solo le colonne della riga nuova; era così anche prima. Proposta: scrivere `null` in quelle colonne nel salvataggio del «senza fonti».
- **Il revisore e i racconti scartati di prima** (Piazza del Campidoglio r5) non cambiano.
- Da provare su iPhone vero solo la voce del lettore (la regola: voce, audio, GPS e rete).
