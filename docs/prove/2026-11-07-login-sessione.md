# LOGIN-SESSIONE (T26) — il codice serve solo dopo «Esci» (2026-11-07)

Ivano: «l'app mi chiede il codice a ogni accesso». Diagnosi e correzione. Nessuna migrazione, nessuna funzione del server, nessun secret, nessuna impostazione Auth cambiata.

## In parole semplici, per Ivano
**La sessione dell'app resta salvata** sul telefono dopo la chiusura del browser e dopo ore: l'ho provata su iPhone 14 (WebKit) con l'account di prova vero. Il codice non è richiesto a ogni accesso per colpa del salvataggio. Ho trovato **una colpa vera dell'app** e **tre cose che non sono colpa sua**.

**Colpa dell'app (corretta):**
1. **«Esci» buttava fuori da tutti i telefoni.** Premere «Esci» sul Mac (o su un altro telefono) chiudeva la sessione anche sull'iPhone: la volta dopo, il codice. Ora «Esci» chiude solo il telefono su cui lo premi. Prima/dopo misurato con due telefoni sullo stesso account: prima il secondo telefono era fuori, ora resta dentro.
2. **All'apertura senza rete l'app restava ferma sul caricamento** (fino a mezzo minuto) e poi poteva sembrare «uscita». Ora, se il server non risponde entro 8 secondi (o la lettura del salvataggio sbaglia), l'app entra con la sessione salvata sul telefono; se il server la rifiutasse davvero, porta al codice.
3. Chiede al browser di non buttare la memoria del sito quando il telefono ha poco spazio (`navigator.storage.persist()`). Dove il browser non lo concede (Safari in una scheda) non cambia niente.

**Non è colpa dell'app (e come si evita):**
- **Ogni indirizzo ha la sua memoria.** `unnivai.vercel.app`, un'anteprima di Vercel, `localhost`, `unnivai.com` (il sito vetrina, non l'app): sessioni separate. Se un giorno apri l'app da un indirizzo e il giorno dopo da un altro, per il browser sono due siti. Usa sempre `https://unnivai.vercel.app`.
- **Safari e l'app aggiunta alla Home hanno memorie separate.** Chi entra da Safari e poi apre l'icona sulla Home vede due sessioni: un codice per ciascuna, una volta sola. Scegli un modo e tienilo.
- **Regole di Safari (ITP):** se non apri il sito per **7 giorni** di uso di Safari, Safari cancella la memoria del sito (compresa la sessione). L'app sulla Home e l'app iPhone Capacitor non hanno questo limite. Navigazione privata: la sessione muore alla chiusura della scheda. «Cancella dati dei siti web» di Safari: idem. In questi casi il codice è giusto e inevitabile.
- Un telefono nuovo o dopo «Esci»: il codice è giusto.

## Cosa ho guardato (e trovato a posto)
- Client Supabase (`src/lib/supabase.js`): `createClient(url, anon)` senza opzioni → `persistSession` e `autoRefreshToken` accesi, `detectSessionInUrl` acceso, storage = `localStorage` (chiave `sb-<progetto>-auth-token`), mai `sessionStorage`. Un test (`sessioneGuardia.test.js`) vieta di spegnerli.
- Nessun codice svuota il localStorage a caso: `localStorage.clear()` non esiste in `src`; la pulizia di «Esci» e di «Elimina account» toglie solo chiavi `dvai_*`/`unnivai_*` e simili, mai `sb-*`.
- `signOut` si chiama solo da «Esci» (TopBar, dashboard guide e business) e da «Elimina account». Nessun `signOut` automatico su errori 401.
- Route: `RoleGuard` e `RootDispatcher` aspettano `loading` (il primo `getSession`) prima di rimandare al login: nessuna corsa. Il rinnovo del token d'accesso (scaduto dopo ore) funziona: provato.
- App iPhone (Capacitor 8, WKWebView, `capacitor://localhost`): il localStorage persiste fra le aperture dell'app. Resta il rischio raro che iOS lo svuoti con pochissimo spazio libero (proposta sotto).
- Durata del token d'accesso misurata dalla sessione vera: 3600 s (1 ora), con token di rinnovo che lo rinnova da solo. Le impostazioni del progetto (durata massima della sessione, inattività, rotazione dei token di rinnovo) **non si leggono** senza il token di gestione del progetto e non le ho toccate: vedi passi di Ivano.

