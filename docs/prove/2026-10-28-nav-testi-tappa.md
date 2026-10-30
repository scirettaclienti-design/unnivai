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


---

# NAV-TESTI-TAPPA, seconda parte — il racconto da insider di ogni tappa, vero e pronto prima dell'arrivo (28/10/2026)

## Cosa è stato fatto

- **Il racconto** (2–4 frasi) lo scrive Claude (**narratore = Sonnet 5.5**, `ANTHROPIC_MODEL_NARRATORE`, catena e ripiego di sempre) **solo con le fonti**: il testo dell'introduzione di Wikipedia della tappa e la descrizione Google del posto (`editorial_summary`). Voce Unnivai: diretta, da insider, frasi brevi; mai «Benvenuti», mai da guida turistica, niente superlativi. Prompt e regole di voce: `supabase/functions/openai-proxy/racconto.ts` (un file solo, `SYSTEM_RACCONTO`; versione `r2`).
- **Tutto sul server** (`openai-proxy`, `dv.purpose = 'racconto'`): il client dice solo quale tappa (place_id, nome, città, coordinate). Il **server** prende le fonti (`raccontoFonti.ts`: Wikipedia agganciata per nome + città e confermata da nome compatibile e coordinate entro 700 m, mai una disambiguazione; Google via `places-proxy place/details&fields=editorial_summary`, **senza toccare places-proxy**) — così nessuno può far «verificare» un testo inventato.
- **Controllo automatico dopo la scrittura** (`controllaRacconto`): ogni **data, numero (anche in lettere), cifra romana, nome proprio** deve stare nelle fonti (o nel nome della tappa e della città); i **secoli** detti all'italiana valgono la cifra romana («Duecento» = «XIII secolo»); le **parole-fatto** (7+ lettere, escluse le parole della voce da insider) devono avere la radice nelle fonti, oltre una quota il racconto cade; più le regole di voce (niente «benvenuti», superlativi, aggettivi vuoti, tono da brochure, «voi», emoji, indirizzi, nomi delle fonti) e la forma (2–4 frasi, al massimo 600 caratteri). Se il modello risponde `NIENTE` (fonti insufficienti) o il controllo scarta, **resta la frase breve di oggi**.
- **Si scrive una volta per tappa** (`public.place_racconti`, una riga per place_id con esito, motivi, fonti, modello, costo; **solo il server legge e scrive**). Un racconto passato vale 30 giorni (come `place_facts`: il testo Google non si tiene oltre), uno scartato o senza fonti 7 giorni. Un posto già raccontato costa **0**. Se Wikipedia non risponde («too busy») non si memorizza un «senza fonti»: il server risponde 503 e il client riprova a 300 m.
- **Quanti passano e quanti vengono scartati**: `select esito, count(*) from public.place_racconti group by 1;` (e una riga di log per racconto: esito, modello, tempo, costo, motivi). Tetto giornaliero dei racconti nuovi: `racconto_consuma` (secret `RACCONTO_DAILY_CAP`, difetto 300); i racconti **non** consumano la quota dei giri.
- **Se la tappa non ha fonti**: niente racconto inventato, resta solo «Perché sei qui adesso» (e la frase breve). I locali (ristoranti, bar) non hanno racconto di fatti (decisione G, invariata).
- **Audio pronto prima dell'arrivo** (`src/lib/voce.js` `preparaVoce`, `src/services/raccontoService.js`, `MapPage`): appena una tappa diventa la prossima (avvio del tratto) si chiede il racconto e, con la voce accesa, si prepara l'audio (url dal server, file scaricato dal browser); a ~300 m, se non fosse pronto, si ricontrolla. All'arrivo il Play usa l'audio già pronto. Se la voce umana non risponde (oggi OpenAI senza credito) la preparazione fallisce in silenzio e all'arrivo parla la voce del browser, come prima.
- **Testi in un file unico**: prompt e parole vietate in `racconto.ts`; nessun testo nuovo a schermo (il lettore e le schede restano quelli di NAV-3).

## I racconti di 13 tappe vere (Catania e Troina), con le fonti e l'esito del controllo

