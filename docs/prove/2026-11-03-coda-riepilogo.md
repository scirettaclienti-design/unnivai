# Coda del 03/11/2026: riepilogo di T7–T11

T7–T11 sono stati eseguiti in sequenza, ognuno da un sotto-agente nuovo nel suo worktree `~/unnivai-notte-<task>`, partito da `origin/main` aggiornato. Le regole della notte sono state passate per esteso a ogni sotto-agente.
- **T7**, su indicazione di Ivano, è stato ridotto: il codice era già su main dal 02/11 (`bf6983e`), quindi il sotto-agente ha fatto deploy, verifica e misura.
- **Tutti e cinque sono uniti su main.** Ogni merge è passato da guardia 12/12 senza ❌ nuovi, CI verde e Vercel READY. Nessuna migrazione applicata, nessun secret scritto.
- **`openai-proxy` è passato da v44 a v48:** v45 e v46 con T7, v47 e v48 con T10. Dopo ogni deploy il collaudo completo è uguale al 31/10: punti 1–6 e 8–13 ok, il 7 cade solo da ospite perché gli accessi anonimi sono spenti, come atteso.

## Tabella

| Task | Stato | Commit su main (PR) | Cosa provare su iPhone | Comandi che aspettano Ivano | Costo AI |
|---|---|---|---|---|---|
| T7 CHAT-VERITA | **fatto** | `bf6983e` (#15, 02/11), `85460eb` (#16), `c27e171` (#17), `f563604` (#18); openai-proxy **v46** | mappa **senza** giro a Catania → badge del meteo → «Cosa c'è in piazza del Duomo?»: «Controllo le fonti…», risposta, «Fonti lette:» | nessuno. Una decisione: un tasto «Chiedi alla guida» nella panoramica e in navigazione (oggi con un giro sulla mappa il badge del meteo sparisce e la chat non si apre) | 0,445 $ |
| T8 ACCOUNT-PRIVACY | **unito, aspetta Ivano** | `1d48507` (#19), `7e11dd2` (#20) | account nuovo → schermata del consenso AI; Profilo → Privacy, Termini, Elimina account | `supabase db push --dry-run`, poi `supabase db push` (`20261103010000_elimina_account.sql`, insieme a `20261102200000_ospite_giro.sql` se non ancora applicata); `supabase functions deploy elimina-account --project-ref ahecpiwsdhghkndncejb --use-api`; prova con un account usa e getta; compilare i segnaposto (`SEGNAPOSTO` in `src/lib/testiAccount.js`); lettura di un legale | 0 $ |
| T9 BRAND-UNNIVAI | **fatto** | `065161b` (#21), `e7c3fc8` (solo documentazione, spinto senza PR; CI verde) | «Unnivai» nel caricamento e nel Login; barra in basso solo Home, Esplora, Profilo; nessun «Presto» o «Guide»; Profilo senza «Vedi tutte» sulle foto | `supabase functions deploy create-checkout --project-ref ahecpiwsdhghkndncejb --use-api` (nome «Tour Unnivai» nel checkout Stripe); nome su App Store Connect | 0 $ |
| T10 GEOCODING-LANCIO | **fatto** | `9a69457`, `81cacb8`, `3a18891`, `76e3f61`; openai-proxy **v48** | 5–10 minuti a piedi a Trastevere o a Catania centro con la voce accesa: la prima curiosità dopo circa 300 m | nessuno. Due decisioni facoltative: la memoria condivisa (oggi tiene solo le voci di Wikipedia, non i nomi di Google, per le condizioni d'uso 6.3.2) e passare `CityContext` da Nominatim a Google | 0,0475 $ |
| T11 APP-NATIVA | **unito, aspetta Ivano: Xcode** | `31c9c75` (#25), `b1cb3d0` (#26) | un giro vero col telefono in tasca e la voce accesa: indicatore blu, svolte, frase d'arrivo, curiosità a schermo bloccato, musica che si abbassa e torna (procedura al punto 2 del report) | installare Xcode, poi `bash scripts/ios/prova-simulatore.sh`; account demo: `DEMO_EMAIL=… DEMO_PASSWORD=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/ios/account-demo.mjs --crea` poi `--controlla` (deve dare 1), credenziali e Notes for Review (testo inglese nel report) in App Store Connect; approvare l'icona proposta | 0 $ |
| **Totale** | | | | | **0,49 $** |

Il costo comprende le chiamate AI dei task. Non comprende le generazioni dei collaudi, fatte con l'account di prova senza contatori.

## Esito per task

**T7 — CHAT-VERITA.** Prima del task il proxy pubblicato era la v44 e la chat del sito rispondeva 400 «Model not allowed».
- **Deploy:** v45 da `bf6983e`, poi v46 da `85460eb`. La v46 ha gli 11 file uguali a main.
- **Correzioni** (PR #16):
  - fuori dalla navigazione la guida diceva «è la tua prossima tappa», perché il server leggeva `prossima: null` come 0;
  - senza giro il telefono non mandava il centro, quindi il server non cercava i luoghi nominati nella domanda.
- **Dal vero** (20 domande del banco, misurate dal telefono):
  - prima parola: mediana 5,5 s, p90 10,2 s, 3 risposte su 20 sotto i 4 s. È più lento del banco del 02/11 (4,06 s sul server) perché in produzione anche il revisore è Sonnet 5.5 (riga P4);
  - frasi inventate: 9 su 62 sulla v45, **1 su 59** dopo la correzione;
  - costo: 0,014 $ a risposta.
- **OSPITE-GIRO** è nel codice pubblicato, ma non scatta: gli accessi anonimi sono spenti (signInAnonymously risponde 422).
- Tutto nel § 9 di `docs/prove/2026-11-02-chat-verita.md`.

**T8 — ACCOUNT-PRIVACY.**
- **Elimina account** nel Profilo: si scrive «elimina» e parte la funzione `elimina-account`, che cancella in ordine dati, file e utente, solo per l'utente del token. Finché la funzione non è pubblicata, il tasto dice «non ho cancellato niente»: provato dal vivo.
- **Migrazione** `20261103010000_elimina_account.sql`: su Postgres 17 in Docker dà zero righe dell'utente, un altro utente intatto, ed è ripetibile.
- **`/privacy` e `/termini`**: pubbliche (200 sul sito), con «Bozza da far verificare a un legale» e 18 flussi di dati ricavati dal codice; segnaposto da compilare.
- **Consenso AI di terzi** alla prima apertura (Anthropic, OpenAI): senza «Va bene» non parte nessuna richiesta a openai-proxy, e lo dice. Il consenso sta in `user_metadata` più una copia sul telefono: nessuna migrazione.
- Report: `docs/prove/2026-11-03-account-privacy.md`.

**T9 — BRAND-UNNIVAI.**
- **Nome:** il nome vecchio nel testo visibile scende da 35 occorrenze (27 file) a 0. Il sito serve `<title>Unnivai | …`; Login e Landing dicono «UNNIVAI».
- **Prossimamente nell'app nativa:** dietro `isAppNativa()` spariscono Foto, il link della Landing e la card Guide; `/prossimamente/*`, `/become-guide`, guide/business, `/photos` e `/trending` portano alla home. Sul web non cambia niente.
- **Script di prova:** ora accettano `/Unnivai|DoveVai/i`, e CLAUDE.md è aggiornato.
- Report: `docs/prove/2026-11-03-brand-unnivai.md`.

**T10 — GEOCODING-LANCIO.**
- **Come funziona ora:** via e quartiere arrivano da Google Geocoding chiamato da openai-proxy, con una memoria per celle di circa 100 m in `places_cache` (7 giorni, senza migrazione). Photon e Nominatim restano solo come riserva.
- **Richieste esterne** su 18 richieste di curiosità:

  | | Nominatim | Photon | Google | Wikipedia |
  |---|---|---|---|---|
  | prima | 18 | — | — | 71 |
  | dopo, primo utente | 0 | 4 | 17 | 74 |
  | dopo, secondo utente sugli stessi giri | — | 1 | 3 | 14 |

- **Curiosità:** uguali a prima, 2 a Trastevere e 5 a Catania.
- **Costo:** 0 $ fino a circa 1.750 giri al mese, poi circa 28 $ ogni 1.000 giri a freddo, circa 5 $ con la memoria.
- Report: `docs/prove/2026-11-03-geocoding-lancio.md`.

**T11 — APP-NATIVA.** Su questo Mac non c'è Xcode, quindi niente simulatore né iPhone.
- **Swift:** sintassi ok su 5 file; controllo dei tipi dei 3 file nuovi compilati per Mac Catalyst (iOS 15 e 17) con uno stub delle firme di Capacitor.
- **Posizione in background:** plugin locale `PosizioneGiro`, che chiede solo «Durante l'uso». Scartato `@capacitor-community/background-geolocation` 1.3.1, che chiede «Sempre».
- **Voce di ripiego:** nell'app la dice il telefono (`VoceNativa`, AVSpeechSynthesizer).
- **Account demo:** acceso solo da `app_metadata.unnivai_demo_revisore` (lo scrive solo il server), su un giro di Catania con 5 tappe e il tasto «Simula il cammino».
- **Icona proposta:** `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`.
- **Build web:** identica salvo il codice dietro `isAppNativa()`; le differenze sono spiegate file per file.
- **Non provato:** che la pagina riceva le posizioni a schermo bloccato. È dedotto dal codice di WebKit; c'è un piano B nel report.
- Report: `docs/prove/2026-11-03-app-nativa.md`.

## LANCIO

`docs/LANCIO.md`: **8 su 21 fatte** (era 5 su 21 la sera del 02/11).
- **Diventate «fatte» stanotte:** P9 CHAT-VERITA, P6 GEOCODING-LANCIO e P4 Revisore Sonnet.
- **P4:** ho verificato con `supabase secrets list` che `ANTHROPIC_MODEL_REVISORE` esiste dal 02/11 alle 10:33, con la stessa impronta di `ANTHROPIC_MODEL_SELETTORE`, cioè `claude-sonnet-5-5`. La riga diceva ancora «aspetta Ivano».
- **Restano «aspetta Ivano»:** L5 (privacy, termini, cancellazione: due comandi) e L2 (invio ad Apple: Xcode, account demo, icona).

## Cosa NON risolve

- **La chat:** con un giro sulla mappa non si apre. Dal vero la prima parola arriva in 5,5 s di mediana, sopra l'obiettivo di 4 s; le proposte sono nel § 5 del report del 02/11.
- **App nativa:** posizione e voce col telefono in tasca non sono provate su un dispositivo. Serve Xcode, poi un giro vero di Ivano.
- **Cancellazione dell'account:** non funziona finché migrazione e funzione non sono pubblicate.
- **Nominatim:** `CityContext`, `AddressAutocomplete`, `DashboardBusiness` e `dataService` lo usano ancora.
- **Processo (T9):** un commit di sola documentazione (`e7c3fc8`) è stato spinto su main senza PR. La CI è verde, ma la regola vuole la PR anche per la documentazione: ai sotto-agenti successivi l'ho ripetuto e l'hanno rispettato.
