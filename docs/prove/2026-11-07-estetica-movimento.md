# T30 ESTETICA-MOVIMENTO (07/11/2026)

## Cosa cambia per Ivano
Dal marchio (`UNNIVAI-Site-FINAL`, solo letto): le curve di livello del sito e il logo prendono vita, piano.
- **Logo**: entra una volta sola in 1,1 s (dissolvenza, salita di 8 px, scala 0,94 → 1) nella schermata di caricamento, nell'accesso e nel primo ingresso. Nella testata della home pubblica (Landing) la bussola arancione ruota in 1 s e la scritta UNNIVAI entra con la stessa curva. Il logo di Landing non è stato sostituito (nessun testo cambia).
- **Curve di sfondo** (`FondoMarchio vivo`): scivolano a ±10 px in 48 s (andata e ritorno). Sono su caricamento, accesso, primo ingresso, nuova password e sopra la foto della Landing. Il filo arancione si disegna una volta in 3,2 s. Nuova variante `discreto` (senza alone e filo, curve più tenui) fissa dietro alla **home dell'app** (`DashboardUser`), `fixed -z-10` e `pointer-events-none`.
- **Landing, Colosseo**: la foto è una sola (Unsplash, un solo luogo), quindi niente strati separabili: **camera lenta** (zoom da 1,04 a 1,11 e spostamento di ±1,2 % in 40 s, andata e ritorno). Prima lo zoom arrivava a 1,06 in 20 s e si fermava. Le curve sopra scivolano più veloci e in senso opposto, quindi si ha una parallasse leggera. Resta anche lo zoom con lo scroll che c'era già.
- Tutto è CSS (transform e opacity, `will-change: transform` solo sulle tre animazioni in loop) in `src/index.css`. Dipendenze nuove: nessuna. La mappa e la navigazione non sono toccate.

## «Riduci movimento» e pagina nascosta
- `prefers-reduced-motion: reduce`: nessuna animazione (logo e bussola subito fermi, curve e camera ferme, filo arancione già disegnato). Verificato in WebKit: con riduci movimento `animationName` della foto = `none`, nessuna animazione attiva; senza, `camera-lenta` e `curve-deriva` girano.
- Pagina nascosta: `src/lib/movimento.js` (`inizializzaMovimento`, chiamata in `main.jsx`) mette `data-pagina-nascosta` sulla radice e il CSS mette in pausa le tre animazioni in loop. Verificato: attributo presente, stato `paused`. Test: `src/__tests__/lib/movimento.test.js`.

## Prove
- Schermate WebKit iPhone 14 in `docs/prove/schermate/estetica-movimento/`: sequenza Landing a 0,15 · 0,5 · 0,9 · 1,4 · 6 · 20 · 39 s, con (`landing-movimento-*`) e senza (`landing-ridotto-*`) riduci movimento; `login.jpg`; `home-movimento.jpg`, `home-ridotto.jpg` (account di prova, nome «ProvaAccesso», nessuna email). Script: `scripts/prova-nav/movimento-schermate.webkit.mjs`. Il tocco passa sempre attraverso lo sfondo (`elementFromPoint` non lo trova mai).
- **Contrasto**: le curve più forti schiariscono il fondo da #0E0C0B a circa #161514 (`discreto`: #131110). Il testo secondario #A8A29E resta a 7,74:1 senza curve, 7,23:1 sotto le curve della Landing e dei fondi d'ingresso, 7,47:1 nella home (≥ 4,5:1). Il filo arancione (alpha 0,19) sta dietro al testo e non riduce il contrasto in modo apprezzabile.
- **Tempi di caricamento** (stesso Mac, due `vite preview` di build di produzione locali: «prima» = `origin/main` 4d056c8, «dopo» = questo ramo; WebKit iPhone 14, contesto nuovo a ogni misura, foto del Colosseo servita da disco, funzioni dei posti e dell'AI simulate; 1 giro di riscaldamento scartato, **9 ripetizioni alternate prima/dopo**, mediane; WebKit di Playwright non ha throttling, quindi nessuno). Script `scripts/prova-nav/movimento-tempi.webkit.mjs`, misure grezze in `docs/prove/dati/2026-11-07-estetica-movimento-tempi.json`.

| Pagina | Misura | prima | dopo |
|---|---|---|---|
| Landing | primo disegno (FCP) | 140 ms | 139 ms |
| Landing | primo contenuto (h1) | 412 ms | 416 ms |
| Landing | frame/s nei 3 s dopo | 60,2 | 60,3 |
| Home (loggato) | primo disegno | 138 ms | 137 ms |
| Home | prima scheda (primo figlio di `<main>`) | 784 ms | 773 ms |
| Home | frame/s nei 3 s dopo | 60,5 | 60,4 |

Differenze entro 1 % o 11 ms, dentro il rumore: **nessun calo misurabile**, nessun pezzo tolto. Nota: il «prima» gira da una copia di `origin/main` (git archive con i node_modules di questo repo) perché non si potevano avere due rami nella stessa cartella.
- **Bundle** (build di produzione): `index-*.js` 1.108.230 → 1.108.816 byte (+586 B, +264 B gzip); `index-*.css` 113.315 → 115.039 byte (+1,7 kB); `Landing` 35.262 → 35.206; `DashboardUser` 30.105 → 30.172. Nessun asset nuovo.
- Suite: 293 file, 3622 test verdi. Lint: 0 errori. Build ok.

## Costo
0 $: nessuna chiamata AI né ricerche vere (funzioni simulate). Un solo accesso con l'account di prova per le schermate e le misure.

## Cosa NON risolve
- La Landing ha una sola foto: niente strati veri di parallasse (servirebbe una foto con primo piano e sfondo separati, o una versione scontornata del Colosseo). Proposta, non fatta.
- Il logo di Landing resta bussola + scritta, non il logo del marchio (cambierebbe l'aspetto della testata). Proposta.
- Il logo non ha parti animate separate (è un'immagine webp): l'ingresso è dell'insieme. Un SVG del logo permetterebbe di animare il pin.
- Le 12 particelle arancioni della Landing (framer-motion, già presenti) non sono state toccate.
- Il movimento non c'è su mappa, navigazione e le altre schermate dell'app (solo home); estendere il motivo è una riga per pagina.

## Passi che aspettano Ivano
Solo da guardare su iPhone vero: Landing (camera lenta e curve), caricamento/accesso (logo), home dell'app; con Impostazioni › Accessibilità › Movimento › Riduci movimento acceso tutto deve stare fermo.
