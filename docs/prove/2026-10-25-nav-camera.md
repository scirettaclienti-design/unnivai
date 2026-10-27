# NAV-CAMERA — la mappa del giro è un'esperienza continua

Ramo `nav-camera` → `main` (codice `2a213f0`). Lavoro fatto in `~/unnivai-1b` (nessun'altra sessione Claude lì, ramo nuovo da `origin/main`). Non toccati: logica di arrivo, segnale perso, ripresa, ordine delle tappe, motore dei giri, `openai-proxy`, migrazioni, mappa di Esplora.

## Cosa cambia per Ivano

1. **Si apre sempre scura.** La mappa del giro (anche prima di navigare) è Ossidiana con `colorScheme: DARK`, **dall'alto** (inclinazione 0, nord in alto), con **tutte le tappe** nell'inquadratura, i segnaposti numerati spostati perché non si sovrappongano, il **tracciato arancione** con l'alone e la card in basso: titolo, «Giornata 9:30–21:15 · 41 min a piedi · 3,0 km · 12 tappe», **Avvia** (e un piccolo «Cambia mezzo»). Niente ricerca città né meteo; il tasto indietro ha la sua riga.
2. **«Avvia» parte subito** (prima apriva un pannello e serviva un secondo tocco su «Avvia Navigazione»). La camera **vola su di te in ~1,5 s** — zoom 18, inclinazione 50°, edifici 3D — poi ti segue con l'orientamento nella direzione di marcia (bussola; se manca, il percorso davanti a te; se manca, la prossima tappa), lisciato a ogni posizione. Via il toast «Navigazione avviata» che copriva la scheda.
3. **Il colore segue l'ora**: `VITE_GOOGLE_MAP_ID_NAV_MATTINA` (fino a 2 h dopo l'alba), `_TRAMONTO` (da 1 h prima a 30 min dopo), `_NOTTE`; il resto del giorno Ossidiana. Alba e tramonto veri. La mappa della fascia si prepara **sotto** durante il volo e compare in dissolvenza di 600 ms; poi la vecchia viene rilasciata. Una volta per fascia, anche se cambia durante il cammino. Se una variabile manca, resti su Ossidiana.
4. **Partenza**: prima del primo passo una **freccia grande** al centro punta la direzione fisica verso la prima tappa («Parti da qui verso Porta Uzeda») e sparisce dopo 10 m nel verso giusto.
5. **«Vista giro»** torna alla panoramica dall'alto; **«centra»** rivola su di te.
6. **Miniatura nella scheda in basso**: foto vera di Places, oppure niente (mai stock, mai segnaposto).
7. Il vincolo «inclinazione 0» del prompt Ossidiana è annullato (vale solo per la panoramica).

## Prova di 10 minuti per Ivano

1. Sul telefono apri un giro (Crea o Per Te) → **Vedi su Mappa**. Deve apparire **scura, dall'alto, con tutte le tappe** e il tracciato arancione (2 min).
2. Controlla la card: giornata, cammino, km, tappe. Il tasto indietro non copre niente (1 min).
3. Tocca **Avvia**: una freccia grande ti dice dove girarti; la camera vola su di te, la mappa si inclina e gli edifici si alzano; **nessun lampo** (3 min).
4. Cammina 10–15 m verso la prima tappa: la freccia sparisce; la mappa ruota nella direzione in cui vai (2 min).
5. Premi **Vista giro** (torna alla panoramica) e **centra** (rivola su di te) (1 min).
6. Quando avrai i Map ID di mattina/tramonto/notte: mettili su Vercel (Production e Preview), riavvia il deploy e ripeti il punto 3 alle tre ore: il colore cambia in dissolvenza (1 min).

## Fatto quando

