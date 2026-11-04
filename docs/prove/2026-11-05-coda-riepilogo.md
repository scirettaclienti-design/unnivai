# Coda del 05/11/2026: riepilogo di T17–T21 (+ T22)

T17–T21 sono stati eseguiti in sequenza, ognuno da un sotto-agente nuovo nel suo worktree `~/unnivai-notte-<task>`, partito da `origin/main` aggiornato. Le regole della notte sono state passate per esteso a ogni sotto-agente. Dopo T21 è stato eseguito anche **T22 VOCE-TEST**, ordinato da Ivano durante la coda; è stato messo dopo T21 perché tocca `openai-proxy` come T20.
- **Tutti sono uniti su main**, ognuno con una PR, senza `--admin`. Prima di ogni merge: suite verde, lint 0 errori, build ok, `banco:guardia` ok. Dopo ogni merge: CI di main verde e commit status Vercel success (verificati dal coordinatore su ogni commit di merge).
- **Nessuna migrazione applicata, nessun secret scritto.**
- **Un solo deploy di funzioni:** `openai-proxy` v48 → **v49** da T20 (commit `0709f53`), con il collaudo subito dopo. T22 ha unito il codice della voce ma **non** l'ha pubblicato (aspetta il «sì» di Ivano).
- **T19 si è fermato una volta** per una caduta della connessione all'API (ENOTFOUND). È ripartito dallo stesso punto, con lo stesso tetto.
- **T18 ha provato a copiare `~/unnivai-1b/.env`**, che le regole escludono (si copia solo `.env.local`). Il sistema ha bloccato la copia e il task ha usato URL e chiave anon pubblici di Supabase. Da T19 il divieto è scritto per esteso nelle istruzioni.

## Tabella

