# ORARI — diagnosi (a 0 $) e stop sulla decisione dati

Sola lettura sul grezzo `docs/prove/dati/2026-10-13-banco-esteso.json`: nessuna chiamata, nessuna modifica al motore. Base: HEAD `7805dc2`, suite 1503 verde.
Si rigenera con `node scripts/banco/diagnosi-orari.mjs docs/prove/dati/2026-10-13-banco-esteso.json`.

## 1. Diagnosi dei 19 casi rossi in c5

Regola usata per la diagnosi (quella del task): una tappa è valida se è aperta per **tutta la sosta** (arrivo → arrivo + durata), giorno vero del tour, ora di Roma. Più severa di c5 (solo all'arrivo): trova 4 tappe in più che sforano la chiusura.

| Caso | Tappa | Momento | Arrivo | Problema | Orari del giorno | Alternative nel pool (nel momento) | Aperte note | Chiuse | Orario ignoto | Migliore aperta |
|---|---|---|---|---|---|---|---|---|---|---|
| crea-catania-catanese-veg | PLANTE Lab | mattina | 09:30 | chiusa all'arrivo | mer 12:00–23:30 | 8 | 0 | 2 | 6 | — |
| crea-catania-catanese-veg | MAMARÓ BISTROT | mattina | 10:47 | chiusa all'arrivo | mer chiuso | 8 | 0 | 2 | 6 | — |
| crea-catania-catanese-veg | Osteria Moderna vini e piatti tipici siciliani | pomeriggio | 15:51 | chiusa all'arrivo | mer 19:00–23:30 | 9 | 2 | 1 | 6 | Trattoria Giglio Rosso |
| crea-catania-catanese | Trattoria L’imperiale | mattina | 09:30 | chiusa all'arrivo | mer 17:30–00:00 | 8 | 0 | 2 | 6 | — |
| crea-catania-catanese | Trattoria da Mario | pranzo | 12:30 | chiusa all'arrivo | mer 19:00–00:00 | 10 | 2 | 1 | 7 | Osteria Antica Marina |
| crea-catania-catanese | Trattoria Casalinga da Nino Mannino | pomeriggio | 14:30 | sfora la chiusura | mer 12:00–15:30, 18:00–23:30 | 9 | 1 | 1 | 7 | Trattoria Da Peppino di Tumia Giovanni |
| crea-catania-catanese | Trattoria U Fucularu | pomeriggio | 15:47 | chiusa all'arrivo | mer 18:00–23:30 | 9 | 1 | 1 | 7 | Trattoria Da Peppino di Tumia Giovanni |
| crea-napoli-aperitivo-cena | Enoteca e Trattoria La Cantinetta | cena | 20:00 | chiusa all'arrivo | mer 10:30–19:30 | 12 | 4 | 0 | 8 | Trattoria Donna Tuttina |
| crea-roma-neutra | Basilica dei Santi XII Apostoli | pomeriggio | 15:33 | chiusa all'arrivo | mer 07:00–12:00, 16:00–19:00 | 9 | 1 | 1 | 7 | Piazza d'Aracoeli |
| crea-lecce | 'Scante - Trattoria con Aperitivo | pranzo | 12:30 | chiusa all'arrivo | mer 18:00–00:00 | 13 | 0 | 0 | 13 | — |
| crea-lecce | Casa Museo Spada - Antichi Strumenti Musicali | pomeriggio | 14:30 | chiusa all'arrivo | mer chiuso | 4 | 0 | 0 | 4 | — |
| crea-bologna-pomeriggio | Darcy Osteria Contemporanea | pomeriggio | 15:00 | chiusa all'arrivo | mer chiuso | 6 | 0 | 0 | 6 | — |
| crea-bologna-pomeriggio | La Rustica Pizzeria Osteria | aperitivo | 18:00 | chiusa all'arrivo | mer 12:00–14:30, 19:00–22:00 | 5 | 0 | 0 | 5 | — |
| crea-milano-sera | Trattoria della Stampa Milano | dopocena | 22:30 | chiusa all'arrivo | mer 12:00–22:30 | 13 | 0 | 1 | 12 | — |
| crea-milano-sera | Antica Trattoria della Pesa | dopocena | 23:45 | chiusa all'arrivo | mer 12:30–14:30, 19:00–23:00 | 13 | 0 | 1 | 12 | — |
| crea-firenze-arte | Aria Art Gallery | mattina | 09:30 | chiusa all'arrivo | mer 10:30–13:30, 15:30–19:30 | 3 | 0 | 0 | 3 | — |
| crea-firenze-arte | Street Levels Gallery | pomeriggio | 14:30 | chiusa all'arrivo | mer 10:00–13:00, 15:00–19:00 | 3 | 0 | 0 | 3 | — |
| crea-firenze-arte | Galleria Poggiali | aperitivo | 18:00 | sfora la chiusura | mer 10:00–12:00, 14:00–19:00 | 3 | 0 | 0 | 3 | — |
| crea-palermo-mercato-veg | Osteria SALUTAMI A’ NONNA | pranzo | 12:30 | chiusa all'arrivo | mer chiuso | 10 | 0 | 0 | 10 | — |
| crea-siracusa | Trattoria La Pigna | pranzo | 12:30 | chiusa all'arrivo | mer 19:00–22:00 | 8 | 0 | 0 | 8 | — |
| crea-siracusa | Ipogeo di Piazza Duomo, Siracusa | pomeriggio | 14:30 | chiusa all'arrivo | mer chiuso | 0 | 0 | 0 | 0 | — |
| veloce-catania-relax-2145 | Magma Harmony SPA | — | 22:24 | chiusa all'arrivo | mer 11:00–19:00 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| veloce-catania-relax-2145 | Blossom beauty & spa | — | 23:14 | chiusa all'arrivo | mer 09:00–18:30 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| veloce-catania-relax-2145 | L' UNIVERSO DEL RELAX,CENTRO ESTETICO-BENESSERE-MASSAGGI (Massaggi ed Estetica) | — | 00:11 | chiusa all'arrivo | gio 09:30–20:00 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| veloce-catania-relax-2330 | Magma Harmony SPA | — | 00:09 | chiusa all'arrivo | gio 11:00–19:00 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| veloce-catania-relax-2330 | Centro Valclè Beauty & Pilates | — | 00:54 | chiusa all'arrivo | gio 09:00–13:00, 15:00–19:00 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| veloce-catania-relax-2330 | L' UNIVERSO DEL RELAX,CENTRO ESTETICO-BENESSERE-MASSAGGI (Massaggi ed Estetica) | — | 01:39 | chiusa all'arrivo | gio 09:30–20:00 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| veloce-catania-relax-2330 | Charme & Relax - Catania | — | 02:25 | chiusa all'arrivo | gio 09:30–19:30 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| sorprendimi-catania-pomeriggio | Palazzo dei Chierici | pomeriggio | 15:30 | chiusa all'arrivo | mer 08:00–13:00 | 9 | 0 | 0 | 9 | — |
| sorprendimi-napoli-tardi | Belvedere Villa Floridiana | — | 22:30 | chiusa all'arrivo | mer 09:00–18:00 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| sorprendimi-napoli-tardi | Trattoria da Giovanni | — | 00:22 | chiusa all'arrivo | gio 12:00–22:30 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| sorprendimi-napoli-tardi | Belvedere di Pizzofalcone - Monte di Dio - Monte Echia | — | 02:13 | chiusa all'arrivo | gio 07:00–22:30 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| perte-roma-1000 | Orti Urbani del Parco di Monte Ciocci | — | 10:00 | chiusa all'arrivo | mer 18:00–20:00 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| perte-roma-1600 | Orti Urbani del Parco di Monte Ciocci | — | 16:00 | chiusa all'arrivo | mer 18:00–20:00 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| perte-roma-1600 | Galleria Colonna | — | 16:22 | chiusa all'arrivo | mer chiuso | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| perte-catania-1300 | Osteria del mar | — | 14:50 | chiusa all'arrivo | mer chiuso | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| perte-catania-1300 | Osteria&PizzeriaDaiPazzi | — | 13:00 | chiusa all'arrivo | mer 18:30–00:00 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| perte-catania-1300 | Osteria Antica Marina | — | 14:19 | sfora la chiusura | mer 12:30–15:00, 19:30–23:00 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| perte-catania-1300 | Palazzo Biscari | — | 14:32 | chiusa all'arrivo | mer 10:00–13:00, 16:00–19:00 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| perte-napoli-2000 | Museo Civico Gaetano Filangieri | — | 23:02 | chiusa all'arrivo | mer 09:30–19:00 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| perte-napoli-2000 | Antica Trattoria del Nilo - Spaccanapoli | — | 21:18 | chiusa all'arrivo | mer chiuso | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| perte-napoli-2000 | Museo del Tesoro di San Gennaro | — | 20:39 | chiusa all'arrivo | mer 09:30–18:00 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| perte-napoli-2000 | Pio Monte della Misericordia | — | 21:40 | chiusa all'arrivo | mer 10:00–18:00 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| perte-napoli-2000 | Belvedere di Pizzofalcone - Monte di Dio - Monte Echia | — | 22:09 | sfora la chiusura | mer 07:00–22:30 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| perte-firenze-1100-veg | Museo Stefano Bardini | — | 11:31 | chiusa all'arrivo | mer chiuso | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |
| perte-firenze-1100-veg | LOV Osteria Vegetariana | — | 14:06 | chiusa all'arrivo | mer 19:00–23:00 | n/d (nessun pool per momento: Per Te, Veloce o Sorprendimi senza scheletro) | — | — | — | — |

### Riepilogo

- **19 casi, 46 tappe**: 42 chiuse già all'arrivo (= le 42 violazioni di c5) + 4 che aprono ma sforano la chiusura durante la sosta.
- **Pasti 21, non pasti 25.** Per momento (dove il giro ha lo scheletro): pomeriggio 9, mattina 4, pranzo 4, aperitivo 2, dopocena 2, cena 1; 24 tappe non hanno un momento (Veloce, Sorprendimi serale e Per Te non passano dalla selezione per momenti).
- **Quasi sempre il problema è il tipo di posto, non l'ora:** trattorie che aprono alle 17:30–19:00 proposte alle 9:30, a pranzo e nel pomeriggio; centri benessere che chiudono alle 18–20 proposti alle 22–02 (i giri notturni 21:45 e 23:30); musei/gallerie chiusi il mercoledì o a metà giornata; piazze/ipogei con orari propri.
- **Alternative aperte nel pool: la domanda non ha una risposta piena a 0 $.** Il banco ha scaricato gli orari solo dei posti scelti: delle 172 alternative nel pool dei 22 momenti con scheletro, **148 hanno orario ignoto** (mai scaricato). Fra quelle con orario noto (24): 6 tappe chiuse su 22 hanno almeno un'alternativa aperta nota (Osteria Antica Marina, Trattoria Giglio Rosso, Trattoria Donna Tuttina, Piazza d'Aracoeli, Trattoria da Peppino…), 16 no. **Non so, quindi, quante delle 16 avrebbero un'alternativa aperta con gli orari di tutto il pool**: è esattamente il dato che la ricerca dovrebbe portare.
- Sulle 24 tappe senza scheletro (Veloce serale, Sorprendimi tardi, Per Te) non c'è un pool "per momento" da guardare: lì l'alternativa va cercata nel pool intero del tema.
- Il caso più estremo conferma il punto del task: **Veloce 23:30** propone 4 centri estetici chiusi (arrivi alle 00:09, 00:54, 01:39, 02:25: giovedì, e aprono alle 09:00–11:00) e **Veloce 21:45** altri 3. Nessun giro di posti aperti esiste in quel pool: il messaggio dichiarato è l'esito atteso.

