# C10b3-bis — quote corrette: fase A (il cancello non passa)

**Esito: 🔴 il cancello non passa già con Napoli e Roma.** Come chiede il task, non ho chiesto le liste di Catania, Palermo, Lecce e Troina, e non ho fatto la fase B.

| Voce del cancello (fissata prima dei numeri) | Napoli | Roma |
|---|---|---|
| Simbolo presente | ✅ | ✅ |
| Lista generata da `gpt-6.1-sol` (nessun ripiego) | ✅ | ✅ |
| Inventati ≤ 15% | ✅ 0% | ✅ 6% |
| Essenziali di controllo ≥ 4 su 6 | 🔴 **2/6** | 🔴 **1/6** |

Le quote corrette ci sono tutte e due le volte, senza bisogno del completamento. Il cancello cade sugli essenziali, e il perché è nella sezione «Perché il cancello non passa».

## 0) Prima di tutto

- **Ramo `c10b3`:** `be59b32` è sul remoto (`origin/c10b3`). Main resta `8d3fe89`, non toccato.
- **Il client in produzione (`8d3fe89`) funziona con `openai-proxy` v21, e anche con la v22: sì.**
  - La risposta della lista ha la stessa forma: `cityKnowledge.{verificati, conti, cached, scala, centro, modelli}`.
  - Il client (`cityKnowledgeService.chiediLista`) legge solo questi campi. `poiDallaLista` copia da `_citta` solo `tipo`, `momento`, `quartiere`, `simbolo` e `simboloDedotto`. I campi nuovi (`quote`, `categoria`, `passeggiata`, `completamento`) li ignora.
  - Traduttore, selettore e narratore rispondono come prima, e `_modello` c'era già.
  - **Un limite:** il client aspetta la lista al massimo 110 s; se va oltre, il giro esce senza lista, com'era già previsto. Con un ripiego, un secondo tentativo e un completamento, la prima lista del giorno può superare quel tempo. La riga si salva comunque sul server e la richiesta dopo la trova.

## Cosa ho fatto

1. **Quote corrette** (`supabase/functions/openai-proxy/cityKnowledge.ts`, `QUOTE`, lista `c10b-6`). Per città e metropoli:
   - almeno 8 luoghi da visitare (chiesa, museo, monumento, palazzo, giardino);
   - **piazze monumentali e vie storiche** (categorie `piazza` e `via`): 2–3, che **non contano negli 8**; le vie storiche valgono come passeggiata (`passeggiata: true`);
   - belvedere al massimo 1;
   - mercati storici da 1 a 2, se esistono, con giorni e orari;
   - 3–4 ancore, cioè i posti che un abitante nomina per primi: possono essere una piazza o una via storica, mai un locale;
   - il simbolo resta un luogo da visitare (`simboloPossibile` invariato);
   - colazioni e pasti invariati, **dopocena obbligatorio**;
   - in città fino a 18 posti; in metropoli fino a 20.

   La regola dei quartieri (almeno 3 luoghi da visitare per quartiere principale) e il borgo restano come in C10b3.
2. **Un solo completamento per tutte le quote mancanti:** luoghi da visitare (anche per quartiere), piazze e vie, ancore, dopocena (`quoteLista().mancanti`, `promptCompletamento`, `completaLista`).
   - Si prende solo ciò che manca, categoria per categoria.
   - Un'ancora può essere anche un posto già in lista: il modello ne ripete il nome e diventa essenziale (`promossi`).
   - Le aggiunte non diventano mai simbolo.
3. **Nessun nome delle liste di controllo nel prompt della lista né nel codice nuovo.** Restano nomi scritti prima di questo task:
   - nel prompt del **traduttore** (`aiRecommendationService.js`: «Villa Bellini» fra gli esempi di parchi urbani, «il Colosseo» per riconoscere la città);
   - nei commenti di `nomeCompatibile` (C10).

   Non li ho toccati: il traduttore non fa la lista. Se vanno tolti, è una decisione da prendere.
4. **Un nuovo tentativo a `gpt-6.1-sol` dopo un errore** (non dopo il tempo scaduto, non dopo una risposta vuota), prima del ripiego. Vale nella lista (`modelli.ts`, `chiamaConRipiego`) e anche nel traduttore e nel selettore (`index.ts`).
   - Il tracciato scrive `tentativi: 2` e `primoErrore`.
   - Il motivo dell'errore ora porta anche il tipo e il messaggio di OpenAI.
   - Per il selettore, due errori più il ripiego possono arrivare a circa 55 s, oltre i 50 s che il client aspetta. Va deciso se il nuovo tentativo deve valere anche lì.
