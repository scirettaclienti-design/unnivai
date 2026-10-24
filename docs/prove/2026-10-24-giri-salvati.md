# GIRI-SALVATI — un giro salvato si riapre identico dal Profilo (modifiche comprese)

Ramo `giri-salvati` → `main` (codice `1e70117` + `3aacab3`), deploy READY, CI verde. **Nessuna modifica allo schema del database** (vedi «Schema»).

## Cosa non andava

- Il giro salvato teneva solo titolo e coordinate di ogni tappa: **niente orari, soste, momenti, testi, righe di «Tempo libero»**. Riaprirlo identico era impossibile.
- La card in Profilo › Mete › Giri salvati **non faceva niente** al tocco (solo il tasto per rimuovere).
- Dopo «Togli»/«Cambia» il tasto «Salva il giro» restava «Salvato» (stato del componente): il giro modificato non si poteva salvare.

## Cosa fa adesso

| | |
|---|---|
| **Salva** | `giroDaSalvare` salva l'**istantanea** di ogni riga del giro (anche «Tempo libero»): tutto ciò che le schede mostrano e che servono a «Togli»/«Cambia» (orari, soste, momento, testo, foto, tipi, orari di apertura); via i campi di diagnosi del motore (`_tracciato`, `_comp`, …). L'id del giro include gli orari: lo stesso giro due volte = una riga; un giro con una tappa in meno = un giro nuovo (l'originale resta) |
| **Riapre** | tocco sulla card → il riepilogo del giro (lo stesso del Quiz: tappe per momento, orari, «Tempo libero» con la sua fascia, **«Vedi mappa»**, «Togli»/«Cambia», «Salva il giro») dalle tappe salvate. **Nessuna chiamata AI né a Google** (0 $). «Vedi mappa» apre `/map` con quel giro |
| **Salva dopo Togli** | `SalvaGiro` ricorda l'id salvato: se il giro cambia, torna «Salva il giro» |
| **Giri vecchi** | salvati prima (solo titolo e coordinate) si riaprono con quello che hanno |
| **Tetti** | l'istantanea sta nei tetti attuali della tabella (30 righe, 20.000 byte): se un giro è troppo grande perde prima gli orari di apertura, poi le foto, mai la riga |

## Fatto quando

- ✅ **Test che salva un giro, gli toglie una tappa, lo salva e lo riapre, e ottiene le stesse tappe e gli stessi orari**: `src/__tests__/lib/giriSalvatiRiapertura.test.js` (6): riapre l'originale identico (titolo, orario, sosta, momento, testo, tempo libero), toglie la Cattedrale con `togliDalGiorno`/`tourConGiorno` come la scheda, salva, riapre: identico al modificato; l'originale resta com'era; nessun `fetch`. Più un giro di 13 tappe con foto lunghe che sta nel tetto vero della tabella.
- ✅ **Tocco sulla card in Profilo → apre il giro con «Vedi mappa»**: `profilo_dna6.test.jsx`: la card si apre, mostra tappe e orari salvati, «Vedi mappa» chiama `navigate('/map', { state: { tourData, isAiGenerated } })` con le stesse tappe e orari; nessun `fetch`.
- ✅ **Prova dal vivo con l'account di prova** sul sito pubblicato (`scripts/prova-giro-edit/giri-salvati.webkit.mjs`, `docs/prove/dati/2026-10-24-giri-salvati-live.json`, screenshot `2026-10-24-giri-salvati-profilo.png`, `…-riaperto.png`): «domani un giorno a Catania» → 13 tappe → «Salva il giro» (POST `saved_tours` 201) → «Togli» sulla terza → 12 tappe → «Salva il giro» (POST 201) → Profilo › Mete: le card «12 tappe» e «13 tappe» → tocco sulla prima: **12 tappe, stessi nomi e orari (09:30 Caffè Puglisi … 20:00 La Pentolaccia), stesso «Tempo libero 11:26–12:21», «Vedi mappa» presente**; **richieste ad AI e Google dal tocco in poi: 0 e 0**; «Vedi mappa» → `/map`.
- Spesa: ≈0,25 $ (4 generazioni nelle prove: due prove interrotte da difetti dello script, che non salvava il secondo giro o confrontava male le righe).

## Controlli

Suite 212 file / **2587 test verdi**; lint 0 errori, 191 avvisi (come `main`); build ok; guardia 12/12, pertinenza nessun ❌ nuovo; CI verde su `3aacab3`.

## Schema

**Nessun cambiamento allo schema.** Avevo preparato una migrazione che alzava i tetti di `saved_tours.stops` (40 righe / 60.000 byte); `supabase db push` è stato **negato dal sistema di autorizzazione** e non ho cercato altre vie: ho invece tenuto l'istantanea dentro i tetti attuali. La migrazione resta come proposta in `docs/proposte/saved_tours_tetti_piu_alti.sql.proposta` (non in `supabase/migrations`): serve solo se vuoi giri più grandi di quelli che entrano oggi (circa 13 tappe con foto e orari di apertura ci entrano).

## `git log --oneline -5 main`

```
3aacab3 GIRI-SALVATI: dopo «Togli» o «Cambia» il tasto torna «Salva il giro» (il giro è un altro); script della prova dal vivo
1e70117 GIRI-SALVATI: il giro si salva per intero (tappe, orari, soste, tempo libero) e si riapre dal Profilo com'era, con «Vedi mappa» e senza generare (0 $)
01ee207 MAPPA-STILE: report, prova dal vivo e screenshot affiancati (in attesa del Map ID)
cb59db7 MAPPA-STILE: la navigazione usa lo stile Google (Map ID da VITE_GOOGLE_MAP_ID_NAV), via i 4 filtri CSS, il tasto indietro non è più coperto dal filo, tratti leggibili (≥ 3:1)
23efa6f VERITA-TESTI: report con la causa della colazione mancante, i 5 punti, i controlli e la prova di 10 minuti
```
(l'ultima riga è il commit di questo report quando sarà pubblicato)

## Cosa NON risolve

- **Un giro modificato è un giro nuovo**, non aggiorna quello vecchio: dopo «Togli» + «Salva» in Profilo ci sono due card (13 e 12 tappe). Sostituire la riga vecchia richiederebbe un `UPDATE` che la tabella oggi non permette (solo select/insert/delete): decisione tua.
- **«Togli»/«Cambia» dal giro riaperto in Profilo non si salvano da sole**: si cambia la scheda aperta, poi «Salva il giro» (crea un'altra riga).
- Un giro oltre i tetti della tabella perde foto e orari di apertura (la riapertura funziona, «Cambia» sulle tappe senza orari di apertura non può controllare la chiusura).
- Prova solo in WebKit con profilo iPhone 13; nessun iPhone vero.

## Cosa ho dato per vero senza verificarlo

- Che il tetto vero di `pg_column_size(stops)` si comporti come `JSON.stringify(...).length × 1,1` (stima mia; il giro di 13 tappe è entrato dal vivo, ma il margine non l'ho misurato sul server).
- Che l'account di prova veda solo le sue righe (RLS) e che le righe `label = 'test'` del server non influiscano sulla lista.
- Che la riapertura sia «identica» in ciò che le schede mostrano; non ho confrontato campo per campo tutti gli attributi interni (es. `rating`, `insiderTip`) fra il giro generato e quello riaperto, solo nome, orario, momento, testo, sosta, tempo libero (test) e nome/orario/fascia (dal vivo).
- Le tre prove dal vivo precedenti alla riuscita hanno lasciato 4 giri nel Profilo dell'account di prova (13, 12, 11 e 12 tappe).

## Processi

Nessun server avviato da me; i browser Playwright si chiudono a fine script.
