# GIRO-LONTANO — un giro di Catania guardato da Roma (30/10/2026)

Cartella `/Users/mac2023ivanosciretta/unnivai-curiosita` (verificata con `pwd`), ramo `fix/giro-lontano` da `origin/main` (`975463d`). Racconti, voce, freccia di partenza, segnaposti e motore che sceglie le tappe **non toccati**.

## Diagnosi (prima della correzione)

Riprodotta in WebKit (iPhone 13) con il GPS finto in piazza di Spagna e il giro `navsim-catania` (12 tappe).
- In locale: `scripts/prova-nav/giro-lontano.webkit.mjs`, `FASE=mappa NAV_TAG=prima`.
- Sul sito pubblicato, con gli stili veri della navigazione: `scripts/prova-nav/giro-lontano-prod.webkit.mjs`.
- Dati in `docs/prove/dati/2026-10-30-giro-lontano-*.json`, schermate in `docs/prove/schermate/giro-lontano/`.

**Dove entra la posizione dell'utente**

| Numero a schermo | Da dove viene | Prima |
|---|---|---|
| Card della panoramica «Giornata 9:30–21:15 · **93h 14 a piedi · 671,0 km** · 12 tappe» e pannello del mezzo «**5594 min**» | `MapPage.jsx`, `routePoints` dell'anteprima: con una posizione nota il percorso per Google Directions **parte da te** (`{ title: 'Tu' }` davanti alle tappe), a qualsiasi distanza. `routeStats` somma quindi anche Roma→Catania a piedi. | sempre, se il GPS risponde |
| Pillola «**537,4 km** · verso Porta Uzeda» e scheda «PROSSIMA · **7166 MIN**» | `handleStartNavigationReal` → al primo segnale `percorsoDa(coords)`: il percorso dal vivo parte da te. La distanza e i minuti sono quelli fino alla tappa 1. | dopo «Avvia» |
| Inquadratura | la panoramica ti includeva solo entro ~0,3° (`posizioneUtenteRef`): già giusta da Roma, non dipendeva però da «lontano» | — |
| Orari del giro (Crea) | la generazione **non usava mai** la posizione. Senza un orario scritto Crea parte «da adesso» (`resolveTourWindow`, reason `now`): alle 15:00 a Roma, «un giro a Catania» usciva Pomeriggio · Aperitivo · Cena di oggi, con la prima tappa alle 15:00 a 535 km. In città, invece, la tappa 1 era alle 15:00 anche se ci volevano 10 minuti per arrivarci. | sempre |

**Perché la mappa diventa nera in navigazione** (sito pubblicato, 19:30, `prod-prima-avvia-6000.png`):
- «Avvia» → primo segnale → `flyToUser` → la camera vola **su di te a Roma**, zoom 18, inclinata, nello stile notte.
- Il percorso a piedi Roma→Catania Google non lo calcola: «Non riesco a calcolare il percorso fin qui».
- Quindi sullo schermo non c'è **nessuna tappa e nessun tratto**: solo strade scure di Roma a zoom 18. È questa la «mappa nera».
- Con «Riprendi» la camera resta sopra Catania, nello stile notte, con una linea che sale fino a Roma.
- In locale non si vede, perché `.env` non ha gli ID degli stili della navigazione (`VITE_GOOGLE_MAP_ID_NAV_*`).

## Cosa è cambiato

- **`src/lib/giroLontano.js`** (nuovo, puro):
  - `distanzaDalGiro` (soglia `SOGLIA_LONTANO_KM = 20`; senza posizione = lontano);
  - `primaTappa`, `minutiFinoAllaTappa` (stessa velocità del giro), `kmDetti`;
  - `leggiPosizione`: una lettura del GPS, va bene una posizione di al massimo 5 minuti fa, null se negata o muta; non chiede di nuovo un permesso già negato.
- **Panoramica** (`MapPage.jsx`):
  - oltre 20 km dalla tappa 1 (o senza posizione) il percorso dell'anteprima **non parte da te**: durata e km della card e del pannello del mezzo contano solo il cammino fra le tappe;
  - l'inquadratura ti include solo se non sei lontano.
