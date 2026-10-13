# MIG-PLACES — confronto: ricerca vecchia (legacy) contro nuova (Places API (New))

Stessi 30 casi del banco esteso, stessa ora simulata (2026-10-14), stessa chiamata di ogni pagina. **Legacy** = grezzo del giro 1 (`2026-10-13-banco-esteso.json`, motore `f9998d4`); **new** = `2026-10-13-banco-esteso-new.json` con `engine=new` (solo l'account di prova), motore `a1ec601`. Il motore non usa ancora gli orari: le tappe possono cambiare solo perché il modello varia e perché i candidati cambiano (tipi e ordine dei risultati dell'API nuova).

## Candidati e copertura degli orari

"Pool" = candidati messi in classifica per i momenti (itinerari) o nei pool dei temi (Per Te), distinti per momento. "Alternative" = pool meno le tappe del giro finale. "Orario noto" = Google ha dato i periodi settimanali (legacy: scaricati dopo, solo per i posti scelti; new: arrivati con la ricerca).

| Caso | Pool legacy | Pool new | Orario noto legacy | Orario noto new | Alternative con orario noto legacy | Alternative con orario noto new | Candidati visti dalle ricerche (new) | di cui con orari |
|---|---|---|---|---|---|---|---|---|
| crea-catania-catanese-veg | 63 | 39 | 35/63 | 39/39 | 14/42 | 19/19 | 25 | 25 |
| crea-catania-catanese | 67 | 59 | 32/67 | 59/59 | 11/45 | 36/36 | 29 | 28 |
| crea-napoli-aperitivo-cena | 13 | 14 | 5/13 | 14/14 | 4/12 | 13/13 | 52 | 52 |
| crea-roma-neutra | 51 | 50 | 16/51 | 47/50 | 7/41 | 37/39 | 91 | 81 |
| crea-lecce | 41 | 38 | 7/41 | 36/38 | 0/34 | 29/29 | 68 | 61 |
| crea-troina | 19 | 16 | 8/19 | 15/16 | 0/10 | 7/7 | 26 | 21 |
| crea-bologna-pomeriggio | 15 | 17 | 4/15 | 17/17 | 0/11 | 13/13 | 42 | 38 |
| crea-milano-sera | 30 | 30 | 7/30 | 30/30 | 2/25 | 25/25 | 42 | 40 |
| crea-firenze-arte | 24 | 18 | 9/24 | 18/18 | 0/15 | 9/9 | 75 | 71 |
| crea-palermo-mercato-veg | 26 | 22 | 3/26 | 21/22 | 0/23 | 18/19 | 40 | 32 |
| crea-siracusa | 32 | 34 | 9/32 | 30/34 | 0/21 | 22/24 | 39 | 31 |
| veloce-catania-relax-2125 | 5 | 5 | 3/5 | 5/5 | 2/4 | 4/4 | 57 | 51 |
| veloce-catania-relax-2145 | 0 | 0 | 0/0 | 0/0 | 0/0 | 0/0 | 40 | 32 |
| veloce-catania-relax-2330 | 0 | 0 | 0/0 | 0/0 | 0/0 | 0/0 | 37 | 31 |
| veloce-firenze-cultura | 10 | 6 | 2/10 | 6/6 | 1/8 | 4/4 | 58 | 52 |
| veloce-palermo-relax | 10 | 10 | 1/10 | 10/10 | 0/9 | 9/9 | 34 | 29 |
| veloce-roma-rione | 35 | 31 | 5/35 | 26/31 | 1/31 | 23/27 | 71 | 64 |
| veloce-napoli-pizza | 30 | 30 | 9/30 | 30/30 | 5/26 | 26/26 | 60 | 60 |
| veloce-siracusa-parco | 4 | 5 | 1/4 | 5/5 | 0/3 | 4/4 | 26 | 17 |
| veloce-milano-duomo | 8 | 10 | 3/8 | 7/10 | 1/5 | 5/7 | 60 | 51 |
| sorprendimi-roma-mattina | 17 | 16 | 5/17 | 14/16 | 3/15 | 13/14 | 52 | 44 |
| sorprendimi-catania-pomeriggio | 12 | 12 | 2/12 | 10/12 | 0/10 | 7/9 | 61 | 57 |
| sorprendimi-milano-sera | 10 | 10 | 3/10 | 10/10 | 2/9 | 9/9 | 41 | 38 |
| sorprendimi-firenze-cultura | 15 | 15 | 3/15 | 14/15 | 1/13 | 12/13 | 44 | 37 |
| sorprendimi-napoli-tardi | 0 | 0 | 0/0 | 0/0 | 0/0 | 0/0 | 52 | 47 |
| perte-roma-1000 | 58 | 63 | 28/58 | 57/63 | 10/38 | 40/45 | 70 | 64 |
| perte-roma-1600 | 58 | 63 | 28/58 | 57/63 | 10/38 | 40/45 | 70 | 64 |
| perte-catania-1300 | 49 | 48 | 14/49 | 44/48 | 7/34 | 28/31 | 49 | 43 |
| perte-napoli-2000 | 47 | 47 | 15/47 | 44/47 | 2/25 | 26/26 | 54 | 47 |
| perte-firenze-1100-veg | 55 | 55 | 11/55 | 51/55 | 2/35 | 31/35 | 70 | 64 |
| **Totale** | **804** | **763** | **268/804 (33,3%)** | **716/763 (93,8%)** | **85/582 (14,6%)** | **509/541 (94,1%)** | | |