5. **Il costo salvato nella riga** (`costo.usage`) conta i token di tutte le chiamate, completamento compreso, anche divisi per modello (`usageTotale`).

**L'errore di Roma in C10b3:** `gpt-6.1-sol` ha risposto **HTTP 500 dopo 39,9 s**, senza codice d'errore. Nei log della funzione c'è solo «HTTP 500 -»: il proxy di allora non teneva tipo né messaggio, quindi altro non si sa. Da v22 il motivo li tiene.

**Test.** File nuovo `src/__tests__/services/c10b3bis.test.js`, 6 test: **tutti rossi su `be59b32`, verdi ora**.
- una piazza o una via storica entra senza contare negli 8;
- un'ancora può essere una piazza, il simbolo no;
- un solo completamento copre più quote;
- il dopocena mancante viene completato;
- dopo un errore c'è un nuovo tentativo prima del ripiego;
- il costo conta il completamento.

Ho aggiornato i test che descrivevano le regole cambiate. Le asserzioni nuove di `c10b3.test.js` corrispondono alle regole decise da Ivano:
- `c10b3.test.js`: piazze e belvedere non contano più fra i luoghi da visitare;
- `c10b2.test.js`: un errore ripiega dopo il secondo tentativo;
- `cittaC10.test.js` e `c10bScale.test.js`: testo del prompt e versione.

**Suite: 2029 test verdi** (152 file). Lint: 0 errori. `deno check`: pulito.

**Deploy:** `openai-proxy` **v22** in produzione (lista `c10b-6`). Client non pubblicato, niente merge su main, nessuna migrazione.

## Fase A — Napoli e Roma (`c10b-6`, giorno 15/10)

Grezzo: `docs/prove/dati/2026-10-17-c10b3bis-fase-a-1.json`; script `scripts/prova-reale/c10b3bis-liste.live.js`.

| | Napoli | Roma |
|---|---|---|
| Scala | metropoli | metropoli |
| Quartieri (luoghi da visitare) | Centro storico 3, San Ferdinando 3, Vomero 3 | Pantheon 3, Trastevere 3, Testaccio 3 |
| Quote | ✅ tutte: 9 visite, 2 piazze/vie, 0 belvedere, 1 mercato, 3 ancore, 2 colazioni, 2 pasti, 1 dopocena | ✅ tutte: 9 visite, 2 piazze/vie, 0 belvedere, 1 mercato, 3 ancore, 1 colazione, 2 pasti, 1 dopocena |
| Completamento | non servito | non servito |
| Ancore | Duomo di Santa Maria Assunta, Palazzo Reale, Castel Sant'Elmo | Pantheon, Santa Maria in Trastevere, Piramide di Caio Cestio |
| Simbolo | uno per quartiere: Duomo, Palazzo Reale, Castel Sant'Elmo | Pantheon, Santa Maria in Trastevere, Piramide Cestia |
| Piazze e vie storiche | Piazza del Plebiscito, Via San Gregorio Armeno | Piazza della Rotonda, Piazza S. Ignazio |
| Modello che ha risposto | `gpt-6.1-sol` (abitanti 3,0 s, lista 48,1 s), nessun ripiego né secondo tentativo | `gpt-6.1-sol` (abitanti 2,2 s, lista 42,5 s), nessun ripiego né secondo tentativo |
| Essenziali di controllo trovati | **2/6**: Duomo di Napoli, Piazza del Plebiscito | **1/6**: Pantheon |
| Essenziali di controllo mancanti | Cappella Sansevero, Museo Archeologico Nazionale, Castel dell'Ovo, Spaccanapoli | Colosseo, Fontana di Trevi, Basilica di San Pietro, Foro Romano, Piazza Navona |
| Inventati | 0/17 (0%) | 1/16 (6%) |
| Tempo (dal client) | 55,0 s | 46,7 s |
| Costo (listino del banco) | 0,63 $ (token 0,022 $ + Google 0,61 $) | 0,60 $ (token 0,022 $ + Google 0,58 $) |
| Costo reale (senza le ricerche dalla cache) | 0,18 $ | 0,25 $ |

**Essenziali di controllo, liste a confronto:**

| Città | C10b (4o-mini) | C10b2 | C10b3 | **C10b3-bis** |
|---|---|---|---|---|
| Napoli | 3 | 2 | 1 | **2** |
| Roma | 2 | 0 | 2 | **1** |

## Perché il cancello non passa

