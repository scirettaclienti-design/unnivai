# CHAT-FOCUS-FONTI — la chat sa quale scheda è aperta, le fonti del giro pronte all'avvio (05/11/2026)

Coda notturna del 05/11, task T20. Worktree `~/unnivai-notte-t20`, ramo `notte/chat-focus-fonti` da `origin/main` (`f6760b3`).

## 1. Cosa cambia per Ivano

- **La chat risponde sulla scheda aperta quando la domanda è vaga.** Il telefono già mandava il luogo aperto (T12); ora lo scrittore lo legge: nel giro c'è la riga «SCHEDA APERTA ORA sul telefono dell'utente: <tappa> (tappa N del giro)» e una regola: «cosa c'è qui?», «quanto ci resto?», «è aperto?» parlano di quel luogo; se la domanda nomina un altro luogo, vale il luogo nominato. Revisore, controllo automatico e regole sui fatti: invariati (il revisore legge la stessa riga, che è un nome e non un fatto). `VERSIONE_CHAT` c1 → c2.
- **All'avvio del giro le fonti delle tappe si preparano.** Una chiamata leggera (`purpose: 'chat'` con `precarica: true`) manda le tappe; il server le mette in memoria (Wikipedia + descrizione Google, che ha già la sua cache nel places-proxy). Nessuna AI, nessuna quota. Una volta per giro, solo con accesso e consenso AI, al più 12 tappe, quelle già in memoria non si rifanno.
- Compatibilità: app nuova + proxy vecchio: la precarica prende 400 `CHAT_NON_VALIDA` (manca la domanda) e il telefono la ignora. App vecchia + proxy nuovo: la chat funziona come prima (con `aperto` ora letto dallo scrittore). Nessuna migrazione, nessun secret.

## 2. Il codice

| File | Cosa |
|---|---|
| `supabase/functions/openai-proxy/chat.ts` | `testoGiro(…, aperto)`, regola «SCHEDA APERTA» nel prompt, `VERSIONE_CHAT = c2` |
| `supabase/functions/openai-proxy/index.ts` | `handlePrecaricaFonti`; `handleChat` passa `aperto` a `fontiChat` |
| `src/services/chatGuidaService.js` | `precaricaFontiGiro`, una volta per giro, solo con consenso |
| `src/pages/MapPage.jsx` | la precarica parte quando comincia la navigazione |
| `scripts/prova-nav/chat-focus-fonti.webkit.mjs` | le 10 domande fisse, WebKit iPhone 14, sito pubblicato |

Test: 3 nuovi su `chat.test.js` (riga e regola nel prompt dello scrittore e del revisore; senza scheda niente riga; precarica senza accesso/senza tappe), 1 su `chatGuida.test.jsx` (una volta per giro, senza domanda, senza consenso niente).

## 3. Misura PRIMA (sito pubblicato, openai-proxy v48, app com'era)

Giro di Catania del banco (6 tappe), «Avvia» con GPS finto, scheda della prima tappa (Fontana dell'Elefante) aperta; ogni domanda in una chat nuova aperta dalla scheda. Tempo = dall'invio alla fine di «Controllo le fonti…». Dati: `docs/prove/dati/2026-11-05-chat-focus-fonti-prima.json`.
Limite del banco: in navigazione la scheda aperta è sempre la prossima tappa, che il proxy di prima già conosceva (`prossima`); la differenza di «tappa giusta» si vede quindi poco. Il prima è stato girato due volte (la prima per un difetto di lettura del testo, solo i tempi: mediana 4,35 s); sotto la seconda.

| # | Tipo | Domanda | Prima parola (s) | Tappa giusta | Frasi inventate |
|---|---|---|---|---|---|
| v1 | vaga | Cosa c'è qui? | 5,36 | sì | 0 |
| v2 | vaga | Quanto ci resto? | 4,84 | sì (15 minuti) | 0 |
| v3 | vaga | È aperto? | 4,33 | sì, ma sposta il discorso sulla cattedrale | 0 |
| v4 | vaga | Mi racconti qualcosa di questo posto? | 4,85 | sì | 0 |
| v5 | vaga | Com'è fatto? | 4,33 | sì | 1 dubbia («la descrivono come romana»: non sta nell'introduzione di Wikipedia, forse nella descrizione Google) |
| s1 | specifica | Chi ha costruito la Cattedrale di Sant'Agata? | 6,38 | n.a. | 0 |
| s2 | specifica | A che ora è prevista la tappa al Teatro romano di Catania? | 4,85 | n.a. | 0 |
| s3 | specifica | Cos'è il Monastero dei Benedettini di San Nicolò l'Arena? | 6,34 | n.a. | 0 |
| s4 | specifica | Per cosa è famosa Via dei Crociferi? | 4,34 | n.a. | 0 |
| s5 | specifica | Quanto mi fermo al Teatro Massimo Bellini? | 4,35 | n.a. | 0 |

