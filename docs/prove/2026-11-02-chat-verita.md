# CHAT-VERITA — la chat con la guida non inventa (02/11/2026)

Cartella `/Users/mac2023ivanosciretta/unnivai-chat` (verificata con `pwd`), ramo `chat/verita` da `origin/main` (`79ca161`).
**Il deploy di `openai-proxy` è preparato ma non fatto: aspetta il «sì» di Ivano (§ 7).** **Aggiornamento: deploy fatto nella coda del 03/11 (openai-proxy v46), misura dal vero in § 9.** Fino al deploy l'app pubblicata chiama un percorso (`dv.purpose = 'chat'`) che il proxy di oggi non conosce: vedi § 7, punto 1.

## 1. Diagnosi: la chat di oggi

| | Oggi |
|---|---|
| Dove | `AIDrawer` (si apre dal badge del meteo sulla mappa) → `aiRecommendationService.chatWithGuide` |
| Modello | chiamata di contorno senza passaggio → `ANTHROPIC_MODEL_CONTORNO`, cioè **Sonnet 5.5** (`AI_PROVIDER=anthropic`); temperatura 0,7, 350 token |
| Cosa riceve | il system prompt e la conversazione. Contesto: **solo il nome della città** e, se è aperto, il nome del luogo selezionato. **Nessuna tappa del giro, nessuna fonte, nessun controllo dopo.** |
| Il prompt | «fare da guida turistica esperta, ironica e sintetica … **Fai emergere verità storiche nascoste, aneddoti divertenti** o consigli unici» |
| Tempo | mediana 2,9 s sul server, 3,1 s dal telefono; la risposta arriva tutta insieme (niente streaming) |
| Costo | 0,0024 $ a risposta (media sul banco) |

Il prompt chiede proprio quello che non deve fare: senza fonti, il modello riempie con quello che «sa».

**Dieci risposte di oggi** (dal banco, § 4). Le parti in **grassetto** sono fatti che nessuna fonte verificata di quel luogo contiene. Alcuni sono veri nel mondo, altri no.

