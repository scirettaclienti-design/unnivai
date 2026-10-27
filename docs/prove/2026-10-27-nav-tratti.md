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

1. **Logica dei tratti** (`trattiDaDisegnare`, `src/hooks/useTourRouting.js`). Il tratto «prossimo» viene preso **solo dalla memoria dei percorsi fra due tappe** (`tappa[k-1] → tappa[k]`, per `k = nextIdx`). Ma al primo segnale GPS `MapPage` imposta il percorso come **posizione dell'utente + tappe rimaste** (`percorsoDa`, `MapPage.jsx:1355`), quindi il tratto che stai davvero camminando verso la prossima tappa è il **primo tratto del percorso «dal vivo»** (`live[0]`: tu → tappa). Tutti i tratti «dal vivo» vengono coloratì `resto` (grigio), senza eccezioni. Finché la prossima tappa è la prima (`nextIdx = 0`) non esiste nessun tratto «tappa precedente → tappa» in memoria, quindi **nessun tratto è arancione** per tutto il primo pezzo del giro, cioè proprio quello che si guarda di più all'inizio. Dopo il primo arrivo il percorso torna a «tappe rimaste» senza la posizione e il tratto arancione ricompare, ma solo da lì in poi. Il tratto già fatto fra la posizione e la prima tappa sparisce senza diventare «fatto» (grigio scuro).
2. **Colore del «resto»** (`stileTratto`). Il grigio `#8F8880`, pieno e spesso 5 px, è dello stesso grigio chiaro delle strade larghe e pedonali dello stile Ossidiana: sulla mappa il percorso futuro si confonde con le strade e «sembra grigio-bianco come il resto» (schermata `produzione-3-meta-tratto.png`). Non c'è nessuna gerarchia visiva fra fatto, prossimo e futuro: il fatto è un tratteggio chiaro `#A8A29E`, quasi uguale al futuro.

**In più (panoramica):** la panoramica prima di «Avvia» inquadra le tappe con un `fitBounds` che non include la posizione dell'utente e non tiene conto dei riquadri sopra e sotto: nella schermata `produzione-1-panoramica.png` più tappe restano nascoste dietro i riquadri o fuori dall'inquadratura.

(La correzione e la sua prova sono sotto, dopo questa diagnosi.)
