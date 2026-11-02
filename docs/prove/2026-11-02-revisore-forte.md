# REVISORE-FORTE — Haiku 4.5 contro Sonnet 5.5 come revisore dei racconti (02/11/2026)

Cartella `/Users/mac2023ivanosciretta/unnivai-notte-revisore-forte` (verificata con `pwd`: l'avvio del sotto-agente era in `unnivai-curiosita`, ho lavorato solo qui), worktree del ramo `notte/revisore-forte` da `origin/main` (`5d14ed5`). **Solo misura**: `src/` e `supabase/functions/` non toccati, nessun deploy, nessun secret cambiato, nessuna migrazione.

## Cosa cambia per Ivano
- **Niente cambia in produzione.** Il revisore resta Haiku 4.5.
- Numeri sullo stesso materiale per tutti e due i modelli: **Sonnet 5.5 lascia passare 4 invenzioni su 21 letture, Haiku 4.5 ne lascia passare 12 su 21**; **Sonnet boccia 0 racconti fedeli su 156 letture, Haiku ne boccia 21 su 156**. Costo per lettura del revisore: **0,00295 $ contro 0,00145 $** (circa il doppio); tempo medio **2,4 s contro 1,8 s**.
- La decisione è tua. Il comando per applicarla è in fondo, **non eseguito**.

## Come è fatta la misura
- **Testi e fonti congelati**: i 98 testi che il revisore ha davvero letto nella misura di RACCONTO-RIFINITURE (`docs/prove/dati/2026-10-31-racconti-r5.json`: 3 lanci × 23 tappe, r4 «prima» e r5 «dopo»; entra un testo se ha una verifica o se è una prima stesura scartata dal revisore; doppioni tolti), con le **fonti identiche** a quelle della prova. Più 1 caso noto di produzione non presente nella misura r5 (id 99, «Sopra la fontana l'ha messa Vaccarini», dal collaudo del sito). In tutto **99 testi**: stessi testi, stesse fonti, per tutti e due i modelli.
- **Prompt identico a produzione**: `messaggiVerifica` e `leggiVerifica` importati da `supabase/functions/openai-proxy/racconto.ts` (ultimo commit del file: `bd32e7c`; HEAD della prova: `5d14ed5`). Corpo come in `index.ts` (`rivedi`): temperatura 0, `max_tokens` 700. Una frase «no» boccia il racconto.
- **Strada senza secret né deploy**: il proxy pubblicato con `dv.purpose = 'aux'`; il passaggio sceglie il modello (`traduttore` → `claude-haiku-4-5`, `narratore` → `claude-sonnet-5-5`). Il modello vero di ogni risposta è nel grezzo (`_modello.usato`): in tutte le 678 chiamate è quello atteso, nessun ripiego, nessun errore, nessuna risposta illeggibile. Il percorso `racconto` del proxy non si è chiamato (scriverebbe in `place_racconti`). Account di prova, quota esente come nelle prove precedenti.
- **Concordanza con la produzione**: su 98 verdetti di Haiku della misura r5, la mia lettura di Haiku coincide **98 su 98**. La strada di misura è fedele.
- **3 lanci per modello**: a temperatura 0 i verdetti sono quasi identici da un lancio all'altro (Haiku: identici tutti e 3; Sonnet: 3 testi cambiano, id 26, 28, 99). I lanci confermano la stabilità, non aggiungono campioni indipendenti: i testi veri sono 99, le invenzioni naturali solo 7.
- **Etichette lette a mano da me** (`…-revisore-forte-etichette.json`), prima di vedere i verdetti: **F** fedele, **S** sfumatura senza fatto nuovo, **I** invenzione. Criterio del revisore: conta solo ciò che le fonti scrivono. 7 testi I, 52 F, 40 S. Tre (61, 91, 67: «Dentro c'è una cappella», «Dentro conserva stili») le avevo messe F e le ho riclassificate S **dopo** aver letto il motivo di Sonnet: sono scritte nel file.
- **Iniezioni** (id 100–113, sintetiche, in tabella a parte): 14 testi fedeli con **un** dettaglio inventato (vero o no nella realtà: una Lupa capitolina, il cannone a mezzogiorno del Gianicolo, «5 km» invece di 3…). Servono perché le 7 invenzioni naturali sono poche.

## Tabella: testi della misura r5 (99 testi: 7 I, 52 F, 40 S)
| modello | lancio | falsi «sì» (I lasciate passare) | falsi «no» (F bocciati) | S bocciate | resa (passati su 99) | $ per racconto | s per racconto (media / p95) |
|---|---|---|---|---|---|---|---|
| Haiku 4.5 | 1 | 4/7 | 7/52 | 17/40 | 72 (73%) | 0,00145 | 1,83 / 2,66 |
| Haiku 4.5 | 2 | 4/7 | 7/52 | 17/40 | 72 (73%) | 0,00145 | 1,80 / 2,72 |
| Haiku 4.5 | 3 | 4/7 | 7/52 | 17/40 | 72 (73%) | 0,00145 | 1,82 / 2,71 |
| **Haiku 4.5** | tutti | **12/21** | **21/156** | 51/120 | 216/297 (73%) | **0,00145** | **1,82 / 2,66** |
| Sonnet 5.5 | 1 | 2/7 | 0/52 | 9/40 | 85 (86%) | 0,00294 | 2,05 / 2,67 |
| Sonnet 5.5 | 2 | 1/7 | 0/52 | 9/40 | 84 (85%) | 0,00295 | 2,45 / 5,45 |
| Sonnet 5.5 | 3 | 1/7 | 0/52 | 9/40 | 84 (85%) | 0,00295 | 2,72 / 5,47 |
| **Sonnet 5.5** | tutti | **4/21** | **0/156** | 27/120 | 253/297 (85%) | **0,00295** | **2,41 / 5,38** |

Le invenzioni lasciate passare: **Haiku** su 4 testi su 7, sempre nei 3 lanci: id 8 («**Sopra** ci sono personaggi mitologici», Amenano), id 21 («il piazzale **dove sei**», Villa Sciarra), id 86 («il piazzale **da cui entri**», Villa Sciarra), id 99 («**Sopra la fontana l'ha messa** Vaccarini»). **Sonnet** su 2 testi: id 8 in 3 lanci su 3; id 99 in 1 lancio su 3. Le altre invenzioni (id 10 «Sopra c'è un'opera», id 20 «da cui entri», id 64 «nelle giornate limpide») le bocciano tutti e due, sempre.

## Tabella: iniezioni (14 testi, 1 invenzione ciascuno, sintetici)
| modello | falsi «sì» su 3 lanci | $ per racconto | s per racconto (media / p95) |
|---|---|---|---|
| Haiku 4.5 | **0/42** | 0,00157 | 2,00 / 2,24 |
| Sonnet 5.5 | **0/42** | 0,00328 | 2,78 / 5,77 (un picco di 10,6 s) |

Le invenzioni «grosse» (un oggetto, un numero, un nome, un colore, un'epoca) le prendono tutti e due. La differenza sta nelle invenzioni **di posizione e di relazione** («dove sei», «da cui entri», «l'ha messa sopra»): è quelle che il revisore di produzione lascia passare.

## Giudizi diversi fra i due modelli (29 testi su 99), letti a mano
Passati su 3 lanci: H = Haiku, S = Sonnet. «Vero» = la mia etichetta.

**Sonnet ha ragione, Haiku sbaglia**
| id | tappa, frase | H | S | letto a mano |
|---|---|---|---|---|
| 21 | Villa Sciarra, «il piazzale dove sei» | 3/3 | 0/3 | I. Le fonti danno **due** ingressi; Sonnet lo dice nel motivo. Il caso noto di RACCONTO-RIFINITURE. |
| 86 | Villa Sciarra, «il piazzale da cui entri» | 3/3 | 0/3 | I, stesso motivo. |
| 99 | Elefante, «Sopra la fontana l'ha messa Vaccarini» | 3/3 | 1/3 | I. Nei 2 lanci bocciati Sonnet scrive che le fonti dicono «realizzò la fontana», non che mise l'elefante. Nel lancio che passa ha sbagliato. |
| 3, 37, 69, 71 | Elefante, «la statua è romana» | 0/3 | 3/3 | F. La FONTE 2 (Google) scrive «statua romana». Haiku boccia 12 volte su 12: nel motivo dice che la fonte 1 non lo specifica, o riconosce la fonte 2 e boccia lo stesso. Il caso noto. |
| 11 | Mazzini, «Negli angoli sono sorsi quattro loggiati» | 0/3 | 3/3 | F. Wikipedia: «negli angoli… edifici dotati di terrazzini loggiati». Haiku ha letto male. |
| 74 | Teatro, «Cerca la gradinata e l'orchestra, e accanto, a est, c'è l'odeon» | 0/3 | 3/3 | F. «A est confina con l'odeon» è in Wikipedia; «Cerca» è frase di voce, ammessa dal prompt. |
| 98 | Campidoglio, «lo vedi dal Foro Romano» | 0/3 | 3/3 | F. Le fonti: «visibile dal Foro Romano». Haiku è pignolo senza motivo. |
| 15, 18, 53, 55 | Via Etnea, «bar, **negozi** e monumenti» | 0/3 | 3/3 | S. Google: «strada centrale dello shopping». Per me «negozi» è nelle fonti: Haiku sbaglia (a 15, 18, 53, 55 boccia solo per «negozi»). |

**Sfumature (S) dove i due divergono: il confine è discutibile**
| id | frase | H | S | letto a mano |
|---|---|---|---|---|
| 12 | «il duca che **guidava** la ricostruzione» (fonti: coordinatore e finanziatore) | 0/3 | 3/3 | Haiku è severo con ragione, la differenza è piccola. |
| 16 | «**alzando gli occhi** vedi l'Etna» | 0/3 | 3/3 | Haiku ha ragione: è un'immagine aggiunta. |
| 32 | «dal XII secolo **era** la sede» (fonti: già nel XII secolo era stato scelto) | 0/3 | 3/3 | Haiku ha ragione. |
| 39 | «il teatro **com'era** nel II secolo» | 0/3 | 3/3 | Haiku ha ragione (l'aspetto attuale risale al II secolo, non «com'era»). |
| 41 | «**Resta** la gradinata… accanto c'è l'odeon» | 0/3 | 3/3 | Il motivo di Haiku (accanto contro a est) è debole; la frase è in Google e Wikipedia. Sonnet più vicino al vero. |
| 46 | «Il **progetto** è di Tito Angelini» (fonti: a opera di) | 0/3 | 3/3 | Haiku ha ragione: progetto non è opera. |
| 92 | «Aperta solo il 16 marzo, **quindi guarda bene da fuori**» | 0/3 | 3/3 | Haiku ha ragione: consiglio non scritto. |
| 97 | «dal Foro Romano si vede **bene**» | 0/3 | 3/3 | Haiku ha ragione, di poco. |
| 26, 28 | Palazzo Massimo, cappella «dentro» + «se capiti in un altro giorno, la trovi chiusa» / «se capiti quel giorno, entra» | 0/3 | 2/3 e 1/3 | Sonnet incoerente (cambia da un lancio all'altro); i motivi sono sempre «dentro» e l'apertura riferita alla cappella. |
| 47 | Amenano, «Le **statue** sono personaggi mitologici» | 3/3 | 0/3 | Sonnet ha ragione: «statue» non c'è nelle fonti. |
| 60, 61, 67, 91 | «**Dentro** c'è una cappella» (palazzo con cappella) / «**Dentro** conserva stili differenti» (cattedrale) | 3/3 | 0/3 | Sonnet è troppo severo: «dentro» è una deduzione banale. **Sono i soli testi fedeli che Sonnet boccia.** |

**Letto a mano, in sintesi**: dei 29 testi in cui differiscono, 14 sono errori di Haiku (21, 86, 99 invenzioni lasciate passare; 3, 37, 69, 71, 11, 74, 98, 15, 18, 53, 55 testi fedeli bocciati), 4 sono errori di Sonnet (60, 61, 67, 91, tutti per «dentro»), in 1 (47, «statue») ha ragione Sonnet che boccia e Haiku che passa; il resto sono sfumature dove Haiku è per lo più severo con ragione e Sonnet passa.

## Che cosa succede alla resa vera (simulazione sui dati congelati)
La «resa» della tabella (73% contro 85%) conta i **testi**, e gran parte dei testi che Sonnet fa passare in più sono prime stesure che in produzione verrebbero riscritte. Sulla catena vera (prima stesura → revisore → una riscrittura → revisore) le 42 volte con fonti dei 3 lanci r5, con la maggioranza dei 3 lanci:
| | passate | scartate | incerte (il testo cade e la riscrittura non è nei dati) |
|---|---|---|---|
| Haiku 4.5 (com'è) | 40/42 | 0 | 2 |
| Sonnet 5.5 | 37/42 (30 + 7 già alla prima stesura) | 1 (Palazzo Massimo L2) | 4 |
Con Sonnet **7 racconti passano senza riscrittura** (Elefante ×3, Via Etnea ×2, Teatro ×2), **1 racconto scartato oggi passa** (Campidoglio L3) e **4 testi finali che oggi passano cadono**: Villa Sciarra L1 («dove sei», un'invenzione vera), Amenano L2 («statue»), Cattedrale L3 e Palazzo Massimo L2 («dentro»). Tre di questi quattro sono sfumature, non invenzioni. La resa vera con Sonnet sta fra **37/42 e 41/42** a seconda di quante riscritture passano; con Haiku fra 40 e 42. È una stima su 42 casi, non una misura.

## Costo
- **Fonte**: token reali restituiti dal proxy (`usage`), listino `scripts/banco/banco.config.json` → `prezziUsd.openaiPerModello`: Haiku 4.5 **1 $ / 5 $**, Sonnet 5.5 **2 $ / 10 $** per milione di token (nota del file: documentazione Anthropic, tabella del 25/09/2026; non ricontrollato in Console oggi).
- **Per lettura del revisore** (un testo): Haiku 664 token in / 161 out → **0,00145 $**; Sonnet 913 token in / 116 out → **0,00295 $** (il suo tokenizzatore conta più token sullo stesso prompt). **×2,03.**
- **Per racconto intero**: il costo medio di una tappa r5 (narratore Sonnet + revisore Haiku + riscritture) è **0,0089 $** con 1,26 letture del revisore; con Sonnet revisore sale a circa **0,0108 $** (+0,0019 $, +21%), a parità di riscritture.
- **Tempo**: media 2,41 s contro 1,82 s per lettura (+0,6 s); massimo Sonnet 10,6 s (una chiamata su 339), nessuna sopra i 20 s del timeout del revisore (`primoRevisore`). Misura con 4 chiamate in parallelo, uguale per i due modelli.
- **Costo di questa misura**: 678 chiamate: Haiku 0,497 $ + Sonnet 1,013 $ = **1,51 $** (più 0,004 $ di sonda).

## Raccomandazione
**Sonnet 5.5 come revisore, sì, se accetti circa +0,002 $ per racconto.** I numeri:
- falsi «sì»: **12/21 → 4/21**; il piazzale «dove sei» e «da cui entri» (3 lanci su 3) e «l'ha messa Vaccarini» (2 su 3) ora si prendono;
- falsi «no»: **21/156 → 0/156**: «statua romana» e le altre non si bocciano più per errore di lettura;
- costo ×2 per lettura, +21% per racconto; +0,6 s.
Il prezzo da pagare: Sonnet boccia anche qualche testo che usa «dentro» (4 testi su 99): con la riscrittura costa qualche racconto in più da rifare, non invenzioni lasciate passare.
**Non basta da solo**: «Sopra ci sono personaggi mitologici» passa con tutti e due (3 lanci su 3), «l'ha messa» passa con Sonnet 1 volta su 3. Su 7 invenzioni naturali campione piccolo: la differenza (4/7 contro 2/7 nei testi) è netta ma su pochi casi; le 14 iniezioni non la distinguono.

Comando che applicherebbe la scelta (**non eseguito**; vale dalla richiesta dopo, nessun deploy):
```
supabase secrets set ANTHROPIC_MODEL_REVISORE=claude-sonnet-5-5 --project-ref ahecpiwsdhghkndncejb
```
Per tornare indietro: `supabase secrets unset ANTHROPIC_MODEL_REVISORE --project-ref ahecpiwsdhghkndncejb` (il codice usa Haiku 4.5 quando il secret manca). I racconti già in cache restano com'erano fino al loro TTL; l'Elefante con «Sopra la fontana l'ha messa» è ancora in `place_racconti` (comando di cancellazione già in RACCONTO-RIFINITURE).

## Prove
- 678 chiamate vere al proxy pubblicato (339 per modello = 113 testi × 3 lanci), nessun errore, nessun ripiego, modello atteso su tutte.
- Suite verde: **243 file, 3020 test**. Lint **0 errori** (189 avvisi già presenti). Build ok. `npm run banco:guardia`: **12/12**, pertinenza senza ❌ nuovi (3 già noti). Nessun file di `src/` o `supabase/functions/` cambiato.
- Dati: `docs/prove/dati/2026-11-02-revisore-forte-corpus.json` (testi e fonti), `…-misura.json` (risposte grezze, token, ms), `…-etichette.json` (le mie etichette con la nota), `…-analisi.txt` (tabelle e motivi per testo). Script: `scripts/prova-reale/revisore-forte-corpus.mjs`, `revisore-forte.live.js`, `revisore-forte-analisi.mjs`.
- `.env.local` copiato da `~/unnivai-1b` senza stamparlo e `.env` con URL e chiave anon pubblici (presi dal bundle di unnivai.vercel.app): tutti e due cancellati a fine task.

## Cosa NON risolve
- **Non cambia niente in produzione**: finché il secret non cambia, il revisore è Haiku 4.5 e le invenzioni di posizione passano.
- **Il revisore forte non è a prova di invenzione**: «Sopra ci sono personaggi mitologici» passa con tutti e due; «l'ha messa» è passato a Sonnet una volta su tre.
- **Campione piccolo**: 7 invenzioni naturali su 99 testi, 3 gruppi di frasi; i 3 lanci non sono campioni indipendenti. Le 14 iniezioni sono sintetiche e facili.
- **Le etichette sono mie**: le sfumature (S) si possono leggere in un verso o nell'altro; tre le ho cambiate dopo aver visto Sonnet, e lo dico nel file.
- **La strada di misura passa dal proxy `aux`** (passaggi `traduttore` e `narratore`), non dal percorso `racconto`: il codice che manda la richiesta al modello è lo stesso (`chiamaAnthropicElenco`), ma timeout e catena del passaggio sono quelli del passaggio, non quelli di `primoRevisore`. Con il secret cambiato in produzione il comportamento di Sonnet va riconfermato su un racconto vero (la riga di log `racconto: … modello+modelloVerifica` dice quale modello ha letto).
- **Il narratore non cambia**: la riscrittura resta una sola.
- **La Lupa del Campidoglio e il cannone del Gianicolo**: veri nella realtà, non nelle fonti. Il revisore li boccia giustamente; se un giorno si vuole la conoscenza del mondo, è un'altra scelta.