## 2. Dati — FERMO: costa di più, decidi tu

**Gli orari settimanali non possono arrivare nella ricerca di oggi, a nessun prezzo.** Il motore chiama l'API **legacy** (`maps.googleapis.com/maps/api/place/textsearch`, via `supabase/functions/places-proxy`, whitelist di 5 path legacy). La textsearch legacy restituisce `opening_hours` **solo** come `{open_now}` (già verificato nel codice: `placesDiscoveryService.js:477-485`); i `periods` esistono solo in `place/details`. Non c'è un campo da aggiungere: `regularOpeningHours` appartiene all'API **Places (New)** (`places:searchText`, POST con FieldMask), un altro endpoint, un'altra forma della risposta.

Listino (developers.google.com/maps/billing-and-pricing/pricing, letto oggi, fascia 0–100k richieste/mese):

| SKU | $/1000 | Note |
|---|---|---|
| Text Search legacy (oggi) | 32,00 | solo `open_now` |
| Text Search (New) **Pro** | 32,00 | niente orari, niente rating |
| Text Search (New) **Enterprise** | **35,00** | `regularOpeningHours`, `rating`, `userRatingCount`, `priceLevel` |
| Place Details legacy | 17,00 + Contact 3,00 | `opening_hours` è Contact |

Il motore non chiede oggi campi Enterprise dell'API nuova (usa la legacy, che include rating e recensioni nel prezzo base), quindi **chiedere gli orari costa di più: +$3 ogni 1000 ricerche**.