Candidati restituiti dalle ricerche (new), tutti i casi: **1372 su 1535** (89,4%) con orari settimanali. Tipo principale: 1072 su 1077 posti distinti.

## Le 12 voci dell'asticella: casi rossi, legacy contro new

Un campione per caso: il modello non è deterministico. **Varianza dichiarata: ±2 casi rossi per voce** (scelta mia, non misurata: serviva un secondo giro legacy). Una voce "peggiora oltre la varianza" se ha più di 2 casi rossi in più.

| Voce | Rossi legacy | Rossi new | Δ | Esito |
|---|---|---|---|---|
| Verità | 0 | 1 | +1 | 🟡 entro la varianza |
| Voce | 0 | 0 | 0 | 🟢 invariata o migliore |
| Distanze | 7 | 9 | +2 | 🟡 entro la varianza |
| Ripetizioni | 1 | 1 | 0 | 🟢 invariata o migliore |
| Vincoli | 0 | 0 | 0 | 🟢 invariata o migliore |
| In comune A/B | 0 | 0 | 0 | 🟢 invariata o migliore |
| Famosità | 2 | 1 | -1 | 🟢 invariata o migliore |
| Giornata | 15 | 15 | 0 | 🟢 invariata o migliore |
| Tempo | 0 | 0 | 0 | 🟢 invariata o migliore |
| Costo | 7 | 10 | +3 | 🔴 PEGGIORATA |
| Destinazione | 0 | 0 | 0 | 🟢 invariata o migliore |
| Percorso (C5c) | 4 | 4 | 0 | 🟢 invariata o migliore |
| Catene | 0 | 0 | 0 | 🟢 invariata o migliore |

## Per caso: percorso (C5c), ripetizioni, verità, tempi, costo misurato

Percorso = incroci / deviazioni oltre 5 min / deviazione massima (min) e verdetto; verità in % di tappe; tempo in secondi; costo = token + chiamate Google contate (senza foto).

