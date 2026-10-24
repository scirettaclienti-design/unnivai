# NAV-OSSIDIANA — la navigazione usa lo stile Google «Unnivai · Ossidiana Navigazione»

Ramo `nav-ossidiana` → `main` (commit `b4cb674`), deploy READY, CI verde sullo stesso SHA. Segue MAPPA-STILE (`docs/prove/2026-10-24-mappa-stile.md`), che aveva già tolto i filtri CSS e messo il Map ID in una variabile.

## Fatto

| Richiesta | Esito |
|---|---|
| Map ID solo da `VITE_GOOGLE_MAP_ID_NAV`, mai nel codice | ✅ `src/lib/mapId.js`; un test cerca il Map ID in tutto `src/` (fuori dai test) e non lo trova; sta in `.env.example` |
| Variabile su Vercel, Production + Preview, e in `.env.example` | ✅ `vercel env add` per `production` e per `preview` (tutti i rami), verificato con `vercel env ls`; `.env.example` ha `VITE_GOOGLE_MAP_ID_NAV=28861a61c07876f889cc6572` |
| Mappa di navigazione con `mapId` + `colorScheme: DARK` e inclinazione 0 | ✅ `GoogleMapContainer` (`opzioniNavigazione`): `colorScheme: 'DARK'` e `defaultTilt` 0; anche le quattro scritture di camera della navigazione (`MapPage`: avvio, tappa dopo, ritorno al seguimi, vola sull'utente) passano da `inclinazioneNav` (0 con lo stile dedicato, come prima altrimenti) |
| Via i 4 filtri CSS; una sola variante | ✅ (già in MAPPA-STILE; test che non tornino) |
| Variabile assente → la mappa funziona come oggi | ✅ test: nessuna opzione, inclinazione di prima, `VITE_GOOGLE_MAP_ID` |
| Il filo del giorno non copre il tasto indietro | ✅ **sul sito pubblicato** tasto y 8–54, filo y 64–144, pillola y 152–226: nessuna sovrapposizione; in cima al centro del tasto c'è il tasto (`docs/prove/dati/2026-10-24-nav-ossidiana-live.json`) |
| Non toccare Esplora, arrivo, percorso, voce | ✅ la mappa di Esplora (non in navigazione) usa il Map ID di sempre (test); logica di arrivo, percorso e voce non toccate |
| Sul sito pubblicato la navigazione a Catania mostra fondo Ossidiana, isolati appena più chiari, strade scure, niente negozi | ✅ `ossidiana-live-03-navigazione.png`: fondo quasi nero caldo (`#1B1816`, `#161311`), isolati appena più chiari, strade scure, **nessun negozio né icona di locale**, vista dall'alto, nomi di vie in bianco |
| Tratto fatto / prossimo / resto leggibili (≥ 3:1) | ✅ misurato sui **pixel veri** della mappa pubblicata (colori dominanti `#1B1816`, `#161311`, `#1B1D17`, `#1B1815`, `#1F1814`): fatto `#A8A29E` **6,7–7,3:1**, prossimo `#F97316` **6,1–6,6:1**, resto `#8F8880` **4,9–5,3:1**; in test su terra/edifici/strade del canvas ≥ 3:1 |
| Screenshot affiancato alla schermata 1 del canvas | ✅ `docs/prove/schermate/mappa-stile/ossidiana-affiancato-1-cammino.png` (canvas a sinistra, sito pubblicato a destra) |
| `git log --oneline -5 main` | sotto |

## `git log --oneline -5 main`

```
b4cb674 NAV-OSSIDIANA: la mappa di navigazione si crea con il Map ID Ossidiana (da VITE_GOOGLE_MAP_ID_NAV), colorScheme DARK e inclinazione 0
6751bef GIRI-SALVATI: report con la prova dal vivo, i controlli e cosa non è risolto
3aacab3 GIRI-SALVATI: dopo «Togli» o «Cambia» il tasto torna «Salva il giro» (il giro è un altro); script della prova dal vivo
1e70117 GIRI-SALVATI: il giro si salva per intero (tappe, orari, soste, tempo libero) e si riapre dal Profilo com'era, con «Vedi mappa» e senza generare (0 $)
01ee207 MAPPA-STILE: report, prova dal vivo e screenshot affiancati (in attesa del Map ID)
```
(le prime righe sono i commit di questo lavoro; il report si pubblica subito dopo)

## Controlli

Suite 212 file / **2591 test verdi**; lint 0 errori, 191 avvisi (come `main`); build ok; CI verde su `b4cb674`. Spesa ≈ 0 $ (giro in cache, solo la prova dal vivo di navigazione).

## Cosa NON risolve

- **Un'anteprima locale fatta prima della pubblicazione dello stile** mostrava il buio standard di Google (blu, con fermate e musei: `ossidiana-locale-prima-dello-stile.png`); nella prova sul sito pubblicato, pochi minuti dopo, lo stile era quello Ossidiana. Non so dire se fosse la propagazione di Google o un'altra causa; se rivedi il blu con fermate e musei, lo stile non è associato alla modalità buio di quel Map ID o non è pubblicato.
- **Una sola variante** (come chiesto): mattina, tramonto e notte arriveranno come Map ID separati; `VITE_GOOGLE_MAP_ID_NAV` oggi vale a ogni ora.
- Cambiando Map ID/colorScheme all'avvio della navigazione **la libreria ricrea la mappa**: dal vivo la navigazione parte e segue il GPS finto senza errori, ma una verifica con un iPhone vero e il GPS vero manca.
- Il tratto «fatto» (tratteggio) non si vede nello screenshot (il giro è alla terza tappa e il tratto fatto è fuori inquadratura): il suo contrasto è misurato ma non visto.

## Cosa ho dato per vero senza verificarlo

- Che il Map ID sia quello giusto e la sua modalità buio sia lo stile Ossidiana: l'ho giudicato dallo screenshot (colori e assenza di negozi), non dalla Cloud Console.
- Che `vercel env add` senza ramo valga per **tutti** i rami di Preview (lo mostra `vercel env ls`, non ho aperto una Preview).
- Che il colore dominante dei pixel di una schermata rappresenti i colori dello stile in tutta la città (campionata solo una zona di Catania).
- Che WebKit con profilo iPhone 13 sia fedele all'iPhone vero per la modalità buio e la vista dall'alto.

## Processi

Vite di prova (porta 5191) chiuso; collegamento Vercel locale creato con `vercel link` (cartella `.vercel`, ignorata da git; ha aggiunto `VERCEL_OIDC_TOKEN` a `.env.local`, anch'esso ignorato).
