# Ripartenza — DoveVai, sessione chiusa il 17/09/2026

Riepilogo di **questa sessione** (continuazione di una conversazione compattata almeno una volta). Incollalo in una chat nuova se serve continuità. Non sostituisce `DOVEVAI_HANDOFF.md` (il log ufficiale, append-only, su `main`): questo file è più corto, orientato a "cosa ho fatto e cosa resta", con i puntatori per andare a leggere il dettaglio vero quando serve.

**Non fidarti dei numeri sotto senza riverificarli**, in particolare gli hash e lo stato dei worktree:

```bash
git worktree list
git -C /Users/mac2023ivanosciretta/unnivai-1b status --short
git -C /Users/mac2023ivanosciretta/unnivai-1b log --oneline -8
git -C "/Users/mac2023ivanosciretta/unnivai ricresa" status --short
```

---

## 1. Struttura repo (invariata, confermata questa sessione)

- `main` vive nel worktree **`/Users/mac2023ivanosciretta/unnivai-1b`** — è lì che si lavora, si committa, si pusha. Tutto il lavoro FUNZIONALE nasce e vive su `main`.
- `estetica` vive nella cartella principale **`/Users/mac2023ivanosciretta/unnivai ricresa`** (questo file è lì). Era già ferma a `f12c495`, indietro rispetto a `main`, prima di questa sessione — questa sessione non ci ha lavorato, resta indietro di **6 commit in più** rispetto all'ultimo controllo (12/09).
- Su `estetica` restano non tracciati/modificati, **pre-esistenti, non toccati**: `.gitignore` modificato, `RIPARTENZA.txt` (il file precedente a questo, dell'ultima sessione visiva), `_hero_shot/`. Non è chiaro a chi appartengano — non cancellarli né committarli senza chiedere.

## 2. Stato di `main` a fine sessione (verificato indipendentemente, non solo riportato da un agente)

```
c5d12a0  handoff: Gate SEME (L2), la verifica dal vivo e i 21 catch silenziosi trovati
45e585a  fix(onboarding): il seme dichiarato viene salvato davvero, e se fallisce si vede
40391a8  handoff: il taglio a 20 spostato dopo il filtro di categoria
79f54fa  fix(candidati): il taglio a 20 non precede più il filtro di categoria
db44413  handoff: RLS guide_requests consolidata, una policy per operazione
898f238  fix(rls): guide_requests — una sola policy per operazione, tutte owner-only
76522b9  (base da cui è partita questa sessione)
```

Pulito, pushato, `origin/main` allineato. **748 test verdi**, lint fermo a **197 warning / 0 errori**, build pulita — verificato in prima persona alla fine di ogni task, non solo dichiarato dagli agenti.

---

## 3. Cosa è stato fatto in questa sessione, in ordine

### 3.1 — RLS `guide_requests`: una sola policy per operazione

**Obiettivo**: la tabella aveva 4 policy INSERT identiche + UPDATE/DELETE su ruolo `public` invece di `authenticated` — ridondanza fragile (la stessa tabella aveva già avuto un incidente l'8/09: una delle policy "identiche" era scivolata in silenzio a `WITH CHECK (true)`).

**Fatto**: consolidate a 1 policy per operazione (SELECT/INSERT/UPDATE/DELETE), tutte `authenticated`, tutte owner-only (`auth.uid() = user_id`); UPDATE ha ricevuto anche un `WITH CHECK` esplicito (prima mancava: un utente poteva riassegnare `user_id` della propria riga a qualcun altro). Verificato con un test funzionale a 9 passaggi dentro una transazione con `ROLLBACK` (nessun dato persistito), simulando due utenti reali via `SET LOCAL ROLE authenticated` + `request.jwt.claim.sub`.

**Migration**: `supabase/migrations/20260912_gate_rls_guide_requests_dedup_policies.sql`. Commit: `898f238` (fix) + `db44413` (handoff).

### 3.2 — Diagnosi: cosa serve perché il "DNA" (preference graph) pesi sull'ordinamento delle tappe

**Solo diagnosi, zero codice modificato.** Mappate 6 domande (cosa raccoglie il preference graph, dove si legge/scrive, come entra nel prompt, dove avviene l'ordinamento dei candidati, come si combinerebbe `qualityScore` con l'affinità, e il cold-start) con `provato`/`ipotesi` separati e file:riga per ogni risposta. **Non è in `DOVEVAI_HANDOFF.md`** (era diagnosi pura, non un commit) — il report completo è nella trascrizione di questa conversazione; se serve rileggerlo, va recuperato da lì, non da un file nel repo.

**Trovati durante la diagnosi, non corretti allora** (due di questi sono stati poi chiusi, vedi 3.3/3.4):
- Il taglio a 20 candidati avveniva PRIMA del filtro di categoria → **chiuso, 3.3**.
- Il seme onboarding scriveva su colonne inesistenti di `profiles` → **chiuso, 3.4**.
- Codice morto: `DashboardUser.jsx:52-87` (`rankByPreferences`/`getAffinityScore`), mai chiamato — **ancora lì, non toccato**.
- `SurpriseTour.jsx:201-212` inietta ancora il DNA dentro `userPrompt` invece che nel parametro `aiProfile` — anti-pattern che il Gate INTENT F65 aveva rimosso altrove, mai bonificato qui — **ancora lì**.
- 3 tassonomie di categoria diverse e in parte contraddittorie (`CORE_CATEGORIES` nel DNA, `TOUR_CATEGORIES` nel motore, `CATEGORIA_TO_TOUR_CATEGORY` nel filtro) — **nessuna unificazione fatta**.
- `preferenceEngine.normalizeCategory` non riconosce 13 dei 18 `types` reali di Google Places — chiunque tenti di dare affinità ai candidati Places grezzi oggi otterrebbe quasi solo zeri — **non risolto**.

Proposta una scomposizione in **9 sotto-task ordinati** (ST-1 tassonomia autorevole, ST-2 persistenza seme onboarding, ST-3 taglio dopo categoria, ST-4 pulizia codice morto, ST-5 vocabolario Places, ST-6 funzione affinità isolata, ST-7 pesi fino al motore, ST-8 combinare qualityScore+affinità, ST-9 soglia di attivazione), ciascuno con rischio esplicito. **Fatti solo ST-3 e ST-2** (sotto). Gli altri sette restano da fare, in quell'ordine — ST-1 è un prerequisito per ST-5/ST-6/ST-7/ST-8.

### 3.3 — ST-3: il taglio a 20 candidati spostato DOPO il filtro di categoria

**Causa**: `fetchRealPOICandidates` (`aiRecommendationService.js`) ordinava per `qualityScore` e tagliava a 20 candidati **prima** che il chiamante applicasse il filtro di categoria/raggio. A Cabras, "le spiagge più belle": 24 ristoranti (molte recensioni, `qs` alto) occupavano tutti i 20 posti, le 3 spiagge vere (poche recensioni) restavano fuori — il Gate RAGGIO-CATEGORIA (guard-rail costruito la settimana prima) scattava a vuoto, perché non c'era più niente da filtrare.

**Fatto**: `fetchRealPOICandidates` non taglia più — raccoglie, deduplica, ordina e basta. Il taglio a 20 vive ora nel chiamante, **dopo** il filtro di categoria, **incondizionato** (fuori dall'`if` di categoria: Path B e le categorie trasversali non ci passerebbero mai altrimenti — rischio di prompt senza tetto, evitato). Effetto collaterale voluto: `countForWiden` (decide se allargare il raggio) ora conta sul pool intero, non sui soli top-20 già impoveriti dal taglio.

**Verificato da me**: diff riletto riga per riga, rosso→verde riprodotto isolando il file pre-fix (`git checkout <rev> -- <file>`), 742→748 test (i nuovi scenari), lint/build invariati.

Migration: nessuna (solo codice). Commit: `79f54fa` (fix) + `40391a8` (handoff).

### 3.4 — ST-2: il seme onboarding ora sopravvive a logout e cambio dispositivo

**Causa**: `Onboarding.jsx` scriveva su `profiles.interests`/`profiles.onboarding_complete` — colonne **mai esistite** (verificato su `information_schema`). L'upsert falliva sempre, l'errore finiva in un `console.warn` ingoiato, e l'app navigava al dashboard come se avesse salvato. Il seme viveva solo in `localStorage`, cancellato al logout — moriva al primo logout, non esisteva su un secondo device. Pesa +0.3 per categoria (contro +0.05 di una singola interazione comportamentale): è la metà forte del DNA.

**Decisione presa**: nuova colonna `user_preferences.onboarding_seed jsonb` (nullable, senza default — NULL="mai fatto/sincronizzato", `[]`="skip esplicito"). **Non** su `profiles` (è la tabella con la storia di colonne documentate-e-mai-create, causa di questo stesso bug). **Non** dentro `preference_data` esistente (violerebbe la regola locked "il seme non entra mai nel preferenceGraph").

**Fatto**: `dataService.upsertOnboardingSeed()` dedicata (non riusa `upsertUserPreferences`, per non rischiare di sovrascrivere il grafo comportamentale di un client non sincronizzato — verificato dal vivo che un upsert parziale non tocca le altre colonne). `Onboarding.jsx`: un fallimento di salvataggio ora **blocca** (niente `navigate`, niente flag "fatto"), mostra un errore vero con pulsante "Riprova"; lo skip ("Salta per ora") passa dallo stesso meccanismo e scrive `[]` sul server. `useAILearning.js`: il seme ha un setter, viene rimpiazzato dal valore server nel sync-in già esistente al mount, il server vince quando risponde (NULL non tocca il locale).

**Verificato dal vivo sul DB di produzione**, non solo con test: utente usa-e-getta, sessione reale, RLS reali — seme scritto, sopravvive a logout+nuovo login, illeggibile da un client anonimo (RLS confermate). Pulizia completa dopo, zero residui in `auth.users`/`user_preferences` (verificato di nuovo da me in modo indipendente).

**⚠️ Cosa sapere**: per la verifica dal vivo, l'agente ha dovuto usare un indirizzo taggato sulla **tua vera casella Gmail** (`sciretta.clienti+dvai-verify-onboarding-...@gmail.com`), perché il progetto ha l'auto-conferma email disattivata e un dominio fittizio non avrebbe mai potuto ricevere il link di conferma. L'account di test e le righe sono stati cancellati, ma **la mail di conferma di Supabase potrebbe essere ancora nella tua inbox reale** — cancellala se vuoi. Se preferisci che in futuro non si usi mai il tuo indirizzo reale (nemmeno con `+tag`), va detto esplicitamente in una prossima sessione: non è ancora una regola scritta da nessuna parte.

**Trovato durante l'implementazione, non corretto (fuori perimetro dichiarato)**: **21 catch silenziosi** su scritture Supabase (`insert`/`update`/`upsert`/`delete`) sparsi nel repo che nascondono fallimenti di scrittura — elenco completo con file:riga in `DOVEVAI_HANDOFF.md`, sessione 16/09 (vedi sotto). I peggiori: `DashboardGuide.jsx:326` (mostra "offerta inviata" anche se la scrittura fallisce), `dataService.js:410,413` (`toggleFavorite` ritorna `{success:true}` dal `catch`), `Login.jsx:100` (account business creato senza il suo record `activities` se l'insert fallisce), `aiRecommendationService.js:384` (quota AI giornaliera che può non incrementarsi mai). Il repo aveva già scritto la lezione su questo pattern (handoff riga 4709, "una write senza `.error` controllato è un no-op travestito da successo") senza che fosse mai stata chiusa sistematicamente — è la terza volta che questo pattern specifico causa un bug reale.

Migration: `supabase/migrations/20260916_gate_seme_onboarding_seed_server.sql`. Commit: `45e585a` (fix) + `c5d12a0` (handoff).

---

## 4. Dove leggere il dettaglio vero

- **`DOVEVAI_HANDOFF.md`** su `main` (worktree `unnivai-1b`), dal fondo: le sessioni "RLS guide_requests" (12/09), "il taglio a 20 spostato dopo il filtro di categoria" (13/09), "Gate SEME (L2)" (16/09, include l'elenco completo dei 21 catch silenziosi).
- Le migration citate sopra, in `supabase/migrations/`.
- La diagnosi DNA a 6 domande (3.2) **non è su file** — è nella trascrizione di questa conversazione. Se serve rifarla o riprenderla da lì, va richiesta esplicitamente ("rileggi la diagnosi DNA di questa sessione").

## 5. Regole di lavoro confermate valide in questa sessione

1. Il lavoro funzionale nasce e vive su `main` (worktree `unnivai-1b`), mai su `estetica`.
2. Ogni fix delegato a un agente (spesso opus, per i task di giudizio architetturale) va riverificato in prima persona: diff riletti riga per riga, test/lint/build rieseguiti, rosso→verde riprodotto isolando i file del fix con `git checkout <rev-precedente> -- <file>`. Fatto sistematicamente per tutti e 3 i fix di questa sessione, mai un caso in cui l'agente avesse effettivamente sbagliato codice — ma un caso (il seme onboarding) in cui l'agente ha usato un metodo di verifica (la vera casella email) diverso da quanto istruito, e va segnalato all'utente, non dato per scontato che vada bene.
3. Quando il FATTO QUANDO di un task chiede esplicitamente commit+push, si fa senza richiedere conferma aggiuntiva.
4. Commit separati per fix e per handoff, come da convenzione consolidata del repo.
5. Prima di una decisione architetturale (dove salvare un dato, quale tabella, quale schema) — quando il task lo chiede esplicitamente — la decisione va presa e riportata PRIMA di scrivere codice, con la motivazione, non lasciata implicita nel diff.

## 6. Cosa resta aperto — non toccato in questa sessione

Dalla sessione precedente (12/09, `RIPARTENZA.txt`), ancora valido salvo verifica:
- **Verdict device su iPhone** (`https://unnivai.vercel.app`) — mai fatto, resta il collo di bottiglia più vecchio del progetto.
- Voci C4, S1-S6, il prompt `placesDiscoveryService.js:203` con `"rating": 4.5` nel template, `SurpriseTour.jsx:274`/`QuickPath.jsx:638` con rating letterali, `QuickPath.jsx:449` guardia sul nome città lungo, C3 (`TourDetails.jsx:961,963`) — nessuna toccata.
- Le due decisioni storiche mai prese (chat con le guide in V1? modal "Tour su Misura" resta?).
- Riallineamento `estetica` ← `main` — ancora più indietro di prima (6 commit in più).

Da questa sessione:
- I 7 sotto-task della diagnosi DNA non ancora fatti: **ST-1** (tassonomia autorevole — prerequisito di ST-5/6/7/8), ST-4 (pulizia codice morto + `SurpriseTour`), ST-5 (vocabolario Places per il DNA), ST-6 (funzione affinità isolata), ST-7 (pesi fino al motore), ST-8 (combinare qualityScore+affinità — nessun dato nel DB per tararlo, va dichiarato), ST-9 (soglia di attivazione unificata).
- I 21 catch silenziosi (elenco in handoff, sessione 16/09) — diagnosticati, nessuno corretto.
- La mail di conferma Supabase nella tua inbox reale (vedi 3.4).

---

Parti da qui: se devi fare aggiornamenti su `main`, verifica prima lo stato reale (comandi in cima a questo file), poi decidi se riprendere uno dei 7 sotto-task DNA, uno dei catch silenziosi, o il verdict device — o dimmi cosa ti serve e vediamo insieme.