Giro del 28/10/2026 sul codice finale, account di prova, narratore = Sonnet 5.5 (`claude-sonnet-5-5`), fonti prese dal vivo. **7 passati, 1 scartato, 5 senza fonti** su 13 tappe; 8 chiamate al modello, **0.0276 $ in tutto, 0.0034 $ per racconto scritto**, 2.1–5.8 s a racconto. Grezzo: `docs/prove/dati/2026-10-28-racconti-tappa.json`. Script: `scripts/prova-reale/racconti.live.js`.

### Catania — Porta Uzeda

- **Esito: SENZA-FONTI**
- **Fonte Wikipedia**: «Porta Uzeda» (94 car., a 7 m dalla tappa) — La porta Uzeda collega la piazza Duomo alla via Dusmet, nel cuore della Catania settecentesca.
- **Fonte Google**: nessuna descrizione
- **Niente racconto**: la voce Wikipedia agganciata ha solo 94 caratteri e Google non ha una descrizione: sotto la soglia di 200 caratteri non si scrive. Resta «Perché sei qui adesso».

### Catania — Basilica Cattedrale di Sant'Agata

- **Esito: PASSATO** · 2207 ms · 0.00365 $ · claude-sonnet-5-5
- **Fonte Wikipedia**: «Cattedrale di Sant'Agata» (574 car., a 98 m dalla tappa) — Il Duomo di Sant’Agata, pure noto come Basilica Cattedrale metropolitana di Sant'Agata, è il principale luogo di culto cattolico di Catania, chiesa madre dell'omonima arcidiocesi metropolitana e sede dell'omonima parrocchia. La cattedrale è dedicata alla vergine e martire Sant'Agata, patrona della città di Catania, ed è situata nel centro storico della città, nel lato sud-est di piazza del Duomo, nello stesso quartiere ("Duomo di Catania" o "Terme Achilliane-Piano di San Filippo"). La cattedrale conserva stili differenti: dal Normanno, al Barocco, fino al Neoclassico.
- **Fonte Google**: Imponente cattedrale barocca con facciata a colonne, cupola, affreschi e dipinti.
- **Racconto scritto**: Sei nel punto in cui Catania tiene il suo centro: la cattedrale sta sul lato sud-est della piazza, e per i catanesi è la chiesa madre. Alza gli occhi alla facciata a colonne e poi alla cupola. Qui dentro vive Agata, vergine e martire, patrona della città. Stili diversi in un solo edificio: dal Normanno al Barocco, fino al Neoclassico.
- **Controllo**: passato (4 frasi, 336 car., parole piene 13, fuori fonti 2)
- **Lettura mia: «Sei nel punto in cui Catania tiene il suo centro» e «Qui dentro vive Agata» sono abbellimenti che le fonti non dicono; il resto è nelle fonti. Il controllo non li vede (nessun numero, nome o parola-fatto nuova).**

### Catania — Fontana dell'Elefante (uʻ Liotru)

- **Esito: PASSATO** · 5843 ms · 0.00324 $ · claude-sonnet-5-5
- **Fonte Wikipedia**: «Fontana dell'Elefante» (369 car., a None m dalla tappa) — La fontana dell'Elefante (in siciliano u Liotru) è un'opera monumentale, realizzata tra il 1735 e il 1737 dall'architetto Giovanni Battista Vaccarini, collocata al centro di piazza del Duomo a Catania. Il suo elemento principale è una statua di basalto nero che raffigura un elefante, detto popolarmente U’Liotru, il quale è considerato l'emblema della città siciliana.
- **Fonte Google**: Fontana con una statua romana di un elefante scolpito nel basalto, ora simbolo della città.
- **Racconto scritto**: Alza lo sguardo: l'elefante che hai davanti è di basalto nero, e qui lo chiamano U Liotru. Sta al centro della piazza, ed è il simbolo di Catania. La fontana l'ha costruita Giovanni Battista Vaccarini tra il 1735 e il 1737. Ma la statua è molto più vecchia: è romana.
- **Controllo**: passato (4 frasi, 267 car., parole piene 13, fuori fonti 4)
- **Lettura mia: fedele alle fonti.**

### Catania — Teatro Antico greco-romano di Catania

