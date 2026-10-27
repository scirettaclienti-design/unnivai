# NAV-TESTI-TAPPA — all'arrivo e nella scheda tappa nessun testo falso, tagliato o ripetuto

Cartella `/Users/mac2023ivanosciretta/unnivai-1b`, ramo `nav-testi-tappa` da `origin/main` (`0dde826`), pubblicato su `main`. Nessuna nuova chiamata AI; navigazione, camera e voce non toccate.

## Cosa è cambiato, punto per punto

| Punto | Prima | Ora | Dove | Test |
|---|---|---|---|---|
| Taglio delle frasi da Wikipedia | si fermava al primo punto: «…tra piazza S.» | `primaFraseCompleta`: non chiude su abbreviazioni (S., Sant., p.za, ecc., sec., a.C.), iniziali (G. B.), punto + minuscola; senza frase completa dà `null` (mai una frase spezzata) | `src/lib/stopPhrases.js` (`fattoDi`) | «tra piazza S. Francesco», `Sant.`/`p.za`/`ecc.`, `G. B.`, `a.C.`, testo che finisce in «S.» → `null` |
| «La chicca» / «Il racconto» | stesso testo in due sezioni | la chicca è solo il consiglio insider della tappa (`chiccaDistinta`); uguale o contenuta nel racconto = nessuna chicca. Con un solo testo, all'arrivo c'è una sola sezione (il testo una volta + il lettore) | `navGuida.js`, `GuidaSchede.jsx`, `MapPage.jsx` | un solo testo → 1 sezione; due testi → 2 sezioni |
| «Perché sei qui adesso» | «La mattina è il momento giusto…» a qualsiasi ora | la frase del momento solo se è vera all'ora vera, a Roma (`momentoCoerente`); altrimenti si omette | `navGuida.js` | ore 22:02: mai «mattina»/«poca gente»; 9:30 sì; 22:02 cena sì; 00:30 dopocena sì |
| Preposizione articolata | «al Trattoria Sorano» | `alNome`: alla Trattoria, al Bar, all'Osteria, allo Stadio, al Duomo (tolto l'articolo del nome) | `navGuida.js`, `GuidaSchede.jsx` | 11 nomi, e il tasto «Riparti · 2 min alla Trattoria Sorano» |
| Data della fine giro | — | **era già nel fuso Europe/Rome** (`romeParts`): non c'era nulla da correggere; ora è coperta da test | `navGuida.js` | 23:30 UTC del 27/10 = «28 OTTOBRE»; 1/11 00:30 UTC; 30/10 22:30 UTC |
| Foto | segnaposto grigio con pin (24 px all'arrivo, 256 px nella scheda, anche con foto non caricata) | foto vera di Places (`fotoVera`, niente stock); se manca o non si carica l'area non c'è. Nella scheda senza foto resta il tasto di chiusura. Nel rito d'arrivo senza foto: spunta arancione al posto del pin | `GuidaSchede.jsx`, `MapPage.jsx` | arrivo e scheda con/senza foto, foto di stock scartata |

Testi nuovi nel file unico `src/lib/navMessaggi.js` (`RIPARTI`, `AVANTI`, `RIPARTI_VERSO`); le frasi dei momenti restano in `navGuida.js` dove già stavano.

## Verifiche

- Test nuovi: `src/__tests__/lib/navTestiTappa.test.jsx` (26 test); aggiornati 2 test di `mapPageNav3` (una sola sezione all'arrivo, «alla Via Crociferi»).
- **Suite verde: 224 file, 2748 test**; lint 0 errori (184 avvisi già presenti); build ok.
- CI verde e deploy Vercel completato sul commit `12f58d9`.
- Screenshot dal giro di Catania sul sito pubblicato, ora finta **22:02**: `docs/prove/schermate/nav-audit/testi-tappa-arrivo-2202.jpg` (arrivo: nome, riga, un solo testo, lettore, niente riquadro foto) e `testi-tappa-scheda-2202.jpg` (scheda: niente foto vuota, nessun «la mattina», «Riparti · 1 min alla Basilica Cattedrale di Sant'Agata» che va a capo senza tagli).

## Limiti

- Il giro di Catania usato nelle prove (`navsim-catania`) contiene frasi **già composte** dal motore prima di questa correzione: quelle già salvate con «…tra piazza S. Sono 4 minuti…» restano com'erano. La correzione agisce sui giri **generati da ora in poi**. Per ripulire quelli vecchi serve rigenerarli (nessuna chiamata AI nuova: è il compositore di codice) o un task a parte.
- Il momento si confronta con l'ora del telefono (a Roma); un giro programmato per un altro giorno dice meno cose sul momento, mai cose false.
- La chicca vera (`insiderTip`) oggi nei giri AI non c'è: all'arrivo si vede quindi una sola sezione. È voluto.

## Prova di 10 minuti per Ivano

1. Genera un giro nuovo a Catania (la mattina) e avvialo; arriva alla 1ª tappa: la scheda d'arrivo ha **un solo** testo, senza riquadro foto se non c'è la foto.
2. Premi «La scheda»: nessun riquadro grigio, il tasto ✕ in alto a destra, «Il racconto» una sola volta.
3. Ripeti di sera (dopo le 21): «Perché sei qui adesso» non dice mai «la mattina…».
4. Cerca una tappa con «Wikipedia» e un nome tipo «piazza S. Francesco»: la frase non si ferma a «S.».
5. Guarda il tasto «Riparti · N min …»: «alla Trattoria…», «al Bar…», «all'Osteria…».
6. Finisci il giro: la data della fine è quella di oggi a Roma (anche dopo mezzanotte).
7. Premi Play al racconto: parla una volta sola quel testo.
8. Tocca una tappa senza foto e una con foto: la prima senza buco, la seconda con la foto.
9. Dimmi se la chicca (quando c'è) ti sembra utile o se la togliamo.
10. Segnalami ogni frase ancora spezzata: la salvo come caso di prova.

## `git log --oneline -5 main`

```
b2fa603 NAV-TESTI-TAPPA: report e screenshot dal giro di Catania
12f58d9 NAV-TESTI-TAPPA: frasi complete (mai spezzate a S., Sant., p.za), chicca e racconto mai uguali, «perché sei qui» coerente con l'ora, alla/al/all' davanti al nome, foto vera o niente
0dde826 NAV-MAPPA: git log nel report
4d09ff6 NAV-MAPPA: report, misure prima/dopo, affiancato al canvas, video e script
9194d5e NAV-MAPPA: il toast delle curiosità sta sopra la scheda compatta e si chiude con un tasto da 44 px
```
