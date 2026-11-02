# CURIOSITA-QUARTIERI — camminando fra le tappe, una curiosità vera della via o del quartiere (02/11/2026)

Cartella `/Users/mac2023ivanosciretta/unnivai-notte-curiosita-quartieri` (verificata con `pwd` all'avvio), worktree del ramo `notte/curiosita-quartieri` da `origin/main` (`b8b859b`). Prompt dei racconti, controllo automatico, revisore, soglia di 200 caratteri e TTL **non toccati**. Nessuna migrazione, nessun secret.

## Cosa cambia per Ivano
- A piedi, fra una tappa e l'altra, esce una curiosità della via, della piazza o del quartiere che stai attraversando, a schermo («🎧 …») e a voce. La fonte è la voce di it.wikipedia.org di quel luogo; il testo lo scrive Claude con le regole dei racconti e passa dagli stessi due controlli.
- **Nei tre giri di prova: 3 curiosità a Trastevere, 3 a Monti, 4 nel centro storico di Catania**, in 49–54 minuti di cammino ciascuno; nessuna sopra un'indicazione, nessuna ripetuta, sempre almeno 10 minuti fra una e l'altra.
- **La frase fissa delle fontanelle di Roma è tolta**: a Roma ora escono le curiosità dei rioni e delle vie (Trastevere e Monti hanno la loro, verificata).
- Regole: la prima dopo 300 m camminati, poi al massimo una ogni 10 minuti; solo con il mezzo «a piedi» e in movimento (in bici non escono più); se una svolta o la tappa è vicina, se la voce sta parlando o una scheda è aperta, aspetta; mai la stessa due volte nello stesso giro, anche dopo una ricarica. Senza una voce verificata: silenzio.
- `openai-proxy` è alla **v43** (da `eda9b67`). Per tornare indietro: il codice di v40 è `bd32e7c` (nessun cambio al proxy fino a `b8b859b`).

## Come funziona
**Fonti** (`supabase/functions/openai-proxy/curiositaFonti.ts`, `dv.purpose = 'curiosita'`):
1. la via su cui cammini e i nomi del quartiere da OpenStreetMap (Nominatim). La voce di Wikipedia vale se ha le **stesse parole proprie** del nome (tolti articoli, preposizioni, «san», la città; «Secondo» = «II»: «Via Crociferi» = «Via dei Crociferi») e le **coordinate entro 1,5 km** (via) o **3 km** (quartiere); senza coordinate non vale. Un municipio non è un quartiere;
2. le vie e le piazze **entro 120 m** (geosearch di Wikipedia), solo titoli che sono una strada o una piazza;
3. una tappa del giro (stesso nome) non è una curiosità: ha il suo racconto.
Il testo della voce: introduzione e sezioni fino a 1500 caratteri, senza Note, Curiosità, Bibliografia (lo stesso taglio dei racconti).

**Testo** (`curiosita.ts`): la macchina dei racconti con un'altra prima richiesta. Le regole di voce sono le stesse righe di `racconto.ts` (`REGOLE_VOCE`; il prompt dei racconti e del revisore restano identici carattere per carattere, controllato da un test con l'impronta SHA-256); in più: 2–3 frasi, il luogo per nome, mai «sei in…», «qui», «guarda» (chi ascolta può essere a qualche passo). Controllo automatico, revisore Haiku 4.5, una riscrittura, soglia di 200 caratteri: quelli dei racconti. Al più **una curiosità nuova per richiesta**; le nuove contano nel tetto dei racconti (`racconto_consuma`).

**Cache**: `public.place_racconti`, chiave `curiosita-itwiki-<pageid>`, versione `c1`. La tabella esistente basta (la chiave rispetta il CHECK `^[A-Za-z0-9_-]+$`, 10–300 caratteri): **nessuna colonna nuova, nessuna migrazione**. Passata 30 giorni, scartata o senza fonti 7. Un racconto di tappa rifiuta le chiavi `curiosita-` (400).

