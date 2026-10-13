
## Cosa è stato fatto

- **Dopo la colazione chiesta niente altro cibo fino al pranzo** (`momentSelection.repairPass`, `dopoColazione`). Nella mattina che parte con la colazione, dalla seconda tappa in poi un locale (caffè, bar, pasticceria, gelato) non entra: restano visite. «Aperte per tutta la sosta» lo garantisce ORARI come sempre (nessuna regola sugli orari è cambiata); nessuna ricerca in più. Nel giro dal vivo la mattina è Pasticceria Giuffrida (la colazione) → Porta Uzeda → Palazzo dei Chierici: un solo locale, poi due visite (prima: caffè, pasticceria, palazzo).
- **Rilassato, vuoto oltre 90 minuti** (`fillGaps`, `isLightStop`). Fino a 90 minuti resta CONTINUITÀ (tempo libero dichiarato, nessuna tappa in più). Oltre, **una sola** tappa leggera per momento: l'ultima tappa del momento allargato deve essere un luogo all'aperto, il verde, una chiesa o un caffè (mai un dolce, mai un bar da drink), aperta per tutta la sosta (ORARI) e dentro la deviazione C5c (`fitsOptional`: nessun ripiego di distanza, nessuna famiglia ripetuta, nessuna deviazione oltre 10 minuti). Il controllo «nessun pasto in più» di fillGaps, per la sola tappa leggera, non conta il caffè come un pasto. Se nel pool non c'è nessuna tappa leggera, resta il tempo libero dichiarato. Con ritmo Attivo o Intenso non cambia niente.
- **Bologna 15:00**: Corner AB (75') entra nel pomeriggio, il tempo libero passa da **121 a 64 minuti** (≤ 90: resta dichiarato).
- **Banco**: `BANCO_RUN=vuoti` (stesso report di C8c, «prima» = giro di C8c/C8b); c1 non conta come «dolce prima del pasto» la pasticceria che è la prima tappa quando la colazione è chiesta nel testo (la colazione è il pasto), validato.
- **Cache dei tour**: prefisso `unnivai_insiderf20_vuoti_`.
- **Non toccati**: minimi e cena tardi (C8b), la sera si cena e i dolci (C8c), durate (C8a), ORARI, C7, soglie C5c, frasi approvate, quote, prompt dei modelli, Per Te a pranzo (tre tour, nessuna ricerca in più).

## Il tempo libero della mattina di Catania 8:00: 187 → 179, non 45: la prova che non si può

Resta **179 minuti** (09:25–12:30). La diagnosi dice perché: il pool ha 13 luoghi all'aperto, 4 chiese e 6 musei aperti dalle 9:30, ma il giorno ha già **9 tappe contate** (3 + 1 + 2 + 1 + 1 + 1) e il tetto è 8: `fillGaps` fa **0 tentativi** (`continuita.tentativi: 0`, ripetuto nel nuovo giro). Per portare la mattina a 45 minuti di vuoto servirebbero almeno 4–5 visite in più (soste da 30 minuti), quindi un tetto di 12–13 tappe: non è un problema di pool. Dove il tetto non blocca, il comportamento c'è e lo prova il test: «Una mattina con colazione» di 4 ore (Mezza Giornata) ha **al massimo 45 minuti** di tempo libero.
**Proposte (non scritte, non chieste):** (a) la passeggiata non conta nelle 8 tappe, come dice C8a (oggi `momentsToExpand` la somma); (b) la colazione non conta nelle 8 (è una tappa dovuta, non un posto in più); (c) alzare il tetto per le giornate intere. Con (a)+(b) la mattina avrebbe un tentativo di riempimento, non 45 minuti di vuoto.

## Prove (rosso → verde) e suite

Suite **1865 → 1872 test verdi** (136 file; `npm run lint` 0 errori, `npm run build` ok). I test di motore nuovi (`vuotiC8d`) li ho provati sul codice di prima (`7901c98`, in un worktree): **3 su 4 dei richiesti falliscono lì per la regola** — la colazione seguita da una pasticceria (`Caffè c2: expected true to be false`), Rilassato con 150 minuti di vuoto e luoghi leggeri aperti (una tappa in più: `to have a length of 2 but got 1`), e `isLightStop`. **Quello sui 45 minuti passa anche sul codice di prima**: nel suo scenario (4 ore, niente tetto delle 8) la mattina era già piena; è una guardia, non una prova rosso→verde. Rilassato con 86 minuti resta tempo libero (passa su entrambi: è la guardia del limite dei 90). Test di prima cambiato: `continuita.test.js` (Rilassato: «al più UNA tappa leggera» invece di «nessuna tappa in più»), `cacheChiaviOrari.test.js`.

## Spesa

**$0,633 su un tetto di $1** (ci si ferma a $0,9), un solo giro dei 4 casi sul codice finale `feat(c8d)`; nessuna chiamata a `place/details`.

## Decisioni mie da confermare

1. **«Caffè» leggero = tipo caffè, oppure `cafe`/`coffee_shop` fra i tipi di Google.** Per questo Corner AB (tipo principale `restaurant`, ma `cafe` e `coffee_shop` fra i tipi) conta come caffè e Bologna funziona; un bar da drink (NOBODY, Limone) no. Se vuoi che il tipo principale decida (come C6a), Corner AB non entra e Bologna torna a 121 minuti.
2. **Una tappa leggera per momento**, non per giornata: due momenti lunghi (mattina e pomeriggio) possono averne una ciascuno.
3. **Il tetto delle 8 tappe** (vedi sopra): senza una decisione su (a)–(c) le giornate intere con colazione restano con 150–180 minuti di tempo libero.
4. Corner AB nel pomeriggio è un posto da 75 minuti (tipo `restaurant`): è la durata dei pasti, non quella di un caffè (20); il vuoto passa da 121 a 64 minuti, non a 100. Per Bologna c'è la richiesta esplicita «osterie» nel testo, che ammette i ristoranti nel pomeriggio.

## Cosa ho dato per vero senza verificarlo

1. **La diagnosi per famiglia** è ricavata da tipo e nome dalla cache (165 posti, orari settimanali di mercoledì): «palazzi e altro» comprende anche spa e centri benessere trovati dalla ricerca; l'appartenenza a «luoghi all'aperto» è per tipo (piazza, belvedere, lungomare) o nome, come `isOutdoorWalk`. «Aperti» per i posti senza orari non è dichiarato.
2. **Un campione per caso**, un solo giro: il pool di Google cambia (a Catania il giro dal vivo ha preso «Pasticceria Giuffrida» come colazione, prima era un caffè; la cena è «Verso \Catania»).
3. **«Prima» di Bologna e Catania** viene dal giro di C8c, che è del codice `2d59a77`, non da un rigiro sul codice di prima.
4. **Il tetto delle 8 come causa unica** è provato dal conteggio (9 ≥ 8) e da `tentativi: 0`; non ho tolto il tetto per vedere cosa succederebbe (sarebbe una modifica non chiesta).
5. **Le schermate non le ho viste** (riga di tempo libero, tappa leggera): provati nei dati e nei test, non su un telefono.
6. **Per Te 13:00 e Napoli 20:00** girano sul codice finale e non cambiano (tre tour; drink → cena): un campione ciascuno.
7. **Il costo** è stimato col listino del banco (token + Google, senza foto), non letto dalla fatturazione.
8. **Il deploy** su Vercel non è visibile da questa sessione: **deploy da verificare da Ivano.**
