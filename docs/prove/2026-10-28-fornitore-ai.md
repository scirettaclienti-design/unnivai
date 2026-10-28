# FORNITORE-AI — il testo dei giri esce da Claude (28/10/2026)

Stato: **in produzione** (`openai-proxy` con `AI_PROVIDER=anthropic`). Voce (`gpt-4o-mini-tts`) invariata, su OpenAI.
Prove dal vivo fatte: **Troina mattina** e **Catania mattina**. **Non fatte** (vedi «Cosa manca»): Roma sera, confronto Haiku/Sonnet compito per compito, guardia dal vivo.

## Cosa è cambiato
- Secret `AI_PROVIDER` = `anthropic` | `openai` (assente = openai). Un secret per compito: `ANTHROPIC_MODEL_<COMPITO>` (elenco con virgole: il primo che esiste, un 404 passa al successivo).
- Il proxy traduce la chiamata di OpenAI nel formato Messages e restituisce la forma di OpenAI: client, prompt e schemi invariati. JSON: riga in coda al system + ripulitura (`estraiJson`).
- Ripiego: Claude sbaglia → un nuovo tentativo (non se scade il tempo, non se il credito è finito) → OpenAI `gpt-4o-mini`. Se anche OpenAI fallisce: 502 col messaggio onesto e il codice (credito / troppe richieste / errore), generazione rimborsata. Vale anche per la lista della città.
- Le notifiche mandano `dv.passaggio = 'notifiche'` (client).

## Scoperte dal vivo (errori esatti)
| Quando | Errore esatto | Causa e rimedio |
|---|---|---|
| prima chiamata con `claude-haiku-5-5` | `HTTP 400 invalid_request_error: \`temperature\` is deprecated for this model.` | i modelli 5.x rifiutano `temperature`: non si manda (`rifiutaTemperature`, commit c1f71d5) |
| traduttore del giro di Troina, Haiku 5.5 | `risposta vuota` (poi ripiego su OpenAI) | la famiglia 5 ragiona di suo e il ragionamento si paga dal tetto di uscita: `thinking: between_tools` su tutti i 5.x; se il modello rifiuta il parametro si riprova senza (+1500 token); una risposta vuota ora scrive `stop_reason` e blocchi nei log (commit 5c21481). Dopo la correzione: nessuna risposta vuota nei due giri |
| ripiego su OpenAI | `HTTP 429 credit_balance_exhausted: You have no credits remaining…` | **OpenAI non ha credito**: il ripiego su `gpt-4o-mini` oggi non può salvare nessuna chiamata. È anche la prova dal vivo del messaggio onesto («Il motore si è fermato un attimo. Riprova tra qualche minuto.», codice `OPENAI_CREDIT_EXHAUSTED`). **Da ricaricare** |
| `claude-haiku-5-5` | — | **esiste e risponde** (con le correzioni sopra) |

## Tabella compito → modello → perché (misurato)
Assegnazione decisa da Ivano. Tempi = durata della chiamata al fornitore misurata dal proxy; costi = token × listino (`banco.config.json`, listino da ricontrollare).

| Compito | Modello | Troina (borgo) | Catania | Costo AI per giro | Perché / confronto con prima |
|---|---|---|---|---|---|
| traduttore | `claude-haiku-5-5` | 4,8 s | 2,1 s | Haiku, i due compiti insieme: 0,012 $ (Troina), 0,026 $ (Catania) | veloce ed economico. Prima `gpt-6.1-sol`: 2,7–3,9 s (stesso caso Troina): ora uguale o un poco più lento |
| selettore | `claude-haiku-5-5` | 4,7 s | 9,2 s | (incluso sopra) | prima 2,8–14,8 s: nello stesso intervallo |
| lista città (abitanti + lista) | `claude-sonnet-5-5` | 1,1 s + 6,2 s (8 nomi, 8 verificati) | 0,7 s + 11,1 s (18 proposti, 16 verificati, 2 scartati) | 0,010 $ (Troina) / 0,020 $ (Catania) per la sola lista | **molto più veloce**: prima `gpt-6.1-sol` 21–34 s per la lista di Troina |
| narratore | `claude-sonnet-5-5` | (tempo non isolato) | (tempo non isolato) | ≈ 0,007 $ / 0,014 $ | frasi chiuse: nessuna frase tolta dalle guardie in entrambi i giri (`frasiTolte` vuoto) |
| notifiche | `claude-haiku-5-5` | non provate | non provate | — | assegnate; il client le etichetta, finché non esce il frontend vanno sul contorno (Sonnet) |
| contorno, lista quartiere | `claude-sonnet-5-5` | non provati | non provati | — | assegnati |