**Per generazione (dai grezzi del banco esteso, 30 generazioni):**

| | Ricerche testo | Costo medio per generazione (token + Google, senza foto) |
|---|---|---|
| Oggi (legacy) | 3,5 (da 2 a 5) | **$0,130** (da $0,082 a $0,179) |
| A. API nuova Enterprise | 3,5 | **≈ $0,141** (+$0,0105, +8%; al massimo +$0,015) |
| B. Legacy + `place/details` dei finalisti | 3,5 + 4 dettagli | ≈ $0,230 al listino del banco ($0,025 a dettaglio, +$0,10, +77%) |

- **A** costa poco ma **non è "aggiungere un campo"**: serve riscrivere il percorso di ricerca (endpoint e proxy — oggi legacy, GET e cache per querystring; `places_cache` dovrebbe chiavare un corpo POST —, parsing della nuova forma: `displayName`, `location`, `types`, `priceLevel` come enum, `regularOpeningHours.periods` con `hour/minute`), e ritestare i 1503 test e le soglie di qualità sul nuovo formato. Rischio di regressione sulle voci già verdi (verità, voce, famosità) perché cambiano i candidati. L'API nuova ha anche altri free cap mensili: non verificati.
- **B** non cambia la ricerca ma costa quasi il doppio, e gli orari arriverebbero solo per i finalisti: le alternative (le 148 ignote) resterebbero cieche, che è proprio il buco che la regola non deve lasciare.
- **C (non costosa, ma parziale):** tenere la legacy e chiedere `place/details` solo per le tappe scelte, per poi sostituire quelle chiuse — non risolve "il pool ha un'alternativa aperta?" senza altre chiamate.

