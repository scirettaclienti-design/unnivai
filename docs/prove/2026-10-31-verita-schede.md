# VERITA-SCHEDE (31/10/2026)

Obiettivo: nessun fatto di un'altra città o non verificato nelle schede dei luoghi e nei testi letti a voce.
Ramo `notte/verita-schede`, **partito da `notte/per-te-proposte`** (PR #3), perché tocca `aiRecommendationService.js`: va unita dopo la #3.

## Cosa cambia per Ivano
- La scheda di un luogo (cenni, testo letto con il tasto voce) mostra solo il racconto del server, quello con le fonti (Wikipedia + descrizione Google, controllo automatico e revisore). Se il racconto non passa o il luogo non ha fonti: la scheda non mostra cenni.
- Le «curiosità» (blocco «Dettaglio») non ci sono più: nessuno le scrive e il blocco è tolto.
- Cenni e curiosità scritti a mano nella tabella `activities` non si mostrano più (non hanno una fonte verificabile).
- **Nessun deploy**: il server (`openai-proxy` r5) non cambia, il client usa lo scopo `racconto` che c'è già. Basta il merge di main.

## Diagnosi: sorgente → dove si vede/sente → controllo attuale → rischio
| Sorgente | Dove | Controllo prima | Rischio prima | Ora |
|---|---|---|---|---|
| `enrichMonuments` (gpt-4o-mini, prompt «curiosità ironiche», solo nome + città, nessuna fonte) → `historicalNotes`, `funFacts` | scheda luogo `POIDetailDrawer` («Cenni», «Dettaglio»), lettura a voce del tasto Volume, descrizione dei passi dei tour (`dataService.getTourById`), `TourBuilder`, `getCityActivities` | nessuno | **alto**: fatti inventati o di un'altra città (il modello ragiona dal nome) | testo dal racconto r5 con fonti; senza, vuoto. `funFacts` sempre `[]` |
| `activities.historical_notes` / `fun_facts` (database) | stessa scheda | nessuno | medio: scritti a mano o da seed, senza fonte | non si leggono più |
| Curiosità del cammino (`vociTesti.CURIOSITA`, 1 voce, Roma) | schermo e voce a piedi | etichettata con la città, mostrata solo nella sua (CURIOSITA-CITTA) | basso (ma il fatto non è legato alle fonti di una tappa) | invariata: **punto aperto** |
| Racconto di tappa (`openai-proxy`, r5) | scheda arrivo, lettore, voce | `controllaRacconto` + revisore | basso | invariato |
| Frasi del giro (`stopPhrases`, frasi chiuse + fatti aperti `factsService`) | descrizione tappe | frasi approvate; fatti da Wikipedia con aggancio verificato | basso | invariato |
| Chat con la guida (`chatWithGuide`, AIDrawer/GeminiDrawer) | chat libera | nessuno | medio: risponde a domande libere | **non toccata**: punto aperto |

## Correzione
`aiRecommendationService.enrichMonuments` non chiama più il modello: per ogni luogo chiede `richiediRacconto` (server, fonti, controllo) e usa il testo solo se `esito = passato`. Un solo punto, quindi coprono i quattro chiamanti. `MapPage` ora passa il luogo intero (serve il `place_id`). Il controllo è quello di `racconto.ts`, riusato senza copiarlo e senza toccarlo.

## Prove
- `src/__tests__/services/veritaSchede.test.js` (7 test): Catania (Fontana dell'Elefante) e Roma (Fontana di Trevi) con fonti finte: il fatto presente nelle fonti passa; un fatto dell'altra città (Salvi/1762 su Catania, Vaccarini/1737 su Roma) e un nome assente (Bernini) vengono scartati; `enrichMonuments` con server finto: passato → testo, scartato/senza fonti/senza place_id/rete giù → nessun testo, `funFacts` vuoti, nessuna chiamata di testo libero.
- Suite 2944/2944 (239 file), lint 0 errori, build ok, `npm run banco:guardia` 12/12.

## Da provare dal vivo
Aprire la scheda di un luogo a Catania e a Roma: cenni = racconto (o niente), voce legge lo stesso testo. Il primo caricamento di una scheda ora aspetta il racconto (fino a 45 s la prima volta, poi in cache); sotto il tetto `RACCONTO_DAILY_CAP` (300).

## Cosa NON risolve
- La chat libera con la guida può ancora dire fatti non verificati.
- La curiosità del cammino di Roma («più di duemila fontanelle») è legata alla città, non a fonti di una tappa: decide Ivano se tenerla.
- Chiavi/seed delle `activities` restano nel database, solo non si leggono.
- I luoghi senza Wikipedia/Google (o locali) restano senza cenni: è voluto.