**Quando esce** (`src/lib/curiositaCammino.js`, puro; `MapPage.onNavPosition`):
- si chiede un minuto prima che la finestra si apra; con la voce accesa l'audio si prepara subito (`preparaVoce`);
- non parte se la prossima svolta principale è a meno di **110 m + i metri della frase + 30 m** (110 m = la prima indicazione, «Fra cento metri»; la frase si stima a 14 caratteri al secondo e 1,4 m/s), se la prossima tappa è a meno di **60 m + metri + 30 m**, se la voce sta parlando (`voce.voceOccupata`), se il rito d'arrivo o una scheda sono aperti;
- una curiosità pronta vale 250 m (via) o 800 m (quartiere) dal punto in cui l'hai chiesta, poi si richiede;
- le chiavi dette e l'ora dell'ultima stanno sul telefono per il giro (`dvai_curiosita_giro_v1`); il server riceve le chiavi da escludere.

## Tre pubblicazioni: v41, v42, v43
- **v41** (`d54cd11`): ogni richiesta rispondeva **503 `CURIOSITA_FONTI`** (collaudo, punto 4: nessuna curiosità a Roma). La causa non era scritta da nessuna parte.
- **v42** (`b259f5a`): Photon (komoot, stessi dati OpenStreetMap) se Nominatim non risponde, poi solo geosearch; il motivo nel log. Il log della prima richiesta: «**nominatim 403 ; photon rete TypeError**». Con il solo geosearch è uscita la curiosità di Piazza di Santa Maria in Trastevere, ma niente quartieri.
- **v43** (`eda9b67`): via e quartiere li chiede **il telefono** a Nominatim (come fa già per la città, `useEnhancedGeolocation`) e manda al server solo i campi di via e quartiere (`curiositaService.indirizzoDalTelefono`: niente numero civico né CAP). Il server li usa solo per scegliere la voce, che verifica comunque per nome e coordinate: un nome sbagliato porta al massimo a nessuna voce. Senza, il server prova da sé.
Ogni pubblicazione: merge fast-forward dopo rebase (PR #9, #10, #11), CI verde (run 41378664765, 41379639729, 41380121275), Vercel «success», deploy da questo worktree staccato su `origin/main` con `--use-api`; dopo ogni deploy i 9 file pubblicati sono identici a quelli del repo.

## Prova WebKit (iPhone 14, GPS finto in movimento, sito e funzione pubblicati v43)
`node scripts/prova-nav/curiosita-quartieri.webkit.mjs trastevere,monti,catania`, account di prova. Grezzo: `docs/prove/dati/2026-11-02-curiosita-quartieri-webkit.json`, schermate in `docs/prove/schermate/curiosita-quartieri/`.
- Percorso a piedi vero: Google Directions WALKING fra le tappe, dentro la pagina. Un passo di 25 m ogni 20 s (1,25 m/s) sull'**orologio finto della pagina** (`page.clock`): 50 minuti di cammino in 2 minuti veri; prima di ogni passo si aspettano le richieste in volo (Nominatim e proxy).
- **Voce**: le richieste di audio rispondono 503 (come senza credito OpenAI) e parla la «voce del browser», finta, che dura 1 secondo ogni 14 caratteri sull'orologio della pagina. Così inizio e fine di ogni frase stanno nel registro (`window.__voceRegistro`: `ora`, `fine`, `tipo`, `interrotta`). L'audio vero e il GPS vero restano da provare su iPhone.

| Giro | Tappe | Cammino | Curiosità dette | Minuti fra una e l'altra | Ripetute | Frasi di navigazione (svolte) | Sovrapposizioni | Curiosità interrotte |
|---|---|---|---|---|---|---|---|---|
| Roma, Trastevere | Piazza Trilussa, Villa Farnesina, S. Maria in Trastevere, S. Cecilia, S. Francesco a Ripa | 3134 m, 49 min | **3** | 10,2 · 10,8 | 0 | 21 (13) | **0** | 0 |
| Roma, Monti | Mercati di Traiano, Piazza della Madonna dei Monti, S. Pietro in Vincoli, S. Maria Maggiore, Palazzo delle Esposizioni | 3250 m, 50 min | **3** | 12,2 · 10,3 | 0 | 32 (24) | **0** | 0 |
| Catania, centro storico | Castello Ursino, Fontana dell'Elefante, Chiesa di San Benedetto, Teatro Massimo Bellini, Villa Bellini | 3510 m, 54 min | **4** | 16,7 · 10,2 · 10,2 | 0 | 16 (8) | **0** | 0 |

**Nessuna sovrapposizione con la navigazione** (tempi dal registro della voce, minuti dall'inizio del cammino):

| Giro | Curiosità (inizio–fine) | Frase di navigazione prima (fine), distacco | Frase dopo (inizio), distacco |
|---|---|---|---|
| Trastevere | 4,5–4,8 Lungotevere Raffaello Sanzio | «Adesso gira a destra.» 1,0 · +204 s | «Fra cento metri gira a sinistra.» 5,5 · +39 s |
| | 14,6–15,1 Trastevere | «Si va verso Basilica di Santa Cecilia…» 14,1 · +34 s | «Fra cinquanta metri gira a destra.» 23,7 · +512 s |
| | 25,4–25,8 Piazza di S. Maria in Trastevere | «Si va verso…» 24,2 · +74 s | «Adesso gira a sinistra.» 32,4 · +398 s |
| Monti | 14,2–14,7 Largo Magnanapoli | «Si va verso Piazza della Madonna dei Monti.» 10,4 · +225 s | «Adesso gira a sinistra.» 18,6 · +230 s |
| | 26,4–26,9 Via Cavour | «Si va verso…» 25,8 · +35 s | «Adesso gira leggermente a destra.» 33,1 · +375 s |
| | 36,7–36,9 Piazza dell'Esquilino | «Si va verso Palazzo delle Esposizioni.» 36,4 · +19 s | «Adesso gira leggermente a destra.» 39,0 · +128 s |
| Catania | 8,8–9,3 Giudecca di Catania | «Si va verso Fontana dell'Elefante.» 7,5 · +76 s | «Fra cento metri gira a destra.» 17,2 · +470 s |
| | 25,6–26,0 Centro Storico (Catania) | «Si va verso Teatro Massimo Bellini.» 24,3 · +75 s | frase d'arrivo 33,9 · +476 s |
| | 35,7–36,0 Civita (Catania) | «Si va verso Villa Bellini.» 34,0 · +103 s | — |
| | 45,9–46,5 Via Etnea | «Si va verso Villa Bellini.» 34,0 · +714 s | — |

**Le attese hanno lavorato** (`window.__curiositaRegistro`): «svolta vicina» 4 volte, «tappa vicina» 4, «scheda aperta» 3, «non stai camminando» 3, «meno di 10 minuti» 7. A Monti la curiosità di Via Alessandrina è arrivata al minuto 4,5 con la svolta a 90 m, ha aspettato ed è **scaduta** dopo 250 m (minuto 8,5): non è uscita. Quella del rione Monti è arrivata al minuto 45,8 ed è rimasta in attesa (tappa vicina) fino alla fine del giro. Tutte e due restano in cache per i prossimi giri.
Richieste al server: Trastevere 7 (4 «già dette»: dopo il quartiere e le due vie, a Trastevere non c'erano altre voci lungo il percorso), Monti 6 (1 scartata: Via Quattro Novembre), Catania 5 (1 scartata: Via Vittorio Emanuele II).

## I testi, letti a mano con la fonte
✓ = ogni frase è nelle fonti; ⚠ = una parola in più o una sfumatura, nessun fatto nuovo.
- **Lungotevere Raffaello Sanzio** ([voce](https://it.wikipedia.org/wiki/Lungotevere_Raffaello_Sanzio)): «Il Lungotevere Raffaello Sanzio è il tratto che collega piazza Trilussa a piazza Giuseppe Gioachino Belli, nel rione Trastevere. Il nome è quello dell'artista di Urbino, autore di varie opere a Roma. La delibera del consiglio comunale che lo ha istituito porta la data del 24 gennaio 1956.» — ✓.
- **Trastevere** ([voce](https://it.wikipedia.org/wiki/Trastevere)): «Trastevere viene dal latino «trans Tiberim», che vuol dire «al di là del Tevere»: la città nacque sull'altra sponda. Ai tempi della fondazione di Roma questa zona apparteneva agli Etruschi di Veio, ed era contesa perché serviva a controllare il fiume e il guado dell'isola Tiberina. Poi un ponte, il pons Sublicius, la collegò al resto della città, e da lì partiva la via Campana verso le saline sul Tirreno.» — ✓ (W: «la città ebbe origine e principale sviluppo sulla sponda opposta»; «strategica per il controllo del fiume, del guado dell'isola Tiberina»).
- **Piazza di Santa Maria in Trastevere** ([voce](https://it.wikipedia.org/wiki/Piazza_di_Santa_Maria_in_Trastevere)): «…prende il nome dalla basilica, fondata nel III secolo da papa Callisto I. Nel XII secolo la basilica fu rinnovata per volere di papa Innocenzo II. La fontana al centro è una delle più antiche di Roma, e l'ultimo restauro è dell'architetto Carlo Fontana, verso la fine del Seicento.» — ✓ (W: «fine del XVII secolo»).
- **Largo Magnanapoli** ([voce](https://it.wikipedia.org/wiki/Largo_Magnanapoli)): «…sul nome nessuno è sicuro, ne hanno proposti tre. Potrebbe venire da balnea Pauli, perché nel medioevo i vicini mercati di Traiano erano creduti resti di terme volute da papa Paolo I. Oppure da magnus Neapolitani regni connestabilis, gran conestabile del Regno di Napoli, una carica tenuta sul finire del medioevo da membri della famiglia Colonna, che in quest'area possedevano varie casetorri.» — ✓; annuncia tre ipotesi e ne dice due ⚠.
- **Via Cavour (Roma)** ([voce](https://it.wikipedia.org/wiki/Via_Cavour_(Roma))): «Via Cavour parte da Piazza dei Cinquecento e arriva fino a largo Corrado Ricci, e nel suo percorso attraversa i rioni di Castro Pretorio e Monti. Il via libera alla strada fu dato in una seduta consiliare nel maggio 1880, e i lavori andarono avanti fino agli anni 1910. Sui portoni di molti palazzi si leggono ancora oggi le date degli anni di costruzione.» — ✓.
- **Piazza dell'Esquilino** ([voce](https://it.wikipedia.org/wiki/Piazza_dell%27Esquilino)): «Piazza dell'Esquilino sta a 340 metri dalla Stazione Termini. Ospita l'obelisco che porta il suo nome e la parte absidale della basilica di Santa Maria Maggiore.» — ✓; vero ma poco «curioso» (la voce ha solo questo).
- **Giudecca di Catania** ([voce](https://it.wikipedia.org/wiki/Giudecca_di_Catania)): «…la chiamavano Judeka in dialetto giudaico-catanese, ed era l'antico quartiere ebraico. Chiamarlo ghetto non è giusto: la comunità ebraica non era chiusa in un quartiere, era sparsa in diverse zone della parte occidentale e meridionale della città. Nel 1929, mentre posavano cavi telefonici vicino alla chiesa di Santa Teresa, hanno trovato una lapide funebre ebraica che risalirebbe alla fine del IV secolo.» — ✓.
- **Centro Storico (Catania)** ([voce](https://it.wikipedia.org/wiki/Centro_Storico_(Catania))): «Il Centro Storico di Catania è il I Municipio e comprende i rioni dell'area antica della città. Tra questi c'è Monte Pidocchio, c'è La Mecca, c'è Murorotto o Pozzo di Gammazìta. Dentro ci stanno anche San Berillo, la Civita e la Giudecca. E tra i nomi dei rioni compaiono il Teatro e Odeon Romani, l'Anfiteatro Romano e il Mausoleo Circolare.» — ✓ nei fatti; è un **elenco di nomi** in tre frasi (la voce è un elenco): il prompt vieta gli elenchi, nessun controllo lo vede. ⚠ «area antica».
- **Civita (Catania)** ([voce](https://it.wikipedia.org/wiki/Civita_(Catania))): «La Civita: il nome verrebbe dal latino civitas, "cittadella". In età antica era uno dei 4 nuclei della città dove abitavano i patrizi. Nel XVI secolo la zona fu una delle più fortificate di Catania, con le mura fatte erigere da Carlo V d'Asburgo, re di Sicilia.» — ✓.
- **Via Etnea** ([voce](https://it.wikipedia.org/wiki/Via_Etnea)): «Via Etnea nasce dopo il terremoto dell'11 gennaio 1693, che rase quasi al suolo Catania: sotto le macerie morirono circa due terzi degli abitanti. Il duca di Camastra, mandato a dirigere la ricostruzione, tracciò le strade ad angolo retto e partì dal duomo, uno dei pochi edifici rimasti in piedi. All'inizio si chiamava via duca di Uzeda, come il viceré di allora, ed era lunga circa settecento metri: finiva dove oggi c'è piazza Stesicoro, che allora era una porta della città.» — ✓; ⚠ «rimasti in piedi» (W: «non completamente distrutti»), ⚠ «era una porta» (W: «allora chiamata porta di Aci. Qui esisteva una delle porte»).
- Passate ma non dette nei giri: **Via Alessandrina** (✓), **Monti (rione di Roma)** (✓: «li monti», la Suburra, l'Argiletum), **Piazza Stesicoro** (✓, collaudo punto 4).
- **Scartate** (nessun testo al client): Via della Lungara e Via Vittorio Emanuele II (Catania), «parla a più persone» anche dopo la riscrittura (il controllo vede «vi»); Via Quattro Novembre (un «2» non nelle fonti, poi il revisore).

In tutto: 13 curiosità passate, 3 scartate; nelle 10 dette nessun fatto fuori dalle fonti, 5 sfumature ⚠, un testo che è un elenco.

## Collaudo del sito (WebKit, sito pubblicato, v43)
`COLLAUDO_ESITI=docs/prove/dati/2026-11-02-collaudo-sito-curiosita.json node scripts/prova-nav/collaudo-sito.webkit.mjs 1,2,3,4,5`, subito dopo il deploy.

| Punto | Esito |
|---|---|
| 1 freccia sparisce dopo 10 m | ✓ |
| 2 tappa 2 dopo «Salta»: niente freccia | ✓ |
| 3 GPS muto 60 s e ripresa | ✓ |
| 4 curiosità del cammino (**riscritto in questo task**) | ✓ Roma: «Trastevere viene dal latino…» a schermo e a voce, fonte voce Trastevere; Catania: Piazza Stesicoro; nessuna fontanella. La prima lettura dava Catania ✗ per un difetto del controllo che avevo scritto (cercava «Roma» e trovava «Anfiteatro Romano»): corretto in «Roma» come parola e fonte non di Roma, punto ripetuto ✓ (`…-curiosita-p4.json`). |
| 5 schede: racconto o frase breve | ✓ 10/10, come il 02/11 (Piazza del Campidoglio resta scartata); i racconti tutti dalla cache, 0 $ |

Il punto 4 di prima («Roma sì con le fontanelle, Catania no») non vale più: ora cammina a 1,25 m/s sull'orologio finto e controlla una curiosità con fonte. Sulla v41 il punto 4 era ✗ (503): è da lì che è nata la v42.

## Costo AI (misurato)
| | Curiosità scritte | Spesa |
|---|---|---|
| Chiamata di controllo su v42 | 1 (Piazza di S. Maria in Trastevere) | 0,00639 $ |
| Collaudo punto 4 su v43 | 2 (Trastevere, Piazza Stesicoro) | 0,01547 $ |
| Prova WebKit, 3 giri | 13 (10 passate, 3 scartate) | 0,14619 $ |
| Collaudo ripetuto del punto 4, collaudo punto 5 | 0 (cache) | 0 $ |
| **Totale** | **16** (13 passate, 3 scartate) | **0,16805 $** |
- Fonte: `select (place_id like 'curiosita-%'), esito, count(*), sum(costo_usd) from public.place_racconti where created_at >= '2026-11-02 02:30:00+00' group by 1,2;` → passate 13 / 0,12648 $, scartate 3 / 0,04157 $ (il costo per riga lo calcola il proxy dal listino Anthropic: Sonnet 5.5 narratore, Haiku 4.5 revisore). Nessun racconto di tappa nuovo nella stessa finestra.
- Per curiosità nuova: da 0,00602 $ (primo colpo) a 0,01800 $ (riscritta); media 0,0105 $. Una curiosità già scritta costa 0 $ per tutti.
- Voce: 0 $ (nelle prove l'audio rispondeva 503 per scelta). Nominatim, Photon e Wikipedia: gratis.

## Verifiche
- Suite verde: **246 file, 3061 test**; nuovi: `functions/curiosita.test.js` (nomi di OpenStreetMap, stesso luogo, luoghi attorno con Wikipedia finta, Photon, indirizzo dal telefono, prompt identico per impronta, controllo e riscrittura, cache), `functions/curiositaProxy.test.js` (il proxy vero: una nuova, cache a 0 chiamate, già dette, tappa, scartata, una sola nuova per richiesta, OpenStreetMap giù, indirizzo dal telefono, chiave rifiutata ai racconti), `lib/curiositaCammino.test.js`, `services/curiositaService.test.js`, `pages/mapPageCuriosita.test.jsx` riscritto (10 minuti, mai la stessa, silenzio, fermo). Tolto `curiositaCitta.test.js` (la frase fissa non c'è più).
- Lint 0 errori (189 avvisi già presenti). Build ok. `deno check` del proxy: il solo errore già noto (`index.ts`, `info.motivo`).
- `npm run banco:guardia`: **12/12**, pertinenza senza ❌ nuovi (3 già noti), prima di ognuno dei tre merge.
- `docs/corsia-e-permessi.json` vuoto: nessun file concesso.
- `.env.local` copiato da `~/unnivai-1b` senza stamparlo, cancellato a fine task. Nessuna scrittura sul database fuori dall'app (solo letture per il costo).

## Cosa NON risolve
- **Nominatim dal telefono**: ogni richiesta di curiosità manda la posizione a OpenStreetMap (come già per la città). Con molti utenti la regola di Nominatim (1 richiesta al secondo, niente uso massiccio) non basta: servirà un geocoder proprio o di Google. Dal server Nominatim risponde 403 e Photon non si raggiunge.
- **Elenchi**: la curiosità del Centro Storico di Catania è un elenco di nomi; il prompt lo vieta, nessun controllo lo vede. Proposta: un controllo che conti i nomi propri per frase.
- **«vi» scarta curiosità vere** (Via della Lungara, Via Vittorio Emanuele II): il controllo «parla a più persone» non distingue «vi» pronome di luogo. Non l'ho toccato (i controlli non si abbassano); proposta da decidere.
- **Il revisore lascia passare le invenzioni di posizione** (REVISORE-FORTE): vale anche qui. Le curiosità non dicono «sei in…», ma il revisore è lo stesso.
- **Lunghezza**: 161–479 caratteri, 12–35 secondi di voce; il prompt chiede 2–3 frasi, il controllo ne ammette 4. La stima di 14 caratteri al secondo non è misurata sulla voce umana (marin): se è più lenta, una curiosità lunga può finire più vicino alla svolta del previsto (la svolta comunque la interrompe e vince).
- **Curiosità pagate e non dette**: una curiosità che aspetta troppo (svolte, tappe) scade dopo 250 m; resta in cache, ma in quel giro non esce (Via Alessandrina, 0,01505 $).
- **Borghi**: a Troina via e quartiere («Via Roma», «Borgo») non hanno voci: silenzio, come chiesto. Dove Wikipedia non ha voci di vie o quartieri non esce niente.
- **In bici** le curiosità non escono più (prima sì, ogni 300 m).
- Le prove WebKit usano voce finta e orologio finto: inizio e fine delle frasi sono stimati con la regola dei 14 caratteri al secondo, non con l'audio vero.

## Cosa provare su iPhone (voce, audio, GPS, rete)
1. Una camminata vera di 20–30 minuti a Trastevere o in un altro rione, voce accesa (Marin): la prima curiosità dopo ~300 m, la seconda non prima di 10 minuti.
2. Che la curiosità non parta a ridosso di una svolta e che finisca prima di «Fra cento metri…» (la durata vera della voce).
3. Telefono in tasca: che la curiosità si senta come le indicazioni.
4. Con la rete debole: nessun errore a schermo, al massimo silenzio.

## Comandi che aspettano Ivano
Nessuno: nessuna migrazione, nessun secret.