**Mediana prima: 4,84 s** (min 4,33, max 6,38). Tappa giusta sulle vaghe: 5 su 5. Invenzioni (le frasi con fatti confrontate a mano con l'introduzione di it.wikipedia delle tappe e col giro): 0 certe, 1 dubbia su 10 risposte.

Dove va il tempo (log di openai-proxy v48 su queste 10 risposte, `fonti N ms, tutto M ms`): fonti 235–657 ms con la memoria calda, 1907 e 2673 ms nelle due domande a freddo (s3 sul monastero: luogo nominato non in memoria; v1 la prima) ; tutto 3,4–5,9 s (7,8 s la prima della prima serie). Scrittore + revisore (Sonnet 5.5 entrambi) valgono quindi circa 3,3–3,5 s in ogni risposta: è lì il tetto, non nelle fonti.

## 4. Pubblicazione

- PR #40, merge `0709f53` su `main`; CI verde (due run di «Lint & Test» sul ramo cadevano su `c10b2.test.js` per un timeout di 5 s sul runner, 1,7 s in locale: portato a 20 s, test non toccato per il resto), Vercel `success` sul merge.
- openai-proxy: **v48 → v49**, `supabase functions deploy openai-proxy --use-api` da `~/unnivai-notte-t20-deploy` (detached su `0709f53`). Nessun secret, nessuna migrazione.
- Collaudo del sito subito dopo il deploy (`collaudo-sito.webkit.mjs`): punti 1–6 e 8–13 ok; il 7 da ospite non passa come sempre (accessi anonimi spenti, atteso dal 31/10). Dati in `docs/prove/dati/2026-10-30-collaudo-sito.json`. Niente peggiora: nessun ripristino.

## 5. Misura DOPO (sito pubblicato dopo il merge, v49, stesso giro, stesse 10 domande)

Dati: `docs/prove/dati/2026-11-05-chat-focus-fonti-dopo.json`. La precarica è partita da sola all'avvio: 6 tappe, 6 nuove, 1,9 s sul server; la chat è `c2`.

| # | Tipo | Prima parola (s) | Server (s) | Esito | Tappa giusta | Frasi inventate |
|---|---|---|---|---|---|---|
| v1 | vaga | 6,90 | 4,00 | verificata | sì | 0 |
| v2 | vaga | 4,36 | 4,05 | verificata | sì (quindici minuti, 09:30) | 0 |
| v3 | vaga | 8,37 | 7,75 | riscritta | sì, ma dice «non ho una fonte» sugli orari e passa alla cattedrale | 0 |
| v4 | vaga | 5,86 | 5,31 | riscritta | sì | 0 |
| v5 | vaga | 4,35 | 4,00 | verificata | sì | 0 (la «statua romana» c'era anche prima: la fonte la dice) |
| s1 | specifica | 5,36 | 4,89 | verificata | n.a. | 0 |
| s2 | specifica | 4,35 | 3,97 | verificata | n.a. | 1 dubbia («la gradinata»: non sta nell'introduzione di Wikipedia) |
| s3 | specifica | 6,87 | 6,04 | verificata | n.a. | 0 |
| s4 | specifica | 4,35 | 3,64 | verificata | n.a. | 0 |
| s5 | specifica | 4,35 | 3,91 | verificata | n.a. | 1 dubbia («l'auditorium a taglio dorato»: non sta nell'introduzione di Wikipedia) |

Le «dubbie» sono frasi che il revisore ha passato e che non trovo nell'introduzione di Wikipedia che ho confrontato a mano; possono stare nella descrizione Google, che da fuori non vedo.

## 6. Prima e dopo

| | Prima (v48, app di prima) | Dopo (v49, app nuova) |
|---|---|---|
| Mediana della prima parola, 10 domande | **4,84 s** | **4,86 s** |
| Minimo – massimo | 4,33 – 6,38 s | 4,35 – 8,37 s |
| Risposte sotto i 4,5 s | 5 su 10 | 6 su 10 |
| Vaghe sulla tappa giusta | 5 su 5 | 5 su 5 |
| Frasi inventate (0 certe) / dubbie | 0 / 1 | 0 / 2 |
| openai-proxy | v48 | v49 |

**Esito onesto: l'obiettivo «mediana sotto 4 s» non è raggiunto, e la mediana non si muove (4,84 → 4,86 s).** Dove va il tempo: nello scrittore e nel revisore, non nelle fonti. Dai log: con la memoria calda le fonti costano 0,2–0,7 s su 3,4–5,9 s di risposta; scrittore + revisore (Sonnet 5.5 + Sonnet 5.5) circa 3,3–3,5 s. La precarica toglie solo il caso a freddo (1,9 e 2,7 s di fonti nel prima), che in questa serie non è capitato dopo l'avvio; il guadagno si vede dove la memoria dell'istanza è fredda (prima domanda dopo un po' di pausa, istanza nuova), non nella mediana. In più, due risposte su dieci sono state riscritte dal revisore (v3, v4: +1,5–3,5 s ciascuna), come capita su una domanda vaga a cui le fonti non danno una frase di fatto (orari). Per scendere sotto i 4 s servono un modello più veloce per la scrittura (Haiku 4.5: ≈ 3,7 s ma 3 frasi inventate su 55, già scartato il 04/11) o la risposta a pezzi mentre arriva (streaming): decisioni di Ivano, fuori da questo task.

**La tappa giusta non cambia perché il banco non la mette alla prova:** in navigazione la scheda aperta è sempre la prossima tappa, che il proxy di prima già conosceva (`prossima`). Il caso in cui la scheda aperta non è la prossima (la mappa senza giro, o una scheda aperta dalla panoramica) non è misurato qui; il test di unità controlla che la riga arrivi a scrittore e revisore.

## 7. Costo

- AI: 20 risposte della misura «prima» (due serie, la prima per un difetto di lettura del mio script) + 10 «dopo» + 10 della prova a vuoto ≈ 40 risposte × 0,011–0,013 $ ≈ **0,5 $** a listino. La precarica non chiama nessuna AI.
- Google: la precarica chiama la descrizione dei posti dal places-proxy (con la sua cache); sei tappe, tutte già in cache dalle prove precedenti: ≈ 0 $. Tetto del task (4 $) non toccato.

## 8. Cosa NON risolve

- La mediana sopra i 4 s (§ 6).
- La memoria delle fonti è per istanza della funzione (un'ora): un'altra istanza le cerca di nuovo. Una tabella delle fonti sarebbe una migrazione: non fatta.
- La precarica non ha quota: ammessi solo utenti con accesso (utente o ospite), al più 12 tappe, quelle già in memoria non si rifanno. Un utente con accesso potrebbe chiamarla in serie: ogni chiamata costa solo Wikipedia (gratis) e la descrizione Google (cache).

## 9. Passi che aspettano Ivano

- Su iPhone: avvia un giro, apri la scheda di una tappa, tocca «Chiedi alla guida» e chiedi «cosa c'è qui?», «quanto ci resto?», «è aperto?»; la risposta deve parlare di quella tappa e la riga in alto dice «Focus: <tappa>».
- Decidere se cercare i 4 s (modello più veloce o risposta a pezzi): nessun comando da lanciare.
