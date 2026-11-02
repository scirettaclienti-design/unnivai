# CHAT-VERITA dal vero — deploy, misura, correzioni (coda del 03/11/2026)

Cartella `/Users/mac2023ivanosciretta/unnivai-notte-chat-verita` (verificata con `pwd`), rami `notte/chat-verita` (PR #16) e `notte/chat-verita-report`.
Lavoro svolto il 02/11 dalle 19:20 alle 20:30 circa (ora italiana). La parte già fatta (diagnosi, prompt, controlli, banco di 30 domande) sta in `docs/prove/2026-11-02-chat-verita.md`: qui non si ripete.

## 1. Cosa cambia per Ivano

- **La chat del sito risponde.** Prima del deploy: `400 MODEL_NOT_ALLOWED`, a schermo «Non riesco a raggiungere la guida». Ora: openai-proxy **v46**, pubblicata da `main` (`85460eb`), file uguali al repo.
- **Due errori trovati dal vero, corretti e pubblicati** (PR #16, `85460eb`):
  1. Fuori dalla navigazione il telefono manda `prossima: null`. Il server lo leggeva come 0, cioè «la prossima tappa è la prima». La guida diceva «è la tua prossima tappa», «sei quasi arrivato», «tra poco ci sei» senza sapere dove sei: **7 frasi su posizioni inventate su 20 risposte**. Ora null resta null («Non so dove ti trovi adesso nel giro»).
  2. Senza giro sulla mappa il telefono mandava `centro: null`. Il server allora non cercava i luoghi nominati nella domanda. Ora manda il centro della mappa, lo stesso del badge del meteo.
- **La chat non si apre quando un giro è sulla mappa.** Il badge del meteo, unico ingresso, sparisce appena c'è un giro (`MapPage`: barra in alto solo senza percorso). Verificato in WebKit: panoramica del giro di Catania, nessun badge (`schermate/chat-verita/1-mappa-con-giro.png`). Tutto il lavoro sulle tappe del giro, quindi, oggi dal telefono non si usa. Si chiede alla guida solo senza giro, e risponde solo sui luoghi nominati che hanno una voce di Wikipedia con coordinate entro 10 km. **Decisione tua** (§ 7): non ho aggiunto ingressi.
- **Il revisore in produzione è Sonnet 5.5, non Haiku 4.5.** Ogni riga di log della chat dice `claude-sonnet-5-5+claude-sonnet-5-5`. Il secret `ANTHROPIC_MODEL_REVISORE` esiste dal 02/11 alle 10:33 UTC. In `docs/LANCIO.md` la riga P4 lo dà ancora «aspetta Ivano»: va controllata (non l'ho toccata). Vale anche per i racconti e le curiosità, e spiega perché la chat è più lenta che nel banco del 02/11.

## 2. Deploy

| | |
|---|---|
| Prima | openai-proxy **v44**, del 02/11 alle 02:57 UTC. I file scaricati (`supabase functions download --use-api`) sono uguali a `eda9b67` (CURIOSITA-QUARTIERI): né OSPITE-GIRO né CHAT-VERITA erano pubblicati. |
| CI di `bf6983e` | verde (run 41496185306) |
| Deploy 1 | da `/Users/mac2023ivanosciretta/unnivai-notte-deploy`, staccato su `origin/main` = `bf6983e`, il 02/11 alle 18:31 UTC: **v45**, 11 file su 11 uguali al repo |
| Correzioni | PR #16 (`85460eb`), controlli verdi, CI di main verde (run 41503540626), Vercel «Deployment has completed» |
| Deploy 2 | stessa cartella, portata su `origin/main` = `85460eb`, alle 18:49 UTC: **v46**, 11 file su 11 uguali al repo |
| Comando | `supabase functions deploy openai-proxy --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api` |
| Migrazioni, secret | nessuno |

**OSPITE-GIRO pubblicato ma spento.** Il codice di `main` porta anche il soggetto `ospite`: account anonimi → `public.ai_quota_ospite`. Resta senza effetto finché gli accessi anonimi sono spenti, e lo sono:
- `POST /auth/v1/signup` senza email risponde **422 `anonymous_provider_disabled`**;
- `/auth/v1/settings` dà `anonymous_users: false`;
- sul sito «Prova un giro, senza account» resta su /login con «Il giro di prova non è disponibile adesso. Crea l'account e parti.» (`schermate/chat-verita/0-ospite-non-disponibile.png`);
- in produzione `ai_quota_ospite` non esiste: ci sono solo `ai_quota_consume`, `ai_quota_refund` e `ai_quota_touch_updated_at`.

Senza JWT anonimo nessuna richiesta arriva al ramo `ospite`. Gli utenti registrati passano da `ai_quota_consume` con gli stessi parametri di prima (codice raccolto in `consumaQuota`).

## 3. Collaudo completo (`node scripts/prova-nav/collaudo-sito.webkit.mjs`)

Due giri interi, subito dopo ogni deploy. Esiti in `docs/prove/dati/2026-11-03-collaudo-sito-v45.json` e `-v46.json`. Le schermate del collaudo non sono committate: restano quelle di prima.

| Punto | v45 (18:31–18:38 UTC) | v46 (18:49–18:56 UTC) |
|---|---|---|
| 1 freccia sparisce dopo 10 m | ✅ | ✅ |
| 2 tappa 2 dopo «Salta» | ✅ | ✅ |
| 3 GPS muto 60 s e ripresa | ✅ | ✅ |
| 4 curiosità del cammino (Roma e Catania) | ✅ | ✅ |
| 5 schede: racconto o frase breve | ✅ 10/10 schede (vedi sotto) | ✅ 10/10 schede |
| 6 «Fine» a 2/3 | ✅ | ✅ |
| 7 «Salta» fino in fondo | ✅ con l'account · ❌ da ospite (atteso, vedi sotto) | ✅ con l'account · ❌ da ospite (atteso) |
| 8 Crea «un giro a Catania» da Roma | ✅ | ✅ |
| 9 panoramica | ✅ | ✅ |
| 10 «Avvia» da lontano | ✅ | ✅ |
| 11 Per Te a Roma alle 01:00 e alle 20:00 | ✅ | ✅ |
| 12 scheda monumento | ✅ | ✅ |
| 13 titoli dei giri | ✅ | ✅ |

- **Punto 5:** il collaudo lascia `ok` vuoto, si decide su `place_racconti`. Le 10 schede hanno racconto o frase breve. Le righe (SQL, sola lettura) sono 9 «passato» e 1 «scartato» (Piazza del Campidoglio, scartato dal 31/10). Tutti i racconti escono dalla cache: nessun racconto nuovo scritto con il `racconto.ts` di CHAT-VERITA.
- **Punto 7:** la parte con l'account passa (fine giro, `/map`, niente login, niente «Salva questo giro»). La parte da ospite cade su «Prova un giro, senza account»: dopo il clic l'app resta su /login, perché gli accessi anonimi sono spenti (422, § 2). È atteso finché Ivano non fa i passi di OSPITE-GIRO, non è un peggioramento del deploy.

**Confronto con l'ultimo collaudo** (31/10, 10/10 sui punti 1–10): stessi esiti. Punti 1–6 e 8–10 ok, il 7 ok con l'account; in più 11–13 ok.

## 4. Misura dal vero: 20 domande sul percorso `chat` pubblicato

Le domande sono quelle del banco del 02/11:
- le 10 sui luoghi del giro;
- 5 trappole: 11 Michelangelo, 13 Colosseo, 14 Trevi, 17 Carrara, 20 terremoto del 2000;
- 5 libere: 21 fame, 23 quanto manca, 25 chiese, 26 caldo, 29 persona vera.

Come le manda la chat:
- `POST /functions/v1/openai-proxy`, `dv.purpose = 'chat'`, account di prova;
- il giro di Catania di `docs/prove/dati/2026-11-02-chat-verita.json`, con `prossima: null` (chat aperta senza navigazione);
- centro = media delle tappe, storia vuota.

Script: `/private/tmp/…/scratchpad/chat-dal-vero.mjs`, fuori dal repo (logica uguale a `chiediAllaGuida`). Grezzo con testi, tempi ed esiti: `docs/prove/dati/2026-11-03-chat-verita-dal-vero.json`.

- **Giro 1, su v45:** tutte e 20.
- **Giro 2, su v46** (dopo la correzione di `prossima`): solo le 8 domande toccate dall'errore (1, 2, 11, 13, 14, 21, 23, 26), per stare nel tetto di spesa. Le altre 12 non avevano frasi sulla posizione e non si ripetono.

### Tempo alla prima parola (= risposta intera, niente streaming)

| | mediana | p90 | massimo | media | sotto 4 s |
|---|---|---|---|---|---|
| **dal client, stato finale** (12 risposte di v45 + 8 di v46) | **5,83 s** | 10,2 s | 12,7 s | 6,9 s | 2 su 20 |
| dal client, giro 1 (20 su v45) | 5,49 s | 10,2 s | 12,2 s | 6,5 s | 3 su 20 |
| sul server (`chat.ms`), giro 1 | 4,87 s | 9,9 s | 12,0 s | 6,3 s | 4 su 20 |
| banco del 02/11, sul server, revisore Haiku 4.5 | 4,06 s | 8,6 s | 23,8 s | 5,4 s | 14 su 30 |

Perché più lenta del banco:
1. **Il revisore è Sonnet 5.5** (§ 1), non Haiku 4.5.
2. **Le riscritture.** 5 risposte su 20 sono riscritte e 2 «oneste»: ognuna costa 8–13 s. Le risposte senza riscrittura stanno fra 3,3 e 5,9 s, tranne due:
   - 23 (12,2 s su v45): 12 s sul server per una sola scrittura e una revisione;
   - 5 (10,7 s): fonti 0,4 s, modelli 10 s.
3. **Fonti lente su un'istanza fredda**: 4,1–4,9 s in tre richieste (domande 9, 20 e 21 su v46). Di solito 0,3–0,7 s.

Fra telefono e server passano circa 0,3 s.

### Esiti

| | verificata | riscritta | ridotta | onesta |
|---|---|---|---|---|
| stato finale (20) | 13 | 5 | 0 | 2 |

- **Le due «oneste»:**
  - 6 *Che cosa trovo lungo Via dei Crociferi?*: il controllo di voce ha fermato due volte «parla a più persone». La descrizione Google («chiese barocche e palazzi del XVIII secolo») bastava.
  - 21 *Ho fame* su v46: il revisore ha fermato «la sosta alla Cattedrale è la più lunga del giro» (falso: il Monastero ha 40 minuti) e la riscrittura non è passata. Su v45 la stessa domanda dava un consiglio onesto.
- **La prova dal telefono senza giro** (§ 5): *Chi ha fatto la Fontana dell'Elefante?* → «Su questo non ho una fonte sicura». La voce it.wikipedia «Fontana dell'Elefante» non ha coordinate (solo Wikidata), quindi `luoghiNominati` la scarta («senza coordinate»).

### Frasi inventate, lette a mano

Definizione del 02/11: un fatto che né le fonti né il giro dicono, anche se vero nel mondo. Contano anche le frasi sulla posizione dell'utente, come «sei a metà mattina» il 02/11. Le fonti sono i testi del grezzo del 02/11 (Wikipedia e Google per Fontana dell'Elefante, Cattedrale, Via dei Crociferi, Teatro Massimo Vincenzo Bellini, chiesa di San Nicolò l'Arena, Teatro greco-romano).

| | inventate | frasi |
|---|---|---|
| prima di CHAT-VERITA (chat di `chatWithGuide`, banco del 02/11, stesse 20 domande) | 60 | — |
| banco del 02/11 (codice nuovo, fuori produzione, stesse 20) | 5 | — |
| **dal vero, giro 1 (v45)** | **9** | 62 |
| **dal vero, stato finale (v46 per le 8 toccate)** | **1** | 59 |

Le 9 di v45:
- 7 sulla posizione, tutte dall'errore di `prossima`: «è la tua prossima tappa», «Tra poco ci sei», «Sei quasi arrivato» e altre 4;
- «Il Colosseo è a Roma» (13): un fatto di un'altra città;
- 20 *Il Monastero dei Benedettini è stato distrutto dal terremoto del 2000?*: «l'edificio di oggi è sorto dopo l'eruzione dell'Etna del 1669 … dal XX secolo ospita il Sacrario». Sono fatti della chiesa di San Nicolò l'Arena (la fonte trovata), detti come se fossero del Monastero.

**Stato finale: 1 frase inventata su 59**, la 20. Nessuna frase falsa nel mondo. Le 8 risposte rifatte su v46 non hanno frasi inventate:
- 23 → «Non so dove ti trovi adesso nel giro, quindi non posso dirti quanto manca. Posso dirti gli orari: …»;
- 13 → «Oggi sono qui a Catania, e del Colosseo non ho una fonte sicura.».

Altre cose lette, che non sono fatti inventati:
- 4: «le fonti parlano di affreschi e dipinti». È vietato dalle regole di voce e il controllo non l'ha fermato.
- 7: «Su chi sia la dedica non ho una fonte sicura: il nome per esteso è Teatro Massimo Vincenzo Bellini». È la prudenza in eccesso già nota.
- 3, 8: la data della Cattedrale e quella dell'inaugurazione del Bellini non sono nelle fonti, e la guida lo dice.

## 5. Prova WebKit sul sito pubblicato (iPhone 14, account di prova)

Script `scripts/prova-nav/chat-verita-sito.webkit.mjs`.
- Prima delle credenziali: titolo «DoveVai | Esplora l'Italia Autentica» su https://unnivai.vercel.app (CLAUDE.md).
- Esiti: `docs/prove/dati/2026-11-03-chat-verita-sito*.json`.
- Schermate della prova finale (v46): `docs/prove/schermate/chat-verita/`.

| Passo | Esito |
|---|---|
| mappa con il giro di Catania (stato del router, come il collaudo) | panoramica «Il tuo giro a Catania · 6 tappe», **badge del meteo assente: la chat non si apre** (`1-mappa-con-giro.png`) |
| mappa senza giro → badge del meteo → chat | si apre: «Chiedimi del giro. Sui fatti ti dico solo quello che ha una fonte; se non lo so, te lo dico.» (`2-chat-aperta.png`) |
| domanda *Cosa c'è in piazza del Duomo?* | **«Controllo le fonti…»** a schermo (`3-controllo-le-fonti.png`) |
| risposta (3,8 s dal telefono, 3,4 s sul server, verificata) | «È la piazza principale della città. Qui arrivano tre strade: la via Etnea, la storica asse cittadina, la via Garibaldi e la via Vittorio Emanuele II, che la attraversa da est a ovest. Il Duomo sta sul lato orientale ed è dedicato alla patrona, festeggiata il 5 febbraio.» Tutto nella voce «Piazza del Duomo (Catania)», 0 frasi inventate |
| **«Fonti lette: Piazza del Duomo (Catania)»** | presente (`4-risposta.png`); il Duomo di Taormina (42 km) è scartato |
| richiesta mandata | `luoghi: []`, `prossima: null`, `citta: Catania`, `centro: 37.5025, 15.0871` (su v45 era `centro: null`) |
| *Chi ha fatto la Fontana dell'Elefante?* (v45 e v46) | «Su questo non ho una fonte sicura…»: nessuna tappa e voce di Wikipedia senza coordinate (§ 4) |

## 6. Costo AI

Dalle righe `[openai-proxy] chat c1: … $` del log della funzione:

| | richieste | $ |
|---|---|---|
| giro 1, v45 | 20 | 0,2797 |
| giro 2, v46 | 8 | 0,1397 |
| WebKit (Fontana su v45, Fontana su v46, piazza del Duomo su v46) | 3 | 0,0256 |
| prova prima del deploy (400) | 1 | 0 |
| **totale chat** | 32 | **0,445 $** (tetto 0,50 $) |

- Media 0,0139 $ a risposta: 0,0107 $ nel banco del 02/11, con revisore Haiku. Le riscritte costano 0,018–0,026 $.
- 1.000 domande al giorno ≈ 14 $.
- I due collaudi completi generano anche giri, Per Te e cenni con l'account di prova (etichetta `test`). Non li ho misurati riga per riga, perché i giri non scrivono il costo nel log.

## 7. Cosa NON risolve (e cosa propongo)

1. **Nessun ingresso alla chat con un giro sulla mappa.** È il punto principale: la chat «del giro» oggi non vede mai il giro. Proposta: un tasto «Chiedi alla guida» nella panoramica e nella barra di navigazione, che apre lo stesso `AIDrawer` (in navigazione con la prossima tappa). Serve il tuo sì: è un ingresso nuovo, e la parte visiva è della corsia estetica.
2. **Luoghi nominati senza coordinate su it.wikipedia** (Fontana dell'Elefante, Palazzo degli Elefanti, Duomo di Catania): scartati. Proposta: in `luoghiNominati`, se la voce non ha coordinate, prendere quelle di Wikidata (`pageprops.wikibase_item` → P625). Una chiamata in più, nessuna migrazione.
3. **Il tempo:** mediana 5,8 s dal telefono, obiettivo 4 s mancato. Proposte del 02/11 (§ 5 di quel report). In più ora:
   - decidere se il revisore della chat resta Sonnet 5.5 (più lento, controlla meglio) o torna Haiku 4.5. Oggi lo decide un solo secret per racconti, curiosità e chat;
   - mostrare «Controllo le fonti…» (già fatto).
4. **Fatti del posto sbagliato** (20): la fonte del Monastero è la chiesa di San Nicolò l'Arena e la risposta non lo dice. Il revisore non lo vede. Limite delle fonti, già nel report del 02/11.
5. **Prudenza in eccesso:** 6 e 21 «oneste» quando c'era una risposta possibile; 7 non dice «Vincenzo Bellini».
6. **«le fonti parlano di»** non è fermato dal controllo di voce.
7. Nomi nell'interfaccia («Assistente DoveVai», «AI Guide», «DOVEVAI AI»): corsia estetica, come nel report del 02/11.

## 8. Prove

| Prova | Esito |
|---|---|
| `src/__tests__/functions/chat.test.js` | 25/25 (nuovo: «prossima null non diventa la prima tappa») |
| suite intera | 253 file, 3160 test, verdi |
| `npm run lint` · `npm run build` | 0 errori · ok |
| `npm run banco:guardia` | 12/12, pertinenza senza ❌ nuovi (3 già noti) |
| `deno check` di `index.ts` | solo l'errore già su main (riga 466, `info.motivo`) |
| PR #16 | controlli verdi, unita con `--rebase`; CI di main verde; Vercel completato |
| collaudo completo | § 3 |
| misura dal vero | § 4 |
| WebKit | § 5 |

## 9. Passi che aspettano Ivano

1. **Ingresso della chat con un giro sulla mappa** (§ 7, punto 1): sì o no.
2. **Coordinate da Wikidata per i luoghi nominati** (§ 7, punto 2): sì o no. Solo codice del proxy, poi un deploy.
3. **Revisore:** controllare la riga P4 di `docs/LANCIO.md`, perché in produzione il revisore è già Sonnet 5.5 (§ 1). Se lo si vuole Haiku per la chat, serve un secret o un passaggio separato.
4. Su iPhone: aprire la mappa **senza giro** a Catania (o in un'altra città), toccare il badge del meteo e chiedere di un luogo vicino («Cosa c'è in piazza del Duomo?»). Deve comparire «Controllo le fonti…», poi la risposta e «Fonti lette:».
