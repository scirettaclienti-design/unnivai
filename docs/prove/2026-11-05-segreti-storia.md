# SEGRETI-STORIA — chiavi nella storia git e nel sito pubblicato (05/11/2026)

Il repository è stato pubblico fino al 05/11. Scansione di sola lettura: la storia non è stata riscritta, nulla è stato ruotato, nessuna console toccata. In questo report non c'è nessun segreto intero: solo tipo, file, commit, data e ultime 4 cifre.

## Cosa cambia per Ivano

- Da ruotare o restringere: **2 chiavi ancora valide** (Google Maps `…kQgM`, Mapbox `…QIdA`). La terza, Anthropic `…UQAa`, oggi non funziona più (401), ma si conferma dalla console.
- La chiave Google `…kQgM` è anche nel sito pubblicato (è la chiave del browser) e nella storia. Una chiamata di prova con un `Referer` qualunque (`example.org`) è stata accettata: non risulta una restrizione per sito. È la più urgente, per il rischio di costo.
- Nessuna chiave Supabase `service_role`, nessuna OpenAI, Resend, Stripe, token Vercel o GitHub, né nella storia né nel sito.
- La chiave anon di Supabase (`…Cy_U`, ruolo `anon`, progetto `ahecpiwsdhghkndncejb`, scade nel 2036) è pubblica per natura: nessuna azione.

## Come si è cercato

| Passo | Strumento | Esito |
|---|---|---|
| Storia git, tutti i rami e i tag | gitleaks 8 (installato con brew), `--log-opts=--all --redact`, report JSON ridotto | 582 commit, 51,9 MB, 15 segnalazioni |
| Ricerca mirata, righe aggiunte di `git log -p --all` | script con espressioni per `sk-ant-`, `sk-proj-`/`sk-`, `AIza`, `pk.`/`sk.` Mapbox, JWT (payload decodificato, solo `role`, `ref`, `exp`), `re_`, `sk_live`/`sk_test`/`rk_`/`whsec_`, `ghp_`/`gho_`/`github_pat_`, `vcp_` | stesse chiavi di gitleaks, nessuna in più |
| Rami considerati | dopo `git fetch origin '+refs/heads/*:refs/remotes/origin/*' --tags`: 160 riferimenti (159 rami, 0 tag, 0 stash). I rami locali degli altri worktree sono nello stesso repo e sono dentro `--all` | — |
| Sito pubblicato `unnivai.vercel.app` | index.html e tutti i file `.js` raggiunti per riferimento ricorsivo (anche i chunk a richiesta): 184 file, 1,9 MB | trovate solo la chiave Google `…kQgM` e l'anon Supabase `…Cy_U` |
| Albero attuale di `origin/main` | `git grep` degli stessi modelli | nessuna chiave intera (restano modelli finti nei test e nel controllo CI `scripts/controlla-chiavi.mjs`; `AUDIT_AI.md` cita la Google solo mascherata) |

Le 15 segnalazioni di gitleaks: 13 JWT (tutti la stessa anon), 1 Google (`AUDIT_AI.md`), 1 Mapbox (`.env`).

## Tabella

