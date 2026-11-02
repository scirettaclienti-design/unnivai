# ACCOUNT-PRIVACY (T8, notte del 03/11/2026)

Cartella `~/unnivai-notte-account-privacy` (verificata con `pwd`), ramo `notte/account-privacy` da `origin/main` (`f563604`). Costo AI del task: **0 $** (nessuna generazione; solo letture dello schema in sola lettura e un accesso all'account di prova).

## Cosa cambia per Ivano
1. **Profilo → «Elimina account»**: elenco di cosa si cancella, «non si torna indietro», si scrive «elimina». Chiama la Edge Function nuova `elimina-account`. **Oggi la funzione non è pubblicata**: il tasto lo dice («non riesco a raggiungere il servizio… non ho cancellato niente»), provato dal vivo con l'account di prova: nessun falso «fatto», l'account resta.
2. **`/privacy` e `/termini`** pubbliche (senza login), in cima «Bozza da far verificare a un legale»; link da Landing, Login, Profilo e dal consenso. 18 flussi di dati, uno per uno (cosa parte, verso chi, perché, quanto resta). Titolare, indirizzo, email, foro ed età minima sono segnaposto gialli: li compili tu.
3. **Consenso ai servizi AI di terzi** alla prima apertura (anche per l'ospite): nomina Anthropic e OpenAI e cosa ricevono, «Va bene», link alla privacy, «Non adesso». Senza il «Va bene» non parte nessuna richiesta a openai-proxy (giro, chat, racconto, curiosità, lista città, voce) e lo dice.

## Inventario dello schema (letto in sola lettura, 03/11)
- **A cascata già oggi** (ON DELETE CASCADE verso `auth.users`): profiles, notifications, reviews (user_id), saved_tours, completed_tours, dna_events, user_preferences, guide_requests, guides_profile, businesses_profile (id), tours (guide_id), ai_quota_daily, ai_quota_test_account (e ai_quota_ospite, nella migrazione dell'ospite).
- **Bloccavano la cancellazione** (FK senza ON DELETE): bookings e favorites (→ profiles), user_photos (→ explorers e tours), explorers, guides, activities.owner_id, businesses_profile.user_id.
- **Senza FK, orfane**: reviews.guide_id, bookings dei tour della guida, ai_generation_ticket.subject (`user:<id>`/`ospite:<id>`), waitlist (per email).
- **SET NULL (restavano anonime)**: nav_events, error_logs: ora cancellate.
- **Storage**: tour-images e business-media (file con `owner` = utente) tolti con l'API; **voce-cache e le cache di luoghi (place_racconti, place_facts, places_cache, city_knowledge) non sono dell'utente: non si toccano.**
- Scelta: **nessuna modifica alle FK**, una sola funzione SQL `public.elimina_dati_utente(uuid, text)` (SECURITY DEFINER, solo service_role) che cancella in una transazione; poi la Edge Function toglie i file e per ultimo l'utente di auth (se un passo si ferma, il JWT vale ancora e si rifà: tutto è ripetibile).

## Consenso: dove si ricorda e perché
`user_metadata.consenso_ai = { v, at }` (Supabase Auth, `updateUser`) più copia in localStorage legata all'id utente; senza utente solo localStorage. **Niente migrazione**: user_metadata c'è, è scrivibile solo dall'utente, e segue l'account su ogni telefono (provato: dopo il «Va bene» un contesto WebKit nuovo che rientra con l'account di prova non rivede la schermata). `VERSIONE_CONSENSO` si alza se cambia l'elenco dei servizi.

## Prove
- `npm run test:run` 257 file, 3207 test verdi; `npm run lint` 0 errori; build ok; `npm run banco:guardia` **12/12**, nessun ❌ nuovo (il replay usa un utente finto che ha già dato il consenso: `scripts/banco/replay/supabase-finto.js`).
- **«I dati spariscono davvero»**: `bash scripts/test-elimina-account-sql.sh` su Postgres 17 in Docker: auth/storage finti + 25 tabelle con le FK reali di produzione; prima la DELETE dell'utente si blocca sulle FK, poi funzione + delete: zero righe dell'utente in 24 tabelle/colonne, tour, foto e prenotazioni sui suoi tour, biglietti, lista d'attesa; B intatto; cache dei luoghi intatta; anon e authenticated non possono chiamare la funzione; ripetibile due volte. **TUTTO OK.**
- `src/__tests__/functions/eliminaAccount.test.js` (12): esegue il file vero della funzione: id dal token (non dal corpo), conferma obbligatoria, ordine dati→file→utente, 401/400/405/503/500, nessuna email né token nei log.
- `src/__tests__/lib/consensoAi.test.js`, `services/consensoAiServizi.test.js` (nessuna richiesta di rete senza consenso: giro, chat, racconto, curiosità, voce), `components/accountPrivacy.test.jsx` (conferma, esiti onesti, timeout, schermata del consenso, pagine legali con bozza e segnaposto).
- WebKit iPhone 14 in locale: `/privacy`, `/termini`, Landing e Login mostrano le pagine e i link; Profilo → Elimina account → errore onesto.
- Collaudo del sito pubblicato dopo il merge: vedi la fine di questo file.

## Cosa NON risolve
- Migrazione e funzione non sono applicate/pubblicate (regole del task): la cancellazione in app **non funziona finché Ivano non esegue i due comandi**.
- I testi legali sono una bozza: base giuridica, età minima, trasferimenti extra-UE (Anthropic, OpenAI, Google, Vercel, Resend), tempi di conservazione di error_logs e nav_events (oggi nessuna scadenza automatica) vanno decisi con un legale.
- Stripe: l'app oggi non chiede pagamenti (BookingSystem non è montato); la privacy lo dice.
- Resend: la pagina dice «se il servizio è attivo»; da confermare quando le email sono davvero in uso.
- Il consenso non si può ritirare da una schermata (proposta, non fatta); la voce senza consenso ricade sulla voce del telefono senza avviso.
- Gli script WebKit che entrano con l'account di prova non richiedono modifiche (il consenso sta nei metadati dell'account); solo quelli con ospite anonimo cliccano «Va bene» (collaudo-sito e ospite-giro aggiornati).

## Passi che aspettano Ivano
1. `cd` nel repo su main aggiornato; `supabase db push --dry-run` (deve mostrare solo `20261103010000_elimina_account.sql`, e prima `20261102200000_ospite_giro.sql` se non applicata), poi `supabase db push`.
2. `supabase functions deploy elimina-account --project-ref ahecpiwsdhghkndncejb --use-api` (verifica JWT accesa, nessun secret nuovo).
3. Prova con un account usa e getta (anche «Prova senza account»): Profilo → Elimina account; controllare poi che l'utente non esista più in Auth.
4. Compilare i segnaposto in `src/lib/testiAccount.js` (`SEGNAPOSTO`) e far rivedere privacy e termini a un legale.
5. Sull'iPhone: prima apertura con un account nuovo (schermata del consenso), `/privacy` dal Profilo.