- **«Avvia» da lontano**:
  - se la posizione è nota ed è oltre 20 km dalla prossima tappa: niente navigazione, niente tracciamento. Nella card resta «**Sei a 537 km da Catania: la guida parte quando sei lì.**» e la panoramica si può consultare. Il primo rilascio lo ripeteva anche in un toast, che sul sito pubblicato copriva il testo della card e il tasto «Avvia»: tolto.
  - Se «Avvia» parte senza posizione (NAV-1: tappe segnate a mano) e il **primo segnale** arriva da lontano: la guida si ferma prima del volo della camera e torna la panoramica con lo stesso messaggio.
  - Un giro appena avviato non resta «in corso»; uno ripreso resta salvato, per quando sei lì.
- **Orari di Crea**:
  - `AiItinerary` legge la posizione all'apertura e la passa (`posizioneUtente`, null se non c'è).
  - Il servizio decide se sei lontano **dal centro della città del giro**: alla generazione la tappa 1 non esiste ancora.
  - **Lontano** e nessun orario scritto → `resolveTourWindow({ lontano })` dà **domani, giornata intera dalle 9:30** (reason `lontano`). Un orario o un giorno scritti («alle 17», «sabato», «stasera», «oggi») vincono come prima.
  - **In città** e nessun orario scritto → il giro parte **da adesso più il cammino fino alla tappa 1** (`_partenzaDalCammino`). La tappa 1 si conosce solo dopo la scelta, quindi gli orari si spostano con lo stesso ricalcolo che la cache fa già (G1.1: inizio + gli intervalli salvati, frasi ricomposte), con `soloCache`. **Mai una seconda generazione**: se il giro non è in cache, gli orari restano quelli di prima.
  - La regola vale solo quando chi chiama passa `posizioneUtente`. Banco, replay e rigenerazione del giorno non la passano e restano identici (guardia 12/12).
