
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
