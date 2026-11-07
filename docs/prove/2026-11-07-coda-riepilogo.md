# Coda del 07/11/2026: riepilogo di T26–T31

T26–T31 sono stati eseguiti in sequenza, ognuno da un sotto-agente nuovo nel suo worktree `~/unnivai-notte-<task>`, partito da `origin/main` aggiornato, uno alla volta. Le regole della notte sono state passate per esteso a ogni sotto-agente.

- **Tutti e sei sono uniti su main**, ognuno con una PR, senza `--admin`. Prima di ogni merge: suite verde, lint 0 errori, build ok, `banco:guardia` ok (12/12, banco 10/10, pertinenza senza ❌ nuovi). Dopo ogni merge: CI di main verde e commit status Vercel success, verificati dal coordinatore su ogni commit di merge.
- **Nessuna migrazione, nessun secret, nessun deploy di funzioni.** `supabase/` è identica a prima della coda (`git diff b99a528 aacf05c -- supabase/` vuoto).
- **Le prove hanno usato la voce del telefono.** `.env.local` cancellato da ogni worktree.

## Tabella

| Task | Stato | Commit su main (PR) | Cosa provare su iPhone | Cosa aspetta Ivano | Costo (listino) |
|---|---|---|---|---|---|
| T26 LOGIN-SESSIONE | **fatto** (causa del caso di Ivano non dimostrata, vedi sotto) | `0e3a8e8` (#55) | Entra col codice, chiudi tutto, riapri dallo stesso indirizzo: niente codice. «Esci» sul Mac: l'iPhone resta dentro | Pannello Supabase, Authentication → Sessions: controllare che «Time-box user sessions» e «Inactivity timeout» siano spenti | 0 $ |
| T27 PER-TE-TRE | **fatto**, a Catania 2 passioni su 3 | `ba41a58` (#56) | Facoltativo: home a Roma, scorri le schede, «Vedi tutte» | nessun comando | ≈ 2,8 $ (2,37 misurati) |
| T28 PROFILO-SEZIONI | **fatto** | `3b48dae` (#57) | La mappa nella scheda di Rivivi, dentro l'app | nessun comando | 0,2–0,3 $ (stima) |
| T29 IMPOSTAZIONI-VERIFICA | **fatto**, numeri in parte su un codice precedente | `4d056c8` (#58) | niente | 7 decisioni, sotto | 8,53 $ su 10 $ (≈ 1,5 $ persi) |
| T30 ESTETICA-MOVIMENTO | **fatto** | `4727d6b` (#59) | Landing, caricamento, accesso, home; con «Riduci movimento» tutto fermo | nessun comando | 0 $ |
| T31 COLLAUDO-FINALE | **fatto**, nessun difetto bloccante | `aacf05c` (#60) | Solo voce umana, audio in tasca, GPS e rete reali | nessun comando | 1,0–1,5 $ (stima) |
| **Totale** | | | | | **≈ 12,5–13,1 $** (10,9 $ misurati, il resto stimato) |

**LANCIO: 15 su 22, invariato.** Nessuna riga dell'elenco corrisponde a T26–T30. L8 (Collaudo completo) resta «da fare»: la sua riga aspetta il codice bloccato del 22/11.

## Esito per task

**T26 — LOGIN-SESSIONE.**
- La sessione resta salvata: chiusura, riapertura, token scaduto, rete assente. Provato in WebKit iPhone 14 col Supabase vero e simulato, poi di nuovo sul sito in T31.
- Corretto: «Esci» chiudeva la sessione su **tutti** i telefoni (`signOut` globale), ora solo su questo. Senza rete l'app restava ferma sul caricamento, ora entra con la sessione salvata. Dopo l'accesso chiede memoria persistente al browser.
- **Non dimostrato:** il caso di Ivano non si è riprodotto. Le cause possibili sono tre: un «Esci» su un altro dispositivo (corretto), un indirizzo diverso o l'icona Home al posto di Safari (hanno memorie separate), la regola di Safari dei 7 giorni senza uso. Le impostazioni di sessione del progetto Supabase non sono state lette: servono il pannello o il token di gestione.
- Report: `docs/prove/2026-11-07-login-sessione.md`.

**T27 — PER-TE-TRE.**
- Causa delle 2 proposte: il modello sceglie le tappe senza coordinate e il tetto di 1,2 km fa cadere i temi coi posti lontani; il ripiego «per domattina» cadeva allo stesso modo. Riprodotto con 2 schede sul sito, a Roma alle 17:46, con l'account di prova. Il DNA di Ivano non è stato letto: si è usato un DNA equivalente.

| Proposte, prima → dopo | 9:30 | 13:00 | 19:00 |
|---|---|---|---|
| Roma | 4 → 5 | 3 → 5 | 5 → 6 |
| Catania | 3 → 4 | 3 → 4 | 4 → 4 |
| Troina | 1 → 2 | 1 → 2 | 2 → 3 |

- **Passioni coperte:** Roma 3 su 3 a tutte le ore. **Catania 2 su 3**: la natura manca e la home lo dice, quindi la richiesta «una per ciascuna passione» non è piena lì. Le regole del motore non sono state allentate per fare numero.
- **Sera:** resta un solo giro per adesso, le passioni stanno nelle proposte «per domattina». Motivo nel report: tre giri serali si contenderebbero gli stessi locali, a spesa e attesa triple.
- **Caricamento:** le schede già pronte compaiono subito (10,5 → 0,9 s quando cambia la chiave). **La prima apertura di una fascia resta oltre i 2 s:** 7–12 s misurati, 18 s nella prova di T31.
- «Vedi tutte» apre `/per-te`. In home «Su misura» e «Al volo», «AI Powered» tolto. «Gratis & Su Misura» è diventato «Gratis», perché suonava doppia. La scheda «Su misura per te» si scontrava col nome nuovo e ora dice «Con una guida o a sorpresa».
- Report: `docs/prove/2026-11-07-per-te-tre.md`.

**T28 — PROFILO-SEZIONI.**
- Mete funziona con dati veri. Risultati prima era una frase fissa, ora ha giri, città, tappe e km veri. Rivivi prima leggeva una tabella vuota, ora ha tracciato, data, tappe, mappa e «Rifai questo giro». Richieste non si vede più. Il DNA ha le schede col marchio, i pesi non cambiano.
- **Limiti:** i giri finiti prima di oggi non hanno le tappe e restano solo nelle Mete (la schermata lo dice). Lo spostamento degli orari di «Rifai» è provato solo da test unitari.
- Report: `docs/prove/2026-11-07-profilo-sezioni.md`.

**T29 — IMPOSTAZIONI-VERIFICA.**
- Prima parecchie impostazioni non facevano niente. Corretti con test: chip Interessi senza effetto quando c'era una frase, budget che valeva solo come tetto, Gruppo perso in Al volo, filtro «storia» che lasciava 1 posto su 38, 2-3 Giorni vuoto a Roma, frase con più fasce che partiva dalla sera.
- **Ancora deboli:** Budget Medio cambia poco (a Catania niente), Economico si vede solo a selettore spento, Shopping non porta negozi veri, Gruppo Solo/Coppia/Amici cambia soprattutto i minuti dei pasti. Ritmo Attivo è il passo di difetto, quindi è identico al neutro.
- **Rumore:** due giri uguali in Su misura differiscono del 53–74% di tappe, quindi la tabella del report misura gli effetti a selettore spento. Il selettore decide poco: 0–3 tappe finali su 12.
- **DNA:** dei sei sospetti di T28 tre sono corretti (il «−» a 0% che lasciava un debito, i giri con lo stesso `tour_id` fusi, la lettura oltre 1000 righe). Tre sono veri ma lasciati, perché sono decisioni di Ivano.
- **Il giro dopo riflette il DNA solo in parte:** a selettore spento «−» Cibo e azzera Natura lasciano il giro identico; a fiducia 45% cambia solo azzera Cultura.
- Report e grafico: `docs/prove/2026-11-07-impostazioni-verifica.md`, `docs/prove/img/2026-11-07-impostazioni-verifica/dna-audit.svg`.

**T30 — ESTETICA-MOVIMENTO.**
- Il logo entra in 1,1 s, le curve del marchio scivolano piano, la Landing ha la camera lenta sul Colosseo (la foto è una sola, quindi niente strati; nella home dell'app non c'è un Colosseo, lì le curve sono fisse). Con «Riduci movimento» è tutto fermo. Tutto CSS, nessuna dipendenza nuova.
- Tempi, 9 ripetizioni alternate, mediane: Landing primo contenuto 412 → 416 ms, home prima scheda 784 → 773 ms, 60 fps. Bundle +586 B.
- **Limite:** WebKit di Playwright non rallenta la CPU, quindi «iPhone simulato» è solo schermo e motore. Su un iPhone vecchio il costo reale non è misurato.
- Report: `docs/prove/2026-11-07-estetica-movimento.md`.

**T31 — COLLAUDO-FINALE.** Sito su `4727d6b`, nessuna correzione.

| Punto | Esito |
|---|---|
| Sessione che resta, «Esci» che riporta al login, secondo telefono dentro | ok |
| Per Te a Roma, 04:59 ora vera | ok, 5 schede in 18 s |
| «Vedi tutte» | ok, 6 schede |
| Profilo con account di prova, vuoto, ospite | ok, Richieste non si vede, nessuna pagina vuota |
| Nomi della home | ok |
| Landing con e senza «riduci movimento» | ok |
| Su misura con chip e frase, Al volo | ok, con l'osservazione sotto |
| Collaudo di base | 13 su 13, **ma i punti 4, 5 e 7 sono usciti rossi al primo giro** (errore WebKit e «Avvia» non cliccabile) e verdi alla ripetizione |

- La causa dei rossi al primo giro è trattata come instabilità della prova, ma non è dimostrata.
- **Osservazione:** in Su misura «una mattina» scritta nella frase, senza chip Durata, non accorcia il giro: 8 tappe fino alle 20:00, con Piazza Navona due volte (ammesso dalla regola della sera).
- Per Te di giorno con l'ora vera sul sito non è provato: la prova è delle 04:59.
- Il punto 7 da ospite passa. Gli accessi anonimi accesi sono voluti: li registra la riga P10 di LANCIO (PASSI-IVANO).
- Report: `docs/prove/2026-11-07-collaudo-finale.md`.

## Cosa non torna ancora

1. **`npm run banco -- --replay` esce con 1.** T29 ha cambiato il motore: 33 casi su 40 sono uguali al giro vero, 7 hanno tappe diverse, tutti e 40 passano i controlli. Gli esiti salvati sono del 3/11. La guardia, che è il cancello prima del merge, è verde. Serve il giro pagato del banco (circa 8 $).
2. **Una parte dei numeri di T29 non viene dal codice finale.** 37 casi su 63 sono girati prima delle ultime due correzioni; i 26 che quelle correzioni toccano sono rifatti. La regola di CLAUDE.md chiede un giro sul codice finale: qui è rispettata solo in parte.
3. **I tracciati della guardia sono completati, non rifatti** (14 chiamate aggiunte), perché il proxy rifiuta le liste più vecchie di ieri e `--registra` non vale più per il 15/10.

## Decisioni che aspettano Ivano

1. **Peso del salto**: oggi −0,10 contro +0,05 di una tappa raggiunta. Proposta: −0,05, oppure niente salti dagli account di prova.
2. **Saturazione**: tre giri portano un gusto al 100%. Proposta: un tetto più lento o un confronto fra gusti.
3. **Correzioni che si sciolgono**: dimezzano ogni 30 giorni. Proposta: non farle decadere, o mezza vita più lunga.
4. **Fiducia bassa**: a 15% una correzione non sposta le tappe. Proposta: una correzione esplicita vale come una richiesta.
5. **Al volo**: Budget e Ritmo non esistono. Devono esserci?
6. **Banco**: rifare il giro pagato dei 40 casi, circa 8 $.
7. **Proxy**: far passare i giorni passati per l'account di prova, così `--registra` torna a valere. È una modifica del server.

## Pulizia

I worktree `~/unnivai-notte-t26` … `t31` e `~/unnivai-notte-riepilogo-0711` restano sul disco. In `~/unnivai-notte-t28` resta una schermata non tracciata, `docs/prove/schermate/2026-11-07-profilo-sezioni/vero-errore.jpg`, fuori dal repo: se ne va col worktree.