- **Esito: SCARTATO** · 2608 ms · 0.00327 $ · claude-sonnet-5-5
- **Fonte Wikipedia**: «Teatro greco-romano di Catania» (302 car., a 190 m dalla tappa) — Il teatro greco-romano di Catania è situato nel centro storico della città etnea, tra piazza S. Francesco, via Vittorio Emanuele, via Timeo e via Teatro greco. Il suo aspetto attuale risale al II secolo ed è stato messo in luce a partire dalla fine del XIX secolo. A est confina con l’odeon della città
- **Fonte Google**: Rovine di un anfiteatro all'aperto del II secolo d.C. con gradinata e orchestra.
- **Racconto scritto**: Fermati: sotto il tuo naso c'è un teatro del II secolo, con la gradinata e l'orchestra ancora lì, all'aperto, in mezzo al centro storico. Per secoli è rimasto sepolto, e solo dalla fine dell'Ottocento hanno cominciato a portarlo alla luce. Guarda a est: lì accanto c'è l'odeon della città.
- **Controllo**: SCARTATO — troppe parole fuori dalle fonti (4 su 10): rimasto, sepolto, cominciato, portarlo (3 frasi, 289 car., parole piene 10, fuori fonti 4)
- **Scartato bene: «rimasto sepolto» e «hanno cominciato a portarlo alla luce» vanno oltre «messo in luce a partire dalla fine del XIX secolo».**

### Catania — Castello Ursino

- **Esito: PASSATO** · 3175 ms · 0.00367 $ · claude-sonnet-5-5
- **Fonte Wikipedia**: «Castello Ursino» (466 car., a 24 m dalla tappa) — Il castello Ursino (in siciliano casteḍḍu Ursinu) di Catania fu costruito dal re Federico II di Svevia nel XIII secolo. Il maniero ebbe una certa visibilità nel corso dei Vespri siciliani come sede del parlamento siciliano e, in seguito, come residenza dei re di Sicilia della dinastia aragonese, fra i quali Federico III. Oggi è sede del Museo Civico della città etnea, formato principalmente dalle collezioni della famiglia Biscari e del Monastero dei Benedettini.
- **Fonte Google**: Castello del XIII secolo con collezione archeologica reale, reperti provenienti dal monastero e carri dipinti.
- **Racconto scritto**: Guarda questo castello: lo fece costruire Federico II di Svevia nel Duecento, e durante i Vespri siciliani ci si riuniva il parlamento siciliano. Poi ci vissero i re aragonesi di Sicilia, Federico III compreso. Entra e fermati davanti ai carri dipinti: oggi qui dentro c'è il Museo Civico, con le collezioni della famiglia Biscari e quelle del Monastero dei Benedettini.
- **Controllo**: passato (3 frasi, 370 car., parole piene 22, fuori fonti 4)
- **Lettura mia: fedele alle fonti.**

### Catania — Fontana dell’Amenano

- **Esito: PASSATO** · 2296 ms · 0.00264 $ · claude-sonnet-5-5
- **Fonte Wikipedia**: «Fontana dell'Amenano» (131 car., a 4 m dalla tappa) — La fontana dell'Amenano è una fontana monumentale del 1867 ubicata sul lato sud di piazza del Duomo, a Catania, in Sicilia, Italia.
- **Fonte Google**: Fontana barocca con personaggi mitologici a opera di Tito Angelini e incisione dello stemma cittadino.
- **Racconto scritto**: Sei sul lato sud di piazza del Duomo, davanti a una fontana del 1867. Guarda bene i personaggi mitologici: sono opera di Tito Angelini. Cerca poi lo stemma della città, inciso proprio qui.
- **Controllo**: passato (3 frasi, 188 car., parole piene 6, fuori fonti 0)
- **Lettura mia: fedele alle fonti.**

### Catania — Piazza Giuseppe Mazzini

