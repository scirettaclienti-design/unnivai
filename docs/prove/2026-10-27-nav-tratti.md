# NAV-TRATTI — il percorso si legge come una guida (2026-10-27)

Ramo `nav-tratti` da `origin/main` (`cac4767`), cartella `~/unnivai-1b`.

## 1. Diagnosi (scritta prima della correzione)

**Sintomo** (iPhone, produzione, 27/10, Roma): in navigazione il tratto verso la prossima tappa non è arancione, ma grigio-bianco come il resto.

**Riprodotto** sul sito pubblicato (`https://unnivai.vercel.app`, commit `cac4767`) con WebKit (iPhone 13), GPS simulato, sul giro di Catania (12 tappe) di NAV-SIM. Lo script (`scripts/prova-nav/tratti.webkit.mjs`) intercetta ogni `Polyline` che l'app mette sulla mappa e ne registra colore, spessore, punti di inizio e fine. Dati: `docs/prove/dati/2026-10-27-nav-tratti-produzione.json`, schermate `docs/prove/schermate/nav-tratti/produzione-*.png`.

| momento | tratti sulla mappa | colori |
|---|---|---|
| panoramica (prima di «Avvia») | 12 | tutti `#F97316` (arancione) ✔ |
| **inizio** (appena partito, verso la tappa 1) | 12 | **tutti `#8F8880` (grigio)**, nessun arancione |
| **metà tratto** verso la tappa 1 | 12 | **tutti `#8F8880`**, nessun arancione |
| dopo l'arrivo alla tappa 1 | 12 | 1 arancione (tappa 1 → tappa 2, di 3 punti), gli altri `#8F8880` |

**Causa (due, e si sommano):**

1. **Logica dei tratti** (`trattiDaDisegnare`, `src/hooks/useTourRouting.js`). Il tratto «prossimo» viene preso **solo dalla memoria dei percorsi fra due tappe** (`tappa[k-1] → tappa[k]`, per `k = nextIdx`). Ma al primo segnale GPS `MapPage` imposta il percorso come **posizione dell'utente + tappe rimaste** (`percorsoDa`, `MapPage.jsx:1355`), quindi il tratto che stai davvero camminando verso la prossima tappa è il **primo tratto del percorso «dal vivo»** (`live[0]`: tu → tappa). Tutti i tratti «dal vivo» vengono colorati `resto` (grigio), senza eccezioni. Finché la prossima tappa è la prima (`nextIdx = 0`) non esiste nessun tratto «tappa precedente → tappa» in memoria, quindi **nessun tratto è arancione** per tutto il primo pezzo del giro, cioè proprio quello che si guarda di più all'inizio. Dopo il primo arrivo il percorso torna a «tappe rimaste» senza la posizione e il tratto arancione ricompare, ma solo da lì in poi. Il tratto già fatto fra la posizione e la prima tappa sparisce senza diventare «fatto» (grigio scuro).
2. **Colore del «resto»** (`stileTratto`). Il grigio `#8F8880`, pieno e spesso 5 px, è dello stesso grigio chiaro delle strade larghe e pedonali dello stile Ossidiana: sulla mappa il percorso futuro si confonde con le strade e «sembra grigio-bianco come il resto» (schermata `produzione-3-meta-tratto.png`). Non c'è nessuna gerarchia visiva fra fatto, prossimo e futuro: il fatto è un tratteggio chiaro `#A8A29E`, quasi uguale al futuro.

**In più (panoramica):** la panoramica prima di «Avvia» inquadra le tappe con un `fitBounds` che non include la posizione dell'utente e non tiene conto dei riquadri sopra e sotto: nella schermata `produzione-1-panoramica.png` più tappe restano nascoste dietro i riquadri o fuori dall'inquadratura.

(Verificato nel codice: `MapPage.jsx`, effetto «AUTO-FIT TO ROUTE», usa solo `liveRoute || activeRoute`. Nella schermata di produzione il riquadro «Attiva la tua posizione» è presente perché la prova simula il GPS senza il permesso del telefono: copre alcune tappe solo in quella prova.)

---

*La correzione e la sua prova sono qui sotto, dopo la diagnosi.*

## 2. Correzione