| Richiesta | Esito |
|---|---|
| Prova WebKit su un giro di Catania, GPS simulato, ora finta su 3 fasce (10:00, 17:40 al tramonto, 21:30) | ✅ `scripts/prova-nav/nav-camera.webkit.mjs`, giro `navsim-catania` (12 tappe), 24/10/2026; più 8:00 per la mattina. Camera misurata: panoramica zoom 16 / tilt 0 / heading 0; dopo il volo **zoom 18 / tilt 50 / heading 335°** in tutte le fasce |
| Screenshot in sequenza: panoramica scura → volo → cammino inclinato nel colore della fascia | ✅ `docs/prove/schermate/nav-camera/sequenza-tramonto-1740.png` e i fotogrammi per fascia |
| Affiancati alle schermate 1, 5, 6, 7, 9 del canvas | ✅ `affiancato-1-cammino.png` (↔ cammino 10:00), `affiancato-5-panoramica.png` (↔ panoramica), `affiancato-6-mattina.png` (↔ 8:00), `affiancato-7-tramonto.png` (↔ 17:40), `affiancato-9-notte.png` (↔ 21:30) |
| Nessun fotogramma bianco nel passaggio | ✅ 4 fasce × 20 fotogrammi del volo: **0 fotogrammi bianchi** (campione sul 60×130 px ridotto, soglia 50 % di pixel quasi bianchi; lo sfondo dei due strati è Ossidiana) |
| Dissolvenza | ✅ misurata: al cambio di fascia la seconda mappa compare a opacità 0, poi 1 con transizione di 600 ms, la vecchia è rilasciata ~700 ms dopo (campioni a 50 ms: `strati` 1 → 2 → 1). Una volta per fascia; senza il Map ID della fascia nessuna dissolvenza (test) |
| «Niente scatti su iPhone: apertura della mappa e durata della dissolvenza prima/dopo» | ✅ apertura **506 ms prima / 500 ms dopo**; stacco all'avvio **224 ms senza mappa prima / 0 ms dopo** (prima: la mappa veniva ricreata al tocco, dopo: stessa mappa o dissolvenza); dissolvenza: prima nessuna (stacco), dopo 600 ms. WebKit profilo iPhone 13, non un iPhone vero |
| Suite verde | ✅ 217 file / **2647 test** (+ nuovi: `navCamera` 18, `mappaGiroDissolvenza` 6, `segnaposti` 5; aggiornati i 4 file `mapPageNav*` a «Avvia parte subito») |
| Lint 0 errori | ✅ 0 errori, **190 avvisi** (prima 193) |
| Build ok | ✅ |
| Guardia 12/12 | ✅ 12/12, pertinenza nessun ❌ nuovo |
| Replay NAV-SIM senza peggioramenti | ✅ Catania: **10/12 arrivi da soli, 2 domande, 0 falsi arrivi, 0 domande sbagliate** (identico a NAV-3); il giro ora risulta «completato» (prima il file diceva `false`) |
| Merge su main, deploy READY | ✅ `2a213f0` su `main`, deploy `unnivai-pug758w48` READY, CI verde. **Sul sito pubblicato** (account di prova, giro di Catania di 13 tappe, `docs/prove/schermate/nav-camera/live/`): card «Monumentale Via di Catania · Giornata 8:30–21:15 · 13 tappe» con «Avvia» e «Cambia mezzo»; tasto indietro libero (y 8–54, filo sotto); navigazione su mappa scura Ossidiana con la scheda di arrivo e la **miniatura con la foto vera** della Fontana dell'Elefante. Limite della prova live: lo script non da' la posizione prima di «Avvia», quindi la panoramica live resta su «Preparo la mappa» (il centro aspetta il GPS, come sempre); la panoramica completa è provata in locale |

## Voci di `claude/CORREZIONI_TOUR_NAV.md` (23, 27, 42, 43, 44, 48)

**Non ho potuto chiuderle per numero: il file non esiste** (cercato in `~/unnivai-1b`, nel repository e in `~` fino a 4 livelli). Ho lavorato sulle descrizioni del compito; dimmi quali voci corrispondono a cosa e le chiudo a mano nel file:
- panoramica scura/ordinata con tutte le tappe e segnaposti separati;
- «Avvia» → volo senza stacco;
- camera inclinata con edifici 3D e orientata nella direzione di marcia;
- colore per fascia in dissolvenza;
- freccia di partenza;
- miniatura solo con foto vera.