- **Etichetta** in testa al giro di Crea: «**Domani · 9:30 · cambia**».
  - «cambia» riporta alla richiesta, con il testo già scritto e il cursore nel campo.
  - Nell'app **non esiste un selettore dell'orario** per un giro (cercato in tutte le pagine; QuickPath l'ha tolto con Gate ORA VERA). L'unica scelta dell'orario che esiste è scriverlo nella richiesta («sabato alle 10»), letta da `tourWindow`.
- **Testi nuovi** in `src/lib/navMessaggi.js`: `LONTANO_AVVIA`, `LONTANO_CAMMINO` (pronto, non usato a schermo), `PARTENZA_DOMANI`, `PARTENZA_CAMBIA`, `PARTENZA_CAMBIA_ETICHETTA`.

## Prove

**Test (0 $)**
- `src/__tests__/pages/mapPageLontano.test.jsx` (MapPage montata):
  - utente **in città** (300 m): la panoramica parte da te e «Avvia» guida;
  - utente **a ~535 km**: percorso solo fra le tappe, «Avvia» non apre il tracciamento e dice «Sei a 5xx km da Catania…», nessun giro salvato;
  - **posizione negata**: percorso fra le tappe, «Avvia» parte (NAV-1);
  - «Avvia» senza posizione e **primo segnale da Roma**: la guida si ferma e torna la panoramica con il messaggio.
- `src/__tests__/lib/giroLontano.test.js` (13 test):
  - distanza e soglia di 20 km;
  - `leggiPosizione` (ok, negata, permesso negato, GPS muto);
  - finestra di Crea: lontano → domani 9:30–22:30; in città → da adesso; un orario scritto vince; il Percorso Veloce non cambia;
  - `_partenzaDalCammino`: da lontano «domani»; in città ricalcolo con `ritardoMinuti` e `soloCache`; senza cache gli orari restano; con un orario scritto nessuno spostamento; `soloCache` senza cache risponde null senza toccare la rete.
- `src/__tests__/pages/testiAiItinerary.test.js`: «Domani · 9:30 · cambia», «cambia» riporta alla richiesta con il testo; `posizioneUtente` passata (null); in città nessuna etichetta.

**WebKit (iPhone 13, ora finta 30/10 15:00)**

| Caso | Prima | Dopo |
|---|---|---|
| Giro `navsim-catania` sulla mappa, GPS a Roma | card «93h 14 a piedi · 671,0 km»; «Avvia» guida: «537,4 km», «7166 MIN» | card «**39 min a piedi · 2,9 km**» (solo fra le tappe); «Avvia» non guida, «Sei a 537 km da Catania: la guida parte quando sei lì.»; nessuna distanza da Roma a schermo; schermo non nero (luminanza media 208, contrasto 55) |
| Stesso giro, GPS a Catania (300 m dalla tappa 1) | «44 min · 3,2 km», guida | invariato: «44 min · 3,2 km» da te, la guida parte, «4 MIN» alla tappa 1 |
| **Crea, «un giro a Catania», GPS a Roma** (giro vero, 35 s) | — | «**Domani · 9:30 · cambia**», prima tappa **09:30**, card «Giornata 9:30–21:15 · 24 min a piedi · 1,7 km · 12 tappe», «Avvia» → «Sei a 537 km da Catania: la guida parte quando sei lì.» |
| **Crea, «un giro a Catania», GPS in via Etnea** (giro vero, 31 s) | — | nessuna etichetta; prima tappa **15:03** = 15:00 + 3 minuti a piedi fino alla tappa 1; card «Giornata 15:03–21:18 · 10 min a piedi · 752 m · 7 tappe» (da te); la guida parte, «3 MIN» |

Due giri veri con l'account di prova (nessun contatore). Sul sito pubblicato, dopo il deploy, la stessa prova con gli stili veri della navigazione: vedi «Dopo il deploy».

**Controlli**
- Suite verde: 237 file, 2919 test.
- Lint: 0 errori (190 avvisi già presenti).
- Build ok.
- `npm run banco:guardia`: 12/12, pertinenza senza ❌ nuovi.

## Prova di 10 minuti su iPhone (a Roma, poi in una città)
1. A Roma, posizione accesa, apri **Crea** e scrivi «un giro a Catania» senza orario. In testa al giro: «Domani · 9:30 · cambia»; la prima tappa è alle 9:30.
2. Tocca «cambia»: torni alla richiesta con il testo già scritto. Aggiungi «sabato alle 10» e rigenera: niente etichetta, il giro parte sabato alle 10.
3. «Vedi su Mappa»: la card dice pochi km e minuti (solo fra le tappe, mai centinaia di km o di ore); la mappa inquadra le tappe di Catania, non Roma.
4. Premi «Avvia»: nessuna navigazione, nella card «Sei a 5xx km da Catania: la guida parte quando sei lì.»; la mappa resta chiara e consultabile, **mai nera**.
5. «Cambia mezzo»: anche lì i minuti sono quelli fra le tappe.
6. Ora, a Roma, scrivi «un giro a Trastevere» senza orario: niente etichetta; la prima tappa è adesso più i minuti a piedi per arrivarci.
7. «Vedi su Mappa» → «Avvia»: la guida parte normalmente, la pillola dice pochi metri o minuti.
8. Togli il permesso della posizione (Impostazioni › Safari › Posizione) e genera un giro: parte domani alle 9:30 (senza posizione vale come lontano); «Avvia» parte lo stesso e le tappe si segnano a mano.
9. Riattiva la posizione da lontano con un giro in corso: alla ripresa la guida si ferma con il messaggio e il giro resta salvato.
10. Dimmi se «Domani · 9:30» va bene come testo, e se «cambia» deve aprire un selettore vero (oggi non esiste: vedi sotto).

## Cosa NON risolve
- **«cambia» non apre un selettore dell'orario**, perché l'app non ne ha uno: riporta alla richiesta, dove il momento si scrive. Un selettore vero (giorno e ora) è una funzione nuova: proposta, non fatta.
- **Alla generazione «lontano» si misura dal centro della città** (la tappa 1 non c'è ancora). Un giro con il centro entro 20 km ma la tappa 1 oltre 20 km parte «da adesso». Sulla mappa la regola usa comunque la tappa 1.
- **La partenza in città sposta tutti gli orari dello stesso numero di minuti**, come già fa la cache (G1.1): anche il pranzo slitta di quanto dura il cammino fino alla tappa 1. Se il giro non è in cache (per esempio un narratore caduto), resta «da adesso».
- **Senza posizione, Crea vale come lontano**: anche chi è in città con il GPS negato riceve un giro da domani alle 9:30 (come chiesto). «Avvia» senza posizione parte come prima (NAV-1).
- **Percorso Veloce, Per Te, Quiz e Sorprendimi non cambiano**: partono da dove sei, da adesso (regola di Ivano in `tourWindow`).
- **La rigenerazione del giorno in Crea** («Rigenera») non passa la posizione: resta com'era.
- **Prova solo in WebKit, non su un iPhone vero** (GPS vero, bussola, stili scuri a zoom 18).
- **Il tasto tondo «Vai alla mia posizione» tocca l'angolo in alto a destra di «Avvia»**: succedeva già prima (`prod-prima-avvia-0-panoramica.png`); con la riga del messaggio la card è più alta e lo copre un po' di più. Non toccato (fuori incarico): proposta, ancorarlo sopra la card.

## Dopo il deploy (sito pubblicato, stili veri della navigazione)

Commit `207ada7`: CI verde, deploy di Vercel completato. `giro-lontano-prod.webkit.mjs … avvia`, GPS a Roma, ore 19:30 (stile notte):
- **prima** (`prod-prima-avvia-6000.png`): card «93h 14 a piedi · 671,0 km»; dopo «Avvia», camera su Roma a zoom 18 inclinata, «537,4 km · verso Porta Uzeda», «7166 MIN», nessuna tappa né tratto a schermo (la «mappa nera»);
- **dopo** (`prod-dopo-avvia-6000.png`): card «Giornata 9:30–21:15 · 39 min a piedi · 2,9 km · 12 tappe»; dopo «Avvia» la panoramica resta sulle 12 tappe di Catania con i tratti fra le tappe (camera zoom 16, inclinazione 0), e nella card «Sei a 537 km da Catania: la guida parte quando sei lì.». Nessun nero.

In quella prova il toast copriva metà della card: tolto nel commit `114d436` (CI verde, deploy completato). Rifatta la prova (`prod-dopo2-avvia-3000.png`): card «… 39 min a piedi · 2,9 km · 12 tappe», sotto «Sei a 537 km da Catania: la guida parte quando sei lì.», panoramica delle tappe, nessun toast sopra.

## `git log --oneline -5 main`

```
114d436 GIRO-LONTANO: il messaggio «Sei a … km» resta solo nella card (il toast lo ripeteva e copriva «Avvia» sul sito pubblicato); report con la prova dopo il deploy
207ada7 GIRO-LONTANO: da più di 20 km dalla tappa 1 (o senza posizione) la panoramica conta solo il cammino fra le tappe, «Avvia» non guida verso un punto a 500 km e lo dice (niente più mappa nera); Crea senza orario parte domani alle 9:30 da lontano («Domani · 9:30 · cambia») e da adesso più il cammino fino alla tappa 1 in città; prove WebKit e report in docs/prove
975463d MIGRAZIONI-STORIA: nel repo la migrazione 20261028164601_unnivai_waitlist_and_city_interest identica a quella applicata in produzione (md5 uguale); db push --dry-run elenca solo place_racconti, place_racconti_verifica, ai_quota_tetto_contorno; diagnosi e comandi di rilascio nel report RACCONTO-R4
ad81a9b RACCONTO-R4: prompt «ogni frase su un fatto delle fonti» e una sola riscrittura dopo il «no» del revisore (stessi controlli, stessi divieti); versione r4 solo per gli scartati, r3 passati validi; Catania 7/6/7 su 8 in 3 lanci (prima 2/4/3), report in docs/prove
0aed80d CURIOSITA-CITTA: ogni curiosità porta la sua città; a schermo e a voce solo quelle della città del giro (a Catania non esce più Roma), prova WebKit su Catania, diagnosi in docs/prove
```
(prima del commit di questo report)