1. *Chi ha fatto la Fontana dell'Elefante?* — «… opera di Giovan Battista Vaccarini, che la progettò nel 1736 **durante la ricostruzione post-terremoto del 1693**. L'elefante di lava … è molto più antico: **forse romano o bizantino**, e secondo la leggenda **il mago Eliodoro ci viaggiava a cavallo**. Sopra c'è **un obelisco egizio**, e il bello è che **i catanesi giurano che il Liotru protegga la città dall'Etna**. 🐘🌋»
2. *Quando è stata costruita la Cattedrale?* — «nasce **tra il 1078 e il 1093 per volere del conte Ruggero, sopra le rovine di antiche terme romane** … **il terremoto del 1693 la rase quasi al suolo, e fu ricostruita nel Settecento da Vaccarini** … **la facciata è un tripudio di marmo bianco e pietra lavica nera**»
3. *Cosa c'è dentro la Cattedrale?* — «**la tomba di Vincenzo Bellini** … **la Cappella di Sant'Agata con il busto-reliquiario e il "tesoro" che esce solo a febbraio** … **sotto ci sono ancora pezzi di terme romane**»
4. *Il Teatro Massimo Bellini è dedicato a chi?* — «A Vincenzo Bellini, **il genio catanese della "Norma" e dei "Puritani", morto a soli 33 anni a Parigi. Inaugurato nel 1890** … **il sipario, dipinto con l'ingresso trionfale di Bellini nell'Olimpo**»
5. *Cosa era il Monastero dei Benedettini?* — «**uno dei più grandi d'Europa: i monaci … vivevano tra banchetti e lusso** … **Oggi è sede del Dipartimento di Scienze Umanistiche dell'Università e Patrimonio UNESCO**»
6. *Raccontami del Colosseo.* (domanda trappola: un altro luogo) — «il Colosseo è a Roma: un bel salto, **circa 800 km**» (sono 536 km in linea d'aria) «… **l'Anfiteatro Romano di Piazza Stesicoro, costruito con pietra lavica e oggi mezzo sepolto** … **Ci si entra scendendo sotto il livello della strada** … **Vuoi che ti guidi lì? Segui la scia arancione!**» (l'app non ci porta)
7. *L'elefante è di marmo di Carrara?* — «No … **pietra lavica dell'Etna, la stessa nera e porosa che regge mezza Catania. Sopra ci sta un obelisco egizio** … **Sulla sella trovi i simboli di Sant'Agata**»
8. *Sant'Agata è sepolta a Palermo, vero?* — «No, a Catania! **Le reliquie … in un busto-reliquiario d'argento coperto di gioielli … nel 1040 il generale bizantino Giorgio Maniace ne portò via le spoglie a Costantinopoli, e solo nel 1126 …**»
9. *Ho fame, cosa mi consigli?* — «**arancina (rigorosamente al femminile, qui è "arancino" solo per i forestieri…)** … **cartocciu di pesce fritto alla Pescheria** … **il nome nasce dall'opera di Bellini … un cuoco esclamò "È una vera Norma!"**» (alla domanda 22 la stessa chat dice il contrario: «**arancinO, qui è maschile**»)
10. *Mi piacciono le chiese: quale tappa mi godo di più?* — consiglia **la Badia di Sant'Agata**, che non è una tappa del giro, con «**la cupola del Vaccarini … dalla terrazza si vede tutta Catania**»

Oltre ai fatti: emoji, tono da guida («vi», «salite», «guardate»), offerte che l'app non può mantenere.

## 2. La correzione

Un percorso nuovo del proxy, `dv.purpose = 'chat'` (`handleChat` in `index.ts`). Il codice puro sta in `chat.ts` e `chatFonti.ts`, la macchina è quella dei racconti.

1. **Le fonti le prende il server** (il telefono manda solo nomi, coordinate, ora e sosta delle tappe). Sono le stesse dei racconti: Wikipedia per nome e coordinate, allargata come in RACCONTO-FONTI, più la descrizione Google (`fontiDiTappa`).
   - Al più **3 tappe**: prima quelle nominate nella domanda (o nell'ultima risposta, per una domanda di seguito), poi il luogo aperto sulla mappa, la prossima tappa, le altre.
   - Al più **2 luoghi nominati nella domanda** che non sono tappe (`luoghiNominati`): una ricerca su it.wikipedia, valida solo se il titolo è nominato nella domanda, non è una disambigua e ha coordinate **entro 10 km dal giro**. Il Colosseo (536 km), la Cattedrale di Palermo (166 km) e Pisa (796 km) sono scartati: **niente fatti di altre città**.
   - Le fonti di una tappa restano in memoria nell'istanza per un'ora: la domanda dopo non le richiede.
2. **Il prompt** (`SYSTEM_CHAT`) distingue frasi di FATTO (ogni fatto nelle FONTI o nel GIRO) e frasi LIBERE (consigli, ritmo, gusti, inviti).
   - Quando manca la fonte: «Su questo non ho una fonte sicura», detto in modo naturale.
   - Un fatto falso nella domanda non si conferma. Un luogo di un'altra città non si racconta.
   - Le regole di voce sono quelle dei racconti (`REGOLE_VOCE`, tranne «rispondi NIENTE»): mai «benvenuti», niente superlativi, niente «vi», niente direzioni, niente «le fonti dicono».
3. **Il giro** entra nella richiesta come testo composto dal server: tappe in ordine, ora, sosta e, se il telefono lo sa (in navigazione), quale è la prossima. Altrimenti la riga «Dove si trova adesso l'utente nel giro non si sa.».
4. **Il controllo** passa dalla macchina dei racconti (`scriviERivedi`):
   - **Controllo automatico** (`controllaChat`, cioè `controllaRacconto` con le opzioni nuove): date e numeri da 100 in su, cifre romane, nomi propri, parole vietate. I nomi e i numeri della domanda e del giro non fanno cadere la risposta: se una frase conferma un fatto della domanda, la ferma il revisore.
   - **Revisore:** lo stesso dei racconti (`primoRevisore`, Haiku 4.5, `ANTHROPIC_MODEL_REVISORE`). Ha la domanda per la chat: una frase senza fatti è «sì», una frase con un fatto è «sì» solo se il fatto sta nelle FONTI o nel GIRO.
   - **UNA riscrittura** con il motivo.
   - **Se cade anche la riscrittura**, restano solo le frasi che il revisore ha passato più «Sul resto non ho una fonte sicura.»; senza frasi passate, «Su questo non ho una fonte sicura.».
5. **Quota:** una chiamata di contorno, come prima. Niente si salva.

In `racconto.ts` niente di duplicato, solo opzioni con il valore di prima come difetto:
- `controllaRacconto(…, { forma, paroleFatto, numeroMin, ammessi })`;
- `scriviERivedi(…, { verifica, controllo, chiusura })`;
- `limiti` nelle fonti.

I 213 test di racconti e curiosità restano verdi senza modifiche.

**Il telefono** (`src/services/chatGuidaService.js`, `AIDrawer`):
- il benvenuto è «Chiedimi del giro. Sui fatti ti dico solo quello che ha una fonte; se non lo so, te lo dico.» (prima: «Chiedimi curiosità, storie nascoste…»);
- durante l'attesa compare «Controllo le fonti…»;
- sotto la risposta, «Fonti lette:» con i titoli e i link di Wikipedia;
- MapPage passa le tappe (con ora e sosta), il luogo aperto, la prossima tappa (solo in navigazione) e il centro;
- i guasti diventano testi onesti, mai un fatto.

Tolti `chatWithGuide` e `GeminiDrawer.jsx`, che nessuno importava.

## 3. Lo scrittore: Sonnet 5.5, non Haiku 4.5

Sullo stesso banco e sul codice finale ho provato i due scrittori, sempre con il revisore Haiku 4.5:

| | Sonnet 5.5 (scelto) | Haiku 4.5 |
|---|---|---|
| frasi inventate (a mano) | **5 su 88** | 12 su 57 |
| frasi false | 0 | il Monastero scambiato per la chiesa; «hai già fatto tre tappe»; «trentacinque minuti» |
| prima parola, sul server (mediana / p90) | **4,06 s / 8,6 s** | 2,85 s / 5,6 s |
| sotto i 4 s | 14 su 30 | 25 su 30 |
| costo per risposta (media / massimo) | 0,0107 $ / 0,0200 $ | 0,0050 $ / 0,0096 $ |
| riscritte / ridotte / oneste | 4 / 2 / 0 | 5 / 0 / 1 |

Il revisore Haiku lascia passare le invenzioni di Haiku scrittore: «il compositore catanese», «la facciata a colonne ripara bene», «troverai facilmente dove mangiare». Lo scopo del task è la verità, quindi scrive Sonnet: il narratore dei racconti, passaggio `narratore`, catena e ripiego di sempre.

## 4. Il banco: 30 domande, prima e dopo

Giro di Catania, 6 tappe:
1. Fontana dell'Elefante, 9:30;
2. Cattedrale di Sant'Agata, 9:50;
3. Via dei Crociferi, 10:30;
4. Teatro Massimo Bellini, 11:05;
5. Monastero dei Benedettini, 11:40;
6. Teatro romano, 12:35.

La chat è aperta senza navigazione: la guida non sa dove sei.

Le domande sono di tre tipi:
- **10 sui luoghi del giro**;
- **10 trappole**: Michelangelo, «costruita nel 1950», Colosseo, Trevi, «cinquemila posti», Torre di Pisa, «marmo di Carrara», «sepolta a Palermo», «costruita dai Romani», «terremoto del 2000»;
- **10 non fattuali**: fame, stanchezza, «quanto manca», ritmo, chiese preferite, caldo, saltare una tappa, un'ora libera, «sei una persona vera?», musica.

Lo script è `scripts/prova-reale/chat-verita.live.js`:
- importa le stesse funzioni del proxy (`chat.ts`, `chatFonti.ts`, `raccontoFonti.ts`);
- passa per i modelli del proxy pubblicato con l'account di prova, `dv.purpose = 'aux'` e il passaggio che sceglie il modello (come REVISORE-FORTE);
- «prima» è il prompt di `chatWithGuide`, alla lettera.

I grezzi stanno in `docs/prove/dati/`:
- `2026-11-02-chat-verita.json`: giro finale, prima e dopo, con il testo delle fonti di ogni risposta;
- `2026-11-02-chat-verita-primo-giro.json` e `-secondo-giro.json`: i due giri durante il lavoro;
- `2026-11-02-chat-verita-conteggi.json`: i conteggi a mano.

**Frasi inventate, contate a mano** (definizione nel file dei conteggi: un fatto che né le fonti né il giro dicono, anche se vero nel mondo):

| | Prima (oggi) | Dopo (Sonnet 5.5) |
|---|---|---|
| sui luoghi del giro | 33 su 38 | **0 su 30** |
| trappole | 31 su 48 | **4 su 30** |
| non fattuali | 22 su 42 | **1 su 28** |
| **totale** | **86 su 128 (67%)** | **5 su 88 (6%)** |

Le 5 frasi del «dopo»:
- «il Colosseo è a Roma» e «la Fontana di Trevi è a Roma» (13, 14): fatti di un'altra città, detti per rifiutare il confronto;
- «basalto e marmo sono pietre diverse» (17);
- «la chiesa … accanto al monastero» (20);
- «sei a metà mattina» (26).

Nessuna è falsa nel mondo, ma nessuna sta nelle fonti.

**Le trappole, dopo:**
- nessun fatto della domanda è confermato;
- Michelangelo, 1950, cinquemila posti, Carrara, Romani: «No» quando le fonti bastano a dirlo (Vaccarini 1735–1737, basalto, XVIII secolo), altrimenti «non ho una fonte sicura, quindi non te lo confermo»;
- Colosseo, Trevi e Pisa: «oggi sono qui a Catania», poi torna al giro.

**Le domande non fattuali, dopo:**
- restano libere: «Vai piano, il giro è fatto per questo», «Un caffè e poi riparti con calma»;
- usano il giro: «quindici minuti all'Elefante, mezz'ora in Cattedrale e quaranta al Monastero dei Benedettini»;
- «Quanto manca alla prossima tappa?» → «Non so dove sei adesso nel giro … Dimmi a che punto sei e ti dico qual è la prossima».

Le risposte sono intere nel grezzo. Tre esempi, prima → dopo:
- *Chi ha fatto la Fontana dell'Elefante?* → «L'ha realizzata l'architetto Giovanni Battista Vaccarini, tra il 1735 e il 1737. La statua di basalto nero è l'elefante che i catanesi chiamano U'Liotru, e oggi è l'emblema della città.»
- *Cosa era il Monastero dei Benedettini?* → dice che i fatti che ha sono sulla chiesa di San Nicolò l'Arena (la fonte trovata), li dice, poi: «Su cosa fosse il monastero e cosa ci sia oggi oltre la chiesa non ho una fonte sicura.»
- *Il Teatro Bellini ha cinquemila posti, vero?* → «Sui posti non ho una fonte sicura, quindi non ti confermo quel numero. Quello che so è che ha un'orchestra di 105 elementi e un coro di 84 …»

## 5. Tempo alla prima parola e costo

La risposta arriva intera (niente streaming), quindi **prima parola = risposta completa**.

| | mediana | media | p90 | massimo | sotto 4 s |
|---|---|---|---|---|---|
| prima (oggi), sul server | 2,9 s | — | — | — | — |
| **dopo, sul server** (fonti + modelli: quello che fa `handleChat` in una richiesta) | **4,06 s** | 5,44 s | 8,6 s | 23,8 s (domanda 8: due scritture e due revisioni lente) | **14 su 30** |
| dopo, misurato dal Mac della prova | 4,64 s | — | — | — | — |
| dopo, risposte senza riscrittura (24 su 30) | 3,91 s | — | — | — | — |

Come si arriva a quei tempi (mediane):
- fonti 0,52 s (le tappe dalla memoria dalla seconda domanda; la ricerca dei luoghi nominati ogni volta);
- scrittura Sonnet circa 2,0 s;
- revisione Haiku circa 1,3 s;
- una riscrittura aggiunge 3–4 s.

Dal Mac si paga un passaggio di rete in più per ogni chiamata ai modelli; in produzione è uno solo.
- Stima per l'utente: **circa 4,3–4,5 s di mediana**. Si misura dopo il deploy.
- **Obiettivo di 4 s mancato** per metà delle risposte.

**Costo:** **0,0107 $ a risposta** in media (massimo 0,020 $), contro 0,0024 $ di oggi. 1.000 domande al giorno ≈ 10,7 $.

**Proposte per scendere sotto i 4 s** (nessuna fatta senza il tuo sì):
1. **Mostrare subito «Controllo le fonti…»**: fatto. Il tempo non cambia, ma l'attesa ha un perché.
2. **Revisore Sonnet 5.5** (il secret di REVISORE-FORTE) **e scrittore Haiku 4.5**: Haiku scrive in circa 1,2 s, Sonnet controlla meglio (falsi «sì» 4 su 21 contro 12 su 21 in REVISORE-FORTE). Stima 3–3,5 s di mediana. Da misurare sullo stesso banco prima di sceglierlo: oggi Haiku+Haiku inventa 12 frasi.
3. **Mostrare subito le frasi senza fatti** e aggiungere le altre dopo il revisore: richiede che il revisore torni frase per frase in streaming. Il guadagno c'è solo sulle domande non fattuali, e una risposta a pezzi si legge peggio.
4. **Risposte pronte per le domande ricorrenti** su una tappa («chi l'ha fatta», «quando», «di cosa è fatta»), scritte e controllate una volta come i racconti e salvate in `place_racconti`: 0 s e 0 $ dalla seconda volta. Serve una migrazione.
5. **Saltare la ricerca dei luoghi nominati** quando la domanda nomina già una tappa o non ha nomi: circa 0,3–0,5 s in meno.

## 6. Prove fatte

| Prova | Esito |
|---|---|
| `src/__tests__/functions/chat.test.js` | **24/24**: prompt, fonti di più luoghi, giro con e senza prossima, scelta delle tappe, richiesta dal telefono (campi e lunghezze), controllo automatico (date, numeri piccoli, nomi della domanda, voce), le quattro uscite (verificata, riscritta, ridotta, onesta), luoghi di altre città scartati; sul file vero del proxy: domanda sul giro, revisore che dice no, Colosseo, 400/429/502, fonti in memoria |
| `src/__tests__/components/chatGuida.test.jsx` | **4/4**: cosa manda il telefono (ordine del giro, prossima, luogo aperto, centro, niente fonti), guasti in testi onesti, benvenuto, «Controllo le fonti…», fonti lette |
| `src/__tests__/services/quotaServerSide.test.js` | il test della chat aggiornato: la chat non porta biglietto |
| Racconti e curiosità | 213/213 invariati |
| Banco di 30 domande | § 4 e § 5 |
| Suite intera | **253 file, 3159 test, tutti verdi** |
| `npm run lint` · `npm run build` | **0 errori** · ok |
| `npm run banco:guardia` | **12/12**, pertinenza senza ❌ nuovi (3 già noti) |
| `deno check` di `index.ts` | il codice nuovo passa. Resta 1 errore che c'è già su `origin/main` (riga 466, `info.motivo` in `chiamaConRipiego`), non toccato. |

## 7. Il deploy (aspetta il sì di Ivano)

1. **Prima del deploy**: il sito pubblicato ha già la chat nuova, che chiama `dv.purpose = 'chat'`. Il proxy di oggi non lo conosce e lo tratta come una chiamata di contorno senza `endpoint` né `model` → risponde 400 «Model not allowed». La chat mostra «Non riesco a raggiungere la guida. Riprova tra poco.»: nessun fatto inventato, ma nemmeno una risposta. **Il deploy va fatto subito dopo il merge.**
2. Da `~/unnivai-1b` su `main` aggiornato:
   ```bash
   git pull
   supabase functions deploy openai-proxy --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api
   ```
   Nessuna migrazione, nessun secret.
3. Dopo il deploy: il tempo vero alla prima parola dal sito pubblicato (WebKit, account di prova, 10 domande del banco) e una riga nel report.

## 8. Cosa NON risolve

- **Il tempo:** la mediana è circa 4 s sul server, una risposta su due sopra. Proposte in § 5.
- **Le invenzioni piccole:** 5 frasi su 88 escono ancora (geografia di altre città, conoscenza generale, «sei a metà mattina»). Il revisore Haiku le lascia passare. Il revisore Sonnet (decisione di REVISORE-FORTE) ne fermerebbe di più.
- **Fonti sbagliate:** per il Monastero dei Benedettini la ricerca allargata di RACCONTO-FONTI trova la chiesa di San Nicolò l'Arena, o una frase della voce «Catania». Sonnet lo dice, Haiku no. È un limite delle fonti, non della chat.
- **Prudenza in eccesso:** «Su chi sia il compositore a cui è intitolato non ho una fonte sicura» (domanda 7: il nome dice Vincenzo Bellini). Meglio così che un fatto in più.
- **Luoghi nominati nella domanda:** la ricerca usa le parole della domanda. Un luogo vicino con un nome che Wikipedia non associa alla domanda resta senza fonti, e la guida dice di non averle.
- **La posizione:** la chat sa solo la prossima tappa (in navigazione), non dove sei. «Quanto manca» si risponde con il giro, non con i metri.
- **I nomi nell'interfaccia:** il cassetto si chiama ancora «Assistente DoveVai», «AI Guide», «DoveVai AI», con i colori di prima. È lavoro della corsia estetica.
- **La chat si apre solo dal badge del meteo sulla mappa.** Nessun nuovo punto di ingresso (niente funzioni non chieste).
- **Niente streaming:** vedi § 5, proposta 3.

## 9. Deploy e misura dal vero (03/11)

Fatto nella coda notturna, il 02/11 fra le 18:30 e le 20:00 UTC. Grezzi: `docs/prove/dati/2026-11-03-*`. Schermate: `docs/prove/schermate/chat-verita/`.

**Prima del deploy.** Era attiva openai-proxy v44: file uguali a `eda9b67`, né OSPITE-GIRO né CHAT-VERITA. Una POST con `dv.purpose = 'chat'` rispondeva **400 `MODEL_NOT_ALLOWED`**.

**Deploy.**
- Da un worktree staccato su `origin/main`, dopo CI verde, con `supabase functions deploy openai-proxy --project-ref ahecpiwsdhghkndncejb --no-verify-jwt --use-api`.
- **v45** da `bf6983e`, poi **v46** da `85460eb`, dopo le due correzioni qui sotto (PR #16).
- La versione attiva, scaricata, ha 11 file su 11 uguali a main.
- Nessuna migrazione, nessun secret.

**OSPITE-GIRO è pubblicato ma inerte.** Gli accessi anonimi sono spenti:
- `signup` senza email risponde 422 `anonymous_provider_disabled`;
- «Prova un giro, senza account» dice «non disponibile».

Gli utenti registrati passano da `ai_quota_consume` come prima.

**Due correzioni trovate dal vero** (PR #16, `85460eb`):
1. **`prossima: null` diventava 0.** Fuori dalla navigazione la guida diceva «è la tua prossima tappa» senza sapere dove sei: 7 frasi su 20 risposte. Ora null resta null. Test in `chat.test.js`.
2. **Senza giro il telefono mandava `centro: null`.** Così il server non cercava i luoghi nominati nella domanda. Ora manda il centro della mappa.

**Collaudo completo**, dopo v45 e dopo v46: **stessi esiti del 31/10**.
- Punti 1–6, 8–13: ok.
- Punto 5: 10 schede, 9 «passato» e 1 «scartato» in `place_racconti`, come il 31/10.
- Punto 7: ok con l'account. Da ospite cade, ed è atteso finché gli accessi anonimi sono spenti.

**Tempi dal client** (`POST` come `chatGuidaService`, account di prova, giro di Catania, risposta intera). 20 domande del banco su v45: 10 sul giro, 5 trappole, 5 libere.
- **mediana 5,5 s**, p90 10,2 s, massimo 12,2 s, 3 su 20 sotto i 4 s;
- sul server: mediana 4,9 s;
- le 8 domande toccate dalla correzione, su v46: mediana 7,5 s, valori fra 3,7 e 12,7 s.

Le risposte senza riscrittura stanno fra 3,3 e 5,9 s. Le riscritte e le «oneste» (7 su 28) costano 8–13 s.

Più lenta del banco (4,06 s) perché **in produzione il revisore è Sonnet 5.5**: i log dicono `claude-sonnet-5-5+claude-sonnet-5-5`, e il secret `ANTHROPIC_MODEL_REVISORE` esiste dal 02/11 alle 10:33 UTC. La riga P4 di LANCIO va riguardata.

**WebKit iPhone 14 sul sito, mappa senza giro:**
- badge del meteo → chat → *Cosa c'è in piazza del Duomo?*;
- «Controllo le fonti…», poi la risposta (3,8 s, verificata, tutta nella voce di Wikipedia);
- «Fonti lette: Piazza del Duomo (Catania)».

**Costo AI:** 32 richieste alla chat, **0,445 $** (tetto 0,50 $), cioè 0,014 $ a risposta. Collaudi esclusi.

**Aperti, per Ivano:**
- **Con un giro sulla mappa la chat non si apre**: il badge del meteo, unico ingresso, sparisce quando c'è un percorso. Proposta: un tasto «Chiedi alla guida» nella panoramica e in navigazione.
- **Luoghi nominati senza coordinate su it.wikipedia** (Fontana dell'Elefante) restano senza fonte. Proposta: coordinate da Wikidata.
- **Il tempo è sopra i 4 s.**
