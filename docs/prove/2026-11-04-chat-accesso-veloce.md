# CHAT-ACCESSO-VELOCE — la chat durante il giro, e il tempo alla prima parola (04/11/2026)

Coda notturna del 04/11, task T12. Cartella `~/unnivai-notte-t12` (worktree), ramo `notte/chat-accesso-veloce` da `origin/main` (`818ad32`).

## 1. Cosa cambia per Ivano

- **La chat si apre anche con un giro sulla mappa.** C'è il tasto «Chiedi alla guida» in due punti:
  - nella **panoramica** (la card del giro prima di «Avvia»), sulla riga di «Cambia mezzo», a sinistra. Il tasto «Avvia» resta dov'era e il nuovo tasto non lo tocca (WebKit: 120–226 px contro 292–363 px in orizzontale);
  - nella **scheda della tappa** (dall'arrivo, «La scheda», o dalla scheda in basso in navigazione), sopra «Riparti». «Riparti» resta il tasto arancione in fondo.
- **Dalla scheda la chat è aperta su quella tappa.** Il telefono la manda come «luogo aperto» (nome, coordinate, place_id), con la prossima tappa del giro. La chat mostra «Focus: <tappa>». Chiusa la chat, la scheda è ancora lì.
- **In navigazione non c'è nessun tasto nuovo sopra le indicazioni.** La pillola delle svolte e la barra in basso non cambiano. Il badge del meteo resta l'ingresso della mappa senza giro.
- **Il modello che scrive non cambia.** Haiku 4.5 che scrive con Sonnet 5.5 che rivede è più veloce, ma inventa di più (§ 3). Restano Sonnet 5.5 che scrive e Sonnet 5.5 che rivede.
- Nessuna modifica a openai-proxy, nessun deploy di funzioni, nessun secret, nessuna migrazione.

I testi stanno in `src/lib/navMessaggi.js` (`NAV_TESTI.CHIEDI_GUIDA` = «Chiedi alla guida»; etichetta accessibile «Chiedi alla guida di <tappa>»). Finché non si è scritto niente, il benvenuto della chat nomina il luogo aperto (`AIDrawer`).

## 2. Il codice

| File | Cosa |
|---|---|
| `src/pages/MapPage.jsx` | `apriChat(luogo)`, stato `chatLuogo`; tasto nella card della panoramica; `onChiedi` della scheda (la tappa con il suo place_id); la chat riceve `chatLuogo` o il luogo selezionato; chiusa, il luogo si azzera |
| `src/components/Nav/GuidaSchede.jsx` | `SchedaTappa({ onChiedi })`: tasto secondario da 44 px sopra «Riparti»; senza `onChiedi` la scheda è quella di prima |
| `src/components/Map/AIDrawer.jsx` | il benvenuto segue il luogo aperto finché la conversazione è vuota |
| `src/lib/navMessaggi.js` | `CHIEDI_GUIDA`, `CHIEDI_GUIDA_TAPPA` |
| `scripts/prova-reale/chat-verita.live.js` | `REVISORE=traduttore|narratore`; `MODO=sito` (la domanda va al percorso `chat` pubblicato, come il telefono); `GIRO_DA` |
| `scripts/prova-nav/chat-accesso.webkit.mjs` | la prova WebKit di § 4 |

Test nuovi: `src/__tests__/pages/mapPageChatAccesso.test.jsx` (4: tasto nella card e fuori da «Avvia», chat sul giro con `prossima` null, in navigazione nessun tasto sopra le indicazioni, dalla scheda la chat ha la tappa e la prossima) e `src/__tests__/components/chatAccessoVeloce.test.jsx` (4: tasto della scheda, ordine rispetto a «Riparti», benvenuto che segue il luogo, conversazione che non si azzera).

## 3. Tempo alla prima parola: Haiku 4.5 scrive + Sonnet 5.5 rivede, contro l'attuale

Il banco è quello di CHAT-VERITA: 30 domande sul giro di Catania (10 sul giro, 10 trappole, 10 libere), senza navigazione (`prossima` null), con gli stessi place_id del 02/11.
- **Attuale:** il percorso `chat` del proxy pubblicato (v48), con le stesse richieste che manda il telefono (`MODO=sito`). I log del proxy dicono `claude-sonnet-5-5+claude-sonnet-5-5`.
- **Haiku + Sonnet:** le stesse funzioni del proxy (`chat.ts`, `chatFonti.ts`) con i modelli del proxy pubblicato. Scrive il passaggio `traduttore` (`_modello.usato` = `claude-haiku-4-5`), rivede il passaggio `narratore` (`claude-sonnet-5-5`). Il tempo sul server è la somma di fonti e chiamate ai modelli. Dal Mac ogni chiamata fa un passaggio di rete in più, quindi il tempo «dal Mac» è più alto di quello che avrebbe il telefono.
- **Grezzo:** `docs/prove/dati/2026-11-04-chat-accesso-veloce.json`, con testi, tempi e testi delle fonti. **Conteggi a mano:** `docs/prove/dati/2026-11-04-chat-accesso-veloce-conteggi.json`.

| | Attuale: Sonnet scrive, Sonnet rivede | Haiku 4.5 scrive, Sonnet 5.5 rivede |
|---|---|---|
| prima parola dal telefono, mediana | **4,75 s** (misurata) | **≈ 3,7 s** (stima: 3,47 s sul server + 0,24 s di rete, misurati sull'attuale); 3,92 s dal Mac |
| p90 dal telefono | 8,43 s | ≈ 6,8 s (6,58 s sul server) |
| sul server, mediana | 4,49 s | 3,47 s |
| sotto i 4 s | 0 su 30 dal telefono (4 su 30 sul server) | 16 su 30 dal Mac (18 su 30 sul server) |
| risposte riscritte | 7 su 30 (7,7–9,4 s) | 12 su 30, più 1 «onesta» |
| risposte verificate al primo colpo, mediana sul server | 4,33 s | 3,06 s |
| **frasi inventate** | **2 su 87** | **3 su 55** |
| risposte che dicono solo «Su questo non ho una fonte sicura.» | 0 | 4 (domande 3, 5, 20, 26) |
| costo per risposta, media (massimo) | 0,0140 $ (0,0247 $) | 0,0095 $ (0,0151 $) |

La regola per adottare Haiku + Sonnet chiedeva due condizioni: frasi inventate non oltre 1 su 59 e mediana sotto i 4 s.
- **Mediana:** passa, circa 3,7 s.
- **Frasi inventate:** 3 su 55, cioè circa 3 volte la soglia. **Non passa.**
- **Decisione: resta l'attuale.** Non serve nessun secret e nessun deploy.

Le 3 frasi inventate con Haiku + Sonnet:
- domanda 13, «non a Roma»: un fatto di un'altra città;
- domanda 21, «te lo sei guadagnato con il giro finora»: suppone dove sei;
- domanda 28, «la zona intorno a piazza del Duomo … è ricca di chiese e palazzi»: le fonti lo dicono solo di Via dei Crociferi.

C'è anche un peggioramento che il conteggio non vede: **Haiku risponde meno**.
- A «Fa caldo, cosa faccio?» e a «Sei una persona vera?» risponde «Su questo non ho una fonte sicura».
- A «Perché Via dei Crociferi si chiama così?» si ferma lì. Sonnet dice che sull'origine del nome non ha una fonte, poi aggiunge quello che sa della via.

Le 2 frasi inventate dell'attuale sono relazioni che le fonti non dicono:
- domanda 3: gli stili «dentro» la cattedrale;
- domanda 4: gli affreschi «sotto una cupola».

Il 03/11 il conteggio era 1 su 59, su 20 domande; oggi è 2 su 87, su 30 domande, con la stessa definizione.

**Il tempo dell'attuale oggi:** 4,75 s di mediana dal telefono. Il 03/11 era 5,5 s, su 20 domande e in un'altra ora. Le risposte riscritte (7 su 30) stanno tutte fra 7,7 e 9,6 s.

**Proposte per scendere sotto i 4 s senza cambiare scrittore** (nessuna fatta, servono modifiche a openai-proxy):
1. **Dire allo scrittore quale scheda è aperta.** Oggi `aperto` sceglie solo le fonti: il prompt non lo nomina. Così «Chi l'ha fatta?» dalla scheda della Fontana risponde «Parli della Via dei Crociferi?», se l'ultima risposta nominava la via (§ 4). Evita domande di ritorno e riscritture.
2. **Saltare la ricerca dei luoghi nominati sulle domande libere.** Nei log cerca «Paolo il caldo (film)» per «Fa caldo» e «Vera Farmiga» per «persona vera». Sono circa 0,3–0,5 s di fonti.
3. **Risposte pronte per le domande ricorrenti su una tappa**, come i racconti: serve una migrazione.

## 4. Prova WebKit con un giro attivo

`scripts/prova-nav/chat-accesso.webkit.mjs`: iPhone 14, account di prova, giro di Catania del banco, GPS finto a 220 m dalla tappa 1.
- Porta e titolo sono verificati prima delle credenziali: porta 5291 libera, `lsof` con cwd = `~/unnivai-notte-t12`, titolo «Unnivai | Esplora l'Italia Autentica».

**Prima del merge, in locale** (`docs/prove/dati/2026-11-04-chat-accesso-locale.json`; sul localhost Google Maps mostra il suo avviso di chiave, la pagina funziona):

| Passo | Esito |
|---|---|
| panoramica: «Chiedi alla guida» | c'è, 106×44 px; non tocca «Avvia» |
| chat dalla panoramica, «Sono stanco, conviene fare una pausa?» | «Controllo le fonti…», risposta verificata in 4,9 s a schermo; `aperto` null, `prossima` null, 6 tappe |
| «Avvia» → navigazione | nessun «Chiedi alla guida» a schermo (0) |
| «Apri la scheda: Fontana dell'Elefante» → «Chiedi alla guida» | c'è, sopra «Riparti · 1 min alla Cattedrale di Sant'Agata», senza toccarlo |
| chat dalla scheda, «Chi l'ha fatta?» | «Focus: Fontana dell'Elefante»; `aperto` = Fontana dell'Elefante (place_id vero), `prossima` 0; risposta verificata in 5,3 s a schermo; «Fonti lette:» |
| chiusa la chat | la scheda è ancora aperta |

La risposta a «Chi l'ha fatta?» chiede «Parli della Via dei Crociferi?», perché la risposta di prima nominava la via. Poi dà Vaccarini, 1735–1737, per la Fontana. È onesta, ma non sa quale scheda è aperta: proposta 1 di § 3.

**Dopo il deploy, sul sito pubblicato:** § 6.

## 5. Prove fatte

| Prova | Esito |
|---|---|
| test nuovi | 8/8 |
| suite intera (`npm run test:run`) | **266 file, 3280 test, tutti verdi** |
| `npm run lint` · `npm run build` | **0 errori** (186 avvisi, già noti) · ok |
| `npm run banco:guardia` | **12/12**; pertinenza: nessun ❌ nuovo (3 già noti) |
| banco della chat | § 3 |
| WebKit | § 4 (in locale) e § 6 (sito pubblicato, 2 giri su 2 con esito sì) |

## 6. Dal sito pubblicato

Merge `7795ea8` (PR #28): CI di main verde (run 41615015876), Vercel di produzione **READY** alle 09:59 UTC del 03/11 (deployment 7515639082). Nessun deploy di openai-proxy: il percorso `chat` è quello di § 3 (`chat c1`, Sonnet 5.5 scrive e Sonnet 5.5 rivede).

La stessa prova di § 4 su https://unnivai.vercel.app, fatta due volte da WebKit sul Mac (profilo iPhone 14, account di prova). Cartella `~/unnivai-notte-t12-sito`, ramo `notte/chat-accesso-veloce-sito`. Titolo verificato prima delle credenziali: «Unnivai | Esplora l'Italia Autentica».
- Grezzo: `docs/prove/dati/2026-11-04-chat-accesso-sito.json` (giro 1) e `docs/prove/dati/2026-11-04-chat-accesso-sito-2.json` (giro 2).
- Schermate del giro 1: `docs/prove/schermate/chat-accesso/`.

| Passo | Giro 1 (10:30 UTC) | Giro 2 (10:31 UTC) |
|---|---|---|
| panoramica: «Chiedi alla guida» | c'è, 106×44 px; «Avvia» a 292–363 px, non lo tocca | uguale |
| chat dalla panoramica, «Sono stanco, conviene fare una pausa?» | «Controllo le fonti…», risposta **riscritta**; `aperto` null, `prossima` null, 6 tappe | «Controllo le fonti…», risposta verificata; stessi dati |
| «Avvia» → navigazione | nessun «Chiedi alla guida» a schermo (0) | 0 |
| «Apri la scheda: Fontana dell'Elefante» → «Chiedi alla guida» | c'è, 358×44 px, sopra «Riparti» (y 556 contro 608), non lo tocca | uguale |
| chat dalla scheda, «Chi l'ha fatta?» | «Focus: Fontana dell'Elefante»; `aperto` = Fontana dell'Elefante (`ChIJV63v_C7jExMRLThjTCcPppk`), `prossima` 0; verificata; «Fonti lette:» | uguale |
| chiusa la chat | la scheda è ancora aperta | uguale |
| esito della prova (`ok`) | **sì** | **sì** |

**Tempo alla prima parola.** La chat non scrive a pezzi: la risposta compare intera. La prima parola è quindi il momento in cui sparisce «Controllo le fonti…».

| Domanda | A schermo | Risposta di rete | Sul server (log del proxy) | Esito |
|---|---|---|---|---|
| giro 1, panoramica | 8,40 s | 8,29 s | 7,98 s (fonti 0,46 s) | riscritta |
| giro 1, scheda | 4,33 s | 4,16 s | 3,92 s (fonti 0,42 s) | verificata |
| giro 2, panoramica | 5,87 s | 5,42 s | 4,54 s (fonti 0,71 s) | verificata |
| giro 2, scheda | 7,37 s | 7,09 s | 6,66 s (fonti 2,76 s) | verificata |

- **Mediana a schermo: 6,62 s su 4 domande** (minimo 4,33 s, massimo 8,40 s). Dal Mac, con WebKit e non da un telefono vero; 4 domande non bastano per una mediana stabile. Il numero di riferimento resta quello del banco di § 3 (4,75 s dal telefono su 30 domande).
- Sotto i 4 s: 0 su 4.
- Le due risposte più lente hanno un motivo leggibile nei log: una è stata **riscritta** (8,4 s, come le riscritte di § 3, fra 7,7 e 9,6 s); nell'altra **le fonti hanno preso 2,76 s** invece dei soliti 0,4–0,7 s.
- Fra lo schermo e la risposta di rete ci sono 0,1–0,5 s. Il telefono non perde tempo a mostrare la risposta.

**Cosa dice la chat dalla scheda.** In tutti e due i giri: «Se parli della Fontana dell'Elefante, l'ha realizzata l'architetto Giovanni Battista Vaccarini, tra il 1735 e il 1737…», poi «Se invece intendevi un'altra tappa, dimmi quale.» Rispetto alla prova in locale non chiede più «Parli della Via dei Crociferi?», ma va ancora a tentoni: lo scrittore non sa quale scheda è aperta (proposta 1 di § 3, resta aperta).

**Nessun difetto nuovo sul sito pubblicato.** I tasti, le posizioni, il luogo aperto mandato al proxy e la scheda dopo la chat sono come in locale.

## 7. Costo AI

| Voce | $ |
|---|---|
| attuale, 30 domande sul percorso `chat` pubblicato (somma dai log del proxy) | 0,4213 |
| Haiku + Sonnet, 30 domande | 0,2837 |
| prove di una domanda per controllare lo script | 0,0163 |
| WebKit in locale, 2 domande | ≈ 0,03 |
| **Totale prima del merge** | **≈ 0,75** |
| WebKit sul sito pubblicato, 2 giri da 2 domande (somma dai log del proxy: 0,02422 + 0,01126 + 0,01142 + 0,01156) | 0,0585 |
| **Totale del task** | **≈ 0,81** |

## 8. Cosa NON risolve

- **Il tempo resta sopra i 4 s:** 4,75 s di mediana dal telefono. Haiku + Sonnet ci arriva, ma inventa 3 volte la soglia e risponde meno. Proposte in § 3.
- **Lo scrittore non sa quale scheda è aperta:** il luogo aperto sceglie solo le fonti (proposta 1).
- **La conversazione resta fra un'apertura e l'altra.** Aperta dalla scheda dopo una domanda fatta dalla panoramica, la chat ha la conversazione di prima e «Focus: <tappa>», ma il benvenuto non cambia. È voluto: non si perde quello che hai chiesto.
- **I nomi e i colori del cassetto della chat** («Assistente Unnivai», «AI Guide», viola) restano quelli di prima: è lavoro della corsia estetica.
- **Le 2 invenzioni piccole dell'attuale** (relazioni «dentro», «sotto») passano il revisore Sonnet.

## 9. Passi che aspettano Ivano

Nessun comando. Una decisione: se fare la proposta 1 di § 3, cioè dire allo scrittore quale scheda è aperta. È una modifica di openai-proxy, quindi serve un deploy.
