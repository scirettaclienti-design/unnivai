# ORARI-FESTIVI — chiusure speciali (festivi, ferie) nel controllo orari

Giro con gli orari del giorno: `2026-10-13-banco-esteso-festivi.json`, motore `ed25e18`, `engine=new` (solo l'account di prova), giorno simulato **2026-10-17**. Contro: `2026-10-13-banco-esteso-c6a.json` (C6a), gli stessi 10 casi senza gli orari del giorno e con un altro giorno simulato (2026-10-14). c5 è misurata con codice del banco indipendente dal motore: per una data coperta dagli orari del giorno vince l'orario del giorno (campionato ogni 5 minuti su istanti assoluti), oltre vale la settimana.

## c5 — aperto per tutta la sosta, con gli orari del giorno

**0 violazioni in 0 casi.** Lo stesso giro misurato con la sola settimana (il righello di ORARI): 0 violazioni.

| Caso | Modalità | Tappe | c5 (giorno) | c5 (solo settimana) | Tappe dall'orario del giorno | Dall'orario della settimana | Verdetto diverso dalla settimana | Sconosciuto |
|---|---|---|---|---|---|---|---|---|
| crea-roma-neutra | Crea il tuo percorso | 7 | 🟢 0 | 0 | 6 | 0 | 0 | 1 |
| crea-firenze-arte | Crea il tuo percorso | 4 | 🟢 0 | 0 | 4 | 0 | 0 | 4 |
| crea-siracusa | Crea il tuo percorso | 7 | 🟢 0 | 0 | 5 | 0 | 0 | 2 |
| veloce-firenze-cultura | Percorso Veloce | 2 | 🟢 0 | 0 | 2 | 0 | 0 | 0 |
| veloce-roma-rione | Percorso Veloce | 3 | 🟢 0 | 0 | 2 | 0 | 0 | 1 |
| veloce-napoli-pizza | Percorso Veloce | 2 | 🟢 0 | 0 | 2 | 0 | 0 | 0 |
| sorprendimi-roma-mattina | Sorprendimi | 2 | 🟢 0 | 0 | 1 | 0 | 0 | 1 |
| sorprendimi-firenze-cultura | Sorprendimi | 2 | 🟢 0 | 0 | 2 | 0 | 0 | 0 |
| perte-roma-1000 | Per Te | 15 | 🟢 0 | 0 | 13 | 0 | 0 | 2 |
| perte-firenze-1100-veg | Per Te | 15 | 🟢 0 | 0 | 15 | 0 | 0 | 0 |

| Modalità | Casi | c5 (giorno) | Tappe dall'orario del giorno |
|---|---|---|---|
| Crea il tuo percorso | 3 | 0 | 15 |
| Percorso Veloce | 3 | 0 | 6 |
| Sorprendimi | 2 | 0 | 3 |
| Per Te | 2 | 0 | 28 |

Tracciato: tappe finali **59** — dall'orario del giorno **52**, dall'orario della settimana **0**, senza fonte (orario sconosciuto) **7**.

## Quanti giorni speciali ha davvero trovato Google

Posti distinti visti dalle ricerche: **477**; con gli orari del giorno che coprono 2026-10-17: **424**; con orari del giorno **diversi** da quelli della settimana in quella data: **2** (di cui chiusi tutto il giorno solo secondo gli orari del giorno: **0**).

| Posto | Orario della settimana | Orario del giorno |
|---|---|---|
| Museo Nazionale Romano, Palazzo Massimo alle Terme | 0900-1900 | 0900-2200 |
| Osteria Il Giardino di Barbano | 1800-2330 | 1200-1500,1800-2330 |

## Le 12 voci dell'asticella: casi rossi, C6a contro ORARI-FESTIVI (indicativo: giorno simulato diverso)

Un campione per caso: la varianza dichiarata è ±2 casi per voce (scelta mia, non misurata). Una voce "peggiora oltre la varianza" se ha più di 2 casi rossi in più.

| Voce | Rossi prima | Rossi dopo | Δ | Esito |
|---|---|---|---|---|
| Verità | 0 | 0 | 0 | 🟢 invariata o migliore |
| Voce | 0 | 0 | 0 | 🟢 invariata o migliore |
| Distanze | 2 | 3 | +1 | 🟡 entro la varianza (nuovi rossi: crea-siracusa; tornati verdi: —) |
| Ripetizioni | 1 | 1 | 0 | 🟢 invariata o migliore |
| Vincoli | 0 | 0 | 0 | 🟢 invariata o migliore |
| In comune A/B | 0 | 0 | 0 | 🟢 invariata o migliore |
| Famosità | 1 | 0 | -1 | 🟢 invariata o migliore (nuovi rossi: —; tornati verdi: perte-roma-1000) |
| Giornata | 5 | 5 | 0 | 🟢 invariata o migliore |
| Tempo | 0 | 0 | 0 | 🟢 invariata o migliore |
| Costo | 5 | 5 | 0 | 🟢 invariata o migliore |
| Destinazione | 0 | 0 | 0 | 🟢 invariata o migliore |
| Percorso (C5c) | 1 | 1 | 0 | 🟢 invariata o migliore |
| Catene | 0 | 0 | 0 | 🟢 invariata o migliore |

Percorso (misura C5c) per caso, dove cambia: nessun cambio di verdetto.

## Costo per generazione misurato

| | C6a (stessi casi) | Con gli orari del giorno | Δ |
|---|---|---|---|
| Costo medio per generazione (token + Google contati, senza foto) | $0,155 | $0,155 | $-0,000 (0%) |
| Ricerche di testo per generazione | 3,9 | 3,9 | |
| Chiamate AI per generazione | 2,6 | 2,6 | |
| Tempo medio per generazione (s) | 13,6 | 15,6 | |

Spesa del giro: **$1,548** (tetto $2,000).


---

## Prezzo (verificato prima di scrivere codice)

Doc Google «Text Search (New)», letta il 13/10/2026: i campi che fanno scattare lo SKU **Text Search Enterprise** sono `places.currentOpeningHours`, `places.currentSecondaryOpeningHours`, `places.internationalPhoneNumber`, `places.nationalPhoneNumber`, `places.priceLevel`, `places.priceRange`, `places.rating`, `places.regularOpeningHours`, `places.regularSecondaryOpeningHours`, `places.transitStation`, `places.userRatingCount`, `places.websiteUri`. `currentOpeningHours` sta quindi nella **stessa fascia** (Enterprise) di `regularOpeningHours`, `rating`, `userRatingCount`, `priceLevel` che chiediamo già: la fattura per ricerca non sale. Misurato: costo medio per generazione $0,155 → $0,155, ricerche di testo 3,9 → 3,9 (stessi 10 casi del giro C6a).

## Forma dei dati (vista dal vivo, non dedotta)

Una ricerca diretta a Google (4 musei di Roma) e poi le chiamate dal proxy hanno mostrato: `currentOpeningHours.periods` porta **la data** di ogni periodo (`open.date`, `close.date`), copre **7 giorni (oggi + 6)** — il 13/10 i periodi andavano dal 13 al 19 — e un **giorno chiuso è assente**: Galleria Borghese non ha il lunedì 19, Musei Vaticani non ha la domenica 18. `specialDays` compare quando c'è un giorno con orari eccezionali (visto su 1 posto su 35). Il proxy normalizza in `current_opening_hours: { from, to, periods: [{ date, open, close, close_date? }], special_days? }` con `from` = oggi nel fuso del posto e `to` = `from` + 6; il candidato lo porta come `currentHours`.

## Regola (src/lib/openingHours.js)

Per una data coperta (`from` ≤ data ≤ `to`) e una sosta che finisce dentro la finestra vincono gli **orari del giorno**: un giorno senza periodi è chiuso, un periodo ridotto vale solo se la sosta ci sta. Altrimenti (data oltre la finestra, sosta che la scavalca, `currentHours` assente o senza periodi) vale **l'orario della settimana**, identico a ORARI. Ogni verdetto dice da dove viene (`fonte`), e va nel tracciato: `_tracciato.orarioFonte` = «orario del giorno» | «orario della settimana» (assente se l'orario è sconosciuto). Non toccati: varietà, percorso, durate (C6a), frasi approvate, quote, prompt del modello.

