
## Esito in una riga

**c5 da 48 violazioni in 16 casi a 0 su tutti e 30 i casi, in tutte e 4 le modalità**, con c4 a 6→6, percorso (C5c) 4→2, ripetizioni 1→0, verità 1→1, costo per generazione $0,142→$0,142 (+0 %), nessuna chiamata o ricerca in più.

## Cosa è stato fatto

**Dati.** Il candidato porta `openingPeriods` e `utcOffsetMinutes` (MIG-PLACES). Il fuso è quello di Roma alla data vera del tour: l'offset che Google manda è quello di *oggi* e sbaglierebbe un tour dopo il cambio dell'ora; un fuso non italiano si prende com'è. Senza orari (ricerca vecchia, posto senza orari) lo stato è **sconosciuto**: mai un errore, mai un posto tolto.

**Regola** (`src/lib/openingHours.js`). Una tappa vale solo se è aperta per **tutta la sosta** (arrivo → arrivo + durata di `tourTiming`), nel giorno vero del tour. Gli intervalli di Google si uniscono (12–15 e 15–23 = 12–23), si gestiscono chiusure dopo la mezzanotte e il giro della domenica.

**Dove entra** (nessuna regola esistente toccata: varietà, percorso, tetto di cammino, soglie, quote, prompt):
1. **Momenti (Crea, Veloce con scheletro, Sorprendimi con scheletro):** i posti chiusi *non entrano nel bucket* del loro momento (`applyOpeningToBuckets`). Per il modello come per il codice, varietà, percorso, tetto di cammino, ricerche mirate e tempo libero scelgono quindi solo fra posti aperti, con le stesse regole di prima. L'orario d'arrivo vero dipende dal giro (fine della tappa prima + cammino): dopo lo scheduling si controllano gli orari veri e ogni posto chiuso si **vieta per quel momento** e si sceglie di nuovo (`settleOpeningHours`, fino a 4 giri; ultima rete: una tappa ancora chiusa non esce mai).
2. **Senza scheletro (Veloce serale, Sorprendimi tardi) e Per Te:** `keepOpenStops` mette le tappe in orario dalla partenza, toglie quelle chiuse quando ci si arriva e le sostituisce col candidato più vicino che sia aperto (Per Te: dal pool del suo tema, escludendo i posti di altri tour).
3. **Un filtro non lascia mai un buco:** un momento rimasto senza posti aperti ha la sua riga dichiarata — non pasto: *tempo libero* (regola O, frase già approvata); pranzo/cena: «Nessun locale aperto qui vicino a quest'ora.»; un giro senza scheletro accorciato dalle chiusure: la riga di tempo libero in coda. Per Te: un tour con meno di 3 tappe aperte non viene servito (regola esistente); se non resta nessun tour, il messaggio.
4. **Orario sconosciuto:** ammesso e *segnato nel tracciato* (`_tracciato.orario` / `_orario`: «noto» o «sconosciuto»), contato dal banco. A colazione (i locali del momento mattina) e dopo le 21 (qualunque posto) un orario sconosciuto **perde** contro un'alternativa aperta con orario noto.
5. **Notte:** se le chiusure portano le tappe aperte sotto 2 **e** sotto quelle che il giro avrebbe avuto senza il filtro, al posto del giro compare un messaggio **approvato da Ivano (decisione M)** per fascia oraria di partenza: prima delle 12 «È presto: qui quasi tutto apre più tardi.»; dalle 18 in poi «A quest’ora qui è quasi tutto chiuso. Il giro giusto parte domattina.»; nelle altre ore «A quest’ora qui è quasi tutto chiuso.». Mostrato da Percorso Veloce, Crea, Sorprendimi e dallo stato vuoto di Per Te.

**Interpretazioni mie (da confermare):**
- *«Pasti → il locale aperto più vicino entro il tetto, altrimenti riga dichiarata»*: le regole esistenti scelgono fra i locali **aperti** (tetto di cammino con ripiego sul più vicino, come oggi); la riga «Nessun locale aperto…» compare solo se nel momento non c'è nessun locale aperto. Non ho introdotto un secondo tetto di cammino per i pasti.
- *«Meno di 2 tappe aperte → messaggio»*: letto come «le chiusure le hanno portate sotto 2». Un giro che per costruzione ha una tappa sola (la cena del Veloce alle 21:25) e ce l'ha aperta **resta un giro**: la prima versione del messaggio scattava anche lì (4 casi: Napoli 19:30, Catania 21:25, Siracusa 8:15, Milano 20:30), era un mio difetto, trovato leggendo il giro completo; corretto con test rosso→verde e 4 casi rigirati.

