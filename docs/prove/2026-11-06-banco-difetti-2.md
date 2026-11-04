# BANCO-DIFETTI-2: la richiesta precisa, i buchi lunghi, la famiglia (T23, 06/11/2026)

Stato: **fatto** (PR da unire dopo CI). Ramo `notte/banco-difetti-2`, worktree `~/unnivai-notte-t23`. Righe di `docs/LANCIO.md`: **L7** e **P8**.
Nessuna funzione del server toccata: niente deploy di `openai-proxy` (resta v49), niente migrazioni, niente secret. Nessuna ricerca nuova a Google nel motore: le correzioni usano i posti che il motore ha già trovato e verificato.

## Cosa cambia per Ivano

1. **Se chiedi una cosa precisa, il giro la contiene o ti dice perché no (D6).** In Crea contano i luoghi per nome («tra Colosseo e Fori Imperiali», «del Capo», «Vaticano»), i tipi di posto (cioccolato, mercati, spa, musei, chiese, panorami, cucina), il tema per tutto il giro («natura»), il pasto («pranzo») e l'ora («alle 15»); nel Veloce solo i tipi precisi del wizard (spa, mercati, cioccolato). Quello che manca entra in un'attesa o al posto di una visita qualunque, anche se il quartiere, la categoria, il merito o il «fuori strada» l'avevano tolto; la fermata della metro «Colosseo» non vale più come Colosseo. Quando non si può, una riga sotto il titolo del giorno dice cosa e perché, con il fatto misurato:
   - «Spa e centri benessere: a Catania quelli trovati sono chiusi nelle ore del giro.» (Veloce alle 23:15)
   - «Capo (Mercato del Capo): è chiuso nelle ore in cui il giro ci passa.» (Palermo dalle 13)
   - «2 tappe su 5 non sono di natura: entro 1,2 km non ho trovato altri parchi, giardini o belvedere aperti che entrino negli orari del giro. Panorami: il posto più vicino è a 6,5 km dalle tappe del giro, oltre 1,2 km a piedi.» (Palermo, natura e panorami)
   La riga si vede in Crea, nel Veloce e in Sorprendimi (`notaGiro`). I testi stanno in un file solo, `src/lib/testiGiro.js`.
2. **Niente più «Tempo libero» muto di oltre 2 ore (D7).** Un'attesa così si riempie con visite vicine (entro 1,2 km dalla tappa prima e dalla dopo: **il tetto non cambia**), aperte per tutta la sosta, coerenti col giro; quello che resta dice il motivo sulla riga stessa: «Nessuna tappa in questa fascia: entro 1,2 km non ci sono altri posti aperti adatti al giro.», «…: con il ritmo tranquillo il giro tiene una tappa per mattina e una per pomeriggio.» (il Tranquillo tiene le pause lunghe per regola, C8d), «Il giro finisce qui: il resto della fascia chiesta è libero.». In più due buchi che l'ultima rete del tetto (T19) creava: un pranzo o una cena tolti perché il locale era oltre 1,2 km tornano con un altro locale entro il tetto (Napoli: il pranzo era sparito, 199 minuti vuoti); e una prima tappa isolata (a Milano la colazione a 2,9 km da Brera) esce lei invece di far togliere tutta la giornata.
3. **In famiglia si cammina meno (DNA-5).** Con «Con bambini» (Profilo, Gruppo, testo o scelte) e nessun ritmo scelto nella richiesta: una tappa per mattina e una per pomeriggio come il ritmo Tranquillo (anche se il DNA ha imparato un ritmo medio o veloce), visite almeno il 20% più lunghe, la merenda come pausa, le attese lunghe dichiarate e non riempite, Per Te con 3 tappe per tour. Un ritmo scelto nella richiesta vince. Prova a Roma: **3,54 km e 10 tappe contro 4,51 km e 12 del giro neutro** (prima: 6,19 km contro 3,94).
4. **Il banco ha il sesto controllo** «Richiesta precisa rispettata o dichiarata» (`scripts/banco/controlloRichiesta.js`): controllo nuovo ordinato da Ivano, con una lettura della richiesta sua (indipendente dal motore); i cinque di prima non cambiano.

## Tabella prima / dopo

«Prima» = codice di `main` (8d79dfe) sui tracciati di prima (replay); «dopo» = il giro vero sul codice finale (i casi rifatti) e la riproduzione a 0 $ dei 40 casi, uguale al giro vero. Misura: `node scripts/banco/report-difetti2.mjs <grezzo.json>`.