1. **Le quote ci sono, le icone no.** Le liste rispettano ogni quota al primo colpo e il completamento non scatta mai: non c'è nulla da completare. Le quote dicono *quanti* posti per categoria, non *quali*.
2. **In metropoli il modello sceglie i quartieri «da abitante» e mette il minimo di ancore.**
   - Roma: Pantheon, Trastevere e Testaccio. Non c'è il quartiere del Colosseo e dei Fori, né il Vaticano.
   - In ogni quartiere un'ancora sola, cioè 3 in tutto, il minimo, mentre il prompt ne permette 2 per quartiere.
   - Fontana di Trevi e Piazza Navona sarebbero potute entrare come ancore (la Fontana come monumento, la piazza come piazza storica). Il modello ha preferito Piazza della Rotonda e Piazza S. Ignazio.
3. **Le piazze e vie storiche aiutano dove il modello le sceglie:** a Napoli entra Piazza del Plebiscito. Come via storica il modello sceglie Via San Gregorio Armeno, non Spaccanapoli. Esce la Cappella Sansevero, che in C10b3 era il simbolo dei Decumani.

## Spesa

| Voce | Listino del banco | Reale |
|---|---|---|
| Fase A: Napoli e Roma | **≈ 1,23 $** | ≈ 0,43 $ |
| Fase B | non fatta | — |
| **Totale del task** | **≈ 1,23 $** (tetto 6 $) | ≈ 0,43 $ |

## Scritture sul database

- Il proxy v22 ha **scritto 2 righe nuove** in `city_knowledge`: `(napoli, 2026-10-15, c10b-6)` e `(roma, 2026-10-15, c10b-6)`.
- **Le 6 righe `c10b-5` del 15/10** (Catania, Lecce, Napoli, Palermo, Roma, Troina) **non le ho cancellate né modificate.** Dalla v22 il proxy cerca solo `c10b-6`, quindi per l'app sono già fuori uso: nessuno le legge più.
  - Napoli e Roma sono sostituite dalle righe nuove.
  - Le altre quattro le avrebbe sostituite il seguito della fase A, che non c'è stato. Le genererà il primo tour del giorno.
- Se vuoi le righe vecchie cancellate, basta una `delete` su `versione = 'c10b-5'`. Non l'ho fatta senza che servisse.

## Proposte (non scritte)

1. **In metropoli, 2 ancore per quartiere principale** (oggi da 1 a 2): con 3 quartieri sono 6 ancore invece di 3. È la quota delle ancore che il modello riempie al minimo.
2. **I quartieri di una metropoli: «quelli dove un abitante porta un amico la prima volta»,** al posto di quelli «dove va chi ci abita». È una scelta di tono, tocca il merito anti-ovvio: da decidere.
3. **Il cancello sulla lista o sul tour:** «conosce la città» del banco misura gli essenziali nel tour. La lista di una metropoli è per costruzione divisa in quartieri e il tour ne usa uno o due: anche una lista perfetta non avrebbe Colosseo e San Pietro nello stesso giro.
4. **Il nuovo tentativo nel selettore:** limitarlo al tempo che resta, così da stare nei 50 s del client.

## Decisioni per Ivano

1. Le proposte 1 e 2 e una nuova fase A (circa 1,2 $ per Napoli e Roma), oppure accettare le liste `c10b-6` e passare alla fase B.
2. Se cancellare le 6 righe `c10b-5`.
3. Se togliere dal prompt del traduttore gli esempi «Villa Bellini» e «il Colosseo» (punto 3 di «Cosa ho fatto»).

## Cosa ho dato per vero senza verificarlo

1. **Un campione per città:** una lista per città. Il modello cambia da una chiamata all'altra: una seconda lista di Roma potrebbe avere altri quartieri.
2. **«Il client in produzione funziona»** l'ho stabilito leggendo il codice di `8d3fe89`, non con un tour vero dall'app pubblicata.
3. **Il 500 di Roma in C10b3:** non so se fosse un guasto di OpenAI o una richiesta che il modello non reggeva. Il log non lo dice e non l'ho riprodotto.
4. **Il nuovo tentativo** l'ho provato solo nei test: in questo giro nessuna chiamata ha dato errore.
5. **Il costo reale** conta a zero le ricerche servite dalla cache del proxy. Non l'ho confrontato con le fatture di Google e OpenAI, e i prezzi dei token sono quelli del listino pubblico.
6. **Le liste di controllo** le ho usate come metro, come chiede il cancello. Non dicono se Certosa di San Martino, Piramide Cestia o Testaccio valgano meno per un abitante.