## Difetto trovato e testo del messaggio

- Il primo testo provvisorio («Meglio domattina…») non reggeva alle 8 del mattino (il caso Siracusa 8:15 lo mostrava): Ivano l'ha sostituito con i tre testi per fascia oraria, ora nel codice (`messaggioChiuso`, ora di Roma di partenza). Nei 30 casi reali, dopo la correzione, **il messaggio notturno non è scattato mai**: è provato dai test (flusso a momenti, senza scheletro, schermata di Percorso Veloce) e non da un caso dal vivo. Nei due notturni veri (21:45 e 23:30 a Catania) il pool conteneva centri benessere aperti fino a tardi: il giro è passato da 5 a 3 tappe (2 aperte + riga di tempo libero).
- La riga dei pasti «Nessun locale aperto qui vicino a quest’ora.» è **approvata**. Approvata anche la lettura sui pasti (le regole esistenti scelgono fra i locali aperti; la riga solo se non ce n'è nessuno).

## Prove (rosso → verde)

- Un posto che apre alle 18 proposto alle 9:30 è sostituito · una trattoria che apre alle 19 non va a pranzo alle 12:30 (alla cena sì) · una sosta che sfora la chiusura è sostituita (anche quando l'arrivo vero è più tardi dell'inizio del momento: il controllo sugli orari veri) · un museo chiuso il mercoledì non entra il mercoledì (il giovedì sì) · a colazione e dopo le 21 un posto senza orario perde contro uno aperto noto · Per Te, Veloce e Sorprendimi non propongono posti chiusi · nessun momento resta vuoto senza una riga dichiarata · lo stesso giro con un solo posto per costruzione resta un giro. File: `openingHours.test.js`, `orariMomenti.test.js`, `openStops.test.js`, `orariMotore.test.js` (motore intero), `orariMessaggioQuickPath.test.js`. Con il filtro spento 6 test su 11 dei momenti diventano rossi (mutazione).
- **Ricerca vecchia = comportamento di oggi:** stesso test sul codice di prima e sul nuovo, 10 generazioni (flusso a momenti e senza scheletro, 5 orari × `custom`/`quick`, candidati senza orari): **53 189 byte identici** (`cmp`), tolti solo i marcatori nuovi (`_orario`, `_tracciato.orario`, `_orari`, `_momentReport.orari`).
- Suite: 1531 → **1575** verdi.

## Cosa ho letto dal giro

- Il motore ha tolto **200 posti/tappe chiusi** (39 in un solo caso, Catania «nei ristoranti tipici»), ne ha **vietati 4 dopo il controllo sugli orari veri** (Milano sera: l'arrivo vero era più tardi dell'inizio del momento) e fatto **23 sostituzioni** nelle liste senza scheletro e in Per Te.
- **Orario sconosciuto: 17 tappe su 135** (12,6 %): piazze, palazzi visti da fuori, belvedere, parchi, una trattoria e un museo senza orari su Google. Prima della regola il banco ne contava 13 sulle stesse 135.
- **Per Te serale perde tour:** Napoli alle 20:00 passa da 5 tour (15 tappe) a 1 tour (3 tappe): musei e chiese sono chiusi. È la regola che fa il suo lavoro, ma è un cambio di prodotto da sapere.
- **Giornata** (≥4 tappe): +2 casi rossi (Veloce 21:45 e 23:30, 5→3 tappe): le 5 tappe di prima erano in gran parte chiuse.
- **Non toccato, ancora presente:** trattorie al mattino/pomeriggio quando il testo dice «nei ristoranti tipici» (c2/c3), meteo `sunny`, «1 minuti» (c7).

## Spesa

Giro mirato di 6 casi $0,774 + giro completo $4,255 + rigiro dei 4 casi $0,526 = **$5,555** su un tetto di $6. Nessuna chiamata a `place/details`: gli orari arrivano con la ricerca.

## Cosa ho dato per vero senza verificarlo

1. **Gli orari sono quelli settimanali di Google** (`regularOpeningHours`): chiusure straordinarie, festività e ferie **non** si vedono. `currentOpeningHours` le vedrebbe ma è nella stessa fascia di prezzo e non è nella maschera: non l'ho aggiunto, un posto aperto «di norma» può essere chiuso quel giorno. Il banco applica gli stessi dati: un c5 a 0 qui vuol dire «coerente con gli orari settimanali», non «aperto davvero quel mercoledì».
2. **c5 è misurato con gli stessi orari che usa il motore** (quelli arrivati con la ricerca) ma con codice indipendente (campionamento ogni 5 minuti, non gli intervalli uniti del motore). Un errore nei dati di Google non lo vedrebbe nessuno dei due.
3. **L'arrivo di un posto dipende dal giro:** il primo filtro usa l'inizio del momento, il controllo sugli orari veri corregge; con 2 tappe per momento o attese lunghe servono fino a 4 giri. Se dopo 4 giri restasse una tappa chiusa verrebbe tolta (non è mai successo nei 30 casi: `residui: 0`).
4. **Per Te** stima l'arrivo da «adesso» + soste + cammino dichiarati; le tappe non hanno un orario vero. Il filtro prende dal pool del *tema*, quindi può restare corto.
5. **Un campione per caso**, un solo giro con la regola più il rigiro di 4 casi; la varianza (±2 casi rossi per voce) è una scelta mia. Il rigiro dei 4 casi è fatto con lo stesso codice del giro completo meno la correzione: i 26 casi non rigirati non possono essere cambiati da quella correzione (la condizione modificata riguarda solo il messaggio), ma non li ho rigenerati.
6. **L'orario sconosciuto a colazione:** vale per i «locali» del momento mattina (cibo/bar) e solo se esiste un'alternativa aperta *nello stesso bucket*; non ho una misura di quante volte ha deciso.
7. **Il fuso del posto:** Italia = ora di Roma alla data vera; un `utcOffsetMinutes` fuori da +60/+120 si prende com'è (non provato dal vivo).
8. **Il banco `new`** usa l'account di prova e il parametro `engine=new`; l'app vera, con `PLACES_SEARCH` non impostato, continua a usare la ricerca vecchia (nessun orario) finché non decidi il passaggio.

## Passaggio per tutti (fatto, con l'OK di Ivano)

Nell'ordine concordato:
1. **`PLACES_SEARCH=new`** impostato sul proxy `places-proxy` (progetto UNNIVAI `ahecpiwsdhghkndncejb`, `supabase secrets set`). Rollback: `supabase secrets set PLACES_SEARCH=legacy --project-ref ahecpiwsdhghkndncejb` (nessun deploy).
2. **App con le nuove chiavi di cache del browser** (commit `ea99614`, CI verde: «Lint & Test» e «E2E Smoke»): `gg1_` → `gg2_` per i pool dei posti, `unnivai_insiderf11_composto_` → `unnivai_insiderf12_orari_` per itinerari e tour Per Te cached; testi approvati nel codice. Suite 1581 verdi, lint 0 errori.
3. **Chiamata reale dalla strada normale** (GET come l'app, senza `engine` né token, ricerca mai fatta: «gelateria Ragusa»): HTTP 200, `x-engine: new`, MISS poi HIT con cache propria; **orari settimanali su 18 risultati su 20** (2 posti senza orari su Google), tipo principale 20/20, fuso 20/20, foto 20/20, `open_now` 18/20. Una foto con riferimento nuovo (`places/…/photos/…`) servita dal proxy: **302** con `Location` verso il CDN (il punto che avevo dichiarato non provato dal vivo).

Tutto torna: nessun rollback.

## Cosa resta da sapere

- **Cache del server (`places_cache`, 24 h):** le ricerche legacy già in cache restano nella tabella con la loro chiave; la strada normale usa ora solo chiavi `new1-…`. Una ricerca già fatta con `engine=new` dal banco (es. «trattoria Catania») risponde subito dalla cache nuova.
- **Costo:** +$0,012 a generazione (+9 %) per la ricerca nuova, misurato; nessuna chiamata in più. La fattura Google va ricontrollata in Cloud Console (tetti gratuiti dell'API nuova non considerati).
- **Vercel:** i deployment non sono visibili da questa sessione → **deploy dell'app da verificare da Ivano** (commit `ea99614`).