## Prove (WebKit iPhone 14, `scripts/prova-nav/login-sessione.webkit.mjs`)
«Telefono chiuso e riaperto» = nuovo contesto che riparte da `storageState` (la memoria del sito che Safari conserva). Porta e titolo verificati prima delle credenziali (porta 5391, cwd del processo = questo worktree, titolo «Unnivai»). Schermate in `docs/prove/dati/login-sessione/{prima,dopo}/`, esiti in `esiti-vero.json` / `esiti-finto.json`.

| Prova | Prima (codice di main) | Dopo |
|---|---|---|
| A. accesso, chiudo, riapro: dentro senza codice | ok (vero e finto) | ok (vero e finto) |
| B. riapro dopo ore (token scaduto, rinnovo): senza codice | ok | ok |
| C. riapro con la rete assente: dentro entro 14 s, mai il codice | caricamento fermo (schermata «UnniVai» a 6 s, nessun ingresso) | dentro con la sessione salvata, resta dentro quando torna la rete |
| D. «Esci» sul telefono 1: il telefono 2 resta dentro (solo vero) | **NO**: telefono 2 sulla home pubblica, fuori | ok |
| E. dopo «Esci» riaprendo: si torna al login col codice, token rimosso | ok | ok |

Simulato (Supabase finto, flusso del codice): A, B, C, E come sopra. Vero (account di prova, password, «Hai una password? Accedi →»): A–E. Voce del telefono, nessuna chiamata AI.

## Codice e test
- `src/lib/sessione.js` (nuovo): `SCOPE_ESCI = 'local'`, `sessioneSalvata`, `leggiSessioneAlAvvio` (attesa 8 s, un nuovo tentativo, poi la sessione salvata), `chiediMemoriaStabile`.
- `AuthContext.jsx`: `signOut({ scope: 'local' })`, apertura con `leggiSessioneAlAvvio`, `persist()` una volta dopo l'accesso. `lib/supabase.js`: stesso scope nell'helper.
- Test: `lib/sessione.test.js` (14), `context/AuthContext_sessione.test.jsx` (3), `lib/sessioneGuardia.test.js` (3). Suite 3517/3517, lint 0 errori, build ok, `npm run banco:guardia`: home 12/12, banco 10/10, pertinenza nessun ❌ nuovo.
- Testi a schermo: nessuno nuovo (niente da dire all'utente: la correzione è invisibile).

## Cosa NON risolve
- Memoria cancellata da Safari (7 giorni, dati dei siti, navigazione privata), Safari ≠ Home, indirizzi diversi: non sono correggibili dall'app.
- Rete assente con sessione davvero scaduta lato server: l'app entra con la sessione salvata, ma i dati non arrivano finché non torna la rete; se il server poi la rifiuta, porta al codice.
- Rischio raro di svuotamento del localStorage dell'app iPhone con spazio quasi finito.

## Proposte (non fatte: non chieste)
- App iPhone: copia della sessione in `@capacitor/preferences` (Keychain/UserDefaults) come seconda memoria. Serve un plugin nuovo e la build iOS.
- Un «Esci da tutti i dispositivi» esplicito nel Profilo, se serve (`scope: 'global'`), ora che «Esci» è locale.

## Passi di Ivano
1. Dashboard Supabase del progetto UNNIVAI → Authentication → Sessions / JWT: controlla che non ci siano «Time-box user sessions» né «Inactivity timeout» impostati (se ci sono, la sessione scade comunque); «Detect and revoke potentially compromised refresh tokens» può restare acceso.
2. Sul telefono: aprire l'app sempre da `https://unnivai.vercel.app` (o sempre dall'icona Home) e dopo il rilascio provare: entra col codice, chiudi tutto, riapri → deve entrare senza codice; «Esci» sul Mac → l'iPhone resta dentro.