**Non ho applicato niente.** Il resto del task (regola, ripiego, messaggio notturno, test rosso→verde, rigiro dei 19+2 casi con tetto 4 $) dipende dalla sorgente degli orari; la regola in sé (aperta per tutta la sosta, alternativa dello stesso momento, tempo libero / locale aperto più vicino / riga dichiarata, orario ignoto segnato) non dipende da A o B e posso scriverla subito su un campo `openingPeriods` del candidato.

## Cosa ho dato per vero senza verificarlo

1. I prezzi sono quelli letti oggi dalla pagina del listino Google (con un riassunto automatico della pagina): da ricontrollare in Cloud Console; free cap mensili e sconti per volume non entrano nei numeri.
2. «Costo medio per generazione» usa i prezzi di `banco.config.json` (place/details a $0,025 = stima prudente del banco, non il 17+3 del listino) e il conteggio delle chiamate contate dal banco esteso (30 generazioni, un campione ciascuna).
3. Gli orari sono quelli settimanali di Google di oggi, applicati al mercoledì simulato 14/10; la diagnosi guarda gli orari per posto da qualunque caso li abbia scaricati (stesso posto = stessi orari) ma **solo dei posti scelti**: per le alternative è "ignoto" il 148/172.
4. Per le alternative ho confrontato l'orario con quello della tappa chiusa (arrivo e sosta di quella tappa), non con la sosta propria dell'alternativa (i tipi non sono nel grezzo del pool).
5. «Quasi sempre il tipo di posto» è una lettura delle 46 righe, non una misura.
6. Non ho aperto il codice di `momentSelection.js`/`freeTime.js` per progettare la regola: la progettazione parte dopo la tua decisione.
7. Il deploy: nessuna modifica al codice in questo passo (solo script e documento).
