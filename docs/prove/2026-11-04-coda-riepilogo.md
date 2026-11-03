# Coda del 04/11/2026: riepilogo di T12–T16

T12–T16 sono stati eseguiti in sequenza, ognuno da un sotto-agente nuovo nel suo worktree `~/unnivai-notte-<task>`, partito da `origin/main` aggiornato. Le regole della notte sono state passate per esteso a ogni sotto-agente.
- **T12** era già unito (`7795ea8`, PR #28) quando la sessione precedente è stata chiusa. Questa coda ha fatto la chiusura: Vercel READY, § 6 dal sito pubblicato, cancellazione di `.env.local`.
- **Tutti e cinque sono uniti su main**, ognuno con una PR, senza `--admin`. Prima di ogni merge di codice: suite verde, lint 0 errori, build ok, guardia verde. Dopo ogni merge: CI di main verde e Vercel success.
- **Nessuna migrazione applicata, nessun secret scritto, nessun deploy di funzioni.** `openai-proxy` resta alla v48. `create-checkout` non è pubblicata.

## Tabella

| Task | Stato | Commit su main (PR) | Cosa provare su iPhone | Comandi che aspettano Ivano | Costo AI |
|---|---|---|---|---|---|
| T12 CHAT-ACCESSO-VELOCE | **fatto** | `7795ea8` (#28), `a98527c` (#29, esito dal sito) | giro attivo → scheda della tappa → «Chiedi alla guida» (sopra «Riparti»): la chat dice «Focus: <tappa>»; nella panoramica il tasto sta accanto a «Cambia mezzo», mai sopra «Avvia»; in navigazione nessun tasto | nessuno. Una decisione: dire allo scrittore quale scheda è aperta (proposta 1 del report, serve un deploy di openai-proxy) | ≈ 0,81 $ |
| T13 PAGAMENTI-SPENTI | **fatto** | `4eabde0` (#30), `1558b16` (#31, esito dal sito) | Notifiche, Mappa e un giro: nessun importo in euro, nessun «ACCETTA E PAGA» | nessuno | 0 $ |
| T14 AVVISI | **unito, aspetta Ivano** | `6409cb8` (#32) | niente da provare: gli errori dell'app arrivano in `error_logs` (già attivo) | 1) i passi delle altre 3 migrazioni in attesa (lista d'attesa, ospite, elimina account), poi `supabase db push --dry-run` e `supabase db push` (`20261104090000_avvisi.sql`); 2) `supabase functions deploy avvisi --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api`; 3) secret `AVVISI_CHIAVE`, `AVVISI_EMAIL_A` (facoltativi `AVVISI_SOGLIA_COSTO_USD`, `AVVISI_SUPABASE_TOKEN`) e la stessa chiave nel Vault; 4) prova con curl, `modo` `anteprima` poi `riepilogo`. Comandi completi in `2026-11-04-avvisi.md` | 0 $ |
| T15 BANCO-40 | **unito, aspetta Ivano** | `fc93224` (#33) | niente da provare sul telefono | `npm run banco -- --mancanti` per i 20 casi saltati (stima 6–7 $ a listino: decisione sulla spesa), poi `npm run banco -- --replay` e `npm run banco:guardia`; decidere sui difetti trovati | 0,89 $ AI + 8,14 $ Google (listino) |
| T16 TITOLI-RIFINITURA | **fatto** | `02484f6` (#34), `4a797ed` (#35, esito dal sito) | un giro generico senza tema e un «Per Te» dopo le 22: il titolo della card nomina un genere vero (es. «Quattro forni a Roma») | nessuno. Una decisione: i giri generici con un genere chiaro prendono il titolo di genere invece di «Da A a B» (31/10 Ivano aveva scelto «Da A a B»); per tornare indietro basta togliere `titoloDiGenere(stops, citta) \|\|` in `titoloGiro` | ≈ 0,3 $ |
| **Totale** | | | | | **≈ 2,0 $ AI + 8,14 $ Google** |

Il costo Google è il listino delle ricerche del banco dal vivo di T15. Il costo reale è più basso, perché la cache del proxy serve una parte delle ricerche.

## Esito per task

**T12 — CHAT-ACCESSO-VELOCE.**
- **Tasto «Chiedi alla guida»** nella panoramica e nella scheda della tappa. Prova WebKit sul sito pubblicato (profilo iPhone 14, giro di Catania attivo): 2 giri su 2 ok. Aperta dalla scheda, la chat dice «Focus: Fontana dell'Elefante» e manda la tappa giusta col suo `place_id`. Chiusa la chat, la scheda resta aperta.
- **Haiku 4.5 che scrive + Sonnet 5.5 che rivede**, sul banco di 30 domande: circa 3,7 s, ma 3 frasi inventate su 55, sopra la soglia di 1 su 59. Resta l'attuale, Sonnet + Sonnet: 4,75 s di mediana dal telefono, 2 frasi inventate su 87, 0,014 $ a risposta.
- **Dal sito pubblicato:** prima parola in 6,62 s di mediana su 4 domande, misurata dal Mac (una risposta riscritta in 8,4 s, una con le fonti lente a 2,76 s).
- Report: `docs/prove/2026-11-04-chat-accesso-veloce.md`.

**T13 — PAGAMENTI-SPENTI.**
- **Strade verso il pagamento:** 8 trovate, 4 visibili prima (pulsante «ACCETTA E PAGA» e avvisi `price_offer` in Notifiche e DashboardUser; prezzi in euro in mappa, TourLive e scheda tour), 0 dopo. BookingSystem (Stripe) era importato ma mai aperto. Il client non ha né chiavi né librerie Stripe.
- **Interruttore unico:** `PAGAMENTI_ATTIVI = false` in `src/config/pagamenti.js`. `pagamentiVisibili()` è sempre falso nell'app nativa, anche con l'interruttore a true. Il codice non è stato cancellato.
- **Test:** 8 test Vitest nuovi e uno Playwright (2c in `e2e/smoke.spec.ts`). Sul sito pubblicato le rotte toccate non mostrano pagamenti e fanno 0 richieste a stripe.com.
- Report: `docs/prove/2026-11-04-pagamenti-spenti.md`.

**T14 — AVVISI.**
- **Riepilogo ogni mattina alle 7** e avvisi immediati: costo del giorno sopra 15 $ (una volta al giorno), errori del proxy oltre il 5% in un'ora (almeno 20 richieste, una volta per ora).
- **Logica:** funzione pura in `supabase/functions/_shared/avvisi.ts`, con 25 test sulle soglie (14,99 / 15,00 / 15,01 $; 4,9 / 5,0 / 5,1%; zero richieste; nessun doppio avviso) e 6 sugli errori dell'app.
- **Anteprima con i dati veri del 02/11:** 0 giri e 0 chat contati (gli account di prova non hanno contatori), 29 racconti passati, 196 errori del proxy su 2.076 (9,4%, quasi tutti «voce: OpenAI 429»), costo stimato 21,50 $ (Google 20,58 $). Con queste regole quel giorno sarebbero partiti due avvisi.
- **Non provata dal vivo:** la lettura dei log di Supabase. Serve `AVVISI_SUPABASE_TOKEN`.
- Report: `docs/prove/2026-11-04-avvisi.md`.

**T15 — BANCO-40.**
- **Banco:** 40 casi in `scripts/banco/casi-banco40.js`, 5 controlli automatici, riproduzione a 0 $ (`npm run banco -- --replay`: 20 casi su 20 uguali al giro vero, 0 uscite in rete). Il vecchio banco da 18 resta come `npm run banco:nazionale`.
- **Giro dal vivo fermato dal tetto dopo 20 casi su 40:** 16 passano tutti i controlli, 4 hanno difetti. Il tetto era di circa 8 $; la prova di calibrazione (0,96 $), fatta prima di mettere il tetto, ha portato il totale a 9,03 $ a listino.
- **Difetti trovati, non corretti:**
  1. Per Te, in tutti e 4 i casi girati: tappe a più di 1,5 km a piedi l'una dall'altra (Napoli: 4,14 km fra Belvedere San Martino e Terrazza Panoramica).
  2. Per Te a Catania alle 11:30: la sosta a Palazzo dei Chierici finisce dopo la chiusura delle 13:00.
  3. Visti a occhio: `a-matera` ha la città stessa come tappa; `n-troina-2000` ha una sola cena più «Tempo libero» da 0 minuti.
- **Guardia:** home 12/12, pertinenza senza ❌ nuovi, 10 casi del banco su 10.
- Report: `docs/prove/2026-11-04-banco-40.md`.

**T16 — TITOLI-RIFINITURA.**
- **Parole di genere** (forni, barocco, musei, dall'alto, sapori) verificate su nome, tipi di Google e fonti, con una quota minima di tappe. Solo client (`src/lib/titoliGiro.js`), nessun deploy di funzione.
- **«Da A a B» sui 54 titoli registrati:** 21 (39%) prima, 8 (14,8%) dopo. 0 titoli falsi, letti a mano contro le tappe. 15 test nuovi.
- **Sul sito pubblicato:** «Dove si mangia a Roma» su quattro forni diventa «Quattro forni a Roma»; «Cultura a Roma» diventa «Quattro musei a Roma».
- **Collaudo** `collaudo-sito.webkit.mjs`: tutti i punti ok tranne il 7 da ospite, come il 31/10 e il 02/11 (accessi anonimi spenti, P10).
- Report: `docs/prove/2026-11-04-titoli-rifinitura.md`.

## LANCIO

`docs/LANCIO.md`: **10 su 22 fatte** (era 8 su 21 la sera del 03/11).
- **Nuova voce:** L12 PAGAMENTI-SPENTI, aggiunta da T13 e subito «fatta».
- **Diventata «fatta»:** P7 TITOLI-RIFINITURA.
- **P9 CHAT-VERITA** era già «fatta»; T12 ha aggiunto le sue prove.
- **Passate da «da fare» ad «aspetta Ivano»:** L6 (avvisi: migrazione, deploy, secret) e L7 (banco: 20 casi da girare dal vivo).

## Cosa NON risolve

- **La chat:** la prima parola resta sopra i 4 s, e lo scrittore non sa quale scheda è aperta.
- **Avvisi:** non partono finché Ivano non applica migrazione, deploy e secret. I costi restano stime: traduttore, selettore e liste non sono contati per chiamata.
- **Banco:** metà dei casi non è ancora stata girata dal vivo, e il caso «ospite» usa l'account di prova, non uno anonimo.
- **Pagamenti:** l'interruttore è solo nel client. Prima di pubblicare `create-checkout` in V2 serve un controllo anche nella funzione.
- **Titoli:** i titoli di sola atmosfera («Riflessi di Catania») restano «Da A a B». «Barocco» è provato solo dai test.
- **Pulizia:** in `~/unnivai-notte-t12` resta un `.env` non tracciato, con il solo URL di Supabase e la chiave anonima pubblica: la cancellazione automatica è stata negata dai permessi. I worktree `~/unnivai-notte-t12`, `-t12-sito`, `-t13`, `-t14` e `-t15` hanno i rami uniti e si possono rimuovere.