| Task | Stato | Commit su main (PR) | Cosa provare su iPhone | Comandi che aspettano Ivano | Costo (listino) |
|---|---|---|---|---|---|
| T17 SEGRETI-STORIA | **unito, aspetta Ivano** | `a2e6bd6` (#37) | niente | ruotare 3 chiavi dalle console (ordine e pannelli in `2026-11-05-segreti-storia.md`): 1) Google Maps …kQgM (valida, nel sito e nella storia, non risulta limitata per sito) → chiave nuova con restrizione referrer, `VITE_GOOGLE_MAPS_API_KEY` su Vercel, nuovo deploy; 2) Mapbox pk …QIdA (valida, senza restrizioni) → eliminarla; 3) Anthropic …UQAa (risponde già 401) → confermare la revoca. Poi una riga in L10 con la data | 0 $ AI + ≈ 0,02 $ Google |
| T18 BANCO-COMPLETO | **fatto** | `e8364ea` (#38) | niente | nessuno | 4,27 $ (AI 0,69 + Google 3,58) |
| T19 BANCO-DIFETTI | **fatto in parte** | `f6760b3` (#39) | Per Te a Napoli o Palermo: tappe vicine; Crea alle 20 a Catania: «Tempo libero 21:15–22:30» | nessun comando. Decisioni: le tre regole di D5; un controllo automatico per D6; rifare dal vivo i 15 casi cambiati (≈ 3 $, comando nel report) | 1,72 $ (AI 0,43 + Google 1,29) |
| T20 CHAT-FOCUS-FONTI | **fatto, obiettivo dei 4 s non raggiunto** | `0709f53` (#40), `d4b00c4` (#41, misura dopo il deploy) | giro attivo → scheda di una tappa → «Chiedi alla guida» → «cosa c'è qui?», «quanto ci resto?», «è aperto?»: risponde su quella tappa, in alto «Focus: <tappa>» | nessuno. Decisione: per scendere sotto i 4 s, un modello più veloce o la risposta a pezzi | ≈ 0,5 $ AI + ≈ 0 $ Google |
| T21 DNA-5 | **fatto** | `8b1029c` (#42) | Profilo → «Come giri» → «Con bambini» → Salva: Per Te si rigenera e il dettaglio di un tour dice «In famiglia: l'hai scelto nel Profilo.»; dopo 2 giri finiti con «Sono arrivato» il riquadro DNA dice la sosta media vera | nessuno (nessuna migrazione: i dati stanno in `dna_events.value`) | 0 $ |
| T22 VOCE-TEST | **unito, aspetta Ivano** | `44936a4` (#43), `3317ee8` (#44, esito del collaudo) | col tuo account la voce resta marin/cedar; con l'account di prova, dopo secret e deploy, parla il telefono senza errori a schermo | 1) `supabase secrets set VOCE_TELEFONO_USER_IDS=<id completo cee972ab-…> --project-ref ahecpiwsdhghkndncejb` (non mettere 813d9dc6-…); 2) da worktree su main aggiornato `supabase functions deploy openai-proxy --project-ref ahecpiwsdhghkndncejb --use-api`; 3) prova con l'account di prova senza l'opzione (nessuna riga «voce:» nei log), poi `node scripts/prova-nav/collaudo-sito.webkit.mjs` | ≈ 0 $ di voce; generazioni del collaudo < 2 $ (non misurate al centesimo) |
| **Totale** | | | | | **≈ 1,6 $ AI + ≈ 4,9 $ Google** (+ le generazioni del collaudo di T22, < 2 $) |

## Esito per task

**T17 — SEGRETI-STORIA.**
- **Cosa è stato scansionato:** la storia con gitleaks (582 commit, 160 riferimenti), più una ricerca mirata in `git log -p --all` e nei 184 file JS del sito pubblicato.
- **Chiavi trovate:**
  - nessuna `service_role`, nessuna chiave OpenAI, Resend, Stripe, Vercel o GitHub;
  - la chiave anon di Supabase (…Cy_U) è pubblica per natura;
  - 3 chiavi da ruotare (tabella sopra).
- **Restrizioni delle chiavi:** vanno controllate nelle console. La chiave Google risponde anche con un Referer estraneo.
- Report: `docs/prove/2026-11-05-segreti-storia.md`. Il report non contiene nessun segreto intero.

**T18 — BANCO-COMPLETO.**
- **Casi:** 40 su 40 girati dal vivo, 0 errori. 35 passano i cinque controlli.
- **Riproduzione a 0 $:** 40 su 40 uguali al giro vero.
- **Costo:** il banco intero è costato 13,30 $ (9,03 $ di T15 + 4,27 $ di T18). Il tetto di T18 (9 $) non è stato toccato.
- **Difetti:** 9, senza doppioni, da D1 a D9. D1 blocca il lancio: tappe Per Te a più di 1,5 km a piedi.
- **Limite:** 86 luoghi su 368 non hanno orari di Google.
- Report: `docs/prove/2026-11-05-banco-completo.md`.

**T19 — BANCO-DIFETTI.**
- **Chiusi:** D1, D2, D3, D4, D5. Il tetto è 1,2 km a piedi fra due tappe consecutive, in Per Te e in Crea.
  - D2: il motore era giusto, sbagliava il banco.
  - D5: tre decisioni prese da T19, rivedibili da Ivano.
- **D8, in parte:** la città e il municipio non sono più tappe; la fermata «Colosseo» resta.
- **Aperti:** D6 (richiesta specifica ignorata), D7 (tempo libero oltre 2 ore, passato da 5 a 8 casi per effetto del tetto), D9.
- **Riproduzione dei 40 casi a 0 $:** prima 35 su 40 con tutti i controlli, ora 40 su 40.
- **10 casi rifatti dal vivo, tutti ok.** Il tratto più lungo è sceso, ad esempio in `n-napoli-ospite-1300` da 4,14 km a 0,82 km.
- **15 casi hanno itinerari diversi da quelli registrati:** `npm run banco -- --replay` esce con 1 finché non si rifanno dal vivo.
- **Per Te** può mostrare meno tour: a Napoli alle 13 erano 3, ora 2.
- Report: `docs/prove/2026-11-05-banco-difetti.md`.

**T20 — CHAT-FOCUS-FONTI.**
- **Cosa cambia:** lo scrittore riceve la scheda aperta (chat c2). All'avvio del giro le fonti delle tappe si preparano in memoria, senza AI. Revisore e regole sui fatti sono invariati. `openai-proxy` è passato a v49; collaudo ok, tranne il 7 da ospite (accessi anonimi spenti, come sempre).
- **Misure sulle 10 domande (WebKit iPhone 14, giro di Catania):**

  | | Prima | Dopo |
  |---|---|---|
  | Prima parola, mediana | 4,84 s | 4,86 s |
  | Invenzioni certe | 0 | 0 |
  | Frasi dubbie | 1 | 2 |
  | Tappa giusta sulle domande vaghe | 5/5 | 5/5 |

- **Il banco non distingue:** in navigazione la scheda aperta è la prossima tappa, già nota al proxy.
- **Dove va il tempo:** scrittore + revisore ≈ 3,3 s. La precarica toglie solo il caso a freddo (1,9–2,7 s).
- **Fix collaterale:** timeout di `c10b2.test.js` portato a 20 s (sul runner di CI andava oltre i 5 s).
- **Memoria delle fonti:** dura un'ora ed è per istanza della funzione.
- Report: `docs/prove/2026-11-05-chat-focus-fonti.md`.

**T21 — DNA-5.**
- **Cosa impara il DNA:**
  - il ritmo, da km e soste scritti in `stop_reached` sugli ultimi 5 giri;
  - la compagnia, nell'ordine: testo, Gruppo, Profilo, scelte passate.
- **Cosa resta fisso:** ritmo e compagnia salvati nel Profilo («Come giri») vincono su quelli imparati. Il tetto di 1,2 km non cambia per nessun ritmo.
- **Per Te** è ordinato sulle categorie delle tappe vere; prima il punteggio era 0 per tutti.
- **Riquadro DNA:** dice un fatto vero dai giri, oppure una riga onesta se i dati non bastano.
- **Tre utenti finti, rigiocati a 0 $:**

  | | Crea `a-roma` | Musei in Per Te |
  |---|---|---|
  | Neutro | 9 tappe, 3,94 km | — |
  | A, lento e culturale | 8 tappe, 3,18 km | 80 min |
  | B, veloce | 12 tappe, 6,54 km | 40 min |
  | C, famiglia | 11 tappe, 6,19 km | 70 min |

- **Da guardare:** la famiglia cammina più del giro neutro. Il giro resta di monumenti, perché la compagnia non cambia le ricerche di Google; la proposta «parco giochi gelateria» è nel report.
- **I giri finiti prima di DNA-5** non hanno km né soste: il ritmo si impara dai prossimi.
- Report: `docs/prove/2026-11-05-dna-5.md`.

**T22 — VOCE-TEST** (ordine di Ivano aggiunto alla coda).
- **Misura dei 7 giorni (28/10–04/11):** 283 audio in `voce_uso`.
  - Nei log: account di prova 255 richieste (quasi tutte 429), account di Ivano 8 (tutte errori), ospiti e altri 0 visti.
  - Spesa voce sotto 1 $, stima per eccesso.
  - I log tengono solo una parte delle righe «voce: nuova».
- **Server:** gli id in `VOCE_TELEFONO_USER_IDS` ricevono `{usaVoceTelefono: true}` senza chiamare OpenAI. Senza secret si comporta come oggi.
- **App:** ripiega sulla voce del telefono senza errori. Funziona col proxy v49 e col nuovo.
- **Script di prova:** 26 script WebKit, collaudo compreso, chiedono sempre la voce del telefono. Fa eccezione `voce.webkit.mjs`; `VOCE_VERA=1` spegne l'opzione.
- **Collaudo rilanciato dopo il merge:** 0 richieste di voce OpenAI nella finestra.
- **Prova lato server dal sito:** resta da fare dopo secret e deploy.
- Report: `docs/prove/2026-11-05-voce-test.md`.

## LANCIO

`docs/LANCIO.md`: **12 su 22 fatte** (era 10 su 22 la sera del 04/11).
- **Diventate «fatte»:** L7 (banco 40 casi, T18) e P8 (DNA-5, T21).
- **Aggiornate:**
  - L10, con la lista delle chiavi da ruotare (T17);
  - L7, coi difetti chiusi e aperti (T19);
  - P9, con la scheda aperta e la misura (T20);
  - P5, con la voce del telefono per le prove (T22).
- **Restano «aspetta Ivano»:** P5, P10, L2, L3, L5, L6, L9, L10.
- **Restano «da fare»:** L8, L11.

## Cosa NON risolve

- **Chiavi:** le tre chiavi restano valide finché Ivano non le ruota. Google è la più esposta: è nel bundle del sito e, dalle prove, non risulta limitata per sito.
- **Chat:** la prima parola resta sopra i 4 s (4,86 s di mediana).
- **Banco:** D6, D7 e D9 aperti, D8 in parte. 15 casi del banco vanno rifatti dal vivo perché `--replay` torni a uscire con 0.
- **DNA:** la compagnia non cambia le ricerche, e la famiglia cammina più del giro neutro.
- **Voce:**
  - finché secret e deploy non ci sono, l'account di prova senza l'opzione usa ancora la voce OpenAI;
  - il credito OpenAI per gli utenti veri resta finito (P5).
- **Pulizia:** i worktree `~/unnivai-notte-t17`, `-t18`, `-t19`, `-t20`, `-t20-deploy`, `-t21`, `-t22` hanno i rami uniti e si possono rimuovere, come quelli della coda del 04/11. In nessuno resta `.env.local` (verificato con `ls`).
