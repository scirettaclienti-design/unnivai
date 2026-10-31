# TESTI-SCHEDE — testi corretti sulle schede di Per Te e dei giri (31/10/2026)

Ramo `notte/testi-schede`, parte da `notte/verita-schede` (contiene #3 PER-TE-PROPOSTE e #4 VERITA-SCHEDE): **va unita dopo #3 e #4**.
Tocca `aiRecommendationService.js` e `DashboardUser.jsx`, gli stessi file di #3/#4. Non tocca racconti, navigazione né il motore che sceglie le tappe: cambia solo come si scrivono titolo e testi a partire dalle tappe già scelte.

## Cosa cambia per Ivano

1. **Preposizioni giuste.** «Ti prendi una pausa al Parco del Gianicolo», «Ti fermi davanti alla Galleria del Cardinale Colonna», «Passi dalla Passeggiata del Gianicolo». La regola è una sola, in `src/lib/preposizioni.js` (`conPrep`): è la stessa `alNome` dei testi d'arrivo, spostata lì ed estesa (a, da, in, davanti a, sotto, dentro, intorno a, fino a; plurali, iniziale vocale, «Isola» non è più letta come l'articolo «i»). Le frasi usano i segnaposto `{aNome}`, `{daNome}`, `{nelNome}`, `{davantiNome}`, `{sottoNome}`, `{dentroNome}`, `{ilNome}`. Un locale che non si riconosce resta senza articolo («da Roscioli», «da Enzo al 29», «dal Convivio»).
2. **Etichette interne tolte.** La card mostrava «Roma, Tour AI Insider» / «Roma, Esperienza Locale»: ora solo «Roma» (`DashboardUser.jsx`). Il badge «Insider AI» è un'altra cosa e non cambia.
3. **Frasi riempitivo non ripetute.** Due cause: (a) le frasi approvate di una famiglia erano 1–2 e una lista di Per Te ha 10–15 tappe; (b) le schede «per domattina» di #3 si compongono in una seconda chiamata che ripartiva da zero e ripeteva le frasi delle schede «per adesso». Ora ogni famiglia ha varianti di scorta (`FRASI_LUOGO_EXTRA`, `FRASI_LOCALE_EXTRA`, voce Unnivai, senza giudizi) che stanno DOPO quelle di sempre (la scelta della prima frase non cambia), e la seconda chiamata parte dalle frasi già dette (`frasiUsateDa`, `opts.frasiGiaUsate`). La maschera delle frasi riconosce anche il nome senza articolo («Il Duomo» → «al Duomo»).
4. **Titoli dalle tappe vere.** Il titolo del modello («Tour di Roma», «Tesori di Catania», «Gustoso pranzo a Troina», «Roma vista dal colle del Gianicolo» con Piazza del Campidoglio dentro) non si usa più per Per Te, per il giro della sera/del borgo e per i giri di un giorno: il titolo lo scrive il codice, «Da A a B» con la prima e l'ultima visita (i locali non reggono il titolo se ci sono visite, il tempo libero non conta; una tappa sola: «Intorno a…»; nei titoli piazze, vie, ville e porte senza articolo: «Da Piazza Navona a Villa Borghese»). Titolo troppo lungo (oltre 90 caratteri): «N tappe, da…». I giri di più giorni restano com'erano («Giorno N a X» o titolo del modello pulito): non li ho toccati.

## Prima / dopo dei titoli (giri registrati nel banco, `docs/prove/dati/`)

| Prima | Tappe | Dopo |
|---|---|---|
| Tour di Roma | Albero Monumentale Pioppo Nero / Belvedere Tarpeo / Il Palazzo dei Conservatori | Dall'Albero Monumentale Pioppo Nero al Palazzo dei Conservatori |
| Panorami Romantici di Roma | Gianicolo Belvedere / Giardino degli Aranci / Piazza del Campidoglio | Dal Gianicolo Belvedere a Piazza del Campidoglio |
| Tour di Catania | Chiesa di San Francesco Borgia / Palazzo della Cultura Catania / Museo degli Antichi Strumenti di Scrittura | Dalla Chiesa di San Francesco Borgia al Palazzo della Cultura Catania |
| Vista mare a Catania | Lungomare di Acicastello / Chiesa della Badia di Sant'Agata / Fontana dell'Amenano | Da Lungomare di Acicastello alla Fontana dell'Amenano |
| Gustoso pranzo a Troina | Black & White / Piazza Conte Ruggero / Convento di Sant'Agostino | Da Piazza Conte Ruggero al Convento di Sant'Agostino |
| Da insider a Catania | Palazzo dei Chierici / Palazzo degli Elefanti / Lungomare Ognina / La Scogliera | Dal Palazzo dei Chierici alla Scogliera |

