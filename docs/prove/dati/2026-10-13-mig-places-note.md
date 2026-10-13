
## Cosa è stato fatto

**Precondizione.** Places API (New) abilitata da Ivano nel progetto 621845339483. Chiamata singola con la chiave del browser (prima: 403 `SERVICE_DISABLED`; dopo l'abilitazione: 200). La chiave del **server** si è verificata solo dopo il deploy, dal proxy pubblicato: 200 con `engine=new` → Places API (New) è tra le API consentite anche sulla chiave del server.

**Interruttore.** `PLACES_SEARCH=new|legacy` nel proxy; assente o diverso da `new` = `legacy` (produzione, **non impostato**). Il parametro `engine=new|legacy` della richiesta conta **solo** se il JWT è dell'account di prova (`ai_quota_test_account`, stessa regola di `openai-proxy`); per chiunque altro è ignorato. Lo aggiunge solo il banco (`BANCO_PLACES=new`): l'app non manda né `engine` né token. Per passare alla nuova per tutti: `supabase secrets set PLACES_SEARCH=new` (un attimo, senza deploy); per tornare: `supabase secrets unset PLACES_SEARCH`.

**Normalizzazione.** Il proxy risponde ancora nella forma legacy della textsearch (stessi campi che il motore legge) più `opening_hours.periods` (formato legacy: giorno 0 = domenica, `HHmm`), `primary_type`, `utc_offset_minutes`. Il candidato (`buildPOIFromCandidate`) porta `openingPeriods`, `primaryType`, `utcOffsetMinutes` solo se presenti. **Nessuna regola del motore usa questi campi.** Le foto della nuova (`places/…/photos/…`) sono servite dal servizio foto nuovo, stesso 302.

**Cache.** Chiave propria `v1:new1-<impronta della maschera>:…`, mai mescolata con le legacy; stessa durata (24 h) e stessa tabella `places_cache`.

## Fasce di prezzo dei campi (Text Search New, doc Google letta il 13/10/2026)

| Campo della maschera | Fascia | $/1000 |
|---|---|---|
| `places.id` | Essentials IDs Only | — |
| `places.displayName`, `formattedAddress`, `location`, `types`, `primaryType`, `businessStatus`, `photos`, `utcOffsetMinutes` | Pro | 32,00 |
| `places.rating`, `userRatingCount`, `priceLevel`, **`regularOpeningHours`** | **Enterprise** | **35,00** |
| `places.servesVegetarianFood` (**non aggiunto**) | Enterprise + Atmosphere | 40,00 |

Nessun campo sopra la fascia di `regularOpeningHours`. `servesVegetarianFood` costerebbe altri $5 ogni 1000 ricerche (≈ +$0,0175 per generazione con 3,5 ricerche). Text Search legacy: $32/1000.

## Prove del "legacy identico"

1. **Test** `src/__tests__/services/placesProxyLegacy.test.js`: carica il proxy di prima (copia in `fixtures/places-proxy.legacy.ts.txt`) e il nuovo e li confronta su ricerca, dettagli, ricerca per nome, foto, path non ammesso, seconda richiesta (HIT): con `PLACES_SEARCH` assente, `legacy` o sconosciuto sono **uguali** nelle chiamate a Google (URL, metodo, header, corpo), nelle risposte (stato, corpo, header) e nelle scritture di cache; `engine=new` da un client qualunque o con un token non di prova è ignorato. Il candidato lato client ha **le stesse chiavi di prima** con una risposta legacy (`placesCandidatoNuovo.test.js`).
2. **Dopo il deploy, su Supabase vero**, tre chiamate come le fa l'app (GET semplice, senza `engine` né token), confrontate con una risposta catturata **prima** del deploy:
   - la stessa ricerca (`trattoria Catania`) → HIT dalla cache scritta dal codice vecchio: **stessi dati** (JSON uguale, anche con le chiavi ordinate; la differenza byte per byte è solo l'ordine delle chiavi che la cache JSONB di Postgres riordina — vale anche per il codice vecchio, una HIT è sempre stata così), stessi header (`x-cache: HIT`);
   - una ricerca mai vista (`pasticceria Siracusa`) → MISS dal codice nuovo fino a Google legacy: stato `OK`, 20 risultati, **stesse chiavi top-level e dei risultati** di prima, stessi tipi, **nessun campo nuovo**, `opening_hours` = `{open_now}`, `photo_reference` legacy;
   - una foto legacy → 302 con `Location`.
3. **Con `engine=new`** (account di prova): 200, `x-engine: new`, 20 risultati su 20 con orari, tipo principale, fuso, foto, prezzo e rating; la stessa richiesta di nuovo → HIT con chiave propria; **senza token** → ignorato, risposta legacy (`primary_type` assente).

## Deploy

- **Funzione `places-proxy`** pubblicata su Supabase (progetto `ahecpiwsdhghkndncejb`) dopo l'OK di Ivano: **versione 9**, `ACTIVE`, `verify_jwt: false` (com'era), file `index.ts` + `placesNew.ts`, **`PLACES_SEARCH` non impostato = legacy**. Rollback: ripubblicare il testo della versione 8 (`src/__tests__/fixtures/places-proxy.legacy.ts.txt`).
- **App:** push su `main`, commit `a1ec601` (gate CI verde: «Lint & Test», «E2E Smoke»). Vercel: i deployment non sono visibili dal team collegato a questa sessione → **deploy dell'app da verificare da Ivano**.

## Cosa ho letto dal confronto

- **Orari.** Con la nuova, dei candidati restituiti dalle ricerche il **89,4 %** ha gli orari settimanali (1372 su 1535); il **tipo principale** c'è su 1072 posti su 1077. Nel pool che il motore mette in classifica: **93,8 %** con orario noto (716 su 763) contro il **33,3 %** di oggi (268 su 804, scaricati dopo e solo per i posti scelti); tra le **alternative**: **94,1 %** (509 su 541) contro **14,6 %** (85 su 582). I «5-6 % senza orario» sono posti per cui Google non ne ha.
- **I pool non sono gli stessi.** Per le stesse ricerche la nuova restituisce in parte altri luoghi (stessa ricerca di prova: 10 su 20 in comune; sui 27 casi con pool, Jaccard medio 0,52 e 350 luoghi in comune su 504 legacy / 494 new). I tipi sono più fini (`italian_restaurant`, `cocktail_bar`…). È la ragione per cui le tappe cambiano, oltre alla varianza del modello.
- **Risposta alla domanda lasciata aperta da ORARI-diagnosi.** Con gli orari di tutto il pool, delle 48 tappe chiuse del giro new, 16 stanno in un momento con pool: **13 hanno almeno un'alternativa aperta per tutta la sosta, 3 no** (MAMARÓ BISTROT a colazione, Maccheroni – La Carbonara N°1 al dopocena, Aria Art Gallery al mattino). Le altre 32 stanno in flussi senza pool per momento (Per Te, Veloce, Sorprendimi): lì l'alternativa va cercata nel pool del tema.
- **c5 non cambia, come deve** (il motore non usa gli orari): legacy 42 violazioni in 19 casi con 29 tappe a orario sconosciuto; new 45 violazioni in 16 casi con **13** sconosciuti.
- **Costo per generazione misurato** (token + Google contati, senza foto): legacy **$0,130**, new **$0,142** (**+$0,012, +9 %**; attesa +$0,0105). Ricerche per generazione 3,5 → 3,5; le ricerche costano $0,035 invece di $0,032; nessuna chiamata a `place/details`. **Giro legacy per gli orari: $6,91, di cui $3,00 di dettagli: con la nuova gli orari costano +$0,012 a generazione invece di ≈ $0,10.** Tempo medio +0,6 s (12,7 → 13,3 s).
- **Voci.** Nessuna peggiora oltre la varianza dichiarata **tranne «Costo»** (7 → 10 casi rossi, +3): non è qualità, è il prezzo: la soglia è $0,20 a caso con le foto stimate, +9 % spinge oltre i casi vicini al tetto (crea-troina $0,195→$0,207; crea-firenze-arte e veloce-roma-rione con 5 ricerche invece di 4, che dipende dal traduttore). **Decisione per Ivano:** alzare la soglia di costo o accettare il rosso. Le altre: Verità +1 (`sorprendimi-catania-pomeriggio`: un locale con «|» nel nome, «Deliziosa Café & Cocktail Bar | Apericena e Colazione», con una frase tolta dalla rete: candidato diverso, non un effetto degli orari), Distanze +2 (veloce-catania-relax-2330: un tratto da 66 min dopo mezzanotte; crea-firenze-arte da 6 a 21 min), Percorso invariato a 4 rossi ma su casi diversi (lecce e 2330 verdi; firenze-arte e siracusa rossi), Ripetizioni, Vincoli, Tempo, Giornata invariati.

## Cosa ho dato per vero senza verificarlo

1. **Le fasce SKU** sono quelle della doc Google come me le ha riportate la lettura automatica della pagina (e del listino): `photos` e `utcOffsetMinutes` in Pro, `rating`/`userRatingCount`/`priceLevel`/`regularOpeningHours` in Enterprise. Da ricontrollare in Cloud Console, **sulla fattura**: il costo qui è contato (5 ricerche × $0,035), non letto dalla fatturazione, e non tiene conto dei tetti gratuiti mensili dell'API nuova.
2. **Un campione per caso, un solo giro legacy:** la varianza (±2 casi rossi) è una scelta mia, non misurata; con 30 casi e un modello non deterministico, +1 o +2 sono rumore compatibile e non lo posso escludere né confermare.
3. **`regularOpeningHours.openNow`** sostituisce `open_now` della legacy: può differire nei giorni festivi (`currentOpeningHours`, anch'esso Enterprise, non è nella maschera).
4. **La foto nuova** (`…/media`) in produzione non l'ho provata dal vivo (il banco non carica le foto): il test la copre con un finto che risponde 302; con `skipHttpRedirect` di default Google dovrebbe rispondere 302, non verificato.
5. **Il test «legacy identico» gira su un'emulazione di Deno** (esbuild + stub di `serve`/`createClient`/`fetch`), non sul runtime vero; la prova sul runtime vero sono le tre chiamate dopo il deploy, che confrontano la **forma**, non ogni byte (l'ordine delle chiavi cambia fra MISS e HIT per la cache JSONB).
6. **Cache lato client** (`gg1_…`, 24 h): se si passa a `new` per tutti, un browser con la cache calda continua a servire pool senza orari fino a 24 h; non l'ho cambiata.
7. **Account di prova senza `engine`:** chi ha il token dell'account di prova e non manda `engine` segue `PLACES_SEARCH` come tutti.
8. **Il banco `new` salta l'ONB-1** (c9) e la fase dei dettagli; i risultati di c5 del giro new usano gli orari della ricerca, non quelli di `place/details`: stessi dati di Google, ma raccolti in due modi diversi.
9. **«Candidati per caso»**: i pool dei momenti sono limitati a 15 per momento e a 25 per tema nel grezzo; «Pool» è quello. I «visti dalle ricerche» (new) sono tutti i risultati restituiti, prima dei filtri del motore.
10. Il giorno simulato è il mercoledì 14/10/2026 e gli orari sono quelli settimanali di Google di oggi.
