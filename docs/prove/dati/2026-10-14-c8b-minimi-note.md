
## Cosa è stato girato e cosa no

- **Girati 13 casi su 38** (4 giri, 2,547 $ in tutto, tetto 3 $, soglia di arresto 2,7 $): i 2 casi colazione nuovi; i 3 serali Veloce (21:25 / 21:45 / 23:30, tutti da rifare sul codice finale come richiesto); Per Te 10:00, 13:00, 19:00, 20:00, 8:30; i 4 diurni più colpiti dai minimi (Veloce Palermo 14:30, Veloce Roma 17:00, Crea Bologna 15:00, Sorprendimi Catania 15:30).
- **Non girati: 25 casi** (elencati sopra). Per girarli tutti servono ≈ 4,3 $ in più (0,17 $ a caso): la regressione diurna C7→C8b è quindi **parziale** (6 casi diurni confrontabili su 27). Serve un'autorizzazione di spesa per completarla.
- perte-catania-1300 e perte-napoli-2000 sono stati girati due volte (giro b sul codice di prima della ricerca dei dolci, giro c sul codice finale): nel report vale il giro c; la spesa dei due giri è sommata.
- Il rosso sul codice vecchio (`0384a96`) è dimostrato con le sole prove di motore, in un worktree: 12 test su 13 falliscono (quello a 6 ore passa anche prima: il Veloce Lungo dava già 4 tappe). Il test «Per Te 8:30» fallisce lì per un import mancante della mia copia ridotta, non per la regola: la sua prova vera è sul giro dal vivo (perte-catania-0830).

## Residui, con il testo che l'utente vede

Le classi c1–c13 sono a 0 sui 13 casi. Restano comportamenti che le classi non misurano:

1. **perte-napoli-2000 — niente cena.** Il giro è «MMB Music Melody Bar (60') → Belvedere di Pizzofalcone (30')», 2 tappe, il minimo di 2 è rispettato e una sera con drink + passeggiata è completa. La cena facoltativa non c'è: il motore dice «nessun candidato valido (all'aperto, entro il tetto di cammino e sulla strada)» (6 ristoranti nel pool, nessuno raggiungibile dalla passeggiata). L'utente non vede nessun testo che lo dica. È il comportamento di C8a (tetto di cammino), che qui non si tocca.
2. **crea-catania-colazione-0800 — la colazione chiesta non arriva.** Con «Una giornata a Catania con colazione» la mattina è `esplicito` (ammette bar e cibo) ma la scelta cade su un mercato (Market Fera O'Luni) e su un palazzo, non su un caffè; la giornata comincia alle 9:30 (la tabella dei momenti non ha una colazione prima). Nessuna violazione di c3 (non c'è nessun locale la mattina), ma la richiesta non è soddisfatta. È la regola C7 «esplicito», che ammette il locale e non lo impone: da decidere.
3. **perte-catania-1300 — il tour cibo a pranzo comincia col gelato.** «Gelateria e Pasticceria Blu Notte → Trattoria Giglio Rosso → Gelateria Pellegrino»: il dolce prima del pranzo è l'ordine del completamento «il più vicino alla tappa prima». E la prima tappa ha la frase di riserva «Gelateria e Pasticceria Blu Notte è la prossima tappa del tuo giro.» (0 fatti): è il rosso «Verità» di questo caso. Prima il tour era di tre trattorie (e c1 lo segnava).
4. **Voce «Giornata» rossa per perte-napoli-2000 e perte-catania-1900:** di sera Per Te è un itinerario di 2–3 tappe e la voce chiede una giornata (≥ 4 tappe). È voluto (giro da 2 ore), non un difetto; la voce non è stata toccata.
5. **crea-bologna-pomeriggio — 121 minuti di tempo libero dichiarato** («Tempo libero: per il pomeriggio non c'è niente che valga il cammino. Il resto lo scegli tu.») fra il bar aggiunto per il minimo e l'aperitivo delle 18:00. Il minimo di 3 è raggiunto (da 2) e il buco è dichiarato (c11 a 0), ma è un buco lungo.

## Peggioramenti nei casi diurni girati

Nessuno vero. L'unica riga rossa automatica era veloce-palermo-relax (km 0→0,69): la tappa unica di prima (0 km) è diventata due tappe (il minimo), quindi più km non è un peggioramento; il generatore ora lo esclude quando le tappe aumentano. Costo: invariato o +1,8 % a generazione sugli 11 casi confrontabili; +0,036 $ solo dove c'è la ricerca dei dolci a pranzo (perte-catania-1300).

## Cosa ho dato per vero senza verificarlo

- Che il «prima» di ogni caso sia comparabile: viene da giri diversi (C7 del 13/10 per il giorno, C8a per la sera, continuità per Per Te) con un solo campione per caso e un pool di Google che cambia da una chiamata all'altra. Differenze di una tappa sono dentro il rumore.
- Che 4 casi diurni su 27 (Palermo, Roma, Bologna, Catania) più 2 Per Te rappresentino la regressione: non è dimostrato, è il campione che il tetto ha permesso.
- Che «aperto per tutta la sosta» valga anche per Per Te di mattina: l'ho ricavato dagli orari settimanali che la ricerca nuova porta, senza gli orari del giorno (festivi, ferie) per le colazioni di Per Te.
- Che le fasce 12:00–14:45 e 19:30–23:00 (config del banco) siano quelle giuste anche per Per Te, e che 3 ore sia la distanza giusta fra due pasti: le ho prese da Crea.
- Che il «giro della sera» di Per Te dalle 18:00 sia ciò che Ivano vuole per le 18:00–19:30 (prima della fascia cena): un'ora di scelta mia (`isSeraStart`, la stessa soglia del Veloce di C8a).
- Che ritmo «rilassato» e durata Veloce siano i valori giusti per il Per Te serale: la Home non li chiede, li ho fissati io.
- Che l'ordine gelato → trattoria → gelato del tour cibo a pranzo sia accettabile: non l'ho corretto.
- Che il deploy funzioni: **deploy da verificare da Ivano**. Non ho aperto il browser né provato Per Te su iPhone; i test e il banco girano sul motore, non sulle pagine.
- Che le quote e i prezzi del config (`prezziUsd`) siano quelli veri: la spesa è calcolata dal banco, non dalla fattura di Google/OpenAI.