## Prove

- `src/__tests__/lib/preposizioni.test.js`: 32 nomi reali (Parco, Galleria, Passeggiata, Piazza, Villa, Orto, Teatro, Via, Chiesa, Basilica, Fontana, Palazzo, Museo, Castello, Ponte, Mercato, Duomo, Lungotevere, Scalinata, Isola, Anfiteatro, Stadio, Terme, Musei, Giardini, Mura, «Il Duomo», «L'Antica Pizzeria», Colosseo, Santa Maria…; maschili/femminili, singolari/plurali, iniziale vocale) × 4 preposizioni; i tre casi di Ivano nelle frasi; nessuna frase composta con una preposizione semplice davanti a un nome con articolo (32 nomi × 4 tipi di luogo); 14 tappe di una lista di Per Te senza una frase (mascherata) due volte.
- `src/__tests__/lib/titoliGiro.test.js`: tutti i **136 giri registrati** nel banco (`docs/prove/dati/*.json`): ogni titolo nuovo non è generico, sta entro 90 caratteri, nomina tappe vere (prima e ultima visita, nell'ordine); i titoli di prima erano generici in almeno 30 giri.
- Replay della guardia (`npm run banco:guardia`, 0 $, nessuna rete): **12/12**, pertinenza **nessun ❌ nuovo**. Frasi ripetute nelle liste di Per Te rigiocate: **prima 7** (1 a Troina, 6 a Catania), **dopo 0**. I titoli e le descrizioni del replay sono quelli della tabella.
- Suite 241 file / 2992 test verdi; lint 0 errori; build ok.
- Test esistenti aggiornati perché fissavano la grammatica sbagliata («Ti prendi una pausa a Parco delle Valli», «Passi da Passeggiata del Gianicolo», «Entri a Museo Barracco») o il titolo del modello («Il tuo giro a Roma»).

## Da provare dal vivo

- Una lista di Per Te vera, di giorno e di sera: le preposizioni su nomi che non ho nei dati registrati, e le schede «Per domattina» che non ripetono frasi di quelle «per adesso».
- Come stanno i titoli «Da A a B» nella card (testo piccolo, 2 righe): se troppo lunghi si accorciano.
- Che «Roma» da sola nella riga del luogo della card vada bene.

## Cosa NON risolve / decisioni di Ivano

- **Piazza, via, villa nelle frasi**: nei testi d'arrivo c'era già «alla Via Etnea» e l'ho mantenuto («Attraversi la Piazza del Campidoglio», «alla Villa Borghese»); nei titoli invece sono senza articolo («Da Piazza Navona…»). Se preferisci «a Piazza Navona» anche nelle frasi, è una riga in `articoloDi` (opzione `toponimi`).
- I titoli non hanno più immagini o aggettivi (niente «Roma dall'alto»): è il «dato nudo» della voce Unnivai; se vuoi titoli più evocativi servono regole sul tipo di tappe (panorami, mercati…), non l'AI.
- Giri di più giorni: titoli invariati. `PER_TE_TESTI.titoloTema` di #3 ora è solo un ripiego (vale se un giro non ha tappe con nome).
- Le frasi di scorta sono nuove e vanno lette da te (le ho scritte nella voce Unnivai, senza giudizi): elenco in `FRASI_LUOGO_EXTRA` / `FRASI_LOCALE_EXTRA`.
- Finite anche le varianti di scorta, una frase può ancora ripetersi (resta la regola di prima: mai una frase fuori elenco).
