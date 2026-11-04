# Coda del 06/11/2026: riepilogo di T23–T25

T23–T25 sono stati eseguiti in sequenza, ognuno da un sotto-agente nuovo nel suo worktree `~/unnivai-notte-<task>`, partito da `origin/main` aggiornato. Le regole della notte sono state passate per esteso a ogni sotto-agente.
- **Tutti e tre sono uniti su main**, ognuno con una PR, senza `--admin`. Prima di ogni merge: suite verde, lint 0 errori, build ok, `banco:guardia` ok. Dopo ogni merge: CI di main verde e commit status Vercel success (verificati dal coordinatore su ogni commit di merge).
- **Nessuna migrazione applicata, nessun secret scritto, nessun deploy di funzioni.** `openai-proxy` resta v49 e `places-proxy` v18.
- **Deploy tenuti fermi.** Su main c'è codice del server non pubblicato: la voce delle prove (T22) e la chiave Google del server con il path `geocode` (T24). Il coordinatore ha chiesto a T23 e T24 di non pubblicare: un deploy di `openai-proxy` avrebbe portato con sé il codice di T22, che aspetta il «sì» di Ivano. L'app funziona con le funzioni di oggi e con quelle nuove.
- **Le prove hanno usato la voce del telefono.**
- **Credenziali:** dove servivano URL e chiave anon di Supabase (pubblici, non in `.env.local`), sono stati presi dal connettore Supabase, in un file temporaneo poi cancellato. Nessun altro file di `~/unnivai-1b` è stato letto.

## Tabella

