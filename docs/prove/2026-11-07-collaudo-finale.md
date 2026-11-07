# COLLAUDO-FINALE (T31) — 07/11/2026

Solo esito: nessuna correzione al codice dell'app, nessuna migrazione, nessun secret, nessun deploy. Sito provato: `https://unnivai.vercel.app`, bundle `index-DlN16F01.js`, deploy di produzione di `4727d6b` (merge di T30; commit status Vercel «success», ultimo deploy di produzione del 07/11 alle 03:46 UTC). WebKit, profilo iPhone 14, account di prova; voce del telefono, mai OpenAI. L'email dell'account di prova è mascherata negli screenshot (il Profilo la mostra: due immagini ritoccate, sopra il riquadro scuro con la scritta «nascosta»; lo script ora la maschera da solo).

## Cosa cambia per Ivano

- **Il sito dopo T26–T30 regge.** Tutti i punti nuovi passano (sessione, Per Te, «Vedi tutte», Profilo, nomi della home, movimento, Al volo e Su misura). Nessun difetto bloccante.
- Il collaudo di base passa su 13 punti su 13, ma **al primo giro i punti 4, 5 e 7 sono rossi** (errore WebKit «Frame load interrupted» e un tasto «Avvia» non cliccabile); **alla ripetizione immediata sono tutti verdi**. Lo scrivo come instabilità della prova, non dell'app: nessuna prova che sia un difetto, ma non l'ho dimostrato. Vedi «Difetti e osservazioni».
- **Il punto 7 da ospite oggi passa** (in T25 era rosso perché gli accessi anonimi erano spenti): ora «Prova un giro, senza account» entra e arriva alla fine giro. Se spegnerli era voluto, oggi risultano accesi.
- Costo: stima 1,0–1,5 $ a listino (non misurato, vedi Costo), sotto il tetto di 3 $.

## 1. Collaudo di base (`collaudo-sito.webkit.mjs`, punti 1–13)

Comando: `COLLAUDO_OUT=docs/prove/schermate/collaudo-finale COLLAUDO_ESITI=docs/prove/dati/2026-11-07-collaudo-finale.json node scripts/prova-nav/collaudo-sito.webkit.mjs`, poi `… 4,5,7` (ripetizione, esiti in `docs/prove/dati/2026-11-07-collaudo-finale-ripetizione.json`). Lo script non cercava i testi rinominati da T27: nessun adattamento necessario. Unica modifica: `COLLAUDO_OUT` per non sovrascrivere le schermate dei collaudi precedenti.

| Punto | Giro 1 | Ripetizione | Cosa si è visto |
|---|---|---|---|
| 1 Freccia sparisce dopo 10 m | ok | | a 5 m «Parti da qui verso Porta Uzeda», a 15 m niente |
| 2 Tappa 2 dopo «Salta» | ok | | niente freccia, «55 m · verso Basilica Cattedrale di Sant'Agata» |
| 3 GPS muto 60 s | ok | | «Ho perso il segnale…», niente freccia, ripresa pulita |
| 4 Curiosità del cammino | ko (prova) | **ok** | primo giro: `page.reload: Frame load interrupted`; ripetizione: Roma con fonte di Roma (Trastevere), Catania senza Roma |
| 5 Schede racconto | ko (prova) | **ok** (letto) | stesso errore al primo giro; ripetizione: racconti `passato` (Orto Botanico, Villa Sciarra, Palazzo Massimo alle Colonne). Il punto non ha un campo `ok`: l'esito si legge |
| 6 «Fine» a 2/3 | ok | | nota, Profilo +1, nessun doppione |
| 7 «Salta» fino in fondo + 3 tocchi | ko (prova) | **ok, ospite e account** | primo giro: «Avvia» non cliccabile (timeout 30 s); ripetizione: fine giro «Hai saltato tutte le tappe: il giro finisce qui.», nessun login |
| 8, 9, 10 Crea, panoramica, «Avvia» | ok | | |
| 11 Per Te a Roma all'01:00 e alle 20:00 (orologio spostato) | ok | | schede con «Per stamattina» / «Per domattina» giusti |
| 12 Scheda monumento | ok | | si apre in 83 ms, i cenni arrivano dopo (8,3 s con ritardo finto di 8 s) |
| 13 Titoli dei giri | ok | | |

## 2. Punti nuovi