- **Esito: PASSATO** · 2063 ms · 0.00452 $ · claude-sonnet-5-5
- **Fonte Wikipedia**: «Piazza Mazzini (Catania)» (3417 car., a 205 m dalla tappa) — Piazza Giuseppe Mazzini, originariamente nota col nome di Piano di San Filippo, è una piazza monumentale del centro storico di Catania, la cui progettazione risale al XVIII secolo. Dopo il disastroso terremoto del Val di Noto del 1693, il nuovo impianto urbano deciso da Giuseppe Lanza, duca di Camastra, coordinatore e finanziatore della ricostruzione in accordo con le autorità cittadine, prevedeva lo sfruttamento di questa piazza come mercato e per tale motivo fu stabilita anche la conformazione strutturale degli edifici che dovevano affacciarvisi. Giacché lo spazio venne ricavato dall'incrocio fra due strade, l'attuale via Giuseppe Garibaldi (un tempo chiamata via San Filippo e, successivamente, via Ferdinandea a causa della Porta Ferdinandea, che si trova alla sua fine e che rappresentava anticamente l'ingresso della città dal lato sud-ovest) e via Santa Maria della Lettera a nord che…
- **Fonte Google**: nessuna descrizione
- **Racconto scritto**: Guarda i quattro angoli: sono identici, ognuno con un loggiato di 8 colonne in marmo bianco. Dopo il terremoto del 1693 qui doveva nascere un mercato, e per questo i palazzi attorno furono pensati tutti con la stessa forma. Lo spazio è venuto fuori dall'incrocio di due strade, così la piazza ha il disegno di una croce greca. Prima di diventare piazza Mazzini si chiamava Piano di San Filippo.
- **Controllo**: passato (4 frasi, 394 car., parole piene 16, fuori fonti 2)
- **Lettura mia: fedele alle fonti.**

### Catania — Palazzo dei Chierici

- **Esito: PASSATO** · 2798 ms · 0.00351 $ · claude-sonnet-5-5
- **Fonte Wikipedia**: «Palazzo del Seminario dei Chierici» (380 car., a 213 m dalla tappa) — Il palazzo del Seminario dei Chierici è un edificio storico di Catania, di cui svolge la funzione di municipio: esso è situato sul lato sud della scenografica piazza del Duomo, ha accanto la Cattedrale di Sant'Agata e di fronte il Palazzo degli Elefanti, anch’esso svolgente la funzione di municipio. Al centro della piazza, fra i due palazzi, vi è anche la Fontana dell'Elefante.
- **Fonte Google**: nessuna descrizione
- **Racconto scritto**: Sei sul lato sud della piazza del Duomo, e questo edificio è un municipio. Sì, proprio come quello che hai davanti dall'altra parte: il Palazzo degli Elefanti fa lo stesso lavoro. Girati e guarda in mezzo alla piazza, tra i due palazzi: c'è la Fontana dell'Elefante. Alla tua sinistra, accanto a te, hai la Cattedrale di Sant'Agata.
- **Controllo**: passato (4 frasi, 332 car., parole piene 12, fuori fonti 1)
- **Lettura mia: «Alla tua sinistra» è una direzione che le fonti non dicono (dicono «accanto»). Il controllo non la vede.**

### Catania — Via Etnea

- **Esito: PASSATO** · 2342 ms · 0.0031 $ · claude-sonnet-5-5
- **Fonte Wikipedia**: «Via Etnea» (200 car., a 190 m dalla tappa) — La via Etnea è la strada principale del centro storico di Catania. Si snoda nella direttrice sud-nord, ha un andamento rettilineo ed è lunga circa 3 chilometri. Va da Piazza del Duomo al Tondo Gioeni.
- **Fonte Google**: Vivace strada centrale dello shopping a Catania, con bar, monumenti barocchi e vista sull'Etna.
- **Racconto scritto**: Guarda in fondo: questa strada non fa nemmeno una curva. Parte da Piazza del Duomo e va dritta verso nord per circa 3 chilometri, fino al Tondo Gioeni. Alzati gli occhi lungo il rettilineo: in fondo c'è l'Etna, e intorno a te bar, negozi e monumenti barocchi.
- **Controllo**: passato (3 frasi, 259 car., parole piene 6, fuori fonti 1)
- **Lettura mia: «e intorno a te bar, negozi e monumenti barocchi» viene dalla riga Google; fedele.**

### Troina — Chiesa Madre di Maria Santissima Assunta

- **Esito: SENZA-FONTI**
- **Fonte Wikipedia**: nessuna voce agganciata
- **Fonte Google**: nessuna descrizione
- **Niente racconto**: nessuna voce di Wikipedia propria (cercata: la ricerca porta a «Troina», che è il paese, non la tappa: un aggancio dubbio si scarta) e Google non ha una descrizione. Resta «Perché sei qui adesso».

### Troina — Torre Capitania

- **Esito: SENZA-FONTI**
- **Fonte Wikipedia**: nessuna voce agganciata
- **Fonte Google**: nessuna descrizione
- **Niente racconto**: nessuna voce di Wikipedia propria (cercata: la ricerca porta a «Troina», che è il paese, non la tappa: un aggancio dubbio si scarta) e Google non ha una descrizione. Resta «Perché sei qui adesso».

### Troina — Piazza Conte Ruggero

- **Esito: SENZA-FONTI**
- **Fonte Wikipedia**: nessuna voce agganciata
- **Fonte Google**: nessuna descrizione
- **Niente racconto**: nessuna voce di Wikipedia propria (cercata: la ricerca porta a «Troina», che è il paese, non la tappa: un aggancio dubbio si scarta) e Google non ha una descrizione. Resta «Perché sei qui adesso».

### Troina — Monte Muganà

- **Esito: SENZA-FONTI**
- **Fonte Wikipedia**: nessuna voce agganciata
- **Fonte Google**: nessuna descrizione
- **Niente racconto**: nessuna voce di Wikipedia propria (cercata: la ricerca porta a «Troina», che è il paese, non la tappa: un aggancio dubbio si scarta) e Google non ha una descrizione. Resta «Perché sei qui adesso».

### Che cosa dice il controllo, e che cosa NON dice

Il controllo è una rete, non una prova: ferma date, numeri, nomi e cifre romane che le fonti non hanno e i racconti con troppe parole nuove (nei test: data sbagliata, nome inventato, numero in lettere, cifra romana, tre parole nuove su sei). **Non vede gli abbellimenti piccoli** senza numeri né nomi: nei 7 racconti passati ne ho letti due («Sei nel punto in cui Catania tiene il suo centro», «Alla tua sinistra») più «Qui dentro vive Agata». Sono nel report sopra, tappa per tappa. Strumento in più, se Ivano lo vuole (non fatto: non richiesto): una seconda passata di Haiku «ogni frase è nelle fonti?» (circa 0,001 $ a racconto); un racconto passato sarebbe così anche **riletto**, non solo contato.

## Dal Play al primo suono

Prova WebKit (iPhone 13, giro Catania, GPS finto, `scripts/prova-nav/racconto-play.webkit.mjs`). **Il server è finto**, con i ritardi di oggi: il racconto arriva dopo 3,0 s, l'audio nuovo dopo 2,5 s (la generazione vera misurata in VOCE-1/nav-audit: ≥ 2,5 s). La **voce umana vera non è misurata**: OpenAI è senza credito, la misura con la voce vera si fa dopo la ricarica. Qui si misura la logica del client (preparare prima, usare all'arrivo).