| Tipo | Dove | Commit | Data | Ultime 4 | Ancora valida | Azione |
|---|---|---|---|---|---|---|
| Anthropic (`sk-ant-api03-…`) | `.antigravityrc` (tolto dall'albero con `0477fed` il 21/10, resta nella storia) | `41f394d` | 23/02/2026 | `…UQAa` | no: `GET /v1/models` risponde 401 `invalid x-api-key` (una chiamata, gratuita) | **ruotare**: confermare nella console che è revocata |
| Google Maps (`AIza…`) | storia: `AUDIT_AI.md` (`5c03e74`, oggi mascherata); sito: `assets/index-BHWmcLx2.js` (3 volte) e `assets/MapAPIWrapper-DxhHknP2.js` | `5c03e74` | 10/04/2026 | `…kQgM` | sì: Geocoding risponde 200 senza `Referer`, con `https://unnivai.vercel.app/` e con `https://example.org/`; restrizione per sito **non risulta** (da verificare nella console) | **ruotare** (nuova chiave con restrizione referrer) |
| Mapbox pubblico (`pk.eyJ…`, utente `unnivai`) | `.env` (tolto dal tracciamento con `17dbfe0` il 13/02) | `ff9d6fd` | 05/02/2026 | `…QIdA` | sì: lo stile `streets-v12` risponde 200 senza `Referer`, con unnivai.vercel.app e con example.org: nessuna restrizione di URL | **ruotare** (un `pk.` è pubblico per natura solo se ha restrizioni URL; questo non le ha). Non è nel sito di oggi |
| Supabase anon (JWT `role: anon`) | 13 file di prova (`check_mario.mjs`, `test_*.mjs`, `verify_*.js`, …) nella storia; sito: `index-BHWmcLx2.js` (4), `MapPage-tn4pcYJJ.js` (3), `Profile-Cxydt7Rc.js` (1) | `41f394d`, `5c03e74` | 23/02 e 10/04/2026 | `…Cy_U` | sì, è quella in uso | chiave pubblica per natura (la protezione è RLS) |
| Supabase `service_role` | non trovata | — | — | — | — | — |
| OpenAI, Resend, Stripe, Vercel, GitHub | non trovate | — | — | — | — | — |

`.env.e2e` (tracciato) contiene valori finti, dichiarato nel file.

## Chiavi da ruotare, per urgenza

1. **Google Maps `…kQgM`** (subito: valida, nel sito e nella storia, senza restrizione per sito osservata).
   - Pannello: https://console.cloud.google.com/apis/credentials (progetto della chiave). Creare una chiave nuova con «HTTP referrers» `https://unnivai.vercel.app/*`, `https://*.unnivai.vercel.app/*`, `http://localhost:*/*` e limite alle sole API usate; poi eliminare la vecchia. Elenco dei referrer in `DVAI-009-GOOGLE-MAPS-RESTRICTIONS.md`. Controllare in https://console.cloud.google.com/apis/dashboard l'uso degli ultimi mesi.
   - Dopo la rotazione: variabile `VITE_GOOGLE_MAPS_API_KEY` in Vercel (https://vercel.com, progetto unnivai, Settings, Environment Variables, Production e Preview) e **nuova distribuzione** (la chiave è nel bundle); `.env.local` (anche in `~/unnivai-1b`). Se nelle funzioni Supabase c'è un secret con lo stesso valore (per esempio per le ricerche di luoghi), aggiornare anche quello con `supabase secrets set` — qui non verificato, perché i secret non si leggono. Una chiave usata da server non può avere restrizione referrer: usarne due separate.
2. **Mapbox `…QIdA`** (valida, senza restrizioni di URL, ma non più nel sito).
   - Pannello: https://account.mapbox.com/access-tokens/ — eliminare il token (o, se serve ancora, aggiungere le restrizioni URL e crearne uno nuovo).
   - Dopo: `VITE_MAPBOX_TOKEN` in Vercel solo se la variabile esiste e il codice la usa (nel sito di oggi non compare nessun token Mapbox); `.env.local` se presente.
3. **Anthropic `…UQAa`** (già non valida: 401).
   - Pannello: https://console.anthropic.com/settings/keys — verificare che non sia elencata come attiva; se lo è, eliminarla.
   - Dopo: niente da aggiornare. La chiave in uso (`ANTHROPIC_API_KEY`, secret Supabase) è un'altra e non compare nella storia.

Cosa NON serve: ruotare l'anon di Supabase, riscrivere la storia per le chiavi già morte (dopo la rotazione le chiavi trovate non valgono più). Nessuna delle tre è stata usata per altro che per le chiamate di verifica sopra.

## Costo

AI: 0 $. Google: 3 chiamate Geocoding (circa 0,015 $ a listino) per la verifica della restrizione. Mapbox: 3 richieste di stile. Anthropic: 1 richiesta di elenco modelli (gratuita).

## Cosa non risolve

- Qui si è solo letto, nulla è stato riscritto: chi ha clonato il repo prima del 05/11 ha la storia. Per questo la rotazione conta più della pulizia.
- «Ancora valida» per Google e Mapbox si basa su una chiamata di prova: le restrizioni per API o per IP, se esistono, vanno lette nella console.
- La scansione del sito copre i file `.js` raggiungibili da index.html il 05/11; i chunk non referenziati nel codice non sono visibili dall'esterno.
- I secret di Supabase e le variabili di Vercel non sono stati letti (non si leggono, e non era il compito).

## Passi che aspettano Ivano

1. Ruotare Google `…kQgM` (punto 1) e ridistribuire il sito.
2. Eliminare Mapbox `…QIdA` (punto 2).
3. Confermare la revoca di Anthropic `…UQAa` (punto 3).
4. Poi una riga in `docs/LANCIO.md` (L10) con la data.
