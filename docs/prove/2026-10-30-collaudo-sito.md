# COLLAUDO-SITO — collaudo automatico sul sito pubblicato dei lavori del 28–30/10 (30/10/2026)

**Sito:** https://unnivai.vercel.app, commit `92c24d1` (Vercel «Deployment has completed»). **Proxy pubblicato:** `openai-proxy` versione 35, del 28/10 alle 17:55; versione 37 dal 31/10 alle 00:05 UTC per la ripetizione del punto 5.
**Come:** Playwright WebKit con il profilo iPhone 14 e l'account di prova (titolo «DoveVai» verificato prima delle credenziali). Il GPS è finto e si muove lungo il percorso, una posizione alla volta. I giri vengono dai dati del banco (Catania NAV-SIM, place_id veri) o da Crea (punti 8–10).
**Script:** `scripts/prova-nav/collaudo-sito.webkit.mjs`. **Dati grezzi:** `docs/prove/dati/2026-10-30-collaudo-sito-p123.json`, `-p457.json`, `-p6-8.json`. **Schermate:** `docs/prove/schermate/collaudo-sito/`.
Solo prova: il codice dell'app non è stato toccato.

## Esito

| # | Punto | Esito | Cosa si è visto |
|---|---|---|---|
| 1 | La freccia sparisce dopo 10 m | ✅ ok | All'avvio «Parti da qui verso Porta Uzeda»; a 5 m verso la tappa c'è ancora; a 15 m è sparita (`1-avvio.png`, `1-dopo-15m.png`) |
| 2 | Alla tappa 2, dopo «Salta», niente freccia | ✅ ok | Freccia all'avvio; dopo «Salta» è assente; pillola «55 m · verso Basilica Cattedrale di Sant'Agata» (`2-tappa-2.png`) |
| 3 | GPS muto 60 s e ripresa: niente freccia | ✅ ok | Freccia all'avvio. Dopo ~65 s senza posizione compare «Ho perso il segnale. Continua pure: quando torna, riparto da dove sei.» e la freccia è spenta. Il segnale torna nello **stesso punto** (nessun passo verso la tappa): l'avviso sparisce e la freccia resta spenta (`3-silenzio.png`, `3-ripresa.png`) |
| 4 | Roma, 700 m camminati: curiosità dei nasoni a schermo e richiesta di voce. Catania: nessuna curiosità | ✅ ok | **Roma, 715 m:** due toast «🎧 Roma ha più di duemila fontanelle pubbliche, tutte potabili. Cerca i nasoni!» (a ~300 e ~600 m). Una richiesta `voce` a `openai-proxy` con quella frase; la seconda volta la frase era già in memoria nella sessione, quindi nessuna nuova richiesta. **Catania, 723 m:** zero toast «🎧», nessuna voce con fontanelle o nasoni (`4-roma.png`, `4-catania.png`) |
| 5 | Schede di Orto Botanico di Roma, Villa Sciarra e due tappe di Catania: racconto presente o frase breve; per i racconti, la riga in `place_racconti` con esito passato | ❌ **no** il 30/10 → ✅ **ok** il 31/10 dopo il rilascio | **30/10:** in tutte e 4 le schede c'è la frase breve, mai vuota. **Nessun racconto:** il proxy risponde **400 «Model not allowed»** a ogni richiesta `racconto`, e in produzione **`public.place_racconti` non esiste** (`to_regclass` = null). Diagnosi sotto. Schermate del 30/10: `5-roma-1-30ott.png`, `5-roma-2-30ott.png`, `5-catania-1-30ott.png`, `5-catania-2-30ott.png`. **31/10:** la Cattedrale ha il racconto e la riga «passato»; le altre 3 schede hanno la frase breve e la riga «scartato». Vedi «Ripetizione del punto 5» (`5-catania-1.png` e le altre) |
| 6 | 2 tappe su 3 raggiunte e «Fine»: «2 tappe su 3», Profilo +1, nessun doppione dopo il ricaricamento | ✅ ok | Due arrivi veri: GPS fermo sulla tappa, rito, «Riparti»; giro salvato con `fatte: s1, s2`. Fine giro: «Sei arrivato a 2 tappe su 3.» Profilo **14 → 15**: 15 anche dopo il ricaricamento e dopo il passaggio dalla home, che non propone «Riprendi». Registro: `tour_completed` dell'account di prova **64 → 65**, **una sola riga** per il giro del collaudo, `value` «2/3» (`6-fine.png`) |
| 7 | «Salta» fino in fondo e poi 3 tocchi: fine giro, mai login né «Nelle tue Mete» | ✅ ok | 4 «Salta», poi 3 tocchi in 0,5 s nello stesso punto. Si resta su `/map` con la fine giro aperta e «Hai saltato tutte le tappe: il giro finisce qui.»; nessun login, nessun `/profile` (`7-account.png`). Da ospite non si arriva a questo punto: `/map` porta al login, quindi un ospite non può fare un giro |
| 8 | GPS a Roma, Crea «un giro a Catania»: «Domani · 9:30 · cambia» | ✅ ok | Giro vero da Crea in 20 s. Etichetta «Domani · 9:30 · cambia»; prima tappa alle 9:30, poi 10:00, 10:25… (`8-crea.png`) |
| 9 | Panoramica con pochi km fra le tappe | ✅ ok | Card «Barocco e piazze di Catania · Giornata 9:30–21:15 · 1h 9 a piedi · **5,0 km** · 13 tappe» (`9-panoramica.png`) |
| 10 | «Avvia» da lontano: messaggio «Sei a … km», mappa non nera | ✅ ok | «Sei a 536 km da Catania: la guida parte quando sei lì.»; nessuna navigazione partita. Restano le 13 tappe di Catania con il percorso, lo stile scuro della panoramica e nessun volo su Roma (`10-avvia.png`, controllata a occhio) |

