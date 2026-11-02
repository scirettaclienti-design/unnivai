# LANCIO del 1/12/2026

**5 su 21 fatte** · aggiornato il 02/11/2026 · fonte dello stato: `docs/prove/` e `git log` di `main` (`5d60498`)

L'elenco è chiuso: una voce si aggiunge solo se lo decide Ivano.
Ogni task aggiorna la sua riga **prima del merge** (stato, commit o report che lo prova) e ricalcola il conteggio in cima.

Stati: **fatto** (su main, con prova) · **in corso** (ramo o PR aperti) · **da fare** · **aspetta Ivano** (il codice è pronto, manca un comando, un pagamento o una prova sua).

## Date

| Data | Cosa |
|---|---|
| 10/11 | Xcode installato e Apple Developer Program attivo (Ivano) |
| 18/11 | lavori A–J del report iPhone uniti su main |
| 20/11 | invio ad Apple per la revisione |
| 22/11 | blocco del codice |
| 1/12 | lancio; da qui nessun deploy delle funzioni senza Ivano |

## Prodotto

| # | Voce | Stato | Prova | Cosa manca |
|---|---|---|---|---|
| P1 | Navigazione: freccia, percorso, giro lontano, fine giro | fatto | freccia `a918f78` (NAV-MAPPA-VISIBILE); percorso `d381eb3` (NAV-TRATTI), `9e3ca8d` (NAV-MAPPA); giro lontano `207ada7`, `92c24d1` (`2026-10-30-giro-lontano.md`); fine giro `62a9bae` (`2026-10-29-fine-giro.md`); collaudo 10/10 `fc4c4aa` | GPS reale e voce in tasca: righe L2 (voce A) e L9 |
| P2 | Racconti con fonti e revisore | fatto | `5d14ed5` (`2026-11-02-racconto-fonti.md`): 21/23 tappe con fonti, 19 racconti passati, openai-proxy v40, collaudo punto 5 10/10 | 3 tappe senza racconto (Giardino di Sant'Alessio, Monte Muganà, Galleria del Cardinale Colonna) |
| P3 | Curiosità del cammino | fatto | `89415a4` (`2026-11-02-curiosita-quartieri.md`): openai-proxy v43, 10 curiosità a Trastevere, Monti, Catania, 0 ripetute, 0 fatti fuori fonte su 10 letti | controllo «vi» che scarta 2 curiosità vere: decisione di Ivano (report T6) |
| P4 | Revisore Sonnet (secret `ANTHROPIC_MODEL_REVISORE`) | aspetta Ivano | `b8b859b` (`2026-11-02-revisore-forte.md`): falsi «sì» 4/21 contro 12/21 di Haiku 4.5, +21% sul costo del racconto | `supabase secrets set ANTHROPIC_MODEL_REVISORE=claude-sonnet-5-5 --project-ref ahecpiwsdhghkndncejb`, poi verifica su un racconto vero nel log |
| P5 | Voce umana (credito OpenAI) | aspetta Ivano | `375b5d7` (VOCE-1, `2026-10-27-voce-1.md`); al 02/11 il credito è finito e parla la voce del telefono (`2026-11-02-coda-riepilogo.md`) | ricarica del credito OpenAI, oppure una voce di un altro fornitore |
| P6 | GEOCODING-LANCIO (via da Nominatim) | da fare | — | oggi il telefono chiede via e quartiere a Nominatim a ogni richiesta; dal server Nominatim risponde 403 (`eda9b67`) |
| P7 | TITOLI-RIFINITURA | da fare | — | precedente: TESTI-SCHEDE `75737a9` |
| P8 | DNA-5 | da fare | — | in `docs/prove/` ci sono DNA-1, 2, 3, 3b, 3c, 4, 6; DNA-5 no |
| P9 | CHAT-VERITA | aspetta Ivano | codice su main con la PR di CHAT-VERITA (`docs/prove/2026-11-02-chat-verita.md`): fonti dei racconti + revisore + risposta onesta; banco di 30 domande, frasi inventate 86 su 128 → 5 su 88; prima parola 4,06 s di mediana sul server (obiettivo 4 s mancato per metà, proposte nel report), 0,0107 $ a risposta | il «sì» al deploy di openai-proxy (§ 7 del report: fino al deploy la chat pubblicata risponde «Non riesco a raggiungere la guida»); poi tempo vero dal sito |
| P10 | OSPITE-GIRO | aspetta Ivano | codice su main con la PR di OSPITE-GIRO (`docs/prove/2026-11-02-ospite-giro.md`): account anonimo, 1 giro per account, tetto per IP e per tutti gli ospiti, registrazione sullo stesso account; SQL 41/41, test proxy 14/14 e client 22/22 | passi § 6 del report (prima EMAIL-LANCIO, poi migrazione, deploy di openai-proxy, modello email, accessi anonimi e collegamento manuale); poi collaudo 7 e prova § 7 sul sito pubblicato |

## Lancio

| # | Voce | Stato | Prova | Cosa manca |
|---|---|---|---|---|
| L1 | APP-IPHONE-PROVA | fatto | `5d60498` (`2026-11-02-app-iphone-prova.md`): progetto iOS Capacitor 8.5.3, `cap sync ios` ok, verdetto «sì con condizioni» | simulatore non provato: su questo Mac manca Xcode (va nella L2, voce H) |
| L2 | Invio ad Apple entro il 20/11 | aspetta Ivano | lista A–J, 9,5 giorni, in `2026-11-02-app-iphone-prova.md` | Ivano: Xcode e Developer Program (99 USD/anno) entro il 10/11, nome e bundle id, firma, App Store Connect; codice: voci A, D, E, F, H, J |
| L3 | EMAIL-LANCIO | aspetta Ivano | `27f7b26` (`2026-11-02-email-lancio.md`): 4 modelli, funzione `lista-attesa-email`, migrazione verificata con `--dry-run` | passi 1–8 del report: Resend, DNS su Vercel, SMTP e Site URL in Supabase (oggi `localhost:3000`), modelli, secret, deploy, migrazione; poi la prova delle 4 email |
| L4 | Landing unnivai.com | fatto | `curl https://unnivai.com` → 200 il 02/11; progetto Vercel `unnivai-site`, fuori da questo repo | — |
| L5 | Privacy, termini, cancellazione account in app | da fare | in `src/App.jsx` nessuna rotta di privacy o termini; nessuna cancellazione dell'account in `src/` | voci B e C del report iPhone; i testi li rivede Ivano |
| L6 | Avvisi su errori e costi | da fare | ci sono i tetti (QUOTA-CONTORNO `3a26a8f`, `VOCE_DAILY_CAP`), nessun avviso | avviso a Ivano quando una funzione sbaglia o la spesa AI del giorno supera una soglia |
| L7 | Banco 40 casi | da fare | oggi 18 casi fissi (`npm run banco`) e guardia 12 (`npm run banco:guardia`), da CLAUDE.md | 22 casi in più |
| L8 | Collaudo completo | da fare | ultimo collaudo 10/10 il 31/10 (`fc4c4aa`); punti 1–5 ripetuti dopo T6 (`89415a4`) | tutti i punti di `scripts/prova-nav/collaudo-sito.webkit.mjs` sul codice bloccato del 22/11 |
| L9 | 20 giri reali su iPhone a Roma e Catania | aspetta Ivano | — | voce, audio, GPS reale e rete; cosa provare: tabella di `2026-11-02-coda-riepilogo.md` |
| L10 | Revoca delle chiavi vecchie (Anthropic …UQAa, Mapbox …QIdA) | aspetta Ivano | nessuna prova di revoca in `docs/prove/` | revoca dalle console Anthropic e Mapbox, poi una riga qui con la data |
| L11 | Blocco del codice il 22/11 | da fare | — | cosa entra su main dopo il 22/11 lo decide Ivano; la regola va scritta in CLAUDE.md |
