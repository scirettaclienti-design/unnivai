# Notte del 31/10: riepilogo T0–T3

Quattro lavori, ognuno fatto da un sotto-agente nuovo (Sonnet) su un ramo `notte/…`. Ognuno ha la sua pull request verso main: tutte pronte, nessuna unita, nessuna in bozza. Stanotte nessun deploy, nessuna migrazione, nessun secret e nessuna chiamata a pagamento. Le prove sono test, il replay del banco e simulazioni locali.

Ogni ramo è passato da suite verde, lint con 0 errori, build ok e `npm run banco:guardia` 12/12, tutto in locale. Su GitHub la CI (Lint & Test, E2E Smoke) è verde per #2, #3 e #4; quando ho scritto questo file era ancora in corso per #5.

## Tabella

| Task | Stato | PR | Cosa provare dal vivo | Cosa aspetta Ivano |
|---|---|---|---|---|
| T0 CLAUDE-MD | pronta | [#2](https://github.com/scirettaclienti-design/unnivai/pull/2) | Niente, è solo documentazione. | Rivedere e unire. La regola sul collaudo non dice quali punti di `collaudo-sito.webkit.mjs` vanno con quale task: ogni task li sceglie da sé. |
| T1 PER-TE-PROPOSTE | pronta | [#3](https://github.com/scirettaclienti-design/unnivai/pull/3) | Per Te a Roma di notte (00–05), di sera (18–23) e alle 13. Almeno 4 card, quelle non fattibili con «Per domattina» o «Per stamattina», nessun ristorante nelle card per domattina. Passi esatti in `2026-10-31-per-te-proposte.md`. | 1) Di sera la Home fa 4 ricerche Places in più (~0,03 $ l'una se non sono in cache): va bene? 2) Le card per dopo usano frasi composte dal codice: le vuoi raccontate dall'AI (una chiamata in più)? 3) L'ora «per dopo» è fissa alle 10:00: oppure le 9:00? |
| T2 VERITA-SCHEDE | pronta, da unire dopo #3 | [#4](https://github.com/scirettaclienti-design/unnivai/pull/4) | Schede luogo a Catania e a Roma: i cenni sono il racconto r5 passato oppure niente, e la voce legge lo stesso testo. Alla prima apertura la scheda può aspettare il racconto fino a 45 s. | 1) Tenere la curiosità di Roma «più di duemila fontanelle»? È legata alla città, non alle fonti di una tappa. 2) La chat libera con la guida può ancora dire fatti non verificati: non toccata. 3) Le schede senza fonti restano senza cenni: è voluto. |
| T3 TESTI-SCHEDE | pronta, da unire dopo #3 e #4 | [#5](https://github.com/scirettaclienti-design/unnivai/pull/5) | Una lista Per Te vera, di giorno e di sera. Guardare i titoli «Da A a B» (fino a 90 caratteri, 2 righe), le card per domattina senza frasi ripetute, «Roma» da sola nella riga del luogo. | 1) Nelle frasi «alla Piazza…», «alla Via Etnea» (come nei testi d'arrivo); nei titoli piazze, vie, ville e lungomari senza articolo («Da Piazza Navona…», «Da Lungomare di Acicastello…»). 2) Leggere le frasi di scorta nuove. 3) Titoli senza aggettivi: si perdono titoli come «Roma dall'alto». 4) I giri di più giorni hanno ancora i titoli di prima. |

## Ordine di merge

1. **#2** (solo CLAUDE.md): indipendente, si unisce quando vuoi.
2. **#3**, poi **#4**, poi **#5**. #4 contiene i commit di #3 e #5 contiene quelli di #3 e #4, perché toccano gli stessi file (`aiRecommendationService.js`, `DashboardUser.jsx`). Unite in ordine non danno conflitti. Prima di ogni merge: `git fetch`, rebase su `origin/main` e `npm run banco:guardia`, come da CLAUDE.md.
3. Questa PR del riepilogo, quando vuoi.

Deploy: nessuna delle quattro tocca `supabase/functions`. Basta il merge (il sito si aggiorna da main).

## Numeri

| Task | Suite | Lint | Build | banco:guardia |
|---|---|---|---|---|
| T0 | 237 file, 2926 test verdi | 0 errori | ok | 12/12 |
| T1 | 238 file, 2937 test verdi (11 nuovi) | 0 errori | ok | 12/12, nessun ❌ nuovo |
| T2 | 239 file, 2944 test verdi (7 nuovi) | 0 errori | ok | 12/12 |
| T3 | 241 file, 2992 test verdi | 0 errori | ok | 12/12, nessun ❌ nuovo |

T1: nel replay dei pool veri del 15/10 a Catania Per Te passa da 3 a 4 giri, a Troina da 1 a 2. Le prove alle 01:00, 13:00 e 20:00 sono simulazioni con pool finti di Roma, non misure.

T3: nel replay le frasi ripetute nelle liste Per Te passano da 7 a 0. Il test sui titoli copre i 136 giri registrati in `docs/prove/dati/`.

## Da tenere d'occhio

- **T2: costo dei racconti.** Prima la scheda faceva una chiamata a gpt-4o-mini senza fonti. Ora chiede un racconto r5 per ogni luogo (Sonnet + revisore, circa 0,009 $ quando va scritto). Le chiamate restano limitate: al massimo 5 luoghi in `getCityActivities`, solo le tappe vuote di un giro, una scheda alla volta. I racconti già scritti vengono riletti da `place_racconti` (30 giorni) e c'è il tetto `RACCONTO_DAILY_CAP` (300). Conviene guardare la spesa del primo giorno dopo il merge.
- **T1: «almeno 4» vale solo se i pool hanno abbastanza posti.** Con pool sottili, come Troina, ne escono meno: 2 nel replay.
- **T1: restano aperte le correzioni 1, 2 e 5 di `2026-10-28-per-te-diagnosi.md`** (tasto «Fine», conteggio dei giri, banner della posizione).
- **Dopo ogni merge che tocca Per Te o le schede:** ripetere i punti di `scripts/prova-nav/collaudo-sito.webkit.mjs` che riguardano quel task (regola nuova di CLAUDE.md, PR #2). Va fatto dal Mac con le credenziali di prova, che stanotte non c'erano.