| Difetto | Prima | Dopo |
|---|---|---|
| **D6** richiesta precisa (sesto controllo) | **8/40 casi KO**: `n-roma-1300-specifica` (solo la fermata «Colosseo»), `n-roma-intenso` (niente Vaticano), `n-palermo-1300-mercato` (niente Capo né mercato), `n-catania-2315-veloce` (spa), `n-scicli-cibo` (cioccolato), `n-palermo-natura` e `n-troina-natura` (2 visite non di natura, nessun panorama a Palermo), `a-siracusa-ortigia` (Ortigia) | **0/40 KO**. Nel giro: Colosseo vero, Musei Vaticani (Intenso), Mercato Ballarò, Crema & Cioccolato Scicli, Mercato di Ortigia; dichiarati col motivo: spa chiuse (Catania 23:15), Mercato del Capo chiuso, 2 visite non di natura e panorami a 6,5 km (Palermo), 2 visite non di natura (Troina) |
| **D7** «Tempo libero» oltre 2 ore | **10 righe in 10 casi, tutte mute** («Niente in agenda…»): 8 fra due tappe (`a-troina` 143, `d-troina-roma` 157, `n-roma-intenso` 240, `n-catania-rilassato` 159, `n-napoli-dna-cibo` 131, `n-troina-natura` 251, `n-noto-0900` 145, `n-scicli-cibo` 141) e 2 code (`n-roma-1300-specifica` 175, `n-firenze-sorprendimi-2000` 165) | **5 righe in 5 casi, 0 mute**: riempiti `d-troina-roma`, `n-roma-intenso` (Piazza Navona, Basilica di San Pietro), `n-napoli-dna-cibo` (pranzo rimesso + Piazza del Plebiscito), `n-scicli-cibo`, `n-roma-1300-specifica` (Museo del Foro Romano); dichiarati col motivo: `a-troina` 144 e `n-troina-natura` 251 e `n-noto-0900` 135 (nessun posto aperto entro 1,2 km), `n-catania-rilassato` 145 (ritmo tranquillo), `n-firenze-sorprendimi-2000` 165 (il giro finisce dopo cena) |
| **DNA-5** famiglia (Crea «Domani, una giornata a Roma») | C 11 tappe, **6,19 km** contro il neutro 9 tappe, **3,94 km** | C 10 tappe, **3,54 km**, visite 35 min, contro il neutro 12 tappe, **4,51 km**, visite 30 min (il neutro ha ora i buchi riempiti); Per Te: C 3 tappe per tour, 4,07 km in tutto contro 6,63 |

Prova DNA-5 completa (A/B/C, Crea e Per Te): `DV_COLAZIONE_AUTO=off DNA5_OUT=docs/prove/dati/2026-11-06-dna-5-famiglia.json npx vitest run -c scripts/prova-dna5/vitest.dna5.config.js`, dati in `docs/prove/dati/2026-11-06-dna-5-famiglia.json` (A 8 tappe 4,00 km; B 13 tappe 6,36 km; C 10 tappe 3,54 km; 0 senza DNA 12 tappe 4,51 km). Nota: in Per Te il tour «cultura» di C (3 tappe, 1,34 km) cammina più di quello del neutro (4 tappe, 0,88 km): sono altre tappe dello stesso pool; il totale di C è 4,07 km contro 6,63.

## Prove

- **Suite**: 278 file, **3443 test verdi** (`npm run test:run`); lint **0 errori** (188 avvisi, come prima); `npm run build` ok.
- **Test nuovi**: `src/__tests__/lib/richiestaNelGiro.test.js` (10), `src/__tests__/scripts/controlloRichiesta.test.js` (9), `src/__tests__/lib/riempiBuchi.test.js` (8: buchi, pasti rimessi, prima tappa isolata), `src/__tests__/lib/famigliaCammina.test.js` (3). Aggiornati: `banco40.test.js` (6 controlli), `continuita`, `composizioneC1`, `minimiC8b` (la riga oltre 2 ore dice il motivo).
- **Giro vero** (account di prova, giorno simulato 05/11/2026): 3 giri, **26 casi distinti** (26 + 4 + 22 esecuzioni), tutti con i sei controlli verdi.
  1. 26 casi (i 15 cambiati da T19 + i casi toccati da D6/D7) sul commit `b23647c`;
  2. 4 casi (`a-milano`, `b-roma-B`, `n-napoli-dna-cibo`, `n-lontano-palermo-firenze`) sul codice finale `620ca3f`, dopo la correzione dei buchi del tetto che il giro 1 aveva mostrato;
  3. gli altri 22 del giro 1 ripetuti sul codice finale `620ca3f` (regola: i numeri finali da un giro sul codice finale).
  Gli altri 14 casi (giri veri di T15/T18/T19) non cambiano itinerario col codice nuovo e nessuno ha una richiesta precisa: il loro sesto controllo è calcolato sul giro rigiocato, che ha la stessa firma del giro vero (`npm run banco -- --ricontrolla`, segnato `controlliDalReplay` in `banco-40-esiti.json`).
