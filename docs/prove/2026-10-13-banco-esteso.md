# Banco esteso — matrice dei casi reali e controlli automatici (2026-10-13)

Motore: `2ded924`. Identità: account di prova (generazioni etichettate `test`). Avvio 2026-10-12T16:12:28.829Z, fine 2026-10-12T16:19:02.292Z. Casi: 30 (30 girati). Generato da `npm run banco:esteso`; soglie, fasce, pesi e tetti in `scripts/banco/banco.config.json` (sezione `esteso`).

Ora simulata: ogni caso gira come se la richiesta fosse fatta il **2026-10-14 (mercoledì)** all'ora indicata, ora di Roma (`opts.simulatedNow`, ignorato in produzione).

## Modalità coperte

| Modalità | Pagina replicata | Chiamata | Casi girati | Esito |
|---|---|---|---|---|
| Crea il tuo percorso | AiItinerary.jsx | `pathType: 'custom'`, prefs del wizard (budget, durata, interessi, gruppo, ritmo), testo libero | 11 | coperta |
| Percorso Veloce | QuickPath.jsx | `pathType: 'quick'`, testo da `buildPromptFromSelections`, durata e interessi del wizard, **nessun ritmo** (come l'app) | 9 | coperta |
| Sorprendimi | SurpriseTour.jsx | nessun `pathType`, 'Mezza Giornata', prompt della pagina, `cityCenter = {latitude, longitude}` | 5 | coperta |
| Per Te | DashboardUser.jsx | `discoverAllThemes` + `buildInsiderPool` + `generateHomeTours`, prefs `1 Giorno / solo / rilassato` | 5 | coperta |

## Matrice dei casi

| Caso | Modalità | Luogo | Ora | Richiesta / scelta | Vincolo |
|---|---|---|---|---|---|
| crea-catania-catanese-veg | Crea il tuo percorso | Catania | 09:30 | Vorrei vivere un giorno da catanese, nei ristoranti tipici | vegetariano |
| crea-catania-catanese | Crea il tuo percorso | Catania | 09:30 | Vorrei vivere un giorno da catanese, nei ristoranti tipici | — |
| crea-napoli-aperitivo-cena | Crea il tuo percorso | Napoli | 19:30 | aperitivo e cena | — |
| crea-roma-neutra | Crea il tuo percorso | Roma | 09:30 | Una giornata a Roma | — |
| crea-lecce | Crea il tuo percorso | Lecce | 09:30 | Una giornata a Lecce | — |
| crea-troina | Crea il tuo percorso | Troina | 09:30 | Una giornata a Troina | — |
| crea-bologna-pomeriggio | Crea il tuo percorso | Bologna | 15:00 | Un pomeriggio a Bologna tra portici e osterie | — |
| crea-milano-sera | Crea il tuo percorso | Milano | 20:30 | Una cena e due passi a Milano | — |
| crea-firenze-arte | Crea il tuo percorso | Firenze | 09:30 | Una giornata d'arte a Firenze | — |
| crea-palermo-mercato-veg | Crea il tuo percorso | Palermo | 12:00 | Pranzo e giro al mercato a Palermo | vegetariano |
| crea-siracusa | Crea il tuo percorso | Siracusa | 09:30 | Una giornata a Siracusa, a Ortigia | — |
| veloce-catania-relax-2125 | Percorso Veloce | Catania | 21:25 | Veloce: Relax › Benessere, Veloce | — |
| veloce-catania-relax-2145 | Percorso Veloce | Catania | 21:45 | Veloce: Relax › Benessere, Veloce | — |
| veloce-catania-relax-2330 | Percorso Veloce | Catania | 23:30 | Veloce: Relax › Benessere, Veloce | — |
| veloce-firenze-cultura | Percorso Veloce | Firenze | 10:30 | Veloce: Storia › Cultura e Musei, Medio | — |
| veloce-palermo-relax | Percorso Veloce | Palermo | 14:30 | Veloce: Relax › Benessere, Veloce | — |
| veloce-roma-rione | Percorso Veloce | Roma | 17:00 | Veloce: Città › Rioni Storici, Medio | — |
| veloce-napoli-pizza | Percorso Veloce | Napoli | 19:00 | Veloce: Gusto › Vera Pizza, Veloce | — |
| veloce-siracusa-parco | Percorso Veloce | Siracusa | 08:15 | Veloce: Natura › Parchi e Verde, Medio | — |
| veloce-milano-duomo | Percorso Veloce | Milano | 12:45 | Veloce: Città › Zona Duomo, Lungo | — |
| sorprendimi-roma-mattina | Sorprendimi | Roma | 10:30 | Sorprendimi | — |
| sorprendimi-catania-pomeriggio | Sorprendimi | Catania | 15:30 | Sorprendimi | — |
| sorprendimi-milano-sera | Sorprendimi | Milano | 20:30 | Sorprendimi | — |
| sorprendimi-firenze-cultura | Sorprendimi | Firenze | 11:00 | Sorprendimi (tema Cultura) | — |
| sorprendimi-napoli-tardi | Sorprendimi | Napoli | 22:30 | Sorprendimi | — |
| perte-roma-1000 | Per Te | Roma | 10:00 | Per Te | — |
| perte-roma-1600 | Per Te | Roma | 16:00 | Per Te | — |
| perte-catania-1300 | Per Te | Catania | 13:00 | Per Te | — |
| perte-napoli-2000 | Per Te | Napoli | 20:00 | Per Te | — |
| perte-firenze-1100-veg | Per Te | Firenze | 11:00 | Per Te | vegetariano |

Ore per modalità: Crea il tuo percorso 09:30, 12:00, 15:00, 19:30, 20:30 · Percorso Veloce 08:15, 10:30, 12:45, 14:30, 17:00, 19:00, 21:25, 21:45, 23:30 · Sorprendimi 10:30, 11:00, 15:30, 20:30, 22:30 · Per Te 10:00, 11:00, 13:00, 16:00, 20:00.

## Caso × classe di errore

Cella = numero di violazioni (🔴), 🟢 = nessuna, ⚪ = non si applica; in c3/c5 «+n?» = posti con orario sconosciuto (contati a parte, non sono errori).

| Caso | Tappe | c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8 | c10 |
|---|---|---|---|---|---|---|---|---|---|---|
| crea-catania-catanese-veg | 7 | 🔴 10 | 🔴 4 | 🔴 4 | 🟢 | 🔴 3 | 🟢 | 🔴 4 | 🔴 1 | 🟢 |
| crea-catania-catanese | 7 | 🔴 10 | 🔴 4 | 🔴 3 +1? | 🟢 | 🔴 3 +1? | 🟢 | 🔴 1 | 🔴 1 | ⚪ |
| crea-napoli-aperitivo-cena | 1 | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 1 | 🟢 | 🟢 | 🔴 1 | ⚪ |
| crea-roma-neutra | 7 | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 1 +1? | 🟢 | 🔴 2 | 🔴 1 | ⚪ |
| crea-lecce | 5 | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 2 | 🟢 | 🟢 | 🔴 1 | ⚪ |
| crea-troina | 7 | 🔴 1 | 🔴 1 | 🟢 | 🟢 | 🟢 +1? | 🟢 | 🔴 1 | 🔴 1 | ⚪ |
| crea-bologna-pomeriggio | 2 | 🔴 2 | 🟢 | 🟢 | 🟢 | 🔴 2 | 🟢 | 🟢 | 🔴 1 | ⚪ |
| crea-milano-sera | 3 | 🔴 3 | 🟢 | 🟢 | 🟢 | 🔴 2 | 🟢 | 🟢 | 🔴 1 | ⚪ |
| crea-firenze-arte | 5 | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 2 | 🟢 | 🟢 | 🔴 1 | ⚪ |
| crea-palermo-mercato-veg | 2 | 🟢 | 🟢 | 🟢 | 🔴 1 | 🔴 1 | 🟢 | 🟢 | 🔴 1 | 🟢 |
| crea-siracusa | 7 | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 2 +1? | 🟢 | 🔴 3 | 🔴 1 | ⚪ |
| veloce-catania-relax-2125 | 1 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 1 | ⚪ |
| veloce-catania-relax-2145 | 4 | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 3 | 🟢 | 🟢 | 🔴 1 | ⚪ |
| veloce-catania-relax-2330 | 5 | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 4 | 🟢 | 🔴 1 | 🔴 1 | ⚪ |
| veloce-firenze-cultura | 2 | 🟢 | 🟢 | 🟢 | 🔴 1 | 🟢 +1? | 🟢 | 🟢 | 🔴 1 | ⚪ |
| veloce-palermo-relax | 1 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 1 | ⚪ |
| veloce-roma-rione | 3 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 1 | ⚪ |
| veloce-napoli-pizza | 2 | 🔴 2 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 1 | ⚪ |
| veloce-siracusa-parco | 1 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 1 | ⚪ |
| veloce-milano-duomo | 3 | 🟢 | 🟢 | 🟢 | 🔴 1 | 🟢 +1? | 🟢 | 🟢 | 🔴 1 | ⚪ |
| sorprendimi-roma-mattina | 2 | 🟢 | 🟢 | 🟢 | 🔴 1 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ |
| sorprendimi-catania-pomeriggio | 2 | 🟢 | 🟢 | 🟢 | 🔴 1 | 🔴 1 | 🟢 | 🟢 | 🟢 | ⚪ |
| sorprendimi-milano-sera | 1 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ |
| sorprendimi-firenze-cultura | 2 | 🟢 | 🟢 | 🟢 | 🔴 1 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ |
| sorprendimi-napoli-tardi | 5 | 🔴 1 | 🟢 | 🟢 | 🟢 | 🔴 3 | 🟢 | 🟢 | 🟢 | ⚪ |
| perte-roma-1000 | 15 | 🔴 4 | 🟢 | 🟢 | ⚪ | 🔴 1 +1? | 🟢 | 🔴 2 | 🟢 | ⚪ |
| perte-roma-1600 | 15 | 🔴 5 | 🟢 | 🟢 | ⚪ | 🔴 2 +2? | 🟢 | 🔴 3 | 🟢 | ⚪ |
| perte-catania-1300 | 12 | 🔴 4 | 🟢 | 🟢 | ⚪ | 🔴 3 +6? | 🟢 | 🔴 2 | 🟢 | ⚪ |
| perte-napoli-2000 | 15 | 🔴 3 | 🟢 | 🟢 | ⚪ | 🔴 4 +6? | 🟢 | 🔴 4 | 🟢 | ⚪ |
| perte-firenze-1100-veg | 15 | 🔴 3 | 🟢 | 🟢 | ⚪ | 🔴 2 +8? | 🟢 | 🔴 5 | 🟢 | 🟢 |

## Totali per classe

| Classe | Definizione (sintesi) | Casi applicabili | Casi con errore | Violazioni | Sconosciuti |
|---|---|---|---|---|---|
| c1 — Pasti fuori fascia | Una tappa-pasto (ristorante, trattoria, pizzeria…: `pasto`, non bar/caffè) con orario di arrivo fuori dalle fasce del pasto (pranzo e cena, da banco.config.json) oppure due pasti seduti a meno di `pastiDistanzaMinOre` ore uno dall'altro nello stesso giro (il "secondo pranzo").… | 30 | 🔴 12 | 48 | — |
| c2 — Ristoranti a mattina/pomeriggio senza richiesta | Una tappa-pasto nel momento mattina o pomeriggio, salvo che il testo della richiesta chieda quel momento: colazione/brunch per la mattina, merenda per il pomeriggio, o il nome del momento insieme a una parola di cibo… | 30 | 🔴 3 | 9 | — |
| c3 — Colazione in un posto non da colazione o chiuso | Una tappa-locale (dove si mangia o beve) nel momento mattina che non è un posto da colazione (un ristorante/trattoria/pizzeria senza tipo cafe/bakery né nome da bar/caffè/pasticceria; o un wine bar/cocktail bar/enoteca) oppure che, secondo gli orari, è chiuso all'ora di arrivo.… | 30 | 🔴 2 | 7 | 1 |
| c4 — Meno di 4 tappe senza ripiego dichiarato | Un giro (itinerario) con meno di `tappeMin` tappe vere e nessun ripiego dichiarato (tempo libero, tappa di ripiego, "un solo posto", query di base)… | 25 | 🔴 6 | 6 | — |
| c5 — Posto chiuso all'ora della tappa | Una tappa il cui posto, secondo gli opening_hours.periods di Google, è chiuso all'ora di arrivo… | 30 | 🔴 19 | 42 | 29 |
| c6 — Durate uguali per tipi diversi | Una tappa la cui sosta è uguale alla sosta tipica di un tipo molto diverso dal suo (almeno `sostaScala` volte più lunga o più corta): es… | 30 | 🟢 0 | 0 | — |
| c7 — Grammatica e ripetizioni nelle frasi | Nelle frasi a schermo: numero e unità che non concordano ("1 minuti", "2 minuto", "alle 1"), parola funzionale doppia ("di di"), segnaposto o vuoti (null, {x}), oppure la stessa frase (nome e numeri mascherati) almeno `frasiUgualiMin` volte nella stessa giornata.… | 30 | 🔴 11 | 28 | — |
| c8 — Inglese a schermo e meteo di adesso su un tour futuro | Inglese a schermo: la condizione meteo che non è una voce italiana (sunny, rainy, cloudy…), o due parole funzionali inglesi nelle frasi/nei titoli… | 30 | 🔴 20 | 20 | — |
| c9 — Onboarding o interessi persi dopo logout | Lo script ONB-1 (login → logout → login su browser vuoto → modifica interessi → logout/login): ogni passo deve essere OK, e i passi devono essere tutti.… | 1 | 🟢 0 | 0 | — |
| c10 — Vincolo vegetariano violato o esteso ai non pasti | Con una dieta vegetariana: (a) un pasto che non viene da una ricerca col criterio della dieta; (b) un NON pasto (museo, chiesa, parco…) trovato solo da ricerche col criterio della dieta (il vincolo esteso a ciò che non è cibo).… | 3 | 🟢 0 | 0 | — |

c9 è del giro (ONB-1), non di un caso: 🟢 13 passi su 13 OK.

**Orari (c3/c5).** 141 posti distinti: orari chiesti per 120, 21 non richiesti per il tetto di spesa, 8 senza orari su Google. Tappe con orario sconosciuto: **29** (contate a parte, non sono violazioni). Il pool porta solo `open_now` (textsearch), non i periodi: gli orari sono presi con place/details dopo la generazione.

### Per modalità

| Modalità | Casi | Casi con ≥1 errore | Violazioni | c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8 | c10 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Crea il tuo percorso | 11 | 11 | 84 | 26 | 9 | 7 | 1 | 19 | 0 | 11 | 11 | 0 |
| Percorso Veloce | 9 | 9 | 21 | 2 | 0 | 0 | 2 | 7 | 0 | 1 | 9 | 0 |
| Sorprendimi | 5 | 4 | 8 | 1 | 0 | 0 | 3 | 4 | 0 | 0 | 0 | 0 |
| Per Te | 5 | 5 | 47 | 19 | 0 | 0 | 0 | 12 | 0 | 16 | 0 | 0 |

## Le 12 voci dell'asticella (stesse misure del banco nazionale)

| Caso | Verità | Voce | Distanze | Ripetizioni | Vincoli | In comune A/B | Famosità | Giornata | Tempo | Costo | Destinazione | Percorso | Catene |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| crea-catania-catanese-veg | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| crea-catania-catanese | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | ⚪ | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| crea-napoli-aperitivo-cena | 🟢 | 🟢 | ⚪ | 🟢 | ⚪ | ⚪ | 🟢 | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| crea-roma-neutra | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | ⚪ | 🟢 | 🟢 | 🟢 | 🔴 | ⚪ | 🟢 | 🟢 |
| crea-lecce | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | ⚪ | ⚪ | 🟢 | 🟢 | 🔴 | ⚪ | 🔴 | 🟢 |
| crea-troina | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | ⚪ | ⚪ | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| crea-bologna-pomeriggio | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | ⚪ | ⚪ | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| crea-milano-sera | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | ⚪ | 🟢 | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| crea-firenze-arte | 🟢 | 🟢 | 🟢 | 🔴 | ⚪ | ⚪ | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| crea-palermo-mercato-veg | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| crea-siracusa | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | ⚪ | ⚪ | 🟢 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| veloce-catania-relax-2125 | 🟢 | 🟢 | ⚪ | 🟢 | ⚪ | ⚪ | 🟢 | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| veloce-catania-relax-2145 | 🟢 | 🟢 | 🔴 | 🟢 | ⚪ | ⚪ | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🔴 | 🟢 |
| veloce-catania-relax-2330 | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | ⚪ | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🔴 | 🟢 |
| veloce-firenze-cultura | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | ⚪ | 🟢 | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| veloce-palermo-relax | 🟢 | 🟢 | ⚪ | 🟢 | ⚪ | ⚪ | 🟢 | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| veloce-roma-rione | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | ⚪ | 🟢 | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| veloce-napoli-pizza | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | ⚪ | 🟢 | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| veloce-siracusa-parco | 🟢 | 🟢 | ⚪ | 🟢 | ⚪ | ⚪ | ⚪ | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| veloce-milano-duomo | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | ⚪ | 🟢 | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| sorprendimi-roma-mattina | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | ⚪ | 🟢 | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| sorprendimi-catania-pomeriggio | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | ⚪ | 🟢 | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| sorprendimi-milano-sera | 🟢 | 🟢 | ⚪ | 🟢 | ⚪ | ⚪ | 🟢 | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| sorprendimi-firenze-cultura | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | ⚪ | 🟢 | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | 🟢 |
| sorprendimi-napoli-tardi | 🟢 | 🟢 | 🔴 | 🟢 | ⚪ | ⚪ | 🟢 | 🟢 | 🟢 | 🟢 | ⚪ | 🔴 | 🟢 |
| perte-roma-1000 | 🟢 | 🟢 | 🔴 | 🟢 | ⚪ | ⚪ | 🔴 | ⚪ | 🟢 | 🔴 | ⚪ | ⚪ | ⚪ |
| perte-roma-1600 | 🟢 | 🟢 | 🔴 | 🟢 | ⚪ | ⚪ | 🟢 | ⚪ | 🟢 | 🔴 | ⚪ | ⚪ | ⚪ |
| perte-catania-1300 | 🟢 | 🟢 | 🔴 | 🟢 | ⚪ | ⚪ | 🟢 | ⚪ | 🟢 | 🔴 | ⚪ | ⚪ | ⚪ |
| perte-napoli-2000 | 🟢 | 🟢 | 🔴 | 🟢 | ⚪ | ⚪ | 🔴 | ⚪ | 🟢 | 🔴 | ⚪ | ⚪ | ⚪ |
| perte-firenze-1100-veg | 🟢 | 🟢 | 🔴 | 🟢 | 🟢 | ⚪ | 🟢 | ⚪ | 🟢 | 🔴 | ⚪ | ⚪ | ⚪ |

| Voce | Casi verdi | Casi rossi |
|---|---|---|
| Verità | 30 | 0 |
| Voce | 30 | 0 |
| Distanze | 18 | 7: veloce-catania-relax-2145, sorprendimi-napoli-tardi, perte-roma-1000, perte-roma-1600, perte-catania-1300, perte-napoli-2000, perte-firenze-1100-veg |
| Ripetizioni | 29 | 1: crea-firenze-arte |
| Vincoli | 3 | 0 |
| In comune A/B | 0 | 0 |
| Famosità | 23 | 2: perte-roma-1000, perte-napoli-2000 |
| Giornata | 10 | 15: crea-napoli-aperitivo-cena, crea-bologna-pomeriggio, crea-milano-sera, crea-palermo-mercato-veg, veloce-catania-relax-2125, veloce-firenze-cultura, veloce-palermo-relax, veloce-roma-rione, veloce-napoli-pizza, veloce-siracusa-parco, veloce-milano-duomo, sorprendimi-roma-mattina, sorprendimi-catania-pomeriggio, sorprendimi-milano-sera, sorprendimi-firenze-cultura |
| Tempo | 30 | 0 |
| Costo | 23 | 7: crea-roma-neutra, crea-lecce, perte-roma-1000, perte-roma-1600, perte-catania-1300, perte-napoli-2000, perte-firenze-1100-veg |
| Destinazione | 0 | 0 |
| Percorso | 21 | 4: crea-lecce, veloce-catania-relax-2145, veloce-catania-relax-2330, sorprendimi-napoli-tardi |
| Catene (estensione) | 25 | 0 |

⚪ = la voce non si applica (vincoli solo con una dieta, famosità solo nelle città grandi, giornata solo per gli itinerari, In comune A/B solo nel banco nazionale). «Tempo» e «Costo» usano le soglie del banco nazionale (35 s, $0,20 per caso).

## I 10 errori più gravi

Ordine: peso della classe (`esteso.gravita`), poi caso. Il testo è quello che l'utente vede (frase della tappa, orario, meteo).

1. **crea-bologna-pomeriggio** (Crea il tuo percorso, Bologna 15:00) — **c5**, Posto chiuso all'ora della tappa: Darcy Osteria Contemporanea alle 15:00: chiuso (mer chiuso)
   - A schermo: «Darcy Osteria Contemporanea» (pomeriggio, 15:00): «Darcy Osteria Contemporanea è la prossima tappa del tuo giro. Si comincia da qui.»
2. **crea-bologna-pomeriggio** (Crea il tuo percorso, Bologna 15:00) — **c5**, Posto chiuso all'ora della tappa: La Rustica Pizzeria Osteria alle 18:00: chiuso (mer 12:00–14:30, 19:00–22:00)
   - A schermo: «La Rustica Pizzeria Osteria» (aperitivo, 18:00): «Alle 18 sei a La Rustica Pizzeria Osteria: è qui che ti porta la giornata. Il sole tramonta alle 18:33: sei qui 33 minuti prima.»
3. **crea-catania-catanese** (Crea il tuo percorso, Catania 09:30) — **c3**, Colazione in un posto non da colazione o chiuso: Trattoria L’imperiale alle 09:30: non è un posto da colazione
   - A schermo: «Trattoria L’imperiale» (mattina, 09:30): «Trattoria L’imperiale è la prossima tappa del tuo giro. Si comincia da qui.»
4. **crea-catania-catanese** (Crea il tuo percorso, Catania 09:30) — **c3**, Colazione in un posto non da colazione o chiuso: Antica Putia Odeon alle 10:52: non è un posto da colazione
   - A schermo: «Antica Putia Odeon» (mattina, 10:52): «Si parte da Antica Putia Odeon: un caffè e si comincia. Ci arrivi alle 10:52.»
5. **crea-catania-catanese** (Crea il tuo percorso, Catania 09:30) — **c5**, Posto chiuso all'ora della tappa: Trattoria L’imperiale alle 09:30: chiuso (mer 17:30–00:00)
   - A schermo: «Trattoria L’imperiale» (mattina, 09:30): «Trattoria L’imperiale è la prossima tappa del tuo giro. Si comincia da qui.»
6. **crea-catania-catanese** (Crea il tuo percorso, Catania 09:30) — **c5**, Posto chiuso all'ora della tappa: Trattoria da Mario alle 12:30: chiuso (mer 19:00–00:00)
   - A schermo: «Trattoria da Mario» (pranzo, 12:30): «Pranzi da Trattoria da Mario, trattoria in fascia €€. Ci arrivi alle 12:30.»
7. **crea-catania-catanese** (Crea il tuo percorso, Catania 09:30) — **c5**, Posto chiuso all'ora della tappa: Trattoria U Fucularu alle 15:47: chiuso (mer 18:00–23:30)
   - A schermo: «Trattoria U Fucularu» (pomeriggio, 15:47): «Alle 15:47 sei a Trattoria U Fucularu: è qui che ti porta la giornata. Sono 2 minuti a piedi dalla tappa prima.»
8. **crea-catania-catanese-veg** (Crea il tuo percorso, Catania 09:30) — **c3**, Colazione in un posto non da colazione o chiuso: PLANTE Lab alle 09:30: non è un posto da colazione
   - A schermo: «PLANTE Lab» (mattina, 09:30): «PLANTE Lab è la prossima tappa del tuo giro. Si comincia da qui.»
9. **crea-catania-catanese-veg** (Crea il tuo percorso, Catania 09:30) — **c3**, Colazione in un posto non da colazione o chiuso: MAMARÓ BISTROT alle 10:47: non è un posto da colazione
   - A schermo: «MAMARÓ BISTROT» (mattina, 10:47): «MAMARÓ BISTROT è la prossima tappa del tuo giro. Sono 2 minuti a piedi dalla tappa prima.»
10. **crea-catania-catanese-veg** (Crea il tuo percorso, Catania 09:30) — **c5**, Posto chiuso all'ora della tappa: PLANTE Lab alle 09:30: chiuso (mer 12:00–23:30)
   - A schermo: «PLANTE Lab» (mattina, 09:30): «PLANTE Lab è la prossima tappa del tuo giro. Si comincia da qui.»

## Validazione dei controlli

Ogni controllo deve dare ROSSO su un esempio cattivo noto e VERDE su uno buono, prima del giro (`scripts/banco/validazione.js`, provata in `src/__tests__/scripts/bancoEsteso.test.js`).

| Classe | Esempio cattivo (origine) | Rosso? | Cosa ha visto | Esempio buono | Verde? |
|---|---|---|---|---|---|
| c1 | pranzo doppio: trattoria 12:30 e un'altra alle 14:30; pizzeria alle 16:10 (telefono 12/10 (la trattoria alle 14:30 dopo il pranzo) + costruito (16:10)) | 🔴 sì | Pizzeria Etna alle 16:10: un pasto fuori dalle fasce (pranzo 12:00–14:45, cena 19:30–23:00) ; Trattoria del Duomo alle 14:30: secondo pasto seduto a 120 min da Trattoria Sorano (alle 12:30) ; Pizzeria Etna alle 16:10: secondo pasto seduto a 100 min da Trattoria del Duomo (alle 14:30) | pranzo 13:00 e cena 20:30 | 🟢 sì |
| c2 | trattoria alle 14:30 (pomeriggio) con richiesta "ristoranti tipici" e un ristorante alle 9:30 (telefono 12/10) | 🔴 sì | Trattoria del Duomo (pomeriggio, alle 14:30): un posto dove mangiare in un momento che la richiesta non chiede ; Trattoria Sorano (mattina, alle 09:30): un posto dove mangiare in un momento che la richiesta non chiede | ristorante a pranzo; la merenda richiesta nel pomeriggio | 🟢 sì |
| c3 | colazione alla Casbah del Moro alle 9:30 (bar/ristorante, apre alle 18:00) (telefono 12/10 (D-CATANIA B6)) | 🔴 sì | Casbah del Moro alle 09:30: non è un posto da colazione ; Casbah del Moro alle 09:30: chiuso (mer 18:00–00:00) | colazione in un bar-pasticceria aperto | 🟢 sì |
| c4 | Veloce con 1 tappa (una gastronomia alle 21:25), nessun ripiego (telefono 12/10 (D-CATANIA A)) | 🔴 sì | 1 tappa (Gastronomia Etnea) e nessun ripiego dichiarato | giro serale aperitivo + cena (2 tappe); e 4 tappe di giorno | 🟢 sì |
| c5 | Casbah del Moro alle 9:30, chiusa (mer 18:00–00:00) (telefono 12/10 (D-CATANIA B6)) | 🔴 sì | Casbah del Moro alle 09:30: chiuso (mer 18:00–00:00) | bar aperto alle 9:30 (e un posto senza orari: "sconosciuto", non violazione) | 🟢 sì |
| c6 | caffè da 1h 15min (75 min, come un ristorante) (telefono 12/10 (D-CATANIA B5)) | 🔴 sì | Caffè Savia (caffe): sosta di 75 min, la durata tipica di pasto (per caffe: 20 min) | caffè 20 min, ristorante 75, chiesa 20 | 🟢 sì |
| c7 | "Sono 1 minuti a piedi dalla tappa prima." e la stessa frase 3 volte (telefono 12/10) | 🔴 sì | «Sono 1 minuti a piedi dalla tappa prima.» — numero 1 con unità al plurale ; la stessa frase 3 volte nella giornata: «Qui la giornata prende ritmo, senza fretta.» (Piazza Duomo, Via Etnea, Castello Ursino) | frasi diverse, "1 minuto" e "5 minuti" corretti | 🟢 sì |
| c8 | "sunny, 20°C" alle 21:23 su un tour di domani (telefono 12/10) | 🔴 sì | meteo a schermo «sunny, 20°C» in inglese ; il tour è del 2026-10-15 ma mostra il meteo di adesso («sunny, 20°C», richiesta del 2026-10-14) | meteo in italiano sul tour di oggi; nessun meteo su un tour di domani | 🟢 sì |
| c9 | dopo il logout il flag "onboarding fatto" è cancellato e al login su browser vuoto lo stato è "todo" (il comportamento prima di ONB-1) (costruito sul comportamento descritto in docs/prove/2026-10-12-onb1.md §1) | 🔴 sì | passo KO: passo 5 ; passo KO: passo 8 ; solo 7 passi su 12: la prova si è fermata prima | tutti i 12 passi OK | 🟢 sì |
| c10 | vegetariano: un pasto non cercato come vegetariano; un museo trovato solo da ricerche vegetariane (costruito) | 🔴 sì | Trattoria del Duomo: pasto che non viene da una ricerca vegetariano ; Museo Civico: non è un pasto ma è stato trovato solo da ricerche vegetariano (vincolo esteso ai non pasti) | vegetariano: pasti cercati col criterio; museo trovato da ricerche normali | 🟢 sì |

### Definizioni

- **c1 — Pasti fuori fascia.** Una tappa-pasto (ristorante, trattoria, pizzeria…: `pasto`, non bar/caffè) con orario di arrivo fuori dalle fasce del pasto (pranzo e cena, da banco.config.json) oppure due pasti seduti a meno di `pastiDistanzaMinOre` ore uno dall'altro nello stesso giro (il "secondo pranzo").
- **c2 — Ristoranti a mattina/pomeriggio senza richiesta.** Una tappa-pasto nel momento mattina o pomeriggio, salvo che il testo della richiesta chieda quel momento: colazione/brunch per la mattina, merenda per il pomeriggio, o il nome del momento insieme a una parola di cibo. "ristoranti", "trattorie" ecc. da soli NON chiedono un momento.
- **c3 — Colazione in un posto non da colazione o chiuso.** Una tappa-locale (dove si mangia o beve) nel momento mattina che non è un posto da colazione (un ristorante/trattoria/pizzeria senza tipo cafe/bakery né nome da bar/caffè/pasticceria; o un wine bar/cocktail bar/enoteca) oppure che, secondo gli orari, è chiuso all'ora di arrivo.
- **c4 — Meno di 4 tappe senza ripiego dichiarato.** Un giro (itinerario) con meno di `tappeMin` tappe vere e nessun ripiego dichiarato (tempo libero, tappa di ripiego, "un solo posto", query di base). Di sera, un drink (aperitivo/dopocena) più la cena valgono come giro completo. Per Te non si applica (giri da 3 tappe per progetto).
- **c5 — Posto chiuso all'ora della tappa.** Una tappa il cui posto, secondo gli opening_hours.periods di Google, è chiuso all'ora di arrivo. Orario assente → "sconosciuto", contato a parte (non è una violazione).
- **c6 — Durate uguali per tipi diversi.** Una tappa la cui sosta è uguale alla sosta tipica di un tipo molto diverso dal suo (almeno `sostaScala` volte più lunga o più corta): es. un caffè che dura quanto un ristorante (75 min), un ristorante che dura quanto una chiesa (20 min).
- **c7 — Grammatica e ripetizioni nelle frasi.** Nelle frasi a schermo: numero e unità che non concordano ("1 minuti", "2 minuto", "alle 1"), parola funzionale doppia ("di di"), segnaposto o vuoti (null, {x}), oppure la stessa frase (nome e numeri mascherati) almeno `frasiUgualiMin` volte nella stessa giornata.
- **c8 — Inglese a schermo e meteo di adesso su un tour futuro.** Inglese a schermo: la condizione meteo che non è una voce italiana (sunny, rainy, cloudy…), o due parole funzionali inglesi nelle frasi/nei titoli. Meteo di adesso su un tour futuro: il tour ha la data di un altro giorno ma mostra il meteo (quello della richiesta).
- **c9 — Onboarding o interessi persi dopo logout.** Lo script ONB-1 (login → logout → login su browser vuoto → modifica interessi → logout/login): ogni passo deve essere OK, e i passi devono essere tutti.
- **c10 — Vincolo vegetariano violato o esteso ai non pasti.** Con una dieta vegetariana: (a) un pasto che non viene da una ricerca col criterio della dieta; (b) un NON pasto (museo, chiesa, parco…) trovato solo da ricerche col criterio della dieta (il vincolo esteso a ciò che non è cibo).

## Costo

Totale (token + Google contati; foto non caricate dallo script): **$6,91** su un tetto di $7,00. AI: 80 chiamate, 176695 token in, 17143 out. Google: place/findplacefromtext ×30, place/textsearch ×105, place/details ×120. Prezzi del listino in `banco.config.json` (place/details a $0,025 anche se per `fields=opening_hours` può costare meno: stima prudente).

Per caso, con la stima delle foto del banco nazionale (1 per tappa): in media $0,17.

## Prova che il motore non è cambiato

Le sole modifiche in `src/` sono `src/lib/simulatedNow.js` (nuovo) e **due righe** in `aiRecommendationService.js`:
`const requestTime = new Date()` → `requestNow(opts)` (generateItinerary) e `const now = new Date()` → `requestNow(opts)` (generateHomeTours).
`requestNow` restituisce `new Date()` se `opts.simulatedNow` manca, non è valido, o se `import.meta.env.PROD` (build di produzione).

- **Byte per byte, sul codice vero.** Stesso test (6 generazioni complete: 3 orari × `custom`/`quick`, Places e OpenAI finti, orologio fisso, senza `simulatedNow`) eseguito sul codice di HEAD `f18a7a0` (modifica tolta con `git apply -R`) e su quello nuovo: **entrambi 31 417 byte, sha256 `8f6402f9137ff186f10f52e1e2a3fd4162e0729403f93a0b6c70aee0f29661b4`** (`cmp` identico).
- **Test permanente** `src/__tests__/services/simulatedNow.test.js`: senza parametro = con il parametro uguale all'orologio (JSON identico); in produzione (`vi.stubEnv('PROD', true)`) un'ora simulata diversa è ignorata (JSON identico); nelle prove il parametro conta (la finestra del tour cambia).
- **Suite**: 1478 → 1503 test verdi (+25: ora simulata, controlli, orari, matrice, report).
- Non toccati: regole del motore, frasi, quote, prompt. Il secondo vincolo (testo libero, dieta, ritmo, umore, modalità come li passa l'app) è tutto negli script (`scripts/banco/esteso.live.js`), nessun cambio al motore.
- Non verificato: `generateHomeTours` (Per Te) non ha un test byte-per-byte come `generateItinerary`: la modifica è identica (stessa funzione, stessa riga) ma il test di JSON identico è solo sull'itinerario.

## Cosa ho letto da questo primo giro

- **Riprodotto dal telefono**: Veloce relax 21:25 a Catania → **1 sola tappa** (un'osteria, c4); trattorie a mattina/pomeriggio con «nei ristoranti tipici» (c2: 4 per caso a Catania); trattoria alle 12:30 chiusa fino alle 19:00 (c5); «Sono 1 minuti a piedi» presente in 5 casi su 30 (c7); `sunny` a schermo in tutti i 20 casi Crea/Veloce (c8, vedi sotto).
- **Veloce alle 21:45 e alle 23:30 NON seguono la previsione di D-CATANIA** («0 momenti» dalle 21:31): qui escono 4 e 5 tappe, di cui 3 e 4 chiuse all'ora di arrivo (c5). Il caso 21:45/23:30 va riletto: il motore costruisce un giro, ma di posti chiusi.
- **c6 = 0 su dati veri.** Nessun caffè da 75 min è comparso: i posti `bar+restaurant` del giro avevano nomi da tavola (Trattoria, Osteria…) e il controllo li tratta da pasti. Il controllo vede il caso cattivo noto (Caffè Savia), ma questo giro non ne ha prodotti: non è una prova che il difetto sia sparito.
- **c9 verde**: ONB-1 ha 13 passi (12 + il ripristino finale), tutti OK; il controllo richiede almeno 12.
- **c10 verde su 3 casi vegetariani**, ma il controllo (b) «esteso ai non pasti» ha come segnale solo le query del pool: ha una sola forma di evidenza.

## Cosa ho dato per vero senza verificarlo

1. **Il meteo.** Crea e Veloce ricevono `{ sunny, 20 }`, il valore di ripiego che le pagine usano quando `weatherCondition`/`temperatureC` mancano. L'app vera passa il meteo di `weatherService` (che usa le stesse parole inglesi), ma non l'ho chiamato: i **20 casi rossi di c8 vengono tutti da questa scelta**, non da un errore osservato nell'app. Inoltre **«meteo di adesso su tour futuro» non è mai stato esercitato**: nessun caso della matrice chiede «domani», quindi quella metà di c8 è provata solo sull'esempio costruito.
2. **Gli orari di apertura.** Il pool porta solo `open_now`, non i periodi: li ho presi con `place/details` (`fields=opening_hours`) **dopo** la generazione, per 120 posti distinti su 141 (21 non richiesti per il tetto di spesa, 8 senza orari su Google → «sconosciuto», 29 tappe in totale). Sono gli orari **settimanali di oggi**, applicati al mercoledì simulato 14/10/2026; chiusure straordinarie o festività non entrano. L'ordine di priorità (dove si mangia e beve, poi musei e negozi, poi il resto) significa che i non richiesti sono soprattutto chiese, parchi, piazze.
3. **Per Te non ha orari.** L'arrivo di ogni tappa è **stimato** (ora simulata + cammino + soste dichiarate): c1 e c5 su Per Te valgono per quella stima. Per Te gira a 3 tappe per tour per progetto: c4 non gli si applica.
4. **c4 su Veloce** usa la soglia di 4 tappe per tutti: un Veloce da «1-2 ore» difficilmente le contiene, quindi 7 Veloce su 9 rossi a «Giornata» nelle 12 voci è in parte la soglia, non il motore. Il difetto vero (1 tappa, nessuna dichiarazione) sta nei casi con 1 tappa.
5. **c1 e c2 si sovrappongono** (una trattoria alle 9:30 è sia c2 sia c3; il «secondo pranzo» è sia c1 sia c2): i totali per classe non si sommano in un numero di tour sbagliati. Le soglie (fasce 12:00–14:45 e 19:30–23:00, 3 ore fra due pasti, scala 2,5× per le soste) sono scelte mie, in `banco.config.json`.
6. **Il campione.** Un giro per caso: il modello non è deterministico, un numero come «6 su 30» non è una percentuale stabile. Le 12 voci usano le soglie del banco nazionale (costo $0,20 a caso con le foto stimate: rosso su Per Te perché ha 12-15 tappe).
7. **Le scelte del wizard di Veloce** (titoli «Relax › Benessere» ecc.) sono copiate da `QuickPath.jsx`; lo script si ferma se i titoli non ci sono più, ma non verifica che i **sotto-id** esistano per ogni città (Siracusa, Palermo e Firenze usano il ramo `default`).
8. **ONB-1 per c9** è l'unica prova «dopo logout» che ho: non copre un altro dispositivo né il rendering. L'esempio cattivo di c9 è costruito sul comportamento descritto nel report ONB-1, non rieseguito sul codice vecchio.
9. **Il costo** è stimato col listino di `banco.config.json` (token + chiamate Google contate), non letto dalla fatturazione; place/details pesa $3,00 dei $6,91 perché l'ho prudenzialmente contata $0,025 (per `fields=opening_hours` potrebbe costare molto meno). Le foto non sono caricate dallo script.
10. **Il deploy.** Vedi la sezione sotto.

## Deploy

Push su `main` e gate `ALL_GREEN`: vedi la riga finale dell'esito nel messaggio di chiusura del task (verificata dopo il push, non scritta prima).


