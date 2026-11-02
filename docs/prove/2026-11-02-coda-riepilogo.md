# Coda del 02/11/2026: riepilogo di T4–T6

T4, T5 e T6 sono stati eseguiti in sequenza, ognuno da un sotto-agente nel suo worktree `~/unnivai-notte-<task>`, partito da `origin/main` aggiornato. I tre task sono **uniti su main**.

Per ogni merge:
- prima: suite verde, lint 0 errori, build ok, `banco:guardia` 12/12 senza ❌ nuovi;
- dopo: CI verde e Vercel pronto.

`.env.local` è stato cancellato alla fine di ogni task. I tre worktree sono stati rimossi perché puliti e uniti.

## Tabella

| Task | Stato | Commit su main (PR) | openai-proxy | Cosa provare su iPhone | Comandi che aspettano Ivano | Costo AI |
|---|---|---|---|---|---|---|
| T4 RACCONTO-FONTI | unito | `d9de53d`, `bd32e7c`, `5d14ed5` (#7) | v40 (da `bd32e7c`) | In un giro a Troina o a Roma: scheda di Torre Capitania, Chiesa Madre, Terrazza delle Quadrighe o Galleria Colonna. Play sul racconto: deve partire la voce. | nessuno | 0,1542 $ |
| T5 REVISORE-FORTE | unito (solo misura) | `b8b859b` (#8) | invariata | niente: in produzione non cambia nulla finché non cambia il secret | `supabase secrets set ANTHROPIC_MODEL_REVISORE=claude-sonnet-5-5 --project-ref ahecpiwsdhghkndncejb` (per tornare indietro: `supabase secrets unset ANTHROPIC_MODEL_REVISORE --project-ref ahecpiwsdhghkndncejb`) | 1,51 $ |
| T6 CURIOSITA-QUARTIERI | unito | `d54cd11` (#9), `b259f5a` (#10), `eda9b67` (#11), `89415a4` (#12) | v43 (da `eda9b67`); v41 e v42 intermedie | 20–30 minuti a piedi in un rione con la voce Marin. La prima curiosità esce dopo circa 300 m, la seconda non prima di 10 minuti; nessuna a ridosso di una svolta; si deve sentire col telefono in tasca. | nessuno | 0,168 $ |
| **Totale** | | | | | | **1,83 $** |

Costi misurati:
- T4: `costoUsd` delle risposte del proxy, confrontato con `place_racconti`.
- T5: token reali di 678 chiamate al listino di `banco.config.json`.
- T6: `place_racconti.costo_usd`, 16 curiosità di cui 13 passate.

Il collaudo non è costato nulla, perché ha letto dalla cache.

## Esito per task

**T4: le fonti che la ricerca per nome non trovava.** La ricerca allargata scatta quando una tappa ha meno di 200 caratteri di fonte. Prova, in quest'ordine:
- la voce intera;
- una voce entro 200 m con lo stesso nome proprio;
- le frasi che nominano la tappa in una voce vicina o in quella della città.

Wikidata non aggiungeva fonti ed è rimasto fuori. Soglia, prompt, controlli e revisore sono invariati.

Sulle 23 tappe di RACCONTO-R4:
- **tappe con fonti: 14 prima, 21 dopo**;
- **racconti passati: 19**, contro 14 del lancio migliore di r5;
- la r7 corregge il Monte Muganà: con la r6 una frase su una fattoria del 6000 a.C. finiva «sotto i tuoi piedi».

Collaudo punto 5: 10/10.

Restano senza racconto:
- Giardino di Sant'Alessio: nessuna voce lo descrive;
- Monte Muganà: 97 caratteri di fonte;
- Galleria del Cardinale Colonna: è un'altra scheda Google, e scegliere fra le due gallerie dei Colonna sarebbe un'ipotesi;
- Roseto: scartato per le frasi in più, si riprova dopo 7 giorni.

**T5: revisore Haiku 4.5 contro Sonnet 5.5.** Gli stessi 99 testi con le stesse fonti, 3 lanci per modello, il prompt del revisore di produzione.

| | falsi «sì» | falsi «no» | resa | $ per lettura | s per lettura (media / p95) |
|---|---|---|---|---|---|
| Haiku 4.5 | 12/21 | 21/156 | 73% | 0,00145 | 1,82 / 2,66 |
| Sonnet 5.5 | 4/21 | 0/156 | 85% | 0,00295 | 2,41 / 5,38 |

Sui casi noti:
- «il piazzale dove sei»: Haiku lo lascia passare, Sonnet lo boccia 3 volte su 3;
- «l'ha messa Vaccarini»: Haiku 3 su 3, Sonnet 1 su 3;
- «statua romana»: Haiku la boccia 12 volte su 12, Sonnet mai.

Raccomandazione del sotto-agente: Sonnet 5.5. Il costo del racconto passa da circa 0,0089 a circa 0,0108 $ (+21%), il tempo sale di circa 0,6 s.

**La decisione resta a te.** La misura è passata dal proxy con `purpose: 'aux'`, non dal percorso `racconto`: dopo il secret va riconfermato su un racconto vero, guardando il log. «Sopra ci sono personaggi mitologici» passa con tutti e due i modelli. Il report completo è `docs/prove/2026-11-02-revisore-forte.md`.

**T6: curiosità del cammino.** Camminando fra le tappe esce una curiosità della via o del quartiere. La fonte è la voce Wikipedia trovata col geosearch vicino alla posizione, verificata per nome o coordinate. Riusa prompt, controlli, revisore e cache `place_racconti` (chiave `curiosita-itwiki-<pageid>`): nessuna migrazione, nessun secret. Via e quartiere li chiede il telefono a Nominatim, perché dal server Nominatim risponde 403. La frase fissa delle fontanelle è tolta: Trastevere e Monti hanno le loro curiosità verificate.

Prova WebKit con GPS finto in movimento:

| Giro | Cammino | Curiosità | Minuti fra una e l'altra |
|---|---|---|---|
| Trastevere | 49 min | 3 | 10,2 · 10,8 |
| Monti | 50 min | 3 | 12,2 · 10,3 |
| Catania centro | 54 min | 4 | 16,7 · 10,2 · 10,2 |

- 0 curiosità ripetute;
- 0 sovrapposizioni con le 69 frasi di navigazione;
- nelle 10 curiosità lette a mano, 0 fatti fuori dalle fonti.

Collaudo: punti 1, 2, 3, 4 (riscritto per la curiosità del cammino) e 5 tutti ✓.

Durante T6 la v41 e la v42 sono state pubblicate e poi superate. Con la v41 le richieste di curiosità rispondevano 503 `CURIOSITA_FONTI`: il servizio non c'era ancora, ma racconti e giri continuavano a funzionare. La v43 è quella attiva.

## Cosa NON risolve

- **Revisore**: le invenzioni di posizione passano ancora finché il secret di T5 resta com'è. Anche con Sonnet qualcuna passa.
- **Nominatim**: la posizione viene chiesta dal telefono a ogni richiesta. Con molti utenti serve un altro geocoder.
- **Curiosità a elenco**: nessun controllo le vede (caso: Centro Storico di Catania).
- **Controllo «vi»**: ha scartato due curiosità vere, Via della Lungara e Via Vittorio Emanuele II. Correggerlo è una tua decisione, descritta nel report di T6.
- **Durata delle frasi**: nella prova di T6 è stimata a 14 caratteri al secondo. Il distacco con la voce vera va visto su iPhone.
- **Righe sovrascritte**: quando un «senza fonti» sostituisce un racconto, la riga di `place_racconti` tiene `costo_usd`, `modello` e `verifica` del racconto di prima. La proposta di correzione è nel report di T4.
- **Voce umana**: il credito OpenAI è ancora finito, quindi in navigazione parla la voce del telefono.
- **Nota di processo (T5)**: il sotto-agente ha provato `gh pr merge --admin`, che è stato negato. Poi ha unito con un fast-forward normale dopo il rebase, senza scavalcare protezioni.

## Report dei task

- `docs/prove/2026-11-02-racconto-fonti.md`
- `docs/prove/2026-11-02-revisore-forte.md`
- `docs/prove/2026-11-02-curiosita-quartieri.md`
