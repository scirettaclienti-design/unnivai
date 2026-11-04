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

