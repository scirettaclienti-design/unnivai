# LINK-DOMINIO — le email di Auth puntano al nostro sito (2026-11-05)

## Cosa cambia
- Le email di conferma, accesso e recupero password non portano più `{{ .ConfirmationURL }}` (indirizzo `…supabase.co/auth/v1/verify…`, che a Gmail pesa come spam) ma il sito con il token:
  - conferma (`conferma.html`) e accesso (`accesso.html`): `{{ .SiteURL }}/login?token_hash={{ .TokenHash }}&type=email`
  - recupero (`password.html`): `{{ .SiteURL }}/update-password?token_hash={{ .TokenHash }}&type=recovery`
  - `codice.html` (cambio email dell'ospite, codice a 6 cifre) invariato.
  Cambiano il pulsante (`href`), il link scritto e il testo del link di riserva. Il resto dei modelli è identico.
- I file in `supabase/templates/` sono generati da `supabase/functions/_shared/emailUnnivai.ts` (fonte unica, un test li confronta): ho cambiato lì solo i sei indirizzi e il commento in testa, poi rigenerato con `genera-modelli.mjs`. Nessuna Edge Function toccata né rilasciata (`emailUnnivai.ts` è solo un modulo condiviso, nessun workflow rilascia le funzioni).
- `src/lib/linkEmail.js` (nuovo): se l'indirizzo ha `token_hash` e `type` (email, recovery, signup, magiclink, invite) chiama `supabase.auth.verifyOtp({ token_hash, type })`, poi toglie i due parametri con `history.replaceState`. Se la verifica fallisce porta a `/login?recupero=1` (recupero) o `/login?link=scaduto` (gli altri). Lo stesso link verificato due volte (React in sviluppo monta due volte) chiama verifyOtp una volta sola.
- `src/context/AuthContext.jsx`: in `initAuth`, prima di `getSession()`, chiama `verificaLinkEmail`; se era un recupero riuscito fa `setIsPasswordRecovery(true)`. `loading` resta true fino alla fine, quindi `/update-password` non rimanda a `/login` prima del tempo. AuthProvider sta fuori dal Router: il Router monta a verifica finita e legge già l'indirizzo giusto.
- `src/pages/Login.jsx`: `?link=scaduto` apre il login con il messaggio «Il link non è valido o è scaduto. Se hai già confermato l'email, entra con la tua password.» (`MSG_LINK_EMAIL`).
- I link vecchi di Supabase già nelle caselle continuano a funzionare: tornano sul sito senza `token_hash`, nessuna chiamata a verifyOtp, li legge il client come prima.

## Verifica nella documentazione (supabase-js 2.97.0, installato)
- `EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email'` (`auth-js/dist/main/lib/types.d.ts`). `type: 'email'` è il tipo per conferma e link di accesso con `token_hash` (`signup` e `magiclink` sono i nomi storici, accettati).
- `verifyOtp` con `type: 'recovery'` emette `PASSWORD_RECOVERY` (`GoTrueClient.js`: `_notifyAllSubscribers(params.type == 'recovery' ? 'PASSWORD_RECOVERY' : 'SIGNED_IN', session)`). L'evento arriva da solo; lo stato è impostato comunque a mano.

## Test
- `src/__tests__/lib/linkEmail.test.js` (6): recovery ok → ok/recovery e parametri tolti; email ok → utente, resto dell'indirizzo intatto; errore email → messaggio di link scaduto; errore o eccezione su recovery → `/login?recupero=1`; senza parametri o con tipo non nostro → nessuna chiamata a verifyOtp e indirizzo intatto; doppia verifica → una chiamata.
- `src/__tests__/email/modelliEmail.test.js`: i tre modelli devono avere esattamente il nuovo link (pulsante, link scritto, testo) e nessun `{{ .ConfirmationURL }}`; variabili ammesse `.TokenHash`, `.SiteURL`, `.Email`.
- `scripts/email/anteprime.webkit.mjs`: aggiunto un valore d'esempio per `{{ .TokenHash }}`.
- Locale: vitest 280 file / 3465 test verdi, lint 0 errori (188 avvisi già presenti), build ok, `npm run banco:guardia` ok.

## Esito dal sito pubblicato
Vedi la sezione in fondo, compilata dopo il READY di Vercel.

## Cosa resta (non fatto qui, di proposito)
- Caricare i quattro modelli su Supabase (`scripts/email/carica-modelli.mjs`): lo fanno il coordinatore e Ivano dopo il merge. Finché non sono caricati, le email continuano a portare il vecchio link, che funziona.
- Nel pannello Auth del progetto `ahecpiwsdhghkndncejb`, `Site URL` deve essere `https://unnivai.vercel.app` (con `localhost` i nuovi link porterebbero a localhost).
- Gmail: prova di consegna reale dopo il caricamento.
- Un link valido si consuma una sola volta: scanner di posta che aprono il link prima dell'utente lo bruciano (l'utente vede il messaggio di link scaduto). Il codice a 6 cifre della PR #50 evita il problema.