| Task | Stato | Commit su main (PR) | Cosa provare su iPhone | Comandi che aspettano Ivano | Costo (listino) |
|---|---|---|---|---|---|
| T23 BANCO-DIFETTI-2 | **fatto** | `6eb435b` (#46) | Crea «Un pomeriggio tra Colosseo e Fori Imperiali a Roma»: c'è il Colosseo vero; Crea «Natura e panorami a Palermo»: la riga sotto il titolo del giorno; Veloce Relax a Catania dopo le 23: la riga delle spa chiuse; Profilo → «Con bambini», poi Crea a Roma: meno tappe, soste più lunghe | nessuno | 4,71 $ (AI 1,67 + Google 3,04) |
| T24 GOOGLE-CHIAVI | **unito, aspetta Ivano** | `7c3999f` (#47) | dopo il passo 8 dei passi per Ivano: la mappa si apre nell'app iOS con la chiave nuova del browser (`capacitor://localhost` fra i referrer) | 11 passi in ordine in `2026-11-06-google-chiavi.md`, ciascuno con la sua verifica: 1) «sì» a T22; 2) chiave server; 3) `GOOGLE_SERVER_KEY`; 4) deploy di places-proxy; 5) deploy di openai-proxy; 6) chiave browser con referrer e API; 7) `VITE_GOOGLE_MAPS_API_KEY` su Vercel e redeploy; 8) prova iOS; 9) 24 ore di controllo della chiave vecchia; 10) revoca di …kQgM e unset di `GOOGLE_MAPS_API_KEY`; 11) data in L10. Fino al passo 10 il ritorno indietro è rimettere la chiave vecchia su Vercel | 0 $ |
| T25 COLLAUDO-COMPLETO | **fatto** (L8 resta «da fare» fino al codice bloccato del 22/11) | `01af6ef` (#48) | niente di nuovo: è il collaudo di quello che c'è | nessun comando nuovo; la lista «cosa manca davvero» sotto | stima ≈ 0,5 $ AI + < 0,5 $ Google (non misurati) |
| **Totale** | | | | | **≈ 2,2 $ AI + ≈ 3,5 $ Google** |

## Esito per task

**T23 — BANCO-DIFETTI-2.**

| Difetto | Prima | Dopo |
|---|---|---|
| D6 richiesta precisa (sesto controllo nuovo, `scripts/banco/controlloRichiesta.js`) | 8/40 casi falliti | 0/40 |
| D7 «Tempo libero» oltre 2 ore | 10 righe, tutte mute | 5 righe, ognuna col motivo |
| DNA-5 famiglia, Crea a Roma | 6,19 km contro 3,94 km del neutro | 3,54 km e 10 tappe contro 4,51 km e 12 tappe |

- **D6:** la richiesta ora è nel giro (Colosseo vero, Musei Vaticani, Ballarò, Crema & Cioccolato) oppure il giro dice perché non può (spa chiuse alle 23:15, Mercato del Capo chiuso, visite non di natura a Palermo e Troina).
- **D7-bis:** i pasti tolti dal tetto di 1,2 km si rimettono dentro il tetto; una prima tappa isolata esce da sola, senza trascinarsi via la giornata (era il caso di a-milano).
- **Banco:**
  - `npm run banco -- --replay` esce con 0: 40/40 uguali al giro vero, con i sei controlli, 0 uscite in rete. Nessun caso che passava ora fallisce.
  - Giro dal vivo sul codice finale: 26 casi.
  - Guardia: home 12/12, pertinenza senza ❌ nuovi, banco 10/10.
- **Restano aperti:**
  - buchi dichiarati dove entro 1,2 km non c'è niente di aperto (Troina 251 min, Noto 135, a-troina 144): nel report la proposta di ricerche nuove nei borghi;
  - D9, i nomi generici.
- Report: `docs/prove/2026-11-06-banco-difetti-2.md`.

**T24 — GOOGLE-CHIAVI.**
- **Il browser chiama:** Maps JavaScript, Places legacy (autocompletamento, PlacesService), Geocoder JS, Directions.
- **Geocoding REST:** il browser lo chiamava con la sua chiave, chiamata che una chiave limitata ai siti non permette. Ora passa da `places-proxy` (path `geocode`) e, finché la funzione nuova non è pubblicata, ripiega sulla chiamata diretta.
- **Il server chiama:** `places-proxy` (Places New, Places legacy, Geocoding) e `openai-proxy` (Geocoding delle curiosità). Entrambi leggono prima `GOOGLE_SERVER_KEY`, poi `GOOGLE_MAPS_API_KEY`: il codice funziona anche prima del secret nuovo.
- **Test:** `googleChiavi.test.js`, 16 prove. Fallisce se una funzione legge `VITE_*`, se manca la precedenza del secret nuovo, o se Geocoding e chiave del browser compaiono fuori dai file ammessi.
- **Origine iOS:** è `capacitor://localhost` (nessuna sezione `server` in `capacitor.config.json`). Che Google lo accetti come referrer non è verificato in console; va provato su un telefono. Piano B: chiave iOS separata con quota bassa. Piano C: `iosScheme` https con hostname di unnivai.com.
- **Chiave server:** nessuna restrizione per IP, perché le Edge Functions non hanno IP fissi; al loro posto quote giornaliere e avviso di budget.
- Report: `docs/prove/2026-11-06-google-chiavi.md`.

**T25 — COLLAUDO-COMPLETO.**
- **Collaudo sul sito pubblicato:** 12 punti su 13 ok in 6 min 36 s, nessun fallimento nuovo.
  - Il 7 da ospite è rosso come sempre: accessi anonimi spenti.
  - Il 6 alla prima esecuzione ha dato l'errore di console `user_preferences access control`, già visto nei report precedenti; ripetuto, è pulito.
  - Il collaudo non copre chat, DNA, email, cancellazione account e pagamenti.
- **Banco e guardia:** `npm run banco -- --replay` esce con 0 (40/40), `banco:guardia` passata.
- **Stato del server, letto in sola lettura:**
  - non pubblicate: `avvisi`, `elimina-account`, `lista-attesa-email`, `create-checkout`, `stripe-webhook`;
  - 4 migrazioni non applicate;
  - secret assenti: `VOCE_TELEFONO_USER_IDS`, `GOOGLE_SERVER_KEY`, `AVVISI_*`, Resend.
- **LANCIO voce per voce:** nessuna riga «fatto» è smentita dal sito.
  - P8, P9 e L12 sono «fatto» sulla base dei report: nessun punto del collaudo li tocca.
  - L1 è «fatto» come analisi, non come app che gira.
- Report: `docs/prove/2026-11-06-collaudo-completo.md`.

## Cosa manca davvero al lancio (da T25, per gravità)

**Blocca il lancio, tutto di Ivano:**
1. Xcode, Developer Program e firma (L2).
2. Le 4 migrazioni in attesa e il deploy di `openai-proxy`, `elimina-account`, `avvisi`, `lista-attesa-email`.
3. Email: Resend, DNS, SMTP, Site URL (oggi `localhost:3000`).
4. Segnaposto legali di privacy e termini, con la lettura di un legale.
5. Accessi anonimi per il giro da ospite.
6. Credito OpenAI per la voce.

**Prima del 20/11 (invio ad Apple):**
- Passaggio delle chiavi Google, 11 passi di T24 (Ivano).
- Secret `VOCE_TELEFONO_USER_IDS` e deploy (Ivano).
- 20 giri reali su iPhone (Ivano).
- Voci D, H, J del report iPhone e account demo per Apple (codice).
- Regola del blocco del 22/11 in CLAUDE.md (codice, decide Ivano).
- Chat, DNA e pagamenti nel collaudo (codice).

**Dopo il lancio:** Nominatim in `CityContext`, le 3 tappe senza racconto, il collaudo sul codice bloccato del 22/11.

## LANCIO

`docs/LANCIO.md`: **12 su 22 fatte**, invariato rispetto alla sera del 05/11.
- **Aggiornate:**
  - L7 (banco: D6 e D7 chiusi, restano i buchi dei borghi e D9) e P8 (DNA-5: la famiglia cammina meno del neutro), da T23;
  - L10 (passi per il passaggio delle chiavi Google), da T24;
  - L8 (prova del collaudo del 06/11; resta «da fare» fino al codice bloccato del 22/11), da T25.
- **Restano «aspetta Ivano»:** P5, P10, L2, L3, L5, L6, L9, L10.
- **Restano «da fare»:** L8, L11.

## Cosa NON risolve

- **Chiave Google …kQgM:** resta valida e nel sito finché Ivano non fa gli 11 passi. Resta comunque nella storia git.
- **Chiave del browser:** anche quella nuova si legge dal sito. La protegge solo la restrizione per referrer.
- **Origine iOS:** non è provata.
- **Buchi nei borghi:** quelli dichiarati restano (fino a 251 minuti a Troina). D9 è aperto.
- **Collaudo:** i costi di T25 sono stime, non misure.
- **Pulizia:** i worktree `~/unnivai-notte-t23`, `-t24` e `-t25` hanno i rami uniti e si possono rimuovere, come quelli delle code precedenti. In nessuno resta `.env.local` (verificato con `ls`).