| Caso | Play → primo suono | Audio preparato | Richieste voce al Play |
|---|---|---|---|
| Oggi, senza preparazione (audio da generare al Play) | **2575 ms** | no | 1 (attesa del server) |
| Con preparazione durante il cammino, prova 1 | **40 ms** | sì | 0 |
| Con preparazione durante il cammino, prova 2 | **96 ms** | sì | 0 |
| Con preparazione durante il cammino, prova 3 | **91 ms** | sì | 0 |

Sotto 1 s in tutte e tre le prove con l'audio preparato (massimo 96 ms), contro 2575 ms senza.

## Costo per tappa

- **Racconto**: 0.0034 $ a racconto scritto (Sonnet 5.5: ≈ 1030 token in ingresso e ≈ 140 in uscita in media; misurato su 8 chiamate), **0 $ per un posto già raccontato** (30 giorni). Le tappe senza fonti costano solo una ricerca Wikipedia (gratis) e, per Google `editorial_summary`, una place/details (Atmosphere, **≈ 0,005 $ a chiamata al listino Google: da verificare in fattura**, la place/details passa dalla cache di 24 ore di places-proxy).
- **Audio**: dipende dalla voce umana (non misurata oggi); una frase di ~300 caratteri è un audio nuovo da generare **una volta** per tutti e poi sta nella cache `voce-cache` (0 $).

## Cosa NON risolve

