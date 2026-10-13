
## Il vuoto della mattina di Catania 8:00: 179 → 118 minuti, non 45

Il tetto non blocca più (7 visite su 8) e il riempimento è partito: da 4 a 7 visite, il tempo libero della mattina passa da **179 a 118 minuti** (e quello del pomeriggio da 151 a 83). **Non arriva a 45 minuti.** Dopo le 3 aggiunte accettate, i tentativi successivi non danno una tappa valida in più: `fillGaps` le scarta con le regole di sempre (varietà, percorso, orari, nessun ripiego), che non ho toccato. Non l'ho potuto provare sul pool vero (il grezzo registra solo i 15 migliori candidati per momento); l'ho riprodotto a 0 $ con il motore sulla cache di Catania: la mattina sale a 5 visite e si ferma a un vuoto di circa 80 minuti perché i tentativi seguenti non trovano più nulla di valido. **Dove il tetto e il pool non bloccano il riempimento il 45 c'è**: la mattina con colazione di 4 ore (test) e la giornata del test «Catania 8:00» con 8 luoghi aperti nel pool hanno al massimo 45 minuti di tempo libero. Per scendere a 45 nel caso vero servirebbe allentare la varietà delle famiglie (una per giorno): non l'ho fatto, non era chiesto.

## Bologna 15:00: torna a 121 minuti

Con il tipo principale a decidere, **Corner AB** (`restaurant`) non è un caffè e non entra: il pomeriggio torna a Portici → NOBODY → **121 minuti** di tempo libero dichiarato. I luoghi all'aperto, verdi e chiese **aperti nel pool di quel giro**: nessuno oltre ai Portici (già usati). Il pool del pomeriggio aveva 3 posti (NOBODY, Corner AB, Portici) e quello dell'aperitivo 2 (Limone, Bottega Moline), perché la richiesta «portici e osterie» ha mandato la ricerca su portici e osterie e la ricerca mirata su nightlife; nessuna ricerca ha cercato chiese o giardini. Nella cache di Bologna ci sono invece (mercoledì, per tutta una sosta da 30 minuti alle 15:36–16:00): **Basilica di San Petronio** (10–18), **Basilica di San Domenico** (15:30–19:30), **Basilica di Santo Stefano** (14:30–19:30), **Santuario di Santa Maria della Vita** (10–18:30) e **Porta Galliera** (sempre aperta). Non sono entrati perché **non erano nel pool**, non perché una soglia li scartasse: nessuna soglia è stata abbassata. **Proposta (non scritta):** quando un momento resta con un vuoto oltre 90 minuti e il pool non ha nessuna tappa leggera, una ricerca mirata di chiese e giardini dal punto del vuoto (una chiamata in più, come la ricerca della passeggiata di C8a).

## Catania 9:30 neutra: nessun peggioramento

Prima (codice `fb8fba8`, giro dedicato): 8 tappe vere; dopo: 9 (+1: stesso numero ±1), nessuna classe rossa, mattina e pomeriggio con tempo libero dichiarato come prima (116 e 114 minuti; prima 110 e 147). La giornata non si gonfia: le visite sono 5 su 8.

## Una classe rossa nel giro finale: c1 sul caso colazione

`crea-catania-colazione-0800` ha **c1 = 1**: «Bar Sgroi alle 18:00: un secondo dolce nello stesso tour (dopo Pasticceria Giuffrida)». Il banco conta come dolce un bar che ha `ice_cream_shop`/pasticceria fra i tipi; Bar Sgroi è il locale dell'aperitivo. **La regola dei dolci di C8c nel motore vale solo per Per Te di giorno**: il controllo c1 la applica a ogni modalità, quindi qui segna rosso un aperitivo normale dopo una colazione in pasticceria. Il controllo non l'ho cambiato (vincolo del task); **lo propongo**: c1-dolci solo per Per Te. Con questo, c2, c3, c4, c5, c10, c11, c12, c13 sono a 0 sui 4 casi e c1 è a 0 su 3 su 4.

## Prove (rosso → verde) e suite

Suite **1872 → 1877 test verdi** (137 file; `npm run lint` 0 errori). I test nuovi (`tettoC8e`) li ho provati sul codice di prima (`fb8fba8`, in un worktree): **4 su 5 falliscono lì per la regola** — il tetto nello scheletro (`tettoVisite` assente), Rilassato con 7 visite (`momentsToExpand` ne aggiunge ancora), la giornata con colazione (la mattina ha 3 tappe, non più di 3: il tetto la blocca), e un posto con tipo principale `restaurant` come tappa leggera (`true`). Il quinto (un caffè, un luogo all'aperto e una chiesa sono leggeri; un cocktail bar e un museo no) passa anche prima: è una guardia. Test di prima cambiati perché fissavano il tetto di 8 tappe totali: `daySkeleton.test.js` (Intenso con dopocena: 9 tappe, nessun taglio), `continuita.test.js` (8 visite, non 8 tappe), `cacheChiaviOrari.test.js` (prefisso `unnivai_insiderf21_tetto_`).

## Spesa

**$0,828 su un tetto di $1** (ci si ferma a $0,9): caso neutro Catania 9:30 sul codice di prima $0,159 + giro finale dei 4 casi $0,669. I numeri finali vengono dal giro sul codice finale (`309211d` più i soli script del banco); il tentativo di girare il caso neutro in un worktree senza le variabili d'ambiente è fallito prima di chiamare qualsiasi servizio (0 $).

## Decisioni mie da confermare

1. **«Visita» = mattina e pomeriggio.** Il dopocena di Crea (vita notturna) è un drink: non conta. Se per te una tappa del dopocena è una visita, il tetto si sposta.
2. **Rilassato a 6 visite non limita niente nella pratica** (1 tappa per momento: 2 visite più il minimo e la tappa leggera); il tetto vale per le giornate lunghe o per più giorni.
3. **c1 e i dolci**: vedi sopra; senza cambiarlo il caso colazione resta rosso quando il locale dell'aperitivo è anche gelateria.
4. **Il 45 minuti a Catania 8:00 richiede di allentare la varietà** (una famiglia per giorno): non lo propongo come modifica, lo dico come causa.

## Cosa ho dato per vero senza verificarlo

1. **La causa dei 118 minuti** (tentativi seguenti senza una tappa valida) è dedotta dal conteggio (7 visite < 8, 5 tentativi, 3 accettati) e da un replay sulla cache: il grezzo non porta i candidati oltre i 15 migliori, quindi non ho visto *quali* visite sono state scartate né da quale regola.
2. **La lista dei luoghi di Bologna** viene dalla cache dei posti (orari settimanali di mercoledì), non dal pool di quel giro; «aperto» per una sosta da 30 minuti tra le 15:36 e le 16:00. «All'aperto» è per tipo o nome (Porta Galliera sì, il Monumento a Marco Minghetti non l'ho contato).
3. **Un campione per caso.** Il pool di Google cambia: a Catania 8:00 la colazione è «Pasticceria Giuffrida» come in C8d ma la cena e l'aperitivo sono altri locali.
4. **Il «prima» di Catania 9:30** è un giro sul codice di prima di oggi; quello di Bologna, della colazione e di Veloce 21:25 viene dai giri di C8d e C8c.
5. **Le schermate non le ho viste** (righe di tempo libero, giornata da 12 tappe).
6. **Il costo** è stimato col listino del banco (token + Google, senza foto), non letto dalla fatturazione.
7. **Il deploy** su Vercel non è visibile da questa sessione: **deploy da verificare da Ivano.**
