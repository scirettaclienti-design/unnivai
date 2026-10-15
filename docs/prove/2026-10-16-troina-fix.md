# TROINA-FIX — nei borghi nessun flusso della home esce vuoto; «non troviamo» solo per uno zero vero

Ramo `troina-fix` da `main` `b096732`. Commit `8db35b0` (motore, pagine, banco, test) e `e3f6359` (la natura scelta non
si perde per strada, CLAUDE.md), più questo report con i dati della guardia. Niente merge su main, niente deploy del proxy.
Diagnosi di partenza: `docs/prove/2026-10-15-troina-zero.md` (ramo `troina-zero`).

**Esito in breve**

- **Guardia della home: 12 flussi su 12 con posti veri** a Troina (borgo) e a Catania (città), alle 12:05 del 15/10. Su main
  la stessa guardia **fallisce** (7/12): Per Te di Troina vuoto («quasi tutto chiuso») e i quattro flussi a categoria di
  Troina che, sul motore di prima, cercano altro (uscite in rete del replay; in produzione erano a 0–1 tappe, vedi TROINA-ZERO).
- **Natura nei borghi:** il Quiz Natura di Troina ora ha **Monte Muganà** (13 min a piedi), Sorprendimi Natura un parco.
- **Messaggi:** «A [città] non troviamo [categoria]. Cambia richiesta e riprovo.» solo con lo zero vero del motore
  (`_zeroVero`); ogni altro vuoto è il testo di Ivano col tasto «Riprova».
- **Non peggiorare:** i 10 casi di PIENA-2 in replay sono **identici a main tappa per tappa**, 0 uscite in rete; il giro corto
  di Troina tiene Chiesa Madre e Torre Capitania.
- **Suite verde: 2075 test** (2061 su main + 14 nuovi). Lint: 0 errori.
- **Costo: 2,23 $ di listino misurati** (tetto 3 $, stop a 2,7 $), più una frazione non misurata del caso interrotto (vedi Costo).

## 1) Flussi × città, prima e dopo