Script: `scripts/prova-nav/collaudo-finale.webkit.mjs` (nuovo, solo prova) e `login-sessione.webkit.mjs` (esistente, `LS_BASE=https://unnivai.vercel.app LS_MODO=vero`). Dati: `docs/prove/dati/2026-11-07-collaudo-finale-nuovi-giro{1,2,3,4}.json` (quattro esecuzioni parziali: dopo i primi due giri ho corretto errori **dello script**, mai dell'app: tasto «Conferma Posizione» che copriva il Profilo, il ruolo `tab` dei due pulsanti, il percorso del tasto ospite). Schermate in `docs/prove/schermate/collaudo-finale/`.

| # | Punto | Esito | Prova |
|---|---|---|---|
| 1 | Sessione che resta salvata (T26) | **ok** | A: chiudo e riapro con la memoria del sito: dentro senza codice. B: riapro dopo ore (token scaduto): si rinnova da solo. C: dopo ore con rete assente: dentro entro 14 s, mai la schermata del codice. D: «Esci» sul telefono 1 lascia dentro il telefono 2. E: dopo «Esci» riaprendo torna il login. Screenshot `sessione/vero-*.jpg`, esiti `sessione/esiti-vero.json` |
| 2 | Per Te con almeno 3 proposte a Roma (T27) | **ok** | Ora della prova **04:59 (Roma), 07/11/2026**, GPS a Roma, ora vera. **5 schede in home** (generate in 18 s): «Intorno al Giardino degli Aranci» (Scelto per te), «Giardini di Roma», «Tre forni a Roma», «Verde a Roma», «Musei di Roma» (le quattro «Per stamattina»); riga «Adesso è aperto poco. Le altre sono per stamattina.» `h-home.png` |
| 3 | «Vedi tutte» apre `/per-te` con le stesse schede e si torna indietro (T27) | **ok** | `/per-te` mostra 6 schede: le 5 della home più «Panorami a Roma», nello stesso ordine. Tasto indietro del browser e «Torna alla home» riportano a `/dashboard-user`; una scheda dell'elenco si apre (`/tour-details/home-insider-…`, pagina piena). `h-per-te-elenco.png`, `h-scheda-aperta.png` |
| 4a | Profilo, account di prova (T28): Mete, Risultati, Rivivi, DNA; Richieste non visibile | **ok** | Contatori 56 giri, 2 città, 326 tappe. Titoli: Il tuo DNA, I tuoi interessi, Come giri, A tavola, I tuoi giri, Le tue Mete, Rivivi i tuoi giri. Parola «Richieste» assente. Mete: 5 + «Vedi tutte» (56). Risultati: 56, 2, 326, 7,8 km. Rivivi: 3 giri; la scheda apre 3 tappe e «Rifai questo giro», che porta a `/map` con la card «Avvia». Collegamenti del Profilo (`/dashboard-user`, `/privacy`, `/termini`): tutte pagine piene. Nessun errore di pagina. `p-account-*.png` |
| 4b | Profilo, account vuoto reale (ospite) | **ok** | Entrato con «Prova un giro, senza account» (+ «Salta per ora»). Titolo «Viaggiatore», contatori 0·0·0, Rivivi «Finisci un giro e lo ritrovi qui, con la mappa e le tappe.», Mete vuote, Risultati «Tutto a zero…», nessun pulsante senza pagina. Controlli del DNA (Meno/Più per categoria), ritmo, compagnia, dieta, budget, stile presenti. `p-ospite-*.png` |
| 4c | Profilo, account di prova con registro e salvati svuotati (risposte di rete svuotate) | **ok** | Stesso risultato dell'ospite con l'account di prova; serve a distinguere un account nuovo dai dati. `p-vuoto-*.png` |
| 5 | Nomi della home (T27) | **ok** | «Su misura» con «Scrivi cosa cerchi. Città, gusti, budget, ritmo: il giro lo costruiamo da qui.» e etichetta «Gratis»; «Al volo» con «Tre scelte e sei in strada.»; nessun «AI POWERED», nessun «Crea il tuo Percorso» né «Quiz Veloce». Resta «Crea il tuo Tour» («Con una guida o a sorpresa»). `h-nomi-su-misura-al-volo.png` |
| 6 | Movimento della Landing (T30) | **ok** | Con movimento: animazioni attive `camera-lenta` e `curve-deriva`, il transform della foto cambia fra 1,5 s e 6,5 s (scala 1,0402 → 1,0439). Con «riduci movimento»: animazione `none`, nessuna animazione attiva, transform `none` e uguale. `m-landing-*.png` |
| 7 | Impostazioni (T29), «Su misura» con chip e frase | **ok, con un'osservazione** | Chip Cibo + «domani alle 10 una mattina a Roma, con una pasticceria», 31 s: 8 tappe, la prima «Pasticceria Leonardo Roma» alle 10:00, poi Piazza Navona, pranzo da Panzirone, Pantheon, Chiesa del Gesù, Da Vittorio Café, Piazza Navona (19:05), Osteria Navona 20:00. Il chip e la frase contano (pasticceria in testa, pasti veri). Osservazione sotto. `g-su-misura-*.png` |
| 8 | Impostazioni (T29), «Al volo» | **ok** | Città › Rioni Storici › Veloce 1-2 ore › Solo: «Da Via Margutta a Piazza di Spagna», 2 tappe 05:06–06:31, riga del DNA «Nei tuoi ultimi 5 giri 7 tappe su 12 erano di storia e cultura» (10 s). Orario di partenza = ora vera, rispettato. `g-al-volo-*.png` |

Non provato: nessun punto richiesto. Non è stato provato il profilo con un account davvero nuovo creato da zero con email (non si può di notte: serve il codice via email); l'ospite vero e l'account svuotato lo coprono.

## 3. Difetti e osservazioni (in ordine di gravità, nessuno corretto)

1. **Instabilità dei punti 4, 5 e 7 al primo giro** (bassa; sospetto di prova, non dimostrato). Al primo giro `page.reload` di `avvia()`/`riprendi()` ha dato «Frame load interrupted» due volte di fila, e al punto 7 «Avvia» non era cliccabile (30 s). Ripetuti subito dopo: passano. Il Mac era sotto carico (batteria, un solo processo alla volta). Se si ripresenta su un telefono vero è una gara fra la ricarica della pagina e un reindirizzamento dell'app dopo l'accesso: da guardare solo se qualcuno la vede.
2. **«Una mattina» scritto nella frase non accorcia il giro** (bassa, osservazione). In «Su misura» la durata non era scelta fra i chip (Mezza Giornata/1 Giorno/2-3 Giorni nessuno acceso) e la frase diceva «una mattina»: il giro è uscito di 8 tappe fino alle 20:00. Può essere voluto (la frase non è una durata), ma chi scrive «una mattina» si aspetta meno tappe. Piazza Navona compare due volte (10:21 e 19:05): ammesso dalla regola della sera (ancora, una volta sola nel giorno).
3. **Il Profilo mostra l'email per esteso** (non è un difetto: è il comportamento previsto), ma per le prove va mascherata negli screenshot.
4. **Il tasto «Prova un giro, senza account» sta solo su `/login`**, non sulla Landing `/`: l'ho scoperto perché la mia prova lo cercava sulla Landing. Non è un difetto accertato (la Landing può avere altri percorsi).

Errori di pagina (`pageerror`) durante i punti nuovi: zero.

## 4. Controlli di merge

| Controllo | Esito |
|---|---|
| `npm run test:run` | 293 file, 3622 test verdi |
| `npm run lint` | 0 errori (185 avvisi già presenti) |
| `npm run build` | ok |
| `npm run banco:guardia` | home 12/12, banco 10/10, pertinenza senza ❌ nuovi (3 già noti) |

## 5. Costo

Stima a listino, non misurata: il collaudo di base fa 3 Per Te a Roma/Catania, racconti e curiosità (in gran parte da cache), quello nuovo un Per Te, un «Su misura» e un «Al volo». Ordine di grandezza **1,0–1,5 $**, sotto il tetto di 3 $. L'account di prova non consuma contatori (ticket `label = 'test'`). L'ospite vero passa dai limiti degli ospiti (1 giro `itinerary` per account): il giro del punto 7 da ospite del collaudo di base e l'ingresso del Profilo hanno usato più account anonimi (nessuno tocca i contatori dell'account di prova).

## 6. Cosa NON risolve / cosa aspetta Ivano

- Non è il collaudo sul codice bloccato del 22/11: **L8 resta «da fare»** per il testo della sua riga.
- Su iPhone vero servono ancora solo voce umana, audio in tasca, GPS reale e rete reale (CLAUDE.md).
- Da decidere: se gli accessi anonimi accesi oggi sono voluti.
- Non provato qui: Per Te in ore diverse da quelle della notte (all'01:00 e alle 20:00 coperto dal punto 11 del collaudo di base con orologio finto; di giorno pieno non provato con ora vera).

## 7. File

- Report: `docs/prove/2026-11-07-collaudo-finale.md`
- Script: `scripts/prova-nav/collaudo-finale.webkit.mjs` (nuovo), `scripts/prova-nav/collaudo-sito.webkit.mjs` (solo `COLLAUDO_OUT`)
- Dati: `docs/prove/dati/2026-11-07-collaudo-finale*.json`
- Schermate: `docs/prove/schermate/collaudo-finale/` (WebKit iPhone 14)
