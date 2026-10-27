# NAV-MAPPA — in cammino la mappa resta visibile

Data: 27/10/2026. Cartella `/Users/mac2023ivanosciretta/unnivai-1b`, ramo `nav-mappa-visibile` da `origin/main` (`9facee7`), pubblicato su `main`.

## Esito

| Obiettivo | Prima (nav-audit) | Dopo (sito pubblicato) |
|---|---|---|
| Mappa visibile in cammino ≥ 55 % | 30–36 % | **56–73 %** (63–73 % senza avvisi; 56 % nel momento peggiore, con l'avviso «Ho perso il segnale» aperto) |
| Tasti sotto 44 px | 2 in panoramica, 1–2 nel rito e nella scheda | **0 in tutti gli stati di cammino**; resta un `Chiudi` del toast a 42×42 (vedi «Residui») |
| Testi tagliati | pillola e riga insider | **0** in tutti gli stati |
| Suite / lint / build | — | **223 file, 2721 test verdi** · lint 0 errori (184 avvisi, tutti già presenti) · build ok |
| CI e deploy | — | CI verde, Vercel «Deployment has completed» su ogni push |

Commit (tutti su `main`): `9e3ca8d` (HUD compatto), `46a1753` (avviso più piccolo), `9194d5e` (toast), più questo report.

## Cosa è cambiato

- **Una sola fascia in alto** (`NavigationHUD.jsx`): la pillola della svolta contiene il filo del giorno ridotto a **una riga sottile di puntini** (niente riquadro, niente frase). Con un tocco sulla fascia compaiono i momenti e la frase. Il nome della tappa nella pillola va a capo (`break-words`, niente `truncate`). Altezza della fascia: da 80 + 74 px a ~90 px.
- **Scheda in basso compatta** (una riga): foto 44 px, nome, «PROSSIMA · N MIN» e «Tappa X di N»; Pausa / Salta / Voce come **icone da 44 px con etichetta accessibile** («Pausa», «Salta tappa», «Disattiva voce»). Si apre **tirandola verso l'alto** (drag) o con la maniglia (44 px di area, etichetta «Mostra i dettagli della tappa»): dentro la riga insider, «Sono arrivato», «Fine» e la barra di avanzamento. A ogni nuova tappa torna compatta. Altezza: da 264 px a ~77 px.
- **Marin / Cedar** non sono più nella scheda: stanno nel pannello «Impostazioni del giro», aperto dal nuovo tasto a destra (44 px, `data-testid="nav-impostazioni"`).
- **Rito d'arrivo** (`GuidaSchede.jsx`): sfondo da 80 % a 40 %, cerchio da 208 a 144 px, testo su un riquadro scuro: la mappa resta visibile attenuata (copertura 22–33 % invece di 34–46 %).
- **Panoramica** (`MapPage.jsx`): «Cambia mezzo» e il tasto «posizione» passano a 44 px; il tasto «posizione» ha l'etichetta «Vai alla mia posizione».
- **Fuori dall'elenco dei file, per la regola «tutti i tasti ≥ 44 px»**: `ToastProvider.jsx` (il toast delle curiosità: tasto di chiusura 44 px con etichetta, e alzato da `bottom-20` a `bottom-28` per non finire sotto la scheda).
- **Testi nuovi in un file solo**: `src/lib/navMessaggi.js` (`NAV_TESTI`: PAUSA, RIPRENDI, SALTA_TAPPA, IMPOSTAZIONI, CHIUDI, ESPANDI, COMPRIMI, LA_MIA_POSIZIONE).
- **Non toccati**: camera, voce, arrivo (schede), percorso, motore dei giri.
- **Test aggiornati** perché i tasti sono icone e «Sono arrivato» sta nella scheda aperta: `mapPageNav1`, `mapPageNav3`, `voceSelettoreHud`, `navigationHudNav1Fix` (angolo 22 px al posto di 28).

## Misure prima / dopo (stessi stati del nav-audit, 10:00, sito pubblicato)

Prima = `docs/prove/dati/2026-10-28-nav-audit-1000.json`, dopo = `…-p1000.json` (e `…-p2130.json` per le 21:30, stessi risultati). Metodo identico, tranne una correzione: un riquadro con sfondo trasparente sotto il 60 % (il rito attenuato) non conta più come «copertura».

| Stato | Mappa coperta prima | Visibile prima | Coperta dopo | **Visibile dopo** | Tasti <44 | Testi tagliati | Sovrapposizioni |
|---|---|---|---|---|---|---|---|
| 1 panoramica | 27,1 % | 72,9 % | 27,7 % | **72,3 %** | 2→0 | 0→0 | 1→1 |
| 2 avvio e volo | 69,5 % | 30,5 % | 36,1 % | **63,9 %** | 0→0 | 1→0 | 1→0 |
| 3 freccia di partenza | 66,9 % | 33,1 % | 34,5 % | **65,5 %** | 0→0 | 1→0 | 1→0 |
| 4 cammino | 63,8–69,5 % | 30,5–36,2 % | 27,3–44 % | **56–72,7 %** | 0→0 | 1→0 | 1→0 |
| 5 svolta a 100 m | 69,3 % | 30,7 % | 37 % | **63 %** | 0→0 | 1→0 | 1→0 |
| 5 svolta a 50 m | 63,8 % | 36,2 % | 27,3 % | **72,7 %** | 0→0 | 1→0 | 0→0 |
| 6 avvicinamento | 63,8 % | 36,2 % | 27,3 % | **72,7 %** | 0→0 | 1→0 | 0→0 |
| 7 rito d'arrivo | 34,4–46 % | 54–65,6 % | 21,8–32,6 % | **67,4–78,2 %** | 1→0 | 0→0 | 2→2 |
| 8 scheda d'arrivo | 76,7–100 % | 0–23,3 % | 76,7–100 % | 0–23,3 % | 2→0 | 0→0 | 2→2 |
| 9 racconto in lettura | 76,7 % | 23,3 % | 76,7 % | 23,3 % | 0→0 | 0→0 | 1→1 |
| 10 scheda completa | 100 % | 0 % | 100 % | 0 % | 0→0 | 2→0 | 0→0 |
| 11 riparti | 63,8–65,4 % | 34,6–36,2 % | 27,3–30,2 % | **69,8–72,7 %** | 1→1* | 2→0 | 1→1* |

Gli stati 8, 9 e 10 sono schede a tutto schermo o al 68 % per progetto (arrivo e scheda tappa non erano nel perimetro). \* Il tasto e la sovrapposizione residui in «riparti» sono del toast, vedi sotto.

**Screenshot affiancati alla schermata 1 del canvas**: `docs/prove/schermate/nav-audit/affiancato-canvas-1-prima-dopo.jpg` (canvas · prima · dopo con avviso GPS · dopo alla svolta a 50 m). Il canvas è il ritaglio della resa già nel repo (`schermate/nav-camera/affiancato-1-cammino.png`): il file sorgente del canvas non c'è sul disco.

Altri materiali: video `docs/prove/video/nav-audit-p1000.mp4` e `-p2130.mp4` (dopo), `nav-audit-1000.mp4` e `-2130.mp4` (prima); screenshot `schermate/nav-audit/p1000-*.jpg`; script `scripts/prova-nav/nav-audit.webkit.mjs` (aggiornato: «Salta tappa» per ruolo, apre la scheda per «Sono arrivato»), `nav-mappa-confronto.py` (la tabella e l'affiancato).

## Residui (non nascosti)

1. **Il 56 % è il caso peggiore**: con l'avviso «Ho perso il segnale» aperto (compare nel giro simulato a circa 60 s). Subito dopo si torna a 63–73 %.
2. **«Parti da qui verso Porta Uzeda»** (la freccia di partenza) resta a schermo più a lungo del dovuto, anche alla tappa 2: non è mia (camera/arrivo, vietato toccarla) ma costa ~8 punti di mappa. Da aprire come task.
3. **Toast delle curiosità** (🎧 «Gli artisti di strada in Italia…»): il tasto di chiusura è 44 px in CSS ma l'audit lo misura 42×42 durante l'animazione di entrata, e per qualche secondo il toast sta sopra la scheda (sovrapposizione 1). Il contenuto resta quello già segnalato nel nav-audit (curiosità generiche).
4. **Panoramica**: la card «Il tuo giro a Catania» si sovrappone al tasto «Vai alla mia posizione» (1.100 px²): è sempre stato così.
5. **16×16 px senza etichetta** visti nel nav-audit (rito, scheda d'arrivo): erano il tasto del toast; ora ha etichetta.
6. Il **drag** per aprire la scheda è provato nei test e con la maniglia; **non l'ho provato con un dito vero** (WebKit simulato). È nella prova di 10 minuti.
7. Il tasto «Fine» è ora nella scheda aperta, due tocchi più lontano di prima: voluto, ma conferma di Ivano.

## Prova di 10 minuti per Ivano (iPhone, sito pubblicato)

1. Apri un giro di Catania → «Vedi su Mappa» → **Avvia**. In alto una sola fascia con la svolta e una riga di puntini; in basso una riga. Conta quanta mappa vedi (deve essere più di metà).
2. **Cammina i primi 250 m** (o simula): pillola e voce coerenti? Il nome della tappa nella pillola va a capo senza tagli?
3. **Tocca la fascia in alto**: compaiono momenti e frase; ritocca e sparisce.
4. **Tira la scheda verso l'alto** con il dito: si apre (insider, «Sono arrivato», «Fine», barra). Tirala giù: si chiude. Riprova toccando la maniglia.
5. **Pausa, Salta, Voce**: icone, tutte raggiungibili col pollice? Lo screen reader dice «Pausa», «Salta tappa», «Disattiva voce»?
6. **Tasto con i cursori (sopra «centra»)**: «Impostazioni del giro» → Marin / Cedar; cambia voce e controlla che parli con quella.
7. **Arriva a una tappa**: nel rito d'arrivo la mappa resta intravista dietro? Poi scheda d'arrivo, «Riparti».
8. Aspetta una curiosità 🎧: il toast sta sopra la scheda? Si chiude col dito?
9. Panoramica prima di «Avvia»: «Cambia mezzo» si preme senza sbagliare?
10. Dimmi cosa copre ancora la mappa e cosa non ti basta nella scheda compatta.

## `git log --oneline -5 main`

```
4d09ff6 NAV-MAPPA: report, misure prima/dopo, affiancato al canvas, video e script
9194d5e NAV-MAPPA: il toast delle curiosità sta sopra la scheda compatta e si chiude con un tasto da 44 px
46a1753 NAV-MAPPA: l'avviso di navigazione occupa meno spazio
9e3ca8d NAV-MAPPA: in cammino la mappa resta visibile (fascia unica in alto, scheda compatta a icone, selettore voce nelle impostazioni, rito attenuato, tasti da 44 px)
9facee7 NAV-AUDIT: revisione a video della navigazione (iPhone 15, Catania, 10:00 e 21:30): report, video, provini, misure e script
```
Il commit del report (`4d09ff6`) ha CI verde e deploy Vercel completato; il codice è identico a `9194d5e`.