## I due giri (stesso codice del motore, giorno simulato 29/10, liste nuove generate da Sonnet)
| Giro | Tempo totale | Costo totale (listino) | di cui AI | di cui Google | Ripieghi | Esito |
|---|---|---|---|---|---|---|
| Troina, mattina, mezza giornata | 27,9 s (prima 15–34 s) | 0,44 $ | 0,029 $ | ≈0,41 $ | 0 | tour valido, 5 tappe (Torre Capitania, Chiesa Madre, pranzo…) |
| Catania, mattina, giornata intera | 37,7 s (soglia del banco 35 s, con la lista nuova da 13 s) | 0,88 $ | 0,060 $ | ≈0,82 $ | 0 | tour valido, 5 momenti dalle 08:30 alle cena |
Il costo dell'AI è meno di un decimo del totale: a decidere il costo di un giro è Google.
Spesa cumulata della sessione: ≈ 1,35 $ (tetto 2 $).

## Cosa manca (onestamente)
1. **Roma sera**: una lista nuova di Roma costa circa 1 $ di Google; il tetto di 2 $ non basta. Non fatto.
2. **Confronto Haiku contro Sonnet per ogni compito** (fatti veri, voce da insider, tempo, costo): **non fatto**. Servono i secret scambiati (narratore su Haiku, traduttore/selettore su Sonnet) e un rigiro degli stessi casi; il permesso a scrivere secret l'ha solo Ivano. Nessun compito è stato promosso o retrocesso: restano le assegnazioni decise.
3. **Guardia dal vivo con Claude**: non fatta (12 flussi ≈ 2,4 $). Vale la guardia in replay (risposte OpenAI registrate): 12/12, nessun ❌ nuovo di pertinenza.
4. Tempo del narratore e confronto con la baseline di OpenAI sul narratore non isolati.

## Prova di 10 minuti per Ivano
1. Apri il sito pubblicato, entra con un account, «Crea il tuo percorso»: «Una mattina a Troina», mezza giornata. Deve uscire un giro con 4–5 tappe in meno di 40 s, senza errori.
2. Ripeti a Catania («Una giornata a Catania»). Deve uscire con orari e frasi complete.
3. Controllo costi: Console Anthropic → Usage, deve comparire `claude-haiku-5-5` e `claude-sonnet-5-5` con qualche migliaio di token.
4. Per tornare a OpenAI (solo dopo aver ricaricato il credito): `supabase secrets set AI_PROVIDER=openai --project-ref ahecpiwsdhghkndncejb`.
5. Per cambiare modello a un compito: `supabase secrets set ANTHROPIC_MODEL_SELETTORE=claude-sonnet-5-5 --project-ref ahecpiwsdhghkndncejb` (nessun deploy).

Tracciati e grezzi dei due giri: `docs/prove/dati/2026-10-28-fornitore-ai-{troina,catania}[-tracciati].json.gz`.

## Addendum — Haiku 4.5 contro Haiku 5.5 sullo stesso caso (Troina, 29/10)
Dopo il report Ivano ha portato traduttore, selettore e notifiche su `claude-haiku-4-5` (secret `ANTHROPIC_MODEL_TRADUTTORE/SELETTORE/NOTIFICHE`, nessun deploy). Rigiro dello stesso caso con liste e ricerche Google già pronte (una sola prova per modello: indicativa, non statistica).

| | Haiku 5.5 | Haiku 4.5 |
|---|---|---|
| traduttore | 4,8 s | 1,5 s |
| selettore | 4,7 s | 2,7 s |
| token di uscita (traduttore + selettore) | 1.062 | 330 |
| costo AI di Haiku nel giro | 0,012 $ | 0,0047 $ |
| query del traduttore | piazza storica, trattoria tipica, belvedere panorama | piazza storica, chiesa, belvedere panorama |
| tappe | ruderi del monastero, piazza Matteotti, Torre Capitania, Chiesa Madre, pranzo da A'Pescheria | via Conte Ruggero, Torre Capitania, Chiesa Madre, **un panificio come tappa**, pranzo da Pizze&Delizie |
| titolo | «Ruderi, torri e piazze di Troina» | «Torri, pane e pizza di Troina» |

Lettura: 4.5 è 2–3 volte più veloce e costa meno di metà; 5.5 sul traduttore/selettore scrive molto di più (circa tre volte i token) ed è più lento. Sulla qualità, in questo caso la scelta di 5.5 è più coerente con «giro insider» (siti storici); quella di 4.5 mette un panificio fra le tappe del mattino. Un solo campione: non basta per promuovere o retrocedere nessun compito. Tempi totali non confrontabili (il primo giro include la lista nuova da 7 s).
Spesa cumulata della sessione ≈ 1,55 $ (listino; la cache Google riduce la spesa vera).