Commit `d381eb3` (e quello di questo report), file toccati: `src/hooks/useTourRouting.js`, `src/pages/MapPage.jsx`, test, CLAUDE.md, note nei due report precedenti. Non toccati: camera, voce, arrivo, ordine delle tappe, motore dei giri, `NavigationHUD.jsx` (non serviva). Nessun testo nuovo (nessuna stringa per l'utente: i testi nuovi in un file unico non servono).

- **Il tratto verso la prossima tappa è arancione sempre.** `primoTrattoVersoProssima` riconosce quando il percorso «dal vivo» parte da te (finisce sulla prossima tappa e non comincia da lì): il suo primo tratto è `prossimo`. Dopo un arrivo (percorso = tappe rimaste) il prossimo resta «tappa prima → prossima» dalla memoria. Mai più di un arancione, mai due volte lo stesso tratto.
- **Il tratto camminato resta come «fatto»**: il percorso dalla tua partenza alla prima tappa viene ricordato dal primo segnale GPS e, dopo il primo arrivo, si disegna grigio scuro tratteggiato.
- **Gerarchia dei colori** (`stileTratto`): prossimo `#F97316` pieno, spesso 6, con alone; fatto `#675F57` tratteggiato, attenuato; futuro `#7A736B` pieno e **sottile** (2,5 invece di 5). Prima: fatto `#A8A29E`, futuro `#8F8880` spesso 5.
- **Panoramica** (`MapPage`, effetto di inquadratura): le tappe **e la tua posizione** (se sei entro ~30 km dal giro: da un'altra città non si allarga il mondo). Si inquadra di nuovo una volta quando la tua posizione cambia di ~100 m. Padding e animazione non cambiano.
- **Soglia del test di NAV-3 cambiata**: `navStileMappa.test.js` chiedeva ≥ 3:1 anche al «fatto» chiaro. Il nuovo requisito è «grigio scuro attenuato, distinguibile dal fondo»: soglia **2:1 per il fatto, 3:1 per futuro e prossimo**, dichiarata nel test.

## 3. Contrasto misurato sui colori veri delle mappe

Misurato sul sito pubblicato (`scripts/prova-nav/tratti.webkit.mjs`, `NAV_MISURA=1`, ora simulata per Ossidiana, mattina, tramonto, notte): i pixel della mappa senza il percorso, ridotti e contati a gruppi di colore (`docs/prove/dati/2026-10-27-nav-tratti-misura-*.json`). **Tutte e 4 le mappe sono scure e quasi uguali**: terra ~`rgb(20–28)`, edifici ~`rgb(12–20)`, strade ~`rgb(36–44, 28–36, 20)` (le fasce differiscono di una sfumatura di tinta nelle strade, non di luminosità).

| tratto | colore | su terra | su edifici | su strade | soglia |
|---|---|---|---|---|---|
| prossimo | `#F97316` | 6,1 | 7,0 | 5,5 | ≥ 3 ✔ |
| futuro | `#7A736B` | 3,7 | 4,2 | 3,3 | ≥ 3 ✔ |
| fatto | `#675F57` | ≥ 2 | ≥ 2 | ≥ 2 | ≥ 2 ✔ (e più scuro del futuro) |

Il test `navTratti.test.js` ricalcola questi rapporti su tutti i fondi misurati (terra, edifici, le 3 strade) e fallisce sotto soglia. Limite: il «fatto» a 2:1 si vede ma sta volutamente dietro (è «attenuato»); se lo vuoi più visibile basta schiarirlo di una sfumatura.

## 4. Prova WebKit sul sito pubblicato (Catania, GPS simulato)

Sito: `https://unnivai.vercel.app`, deploy `dpl_6pV7GpxUmLazWNVQvQXjPVbTgMxg` (READY) del commit `d381eb3`. Giro e percorso a piedi di NAV-SIM (12 tappe, 3,2 km). Script `scripts/prova-nav/tratti.webkit.mjs`, dati `docs/prove/dati/2026-10-27-nav-tratti-pubblicato.json`, schermate `docs/prove/schermate/nav-tratti/pubblicato-*.png`.

| momento | prima (produzione `cac4767`) | dopo (`d381eb3`) |
|---|---|---|
| 1 panoramica (te + tutte le tappe) | 12 arancioni | 12 arancioni, anche la tua posizione nell'inquadratura |
| 2 inizio | 12 grigi `#8F8880`, **0 arancioni** | **1 arancione** (verso la tappa 1), 11 grigi sottili `#7A736B` |
| 3 metà tratto | 12 grigi, **0 arancioni** | **1 arancione**, 11 grigi sottili |
| 4 dopo un arrivo | 1 arancione (3 punti), 11 grigi | 1 fatto `#675F57` tratteggiato, **1 arancione** (verso la tappa 2), 10 grigi sottili |

Schermate: `pubblicato-1-panoramica.png`, `pubblicato-2-inizio.png`, `pubblicato-3-meta-tratto.png`, `pubblicato-4-dopo-arrivo.png` (e le «prima» `produzione-*.png`).

## 5. Test e controlli

- Test nuovi `navTratti.test.js` (33): quale tratto è arancione in ogni momento del giro (inizio, metà tratto, dopo ogni arrivo, giro ripreso con il percorso da te, prima del primo GPS, fuori dalla navigazione), mai più di un arancione, punti `LatLng` di Google, contrasti sui 6 fondi veri, gerarchia dei grigi.
- Suite 223 file / 2721 test verdi, lint 0 errori, build ok, guardia home 12/12 con nessun ❌ nuovo di pertinenza. CI GitHub su `d381eb3` = success.

## 6. Prova di 10 minuti (da fare a mano, iPhone)

1. Apri un giro e **non** premere «Avvia»: la mappa è dall'alto, vedi te e tutte le tappe, il giro intero è arancione.
2. Premi «Avvia» e cammina verso la prima tappa: **solo** il tratto da te alla tappa 1 è arancione; il resto del giro è un filo grigio sottile.
3. Arriva alla tappa 1 e premi «Riparti»: il tratto che hai fatto diventa grigio scuro tratteggiato, si accende in arancione quello verso la tappa 2, gli altri restano sottili.
4. Fai lo stesso a una tappa a metà giro; poi ricarica la pagina e riprendi il giro: ancora un solo arancione, verso la tappa giusta.
5. Controlla di sera e di giorno: l'arancione e i due grigi devono leggersi sopra la mappa.

## 7. Cosa NON risolve / da sapere

- **Il «fatto» è volutamente poco visibile (2:1).** Se in strada lo vuoi più leggibile, si schiarisce.
- **Su iPhone vero non l'ho provato:** la prova è WebKit simulato con GPS finto sul giro di Catania, non Roma né un telefono reale (il sintomo di Roma l'ho riprodotto con la stessa causa: tratto verso la prima tappa grigio).
- **In locale la mappa è chiara** (manca il Map ID Ossidiana nel `.env` locale): le schermate del sito pubblicato sono le uniche che contano per i colori; l'arancione su una mappa chiara è sotto 3:1 (non è lo stile in produzione).
- Il tratto «prossimo» dopo un arrivo parte dalla tappa appena lasciata, non dalla tua posizione esatta (come prima).
- La barra in basso (selettore voce di VOCE-1) è più alta di prima e copre più mappa: fuori dal perimetro di questo task.
- Il tempo: non ho misurato il cronometro di sessione; il lavoro può aver superato il tetto di 60 minuti.

## 8. Commit e log

`d381eb3` NAV-TRATTI (codice, test, documentazione, prove) e il commit di questo report.

`git log --oneline -5 main` al momento del merge:

```
d381eb3 NAV-TRATTI: arancione solo il tratto verso la prossima tappa, fatto grigio scuro, futuro sottile; la panoramica comprende dove sei
cac4767 VOCE-1: report con log di main, CI e deploy READY
0ad3336 VOCE-1: registro con una riga per frase, annunci che non coprono, camminata WebKit su Catania, pagina di ascolto e report
375b5d7 VOCE-1: voce umana (gpt-4o-mini-tts, marin/cedar) in navigazione, cache degli audio, ricadute sul browser, selettore e Media Session
2bdab42 NAV-CAMERA: report con le prove (3 fasce, dissolvenza, prima/dopo, replay NAV-SIM) e la verifica sul sito pubblicato
```

Dopo il merge: GitHub Actions CI su `d381eb3` = success; deploy Vercel `dpl_6pV7GpxUmLazWNVQvQXjPVbTgMxg` = **READY**.