**30/10: 9 su 10 ok, il punto 5 non passa. 31/10, dopo il rilascio: punto 5 ok, quindi 10 su 10.**

## Diagnosi del punto 5 (nessuna correzione, come da incarico)
- **Il proxy pubblicato è più vecchio del racconto.** `openai-proxy` versione 35 è stato pubblicato il 28/10 alle 17:55, con il codice di FORNITORE-AI. Il racconto è arrivato su main con NAV-TESTI-TAPPA alle 21:06 dello stesso giorno, seguito da NAV-RACCONTO-VERIFICA (29/10) e RACCONTO-R4 (30/10).
  - La versione 35 non conosce `dv.purpose = 'racconto'`. La richiesta passa quindi al controllo del modello e riceve `400 { error: 'Model not allowed', code: 'MODEL_NOT_ALLOWED' }` (`index.ts:767` nel codice di oggi).
- **Le migrazioni non sono applicate.** In produzione l'ultima migrazione è `20261028164601`. Mancano `place_racconti`, `place_racconti_verifica` e `ai_quota_tetto_contorno`, quindi la tabella dei racconti non c'è.
- **L'app si comporta come previsto senza racconto.** `richiediRacconto` restituisce null, la scheda mostra la frase breve e il lettore legge quella. Nessun errore a schermo.
- **Le due schede di Roma mostrano «Tappa del collaudo.».** È la descrizione del giro costruito per la prova, non una frase del motore. Le schede di Catania mostrano la frase breve vera del giro NAV-SIM.
- **Cosa serve.** È il rilascio già preparato e rimasto in attesa del «sì» di Ivano (fatto il 31/10, vedi «Ripetizione del punto 5»):
  1. `supabase db push` (il dry-run di oggi elenca solo le tre migrazioni);
  2. il secret `AI_UNLIMITED_USER_IDS`;
  3. `supabase functions deploy openai-proxy --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api`.

  Dopo il rilascio il punto 5 si rilancia così: `node scripts/prova-nav/collaudo-sito.webkit.mjs 5`, poi `select esito, count(*) from public.place_racconti group by 1`.
  - Esito atteso dalle prove r4: a Catania la Cattedrale e la Fontana dell'Elefante «passato»; a Roma l'Orto Botanico e Villa Sciarra «scartato» in r4, quindi resterebbe la frase breve.

