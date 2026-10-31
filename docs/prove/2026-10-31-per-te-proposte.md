# PER-TE-PROPOSTE — Per Te mostra sempre almeno 4 proposte

Data: 31/10/2026. Ramo `notte/per-te-proposte` da `origin/main` (`a564ffe`). Fonte: `docs/prove/2026-10-28-per-te-diagnosi.md`, correzioni 3 e 4. Nessuna rete, nessun deploy, nessuna scrittura sul database.

## Cosa cambia per Ivano

- **Per Te ha sempre almeno 4 card**, se i posti ci sono. Quelle che si fanno adesso stanno in testa. Le altre sono composte per il prossimo mattino (le 10:00 di Roma) e lo dicono: badge **«Per domattina»** (all'una di notte: **«Per stamattina»**) e, sopra le card, una riga: «Adesso è aperto poco. Le altre sono per domattina.» oppure, se nessuna è per adesso, «A quest'ora è quasi tutto chiuso. Sono giri per domattina, dalle 10.»
- **Mai un posto chiuso presentato come «adesso»**: le proposte per dopo usano gli stessi controlli degli orari, misurati alle 10:00 di domattina. Di notte il tema cibo cade da solo (i ristoranti aprono a pranzo): restano insider, cultura, panorami, verde.
- **Di sera Per Te cerca anche i temi** (prima no). Sono le stesse ricerche di Places di ogni giorno (cache 24 ore), il cibo cercato all'ora di domattina. Le proposte per dopo **non chiamano nessuna AI**: niente quota, 0 $, frasi di riserva composte dal codice (le stesse delle tappe aggiunte «in codice»). Il giro della sera resta l'unica chiamata AI di notte.
- **Il DNA pesa anche su drink e passeggiata**: un locale da drink (tipo principale bar, wine bar, cocktail bar, pub, locale notturno) prende l'affinità più alta fra Serate e l'80% di Cibo; una passeggiata (parco, giardino, belvedere, spiaggia, piazza) l'80% di Natura, Cultura o Relax. Prima un bar semplice aveva affinità 0 e il wine bar vinceva per caso, perché Google gli dà anche i tipi ristorante e cibo. `wine_bar`, `cocktail_bar`, `pub` ora sono «vita notturna» nel DNA. Utente nuovo (pesi a zero) o fiducia 0: nessun cambiamento.
- Testi: `PER_TE_TESTI` in `src/lib/esitoVuoto.js` (il file dei messaggi di Per Te e degli esiti vuoti; non esiste un altro file di testi per la Home).

## Diagnosi: quale filtro scarta quante proposte

Il vecchio codice, per ora (Roma). «Prima» = main; «dopo» = questo ramo.

| Ora | Filtro che scartava | Quante | Prima | Dopo |
|---|---|---|---|---|
| 01:00 | **ramo sera** (`_homeTemi` → `_homeSera`, `isSeraStart` 18:00–05:00): i 5 temi non si cercano nemmeno (`DashboardUser`: `if (!sera)`) e il motore dei momenti dà **un** tour per costruzione | tutti i temi (4–5) | 1 | 5 (1 adesso + 4 «per stamattina») |
| 20:00 | stesso ramo sera | tutti i temi | 1 | 5 (1 + 4 «per domattina») |
| 13:00 | giorno: orari «chiuso all'arrivo», «pasto fuori fascia», tour sotto le 3 tappe aperte (`HOME_TOUR_STOPS.min`), doppioni fra tour, tema fuori pool | 0–2 tour a seconda dei pool | 2 (fixture) | 4 (2 + 2 «per domattina») |

Dove ha cambiato il DNA: il drink si sceglieva solo per voto/unicità + un accidente (+0,08 al wine bar); ora segue Serate/Cibo (test).

Prove dai dati registrati (`npm run banco:guardia`, replay a 0 $, pool veri del 15/10 alle 12:05):

| Caso | Prima | Dopo |
|---|---|---|
| Catania, Per Te 12:05 | 3 tour (il tour cibo era caduto: 2 chiusi all'arrivo, 1 «pasto fuori fascia») | 4 tour |
| Troina, Per Te 12:05 | 1 tour | 2 tour (pool sottili: 4 non raggiunte, vedi sotto) |

Dati di Catania alle 01:00 e alle 20:00 e di Roma dal vivo **non registrati**: le righe 01:00/13:00/20:00 sono simulazioni con pool finti di Roma (`src/__tests__/services/perTeProposte.test.js`: 5 temi da 5 posti, musei 09–19, parchi 06–20, ristoranti 12–15 e 19:30–23), non misure.

## Prove

- Test nuovi `src/__tests__/services/perTeProposte.test.js` (11): le tre ore a Roma danno ≥ 4 proposte (01:00 → 1+4, 20:00 → 1+4, 13:00 → 2+2), diciture `stamattina`/`domattina`, nessuna chiamata AI per le proposte per dopo, nessun posto doppio, nessun ristorante nelle proposte per dopo di notte, DNA su drink e passeggiata, utente nuovo a zero.
- Un test esistente cambiato: `perTeHome.test.js` «risposta tagliata dentro il 1° tour» — prima «nessun tour», ora «nessun tour per adesso; restano le proposte per dopo, marcate».
- Suite 238 file, 2937 test verdi. Lint 0 errori (190 avvisi di prima). Build ok. `npm run banco:guardia`: **12/12**, pertinenza nessun ❌ nuovo, nessuna uscita in rete nel replay.

## Prova dal vivo da fare dal Mac

Ora: **di notte (tra le 00:00 e le 05:00) e una seconda volta tra le 18:00 e le 23:00; poi una terza di giorno (13:00)**. Città: Roma (poi, se vuoi, Catania). Account: il tuo, con la posizione concessa.
1. Apri Per Te dalla Home con il sito dell'anteprima di questo ramo.
2. Guarda: ci sono almeno 4 card? La prima è il giro della sera e non ha il badge? Le altre hanno «Per domattina» (o «Per stamattina» di notte)?
3. Guarda la riga sopra le card: dice che adesso è aperto poco.
4. Apri una card «per domattina»: nessuna tappa deve essere un ristorante; il primo orario deve essere alle 10 del mattino.
5. Di giorno (13:00): le card per adesso hanno posti aperti; solo le mancanti hanno il badge.
6. Controlla che l'elenco non si rigeneri a ogni apertura (resta una generazione per fascia).
7. DNA: se il tuo DNA ha Cibo alto, i drink della sera devono essere enoteche/wine bar; con Natura alta le passeggiate parchi o belvedere.

## Cosa NON risolve

- «Almeno 4» vale **se i pool di Places hanno abbastanza posti aperti**: in un borgo (Troina) o con pool sottili restano meno card (nel replay: 2). Il report del motore dice perché (`_report.proposte.motivo`).
- Le proposte per dopo hanno frasi di riserva del codice (niente racconto AI): più povere di quelle di giorno con l'AI. Scelta mia per costo 0 e perché il replay della guardia resti a zero uscite; se le vuoi raccontate dall'AI è una chiamata in più (decisione tua).
- Non tocca navigazione, racconti, Crea; non cambia i giri già fatti né le Mete.
- Il banner posizione e il tasto «Fine» (correzioni 1, 2, 5 della diagnosi) restano fuori da questo task.
- Un giro della sera resta uno solo (il motore serale è drink + passeggiata + cena per costruzione): le altre sono per domattina, non altre serate.

## Punti aperti per Ivano

1. Costo: di sera Per Te fa le 4 ricerche dei temi (prima nessuna; ~0,03 $ l'una se non in cache). Accettabile?
2. Le proposte per dopo con testo di riserva o con una chiamata AI in più?
3. L'ora «per dopo» è fissa alle 10:00: va bene, o le 9:00?
