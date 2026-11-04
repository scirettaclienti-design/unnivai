# COLLAUDO-COMPLETO (T25) — 06/11/2026

Solo esito ed elenco: nessuna correzione del codice, nessuna funzione pubblicata, nessuna migrazione, nessun secret. Sito provato: `https://unnivai.vercel.app`, main `7c3999f` (CI verde, commit status Vercel «success»). Dati grezzi: `docs/prove/dati/2026-11-06-collaudo-completo.json`. Prove con la voce del telefono (mai OpenAI).

## Cosa cambia per Ivano

- Il sito pubblicato regge: **12 punti su 13 passano** (1–6, 8–13; il 7 è l'unico rosso); l'unico rosso è il **7 da ospite**, atteso (accessi anonimi spenti, come dal 31/10). Nessun fallimento nuovo.
- Il banco a 0 $ e la guardia passano (40/40 casi, 6 controlli su 6; guardia 10/10).
- Il confronto con `docs/LANCIO.md` mostra **nessuna riga «fatto» smentita dal sito**. Gli scarti sono P8, P9 e L12: P8 e P9 sono «fatto» ma non toccati da nessun punto del collaudo; L12 non è visibile dal collaudo (nessuna schermata di pagamento incontrata, nessun test mirato). Il resto del lancio è fermo su passi di Ivano (migrazioni, deploy, secret, Apple).
- **Nessuna riga LANCIO cambia stato.** L8 resta «da fare»: la riga chiede il collaudo sul codice bloccato del 22/11, che oggi non esiste; la prova di oggi è aggiunta in riga.

## 1. Collaudo sul sito pubblicato

Comando: `node scripts/prova-nav/collaudo-sito.webkit.mjs` (senza argomenti: punti 1–8, 11–13; il punto 8 fa anche 9 e 10). WebKit, iPhone 14, GPS finto, account di prova. Durata totale 6 min 36 s.

| Punto | Esito | Tempo | Cosa si è visto |
|---|---|---|---|
| 1 Freccia sparisce dopo 10 m | OK | 17 s | a 5 m «Parti da qui verso Porta Uzeda», a 15 m nessuna freccia |
| 2 Tappa 2 dopo «Salta»: niente freccia | OK | 17 s | nessuna freccia, pillola «55 m · verso Basilica Cattedrale di Sant'Agata» |
| 3 GPS muto 60 s e ripresa | OK | 80 s | durante il silenzio «Ho perso il segnale. Continua pure: quando torna, riparto da dove sei.», niente freccia; dopo la ripresa nessuna freccia e nessun avviso |
| 4 Curiosità del cammino | OK | 38 s | Roma: Trastevere («trans Tiberim»), fonte it.wikipedia Trastevere, esito «passata»; Catania: Piazza Stesicoro / Corso Sicilia, «passata», mai Roma, 0 fontanelle |
| 5 Schede: racconto o frase breve | OK (`schedeOk` vero) | 63 s | 10 schede, 9 racconti «passato» (Orto Botanico, Villa Sciarra, Palazzo Massimo, Sant'Agata, Elefante, Terrazza delle Quadrighe, Galleria Colonna, Torre Capitania, Chiesa Madre di Troina), 1 «scartato» → frase breve (Piazza del Campidoglio, «Tappa del collaudo»: la tappa di prova è finta, il comportamento è quello previsto) |
| 6 «Fine» a 2/3 | OK | 48 s | nota «Sei arrivato a 2 tappe su 3.», Profilo 34 → 35, 35 dopo ricarica e dopo Home, 0 doppioni. Nella prima esecuzione un errore di console `user_preferences?on_conflict=user_id … access control checks` (già presente nei report del 20/10, 24/10, 30/10, 03/11); **ripetuto una volta: 35 → 36, 0 errori** (passeggero) |
| 7 «Salta» fino in fondo + 3 tocchi | **ROSSO da ospite (atteso)**, OK da account | 33 s | ospite: `waitForURL` scaduto dopo 20 s, perché gli accessi anonimi sono spenti (dipendenza dal passo P10, non un guasto nuovo). Con account: «Hai saltato tutte le tappe: il giro finisce qui.», 0 errori |
| 8 Crea «un giro a Catania» da Roma | OK | 12 s di generazione | «Domani · 9:30 · cambia» |
| 9 Panoramica con pochi km | OK | (nel punto 8) | «Da Via Etnea a Via Crociferi · Giornata 9:30–21:15 · 27 min a piedi · 1,9 km · 9 tappe» |
| 10 «Avvia» da lontano | OK | (nel punto 8) | «Sei a 537 km da Catania: la guida parte quando sei lì.», navigazione non partita, mappa zoom 16, 0 segnaposti vuoti |
| 11 Per Te a Roma 01:00 e 20:00 | OK | 23 s | alle 01:00 5 schede («Intorno alla Fontana del Mascherone» «Scelto per te», poi 4 «Per stamattina»: Fontane giardini e palazzi, Tre forni, Musei, Panorami), riga «Adesso è aperto poco. Le altre sono per stamattina.» |
| 12 Scheda monumento: subito, cenni dopo | OK | 17 s | apertura in 65 ms, cenni arrivati a 8,4 s (ritardo imposto 8 s), 1 richiesta racconto, esito «passato», 0 errori |
| 13 Titoli dei giri generati | OK | 10 s | «Intorno alla Fontana del Mascherone», «Fontane, giardini e palazzi di Roma», «Tre forni a Roma», «Musei di Roma» ecc., con le tappe vere |

Note: il collaudo non copre la chat (P9), il DNA (P8), le email, la cancellazione account, i pagamenti, la voce OpenAI. Il flag `commitSito` del JSON è null (lo script non lo legge): il commit è quello di main sopra.

## 2. Banco e guardia

- `npm run banco -- --replay`: **exit 0**; 40/40 uguali al giro vero, 0 uscite in rete; 40/40 casi con tutti i controlli, 0 difetti, 0 senza giro, 0 saltati. I sei controlli (tappe aperte all'ora, distanze plausibili per il mezzo, nessun luogo di un'altra città, titolo coerente, nessuna frase ripetuta, richiesta precisa rispettata o dichiarata): tutti i casi.
- `npm run banco:guardia`: **exit 0, «PASSATA (10/10 casi con tutti i controlli)»**.

## 3. Stato reale di server e database (sola lettura)

- Funzioni pubblicate (`supabase functions list`): `openai-proxy` **v49**, `places-proxy` **v18** (ultima modifica 13/10: nessun path `geocode`), più le tre di un altro progetto (`charme-diagnosi`, `doc-charme`, `pub`). **Non pubblicate**: `avvisi`, `elimina-account`, `lista-attesa-email`, `create-checkout`, `stripe-webhook`.
- Migrazioni applicate (MCP `list_migrations`, sola lettura): arrivano a `20261029120000`. **Non applicate** (4): `20261102160000_lista_attesa_email`, `20261102200000_ospite_giro`, `20261103010000_elimina_account`, `20261104090000_avvisi`.
- Secret presenti (solo nomi): `AI_GLOBAL_DAILY_CAP`, `AI_PROVIDER`, `AI_QUOTA_IP_SALT`, `AI_UNLIMITED_USER_IDS`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL_NOTIFICHE/REVISORE/SELETTORE/TRADUTTORE`, `GOOGLE_MAPS_API_KEY`, `OPENAI_API_KEY`, `PLACES_SEARCH` e i `SUPABASE_*`. **Assenti**: `VOCE_TELEFONO_USER_IDS` (T22), `GOOGLE_SERVER_KEY` (T24), `AVVISI_CHIAVE` e `AVVISI_EMAIL_A`, qualsiasi chiave Resend. `ANTHROPIC_MODEL_REVISORE` impostato il 02/11 alle 10:33, impronta uguale a `ANTHROPIC_MODEL_SELETTORE` (conferma P4).
- `https://unnivai.com` risponde 200 (L4).
- Codice su main non pubblicato: voce delle prove (T22) e chiave server / path `geocode` (T24). Il sito usa l'app di main con le funzioni di prima: il collaudo di oggi prova quindi la combinazione «app nuova + funzioni vecchie», che è proprio quella che resta in produzione finché Ivano non pubblica.

## 4. LANCIO voce per voce

Legenda prova: **SITO** = provato oggi sul sito pubblicato; **REPORT** = provato da un report citato, non riprovato oggi; **CODICE** = su main ma non attivo sul server; **—** = nessuna.

| Riga | Stato scritto | Stato reale | Prova | Scarto |
|---|---|---|---|---|
| P1 Navigazione | fatto | fatto | SITO: punti 1, 2, 3, 6, 7 (account), 8, 9, 10 | nessuno. GPS reale resta L9 |
| P2 Racconti con fonti | fatto | fatto | SITO: punto 5 (9 passati su 10), punto 12 | nessuno; le 3 tappe senza racconto non sono state rivisitate |
| P3 Curiosità del cammino | fatto | fatto | SITO: punto 4 (Roma con fonte, Catania senza Roma, 0 fontanelle) | nessuno |
| P4 Revisore Sonnet | fatto | fatto | secret verificato oggi (02/11 10:33, = selettore) | nessuno |
| P5 Voce umana | aspetta Ivano | aspetta Ivano | credito OpenAI finito (REPORT 02/11); le prove usano la voce del telefono | `VOCE_TELEFONO_USER_IDS` assente e deploy di T22 non fatto: CODICE |
| P6 GEOCODING-LANCIO | fatto | fatto | SITO indiretto: curiosità con via/quartiere giuste (punto 4); openai-proxy v49 | il path `geocode` di T24 è CODICE; CityContext e ricerca indirizzi usano ancora Nominatim (scritto) |
| P7 TITOLI-RIFINITURA | fatto | fatto | SITO: punto 11 e 13, titoli «Tre forni a Roma», «Musei di Roma», «Fontane, giardini e palazzi di Roma» | la prova su iPhone resta di Ivano (scritto) |
| P8 DNA-5 | fatto | fatto nel codice, **non provato sul sito** | REPORT `2026-11-05-dna-5.md`, replay 0 $; oggi solo il contatore Profilo (punto 6) | **scarto**: nessun punto del collaudo guarda il riquadro «Come giri» o l'ordine di Per Te per DNA; aspetta la prova su iPhone |
| P9 CHAT-VERITA | fatto | fatto, **non riprovato oggi** | REPORT `2026-11-02-chat-verita.md` (v46), `2026-11-04-chat-accesso-veloce.md`; oggi funzione v49 attiva | **scarto**: il collaudo non copre la chat; tempo 4,86 s di mediana sopra il tetto 4 s (scritto) |
| P10 OSPITE-GIRO | aspetta Ivano | aspetta Ivano | SITO: punto 7 da ospite rosso (accessi anonimi spenti); migrazione `20261102200000` non applicata | nessuno: lo stato scritto è giusto |
| L1 APP-IPHONE-PROVA | fatto | fatto (come analisi) | REPORT `2026-11-02-app-iphone-prova.md` | «fatto» vale per il progetto e il verdetto, non per un'app che gira: niente simulatore |
| L2 Invio Apple 20/11 | aspetta Ivano | aspetta Ivano | REPORT app-nativa (03/11) | Xcode e Developer Program previsti il 10/11, non verificabili da qui |
| L3 EMAIL-LANCIO | aspetta Ivano | aspetta Ivano | CODICE: funzione `lista-attesa-email` non pubblicata, migrazione `20261102160000` non applicata | nessuno |
| L4 Landing | fatto | fatto | `unnivai.com` 200 oggi | nessuno (fuori dal repo) |
| L5 Privacy / cancellazione | aspetta Ivano | aspetta Ivano | CODICE: `elimina-account` non pubblicata, migrazione `20261103010000` non applicata | segnaposto legali ancora da compilare |
| L6 Avvisi | aspetta Ivano | aspetta Ivano | CODICE: `avvisi` non pubblicata, migrazione `20261104090000` non applicata, secret `AVVISI_*` assenti | nessuno |
| L7 Banco 40 casi | fatto | fatto | oggi: replay 40/40, guardia 10/10 | nessuno; il giro dal vivo è fermo ai 10 casi di BANCO-DIFETTI (il resto è replay) |
| L8 Collaudo completo | da fare | da fare | oggi 12/13 punti ok, 7 ospite atteso | la riga chiede il codice bloccato del 22/11: resta aperta |
| L9 20 giri su iPhone | aspetta Ivano | aspetta Ivano | — | nessuno |
| L10 Revoca chiavi | aspetta Ivano | aspetta Ivano | CODICE: `GOOGLE_SERVER_KEY` assente, `places-proxy` v18 senza `geocode`; chiavi Mapbox …QIdA e Google …kQgM non ancora ruotate | nessuno |
| L11 Blocco del codice 22/11 | da fare | da fare | — (CLAUDE.md non contiene la regola) | nessuno |
| L12 PAGAMENTI-SPENTI | fatto | fatto, **non toccato oggi** | REPORT `2026-11-04-pagamenti-spenti.md`; `create-checkout` e `stripe-webhook` non pubblicate (verificato) | **scarto lieve**: il collaudo non apre Notifiche, scheda tour o tour live, dove stavano le 4 strade visibili |

Il conteggio in cima a LANCIO (12 su 22) resta giusto.

## 5. Cosa manca davvero al lancio (1/12)

### Blocca il lancio

| # | Cosa | Chi |
|---|---|---|
| 1 | Xcode, Developer Program, bundle id, firma, App Store Connect: senza questo niente invio ad Apple (L2) | Ivano |
| 2 | Applicare le 4 migrazioni in attesa (`db push` dopo `--dry-run`) e pubblicare `openai-proxy`, `elimina-account`, `avvisi`, `lista-attesa-email` (L3, L5, L6, P10): l'app promette consenso, cancellazione e accessi che il server non ha | Ivano (comandi nei report; il codice è pronto) |
| 3 | Email: Resend, DNS, SMTP, Site URL oggi `localhost:3000` (L3); senza, registrazione e reimpostazione password non funzionano per utenti veri | Ivano |
| 4 | Privacy e termini: compilare i segnaposto e farli leggere a un legale (L5); Apple li richiede | Ivano |
| 5 | Accessi anonimi in Supabase e collegamento manuale (P10), se il lancio prevede il giro da ospite; il punto 7 da ospite resta rosso finché non sono accesi | Ivano |
| 6 | Voce: ricaricare il credito OpenAI o scegliere un'altra voce (P5); oggi parla la voce del telefono, utilizzabile ma non quella promessa | Ivano |

### Da fare prima del 20/11 (invio ad Apple)

| # | Cosa | Chi |
|---|---|---|
| 7 | Passaggio chiavi Google: secret `GOOGLE_SERVER_KEY`, deploy di `places-proxy` e `openai-proxy`, restrizioni per sito/app, revoca di …kQgM e Mapbox …QIdA (L10, T24) | Ivano (secret e deploy), poi codice per la verifica |
| 8 | Secret `VOCE_TELEFONO_USER_IDS` e deploy di `openai-proxy` per le prove con l'account di prova (T22) | Ivano |
| 9 | 20 giri reali su iPhone a Roma e Catania (voce, GPS, rete) e prova del Profilo «Come giri» (L9, P8, P7) | Ivano |
| 10 | Voci del report iPhone D, H, J (L2) e account demo per la revisione Apple | codice, poi Ivano per il simulatore |
| 11 | Scrivere in CLAUDE.md la regola del blocco del 22/11 (L11) | codice, decisione di Ivano su cosa entra dopo |
| 12 | Decisioni aperte: controllo «vi» sulle curiosità (P3), titoli generici (P7), tempo della chat (P9) | Ivano |
| 13 | Aggiungere al collaudo i punti oggi scoperti: chat (P9), DNA «Come giri» (P8), schermate senza pagamenti (L12), così il collaudo del 22/11 copre ogni riga «fatto» | codice |

### Dopo il lancio

| # | Cosa | Chi |
|---|---|---|
| 14 | Nominatim in `CityContext` e nella ricerca indirizzi (P6); memoria condivisa del geocoding | codice, decisione di Ivano |
| 15 | 3 tappe senza racconto (P2); buchi dichiarati a Troina e Noto, nomi generici D9 (L7) | codice |
| 16 | Collaudo completo ripetuto sul codice bloccato del 22/11 (L8) | codice |

## 6. Costo AI e Google

Stima, non misurata (nessuno strumento lato server per leggerla): il collaudo ha generato 1 giro Crea (12 s), 3 Per Te (Roma 01:00, 20:00, Catania), le curiosità e i racconti di 10 tappe e una ripetizione del punto 6, tutti con l'account di prova. Stime a listino dai report precedenti (Per Te e Crea ordine di 0,05–0,15 $ a giro, racconto/curiosità ordine di centesimi): **circa 0,5 $ di AI**, sotto il tetto di 3 $. Google (Places, Geocoding, foto, mappa): stima **sotto 0,5 $**. Il banco e la guardia, in riproduzione: 0 $, 0 uscite in rete.

## 7. Cosa NON risolve

Nessun difetto corretto, nessuna funzione pubblicata, nessuna migrazione, nessun secret. Non collauda su iPhone vero, non prova GPS e voce reali, non prova email, cancellazione account, pagamenti, chat e DNA sul sito. Il punto 7 da ospite non può passare finché gli accessi anonimi sono spenti.

## 8. Passi che aspettano Ivano

Sono quelli delle righe 1–9 del §5 (e 12). In ordine pratico: Xcode e Developer Program (entro il 10/11); un solo giro di `db push` + deploy delle funzioni; email e DNS; segnaposto legali; secret Google e voce; accessi anonimi; credito OpenAI; prove su iPhone.
