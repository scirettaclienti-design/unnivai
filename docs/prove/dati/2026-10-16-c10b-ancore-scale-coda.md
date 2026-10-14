## Spesa

| Voce | Al listino |
|---|---|
| Primo giro (prompt `c10b-1`), fermato a Roma: 4 tour di Catania con la lista nuova (grezzo `…-c10-2.json`) | 1,179 $ |
| Lista di Roma (`c10b-1`, 15 nomi verificati) e tour di Roma interrotto: non registrati dal runner (fermato a metà caso), stimati | ≈ 0,65 $ |
| 6 sonde del prompt (solo AI, nessuna verifica Google) | ≈ 0,07 $ |
| Giro finale (prompt `c10b-2`): 6 liste + 13 tour (grezzo `…-c10-3.json`) | 5,126 $ |
| **Totale del task** | **≈ 7,03 $** (tetto approvato 7,5 $) |

Il tetto iniziale era 4,5 $, con lo stop a 4 $. Prima del giro ho chiesto e ottenuto 6 $: la stima del giro completo era 5,4–5,6 $. Dopo il giro fermato ho chiesto e ottenuto 7,5 $. Il giro fermato è spesa persa: l'ho fermato appena la lista di Roma è uscita «città», perché i casi di Roma non avrebbero provato niente. Il costo è al listino del banco (token + Google, foto escluse). 52 chiamate Google della lista sono state servite dalla cache del proxy e contate come pagate.

## Perché le voci rosse restano rosse

- **Trastevere, conosce la città.** Il motore sceglie il quartiere giusto, ma nella lista Trastevere ha solo tre locali. Il prompt chiede «almeno un essenziale per quartiere», e l'AI non l'ha fatto per Trastevere. Senza essenziali non ci sono ancore da tenere.
- **Troina, conosce la città.** 1 verificato su 8. La verifica è quella di C10 (nomi compatibili) più il comune. I nomi che l'AI dà a un borgo sono generici o diversi da quelli di Google: è la proposta 6 del report C10, non toccata qui.
- **Lecce, conosce la città.** 3 essenziali nel tour (Santa Croce, Teatro Romano, Carlo V), ma 3 visite su 7 dalla lista (43%). Le altre sono posti delle ricerche: Piazza Sant'Oronzo, le chiese del barocco.
- **Giornata piena (tutti).** Il tempo libero resta. Nelle metropoli cresce, perché il quartiere riduce il pool e il tetto di cammino resta quello di sempre.
- **c11 a Palermo.** 45 minuti senza riga prima del pranzo: la soglia è «oltre 45», e qui il vuoto è esattamente 45. Il controllo non l'ho cambiato.

## Proposte (non scritte)

1. **Il quartiere di una metropoli deve avere almeno un essenziale verificato per essere scelto.** Se il quartiere nominato ne è senza (Trastevere), una seconda chiamata, solo per quel quartiere, chiede 3 essenziali. Costa ≈ 0,1 $ di verifica.
2. **Il centro del quartiere dai suoi essenziali, non dalla media di tutti i posti** (oggi Trastevere cade sul fiume).
3. **Metropoli e giornata piena:** cerchio da 2 km invece di 1,5, oppure due quartieri vicini espliciti (mattina e pomeriggio). Tocca la regola del quartiere, non C5c: da decidere.
4. **Borgo:** accettare il nome di Google quando proposto e trovato condividono il tipo e stanno nel comune («Cattedrale di Troina» → «Chiesa Madre»). È la proposta 6 di C10: oggi a Troina passa 1 nome su 8.
5. **Il simbolo segnato «dedotto»** (Napoli, Roma) andrebbe chiesto di nuovo all'AI invece di dedurlo, se la si vuole sempre esplicita.

## Decisioni per Ivano

1. **Soglie della scala** (mie, dichiarate): borgo sotto 30.000 abitanti, metropoli da 800.000, conferma col diametro di 2 km. Palermo (≈ 670.000) resta città, ed è giusto per i dati: 1,1 km fra gli essenziali.
2. **La scala la propone l'AI con un numero (gli abitanti), la regola è nel codice.** Con la scala chiesta a parole l'AI diceva «città» per tutti.
3. Le proposte 1–4.
4. **La spesa del task è arrivata a ≈ 7,0 $** (approvati 7,5).

## Cosa ho dato per vero senza verificarlo

1. **Gli abitanti dell'AI.** Roma 2.873.000, Napoli ≈ 960.000, Palermo ≈ 670.000, Catania ≈ 311.000, Lecce 95.000, Troina 6.000 (sonda e lista). Li ho presi così: un errore di un ordine di grandezza sposta la scala proposta. Il diametro poi la corregge solo fra città e metropoli o borgo, non il contrario.
2. **Il nome del quartiere** («Trastevere» nella richiesta = «Trastevere» nella lista). Il confronto è a parola intera, senza accenti né maiuscole. Un quartiere scritto diversamente dall'AI («Rione Trastevere») non verrebbe riconosciuto. Non provato.
3. **Il comune dall'indirizzo di Google.** Un posto è «nel comune» se il nome del comune sta nell'indirizzo. Per un comune che si chiama come una frazione di un altro, il controllo può sbagliare. Non provato.
4. **La provincia dal centro.** La sigla viene dall'indirizzo del centro trovato da `findplacefromtext` («94018 Troina EN»). Per Roma l'indirizzo non ha il CAP: provincia `null`, ma per una metropoli non serve.
5. **Un campione per tour.** L'AI, il selettore e Google cambiano da una chiamata all'altra: ogni numero viene da una generazione. In particolare la lista di Roma è cambiata fra la sonda (Trastevere con 3–4 posti, un simbolo) e il giro (Trastevere con 3 locali, nessun essenziale).
6. **«Due quartieri vicini».** Non c'è una regola esplicita per il quartiere del pomeriggio: il cerchio da 1,5 km (fino a 2,5) e il tetto di cammino fanno da limite. È la mia lettura della richiesta.
7. **La spesa del giro fermato** (≈ 0,65 $ per lista e tour di Roma) è stimata: il runner è stato fermato a metà caso e non l'ha registrata.
8. **Il deploy del client.** Il codice del client esce col prossimo deploy di Vercel; `openai-proxy` v18 è già in produzione. **Deploy da verificare da Ivano.**
9. **Il tempo** (33–43 s per il primo tour di una città, 23–37 s per gli altri) l'ho confrontato coi 21,2 s del giro di Ivano in C9, come in C10, non con una misura nuova del codice di prima.