## `git log --oneline -5 main`

```
2a213f0 NAV-CAMERA: la mappa del giro è un'esperienza continua — panoramica Ossidiana dall'alto, «Avvia» parte subito, volo della camera ~1,5 s, cammino inclinato nella direzione di marcia, colore della fascia in dissolvenza
2b5641f DNA-RIQUADRO: le righe del DNA non mostrano percentuali — «Più X: è tra i tuoi gusti più forti.», prime 2 categorie presenti nel giro
6d25891 DURATE-ETICHETTE: report con test, screenshot dei tre punti e limiti della prova dal vivo
f76dbaf DURATE-ETICHETTE: ogni durata dice cosa misura — «Giornata 9:30–21:15» per il giro, «1h 33 a piedi · 6,9 km» per il cammino
40c89db DNA-RIQUADRO: report, prove dal vivo e screenshot
```
(il commit di questo report segue)

## Cosa NON risolve

- **I Map ID delle fasce non ci sono**: `_MATTINA`, `_TRAMONTO`, `_NOTTE` non sono impostati su Vercel (non li ho). La dissolvenza è provata con Map ID di prova (il pubblico `DEMO_MAP_ID` e il Map ID di base): in produzione, finché non li metti, **la navigazione resta Ossidiana a tutte le ore**. `.env.example` ha le tre variabili vuote.
- **Assunzione**: tutte le mappe di fascia si creano con `colorScheme: DARK` (come Ossidiana). Se lo stile «mattina» chiara del canvas fosse assegnato alla modalità chiara del suo Map ID, serve una piccola modifica (un colorScheme per fascia).
- **Bussola vera non provata**: in WebKit non c'è. Il codice la chiede dentro il tocco su «Avvia» (iOS) e la usa se arriva (`webkitCompassHeading`/`deviceorientationabsolute`); senza, il giro usa la direzione del percorso (provato). Il permesso iOS apparirà al primo «Avvia».
- **Durante la dissolvenza** (600 ms) marker, tracciato e posizione passano dalla mappa vecchia alla nuova solo alla fine: possono sparire e riapparire per un attimo (non lo schermo: lo sfondo non è mai bianco).
- **I segnaposti vicini si separano ma non sempre del tutto**: nella panoramica di Catania a zoom 16 qualche coppia si tocca ancora (la separazione ha un tetto di 70 px per non scollegare il segnaposto dal suo luogo).
- **Avvia parte subito**: il pannello del mezzo (auto/piedi/bici) ora si apre da «Cambia mezzo» sulla card. Scelta mia, per rispettare «al tocco su Avvia, senza stacco».
- Il canvas «DoveVAI — Navigazione» non è stato modificato (usato solo come riferimento): le schermate 5 (fine giro), 6, 7, 9 sono diverse dalla panoramica; 5 l'ho confrontata con la panoramica come indicato.
- Prove solo in WebKit con profilo iPhone 13 e GPS finto; nessun iPhone vero.

## Cosa ho dato per vero senza verificarlo

- Che `DEMO_MAP_ID` e il Map ID di base si comportino come i tuoi Map ID di fascia (stesso meccanismo di caricamento).
- Che «idle» del primo caricamento della mappa nuova significhi tessere pronte (c'è un tetto di 4 s dopo cui compare comunque).
- Che il campione 60×130 px dello screenshot basti a vedere un lampo bianco di 1–2 fotogrammi (gli screenshot hanno una latenza ~0,1–0,3 s: un lampo di meno di quel tempo potrebbe sfuggire; per questo il fondo dei due strati è scuro e la nuova mappa compare solo a tessere pronte).
- Che alba e tramonto di `sunTimes` (la stessa regola del buio dell'app) siano quelli «veri» del posto.
- Che 50° sia dentro «45–55» nel modo che intendevi (zoom 18 e tilt 50 fissi; il tetto/pavimento 17–18 e 45–55 è in `cameraNav`).

## Processi

Vite di prova (5191, 5192) e il replay NAV-SIM chiusi; nessun mio processo è rimasto acceso.