## Cache

Proxy: `new1` → `new2` (e l'impronta della maschera cambia da sola). Browser: pool `gg3_` → `gg4_`, itinerari `unnivai_insiderf13_tipi_` → `unnivai_insiderf14_festivi_`.

## Deploy di places-proxy (con l'OK di Ivano)

`supabase functions deploy places-proxy --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api`: versione **10 → 11**, `ACTIVE`, `verify_jwt: false` (com'era). **Rollback**: ripubblicare i file di `d38f094` (`git show d38f094:supabase/functions/places-proxy/index.ts` e `placesNew.ts`) con lo stesso comando. **Chiamata reale dalla strada normale** (GET come l'app, senza `engine` né token, ricerca mai fatta): HTTP 200, `x-engine: new`, MISS poi HIT; il campo `current_opening_hours` è presente su **34 posti su 35** in due ricerche larghe (gli stessi 34 che hanno gli orari settimanali), più 1 su 1 in una ricerca stretta. Nessun rollback.

## Cosa ho letto dal giro

- **c5 resta 0** su 10 casi, in tutte e 4 le modalità, **misurata con gli orari del giorno** (codice del banco indipendente dal motore) e anche con la sola settimana: 0 e 0. Tappe dal tracciato: 52 dall'orario del giorno, 0 dalla settimana, 7 senza fonte (orario sconosciuto). Giorno simulato: **sabato 17/10/2026**.
- **Nessuna chiusura per festivo/ferie in quella settimana**: su 424 posti con gli orari del giorno per il 17/10 solo **2** hanno un orario diverso dalla settimana, e in entrambi il giorno è *più* aperto (Palazzo Massimo fino alle 22 invece che 19; un'osteria con anche il pranzo), **0 chiusi solo dal giorno**. Quindi il banco non ha potuto mostrare un posto tolto per una chiusura speciale: la regola è provata dai test rosso→verde (e dalla mutazione: spento il ramo del giorno, 9 test su 23 diventano rossi), non da un caso reale.
- **Costo per generazione invariato** ($0,155 → $0,155, nessuna ricerca in più). Spesa: banco **$1,548** + 4 ricerche di sonda (1 diretta a Google, 3 dal proxy) ≈ $0,14, in tutto ≈ $1,69 su un tetto di $2.
- Le 12 voci: nessuna oltre la varianza (Distanze +1: crea-siracusa; Famosità −1), ma il confronto è con un altro giorno simulato (14/10 contro 17/10), quindi è indicativo.
- **Osservato, non causato da questa modifica**: in `crea-firenze-arte` la riga di *tempo libero* è la prima del giro e le 4 tappe dopo non hanno un orario di arrivo (`at` nullo), quindi il banco non può controllarle (4 «sconosciute»), anche se il motore le ha controllate (fonte: orario del giorno). Lo stesso caso, con le stesse 4 tappe, c'era già nel giro C6a. Non l'ho toccato.

## Prove (rosso → verde)

`src/__tests__/lib/orariFestivi.test.js` (23 test): un posto aperto di solito il sabato ma chiuso per un giorno speciale è chiuso quel giorno (e il sabato dopo, fuori dalla finestra, torna aperto); un orario ridotto è accettato solo se la sosta ci sta, e dice a che ora chiude; senza orari del giorno il verdetto è quello di ORARI (stesso stato e stessi motivi); chiusura dopo la mezzanotte; sosta che scavalca la finestra → settimana; il motore a momenti sostituisce il museo «in ferie»; `keepOpenStops` lo sostituisce e mette la fonte sulla tappa; il tracciato dice la fonte; il proxy normalizza (finestra, fuso, giorni speciali, nessun dato → null) e senza il campo l'oggetto è quello di prima; il candidato porta `currentHours` solo se c'è. In più 3 test del banco su c5. Suite 1654 → **1680** verdi.

## Cosa ho dato per vero senza verificarlo

1. **Un giorno della finestra senza periodi è chiuso tutto il giorno.** L'ho visto sui lunedì/domeniche di musei che chiudono, ma non ho visto una chiusura *eccezionale* (festivo, ferie) vera: nessuna cadeva in quella settimana. Se Google omettesse un giorno anche per «orario non disponibile», il posto sarebbe tolto senza motivo.
2. **La finestra è «oggi + 6» nel fuso del posto**, come dice la doc e come ho visto il 13/10; il proxy calcola `from` dalla data di quando normalizza la risposta. Una risposta in cache del proxy (24 h) porta con sé il proprio `from`/`to`, quindi resta coerente, ma un giro per una data a più di 6 giorni da oggi usa la settimana (le eccezioni oltre quella data non si vedono).
3. **Un periodo senza `close` = aperto fino a fine giornata**: nessun caso visto, scelta mia.
4. **La forma di `specialDays`** (`[{ date: {year,month,day} }]`) l'ho vista su un solo posto; serve solo per il campo informativo `speciale`, non per il verdetto.
5. **Il banco ha un solo giro per caso** e c5=0 «con gli orari del giorno» non prova che la regola tolga i chiusi veri (nessuno c'era): prova che non peggiora niente. Il confronto delle voci è con un altro giorno (14 contro 17).
6. **Il percorso legacy del proxy** è provato dall'emulazione di Deno nei test (invariato), non dal vivo: in produzione `PLACES_SEARCH=new`.
7. **Costo**: «invariato» è la fascia della doc e il conteggio delle ricerche; la fattura Google va ricontrollata in Cloud Console. Le chiavi `new1-…` restano nella tabella `places_cache` finché scadono (24 h), senza più essere lette.
8. **Il deploy dell'app su Vercel non è visibile da questa sessione** → da verificare da Ivano.