## Per la PR #50 (onboarding-accesso), al rebase
- `supabase/functions/_shared/emailUnnivai.ts`, blocchi `confirmation`, `magic_link`, `recovery` (righe ~125-160, dove la #50 aggiunge `codiceGrande` con `{{ .Token }}`): nei sei punti `pulsante.url` e `linkCopiabile(...)` va tenuto il nostro indirizzo (`{{ .SiteURL }}/login?token_hash={{ .TokenHash }}&type=email`, per recovery `/update-password?...&type=recovery`) al posto di `{{ .ConfirmationURL }}`; il codice `{{ .Token }}` della #50 resta. Anche il commento in testa al file (variabili elencate).
- `supabase/templates/{conferma,accesso,password}.html` e `soggetti.json`: non risolvere a mano, rigenerare con `node --experimental-strip-types scripts/email/genera-modelli.mjs` dopo aver risolto il `.ts`.
- `src/__tests__/email/modelliEmail.test.js`: il test «ha le variabili giuste» (la #50 lo riscrive con le liste per modello e `toHaveLength(3)` su `.ConfirmationURL`): le liste devono includere `.TokenHash`, e il conto delle tre occorrenze riguarda il nostro link, non `.ConfirmationURL`. Il blocco `LINK` e la verifica `not.toContain('{{ .ConfirmationURL }}')` sono nostri.
- `scripts/email/anteprime.webkit.mjs`: tenere la riga `'{{ .TokenHash }}': 'a1b2c3d4e5f6'` in `ESEMPIO`.
- `src/pages/Login.jsx`: la #50 riscrive il file. Va riportato: `?link=scaduto` (`searchParams.get('link') === 'scaduto'`) che mostra un messaggio (la #50 ha già `T.LINK_SCADUTO` in `testiAccount.js` per `?recupero=1`; basta un secondo testo, o riusare lo stesso) e non lascia l'utente senza il campo dove leggerlo. `MSG_LINK_EMAIL`, `daLinkScaduto` e le due `useState` (`selectedRole`, `authMode`) sono le righe nostre, sparite nella #50.
- `src/context/AuthContext.jsx`: la #50 cambia l'import in testa (`SchermataCaricamento`) e il blocco di caricamento (~riga 50). Le nostre righe sono l'`import { verificaLinkEmail }` e le tre righe (commento, `const link = await verificaLinkEmail(supabase)`, `if (link.esito === 'ok' && link.tipo === 'recovery') setIsPasswordRecovery(true)`) dentro `initAuth` prima di `getSession()`: i conflitti sono vicini ma indipendenti, tenere entrambi.
- `src/lib/linkEmail.js` e `src/__tests__/lib/linkEmail.test.js`: nuovi, nessun conflitto. Con il codice a 6 cifre della #50 `/update-password?token_hash=…` resta utile per i link vecchi e per il recupero.