| Caso | Tappe L→N | Percorso legacy | Percorso new | Ripetizioni L→N | Verità L→N | Tempo L→N (s) | Costo L | Costo N | Ricerche L→N |
|---|---|---|---|---|---|---|---|---|---|
| crea-catania-catanese-veg | 7→7 | 0/0/0,6 🟢 | 0/0/1,3 🟢 | 0→0 | 100→100 | 10,9→14,8 | $0,083 | $0,088 | 2→2 |
| crea-catania-catanese | 7→7 | 0/0/3,8 🟢 | 0/0/2,4 🟢 | 0→0 | 100→100 | 11→14 | $0,083 | $0,089 | 2→2 |
| crea-napoli-aperitivo-cena | 1→1 | 0/0/0 🟢 | 0/0/0 🟢 | 0→0 | 100→100 | 7,1→9,5 | $0,114 | $0,123 | 3→3 |
| crea-roma-neutra | 7→7 | 0/0/3 🟢 | 0/1/9,4 🟢 | 0→0 | 100→100 | 18→21 | $0,179 | $0,194 | 5→5 |
| crea-lecce | 5→5 | 0/1/12,7 🔴 | 0/0/2,3 🟢 | 0→0 | 100→100 | 16,1→18 | $0,178 | $0,193 | 5→5 |
| crea-troina | 7→7 | 0/0/4,3 🟢 | 0/0/4,3 🟢 | 0→0 | 100→100 | 14,8→16,2 | $0,146 | $0,158 | 4→4 |
| crea-bologna-pomeriggio | 2→2 | 0/0/0 🟢 | 0/0/0 🟢 | 0→0 | 100→100 | 8,8→8,1 | $0,146 | $0,158 | 4→4 |
| crea-milano-sera | 3→3 | 0/0/0,5 🟢 | 0/0/0 🟢 | 0→0 | 100→100 | 10,4→8,2 | $0,114 | $0,123 | 3→3 |
| crea-firenze-arte | 5→5 | 0/0/1,1 🟢 | 0/3/19,8 🔴 | 2→1 | 100→100 | 14,9→14,2 | $0,146 | $0,193 | 4→5 |
| crea-palermo-mercato-veg | 2→2 | 0/0/0 🟢 | 0/0/0 🟢 | 0→0 | 100→100 | 11,7→7,6 | $0,082 | $0,088 | 2→2 |
| crea-siracusa | 7→7 | 0/0/2,1 🟢 | 0/2/18,7 🔴 | 0→0 | 100→100 | 18,9→17,2 | $0,146 | $0,124 | 4→3 |
| veloce-catania-relax-2125 | 1→1 | 0/0/0 🟢 | 0/0/0 🟢 | 0→0 | 100→100 | 6,5→8,1 | $0,146 | $0,158 | 4→4 |
| veloce-catania-relax-2145 | 4→5 | 0/1/18,7 🔴 | 0/1/18,9 🔴 | 0→0 | 100→100 | 11,9→14,1 | $0,114 | $0,123 | 3→3 |
| veloce-catania-relax-2330 | 5→5 | 0/2/11,5 🔴 | 0/1/9,4 🟢 | 0→0 | 100→100 | 12,5→16,8 | $0,114 | $0,123 | 3→3 |
| veloce-firenze-cultura | 2→2 | 0/0/0 🟢 | 0/0/0 🟢 | 0→0 | 100→100 | 13,9→13,8 | $0,146 | $0,158 | 4→4 |
| veloce-palermo-relax | 1→1 | 0/0/0 🟢 | 0/0/0 🟢 | 0→0 | 100→100 | 10,7→11,1 | $0,114 | $0,123 | 3→3 |
| veloce-roma-rione | 3→3 | 0/0/0,1 🟢 | 0/0/0,1 🟢 | 0→0 | 100→100 | 13→15,6 | $0,146 | $0,193 | 4→5 |
| veloce-napoli-pizza | 2→2 | 0/0/0 🟢 | 0/0/0 🟢 | 0→0 | 100→100 | 8,2→8,7 | $0,114 | $0,123 | 3→3 |
| veloce-siracusa-parco | 1→1 | 0/0/0 🟢 | 0/0/0 🟢 | 0→0 | 100→100 | 11,1→10,6 | $0,114 | $0,123 | 3→3 |
| veloce-milano-duomo | 3→3 | 0/0/0,1 🟢 | 0/0/0,6 🟢 | 0→0 | 100→100 | 13,5→12,2 | $0,146 | $0,158 | 4→4 |
| sorprendimi-roma-mattina | 2→2 | 0/0/0 🟢 | 0/0/0 🟢 | 0→0 | 100→100 | 9,7→10,1 | $0,114 | $0,123 | 3→3 |
| sorprendimi-catania-pomeriggio | 2→2 | 0/0/0 🟢 | 0/0/0 🟢 | 0→0 | 100→50 | 12,5→13 | $0,146 | $0,158 | 4→4 |
| sorprendimi-milano-sera | 1→1 | 0/0/0 🟢 | 0/0/0 🟢 | 0→0 | 100→100 | 6,8→7,4 | $0,114 | $0,123 | 3→3 |
| sorprendimi-firenze-cultura | 2→2 | 0/0/0 🟢 | 0/0/0 🟢 | 0→0 | 100→100 | 10,9→11,7 | $0,114 | $0,123 | 3→3 |
| sorprendimi-napoli-tardi | 5→5 | 0/2/56,5 🔴 | 1/2/44,2 🔴 | 0→0 | 100→100 | 13,7→14,6 | $0,114 | $0,123 | 3→3 |
| perte-roma-1000 | 15→15 | ⚪ | ⚪ | 0→0 | 100→100 | 16,6→17,4 | $0,147 | $0,159 | 4→4 |
| perte-roma-1600 | 15→15 | ⚪ | ⚪ | 0→0 | 100→100 | 13,3→15,9 | $0,146 | $0,159 | 4→4 |
| perte-catania-1300 | 12→12 | ⚪ | ⚪ | 0→0 | 100→100 | 16,4→14,8 | $0,146 | $0,158 | 4→4 |
| perte-napoli-2000 | 15→15 | ⚪ | ⚪ | 0→0 | 100→100 | 19,1→15,6 | $0,146 | $0,158 | 4→4 |
| perte-firenze-1100-veg | 15→15 | ⚪ | ⚪ | 0→0 | 100→100 | 17,3→17,5 | $0,147 | $0,159 | 4→4 |

## Costo per generazione misurato, e tempi

| Modalità | Casi | Costo medio legacy | Costo medio new | Δ | Tempo medio legacy (s) | Tempo medio new (s) |
|---|---|---|---|---|---|---|
| Crea il tuo percorso | 11 | $0,129 | $0,139 | +$0,010 (8%) | 13 | 13,5 |
| Percorso Veloce | 9 | $0,128 | $0,142 | +$0,014 (11,1%) | 11,3 | 12,3 |
| Sorprendimi | 5 | $0,120 | $0,130 | +$0,010 (8%) | 10,7 | 11,3 |
| Per Te | 5 | $0,146 | $0,159 | +$0,012 (8,3%) | 16,5 | 16,2 |
| **Tutte** | 30 | $0,130 | $0,142 | +$0,012 (9%) | 12,7 | 13,3 |

Spesa del giro new: **$4,257** (tetto $7,000; nessuna chiamata a place/details, gli orari arrivano con la ricerca). Giro legacy: $6,907 (comprende 120 place/details per gli orari dopo la generazione, $3,000).


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

