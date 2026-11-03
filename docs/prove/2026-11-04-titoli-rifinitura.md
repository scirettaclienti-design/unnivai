# TITOLI-RIFINITURA (T16) — le parole di genere nei titoli dei giri

## Cosa cambia per Ivano

- Un titolo che nomina un tipo di posto («forni», «musei», «barocco», «dall'alto», «sapori») non viene più scartato solo perché il posto non è un ristorante o un belvedere con il nome giusto: il codice guarda il nome delle tappe, i tipi di Google e, per gli stili («barocco», «medievale», «rinascimentale», «liberty»), ciò che dicono le fonti della tappa (la descrizione).
- La parola vale solo se abbastanza tappe la giustificano (la quota è nel codice, `titoliGiro.js`): metà delle tappe per forni e stili (il genere SONO le tappe), più di un terzo per musei, chiese, giardini, fontane, piazze, belvedere, mare (una faccia del giro: con tre tappe ne servono due), un quinto per pasti, dolci e aperitivo (un giro di giornata ha due o tre soste a tavola su tredici tappe).
- Un titolo del motore generico o falso («Tour di Roma», «Tesori di Catania», «Dove si mangia a Roma», «Street food di Roma» su tre osterie) non va più per forza su «Da A a B»: se le tappe hanno un genere chiaro il titolo lo nomina. «Dove si mangia a Roma» su quattro forni diventa **«Quattro forni a Roma»**. Il genere vale se almeno il 60% delle visite (almeno due) è dello stesso tipo; altrimenti 2 o 3 generi che coprono almeno l'80% («Chiese, musei e caffè di Catania»). Il numero in lettere solo se TUTTE le visite sono di quel genere. Meno di tre visite non fanno un genere.
- «Da A a B» resta per i titoli generici o falsi quando il giro non ha un genere chiaro («Il tuo giro a Catania» con palazzi, piazze, trattorie e porte; «Catania dall'alto» senza un panorama).
- Un titolo con una parola di genere non giustificata continua a essere scartato («I forni di Roma» con un forno su quattro tappe, «Roma barocca» senza fonti che lo dicano, «Sapori di Roma» su soli parchi).

**Dove sta il controllo:** `src/lib/titoliGiro.js` (`titoloFondato`, `titoloGiro`, nuova `titoloDiGenere`), usato in `aiRecommendationService.js` per i giri di un giorno, Per Te e il giro del borgo. È solo client: **non cambia `openai-proxy`, nessun deploy di funzione**, il sito funziona con qualunque versione del proxy. Si pubblica con il merge (Vercel).

## Decisione per Ivano

Il 31/10 avevi deciso: titolo generico = «Da A a B». I 54 titoli registrati hanno 12 titoli generici («Tour di …», «Tesori di …», «Il tuo giro a …»): con quella regola «Da A a B» non può scendere sotto il 24%. Per portarlo sotto il 15% i generici con un genere chiaro prendono il titolo di genere («Tre musei a Roma» al posto di «Dall'Albero Monumentale Pioppo Nero …»). Se preferisci tornare a «Da A a B» per i generici: in `titoloGiro` basta togliere `titoloDiGenere(stops, citta) ||`.

## Prove

- Giri registrati: 136 giri, 54 titoli diversi (`docs/prove/dati/*.json`), rigiocati a 0 $ con `npm run titoli` (`scripts/titoli/elenco.mjs`).
- **«Da A a B»: prima 21/54 (39%), dopo 8/54 (14,8%).** Titoli tenuti: prima 33, dopo 27. Titoli di genere nuovi: 19.
- Test unitari: `src/__tests__/lib/titoliGiro.test.js`, 27 test (15 nuovi): casi veri (quattro forni, forni a metà delle tappe, barocco da fonti, dall'alto, tre giardini, più generi, street food) e casi falsi (un forno su quattro, pasticceria che non è forno, barocco senza fonti o per una tappa su quattro, dall'alto senza belvedere, sapori su soli parchi, «castello» che non sta in «Acicastello»). Aggiornati 3 test che fissavano «Da A a B» dove ora c'è il genere.
- Suite 270 file / 3347 test verdi; lint 0 errori; build ok.
- Banco: `npm run banco:guardia` home 12/12, pertinenza nessun ❌ nuovo (3 già noti), banco 40 10/10; `npm run banco -- --replay` 20/20 uguali al giro vero (i titoli dei 40 casi non cambiano).

### 15 titoli prima / dopo

| # | Titolo del motore | Tappe | Prima | Dopo |
|---|---|---|---|---|
| 1 | Tesori di Roma | Museo delle Mura · Musei Capitolini · Museo Nazionale Romano | Dal Museo delle Mura al Museo Nazionale Romano, Palazzo Altemps | Tre musei a Roma |
| 2 | Tour di Firenze | Giardino Martin Lutero · Orti del Parnaso · Giardini Baden Powell | Dal Giardino Martin Lutero ai Giardini Baden Powell | Tre giardini a Firenze |
| 3 | Tesori di Napoli | Gallerie d'Italia · Santa Chiara · Museo del Tesoro di San Gennaro | Dalle Gallerie d'Italia al Museo del Tesoro di San Gennaro | Musei di Napoli |
| 4 | Tour di Napoli | Osteria Gentile · Chiesa dei SS. Filippo e Giacomo · Osteria co core | Intorno alla Chiesa dei SS. Filippo e Giacomo | Trattorie di Napoli |
| 5 | Street Food di Roma | Osteria da Samu · Osteria da Fortunata · Antica Osteria di Roma | (restava, ma con tre osterie) | Tre trattorie a Roma |
| 6 | Sospiri e Scoperte di Roma | Orti Urbani · Belvedere del Salviati · Terrazza Gianicolo · Terrazza del Pincio | Dagli Orti Urbani del Parco di Monte Ciocci alla Terrazza del Pincio | Belvedere di Roma |
| 7 | Tesori di Catania | Monastero dei Benedettini · Basilica di Sant'Agata · Palazzo Platamone | Dalla Basilica Cattedrale di Sant'Agata al Palazzo Platamone | Musei, chiese e palazzi di Catania |
| 8 | Ombre e Luce di Catania | Chiesa di San Francesco Borgia · Palazzo della Cultura · Caffè Blanca | Dalla Chiesa di San Francesco Borgia al Palazzo della Cultura Catania | Chiese, musei e caffè di Catania |
| 9 | Vista mare a Napoli | Belvedere di Pizzofalcone · Lungomare Mergellina · Terrazza Panoramica | (restava) | Belvedere di Napoli |
| 10 | Giardini e Storie di Firenze | Giardino Martin Lutero · Osteria dei Medici · Osteria Campo di Marte | (restava, con un giardino su tre) | Trattorie di Firenze |
| 11 | Catania dall'alto | Piazza Università · Fontana dell'Amenano · Porta Uzeda | Da Piazza Università a Porta Uzeda | Da Piazza Università a Porta Uzeda (falso: resta) |
| 12 | Il tuo giro a Catania | 8 tappe: palazzi, piazza, trattorie, fontana, porta | Dal Palazzo dei Chierici a Porta Uzeda | uguale (nessun genere chiaro) |
| 13 | Roma dall'alto | Gianicolo Belvedere · Giardino degli Aranci · Terrazza delle Quadrighe | Roma dall'alto | Roma dall'alto (vero: resta) |
| 14 | Vista mare a Catania | Lungomare di Acicastello · porto di Catania · Piazza Università | (restava) | Vista mare a Catania (vero: resta; «vista» si verifica con il mare) |
| 15 | Dove si mangia a Roma | Antico Forno Santini · Le Levain · Forno Monteforte · Il Fornaio | Dove si mangia a Roma (poco preciso) | Quattro forni a Roma (test unitario con i quattro forni del collaudo del 31/10) |

Le righe 5, 9 e 10 non erano «Da A a B» prima: con le quote più strette (più di un terzo, nomi di osteria = trattoria) il vecchio titolo non era più giustificato.

### Controllo a mano: nessun titolo falso

Ho letto tutti i 54 titoli dopo contro le loro tappe (nomi e tipi): **0 titoli falsi**. Trovati e corretti durante il controllo, prima del merge:
- «Chiese, piazze e castelli di Catania» per «Lungomare di **Acicastello**»: il nome del genere «castello» ora vuole la parola intera.
- «Tesori di Catania → Chiese di Catania»: Google dà `place_of_worship` anche al Monastero dei Benedettini (che è un museo e un'università); per le chiese ora vale solo `church`.
- «Street food» su pasticcerie e osterie: non è cibo da strada, vale solo con friggitorie, rosticcerie, arancinerie, panini, `meal_takeaway`.
- «Giardini e Storie di Firenze» con un giardino su tre tappe: ora serve più di un terzo.
Pasticcerie e forni sono generi diversi: «Forni di Roma» su tre pasticcerie viene scartato.

Limite: le descrizioni delle tappe nei giri registrati sono quasi tutte frasi di servizio («Sono 7 minuti a piedi dalla tappa prima»): «barocco» è provato solo dai test con descrizioni vere dalle fonti, non da un giro registrato.

## Costo AI

0 $ per la misura (rigiocata dai giri registrati). Il collaudo del sito pubblicato ha generato giri veri con l'account di prova: circa 0,3 $ (stima: stesso collaudo del 31/10, Per Te senza AI e 4 giri da Claude).

## Cosa NON risolve

- «Riflessi di Catania», «Tratti di vita», «Romanticismo a Roma»: parole di atmosfera senza genere nelle tappe, il titolo del motore non è verificabile e restano «Da A a B» (o il genere, se c'è).
- Un genere nominato da tre tappe diverse («Giardini, belvedere e musei di Roma») è un elenco, non un tema: è vero, ma poco evocativo.
- Giri di più giorni: titoli invariati.
- Le quote (metà, più di un terzo, un quinto, 60%, 80%) sono scelte da misurare sui giri veri dopo il lancio.

## Passi che aspettano Ivano

- Decisione sopra: genere o «Da A a B» per i titoli generici.
- Da provare sull'iPhone: un giro generico (richiesta senza tema) e il «Per Te» dopo le 22: i titoli delle card nominano un genere vero?

## Esito dal sito pubblicato (03/11, dopo il merge `02484f6`)

- Merge della PR #34 in `02484f6`: CI di main verde (Lint & Test, E2E Smoke), Vercel pronto (stato `success`), https://unnivai.vercel.app risponde 200. `openai-proxy` non toccato: ultima versione pubblicata invariata, nessun deploy di funzione.
- `node scripts/prova-nav/collaudo-sito.webkit.mjs`: punti 1, 2, 3, 4, 6, 8, 9, 10, 11, 12, 13 ok; punto 7 da ospite non ok come già il 31/10 e il 02/11 (accessi anonimi spenti: attesa di Ivano, riga P10); punto 5 senza errori.
- **Punto 11 (Per Te a Roma all'1:00), titoli delle card prima → dopo:** «Dove si mangia a Roma» → **«Quattro forni a Roma»** (Antico Forno Santini, Antico Forno Roscioli, Il Fornaio, Forno Monteforte); «Cultura a Roma» → «Quattro musei a Roma»; «Verde a Roma» → «Giardini di Roma» (Albero Monumentale Pioppo Nero, Fontana degli Undici Zampilli, Foresta di bambù, Giardino di Sant'Alessio); «Panorami a Roma» resta.
- Punto 13, giri generati a Catania: «Chiese, palazzi e musei di Catania», «Palazzi di Catania», «Dalla Fontana dell'Elefante al Lungomare di Catania» (nessun genere chiaro).
- Titoli falsi nel collaudo: 0 (letti contro le tappe).