## Ripetizione del punto 5 dopo il rilascio (31/10)
**Rilascio**, con il «sì» di Ivano per ogni comando, dal codice di main `0568815` (le funzioni e le migrazioni sono identiche a `92c24d1`):
1. `supabase db push` la sera del 30/10, prima delle 23:51 UTC. Applicate `20261028190000_place_racconti`, `20261029090000_place_racconti_verifica` (due colonne su `place_racconti`, non una tabella) e `20261029120000_ai_quota_tetto_contorno`.
2. `AI_UNLIMITED_USER_IDS` impostato il 31/10 alle 00:03 UTC con due id: l'account di Ivano (`813d9dc6-…`, riconosciuto dal suo accesso alle 23:52 UTC) e l'account di prova (`cee972ab-…`).
3. `openai-proxy` pubblicato con `--use-api`: **versione 37**, il 31/10 alle 00:05 UTC.

**Prova:** `node scripts/prova-nav/collaudo-sito.webkit.mjs 5`, il 31/10 dalle 00:06 alle 00:07 UTC. Dati grezzi in `docs/prove/dati/2026-10-31-collaudo-sito-p5.json`. Prima della prova `place_racconti` aveva 0 righe.

| Tappa | Risposta del proxy | Riga in `place_racconti` | Scheda |
|---|---|---|---|
| Orto Botanico di Roma | 200, `scartato` | `scartato`: «numeri non nelle fonti: 7, 000» | frase breve («Tappa del collaudo.», la descrizione del giro di prova) |
| Villa Sciarra | 200, `scartato` | `scartato`: «indicazione di direzione» | frase breve |
| Basilica Cattedrale di Sant'Agata | 200, `passato` | **`passato`**, 280 caratteri, scritto da `claude-sonnet-5-5` e verificato da `claude-haiku-4-5` | **racconto**: «Fermati: questo è il Duomo di Sant'Agata, il principale luogo di culto cattolico di Catania. …»; lettore 0:18 (`5-catania-1.png`) |
| Fontana dell'Elefante | 200, `scartato` | `scartato`: la verifica dice che la frase 2 non è nelle fonti, e anche la riscrittura non passa | frase breve del giro: «Ti fermi davanti a Fontana dell'Elefante … Ci arrivi alle 10:22.» |

**Conteggio:** `select esito, count(*) from public.place_racconti group by 1` dà **passato 1, scartato 3**.

**Esito:** ok. Ogni scheda ha un racconto o una frase breve, e l'unico racconto mostrato ha la sua riga «passato». Nessuna scheda vuota e nessun errore a schermo.
- **Fontana dell'Elefante:** nelle prove r4 era «passato», qui è «scartato». La verifica ha bocciato una frase sull'epoca dell'elefante che non si trova nelle fonti. Il filtro si è comportato come previsto; con questa versione resta quindi la frase breve.
- **Costo** delle 4 generazioni: 0,027 $ in tutto. Le righe restano in cache, quindi la prossima apertura di queste schede non spende.

## Ripetizione del punto 5 dopo r5 (31/10, RACCONTO-RIFINITURE)
**Rilascio** con il «sì» di Ivano, dal codice di main `482733a`: `openai-proxy` **versione 38**, il 31/10 alle 00:58 UTC (nessuna migrazione, nessun secret).
**Prova:** `COLLAUDO_ESITI=docs/prove/dati/2026-10-31-collaudo-sito-p5-r5.json node scripts/prova-nav/collaudo-sito.webkit.mjs 5`, il 31/10 dalle 00:59 alle 01:00 UTC. Il punto 5 ha ora un secondo giro di Roma: Palazzo Massimo alle Colonne e Piazza del Campidoglio. Prima della prova `place_racconti` aveva 4 righe r4 (1 passato, 3 scartati).