- **La voce umana non è verificata dal vivo**: OpenAI è senza credito (la preparazione fallisce in silenzio e all'arrivo parla la voce del browser). Il «Play in meno di 1 s» è provato sulla logica con server finto; con la voce umana vera si misura dopo la ricarica.
- **Troina: 0 racconti su 4.** Né Wikipedia né Google hanno una voce propria per Chiesa Madre, Torre Capitania, Piazza Conte Ruggero e Monte Muganà: per regola non si inventa, resta la frase breve. Un borgo ha poche fonti: è il limite onesto di «solo fatti verificati».
- **Porta Uzeda** ha una voce Wikipedia di 94 caratteri: sotto la soglia di 200, nessun racconto. La soglia è una scelta (si può abbassare, con più rischio).
- Il controllo non vede gli abbellimenti piccoli (vedi sopra); la lettura umana ne ha trovati due nei 7 racconti.
- **Google**: la descrizione Google è usata come fonte; i termini di Google Maps Platform limitano il caching dei suoi contenuti (30 giorni qui, come `place_facts`), e `editorial_summary` ha un costo per chiamata; la regola precedente «mai contenuti Google» di `factsService` valeva per i fatti, non per il racconto, su richiesta di Ivano.
- **Il racconto di un posto non dipende dall'ora né dall'utente**: è lo stesso per tutti (è il suo vantaggio: costa una volta).
- Wikipedia a volte risponde «too busy» alle raffiche: il server riprova tre volte e poi non memorizza niente.

## Cosa serve da Ivano (non l'ho fatto: migrazione e deploy)
1. `supabase db push --dry-run` (deve mostrare solo `20261028190000_place_racconti.sql`), poi `supabase db push`.
2. `supabase functions deploy openai-proxy --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api` **dal codice su main**.
3. Nessun secret nuovo (facoltativo: `RACCONTO_DAILY_CAP`, difetto 300 racconti nuovi al giorno).
Finché la funzione non è pubblicata il client chiede il racconto e la vecchia funzione risponde 400 prima di toccare la quota: la tappa resta con la frase breve, nessun errore a schermo.

## Prova di 10 minuti a piedi per Ivano (dopo migrazione e deploy)
1. Carica un giro a Catania in centro (Porta Uzeda, Cattedrale, Fontana dell'Elefante, Castello Ursino) e premi «Avvia» con la voce accesa.
2. Cammina verso la prima tappa: dopo qualche secondo non cambia niente a schermo (il racconto si prepara da solo).
3. Arriva: nella scheda d'arrivo c'è il racconto (2–4 frasi, da insider, con i fatti della tappa); premi Play: parte in meno di 1 s (con la voce del browser finché OpenAI è senza credito).
4. Ripeti per due tappe: le frasi non devono contenere date o nomi che non conosci della tappa.
5. Su una tappa senza fonti (un belvedere minore, un ristorante) c'è solo «Perché sei qui adesso».
6. Controlla in SQL: `select esito, count(*) from public.place_racconti group by 1;` e che `costo_usd` sia di pochi millesimi.

---

# Seconda parte, seguito (2026-10-29) — NAV-RACCONTO-VERIFICA: secondo controllo frase per frase e niente direzioni

## Cosa è cambiato
- **Secondo controllo.** Dopo il controllo automatico, un altro modello (**Haiku 4.5**, modello suo: `MODELLO_REVISORE`, secret facoltativo `ANTHROPIC_MODEL_REVISORE`) riceve le fonti e il racconto con le frasi numerate e risponde per ogni frase `nelle_fonti` sì/no (`messaggiVerifica`, `leggiVerifica` in `racconto.ts`). **Basta una frase «no» per scartare il racconto** e resta la frase breve di oggi. Una risposta illeggibile, o che salta una frase, vale «no». Se il revisore non risponde, il proxy risponde 502 e non salva niente: si riprova alla richiesta dopo, il racconto non esce senza controllo.
- **Direzioni vietate.** Nel prompt (regola 6) e nel controllo automatico: sinistra, destra, davanti, dietro, spalle, «di fronte a te», «girati», «voltati», «volgi lo sguardo», «dall'altra parte», «dall'altro lato». Un racconto con una di queste parole è scartato (`indicazione di direzione`).
- **Versione `r3`.** I racconti salvati con `r2` non valgono più: alla prima richiesta di quella tappa si riscrivono (e passano dai due controlli). Resta la regola dei 30 giorni (passato) e 7 giorni (scartato).
- **Migrazione `20261029090000_place_racconti_verifica.sql`**: due colonne facoltative (`modello_verifica`, `verifica`) per vedere cosa ha risposto il revisore per ogni frase. La migrazione `20261028190000_place_racconti.sql` non è cambiata.
- Costo e tempo del racconto nuovo: scrittura (Sonnet 5.5) + verifica (Haiku 4.5, una chiamata in più, ~2 s).

## Le tre frasi
| Frase | Racconto r2 | Con i controlli nuovi | Perché |
|---|---|---|---|
| «Sei nel punto in cui Catania tiene il suo centro» | Cattedrale | **scartato** | revisore: «immagine non scritta nelle fonti» |
| «Qui dentro vive Agata» | Cattedrale | **scartato** | revisore: «interpretazione poetica, le fonti dicono solo che è dedicata a Sant'Agata» |
| «Alla tua sinistra, accanto a te, hai la Cattedrale» | Palazzo dei Chierici | **scartato** | controllo automatico: indicazione di direzione |

Riscritti col prompt r3, i racconti di Cattedrale e Palazzo dei Chierici non contengono più quelle frasi. Ma nuove invenzioni di tono sono comparse e il revisore le ha prese: «il centro della vita religiosa dei catanesi», «la fontana tiene d'occhio entrambi» (Palazzo dei Chierici). La Cattedrale è scartata anche dal controllo automatico (più di 4 frasi, «tre» non è nelle fonti).

## Passati e scartati: prima e dopo (13 tappe, fonti identiche a quelle del report precedente)
| | Passati | Scartati | Senza fonti |
|---|---|---|---|
| **r2 com'erano pubblicati** (controllo automatico) | 7 | 1 | 5 |
| **Gli stessi 7 testi r2 sotto i controlli nuovi** | 1 | 7 | 5 |
| **r3 riscritti dal narratore, sotto i controlli nuovi** | 2 | 6 | 5 |

Dei 7 testi r2, 5 cadono per direzioni («che hai davanti», «davanti a una fontana», «alla tua sinistra», «girati», «dall'altra parte») e 2 dal revisore (Cattedrale, Via Etnea). Passa solo Piazza Mazzini.

Nel giro r3 passano **Castello Ursino** e **Piazza Giuseppe Mazzini**. Scartati: Cattedrale (automatico: 5 frasi e «tre»), Fontana dell'Elefante («statua romana»: la fonte 1 non lo dice), Teatro Antico («l'orchestra era il posto dove si svolgeva lo spettacolo»), Fontana dell'Amenano («perché Catania ha voluto firmarla così»), Palazzo dei Chierici («tiene d'occhio entrambi»), Via Etnea («in fondo alla strada c'è l'Etna»). I 5 senza fonti sono gli stessi di prima (Porta Uzeda, le 4 di Troina).

Il giro è ripetibile ma non deterministico: nel giro precedente (stesso codice, prima di aggiungere «dall'altra parte» al divieto) i passati erano 4 su 13, con un racconto del Palazzo dei Chierici che diceva «dall'altra parte c'è il Palazzo degli Elefanti». Il dato che conta è che **ogni racconto passato è stato riletto a mano sulle fonti** (vedi sotto), non il numero.

## Lettura a mano dei racconti passati (fonti accanto)
- **Piazza Mazzini**: ogni fatto è nella fonte (Piano di San Filippo, incrocio di due strade, 1693, mercato, croce greca, quattro loggiati, 8 colonne in marmo bianco, cornice, quattro aperture). «nei primi decenni del Settecento» = «primi decenni del XVIII secolo». Unica sfumatura: «la ricostruzione di Catania decise» (la fonte dice che il piano lo decise Giuseppe Lanza, duca di Camastra). Nessuna invenzione.
- **Castello Ursino**: Federico II, XIII secolo, Vespri, parlamento, re aragonesi, Federico III, Museo Civico, Biscari, Benedettini, carri dipinti: tutto nelle fonti. Due frasi deboli sono passate: «i carri dipinti stanno accanto ai reperti archeologici» (Google li elenca insieme, non dice che stanno accanto) e «sono tra le cose più concrete che trovi» (nessun fatto, solo voce). Sono i dettagli piccoli che neanche il revisore ferma.

## Costo (13 tappe, giro finale)
| | Totale | Per racconto scritto (8 tappe con fonti) |
|---|---|---|
| Scrittura (Sonnet 5.5) | 0,0305 $ | 0,0038 $ |
| Verifica (Haiku 4.5, 7 racconti verificati) | 0,0110 $ | 0,0016 $ a verifica |
| **Totale** | **0,0415 $** | **0,0052 $** (era 0,0034 $ senza verifica) |

Un racconto scartato costa comunque la scrittura (e la verifica se arriva al secondo controllo): per ogni racconto **passato** la spesa è 0,0208 $ in questo giro (2 passati su 8 scritti). Una volta salvato (passato 30 giorni, scartato 7), un posto costa 0. Verifica: ~2,2 s in più, ma il racconto si prepara durante il cammino, non all'arrivo.

## Cosa NON risolve
- **La resa scende.** Con questi controlli passano pochi racconti (2–4 su 8 con fonti, secondo il giro), e le tappe senza racconto restano con la frase breve. È il prezzo di «nessuna frase non sostenuta»: il narratore (Sonnet 5.5) aggiunge una frase di colore a quasi ogni racconto e il revisore la ferma.
- **Il revisore è un modello, non una prova.** Haiku 4.5 ha fermato tutte le invenzioni che ho trovato io, e ha lasciato passare due frasi deboli (Castello Ursino). Non ho una misura dei falsi «sì».
- **Possibile miglioramento, non fatto perché non chiesto**: riscrivere una volta il racconto scartato dandogli le frasi «no» del revisore («toglile») e riverificare: costerebbe un'altra scrittura e un'altra verifica (~0,005 $) per tappa e alzerebbe la resa. Oggi lo scarto è definitivo (7 giorni).
- **«Girati / dall'altra parte / a est»**: «a est», «a nord» e «sul lato sud» restano ammessi perché sono fatti geografici delle fonti, non indicazioni rispetto all'utente (se il revisore o la lettura trovano un caso sbagliato, si aggiunge al divieto).
- Il proxy pubblicato è ancora quello vecchio: **la prova è stata fatta riproducendo scrittura e revisione con i modelli veri tramite il proxy attuale** (narratore = Sonnet 5.5; revisore = passaggio `traduttore`, che risponde Haiku 4.5, verificato con una sonda). Il percorso `racconto` completo (fonti prese dal server, cache, salvataggio) non è stato provato dal vivo perché richiede migrazione e deploy, che spettano a Ivano. Un primo giro con il passaggio `selettore` ha usato per errore Sonnet 5.5 come revisore (il secret `ANTHROPIC_MODEL_SELETTORE` punta a Sonnet): per questo il revisore ora ha un modello suo.
- Troina 0/4 e Porta Uzeda: invariati.

## Da lanciare (Ivano)
1. `supabase db push --dry-run` (devono comparire `20261028190000_place_racconti.sql` se non l'hai ancora applicata e `20261029090000_place_racconti_verifica.sql`), poi `supabase db push`. **Prima la migrazione, poi il deploy**: con la funzione nuova e la tabella vecchia il salvataggio fallisce (si vede nel log, la tappa non ha il racconto).
2. `supabase functions deploy openai-proxy --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api`, dal codice su main.
3. Nessun secret obbligatorio. Facoltativo: `ANTHROPIC_MODEL_REVISORE` per cambiare il revisore senza deploy.
4. Dopo: `select esito, count(*) from public.place_racconti group by 1;` e `select versione, count(*) from public.place_racconti group by 1;` (le righe `r2` si riscrivono da sole alla prima richiesta).

Dati grezzi: `docs/prove/dati/2026-10-29-racconti-verifica.json` (testo, fonti, esito di ogni frase, costi). Script: `scripts/prova-reale/racconti-verifica.live.js`.

---

# Seguito (2026-10-30) — RACCONTO-R4: prompt «ogni frase su un fatto» e una sola riscrittura

Report completo: `docs/prove/2026-10-30-racconto-r4.md`.
- Catania, 8 tappe con fonti: **7, 6, 7 passati** su 3 lanci (prima, con r3: 2, 4, 3).
- Roma, 6 con fonti: 3, 3, 4 (prima: 2, 1, 0).
- Stessi controlli: il revisore e i divieti non sono cambiati.
- Riscrittura: 14 in 3 lanci, 12 passate.
- Costo per racconto passato: 0,0113 $ (prima: 0,0174 $).
- Lettura a mano dei 30 passati: 2 frasi con un fatto in più («sopra», «da cui entri»).

Versione `r4`. Un r3 passato resta valido; si riscrivono solo gli scartati.
