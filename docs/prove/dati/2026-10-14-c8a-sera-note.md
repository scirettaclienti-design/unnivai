
## Cosa è stato fatto

- **Durata dell'aperitivo** (`src/lib/tourTiming.js`, `stayInMoment`). Il bar all'aperitivo dura **45 minuti, 60 con ritmo Rilassato**: la sosta la porta il momento (`sostaAperitivo`), e vale per i tipi `bar` e `caffè`. Il bar di giorno resta 20 minuti; ristorante 75, museo 60, parco 30 e tutte le altre durate C6a non cambiano. La stessa sosta guida gli orari del giro, il controllo "aperto per tutta la sosta" e il calcolo dei buchi.
- **Passeggiata fra il drink e la cena** (`daySkeleton.addEveningWalk`, `mealRules.isWalkPlace` / `isOutdoorWalk`). Dopo ogni drink c'è un momento **facoltativo** `passeggiata`: un solo luogo all'aperto (belvedere, piazza, lungomare, giardino; per il motore anche fontana, porta, ponte, scalinata), mai un bar, mai un ristorante, mai un museo o una chiesa. Negli altri percorsi entra solo se fra la fine del drink e la cena restano **più di 30 minuti**; nel Veloce sempre. Finisce 20 minuti prima della cena (non la fa slittare). Entra solo se sta bene: entro il tetto di cammino (20 min), senza ripetere una famiglia, e **entro la deviazione massima C5c (10 min)** verso la tappa dopo; i valori C5c non sono cambiati. Non conta nelle 8 tappe del giorno.
- **Se il pool non ha una passeggiata vicina**: ricerca mirata **dalla tappa prima** (il meccanismo C1b, bias 1,5 km), con un budget suo (la ricerca in più: 3 in tutto, 2 per i momenti veri come prima). Se nemmeno quella porta niente, il vuoto resta quello della regola di CONTINUITÀ (oltre 45 minuti: riga di tempo libero dichiarata).
- **Percorso Veloce dalle 18:00 in poi** (e prima dell'alba): drink + passeggiata + cena. La cena è **facoltativa e solo se aperta**: un locale aperto per tutta la sosta (75 minuti) quando ci si arriva, e con arrivo **entro le 23:00** (la fascia della cena del banco). Altrimenti il giro è drink + passeggiata (2 tappe). Il drink è un bar (di notte, vita notturna); a 18:00–20:00 usa l'aperitivo della tabella, dopo le 20:00 un aperitivo "da adesso", dopo le 22:30 il dopocena.
- **Mai uno scheletro vuoto** (`buildDaySkeleton`). Una finestra senza momenti riceve il momento sera/notte che la contiene (`daRiserva`): niente più giro "senza scheletro", niente più discontinuità dalle 21:31.
- **"Quasi tutto chiuso" solo con zero tappe aperte** (`aiRecommendationService`). Prima bastavano meno di 2 tappe aperte (e meno di quelle senza filtro) per mostrare il messaggio.
- **QuickPath passa ritmo e umore come Crea** (`buildQuickPrefs`): l'umore Relax diventa ritmo **Rilassato**, e Natura / Parchi / Mare / Montagna / Vulcano → interesse Natura, Storia → Storia, Arte → Arte, Gusto → Cibo, Fashion → Shopping (le stesse parole dei chip di Crea). Il banco usa la stessa funzione della pagina.
- **Il drink è un bar nei tour che partono di sera** (dalle 18:00): un belvedere non basta più all'aperitivo (la vista è della passeggiata) e non blocca più la ricerca dei bar. Le giornate che cominciano al mattino tengono la tabella com'era.
- **Ricerca mirata equa fra i temi** (`searchMomentCandidates`): con più temi insieme i migliori per merito erano scelti in blocco, e bar e ristoranti (molto recensiti) prendevano tutti i posti; ora ogni tema ha i suoi. Un tema solo: invariato.
- **La passeggiata e gli orari**: un luogo senza orari (piazza, fontana, belvedere) resta ammesso anche di notte (la regola "dopo le 21 vince chi ha l'orario noto" è per locali e negozi); uno con orari noti e chiuso è tolto come sempre.
- **Cache**: itinerari `unnivai_insiderf16_composizione_` → `unnivai_insiderf17_sera_` (i giri in cache hanno l'aperitivo da 20 minuti e nessuna passeggiata).
- **Non toccati**: regola ORARI (aperto per tutta la sosta), regole C7 (tema e vegetariano solo ai pasti, un pasto per fascia), soglie C5c, frasi approvate, quote, testo dei prompt del modello, minimi di tappe (C8b).
- **Banco**: `c4` estesa (di sera un drink più la cena, o più la passeggiata quando la cena non è più possibile); nuova **`c13`** (sera: drink sotto i 45 minuti, secondo bar fra drink e cena, buco oltre 30 minuti senza passeggiata né riga, Veloce serale con una tappa sola), entrambe validate (rosso sul cattivo noto, verde sul buono); casi nuovi `crea-catania-1800` e `perte-catania-1900`; `BANCO_RUN=sera`, `BANCO_DATA`.

## Controllo a 0 $ sui posti veri di Catania (replay) e rigiro dal vivo

Prima di spendere ho ricostruito il pool vero dalla cache dei posti (stessi nomi, tipi, orari di mercoledì 14/10) e ho fatto girare il **motore vero** con l'IA finta (traduttore fisso, selettore che prende il primo candidato di ogni momento) e la ricerca stretta simulata (solo i posti entro 1,5 km dal punto). Poi, autorizzato, ho **rigirato dal vivo** i tre casi che mancavano. Replay e dal-vivo coincidono nella forma:

| Caso | Replay a 0 $ | Dal vivo, codice finale |
|---|---|---|
| Veloce relax 21:25 (Rilassato) | 21:25 Bar Popolare (60') → 22:27 Fontana dell'Amenano (30'); la cena non c'è (sarebbe oltre le 23:00) | **21:25 Bar Popolare (60') → 22:27 Fontana dell'Amenano (30')** |
| Veloce relax 21:45 | Bar Popolare (60') → 22:47 Fontana dell'Amenano | Bar Popolare (60') → 22:47 Fontana dell'Amenano |
| Veloce relax 23:30 | Bar Popolare (60') → 00:32 Fontana dell'Amenano | **23:30 Bar Popolare (60') → 00:32 Fontana dell'Amenano (30')** |
| Veloce relax 18:00 (Rilassato) | Bar Popolare (60') → 19:02 Fontana → 20:00 Osteria Moderna | (non rigirato dal vivo) |
| Crea Catania 18:00 | Sotto Palazzo (45') → Piazza Bellini (30') → 20:00 Osteria Moderna | Bar Popolare (45') → Piazza Mazzini (30') → 20:00 Trattoria Sorano |
| Napoli 19:30 «aperitivo e cena» | — | **19:30 Ammor&More (45') → 20:22 Jallinus Cocktail Bistrò (75')** |

## Prove (rosso → verde) e suite

Suite **1757 → 1810 test verdi** (132 file; stesso gate della CI: `npm run lint` 0 errori, `npm run test:run`, `npm run build`). I test nuovi (`serataC8a` sulle parti pure e sul motore intero, `quickPathRitmoUmore` sulla pagina, quelli riscritti in `orariMotore`, `daySkeleton`, e i controlli del banco `c4`/`c13`) li ho provati sul codice di prima (`ce135b5`, in un worktree): **44 rossi lì, tutti verdi qui**: aperitivo da 20 minuti → 45 (e 60), un buco di 1h30 fra drink e cena → passeggiata, Veloce relax 21:45 con bar aperti nel pool → almeno 2 tappe, 23:30 → drink + passeggiata (o il messaggio solo se non c'è niente di aperto), QuickPath che passa ritmo e umore, finestra senza momenti → scheletro sera/notte.

Test di prima cambiati perché fissavano regole che questo task cambia (letti uno per uno): lo scheletro vuoto alle 22:00 (`daySkeleton`); il messaggio con meno di 2 tappe aperte e le tre prove del Veloce "senza scheletro" (`orariMotore`); il numero di tappe nel prompt (5 → 6 con la passeggiata, `narratoreDopo`); il tetto delle ricerche mirate e la lista delle ricerche (`scheletroScelta`, `composizioneC7`, `composizioneC1`: la ricerca della passeggiata non è una delle due dei momenti veri); le query di base senza la ricerca della passeggiata (`maiVuoto`); il drink di un tour serale che è solo un bar (`daySkeleton`, C7); la chiave di cache (`cacheChiaviOrari`).

## Costo

- Casi serali: **$0,164 per generazione** (token + Google, senza foto) contro $0,134 degli stessi casi prima (**+$0,029, +22%**), 4,2 ricerche di testo contro 3,3. È il prezzo di dare un giro vero dove prima c'era un messaggio falso o una tappa sola: il Veloce delle 21:45, che prima si fermava dopo ~3 ricerche, ora cerca bar (e la cena, se c'è tempo) e poi la passeggiata dalla tappa prima.
- **La voce "Costo" dell'asticella PEGGIORA oltre la varianza: +3 casi rossi** (i tre Veloce di Catania, 21:25, 21:45, 23:30; soglia 0,20 $ con le foto stimate, una per tappa). Non è un caso che si rompe: sono i tre che prima non facevano il giro (un messaggio, o una cena sola) e ora cercano bar, la cena se c'è tempo, e la passeggiata dalla tappa prima (5-6 ricerche di testo, 0,19-0,23 $). Tutte le altre voci sono invariate o migliori. Se il costo serale è troppo, le leve sono: niente ricerca della cena dopo le 21:00 (-1 ricerca), o niente ricerca della passeggiata (il giro tornerebbe a una tappa).
- Un tour serale può fare **fino a 3 ricerche mirate** (2 per i momenti veri come prima + 1 per la passeggiata); la passeggiata cerca solo se il pool non ne ha una vicina. Nei tour di una giornata intera la passeggiata si trova quasi sempre nel pool (nessuna ricerca in più).
- **Spesa del task: $2,264**: giro dei 7 casi con la versione intermedia $1,246 + rigiro dei 2 casi chiave $0,351 + `crea-catania-1800` sul codice di prima $0,158 (qui ci si era fermati a $1,755, fermo a $1,8) + rigiro di 21:25, 23:30 e Napoli col codice finale $0,509, autorizzato (+$0,6). Nessuna chiamata a `place/details`.

## Decisioni mie da confermare

1. **Il drink è un bar nei tour che partono di sera**, non nelle giornate intere (lì un belvedere all'aperitivo resta ammesso, come nella tabella approvata). Se vuoi il bar ovunque, sono quattro test C1b da riscrivere.
2. **Il Veloce serale ignora la forma dell'umore**: Relax, Natura o Storia alle 21:45 danno tutti drink + passeggiata (+ cena). L'umore conta nel ritmo (Relax → Rilassato → drink da 60') e negli interessi, non nel tipo di posto. Una spa aperta alle 18:30 non entra nel giro.
3. **Cena del Veloce serale: arrivo entro le 23:00.** È la fascia della cena del banco (c1); oltre non è cena, è un secondo giro di notte. Con ritmo Rilassato (drink da 60') dopo le 21:30 circa la cena non c'è più.
4. **"Quasi tutto chiuso" solo con zero tappe aperte**, in tutti i percorsi, non solo la sera. Con una sola tappa aperta si vede un giro da una tappa con l'avviso "un solo posto".
5. **Per Te non cambia**: sono tour tematici a orari stimati, senza momenti (a Catania alle 19:00: tre tour da tre tappe, osterie comprese). Non sono "drink + passeggiata + cena". Come per le osterie delle 10:00, è una domanda di prodotto.
6. **Il gruppo Famiglia** ha lo stesso drink serale (la regola "mai dopocena con Famiglia" riguarda il momento della tabella, non il drink del Veloce): da decidere.
7. **Ritmo Rilassato → drink da 60 minuti** (come chiesto), e quindi la passeggiata ha meno margine: con un aperitivo alle 18:00 restano comunque 60 minuti prima della cena delle 20:00.

## Rigiro col codice finale

Fermati a $1,755 (fermo a $1,8), Ivano ha autorizzato +$0,6 e ho rigirato **21:25, 23:30 e Napoli 19:30**: ora **cinque dei sette casi sono del codice finale** (`crea-catania-1800`, i tre Veloce di Catania, Napoli). Restano del primo giro `veloce-siracusa-parco` (di giorno) e `perte-catania-1900` (Per Te): il loro codice non è cambiato. Il primo giro di ognuno dei cinque resta nel grezzo (`rigiro`) e nel report.

## Cosa ho dato per vero senza verificarlo

1. **Il replay a 0 $** (IA finta, ricerca stretta simulata sulla cache) resta una prova di logica, non di Google; ma i cinque casi rigirati dal vivo gli danno ragione. **Il Veloce delle 18:00 non l'ho rigirato dal vivo**: è solo nel replay (bar + passeggiata + cena alle 20:00). Il Veloce con la cena dopo le 21:00 (ristorante aperto fino all'una) non è mai stato dal vivo: solo nei test.
2. **Il "prima" dei Veloce** (21:25, 21:45, 23:30, Siracusa) e di Napoli viene dai giri CONTINUITA' e C7 (motori `3e8b8ca` e `dbfddd0`), non da `ce135b5`: la sera del Veloce non è cambiata fra quei commit (C7 non la toccava), ma non l'ho rigirata. Solo `crea-catania-1800` è stato girato sul codice di prima (`ce135b5`, $0,158).
3. **Un campione per caso.** Il pool di Google cambia da una chiamata all'altra (nel primo giro Catania 21:45 aveva "Ristorante EtnaSicilia" alle 23:10, nel secondo no perché la cena oltre le 23:00 non c'è più).
4. **I 22 bar aperti per tutta la sosta (e i 18 delle 23:30)** sono calcolati da me sugli `opening_hours` della cache di mercoledì 14/10 con la regola del banco, non dal motore; la cache è di oggi (13/10), quindi il mercoledì è quello settimanale.
5. **"All'aperto" non è un dato di Google.** Lo deduco dal tipo (piazza, belvedere, sentiero, porto) o dal nome (fontana, porta, ponte, scalinata, piazza, villa, giardino, lungomare…): un posto con un nome diverso non entra, e una "Villa" potrebbe essere chiusa a chiave (se ha orari, la regola ORARI la toglie).
6. **I testi delle passeggiate** sono i fatti aperti di sempre (Wikipedia/Overpass: «La fontana dell'Amenano è una fontana monumentale del 1867…»), non una frase nuova: non ho scritto frasi. Le descrizioni dei drink e delle cene sono le frasi approvate di sempre.
7. **Le schermate non le ho viste.** La passeggiata ha `moment: 'aperitivo'` (e `passeggiata: true`), quindi `stopMoments` la raggruppa sotto "Aperitivo" con il drink; l'ho provato nei dati, non su un telefono. A schermo non c'è nessuna dicitura "passeggiata".
8. **`c13` (d) "mai 1 tappa"** è una regola mia, nata leggendo il report: l'ho aggiunta e validata dopo il primo giro. `c4` non l'avrebbe vista (l'avviso "un solo posto" conta come ripiego dichiarato).
9. **Il costo** è stimato col listino del banco (token + Google contati, senza foto), non letto dalla fatturazione.
10. **Il tetto dei 20 minuti di cammino e dei 10 di deviazione** per la passeggiata sono quelli già esistenti (C1 e C5c), non li ho tarati sulla sera.
11. **Per Te alle 19:00**: non l'ho confrontato con un "prima" (il codice non è cambiato per quel percorso); ha 9 tappe in 3 tour, orari stimati.
12. **Il deploy** su Vercel non è visibile da questa sessione: **deploy da verificare da Ivano.**
