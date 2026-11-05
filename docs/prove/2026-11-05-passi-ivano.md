# PASSI-IVANO — i passi di produzione fatti con Ivano (05/11/2026)

Sito: https://unnivai.vercel.app · progetto Supabase `ahecpiwsdhghkndncejb` · ogni comando sulla produzione è stato mostrato e fatto solo dopo il «sì» di Ivano.
Nessun valore segreto in questo report: le chiavi stanno nel Portachiavi di macOS e nei secret di Supabase.

## I blocchi

| # | Blocco | Fatto | Verifica |
|---|---|---|---|
| 1 | Resend | dominio `unnivai.com` in Resend, 4 record DNS su Vercel, dominio verificato, chiave «solo invio» | Resend: dominio *Verified* |
| 2 | Auth | SMTP Resend, Site URL `https://unnivai.vercel.app`, redirect `/login` e `/update-password`, 30 email/ora | email di recupero arrivata in Posta in arrivo, link sul nostro dominio |
| 3 | Modelli email | modelli caricati con link `token_hash` verificati dall'app (PR #51/#52) | email di recupero aperta dal link: password cambiata |
| 4 | Migrazioni | `db push --dry-run`, poi `db push`: `20261102160000_lista_attesa_email`, `20261102200000_ospite_giro`, `20261103010000_elimina_account`, `20261104090000_avvisi` | `schema_migrations` le elenca tutte e 4 |
| 5 | Funzioni | `lista-attesa-email` v2, `elimina-account` v2, `avvisi` v2, `openai-proxy` v52 (da main aggiornato, dopo CI verde) | tutte ACTIVE |
| 6 | Secret | `RESEND_API_KEY`, `LISTA_ATTESA_RISPONDI_A`, `AVVISI_CHIAVE` (+ stessa chiave nel Vault per pg_cron), `AVVISI_EMAIL_A`, `VOCE_TELEFONO_USER_IDS` (solo l'account di prova `cee972ab-…`) | riepilogo avvisi arrivato in Posta in arrivo (03:49); job pg_cron 200; collaudo con 0 richieste alla voce OpenAI |
| 7 | Accessi anonimi | accessi anonimi **on**, collegamento manuale **on** (limite 30 anonimi/ora per IP) | rilettura della configurazione; collaudo punto 7 da ospite verde |
| 7b | Codice email a 6 cifre | `mailer_otp_length` 8 → **6** (scadenza 3600 s invariata) | rilettura: 6. Serviva: il campo «codice» della registrazione ospite accetta 6 cifre, con 8 nessun ospite poteva registrarsi. Serve anche alla PR #50. Per tornare indietro: 8 |

### Record DNS creati su Vercel (`unnivai.com`)

| id | nome | tipo |
|---|---|---|
| `rec_44b37632304141f47d5ac04d` | `resend._domainkey` | TXT (DKIM) |
| `rec_b901e74377886ae55d24dd97` | `send` | CNAME |
| `rec_434d8d6acaec778770aaf944` | `rsend` | CNAME |
| `rec_513a9c079fa7d9759e6abe0c` | `_dmarc` | TXT `v=DMARC1; p=none;` |

## Prove sul sito pubblicato

- **Giro da ospite (collaudo punto 7)**: verde. «Prova un giro» → gusti saltati → avvia → fine giro su `/map` con «Salva questo giro», mai sul login; anche il ramo con l'account è verde. Esito in `docs/prove/dati/2026-11-05-passi-ivano-punto7.json`, schermate in `docs/prove/schermate/passi-ivano/`.
- **Cancellazione account**: un account usa e getta creato come ospite, Profilo → Elimina account → «elimina». `elimina-account` risponde 200 in ~3 s, l'app torna alla home; prima righe in 6 tabelle (auth.users, sessioni, profiles, user_preferences, due quote), dopo **0 righe in tutte le 37 colonne utente** controllate; log della funzione «eliminato (file: 0)». Rifatta con un secondo account: stesso esito in app.
- **Voce**: il collaudo usa la voce del telefono; 0 richieste alla voce OpenAI (chiamata diretta: `usaVoceTelefono: true`).
- **Registrazione da ospite completa (prova § 7 di OSPITE-GIRO, `ospite-giro.webkit.mjs`)**: **TUTTO OK** alle 15:35 (`docs/prove/dati/2026-11-05-ospite-giro.json`, schermate in `docs/prove/schermate/ospite-giro/`). Telefono nuovo, nessuna credenziale: ospite entrato, giro di Catania da 7 tappe camminato fino alla fine, «Salva questo giro» apre la registrazione (momento `fine`); un secondo Crea apre l'invito «Il prossimo giro parte dal tuo account» con **0 generazioni nuove**; email → codice di 6 cifre arrivato nella casella di Ivano (letto da lui) → password → **stesso id utente** (`f124f9b7…`), non più anonimo, email confermata; Profilo con 1 giro e Catania. Nel database: 7 «tappa raggiunta» e la fine del giro sull'account registrato. 0 errori della pagina, voce del telefono.
  - L'indirizzo principale di Ivano ha già un account: si è usato un suo alias con il «+» (stessa casella).
  - Primo tentativo fermato dallo script (cliccava il «Chiudi» della fine giro, coperto dal foglio): ora cerca il «Chiudi» dentro il foglio. Secondo tentativo fermato per codice non scritto in 10 minuti (email partita alle 15:04, Ivano non era alla posta). Generazioni da ospite usate oggi da questo IP: 9 su 10.
  - Osservazione: per lo stesso giro ci sono 2 righe `tour_completed` in `dna_events` (il contatore del Profilo conta i giri distinti e mostra 1). Non toccato. **Chiuso (ONBOARDING-ACCESSO § 10)**: una riga per categoria (cultura, food) come da DNA-1, non un doppione; il formato resta (decisione di Ivano), test `giroUnaVolta.test.js`.

## Correzione del collaudo (non dell'app)

L'ospite nuovo va da `/` alla home e poi ai gusti (`/onboarding`); «Salta per ora» fa `/dashboard-user` → `/` → `/dashboard-user` nello stesso istante. Il collaudo apriva la mappa nel mezzo e il `goto` veniva interrotto. In `collaudo-sito.webkit.mjs` (punto 7) e `ospite-giro.webkit.mjs` (passo 1) ora si aspetta l'ultima pagina, si saltano i gusti e si lascia assestare la navigazione (1,5 s).

## LANCIO

**15 su 22** (prima 12): **L3 EMAIL-LANCIO**, **L6 Avvisi** e **P10 OSPITE-GIRO** diventano «fatto». Aggiornate anche P5 (VOCE-TEST in produzione, manca il credito OpenAI) e L5 (migrazione, funzione e prova di cancellazione fatte; restano i segnaposto legali).

## Verifiche della PR

Lint 0 errori, suite 3465/3465, build ok, `banco:guardia` 12/12, pertinenza senza ❌ nuovi, banco 40 10/10.

## Aperti

1. **«Account eliminato.» non compare** dopo la cancellazione: il server cancella tutto e l'app torna alla home, ma in 10 s il messaggio non si vede. Difetto dell'app, da guardare in un task a parte (non corretto qui). **Chiuso in ONBOARDING-ACCESSO § 10** (PR #50): `signOut` smontava ToastProvider; ora il messaggio aspetta in `sessionStorage` (`eliminaAccountMessaggio.test.jsx`).
2. **Chiavi Google (GOOGLE-CHIAVI, riga L10)**: non fatte. Oggi `GOOGLE_SERVER_KEY` non c'è, `places-proxy` è la v19 del 13/10 (senza il percorso `geocode`: il telefono risponde 403 e ripiega), `openai-proxy` v52 ha il codice nuovo ma usa ancora la chiave vecchia come ripiego. Passi, in ordine (dettagli e restrizioni in `docs/prove/2026-11-06-google-chiavi.md`):
   1. console Google (https://console.cloud.google.com/apis/credentials) → crea la chiave del **server** «Unnivai server»: nessuna restrizione di applicazione, 3 API (Places API, Places API (New), Geocoding API), quote giornaliere e avviso di budget;
   2. `supabase secrets set GOOGLE_SERVER_KEY="<chiave server>" --project-ref ahecpiwsdhghkndncejb`;
   3. `supabase functions deploy places-proxy --project-ref ahecpiwsdhghkndncejb` da main aggiornato (porta anche il `geocode`, T24);
   4. ripubblica `openai-proxy` da main aggiornato dopo CI verde, poi collaudo;
   5. console Google → crea la chiave del **browser** «Unnivai browser»: referrer `https://unnivai.vercel.app/*`, `https://unnivai.com/*`, `https://*.unnivai.com/*`, `http://localhost:*/*`; 4 API (Maps JavaScript API, Places API, Geocoding API, Directions API);
   6. Vercel → Settings → Environment Variables → `VITE_GOOGLE_MAPS_API_KEY` (Production e Preview) = chiave browser, poi Redeploy;
   7. app iOS: prova l'origine `capacitor://localhost/*`;
   8. 24 ore di controllo in console (richieste per credenziale), poi revoca della vecchia `…kQgM` e `supabase secrets unset GOOGLE_MAPS_API_KEY --project-ref ahecpiwsdhghkndncejb`;
   9. elimina Mapbox `…QIdA`, conferma revocata Anthropic `…UQAa`, data nella riga L10.
3. **`AVVISI_SUPABASE_TOKEN`** non messo: il riepilogo arriva, ma senza gli errori del proxy e il costo Google.
4. **Credito OpenAI** finito: per gli utenti veri parla la voce del telefono (P5).
5. **Segnaposto legali** di privacy e termini da compilare e far leggere a un legale (L5 passo 3).
6. **Email non provate una per una**: conferma, accesso e lista d'attesa (il recupero e gli avvisi sì).
7. **Utenti anonimi abbandonati**: con gli accessi anonimi accesi crescono in `auth.users`; serve una pulizia periodica (nessun task aperto).
8. Facoltativo: tetti per gli ospiti `AI_OSPITI_DAILY_CAP=100` e `AI_OSPITE_IP_DAILY_CAP=10` (oggi valgono i valori del codice).
