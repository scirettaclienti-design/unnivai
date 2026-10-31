# RACCONTO-RIFINITURE — tre correzioni piccole, già diagnosticate in RACCONTO-R4 (31/10/2026)

Cartella `/Users/mac2023ivanosciretta/unnivai-curiosita` (verificata con `pwd` all'avvio), sessione nuova, ramo `racconto-rifiniture` da `origin/main` (`fc4c4aa`). Revisore (prompt e modello), divieti (prompt e `VIETATE`), soglia delle fonti (200 caratteri), TTL e app **non toccati**.

## Cosa è cambiato (solo `supabase/functions/openai-proxy/racconto.ts`, più i commenti di `index.ts`)

1. **«7.000» è un numero solo.**
   - Nel racconto, come già nelle fonti, le migliaia col punto o con lo spazio (anche quello stretto) si uniscono: «7.000», «7 000» → 7000, «1.000.000» → 1000000 (`unisciNumeri`). «7 mila», «1,5 milioni» → la cifra intera.
   - La virgola non unisce più, né nel racconto né nelle fonti: in italiano è il decimale («2,5 km»). È più severo di prima, non meno.
   - I numeri in lettere, anche composti («settemila», «duecentocinquanta», «ventotto», «centottanta»), valgono la loro cifra nei due versi (`numeroInLettere`): «settemila» nel racconto passa se le fonti hanno «7.000», «12» passa se le fonti hanno «dodici». Una parola è un numero solo se si scompone tutta in pezzi di numero: «settembre», «centrale», «treno», «una», «sei» non lo sono. Sulle fonti vere della prova le sole parole lette come numero sono «due», «tre», «quattro», «sette».
   - Un numero che le fonti non hanno cade ancora: «8.000», «70.000», «7.500», «ottomila», «7» da solo, «7,000» (test).
2. **La riscrittura scatta anche sugli scarti del controllo automatico.**
   - Se il controllo automatico ferma la prima stesura (più di 4 frasi, una direzione, un numero, un nome, troppe parole fuori dalle fonti…), il narratore riceve i motivi (`messaggiRiscritturaControllo`). Per un divieto riceve anche la parola che l'ha fatto scattare («indicazione di direzione: «sinistra»»), per le frasi il conteggio («più di 4 frasi: ne hai scritte 5»).
   - Il testo riscritto ripassa da **entrambi** i controlli, automatico e revisore. Resta **una sola** riscrittura per racconto.
   - Non si riscrive quando non c'è niente da correggere: risposta NIENTE, risposta vuota, revisore illeggibile.
3. **Versione r5 solo per gli scartati.** `VERSIONE_RACCONTO = 'r5'`, `VERSIONI_ANCORA_VALIDE = ['r3', 'r4']`: una riga r3/r4 **passata** o **senza fonti** resta valida fino al suo TTL; una **scartata** (o senza esito) si riscrive alla prossima richiesta, senza aspettare i 7 giorni.

## Test (in `src/__tests__/functions/racconto.test.js`, 61 test, 8 nuovi o cambiati)
- **Caso 1, numeri:** le fonti vere dell'Orto Botanico di Roma passano con «7.000», «7 000», «7 000» (spazio stretto), «7000», «7 mila», «settemila»; «8.000», «70.000», «7.500», «ottomila», «7», «7,000» cadono; cifre e lettere nei due versi; le parole comuni non sono numeri.
- **Caso 2, riscrittura:** più di 4 frasi → riscritta col motivo e il conteggio, il revisore vede solo la riscritta, passa; una direzione → il motivo porta la parola, la riscritta cade ancora → scartato, mai una seconda riscrittura, revisore mai chiamato; un numero fuori dalle fonti → riscritta, passa l'automatico ma il revisore dice «no» → scartato. NIENTE o vuoto al primo colpo → nessuna riscrittura.
- **Caso 3, versione:** le tre righe r4 «scartato» di produzione (Fontana dell'Elefante, Orto Botanico, Villa Sciarra) non valgono più; una r4 «passato» sì.

## Resa: prima (r4) e dopo (r5), 3 lanci

**Come.** Stesso metodo di RACCONTO-R4, stesse fonti congelate (Catania: `docs/prove/dati/2026-10-28-racconti-tappa.json`; Roma: `docs/prove/dati/2026-10-30-fonti-roma.json`).
- **Prima** = il modulo `racconto.ts` di main `fc4c4aa` (r4: prompt, controllo e riscrittura com'erano in produzione), letto dal commit.
- **Dopo** = r5, lo stesso codice del proxy (`scriviERivedi`).
- Modelli dal proxy pubblicato, percorso `aux`: narratore Sonnet 5.5, revisore Haiku 4.5 (sonda e grezzo, risposta per risposta). Il percorso `racconto` non si chiama: scriverebbe in produzione.
- Script `scripts/prova-reale/racconti-r5.live.js`; grezzo `docs/prove/dati/2026-10-31-racconti-r5.json`.

| | Lancio 1 | Lancio 2 | Lancio 3 |
|---|---|---|---|
| **Catania (8 con fonti)**, prima r4 | 3 passati · 5 scartati | 7 · 1 | 8 · 0 |
| **Catania (8 con fonti)**, dopo r5 | **8** · 0 | **8** · 0 | **8** · 0 |
| **Roma (6 con fonti)**, prima r4 | 5 · 1 | 3 · 3 | 5 · 1 |
| **Roma (6 con fonti)**, dopo r5 | **6** · 0 | **5** · 1 | **5** · 1 |
| Senza fonti (Porta Uzeda, Troina 4, Roma 4) | 9 | 9 | 9 |

In tutto, sulle 42 scritture: **31 passati prima, 40 dopo**.

| Tappa | Prima r4 (L1-L2-L3) | Dopo r5 |
|---|---|---|
| Cattedrale di Sant'Agata | SPP | PPP |
| Fontana dell'Elefante | SSP | PPP |
| Teatro Antico | PPP | PPP |
| Castello Ursino | PPP | PPP |
| Fontana dell'Amenano | PPP | PPP |
| Piazza Mazzini | SPP | PPP |
| Palazzo dei Chierici | SPP | PPP |
| Via Etnea | SPP | PPP |
| Villa Sciarra | PPP | PPP |
| **Orto Botanico di Roma** | **SSS** (numeri: 7, 000) | **PPP** |
| Palazzo dei Conservatori | PSP | PPP |
| Palazzo Massimo alle Colonne | PPP | PPP |
| Parco del Gianicolo | PPP | PSP |
| Piazza del Campidoglio | PSP | PPS |

**Perché cadevano gli 11 scartati di prima:** più di 4 frasi 4, numeri «7, 000» 3 (Orto Botanico), direzione 2, revisore 2.
**I 2 scartati di dopo:** tutti e due dal revisore, dopo una riscrittura partita dal controllo automatico (Gianicolo L2: «più di 4 frasi» e una direzione, poi il revisore boccia «nelle giornate limpide»; Campidoglio L3: «più di 4 frasi», poi il revisore boccia la frase sul Tabularium).

**Riscritture dopo r5:** 19, di cui 17 passate. Dal revisore 11 (11 passate), dal controllo automatico 8 (6 passate: 6 per «più di 4 frasi», 1 per «più di 4 frasi + direzione», 1 per «nomi non nelle fonti: Nei»).

## Costo

| | Scritture | Passati | Spesa | Per scritto | **Per racconto passato** |
|---|---|---|---|---|---|
| Prima (r4) | 42 | 31 | 0,3298 $ | 0,0079 $ | **0,0106 $** |
| Dopo (r5) | 42 | 40 | 0,3732 $ | 0,0089 $ | **0,0093 $** |

- Per lancio, per racconto passato: prima 0,0148 / 0,0107 / 0,0080 $; dopo 0,0096 / 0,0095 / 0,0089 $.
- Un racconto passato al primo colpo costa in media 0,0061 $ (23 su 40); uno riscritto 0,0121 $ (17 su 40).
- Tempo per tappa, dalla scrittura all'ultima verifica: medio 5,1 s, massimo 8,9 s (prima 4,6 s e 9,7 s).
- Spesa della misura: 0,70 $. Del collaudo del punto 5: 0,061 $ (5 racconti nuovi; la Cattedrale era in cache, 0 $).

## Lettura a mano dei 40 racconti passati (r5)
- **Un'invenzione di posizione:** Villa Sciarra L1, «il piazzale **dove sei**» (le fonti danno due ingressi). È la stessa di RACCONTO-R4 («da cui entri»): il revisore Haiku la lascia passare, e c'era anche nel Villa Sciarra r4 passato dello stesso lancio.
- **Sfumature senza fatti nuovi (⚠):** «la chiesa madre di Catania» (le fonti: dell'arcidiocesi), «sopra sale la cupola» (Google: «cupola»), «il piazzale d'ingresso» (uno dei due), «addossato» riferito a «tu», «la puoi visitare solo il 16 marzo» riferito alla cappella (Google: il palazzo è aperto solo il 16 marzo), «sotto i tuoi piedi».
- **Numeri:** nessuno fuori dalle fonti. L'Orto Botanico dice «7.000 specie», come Google.
- Le altre frasi dicono le fonti (confrontate col testo di Wikipedia e Google nel grezzo).

## Deploy e collaudo del punto 5
- **Merge su main** `482733a` (fast-forward dopo `git fetch` e rebase: nessun commit nuovo su `origin/main`, nessun conflitto); **CI verde** (run 41151393117).
- **Deploy** con il «sì» di Ivano, da `~/unnivai-curiosita` su `482733a` = `origin/main`: `supabase functions deploy openai-proxy --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api` → `openai-proxy` **versione 38**, 31/10 alle 00:58 UTC.
- **Prima del collaudo** `place_racconti` aveva 4 righe r4: Cattedrale «passato»; Orto Botanico «scartato» (numeri 7, 000), Villa Sciarra «scartato» (direzione), Fontana dell'Elefante «scartato» («nomi non nelle fonti: Per»).
- **Collaudo:** `COLLAUDO_ESITI=docs/prove/dati/2026-10-31-collaudo-sito-p5-r5.json node scripts/prova-nav/collaudo-sito.webkit.mjs 5`, WebKit iPhone 14, account di prova, sito pubblicato. Al punto 5 si aggiunge un secondo giro di Roma (Palazzo Massimo alle Colonne, Piazza del Campidoglio). Dettagli e schermate (`docs/prove/schermate/collaudo-sito/5-*-r5.png`) in `docs/prove/2026-10-30-collaudo-sito.md`, «Ripetizione del punto 5 dopo r5».

| Tappa | Proxy | Riga in `place_racconti` | Scheda |
|---|---|---|---|
| Orto Botanico di Roma | 200 `passato` | **r5 passato** (era r4 scartato), «Dentro trovi 7.000 specie…» | racconto, lettore 0:21 |
| Villa Sciarra | 200 `passato` | **r5 passato** (era r4 scartato), riscritto dopo il revisore | racconto |
| Palazzo Massimo alle Colonne | 200 `passato` | **r5 passato**, riscritto dopo il revisore | racconto |
| Piazza del Campidoglio | 200 `scartato` | r5 scartato: il revisore boccia la frase sul Tabularium anche dopo la riscrittura | frase breve |
| Cattedrale di Sant'Agata | 200 `passato` | **r4 passato, invariato** (cache: il passato r4 resta valido) | racconto |
| Fontana dell'Elefante | 200 `passato` | **r5 passato** (era r4 scartato), riscritto dopo il revisore | racconto |

- `select versione, esito, count(*) from public.place_racconti group by 1,2` → r4 passato 1, r5 passato 4, r5 scartato 1.
- **3 tappe di Roma con racconto passato** in `place_racconti` (Orto Botanico, Villa Sciarra, Palazzo Massimo). Ogni scheda ha un racconto o la frase breve, nessun errore a schermo.

## Verifiche
- Suite verde: **237 file, 2926 test**. Lint: **0 errori** (190 avvisi già presenti). Build ok. `deno check` del proxy: il solo errore già noto a `index.ts:389` (`info.motivo`), identico su main.
- `npm run banco:guardia`: **12/12**, pertinenza senza ❌ nuovi (3 ❌ già noti). Lanciata dopo il merge del codice e non prima, come chiede CLAUDE.md: il racconto non passa dai flussi della home, ma l'ordine giusto era l'altro.
- Nessun file toccato è in `docs/corsia-e-permessi.json`.
- CI verde su main per il codice (`482733a`) e per questo report (vedi `git log`).
- `.env.local` (credenziali dell'account di prova) copiato da `~/unnivai-1b` senza stamparlo, cancellato a fine prova.

## Cosa NON risolve
- **CLAUDE.md descrive ancora r4** nella sezione del racconto: non era fra i file dell'incarico, quindi non l'ho toccato. Proposta: una riga «Versione r5 (RACCONTO-RIFINITURE)» come quella di r4.
- **Il revisore lascia passare ancora qualche invenzione piccola.** In produzione, Fontana dell'Elefante (r5, riscritto): «**Sopra la fontana l'ha messa** Giovanni Battista Vaccarini»; le fonti dicono che Vaccarini realizzò la fontana, non che vi mise l'elefante. Nella misura, Villa Sciarra «il piazzale dove sei». Si corregge solo toccando il revisore, fuori incarico. Per togliere la riga dell'Elefante: `delete from public.place_racconti where place_id = 'ChIJV63v_C7jExMRLThjTCcPppk';` (si riscrive alla richiesta dopo), da decidere.
- **Il revisore sbaglia anche per eccesso:** «la statua è romana» (scritto da Google) è bocciato a ogni lancio e la riscrittura lo toglie. Invariato.
- **Falso allarme sui nomi dopo i due punti:** «Fermati: Nei primi decenni…» o «…: Per i catanesi…» fanno scattare «nomi non nelle fonti: Nei / Per», perché la parola con la maiuscola non è a inizio frase. Ora la riscrittura lo recupera (Castello Ursino L3), ma il controllo resta com'è. È la r4 dell'Elefante scartata in produzione.
- **Roma 5 su 6 in due lanci su tre:** Gianicolo e Campidoglio cadono una volta ciascuno sul revisore dopo la riscrittura. Variabilità del modello (Sonnet 5.5 non accetta `temperature`).
- **Troina 0 su 4, Porta Uzeda e 4 tappe di Roma senza fonti:** invariati, la soglia dei 200 caratteri non si tocca.
- **Ogni riscrittura in più costa:** con la riscrittura anche sull'automatico la spesa per racconto scritto sale da 0,0079 a 0,0089 $; quella per racconto passato scende da 0,0106 a 0,0093 $.