| Tappa | Proxy | Riga in `place_racconti` | Scheda |
|---|---|---|---|
| Orto Botanico di Roma | 200 `passato` | **r5 passato** (era r4 scartato per «7, 000») | racconto, «Dentro trovi 7.000 specie…», lettore 0:21 (`5-roma-1-r5.png`) |
| Villa Sciarra | 200 `passato` | **r5 passato** (era r4 scartato per una direzione) | racconto (`5-roma-2-r5.png`) |
| Palazzo Massimo alle Colonne | 200 `passato` | **r5 passato** | racconto (`5-roma-2-1-r5.png`) |
| Piazza del Campidoglio | 200 `scartato` | r5 scartato dal revisore dopo la riscrittura | frase breve («Tappa del collaudo.», `5-roma-2-2-r5.png`) |
| Basilica Cattedrale di Sant'Agata | 200 `passato` | **r4 passato, invariato** (cache) | racconto (`5-catania-1-r5.png`) |
| Fontana dell'Elefante | 200 `passato` | **r5 passato** (era r4 scartato) | racconto (`5-catania-2-r5.png`) |

**Conteggio:** `select versione, esito, count(*) from public.place_racconti group by 1,2` → r4 passato 1, r5 passato 4, r5 scartato 1.
**Esito:** ok. 3 tappe di Roma hanno il racconto passato in `place_racconti`. Ogni scheda ha un racconto o la frase breve, nessun errore a schermo. Costo dei 5 racconti nuovi: 0,061 $.
- **Fontana dell'Elefante:** passa con «Sopra la fontana l'ha messa Giovanni Battista Vaccarini», una frase che le fonti non dicono e che il revisore ha lasciato passare (vedi «Cosa NON risolve» di RACCONTO-RIFINITURE).

## Cosa la prova ha scritto in produzione
- **Un `tour_completed` dell'account di prova** (punto 6), tour `collaudo-fine-…`, `value` «2/3». L'account di prova ora conta 65 giri; la riga resta.
- **Una generazione da Crea** con l'account di prova (punto 8): `label = 'test'`, nessun contatore.
- **Richieste di voce e di racconto.** La voce della curiosità era già in cache o è un audio solo. Il 30/10 i racconti hanno ricevuto 400, quindi niente salvato e niente speso.
- **31/10, ripetizione del punto 5:** 4 righe in `place_racconti` (1 «passato», 3 «scartato»), per 0,027 $.
- **31/10, ripetizione del punto 5 dopo r5:** 5 righe nuove o riscritte in `place_racconti` (3 r4 scartate diventate r5 passate, 2 nuove: Palazzo Massimo passato, Campidoglio scartato), per 0,061 $. L'account di prova ha poi aperto un'altra sessione; nessun nuovo `tour_completed`.

## Solo iPhone vero (non verificabile in WebKit simulato)
- **Voce di iOS.** La voce umana (marin/cedar) che esce davvero dall'altoparlante, la ricaduta sulla voce di sistema di Safari e il volume con il telefono in mano o in tasca. Qui si vede solo che la richiesta parte.
- **Play.** Il tocco su ▶ del lettore e il tempo fino al primo suono. Safari su iOS vuole un gesto dell'utente per l'audio, e il simulatore non lo impone allo stesso modo. Va provato anche il Play dopo uno schermo bloccato.
- **GPS reale.** Precisione di 10–30 m in centro, salti e rimbalzi fra i palazzi. Dicono se la freccia sparisce davvero dopo 10 m, se l'arrivo scatta (due letture consecutive) e se le curiosità escono ogni ~300 m camminati e non per il rumore del segnale.
- **Modalità aereo.** Il silenzio vero del GPS e della rete per un minuto, poi la ripresa. Qui il silenzio è simulato (nessuna posizione emessa) e la rete resta accesa. Su iPhone vanno visti insieme «Sei offline» e «Ho perso il segnale», e la freccia che non torna.
- **Permessi di Safari.** La posizione chiesta la prima volta, «Consenti una volta» e il permesso negato in Impostazioni › Safari › Posizione.
- **Schermo e sfondo.** Lo schermo che resta acceso (Wake Lock), il blocco e lo sblocco del telefono durante un giro e la ripresa dall'app in sfondo.

## Note a margine (non fanno parte dei 10 punti)
- **Il tasto tondo «Vai alla mia posizione» copre l'angolo di «AVVIA»** nella card del giro guardato da lontano (`10-avvia.png`). Era già scritto in «Cosa NON risolve» di GIRO-LONTANO.
- **Gli errori di pagina sono solo «error_logs due to access control checks».** È la scrittura dei log di errore del client, rifiutata da WebKit. È comparsa nella camminata di Catania e non ha effetti a schermo.