Ora simulata 12:05 del 15/10 (l'ora del guasto; le liste del giorno erano già sul server). «Prima» per Troina: la
riproduzione di TROINA-ZERO su main (stesso giorno, 12:05–12:07); per Catania: il replay della guardia sul motore di
`b096732` (stessi tracciati, 0 $). «Dopo»: il giro pagato sul ramo. Un posto vero è una tappa con il `place_id` di Google
(il «Tempo libero» non conta).

| Flusso | Troina prima | Troina dopo | Catania prima | Catania dopo |
|---|---|---|---|---|
| **Per Te** | 0 tour («A quest'ora qui è quasi tutto chiuso.») | 1 tour misto, 3 tappe: Black & White (pranzo), Piazza Conte Ruggero, Convento di Sant'Agostino | 3 tour, 10 tappe | uguale: 3 tour, 10 tappe (San Francesco Borgia, Palazzo della Cultura, Monastero dei Benedettini, Odeon, Cattedrale di Sant'Agata, Lungomare di Acicastello…) |
| **Quiz Natura** (parchi) | 0 tappe, «A Troina non troviamo parchi e giardini» | 3 tappe: A'Pescheria (pranzo), Chiesa di San Silvestro, **Monte Muganà** (13 min a piedi) | 3 tappe | uguale: Maccarruni, Via Etnea, Villa Bellini |
| **Quiz Storia** (luoghi storici) | 0 tappe | 3 tappe: A'Pescheria, Piazza Conte Ruggero, Chiesa di San Silvestro | 3 tappe | uguale: Maccarruni, Via Etnea, Piazza del Duomo |
| **Su misura per te – Sorprendimi Natura** | 1 tappa + tempo libero | 3 tappe: A'Pescheria, Chiesa di San Silvestro, Azienda Speciale Silvo Pastorale (parco per Google, 6 min) | 3 tappe | uguale: Maccarruni, Via Etnea, Giardino Pacini |
| **Su misura per te – Sorprendimi Arte** | 1 tappa + tempo libero | 2 posti veri + tempo libero: Chiesa di San Silvestro, Piazza Conte Ruggero | 2 posti veri | uguale: Maccarruni, Via Etnea |
| **Crea il tuo Percorso** («Una giornata a X») | 1 tappa | 1 posto vero + tempo libero: Chiesa Madre alle 18:00 (fascia 17:05–20:05) | 9 tappe | uguale: 9 tappe (Teatro Antico, Museo Bellini, Liotru, Cattedrale…) |

Catania non cambia in nessun flusso: le correzioni toccano il borgo (giro corto, confini), la natura (che a Catania aveva già
Villa Bellini e Giardino Pacini) e i messaggi.

## 2) Cosa è cambiato

1. **Il giro corto del borgo** (`fasciaApertaBorgo`, `oreDiVisita` in `src/lib/cityKnowledge.js`; il motore in
   `aiRecommendationService.js`). La fascia si sceglie su **tutti i posti veri** della lista e delle ricerche, non solo su quelli
   che contano per la soglia (fuori pasti e zone, entro i 5 km del borgo). Conta **solo nelle ore di visita** (mattina e pomeriggio
   della tabella dei momenti): una fascia senza il tempo di una visita (45 min) non si sceglie. Alle 12:06 la fascia era tutta
   pranzo; ora comincia all'ora del pranzo e prosegue nel pomeriggio. **La regola della durata non cambia** (45 min per luogo, 2–4).
2. **Il selettore che non sceglie niente** non svuota più il giro: se i momenti hanno posti veri aperti, sceglie il riparatore
   del codice (`_citta.selettoreVuoto` nel tracciato).
3. **Per Te in un borgo** senza tour dai temi (tutti sotto le 3 tappe aperte) dà **un tour misto** dal motore dei momenti,
   mezza giornata da adesso (`_homeBorgo`).
4. **I confini del borgo** (`src/lib/borgoConfini.js`), vedi sezione 3.
5. **La natura scelta non si perde per strada** (`polishRoute`, parametro `dellaRichiesta`). Con una richiesta di natura, una
   tappa di natura non si cambia «per strada» con una che non lo è. Come per l'ancora, solo la regola dura del cammino la
   toglie; con un'altra tappa di natura lo scambio resta libero. Trovato nel giro pagato: il modello sceglieva Monte Muganà,
   poi la rifinitura lo cambiava con Piazza Conte Ruggero (4 min invece di 16), e il Quiz Natura usciva senza natura.
6. **I messaggi** (`src/lib/esitoVuoto.js`; Quiz Veloce, Sorprendimi, Crea il tuo Percorso, Per Te).
   - Messaggio di zero vero, «A [città] non troviamo [categoria]. Cambia richiesta e riprovo.», **solo se il motore segna
     `_zeroVero`**: ricerca riuscita, lista arrivata, zero candidati dopo raggio e categoria.
   - Messaggio tecnico in ogni altro vuoto (rete, timeout, lista mancante, selettore caduto, posti nel pool che nessun momento
     prende): **«Non sono riuscito a completare il giro: un servizio non ha risposto. Riprova tra poco.»** col tasto «Riprova».
   - Quote e guasto del motore AI tengono i loro testi già approvati.
7. **La guardia della home nel banco**, vedi sezione 5.

## 3) La distanza per la natura nei borghi: 12 km, e perché

`NATURA_BORGO_KM` = 12 km dal centro, = `widerRadiusKm(true)`. Vale solo con una richiesta di natura: Quiz Natura,
Sorprendimi Natura, Crea con «parchi» o «natura».

1. **È già la distanza che il prodotto accetta per un borgo** quando vicino non c'è abbastanza (`tourShape.js`, nata per le
   spiagge di Cabras a 11–12 km). Qui vale per la natura senza aspettare che manchi tutto.
2. **È il raggio con cui le ricerche già chiedono a Google** (il bias della ricerca). Quindi nessuna ricerca in più e nessun
   costo in più, e il test che lega bias e filtro resta vero.
3. **A Troina prende ciò che è dei dintorni e lascia fuori ciò che è un'altra gita.** Entrano Monte Muganà (1,5 km) e Ponte di
   Failla (3,2 km), e nel giro di oggi anche la Villa comunale di Cerami (8,2 km, entrata nel pool). Restano fuori i Nebrodi
   (17,5 km).

**I luoghi storici restano nel comune.** Chiese, musei, monumenti, castelli e ruderi entrano solo se l'indirizzo di Google è
nel comune (stessa regola di `nelComune` sul server). Senza indirizzo non si giudica.

**Il tempo per arrivarci** è quello della tappa: minuti a piedi dalla tappa prima, nella frase già approvata. Monte Muganà: 13
minuti. Un posto di natura oltre il tetto di cammino (20 min) entra nel pool, ma la regola dura del cammino resta. In pratica
la Villa comunale di Cerami non entra in un giro a piedi.

## 4) Non peggiorare: replay a 0 $

- **10 casi di PIENA-2**: `npm run banco:replay -- docs/prove/dati/2026-10-19-banco-esteso-c10-2-tracciati-completi.json.gz --confronta docs/prove/dati/2026-10-19-banco-esteso-c10-2.json`.
  - Sul ramo finale (`e3f6359`) **tutti e 10 identici a main** (`b096732`) tappa per tappa e orario per orario.
  - 0 uscite in rete.
  - Lecce e il caso «ivano», già diversi dal giro anche su main, restano uguali a main.
- **Troina nel percorso AI**: Chiesa Madre e Torre Capitania ci sono ancora.
  - `c10-troina`: Torre Capitania, Piazza Conte Ruggero, Chiesa Madre, Black & White.
  - `c10b-troina-mezza`: Chiesa Madre, Torre Capitania, A'Pescheria.
  - Identici a main.

## 5) La guardia della home

```
npm run banco:guardia                       # replay dei tracciati salvati, 0 $, nessuna rete — PRIMA DI OGNI MERGE
npm run banco:guardia -- --registra         # giro pagato (account di prova), rifà i tracciati: solo se il replay segna uscite in rete
```

- **Cosa controlla:** «ogni flusso della home dà almeno un tour con posti veri», a Troina e a Catania. I flussi sono Per Te,
  Quiz Natura/parchi, Quiz Storia/luoghi storici, Sorprendimi Natura e Arte, Crea il tuo Percorso.
- **Quando fallisce** (esce con 1): se un flusso è vuoto, se un caso manca o è in errore, se il replay prova a uscire in rete.
- **Dove sta:** casi in `scripts/banco/casi-home.js`, controllo in `scripts/banco/guardia-home.js`, comando in
  `scripts/banco/guardia.mjs`. Tracciati in `docs/prove/dati/guardia-home-tracciati.json.gz`, grezzo in
  `docs/prove/dati/guardia-home.json`.
- **La regola** è scritta in CLAUDE.md (regole in produzione e sezione TROINA-FIX).
- **Per Te ora si rigioca in replay** (`generaPerTe`/`registraPerTe` in `giro-caso.js`).

## 6) Test rosso → verde

I test nuovi falliscono sul codice di prima per il motivo giusto. Quelli di `troinaFix*` sono verificati su `b096732`;
quello della natura per strada è verificato sul `polishRoute` di `8db35b0`.

| Test | File |
|---|---|
| borgo con 3 luoghi da visitare e natura nei dintorni: il Quiz Natura delle 12:06 non è vuoto e ha un posto di natura | `src/__tests__/services/troinaFix.test.js` |
| Per Te in un borgo sotto soglia, temi tutti sotto le 3 tappe aperte: almeno un tour con posti veri | idem |
| errore di rete → mai «non troviamo» | idem e `src/__tests__/pages/troinaFixMessaggi.test.js` |
| zero vero → «A Troina non troviamo parchi e giardini. Cambia richiesta e riprovo.» | idem |
| alle 12:06 la fascia non è tutta pranzo | `troinaFix.test.js` |
| la guardia fallisce se un flusso è vuoto, se un caso manca, se il replay esce in rete | `troinaFix.test.js` |
| con una richiesta di natura Monte Muganà resta nel giro; lo scambio con un'altra natura resta libero | `src/__tests__/services/troinaFixNatura.test.js` |

Aggiornati alla regola nuova (un errore di rete ora dà il testo tecnico, non «non troviamo»): `searchErrorMessages.test.js`,
`orariMessaggioQuickPath.test.js`, `gateIntentLogs.test.js`.

## 7) Costo

Account di prova, credenziali solo da `.env.local`. Listino del banco.

| Giro | Casi | Spesa |
|---|---|---|
| 1 — `8db35b0`, tetto 2,7 $ | 7 completati (Troina ×6, Per Te Catania), **interrotto al caso 8** dalla chiusura della sessione | 1,085 $ + il caso 8 a metà (non misurato) |
| 2 — `8db35b0`, tetto 1,4 $ | i 5 casi mancanti di Catania | 0,811 $ |
| 3 — `e3f6359`, tetto 0,6 $ | Quiz Natura e Sorprendimi Natura di Troina sul codice finale (sostituiscono quelli del giro 1) | 0,334 $ |
| **Totale misurato** | | **2,23 $** |

Il caso 8 interrotto (Quiz Natura di Catania) aveva fatto alcune chiamate prima della chiusura. Il caso intero costa
0,13–0,17 $, quindi il totale vero sta fra 2,23 e circa 2,40 $, sotto lo stop di 2,7 $.

## 8) Punti aperti (non corretti qui)

- **Crea il tuo Percorso a Troina è debole:** 1 posto vero (Chiesa Madre alle 18:00) più tempo libero. Il giro corto sceglie la
  fascia 17:05–20:05 perché è quella con più posti della lista aperti. Era così anche prima: la guardia passa, ma il giro è povero.
- **I Quiz di Troina cominciano col pranzo:** A'Pescheria o Black & White, nella fascia delle 12:35. Il Quiz Storia chiede «solo
  tappe di questa categoria», eppure contiene un ristorante: è il momento del pranzo dello scheletro, non una tappa storica.
  Era fuori dal perimetro del task.
- **Il selettore che cade per rete** mostra il guasto del motore AI (`AI_ENGINE_MESSAGE`, testo già approvato), non il testo
  di Ivano. È coerente con la regola «quote e guasto del motore tengono i loro testi», ma va saputo.

## Cosa ho dato per vero senza verificarlo

- **Che «Azienda Speciale Silvo Pastorale» sia un posto di natura visitabile.** Google lo segna `park`; il nome fa pensare a un
  ente forestale, e non ho aperto la scheda.
- **I 13 minuti a piedi per Monte Muganà.** Sono la stima del motore in linea d'aria (`walkFrom`), non un percorso reale su
  strada. Il monte è in salita.
- **Che il caso 8 interrotto non abbia lasciato effetti** oltre alla spesa: nessuna scrittura di prova rimasta su Supabase. Non
  ho controllato le tabelle.
- **Che i tracciati del giro 1 (Troina) siano ancora rappresentativi** del codice finale per i casi non rifatti. Il replay sul
  ramo finale non ha uscite in rete, quindi le richieste sono le stesse; ma i numeri di quei casi vengono dal codice di
  `8db35b0`, non da `e3f6359`.
- **Che la riproduzione di TROINA-ZERO valga come colonna «prima» di Troina.** È lo stesso codice (`b096732`) e lo stesso giorno,
  ma un altro giro, non questi tracciati: col motore di prima quattro casi chiedono a Google cose diverse e il replay non li
  può rigiocare.