- **Riproduzione a 0 $**: `npm run banco -- --replay` → **exit 0**, **40/40 uguali al giro vero**, 0 uscite in rete, **40/40 con tutti e sei i controlli**.
- **Guardia** prima del merge: `npm run banco:guardia` → home **12/12**, pertinenza nessun ❌ nuovo (3 noti), banco 40 **10/10** con i sei controlli.
- Nessun caso che passava ora fallisce (40/40 prima con cinque controlli, 40/40 dopo con sei).

## Costo AI e Google (a listino)

| Giro | AI | Google | Totale |
|---|---|---|---|
| 1 — 26 casi (Sonnet 5.5 261.280 token in, 24.244 out; Haiku 4.5 60.396 in, 3.257 out; 71 ricerche nuove + 10 per nome) | 0,84 $ | 2,66 $ | 3,50 $ |
| 2 — 4 casi (tutto Google dalla cache del proxy) | 0,15 $ | 0 $ | 0,15 $ |
| 3 — 22 casi sul codice finale (11 ricerche nuove, il resto dalla cache) | 0,68 $ | 0,39 $ | 1,07 $ |
| Riproduzioni, guardia, prova DNA-5, test | 0 $ | 0 $ | 0 $ |
| **Totale T23** | **1,67 $** | **3,04 $** | **4,71 $** (tetto 8 $) |

## Cosa NON risolve

- **Dove non c'è niente di aperto entro 1,2 km il buco resta** (dichiarato): Troina 15:33–20:00 (251 min), Noto 135 min, `a-troina` 144 min. Riempirli vorrebbe ricerche nuove a Google nei borghi o il tetto più largo (vietato): proposta per un task con budget di ricerche.
- **Il tema natura di Palermo e Troina** resta con 2 visite non di natura (dichiarate): i parchi vicini sono già tutti nel giro; il Teatro Massimo è un'ancora della lista della città.
- **Il Mercato del Capo** a Palermo il giovedì pomeriggio è chiuso per Google: il giro lo dice; non si sposta il pranzo per anticiparlo.
- **Ortigia** si riconosce per nome di una tappa (Mercato di Ortigia), non per area: un quartiere chiesto fuori lista in una città non metropoli non ha ancora il suo nucleo (C10c vale per metropoli e città, qui il riconoscimento su Google non scattava).
- Nel Quiz le categorie larghe (natura, storia) non sono «richiesta precisa» di questo controllo: le misura già la pertinenza.
- D8-stazione: chiusa per i luoghi chiesti per nome (la fermata col nome chiesto lascia il giro); una fermata scelta per altri motivi resta come prima (zone.js).
- D9 (nomi generici) resta aperto: non toccato.
- Il riquadro DNA non ha una riga nuova per la regola della famiglia (dice già «In famiglia: l'hai scelto nel Profilo.»).

## Passi che aspettano Ivano

Nessun comando: nessuna migrazione, nessun secret, nessun deploy. Su iPhone non serve una prova (niente voce, GPS o audio). Se vuole guardare: Crea «Un pomeriggio tra Colosseo e Fori Imperiali a Roma» (il Colosseo vero), Crea «Natura e panorami a Palermo» (la riga sotto il titolo del giorno), Veloce Relax/Benessere a Catania dopo le 23 (la riga delle spa chiuse), Profilo → «Come giri» → «Con bambini» → Crea «Domani, una giornata a Roma» (meno tappe, soste più lunghe).

## File

`src/lib/richiestaNelGiro.js`, `src/lib/inserisciTappa.js`, `src/lib/riempiBuchi.js`, `src/lib/testiGiro.js` (nuovi); `src/lib/giroDna.js`, `src/lib/ordinePercorso.js`, `src/services/momentSelection.js` (`tettoNelPiano`: la prima tappa isolata), `src/services/aiRecommendationService.js`; `src/pages/AiItinerary.jsx`, `src/pages/QuickPath.jsx`, `src/components/Map/QuickPathSummary.jsx`, `src/pages/SurpriseTour.jsx` (`notaGiro`); `scripts/banco/controlloRichiesta.js` (nuovo), `controlli40.js`, `esiti40.js`, `guardia-banco40.js`, `banco40.mjs` (`--ricontrolla`), `giro-caso.js`, `report-difetti2.mjs` (nuovo); `docs/prove/dati/banco-40-*` (esiti, tabella, tracciati), `docs/prove/dati/2026-11-06-dna-5-famiglia.json`; test sopra; `CLAUDE.md`, `docs/LANCIO.md` (L7, P8), questo report.
